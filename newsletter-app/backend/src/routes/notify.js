const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { subscribers, notificationLogs } = require('../store');
const { extractActorFromRequest, recordAudit } = require('../utils/auditLogger');

const router = express.Router();

// POST /api/notify
// Accepted callers:
//   1. M2M — blog-backend-service (client_credentials) with 'service' realm role
//   2. Direct user call — any user token that has the 'service' realm role assigned
router.post('/', verifyToken, requireRole('service'), (req, res) => {
  const { postId, title, author, excerpt, publishedBy } = req.body;

  if (!postId || !title || !author) {
    return res.status(400).json({ error: 'postId, title, and author are required' });
  }

  const notifiedAt = new Date().toISOString();

  console.log('=== Newsletter Notification Triggered ===');
  console.log(`Post: [${postId}] "${title}" by ${author}`);
  console.log(`Excerpt: ${excerpt || '(none)'}`);
  console.log(`Triggered by service account: ${req.user.sub}`);
  console.log(`Subscribers in list: ${subscribers.length}`);

  // Simulate sending an email to each subscriber and record the result
  const results = subscribers.map((sub) => {
    // In production: call SendGrid / SES / SMTP here and capture real errors.
    const sentAt = new Date().toISOString();
    console.log(`  → Sending to ${sub.email} ... OK`);
    return { email: sub.email, name: sub.name || '', status: 'sent', sentAt };
  });

  // Detect whether this is an M2M service call or a direct user call
  const isServiceCall = req.user.azp === 'blog-backend-service';
  const callerType = isServiceCall ? 'service' : 'user';

  // Capture the caller machine info from the incoming request
  const callerIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const callerHost = req.headers['x-caller-host'] || callerIp;
  const clientApp = req.user.azp || 'unknown';

  // For direct user calls, extract identity from token; for M2M, use body value
  const resolvedPublishedBy = isServiceCall
    ? (publishedBy || null)
    : (req.user.preferred_username || req.user.email || req.user.sub || null);

  const logEntry = {
    logId: Date.now(),
    postId,
    title,
    author,
    excerpt: excerpt || '',
    notifiedAt,
    caller: {
      type: callerType,
      ip: callerIp,
      host: callerHost,
      clientApp,
      publishedBy: resolvedPublishedBy,
    },
    totalSubscribers: subscribers.length,
    sentCount: results.filter((r) => r.status === 'sent').length,
    failedCount: results.filter((r) => r.status === 'failed').length,
    results,
  };
  notificationLogs.unshift(logEntry); // newest first

  recordAudit({
    action: 'NOTIFICATION_SENT',
    severity: 'INFO',
    actor: extractActorFromRequest(req),
    resource: `post:${postId}`,
    outcome: 'SUCCESS',
    details: {
      postId,
      title,
      author,
      totalSubscribers: logEntry.totalSubscribers,
      sentCount: logEntry.sentCount,
      failedCount: logEntry.failedCount,
      callerType: callerType,
      publishedBy: resolvedPublishedBy,
    },
  });

  console.log(`Notification complete: ${logEntry.sentCount} sent, ${logEntry.failedCount} failed.`);

  res.json({
    message: 'Notification sent successfully',
    post: { postId, title, author },
    notifiedAt,
    sentCount: logEntry.sentCount,
    failedCount: logEntry.failedCount,
  });
});

// GET /api/notify/logs — admin users from newsletter frontend
router.get('/logs', verifyToken, requireRole('admin'), (req, res) => {
  recordAudit({
    action: 'NOTIFICATION_LOGS_VIEWED',
    severity: 'INFO',
    actor: extractActorFromRequest(req),
    resource: 'notification-logs',
    outcome: 'SUCCESS',
    details: { logsAvailable: notificationLogs.length },
  });
  res.json({ count: notificationLogs.length, logs: notificationLogs });
});

module.exports = router;
