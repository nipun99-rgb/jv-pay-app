const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { PDFDocument } = require("pdf-lib");
const { getDb, save } = require("./db");

const app = express();
const PORT = 3001;

// Uploads directory
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e4);
      cb(null, unique + "-" + file.originalname);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "50mb" }));

// Helper: run a SELECT and return rows as plain objects
function query(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const result = stmt.getAsObject
    ? null  // handled below
    : null;
  const rows = [];
  stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run INSERT/UPDATE/DELETE
function run(db, sql, params = []) {
  db.run(sql, params);
  save();
}

// ── GET /api/projects ─────────────────────────────────────────────────────────
app.get("/api/projects", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────────
app.get("/api/projects/:id", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects ────────────────────────────────────────────────────────
app.post("/api/projects", async (req, res) => {
  const { name, baseline } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ error: "Project name is required" });
  if (!baseline || !baseline.trim())
    return res.status(400).json({ error: "Project baseline is required" });
  try {
    const db = await getDb();
    run(db, "INSERT INTO projects (name, baseline) VALUES (?, ?)", [
      name.trim(),
      baseline.trim(),
    ]);
    const rows = query(db, "SELECT * FROM projects ORDER BY id DESC LIMIT 1");
    const project = rows[0];

    // Create default pipeline tasks
    const defaultTasks = [
      [1, "Upload Payment Application"],
      [2, "OCR & Extraction"],
      [3, "Store Results"],
      [4, "Review & Validate"],
    ];
    for (const [step, name] of defaultTasks) {
      run(db, "INSERT INTO tasks (project_id, step_number, step_name) VALUES (?, ?, ?)", [
        project.id, step, name,
      ]);
    }

    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/projects/:id ──────────────────────────────────────────────────
app.delete("/api/projects/:id", async (req, res) => {
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

// ── PATCH /api/projects/:id — update project (pdf_path, name, baseline) ──────
app.patch("/api/projects/:id", async (req, res) => {
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

// ── POST /api/projects/:id/upload-pdf — upload a PDF file ───────────────────
app.post("/api/projects/:id/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" });
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Project not found" });
    }
    // Delete old uploaded PDF if it exists in uploads folder
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

// ── GET /api/projects/:id/pdf — serve the PDF file ───────────────────────────
app.get("/api/projects/:id/pdf", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT pdf_path FROM projects WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
    const pdfPath = rows[0].pdf_path;
    if (!pdfPath || !fs.existsSync(pdfPath))
      return res.status(404).json({ error: "PDF not configured or file not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(pdfPath)}"`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:id/sub-pdf — serve the subcontractor PDF file ────────
app.get("/api/projects/:id/sub-pdf", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT pdf_path FROM project_phases WHERE project_id = ? AND phase_number = 2", [req.params.id]);
    if (rows.length === 0 || !rows[0].pdf_path)
      return res.status(404).json({ error: "No subcontractor PDF found" });
    const pdfPath = rows[0].pdf_path;
    if (!fs.existsSync(pdfPath))
      return res.status(404).json({ error: "PDF file not found on disk" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"subcontractor.pdf\"");
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:id/pdf/pages?from=1&to=1 — serve specific page range ─
app.get("/api/projects/:id/pdf/pages", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT pdf_path FROM projects WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
    const pdfPath = rows[0].pdf_path;
    if (!pdfPath || !fs.existsSync(pdfPath))
      return res.status(404).json({ error: "PDF not configured or file not found" });

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

// ══════════════════════════════════════════════════════════════════════════════
// TASKS
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/projects/:id/tasks ──────────────────────────────────────────────
app.get("/api/projects/:id/tasks", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM tasks WHERE project_id = ? ORDER BY step_number", [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects/:id/tasks/init — create default tasks if none exist ──
app.post("/api/projects/:id/tasks/init", async (req, res) => {
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
      run(db, "INSERT INTO tasks (project_id, step_number, step_name) VALUES (?, ?, ?)", [
        req.params.id, step, name,
      ]);
    }
    const rows = query(db, "SELECT * FROM tasks WHERE project_id = ? ORDER BY step_number", [req.params.id]);
    res.status(201).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/projects/:pid/tasks/:tid — update status ─────────────────────
app.patch("/api/projects/:pid/tasks/:tid", async (req, res) => {
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

// ══════════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/projects/:id/cover-page ─────────────────────────────────────────
app.get("/api/projects/:id/cover-page", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM cover_page WHERE project_id = ?", [req.params.id]);
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/projects/:id/cover-page — update a field ────────────────────────
app.put("/api/projects/:id/cover-page", async (req, res) => {
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

// ══════════════════════════════════════════════════════════════════════════════
// LINE ITEMS
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/projects/:id/line-items ─────────────────────────────────────────
app.get("/api/projects/:id/line-items", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM line_items WHERE project_id = ? ORDER BY id", [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects/:id/line-items — add one or many ─────────────────────
app.post("/api/projects/:id/line-items", async (req, res) => {
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

// ── PUT /api/projects/:pid/line-items/:iid — update one ─────────────────────
app.put("/api/projects/:pid/line-items/:iid", async (req, res) => {
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

// ── DELETE /api/projects/:pid/line-items/:iid ───────────────────────────────
app.delete("/api/projects/:pid/line-items/:iid", async (req, res) => {
  try {
    const db = await getDb();
    run(db, "DELETE FROM line_items WHERE id = ? AND project_id = ?", [req.params.iid, req.params.pid]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGS — real-time output panel
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/projects/:id/logs — get logs (optionally after a given id) ──────
app.get("/api/projects/:id/logs", async (req, res) => {
  try {
    const db = await getDb();
    const after = parseInt(req.query.after) || 0;
    const rows = query(
      db,
      "SELECT * FROM logs WHERE project_id = ? AND id > ? ORDER BY id ASC",
      [req.params.id, after]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/projects/:id/logs — add one or more log entries ────────────────
app.post("/api/projects/:id/logs", async (req, res) => {
  try {
    const db = await getDb();
    const entries = Array.isArray(req.body) ? req.body : [req.body];
    for (const entry of entries) {
      const level = ["info", "success", "warn", "error", "step", "progress"].includes(entry.level)
        ? entry.level
        : "info";
      const message = String(entry.message || "").slice(0, 2000);
      if (message) {
        run(db, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)", [
          req.params.id, level, message,
        ]);
      }
    }
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/projects/:id/logs — clear all logs for a project ─────────────
app.delete("/api/projects/:id/logs", async (req, res) => {
  try {
    const db = await getDb();
    run(db, "DELETE FROM logs WHERE project_id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// RUN PIPELINE — trigger extraction process (loads real CSV data)
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/projects/:id/run-pipeline", async (req, res) => {
  const projectId = req.params.id;
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects WHERE id = ?", [projectId]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
    const project = rows[0];
    if (!project.pdf_path) return res.status(400).json({ error: "No PDF uploaded" });

    // Respond immediately — pipeline runs in background
    res.json({ success: true, message: "Pipeline started" });

    // Helper to log + delay
    const log = (level, message) => {
      run(db, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)", [projectId, level, message]);
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // ── Step 2: OCR & Extraction ───────────────────────────────────────────
    run(db, "UPDATE tasks SET status = 'running' WHERE project_id = ? AND step_number = 2", [projectId]);
    log("step", "Starting OCR & Extraction…");
    await wait(800);
    log("info", `PDF: ${path.basename(project.pdf_path)}`);
    await wait(600);
    log("progress", "Running pdfplumber extraction on uploaded PDF…");

    // Auto-extract CSV from the uploaded PDF using extract_g703.py
    const projectCsvName = `gc_app${project.id}_line_items.csv`;
    const projectCsvPath = path.join(__dirname, "..", "..", projectCsvName);
    const extractScript  = path.join(__dirname, "extract_g703.py");
    const PYTHON_EXE_LIST = [
      "C:\\Users\\KR614XU\\AppData\\Local\\Python\\bin\\python.exe",
      "python3", "python",
    ];

    // Run extraction if CSV doesn't exist or is stale vs the PDF
    const pdfMtime  = fs.existsSync(project.pdf_path) ? fs.statSync(project.pdf_path).mtimeMs : 0;
    const csvMtime  = fs.existsSync(projectCsvPath)   ? fs.statSync(projectCsvPath).mtimeMs   : 0;
    const needExtract = !fs.existsSync(projectCsvPath) || csvMtime < pdfMtime;

    if (needExtract) {
      if (!fs.existsSync(project.pdf_path)) {
        log("error", "PDF file not found on disk — please re-upload.");
        run(db, "UPDATE tasks SET status = 'error' WHERE project_id = ? AND step_number = 2", [projectId]);
        return;
      }
      log("progress", "Extracting G703 line items from PDF (pdfplumber)…");
      const { execFile } = require("child_process");
      const tryPy = (exe) => new Promise((resolve) => {
        execFile(exe, [extractScript, project.pdf_path, projectCsvPath], { timeout: 120000 }, (err, stdout, stderr) => {
          if (err) return resolve(null);
          const m = stdout.match(/DONE:(\d+)/);
          resolve(m ? parseInt(m[1]) : null);
        });
      });
      let extracted = null;
      for (const exe of PYTHON_EXE_LIST) {
        extracted = await tryPy(exe);
        if (extracted !== null) break;
      }
      if (!extracted || extracted < 1) {
        log("error", "pdfplumber extraction failed — check that pdfplumber is installed (pip install pdfplumber).");
        run(db, "UPDATE tasks SET status = 'error' WHERE project_id = ? AND step_number = 2", [projectId]);
        return;
      }
      log("success", `Extracted ${extracted} line items from PDF ✓`);
    } else {
      log("info", "Using cached extraction (PDF unchanged)");
    }

    const CSV_PATH = projectCsvPath;

    // Parse CSV
    const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
    const csvLines = csvContent.split("\n").filter((l) => l.trim());
    const headers = parseCSVLine(csvLines[0]);
    const dataRows = [];
    for (let i = 1; i < csvLines.length; i++) {
      const vals = parseCSVLine(csvLines[i]);
      if (vals.length < 5) continue; // skip malformed
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = vals[idx] || ""; });
      dataRows.push(obj);
    }

    const pageCount = new Set(dataRows.map((r) => r["Source Page"])).size;
    log("info", `Pages detected: ${pageCount}`);
    await wait(800);
    log("progress", "Extracting line items from OCR results…");
    await wait(1500);
    log("info", `Found ${dataRows.length} line items across ${pageCount} pages`);
    await wait(600);
    log("success", "OCR & Extraction complete ✓");
    run(db, "UPDATE tasks SET status = 'complete' WHERE project_id = ? AND step_number = 2", [projectId]);

    // ── Step 3: Store Results ──────────────────────────────────────────────
    await wait(500);
    run(db, "UPDATE tasks SET status = 'running' WHERE project_id = ? AND step_number = 3", [projectId]);
    log("step", "Storing results in database…");
    await wait(800);

    // Clear existing line items for this project
    run(db, "DELETE FROM line_items WHERE project_id = ?", [projectId]);

    const toNum = (v) => {
      if (!v || v === "" || v === "null") return 0;
      const n = parseFloat(String(v).replace(/,/g, ""));
      return isNaN(n) ? 0 : n;
    };

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      run(db,
        `INSERT INTO line_items (project_id, item_no, time_period, phases, type_of_work, contractor_name,
         scheduled_original, scheduled_change_orders, scheduled_current,
         work_completed_prev, work_completed_this, materials_stored,
         total_completed, pct, balance_to_finish, retainage, source_page, review_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          r["Item No."] || null,
          r["Time Period"] || null,
          r["Phases"] || null,
          r["Type of work"] || null,
          r["Contractor name"] || null,
          toNum(r["SCHEDULED ORIGINAL"]),
          toNum(r["SCHEDULED CHANGE ORDERS"]),
          toNum(r["SCHEDULED CURRENT"]),
          toNum(r["WORK COMPLETED FROM PREVIOUS APPLICATION"]),
          toNum(r["WORK COMPLETED THIS PERIOD"]),
          toNum(r["MATERIALS PRESENTLY STORED"]),
          toNum(r["TOTAL COMPLETED AND STORED"]),
          r["% (G / C)"] || "0%",
          toNum(r["Balance to Finish (C-G)"]),
          toNum(r["RETAINAGE (If Variable Rate)"]),
          parseInt(r["Source Page"]) || null,
          r["Review Notes"] || null,
        ]
      );

      // Log progress every 30 items
      if (i > 0 && i % 30 === 0) {
        await wait(300);
        log("progress", `Stored ${i} of ${dataRows.length} items…`);
      }
    }

    await wait(600);
    log("success", `Stored ${dataRows.length} line items ✓`);
    run(db, "UPDATE tasks SET status = 'complete' WHERE project_id = ? AND step_number = 3", [projectId]);

    // ── Also load cover page data ─────────────────────────────────────────
    const COVER_CSV_PATH = path.join(__dirname, "..", "..", "gc_app12_cover_v2.csv");
    if (fs.existsSync(COVER_CSV_PATH)) {
      const coverContent = fs.readFileSync(COVER_CSV_PATH, "utf-8");
      const coverLines = coverContent.split("\n").filter((l) => l.trim());
      if (coverLines.length >= 2) {
        const cHeaders = parseCSVLine(coverLines[0]);
        const cVals = parseCSVLine(coverLines[1]);
        const c = {};
        cHeaders.forEach((h, i) => { c[h] = cVals[i] || ""; });

        const toNum = (v) => { const n = parseFloat(String(v).replace(/,/g, "")); return isNaN(n) ? 0 : n; };

        // Upsert cover page
        run(db, "DELETE FROM cover_page WHERE project_id = ?", [projectId]);
        run(db,
          `INSERT INTO cover_page (project_id, to_owner, from_contractor, project_name, application_no, period,
           original_contract_sum, net_change_orders, contract_sum_to_date, total_completed_stored,
           retainage_completed, retainage_materials, total_retainage, total_earned_less_ret,
           less_prev_certificates, current_payment_due, balance_to_finish,
           change_order_summary, architect_signature, contractor_signature, source_page, review_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            c["To Owner"] || null,
            c["From Contractor"] || null,
            c["Project Name"] || null,
            c["Payment Application/Invoice No."] || null,
            c["Payment Application Period"] || null,
            toNum(c["Original Contract Sum"]),
            toNum(c["Net Change by Change Orders"]),
            toNum(c["Contract Sum to Date"]),
            toNum(c["Total Completed & Stored to Date"]),
            toNum(c["Retainage on Completed Work"]),
            toNum(c["Retainage on Stored Materials"]),
            toNum(c["Total Retainage"]),
            toNum(c["Total Earned Less Retainage"]),
            toNum(c["Less Previous Certificates for Payment"]),
            toNum(c["Current Payment Due"]),
            toNum(c["Balance to Finish Including Retainage"]),
            c["Change Order Summary"] || null,
            c["Architect's Signature Present"] || null,
            c["Contractor's Signature Present"] || null,
            parseInt(c["Source Page"]) || 1,
            c["Review Notes"] || null,
          ]
        );
        log("info", "Cover page (G702) data stored ✓");
      }
    }

    // ── Step 4: Ready for validation ───────────────────────────────────────
    await wait(500);
    run(db, "UPDATE tasks SET status = 'complete' WHERE project_id = ? AND step_number = 4", [projectId]);
    log("step", "Pipeline complete — ready for validation");
    log("success", `All 4 steps finished. ${dataRows.length} line items ready for review.`);

  } catch (err) {
    const db = await getDb();
    run(db, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)", [projectId, "error", `Pipeline failed: ${err.message}`]);
  }
});

// CSV line parser (handles quoted fields with commas)
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// AI VALIDATION — Azure GPT-5.4 Vision validates extracted data against PDF images
// Uses pre-cached page images from the notebook (gc_app12_page_images.json)
// ══════════════════════════════════════════════════════════════════════════════

// Azure OpenAI configuration — uses the same endpoint as the extractor notebook
const AZURE_OAI_ENDPOINT   = process.env.AOAI_ENDPOINT || "";
const AZURE_OAI_KEY        = process.env.AOAI_KEY || "";
const AZURE_OAI_DEPLOYMENT = "gpt-5.4";
const VALIDATION_CONCURRENCY = 3; // pages validated in parallel

// Per-project image cache: { projectId -> { "1": "base64...", ... } }
const _pageImagesCacheMap = {};

// Python executables to try (in order)
const PYTHON_CANDIDATES = [
  "C:\\Users\\KR614XU\\AppData\\Local\\Python\\bin\\python.exe",
  "python3",
  "python",
];

async function ensurePageImages(projectId, pdfPath, logFn) {
  // 1. Already in memory
  if (_pageImagesCacheMap[projectId]) return _pageImagesCacheMap[projectId];

  // 2. Project-specific cache file on disk
  const cacheFile = path.join(__dirname, "..", "..", `gc_app${projectId}_page_images.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      _pageImagesCacheMap[projectId] = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      return _pageImagesCacheMap[projectId];
    } catch (e) { /* fall through */ }
  }

  // 3. Render on-demand from the uploaded PDF
  if (!pdfPath || !fs.existsSync(pdfPath)) return null;

  if (logFn) logFn("progress", "📄 Rendering PDF pages for AI validation (first time — please wait)…");

  const pyCode = `
import fitz, json, base64, sys
pdf_path = sys.argv[1]
out_path  = sys.argv[2]
doc = fitz.open(pdf_path)
pages = {}
for i, page in enumerate(doc):
    try:
        mat = fitz.Matrix(200/72, 200/72)
        pix = page.get_pixmap(matrix=mat)
        if pix.colorspace and pix.colorspace.name not in ('DeviceRGB', 'RGB'):
            pix = fitz.Pixmap(fitz.csRGB, pix)
        if pix.alpha:
            pix = fitz.Pixmap(pix, 0)
        jpeg_bytes = pix.tobytes('jpeg')
        pages[str(i+1)] = base64.b64encode(jpeg_bytes).decode()
    except Exception as e:
        sys.stderr.write(f'WARNING: page {i+1} failed: {e}\\n')
with open(out_path, 'w') as f:
    json.dump(pages, f)
print(f'DONE:{len(pages)}')
`.trim();

  const pyScriptPath = path.join(__dirname, "_render_pages_tmp.py");
  fs.writeFileSync(pyScriptPath, pyCode);

  // Find working Python executable
  const { execFile } = require("child_process");
  const tryPython = (exe) => new Promise((resolve) => {
    execFile(exe, [pyScriptPath, pdfPath, cacheFile], { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return resolve(null);
      const match = stdout.match(/DONE:(\d+)/);
      resolve(match ? parseInt(match[1]) : null);
    });
  });

  let pageCount = null;
  for (const exe of PYTHON_CANDIDATES) {
    pageCount = await tryPython(exe);
    if (pageCount !== null) break;
  }

  try { fs.unlinkSync(pyScriptPath); } catch (e) { /* ignore */ }

  // Each project is strictly isolated — never borrow images from another project
  const goodPageCount = pageCount && pageCount > 1 ? pageCount : 0;

  if (!goodPageCount) {
    if (logFn) logFn("error", "Could not render PDF pages — PDF may be corrupted or Python/pymupdf not available.");
    return null;
  }

  if (goodPageCount && logFn) logFn("success", `Rendered ${pageCount} pages from PDF ✓`);

  try {
    _pageImagesCacheMap[projectId] = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    return _pageImagesCacheMap[projectId];
  } catch (e) {
    return null;
  }
}

app.post("/api/projects/:id/validate-ai", async (req, res) => {
  const projectId = req.params.id;

  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects WHERE id = ?", [projectId]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });

    // Respond immediately — validation runs in background
    res.json({ success: true, message: "AI validation started" });

    const log = (level, message) => {
      run(db, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)", [projectId, level, message]);
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    log("step", "🤖 Azure AI Validation Agent starting…");
    await wait(300);
    log("info", `Model: ${AZURE_OAI_DEPLOYMENT} (GPT-5.4 Vision)`);
    await wait(200);

    // Load (or render on-demand) page images for this project
    const pageImages = await ensurePageImages(projectId, rows[0].pdf_path, log);
    if (!pageImages) {
      log("error", "Could not load page images. Upload a PDF and ensure Python/pymupdf is available.");
      return;
    }
    const cachedPageCount = Object.keys(pageImages).length;
    log("success", `Loaded ${cachedPageCount} page images ✓`);
    await wait(200);

    // Get all line items grouped by source page
    const items = query(db, "SELECT * FROM line_items WHERE project_id = ? ORDER BY source_page, id", [projectId]);
    if (items.length === 0) {
      log("warn", "No line items to validate");
      return;
    }

    // Mark all as "checking"
    run(db, "UPDATE line_items SET validation_status = 'checking' WHERE project_id = ?", [projectId]);

    const pageGroups = {};
    for (const item of items) {
      const pg = String(item.source_page || 0);
      if (!pageGroups[pg]) pageGroups[pg] = [];
      pageGroups[pg].push(item);
    }

    const pages = Object.keys(pageGroups).sort((a, b) => Number(a) - Number(b));
    log("info", `Validating ${items.length} items across ${pages.length} pages…`);
    log("info", `Running ${VALIDATION_CONCURRENCY} pages in parallel for speed`);
    await wait(300);

    // Initialize OpenAI client (Azure endpoint, OpenAI-compatible)
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      baseURL: AZURE_OAI_ENDPOINT,
      apiKey: AZURE_OAI_KEY,
    });

    const SYSTEM_PROMPT = `You are a construction payment application auditor verifying extracted G703 Continuation Sheet data against the original PDF.

COLUMN DEFINITIONS (critical — read before checking):
- "Orig" = ORIGINAL SCHEDULED VALUE column (before any change orders)
- "ChgOrd" = CHANGE ORDERS column (additions/deductions)
- "Sched" = CURRENT SCHEDULED VALUE = Orig + ChgOrd (the rightmost "Current" or "Scheduled Value" column)
- "PrevWork" = work completed in prior periods
- "ThisPeriod" = work completed this application period
- "Materials" = materials presently stored
- "Total" = PrevWork + ThisPeriod + Materials
- "Pct" = Total / Sched × 100
- "Balance" = Sched - Total
- "Retainage" = retainage held

VERIFICATION RULES:
1. Match "Sched" against the CURRENT SCHEDULED VALUE column in the PDF (which equals Orig + ChgOrd). Do NOT flag if Sched matches the current column even if it came entirely from a change order with Orig=0.
2. If Orig=0 and ChgOrd>0 and Sched=ChgOrd, that is CORRECT — it is a change order line item.
3. Allow ±$1 rounding tolerance on all dollar amounts.
4. Only flag "warning" if a value is genuinely wrong or missing — not simply because the breakdown differs from your expectation.
5. Respond ONLY with a JSON array — no explanation, no markdown fences.`;

    let validCount = 0;
    let warnCount = 0;
    let errorCount = 0;

    // Parallel page processor with concurrency limit
    async function validatePage(pageStr) {
      const pageNum = Number(pageStr);
      const pageItems = pageGroups[pageStr];
      const b64 = pageImages[pageStr] || pageImages[pageNum];

      if (!b64) {
        log("warn", `Page ${pageNum}: no image in cache, skipping ${pageItems.length} items`);
        for (const item of pageItems) {
          run(db, "UPDATE line_items SET validation_status = 'unchecked', validation_note = ? WHERE id = ?",
            ["No page image available", item.id]);
        }
        return;
      }

      log("progress", `🔍 Page ${pageNum}: verifying ${pageItems.length} items…`);

      const itemsText = pageItems.map((item) =>
        `ID=${item.id} | Item#=${item.item_no} | "${item.type_of_work}" | Orig=$${item.scheduled_original ?? 0} | ChgOrd=$${item.scheduled_change_orders ?? 0} | Sched=$${item.scheduled_current} | PrevWork=$${item.work_completed_prev} | ThisPeriod=$${item.work_completed_this} | Materials=$${item.materials_stored} | Total=$${item.total_completed} | %=${item.pct} | Balance=$${item.balance_to_finish} | Retainage=$${item.retainage}`
      ).join("\n");

      const userPrompt = `Verify these extracted G703 rows against PDF page ${pageNum}. Check each value against the corresponding cell in the PDF table. Remember: Sched = Orig + ChgOrd = the CURRENT SCHEDULED VALUE column.\n\n${itemsText}\n\nReturn a JSON array. For each row: {"id":<id>, "status":"valid"|"warning", "note":"<brief reason only if warning, else empty string>"}`;

      try {
        let responseText;

        // Try Responses API first (GPT-5.4 native format, same as the extractor notebook)
        try {
          const resp = await openai.responses.create({
            model: AZURE_OAI_DEPLOYMENT,
            instructions: SYSTEM_PROMPT,
            input: [{
              role: "user",
              content: [
                { type: "input_text",  text: userPrompt },
                { type: "input_image", image_url: `data:image/jpeg;base64,${b64}` },
              ],
            }],
            temperature: 0,
            max_output_tokens: 2000,
          });
          responseText = resp.output_text;
        } catch (respErr) {
          // Fallback: standard chat completions with vision
          const resp = await openai.chat.completions.create({
            model: AZURE_OAI_DEPLOYMENT,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: `${SYSTEM_PROMPT}\n\n${userPrompt}` },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" } },
              ],
            }],
            temperature: 0,
            max_tokens: 2000,
          });
          responseText = resp.choices[0].message.content;
        }

        // Parse JSON (strip markdown fences if any)
        const jsonStr = (responseText || "").trim()
          .replace(/^```json\n?/i, "").replace(/```$/i, "").trim();
        const results = JSON.parse(jsonStr);

        let pageValid = 0, pageWarn = 0;
        for (const result of results) {
          const status = result.status === "valid" ? "valid" : "warning";
          const note = (result.note || "").slice(0, 500);
          run(db, "UPDATE line_items SET validation_status = ?, validation_note = ? WHERE id = ?",
            [status, note, result.id]);
          if (status === "valid") { validCount++; pageValid++; }
          else { warnCount++; pageWarn++; }
        }
        log("success", `Page ${pageNum} done — ✓ ${pageValid} valid, ⚠ ${pageWarn} warnings`);

      } catch (e) {
        log("error", `Page ${pageNum} failed: ${e.message.slice(0, 200)}`);
        for (const item of pageItems) {
          run(db, "UPDATE line_items SET validation_status = 'unchecked', validation_note = ? WHERE id = ?",
            [`Error: ${e.message.slice(0, 200)}`, item.id]);
          errorCount++;
        }
      }
    }

    // Run pages with concurrency pool
    async function runPool(tasks, concurrency) {
      const queue = [...tasks];
      const running = new Set();
      while (queue.length > 0 || running.size > 0) {
        while (queue.length > 0 && running.size < concurrency) {
          const task = queue.shift();
          const p = task().finally(() => running.delete(p));
          running.add(p);
        }
        if (running.size > 0) await Promise.race(running);
      }
    }

    await runPool(pages.map((pg) => () => validatePage(pg)), VALIDATION_CONCURRENCY);

    // ── Cover Page Validation ────────────────────────────────────────────────
    const coverRows = query(db, "SELECT * FROM cover_page WHERE project_id = ?", [projectId]);
    if (coverRows.length > 0) {
      const cover = coverRows[0];
      const coverPageNum = cover.source_page || 1;
      const coverB64 = pageImages[String(coverPageNum)] || pageImages[coverPageNum];

      if (coverB64) {
        log("progress", `📋 Validating Cover Page (G702, page ${coverPageNum})…`);
        await wait(200);

        const coverText = `To Owner: "${cover.to_owner}"
From Contractor: "${cover.from_contractor}"
Project Name: "${cover.project_name}"
Application No.: "${cover.application_no}"
Period To: "${cover.period}"
1. Original Contract Sum: $${cover.original_contract_sum}
2. Net Change by Change Orders: $${cover.net_change_orders}
3. Contract Sum to Date: $${cover.contract_sum_to_date}
4. Total Completed & Stored: $${cover.total_completed_stored}
5a. Retainage on Completed Work: $${cover.retainage_completed}
5b. Retainage on Stored Materials: $${cover.retainage_materials}
Total Retainage: $${cover.total_retainage}
6. Total Earned Less Retainage: $${cover.total_earned_less_ret}
7. Less Previous Certificates: $${cover.less_prev_certificates}
8. Current Payment Due: $${cover.current_payment_due}
9. Balance to Finish: $${cover.balance_to_finish}
Architect Signature: "${cover.architect_signature}"
Contractor Signature: "${cover.contractor_signature}"`;

        const coverPrompt = `You are auditing a G702 AIA cover page (Application and Certification for Payment).

I extracted these values from the PDF. Verify EACH field against what you see in the page image.

EXTRACTED VALUES:
${coverText}

Respond with a JSON object mapping each field key to its result:
{
  "to_owner": {"status": "valid"|"warning", "note": "..."},
  "from_contractor": {"status": "valid"|"warning", "note": "..."},
  "project_name": {"status": "valid"|"warning", "note": "..."},
  "application_no": {"status": "valid"|"warning", "note": "..."},
  "period": {"status": "valid"|"warning", "note": "..."},
  "original_contract_sum": {"status": "valid"|"warning", "note": "..."},
  "net_change_orders": {"status": "valid"|"warning", "note": "..."},
  "contract_sum_to_date": {"status": "valid"|"warning", "note": "..."},
  "total_completed_stored": {"status": "valid"|"warning", "note": "..."},
  "retainage_completed": {"status": "valid"|"warning", "note": "..."},
  "retainage_materials": {"status": "valid"|"warning", "note": "..."},
  "total_retainage": {"status": "valid"|"warning", "note": "..."},
  "total_earned_less_ret": {"status": "valid"|"warning", "note": "..."},
  "less_prev_certificates": {"status": "valid"|"warning", "note": "..."},
  "current_payment_due": {"status": "valid"|"warning", "note": "..."},
  "balance_to_finish": {"status": "valid"|"warning", "note": "..."},
  "architect_signature": {"status": "valid"|"warning", "note": "..."},
  "contractor_signature": {"status": "valid"|"warning", "note": "..."}
}

Rules:
- "valid" if value matches the PDF (allow ±$1 rounding for numbers)
- "warning" if value is wrong, missing, or significantly different
- "note" must be empty string "" when valid, brief reason when warning
Respond ONLY with the JSON object, no markdown, no extra text.`;

        try {
          let responseText;
          try {
            const resp = await openai.responses.create({
              model: AZURE_OAI_DEPLOYMENT,
              instructions: "You are a construction payment application auditor. Respond only with JSON.",
              input: [{
                role: "user",
                content: [
                  { type: "input_text",  text: coverPrompt },
                  { type: "input_image", image_url: `data:image/jpeg;base64,${coverB64}` },
                ],
              }],
              temperature: 0,
              max_output_tokens: 2000,
            });
            responseText = resp.output_text;
          } catch (e) {
            const resp = await openai.chat.completions.create({
              model: AZURE_OAI_DEPLOYMENT,
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: coverPrompt },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${coverB64}`, detail: "high" } },
                ],
              }],
              temperature: 0,
              max_tokens: 2000,
            });
            responseText = resp.choices[0].message.content;
          }

          const jsonStr = (responseText || "").trim()
            .replace(/^```json\n?/i, "").replace(/```$/i, "").trim();
          const coverResults = JSON.parse(jsonStr);

          // Store per-field validation notes as JSON in the validation_notes column
          run(db, "UPDATE cover_page SET validation_notes = ? WHERE project_id = ?",
            [JSON.stringify(coverResults), projectId]);

          const coverWarn = Object.values(coverResults).filter(r => r.status === "warning").length;
          const coverValid = Object.values(coverResults).filter(r => r.status === "valid").length;
          validCount += coverValid;
          warnCount += coverWarn;

          if (coverWarn > 0) {
            log("warn", `Cover page: ✓ ${coverValid} valid, ⚠ ${coverWarn} fields need review`);
          } else {
            log("success", `Cover page: all ${coverValid} fields verified ✓`);
          }
        } catch (e) {
          log("error", `Cover page validation failed: ${e.message.slice(0, 200)}`);
        }
      } else {
        log("warn", "Cover page image not found in cache — skipping G702 validation");
      }
    }

    // Final summary
    await wait(400);
    log("success", "🤖 AI Validation Complete ✓");
    log("info", `✓ ${validCount} valid   ⚠ ${warnCount} warnings   ✗ ${errorCount} errors`);
    if (warnCount > 0) {
      log("warn", `${warnCount} items flagged — look for ⚠ yellow indicators in both tabs`);
    } else if (validCount > 0) {
      log("success", "All values verified — extraction looks 100% accurate! 🎉");
    }

  } catch (err) {
    try {
      const db = await getDb();
      run(db, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)",
        [projectId, "error", `Validation failed: ${err.message}`]);
      run(db, "UPDATE line_items SET validation_status = 'unchecked' WHERE project_id = ?", [projectId]);
    } catch (_) {}
  }
});

// ── POST /api/projects/:id/validate-ai/item/:itemId — re-check one row ───────
app.post("/api/projects/:id/validate-ai/item/:itemId", async (req, res) => {
  const projectId = req.params.id;
  const itemId = parseInt(req.params.itemId);

  try {
    const db = await getDb();
    res.json({ success: true, message: "Re-validation started" });

    const log = (level, message) => {
      run(db, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)", [projectId, level, message]);
    };

    const items = query(db, "SELECT * FROM line_items WHERE id = ? AND project_id = ?", [itemId, projectId]);
    if (items.length === 0) { log("error", `Item ${itemId} not found`); return; }
    const item = items[0];
    const pageStr = String(item.source_page || 0);

    log("progress", `↻ Re-checking Item #${item.item_no} (page ${item.source_page})…`);
    run(db, "UPDATE line_items SET validation_status = 'checking' WHERE id = ?", [itemId]);

    const projRows = query(db, "SELECT pdf_path FROM projects WHERE id = ?", [projectId]);
    const pageImages = await ensurePageImages(projectId, projRows[0]?.pdf_path, log);
    if (!pageImages) { log("error", "Could not load page images for project " + projectId); return; }
    const b64 = pageImages[pageStr] || pageImages[Number(pageStr)];
    if (!b64) { log("error", `No image for page ${item.source_page}`); return; }

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ baseURL: AZURE_OAI_ENDPOINT, apiKey: AZURE_OAI_KEY });

    const itemText = `ID=${item.id} | Item#=${item.item_no} | "${item.type_of_work}" | Sched=$${item.scheduled_current} | PrevWork=$${item.work_completed_prev} | ThisPeriod=$${item.work_completed_this} | Materials=$${item.materials_stored} | Total=$${item.total_completed} | %=${item.pct} | Balance=$${item.balance_to_finish} | Retainage=$${item.retainage}`;
    const prompt = `Verify this single extracted row against the PDF page image:\n\n${itemText}\n\nRespond with JSON: [{"id":${item.id},"status":"valid"|"warning","note":"<reason if warning>"}]`;

    try {
      let responseText;
      try {
        const resp = await openai.responses.create({
          model: AZURE_OAI_DEPLOYMENT,
          instructions: "You are a construction payment auditor. Respond only with JSON array.",
          input: [{ role: "user", content: [
            { type: "input_text",  text: prompt },
            { type: "input_image", image_url: `data:image/jpeg;base64,${b64}` },
          ]}],
          temperature: 0, max_output_tokens: 500,
        });
        responseText = resp.output_text;
      } catch (e) {
        const resp = await openai.chat.completions.create({
          model: AZURE_OAI_DEPLOYMENT,
          messages: [{ role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" } },
          ]}],
          temperature: 0, max_tokens: 500,
        });
        responseText = resp.choices[0].message.content;
      }

      const jsonStr = (responseText || "").trim().replace(/^```json\n?/i, "").replace(/```$/i, "").trim();
      const results = JSON.parse(jsonStr);
      const result = results[0];
      const status = result.status === "valid" ? "valid" : "warning";
      run(db, "UPDATE line_items SET validation_status = ?, validation_note = ? WHERE id = ?",
        [status, result.note || "", itemId]);
      log(status === "valid" ? "success" : "warn",
        `Item #${item.item_no}: ${status === "valid" ? "✓ Valid" : `⚠ ${result.note}`}`);
    } catch (e) {
      run(db, "UPDATE line_items SET validation_status = 'unchecked' WHERE id = ?", [itemId]);
      log("error", `Re-check failed: ${e.message.slice(0, 200)}`);
    }
  } catch (err) {
    try {
      const db2 = await getDb();
      run(db2, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)",
        [projectId, "error", `Re-validate failed: ${err.message}`]);
    } catch (_) {}
  }
});

// ── PROJECT PHASES ───────────────────────────────────────────────────────────

// GET /api/projects/:id/phases
app.get("/api/projects/:id/phases", async (req, res) => {
  try {
    const db    = await getDb();
    const projId = parseInt(req.params.id);

    // Auto-create phase rows on first request
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
      // Check if phase 1 is already complete (line items exist)
      const items = query(db, "SELECT COUNT(*) as cnt FROM line_items WHERE project_id = ?", [projId]);
      if (items[0]?.cnt > 0) {
        run(db, "UPDATE project_phases SET status='complete', item_count=? WHERE project_id=? AND phase_number=1",
          [items[0].cnt, projId]);
      }
      return res.json(query(db, "SELECT * FROM project_phases WHERE project_id = ? ORDER BY phase_number", [projId]));
    }
    // Always sync phase 1 status with line_items
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

// POST /api/projects/:id/upload-subcontractor — upload PDF for phase 2
app.post("/api/projects/:id/upload-subcontractor", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });
    const db    = await getDb();
    const projId = parseInt(req.params.id);
    const pdfPath = req.file.path;
    run(db, "INSERT OR IGNORE INTO project_phases (project_id, phase_number, phase_name, status) VALUES (?,2,'Subcontractor Payment Application','pending')",
      [projId]);
    run(db, "UPDATE project_phases SET status='pending', pdf_path=? WHERE project_id=? AND phase_number=2",
      [pdfPath, projId]);
    res.json({ success: true, pdf_path: pdfPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/run-subcontractor-extraction — run extract_subcontractors.py
app.post("/api/projects/:id/run-subcontractor-extraction", async (req, res) => {
  const projId = parseInt(req.params.id);
  res.json({ success: true, message: "Subcontractor extraction started" });

  try {
    const db = await getDb();
    const phases = query(db, "SELECT * FROM project_phases WHERE project_id=? AND phase_number=2", [projId]);
    const pdfPath = phases[0]?.pdf_path;

    const log = (level, msg) => {
      try { run(db, "INSERT INTO logs (project_id, level, message) VALUES (?,?,?)", [projId, level, msg]); } catch (_) {}
    };

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      run(db, "UPDATE project_phases SET status='error' WHERE project_id=? AND phase_number=2", [projId]);
      return log("error", "Subcontractor extraction: no PDF uploaded for phase 2");
    }

    run(db, "UPDATE project_phases SET status='running' WHERE project_id=? AND phase_number=2", [projId]);
    log("info", "▶ Starting subcontractor pay app extraction…");

    const outputJson = path.join(UPLOAD_DIR, `sub_apps_project_${projId}.json`);
    const { execFile } = require("child_process");
    const scriptPath   = path.join(__dirname, "extract_subcontractors.py");

    const tryPython = (exe) => new Promise((resolve) => {
      execFile(exe, [scriptPath, pdfPath, outputJson], { timeout: 1800000 }, (err, stdout, stderr) => {
        const lines = (stdout || "").split("\n");
        for (const ln of lines) {
          if (ln.startsWith("PROGRESS:")) {
            log("info", ln.replace("PROGRESS:", "").trim());
          }
        }
        if (err && !stdout.includes("DONE:")) { return resolve(null); }
        const m = stdout.match(/DONE:(\d+)/);
        resolve(m ? parseInt(m[1]) : null);
      });
    });

    let count = null;
    for (const exe of PYTHON_CANDIDATES) {
      count = await tryPython(exe);
      if (count !== null) break;
    }

    if (count === null) {
      run(db, "UPDATE project_phases SET status='error' WHERE project_id=? AND phase_number=2", [projId]);
      return log("error", "Subcontractor extraction failed — Python error. Check server logs.");
    }

    // Load results and upsert into DB
    const results = JSON.parse(fs.readFileSync(outputJson, "utf-8"));
    run(db, "DELETE FROM subcontractor_applications WHERE project_id=?", [projId]);
    for (const r of results) {
      run(db, `INSERT INTO subcontractor_applications (
        project_id, seq_id, start_page, end_page, document_type, document_category,
        subcontractor_name, application_no, application_date, period_from, period_to,
        invoice_to, project_name_on_doc, contract_po_number,
        original_contract_sum, net_change_orders, contract_sum_to_date,
        total_completed_stored, completed_work_this_period, total_retainage,
        retainage_percent, total_earned_less_retainage, less_prev_certificates,
        current_payment_due, balance_to_finish,
        g703_scheduled_value, g703_work_prev, g703_work_this_period,
        g703_materials_stored, g703_total_completed, g703_retainage,
        g703_earned_less_ret, g703_balance_to_finish,
        recon_flag, contractor_signature, architect_signature,
        notarized, additional_supporting_docs, raw_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        projId, r.seq_id, r.start_page, r.end_page, r.document_type, r.document_category,
        r.subcontractor_name, r.application_no, r.application_date, r.period_from, r.period_to,
        r.invoice_to, r.project_name_on_doc, r.contract_po_number,
        r.original_contract_sum, r.net_change_orders, r.contract_sum_to_date,
        r.total_completed_stored, r.completed_work_this_period, r.total_retainage,
        r.retainage_percent, r.total_earned_less_retainage, r.less_prev_certificates,
        r.current_payment_due, r.balance_to_finish,
        r.g703_scheduled_value, r.g703_work_prev, r.g703_work_this_period,
        r.g703_materials_stored, r.g703_total_completed, r.g703_retainage,
        r.g703_earned_less_ret, r.g703_balance_to_finish,
        r.recon_flag, r.contractor_signature, r.architect_signature,
        r.notarized, r.additional_supporting_docs,
        JSON.stringify(r),
      ]);
    }

    run(db, "UPDATE project_phases SET status='complete', item_count=?, completed_at=datetime('now','localtime') WHERE project_id=? AND phase_number=2",
      [count, projId]);
    log("success", `✓ Extracted ${count} subcontractor pay applications`);
  } catch (err) {
    console.error("Subcontractor extraction error:", err);
    try {
      const db2 = await getDb();
      run(db2, "UPDATE project_phases SET status='error' WHERE project_id=? AND phase_number=2", [projId]);
      run(db2, "INSERT INTO logs (project_id, level, message) VALUES (?,?,?)",
        [projId, "error", `Subcontractor extraction failed: ${err.message}`]);
    } catch (_) {}
  }
});

// GET /api/projects/:id/subcontractor-applications
app.get("/api/projects/:id/subcontractor-applications", async (req, res) => {
  try {
    const db   = await getDb();
    const rows = query(db, "SELECT * FROM subcontractor_applications WHERE project_id=? ORDER BY seq_id", [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/projects/:id/validation-summary ──────────────────────────────────
app.get("/api/projects/:id/validation-summary", async (req, res) => {
  try {
    const db = await getDb();
    const items = query(db, "SELECT validation_status FROM line_items WHERE project_id = ?", [req.params.id]);
    const summary = { total: items.length, valid: 0, warning: 0, unchecked: 0, checking: 0 };
    for (const item of items) {
      const s = item.validation_status || "unchecked";
      summary[s] = (summary[s] || 0) + 1;
    }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Backend running at http://localhost:${PORT}`);
  console.log(`  SQLite DB stored at: ${require("path").join(__dirname, "projects.db")}\n`);
});
