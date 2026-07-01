# 01 — User Story Validation: UI Architecture Gap Analysis

**Date:** July 1, 2026
**Reviewer:** Senior PM / Design Specialist
**Method:** Full component-by-component code reading mapped against the Day-in-a-Life workflow (16 steps) and business `03_User_Journeys_0263.md`
**Codebase reviewed:** `App.jsx`, `ProjectDetail.jsx`, `JourneyPanel.jsx`, `InputModal.jsx`, `NewProjectModal.jsx`, `DataTable.jsx`, `SubcontractorTable.jsx`, `CoverPageTable.jsx`, `PDFViewer.jsx`, `SplitPane.jsx`, `TaskPanel.jsx`, `OutputPanel.jsx`, `ProjectTiles.jsx`, `ProjectView.jsx`, all shared components and all CSS files.

---

## 1. Executive Summary

The codebase represents a **Phase 1 / Phase 2 / Phase 3 file-processing prototype**, not yet an invoice review and validation operations platform. The architecture is single-project-centric (`ProjectDetail.jsx` is a 500-line monolith), has no queue management concept, and cannot support the multi-file dependency chain described in the Day-in-a-Life workflow. Critically, the *concept of an "agent plan"* — Step 5 of the workflow where the system first reads File 1 to understand how many subcontractors exist before processing File 2 — has zero UI representation. The application has no mechanism to show a plan, pause for user confirmation, or surface cross-file validation results as grouped exceptions.

---

## 2. Day-in-a-Life Workflow Gap Analysis (16 Steps)

| Step | Business Intent | What the Code Does | Gap Severity |
|---|---|---|---|
| 1 | Receive monthly package (3 files) | No concept of a "package" grouping. A project represents a single entity, not a monthly billing cycle. | **Critical** |
| 2 | Upload all 3 files together or separately | `InputModal.jsx` handles one PDF upload for the GC file. `JourneyPanel.jsx` handles a second separate upload for subs. File 3 (supporting docs) has no upload path. | **Critical** |
| 3 | Application ingests all documents | Ingestion is triggered separately per phase by the user clicking "▶ Run". There is no unified ingestion for a full package. | **High** |
| 4 | Preliminary validation & classification → confirm to user | `OutputPanel.jsx` shows raw server text logs. There is no user-facing classification confirmation screen (e.g., "I detected a G702 Cover Page, G703 Continuation Sheet, and 12 Subcontractor Packages — is this correct?"). | **Critical** |
| 5 | Agent reads File 1, builds a plan (how many subs?) | **Entirely absent.** The application does not surface a "plan" for the user. There is no confirmation before starting File 2 processing. | **Critical** |
| 6 | Ingest → OCR → JSON → Handover to agent | Backend pipeline exists. `handleRunPipeline()` in `ProjectDetail.jsx` triggers it. | Partial — backend ok |
| 7 | Agent reviews Cover Page + Continuation Sheets → SQL | `CoverPageTable.jsx` and `DataTable.jsx` display the extracted data correctly after completion. | **Acceptable** |
| 8 | Agent validates data against File 1, captures exceptions & low-confidence | `ValidationBadge.jsx` and `DataTable.jsx` use `validation_status: "warning"/"valid"`. AI validate button triggers this. But exceptions are inline row-level warnings with no grouping, no summary count, no risk rank. | **High** |
| 9 | Agent processes File 2 (sub-contractor invoices) | `JourneyPanel.jsx` Phase 2 upload + extraction exists. But the **sequencing dependency on File 1's plan is not enforced** — a user can run Phase 2 before Phase 1 is even complete. | **High** |
| 10 | Agent validates File 2 against File 1's plan (sub count match) | **Entirely absent.** There is no cross-file reconciliation summary. The user has no way to see "File 1 said 14 subs. File 2 contained 12. 2 subs missing." | **Critical** |
| 11 | Extract data per sub into SQL | `SubcontractorTable.jsx` displays sub-level data. Line items load on expand. | **Acceptable** |
| 12 | Validate each sub's data against File 1 | `handleSubAIValidate()` exists and sets `validation_status`. Same problem as Step 8 — no grouped exception summary. | **High** |
| 13 | File 3 (supporting docs): OCR, SQL, validate, capture exceptions | **Entirely absent.** Phase 3 ("GC GR") exists in `JourneyPanel.jsx` as a locked/placeholder card but is not functional. | **Critical** |
| 14 | All tasks done — user sees "Ready for Review" state | `ProjectDetail.jsx` has a `view: "setup" / "validate"` toggle that auto-switches when `lineItems.length > 0`. This is a technical trigger, not a deliberate "Agent Complete — Your Turn" state with a summary. | **High** |
| 15 | User reviews exceptions, resolves low-confidence fields, confirms ready | `DataTable.jsx` has inline cell editing. `SubcontractorTable.jsx` has expand/collapse per sub. But there is no unified exceptions worklist, no "resolve all" workflow, and no HITL confirmation gate. | **High** |
| 16 | Formal invoice validation begins | **Not yet defined or implemented.** | TBD |

---

## 3. Architectural Mismatches

### 3.1 The "Project" Model is Wrong for This Use Case
`NewProjectModal.jsx` creates a `project` with a `name` and a free-text `baseline` field. In reality the model should be:
- **Contract** (the long-lived entity) → has a baseline SOV, rates, effective dates
- **Monthly Package** (the ephemeral entity) → belongs to a contract, contains the 3 files, has a billing period

Currently everything is mixed into one `project` table.

### 3.2 File 3 Has No UI Path
`JourneyPanel.jsx` defines Phase 3 (`GC General Requirements`) as:
```js
{ num: 3, short: "GC GR", label: "GC General Requirements", icon: "📁" }
```
The card renders but `canClick` is `false` unless `status === "complete"` — a card the user can never activate. File 3 supporting documents have no upload mechanism, no extraction trigger, and no display component.

### 3.3 `OutputPanel.jsx` is Developer Tooling, Not a User Feature
The `OutputPanel.jsx` displays raw backend server logs (`step`, `success`, `warn`, `error`, `progress`, `info`). This raw stream is appropriate for a developer terminal, not for an Invoice Reviewer. Users read messages like `▶ Running Azure GPT extraction on page 47` which is meaningless to them and does not map to any business concept they understand.

### 3.4 No "Agent Plan" Concept in the UI
The Day-in-a-Life Step 5 requires the agent to read File 1, form a plan (sub count, expected invoices), and present it to the user before proceeding. There is no `AgentPlan` state, no plan confirmation component, and no blocking gate between Phase 1 completion and Phase 2 start.

### 3.5 Sequencing is Not Enforced
In `JourneyPanel.jsx`, `canClick` for Phase 2 is:
```js
const canClick = isDone || def.num === 1 || def.num === 2;
```
Phase 2 is always clickable regardless of whether Phase 1 is complete. A user can initiate File 2 extraction before File 1 has been processed, resulting in a plan-less validation that will produce incorrect cross-file reconciliation results.

---

## 4. What Works Well (Do Not Break)
- `DataTable.jsx`: The inline cell editing, row-click-to-PDF-page, and validation badge pattern is the right paradigm. Build on it.
- `SubcontractorTable.jsx`: The expand-per-sub pattern with lazy-loaded line items is smart and scalable.
- `SplitPane.jsx`: The resizable, collapsible split pane is functionally solid and the right component for a validation workbench.
- `shared/TabBar.jsx` and `shared/SummaryBar.jsx`: These are well-abstracted and reusable. The pattern of surfacing numeric summaries (warnings, valid count, totals) at the top of a tab is correct.
- `shared/ValidationBadge.jsx`: Clean abstraction. Needs a fourth state: `"pending-review"` (agent flagged, human not yet seen).

---

## 5. Priority Resolution Roadmap

| Priority | Action |
|---|---|
| P0 | Introduce a `Package` data model distinct from `Project`. A Package has a billing period, belongs to a contract, and contains up to 3 files. |
| P0 | Build an "Agent Plan" confirmation screen between Phase 1 completion and Phase 2 start. |
| P0 | Build a File 3 (Supporting Docs) upload path and extraction flow. |
| P1 | Replace `OutputPanel.jsx` raw logs with a structured pipeline telemetry component showing business-language stage names. |
| P1 | Build a unified Exceptions Worklist component that aggregates `validation_status: "warning"` rows across all three files with grouped counts and dollar-risk ranking. |
| P1 | Add a HITL gate: a "Mark as Ready for Validation" confirmation button that a reviewer clicks to signal Step 15 completion. |
| P2 | Enforce Phase sequencing — Phase 2 must be locked until Phase 1 extraction is complete and plan is confirmed. |