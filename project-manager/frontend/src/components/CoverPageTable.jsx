import { useState } from "react";

const COVER_FIELDS = [
  { key: "to_owner",              label: "To Owner",                             type: "text" },
  { key: "from_contractor",       label: "From Contractor",                      type: "text" },
  { key: "project_name",          label: "Project Name",                         type: "text" },
  { key: "application_no",        label: "Application No.",                      type: "text" },
  { key: "period",                label: "Period To",                            type: "text" },
  { key: "original_contract_sum", label: "1. Original Contract Sum",             type: "money" },
  { key: "net_change_orders",     label: "2. Net Change by Change Orders",       type: "money" },
  { key: "contract_sum_to_date",  label: "3. Contract Sum to Date",              type: "money" },
  { key: "total_completed_stored",label: "4. Total Completed & Stored to Date",  type: "money" },
  { key: "retainage_completed",   label: "5a. Retainage on Completed Work",      type: "money" },
  { key: "retainage_materials",   label: "5b. Retainage on Stored Materials",    type: "money" },
  { key: "total_retainage",       label: "Total Retainage (5a + 5b)",            type: "money" },
  { key: "total_earned_less_ret", label: "6. Total Earned Less Retainage",       type: "money" },
  { key: "less_prev_certificates",label: "7. Less Previous Certificates",        type: "money" },
  { key: "current_payment_due",   label: "8. Current Payment Due",               type: "money", highlight: true },
  { key: "balance_to_finish",     label: "9. Balance to Finish Incl. Retainage", type: "money" },
  { key: "change_order_summary",  label: "Change Order Summary",                 type: "text" },
  { key: "architect_signature",   label: "Architect Signature Present",          type: "text" },
  { key: "contractor_signature",  label: "Contractor Signature Present",         type: "text" },
];

export default function CoverPageTable({ coverPage, onUpdate }) {
  const [editCell, setEditCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [expandedNote, setExpandedNote] = useState(null);

  const validationNotes = (() => {
    try { return coverPage.validation_notes ? JSON.parse(coverPage.validation_notes) : {}; }
    catch { return {}; }
  })();

  const startEdit = (key, rawValue) => { setEditCell(key); setEditValue(rawValue ?? ""); };
  const commitEdit = () => {
    if (!editCell) return;
    onUpdate(editCell, editValue);
    setEditCell(null); setEditValue("");
  };
  const cancelEdit = () => { setEditCell(null); setEditValue(""); };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") cancelEdit();
  };

  const formatMoney = (val) => {
    if (val === null || val === undefined) return "—";
    const n = Number(val);
    return isNaN(n) ? val : `$${n.toLocaleString()}`;
  };
  const getRawValue = (field) => {
    const val = coverPage[field.key];
    return field.type === "money" ? (val ?? 0) : (val ?? "");
  };
  const getDisplayValue = (field) => {
    const val = coverPage[field.key];
    return field.type === "money" ? formatMoney(val) : (val || "—");
  };

  const vEntries = Object.values(validationNotes);
  const vValid = vEntries.filter(v => v?.status === "valid").length;
  const vWarn  = vEntries.filter(v => v?.status === "warning").length;
  const hasValidation = vEntries.length > 0;

  return (
    <div className="cover-table-wrap">
      <div className="cover-table-header">
        <div className="cover-table-title">
          <span className="cover-table-icon">📋</span>
          <div>
            <h3>AIA G702 — Application & Certification for Payment</h3>
            <p>Application #{coverPage.application_no} • Period to {coverPage.period}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {hasValidation && (
            <div className="ws-validation-summary">
              <span className="ws-vs-item ws-vs-valid">✓ {vValid}</span>
              <span className="ws-vs-item ws-vs-warn">⚠ {vWarn}</span>
            </div>
          )}
          <span className="cover-table-hint">Double-click any value to edit</span>
        </div>
      </div>

      <div className="cover-table-scroll">
        <table className="cover-data-table">
          <thead>
            <tr>
              <th style={{ width: 32, textAlign: "center" }}>✓</th>
              <th className="cover-th-num">#</th>
              <th className="cover-th-field">Field</th>
              <th className="cover-th-value">Extracted Value</th>
            </tr>
          </thead>
          <tbody>
            {COVER_FIELDS.map((field, idx) => {
              const vResult = validationNotes[field.key];
              const vs = vResult?.status || "unchecked";
              const note = vResult?.note || "";
              const isNoteOpen = expandedNote === field.key;

              return (
                <>
                  <tr key={field.key} className={`${field.highlight ? "cover-row-highlight" : ""} ${vs === "warning" ? "cover-row-warning" : ""}`}>
                    <td className="cell-validation cover-cell-validation">
                      {vs === "valid" && (
                        <span
                          className={`v-badge v-valid${isNoteOpen ? " v-badge-active" : ""}`}
                          title="AI verified — click to override"
                          onClick={() => setExpandedNote(prev => prev === field.key ? null : field.key)}
                          style={{ cursor: "pointer" }}
                        >✓</span>
                      )}
                      {vs === "warning" && (
                        <span
                          className={`v-badge v-warning${isNoteOpen ? " v-badge-active" : ""}`}
                          onClick={() => setExpandedNote(prev => prev === field.key ? null : field.key)}
                          title="Click to see AI comment"
                          style={{ cursor: "pointer" }}
                        >⚠</span>
                      )}
                      {vs === "unchecked" && <span className="v-badge v-unchecked">–</span>}
                    </td>
                    <td className="cover-cell-num">{idx + 1}</td>
                    <td className="cover-cell-field">{field.label}</td>
                    <td
                      className={`cover-cell-value${field.type === "money" ? " cover-money" : ""}`}
                      onDoubleClick={() => startEdit(field.key, getRawValue(field))}
                    >
                      {editCell === field.key ? (
                        <input
                          className="cover-edit-input"
                          type={field.type === "money" ? "number" : "text"}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={commitEdit}
                          autoFocus
                        />
                      ) : (
                        <span className="cover-display-value">
                          {getDisplayValue(field)}
                          <span className="cover-edit-icon">✎</span>
                        </span>
                      )}
                    </td>
                  </tr>
                  {isNoteOpen && (
                    <tr key={`note-${field.key}`} className="row-note-expanded">
                      <td colSpan={4}>
                        <div className="inline-ai-note">
                          <div className="inline-ai-note-header">
                            <span className="inline-ai-note-icon">{vs === "valid" ? "✅" : "🤖"}</span>
                            <span className="inline-ai-note-label">
                              {vs === "valid" ? "AI Verified — " : "AI Comment — "}{field.label}
                            </span>
                            <div className="inline-ai-note-actions">
                              <button className="btn-dismiss-note" onClick={() => setExpandedNote(null)}>✕</button>
                            </div>
                          </div>
                          {vs === "warning" && note && <p className="inline-ai-note-text">{note}</p>}
                          {vs === "valid" && (
                            <p className="inline-ai-note-text" style={{ color: "#166534" }}>
                              This field has been verified against the PDF.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
