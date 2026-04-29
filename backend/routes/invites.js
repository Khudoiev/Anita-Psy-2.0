const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/requireAuth');
const crypto = require('crypto');
const logAdminAction = require('../utils/adminLog');

router.use(requireAdmin);

// GET /api/admin/invites
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM invites ORDER BY created_at DESC');
    const frontendUrl = process.env.FRONTEND_URL || '';
    const rows = result.rows.map(inv => ({
      ...inv,
      invite_url: `${frontendUrl}/register?token=${inv.token}`,
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/admin/invites
router.post('/', async (req, res) => {
  const { label, maxUses, expiresAt } = req.body;
  const token = crypto.randomBytes(32).toString('hex');
  const exp = expiresAt || null;

  try {
    const queryStr = exp 
      ? 'INSERT INTO invites (token, label, max_uses, expires_at) VALUES ($1, $2, $3, $4) RETURNING *'
      : `INSERT INTO invites (token, label, max_uses, expires_at) VALUES ($1, $2, $3, NOW() AT TIME ZONE 'UTC' + INTERVAL '7 days') RETURNING *`;
    const queryParams = exp ? [token, label, maxUses || 1, exp] : [token, label, maxUses || 1];
    
    const result = await db.query(queryStr, queryParams);
    
    await logAdminAction(req.user.adminId, 'create_invite', 'invite', result.rows[0].id, { label, maxUses, exp });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/admin/invites/:id
router.delete('/:id', async (req, res) => {
  try {
    const invite = await db.query('SELECT label FROM invites WHERE id = $1', [req.params.id]);
    await db.query('DELETE FROM invites WHERE id = $1', [req.params.id]);
    if (invite.rows.length) {
      await logAdminAction(req.user.adminId, 'delete_invite', 'invite', req.params.id, { label: invite.rows[0].label });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка при удалении. Возможно есть связанные пользователи.' });
  }
});

// PATCH /api/admin/invites/:id/toggle
router.patch('/:id/toggle', async (req, res) => {
  try {
    const result = await db.query('UPDATE invites SET is_active = NOT is_active WHERE id = $1 RETURNING *', [req.params.id]);
    const newState = result.rows[0].is_active;
    await logAdminAction(req.user.adminId, newState ? 'activate_invite' : 'deactivate_invite', 'invite', req.params.id, { label: result.rows[0].label });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
