/**
 * routes/validation.js — Reconciliation tests (PA-002, PA-003a/b), AI validation, summaries
 * 
 * This file re-exports the validation-related handlers from the legacy monolith.
 * The handlers are large (1000+ lines) and tightly coupled with LLM/Vision logic.
 * They will be further refactored in Sprint 2 when the validation engine is rebuilt.
 */
const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const { getDb, save, query, run } = require("../lib/db");
const { UPLOAD_DIR } = require("../middleware/upload");

// Azure OpenAI configuration
const AZURE_OAI_ENDPOINT = process.env.AOAI_ENDPOINT || "";
const AZURE_OAI_KEY = process.env.AOAI_KEY || "";
const AZURE_OAI_DEPLOYMENT = "gpt-5.4";
const VALIDATION_CONCURRENCY = 3;

const PYTHON_CANDIDATES = [
  "C:\\Users\\KR614XU\\AppData\\Local\\Python\\bin\\python.exe",
  "python3", "python",
];

// Per-project image cache
const _pageImagesCacheMap = {};

// Helper: normalize contractor name for fuzzy matching
function normalizeName(name) {
  if (!name) return "";
  return name
    .toUpperCase()
    .replace(/[.,\-&|/\\()'"!]+/g, " ")
    .replace(/\b(INC|LLC|LP|CO|CORP|CORPORATION|COMPANY|CONTRACTING|CONSTRUCTION|THE)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Helper: build JV source data for detail view
function buildJvSourceData(items) {
  return items.map(li => ({
    id: li.id, field: "work_completed_this",
    value: parseFloat(li.work_completed_this) || 0,
    page: li.source_page, contractor_name: li.contractor_name,
    item_no: li.item_no, scheduled_current: li.scheduled_current,
    work_completed_prev: li.work_completed_prev,
  }));
}

// LLM fuzzy matching
async function llmFuzzyMatch(jvNames, subNames) {
  if (!jvNames.length || !subNames.length) return {};
  if (!AZURE_OAI_ENDPOINT || !AZURE_OAI_KEY) return {};

  const jvList = jvNames.map(n => n.orig);
  const subList = subNames.map(n => n.orig);

  const prompt = `You are a construction document analyst. Match the JV Pay App contractor names (left) to their corresponding Subcontractor Pay Application names (right).

IMPORTANT RULES:
1. Companies may have different formatting, abbreviations, or suffixes (Inc, LLC, Corp, etc.)
2. MULTIPLE JV line items may refer to the SAME subcontractor
3. If multiple JV names refer to the same sub, map ALL of them to that sub's letter
4. Only include confident matches.

JV Contractor Names:
${jvList.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Subcontractor Pay App Names:
${subList.map((n, i) => `${String.fromCharCode(65 + i)}. ${n}`).join("\n")}

Return ONLY a JSON object mapping JV index (1-based) to Sub letter.
Example: {"1":"A","2":"A","3":"B","5":"C"}`;

  try {
    const response = await fetch(`${AZURE_OAI_ENDPOINT}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": AZURE_OAI_KEY },
      body: JSON.stringify({
        model: AZURE_OAI_DEPLOYMENT,
        messages: [{ role: "user", content: prompt }],
        temperature: 0, max_completion_tokens: 2000,
      }),
    });
    if (!response.ok) return {};
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    const mapping = JSON.parse(jsonMatch[0]);
    const result = {};
    for (const [jvIdx, subLetter] of Object.entries(mapping)) {
      const jvI = parseInt(jvIdx) - 1;
      const subI = subLetter.charCodeAt(0) - 65;
      if (jvI >= 0 && jvI < jvNames.length && subI >= 0 && subI < subNames.length) {
        result[jvNames[jvI].norm] = subNames[subI].norm;
      }
    }
    return result;
  } catch (e) {
    console.error("LLM fuzzy match error:", e.message);
    return {};
  }
}

// Ensure page images are available (renders from PDF if needed)
async function ensurePageImages(projectId, pdfPath, logFn) {
  if (_pageImagesCacheMap[projectId]) return _pageImagesCacheMap[projectId];
  const cacheFile = path.join(__dirname, "..", "..", "..", `gc_app${projectId}_page_images.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      _pageImagesCacheMap[projectId] = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      return _pageImagesCacheMap[projectId];
    } catch (e) { /* fall through */ }
  }
  if (!pdfPath || !fs.existsSync(pdfPath)) return null;
  if (logFn) logFn("progress", "📄 Rendering PDF pages for AI validation…");

  const pyCode = `
import fitz, json, base64, sys
doc = fitz.open(sys.argv[1])
pages = {}
for i, page in enumerate(doc):
    try:
        mat = fitz.Matrix(200/72, 200/72)
        pix = page.get_pixmap(matrix=mat)
        if pix.colorspace and pix.colorspace.name not in ('DeviceRGB','RGB'): pix = fitz.Pixmap(fitz.csRGB, pix)
        if pix.alpha: pix = fitz.Pixmap(pix, 0)
        pages[str(i+1)] = base64.b64encode(pix.tobytes('jpeg')).decode()
    except Exception as e:
        sys.stderr.write(f'page {i+1}: {e}\\n')
with open(sys.argv[2], 'w') as f:
    json.dump(pages, f)
print(f'DONE:{len(pages)}')`.trim();

  const pyScriptPath = path.join(__dirname, "..", "_render_pages_tmp.py");
  fs.writeFileSync(pyScriptPath, pyCode);
  const { execFile } = require("child_process");
  const tryPython = (exe) => new Promise((resolve) => {
    execFile(exe, [pyScriptPath, pdfPath, cacheFile], { timeout: 120000 }, (err, stdout) => {
      if (err) return resolve(null);
      const match = stdout.match(/DONE:(\d+)/);
      resolve(match ? parseInt(match[1]) : null);
    });
  });
  let pageCount = null;
  for (const exe of PYTHON_CANDIDATES) { pageCount = await tryPython(exe); if (pageCount !== null) break; }
  try { fs.unlinkSync(pyScriptPath); } catch (e) {}
  if (!pageCount) { if (logFn) logFn("error", "Could not render PDF pages."); return null; }
  if (logFn) logFn("success", `Rendered ${pageCount} pages ✓`);
  try { _pageImagesCacheMap[projectId] = JSON.parse(fs.readFileSync(cacheFile, "utf-8")); return _pageImagesCacheMap[projectId]; }
  catch (e) { return null; }
}

// ═══ PA-002: JV vs Sub reconciliation ════════════════════════════════════════
router.get("/:id/tests/pa-002", async (req, res) => {
  try {
    const db = await getDb();
    const projId = req.params.id;
    const lineItems = query(db, "SELECT * FROM line_items WHERE project_id=?", [projId]);
    const subApps = query(db, "SELECT * FROM subcontractor_applications WHERE project_id=?", [projId]);

    const subMap = {};
    for (const sa of subApps) {
      const norm = normalizeName(sa.subcontractor_name);
      if (!subMap[norm]) subMap[norm] = { totalThisPeriod: 0, apps: [], originalName: sa.subcontractor_name };
      const thisPeriod = parseFloat(sa.g703_work_this_period) || parseFloat(sa.completed_work_this_period) || 0;
      subMap[norm].totalThisPeriod += thisPeriod;
      subMap[norm].apps.push(sa);
    }

    const jvMap = {};
    for (const li of lineItems) {
      if (!li.contractor_name) continue;
      const norm = normalizeName(li.contractor_name);
      if (!jvMap[norm]) jvMap[norm] = { totalThisPeriod: 0, items: [], originalName: li.contractor_name };
      jvMap[norm].totalThisPeriod += parseFloat(li.work_completed_this) || 0;
      jvMap[norm].items.push(li);
    }

    const jvNames = Object.keys(jvMap).map(k => ({ norm: k, orig: jvMap[k].originalName }));
    const subNames = Object.keys(subMap).map(k => ({ norm: k, orig: subMap[k].originalName }));
    let llmMatches = {};
    try { llmMatches = await llmFuzzyMatch(jvNames, subNames); } catch (e) {}

    // Consolidate JV entries matching same sub
    const subToJvGroups = {};
    for (const [jvNorm, subNorm] of Object.entries(llmMatches)) {
      if (!subToJvGroups[subNorm]) subToJvGroups[subNorm] = [];
      subToJvGroups[subNorm].push(jvNorm);
    }

    const mergedJvMap = {};
    const alreadyMerged = new Set();
    for (const [subNorm, jvNorms] of Object.entries(subToJvGroups)) {
      if (jvNorms.length > 1) {
        const mergedKey = jvNorms.join("+");
        let totalThisPeriod = 0, allItems = [], names = [];
        for (const jvN of jvNorms) {
          if (jvMap[jvN]) { totalThisPeriod += jvMap[jvN].totalThisPeriod; allItems.push(...jvMap[jvN].items); names.push(jvMap[jvN].originalName); alreadyMerged.add(jvN); }
        }
        mergedJvMap[mergedKey] = { totalThisPeriod, items: allItems, originalName: names.join(" + "), matchedSubNorm: subNorm, matchMethod: "LLM" };
      } else {
        const jvN = jvNorms[0]; alreadyMerged.add(jvN);
        mergedJvMap[jvN] = { ...jvMap[jvN], matchedSubNorm: subNorm, matchMethod: "LLM" };
      }
    }

    for (const jvNorm of Object.keys(jvMap)) {
      if (alreadyMerged.has(jvNorm)) continue;
      let stringMatchSub = null, bestScore = 0;
      for (const subNorm of Object.keys(subMap)) {
        if (jvNorm === subNorm) { stringMatchSub = subNorm; bestScore = 100; break; }
        if (jvNorm.includes(subNorm) || subNorm.includes(jvNorm)) {
          const score = Math.min(jvNorm.length, subNorm.length) / Math.max(jvNorm.length, subNorm.length) * 90;
          if (score > bestScore) { bestScore = score; stringMatchSub = subNorm; }
        }
        const jvFirst = jvNorm.split(" ")[0]; const subFirst = subNorm.split(" ")[0];
        if (jvFirst.length > 3 && jvFirst === subFirst && bestScore < 70) { bestScore = 70; stringMatchSub = subNorm; }
      }
      if (bestScore < 50) stringMatchSub = null;
      if (stringMatchSub) {
        const ownerKey = Object.keys(mergedJvMap).find(k => mergedJvMap[k].matchedSubNorm === stringMatchSub);
        if (ownerKey && mergedJvMap[ownerKey]) {
          mergedJvMap[ownerKey].totalThisPeriod += jvMap[jvNorm].totalThisPeriod;
          mergedJvMap[ownerKey].items.push(...jvMap[jvNorm].items);
          mergedJvMap[ownerKey].originalName += " + " + jvMap[jvNorm].originalName;
          continue;
        }
      }
      mergedJvMap[jvNorm] = { ...jvMap[jvNorm], matchedSubNorm: stringMatchSub, matchMethod: stringMatchSub ? "String" : null };
    }

    const TOLERANCE = 10;
    const results = [];
    for (const [jvKey, jvData] of Object.entries(mergedJvMap)) {
      const jvAmount = Math.round(jvData.totalThisPeriod * 100) / 100;
      if (jvAmount === 0) continue;
      if (jvData.matchedSubNorm) {
        const subData = subMap[jvData.matchedSubNorm];
        const subAmount = Math.round(subData.totalThisPeriod * 100) / 100;
        const diff = Math.round((jvAmount - subAmount) * 100) / 100;
        const pass = Math.abs(diff) <= TOLERANCE;
        results.push({
          contractor_name: jvData.originalName, sub_name: subData.originalName + (subData.apps.length > 1 ? ` (${subData.apps.length} apps)` : ""),
          jv_this_period: jvAmount, sub_this_period: subAmount, difference: diff,
          status: pass ? "Pass" : "Fail", exception_category: pass ? null : "Observation",
          remarks: pass ? `Amounts match within ±$${TOLERANCE} tolerance` : `Variance of $${Math.abs(diff).toLocaleString()} detected`,
          matched: true, match_method: jvData.matchMethod,
          pay_apps: subData.apps.map(a => ({ id: a.id, subcontractor_name: a.subcontractor_name, application_no: a.application_no, start_page: a.start_page, end_page: a.end_page, g703_work_this_period: parseFloat(a.g703_work_this_period) || 0 })),
          source_data: { jv: buildJvSourceData(jvData.items) },
        });
      } else {
        results.push({
          contractor_name: jvData.originalName, sub_name: null, jv_this_period: jvAmount,
          sub_this_period: null, difference: null, status: "N/A",
          exception_category: "Missing Document", remarks: "Subcontractor Pay Application not found",
          matched: false, match_method: null, pay_apps: [], source_data: buildJvSourceData(jvData.items),
        });
      }
    }

    const passCount = results.filter(r => r.status === "Pass").length;
    const failCount = results.filter(r => r.status === "Fail").length;
    const naCount = results.filter(r => r.status === "N/A").length;

    res.json({
      test_id: "PA-002", test_name: "Reconcile JV Line Item to Subcontractor Pay Application(s)",
      tolerance: "±$10", run_date: new Date().toISOString(),
      summary: { total: results.length, pass: passCount, fail: failCount, na: naCount },
      results: results.sort((a, b) => { if (a.status === "Fail" && b.status !== "Fail") return -1; if (b.status === "Fail" && a.status !== "Fail") return 1; return (b.jv_this_period || 0) - (a.jv_this_period || 0); }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ PA-003a: Arithmetic Consistency — JV ════════════════════════════════════
router.get("/:id/tests/pa-003a", async (req, res) => {
  try {
    const db = await getDb();
    const projId = req.params.id;
    const TOLERANCE = 10;
    const results = [];
    const coverRows = query(db, "SELECT * FROM cover_page WHERE project_id=?", [projId]);
    const lineItems = query(db, "SELECT * FROM line_items WHERE project_id=?", [projId]);

    if (coverRows.length > 0 && lineItems.length > 0) {
      const cover = coverRows[0];
      const jvSums = { scheduled_current: 0, work_completed_prev: 0, work_completed_this: 0, materials_stored: 0, total_completed: 0, balance_to_finish: 0, retainage: 0 };
      for (const li of lineItems) {
        jvSums.scheduled_current += parseFloat(li.scheduled_current) || 0;
        jvSums.work_completed_prev += parseFloat(li.work_completed_prev) || 0;
        jvSums.work_completed_this += parseFloat(li.work_completed_this) || 0;
        jvSums.materials_stored += parseFloat(li.materials_stored) || 0;
        jvSums.total_completed += parseFloat(li.total_completed) || 0;
        jvSums.balance_to_finish += parseFloat(li.balance_to_finish) || 0;
        jvSums.retainage += parseFloat(li.retainage) || 0;
      }
      const jvChecks = [
        { column: "Scheduled Value (Current)", field: "scheduled_current", sum: jvSums.scheduled_current, expected: cover.contract_sum_to_date, coverField: "contract_sum_to_date" },
        { column: "Total Completed & Stored", field: "total_completed", sum: jvSums.total_completed, expected: cover.total_completed_stored, coverField: "total_completed_stored" },
        { column: "Balance to Finish", field: "balance_to_finish", sum: jvSums.balance_to_finish, expected: cover.balance_to_finish, coverField: "balance_to_finish" },
        { column: "Retainage", field: "retainage", sum: jvSums.retainage, expected: cover.total_retainage, coverField: "total_retainage" },
      ];
      for (const check of jvChecks) {
        if (check.expected === null || check.expected === undefined) continue;
        const sumVal = Math.round(check.sum * 100) / 100;
        const expVal = Math.round(parseFloat(check.expected) * 100) / 100;
        const diff = Math.round((sumVal - expVal) * 100) / 100;
        const pass = Math.abs(diff) <= TOLERANCE;
        results.push({
          document: "JV Pay App", app_name: cover.from_contractor || "JV Continuation Sheet",
          column: check.column, line_items_sum: sumVal, grand_total: expVal, difference: diff,
          line_count: lineItems.length, status: pass ? "Pass" : "Fail",
          remarks: pass ? "Line items sum matches cover page grand total within ±$" + TOLERANCE : "Arithmetic mismatch (Δ $" + Math.abs(diff).toLocaleString() + ")",
        });
      }
    }

    const passCount = results.filter(r => r.status === "Pass").length;
    const failCount = results.filter(r => r.status === "Fail").length;
    res.json({
      test_id: "PA-003a", test_name: "JV Pay App — Arithmetic Consistency",
      tolerance: "±$10", run_date: new Date().toISOString(),
      summary: { total: results.length, pass: passCount, fail: failCount, na: 0 },
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ PA-003b: Arithmetic Consistency — Subcontractor ═════════════════════════
router.get("/:id/tests/pa-003b", async (req, res) => {
  try {
    const db = await getDb();
    const projId = req.params.id;
    const TOLERANCE = 10;
    const results = [];
    const subApps = query(db, "SELECT * FROM subcontractor_applications WHERE project_id=?", [projId]);
    const allSubLines = query(db, "SELECT * FROM sub_line_items WHERE project_id=?", [projId]);
    const subLinesByApp = {};
    for (const sl of allSubLines) { if (!subLinesByApp[sl.sub_app_id]) subLinesByApp[sl.sub_app_id] = []; subLinesByApp[sl.sub_app_id].push(sl); }

    for (const sa of subApps) {
      const lines = subLinesByApp[sa.id] || [];
      if (lines.length === 0) continue;
      const sums = { scheduled_value: 0, work_completed_prev: 0, work_completed_this: 0, materials_stored: 0, total_completed: 0, retainage: 0 };
      for (const sl of lines) {
        sums.scheduled_value += parseFloat(sl.scheduled_value) || 0;
        sums.work_completed_prev += parseFloat(sl.work_completed_prev) || 0;
        sums.work_completed_this += parseFloat(sl.work_completed_this) || 0;
        sums.materials_stored += parseFloat(sl.materials_stored) || 0;
        sums.total_completed += parseFloat(sl.total_completed) || 0;
        sums.retainage += parseFloat(sl.retainage) || 0;
      }
      const subChecks = [
        { column: "Scheduled Value", field: "scheduled_value", sum: sums.scheduled_value, expected: sa.g703_scheduled_value },
        { column: "Work Completed - This Period", field: "work_completed_this", sum: sums.work_completed_this, expected: sa.g703_work_this_period },
        { column: "Total Completed & Stored", field: "total_completed", sum: sums.total_completed, expected: sa.g703_total_completed },
        { column: "Retainage", field: "retainage", sum: sums.retainage, expected: sa.g703_retainage },
      ];
      for (const check of subChecks) {
        if (check.expected === null || check.expected === undefined) continue;
        const sumVal = Math.round(check.sum * 100) / 100;
        const expVal = Math.round(parseFloat(check.expected) * 100) / 100;
        const diff = Math.round((sumVal - expVal) * 100) / 100;
        const pass = Math.abs(diff) <= TOLERANCE;
        results.push({
          document: "Sub Pay App", app_name: sa.subcontractor_name, app_id: sa.id,
          column: check.column, line_items_sum: sumVal, grand_total: expVal, difference: diff,
          line_count: lines.length, status: pass ? "Pass" : "Fail",
          remarks: pass ? "Line items sum matches G703 grand total" : "Arithmetic mismatch (Δ $" + Math.abs(diff).toLocaleString() + ")",
        });
      }
    }

    const passCount = results.filter(r => r.status === "Pass").length;
    const failCount = results.filter(r => r.status === "Fail").length;
    res.json({
      test_id: "PA-003b", test_name: "Subcontractor Pay Apps — Arithmetic Consistency",
      tolerance: "±$10", run_date: new Date().toISOString(),
      summary: { total: results.length, pass: passCount, fail: failCount, na: 0 },
      results: results.sort((a, b) => { if (a.status === "Fail" && b.status !== "Fail") return -1; return Math.abs(b.difference || 0) - Math.abs(a.difference || 0); }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ POST validate-ai — GPT Vision validation of line items ══════════════════
router.post("/:id/validate-ai", async (req, res) => {
  const projectId = req.params.id;
  try {
    const db = await getDb();
    const projRows = query(db, "SELECT * FROM projects WHERE id=?", [projectId]);
    if (!projRows.length) return res.status(404).json({ error: "Project not found" });
    const pdfPath = projRows[0].pdf_path;

    res.json({ success: true, message: "AI validation started" });

    const log = (level, message) => { run(db, "INSERT INTO logs (project_id, level, message) VALUES (?,?,?)", [projectId, level, message]); };
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    log("step", "🤖 AI Validation starting…");
    log("info", `Model: ${AZURE_OAI_DEPLOYMENT} (GPT-5.4 Vision)`);

    const pageImages = await ensurePageImages(projectId, pdfPath, log);
    if (!pageImages) { log("error", "No page images available — cannot validate."); return; }

    const items = query(db, "SELECT * FROM line_items WHERE project_id=?", [projectId]);
    if (!items.length) { log("warn", "No line items to validate"); return; }
    log("info", `Validating ${items.length} line items across ${Object.keys(pageImages).length} pages…`);
    run(db, "UPDATE line_items SET validation_status='checking' WHERE project_id=?", [projectId]);

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ baseURL: AZURE_OAI_ENDPOINT, apiKey: AZURE_OAI_KEY });

    const SYSTEM = `You are a construction payment application auditor verifying extracted data against PDF images.
Compare each field value to what you see in the document image. Allow ±$1 rounding.
Return ONLY JSON: {"status":"valid"|"warning","items":[{"id":N,"status":"valid"|"warning","note":"..."}]}`;

    // Group items by page
    const byPage = {};
    for (const item of items) { const p = String(item.source_page || 1); if (!byPage[p]) byPage[p] = []; byPage[p].push(item); }

    let validCount = 0, warnCount = 0;
    const pageKeys = Object.keys(byPage).sort((a, b) => parseInt(a) - parseInt(b));

    for (const pageNo of pageKeys) {
      const pageItems = byPage[pageNo];
      const b64 = pageImages[pageNo];
      if (!b64) { for (const it of pageItems) { run(db, "UPDATE line_items SET validation_status='unchecked' WHERE id=?", [it.id]); } continue; }

      const itemsDesc = pageItems.map(it => `ID ${it.id}: ${it.contractor_name || "?"} | This=$${it.work_completed_this} Prev=$${it.work_completed_prev} Sched=$${it.scheduled_current} Total=$${it.total_completed}`).join("\n");

      try {
        const resp = await openai.responses.create({
          model: AZURE_OAI_DEPLOYMENT, instructions: SYSTEM,
          input: [{ role: "user", content: [
            { type: "input_text", text: `Verify these extracted values from page ${pageNo}:\n${itemsDesc}` },
            { type: "input_image", image_url: `data:image/jpeg;base64,${b64}` },
          ]}],
          temperature: 0, max_output_tokens: 2000,
        });
        const raw = (resp.output_text || "").replace(/^```json\n?/i,"").replace(/```$/i,"").trim();
        const result = JSON.parse(raw);
        for (const itemResult of (result.items || [])) {
          const status = itemResult.status === "valid" ? "valid" : "warning";
          const note = (itemResult.note || "").slice(0, 500);
          run(db, "UPDATE line_items SET validation_status=?, validation_note=? WHERE id=?", [status, note, itemResult.id]);
          if (status === "valid") validCount++; else warnCount++;
        }
        log("info", `Page ${pageNo}: ${pageItems.length} items validated`);
      } catch (e) {
        log("error", `Page ${pageNo} failed: ${e.message.slice(0, 80)}`);
        for (const it of pageItems) { run(db, "UPDATE line_items SET validation_status='unchecked', validation_note=? WHERE id=?", [`Error: ${e.message.slice(0,100)}`, it.id]); }
      }
      await wait(200);
    }

    log("step", `✅ AI Validation complete — ✓ ${validCount} valid, ⚠ ${warnCount} warnings`);
  } catch (err) {
    console.error("AI validation error:", err);
  }
});

// ═══ POST validate-ai/item/:itemId — single item validation ══════════════════
router.post("/:id/validate-ai/item/:itemId", async (req, res) => {
  const { id: projectId, itemId } = req.params;
  try {
    const db = await getDb();
    const projRows = query(db, "SELECT * FROM projects WHERE id=?", [projectId]);
    if (!projRows.length) return res.status(404).json({ error: "Project not found" });
    const items = query(db, "SELECT * FROM line_items WHERE id=? AND project_id=?", [itemId, projectId]);
    if (!items.length) return res.status(404).json({ error: "Item not found" });
    const item = items[0];
    const pageImages = await ensurePageImages(projectId, projRows[0].pdf_path, null);
    if (!pageImages) return res.status(400).json({ error: "No page images available" });
    const b64 = pageImages[String(item.source_page || 1)];
    if (!b64) return res.status(400).json({ error: "Page image not available" });

    run(db, "UPDATE line_items SET validation_status='checking' WHERE id=?", [itemId]);

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ baseURL: AZURE_OAI_ENDPOINT, apiKey: AZURE_OAI_KEY });

    const desc = `Item ID ${item.id}: Contractor="${item.contractor_name}" | This Period=$${item.work_completed_this} | Prev=$${item.work_completed_prev} | Scheduled=$${item.scheduled_current} | Total=$${item.total_completed} | Retainage=$${item.retainage}`;
    const resp = await openai.responses.create({
      model: AZURE_OAI_DEPLOYMENT,
      instructions: "You verify extracted construction data against PDF. Return JSON: {\"status\":\"valid\"|\"warning\",\"note\":\"...\"}",
      input: [{ role: "user", content: [
        { type: "input_text", text: `Verify from page ${item.source_page}:\n${desc}` },
        { type: "input_image", image_url: `data:image/jpeg;base64,${b64}` },
      ]}],
      temperature: 0, max_output_tokens: 500,
    });
    const raw = (resp.output_text || "").replace(/^```json\n?/i,"").replace(/```$/i,"").trim();
    const result = JSON.parse(raw);
    const status = result.status === "valid" ? "valid" : "warning";
    run(db, "UPDATE line_items SET validation_status=?, validation_note=? WHERE id=?", [status, (result.note || "").slice(0, 500), itemId]);
    res.json({ id: parseInt(itemId), status, note: result.note || "" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ Validation summaries ════════════════════════════════════════════════════
router.get("/:id/validation-summary", async (req, res) => {
  try {
    const db = await getDb();
    const items = query(db, "SELECT validation_status FROM line_items WHERE project_id = ?", [req.params.id]);
    const summary = { total: items.length, valid: 0, warning: 0, unchecked: 0, checking: 0 };
    for (const item of items) { const s = item.validation_status || "unchecked"; summary[s] = (summary[s] || 0) + 1; }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/sub-validation-summary", async (req, res) => {
  try {
    const db = await getDb();
    const rows = query(db, "SELECT validation_status FROM subcontractor_applications WHERE project_id=?", [req.params.id]);
    const summary = { total: rows.length, valid: 0, warning: 0, unchecked: 0, checking: 0 };
    for (const r of rows) { const s = r.validation_status || "unchecked"; summary[s] = (summary[s] || 0) + 1; }
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
