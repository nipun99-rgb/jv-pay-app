// routes/activity.js — Activity logs (Prisma + Azure SQL)
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireTenancy } = require('../middleware/tenancy');

const router = express.Router();

// GET /api/activity/:packageId — activity logs with since polling
router.get('/:packageId', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const { since } = req.query;

    // Verify package belongs to client
    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const where = { packageId };
    if (since) {
      where.createdAt = { gt: new Date(since) };
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    });
    res.json(logs);
  } catch (err) {
    console.error('GET /activity/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/activity/:packageId — append a log message
router.post('/:packageId', requireAuth, requireTenancy, async (req, res) => {
  try {
    const packageId = parseInt(req.params.packageId);
    const { level, stepNo, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const pkg = await prisma.package.findFirst({
      where: { id: packageId, ...(req.clientId ? { clientId: req.clientId } : {}) },
      select: { id: true }
    });
    if (!pkg) return res.status(404).json({ error: 'Package not found' });

    const log = await prisma.activityLog.create({
      data: {
        packageId,
        level: level || 'info',
        stepNo: stepNo ? parseInt(stepNo) : null,
        message
      }
    });
    res.status(201).json(log);
  } catch (err) {
    console.error('POST /activity/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
