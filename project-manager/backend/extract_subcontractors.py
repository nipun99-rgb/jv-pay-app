"""
Subcontractor Pay Application Extractor — backend script.
Wraps the logic from subcontractor_extractor.ipynb into a CLI script.

Usage:
  python extract_subcontractors.py <pdf_path> <output_json> [--ocr azure]

Output: JSON array, one object per pay application packet.
"""
import sys, os, re, json, time
import concurrent.futures

# ── Config ────────────────────────────────────────────────────────────────────
DOC_INTEL_ENDPOINT = os.environ.get("DOC_INTEL_ENDPOINT", "")
DOC_INTEL_KEY      = os.environ.get("DOC_INTEL_KEY", "")
AOAI_ENDPOINT      = os.environ.get("AOAI_ENDPOINT", "")
AOAI_KEY           = os.environ.get("AOAI_KEY", "")
AOAI_DEPLOYMENT    = "gpt-5.4"

PAGE_TEXT_LIMIT  = 8000
SCAN_BATCH_SIZE  = 5
SCAN_WORKERS     = 10
EXTRACT_WORKERS  = 5

# ── Parse args ────────────────────────────────────────────────────────────────
if len(sys.argv) < 3:
    print("Usage: python extract_subcontractors.py <pdf_path> <output_json>")
    sys.exit(1)

PDF_PATH    = sys.argv[1]
OUTPUT_JSON = sys.argv[2]
CACHE_DIR   = os.path.dirname(OUTPUT_JSON)
BASE_NAME   = os.path.splitext(os.path.basename(PDF_PATH))[0]
PAGE_TEXTS_CACHE = os.path.join(CACHE_DIR, f"{BASE_NAME}_page_texts.json")
SCAN_CACHE       = os.path.join(CACHE_DIR, f"{BASE_NAME}_scan.json")
EXTRACT_CACHE    = os.path.join(CACHE_DIR, f"{BASE_NAME}_extract.json")

def progress(msg):
    print(f"PROGRESS:{msg}", flush=True)

# ── Install dependencies if needed ────────────────────────────────────────────
try:
    from openai import OpenAI
except ImportError:
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "openai", "--quiet"], check=True)
    from openai import OpenAI

try:
    import json_repair
except ImportError:
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "json-repair", "--quiet"], check=True)
    import json_repair

aoai_client = OpenAI(base_url=AOAI_ENDPOINT, api_key=AOAI_KEY)

# ── Step 1: OCR / page text extraction ───────────────────────────────────────
progress("Running OCR on PDF...")

if os.path.exists(PAGE_TEXTS_CACHE):
    progress("Loading OCR from cache...")
    with open(PAGE_TEXTS_CACHE, "r", encoding="utf-8") as f:
        _data = json.load(f)
    page_texts = {int(k): v for k, v in _data.items()}
    progress(f"Loaded {len(page_texts)} pages from OCR cache")
else:
    progress("Running Azure Document Intelligence OCR (this may take a few minutes)...")
    try:
        from azure.ai.documentintelligence import DocumentIntelligenceClient
        from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
        from azure.core.credentials import AzureKeyCredential
    except ImportError:
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "azure-ai-documentintelligence", "--quiet"], check=True)
        from azure.ai.documentintelligence import DocumentIntelligenceClient
        from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
        from azure.core.credentials import AzureKeyCredential

    di_client = DocumentIntelligenceClient(
        endpoint=DOC_INTEL_ENDPOINT,
        credential=AzureKeyCredential(DOC_INTEL_KEY)
    )
    with open(PDF_PATH, "rb") as f:
        pdf_bytes = f.read()

    progress("Submitting to Azure Document Intelligence...")
    poller = di_client.begin_analyze_document(
        model_id="prebuilt-layout",
        body=AnalyzeDocumentRequest(bytes_source=pdf_bytes),
    )
    progress("Waiting for OCR to complete (may take several minutes for large PDFs)...")
    result = poller.result()

    page_texts = {}
    if result.pages:
        for pg in result.pages:
            lines = [line.content for line in (pg.lines or [])]
            page_texts[pg.page_number] = "\n".join(lines)

    with open(PAGE_TEXTS_CACHE, "w", encoding="utf-8") as f:
        json.dump({str(k): v for k, v in page_texts.items()}, f, ensure_ascii=False)
    progress(f"OCR complete: {len(page_texts)} pages")

# ── Step 2: Scan pages ────────────────────────────────────────────────────────
SCAN_SYSTEM = """You are analyzing OCR text from a construction subcontractor payment application PDF.
For each page labelled === PAGE N ===, classify the page type.

A SUBCONTRACTOR PAYMENT APPLICATION PACKET consists of (in order):
  1. G702 cover page — the AIA "Application and Certificate for Payment" form.
     STRICT IDENTIFIERS: Must contain "Application and Certificate for Payment" OR
     ("Application No." AND "Period To" AND "Original Contract Sum") OR
     ("Contract Sum to Date" AND "Retainage" AND "Current Payment Due").
     This is the ONLY page type where is_new_application = true.

  2. G703 continuation sheet(s) — "Continuation Sheet", "Schedule of Values",
     columns: Item No. | Description of Work | Scheduled Value | Work Completed |
     Materials Stored | Total Completed & Stored | % Complete | Retainage.
     is_new_application = false. is_payapp = true.

  3. Supporting documents — still PART of the same pay application packet.
     is_new_application = false. is_payapp = true.

CRITICAL RULES:
- is_new_application = true ONLY on a G702 cover page.
- is_payapp = false ONLY for pages completely unrelated to any pay application.
- A non-AIA requisition/billing form also counts as is_new_application=true with page_type=G702.

For doc_type use: "AIA G702", "G703 Continuation Sheet", "Subcontractor Requisition for Payment",
"Subcontractor Invoice", "Partial Lien Waiver", "Unconditional Lien Waiver",
"Change Order Summary", "Transmittal", "Other Supporting Document".

For doc_category: "Main Document", "Invoice Level Supporting Document", "Other Supporting Document".

For EACH page return exactly one JSON object:
{
  "page_number": N,
  "page_type": "G702" | "G703" | "supporting_doc" | "other",
  "doc_type": "...",
  "doc_category": "...",
  "is_payapp": true or false,
  "is_new_application": true or false,
  "app_ref": "application number visible on THIS page or null",
  "subcontractor": "subcontractor company name visible on THIS page or null"
}

Return ONLY a JSON array. No markdown, no extra text."""

def scan_batch(batch_num, page_dict):
    page_nums = sorted(page_dict.keys())
    sections  = [f"=== PAGE {p} ===\n{page_dict[p][:PAGE_TEXT_LIMIT]}" for p in page_nums]
    user_msg  = "\n\n".join(sections)
    wait = 10
    for attempt in range(6):
        try:
            resp = aoai_client.responses.create(
                model=AOAI_DEPLOYMENT,
                instructions=SCAN_SYSTEM,
                input=[{"role": "user", "content": user_msg}],
                temperature=0,
                max_output_tokens=4000
            )
            raw = resp.output_text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            return batch_num, json.loads(raw), []
        except Exception as e:
            err = str(e)
            if ("429" in err or "rate_limit" in err.lower()) and attempt < 5:
                time.sleep(wait); wait = min(wait * 2, 120); continue
            return batch_num, [], list(page_dict.keys())

sorted_pages = sorted(page_texts.items())
scan_batches = []
for i in range(0, len(sorted_pages), SCAN_BATCH_SIZE):
    chunk = dict(sorted_pages[i:i+SCAN_BATCH_SIZE])
    scan_batches.append((len(scan_batches)+1, chunk))

if os.path.exists(SCAN_CACHE):
    with open(SCAN_CACHE, "r", encoding="utf-8") as f:
        _sc = json.load(f)
    scan_results_raw  = _sc.get("results", [])
    done_scan_batches = set(_sc.get("done", []))
else:
    scan_results_raw  = []
    done_scan_batches = set()

remaining_scan = [(n, b) for n, b in scan_batches if n not in done_scan_batches]
progress(f"Scanning {len(remaining_scan)} batches of pages...")

with concurrent.futures.ThreadPoolExecutor(max_workers=SCAN_WORKERS) as executor:
    futures = {executor.submit(scan_batch, n, b): n for n, b in remaining_scan}
    done = 0
    for future in concurrent.futures.as_completed(futures):
        bn, results, _ = future.result()
        scan_results_raw.extend(results)
        done_scan_batches.add(bn)
        done += 1
        progress(f"Scanned batch {done}/{len(remaining_scan)+len(done_scan_batches)-len(remaining_scan)}")
        with open(SCAN_CACHE, "w", encoding="utf-8") as f:
            json.dump({"results": scan_results_raw, "done": list(done_scan_batches)}, f)

page_info = {}
for r in scan_results_raw:
    if isinstance(r, dict) and "page_number" in r:
        page_info[r["page_number"]] = r

# ── Group pages into pay application packets ──────────────────────────────────
payapp_groups = []
current_group = None
last_group    = None

for pg_num in sorted(page_info.keys()):
    info    = page_info[pg_num]
    is_new  = info.get("is_new_application") or info.get("page_type") == "G702"
    pg_doc_type = info.get("doc_type", "Other Supporting Document")
    pg_doc_cat  = info.get("doc_category", "Other Supporting Document")

    if not info.get("is_payapp"):
        if current_group:
            payapp_groups.append(current_group)
            last_group    = current_group
            current_group = None
        continue

    if is_new:
        merge_sub = (info.get("subcontractor") or "").strip().upper()
        merge_ref = (info.get("app_ref") or "").strip().upper()
        if current_group and merge_sub and merge_ref:
            prev_sub = current_group["subcontractor"].strip().upper()
            prev_ref = current_group["app_ref"].strip().upper()
            if merge_sub == prev_sub and merge_ref == prev_ref:
                current_group["pages"].append(pg_num)
                current_group["page_doc_types"][pg_num] = {"doc_type": pg_doc_type, "doc_category": pg_doc_cat}
                continue
        if current_group:
            payapp_groups.append(current_group)
            last_group = current_group
        current_group = {
            "app_ref": (info.get("app_ref") or "UNKNOWN").strip(),
            "subcontractor": (info.get("subcontractor") or "").strip(),
            "pages": [pg_num],
            "page_doc_types": {pg_num: {"doc_type": pg_doc_type, "doc_category": pg_doc_cat}}
        }
    else:
        if current_group is None:
            if last_group is not None and info.get("page_type") == "supporting_doc":
                last_group["pages"].append(pg_num)
                last_group["page_doc_types"][pg_num] = {"doc_type": pg_doc_type, "doc_category": pg_doc_cat}
            else:
                current_group = {
                    "app_ref": (info.get("app_ref") or "UNKNOWN").strip(),
                    "subcontractor": (info.get("subcontractor") or "").strip(),
                    "pages": [pg_num],
                    "page_doc_types": {pg_num: {"doc_type": pg_doc_type, "doc_category": pg_doc_cat}}
                }
        else:
            current_group["pages"].append(pg_num)
            current_group["page_doc_types"][pg_num] = {"doc_type": pg_doc_type, "doc_category": pg_doc_cat}
            sub = (info.get("subcontractor") or "").strip()
            ref = (info.get("app_ref") or "").strip()
            if sub and not current_group["subcontractor"]: current_group["subcontractor"] = sub
            if ref and ref != "UNKNOWN" and current_group["app_ref"] == "UNKNOWN": current_group["app_ref"] = ref

if current_group:
    payapp_groups.append(current_group)

progress(f"Found {len(payapp_groups)} pay application packets")

# ── Step 3: Extract header + G703 data ───────────────────────────────────────
EXTRACT_SYSTEM = """You are an expert construction contract data extractor.
Extract from ONE subcontractor pay application packet.
Return a single JSON object with keys "header", "g703_grand_totals", and "sov_lines".

"header": {
  "subcontractor_name": string,
  "invoice_application_no": string or null,
  "invoice_date": string or null,
  "period_from": string or null,
  "period_to": string or null,
  "invoice_to": string or null,
  "project_name": string or null,
  "contract_po_number": string or null,
  "original_contract_sum": number or null,
  "net_change_by_change_orders": number or null,
  "contract_sum_to_date": number or null,
  "total_completed_stored_to_date": number or null,
  "completed_work_this_period": number or null,
  "total_retainage": number or null,
  "retainage_percent": number or null,
  "total_earned_less_retainage": number or null,
  "less_previous_certificates_payments": number or null,
  "current_payment_due_this_period": number or null,
  "balance_to_finish": number or null,
  "contractor_signature_present": "Yes" or "No",
  "architect_sign_present": "Yes" or "No",
  "notary_details_present": "Yes" or "No",
  "additional_supporting_documents": string
}

"g703_grand_totals": {
  "g703_total_scheduled_value": number or null,
  "g703_total_work_completed_previous": number or null,
  "g703_total_work_completed_this_period": number or null,
  "g703_total_materials_stored": number or null,
  "g703_total_completed_and_stored": number or null,
  "g703_total_retainage": number or null,
  "g703_total_earned_less_retainage": number or null,
  "g703_balance_to_finish": number or null
}

"sov_lines": array of individual G703 Schedule of Values line items (from continuation sheet).
Each element:
{
  "item_no": string or null,
  "description_of_work": string,
  "scheduled_value": number or null,
  "work_completed_previous": number or null,
  "work_completed_this_period": number or null,
  "materials_stored": number or null,
  "total_completed_and_stored": number or null,
  "percent_complete": number or null,
  "retainage": number or null,
  "balance_to_finish": number or null,
  "page_number": integer or null
}
Include ALL non-grand-total rows from the G703 table. Exclude header rows and the GRAND TOTAL row.
If no G703 continuation sheet is present, return "sov_lines": [].

All monetary values: plain numbers, no $ or commas.
Return ONLY the JSON object. No markdown."""

def _smart_truncate(text, limit):
    if len(text) <= limit: return text
    half = limit // 2
    return text[:half] + "\n[... middle truncated ...]\n" + text[-half:]

def _parse_json_robust(raw):
    try: return json.loads(raw)
    except json.JSONDecodeError:
        repaired = json_repair.repair_json(raw, return_objects=True)
        if isinstance(repaired, dict): return repaired
        raise ValueError(f"json_repair failed: {str(repaired)[:80]}")

def extract_payapp(group_idx, group):
    pages    = sorted(group["pages"])
    sections = [f"=== PAGE {p} ===\n{_smart_truncate(page_texts.get(p, ''), PAGE_TEXT_LIMIT)}" for p in pages]
    user_msg = (f"Subcontractor: {group['subcontractor']}\nApp Reference: {group['app_ref']}\n\n"
                + "\n\n".join(sections))
    wait = 10
    for attempt in range(6):
        try:
            resp = aoai_client.responses.create(
                model=AOAI_DEPLOYMENT,
                instructions=EXTRACT_SYSTEM,
                input=[{"role": "user", "content": user_msg}],
                temperature=0,
                max_output_tokens=8000
            )
            raw = resp.output_text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            data = _parse_json_robust(raw)
            data["_group_idx"]      = group_idx
            data["_start_page"]     = min(pages)
            data["_end_page"]       = max(pages)
            data["_app_ref"]        = group["app_ref"]
            data["_subcontractor"]  = group["subcontractor"]
            data["_page_doc_types"] = group.get("page_doc_types", {})
            return group_idx, data, None
        except Exception as e:
            err = str(e)
            if ("429" in err or "rate_limit" in err.lower()) and attempt < 5:
                time.sleep(wait); wait = min(wait * 2, 120); continue
            return group_idx, None, str(e)

if os.path.exists(EXTRACT_CACHE):
    with open(EXTRACT_CACHE, "r", encoding="utf-8") as f:
        _ec = json.load(f)
    extracted_data = _ec.get("data", [])
    done_extract   = set(_ec.get("done", []))
else:
    extracted_data = []
    done_extract   = set()

remaining_extract = [(i+1, g) for i, g in enumerate(payapp_groups) if (i+1) not in done_extract]
progress(f"Extracting {len(remaining_extract)} pay applications...")

with concurrent.futures.ThreadPoolExecutor(max_workers=EXTRACT_WORKERS) as executor:
    futures = {executor.submit(extract_payapp, idx, grp): idx for idx, grp in remaining_extract}
    done = 0
    for future in concurrent.futures.as_completed(futures):
        gidx, data, err = future.result()
        if data: extracted_data.append(data)
        done_extract.add(gidx)
        done += 1
        progress(f"Extracted {done}/{len(remaining_extract)}")
        with open(EXTRACT_CACHE, "w", encoding="utf-8") as f:
            json.dump({"data": extracted_data, "done": list(done_extract)}, f)
        time.sleep(0.3)

# ── Build output ──────────────────────────────────────────────────────────────
results = []
for seq_id, app in enumerate(sorted(extracted_data, key=lambda x: x.get("_start_page", 0) if x else 9999), start=1):
    if app is None: continue
    h  = app.get("header") or {}
    gt = app.get("g703_grand_totals") or {}
    start_pg = app.get("_start_page")

    page_doc_types = app.get("_page_doc_types") or {}
    g702_info      = page_doc_types.get(str(start_pg), page_doc_types.get(start_pg, {}))

    def _to_f(v):
        try: return round(float(v), 2) if v is not None else None
        except: return None

    g702_total_f = _to_f(h.get("total_completed_stored_to_date"))
    g703_total_f = _to_f(gt.get("g703_total_completed_and_stored"))
    if g702_total_f is not None and g703_total_f is not None:
        diff = round(abs(g702_total_f - g703_total_f), 2)
        recon_flag = "MATCH" if diff < 100.0 else f"DIFF {diff:,.0f}"
    else:
        recon_flag = "N/A"

    results.append({
        "seq_id":                      seq_id,
        "start_page":                  start_pg,
        "end_page":                    app.get("_end_page"),
        "document_type":               g702_info.get("doc_type", "AIA G702"),
        "document_category":           g702_info.get("doc_category", "Main Document"),
        "subcontractor_name":          h.get("subcontractor_name") or app.get("_subcontractor", ""),
        "application_no":              h.get("invoice_application_no") or app.get("_app_ref", ""),
        "application_date":            h.get("invoice_date", ""),
        "period_from":                 h.get("period_from", ""),
        "period_to":                   h.get("period_to", ""),
        "invoice_to":                  h.get("invoice_to", ""),
        "project_name_on_doc":         h.get("project_name", ""),
        "contract_po_number":          h.get("contract_po_number", ""),
        "original_contract_sum":       _to_f(h.get("original_contract_sum")),
        "net_change_orders":           _to_f(h.get("net_change_by_change_orders")),
        "contract_sum_to_date":        _to_f(h.get("contract_sum_to_date")),
        "total_completed_stored":      _to_f(h.get("total_completed_stored_to_date")),
        "completed_work_this_period":  _to_f(h.get("completed_work_this_period")),
        "total_retainage":             _to_f(h.get("total_retainage")),
        "retainage_percent":           _to_f(h.get("retainage_percent")),
        "total_earned_less_retainage": _to_f(h.get("total_earned_less_retainage")),
        "less_prev_certificates":      _to_f(h.get("less_previous_certificates_payments")),
        "current_payment_due":         _to_f(h.get("current_payment_due_this_period")),
        "balance_to_finish":           _to_f(h.get("balance_to_finish")),
        "g703_scheduled_value":        _to_f(gt.get("g703_total_scheduled_value")),
        "g703_work_prev":              _to_f(gt.get("g703_total_work_completed_previous")),
        "g703_work_this_period":       _to_f(gt.get("g703_total_work_completed_this_period")),
        "g703_materials_stored":       _to_f(gt.get("g703_total_materials_stored")),
        "g703_total_completed":        _to_f(gt.get("g703_total_completed_and_stored")),
        "g703_retainage":              _to_f(gt.get("g703_total_retainage")),
        "g703_earned_less_ret":        _to_f(gt.get("g703_total_earned_less_retainage")),
        "g703_balance_to_finish":      _to_f(gt.get("g703_balance_to_finish")),
        "recon_flag":                  recon_flag,
        "contractor_signature":        h.get("contractor_signature_present", ""),
        "architect_signature":         h.get("architect_sign_present", ""),
        "notarized":                   h.get("notary_details_present", ""),
        "additional_supporting_docs":  h.get("additional_supporting_documents", ""),
        "sov_lines":                   app.get("sov_lines") or [],
    })

with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"DONE:{len(results)}")
progress(f"Saved {len(results)} subcontractor applications")
