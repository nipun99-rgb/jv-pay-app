"""
Standalone runner for Cell 6 logic.
Loads all required inputs from cache files and produces gc_app12_line_items_v5.csv
"""
import pandas as pd
import json
import os

BASE_DIR = r"C:\Users\KR614XU\Downloads\Ishaan"
app_period = "2/28/2026"

# ── Load pdfplumber numeric data ──────────────────────────────────────────────
with open(os.path.join(BASE_DIR, "gc_app12_plumber_nums.json")) as f:
    plumber_data = json.load(f)

plumber_by_ino = {}
for item in plumber_data["items"]:
    ino = str(item["item_no"]).strip().zfill(3)
    plumber_by_ino[ino] = item

print(f"pdfplumber: {len(plumber_by_ino)} items loaded")

# ── Load Vision descriptions ──────────────────────────────────────────────────
with open(os.path.join(BASE_DIR, "gc_app12_master_extraction.json")) as f:
    master = json.load(f)
vision_items = master.get("continuation_sheet", [])

vision_by_ino = {}
for item in vision_items:
    raw_ino = str(item.get("Item No.", "")).strip()
    if raw_ino.upper() in ("GRAND_TOTAL", "GT", ""):
        continue
    ino = raw_ino.lstrip("0").zfill(3) if raw_ino.lstrip("0") else "000"
    vision_by_ino[ino] = item

print(f"Vision: {len(vision_by_ino)} items (item 079 present: {'079' in vision_by_ino})")

# ── Load OCR checkpoint for item 079 fallback ─────────────────────────────────
ocr_item79 = None
with open(os.path.join(BASE_DIR, "gc_app12_g703_checkpoint.json")) as f:
    _ckpt = json.load(f)
for _pg, _pg_items in _ckpt.get("page_results", {}).items():
    for _item in _pg_items:
        if str(_item.get("item_no", "")).strip().lstrip("0") == "79":
            ocr_item79 = _item
            break
if ocr_item79:
    print("OCR checkpoint: item 079 found → type='%s', phase='%s'" %
          (ocr_item79.get("type_of_work", ""), ocr_item79.get("phase", "")))

# ── Build merged rows ──────────────────────────────────────────────────────────
def safe_int(v, default=0):
    if v is None:
        return default
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return default

merged_rows = []
missing_from_vision = []

for ino_padded, pb in sorted(plumber_by_ino.items(), key=lambda x: int(x[0])):
    if ino_padded in vision_by_ino:
        vis = vision_by_ino[ino_padded]
        phases          = vis.get("Phases") or ""
        type_of_work    = vis.get("Type of work") or pb.get("description", "")
        contractor_name = vis.get("Contractor name")
        source_page     = vis.get("Source Page") or pb.get("page")
        review_notes    = vis.get("Review Notes")
    elif ino_padded == "079" and ocr_item79:
        phases          = ocr_item79.get("phase") or "PTS"
        type_of_work    = ocr_item79.get("type_of_work") or "FEE"
        contractor_name = ocr_item79.get("contractor_name")
        source_page     = pb.get("page")
        review_notes    = "Text from OCR checkpoint; numbers from pdfplumber"
        missing_from_vision.append(ino_padded)
    else:
        phases          = pb.get("phase", "")
        type_of_work    = pb.get("description", "")
        contractor_name = None
        source_page     = pb.get("page")
        review_notes    = "Text from pdfplumber (not in vision output)"
        missing_from_vision.append(ino_padded)

    row = {
        "Item No.":                                  ino_padded,
        "Time Period":                               app_period,
        "Phases":                                    phases,
        "Type of work":                              type_of_work,
        "Contractor name":                           contractor_name,
        "SCHEDULED ORIGINAL":                        safe_int(pb.get("C_ORIG")),
        "SCHEDULED CHANGE ORDERS":                   safe_int(pb.get("C_CO")),
        "SCHEDULED CURRENT":                         safe_int(pb.get("C_CURR")),
        "WORK COMPLETED FROM PREVIOUS APPLICATION":  safe_int(pb.get("D")),
        "WORK COMPLETED THIS PERIOD":                safe_int(pb.get("E")),
        "MATERIALS PRESENTLY STORED":                safe_int(pb.get("F")),
        "TOTAL COMPLETED AND STORED":                safe_int(pb.get("G")),
        "% (G / C)":                                 pb.get("pct", "0%"),
        "Balance to Finish (C-G)":                   safe_int(pb.get("balance")),
        "RETAINAGE (If Variable Rate)":              safe_int(pb.get("retainage")),
        "Source Page":                               source_page,
        "Review Notes":                              review_notes,
    }
    merged_rows.append(row)

if missing_from_vision:
    print(f"Items not in vision output (used fallback): {missing_from_vision}")
print(f"Total merged rows: {len(merged_rows)}")

# ── Contractor name inference for no-bracket descriptions ─────────────────────
GENERIC_COST_CODES = {
    "UNCOMMITTED SUB COST", "GENERAL CONDITIONS", "GENERAL REQUIREMENTS",
    "BUILDERS RISK", "BUILDER'S RISK",
    "BUSINESS LICENSE", "BUSINESS LICENSE/PERMITS", "BUSINESS LICENSE-PERMITS",
    "BUSINESS LICENSE / PERMITS",
    "CCIP", "SDI", "FEE", "PERMITS", "PERMIT",
    "DESIGN ESCALATION", "CONTINGENCY", "FINAL CLEANING",
    "ALLOWANCES", "ALLOWANCE",
    "IMP", "PSQIC PROGRAM", "CONTINGENCY ALLOWANCE",
}

inferred_count = 0
for row in merged_rows:
    if row.get("Contractor name"):
        continue
    tow = (row.get("Type of work") or "").strip().upper()
    if tow in GENERIC_COST_CODES or tow.startswith("ALLOWANCE"):
        continue
    row["Contractor name"] = row["Type of work"]
    if row.get("Review Notes"):
        row["Review Notes"] += "; contractor inferred from description"
    else:
        row["Review Notes"] = "Contractor inferred from description (no brackets in PDF)"
    inferred_count += 1

print(f"Contractor inference: {inferred_count} rows had contractor name inferred")

# ── Show the inferred rows ─────────────────────────────────────────────────────
print("\nInferred contractor rows:")
for row in merged_rows:
    if row.get("Review Notes") and "inferred" in str(row.get("Review Notes", "")):
        print("  Item %s | %-50s | Contractor: %s" % (
            row["Item No."], row["Type of work"][:50], row["Contractor name"]))

# ── Save CSV ───────────────────────────────────────────────────────────────────
COLUMN_ORDER = [
    "Item No.", "Time Period", "Phases", "Type of work", "Contractor name",
    "SCHEDULED ORIGINAL", "SCHEDULED CHANGE ORDERS", "SCHEDULED CURRENT",
    "WORK COMPLETED FROM PREVIOUS APPLICATION", "WORK COMPLETED THIS PERIOD",
    "MATERIALS PRESENTLY STORED", "TOTAL COMPLETED AND STORED",
    "% (G / C)", "Balance to Finish (C-G)", "RETAINAGE (If Variable Rate)",
    "Source Page", "Review Notes",
]

OUT_CSV = os.path.join(BASE_DIR, "gc_app12_line_items_v5.csv")
df_items = pd.DataFrame(merged_rows)
for col in COLUMN_ORDER:
    if col not in df_items.columns:
        df_items[col] = None
df_items = df_items[COLUMN_ORDER]
df_items.to_csv(OUT_CSV, index=False)

print(f"\nSaved → {OUT_CSV}  ({len(df_items)} rows)")

# ── Validation ─────────────────────────────────────────────────────────────────
PDF_GRAND_TOTAL = {
    "SCHEDULED CURRENT":                        1_315_907_474,
    "WORK COMPLETED FROM PREVIOUS APPLICATION": 375_728_020,
    "WORK COMPLETED THIS PERIOD":               45_715_866,
    "MATERIALS PRESENTLY STORED":               1_421_526,
    "TOTAL COMPLETED AND STORED":               422_865_412,
    "Balance to Finish (C-G)":                  893_042_062,
    "RETAINAGE (If Variable Rate)":             15_444_309,
}

print()
print("Validation:")
all_ok = True
for col, gt in PDF_GRAND_TOTAL.items():
    s = pd.to_numeric(df_items[col], errors="coerce").sum()
    diff = s - gt
    flag = "OK" if abs(diff) <= 10 else ("*** %.4f%% off" % (abs(diff)/gt*100))
    if abs(diff) > 10:
        all_ok = False
    print("  %-43s: %16s  GT=%16s  diff=%+12s  %s" % (col, f"{s:,.0f}", f"{gt:,}", f"{diff:,.0f}", flag))
print()
if all_ok:
    print("  ALL columns match PDF Grand Total (sub-0.001%). PRODUCTION QUALITY.")
