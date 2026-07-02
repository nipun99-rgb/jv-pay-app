# Database Schema Design — Invoice Validation & Review Platform
## Document 01: Executive Summary & Entity Relationship Model

**Document Version:** 1.0
**Date:** 2 July 2026
**Prepared by:** Senior Database Architect, EY
**Status:** OFFICIAL DESIGN REFERENCE — For Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Principles](#2-design-principles)
3. [Database Selection & Technology Stack](#3-database-selection--technology-stack)
4. [Complete Table Inventory](#4-complete-table-inventory)
5. [Entity Relationship Model](#5-entity-relationship-model)
6. [Relationship Cardinality Matrix](#6-relationship-cardinality-matrix)
7. [Business Rules Governing Relationships](#7-business-rules-governing-relationships)
8. [Scalability Considerations](#8-scalability-considerations)

---

## 1. Executive Summary

### 1.1 Purpose

This document is the **official database design specification** for the Invoice Validation and Invoice Review Platform — an AI-assisted accounts payable review system for General Contractor (GC) payment applications in the construction industry.

The platform processes monthly invoice packages submitted by General Contractors, each comprising up to three files:
- **File 1** — Consolidated Contractor Invoice (G702 Cover Page + G703 Continuation Sheet)
- **File 2** — Sub-Contractor Breakdown (all sub-contractor pay applications compiled)
- **File 3** — Supporting Documents (direct cost backup: receipts, invoices, delivery tickets)

The system orchestrates a 9-step AI extraction pipeline, a deterministic validation engine, a human-in-the-loop (HITL) review workbench, and a full audit trail. The database is the canonical source of truth for all extracted data, validation outputs, reviewer decisions, and audit events.

### 1.2 Platform Overview

The platform supports four operational workflows:
1. **Contract Onboarding** — Capturing contract details and validation rules
2. **Monthly Package Processing** — The core AI extraction and validation pipeline (9 stages)
3. **Human Review** — Reviewer workbench for triaging and resolving exceptions
4. **Package Approval** — Finance Approver final sign-off with separation of duties

### 1.3 Scope of the Database Design

The schema covers **33 tables** across **15 functional families**:

| Functional Area | Tables |
|---|---|
| Identity, Access & Security | 5 |
| Contract Master & Configuration | 2 |
| Reference / Lookup | 3 |
| Package & Document Management | 4 |
| Agent Planning | 2 |
| AI Extraction Staging | 1 |
| Contractor Data — File 1 | 2 |
| Sub-Contractor Data — File 2 | 2 |
| Supporting Documents — File 3 | 1 |
| Validation Engine Output | 4 |
| Review & Resolution | 2 |
| Audit & Change History | 3 |
| Notifications & Alerts | 2 |
| External Integration Logging | 2 |
| System Configuration | 1 |
| **TOTAL** | **36 tables** |

---

## 2. Design Principles

The following principles govern every design decision in this schema. They are non-negotiable and inherited from the BRD (`04_Architecture_and_Data_Model.md`).

### P1 — Separation of Concerns
Agents (extract/propose) are separated from the rules engine (validate/compute), which is separated from the canonical store (truth), which is separated from the review layer (decide). No layer reaches across another's responsibility. This is enforced structurally in the schema by family separation.

### P2 — Raw Data is Immutable
Every value extracted by the AI agent is written to `raw_extracted_fields` once and never modified. Corrections applied by human reviewers create new records in the canonical tables and are tracked in `data_change_logs`. The original AI output is always preserved for accuracy measurement and audit.

### P3 — Deterministic Money Math
All monetary arithmetic, reconciliation checks, and validation rules run in deterministic SQL or Python services — never in an LLM. The `reconciliation_results` table stores the pass/fail output of every check. Amounts are stored as REAL (SQLite) / DECIMAL(18,2) (Azure SQL) — never as TEXT.

### P4 — Audit by Construction
Every financial value carries a provenance chain: document → page → bounding box → confidence score → agent run. Every human decision carries: user → timestamp → before/after → reason. Audit is not a layer on top of the schema — it is baked into every table.

### P5 — Extensible Exception Framework
Exception types are rows in `ref_exception_types`, not hardcoded in application logic or schema. Adding a new validation check = one INSERT statement. No schema migration, no deployment.

### P6 — Contract Rules are Configuration, Not Schema
For MVP, contract-specific validation rules (retainage rate, tolerance thresholds, continuity checks) are stored in `contract_configs` as data. This avoids a complex contract ingestion workflow while keeping all rules explicit, auditable, and per-contract configurable.

### P7 — One Package Per Billing Period Per Contract
A `UNIQUE(contract_id, billing_period_month, billing_period_year)` constraint on `packages` prevents the most common accounts payable data quality failure — duplicate submission of the same monthly package.

### P8 — Separation of Duties
A package's `reviewed_by` must differ from `approved_by`. Enforced at the API layer before any approval record is written. This satisfies the BRD requirement (S-46) and standard accounts payable internal controls.

### P9 — Soft Delete Over Hard Delete
No production record is hard-deleted. All tables carry `is_active` (or equivalent). Deactivated records are excluded from operational queries but retained for audit. Physical deletion only occurs under a defined data retention purge process.

### P10 — Forward Compatibility
The schema is designed for Wave 1 MVP (SQLite) but all column types, naming conventions, and constraint patterns are chosen to migrate cleanly to Azure SQL. The `table-schema.md` describes the 96-table canonical target model; this document is the Wave 1 pragmatic subset.

---

## 3. Database Selection & Technology Stack

### MVP Phase
| Component | Technology |
|---|---|
| Database Engine | SQLite (via `sql.js` — in-memory, persisted to `projects.db`) |
| ORM / Query Layer | Raw SQL via `sql.js` prepared statements |
| Backend | Node.js + Express |
| Authentication | Email + password hash (temporary) |
| File Storage | Local disk (`/uploads/` directory) |

### Production Target
| Component | Technology |
|---|---|
| Database Engine | Azure SQL (SQL Server 2022 compatible) |
| ORM / Query Layer | Direct ADO.NET / Prisma / TypeORM (TBD by engineering) |
| Authentication | Microsoft Entra ID (Azure AD) — OIDC/OAuth 2.0 |
| File Storage | Azure Blob Storage / SharePoint Document Libraries |
| Orchestration | Azure Functions / Power Automate |
| AI Extraction | Azure Document Intelligence + Azure OpenAI |
| Reporting | Power BI (DirectQuery on Azure SQL) |

### Migration Mapping (SQLite → Azure SQL)
| SQLite Type | Azure SQL Type |
|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGINT IDENTITY(1,1)` |
| `TEXT NOT NULL` | `NVARCHAR(255) NOT NULL` |
| `TEXT` (long form) | `NVARCHAR(MAX)` |
| `REAL` | `DECIMAL(18,2)` |
| `INTEGER` (flags/booleans) | `BIT` |
| `TEXT` (dates) | `DATETIME2(3)` |
| `TEXT` (UUIDs) | `UNIQUEIDENTIFIER` |

---

## 4. Complete Table Inventory

### 36 Tables — Master List

| # | Table Name | Family | Type | Wave |
|---|---|---|---|---|
| 1 | `clients` | Identity & Access | Master | 1 |
| 2 | `users` | Identity & Access | Master | 1 |
| 3 | `roles` | Identity & Access | Master | 1 |
| 4 | `user_roles` | Identity & Access | Junction | 1 |
| 5 | `user_sessions` | Identity & Access | Operational | 1 |
| 6 | `contracts` | Contract Master | Master | 1 |
| 7 | `contract_configs` | Contract Master | Configuration | 1 |
| 8 | `ref_exception_types` | Reference | Lookup | 1 |
| 9 | `ref_document_types` | Reference | Lookup | 1 |
| 10 | `ref_validation_rule_types` | Reference | Lookup | 1 |
| 11 | `packages` | Package & Document | Transaction | 1 |
| 12 | `package_documents` | Package & Document | Transaction | 1 |
| 13 | `document_pages` | Package & Document | Transaction | 1 |
| 14 | `processing_pipeline_steps` | Package & Document | Workflow | 1 |
| 15 | `agent_plans` | Agent Planning | Transaction | 1 |
| 16 | `agent_plan_items` | Agent Planning | Transaction | 1 |
| 17 | `raw_extracted_fields` | AI Extraction Staging | Staging | 1 |
| 18 | `gc_pay_application_headers` | Contractor Data (File 1) | Transaction | 1 |
| 19 | `gc_pay_application_sov_lines` | Contractor Data (File 1) | Transaction | 1 |
| 20 | `sub_pay_application_headers` | Sub-Contractor Data (File 2) | Transaction | 1 |
| 21 | `sub_pay_application_sov_lines` | Sub-Contractor Data (File 2) | Transaction | 1 |
| 22 | `supporting_document_items` | Supporting Documents (File 3) | Transaction | 1 |
| 23 | `validation_runs` | Validation Engine | Transaction | 1 |
| 24 | `reconciliation_results` | Validation Engine | Transaction | 1 |
| 25 | `exception_groups` | Validation Engine | Transaction | 1 |
| 26 | `exceptions` | Validation Engine | Transaction | 1 |
| 27 | `exception_resolutions` | Review & Resolution | Transaction | 1 |
| 28 | `review_action_logs` | Review & Resolution | Audit | 1 |
| 29 | `audit_events` | Audit & Change History | Audit | 1 |
| 30 | `activity_logs` | Audit & Change History | Operational | 1 |
| 31 | `data_change_logs` | Audit & Change History | Audit | 1 |
| 32 | `notifications` | Notifications & Alerts | Operational | 1 |
| 33 | `notification_preferences` | Notifications & Alerts | Configuration | 1 |
| 34 | `api_integration_logs` | External Integration | Audit | 1 |
| 35 | `sharepoint_document_refs` | External Integration | Integration | 1 |
| 36 | `system_configs` | System Configuration | Configuration | 1 |

---

## 5. Entity Relationship Model

### 5.1 Top-Level Hierarchy

```
CLIENTS
 │
 ├──< USERS >──< USER_ROLES >── ROLES
 │    └──< USER_SESSIONS
 │
 └──< CONTRACTS
      │
      └── CONTRACT_CONFIGS (1:1)
      │
      └──< PACKAGES
           │
           ├── PACKAGE STATUS MACHINE (10 states)
           │
           ├──< PACKAGE_DOCUMENTS (max 3: File1, File2, File3)
           │    └──< DOCUMENT_PAGES
           │         └──< RAW_EXTRACTED_FIELDS
           │
           ├──< PROCESSING_PIPELINE_STEPS (9 rows)
           │
           ├── AGENT_PLANS (1:1)
           │    └──< AGENT_PLAN_ITEMS
           │
           ├── GC_PAY_APPLICATION_HEADERS (1:1)
           │    └── [evidence: PACKAGE_DOCUMENTS → DOCUMENT_PAGES]
           │
           ├──< GC_PAY_APPLICATION_SOV_LINES
           │    └── [evidence: DOCUMENT_PAGES]
           │
           ├──< SUB_PAY_APPLICATION_HEADERS
           │    ├── [links to AGENT_PLAN_ITEMS]
           │    └──< SUB_PAY_APPLICATION_SOV_LINES
           │
           ├──< SUPPORTING_DOCUMENT_ITEMS
           │    └── [links to GC_PAY_APPLICATION_SOV_LINES]
           │
           └──< VALIDATION_RUNS
                ├──< RECONCILIATION_RESULTS
                ├──< EXCEPTION_GROUPS
                └──< EXCEPTIONS
                     └──< EXCEPTION_RESOLUTIONS
                          └── [audit: REVIEW_ACTION_LOGS]

CROSS-CUTTING:
  AUDIT_EVENTS         → packages + users
  ACTIVITY_LOGS        → packages
  DATA_CHANGE_LOGS     → packages + users
  REVIEW_ACTION_LOGS   → packages + users + exceptions
  NOTIFICATIONS        → users + packages
  API_INTEGRATION_LOGS → packages (optional)
  SHAREPOINT_DOCUMENT_REFS → package_documents
  SYSTEM_CONFIGS       → global (no FK)
```

### 5.2 The Package State Machine (Central to all relationships)

```
                         ┌─────────────────────────────────┐
                         │         PACKAGE STATES           │
                         └─────────────────────────────────┘

DRAFT ──► INGESTING ──► FILE_1_PROCESSING ──► AWAITING_PLAN_CONFIRMATION
                                                        │
                              ◄──────────────────────── ▼
FILE_2_3_PROCESSING ◄── User confirms agent plan (Screen 4)
        │
        ▼
PROCESSING_COMPLETE ──► IN_REVIEW ──► HITL_COMPLETE ──► IN_VALIDATION
                                                               │
                                              ┌────────────────┴────────────┐
                                              ▼                             ▼
                                          APPROVED                       REJECTED
```

Every state transition writes an `audit_events` row. The `packages.package_status` column is the authoritative state indicator queried by the UI and all downstream processes.

### 5.3 The Validation Evidence Chain

Every financial value in the system carries a complete provenance chain:

```
raw_extracted_fields
  ├── package_document_id → package_documents → packages
  ├── page_no → document_pages
  ├── bbox_x, bbox_y, bbox_width, bbox_height  (where on the page)
  ├── extraction_confidence                     (how confident the AI was)
  └── agent_run_id                             (which extraction run produced it)

gc_pay_application_sov_lines (canonical)
  ├── package_id → packages
  ├── bbox_x/y/width/height                    (for Evidence Viewer highlight)
  ├── extraction_confidence                     (for LOW_CONFIDENCE exception)
  └── [human edits captured in data_change_logs]

exceptions
  ├── evidence_document_id → package_documents  (File 1 page)
  ├── evidence_page_no + evidence_bbox_*        (exact location)
  ├── evidence2_document_id → package_documents (File 2 page, for variance exceptions)
  └── evidence2_page_no + evidence2_bbox_*
```

### 5.4 The Cross-File Reconciliation Join Path

```sql
-- How File 1 (GC) and File 2 (Sub) are reconciled per sub-contractor:
gc_pay_application_sov_lines (gl)
  JOIN agent_plan_items (api) ON api.subcontractor_name = gl.contractor_name
  JOIN sub_pay_application_headers (sah) ON sah.agent_plan_item_id = api.id
  -- Key comparison:
  -- gl.work_completed_this      ← GC billed amount for this sub (File 1)
  -- sah.g703_work_this_period   ← Sub's own declared amount (File 2)
  -- gl.cross_file_variance      = gl.work_completed_this - sah.g703_work_this_period
```

---

## 6. Relationship Cardinality Matrix

| Parent Table | Child Table | Cardinality | Constraint |
|---|---|---|---|
| `clients` | `users` | 1 : many | FK(client_id) |
| `clients` | `contracts` | 1 : many | FK(client_id) |
| `contracts` | `contract_configs` | 1 : 1 | FK + UNIQUE |
| `contracts` | `packages` | 1 : many | FK(contract_id) |
| `packages` | `package_documents` | 1 : 3 | FK + UNIQUE(package_id, file_role) |
| `packages` | `processing_pipeline_steps` | 1 : 9 | FK + UNIQUE(package_id, step_no) |
| `packages` | `agent_plans` | 1 : 1 | FK + UNIQUE |
| `packages` | `gc_pay_application_headers` | 1 : 1 | FK + UNIQUE |
| `packages` | `gc_pay_application_sov_lines` | 1 : many | FK(package_id) |
| `packages` | `sub_pay_application_headers` | 1 : many | FK(package_id) |
| `packages` | `validation_runs` | 1 : many | FK(package_id) — multiple runs preserved |
| `package_documents` | `document_pages` | 1 : many | FK + UNIQUE(doc_id, page_no) |
| `document_pages` | `raw_extracted_fields` | 1 : many | via page_no + package_document_id |
| `agent_plans` | `agent_plan_items` | 1 : many | FK(agent_plan_id) |
| `sub_pay_application_headers` | `sub_pay_application_sov_lines` | 1 : many | FK(sub_app_id) |
| `validation_runs` | `reconciliation_results` | 1 : many | FK |
| `validation_runs` | `exception_groups` | 1 : many | FK |
| `exception_groups` | `exceptions` | 1 : many | FK |
| `exceptions` | `exception_resolutions` | 1 : many | FK — multiple resolutions preserved |
| `users` | `review_action_logs` | 1 : many | FK(user_id) |
| `users` | `notifications` | 1 : many | FK(user_id) |
| `users` | `user_sessions` | 1 : many | FK(user_id) |
| `users` | `user_roles` | many : many | via user_roles junction |
| `roles` | `user_roles` | many : many | via user_roles junction |

---

## 7. Business Rules Governing Relationships

These are enforced at the application layer (API) and where possible at the database constraint layer.

| Rule ID | Rule | Enforcement |
|---|---|---|
| BR-01 | One package per contract per billing period | `UNIQUE(contract_id, billing_period_month, billing_period_year)` on `packages` |
| BR-02 | One file per role per package | `UNIQUE(package_id, file_role)` on `package_documents` |
| BR-03 | Agent plan is write-once after confirmation | No UPDATE/DELETE permitted post-creation; enforced at API layer |
| BR-04 | `approved_by` ≠ `reviewed_by` on packages | API pre-check before writing approval |
| BR-05 | Exception override/escalation requires a comment | `comment IS NOT NULL` enforced at API layer for override/escalate resolution types |
| BR-06 | Raw extraction records are append-only | No UPDATE/DELETE on `raw_extracted_fields`; enforced at API layer |
| BR-07 | Package state transitions are one-way and sequential | State machine enforced at API layer; invalid transitions return 400 |
| BR-08 | Every exception must have an evidence document reference | `evidence_document_id IS NOT NULL` enforced before exception insertion |
| BR-09 | `% complete` cannot exceed `max_pct_complete` from `contract_configs` | Checked by validation engine; produces BLOCKING exception if violated |
| BR-10 | Baseline version effective windows must not overlap | Pre-activation check (Wave 2) |

---

## 8. Scalability Considerations

### 8.1 Volume Projections (Wave 1)
| Entity | Volume per month | Volume per year |
|---|---|---|
| Packages | 1–5 per contract | 12–60 per contract |
| Pages ingested per package | 200–1,200 | 2,400–72,000 |
| G703 SOV lines per package | 40–650 | 480–39,000 |
| Sub-contractor applications per package | 5–25 | 60–1,500 |
| Exceptions per package | 5–50 | 60–3,000 |
| Raw extracted fields per package | 500–3,000 | 6,000–180,000 |

### 8.2 SQLite Limits (MVP)
SQLite handles up to ~35 GB file size and performs well up to ~100k rows per table in a single-user scenario. For the MVP with 1–3 active contracts, SQLite is appropriate. The estimated DB size at end of year 1: **< 500 MB**.

### 8.3 Azure SQL Migration Triggers
Migrate from SQLite to Azure SQL when any of the following occur:
- More than 3 concurrent contracts
- More than 3 simultaneous users
- Total row count in any table exceeds 500,000
- Multi-tenant isolation requirements
- Power BI DirectQuery reporting is needed

### 8.4 Partitioning Strategy (Azure SQL, Wave 2)
| Table | Partition Key | Strategy |
|---|---|---|
| `raw_extracted_fields` | `created_at` (monthly) | Range partition — large volume |
| `reconciliation_results` | `created_at` (monthly) | Range partition |
| `activity_logs` | `created_at` (monthly) | Range partition |
| `review_action_logs` | `created_at` (monthly) | Range partition |
| `exceptions` | `package_id` | No partition needed at Wave 1 scale |

---

*Document continues in: [02_Table_Definitions.md](02_Table_Definitions.md)*
