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
    page = pdf.pages[7]  # page 8
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    rows = {}
    for w in words:
        y = round(w['top'] / 5) * 5
        rows.setdefault(y, []).append(w)

    print('Page 8 rows:')
    for y in sorted(rows.keys()):
        merged = join_words(rows[y])
        parts = []
        for m in merged[:14]:
            parts.append('%s(x1=%d)' % (m['text'], round(m['x1'])))
        print('y=%4d: %s' % (y, ' | '.join(parts)[:220]))
