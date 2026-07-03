# HANDOVER PROMPT — Sprint 3: UI Alignment to Lovable Reference

## YOUR MISSION
Make the frontend UI pixel-match the Lovable reference app. You are making PRESENTATION-ONLY changes — do NOT touch business logic, API endpoints, or data flow.

---

## CRITICAL CONTEXT — READ FIRST

### What Already Exists (Do NOT rebuild from scratch)
The following components are ALREADY built and ~85-95% matched. Make targeted fixes only:
- `AppShell.jsx` — Already has: w-14 nav rail, breadcrumb, status pill, bell icon, user avatar
- `ShellContext.jsx` — Already exists at `frontend/src/contexts/ShellContext.jsx`
- `GlobalDashboard.jsx` — Already has: 4 KPI cards, 7-column table, StatusPill component
- `IngestPage.jsx` — Already has: two-column layout (w-[380px] step list + activity feed), 9 steps, progress bars, polling
- `CompletePage.jsx` — Already has: green badge, 4-stat row, exception list
- `HitlPage.jsx` — Already has: View A/B structure

### Tech Stack (Do NOT change)
- React 18, JSX only (no TypeScript)
- React Router v6
- Tailwind CSS v4 with CSS variables defined in `frontend/src/index.css`
- shadcn/ui components at `frontend/src/components/ui/`
- API helper: `apiFetch` from `@/lib/api.js`
- Shell context: `useShell` from `@/contexts/ShellContext.jsx`
- Backend on port 3001 (do NOT modify unless instructed)

---

## REFERENCE MATERIALS

### Images (VIEW before each screen's work)
`C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\`

### TSX Source (READ for exact structure/logic)
`C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\`

### Plan Files (READ for pixel-level specs)
`C:\Users\KR614XU\Downloads\Ishaan\Docs\implementation-plan\sprint-3-ui-makeup\`

---

## EXECUTION ORDER

### Step 0 — Global Fixes (do these FIRST)

**File: `frontend/src/pages/package/PackageLayout.jsx`**

1. **Remove the StepRail progress bar** — Delete the `<div className="border-b border-border" style={{ height: 'var(--step-rail-height)' }}>` block and its `<StepRail>` child. The Lovable design shows NO horizontal pipeline progress bar. Remove the `StepRail` import too.

2. **Remove the "Contract · Period · ID" sub-header row** — Delete the `<div className="flex items-center gap-4 border-b border-border px-4 py-2">` block that shows contract name, period, and "ID: {packageId}". The breadcrumb in AppShell already shows this.

3. **Keep everything else** — The `dbError` warning, the `useEffect` that sets shell context, the `<Outlet context={{ steps, pkg }} />` must remain.

**File: `frontend/src/index.css`**

4. **Change primary button color to blue** — Find `--primary: oklch(0.205 0 0);` (line ~56) and change to `--primary: oklch(0.546 0.245 262.88);` (which is blue-600 / `#2563EB` in oklch). Also change `--sidebar-primary` (line ~76) to the same value. This makes ALL primary buttons blue.

**Verify:** Open `http://localhost:5173/packages/16/ingest` — no progress bar, no sub-header, blue buttons.

---

### Step 1 — Dashboard (`/`)

**File: `frontend/src/pages/GlobalDashboard.jsx`**
**Reference: `01_Dashboard.md`**

Current state is ~95%. Fix these gaps only:
- Padding: change content `p-6` to `p-8`
- Table row height: ensure `py-4` on `<td>` elements for ~56px rows
- SLA column: currently shows "—" — keep as-is (no SLA data in DB)
- Verify StatusPill renders colored dot + multi-line label for each status
- Verify table is clickable per row (no separate "Open →" button)

---

### Step 2 — Upload Wizard (`/packages/new`)

**File: `frontend/src/pages/PackageIntakePage.jsx`**
**Reference: `02_Upload_Wizard.md`**

This is the biggest rebuild (~30% match currently). Rebuild the UI as a SINGLE-PAGE form:
- Title: "Start New Monthly Package"
- Decorative 3-step stepper (Upload Files → Confirm → Process)
- Billing Period (month + year dropdowns) + Contract dropdown on one row
- 3 file upload cards (File 1 REQUIRED, File 2/3 OPTIONAL) with titles, subtitles, drop zones
- Attached state: green border, checkmark, filename, size, × remove button
- Footer: "Cancel" (left, navigates to `/`) + "Begin Processing →" (right, blue, disabled until File 1 attached)

**CRITICAL API SEQUENCE — DO NOT CHANGE:**
```
1. POST /api/packages { contractId, billingPeriodMonth, billingPeriodYear } → returns { id }
2. POST /api/packages/{id}/documents  (FormData with file1, file2, file3 fields)
3. Navigate to /packages/{id}/ingest
```
Both calls must remain in this exact order with these exact field names.

---

### Step 3 — IngestPage (`/packages/:id/ingest`)

**File: `frontend/src/pages/package/IngestPage.jsx`**
**Reference: `03_Ingest_Page.md`**

Current state is ~85%. Fix these gaps:
- Active step card: add `border-l-[3px] border-blue-500` left accent (not just border all around)
- Completed step sub-text: ensure clean labels like "3 files received · 292 pages", "Integrity confirmed", "{N} subs identified" — parse from `subProgressLabel` if available, otherwise derive from step data
- Activity feed timestamp: ensure `HH:MM:SS` format, `text-xs text-gray-400 tabular-nums`
- Activity feed icons: green ✓ for success, orange ● for warning, red ● for error, blue spinner for running
- G702 COVER PREVIEW card: show when EXTRACT_FILE1 is complete, with 2×3 grid of values from `gcHeader`

---

### Step 4 — Agent Plan (`/packages/:id/plan`)

**File: `frontend/src/pages/package/PlanPage.jsx`**
**Reference: `04_Agent_Plan.md`**

Rebuild table to 4 columns: CODE | NAME | TRADE | FILE 1 VALUE
- CODE: derive as first 3 uppercase letters of sub name (e.g., "ABC" from "ABC Structural Steel")
- TRADE: if `agentPlanItem` has no `trade` field, show "—" placeholder
- Remove visible checkboxes (but keep all items selected by default in confirm payload)
- Add "+ Add sub-contractor" clickable row at bottom
- Footer: "← Go back" (left) + "Confirm & Begin File 2 Extraction →" (right, blue)
- Status pill: "Plan Review · Awaiting confirmation" (orange)

**IMPORTANT:** Before removing checkboxes, verify what the confirm API endpoint expects. If it needs a list of item IDs, send ALL items by default. Do not break the confirm payload.

---

### Step 5 — CompletePage (`/packages/:id/complete`)

**File: `frontend/src/pages/package/CompletePage.jsx`**
**Reference: `05_Complete_Page.md`**

Current state is ~92%. Fix these gaps:
- "EXCEPTIONS BY TYPE" section: fetch from `GET /api/exceptions/{packageId}` and group CLIENT-SIDE by `exceptionTypeCode`. There is NO `/exception-groups` endpoint. Compute count and dollarAtRisk per group.
- Dot colors: MATH_ERROR → red, CROSS_FILE_MISMATCH → orange, others → yellow
- Status pill: "Processing Complete" (green)

---

### Step 6 — ExceptionsPage (`/packages/:id/exceptions`)

**File: `frontend/src/pages/package/ExceptionsPage.jsx`**
**Reference: `06_Exceptions_Page.md`**

Current state is ~80%. Key fixes:
- Add "Mark Ready for Approval →" blue button top-right (navigates to `/packages/:id/hitl`)
- Left panel groups: add colored severity dots below each group's count/dollar line
- Center table columns: ☐ | SUB (3-letter code, mono) | DESCRIPTION | FILE 1 | FILE 2 | VARIANCE (red)
- Add "Select all" + "Bulk accept" text links above table
- Right panel: add File 1 / File 2 / File 3 tab bar above evidence viewer
- Remove any visible "Accept"/"Override"/"Reject" action button column (actions via checkbox bulk only)

**BBOX NULL HANDLING:** The `evidenceBboxX/Y/Width/Height` fields are NULL for all current exceptions. If `evidenceBboxX` is null, render the PDF page WITHOUT any orange overlay. Do NOT crash or render empty boxes. Only show the orange highlight rectangle when valid coordinates exist.

---

### Step 7 — HITLPage (`/packages/:id/hitl`)

**File: `frontend/src/pages/package/HitlPage.jsx`**
**Reference: `07_HITL_Page.md`**

Current state is ~93%. Fix these gaps:

**View A (Confirm & Route):**
- Ensure button is blue bg-blue-600 (not dark/black from old primary)
- Checklist items show dynamic counts from package data
- "ROUTE TO" section: hardcode "Jamie Reyes" / "Finance Approver" with "JR" avatar

**View B (Awaiting Formal Validation):**
- 3rd stat: show PAYMENT DUE as a DATE, not a dollar amount
  ```js
  const submitted = pkg?.submittedAt ? new Date(pkg.submittedAt) : new Date();
  const paymentDue = new Date(submitted);
  paymentDue.setDate(paymentDue.getDate() + 10);
  // Format: "Jul 12, 2026"
  ```
  If `submittedAt` is null and not submitted, show "—"
- Blue info box with the "Step 16 formal-validation" text
- "Return to Queue →" button navigates to `/`

---

## AFTER EACH STEP

1. Open `http://localhost:5173` in a browser (ensure backend is running on port 3001, frontend on 5173)
2. Navigate to the relevant page
3. Take a screenshot
4. Compare to the reference image in `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\`
5. Fix any remaining visual gaps
6. Report: "Step N complete — {what changed}"

## DO NOT

- Add new npm packages
- Create TypeScript files
- Modify Prisma schema
- Change API routes or their responses
- Break existing navigation or form submissions
- Add error handling that changes UX flow
- Create markdown documentation files
