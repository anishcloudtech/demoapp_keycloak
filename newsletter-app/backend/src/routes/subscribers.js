const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { subscribers } = require('../store');
const { extractActorFromRequest, recordAudit } = require('../utils/auditLogger');

const router = express.Router();

// POST /api/subscribers — public: anyone can subscribe from blog frontend
router.post('/', (req, res) => {
  const { email, name } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    recordAudit({
      action: 'VALIDATION_ERROR',
      severity: 'WARNING',
      actor: extractActorFromRequest(req),
      resource: 'subscriber',
      outcome: 'FAILURE',
      details: { reason: 'Invalid or missing email', providedEmail: email || null },
    });
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (subscribers.find((s) => s.email === email)) {
    recordAudit({
      action: 'SUBSCRIBER_DUPLICATE',
      severity: 'WARNING',
      actor: extractActorFromRequest(req),
      resource: `subscriber:${email}`,
      outcome: 'FAILURE',
      details: { email, reason: 'Email already subscribed' },
    });
    return res.status(409).json({ error: 'Email already subscribed' });
  }
  const subscriber = { id: Date.now(), email, name: name || '', subscribedAt: new Date().toISOString() };
  subscribers.push(subscriber);
  recordAudit({
    action: 'SUBSCRIBER_ADDED',
    severity: 'INFO',
    actor: extractActorFromRequest(req),
    resource: `subscriber:${email}`,
    outcome: 'SUCCESS',
    details: { email, name: name || '', subscriberId: subscriber.id },
  });
  console.log(`New subscriber: ${email}`);
  res.status(201).json({ message: 'Subscribed successfully', subscriber });
});

// GET /api/subscribers — M2M only: blog-backend-service with 'service' role
router.get('/', verifyToken, requireRole('service'), (req, res) => {
  recordAudit({
    action: 'SUBSCRIBER_LIST_VIEWED',
    severity: 'INFO',
    actor: extractActorFromRequest(req),
    resource: 'subscriber-list',
    outcome: 'SUCCESS',
    details: { totalSubscribers: subscribers.length },
  });
  res.json({ count: subscribers.length, subscribers });
});

// DELETE /api/subscribers/:email — M2M only
router.delete('/:email', verifyToken, requireRole('service'), (req, res) => {
  const idx = subscribers.findIndex((s) => s.email === req.params.email);
  if (idx === -1) {
    recordAudit({
      action: 'SUBSCRIBER_NOT_FOUND',
      severity: 'WARNING',
      actor: extractActorFromRequest(req),
      resource: `subscriber:${req.params.email}`,
      outcome: 'FAILURE',
      details: { email: req.params.email, reason: 'Subscriber not found' },
    });
    return res.status(404).json({ error: 'Subscriber not found' });
  }
  const removed = subscribers.splice(idx, 1)[0];
  recordAudit({
    action: 'SUBSCRIBER_DELETED',
    severity: 'INFO',
    actor: extractActorFromRequest(req),
    resource: `subscriber:${req.params.email}`,
    outcome: 'SUCCESS',
    details: { email: req.params.email, subscriberId: removed.id },
  });
  res.json({ message: 'Unsubscribed successfully' });
});

module.exports = router;
