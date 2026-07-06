import sys, os, io
sys.path.insert(0, '.')
for line in open('.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

import logging
logging.basicConfig(level=logging.WARNING)  # suppress azure noise

from app.nodes import _download_blob
import pdfplumber

pdf_bytes = _download_blob('https://aicstorageindia.blob.core.windows.net/jvpay-docs/9bdf10ed-4271-45b3-9f77-be70c9e04491-SubApp12.pdf')
print(f'PDF: {len(pdf_bytes):,} bytes')

G702_KEYWORDS = (
    'application for payment', 'application no', 'application number',
    'subcontractor application', 'application & certificate',
    'original contract sum', 'contract sum to date',
    'current payment due', 'amount certified',
)
G703_SKIP = ('continuation sheet', 'scheduled value', 'work completed from previous')

header_pages = []
with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
    total = len(pdf.pages)
    for pn, page in enumerate(pdf.pages, start=1):
        txt = (page.extract_text() or '').lower()
        if any(kw in txt for kw in G703_SKIP):
            continue
        if any(kw in txt for kw in G702_KEYWORDS):
            header_pages.append(pn)

print(f'Header pages with G702 keywords ({len(header_pages)}): {header_pages}')

# Always start from page 1
if not header_pages or header_pages[0] > 1:
    header_pages.insert(0, 1)

raw = []
for i, s in enumerate(header_pages):
    e = header_pages[i+1]-1 if i+1 < len(header_pages) else total
    raw.append((s, e))

# Merge single-page sections
merged = []
for start, end in raw:
    if (end - start) < 1 and merged:
        prev_start, _ = merged[-1]
        merged[-1] = (prev_start, end)
    else:
        merged.append((start, end))

print(f'Merged sections ({len(merged)}): {merged}')
