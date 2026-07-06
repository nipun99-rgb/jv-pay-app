"""Debug: find all split rows (item number on one line, data on next line)"""
import pdfplumber
import re

def join_words(row_words):
    ws = sorted(row_words, key=lambda w: w['x0'])
    merged = []
    i = 0
    while i < len(ws):
        text = ws[i]['text']
        x0 = ws[i]['x0']
        x1 = ws[i]['x1']
        while i+1 < len(ws) and ws[i+1]['x0'] - x1 < 6:
            i += 1
            text += ws[i]['text']
            x1 = ws[i]['x1']
        merged.append({'text': text, 'x0': x0, 'x1': x1})
        i += 1
    return merged

with pdfplumber.open(r'Test Files\App 12.pdf') as pdf:
    for pg_idx in range(1, 8):
        page = pdf.pages[pg_idx]
        words = page.extract_words(x_tolerance=3, y_tolerance=3)
        rows = {}
        for w in words:
            y = round(w['top'] / 5) * 5
            rows.setdefault(y, []).append(w)

        sorted_ys = sorted(rows.keys())
        for i, y in enumerate(sorted_ys):
            merged = join_words(rows[y])
            if not merged:
                continue
            first = merged[0]['text']
            # Check if this is a 3-digit item row with NO numeric data
            if re.match(r'^\d{3}$', first):
                has_numeric = any(
                    m['x0'] >= 300 and re.match(r'^[\d,\(\)]+$', m['text'].replace('-','')) and m['text'] != '-'
                    for m in merged[1:]
                )
                if not has_numeric:
                    # This is a split item - look at next row
                    if i + 1 < len(sorted_ys):
                        next_y = sorted_ys[i+1]
                        next_merged = join_words(rows[next_y])
                        next_first = next_merged[0]['text'] if next_merged else ''
                        if not re.match(r'^\d{3}$', next_first):
                            # Next row is continuation
                            print('SPLIT ITEM %s on page %d: item at y=%d, data at y=%d (gap=%d)' % (
                                first, pg_idx+1, y, next_y, next_y-y))
                            print('  Item row: %s' % ' '.join(m['text'] for m in merged))
                            print('  Data row: %s' % ' '.join(m['text'] for m in next_merged[:12]))
