import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { packagesRouter } from './routes/packages';
import { uploadRouter } from './routes/upload';
import { clientsRouter } from './routes/clients';
import { contractsRouter } from './routes/contracts';
import { reportsRouter } from './routes/reports';

const app = express();
const httpServer = createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [process.env.FRONTEND_URL ?? 'http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  const packageId = socket.handshake.query.packageId as string | undefined;
  if (packageId) {
    socket.join(`package:${packageId}`);
  }

  // Join explicit room (e.g., IngestPage → socket.emit('join', 'package:xxx'))
  socket.on('join', (room: string) => {
    socket.join(room);
  });

  // ── Sprint 11: Agent Chat ──────────────────────────────────────────────────
  socket.on('chat', async (payload: { packageId: string; message: string }) => {
    const { packageId: pkgId, message } = payload ?? {};
    if (!pkgId || !message) return;

    try {
      const aiUrl = process.env.AI_ENGINE_URL ?? 'http://localhost:8000';
      const upstream = await fetch(`${aiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: pkgId, user_message: message }),
      });
      const data = await upstream.json() as {
        reply?: string; intent?: string; entity?: string;
        cost_usd?: number; tokens?: number;
      };
      socket.emit('chat_reply', {
        reply: data.reply ?? 'No response received.',
        intent: data.intent ?? 'unknown',
        cost_usd: data.cost_usd ?? 0,
        tokens: data.tokens ?? 0,
      });
    } catch (err) {
      console.error('[chat] AI engine error:', (err as Error).message);
      socket.emit('chat_reply', {
        reply: 'The AI agent is currently unavailable. Please try again shortly.',
        intent: 'error',
        cost_usd: 0,
        tokens: 0,
      });
    }
  });

  socket.on('disconnect', () => {});
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: [process.env.FRONTEND_URL ?? 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/reports', reportsRouter);

// 404 handler — must come after all routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler — must be last
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10);

httpServer.listen(PORT, () => {
  console.log(`[api-gateway] listening on port ${PORT}`);
});

export { app, httpServer };
