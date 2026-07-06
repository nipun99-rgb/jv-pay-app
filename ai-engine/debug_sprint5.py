"""Debug script: run extract_gc_header_node logic directly and print all errors."""
import os, sys, re, io, json
sys.path.insert(0, os.path.dirname(__file__))

# Load .env manually
env_file = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_file):
    for line in open(env_file):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

PDF_PATH = r"C:\Users\KR614XU\Downloads\Ishaan\assets\source-documents\App 12.pdf"
PKG_ID = "DEBUG-TEST-001"

print("=== TEST 1: pdfplumber text extraction ===")
import pdfplumber
with pdfplumber.open(PDF_PATH) as pdf:
    page_text = ""
    for page in pdf.pages[:4]:
        t = page.extract_text() or ""
        page_text += t + "\n"
print(f"Text extracted: {len(page_text)} chars")
print("First 300:", repr(page_text[:300]))

print("\n=== TEST 2: regex pattern matching ===")
_HEADER_PATTERNS = {
    "to_owner":                [r"to\s*owner[:\s]+(.+?)(?:\n|from\s)"],
    "from_contractor":         [r"from\s*contractor[:\s]+(.+?)(?:\n|project)"],
    "project_name":            [r"project[:\s]+(.+?)(?:\n|application)", r"project\s+name[:\s]+(.+?)(?:\n)"],
    "application_no":          [r"application[^\d]*no\.?\s*[:\s]*(\d+)", r"app(?:lication)?\s*#\s*(\d+)"],
    "period":                  [r"period[:\s]+(.+?)(?:\n|from)"],
    "period_from":             [r"period\s+from[:\s]+([0-9/\-]+)", r"from[:\s]+([0-9/\-]+)"],
    "period_to":               [r"period\s+to[:\s]+([0-9/\-]+)", r"\bto[:\s]+([0-9/\-]+)"],
    "original_contract_sum":   [r"original\s+contract\s+sum[^$\d]*\$?\s*([\d,]+\.?\d*)", r"original\s+sum[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "net_change_orders":       [r"net\s+change\s+(?:by\s+)?(?:change\s+)?orders?[^$\d]*\$?\s*([\-\d,]+\.?\d*)"],
    "contract_sum_to_date":    [r"contract\s+sum\s+to\s+date[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "total_completed_stored":  [r"total\s+completed\s+(?:and\s+)?stored[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "retainage_completed":     [r"retainage\s*\([^)]*\)\s*completed[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "retainage_materials":     [r"retainage\s*\([^)]*\)\s*materials[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "total_retainage":         [r"total\s+retainage[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "total_earned_less_ret":   [r"total\s+earned\s+less\s+retainage[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "less_prev_certificates":  [r"less\s+previous[^$\d]*\$?\s*([\d,]+\.?\d*)", r"less\s+prev(?:ious)?\s+cert[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "current_payment_due":     [r"current\s+payment\s+due[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "balance_to_finish":       [r"balance\s+to\s+finish[^$\d]*\$?\s*([\d,]+\.?\d*)"],
    "change_order_summary":    [r"change\s+order\s+summary[:\s]+(.+?)(?:\n\n|\Z)"],
}

n = page_text.lower()
gc_header = {}
for field, patterns in _HEADER_PATTERNS.items():
    for pat in patterns:
        try:
            m = re.search(pat, n, re.IGNORECASE | re.DOTALL)
            if m:
                raw_val = m.group(1).strip()
                if field not in ("to_owner", "from_contractor", "project_name", "application_no",
                                "period", "period_from", "period_to", "change_order_summary"):
                    cleaned = raw_val.replace(",", "").replace("$", "").strip()
                    try:
                        gc_header[field] = float(cleaned)
                    except ValueError:
                        gc_header[field] = raw_val
                else:
                    gc_header[field] = raw_val
                break
        except Exception as e:
            print(f"  REGEX ERROR {field}: {e}")

print(f"Regex hits: {len(gc_header)}/{len(_HEADER_PATTERNS)}")
for k, v in gc_header.items():
    print(f"  {k}: {repr(v)}")

print("\n=== TEST 3: blob download (_download_blob) ===")
try:
    from app.nodes import _download_blob
    blob_url = "https://aicstorageindia.blob.core.windows.net/jvpay-docs/d22802c0-493a-4a80-a92b-e79cad9a05f6-App12.pdf"
    data = _download_blob(blob_url)
    print(f"Blob download OK: {len(data)} bytes")
except Exception as e:
    print(f"Blob download FAILED: {e}")

print("\n=== TEST 4: API callback (gc-header POST) ===")
import urllib.request
payload = json.dumps({
    "to_owner": "Debug Test Owner",
    "application_no": "12",
    "original_contract_sum": 5000000.0,
    "extraction_confidence": 0.5,
    "source_page": 1,
    "package_id": PKG_ID
}).encode()
# Use a known-good package ID instead of the debug one
pkg_id_test = "1428d0b5-abef-4153-8a3a-2f59a6af67c8"
gw_req = urllib.request.Request(
    f"http://localhost:3001/api/packages/{pkg_id_test}/gc-header",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(gw_req, timeout=10) as r:
        print(f"API callback OK: status={r.status}")
        print(f"  Response: {r.read().decode()[:200]}")
except Exception as e:
    print(f"API callback FAILED: {e}")

print("\n=== TEST 5: pdfplumber G703 table extraction ===")
with pdfplumber.open(PDF_PATH) as pdf:
    table_count = 0
    row_count = 0
    for page_num, page in enumerate(pdf.pages, start=1):
        tables = page.extract_tables()
        for tbl in tables:
            if tbl:
                table_count += 1
                row_count += len(tbl)
                print(f"  Page {page_num}: table with {len(tbl)} rows, {len(tbl[0]) if tbl else 0} cols")
                if tbl:
                    print(f"    Header row: {tbl[0]}")
    if table_count == 0:
        print("  NO TABLES FOUND by pdfplumber")

print("\n=== DONE ===")
