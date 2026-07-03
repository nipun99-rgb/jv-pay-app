# Screen 5: Complete Page — "All Steps Complete"

## Reference Images
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 10.png`

## Route
`/packages/:id/complete` → `frontend/src/pages/package/CompletePage.jsx`

## Current State Assessment
The CompletePage is approximately **92% matched**. The green badge, 4-stat row, exception type list, and "Begin Review" button all align well. Minor tweaks needed.

## Required Changes

### 1. Remove Pipeline Progress Bar (GLOBAL)
- [ ] Remove horizontal stepper and sub-header row from PackageLayout

### 2. Card Container
- [ ] Centered, max-width ~820px (`max-w-[820px] mx-auto`)
- [ ] White background, border, rounded-lg
- [ ] Padding: `p-8`
- [ ] Subtle shadow: none (just border)

### 3. Green "All Steps Complete" Badge
- [ ] Green circle with checkmark + "All Steps Complete" text
- [ ] Badge styling: `inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-600`
- [ ] Checkmark: green, small, inside circle or standalone

### 4. Title + Subtitle
- [ ] Title: "{Contract Name} · {Period}" — `text-xl font-semibold mt-3`
  - Example: "Northwest Terminal Expansion · Jun 2026"
- [ ] Subtitle: "Ready for review. Auto-cleared items have been recorded to the audit trail." — `text-sm text-gray-500 mt-1`

### 5. 4-Stat Row
- [ ] Horizontal row with 4 stat blocks, separated by vertical dividers
- [ ] Layout: `grid grid-cols-4` with `border-r` between items (except last)
- [ ] Each stat:
  - Label: ALL-CAPS, `text-[11px] tracking-wider text-gray-400`
  - Value: `text-2xl font-semibold mt-1`

| Stat | Label | Value | Color |
|------|-------|-------|-------|
| 1 | EXTRACTED | 214 | black |
| 2 | AUTO-CLEARED | 198 (93%) | green (`text-green-600`) |
| 3 | EXCEPTIONS | 0 | orange if > 0 (`text-orange-500`), else black |
| 4 | $ AT RISK | $0 | red if > 0 (`text-red-500`), else black |

### 6. "EXCEPTIONS BY TYPE" Section
- [ ] Section label: "EXCEPTIONS BY TYPE" — ALL-CAPS, `text-[11px] tracking-wider text-gray-400 mb-3`
- [ ] Separator line above: `border-t mt-6 pt-4`
- [ ] List of exception types, each row:
  - Left: colored dot (size ~8px, rounded-full) + type name
  - Right: count + dollar amount
  - Layout: `flex justify-between items-center py-1.5`

**Dot colors by type:**
- Math errors → red (`bg-red-500`)
- File 1 vs File 2 variance → orange (`bg-orange-500`)
- Low confidence OCR → yellow (`bg-yellow-500`)
- Missing evidence (File 3) → yellow/amber (`bg-amber-400`)

**Row format:**
```
● Math errors                    5 items    $28,400
● File 1 vs File 2 variance    12 items    $78,900
● Low confidence OCR             8 items    $21,300
● Missing evidence (File 3)      5 items    $13,000
```

- [ ] Name: `text-sm`
- [ ] Count: `text-sm text-gray-500`
- [ ] Dollar: `text-sm font-medium tabular-nums`

### 7. "Begin Review →" Button
- [ ] Bottom-right of the card
- [ ] Blue background (`bg-blue-600`)
- [ ] White text: "Begin Review →"
- [ ] Arrow after text
- [ ] `px-4 py-2 rounded-md text-sm font-medium`
- [ ] Alignment: `flex justify-end mt-6`
- [ ] On click: navigate to `/packages/:id/exceptions`

### 8. Status Pill in Header
- [ ] "● Processing Complete" with green dot
- [ ] Green styling: `bg-green-50 text-green-700`

### 9. Data Fetching — Exception Groups (Concern 5)
**IMPORTANT:** There is NO `GET /api/packages/:id/exception-groups` endpoint. Do NOT search for it.
- [ ] Fetch all exceptions from `GET /exceptions/${packageId}` (existing endpoint)
- [ ] Group client-side by `exceptionTypeCode` field
- [ ] Compute count and dollar total per group from the grouped data
- [ ] Map type codes to display names and dot colors client-side

### 9. Breadcrumb
- [ ] "InvoiceReview / Contracts / {Contract Name} / {Period}"

## Validation Criteria
- [ ] No pipeline progress bar or sub-header row
- [ ] Green badge renders correctly at top
- [ ] Title shows dynamic contract name + period
- [ ] 4-stat row shows with correct values and colors
- [ ] Exception type list shows colored dots, names, counts, and dollars
- [ ] "Begin Review →" button navigates to exceptions page
- [ ] Status pill shows "Processing Complete" (green)
- [ ] Card is properly centered with correct max-width
