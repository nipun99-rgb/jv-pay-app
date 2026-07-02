# Invoice Validation & Review Platform
## Sprint 1: Backend Foundation

**Duration:** Weeks 1–2
**Agent:** Agent 1 — Backend Refactoring Agent
**Prerequisite:** PS-05 complete (Azure SQL `DATABASE_URL` in `.env`)
**Prerequisite:** PS-06 complete (Azure Blob Storage `AZURE_STORAGE_CONNECTION_STRING` in `.env`)
**Goal:** A working Express API backed by Azure SQL and Prisma, with authentication, multi-tenancy, and the full 36-table schema operational.

---

## Sprint 1 Output

By the end of Sprint 1, an authenticated HTTP call to the API returns real data from Azure SQL. The 36-table schema is live. The existing 8-table SQLite prototype is retired. No frontend changes are made during Sprint 1 — the frontend continues to use the old endpoints during this sprint and is updated in Sprint 2.

---

## S1-01 — Install Prisma and Configure Azure SQL Provider

**Effort:** 2 hours
**Blocks:** All subsequent Sprint 1 tasks

**Work:**
1. In `project-manager/backend/`, run:
   ```bash
   npm install prisma @prisma/client
   npx prisma init --datasource-provider sqlserver
   ```
2. `prisma/schema.prisma` is created by the above command. The `DATABASE_URL` is read from `.env` automatically.
3. Confirm `datasource db { provider = "sqlserver" url = env("DATABASE_URL") }` is present in `schema.prisma`.
4. Add `prisma/` to `.gitignore` exclusions for `*.db` files; the `schema.prisma` file itself must be committed.

**Acceptance criteria:**
- `npx prisma db pull` connects to Azure SQL without error
- `schema.prisma` exists with `sqlserver` provider
- `node_modules/.prisma/client/` is generated

---

## S1-02 — Define Full 36-Table Prisma Schema

**Effort:** 1 day
**Blocks:** S1-03, S1-04, all data-layer tasks

**Work:** Define all 36 tables in `prisma/schema.prisma`, in family order. The Prisma model names use PascalCase; the underlying table names use snake_case (`@@map`).

**Critical schema rules from the design documents:**
- All monetary fields: `Decimal` type → maps to `DECIMAL(18,2)` in Azure SQL
- All timestamps: `DateTime` → maps to `DATETIME2(3)`
- All text fields: `String` → maps to `NVARCHAR` (Prisma default for `sqlserver`)
- Boolean flags: `Boolean` → maps to `BIT`
- All audit fields append-only — no `UPDATE` permitted in application code
- `password_hash` excluded from all generated client types exposed to route handlers (enforced via Prisma `select` on login queries only)

**The 36 models to define (grouped by family):**

*Family 1 — Identity & Access:*
- `Client`, `User`, `Role`, `UserRole`, `UserSession`

*Family 2 — Contract Master:*
- `Contract`, `ContractConfig`

*Family 3 — Reference / Lookup (seeded, read-only at runtime):*
- `RefExceptionType`, `RefDocumentType`, `RefValidationRuleType`

*Family 4 — Package & Document:*
- `Package`, `PackageDocument`, `DocumentPage`, `ProcessingPipelineStep`

*Family 5 — Agent Planning:*
- `AgentPlan`, `AgentPlanItem`

*Family 6 — AI Extraction Staging:*
- `RawExtractedField`

*Family 7 — Contractor Data (File 1):*
- `GcPayApplicationHeader`, `GcPayApplicationSovLine`

*Family 8 — Sub-Contractor Data (File 2):*
- `SubPayApplicationHeader`, `SubPayApplicationSovLine`

*Family 9 — Supporting Documents (File 3):*
- `SupportingDocumentItem`

*Family 10 — Validation Engine:*
- `ValidationRun`, `ReconciliationResult`, `ExceptionGroup`, `Exception`

*Family 11 — Review & Resolution:*
- `ExceptionResolution`, `ReviewActionLog`

*Family 12 — Audit & Change History:*
- `AuditEvent`, `ActivityLog`, `DataChangeLog`

*Family 13 — Notifications:*
- `Notification`, `NotificationPreference`

*Family 14 — External Integration:*
- `ApiIntegrationLog`, `SharepointDocumentRef`

*Family 15 — System Configuration:*
- `SystemConfig`

**Acceptance criteria:**
- `npx prisma validate` passes with zero errors
- All 36 models defined
- `DECIMAL(18,2)` used for all monetary columns
- No raw `String` type used for monetary amounts
- All FK relationships defined with correct `@relation` annotations
- `UNIQUE` constraints match the schema documents (e.g., `@@unique([userId, roleId, clientId])` on `UserRole`)

---

## S1-03 — Run Database Migration and Seed Reference Data

**Effort:** 3 hours

**Work:**
1. Run `npx prisma migrate dev --name init` to generate and apply the initial migration SQL to Azure SQL.
2. Create `prisma/seed.js` that inserts the following static reference data:

   **`roles` table (7 rows):**
   - `invoice_reviewer`, `finance_approver`, `commercial_reviewer`, `data_steward`, `system_admin`, `auditor`, `viewer`

   **`ref_exception_types` table (8 rows):**
   - `MATH_ERROR`, `FILE1_VS_FILE2`, `LOW_CONFIDENCE_OCR`, `MISSING_SUPPORT`, `CONTRACT_RATE`, `CONTRACT_SCOPE`, `CONTRACT_RETAINAGE`, `DUPLICATE`

   **`ref_document_types` table:**
   - `FILE_1_GC_COVER`, `FILE_2_SUBS`, `FILE_3_SUPPORT`

   **`system_configs` table (1 row for session expiry):**
   - `session_expiry_hours`: 8
   - `audit_log_years`: 7
   - `activity_log_years`: 2

3. Add `"prisma": { "seed": "node prisma/seed.js" }` to `package.json`.
4. Run `npx prisma db seed` to confirm seed executes without error.

**Acceptance criteria:**
- Azure SQL contains all 36 tables after migration
- 7 roles rows present
- 8 ref_exception_types rows present
- Seed script is idempotent (safe to run multiple times using `upsert`)

---

## S1-04 — Create One-Time Data Migration Script

**Effort:** 4 hours
**Note:** This task migrates the 8 real projects from the current `projects.db` SQLite file into the new Azure SQL schema. If the existing test data is not needed, this task is skipped.

**Work:** Create `scripts/migrate-sqlite-to-azure.js`:

1. Open `projects.db` using `better-sqlite3` (read-only).
2. Create a default `Client` row in Azure SQL for the existing data.
3. For each row in the old `projects` table, create a `Contract` row (using `name` as `contract_name`, `baseline` as application number reference) and a `Package` row.
4. For each `line_item` in the old table, create a `GcPayApplicationSovLine` row linked to the package.
5. For each `cover_page`, create a `GcPayApplicationHeader` row.
6. For each `subcontractor_application`, create a `SubPayApplicationHeader` row.
7. For each `sub_line_item`, create a `SubPayApplicationSovLine` row.
8. For each `log`, create an `ActivityLog` row.
9. Skip migration of `tasks` and `project_phases` — these are superseded.
10. At completion, log: total contracts migrated, total packages migrated, total SOV lines migrated.

**Acceptance criteria:**
- Script runs without error on the real `projects.db` file
- 8 contracts created in Azure SQL (one per existing project)
- Financial data preserved exactly (amounts, dates, contractor names)
- Script is idempotent — safe to re-run

---

## S1-05 — Decompose `server.js` into Route Files

**Effort:** 1 day
**Blocks:** S1-06 through S1-12

**Work:** Decompose `project-manager/backend/server.js` (2,294 lines) into the following route files. The original `server.js` becomes a thin entry point that registers all routes.

**New file structure:**
```
project-manager/backend/
├── server.js                  (entry point — ~60 lines)
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── middleware/
│   ├── auth.js                (session validation)
│   └── tenancy.js             (client_id injection)
├── routes/
│   ├── auth.js                (login, logout, me)
│   ├── contracts.js           (contracts CRUD)
│   ├── packages.js            (packages CRUD + intake)
│   ├── pipeline.js            (run, steps, status)
│   ├── file1.js               (GC headers + SOV lines)
│   ├── file2.js               (sub headers + SOV lines)
│   ├── file3.js               (supporting documents)
│   ├── exceptions.js          (exceptions + resolutions)
│   ├── validation.js          (run validation, results)
│   ├── activity.js            (activity logs)
│   ├── notifications.js       (notifications)
│   └── admin.js               (users, roles, system config)
├── lib/
│   ├── pdf.js                 (PDF processing helpers — extracted from server.js)
│   ├── ai.js                  (Azure OpenAI integration — extracted from server.js)
│   └── storage.js             (Azure Blob Storage operations)
└── scripts/
    └── migrate-sqlite-to-azure.js
```

**Rules for decomposition:**
- The existing 39 endpoint behaviours are preserved exactly during this refactoring. Endpoints that are superseded by the new schema are marked with a `// DEPRECATED` comment and kept until the frontend migration is complete in Sprint 2.
- The embedded Python script string (currently inside a JavaScript function in `server.js`) is extracted to a separate `lib/extract.py` file and read at startup.
- All `require` paths updated to reflect new file locations.
- `server.js` entry point: imports express, applies global middleware (cors, json body parser, multer), registers all route files, starts listening.

**Acceptance criteria:**
- `node server.js` starts without error
- All 39 existing endpoints respond correctly (verified by running existing API test calls)
- No business logic remains in `server.js` itself — only middleware registration and route mounting
- ESLint (if configured) reports no new errors

---

## S1-06 — Implement Authentication Middleware

**Effort:** 4 hours

**Work:** Create `middleware/auth.js` implementing session token validation:

```javascript
// middleware/auth.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function requireAuth(req, res, next) {
  const token = req.cookies?.sessionToken;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const session = await prisma.userSession.findUnique({
    where: { sessionToken: token },
    include: { user: { select: { id: true, clientId: true, displayName: true, isActive: true } } }
  });

  if (!session || !session.user.isActive) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  if (new Date(session.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'Session expired' });
  }

  // Update last active timestamp (non-blocking)
  prisma.userSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() }
  }).catch(() => {});

  req.user = session.user;
  next();
}

async function requireRole(allowedRoles) {
  return async (req, res, next) => {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: req.user.id,
        revokedAt: null,
        OR: [{ clientId: req.user.clientId }, { clientId: null }]
      },
      include: { role: { select: { code: true } } }
    });
    const codes = userRoles.map(ur => ur.role.code);
    if (!allowedRoles.some(r => codes.includes(r))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
```

**Note on cookies:** Express must have `cookie-parser` installed and configured: `app.use(require('cookie-parser')())`.

**Acceptance criteria:**
- Requests without a session cookie return HTTP 401
- Requests with an expired session token return HTTP 401
- Requests with a valid session token populate `req.user` with `{ id, clientId, displayName }`
- `requireRole(['invoice_reviewer', 'system_admin'])` returns HTTP 403 if user does not hold any of the listed roles
- `password_hash` is never included in any query result anywhere in the auth middleware

---

## S1-07 — Implement Multi-Tenancy Middleware

**Effort:** 2 hours

**Work:** Create `middleware/tenancy.js`:

```javascript
// middleware/tenancy.js
// Injects client_id into all request handlers.
// Every Prisma query on operational tables MUST filter by clientId.
function requireTenancy(req, res, next) {
  if (!req.user || !req.user.clientId) {
    // Platform admin: clientId = null means cross-client access
    // Operational routes must explicitly handle null clientId
    req.clientId = null;
  } else {
    req.clientId = req.user.clientId;
  }
  next();
}
module.exports = { requireTenancy };
```

**Every route handler for operational data must follow this pattern:**
```javascript
// Correct — scoped to client:
const packages = await prisma.package.findMany({
  where: { clientId: req.clientId }
});

// WRONG — no client scope (data leak):
const packages = await prisma.package.findMany();
```

This rule is enforced in code review for all route handlers.

**Acceptance criteria:**
- All route handlers that return operational data include `clientId: req.clientId` in their Prisma `where` clause
- Platform admin routes (clientId = null) are explicitly identified and documented

---

## S1-08 — Implement Auth Routes (`routes/auth.js`)

**Effort:** 4 hours

**Endpoints:**

**`POST /api/auth/login`**
```
Body: { email, password }
→ Find user by email (include password_hash — only query that ever selects this column)
→ bcrypt.compare(password, user.password_hash)  — cost factor 12 minimum
→ On match: INSERT user_sessions (sessionToken = 32 bytes crypto.randomBytes(16).toString('hex'), expiresAt = now + 8h)
→ Update user.last_login_at
→ Set httpOnly cookie: sessionToken=<token>; HttpOnly; SameSite=Strict; Secure (Secure omitted in development)
→ Return: { user: { id, displayName, email, clientId, roles[] } }  — NO password_hash
```

**`POST /api/auth/logout`**
```
Requires: requireAuth middleware
→ UPDATE user_sessions SET revokedAt = now WHERE sessionToken = req.cookies.sessionToken
→ Clear the sessionToken cookie
→ Return: { success: true }
```

**`GET /api/auth/me`**
```
Requires: requireAuth middleware
→ Return current user: { id, displayName, email, jobTitle, clientId, roles[] }  — NO password_hash
```

**Acceptance criteria:**
- Login with valid credentials sets an httpOnly cookie and returns user object without `password_hash`
- Login with invalid credentials returns HTTP 401 after a constant-time bcrypt comparison (no timing attacks)
- Logout clears the session in the database and clears the cookie
- `/api/auth/me` returns the authenticated user's data
- Rate limiting on `/api/auth/login`: maximum 10 attempts per IP per 15 minutes (use `express-rate-limit`)

---

## S1-09 — Implement Contract & Package Routes

**Effort:** 1 day

### `routes/contracts.js`

**`GET /api/contracts`**
```
Requires: requireAuth, requireTenancy
→ prisma.contract.findMany({ where: { clientId: req.clientId, isActive: true } })
→ Include: _count of packages
```

**`POST /api/contracts`**
```
Requires: requireAuth, requireRole(['system_admin'])
Body: { contractNo, contractName, contractorName, ownerName, originalContractSum, currency, contractStartDate, contractEndDate }
→ INSERT contract + linked contract_configs row
```

**`GET /api/contracts/:contractId`**
```
Requires: requireAuth, requireTenancy
→ Single contract + contract_configs + packages list
```

---

### `routes/packages.js`

**`GET /api/packages`**
```
Requires: requireAuth, requireTenancy
→ prisma.package.findMany({ where: { clientId: req.clientId } })
→ Include: contract name, processing_pipeline_steps status summary (for StepRail preview on dashboard)
→ Order by: created_at DESC
```

**`POST /api/packages`**
```
Requires: requireAuth, requireRole(['invoice_reviewer'])
Form: multipart — fields: contractId, billingPeriodMonth, billingPeriodYear + up to 3 PDF file uploads
1. Duplicate check: SELECT id FROM packages WHERE contractId=? AND billingPeriodMonth=? AND billingPeriodYear=?
2. If duplicate found: return HTTP 409 { error: 'Package already exists for this billing period' }
3. SHA-256 hash each uploaded file. Compare against existing package file hashes for duplicate file warning.
4. INSERT package (status: DRAFT)
5. Upload each file to Azure Blob Storage → get blob URL
6. INSERT package_documents (one per file, stored_path = blob URL)
7. INSERT processing_pipeline_steps × 9 (all status: 'pending')
8. INSERT audit_events (PACKAGE_CREATED)
9. INSERT activity_logs ("Package created. Files received.")
10. UPDATE package status → INGESTING
11. Return: { packageId, status: 'INGESTING' }
```

**`GET /api/packages/:packageId`**
```
Requires: requireAuth, requireTenancy
→ Full package detail + contract + pipeline steps + package_documents
```

**`PATCH /api/packages/:packageId`**
```
Requires: requireAuth, requireRole(['finance_approver'])
Body: { packageStatus } — only APPROVED or REJECTED allowed via this endpoint
→ Enforce separation of duties: req.user.id MUST NOT equal package.reviewed_by
→ UPDATE package + INSERT audit_events (APPROVED or REJECTED)
```

**Acceptance criteria:**
- Duplicate package check works for same contractId + billingPeriodMonth + billingPeriodYear
- Files upload to Azure Blob Storage (not local disk)
- 9 pipeline step rows created on package creation
- Separation of duties enforced on approval

---

## S1-10 — Implement Pipeline Routes (`routes/pipeline.js`)

**Effort:** 4 hours

**`GET /api/packages/:packageId/pipeline-steps`**
```
Requires: requireAuth, requireTenancy
→ 9 rows from processing_pipeline_steps WHERE packageId = ?
→ Order by step_order ASC
→ This is polled by the frontend StepRail every 3 seconds
```

**`POST /api/packages/:packageId/pipeline/run`**
```
Requires: requireAuth, requireRole(['invoice_reviewer'])
Body: { fromStep }  — which step to begin from (e.g., 3 for File 1 extraction)
→ Trigger the processing logic for the specified step
→ INSERT activity_log ("Processing started at step {N}")
→ Return: { accepted: true }
```

**`POST /api/packages/:packageId/pipeline/confirm`**
```
Requires: requireAuth, requireRole(['invoice_reviewer'])
Body: { stepName }  — e.g., 'CLASSIFY' or 'AGENT_PLAN'
→ UPDATE processing_pipeline_steps SET status = 'confirmed' WHERE packageId = ? AND stepName = ?
→ INSERT audit_events (CONFIRMATION_GIVEN, step name in event_summary)
→ INSERT activity_log
→ Trigger the next step automatically
→ Return: { confirmed: true, nextStep }
```

**Acceptance criteria:**
- GET pipeline-steps returns all 9 rows in step order
- Confirm endpoint updates the correct step and triggers the next
- All pipeline state changes produce audit_events rows

---

## S1-11 — Implement Activity Log Route (`routes/activity.js`)

**Effort:** 2 hours

**`GET /api/packages/:packageId/activity`**
```
Requires: requireAuth, requireTenancy
Query params: since (ISO timestamp — for polling)
→ SELECT * FROM activity_logs WHERE packageId = ? AND createdAt > ? ORDER BY createdAt ASC
→ Frontend polls this every 2 seconds (matching existing pattern)
```

**`POST /api/packages/:packageId/activity`**
```
Internal use only — called by pipeline and route handlers to append log messages
Body: { level, stepNo, message }
→ INSERT activity_logs
```

**Acceptance criteria:**
- The `since` query parameter enables incremental polling (no full reloads)
- Log messages are ordered chronologically
- This endpoint replaces the existing `GET /logs` and `POST /logs` endpoints

---

## S1-12 — Implement Validation & Exception Routes

**Effort:** 4 hours

**`POST /api/packages/:packageId/validate`**
```
Requires: requireAuth, requireRole(['invoice_reviewer'])
→ INSERT validation_runs (status: RUNNING)
→ Run reconciliation logic (existing AI validation code — migrated from server.js)
→ INSERT reconciliation_results × N
→ INSERT exception_groups per exception category
→ INSERT exceptions per flagged item
→ UPDATE gc_pay_application_sov_lines.validation_status (derived summary — not source of truth)
→ UPDATE validation_runs status → COMPLETE
→ Return: { validationRunId, exceptionCount, totalAmountAtRisk }
```

**`GET /api/packages/:packageId/exceptions`**
```
Requires: requireAuth, requireTenancy
Query params: groupId, status (open/resolved/all)
→ exceptions JOIN exception_groups JOIN ref_exception_types
→ Include: exception_resolutions (for resolved status)
→ Sub-contractor filter: WHERE work_completed_this != 0 always applied on sov line joins
```

**`POST /api/exceptions/:exceptionId/resolve`**
```
Requires: requireAuth, requireRole(['invoice_reviewer', 'commercial_reviewer'])
Body: { decision (ACCEPTED/OVERRIDDEN/ESCALATED), comment, overrideValue }
→ INSERT exception_resolutions
→ UPDATE exceptions.status
→ INSERT review_action_logs (OVERRIDE or ACCEPT)
→ INSERT audit_events if override changes a financial value
→ If OVERRIDDEN: INSERT data_change_logs (before/after values, reason)
→ Return: { resolved: true }
```

**Acceptance criteria:**
- `exceptions` table is source of truth for exception status (not `validation_status` on SOV lines)
- Every resolve action produces a `review_action_logs` row
- Every financial override produces a `data_change_logs` row (before/after)
- Sub-contractor filter (`work_completed_this != 0`) applied to all exception queries involving SOV lines

---

## S1-13 — Implement Notification Routes (`routes/notifications.js`)

**Effort:** 3 hours

**`GET /api/notifications`**
```
Requires: requireAuth
Query params: unread=true
→ notifications WHERE userId = req.user.id AND (isRead = 0 if unread=true)
→ Order by: created_at DESC LIMIT 50
→ Polled by AppShell every 30 seconds
```

**`PATCH /api/notifications/:notificationId`**
```
Requires: requireAuth
Body: { isRead: true }
→ Mark notification as read
```

**`POST /api/notifications` (internal)**
```
Called by pipeline and approval routes to create notification rows
Body: { userId, type, title, body, packageId }
→ INSERT notifications
```

**Key notification events that trigger inserts:**
- Package submitted for review → notify all `finance_approver` users for that client
- Exception routed → notify `commercial_reviewer`
- Package approved/rejected → notify `invoice_reviewer` who created the package
- HITL Gate 1 confirmation needed → notify assigned `invoice_reviewer`

**Acceptance criteria:**
- Notification bell in AppShell shows unread count (frontend, Sprint 2)
- Notification rows are created at the correct pipeline events
- Notifications are scoped to the correct user (not broadcast to all users)

---

## Sprint 1 Completion Criteria

All of the following must be true before Sprint 2 begins:

- [ ] **S1-01** — Prisma installed, Azure SQL `sqlserver` provider configured
- [ ] **S1-02** — All 36 models defined in `schema.prisma`, `npx prisma validate` passes
- [ ] **S1-03** — `npx prisma migrate dev` applied to Azure SQL; seed data present (7 roles, 8 exception types)
- [ ] **S1-04** — Migration script run (or confirmed not needed); existing data in Azure SQL
- [ ] **S1-05** — `server.js` decomposed; all existing 39 endpoints still functional
- [ ] **S1-06** — Auth middleware validates session tokens; `requireRole` enforces permissions
- [ ] **S1-07** — Tenancy middleware injects `clientId`; all operational queries include `clientId` filter
- [ ] **S1-08** — `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` working; httpOnly cookie set
- [ ] **S1-09** — `/api/contracts` and `/api/packages` CRUD working with Azure SQL
- [ ] **S1-10** — `/api/packages/:id/pipeline-steps` returns 9 rows; confirm endpoint works
- [ ] **S1-11** — `/api/packages/:id/activity` with `since` polling works
- [ ] **S1-12** — `/api/exceptions` and `/api/exceptions/:id/resolve` working
- [ ] **S1-13** — `/api/notifications` with unread filter working

**Verification method:** Run the full API test suite against the new Azure SQL backend. All 39 existing test calls must pass. New endpoints tested with Postman or equivalent.
