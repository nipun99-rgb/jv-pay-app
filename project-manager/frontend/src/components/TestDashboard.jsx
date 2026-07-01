import { useState, useEffect } from "react";
import "./TestDashboard.css";

const API = "/api";

const fmtMoney = (v) => {
  if (v === null || v === undefined) return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function StatusBadge({ status }) {
  const cls = status === "Pass" ? "td-pass" : status === "Fail" ? "td-fail" : "td-na";
  return <span className={`td-status-badge ${cls}`}>{status}</span>;
}

// ── Test definitions — add future tests here ─────────────────────────────
const TEST_CATALOG = [
  {
    id: "PA-002",
    name: "Reconcile JV Line Item to Subcontractor Pay Application(s)",
    group: "Cross-document Reconciliation",
    area: "Pay App Check",
    type: "Value-to-Value",
    description: "Verify that the JV Pay App Continuation Sheet 'Work Completed - This Period' amount matches the aggregated total from all corresponding subcontractor Pay Application Continuation Sheet(s) for the same subcontractor and billing period.",
    contractRef: "CON-SUB",
    tolerance: "±$10",
    endpoint: (projectId) => `${API}/projects/${projectId}/tests/pa-002`,
  },
  {
    id: "PA-003",
    name: "Arithmetic Consistency — Continuation Sheet vs Grand Total",
    group: "Internal Consistency",
    area: "Arithmetic Verification",
    type: "Sum-to-Total",
    description: "Sum all individual line item values on each Continuation Sheet (JV & Sub) and compare to the Grand Total row. Validates all numeric columns: Scheduled Value, Work Completed (Prev/This), Materials Stored, Total Completed, Balance to Finish, Retainage.",
    contractRef: "G703",
    tolerance: "±$10",
    endpoint: (projectId) => `${API}/projects/${projectId}/tests/pa-003`,
  },
];

// ══════════════════════════════════════════════════════════════════════════
// TEST EXECUTION VIEW — full-page view for running a single test
// ══════════════════════════════════════════════════════════════════════════
function TestExecutionView({ test, projectId, onBack, onComplete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [editingField, setEditingField] = useState(null); // { type, id, field, value }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(test.endpoint(projectId))
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); onComplete(test.id, d); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [test.id, projectId]);

  const handleSave = async () => {
    if (!editingField) return;
    setSaving(true);
    const { type, id, field, value } = editingField;
    const endpoint = type === "jv"
      ? `${API}/projects/${projectId}/line-items/${id}`
      : `${API}/projects/${projectId}/sub-apps/${id}`;
    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: parseFloat(value) || 0 }),
      });
      setEditingField(null);
      // Re-run test to refresh
      const res = await fetch(test.endpoint(projectId));
      const d = await res.json();
      setData(d);
      onComplete(test.id, d);
    } catch (e) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const passRate = data?.summary?.total > 0
    ? Math.round((data.summary.pass / data.summary.total) * 100) : 0;

  return (
    <div className="td-exec-view">
      <button className="td-btn-back" onClick={onBack}>← Back to Tests</button>

      <div className="td-exec-card">
        <div className="td-exec-card-top">
          <div className="td-test-id-block">
            <span className="td-test-id">{test.id}</span>
            <span className="td-test-type">{test.type}</span>
          </div>
          <div className="td-test-title">
            <h2>{test.name}</h2>
            <p className="td-test-subtitle">{test.group} · {test.area}</p>
          </div>
          <div className="td-test-meta">
            <div className="td-meta-item">
              <span className="td-meta-label">Contract Ref</span>
              <span className="td-meta-value">{test.contractRef}</span>
            </div>
            <div className="td-meta-item">
              <span className="td-meta-label">Tolerance</span>
              <span className="td-meta-value">{test.tolerance}</span>
            </div>
          </div>
        </div>

        {loading && (
          <div className="td-exec-loading">
            <div className="td-spinner" />
            <p>Running test (LLM matching may take a moment)…</p>
          </div>
        )}

        {error && (
          <div className="td-exec-error">
            <p>Test failed: {error}</p>
          </div>
        )}

        {data && !error && (
          <>
            {/* Score ring + stats */}
            <div className="td-score-section">
              <div className="td-score-ring">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke={passRate >= 80 ? "#16a34a" : passRate >= 50 ? "#d97706" : "#dc2626"}
                    strokeWidth="8"
                    strokeDasharray={`${(passRate / 100) * 327} 327`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="td-score-text">
                  <span className="td-score-num">{passRate}%</span>
                  <span className="td-score-label">Pass Rate</span>
                </div>
              </div>

              <div className="td-stats-grid">
                <div className="td-stat-card td-stat-total">
                  <span className="td-stat-num">{data.summary.total}</span>
                  <span className="td-stat-label">Total</span>
                </div>
                <div className="td-stat-card td-stat-pass">
                  <span className="td-stat-num">{data.summary.pass}</span>
                  <span className="td-stat-label">Passed</span>
                </div>
                <div className="td-stat-card td-stat-fail">
                  <span className="td-stat-num">{data.summary.fail}</span>
                  <span className="td-stat-label">Failed</span>
                </div>
                <div className="td-stat-card td-stat-na">
                  <span className="td-stat-num">{data.summary.na}</span>
                  <span className="td-stat-label">N/A</span>
                </div>
              </div>
            </div>

            {/* Results table */}
            <div className="td-results-section">
              <div className="td-results-header">
                <h3>Detailed Results</h3>
                <span className="td-results-count">{data.results.length} checks performed</span>
              </div>

              {/* PA-003: Arithmetic table */}
              {test.id === "PA-003" ? (
                <div className="td-table-wrapper">
                  <table className="td-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Document</th>
                        <th>Pay App</th>
                        <th>Column</th>
                        <th className="td-r">Σ Line Items</th>
                        <th className="td-r">Grand Total</th>
                        <th className="td-r">Difference</th>
                        <th>Items</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.results.map((r, i) => (
                        <tr key={i} className={r.status === "Fail" ? "td-row-fail" : ""}>
                          <td><StatusBadge status={r.status} /></td>
                          <td><span className={`td-doc-badge ${r.document === "JV Pay App" ? "td-doc-jv" : "td-doc-sub"}`}>{r.document}</span></td>
                          <td className="td-name">{r.app_name}</td>
                          <td className="td-col-name">{r.column}</td>
                          <td className="td-r td-mono">{fmtMoney(r.line_items_sum)}</td>
                          <td className="td-r td-mono">{fmtMoney(r.grand_total)}</td>
                          <td className={`td-r td-mono ${r.difference && Math.abs(r.difference) > 10 ? "td-diff-bad" : ""}`}>
                            {fmtMoney(r.difference)}
                          </td>
                          <td className="td-center">{r.line_count}</td>
                          <td className="td-remarks">{r.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
              /* PA-002: Reconciliation table */
              <div className="td-table-wrapper">
                <table className="td-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Status</th>
                      <th>Subcontractor (JV)</th>
                      <th>Matched Sub Application</th>
                      <th className="td-r">JV "This Period"</th>
                      <th className="td-r">Sub "This Period"</th>
                      <th className="td-r">Difference</th>
                      <th>Match</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((r, i) => (
                      <>
                        <tr
                          key={i}
                          className={`${r.status === "Fail" ? "td-row-fail" : r.status === "N/A" ? "td-row-na" : ""} ${expandedRow === i ? "td-row-expanded" : ""} td-row-clickable`}
                          onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                        >
                          <td className="td-expand-cell">
                            <span className={`td-expand-arrow ${expandedRow === i ? "open" : ""}`}>▶</span>
                          </td>
                          <td><StatusBadge status={r.status} /></td>
                          <td className="td-name">{r.contractor_name}</td>
                          <td className="td-name td-sub-name">{r.sub_name || <span className="td-missing">Not found</span>}</td>
                          <td className="td-r td-mono">{fmtMoney(r.jv_this_period)}</td>
                          <td className="td-r td-mono">{r.sub_this_period !== null ? fmtMoney(r.sub_this_period) : <span className="td-missing">—</span>}</td>
                          <td className={`td-r td-mono ${r.difference && Math.abs(r.difference) > 10 ? "td-diff-bad" : ""}`}>
                            {r.difference !== null ? fmtMoney(r.difference) : "—"}
                          </td>
                          <td><span className={`td-match-badge td-match-${(r.match_method || "none").toLowerCase()}`}>{r.match_method || "—"}</span></td>
                          <td className="td-remarks">{r.remarks}</td>
                        </tr>

                        {/* Expanded detail panel */}
                        {expandedRow === i && (
                          <tr key={`detail-${i}`} className="td-detail-row">
                            <td colSpan={9}>
                              <RowDetail
                                row={r}
                                projectId={projectId}
                                editingField={editingField}
                                setEditingField={setEditingField}
                                handleSave={handleSave}
                                saving={saving}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Expanded Row Detail ──────────────────────────────────────────────────
function RowDetail({ row, projectId, editingField, setEditingField, handleSave, saving }) {
  return (
    <div className="td-row-detail">
      {/* Pay Apps Breakdown */}
      {row.pay_apps && row.pay_apps.length > 0 && (
        <div className="td-detail-section">
          <h4>Aggregated Pay Applications ({row.pay_apps.length})</h4>
          <table className="td-detail-table">
            <thead>
              <tr>
                <th>Sub Name</th>
                <th>App #</th>
                <th>Date</th>
                <th>Period To</th>
                <th>Pages</th>
                <th className="td-r">This Period (G702)</th>
                <th className="td-r">This Period (G703)</th>
                <th className="td-r">Contract Sum</th>
              </tr>
            </thead>
            <tbody>
              {row.pay_apps.map((app, j) => (
                <tr key={j}>
                  <td>{app.subcontractor_name}</td>
                  <td>{app.application_no}</td>
                  <td>{app.application_date || "—"}</td>
                  <td>{app.period_to || "—"}</td>
                  <td>pp. {app.start_page}–{app.end_page}</td>
                  <td className="td-r td-mono">{fmtMoney(app.completed_work_this_period)}</td>
                  <td className="td-r td-mono">{fmtMoney(app.g703_work_this_period)}</td>
                  <td className="td-r td-mono">{fmtMoney(app.contract_sum_to_date)}</td>
                </tr>
              ))}
              {row.pay_apps.length > 1 && (
                <tr className="td-detail-total-row">
                  <td colSpan={5}><strong>Aggregated Total</strong></td>
                  <td className="td-r td-mono"><strong>{fmtMoney(row.sub_this_period)}</strong></td>
                  <td className="td-r td-mono"><strong>{fmtMoney(row.pay_apps.reduce((s, a) => s + a.g703_work_this_period, 0))}</strong></td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Source Data / Extracted Values */}
      <div className="td-detail-section">
        <h4>Extracted Values (click to edit)</h4>
        <div className="td-source-grid">
          {/* JV Source */}
          <div className="td-source-panel">
            <h5>JV Continuation Sheet</h5>
            {(Array.isArray(row.source_data) ? row.source_data : row.source_data?.jv || []).map((src, k) => (
              <div key={k} className="td-source-item">
                <span className="td-source-label">
                  {src.contractor_name} (Item {src.item_no || "—"}, Page {src.page || "—"})
                </span>
                <EditableValue
                  value={src.value}
                  isEditing={editingField?.type === "jv" && editingField?.id === src.id && editingField?.field === src.field}
                  onStartEdit={() => setEditingField({ type: "jv", id: src.id, field: src.field, value: src.value })}
                  onChange={(v) => setEditingField(prev => ({ ...prev, value: v }))}
                  onSave={handleSave}
                  onCancel={() => setEditingField(null)}
                  saving={saving}
                  editingField={editingField}
                />
              </div>
            ))}
          </div>

          {/* Sub Source */}
          {row.source_data?.sub && row.source_data.sub.length > 0 && (
            <div className="td-source-panel">
              <h5>Subcontractor Pay App(s)</h5>
              {row.source_data.sub.map((src, k) => (
                <div key={k} className="td-source-item">
                  <span className="td-source-label">
                    {src.subcontractor_name} (App #{src.application_no}, Page {src.page || "—"})
                  </span>
                  <EditableValue
                    value={src.value}
                    isEditing={editingField?.type === "sub" && editingField?.id === src.id && editingField?.field === src.field}
                    onStartEdit={() => setEditingField({ type: "sub", id: src.id, field: src.field, value: src.value })}
                    onChange={(v) => setEditingField(prev => ({ ...prev, value: v }))}
                    onSave={handleSave}
                    onCancel={() => setEditingField(null)}
                    saving={saving}
                    editingField={editingField}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Editable Value Cell ──────────────────────────────────────────────────
function EditableValue({ value, isEditing, onStartEdit, onChange, onSave, onCancel, saving, editingField }) {
  if (isEditing) {
    return (
      <span className="td-editable editing">
        <input
          type="number"
          step="0.01"
          value={editingField?.value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          autoFocus
          className="td-edit-input"
        />
        <button className="td-edit-save" onClick={onSave} disabled={saving}>✓</button>
        <button className="td-edit-cancel" onClick={onCancel}>✗</button>
      </span>
    );
  }
  return (
    <span className="td-editable" onClick={onStartEdit} title="Click to edit">
      <span className="td-editable-value">{fmtMoney(value)}</span>
      <span className="td-edit-icon">✎</span>
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD — catalog view (landing page)
// ══════════════════════════════════════════════════════════════════════════
export default function TestDashboard({ projectIdOverride }) {
  const [view, setView] = useState("catalog"); // 'catalog' | 'test'
  const [activeTestId, setActiveTestId] = useState(null);
  const [completedTests, setCompletedTests] = useState({}); // { testId: data }

  const params = new URLSearchParams(window.location.search);
  const projectId = projectIdOverride || params.get("project");

  const openTest = (testId) => {
    setActiveTestId(testId);
    setView("test");
  };

  const backToCatalog = () => {
    setView("catalog");
    setActiveTestId(null);
  };

  const handleTestComplete = (testId, data) => {
    setCompletedTests(prev => ({ ...prev, [testId]: data }));
  };

  const hasAnyResults = Object.keys(completedTests).length > 0;
  const totalPass = Object.values(completedTests).reduce((s, d) => s + (d.summary?.pass || 0), 0);
  const totalFail = Object.values(completedTests).reduce((s, d) => s + (d.summary?.fail || 0), 0);
  const totalTests = Object.values(completedTests).reduce((s, d) => s + (d.summary?.total || 0), 0);

  if (!projectId) return (
    <div className="td-app"><div className="td-error"><h2>Error</h2><p>No project specified</p></div></div>
  );

  // ── Test Execution View ──
  if (view === "test" && activeTestId) {
    const test = TEST_CATALOG.find(t => t.id === activeTestId);
    return (
      <div className="td-app">
        <header className="td-header">
          <div className="td-header-left">
            <div className="td-logo">
              <span className="td-logo-icon">◆</span>
              <span className="td-logo-text">TEST DASHBOARD</span>
            </div>
            <span className="td-header-sep" />
            <span className="td-header-project">Project #{projectId}</span>
            <span className="td-header-sep" />
            <span className="td-header-test-id">{activeTestId}</span>
          </div>
          <div className="td-header-right">
            <span className="td-header-date">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </header>
        <div className="td-content">
          <TestExecutionView
            test={test}
            projectId={projectId}
            onBack={backToCatalog}
            onComplete={handleTestComplete}
          />
        </div>
      </div>
    );
  }

  // ── Catalog View (Landing Page) ──
  return (
    <div className="td-app">
      <header className="td-header">
        <div className="td-header-left">
          <button className="td-btn-back-header" onClick={() => { window.location.href = '/'; }}>← Back</button>
          <div className="td-logo">
            <span className="td-logo-icon">◆</span>
            <span className="td-logo-text">TEST DASHBOARD</span>
          </div>
          <span className="td-header-sep" />
          <span className="td-header-project">Project #{projectId}</span>
        </div>
        <div className="td-header-right">
          <span className="td-header-date">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          {hasAnyResults && (
            <button className="td-btn-download" onClick={() => window.print()}>
              ↓ Download Report
            </button>
          )}
        </div>
      </header>

      <div className="td-content">
        {/* Top controls */}
        <div className="td-controls">
          <div className="td-controls-left">
            <h1 className="td-page-title">Payment Application Tests</h1>
            <p className="td-page-subtitle">Phase 2 – Payment Application Review · Cross-document Reconciliation</p>
          </div>
        </div>

        {/* Overall summary (only when results exist) */}
        {hasAnyResults && (
          <div className="td-overall-summary">
            <div className="td-os-stat">
              <span className="td-os-num">{Object.keys(completedTests).length}/{TEST_CATALOG.length}</span>
              <span className="td-os-label">Tests Run</span>
            </div>
            <div className="td-os-stat td-os-pass">
              <span className="td-os-num">{totalPass}</span>
              <span className="td-os-label">Passed</span>
            </div>
            <div className="td-os-stat td-os-fail">
              <span className="td-os-num">{totalFail}</span>
              <span className="td-os-label">Failed</span>
            </div>
            <div className="td-os-stat">
              <span className="td-os-num">{totalTests > 0 ? Math.round((totalPass / totalTests) * 100) : 0}%</span>
              <span className="td-os-label">Pass Rate</span>
            </div>
          </div>
        )}

        {/* Test catalog */}
        <div className="td-test-list">
          {TEST_CATALOG.map(test => {
            const completed = completedTests[test.id];
            const passRate = completed?.summary?.total > 0
              ? Math.round((completed.summary.pass / completed.summary.total) * 100) : null;

            return (
              <div key={test.id} className={`td-test-card ${completed ? "td-card-done" : ""}`}>
                <div className="td-test-card-header">
                  <div className="td-test-id-block">
                    <span className="td-test-id">{test.id}</span>
                    <span className="td-test-type">{test.type}</span>
                  </div>

                  <div className="td-test-title">
                    <h2>{test.name}</h2>
                    <p className="td-test-subtitle">{test.group} · {test.area}</p>
                    <p className="td-test-desc">{test.description}</p>
                  </div>

                  <div className="td-test-meta">
                    <div className="td-meta-item">
                      <span className="td-meta-label">Contract Ref</span>
                      <span className="td-meta-value">{test.contractRef}</span>
                    </div>
                    <div className="td-meta-item">
                      <span className="td-meta-label">Tolerance</span>
                      <span className="td-meta-value">{test.tolerance}</span>
                    </div>
                  </div>

                  {/* Action area */}
                  <div className="td-test-action">
                    {completed ? (
                      <div className="td-result-summary-mini" onClick={() => openTest(test.id)} style={{ cursor: "pointer" }}>
                        <div className={`td-pass-ring-mini ${passRate >= 80 ? "good" : passRate >= 50 ? "warn" : "bad"}`}>
                          {passRate}%
                        </div>
                        <div className="td-result-counts">
                          <span className="td-rc-pass">✓ {completed.summary.pass}</span>
                          <span className="td-rc-fail">✗ {completed.summary.fail}</span>
                        </div>
                        <span className="td-view-link">View →</span>
                      </div>
                    ) : (
                      <button className="td-btn-run" onClick={() => openTest(test.id)}>
                        ▶ Run Test
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="td-footer">
          <p>Payment Application Reconciliation · Phase 2 Review</p>
        </div>
      </div>
    </div>
  );
}
