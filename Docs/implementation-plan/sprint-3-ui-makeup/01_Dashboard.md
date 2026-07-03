# Screen 1: Dashboard / Package Queue

## Reference Images
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\landing-page-dashboard.png`
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 1.png`
- `C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\InvoiceReview — Contractor Invoice Validation 1 (1).png`

## Route
`/` → `frontend/src/pages/GlobalDashboard.jsx`

## Current State Assessment
The Dashboard is approximately **95% matched** to the Lovable reference. Layout, KPI cards, 7-column table, and status pills all align well.

## Required Changes

### 1. AppShell Header Adjustments
**File:** `frontend/src/components/AppShell.jsx`

- [ ] The "InvoiceReview" badge in Lovable uses a purple/violet square icon (IV) — verify ours matches exactly
- [ ] Bell icon (🔔) should be a simple outline bell, no badge/counter
- [ ] User display: "M. Alvarez" format (first initial + last name) with a user icon — verify avatar styling matches
- [ ] Breadcrumb on Dashboard should show ONLY "InvoiceReview" (no contract/period since we're at root)

### 2. Nav Rail
**File:** `frontend/src/components/AppShell.jsx`

- [ ] Active state: Lovable shows "Packages" with an orange/primary-colored icon and text when active
- [ ] Inactive icons: gray (#6B7280) with no background
- [ ] Icon style: outlined/thin line style (not filled)
- [ ] Verify nav items: Packages (📦), Contracts (📁), Reports (📊), Settings (⚙️) — in that order

### 3. Page Title Section
**File:** `frontend/src/pages/GlobalDashboard.jsx`

- [ ] Title: "Package Queue" — bold, ~24px, left-aligned
- [ ] Subtitle: "Monthly invoice packages across all contracts." — gray, ~14px
- [ ] "+ New Package" button: top-right, blue background (`bg-blue-600`), white text, rounded, with "+" icon

### 4. KPI Cards Row
- [ ] 4 cards in a single row, equal width, with subtle border
- [ ] Each card: icon (top-left, gray), label (gray, uppercase-ish, 12px), value (large, bold)
- [ ] Card 1: 📋 "Open packages" → "3" (black)
- [ ] Card 2: ⚠️ "Exceptions to resolve" → "40" (orange `text-orange-500`)
- [ ] Card 3: 📈 "$ at risk" → "$141,600" (red `text-red-500`)
- [ ] Card 4: ⏰ "SLA breaches" → "0" (black)
- [ ] No background color on cards — just white with border

### 5. Table Styling
- [ ] Column headers: ALL-CAPS, 11px, tracking-wider, gray (`text-gray-500`), no borders
- [ ] Columns: CONTRACT | PERIOD | STATUS | EXTRACTED | EXCEPTIONS | $ AT RISK | SLA
- [ ] Row separator: thin horizontal line between rows (`border-b border-gray-100`)
- [ ] CONTRACT column: truncated with ellipsis if too long ("Highway Bridge Reno…")
- [ ] PERIOD column: "Jun 2026" format
- [ ] STATUS column: colored dot + multi-line text with tinted background pill
  - Orange dot + "In Review · 12 exceptions remain" on `bg-orange-50`
  - Blue dot + "Processing · File 2 · 8/14 subs" on `bg-blue-50`
  - Green dot + "Complete · Approved" on `bg-green-50`
  - Gray dot + "Awaiting upload" on `bg-gray-50`
- [ ] EXCEPTIONS: orange number (`text-orange-500`) or "—" dash
- [ ] $ AT RISK: red number (`text-red-500`) or "—" dash
- [ ] SLA: "Due in 2 days" / "Due in 4 days" / "Closed" — plain text

### 6. Overall Spacing
- [ ] Content area padding: `p-8` (32px) from shell edges
- [ ] Gap between title row and KPI cards: ~24px
- [ ] Gap between KPI cards and table: ~24px
- [ ] Table row height: ~56px

## Validation Criteria
- [ ] Screenshot matches reference at 1:1
- [ ] All 4 KPI cards show with correct icon, label, value, and color
- [ ] Table rows are clickable and navigate to package detail
- [ ] "+ New Package" button navigates to `/packages/new`
- [ ] Status pills render with correct color coding per status
