// server.js
// Entry point for the Coin Wallet System backend.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { verifyConnection } = require('./config/db');
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------------------------------------------
// Core middleware
// ------------------------------------------------------------
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));

// Basic rate limiting to slow down brute-force / abuse attempts.
// Auth routes get a stricter limit than the general API.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Please try again later.' },
});

app.use('/api/', generalLimiter);
app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Coin Wallet API is running.' });
});

app.use('/api', authRoutes);       // /api/register, /api/login, /api/profile
app.use('/api', walletRoutes);     // /api/wallet, /api/wallet/add, /api/purchase, /api/history, /api/stats
app.use('/api/admin', adminRoutes); // /api/admin/*

// ------------------------------------------------------------
// 404 + error handling
// ------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Centralized error handler (catches anything thrown/passed to next(err))
app.use((err, req, res, next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ------------------------------------------------------------
// Startup
// ------------------------------------------------------------
async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('[startup] JWT_SECRET is not set in .env. Refusing to start.');
    process.exit(1);
  }
  await verifyConnection();
  app.listen(PORT, () => {
    console.log(`[server] Coin Wallet API listening on http://localhost:${PORT}`);
  });
}

start();
