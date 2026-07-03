# Invoice Validation & Review Platform
## Sprint 4: Pipeline Activation & PDF Processing Engine

**Date:** 2 July 2026
**Prerequisites:** Sprints 1–3 complete and audited. Application running at `http://localhost:5173`. Backend at `http://localhost:3001`.
**Goal:** Make the end-to-end pipeline functional — file upload, PDF storage, extraction, reconciliation, and exception generation — using the real PDF documents attached to this sprint.

---

## Current State (What Is Already Built — Do Not Rebuild)

Sprints 1–3 delivered a fully functional shell:

| Layer | Status |
|---|---|
| 36-table Azure SQL schema (Prisma) | ✅ Complete |
| Express backend with auth, tenancy, all CRUD routes | ✅ Complete |
| React frontend: all 9 screens, AppShell, routing, StepRail | ✅ Complete |
| Package creation (creates DB record + 9 pipeline steps) | ✅ Complete |
| Activity feed polling, pipeline step polling | ✅ Complete |
| Exception navigator, HITL Gate 1 & 2 | ✅ Complete |

**The single gap:** When a user creates a package and selects PDFs in the intake wizard, the files are captured in React state but **never transmitted to the backend**. The pipeline steps all stay at `pending` forever. Nothing gets extracted.

The application at `http://localhost:5173/packages/13/ingest` shows this clearly — Activity Feed says "Awaiting file uploads." and all 9 StepRail steps show clock icons.

---

## What Is Being Tested — The Real PDF

The attached PDF is **Application No. 12** for **Boeing/BSC Site Expansion**, dated Period To: **2/28/26**.

It contains 3 logical sections (all in one multi-page PDF for File 1):

### File 1 — GC Pay Application (pages 1–8)
**G702 Cover Page** (page 1) — key financial fields:
- Original Contract Sum: $915,480,436
- Net change by Change Orders: $400,427,038
- Contract Sum to Date: $1,315,907,474
- Total Completed & Stored to Date: $422,865,412
- Retainage (5% completed + 5% stored): $15,444,309
- Total Earned Less Retainage: $407,421,104
- Less Previous Certificates: $361,844,557
- **Current Payment Due: $45,576,547**
- Balance to Finish: $908,486,371

**G703 Continuation Sheet** (pages 2–8) — 234 SOV line items organized by work sections (P1SI, SITE, TEMP FIRE, FLTL, PTS, PKRD, 8848, CUB, T1-T4, DLO, Temp Fire Station). Each row has: Item No, Description, Scheduled Value (Original + Change Orders + Current), Work Completed From Previous + This Period, Materials Stored, Total Completed & Stored, % Complete, Balance to Finish, Retainage.

**General Conditions / Billing Rate Form** (pages 9–10) — labor detail table (skip for now, store as page range only).

**Sub Cost Recon** (page 11) — list of sub-contractor payments this period:
- Landmark: $170,034 (P1SI), $2,000,542 (FLTL), $2,485,425 (PKRD)
- Gulfstream: $2,726,573 (SITE), $4,030,000 + $3,620,000 (PKRD), $575,835 (T1T4)
- Independence: $2,437,788 (FLTL), $181,250 (T1T4), $166,500 (DLO)
- SC Steel: $5,311,429 (88-48), Bauer Foundations: $1,929,666 (88-48)
- American Crane: $1,113,900 (88-48), Wayne Brothers: $3,227,787 (88-48)
- OL Thompson: $4,211,940 (88-48), Bell Constructors: $286,857 (88-48)
- And more... Total Sub Cost: **$41,572,643.15**

File 2 (sub-contractor packages PDF) and File 3 (supporting documents PDF) are separate uploads.

---

## Sprint 4 Tasks

### S4-01 — Wire File Upload: Frontend → Backend → Azure Blob Storage

**Effort:** 4 hours

**Problem:** `PackageIntakePage.jsx` calls `POST /api/packages` (JSON only) then navigates to ingest. Files are selected in `file1`, `file2`, `file3` state but never sent.

**What to build:**

**Backend — new route in `routes/packages.js`:**
```javascript
// POST /api/packages/:packageId/documents — upload 1-3 PDF files
// Middleware: requireAuth → requireRole(['REVIEWER','ADMIN']) → requireTenancy → upload.fields([...])
// For each file:
//   1. Upload to Azure Blob Storage container 'invoice-packages'
//      Blob name: `${clientId}/${packageId}/${fileOrder}-${originalname}`
//   2. INSERT into document_uploads: packageId, fileType (FILE_1/FILE_2/FILE_3), blobUrl, fileName, fileSize, uploadedBy
//   3. INSERT activity_log: "File 1 uploaded: {filename} ({sizeMB} MB)"
// After all files uploaded:
//   4. UPDATE processing_pipeline_steps SET status='running', started_at=NOW() WHERE package_id=? AND step_no=1
//   5. UPDATE packages SET package_status='INGESTING' WHERE id=?
//   6. INSERT activity_log: "Ingestion started. Processing {N} file(s)."
//   7. Trigger pipeline processing (call internal pipeline service — see S4-02)
// Response: { uploaded: N, documents: [...] }
```

Azure Blob SDK is already in the `.env`:
```
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;...AccountName=aicstorageindia;AccountKey=..."
```

Install `@azure/storage-blob` if not already present:
```bash
npm install @azure/storage-blob
```

**Frontend — update `PackageIntakePage.jsx`:**
```javascript
// Replace handleSubmit to do 2-step:
// Step 1: POST /packages (JSON) → get packageId back
// Step 2: If files selected, POST /packages/:packageId/documents (FormData with file1, file2, file3)
// Navigate to /packages/:packageId/ingest AFTER step 2 resolves
// Show progress state: "Creating package..." → "Uploading files..." → "Processing..."

const handleSubmit = async () => {
  setLoading(true);
  setLoadingMsg('Creating package...');
  try {
    // Step 1: create the package record
    const { packageId } = await apiFetch('/packages', {
      method: 'POST',
      body: JSON.stringify({ contractId: parseInt(contractId), billingPeriodMonth: parseInt(month), billingPeriodYear: parseInt(year) })
    });

    // Step 2: upload files if any selected
    if (file1 || file2 || file3) {
      setLoadingMsg('Uploading files...');
      const form = new FormData();
      if (file1) form.append('file1', file1);
      if (file2) form.append('file2', file2);
      if (file3) form.append('file3', file3);
      await apiFetch(`/packages/${packageId}/documents`, { method: 'POST', body: form });
    }

    navigate(`/packages/${packageId}/ingest`);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
    setLoadingMsg('');
  }
};
```

**Acceptance criteria:**
- Selecting a PDF and clicking "Create Package" transmits the file to the backend
- File appears in Azure Blob Storage container `invoice-packages`
- `document_uploads` row created in Azure SQL with correct blob URL
- IngestPage Activity Feed shows "File 1 uploaded: {filename}"
- Pipeline step 1 (INGEST) advances from `pending` → `running`

---

### S4-02 — Pipeline Processing Service

**Effort:** 6 hours

**Architecture:** A Node.js pipeline service (`backend/lib/pipeline.js`) that executes each step in sequence after upload. Each step:
1. Marks itself `running` in `processing_pipeline_steps`
2. Posts activity log messages
3. Does its work
4. Marks itself `complete`
5. Calls the next step (or stops at AGENT_PLAN gate and REVIEW gate)

```javascript
// backend/lib/pipeline.js

const prisma = require('./prisma');

async function advanceStep(packageId, stepName, fn) {
  await prisma.processingPipelineStep.updateMany({
    where: { packageId, stepName },
    data: { status: 'running', startedAt: new Date() }
  });
  await log(packageId, stepName, 'info', `Starting step: ${stepName}`);

  try {
    await fn();
    await prisma.processingPipelineStep.updateMany({
      where: { packageId, stepName },
      data: { status: 'complete', completedAt: new Date() }
    });
    await log(packageId, stepName, 'info', `Step ${stepName} complete.`);
  } catch (err) {
    await prisma.processingPipelineStep.updateMany({
      where: { packageId, stepName },
      data: { status: 'error' }
    });
    await log(packageId, stepName, 'error', `Step ${stepName} failed: ${err.message}`);
    throw err;
  }
}

async function log(packageId, stepName, level, message) {
  const step = await prisma.processingPipelineStep.findFirst({ where: { packageId, stepName } });
  await prisma.activityLog.create({
    data: { packageId, level, stepNo: step?.stepNo || 0, message }
  });
}

async function runPipeline(packageId) {
  // INGEST → CLASSIFY → EXTRACT_FILE1 → [AGENT_PLAN gate] → EXTRACT_FILE2 → EXTRACT_FILE3 → RECONCILE → VALIDATE → [REVIEW gate]
  await runIngest(packageId);
  await runClassify(packageId);
  await runExtractFile1(packageId);
  // STOP HERE — CLASSIFY step ends in 'paused', waiting for user confirmation via POST /pipeline/:id/confirm
}

module.exports = { runPipeline, advanceStep, log };
```

**Step implementations:**

**S4-02a — INGEST step:** Mark `document_uploads` as verified. Count pages. Log each document.

**S4-02b — CLASSIFY step:** Detect document structure using pdfplumber (or page count heuristic). Log detected structure. Set CLASSIFY step to `paused` (triggers confirmation card in IngestPage UI).
```javascript
// Example classification logic:
// File 1 page 1 contains "G702" → type = GC_PAY_APP
// File 1 pages 2-8 contain "CONTINUATION SHEET" → G703 pages = 2-8
// Log: "File 1: 12 pages — GC Pay Application (G702 + G703) ✓"
// Log: "File 2: 183 pages — Sub-Contractor Package ✓" (if uploaded)
// Set CLASSIFY status = 'paused'  ← triggers confirmation card in IngestPage
// Update package_status = 'AWAITING_CLASSIFICATION_CONFIRM'
```

**S4-02c — POST /pipeline/:id/confirm handler (already exists in `pipelineV2.js`) — enhance it:**
When `stepName = 'CLASSIFY'` confirmed: mark CLASSIFY as `confirmed`, then call `runExtractFile1(packageId)` asynchronously.

**Acceptance criteria:**
- After file upload, IngestPage Activity Feed shows live messages as steps execute
- INGEST and CLASSIFY advance in real time (visible in StepRail within 5 seconds)
- CLASSIFY step ends in `paused` state — confirmation card appears
- Clicking "Confirm & Continue" advances to File1Page and triggers extraction

---

### S4-03 — G703 Extraction (EXTRACT_FILE1 step)

**Effort:** 5 hours

**Existing asset:** `project-manager/backend/extract_g703.py` — a pdfplumber-based extractor that reads G703 SOV lines using coordinate-based column detection. It already outputs CSV with columns: `item_no, description, c_orig, c_co, c_curr, d_prev, e_this, f_mat, g_total, h_pct, i_balance, j_retainage`.

**What to build:**

1. **Node.js wrapper to invoke the Python script:**
```javascript
// backend/lib/extractors/g703.js
const { spawn } = require('child_process');
const path = require('path');

async function extractG703(pdfLocalPath, packageId) {
  return new Promise((resolve, reject) => {
    const outCsv = path.join(__dirname, '../../uploads', `g703_${packageId}.csv`);
    const proc = spawn('python', [
      path.join(__dirname, '../../extract_g703.py'),
      pdfLocalPath,
      outCsv
    ]);
    proc.stderr.on('data', d => console.error(`G703 extractor: ${d}`));
    proc.on('close', code => code === 0 ? resolve(outCsv) : reject(new Error(`G703 exit ${code}`)));
  });
}

module.exports = { extractG703 };
```

2. **Load extracted CSV into Azure SQL:**
After Python extraction, parse the CSV and insert into `gc_pay_application_sov_lines`:
```javascript
// For each row in CSV:
await prisma.gcPayApplicationSovLine.create({
  data: {
    packageId,
    lineNo: parseInt(row.item_no) || null,
    description: row.description,
    scheduledValue: parseFloat(row.c_curr) || 0,
    previousCompleted: parseFloat(row.d_prev) || 0,
    workCompletedThis: parseFloat(row.e_this) || 0,
    materialsStored: parseFloat(row.f_mat) || 0,
    totalCompletedStored: parseFloat(row.g_total) || 0,
    percentComplete: parseFloat(row.h_pct) || 0,
    balanceToFinish: parseFloat(row.i_balance) || 0,
    retainage: parseFloat(row.j_retainage) || 0,
    validationStatus: 'unchecked',
    sourcePage: null  // set if page number known
  }
});
```

3. **Extract G702 header from page 1 and store in `gc_pay_application_headers`:**
The G702 header fields from the real PDF (use these as the extraction target):
- `applicationNumber`: 12
- `periodTo`: "2026-02-28"
- `contractName`: "Boeing/25/BSC Site Expansion"
- `contractorName`: "BE&K | HITT"
- `originalContractSum`: 915480436
- `netChangeByChangeOrders`: 400427038
- `contractSumToDate`: 1315907474
- `totalCompletedStoredToDate`: 422865412
- `retainagePercent`: 5.0
- `retainageCompleted`: 15373232
- `retainageMaterials`: 71076
- `totalRetainage`: 15444309
- `totalEarnedLessRetainage`: 407421104
- `lessPreviousCertificates`: 361844557
- `currentPaymentDue`: 45576547
- `balanceToFinish`: 908486371

Use pdfplumber to extract these from page 1 using coordinate regions or regex patterns on the extracted text.

4. **After extraction complete:**
- Mark EXTRACT_FILE1 step `complete`
- Create `agent_plan` record with status `pending`
- For each G703 SOV line that is a sub-contractor line (description contains a company name in parentheses e.g. "EARTHWORK & UTILITIES (LANDMARK)"):
  - Parse sub-contractor name from description
  - Create `agent_plan_item` with: `subcontractorName`, `billedAmount` = workCompletedThis, `isConfirmed` = false
- Mark AGENT_PLAN step `paused` → this is HITL Gate 1
- Log: "Agent plan ready: {N} sub-contractors identified, ${total} total billed this period"

**Expected result for the Boeing PDF:**
The agent plan should identify sub-contractors like: LANDMARK, FEYEN ZYLSTRA, LITHKO, NAVIGATOR, CR HIPP, DUO-GARD, MANER FENCING, YELLOWSTONE LANDSCAPE, ELDECO, INDEPENDENCE PAVING, GULFSTREAM, SC STEEL, BAUER, AMERICAN CRANE, WAYNE BROTHERS, OL THOMPSON, BELL CONSTRUCTORS, SHAMBAUGH, GLASSCORP, GALLO MECHANICAL, HW ELECTRICAL, etc.

**Acceptance criteria:**
- After "Confirm & Continue" on IngestPage, File1Page loads with real G702 fields from Azure SQL
- G703 DataTable shows all 234 SOV lines extracted from the PDF
- SubContractor toggle filters correctly (lines with workCompletedThis ≠ 0 only)
- PlanPage shows agent plan with correct sub-contractor list and billed amounts

---

### S4-04 — Sub-Contractor Extraction (EXTRACT_FILE2/3 steps)

**Effort:** 5 hours

**Existing asset:** `project-manager/backend/extract_subcontractors.py` — uses Azure Document Intelligence + GPT to extract individual sub-contractor pay application data from a multi-sub PDF. Requires env vars: `DOC_INTEL_ENDPOINT`, `DOC_INTEL_KEY`, `AOAI_ENDPOINT`, `AOAI_KEY`.

**Trigger:** After HITL Gate 1 is confirmed (AGENT_PLAN step confirmed via `POST /pipeline/:id/confirm`).

**What to build:**

1. **In `pipelineV2.js` confirm handler** — when `stepName = 'AGENT_PLAN'`:
```javascript
// After storing confirmed items:
// Run asynchronously: runExtractFile2(packageId, confirmedSubcontractors)
```

2. **Node.js wrapper for sub-contractor extraction:**
```javascript
// backend/lib/extractors/subcontractors.js
async function extractSubcontractors(pdfLocalPath, packageId, confirmedSubs) {
  // Download File 2 blob → local temp file
  // Invoke extract_subcontractors.py with --ocr azure flag (NON-NEGOTIABLE: always --ocr azure)
  // Parse output JSON
  // For each sub-contractor found:
  //   Filter: only process subs that are in confirmedSubs list (agent plan confirmed items)
  //   INSERT sub_pay_applications + sub_pay_application_sov_lines
  //   Log progress per sub: "Extracting Landmark... done. $2,485,425 extracted."
}
```

**Key constraint:** `--ocr azure` MUST always be passed. Never use `--ocr auto` or `--ocr none`.

3. **Store extracted data:**
```javascript
// For each confirmed sub-contractor:
await prisma.subPayApplication.create({
  data: {
    packageId,
    subcontractorName: sub.company,
    applicationNo: sub.app_number,
    periodTo: sub.period_to,
    netAmountThisPeriod: sub.net_amount,
    retainagePercent: sub.retainage_pct,
    // ...
  }
});

// For each SOV line in the sub-contractor application:
await prisma.subPayApplicationSovLine.create({
  data: {
    packageId,
    subPayApplicationId: subApp.id,
    lineNo: line.line_no,
    description: line.description,
    scheduledValue: line.scheduled_value,
    previousCompleted: line.previous_completed,
    workCompletedThis: line.work_completed_this, // ← FILTER: only ≠ 0 in UI
    // ...
  }
});
```

**Acceptance criteria:**
- After Gate 1 confirmed, File2Page Activity Feed shows live extraction progress per sub-contractor
- Sub SOV table appears when both EXTRACT_FILE2 and EXTRACT_FILE3 steps are complete
- Sub table only shows rows where workCompletedThis ≠ 0 (permanent filter — not a toggle on this screen)
- Each confirmed sub-contractor has a row in sub_pay_applications

---

### S4-05 — Reconciliation & Exception Generation (RECONCILE + VALIDATE steps)

**Effort:** 6 hours

**Trigger:** Auto-runs after EXTRACT_FILE3 completes (no gate).

**What to build: `backend/lib/reconcile.js`**

The reconciliation engine compares GC G703 data against sub-contractor data and generates exceptions.

**Reconciliation rules to implement:**

**Rule 1: CROSS_FILE_MISMATCH — GC SOV vs Sub Total**
```javascript
// For each sub-contractor in agent_plan_items (confirmed):
//   GC amount = SUM of gc_pay_application_sov_lines.work_completed_this WHERE description CONTAINS subName
//   Sub amount = SUM of sub_pay_application_sov_lines.work_completed_this WHERE subPayApplication.subcontractorName = subName
//   variance = GC amount - Sub amount
//   If abs(variance) > threshold (e.g. $100):
//     CREATE exception: type=CROSS_FILE_MISMATCH, severity based on variance %
//     gcAmount, subAmount, variance, variancePct
```

**Rule 2: MATH_ERROR — G703 column arithmetic**
```javascript
// For each SOV line:
//   expected_G = D + E + F (prev + this + materials)
//   actual_G = totalCompletedStored
//   If abs(actual_G - expected_G) > $1:
//     CREATE exception: type=MATH_ERROR
//
//   expected_H = G / scheduledValue * 100
//   actual_H = percentComplete
//   If abs(actual_H - expected_H) > 0.5%:
//     CREATE exception: type=MATH_ERROR
```

**Rule 3: RETAINAGE_DEVIATION**
```javascript
// For each SOV line:
//   expected_retainage = G * (retainagePercent / 100) from G702 header
//   actual_retainage = retainage column (J)
//   If abs(actual - expected) > $1:
//     CREATE exception: type=RETAINAGE_DEVIATION
```

**Rule 4: PERIOD_CONTINUITY**
```javascript
// G + previous_period_G703_total should equal current period's D (from previous)
// If previous package exists for same contract:
//   prev_total_completed = prev package's GC header totalCompletedStoredToDate
//   curr_D = sum of current gc_pay_application_sov_lines.previousCompleted
//   If mismatch: CREATE exception: type=PERIOD_CONTINUITY
```

**Exception storage:**
```javascript
// Group exceptions by type → create exception_groups
// CREATE exception: {
//   packageId, exceptionGroupId, exceptionType, severity (HIGH/MEDIUM/LOW),
//   lineRef, gcAmount, subAmount, variance, status: 'OPEN'
// }
// UPDATE processing_pipeline_steps VALIDATE → complete
// UPDATE packages package_status = 'EXCEPTION_REVIEW'
// Log: "{N} exceptions found across {M} groups. Total amount at risk: ${totalVariance}"
```

**Severity thresholds:**
- HIGH: variance > $10,000 or > 5% of line value
- MEDIUM: $1,000 < variance ≤ $10,000
- LOW: variance ≤ $1,000

**Expected result for the Boeing PDF** (approximate):
- The Sub Cost Recon page shows $41,572,643 total. The G703 "This Period" column sums to $45,715,866.
- Delta = ~$4.1M — some of this will be GC general requirements, some will be legitimate differences, and some may be genuine exceptions. The engine should flag all material variances for reviewer decision.

**Acceptance criteria:**
- CompletePage shows exception summary card with real exception counts and amounts
- ExceptionsPage loads with grouped exceptions matching the real variances
- Zero-exception path (if applicable) routes directly to HITLPage

---

### S4-06 — PDF Serving Route (EvidenceViewer Integration)

**Effort:** 2 hours

The EvidenceViewer component already renders PDFs via `react-pdf`. It expects a `pdfUrl` prop. Currently no backend route serves PDFs with auth.

**What to build:**

```javascript
// routes/packages.js — add:
// GET /api/packages/:packageId/pdf/:docId
router.get('/:packageId/pdf/:docId', requireAuth, requireTenancy, async (req, res) => {
  const doc = await prisma.documentUpload.findFirst({
    where: { id: parseInt(req.params.docId), packageId: parseInt(req.params.packageId) }
  });
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Stream from Azure Blob Storage
  const { BlobServiceClient } = require('@azure/storage-blob');
  const client = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const blobClient = client.getContainerClient('invoice-packages').getBlobClient(doc.blobName);
  const downloadResponse = await blobClient.download();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
  downloadResponse.readableStreamBody.pipe(res);
});
```

**EvidenceViewer integration:** The `pdfUrl` prop in File1Page, File2Page, ExceptionsPage should be set to `/api/packages/${packageId}/pdf/${doc.id}`. The `apiFetch` wrapper already sends `credentials: 'include'`. For `react-pdf`, pass the URL with the session cookie — use `{ url: pdfUrl, withCredentials: true }` as the `file` prop.

**Acceptance criteria:**
- PDF renders in the EvidenceViewer canvas (not an iframe)
- Auth is enforced — unauthenticated request to `/api/packages/:id/pdf/:docId` returns 401
- Page navigation works within the canvas

---

### S4-07 — Environment Variables for Extractors

**Effort:** 30 minutes

The extraction scripts require these additional env vars in `project-manager/backend/.env`:

```env
# Azure Document Intelligence (for sub-contractor OCR)
DOC_INTEL_ENDPOINT=https://your-doc-intelligence.cognitiveservices.azure.com/
DOC_INTEL_KEY=your_key_here

# Azure OpenAI (for sub-contractor structured extraction)
AOAI_ENDPOINT=https://your-aoai.openai.azure.com/v1/
AOAI_KEY=your_key_here
AOAI_DEPLOYMENT=gpt-4o

# Python executable path (if not in PATH)
PYTHON_PATH=python
```

The user must supply `DOC_INTEL_ENDPOINT`, `DOC_INTEL_KEY`, `AOAI_ENDPOINT`, `AOAI_KEY` values before sub-contractor extraction (Steps S4-04) can run. G703 extraction (S4-03) requires only pdfplumber — no cloud credentials needed.

---

## Non-Negotiable Constraints (Apply to Every Task)

These are inherited from the original implementation plan and must not be violated:

| Constraint | Rule |
|---|---|
| OCR flag | Always `--ocr azure` when invoking `extract_subcontractors.py`. Never `auto` or `none`. |
| Sub-contractor filter | `work_completed_this != 0` — permanent filter on File2Page. Not a toggle. |
| No TypeScript | React JSX only. No `.ts` or `.tsx` files. |
| No mock data | Every UI element must show real data from Azure SQL. |
| No dark mode | No `dark:` Tailwind modifiers. |
| No hardcoded hex | Use CSS custom property tokens only. |
| No hardcoded URLs | All API calls via `apiFetch('/...')` wrapper. |
| clientId on every query | All Prisma queries on operational tables must include `clientId` in where clause. |
| Soft deletes only | Never DELETE business records. Set `is_active = false`. |
| Session token never logged | Do not console.log session tokens, bearer tokens, or blob SAS tokens. |
| Separation of duties | `reviewed_by ≠ approved_by` — enforced at backend PATCH /packages/:id. Already implemented. |
| HITL Gate 1 | Cannot be bypassed by URL or API. File2Page redirects to PlanPage if AGENT_PLAN step ≠ confirmed. |
| HITL Gate 2 | Cannot be bypassed. HitlPage actions (approve/reject) are final. |

---

## Reading Order Before Writing Code

Before writing any code for Sprint 4, read these files in order:

1. `project-manager/backend/routes/packages.js` — understand existing package routes
2. `project-manager/backend/routes/pipelineV2.js` — understand the confirm handler you'll extend
3. `project-manager/backend/routes/exceptions.js` — understand exception storage
4. `project-manager/backend/extract_g703.py` — understand what the G703 extractor outputs
5. `project-manager/backend/extract_subcontractors.py` — understand what the sub extractor outputs
6. `project-manager/backend/prisma/schema.prisma` — understand the data model (36 tables)
7. `project-manager/backend/middleware/upload.js` — understand the multer setup
8. `project-manager/frontend/src/pages/PackageIntakePage.jsx` — the file to modify
9. `project-manager/frontend/src/pages/package/IngestPage.jsx` — verify confirm trigger
10. `project-manager/frontend/src/pages/package/File1Page.jsx` — verify EvidenceViewer integration

---

## Test Scenario — End-to-End Verification

After implementing Sprint 4, verify this complete flow works with the real Boeing PDF:

1. **Login** as `test@aic.com` / `Test1234!`
2. **New Package** → Select any contract → Billing Period: Feb 2026 → Upload the Boeing G702/G703 PDF as File 1 → Click "Create Package"
3. **IngestPage** — Activity Feed shows: "File 1 uploaded", "Ingestion started", "Running classification..." → INGEST step turns green → CLASSIFY step turns amber (paused)
4. Classification card appears: "File 1: N pages — GC Pay Application ✓"
5. Click **"Confirm & Continue"** → navigates to File1Page
6. **File1Page** — G702 cover fields show real values (Current Payment Due: $45,576,547, etc.) — G703 DataTable shows 234 rows — EvidenceViewer shows the PDF canvas
7. Inline edit a G703 cell → PATCH call succeeds → DataChangeLog created
8. Navigate to **PlanPage** — Agent Plan shows ~20 sub-contractors extracted from G703 descriptions
9. Confirm Plan → navigates to File2Page
10. **File2Page** — Activity Feed shows sub-contractor extraction progress → sub SOV table appears when extraction complete
11. Navigate to **CompletePage** → exception summary card appears with counts and total amount at risk
12. Navigate to **ExceptionsPage** → groups show (CROSS_FILE_MISMATCH, MATH_ERROR, etc.) → Accept and Override actions work
13. Click **"Submit for Approval"** → navigates to HITLPage
14. **HITLPage** shows financial summary with real G702 figures → Approve/Reject with comment

---

## Deliverables Checklist

- [ ] `POST /api/packages/:id/documents` — multipart upload to Azure Blob
- [ ] `GET /api/packages/:id/pdf/:docId` — authenticated PDF streaming
- [ ] `backend/lib/pipeline.js` — pipeline orchestrator
- [ ] `backend/lib/extractors/g703.js` — Node wrapper for `extract_g703.py`
- [ ] `backend/lib/extractors/subcontractors.js` — Node wrapper for `extract_subcontractors.py`
- [ ] `backend/lib/reconcile.js` — 4 reconciliation rules → exception generation
- [ ] Updated `pipelineV2.js` confirm handler — triggers next pipeline phase
- [ ] Updated `PackageIntakePage.jsx` — 2-step submit (create + upload)
- [ ] Updated `File1Page.jsx` — EvidenceViewer pdfUrl wired from document_uploads
- [ ] Updated `File2Page.jsx` — EvidenceViewer wired from document_uploads
- [ ] Updated `ExceptionsPage.jsx` — EvidenceViewer wired from exception source_page
- [ ] `.env` documentation for new env vars
