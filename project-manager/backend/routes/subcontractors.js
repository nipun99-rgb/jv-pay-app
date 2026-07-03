/**
 * routes/subcontractors.js — Upload, extraction, CRUD, AI validation for sub pay apps
 */
const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const { getDb, save, query, run } = require("../lib/db");
const { upload, UPLOAD_DIR } = require("../middleware/upload");

const PYTHON_CANDIDATES = [
  "C:\\Users\\KR614XU\\AppData\\Local\\Python\\bin\\python.exe",
  "python3", "python",
];

const AZURE_OAI_ENDPOINT = process.env.AOAI_ENDPOINT || "";
const AZURE_OAI_KEY = process.env.AOAI_KEY || "";
const AZURE_OAI_DEPLOYMENT = "gpt-5.4";

// Per-project sub image cache
const _subPageImages = {};

// POST /api/projects/:id/upload-subcontractor
router.post("/:id/upload-subcontractor", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });
    const db = await getDb();
    const projId = parseInt(req.params.id);
    const pdfPath = req.file.path;
    run(db, "INSERT OR IGNORE INTO project_phases (project_id, phase_number, phase_name, status) VALUES (?,2,'Subcontractor Payment Application','pending')", [projId]);
    run(db, "UPDATE project_phases SET status='pending', pdf_path=? WHERE project_id=? AND phase_number=2", [pdfPath, projId]);
    res.json({ success: true, pdf_path: pdfPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/run-subcontractor-extraction
router.post("/:id/run-subcontractor-extraction", async (req, res) => {
  const projId = parseInt(req.params.id);
  res.json({ success: true, message: "Subcontractor extraction started" });

  try {
    const db = await getDb();
    const phases = query(db, "SELECT * FROM project_phases WHERE project_id=? AND phase_number=2", [projId]);
    const pdfPath = phases[0]?.pdf_path;
    const log = (level, msg) => { try { run(db, "INSERT INTO logs (project_id, level, message) VALUES (?,?,?)", [projId, level, msg]); } catch (_) {} };

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      run(db, "UPDATE project_phases SET status='error' WHERE project_id=? AND phase_number=2", [projId]);
      return log("error", "Subcontractor extraction: no PDF uploaded for phase 2");
    }

    run(db, "UPDATE project_phases SET status='running' WHERE project_id=? AND phase_number=2", [projId]);
    log("info", "▶ Starting subcontractor pay app extraction…");

    const outputJson = path.join(UPLOAD_DIR, `sub_apps_project_${projId}.json`);
    const { execFile } = require("child_process");
    const scriptPath = path.join(__dirname, "..", "extract_subcontractors.py");

    const tryPython = (exe) => new Promise((resolve) => {
      execFile(exe, [scriptPath, pdfPath, outputJson], { timeout: 1800000 }, (err, stdout) => {
        const lines = (stdout || "").split("\n");
        for (const ln of lines) { if (ln.startsWith("PROGRESS:")) log("info", ln.replace("PROGRESS:", "").trim()); }
        if (err && !stdout.includes("DONE:")) return resolve(null);
        const m = stdout.match(/DONE:(\d+)/);
        resolve(m ? parseInt(m[1]) : null);
      });
    });

    let count = null;
    for (const exe of PYTHON_CANDIDATES) { count = await tryPython(exe); if (count !== null) break; }
    if (count === null) {
      run(db, "UPDATE project_phases SET status='error' WHERE project_id=? AND phase_number=2", [projId]);
      return log("error", "Subcontractor extraction failed — Python error.");
    }

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
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
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
        r.notarized, r.additional_supporting_docs, JSON.stringify(r),
      ]);
    }
    run(db, "UPDATE project_phases SET status='complete', item_count=?, completed_at=datetime('now','localtime') WHERE project_id=? AND phase_number=2", [count, projId]);
    log("success", `✓ Extracted ${count} subcontractor pay applications`);
  } catch (err) {
    console.error("Subcontractor extraction error:", err);
    try {
      const db2 = await getDb();
      run(db2, "UPDATE project_phases SET status='error' WHERE project_id=? AND phase_number=2", [projId]);
      run(db2, "INSERT INTO logs (project_id, level, message) VALUES (?,?,?)", [projId, "error", `Extraction failed: ${err.message}`]);
    } catch (_) {}
  }
});

// GET /api/projects/:id/subcontractor-applications
router.get("/:id/subcontractor-applications", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM subcontractor_applications WHERE project_id=? ORDER BY seq_id", [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id/subcontractor-applications/:appId
router.patch("/:id/subcontractor-applications/:appId", async (req, res) => {
  try {
    const db = await getDb();
    const { validation_status, validation_note } = req.body;
    run(db, "UPDATE subcontractor_applications SET validation_status=?, validation_note=? WHERE id=? AND project_id=?",
      [validation_status || "unchecked", validation_note || "", req.params.appId, req.params.id]);
    const rows = query(db, "SELECT * FROM subcontractor_applications WHERE id=?", [req.params.appId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/:id/sub-apps/:appId — update extracted values
router.patch("/:id/sub-apps/:appId", async (req, res) => {
  try {
    const db = await getDb();
    const { appId } = req.params;
    const updates = req.body;
    const allowedFields = ["completed_work_this_period", "g703_work_this_period", "subcontractor_name", "total_completed_stored", "original_contract_sum", "contract_sum_to_date"];
    const setClauses = [];
    const values = [];
    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) { setClauses.push(`${field} = ?`); values.push(value); }
    }
    if (!setClauses.length) return res.status(400).json({ error: "No valid fields to update" });
    values.push(appId);
    db.run(`UPDATE subcontractor_applications SET ${setClauses.join(", ")} WHERE id = ?`, values);
    save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/sub-line-items
router.get("/:id/sub-line-items", async (req, res) => {
  try {
    const db = await getDb();
    const appId = req.query.sub_app_id;
    const rows = appId
      ? query(db, "SELECT * FROM sub_line_items WHERE project_id=? AND sub_app_id=? ORDER BY id", [req.params.id, appId])
      : query(db, "SELECT * FROM sub_line_items WHERE project_id=? ORDER BY sub_app_id, id", [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/import-sub-line-items
router.post("/:id/import-sub-line-items", async (req, res) => {
  try {
    const db = await getDb();
    const projId = parseInt(req.params.id);
    const items = req.body.items;
    if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
    const apps = query(db, "SELECT id, seq_id FROM subcontractor_applications WHERE project_id=?", [projId]);
    const seqToId = {};
    for (const a of apps) seqToId[a.seq_id] = a.id;
    run(db, "DELETE FROM sub_line_items WHERE project_id=?", [projId]);
    let inserted = 0;
    for (const item of items) {
      const subAppId = seqToId[item.sub_id];
      if (!subAppId) continue;
      run(db, `INSERT INTO sub_line_items (project_id, sub_app_id, source_page, item_no, description,
        scheduled_value, work_completed_prev, work_completed_this, materials_stored,
        total_completed, pct_complete, retainage) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [
        projId, subAppId, item.source_page || null, item.item_no || "",
        item.description || "", item.scheduled_value ?? null,
        item.work_completed_prev ?? null, item.work_completed_this ?? null,
        item.materials_stored ?? null, item.total_completed ?? null,
        item.pct_complete ?? null, item.retainage ?? null,
      ]);
      inserted++;
    }
    res.json({ success: true, inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/validate-ai/subcontractors
router.post("/:id/validate-ai/subcontractors", async (req, res) => {
  const projectId = req.params.id;
  try {
    const db = await getDb();
    const phaseRows = query(db, "SELECT pdf_path FROM project_phases WHERE project_id=? AND phase_number=2", [projectId]);
    if (!phaseRows.length || !phaseRows[0].pdf_path)
      return res.status(400).json({ error: "No subcontractor PDF uploaded" });

    res.json({ success: true, message: "Subcontractor AI validation started" });

    const log = (level, message) => { run(db, "INSERT INTO logs (project_id, level, message) VALUES (?,?,?)", [projectId, level, message]); };
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    log("step", "🤖 AI Validation — Subcontractor Pay Apps starting…");

    const subPdfPath = phaseRows[0].pdf_path;
    const apps = query(db, "SELECT * FROM subcontractor_applications WHERE project_id=? ORDER BY seq_id", [projectId]);
    if (!apps.length) { log("warn", "No subcontractor applications to validate"); return; }

    // Collect needed pages
    const neededPages = new Set();
    for (const app of apps) {
      const start = app.start_page || 1;
      for (let p = start; p <= Math.min(app.end_page || start, start + 2); p++) neededPages.add(p);
    }

    const subCacheKey = `${projectId}_sub`;
    if (!_subPageImages[subCacheKey]) _subPageImages[subCacheKey] = {};
    const subImages = _subPageImages[subCacheKey];
    const missingPages = [...neededPages].filter(p => !subImages[String(p)]);

    if (missingPages.length > 0) {
      log("progress", `📄 Rendering ${missingPages.length} pages…`);
      const pyCode = `import fitz, json, base64, sys\ndoc = fitz.open(sys.argv[1])\npages_to_render = [int(x) for x in sys.argv[2].split(',')]\nresult = {}\nfor p in pages_to_render:\n    try:\n        page = doc[p-1]\n        mat = fitz.Matrix(150/72, 150/72)\n        pix = page.get_pixmap(matrix=mat)\n        if pix.colorspace and pix.colorspace.name not in ('DeviceRGB','RGB'): pix = fitz.Pixmap(fitz.csRGB, pix)\n        if pix.alpha: pix = fitz.Pixmap(pix, 0)\n        result[str(p)] = base64.b64encode(pix.tobytes('jpeg')).decode()\n    except Exception as e:\n        import sys as _sys; _sys.stderr.write(f'page {p}: {e}\\\\n')\nimport sys as _sys; _sys.stdout.write(json.dumps(result))`;
      const pyScriptPath = path.join(__dirname, "..", "_render_sub_tmp.py");
      fs.writeFileSync(pyScriptPath, pyCode);
      const { execFile } = require("child_process");
      const tryPy = (exe) => new Promise((resolve) => {
        execFile(exe, [pyScriptPath, subPdfPath, missingPages.join(",")], { timeout: 120000, maxBuffer: 256 * 1024 * 1024 }, (err, stdout) => {
          if (err) return resolve(null);
          try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
        });
      });
      let rendered = null;
      for (const exe of PYTHON_CANDIDATES) { rendered = await tryPy(exe); if (rendered !== null) break; }
      try { fs.unlinkSync(pyScriptPath); } catch (_) {}
      if (!rendered) { log("error", "Could not render pages."); return; }
      Object.assign(subImages, rendered);
      log("success", `✓ Rendered ${Object.keys(rendered).length} pages`);
    }

    log("info", `Validating ${apps.length} applications…`);
    run(db, "UPDATE subcontractor_applications SET validation_status='checking' WHERE project_id=?", [projectId]);

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ baseURL: AZURE_OAI_ENDPOINT, apiKey: AZURE_OAI_KEY });

    const SUB_SYSTEM = `You verify extracted subcontractor pay application data against PDF pages.
Return ONLY JSON: {"status":"valid"|"warning","note":"brief summary"}`;

    let validCount = 0, warnCount = 0;

    async function validateApp(app) {
      const pages = [];
      for (let p = (app.start_page || 1); p <= Math.min((app.end_page || app.start_page || 1), (app.start_page || 1) + 2); p++) {
        const b64 = subImages[String(p)];
        if (b64) pages.push({ page: p, b64 });
      }
      if (!pages.length) { run(db, "UPDATE subcontractor_applications SET validation_status='unchecked', validation_note='No image' WHERE id=?", [app.id]); return; }

      const desc = `Sub: ${app.subcontractor_name} | App#${app.application_no} | Contract Sum: $${app.contract_sum_to_date ?? ""} | This Period: $${app.completed_work_this_period ?? ""} | Payment Due: $${app.current_payment_due ?? ""}`;
      try {
        const resp = await openai.responses.create({
          model: AZURE_OAI_DEPLOYMENT, instructions: SUB_SYSTEM,
          input: [{ role: "user", content: [
            { type: "input_text", text: `Verify: ${desc}` },
            ...pages.map(p => ({ type: "input_image", image_url: `data:image/jpeg;base64,${p.b64}` })),
          ]}],
          temperature: 0, max_output_tokens: 500,
        });
        const raw = (resp.output_text || "").replace(/^```json\n?/i,"").replace(/```$/i,"").trim();
        const result = JSON.parse(raw);
        const status = result.status === "valid" ? "valid" : "warning";
        run(db, "UPDATE subcontractor_applications SET validation_status=?, validation_note=? WHERE id=?", [status, (result.note || "").slice(0, 500), app.id]);
        if (status === "valid") validCount++; else warnCount++;
        log(status === "valid" ? "success" : "warn", `[${app.seq_id}] ${(app.subcontractor_name || "?").slice(0, 25)}: ${status === "valid" ? "✓" : "⚠ " + (result.note || "").slice(0, 60)}`);
      } catch (e) {
        run(db, "UPDATE subcontractor_applications SET validation_status='unchecked', validation_note=? WHERE id=?", [`Error: ${e.message.slice(0, 200)}`, app.id]);
      }
    }

    // Concurrency pool
    async function runPool(tasks, concurrency) {
      const queue = [...tasks]; const running = new Set();
      while (queue.length > 0 || running.size > 0) {
        while (queue.length > 0 && running.size < concurrency) { const t = queue.shift(); const p = t().finally(() => running.delete(p)); running.add(p); }
        if (running.size > 0) await Promise.race(running);
      }
    }
    await runPool(apps.map(app => () => validateApp(app)), 3);
    log("step", `✅ Sub validation complete — ✓ ${validCount} valid, ⚠ ${warnCount} warnings`);
  } catch (err) {
    console.error("Sub validation error:", err);
  }
});

module.exports = router;
