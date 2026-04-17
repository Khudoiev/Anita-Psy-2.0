const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const DAILY_LIMIT = parseInt(process.env.DAILY_MESSAGE_LIMIT) || 100;

// POST /api/chat
router.post('/', requireAuth, async (req, res) => {
  // Ensure it's a regular user
  if (req.user.role !== 'user') {
    return res.status(403).json({ error: 'Только для пользователей' });
  }

  const { messages, system } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Неверный формат сообщений' });
  }

  const userId = req.user.userId;

  // ── ПРОВЕРКА И ОБНОВЛЕНИЕ КВОТЫ ──
  try {
    // Upsert счётчика за сегодня
    const quotaRes = await db.query(`
      INSERT INTO message_quota (user_id, date, count)
      VALUES ($1, CURRENT_DATE, 1)
      ON CONFLICT (user_id, date)
      DO UPDATE SET count = message_quota.count + 1
      RETURNING count
    `, [userId]);

    const currentCount = quotaRes.rows[0].count;

    if (currentCount > DAILY_LIMIT) {
      return res.status(429).json({
        error: 'daily_limit_exceeded',
        message: `Достигнут дневной лимит сообщений (${DAILY_LIMIT}). Возвращайся завтра.`,
        limit: DAILY_LIMIT,
        used: currentCount - 1
      });
    }

    // Добавить заголовки с остатком квоты
    res.setHeader('X-Quota-Used', currentCount);
    res.setHeader('X-Quota-Limit', DAILY_LIMIT);
    res.setHeader('X-Quota-Remaining', Math.max(0, DAILY_LIMIT - currentCount));

  } catch (err) {
    console.error('[Quota Error]', err);
    return res.status(500).json({ error: 'Ошибка проверки квоты' });
  }

  // ── ПРОКСИ ЗАПРОС К xAI (Grok) ──
  try {
    const apiMessages = system
      ? [{ role: 'system', content: system }, ...messages]
      : messages;

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || 'grok-3-mini-fast',
        messages: apiMessages,
        temperature: 0.9,
        top_p: 0.95,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[xAI API Error]', response.status, errData);
      return res.status(502).json({ error: 'Ошибка AI сервиса', details: errData });
    }

    const data = await response.json();
    return res.json(data);

  } catch (err) {
    console.error('[Proxy Error]', err);
    return res.status(500).json({ error: 'Ошибка сервера при обращении к AI' });
  }
});

// GET /api/chat/quota — узнать остаток квоты
router.get('/quota', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ error: 'Только для пользователей' });
  }

  try {
    const result = await db.query(
      'SELECT count FROM message_quota WHERE user_id = $1 AND date = CURRENT_DATE',
      [req.user.userId]
    );
    const used = result.rows[0]?.count || 0;
    res.json({
      used,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - used)
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
