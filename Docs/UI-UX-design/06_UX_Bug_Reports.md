# 06 — UX Bug Reports (Contentsquare 3-Layer Format)

**Date:** July 1, 2026
**Reviewer:** Senior PM / Design Specialist
**Audience:** Frontend Engineering — actionable, code-referenced, prioritised.
**Format:** What (observable symptom) / Struggle (user impact) / Cause (root code problem)

---

## Bug 01 — PDF Viewer Does Not Highlight the Extracted Cell
**Severity:** P0 — Breaks the core HITL review workflow
**HEART impact:** Task Success — users cannot efficiently verify AI extractions

**What:**
When an Invoice Reviewer clicks a row in `DataTable.jsx`, the PDF viewer navigates to the source page but does not scroll to, zoom to, or highlight the specific cell or bounding box that the AI extracted. The user sees the entire page.

**Struggle:**
A G703 continuation sheet can contain 40+ line items per page. The user must visually scan the entire page to find the value they want to verify (e.g., "Work Completed This Period: $45,000" on row 23 of a 40-row table). This turns a 5-second verification into a 2-minute manual hunt. Multiply across 200 line items and the tool offers no speed advantage over paper review.

**Cause:**
`ProjectDetail.jsx` `handleRowClick` only calls `setPdfPage(Number(item.source_page))`. The database schema stores `source_page` per line item but no bounding box coordinates (`x`, `y`, `width`, `height`). `PDFViewer.jsx` renders an `<iframe src={pdfUrl}#page=${page}>` which delegates rendering to the browser's native PDF renderer — which provides no API for programmatic annotation or viewport panning.

**Resolution path:**
1. Store bounding box coordinates (`source_bbox`) per line item during extraction.
2. Replace the `<iframe>` PDF renderer with `react-pdf` (PDF.js) which exposes a canvas layer for programmatic highlighting.
3. On `handleRowClick`, pass the bbox to the PDF viewer component and draw a highlight rectangle over the canvas at the correct coordinates.

---

## Bug 02 — Phase 2 Can Be Started Before Phase 1 Produces a Valid Plan
**Severity:** P0 — Produces silent data integrity failure
**HEART impact:** Task Success, Retention

**What:**
A user can click the Phase 2 card in `JourneyPanel.jsx`, upload a sub-contractor PDF, and run extraction — even if Phase 1 extraction has not been completed. The sub-contractor validation will run without a plan to check against.

**Struggle:**
Step 10 of the workflow requires the agent to validate "File 2 sub-contractor count matches File 1 plan." If Phase 2 runs without Phase 1 data, this cross-validation produces either a crash or a silent empty comparison. The user sees no error — they simply proceed to a sub-contractor table with no GC-level reconciliation.

**Cause:**
`JourneyPanel.jsx` `canClick` logic:
```js
const canClick = isDone || def.num === 1 || def.num === 2;
```
Phase 2 (`def.num === 2`) is unconditionally clickable regardless of Phase 1 status. There is no gate on `phases.find(p => p.phase_number === 1)?.status === "complete"`.

**Resolution path:**
Change `canClick` for Phase 2 to require Phase 1 completion:
```js
const phase1Done = phases.find(p => p.phase_number === 1)?.status === "complete";
const canClick = isDone || def.num === 1 || (def.num === 2 && phase1Done);
```
Additionally, show a tooltip on the locked Phase 2 card: *"Complete Contractor Payment Application first to enable this step."*

---

## Bug 03 — Extraction Failures Are Invisible to Users
**Severity:** P1 — Causes task abandonment and loss of trust
**HEART impact:** Happiness, Retention

**What:**
If the backend AI extraction pipeline throws an error (network timeout, Azure API failure, parsing exception), the user receives no user-facing notification. The `OutputPanel` may show a red log line but the rest of the UI freezes — the phase card stays in "running" state indefinitely.

**Struggle:**
Users wait, believing the system is still working. After several minutes without progress, they either refresh the page (losing all state) or abandon the session entirely. There is no recovery path offered.

**Cause — `ProjectDetail.jsx`:**
```js
} catch (err) {
  console.error("Pipeline failed:", err);  // ← visible only in DevTools
  setPipelineRunning(false);
  // No user-facing error state set
}
```
```js
// JourneyPanel.jsx polling — silently catches errors
} catch (_) {}
```
The polling interval in `JourneyPanel.jsx` swallows all errors with an empty catch block. If polling itself fails (server down), the interval keeps running forever.

**Resolution path:**
1. Add an `error` state in `JourneyPanel.jsx`. If 3 consecutive polling attempts fail, set the phase to error state and surface a user-facing message.
2. Replace `catch (_) {}` with proper error counting and fallback UI.
3. Add a "Retry" button on error states that re-triggers the extraction endpoint.

---

## Bug 04 — `OutputPanel` Developer Logs Are Shown to Business Users
**Severity:** P1 — Confuses users, undermines product credibility
**HEART impact:** Happiness, Adoption

**What:**
`OutputPanel.jsx` is rendered in the Setup view (`view="setup"`) occupying the right half of the screen. It shows raw server-side processing logs with messages like `"▶ Running pdfplumber on page 47"` and `"✓ Inserted 14 rows into line_items table"`.

**Struggle:**
An Invoice Reviewer is a finance professional, not an engineer. Seeing database INSERT statements and OCR library names in the primary UI interface is confusing and reduces trust in the application's professional quality. Users do not know whether to pay attention to these messages or ignore them.

**Cause:**
`OutputPanel.jsx` was built as a developer debugging tool and was embedded directly into the user-facing `ProjectDetail.jsx` setup view without a separate "Admin / Debug" toggle:
```jsx
{view === "setup" && (
  <div className="ws-setup-split">
    <div className="ws-setup-left"> ... pipeline steps ... </div>
    <div className="ws-setup-right">
      <OutputPanel projectId={localProject.id} visible={true} />  ← always visible
    </div>
  </div>
)}
```

**Resolution path:**
1. Replace the `OutputPanel` in the user-facing setup view with a structured `AgentProgressCard` component that translates server events into business language: *"Extracting line items from your PDF (Page 47 of 120)…"*
2. Move `OutputPanel` behind a `[Show Technical Logs]` toggle for admin/support use only.

---

## Bug 05 — Deleting a Project Is Instant and Unrecoverable
**Severity:** P1 — Catastrophic data loss risk
**HEART impact:** Happiness, Retention

**What:**
In `ProjectDetail.jsx`, clicking the 🗑 button triggers `window.confirm("Delete project '...'? This cannot be undone.")` followed immediately by a `DELETE /api/projects/:id` request. The project and all its extracted data, validation results, and logs are permanently destroyed.

**Struggle:**
A project may represent weeks of AI extraction work, manual corrections, and validation results against a multi-million dollar invoice. The only protection is a browser-native `window.confirm` dialog — which many users have trained themselves to click through without reading. There is no 30-second undo window, no soft-delete, and no recovery path.

**Cause — `ProjectDetail.jsx`:**
```js
const handleDelete = () => {
  if (window.confirm(`Delete project "${localProject.name}"? This cannot be undone.`)) {
    onDelete(localProject.id);  // ← instant, permanent DELETE
  }
};
```

**Resolution path:**
1. Replace `window.confirm` with a styled confirmation modal that requires the user to type the project name to confirm deletion.
2. Implement a soft-delete pattern in the backend (`deleted_at` timestamp) with a 24-hour recovery window surfaced in the UI.

---

## Bug 06 — The "Agent Complete" → "Ready for Review" Transition Is Silent
**Severity:** P1 — Users do not know when to start their work
**HEART impact:** Task Success, Happiness

**What:**
When all phases complete and all validation runs finish, the application auto-switches `view` from `"setup"` to `"validate"` in `ProjectDetail.jsx` based on `lineItems.length > 0`. The user is deposited directly into the data table with no announcement that the agent has finished its work.

**Struggle:**
If a user has navigated away (to another project, another tab, or left for lunch), they return to a changed UI state with no explanation of what changed or what the key findings were. The cognitive burden of orienting themselves from scratch — "what did the AI find? Were there problems? Where do I start?" — is entirely on the user.

**Cause — `ProjectDetail.jsx`:**
```js
useEffect(() => {
  setView(lineItems.length > 0 ? "validate" : "setup");  // silent auto-switch
}, [lineItems.length]);
```

**Resolution path:**
1. Instead of a silent view switch, render an explicit "Processing Complete" summary card as the first screen after all phases are done.
2. The card should show: Files processed, items extracted, exceptions requiring review, suggested starting point.
3. A single CTA: "Begin Review" — which is the user's deliberate, informed entry into the validation workbench.

---

## Bug 07 — `SubcontractorTable.jsx` Uses Hardcoded `localhost` URL
**Severity:** P2 — Production deployment will silently fail
**HEART impact:** Adoption (will prevent deployment)

**What:**
API calls in `SubcontractorTable.jsx` use an absolute hardcoded URL:

**Cause — `SubcontractorTable.jsx` line 6:**
```js
const API = "http://localhost:3001/api";
```
Every other component uses `const API = "/api"` (relative URL). `SubcontractorTable` is the only outlier.

**Struggle:**
When this application is deployed to any server other than a developer's local machine, all sub-contractor data API calls will fail with a CORS or connection refused error. Sub-contractor data will not load in production.

**Resolution path:**
Change line 6 of `SubcontractorTable.jsx`:
```js
const API = "/api";  // relative — works in all environments
```

---

## Summary Table

| # | Bug | Severity | Impacted Component | HEART |
|---|---|---|---|---|
| 01 | PDF viewer does not highlight extracted cell | P0 | PDFViewer, DataTable | Task Success |
| 02 | Phase 2 can run before Phase 1 plan exists | P0 | JourneyPanel | Task Success |
| 03 | Extraction failures are invisible | P1 | JourneyPanel, ProjectDetail | Happiness |
| 04 | Developer logs shown to business users | P1 | OutputPanel, ProjectDetail | Happiness |
| 05 | Project deletion is instant and unrecoverable | P1 | ProjectDetail | Happiness |
| 06 | Agent-complete transition is silent | P1 | ProjectDetail | Task Success |
| 07 | Hardcoded localhost URL in SubcontractorTable | P2 | SubcontractorTable | Adoption |