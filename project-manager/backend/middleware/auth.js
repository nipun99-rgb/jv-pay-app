// middleware/auth.js — Session token validation & role enforcement
const prisma = require('../lib/prisma');

async function requireAuth(req, res, next) {
  const token = req.cookies?.sessionToken;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const session = await prisma.userSession.findUnique({
      where: { sessionToken: token },
      include: { user: { select: { id: true, clientId: true, displayName: true, isActive: true } } }
    });

    if (!session || !session.user.isActive) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    if (session.revokedAt) {
      return res.status(401).json({ error: 'Session revoked' });
    }
    if (new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    // Update last active timestamp (non-blocking)
    prisma.userSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() }
    }).catch(() => {});

    req.user = session.user;
    next();
  } catch (err) {
    if (err.message && err.message.includes("Can't reach database server")) {
      return res.status(503).json({ error: 'Database unavailable — check VPN/network connection' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function requireRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      const userRoles = await prisma.userRole.findMany({
        where: {
          userId: req.user.id,
          revokedAt: null,
          OR: [{ clientId: req.user.clientId }, { clientId: null }]
        },
        include: { role: { select: { code: true } } }
      });
      const codes = userRoles.map(ur => ur.role.code);
      if (!allowedRoles.some(r => codes.includes(r))) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      req.userRoles = codes;
      next();
    } catch (err) {
      if (err.message && err.message.includes("Can't reach database server")) {
        return res.status(503).json({ error: 'Database unavailable — check VPN/network connection' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = { requireAuth, requireRole };
