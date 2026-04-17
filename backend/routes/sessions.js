const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/requireAuth');
const logAdminAction = require('../utils/adminLog');

router.use(requireAdmin);

// Block 1 - Геолокация
router.get('/geo', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        country, country_code,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '2 minutes' AND is_blocked = false) as online
      FROM users
      WHERE country IS NOT NULL
      GROUP BY country, country_code
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'GEO Error' }); }
});

// Block 2 - Аналитика
router.get('/analytics/hourly', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM started_at) as hour,
        COUNT(*) as sessions_count,
        ROUND(AVG(messages_count), 1) as avg_messages
      FROM sessions
      WHERE started_at > NOW() - INTERVAL '7 days'
      GROUP BY hour
      ORDER BY hour
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Hourly Error' }); }
});

router.get('/analytics/retention', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(DISTINCT u.id) FILTER (WHERE (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) > 1) as returned_day1,
        COUNT(DISTINCT u.id) as total
      FROM users u
      WHERE u.first_seen > NOW() - INTERVAL '30 days'
    `);
    res.json(result.rows[0] || { returned_day1: 0, total: 0 });
  } catch (err) { res.status(500).json({ error: 'Retention Error' }); }
});

router.get('/analytics/invites', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        i.label,
        i.token,
        COUNT(u.id) as total_users,
        ROUND(AVG(sub.session_count), 2) as avg_sessions_per_user,
        ROUND(AVG(sub.total_messages), 2) as avg_messages_per_user
      FROM invites i
      LEFT JOIN users u ON u.invite_id = i.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as session_count, SUM(messages_count) as total_messages
        FROM sessions GROUP BY user_id
      ) sub ON sub.user_id = u.id
      GROUP BY i.id, i.label, i.token
      ORDER BY total_users DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Invites Metrics Error' }); }
});


// Статистика сессий (существующий)
router.get('/stats', async (req, res) => {
  try {
    const onlineResult = await db.query("SELECT COUNT(*) FROM users WHERE last_seen > NOW() - INTERVAL '2 minutes' AND is_blocked = false");
    const todayResult = await db.query("SELECT COUNT(DISTINCT user_id) FROM sessions WHERE started_at >= current_date");
    const totalUsersResult = await db.query("SELECT COUNT(*) FROM users");
    const durationResult = await db.query("SELECT COALESCE(SUM(duration_seconds), 0) as total_sec, AVG(duration_seconds) as avg_sec FROM sessions");

    res.json({
      onlineNow: parseInt(onlineResult.rows[0].count),
      todayUsers: parseInt(todayResult.rows[0].count),
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      avgSessionMinutes: Math.round((durationResult.rows[0].avg_sec || 0) / 60),
      totalHours: Math.round((durationResult.rows[0].total_sec || 0) / 3600)
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Экспорт пользователей
router.get('/users/export', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, u.country, u.city, u.device_type as device, u.browser, 
        u.first_seen, u.last_seen, 
        COUNT(s.id) as total_sessions, 
        COALESCE(SUM(s.messages_count),0) as total_messages, 
        u.is_blocked, i.label as invite_label, 
        REPLACE(REPLACE(COALESCE(u.admin_note, ''), E'\n', ' '), ',', ';') as note -- Эскейп запятых
      FROM users u
      LEFT JOIN invites i ON u.invite_id = i.id
      LEFT JOIN sessions s ON u.id = s.user_id
      GROUP BY u.id, i.label
      ORDER BY u.first_seen DESC
    `;
    const result = await db.query(query);
    
    let csv = "ID,Country,City,Device,Browser,First Seen,Last Seen,Total Sessions,Total Messages,Blocked,Invite,Note\n";
    result.rows.forEach(r => {
      csv += `${r.id},${r.country||''},${r.city||''},${r.device||''},${r.browser||''},${r.first_seen.toISOString()},${r.last_seen.toISOString()},${r.total_sessions},${r.total_messages},${r.is_blocked},${r.invite_label||''},${r.note}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
    await logAdminAction(req.user.adminId, 'export_users', 'users', 'all');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка экспорта CSV' });
  }
});

// GET users
router.get('/users', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id, u.nickname, u.ip, u.country, u.country_code, u.city, u.device_type, u.browser,
        u.first_seen as "firstSeen", u.last_seen as "lastSeen", u.is_blocked as "isBlocked",
        u.admin_note,
        i.label as "inviteLabel",
        COUNT(s.id) as "totalSessions",
        COALESCE(SUM(s.duration_seconds), 0) / 3600.0 as "totalHours",
        u.last_seen > NOW() - INTERVAL '2 minutes' as "isOnline"
      FROM users u
      LEFT JOIN invites i ON u.invite_id = i.id
      LEFT JOIN sessions s ON u.id = s.user_id
      GROUP BY u.id, i.label
      ORDER BY u.last_seen DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// GET users/:id/sessions
router.get('/users/:id/sessions', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, started_at, ended_at, duration_seconds, messages_count, is_active
      FROM sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50
    `, [req.params.id]);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: 'Sessions list error' }); }
});

router.patch('/users/:id/note', async (req, res) => {
  try {
    const { note } = req.body;
    await db.query('UPDATE users SET admin_note = $1 WHERE id = $2', [note, req.params.id]);
    await logAdminAction(req.user.adminId, 'update_user_note', 'user', req.params.id, { note });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сохранения заметки' }); }
});

router.patch('/users/:id/block', async (req, res) => {
  try {
    const result = await db.query('UPDATE users SET is_blocked = NOT is_blocked WHERE id = $1 RETURNING is_blocked', [req.params.id]);
    const blocked = result.rows[0].is_blocked;
    await logAdminAction(req.user.adminId, blocked ? 'block_user' : 'unblock_user', 'user', req.params.id, { is_blocked: blocked });
    res.json({ is_blocked: blocked });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Blacklist IP
router.get('/blacklist', async (req, res) => {
  try {
    const result = await db.query('SELECT b.id, b.ip, b.reason, b.created_at, a.username as admin FROM ip_blacklist b LEFT JOIN admins a ON b.created_by = a.id ORDER BY b.created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'List blacklist err' }); }
});

router.post('/blacklist', async (req, res) => {
  try {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: 'IP Required' });
    const result = await db.query('INSERT INTO ip_blacklist (ip, reason, created_by) VALUES ($1, $2, $3) ON CONFLICT (ip) DO NOTHING RETURNING id', [ip, reason, req.user.adminId]);
    await logAdminAction(req.user.adminId, 'blacklist_ip', 'ip', ip, { reason });
    res.json({ success: true, id: result.rows.length ? result.rows[0].id : null });
  } catch (err) { res.status(500).json({ error: 'Add blacklist err' }); }
});

router.delete('/blacklist/:id', async (req, res) => {
  try {
    const getIp = await db.query('SELECT ip FROM ip_blacklist WHERE id = $1', [req.params.id]);
    if (getIp.rows.length) {
      await db.query('DELETE FROM ip_blacklist WHERE id = $1', [req.params.id]);
      await logAdminAction(req.user.adminId, 'unblacklist_ip', 'ip', getIp.rows[0].ip);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete err' }); }
});

// Admin Logs
router.get('/logs', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at, a.username as admin
      FROM admin_logs l LEFT JOIN admins a ON l.admin_id = a.id
      ORDER BY l.created_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// GET /api/admin/quota-stats
router.get('/quota-stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        AVG(count)::float                                   as avg_messages_per_user,
        MAX(count)                                          as max_messages_today,
        COUNT(*) FILTER (WHERE count >= $1)                as users_at_limit,
        COALESCE(SUM(count), 0)::int                       as total_messages_today
      FROM message_quota
      WHERE date = CURRENT_DATE
    `, [parseInt(process.env.DAILY_MESSAGE_LIMIT) || 100]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
