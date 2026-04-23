const db = require('../db');

async function trackTokenUsage(userId, promptTokens, completionTokens, isMemory = false) {
  await db.query(`
    INSERT INTO token_usage (user_id, date, prompt_tokens, completion_tokens, memory_tokens)
    VALUES ($1, CURRENT_DATE, $2, $3, $4)
    ON CONFLICT (user_id, date) DO UPDATE SET
      prompt_tokens      = token_usage.prompt_tokens      + EXCLUDED.prompt_tokens,
      completion_tokens  = token_usage.completion_tokens  + EXCLUDED.completion_tokens,
      memory_tokens      = token_usage.memory_tokens      + EXCLUDED.memory_tokens
  `, [
    userId,
    isMemory ? 0 : (promptTokens || 0),
    isMemory ? 0 : (completionTokens || 0),
    isMemory ? ((promptTokens || 0) + (completionTokens || 0)) : 0,
  ]);
}

async function getDailyTokenStats() {
  return db.query(`
    SELECT
      date,
      SUM(prompt_tokens)     as total_prompt,
      SUM(completion_tokens) as total_completion,
      SUM(memory_tokens)     as total_memory,
      SUM(prompt_tokens + completion_tokens + memory_tokens) as total_all,
      COUNT(DISTINCT user_id) as active_users
    FROM token_usage
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY date
    ORDER BY date DESC
  `);
}

async function getUserTokenToday(userId) {
  const result = await db.query(
    `SELECT prompt_tokens + completion_tokens + memory_tokens as total
     FROM token_usage WHERE user_id=$1 AND date=CURRENT_DATE`,
    [userId]
  );
  return result.rows[0]?.total || 0;
}

module.exports = { trackTokenUsage, getDailyTokenStats, getUserTokenToday };
