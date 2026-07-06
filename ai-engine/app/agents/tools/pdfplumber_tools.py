"""
pdfplumber-based table extraction tool.
Agents prefer this over vision for G703 because it's faster and gives
exact numbers without OCR rounding errors.
"""
from __future__ import annotations
import base64
import io
import logging
import os
from langchain_core.tools import tool
from app.agents.tools.pdf_tools import download_pdf_bytes

logger = logging.getLogger(__name__)

# G703 column header keywords → canonical key mapping
_COL_MAP = {
    # Item / description
    "item": "item_no",          "item no": "item_no",       "no.": "item_no",
    # Time period
    "period": "time_period",    "date": "time_period",      "billing": "time_period",
    # Phase
    "phase": "phases",          "wbs": "phases",            "site": "phases",
    # Description
    "type": "type_of_work",     "description": "type_of_work", "work": "type_of_work",
    "desc": "type_of_work",
    # Contractor
    "contractor": "contractor_name", "subcontractor": "contractor_name",
    "vendor": "contractor_name",
    # Scheduled values (columns B, C, D in G703)
    "scheduled original": "scheduled_original",
    "original": "scheduled_original",
    "change order": "scheduled_change_orders",
    "change orders": "scheduled_change_orders",
    "scheduled current": "scheduled_current",
    "current": "scheduled_current",
    # Work completed
    "previous application": "work_completed_prev",
    "prev": "work_completed_prev",   "previous": "work_completed_prev",
    "this period": "work_completed_this",
    "this": "work_completed_this",   "current period": "work_completed_this",
    # Materials
    "material": "materials_stored",  "stored": "materials_stored",
    "presently stored": "materials_stored",
    # Total
    "total completed": "total_completed",
    "total": "total_completed",
    # Percentage
    "%": "pct",   "percent": "pct",   "g / c": "pct",   "g/c": "pct",
    # Balance
    "balance": "balance_to_finish",   "balance to finish": "balance_to_finish",
    # Retainage
    "retainage": "retainage",   "retain": "retainage",
}

SOV_KEYS = [
    "item_no", "time_period", "phases", "type_of_work", "contractor_name",
    "scheduled_original", "scheduled_change_orders", "scheduled_current",
    "work_completed_prev", "work_completed_this", "materials_stored",
    "total_completed", "pct", "balance_to_finish", "retainage",
]

def _map_header(headers: list[str]) -> dict[int, str]:
    """Map column indices to canonical SOV keys."""
    mapping: dict[int, str] = {}
    used: set[str] = set()
    for i, h in enumerate(headers):
        if not h:
            continue
        h_lower = h.lower().strip()
        matched = None
        # Try longest match first
        for keyword in sorted(_COL_MAP.keys(), key=len, reverse=True):
            if keyword in h_lower:
                candidate = _COL_MAP[keyword]
                if candidate not in used:
                    matched = candidate
                    used.add(candidate)
                    break
        if matched:
            mapping[i] = matched
        elif "%" in h and "pct" not in used:
            mapping[i] = "pct"
            used.add("pct")
    return mapping

def _parse_num(val: str | None) -> float | None:
    """Parse a numeric cell value to float."""
    if not val:
        return None
    cleaned = str(val).replace(",", "").replace("$", "").replace("%", "").strip()
    if cleaned in ("", "-", "—", "n/a", "na"):
        return None
    try:
        n = float(cleaned)
        return n
    except (ValueError, TypeError):
        return None

def _pct_to_decimal(val: str | None) -> float | None:
    """Convert a percentage string to decimal (75% → 0.75, 0.75 → 0.75)."""
    n = _parse_num(val)
    if n is None:
        return None
    return n / 100.0 if n > 1.0 else n


@tool
def extract_all_sov_pages_with_pdfplumber(blob_url: str, package_id: str) -> dict:
    """
    Download the GC Pay Application PDF and use pdfplumber to extract ALL G703
    Continuation Sheet pages (typically pages 2-12).

    Returns:
        {
          "lines": [ { all 15 SOV columns... }, ... ],
          "page_count": int,
          "sov_page_count": int,
          "method": "pdfplumber_table | pdfplumber_words | failed"
        }
    """
    import pdfplumber

    try:
        b64 = download_pdf_bytes.invoke({"blob_url": blob_url})
        pdf_bytes = base64.b64decode(b64)
    except Exception as e:
        logger.error("extract_all_sov_pages_with_pdfplumber download error: %s", e)
        return {"lines": [], "page_count": 0, "sov_page_count": 0, "method": "failed"}

    import httpx as _httpx, os as _os
    _gw = _os.environ.get("API_GATEWAY_URL", "http://localhost:3001")
    try:
        _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
            json={"message": "[SOV Parser → pdfplumber]: Starting table extraction on all G703 pages...",
                  "node": "extract_gc_sov", "eventType": "info"}, timeout=3)
    except Exception:
        pass

    all_lines: list[dict] = []
    col_mapping: dict[int, str] = {}
    sov_pages = 0

    # G703 must have financial columns — this distinguishes it from General Conditions etc.
    G703_REQUIRED = {"scheduled", "completed", "balance", "retainage"}
    # Stop processing if we see these keywords (General Conditions, supporting docs)
    STOP_KEYWORDS = {"employee name", "billing rate", "per diem", "2025 rate", "2026 rate", "gl date", "vendor"}

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            total_pages = len(pdf.pages)
            logger.info("[pdfplumber] Opened PDF: %d pages", total_pages)

            for page_num in range(2, total_pages + 1):  # G703 starts page 2
                page = pdf.pages[page_num - 1]

                # Quick check — if this page is a supporting doc, skip it
                page_text_lower = (page.extract_text() or "").lower()
                if any(kw in page_text_lower for kw in STOP_KEYWORDS):
                    logger.info("[pdfplumber] Page %d: supporting doc, stopping G703 extraction", page_num)
                    break

                # Try table extraction first
                tables = page.extract_tables()
                extracted_rows: list[list[str]] = []

                if tables:
                    for table in tables:
                        if not table:
                            continue
                        # Detect header row — must have G703-specific financial columns
                        for row_i, row in enumerate(table):
                            cells = [str(c or "").strip() for c in row]
                            row_text = " ".join(cells).lower()
                            # Only accept as G703 header if it has financial keywords
                            has_financial = any(k in row_text for k in G703_REQUIRED)
                            has_work = any(k in row_text for k in ["type of work", "description of work", "description"])
                            if has_financial or has_work:
                                mapping = _map_header(cells)
                                if len(mapping) >= 3:
                                    col_mapping = mapping
                                    extracted_rows = table[row_i + 1:]
                                    break
                            else:
                                extracted_rows.append(row)

                if extracted_rows and col_mapping:
                    sov_pages += 1
                    for row in extracted_rows:
                        cells = [str(c or "").strip() for c in row]
                        if not any(cells):
                            continue
                        # Skip subtotal / total rows
                        joined = " ".join(cells).lower()
                        if any(kw in joined for kw in ["subtotal", "grand total", "total current", "page total"]):
                            continue

                        line: dict = {k: None for k in SOV_KEYS}
                        line["extraction_confidence"] = 0.80

                        for col_idx, key in col_mapping.items():
                            if col_idx >= len(cells):
                                continue
                            raw = cells[col_idx]
                            if not raw:
                                continue
                            if key == "pct":
                                line[key] = _pct_to_decimal(raw)  # float
                            elif key in {"item_no", "time_period", "phases", "type_of_work", "contractor_name"}:
                                line[key] = raw  # string
                            else:
                                n = _parse_num(raw)
                                line[key] = n  # float or None

                        # Truncate string fields to DB column limits
                        for str_f, max_l in [('item_no', 50), ('time_period', 50), ('phases', 200), ('type_of_work', 500), ('contractor_name', 255)]:
                            v = line.get(str_f)
                            if isinstance(v, str) and len(v) > max_l:
                                line[str_f] = v[:max_l]
                        # Clamp pct to 0-1 range
                        p = line.get('pct')
                        if isinstance(p, float) and abs(p) > 1.1:
                            line['pct'] = min(p / 100.0, 1.0)
                        # Include row if it has description or any non-zero scheduled value
                        if line.get("type_of_work") or line.get("scheduled_current") is not None:
                            all_lines.append(line)
                    words = page.extract_words(x_tolerance=3, y_tolerance=3)
                    if words and len(words) > 10:
                        logger.debug("[pdfplumber] Page %d: using word fallback (%d words)", page_num, len(words))
                        # Word-based is less reliable — mark lower confidence
                        # but don't add noise lines; skip if no column map
                        pass

    except Exception as e:
        logger.error("[pdfplumber] extraction error: %s", e)
        return {"lines": all_lines, "page_count": 0, "sov_page_count": sov_pages, "method": "failed"}

    logger.info("[pdfplumber] Extracted %d SOV lines from %d pages", len(all_lines), sov_pages)
    try:
        _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
            json={"message": f"[pdfplumber → SOV Parser]: {'✅ Extracted ' + str(len(all_lines)) + ' lines from ' + str(sov_pages) + ' pages' if all_lines else '⚠️ No table structure found — falling back to vision'}",
                  "node": "extract_gc_sov", "eventType": "success" if all_lines else "warn"}, timeout=3)
    except Exception:
        pass
    return {
        "lines": all_lines,
        "page_count": total_pages,
        "sov_page_count": sov_pages,
        "method": "pdfplumber_table" if all_lines else "no_tables_found",
    }
