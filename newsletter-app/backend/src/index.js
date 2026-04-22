require('dotenv').config();
const express = require('express');
const cors = require('cors');
const subscribersRouter = require('./routes/subscribers');
const notifyRouter = require('./routes/notify');
const auditRouter = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 4002;
const BLOG_BACKEND_URL = process.env.BLOG_BACKEND_URL || 'http://localhost:4001';

// Accept calls from blog-backend (M2M), blog frontend (subscribe form), and newsletter frontend (admin)
app.use(cors({ origin: [BLOG_BACKEND_URL, 'http://localhost:3001', 'http://localhost:3002'] }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'OK', service: 'newsletter-backend' }));
app.use('/api/subscribers', subscribersRouter);
app.use('/api/notify', notifyRouter);
app.use('/api/audit', auditRouter);

app.listen(PORT, () => {
  console.log(`Newsletter backend running on http://localhost:${PORT}`);
});
