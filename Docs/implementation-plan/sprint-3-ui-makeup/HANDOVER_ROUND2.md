# HANDOVER PROMPT — Sprint 3 UI Fixes (Round 2)

## Context
Sprint 3 UI work was partially completed. Build passes but there are runtime bugs and remaining visual gaps. This prompt covers the exact fixes needed based on browser-verified screenshots compared to Lovable reference images.

## Pre-Requisites
- Frontend dev server: `cd project-manager/frontend && npm run dev` (port 5173)
- Backend: `cd project-manager/backend && node server.js` (port 3001)
- Login: `test@aic.com` / `Test1234!`
- Reference images: `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\`
- Reference TSX: `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\project-files\`

---

## BUG FIX 1 — PackageIntakePage CRASH (Critical)

**File:** `frontend/src/pages/PackageIntakePage.jsx`  
**Problem:** The file has orphaned code after the `FileCard` component (after line ~252). There are duplicate `useEffect` hooks, duplicate `handleSubmit`, and duplicate `const MONTHS` sitting OUTSIDE any function component. This causes "Invalid hook call" crash on `/packages/new`.

**Fix:** Delete everything from line 253 to end of file. The file should end cleanly after the closing `}` of the `FileCard` component function. The complete correct file ends with:
```jsx
function FileCard({ num, title, subtitle, required, file, onSelect, onRemove }) {
  // ... component body ...
}
```
Nothing should come after that last closing brace.

**Verify:** Navigate to `http://localhost:5173/packages/new` — page should render without crash.

---

## FIX 2 — Nav Rail Active State Color (Orange, not Blue)

**File:** `frontend/src/components/AppShell.jsx`

**Current:** Active nav item uses `bg-[var(--color-primary)]/10 text-[var(--color-primary)]` which renders as blue.
**Required:** Active nav item should use ORANGE like Lovable: `bg-orange-50 text-orange-600`

**Find this line:**
```jsx
? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
```
**Replace with:**
```jsx
? 'bg-orange-50 text-orange-600'
```

**Verify:** On dashboard, "Packages" icon and label should be orange.

---

## FIX 3 — Remove "Logout" from Nav Rail

**File:** `frontend/src/components/AppShell.jsx`

**Problem:** There's a "Logout" button at the bottom of the nav rail. The Lovable design has NO logout visible — it's a clean nav rail with only icons+labels.

**Fix:** Remove the Logout button/link from the nav rail section entirely. If you want to keep logout functionality, put it as a dropdown item behind the user avatar in the header instead — but for now just remove it.

**Verify:** No "Logout" text/icon at bottom of nav rail.

---

## FIX 4 — Dashboard: Period Format

**File:** `frontend/src/pages/GlobalDashboard.jsx`

**Current:** PERIOD column shows "2026-02" (raw billingPeriodLabel)
**Required:** PERIOD column should show "Feb 2026" (human-readable month name + year)

**Fix:** Format the period display to use month name:
```jsx
// Instead of raw billingPeriodLabel like "2026-02"
const period = pkg.billingPeriodMonth 
  ? new Date(pkg.billingPeriodYear, pkg.billingPeriodMonth - 1).toLocaleString('default', { month: 'short', year: 'numeric' })
  : pkg.billingPeriodLabel;
```

**Verify:** Table PERIOD column shows "Feb 2026", "May 2026", etc.

---

## FIX 5 — IngestPage: Step 4 Raw JSON Dump

**File:** `frontend/src/pages/package/IngestPage.jsx`

**Problem:** Step 4 "Agent Plan: Sub-Contractors" shows raw JSON blob from `subProgressLabel` instead of a clean summary like "32 sub-contractors identified". The `subProgressLabel` contains the full agent plan JSON array.

**Fix:** In the step detail rendering, if the `subProgressLabel` starts with `[{` (JSON array), parse it and show a count instead:
```jsx
// When rendering step.detail, check if it's raw JSON
let displayDetail = step.detail;
if (displayDetail && displayDetail.startsWith('[{')) {
  try {
    const arr = JSON.parse(displayDetail);
    displayDetail = `${arr.length} sub-contractors identified`;
  } catch { /* keep original */ }
}
```

**Verify:** Step 4 card shows "32 sub-contractors identified" instead of raw JSON.

---

## FIX 6 — IngestPage: Active Step Left Border

**File:** `frontend/src/pages/package/IngestPage.jsx`

**Current:** Active step has `border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5` (subtle blue border all around)
**Required (Lovable):** Active step should have a THICK LEFT BORDER only: `border-l-[3px] border-l-blue-500 border border-gray-200 bg-blue-50/30`

**Fix:** Change the active step class from:
```jsx
isRunning ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5'
```
to:
```jsx
isRunning ? 'border border-gray-200 border-l-[3px] border-l-blue-500 bg-blue-50/30'
```

**Verify:** The currently-running step card has a thick blue left accent border.

---

## FIX 7 — CompletePage: Missing Dollar Values

**File:** `frontend/src/pages/package/CompletePage.jsx`

**Problem:** The "EXCEPTIONS BY TYPE" section shows "—" for all dollar amounts. The dollar amount should come from summing `dollarAtRisk` within each exception group.

**Fix:** Verify the grouping logic properly sums `dollarAtRisk` per group. The current code likely has:
```jsx
const dollarAtRisk = group.reduce((sum, ex) => sum + (Number(ex.dollarAtRisk) || 0), 0);
```
If it still shows "—", the issue is the `formatCurrency` helper treating 0 as "—". Check: if dollarAtRisk is 0 but exceptions have `dollarAtRisk` fields, ensure those fields are being read correctly from the API response.

Also: The "EXTRACTED" stat shows 0 and "AUTO-CLEARED" shows 0. These should read from `pkg.totalItemsExtracted` and `pkg.autoClearedCount`. Verify the package object is being fetched correctly and these fields exist.

**Verify:** Exception type rows show dollar amounts. EXTRACTED stat shows actual number (e.g., 234 for package 16).

---

## FIX 8 — CompletePage: Status Pill Should Show "Processing Complete" (Green)

**File:** `frontend/src/pages/package/CompletePage.jsx`

**Problem:** Status pill shows "In Review · 28 exceptions remain" (orange) instead of "Processing Complete" (green). The CompletePage should override the shell context.

**Fix:** Add a `useEffect` in CompletePage that calls `setShellData`:
```jsx
const { setShellData } = useShell();
useEffect(() => {
  setShellData({ statusLabel: 'Processing Complete', statusTone: 'success' });
}, [setShellData]);
```

**Verify:** CompletePage shows green "Processing Complete" pill in header.

---

## FIX 9 — PlanPage: Status Pill Should Show "Plan Review · Awaiting confirmation" (Orange)

**File:** `frontend/src/pages/package/PlanPage.jsx`

**Problem:** Status pill shows "In Review · 28 exceptions remain" (inherited from PackageLayout) instead of "Plan Review · Awaiting confirmation".

**Fix:** Add a `useEffect` in PlanPage that calls `setShellData`:
```jsx
const { setShellData } = useShell();
useEffect(() => {
  setShellData({ statusLabel: 'Plan Review · Awaiting confirmation', statusTone: 'warn' });
}, [setShellData]);
```

Import `useShell` from `@/contexts/ShellContext.jsx`.

**Verify:** PlanPage shows orange "Plan Review · Awaiting confirmation" pill.

---

## FIX 10 — ExceptionsPage: Verify "Mark Ready for Approval →" Button

**File:** `frontend/src/pages/package/ExceptionsPage.jsx`

**Verified working:** ✅ Button exists top-right, blue, correct text.

No change needed — just confirm it's present.

---

## FIX 11 — HITLPage: Status Pill Should Show "HITL Gate · Confirm & Route" (Orange)

**File:** `frontend/src/pages/package/HitlPage.jsx`

**Problem:** Shows "In Review · 28 exceptions remain" instead of "HITL Gate · Confirm & Route".

**Fix:** Add `useEffect` to override shell:
```jsx
useEffect(() => {
  setShellData({ statusLabel: 'HITL Gate · Confirm & Route', statusTone: 'warn' });
}, [setShellData]);
```

For View B (after submit), change to:
```jsx
setShellData({ statusLabel: 'Awaiting Formal Validation', statusTone: 'info' });
```

**Verify:** HITL View A shows orange "HITL Gate · Confirm & Route", View B shows blue "Awaiting Formal Validation".

---

## FIX 12 — Console Warning: CompletePage key prop

**File:** `frontend/src/pages/package/CompletePage.jsx`

**Problem:** React warning "Each child in a list should have a unique key prop" in CompletePage render.

**Fix:** Find the `<li>` or mapped list in the "Exceptions by type" section and add a unique `key` prop (use `exceptionTypeCode` or index).

---

## Execution Order

1. **Fix 1** (PackageIntakePage crash) — CRITICAL, blocks `/packages/new`
2. **Fix 2** (Nav rail orange active)
3. **Fix 3** (Remove Logout from rail)
4. **Fix 4** (Period format)
5. **Fix 5** (IngestPage raw JSON)
6. **Fix 6** (Active step left border)
7. **Fix 7** (CompletePage dollars)
8. **Fix 8–9, 11** (Status pills per page)
9. **Fix 12** (Key prop warning)

## After All Fixes

Navigate through each page and take screenshots:
1. `http://localhost:5173/` — Dashboard
2. `http://localhost:5173/packages/new` — Upload Wizard
3. `http://localhost:5173/packages/16/ingest` — IngestPage
4. `http://localhost:5173/packages/16/plan` — Agent Plan
5. `http://localhost:5173/packages/16/complete` — CompletePage
6. `http://localhost:5173/packages/16/exceptions` — ExceptionsPage
7. `http://localhost:5173/packages/16/hitl` — HITL Page

Compare each to the reference images in `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\`

Report remaining gaps if any.

## DO NOT
- Add npm packages
- Create TypeScript files
- Modify backend API routes
- Break existing form submissions or navigation
- Create documentation files
