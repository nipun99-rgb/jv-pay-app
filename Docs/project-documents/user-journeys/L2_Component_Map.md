# L2 Component Map — Current State to Target State

**Version:** 2.0 · July 2, 2026
**Owner:** Product Management & Design
**Purpose:** Engineering sprint input. Maps every screen in the L2 journey to a component decision: KEEP / REFACTOR / RETIRE / BUILD NEW. Includes the specific changes required for refactored components. Updated to document **what can be directly leveraged from the existing codebase** across frontend and backend.

---

## What We Already Have — Full Leverage Audit

Before making any decisions, this section documents every working asset in the current codebase that can be directly used or minimally adapted in the new platform. Engineering should not rewrite anything in this list.

---

### A. Backend API Endpoints — Fully Leverageable (No Changes Needed)

The Express/Node.js backend (`server.js`) provides working, tested REST endpoints. The new frontend only needs to call them — not rebuild them.

| Endpoint | Method | Leveraged By (New Screen) |
|---|---|---|
| `GET /api/projects` | List all projects | `GlobalDashboard.jsx` (package list) |
| `GET /api/projects/:id` | Single project detail | `PackageWorkspace.jsx` |
| `POST /api/projects` | Create project | `PackageIntakeWizard.jsx` (Step 1 of intake) |
| `PATCH /api/projects/:id` | Update project metadata | `PackageWorkspace.jsx` |
| `DELETE /api/projects/:id` | Delete project | `GlobalDashboard.jsx` (with new styled confirm modal) |
| `POST /api/projects/:id/upload-pdf` | Upload GC PDF (File 1) | `PackageIntakeWizard.jsx` |
| `GET /api/projects/:id/pdf` | Serve GC PDF stream | `EvidenceViewer.jsx` (File 1 pane) |
| `GET /api/projects/:id/sub-pdf` | Serve sub-contractor PDF (File 2) | `EvidenceViewer.jsx` (File 2 pane tab) |
| `GET /api/projects/:id/pdf/pages?from=&to=&src=` | Serve specific page range (supports both PDFs) | `EvidenceViewer.jsx` per-sub evidence |
| `GET /api/projects/:id/tasks` | Pipeline task list | `AgentProgressRail.jsx` |
| `PATCH /api/projects/:pid/tasks/:tid` | Update task status | `PackageWorkspace.jsx` state machine |
| `GET /api/projects/:id/cover-page` | G702 cover page data | `CoverPageTable.jsx` (no change) |
| `PUT /api/projects/:id/cover-page` | Update cover page field | `CoverPageTable.jsx` (no change) |
| `GET /api/projects/:id/line-items` | All G703 line items | `DataTable.jsx` (no change) |
| `POST /api/projects/:id/line-items` | Add line items | `DataTable.jsx` (no change) |
| `PUT /api/projects/:pid/line-items/:iid` | Update a line item | `DataTable.jsx` (no change) |
| `DELETE /api/projects/:pid/line-items/:iid` | Delete a line item | `DataTable.jsx` (no change) |
| `GET /api/projects/:id/logs?after=` | Polling log stream | `ActivityFeed.jsx` (replaces `OutputPanel`) |
| `POST /api/projects/:id/logs` | Write log entries | Backend extraction scripts (no change) |
| `DELETE /api/projects/:id/logs` | Clear logs | `PackageWorkspace.jsx` on new package start |
| `POST /api/projects/:id/run-pipeline` | Trigger GC extraction | `PackageWorkspace.jsx` (Phase 1 trigger) |
| `POST /api/projects/:id/run-subcontractor-extraction` | Trigger sub extraction | `PackageWorkspace.jsx` (Phase 2 trigger) |
| `GET /api/projects/:id/phases` | All phase statuses | `AgentProgressRail.jsx` |
| `GET /api/projects/:id/subcontractor-applications` | All sub-contractor apps | `SubcontractorTable.jsx` (no change) |
| `GET /api/projects/:id/sub-line-items?sub_app_id=` | Line items per sub | `SubcontractorTable.jsx` lazy load (no change) |
| `PATCH /api/projects/:id/subcontractor-applications/:aid` | Update sub validation | `SubcontractorTable.jsx` (no change) |
| `POST /api/projects/:id/validate-ai` | Run AI validation (GC) | `ValidationWorkbench.jsx` header action |
| `POST /api/projects/:id/validate-ai/item/:iid` | Re-validate single row | `DataTable.jsx` per-row re-validate button |
| `GET /api/projects/:id/validation-summary` | Validation polling check | `ValidationWorkbench.jsx` polling |
| `POST /api/projects/:id/validate-ai/subcontractors` | Run AI validation (subs) | `ValidationWorkbench.jsx` header action |
| `GET /api/projects/:id/sub-validation-summary` | Sub validation polling | `ValidationWorkbench.jsx` polling |

**Key backend capability already proven:** The `/pdf/pages?from=&to=&src=sub` endpoint uses `pdf-lib` to extract a page range from either the GC PDF or the sub-contractor PDF and streams it as a new PDF. This is the mechanism that will power the per-sub-contractor evidence in the Evidence Viewer — it already works.

---

### B. Database Schema — Fully Leverageable Tables

The SQLite database (`projects.db`, managed by `db.js` with `sql.js`) has all core tables. The new frontend reads from all of these with no schema changes required for Sprints 1–3.

| Table | Columns of direct use in new UI |
|---|---|
| `projects` | `id`, `name`, `baseline`, `pdf_path`, `created_at` |
| `project_phases` | `phase_number`, `status`, `pdf_path`, `item_count`, `summary_json` — this is the Agent Progress Rail data source |
| `tasks` | `step_number`, `step_name`, `status` — drives the pipeline step display |
| `line_items` | All 20 columns including `work_completed_this` (the "This Period" column for sub-contractor filtering), `validation_status`, `validation_note`, `source_page` |
| `cover_page` | All 23 fields — used as-is by `CoverPageTable.jsx` |
| `subcontractor_applications` | All fields including `recon_flag`, `completed_work_this_period`, `validation_status` — used by `SubcontractorTable.jsx` |
| `sub_line_items` | All columns including `work_completed_this` — used in expanded sub rows |
| `logs` | `id`, `level`, `message`, `created_at` — polled by `ActivityFeed.jsx` |

**Critical note for Agent Plan (Screen 4):** The `line_items` table already stores `contractor_name` and `work_completed_this` (the G703 "This Period" column). The agent plan logic — filter line items where `work_completed_this != 0` — can query this existing table directly. No new table is required for Sprint 2.

---

### C. Frontend Components — Directly Leverageable Without Modification

| Component | What to reuse directly |
|---|---|
| `shared/TabBar.jsx` | Use in `ValidationWorkbench.jsx` for G702/G703 tab and in `EvidenceViewer.jsx` for File 1/File 2 evidence tabs |
| `shared/SummaryBar.jsx` | Use in `ProcessingCompleteSummary.jsx` for the 4-stat card row and in `ValidationWorkbench.jsx` header |
| `shared/ValidationBadge.jsx` | Use in every data grid row — `DataTable.jsx`, `SubcontractorTable.jsx`, `CoverPageTable.jsx` |
| `shared/index.js` | Import barrel — keep as-is, add new shared components here |
| `SplitPane.jsx` | Core layout engine for the Validation Workbench. Reuse drag logic, collapse logic, CSS |
| `DataTable.jsx` | Column definitions, inline cell editing, `startEdit/commitEdit/cancelEdit` pattern, `formatNum` helper, row-click handler, validation badge integration |
| `SubcontractorTable.jsx` | `fmtMoney`, `fmtMoneyCompact`, `fmtPct`, `fmtDate` utility functions, `ReconBadge`, `SigBadge` sub-components, expand-per-row with lazy load pattern |
| `CoverPageTable.jsx` | G702 field display and field-level edit-in-place |
| `JourneyPanel.css` | Phase card colour tokens (`jcard-active`, `jcard-done`, `jcard-running`, `jcard-locked`), connector line styles, step circle styles — reuse in `AgentProgressRail.jsx` |
| `SplitPane.css` | Divider, collapse button, and pane transition styles — reuse as-is |

---

### D. Frontend Patterns — Leverageable Logic (Not Just Components)

These are coding patterns proven in the current codebase that must be replicated in new components rather than reinvented.

| Pattern | Where it exists today | Use in new build |
|---|---|---|
| **Polling loop** (`setInterval` + `clearInterval` on completion/error) | `JourneyPanel.jsx` `startPolling()`, `ProjectDetail.jsx` `handleRunPipeline()` | `AgentProgressRail.jsx` phase status polling, `ValidationWorkbench.jsx` validation polling |
| **Log polling with `lastId` cursor** | `OutputPanel.jsx` polls `GET /logs?after=${lastIdRef.current}` | `ActivityFeed.jsx` — same pattern, different presentation |
| **Lazy-load on expand** | `SubcontractorTable.jsx` `fetchLineItems()` with `fetchedRef` dedup guard | `ExceptionsNavigator.jsx` per-group exception lazy load |
| **Optimistic field update + server PUT** | `DataTable.jsx` `commitEdit()` → `onUpdateItem()` | Keep identical in enhanced `DataTable.jsx` |
| **FormData PDF upload** | `InputModal.jsx` `handleSubmit()` / `JourneyPanel.jsx` `handleUpload()` | `PackageIntakeWizard.jsx` — same `FormData` + `fetch POST` pattern per file |
| **Phase status machine** | `project_phases` table + `JourneyPanel.jsx` phase card states | `AgentProgressRail.jsx` — reads same table, renders as vertical rail |
| **Summarised stats from line items** | `ProjectDetail.jsx` `g703Stats` and `coverStats` useMemo blocks | `ProcessingCompleteSummary.jsx` reads same API, same reduction logic |
| **Validation polling** | `ProjectDetail.jsx` `handleAIValidate()` → polls `GET /validation-summary` until `checking === 0` | `ValidationWorkbench.jsx` identical polling pattern |
| **Drag-to-resize** | `SplitPane.jsx` `onMouseDown/onMouseMove/onMouseUp` with `containerRef` | Three-pane layout in `ValidationWorkbench.jsx` — same logic, two dividers |

---

## Component Decision Summary

| Component | Current State | Decision | Effort |
|---|---|---|---|
| `App.jsx` | Route handler + layout shell | REFACTOR | Medium |
| `Sidebar.jsx` | 260px list of projects | RETIRE → Replace | Low |
| `ProjectTiles.jsx` | Grid of project cards | RETIRE → Replace | Low |
| `NewProjectModal.jsx` | Name + baseline text form | RETIRE → Replace | Medium |
| `ProjectView.jsx` | Basic project info display | RETIRE | Low |
| `ProjectDetail.jsx` | 500-line monolith, all views | REFACTOR + SPLIT | High |
| `JourneyPanel.jsx` | 3-phase strip header | REFACTOR → `AgentProgressRail` | High |
| `JourneyPanel.css` | Phase strip styles | LEVERAGE + EXTEND | Low |
| `TaskPanel.jsx` | 4-step pipeline list | RETIRE → Replace | Medium |
| `OutputPanel.jsx` | Raw server log viewer | REFACTOR → admin-only | Low |
| `InputModal.jsx` | Single PDF upload modal | RETIRE → Replace | Medium |
| `DataTable.jsx` | G703 line items grid | KEEP + ENHANCE | Medium |
| `CoverPageTable.jsx` | G702 cover page fields | KEEP + ENHANCE | Low |
| `SubcontractorTable.jsx` | Sub-apps expandable table | KEEP + ENHANCE | Medium |
| `PDFViewer.jsx` | iframe PDF renderer | RETIRE → Replace | High |
| `SplitPane.jsx` | Resizable two-pane layout | KEEP + ENHANCE | Low |
| `shared/TabBar.jsx` | Tab navigation bar | KEEP | None |
| `shared/SummaryBar.jsx` | Stat row component | KEEP | None |
| `shared/ValidationBadge.jsx` | AI status badge | KEEP + ENHANCE | Low |
| `TestDashboard.jsx` | Developer test harness | RETIRE (not user-facing) | None |

---

## 1. RETIRE — Remove These Components

### `Sidebar.jsx` + `ProjectTiles.jsx`
**Why retire:** These implement a "project manager" mental model (list of projects in a sidebar, grid of project tiles as homepage). The application is an operations platform — the homepage must be a Package Queue, not a project browser.
**Replacement:** `GlobalDashboard.jsx` — shows pending packages grouped by contract, with status badges, SLA indicators, and queue health metrics. Calls `GET /api/projects` — same endpoint.

### `NewProjectModal.jsx`
**Why retire:** Captures project `name` and a free-text `baseline` field. This is architecturally wrong — a package needs a billing period, a contract association, and three distinct file upload zones.
**Replacement:** `PackageIntakeWizard.jsx` — a stepped intake form (Billing Period → Contract → 3 File Uploads → Confirm). Reuses the `POST /api/projects` and `POST /api/projects/:id/upload-pdf` endpoints. Reuses the drag-and-drop upload zone pattern from `InputModal.jsx` for all three file slots.

### `ProjectView.jsx`
**Why retire:** Shows project metadata (name, baseline, created_at) as a standalone view. No use case for this in the operations platform.

### `InputModal.jsx`
**Why retire:** Single PDF upload modal with drag-and-drop for the GC contractor PDF. Replaced by the `PackageIntakeWizard.jsx`. **However, extract and reuse** the drag-and-drop zone JSX pattern (`onDragOver`, `onDrop`, `handleFile`, file size display) — it is clean and correct.

### `TaskPanel.jsx`
**Why retire:** A static 4-step vertical pipeline list. Too generic and too few steps to represent the 9-stage agent processing pipeline. Does not support the Paused state or inline sub-progress.
**Replacement:** `AgentProgressRail.jsx` — reads the same `GET /api/projects/:id/tasks` and `GET /api/projects/:id/phases` endpoints. Reuses `JourneyPanel.css` step circle and card styles.

### `TestDashboard.jsx` + `TestDashboard.css`
**Why retire:** Developer test harness. Opens via `/test-dashboard/:id` route. Should not exist in user-facing navigation.

---

## 2. KEEP — No Changes Required

### `shared/TabBar.jsx`
Clean, well-abstracted, correctly used. Used in `ValidationWorkbench.jsx` (G702/G703 tabs) and `EvidenceViewer.jsx` (File 1 / File 2 evidence tabs). No changes.

### `shared/SummaryBar.jsx`
The stat card row pattern is directly used in `ProcessingCompleteSummary.jsx` and the Workbench header. No changes.

---

## 3. KEEP + ENHANCE — Extend Without Replacing

### `DataTable.jsx`
**Keep:** All 14 column definitions (they map exactly to `line_items` DB columns), inline `startEdit/commitEdit` logic, `formatNum` helper, row-click `onRowClick`, validation badge cells, `filterThisPeriod` state.

**Enhance with:**
1. **Checkbox column** for multi-row bulk selection (required for bulk Accept/Override)
2. **Exception-only filter mode** — default to `validation_status === "warning"` when entering from Screen 6
3. **Surface `onRevalidateItem`** — the prop and the backend endpoint (`POST /validate-ai/item/:iid`) both exist; the button just needs to be rendered per row
4. **File 1 vs File 2 comparison columns** — add `file1_amount` and `file2_amount` display columns for cross-file variance exceptions

### `CoverPageTable.jsx`
**Keep:** All field display and field-level edit-in-place logic. Calls the existing `PUT /api/projects/:id/cover-page` endpoint.
**Enhance:** Add `ValidationBadge` per field for fields with AI confidence flags.

### `SubcontractorTable.jsx`
**Critical fix first:** Change line 6 from `const API = "http://localhost:3001/api"` to `const API = "/api"`.

**Keep:** `fmtMoney`, `fmtMoneyCompact`, `fmtPct`, `fmtDate` utility functions; `ReconBadge`, `SigBadge`; the expand-on-click lazy-load pattern with `fetchedRef` dedup guard; `warnCount`, `validCount`, `totalDue` summary calculations.

**Enhance with:**
1. **"Show exceptions only" filter** — filter to subs where `validation_status === "warning"`
2. **Cross-file reconciliation row** — per sub, show File 1 amount vs File 2 extracted amount using `recon_flag` column (already in `subcontractor_applications` table)
3. **Agent Plan filter** — when rendering from the Agent Plan screen, surface only subs where `work_completed_this != 0` (the "This Period" filter)

### `SplitPane.jsx`
**Keep:** All drag-to-resize logic (`onMouseDown/onMouseMove/onMouseUp` with `containerRef`), collapse/expand button logic with `savedPct.current`, `SplitPane.css` styles.
**Enhance:**
1. **Persist collapse state** — lift state up to parent so pane widths survive phase tab changes
2. **Three-pane mode** — add an optional `leftRail` prop for the Exceptions Navigator in the Workbench

### `shared/ValidationBadge.jsx`
**Keep:** `valid`, `warning`, `checking`, `unchecked` states.
**Enhance:** Add `"pending-review"` state (blue dot ○) — for exceptions the agent flagged that the human has not yet opened.

### `PDFViewer.jsx` — Replace the Renderer, Keep the Interface
**Keep the component name and prop interface** (`projectId`, `hasPdf`, `page`) for drop-in compatibility.
**Replace:** Swap the `<iframe src={pdfUrl}#page=${page}>` with `react-pdf` (`<Document>` + `<Page>`) which renders to a canvas layer.
**Add props:** `highlightBbox?: { x, y, width, height }` — draws an amber rectangle on the canvas overlay when a line item row is clicked.

---

## 4. REFACTOR — Significant Structural Changes

### `App.jsx`
Replace the `window.location.pathname` match pattern with proper **React Router** (`BrowserRouter`, `Routes`, `Route`). The existing state management (`useState` for `selectedProject`) becomes URL-param driven.

New routes:
- `/` → `GlobalDashboard.jsx`
- `/packages/new` → `PackageIntakeWizard.jsx`
- `/packages/:id` → `PackageWorkspace.jsx`
- `/packages/:id/review` → `ValidationWorkbench.jsx`

### `ProjectDetail.jsx` → Split into `PackageWorkspace.jsx` + `ValidationWorkbench.jsx`
Extract all existing data-fetching hooks (`loadData`, `loadPhases`, `loadSubApps`) and all handlers (`handleRunPipeline`, `handleAIValidate`, `handleSubAIValidate`, `handleUpdateItem`, `handleDeleteItem`) into the two new components — these are all proven working logic that does not need to be rewritten.

**`PackageWorkspace.jsx`** takes: `loadPhases`, `handleRunPipeline`, the phase status machine logic, and the `tasks` + `phases` state.

**`ValidationWorkbench.jsx`** takes: `loadData`, `loadSubApps`, `handleUpdateItem`, `handleDeleteItem`, `handleAIValidate`, `handleSubAIValidate`, `handleRevalidateItem`, `filteredItems`, `g703Stats`, `coverStats` useMemo blocks.

### `JourneyPanel.jsx` → `AgentProgressRail.jsx`
The core phase status polling logic (`startPolling`, `fetchLogs`, `clearInterval on complete/error`) is proven and must be preserved. The visual rendering (phase cards) changes to a vertical rail with 9 steps.

**Extract and keep:** `startPolling()`, `fetchLogs()`, the `onPhasesUpdated` callback pattern.
**Replace:** The horizontal `jstrip-cards` DOM with a vertical `agent-rail-steps` list.
**Add:** Paused state rendering, inline sub-progress bar per step.

---

## 5. BUILD NEW — Net-New Components

| Component | Screen | Reuses from existing codebase |
|---|---|---|
| `GlobalDashboard.jsx` | Landing | `GET /api/projects` endpoint, `SummaryBar` for queue stats |
| `PackageIntakeWizard.jsx` | Screen 1 | Drag-and-drop zone from `InputModal.jsx`, `POST /api/projects` + `POST /upload-pdf` endpoints |
| `AgentProgressRail.jsx` | Screens 2–5 | Phase polling from `JourneyPanel.jsx`, `JourneyPanel.css` card styles, `GET /phases` endpoint |
| `ActivityFeed.jsx` | Screens 2–5 | Log polling pattern from `OutputPanel.jsx` (`GET /logs?after=` cursor pattern) |
| `AgentPlanEditor.jsx` | Screen 4 | `line_items` table query filtered by `work_completed_this != 0`, `SubcontractorTable` `fmtMoney` helper |
| `ProcessingCompleteSummary.jsx` | Screen 6 | `g703Stats` + `coverStats` reduction logic from `ProjectDetail.jsx`, `SummaryBar` component |
| `ExceptionsNavigator.jsx` | Screen 7 | `ValidationBadge` component, warning/valid count logic from `SubcontractorTable.jsx` |
| `EvidenceViewer.jsx` | Screen 7 | `GET /pdf/pages?from=&to=&src=` endpoint (already supports both PDFs), `TabBar` for file switching |
| `HitlConfirmationPanel.jsx` | Screen 8 | Validation summary data from `GET /validation-summary` endpoint |

---

## 6. Sprint Sequencing Recommendation

**Sprint 1 — Foundation (no new screens, unblocks everything):**
1. Fix `SubcontractorTable.jsx` localhost bug — 30 min
2. Implement design tokens in `App.css` — 1 day
3. Add React Router to `App.jsx` — 1 day
4. Replace emoji with Lucide React icon library — 1 day
5. Add `aria-live`, `aria-labelledby`, focus trap to modals — 1 day

**Sprint 2 — Package Intake + Progress Infrastructure:**
1. `PackageIntakeWizard.jsx` (3 files + billing period)
2. `GlobalDashboard.jsx` (package queue)
3. `AgentProgressRail.jsx` (vertical 9-step rail)
4. `ActivityFeed.jsx` (business-language log stream)

**Sprint 3 — Agent Plan + Processing Complete:**
1. `AgentPlanEditor.jsx` (editable sub-contractor table from G703 "This Period" filter)
2. `ProcessingCompleteSummary.jsx`
3. `PackageWorkspace.jsx` (state machine + orchestration)

**Sprint 4 — Validation Workbench:**
1. Replace `PDFViewer.jsx` iframe with `react-pdf` canvas + bbox highlight
2. `ExceptionsNavigator.jsx`
3. `EvidenceViewer.jsx` (with File 1/File 2 tab switching)
4. `ValidationWorkbench.jsx` (3-zone layout)
5. Enhance `DataTable.jsx` with checkboxes + bulk actions + exception filter

**Sprint 5 — HITL Gate + Hardening:**
1. `HitlConfirmationPanel.jsx`
2. Error state handling across all new components
3. Retire `TestDashboard.jsx`, `ProjectView.jsx`, `TaskPanel.jsx`

---

## Component Decision Summary

| Component | Current State | Decision | Effort |
|---|---|---|---|
| `App.jsx` | Route handler + layout shell | REFACTOR | Medium |
| `Sidebar.jsx` | 260px list of projects | RETIRE → Replace | Low |
| `ProjectTiles.jsx` | Grid of project cards | RETIRE → Replace | Low |
| `NewProjectModal.jsx` | Name + baseline text form | RETIRE → Replace | Medium |
| `ProjectView.jsx` | Basic project info display | RETIRE | Low |
| `ProjectDetail.jsx` | 500-line monolith, all views | REFACTOR + SPLIT | High |
| `JourneyPanel.jsx` | 3-phase strip header | REFACTOR | High |
| `JourneyPanel.css` | Phase strip styles | REFACTOR | Medium |
| `TaskPanel.jsx` | 4-step pipeline list | RETIRE → Replace | Medium |
| `OutputPanel.jsx` | Raw server log viewer | REFACTOR (admin-only) | Low |
| `InputModal.jsx` | Single PDF upload modal | RETIRE → Replace | Medium |
| `DataTable.jsx` | G703 line items grid | KEEP + ENHANCE | Medium |
| `CoverPageTable.jsx` | G702 cover page fields | KEEP + ENHANCE | Low |
| `SubcontractorTable.jsx` | Sub-apps expandable table | KEEP + ENHANCE | Medium |
| `PDFViewer.jsx` | iframe PDF renderer | RETIRE → Replace | High |
| `SplitPane.jsx` | Resizable two-pane layout | KEEP + ENHANCE | Low |
| `shared/TabBar.jsx` | Tab navigation bar | KEEP | None |
| `shared/SummaryBar.jsx` | Stat row component | KEEP | None |
| `shared/ValidationBadge.jsx` | AI status badge | KEEP + ENHANCE | Low |
| `TestDashboard.jsx` | Developer test harness | RETIRE (not user-facing) | None |

---

## 1. RETIRE — Remove These Components

### `Sidebar.jsx` + `ProjectTiles.jsx`
**Why retire:** These implement a "project manager" mental model (list of projects in a sidebar, grid of project tiles as homepage). The application is an operations platform — the homepage must be a Package Queue, not a project browser.
**Replacement:** `GlobalDashboard.jsx` — shows pending packages grouped by contract, with status badges, SLA indicators, and queue health metrics.

### `NewProjectModal.jsx`
**Why retire:** Captures project `name` and a free-text `baseline` field. This is architecturally wrong — a package needs a billing period, a contract association, and three distinct file upload zones.
**Replacement:** `PackageIntakeWizard.jsx` — a stepped intake form (Billing Period → Contract → 3 File Uploads → Confirm).

### `ProjectView.jsx`
**Why retire:** Shows project metadata (name, baseline, created_at) as a standalone view. No use case for this in the operations platform.

### `InputModal.jsx`
**Why retire:** Single PDF upload modal with drag-and-drop for the GC contractor PDF. Replaced by the `PackageIntakeWizard.jsx` which handles all three files in one intake flow.

### `TaskPanel.jsx`
**Why retire:** A static 4-step vertical pipeline list. Too generic and too few steps to represent the 9-stage agent processing pipeline. Does not support the Paused state or inline sub-progress.
**Replacement:** `AgentProgressRail.jsx` — a dedicated, dynamic 9-step progress component with per-step states (pending, running, paused, complete, error) and inline sub-progress bars for long-running steps.

### `TestDashboard.jsx` + `TestDashboard.css`
**Why retire:** Developer test harness. Opens via `/test-dashboard/:id` route. Should not exist in user-facing navigation.

---

## 2. KEEP — No Changes Required

### `shared/TabBar.jsx`
The `TabBar` component is clean, well-abstracted, and correctly used in `ProjectDetail.jsx`. Keep as-is. Used in the Validation Workbench to toggle between G702/G703 tabs and between File 1/File 2 evidence in the PDF viewer.

### `shared/SummaryBar.jsx`
The `SummaryBar` stat row pattern (value + label stacked cards) is the right pattern for the Processing Complete summary screen and the Validation Workbench header. Keep as-is.

---

## 3. KEEP + ENHANCE — Extend Without Replacing

### `DataTable.jsx`
**Keep:** Column definitions, inline cell editing, row-click-to-PDF-page, validation badge integration, `filterThisPeriod` toggle logic.

**Enhance with:**
1. **Checkbox column** for multi-row bulk selection (required for bulk Accept/Override in Workbench)
2. **Exception-only filter mode** — when entering the Workbench from Screen 6, the table defaults to showing only rows where `validation_status === "warning"`. Toggle to show all.
3. **"Re-validate this row" button** — surface `onRevalidateItem` which already exists in `ProjectDetail.jsx` but is never rendered
4. **File 1 vs File 2 comparison columns** — add `file1_amount` and `file2_amount` columns for variance exceptions (currently only one amount column exists)

### `CoverPageTable.jsx`
**Keep:** Field display and edit-in-place logic.
**Enhance:** Add validation badge per field. Some cover page fields (e.g., contract sum, retainage rate) may have AI confidence flags that should be surfaced inline.

### `SubcontractorTable.jsx`
**Critical bug fix first:** Change `const API = "http://localhost:3001/api"` → `const API = "/api"` (line 6).

**Keep:** Expand-per-sub pattern, lazy-loaded line items, ReconBadge, SigBadge, fmtMoney helpers.

**Enhance with:**
1. **"Show exceptions only" filter** — filter to subs with `validation_status === "warning"` only
2. **Cross-file reconciliation row** — per sub-contractor, show a reconciliation status card comparing File 1 billed amount vs. File 2 extracted amount (this is the Step 10 cross-file validation display)
3. **Confidence indicator per sub** — surface the overall AI confidence for the sub's extraction

### `SplitPane.jsx`
**Keep:** Drag-to-resize logic, collapse/expand buttons, keyboard-safe implementation.
**Enhance:**
1. **Persist collapse state** — use `useRef` or lift state up so the user's preferred pane width survives phase tab changes
2. **Three-pane mode** — add an optional `leftRail` prop for the Exceptions Navigator in the Workbench (current component is hardcoded to two panes)

### `shared/ValidationBadge.jsx`
**Keep:** `valid`, `warning`, `checking`, `unchecked` states and clean shared abstraction.
**Enhance:** Add a fifth state `"pending-review"` — used for exceptions that the agent flagged but the human has not yet seen. Visually distinct from `"warning"` (which is post-AI-flag). Color: blue dot (○) rather than amber triangle.

### `PDFViewer.jsx`
**Retire the `<iframe>` implementation. Build a replacement with the same component name for drop-in compatibility.**

Current:
```jsx
<iframe className="pdf-frame" src={`${pdfUrl}#page=${page}`} title="PDF Viewer" />
```
This has no programmatic annotation capability.

New implementation using `react-pdf`:
```jsx
import { Document, Page } from 'react-pdf';
// Renders to canvas — allows programmatic bounding box highlight overlay
```
Props to add:
- `highlightBbox?: { x: number, y: number, width: number, height: number }` — draws an amber rectangle on the canvas layer
- `onPageRendered?: (pageNumber: number) => void` — callback after render
Keep existing: `projectId`, `hasPdf`, `page` / `setPage` interface

---

## 4. REFACTOR — Significant Structural Changes

### `App.jsx`
**Current:** Route handler using `window.location.pathname` match (not React Router). Renders Sidebar + ProjectTiles or ProjectDetail based on `selectedProject` state.

**Refactor to:**
1. Integrate React Router properly (`BrowserRouter`, `Routes`, `Route`)
2. Routes:
   - `/` → `GlobalDashboard.jsx`
   - `/packages/new` → `PackageIntakeWizard.jsx`
   - `/packages/:id` → `PackageWorkspace.jsx` (the new container for all package screens)
   - `/packages/:id/review` → `ValidationWorkbench.jsx`
3. Remove the `selectedProject` useState anti-pattern — use URL params instead

### `ProjectDetail.jsx` → Split into `PackageWorkspace.jsx` + `ValidationWorkbench.jsx`
**Current:** A 500-line monolith that handles Setup view, Validate view, all 3 phase tabs, all data fetching, all action handlers, PDF page state, validation state, and render decisions.

**Refactor — Split into two components:**

**`PackageWorkspace.jsx`** (replaces the Setup view + JourneyPanel orchestration):
- Renders the Agent Progress Rail
- Manages overall package state machine (INGESTING → FILE_1_PROCESSING → AWAITING_PLAN → etc.)
- Contains the Activity Feed
- Renders the Agent Plan Editor (Screen 4) when state is `AWAITING_PLAN_CONFIRMATION`
- Renders the Processing Complete Summary (Screen 6) when state is `PROCESSING_COMPLETE`

**`ValidationWorkbench.jsx`** (replaces the Validate view):
- Renders the 3-zone layout: Exceptions Navigator + Data Grid + Evidence Viewer
- Manages exception group selection state
- Contains the bulk action toolbar
- Renders the HITL Confirmation Gate panel

### `JourneyPanel.jsx`
**Current:** A compact horizontal strip showing 3 phase cards (Contractor, Subcontractors, GC GR) with embedded Phase 2 setup logic inside the same component.

**Refactor to `AgentProgressRail.jsx`:**
- Vertical orientation (left rail, not horizontal strip)
- 9 configurable steps driven by a `steps` prop array (not hardcoded 3 phases)
- Each step accepts `{ id, label, status, subProgress?, subLabel? }` 
- Paused state renders an amber pulsing dot + "Waiting for you" label
- Sub-progress renders an inline mini progress bar within a running step
- Remove all Phase 2 upload/extraction logic from this component — that logic moves to `PackageWorkspace.jsx`

---

## 5. BUILD NEW — Net-New Components

| Component | Screen | Description |
|---|---|---|
| `GlobalDashboard.jsx` | Landing | Package queue view with status, SLA, and $ at risk per package |
| `PackageIntakeWizard.jsx` | Screen 1 | Stepped intake form for new monthly package (3 file uploads + billing period + contract) |
| `AgentProgressRail.jsx` | Screens 2–5 | Dynamic 9-step vertical progress component with paused state and sub-progress |
| `ActivityFeed.jsx` | Screens 2–5 | Business-language live event stream (replaces OutputPanel for user-facing context) |
| `AgentPlanEditor.jsx` | Screen 4 | Editable sub-contractor confirmation table with add/remove/edit rows |
| `ProcessingCompleteSummary.jsx` | Screen 6 | Post-processing summary card with exception breakdown by type and $ at risk |
| `ExceptionsNavigator.jsx` | Screen 7 | Left-rail exception group list with resolved/unresolved indicators |
| `EvidenceViewer.jsx` | Screen 7 | PDF viewer wrapper with bounding box highlight and File 1/2 tab switching |
| `HitlConfirmationPanel.jsx` | Screen 8 | Slide-in HITL gate panel with review summary and confirm/back actions |

---

## 6. Sprint Sequencing Recommendation

**Sprint 1 — Foundation (unblocks all subsequent work):**
1. Fix `SubcontractorTable.jsx` localhost bug (30 min)
2. Implement design tokens in `App.css` (1 day)
3. Restructure routing in `App.jsx` to React Router (1 day)
4. Replace emoji with Lucide icon library across all components (1 day)

**Sprint 2 — Package Intake:**
1. Build `PackageIntakeWizard.jsx` (3 files + billing period + contract)
2. Build `GlobalDashboard.jsx` (package queue)
3. Build `AgentProgressRail.jsx`
4. Build `ActivityFeed.jsx`

**Sprint 3 — Agent Plan & Processing:**
1. Build `AgentPlanEditor.jsx` (editable sub-contractor table)
2. Build `ProcessingCompleteSummary.jsx`
3. Implement package state machine in `PackageWorkspace.jsx`

**Sprint 4 — Validation Workbench:**
1. Replace `PDFViewer.jsx` iframe with react-pdf canvas renderer + bbox highlight
2. Build `ExceptionsNavigator.jsx`
3. Build `EvidenceViewer.jsx`
4. Build `ValidationWorkbench.jsx` (3-zone layout)
5. Enhance `DataTable.jsx` with checkboxes + bulk actions + exception filter

**Sprint 5 — HITL Gate + Hardening:**
1. Build `HitlConfirmationPanel.jsx`
2. WCAG fixes (aria-labelledby, focus trap, aria-live, contrast tokens)
3. Error state handling across all new components (no silent failures)
4. Retire `TestDashboard.jsx`, `ProjectView.jsx`, `TaskPanel.jsx`