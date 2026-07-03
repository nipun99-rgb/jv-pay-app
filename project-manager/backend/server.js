/**
 * server.js — Express entry point (decomposed from monolith)
 * 
 * Route modules are mounted under /api/projects (legacy SQLite) and
 * /api/* (new Prisma-backed routes for Azure SQL).
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use((err, req, res, next) => {
  // Catch JSON parse errors from body-parser before they reach routes
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});
app.use(cookieParser());

// ── Legacy SQLite Routes (DEPRECATED — will be removed in Sprint 2) ─────────
app.use("/api/projects", require("./routes/projects"));
app.use("/api/projects", require("./routes/tasks"));
app.use("/api/projects", require("./routes/coverPage"));
app.use("/api/projects", require("./routes/lineItems"));
app.use("/api/projects", require("./routes/logs"));
app.use("/api/projects", require("./routes/pipeline"));
app.use("/api/projects", require("./routes/validation"));
app.use("/api/projects", require("./routes/subcontractors"));

// ── New Prisma-backed Routes (Azure SQL) ─────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/contracts", require("./routes/contracts"));
app.use("/api/packages", require("./routes/packages"));
app.use("/api/pipeline", require("./routes/pipelineV2"));
app.use("/api/exceptions", require("./routes/exceptions"));
app.use("/api/activity", require("./routes/activity"));
app.use("/api/notifications", require("./routes/notifications"));

// ── Global Error Handlers (prevent server crashes on DB failures) ─────────────
// Express error handler — catches body-parser JSON parse errors + route errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  console.error('Express error handler:', err.message || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (server still running):', err.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server still running):', err.message || err);
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Backend running at http://localhost:${PORT}`);
  console.log(`  Prisma → Azure SQL: ${process.env.DATABASE_URL ? 'configured' : 'NOT configured'}\n`);
});
