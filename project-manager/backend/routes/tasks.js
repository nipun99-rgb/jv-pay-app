const router = require("express").Router();
const { getDb, save, query, run } = require("../lib/db");

// GET /api/projects/:id/tasks
router.get("/:id/tasks", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM tasks WHERE project_id = ? ORDER BY step_number", [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/tasks/init
router.post("/:id/tasks/init", async (req, res) => {
  try {
    const db = await getDb();
    const existing = query(db, "SELECT id FROM tasks WHERE project_id = ?", [req.params.id]);
    if (existing.length > 0) return res.json({ message: "Tasks already exist" });
    const defaults = [
      [1, "Upload Payment Application"],
      [2, "OCR & Extraction"],
      [3, "Store Results"],
      [4, "Review & Validate"],
    ];
    for (const [step, name] of defaults) {
      run(db, "INSERT INTO tasks (project_id, step_number, step_name) VALUES (?, ?, ?)", [req.params.id, step, name]);
    }
    const rows = query(db, "SELECT * FROM tasks WHERE project_id = ? ORDER BY step_number", [req.params.id]);
    res.status(201).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:pid/tasks/:tid
router.patch("/:pid/tasks/:tid", async (req, res) => {
  try {
    const db = await getDb();
    const { status } = req.body;
    if (!["pending", "running", "complete", "error"].includes(status))
      return res.status(400).json({ error: "Invalid status" });
    run(db, "UPDATE tasks SET status = ? WHERE id = ? AND project_id = ?", [status, req.params.tid, req.params.pid]);
    const rows = query(db, "SELECT * FROM tasks WHERE id = ?", [req.params.tid]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
