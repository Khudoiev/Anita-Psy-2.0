const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const getGeoAndDevice = (req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim().replace(/^::ffff:/, '');
  const geo = geoip.lookup(ip) || {};
  const _parser = new UAParser(req.headers['user-agent'] || '');
  return { ip, country: geo.country, country_code: geo.country, city: geo.city };
};

// POST /api/sessions/start
router.post('/start', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  try {
    const sessionRes = await db.query(
      'INSERT INTO sessions (user_id) VALUES ($1) RETURNING id', [req.user.userId]
    );
    await db.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [req.user.userId]);
    res.json({ sessionId: sessionRes.rows[0].id });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/sessions/heartbeat
router.post('/heartbeat', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Нет ID сессии' });
  try {
    const sessionRes = await db.query(
      'UPDATE sessions SET last_heartbeat = NOW() WHERE id = $1 AND user_id = $2 RETURNING id',
      [sessionId, req.user.userId]
    );
    if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Сессия не найдена' });
    const { ip, country, country_code, city } = getGeoAndDevice(req);
    await db.query(
      `UPDATE users SET last_seen = NOW(),
         ip = COALESCE($2, ip), country = COALESCE($3, country),
         country_code = COALESCE($4, country_code), city = COALESCE($5, city)
       WHERE id = $1`,
      [req.user.userId, ip, country, country_code, city]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Heartbeat error' }); }
});

// POST /api/sessions/end
router.post('/end', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Нет ID сессии' });
  try {
    await db.query(
      `UPDATE sessions SET ended_at = NOW(), is_active = false,
         duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
       WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user.userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/sessions/ping
router.post('/ping', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  const { messagesCount, sessionId } = req.body;
  try {
    const { ip, country, country_code, city } = getGeoAndDevice(req);
    await db.query(
      `UPDATE users SET last_seen = NOW(),
         ip = COALESCE($2, ip), country = COALESCE($3, country),
         country_code = COALESCE($4, country_code), city = COALESCE($5, city)
       WHERE id = $1`,
      [req.user.userId, ip, country, country_code, city]
    );
    if (sessionId) {
      await db.query('UPDATE sessions SET messages_count = $1 WHERE id = $2 AND user_id = $3',
        [messagesCount || 0, sessionId, req.user.userId]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// POST /api/sessions/logout
router.post('/logout', requireAuth, async (req, res) => {
  res.json({ success: true });
});

module.exports = router;
