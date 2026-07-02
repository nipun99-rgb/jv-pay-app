# Database Schema Design — Invoice Validation & Review Platform
## Document 04: Security Architecture

**Document Version:** 1.0
**Date:** 2 July 2026
**Prepared by:** Senior Database Architect, EY
**Status:** OFFICIAL DESIGN REFERENCE — For Implementation

---

## 1. Security Model Overview

The platform implements a **defence-in-depth** security model with four distinct layers:

```
Layer 1: Identity (Who are you?)
   → users table, user_sessions, Entra ID (prod)

Layer 2: Access Control (What can you do?)
   → user_roles table, roles table, client_id scoping

Layer 3: Data Isolation (What data can you see?)
   → Row-level filtering by client_id on every query

Layer 4: Audit (What did you do?)
   → review_action_logs, audit_events, data_change_logs
```

---

## 2. User Management Structure

### 2.1 User Identity Tables

The identity infrastructure uses three interlocking tables:

```
users
 ├── id, email, display_name (identity attributes)
 ├── client_id (data isolation scope)
 ├── password_hash (MVP) / entra_oid (production)
 └── is_active (revocation flag)

user_roles (junction)
 ├── user_id → users
 ├── role_id → roles
 └── client_id (scope: NULL = all clients, non-null = specific client only)

user_sessions
 ├── user_id → users
 ├── session_token (cryptographically random, 32 bytes)
 └── expires_at, revoked_at
```

### 2.2 User Lifecycle

| State | `users.is_active` | `user_sessions.revoked_at` | Effect |
|---|---|---|---|
| Active | 1 | NULL | Full access per roles |
| Session expired | 1 | NULL | Re-authentication required |
| Session revoked | 1 | Non-null | Forced logout; re-login creates new session |
| User deactivated | 0 | Set on all sessions | All access blocked; data retained |

### 2.3 Password Security (MVP)

- Passwords are hashed using **bcrypt** with a minimum cost factor of **12**
- The raw password is never stored, logged, or returned in any API response
- `users.password_hash` is explicitly excluded from all SELECT * queries in API handlers
- Password reset requires email verification (Wave 2 feature)

### 2.4 Entra ID Migration Path (Production)

In production, the `users.entra_oid` column links each user record to their Azure Active Directory object. The authentication flow becomes:

```
1. User authenticates with Microsoft (Entra ID) via OIDC
2. System receives ID token + access token
3. System extracts oid (object ID) from the token claims
4. Queries: SELECT * FROM users WHERE entra_oid = ? AND is_active = 1
5. If found: proceeds with this user's client_id and roles
6. If not found: auto-provision user (for known clients) or reject
```

The `password_hash` column remains in the schema but is `NULL` for Entra ID users. The session management in `user_sessions` continues to operate regardless of authentication method.

---

## 3. Roles & Permissions

### 3.1 Role Definitions

| Role Code | Primary Users | Key Permissions |
|---|---|---|
| `invoice_reviewer` | AP team, finance analysts | Upload packages, run processing, view all package data, access workbench, resolve exceptions, mark ready |
| `finance_approver` | Finance manager, controller | View package summaries, approve or reject packages. **Cannot be same person as reviewer** |
| `commercial_reviewer` | Commercial manager, quantity surveyor | Receive and resolve commercially-routed exceptions (CONTRACT_RATE, CONTRACT_SCOPE, CONTRACT_RETAINAGE) |
| `data_steward` | Data management team | Approve vendor master data candidates (Wave 2) |
| `system_admin` | IT administrator, EY admin | Manage clients, contracts, contract configs, users, roles, system_configs |
| `auditor` | Internal/external auditor | Read-only access to all data including full audit traces. Cannot write anything |
| `viewer` | Leadership, executives | Read-only dashboard and package summary access |

### 3.2 Permission Matrix

| Operation | invoice_reviewer | finance_approver | commercial_reviewer | system_admin | auditor | viewer |
|---|---|---|---|---|---|---|
| Create package | ✓ | | | | | |
| Upload files | ✓ | | | | | |
| Confirm agent plan | ✓ | | | | | |
| View workbench | ✓ | | ✓ (own queue) | ✓ | ✓ | |
| Accept exception | ✓ | | ✓ (own queue) | | | |
| Override exception | ✓ | | ✓ (own queue) | | | |
| Escalate exception | ✓ | | | | | |
| Mark ready (HITL) | ✓ | | | | | |
| Approve package | | ✓ | | | | |
| Reject package | | ✓ | | | | |
| View audit trace | ✓ (own packages) | ✓ (own approvals) | | ✓ | ✓ | |
| Manage contracts | | | | ✓ | | |
| Manage users | | | | ✓ | | |
| View dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View system_configs | | | | ✓ | | |
| Edit system_configs | | | | ✓ | | |

### 3.3 Role Enforcement in API Layer

Every API endpoint enforces role checks **after** authentication:

```javascript
// Pattern for every protected endpoint:
async function requireRole(req, res, next, allowedRoles) {
  const userId = req.user.id;
  const clientId = req.params.clientId || req.user.clientId;
  
  const userRoles = await db.query(
    `SELECT r.code FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ? 
       AND r.is_active = 1
       AND ur.revoked_at IS NULL
       AND (ur.client_id = ? OR ur.client_id IS NULL)`,
    [userId, clientId]
  );
  
  const roleCodes = userRoles.map(r => r.code);
  if (!allowedRoles.some(r => roleCodes.includes(r))) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}
```

---

## 4. Multi-Tenant Data Isolation

### 4.1 The client_id Isolation Pattern

Every operational table either directly contains `client_id` or is reachable via a foreign key chain to a table that does. The isolation rule is:

**Every SELECT query on an operational table MUST include a client_id filter (direct or via JOIN).**

```sql
-- Correct — explicitly scoped to client:
SELECT * FROM packages
WHERE contract_id IN (SELECT id FROM contracts WHERE client_id = ?)

-- Also correct — client_id on the table directly:
SELECT * FROM packages
WHERE client_id = ?

-- WRONG — no client scope (data leak risk):
SELECT * FROM packages WHERE id = ?
```

### 4.2 Tables and Their Isolation Mechanism

| Table | Isolation Column | Mechanism |
|---|---|---|
| `contracts` | `client_id` | Direct column |
| `packages` | `client_id` | Direct column |
| `package_documents` | via `package_id` → `packages.client_id` | JOIN |
| `gc_pay_application_headers` | via `package_id` → `packages.client_id` | JOIN |
| `gc_pay_application_sov_lines` | via `package_id` → `packages.client_id` | JOIN |
| `sub_pay_application_headers` | via `package_id` → `packages.client_id` | JOIN |
| `sub_pay_application_sov_lines` | via `package_id` → `packages.client_id` | JOIN |
| `supporting_document_items` | via `package_id` → `packages.client_id` | JOIN |
| `exceptions` | via `package_id` → `packages.client_id` | JOIN |
| `audit_events` | via `package_id` → `packages.client_id` | JOIN |
| `users` | `client_id` | Direct column (NULL = platform admin) |
| `notifications` | via `user_id` → `users.client_id` | JOIN |

### 4.3 Cross-Client Access (Platform Admins)

Users with `user_roles.client_id IS NULL` have platform-level access. This is exclusively the `system_admin` role for EY platform administrators. These accounts must be explicitly created and are subject to enhanced audit logging. All actions by platform admins are tagged in `review_action_logs` and `audit_events`.

---

## 5. Separation of Duties

### 5.1 Database Enforcement

The most critical separation of duties control is that the invoice reviewer cannot approve their own reviewed package.

**Schema enforcement:**
```sql
-- Both columns exist on packages:
packages.reviewed_by    INTEGER FK → users
packages.approved_by    INTEGER FK → users
```

**API enforcement (before writing approval):**
```sql
SELECT reviewed_by FROM packages WHERE id = ? AND package_status = 'HITL_COMPLETE'
-- If result.reviewed_by == req.user.id → reject with 403
```

**Audit evidence:**
Both `reviewed_by` and `approved_by` are written to `packages`. The `audit_events` table records `HITL_SUBMITTED` (by reviewer) and `APPROVED` (by approver) as separate events with separate `triggered_by` user IDs. An auditor can verify separation of duties from a single SQL query:

```sql
SELECT 
  p.id,
  reviewer.display_name AS reviewed_by,
  approver.display_name AS approved_by,
  CASE WHEN p.reviewed_by = p.approved_by THEN 'VIOLATION' ELSE 'OK' END AS sod_check
FROM packages p
JOIN users reviewer ON reviewer.id = p.reviewed_by
JOIN users approver ON approver.id = p.approved_by
WHERE p.package_status = 'APPROVED'
```

### 5.2 Role Separation in user_roles

The `finance_approver` and `invoice_reviewer` roles must not be held by the same user for the same client. This is enforced at user role assignment time:

```sql
-- Before assigning finance_approver role:
SELECT COUNT(*) FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = ? AND ur.client_id = ? AND r.code = 'invoice_reviewer' AND ur.revoked_at IS NULL
-- If > 0: reject the role assignment with an error
```

---

## 6. Data Security Requirements

### 6.1 Sensitive Fields

| Field | Table | Classification | Protection |
|---|---|---|---|
| `password_hash` | `users` | SECRET | Never returned in API responses; never logged |
| `session_token` | `user_sessions` | SECRET | Never logged; excluded from all API responses |
| `entra_oid` | `users` | CONFIDENTIAL | Not returned to non-admin API consumers |
| `ip_address` | `user_sessions`, `review_action_logs` | CONFIDENTIAL | Access restricted to `system_admin` and `auditor` roles |
| `email` | `users` | INTERNAL | Available within the client's users only |
| `config_value` where `is_sensitive=1` | `system_configs` | SECRET | Masked as "***" in API responses; stored encrypted in production |

### 6.2 Encryption at Rest (Production)

| Layer | Encryption |
|---|---|
| Azure SQL database | Azure SQL Transparent Data Encryption (TDE) — on by default |
| Azure Blob Storage (PDFs) | Azure Blob Storage encryption with customer-managed keys (CMK) |
| `system_configs` sensitive values | AES-256 encrypted before INSERT; decrypted only in the application process |
| `users.password_hash` | bcrypt (irreversible) — no decryption needed |

### 6.3 SQL Injection Prevention

All queries use **parameterised statements** exclusively. The existing `db.prepare(sql); stmt.bind(params)` pattern in `sql.js` correctly prevents SQL injection. No string concatenation is permitted in SQL construction.

**Forbidden pattern (never do this):**
```javascript
// WRONG — SQL injection vulnerability:
db.run(`SELECT * FROM packages WHERE id = ${req.params.id}`)
```

**Required pattern:**
```javascript
// CORRECT — parameterised:
const stmt = db.prepare("SELECT * FROM packages WHERE id = ?");
stmt.bind([req.params.id]);
```

### 6.4 File Upload Security

The `package_documents` table stores file metadata. The file upload pipeline enforces:

| Check | Implementation |
|---|---|
| MIME type validation | `multer` fileFilter: only `application/pdf` accepted; all others rejected with 400 |
| File size limit | 200MB per file (configurable via `system_configs.upload.max_file_size_mb`) |
| Filename sanitisation | Stored filename is a server-generated timestamp + random suffix. Original filename stored in `original_filename` column but never used for file system operations |
| Path traversal prevention | Upload directory is a fixed absolute path; filenames never contain `/`, `..`, or special characters |
| Quarantine for suspicious files | Encrypted or corrupt files set `upload_status = 'QUARANTINED'` and are not processed |

### 6.5 API Security Headers (Production)

All API responses must include:
```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: no-referrer
```

CORS configuration: Restrict `Access-Control-Allow-Origin` to the frontend domain only. The current `cors({ origin: "http://localhost:5173" })` must be changed to the production domain before go-live.

---

## 7. Authentication References

### 7.1 MVP Authentication Flow

```
1. POST /api/auth/login { email, password }
2. Server: SELECT id, password_hash, client_id, is_active FROM users WHERE email = ?
3. Server: bcrypt.compare(password, password_hash)
4. If match: INSERT INTO user_sessions (user_id, session_token, expires_at)
5. Return: { session_token, user: { id, display_name, roles } }
6. Client: stores session_token in memory (NOT localStorage — XSS risk)
7. All subsequent requests: Authorization: Bearer {session_token}
8. Server middleware: SELECT user_id FROM user_sessions WHERE session_token = ? AND expires_at > datetime('now') AND revoked_at IS NULL
```

### 7.2 Production Authentication Flow (Entra ID)

```
1. User clicks "Sign in with Microsoft"
2. Browser redirected to Microsoft login (Entra ID)
3. After authentication: Entra issues ID token + access token
4. Frontend sends access token to backend: POST /api/auth/entra-callback
5. Backend validates token with Entra ID JWKS endpoint
6. Backend extracts oid from token claims
7. Backend: SELECT * FROM users WHERE entra_oid = ? AND is_active = 1
8. Backend creates user_sessions record (even with Entra ID, for internal session tracking)
9. Backend returns internal session token for subsequent API calls
```

### 7.3 Session Security

```sql
-- Expired session cleanup (run as scheduled job, every hour):
DELETE FROM user_sessions
WHERE expires_at < datetime('now', '-7 days')
  AND revoked_at IS NOT NULL

-- Active session check (every API request):
SELECT u.id, u.client_id, u.is_active FROM user_sessions s
JOIN users u ON u.id = s.user_id
WHERE s.session_token = ?
  AND s.expires_at > datetime('now')
  AND s.revoked_at IS NULL
  AND u.is_active = 1
```

---

## 8. Audit Requirements

### 8.1 What Is Always Logged

| Event | Table | Fields captured |
|---|---|---|
| Login (success or fail) | `user_sessions` + `audit_events` | user_id, ip_address, timestamp |
| Package created | `audit_events` | triggered_by, triggered_at |
| Files uploaded | `audit_events` | file roles, hashes, page counts |
| Agent plan confirmed | `audit_events`, `review_action_logs` | confirmed_by, sub count, manual adds |
| Any exception resolved | `exception_resolutions`, `review_action_logs` | resolver, type, value, comment |
| Any canonical value changed | `data_change_logs` | field, before, after, reason, user |
| HITL submission | `audit_events` | reviewer, summary JSON |
| Package approved/rejected | `audit_events` | approver, decision, timestamp |
| User role changed | `review_action_logs` | grantee, role, granted/revoked by |

### 8.2 Audit Log Immutability

Audit tables (`audit_events`, `review_action_logs`, `data_change_logs`, `exception_resolutions`) are **append-only**. The API layer enforces this:
- No UPDATE or DELETE endpoints exist for these tables
- In production on Azure SQL: table-level DENY permissions for UPDATE and DELETE on the application service principal

### 8.3 Non-Repudiation

Every financial decision (exception resolution, package approval, plan confirmation) is tied to:
1. A specific `user_id` with display_name + email (cannot be anonymous)
2. A timestamp in UTC
3. The specific value at the time of the decision (before/after in `data_change_logs`)

This satisfies non-repudiation requirements for accounts payable audit purposes.

---

*Document continues in: [05_Integration_Architecture.md](05_Integration_Architecture.md)*
