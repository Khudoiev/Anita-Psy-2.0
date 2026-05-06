const { getProfile } = require('./memoryService');
const db = require('../db');

const MAX_TOKENS = 8000;
const CHARS_PER_TOKEN = 4;

async function buildContextWindow(messages, systemPrompt, userId) {
  const systemTokens = Math.ceil((systemPrompt || '').length / CHARS_PER_TOKEN);
  let budget = MAX_TOKENS - systemTokens - 500;

  const result = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = Math.ceil((messages[i].content?.length || 0) / CHARS_PER_TOKEN);
    if (budget - msgTokens < 0) break;
    result.unshift({ role: messages[i].role, content: messages[i].content });
    budget -= msgTokens;
  }

  const sessionTurn = messages.filter(m => m.role === 'user').length;

  let profileBlock = '';
  if (userId) {
    const profile = await getProfile(userId);
    const sessionsCountResult = await db.query('SELECT count(*) FROM conversations WHERE user_id = $1', [userId]);
    const sessionsCount = parseInt(sessionsCountResult.rows[0].count, 10);
    const isReturning = sessionsCount > 1;

    let lastSessionSummary = '';
    if (isReturning && profile.session_summaries?.length > 0) {
      const last = profile.session_summaries[profile.session_summaries.length - 1];
      lastSessionSummary = `\nПОСЛЕДНЯЯ СЕССИЯ (${last.date}):\n  Тема: ${last.theme}\n  Ключевой момент: ${last.key_moment}`;
    }

    if (profile) {
      profileBlock =
        `SESSION_TURN: ${sessionTurn}\n` +
        `ВСЕГО СЕССИЙ: ${sessionsCount}\n` +
        `ПОВТОРНЫЙ ВИЗИТ: ${isReturning ? 'ДА' : 'НЕТ (первая сессия)'}\n` +
        `---\n` +
        `ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:\n` +
        `Имя: ${profile.name || 'не указано'}\n` +
        `Основные проблемы: ${profile.core_issues?.join(', ') || 'нет'}\n` +
        `Триггеры: ${profile.triggers?.join(', ') || 'нет'}\n` +
        `Прогресс: ${profile.progress || 'нет'}\n` +
        `Предпочитаемые техники: ${profile.preferred_techniques?.join(', ') || 'нет'}\n` +
        `Последнее настроение: ${profile.mood_history?.at(-1)?.score ?? 'нет данных'}/10` +
        lastSessionSummary;
    }
  }

  const contextMessages = [];
  if (systemPrompt) contextMessages.push({ role: 'system', content: systemPrompt });
  if (profileBlock) contextMessages.push({ role: 'system', content: profileBlock });
  
  return [...contextMessages, ...result];
}

module.exports = { buildContextWindow };
