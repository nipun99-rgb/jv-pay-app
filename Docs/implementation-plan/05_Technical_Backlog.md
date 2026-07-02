# Invoice Validation & Review Platform
## Technical Backlog — Full Task Register

**Date:** 2 July 2026
**Source:** Strategic Architecture Advisory + Sprint Plans 01–04
**Format:** Task ID | Title | Sprint | Agent | Effort | Dependencies | Acceptance Criteria summary

---

## Pre-Sprint Tasks

| ID | Title | Agent | Effort | Depends On | Status |
|---|---|---|---|---|---|
| PS-01 | Fix `SubcontractorTable.jsx` hardcoded localhost URL | Agent 4 | 5 min | — | Not Started |
| PS-02 | Fix CORS: environment-variable-driven origin + `.env` file | Agent 4 | 15 min | — | Not Started |
| PS-03 | Add PDF path traversal validation to all 3 file-serving endpoints | Agent 4 | 20 min | — | Not Started |
| PS-04 | Create `SETUP.md` documenting Python/PyMuPDF dependency | Agent 4 | 10 min | — | Not Started |
| PS-05 | Provision Azure SQL instance (Basic dev / S2 staging) | Infrastructure | 30 min | Azure subscription | Not Started |
| PS-06 | Provision Azure Blob Storage account + `invoice-packages` container | Infrastructure | 15 min | Azure subscription | Not Started |

---

## Sprint 1 Tasks — Backend Foundation

| ID | Title | Agent | Effort | Depends On |
|---|---|---|---|---|
| S1-01 | Install Prisma + configure Azure SQL `sqlserver` provider | Agent 1 | 2 hrs | PS-05 |
| S1-02 | Define all 36 Prisma models in `schema.prisma` | Agent 1 | 1 day | S1-01 |
| S1-03 | Run `prisma migrate dev` + create seed script (roles, ref tables, system_configs) | Agent 1 | 3 hrs | S1-02 |
| S1-04 | One-time SQLite → Azure SQL data migration script | Agent 1 | 4 hrs | S1-02 |
| S1-05 | Decompose `server.js` into route files + lib directory | Agent 1 | 1 day | S1-01 |
| S1-06 | Auth middleware: session token validation + `requireRole` | Agent 1 | 4 hrs | S1-03, S1-05 |
| S1-07 | Tenancy middleware: `clientId` injection + enforcement pattern | Agent 1 | 2 hrs | S1-06 |
| S1-08 | Auth routes: `POST /login`, `POST /logout`, `GET /me` | Agent 1 | 4 hrs | S1-06 |
| S1-09 | Contract + Package CRUD routes with Azure Blob file upload | Agent 1 | 1 day | S1-07, PS-06 |
| S1-10 | Pipeline routes: GET steps (polling), POST run, POST confirm | Agent 1 | 4 hrs | S1-07 |
| S1-11 | Activity log route with `since` incremental polling | Agent 1 | 2 hrs | S1-07 |
| S1-12 | Validation + Exception routes (run, list, resolve) | Agent 1 | 4 hrs | S1-07 |
| S1-13 | Notification routes: GET (with unread filter), PATCH, POST (internal) | Agent 1 | 3 hrs | S1-07 |

---

## Sprint 2 Tasks — Frontend Architecture

### Agent 2 (Design System)

| ID | Title | Agent | Effort | Depends On |
|---|---|---|---|---|
| S2-01 | Install Tailwind CSS v4 + shadcn/ui + Lucide React; delete `App.css` | Agent 2 | 2 hrs | — |
| S2-02 | Define CSS custom property design token system in `src/styles/index.css` | Agent 2 | 3 hrs | S2-01 |
| S2-03 | Install 14 shadcn/ui components; build ValidationBadge (5 states), StepRail, MoneyCell, SeverityBadge | Agent 2 | 4 hrs | S2-01, S2-02 |

### Agent 3 (Frontend Architecture)

| ID | Title | Agent | Effort | Depends On |
|---|---|---|---|---|
| S2-04 | Install React Router v6; establish `src/` folder structure; retire old files | Agent 3 | 3 hrs | S2-01 |
| S2-05 | Implement `apiFetch` wrapper in `src/lib/api.js`; migrate all fetch calls | Agent 3 | 1 hr | S2-04 |
| S2-06 | Implement `AuthContext` + `useAuth` hook | Agent 3 | 3 hrs | S2-05, S1-08 |
| S2-07 | Register all 13 routes in `main.jsx` with `RequireAuth` guard | Agent 3 | 2 hrs | S2-06 |
| S2-08 | Build `AppShell`: header + notification bell + sidebar + active nav | Agent 3 | 4 hrs | S2-07, S1-13 |
| S2-09 | Build `LoginPage`: form, error handling, httpOnly cookie, no credential storage | Agent 3 | 3 hrs | S2-07, S1-08 |
| S2-10 | Build `GlobalDashboard`: package queue table, status badges, smart "Open Package" routing | Agent 3 | 4 hrs | S2-08, S1-09 |
| S2-11 | Build `PackageIntakePage`: 3-step wizard, duplicate check, multipart upload | Agent 3 | 6 hrs | S2-08, S1-09 |

### Agent 5 (QA Framework)

| ID | Title | Agent | Effort | Depends On |
|---|---|---|---|---|
| S2-12 | Install vitest + @testing-library/react; first `ValidationBadge` test | Agent 5 | 2 hrs | S2-03 |
| S2-13 | Install Playwright; login E2E test; provision test Azure SQL instance | Agent 5 | 3 hrs | S1-08, S2-09 |

---

## Sprint 3 Tasks — Validation Engine & HITL

| ID | Title | Agent | Effort | Depends On |
|---|---|---|---|---|
| S3-01 | `PackageLayout` + `StepRail` integration + `usePipelineSteps` polling hook | Agent 3 | 3 hrs | S2-07, S1-10 |
| S3-02 | `IngestPage`: Activity Feed + classification confirmation card | Agent 3 | 4 hrs | S3-01, S1-11 |
| S3-03 | `File1Page`: 3-pane layout, G702 card, G703 DataTable (inline edit), Evidence Viewer integration | Agent 3 | 6 hrs | S3-01, S3-09, S1-12 |
| S3-04 | `PlanPage` HITL Gate 1: agent plan table, confirm action, gate enforcement | Agent 3 | 5 hrs | S3-01, S1-10 |
| S3-05 | `File2Page`: live extraction progress + sub SOV table (filter always active) | Agent 3 | 5 hrs | S3-04 |
| S3-06 | `CompletePage`: reconciliation progress + exception summary card + routing logic | Agent 3 | 3 hrs | S3-01, S1-12 |
| S3-07 | `ExceptionsPage`: exception navigator (left) + detail grid (centre) + accept/override + Evidence Viewer + submit gate | Agent 3 | 8 hrs | S3-06, S3-09 |
| S3-08 | `HitlPage` HITL Gate 2: financial summary, approve/reject, separation of duties enforcement | Agent 3 | 5 hrs | S3-07 |
| S3-09 | `EvidenceViewer`: react-pdf canvas, page navigation, row-triggered page change | Agent 3 | 4 hrs | S2-04 |
| S3-10 | `ContractListPage`: contracts table + admin-only new contract dialog | Agent 3 | 3 hrs | S2-08, S1-09 |
| S3-11 | Audit chain verification: SQL query confirms 7-link chain for a real package | Agent 5 | 2 hrs | S3-08 |
| S3-12 | E2E test suite: happy path, separation of duties, HITL Gate 1 bypass | Agent 5 | 4 hrs | S3-08 |

---

## Complete Task Count

| Sprint | Tasks | Total Estimated Effort |
|---|---|---|
| Pre-Sprint | 6 tasks | ~2 hours (code) + infrastructure time |
| Sprint 1 | 13 tasks | ~6 days |
| Sprint 2 | 13 tasks | ~5 days |
| Sprint 3 | 12 tasks | ~6 days |
| **Total** | **44 tasks** | **~17–18 development days** |

---

## Constraints Checklist (Applied to Every Task)

Before any task is marked complete, the author verifies all of the following that apply:

**Code constraints:**
- [ ] No TypeScript — React JS (JSX) only
- [ ] No mock data — all content from live API
- [ ] No `dark:` Tailwind modifiers
- [ ] No hardcoded hex colors — token-based only
- [ ] No hardcoded URLs — `apiFetch('/...')` pattern only
- [ ] No `localStorage` for session tokens — httpOnly cookie only

**Data constraints:**
- [ ] Sub-contractor filter (`work_completed_this != 0`) applied where relevant
- [ ] `client_id` in every Prisma `where` clause on operational tables
- [ ] `password_hash` excluded from all API responses
- [ ] Soft delete only (`is_active = 0`) — no hard DELETE on business entities

**Security constraints:**
- [ ] Separation of duties enforced for package approval (`reviewed_by ≠ approved_by`)
- [ ] PDF path traversal validation in all file-serving endpoints
- [ ] `session_token` never logged
- [ ] Rate limiting on `/api/auth/login`
- [ ] bcrypt cost factor ≥ 12

**HITL constraints:**
- [ ] HITL Gate 1 (`AGENT_PLAN`) cannot be bypassed by URL manipulation
- [ ] HITL Gate 2 (`READY`) is final — no re-validation after approval
- [ ] Override actions produce `data_change_logs` rows (before/after, reason)
- [ ] All HITL decisions produce `audit_events` rows

**Audit constraints:**
- [ ] Every package lifecycle transition produces an `audit_events` row
- [ ] Every reviewer UI action produces a `review_action_logs` row
- [ ] Agent plan is immutable after confirmation

---

## Terminology Reference

The following terms are authoritative across all code, API responses, and UI labels. Older terms must not appear in new code.

| Old Term | Authoritative New Term |
|---|---|
| `project` | `package` (processing unit) or `contract` (the agreement) |
| `projects` (table) | `contracts` + `packages` tables |
| `projectId` | `packageId` |
| `baseline` field | `billing_period_month` + `billing_period_year` |
| `phases` (3 phases) | `processing_pipeline_steps` (9 steps) |
| `tasks` (4 tasks) | `processing_pipeline_steps` |
| `line_items` | `gc_pay_application_sov_lines` |
| `cover_page` | `gc_pay_application_headers` |
| `subcontractor_applications` | `sub_pay_application_headers` |
| `sub_line_items` | `sub_pay_application_sov_lines` |
| `logs` | `activity_logs` |
| `OutputPanel` | Activity Feed (component name: `ActivityFeed.jsx`) |

---

## Architecture Risks Register

| # | Risk | Severity | Mitigation | Sprint |
|---|---|---|---|---|
| R1 | Python subprocess (`fitz`/PyMuPDF) not supported on Azure App Service | HIGH | Replace with Azure Document Intelligence (Wave 2) or Azure Function (Wave 1 interim) | Pre-Sprint / Sprint 1 |
| R2 | `server.js` 2,294-line monolith — any change can break any endpoint | MEDIUM | Decompose in S1-05 before adding new routes | Sprint 1 |
| R3 | `SubcontractorTable.jsx` hardcoded localhost — production-breaking | CRITICAL | Fix in PS-01 before any other work | Pre-Sprint |
| R4 | CORS locked to `localhost:5173` — deployment-blocking | HIGH | Fix in PS-02 | Pre-Sprint |
| R5 | No ORM — raw SQL at 36-table scale is injection-prone | HIGH | Prisma in S1-01 | Sprint 1 |
| R6 | Azure SQL not yet provisioned — blocks all Sprint 1 backend work | CRITICAL | PS-05 infrastructure task | Pre-Sprint |

---

## Wave 2 Items (Out of Scope for Sprint 1–3)

These items are identified by the schema documents as Wave 2. They do not appear in any sprint above and must not be started until Wave 1 is complete.

| Item | Description |
|---|---|
| Power BI integration | DirectQuery reports on Azure SQL — requires `auditor` role read access |
| Email notifications | Currently Wave 1 notifications are in-app only. Email = Wave 2. |
| SharePoint as primary PDF source | Evidence Viewer reads from Azure Blob in Wave 1. SharePoint retrieval = Wave 2. |
| `vendors` table | Vendor master data management with `data_steward` approval workflow |
| `contract_baseline_versions` | Contract SOV versioning for change orders |
| `contract_sov_items` | Detailed contract line items (currently simplified to `contract_configs.custom_rules_json`) |
| Power Apps integration | External consumer of the API |
| Entra ID (Azure AD) auth | Phase 2 auth — OIDC callback route + `entra_oid` column population |
| Azure Functions for PDF processing | Replacement for Python subprocess — deferred if Azure App Service supports subprocess |
| Multi-language support | Not in scope for Wave 1 |
