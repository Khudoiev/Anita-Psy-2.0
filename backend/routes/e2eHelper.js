const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// Guard: staging only + secret header
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'staging') {
    return res.status(404).json({ error: 'Not found' });
  }
  const secret = req.headers['x-e2e-secret'];
  if (!secret || secret !== process.env.E2E_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// POST /api/e2e/cleanup — удаляет всех e2e_ юзеров и инвайты
router.post('/cleanup', async (req, res) => {
  try {
    await db.query(`DELETE FROM users WHERE username LIKE 'e2e_%' OR nickname LIKE 'e2e_%'`);
    await db.query(`DELETE FROM invites WHERE label LIKE 'e2e_%'`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/e2e/invite — создаёт тестовый инвайт
router.post('/invite', async (req, res) => {
  try {
    const { label = 'e2e_default' } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    const result = await db.query(
      `INSERT INTO invites (token, label, max_uses, is_active)
       VALUES ($1, $2, 100, true) RETURNING token`,
      [token, label]
    );
    res.json({ token: result.rows[0].token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/e2e/user/:username/exists
router.get('/user/:username/exists', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [req.params.username]
    );
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/e2e/user/:username/profile
router.get('/user/:username/profile', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT um.profile FROM users u
      LEFT JOIN user_memory um ON um.user_id = u.id
      WHERE u.username = $1
    `, [req.params.username]);
    res.json({ profile: result.rows[0]?.profile || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
