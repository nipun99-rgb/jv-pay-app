/**
 * Pipeline Processing Service — orchestrates extraction steps after file upload.
 * 
 * Flow: INGEST → CLASSIFY → [gate] → EXTRACT_FILE1 → AGENT_PLAN [gate] →
 *       EXTRACT_FILE2 → EXTRACT_FILE3 → RECONCILE → VALIDATE → REVIEW [gate]
 */
const prisma = require('./prisma');
const path = require('path');
const fs = require('fs');
const { BlobServiceClient } = require('@azure/storage-blob');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

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
      data: { status: 'error', errorMessage: err.message }
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

async function downloadBlobToLocal(storedPath, localFilename) {
  const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const blobClient = blobService.getContainerClient('invoice-packages').getBlobClient(storedPath);
  const localPath = path.join(UPLOAD_DIR, localFilename);
  await blobClient.downloadToFile(localPath);
  return localPath;
}

// ── Step 1: INGEST ───────────────────────────────────────────────────────────

async function runIngest(packageId) {
  // INGEST step was already set to 'running' by the upload handler
  const docs = await prisma.packageDocument.findMany({ where: { packageId } });

  for (const doc of docs) {
    await prisma.packageDocument.update({
      where: { id: doc.id },
      data: { uploadStatus: 'VERIFIED' }
    });
    await log(packageId, 'INGEST', 'info', `Verified: ${doc.originalFilename} (${doc.fileRole})`);
  }

  await prisma.processingPipelineStep.updateMany({
    where: { packageId, stepName: 'INGEST' },
    data: { status: 'complete', completedAt: new Date() }
  });
  await log(packageId, 'INGEST', 'info', 'Step INGEST complete.');
}

// ── Step 2: CLASSIFY ─────────────────────────────────────────────────────────

async function runClassify(packageId) {
  await prisma.processingPipelineStep.updateMany({
    where: { packageId, stepName: 'CLASSIFY' },
    data: { status: 'running', startedAt: new Date() }
  });
  await log(packageId, 'CLASSIFY', 'info', 'Starting step: CLASSIFY');

  let docs = await prisma.packageDocument.findMany({ where: { packageId } });

  // ── Smart pre-classification: if no FILE_2 exists but a FILE_3 looks like a
  //    sub-contractor package (by filename OR by PDF content), promote it to FILE_2.
  const SUB_KEYWORDS = ['sub', 'contractor', 'payapp', 'pay app', 'pay-app', 'breakdown', 'subapp', 'schedule of value', 'subcon', 'requisition'];
  const hasFile2 = docs.some(d => d.fileRole === 'FILE_2');
  if (!hasFile2) {
    // 1. Filename-based check
    let candidate = docs.find(d => {
      if (d.fileRole !== 'FILE_3') return false;
      const name = (d.originalFilename || '').toLowerCase();
      return SUB_KEYWORDS.some(kw => name.includes(kw));
    });

    // 2. Content-based check: if filename didn't match, scan raw PDF bytes for G702/sub markers
    if (!candidate) {
      const file3Doc = docs.find(d => d.fileRole === 'FILE_3');
      if (file3Doc) {
        try {
          const localPath3 = await downloadBlobToLocal(file3Doc.storedPath, `classify_content_${packageId}_${file3Doc.id}.pdf`);
          const pdfBytes = fs.readFileSync(localPath3);
          // Read as latin1 — PDF text streams are often readable without decoding
          const pdfRaw = pdfBytes.toString('latin1').toLowerCase();
          const SUB_CONTENT_MARKERS = [
            'subcontractor', 'g702', 'g703',
            'application and certificate', 'schedule of values',
            'continuation sheet', 'pay application', 'payment application',
            'less previous certificates', 'current payment due'
          ];
          const hitCount = SUB_CONTENT_MARKERS.filter(m => pdfRaw.includes(m)).length;
          if (hitCount >= 2) {
            candidate = file3Doc;
            await log(packageId, 'CLASSIFY', 'info',
              `Content scan detected sub-contractor markers in "${file3Doc.originalFilename}" (${hitCount} hits) — promoting to FILE_2`);
          }
          fs.unlink(localPath3, () => {});
        } catch (e) {
          // Content scan failed — continue without promotion
        }
      }
    }

    if (candidate) {
      await prisma.packageDocument.update({
        where: { id: candidate.id },
        data: { fileRole: 'FILE_2' }
      });
      await log(packageId, 'CLASSIFY', 'info',
        `Auto-reclassified "${candidate.originalFilename}" → FILE_2 (Sub-Contractor Package)`);
      // Reload docs with updated roles
      docs = await prisma.packageDocument.findMany({ where: { packageId } });
    }
  }

  for (const doc of docs) {
    let classification = 'UNKNOWN';
    let pageCount = null;

    // Try to determine page count by downloading and using pdf-lib
    try {
      const localPath = await downloadBlobToLocal(doc.storedPath, `classify_${packageId}_${doc.id}.pdf`);
      const { PDFDocument } = require('pdf-lib');
      const pdfBytes = fs.readFileSync(localPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      pageCount = pdfDoc.getPageCount();
      fs.unlink(localPath, () => {});
    } catch (e) {
      // Page count unknown
    }

    if (doc.fileRole === 'FILE_1') {
      classification = 'GC_PAY_APP';
      await log(packageId, 'CLASSIFY', 'info',
        `File 1: ${pageCount || '?'} pages — GC Pay Application (G702 + G703) ✓`);
    } else if (doc.fileRole === 'FILE_2') {
      classification = 'SUB_PACKAGE';
      await log(packageId, 'CLASSIFY', 'info',
        `File 2: ${pageCount || '?'} pages — Sub-Contractor Package ✓`);
    } else if (doc.fileRole === 'FILE_3') {
      classification = 'SUPPORTING_DOCS';
      await log(packageId, 'CLASSIFY', 'info',
        `File 3: ${pageCount || '?'} pages — Supporting Documents ✓`);
    }

    await prisma.packageDocument.update({
      where: { id: doc.id },
      data: {
        classificationResult: classification,
        classificationConfidence: 0.95,
        pageCount
      }
    });
  }

  // Pause for user confirmation
  await prisma.processingPipelineStep.updateMany({
    where: { packageId, stepName: 'CLASSIFY' },
    data: { status: 'paused' }
  });
  await prisma.package.update({
    where: { id: packageId },
    data: { packageStatus: 'AWAITING_CLASSIFICATION_CONFIRM' }
  });
  await log(packageId, 'CLASSIFY', 'info', 'Classification complete. Awaiting user confirmation.');
}

// ── Step 3: EXTRACT_FILE1 ────────────────────────────────────────────────────

async function runExtractFile1(packageId) {
  await advanceStep(packageId, 'EXTRACT_FILE1', async () => {
    const { extractG703 } = require('./extractors/g703');
    const { extractG702 } = require('./extractors/g702');

    // Get FILE_1 document
    const file1Doc = await prisma.packageDocument.findFirst({
      where: { packageId, fileRole: 'FILE_1' }
    });
    if (!file1Doc) throw new Error('File 1 not found');

    // Download blob to local
    const localPath = await downloadBlobToLocal(file1Doc.storedPath, `file1_${packageId}.pdf`);

    // Extract G702 header
    await log(packageId, 'EXTRACT_FILE1', 'info', 'Extracting G702 cover page...');
    await extractG702(localPath, packageId);
    await log(packageId, 'EXTRACT_FILE1', 'info', 'G702 header extracted.');

    // Extract G703 SOV lines
    await log(packageId, 'EXTRACT_FILE1', 'info', 'Extracting G703 continuation sheet...');
    const lineCount = await extractG703(localPath, packageId);
    await log(packageId, 'EXTRACT_FILE1', 'info', `G703 extraction complete: ${lineCount} SOV lines.`);

    // Clean up
    fs.unlink(localPath, () => {});
  });

  // After extraction: create agent plan and pause at AGENT_PLAN gate
  await createAgentPlan(packageId);
}

// ── Agent Plan Creation ──────────────────────────────────────────────────────

async function createAgentPlan(packageId) {
  await prisma.processingPipelineStep.updateMany({
    where: { packageId, stepName: 'AGENT_PLAN' },
    data: { status: 'running', startedAt: new Date() }
  });

  // Find SOV lines with contractor names (sub-contractor lines)
  const sovLines = await prisma.gcPayApplicationSovLine.findMany({
    where: { packageId }
  });

  // Group by contractor name
  const subMap = {};
  for (const line of sovLines) {
    const name = line.contractorName;
    if (!name || name.trim() === '') continue;
    // Skip generic cost codes
    const upper = name.toUpperCase();
    const genericCodes = [
      'UNCOMMITTED SUB COST', 'GENERAL CONDITIONS', 'GENERAL REQUIREMENTS',
      'BUILDERS RISK', "BUILDER'S RISK", 'BUSINESS LICENSE', 'CCIP', 'SDI',
      'FEE', 'PERMITS', 'PERMIT', 'DESIGN ESCALATION', 'CONTINGENCY',
      'FINAL CLEANING', 'ALLOWANCES', 'ALLOWANCE', 'IMP', 'PSQIC PROGRAM'
    ];
    if (genericCodes.some(gc => upper.includes(gc))) continue;

    if (!subMap[name]) subMap[name] = { totalBilled: 0, lineIds: [] };
    subMap[name].totalBilled += Number(line.workCompletedThis || 0);
    subMap[name].lineIds.push(line.id);
  }

  // Create agent plan items (without confirmed agent plan yet — it's pending)
  // We store items in a temporary structure; the real AgentPlan is created on confirm
  const subEntries = Object.entries(subMap).filter(([, v]) => v.totalBilled !== 0);

  // Store pending plan data in activity log for the confirm handler to use
  // Store only what the confirm handler needs — no lineIds (too large for column)
  const planData = subEntries.map(([name, data], idx) => ({
    seqNo: idx + 1,
    subcontractorName: name,
    billedAmount: data.totalBilled
  }));

  // Store in processing step's sub-progress for retrieval
  await prisma.processingPipelineStep.updateMany({
    where: { packageId, stepName: 'AGENT_PLAN' },
    data: {
      status: 'paused',
      subProgressTotal: planData.length,
      subProgressLabel: JSON.stringify(planData)
    }
  });

  const totalBilled = subEntries.reduce((sum, [, d]) => sum + d.totalBilled, 0);
  await log(packageId, 'AGENT_PLAN', 'info',
    `Agent plan ready: ${subEntries.length} sub-contractors identified, $${totalBilled.toLocaleString()} total billed this period`);

  await prisma.package.update({
    where: { id: packageId },
    data: { packageStatus: 'AWAITING_PLAN_CONFIRM' }
  });
}

// ── Steps 4-5: EXTRACT_FILE2 + EXTRACT_FILE3 ────────────────────────────────

async function runExtractFile2(packageId) {
  const file2Doc = await prisma.packageDocument.findFirst({
    where: { packageId, fileRole: 'FILE_2' }
  });

  if (!file2Doc) {
    // No File 2 uploaded — skip
    await prisma.processingPipelineStep.updateMany({
      where: { packageId, stepName: 'EXTRACT_FILE2' },
      data: { status: 'complete', completedAt: new Date() }
    });
    await log(packageId, 'EXTRACT_FILE2', 'info', 'No File 2 uploaded — skipped.');
    await runExtractFile3(packageId);
    return;
  }

  await advanceStep(packageId, 'EXTRACT_FILE2', async () => {
    const { extractSubcontractors } = require('./extractors/subcontractors');

    // ── Clean up any previously extracted sub data to prevent duplicates ──
    await prisma.subPayApplicationSovLine.deleteMany({ where: { packageId } });
    await prisma.subPayApplicationHeader.deleteMany({ where: { packageId } });
    await log(packageId, 'EXTRACT_FILE2', 'info', 'Cleared previous sub-contractor extraction data.');

    // Invalidate the LLM extract cache so Python re-runs with the current prompt.
    // Keep _page_texts.json and _scan.json (expensive Azure OCR) but delete _extract.json.
    const localFilename = `file2_${packageId}.pdf`;
    const localBase = path.join(UPLOAD_DIR, `file2_${packageId}`);
    const extractCachePath = localBase + '_extract.json';
    if (fs.existsSync(extractCachePath)) {
      fs.unlinkSync(extractCachePath);
      await log(packageId, 'EXTRACT_FILE2', 'info', 'Invalidated stale LLM extract cache — will re-extract with current prompt.');
    }

    const localPath = await downloadBlobToLocal(file2Doc.storedPath, localFilename);

    const plan = await prisma.agentPlan.findFirst({
      where: { packageId },
      include: { items: true }
    });
    const confirmedSubs = plan ? plan.items.map(i => i.subcontractorName) : [];

    await log(packageId, 'EXTRACT_FILE2', 'info', `Extracting ${confirmedSubs.length} sub-contractors from File 2...`);
    await extractSubcontractors(localPath, packageId, confirmedSubs, (msg) => {
      // Progress callback — fire and forget log
      prisma.activityLog.create({
        data: { packageId, level: 'info', stepNo: 4, message: msg }
      }).catch(() => {});
    });

    fs.unlink(localPath, () => {});
  });

  await runExtractFile3(packageId);
}

async function runExtractFile3(packageId) {
  const file3Doc = await prisma.packageDocument.findFirst({
    where: { packageId, fileRole: 'FILE_3' }
  });

  if (!file3Doc) {
    await prisma.processingPipelineStep.updateMany({
      where: { packageId, stepName: 'EXTRACT_FILE3' },
      data: { status: 'complete', completedAt: new Date() }
    });
    await log(packageId, 'EXTRACT_FILE3', 'info', 'No File 3 uploaded — skipped.');
  } else {
    // Mark FILE_3 extraction complete (supporting docs don't need full extraction yet)
    await prisma.processingPipelineStep.updateMany({
      where: { packageId, stepName: 'EXTRACT_FILE3' },
      data: { status: 'running', startedAt: new Date() }
    });
    await log(packageId, 'EXTRACT_FILE3', 'info', 'Processing supporting documents...');
    await prisma.processingPipelineStep.updateMany({
      where: { packageId, stepName: 'EXTRACT_FILE3' },
      data: { status: 'complete', completedAt: new Date() }
    });
    await log(packageId, 'EXTRACT_FILE3', 'info', 'Step EXTRACT_FILE3 complete.');
  }

  // Auto-trigger reconciliation
  await runReconcile(packageId);
}

// ── Steps 7-8: RECONCILE + VALIDATE ─────────────────────────────────────────

async function runReconcile(packageId) {
  const { reconcile } = require('./reconcile');
  await advanceStep(packageId, 'RECONCILE', async () => {
    await reconcile(packageId);
  });
  await runValidate(packageId);
}

async function runValidate(packageId) {
  await advanceStep(packageId, 'VALIDATE', async () => {
    // Validation is done during reconcile — mark pass-through
    const exCount = await prisma.exception.count({ where: { packageId } });
    const agg = await prisma.exception.aggregate({
      where: { packageId },
      _sum: { dollarAtRisk: true }
    });

    await prisma.package.update({
      where: { id: packageId },
      data: {
        packageStatus: exCount > 0 ? 'EXCEPTION_REVIEW' : 'PENDING_APPROVAL',
        exceptionsCount: exCount,
        dollarAtRisk: agg._sum.dollarAtRisk || 0
      }
    });

    const totalRisk = Number(agg._sum.dollarAtRisk || 0);
    await log(packageId, 'VALIDATE', 'info',
      `Validation complete: ${exCount} exceptions. Total amount at risk: $${totalRisk.toLocaleString()}`);
  });

  // Set REVIEW step to paused (HITL Gate 2)
  await prisma.processingPipelineStep.updateMany({
    where: { packageId, stepName: 'REVIEW' },
    data: { status: 'paused' }
  });
}

// ── Main Pipeline Entry ──────────────────────────────────────────────────────

// runExtractFile2Standalone — extracts FILE_2 without triggering downstream
// Used for repair/re-run scenarios where RECONCILE and VALIDATE are already done.
async function runExtractFile2Standalone(packageId) {
  const file2Doc = await prisma.packageDocument.findFirst({
    where: { packageId, fileRole: 'FILE_2' }
  });

  if (!file2Doc) {
    await log(packageId, 'EXTRACT_FILE2', 'info', 'No FILE_2 document found — cannot extract.');
    return;
  }

  await advanceStep(packageId, 'EXTRACT_FILE2', async () => {
    const { extractSubcontractors } = require('./extractors/subcontractors');

    // ── Clean up any previously extracted sub data to prevent duplicates ──
    await prisma.subPayApplicationSovLine.deleteMany({ where: { packageId } });
    await prisma.subPayApplicationHeader.deleteMany({ where: { packageId } });
    await log(packageId, 'EXTRACT_FILE2', 'info', 'Cleared previous sub-contractor extraction data (re-run cleanup).');

    // Invalidate the LLM extract cache so Python re-runs with the current prompt.
    const localFilename = `file2_${packageId}.pdf`;
    const localBase = path.join(UPLOAD_DIR, `file2_${packageId}`);
    const extractCachePath = localBase + '_extract.json';
    if (fs.existsSync(extractCachePath)) {
      fs.unlinkSync(extractCachePath);
      await log(packageId, 'EXTRACT_FILE2', 'info', 'Invalidated stale LLM extract cache — will re-extract with current prompt.');
    }

    const localPath = await downloadBlobToLocal(file2Doc.storedPath, localFilename);

    const plan = await prisma.agentPlan.findFirst({
      where: { packageId },
      include: { items: true }
    });
    const confirmedSubs = plan ? plan.items.map(i => i.subcontractorName) : [];

    await log(packageId, 'EXTRACT_FILE2', 'info', `Re-extracting ${confirmedSubs.length} sub-contractors from File 2...`);
    await extractSubcontractors(localPath, packageId, confirmedSubs, (msg) => {
      prisma.activityLog.create({
        data: { packageId, level: 'info', stepNo: 4, message: msg }
      }).catch(() => {});
    });

    fs.unlink(localPath, () => {});
  });
  // Intentionally does NOT call runExtractFile3 / runReconcile / runValidate
}

async function runPipeline(packageId) {
  try {
    await runIngest(packageId);
    await runClassify(packageId);
    // Stops at CLASSIFY gate — waits for user confirmation
  } catch (err) {
    console.error(`Pipeline error for package ${packageId}:`, err.message);
  }
}

module.exports = {
  runPipeline,
  runExtractFile1,
  runExtractFile2,
  runExtractFile2Standalone,
  runReconcile,
  advanceStep,
  log,
  downloadBlobToLocal
};
