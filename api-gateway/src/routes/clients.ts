import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';

export const clientsRouter = Router();

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const createClientSchema = z.object({
  name:         z.string().min(1).max(255),
  contactName:  z.string().max(255).optional(),
  contactEmail: z.string().email().max(255).optional(),
});

// ─── GET /api/clients ─────────────────────────────────────────────────────────
clientsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' },
      include: {
        contracts: {
          select: { id: true, name: true, contractValue: true, startDate: true, endDate: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    res.json(clients);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/clients ────────────────────────────────────────────────────────
clientsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);

    const client = await prisma.client.create({
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName ?? null,
        contactEmail: parsed.data.contactEmail ?? null,
      },
    });
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/clients/:id ─────────────────────────────────────────────────────
clientsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        contracts: {
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { packages: true } },
          },
        },
      },
    });
    if (!client) throw createError('Client not found', 404);
    res.json(client);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/clients/:id ───────────────────────────────────────────────────
const patchClientSchema = z.object({
  name:         z.string().min(1).max(255).optional(),
  contactName:  z.string().max(255).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
});

clientsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = patchClientSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);

    const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!existing) throw createError('Client not found', 404);

    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
