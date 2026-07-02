# Database Schema Design — Invoice Validation & Review Platform
## Document 02: Complete Table Definitions

**Document Version:** 1.0
**Date:** 2 July 2026
**Prepared by:** Senior Database Architect, EY
**Status:** OFFICIAL DESIGN REFERENCE — For Implementation

---

## Notation

| Symbol | Meaning |
|---|---|
| PK | Primary Key |
| FK | Foreign Key |
| NN | NOT NULL |
| UQ | Unique Constraint |
| DEF | Default Value |
| IDX | Indexed |

All SQLite column types are shown. Azure SQL equivalents: TEXT → NVARCHAR, REAL → DECIMAL(18,2), INTEGER(bool) → BIT, datetime TEXT → DATETIME2(3).

---

---

# FAMILY 1 — IDENTITY & ACCESS (5 tables)

---

## Table 1: `clients`

**Business Purpose:** Top-level multi-tenant entity. Every contract, package, user, and configuration record belongs to a client. Enables the platform to serve multiple General Contractor organisations simultaneously with full data isolation.

**Relationships:**
- Parent of: `users`, `contracts`, `user_roles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | Auto-incrementing surrogate key |
| `name` | TEXT | NN | Full legal name of the GC organisation, e.g. "Apex Construction Group" |
| `code` | TEXT | NN, UQ | Short alphanumeric identifier, e.g. "APEX-GC". Used in logs and API responses |
| `address` | TEXT | | Registered office address |
| `contact_email` | TEXT | | Primary business contact email |
| `contact_phone` | TEXT | | Primary business contact phone |
| `is_active` | INTEGER | NN, DEF 1 | Soft delete flag. 0 = deactivated client (data retained) |
| `created_at` | TEXT | NN, DEF datetime('now') | Record creation timestamp UTC |
| `updated_at` | TEXT | | Last modification timestamp UTC |

**Indexes:** `code` (UQ), `is_active`
**Constraints:** `code` must be uppercase alphanumeric with hyphens only

---

## Table 2: `users`

**Business Purpose:** All human actors on the platform — invoice reviewers, finance approvers, commercial reviewers, system admins, auditors, and viewers. In MVP, authentication uses a password hash. In production, this is replaced by Entra ID (Azure AD) token validation; the `email` field serves as the identity anchor between the two systems.

**Relationships:**
- Parent of: `user_roles`, `user_sessions`, `audit_events`, `review_action_logs`, `data_change_logs`, `notifications`, `exception_resolutions`
- Child of: `clients`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | Auto-incrementing surrogate key |
| `client_id` | INTEGER | FK → clients, IDX | Owning client. NULL = platform-level admin with cross-client access |
| `email` | TEXT | NN, UQ | Email address — primary identity anchor, unique across the platform |
| `display_name` | TEXT | NN | Full name shown in the UI and audit trail |
| `job_title` | TEXT | | Optional — used in notifications and reports |
| `password_hash` | TEXT | | Bcrypt hash. NULL when Entra ID is the auth method (prod) |
| `entra_oid` | TEXT | UQ | Azure AD Object ID — populated in production, NULL in MVP |
| `last_login_at` | TEXT | | Timestamp of most recent successful authentication |
| `is_active` | INTEGER | NN, DEF 1 | Soft delete. 0 = access revoked |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `email` (UQ), `client_id`, `entra_oid` (UQ where not null), `is_active`
**Security note:** `password_hash` column must be excluded from all API responses. Never logged.

---

## Table 3: `roles`

**Business Purpose:** Named permission bundles that define what a user can see and do. Seeded at system initialisation; not user-editable in MVP.

**Relationships:**
- Many-to-many with `users` via `user_roles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `code` | TEXT | NN, UQ | Machine-readable identifier. Values: `invoice_reviewer`, `finance_approver`, `commercial_reviewer`, `data_steward`, `system_admin`, `auditor`, `viewer` |
| `display_name` | TEXT | NN | Human-readable name shown in the UI |
| `description` | TEXT | | Full description of what this role can do |
| `is_active` | INTEGER | NN, DEF 1 | |

**Seed data (7 rows):**

| code | display_name | Permitted actions |
|---|---|---|
| `invoice_reviewer` | Invoice Reviewer | Upload packages, run processing, view all data, resolve exceptions, mark ready |
| `finance_approver` | Finance Approver | View package summaries, approve/reject packages (cannot be same as reviewer) |
| `commercial_reviewer` | Commercial Reviewer | Receive and resolve commercially-routed exceptions (rate/scope/retainage) |
| `data_steward` | Data Steward | Approve new vendor master data (Wave 2) |
| `system_admin` | System Administrator | Manage contracts, contract configs, users, roles, system settings |
| `auditor` | Auditor | Read-only access to all data, full audit trace access |
| `viewer` | Leadership Viewer | Read-only dashboard access only |

---

## Table 4: `user_roles`

**Business Purpose:** Junction table assigning roles to users, with optional client scoping. A user can be an `invoice_reviewer` for Client A and a `viewer` for Client B using two rows with different `client_id` values.

**Relationships:**
- Child of: `users`, `roles`, `clients`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `user_id` | INTEGER | FK → users, NN, IDX | |
| `role_id` | INTEGER | FK → roles, NN | |
| `client_id` | INTEGER | FK → clients | NULL = role applies across all clients (platform admin pattern) |
| `granted_by` | INTEGER | FK → users | User who assigned this role |
| `granted_at` | TEXT | NN, DEF datetime('now') | |
| `revoked_at` | TEXT | | NULL = currently active. Non-null = revoked (soft delete via timestamp) |
| `revoke_reason` | TEXT | | Mandatory when role is revoked |

**Constraints:** `UNIQUE(user_id, role_id, client_id)` — prevents duplicate role assignments
**Indexes:** `user_id`, `client_id`, `role_id`

---

## Table 5: `user_sessions`

**Business Purpose:** Tracks active authentication sessions for security monitoring, concurrent session limits, and forced logout capability. In production with Entra ID, this table records token issuance and revocation events rather than full session state.

**Relationships:**
- Child of: `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `user_id` | INTEGER | FK → users, NN, IDX | |
| `session_token` | TEXT | NN, UQ | Cryptographically random token (32 bytes, hex-encoded). Never logged |
| `ip_address` | TEXT | | Client IP at session creation |
| `user_agent` | TEXT | | Browser user-agent string |
| `created_at` | TEXT | NN, DEF datetime('now') | Session start |
| `expires_at` | TEXT | NN | Session expiry (MVP: 8 hours; configurable via system_configs) |
| `last_active_at` | TEXT | | Updated on each authenticated request |
| `revoked_at` | TEXT | | NULL = active. Non-null = manually revoked (logout, admin forced logout) |

**Indexes:** `session_token` (UQ), `user_id`, `expires_at`
**Security note:** `session_token` must never be logged or included in error messages.

---

---

# FAMILY 2 — CONTRACT MASTER (2 tables)

---

## Table 6: `contracts`

**Business Purpose:** A construction contract between a GC (the client) and an owner/developer. The contract anchors all packages, validation rules, and financial data for a specific project. Replaces and supersedes the old `projects` table.

**Relationships:**
- Child of: `clients`
- Parent of: `contract_configs` (1:1), `packages` (1:many)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `client_id` | INTEGER | FK → clients, NN, IDX | Owning GC client |
| `contract_no` | TEXT | | Human-readable contract identifier, e.g. "CON-2024-0047" |
| `contract_name` | TEXT | NN | Descriptive name, e.g. "Highway Bridge Renovation Phase 2" |
| `contractor_name` | TEXT | | General Contractor legal name |
| `owner_name` | TEXT | | Project owner / developer name |
| `project_description` | TEXT | | Free-text project description |
| `project_location` | TEXT | | Physical location |
| `contract_start_date` | TEXT | | DATE format. Formal contract commencement |
| `contract_end_date` | TEXT | | DATE format. Planned completion |
| `original_contract_sum` | REAL | | Total original contracted value in USD |
| `currency` | TEXT | NN, DEF 'USD' | ISO 4217 currency code |
| `is_active` | INTEGER | NN, DEF 1 | Soft delete |
| `created_by` | INTEGER | FK → users | |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `client_id`, `is_active`, `contract_no`

---

## Table 7: `contract_configs`

**Business Purpose:** Hardcoded validation rules specific to each contract. In Wave 1 MVP, there is no contract ingestion workflow — a system admin manually configures these values. The validation engine reads from this table to determine what constitutes a pass or fail for each package.

**Design note:** This table replaces three complex Wave 2 tables (`contract_baseline_versions`, `contract_sov_items`, `vendors`) for MVP. All rules are data — adding a new rule type requires adding a column here or using the `custom_rules_json` escape hatch.

**Relationships:**
- Child of: `contracts` (1:1)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `contract_id` | INTEGER | FK → contracts, NN, UQ | One config per contract |
| **— Retainage Rules —** | | | |
| `retainage_rate_pct` | REAL | NN, DEF 10.0 | Standard retainage percentage. e.g. 10.0 = 10%. Validation checks each line's retainage column against `scheduled_current × rate` |
| `retainage_applies_to` | TEXT | NN, DEF 'BOTH' | `COMPLETED_WORK` \| `STORED_MATERIALS` \| `BOTH` — defines which components attract retainage |
| `retainage_release_threshold_pct` | REAL | DEF 50.0 | % complete at which retainage may be released (if applicable per contract) |
| `max_retainage_pct` | REAL | DEF 10.0 | Maximum cumulative retainage allowed; exception fires if exceeded |
| **— Tolerance Rules —** | | | |
| `cross_file_tolerance_amt` | REAL | NN, DEF 10.0 | Dollar tolerance for File 1 vs File 2 variance before `FILE1_VS_FILE2` exception fires. Default ±$10 |
| `math_tolerance_amt` | REAL | NN, DEF 0.01 | Rounding tolerance (cents) for G703 arithmetic checks |
| `confidence_threshold` | REAL | NN, DEF 0.80 | Extraction confidence below this triggers `LOW_CONFIDENCE` exception |
| **— Billing Rules —** | | | |
| `max_pct_complete` | REAL | NN, DEF 100.0 | Any G703 line where pct > this value triggers a BLOCKING exception |
| `period_continuity_check` | INTEGER | NN, DEF 1 | 1 = enforce month-to-month continuity rule (this period prev = prior period total); 0 = skip |
| **— Financial Facts (for cover page validation) —** | | | |
| `original_contract_sum` | REAL | | Expected value of G702 Original Contract Sum field. Exception fires if billed sum differs |
| `expected_retainage_pct_display` | REAL | | Used for display/comparison in UI only |
| **— Escape Hatch —** | | | |
| `custom_rules_json` | TEXT | | JSON array of additional rule objects for rules not yet modelled as columns. Schema: `[{code, description, threshold, severity}]` |
| **— Metadata —** | | | |
| `notes` | TEXT | | Admin notes explaining rule choices for this contract |
| `configured_by` | INTEGER | FK → users | User who set these rules |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `contract_id` (UQ)
**Validation:** `retainage_rate_pct` BETWEEN 0 AND 100; `confidence_threshold` BETWEEN 0 AND 1

---

---

# FAMILY 3 — REFERENCE / LOOKUP (3 tables)

---

## Table 8: `ref_exception_types`

**Business Purpose:** Catalogue of all exception types the validation engine can produce. Fully data-driven — no schema change is required to add a new exception type. Engineering adds a row; the validation engine and routing logic read from this table at runtime.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `code` | TEXT | NN, UQ | Machine-readable key used throughout the system |
| `display_name` | TEXT | NN | Label shown in the Exceptions Navigator |
| `description` | TEXT | | Full description of what this exception means |
| `severity` | TEXT | NN | `BLOCKING` = must resolve before approval \| `WARNING` = reviewable \| `INFO` = informational only |
| `routing` | TEXT | NN | `REVIEWER` \| `COMMERCIAL` \| `FINANCE` \| `AUTO_CLEAR` — determines which queue this exception routes to |
| `can_bulk_resolve` | INTEGER | NN, DEF 1 | 1 = this exception type supports bulk Accept/Override |
| `requires_comment_on_override` | INTEGER | NN, DEF 1 | 1 = override requires a mandatory comment |
| `is_active` | INTEGER | NN, DEF 1 | Deactivate without deleting |
| `sort_order` | INTEGER | DEF 99 | Controls display order in Exceptions Navigator (lower = higher up) |

**Seed data — 10 baseline types:**

| code | display_name | severity | routing | sort_order |
|---|---|---|---|---|
| `MATH_ERROR` | Math Error | BLOCKING | REVIEWER | 1 |
| `FILE1_VS_FILE2` | Amount Variance (File 1 vs File 2) | WARNING | REVIEWER | 2 |
| `LOW_CONFIDENCE` | Low Confidence Extraction | WARNING | REVIEWER | 3 |
| `MISSING_SUPPORT` | Missing Evidence (File 3) | WARNING | REVIEWER | 4 |
| `CONTRACT_RATE` | Rate Mismatch | BLOCKING | COMMERCIAL | 5 |
| `CONTRACT_SCOPE` | Out-of-Scope Billing | BLOCKING | COMMERCIAL | 6 |
| `CONTRACT_RETAINAGE` | Retainage Deviation | WARNING | COMMERCIAL | 7 |
| `PERIOD_CONTINUITY` | Period Continuity Break | BLOCKING | REVIEWER | 8 |
| `DUPLICATE` | Potential Duplicate Billing | BLOCKING | REVIEWER | 9 |
| `PCT_OVER_100` | Completion Exceeds 100% | BLOCKING | REVIEWER | 10 |

---

## Table 9: `ref_document_types`

**Business Purpose:** Reference list of document type classifications used during page-level classification in the ingestion pipeline. The AI classification agent maps each page to a code from this table.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `code` | TEXT | NN, UQ | e.g. `G702`, `G703`, `SUB_COVER`, `SUB_G703`, `RECEIPT`, `INVOICE`, `DELIVERY_TICKET`, `TIMESHEET`, `LIEN_WAIVER`, `INSURANCE_CERT`, `UNKNOWN` |
| `display_name` | TEXT | NN | |
| `file_role` | TEXT | | Which file role this type appears in: `FILE_1` \| `FILE_2` \| `FILE_3` \| `ANY` |
| `description` | TEXT | | |
| `is_active` | INTEGER | NN, DEF 1 | |

---

## Table 10: `ref_validation_rule_types`

**Business Purpose:** Catalogue of reconciliation check types run by the deterministic validation engine. Used to categorise rows in `reconciliation_results`. Allows the rules engine to be data-driven.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `code` | TEXT | NN, UQ | e.g. `JV_VS_SUB`, `MATH_CHECK`, `RETAINAGE_RATE`, `PERIOD_CONTINUITY`, `CONTRACT_SOV`, `PCT_COMPLETE`, `COVER_VS_G703` |
| `display_name` | TEXT | NN | |
| `description` | TEXT | | What this check validates |
| `produces_exception_type` | TEXT | FK → ref_exception_types(code) | The exception type this rule triggers on failure |
| `is_active` | INTEGER | NN, DEF 1 | |

---

---

# FAMILY 4 — PACKAGES & DOCUMENT MANAGEMENT (4 tables)

---

## Table 11: `packages`

**Business Purpose:** The central operational entity. One row per billing period per contract. Owns the 10-state processing state machine. All extraction, validation, and review activity links back to a package. Replaces and supersedes the old `projects` table.

**Relationships:**
- Child of: `clients`, `contracts`
- Parent of: `package_documents`, `processing_pipeline_steps`, `agent_plans`, `gc_pay_application_headers`, `gc_pay_application_sov_lines`, `sub_pay_application_headers`, `supporting_document_items`, `validation_runs`, `audit_events`, `activity_logs`, `notifications`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `client_id` | INTEGER | FK → clients, NN, IDX | Owning client |
| `contract_id` | INTEGER | FK → contracts, NN, IDX | Owning contract |
| `billing_period_month` | INTEGER | NN | 1–12 |
| `billing_period_year` | INTEGER | NN | e.g. 2026 |
| `billing_period_label` | TEXT | | Computed on insert: "June 2026". Used for display only |
| `package_status` | TEXT | NN, DEF 'DRAFT', IDX | State machine column. Valid values: `DRAFT` \| `INGESTING` \| `FILE_1_PROCESSING` \| `AWAITING_PLAN_CONFIRMATION` \| `FILE_2_3_PROCESSING` \| `PROCESSING_COMPLETE` \| `IN_REVIEW` \| `HITL_COMPLETE` \| `IN_VALIDATION` \| `APPROVED` \| `REJECTED` |
| `file_hash_1` | TEXT | | SHA-256 hash of File 1 for duplicate detection (S-01) |
| `file_hash_2` | TEXT | | SHA-256 hash of File 2 |
| `file_hash_3` | TEXT | | SHA-256 hash of File 3 |
| `total_items_extracted` | INTEGER | | Populated after processing complete: total G703 lines across all files |
| `auto_cleared_count` | INTEGER | | Items with no exceptions (populated at PROCESSING_COMPLETE) |
| `exceptions_count` | INTEGER | | Total open exceptions (populated at PROCESSING_COMPLETE) |
| `dollar_at_risk` | REAL | | Sum of exception dollar_at_risk values |
| `submitted_by` | INTEGER | FK → users | User who created the package and uploaded files |
| `submitted_at` | TEXT | | Timestamp of initial submission |
| `reviewed_by` | INTEGER | FK → users | Reviewer who worked the exception workbench |
| `reviewed_at` | TEXT | | Timestamp when all exceptions were resolved |
| `approved_by` | INTEGER | FK → users | Finance approver. Must differ from reviewed_by (BR-04) |
| `approved_at` | TEXT | | |
| `rejection_reason` | TEXT | | Populated if package_status = 'REJECTED' |
| `created_by` | INTEGER | FK → users | |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Constraints:** `UNIQUE(contract_id, billing_period_month, billing_period_year)` — enforces BR-01
**Indexes:** `contract_id`, `client_id`, `package_status`, `billing_period_year`

---

## Table 12: `package_documents`

**Business Purpose:** The 3 file upload slots per package. Each row represents one uploaded PDF file in a specific role (GC Cover+G703, Sub-contractor breakdown, Supporting docs). Enforces that each role can only be filled once per package.

**Relationships:**
- Child of: `packages`
- Parent of: `document_pages`, `raw_extracted_fields`, `exceptions` (as evidence)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `file_role` | TEXT | NN | `FILE_1_GC_COVER` \| `FILE_2_SUBS` \| `FILE_3_SUPPORT` |
| `original_filename` | TEXT | | As uploaded by the user |
| `stored_path` | TEXT | | Absolute path on disk (MVP) or Azure Blob URI (prod) |
| `sharepoint_url` | TEXT | | SharePoint document URL if stored there (integration) |
| `file_size_bytes` | INTEGER | | |
| `page_count` | INTEGER | | Total pages in this PDF |
| `file_hash` | TEXT | | SHA-256 — used for duplicate detection across packages |
| `mime_type` | TEXT | DEF 'application/pdf' | |
| `upload_status` | TEXT | NN, DEF 'PENDING' | `PENDING` \| `RECEIVED` \| `CLASSIFIED` \| `QUARANTINED` \| `ERROR` |
| `quarantine_reason` | TEXT | | Populated if upload_status = 'QUARANTINED' (encrypted, corrupt, wrong type) |
| `classification_result` | TEXT | FK → ref_document_types(code) | Auto-detected primary document type |
| `classification_confidence` | REAL | | 0.0–1.0. Low confidence flagged to user |
| `uploaded_at` | TEXT | | |
| `uploaded_by` | INTEGER | FK → users | |

**Constraints:** `UNIQUE(package_id, file_role)` — enforces BR-02
**Indexes:** `package_id`, `file_role`, `upload_status`

---

## Table 13: `document_pages`

**Business Purpose:** Page-level metadata for every PDF page ingested. This is the addressing layer that makes the Evidence Viewer work: when an exception references page 14, the Evidence Viewer queries this table for dimensions and then renders the page from the stored PDF with a bounding box overlay.

**Relationships:**
- Child of: `package_documents`
- Parent of: `raw_extracted_fields`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_document_id` | INTEGER | FK → package_documents, NN, IDX | |
| `page_no` | INTEGER | NN | 1-based page number within the parent document |
| `width_pts` | REAL | | Page width in PDF points (1 pt = 1/72 inch) |
| `height_pts` | REAL | | Page height in PDF points |
| `rotation_degrees` | INTEGER | DEF 0 | Page rotation (0, 90, 180, 270) |
| `ocr_text` | TEXT | | Full raw OCR text for this page. Used for search and classification |
| `classification` | TEXT | FK → ref_document_types(code) | Page-level type classification |
| `classification_confidence` | REAL | | 0.0–1.0 |
| `is_blank` | INTEGER | DEF 0 | 1 = page detected as blank; skipped in extraction |

**Constraints:** `UNIQUE(package_document_id, page_no)`
**Indexes:** `package_document_id`, `classification`

---

## Table 14: `processing_pipeline_steps`

**Business Purpose:** Tracks the state of each of the 9 pipeline steps for a package. This is the data source for the Agent Progress Rail component in the UI (Screens 2–5). The `sub_progress_*` columns drive the mini progress bar shown inside running steps.

**Relationships:**
- Child of: `packages`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `step_no` | INTEGER | NN | 1–9 |
| `step_name` | TEXT | NN | Canonical step names: 1="File Upload & Receipt", 2="Preliminary Classification", 3="Extract GC Cover + G703", 4="Agent Plan: Sub-Contractor Confirmation", 5="Extract File 2: Sub-Contractor Invoices", 6="Extract File 3: Supporting Documents", 7="Cross-File Reconciliation", 8="Exception Assembly & Risk Ranking", 9="Ready for Review" |
| `status` | TEXT | NN, DEF 'pending' | `pending` \| `running` \| `paused` \| `complete` \| `error` |
| `sub_progress_current` | INTEGER | | e.g. 8 (subs processed so far). NULL = no sub-progress for this step |
| `sub_progress_total` | INTEGER | | e.g. 14 (total subs to process) |
| `sub_progress_label` | TEXT | | e.g. "Delta Plumbing Inc (pages 19–24)". Shown in the expanded step card |
| `started_at` | TEXT | | Timestamp when step transitioned to 'running' |
| `completed_at` | TEXT | | Timestamp when step transitioned to 'complete' or 'error' |
| `error_message` | TEXT | | Populated on 'error' status |
| `retry_count` | INTEGER | DEF 0 | Number of times this step has been retried |

**Constraints:** `UNIQUE(package_id, step_no)`
**Indexes:** `package_id`, `status`

**Step 4 behaviour note:** When step 4 transitions to `paused`, the package status transitions to `AWAITING_PLAN_CONFIRMATION`. The pipeline halts until the user confirms the agent plan on Screen 4. No other step uses `paused` status.

---

---

# FAMILY 5 — AGENT PLANNING (2 tables)

---

## Table 15: `agent_plans`

**Business Purpose:** The confirmed sub-contractor processing plan. Created at the moment the reviewer clicks "Confirm & Proceed to File 2" on Screen 4. This record is **write-once and immutable** by application rule. It becomes the reconciliation baseline — the validation engine compares File 2 extraction results against this confirmed list, not the agent's initial guess. The `confirmed_by` + `confirmed_at` fields are the audit anchor for the plan.

**Relationships:**
- Child of: `packages` (1:1)
- Parent of: `agent_plan_items`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, UQ | One plan per package |
| `confirmed_by` | INTEGER | FK → users, NN | User who clicked "Confirm & Proceed" |
| `confirmed_at` | TEXT | NN | Exact timestamp of confirmation — appears in audit trail |
| `agent_identified_count` | INTEGER | | Count of sub-contractors the agent initially found in File 1 |
| `manually_added_count` | INTEGER | DEF 0 | Count of sub-contractors the reviewer added manually |
| `notes` | TEXT | | Reviewer notes on the confirmation decision |
| `created_at` | TEXT | NN, DEF datetime('now') | |

**Constraints:** `UNIQUE(package_id)` — one plan per package
**Business rule (BR-03):** No UPDATE or DELETE operations permitted after row creation. Enforced at API layer with a 403 response.

---

## Table 16: `agent_plan_items`

**Business Purpose:** Individual sub-contractor entries in the confirmed plan. Each row represents one sub-contractor the system will search for in File 2. The `source` column distinguishes agent-identified items from reviewer-added items (the UI shows "Added by you" badge for manual items).

**Relationships:**
- Child of: `agent_plans`
- Referenced by: `sub_pay_application_headers` (to link extractions back to the plan)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `agent_plan_id` | INTEGER | FK → agent_plans, NN, IDX | |
| `seq_no` | INTEGER | NN | Display order (1-based). Determines row order in Screen 4 table |
| `subcontractor_name` | TEXT | NN | Name as confirmed by the reviewer (may differ from raw OCR extraction) |
| `original_ocr_name` | TEXT | | The raw OCR-extracted name before reviewer edit (audit trail) |
| `expected_app_no` | TEXT | | Expected application number, e.g. "App #12" |
| `billed_amount_file1` | REAL | | Amount from GC G703 for this sub-contractor (from File 1 extraction) |
| `gc_sov_line_ids` | TEXT | | JSON array of `gc_pay_application_sov_lines.id` values that identify this sub |
| `source` | TEXT | NN, DEF 'AGENT' | `AGENT` = identified from File 1 by the AI \| `MANUAL` = added by reviewer with no File 1 evidence |
| `is_manually_added` | INTEGER | NN, DEF 0 | Redundant flag for quick filtering. 1 = manual, 0 = agent-identified |
| `notes` | TEXT | | Reviewer notes on this specific item |

**Indexes:** `agent_plan_id`, `source`

---

---

# FAMILY 6 — AI EXTRACTION STAGING (1 table)

---

## Table 17: `raw_extracted_fields`

**Business Purpose:** The immutability guarantee. Every field extracted by the AI agent is written here exactly once and never modified. This is the system's "what the AI saw" record. It enables: (a) full audit trace from canonical value back to PDF pixel, (b) accuracy measurement when human corrections are applied, (c) re-processing without losing prior run results.

**Critical design rule:** No application code or API endpoint may issue UPDATE or DELETE statements against this table. It is append-only.

**Relationships:**
- Child of: `package_documents`
- Provides evidence for: `gc_pay_application_headers`, `gc_pay_application_sov_lines`, `sub_pay_application_headers`, `sub_pay_application_sov_lines`, `supporting_document_items`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_document_id` | INTEGER | FK → package_documents, NN, IDX | Which file this field was extracted from |
| `agent_run_id` | TEXT | IDX | UUID identifying the specific extraction run. Allows multiple runs to coexist |
| `page_no` | INTEGER | IDX | 1-based page number where this field was found |
| `field_name` | TEXT | IDX | Canonical field name, e.g. "current_payment_due", "contractor_name", "work_completed_this" |
| `field_category` | TEXT | | Grouping: "G702_HEADER" \| "G703_LINE" \| "SUB_COVER" \| "SUB_LINE" \| "SUPPORT_DOC" |
| `raw_value` | TEXT | | Exactly as extracted from OCR — unprocessed |
| `normalized_value` | TEXT | | Cleaned, type-cast value (e.g., "$1,234.00" → "1234.00") |
| `bbox_x` | REAL | | Bounding box left edge in PDF points from page left |
| `bbox_y` | REAL | | Bounding box top edge in PDF points from page top |
| `bbox_width` | REAL | | Bounding box width in PDF points |
| `bbox_height` | REAL | | Bounding box height in PDF points |
| `extraction_confidence` | REAL | | 0.0–1.0. Values below `contract_configs.confidence_threshold` trigger LOW_CONFIDENCE exception |
| `is_table_cell` | INTEGER | DEF 0 | 1 = this field is a cell within a tabular extraction (G703 row) |
| `table_row_no` | INTEGER | | Row number within the table (if is_table_cell = 1) |
| `table_col_name` | TEXT | | Column header of this cell (if is_table_cell = 1) |
| `created_at` | TEXT | NN, DEF datetime('now') | |

**Indexes:** `package_document_id`, `agent_run_id`, `page_no`, `field_name`, `extraction_confidence`

---

---

# FAMILY 7 — CONTRACTOR DATA / FILE 1 (2 tables)

---

## Table 18: `gc_pay_application_headers`

**Business Purpose:** Canonical representation of the G702 AIA Cover Page — the top-level summary of the GC's monthly payment application. Contains all financial summary fields plus evidence provenance. One row per package. Previously called `cover_page`.

**Relationships:**
- Child of: `packages` (1:1)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, UQ | |
| `agent_run_id` | TEXT | | Links this record to the specific extraction run in `raw_extracted_fields` |
| **— G702 Standard Fields —** | | | |
| `to_owner` | TEXT | | Owner/Developer name as printed on the G702 |
| `from_contractor` | TEXT | | GC name as printed |
| `project_name` | TEXT | | Project name as printed |
| `application_no` | TEXT | | Payment application number, e.g. "Application #12" |
| `period` | TEXT | | Billing period as a display label |
| `period_from` | TEXT | | DATE — start of the billing period |
| `period_to` | TEXT | | DATE — end of the billing period |
| `original_contract_sum` | REAL | | G702 field: original contract amount |
| `net_change_orders` | REAL | | G702 field: net value of all change orders |
| `contract_sum_to_date` | REAL | | G702 field: original + net change orders |
| `total_completed_stored` | REAL | | G702 field: total completed and stored to date |
| `retainage_completed` | REAL | | G702 field: retainage on completed work |
| `retainage_materials` | REAL | | G702 field: retainage on stored materials |
| `total_retainage` | REAL | | G702 field: total retainage held |
| `total_earned_less_ret` | REAL | | G702 field: total earned less retainage |
| `less_prev_certificates` | REAL | | G702 field: less previous certificates for payment |
| `current_payment_due` | REAL | | G702 field: amount due this period |
| `balance_to_finish` | REAL | | G702 field: balance to complete the contract |
| `change_order_summary` | TEXT | | JSON or text summary of change orders listed on G702 |
| `architect_signature` | TEXT | | Signature present: 'YES' \| 'NO' \| 'UNCLEAR' |
| `contractor_signature` | TEXT | | Signature present: 'YES' \| 'NO' \| 'UNCLEAR' |
| **— Evidence Provenance —** | | | |
| `source_page` | INTEGER | | Page number of the G702 within File 1 |
| `extraction_confidence` | REAL | | Overall confidence score for this G702 extraction |
| `bbox_x` | REAL | | Bounding box of the G702 summary block |
| `bbox_y` | REAL | | |
| `bbox_width` | REAL | | |
| `bbox_height` | REAL | | |
| **— Review & Validation —** | | | |
| `review_notes` | TEXT | | Free-text notes added by the reviewer |
| `validation_status` | TEXT | DEF 'unchecked' | `unchecked` \| `checking` \| `valid` \| `warning` \| `pending_review` |
| `validation_notes` | TEXT | | Validation engine notes |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `package_id` (UQ)

---

## Table 19: `gc_pay_application_sov_lines`

**Business Purpose:** Individual line items from the G703 AIA Continuation Sheet — the schedule of values for the GC's application. One row per G703 line. Contains all standard G703 financial columns plus the cross-file comparison columns populated after File 2 extraction. Previously called `line_items`. The `pct` column is changed from TEXT to REAL to enable arithmetic validation.

**Relationships:**
- Child of: `packages`
- Referenced by: `supporting_document_items` (via `linked_sov_line_id`)
- Referenced by: `exceptions` (via `entity_id`)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `agent_plan_item_id` | INTEGER | FK → agent_plan_items | Links this SOV line to the confirmed sub-contractor plan item |
| **— G703 Standard Fields —** | | | |
| `item_no` | TEXT | | G703 item number (Column A) |
| `time_period` | TEXT | | Billing period label |
| `phases` | TEXT | | Construction phase grouping |
| `type_of_work` | TEXT | | Description of work category |
| `contractor_name` | TEXT | IDX | Sub-contractor name billed in this G703 line |
| `scheduled_original` | REAL | DEF 0 | Column C: Original scheduled value |
| `scheduled_change_orders` | REAL | DEF 0 | Column D: Net change by change orders |
| `scheduled_current` | REAL | DEF 0 | Column E: Current scheduled value (C + D) |
| `work_completed_prev` | REAL | DEF 0 | Column F: Work completed from previous applications |
| `work_completed_this` | REAL | DEF 0 | Column G: Work completed this period |
| `materials_stored` | REAL | DEF 0 | Column H: Materials presently stored |
| `total_completed` | REAL | DEF 0 | Column I: Total completed and stored (F + G + H) |
| `pct` | REAL | DEF 0 | Column J: % complete (I / E). Changed from TEXT to REAL — enables math checks |
| `balance_to_finish` | REAL | DEF 0 | Column K: Balance to finish (E - I) |
| `retainage` | REAL | DEF 0 | Column L: Retainage amount |
| **— Cross-File Comparison (populated post-File-2-extraction) —** | | | |
| `file2_extracted_amount` | REAL | | Matched sub-contractor amount from File 2 (`g703_work_this_period`) |
| `cross_file_variance` | REAL | | `work_completed_this - file2_extracted_amount`. NULL until File 2 processed |
| `file2_matched_sub_app_id` | INTEGER | FK → sub_pay_application_headers | The specific sub application this line was matched to |
| **— Evidence Provenance —** | | | |
| `source_page` | INTEGER | | Page number within File 1 |
| `extraction_confidence` | REAL | | |
| `bbox_page` | INTEGER | | |
| `bbox_x` | REAL | | |
| `bbox_y` | REAL | | |
| `bbox_width` | REAL | | |
| `bbox_height` | REAL | | |
| **— Review & Validation —** | | | |
| `review_notes` | TEXT | | |
| `validation_status` | TEXT | DEF 'unchecked' | `unchecked` \| `checking` \| `valid` \| `warning` \| `pending_review` |
| `validation_note` | TEXT | | |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `package_id`, `contractor_name`, `validation_status`, `agent_plan_item_id`

---

---

# FAMILY 8 — SUB-CONTRACTOR DATA / FILE 2 (2 tables)

---

## Table 20: `sub_pay_application_headers`

**Business Purpose:** The G702 Cover Page extracted from each sub-contractor's individual pay application within File 2. One row per sub-contractor per package. Contains both the G702 summary fields and the G703 grand totals (footer rows from the sub's continuation sheet). Previously called `subcontractor_applications`.

**Relationships:**
- Child of: `packages`
- Linked to: `agent_plan_items` (confirms which plan item this sub was found for)
- Parent of: `sub_pay_application_sov_lines`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `agent_plan_item_id` | INTEGER | FK → agent_plan_items | Links this extracted application to the confirmed plan item |
| **— Document Position —** | | | |
| `seq_id` | INTEGER | | Sequential number within File 2 |
| `start_page` | INTEGER | | First page of this sub's application in File 2 |
| `end_page` | INTEGER | | Last page of this sub's application in File 2 |
| **— Document Classification —** | | | |
| `document_type` | TEXT | | e.g. "G702/G703 AIA", "Custom Form" |
| `document_category` | TEXT | | e.g. "SUBCONTRACTOR_APPLICATION" |
| **— Identity Fields —** | | | |
| `subcontractor_name` | TEXT | IDX | Sub-contractor name as extracted from their document |
| `application_no` | TEXT | | Their own application number |
| `application_date` | TEXT | | Date on the sub's application |
| `period_from` | TEXT | | Billing period start date |
| `period_to` | TEXT | | Billing period end date |
| `invoice_to` | TEXT | | Addressed to (usually the GC) |
| `project_name_on_doc` | TEXT | | Project name as written on this sub's document |
| `contract_po_number` | TEXT | | Sub's contract or PO reference number |
| **— G702 Financial Fields —** | | | |
| `original_contract_sum` | REAL | | Sub's original contract value |
| `net_change_orders` | REAL | | |
| `contract_sum_to_date` | REAL | | |
| `total_completed_stored` | REAL | | |
| `completed_work_this_period` | REAL | | G702 cover value for this period |
| `total_retainage` | REAL | | |
| `retainage_percent` | REAL | | |
| `total_earned_less_retainage` | REAL | | |
| `less_prev_certificates` | REAL | | |
| `current_payment_due` | REAL | | |
| `balance_to_finish` | REAL | | |
| **— G703 Grand Totals (footer of sub's continuation sheet) —** | | | |
| `g703_scheduled_value` | REAL | | Grand total: Scheduled Value column |
| `g703_work_prev` | REAL | | Grand total: Work completed prev |
| `g703_work_this_period` | REAL | | **KEY FIELD** — compared against GC's G703 `work_completed_this` for this sub |
| `g703_materials_stored` | REAL | | |
| `g703_total_completed` | REAL | | |
| `g703_retainage` | REAL | | |
| `g703_earned_less_ret` | REAL | | |
| `g703_balance_to_finish` | REAL | | |
| **— Compliance & Signatures —** | | | |
| `recon_flag` | TEXT | | Reconciliation flag from prior pass |
| `contractor_signature` | TEXT | | 'YES' \| 'NO' \| 'UNCLEAR' |
| `architect_signature` | TEXT | | 'YES' \| 'NO' \| 'UNCLEAR' |
| `notarized` | TEXT | | 'YES' \| 'NO' |
| `additional_supporting_docs` | TEXT | | Notes on additional docs referenced |
| **— Evidence Provenance —** | | | |
| `extraction_confidence` | REAL | | |
| **— Review & Validation —** | | | |
| `validation_status` | TEXT | DEF 'unchecked' | |
| `validation_note` | TEXT | | |
| `raw_json` | TEXT | | Full raw extraction payload for debugging |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `package_id`, `agent_plan_item_id`, `subcontractor_name`, `validation_status`

---

## Table 21: `sub_pay_application_sov_lines`

**Business Purpose:** Individual G703 line items from each sub-contractor's continuation sheet. One row per line per sub application. Previously called `sub_line_items`. Extended with `balance_to_finish` (was missing), `validation_status` (was missing at line level), and full bounding box columns.

**Relationships:**
- Child of: `packages`, `sub_pay_application_headers`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `sub_app_id` | INTEGER | FK → sub_pay_application_headers, NN, IDX | |
| **— G703 Line Fields —** | | | |
| `source_page` | INTEGER | | Page within File 2 |
| `item_no` | TEXT | | |
| `description` | TEXT | | Line item description |
| `scheduled_value` | REAL | | |
| `work_completed_prev` | REAL | | |
| `work_completed_this` | REAL | | |
| `materials_stored` | REAL | | |
| `total_completed` | REAL | | |
| `pct_complete` | REAL | | |
| `retainage` | REAL | | |
| `balance_to_finish` | REAL | | **Previously missing** — added to match GC G703 structure |
| **— Evidence Provenance —** | | | |
| `extraction_confidence` | REAL | | |
| `bbox_page` | INTEGER | | |
| `bbox_x` | REAL | | |
| `bbox_y` | REAL | | |
| `bbox_width` | REAL | | |
| `bbox_height` | REAL | | |
| **— Review & Validation —** | | | |
| `validation_status` | TEXT | DEF 'unchecked' | **Previously missing at line level** |
| `validation_note` | TEXT | | |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `package_id`, `sub_app_id`

---

---

# FAMILY 9 — SUPPORTING DOCUMENTS / FILE 3 (1 table)

---

## Table 22: `supporting_document_items`

**Business Purpose:** Structured data extracted from File 3 — receipts, vendor invoices, delivery tickets, timesheets, and other direct cost backup. Each item is classified by type, key fields extracted, and linked (where possible) to a specific GC G703 SOV line. Unmatched items trigger the `MISSING_SUPPORT` exception on the SOV line.

**Relationships:**
- Child of: `packages`, `package_documents`
- References: `gc_pay_application_sov_lines` (via `linked_sov_line_id`)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `package_document_id` | INTEGER | FK → package_documents, NN | Points to the FILE_3_SUPPORT document |
| `page_no` | INTEGER | | Page within File 3 |
| **— Classification —** | | | |
| `document_type` | TEXT | FK → ref_document_types(code) | `RECEIPT` \| `INVOICE` \| `DELIVERY_TICKET` \| `TIMESHEET` \| `LIEN_WAIVER` \| `INSURANCE_CERT` \| `OTHER` |
| **— Extracted Fields —** | | | |
| `vendor_name` | TEXT | | Vendor or supplier name |
| `invoice_date` | TEXT | | Date on the document |
| `invoice_no` | TEXT | | Invoice or receipt number |
| `description` | TEXT | | Description of goods or services |
| `amount` | REAL | | Dollar amount on this document |
| `currency` | TEXT | DEF 'USD' | |
| `tax_amount` | REAL | | If separately identified |
| `total_amount` | REAL | | Total including tax |
| **— SOV Line Matching —** | | | |
| `linked_sov_line_id` | INTEGER | FK → gc_pay_application_sov_lines | NULL = unmatched → fires MISSING_SUPPORT exception on the SOV line |
| `match_confidence` | REAL | | Confidence of the automatic SOV line match (0.0–1.0) |
| `match_method` | TEXT | | `AUTO` \| `MANUAL` — how the link was established |
| **— Evidence Provenance —** | | | |
| `extraction_confidence` | REAL | | |
| `bbox_page` | INTEGER | | |
| `bbox_x` | REAL | | |
| `bbox_y` | REAL | | |
| `bbox_width` | REAL | | |
| `bbox_height` | REAL | | |
| **— Review & Validation —** | | | |
| `validation_status` | TEXT | DEF 'unchecked' | |
| `validation_note` | TEXT | | |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `package_id`, `package_document_id`, `linked_sov_line_id`, `document_type`

---

---

# FAMILY 10 — VALIDATION ENGINE OUTPUT (4 tables)

---

## Table 23: `validation_runs`

**Business Purpose:** One row per execution of the validation and exception assembly engine against a package. Multiple runs are preserved (e.g., if the package is reprocessed after reviewer corrections). The headline numbers on Screen 6 (total items, auto-cleared, exceptions, $ at risk) come from the most recent completed run.

**Relationships:**
- Child of: `packages`
- Parent of: `reconciliation_results`, `exception_groups`, `exceptions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `run_number` | INTEGER | NN | Sequential within the package: 1, 2, 3… |
| `triggered_by` | INTEGER | FK → users | User or system process that triggered the run |
| `run_status` | TEXT | NN, DEF 'RUNNING' | `RUNNING` \| `COMPLETE` \| `FAILED` \| `CANCELLED` |
| `run_started_at` | TEXT | NN, DEF datetime('now') | |
| `run_completed_at` | TEXT | | |
| `total_items` | INTEGER | | Total line items evaluated (G703 lines across all files) |
| `auto_cleared_count` | INTEGER | | Items with no exceptions of any type |
| `exceptions_count` | INTEGER | | Total exception items generated |
| `blocking_exceptions_count` | INTEGER | | BLOCKING severity exceptions only |
| `dollar_at_risk` | REAL | | Sum of `exceptions.dollar_at_risk` for this run |
| `error_message` | TEXT | | Populated if run_status = 'FAILED' |
| `created_at` | TEXT | NN, DEF datetime('now') | |

**Indexes:** `package_id`, `run_status`

---

## Table 24: `reconciliation_results`

**Business Purpose:** The granular output of every deterministic check run by the validation engine (Stage 6 of the 12-stage spine). Every arithmetic check, cross-file comparison, retainage rate check, and period continuity check produces one row here. This is never LLM output — these are computed, deterministic results. Feeds directly into exception generation.

**Relationships:**
- Child of: `packages`, `validation_runs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `validation_run_id` | INTEGER | FK → validation_runs, NN, IDX | |
| `reconciliation_type` | TEXT | NN, FK → ref_validation_rule_types(code) | The type of check performed |
| **— Entity Being Checked —** | | | |
| `entity_type` | TEXT | | `GC_SOV_LINE` \| `SUB_HEADER` \| `SUB_SOV_LINE` \| `GC_HEADER` |
| `entity_id` | INTEGER | | FK to the specific row being checked |
| **— Check Values —** | | | |
| `jv_amount` | REAL | | Left-hand value (GC side / actual value) |
| `sub_amount` | REAL | | Right-hand value (Sub side / extracted value) |
| `expected_amount` | REAL | | Contract-defined or prior-period expected value |
| `computed_amount` | REAL | | Result of arithmetic computation (for MATH_CHECK type) |
| `variance` | REAL | | `jv_amount - sub_amount` or deviation from expected |
| `tolerance_applied` | REAL | | The tolerance from `contract_configs` used for this check |
| `passed` | INTEGER | NN | 1 = check passed \| 0 = check failed (will produce exception) |
| `failure_reason` | TEXT | | Human-readable explanation when passed = 0 |
| `notes` | TEXT | | Additional notes |
| `created_at` | TEXT | NN, DEF datetime('now') | |

**Indexes:** `package_id`, `validation_run_id`, `entity_type`, `passed`

---

## Table 25: `exception_groups`

**Business Purpose:** Aggregated groupings of exceptions by type for the Exceptions Navigator in Screen 7 (Zone A — left rail). Each group shows item count, resolved count, and total $ at risk. As reviewers resolve exceptions, `resolved_count` increments and `status` updates. When `resolved_count = item_count`, the group status becomes 'resolved'.

**Relationships:**
- Child of: `packages`, `validation_runs`
- Parent of: `exceptions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `validation_run_id` | INTEGER | FK → validation_runs, NN | |
| `exception_type_code` | TEXT | NN, FK → ref_exception_types(code) | |
| `display_label` | TEXT | NN | Display label for the group, e.g. "Amount Variance (File 1 vs File 2)" |
| `severity` | TEXT | NN | Denormalised from ref_exception_types for query performance |
| `item_count` | INTEGER | NN, DEF 0 | Total exceptions in this group |
| `resolved_count` | INTEGER | NN, DEF 0 | Exceptions resolved (accepted, overridden, escalated, auto_cleared) |
| `dollar_at_risk` | REAL | NN, DEF 0 | Sum of dollar_at_risk across all exceptions in this group |
| `status` | TEXT | NN, DEF 'open' | `open` \| `partially_resolved` \| `resolved` |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `package_id`, `exception_type_code`, `status`

---

## Table 26: `exceptions`

**Business Purpose:** Individual exception items that form the reviewer's worklist in Screen 7 (Zone B — data grid). Each exception carries full evidence provenance (document + page + bounding box for both File 1 and File 2 where applicable) so the Evidence Viewer (Zone C) can navigate to the exact location in the PDF. Risk-ranked for priority review.

**Relationships:**
- Child of: `packages`, `validation_runs`, `exception_groups`
- References: `package_documents` (twice — for File 1 and File 2 evidence)
- Parent of: `exception_resolutions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `validation_run_id` | INTEGER | FK → validation_runs, NN | |
| `exception_group_id` | INTEGER | FK → exception_groups, IDX | |
| `exception_type_code` | TEXT | NN, FK → ref_exception_types(code), IDX | |
| **— Entity This Exception Is About —** | | | |
| `entity_type` | TEXT | | `GC_SOV_LINE` \| `SUB_HEADER` \| `SUB_SOV_LINE` \| `GC_HEADER` \| `SUPPORT_DOC` |
| `entity_id` | INTEGER | | FK to the flagged row in the appropriate table |
| **— Content —** | | | |
| `title` | TEXT | NN | One-line summary shown in the data grid, e.g. "ABC Electrical: $4,500 variance" |
| `description` | TEXT | | Full explanation of the exception |
| `file1_value` | REAL | | GC-side value (shown in "File 1 Amount" column in the grid) |
| `file2_value` | REAL | | Sub-side value (shown in "File 2 Extracted" column) |
| `expected_value` | REAL | | Contract-defined or rule-expected value |
| `variance` | REAL | | Computed difference |
| `dollar_at_risk` | REAL | | Dollar value of the disputed or uncertain amount |
| `extraction_confidence` | REAL | | AI confidence for LOW_CONFIDENCE type exceptions |
| `risk_rank` | INTEGER | IDX | Lower = higher priority. Used to sort the worklist. Computed by exception assembly engine |
| **— Status —** | | | |
| `status` | TEXT | NN, DEF 'open', IDX | `open` \| `accepted` \| `overridden` \| `escalated` \| `auto_cleared` |
| **— Primary Evidence (File 1) —** | | | |
| `evidence_document_id` | INTEGER | FK → package_documents, NN | The document containing the evidence for this exception (BR-08) |
| `evidence_page_no` | INTEGER | | Page number within the evidence document |
| `evidence_bbox_x` | REAL | | Bounding box on the evidence page — drives the amber highlight in Evidence Viewer |
| `evidence_bbox_y` | REAL | | |
| `evidence_bbox_width` | REAL | | |
| `evidence_bbox_height` | REAL | | |
| **— Secondary Evidence (File 2, for FILE1_VS_FILE2 exceptions) —** | | | |
| `evidence2_document_id` | INTEGER | FK → package_documents | File 2 evidence document (NULL for non-cross-file exceptions) |
| `evidence2_page_no` | INTEGER | | |
| `evidence2_bbox_x` | REAL | | |
| `evidence2_bbox_y` | REAL | | |
| `evidence2_bbox_width` | REAL | | |
| `evidence2_bbox_height` | REAL | | |
| `created_at` | TEXT | NN, DEF datetime('now') | |
| `updated_at` | TEXT | | |

**Indexes:** `package_id`, `exception_type_code`, `exception_group_id`, `status`, `risk_rank`, `entity_type`
**Constraint (BR-08):** `evidence_document_id IS NOT NULL` — enforced at API layer before insert

---

---

# FAMILY 11 — REVIEW & RESOLUTION (2 tables)

---

## Table 27: `exception_resolutions`

**Business Purpose:** Append-only record of every reviewer decision on an exception. An exception can have multiple resolution rows if it is re-opened and re-resolved (e.g., first auto-cleared, then escalated after manual review). The most recent row determines current status. Override and escalation always require a non-null comment (BR-05).

**Relationships:**
- Child of: `exceptions`, `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `exception_id` | INTEGER | FK → exceptions, NN, IDX | |
| `resolved_by` | INTEGER | FK → users, NN | |
| `resolved_at` | TEXT | NN | |
| `resolution_type` | TEXT | NN | `accepted` \| `overridden` \| `escalated` \| `bulk_accepted` \| `auto_cleared` |
| `override_value` | REAL | | Corrected value entered by the reviewer (when resolution_type = 'overridden') |
| `override_field` | TEXT | | The specific field that was corrected (e.g., "work_completed_this") |
| `comment` | TEXT | | Mandatory when resolution_type = 'overridden' or 'escalated'. Enforced at API |
| `escalated_to_role` | TEXT | | Role code of the recipient for escalated exceptions (e.g., 'commercial_reviewer') |
| `created_at` | TEXT | NN, DEF datetime('now') | |

**Indexes:** `exception_id`, `resolved_by`, `resolution_type`
**Business rule (BR-05):** API returns 400 if `comment IS NULL` and `resolution_type IN ('overridden', 'escalated')`

---

## Table 28: `review_action_logs`

**Business Purpose:** Fine-grained, append-only log of every action a reviewer takes in the Validation Workbench (Screen 7). This is finer than `exception_resolutions` — it captures non-decision actions like PDF page views, filter changes, and bulk operation initiations. Provides the raw material for the full audit trace query (`GET /audit/trace/{entityType}/{entityId}`).

**Relationships:**
- Child of: `packages`, `users`
- References: `exceptions` (optional)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `user_id` | INTEGER | FK → users, NN, IDX | |
| `action_type` | TEXT | NN | `VIEW_EXCEPTION` \| `ACCEPT` \| `OVERRIDE` \| `ESCALATE` \| `BULK_ACCEPT` \| `BULK_OVERRIDE` \| `MARK_READY` \| `PDF_VIEWED` \| `FILTER_CHANGED` \| `PLAN_CONFIRMED` \| `PACKAGE_SUBMITTED` |
| `entity_type` | TEXT | | Which entity type was acted on |
| `entity_id` | INTEGER | | The specific record acted on |
| `before_value` | TEXT | | JSON snapshot of the relevant field(s) before the action |
| `after_value` | TEXT | | JSON snapshot of the relevant field(s) after the action |
| `comment` | TEXT | | Any comment entered with the action |
| `ip_address` | TEXT | | Client IP address for security audit |
| `created_at` | TEXT | NN, DEF datetime('now'), IDX | |

**Indexes:** `package_id`, `user_id`, `action_type`, `created_at`

---

---

# FAMILY 12 — AUDIT & CHANGE HISTORY (3 tables)

---

## Table 29: `audit_events`

**Business Purpose:** Key lifecycle events for a package — the package-level audit trail. Records the significant state transitions and approval decisions with their associated context. The `event_summary` JSON is what populates the Screen 8 HITL confirmation panel (how many accepted, overridden, escalated, $ at risk). Also used by Finance Approver's one-screen summary view.

**Relationships:**
- Child of: `packages`, `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `event_type` | TEXT | NN, IDX | `PACKAGE_CREATED` \| `FILES_UPLOADED` \| `PROCESSING_STARTED` \| `PLAN_CONFIRMED` \| `PROCESSING_COMPLETE` \| `REVIEW_STARTED` \| `HITL_SUBMITTED` \| `APPROVED` \| `APPROVED_WITH_EXCEPTIONS` \| `REJECTED` \| `REPROCESSING_TRIGGERED` |
| `triggered_by` | INTEGER | FK → users, NN | |
| `triggered_at` | TEXT | NN | |
| `event_summary` | TEXT | | JSON payload with context. For HITL_SUBMITTED: `{auto_cleared, accepted, overridden, escalated, dollar_at_risk, reviewer_name, timestamp}`. For APPROVED: `{approver_name, approved_at, note}` |
| `created_at` | TEXT | NN, DEF datetime('now') | |

**Indexes:** `package_id`, `event_type`, `triggered_at`

---

## Table 30: `activity_logs`

**Business Purpose:** Human-language Activity Feed messages shown in Screens 2–5. Each message belongs to a specific pipeline step and is classified by level for colour-coded rendering (info=grey, success=green, warn=amber, error=red). Replaces and supersedes the old `logs` table. The key addition is `step_no` which ties each message to the correct step in the Agent Progress Rail.

**Relationships:**
- Child of: `packages`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `level` | TEXT | NN, DEF 'info' | `info` \| `success` \| `warn` \| `error` \| `step` \| `progress` |
| `step_no` | INTEGER | | Which of the 9 pipeline steps (1–9) this message belongs to. NULL = system-level |
| `message` | TEXT | NN | Human-language message. Never raw server log text |
| `created_at` | TEXT | NN, DEF datetime('now'), IDX | |

**Indexes:** `package_id`, `step_no`, `created_at`

---

## Table 31: `data_change_logs`

**Business Purpose:** Every time a human reviewer edits an AI-extracted value in the workbench, a row is written here. The canonical table (e.g., `gc_pay_application_sov_lines`) is updated with the new value, but the `raw_extracted_fields` record remains untouched. This table provides the delta — what was changed, from what, to what, by whom, and why. Supports accuracy measurement and the learning loop.

**Relationships:**
- Child of: `packages`, `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages, NN, IDX | |
| `entity_type` | TEXT | NN | `GC_HEADER` \| `GC_SOV_LINE` \| `SUB_HEADER` \| `SUB_SOV_LINE` \| `SUPPORT_DOC` |
| `entity_id` | INTEGER | NN | PK of the modified row in the canonical table |
| `field_name` | TEXT | NN | Column name that was changed, e.g. "work_completed_this" |
| `original_value` | TEXT | | The AI-extracted value (before human edit) |
| `new_value` | TEXT | | The human-corrected value |
| `changed_by` | INTEGER | FK → users, NN | |
| `changed_at` | TEXT | NN | |
| `reason` | TEXT | NN | Mandatory explanation. Enforced at API layer |
| `raw_field_id` | INTEGER | FK → raw_extracted_fields | Links back to the original AI extraction record |
| `created_at` | TEXT | NN, DEF datetime('now') | |

**Indexes:** `package_id`, `entity_type`, `changed_by`, `changed_at`

---

---

# FAMILY 13 — NOTIFICATIONS & ALERTS (2 tables)

---

## Table 32: `notifications`

**Business Purpose:** Alerts generated by the system for users — e.g., "Your package is ready for review", "A commercial exception has been escalated to you", "Package approved". Supports both in-app notifications and email dispatch (Wave 2). Each notification is tied to a package and an action the user should take.

**Relationships:**
- Child of: `users`, `packages`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `user_id` | INTEGER | FK → users, NN, IDX | Recipient |
| `package_id` | INTEGER | FK → packages | Related package (NULL for system-level notifications) |
| `notification_type` | TEXT | NN | `PACKAGE_READY_FOR_REVIEW` \| `EXCEPTION_ESCALATED_TO_YOU` \| `PACKAGE_APPROVED` \| `PACKAGE_REJECTED` \| `PROCESSING_FAILED` \| `PLAN_CONFIRMATION_NEEDED` \| `SYSTEM_ALERT` |
| `title` | TEXT | NN | Short notification title for the bell/toast |
| `message` | TEXT | NN | Full notification message |
| `action_url` | TEXT | | Deep link to the relevant screen |
| `is_read` | INTEGER | NN, DEF 0 | 0 = unread, 1 = read |
| `read_at` | TEXT | | Timestamp when marked read |
| `email_sent` | INTEGER | NN, DEF 0 | 1 = email dispatched (Wave 2) |
| `email_sent_at` | TEXT | | |
| `created_at` | TEXT | NN, DEF datetime('now'), IDX | |

**Indexes:** `user_id`, `is_read`, `created_at`, `package_id`

---

## Table 33: `notification_preferences`

**Business Purpose:** Per-user configuration of which notification types they want to receive, and via which channels (in-app and/or email). One row per user per notification type.

**Relationships:**
- Child of: `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `user_id` | INTEGER | FK → users, NN | |
| `notification_type` | TEXT | NN | Same values as `notifications.notification_type` |
| `in_app_enabled` | INTEGER | NN, DEF 1 | |
| `email_enabled` | INTEGER | NN, DEF 0 | Email notifications off by default in MVP |
| `updated_at` | TEXT | | |
| UNIQUE | (user_id, notification_type) | | One preference row per type per user |

---

---

# FAMILY 14 — EXTERNAL INTEGRATION (2 tables)

---

## Table 34: `api_integration_logs`

**Business Purpose:** Logs all calls made to external APIs (Azure Document Intelligence, Azure OpenAI, SharePoint Graph API, etc.) and their outcomes. Used for: debugging extraction failures, monitoring AI service costs, detecting rate-limit issues, and providing an audit trail of AI service usage per package.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_id` | INTEGER | FK → packages | Related package (NULL for auth/system calls) |
| `service_name` | TEXT | NN | `AZURE_DOCUMENT_INTELLIGENCE` \| `AZURE_OPENAI` \| `SHAREPOINT_GRAPH` \| `ENTRA_ID` \| `OTHER` |
| `operation` | TEXT | NN | e.g. "analyze_document", "chat_completions", "upload_file" |
| `request_url` | TEXT | | Endpoint called (sanitized — no tokens in URL) |
| `http_method` | TEXT | | GET \| POST \| PUT \| PATCH \| DELETE |
| `request_payload_size_bytes` | INTEGER | | Size of request body |
| `response_status_code` | INTEGER | | HTTP response code |
| `response_payload_size_bytes` | INTEGER | | Size of response body |
| `duration_ms` | INTEGER | | Round-trip time in milliseconds |
| `success` | INTEGER | NN | 1 = success (2xx), 0 = failure |
| `error_code` | TEXT | | API error code on failure |
| `error_message` | TEXT | | API error message on failure |
| `tokens_used` | INTEGER | | For OpenAI calls: total tokens (prompt + completion) |
| `cost_estimate_usd` | REAL | | Estimated cost based on token count and current pricing |
| `agent_run_id` | TEXT | | Links to the extraction run that made this call |
| `created_at` | TEXT | NN, DEF datetime('now'), IDX | |

**Indexes:** `package_id`, `service_name`, `success`, `created_at`

---

## Table 35: `sharepoint_document_refs`

**Business Purpose:** Tracks the SharePoint metadata and reference for every document stored in SharePoint (production deployment). Links the internal `package_documents` record to its SharePoint identity, enabling: document retrieval, versioning via SharePoint, and compliance with document retention policies managed in SharePoint/Purview.

**Relationships:**
- Child of: `package_documents` (1:1 in production; NULL in MVP local disk mode)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `package_document_id` | INTEGER | FK → package_documents, NN, UQ | |
| `sharepoint_site_id` | TEXT | | SharePoint site identifier |
| `sharepoint_drive_id` | TEXT | | Document library drive ID |
| `sharepoint_item_id` | TEXT | | SharePoint file item ID (unique within the drive) |
| `sharepoint_url` | TEXT | | Direct URL to the document in SharePoint |
| `sharepoint_version` | TEXT | | SharePoint version label (e.g., "1.0", "2.0") |
| `uploaded_at` | TEXT | | When the file was uploaded to SharePoint |
| `last_synced_at` | TEXT | | Last time metadata was synced from SharePoint |
| `retention_label` | TEXT | | Purview retention label applied |
| `created_at` | TEXT | NN, DEF datetime('now') | |

**Indexes:** `package_document_id` (UQ), `sharepoint_item_id`

---

---

# FAMILY 15 — SYSTEM CONFIGURATION (1 table)

---

## Table 36: `system_configs`

**Business Purpose:** Global platform configuration key-value store. Used for platform-wide settings that apply across all clients — session timeout, file size limits, default confidence threshold, feature flags for Wave 2 features, etc. Managed by `system_admin` role only.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, NN | |
| `config_key` | TEXT | NN, UQ | Namespaced key, e.g. "auth.session_timeout_hours", "upload.max_file_size_mb", "extraction.default_confidence_threshold", "feature.sharepoint_enabled" |
| `config_value` | TEXT | NN | Value as string. Parse to appropriate type in application code |
| `data_type` | TEXT | NN | `STRING` \| `INTEGER` \| `REAL` \| `BOOLEAN` \| `JSON` — tells the application how to parse |
| `description` | TEXT | | Human-readable description of what this setting controls |
| `is_sensitive` | INTEGER | NN, DEF 0 | 1 = value is masked in API responses and logs (e.g., API keys, connection strings) |
| `updated_by` | INTEGER | FK → users | |
| `updated_at` | TEXT | | |
| `created_at` | TEXT | NN, DEF datetime('now') | |

**Seed values (MVP defaults):**

| config_key | config_value | data_type |
|---|---|---|
| `auth.session_timeout_hours` | `8` | INTEGER |
| `upload.max_file_size_mb` | `200` | INTEGER |
| `upload.allowed_mime_types` | `["application/pdf"]` | JSON |
| `extraction.default_confidence_threshold` | `0.80` | REAL |
| `feature.sharepoint_enabled` | `false` | BOOLEAN |
| `feature.email_notifications_enabled` | `false` | BOOLEAN |
| `pagination.default_page_size` | `50` | INTEGER |
| `retention.audit_log_years` | `7` | INTEGER |

---

*Document continues in: [03_Data_Flow_Architecture.md](03_Data_Flow_Architecture.md)*
