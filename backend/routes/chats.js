/**
 * backend/routes/chats.js
 *
 * История чатов и память Anita — хранятся в БД, контент зашифрован.
 *
 * GET  /api/chats              — список чатов пользователя
 * POST /api/chats              — создать новый чат
 * GET  /api/chats/:id          — загрузить историю чата
 * POST /api/chats/:id/messages — добавить сообщение
 * DELETE /api/chats/:id        — удалить чат
 *
 * GET  /api/memory             — загрузить память Anita
 * POST /api/memory             — обновить память Anita
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const { encrypt, decrypt } = require('../utils/crypto');

router.use(requireAuth);

// Только для пользователей
const userOnly = (req, res, next) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  next();
};

// ══════════════════════════════════════════════════════════════
// CHATS
// ══════════════════════════════════════════════════════════════

// GET /api/chats — список чатов (без сообщений)
router.get('/chats', userOnly, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title, created_at, updated_at,
         (SELECT COUNT(*) FROM chat_messages WHERE chat_id = user_chats.id) as message_count
       FROM user_chats
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[GET /chats]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/chats — создать новый чат
router.post('/chats', userOnly, async (req, res) => {
  const { title } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO user_chats (user_id, title) VALUES ($1, $2) RETURNING *',
      [req.user.userId, title || 'Новый разговор']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[POST /chats]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/chats/:id — история сообщений (расшифровать)
router.get('/chats/:id', userOnly, async (req, res) => {
  try {
    // Проверяем что чат принадлежит этому пользователю
    const chatRes = await db.query(
      'SELECT * FROM user_chats WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (chatRes.rows.length === 0) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    const messagesRes = await db.query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    // Расшифровываем контент
    const messages = messagesRes.rows.map(m => {
      try {
        return { ...m, content: decrypt(m.content) };
      } catch (e) {
        // Если расшифровка не удалась (старое незашифрованное сообщение) — вернуть как есть
        return m;
      }
    });

    res.json({ chat: chatRes.rows[0], messages });
  } catch (err) {
    console.error('[GET /chats/:id]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/chats/:id/messages — добавить сообщение (шифруем)
router.post('/chats/:id/messages', userOnly, async (req, res) => {
  const { role, content } = req.body;
  if (!role || !content) return res.status(400).json({ error: 'role и content обязательны' });
  if (!['user', 'assistant'].includes(role)) return res.status(400).json({ error: 'Неверная роль' });

  try {
    // Проверяем владельца
    const chatRes = await db.query(
      'SELECT id FROM user_chats WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (chatRes.rows.length === 0) return res.status(404).json({ error: 'Чат не найден' });

    const encryptedContent = encrypt(content);

    const msgRes = await db.query(
      'INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3) RETURNING id, role, created_at',
      [req.params.id, role, encryptedContent]
    );

    // Обновляем title и updated_at чата
    if (role === 'user') {
      const title = content.slice(0, 80);
      await db.query(
        `UPDATE user_chats SET updated_at = NOW(),
           title = CASE WHEN title = 'Новый разговор' OR title IS NULL THEN $2 ELSE title END
         WHERE id = $1`,
        [req.params.id, title]
      );
    }

    res.json({ ...msgRes.rows[0], content }); // Возвращаем незашифрованный для фронта
  } catch (err) {
    console.error('[POST /chats/:id/messages]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/chats/:id
router.delete('/chats/:id', userOnly, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM user_chats WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ══════════════════════════════════════════════════════════════
// MEMORY
// ══════════════════════════════════════════════════════════════

// GET /api/memory — загрузить память при старте приложения
router.get('/memory', userOnly, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT facts, themes, techniques, name_hint, mood_trajectory FROM user_memory WHERE user_id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.json({ facts: [], themes: [], techniques: [], name_hint: null, mood_trajectory: null });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[GET /memory]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/memory — сохранить/обновить память после сессии
router.post('/memory', userOnly, async (req, res) => {
  const { facts, themes, techniques, name_hint, mood_trajectory } = req.body;
  try {
    await db.query(
      `INSERT INTO user_memory (user_id, facts, themes, techniques, name_hint, mood_trajectory, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         facts           = $2,
         themes          = $3,
         techniques      = $4,
         name_hint       = COALESCE($5, user_memory.name_hint),
         mood_trajectory = COALESCE($6, user_memory.mood_trajectory),
         updated_at      = NOW()`,
      [
        req.user.userId,
        JSON.stringify(facts || []),
        themes || [],
        techniques || [],
        name_hint || null,
        mood_trajectory || null
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[POST /memory]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
