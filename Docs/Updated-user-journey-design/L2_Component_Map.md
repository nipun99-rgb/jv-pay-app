# L2 Component Map — Current State to Target State

**Version:** 1.0 · July 1, 2026
**Owner:** Product Management & Design
**Purpose:** Engineering sprint input. Maps every screen in the L2 journey to a component decision: KEEP / REFACTOR / RETIRE / BUILD NEW. Includes the specific changes required for refactored components.

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