/**
 * backend/app.js — Express приложение (без .listen)
 * Выделено из server.js чтобы тесты могли импортировать app без запуска сервера.
 */

const path = require('path');

const express = require('express');
const cors    = require('cors');
const Sentry  = require('@sentry/node');

// Sentry Init
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
    ],
    tracesSampleRate: 0.2,
  });
}

const authRoutes          = require('./routes/auth');
const userSessionRoutes   = require('./routes/userSessions');
const invitesRoutes       = require('./routes/invites');
const sessionsRoutes      = require('./routes/sessions');
const chatRoutes          = require('./routes/chat');
const chatsRoutes         = require('./routes/chats');
const resetReqRoutes      = require('./routes/resetRequests');
const conversationsRoutes = require('./routes/conversations');
const checkBlacklist      = require('./middleware/checkBlacklist');
const requestLogger       = require('./middleware/requestLogger');

const app = express();

if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

app.use(requestLogger);
app.set('trust proxy', 1);

// CORS
const _isProd = process.env.NODE_ENV === 'production';
const _allowedOrigins = _isProd
  ? [process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean)
  : null;

app.use(cors({
  origin: _allowedOrigins && _allowedOrigins.length ? _allowedOrigins : '*',
}));
app.use(express.json());

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    const dbCheck = await require('./db').query('SELECT 1');
    res.json({
      status:  'ok',
      db:      dbCheck ? 'connected' : 'error',
      version: process.env.npm_package_version || '1.0.0',
      uptime:  Math.round(process.uptime()),
    });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// Blacklist middleware
app.use('/api', (req, res, next) => {
  const WHITELISTED = ['/auth/admin/login', '/auth/join', '/auth/reset-request'];
  if (WHITELISTED.includes(req.path)) return next();
  checkBlacklist(req, res, next);
});

// Routes
app.use('/api',               authRoutes);
app.use('/api',               chatsRoutes);
app.use('/api/sessions',      userSessionRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/admin/invites', invitesRoutes);
app.use('/api/admin/reset-requests', resetReqRoutes);
app.use('/api/admin',         sessionsRoutes);
app.use('/api/chat',          chatRoutes);

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

app.get('/admin*', (_req, res) =>
  res.sendFile(path.join(__dirname, '../admin/index.html'))
);
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Endpoint not found' });
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Sentry Error Handler (must be after all controllers)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global Error Handler
app.use((err, req, res, next) => {
  const logger = require('./services/logger');
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled Error');
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

module.exports = app;
