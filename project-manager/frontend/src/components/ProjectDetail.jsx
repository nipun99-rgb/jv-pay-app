import { useState, useEffect, useCallback, useMemo } from "react";
import DataTable from "./DataTable";
import InputModal from "./InputModal";
import OutputPanel from "./OutputPanel";
import CoverPageTable from "./CoverPageTable";
import JourneyPanel from "./JourneyPanel";
import SubcontractorTable from "./SubcontractorTable";

const API = "/api";

const fmtMoney = (n) => {
  const v = parseFloat(n);
  if (isNaN(v)) return "—";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export default function ProjectDetail({ project, onDelete, onBack, onProjectUpdate }) {
  const [tasks, setTasks]             = useState([]);
  const [lineItems, setLineItems]     = useState([]);
  const [showInputs, setShowInputs]   = useState(false);
  const [localProject, setLocalProject] = useState(project);
  const [pdfPage, setPdfPage]         = useState(1);
  // view: "setup" | "validate"  (journey is now inline, not a separate view)
  const [view, setView]               = useState("setup");
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [filterThisPeriod, setFilterThisPeriod] = useState(true);
  const [coverPage, setCoverPage]     = useState(null);
  // activePhase: 1=Contractor(cover+G703), 2=Subcontractors, 3=GCGR
  const [activePhase, setActivePhase] = useState(1);
  // gcTab: within Phase 1 — "cover" | "continuation"
  const [gcTab, setGcTab]             = useState("continuation");
  const [validating, setValidating]   = useState(false);
  const [showValidationLogs, setShowValidationLogs] = useState(false);
  const [journeyCollapsed, setJourneyCollapsed] = useState(false);
  const [phases, setPhases]           = useState([]);
  const [subApps, setSubApps]         = useState([]);

  useEffect(() => { setLocalProject(project); }, [project]);

  // Auto-switch view based on data availability
  useEffect(() => {
    setView(lineItems.length > 0 ? "validate" : "setup");
  }, [lineItems.length]);

  /* ── Data loaders ────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    try {
      const [tRes, lRes, cRes] = await Promise.all([
        fetch(`${API}/projects/${localProject.id}/tasks`),
        fetch(`${API}/projects/${localProject.id}/line-items`),
        fetch(`${API}/projects/${localProject.id}/cover-page`),
      ]);
      let tasksData = await tRes.json();
      setLineItems(await lRes.json());
      setCoverPage(await cRes.json());
      if (tasksData.length === 0) {
        await fetch(`${API}/projects/${localProject.id}/tasks/init`, { method: "POST" });
        const r = await fetch(`${API}/projects/${localProject.id}/tasks`);
        tasksData = await r.json();
      }
      setTasks(tasksData);
    } catch (err) {
      console.error("Failed to load project data:", err);
    }
  }, [localProject.id]);

  const loadPhases = useCallback(async (freshData) => {
    if (freshData) { setPhases(freshData); return; }
    try {
      const res = await fetch(`${API}/projects/${localProject.id}/phases`);
      setPhases(await res.json());
    } catch (err) {
      console.error("Failed to load phases:", err);
    }
  }, [localProject.id]);

  const loadSubApps = useCallback(async () => {
    try {
      const res = await fetch(`${API}/projects/${localProject.id}/subcontractor-applications`);
      setSubApps(await res.json());
    } catch (err) {
      console.error("Failed to load subcontractor apps:", err);
    }
  }, [localProject.id]);

  useEffect(() => { loadData(); },   [loadData]);
  useEffect(() => { loadPhases(); }, [loadPhases]);

  /* ── Handlers ────────────────────────────────────────────────────────── */
  const handleSaveInputs = async (updatedProject) => {
    setLocalProject(updatedProject);
    if (onProjectUpdate) onProjectUpdate(updatedProject);
    const configTask = tasks.find((t) => t.step_number === 1);
    if (configTask && configTask.status !== "complete") {
      await fetch(`${API}/projects/${localProject.id}/tasks/${configTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete" }),
      });
      loadData();
    }
    setShowInputs(false);
  };

  const handleUpdateItem = async (itemId, fields) => {
    await fetch(`${API}/projects/${localProject.id}/line-items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    loadData();
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Delete this row?")) return;
    await fetch(`${API}/projects/${localProject.id}/line-items/${itemId}`, { method: "DELETE" });
    loadData();
  };

  const handleAddItem = async () => {
    await fetch(`${API}/projects/${localProject.id}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_no: "", type_of_work: "New Item" }),
    });
    loadData();
  };

  const handleDelete = () => {
    if (window.confirm(`Delete project "${localProject.name}"? This cannot be undone.`)) {
      onDelete(localProject.id);
    }
  };

  const handleRowClick = (item) => {
    if (item.source_page) setPdfPage(Number(item.source_page));
  };

  const handleUpdateCover = async (fieldKey, value) => {
    await fetch(`${API}/projects/${localProject.id}/cover-page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [fieldKey]: value }),
    });
    const res = await fetch(`${API}/projects/${localProject.id}/cover-page`);
    setCoverPage(await res.json());
  };

  const handleRevalidateItem = async (itemId) => {
    await fetch(`${API}/projects/${localProject.id}/validate-ai/item/${itemId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setShowValidationLogs(true);
    const poll = setInterval(async () => {
      const r = await fetch(`${API}/projects/${localProject.id}/validation-summary`);
      const s = await r.json();
      if (s.checking === 0) { clearInterval(poll); loadData(); }
    }, 1500);
  };

  const handleAIValidate = async () => {
    setValidating(true);
    setShowValidationLogs(true);
    try {
      await fetch(`${API}/projects/${localProject.id}/validate-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const poll = setInterval(async () => {
        const r = await fetch(`${API}/projects/${localProject.id}/validation-summary`);
        const summary = await r.json();
        if (summary.checking === 0) {
          clearInterval(poll);
          setTimeout(async () => {
            setValidating(false);
            await loadData();
          }, 3000);
        }
      }, 2000);
    } catch (err) {
      console.error("AI Validation failed:", err);
      setValidating(false);
    }
  };

  // Journey phase click — changes what's shown below, no navigation away
  const handlePhaseSelect = async (phaseNum) => {
    setActivePhase(phaseNum);
    if (view !== "validate") setView("validate");
    if (phaseNum === 2) await loadSubApps();
  };

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    try {
      await fetch(`${API}/projects/${localProject.id}/run-pipeline`, { method: "POST" });
      const poll = setInterval(async () => {
        const r = await fetch(`${API}/projects/${localProject.id}/tasks`);
        const t = await r.json();
        setTasks(t);
        const allDone = t.filter((x) => x.step_number >= 2).every((x) => x.status === "complete");
        if (allDone) {
          clearInterval(poll);
          setPipelineRunning(false);
          loadData();
        }
      }, 2000);
    } catch (err) {
      console.error("Pipeline failed:", err);
      setPipelineRunning(false);
    }
  };

  /* ── Derived data ────────────────────────────────────────────────────── */
  const completedSteps = tasks.filter((t) => t.status === "complete").length;
  const totalSteps     = tasks.length || 4;
  const progressPct    = Math.round((completedSteps / totalSteps) * 100);

  const filteredItems = useMemo(() => {
    if (!filterThisPeriod) return lineItems;
    return lineItems.filter((item) => {
      const val = Number(item.work_completed_this);
      return val !== 0 && !isNaN(val);
    });
  }, [lineItems, filterThisPeriod]);

  const relevantPages = useMemo(() => {
    const pages = [...new Set(filteredItems.map((i) => Number(i.source_page)).filter(Boolean))];
    return pages.sort((a, b) => a - b);
  }, [filteredItems]);

  // G703 summary stats
  const g703Stats = useMemo(() => {
    const scheduled   = lineItems.reduce((s, i) => s + (parseFloat(i.scheduled_value)      || 0), 0);
    const thisPeriod  = lineItems.reduce((s, i) => s + (parseFloat(i.work_completed_this)   || 0), 0);
    const activeItems = lineItems.filter(i => (parseFloat(i.work_completed_this) || 0) !== 0).length;
    const valid       = lineItems.filter(i => i.validation_status === "valid").length;
    const warn        = lineItems.filter(i => i.validation_status === "warning").length;
    return { scheduled, thisPeriod, activeItems, valid, warn };
  }, [lineItems]);

  // Cover page summary stats
  const coverStats = useMemo(() => {
    if (!coverPage) return null;
    return {
      contractSum:    parseFloat(coverPage.contract_sum_to_date)     || 0,
      paymentDue:     parseFloat(coverPage.current_payment_due)       || 0,
      totalCompleted: parseFloat(coverPage.total_completed_stored)    || 0,
      balance:        parseFloat(coverPage.balance_to_finish)         || 0,
    };
  }, [coverPage]);

  const goToPrevPage = () => {
    const prev = relevantPages.filter((p) => p < pdfPage);
    if (prev.length > 0) setPdfPage(prev[prev.length - 1]);
  };
  const goToNextPage = () => {
    const next = relevantPages.filter((p) => p > pdfPage);
    if (next.length > 0) setPdfPage(next[0]);
  };

  // Phase 2 data
  const phase2    = phases.find(p => p.phase_number === 2);
  const hasSubPdf = !!phase2?.pdf_path;

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="ws">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="ws-header">
        <button className="ws-back" onClick={onBack}>←</button>
        <div className="ws-header-info">
          <h1>{localProject.name}</h1>
          <span className="ws-baseline-tag">{localProject.baseline}</span>
        </div>

        {/* Pipeline step chips */}
        <div className="ws-progress">
          {tasks.map((t) => (
            <div key={t.id} className={`ws-chip ws-chip-${t.status}`} title={t.step_name}>
              {t.status === "complete" ? "✓" : t.step_number}
              <span className="ws-chip-label">{t.step_name}</span>
            </div>
          ))}
        </div>

        <div className="ws-header-actions">
          <button className="ws-btn ws-btn-primary" onClick={() => setShowInputs(true)}>
            📄 Upload PDF
          </button>

          {lineItems.length > 0 && view === "validate" && activePhase === 1 && (
            <button
              className={`ws-btn ws-btn-ai${validating ? " ws-btn-ai-running" : ""}`}
              onClick={handleAIValidate}
              disabled={validating}
              title="Azure GPT-5.4 Vision checks every extracted value against the original PDF"
            >
              {validating ? "🤖 Validating…" : "🤖 AI Validate"}
            </button>
          )}

          {view === "validate" && showValidationLogs && !validating && activePhase === 1 && (
            <button
              className="ws-btn ws-btn-ghost"
              onClick={() => setShowValidationLogs(false)}
              title="Switch back to PDF view"
            >
              📄 Show PDF
            </button>
          )}

          {lineItems.length > 0 && view === "setup" && (
            <button className="ws-btn ws-btn-accent" onClick={() => setView("validate")}>
              ✎ Validate Data
            </button>
          )}

          {view === "validate" && (
            <button className="ws-btn ws-btn-ghost" onClick={() => setView("setup")}>
              ◧ Overview
            </button>
          )}

          <button className="ws-btn ws-btn-danger" onClick={handleDelete}>🗑</button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════
          SETUP VIEW
          ══════════════════════════════════════════════════════════════════ */}
      {view === "setup" && (
        <div className="ws-setup-split">
          <div className="ws-setup-left">
            <div className="ws-setup-card">
              <div className="ws-setup-icon">🚀</div>
              <h2>Get Started</h2>
              <p>Set up your project pipeline to extract and validate data from your PDF.</p>

              <div className="ws-progress-bar">
                <div className="ws-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="ws-progress-label">
                {completedSteps} of {totalSteps} steps complete
              </span>

              <div className="ws-steps">
                {tasks.map((t) => (
                  <div key={t.id} className={`ws-step ws-step-${t.status}`}>
                    <div className="ws-step-circle">
                      {t.status === "complete" ? "✓" : t.status === "running" ? "⟳" : t.step_number}
                    </div>
                    <div className="ws-step-info">
                      <strong>{t.step_name}</strong>
                      <span>
                        {t.status === "complete"  ? "Completed"
                          : t.status === "running" ? "In progress…"
                          : t.step_number === 1    ? "Upload your Contractor Payment Application PDF"
                          : t.step_number === 2    ? "Extract line items from PDF"
                          : t.step_number === 3    ? "Save extracted data to database"
                          : "Review, edit, and approve results"}
                      </span>
                    </div>
                    {t.step_number === 1 && t.status !== "complete" && (
                      <button
                        className="ws-btn ws-btn-sm ws-btn-primary"
                        onClick={() => setShowInputs(true)}
                      >Upload</button>
                    )}
                    {t.step_number === 2 && t.status !== "complete" && localProject.pdf_path && (
                      <button
                        className="ws-btn ws-btn-sm ws-btn-accent"
                        onClick={handleRunPipeline}
                        disabled={pipelineRunning}
                      >
                        {pipelineRunning ? "Running…" : "▶ Run"}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {localProject.pdf_path && (
                <div className="ws-pdf-badge">
                  📄 {localProject.pdf_path.split("\\").pop().split("/").pop()}
                </div>
              )}
            </div>
          </div>

          <div className="ws-setup-right">
            <OutputPanel projectId={localProject.id} visible={true} />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VALIDATE VIEW — journey strip (inline) + phase-specific content
          ══════════════════════════════════════════════════════════════════ */}
      {view === "validate" && (
        <div className="ws-body">

          {/* Journey strip — always visible, collapsible */}
          <JourneyPanel
            projectId={localProject.id}
            phases={phases}
            activePhase={activePhase}
            onPhaseSelect={handlePhaseSelect}
            collapsed={journeyCollapsed}
            onToggleCollapse={() => setJourneyCollapsed(!journeyCollapsed)}
            onPhasesUpdated={loadPhases}
          />

          {/* ── Phase 1: Contractor Payment Application ────────────────── */}
          {activePhase === 1 && (
            <div className="ws-validate">

              {/* Left panel: tab bar + content */}
              <div className="ws-validate-data">

                {/* Tab bar */}
                <div className="ws-tab-bar">
                  <button
                    className={`ws-tab${gcTab === "cover" ? " active" : ""}`}
                    onClick={() => { setGcTab("cover"); setPdfPage(1); }}
                  >
                    <span className="ws-tab-icon">📋</span>
                    <span className="ws-tab-text">Cover Page</span>
                    <span className="ws-tab-badge">G702</span>
                  </button>
                  <button
                    className={`ws-tab${gcTab === "continuation" ? " active" : ""}`}
                    onClick={() => {
                      setGcTab("continuation");
                      if (relevantPages.length) setPdfPage(relevantPages[0]);
                    }}
                  >
                    <span className="ws-tab-icon">📊</span>
                    <span className="ws-tab-text">Continuation Sheet</span>
                    <span className="ws-tab-badge">G703</span>
                  </button>
                </div>

                {/* ── Cover Page ── */}
                {gcTab === "cover" && (
                  <>
                    {/* Summary bar — matches subcontractor table style */}
                    {coverStats && (
                      <div className="sub-summary-bar">
                        <div className="sub-stat">
                          <span className="sub-stat-val">{fmtMoney(coverStats.contractSum)}</span>
                          <span className="sub-stat-lbl">Contract Sum to Date</span>
                        </div>
                        <div className="sub-stat">
                          <span className="sub-stat-val">{fmtMoney(coverStats.totalCompleted)}</span>
                          <span className="sub-stat-lbl">Total Completed &amp; Stored</span>
                        </div>
                        <div className="sub-stat ok">
                          <span className="sub-stat-val">{fmtMoney(coverStats.paymentDue)}</span>
                          <span className="sub-stat-lbl">Current Payment Due</span>
                        </div>
                        <div className="sub-stat">
                          <span className="sub-stat-val">{fmtMoney(coverStats.balance)}</span>
                          <span className="sub-stat-lbl">Balance to Finish</span>
                        </div>
                      </div>
                    )}
                    {coverPage ? (
                      <CoverPageTable coverPage={coverPage} onUpdate={handleUpdateCover} />
                    ) : (
                      <div className="data-table-container data-empty">
                        <div className="data-empty-icon">📋</div>
                        <h3>No cover page data</h3>
                        <p>Run the pipeline to extract G702 cover page data.</p>
                      </div>
                    )}
                  </>
                )}

                {/* ── Continuation Sheet ── */}
                {gcTab === "continuation" && (
                  <>
                    {/* Summary bar — matches subcontractor table style */}
                    <div className="sub-summary-bar">
                      <div className="sub-stat">
                        <span className="sub-stat-val">{lineItems.length}</span>
                        <span className="sub-stat-lbl">Total Line Items</span>
                      </div>
                      <div className="sub-stat">
                        <span className="sub-stat-val">{g703Stats.activeItems}</span>
                        <span className="sub-stat-lbl">Active This Period</span>
                      </div>
                      <div className={`sub-stat${g703Stats.warn > 0 ? " warn" : " ok"}`}>
                        <span className="sub-stat-val">{fmtMoney(g703Stats.thisPeriod)}</span>
                        <span className="sub-stat-lbl">Work Completed This Period</span>
                      </div>
                      <div className="sub-stat">
                        <span className="sub-stat-val">{fmtMoney(g703Stats.scheduled)}</span>
                        <span className="sub-stat-lbl">Total Scheduled Value</span>
                      </div>
                    </div>

                    {/* Filter bar */}
                    <div className="ws-filter-bar">
                      <button
                        className={`ws-filter-btn${filterThisPeriod ? " active" : ""}`}
                        onClick={() => setFilterThisPeriod(!filterThisPeriod)}
                      >
                        {filterThisPeriod ? "⚡ This Period Only" : "📋 All Items"}
                      </button>
                      <span className="ws-filter-info">
                        {filterThisPeriod
                          ? `${filteredItems.length} of ${lineItems.length} items with activity`
                          : `${lineItems.length} total items`}
                      </span>
                      {lineItems.some(
                        i => i.validation_status === "valid" || i.validation_status === "warning"
                      ) && (
                        <div className="ws-validation-summary">
                          <span className="ws-vs-item ws-vs-valid">✓ {g703Stats.valid}</span>
                          <span className="ws-vs-item ws-vs-warn">⚠ {g703Stats.warn}</span>
                        </div>
                      )}
                    </div>

                    <DataTable
                      items={filteredItems}
                      onUpdateItem={handleUpdateItem}
                      onDeleteItem={handleDeleteItem}
                      onAddItem={handleAddItem}
                      onRowClick={handleRowClick}
                      activePage={pdfPage}
                      onRevalidateItem={handleRevalidateItem}
                    />
                  </>
                )}
              </div>

              {/* Right panel: PDF viewer */}
              <div className="ws-validate-pdf">
                {showValidationLogs ? (
                  <OutputPanel projectId={localProject.id} visible={true} />
                ) : (
                  <>
                    <div className="ws-pdf-bar">
                      <span className="ws-pdf-title">📄 Source PDF</span>
                      <div className="ws-pdf-nav">
                        {gcTab === "cover" ? (
                          <span className="ws-page-display">Page 1 — Cover</span>
                        ) : (
                          <>
                            <button
                              className="ws-pdf-nav-btn"
                              onClick={goToPrevPage}
                              disabled={!relevantPages.length || pdfPage <= relevantPages[0]}
                            >◀</button>
                            <span className="ws-page-display">
                              Page {pdfPage} of {relevantPages[relevantPages.length - 1] || "?"}
                            </span>
                            <button
                              className="ws-pdf-nav-btn"
                              onClick={goToNextPage}
                              disabled={!relevantPages.length || pdfPage >= relevantPages[relevantPages.length - 1]}
                            >▶</button>
                          </>
                        )}
                      </div>
                    </div>
                    {localProject.pdf_path ? (
                      <iframe
                        className="ws-pdf-frame"
                        src={
                          gcTab === "cover"
                            ? `/api/projects/${localProject.id}/pdf/pages?from=1&to=1`
                            : `/api/projects/${localProject.id}/pdf/pages?from=${pdfPage}&to=${pdfPage}`
                        }
                        key={gcTab === "cover" ? "cover-only" : `page-${pdfPage}`}
                        title="PDF"
                      />
                    ) : (
                      <div className="ws-pdf-empty">
                        <p>No PDF uploaded yet.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Phase 2: Subcontractor Payment Application ─────────────── */}
          {activePhase === 2 && (
            <div className="ws-validate">

              {/* Left panel: subcontractor table */}
              <div className="ws-validate-data">
                <SubcontractorTable apps={subApps} />
              </div>

              {/* Right panel: subcontractor PDF */}
              <div className="ws-validate-pdf">
                <div className="ws-pdf-bar">
                  <span className="ws-pdf-title">📄 Subcontractor PDF</span>
                  {hasSubPdf && (
                    <span className="ws-page-display">
                      {phase2.pdf_path.split(/[/\\]/).pop()}
                    </span>
                  )}
                </div>
                {hasSubPdf ? (
                  <iframe
                    className="ws-pdf-frame"
                    src={`/api/projects/${localProject.id}/sub-pdf`}
                    title="Subcontractor PDF"
                  />
                ) : (
                  <div className="ws-pdf-empty">
                    <div className="ws-pdf-empty-inner">
                      <div className="ws-pdf-empty-icon">📄</div>
                      <p className="ws-pdf-empty-title">No subcontractor PDF</p>
                      <p className="ws-pdf-empty-hint">
                        Upload a PDF using the journey panel above to view it here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Phase 3: GC GR ────────────────────────────────────────── */}
          {activePhase === 3 && (
            <div className="ws-validate">
              <div className="ws-validate-data ws-phase-placeholder">
                <div className="ws-placeholder-inner">
                  <div className="ws-placeholder-icon">📁</div>
                  <h3>GC General Requirements</h3>
                  <p>Extraction pipeline coming soon.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Input Modal ──────────────────────────────────────────────────── */}
      {showInputs && (
        <InputModal
          project={localProject}
          onSave={handleSaveInputs}
          onClose={() => setShowInputs(false)}
        />
      )}
    </div>
  );
}
