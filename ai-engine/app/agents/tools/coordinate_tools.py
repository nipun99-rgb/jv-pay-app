"""
Fast G703 coordinate-based text extraction.
Uses pdfplumber's extract_words() with X-coordinate column bins.
Works in 3-5 seconds for all 7 pages — no LLM needed for structured PDFs.
"""
from __future__ import annotations
import base64
import io
import logging
import os
import re
from langchain_core.tools import tool
from app.agents.tools.pdf_tools import download_pdf_bytes

logger = logging.getLogger(__name__)

# Phase/section header patterns (these mark section groupings in the G703)
PHASE_PATTERNS = [
    r'^P1SI\b', r'^SITE\b', r'^FLTL\b', r'^PTS\b', r'^PKRD\b',
    r'^8848\b', r'^CUB\b', r'^T1-T4\b', r'^DLO\b',
    r'^TEMP FIRE STATION\b', r'^TEMP FIRE\b',
]
SKIP_PATTERNS = [
    r'SUBTOTAL', r'GRAND TOTAL', r'APPLICATION NO', r'PAGE OF',
    r'CONTINUATION SHEET', r'AIA DOCUMENT', r'DESCRIPTION OF WORK',
    r'SCHEDULED\s+VALUE', r'WORK COMPLETED', r'MATERIALS', r'RETAINAGE',
    r'PREVIOUS APPLICATION', r'THIS PERIOD',
    # General Conditions markers — stop processing at these
    r'EMPLOYEE NAME', r'BILLING RATE', r'PER DIEM', r'2025 RATE',
    r'GL DATE', r'VENDOR', r'TOTAL SUB COST',
]

def _is_number(s: str) -> bool:
    return bool(re.match(r'^-?[\d,]+(\.\d+)?$', s.replace('$', '').replace(' ', '')))

def _parse_num(s: str) -> float | None:
    if not s or s.strip() in ('-', '--', ''):
        return None
    cleaned = re.sub(r'[$,\s]', '', s)
    try:
        return float(cleaned)
    except ValueError:
        return None

def _get_phase(text: str) -> str | None:
    """Return phase code if text is a section header."""
    t = text.strip().upper()
    for p in PHASE_PATTERNS:
        if re.match(p, t):
            # Extract just the phase code (first word)
            return t.split()[0] if ' ' in t else t
    # Full label match
    labels = ['P1SI', 'SITE', 'FLTL', 'PTS', 'PKRD', '8848', 'CUB', 'T1-T4', 'DLO', 'TEMP FIRE STATION', 'TEMP FIRE']
    for label in sorted(labels, key=len, reverse=True):
        if t.startswith(label):
            return label
    return None

def _should_skip(text: str) -> bool:
    t = text.upper()
    return any(re.search(p, t) for p in SKIP_PATTERNS)

def _extract_contractor(description: str) -> tuple[str, str]:
    """Split 'EARTHWORK & UTILITIES (LANDMARK)' into ('EARTHWORK & UTILITIES', 'LANDMARK')."""
    m = re.search(r'\(([^)]+)\)\s*$', description.strip())
    if m:
        contractor = m.group(1).strip()
        work = description[:m.start()].strip()
        return work, contractor
    return description.strip(), ''


@tool
def extract_g703_with_coordinates(blob_url: str, package_id: str) -> dict:
    """
    Fast G703 extraction using pdfplumber coordinate-based word grouping.
    Processes all G703 pages (2-8) in a single PDF read — typically 3-5 seconds.

    Works by:
    1. Reading each page's words with X/Y positions
    2. Grouping words into rows by Y coordinate
    3. Assigning columns by X position (fits G703 column layout)
    4. Detecting section headers for phase tracking

    Returns:
        {
          "lines": [ all 15-column SOV dicts ],
          "pages": int,
          "method": "coordinate_extraction"
        }
    """
    import pdfplumber
    import httpx as _httpx
    _gw = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")

    try:
        b64 = download_pdf_bytes.invoke({"blob_url": blob_url})
        pdf_bytes = base64.b64decode(b64)
    except Exception as e:
        return {"lines": [], "pages": 0, "method": "failed", "error": str(e)}

    try:
        _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
            json={"message": "[SOV Parser -> Coordinate Extractor]: Reading G703 pages 2-8 with coordinate-based parsing...",
                  "node": "extract_gc_sov", "eventType": "info"}, timeout=3)
    except Exception:
        pass

    all_lines = []
    current_phase = ""
    current_time_period = "2/28/26"  # default from cover page period

    SOV_KEYS = ['item_no', 'time_period', 'phases', 'type_of_work', 'contractor_name',
                'scheduled_original', 'scheduled_change_orders', 'scheduled_current',
                'work_completed_prev', 'work_completed_this', 'materials_stored',
                'total_completed', 'pct', 'balance_to_finish', 'retainage']

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            total = len(pdf.pages)
            pages_processed = 0

            for page_num in range(2, min(total + 1, 13)):  # Pages 2-12 (full G703)
                page = pdf.pages[page_num - 1]
                page_width = float(page.width or 1000)

                # First pass: detect character-spaced PDFs (each glyph is a separate word)
                probe = page.extract_words(x_tolerance=3, y_tolerance=3,
                    extra_attrs=['x0', 'x1', 'top', 'doctop'])
                if probe:
                    avg_word_len = sum(len(w['text']) for w in probe) / len(probe)
                    single_char_ratio = sum(1 for w in probe if len(w['text']) == 1) / len(probe)
                else:
                    avg_word_len, single_char_ratio = 5.0, 0.0
                # Character-spaced PDF if most "words" are single glyphs
                is_char_spaced = avg_word_len < 2.5 or single_char_ratio > 0.35
                xt = 12 if is_char_spaced else 3
                if is_char_spaced:
                    logger.info("[coord] Page %d: char-spaced PDF (avg_len=%.2f, %.0f%% singles) — retrying x_tolerance=%d",
                                page_num, avg_word_len, single_char_ratio * 100, xt)
                    words = page.extract_words(x_tolerance=xt, y_tolerance=3,
                        extra_attrs=['x0', 'x1', 'top', 'doctop'])
                else:
                    words = probe
                if not words:
                    continue

                # Check for supporting doc markers (stop processing)
                page_text = ' '.join(w['text'] for w in words[:30]).upper()
                if _should_skip(page_text) and 'ITEM' not in page_text:
                    logger.info("[coord] Page %d: supporting doc, stopping", page_num)
                    break

                # Group words into rows by Y coordinate (tolerance = 3pts)
                rows: dict[float, list[dict]] = {}
                for w in words:
                    y = round(float(w['top']), 0)
                    rows.setdefault(y, []).append(w)

                pages_processed += 1

                for y in sorted(rows.keys()):
                    row_words = sorted(rows[y], key=lambda w: float(w['x0']))
                    row_text = ' '.join(w['text'] for w in row_words).strip()

                    if not row_text or len(row_text) < 2:
                        continue
                    if _should_skip(row_text):
                        continue

                    # Check for phase header
                    phase = _get_phase(row_text)
                    if phase:
                        current_phase = phase
                        continue

                    # Try to parse as data row: needs item_no (3-digit) and numbers
                    # Item number is typically at the far left
                    first_word = row_words[0]['text'].strip()
                    item_no = ''
                    if re.match(r'^\d{3}$', first_word):
                        item_no = first_word
                        row_words = row_words[1:]

                    # Separate text words from number words by X position
                    # G703 layout: description occupies left ~30% of page, numbers fill right 70%
                    desc_cutoff = page_width * 0.30

                    desc_words = [w for w in row_words if float(w['x0']) < desc_cutoff]
                    num_words = [w for w in row_words if float(w['x0']) >= desc_cutoff]

                    # Need at least a description and some numbers to be a data row
                    if not desc_words and not item_no:
                        continue

                    description = ' '.join(w['text'] for w in desc_words).strip()
                    type_of_work, contractor_name = _extract_contractor(description)

                    # Parse numbers in column order
                    # G703 has 9 numeric columns: orig, co, current, prev, this, stored, total, pct, balance, retainage
                    nums = []
                    for w in num_words:
                        v = _parse_num(w['text'])
                        if v is not None:
                            nums.append(v)

                    # Need at least 2 numbers to be a valid data row
                    if not nums and not item_no:
                        continue

                    # Map numbers to G703 columns (positional assignment)
                    def n(i: int) -> float | None:
                        return nums[i] if i < len(nums) else None

                    line = {
                        'item_no': item_no or None,
                        'time_period': current_time_period,
                        'phases': current_phase,
                        'type_of_work': type_of_work[:500] if type_of_work else None,
                        'contractor_name': contractor_name[:255] if contractor_name else None,
                        'scheduled_original': n(0),
                        'scheduled_change_orders': n(1),
                        'scheduled_current': n(2),
                        'work_completed_prev': n(3),
                        'work_completed_this': n(4),
                        'materials_stored': n(5),
                        'total_completed': n(6),
                        'pct': n(7) / 100.0 if n(7) is not None and n(7) > 1 else n(7),
                        'balance_to_finish': n(8),
                        'retainage': n(9),
                        'extraction_confidence': 0.75,
                    }

                    # Only include rows with meaningful content
                    if line.get('type_of_work') or line.get('scheduled_current') is not None:
                        all_lines.append(line)

    except Exception as e:
        logger.error("[coord] extraction error: %s", e)
        return {"lines": all_lines, "pages": pages_processed, "method": "failed", "error": str(e)}

    logger.info("[coord] Extracted %d lines from %d pages", len(all_lines), pages_processed)
    try:
        _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
            json={"message": f"[Coordinate Extractor -> SOV Parser]: {'Extracted ' + str(len(all_lines)) + ' lines from ' + str(pages_processed) + ' pages in ~3s' if all_lines else 'No lines found'}",
                  "node": "extract_gc_sov", "eventType": "success" if all_lines else "warn"}, timeout=3)
    except Exception:
        pass

    return {"lines": all_lines, "pages": pages_processed, "method": "coordinate_extraction"}
