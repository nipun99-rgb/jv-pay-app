const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const { getDb, save, query, run } = require("../lib/db");
const { upload, UPLOAD_DIR } = require("../middleware/upload");
const { PDFDocument } = require("pdf-lib");

// GET /api/projects
router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post("/", async (req, res) => {
  const { name, baseline } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "Project name is required" });
  if (!baseline || !baseline.trim())
    return res.status(400).json({ error: "Project baseline is required" });
  try {
    const db = await getDb();
    run(db, "INSERT INTO projects (name, baseline) VALUES (?, ?)", [name.trim(), baseline.trim()]);
    const rows = query(db, "SELECT * FROM projects ORDER BY id DESC LIMIT 1");
    const project = rows[0];
    const defaultTasks = [
      [1, "Upload Payment Application"],
      [2, "OCR & Extraction"],
      [3, "Store Results"],
      [4, "Review & Validate"],
    ];
    for (const [step, taskName] of defaultTasks) {
      run(db, "INSERT INTO tasks (project_id, step_number, step_name) VALUES (?, ?, ?)", [project.id, step, taskName]);
    }
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete("/:id", async (req, res) => {
  try {
    const db = await getDb();
    const before = query(db, "SELECT id FROM projects WHERE id = ?", [req.params.id]);
    if (before.length === 0) return res.status(404).json({ error: "Project not found" });
    run(db, "DELETE FROM line_items WHERE project_id = ?", [req.params.id]);
    run(db, "DELETE FROM logs WHERE project_id = ?", [req.params.id]);
    run(db, "DELETE FROM tasks WHERE project_id = ?", [req.params.id]);
    run(db, "DELETE FROM projects WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id
router.patch("/:id", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
    const { name, baseline, pdf_path } = req.body;
    if (name !== undefined) run(db, "UPDATE projects SET name = ? WHERE id = ?", [name.trim(), req.params.id]);
    if (baseline !== undefined) run(db, "UPDATE projects SET baseline = ? WHERE id = ?", [baseline.trim(), req.params.id]);
    if (pdf_path !== undefined) run(db, "UPDATE projects SET pdf_path = ? WHERE id = ?", [pdf_path.trim(), req.params.id]);
    const updated = query(db, "SELECT * FROM projects WHERE id = ?", [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/upload-pdf
router.post("/:id/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" });
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Project not found" });
    }
    const oldPath = rows[0].pdf_path;
    if (oldPath && oldPath.startsWith(UPLOAD_DIR) && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
    const savedPath = req.file.path;
    run(db, "UPDATE projects SET pdf_path = ? WHERE id = ?", [savedPath, req.params.id]);
    const updated = query(db, "SELECT * FROM projects WHERE id = ?", [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/pdf
router.get("/:id/pdf", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT pdf_path FROM projects WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
    const pdfPath = rows[0].pdf_path;
    if (!pdfPath || !fs.existsSync(pdfPath))
      return res.status(404).json({ error: "PDF not configured or file not found" });
    const resolvedPath = path.resolve(pdfPath);
    const resolvedBase = path.resolve(UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedBase)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(pdfPath)}"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/sub-pdf
router.get("/:id/sub-pdf", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT pdf_path FROM project_phases WHERE project_id = ? AND phase_number = 2", [req.params.id]);
    if (rows.length === 0 || !rows[0].pdf_path)
      return res.status(404).json({ error: "No subcontractor PDF found" });
    const pdfPath = rows[0].pdf_path;
    if (!fs.existsSync(pdfPath))
      return res.status(404).json({ error: "PDF file not found on disk" });
    const resolvedPath = path.resolve(pdfPath);
    const resolvedBase = path.resolve(UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedBase)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"subcontractor.pdf\"");
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/pdf/pages
router.get("/:id/pdf/pages", async (req, res) => {
  try {
    const db = await getDb();
    let pdfPath;
    if (req.query.src === "sub") {
      const rows = query(db, "SELECT pdf_path FROM project_phases WHERE project_id=? AND phase_number=2", [req.params.id]);
      if (!rows.length || !rows[0].pdf_path) return res.status(404).json({ error: "No subcontractor PDF" });
      pdfPath = rows[0].pdf_path;
    } else {
      const rows = query(db, "SELECT pdf_path FROM projects WHERE id = ?", [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
      pdfPath = rows[0].pdf_path;
    }
    if (!pdfPath || !fs.existsSync(pdfPath))
      return res.status(404).json({ error: "PDF not configured or file not found" });
    const resolvedPath = path.resolve(pdfPath);
    const resolvedBase = path.resolve(UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedBase)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const from = Math.max(1, parseInt(req.query.from) || 1);
    const to = parseInt(req.query.to) || from;
    const pdfBytes = fs.readFileSync(pdfPath);
    const srcDoc = await PDFDocument.load(pdfBytes);
    const totalPages = srcDoc.getPageCount();
    const fromIdx = Math.min(from, totalPages) - 1;
    const toIdx = Math.min(to, totalPages) - 1;
    const newDoc = await PDFDocument.create();
    const indices = [];
    for (let i = fromIdx; i <= toIdx; i++) indices.push(i);
    const copiedPages = await newDoc.copyPages(srcDoc, indices);
    copiedPages.forEach((p) => newDoc.addPage(p));
    const outBytes = await newDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="pages_${from}-${to}.pdf"`);
    res.send(Buffer.from(outBytes));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/phases
router.get("/:id/phases", async (req, res) => {
  try {
    const db = await getDb();
    const projId = parseInt(req.params.id);
    const existing = query(db, "SELECT * FROM project_phases WHERE project_id = ? ORDER BY phase_number", [projId]);
    if (existing.length === 0) {
      const defaultPhases = [
        { num: 1, name: "Contractor Payment Application" },
        { num: 2, name: "Subcontractor Payment Application" },
        { num: 3, name: "GC GR" },
      ];
      for (const p of defaultPhases) {
        run(db, "INSERT OR IGNORE INTO project_phases (project_id, phase_number, phase_name, status) VALUES (?,?,?,?)",
          [projId, p.num, p.name, "pending"]);
      }
      const items = query(db, "SELECT COUNT(*) as cnt FROM line_items WHERE project_id = ?", [projId]);
      if (items[0]?.cnt > 0) {
        run(db, "UPDATE project_phases SET status='complete', item_count=? WHERE project_id=? AND phase_number=1",
          [items[0].cnt, projId]);
      }
      return res.json(query(db, "SELECT * FROM project_phases WHERE project_id = ? ORDER BY phase_number", [projId]));
    }
    const items = query(db, "SELECT COUNT(*) as cnt FROM line_items WHERE project_id = ?", [projId]);
    if (items[0]?.cnt > 0) {
      run(db, "UPDATE project_phases SET status='complete', item_count=? WHERE project_id=? AND phase_number=1",
        [items[0].cnt, projId]);
    }
    res.json(existing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
