const db = require('./db');
const logger = require('./services/logger');

// Run every hour
const HOURLY = 60 * 60 * 1000;
// Run every 10 minutes
const TEN_MIN = 10 * 60 * 1000;

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
    // Mark sessions as inactive if no heartbeat for 24 hours
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

// Initial run
cleanupExpiredMessages();
refreshViews();
cleanupOldSessions();

// Schedule
setInterval(cleanupExpiredMessages, HOURLY);
setInterval(refreshViews, TEN_MIN);
setInterval(cleanupOldSessions, HOURLY);

logger.info('[Cron] Tasks scheduled and running');
