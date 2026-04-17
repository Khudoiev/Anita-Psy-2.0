require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const invitesRoutes = require('./routes/invites');
const sessionsRoutes = require('./routes/sessions');
const chatRoutes = require('./routes/chat');

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL ? process.env.FRONTEND_URL : '*'
}));
app.use(express.json());

const checkBlacklistAndLimit = require('./middleware/checkBlacklist');

// API Routes
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/admin/login') return next();
  checkBlacklistAndLimit(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/admin/invites', invitesRoutes);
app.use('/api/admin', sessionsRoutes);
app.use('/api/chat', chatRoutes);
// We'll put user session routes (/api/sessions/...) in authRoutes or a separate file.
// The prompt indicated /api/sessions/ping and /api/sessions/end are in auth.js. 
// For cleaner URL mapping, let's map /api/sessions to authRoutes as well, or just mount it at /api.
app.use('/api', authRoutes);

// Static files fallback (mainly for local without nginx)
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// Fallback for HTML5 history API
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
