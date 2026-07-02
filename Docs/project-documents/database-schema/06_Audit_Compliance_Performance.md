# Database Schema Design — Invoice Validation & Review Platform
## Document 06: Audit, Compliance, Performance & Assumptions

**Document Version:** 1.0
**Date:** 2 July 2026
**Prepared by:** Senior Database Architect, EY
**Status:** OFFICIAL DESIGN REFERENCE — For Implementation

---

## 1. Audit & Compliance Framework

### 1.1 Audit Tables Summary

| Table | Purpose | Write Pattern | Access |
|---|---|---|---|
| `audit_events` | Package lifecycle events (created, confirmed, approved) | Append-only | All roles read; only system writes |
| `review_action_logs` | Every reviewer UI action (accept, override, view PDF, filter) | Append-only | invoice_reviewer, auditor, system_admin |
| `data_change_logs` | Human edits to AI-extracted canonical values | Append-only | auditor, system_admin (restricted) |
| `exception_resolutions` | Formal exception decisions with comments | Append-only | auditor, system_admin, relevant reviewer |
| `activity_logs` | System pipeline messages (Activity Feed) | Append-only | All roles read |
| `user_sessions` | Authentication events, session lifecycle | Append-only via auth | system_admin, auditor |
| `api_integration_logs` | All external API calls (Azure, SharePoint) | Append-only | system_admin, auditor |

### 1.2 The Complete Audit Chain for a Single Value

For any monetary value in any approved package, an auditor can construct the complete chain:

```
STEP 1: Identify the canonical record
  gc_pay_application_sov_lines (id=X, work_completed_this=124500.00)

STEP 2: Find the AI extraction that produced it
  raw_extracted_fields WHERE field_name='work_completed_this' AND page_no=12
    → raw_value="$124,500.00", confidence=0.97, bbox=(120.5, 340.2, 80.0, 12.0)
    → agent_run_id="abc-123-def"

STEP 3: Find the API call that ran the extraction
  api_integration_logs WHERE agent_run_id='abc-123-def'
    → Azure Document Intelligence, analyzeDocument, 200 OK, 1.4s

STEP 4: Find any human corrections
  data_change_logs WHERE entity_type='GC_SOV_LINE' AND entity_id=X
    → Changed from 124500 to 124000 by Jane Smith at 14:32 UTC. Reason: "OCR misread trailing zero"

STEP 5: Find the exception this triggered
  exceptions WHERE entity_type='GC_SOV_LINE' AND entity_id=X
    → FILE1_VS_FILE2 exception, $500 variance, risk_rank=15

STEP 6: Find how the exception was resolved
  exception_resolutions WHERE exception_id=Y
    → Accepted by John Doe at 15:02 UTC. Comment: "Confirmed correct with sub-contractor"

STEP 7: Find the package approval
  audit_events WHERE package_id=Z AND event_type='APPROVED'
    → Approved by Sarah Chen at 16:45 UTC

STEP 8: Find all reviewer UI actions on this item
  review_action_logs WHERE entity_type='GC_SOV_LINE' AND entity_id=X
    → VIEW_EXCEPTION at 14:28, OVERRIDE at 14:32, PDF_VIEWED at 14:30
```

### 1.3 Change History Requirements

| Entity | Change History Method | Granularity |
|---|---|---|
| Package status | `audit_events` event_type transitions | Per state change |
| Extracted financial values | `data_change_logs` (field-level) | Per field per edit |
| Exception status | `exception_resolutions` (append-only) | Per decision |
| User role assignments | `user_roles.revoked_at` + `audit_events` | Per assignment/revocation |
| Contract config changes | `audit_events` (SYSTEM_CONFIG_CHANGED) + `updated_at` | Per save |
| Agent plan | Immutable — no changes permitted | N/A |
| Raw extracted fields | Immutable — never changed | N/A |

### 1.4 Compliance Considerations

| Requirement | How the Schema Addresses It |
|---|---|
| **SOX-equivalent AP controls** | Separation of duties (reviewer ≠ approver) enforced structurally; full audit chain per invoice |
| **Non-repudiation** | Every decision tied to `user_id` + `display_name` + timestamp + before/after values |
| **Auditability of AI decisions** | `raw_extracted_fields` stores every AI output; `data_change_logs` captures every human override |
| **Right to audit** | `auditor` role provides read-only access to all tables including full trace |
| **Evidence retention** | PDF files retained in SharePoint with Purview labels; database records retained per `system_configs.retention.audit_log_years` |
| **Regulatory reporting** | `audit_events.event_summary` JSON provides structured data for compliance reports |

---

## 2. Data Retention Policies

### 2.1 Retention Schedule

| Data Category | Tables | Retention Period | Basis |
|---|---|---|---|
| Package financial data | `packages`, `gc_pay_application_*`, `sub_pay_application_*`, `supporting_document_items` | 7 years | Standard AP audit requirement |
| Audit logs | `audit_events`, `review_action_logs`, `data_change_logs`, `exception_resolutions` | 7 years | Compliance / internal audit |
| Raw extraction data | `raw_extracted_fields` | 7 years | Linked to financial data |
| PDF documents | `package_documents` (metadata), SharePoint (files) | 7 years | Document retention policy |
| Activity logs (pipeline messages) | `activity_logs` | 2 years | Operational; lower value after package approved |
| API integration logs | `api_integration_logs` | 1 year | Operational debugging; lower long-term value |
| User sessions | `user_sessions` | 90 days after expiry | Security; short-term |
| Notifications | `notifications` | 1 year | Operational |

### 2.2 Soft Delete Strategy

All business entities use soft delete (`is_active = 0`) rather than hard delete:

| Table | Soft Delete Column | Hard Delete Rule |
|---|---|---|
| `clients` | `is_active` | Never — unless legal instruction |
| `users` | `is_active` | Never — audit trail requires user identity |
| `contracts` | `is_active` | Never |
| `packages` | `package_status` = 'ARCHIVED' | After retention period via scheduled purge |
| All financial tables | Inherits from package status | Same as packages |
| `activity_logs` | None — purge after 2 years | Scheduled DELETE WHERE created_at < ? |
| `api_integration_logs` | None — purge after 1 year | Scheduled DELETE WHERE created_at < ? |
| `user_sessions` | `revoked_at` | Purge 90 days after expiry |

### 2.3 Archival Strategy

When a package is older than 7 years:
1. Export package and all related records to Azure Blob Storage as JSON (cold archive)
2. Export PDF documents to long-term SharePoint archive library
3. Delete canonical rows from the active database
4. Retain a summary record in `packages` with `package_status = 'PURGED'` and a reference to the archive location

---

## 3. Indexing Strategy

### 3.1 Index Design Principles

1. **Every foreign key column is indexed.** Without this, JOIN queries on large tables perform full table scans.
2. **Status columns are indexed.** Operational queries almost always filter by status (e.g., `WHERE package_status = 'IN_REVIEW'`).
3. **Timestamp columns are indexed on audit tables.** Date-range queries on `created_at` are the standard audit access pattern.
4. **Low-cardinality columns use partial indexes.** e.g., `is_active` on a table where 99% of rows have `is_active = 1` — index only the active rows.

### 3.2 Complete Index List

```sql
-- IDENTITY & ACCESS
CREATE INDEX idx_users_client_id ON users(client_id);
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_entra_oid ON users(entra_oid) WHERE entra_oid IS NOT NULL;
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_client_id ON user_roles(client_id);
CREATE UNIQUE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- CONTRACTS
CREATE INDEX idx_contracts_client_id ON contracts(client_id);
CREATE UNIQUE INDEX idx_contract_configs_contract_id ON contract_configs(contract_id);

-- PACKAGES
CREATE UNIQUE INDEX idx_packages_period ON packages(contract_id, billing_period_month, billing_period_year);
CREATE INDEX idx_packages_client_id ON packages(client_id);
CREATE INDEX idx_packages_contract_id ON packages(contract_id);
CREATE INDEX idx_packages_status ON packages(package_status);
CREATE INDEX idx_packages_year ON packages(billing_period_year);

-- PACKAGE DOCUMENTS
CREATE UNIQUE INDEX idx_package_docs_role ON package_documents(package_id, file_role);
CREATE INDEX idx_package_docs_status ON package_documents(upload_status);

-- DOCUMENT PAGES
CREATE UNIQUE INDEX idx_doc_pages_page ON document_pages(package_document_id, page_no);
CREATE INDEX idx_doc_pages_classification ON document_pages(classification);

-- PIPELINE STEPS
CREATE UNIQUE INDEX idx_pipeline_steps ON processing_pipeline_steps(package_id, step_no);
CREATE INDEX idx_pipeline_status ON processing_pipeline_steps(status);

-- RAW EXTRACTION
CREATE INDEX idx_raw_package_doc ON raw_extracted_fields(package_document_id);
CREATE INDEX idx_raw_agent_run ON raw_extracted_fields(agent_run_id);
CREATE INDEX idx_raw_page ON raw_extracted_fields(page_no);
CREATE INDEX idx_raw_field_name ON raw_extracted_fields(field_name);
CREATE INDEX idx_raw_confidence ON raw_extracted_fields(extraction_confidence);

-- GC DATA
CREATE UNIQUE INDEX idx_gc_header_package ON gc_pay_application_headers(package_id);
CREATE INDEX idx_gc_sov_package ON gc_pay_application_sov_lines(package_id);
CREATE INDEX idx_gc_sov_contractor ON gc_pay_application_sov_lines(contractor_name);
CREATE INDEX idx_gc_sov_status ON gc_pay_application_sov_lines(validation_status);
CREATE INDEX idx_gc_sov_plan_item ON gc_pay_application_sov_lines(agent_plan_item_id);

-- SUB DATA
CREATE INDEX idx_sub_header_package ON sub_pay_application_headers(package_id);
CREATE INDEX idx_sub_header_plan_item ON sub_pay_application_headers(agent_plan_item_id);
CREATE INDEX idx_sub_header_name ON sub_pay_application_headers(subcontractor_name);
CREATE INDEX idx_sub_sov_package ON sub_pay_application_sov_lines(package_id);
CREATE INDEX idx_sub_sov_sub_app ON sub_pay_application_sov_lines(sub_app_id);

-- FILE 3
CREATE INDEX idx_support_package ON supporting_document_items(package_id);
CREATE INDEX idx_support_sov_link ON supporting_document_items(linked_sov_line_id);
CREATE INDEX idx_support_doc_type ON supporting_document_items(document_type);

-- VALIDATION
CREATE INDEX idx_val_runs_package ON validation_runs(package_id);
CREATE INDEX idx_recon_package ON reconciliation_results(package_id);
CREATE INDEX idx_recon_run ON reconciliation_results(validation_run_id);
CREATE INDEX idx_recon_passed ON reconciliation_results(passed);
CREATE INDEX idx_exc_groups_package ON exception_groups(package_id);
CREATE INDEX idx_exc_groups_type ON exception_groups(exception_type_code);
CREATE INDEX idx_exceptions_package ON exceptions(package_id);
CREATE INDEX idx_exceptions_group ON exceptions(exception_group_id);
CREATE INDEX idx_exceptions_type ON exceptions(exception_type_code);
CREATE INDEX idx_exceptions_status ON exceptions(status);
CREATE INDEX idx_exceptions_risk ON exceptions(risk_rank);

-- REVIEW
CREATE INDEX idx_resolutions_exception ON exception_resolutions(exception_id);
CREATE INDEX idx_action_logs_package ON review_action_logs(package_id);
CREATE INDEX idx_action_logs_user ON review_action_logs(user_id);
CREATE INDEX idx_action_logs_time ON review_action_logs(created_at);

-- AUDIT
CREATE INDEX idx_audit_events_package ON audit_events(package_id);
CREATE INDEX idx_audit_events_type ON audit_events(event_type);
CREATE INDEX idx_audit_events_time ON audit_events(triggered_at);
CREATE INDEX idx_activity_logs_package ON activity_logs(package_id);
CREATE INDEX idx_activity_logs_time ON activity_logs(created_at);
CREATE INDEX idx_changes_package ON data_change_logs(package_id);
CREATE INDEX idx_changes_entity ON data_change_logs(entity_type, entity_id);
CREATE INDEX idx_changes_time ON data_change_logs(changed_at);

-- NOTIFICATIONS
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = 0;
CREATE INDEX idx_notifications_time ON notifications(created_at);

-- INTEGRATION
CREATE INDEX idx_api_logs_package ON api_integration_logs(package_id);
CREATE INDEX idx_api_logs_service ON api_integration_logs(service_name);
CREATE INDEX idx_api_logs_time ON api_integration_logs(created_at);
```

---

## 4. Performance & Scalability Strategy

### 4.1 Expected Query Patterns and Performance Targets

| Query | Frequency | Target Response | Optimisation |
|---|---|---|---|
| Load package workbench (exceptions list) | Every screen load | < 200ms | Index on `exceptions(package_id, status)` |
| Activity Feed poll (new messages) | Every 3 seconds during processing | < 50ms | Index on `activity_logs(package_id, created_at)` |
| Evidence Viewer: load exception detail | Per exception click | < 100ms | Denormalised bbox on `exceptions` |
| Finance Approver dashboard | Per page load | < 500ms | Pre-computed `packages.*_count` columns |
| Audit trace: full value history | On demand | < 2s | Indexes on all audit tables by entity |
| Power BI: monthly exceptions report | Nightly refresh | < 30s | Aggregation views + Azure SQL read replica |
| Package list (homepage) | Per page load | < 300ms | Index on `packages(client_id, package_status)` |

### 4.2 Denormalisation Strategy

Several columns are deliberately denormalised on `packages` to avoid expensive COUNT/SUM queries on every dashboard load:

```sql
-- These are computed at PROCESSING_COMPLETE and kept in sync:
packages.total_items_extracted  -- avoids COUNT(gc_pay_application_sov_lines)
packages.auto_cleared_count     -- avoids complex subtraction
packages.exceptions_count       -- avoids COUNT(exceptions WHERE status='open')
packages.dollar_at_risk         -- avoids SUM(exceptions.dollar_at_risk)
```

These columns are updated atomically when:
1. `validation_runs` is completed (initial write)
2. Exceptions are resolved (decremental update to `exceptions_count` and `dollar_at_risk`)

### 4.3 Query Optimisation Patterns

**Pattern 1: Always scope by client_id first**
```sql
-- Efficient: client_id filter uses the index, dramatically reduces the scan
SELECT * FROM packages
WHERE client_id = ?  -- hits idx_packages_client_id first
  AND package_status = 'IN_REVIEW'
```

**Pattern 2: Use the denormalised summary columns for dashboards**
```sql
-- Dashboard query: use pre-computed columns, no JOINs to exceptions table
SELECT id, billing_period_label, package_status,
       total_items_extracted, auto_cleared_count, exceptions_count, dollar_at_risk
FROM packages
WHERE contract_id = ?
ORDER BY billing_period_year DESC, billing_period_month DESC
```

**Pattern 3: Pagination for large result sets**
```sql
-- All list endpoints use cursor-based or offset pagination
SELECT * FROM gc_pay_application_sov_lines
WHERE package_id = ?
ORDER BY id ASC
LIMIT 50 OFFSET ?
```

**Pattern 4: Activity Feed incremental load**
```sql
-- Activity feed polls for new messages since last received id
SELECT * FROM activity_logs
WHERE package_id = ? AND id > ?  -- ? = last seen id (avoids full table scan)
ORDER BY id ASC
LIMIT 100
```

### 4.4 Azure SQL Production Optimisations

When migrating to Azure SQL:

| Optimisation | Implementation |
|---|---|
| Read replica for reporting | Azure SQL Geo-Replica (read-only) for Power BI and audit queries |
| Query Store | Enable Query Store to automatically identify and tune slow queries |
| Columnstore index | Add non-clustered columnstore index on `raw_extracted_fields` for large-volume analytical queries |
| Automatic tuning | Enable Azure SQL Automatic Tuning (CREATE/DROP INDEX recommendations) |
| Connection pooling | Use Azure SQL connection pooling; set max pool size = 50 for the API layer |
| Partitioning | Partition `raw_extracted_fields`, `activity_logs`, `review_action_logs` by month |

---

## 5. Assumptions and Dependencies

### 5.1 Confirmed Requirements

| # | Requirement | Source |
|---|---|---|
| CR-01 | One package per billing period per contract (UNIQUE constraint) | BR discussion |
| CR-02 | Raw extracted values are immutable; corrections tracked separately | BRD P2 |
| CR-03 | Exception types are extensible via reference table (no schema changes) | BR discussion |
| CR-04 | Separation of duties: reviewer ≠ approver enforced at API layer | BRD S-46 |
| CR-05 | Contract validation rules are hardcoded per contract (no ingestion) | Design decision |
| CR-06 | Period-to-period continuity is a required validation check | BR discussion |
| CR-07 | File 3 requires structured extraction (classify + extract amounts) | BR discussion |
| CR-08 | Bounding boxes required for Evidence Viewer (to be added to extraction pipeline) | BR discussion |
| CR-09 | Full RBAC with multi-tenant isolation required | BR discussion |
| CR-10 | 7-year data retention for financial records | Standard AP compliance |
| CR-11 | Agent plan is write-once after user confirmation on Screen 4 | L2 User Journey |
| CR-12 | Money math is always deterministic (never LLM) | BRD P2 |

### 5.2 Assumptions Made

| # | Assumption | Impact if Wrong |
|---|---|---|
| A-01 | SQLite is sufficient for MVP (1–3 contracts, < 5 users simultaneously) | Migration to Azure SQL required sooner; schema is compatible |
| A-02 | One currency (USD) per platform — no multi-currency per package | `currency` columns exist and defaulted to USD; multi-currency requires exchange rate tables |
| A-03 | Bounding box coordinates will be available from the extraction pipeline (to be built) | Evidence Viewer will work without highlight overlays until pipeline is updated; bbox columns remain NULL |
| A-04 | One billing period = one calendar month | If billing periods are arbitrary date ranges, `billing_period_month/year` columns must be replaced with `period_from/to` dates |
| A-05 | Each sub-contractor appears once per package in File 2 | Multiple applications per sub per package require changes to the agent plan matching logic |
| A-06 | G702/G703 AIA standard forms are the primary document type in Files 1 and 2 | Non-standard forms reduce extraction accuracy; `document_type` column captures this |
| A-07 | The validation engine will be implemented as a deterministic Python/SQL service | If implemented as an LLM, the money math principle (P3) is violated |
| A-08 | No contract SOV ingestion in Wave 1; contract_configs covers all validation rules | If contract-level SOV matching is required in Wave 1, `contract_sov_items` table must be added |
| A-09 | Single database for all clients (shared schema, row-level isolation) | If clients require physical database isolation, separate databases per client are needed |

### 5.3 Open Questions

| # | Question | Impact | Owner |
|---|---|---|---|
| OQ-01 | What is the process for initial user provisioning — will EY admins create all users, or self-registration? | Affects `users` table creation workflow and the auth flow | Product Owner |
| OQ-02 | Are there change orders in Wave 1? If so, how are they captured? | `contract_configs.original_contract_sum` is static; CO tracking requires additional columns or Wave 2 tables | Commercial Lead |
| OQ-03 | What is the target go-live date and expected package volume at launch? | Determines if SQLite is viable or if Azure SQL migration must happen before launch | Project Manager |
| OQ-04 | Is email notification required at launch, or is in-app only acceptable for MVP? | `notifications.email_sent` column is ready; email service integration is not | Product Owner |
| OQ-05 | Will the same invoice reviewer work across multiple contracts/clients, or is each reviewer dedicated to one client? | Affects `user_roles.client_id` scoping design | HR / Operations Lead |
| OQ-06 | Is there a formal data classification requirement (e.g., GDPR, CCPA) for the personal data stored (user names, emails)? | May require privacy notice, data subject rights support, and PII masking in audit logs | Legal / Privacy |
| OQ-07 | What is the escalation SLA for `BLOCKING` exceptions? Should the system enforce time-based escalation? | Requires a scheduler + additional columns (`sla_due_at`, `sla_breached_at`) on `exceptions` | Operations Lead |
| OQ-08 | Are there sub-contractor master data requirements beyond the `agent_plan_items.subcontractor_name`? | Wave 2 `vendors` table design depends on this | Commercial Lead |

### 5.4 Dependencies

| Dependency | Required by | Status |
|---|---|---|
| Azure Document Intelligence API access | AI extraction pipeline (Steps 3, 5, 6) | To be provisioned |
| Azure OpenAI API access | Fuzzy name matching (between Steps 5 and 7) | To be provisioned |
| Azure Blob Storage or SharePoint site | File storage in production | To be provisioned |
| Entra ID tenant and app registration | Production authentication | To be provisioned by IT |
| Python extraction service with bbox output | `raw_extracted_fields.bbox_*` columns | To be developed |
| Bounding box format standardisation | Evidence Viewer rendering | Requires coordinate system agreement (points vs inches) |
| `contract_configs` data entry | Validation engine cannot run without rules | System Admin must configure before first package |

### 5.5 Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| R-01: SQLite file size growth with large packages | Medium | High | Monitor `.db` file; migrate at 1GB or before 3 concurrent contracts |
| R-02: Missing bounding boxes from extraction pipeline | High | Medium | Evidence Viewer degrades gracefully (no highlight overlay, but still navigates to correct page) |
| R-03: Sub-contractor name fuzzy matching failures | Medium | Medium | Manual override available on Screen 4; `agent_plan_items.is_manually_added` flag captures this |
| R-04: G702/G703 non-standard form variants | Medium | Medium | `document_type` column captures variance; `raw_json` on sub_pay_application_headers preserves full payload |
| R-05: Period continuity check on first package (no prior period) | High | Low | Check is skipped if no prior-period package exists; `contract_configs.period_continuity_check = 0` disables globally |
| R-06: Entra ID migration complexity | Low | High | Schema is designed for both auth methods simultaneously; migration is a column-swap with no structural change |
| R-07: Concurrent writes to SQLite | Low (MVP) | High | SQLite serialises writes; safe for < 5 concurrent users. Migrate to Azure SQL before going multi-user at scale |

---

## 6. Wave Roadmap Summary

### Wave 1 (Current — MVP)
- 36-table schema as defined in this document
- SQLite database
- All core extraction, validation, review, and audit flows
- Hardcoded contract rules via `contract_configs`

### Wave 2 (Planned)
| Addition | New Tables |
|---|---|
| Contract SOV ingestion | `contract_baseline_versions`, `contract_sov_items` |
| Vendor master data approval | `vendors`, `master_data_candidates` |
| Email notifications | Integration with SendGrid/Azure Communication Services (no new tables) |
| Budget baseline | `budget_baseline_versions`, `cost_to_complete_snapshots` |
| Contract rate card | `contract_rate_cards` |
| Configurable rules engine | `validation_rule_configs` |
| AI accuracy measurement | `ground_truth_labels`, `user_feedback_logs` |

### Wave 3 (Future)
| Addition | Description |
|---|---|
| Forecasting (ETC/EAC/VAC) | Cost-to-complete analytics |
| Multi-currency | Exchange rate tables, currency conversion |
| Mobile app (Power Apps) | Custom connector to existing API |
| Portfolio dashboards | Cross-contract, cross-client analytics |

---

## 7. Document Index

| Document | Contents |
|---|---|
| [01_Executive_Summary_and_ERD.md](01_Executive_Summary_and_ERD.md) | Architecture overview, design principles, ERD, relationship cardinality, scalability |
| [02_Table_Definitions.md](02_Table_Definitions.md) | All 36 tables with complete column definitions, constraints, and business purpose |
| [03_Data_Flow_Architecture.md](03_Data_Flow_Architecture.md) | 10 end-to-end data flow traces from project setup through reporting |
| [04_Security_Architecture.md](04_Security_Architecture.md) | User management, RBAC, multi-tenant isolation, authentication, audit requirements |
| [05_Integration_Architecture.md](05_Integration_Architecture.md) | SharePoint, Azure Document Intelligence, Azure OpenAI, Power BI, integration logging |
| **[06_Audit_Compliance_Performance.md](06_Audit_Compliance_Performance.md)** | **This document** — Audit framework, retention, indexing, performance, assumptions, risks |

---

**Document Control**

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2 July 2026 | EY Senior Database Architect | Initial release — 36-table Wave 1 MVP schema |
