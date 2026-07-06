import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';

export const contractsRouter = Router();

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const createContractSchema = z.object({
  clientId:       z.string().uuid(),
  name:           z.string().min(1).max(255),
  projectAddress: z.string().max(2000).optional(),
  contractValue:  z.number().positive().optional(),
  startDate:      z.string().datetime({ offset: true }).optional(),
  endDate:        z.string().datetime({ offset: true }).optional(),
});

// ─── GET /api/contracts ───────────────────────────────────────────────────────
contractsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const contracts = await prisma.contract.findMany({
      orderBy: { name: 'asc' },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { packages: true } },
      },
    });
    res.json(contracts);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/contracts ──────────────────────────────────────────────────────
contractsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createContractSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);

    const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
    if (!client) throw createError('Client not found', 404);

    const contract = await prisma.contract.create({
      data: {
        clientId:       parsed.data.clientId,
        name:           parsed.data.name,
        projectAddress: parsed.data.projectAddress ?? null,
        contractValue:  parsed.data.contractValue ?? null,
        startDate:      parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate:        parsed.data.endDate   ? new Date(parsed.data.endDate)   : null,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    res.status(201).json(contract);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/contracts/:id ───────────────────────────────────────────────────
contractsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        packages: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, projectName: true, status: true, createdAt: true,
            exceptions: { where: { status: 'OPEN' }, select: { id: true, severity: true } },
          },
        },
      },
    });
    if (!contract) throw createError('Contract not found', 404);
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/contracts/:id ─────────────────────────────────────────────────
const patchContractSchema = z.object({
  name:           z.string().min(1).max(255).optional(),
  projectAddress: z.string().max(2000).nullable().optional(),
  contractValue:  z.number().positive().nullable().optional(),
  startDate:      z.string().datetime({ offset: true }).nullable().optional(),
  endDate:        z.string().datetime({ offset: true }).nullable().optional(),
});

contractsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = patchContractSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);

    const existing = await prisma.contract.findUnique({ where: { id: req.params.id } });
    if (!existing) throw createError('Contract not found', 404);

    const { startDate, endDate, ...rest } = parsed.data;
    const updated = await prisma.contract.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate   !== undefined && { endDate:   endDate   ? new Date(endDate)   : null }),
      },
      include: { client: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
