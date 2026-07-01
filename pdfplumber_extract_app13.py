"""
Deterministic pdfplumber extractor for G703 continuation sheet — App 13.
Extracts all numeric values using PDF coordinate positions — zero LLM involvement.
Outputs: gc_app13_plumber_nums.json
"""
import pdfplumber
import re
import json
import os

PDF_PATH   = r"project-manager\backend\uploads\1782815048626-9516-13 - Boeing BSC App 13 Excel - Draft -  Kim Mark Ups.pdf"
OUTPUT     = "gc_app13_plumber_nums.json"

# Column x1 boundaries (same layout as App 12 — confirmed identical by inspection)
def assign_col(x1):
    if x1 <= 450:  return 'C_ORIG'
    if x1 <= 540:  return 'C_CO'
    if x1 <= 640:  return 'C_CURR'
    if x1 <= 730:  return 'D'
    if x1 <= 820:  return 'E'
    if x1 <= 870:  return 'F'
    if x1 <= 980:  return 'G'
    if x1 <= 1060: return 'H'
    if x1 <= 1150: return 'I'
    return 'J'

def join_words(row_words):
    ws = sorted(row_words, key=lambda w: w['x0'])
    merged, i = [], 0
    while i < len(ws):
        text, x0, x1 = ws[i]['text'], ws[i]['x0'], ws[i]['x1']
        while i+1 < len(ws) and ws[i+1]['x0'] - x1 < 6:
            next_text = ws[i+1]['text']
            # No space when joining number fragments (e.g. "1" + ",024,203")
            is_num_join = bool(next_text) and next_text[0] in ',0123456789()'
            sep = '' if is_num_join else ' '
            i += 1; text += sep + next_text; x1 = ws[i]['x1']
        merged.append({'text': text, 'x0': x0, 'x1': x1})
        i += 1
    return merged

def parse_val(text):
    t = text.strip().replace(',', '')
    if t in ('-', '', 'n/a', 'N/A'): return 0.0
    if t.endswith('%'): return None
    if t.startswith('(') and t.endswith(')'):
        try: return -float(t[1:-1])
        except ValueError: return None
    try: return float(t)
    except ValueError: return None

HEADER_WORDS = {
    'GRAND', 'CONTINUATION', 'A', 'ITEM', 'APPLICATION', 'PAGE', 'Use', 'In',
    "Contractor's", 'SCHEDULED', 'WORK', 'MATERIALS', 'TOTAL', '%', 'BALANCE',
    'RETAINAGE', 'FROM', 'THIS', 'ORIGINAL', 'CHANGE', 'CURRENT', 'PRESENTLY',
    'COMPLETED', 'AND', 'STORED', 'TO', 'DATE', 'FINISH', 'PREVIOUS', 'NO.',
    'DESCRIPTION', 'VALUE', 'VARIABLE', 'RATE', 'IF', 'PERIOD', 'ARCHITECT',
}

def extract_item_data(merged_words, item_no, phase, page_num):
    row_data = {
        'item_no': item_no, 'phase': phase, 'page': page_num, 'description': '',
        'D': 0.0, 'E': 0.0, 'F': 0.0, 'G': 0.0,
        'C_ORIG': 0.0, 'C_CO': 0.0, 'C_CURR': 0.0,
        'pct': '0%', 'balance': 0.0, 'retainage': 0.0,
    }
    desc_parts = []
    for m in merged_words:
        if m['x0'] < 300:
            desc_parts.append(m['text'])
        else:
            col = assign_col(m['x1'])
            txt = m['text'].strip()
            if txt.endswith('%'):
                row_data['pct'] = txt
            else:
                v = parse_val(txt)
                if v is not None:
                    if col == 'D':        row_data['D'] = v
                    elif col == 'E':      row_data['E'] = v
                    elif col == 'F':      row_data['F'] = v
                    elif col == 'G':      row_data['G'] = v
                    elif col == 'C_ORIG': row_data['C_ORIG'] = v
                    elif col == 'C_CO':   row_data['C_CO'] = v
                    elif col == 'C_CURR': row_data['C_CURR'] = v
                    elif col == 'I':      row_data['balance'] = v
                    elif col == 'J':      row_data['retainage'] = v
    row_data['description'] = ' '.join(desc_parts)
    return row_data

items = []
current_phase = ''
grand_total_row = None
warnings = []

with pdfplumber.open(PDF_PATH) as pdf:
    total_pages = len(pdf.pages)
    print(f"App 13 PDF: {total_pages} pages")

    # Detect G703 page range: skip page 1 (cover), stop before backup pages
    # App 13: pages 2-8 are G703 (indices 1-7); pages 9-10 are backup
    g703_start = 1   # index (0-based) = page 2
    g703_end   = total_pages - 2  # stop before last 2 backup pages

    print(f"Processing G703 pages: {g703_start+1} to {g703_end} (indices {g703_start}..{g703_end-1})")

    for pg_idx in range(g703_start, g703_end):
        page = pdf.pages[pg_idx]
        words = page.extract_words(x_tolerance=3, y_tolerance=3)

        rows = {}
        for w in words:
            y = round(w['top'] / 5) * 5
            rows.setdefault(y, []).append(w)

        sorted_ys = sorted(rows.keys())
        consumed_ys = set()

        for i, y in enumerate(sorted_ys):
            if y in consumed_ys:
                continue
            merged = join_words(rows[y])
            if not merged:
                continue
            first = merged[0]['text']

            # Grand Total row
            if first.startswith('GRAND') and 'TOTAL' in first.upper():
                row_data = {'item_no': 'GRAND_TOTAL', 'description': 'GRAND TOTAL',
                            'phase': '', 'page': pg_idx + 1}
                for m in merged:
                    if m['x0'] >= 300:
                        col = assign_col(m['x1'])
                        v = parse_val(m['text'])
                        if v is not None and col not in row_data:
                            row_data[col] = v
                grand_total_row = row_data
                continue

            # Section header row
            if not re.match(r'^\d{3}$', first) and first not in HEADER_WORDS:
                text_parts = [m for m in merged if m['x0'] < 400]
                num_parts  = [m for m in merged if m['x0'] >= 400]
                if text_parts and not num_parts:
                    candidate = ' '.join(m['text'] for m in text_parts)
                    if any(ch.isalpha() for ch in candidate) and len(candidate) > 5:
                        current_phase = candidate
                continue

            # Line-item row
            if re.match(r'^\d{3}$', first):
                item_no = first

                has_numeric = any(
                    m['x0'] >= 300
                    and re.match(r'^[\d,\(\)]+$', m['text'].replace('-', ''))
                    and m['text'] != '-'
                    for m in merged[1:]
                )
                if not has_numeric and i + 1 < len(sorted_ys):
                    next_y = sorted_ys[i + 1]
                    next_merged = join_words(rows[next_y])
                    next_first = next_merged[0]['text'] if next_merged else ''
                    if not re.match(r'^\d{3}$', next_first):
                        merged = merged + next_merged
                        consumed_ys.add(next_y)
                        warnings.append(f"Item {item_no} (page {pg_idx+1}): split row merged y={y}+y={next_y}")

                row_data = extract_item_data(merged[1:], item_no, current_phase, pg_idx + 1)

                computed_g = row_data['D'] + row_data['E'] + row_data['F']
                if row_data['G'] == 0.0 and computed_g > 0:
                    row_data['G'] = computed_g
                    warnings.append(f"Item {item_no}: G was 0, auto-set to D+E+F={computed_g:.0f}")

                if abs(row_data['G'] - (row_data['D'] + row_data['E'] + row_data['F'])) > 2:
                    warnings.append(
                        f"Item {item_no}: G={row_data['G']:.0f} != D+E+F="
                        f"{row_data['D']+row_data['E']+row_data['F']:.0f}")

                items.append(row_data)

        pg_items = [x for x in items if x['page'] == pg_idx + 1]
        print(f"  Page {pg_idx+1}: extracted {len(pg_items)} items"
              f" ({pg_items[0]['item_no'] if pg_items else '?'}"
              f"..{pg_items[-1]['item_no'] if pg_items else '?'})")

print(f"\nTotal extracted: {len(items)} line items")
print(f"Grand total row found: {grand_total_row is not None}")

print("\nColumn sums:")
for col in ['C_CURR', 'D', 'E', 'F', 'G', 'retainage']:
    total = sum(r.get(col, 0) for r in items if r['item_no'] != 'GRAND_TOTAL')
    print(f"  {col}: {total:,.0f}")

if warnings:
    print(f"\nWarnings ({len(warnings)}):")
    for w in warnings:
        print(f"  {w}")

output = {'items': items, 'grand_total': grand_total_row, 'warnings': warnings}
with open(OUTPUT, 'w') as f:
    json.dump(output, f, indent=2)
print(f"\nSaved → {OUTPUT}")
print(f"Item range: {items[0]['item_no']} .. {items[-1]['item_no']}")
