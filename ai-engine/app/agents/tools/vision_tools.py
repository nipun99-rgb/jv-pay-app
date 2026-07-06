"""
Vision tools — GPT-4V based field extraction from page images.
Agents call these instead of hardcoded OpenAI calls.
"""
from __future__ import annotations
import json
import logging
from typing import Annotated

from langchain_core.tools import tool

from app.agents import get_llm
from app.agents.tools.pdf_tools import read_pdf_page_as_image

logger = logging.getLogger(__name__)


@tool
def extract_fields_from_page(
    package_id: str,
    page_number: int,
    fields_to_extract: list[str],
) -> dict:
    """
    Use vision AI to extract specific named fields from a PDF page image.
    
    Args:
        package_id: UUID of the package
        page_number: 1-based page number to inspect
        fields_to_extract: List of field names to look for
    
    Returns:
        Dict mapping each field name to {"value": ..., "confidence": 0-1, "reasoning": "..."}
    """
    import httpx as _httpx, os as _os
    _gw = _os.environ.get("API_GATEWAY_URL", "http://localhost:3001")

    # Log: agent calling vision tool
    try:
        _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
            json={"message": f"[GC Cover Extractor → Vision Tool]: Scanning page {page_number} for {len(fields_to_extract)} fields...",
                  "node": "extract_gc_header", "eventType": "info"}, timeout=3)
    except Exception:
        pass

    image_b64 = read_pdf_page_as_image.invoke({"package_id": package_id, "page_number": page_number})
    
    fields_json = json.dumps(fields_to_extract, indent=2)
    prompt = f"""You are an expert construction payment application analyst.
Extract the following fields from this G702/G703 payment application document page.

Fields to extract:
{fields_json}

For each field return:
- "value": the extracted value (string or number as appropriate), or null if not found
- "confidence": 0.0–1.0 confidence score
- "reasoning": brief explanation of where you found it

Return ONLY valid JSON in this exact format:
{{
  "field_name": {{"value": ..., "confidence": ..., "reasoning": "..."}},
  ...
}}
"""
    llm = get_llm()
    response = llm.invoke([{
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}", "detail": "high"}},
        ],
    }])
    
    try:
        text = response.content
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        result = json.loads(text.strip())

        # Log response back to agent
        found = sum(1 for v in result.values() if isinstance(v, dict) and v.get("value") is not None)
        avg_conf = sum((v.get("confidence", 0) for v in result.values() if isinstance(v, dict)), 0.0) / max(len(result), 1)
        try:
            _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
                json={"message": f"[Vision Tool → GC Cover Extractor]: Page {page_number} done — {found}/{len(fields_to_extract)} fields found, avg confidence {avg_conf:.0%}",
                      "node": "extract_gc_header", "eventType": "success" if found > len(fields_to_extract) * 0.7 else "warn"}, timeout=3)
        except Exception:
            pass

        return result
    except Exception as e:
        logger.error("extract_fields_from_page parse error: %s | raw: %s", e, response.content[:200])
        return {f: {"value": None, "confidence": 0.0, "reasoning": f"Parse error: {e}"} for f in fields_to_extract}


@tool
def classify_document_from_page(package_id: str, page_number: int, filename: str) -> dict:
    """
    Classify a document type by visually inspecting its first page.
    
    Returns:
        {
          "file_type": "GC_G702" | "GC_G703" | "SUB_G702" | "SUB_G703" | "LIEN_WAIVER" | "INVOICE" | "OTHER",
          "confidence": 0.0–1.0,
          "reasoning": "..."
        }
    """
    image_b64 = read_pdf_page_as_image.invoke({"package_id": package_id, "page_number": page_number})
    
    llm = get_llm()
    response = llm.invoke([{
        "role": "user",
        "content": [
            {"type": "text", "text": """Classify this construction payment document.
Valid types: GC_G702 (General Contractor Application for Payment cover), GC_G703 (GC Continuation Sheet/SOV),
SUB_G702 (Sub-contractor Application for Payment), SUB_G703 (Sub continuation sheet),
LIEN_WAIVER, INVOICE, OTHER.

Return JSON only: {"file_type": "...", "confidence": 0.0-1.0, "reasoning": "..."}"""},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}", "detail": "high"}},
        ],
    }])
    
    try:
        text = response.content
        if "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except Exception:
        return {"file_type": "OTHER", "confidence": 0.5, "reasoning": "Could not parse vision response"}


@tool
def extract_sov_table_from_page(package_id: str, page_number: int) -> list[dict]:
    """
    Extract G703 Schedule of Values lines from a SPECIFIC page of the GC Pay App PDF.
    Uses vision AI with exact AIA G703 column mapping.
    Returns CSV for compactness (30+ rows per page exceed JSON token limits).
    """
    import os as _os
    from langchain_openai import AzureChatOpenAI as _AOAI
    
    image_b64 = read_pdf_page_as_image.invoke({"package_id": package_id, "page_number": page_number})

    # Use higher token limit for SOV extraction (30+ rows per page)
    sov_llm = _AOAI(
        azure_endpoint=_os.environ["AZURE_OPENAI_ENDPOINT"],
        azure_deployment=_os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5.4"),
        api_version=_os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
        api_key=_os.environ["AZURE_OPENAI_API_KEY"],
        temperature=0.0,
        max_completion_tokens=16384,
    )

    response = sov_llm.invoke([{
        "role": "user",
        "content": [
            {"type": "text", "text": """Extract ALL data rows from this AIA G703 Continuation Sheet.

The G703 table columns (A through J):
A=item_no, B=description (type_of_work, may include contractor in parens like "EARTHWORK (LANDMARK)"),
C=3 sub-cols: scheduled_original | scheduled_change_orders | scheduled_current,
D=work_completed_prev, E=work_completed_this, F=materials_stored,
G=total_completed, H=pct(as decimal 0-1 NOT percent), I=balance_to_finish, J=retainage

Section headers (e.g. "P1SI - PHASE I SITE IMPROVEMENTS") indicate the phase for following rows.

Return ONLY CSV with this exact header, then one row per data item:
item_no,phases,type_of_work,contractor_name,scheduled_original,scheduled_change_orders,scheduled_current,work_completed_prev,work_completed_this,materials_stored,total_completed,pct,balance_to_finish,retainage

Rules:
- monetary values: plain numbers no $ or commas (e.g. 24367286.0)
- pct: 0.0-1.0 (93% = 0.93)
- blank cells: empty (two consecutive commas)
- Skip subtotal rows, section header rows, blank rows
- Include ALL data rows from this page
- No quotes unless value contains comma"""},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}", "detail": "high"}},
        ],
    }])

    try:
        import csv, io as _io
        text = response.content.strip()
        # Remove markdown fences
        if "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        # Remove first line if it's the header
        lines = text.split('\n')
        # Find the header line
        start = 0
        for i, line in enumerate(lines):
            if 'item_no' in line.lower() or 'phases' in line.lower():
                start = i + 1
                break
        
        reader = csv.reader(lines[start:])
        FIELDS = ['item_no','phases','type_of_work','contractor_name',
                  'scheduled_original','scheduled_change_orders','scheduled_current',
                  'work_completed_prev','work_completed_this','materials_stored',
                  'total_completed','pct','balance_to_finish','retainage']
        
        result = []
        for row in reader:
            if not row or not any(row):
                continue
            obj = dict(zip(FIELDS, row + [''] * len(FIELDS)))
            # Convert numeric fields
            for f in FIELDS[4:]:  # skip item_no, phases, type_of_work, contractor_name
                v = obj.get(f, '').strip()
                if v:
                    try:
                        n = float(v.replace(',', '').replace('$', ''))
                        obj[f] = n
                    except ValueError:
                        obj[f] = None
                else:
                    obj[f] = None
            obj['extraction_confidence'] = 0.85
            if obj.get('type_of_work') or obj.get('scheduled_current') is not None:
                result.append(obj)
        
        return result
    except Exception as e:
        logger.error("extract_sov_table_from_page CSV error: %s | raw[:200]: %s", e, response.content[:200])
        return []
