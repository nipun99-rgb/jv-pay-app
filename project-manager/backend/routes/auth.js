// routes/auth.js — Login, Logout, Me endpoints (Prisma + Azure SQL)
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limiter for login: 10 attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        clientId: true,
        displayName: true,
        email: true,
        jobTitle: true,
        passwordHash: true,
        isActive: true
      }
    });

    if (!user || !user.isActive || !user.passwordHash) {
      // Constant-time compare to prevent timing attacks
      await bcrypt.hash('dummy', 12);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create session token (32 hex chars = 16 random bytes)
    const sessionToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    await prisma.userSession.create({
      data: {
        userId: user.id,
        sessionToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
        expiresAt
      }
    });

    // Update last_login_at
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Fetch roles
    const userRoles = await prisma.userRole.findMany({
      where: { userId: user.id, revokedAt: null },
      include: { role: { select: { code: true, displayName: true } } }
    });
    const roles = userRoles.map(ur => ur.role);

    // Set httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      maxAge: 8 * 60 * 60 * 1000
    });

    // Return user WITHOUT passwordHash
    res.json({
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        jobTitle: user.jobTitle,
        clientId: user.clientId,
        roles
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const token = req.cookies?.sessionToken;
    if (token) {
      await prisma.userSession.updateMany({
        where: { sessionToken: token, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
    res.clearCookie('sessionToken');
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        displayName: true,
        email: true,
        jobTitle: true,
        clientId: true
      }
    });

    const userRoles = await prisma.userRole.findMany({
      where: { userId: req.user.id, revokedAt: null },
      include: { role: { select: { code: true, displayName: true } } }
    });
    const roles = userRoles.map(ur => ur.role);

    res.json({ user: { ...user, roles } });
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
