"""
Azure Document Intelligence tool — uses the prebuilt-layout model to
extract tables and text from PDFs with better accuracy than pdfplumber on scanned docs.
"""
from __future__ import annotations
import base64
import logging
import os
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


@tool
def extract_table_with_document_intelligence(blob_url: str, package_id: str) -> dict:
    """
    Use Azure Document Intelligence (prebuilt-layout model) to extract tables
    from a PDF stored in Azure Blob Storage.

    This is the most powerful extraction tool — use it when:
    - pdfplumber finds no tables (scanned or complex layout PDFs)
    - Vision extraction is inconsistent across pages
    - You need the most accurate table structure extraction

    Args:
        blob_url: Full blob URL of the PDF to analyze
        package_id: Package UUID (for activity logging)

    Returns:
        {
          "tables": [ list of tables, each with "rows": [ list of row dicts ] ],
          "sov_lines": [ list of G703 line items already mapped to 15 columns ],
          "page_count": int,
          "method": "document_intelligence"
        }
    """
    import httpx as _httpx
    _gw = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")

    endpoint = os.environ.get("DOC_INTEL_ENDPOINT", "")
    key = os.environ.get("DOC_INTEL_API_KEY", "")

    if not endpoint or not key:
        logger.warning("[doc_intelligence] No endpoint/key configured — tool unavailable")
        return {"tables": [], "sov_lines": [], "page_count": 0, "method": "not_configured",
                "error": "DOC_INTEL_ENDPOINT or DOC_INTEL_API_KEY not set"}

    # Log activity
    try:
        _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
            json={"message": "[SOV Parser → Azure Doc Intelligence]: Sending PDF for prebuilt-layout analysis...",
                  "node": "extract_gc_sov", "eventType": "info"}, timeout=3)
    except Exception:
        pass

    try:
        from azure.ai.documentintelligence import DocumentIntelligenceClient
        from azure.core.credentials import AzureKeyCredential
        from app.agents.tools.pdf_tools import download_pdf_bytes

        # Download PDF bytes (handles private Azure blob auth)
        b64 = download_pdf_bytes.invoke({"blob_url": blob_url})
        pdf_bytes = base64.b64decode(b64)

        client = DocumentIntelligenceClient(endpoint=endpoint, credential=AzureKeyCredential(key))
        poller = client.begin_analyze_document(
            "prebuilt-layout",
            body={"base64Source": base64.b64encode(pdf_bytes).decode()},
            pages="2-8",   # G703 continuation sheet pages only
        )
        result = poller.result()

        # Map Document Intelligence tables to SOV format
        from app.agents.tools.pdfplumber_tools import _map_header, _parse_num, _pct_to_decimal, SOV_KEYS

        all_sov_lines = []
        raw_tables = []

        for table in (result.tables or []):
            max_col = max((c.column_index for c in table.cells), default=0) + 1
            max_row = max((c.row_index for c in table.cells), default=0) + 1

            # Build grid
            grid = [[""] * max_col for _ in range(max_row)]
            for cell in table.cells:
                grid[cell.row_index][cell.column_index] = (cell.content or "").strip()

            raw_tables.append({"row_count": max_row, "col_count": max_col, "sample": grid[:2] if grid else []})

            # Find header row
            col_mapping = {}
            data_start = 0
            for row_idx, row in enumerate(grid):
                row_text = " ".join(row).lower()
                if any(k in row_text for k in ["type of work", "description", "scheduled", "completed"]):
                    col_mapping = _map_header(row)
                    data_start = row_idx + 1
                    break

            if not col_mapping or len(col_mapping) < 3:
                continue

            for row in grid[data_start:]:
                if not any(row):
                    continue
                joined = " ".join(row).lower()
                if any(kw in joined for kw in ["subtotal", "grand total", "total current", "page total"]):
                    continue

                line = {k: None for k in SOV_KEYS}
                line["extraction_confidence"] = 0.85  # Doc Intelligence is high quality

                for col_idx, key in col_mapping.items():
                    if col_idx >= len(row):
                        continue
                    raw = row[col_idx]
                    if not raw:
                        continue
                    if key == "pct":
                        pct_val = _pct_to_decimal(raw)
                        line[key] = pct_val  # keep as float
                    elif key in {"item_no", "time_period", "phases", "type_of_work", "contractor_name"}:
                        line[key] = raw
                    else:
                        n = _parse_num(raw)
                        line[key] = n  # float, not str

                if line.get("type_of_work") or line.get("scheduled_current"):
                    all_sov_lines.append(line)

        # Log result
        try:
            _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
                json={"message": f"[Azure Doc Intelligence → SOV Parser]: {'✅ Extracted ' + str(len(all_sov_lines)) + ' lines from ' + str(len(result.tables or [])) + ' tables' if all_sov_lines else '⚠️ No SOV tables found in document'}",
                      "node": "extract_gc_sov", "eventType": "success" if all_sov_lines else "warn"}, timeout=3)
        except Exception:
            pass

        return {
            "tables": raw_tables,
            "sov_lines": all_sov_lines,
            "page_count": len(result.pages or []),
            "method": "document_intelligence",
        }

    except Exception as e:
        logger.error("[doc_intelligence] extraction error: %s", e)
        try:
            _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
                json={"message": f"[Azure Doc Intelligence → SOV Parser]: ❌ Error: {str(e)[:100]}",
                      "node": "extract_gc_sov", "eventType": "error"}, timeout=3)
        except Exception:
            pass
        return {"tables": [], "sov_lines": [], "page_count": 0, "method": "failed", "error": str(e)}
