import fitz  # pymupdf
import json, base64, io
from PIL import Image

PDF_PATH = r"project-manager\backend\uploads\1782815048626-9516-13 - Boeing BSC App 13 Excel - Draft -  Kim Mark Ups.pdf"
OUTPUT = "gc_app13_page_images.json"
DPI = 200

doc = fitz.open(PDF_PATH)
print(f"Rendering {len(doc)} pages at {DPI} DPI...")

pages = {}
for i, page in enumerate(doc):
    mat = fitz.Matrix(DPI/72, DPI/72)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    pages[str(i+1)] = b64
    print(f"  Page {i+1}: {pix.width}x{pix.height} → {len(b64)//1024}KB")

with open(OUTPUT, "w") as f:
    json.dump(pages, f)
print(f"\nSaved {len(pages)} pages → {OUTPUT}")
