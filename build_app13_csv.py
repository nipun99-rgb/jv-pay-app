"""
Build gc_app13_line_items.csv from pdfplumber data.
Uses existing gc_app13_plumber_nums.json — no LLM needed.
Also calls the web app API to load the data into project 2.
"""
import json, re, csv, os

BASE    = r"C:\Users\KR614XU\Downloads\Ishaan"
PLUMBER = os.path.join(BASE, "gc_app13_plumber_nums.json")
OUT_CSV = os.path.join(BASE, "gc_app13_line_items.csv")

with open(PLUMBER) as f:
    plumber_data = json.load(f)

items = [i for i in plumber_data["items"] if i["item_no"] != "GRAND_TOTAL"]
print(f"Loaded {len(items)} items from pdfplumber")

def split_description(desc):
    """Split 'EARTHWORK & UTILITIES (LANDMARK)' → type='EARTHWORK & UTILITIES', contractor='LANDMARK'"""
    m = re.match(r'^(.*?)\s*\(([^)]+)\)\s*$', desc.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return desc.strip(), None

GENERIC_COST_CODES = {
    "UNCOMMITTED SUB COST", "GENERAL CONDITIONS", "GENERAL REQUIREMENTS",
    "BUILDERS RISK", "BUILDER'S RISK", "BUSINESS LICENSE", "BUSINESS LICENSE/PERMITS",
    "BUSINESS LICENSE-PERMITS", "BUSINESS LICENSE / PERMITS",
    "CCIP", "SDI", "FEE", "PERMITS", "PERMIT", "DESIGN ESCALATION",
    "CONTINGENCY", "FINAL CLEANING", "ALLOWANCES", "ALLOWANCE",
    "IMP", "PSQIC PROGRAM", "CONTINGENCY ALLOWANCE",
}

def safe_int(v):
    if v is None: return 0
    try: return int(round(float(v)))
    except: return 0

rows = []
for item in items:
    raw_desc = item.get("description", "")
    type_of_work, contractor = split_description(raw_desc)

    # If no parentheses and not a generic code, description IS the contractor
    if contractor is None:
        tow_upper = type_of_work.upper()
        if tow_upper not in GENERIC_COST_CODES and not tow_upper.startswith("ALLOWANCE"):
            contractor = type_of_work

    rows.append({
        "Item No.":                                  item["item_no"],
        "Time Period":                               "3/31/26",
        "Phases":                                    item.get("phase", ""),
        "Type of work":                              type_of_work,
        "Contractor name":                           contractor,
        "SCHEDULED ORIGINAL":                        safe_int(item.get("C_ORIG")),
        "SCHEDULED CHANGE ORDERS":                   safe_int(item.get("C_CO")),
        "SCHEDULED CURRENT":                         safe_int(item.get("C_CURR")),
        "WORK COMPLETED FROM PREVIOUS APPLICATION":  safe_int(item.get("D")),
        "WORK COMPLETED THIS PERIOD":                safe_int(item.get("E")),
        "MATERIALS PRESENTLY STORED":                safe_int(item.get("F")),
        "TOTAL COMPLETED AND STORED":                safe_int(item.get("G")),
        "% (G / C)":                                 item.get("pct", "0%"),
        "Balance to Finish (C-G)":                   safe_int(item.get("balance")),
        "RETAINAGE (If Variable Rate)":              safe_int(item.get("retainage")),
        "Source Page":                               item.get("page"),
        "Review Notes":                              item.get("review_notes", ""),
    })

COLUMN_ORDER = [
    "Item No.", "Time Period", "Phases", "Type of work", "Contractor name",
    "SCHEDULED ORIGINAL", "SCHEDULED CHANGE ORDERS", "SCHEDULED CURRENT",
    "WORK COMPLETED FROM PREVIOUS APPLICATION", "WORK COMPLETED THIS PERIOD",
    "MATERIALS PRESENTLY STORED", "TOTAL COMPLETED AND STORED",
    "% (G / C)", "Balance to Finish (C-G)", "RETAINAGE (If Variable Rate)",
    "Source Page", "Review Notes",
]

with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=COLUMN_ORDER)
    writer.writeheader()
    writer.writerows(rows)

print(f"Saved → {OUT_CSV}")
print(f"Rows: {len(rows)}")
print(f"Item range: {rows[0]['Item No.']} .. {rows[-1]['Item No.']}")

# Show sample
print("\nSample rows:")
for r in rows[:5]:
    print(f"  {r['Item No.']} | {r['Phases']} | {r['Type of work'][:40]} | Sched={r['SCHEDULED CURRENT']:,}")
