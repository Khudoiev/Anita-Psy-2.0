/**
 * backend/routes/resetRequests.js
 *
 * Управление запросами на сброс пароля (для админа)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/requireAuth');
const crypto = require('crypto');

router.use(requireAdmin);

// GET /api/admin/reset-requests — список всех запросов
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.username as current_username
       FROM password_reset_requests r
       LEFT JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/admin/reset-requests/:id/approve — одобрить и создать токен
router.post('/:id/approve', async (req, res) => {
  const { adminNote } = req.body;
  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 3600000); // 1 час

  try {
    const result = await db.query(
      `UPDATE password_reset_requests SET
         status = 'approved',
         reset_token = $1,
         token_expires_at = $2,
         admin_note = $3,
         resolved_at = NOW(),
         resolved_by = $4
       WHERE id = $5 RETURNING *`,
      [resetToken, expiresAt, adminNote || null, req.user.adminId, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Запрос не найден' });

    res.json({
      message: 'Запрос одобрен',
      resetLink: `${process.env.FRONTEND_URL || ''}/auth.html?reset_token=${resetToken}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/admin/reset-requests/:id/reject — отклонить
router.post('/:id/reject', async (req, res) => {
  const { adminNote } = req.body;
  try {
    await db.query(
      `UPDATE password_reset_requests SET
         status = 'rejected',
         admin_note = $1,
         resolved_at = NOW(),
         resolved_by = $2
       WHERE id = $3`,
      [adminNote || null, req.user.adminId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
