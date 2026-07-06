import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/errorHandler';

export const uploadRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getBlobServiceClient(): BlobServiceClient {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw createError('Azure Storage not configured', 500);
  return BlobServiceClient.fromConnectionString(connStr);
}

const CONTAINER = process.env.AZURE_STORAGE_CONTAINER_NAME ?? 'jvpay-docs';

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const ALLOWED_CONTENT_TYPES = ['application/pdf'] as const;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_CONTENT_TYPES, {
    errorMap: () => ({ message: 'Only PDF files are accepted' }),
  }).default('application/pdf'),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_BYTES, { message: 'File must be 100 MB or smaller' })
    .optional(),
  packageId: z.string().uuid().optional(),
});

const confirmSchema = z.object({
  blobName: z.string().min(1),
  filename: z.string().min(1),
  packageId: z.string().uuid().optional(),
  projectName: z.string().min(1).optional(),
  createdBy: z.string().min(1),
  fileType: z.string().optional(),
});

// ─── POST /api/upload/presign ─────────────────────────────────────────────────
/**
 * Returns a short-lived SAS URL the client uses to PUT the file directly to blob.
 * Avoids routing the file bytes through the API gateway.
 */
uploadRouter.post('/presign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = presignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    }

    const { filename, contentType } = parsed.data;
    const blobName = `${uuidv4()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const client = getBlobServiceClient();

    // Ensure container exists (idempotent)
    const containerClient = client.getContainerClient(CONTAINER);
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // For Azurite / dev: use generate SAS via shared key
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING ?? '';
    const accountMatch = connStr.match(/AccountName=([^;]+)/);
    const keyMatch = connStr.match(/AccountKey=([^;]+)/);

    let sasUrl: string;

    if (accountMatch && keyMatch) {
      const accountName = accountMatch[1]!;
      const accountKey = keyMatch[1]!;
      const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

      const expiresOn = new Date(Date.now() + 15 * 60 * 1000); // 15 min
      const sasQuery = generateBlobSASQueryParameters(
        {
          containerName: CONTAINER,
          blobName,
          permissions: BlobSASPermissions.parse('cw'),
          expiresOn,
          contentType,
        },
        sharedKeyCredential
      ).toString();

      sasUrl = `${blockBlobClient.url}?${sasQuery}`;
    } else {
      // Fallback: unsigned URL (works only when storage is open/public — dev only)
      sasUrl = blockBlobClient.url;
    }

    res.json({ sasUrl, blobName, blobUrl: blockBlobClient.url });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/upload/confirm ─────────────────────────────────────────────────
/**
 * Called after the client has successfully PUT the file to blob storage.
 * Creates or updates the Package record and creates a Document record.
 */
uploadRouter.post('/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.issues.map((i) => i.message).join(', '), 400);
    }

    const { blobName, filename, packageId, projectName, createdBy, fileType } = parsed.data;

    const client = getBlobServiceClient();
    const containerClient = client.getContainerClient(CONTAINER);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const blobUrl = blockBlobClient.url;

    // Create package if not provided
    let pkg;
    if (packageId) {
      pkg = await prisma.package.findUnique({ where: { id: packageId } });
      if (!pkg) throw createError('Package not found', 404);
    } else {
      pkg = await prisma.package.create({
        data: {
          projectName: projectName ?? filename,
          createdBy,
          status: 'PENDING',
        },
      });
    }

    // Create document record
    const doc = await prisma.document.create({
      data: {
        packageId: pkg.id,
        filename,
        blobName,
        blobUrl,
        createdBy,
        fileType: fileType ?? null,
      },
    });

    res.status(201).json({ package: pkg, document: doc });
  } catch (err) {
    next(err);
  }
});
