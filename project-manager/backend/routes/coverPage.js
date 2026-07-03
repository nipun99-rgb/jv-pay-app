const router = require("express").Router();
const { getDb, save, query, run } = require("../lib/db");

// GET /api/projects/:id/cover-page
router.get("/:id/cover-page", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM cover_page WHERE project_id = ?", [req.params.id]);
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/cover-page
router.put("/:id/cover-page", async (req, res) => {
  try {
    const db = await getDb();
    const allowed = [
      "to_owner","from_contractor","project_name","application_no","period",
      "original_contract_sum","net_change_orders","contract_sum_to_date",
      "total_completed_stored","retainage_completed","retainage_materials",
      "total_retainage","total_earned_less_ret","less_prev_certificates",
      "current_payment_due","balance_to_finish","change_order_summary",
      "architect_signature","contractor_signature","review_notes"
    ];
    const sets = [];
    const vals = [];
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        vals.push(req.body[f]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "No fields" });
    vals.push(req.params.id);
    run(db, `UPDATE cover_page SET ${sets.join(", ")} WHERE project_id = ?`, vals);
    const rows = query(db, "SELECT * FROM cover_page WHERE project_id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
