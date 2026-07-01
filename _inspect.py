import pdfplumber, re

PDF13 = r"project-manager\backend\uploads\1782815048626-9516-13 - Boeing BSC App 13 Excel - Draft -  Kim Mark Ups.pdf"
PDF12 = r"Test Files\App 12.pdf"

for label, path in [("App12", PDF12), ("App13", PDF13)]:
    with pdfplumber.open(path) as pdf:
        print(f"=== {label}: {len(pdf.pages)} pages ===")
        total_items = 0
        for i, page in enumerate(pdf.pages):
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            item_nos = [w["text"] for w in words if re.match(r"^\d{3}$", w["text"])]
            total_items += len(item_nos)
            num_x1 = sorted(set(round(w["x1"]) for w in words if w.get("x0",0)>400 and re.match(r"^[\d,]+$", w["text"].replace(",",""))))
            print(f"  pg{i+1}: {len(item_nos)} items {item_nos[:3]}..{item_nos[-2:] if len(item_nos)>3 else []} | x1 samples:{num_x1[:6]}")
        print(f"  TOTAL item rows: {total_items}")
