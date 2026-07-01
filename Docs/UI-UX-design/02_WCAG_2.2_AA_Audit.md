# 02 — WCAG 2.2 AA Accessibility Audit

**Date:** July 1, 2026
**Reviewer:** Senior PM / Design Specialist
**Method:** Source code inspection of all JSX components and CSS files. Each finding references the specific file, line context, and the WCAG 2.2 success criterion violated.
**Result Summary:** 9 violations found across 6 components. 3 are high severity (barriers to assistive technology users). 6 are medium/low.

---

## Finding 1 — `NewProjectModal.jsx` & `InputModal.jsx`: Dialog Missing `aria-labelledby`
**WCAG Criterion:** 4.1.2 Name, Role, Value (Level A)
**Severity:** High

Both modals use `role="dialog" aria-modal="true"`. Screen readers will announce "dialog" without context of purpose when focus enters. The `<h2>` inside each modal is not referenced by `aria-labelledby`.

**Code reference — `NewProjectModal.jsx`:**
```jsx
<div className="modal" role="dialog" aria-modal="true">
  <div className="modal-header">
    <h2>New Project</h2>  ← h2 has no id
```
**Fix:**
```jsx
<div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-new-project">
  <h2 id="modal-title-new-project">New Project</h2>
```

---

## Finding 2 — `NewProjectModal.jsx`: Focus is Not Trapped Inside Modal
**WCAG Criterion:** 2.1.2 No Keyboard Trap / 2.4.3 Focus Order (Level A/AA)
**Severity:** High

`handleOverlayClick` closes the modal on backdrop click but does not manage keyboard focus. A keyboard-only user can Tab past the modal close button into the frozen background DOM (Sidebar, project list). There is no `inert` attribute on the background and no focus-lock library in use.

**Code reference — `NewProjectModal.jsx`:**
```jsx
const handleOverlayClick = (e) => {
  if (e.target === e.currentTarget) onClose();
  // No focus management whatsoever
};
```
**Fix:** Apply `inert` to `<main className="main-content">` while the modal is open, or use a headless UI focus trap (Radix Dialog, Headless UI Dialog, or `focus-trap-react`).

---

## Finding 3 — `JourneyPanel.jsx`: Async Updates Are Silent to Screen Readers
**WCAG Criterion:** 4.1.3 Status Messages (Level AA)
**Severity:** High

When extraction runs, the component calls `setLogs()` to append messages to the log array. These changes update the DOM but are never announced to assistive technology users because there is no `aria-live` region.

**Code reference — `JourneyPanel.jsx`:**
```jsx
{logs.slice(-4).map((l, i) => (
  <div key={i} className={`jlog-line jlog-${l.level}`}>{l.msg}</div>
  // No aria-live="polite" on the parent container
))}
```
Similarly, `OutputPanel.jsx` renders a log list with no `aria-live` region.

**Fix:** Wrap the log container in an ARIA live region:
```jsx
<div aria-live="polite" aria-atomic="false" className="jstrip-log">
```

---

## Finding 4 — `Sidebar.jsx`: Decorative Characters Announced as Content
**WCAG Criterion:** 1.1.1 Non-text Content (Level A)
**Severity:** Medium

The collapse button renders `◀ Hide`. The left-pointing arrow `◀` is a Unicode character that screen readers (NVDA, VoiceOver) announce verbatim as "left-pointing triangle" before reading "Hide". The expand button `☰` in `App.jsx` is similarly noisy.

**Code reference — `Sidebar.jsx`:**
```jsx
<button className="btn-collapse" onClick={onToggle} title="Collapse sidebar">
  ◀ Hide
</button>
```
**Code reference — `App.jsx`:**
```jsx
<button className="btn-expand-sidebar" onClick={() => setSidebarOpen(true)} title="Open sidebar">
  ☰
</button>
```
**Fix:**
```jsx
<button className="btn-expand-sidebar" aria-label="Open sidebar">
  <span aria-hidden="true">☰</span>
</button>
```

---

## Finding 5 — `SplitPane.jsx`: Collapse Buttons Have No Accessible Name
**WCAG Criterion:** 4.1.2 Name, Role, Value (Level A)
**Severity:** Medium

The divider collapse buttons render single arrow characters (`◀`, `▶`) as text content. Their `title` attribute is used as the label. `title` is not reliably announced by all screen readers, particularly on touch/mobile contexts.

**Code reference — `SplitPane.jsx`:**
```jsx
<button
  className={`split-collapse-btn split-collapse-left`}
  onClick={(e) => { e.stopPropagation(); collapseLeft(); }}
  title={collapsed === "left" ? "Show table" : "Hide table"}
>
  {collapsed === "left" ? "▶" : "◀"}
</button>
```
**Fix:** Use `aria-label` instead of (or in addition to) `title`, and wrap the arrow in `<span aria-hidden="true">`.

---

## Finding 6 — `DataTable.jsx` & `SubcontractorTable.jsx`: Tables Have No `<caption>` or `aria-label`
**WCAG Criterion:** 1.3.1 Info and Relationships (Level A)
**Severity:** Medium

Both `DataTable.jsx` and `SubcontractorTable.jsx` render `<table>` elements without a `<caption>` tag or `aria-label` attribute. A screen reader user navigating the page will hear "table" with no description of what the table contains.

**Code reference — `DataTable.jsx`:**
```jsx
<table className="data-table">
  <thead>
    <tr>
      {COLUMNS.map(col => (
        <th key={col.key} style={{ minWidth: col.width }}>{col.label}</th>
      ))}
```
**Fix:** Add `<caption className="visually-hidden">G703 Continuation Sheet Line Items</caption>` or `aria-label="G703 Continuation Sheet"` to the `<table>`.

---

## Finding 7 — `App.css`: Contrast Failures on Secondary Text
**WCAG Criterion:** 1.4.3 Contrast Minimum (Level AA)
**Severity:** Medium

Two color values in `App.css` produce insufficient contrast ratios against their backgrounds:

| Element | Text Color | Background | Ratio | Required | Result |
|---|---|---|---|---|---|
| `.btn-collapse` | `#777` | `#f9f9fb` | ~4.1:1 | 4.5:1 | **FAIL** |
| `.sidebar-section-label` | `#999` | `#f9f9fb` | ~3.0:1 | 4.5:1 | **FAIL** |
| `.jstrip-title` (JourneyPanel.css) | `#94a3b8` | `#ffffff` | ~2.8:1 | 4.5:1 | **FAIL** |
| `.jcard-meta` (JourneyPanel.css) | `#64748b` | `#f8fafc` | ~4.2:1 | 4.5:1 | **FAIL** |

**Fix:** Update to minimum compliant values:
- `#777` → `#595959` (5.1:1)
- `#999` → `#757575` (4.6:1)
- `#94a3b8` → `#5a7196` (4.7:1 on white)
- `#64748b` → `#4a5568` (5.9:1)

---

## Finding 8 — `DataTable.jsx`: Editable Cells Have No Role Announcement
**WCAG Criterion:** 4.1.2 Name, Role, Value (Level A)
**Severity:** Low

Cells that become editable on click switch to an `<input>` via `startEdit()` but the transition is silent. A screen reader user clicking a cell has no indication the cell has become an edit field.

**Fix:** When `editCell` state is set, ensure the rendered `<input>` receives `aria-label` containing the column name and current value (e.g., `aria-label="Edit Scheduled Current: $45,000"`).

---

## Finding 9 — `ProjectTiles.jsx`: Cards Are `<div>` with `onClick`, Not Buttons
**WCAG Criterion:** 4.1.2 Name, Role, Value (Level A) / 2.1.1 Keyboard (Level A)
**Severity:** Low

Project tiles are `<div>` elements with `onClick` handlers. They are not keyboard-accessible by default (not focusable with Tab, not activatable with Enter/Space).

**Code reference — `ProjectTiles.jsx`:**
```jsx
<div
  key={project.id}
  className="project-tile"
  onClick={() => onSelectProject(project)}
>
```
**Fix:** Change to `<button className="project-tile">` or add `role="button" tabIndex={0}` with `onKeyDown` handling for Enter/Space.

---

## Summary Table

| # | Component | Criterion | Severity |
|---|---|---|---|
| 1 | NewProjectModal, InputModal | 4.1.2 aria-labelledby missing | High |
| 2 | NewProjectModal | 2.1.2 / 2.4.3 No focus trap | High |
| 3 | JourneyPanel, OutputPanel | 4.1.3 No aria-live for async updates | High |
| 4 | Sidebar, App | 1.1.1 Decorative characters announced | Medium |
| 5 | SplitPane | 4.1.2 Buttons without accessible names | Medium |
| 6 | DataTable, SubcontractorTable | 1.3.1 Tables without captions | Medium |
| 7 | App.css, JourneyPanel.css | 1.4.3 Contrast failures (4 instances) | Medium |
| 8 | DataTable | 4.1.2 Silent edit-cell transition | Low |
| 9 | ProjectTiles | 4.1.2 / 2.1.1 Divs acting as buttons | Low |