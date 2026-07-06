"""
Invoke the actual LangGraph extract_gc_header_node directly with a realistic state
and report what happens.
"""
import os, sys, json, logging
sys.path.insert(0, os.path.dirname(__file__))

# Load .env
env_file = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_file):
    for line in open(env_file):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

# Enable logging
logging.basicConfig(level=logging.INFO, format='%(name)s - %(levelname)s - %(message)s')

from app.nodes import extract_gc_header_node, extract_gc_sov_node

# Simulated state after ingest + classify
PKG_ID = "DEBUG-DIRECT-RUN"
BLOB_URL = "https://aicstorageindia.blob.core.windows.net/jvpay-docs/d22802c0-493a-4a80-a92b-e79cad9a05f6-App12.pdf"

test_state = {
    "package_id": PKG_ID,
    "run_id": "debug-run-001",
    "documents": [
        {"blob_url": BLOB_URL, "filename": "App12.pdf", "page_count": 12}
    ],
    "page_images": [
        {"page_num": 1, "image_url": BLOB_URL, "doc_index": 0},  # placeholder
    ],
    "classifications": [
        {
            "doc_index": 0,
            "filename": "App12.pdf",
            "file_type": "GC_G702",
            "confidence": 0.92,
            "method": "heuristic",
            "reasoning": "test"
        }
    ],
    "gc_header": {},
    "gc_sov_lines": [],
    "extraction_plan": [],
    "sub_headers": [],
    "sub_sov_lines": [],
    "field_scores": [],
    "exceptions": [],
    "total_tokens": 0,
    "total_cost_usd": 0.0,
    "current_node": "classify",
    "status": "RUNNING",
    "retry_count": 0,
    "error_message": None,
}

print("=" * 60)
print("TEST: extract_gc_header_node")
print("=" * 60)
try:
    result = extract_gc_header_node(test_state)
    gc_header = result.get("gc_header", {})
    print(f"gc_header fields: {len(gc_header)}")
    for k, v in gc_header.items():
        print(f"  {k}: {repr(v)[:80]}")
except Exception as e:
    import traceback
    print(f"EXCEPTION: {e}")
    traceback.print_exc()

print()
print("=" * 60)
print("TEST: extract_gc_sov_node")
print("=" * 60)

# Use a known GC_G703 classification or fallback GC_G702 for SOV
sov_state = {**test_state, "current_node": "extract_gc_header"}
sov_state["classifications"] = [
    {
        "doc_index": 0,
        "filename": "App12.pdf",
        "file_type": "GC_G703",  # Force G703 lookup
        "confidence": 0.92,
        "method": "heuristic",
        "reasoning": "test"
    }
]

try:
    result2 = extract_gc_sov_node(sov_state)
    sov_lines = result2.get("gc_sov_lines", [])
    print(f"SOV lines extracted: {len(sov_lines)}")
    if sov_lines:
        print(f"  First line: {json.dumps(sov_lines[0], default=str)[:200]}")
        print(f"  Last line: {json.dumps(sov_lines[-1], default=str)[:200]}")
except Exception as e:
    import traceback
    print(f"EXCEPTION: {e}")
    traceback.print_exc()

print()
print("DONE")
