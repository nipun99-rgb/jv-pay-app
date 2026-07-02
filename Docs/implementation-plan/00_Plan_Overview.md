# Invoice Validation & Review Platform
## Implementation Plan — Overview & Decision Register

**Date:** 2 July 2026
**Prepared by:** Lead Solution Architect · GitHub Copilot Advisory Session
**Status:** APPROVED FOR EXECUTION — Pending Azure SQL connection string confirmation
**Source:** Strategic Architecture Advisory, 2 July 2026

---

## 1. Scope Statement

This implementation plan covers the complete rebuild of the Invoice Validation & Review Platform — a Human-in-the-Loop (HITL) workbench for monthly GC pay application review. The plan is based exclusively on decisions and findings from the 2 July 2026 advisory session.

**What is being built:** A 9-screen, role-based, Azure-hosted web application replacing the current 5-component prototype.

**What is NOT in scope:** Any code reuse from the Lovable reference application. TypeScript. Dark mode. Mock data. SQLite.

---

## 2. Architecture Decisions Register

All 16 decisions from the 2 July 2026 Strategic Architecture Advisory are binding inputs to this plan.

| Decision | Topic | Resolution |
|---|---|---|
| D1 | Database | Azure SQL from Day 1. No SQLite phase. |
| D2 | Backend refactoring | Full decomposition of `server.js` required. New route files per functional family. |
| D3 | Authentication | Phase 1: bcrypt + `user_sessions` table. Phase 2: Entra ID (Azure AD OIDC). |
| D4 | Data model migration | 36-table Azure SQL schema built fresh. One-time migration script for existing 8-table data. |
| D5 | `projects.baseline` field | Superseded by `billing_period_month` + `billing_period_year` on `packages` table. |
| D6 | StepRail mapping | 9 steps from `processing_pipeline_steps`. Old 3-phase model retired. |
| D7 | File 2 upload timing | All 3 files uploaded at intake. File 2 processing begins only after HITL Gate 1 (agent plan confirmation). |
| D8 | Exception data model | `exceptions` + `exception_groups` tables are source of truth. `validation_status` on SOV lines is derived only. |
| D9 | File storage | Azure Blob Storage (operational processing) + SharePoint (document-of-record). Local `/uploads/` directory retired. |
| D10 | ORM / Query layer | Prisma with `@prisma/client` for Node.js. `db.js` replaced entirely. |
| D11 | Component library | shadcn/ui (React JSX variant) + Tailwind CSS v4. |
| D12 | Frontend router | React Router v6 with `createBrowserRouter`. 13 confirmed routes. |
| D13 | SharePoint integration | Architecture wired in Wave 1 (table + schema). Evidence Viewer reads from Azure Blob in Wave 1. SharePoint retrieval in Wave 2. |
| D14 | Notifications | Real, in-database. `notifications` + `notification_preferences` tables. 30-second poll. |
| D15 | Evidence Viewer | `react-pdf` (wraps PDF.js) replacing `<iframe>`. Canvas rendering. |
| D16 | State management | `AuthContext` for auth only. URL search params for filters. No Zustand. No Redux. |

---

## 3. Non-Negotiable Constraints

These carry through every sprint, every task, every code review.

| Constraint | Source |
|---|---|
| **No TypeScript** — React JS (JSX) only | Product decision |
| **No mock data anywhere** — all data from live API | Product decision |
| **No dark mode** — zero `dark:` Tailwind modifiers | Design decision |
| **No hardcoded hex colors** — CSS custom property tokens only | D11 |
| **No hardcoded URLs** — environment variable driven | RISK 4 (CORS fix) |
| **Sub-contractor filter always active** — `work_completed_this != 0` | Schema: sub SOV line filter |
| **Separation of duties enforced** — `reviewed_by ≠ approved_by` at API layer | Security architecture (Doc 04, Section 5) |
| **Soft deletes only** — `is_active = 0`, never `DELETE` on business entities | Schema: D02 retention policy |
| **`client_id` on every SELECT** — data isolation for multi-tenancy | Security architecture (Doc 04, Section 4) |
| **HITL Gate 2 is final** — no AI re-validation after HITLScreen confirm | L2 User Journey |
| **`password_hash` never in API response** | Schema: Table 2 security note |
| **`session_token` never logged** | Schema: Table 5 security note |

---

## 4. Technology Stack

### Frontend
| Layer | Technology | Version |
|---|---|---|
| Framework | React (JSX) | 18.3.1 (existing) |
| Build tool | Vite | 5.3.1 (existing) |
| Router | React Router | v6 (new) |
| Styling | Tailwind CSS | v4 (new) |
| Component primitives | shadcn/ui (Radix UI) | latest (new) |
| Icons | Lucide React | latest (new) |
| PDF rendering | react-pdf | latest (new) |
| HTTP client | Native `fetch` via `apiFetch` wrapper | (new pattern) |

### Backend
| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js 22.11.0 | Existing — keep |
| Framework | Express | Existing — keep |
| ORM | Prisma | Replaces `db.js` and `sql.js` |
| Database | Azure SQL (SQL Server 2022) | Replaces SQLite / `projects.db` |
| Auth | bcrypt (Phase 1), Entra ID (Phase 2) | New |
| File upload | Multer | Existing — keep, redirect to Azure Blob |
| AI extraction | Azure Document Intelligence | Replaces Python/PyMuPDF subprocess (Wave 2) |
| AI validation | Azure OpenAI GPT (existing deployment) | Existing — keep via env vars |
| File storage | Azure Blob Storage + SharePoint | Replaces local `/uploads/` |

### Infrastructure
| Component | Service |
|---|---|
| Database | Azure SQL — Basic (dev) / Standard S2 (staging) |
| File storage | Azure Blob Storage |
| Document records | SharePoint Document Library with Purview labels |
| App hosting | Azure App Service (tier TBD — prerequisite action) |
| Identity (Phase 2) | Microsoft Entra ID |
| Reporting (Wave 2) | Power BI DirectQuery on Azure SQL |

---

## 5. Database: Table Inventory Summary

The new schema has **36 tables** replacing the current **8 tables**.

| Family | Tables | Wave |
|---|---|---|
| Identity & Access | `clients`, `users`, `roles`, `user_roles`, `user_sessions` | 1 |
| Contract Master | `contracts`, `contract_configs` | 1 |
| Reference / Lookup | `ref_exception_types`, `ref_document_types`, `ref_validation_rule_types` | 1 |
| Package & Document | `packages`, `package_documents`, `document_pages`, `processing_pipeline_steps` | 1 |
| Agent Planning | `agent_plans`, `agent_plan_items` | 1 |
| AI Extraction Staging | `raw_extracted_fields` | 1 |
| Contractor Data (File 1) | `gc_pay_application_headers`, `gc_pay_application_sov_lines` | 1 |
| Sub-Contractor Data (File 2) | `sub_pay_application_headers`, `sub_pay_application_sov_lines` | 1 |
| Supporting Documents (File 3) | `supporting_document_items` | 1 |
| Validation Engine | `validation_runs`, `reconciliation_results`, `exception_groups`, `exceptions` | 1 |
| Review & Resolution | `exception_resolutions`, `review_action_logs` | 1 |
| Audit & Change History | `audit_events`, `activity_logs`, `data_change_logs` | 1 |
| Notifications | `notifications`, `notification_preferences` | 1 |
| External Integration | `api_integration_logs`, `sharepoint_document_refs` | 1 |
| System Configuration | `system_configs` | 1 |

**Migration mapping (8 current → 36 new):**

| Current Table | New Table(s) | Action |
|---|---|---|
| `projects` | `contracts` + `packages` | SPLIT |
| `project_phases` (3 rows) | `processing_pipeline_steps` (9 rows) | REPLACE |
| `tasks` (4 hardcoded rows) | `processing_pipeline_steps` | RETIRE |
| `line_items` | `gc_pay_application_sov_lines` | RENAME + extend |
| `cover_page` | `gc_pay_application_headers` | RENAME + extend |
| `subcontractor_applications` | `sub_pay_application_headers` | RENAME + extend |
| `sub_line_items` | `sub_pay_application_sov_lines` | RENAME + extend |
| `logs` | `activity_logs` | RENAME + extend |

---

## 6. Frontend: Confirmed Route Tree

```
/login                                → LoginScreen
/                                     → GlobalDashboard (package queue)
/contracts                            → ContractList
/packages/new                         → PackageIntakeWizard
/packages/:packageId                  → PackageLayout (outlet)
  /packages/:packageId/ingest         → IngestScreen (steps 1–2)
  /packages/:packageId/file1          → File1Screen (step 3)
  /packages/:packageId/plan           → PlanScreen (HITL Gate 1, step 4)
  /packages/:packageId/file2          → File2Screen (steps 5–6)
  /packages/:packageId/complete       → CompleteScreen (steps 7–8)
  /packages/:packageId/exceptions     → ExceptionsScreen (step 9a)
  /packages/:packageId/hitl           → HITLScreen (HITL Gate 2, step 9b)
/settings                             → SettingsScreen (system_admin only)
/reports                              → ReportsScreen
```

Route uses `packageId` not `projectId`. All routes except `/login` require authentication.

---

## 7. Processing Pipeline: 9-Step StepRail Mapping

| Step | `step_name` | Screen | HITL Gate |
|---|---|---|---|
| 1 | `FILE_UPLOAD` | IngestScreen | — |
| 2 | `CLASSIFY` | IngestScreen | Confirmation card (not full HITL) |
| 3 | `EXTRACT_FILE1` | File1Screen | — |
| 4 | `AGENT_PLAN` | PlanScreen | **HITL Gate 1** |
| 5 | `EXTRACT_FILE2` | File2Screen | — |
| 6 | `EXTRACT_FILE3` | File2Screen | — |
| 7 | `RECONCILE` | CompleteScreen | — |
| 8 | `EXCEPTION_ASSEMBLY` | CompleteScreen | — |
| 9 | `READY` | HITLScreen | **HITL Gate 2 (FINAL)** |

StepRail polls `GET /api/packages/:packageId/pipeline-steps` every 3 seconds.

---

## 8. Roles and Permissions Summary

| Role Code | Display Name | Key Capabilities |
|---|---|---|
| `invoice_reviewer` | Invoice Reviewer | Upload, run pipeline, resolve exceptions, mark ready |
| `finance_approver` | Finance Approver | View summaries, approve/reject packages (cannot be same user as reviewer) |
| `commercial_reviewer` | Commercial Reviewer | Resolve commercial exceptions (rate / scope / retainage) |
| `data_steward` | Data Steward | Approve vendor master data (Wave 2) |
| `system_admin` | System Administrator | Manage contracts, users, roles, system settings |
| `auditor` | Auditor | Read-only all data, full audit trace |
| `viewer` | Leadership Viewer | Read-only dashboard |

---

## 9. Agent Roster

| Agent | Primary Responsibility | Sprint | Predecessor |
|---|---|---|---|
| **Agent 4 — Security Baseline** | Fix critical production defects (two immediate tasks) | Pre-Sprint | None |
| **Agent 1 — Backend Refactoring** | Decompose `server.js`, Prisma schema, Azure SQL, auth, tenancy | Sprint 1 | Azure SQL connection string |
| **Agent 2 — Design System** | Tailwind v4, shadcn/ui, design tokens, component inventory | Sprint 2 | None (parallel with Sprint 1) |
| **Agent 3 — Frontend Architecture** | React Router v6, AuthContext, login, route guards, apiFetch | Sprint 2 | Agent 2 complete |
| **Agent 5 — QA Framework** | vitest, @testing-library/react, Playwright, test Azure SQL | Sprint 2 | Agent 1 complete |

---

## 10. Open Prerequisites (Blocking)

These two items must be resolved before Sprint 1 work begins. They cannot be assumed or worked around.

| # | Item | Who provides it | Blocks |
|---|---|---|---|
| P1 | Azure SQL connection string | Infrastructure / Azure subscription owner | Agent 1, Sprint 1 backend work |
| P2 | Azure Blob Storage connection string | Infrastructure / Azure subscription owner | File upload feature (Sprint 1 endpoint) |

**Optional (Wave 2, not blocking Sprint 1):**
- SharePoint Graph API credentials (for document-of-record storage)
- Azure App Service tier confirmation (for Python subprocess replacement decision)

---

## 11. Sprint Calendar

| Sprint | Duration | Focus | Key Output |
|---|---|---|---|
| Pre-Sprint | Day 1 | Critical defect fixes + infrastructure setup | Defects resolved; Azure SQL provisioned |
| Sprint 1 | Weeks 1–2 | Backend Foundation | Working Azure SQL API with auth, 36-table schema, Prisma |
| Sprint 2 | Weeks 3–4 | Frontend Architecture | Design system, routing, login, AppShell, GlobalDashboard |
| Sprint 3 | Weeks 5–6 | Validation Engine & HITL | All 9 screens, exceptions, HITL gates, Evidence Viewer |

See individual sprint documents for full task lists, acceptance criteria, and dependencies.

---

## 12. Exception Categories Reference

These 8 exception types are seeded into `ref_exception_types` at database initialisation.

| Code | Display Name | Source |
|---|---|---|
| `MATH_ERROR` | Arithmetic Error | Calculation check |
| `FILE1_VS_FILE2` | File 1 vs File 2 Variance | Reconciliation result |
| `LOW_CONFIDENCE_OCR` | Low Confidence Extraction | `raw_extracted_fields.extraction_confidence < threshold` |
| `MISSING_SUPPORT` | Missing Supporting Evidence | File 3 not present for claimed amount |
| `CONTRACT_RATE` | Contract Rate Mismatch | Billed rate vs `contract_configs.rates_json` |
| `CONTRACT_SCOPE` | Out-of-Scope Billing | Line item not in contract SOV |
| `CONTRACT_RETAINAGE` | Retainage Calculation Error | vs `contract_configs.retainage_rate` |
| `DUPLICATE` | Potential Duplicate Billing | Cross-package duplicate detection |

---

*For sprint-level detail, task lists, and acceptance criteria, see documents 01 through 05 in this folder.*
