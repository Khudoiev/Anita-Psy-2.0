const MAX_TOKENS = 8000;
const CHARS_PER_TOKEN = 4;

function buildContextWindow(messages, systemPrompt) {
  const systemTokens = Math.ceil((systemPrompt || '').length / CHARS_PER_TOKEN);
  let budget = MAX_TOKENS - systemTokens - 500;

  const result = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = Math.ceil((messages[i].content?.length || 0) / CHARS_PER_TOKEN);
    if (budget - msgTokens < 0) break;
    result.unshift({ role: messages[i].role, content: messages[i].content });
    budget -= msgTokens;
  }

  return systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...result]
    : result;
}

module.exports = { buildContextWindow };
