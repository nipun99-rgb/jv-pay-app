"""Extract G703 rows from pages 9-12 of App 12.pdf and append to existing SOV data."""
import os, sys, base64, json, httpx

for line in open(os.path.join(os.path.dirname(__file__), '../.env')):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

from openai import AzureOpenAI
client = AzureOpenAI(
    azure_endpoint=os.environ['AZURE_OPENAI_ENDPOINT'],
    api_key=os.environ['AZURE_OPENAI_API_KEY'],
    api_version='2024-12-01-preview'
)
gw = 'http://localhost:3001'
pkg_id = sys.argv[1] if len(sys.argv) > 1 else None
if not pkg_id:
    print("Usage: python extract_missing_pages.py <package_id>"); sys.exit(1)

SYSTEM = """Extract ALL line items from this G703 continuation sheet page. Return ONLY valid JSON:
{
  "lines": [
    {"item_no": "001", "phases": "", "type_of_work": "...", "contractor_name": "...",
     "scheduled_original": 0.0, "scheduled_change_orders": null, "scheduled_current": 0.0,
     "work_completed_prev": 0.0, "work_completed_this": 0.0,
     "materials_stored": 0.0, "total_completed": 0.0,
     "pct": 0.85, "balance_to_finish": 0.0, "retainage": null,
     "extraction_confidence": 0.85, "source_page": 10}
  ]
}
pct as decimal 0-1 (e.g., 0.85 for 85%). Return empty lines array if no G703 SOV table found.
Only extract actual line items — skip header rows, subtotals, and page footers."""

all_new_lines = []
for page_num in [9, 10, 11, 12]:
    print(f"\nChecking page {page_num}...")
    img = httpx.get(f'{gw}/api/packages/{pkg_id}/page-image?page={page_num}&fileType=GC_PAY_APP').content
    b64 = base64.b64encode(img).decode()

    resp = client.chat.completions.create(
        model='gpt-5.4',
        max_completion_tokens=16384,
        messages=[
            {'role': 'system', 'content': SYSTEM},
            {'role': 'user', 'content': [
                {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64}', 'detail': 'high'}},
                {'type': 'text', 'text': f'Extract all G703 SOV line items from page {page_num}. Set source_page={page_num} on each line.'}
            ]}
        ]
    )
    txt = resp.choices[0].message.content.strip()
    if '```' in txt:
        txt = txt.split('```')[1].lstrip('json').strip()
    try:
        data = json.loads(txt)
        lines = data.get('lines', [])
        for l in lines:
            l['source_page'] = page_num
        print(f"  Page {page_num}: {len(lines)} lines extracted")
        for l in lines[:3]:
            print(f"    item={l.get('item_no')} work={str(l.get('type_of_work',''))[:30]} sched={l.get('scheduled_current')}")
        all_new_lines.extend(lines)
    except Exception as e:
        print(f"  Page {page_num}: parse error — {e}")

print(f"\nTotal new lines: {len(all_new_lines)}")

if not all_new_lines:
    print("No new lines found. Pages 9-12 may not contain G703 data."); sys.exit(0)

# Apply auto-reconcile fixes
for row in all_new_lines:
    if not row.get('scheduled_original') and row.get('scheduled_change_orders'):
        row['scheduled_original'] = row['scheduled_change_orders']
        row['scheduled_change_orders'] = None
    dep = (float(row.get('work_completed_prev') or 0) +
           float(row.get('work_completed_this') or 0) +
           float(row.get('materials_stored') or 0))
    if dep > 0 and not row.get('total_completed'):
        row['total_completed'] = round(dep, 2)
    sched = float(row.get('scheduled_current') or 0)
    tot = float(row.get('total_completed') or 0)
    if sched > 0:
        row['balance_to_finish'] = round(sched - tot, 2)

# Append to existing SOV (POST endpoint replaces all — need to fetch existing + merge)
existing_resp = httpx.get(f'{gw}/api/packages/{pkg_id}/gc-sov', timeout=15)
existing = existing_resp.json() if existing_resp.status_code == 200 else []
print(f"Existing lines: {len(existing)}, adding {len(all_new_lines)} new")

# Convert existing DB format (camelCase) to snake_case for re-save
def to_snake(row):
    mapping = {
        'itemNo': 'item_no', 'timePeriod': 'time_period', 'phases': 'phases',
        'typeOfWork': 'type_of_work', 'contractorName': 'contractor_name',
        'scheduledOriginal': 'scheduled_original', 'scheduledChangeOrders': 'scheduled_change_orders',
        'scheduledCurrent': 'scheduled_current', 'workCompletedPrev': 'work_completed_prev',
        'workCompletedThis': 'work_completed_this', 'materialsStored': 'materials_stored',
        'totalCompleted': 'total_completed', 'pct': 'pct', 'balanceToFinish': 'balance_to_finish',
        'retainage': 'retainage', 'extractionConfidence': 'extraction_confidence',
    }
    return {mapping.get(k, k): v for k, v in row.items() if k in mapping}

merged = [to_snake(r) for r in existing] + all_new_lines

# Save merged list
from app.agents.tools.db_tools import save_gc_sov_lines
save_gc_sov_lines.invoke({"package_id": pkg_id, "lines": merged})
print(f"Saved {len(merged)} total lines ({len(existing)} existing + {len(all_new_lines)} new)")
