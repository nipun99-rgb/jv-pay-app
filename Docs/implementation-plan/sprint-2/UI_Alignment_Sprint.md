# Sprint: UI Alignment to Lovable Reference

## Pre-Work: Before Writing Any Code

1. **Review all reference images** in `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\` — open every image and study it before touching any file.
2. **Read all reference TSX files** in `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\` — these are the Lovable source that define the exact component structure and logic you must adapt.
3. **Read every target JSX file** listed below before editing it.
4. After implementing **each track**, open `http://localhost:5173` in the browser, navigate to the relevant page, take a screenshot, and compare it side-by-side against the reference image named for that track. Do not move to the next track until the current one matches visually.

## Tech Stack Constraints (Do Not Change)

- **Frontend:** React 18 with JSX (`.jsx` files only — NOT `.tsx`)
- **Router:** React Router v6 (`useNavigate`, `useParams`, `NavLink`, `Outlet` from `react-router-dom`)
- **Styling:** Tailwind CSS v4 + shadcn/ui — use existing CSS variables (`--color-brand-primary`, `--color-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-error`, `--color-warning`, `--color-success`, `--color-border`)
- **API calls:** `apiFetch` from `@/lib/api.js`
- **Auth:** `useAuth` from `@/hooks/useAuth.jsx`
- **Backend:** Already running on port 3001. Do not modify backend unless a specific track instructs it.
- **No TypeScript.** No new npm packages unless explicitly stated.

---

## Track 1 — AppShell Rebuild

**Files to modify:**
- `c:\Users\KR614XU\Downloads\Ishaan\project-manager\frontend\src\components\AppShell.jsx`
- `c:\Users\KR614XU\Downloads\Ishaan\project-manager\frontend\src\pages\package\PackageLayout.jsx`

**Reference image:** `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\` — look at any screenshot showing the header bar (the one with `IV InvoiceReview / Contracts / Northwest Terminal Expansion / Jun 2026` breadcrumb and a centered status pill).

**Reference TSX:** `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\AppShell.tsx`

### What to build

**Layout change:** Replace the current wide sidebar (`w-[var(--sidebar-width)]`) with a narrow `w-14` icon-rail.

**New AppShell accepts these props:**
```
statusLabel  (string | undefined)
statusTone   ('neutral' | 'info' | 'warn' | 'success')
contractName (string | undefined)
period       (string | undefined)
```

**Global header (h-12, full width, border-bottom):**
- Left: Blue `IV` badge (6×6, rounded, bg-brand-primary, white bold text "IV") + `InvoiceReview` text (font-semibold text-sm)
- Then breadcrumb if `contractName` is set: `/ Contracts / {contractName}` and if `period` also set append `/ {period}` — each segment separated by a `/` in muted color. Use `text-xs text-muted`.
- Center: if `statusLabel` is set, show a pill: `rounded-full border px-3 py-1 text-xs font-medium` with a colored dot (`h-1.5 w-1.5 rounded-full bg-current`) before the text. Tone colors:
  - `neutral` → `bg-muted text-muted-foreground border-border`
  - `info` → `bg-blue-50 text-blue-600 border-blue-200`
  - `warn` → `bg-orange-50 text-orange-600 border-orange-200`
  - `success` → `bg-green-50 text-green-700 border-green-200`
- Right: Bell icon (size-4, muted, with unread badge if count > 0) + user avatar circle (h-7 w-7 rounded-full bg-muted, initials from `user.displayName`) + user display name in `text-xs text-muted-foreground` (hidden on small screens)

**Remove:** The current logout button from the header. Remove the bottom user card from the sidebar. Add a logout icon button at the bottom of the nav rail instead (use `LogOut` icon from lucide-react, same styling as nav items but placed at bottom with `mt-auto`).

**Nav rail (w-14, border-right, flex-col, items-center, py-3, gap-1):**
```
Packages  → icon: FileStack  → route: /
Contracts → icon: FolderKanban → route: /contracts
Reports   → icon: Layers     → route: /reports
Settings  → icon: Settings   → route: /settings (admin only)
```
Each item: `w-11 py-2 rounded-md flex flex-col items-center gap-0.5 text-[10px]`
Active state: `bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]`
Inactive: `text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]`

**PackageLayout changes:** Pass `contractName`, `period`, and `statusLabel`/`statusTone` up to AppShell. Since AppShell renders `<Outlet />`, the PackageLayout is the Outlet content — it cannot pass props to AppShell directly. Instead, create a React Context:
1. Create `c:\Users\KR614XU\Downloads\Ishaan\project-manager\frontend\src\contexts\ShellContext.jsx` that exports `ShellContext` and `useShell`.
2. AppShell reads from `ShellContext` to get `contractName`, `period`, `statusLabel`, `statusTone`.
3. PackageLayout calls `useShell()` and sets those values based on the current package data.
4. GlobalDashboard and other top-level pages can also call `useShell()` to clear the context (set all to null/undefined).

**Verification:** Navigate to `http://localhost:5173` (dashboard — no breadcrumb, no pill), then to `http://localhost:5173/packages/16/ingest` (breadcrumb shows contract name + period, status pill shows current step). Take screenshot and compare to reference image.

---

## Track 2 — Global Dashboard

**File to modify:**
- `c:\Users\KR614XU\Downloads\Ishaan\project-manager\frontend\src\pages\GlobalDashboard.jsx`

**Reference image:** `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\` — the "Package Queue" screenshot showing 4 KPI cards and the data table.

**Reference TSX:** No direct equivalent — build from image.

### What to build

**Page title area:**
- `h1` "Package Queue" (text-2xl font-semibold)
- Subtitle: `p` "Monthly invoice packages across all contracts." (text-sm text-muted-foreground)
- `+ New Package` button top-right (blue, bg-primary text-primary-foreground)

**4 KPI cards** (grid-cols-4, gap-4, mb-6) — computed client-side from the `packages` array after fetch:

| Card | Icon | Value | Color |
|---|---|---|---|
| Open packages | `FileStack` | count of packages where status ≠ APPROVED ≠ REJECTED | black |
| Exceptions to resolve | `AlertTriangle` | sum of `exceptionsCount` across all packages | orange (text-orange-500) |
| $ at risk | `TrendingUp` | sum of `dollarAtRisk` across all packages | red (text-red-500) |
| SLA breaches | `Clock` | hardcode 0 for now (no SLA field in DB yet) | black |

Each card: `rounded-lg border border-border p-4 bg-card`. Label row: icon (size-4, muted) + label text (text-sm text-muted-foreground). Value: `text-2xl font-semibold tabular-nums mt-1` with the color above.

**Table columns (exact order):** CONTRACT | PERIOD | STATUS | EXTRACTED | EXCEPTIONS | $ AT RISK | SLA

- **CONTRACT:** `pkg.contract?.contractName` — truncate with ellipsis, max 20ch, bold
- **PERIOD:** `pkg.billingPeriodLabel` or derived month/year string
- **STATUS:** Rich status badge (see below)
- **EXTRACTED:** `pkg.totalItemsExtracted ?? '—'` — right-aligned
- **EXCEPTIONS:** `pkg.exceptionsCount` — if > 0 use `text-orange-500 font-semibold`, if 0 use `'—'`, right-aligned
- **$ AT RISK:** `pkg.dollarAtRisk` — if > 0 format as `$X,XXX` in `text-red-500 font-semibold`, if null use `'—'`, right-aligned
- **SLA:** hardcode `'—'` for all rows for now

**Rich status badges** — replace current simple Badge with a composite pill:
```
packageStatus → { dot color, label, bg }
DRAFT               → gray dot,   "Awaiting upload",   gray pill
INGESTING           → blue dot,   "Processing · Ingesting", blue pill
FILE_1_PROCESSING   → blue dot,   "Processing · File 1", blue pill
FILE_2_PROCESSING   → blue dot,   "Processing · File 2 · {X}/{total} subs", blue pill
EXTRACTED           → blue dot,   "Processing · Complete", blue pill
AWAITING_PLAN_CONFIRMATION → orange dot, "Plan Review · Awaiting confirmation", orange pill
EXCEPTION_REVIEW    → orange dot, "In Review · {X} exceptions remain", orange pill
READY_FOR_APPROVAL  → green dot,  "Complete · Approved", green pill  
APPROVED            → green dot,  "Complete · Approved", green pill
REJECTED            → red dot,    "Rejected", red pill
```
Pill style: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border`

For FILE_2_PROCESSING: read `pipelineSteps` from the package (already included in GET /packages response) to find EXTRACT_FILE2 step's `subProgressLabel` and extract the count if present.

For EXCEPTION_REVIEW: use `pkg.exceptionsCount`.

**Row interaction:** Entire row is clickable (cursor-pointer, hover:bg-muted/40). On click, navigate to `packages/:id/{route}` using the same `packageRoute()` mapping as before. Remove the "Open →" button column.

**Verification:** Open `http://localhost:5173` — you should see 4 KPI cards and the table with all 7 columns. Package 16 should show "In Review · 28 exceptions remain" (or similar based on its current status).

---

## Track 3 — IngestPage Rebuild

**File to modify:**
- `c:\Users\KR614XU\Downloads\Ishaan\project-manager\frontend\src\pages\package\IngestPage.jsx`

**Reference images:** Two screenshots:
1. The "Processing · Ingesting" state — left panel shows Step 1 done, Step 2 with spinner + "Checking document integrity..." sub-label, Steps 3-9 pending. Right panel shows activity feed with "Receiving files..." / "File 1 received" / "File 2 received" / "Checking document integrity..." entries, and a "Preliminary check complete" card with "Confirm & Continue →" button.
2. The "Processing · File 1" state — Step 3 active with progress bar "Line 18 of 24 · 18/24". Right panel shows G702 COVER — PREVIEW card.

**Reference TSX files:**
- `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\packages.$id.ingest.tsx`
- `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\ActivityFeed.tsx`
- `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\StepRail.tsx`

### What to build

The page is a two-column layout (`flex h-full`):

**Left column (w-[380px] shrink-0, border-right, overflow-y-auto):**
- Header: `PROCESSING` label (text-xs uppercase tracking-wider text-muted-foreground) + `{period} · {contractName}` h2 (text-base font-semibold)
- Step list — 9 steps, mapped from the `pipelineSteps` array fetched via `usePipelineSteps`. Group your backend steps into these 9 display steps:

| Display Step | Backend stepName(s) | Label |
|---|---|---|
| 1 | INGEST | File Upload & Receipt |
| 2 | CLASSIFY | Preliminary Classification |
| 3 | EXTRACT_FILE1 | Extract GC Cover + G703 |
| 4 | AGENT_PLAN | Agent Plan: Sub-Contractors |
| 5 | EXTRACT_FILE2 | Extract File 2: Sub-Contractors |
| 6 | EXTRACT_FILE3 | Extract File 3: Supporting Docs |
| 7 | RECONCILE | Cross-File Reconciliation |
| 8 | VALIDATE | Exception Assembly |
| 9 | REVIEW | Ready for Review |

Each step card: `rounded-lg border p-3 mb-2`
- Pending: `border-border bg-background text-muted-foreground` — gray dot indicator (h-2 w-2 rounded-full bg-muted)
- Running: `border-primary/40 bg-primary/5` — blue spinner icon (animate-spin, size-4, text-primary), sub-label text below step name in `text-xs text-muted-foreground`
- Done: `border-border bg-background` — green checkmark (Check icon, size-4, text-green-600)

For the ACTIVE running step, show:
- Sub-label from `step.subProgressLabel` if available
- A blue progress bar (`h-1 rounded-full bg-primary`) below the sub-label if `subProgressLabel` contains a fraction like "18/24" — parse numerator/denominator and compute width percentage

**Right column (flex-1, overflow-y-auto, p-6):**
- Title `Activity` (text-sm font-semibold mb-3)
- Activity entries from `GET /api/packages/:id/activity-log` (already exists). Each entry:
  - `{HH:MM:SS}` timestamp in `text-xs text-muted-foreground w-16 shrink-0`
  - Status icon: ✓ green = ok, orange dot = warn, red dot = error, blue spinner = running, gray dot = info
  - Text + optional meta below in `text-xs text-muted-foreground`
- Below the activity list, show a contextual card based on current pipeline state:
  - **After CLASSIFY complete:** "Preliminary check complete" card with `Confirm & Continue →` button (blue, calls the existing `POST /api/pipeline-v2/:packageId/confirm` with `{ step: 'CLASSIFY' }` — this is the existing HITL Gate 1 trigger)
  - **During/After EXTRACT_FILE1:** Show "G702 COVER — PREVIEW" card. Fetch `GET /api/packages/:id` to get `gcHeader`. Display: CONTRACT SUM, APPLICATION NO., PERIOD, WORK COMPLETED TO DATE, RETAINAGE (5%), THIS PERIOD. Show `Continue to Agent Plan →` button when EXTRACT_FILE1 is complete (navigates to `/packages/:id/plan`)
  - **During EXTRACT_FILE2:** Show "No action required. This view auto-advances when extraction completes. Skip to complete →" card. The "Skip to complete" link navigates to `/packages/:id/complete`.

**Polling:** Poll every 3 seconds while any step is `running`. Stop polling when all steps are `complete` or `error`.

**ShellContext:** Call `useShell()` to set `statusLabel` and `statusTone` based on the current running step. Also set `contractName` and `period` from the package data.

**Verification:** Open `http://localhost:5173/packages/16/ingest` — the left panel should show all 9 steps with their current states. The right panel should show the activity log from DB. The header breadcrumb should show the contract name and period.

---

## Track 4 — ExceptionsPage Polish

**File to modify:**
- `c:\Users\KR614XU\Downloads\Ishaan\project-manager\frontend\src\pages\package\ExceptionsPage.jsx`

**Reference images:** Four screenshots showing Math Errors, File 1 vs File 2 Variance, Low Confidence OCR, Missing Evidence (File 3) — each with the 3-panel layout and orange highlight box in the evidence viewer.

**Reference TSX:** `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\packages.$id.exceptions.tsx`

### What to change (do NOT rebuild from scratch — only patch gaps)

**1. Header bar (top of page, outside the 3 columns):**
Add a `flex items-center justify-end px-4 py-2 border-b border-border bg-card` bar at the very top containing only:
`Mark Ready for Approval →` button (bg-primary text-primary-foreground text-xs rounded-md px-3 py-1.5) — on click, navigate to `/packages/:id/hitl`.

**2. Left panel — exception group cards:**
Each group card must show colored severity dots below the group name and dollar amount. Dots are small filled circles (`h-1.5 w-1.5 rounded-full`), one per exception in the group. Color by severity:
- `CRITICAL` / `HIGH` → `bg-red-500`
- `MEDIUM` → `bg-orange-500`
- `LOW` → `bg-yellow-400`

**3. Center panel — table header:**
Replace existing column headers with: checkbox col | SUB | DESCRIPTION | FILE 1 | FILE 2 | VARIANCE
- SUB: first 3 letters of the sub-contractor name, uppercased, in a `text-[11px] font-mono` span
- DESCRIPTION: the exception `title`
- FILE 1 / FILE 2: `file1Value` / `file2Value` formatted as currency
- VARIANCE: `variance` formatted as currency in `text-orange-500 font-semibold` (if non-zero), or `—` (em dash, muted) if zero/null

Add "Select all" and "Bulk accept" text links above the table (right-aligned, in `text-xs text-muted-foreground`). "Bulk accept" only active when at least one row is checked.

**4. Right panel — File 1 / File 2 / File 3 tabs:**
Add tab buttons above the evidence viewer: `File 1 | File 2 | File 3`. Only File 1 and File 2 are functional (linked to respective `PackageDocument` records). File 3 tab shows a placeholder "No File 3 evidence linked" message.

**5. Orange highlight box in evidence viewer:**
The evidence viewer currently renders the PDF page. Add an orange highlight rectangle overlay when `exception.evidenceBboxX` is not null. The rectangle is absolutely positioned over the iframe/image using the bbox coordinates. Use `border-2 border-orange-400 bg-orange-400/10` with `absolute` positioning. The bbox fields are `evidenceBboxX`, `evidenceBboxY`, `evidenceBboxWidth`, `evidenceBboxHeight` — they may be in percentage or pixel units depending on what the extractor stored; render them as percentages of the container if values are < 1, otherwise as pixels.

**6. ShellContext:** Set `statusLabel` to `"In Review · {N} exceptions remain"` with `statusTone: 'warn'`. Set `contractName` and `period`.

**Verification:** Open `http://localhost:5173/packages/16/exceptions` — header shows orange pill "In Review · 28 exceptions remain", left panel shows 4 exception groups with colored dots, center table has SUB/DESCRIPTION/FILE 1/FILE 2/VARIANCE columns, right panel has File 1/2/3 tabs, "Mark Ready for Approval →" button is top-right.

---

## Track 5 — CompletePage Rebuild

**File to modify:**
- `c:\Users\KR614XU\Downloads\Ishaan\project-manager\frontend\src\pages\package\CompletePage.jsx`

**Reference image:** The "Processing Complete" screenshot showing the single summary card: green "All Steps Complete" badge, contract+period title, 4-stat row (EXTRACTED, AUTO-CLEARED, EXCEPTIONS, $ AT RISK), exceptions by type list, "Begin Review →" button.

**Reference TSX:** `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\packages.$id.complete.tsx`

### What to build

Fetch data using existing hooks (`usePackage`, and `GET /api/packages/:id/exceptions` for exception groups).

**Layout:** `p-8` container, `max-w-[820px] mx-auto`, single `rounded-lg border border-border bg-card overflow-hidden` card.

**Card header (p-6, border-bottom):**
- Green badge: `inline-flex items-center gap-2 rounded-full bg-green-50 text-green-700 px-3 py-1 text-xs font-medium` with `Check` icon — label: "All Steps Complete"
- `h1`: `{contract.contractName} · {billingPeriodLabel}` — text-xl font-semibold mt-3
- `p`: "Ready for review. Auto-cleared items have been recorded to the audit trail." — text-sm text-muted-foreground mt-1

**4-stat row (grid-cols-4, border-bottom):**
Each stat cell has `p-4 border-r border-border last:border-0`:
- Label: `text-[11px] uppercase tracking-wider text-muted-foreground`
- Value: `text-2xl font-semibold tabular-nums mt-1`

| Stat | Source | Color |
|---|---|---|
| EXTRACTED | `pkg.totalItemsExtracted` | black |
| AUTO-CLEARED | `pkg.autoClearedCount` + show `({pct}%)` | `text-green-600` |
| EXCEPTIONS | `pkg.exceptionsCount` | `text-orange-500` (if > 0) else black |
| $ AT RISK | `pkg.dollarAtRisk` formatted as currency | `text-red-500` (if > 0) else black |

**Exceptions by type list (p-6):**
- Section label: `text-xs uppercase tracking-wider text-muted-foreground mb-3` "EXCEPTIONS BY TYPE"
- Fetch exception groups from `GET /api/packages/:id/exception-groups` (check if this endpoint exists; if not, use `GET /api/packages/:id/exceptions` and group client-side by `exceptionTypeCode`)
- Each row: `flex items-center gap-3 text-sm`
  - Colored dot (h-2 w-2 rounded-full): red for MATH_ERROR/CRITICAL, orange for CROSS_FILE_MISMATCH, yellow for low confidence/missing evidence
  - Label: `exceptionGroup.displayLabel` — `flex-1`
  - Count: `{itemCount} items` — `text-muted-foreground tabular-nums`
  - Amount: `{dollarAtRisk}` formatted — `w-28 text-right tabular-nums font-medium`

**Footer:** `flex justify-end mt-6`
- `Begin Review →` button (bg-primary text-primary-foreground px-4 py-2 text-sm rounded-md) — navigates to `/packages/:id/exceptions`

**ShellContext:** Set `statusLabel: 'Processing Complete'`, `statusTone: 'success'`, plus `contractName` and `period`.

**Verification:** Open `http://localhost:5173/packages/16/complete` — should show the full summary card with real data from package 16 (234 extracted, 28 exceptions, $399M at risk). Header shows green "Processing Complete" pill.

---

## Track 6 — HITLPage Rebuild

**File to modify:**
- `c:\Users\KR614XU\Downloads\Ishaan\project-manager\frontend\src\pages\package\HitlPage.jsx`

**Reference images:** Two screenshots:
1. "HITL Gate · Confirm & Route" — orange pill in header. Card shows "Human-in-the-loop confirmation" orange badge, 4-item checklist (all green), ROUTE TO section with avatar + name, "Confirm & Send for Approval →" blue button.
2. "Awaiting Formal Validation" — blue pill in header. Card shows "With Finance Approver — Jamie Reyes" badge, "Formal Validation (Step 16)" title, 3-stat row (APPROVED AMOUNT, RETAINAGE HELD, PAYMENT DUE), info box, "← Back" + "Return to Queue →" buttons.

**Reference TSX:** `c:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\packages.$id.hitl.tsx`

### What to build

The page has two conditional views based on `pkg.packageStatus`:

**View A — Confirm & Route** (shown when status is `EXCEPTION_REVIEW` or `READY_FOR_APPROVAL` but not yet submitted):

Card header (p-6, border-bottom):
- Orange badge: `bg-orange-50 text-orange-600 px-3 py-1 text-xs font-medium rounded-full` with `AlertTriangle` icon — "Human-in-the-loop confirmation"
- h1: "Confirm Package Ready for Formal Validation"
- p: "All exceptions resolved. Review the summary before routing to Finance Approver."

Checklist (divide-y divide-border):
Render 4 checklist items (always green checkmarks for now):
1. `All {exceptionsCount} exceptions resolved` — meta: `{resolvedCount} accepted · {overrideCount} overrides` (use 0/0 if no resolution data available)
2. "File 3 evidence attached where required"
3. "Audit trail complete" — meta: `All changes signed by {user.displayName}`
4. "Package totals reconcile" — meta: `Approved amount: {gcHeader.currentPaymentDue formatted}`

Route To section (p-6 bg-muted/30 border-top):
- Section label: "ROUTE TO" in `text-xs uppercase tracking-wider text-muted-foreground mb-2`
- Hardcode approver as: initials `JR`, name "Jamie Reyes", role `Finance Approver · {contract.contractName}`
- Two actions: `← Back to exceptions` (text link navigates back) + `Confirm & Send for Approval →` (blue button with `ShieldCheck` icon)
- On click "Confirm & Send for Approval": call `POST /api/packages/:id/submit` (check if this endpoint exists; if not, call `PATCH /api/packages/:id` with `{ packageStatus: 'READY_FOR_APPROVAL' }` as a fallback) — then switch to View B

**View B — Awaiting Formal Validation** (shown when status is `READY_FOR_APPROVAL` or `APPROVED` AND submission has been clicked):

Card:
- Blue badge: `bg-blue-50 text-blue-600 px-3 py-1 text-xs rounded-full` with clock icon — "With Finance Approver — Jamie Reyes"
- h1: "Formal Validation (Step 16)"
- p: "Package handed off to the Finance Approver for lien-waiver checks, sworn-statement match, and payment authorization."

3-stat row (grid-cols-3, border-top border-bottom):
- APPROVED AMOUNT: `gcHeader.scheduledValueToDate` or `gcHeader.currentPaymentDue`
- RETAINAGE HELD: `gcHeader.retainageHeldToDate` or computed as 5% of approved amount
- PAYMENT DUE: format `approvedAt` date as `MMM DD, YYYY` or show a placeholder date 10 days from `submittedAt`

Info box (mx-6 my-4, rounded border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-700):
"Step 16 formal-validation UI is defined in the next journey document. From here, the approver runs lien-waiver checks, sworn-statement reconciliation, and cuts the payment authorization."

Footer: `← Back` (text link navigates to exceptions) + `Return to Queue →` (blue button with file icon, navigates to `/`)

**ShellContext:**
- View A: `statusLabel: 'HITL Gate · Confirm & Route'`, `statusTone: 'warn'`
- View B: `statusLabel: 'Awaiting Formal Validation'`, `statusTone: 'info'`

**Verification:** Open `http://localhost:5173/packages/16/hitl` — should show View A with the checklist and route-to section. Click "Confirm & Send for Approval" — should switch to View B with financial figures. Header pill changes from orange to blue.

---

## API Endpoints to Check Before Implementing

Before starting, verify these endpoints exist on `http://localhost:3001/api` (use the browser or curl):

1. `GET /api/packages` — must return `exceptionsCount`, `dollarAtRisk`, `totalItemsExtracted`, `pipelineSteps[]` per package ✓ (already does)
2. `GET /api/packages/:id` — must return `gcHeader`, `contract` ✓ (already does)
3. `GET /api/packages/:id/activity-log` — check if this exists; if not, use `pipelineSteps[].subProgressLabel` to synthesize activity entries
4. `GET /api/packages/:id/exception-groups` — check if this exists; if not, call `GET /api/packages/:id/exceptions` and group by `exceptionTypeCode` client-side
5. `POST /api/packages/:id/submit` — check if exists; if not, use `PATCH /api/packages/:id` with status update as fallback

If any endpoint is missing and is needed for the implementation, create it in `c:\Users\KR614XU\Downloads\Ishaan\project-manager\backend\routes\packages.js`.

---

## Execution Order & Reporting

Execute tracks in this exact order. After each track:
1. Take a browser screenshot of the relevant page at `http://localhost:5173`
2. Compare it to the reference image and list any remaining gaps
3. Fix the gaps before moving to the next track
4. Report: "Track N complete — {brief summary of what was changed}"

**Track order:** 1 → 2 → 3 → 4 → 5 → 6

Do not batch tracks. Complete and verify each one individually.
