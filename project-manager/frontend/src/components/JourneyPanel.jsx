import { useState, useRef, useEffect, useCallback } from "react";
import "./JourneyPanel.css";

const API = "/api";

const PHASE_DEFS = [
  { num: 1, short: "Contractor Pay App",      label: "Contractor Payment Application",      icon: "🏗" },
  { num: 2, short: "Subcontractor Pay App",   label: "Subcontractor Payment Application",   icon: "🔩" },
  { num: 3, short: "GC GR",                   label: "GC General Requirements",             icon: "📁" },
];

export default function JourneyPanel({
  projectId,
  phases,
  activePhase,
  onPhaseSelect,
  collapsed,
  onToggleCollapse,
  onPhasesUpdated,
}) {
  const [uploading, setUploading]   = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [logs, setLogs]             = useState([]);
  const fileInputRef                = useRef(null);
  const pollRef                     = useRef(null);
  const pollLogsRef                 = useRef(null);
  const lastLogIdRef                = useRef(0);

  const ph = [
    phases.find(p => p.phase_number === 1) || { status: "pending", item_count: 0, phase_number: 1 },
    phases.find(p => p.phase_number === 2) || { status: "pending", item_count: 0, phase_number: 2 },
    phases.find(p => p.phase_number === 3) || { status: "pending", item_count: 0, phase_number: 3 },
  ];
  const phase2 = ph[1];

  // Resume polling if phase 2 was already running
  useEffect(() => {
    if (phase2.status === "running") {
      setExtracting(true);
      startPolling();
    }
    return () => {
      clearInterval(pollRef.current);
      clearInterval(pollLogsRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const rows = await fetch(
        `${API}/projects/${projectId}/logs?after=${lastLogIdRef.current}`
      ).then(r => r.json());
      if (rows.length) {
        lastLogIdRef.current = rows[rows.length - 1].id;
        setLogs(prev => [...prev, ...rows.map(r => ({ level: r.level, msg: r.message }))]);
      }
    } catch (_) {}
  }, [projectId]);

  const startPolling = useCallback(() => {
    clearInterval(pollRef.current);
    clearInterval(pollLogsRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const freshPhases = await fetch(`${API}/projects/${projectId}/phases`).then(r => r.json());
        if (onPhasesUpdated) onPhasesUpdated(freshPhases);
        const p2 = freshPhases.find(p => p.phase_number === 2);
        if (p2 && (p2.status === "complete" || p2.status === "error")) {
          clearInterval(pollRef.current);
          clearInterval(pollLogsRef.current);
          setExtracting(false);
          setLogs(l => [
            ...l,
            {
              level: p2.status === "complete" ? "success" : "error",
              msg: p2.status === "complete"
                ? `✓ Extraction complete — ${p2.item_count} applications found`
                : "✗ Extraction failed",
            },
          ]);
        }
      } catch (_) {}
    }, 3000);

    pollLogsRef.current = setInterval(fetchLogs, 2000);
  }, [projectId, onPhasesUpdated, fetchLogs]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setLogs([{ level: "info", msg: `Uploading "${file.name}"…` }]);
    try {
      const form = new FormData();
      form.append("pdf", file);
      const res = await fetch(
        `${API}/projects/${projectId}/upload-subcontractor`,
        { method: "POST", body: form }
      );
      const data = await res.json();
      if (data.success) {
        setLogs(l => [...l, { level: "success", msg: "✓ PDF uploaded successfully" }]);
        const freshPhases = await fetch(`${API}/projects/${projectId}/phases`).then(r => r.json());
        if (onPhasesUpdated) onPhasesUpdated(freshPhases);
      } else {
        setLogs(l => [...l, { level: "error", msg: `Upload failed: ${data.error}` }]);
      }
    } catch (err) {
      setLogs(l => [...l, { level: "error", msg: err.message }]);
    }
    setUploading(false);
    if (e.target) e.target.value = "";
  };

  const handleRunExtraction = async () => {
    setExtracting(true);
    lastLogIdRef.current = 0;
    setLogs([{ level: "info", msg: "▶ Starting AI extraction…" }]);
    await fetch(`${API}/projects/${projectId}/run-subcontractor-extraction`, { method: "POST" });
    startPolling();
  };

  const showSetup = activePhase === 2 && phase2.status !== "complete";

  return (
    <div className={`jstrip${collapsed ? " jstrip-collapsed" : ""}`}>

      {/* ── Strip Header: title + phase cards + collapse toggle ── */}
      <div className="jstrip-header">
        <span className="jstrip-title">PROJECT JOURNEY</span>

        <div className="jstrip-cards">
          {PHASE_DEFS.map((def, idx) => {
            const phData    = ph[idx];
            const status    = phData.status || "pending";
            const isActive  = activePhase === def.num;
            const isDone    = status === "complete";
            const isRunning = status === "running";
            const canClick  = isDone || def.num === 1 || def.num === 2;

            return (
              <div key={def.num} className="jstrip-card-group">
                <button
                  className={[
                    "jstrip-card",
                    isActive  ? "jcard-active"  : "",
                    isDone    ? "jcard-done"    : "",
                    isRunning ? "jcard-running" : "",
                    !canClick ? "jcard-locked"  : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => canClick && onPhaseSelect(def.num)}
                  title={def.label}
                >
                  {/* Circle indicator */}
                  <div className="jcard-circle">
                    {isRunning ? "⟳" : isDone ? "✓" : def.num}
                  </div>

                  {/* Text block — no wrapping, no overlap */}
                  <div className="jcard-text">
                    <div className="jcard-name">{def.short}</div>
                    <div className="jcard-meta">
                      {isDone
                        ? `${phData.item_count || 0} ${def.num === 2 ? "applications" : "items"}`
                        : isRunning ? "Processing…"
                        : "Not started"}
                    </div>
                  </div>

                  {/* Status dot in corner */}
                  <div className={`jcard-dot jdot-${status}`} title={status} />
                </button>

                {idx < PHASE_DEFS.length - 1 && (
                  <div className={`jstrip-connector${isDone ? " jconn-done" : ""}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Phase 2 setup area (when active + not complete + not collapsed) ── */}
      {!collapsed && showSetup && (
        <div className="jstrip-setup">
          <div className="jstrip-setup-steps">

            {/* Step 1: Upload PDF */}
            <div className={`jsetup-step${phase2.pdf_path ? " step-done" : " step-active"}`}>
              <div className="jsetup-circle">{phase2.pdf_path ? "✓" : "1"}</div>
              <div className="jsetup-body">
                <div className="jsetup-label">Upload Subcontractor PDF</div>
                {phase2.pdf_path && (
                  <div className="jsetup-note">
                    📄 {phase2.pdf_path.split(/[/\\]/).pop()}
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={handleUpload}
              />
              <button
                className={`jsetup-btn${phase2.pdf_path ? " jbtn-ghost" : " jbtn-primary"}`}
                disabled={uploading || extracting}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Uploading…" : phase2.pdf_path ? "Replace PDF" : "📎 Select PDF"}
              </button>
            </div>

            {/* Step 2: Run Extraction */}
            <div className={`jsetup-step${!phase2.pdf_path ? " step-locked" : extracting ? " step-running" : " step-active"}`}>
              <div className="jsetup-circle">{extracting ? "⟳" : "2"}</div>
              <div className="jsetup-body">
                <div className="jsetup-label">Run AI Extraction</div>
                <div className="jsetup-note">Identifies apps via Azure GPT-5.4</div>
              </div>
              <button
                className={`jsetup-btn${extracting ? " jbtn-running" : " jbtn-accent"}`}
                disabled={extracting || !phase2.pdf_path}
                onClick={handleRunExtraction}
              >
                {extracting ? "⟳ Extracting…" : "▶ Run Extraction"}
              </button>
            </div>
          </div>

          {/* Log tail */}
          {logs.length > 0 && (
            <div className="jstrip-log">
              {logs.slice(-4).map((l, i) => (
                <div key={i} className={`jlog-line jlog-${l.level}`}>{l.msg}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
