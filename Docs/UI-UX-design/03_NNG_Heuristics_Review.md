# 03 — NNG 10 Heuristics Cognitive Walkthrough

**Date:** July 1, 2026
**Reviewer:** Senior PM / Design Specialist
**Method:** Expert cognitive walkthrough of each component against Nielsen's 10 heuristics. Each finding is grounded in specific component behaviour observed in the source code.
**Scope:** Full application — `App.jsx`, `ProjectDetail.jsx`, `JourneyPanel.jsx`, `DataTable.jsx`, `SubcontractorTable.jsx`, `OutputPanel.jsx`, `TaskPanel.jsx`, `SplitPane.jsx`, `InputModal.jsx`, `NewProjectModal.jsx`, `PDFViewer.jsx`, `ProjectTiles.jsx`.

---

## Heuristic 1 — Visibility of System Status
**Rating: 2/5 — Poor**

The system does significant async work (AI OCR, extraction, validation) but fails to communicate it coherently as a user journey.

**Specific observations:**
- `OutputPanel.jsx` shows server-side logs labelled with icons `▶ ✓ ⚠ ✕` and coloured text. This is a developer console masquerading as user feedback. An Invoice Reviewer reading `▶ Running Azure GPT extraction on page 47` gains no useful context.
- `JourneyPanel.jsx` shows three phase cards. A "running" card animates the circle icon (`jcard-spin` keyframe). But when extraction finishes the card snaps to "done" with no transition summary. The user never learns *what was found* — e.g., "14 subcontractors identified."
- `ProjectDetail.jsx` auto-switches from `view="setup"` to `view="validate"` when `lineItems.length > 0`. This is a silent state transition — the user gets no moment to understand the system has completed a major task and they are now entering the review phase.
- `TaskPanel.jsx` renders a vertical step list with `pending/running/complete` states. The step names (`step_name` from DB) are correct but there are only 4 generic steps. For a 16-step day-in-a-life workflow, four steps is grossly inadequate.

**What should happen:** Each completed agent task should produce a user-language summary card, e.g., *"File 1 processed. Found 14 sub-contractors billed. $2.3M total billed this period. Ready to proceed to File 2."*

---

## Heuristic 2 — Match Between System and Real World
**Rating: 2/5 — Poor**

The UI uses a mix of developer terminology and business terminology inconsistently throughout the interface.

**Specific observations:**
- `InputModal.jsx` label says "Contractor Payment Application PDF" — correct business language.
- `JourneyPanel.jsx` Phase 3 is labelled "GC GR" (short for GC General Requirements). This label is meaningless to anyone not already familiar with internal naming conventions. An Invoice Reviewer would know it as "Supporting Documents" or "Direct Cost Backup."
- The header button in `ProjectDetail.jsx` reads `📊 Test Dashboard` — the word "Test" signals a development artifact to any business user who sees it.
- `ProjectTiles.jsx` uses the folder emoji 📁 on every project tile. It communicates nothing about the nature of the work. The homepage reads "My Projects" with a subtitle count — this is project management software language, not operations platform language.
- `NewProjectModal.jsx` asks for "Project Baseline" as a free-text field. This completely misrepresents what a contract baseline is — a structured, legally binding Schedule of Values, not a text description.

---

## Heuristic 3 — User Control and Freedom
**Rating: 2/5 — Poor**

**Specific observations:**
- `ProjectView.jsx` and `ProjectDetail.jsx` both use `window.confirm()` for deletion confirmation. This is a browser-native blocking dialog that:
  - Cannot be styled or made accessible.
  - Provides no "Undo" grace period.
  - For a project containing months of extracted data, permanently destructive.
- There is no way to cancel an in-progress extraction once started. `JourneyPanel.jsx` `handleRunExtraction()` fires a `POST` and starts polling. No cancel endpoint is called.
- `SplitPane.jsx` collapse state is local component state. If the user collapses the PDF pane to focus on data and then navigates to a different phase in `JourneyPanel.jsx`, the pane state resets to default 50/50. Users lose their preferred layout repeatedly.
- In `ProjectDetail.jsx`, the `view` state auto-switches based on `lineItems.length`. If a user has navigated to the Setup view intentionally to check the pipeline log, the system may force them into Validate view when extraction completes. This is a system-initiated context switch without user consent.

---

## Heuristic 4 — Consistency and Standards
**Rating: 3/5 — Fair**

The application has made progress on consistency through `shared/` components. However inconsistencies remain.

**Specific observations:**
- **Good:** `TabBar.jsx`, `SummaryBar.jsx`, `ValidationBadge.jsx` are clean shared abstractions used in both `ProjectDetail.jsx` and `SubcontractorTable.jsx`. This is the right pattern.
- **Bad:** Button class naming is inconsistent. `App.css` defines `.btn-new-project`, `.btn-collapse`, `.btn-delete`. `ProjectDetail.jsx` uses `.ws-btn`, `.ws-btn-primary`, `.ws-btn-ai`, `.ws-btn-danger`, `.ws-btn-ghost`, `.ws-btn-sm`. These represent two entirely separate button system implementations that have never been unified.
- **Bad:** Phase cards in `JourneyPanel.jsx` use a custom `jstrip-card` system with `jcard-active`, `jcard-done`, `jcard-running`, `jcard-locked`. These don't reuse the `.ws-step-*` classes from `ProjectDetail.jsx` setup view, which also represent phase/step status. Same concept, two implementations.
- **Bad:** Navigation uses `onBack` prop (a `←` button) from `ProjectDetail.jsx` for Project→Tiles. But `SplitPane.jsx` uses `◀ ▶` arrows for pane collapse. The same arrow character serves two different semantic purposes, violating consistency.

---

## Heuristic 5 — Error Prevention
**Rating: 3/5 — Fair**

**Specific observations:**
- **Good:** `NewProjectModal.jsx` validates `!name.trim()` and `!baseline.trim()` on submit with inline `form-error` display.
- **Good:** `InputModal.jsx` validates file type: `if (f && f.type !== "application/pdf")` and shows an error.
- **Bad:** There is no guard preventing Phase 2 from starting if Phase 1 has not been completed. `JourneyPanel.jsx` sets `canClick = isDone || def.num === 1 || def.num === 2` — Phase 2 is always clickable. A user could initiate sub-contractor extraction without a valid File 1, producing cross-file validation that has nothing to reconcile against.
- **Bad:** `DataTable.jsx` allows editing any cell including calculated fields like `total_completed` and `pct`. Editing a calculated field directly without triggering recalculation is an error-prone design.
- **Bad:** `ProjectDetail.jsx` `handleDeleteItem()` uses `window.confirm("Delete this row?")`. This is insufficient guard for data that took an AI agent several minutes and API calls to extract.

---

## Heuristic 6 — Recognition Rather Than Recall
**Rating: 1/5 — Very Poor**

This is the most significant heuristic failure in the entire application.

**Specific observations:**
- The `PDFViewer.jsx` component renders an `<iframe>` with `src={pdfUrl}#page=${page}`. The `#page=` hash approach relies on the browser's built-in PDF renderer. The user cannot see which bounding boxes correspond to which extracted values in the table. They must mentally recall each value and search the page visually.
- `DataTable.jsx` `handleRowClick` sets `setPdfPage(Number(item.source_page))`. It navigates to the page but does not highlight or pan to the specific cell or bounding box. The user must scan the entire page to find the value. On a dense G703 table, a page can contain 40+ line items.
- `SubcontractorTable.jsx` lazy-loads line items per sub-contractor only on expand. The user must remember which sub-contractor they were reviewing after collapsing and re-navigating. There is no "last viewed" indicator.
- There is no persistent breadcrumb or page-level summary indicating "You are in Phase 2 → Sub-Contractor ABC → Line Item 7 of 22."
- `TaskPanel.jsx` step descriptions are hardcoded short strings. Step 3 description says "Save extracted data to database" — which is completely opaque to a business user.

---

## Heuristic 7 — Flexibility and Efficiency of Use
**Rating: 2/5 — Poor**

**Specific observations:**
- No keyboard shortcuts exist for the primary workflow actions (navigate exceptions, approve, reject, next exception).
- `SubcontractorTable.jsx` requires the user to click each sub-contractor row individually to expand and review. For a package with 20 sub-contractors, there is no "Expand All with Warnings" or "Show Only Exceptions" filter.
- `DataTable.jsx` has a `filterThisPeriod` toggle which is a good power-user feature. But it is hidden behind an unnamed boolean toggle in `ProjectDetail.jsx` — there is no visual affordance for it in the rendered UI.
- AI Validate is a single all-or-nothing batch operation. There is no way to validate only the newly corrected rows ("re-validate this row") without triggering the full AI batch again. `handleRevalidateItem()` exists in `ProjectDetail.jsx` but the UI never surfaces it — it is an orphaned backend function.

---

## Heuristic 8 — Aesthetic and Minimalist Design
**Rating: 3/5 — Moderate**

**Specific observations:**
- **Good:** `JourneyPanel.css` is well-crafted. The `.jstrip` design is compact, icon-forward, and visually clean. The phase cards communicate status effectively without excessive noise.
- **Bad:** When `view="setup"`, `ProjectDetail.jsx` renders a two-column layout: left panel with pipeline steps, right panel with `OutputPanel`. The `OutputPanel` in this context is a developer log dump showing messages like `▶ page 47 processed`. It occupies half the screen real estate on the primary onboarding view.
- **Bad:** `ProjectDetail.jsx` header has 7 conditionally rendered action buttons. The header toolbar can simultaneously show: `📄 Upload PDF`, `🤖 AI Validate`, `📄 Show PDF`, `✎ Validate Data`, `◧ Overview`, `🗑`, `📊 Test Dashboard`. Seven buttons in a header violates minimalist design — their visibility logic is complex conditional rendering that users cannot predict.
- **Bad:** Emoji are used as primary icons throughout (`📁`, `📋`, `📊`, `🤖`, `🗑`, `🚀`). Emoji render inconsistently across OS and browsers, are not scalable, and carry cultural/platform-specific interpretations. They should be replaced with an icon library (Lucide, Phosphor, Material Symbols).

---

## Heuristic 9 — Help Users Recognize, Diagnose, and Recover from Errors
**Rating: 2/5 — Poor**

**Specific observations:**
- `ProjectDetail.jsx` `handleRunPipeline()` wraps the API call in try/catch but only logs to console: `console.error("Pipeline failed:", err)`. There is no user-facing error state. If extraction fails mid-run, the UI simply stops updating. The user sees a frozen spinner and has no recovery path.
- `JourneyPanel.jsx` `handleUpload()` shows `setLogs([...l, { level: "error", msg: err.message }])`. This surfaces raw JavaScript `err.message` to the user (e.g., `"NetworkError when attempting to fetch resource"`). This is incomprehensible to a non-technical user.
- `SubcontractorTable.jsx` `fetchLineItems()` catches errors and sets `lineItemsCache[subAppId] = []`. The user sees an empty table with no indication that it failed to load. There is no retry button.
- `DataTable.jsx` edit commits via `onUpdateItem` which is an async call in the parent. If the PUT request fails, there is no rollback of the optimistically rendered edit. The user has no idea their change was not saved.

---

## Heuristic 10 — Help and Documentation
**Rating: 1/5 — Very Poor**

**Specific observations:**
- There is zero in-product contextual help. No tooltips explaining what "G702", "G703", "Phase 1", "Phase 2", "AI Validate" mean.
- `ProjectDetail.jsx` has an `ws-btn` with `title="Azure GPT-5.4 Vision checks every extracted value against the original PDF"`. This is a tooltip on the AI Validate button — the only instance of contextual help in the entire application.
- There is no onboarding flow. First-time users land on `ProjectTiles.jsx` showing "No projects yet. Click + New Project to get started." Once they create a project, the Setup view appears with 4 steps but gives no explanation of what they need to prepare or what the outputs will be.
- No in-context "what is this?" help or link to documentation from any screen in the application.

---

## Summary Scorecard

| # | Heuristic | Rating | Priority |
|---|---|---|---|
| 1 | Visibility of System Status | 2/5 | P0 |
| 2 | Match with Real World | 2/5 | P1 |
| 3 | User Control and Freedom | 2/5 | P1 |
| 4 | Consistency and Standards | 3/5 | P2 |
| 5 | Error Prevention | 3/5 | P1 |
| 6 | Recognition Rather Than Recall | 1/5 | P0 |
| 7 | Flexibility and Efficiency | 2/5 | P2 |
| 8 | Aesthetic and Minimalist Design | 3/5 | P2 |
| 9 | Help Users Recover from Errors | 2/5 | P1 |
| 10 | Help and Documentation | 1/5 | P2 |