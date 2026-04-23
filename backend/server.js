require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes          = require('./routes/auth');
const userSessionRoutes   = require('./routes/userSessions');
const invitesRoutes       = require('./routes/invites');
const sessionsRoutes      = require('./routes/sessions');
const chatRoutes          = require('./routes/chat');
const chatsRoutes         = require('./routes/chats');
const resetReqRoutes      = require('./routes/resetRequests');
const conversationsRoutes = require('./routes/conversations');
const checkBlacklist      = require('./middleware/checkBlacklist');

const app = express();
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL
    : '*',
}));
app.use(express.json());

// Health check — для мониторинга и deploy скрипта
app.get('/api/health', (_req, res) => {
  res.json({
    status:  'ok',
    version: process.env.npm_package_version || '1.0.0',
    env:     process.env.NODE_ENV || 'production',
    uptime:  Math.round(process.uptime()),
  });
});

// Rate limiting — whitelist публичных эндпоинтов
app.use('/api', (req, res, next) => {
  const WHITELISTED = ['/auth/admin/login', '/auth/join', '/auth/reset-request'];
  if (WHITELISTED.includes(req.path)) return next();
  checkBlacklist(req, res, next);
});

// Роуты монтируются НА /api, так как внутри роутеров уже есть префиксы (/auth, /sessions, и т.д.)
app.use('/api',               authRoutes);
app.use('/api',               chatsRoutes);
app.use('/api/sessions',      userSessionRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/admin/invites', invitesRoutes);
app.use('/api/admin/reset-requests', resetReqRoutes);
app.use('/api/admin',         sessionsRoutes);
app.use('/api/chat',          chatRoutes);

try { require('./cron'); } catch (e) { console.warn('[Cron] Not loaded:', e.message); }

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

app.get('/admin*', (_req, res) =>
  res.sendFile(path.join(__dirname, '../admin/index.html'))
);
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Endpoint not found' });
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
