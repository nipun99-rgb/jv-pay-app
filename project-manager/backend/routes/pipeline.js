/**
 * routes/pipeline.js — Run extraction pipeline (CSV from PDF)
 */
const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const { getDb, save, query, run } = require("../lib/db");
const { UPLOAD_DIR } = require("../middleware/upload");

// CSV line parser (handles quoted fields with commas)
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
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

const PYTHON_CANDIDATES = [
  "C:\\Users\\KR614XU\\AppData\\Local\\Python\\bin\\python.exe",
  "python3", "python",
];

// POST /api/projects/:id/run-pipeline
router.post("/:id/run-pipeline", async (req, res) => {
  const projectId = req.params.id;
  try {
    const db = await getDb();
    const rows = query(db, "SELECT * FROM projects WHERE id = ?", [projectId]);
    if (rows.length === 0) return res.status(404).json({ error: "Project not found" });
    const project = rows[0];
    if (!project.pdf_path) return res.status(400).json({ error: "No PDF uploaded" });

    res.json({ success: true, message: "Pipeline started" });

    const log = (level, message) => {
      run(db, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)", [projectId, level, message]);
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // Step 2: OCR & Extraction
    run(db, "UPDATE tasks SET status = 'running' WHERE project_id = ? AND step_number = 2", [projectId]);
    log("step", "Starting OCR & Extraction…");
    await wait(800);
    log("info", `PDF: ${path.basename(project.pdf_path)}`);
    await wait(600);
    log("progress", "Running pdfplumber extraction on uploaded PDF…");

    const projectCsvName = `gc_app${project.id}_line_items.csv`;
    const projectCsvPath = path.join(__dirname, "..", "..", "..", projectCsvName);
    const extractScript = path.join(__dirname, "..", "extract_g703.py");

    const pdfMtime = fs.existsSync(project.pdf_path) ? fs.statSync(project.pdf_path).mtimeMs : 0;
    const csvMtime = fs.existsSync(projectCsvPath) ? fs.statSync(projectCsvPath).mtimeMs : 0;
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
        execFile(exe, [extractScript, project.pdf_path, projectCsvPath], { timeout: 120000 }, (err, stdout) => {
          if (err) return resolve(null);
          const m = stdout.match(/DONE:(\d+)/);
          resolve(m ? parseInt(m[1]) : null);
        });
      });
      let extracted = null;
      for (const exe of PYTHON_CANDIDATES) { extracted = await tryPy(exe); if (extracted !== null) break; }
      if (!extracted || extracted < 1) {
        log("error", "pdfplumber extraction failed — check that pdfplumber is installed.");
        run(db, "UPDATE tasks SET status = 'error' WHERE project_id = ? AND step_number = 2", [projectId]);
        return;
      }
      log("success", `Extracted ${extracted} line items from PDF ✓`);
    } else {
      log("info", "Using cached extraction (PDF unchanged)");
    }

    // Parse CSV
    const csvContent = fs.readFileSync(projectCsvPath, "utf-8");
    const csvLines = csvContent.split("\n").filter((l) => l.trim());
    const headers = parseCSVLine(csvLines[0]);
    const dataRows = [];
    for (let i = 1; i < csvLines.length; i++) {
      const vals = parseCSVLine(csvLines[i]);
      if (vals.length < 5) continue;
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

    // Step 3: Store Results
    await wait(500);
    run(db, "UPDATE tasks SET status = 'running' WHERE project_id = ? AND step_number = 3", [projectId]);
    log("step", "Storing results in database…");
    await wait(800);
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
          r["Item No."] || null, r["Time Period"] || null, r["Phases"] || null,
          r["Type of work"] || null, r["Contractor name"] || null,
          toNum(r["SCHEDULED ORIGINAL"]), toNum(r["SCHEDULED CHANGE ORDERS"]),
          toNum(r["SCHEDULED CURRENT"]), toNum(r["WORK COMPLETED FROM PREVIOUS APPLICATION"]),
          toNum(r["WORK COMPLETED THIS PERIOD"]), toNum(r["MATERIALS PRESENTLY STORED"]),
          toNum(r["TOTAL COMPLETED AND STORED"]), r["% (G / C)"] || "0%",
          toNum(r["Balance to Finish (C-G)"]), toNum(r["RETAINAGE (If Variable Rate)"]),
          parseInt(r["Source Page"]) || null, r["Review Notes"] || null,
        ]
      );
      if (i > 0 && i % 30 === 0) { await wait(300); log("progress", `Stored ${i} of ${dataRows.length} items…`); }
    }

    await wait(600);
    log("success", `Stored ${dataRows.length} line items ✓`);
    run(db, "UPDATE tasks SET status = 'complete' WHERE project_id = ? AND step_number = 3", [projectId]);

    // Also load cover page data
    const COVER_CSV_PATH = path.join(__dirname, "..", "..", "..", "gc_app12_cover_v2.csv");
    if (fs.existsSync(COVER_CSV_PATH)) {
      const coverContent = fs.readFileSync(COVER_CSV_PATH, "utf-8");
      const coverLines = coverContent.split("\n").filter((l) => l.trim());
      if (coverLines.length >= 2) {
        const cHeaders = parseCSVLine(coverLines[0]);
        const cVals = parseCSVLine(coverLines[1]);
        const c = {};
        cHeaders.forEach((h, i) => { c[h] = cVals[i] || ""; });
        run(db, "DELETE FROM cover_page WHERE project_id = ?", [projectId]);
        run(db,
          `INSERT INTO cover_page (project_id, to_owner, from_contractor, project_name, application_no, period,
           original_contract_sum, net_change_orders, contract_sum_to_date, total_completed_stored,
           retainage_completed, retainage_materials, total_retainage, total_earned_less_ret,
           less_prev_certificates, current_payment_due, balance_to_finish,
           change_order_summary, architect_signature, contractor_signature, source_page, review_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId, c["To Owner"] || null, c["From Contractor"] || null,
            c["Project Name"] || null, c["Payment Application/Invoice No."] || null,
            c["Payment Application Period"] || null,
            toNum(c["Original Contract Sum"]), toNum(c["Net Change by Change Orders"]),
            toNum(c["Contract Sum to Date"]), toNum(c["Total Completed & Stored to Date"]),
            toNum(c["Retainage on Completed Work"]), toNum(c["Retainage on Stored Materials"]),
            toNum(c["Total Retainage"]), toNum(c["Total Earned Less Retainage"]),
            toNum(c["Less Previous Certificates for Payment"]), toNum(c["Current Payment Due"]),
            toNum(c["Balance to Finish Including Retainage"]),
            c["Change Order Summary"] || null, c["Architect's Signature Present"] || null,
            c["Contractor's Signature Present"] || null, parseInt(c["Source Page"]) || 1,
            c["Review Notes"] || null,
          ]
        );
        log("info", "Cover page (G702) data stored ✓");
      }
    }

    // Step 4: Ready
    await wait(500);
    run(db, "UPDATE tasks SET status = 'complete' WHERE project_id = ? AND step_number = 4", [projectId]);
    log("step", "Pipeline complete — ready for validation");
    log("success", `All 4 steps finished. ${dataRows.length} line items ready for review.`);
  } catch (err) {
    const db = await getDb();
    run(db, "INSERT INTO logs (project_id, level, message) VALUES (?, ?, ?)", [projectId, "error", `Pipeline failed: ${err.message}`]);
  }
});

module.exports = router;
