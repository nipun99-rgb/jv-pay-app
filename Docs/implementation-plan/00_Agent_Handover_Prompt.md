# Implementation Agent Handover Prompt
## Invoice Validation & Review Platform

---

You are taking over implementation of an AI-powered Invoice Validation & Review Platform — a Human-in-the-Loop (HITL) workbench for monthly General Contractor pay application review. A full architectural review has been completed. All decisions are made. Your job is to execute, not design.

**Do not make new architectural decisions. Do not ask clarifying questions about technology choices. Every decision is documented — read the documents first, then execute.**

---

## Your First Action

Before writing a single line of code, read these documents in order:

1. `Docs/implementation-plan/00_Plan_Overview.md` — decision register, constraints, route tree, role table
2. `Docs/implementation-plan/01_Pre_Sprint_Immediate_Actions.md` — start here for code tasks
3. `Docs/implementation-plan/02_Sprint_1_Backend_Foundation.md` — Sprint 1 tasks
4. `Docs/implementation-plan/03_Sprint_2_Frontend_Architecture.md` — Sprint 2 tasks
5. `Docs/implementation-plan/04_Sprint_3_Validation_Engine.md` — Sprint 3 tasks
6. `Docs/implementation-plan/05_Technical_Backlog.md` — full task register and constraints checklist

Also read the database schema documents (these are your authoritative data model reference):
- `Docs/project-documents/database-schema/01_Executive_Summary_and_ERD.md`
- `Docs/project-documents/database-schema/02_Table_Definitions.md`
- `Docs/project-documents/database-schema/03_Data_Flow_Architecture.md`
- `Docs/project-documents/database-schema/04_Security_Architecture.md`
- `Docs/project-documents/database-schema/05_Integration_Architecture.md`
- `Docs/project-documents/database-schema/06_Audit_Compliance_Performance.md`

---

## The Existing Codebase

The workspace is at `c:\Users\KR614XU\Downloads\Ishaan\`. The current working application lives in:

```
project-manager/
├── backend/
│   ├── server.js        ← 2,294-line Express monolith — DO NOT DELETE, refactor carefully
│   ├── db.js            ← sql.js SQLite — to be replaced by Prisma + Azure SQL
│   ├── package.json
│   └── uploads/         ← local PDF storage — to be replaced by Azure Blob Storage
└── frontend/
    ├── src/
    │   ├── App.jsx       ← current router (window.location.pathname) — to be replaced
    │   ├── App.css       ← DELETE THIS — 3 conflicting button systems
    │   └── components/   ← mix of keep/refactor/retire (see plan documents)
    └── package.json
```

The backend is currently running on port 3001. It has 39 working endpoints against a real SQLite database with 8 projects. This data is real and must not be lost.

---

## Where to Start

**Start with Pre-Sprint tasks PS-01 through PS-04.** These are code fixes on the existing codebase that take less than an hour total and should be done before anything else. Infrastructure tasks PS-05 and PS-06 require Azure credentials — check whether `project-manager/backend/.env` already has `DATABASE_URL` and `AZURE_STORAGE_CONNECTION_STRING` before asking. If those keys are present, proceed directly to Sprint 1.

**Pre-Sprint code tasks (do these now):**

**PS-01** — Open `project-manager/frontend/src/components/SubcontractorTable.jsx`. Line 6 reads:
```javascript
const API = "http://localhost:3001/api";
```
Change it to:
```javascript
const API = "/api";
```
That is the entire fix. Every other component already uses `/api`.

**PS-02** — Open `project-manager/backend/server.js`. Find the CORS configuration (approximately line 31):
```javascript
app.use(cors({ origin: "http://localhost:5173" }));
```
Change it to:
```javascript
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173" }));
```
Then create `project-manager/backend/.env` if it does not exist. Add `ALLOWED_ORIGIN=http://localhost:5173`. Add `.env` to `.gitignore`.

**PS-03** — Add path traversal protection to all 3 endpoints in `server.js` that serve files from the `uploads/` directory. Before any `res.sendFile()` call that uses a path from the database, validate that the resolved path starts with the `uploads/` base directory. Use `path.resolve()` to normalise both paths and `String.startsWith()` to validate. Return HTTP 403 if the check fails.

**PS-04** — Create `project-manager/backend/SETUP.md` documenting that Python 3.10+ and PyMuPDF (`pip install pymupdf`) are required. Include a verification command and a note that this dependency must be replaced with Azure Document Intelligence before production.

---

## Non-Negotiable Rules

These apply to every line of code you write. No exceptions.

| Rule | Detail |
|---|---|
| **No TypeScript** | React JS (JSX) only. No `.ts`, no `.tsx`, no type annotations. |
| **No mock data** | Every piece of data shown in the UI must come from a live API call. No hardcoded arrays, no placeholder JSON. |
| **No dark mode** | Zero `dark:` Tailwind modifier anywhere. Light theme only. |
| **No hardcoded colors** | All colors via CSS custom property tokens (`var(--color-*)`). No hex values, no RGB, no named colors in component files. |
| **No hardcoded URLs** | All API calls use `apiFetch('/...')` (the central wrapper). Never `fetch('http://localhost:...')`. |
| **No localStorage for tokens** | Session token is an httpOnly cookie. Never stored in `localStorage` or `sessionStorage`. |
| **`client_id` on every query** | Every Prisma query on an operational table must include `clientId: req.clientId` in the `where` clause. No exceptions. |
| **Soft deletes only** | Set `is_active = false`. Never use `DELETE` on business entities (`clients`, `users`, `contracts`, `packages`, `exceptions`, etc.). |
| **`password_hash` never in responses** | Never return `password_hash` from any endpoint. Always use Prisma `select` to explicitly exclude it. |
| **`session_token` never logged** | Never log or include a session token in any error message or response body. |
| **Sub-contractor filter** | On `sub_pay_application_sov_lines`, always filter `work_completed_this != 0` unless the screen explicitly displays a "show all" toggle in its spec. |
| **Separation of duties** | `PATCH /api/packages/:id` (approve/reject) must verify `req.user.id !== package.reviewed_by`. Return HTTP 403 if they match. |

---

## Technology Stack

**Frontend:** React 18 JSX · Vite 5 · React Router v6 · Tailwind CSS v4 · shadcn/ui (Radix UI) · Lucide React · react-pdf · native fetch via `apiFetch` wrapper

**Backend:** Node.js 22 · Express · Prisma (`@prisma/client`, `sqlserver` provider) · Azure SQL · bcrypt · cookie-parser · Multer (for file upload) · Azure Blob Storage SDK

**Database:** Azure SQL (SQL Server 2022 compatible) — 36 tables as defined in the schema documents. The Prisma schema file is your implementation of those documents.

**Not used:** TypeScript · Axios · TanStack Query · Redux · Zustand · SQLite · dark mode · mock data

---

## The Database Schema in Brief

The new schema has 36 tables replacing the current 8. Key points:

- `contracts` replaces `projects`. `packages` is a new entity (one per billing period per contract).
- `processing_pipeline_steps` replaces `project_phases` and `tasks`. There are 9 steps per package (not 3).
- `gc_pay_application_sov_lines` replaces `line_items`.
- `gc_pay_application_headers` replaces `cover_page`.
- `sub_pay_application_headers` replaces `subcontractor_applications`.
- `sub_pay_application_sov_lines` replaces `sub_line_items`.
- `activity_logs` replaces `logs`.
- `exceptions` + `exception_groups` are new — this is where validation flags live. The `validation_status` column on SOV line tables is a derived summary only.
- All monetary columns: `Decimal` in Prisma → `DECIMAL(18,2)` in Azure SQL.
- All timestamps: `DateTime` in Prisma → `DATETIME2(3)` in Azure SQL.
- All audit tables (`audit_events`, `review_action_logs`, `data_change_logs`, `exception_resolutions`) are append-only — no UPDATE ever on these tables.

The 36-table inventory is in `01_Executive_Summary_and_ERD.md` Section 4. The complete column definitions are in `02_Table_Definitions.md`. The data flows (which tables are written in what sequence for each operation) are in `03_Data_Flow_Architecture.md`.

---

## The 9-Screen Journey

The application has 9 screens, all under the `/packages/:packageId/*` route tree:

| Step | Screen | Route | HITL Gate |
|---|---|---|---|
| 1–2 | IngestPage | `/packages/:id/ingest` | Confirmation card at step 2 |
| 3 | File1Page | `/packages/:id/file1` | — |
| 4 | PlanPage | `/packages/:id/plan` | **HITL Gate 1 — cannot be bypassed** |
| 5–6 | File2Page | `/packages/:id/file2` | — |
| 7–8 | CompletePage | `/packages/:id/complete` | — |
| 9a | ExceptionsPage | `/packages/:id/exceptions` | All exceptions must be resolved before proceeding |
| 9b | HITLPage | `/packages/:id/hitl` | **HITL Gate 2 — final, cannot be undone** |

Plus: `/login`, `/` (GlobalDashboard), `/contracts`, `/packages/new` (intake wizard), `/settings`, `/reports`.

**HITL Gate 1 enforcement:** The File2Page must check on load whether `processing_pipeline_steps` step `AGENT_PLAN` has status `confirmed`. If not, redirect to PlanPage. No URL manipulation bypasses this.

**HITL Gate 2 enforcement:** Once a package is `APPROVED` or `REJECTED`, the HITLPage renders read-only. The approve/reject buttons are gone. No exceptions can be reopened.

---

## Known Existing Bugs (Do Not Reintroduce)

| Bug | Location | Status |
|---|---|---|
| Hardcoded localhost URL | `SubcontractorTable.jsx` line 6 | Fix in PS-01 |
| CORS locked to localhost | `server.js` ~line 31 | Fix in PS-02 |
| PDF path traversal vulnerability | All 3 file-serving endpoints in `server.js` | Fix in PS-03 |
| Phase 2 always clickable regardless of Phase 1 status | `JourneyPanel.jsx` | Component is being retired — fixed by proper pipeline step status checks in new StepRail |
| `canClick` logic never validated against API | `JourneyPanel.jsx` | Same — component retired |
| `onRevalidateItem` prop exists but never surfaced | `DataTable.jsx` | Addressed in new inline action buttons in Sprint 3 |
| `window.confirm()` for delete actions | Various | Replaced by shadcn/ui `Dialog` confirmation modals |

---

## Verification Standard

Every task has acceptance criteria in the sprint documents. A task is not complete until:
1. The acceptance criteria in the sprint document are all met
2. The constraints checklist in `05_Technical_Backlog.md` passes for that task
3. `npm run dev` (frontend) and `node server.js` (backend) start without errors
4. No new TypeScript, no new hardcoded colors, no new hardcoded URLs were introduced

For backend tasks: test each new endpoint with a real HTTP call (Postman, curl, or PowerShell `Invoke-RestMethod`) against a real Azure SQL instance — not a test double.

For frontend tasks: verify in a real browser — not just that the component renders, but that it fetches real data and the happy path works end-to-end.

---

## If You Are Uncertain About Anything

1. Check the schema documents first — they are highly detailed and answer most data model questions.
2. Check the sprint plan documents — each task has a detailed spec.
3. Check `05_Technical_Backlog.md` — it has the constraints checklist and terminology reference.
4. Read the existing source files before modifying them — especially `server.js` and `db.js`.

**Do not guess at schema details. Do not invent API endpoint shapes. Do not introduce new technology not listed in the stack above without explicit instruction.**

---

*Handover prepared: 2 July 2026. All architectural decisions are final. Begin with PS-01.*
