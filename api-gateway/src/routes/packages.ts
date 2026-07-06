import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';
import { io } from '../index';

export const packagesRouter = Router();

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const createPackageSchema = z.object({
  projectName:       z.string().min(1).max(255),
  createdBy:         z.string().min(1).max(255),
  contractId:        z.string().uuid().optional(),
  applicationPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(), // e.g. "2026-07"
});

// ─── GET /api/packages ────────────────────────────────────────────────────────
packagesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const packages = await prisma.package.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        documents: { select: { id: true, filename: true, fileType: true } },
        contract: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
      },
    });
    res.json(packages);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages ───────────────────────────────────────────────────────
packagesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    }

    const pkg = await prisma.package.create({
      data: {
        projectName:       parsed.data.projectName,
        createdBy:         parsed.data.createdBy,
        status:            'PENDING',
        ...(parsed.data.contractId        && { contractId: parsed.data.contractId }),
        ...(parsed.data.applicationPeriod && { applicationPeriod: parsed.data.applicationPeriod }),
      },
    });

    res.status(201).json(pkg);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id ────────────────────────────────────────────────────
packagesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id },
      include: {
        documents: true,
        gcHeader: true,
        exceptions: { where: { status: 'OPEN' }, select: { id: true, type: true, severity: true } },
      },
    });
    if (!pkg) throw createError('Package not found', 404);
    res.json(pkg);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/run ───────────────────────────────────────────────
packagesRouter.post('/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id },
      include: { documents: { select: { blobUrl: true, filename: true } } },
    });
    if (!pkg) throw createError('Package not found', 404);

    await prisma.package.update({
      where: { id: req.params.id },
      data: { status: 'INGESTING' },
    });

    // Call AI engine with document blob URLs so ingest_node can download them
    const aiUrl = process.env.AI_ENGINE_URL ?? 'http://localhost:8000';
    const documentUrls = pkg.documents.map((d) => d.blobUrl).filter(Boolean) as string[];
    const documents = pkg.documents.map((d) => ({ blobUrl: d.blobUrl, filename: d.filename }));
    fetch(`${aiUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_id: req.params.id, document_urls: documentUrls, documents }),
    }).catch((err: Error) => console.error('[run] AI engine call failed:', err.message));

    io.to(`package:${req.params.id}`).emit('status_update', { status: 'INGESTING' });
    res.status(202).json({ accepted: true, packageId: req.params.id });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/run-complete (AI engine callback) ─────────────────
packagesRouter.post('/:id/run-complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, current_node, total_cost_usd, total_tokens, error_message } = req.body as {
      status?: string; current_node?: string; total_cost_usd?: number;
      total_tokens?: number; error_message?: string;
    };

    await prisma.package.update({
      where: { id: req.params.id },
      data: {
        status: status ?? 'FAILED',
        ...(total_cost_usd !== undefined && { totalCostUsd: total_cost_usd }),
        ...(total_tokens !== undefined && { totalTokens: total_tokens }),
      },
    });

    io.to(`package:${req.params.id}`).emit('status_update', {
      status, current_node, total_cost_usd, total_tokens, error_message,
    });
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/resume ───────────────────────────────────────────
packagesRouter.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pkg = await prisma.package.findUnique({ where: { id: req.params.id } });
    if (!pkg) throw createError('Package not found', 404);

    const aiUrl = process.env.AI_ENGINE_URL ?? 'http://localhost:8000';
    fetch(`${aiUrl}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_id: req.params.id, resume_data: req.body }),
    }).catch((err: Error) => console.error('[resume] AI engine call failed:', err.message));

    res.status(202).json({ accepted: true });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/ai-status ─────────────────────────────────────────
packagesRouter.get('/:id/ai-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const aiUrl = process.env.AI_ENGINE_URL ?? 'http://localhost:8000';
    const upstream = await fetch(`${aiUrl}/status/${req.params.id}`);
    const data = await upstream.json() as unknown;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/approve ──────────────────────────────────────────
packagesRouter.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pkg = await prisma.package.findUnique({ where: { id: req.params.id } });
    if (!pkg) throw createError('Package not found', 404);

    const openExceptions = await prisma.reconException.count({
      where: { packageId: req.params.id, status: 'OPEN' },
    });
    if (openExceptions > 0) {
      throw createError(`Cannot approve: ${openExceptions} unresolved exception(s)`, 422);
    }

    const updated = await prisma.package.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED' },
    });

    io.to(`package:${req.params.id}`).emit('status_update', { status: 'APPROVED' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/review (HITL gate — approve or reject) ────────────
const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().max(2000).optional(),
});

packagesRouter.post('/:id/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    const { action, reason } = parsed.data;

    const pkg = await prisma.package.findUnique({ where: { id: req.params.id } });
    if (!pkg) throw createError('Package not found', 404);

    if (action === 'APPROVE') {
      const openCount = await prisma.reconException.count({
        where: { packageId: req.params.id, status: 'OPEN' },
      });
      if (openCount > 0) {
        throw createError(`Cannot approve: ${openCount} unresolved exception(s)`, 422);
      }
    }

    // Resume the LangGraph graph from human_review_gate interrupt
    const aiUrl = process.env.AI_ENGINE_URL ?? 'http://localhost:8000';
    fetch(`${aiUrl}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package_id: req.params.id,
        resume_data: { action, reason: reason ?? '' },
      }),
    }).catch((err: Error) => console.error('[review] AI engine resume failed:', err.message));

    // Optimistically update package status
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'FAILED';
    await prisma.package.update({
      where: { id: req.params.id },
      data: { status: newStatus },
    });

    io.to(`package:${req.params.id}`).emit('status_update', { status: newStatus, action, reason });
    res.status(202).json({ accepted: true, action, newStatus });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/exceptions ────────────────────────────────────────
packagesRouter.get('/:id/exceptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exceptions = await prisma.reconException.findMany({
      where: { packageId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(exceptions);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/exceptions (AI engine callback — bulk create) ────
packagesRouter.post('/:id/exceptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = req.body as Array<Record<string, unknown>>;
    if (!Array.isArray(items)) throw createError('Expected array of exceptions', 400);

    // Idempotent: clear old OPEN exceptions before re-inserting
    await prisma.reconException.deleteMany({
      where: { packageId: req.params.id, status: 'OPEN' },
    });

    if (items.length === 0) { res.status(201).json({ created: 0 }); return; }

    await prisma.reconException.createMany({
      data: items.map((e) => ({
        packageId: req.params.id,
        type: (e.type as string | undefined)?.slice(0, 100) ?? 'UNKNOWN',
        severity: (e.severity as string | undefined)?.slice(0, 20) ?? 'MEDIUM',
        subName: (e.subName as string | undefined) ?? null,
        delta: (e.delta as number | undefined) ?? null,
        evidence: (e.evidence as string | undefined) ?? null,
        status: 'OPEN',
      })),
    });

    io.to(`package:${req.params.id}`).emit('status_update', { current_node: 'reconcile' });
    res.status(201).json({ created: items.length });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/packages/:id/exceptions/:exId (resolve/dismiss) ──────────────
const exceptionPatchSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolution: z.string().max(2000).optional(),
});

packagesRouter.patch('/:id/exceptions/:exId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = exceptionPatchSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);

    const existing = await prisma.reconException.findUnique({ where: { id: req.params.exId } });
    if (!existing || existing.packageId !== req.params.id) throw createError('Exception not found', 404);

    const updated = await prisma.reconException.update({
      where: { id: req.params.exId },
      data: { status: parsed.data.status, resolution: parsed.data.resolution ?? null },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/changelog ─────────────────────────────────────────
packagesRouter.get('/:id/changelog', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.dataChangeLog.findMany({
      where: { packageId: req.params.id },
      orderBy: { changedAt: 'desc' },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/activity ──────────────────────────────────────────
packagesRouter.get('/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.activityLog.findMany({
      where: { packageId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/activity (internal — called by ai-engine) ────────
packagesRouter.post('/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, eventType, node } = req.body as {
      message?: string; eventType?: string; node?: string;
    };
    if (!message) throw createError('message required', 400);

    const entry = await prisma.activityLog.create({
      data: {
        packageId: req.params.id,
        message,
        eventType: eventType ?? 'info',
        node: node ?? null,
      },
    });

    // Emit to Socket.io room so live IngestPage updates without polling
    io.to(`package:${req.params.id}`).emit('activity', entry);

    // Also emit as agent_message for the AI Agent panel (sub-agent communication)
    if (node) {
      io.to(`package:${req.params.id}`).emit('agent_message', {
        node,
        message,
        eventType: eventType ?? 'info',
        ts: new Date().toISOString(),
      });
    }

    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/gc-header (AI engine callback — upsert) ──────────
const gcHeaderSchema = z.object({
  to_owner:               z.string().optional().nullable(),
  from_contractor:        z.string().optional().nullable(),
  project_name:           z.string().optional().nullable(),
  application_no:         z.string().optional().nullable(),
  period:                 z.string().optional().nullable(),
  period_from:            z.string().optional().nullable(),
  period_to:              z.string().optional().nullable(),
  original_contract_sum:  z.number().optional().nullable(),
  net_change_orders:      z.number().optional().nullable(),
  contract_sum_to_date:   z.number().optional().nullable(),
  total_completed_stored: z.number().optional().nullable(),
  retainage_completed:    z.number().optional().nullable(),
  retainage_materials:    z.number().optional().nullable(),
  total_retainage:        z.number().optional().nullable(),
  total_earned_less_ret:  z.number().optional().nullable(),
  less_prev_certificates: z.number().optional().nullable(),
  current_payment_due:    z.number().optional().nullable(),
  balance_to_finish:      z.number().optional().nullable(),
  change_order_summary:   z.string().optional().nullable(),
  extraction_confidence:  z.number().optional().nullable(),
  source_page:            z.number().int().optional().nullable(),
}).passthrough();

packagesRouter.post('/:id/gc-header', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = gcHeaderSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    const d = parsed.data;

    const header = await prisma.gcPayApplicationHeader.upsert({
      where: { packageId: req.params.id },
      create: {
        packageId: req.params.id,
        toOwner: d.to_owner ?? null,
        fromContractor: d.from_contractor ?? null,
        projectName: d.project_name ?? null,
        applicationNo: d.application_no ?? null,
        period: d.period ?? null,
        periodFrom: d.period_from ?? null,
        periodTo: d.period_to ?? null,
        originalContractSum: d.original_contract_sum ?? null,
        netChangeOrders: d.net_change_orders ?? null,
        contractSumToDate: d.contract_sum_to_date ?? null,
        totalCompletedStored: d.total_completed_stored ?? null,
        retainageCompleted: d.retainage_completed ?? null,
        retainageMaterials: d.retainage_materials ?? null,
        totalRetainage: d.total_retainage ?? null,
        totalEarnedLessRet: d.total_earned_less_ret ?? null,
        lessPrevCertificates: d.less_prev_certificates ?? null,
        currentPaymentDue: d.current_payment_due ?? null,
        balanceToFinish: d.balance_to_finish ?? null,
        changeOrderSummary: d.change_order_summary ?? null,
        extractionConfidence: d.extraction_confidence ?? null,
        sourcePage: d.source_page ?? null,
      },
      update: {
        toOwner: d.to_owner ?? null,
        fromContractor: d.from_contractor ?? null,
        projectName: d.project_name ?? null,
        applicationNo: d.application_no ?? null,
        period: d.period ?? null,
        periodFrom: d.period_from ?? null,
        periodTo: d.period_to ?? null,
        originalContractSum: d.original_contract_sum ?? null,
        netChangeOrders: d.net_change_orders ?? null,
        contractSumToDate: d.contract_sum_to_date ?? null,
        totalCompletedStored: d.total_completed_stored ?? null,
        retainageCompleted: d.retainage_completed ?? null,
        retainageMaterials: d.retainage_materials ?? null,
        totalRetainage: d.total_retainage ?? null,
        totalEarnedLessRet: d.total_earned_less_ret ?? null,
        lessPrevCertificates: d.less_prev_certificates ?? null,
        currentPaymentDue: d.current_payment_due ?? null,
        balanceToFinish: d.balance_to_finish ?? null,
        changeOrderSummary: d.change_order_summary ?? null,
        extractionConfidence: d.extraction_confidence ?? null,
        sourcePage: d.source_page ?? null,
      },
    });

    io.to(`package:${req.params.id}`).emit('status_update', { current_node: 'extract_gc_header' });
    res.status(201).json(header);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/gc-header ─────────────────────────────────────────
packagesRouter.get('/:id/gc-header', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = await prisma.gcPayApplicationHeader.findUnique({
      where: { packageId: req.params.id },
    });
    res.json(header ?? null);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/packages/:id/gc-header (frontend inline edits) ───────────────
const gcHeaderPatchSchema = z.object({
  field: z.string().min(1),
  value: z.union([z.string(), z.number(), z.null()]),
  changedBy: z.string().default('user'),
});

packagesRouter.patch('/:id/gc-header', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = gcHeaderPatchSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    const { field, value, changedBy } = parsed.data;

    // Ensure header exists
    const existing = await prisma.gcPayApplicationHeader.findUnique({ where: { packageId: req.params.id } });
    if (!existing) throw createError('GC header not found', 404);

    const fieldMap: Record<string, string> = {
      to_owner: 'toOwner', from_contractor: 'fromContractor', project_name: 'projectName',
      application_no: 'applicationNo', period: 'period', period_from: 'periodFrom',
      period_to: 'periodTo', original_contract_sum: 'originalContractSum',
      net_change_orders: 'netChangeOrders', contract_sum_to_date: 'contractSumToDate',
      total_completed_stored: 'totalCompletedStored', retainage_completed: 'retainageCompleted',
      retainage_materials: 'retainageMaterials', total_retainage: 'totalRetainage',
      total_earned_less_ret: 'totalEarnedLessRet', less_prev_certificates: 'lessPrevCertificates',
      current_payment_due: 'currentPaymentDue', balance_to_finish: 'balanceToFinish',
      change_order_summary: 'changeOrderSummary',
    };

    const prismaField = fieldMap[field] ?? field;
    const updated = await prisma.gcPayApplicationHeader.update({
      where: { packageId: req.params.id },
      data: { [prismaField]: value, validationStatus: 'HUMAN_EDITED' },
    });

    // Audit trail
    await prisma.dataChangeLog.create({
      data: {
        packageId: req.params.id,
        tableName: 'gc_pay_application_headers',
        recordId: existing.id,
        fieldName: field,
        oldValue: String((existing as Record<string, unknown>)[prismaField] ?? ''),
        newValue: String(value ?? ''),
        changedBy,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/gc-sov (AI engine callback — bulk insert) ────────
packagesRouter.post('/:id/gc-sov', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lines = req.body as Array<Record<string, unknown>>;
    if (!Array.isArray(lines)) throw createError('Expected array of SOV lines', 400);

    // Delete existing lines first (idempotent re-run)
    await prisma.gcPayApplicationSovLine.deleteMany({ where: { packageId: req.params.id } });

    const created = await prisma.gcPayApplicationSovLine.createMany({
      data: lines.map((l) => ({
        packageId: req.params.id,
        itemNo: (l.item_no as string | undefined) ?? null,
        timePeriod: (l.time_period as string | undefined) ?? null,
        phases: (l.phases as string | undefined) ?? null,
        typeOfWork: (l.type_of_work as string | undefined) ?? null,
        contractorName: (l.contractor_name as string | undefined) ?? null,
        scheduledOriginal: (l.scheduled_original as number | undefined) ?? null,
        scheduledChangeOrders: (l.scheduled_change_orders as number | undefined) ?? null,
        scheduledCurrent: (l.scheduled_current as number | undefined) ?? null,
        workCompletedPrev: (l.work_completed_prev as number | undefined) ?? null,
        workCompletedThis: (l.work_completed_this as number | undefined) ?? null,
        materialsStored: (l.materials_stored as number | undefined) ?? null,
        totalCompleted: (l.total_completed as number | undefined) ?? null,
        pct: (l.pct as number | undefined) ?? null,
        balanceToFinish: (l.balance_to_finish as number | undefined) ?? null,
        retainage: (l.retainage as number | undefined) ?? null,
        extractionConfidence: (l.extraction_confidence as number | undefined) ?? null,
        sourcePage: (l.source_page as number | undefined) ?? null,
      })),
    });

    io.to(`package:${req.params.id}`).emit('status_update', { current_node: 'extract_gc_sov' });
    res.status(201).json({ created: created.count });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/gc-sov ────────────────────────────────────────────
packagesRouter.get('/:id/gc-sov', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lines = await prisma.gcPayApplicationSovLine.findMany({
      where: { packageId: req.params.id },
      orderBy: { itemNo: 'asc' },
    });
    res.json(lines);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/packages/:id/gc-sov/:lineId (frontend inline edits) ──────────
const sovLinePatchSchema = z.object({
  field: z.string().min(1),
  value: z.union([z.string(), z.number(), z.null()]),
  changedBy: z.string().default('user'),
});

packagesRouter.patch('/:id/gc-sov/:lineId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = sovLinePatchSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    const { field, value, changedBy } = parsed.data;

    const existing = await prisma.gcPayApplicationSovLine.findUnique({ where: { id: req.params.lineId } });
    if (!existing || existing.packageId !== req.params.id) throw createError('SOV line not found', 404);

    const fieldMap: Record<string, string> = {
      item_no: 'itemNo', time_period: 'timePeriod', phases: 'phases', type_of_work: 'typeOfWork',
      contractor_name: 'contractorName', scheduled_original: 'scheduledOriginal',
      scheduled_change_orders: 'scheduledChangeOrders', scheduled_current: 'scheduledCurrent',
      work_completed_prev: 'workCompletedPrev', work_completed_this: 'workCompletedThis',
      materials_stored: 'materialsStored', total_completed: 'totalCompleted',
      pct: 'pct', balance_to_finish: 'balanceToFinish', retainage: 'retainage',
    };

    const prismaField = fieldMap[field] ?? field;
    const updated = await prisma.gcPayApplicationSovLine.update({
      where: { id: req.params.lineId },
      data: { [prismaField]: value, validationStatus: 'HUMAN_EDITED' },
    });

    await prisma.dataChangeLog.create({
      data: {
        packageId: req.params.id,
        tableName: 'gc_pay_application_sov_lines',
        recordId: existing.id,
        fieldName: field,
        oldValue: String((existing as Record<string, unknown>)[prismaField] ?? ''),
        newValue: String(value ?? ''),
        changedBy,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-CONTRACTOR ROUTES (Sprint 6)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/packages/:id/sub-headers (AI engine callback — bulk create) ────
packagesRouter.post('/:id/sub-headers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subs = req.body as Array<Record<string, unknown>>;
    if (!Array.isArray(subs)) throw createError('Expected array of sub-header objects', 400);

    // Idempotent: delete old sub headers (+ cascade SOV lines)
    const existing = await prisma.subPayApplicationHeader.findMany({
      where: { packageId: req.params.id },
      select: { id: true },
    });
    if (existing.length) {
      await prisma.subPayApplicationSovLine.deleteMany({
        where: { subAppId: { in: existing.map((e) => e.id) } },
      });
      await prisma.subPayApplicationHeader.deleteMany({ where: { packageId: req.params.id } });
    }

    const created: string[] = [];
    let seqCounter = 0;
    for (const sub of subs) {
      const header = await prisma.subPayApplicationHeader.create({
        data: {
          packageId: req.params.id,
          seqId: typeof sub.seq_id === 'number' ? sub.seq_id : seqCounter,
          subcontractorName: (sub.subcontractor_name as string | undefined) ?? null,
          applicationNo: (sub.application_no as string | undefined)?.slice(0, 50) ?? null,
          applicationDate: (sub.application_date as string | undefined)?.slice(0, 50) ?? null,
          periodFrom: (sub.period_from as string | undefined)?.slice(0, 50) ?? null,
          periodTo: (sub.period_to as string | undefined)?.slice(0, 50) ?? null,
          invoiceTo: (sub.invoice_to as string | undefined) ?? null,
          projectName: (sub.project_name as string | undefined) ?? null,
          contractPoNumber: (sub.contract_po_number as string | undefined)?.slice(0, 100) ?? null,
          originalContractSum: (sub.original_contract_sum as number | undefined) ?? null,
          netChangeOrders: (sub.net_change_orders as number | undefined) ?? null,
          contractSumToDate: (sub.contract_sum_to_date as number | undefined) ?? null,
          totalCompletedStored: (sub.total_completed_stored as number | undefined) ?? null,
          currentPaymentDue: (sub.current_payment_due as number | undefined) ?? null,
          totalRetainage: (sub.total_retainage as number | undefined) ?? null,
          retainagePercent: (sub.retainage_percent as number | undefined) ?? null,
          totalEarnedLessRet: (sub.total_earned_less_ret as number | undefined) ?? null,
          lessPreviousCerts: (sub.less_previous_certs as number | undefined) ?? null,
          balanceToFinish: (sub.balance_to_finish as number | undefined) ?? null,
          startPage: (sub.start_page as number | undefined) ?? null,
          endPage: (sub.end_page as number | undefined) ?? null,
          extractionConfidence: (sub.extraction_confidence as number | undefined) ?? null,
        },
      });

      const sovLines = sub.sov_lines as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(sovLines) && sovLines.length > 0) {
        // Batch insertions: SQL Server has a ~2100 parameter limit; 13 columns × 50 rows = 650 params (safe)
        const BATCH = 50;
        const mapped = sovLines.map((l) => ({
          subAppId: header.id,
          itemNo: (l.item_no as string | undefined)?.slice(0, 50) ?? null,
          description: (l.description as string | undefined) ?? null,
          scheduledValue: (l.scheduled_value as number | undefined) ?? null,
          workCompletedPrev: (l.work_completed_prev as number | undefined) ?? null,
          workCompletedThis: (l.work_completed_this as number | undefined) ?? null,
          materialsStored: (l.materials_stored as number | undefined) ?? null,
          totalCompleted: (l.total_completed as number | undefined) ?? null,
          pctComplete: (l.pct_complete as number | undefined) ?? null,
          retainage: (l.retainage as number | undefined) ?? null,
          balanceToFinish: (l.balance_to_finish as number | undefined) ?? null,
          contractorSignaturePresent: (l.contractor_signature_present as boolean | undefined) ?? null,
          notaryDetailsPresent: (l.notary_details_present as boolean | undefined) ?? null,
          extractionConfidence: (l.extraction_confidence as number | undefined) ?? null,
          sourcePage: (l.source_page as number | undefined) ?? null,
        }));
        for (let i = 0; i < mapped.length; i += BATCH) {
          await prisma.subPayApplicationSovLine.createMany({ data: mapped.slice(i, i + BATCH) });
        }
      }

      created.push(header.id);
      seqCounter++;
    }

    io.to(`package:${req.params.id}`).emit('status_update', { current_node: 'extract_subs' });
    res.status(201).json({ created: created.length, ids: created });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/sub-headers (with nested SOV lines) ───────────────
packagesRouter.get('/:id/sub-headers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const headers = await prisma.subPayApplicationHeader.findMany({
      where: { packageId: req.params.id },
      include: { sovLines: { orderBy: { sourcePage: 'asc' } } },
      orderBy: { seqId: 'asc' },
    });
    res.json(headers);
  } catch (e) { next(e); }
});

// ─── GET /api/packages/:id/sub-headers/:subId ─────────────────────────────────
packagesRouter.get('/:id/sub-headers/:subId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = await prisma.subPayApplicationHeader.findUnique({
      where: { id: req.params.subId },
      include: { sovLines: { orderBy: { itemNo: 'asc' } } },
    });
    if (!header || header.packageId !== req.params.id) throw createError('Sub header not found', 404);
    res.json(header);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/packages/:id/sub-headers/:subId (frontend inline edit) ────────
const subHeaderPatchSchema = z.object({
  field: z.string().min(1),
  value: z.union([z.string(), z.number(), z.null()]),
  changedBy: z.string().default('user'),
});

packagesRouter.patch('/:id/sub-headers/:subId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = subHeaderPatchSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    const { field, value, changedBy } = parsed.data;

    const existing = await prisma.subPayApplicationHeader.findUnique({ where: { id: req.params.subId } });
    if (!existing || existing.packageId !== req.params.id) throw createError('Sub header not found', 404);

    const fieldMap: Record<string, string> = {
      subcontractor_name: 'subcontractorName', application_no: 'applicationNo',
      application_date: 'applicationDate', period_from: 'periodFrom', period_to: 'periodTo',
      original_contract_sum: 'originalContractSum', contract_sum_to_date: 'contractSumToDate',
      total_completed_stored: 'totalCompletedStored', current_payment_due: 'currentPaymentDue',
      total_retainage: 'totalRetainage', retainage_percent: 'retainagePercent',
      balance_to_finish: 'balanceToFinish',
    };
    const prismaField = fieldMap[field] ?? field;
    const updated = await prisma.subPayApplicationHeader.update({
      where: { id: req.params.subId },
      data: { [prismaField]: value, validationStatus: 'HUMAN_EDITED' },
    });

    await prisma.dataChangeLog.create({
      data: {
        packageId: req.params.id, tableName: 'sub_pay_application_headers',
        recordId: existing.id, fieldName: field,
        oldValue: String((existing as Record<string, unknown>)[prismaField] ?? ''),
        newValue: String(value ?? ''), changedBy,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/packages/:id/sub-sov/:lineId (frontend inline edit) ───────────
const subSovPatchSchema = z.object({
  field: z.string().min(1),
  value: z.union([z.string(), z.number(), z.null()]),
  changedBy: z.string().default('user'),
});

packagesRouter.patch('/:id/sub-sov/:lineId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = subSovPatchSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    const { field, value, changedBy } = parsed.data;

    const existing = await prisma.subPayApplicationSovLine.findUnique({ where: { id: req.params.lineId } });
    if (!existing) throw createError('Sub SOV line not found', 404);

    const subHeader = await prisma.subPayApplicationHeader.findUnique({ where: { id: existing.subAppId } });
    if (!subHeader || subHeader.packageId !== req.params.id) throw createError('Sub SOV line not found', 404);

    const fieldMap: Record<string, string> = {
      item_no: 'itemNo', description: 'description', scheduled_value: 'scheduledValue',
      work_completed_prev: 'workCompletedPrev', work_completed_this: 'workCompletedThis',
      materials_stored: 'materialsStored', total_completed: 'totalCompleted',
      pct_complete: 'pctComplete', balance_to_finish: 'balanceToFinish', retainage: 'retainage',
    };
    const prismaField = fieldMap[field] ?? field;
    const updated = await prisma.subPayApplicationSovLine.update({
      where: { id: req.params.lineId },
      data: { [prismaField]: value, validationStatus: 'HUMAN_EDITED' },
    });

    await prisma.dataChangeLog.create({
      data: {
        packageId: req.params.id, tableName: 'sub_pay_application_sov_lines',
        recordId: existing.id, fieldName: field,
        oldValue: String((existing as Record<string, unknown>)[prismaField] ?? ''),
        newValue: String(value ?? ''), changedBy,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/packages/:id ─────────────────────────────────────────────────
// Hard-deletes a package and ALL associated data (SQL + Blob Storage).
packagesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id },
      include: { documents: { select: { id: true, blobName: true } } },
    });
    if (!pkg) throw createError('Package not found', 404);

    // ── 1. Delete blobs from Azure Storage ──────────────────────────────────
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (connStr && pkg.documents.length > 0) {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const svc = BlobServiceClient.fromConnectionString(connStr);
      const CONTAINER = process.env.AZURE_STORAGE_CONTAINER_NAME ?? 'jvpay-docs';
      const containerClient = svc.getContainerClient(CONTAINER);
      await Promise.allSettled(
        pkg.documents.map((d) => containerClient.getBlockBlobClient(d.blobName).deleteIfExists())
      );
    }

    // ── 2. Delete SQL rows (leaf → parent order to satisfy FK constraints) ──
    // Sub SOV lines first (child of SubPayApplicationHeader)
    const subHeaders = await prisma.subPayApplicationHeader.findMany({
      where: { packageId: req.params.id },
      select: { id: true },
    });
    if (subHeaders.length > 0) {
      const subIds = subHeaders.map((h) => h.id);
      await prisma.subPayApplicationSovLine.deleteMany({ where: { subAppId: { in: subIds } } });
    }
    await prisma.subPayApplicationHeader.deleteMany({ where: { packageId: req.params.id } });
    await prisma.gcPayApplicationSovLine.deleteMany({ where: { packageId: req.params.id } });
    await prisma.gcPayApplicationHeader.deleteMany({ where: { packageId: req.params.id } });
    await prisma.reconException.deleteMany({ where: { packageId: req.params.id } });
    await prisma.dataChangeLog.deleteMany({ where: { packageId: req.params.id } });
    await prisma.activityLog.deleteMany({ where: { packageId: req.params.id } });
    await prisma.document.deleteMany({ where: { packageId: req.params.id } });
    await prisma.package.delete({ where: { id: req.params.id } });

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/packages/:id/reextract-sov (re-run G703 extraction on specific pages) ──
const reExtractSovSchema = z.object({
  pages: z.array(z.number().int().min(2).max(20)).min(1).max(19),
});

packagesRouter.post('/:id/reextract-sov', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pkg = await prisma.package.findUnique({ where: { id: req.params.id } });
    if (!pkg) throw createError('Package not found', 404);

    const parsed = reExtractSovSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    const { pages } = parsed.data;
    const startPage = Math.min(...pages);
    const endPage = Math.max(...pages);

    const aiUrl = process.env.AI_ENGINE_URL ?? 'http://localhost:8000';
    fetch(`${aiUrl}/reextract-sov`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_id: req.params.id, start_page: startPage, end_page: endPage, pages }),
    }).catch((err: Error) => console.error('[reextract-sov] AI engine call failed:', err.message));

    await prisma.activityLog.create({
      data: {
        packageId: req.params.id,
        message: `[User → AI]: Re-extraction requested for G703 pages ${pages.join(', ')}`,
        node: 'reextract_sov',
        eventType: 'info',
      },
    });

    res.status(202).json({ accepted: true, pages });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/pdf?docIndex=0 OR ?fileType=GC_PAY_APP ────────────
packagesRouter.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
    if (!pkg) throw createError('Package not found', 404);

    let doc: typeof pkg.documents[0] | undefined;

    // Prefer fileType lookup (reliable) over numeric index (fragile ordering)
    const fileType = req.query.fileType as string | undefined;
    if (fileType) {
      doc = pkg.documents.find(d => d.fileType === fileType);
    } else {
      const docIndex = Math.max(0, parseInt((req.query.docIndex as string) ?? '0', 10) || 0);
      doc = pkg.documents[docIndex];
    }

    if (!doc) throw createError(`Document not found (fileType=${fileType ?? 'n/a'})`, 404);

    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw createError('Storage not configured', 500);

    const { BlobServiceClient } = await import('@azure/storage-blob');
    const svc = BlobServiceClient.fromConnectionString(connStr);
    // blobName is the storage path (no container prefix); blobUrl is the full URL
    const { blobName } = doc;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME ?? 'jvpay-docs';
    const blobClient = svc.getContainerClient(containerName).getBlobClient(blobName);

    const downloadResponse = await blobClient.download();
    if (!downloadResponse.readableStreamBody) throw createError('Blob stream unavailable', 500);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (downloadResponse.contentLength != null) {
      res.setHeader('Content-Length', String(downloadResponse.contentLength));
    }

    downloadResponse.readableStreamBody.pipe(res);
    downloadResponse.readableStreamBody.on('error', (err: Error) => {
      console.error('[pdf proxy] stream error:', err.message);
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/page-image?page=1&fileType=GC_PAY_APP ─────────────
// Serves pre-rendered page JPEG from blob storage — much faster than PDF loading
packagesRouter.get('/:id/page-image', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageNum = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1);
    const fileType = (req.query.fileType as string) ?? 'GC_PAY_APP';

    // Find the document to get its filename
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
    if (!pkg) throw createError('Package not found', 404);

    const doc = pkg.documents.find(d => d.fileType === fileType) ?? pkg.documents[0];
    if (!doc) throw createError('Document not found', 404);

    // Construct blob name for page image
    const baseName = (doc.filename ?? 'doc').replace(/\.[^.]+$/, '');
    const pageBlobName = `page-images/${req.params.id}/${baseName}_p${String(pageNum).padStart(4, '0')}.jpg`;

    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) throw createError('Storage not configured', 500);

    const { BlobServiceClient } = await import('@azure/storage-blob');
    const svc = BlobServiceClient.fromConnectionString(connStr);
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME ?? 'jvpay-docs';
    const blobClient = svc.getContainerClient(containerName).getBlobClient(pageBlobName);

    const downloadResponse = await blobClient.download();
    if (!downloadResponse.readableStreamBody) throw createError('Image unavailable', 500);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600'); // cache 1 hour
    if (downloadResponse.contentLength != null) {
      res.setHeader('Content-Length', String(downloadResponse.contentLength));
    }

    downloadResponse.readableStreamBody.pipe(res);
    downloadResponse.readableStreamBody.on('error', (err: Error) => {
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/packages/:id/gc-sov.csv (CSV export for GC SOV lines) ──────────
packagesRouter.get('/:id/gc-sov.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id },
      select: { projectName: true },
    });
    if (!pkg) throw createError('Package not found', 404);

    const lines = await prisma.gcPayApplicationSovLine.findMany({
      where: { packageId: req.params.id },
      orderBy: { itemNo: 'asc' },
    });

    const CSV_HEADERS = [
      'Item No', 'Description', 'Contractor', 'Scheduled (Original)', 'Scheduled (Change Orders)',
      'Scheduled (Current)', 'Work Completed (Prev)', 'Work Completed (This)',
      'Materials Stored', 'Total Completed', '% Complete', 'Balance to Finish', 'Retainage',
      'Source Page', 'Extraction Confidence',
    ];

    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = lines.map((l) => [
      l.itemNo, l.typeOfWork, l.contractorName,
      l.scheduledOriginal, l.scheduledChangeOrders, l.scheduledCurrent,
      l.workCompletedPrev, l.workCompletedThis, l.materialsStored,
      l.totalCompleted, l.pct, l.balanceToFinish, l.retainage,
      l.sourcePage, l.extractionConfidence,
    ].map(escape).join(','));

    const csv = [CSV_HEADERS.join(','), ...rows].join('\r\n');
    const filename = `${pkg.projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_gc-sov.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  } catch (err) {
    next(err);
  }
});
