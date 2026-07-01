import pdfplumber, re

PDF13 = r"project-manager\backend\uploads\1782815048626-9516-13 - Boeing BSC App 13 Excel - Draft -  Kim Mark Ups.pdf"

with pdfplumber.open(PDF13) as pdf:
    page = pdf.pages[1]  # page 2 (first G703 page)
    # Test different x_tolerance values
    for xtol in [1, 2, 3, 5, 8]:
        words = page.extract_words(x_tolerance=xtol, y_tolerance=3)
        # Find section header rows (no 3-digit number, text-heavy)
        rows = {}
        for w in words:
            y = round(w["top"]/5)*5
            rows.setdefault(y, []).append(w)
        
        print(f"\n--- x_tolerance={xtol} ---")
        # Show first few text rows
        for y in sorted(rows.keys())[:15]:
            row_text = [w["text"] for w in sorted(rows[y], key=lambda w: w["x0"])]
            if any(len(t) > 3 for t in row_text):
                print(f"  y={y}: {' | '.join(row_text[:8])}")
