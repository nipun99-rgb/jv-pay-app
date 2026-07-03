# Sprint 3 — UI Makeup: Pixel-Perfect Alignment to Lovable Reference

## Objective
Align every application screen to be visually identical to the Lovable reference images while preserving all existing business logic and functionality.

## Reference Images Location
`C:\Users\KR614XU\Downloads\Ishaan\Docs\lovable-example-app\ui-images\`

## Screen-to-Image Mapping

| # | Screen | Route | Reference Image(s) | Prompt File |
|---|--------|-------|---------------------|-------------|
| 1 | Dashboard / Package Queue | `/` | `landing-page-dashboard.png`, `InvoiceReview — Contractor Invoice Validation 1.png`, `1 (1).png` | `01_Dashboard.md` |
| 2 | Upload Wizard (New Package) | `/packages/new` | `InvoiceReview — Contractor Invoice Validation 2.png`, `3.png` | `02_Upload_Wizard.md` |
| 3 | IngestPage (Pipeline Monitor) | `/packages/:id/ingest` | `InvoiceReview — Contractor Invoice Validation 4.png`, `5.png`, `6.png`, `8.png`, `9.png` | `03_Ingest_Page.md` |
| 4 | Agent Plan — Sub-Contractors | `/packages/:id/plan` | `InvoiceReview — Contractor Invoice Validation 7.png` | `04_Agent_Plan.md` |
| 5 | CompletePage | `/packages/:id/complete` | `InvoiceReview — Contractor Invoice Validation 10.png` | `05_Complete_Page.md` |
| 6 | Exceptions Page | `/packages/:id/exceptions` | `InvoiceReview — Contractor Invoice Validation 11.png`, `12.png`, `13.png`, `14.png` | `06_Exceptions_Page.md` |
| 7 | HITL Page (View A + View B) | `/packages/:id/hitl` | `InvoiceReview — Contractor Invoice Validation 15.png`, `16.png` | `07_HITL_Page.md` |

## Global Issues (Apply to ALL package sub-pages)

These issues recur across multiple screens and should be fixed globally before screen-specific work:

1. **Remove pipeline progress bar** — The horizontal INGEST → CLASSIFY → EXTRACT_FILE1 → … → REVIEW progress bar at the top of PackageLayout is NOT in the Lovable design. Remove it entirely.
2. **Remove "Contract · Period · ID" sub-header row** — The row showing "Test 1 · Feb 2026" and "ID: 16" below the pipeline bar is NOT in Lovable. The breadcrumb in the AppShell header already shows this info.
3. **Primary button color** — Lovable uses a blue (`#2563EB` / `bg-blue-600`) primary button. Our app currently uses a dark/black primary. Update `--color-primary` to blue.
4. **Status pill in header** — Should dynamically reflect the correct state for each page (e.g., "Processing · File 2 · 8/14 subs", "In Review · 12 exceptions remain", "HITL Gate · Confirm & Route", "Awaiting Formal Validation", "Processing Complete"). Currently shows stale data.

## Execution Order

1. Fix global issues first (pipeline bar removal, sub-header removal, primary button color)
2. Then proceed screen by screen: Dashboard → Upload Wizard → Ingest → Agent Plan → Complete → Exceptions → HITL
3. After each screen: screenshot, compare to reference, fix gaps, confirm match

## Constraints

- **Do NOT modify business logic, API calls, or data flow**
- Changes are limited to the presentation layer (JSX structure, CSS classes, Tailwind utilities)
- All existing navigation, form submissions, and state management must remain functional
- Test after each change to ensure no regressions
