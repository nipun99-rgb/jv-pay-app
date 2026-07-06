"""Directly extract G703 lines using pdfplumber and save to DB — bypasses agent."""
import os, sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))
os.environ.setdefault('PYTHONPATH', os.path.dirname(os.path.dirname(__file__)))

import httpx

pkg_id = sys.argv[1] if len(sys.argv) > 1 else 'c78791de-aad9-492d-b273-4ae4640dc7a1'
gw = os.environ.get('API_GATEWAY_URL', 'http://localhost:3001')

# Get documents
resp = httpx.get(f'{gw}/api/packages/{pkg_id}')
docs = resp.json()['documents']
gc_doc = next((d for d in docs if d.get('fileType') in ('GC_PAY_APP', 'GC_G702')), None)
if not gc_doc:
    print('No GC document found!')
    sys.exit(1)

blob_url = gc_doc['blobUrl']
print(f'GC doc: {gc_doc["filename"]} → {blob_url[:60]}...')

# Run pdfplumber extraction directly
from app.agents.tools.pdfplumber_tools import extract_all_sov_pages_with_pdfplumber

result = extract_all_sov_pages_with_pdfplumber.invoke({'blob_url': blob_url, 'package_id': pkg_id})
lines = result.get('lines', [])
print(f'pdfplumber extracted: {len(lines)} lines from {result.get("sov_page_count", 0)} pages')

if not lines:
    print('No lines extracted — trying vision fallback...')
    sys.exit(1)

# Save directly to DB
from app.agents.tools.db_tools import save_gc_sov_lines
save_result = save_gc_sov_lines.invoke({'package_id': pkg_id, 'lines': lines})
print(f'Save result: {save_result}')


import httpx
from app.agents.sov_agent import run_sov_agent_sync

pkg_id = sys.argv[1] if len(sys.argv) > 1 else 'c78791de-aad9-492d-b273-4ae4640dc7a1'
resp = httpx.get(f'http://localhost:3001/api/packages/{pkg_id}')
docs = [{'blobUrl': d['blobUrl'], 'filename': d['filename'], 'fileType': d['fileType']}
        for d in resp.json()['documents']]
print('Documents:', [(d["filename"], d["fileType"]) for d in docs])

result = run_sov_agent_sync(pkg_id, docs)
print('Agent result:', result.get('summary', '')[:400])
