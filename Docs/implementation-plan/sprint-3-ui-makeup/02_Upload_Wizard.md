# Screen 2: Upload Wizard — "Start New Monthly Package"

## Reference Images
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 2.png` (empty state)
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 3.png` (files attached)

## Route
`/packages/new` → `frontend/src/pages/PackageIntakePage.jsx`

## Current State Assessment
This page has the **largest gap** (~30% match). The current implementation is a basic multi-step wizard with generic circle steppers and a simple form. The Lovable design shows a completely different layout with:
- A horizontal stepper with labels
- Side-by-side billing period + contract dropdowns
- 3 labeled file upload cards with REQUIRED/OPTIONAL badges
- Cancel/Begin Processing footer

## Required Changes — FULL REBUILD

### 1. Page Container
- [ ] Centered card with max-width ~700px (`max-w-2xl mx-auto`)
- [ ] White background with subtle border and rounded corners
- [ ] Padding: `p-8` inside the card
- [ ] No AppShell breadcrumb/status pill visible (this is a top-level page, not inside PackageLayout)

### 2. Title
- [ ] "Start New Monthly Package" — `text-2xl font-semibold` at top
- [ ] No subtitle text

### 3. Stepper (Horizontal Progress)
- [ ] 3 steps displayed horizontally below the title
- [ ] Step format: `● label` connected by dashed lines
- [ ] Step 1: Blue filled circle "1" + "Upload Files" (bold, active)
- [ ] Step 2: Gray circle "2" + "Confirm" (gray text)
- [ ] Step 3: Gray circle "3" + "Process" (gray text)
- [ ] Connected by light gray dashed lines between circles
- [ ] Spacing: `mb-6` below stepper

### 4. Billing Period + Contract Row
- [ ] Two sections side by side:
  - Left: "Billing Period" label → Month dropdown + Year dropdown (side by side)
  - Right: "Contract" label → Full-width contract dropdown
- [ ] Month dropdown: "Jan" / "Feb" / … (shows short month name)
- [ ] Year dropdown: "2026" / "2025" / …
- [ ] Contract dropdown: Shows contract name (e.g., "Highway Bridge Renovation")
- [ ] All dropdowns have: border, rounded corners, chevron icon on right
- [ ] Label styling: `text-sm text-gray-600 mb-1`
- [ ] Layout: `grid grid-cols-[auto_auto_1fr] gap-4 items-end` or flexbox equivalent

### 5. File Upload Cards (3 cards stacked vertically)
Each card is a bordered container with:
- [ ] Left side: File title + subtitle description
- [ ] Right side: "REQUIRED" or "OPTIONAL" badge (uppercase, 11px, gray)
- [ ] Drop zone inside: dashed border, upload icon, "Drop PDF here or click to browse" text
- [ ] Spacing between cards: `space-y-4`

**Card 1 — File 1:**
- Title: "File 1 — Consolidated / Summary Invoice" (bold)
- Subtitle: "GC Cover Page + Continuation Sheet" (gray, small)
- Badge: "REQUIRED" (uppercase, gray)
- Drop zone: Upload icon + "Drop PDF here or click to browse"

**Card 2 — File 2:**
- Title: "File 2 — Sub-Contractor Breakdown" (bold)
- Subtitle: "All sub-contractor invoices compiled" (gray, small)
- Badge: "OPTIONAL" (uppercase, gray)
- Drop zone: Upload icon + "Drop PDF here or click to browse"

**Card 3 — File 3:**
- Title: "File 3 — Supporting Documents" (bold)
- Subtitle: "Direct-cost backup billed by contractor" (gray, small)
- Badge: "OPTIONAL" (uppercase, gray)
- Drop zone: Upload icon + "Drop PDF here or click to browse"

### 6. File Attached State (Image 3)
When a file is attached, the card changes:
- [ ] Border turns green (`border-green-200`)
- [ ] Green checkmark ✓ icon appears before filename
- [ ] File name shown: "GC_Invoice_Jul2026.pdf"
- [ ] File size shown on right: "12.1 MB"
- [ ] "×" remove button on far right
- [ ] No more drop zone visible — replaced by the file info row

### 7. Footer
- [ ] Separator line or spacing above footer
- [ ] Left: "Cancel" link (plain text, clickable, navigates back to `/`)
- [ ] Right: "Begin Processing →" button
  - Blue background (`bg-blue-600`)
  - White text
  - Arrow icon after text
  - Rounded corners
  - Disabled state if File 1 not attached (required)

### 8. Responsive Behavior
- [ ] On smaller screens, billing period and contract should stack vertically
- [ ] File cards should remain full-width and stack naturally

## Implementation Notes

The current `PackageIntakePage.jsx` likely has multi-step logic (step 1, 2, 3 with Next/Back buttons). The Lovable design shows ALL content on a single scroll page (stepper is decorative — just shows step 1 is active). The existing stepper logic should be **replaced** with a single-page form that:
1. Shows billing period + contract + 3 file dropzones
2. "Begin Processing" creates the package AND starts processing in one action
3. Navigates to `/packages/:id/ingest` after submission

### CRITICAL — Exact API Call Sequence (Concern 8)
The upload submission MUST preserve this exact 2-step API sequence:
```
Step 1: POST /api/packages
  Body: { contractId, billingPeriodMonth, billingPeriodYear }
  Response: { id: <newPackageId>, ... }

Step 2: POST /api/packages/<newPackageId>/documents
  Body: multipart FormData with fields:
    - file1 (required) — the consolidated/summary invoice PDF
    - file2 (optional) — sub-contractor breakdown PDF
    - file3 (optional) — supporting documents PDF
  Response: 200 OK → triggers pipeline start
```
After Step 2 succeeds, navigate to `/packages/<newPackageId>/ingest`.
**Do NOT merge these into a single call. Do NOT change field names. Do NOT skip Step 1.**

Preserve the existing API call logic (`POST /packages` with multipart form data) but restructure the UI.

## Validation Criteria
- [ ] Page title "Start New Monthly Package" matches exactly
- [ ] 3-step stepper renders with correct active/inactive styling
- [ ] Billing Period shows month + year dropdowns side by side
- [ ] Contract dropdown renders with existing contracts from API
- [ ] 3 file upload cards render with correct titles, subtitles, badges
- [ ] Drop zone works for drag-and-drop AND click-to-browse
- [ ] Attached files show green border, filename, size, and remove button
- [ ] "Cancel" navigates back to `/`
- [ ] "Begin Processing" is disabled until File 1 is attached
- [ ] "Begin Processing" submits and navigates to ingest page
- [ ] No functionality broken — packages still create correctly
