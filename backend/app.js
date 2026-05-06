/**
 * backend/app.js — Express приложение (без .listen)
 * Выделено из server.js чтобы тесты могли импортировать app без запуска сервера.
 */

const path = require('path');

const express = require('express');
const cors    = require('cors');
const Sentry  = require('@sentry/node');

const app = express();

const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'https://api.x.ai'],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  frameguard:     { action: 'deny' },
  noSniff:        true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message:         { error: 'Слишком много попыток. Попробуй через 15 минут.' },
  standardHeaders: true,
  legacyHeaders:   false,
  skip: () => process.env.SKIP_RATE_LIMIT === 'true',
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message:         { error: 'Слишком много регистраций с этого IP.' },
  standardHeaders: true,
  legacyHeaders:   false,
  skip: () => process.env.SKIP_RATE_LIMIT === 'true',
});

// Sentry Init (v10 API)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.postgresIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
    tracesSampleRate:   0.1,
    profilesSampleRate: 0.1,
    ignoreTransactions: ['/api/health', '/api/sessions/ping'],
  });
}

const authRoutes          = require('./routes/auth');
const userSessionRoutes   = require('./routes/userSessions');
const invitesRoutes       = require('./routes/invites');
const sessionsRoutes      = require('./routes/sessions');
const chatRoutes          = require('./routes/chat');
const resetReqRoutes      = require('./routes/resetRequests');
const conversationsRoutes = require('./routes/conversations');
const profileRoutes       = require('./routes/profile');
const e2eHelperRoutes     = require('./routes/e2eHelper');
const checkBlacklist      = require('./middleware/checkBlacklist');
const requestLogger       = require('./middleware/requestLogger');

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

// E2E helper — staging only, before blacklist
app.use('/api/e2e', e2eHelperRoutes);

// Blacklist middleware
app.use('/api', (req, res, next) => {
  const WHITELISTED = ['/auth/admin/login', '/auth/join', '/auth/reset-request'];
  if (WHITELISTED.includes(req.path)) return next();
  checkBlacklist(req, res, next);
});

// Auth rate limiters — до регистрации роутов
app.post('/api/auth/login',          authLimiter);
app.post('/api/auth/admin/login',    authLimiter);
app.post('/api/auth/register',       registerLimiter);
app.post('/api/auth/reset-request',  authLimiter);
app.post('/api/auth/reset-password', authLimiter);

// Routes
app.use('/api',               authRoutes);
app.use('/api/sessions',      userSessionRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/admin/invites', invitesRoutes);
app.use('/api/admin/reset-requests', resetReqRoutes);
app.use('/api/admin',         sessionsRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/profile',       profileRoutes);

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
  Sentry.setupExpressErrorHandler(app);
}

// Global Error Handler
app.use((err, req, res, _next) => {
  const logger  = require('./services/logger');
  const errorId = require('crypto').randomBytes(4).toString('hex');
  logger.error({ err, url: req.url, method: req.method, errorId }, 'Unhandled Error');
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(err.status || 500).json({
    error:   isDev ? err.message : 'Внутренняя ошибка сервера',
    errorId,
  });
});

module.exports = app;
