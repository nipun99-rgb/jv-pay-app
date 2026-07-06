"""
Direct re-extraction of G703 SOV for a package, bypassing the graph checkpoint.
Usage: python scripts/reextract_sov.py <package_id>
"""
import sys, os, logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger(__name__)

pkg_id = sys.argv[1] if len(sys.argv) > 1 else None
if not pkg_id:
    print("Usage: python scripts/reextract_sov.py <package_id>")
    sys.exit(1)

# Load env
for line in open(os.path.join(os.path.dirname(__file__), '../.env')):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

import httpx

gw = os.environ.get("API_GATEWAY_URL", "http://localhost:3001")

# Get package docs
resp = httpx.get(f"{gw}/api/packages/{pkg_id}", timeout=10)
resp.raise_for_status()
docs = resp.json().get("documents", [])
gc_doc = next((d for d in docs if d.get("fileType") in ("GC_PAY_APP", "GC_G702")), None)
if not gc_doc:
    logger.error("No GC_PAY_APP document found for package %s", pkg_id)
    sys.exit(1)

logger.info("GC doc: %s  blob: %s", gc_doc["filename"], gc_doc["blobName"])

from app.agents.tools.coordinate_tools import extract_g703_with_coordinates
from app.agents.tools.doc_intelligence_tools import extract_table_with_document_intelligence
from app.agents.tools.db_tools import save_gc_sov_lines

def quality_ok(lns):
    if not lns:
        return False
    item_no_filled = sum(1 for l in lns if l.get("item_no"))
    sched_ok = sum(1 for l in lns if (l.get("scheduled_original") or 0) > 1000)
    logger.info("Quality: item_no=%d/%d  sched_ok=%d/%d", item_no_filled, len(lns), sched_ok, len(lns))
    return item_no_filled / len(lns) > 0.3 and sched_ok / len(lns) > 0.1

lines = []

# Method 1: Document Intelligence
logger.info("=== Method 1: Azure Document Intelligence ===")
di = extract_table_with_document_intelligence.invoke({"blob_url": gc_doc["blobUrl"], "package_id": pkg_id})
di_lines = di.get("sov_lines", [])
logger.info("Doc Intelligence: %d lines (method=%s)", len(di_lines), di.get("method"))
if di_lines:
    for l in di_lines[:3]:
        logger.info("  Sample: itemNo=%s phases=%s typeOfWork=%s sched=%s",
                    l.get('item_no'), l.get('phases'), str(l.get('type_of_work',''))[:30], l.get('scheduled_original'))

if len(di_lines) >= 50 and quality_ok(di_lines):
    logger.info("Using Document Intelligence results")
    lines = di_lines
else:
    # Method 2: Coordinate extraction
    logger.info("=== Method 2: Coordinate Extraction ===")
    coord = extract_g703_with_coordinates.invoke({"blob_url": gc_doc["blobUrl"], "package_id": pkg_id})
    coord_lines = coord.get("lines", [])
    logger.info("Coordinate: %d lines", len(coord_lines))
    if coord_lines:
        for l in coord_lines[:3]:
            logger.info("  Sample: itemNo=%s phases=%s typeOfWork=%s sched=%s",
                        l.get('item_no'), l.get('phases'), str(l.get('type_of_work',''))[:30], l.get('scheduled_original'))

    if len(coord_lines) >= 100 and quality_ok(coord_lines):
        logger.info("Using coordinate extraction results")
        lines = coord_lines
    else:
        # Method 3: Parallel vision
        logger.info("=== Method 3: Parallel Vision Fallback ===")
        from app.agents.tools.parallel_vision_tools import extract_all_sov_pages_parallel
        vis = extract_all_sov_pages_parallel.invoke({"package_id": pkg_id, "start_page": 2, "end_page": 12})
        vis_lines = vis.get("lines", [])
        logger.info("Parallel vision: %d lines", len(vis_lines))
        lines = vis_lines if vis_lines else coord_lines

# Fix and save
fixed = []
for l in lines:
    row = dict(l)
    pct = row.get("pct")
    if isinstance(pct, float) and abs(pct) > 1.1:
        row["pct"] = min(pct / 100.0, 1.0)
    for sf, ml in [("item_no", 50), ("time_period", 50), ("phases", 200), ("type_of_work", 500), ("contractor_name", 255)]:
        v = row.get(sf)
        if isinstance(v, str) and len(v) > ml:
            row[sf] = v[:ml]
    fixed.append(row)

# ── Auto-reconciliation (same logic as pipeline) ──────────────────────────────
col_shift, math_err, bal_err = 0, 0, 0
for row in fixed:
    # Fix 1: Column shift
    if not row.get("scheduled_original") and row.get("scheduled_change_orders"):
        orig = float(row["scheduled_change_orders"])
        curr = float(row.get("scheduled_current") or 0)
        row["scheduled_original"] = orig
        if curr < orig * 0.9:
            row["scheduled_current"] = orig
        row["scheduled_change_orders"] = None
        col_shift += 1

    # Fix 2: totalCompleted stored as pct decimal instead of $ amount
    dep = (float(row.get("work_completed_prev") or 0) +
           float(row.get("work_completed_this") or 0) +
           float(row.get("materials_stored") or 0))
    stored = float(row.get("total_completed") or 0)
    if dep > 1000 and stored < 10 and stored > 0:
        row["total_completed"] = round(dep, 2)
        math_err += 1
    elif dep > 0 and not row.get("total_completed"):
        row["total_completed"] = round(dep, 2)

    # Fix 3: balanceToFinish = scheduledCurrent - totalCompleted
    sched_curr = float(row.get("scheduled_current") or 0)
    tot_comp = float(row.get("total_completed") or 0)
    if sched_curr > 0:
        correct_bal = round(sched_curr - tot_comp, 2)
        if abs(correct_bal - float(row.get("balance_to_finish") or 0)) > 500:
            row["balance_to_finish"] = correct_bal
            bal_err += 1

logger.info("Auto-reconcile: %d column shifts, %d math errors, %d balance recalcs fixed",
            col_shift, math_err, bal_err)

if fixed:
    logger.info("Saving %d lines (%d auto-corrected)...", len(fixed), col_shift + math_err + bal_err)
    save_gc_sov_lines.invoke({"package_id": pkg_id, "lines": fixed})
    logger.info("Done. %d SOV lines saved.", len(fixed))
else:
    logger.error("No lines to save!")
