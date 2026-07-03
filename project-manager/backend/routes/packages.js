// routes/packages.js — Package CRUD + intake (Prisma + Azure SQL)
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireTenancy } = require('../middleware/tenancy');
const { upload, UPLOAD_DIR } = require('../middleware/upload');
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// The 9 standard pipeline steps
const PIPELINE_STEPS = [
  { stepNo: 1, stepName: 'INGEST' },
  { stepNo: 2, stepName: 'CLASSIFY' },
  { stepNo: 3, stepName: 'EXTRACT_FILE1' },
  { stepNo: 4, stepName: 'EXTRACT_FILE2' },
  { stepNo: 5, stepName: 'EXTRACT_FILE3' },
  { stepNo: 6, stepName: 'AGENT_PLAN' },
  { stepNo: 7, stepName: 'RECONCILE' },
  { stepNo: 8, stepName: 'VALIDATE' },
  { stepNo: 9, stepName: 'REVIEW' }
];

// GET /api/packages — list packages for current client
router.get('/', requireAuth, requireTenancy, async (req, res) => {
  try {
    const where = {};
    if (req.clientId) where.clientId = req.clientId;
    if (req.query.contractId) where.contractId = parseInt(req.query.contractId);
    if (req.query.month) where.billingPeriodMonth = parseInt(req.query.month);
    if (req.query.year) where.billingPeriodYear = parseInt(req.query.year);

    const packages = await prisma.package.findMany({
      where,
      include: {
        contract: { select: { contractName: true, contractNo: true } },
        pipelineSteps: { select: { stepNo: true, stepName: true, status: true }, orderBy: { stepNo: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(packages);
  } catch (err) {
    console.error('GET /packages error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/packages/:packageId
router.get('/:packageId', requireAuth, requireTenancy, async (req, res) => {
  try {
    const id = parseInt(req.params.packageId);
    const where = { id };
    if (req.clientId) where.clientId = req.clientId;

    const pkg = await prisma.package.findFirst({
      where,
      include: {
        contract: true,
        pipelineSteps: { orderBy: { stepNo: 'asc' } },
        documents: true
      }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    res.json(pkg);
  } catch (err) {
    console.error('GET /packages/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/packages — create new package
router.post('/', requireAuth, requireRole(['REVIEWER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const { contractId, billingPeriodMonth, billingPeriodYear } = req.body;
    if (!contractId || !billingPeriodMonth || !billingPeriodYear) {
      return res.status(400).json({ error: 'contractId, billingPeriodMonth, and billingPeriodYear are required' });
    }

    // Verify contract belongs to client
    const contract = await prisma.contract.findFirst({
      where: { id: parseInt(contractId), ...(req.clientId ? { clientId: req.clientId } : {}) }
    });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    // Duplicate check
    const existing = await prisma.package.findFirst({
      where: { contractId: parseInt(contractId), billingPeriodMonth: parseInt(billingPeriodMonth), billingPeriodYear: parseInt(billingPeriodYear) }
    });
    if (existing) return res.status(409).json({ error: 'Package already exists for this billing period' });

    // Create package
    const pkg = await prisma.package.create({
      data: {
        clientId: contract.clientId,
        contractId: parseInt(contractId),
        billingPeriodMonth: parseInt(billingPeriodMonth),
        billingPeriodYear: parseInt(billingPeriodYear),
        billingPeriodLabel: `${billingPeriodYear}-${String(billingPeriodMonth).padStart(2, '0')}`,
        packageStatus: 'DRAFT',
        createdBy: req.user.id
      }
    });

    // Create 9 pipeline steps
    await prisma.processingPipelineStep.createMany({
      data: PIPELINE_STEPS.map(s => ({
        packageId: pkg.id,
        stepNo: s.stepNo,
        stepName: s.stepName,
        status: 'pending'
      }))
    });

    // Audit event
    await prisma.auditEvent.create({
      data: {
        packageId: pkg.id,
        eventType: 'PACKAGE_CREATED',
        triggeredBy: req.user.id,
        triggeredAt: new Date(),
        eventSummary: `Package created for ${contract.contractName} - ${pkg.billingPeriodLabel}`
      }
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        packageId: pkg.id,
        level: 'info',
        stepNo: 0,
        message: 'Package created. Awaiting file uploads.'
      }
    });

    res.status(201).json({ packageId: pkg.id, status: pkg.packageStatus });
  } catch (err) {
    console.error('POST /packages error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/packages/:packageId/submit — Reviewer submits package for approval
router.post('/:packageId/submit', requireAuth, requireRole(['REVIEWER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const id = parseInt(req.params.packageId);
    const pkg = await prisma.package.findFirst({
      where: { id, ...(req.clientId ? { clientId: req.clientId } : {}) }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    if (!['EXCEPTION_REVIEW', 'INGESTING', 'FILE_1_PROCESSING', 'FILE_2_PROCESSING', 'DRAFT'].includes(pkg.packageStatus)) {
      // Allow submit from any review-ish state
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

// PATCH /api/packages/:packageId — approve/reject
router.patch('/:packageId', requireAuth, requireRole(['APPROVER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const id = parseInt(req.params.packageId);
    const { packageStatus, rejectionReason } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(packageStatus)) {
      return res.status(400).json({ error: 'packageStatus must be APPROVED or REJECTED' });
    }

    const pkg = await prisma.package.findFirst({
      where: { id, ...(req.clientId ? { clientId: req.clientId } : {}) }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    // Separation of duties
    if (pkg.reviewedBy === req.user.id) {
      return res.status(403).json({ error: 'Separation of duties: reviewer cannot approve their own review' });
    }

    const updateData = {
      packageStatus,
      approvedBy: req.user.id,
      approvedAt: new Date()
    };
    if (packageStatus === 'REJECTED') {
      updateData.rejectionReason = rejectionReason || null;
    }

    await prisma.package.update({ where: { id }, data: updateData });

    await prisma.auditEvent.create({
      data: {
        packageId: id,
        eventType: packageStatus,
        triggeredBy: req.user.id,
        triggeredAt: new Date(),
        eventSummary: `Package ${packageStatus.toLowerCase()} by ${req.user.displayName}`
      }
    });

    res.json({ success: true, packageStatus });
  } catch (err) {
    console.error('PATCH /packages/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/packages/:packageId/gc-header — G702 cover page data
router.get('/:packageId/gc-header', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const header = await prisma.gcPayApplicationHeader.findFirst({
      where: { packageId }
    });
    res.json(header || {});
  } catch (err) {
    console.error('GET /packages/:id/gc-header error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/packages/:packageId/gc-sov-lines — G703 SOV lines
router.get('/:packageId/gc-sov-lines', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const lines = await prisma.gcPayApplicationSovLine.findMany({
      where: { packageId },
      orderBy: { itemNo: 'asc' }
    });
    res.json(lines);
  } catch (err) {
    console.error('GET /packages/:id/gc-sov-lines error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/packages/:packageId/gc-sov-lines/:lineId — inline edit a SOV line
router.patch('/:packageId/gc-sov-lines/:lineId', requireAuth, requireRole(['REVIEWER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const lineId = parseInt(req.params.lineId);
    const packageId = parseInt(req.params.packageId);
    const allowed = ['scheduledValue', 'previousCompleted', 'workCompletedThis', 'materialsStored', 'retainage'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    // Get old values for audit
    const existing = await prisma.gcPayApplicationSovLine.findUnique({ where: { id: lineId } });
    if (!existing || existing.packageId !== packageId) return res.status(404).json({ error: 'Line not found' });

    await prisma.gcPayApplicationSovLine.update({ where: { id: lineId }, data: updates });

    // Audit log
    await prisma.dataChangeLog.create({
      data: {
        packageId,
        entityType: 'gc_pay_application_sov_lines',
        entityId: lineId,
        fieldName: Object.keys(updates).join(','),
        originalValue: JSON.stringify(Object.fromEntries(Object.keys(updates).map(k => [k, existing[k]]))),
        newValue: JSON.stringify(updates),
        changedBy: req.user.id,
        changedAt: new Date(),
        reason: req.body.reason || 'Manual inline edit'
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /packages/:id/gc-sov-lines/:lineId error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/packages/:packageId/sub-headers — sub-contractor pay application headers
router.get('/:packageId/sub-headers', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const headers = await prisma.subPayApplicationHeader.findMany({
      where: { packageId },
      orderBy: { id: 'asc' }
    });
    res.json(headers);
  } catch (err) {
    console.error('GET /packages/:id/sub-headers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/packages/:packageId/sub-sov-lines — sub-contractor SOV lines (optionally filtered by headerId)
router.get('/:packageId/sub-sov-lines', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const where = { packageId };
    if (req.query.headerId) where.subAppId = parseInt(req.query.headerId);
    const lines = await prisma.subPayApplicationSovLine.findMany({
      where,
      orderBy: [{ subAppId: 'asc' }, { id: 'asc' }]
    });
    res.json(lines);
  } catch (err) {
    console.error('GET /packages/:id/sub-sov-lines error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/packages/:packageId/agent-plan — agent plan + items
router.get('/:packageId/agent-plan', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const plan = await prisma.agentPlan.findFirst({
      where: { packageId },
      include: { items: { orderBy: { seqNo: 'asc' } } }
    });

    if (plan) {
      return res.json({ ...plan, status: 'confirmed' });
    }

    // Check if there's a pending plan in the pipeline step
    const planStep = await prisma.processingPipelineStep.findFirst({
      where: { packageId, stepName: 'AGENT_PLAN' }
    });

    if (planStep && planStep.subProgressLabel) {
      try {
        const pendingItems = JSON.parse(planStep.subProgressLabel);
        return res.json({
          items: pendingItems.map((item, idx) => ({
            id: idx + 1,
            seqNo: item.seqNo,
            subcontractorName: item.subcontractorName,
            billedAmountFile1: item.billedAmount,
            source: 'AGENT'
          })),
          status: planStep.status === 'paused' ? 'pending' : planStep.status
        });
      } catch (e) { /* invalid JSON, fall through */ }
    }

    res.json({ items: [], status: 'pending' });
  } catch (err) {
    console.error('GET /packages/:id/agent-plan error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/packages/:packageId/documents — upload 1-3 PDF files to Azure Blob
router.post('/:packageId/documents', requireAuth, requireRole(['REVIEWER', 'ADMIN']), requireTenancy,
  upload.fields([{ name: 'file1', maxCount: 1 }, { name: 'file2', maxCount: 1 }, { name: 'file3', maxCount: 1 }]),
  async (req, res) => {
    try {
      const packageId = parseInt(req.params.packageId);
      const pkg = await prisma.package.findFirst({
        where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) }
      });
      if (!pkg) return res.status(404).json({ error: 'Package not found' });

      const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
      const container = blobService.getContainerClient('invoice-packages');
      await container.createIfNotExists();

      const fileFields = ['file1', 'file2', 'file3'];
      const fileRoles = ['FILE_1', 'FILE_2', 'FILE_3'];
      const documents = [];

      for (let i = 0; i < fileFields.length; i++) {
        const files = req.files[fileFields[i]];
        if (!files || files.length === 0) continue;

        const file = files[0];
        const blobName = `${pkg.clientId}/${packageId}/${i + 1}-${file.originalname}`;
        const blockBlob = container.getBlockBlobClient(blobName);

        // Upload to Azure Blob
        await blockBlob.uploadFile(file.path, {
          blobHTTPHeaders: { blobContentType: 'application/pdf' }
        });

        // Create document record
        const doc = await prisma.packageDocument.create({
          data: {
            packageId,
            fileRole: fileRoles[i],
            originalFilename: file.originalname,
            storedPath: blobName,
            fileSizeBytes: file.size,
            mimeType: 'application/pdf',
            uploadStatus: 'UPLOADED',
            uploadedAt: new Date(),
            uploadedBy: req.user.id
          }
        });
        documents.push(doc);

        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        await prisma.activityLog.create({
          data: { packageId, level: 'info', stepNo: 1, message: `File ${i + 1} uploaded: ${file.originalname} (${sizeMB} MB)` }
        });

        // Clean up local temp file
        fs.unlink(file.path, () => {});
      }

      if (documents.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      // Advance INGEST step to running
      await prisma.processingPipelineStep.updateMany({
        where: { packageId, stepName: 'INGEST' },
        data: { status: 'running', startedAt: new Date() }
      });

      // Update package status
      await prisma.package.update({
        where: { id: packageId },
        data: { packageStatus: 'INGESTING' }
      });

      await prisma.activityLog.create({
        data: { packageId, level: 'info', stepNo: 1, message: `Ingestion started. Processing ${documents.length} file(s).` }
      });

      // Trigger pipeline async
      const { runPipeline } = require('../lib/pipeline');
      setImmediate(() => runPipeline(packageId).catch(err => console.error('Pipeline error:', err.message)));

      res.json({ uploaded: documents.length, documents });
    } catch (err) {
      console.error('POST /packages/:id/documents error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/packages/:packageId/pdf/:docId — stream PDF from Azure Blob (authenticated)
router.get('/:packageId/pdf/:docId', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const docId = parseInt(req.params.docId);

    const doc = await prisma.packageDocument.findFirst({
      where: { id: docId, packageId }
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const blobClient = blobService.getContainerClient('invoice-packages').getBlobClient(doc.storedPath);
    const downloadResponse = await blobClient.download();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalFilename}"`);
    downloadResponse.readableStreamBody.pipe(res);
  } catch (err) {
    console.error('GET /packages/:id/pdf/:docId error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
