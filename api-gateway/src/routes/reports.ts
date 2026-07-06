import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';

export const reportsRouter = Router();

// ─── GET /api/reports/period-comparison?contractId=... ────────────────────────
// Returns all packages in a contract ordered by creation date, with their
// GC header financials — used by ReportsPage line chart.
reportsRouter.get('/period-comparison', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contractId } = req.query as { contractId?: string };

    const whereClause = contractId ? { contractId } : {};

    const packages = await prisma.package.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        projectName: true,
        status: true,
        createdAt: true,
        contract: { select: { id: true, name: true, client: { select: { name: true } } } },
        gcHeader: {
          select: {
            applicationNo: true,
            period: true,
            originalContractSum: true,
            contractSumToDate: true,
            totalCompletedStored: true,
            currentPaymentDue: true,
            balanceToFinish: true,
            totalRetainage: true,
            extractionConfidence: true,
          },
        },
      },
    });

    // Only include packages that have a GC header extracted
    const withData = packages.filter((p) => p.gcHeader !== null);

    const result = withData.map((p, i) => ({
      index: i + 1,
      packageId: p.id,
      projectName: p.projectName,
      status: p.status,
      createdAt: p.createdAt,
      contract: p.contract,
      applicationNo: p.gcHeader?.applicationNo ?? String(i + 1),
      period: p.gcHeader?.period ?? null,
      originalContractSum: p.gcHeader?.originalContractSum !== null
        ? Number(p.gcHeader?.originalContractSum)
        : null,
      contractSumToDate: p.gcHeader?.contractSumToDate !== null
        ? Number(p.gcHeader?.contractSumToDate)
        : null,
      totalCompletedStored: p.gcHeader?.totalCompletedStored !== null
        ? Number(p.gcHeader?.totalCompletedStored)
        : null,
      currentPaymentDue: p.gcHeader?.currentPaymentDue !== null
        ? Number(p.gcHeader?.currentPaymentDue)
        : null,
      balanceToFinish: p.gcHeader?.balanceToFinish !== null
        ? Number(p.gcHeader?.balanceToFinish)
        : null,
      totalRetainage: p.gcHeader?.totalRetainage !== null
        ? Number(p.gcHeader?.totalRetainage)
        : null,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports/summary ─────────────────────────────────────────────────
// Portfolio-level summary: total packages, total value, exceptions, by status.
reportsRouter.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [pkgCount, statusGroups, exceptionCount, headers] = await Promise.all([
      prisma.package.count(),
      prisma.package.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.reconException.count({ where: { status: 'OPEN' } }),
      prisma.gcPayApplicationHeader.findMany({
        select: { currentPaymentDue: true, contractSumToDate: true },
      }),
    ]);

    const totalPaymentDue = headers.reduce((s, h) => s + (h.currentPaymentDue ? Number(h.currentPaymentDue) : 0), 0);
    const totalContractSum = headers.reduce((s, h) => s + (h.contractSumToDate ? Number(h.contractSumToDate) : 0), 0);

    res.json({
      totalPackages: pkgCount,
      totalPaymentDue,
      totalContractSum,
      openExceptions: exceptionCount,
      byStatus: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
    });
  } catch (err) {
    next(err);
  }
});
