// routes/notifications.js — Notification management (Prisma + Azure SQL)
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — list notifications for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = { userId: req.user.id };
    if (req.query.unread === 'true') {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(notifications);
  } catch (err) {
    console.error('GET /notifications error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/notifications/:notificationId — mark as read
router.patch('/:notificationId', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.notificationId);
    const { isRead } = req.body;

    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user.id }
    });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    await prisma.notification.update({
      where: { id },
      data: { isRead: isRead !== false, readAt: new Date() }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /notifications/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications — create notification (internal use by pipeline/approval routes)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { userId, type, title, body, packageId } = req.body;
    if (!userId || !title || !type) {
      return res.status(400).json({ error: 'userId, type, and title are required' });
    }

    const notification = await prisma.notification.create({
      data: {
        userId: parseInt(userId),
        packageId: packageId ? parseInt(packageId) : null,
        notificationType: type,
        title,
        message: body || title
      }
    });

    res.status(201).json(notification);
  } catch (err) {
    console.error('POST /notifications error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
