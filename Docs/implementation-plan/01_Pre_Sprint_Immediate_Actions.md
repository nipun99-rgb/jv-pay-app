# Invoice Validation & Review Platform
## Pre-Sprint: Immediate Actions

**Date:** 2 July 2026
**Duration:** Day 1 (before Sprint 1 begins)
**Agent:** Agent 4 — Security Baseline Agent
**Prerequisites:** None — these actions can be taken right now on the existing codebase

---

## Context

Two production defects and two security vulnerabilities were identified during the 2 July 2026 architectural review. All four are simple, low-risk, high-priority changes. None requires a new feature branch, a sprint ceremony, or a sprint planning meeting. They should be done on Day 1.

Additionally, two infrastructure items must be provisioned before Sprint 1 backend work can begin.

---

## TASK PS-01 — Fix `SubcontractorTable.jsx` Hardcoded Localhost URL

**Priority:** CRITICAL — Production-breaking defect
**Effort:** 5 minutes
**Risk of change:** Zero — one-line replacement

**Current state (line 6 of `SubcontractorTable.jsx`):**
```javascript
const API = "http://localhost:3001/api";
```

**Problem:** Any deployment of the frontend to any environment other than the developer's local machine causes all sub-contractor data to fail silently. This is a production defect. The hardcoded absolute URL bypasses Vite's proxy configuration and fails with CORS errors in any non-localhost environment.

**Required state:**
```javascript
const API = "/api";
```

**Why this works:** All other components (`ProjectDetail.jsx`, `CoverPageTable.jsx`, `DataTable.jsx`) already use `const API = "/api"` (relative path). Vite's `vite.config.js` proxy rewrites `/api` requests to `http://localhost:3001`. In production, the reverse proxy handles this rewrite. The relative path is the correct pattern for all components.

**Acceptance criteria:**
- `SubcontractorTable.jsx` line 6 reads `const API = "/api"`
- All sub-contractor API calls in this component use the relative path
- No other changes made to this file

---

## TASK PS-02 — Fix CORS: Environment-Variable-Driven Origin

**Priority:** HIGH — Deployment-blocking
**Effort:** 15 minutes
**Risk of change:** Low — two-line replacement + one `.env` entry

**Current state (`server.js` approximately line 31):**
```javascript
app.use(cors({ origin: "http://localhost:5173" }));
```

**Problem:** The moment the frontend is deployed to any non-localhost URL (Azure Static Web Apps, Azure App Service, shared development machine), all API calls fail with CORS errors. This is not a theoretical risk — it blocks all staging and production deployments.

**Required state (`server.js`):**
```javascript
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173" }));
```

**Required state (`.env` file at `project-manager/backend/.env`):**
```
ALLOWED_ORIGIN=http://localhost:5173
```

**Note on `.env` file:** The `.env` file must be listed in `.gitignore`. If no `.gitignore` exists at `project-manager/backend/`, create one with the following minimum content:
```
.env
node_modules/
*.db
```

**Acceptance criteria:**
- `server.js` CORS origin reads from `process.env.ALLOWED_ORIGIN`
- Falls back to `http://localhost:5173` if the variable is not set (development convenience)
- `.env` file exists at `project-manager/backend/.env` and is listed in `.gitignore`
- Backend restarts without error
- Frontend continues to communicate with backend normally in development

---

## TASK PS-03 — Fix PDF Path Traversal Vulnerability

**Priority:** HIGH — Security vulnerability (OWASP A01: Broken Access Control)
**Effort:** 20 minutes
**Risk of change:** Low — add validation before the existing file read

**Current state:** The `GET /api/projects/:id/pdf` endpoint reads `pdf_path` from the database and serves the file at that path. There is no validation that the resolved path is within the expected upload directory.

**Problem:** If an attacker can manipulate the `pdf_path` value (via a direct database edit or a separate vulnerability), the server will serve any file on the filesystem — including `server.js`, `.env`, or `node_modules` secrets.

**Required state:** Before serving any file from the filesystem, validate that the resolved absolute path is within the permitted base directory:

```javascript
const path = require('path');
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');

// Inside the /pdf endpoint handler:
const requestedPath = path.resolve(pdfPathFromDatabase);
if (!requestedPath.startsWith(UPLOAD_DIR)) {
  return res.status(403).json({ error: 'Access denied' });
}
// Only then: res.sendFile(requestedPath)
```

**This same pattern must be applied to all endpoints that serve files from the filesystem:**
- `GET /api/projects/:id/pdf`
- `GET /api/projects/:id/sub-pdf`
- `GET /api/projects/:id/pdf/pages`

**Acceptance criteria:**
- Path traversal sequences (`../`) in any PDF path are rejected with HTTP 403
- Files outside of the `uploads/` directory cannot be served
- Existing PDF serving for valid paths continues to work normally

---

## TASK PS-04 — Document Python Dependency Requirements

**Priority:** MEDIUM — Deployment blocker (undocumented requirement)
**Effort:** 10 minutes

**Current state:** The backend spawns a Python child process using `fitz` (PyMuPDF) for PDF processing. Python and PyMuPDF are not documented anywhere. Any new environment setup will fail silently when the Python subprocess fails.

**Required state:** Create `project-manager/backend/SETUP.md` with the following:

```markdown
## Python Dependency

The backend requires Python 3.10+ and PyMuPDF installed on the host machine.

### Installation
```bash
pip install pymupdf
```

### Verification
```bash
python -c "import fitz; print(fitz.version)"
```

### Azure App Service note
Python subprocess spawning from Node.js is not supported on all Azure App Service configurations.
This dependency must be replaced with Azure Document Intelligence before production deployment.
See: RISK 1 in the Strategic Architecture Advisory (2 July 2026).
```

**Acceptance criteria:**
- `SETUP.md` documents the Python and PyMuPDF requirements
- Verification command is included
- Production risk is noted with a reference to the advisory

---

## INFRASTRUCTURE TASK PS-05 — Provision Azure SQL Instance

**Priority:** CRITICAL — Blocks all Sprint 1 backend work
**Owner:** Infrastructure / Azure subscription owner (not the development team)
**Effort:** 30 minutes in Azure Portal

**What is needed:**
- Azure SQL Database instance (Basic tier for development, Standard S2 for staging)
- Server admin login and password
- Connection string in the format: `Server=tcp:{server}.database.windows.net,1433;Initial Catalog={db};...`
- Firewall rule allowing the developer's IP address and the Azure App Service outbound IPs

**What to do with the connection string once provisioned:**
Add to `project-manager/backend/.env`:
```
DATABASE_URL="sqlserver://{server}.database.windows.net:1433;database={db};user={user};password={password};encrypt=true"
```

This is the format expected by Prisma's `sqlserver` provider.

**Acceptance criteria:**
- Azure SQL instance is reachable from the developer's machine
- Connection string is in the `.env` file
- `DATABASE_URL` is the exact variable name (required by Prisma)

---

## INFRASTRUCTURE TASK PS-06 — Provision Azure Blob Storage Account

**Priority:** HIGH — Blocks file upload feature in Sprint 1
**Owner:** Infrastructure / Azure subscription owner
**Effort:** 15 minutes in Azure Portal

**What is needed:**
- Azure Storage Account (Standard LRS for development)
- Container named `invoice-packages` (private — no public blob access)
- Storage Account connection string

**What to do with the connection string once provisioned:**
Add to `project-manager/backend/.env`:
```
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER="invoice-packages"
```

**Acceptance criteria:**
- Storage account is reachable from the developer's machine
- The `invoice-packages` container exists with private access
- Connection string is in `.env`

---

## Pre-Sprint Completion Checklist

Before Sprint 1 planning begins, every item below must be ticked:

- [ ] **PS-01** — `SubcontractorTable.jsx` line 6 reads `/api` (not `localhost:3001`)
- [ ] **PS-02** — CORS origin reads from `process.env.ALLOWED_ORIGIN`; `.env` file exists; `.gitignore` covers `.env`
- [ ] **PS-03** — Path traversal validation added to all 3 file-serving endpoints
- [ ] **PS-04** — `SETUP.md` created with Python dependency instructions
- [ ] **PS-05** — Azure SQL instance provisioned; `DATABASE_URL` in `.env`
- [ ] **PS-06** — Azure Blob Storage provisioned; `AZURE_STORAGE_CONNECTION_STRING` in `.env`

**Sprint 1 CANNOT begin until PS-05 is complete.** PS-01 through PS-04 can be completed without infrastructure access.
