# End-to-End Test Results — Planning Sheet

**Tested:** 2026-07-02  
**Scope:** Full user journey from extraction → reconciliation → approval  
**Environment:** Frontend :5173, Backend :3001, Azure SQL, User: test@aic.com (REVIEWER)

---

## CRITICAL BUGS (Blocks user journey)

| # | Page | Issue | Root Cause | Fix |
|---|------|-------|-----------|-----|
| C1 | HITL Gate | **"Confirm & Send for Approval" fails with 400** — `packageStatus must be APPROVED or REJECTED` | Backend `PATCH /api/packages/:id` only allows `APPROVED`/`REJECTED`. HitlPage sends `READY_FOR_APPROVAL`. Also requires role `APPROVER`/`ADMIN` but user is `REVIEWER`. | Add a new `POST /api/packages/:id/submit` route for REVIEWERs to transition status to `READY_FOR_APPROVAL`. |
| C2 | HITL Gate | **Role blocked** — Even if C1's status check passes, the REVIEWER role can't call the approve endpoint. | `requireRole(['APPROVER', 'ADMIN'])` middleware on the PATCH route. | Submit-for-approval should be a separate endpoint with `requireRole(['REVIEWER', 'ADMIN'])`. |

---

## HIGH PRIORITY (Functional gaps — data incorrect)

| # | Page | Issue | Root Cause | Fix |
|---|------|-------|-----------|-----|
| H1 | Complete Page | **EXTRACTED stat shows "0"** | `pkg.totalItemsExtracted` is `null` in DB — pipeline never populates it. | Either: (a) Compute from GcSovLine count + SubPayAppHeader count at validation time, or (b) populate `totalItemsExtracted` in VALIDATE step. |
| H2 | Complete Page | **AUTO-CLEARED shows "0 (0%)"** | `pkg.autoClearedCount` is `null` — no auto-clear logic implemented yet. | Populate during VALIDATE step based on rules (e.g., variance < threshold). |
| H3 | File 2 Page | **"No sub-contractor lines with non-zero work this period"** | The File2Page queries `SubPayAppLineItem` records but they may not be stored, or the query filter is too strict. | Check `/api/packages/:id/sub-lines` endpoint. Verify SubPayAppLineItem records exist for package 16. |
| H4 | File 1 / G703 Table | **# and Description columns empty** | `GcSovLine.lineNo` and `GcSovLine.description` fields are `null` in DB. Extraction may not populate these. | Verify extraction populates `lineNo` and `description` fields. If data is in a different field, fix column mapping. |
| H5 | Exceptions Page | **Bulk accept only affects visible page (7 items), not full group** | "Select all" checks visible rows but "Bulk accept" only sends the currently visible checked items. Pagination hides the rest. | Either: send ALL IDs in the group when "Bulk accept" is clicked, or add "Accept all in group" action that doesn't depend on checkbox selection. |
| H6 | IngestPage | **Duplicate key warning (key=614)** on activity list | Activity log has duplicate entries with same ID. The backend returns duplicate rows or the key prop uses a non-unique field. | Use `index` or `${activity.id}-${index}` as key. Also investigate why duplicate activity rows exist for the same timestamp. |

---

## MEDIUM PRIORITY (Missing features / incomplete implementation)

| # | Page | Issue | Details |
|---|------|-------|---------|
| M1 | Notifications | **Bell icon has no dropdown/popup** | Clicking the bell icon does nothing visible. Need a notification panel/dropdown showing unread notifications. |
| M2 | Reports Page | **Placeholder only** | Empty page with "Reports" heading — no content. |
| M3 | Settings Page | **Placeholder only** | Empty page with "Settings" heading — no content. |
| M4 | Contracts Page | **Contractor and Original Value always "—"** | Fields likely `null` in DB. Need to populate during contract creation or expose in "New Contract" form. |
| M5 | Dashboard | **EXTRACTED column always "—"** for all packages | Same root as H1 — `totalItemsExtracted` never populated in any package. |
| M6 | Dashboard | **SLA column always "—"** | No SLA tracking implemented. Need deadline + breach detection. |
| M7 | Exception Page | **SUB column always "—"** | Exception records don't have a direct `subContractorName` field easily accessible. Need to join through `entityId → SubPayAppHeader.subContractorName`. |
| M8 | Exception Page | **FILE 1 / FILE 2 columns always "—"** | `file1Value` is null on most exceptions. Only `file2Value` and `variance` are populated. FILE 1 might need to be computed as `file2Value - variance`. |

---

## LOW PRIORITY (Console warnings / cosmetic)

| # | Page | Issue | Fix |
|---|------|-------|-----|
| L1 | IngestPage (DRAFT pkgs) | Duplicate activity feed entries at same timestamp | Backend creating duplicate `ActivityLog` entries on package creation. |
| L2 | Contracts | Duplicate "Project 6" contract entries | Data quality — two contracts with same name (IDs 9, 10). Delete duplicate or add disambiguation. |
| L3 | Package Intake | Contract dropdown shows duplicate "Project 6" | Same as L2 — add contract number/ID to disambiguation. |
| L4 | IngestPage | React key prop warning for activity items with key `614` | Add index to key: `key={`${item.id}-${i}`}` |

---

## FLOW SUMMARY

```
✅ Login → Dashboard loads with real data
✅ Dashboard → Click row → Navigates to correct page based on status
✅ New Package → Upload wizard renders, dropdowns populated, validation works
✅ Ingest Page → 9 steps shown, activity feed with real timestamps
✅ Plan Page → 32 subs listed, Confirm button works, navigates to File 2
✅ File 1 Page → G702 cover data + G703 SOV table + PDF viewer
⚠️ File 2 Page → Processing log correct but "No lines" displayed (H3)
✅ Complete Page → Green badge, exception types with $ amounts, Begin Review
✅ Exceptions → 3-panel layout, checkboxes, Select All, PDF evidence viewer
⚠️ Bulk Accept → Only accepts visible rows, not full group (H5)
❌ HITL → "Confirm & Send" fails with 400 (C1/C2)
✅ Contracts → Table with expand, packages nested
✅ Navigation → All routes work, no crashes
```

---

## RECOMMENDED FIX ORDER

1. **C1 + C2** — Add `POST /api/packages/:id/submit` for REVIEWER to transition to READY_FOR_APPROVAL
2. **H1** — Populate `totalItemsExtracted` during VALIDATE step  
3. **H5** — Fix bulk accept to send all group IDs
4. **H3** — Debug File2Page sub-line query
5. **H6** — Fix duplicate key in activity list
6. **M1** — Implement notification dropdown
7. **M7 + M8** — Exception table data joins
