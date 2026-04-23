const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const { encryptText, decryptText } = require('../utils/encryption');

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

router.use(requireAuth);

// GET /api/conversations
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, title, created_at, updated_at, messages_count, effectiveness_score
      FROM conversations
      WHERE user_id=$1 AND is_archived=false
      ORDER BY updated_at DESC LIMIT 50
    `, [req.user.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('[conversations GET]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/conversations
router.post('/', async (req, res) => {
  const { guestToken } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO conversations (user_id, guest_token) VALUES ($1, $2) RETURNING id, created_at',
      [req.user.userId, guestToken || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[conversations POST]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req, res) => {
  try {
    const conv = await db.query(
      'SELECT * FROM conversations WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (!conv.rows.length) return res.status(404).json({ error: 'Not found' });

    const msgs = await db.query(
      `SELECT id, role, content, created_at FROM messages
       WHERE conversation_id=$1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    const decryptedMsgs = await Promise.all(
      msgs.rows.map(async m => ({ ...m, content: await decryptText(m.content) }))
    );
    res.json({ ...conv.rows[0], messages: decryptedMsgs });
  } catch (err) {
    console.error('[conversations GET /:id]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// PATCH /api/conversations/:id/title
router.patch('/:id/title', async (req, res) => {
  try {
    await db.query(
      'UPDATE conversations SET title=$1 WHERE id=$2 AND user_id=$3',
      [req.body.title, req.params.id, req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// DELETE /api/conversations/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await db.query(
      'UPDATE conversations SET is_archived=true WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/conversations/migrate-guest
router.post('/migrate-guest', async (req, res) => {
  const { guestToken } = req.body;
  if (!guestToken) return res.status(400).json({ error: 'No guest token' });
  try {
    await db.query(
      'UPDATE conversations SET user_id=$1, guest_token=NULL WHERE guest_token=$2',
      [req.user.userId, guestToken]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/conversations/:id/messages  (save encrypted message)
router.post('/:id/messages', async (req, res) => {
  const { role, content } = req.body;
  if (!role || !content) return res.status(400).json({ error: 'role and content required' });

  try {
    const conv = await db.query(
      'SELECT id FROM conversations WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.userId]
    );
    if (!conv.rows.length) return res.status(404).json({ error: 'Not found' });

    const encrypted = await encryptText(content);
    const result = await db.query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id, created_at`,
      [req.params.id, role, encrypted]
    );

    await db.query(
      `UPDATE conversations SET updated_at=NOW(), messages_count=messages_count+1 WHERE id=$1`,
      [req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[conversations POST /:id/messages]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/conversations/:id/generate-title
router.post('/:id/generate-title', async (req, res) => {
  try {
    const firstMsg = await db.query(`
      SELECT content FROM messages
      WHERE conversation_id=$1 AND role='user'
      ORDER BY created_at ASC LIMIT 1
    `, [req.params.id]);

    if (!firstMsg.rows.length) return res.json({ title: 'Новый разговор' });

    const firstContent = await decryptText(firstMsg.rows[0].content);

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [{
          role: 'user',
          content: `Придумай короткое название (3-5 слов, без кавычек) для психологической сессии: "${firstContent.slice(0, 150)}". Только название.`
        }],
        max_tokens: 15,
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim() || 'Разговор';

    await db.query('UPDATE conversations SET title=$1 WHERE id=$2', [title, req.params.id]);
    res.json({ title });
  } catch (err) {
    console.error('[generate-title]', err);
    res.json({ title: 'Новый разговор' });
  }
});

module.exports = router;
