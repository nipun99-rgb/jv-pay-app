const router = require("express").Router();
const { getDb, save, query, run } = require("../lib/db");

// GET /api/projects/:id/logs
router.get("/:id/logs", async (req, res) => {
  try {
    const db = await getDb();
    const after = parseInt(req.query.after) || 0;
    const rows = query(db, "SELECT * FROM logs WHERE project_id = ? AND id > ? ORDER BY id ASC", [req.params.id, after]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/logs
router.post("/:id/logs", async (req, res) => {
  try {
    const db = await getDb();
    const entries = Array.isArray(req.body) ? req.body : [req.body];
    for (const entry of entries) {
      const level = ["info", "success", "warn", "error", "step", "progress"].includes(entry.level)
        ? entry.level : "info";
      const message = String(entry.message || "").slice(0, 2000);
      if (message) {
        run(db, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)", [req.params.id, level, message]);
      }
    }
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id/logs
router.delete("/:id/logs", async (req, res) => {
  try {
    const db = await getDb();
    run(db, "DELETE FROM logs WHERE project_id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
