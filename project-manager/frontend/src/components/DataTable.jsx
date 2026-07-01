import { useState } from "react";

const COLUMNS = [
  { key: "validation_status",      label: "✓",            width: 36,  type: "status" },
  { key: "item_no",                label: "Item #",       width: 60,  type: "text" },
  { key: "phases",                 label: "Phase",        width: 70,  type: "text" },
  { key: "type_of_work",          label: "Description",   width: 160, type: "text" },
  { key: "contractor_name",       label: "Contractor",    width: 130, type: "text" },
  { key: "scheduled_current",     label: "Sched Current", width: 110, type: "number" },
  { key: "work_completed_prev",   label: "Prev Work",     width: 100, type: "number" },
  { key: "work_completed_this",   label: "This Period",   width: 100, type: "number" },
  { key: "materials_stored",      label: "Materials",     width: 90,  type: "number" },
  { key: "total_completed",       label: "Total Comp",    width: 100, type: "number" },
  { key: "pct",                   label: "%",             width: 55,  type: "text" },
  { key: "balance_to_finish",     label: "Balance",       width: 100, type: "number" },
  { key: "retainage",             label: "Retainage",     width: 90,  type: "number" },
  { key: "source_page",           label: "Pg",            width: 40,  type: "number" },
];

export default function DataTable({ items, onUpdateItem, onDeleteItem, onAddItem, onRowClick, activePage, onRevalidateItem }) {
  const [editCell, setEditCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [expandedNote, setExpandedNote] = useState(null);

  const startEdit = (rowId, colKey, currentValue) => {
    setEditCell({ rowId, colKey });
    setEditValue(currentValue ?? "");
  };
  const commitEdit = () => {
    if (!editCell) return;
    onUpdateItem(editCell.rowId, { [editCell.colKey]: editValue });
    setEditCell(null); setEditValue("");
  };
  const cancelEdit = () => { setEditCell(null); setEditValue(""); };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") cancelEdit();
  };
  const formatNum = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const n = Number(val);
    return isNaN(n) ? val : n.toLocaleString("en-US");
  };
  const toggleNote = (e, itemId) => {
    e.stopPropagation();
    setExpandedNote(prev => prev === itemId ? null : itemId);
  };

  if (items.length === 0) {
    return (
      <div className="data-table-container data-empty">
        <div className="data-empty-icon">📊</div>
        <h3>No extracted data</h3>
        <p>Run the extraction pipeline to populate data here.</p>
      </div>
    );
  }

  return (
    <div className="data-table-container">
      <div className="data-table-toolbar">
        <span className="data-table-title">Extracted Data</span>
        <span className="data-table-count">{items.length} rows</span>
        <button className="btn-add-row" onClick={onAddItem}>+ Add Row</button>
      </div>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} style={{ minWidth: col.width }}>{col.label}</th>
              ))}
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const isActiveRow = activePage && Number(item.source_page) === activePage;
              const isExpanded = expandedNote === item.id;
              const vs = item.validation_status || "unchecked";
              return (
                <>
                  <tr
                    key={item.id}
                    className={`${isActiveRow ? "row-active" : ""} ${vs === "warning" ? "row-warning" : ""}`}
                    onClick={() => onRowClick && onRowClick(item)}
                  >
                    {COLUMNS.map(col => {
                      if (col.type === "status") {
                        return (
                          <td key={col.key} className="cell-validation">
                            {vs === "valid" && (
                              <span
                                className={`v-badge v-valid${isExpanded ? " v-badge-active" : ""}`}
                                title="AI verified — click to override"
                                onClick={e => toggleNote(e, item.id)}
                                style={{ cursor: "pointer" }}
                              >✓</span>
                            )}
                            {vs === "warning" && (
                              <span
                                className={`v-badge v-warning${isExpanded ? " v-badge-active" : ""}`}
                                onClick={e => toggleNote(e, item.id)}
                                title="Click to see AI comment"
                                style={{ cursor: "pointer" }}
                              >⚠</span>
                            )}
                            {vs === "checking" && <span className="v-badge v-checking" title="Checking…">⋯</span>}
                            {vs === "unchecked" && (
                              <span
                                className="v-badge v-unchecked"
                                title="Not validated — click to mark correct"
                                onClick={e => { e.stopPropagation(); onUpdateItem(item.id, { validation_status: "valid", validation_note: "" }); }}
                                style={{ cursor: "pointer" }}
                              >–</span>
                            )}
                          </td>
                        );
                      }
                      const isEditing = editCell?.rowId === item.id && editCell?.colKey === col.key;
                      const raw = item[col.key];
                      const display = col.type === "number" ? formatNum(raw) : (raw ?? "");
                      return (
                        <td
                          key={col.key}
                          className={isEditing ? "cell-editing" : "cell-display"}
                          onDoubleClick={() => startEdit(item.id, col.key, raw)}
                        >
                          {isEditing ? (
                            <input
                              className="cell-input"
                              type={col.type === "number" ? "number" : "text"}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleKeyDown}
                              autoFocus
                            />
                          ) : (
                            <span className="cell-text">{display}</span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <button
                        className="btn-delete-row"
                        onClick={e => { e.stopPropagation(); onDeleteItem(item.id); }}
                        title="Delete row"
                      >✕</button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`note-${item.id}`} className="row-note-expanded">
                      <td colSpan={COLUMNS.length + 1}>
                        <div className="inline-ai-note">
                          <div className="inline-ai-note-header">
                            <span className="inline-ai-note-icon">{vs === "valid" ? "✅" : "🤖"}</span>
                            <span className="inline-ai-note-label">
                              {vs === "valid" ? "AI Verified — Override Status" : "AI Validation Comment"}
                            </span>
                            <div className="inline-ai-note-actions">
                              {vs === "warning" && (
                                <button
                                  className="btn-mark-correct"
                                  onClick={e => { e.stopPropagation(); onUpdateItem(item.id, { validation_status: "valid", validation_note: "" }); setExpandedNote(null); }}
                                  title="Mark this item as correct"
                                >✓ Mark Correct</button>
                              )}
                              {vs === "valid" && (
                                <button
                                  className="btn-flag-review"
                                  onClick={e => { e.stopPropagation(); onUpdateItem(item.id, { validation_status: "warning", validation_note: "Manually flagged for review" }); setExpandedNote(null); }}
                                  title="Flag for manual review"
                                >⚠ Flag for Review</button>
                              )}
                              {vs === "warning" && onRevalidateItem && (
                                <button
                                  className="btn-revalidate"
                                  onClick={e => { e.stopPropagation(); onRevalidateItem(item.id); setExpandedNote(null); }}
                                >↻ Re-check</button>
                              )}
                              <button
                                className="btn-dismiss-note"
                                onClick={e => { e.stopPropagation(); setExpandedNote(null); }}
                              >✕</button>
                            </div>
                          </div>
                          {vs === "warning" && item.validation_note && (
                            <p className="inline-ai-note-text">{item.validation_note}</p>
                          )}
                          {vs === "valid" && (
                            <p className="inline-ai-note-text" style={{ color: "#166534" }}>
                              This item has been verified by AI. Click "Flag for Review" if you believe it needs correction.
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
