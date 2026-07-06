"""
Graph nodes package.

Sprint 1: stubs only.
Sprint 3: ingest_node fully implemented (download blobs → pdf2image → store page images).
Full implementations for remaining nodes added in Sprints 4–12.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import tempfile
from typing import Any

from app.graph.state import PayAppState

logger = logging.getLogger(__name__)


def _stub(name: str, state: PayAppState) -> PayAppState:
    logger.info("[stub] node=%s package_id=%s", name, state.get("package_id"))
    return {**state, "current_node": name}


# ─── helpers ──────────────────────────────────────────────────────────────────

def _get_blob_client():
    """Return an Azure BlobServiceClient using env config."""
    from azure.storage.blob import BlobServiceClient
    conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
    if not conn_str:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING not set")
    return BlobServiceClient.from_connection_string(conn_str)


def _container_name() -> str:
    return os.environ.get("AZURE_STORAGE_CONTAINER_NAME", "jvpay-docs")


def _download_blob(blob_url: str) -> bytes:
    """Download a blob by its full URL using the storage account credentials."""
    from urllib.parse import urlparse
    parsed = urlparse(blob_url)
    # URL: https://{account}.blob.core.windows.net/{container}/{blob_name...}
    parts = parsed.path.lstrip('/').split('/', 1)
    container_name = parts[0]
    blob_name_path = parts[1] if len(parts) > 1 else ''
    svc = _get_blob_client()
    blob_client = svc.get_blob_client(container=container_name, blob=blob_name_path)
    return blob_client.download_blob().readall()


def _upload_image(image_bytes: bytes, blob_name: str, content_type: str = "image/jpeg") -> str:
    """Upload image bytes to blob storage and return the public URL."""
    svc = _get_blob_client()
    container = svc.get_container_client(_container_name())
    blob = container.get_blob_client(blob_name)
    blob.upload_blob(image_bytes, content_type=content_type, overwrite=True)
    return blob.url


def _pdf_to_images(pdf_bytes: bytes, dpi: int = 150) -> list[bytes]:
    """Convert PDF bytes to a list of JPEG image bytes (one per page)."""
    import os as _os
    from pdf2image import convert_from_bytes
    # On Windows, poppler may not be in the subprocess PATH; locate it explicitly.
    poppler_path: str | None = None
    _winget_poppler = (
        r"C:\Users\KR614XU\AppData\Local\Microsoft\WinGet\Packages"
        r"\oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe"
        r"\poppler-25.07.0\Library\bin"
    )
    if _os.path.isfile(_os.path.join(_winget_poppler, "pdftoppm.exe")):
        poppler_path = _winget_poppler
    pil_images = convert_from_bytes(pdf_bytes, dpi=dpi, fmt="jpeg", poppler_path=poppler_path)
    result = []
    for img in pil_images:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        result.append(buf.getvalue())
    return result


# ─── Sprint 3: ingest_node ────────────────────────────────────────────────────

def ingest_node(state: PayAppState) -> PayAppState:
    """
    Sprint 3: For each document blob URL in state['documents']:
      1. Download the PDF from Azure Blob Storage
      2. Convert to page images at 150 DPI using pdf2image
      3. Upload each page image back to blob storage
      4. Populate state['page_images'] with {page_num, image_url, doc_index}
    """
    package_id = state.get("package_id", "unknown")
    logger.info("[ingest] Starting ingest for package_id=%s", package_id)

    documents: list[dict[str, Any]] = state.get("documents", [])
    page_images: list[dict[str, Any]] = []
    updated_documents: list[dict[str, Any]] = []

    for doc_index, doc in enumerate(documents):
        blob_url: str = doc.get("blob_url", "")
        filename: str = doc.get("filename", f"doc_{doc_index}.pdf")
        logger.info("[ingest] Processing doc %d: %s", doc_index, filename)

        try:
            # 1. Download
            pdf_bytes = _download_blob(blob_url)
            logger.info("[ingest] Downloaded %d bytes for %s", len(pdf_bytes), filename)

            # 2. Convert to page images
            images = _pdf_to_images(pdf_bytes)
            page_count = len(images)
            logger.info("[ingest] Converted %s → %d pages", filename, page_count)

            # 3. Upload page images
            base_name = filename.rsplit(".", 1)[0]
            for page_num, image_bytes in enumerate(images, start=1):
                img_blob_name = f"page-images/{package_id}/{base_name}_p{page_num:04d}.jpg"
                image_url = _upload_image(image_bytes, img_blob_name)
                page_images.append({
                    "page_num": page_num,
                    "image_url": image_url,
                    "doc_index": doc_index,
                    "filename": filename,
                })
                logger.info("[ingest] Uploaded page image: %s", img_blob_name)

                # Emit progress every 25 pages so the Activity Log updates
                if page_num % 25 == 0 or page_num == page_count:
                    import urllib.request as _ur
                    import json as _json
                    _api = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")
                    _msg = f"📄 Ingesting {filename}: page {page_num}/{page_count}"
                    try:
                        _req = _ur.Request(
                            f"{_api}/api/packages/{package_id}/activity",
                            data=_json.dumps({"message": _msg, "eventType": "info", "node": "ingest"}).encode(),
                            headers={"Content-Type": "application/json"},
                            method="POST",
                        )
                        _ur.urlopen(_req, timeout=3)
                    except Exception:
                        pass

            updated_documents.append({**doc, "page_count": page_count})

        except Exception as exc:
            logger.exception("[ingest] Failed to process doc %d (%s): %s", doc_index, filename, exc)
            # Continue processing other documents; mark this one failed
            updated_documents.append({**doc, "page_count": 0, "ingest_error": str(exc)})

    logger.info(
        "[ingest] Complete: %d documents, %d page images",
        len(updated_documents),
        len(page_images),
    )

    return {
        **state,
        "current_node": "ingest",
        "status": "INGESTED",
        "documents": updated_documents,
        "page_images": page_images,
    }


# ─── Sprint 4: Classification helpers ─────────────────────────────────────────

_CLASSIFY_CONF_HEURISTIC = 0.85  # skip LLM if heuristic hits this
_CLASSIFY_CONF_LLM = 0.85        # skip vision if LLM hits this

_HEURISTIC_PATTERNS: dict[str, list[str]] = {
    "GC_G702": [
        r"application\s+for\s+payment",
        r"\bg-?702\b",
        r"contractor.{0,5}s\s+application",
        r"original\s+contract\s+sum",
        r"net\s+change",
        r"architect.{0,5}s\s+certificate",
        r"general\s+contractor",
    ],
    "GC_G703": [
        r"\bg-?703\b",
        r"continuation\s+sheet",
        r"scheduled\s+value",
        r"work\s+completed",
        r"balance\s+to\s+finish",
        r"retainage",
        r"item\s+no",
    ],
    "SUB_G702": [
        r"subcontractor.{0,5}s?\s+application",
        r"sub.*application\s+for\s+payment",
        r"subcontract\s+amount",
        r"sub.{0,15}pay.{0,15}app",       # filename: "SubContractors Pay app"
        r"sub.{0,15}g702",                  # filename: "sub_g702"
        r"subcontractor",                   # any filename with subcontractor
        r"subapp",                          # filename: "SubApp12.pdf"
    ],
    "SUB_G703": [
        r"subcontractor.*continuation",
        r"sub.*scheduled\s+value",
        r"subcontractor.*g-?703",
        r"sub.{0,15}g703",
    ],
}

_CLASSIFY_SYSTEM_PROMPT = (
    "You are an expert construction document classifier specializing in AIA pay application forms.\n\n"
    "Classify the provided text into exactly one of these types:\n"
    "- GC_G702: General Contractor Application for Payment (AIA G702) — single-page form with original contract sum, "
    "net change by change orders, contract sum to date, total completed, balance to finish, architect certification.\n"
    "- GC_G703: General Contractor Continuation Sheet (AIA G703) — table with columns: Item No., Description of Work, "
    "Scheduled Value, Work Completed (prior/current period), Materials Stored, % Complete, Balance to Finish, Retainage.\n"
    "- SUB_G702: Subcontractor Application for Payment — same structure as GC_G702 but from a subcontractor.\n"
    "- SUB_G703: Subcontractor Continuation Sheet — same table structure as GC_G703 but for a subcontractor.\n"
    "- OTHER: Any other document (invoice, lien waiver, insurance cert, cover letter, etc.).\n\n"
    "Respond with ONLY valid JSON, no markdown:\n"
    '{"file_type": "GC_G703", "confidence": 0.92, "reasoning": "brief one-line explanation"}'
)

_CLASSIFY_VISION_PROMPT = (
    "You are an expert construction document classifier. Analyze this document page image.\n\n"
    "Classify it as one of:\n"
    "- GC_G702: General Contractor Application — form layout with payment amounts, signature blocks, contract sum fields.\n"
    "- GC_G703: General Contractor Continuation Sheet — tabular layout with numbered items and scheduled value columns.\n"
    "- SUB_G702: Subcontractor Application for Payment — similar form to GC_G702 from a subcontractor.\n"
    "- SUB_G703: Subcontractor Continuation Sheet — similar table to GC_G703 from a subcontractor.\n"
    "- OTHER: Any other document type.\n\n"
    "Respond with ONLY valid JSON:\n"
    '{"file_type": "GC_G703", "confidence": 0.88, "reasoning": "brief one-line explanation"}'
)


def _get_aoai_client():
    """Return an AzureOpenAI client from env config."""
    from openai import AzureOpenAI
    return AzureOpenAI(
        azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", ""),
        api_key=os.environ.get("AZURE_OPENAI_API_KEY", ""),
        api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    )


def _heuristic_classify(text: str, filename: str) -> tuple[str, float]:
    """Score document type using keyword patterns on filename + page text."""
    fname_lower = filename.lower()
    combined = (filename + " " + text).lower()
    best_type = "OTHER"
    best_count = 0
    best_total = 1

    # Filename-only check first: strong signal → confidence 0.88 (skips LLM tier)
    _FILENAME_PATTERNS: dict[str, list[str]] = {
        "SUB_G702": [r"subapp", r"subcontractor", r"sub.{0,15}pay", r"sub.{0,8}g702"],
        "GC_G702":  [r"gc.{0,5}g702", r"gc.{0,8}app", r"application.*pay"],
        "GC_G703":  [r"gc.{0,5}g703", r"continuation"],
    }
    for file_type, patterns in _FILENAME_PATTERNS.items():
        if any(re.search(p, fname_lower) for p in patterns):
            return file_type, 0.88  # high-confidence from filename alone

    for file_type, patterns in _HEURISTIC_PATTERNS.items():
        if not patterns:
            continue
        count = sum(1 for p in patterns if re.search(p, combined))
        if count > best_count:
            best_type = file_type
            best_count = count
            best_total = len(patterns)

    if best_count == 0:
        return "OTHER", 0.60

    # Map match ratio to confidence: 1 match → 0.65, each extra adds ~0.07 up to 0.92
    confidence = min(0.65 + (best_count - 1) * 0.07, 0.92)
    return best_type, round(confidence, 2)


def _llm_classify(text: str, deployment: str) -> tuple[str, float, str]:
    """LLM text-based classification."""
    client = _get_aoai_client()
    snippet = text[:3000]
    resp = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": _CLASSIFY_SYSTEM_PROMPT},
            {"role": "user", "content": f"Document text:\n\n{snippet}\n\nRespond with JSON only."},
        ],
        temperature=0.0,
        max_completion_tokens=200,
    )
    raw = (resp.choices[0].message.content or "{}").strip()
    # Strip markdown fences if LLM wraps JSON
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'```\s*$', '', raw, flags=re.MULTILINE).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r'\{[^{}]+\}', raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
    return (
        str(data.get("file_type", "OTHER")),
        float(data.get("confidence", 0.5)),
        str(data.get("reasoning", "")),
    )


def _vision_classify(image_url: str, deployment: str) -> tuple[str, float, str]:
    """Vision-based classification using the first page image."""
    image_bytes = _download_blob(image_url)
    b64 = base64.b64encode(image_bytes).decode()
    client = _get_aoai_client()
    resp = client.chat.completions.create(
        model=deployment,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": _CLASSIFY_VISION_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ],
        }],
        temperature=0.0,
        max_completion_tokens=200,
    )
    raw = (resp.choices[0].message.content or "{}").strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'```\s*$', '', raw, flags=re.MULTILINE).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r'\{[^{}]+\}', raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
    return (
        str(data.get("file_type", "OTHER")),
        float(data.get("confidence", 0.5)),
        str(data.get("reasoning", "")),
    )


def classify_node(state: PayAppState) -> PayAppState:
    """Sprint 4: 3-tier cascade classification (heuristic → LLM text → LLM vision)."""
    import pdfplumber

    package_id = state.get("package_id", "unknown")
    documents: list[dict[str, Any]] = state.get("documents", [])
    page_images: list[dict[str, Any]] = state.get("page_images", [])
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_GPT4O", "gpt-5.4")

    classifications: list[dict[str, Any]] = []

    for doc_index, doc in enumerate(documents):
        blob_url: str = doc.get("blob_url", "")
        filename: str = doc.get("filename", f"doc_{doc_index}.pdf")
        logger.info("[classify] doc=%d filename=%s", doc_index, filename)

        file_type = "OTHER"
        confidence = 0.60
        method = "heuristic"
        reasoning = "No patterns matched"

        try:
            # Download PDF and extract first-page text for tiers 1 & 2
            pdf_bytes = _download_blob(blob_url)
            page_text = ""
            try:
                with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                    for page in pdf.pages[:2]:
                        t = page.extract_text() or ""
                        page_text += t + "\n"
            except Exception as e:
                logger.warning("[classify] pdfplumber extraction failed: %s", e)

            # Tier 1: Heuristic keyword patterns
            file_type, confidence = _heuristic_classify(page_text, filename)
            method = "heuristic"
            reasoning = f"Keyword match → {file_type} ({confidence:.0%} match)"
            logger.info("[classify] Heuristic: doc=%d → %s (%.2f)", doc_index, file_type, confidence)

            # Tier 2: LLM text classification (if heuristic not confident enough)
            if confidence < _CLASSIFY_CONF_HEURISTIC:
                try:
                    file_type, confidence, reasoning = _llm_classify(page_text, deployment)
                    method = "llm"
                    logger.info("[classify] LLM: doc=%d → %s (%.2f)", doc_index, file_type, confidence)
                except Exception as e:
                    logger.warning("[classify] LLM classify failed: %s", e)

            # Tier 3: Vision classification (if LLM not confident enough)
            if confidence < _CLASSIFY_CONF_LLM:
                doc_images = [img for img in page_images if img.get("doc_index") == doc_index]
                if doc_images:
                    img_url = doc_images[0].get("image_url", "")
                    try:
                        file_type, confidence, reasoning = _vision_classify(img_url, deployment)
                        method = "vision"
                        logger.info("[classify] Vision: doc=%d → %s (%.2f)", doc_index, file_type, confidence)
                    except Exception as e:
                        logger.warning("[classify] Vision classify failed: %s", e)

        except Exception as e:
            logger.exception("[classify] Failed to classify doc %d (%s): %s", doc_index, filename, e)

        classifications.append({
            "doc_index": doc_index,
            "filename": filename,
            "file_type": file_type,
            "confidence": round(confidence, 3),
            "method": method,
            "reasoning": reasoning,
        })
        logger.info("[classify] Final: doc=%d → %s via %s (%.2f)", doc_index, file_type, method, confidence)

    return {
        **state,
        "current_node": "classify",
        "status": "CLASSIFYING",
        "classifications": classifications,
    }


def human_classify_gate(state: PayAppState) -> PayAppState:
    """Always interrupt for human classification review.
    Shows user every document's detected type + confidence so they can confirm or override.
    Low-confidence docs (< 0.75) are highlighted as suspicious."""
    from langgraph.types import interrupt

    classifications = state.get("classifications", [])
    suspicious = [c for c in classifications if c.get("confidence", 0) < 0.75]
    logger.info(
        "[human_classify_gate] Interrupting: %d docs, %d suspicious",
        len(classifications), len(suspicious)
    )

    # interrupt() suspends the graph here; execution resumes when Command(resume=...) is sent
    user_response = interrupt({
        "type": "classification_review",
        "classifications": classifications,
        "message": "Please review and confirm document classifications before proceeding.",
    })

    # After resume: user_response is the dict passed via Command(resume=resume_data)
    confirmed = (
        user_response.get("classifications", classifications)
        if isinstance(user_response, dict)
        else classifications
    )
    logger.info("[human_classify_gate] Resumed with %d confirmed classification(s)", len(confirmed))

    return {
        **state,
        "current_node": "human_classify_gate",
        "classifications": confirmed,
    }


def extract_gc_header_node(state: PayAppState) -> PayAppState:
    """
    Agentic GC Header extraction — no legacy fallback.
    ExtractorAgent uses vision tools to extract all 18 G702 fields.
    If a tool fails, the agent tries alternatives on its own (ReAct loop).
    """
    from app.agents.extractor_agent import run_extractor_agent_sync

    package_id = state.get("package_id", "unknown")
    document_urls = state.get("document_urls", [])

    logger.info("[extract_gc_header] Invoking ExtractorAgent for package_id=%s", package_id)
    result = run_extractor_agent_sync(package_id, document_urls)
    logger.info("[extract_gc_header] Agent done: %s", result.get("summary", "")[:200])

    return {**state, "current_node": "extract_gc_header"}


def extract_gc_sov_node(state: PayAppState) -> PayAppState:
    """
    Fast G703 SOV extraction.
    Primary: coordinate-based text (~14 seconds, no LLM).
    Fallback: parallel vision (~55 seconds).
    """
    import httpx as _httpx
    _gw = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")
    package_id = state.get("package_id", "unknown")

    # Fetch GC document
    try:
        resp = _httpx.get(f"{_gw}/api/packages/{package_id}", timeout=10)
        api_docs = resp.json().get("documents", []) if resp.status_code == 200 else []
    except Exception:
        api_docs = []

    gc_doc = next((d for d in api_docs if d.get("fileType") in ("GC_PAY_APP", "GC_G702")), None)
    if not gc_doc:
        logger.warning("[extract_gc_sov] No GC_PAY_APP document found")
        return {**state, "current_node": "extract_gc_sov", "gc_sov_lines": []}

    from app.agents.tools.coordinate_tools import extract_g703_with_coordinates
    from app.agents.tools.doc_intelligence_tools import extract_table_with_document_intelligence
    from app.agents.tools.db_tools import save_gc_sov_lines

    def _coord_quality_ok(lns: list[dict]) -> bool:
        if not lns:
            return False
        item_no_filled = sum(1 for l in lns if l.get("item_no"))
        sched_ok = sum(1 for l in lns if (l.get("scheduled_original") or 0) > 1000)
        return item_no_filled / len(lns) > 0.3 and sched_ok / len(lns) > 0.1

    lines: list[dict] = []

    # ── Method 1: Azure Document Intelligence (best accuracy) ──────────────────
    logger.info("[extract_gc_sov] Trying Document Intelligence for package_id=%s", package_id)
    di_result = extract_table_with_document_intelligence.invoke({"blob_url": gc_doc["blobUrl"], "package_id": package_id})
    di_lines = di_result.get("sov_lines", [])
    logger.info("[extract_gc_sov] Document Intelligence: %d lines (method=%s)", len(di_lines), di_result.get("method"))

    if len(di_lines) >= 50 and _coord_quality_ok(di_lines):
        lines = di_lines
        logger.info("[extract_gc_sov] Using Document Intelligence: %d lines", len(lines))
    else:
        logger.info("[extract_gc_sov] Doc Intelligence insufficient (%d lines) — trying coordinate extraction", len(di_lines))

        # ── Method 2: Coordinate-based fast extraction ──────────────────────────
        coord = extract_g703_with_coordinates.invoke({"blob_url": gc_doc["blobUrl"], "package_id": package_id})
        coord_lines = coord.get("lines", [])
        logger.info("[extract_gc_sov] Coordinate: %d lines", len(coord_lines))

        if len(coord_lines) >= 100 and _coord_quality_ok(coord_lines):
            lines = coord_lines
            logger.info("[extract_gc_sov] Using coordinate extraction: %d lines", len(lines))
        else:
            reason = f"count={len(coord_lines)}" if len(coord_lines) < 100 else "quality_check_failed"
            logger.info("[extract_gc_sov] Coordinate %s — falling back to parallel vision", reason)

            # ── Method 3: Parallel vision LLM (last resort) ────────────────────
            from app.agents.tools.parallel_vision_tools import extract_all_sov_pages_parallel
            vis = extract_all_sov_pages_parallel.invoke({"package_id": package_id, "start_page": 2, "end_page": 12})
            vis_lines = vis.get("lines", [])
            logger.info("[extract_gc_sov] Parallel vision: %d lines", len(vis_lines))
            lines = vis_lines if vis_lines else coord_lines

    # Basic cleanup — truncate oversized strings, normalize pct
    fixed = []
    for l in lines:
        row = dict(l)
        pct = row.get("pct")
        if isinstance(pct, float) and abs(pct) > 1.1:
            row["pct"] = min(pct / 100.0, 1.0)
        for sf, ml in [("item_no", 50), ("time_period", 50), ("phases", 200), ("type_of_work", 500), ("contractor_name", 255)]:
            v = row.get(sf)
            if isinstance(v, str) and len(v) > ml:
                row[sf] = v[:ml]
        fixed.append(row)

    # ── Auto-reconcile before save ────────────────────────────────────────────
    # Fix 1: Column shift — scheduledOriginal is None but scheduledChangeOrders has the real value
    col_shift_fixed = 0
    for row in fixed:
        if not row.get("scheduled_original") and row.get("scheduled_change_orders"):
            orig = float(row["scheduled_change_orders"])
            curr = float(row.get("scheduled_current") or 0)
            row["scheduled_original"] = orig
            # If current is implausibly small vs original (< 90%), replace it too
            if curr < orig * 0.9:
                row["scheduled_current"] = orig
            row["scheduled_change_orders"] = None
            col_shift_fixed += 1
    if col_shift_fixed:
        logger.info("[extract_gc_sov] Auto-fix: corrected %d column-shift lines (scheduled_original ← scheduled_change_orders)", col_shift_fixed)

    # Fix 2: totalCompleted math error — stored as tiny decimal (pct) instead of $ amount
    math_fixed = 0
    for row in fixed:
        dep = (float(row.get("work_completed_prev") or 0) +
               float(row.get("work_completed_this") or 0) +
               float(row.get("materials_stored") or 0))
        stored = float(row.get("total_completed") or 0)
        # If stored is near-zero but D+E+F is large → OCR put % in $ column
        if dep > 1000 and stored < 10 and stored > 0:
            row["total_completed"] = round(dep, 2)
            math_fixed += 1
        # If no stored value, compute it
        elif dep > 0 and not row.get("total_completed"):
            row["total_completed"] = round(dep, 2)
    if math_fixed:
        logger.info("[extract_gc_sov] Auto-fix: corrected %d totalCompleted math errors", math_fixed)

    # Fix 3: Recompute balanceToFinish = scheduledCurrent - totalCompleted
    balance_fixed = 0
    for row in fixed:
        sched_curr = float(row.get("scheduled_current") or 0)
        tot_comp = float(row.get("total_completed") or 0)
        if sched_curr > 0:
            correct_balance = round(sched_curr - tot_comp, 2)
            stored_balance = float(row.get("balance_to_finish") or 0)
            if abs(correct_balance - stored_balance) > 500:
                row["balance_to_finish"] = correct_balance
                balance_fixed += 1
    if balance_fixed:
        logger.info("[extract_gc_sov] Auto-fix: recomputed %d balanceToFinish values", balance_fixed)

    # Log summary
    total_fixes = col_shift_fixed + math_fixed + balance_fixed
    if total_fixes:
        try:
            _httpx.post(f"{_gw}/api/packages/{package_id}/activity",
                json={"message": f"[Auto-Reconcile → G703 Parser]: Automatically corrected {total_fixes} extraction errors — {col_shift_fixed} column-shift fixes, {math_fixed} math errors, {balance_fixed} balance recalculations. No human intervention needed.",
                      "node": "extract_gc_sov", "eventType": "info"}, timeout=3)
        except Exception:
            pass

    if fixed:
        save_gc_sov_lines.invoke({"package_id": package_id, "lines": fixed})
        logger.info("[extract_gc_sov] Saved %d lines (%d auto-corrected)", len(fixed), total_fixes)

    sov_lines: list[dict] = []
    try:
        r2 = _httpx.get(f"{_gw}/api/packages/{package_id}/gc-sov", timeout=10)
        if r2.status_code == 200:
            sov_lines = r2.json()
    except Exception:
        pass

    logger.info("[extract_gc_sov] Done: %d SOV lines in state", len(sov_lines))
    return {**state, "current_node": "extract_gc_sov", "status": "EXTRACTING", "gc_sov_lines": sov_lines}



def generate_plan_node(state: PayAppState) -> PayAppState:
    """Group GC SOV lines by contractor_name to create the extraction plan."""
    gc_sov_lines: list[dict[str, Any]] = state.get("gc_sov_lines", [])
    package_id = state.get("package_id", "unknown")

    contractor_map: dict[str, dict[str, Any]] = {}
    for line in gc_sov_lines:
        name = (line.get("contractorName") or line.get("contractor_name") or "Unknown").strip()
        if not name:
            name = "Unknown"
        if name not in contractor_map:
            contractor_map[name] = {"contractor_name": name, "line_count": 0, "scheduled_sum": 0.0, "include": True}
        contractor_map[name]["line_count"] += 1
        val = line.get("scheduledCurrent") or line.get("scheduled_current") or 0
        try:
            contractor_map[name]["scheduled_sum"] += float(val or 0)
        except (TypeError, ValueError):
            pass

    extraction_plan = list(contractor_map.values())
    logger.info("[generate_plan] Generated plan: %d contractors from %d SOV lines", len(extraction_plan), len(gc_sov_lines))
    return {**state, "current_node": "generate_plan", "extraction_plan": extraction_plan}


def human_plan_gate(state: PayAppState) -> PayAppState:
    """Always interrupt — show sub-contractor list for user review and editing."""
    from langgraph.types import interrupt
    extraction_plan = state.get("extraction_plan", [])
    logger.info("[human_plan_gate] Interrupting for plan review: %d contractors", len(extraction_plan))

    user_response = interrupt({
        "type": "plan_review",
        "extraction_plan": extraction_plan,
        "message": "Review and confirm the sub-contractor list from the GC G703 before sub-app extraction.",
    })
    confirmed_plan = user_response.get("extraction_plan", extraction_plan) if isinstance(user_response, dict) else extraction_plan
    logger.info("[human_plan_gate] Resumed with %d plan entries", len(confirmed_plan))
    return {**state, "current_node": "human_plan_gate", "extraction_plan": confirmed_plan}


def extract_subs_node(state: PayAppState) -> PayAppState:
    """Extract sub-contractor pay applications for each included contractor."""
    package_id = state.get("package_id", "unknown")
    documents: list[dict[str, Any]] = state.get("documents", [])
    extraction_plan: list[dict[str, Any]] = state.get("extraction_plan", [])
    classifications: list[dict[str, Any]] = state.get("classifications", [])

    sub_docs = [
        (i, doc) for i, (doc, cls) in enumerate(zip(documents, classifications))
        if cls.get("file_type") in ("SUB_G702", "SUB_G703")
    ]

    if not sub_docs:
        logger.warning("[extract_subs] No SUB_G702/SUB_G703 documents found — skipping sub extraction")
        return {**state, "current_node": "extract_subs", "sub_headers": [], "sub_sov_lines": []}

    all_sub_headers: list[dict[str, Any]] = []
    all_sub_sov: list[dict[str, Any]] = []

    for doc_index, doc in sub_docs:
        blob_url: str = doc.get("blob_url", "") or doc.get("blobUrl", "")
        filename: str = doc.get("filename", f"sub_{doc_index}.pdf")
        logger.info("[extract_subs] Processing sub doc %d: %s", doc_index, filename)

        try:
            import pdfplumber, io as _io
            pdf_bytes = _download_blob(blob_url)
            with pdfplumber.open(_io.BytesIO(pdf_bytes)) as pdf:
                for page_num, page in enumerate(pdf.pages, start=1):
                    text = page.extract_text() or ""
                    if not text.strip():
                        continue
                    lines_text = text.split("\n")
                    header_data = _parse_sub_header_from_text(lines_text, page_num, doc_index, package_id, filename, extraction_plan)
                    if header_data:
                        all_sub_headers.append(header_data)
        except Exception as exc:
            logger.exception("[extract_subs] Failed: %s", exc)

    if all_sub_headers:
        import json as _json, urllib.request as _ur
        api_gw = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")
        payload = _json.dumps(all_sub_headers).encode()  # plain array, not wrapped
        req = _ur.Request(f"{api_gw}/api/packages/{package_id}/sub-headers", data=payload,
                          headers={"Content-Type": "application/json"}, method="POST")
        try:
            with _ur.urlopen(req, timeout=10) as r:
                logger.info("[extract_subs] Stored %d sub-headers: status=%d", len(all_sub_headers), r.status)
        except Exception as e:
            logger.warning("[extract_subs] Failed to store sub-headers: %s", e)

    return {**state, "current_node": "extract_subs", "sub_headers": all_sub_headers, "sub_sov_lines": all_sub_sov}


def _parse_sub_header_from_text(lines_text: list[str], page_num: int, doc_index: int,
                                 package_id: str, filename: str, extraction_plan: list[dict]) -> dict[str, Any] | None:
    """Parse sub-contractor header fields from extracted text."""
    import re as _re
    text = "\n".join(lines_text).lower()

    def _extract_num(pattern: str) -> float | None:
        m = _re.search(pattern, text, _re.IGNORECASE | _re.DOTALL)
        if m:
            try:
                return float(m.group(1).replace(",", "").replace("$", "").strip())
            except ValueError:
                return None
        return None

    current_payment = _extract_num(r"current\s+payment\s+due[^$\d]*\$?\s*([\d,]+\.?\d*)")
    if current_payment is None:
        return None  # Not a cover page

    sub_name = next(
        (p["contractor_name"] for p in extraction_plan
         if p.get("contractor_name", "").lower() != "unknown" and
            p.get("contractor_name", "").lower() in text),
        filename.rsplit(".", 1)[0]
    )

    return {
        "package_id": package_id,
        "seq_id": doc_index,
        "subcontractor_name": sub_name,
        "source_doc_index": doc_index,
        "source_page": page_num,
        "current_payment_due": current_payment,
        "original_contract_sum": _extract_num(r"original\s+contract\s+sum[^$\d]*\$?\s*([\d,]+\.?\d*)"),
        "contract_sum_to_date": _extract_num(r"contract\s+sum\s+to\s+date[^$\d]*\$?\s*([\d,]+\.?\d*)"),
        "total_completed_stored": _extract_num(r"total\s+completed[^$\d]*\$?\s*([\d,]+\.?\d*)"),
        "less_prev_certificates": _extract_num(r"less\s+prev[^$\d]*\$?\s*([\d,]+\.?\d*)"),
        "balance_to_finish": _extract_num(r"balance\s+to\s+finish[^$\d]*\$?\s*([\d,]+\.?\d*)"),
        "total_retainage": _extract_num(r"total\s+retainage[^$\d]*\$?\s*([\d,]+\.?\d*)"),
        "extraction_confidence": 0.75,
    }


def verify_node(state: PayAppState) -> PayAppState:
    """Agentic verification — VerifierAgent checks math consistency and creates exceptions."""
    from app.agents.verifier_agent import run_verifier_agent_sync
    package_id = state.get("package_id", "unknown")
    logger.info("[verify] Invoking VerifierAgent for package_id=%s", package_id)
    result = run_verifier_agent_sync(package_id)
    logger.info("[verify] VerifierAgent done: %s", result.get("summary", "")[:200])
    return {**state, "current_node": "verify"}


def retry_node(state: PayAppState) -> PayAppState:
    """Retry: re-run verification after corrections."""
    return _stub("retry", state)


def reconcile_node(state: PayAppState) -> PayAppState:
    """Cross-file reconciliation: MATH_ERROR, RETAINAGE_DEVIATION, CROSS_FILE_MISMATCH.
    Only checks high-confidence lines (>=0.70) to avoid false positives."""
    import json as _json, urllib.request as _ur

    package_id = state.get("package_id", "unknown")
    gc_sov_lines: list[dict[str, Any]] = state.get("gc_sov_lines", [])
    sub_headers: list[dict[str, Any]] = state.get("sub_headers", [])
    gc_header: dict[str, Any] = state.get("gc_header", {})
    api_gw = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")

    def _flt(v: Any) -> float:
        if v is None:
            return 0.0
        try:
            return float(str(v).replace(",", "").replace("$", "").strip() or "0")
        except (ValueError, TypeError):
            return 0.0

    HIGH_CONF_LINES = [l for l in gc_sov_lines if _flt(l.get("extractionConfidence") or l.get("extraction_confidence", 1.0)) >= 0.70]
    exceptions: list[dict[str, Any]] = []
    TOLERANCE = 5.0

    # Rule 1: MATH_ERROR — Total Completed + Stored should equal sum of components
    for line in HIGH_CONF_LINES:
        prev = _flt(line.get("workCompletedPrev") or line.get("work_completed_prev"))
        this = _flt(line.get("workCompletedThis") or line.get("work_completed_this"))
        mats = _flt(line.get("materialsStored") or line.get("materials_stored"))
        total = _flt(line.get("totalCompleted") or line.get("total_completed"))
        expected = prev + this + mats
        if abs(expected - total) > TOLERANCE and total > 0:
            exceptions.append({
                "packageId": package_id,
                "type": "MATH_ERROR",
                "fieldName": "total_completed",
                "expectedValue": str(round(expected, 2)),
                "actualValue": str(round(total, 2)),
                "severity": "HIGH" if abs(expected - total) > 1000 else "MEDIUM",
                "message": f"Line '{line.get('typeOfWork') or line.get('type_of_work', 'unknown')}': {prev}+{this}+{mats}={expected:.2f} ≠ {total:.2f}",
                "status": "OPEN",
            })

    logger.info("[reconcile] MATH_ERROR: %d exceptions", len(exceptions))
    math_count = len(exceptions)

    # Rule 2: RETAINAGE_DEVIATION — retainage should be ~5% of total_completed
    for line in HIGH_CONF_LINES:
        total = _flt(line.get("totalCompleted") or line.get("total_completed"))
        retainage = _flt(line.get("retainage"))
        if total <= 0 or retainage <= 0:
            continue
        pct = retainage / total
        if pct < 0.03 or pct > 0.12:
            exceptions.append({
                "packageId": package_id,
                "type": "RETAINAGE_DEVIATION",
                "fieldName": "retainage",
                "expectedValue": f"{total * 0.05:.2f}",
                "actualValue": str(retainage),
                "severity": "MEDIUM",
                "message": f"Line '{line.get('typeOfWork') or line.get('type_of_work', 'unknown')}': retainage {pct*100:.1f}% (expected 3-12%)",
                "status": "OPEN",
            })

    logger.info("[reconcile] RETAINAGE_DEVIATION: %d exceptions", len(exceptions) - math_count)

    # Rule 3: CROSS_FILE_MISMATCH — sub total vs GC line
    for sub in sub_headers:
        sub_name = sub.get("subcontractorName") or sub.get("subcontractor_name", "")
        sub_total = _flt(sub.get("currentPaymentDue") or sub.get("current_payment_due"))
        if sub_total <= 0:
            continue
        matched = [l for l in HIGH_CONF_LINES
                   if sub_name.lower()[:8] in (l.get("contractorName") or l.get("contractor_name", "")).lower()]
        if matched:
            gc_total = sum(_flt(l.get("workCompletedThis") or l.get("work_completed_this")) for l in matched)
            if abs(gc_total - sub_total) > TOLERANCE * 100:
                exceptions.append({
                    "packageId": package_id,
                    "type": "CROSS_FILE_MISMATCH",
                    "fieldName": "current_payment_due",
                    "expectedValue": str(round(gc_total, 2)),
                    "actualValue": str(round(sub_total, 2)),
                    "severity": "HIGH",
                    "message": f"Sub '{sub_name}': GC shows {gc_total:,.2f}, Sub app shows {sub_total:,.2f}",
                    "status": "OPEN",
                })

    logger.info("[reconcile] CROSS_FILE_MISMATCH: %d exceptions", len(exceptions) - math_count - (len(exceptions) - math_count))
    logger.info("[reconcile] Total: %d exceptions across %d SOV lines", len(exceptions), len(gc_sov_lines))

    if exceptions:
        payload = _json.dumps({"exceptions": exceptions}).encode()
        req = _ur.Request(f"{api_gw}/api/packages/{package_id}/exceptions", data=payload,
                          headers={"Content-Type": "application/json"}, method="POST")
        try:
            with _ur.urlopen(req, timeout=10) as r:
                logger.info("[reconcile] Stored %d exceptions: status=%d", len(exceptions), r.status)
        except Exception as e:
            logger.warning("[reconcile] Failed to store exceptions: %s", e)

    return {**state, "current_node": "reconcile", "reconciliation_exceptions": exceptions}


def human_review_gate(state: PayAppState) -> PayAppState:
    """Always interrupt — show full reconciliation summary for human approval."""
    from langgraph.types import interrupt
    package_id = state.get("package_id", "unknown")
    exceptions = state.get("reconciliation_exceptions", [])
    open_ex = [e for e in exceptions if e.get("status") == "OPEN"]
    high_ex = [e for e in open_ex if e.get("severity") == "HIGH"]
    gc_sov = state.get("gc_sov_lines", [])
    subs = state.get("sub_headers", [])

    logger.info("[human_review_gate] Interrupting: %d open exceptions (%d high), %d SOV lines, %d subs",
                len(open_ex), len(high_ex), len(gc_sov), len(subs))

    user_response = interrupt({
        "type": "review_gate",
        "summary": {
            "open_exceptions": len(open_ex),
            "high_severity": len(high_ex),
            "sov_lines": len(gc_sov),
            "sub_count": len(subs),
        },
        "message": "Review reconciliation results and approve or reject this pay application.",
    })

    return {**state, "current_node": "human_review_gate"}


def complete_node(state: PayAppState) -> PayAppState:
    """Mark the package as COMPLETE after human approval."""
    package_id = state.get("package_id", "unknown")
    logger.info("[complete] Package %s marked COMPLETE", package_id)
    return {**state, "current_node": "complete", "status": "COMPLETE"}
