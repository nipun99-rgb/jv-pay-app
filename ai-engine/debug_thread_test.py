"""
Run extract_gc_header_node in a thread (exactly as LangGraph does via asyncio.to_thread)
and see if the DB callback works for a real package.
"""
import os, sys, asyncio, logging
sys.path.insert(0, os.path.dirname(__file__))

env_file = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_file):
    for line in open(env_file):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')

from app.nodes import extract_gc_header_node, extract_gc_sov_node

# Use a real package ID that we know has a clean state
REAL_PKG = "eefb3ffa-99c5-4b49-81e6-00caabf3b799"
BLOB_URL = "https://aicstorageindia.blob.core.windows.net/jvpay-docs/01e25c87-3ecc-4b41-b595-5c2e1d5b060a-App12.pdf"
IMG_BASE = f"https://aicstorageindia.blob.core.windows.net/jvpay-docs/page-images/{REAL_PKG}/01e25c87-3ecc-4b41-b595-5c2e1d5b060a-App12_p"

async def main():
    test_state = {
        "package_id": REAL_PKG,
        "run_id": "thread-test-002",
        "documents": [{"blob_url": BLOB_URL, "filename": "01e25c87-3ecc-4b41-b595-5c2e1d5b060a-App12.pdf", "page_count": 12}],
        "page_images": [{"page_num": i, "image_url": f"{IMG_BASE}{i:04d}.jpg", "doc_index": 0} for i in range(1, 13)],
        "classifications": [
            {"doc_index": 0, "filename": "App12.pdf", "file_type": "GC_G702", "confidence": 0.92}
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

    print(f"Running extract_gc_header_node in thread for package {REAL_PKG}...")
    try:
        result = await asyncio.to_thread(extract_gc_header_node, test_state)
        gc_header = result.get("gc_header", {})
        print(f"SUCCESS: gc_header has {len(gc_header)} fields")
        for k, v in list(gc_header.items())[:5]:
            print(f"  {k}: {repr(v)[:60]}")
        return result
    except Exception as e:
        import traceback
        print(f"EXCEPTION in thread: {e}")
        traceback.print_exc()
        return None

asyncio.run(main())
print("Done.")
