# Screen 6: Exceptions Page — Exception Review & Resolution

## Reference Images
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 11.png` (Math Errors group)
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 12.png` (File 1 vs File 2 Variance group)
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 13.png` (Low Confidence OCR group)
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 14.png` (Missing Evidence File 3 group)

## Route
`/packages/:id/exceptions` → `frontend/src/pages/package/ExceptionsPage.jsx`

## Current State Assessment
The ExceptionsPage is approximately **80% matched**. The 3-panel layout exists and the basic structure is correct. Key gaps are in the evidence viewer panel and some detail styling.

## Required Changes

### 1. Remove Pipeline Progress Bar (GLOBAL)
- [ ] Remove horizontal stepper and sub-header from PackageLayout

### 2. Overall 3-Panel Layout
- [ ] Layout: `flex h-full` (full height of content area)
- [ ] Left panel (Group Navigator): `w-[280px]` fixed, vertical scroll
- [ ] Center panel (Exception Table): `flex-1` with min-width
- [ ] Right panel (Evidence Viewer): `w-[380px]` fixed, vertical scroll
- [ ] Panels separated by subtle vertical borders (`border-r border-gray-100`)

### 3. "Mark Ready for Approval →" Button
- [ ] Position: top-right corner, floating above the 3-panel content
- [ ] Styling: Blue background (`bg-blue-600`), white text, rounded-lg
- [ ] Text: "Mark Ready for Approval →" with arrow
- [ ] Size: `px-4 py-2 text-sm font-medium`
- [ ] On click: PATCH package status and navigate to HITL page

### 4. Left Panel — Group Navigator
Each group is a card:
- [ ] Active group: left border orange (`border-l-[3px] border-orange-400`), light background
- [ ] Inactive groups: no left border, white background
- [ ] Card content:
  - Title: Group name (`text-sm font-medium`) — e.g., "Math Errors"
  - Subtitle: "{count} items · ${dollar}" — `text-xs text-gray-500` — e.g., "5 items · $10,520"
  - Severity dots: row of small colored circles below subtitle
    - Red dots for Math Errors (●●●●●)
    - Orange dots for File 1 vs File 2 Variance (●●●●)
    - Yellow dots for Low Confidence OCR (●●)
    - Yellow/amber single dot for Missing Evidence (●)
- [ ] Cards stacked with `space-y-2`
- [ ] Full card is clickable to switch active group
- [ ] Padding inside cards: `px-4 py-3`

**Exception Groups (from reference):**
| Group | Items | Dollar | Dot Color |
|-------|-------|--------|-----------|
| Math Errors | 5 items | $10,520 | Red |
| File 1 vs File 2 Variance | 4 items | $12,600 | Orange |
| Low Confidence OCR | 2 items | $824 | Yellow |
| Missing Evidence (File 3) | 1 items | $2,650 | Yellow/Amber |

### 5. Center Panel — Exception Table

#### Table Header Row
- [ ] Group title as section header: "Math Errors" — `text-lg font-semibold`
- [ ] Right-aligned actions: "Select all" (link) + "Bulk accept" (link)
  - Styling: `text-sm text-gray-500 hover:text-gray-700`
  - Separated by `ml-4`

#### Column Headers
- [ ] ALL-CAPS, `text-[11px] tracking-wider text-gray-500 font-medium`
- [ ] Columns: (checkbox) | SUB | DESCRIPTION | FILE 1 | FILE 2 | VARIANCE
- [ ] No ACTION column visible in Lovable (remove if currently shown)

#### Table Rows
- [ ] Each row: `py-3 border-b border-gray-50`
- [ ] Checkbox: small, rounded, unchecked by default
- [ ] SUB: 3-letter code in `text-sm text-gray-600 font-mono` (e.g., "ABC", "DLT", "KLN")
- [ ] DESCRIPTION: Multi-line text allowed — `text-sm` (e.g., "Line total ≠ qty × rate", "Subtotal mismatch")
- [ ] FILE 1: Dollar amount `text-sm tabular-nums` (e.g., "$45,000")
- [ ] FILE 2: Dollar amount `text-sm tabular-nums` (e.g., "$50,000")
- [ ] VARIANCE: Red/orange dollar amount `text-sm text-red-500 tabular-nums font-medium` (e.g., "$5,000")
  - If no variance (dash shown): "—" in gray

#### Row Data Examples (Math Errors group):
| ☐ | SUB | DESCRIPTION | FILE 1 | FILE 2 | VARIANCE |
|---|-----|-------------|--------|--------|----------|
| ☐ | ABC | Line total ≠ qty × rate | $45,000 | $50,000 | $5,000 |
| ☐ | DLT | Subtotal mismatch | $12,000 | $13,400 | $1,400 |
| ☐ | KLN | Tax calculation off | $8,200 | $8,420 | $220 |
| ☐ | GLS | Retention math | $4,400 | $4,900 | $500 |
| ☐ | IRN | Total does not roll up | $92,100 | $95,500 | $3,400 |

### 6. Right Panel — Evidence Viewer

#### Tab Bar
- [ ] 3 tabs: "File 1" | "File 2" | "File 3"
- [ ] Active tab: bottom border blue (`border-b-2 border-blue-600 text-blue-600`)
- [ ] Inactive tabs: no border, gray text
- [ ] Tab bar sits at the top of the right panel

#### Context Header
- [ ] Below tabs: "Page 12 · Sub ABC" — `text-xs text-gray-500 px-4 py-2`
- [ ] Shows which page and sub-contractor is being displayed

#### Evidence Content — Continuation Sheet Mockup
The Lovable reference shows a **schematic/mockup** of a continuation sheet, NOT an actual PDF render. It displays:
- [ ] Card with border and rounded corners
- [ ] Header: "📄 Continuation Sheet — Page 12" with a document icon
- [ ] Below: numbered line items in a table-like format:
  ```
  Line 1 — …                    $—
  Line 2 — …                    $—
  Line 3 — …                    $—
  ┌─────────────────────────────────────┐
  │ Line 4 — Line total ≠ qty × rate  $45,000 │  ← HIGHLIGHTED (orange border)
  └─────────────────────────────────────┘
  Line 5 — …                    $—
  Line 6 — …                    $—
  ...
  Line 12 — …                   $—
  ```
- [ ] The highlighted line (Line 4 in this case) has:
  - Orange/amber border (`border border-orange-300 rounded`)
  - Light orange background (`bg-orange-50`)
  - Shows the exception description + dollar amount
- [ ] Other lines show placeholder "…" text and "$—" values
- [ ] Font: monospace-ish (`font-mono text-xs`)

**NOTE:** If our app currently renders actual PDF pages, that's arguably BETTER than the mockup. However, to match the Lovable reference exactly, we should:
- Keep the actual PDF render as-is (it's functional)
- BUT add the orange highlight/annotation on the specific line that triggered the exception
- Add the "Page X · Sub Y" context header above

**IMPORTANT — Bbox Null Handling (Concern 4):**
The exception records have `evidenceBboxX/Y/Width/Height` fields in the schema, but the reconciler currently does NOT populate them — they will be `null` for all exceptions. **If `evidenceBboxX` is null, render the PDF page without any overlay.** Do not crash or show an empty orange box. Only render the orange highlight when valid bbox coordinates exist.

### 7. Status Pill in Header
- [ ] "● In Review · 12 exceptions remain" (orange pill)
- [ ] Orange dot + text
- [ ] Dynamic count of remaining exceptions

### 8. No Visible ACTION Column
- [ ] In Lovable reference, there's NO "Accept" / "Override" / "Reject" button column
- [ ] Actions are implicit via checkbox selection + "Bulk accept" link
- [ ] Remove inline action buttons if currently shown
- [ ] Resolution happens via: select rows → "Bulk accept" OR individual row click to resolve

### 9. Overall Spacing and Polish
- [ ] No extra padding/margins between panels
- [ ] Panels fill full height of viewport below the AppShell header
- [ ] Left panel has slight background tint only on active group
- [ ] Table cells align properly vertically (centered)
- [ ] Right panel evidence card has internal padding `p-4`

## Validation Criteria
- [ ] 3-panel layout fills viewport width correctly
- [ ] Group navigator shows all exception types with correct counts, dollars, and colored dots
- [ ] Active group is highlighted with orange left border
- [ ] Table shows correct columns: checkbox, SUB, DESCRIPTION, FILE 1, FILE 2, VARIANCE
- [ ] Variance values are red/colored
- [ ] Evidence viewer has File 1/2/3 tabs with active styling
- [ ] Evidence shows page context header
- [ ] The exception-specific line is highlighted with orange border in evidence
- [ ] "Mark Ready for Approval →" button is visible and functional
- [ ] "Select all" and "Bulk accept" links work
- [ ] Clicking a group in the navigator updates the table content
- [ ] Status pill shows dynamic exception count
- [ ] No pipeline progress bar or sub-header row
