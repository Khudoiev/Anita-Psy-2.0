const { getProfile } = require('./memoryService');

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

  let profileBlock = '';
  if (userId) {
    const profile = await getProfile(userId);
    if (profile && (profile.is_onboarded || profile.name || (profile.core_issues && profile.core_issues.length > 0))) {
      profileBlock = `ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:\n` +
        `Имя: ${profile.name || 'не указано'}\n` +
        `Основные проблемы: ${profile.core_issues?.join(', ') || 'нет'}\n` +
        `Триггеры: ${profile.triggers?.join(', ') || 'нет'}\n` +
        `Прогресс: ${profile.progress || 'нет'}\n` +
        `Предпочитаемые техники: ${profile.preferred_techniques?.join(', ') || 'нет'}`;
    }
  }

  const contextMessages = [];
  if (systemPrompt) contextMessages.push({ role: 'system', content: systemPrompt });
  if (profileBlock) contextMessages.push({ role: 'system', content: profileBlock });
  
  return [...contextMessages, ...result];
}

module.exports = { buildContextWindow };
