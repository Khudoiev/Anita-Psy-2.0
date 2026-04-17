const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

const getGeoAndDevice = (req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().replace(/^::ffff:/, '');
  const geo = geoip.lookup(ip) || {};
  const parser = new UAParser(req.headers['user-agent'] || '');
  const browser = parser.getBrowser().name || 'Unknown';
  let deviceType = parser.getDevice().type || 'desktop';
  if (deviceType !== 'mobile' && deviceType !== 'tablet' && deviceType !== 'desktop') {
    deviceType = parser.getDevice().model ? 'mobile' : 'desktop';
  }
  let countryName = geo.country;
  if (geo.country) {
    try { countryName = regionNames.of(geo.country); } catch(e) {}
  }
  return { ip, country: countryName, country_code: geo.country, city: geo.city, user_agent: req.headers['user-agent'], deviceType, browser };
};

// POST /api/auth/join
router.post('/auth/join', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Токен не передан' });

  try {
    // start transaction
    await db.query('BEGIN');
    const inviteRes = await db.query(
      'SELECT * FROM invites WHERE token = $1 AND is_active = true AND uses_count < max_uses AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE',
      [token]
    );

    if (inviteRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Ссылка недействительна или устарела' });
    }

    const invite = inviteRes.rows[0];

    // Create user
    const { ip, country, country_code, city, user_agent, deviceType, browser } = getGeoAndDevice(req);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const userRes = await db.query(
      `INSERT INTO users (invite_id, session_token, ip, country, country_code, city, user_agent, device_type, browser) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [invite.id, sessionToken, ip, country, country_code, city, user_agent, deviceType, browser]
    );
    const userId = userRes.rows[0].id;

    // Update invite
    await db.query('UPDATE invites SET uses_count = uses_count + 1 WHERE id = $1', [invite.id]);
    await db.query('COMMIT');

    const jwtToken = jwt.sign({ userId, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: jwtToken });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/admin/login
router.post('/auth/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const adminRes = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (adminRes.rows.length === 0) return res.status(401).json({ error: 'Неверные учетные данные' });

    const admin = adminRes.rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: 'Неверные учетные данные' });

    const token = jwt.sign({ adminId: admin.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/sessions/start
router.post('/sessions/start', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  try {
    const sessionRes = await db.query(
      'INSERT INTO sessions (user_id) VALUES ($1) RETURNING id',
      [req.user.userId]
    );
    console.log(`[Session START] User: ${req.user.userId}, Session: ${sessionRes.rows[0].id}`);
    // Update last_seen
    await db.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [req.user.userId]);
    res.json({ sessionId: sessionRes.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/sessions/ping
router.post('/sessions/ping', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  const { messagesCount, sessionId } = req.body;
  
  try {
    const { ip, country, country_code, city } = getGeoAndDevice(req);
    await db.query(
      `UPDATE users SET last_seen = NOW(), ip = COALESCE($2, ip), country = COALESCE($3, country), country_code = COALESCE($4, country_code), city = COALESCE($5, city) WHERE id = $1`, 
      [req.user.userId, ip, country, country_code, city]
    );
    if (sessionId) {
      await db.query('UPDATE sessions SET messages_count = $1 WHERE id = $2 AND user_id = $3', 
        [messagesCount || 0, sessionId, req.user.userId]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/sessions/end
router.post('/sessions/end', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Нет ID сессии' });

  try {
    await db.query(
      'UPDATE sessions SET ended_at = NOW(), is_active = false, duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at)) WHERE id = $1 AND user_id = $2',
      [sessionId, req.user.userId]
    );
    console.log(`[Session END] User: ${req.user.userId}, Session: ${sessionId}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
