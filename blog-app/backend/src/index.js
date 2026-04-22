require('dotenv').config();
const express = require('express');
const cors = require('cors');
const postsRouter = require('./routes/posts');
const subscribersRouter = require('./routes/subscribers');
const staffRouter = require('./routes/staff');

const app = express();
const PORT = process.env.PORT || 4001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'OK', service: 'blog-backend' }));
app.use('/api/posts', postsRouter);
app.use('/api/subscribers', subscribersRouter);
app.use('/api/register-staff', staffRouter);

app.listen(PORT, () => {
  console.log(`Blog backend running on http://localhost:${PORT}`);
});
