# Screen 4: Agent Plan — Sub-Contractors

## Reference Images
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 7.png`

## Route
`/packages/:id/plan` → `frontend/src/pages/package/PlanPage.jsx`

## Current State Assessment
The Agent Plan page is approximately **50% matched**. The core concept (table of sub-contractors with a confirm button) exists, but the layout, columns, and styling differ significantly from the Lovable reference.

## Required Changes

### 1. Remove Pipeline Progress Bar (GLOBAL fix in PackageLayout)
- [ ] Same as other pages — remove the horizontal stepper bar and sub-header row

### 2. Page Title Section
- [ ] Title: "Agent Plan — Sub-Contractors" — `text-2xl font-semibold`
- [ ] Subtitle: "The agent identified **14 sub-contractors** in File 1. Confirm the list or edit before extraction begins on File 2."
  - The number "14 sub-contractors" should be **bold** (dynamic, based on actual count)
  - Rest is normal weight, `text-gray-600 text-sm`
- [ ] No icons, no badges in title area
- [ ] Spacing: title has `mb-1`, subtitle has `mb-6`

### 3. Table Structure — 4 Columns
**Current columns:** Checkbox | Sub-Contractor | Billed This Period
**Required columns:** CODE | NAME | TRADE | FILE 1 VALUE

Column details:
- [ ] **CODE** — 3-letter uppercase identifier (e.g., "ABC", "DLT", "EVR")
  - Styling: `text-sm font-mono text-gray-600`
  - Width: ~80px
- [ ] **NAME** — Full sub-contractor name (e.g., "ABC Structural Steel")
  - Styling: `text-sm font-medium`
  - Width: flexible (largest column)
- [ ] **TRADE** — Trade category (e.g., "Steel", "Plumbing", "Electrical")
  - Styling: `text-sm text-gray-600`
  - Width: ~140px
- [ ] **FILE 1 VALUE** — Dollar amount from File 1 extraction
  - Styling: `text-sm font-medium text-right tabular-nums`
  - Format: "$245,000" (currency, no decimals)
  - Width: ~120px

### 4. Table Header Row
- [ ] Headers: ALL-CAPS, `text-[11px] tracking-wider text-gray-500 font-medium`
- [ ] No background color — just bottom border
- [ ] Headers: "CODE", "NAME", "TRADE", "FILE 1 VALUE"

### 5. Table Body Rows
- [ ] Each row separated by subtle `border-b border-gray-100`
- [ ] Row height: ~48px (comfortable spacing)
- [ ] No checkboxes (Lovable doesn't show checkboxes)
- [ ] No hover state shown, but good practice to add subtle `hover:bg-gray-50`
- [ ] Data should come from the agent plan items (API: `/packages/:id/agent-plan`)

**Expected data pattern (from reference):**
| CODE | NAME | TRADE | FILE 1 VALUE |
|------|------|-------|--------------|
| ABC | ABC Structural Steel | Steel | $245,000 |
| DLT | Delta Plumbing Inc | Plumbing | $87,400 |
| EVR | Evergreen Electrical | Electrical | $132,500 |
| FRX | Foundry X Concrete | Concrete | $198,000 |
| GLS | GreenLine Site Services | Sitework | $56,800 |
| HRT | Hartford Mechanical | HVAC | $178,300 |
| IRN | Ironclad Rebar Co | Rebar | $92,100 |
| JMR | JMR Waterproofing | Waterproofing | $41,200 |
| KLN | Kilnsworth Masonry | Masonry | $118,400 |
| LMN | Luminous Lighting | Lighting | $34,500 |
| MTS | Metroline Traffic Signs | Signage | $22,800 |
| NST | Northshore Testing Labs | QA/QC | $18,400 |
| OMG | Omega Painting | Painting | $28,900 |
| PRT | Portside Landscaping | Landscape | $15,200 |

### 6. "+ Add sub-contractor" Row
- [ ] At the bottom of the table, a row with:
  - "+ Add sub-contractor" text in `text-sm text-gray-500`
  - Centered within the row
  - Clickable (can open an add modal or inline form)
  - `hover:text-blue-600 cursor-pointer`

### 7. Footer Section
- [ ] Clear separator (spacing or thin line) above footer
- [ ] Left: "← Go back" link
  - Plain text, `text-sm text-gray-500 hover:text-gray-700`
  - Navigates back to `/packages/:id/ingest`
- [ ] Right: "Confirm & Begin File 2 Extraction →" button
  - Blue background (`bg-blue-600`)
  - White text
  - Arrow icon after text
  - `px-5 py-2.5 rounded-lg text-sm font-medium`
  - On click: confirms the agent plan (PATCH API) and resumes pipeline

### 8. Status Pill in Header
- [ ] Should show: "● Plan Review · Awaiting confirmation" (orange pill)
- [ ] Orange dot + "Plan Review" primary text + "Awaiting confirmation" secondary text

### 9. Breadcrumb in Header
- [ ] "InvoiceReview / Contracts / {Contract Name} / {Period}"
- [ ] Same as other package sub-pages

## Data Mapping Notes

The current API returns agent plan items with fields like `subName` and `billedThisPeriod`. To display CODE and TRADE columns, you may need to:
1. Check if the `agentPlanItem` model already has `code` and `trade` fields
2. If not, derive CODE from the first 3 letters of the sub-contractor name (or add to model)
3. TRADE may need to be added to the sub-contractor model or agent plan item

**If the data doesn't have CODE/TRADE:** Display what's available (name + amount) and add placeholder columns. The visual structure must match regardless.

### IMPORTANT — Checkbox Removal & Selection Logic (Concern 7)
The Lovable reference shows NO checkboxes. However, the current `PlanPage.jsx` may use checkboxes to select which sub-contractors to include in the confirm API payload. **Before removing checkboxes:**
- [ ] Check if the confirm endpoint (`PATCH /packages/:id/agent-plan/confirm` or similar) expects a list of selected item IDs
- [ ] If yes: keep all rows "selected by default" invisibly — send all items in the confirm payload
- [ ] If no (it confirms all): safe to remove checkboxes entirely
- [ ] Do NOT break the confirm API contract by removing selection state without verification

## Validation Criteria
- [ ] No pipeline progress bar or sub-header row
- [ ] Title "Agent Plan — Sub-Contractors" with dynamic count in subtitle
- [ ] Table shows 4 columns: CODE, NAME, TRADE, FILE 1 VALUE
- [ ] All rows render with correct styling and spacing
- [ ] "+ Add sub-contractor" row appears at bottom
- [ ] "← Go back" link and "Confirm & Begin File 2 Extraction →" button in footer
- [ ] Confirm button triggers API call and advances pipeline
- [ ] Status pill shows "Plan Review · Awaiting confirmation" (orange)
- [ ] No functionality broken — plan confirmation still works
