"""Fast G703 extraction: coordinate-based (3-5s), parallel vision fallback (55s)."""
import os, sys, time
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))
os.environ.setdefault('API_GATEWAY_URL', 'http://localhost:3001')

import httpx

PKG = sys.argv[1] if len(sys.argv) > 1 else 'c78791de-aad9-492d-b273-4ae4640dc7a1'
GW = os.environ.get('API_GATEWAY_URL', 'http://localhost:3001')

resp = httpx.get(f'{GW}/api/packages/{PKG}')
docs = resp.json()['documents']
gc_doc = next((d for d in docs if d.get('fileType') in ('GC_PAY_APP', 'GC_G702')), None)
if not gc_doc: print('No GC document!'); sys.exit(1)
print(f'GC doc: {gc_doc["filename"]}')

# Step 1: Try fast coordinate extraction (~3-5s)
from app.agents.tools.coordinate_tools import extract_g703_with_coordinates
t0 = time.time()
coord = extract_g703_with_coordinates.invoke({'blob_url': gc_doc['blobUrl'], 'package_id': PKG})
t1 = time.time()
coord_lines = coord.get('lines', [])
print(f'Coordinate: {len(coord_lines)} lines in {t1-t0:.1f}s')

# Step 2: Parallel vision if coordinate got < 100 lines
if len(coord_lines) >= 100:
    all_lines = coord_lines
    print(f'Using coordinate extraction ({len(all_lines)} lines)')
else:
    print(f'Coordinate got {len(coord_lines)} -- trying parallel vision...')
    from app.agents.tools.parallel_vision_tools import extract_all_sov_pages_parallel
    t2 = time.time()
    vis = extract_all_sov_pages_parallel.invoke({'package_id': PKG, 'start_page': 2, 'end_page': 8})
    t3 = time.time()
    vis_lines = vis.get('lines', [])
    print(f'Parallel vision: {len(vis_lines)} lines in {t3-t2:.1f}s')
    all_lines = vis_lines if len(vis_lines) > len(coord_lines) else coord_lines

# Fix and save
fixed = []
for l in all_lines:
    row = dict(l)
    pct = row.get('pct')
    if isinstance(pct, float) and abs(pct) > 1.1:
        row['pct'] = min(pct / 100.0, 1.0)
    for sf, ml in [('item_no',50),('time_period',50),('phases',200),('type_of_work',500),('contractor_name',255)]:
        v = row.get(sf)
        if isinstance(v, str) and len(v) > ml:
            row[sf] = v[:ml]
    fixed.append(row)

resp = httpx.post(f'{GW}/api/packages/{PKG}/gc-sov', json=fixed, timeout=30)
print(f'Saved {len(fixed)} lines: HTTP {resp.status_code}')

import os, sys, json
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))
os.environ.setdefault('API_GATEWAY_URL', 'http://localhost:3001')

import httpx, time

PKG = sys.argv[1] if len(sys.argv) > 1 else 'c78791de-aad9-492d-b273-4ae4640dc7a1'
GW = os.environ.get('API_GATEWAY_URL', 'http://localhost:3001')

resp = httpx.get(f'{GW}/api/packages/{PKG}')
docs = resp.json()['documents']
gc_doc = next((d for d in docs if d.get('fileType') in ('GC_PAY_APP', 'GC_G702')), None)
if not gc_doc: print('No GC document found!'); sys.exit(1)
print(f'GC doc: {gc_doc["filename"]}')

from app.agents.tools.parallel_vision_tools import extract_all_sov_pages_parallel

t0 = time.time()
result = extract_all_sov_pages_parallel.invoke({'package_id': PKG, 'start_page': 2, 'end_page': 8})
elapsed = time.time() - t0
lines = result.get('lines', [])
print(f'Parallel vision: {len(lines)} lines from {result.get("pages_processed",0)} pages in {elapsed:.1f}s')
if result.get('pages_failed'): print(f'  Failed pages: {result["pages_failed"]}')

# Fix values and save
fixed = []
for l in lines:
    row = dict(l)
    pct = row.get('pct')
    if isinstance(pct, float) and abs(pct) > 1.1:
        row['pct'] = min(pct / 100.0, 1.0)
    for sf, ml in [('item_no',50),('time_period',50),('phases',200),('type_of_work',500),('contractor_name',255)]:
        v = row.get(sf)
        if isinstance(v, str) and len(v) > ml:
            row[sf] = v[:ml]
    fixed.append(row)

resp = httpx.post(f'{GW}/api/packages/{PKG}/gc-sov', json=fixed, timeout=30)
print(f'Saved {len(fixed)} lines: HTTP {resp.status_code}')
if resp.status_code >= 400:
    print(resp.text[:200])

import os, sys, json, math
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))
os.environ.setdefault('API_GATEWAY_URL', 'http://localhost:3001')

import httpx

PKG = sys.argv[1] if len(sys.argv) > 1 else 'c78791de-aad9-492d-b273-4ae4640dc7a1'
GW = os.environ.get('API_GATEWAY_URL', 'http://localhost:3001')

# Get GC document
resp = httpx.get(f'{GW}/api/packages/{PKG}')
docs = resp.json()['documents']
gc_doc = next((d for d in docs if d.get('fileType') in ('GC_PAY_APP', 'GC_G702')), None)
if not gc_doc: print('No GC document found!'); sys.exit(1)
print(f'GC doc: {gc_doc["filename"]}')

# Step 1: pdfplumber
from app.agents.tools.pdfplumber_tools import extract_all_sov_pages_with_pdfplumber
plumber = extract_all_sov_pages_with_pdfplumber.invoke({'blob_url': gc_doc['blobUrl'], 'package_id': PKG})
plumber_lines = plumber.get('lines', [])
print(f'pdfplumber: {len(plumber_lines)} lines from {plumber.get("sov_page_count",0)} pages')

# Step 2: Vision for pages 2-8 to supplement/replace
from app.agents.tools.vision_tools import extract_sov_table_from_page
all_lines = list(plumber_lines)  # start with pdfplumber results

vision_lines = []
for pg in range(2, 9):  # Pages 2-8 are G703
    print(f'  Vision page {pg}/8...', end='', flush=True)
    try:
        rows = extract_sov_table_from_page.invoke({'package_id': PKG, 'page_number': pg})
        print(f' {len(rows)} rows')
        vision_lines.extend(rows)
    except Exception as e:
        print(f' ERROR: {str(e)[:60]}')

if len(vision_lines) > len(plumber_lines):
    print(f'Using vision ({len(vision_lines)} lines) over pdfplumber ({len(plumber_lines)} lines)')
    all_lines = vision_lines
else:
    print(f'Keeping pdfplumber ({len(plumber_lines)}) — vision got {len(vision_lines)}')

# Fix and save
fixed = []
for l in all_lines:
    row = dict(l)
    pct = row.get('pct')
    if isinstance(pct, float) and abs(pct) > 1.1:
        row['pct'] = min(pct / 100.0, 1.0)
    for sf, ml in [('item_no',50),('time_period',50),('phases',200),('type_of_work',500),('contractor_name',255)]:
        v = row.get(sf)
        if isinstance(v, str) and len(v) > ml:
            row[sf] = v[:ml]
    fixed.append(row)

resp = httpx.post(f'{GW}/api/packages/{PKG}/gc-sov', json=fixed, timeout=30)
print(f'Saved {len(fixed)} lines: HTTP {resp.status_code}')
if resp.status_code >= 400:
    print(resp.text[:200])

import os, sys, json
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))
os.environ.setdefault('API_GATEWAY_URL', 'http://localhost:3001')

import httpx

PKG = sys.argv[1] if len(sys.argv) > 1 else 'c78791de-aad9-492d-b273-4ae4640dc7a1'
GW = os.environ.get('API_GATEWAY_URL', 'http://localhost:3001')

# Get documents
resp = httpx.get(f'{GW}/api/packages/{PKG}')
docs = resp.json()['documents']
gc_doc = next((d for d in docs if d.get('fileType') in ('GC_PAY_APP', 'GC_G702')), None)
if not gc_doc:
    print('No GC document found!'); sys.exit(1)

print(f'GC doc: {gc_doc["filename"]} ({gc_doc["fileType"]})')

# First try pdfplumber
from app.agents.tools.pdfplumber_tools import extract_all_sov_pages_with_pdfplumber

plumber_result = extract_all_sov_pages_with_pdfplumber.invoke({'blob_url': gc_doc['blobUrl'], 'package_id': PKG})
plumber_lines = plumber_result.get('lines', [])
print(f'pdfplumber: {len(plumber_lines)} lines from {plumber_result.get("sov_page_count", 0)} pages')

if len(plumber_lines) >= 100:
    print('pdfplumber looks good, saving...')
    all_lines = plumber_lines
else:
    print(f'Only {len(plumber_lines)} from pdfplumber — using vision for pages 2-8')
    from app.agents.tools.vision_tools import extract_sov_table_from_page
    all_lines = []
    for pg in range(2, 9):  # Pages 2-8 are G703
        print(f'  Vision extracting page {pg}/8...')
        rows = extract_sov_table_from_page.invoke({'package_id': PKG, 'page_number': pg})
        print(f'    → {len(rows)} rows')
        all_lines.extend(rows)
    print(f'Vision total: {len(all_lines)} lines')

# Fix and truncate
fixed = []
for l in all_lines:
    row = dict(l)
    pct = row.get('pct')
    if isinstance(pct, float) and abs(pct) > 1.1:
        row['pct'] = min(pct / 100.0, 1.0)
    for str_f, max_l in [('item_no',50),('time_period',50),('phases',200),('type_of_work',500),('contractor_name',255)]:
        v = row.get(str_f)
        if isinstance(v, str) and len(v) > max_l:
            row[str_f] = v[:max_l]
    fixed.append(row)

# Save
resp = httpx.post(f'{GW}/api/packages/{PKG}/gc-sov', json=fixed, timeout=30)
print(f'Save {len(fixed)} lines: HTTP {resp.status_code} - {resp.text[:100]}')


from app.agents.tools.pdfplumber_tools import extract_all_sov_pages_with_pdfplumber
import httpx, json, math

BLOB = 'https://aicstorageindia.blob.core.windows.net/jvpay-docs/b71d7595-826e-4e79-8b15-4903a7961f91-App_12.pdf'
PKG = 'c78791de-aad9-492d-b273-4ae4640dc7a1'

result = extract_all_sov_pages_with_pdfplumber.invoke({'blob_url': BLOB, 'package_id': PKG})
lines = result.get('lines', [])
print(f'Got {len(lines)} lines')

# Check for bad values
bad = []
for i, l in enumerate(lines):
    for k, v in l.items():
        if isinstance(v, float):
            if math.isnan(v) or math.isinf(v):
                bad.append(f'Line {i} {k}={v}')
            elif k == 'pct' and abs(v) > 1.1:
                bad.append(f'Line {i} pct={v} (out of Decimal(5,4) range)')
            elif k == 'extraction_confidence' and abs(v) > 1.1:
                bad.append(f'Line {i} confidence={v}')
if bad:
    print('BAD VALUES:', bad[:10])

# Fix bad pct values and truncate string columns
fixed = []
for l in lines:
    row = dict(l)
    pct = row.get('pct')
    if isinstance(pct, float) and abs(pct) > 1.1:
        row['pct'] = min(pct / 100.0, 1.0)
    ec = row.get('extraction_confidence')
    if isinstance(ec, float) and ec > 1.0:
        row['extraction_confidence'] = min(ec, 1.0)
    # Truncate string fields to safe lengths
    for str_field, max_len in [('item_no', 50), ('time_period', 50), ('phases', 200), ('type_of_work', 500), ('contractor_name', 255)]:
        val = row.get(str_field)
        if isinstance(val, str) and len(val) > max_len:
            print(f'TRUNCATING {str_field}: {len(val)} chars → {val[:60]}...')
            row[str_field] = val[:max_len]
    fixed.append(row)

# Send to API
resp = httpx.post(f'http://localhost:3001/api/packages/{PKG}/gc-sov', json=fixed, timeout=15)
print(f'Save {len(fixed)} lines: HTTP {resp.status_code}')
print(resp.text[:300])
