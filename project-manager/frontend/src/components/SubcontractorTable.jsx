import { useState, useCallback, useRef } from "react";
import { SummaryBar, ValidationBadge } from "./shared";

const API = "/api";

const fmtMoney = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtMoneyCompact = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtPct = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toFixed(0) + "%";
};

const fmtDate = (raw) => {
  if (!raw) return "—";
  const s = String(raw).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  return s.replace(/^\?\s*[-–]\s*/, "");
};

function ReconBadge({ flag }) {
  if (!flag || flag === "N/A") return <span className="recon-badge na">N/A</span>;
  if (flag === "MATCH") return <span className="recon-badge match">✓ Match</span>;
  return <span className="recon-badge diff">⚠ {flag}</span>;
}

function SigBadge({ val }) {
  if (!val) return <span className="sig-badge unknown">—</span>;
  const u = val.trim().toUpperCase();
  if (u === "YES") return <span className="sig-badge yes">✓</span>;
  if (u === "NO")  return <span className="sig-badge no">✗</span>;
  return <span className="sig-badge unknown">{val}</span>;
}

// ── Main component ────────────────────────────────────────────────────────
export default function SubcontractorTable({ apps, projectId, onPageClick, onUpdateValidation }) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [lineItemsCache, setLineItemsCache] = useState({});   // { sub_app_id: items[] }
  const [loadingItems, setLoadingItems] = useState(new Set());
  const fetchedRef = useRef(new Set());

  // Fetch line items for a specific sub_app_id
  const fetchLineItems = useCallback(async (subAppId) => {
    if (fetchedRef.current.has(subAppId)) return;
    fetchedRef.current.add(subAppId);
    setLoadingItems(prev => new Set(prev).add(subAppId));
    try {
      const res = await fetch(`${API}/projects/${projectId}/sub-line-items?sub_app_id=${subAppId}`);
      const data = await res.json();
      setLineItemsCache(prev => ({ ...prev, [subAppId]: data }));
    } catch (err) {
      console.error("Failed to load line items for sub", subAppId, err);
      setLineItemsCache(prev => ({ ...prev, [subAppId]: [] }));
      fetchedRef.current.delete(subAppId);
    } finally {
      setLoadingItems(prev => { const n = new Set(prev); n.delete(subAppId); return n; });
    }
  }, [projectId]);

  const handleToggleExpand = (appId) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
        // Fetch line items on first expand
        fetchLineItems(appId);
      }
      return next;
    });
  };

  const handleToggleNote = (appId) => {
    setExpandedNotes(prev => {
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
  const totalDue   = apps.reduce((s, a) => s + (parseFloat(a.current_payment_due)  || 0), 0);
  const totalContr = apps.reduce((s, a) => s + (parseFloat(a.contract_sum_to_date) || 0), 0);

  const stats = [
    { label: "Applications", value: apps.length },
    { label: "Total Payment Due", value: fmtMoney(totalDue), variant: "ok" },
    { label: "Total Contract Sum", value: fmtMoney(totalContr) },
    warnCount > 0
      ? { label: "AI Warnings", value: warnCount, variant: "warn" }
      : { label: "Valid", value: validCount, variant: "ok" },
  ];

  return (
    <div className="sub-container">
      {/* Validation status strip */}
      {(warnCount > 0 || validCount > 0) && (
        <div className="sub-vstatus-bar">
          {validCount > 0  && <span className="v-badge v-valid">{validCount} valid</span>}
          {warnCount > 0   && <span className="v-badge v-warning">{warnCount} warnings</span>}
        </div>
      )}

      <SummaryBar stats={stats} />

      <div className="sub-scroll">
        <table className="sub-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th style={{ width: 36 }}>✓</th>
              <th>#</th>
              <th>Subcontractor</th>
              <th>App No.</th>
              <th>Period To</th>
              <th>Contract Sum</th>
              <th>Completed &amp; Stored</th>
              <th>This Period</th>
              <th>Retainage</th>
              <th>Current Due</th>
              <th>Balance</th>
              <th>Recon</th>
              <th>Sig</th>
              <th>Pages</th>
            </tr>
          </thead>
          <tbody>
            {apps.map(app => {
              const isExpanded = expandedRows.has(app.id);
              const isNoteExpanded = expandedNotes.has(app.id);
              const isWarning = app.validation_status === "warning";
              const lineItems = lineItemsCache[app.id] || [];
              const isLoading = loadingItems.has(app.id);
              const hasLineItems = lineItems.length > 0;

              return [
                /* ── Cover page row ─────────────────────── */
                <tr
                  key={`cover-${app.id}`}
                  className={`sub-cover-row ${isWarning ? "row-warning" : ""} ${isExpanded ? "sub-cover-expanded" : ""}`}
                  onClick={() => onPageClick && onPageClick(app.start_page)}
                  title={`Click to view page ${app.start_page}`}
                >
                  <td
                    className="sub-expand-cell"
                    onClick={(e) => { e.stopPropagation(); handleToggleExpand(app.id); }}
                    title={isExpanded ? "Collapse line items" : "Expand line items"}
                  >
                    <span className={`sub-expand-arrow ${isExpanded ? "expanded" : ""}`}>▶</span>
                  </td>
                  <td className="sub-vstatus" onClick={(e) => { e.stopPropagation(); handleToggleNote(app.id); }}>
                    <ValidationBadge status={app.validation_status} onClick={() => handleToggleNote(app.id)} />
                  </td>
                  <td className="sub-seq">{app.seq_id}</td>
                  <td className="sub-name">{app.subcontractor_name || "—"}</td>
                  <td className="sub-appno">{app.application_no || "—"}</td>
                  <td className="sub-period">{fmtDate(app.period_to)}</td>
                  <td className="sub-money">{fmtMoneyCompact(app.contract_sum_to_date)}</td>
                  <td className="sub-money">{fmtMoneyCompact(app.total_completed_stored)}</td>
                  <td className="sub-money sub-this">{fmtMoneyCompact(app.completed_work_this_period)}</td>
                  <td className="sub-money">{fmtMoneyCompact(app.total_retainage)}</td>
                  <td className="sub-money sub-due">{fmtMoneyCompact(app.current_payment_due)}</td>
                  <td className="sub-money">{fmtMoneyCompact(app.balance_to_finish)}</td>
                  <td><ReconBadge flag={app.recon_flag} /></td>
                  <td><SigBadge val={app.contractor_signature} /></td>
                  <td className="sub-pages">
                    {app.start_page}{app.end_page && app.end_page !== app.start_page ? `–${app.end_page}` : ""}
                  </td>
                </tr>,

                /* ── AI validation note row ─────────────── */
                isNoteExpanded && (
                  <tr key={`note-${app.id}`} className="row-note-expanded">
                    <td colSpan={15}>
                      <div className="inline-ai-note">
                        <span className="inline-ai-icon">🤖</span>
                        <span className="inline-ai-text">{app.validation_note || "No issues noted."}</span>
                        <div className="inline-ai-actions">
                          {app.validation_status === "warning" && (
                            <button className="ai-override-btn" onClick={() => onUpdateValidation && onUpdateValidation(app.id, "valid", "")}>Mark as Valid</button>
                          )}
                          <button className="ai-override-btn ai-override-close" onClick={() => handleToggleNote(app.id)}>Close</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ),

                /* ── Expanded line items ────────────────── */
                isExpanded && (
                  <tr key={`items-${app.id}`} className="sub-line-items-row">
                    <td colSpan={15} style={{ padding: 0 }}>
                      <div className="sub-line-items-container">
                        {isLoading ? (
                          <div className="sub-line-items-loading">Loading continuation sheet…</div>
                        ) : !hasLineItems ? (
                          <div className="sub-line-items-empty">No G703 line items available for this subcontractor.</div>
                        ) : (
                          <table className="sub-line-items-table">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Description</th>
                                <th>Scheduled Value</th>
                                <th>Prev Work</th>
                                <th>This Period</th>
                                <th>Materials</th>
                                <th>Total Completed</th>
                                <th>% Done</th>
                                <th>Retainage</th>
                                <th>Pg</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineItems.map(item => (
                                <tr
                                  key={item.id}
                                  className="sub-line-item-row"
                                  onClick={(e) => { e.stopPropagation(); item.source_page && onPageClick && onPageClick(item.source_page); }}
                                  title={item.source_page ? `Click to view page ${item.source_page}` : ""}
                                >
                                  <td className="sli-item">{item.item_no || "—"}</td>
                                  <td className="sli-desc">{item.description || "—"}</td>
                                  <td className="sli-money">{fmtMoney(item.scheduled_value)}</td>
                                  <td className="sli-money">{fmtMoney(item.work_completed_prev)}</td>
                                  <td className="sli-money sli-this">{fmtMoney(item.work_completed_this)}</td>
                                  <td className="sli-money">{fmtMoney(item.materials_stored)}</td>
                                  <td className="sli-money sli-total">{fmtMoney(item.total_completed)}</td>
                                  <td className="sli-pct">{fmtPct(item.pct_complete)}</td>
                                  <td className="sli-money">{fmtMoney(item.retainage)}</td>
                                  <td className="sli-page">{item.source_page || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
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
