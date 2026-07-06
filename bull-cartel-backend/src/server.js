require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const { router: vaultRoutes } = require('./routes/vaultRoutes');
const brokerRoutes = require('./routes/brokerRoutes');
const aiScreenerRoutes = require('./routes/aiScreener');

const app = express();

// --- Security middleware ---
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// General rate limit across the whole API (auth routes have their own tighter limit)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, slow down.' },
  })
);

// --- Health check (useful for Railway/Render deploy checks) ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/ai', aiScreenerRoutes);
// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// --- Global error handler (last resort — never leak stack traces to client) ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Bull Cartel backend running on port ${PORT}`);
});
