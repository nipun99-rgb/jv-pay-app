# Screen 3: IngestPage — Pipeline Monitor

## Reference Images
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 4.png` (Step 2 running — early processing)
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 5.png` (Step 3 running — with G702 Preview card)
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 6.png` (Step 3 duplicate)
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 8.png` (Step 5 running — File 2 extraction with activity feed)
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 9.png` (Step 5 wider view)

## Route
`/packages/:id/ingest` → `frontend/src/pages/package/IngestPage.jsx`

## Current State Assessment
The IngestPage is approximately **85% matched**. The two-column layout, 9 step cards, activity feed, progress bars, and contextual cards are all correct. Main gaps:
1. Extra pipeline progress bar at the top (NOT in Lovable)
2. Extra "Contract · Period · ID" sub-header (NOT in Lovable)
3. Some sub-progress text shows raw data instead of clean labels

## Required Changes

### 1. Remove Pipeline Progress Bar (GLOBAL — in PackageLayout.jsx)
**File:** `frontend/src/pages/package/PackageLayout.jsx`

- [ ] Remove the horizontal pipeline stepper bar (INGEST → CLASSIFY → EXTRACT_FILE1 → … → REVIEW)
- [ ] Remove the "Contract · Period" sub-header row with "ID: 16"
- [ ] The content area should start immediately with the IngestPage content
- [ ] The breadcrumb and status pill in the AppShell header already show this info

### 2. Page Header — "PROCESSING" Label
**File:** `frontend/src/pages/package/IngestPage.jsx`

- [ ] "PROCESSING" — all-caps, `text-[11px] tracking-wider text-gray-400 font-medium`
- [ ] Below: "{Period} · {Contract Name}" — `text-lg font-semibold` (e.g., "Jun 2026 · Northwest Terminal Expansion")
- [ ] No other header elements — no badge, no package ID

### 3. Left Column — Step Cards (w-[380px])
Each step card structure:
- [ ] White background, border, rounded-lg
- [ ] Padding: `px-4 py-3`
- [ ] Top-left: "Step {n}" in gray small text (`text-xs text-gray-400`)
- [ ] Title: Step name in `text-sm font-medium`
- [ ] Sub-text: completion detail in `text-xs text-gray-500` (e.g., "3 files received · 292 pages")
- [ ] Right side: status icon
  - ✓ Green checkmark for completed steps
  - ◌ Blue spinner (animated) for running step
  - ● Gray dot for pending steps

**Active (running) step additional styling:**
- [ ] Left border: 3px solid blue (`border-l-[3px] border-blue-500`)
- [ ] Background: slightly blue tinted (`bg-blue-50/30`)
- [ ] Progress bar: blue bar below title (`h-1 bg-blue-500 rounded`)
- [ ] Sub-progress text: "Line 18 of 24" or "Delta Plumbing Inc (pages 19–24)" + right-aligned fraction "18/24" or "8/14"

**Step names and sub-text patterns:**
| Step | Name | Completed sub-text |
|------|------|-------------------|
| 1 | File Upload & Receipt | "3 files received · 292 pages" |
| 2 | Preliminary Classification | "Integrity confirmed" |
| 3 | Extract GC Cover + G703 | "47 pages · 24 line items" |
| 4 | Agent Plan: Sub-Contractors | "14 subs identified" |
| 5 | Extract File 2: Sub-Contractors | Progress: "Delta Plumbing Inc (pages 19–24) 8/14" |
| 6 | Extract File 3: Supporting Docs | — |
| 7 | Cross-File Reconciliation | — |
| 8 | Exception Assembly | — |
| 9 | Ready for Review | — |

### 4. Right Column — Activity Feed
- [ ] Header: "Activity" — `text-lg font-semibold mb-4`
- [ ] Each entry is a row:
  - Left: Timestamp `text-xs text-gray-400 tabular-nums w-[60px]` (e.g., "09:22:04")
  - Status indicator: colored circle or icon
    - Green ✓ for success items
    - Orange ● for variance/warning items
    - Red ● for error/failure items
    - Blue spinner ◌ for in-progress items
    - Gray ● for info items
  - Right: Description text
    - Primary text: `text-sm font-medium` (e.g., "ABC Structural Steel")
    - Secondary text: `text-xs text-gray-500` (e.g., "Extracted · $250,000")
- [ ] Entries stack vertically with `space-y-4`

### 5. Contextual Cards (appear on right column below activity)
Different cards appear based on pipeline state:

**A. "Preliminary check complete" card (after CLASSIFY step):**
- [ ] Bordered card, rounded
- [ ] Title: "Preliminary check complete" — bold
- [ ] Body: "All 3 files parsed. Detected G702/G703 in File 1. Ready to extract."
- [ ] Button: "Confirm & Continue →" (blue, rounded)

**B. "G702 COVER — PREVIEW" card (during EXTRACT_FILE1):**
- [ ] Gray header bar: "G702 COVER — PREVIEW" (uppercase, small)
- [ ] 2×3 grid of key-value pairs:
  - CONTRACT SUM: $4,200,000
  - APPLICATION NO.: #12
  - PERIOD: Jun 2026
  - WORK COMPLETED TO DATE: $2,860,400
  - RETAINAGE (5%): $143,020
  - THIS PERIOD: $412,300
- [ ] Button: "Continue to Agent Plan →" (blue)

**C. "No action required" info card (during File 2 extraction):**
- [ ] Light background, bordered
- [ ] Text: "No action required. This view auto-advances when extraction completes."
- [ ] Link: "Skip to complete →" (blue text, clickable)

### 6. Status Pill in Header
The AppShell status pill should show dynamic text based on current step:
- [ ] During File 1: "● Processing · File 1" (blue)
- [ ] During Classification: "● Processing · Ingesting" (blue)
- [ ] During File 2: "● Processing · File 2 · 8/14 subs" (blue)
- [ ] When paused: "● Plan Review · Awaiting confirmation" (orange)

### 7. Spacing & Layout
- [ ] Two columns: Left fixed `w-[380px]`, Right flex-1
- [ ] Gap between columns: `gap-8` (32px)
- [ ] Page padding: `p-6` or `p-8`
- [ ] Step cards spacing: `space-y-3`

## Validation Criteria
- [ ] No pipeline progress bar visible at top
- [ ] No sub-header row with "Contract · Period · ID"
- [ ] "PROCESSING" label + period/contract title renders correctly
- [ ] 9 step cards render with correct names, icons, and states
- [ ] Active step shows blue left border, progress bar, sub-progress text
- [ ] Activity feed shows timestamped entries with colored status dots
- [ ] Contextual cards appear based on pipeline state
- [ ] Status pill in header shows current processing state
- [ ] Page auto-refreshes/polls to update step progress
- [ ] Clicking "Confirm & Continue" advances the pipeline
- [ ] "Skip to complete" navigates to complete page
