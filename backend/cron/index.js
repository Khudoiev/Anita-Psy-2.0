let cron;
try {
  cron = require('node-cron');
} catch (e) {
  console.warn('[Cron] node-cron not installed — skipping cron jobs. Run: npm install node-cron');
  module.exports = {};
  return;
}

const db = require('../db');
const { generateImprovementSuggestions } = require('../services/promptEvolution');
const { updateTechniqueOutcome } = require('../services/techniqueTracker');

// Purge expired messages — daily at 3:00 AM
cron.schedule('0 3 * * *', async () => {
  try {
    const result = await db.query('DELETE FROM messages WHERE expires_at < NOW()');
    console.log(`[Cron] Purged ${result.rowCount} expired messages`);
  } catch (e) {
    console.error('[Cron] Message purge failed:', e.message);
  }
});

// Mark churned conversations — daily at 4:00 AM
cron.schedule('0 4 * * *', async () => {
  try {
    const churned = await db.query(`
      SELECT DISTINCT c.id FROM conversations c
      JOIN technique_outcomes t ON t.conversation_id = c.id
      WHERE t.outcome IS NULL
      AND c.updated_at < NOW() - INTERVAL '7 days'
    `);
    for (const conv of churned.rows) {
      await updateTechniqueOutcome(conv.id, 'user_churned');
    }
    console.log(`[Cron] Marked ${churned.rows.length} churned conversations`);
  } catch (e) {
    console.error('[Cron] Churn marking failed:', e.message);
  }
});

// Generate prompt improvement suggestions — every Sunday at 5:00 AM
cron.schedule('0 5 * * 0', async () => {
  try {
    const suggestions = await generateImprovementSuggestions();
    console.log(`[Cron] Generated ${suggestions.length} improvement suggestions`);
  } catch (e) {
    console.error('[Cron] Suggestion generation failed:', e.message);
  }
});

console.log('[Cron] Scheduled jobs initialized');
module.exports = {};
