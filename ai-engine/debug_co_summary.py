import sys, re, os, io
sys.path.insert(0, '.')
for line in open('.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())
from app.nodes import _download_blob
import pdfplumber

pdf_bytes = _download_blob('https://aicstorageindia.blob.core.windows.net/jvpay-docs/6dfff1ae-8db6-4568-bcc7-ef5af1c6976a-App12.pdf')
with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
    full_text = '\n'.join(page.extract_text() or '' for page in pdf.pages)

text_lower = full_text.lower()
idx = text_lower.find('change order summary')
if idx >= 0:
    snippet = full_text[idx:idx+500]
    print('=== Text around change_order_summary ===')
    print(repr(snippet[:300]))
    print('...')
else:
    print('Not found in full text')

# Test current regex
pattern = r"change\s+order\s+summary[:\s]+(.{10,300}?)(?:\n\n|continuation\s+sheet|application\s+no|\Z)"
m = re.search(pattern, full_text, re.IGNORECASE | re.DOTALL)
if m:
    captured = m.group(1)
    print(f'\nNew regex captured ({len(captured)} chars): {repr(captured[:200])}')
else:
    print('New regex: no match')
