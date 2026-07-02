# Invoice Validation & Review Platform
## Sprint 3: Validation Engine & HITL Screens

**Duration:** Weeks 5–6
**Agents:** Agent 3 (Frontend Architecture) continues; Agent 5 (QA Framework) continues
**Prerequisite:** Sprint 2 complete (authenticated routing, AppShell, GlobalDashboard working)
**Goal:** All 9 screens of the package processing journey are operational, including both HITL gates, the Exception Navigator, the Evidence Viewer, and the final approval flow.

---

## Sprint 3 Overview

Sprint 3 completes the core HITL workbench. After Sprint 3, a real invoice reviewer can upload a pay application package, process it through all 9 pipeline steps, resolve exceptions, confirm the agent plan, and approve or reject the package — entirely within the browser.

The screens built in this sprint follow the `packages/:packageId/*` route tree defined in Sprint 2.

---

## S3-01 — Build `PackageLayout` and `StepRail` Integration

**Effort:** 3 hours
**Route:** `/packages/:packageId` (wraps all package sub-routes)

**Purpose:** `PackageLayout` is the shared frame for all 7 package-specific screens (Ingest through HITL). It provides:
1. The `StepRail` at the top — showing all 9 steps with their live status
2. A package context header — contract name, billing period, package ID
3. An `<Outlet />` below the StepRail for the active screen

**StepRail polling:**
```javascript
// src/hooks/usePipelineSteps.js
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api.js';

export function usePipelineSteps(packageId) {
  const [steps, setSteps] = useState([]);

  useEffect(() => {
    const poll = () =>
      apiFetch(`/packages/${packageId}/pipeline-steps`).then(setSteps);
    
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [packageId]);

  return steps;
}
```

**Step click navigation:** Clicking a completed or active step in the StepRail navigates to its corresponding route:
```javascript
const stepRoutes = {
  FILE_UPLOAD:        'ingest',
  CLASSIFY:           'ingest',
  EXTRACT_FILE1:      'file1',
  AGENT_PLAN:         'plan',
  EXTRACT_FILE2:      'file2',
  EXTRACT_FILE3:      'file2',
  RECONCILE:          'complete',
  EXCEPTION_ASSEMBLY: 'complete',
  READY:              'hitl'
};
```

**Acceptance criteria:**
- StepRail updates automatically every 3 seconds from live API
- Step indicators show correct status: pending (grey), running (blue pulse), complete (green), paused (amber), error (red)
- Clicking a step navigates to the correct sub-route
- Package context header shows contract name and billing period in `MMM YYYY` format

---

## S3-02 — Build `IngestPage` (Steps 1 & 2)

**Effort:** 4 hours
**Route:** `/packages/:packageId/ingest`

**Purpose:** Shows the progress of file upload and preliminary document classification (pipeline steps 1 and 2). Includes the confirmation card at the end of step 2.

**Layout:**
- Top: StepRail (shared, from PackageLayout)
- Left pane: Activity Feed — streams messages from `GET /api/packages/:id/activity?since=` polled every 2 seconds
- Right pane: Classification summary card — once step 2 is complete, shows detected document structure

**Activity Feed display:** Messages rendered in order with severity icon (info/warning/error) and timestamp. New messages appear at the bottom. Auto-scroll to bottom on new messages.

**Classification confirmation card (appears when step 2 status = `paused`):**
```
┌────────────────────────────────────┐
│ Preliminary Check Complete         │
│                                    │
│ File 1: 47 pages — GC Pay App ✓   │
│ File 2: 183 pages — Sub Package ✓  │
│ File 3: 12 pages — Support Docs ✓  │
│                                    │
│  [Confirm & Continue]              │
└────────────────────────────────────┘
```

**"Confirm & Continue" button:**
- Calls `POST /api/packages/:id/pipeline/confirm` with `{ stepName: 'CLASSIFY' }`
- On success: navigates to `/packages/:id/file1`
- Button is disabled while the API call is pending
- Button label changes to "Confirmed ✓" briefly before navigation

**Acceptance criteria:**
- Activity feed polls every 2 seconds and displays live messages
- Confirmation card only appears when step 2 status is `paused`
- "Confirm & Continue" triggers the pipeline and navigates to File1Page
- Page does not crash if steps 1 and 2 are already complete (handles late arrival)

---

## S3-03 — Build `File1Page` (Step 3: GC G702 / G703 Extraction)

**Effort:** 6 hours
**Route:** `/packages/:packageId/file1`

**Purpose:** Displays the extracted GC pay application data (G702 header and G703 SOV lines) for reviewer inspection. The reviewer can inline-edit individual cell values before moving forward.

**Layout (3-pane using `SplitPane` component):**
```
┌──────────────┬─────────────────────┬──────────────────┐
│  G702 Cover  │   G703 SOV Lines    │  Evidence Viewer  │
│  (top-left)  │   DataTable         │  (PDF canvas)     │
│              │                     │                   │
│  Field: val  │  # | Description |  │  [PDF page]      │
│  Field: val  │  Comp | Retainage  │                   │
│              │  [Validation badge] │  Page: 12 of 47  │
└──────────────┴─────────────────────┴──────────────────┘
```

**Left pane — G702 Cover Page:** Displays `gc_pay_application_headers` fields in a read-only card format. Fields: contract name, application number, period to, work completed to date, retainage %, current payment due. Each field shows a `ValidationBadge` based on its extraction confidence.

**Centre pane — G703 SOV Lines (DataTable):**
- Data source: `GET /api/packages/:id/gc-sov-lines`
- Columns: Line No, Description, Scheduled Value, Previous Completed, Work This Period, Materials Stored, Total Completed %, Retainage, Balance to Finish
- Inline editing: clicking a cell opens an input field (existing `DataTable` pattern — keep `startEdit`/`commitEdit`/`cancelEdit`)
- On cell commit: `PATCH /api/gc-sov-lines/:lineId` with changed value + `INSERT data_change_logs` (backend handles the audit)
- `ValidationBadge` in each row based on `validation_status`
- Sub-contractor filter toggle: "Show sub-contractor lines only" — filters rows where `work_completed_this != 0`
- The sub-contractor filter toggle is **always visible and defaulted to OFF** (show all lines). This is a toggle, not a permanent filter.

**Right pane — Evidence Viewer:**
- Uses `EvidenceViewer` component (built in S3-09)
- Initially shows the page corresponding to the first SOV line (`source_page` from `raw_extracted_fields`)
- Clicking a row in the DataTable navigates the Evidence Viewer to that row's source page

**Acceptance criteria:**
- G702 fields load from live API
- G703 DataTable shows all lines with validation badges
- Inline editing calls the API and updates the row without a full page reload
- Clicking a SOV row scrolls the Evidence Viewer to the corresponding PDF page
- Sub-contractor filter toggle functions correctly

---

## S3-04 — Build `PlanPage` — HITL Gate 1 (Step 4)

**Effort:** 5 hours
**Route:** `/packages/:packageId/plan`

**Purpose:** This is HITL Gate 1. The AI agent has identified the sub-contractors to process based on the G703 extraction. The reviewer reviews the plan, can add/remove sub-contractors, and confirms the plan to proceed with File 2 extraction. **This gate cannot be bypassed.**

**Data source:** `GET /api/packages/:id/agent-plan` — returns `agent_plans` + `agent_plan_items` for this package.

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Agent Plan — Sub-Contractor Review                   │
│  "The following sub-contractors were identified       │
│   from the GC G703. Review and confirm."              │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  Sub-Contractor       Billed This Period      │    │
│  │  ─────────────────    ─────────────────       │    │
│  │  [x] Acme Corp        $124,500.00             │    │
│  │  [x] BuildRight LLC   $87,250.00              │    │
│  │  [ ] Delta Subs       $0.00  (zero — review)  │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  Total to process: 2 sub-contractors ($211,750.00)    │
│                                                       │
│  [Confirm Plan & Begin Processing]                    │
└──────────────────────────────────────────────────────┘
```

**Reviewer actions:**
- Check/uncheck individual sub-contractors (unchecked = exclude from File 2 processing)
- The running total of sub-contractors and amounts updates as checkboxes change
- Sub-contractors with `billed_amount = 0` are shown but unchecked by default

**Confirmation:**
- "Confirm Plan & Begin Processing" button calls `POST /api/packages/:id/pipeline/confirm` with `{ stepName: 'AGENT_PLAN', confirmedItems: [...ids] }`
- Backend: updates `agent_plan_items.is_confirmed`, triggers File 2 extraction, writes `audit_events(AGENT_PLAN_CONFIRMED)`
- On success: navigates to `/packages/:id/file2`
- Button disabled during API call
- Cannot navigate away from this page by clicking the StepRail until the plan is confirmed

**HITL Gate enforcement:**
- The "File 2" step in the StepRail is greyed out and non-clickable until `AGENT_PLAN` step status = `confirmed`
- No URL manipulation bypasses this — the `File2Page` checks pipeline step status on load and redirects back to `PlanPage` if AGENT_PLAN is not confirmed

**Acceptance criteria:**
- Agent plan loads with real sub-contractor data from the G703 extraction
- Checkboxes update the running total correctly
- Confirmation triggers File 2 extraction and navigates forward
- File2Page cannot be accessed (via URL or StepRail) before Gate 1 is confirmed
- Confirmed plan is immutable — no editing after confirmation (the plan is stored in `agent_plans` which is append-only)

---

## S3-05 — Build `File2Page` (Steps 5 & 6: Sub-Contractor Extraction)

**Effort:** 5 hours
**Route:** `/packages/:packageId/file2`

**Purpose:** Shows the progress of File 2 (sub-contractor packages) and File 3 (supporting documents) extraction. When complete, displays extracted sub-contractor SOV data for review.

**Top section — Live Processing Progress:**
- Activity Feed (same component as IngestPage) — shows File 2 and File 3 extraction messages
- Progress indicators per confirmed sub-contractor: "Processing Acme Corp... ✓ Done. $124,500.00 extracted."
- Shows step 5 and step 6 status from StepRail

**Bottom section (appears when steps 5 and 6 are complete):**
Sub-contractor table — same layout pattern as `DataTable` in File1Page, but showing `sub_pay_application_sov_lines`:
- Columns: Sub-Contractor, Application No, Work This Period, Retainage %, Net This Period, Validation Badge
- Expandable rows: clicking a sub-contractor expands to show their individual SOV line items
- **Sub-contractor filter is always active here** — only rows where `work_completed_this != 0` are shown (this is not a toggle, it is a permanent filter on this screen)

**Evidence Viewer (right pane):**
- Shows File 2 PDF (the sub-contractor package)
- Navigates to the selected sub-contractor's page range
- Uses `EvidenceViewer` component

**Acceptance criteria:**
- Activity Feed shows File 2 and File 3 processing messages in real time
- Sub-contractor table appears only after steps 5 and 6 are both complete
- Sub-contractor filter (`work_completed_this != 0`) is always active — never shows zero-amount rows
- Expandable rows work for individual SOV line items

---

## S3-06 — Build `CompletePage` (Steps 7 & 8: Reconciliation)

**Effort:** 3 hours
**Route:** `/packages/:packageId/complete`

**Purpose:** Steps 7 and 8 (Reconciliation and Exception Assembly) are fully automated. This screen shows progress and the resulting summary — how many exceptions were identified, totals by category, and a CTA to begin the review.

**Layout:**
- Activity Feed: reconciliation messages (cross-file checks, duplicate detection, contract rate checks)
- Summary card (appears when step 8 is complete):
  ```
  ┌────────────────────────────────────┐
  │ Validation Complete                │
  │                                    │
  │ 23 exceptions found                │
  │ Total amount at risk: $48,250.00   │
  │                                    │
  │ By category:                       │
  │  File 1 vs File 2 Variance:   12   │
  │  Math Errors:                  4   │
  │  Low Confidence OCR:           5   │
  │  Contract Rate Mismatch:       2   │
  │                                    │
  │ [Begin Exception Review →]         │
  └────────────────────────────────────┘
  ```
- "Begin Exception Review" button navigates to `/packages/:id/exceptions`
- If there are zero exceptions, the CTA changes to "No exceptions found — Proceed to Approval →" and navigates directly to `/packages/:id/hitl`

**Acceptance criteria:**
- Exception summary card appears only when steps 7 and 8 are both complete
- Exception counts and amounts come from live API (`GET /api/packages/:id/exceptions?summary=true`)
- Zero-exception path navigates directly to HITLPage

---

## S3-07 — Build `ExceptionsPage` — Exception Navigator

**Effort:** 8 hours
**Route:** `/packages/:packageId/exceptions`

**Purpose:** The primary HITL workbench for resolving flagged exceptions before submission for approval. This is the most complex screen in the application.

**Layout (3-pane):**
```
┌───────────────┬────────────────────────┬──────────────────┐
│  Exception    │  Exception Detail Grid  │  Evidence Viewer  │
│  Navigator    │                         │                   │
│  (left)       │  [active exception rows]│  [PDF page]      │
│               │                         │                   │
│  GROUP 1      │  Line | Desc | GC Amt  │                   │
│  F1vF2 (12)  │  | Sub Amt | Variance │                   │
│               │                         │  Page: 12        │
│  GROUP 2      │  [Accept] [Override]    │                   │
│  Math (4)    │                         │  ↑ source page   │
│               │                         │  from raw field  │
│  GROUP 3      │                         │                   │
│  OCR (5)     │                         │                   │
└───────────────┴────────────────────────┴──────────────────┘
```

**Left pane — Exception Group Navigator:**
- One card per exception group (from `exception_groups` table)
- Each card shows: exception type display name, count, total amount at risk, progress (N resolved / M total)
- Active group highlighted
- Clicking a group loads that group's exceptions in the centre pane
- Overall progress bar at the top: "14 of 23 exceptions resolved"

**Centre pane — Exception Detail Grid:**
- Data source: `GET /api/packages/:id/exceptions?groupId=X`
- Columns depend on exception type:
  - For `FILE1_VS_FILE2`: GC Amount, Sub Amount, Variance, Variance %
  - For `MATH_ERROR`: Expected Total, Actual Total, Difference
  - For `LOW_CONFIDENCE_OCR`: Field, Raw Value, Confidence %
  - For `CONTRACT_RATE`: Billed Rate, Contract Rate, Difference per Unit
- Each row has a `SeverityBadge` (HIGH / MEDIUM / LOW)
- Each row has status: OPEN (amber), RESOLVED (green) — from `exception_resolutions`
- Actions per row: `[Accept]` and `[Override]` buttons

**Accept action:**
- Calls `POST /api/exceptions/:id/resolve` with `{ decision: 'ACCEPTED', comment: '' }`
- Row updates to RESOLVED with green badge
- No dialog required for Accept — inline action
- Inserts `review_action_logs` row (backend handles)

**Override action:**
- Opens a shadcn/ui Dialog:
  ```
  ┌────────────────────────────────────┐
  │ Override Value                     │
  │                                    │
  │ Current value: $124,500.00         │
  │ New value: [____________]          │
  │ Reason (required): [____________]  │
  │                                    │
  │ [Cancel]  [Confirm Override]       │
  └────────────────────────────────────┘
  ```
- On confirm: calls `POST /api/exceptions/:id/resolve` with `{ decision: 'OVERRIDDEN', comment, overrideValue }`
- Backend inserts `data_change_logs` with before/after values
- Row updates to RESOLVED with override indicator

**Right pane — Evidence Viewer:**
- Shows the PDF page from `raw_extracted_fields.source_page` for the selected exception
- Clicking any exception row in the centre pane loads the corresponding page

**Submit for Approval button:**
- Appears in the page footer when ALL exceptions are resolved (OPEN count = 0)
- Calls `POST /api/packages/:id/pipeline/confirm` with `{ stepName: 'READY' }`
- Then navigates to `/packages/:id/hitl`
- Button is disabled and shows "N exceptions remaining" when exceptions are unresolved

**Acceptance criteria:**
- Exception group navigator loads all groups with counts and amounts from live API
- Selecting a group loads the correct exception rows
- Accept action resolves exception inline without page reload
- Override action requires a reason; inserts `data_change_logs` (verified via API)
- "Submit for Approval" only appears when all exceptions are resolved
- Evidence Viewer navigates to the source page of the selected exception
- Sub-contractor filter always active on any SOV line data shown

---

## S3-08 — Build `HitlPage` — HITL Gate 2 (Final Approval)

**Effort:** 5 hours
**Route:** `/packages/:packageId/hitl`

**Purpose:** HITL Gate 2. The Finance Approver reviews the final package summary and either approves or rejects. **This is the final gate — no AI re-validation occurs after this point. No exceptions can be re-opened after approval.**

**Separation of duties enforcement:** The Finance Approver must be a different user from the Invoice Reviewer who processed the package. If the current user is the same as `package.reviewed_by`, the approve/reject buttons are disabled and a message is shown: "Separation of duties: you cannot approve a package you reviewed."

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Package Summary — Ready for Approval                 │
│                                                       │
│  Contract: Highway Bridge Renovation                  │
│  Billing Period: June 2026                            │
│  GC Pay Application No: 12                           │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  Financial Summary                           │    │
│  │  Original Contract Sum:       $4,200,000     │    │
│  │  Work Completed to Date:      $2,340,000     │    │
│  │  Less Previous Certificates: $2,100,000     │    │
│  │  Current Payment Due:           $240,000     │    │
│  │  Sub-Contractor Total:          $211,750     │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  Exceptions Resolved: 23 of 23                        │
│  Overrides Applied: 3 (see audit trail)               │
│  Reviewed by: Jane Smith at 14:32 UTC                 │
│                                                       │
│  Comments: [_________________________________]        │
│                                                       │
│  [Reject]                    [Approve Package]        │
└──────────────────────────────────────────────────────┘
```

**Approve action:**
- Calls `PATCH /api/packages/:id` with `{ packageStatus: 'APPROVED', comment }`
- Backend enforces: `req.user.id ≠ package.reviewed_by` — returns HTTP 403 if violated
- Backend inserts `audit_events(APPROVED)` with approver display name, timestamp, comment
- Backend creates notification for the `invoice_reviewer` who processed the package
- On success: navigates to GlobalDashboard; toast message "Package approved successfully"

**Reject action:**
- Comment is required (validation on client side — "Please provide a reason for rejection")
- Calls `PATCH /api/packages/:id` with `{ packageStatus: 'REJECTED', comment }`
- Backend inserts `audit_events(REJECTED)`
- Backend creates notification for the `invoice_reviewer`
- On success: navigates to GlobalDashboard; toast message "Package rejected"

**Post-approval state:**
- Once `package_status` is `APPROVED` or `REJECTED`, this page becomes read-only
- The summary is still visible but the approve/reject buttons are replaced with the outcome badge and approver name
- No exceptions can be reopened — all action buttons in ExceptionsPage are disabled for approved packages

**Acceptance criteria:**
- Financial summary loads from `gc_pay_application_headers` and `package` via live API
- Separation of duties enforced: same user cannot approve their own review (client AND server-side)
- Approval requires a comment (or at least makes it optional but clearly labelled)
- Rejection requires a comment (enforced client-side with error message)
- Approved/rejected packages show read-only view
- Toast notification confirms the action
- Navigation returns to GlobalDashboard after action

---

## S3-09 — Build `EvidenceViewer` Component

**Effort:** 4 hours

**Purpose:** Replaces the existing `PDFViewer.jsx` (`<iframe>` approach). Renders individual PDF pages as canvas elements using `react-pdf`.

**Installation:**
```bash
npm install react-pdf
```

**Component API:**
```javascript
// src/components/EvidenceViewer.jsx
// Props:
//   pdfUrl: string — the Azure Blob Storage URL of the PDF
//   pageNumber: number — the page to display (from raw_extracted_fields.source_page)
//   onPageChange: function — called when user navigates pages
```

**Features:**
- Renders the specified PDF page as a canvas (not an iframe)
- Previous/Next page navigation controls below the canvas
- Current page / total pages indicator ("Page 12 of 47")
- Loading skeleton while the page renders
- Zoom: fit-to-width (default)
- The PDF URL requires authentication — `react-pdf` is given the blob URL directly (Blob Storage container is private; the backend proxies the PDF via `/api/packages/:id/pdf/pages` which already validates the session token)

**Integration with the 3-pane layout:**
- `SplitPane` (existing, keep) provides the resizable split between DataTable/centre pane and the Evidence Viewer
- When a SOV row is clicked, the parent page calls `setActivePage(row.sourcePage)` which flows down as the `pageNumber` prop

**Acceptance criteria:**
- PDF renders as a canvas (not inside an iframe)
- Page navigation works
- Correct page loads when triggered by row selection in the DataTable
- Loading skeleton shown during page load
- No PDF URL is logged (the token-bearing URL stays in memory only)

---

## S3-10 — Build `ContractListPage`

**Effort:** 3 hours
**Route:** `/contracts`

**Purpose:** List view of all contracts for the current client. Allows system_admin to create new contracts.

**Layout:**
- Table: Contract No, Contract Name, Contractor, Owner, Original Value, Active Packages Count, Status
- "New Contract" button — visible to `system_admin` only
- "New Contract" opens a shadcn/ui Dialog with the contract creation form
- Clicking a contract row: expands inline to show the 3 most recent packages for that contract, with a "View all packages →" link that filters the GlobalDashboard

**Acceptance criteria:**
- Contracts load from `GET /api/contracts`
- "New Contract" dialog only visible to `system_admin` role
- Contract creation form calls `POST /api/contracts` and refreshes the list

---

## S3-11 — Wire Audit Trail (No New UI — Backend Verification)

**Effort:** 2 hours

**Purpose:** Verify that the complete audit chain from Document 06 is operational end-to-end.

**For one complete test package, verify the following chain exists in Azure SQL:**

1. `gc_pay_application_sov_lines` has a value
2. `raw_extracted_fields` has the corresponding `field_name`, `raw_value`, `extraction_confidence`, and `bbox_*` columns populated
3. `api_integration_logs` has an entry for the Azure Document Intelligence call that produced step 2
4. If the value was overridden: `data_change_logs` has the `old_value` and `new_value`
5. If an exception was resolved: `exception_resolutions` has the `decision` and `comment`
6. `audit_events` has the `APPROVED` event with approver identity
7. `review_action_logs` has all reviewer UI actions on this item

**This is a data verification task, not a UI task.** Run SQL queries directly against Azure SQL to confirm all 7 chain links are present.

**Acceptance criteria:**
- All 7 links in the audit chain exist for a real processed package
- No link in the chain is missing (would indicate a route handler not inserting the required row)

---

## S3-12 — QA: Full E2E Test Suite

**Effort:** 4 hours

**Playwright tests to write for Sprint 3:**

```javascript
// Full happy path
test('complete package processing journey', async ({ page }) => {
  // 1. Login as invoice_reviewer
  // 2. Navigate to GlobalDashboard — package queue visible
  // 3. Click "New Package" — intake wizard
  // 4. Select contract, billing period, upload test PDFs
  // 5. Confirm → navigate to IngestPage
  // 6. Confirm classification → navigate to File1Page
  // 7. Verify G703 lines visible
  // 8. Click SOV row → Evidence Viewer navigates to correct page
  // 9. Navigate to PlanPage → confirm agent plan
  // 10. Navigate to File2Page → wait for sub extraction complete
  // 11. Navigate to CompletePage → verify exception summary
  // 12. Navigate to ExceptionsPage → resolve all exceptions
  // 13. Click "Submit for Approval"
  // 14. Logout as invoice_reviewer
  // 15. Login as finance_approver (different user)
  // 16. Navigate to HITLPage for the package
  // 17. Approve with comment
  // 18. Verify package shows APPROVED on GlobalDashboard
});

// Separation of duties
test('reviewer cannot approve their own package', async ({ page }) => {
  // Login as invoice_reviewer
  // Navigate to HITLPage for their own package
  // Verify approve button is disabled
  // Verify "Separation of duties" message is visible
});

// HITL Gate 1 bypass attempt
test('File2Page cannot be accessed before gate 1 confirmed', async ({ page }) => {
  // Login as invoice_reviewer
  // Navigate directly to /packages/:id/file2 before plan is confirmed
  // Verify redirect to /packages/:id/plan
});
```

**Acceptance criteria:**
- All 3 E2E tests pass against a real test Azure SQL instance
- No test uses mock data — all data from the API

---

## Sprint 3 Completion Criteria

- [ ] **S3-01** — `PackageLayout` + `StepRail` with 3-second polling and step navigation
- [ ] **S3-02** — `IngestPage` with Activity Feed + classification confirmation card
- [ ] **S3-03** — `File1Page` 3-pane: G702 cover + G703 DataTable (inline edit) + Evidence Viewer
- [ ] **S3-04** — `PlanPage` HITL Gate 1: agent plan review + confirmation + HITL enforcement
- [ ] **S3-05** — `File2Page`: live extraction progress + sub-contractor SOV table (filter always active)
- [ ] **S3-06** — `CompletePage`: reconciliation progress + exception summary + routing logic
- [ ] **S3-07** — `ExceptionsPage`: exception navigator + centre grid + accept/override + Evidence Viewer + "Submit for Approval" gate
- [ ] **S3-08** — `HitlPage`: financial summary + approve/reject + separation of duties enforcement
- [ ] **S3-09** — `EvidenceViewer`: react-pdf canvas rendering, row-triggered navigation
- [ ] **S3-10** — `ContractListPage`: table + admin-only new contract dialog
- [ ] **S3-11** — Audit chain verified end-to-end in Azure SQL (7 links confirmed)
- [ ] **S3-12** — 3 Playwright E2E tests passing (happy path, separation of duties, HITL gate bypass)

---

## Full Journey Verification

After Sprint 3 completes, the following user journey must be executable in a single browser session with no errors:

1. Invoice Reviewer logs in
2. Creates a new package (selects contract, billing period, uploads 3 PDFs)
3. Confirms classification
4. Reviews G703 SOV lines in File1Page, inline-edits one value
5. Reviews and confirms the agent plan
6. Views sub-contractor extraction progress
7. Navigates to CompleteScreen, reviews exception summary
8. Resolves all exceptions (some via Accept, some via Override with reason)
9. Submits for approval
10. Finance Approver (different user) logs in, navigates to the package, reads financial summary, approves with comment
11. Both users see the package as APPROVED on the GlobalDashboard
12. SQL query confirms the full 7-step audit chain for the overridden value
