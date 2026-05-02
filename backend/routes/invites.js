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
    const inv = result.rows[0];
    const frontendUrl = process.env.FRONTEND_URL || '';
    await logAdminAction(req.user.adminId, 'create_invite', 'invite', inv.id, { label, maxUses, exp });
    res.json({ ...inv, invite_url: `${frontendUrl}/register?token=${inv.token}` });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/admin/invites/:id
router.delete('/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const invite = await client.query(
      'SELECT id, label FROM invites WHERE id = $1',
      [req.params.id]
    );
    if (!invite.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Инвайт не найден' });
    }

    const usersUpdated = await client.query(
      'UPDATE users SET invite_id = NULL WHERE invite_id = $1 RETURNING id',
      [req.params.id]
    );

    await client.query('DELETE FROM invites WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');

    await logAdminAction(
      req.user.adminId,
      'delete_invite',
      'invite',
      req.params.id,
      {
        label: invite.rows[0].label,
        users_unlinked: usersUpdated.rowCount,
      }
    );

    res.json({ success: true, users_unlinked: usersUpdated.rowCount });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DELETE invite]', err);
    res.status(500).json({ error: 'Ошибка при удалении инвайта' });
  } finally {
    client.release();
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
