"""
Generic G703 pdfplumber extractor — used by the pipeline to extract line items
from any AIA G703 continuation sheet PDF.

Usage: python extract_g703.py <pdf_path> <out_csv>

Outputs a CSV with columns matching the pipeline's expected format.
No LLM required — pure coordinate-based extraction.
"""
import sys, re, csv, json
import pdfplumber

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
    'GRAND','CONTINUATION','A','ITEM','APPLICATION','PAGE','Use','In',
    "Contractor's",'SCHEDULED','WORK','MATERIALS','TOTAL','%','BALANCE',
    'RETAINAGE','FROM','THIS','ORIGINAL','CHANGE','CURRENT','PRESENTLY',
    'COMPLETED','AND','STORED','TO','DATE','FINISH','PREVIOUS','NO.',
    'DESCRIPTION','VALUE','VARIABLE','RATE','IF','PERIOD','ARCHITECT',
}

GENERIC_COST_CODES = {
    "UNCOMMITTED SUB COST","GENERAL CONDITIONS","GENERAL REQUIREMENTS",
    "BUILDERS RISK","BUILDER'S RISK","BUSINESS LICENSE","BUSINESS LICENSE/PERMITS",
    "BUSINESS LICENSE-PERMITS","BUSINESS LICENSE / PERMITS",
    "CCIP","SDI","FEE","PERMITS","PERMIT","DESIGN ESCALATION",
    "CONTINGENCY","FINAL CLEANING","ALLOWANCES","ALLOWANCE",
    "IMP","PSQIC PROGRAM","CONTINGENCY ALLOWANCE",
}

def split_description(desc):
    m = re.match(r'^(.*?)\s*\(([^)]+)\)\s*$', desc.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return desc.strip(), None

def safe_int(v):
    if v is None: return 0
    try: return int(round(float(v)))
    except: return 0

def extract_csv(pdf_path, out_csv):
    items = []
    current_phase = ''

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        # Skip cover page (index 0) and last 2 backup pages
        g703_start = 1
        g703_end   = max(2, total_pages - 2)

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

                # Skip grand total and header rows
                if first.startswith('GRAND') and 'TOTAL' in first.upper():
                    continue

                # Section header (phase label)
                if not re.match(r'^\d{3}$', first) and first not in HEADER_WORDS:
                    text_parts = [m for m in merged if m['x0'] < 400]
                    num_parts  = [m for m in merged if m['x0'] >= 400]
                    if text_parts and not num_parts:
                        candidate = ' '.join(m['text'] for m in text_parts)
                        if any(ch.isalpha() for ch in candidate) and len(candidate) > 5:
                            current_phase = candidate
                    continue

                # Line-item row
                if not re.match(r'^\d{3}$', first):
                    continue

                item_no = first
                # Check for split row (next y within 8 units, also no item number)
                if i + 1 < len(sorted_ys):
                    ny = sorted_ys[i + 1]
                    if ny - y <= 8 and ny not in consumed_ys:
                        next_merged = join_words(rows[ny])
                        if next_merged and not re.match(r'^\d{3}$', next_merged[0]['text']):
                            merged = merged + next_merged
                            consumed_ys.add(ny)

                row_data = {
                    'item_no': item_no, 'phase': current_phase, 'page': pg_idx + 1,
                    'description': '',
                    'C_ORIG': 0.0, 'C_CO': 0.0, 'C_CURR': 0.0,
                    'D': 0.0, 'E': 0.0, 'F': 0.0, 'G': 0.0,
                    'pct': '0%', 'balance': 0.0, 'retainage': 0.0,
                }
                desc_parts = []
                for m in merged[1:]:  # skip item_no token
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
                                if col == 'C_ORIG':   row_data['C_ORIG'] = v
                                elif col == 'C_CO':   row_data['C_CO']   = v
                                elif col == 'C_CURR': row_data['C_CURR'] = v
                                elif col == 'D':      row_data['D']      = v
                                elif col == 'E':      row_data['E']      = v
                                elif col == 'F':      row_data['F']      = v
                                elif col == 'G':      row_data['G']      = v
                                elif col == 'I':      row_data['balance']   = v
                                elif col == 'J':      row_data['retainage'] = v
                row_data['description'] = ' '.join(desc_parts)
                items.append(row_data)

    # Detect time period from PDF cover page text
    time_period = "3/31/26"
    try:
        with pdfplumber.open(pdf_path) as pdf:
            cover_text = pdf.pages[0].extract_text() or ''
            m = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', cover_text)
            if m:
                time_period = m.group(1)
    except Exception:
        pass

    # Build CSV rows
    COLUMN_ORDER = [
        "Item No.", "Time Period", "Phases", "Type of work", "Contractor name",
        "SCHEDULED ORIGINAL", "SCHEDULED CHANGE ORDERS", "SCHEDULED CURRENT",
        "WORK COMPLETED FROM PREVIOUS APPLICATION", "WORK COMPLETED THIS PERIOD",
        "MATERIALS PRESENTLY STORED", "TOTAL COMPLETED AND STORED",
        "% (G / C)", "Balance to Finish (C-G)", "RETAINAGE (If Variable Rate)",
        "Source Page", "Review Notes",
    ]

    with open(out_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=COLUMN_ORDER)
        writer.writeheader()
        for item in items:
            raw_desc = item.get('description', '')
            type_of_work, contractor = split_description(raw_desc)
            if contractor is None:
                tow_upper = type_of_work.upper()
                if tow_upper not in GENERIC_COST_CODES and not tow_upper.startswith('ALLOWANCE'):
                    contractor = type_of_work

            writer.writerow({
                "Item No.":                                 item['item_no'],
                "Time Period":                              time_period,
                "Phases":                                   item.get('phase', ''),
                "Type of work":                             type_of_work,
                "Contractor name":                          contractor or '',
                "SCHEDULED ORIGINAL":                       safe_int(item.get('C_ORIG')),
                "SCHEDULED CHANGE ORDERS":                  safe_int(item.get('C_CO')),
                "SCHEDULED CURRENT":                        safe_int(item.get('C_CURR')),
                "WORK COMPLETED FROM PREVIOUS APPLICATION": safe_int(item.get('D')),
                "WORK COMPLETED THIS PERIOD":               safe_int(item.get('E')),
                "MATERIALS PRESENTLY STORED":               safe_int(item.get('F')),
                "TOTAL COMPLETED AND STORED":               safe_int(item.get('G')),
                "% (G / C)":                                item.get('pct', '0%'),
                "Balance to Finish (C-G)":                  safe_int(item.get('balance')),
                "RETAINAGE (If Variable Rate)":             safe_int(item.get('retainage')),
                "Source Page":                              item.get('page', ''),
                "Review Notes":                             '',
            })

    return len(items)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python extract_g703.py <pdf_path> <out_csv>")
        sys.exit(1)
    pdf_path = sys.argv[1]
    out_csv  = sys.argv[2]
    count = extract_csv(pdf_path, out_csv)
    print(f"DONE:{count}")
