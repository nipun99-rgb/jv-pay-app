import { useState } from "react";
import "./SubcontractorTable.css";

const fmtMoney = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmt = (v) => (v === null || v === undefined || v === "" ? "—" : v);

// Standardise any date string to DD MMM YYYY (e.g. "28 Feb 2026")
const fmtDate = (raw) => {
  if (!raw) return "—";
  const s = String(raw).trim();
  // Try parsing ISO-style or common formats
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  // Fallback: return as-is but strip leading "?" artefacts
  return s.replace(/^\?\s*[-–]\s*/, "");
};

function ReconBadge({ flag }) {
  if (!flag || flag === "N/A") return <span className="recon-badge na">N/A</span>;
  if (flag === "MATCH") return <span className="recon-badge match">✓ MATCH</span>;
  return <span className="recon-badge diff">⚠ {flag}</span>;
}

// ── Validation badge (reuses App.css .v-badge classes) ───────────────────
function ValidationBadge({ status, appId, onToggle }) {
  if (status === "valid")    return <span className="v-badge v-valid" title="AI validated — OK">✓</span>;
  if (status === "checking") return <span className="v-badge v-checking" title="AI checking…">⋯</span>;
  if (status === "warning")  return (
    <span
      className="v-badge v-warning v-badge-active"
      title="AI flagged issue — click to see note"
      onClick={(e) => { e.stopPropagation(); onToggle(appId); }}
    >⚠</span>
  );
  return (
    <span
      className="v-badge v-unchecked v-badge-active"
      title="Not yet validated"
      onClick={(e) => { e.stopPropagation(); onToggle(appId); }}
    >—</span>
  );
}

function SigBadge({ val }) {
  if (!val) return <span className="sig-badge unknown">—</span>;
  const u = val.trim().toUpperCase();
  if (u === "YES") return <span className="sig-badge yes">✓</span>;
  if (u === "NO")  return <span className="sig-badge no">✗</span>;
  return <span className="sig-badge unknown">{val}</span>;
}

// ── G702 Cover Page Tab ────────────────────────────────────────────────────
function G702CoverTab({ apps, onPageClick, onUpdateValidation, expandedNotes, onToggleNote }) {
  const totalDue   = apps.reduce((s, a) => s + (parseFloat(a.current_payment_due)  || 0), 0);
  const totalContr = apps.reduce((s, a) => s + (parseFloat(a.contract_sum_to_date) || 0), 0);
  const noSig      = apps.filter((a) => (a.contractor_signature || "").trim().toUpperCase() !== "YES").length;
  const warnings   = apps.filter((a) => a.validation_status === "warning").length;

  return (
    <div className="sub-wrapper">
      <div className="sub-summary-bar">
        <div className="sub-stat">
          <span className="sub-stat-val">{apps.length}</span>
          <span className="sub-stat-lbl">Applications</span>
        </div>
        <div className="sub-stat ok">
          <span className="sub-stat-val">{fmtMoney(totalDue)}</span>
          <span className="sub-stat-lbl">Total Payment Due</span>
        </div>
        <div className="sub-stat">
          <span className="sub-stat-val">{fmtMoney(totalContr)}</span>
          <span className="sub-stat-lbl">Total Contract Sum</span>
        </div>
        {warnings > 0 ? (
          <div className="sub-stat warn">
            <span className="sub-stat-val">{warnings}</span>
            <span className="sub-stat-lbl">AI Warnings</span>
          </div>
        ) : (
          <div className={`sub-stat ${noSig > 0 ? "warn" : "ok"}`}>
            <span className="sub-stat-val">{noSig}</span>
            <span className="sub-stat-lbl">Missing Signatures</span>
          </div>
        )}
      </div>

      <div className="sub-scroll">
        <table className="sub-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>✓</th>
              <th>#</th>
              <th>Subcontractor</th>
              <th>App No.</th>
              <th>Period</th>
              <th>Contract Sum to Date</th>
              <th>Total Completed &amp; Stored</th>
              <th>This Period</th>
              <th>Total Retainage</th>
              <th>Earned Less Ret.</th>
              <th>Less Prev. Certs.</th>
              <th>Current Payment Due</th>
              <th>Balance to Finish</th>
              <th>Contractor Sig</th>
              <th>Arch Sig</th>
              <th>Notarized</th>
              <th>Supporting Docs</th>
              <th>Pages</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => {
              const noSigRow  = (app.contractor_signature || "").trim().toUpperCase() !== "YES";
              const noCert    = (app.architect_signature  || "").trim().toUpperCase() !== "YES";
              const isWarning = app.validation_status === "warning";
              const isExpanded = expandedNotes.has(app.id);
              return [
                <tr
                  key={app.id}
                  className={`${isWarning ? "row-warning" : (noSigRow || noCert ? "sub-row-warn" : "")} sub-row-clickable`}
                  onClick={() => onPageClick && onPageClick(app.start_page)}
                  title={`Click to jump to page ${app.start_page} in PDF`}
                >
                  <td className="sub-vstatus" onClick={(e) => { e.stopPropagation(); onToggleNote(app.id); }} style={{ cursor: "pointer" }}>
                    <ValidationBadge status={app.validation_status} appId={app.id} onToggle={onToggleNote} />
                  </td>
                  <td className="sub-seq">{app.seq_id}</td>
                  <td className="sub-name">{app.subcontractor_name || "—"}</td>
                  <td className="sub-appno">{fmt(app.application_no)}</td>
                  <td className="sub-period">{fmtDate(app.period_to)}</td>
                  <td className="sub-money">{fmtMoney(app.contract_sum_to_date)}</td>
                  <td className="sub-money">{fmtMoney(app.total_completed_stored)}</td>
                  <td className="sub-money sub-this">{fmtMoney(app.completed_work_this_period)}</td>
                  <td className="sub-money">{fmtMoney(app.total_retainage)}</td>
                  <td className="sub-money">{fmtMoney(app.total_earned_less_retainage)}</td>
                  <td className="sub-money">{fmtMoney(app.less_prev_certificates)}</td>
                  <td className="sub-money sub-due">{fmtMoney(app.current_payment_due)}</td>
                  <td className="sub-money">{fmtMoney(app.balance_to_finish)}</td>
                  <td><SigBadge val={app.contractor_signature} /></td>
                  <td><SigBadge val={app.architect_signature} /></td>
                  <td><SigBadge val={app.notarized} /></td>
                  <td className="sub-docs">{app.additional_supporting_docs || "—"}</td>
                  <td className="sub-pages">
                    {app.start_page}{app.end_page && app.end_page !== app.start_page ? `–${app.end_page}` : ""}
                  </td>
                </tr>,
                isExpanded && (
                  <tr key={`note-${app.id}`} className="row-note-expanded">
                    <td colSpan={19}>
                      <div className="inline-ai-note">
                        <span className="inline-ai-icon">🤖</span>
                        <span className="inline-ai-text">{app.validation_note || "No issues noted."}</span>
                        <div className="inline-ai-actions">
                          {app.validation_status === "warning" && (
                            <button className="ai-override-btn" onClick={() => onUpdateValidation && onUpdateValidation(app.id, "valid", "")}>Mark as Valid</button>
                          )}
                          <button className="ai-override-btn ai-override-close" onClick={() => onToggleNote(app.id)}>Close</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── G703 Continuation Sheet Tab ───────────────────────────────────────────
function G703Tab({ apps, onPageClick, onUpdateValidation, expandedNotes, onToggleNote }) {
  const totalSched   = apps.reduce((s, a) => s + (parseFloat(a.g703_scheduled_value) || 0), 0);
  const totalThis    = apps.reduce((s, a) => s + (parseFloat(a.g703_work_this_period) || 0), 0);
  const diffCount    = apps.filter((a) => a.recon_flag && a.recon_flag !== "MATCH" && a.recon_flag !== "N/A").length;
  const noData       = apps.filter((a) => !a.g703_total_completed && a.g703_total_completed !== 0).length;
  const warnings     = apps.filter((a) => a.validation_status === "warning").length;

  return (
    <div className="sub-wrapper">
      <div className="sub-summary-bar">
        <div className="sub-stat">
          <span className="sub-stat-val">{fmtMoney(totalSched)}</span>
          <span className="sub-stat-lbl">Total Scheduled Value</span>
        </div>
        <div className="sub-stat ok">
          <span className="sub-stat-val">{fmtMoney(totalThis)}</span>
          <span className="sub-stat-lbl">G703 Total This Period</span>
        </div>
        {warnings > 0 ? (
          <div className="sub-stat warn">
            <span className="sub-stat-val">{warnings}</span>
            <span className="sub-stat-lbl">AI Warnings</span>
          </div>
        ) : (
          <div className={`sub-stat ${diffCount > 0 ? "warn" : "ok"}`}>
            <span className="sub-stat-val">{diffCount}</span>
            <span className="sub-stat-lbl">G702 vs G703 Discrepancies</span>
          </div>
        )}
        <div className={`sub-stat ${noData > 0 ? "warn" : "ok"}`}>
          <span className="sub-stat-val">{apps.length - noData}</span>
          <span className="sub-stat-lbl">Apps with G703 Data</span>
        </div>
      </div>

      <div className="sub-scroll">
        <table className="sub-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>✓</th>
              <th>#</th>
              <th>Subcontractor</th>
              <th>App No.</th>
              <th>Period</th>
              <th>Scheduled Value</th>
              <th>Prev Work</th>
              <th>This Period</th>
              <th>Materials Stored</th>
              <th>Total Completed</th>
              <th>Retainage</th>
              <th>Earned Less Ret.</th>
              <th>Balance to Finish</th>
              <th>G702 vs G703</th>
              <th>Pages</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => {
              const isDiff    = app.recon_flag && app.recon_flag !== "MATCH" && app.recon_flag !== "N/A";
              const isWarning = app.validation_status === "warning";
              const isExpanded = expandedNotes.has(app.id);
              return [
                <tr
                  key={app.id}
                  className={`${isWarning ? "row-warning" : (isDiff ? "sub-row-warn" : "")} sub-row-clickable`}
                  onClick={() => onPageClick && onPageClick(app.start_page)}
                  title={`Click to jump to page ${app.start_page} in PDF`}
                >
                  <td className="sub-vstatus" onClick={(e) => { e.stopPropagation(); onToggleNote(app.id); }} style={{ cursor: "pointer" }}>
                    <ValidationBadge status={app.validation_status} appId={app.id} onToggle={onToggleNote} />
                  </td>
                  <td className="sub-seq">{app.seq_id}</td>
                  <td className="sub-name">{app.subcontractor_name || "—"}</td>
                  <td className="sub-appno">{fmt(app.application_no)}</td>
                  <td className="sub-period">{fmtDate(app.period_to)}</td>
                  <td className="sub-money">{fmtMoney(app.g703_scheduled_value)}</td>
                  <td className="sub-money">{fmtMoney(app.g703_work_prev)}</td>
                  <td className="sub-money sub-this">{fmtMoney(app.g703_work_this_period)}</td>
                  <td className="sub-money">{fmtMoney(app.g703_materials_stored)}</td>
                  <td className="sub-money sub-due">{fmtMoney(app.g703_total_completed)}</td>
                  <td className="sub-money">{fmtMoney(app.g703_retainage)}</td>
                  <td className="sub-money">{fmtMoney(app.g703_earned_less_ret)}</td>
                  <td className="sub-money">{fmtMoney(app.g703_balance_to_finish)}</td>
                  <td><ReconBadge flag={app.recon_flag} /></td>
                  <td className="sub-pages">
                    {app.start_page}{app.end_page && app.end_page !== app.start_page ? `–${app.end_page}` : ""}
                  </td>
                </tr>,
                isExpanded && (
                  <tr key={`note-${app.id}`} className="row-note-expanded">
                    <td colSpan={16}>
                      <div className="inline-ai-note">
                        <span className="inline-ai-icon">🤖</span>
                        <span className="inline-ai-text">{app.validation_note || "No issues noted."}</span>
                        <div className="inline-ai-actions">
                          {app.validation_status === "warning" && (
                            <button className="ai-override-btn" onClick={() => onUpdateValidation && onUpdateValidation(app.id, "valid", "")}>Mark as Valid</button>
                          )}
                          <button className="ai-override-btn ai-override-close" onClick={() => onToggleNote(app.id)}>Close</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function SubcontractorTable({ apps, onPageClick, onUpdateValidation }) {
  const [subTab, setSubTab] = useState("cover"); // "cover" | "g703"
  const [expandedNotes, setExpandedNotes] = useState(new Set());

  const handleToggleNote = (appId) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  if (!apps || apps.length === 0) {
    return (
      <div className="sub-empty-full">
        <div className="sub-empty">
          <p>No subcontractor applications found yet.</p>
          <p className="sub-empty-hint">
            Upload the subcontractor PDF in the journey panel above and run extraction.
          </p>
        </div>
      </div>
    );
  }

  const warnCount  = apps.filter(a => a.validation_status === "warning").length;
  const validCount = apps.filter(a => a.validation_status === "valid").length;
  const checkCount = apps.filter(a => a.validation_status === "checking").length;
  const unchkCount = apps.filter(a => !a.validation_status || a.validation_status === "unchecked").length;

  return (
    <div className="sub-container">
      {/* Validation status strip */}
      {(warnCount > 0 || validCount > 0 || checkCount > 0) && (
        <div className="sub-vstatus-bar">
          {validCount > 0  && <span className="v-badge v-valid">{validCount} valid</span>}
          {warnCount > 0   && <span className="v-badge v-warning">{warnCount} warnings</span>}
          {unchkCount > 0  && <span className="v-badge v-unchecked">{unchkCount} unchecked</span>}
          {checkCount > 0  && <span className="v-badge v-checking">⋯ checking…</span>}
        </div>
      )}

      {/* Inner tab bar */}
      <div className="sub-tab-bar">
        <button
          className={`sub-tab${subTab === "cover" ? " sub-tab-active" : ""}`}
          onClick={() => setSubTab("cover")}
        >
          <span className="sub-tab-icon">📋</span>
          <span className="sub-tab-text">G702 Cover Page</span>
          <span className="sub-tab-badge">{apps.length}</span>
        </button>
        <button
          className={`sub-tab${subTab === "g703" ? " sub-tab-active" : ""}`}
          onClick={() => setSubTab("g703")}
        >
          <span className="sub-tab-icon">📊</span>
          <span className="sub-tab-text">G703 Continuation</span>
          <span className="sub-tab-badge">
            {apps.filter(a => a.g703_total_completed !== null && a.g703_total_completed !== undefined).length}
          </span>
        </button>
      </div>

      {/* Tab content */}
      <div className="sub-tab-content">
        {subTab === "cover" && (
          <G702CoverTab
            apps={apps}
            onPageClick={onPageClick}
            onUpdateValidation={onUpdateValidation}
            expandedNotes={expandedNotes}
            onToggleNote={handleToggleNote}
          />
        )}
        {subTab === "g703" && (
          <G703Tab
            apps={apps}
            onPageClick={onPageClick}
            onUpdateValidation={onUpdateValidation}
            expandedNotes={expandedNotes}
            onToggleNote={handleToggleNote}
          />
        )}
      </div>
    </div>
  );
}
