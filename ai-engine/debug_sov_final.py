"""Final SOV extraction + DB store test with truncation fix."""
import sys, io, os, json, urllib.request, urllib.error
sys.path.insert(0, '.')
for line in open('.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

import logging
logging.basicConfig(level=logging.WARNING)
logging.getLogger('app.nodes').setLevel(logging.INFO)
from app.nodes import extract_gc_sov_node

REAL_PKG = '6b88a11d-07fc-44a5-a398-1687af0df063'
state = {
    'package_id': REAL_PKG, 'run_id': 'local-test',
    'documents': [{'blob_url': 'https://aicstorageindia.blob.core.windows.net/jvpay-docs/6dfff1ae-8db6-4568-bcc7-ef5af1c6976a-App12.pdf', 'filename': 'App12.pdf', 'page_count': 12}],
    'page_images': [],
    'classifications': [{'doc_index': 0, 'filename': 'App12.pdf', 'file_type': 'GC_G702', 'confidence': 0.92}],
    'gc_header': {}, 'gc_sov_lines': [], 'extraction_plan': [],
    'sub_headers': [], 'sub_sov_lines': [], 'field_scores': [],
    'exceptions': [], 'total_tokens': 0, 'total_cost_usd': 0.0,
    'current_node': 'extract_gc_sov', 'status': 'RUNNING', 'retry_count': 0, 'error_message': None,
}
result = extract_gc_sov_node(state)
lines = result.get('gc_sov_lines', [])
print(f'SOV lines extracted: {len(lines)}')
if lines:
    print('First line:', json.dumps({k: v for k, v in lines[0].items() if k != 'package_id'}))
    print('Last line:', json.dumps({k: v for k, v in lines[-1].items() if k != 'package_id'}))

# Validate item_no truncation
for i, line in enumerate(lines):
    if 'item_no' in line and len(str(line['item_no'])) > 50:
        print(f'WARNING: line[{i}].item_no too long: {len(str(line["item_no"]))} chars')

payload = json.dumps(lines)
req = urllib.request.Request(
    f'http://localhost:3001/api/packages/{REAL_PKG}/gc-sov',
    data=payload.encode(),
    headers={'Content-Type': 'application/json'},
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        resp = json.loads(r.read().decode())
        print(f'POST status: {r.status}, stored: {len(resp)} lines')
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f'POST FAILED: {e.code} {body[:400]}')
