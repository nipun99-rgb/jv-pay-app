import sys, os, io
sys.path.insert(0, '.')
for line in open('.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

from app.nodes import _download_blob
import pdfplumber

pdf_bytes = _download_blob('https://aicstorageindia.blob.core.windows.net/jvpay-docs/9bdf10ed-4271-45b3-9f77-be70c9e04491-SubApp12.pdf')
print(f'PDF size: {len(pdf_bytes):,} bytes')

keywords_old = ('application for payment', 'application no', 'application number',
                'subcontractor application', 'application & certificate')

keywords_new = keywords_old + ('period of', 'original contract', 'from contractor',
                                'to owner', 'contract sum', 'amount certified',
                                'subcontract amount', 'application and certificate')

with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
    total = len(pdf.pages)
    print(f'Total pages: {total}')
    
    old_boundaries = []
    new_boundaries = []
    
    for pn, page in enumerate(pdf.pages, start=1):
        txt = (page.extract_text() or '').lower()
        if any(kw in txt for kw in keywords_old):
            old_boundaries.append(pn)
        if any(kw in txt for kw in keywords_new):
            new_boundaries.append(pn)
    
    print(f'\nOLD keywords found on {len(old_boundaries)} pages: {old_boundaries[:30]}')
    print(f'NEW keywords found on {len(new_boundaries)} pages: {new_boundaries[:30]}')
    
    # Sample text from pages at even intervals to understand structure
    print('\n--- Sample page texts ---')
    for pn in [1, 10, 20, 30, 40]:
        if pn <= total:
            txt = (pdf.pages[pn-1].extract_text() or '').strip()
            has_text = len(txt) > 20
            print(f'Page {pn} ({len(txt)} chars): {repr(txt[:150] if has_text else "(empty/no text)")}')
