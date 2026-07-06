"""Debug page 4 around item 079 to understand why description is empty"""
import pdfplumber

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
    # Pages 4 and 5 (indices 3 and 4)
    for pg_idx in [3, 4]:
        page = pdf.pages[pg_idx]
        words = page.extract_words(x_tolerance=3, y_tolerance=3)
        rows = {}
        for w in words:
            y = round(w['top'] / 5) * 5
            rows.setdefault(y, []).append(w)
        
        print('Page %d rows near items 070-085:' % (pg_idx+1))
        for y in sorted(rows.keys()):
            merged = join_words(rows[y])
            line = ' | '.join('%s(x1=%d)' % (m['text'], round(m['x1'])) for m in merged[:14])
            first = merged[0]['text'] if merged else ''
            # Show rows near items 70-85 or with relevant text
            import re
            if (re.match(r'^0[67]\d$', first) or re.match(r'^0[89]\d$', first) 
                    or re.match(r'^07\d$', first) or 'PTS' in line.upper() 
                    or 'FEE' in first or 'PKRD' in line.upper()):
                print('y=%4d: %s' % (y, line[:220]))
