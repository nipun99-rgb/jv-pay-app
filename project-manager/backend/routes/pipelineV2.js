// routes/pipelineV2.js — Pipeline steps (Prisma + Azure SQL)
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireTenancy } = require('../middleware/tenancy');

const router = express.Router();

// GET /api/pipeline/:packageId/steps — 9 pipeline step rows
router.get('/:packageId/steps', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);

    // Verify package belongs to client
    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const steps = await prisma.processingPipelineStep.findMany({
      where: { packageId },
      orderBy: { stepNo: 'asc' }
    });
    res.json(steps);
  } catch (err) {
    console.error('GET /pipeline/:id/steps error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/pipeline/:packageId/run — trigger processing from a step
router.post('/:packageId/run', requireAuth, requireRole(['REVIEWER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const { fromStep } = req.body;

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    // Mark the starting step as running
    await prisma.processingPipelineStep.updateMany({
      where: { packageId, stepNo: parseInt(fromStep || 1) },
      data: { status: 'running', startedAt: new Date() }
    });

    await prisma.activityLog.create({
      data: {
        packageId,
        level: 'info',
        stepNo: parseInt(fromStep || 1),
        message: `Processing started at step ${fromStep || 1}`
      }
    });

    res.json({ accepted: true });
  } catch (err) {
    console.error('POST /pipeline/:id/run error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/pipeline/:packageId/confirm — confirm a step and trigger next
router.post('/:packageId/confirm', requireAuth, requireRole(['REVIEWER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const { stepName } = req.body;
    if (!stepName) return res.status(400).json({ error: 'stepName is required' });

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    // Confirm the step
    const updated = await prisma.processingPipelineStep.updateMany({
      where: { packageId, stepName },
      data: { status: 'confirmed', completedAt: new Date() }
    });
    if (updated.count === 0) return res.status(404).json({ error: 'Step not found' });

    // Find the confirmed step to get its stepNo
    const confirmedStep = await prisma.processingPipelineStep.findFirst({
      where: { packageId, stepName }
    });

    // Trigger next step
    let nextStep = null;
    if (confirmedStep && confirmedStep.stepNo < 9) {
      const next = await prisma.processingPipelineStep.findFirst({
        where: { packageId, stepNo: confirmedStep.stepNo + 1 }
      });
      if (next) {
        await prisma.processingPipelineStep.update({
          where: { id: next.id },
          data: { status: 'running', startedAt: new Date() }
        });
        nextStep = next.stepName;
      }
    }

    // Trigger pipeline phases based on confirmed step
    const { runExtractFile1, runExtractFile2 } = require('../lib/pipeline');

    if (stepName === 'CLASSIFY') {
      // After classification confirmed → run extraction
      setImmediate(() => runExtractFile1(packageId).catch(err =>
        console.error('ExtractFile1 error:', err.message)));
    } else if (stepName === 'AGENT_PLAN') {
      // After agent plan confirmed → create AgentPlan record, then run File2 extraction
      const planStep = await prisma.processingPipelineStep.findFirst({
        where: { packageId, stepName: 'AGENT_PLAN' }
      });
      const planData = planStep?.subProgressLabel ? JSON.parse(planStep.subProgressLabel) : [];
      const confirmedItems = req.body.confirmedItems || planData.map(p => p.subcontractorName);

      // Create the AgentPlan record
      const agentPlan = await prisma.agentPlan.create({
        data: {
          packageId,
          confirmedBy: req.user.id,
          confirmedAt: new Date(),
          agentIdentifiedCount: planData.length
        }
      });

      // Create AgentPlanItems
      for (let i = 0; i < planData.length; i++) {
        const item = planData[i];
        const isConfirmed = confirmedItems.some(ci =>
          ci.toUpperCase() === item.subcontractorName.toUpperCase()
        );
        if (isConfirmed) {
          await prisma.agentPlanItem.create({
            data: {
              agentPlanId: agentPlan.id,
              seqNo: i + 1,
              subcontractorName: item.subcontractorName,
              billedAmountFile1: item.billedAmount,
              source: 'AGENT'
            }
          });
        }
      }

      setImmediate(() => runExtractFile2(packageId).catch(err =>
        console.error('ExtractFile2 error:', err.message)));
    }

    // Audit event
    await prisma.auditEvent.create({
      data: {
        packageId,
        eventType: 'CONFIRMATION_GIVEN',
        triggeredBy: req.user.id,
        triggeredAt: new Date(),
        eventSummary: `Step ${stepName} confirmed`
      }
    });

    await prisma.activityLog.create({
      data: {
        packageId,
        level: 'info',
        stepNo: confirmedStep?.stepNo || 0,
        message: `Step ${stepName} confirmed by user`
      }
    });

    res.json({ confirmed: true, nextStep });
  } catch (err) {
    console.error('POST /pipeline/:id/confirm error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/pipeline/:packageId/fix-file2 — repair: reclassify docs and re-run EXTRACT_FILE2
// Used when a subcontractor PDF was uploaded into the FILE_3 slot instead of FILE_2.
router.post('/:packageId/fix-file2', requireAuth, requireRole(['REVIEWER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      include: { documents: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const SUB_KEYWORDS = ['sub', 'contractor', 'payapp', 'pay app', 'pay-app', 'breakdown', 'subapp', 'schedule of value'];
    const hasFile2 = pkg.documents.some(d => d.fileRole === 'FILE_2');
    let reclassified = null;

    if (!hasFile2) {
      const candidate = pkg.documents.find(d => {
        if (d.fileRole !== 'FILE_3') return false;
        const name = (d.originalFilename || '').toLowerCase();
        return SUB_KEYWORDS.some(kw => name.includes(kw));
      });
      if (candidate) {
        await prisma.packageDocument.update({
          where: { id: candidate.id },
          data: { fileRole: 'FILE_2', classificationResult: 'SUB_PACKAGE' }
        });
        await prisma.activityLog.create({
          data: { packageId, level: 'info', stepNo: 2, message: `Repair: reclassified "${candidate.originalFilename}" → FILE_2` }
        });
        reclassified = candidate.originalFilename;
      }
    }

    // Reset EXTRACT_FILE2 step and re-run
    await prisma.processingPipelineStep.updateMany({
      where: { packageId, stepName: 'EXTRACT_FILE2' },
      data: { status: 'pending', completedAt: null, errorMessage: null }
    });

    const { runExtractFile2Standalone } = require('../lib/pipeline');
    setImmediate(() => runExtractFile2Standalone(packageId).catch(err =>
      console.error('fix-file2 runExtractFile2Standalone error:', err.message)));

    res.json({ accepted: true, reclassified: reclassified || 'none (FILE_2 already existed)', packageId });
  } catch (err) {
    console.error('POST /pipeline/:id/fix-file2 error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
