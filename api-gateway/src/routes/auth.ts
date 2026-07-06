import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createError } from '../middleware/errorHandler';

export const authRouter = Router();

// ─── Login schema ─────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// ─── Valid credentials ────────────────────────────────────────────────────────
const VALID_USERS = [
  { email: 'admin', password: 'admin1234', id: 'user-stub-001', displayName: 'admin', role: 'ADMIN' },
  { email: 'test@aic.com', password: 'Test1234!', id: 'user-stub-002', displayName: 'test', role: 'REVIEWER' },
];

/**
 * POST /api/auth/login
 */
authRouter.post('/login', (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw createError('Invalid email or password format', 400);
  }

  const matched = VALID_USERS.find(
    u => u.email === parsed.data.email && u.password === parsed.data.password
  );
  if (!matched) {
    throw createError('Invalid email or password', 401);
  }

  const mockUser = {
    id: matched.id,
    displayName: matched.displayName,
    email: matched.email,
    roles: [{ code: matched.role }],
  };

  // Set a simple session cookie (Sprint 14: replace with real JWT/session)
  res.cookie('session', Buffer.from(JSON.stringify(mockUser)).toString('base64'), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  });

  res.json({ user: mockUser });
});

/**
 * GET /api/auth/me
 * Returns the current user from session cookie.
 */
authRouter.get('/me', (req: Request, res: Response) => {
  const session = req.cookies?.session as string | undefined;
  if (!session) {
    res.status(401).json({ user: null });
    return;
  }

  try {
    const user = JSON.parse(Buffer.from(session, 'base64').toString('utf8')) as {
      id: string;
      displayName: string;
      email: string;
      roles: { code: string }[];
    };
    res.json({ user });
  } catch {
    res.status(401).json({ user: null });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('session');
  res.json({ ok: true });
});
