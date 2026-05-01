const cron = require('node-cron');
const db = require('./db');
const logger = require('./services/logger');
const { generateImprovementSuggestions } = require('./services/promptEvolution');
const { updateTechniqueOutcome } = require('./services/techniqueTracker');

async function cleanupExpiredMessages() {
  try {
    const res = await db.query('DELETE FROM messages WHERE expires_at < NOW()');
    if (res.rowCount > 0) {
      logger.info({ deleted: res.rowCount }, '[Cron] Expired messages cleaned up');
    }
  } catch (err) {
    logger.error({ err: err.message }, '[Cron] Message cleanup failed');
  }
}

async function refreshViews() {
  try {
    await db.query('REFRESH MATERIALIZED VIEW technique_stats');
    logger.debug('[Cron] Materialized views refreshed');
  } catch (err) {
    logger.error({ err: err.message }, '[Cron] View refresh failed');
  }
}

async function cleanupOldSessions() {
  try {
    const res = await db.query(`
      UPDATE sessions
      SET is_active = false, ended_at = NOW()
      WHERE is_active = true AND last_heartbeat < NOW() - INTERVAL '24 hours'
    `);
    if (res.rowCount > 0) {
      logger.info({ updated: res.rowCount }, '[Cron] Stale sessions closed');
    }
  } catch (err) {
    logger.error({ err: err.message }, '[Cron] Session cleanup failed');
  }
}

async function markChurnedConversations() {
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
    if (churned.rows.length > 0) {
      logger.info({ marked: churned.rows.length }, '[Cron] Churned conversations marked');
    }
  } catch (err) {
    logger.error({ err: err.message }, '[Cron] Churn marking failed');
  }
}

async function generatePromptSuggestions() {
  try {
    const suggestions = await generateImprovementSuggestions();
    logger.info({ count: suggestions.length }, '[Cron] Improvement suggestions generated');
  } catch (err) {
    logger.error({ err: err.message }, '[Cron] Suggestion generation failed');
  }
}

// Initial runs on startup
cleanupExpiredMessages();
refreshViews();
cleanupOldSessions();

// ─── Schedule ─────────────────────────────────────────────────────────────────
cron.schedule('0 3 * * *',   cleanupExpiredMessages);    // daily   03:00
cron.schedule('*/10 * * * *', refreshViews);             // every   10 min
cron.schedule('0 * * * *',   cleanupOldSessions);        // hourly
cron.schedule('0 4 * * *',   markChurnedConversations);  // daily   04:00
cron.schedule('0 5 * * 0',   generatePromptSuggestions); // weekly  Sun 05:00

logger.info('[Cron] All tasks scheduled');
