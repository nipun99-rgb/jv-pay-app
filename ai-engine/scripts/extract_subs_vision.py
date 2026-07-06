"""
Vision-based sub-contractor extraction.
Scans the SubContractors PDF page images using GPT-4o to extract:
  1. Cover page data (G702 equivalent) per sub-contractor
  2. Continuation sheet SOV lines (G703 equivalent) per sub-contractor

Usage: python scripts/extract_subs_vision.py <package_id>
"""
import sys, os, logging, json
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger(__name__)

pkg_id = sys.argv[1] if len(sys.argv) > 1 else None
if not pkg_id:
    print("Usage: python scripts/extract_subs_vision.py <package_id>")
    sys.exit(1)

for line in open(os.path.join(os.path.dirname(__file__), '../.env')):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import httpx, base64, io, concurrent.futures
import pypdfium2
from openai import AzureOpenAI

gw = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")

client = AzureOpenAI(
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version="2024-12-01-preview",
)
MODEL = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5.4")

# Get package docs
resp = httpx.get(f"{gw}/api/packages/{pkg_id}", timeout=10)
resp.raise_for_status()
pkg = resp.json()
sub_doc = next((d for d in pkg["documents"] if d.get("fileType") in ("SUB_PAY_APP", "SUB_G702", "SUB_G703")), None)
if not sub_doc:
    logger.error("No sub-contractor document found"); sys.exit(1)

logger.info("Sub doc: %s (%s)", sub_doc["filename"], sub_doc["fileType"])

# Download PDF bytes directly
from app.agents.tools.pdf_tools import download_pdf_bytes as _dl
b64_pdf = _dl.invoke({"blob_url": sub_doc["blobUrl"]})
pdf_bytes = base64.b64decode(b64_pdf)
logger.info("Downloaded PDF: %.1f MB", len(pdf_bytes) / 1_048_576)

# Render ALL pages to base64 JPEG sequentially (pypdfium2 is NOT thread-safe)
pdf_doc = pypdfium2.PdfDocument(pdf_bytes)
total_pages = len(pdf_doc)
logger.info("PDF has %d pages — pre-rendering to JPEG (sequential)...", total_pages)
page_images: dict[int, str] = {}  # page_num (1-indexed) -> base64 jpeg
for i in range(total_pages):
    page_num = i + 1
    try:
        page = pdf_doc[i]
        bitmap = page.render(scale=2.0)
        pil_img = bitmap.to_pil()
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=80)
        page_images[page_num] = base64.b64encode(buf.getvalue()).decode()
        if page_num % 20 == 0:
            logger.info("  Rendered page %d/%d", page_num, total_pages)
    except Exception as e:
        logger.warning("  Failed to render page %d: %s", page_num, e)

pdf_doc.close()
logger.info("Pre-rendering complete: %d pages ready", len(page_images))

def render_page_to_b64(page_num: int) -> str:
    return page_images.get(page_num, "")

COVER_SYSTEM = """You are extracting data from a subcontractor pay application cover page (AIA G702 format).
Return ONLY valid JSON with these exact keys (null if not found):
{
  "is_cover_page": true/false,
  "subcontractor_name": "...",
  "invoice_to": "...",
  "project_name": "...",
  "application_no": "...",
  "application_date": "...",
  "period_to": "...",
  "contract_po_number": "...",
  "original_contract_sum": 0.0,
  "net_change_orders": 0.0,
  "contract_sum_to_date": 0.0,
  "total_completed_stored": 0.0,
  "total_retainage": 0.0,
  "total_earned_less_ret": 0.0,
  "less_previous_certs": 0.0,
  "current_payment_due": 0.0,
  "balance_to_finish": 0.0
}
is_cover_page must be true only if this is a G702-style cover sheet with financial summary fields."""

SOV_SYSTEM = """You are extracting data from a subcontractor continuation sheet (AIA G703 format).
Return ONLY valid JSON:
{
  "is_sov_page": true/false,
  "subcontractor_name": "...",
  "lines": [
    {
      "item_no": "...",
      "description": "...",
      "scheduled_value": 0.0,
      "work_completed_prev": 0.0,
      "work_completed_this": 0.0,
      "materials_stored": 0.0,
      "total_completed": 0.0,
      "pct_complete": 0.0,
      "retainage": 0.0,
      "balance_to_finish": 0.0,
      "contractor_signature_present": false,
      "notary_details_present": false
    }
  ]
}
is_sov_page must be true only if this page has a schedule of values table with line items.
pct_complete should be a decimal 0-1 (e.g., 0.85 for 85%)."""

def analyze_page(page_num: int) -> dict:
    try:
        img_b64 = render_page_to_b64(page_num - 1)  # 0-indexed
        # Try cover page first
        resp = client.chat.completions.create(
            model=MODEL,
            max_completion_tokens=2000,
            messages=[
                {"role": "system", "content": COVER_SYSTEM},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}", "detail": "high"}},
                    {"type": "text", "text": "Extract cover page data from this subcontractor pay application page."}
                ]}
            ]
        )
        text = resp.choices[0].message.content.strip()
        # Clean JSON
        if "```" in text:
            text = text.split("```")[1].lstrip("json").strip()
        data = json.loads(text)
        data["source_page"] = page_num
        if data.get("is_cover_page"):
            logger.info("  Page %d: COVER — %s", page_num, data.get("subcontractor_name", "?"))
            return {"type": "cover", "data": data, "page": page_num}

        # Try SOV
        resp2 = client.chat.completions.create(
            model=MODEL,
            max_completion_tokens=8000,
            messages=[
                {"role": "system", "content": SOV_SYSTEM},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}", "detail": "high"}},
                    {"type": "text", "text": "Extract SOV line items from this subcontractor continuation sheet page."}
                ]}
            ]
        )
        text2 = resp2.choices[0].message.content.strip()
        if "```" in text2:
            text2 = text2.split("```")[1].lstrip("json").strip()
        data2 = json.loads(text2)
        data2["source_page"] = page_num
        if data2.get("is_sov_page") and data2.get("lines"):
            logger.info("  Page %d: SOV — %d lines — %s", page_num, len(data2["lines"]), data2.get("subcontractor_name", "?"))
            return {"type": "sov", "data": data2, "page": page_num}

        return {"type": "other", "page": page_num}
    except Exception as e:
        logger.warning("  Page %d: error — %s", page_num, e)
        return {"type": "error", "page": page_num, "error": str(e)}

# Process all pages in parallel (8 concurrent to avoid rate limits)
MAX_PAGES = total_pages
logger.info("Processing %d pages with parallel vision (8 workers)...", MAX_PAGES)

cover_pages = []
sov_pages = []

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    futures = {ex.submit(analyze_page, i + 1): i for i in range(MAX_PAGES)}
    for fut in concurrent.futures.as_completed(futures):
        result = fut.result()
        if result["type"] == "cover":
            cover_pages.append(result)
        elif result["type"] == "sov":
            sov_pages.append(result)

pdf_doc.close()

cover_pages.sort(key=lambda x: x["page"])
sov_pages.sort(key=lambda x: x["page"])
logger.info("Found %d cover pages and %d SOV pages", len(cover_pages), len(sov_pages))

# Build sub-contractor records: each cover page + subsequent SOV pages
sub_records = []
for i, cp in enumerate(cover_pages):
    cover_data = cp["data"]
    start_page = cp["page"]
    end_page = cover_pages[i + 1]["page"] - 1 if i + 1 < len(cover_pages) else MAX_PAGES

    # Collect SOV lines from pages belonging to this sub
    sov_lines = []
    for sp in sov_pages:
        if start_page <= sp["page"] <= end_page:
            for line in sp["data"].get("lines", []):
                line["source_page"] = sp["page"]
                sov_lines.append(line)

    record = {
        "seq_id": i,
        "subcontractor_name": cover_data.get("subcontractor_name"),
        "invoice_to": cover_data.get("invoice_to"),
        "project_name": cover_data.get("project_name"),
        "application_no": cover_data.get("application_no"),
        "application_date": cover_data.get("application_date"),
        "period_to": cover_data.get("period_to"),
        "contract_po_number": cover_data.get("contract_po_number"),
        "original_contract_sum": cover_data.get("original_contract_sum"),
        "net_change_orders": cover_data.get("net_change_orders"),
        "contract_sum_to_date": cover_data.get("contract_sum_to_date"),
        "total_completed_stored": cover_data.get("total_completed_stored"),
        "total_retainage": cover_data.get("total_retainage"),
        "total_earned_less_ret": cover_data.get("total_earned_less_ret"),
        "less_previous_certs": cover_data.get("less_previous_certs"),
        "current_payment_due": cover_data.get("current_payment_due"),
        "balance_to_finish": cover_data.get("balance_to_finish"),
        "start_page": start_page,
        "end_page": end_page,
        "extraction_confidence": 0.90,
        "sov_lines": sov_lines,
    }
    logger.info("Sub %d: %s — %d SOV lines (pages %d-%d)",
                i, record["subcontractor_name"], len(sov_lines), start_page, end_page)
    sub_records.append(record)

if not sub_records:
    logger.error("No sub-contractor cover pages found!")
    sys.exit(1)

# Save to API
logger.info("Saving %d sub-contractor records...", len(sub_records))
save_resp = httpx.post(
    f"{gw}/api/packages/{pkg_id}/sub-headers",
    json=sub_records,
    timeout=60,
)
if save_resp.status_code in (200, 201):
    logger.info("Saved successfully: %s", save_resp.json())
else:
    logger.error("Save failed %d: %s", save_resp.status_code, save_resp.text[:500])
    sys.exit(1)
