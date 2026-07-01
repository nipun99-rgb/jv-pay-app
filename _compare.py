import pdfplumber, re, json

# Compare item number sets between App 12 (cached extraction) and App 13 (PDF)
with open("gc_app12_plumber_nums.json") as f:
    app12_data = json.load(f)

app12_items = [str(i["item_no"]).zfill(3) for i in app12_data["items"] if i["item_no"] != "GRAND_TOTAL"]
print(f"App12 pdfplumber cache: {len(app12_items)} items  ({app12_items[0]}..{app12_items[-1]})")

# Now extract App 13 item numbers directly from PDF
PDF13 = r"project-manager\backend\uploads\1782815048626-9516-13 - Boeing BSC App 13 Excel - Draft -  Kim Mark Ups.pdf"

def join_words(row_words):
    ws = sorted(row_words, key=lambda w: w["x0"])
    merged, i = [], 0
    while i < len(ws):
        text, x0, x1 = ws[i]["text"], ws[i]["x0"], ws[i]["x1"]
        while i+1 < len(ws) and ws[i+1]["x0"] - x1 < 6:
            i += 1; text += ws[i]["text"]; x1 = ws[i]["x1"]
        merged.append({"text": text, "x0": x0, "x1": x1})
        i += 1
    return merged

app13_item_nos = []
with pdfplumber.open(PDF13) as pdf:
    print(f"\nApp13 PDF: {len(pdf.pages)} pages")
    for pg_idx in range(1, len(pdf.pages) - 2):  # skip cover (0) and backup pages
        page = pdf.pages[pg_idx]
        words = page.extract_words(x_tolerance=3, y_tolerance=3)
        rows = {}
        for w in words:
            y = round(w["top"]/5)*5
            rows.setdefault(y, []).append(w)
        for y in sorted(rows.keys()):
            merged = join_words(rows[y])
            if merged and re.match(r"^\d{3}$", merged[0]["text"]):
                app13_item_nos.append(merged[0]["text"])

print(f"App13 item rows found: {len(app13_item_nos)}")
print(f"  First 10: {app13_item_nos[:10]}")
print(f"  Last 10: {app13_item_nos[-10:]}")

# Find items in App13 but not App12
app12_set = set(app12_items)
app13_set = set(app13_item_nos)
new_items = sorted(app13_set - app12_set)
removed_items = sorted(app12_set - app13_set)
print(f"\nItems in App13 NOT in App12: {new_items[:20]}")
print(f"Items in App12 NOT in App13: {removed_items[:20]}")
