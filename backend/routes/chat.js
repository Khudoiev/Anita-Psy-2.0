const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../services/logger');
const { requireAuth } = require('../middleware/requireAuth');
const { buildSystemPrompt, MEMORY_EXTRACT_PROMPT } = require('../prompts/anita');
const { buildContextWindow } = require('../services/contextManager');
const { parseProfileBackground } = require('../services/profileParser');

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const DAILY_LIMIT = parseInt(process.env.DAILY_MESSAGE_LIMIT) || 100;

async function checkAndIncrementQuota(userId, res) {
  const checkRes = await db.query(
    'SELECT count FROM message_quota WHERE user_id=$1 AND date=CURRENT_DATE',
    [userId]
  );
  const used = checkRes.rows[0]?.count || 0;
  if (used >= DAILY_LIMIT) {
    res.status(429).json({
      error: 'daily_limit_exceeded',
      message: `Дневной лимит ${DAILY_LIMIT} сообщений достигнут. Возвращайся завтра.`,
      limit: DAILY_LIMIT,
      used,
    });
    return false;
  }
  await db.query(`
    INSERT INTO message_quota (user_id, date, count) VALUES ($1, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date) DO UPDATE SET count = message_quota.count + 1
  `, [userId]);
  res.setHeader('X-Quota-Used', used + 1);
  res.setHeader('X-Quota-Limit', DAILY_LIMIT);
  res.setHeader('X-Quota-Remaining', Math.max(0, DAILY_LIMIT - used - 1));
  return true;
}

// POST /api/chat
router.post('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });

  const { messages, conversationId } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Неверный формат сообщений' });
  }

  const userId = req.user.userId;

  try {
    const ok = await checkAndIncrementQuota(userId, res);
    if (!ok) return;
  } catch (err) {
    console.error('[Quota Error]', err);
    return res.status(500).json({ error: 'Ошибка проверки квоты' });
  }

  try {
    // Background profile parsing (mood and onboarding)
    parseProfileBackground(userId, messages).catch(e => console.error(e));

    const systemPrompt = await buildSystemPrompt(userId);
    const contextMessages = await buildContextWindow(messages, systemPrompt, userId);

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || 'grok-3-mini-fast',
        messages: contextMessages,
        temperature: 0.9,
        top_p: 0.95,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      logger.error({ status: response.status, errData, userId }, 'xAI API Error');
      return res.status(502).json({ error: 'Ошибка AI сервиса', details: errData });
    }

    const data = await response.json();

    // Track token usage if available
    if (data.usage && conversationId) {
      const { trackTokenUsage } = require('../services/tokenTracker');
      await trackTokenUsage(userId, data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0);
    }

    return res.json(data);
  } catch (err) {
    logger.error({ err, userId, conversationId }, 'Chat Request Error');
    return res.status(500).json({ error: 'Ошибка сервера при обращении к AI' });
  }
});

// POST /api/chat/stream — SSE streaming
router.post('/stream', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Forbidden' });

  const { messages, conversationId } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Неверный формат сообщений' });
  }

  const userId = req.user.userId;

  try {
    const ok = await checkAndIncrementQuota(userId, res);
    if (!ok) return;
  } catch (err) {
    console.error('[Quota Error]', err);
    return res.status(500).json({ error: 'Ошибка проверки квоты' });
  }

  let systemPrompt;
  try {
    systemPrompt = await buildSystemPrompt(userId);
  } catch (err) {
    systemPrompt = '';
  }

  // Crisis detection
  const { checkAndLogCrisis } = require('../services/safetyChecker');
  const lastUserMessage = messages.filter(m => m.role === 'user').at(-1)?.content || '';
  const { isCrisis, systemInjection } = await checkAndLogCrisis(lastUserMessage, userId, conversationId);
  if (isCrisis) systemPrompt += systemInjection;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Background profile parsing (mood and onboarding)
  parseProfileBackground(userId, messages).catch(e => console.error(e));

  const contextMessages = await buildContextWindow(messages, systemPrompt, userId);

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || 'grok-3-mini-fast',
        messages: contextMessages,
        temperature: 0.9,
        max_tokens: 900,
        stream: true,
      }),
    });

    if (!response.ok) {
      res.write(`data: ${JSON.stringify({ error: 'AI_ERROR' })}\n\n`);
      return res.end();
    }

    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of response.body) {
      const lines = Buffer.from(chunk).toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          if (conversationId) {
            const { detectAndSaveTechniques } = require('../services/techniqueTracker');
            await detectAndSaveTechniques(fullContent, conversationId, Math.ceil(messages.length / 2));
          }
          const { trackTokenUsage } = require('../services/tokenTracker');
          await trackTokenUsage(userId, promptTokens, completionTokens);
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            fullContent += token;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
          if (parsed.usage) {
            promptTokens = parsed.usage.prompt_tokens || 0;
            completionTokens = parsed.usage.completion_tokens || 0;
          }
        } catch {}
      }
    }
    res.end();
  } catch (err) {
    logger.error({ err, userId, conversationId }, 'Chat Stream Error');
    res.write(`data: ${JSON.stringify({ error: 'SERVER_ERROR' })}\n\n`);
    res.end();
  }
});

// POST /api/chat/extract-memory
router.post('/extract-memory', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Forbidden' });

  const { dialog } = req.body;
  if (!dialog) return res.status(400).json({ error: 'No dialog provided' });

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || 'grok-3-mini-fast',
        messages: [
          { role: 'system', content: MEMORY_EXTRACT_PROMPT },
          { role: 'user', content: 'Вот диалог:\n\n' + dialog },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!response.ok) return res.status(502).json({ error: 'AI error' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Extract Memory Error]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/chat/quota
router.get('/quota', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  try {
    const result = await db.query(
      'SELECT count FROM message_quota WHERE user_id = $1 AND date = CURRENT_DATE',
      [req.user.userId]
    );
    const used = result.rows[0]?.count || 0;
    res.json({ used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
