# Screen 7: HITL Page — Human-in-the-Loop Gate (View A + View B)

## Reference Images
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 15.png` (View A — Confirm & Route)
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 16.png` (View B — Awaiting Formal Validation)

## Route
`/packages/:id/hitl` → `frontend/src/pages/package/HitlPage.jsx`

## Current State Assessment
The HITL page is approximately **93% matched**. Both views are structurally correct. Minor tweaks needed for button colors and exact spacing.

## Required Changes

### VIEW A — Confirm & Route (Image 15)

#### 1. Remove Pipeline Progress Bar (GLOBAL)
- [ ] Remove horizontal stepper and sub-header from PackageLayout

#### 2. Card Container
- [ ] Centered, `max-w-[820px] mx-auto`
- [ ] White background, border, rounded-lg
- [ ] No shadow — just border (`border border-gray-200`)

#### 3. Header Section (inside card)
- [ ] Orange badge: `inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5`
  - ⚠️ Warning triangle icon (orange)
  - Text: "Human-in-the-loop confirmation" — `text-xs font-medium text-orange-600`
- [ ] Title: "Confirm Package Ready for Formal Validation" — `text-xl font-semibold mt-3`
- [ ] Subtitle: "All exceptions resolved. Review the summary before routing to Finance Approver." — `text-sm text-gray-500 mt-1`
- [ ] Bottom border separating header from checklist: `border-b border-gray-100 pb-6`

#### 4. Checklist (4 items)
- [ ] Vertical list with dividers between items (`divide-y divide-gray-100`)
- [ ] Each item: `flex items-center gap-3 px-6 py-3.5`
  - Left: Green circle with white checkmark
    - Circle: `h-5 w-5 rounded-full bg-green-50 flex items-center justify-center`
    - Checkmark: `text-green-600 h-3 w-3`
  - Right content:
    - Primary text: `text-sm` (e.g., "All 30 exceptions resolved")
    - Secondary text: `text-xs text-gray-500` (e.g., "24 accepted · 6 overrides")

**Checklist items:**
1. "All 30 exceptions resolved" / "24 accepted · 6 overrides" (dynamic counts)
2. "File 3 evidence attached where required" / (no subtitle)
3. "Audit trail complete" / "All changes signed by M. Alvarez" (dynamic user name)
4. "Package totals reconcile" / "Approved amount: $391,200" (dynamic amount)

#### 5. "ROUTE TO" Section
- [ ] Background: slightly tinted (`bg-gray-50/50`) or light muted
- [ ] Top border: `border-t border-gray-100`
- [ ] Padding: `p-6`
- [ ] Label: "ROUTE TO" — ALL-CAPS, `text-[11px] tracking-wider text-gray-400 mb-3`
- [ ] Avatar + name row:
  - Circle avatar: `h-8 w-8 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold` → shows "JR"
  - Name: "Jamie Reyes" — `text-sm font-medium`
  - Role: "Finance Approver · {Contract Name}" — `text-xs text-gray-500`
- [ ] Gap between avatar row and buttons: `mt-5`

#### 6. Footer (inside Route To section)
- [ ] `flex justify-between items-center`
- [ ] Left: "← Back to exceptions" — `text-sm text-gray-500 hover:text-gray-700`
- [ ] Right: "Confirm & Send for Approval" button
  - **Blue background** (`bg-blue-600`) — NOT dark/black!
  - White text
  - Shield icon before text
  - `px-4 py-2.5 rounded-lg text-sm font-medium`
  - On click: PATCH packageStatus → shows View B

#### 7. Status Pill
- [ ] "● HITL Gate · Confirm & Route" (orange dot, orange text)

---

### VIEW B — Awaiting Formal Validation (Image 16)

#### 1. Card Container
- [ ] Same as View A: centered, `max-w-[820px]`, border, rounded

#### 2. Header Section
- [ ] Blue badge: `inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5`
  - Clock icon (blue)
  - Text: "With Finance Approver — Jamie Reyes" — `text-xs font-medium text-blue-600`
- [ ] Title: "Formal Validation (Step 16)" — `text-xl font-semibold mt-3`
- [ ] Subtitle: "Package handed off to the Finance Approver for lien-waiver checks, sworn-statement match, and payment authorization." — `text-sm text-gray-500 mt-1`

#### 3. 3-Stat Row
- [ ] Horizontal grid: `grid grid-cols-3`
- [ ] Vertical dividers between stats (`border-r` on first two)
- [ ] Border top and bottom around entire row: `border-y border-gray-100`
- [ ] Each stat cell padding: `p-5`

| Stat | Label | Value | Notes |
|------|-------|-------|-------|
| 1 | APPROVED AMOUNT | $391,200 | `text-2xl font-semibold` |
| 2 | RETAINAGE HELD | $19,560 | `text-2xl font-semibold` |
| 3 | PAYMENT DUE | Jul 12, 2026 | `text-2xl font-semibold` — NOTE: this is a DATE, not a dollar |

- [ ] Labels: ALL-CAPS, `text-[11px] tracking-wider text-gray-400`

**IMPORTANT — Payment Due Date Computation (Concern 6):**
The `GcPayApplicationHeader` schema has NO `paymentDueDate` field. Compute it as:
```js
const submitted = pkg?.submittedAt ? new Date(pkg.submittedAt) : new Date();
const paymentDue = new Date(submitted);
paymentDue.setDate(paymentDue.getDate() + 10);
// Format as "Jul 12, 2026"
```
If `submittedAt` is null AND the package was never submitted, show "—" as fallback.

**IMPORTANT NOTE:** The 3rd stat in Lovable is "PAYMENT DUE" showing a **date** ("Jul 12, 2026"), not a dollar amount. Our current implementation shows a dollar amount. Fix to show a date (calculate as current date + 10 business days, or use a static placeholder).

#### 4. Info Box
- [ ] Blue-tinted info box below stats
- [ ] Styling: `mx-6 my-4 rounded-md border border-blue-100 bg-blue-50/50 p-4`
- [ ] Blue info circle icon (ℹ️) on left
- [ ] Text: "Step 16 formal-validation UI is defined in the next journey document. From here, the approver runs lien-waiver checks, sworn-statement reconciliation, and cuts the payment authorization."
- [ ] Font: `text-sm text-blue-700`

#### 5. Footer
- [ ] `flex justify-between items-center`
- [ ] Border-top: `border-t border-gray-100 p-6`
- [ ] Left: "← Back" — `text-sm text-gray-500`
- [ ] Right: "Return to Queue" button
  - **Blue background** (`bg-blue-600`) — NOT dark/black!
  - White text
  - Document icon before text (📄)
  - `px-4 py-2.5 rounded-lg text-sm font-medium`
  - On click: navigate to `/` (dashboard)

#### 6. Status Pill
- [ ] "● Awaiting Formal Validation" (blue dot, blue text)
- [ ] `bg-blue-50 text-blue-700`

## Validation Criteria

### View A
- [ ] Orange badge with warning icon renders correctly
- [ ] Title and subtitle display dynamic data
- [ ] 4 checklist items show with green circles and correct text
- [ ] "ROUTE TO" section shows JR avatar and details
- [ ] "Confirm & Send for Approval" button is **BLUE** (not dark)
- [ ] Clicking confirm transitions to View B
- [ ] Status pill shows orange "HITL Gate · Confirm & Route"

### View B
- [ ] Blue badge with clock icon renders correctly
- [ ] 3-stat row shows with vertical dividers
- [ ] 3rd stat shows a DATE, not a dollar
- [ ] Blue info box renders with correct text
- [ ] "Return to Queue" button is **BLUE** (not dark)
- [ ] Clicking "Return to Queue" navigates to dashboard
- [ ] Status pill shows blue "Awaiting Formal Validation"

### Both Views
- [ ] No pipeline progress bar or sub-header row
- [ ] Card is centered and properly sized
- [ ] All existing API calls and state management preserved
