# Database Schema Design — Invoice Validation & Review Platform
## Document 03: Data Flow Architecture

**Document Version:** 1.0
**Date:** 2 July 2026
**Prepared by:** Senior Database Architect, EY
**Status:** OFFICIAL DESIGN REFERENCE — For Implementation

---

## Overview

This document traces the journey of data through the system for each of the 10 key operational flows. For each flow, it shows: which database tables are read, which are written, in what sequence, and what the database state transitions look like.

---

## 1. Project & Contract Setup

**Trigger:** System Admin creates a new contract for a client.

**Tables written (in sequence):**
```
1. clients           (if new client)     → INSERT
2. users             (if new users)      → INSERT
3. roles             (seeded, no write)
4. user_roles                            → INSERT (assign reviewer, approver roles)
5. contracts                             → INSERT
6. contract_configs                      → INSERT (retainage rate, tolerances, rules)
```

**Resulting database state:**
```
clients: 1 row
contracts: 1 row (linked to client)
contract_configs: 1 row (linked to contract, all rule fields populated)
users: N rows (reviewers, approvers for this client)
user_roles: N rows (user ↔ role ↔ client assignments)
```

**Key constraint enforced:** `contract_configs.contract_id` is UNIQUE — system admin cannot create two config records for the same contract.

**API endpoints involved:**
- `POST /api/clients`
- `POST /api/contracts`
- `PUT /api/contracts/:id/config`
- `POST /api/users`
- `POST /api/user-roles`

---

## 2. Package Intake (Screen 1)

**Trigger:** Invoice Reviewer clicks "New Package" and uploads files.

**Tables written (in sequence):**
```
1. packages              → INSERT  (status: DRAFT)
2. audit_events          → INSERT  (event_type: PACKAGE_CREATED)
3. package_documents     → INSERT  (up to 3 rows: FILE_1_GC_COVER, FILE_2_SUBS, FILE_3_SUPPORT)
4. audit_events          → INSERT  (event_type: FILES_UPLOADED)
5. processing_pipeline_steps → INSERT × 9 (all status: 'pending')
6. activity_logs         → INSERT  ("Package created. Files received. Processing starting...")
```

**Duplicate detection:** Before step 1, the system computes SHA-256 of each uploaded file and queries:
```sql
SELECT id FROM packages
WHERE contract_id = ? 
  AND billing_period_month = ? 
  AND billing_period_year = ?
```
If a row exists, the user is warned. If the file hash matches an existing `packages.file_hash_1`, the user is warned of a duplicate file.

**State transition:** `packages.package_status` → `DRAFT` → `INGESTING`

---

## 3. File Ingestion & Classification (Screen 2 — Steps 1 & 2)

**Trigger:** User clicks "Begin Processing."

**Tables written:**
```
processing_pipeline_steps  → UPDATE step 1 status: 'running' → 'complete'
processing_pipeline_steps  → UPDATE step 2 status: 'running'
package_documents          → UPDATE upload_status: RECEIVED → CLASSIFIED (or QUARANTINED)
document_pages             → INSERT × N (one per PDF page, with OCR text and page classification)
activity_logs              → INSERT (streaming messages per classification event)
```

**Classification output per page:**
```
document_pages.classification:
  G702, G703                    → File 1 pages
  SUB_COVER, SUB_G703           → File 2 pages
  RECEIPT, INVOICE, DELIVERY_TICKET → File 3 pages
  UNKNOWN                       → flagged for manual review
```

**Confirmation gate (end of Step 2):**
System writes a structured activity log entry:
```json
{
  "level": "info",
  "step_no": 2,
  "message": "Preliminary check complete. File 1: 47 pages — GC Pay Application detected. File 2: 183 pages — Sub-Contractor Package detected."
}
```
Pipeline pauses at the confirmation card. User clicks "Confirm & Continue."

**State transition:** `packages.package_status` → `INGESTING` → `FILE_1_PROCESSING`

---

## 4. File 1 Extraction (Screen 3 — Step 3)

**Trigger:** User confirms classification. System proceeds automatically.

**Tables written (in sequence):**
```
processing_pipeline_steps      → UPDATE step 3: status 'running'
raw_extracted_fields            → INSERT × N (all fields extracted from G702 and G703, with bbox + confidence)
gc_pay_application_headers      → INSERT (canonical G702 data)
gc_pay_application_sov_lines    → INSERT × N (one per G703 line item)
processing_pipeline_steps       → UPDATE step 3: status 'complete'
activity_logs                   → INSERT (progress messages)
```

**Raw → Canonical pipeline:**
```
raw_extracted_fields (immutable)
    field_name: "current_payment_due", raw_value: "$2,340,000.00", confidence: 0.97, bbox: (x,y,w,h)
         ↓
gc_pay_application_headers (canonical)
    current_payment_due: 2340000.00, extraction_confidence: 0.97, bbox_x/y/w/h: (as above)
```

**Sub-contractor count extraction:**
The G703 lines are grouped by `contractor_name`:
```sql
SELECT contractor_name, SUM(work_completed_this) AS billed_amount
FROM gc_pay_application_sov_lines
WHERE package_id = ?
GROUP BY contractor_name
```
This produces the preliminary sub-contractor list for the Agent Plan.

**State transition:** `packages.package_status` → `FILE_1_PROCESSING` → `AWAITING_PLAN_CONFIRMATION`
`processing_pipeline_steps` step 4 → status: `paused`

---

## 5. Agent Plan Confirmation (Screen 4 — Step 4 Gate)

**Trigger:** User reviews the sub-contractor list and clicks "Confirm & Proceed to File 2."

**Tables written (in sequence):**
```
agent_plans          → INSERT (write-once; confirmed_by, confirmed_at)
agent_plan_items     → INSERT × N (one per confirmed sub-contractor)
audit_events         → INSERT (event_type: PLAN_CONFIRMED, event_summary: {sub_count, manual_adds})
review_action_logs   → INSERT (action_type: PLAN_CONFIRMED)
processing_pipeline_steps → UPDATE step 4: status 'complete'
```

**Immutability enforcement:**
After this INSERT, no UPDATE or DELETE is permitted on `agent_plans` or `agent_plan_items`. The API handler checks:
```sql
SELECT id FROM agent_plans WHERE package_id = ?
```
If a row exists and a write is attempted, return HTTP 403 "Agent plan is confirmed and immutable."

**Manual additions:**
If the reviewer added sub-contractors manually, those rows have:
```
agent_plan_items.source = 'MANUAL'
agent_plan_items.is_manually_added = 1
agent_plan_items.original_ocr_name = NULL
```

**State transition:** `packages.package_status` → `AWAITING_PLAN_CONFIRMATION` → `FILE_2_3_PROCESSING`

---

## 6. File 2 & File 3 Extraction (Screen 5 — Steps 5 & 6)

**Trigger:** Automatic after agent plan confirmation.

### File 2 Processing (Step 5):

For each `agent_plan_items` row, the extraction engine:
1. Searches File 2 (pages within `package_documents` where `file_role = 'FILE_2_SUBS'`) for the sub-contractor's application
2. Extracts that sub's G702 cover and G703 continuation sheet

**Tables written per sub-contractor:**
```
raw_extracted_fields            → INSERT × N (sub-specific fields with bbox + confidence)
sub_pay_application_headers     → INSERT (canonical sub G702, linked to agent_plan_item_id)
sub_pay_application_sov_lines   → INSERT × N (sub G703 lines)
processing_pipeline_steps       → UPDATE step 5: sub_progress_current, sub_progress_label
activity_logs                   → INSERT per sub ("✓ ABC Electrical Works — $124,500 extracted")
```

**Cross-file amount written back to GC table:**
```sql
UPDATE gc_pay_application_sov_lines
SET file2_extracted_amount = ?,         -- g703_work_this_period from matched sub
    cross_file_variance = work_completed_this - ?,
    file2_matched_sub_app_id = ?
WHERE id = ?  -- the GC SOV line for this sub
```

### File 3 Processing (Step 6):

For each classified File 3 page:
```
raw_extracted_fields            → INSERT (supporting doc fields)
supporting_document_items       → INSERT (classified + extracted + SOV line match attempt)
```

**SOV line matching:**
```sql
-- Attempt to match each supporting doc to a GC SOV line
SELECT id FROM gc_pay_application_sov_lines
WHERE package_id = ?
  AND (contractor_name LIKE ? OR type_of_work LIKE ?)
ORDER BY extraction_confidence DESC
LIMIT 1
```
If a match is found: `supporting_document_items.linked_sov_line_id = match.id`
If no match: `linked_sov_line_id = NULL` → will produce `MISSING_SUPPORT` exception

---

## 7. Validation & Reconciliation (Step 7 & 8)

**Trigger:** Automatic after Steps 5 and 6 complete.

### Step 7 — Cross-File Reconciliation:

```
validation_runs             → INSERT (run_status: RUNNING)
reconciliation_results      → INSERT × N per check type:
```

**Checks performed and table writes:**

| Check | reconciliation_type | Pass criteria |
|---|---|---|
| G703 arithmetic (D+E=F check, G/C=H, C-G=I) | MATH_CHECK | `ABS(computed - stored) ≤ math_tolerance_amt` |
| GC vs Sub amount | JV_VS_SUB | `ABS(work_completed_this - g703_work_this_period) ≤ cross_file_tolerance_amt` |
| Retainage rate | RETAINAGE_RATE | `retainage / scheduled_current = retainage_rate_pct / 100` |
| % complete range | PCT_COMPLETE | `pct ≤ max_pct_complete` |
| Period continuity | PERIOD_CONTINUITY | `this.work_completed_prev = prior.total_completed` (if prior package exists) |
| Cover vs G703 total | COVER_VS_G703 | G702 `total_completed_stored` = G703 column I grand total |

### Step 8 — Exception Assembly:

```sql
-- For every reconciliation_results row where passed = 0:
INSERT INTO exceptions (
    package_id, validation_run_id, exception_type_code,
    entity_type, entity_id, title, description,
    file1_value, file2_value, variance, dollar_at_risk,
    risk_rank, evidence_document_id, evidence_page_no,
    evidence_bbox_x, evidence_bbox_y, evidence_bbox_width, evidence_bbox_height
)
```

**Risk ranking algorithm:**
```
risk_rank = (severity_weight × 100) + (dollar_at_risk_percentile × 10) + exception_type_sort_order
-- BLOCKING exceptions rank 1–100
-- WARNING exceptions rank 101–500
-- Within each tier: higher $ at risk ranks higher (lower number)
```

**Exception group aggregation:**
```sql
INSERT INTO exception_groups (package_id, validation_run_id, exception_type_code, item_count, dollar_at_risk)
SELECT package_id, validation_run_id, exception_type_code, COUNT(*), SUM(dollar_at_risk)
FROM exceptions
WHERE validation_run_id = ?
GROUP BY exception_type_code
```

**Package summary update:**
```sql
UPDATE packages
SET total_items_extracted = (SELECT COUNT(*) FROM gc_pay_application_sov_lines WHERE package_id = ?),
    auto_cleared_count = total_items_extracted - exceptions_count,
    exceptions_count = (SELECT COUNT(*) FROM exceptions WHERE package_id = ? AND validation_run_id = ?),
    dollar_at_risk = (SELECT SUM(dollar_at_risk) FROM exceptions WHERE package_id = ? AND validation_run_id = ?)
WHERE id = ?
```

**State transition:** `packages.package_status` → `FILE_2_3_PROCESSING` → `PROCESSING_COMPLETE`

---

## 8. Exception Review Workflow (Screen 7)

**Trigger:** User clicks "Begin Review" on the Processing Complete Summary screen.

**On entering the workbench:**
```
packages            → UPDATE package_status: 'IN_REVIEW', reviewed_by: user_id, reviewed_at: NULL (not yet)
audit_events        → INSERT (event_type: REVIEW_STARTED)
```

**Each reviewer action:**

| User action | Tables written |
|---|---|
| View an exception | `review_action_logs` (action_type: VIEW_EXCEPTION) |
| Accept an exception | `exception_resolutions` (resolution_type: accepted) + `exceptions` (status: accepted) + `exception_groups` (resolved_count +1) + `review_action_logs` |
| Override an exception | `exception_resolutions` (resolution_type: overridden, comment REQUIRED) + `exceptions` (status: overridden) + target canonical table UPDATE + `data_change_logs` + `review_action_logs` |
| Escalate an exception | `exception_resolutions` (resolution_type: escalated) + `exceptions` (status: escalated) + `notifications` (to commercial_reviewer) + `review_action_logs` |
| Bulk accept a group | `exception_resolutions` × N (resolution_type: bulk_accepted) + `exceptions` × N (status: accepted) + `exception_groups` (resolved_count = item_count) + `review_action_logs` |
| View PDF evidence | `review_action_logs` (action_type: PDF_VIEWED, entity_id: exception_id) |

**Group resolution tracking:**
```sql
-- After each resolution, update the group:
UPDATE exception_groups
SET resolved_count = (
    SELECT COUNT(*) FROM exceptions
    WHERE exception_group_id = ? AND status != 'open'
),
status = CASE
    WHEN resolved_count = 0 THEN 'open'
    WHEN resolved_count < item_count THEN 'partially_resolved'
    ELSE 'resolved'
END
WHERE id = ?
```

**"Mark as Ready" button activation condition:**
```sql
SELECT COUNT(*) FROM exceptions
WHERE package_id = ? AND status = 'open'
-- Must return 0 before Mark as Ready is enabled
```

---

## 9. HITL Confirmation Gate (Screen 8)

**Trigger:** All exceptions resolved; user clicks "Mark as Ready for Validation."

**Tables written (in sequence):**
```
packages        → UPDATE package_status: 'HITL_COMPLETE', reviewed_by: user_id, reviewed_at: now()
audit_events    → INSERT (event_type: HITL_SUBMITTED)
                  event_summary JSON: {
                    auto_cleared: N,
                    accepted: N,
                    overridden: N,
                    escalated: N,
                    dollar_at_risk: N,
                    reviewer_name: "...",
                    timestamp: "..."
                  }
notifications   → INSERT (to finance_approver users: "Package ready for approval")
review_action_logs → INSERT (action_type: MARK_READY)
```

**Separation of duties enforcement:**
When Finance Approver submits approval:
```sql
SELECT reviewed_by FROM packages WHERE id = ?
-- Must differ from the approving user's ID
-- If same: API returns HTTP 403 "Approval by the reviewer is not permitted (separation of duties)"
```

**Approval write:**
```sql
UPDATE packages
SET package_status = 'APPROVED',  -- or 'APPROVED_WITH_EXCEPTIONS' or 'REJECTED'
    approved_by = ?,
    approved_at = datetime('now'),
    rejection_reason = ?  -- if REJECTED
WHERE id = ?

INSERT INTO audit_events (package_id, event_type, triggered_by, triggered_at, event_summary)
VALUES (?, 'APPROVED', ?, datetime('now'), ?)
```

---

## 10. Reporting & Audit Trace

**Trigger:** Auditor opens Audit Explorer and requests the full trace for a specific value.

**Query pattern for full value provenance trace:**
```sql
-- Step 1: Find the canonical record
SELECT * FROM gc_pay_application_sov_lines WHERE id = ?

-- Step 2: Find the raw extraction record
SELECT * FROM raw_extracted_fields
WHERE package_document_id IN (
    SELECT id FROM package_documents WHERE package_id = ?
)
AND field_name = 'work_completed_this'
AND page_no = ?

-- Step 3: Find any human edits
SELECT * FROM data_change_logs
WHERE entity_type = 'GC_SOV_LINE' AND entity_id = ?
ORDER BY changed_at

-- Step 4: Find exceptions related to this line
SELECT * FROM exceptions WHERE entity_type = 'GC_SOV_LINE' AND entity_id = ?

-- Step 5: Find resolutions on those exceptions
SELECT er.* FROM exception_resolutions er
JOIN exceptions e ON e.id = er.exception_id
WHERE e.entity_type = 'GC_SOV_LINE' AND e.entity_id = ?

-- Step 6: Find reviewer actions
SELECT * FROM review_action_logs
WHERE entity_type = 'GC_SOV_LINE' AND entity_id = ?
ORDER BY created_at
```

This trace chain satisfies BRD requirement S-52: "pick any value → one-click trace to page, math, decision, and user."

---

## Summary — Table Write Frequency by Flow

| Table | Setup | Intake | Classify | File1 | Plan | File2/3 | Validate | Review | HITL | Audit |
|---|---|---|---|---|---|---|---|---|---|---|
| `packages` | | W | | | | | W | W | W | R |
| `package_documents` | | W | W | | | | | | | R |
| `document_pages` | | | W | | | | | | | R |
| `processing_pipeline_steps` | | W | W | W | W | W | W | | | R |
| `raw_extracted_fields` | | | | W | | W | | | | R |
| `gc_pay_application_headers` | | | | W | | | | | | R |
| `gc_pay_application_sov_lines` | | | | W | | W | | W | | R |
| `agent_plans` | | | | | W | | | | | R |
| `agent_plan_items` | | | | | W | | | | | R |
| `sub_pay_application_headers` | | | | | | W | | | | R |
| `sub_pay_application_sov_lines` | | | | | | W | | | | R |
| `supporting_document_items` | | | | | | W | | | | R |
| `validation_runs` | | | | | | | W | | | R |
| `reconciliation_results` | | | | | | | W | | | R |
| `exception_groups` | | | | | | | W | W | | R |
| `exceptions` | | | | | | | W | W | | R |
| `exception_resolutions` | | | | | | | | W | | R |
| `review_action_logs` | | | | | W | | | W | W | R |
| `audit_events` | | W | | | W | | | | W | R |
| `activity_logs` | | W | W | W | W | W | W | | | R |
| `data_change_logs` | | | | | | | | W | | R |
| `notifications` | | | | | | | | | W | |

W = Write (INSERT/UPDATE) | R = Read-only in this flow

---

*Document continues in: [04_Security_Architecture.md](04_Security_Architecture.md)*
