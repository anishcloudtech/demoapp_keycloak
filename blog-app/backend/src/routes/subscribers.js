const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { getSubscribers } = require('../services/newsletterService');

const router = express.Router();

// GET /api/subscribers — admin only; proxies to newsletter-backend via M2M
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const data = await getSubscribers();
    console.log('Fetched subscribers:', data);
    res.json(data);
  } catch (err) {
    console.error('M2M getSubscribers error:', err.message);
    res.status(502).json({ error: 'Unable to fetch subscribers from newsletter service' });
  }
});

module.exports = router;
