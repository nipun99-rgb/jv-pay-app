# HANDOVER PROMPT — E2E Bug Fixes (Sprint 4)

## Context
Full end-to-end testing was completed. The extraction-to-reconciliation pipeline works but the final step (HITL approval) is blocked, and several data display issues remain. This prompt lists every fix needed with exact file locations and code context.

## Environment
- **Frontend:** `cd project-manager/frontend && npm run dev` → port 5173
- **Backend:** `cd project-manager/backend && node server.js` → port 3001
- **DB:** Azure SQL via Prisma (`DATABASE_URL` in `.env`)
- **Login:** `test@aic.com` / `Test1234!` (role: REVIEWER, userId: 2)
- **Test package:** ID 16 (contract "Test 1", Feb 2026, 28 exceptions, status EXCEPTION_REVIEW)

---

## FIX 1 — CRITICAL: HITL "Confirm & Send" Returns 400

**Files:**
- `backend/routes/packages.js` (lines 143–191)
- `frontend/src/pages/package/HitlPage.jsx` (lines 53–65)

**Problem:** HitlPage calls:
```js
await apiFetch(`/packages/${packageId}`, {
  method: 'PATCH',
  body: JSON.stringify({ packageStatus: 'READY_FOR_APPROVAL' }),
});
```
But `PATCH /api/packages/:packageId` only allows `APPROVED` or `REJECTED` and requires role `APPROVER`/`ADMIN`. The logged-in user is a `REVIEWER`.

**Fix — Backend:** Add a new route in `backend/routes/packages.js` BEFORE the existing PATCH:

```js
// POST /api/packages/:packageId/submit — Reviewer submits package for approval
router.post('/:packageId/submit', requireAuth, requireRole(['REVIEWER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const id = parseInt(req.params.packageId);
    const pkg = await prisma.package.findFirst({
      where: { id, ...(req.clientId ? { clientId: req.clientId } : {}) }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    if (pkg.packageStatus !== 'EXCEPTION_REVIEW') {
      return res.status(400).json({ error: 'Package must be in EXCEPTION_REVIEW status to submit' });
    }

    await prisma.package.update({
      where: { id },
      data: {
        packageStatus: 'READY_FOR_APPROVAL',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        submittedBy: req.user.id,
        submittedAt: new Date()
      }
    });

    await prisma.auditEvent.create({
      data: {
        packageId: id,
        eventType: 'SUBMITTED_FOR_APPROVAL',
        triggeredBy: req.user.id,
        triggeredAt: new Date(),
        eventSummary: `Package submitted for approval by ${req.user.displayName}`
      }
    });

    res.json({ success: true, packageStatus: 'READY_FOR_APPROVAL' });
  } catch (err) {
    console.error('POST /packages/:id/submit error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Fix — Frontend:** In `HitlPage.jsx`, change the `handleConfirmSend` function to use the new endpoint:
```js
// BEFORE:
await apiFetch(`/packages/${packageId}`, {
  method: 'PATCH',
  body: JSON.stringify({ packageStatus: 'READY_FOR_APPROVAL' }),
});

// AFTER:
await apiFetch(`/packages/${packageId}/submit`, { method: 'POST' });
```

**Verify:** Click "Confirm & Send for Approval" on `/packages/16/hitl` — should succeed, status transitions to `READY_FOR_APPROVAL`, View B appears.

---

## FIX 2 — HIGH: EXTRACTED Stat Shows "0"

**Files:**
- `backend/routes/pipelineV2.js` (VALIDATE step handler)
- `frontend/src/pages/package/CompletePage.jsx` (lines 26–30)

**Problem:** `pkg.totalItemsExtracted` is `null` in the database. The VALIDATE pipeline step never computes it.

**Fix — Option A (Backend):** At the end of the VALIDATE step (in `pipelineV2.js`, after creating exceptions), count extracted items and update the package:
```js
const gcLineCount = await prisma.gcSovLine.count({ where: { packageId } });
const subHeaderCount = await prisma.subPayApplicationHeader.count({ where: { packageId } });
await prisma.package.update({
  where: { id: packageId },
  data: { totalItemsExtracted: gcLineCount + subHeaderCount }
});
```

**Fix — Option B (Frontend fallback):** In `CompletePage.jsx`, if `pkg.totalItemsExtracted` is null, compute it from API data:
```js
// After fetching pkg, also fetch counts
const [gcLines, subHeaders] = await Promise.all([
  apiFetch(`/packages/${packageId}/gc-sov-lines`).then(d => d?.length || 0),
  apiFetch(`/packages/${packageId}/sub-headers`).then(d => d?.length || 0),
]);
const totalExtracted = pkg.totalItemsExtracted || (gcLines + subHeaders);
```

**Verify:** CompletePage "EXTRACTED" stat shows actual number (e.g., 266 for package 16: 234 GC lines + 32 sub-headers).

---

## FIX 3 — HIGH: File 2 Page Shows "No Sub-Contractor Lines"

**File:** `frontend/src/pages/package/File2Page.jsx`

**Problem:** The page queries sub-contractor line items and filters for `workThisPeriod > 0` or similar. Either the endpoint returns no data or the filter is wrong.

**Debug Steps:**
1. Check what API endpoint File2Page calls — likely `/api/packages/:id/sub-lines` or `/api/packages/:id/sub-headers`
2. Call the endpoint directly: `GET http://localhost:3001/api/packages/16/sub-headers`
3. If data exists, the frontend filter is too strict
4. If no data, the extraction step stores it differently (check `SubPayApplicationHeader` and `SubPayAppLineItem` tables)

**Likely Fix:** The `SubPayApplicationHeader` records exist (32 of them — confirmed in Plan page), but the File2 page may be looking for `SubPayAppLineItem` (child records) which may not have been populated during extraction. Check the `EXTRACT_FILE2` pipeline step to verify it creates line items per sub-contractor.

---

## FIX 4 — HIGH: G703 Table Missing # and Description

**File:** `frontend/src/pages/package/File1Page.jsx`

**Problem:** The G703 SOV Lines table shows `lineNo` and `description` as empty. The GcSovLine records in the DB have these fields as `null`.

**Debug Steps:**
1. Query: `SELECT lineNo, description, subContractorName FROM GcSovLine WHERE packageId = 16 LIMIT 5`
2. If `lineNo` is null but `itemNumber` or `seqNo` exists, fix column mapping in File1Page
3. If `description` is null but `subContractorName` has values, use `subContractorName` as the display text

**Likely Fix:** The extraction stores the description in `subContractorName` field. Map the column:
```jsx
// In File1Page table columns
<td>{line.lineNo || line.itemNumber || idx + 1}</td>
<td>{line.description || line.subContractorName || '—'}</td>
```

---

## FIX 5 — HIGH: Duplicate Key Warning in IngestPage Activity

**File:** `frontend/src/pages/package/IngestPage.jsx`

**Problem:** Activity list has items with duplicate IDs, causing React "duplicate key" warnings.

**Fix:** Use index as part of key:
```jsx
// BEFORE:
{activity.map(a => <li key={a.id}>...</li>)}

// AFTER:
{activity.map((a, i) => <li key={`${a.id}-${i}`}>...</li>)}
```

**Also investigate backend:** Check why `/api/activity/14` returns duplicate entries for "Package created" at the same timestamp. Fix in the package creation route — likely calls `ActivityLog.create()` twice.

---

## FIX 6 — MEDIUM: Notification Bell Does Nothing

**File:** `frontend/src/components/AppShell.jsx`

**Problem:** The bell icon button has no `onClick` handler or dropdown component.

**Fix:** Add a notifications dropdown/popover:
```jsx
const [showNotifications, setShowNotifications] = useState(false);
const [notifications, setNotifications] = useState([]);

useEffect(() => {
  apiFetch('/notifications').then(setNotifications).catch(() => {});
}, []);

// In JSX, wrap bell button:
<div className="relative">
  <button onClick={() => setShowNotifications(!showNotifications)}>
    <Bell className="h-5 w-5" />
    {notifications.filter(n => !n.isRead).length > 0 && (
      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
    )}
  </button>
  {showNotifications && (
    <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border bg-white shadow-lg p-4">
      <h3 className="text-sm font-semibold mb-2">Notifications</h3>
      {notifications.length === 0 ? (
        <p className="text-xs text-gray-400">No notifications</p>
      ) : (
        notifications.map(n => (
          <div key={n.id} className={`py-2 border-b text-xs ${n.isRead ? 'opacity-60' : ''}`}>
            <p className="font-medium">{n.title}</p>
            <p className="text-gray-500">{n.message}</p>
          </div>
        ))
      )}
    </div>
  )}
</div>
```

---

## FIX 7 — MEDIUM: Exception Table SUB Column

**File:** `frontend/src/pages/package/ExceptionsPage.jsx`

**Problem:** The SUB column shows "—" because exceptions don't have `subContractorName` directly. The sub name is accessible via: `exception.entityType === 'sub_pay_application_header'` → join to `SubPayApplicationHeader` where `id === exception.entityId`.

**Fix — Backend:** In the exceptions endpoint, include the entity name. Add to the `GET /api/exceptions/:packageId` query:
```js
// When returning exceptions, if entityType is sub_pay_application_header, look up name
const enriched = await Promise.all(exceptions.map(async (ex) => {
  if (ex.entityType === 'sub_pay_application_header') {
    const sub = await prisma.subPayApplicationHeader.findUnique({
      where: { id: ex.entityId },
      select: { subContractorName: true }
    });
    return { ...ex, subContractorName: sub?.subContractorName || null };
  }
  return ex;
}));
```

**Fix — Frontend:** Derive 3-letter code from the sub name:
```jsx
const subCode = ex.subContractorName ? ex.subContractorName.substring(0, 3).toUpperCase() : '—';
```

---

## FIX 8 — MEDIUM: Exception Table FILE 1 / FILE 2 Values

**File:** `frontend/src/pages/package/ExceptionsPage.jsx`

**Problem:** `file1Value` is null for most exceptions. The CROSS_FILE_MISMATCH exceptions store: `file2Value` (from sub-app) and `variance`. The GC (File 1) value = `file2Value - variance` (or it's 0 because GC shows $0 for that sub).

**Fix:** Display computed values:
```jsx
const f1 = ex.file1Value != null ? formatCurrency(ex.file1Value) 
           : ex.expectedValue != null ? formatCurrency(ex.expectedValue) 
           : '—';
const f2 = ex.file2Value != null ? formatCurrency(ex.file2Value) : '—';
```

Actually, from the data: `file1Value=null`, `file2Value="4007640"`, `variance="4007640"` means File 1 = 0 (GC shows $0), File 2 = $4M. Display:
```jsx
const f1 = ex.file1Value ?? (ex.file2Value && ex.variance ? formatCurrency(Number(ex.file2Value) - Number(ex.variance)) : '—');
```

---

## FIX 9 — LOW: Duplicate Activity Entries

**File:** `backend/routes/packages.js` (POST `/api/packages` — package creation route)

**Problem:** When creating a package, the activity log entry "Package created. Awaiting file uploads." is created twice for the same package at the same timestamp.

**Fix:** Search for duplicate `activityLog.create` calls in the package creation logic. Remove the extra one.

---

## FIX 10 — LOW: Contract Dropdown Disambiguation

**File:** `frontend/src/pages/PackageIntakePage.jsx`

**Problem:** Contract dropdown shows "Project 6" twice (IDs 9 and 10 have same name).

**Fix:** Show contract number alongside name:
```jsx
<option key={c.id} value={c.id}>
  {c.contractName}{c.contractNo ? ` (${c.contractNo})` : ''}
</option>
```

---

## Execution Order

1. **Fix 1** (HITL submit) — CRITICAL, unblocks the full workflow
2. **Fix 2** (EXTRACTED stat) — High visibility stat on CompletePage + Dashboard
3. **Fix 3** (File 2 page) — Debug and fix sub-line query
4. **Fix 4** (G703 columns) — Column mapping
5. **Fix 5** (Duplicate key) — Console warning fix
6. **Fix 6** (Notifications) — Feature addition
7. **Fix 7 + 8** (Exception table data) — Backend enrichment + frontend display
8. **Fix 9 + 10** (Low priority cleanup)

## After All Fixes

Test the FULL flow:
1. Navigate to `/packages/16/hitl` → Click "Confirm & Send for Approval" → Should succeed, show View B
2. Check database: package 16 should now be `READY_FOR_APPROVAL`
3. CompletePage EXTRACTED stat should show actual count
4. File2Page should show sub-contractor line items
5. Exception table should show SUB codes and FILE 1/FILE 2 values

## DO NOT
- Modify the Prisma schema (all tables already exist)
- Add npm packages without checking if alternatives exist
- Create TypeScript files
- Change working CSS/styling (UI is locked from Sprint 3)
- Delete or modify existing test data
- Break the existing resolve/accept exception flow (it works correctly)
