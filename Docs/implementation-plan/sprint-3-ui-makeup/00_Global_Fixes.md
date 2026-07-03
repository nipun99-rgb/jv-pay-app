# Sprint 3 — Global Fixes (Apply First)

## Priority: Execute BEFORE individual screen fixes

These issues appear on ALL package sub-pages and must be fixed once in shared components.

## Reference
All Lovable reference images are at:
`C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\`

Compare any package sub-page screenshot (Images 4-16) to confirm these elements are NOT present in the Lovable design.

---

## Fix 1: Remove Pipeline Progress Bar from PackageLayout

**File:** `frontend/src/pages/package/PackageLayout.jsx`

**What to remove:**
The horizontal progress bar showing pipeline steps (INGEST → CLASSIFY → EXTRACT_FILE1 → AGENT_PLAN → EXTRACT_FILE2 → EXTRACT_FILE3 → RECONCILE → EXCEPTIONS → REVIEW) with colored segments.

**Why:** The Lovable design does NOT have this element. Pipeline progress is communicated through:
1. The step cards in IngestPage (left column)
2. The status pill in the AppShell header

**Action:**
- [ ] Remove the `<PipelineProgress>` component or progress bar JSX from PackageLayout
- [ ] Remove any associated state/imports for the progress bar
- [ ] Ensure the main content area starts immediately without this bar
- [ ] Verify no visual gap is left where the bar was

---

## Fix 2: Remove "Contract · Period · ID" Sub-Header Row

**File:** `frontend/src/pages/package/PackageLayout.jsx`

**What to remove:**
The row below the (now-removed) pipeline bar that shows:
- Contract name (e.g., "Test 1")
- Period (e.g., "Feb 2026")  
- Package ID badge (e.g., "ID: 16")

**Why:** The Lovable design shows contract/period info ONLY in the AppShell breadcrumb. The IngestPage shows "Jun 2026 · Northwest Terminal Expansion" as its own page-level header.

**Action:**
- [ ] Remove the sub-header row from PackageLayout
- [ ] The breadcrumb in AppShell already shows: "InvoiceReview / Contracts / {Contract Name} / {Period}"
- [ ] Each page can show its own context header if needed (IngestPage already does)

---

## Fix 3: Primary Button Color → Blue

**Files to check:**
- `frontend/src/index.css` or CSS vars definition
- `frontend/tailwind.config.js` (if theme customization exists)
- Any component using `bg-[var(--color-primary)]`

**Current state:** Primary buttons render as dark/black
**Required state:** Primary buttons should be blue (`#2563EB` / `bg-blue-600`)

**Action:**
- [ ] Update `--color-primary` CSS variable to `#2563EB` (blue-600)
- [ ] Update `--color-primary-foreground` to `#FFFFFF` (white) if not already
- [ ] Verify all buttons that use `bg-[var(--color-primary)]` now render blue
- [ ] Test: Dashboard "+ New Package", Ingest "Confirm & Continue", HITL "Confirm & Send", etc.
- [ ] The blue should match Tailwind's `blue-600` exactly: `rgb(37, 99, 235)`

---

## Fix 4: Status Pill Dynamic Text

**File:** `frontend/src/components/AppShell.jsx` + `frontend/src/contexts/ShellContext.jsx`

The status pill in the AppShell header should dynamically reflect the package's current state. The Lovable reference shows these states:

| Route/State | Pill Text | Pill Color |
|-------------|-----------|------------|
| Dashboard (/) | (no pill) | — |
| Ingest (processing) | "Processing · Ingesting" | Blue |
| Ingest (File 1) | "Processing · File 1" | Blue |
| Ingest (File 2) | "Processing · File 2 · 8/14 subs" | Blue |
| Agent Plan | "Plan Review · Awaiting confirmation" | Orange |
| Complete | "Processing Complete" | Green |
| Exceptions | "In Review · 12 exceptions remain" | Orange |
| HITL View A | "HITL Gate · Confirm & Route" | Orange |
| HITL View B | "Awaiting Formal Validation" | Blue |

**Action:**
- [ ] Ensure each page's `useEffect` calls `setShellData()` with the correct `statusLabel` and `statusTone`
- [ ] Verify the pill renders with proper dot color + text
- [ ] Pill tones: `info` = blue bg, `warn` = orange bg, `success` = green bg
- [ ] The pill should disappear on the root dashboard (no package context)

---

## Fix 5: AppShell Header Breadcrumb Format

**File:** `frontend/src/components/AppShell.jsx`

**Lovable format:** `InvoiceReview / Contracts / {Contract Name} / {Period}`
- Separator: " / " with spaces
- Each segment is plain text (not clickable links in Lovable, but can keep if already working)
- Contract name is the actual contract name
- Period is "Jun 2026" format

**Action:**
- [ ] Verify breadcrumb renders in the correct format
- [ ] On dashboard: shows only "InvoiceReview" (no breadcrumb segments)
- [ ] On package pages: shows full path with contract + period

---

## Fix 6: Nav Rail Active State Color

**File:** `frontend/src/components/AppShell.jsx`

**Lovable:** Active nav item has orange/primary-colored icon and text
**Current:** Verify the active state styling matches

**Action:**
- [ ] Active nav item: icon and label both colored (orange or primary blue)
- [ ] Background: subtle tint on active item
- [ ] Inactive items: gray icon and text, no background

---

## Verification Checklist

After applying all global fixes:
- [ ] Navigate to `/packages/16/ingest` — no pipeline bar, no sub-header, content starts immediately
- [ ] Navigate to `/packages/16/exceptions` — same clean layout
- [ ] Navigate to `/packages/16/hitl` — same clean layout
- [ ] Click any primary button — it should be BLUE
- [ ] Status pill shows correct text for each page
- [ ] Breadcrumb shows "InvoiceReview / Contracts / Test 1 / Feb 2026"
- [ ] Run `npx vite build` — no errors
