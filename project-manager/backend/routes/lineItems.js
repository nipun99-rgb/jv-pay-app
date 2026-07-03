const router = require("express").Router();
const { getDb, save, query, run } = require("../lib/db");

// GET /api/projects/:id/line-items
router.get("/:id/line-items", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM line_items WHERE project_id = ? ORDER BY id", [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/line-items
router.post("/:id/line-items", async (req, res) => {
  try {
    const db = await getDb();
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const cols = [
      "project_id","item_no","time_period","phases","type_of_work","contractor_name",
      "scheduled_original","scheduled_change_orders","scheduled_current",
      "work_completed_prev","work_completed_this","materials_stored",
      "total_completed","pct","balance_to_finish","retainage","source_page","review_notes"
    ];
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT INTO line_items (${cols.join(", ")}) VALUES (${placeholders})`;
    for (const item of items) {
      const vals = [
        req.params.id,
        item.item_no || null, item.time_period || null, item.phases || null,
        item.type_of_work || null, item.contractor_name || null,
        item.scheduled_original ?? 0, item.scheduled_change_orders ?? 0,
        item.scheduled_current ?? 0, item.work_completed_prev ?? 0,
        item.work_completed_this ?? 0, item.materials_stored ?? 0,
        item.total_completed ?? 0, item.pct || null,
        item.balance_to_finish ?? 0, item.retainage ?? 0,
        item.source_page || null, item.review_notes || null,
      ];
      run(db, sql, vals);
    }
    const rows = query(db, "SELECT * FROM line_items WHERE project_id = ? ORDER BY id", [req.params.id]);
    res.status(201).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:pid/line-items/:iid
router.put("/:pid/line-items/:iid", async (req, res) => {
  try {
    const db = await getDb();
    const fields = [
      "item_no","time_period","phases","type_of_work","contractor_name",
      "scheduled_original","scheduled_change_orders","scheduled_current",
      "work_completed_prev","work_completed_this","materials_stored",
      "total_completed","pct","balance_to_finish","retainage","source_page","review_notes",
      "validation_status","validation_note"
    ];
    const sets = [];
    const vals = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        vals.push(req.body[f]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });
    vals.push(req.params.iid, req.params.pid);
    run(db, `UPDATE line_items SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`, vals);
    const rows = query(db, "SELECT * FROM line_items WHERE id = ?", [req.params.iid]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:pid/line-items/:iid
router.delete("/:pid/line-items/:iid", async (req, res) => {
  try {
    const db = await getDb();
    run(db, "DELETE FROM line_items WHERE id = ? AND project_id = ?", [req.params.iid, req.params.pid]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id/line-items/:itemId — update extracted values
router.patch("/:id/line-items/:itemId", async (req, res) => {
  try {
    const db = await getDb();
    const { itemId } = req.params;
    const updates = req.body;
    const allowedFields = ["work_completed_this", "work_completed_prev", "materials_stored", "scheduled_current", "contractor_name"];
    const setClauses = [];
    const values = [];
    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        setClauses.push(`${field} = ?`);
        values.push(value);
      }
    }
    if (!setClauses.length) return res.status(400).json({ error: "No valid fields to update" });
    values.push(itemId);
    db.run(`UPDATE line_items SET ${setClauses.join(", ")} WHERE id = ?`, values);
    save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
