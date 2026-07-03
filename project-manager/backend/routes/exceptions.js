// routes/exceptions.js — Validation & Exception management (Prisma + Azure SQL)
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireTenancy } = require('../middleware/tenancy');

const router = express.Router();

// POST /api/exceptions/validate/:packageId — run validation
router.post('/validate/:packageId', requireAuth, requireRole(['REVIEWER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    // Count existing runs for run_number
    const runCount = await prisma.validationRun.count({ where: { packageId } });

    // Create validation run
    const validationRun = await prisma.validationRun.create({
      data: {
        packageId,
        runNumber: runCount + 1,
        triggeredBy: req.user.id,
        runStatus: 'RUNNING',
        runStartedAt: new Date()
      }
    });

    // Mark as complete (actual validation logic to be integrated later)
    await prisma.validationRun.update({
      where: { id: validationRun.id },
      data: {
        runStatus: 'COMPLETE',
        runCompletedAt: new Date(),
        totalItems: 0,
        autoClearedCount: 0,
        exceptionsCount: 0,
        dollarAtRisk: 0
      }
    });

    res.json({
      validationRunId: validationRun.id,
      runNumber: runCount + 1,
      exceptionCount: 0,
      totalAmountAtRisk: 0
    });
  } catch (err) {
    console.error('POST /exceptions/validate/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/exceptions/package/:packageId — list exceptions
router.get('/package/:packageId', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const { groupId, status } = req.query;

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const where = { packageId };
    if (groupId) where.exceptionGroupId = parseInt(groupId);
    if (status && status !== 'all') where.status = status;

    const exceptions = await prisma.exception.findMany({
      where,
      include: {
        exceptionGroup: { select: { displayLabel: true, severity: true } },
        resolutions: { include: { resolver: { select: { displayName: true } } } }
      },
      orderBy: [{ riskRank: 'asc' }, { dollarAtRisk: 'desc' }]
    });

    // Enrich with subContractorName for sub_pay_application_header entity types
    const subIds = [...new Set(
      exceptions
        .filter(ex => ex.entityType === 'sub_pay_application_header' && ex.entityId)
        .map(ex => ex.entityId)
    )];
    let subMap = {};
    if (subIds.length > 0) {
      const subs = await prisma.subPayApplicationHeader.findMany({
        where: { id: { in: subIds } },
        select: { id: true, subContractorName: true }
      });
      subs.forEach(s => { subMap[s.id] = s.subContractorName; });
    }

    const enriched = exceptions.map(ex => ({
      ...ex,
      subContractorName: ex.subContractorName || (ex.entityType === 'sub_pay_application_header' ? subMap[ex.entityId] : null) || null
    }));

    res.json(enriched);
  } catch (err) {
    console.error('GET /exceptions/package/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/exceptions/groups/:packageId — exception groups summary
router.get('/groups/:packageId', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const groups = await prisma.exceptionGroup.findMany({
      where: { packageId },
      include: { _count: { select: { exceptions: true } } },
      orderBy: { dollarAtRisk: 'desc' }
    });
    res.json(groups);
  } catch (err) {
    console.error('GET /exceptions/groups/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/exceptions/:packageId/groups — alias for frontend
router.get('/:packageId/groups', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    if (isNaN(packageId)) return res.status(400).json({ error: 'Invalid packageId' });

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const groups = await prisma.exceptionGroup.findMany({
      where: { packageId },
      include: { _count: { select: { exceptions: true } } },
      orderBy: { dollarAtRisk: 'desc' }
    });

    // Enrich with resolved counts
    const enriched = await Promise.all(groups.map(async (g) => {
      const resolvedCount = await prisma.exception.count({
        where: { exceptionGroupId: g.id, status: 'resolved' }
      });
      return {
        ...g,
        totalCount: g._count.exceptions,
        resolvedCount,
        totalAmountAtRisk: g.dollarAtRisk,
        displayName: g.displayLabel || g.exceptionType
      };
    }));
    res.json(enriched);
  } catch (err) {
    console.error('GET /exceptions/:id/groups error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/exceptions/:packageId — list exceptions (with ?summary=true or ?groupId=X)
router.get('/:packageId', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    if (isNaN(packageId)) return res.status(400).json({ error: 'Invalid packageId' });

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    // Summary mode
    if (req.query.summary === 'true') {
      const totalCount = await prisma.exception.count({ where: { packageId } });
      const resolvedCount = await prisma.exception.count({ where: { packageId, status: 'resolved' } });
      const overrideCount = await prisma.exceptionResolution.count({
        where: { exception: { packageId }, resolutionType: 'OVERRIDDEN' }
      });
      const agg = await prisma.exception.aggregate({
        where: { packageId },
        _sum: { dollarAtRisk: true }
      });
      // By category
      const byCategory = {};
      const groups = await prisma.exceptionGroup.findMany({
        where: { packageId },
        include: { _count: { select: { exceptions: true } } }
      });
      groups.forEach(g => { byCategory[g.exceptionType || g.displayLabel] = g._count.exceptions; });

      return res.json({
        totalCount,
        resolvedCount,
        overrideCount,
        totalAmountAtRisk: agg._sum.dollarAtRisk || 0,
        byCategory
      });
    }

    // List mode
    const where = { packageId };
    if (req.query.groupId) where.exceptionGroupId = parseInt(req.query.groupId);
    if (req.query.status && req.query.status !== 'all') where.status = req.query.status;

    const exceptions = await prisma.exception.findMany({
      where,
      include: {
        exceptionGroup: { select: { displayLabel: true, severity: true, exceptionTypeCode: true } },
        resolutions: { take: 1, orderBy: { resolvedAt: 'desc' } }
      },
      orderBy: [{ riskRank: 'asc' }, { dollarAtRisk: 'desc' }]
    });

    const mapped = exceptions.map(e => ({
      id: e.id,
      exceptionType: e.exceptionGroup?.exceptionTypeCode || e.exceptionTypeCode,
      description: e.description || e.exceptionGroup?.displayLabel,
      severity: e.severity || e.exceptionGroup?.severity || 'MEDIUM',
      amountAtRisk: e.dollarAtRisk,
      status: e.status === 'resolved' ? 'RESOLVED' : 'OPEN',
      resolution: e.resolutions?.[0]?.resolutionType || null,
      sourcePage: e.sourcePage,
    }));
    res.json(mapped);
  } catch (err) {
    console.error('GET /exceptions/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/exceptions/:exceptionId/resolve — resolve an exception
router.post('/:exceptionId/resolve', requireAuth, requireRole(['REVIEWER', 'APPROVER', 'ADMIN']), requireTenancy, async (req, res) => {
  try {
    const exceptionId = parseInt(req.params.exceptionId);
    const { decision, comment, overrideValue } = req.body;

    if (!decision || !['ACCEPTED', 'OVERRIDDEN', 'ESCALATED'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be ACCEPTED, OVERRIDDEN, or ESCALATED' });
    }

    const exception = await prisma.exception.findUnique({
      where: { id: exceptionId },
      include: { package: { select: { id: true, clientId: true } } }
    });
    if (!exception) return res.status(404).json({ error: 'Exception not found' });
    if (req.clientId && exception.package.clientId !== req.clientId) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    // Create resolution
    await prisma.exceptionResolution.create({
      data: {
        exceptionId,
        resolvedBy: req.user.id,
        resolvedAt: new Date(),
        resolutionType: decision,
        overrideValue: overrideValue ? parseFloat(overrideValue) : null,
        comment: comment || null
      }
    });

    // Update exception status
    const newStatus = decision === 'ESCALATED' ? 'escalated' : 'resolved';
    await prisma.exception.update({
      where: { id: exceptionId },
      data: { status: newStatus }
    });

    // Review action log
    await prisma.reviewActionLog.create({
      data: {
        packageId: exception.packageId,
        userId: req.user.id,
        actionType: decision,
        entityType: 'exception',
        entityId: exceptionId,
        comment: comment || null,
        ipAddress: req.ip
      }
    });

    // If override: create data change log
    if (decision === 'OVERRIDDEN' && overrideValue != null) {
      await prisma.dataChangeLog.create({
        data: {
          packageId: exception.packageId,
          entityType: 'exception',
          entityId: exceptionId,
          fieldName: 'value',
          originalValue: exception.file1Value?.toString() || null,
          newValue: overrideValue.toString(),
          changedBy: req.user.id,
          changedAt: new Date(),
          reason: comment || 'Manual override'
        }
      });

      // Audit event for financial override
      await prisma.auditEvent.create({
        data: {
          packageId: exception.packageId,
          eventType: 'FINANCIAL_OVERRIDE',
          triggeredBy: req.user.id,
          triggeredAt: new Date(),
          eventSummary: `Exception #${exceptionId} overridden: ${exception.file1Value} → ${overrideValue}`
        }
      });
    }

    res.json({ resolved: true });
  } catch (err) {
    console.error('POST /exceptions/:id/resolve error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
