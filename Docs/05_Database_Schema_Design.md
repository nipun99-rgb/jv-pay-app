# 05 — Database Schema Design

**Version:** 1.0 · July 1, 2026
**Owner:** Product Management & Architecture
**Status:** DRAFT — For Review & Sign-off
**Companion:** `04_Architecture_and_Data_Model.md` (C4 architecture), `03_User_Journeys.md` (12-stage spine)

---

## 1. Scope and Design Principles

### Scope
This document defines the **Wave 1 MVP schema** — 30 tables covering the full L2 User Journey (Screens 1–8 plus audit infrastructure). It is a **pragmatic subset** of the 96-table canonical model described in `04_Architecture_and_Data_Model.md`, designed to run on **SQLite for MVP** and migrate to **Azure SQL** in production.

### Design Decisions (captured from review session)
| Decision | Choice | Notes |
|---|---|---|
| Database (MVP) | SQLite | Migrate to Azure SQL for production |
| Database (prod target) | Azure SQL | 96-table canonical model per BRD |
| Authentication | Full RBAC + multi-tenant | Entra ID in production; email/role table in MVP |
| Contract management | Managed in this app | Not from external ERP |
| Exception types | Extensible via reference table | 4 baseline types + contract compliance; new types added without schema change |
| Bounding boxes | To be added to extraction pipeline | Not in current pipeline; schema designed for it |
| File 3 extraction | Classify + structured extraction | Receipts, invoices, delivery tickets |
| Period-over-period | Required validation rule | Packages linked month-over-month via contract |
| Scale | Multi-client | One client → many contracts → many packages/year |

### Architecture Principles (inherited from BRD)
1. **Raw is immutable.** Extracted values are never overwritten. Corrections are new records linked to raw.
2. **Deterministic money math.** All arithmetic, reconciliation, and validation runs in deterministic SQL/Python — never in an LLM.
3. **Audit by construction.** Every value carries evidence (document, page, bbox). Every change is logged.
4. **Extensible exceptions.** New exception types are rows in `ref_exception_types`, not schema changes.
5. **Point-in-time correctness.** Contract baselines are effective-dated; validation always selects the version-in-force.

---

## 2. Table Family Summary (30 tables)

| # | Table | Family | Maps from (existing) | Status |
|---|---|---|---|---|
| 1 | `clients` | Master | — | NEW |
| 2 | `users` | Master | — | NEW |
| 3 | `roles` | Master | — | NEW |
| 4 | `user_roles` | Master | — | NEW |
| 5 | `contracts` | Master | `projects` (partial) | NEW (replaces) |
| 6 | `contract_baseline_versions` | Master | — | NEW |
| 7 | `contract_sov_items` | Master | — | NEW |
| 8 | `vendors` | Master | — | NEW |
| 9 | `packages` | Transaction | `projects` (restructured) | RESTRUCTURED |
| 10 | `package_documents` | Transaction | `project_phases` (replaced) | RESTRUCTURED |
| 11 | `document_pages` | Transaction | — | NEW |
| 12 | `processing_pipeline_steps` | Transaction | `tasks` (replaced) | RESTRUCTURED |
| 13 | `agent_plans` | Transaction | — | NEW |
| 14 | `agent_plan_items` | Transaction | — | NEW |
| 15 | `raw_extracted_fields` | Staging | — | NEW |
| 16 | `gc_pay_application_headers` | Transaction | `cover_page` (renamed) | KEEP + EXTEND |
| 17 | `gc_pay_application_sov_lines` | Transaction | `line_items` (renamed) | KEEP + EXTEND |
| 18 | `sub_pay_application_headers` | Transaction | `subcontractor_applications` (renamed) | KEEP + EXTEND |
| 19 | `sub_pay_application_sov_lines` | Transaction | `sub_line_items` (renamed) | KEEP + EXTEND |
| 20 | `supporting_document_items` | Transaction | — | NEW |
| 21 | `validation_runs` | Transaction | — | NEW |
| 22 | `reconciliation_results` | Transaction | — | NEW |
| 23 | `ref_exception_types` | Reference | — | NEW |
| 24 | `exceptions` | Transaction | `line_items.validation_status` (extracted) | NEW |
| 25 | `exception_groups` | Transaction | — | NEW |
| 26 | `exception_resolutions` | Transaction | — | NEW |
| 27 | `review_action_logs` | Audit | — | NEW |
| 28 | `audit_events` | Audit | — | NEW |
| 29 | `activity_logs` | Audit | `logs` (renamed) | KEEP + EXTEND |
| 30 | `data_change_logs` | Audit | — | NEW |

---

## 3. Entity Relationship (conceptual)

```
CLIENT
 └── CONTRACT
      ├── CONTRACT_BASELINE_VERSION (effective-dated, versioned)
      │    └── CONTRACT_SOV_ITEMS
      └── PACKAGE (one per billing period)
           ├── PACKAGE_DOCUMENTS (up to 3 files)
           │    └── DOCUMENT_PAGES → RAW_EXTRACTED_FIELDS
           ├── PROCESSING_PIPELINE_STEPS (9 steps)
           ├── AGENT_PLAN → AGENT_PLAN_ITEMS → VENDOR
           ├── GC_PAY_APPLICATION_HEADER (File 1 G702)
           ├── GC_PAY_APPLICATION_SOV_LINES (File 1 G703)
           ├── SUB_PAY_APPLICATION_HEADERS (File 2, one per sub)
           │    └── SUB_PAY_APPLICATION_SOV_LINES
           ├── SUPPORTING_DOCUMENT_ITEMS (File 3)
           ├── VALIDATION_RUN
           │    ├── RECONCILIATION_RESULTS
           │    ├── EXCEPTION_GROUPS
           │    └── EXCEPTIONS → EXCEPTION_RESOLUTIONS
           └── AUDIT: activity_logs · audit_events · review_action_logs · data_change_logs

USER ←→ USER_ROLES ←→ ROLES
VENDOR (master data, client-scoped)
REF_EXCEPTION_TYPES (reference, extensible)
```

---

## 4. Full Schema — DDL (SQLite-compatible)

> **Convention note:** Column types use SQLite affinities (TEXT, INTEGER, REAL). When migrating to Azure SQL, map TEXT → NVARCHAR, REAL → DECIMAL(18,2), INTEGER PK → BIGINT IDENTITY(1,1), datetime TEXT → DATETIME2(3).

---

### FAMILY 1 — MASTER

#### Table 1: `clients`
```sql
CREATE TABLE IF NOT EXISTS clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    NOT NULL UNIQUE,          -- short identifier, e.g. "ACME-GC"
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);
```

#### Table 2: `users`
```sql
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id      INTEGER REFERENCES clients(id),  -- NULL = platform admin
  email          TEXT    NOT NULL UNIQUE,
  display_name   TEXT    NOT NULL,
  password_hash  TEXT,                            -- MVP only; replace with Entra ID token in prod
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);
```

#### Table 3: `roles`
```sql
CREATE TABLE IF NOT EXISTS roles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  -- Seed values: invoice_reviewer, finance_approver, commercial_reviewer,
  --              data_steward, system_admin, auditor, viewer
  display_name TEXT NOT NULL,
  description  TEXT
);
```

#### Table 4: `user_roles`
```sql
CREATE TABLE IF NOT EXISTS user_roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  role_id     INTEGER NOT NULL REFERENCES roles(id),
  client_id   INTEGER REFERENCES clients(id),      -- scopes role to a client; NULL = all clients
  granted_by  INTEGER REFERENCES users(id),
  granted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, role_id, client_id)
);
```

#### Table 5: `contracts`
> Replaces and supersedes the `projects` table.

```sql
CREATE TABLE IF NOT EXISTS contracts (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id              INTEGER NOT NULL REFERENCES clients(id),
  contract_no            TEXT,                        -- human-readable contract number
  contract_name          TEXT NOT NULL,
  contractor_name        TEXT,                        -- General Contractor name
  project_description    TEXT,
  contract_start_date    TEXT,
  contract_end_date      TEXT,
  original_contract_sum  REAL,
  is_active              INTEGER NOT NULL DEFAULT 1,
  created_by             INTEGER REFERENCES users(id),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT
);
```

#### Table 6: `contract_baseline_versions`
> Implements the living-baseline pattern from `04_Architecture_and_Data_Model.md` §6.

```sql
CREATE TABLE IF NOT EXISTS contract_baseline_versions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id          INTEGER NOT NULL REFERENCES contracts(id),
  version_no           INTEGER NOT NULL,
  effective_from       TEXT    NOT NULL,              -- DATE: first billing period this version governs
  effective_to         TEXT,                          -- NULL = currently in force
  change_source_type   TEXT,                          -- INITIAL | AMENDMENT | CHANGE_ORDER
  change_source_ref    TEXT,                          -- CO number, addendum reference
  approval_status      TEXT    NOT NULL DEFAULT 'DRAFT',  -- DRAFT | APPROVED | SUPERSEDED
  contract_sum_to_date REAL,                          -- updated by each approved CO
  approved_by          INTEGER REFERENCES users(id),
  approved_at          TEXT,
  notes                TEXT,
  created_by           INTEGER REFERENCES users(id),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(contract_id, version_no)
);
-- Constraint: effective windows must not overlap (enforced at application layer + pre-activation check)
```

#### Table 7: `contract_sov_items`
> Schedule of Values per baseline version — the contract-level truth for billability checks.

```sql
CREATE TABLE IF NOT EXISTS contract_sov_items (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  baseline_version_id  INTEGER NOT NULL REFERENCES contract_baseline_versions(id),
  item_no              TEXT,
  description          TEXT,
  phases               TEXT,
  type_of_work         TEXT,
  scheduled_value      REAL    NOT NULL DEFAULT 0,
  change_order_adj     REAL    DEFAULT 0,             -- net CO adjustments to this line
  current_value        REAL    NOT NULL DEFAULT 0,    -- scheduled_value + change_order_adj
  is_active            INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Table 8: `vendors`
> Master data for subcontractors and suppliers. Proposed from extraction; approved by Data Steward (Wave 2).

```sql
CREATE TABLE IF NOT EXISTS vendors (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id      INTEGER NOT NULL REFERENCES clients(id),
  canonical_name TEXT    NOT NULL,
  aliases        TEXT,                               -- JSON array of known name variants
  vendor_type    TEXT    DEFAULT 'SUBCONTRACTOR',    -- SUBCONTRACTOR | SUPPLIER | OTHER
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_by     INTEGER REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);
```

---

### FAMILY 2 — REFERENCE

#### Table 23: `ref_exception_types`
> Defines all exception types. New types are inserted here — no schema change needed.

```sql
CREATE TABLE IF NOT EXISTS ref_exception_types (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description  TEXT,
  severity     TEXT NOT NULL DEFAULT 'WARNING',  -- BLOCKING | WARNING | INFO
  routing      TEXT NOT NULL DEFAULT 'REVIEWER', -- REVIEWER | COMMERCIAL | FINANCE | AUTO_CLEAR
  is_active    INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER DEFAULT 99
);

-- Seed data (Wave 1 baseline exception types):
INSERT OR IGNORE INTO ref_exception_types (code, display_name, description, severity, routing, sort_order) VALUES
  ('MATH_ERROR',          'Math Error',                 'Arithmetic check failed (e.g. G + D ≠ E)', 'BLOCKING', 'REVIEWER', 1),
  ('FILE1_VS_FILE2',      'Amount Variance (File 1 vs File 2)', 'GC-billed amount differs from sub-extracted amount beyond tolerance', 'WARNING', 'REVIEWER', 2),
  ('LOW_CONFIDENCE',      'Low Confidence Extraction',  'OCR/AI confidence below threshold for this field', 'WARNING', 'REVIEWER', 3),
  ('MISSING_SUPPORT',     'Missing Evidence (File 3)',  'Line item has no matching supporting document', 'WARNING', 'REVIEWER', 4),
  ('CONTRACT_RATE',       'Rate Mismatch',              'Billed rate differs from contract rate card', 'BLOCKING', 'COMMERCIAL', 5),
  ('CONTRACT_SCOPE',      'Out-of-Scope Billing',       'Item billed outside contracted scope', 'BLOCKING', 'COMMERCIAL', 6),
  ('CONTRACT_RETAINAGE',  'Retainage Deviation',        'Retainage rate differs from contract terms', 'WARNING', 'COMMERCIAL', 7),
  ('PERIOD_CONTINUITY',   'Period Continuity Break',    'Prev-period total from prior package does not match this period prev column', 'BLOCKING', 'REVIEWER', 8),
  ('DUPLICATE',           'Potential Duplicate Billing','Same item appears to have been billed in a prior period', 'BLOCKING', 'REVIEWER', 9),
  ('PCT_OVER_100',        'Completion > 100%',          'Percentage complete exceeds 100%', 'BLOCKING', 'REVIEWER', 10);
```

---

### FAMILY 3 — TRANSACTION: PACKAGES & DOCUMENTS

#### Table 9: `packages`
> Core operational entity — one per billing period per contract. Replaces and supersedes `projects`.

```sql
CREATE TABLE IF NOT EXISTS packages (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id             INTEGER NOT NULL REFERENCES clients(id),
  contract_id           INTEGER NOT NULL REFERENCES contracts(id),
  baseline_version_id   INTEGER REFERENCES contract_baseline_versions(id),  -- set after processing
  billing_period_month  INTEGER NOT NULL CHECK (billing_period_month BETWEEN 1 AND 12),
  billing_period_year   INTEGER NOT NULL,
  billing_period_label  TEXT,                              -- e.g. "June 2026" (computed)
  package_status        TEXT NOT NULL DEFAULT 'DRAFT',
  -- Package status machine:
  -- DRAFT → INGESTING → FILE_1_PROCESSING → AWAITING_PLAN_CONFIRMATION
  -- → FILE_2_3_PROCESSING → PROCESSING_COMPLETE → IN_REVIEW → HITL_COMPLETE
  -- → IN_VALIDATION → APPROVED | REJECTED
  file_hash_1           TEXT,                              -- SHA-256 of File 1, for duplicate detection
  file_hash_2           TEXT,
  file_hash_3           TEXT,
  submitted_by          INTEGER REFERENCES users(id),
  submitted_at          TEXT,
  reviewed_by           INTEGER REFERENCES users(id),
  reviewed_at           TEXT,
  approved_by           INTEGER REFERENCES users(id),
  approved_at           TEXT,
  created_by            INTEGER REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT,
  UNIQUE(contract_id, billing_period_month, billing_period_year)
  -- One package per contract per billing period enforced at DB level
);
```

#### Table 10: `package_documents`
> Tracks the three file uploads per package. Replaces `project_phases`.

```sql
CREATE TABLE IF NOT EXISTS package_documents (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id                INTEGER NOT NULL REFERENCES packages(id),
  file_role                 TEXT    NOT NULL,
  -- FILE_1_GC_COVER | FILE_2_SUBS | FILE_3_SUPPORT
  original_filename         TEXT,
  stored_path               TEXT,
  file_size_bytes           INTEGER,
  page_count                INTEGER,
  file_hash                 TEXT,
  upload_status             TEXT NOT NULL DEFAULT 'PENDING',
  -- PENDING | RECEIVED | CLASSIFIED | QUARANTINED | ERROR
  classification_result     TEXT,                          -- detected document type
  classification_confidence REAL,
  uploaded_at               TEXT,
  uploaded_by               INTEGER REFERENCES users(id),
  UNIQUE(package_id, file_role)
);
```

#### Table 11: `document_pages`
> Page-level metadata, enabling bounding-box addressing for the Evidence Viewer.

```sql
CREATE TABLE IF NOT EXISTS document_pages (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  package_document_id       INTEGER NOT NULL REFERENCES package_documents(id),
  page_no                   INTEGER NOT NULL,
  width_pts                 REAL,
  height_pts                REAL,
  ocr_text                  TEXT,
  classification            TEXT,     -- G702 | G703 | SUB_COVER | SUB_G703 | RECEIPT | INVOICE | DELIVERY_TICKET | UNKNOWN
  classification_confidence REAL,
  UNIQUE(package_document_id, page_no)
);
```

#### Table 12: `processing_pipeline_steps`
> 9-step pipeline state machine per package. Replaces `tasks` (which had 4 hardcoded steps).

```sql
CREATE TABLE IF NOT EXISTS processing_pipeline_steps (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id           INTEGER NOT NULL REFERENCES packages(id),
  step_no              INTEGER NOT NULL,
  step_name            TEXT    NOT NULL,
  -- Step catalogue:
  -- 1: File Upload & Receipt
  -- 2: Preliminary Classification
  -- 3: Extract GC Cover + G703
  -- 4: Agent Plan: Sub-Contractor Confirmation  ← PAUSE POINT (user gate)
  -- 5: Extract File 2: Sub-Contractor Invoices
  -- 6: Extract File 3: Supporting Documents
  -- 7: Cross-File Reconciliation
  -- 8: Exception Assembly & Risk Ranking
  -- 9: Ready for Review
  status               TEXT NOT NULL DEFAULT 'pending',
  -- pending | running | paused | complete | error
  sub_progress_current INTEGER,                            -- e.g. 8 (of 14 subs done)
  sub_progress_total   INTEGER,                            -- e.g. 14
  sub_progress_label   TEXT,                              -- e.g. "Delta Plumbing Inc (pages 19–24)"
  started_at           TEXT,
  completed_at         TEXT,
  error_message        TEXT,
  UNIQUE(package_id, step_no)
);
```

---

### FAMILY 4 — TRANSACTION: AGENT PLAN (Screen 4)

#### Table 13: `agent_plans`
> Immutable record of the confirmed sub-contractor list. Created when user clicks "Confirm & Proceed to File 2".

```sql
CREATE TABLE IF NOT EXISTS agent_plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id    INTEGER NOT NULL UNIQUE REFERENCES packages(id),
  confirmed_by  INTEGER NOT NULL REFERENCES users(id),
  confirmed_at  TEXT    NOT NULL,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  -- Immutability enforced: no UPDATE/DELETE permitted after creation (application-layer rule)
);
```

#### Table 14: `agent_plan_items`
> Individual sub-contractor rows in the confirmed plan. Audit source for all subsequent extraction.

```sql
CREATE TABLE IF NOT EXISTS agent_plan_items (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_plan_id         INTEGER NOT NULL REFERENCES agent_plans(id),
  seq_no                INTEGER NOT NULL,
  subcontractor_name    TEXT    NOT NULL,
  expected_app_no       TEXT,
  billed_amount_file1   REAL,
  vendor_id             INTEGER REFERENCES vendors(id),     -- resolved to master vendor, if matched
  source                TEXT NOT NULL DEFAULT 'AGENT',      -- AGENT | MANUAL
  is_manually_added     INTEGER NOT NULL DEFAULT 0,         -- 1 = user added; no File 1 evidence
  notes                 TEXT
);
```

---

### FAMILY 5 — STAGING: RAW EXTRACTION (immutable)

#### Table 15: `raw_extracted_fields`
> Append-only store of every raw field extracted by the AI agent, with bounding-box coordinates.
> These records are NEVER modified. Corrections create canonical records + data_change_log entries.

```sql
CREATE TABLE IF NOT EXISTS raw_extracted_fields (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  package_document_id    INTEGER NOT NULL REFERENCES package_documents(id),
  agent_run_id           TEXT,                              -- UUID of the extraction agent run
  page_no                INTEGER,
  field_name             TEXT,
  raw_value              TEXT,
  normalized_value       TEXT,
  bbox_x                 REAL,                             -- bounding box: x (points from left)
  bbox_y                 REAL,                             -- bounding box: y (points from top)
  bbox_width             REAL,
  bbox_height            REAL,
  extraction_confidence  REAL,                             -- 0.00–1.00
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

### FAMILY 6 — TRANSACTION: CONTRACTOR DATA (File 1)

#### Table 16: `gc_pay_application_headers`
> G702 Cover Page. Renamed from `cover_page`. One row per package.

```sql
CREATE TABLE IF NOT EXISTS gc_pay_application_headers (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id               INTEGER NOT NULL UNIQUE REFERENCES packages(id),
  agent_run_id             TEXT,                            -- links to extraction run
  -- ── G702 fields ──
  to_owner                 TEXT,
  from_contractor          TEXT,
  project_name             TEXT,
  application_no           TEXT,
  period                   TEXT,
  period_from              TEXT,
  period_to                TEXT,
  original_contract_sum    REAL,
  net_change_orders        REAL,
  contract_sum_to_date     REAL,
  total_completed_stored   REAL,
  retainage_completed      REAL,
  retainage_materials      REAL,
  total_retainage          REAL,
  total_earned_less_ret    REAL,
  less_prev_certificates   REAL,
  current_payment_due      REAL,
  balance_to_finish        REAL,
  change_order_summary     TEXT,
  architect_signature      TEXT,
  contractor_signature     TEXT,
  -- ── Evidence ──
  source_page              INTEGER,
  extraction_confidence    REAL,
  bbox_x                   REAL,
  bbox_y                   REAL,
  bbox_width               REAL,
  bbox_height              REAL,
  -- ── Review ──
  review_notes             TEXT,
  validation_status        TEXT NOT NULL DEFAULT 'unchecked',
  -- unchecked | checking | valid | warning | pending_review
  validation_notes         TEXT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT
);
```

#### Table 17: `gc_pay_application_sov_lines`
> G703 Continuation Sheet rows. Renamed from `line_items`. Extended with bbox + cross-file columns.

```sql
CREATE TABLE IF NOT EXISTS gc_pay_application_sov_lines (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id              INTEGER NOT NULL REFERENCES packages(id),
  baseline_sov_item_id    INTEGER REFERENCES contract_sov_items(id),  -- link to contract SOV
  -- ── G703 fields ──
  item_no                 TEXT,
  time_period             TEXT,
  phases                  TEXT,
  type_of_work            TEXT,
  contractor_name         TEXT,                          -- sub-contractor billed in this line
  scheduled_original      REAL DEFAULT 0,
  scheduled_change_orders REAL DEFAULT 0,
  scheduled_current       REAL DEFAULT 0,
  work_completed_prev     REAL DEFAULT 0,
  work_completed_this     REAL DEFAULT 0,
  materials_stored        REAL DEFAULT 0,
  total_completed         REAL DEFAULT 0,
  pct                     TEXT,
  balance_to_finish       REAL DEFAULT 0,
  retainage               REAL DEFAULT 0,
  -- ── Cross-file comparison (populated after File 2 extraction) ──
  file2_extracted_amount  REAL,                         -- matched sub amount from File 2
  cross_file_variance     REAL,                         -- work_completed_this - file2_extracted_amount
  -- ── Evidence ──
  source_page             INTEGER,
  extraction_confidence   REAL,
  bbox_page               INTEGER,
  bbox_x                  REAL,
  bbox_y                  REAL,
  bbox_width              REAL,
  bbox_height             REAL,
  -- ── Review ──
  review_notes            TEXT,
  validation_status       TEXT NOT NULL DEFAULT 'unchecked',
  validation_note         TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT
);
```

---

### FAMILY 7 — TRANSACTION: SUB DATA (File 2)

#### Table 18: `sub_pay_application_headers`
> Sub-contractor G702 Cover. Renamed from `subcontractor_applications`. Extended with foreign keys.

```sql
CREATE TABLE IF NOT EXISTS sub_pay_application_headers (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id                  INTEGER NOT NULL REFERENCES packages(id),
  agent_plan_item_id          INTEGER REFERENCES agent_plan_items(id),  -- links to confirmed plan
  vendor_id                   INTEGER REFERENCES vendors(id),
  -- ── Identification ──
  seq_id                      INTEGER,
  start_page                  INTEGER,
  end_page                    INTEGER,
  document_type               TEXT,
  document_category           TEXT,
  subcontractor_name          TEXT,
  application_no              TEXT,
  application_date            TEXT,
  period_from                 TEXT,
  period_to                   TEXT,
  invoice_to                  TEXT,
  project_name_on_doc         TEXT,
  contract_po_number          TEXT,
  -- ── G702 financials ──
  original_contract_sum       REAL,
  net_change_orders           REAL,
  contract_sum_to_date        REAL,
  total_completed_stored      REAL,
  completed_work_this_period  REAL,
  total_retainage             REAL,
  retainage_percent           REAL,
  total_earned_less_retainage REAL,
  less_prev_certificates      REAL,
  current_payment_due         REAL,
  balance_to_finish           REAL,
  -- ── G703 grand totals (from continuation sheet footer) ──
  g703_scheduled_value        REAL,
  g703_work_prev              REAL,
  g703_work_this_period       REAL,
  g703_materials_stored       REAL,
  g703_total_completed        REAL,
  g703_retainage              REAL,
  g703_earned_less_ret        REAL,
  g703_balance_to_finish      REAL,
  -- ── Signatures & compliance ──
  recon_flag                  TEXT,
  contractor_signature        TEXT,
  architect_signature         TEXT,
  notarized                   TEXT,
  additional_supporting_docs  TEXT,
  -- ── Evidence ──
  extraction_confidence       REAL,
  -- ── Review ──
  validation_status           TEXT NOT NULL DEFAULT 'unchecked',
  validation_note             TEXT,
  raw_json                    TEXT,                        -- full raw extraction payload
  created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                  TEXT
);
```

#### Table 19: `sub_pay_application_sov_lines`
> Sub-contractor G703 continuation sheet rows. Renamed from `sub_line_items`. Extended with bbox.

```sql
CREATE TABLE IF NOT EXISTS sub_pay_application_sov_lines (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id             INTEGER NOT NULL REFERENCES packages(id),
  sub_app_id             INTEGER NOT NULL REFERENCES sub_pay_application_headers(id),
  -- ── G703 fields ──
  source_page            INTEGER,
  item_no                TEXT,
  description            TEXT,
  scheduled_value        REAL,
  work_completed_prev    REAL,
  work_completed_this    REAL,
  materials_stored       REAL,
  total_completed        REAL,
  pct_complete           REAL,
  retainage              REAL,
  balance_to_finish      REAL,
  -- ── Evidence ──
  extraction_confidence  REAL,
  bbox_page              INTEGER,
  bbox_x                 REAL,
  bbox_y                 REAL,
  bbox_width             REAL,
  bbox_height            REAL,
  -- ── Review ──
  validation_status      TEXT NOT NULL DEFAULT 'unchecked',
  validation_note        TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT
);
```

---

### FAMILY 8 — TRANSACTION: SUPPORTING DOCS (File 3)

#### Table 20: `supporting_document_items`
> Structured data extracted from File 3 (receipts, invoices, delivery tickets). New table.

```sql
CREATE TABLE IF NOT EXISTS supporting_document_items (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id            INTEGER NOT NULL REFERENCES packages(id),
  package_document_id   INTEGER NOT NULL REFERENCES package_documents(id),
  page_no               INTEGER,
  document_type         TEXT,     -- RECEIPT | INVOICE | DELIVERY_TICKET | TIMESHEET | OTHER
  vendor_name           TEXT,
  invoice_date          TEXT,
  invoice_no            TEXT,
  description           TEXT,
  amount                REAL,
  currency              TEXT NOT NULL DEFAULT 'USD',
  -- ── Matching (to G703 SOV line) ──
  linked_sov_line_id    INTEGER REFERENCES gc_pay_application_sov_lines(id),  -- null if unmatched
  match_confidence      REAL,
  -- ── Evidence ──
  extraction_confidence REAL,
  bbox_page             INTEGER,
  bbox_x                REAL,
  bbox_y                REAL,
  bbox_width            REAL,
  bbox_height           REAL,
  -- ── Review ──
  validation_status     TEXT NOT NULL DEFAULT 'unchecked',
  validation_note       TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT
);
```

---

### FAMILY 9 — TRANSACTION: VALIDATION

#### Table 21: `validation_runs`
> One row per execution of the validation engine against a package. Multiple runs are preserved.

```sql
CREATE TABLE IF NOT EXISTS validation_runs (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id           INTEGER NOT NULL REFERENCES packages(id),
  baseline_version_id  INTEGER REFERENCES contract_baseline_versions(id),
  run_status           TEXT NOT NULL DEFAULT 'RUNNING',  -- RUNNING | COMPLETE | FAILED
  run_started_at       TEXT NOT NULL DEFAULT (datetime('now')),
  run_completed_at     TEXT,
  total_items          INTEGER,
  auto_cleared_count   INTEGER,
  exceptions_count     INTEGER,
  dollar_at_risk       REAL,
  error_message        TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Table 22: `reconciliation_results`
> Output of the deterministic reconciliation engine (Stage 6 of the 12-stage spine).

```sql
CREATE TABLE IF NOT EXISTS reconciliation_results (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id            INTEGER NOT NULL REFERENCES packages(id),
  validation_run_id     INTEGER NOT NULL REFERENCES validation_runs(id),
  reconciliation_type   TEXT NOT NULL,
  -- JV_VS_SUB           : GC G703 line vs sub application amount
  -- PERIOD_CONTINUITY   : this period's "prev" = prior package's "total_completed"
  -- CONTRACT_SOV        : billed line vs contract SOV scheduled value
  -- MATH_CHECK          : G703 arithmetic (D+E+F=G, G/C=H, C-G=I)
  -- RETAINAGE_RATE      : actual retainage % vs contracted rate
  entity_type           TEXT,    -- GC_SOV_LINE | SUB_HEADER | GC_HEADER
  entity_id             INTEGER,
  jv_amount             REAL,
  sub_amount            REAL,
  expected_amount       REAL,    -- contract / prior-period expected value
  variance              REAL,
  tolerance_applied     REAL,
  passed                INTEGER NOT NULL,  -- 1 = pass, 0 = fail
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Table 24: `exceptions`
> Risk-ranked exceptions produced by the exception assembly agent (Stage 9).

```sql
CREATE TABLE IF NOT EXISTS exceptions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id            INTEGER NOT NULL REFERENCES packages(id),
  validation_run_id     INTEGER NOT NULL REFERENCES validation_runs(id),
  exception_group_id    INTEGER REFERENCES exception_groups(id),
  exception_type_code   TEXT    NOT NULL REFERENCES ref_exception_types(code),
  -- ── Entity this exception is about ──
  entity_type           TEXT,    -- GC_SOV_LINE | SUB_HEADER | SUB_SOV_LINE | GC_HEADER | SUPPORT_DOC
  entity_id             INTEGER,
  -- ── Content ──
  title                 TEXT    NOT NULL,
  description           TEXT,
  file1_value           REAL,
  file2_value           REAL,
  expected_value        REAL,
  variance              REAL,
  dollar_at_risk        REAL,
  extraction_confidence REAL,
  risk_rank             INTEGER,            -- lower = higher risk; used to sort worklist
  -- ── Status ──
  status                TEXT NOT NULL DEFAULT 'open',
  -- open | accepted | overridden | escalated | auto_cleared
  -- ── Evidence (primary evidence reference for the Evidence Viewer) ──
  evidence_document_id  INTEGER REFERENCES package_documents(id),
  evidence_page_no      INTEGER,
  evidence_bbox_x       REAL,
  evidence_bbox_y       REAL,
  evidence_bbox_width   REAL,
  evidence_bbox_height  REAL,
  -- ── File 2 evidence (for FILE1_VS_FILE2 exceptions) ──
  evidence2_document_id INTEGER REFERENCES package_documents(id),
  evidence2_page_no     INTEGER,
  evidence2_bbox_x      REAL,
  evidence2_bbox_y      REAL,
  evidence2_bbox_width  REAL,
  evidence2_bbox_height REAL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT
);
```

#### Table 25: `exception_groups`
> Groups exceptions of the same type for the Exceptions Navigator (Screen 7 Zone A).

```sql
CREATE TABLE IF NOT EXISTS exception_groups (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id           INTEGER NOT NULL REFERENCES packages(id),
  validation_run_id    INTEGER NOT NULL REFERENCES validation_runs(id),
  exception_type_code  TEXT NOT NULL REFERENCES ref_exception_types(code),
  display_label        TEXT NOT NULL,
  item_count           INTEGER NOT NULL DEFAULT 0,
  resolved_count       INTEGER NOT NULL DEFAULT 0,
  dollar_at_risk       REAL    NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'open',  -- open | partially_resolved | resolved
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT
);
```

---

### FAMILY 10 — REVIEW

#### Table 26: `exception_resolutions`
> Reviewer decisions (Accept / Override / Escalate) per exception. Append-only.

```sql
CREATE TABLE IF NOT EXISTS exception_resolutions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_id    INTEGER NOT NULL REFERENCES exceptions(id),
  resolved_by     INTEGER NOT NULL REFERENCES users(id),
  resolved_at     TEXT    NOT NULL,
  resolution_type TEXT    NOT NULL,   -- accepted | overridden | escalated | bulk_accepted
  override_value  REAL,               -- new value if overridden
  comment         TEXT,               -- mandatory for overridden/escalated
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Table 27: `review_action_logs`
> Append-only log of every reviewer action in the Workbench. Supports full audit trace.

```sql
CREATE TABLE IF NOT EXISTS review_action_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id   INTEGER NOT NULL REFERENCES packages(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  action_type  TEXT NOT NULL,
  -- VIEW_EXCEPTION | ACCEPT | OVERRIDE | ESCALATE | BULK_ACCEPT | BULK_OVERRIDE
  -- MARK_READY | PDF_VIEWED | FILTER_CHANGED
  entity_type  TEXT,
  entity_id    INTEGER,
  before_value TEXT,   -- JSON snapshot of the value before the action
  after_value  TEXT,   -- JSON snapshot of the value after the action
  comment      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

### FAMILY 11 — AUDIT

#### Table 28: `audit_events`
> Key lifecycle events for the package (HITL gate confirmation, package approval, etc.).

```sql
CREATE TABLE IF NOT EXISTS audit_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id    INTEGER NOT NULL REFERENCES packages(id),
  event_type    TEXT NOT NULL,
  -- PACKAGE_CREATED | FILES_UPLOADED | PROCESSING_STARTED
  -- PLAN_CONFIRMED | REVIEW_STARTED | HITL_SUBMITTED
  -- APPROVED | APPROVED_WITH_EXCEPTIONS | REJECTED
  triggered_by  INTEGER NOT NULL REFERENCES users(id),
  triggered_at  TEXT    NOT NULL,
  event_summary TEXT,   -- JSON: { auto_cleared, accepted, overridden, escalated, $ at risk }
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Table 29: `activity_logs`
> Human-language Activity Feed messages (Screens 2–5). Renamed from `logs`. Extended with step context.

```sql
CREATE TABLE IF NOT EXISTS activity_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id  INTEGER NOT NULL REFERENCES packages(id),
  level       TEXT NOT NULL DEFAULT 'info',
  -- info | success | warn | error | step | progress
  step_no     INTEGER,    -- which pipeline step this message belongs to (1–9)
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Table 30: `data_change_logs`
> Every human edit to an extracted value. Raw extraction stays immutable; this captures the delta.

```sql
CREATE TABLE IF NOT EXISTS data_change_logs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  package_id     INTEGER NOT NULL REFERENCES packages(id),
  entity_type    TEXT NOT NULL,
  -- GC_HEADER | GC_SOV_LINE | SUB_HEADER | SUB_SOV_LINE | SUPPORT_DOC
  entity_id      INTEGER NOT NULL,
  field_name     TEXT NOT NULL,
  original_value TEXT,
  new_value      TEXT,
  changed_by     INTEGER NOT NULL REFERENCES users(id),
  changed_at     TEXT    NOT NULL,
  reason         TEXT,    -- mandatory comment explaining the change
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 5. Migration Plan — Existing Tables to New Schema

| Existing Table | Action | New Table(s) |
|---|---|---|
| `projects` | **RETIRE** — data migrated | → `contracts` (name, baseline) + `packages` (1 package per existing project) |
| `tasks` | **RETIRE** — data migrated | → `processing_pipeline_steps` (9 steps, not 4) |
| `cover_page` | **RENAME + EXTEND** | → `gc_pay_application_headers` |
| `line_items` | **RENAME + EXTEND** | → `gc_pay_application_sov_lines` |
| `subcontractor_applications` | **RENAME + EXTEND** | → `sub_pay_application_headers` |
| `sub_line_items` | **RENAME + EXTEND** | → `sub_pay_application_sov_lines` |
| `project_phases` | **RETIRE** — data migrated | → `package_documents` |
| `logs` | **RENAME + EXTEND** | → `activity_logs` |

### Migration steps (additive — no data loss)
1. Create all new tables in the existing `db.js` `getDb()` init block.
2. Run a one-time migration script:
   - For each `project`: create one `contracts` row + one `packages` row.
   - For each `task`: create a `processing_pipeline_steps` row (re-mapped step numbers).
   - For each `project_phases` row: create a `package_documents` row.
3. In application code, replace all references to old table names with new names.
4. Leave old tables intact until E2E tests pass against new schema, then drop.

---

## 6. Standard Column Pattern

Apply to all tables on migration to Azure SQL:

```sql
-- All tables:
CreatedAtUtc   DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
CreatedBy      NVARCHAR(150) NULL      -- user email or system agent ID
UpdatedAtUtc   DATETIME2(3) NULL
UpdatedBy      NVARCHAR(150) NULL
IsActive       BIT NOT NULL DEFAULT 1
RecordVersion  INT NOT NULL DEFAULT 1  -- optimistic concurrency

-- All extraction/AI-populated tables:
AgentRunId            UNIQUEIDENTIFIER NULL
ExtractionConfidence  DECIMAL(5,2) NULL
ValidationStatusCode  NVARCHAR(50) NULL
ReviewStatusCode      NVARCHAR(50) NULL
SourceDocumentId      BIGINT NULL
SourcePageNo          INT NULL
```

---

## 7. Key Integrity Rules (enforced at application layer)

1. **One package per contract per billing period.** `UNIQUE(contract_id, billing_period_month, billing_period_year)` on `packages`.
2. **One agent plan per package.** `UNIQUE(package_id)` on `agent_plans`. Plan is immutable once confirmed — no UPDATE/DELETE.
3. **Effective baseline windows must not overlap.** Checked before activating a new `contract_baseline_versions` row.
4. **Separation of duties.** `packages.approved_by ≠ packages.reviewed_by`. Enforced in the `/packages/{id}/approve` API handler.
5. **Exception must have evidence.** Every `exceptions` row must have a valid `evidence_document_id`. No unexplained exceptions.
6. **Override requires a comment.** `exception_resolutions.comment IS NOT NULL` when `resolution_type = 'overridden'` or `'escalated'`. Enforced at API layer.
7. **Raw extraction is immutable.** `raw_extracted_fields` rows: no UPDATE or DELETE. Corrections write to canonical tables + `data_change_logs`.
8. **% complete ≤ 100%.** Enforced as a MATH_CHECK reconciliation result + BLOCKING exception.
9. **Package status transitions are one-way.** State machine transitions validated in the package status update API.
10. **Period continuity.** On creation of a new package, the system checks whether a prior-period package exists for the same contract and seeds the `PERIOD_CONTINUITY` reconciliation check.

---

## 8. Open Items / Wave 2 Tables (not in MVP)

| # | Table | Purpose | Wave |
|---|---|---|---|
| 1 | `master_data_candidates` | Proposed new vendors from extraction; Data Steward approval queue | 2 |
| 2 | `budget_baseline_versions` | Project cost budget, independently versioned | 2 |
| 3 | `cost_to_complete_snapshots` | ETC / EAC / VAC computations | 3 |
| 4 | `contract_rate_cards` | Billable rate schedule per contract version | 2 |
| 5 | `contract_reimbursable_terms` | Reimbursable cost rules | 2 |
| 6 | `change_orders` | CO records linked to baseline version bumps | 2 |
| 7 | `ground_truth_labels` | Labeled golden dataset for AI accuracy evaluation | 2 |
| 8 | `user_feedback_logs` | AI correction feedback for learning loop | 2 |
| 9 | `duplicate_candidates` | Potential duplicate billing cross-period | 2 |
| 10 | `validation_rule_configs` | Configurable tolerance + routing rules per client | 2 |

---

## 9. Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-01 | PM + Architecture | Initial draft — 30-table Wave 1 MVP schema |
