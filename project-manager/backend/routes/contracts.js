// routes/contracts.js — Contract CRUD (Prisma + Azure SQL)
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireTenancy } = require('../middleware/tenancy');

const router = express.Router();

// GET /api/contracts — list contracts for current client
router.get('/', requireAuth, requireTenancy, async (req, res) => {
  try {
    const where = { isActive: true };
    if (req.clientId) where.clientId = req.clientId;

    const contracts = await prisma.contract.findMany({
      where,
      include: { _count: { select: { packages: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(contracts);
  } catch (err) {
    console.error('GET /contracts error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contracts/:contractId
router.get('/:contractId', requireAuth, requireTenancy, async (req, res) => {
  try {
    const id = parseInt(req.params.contractId);
    const where = { id };
    if (req.clientId) where.clientId = req.clientId;

    const contract = await prisma.contract.findFirst({
      where,
      include: {
        config: true,
        packages: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    console.error('GET /contracts/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contracts — create new contract
router.post('/', requireAuth, requireRole(['ADMIN']), requireTenancy, async (req, res) => {
  try {
    const { contractNo, contractName, contractorName, ownerName, originalContractSum, currency, contractStartDate, contractEndDate } = req.body;
    if (!contractName) return res.status(400).json({ error: 'contractName is required' });

    const clientId = req.clientId || req.user.clientId;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const contract = await prisma.contract.create({
      data: {
        clientId,
        contractNo: contractNo || null,
        contractName,
        contractorName: contractorName || null,
        ownerName: ownerName || null,
        originalContractSum: originalContractSum ? parseFloat(originalContractSum) : null,
        currency: currency || 'USD',
        contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
        contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
        createdBy: req.user.id
      }
    });

    // Create default contract config
    await prisma.contractConfig.create({
      data: {
        contractId: contract.id,
        configuredBy: req.user.id
      }
    });

    res.status(201).json(contract);
  } catch (err) {
    console.error('POST /contracts error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contracts/:contractId/packages — recent packages for a contract
router.get('/:contractId/packages', requireAuth, requireTenancy, async (req, res) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const limit = parseInt(req.query.limit) || 10;
    const where = { contractId };
    if (req.clientId) where.contract = { clientId: req.clientId };

    const packages = await prisma.package.findMany({
      where,
      select: { id: true, billingPeriodLabel: true, packageStatus: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json(packages);
  } catch (err) {
    console.error('GET /contracts/:id/packages error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
