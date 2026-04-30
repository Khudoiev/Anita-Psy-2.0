const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/requireAuth');
const logAdminAction = require('../utils/adminLog');
const crypto = require('crypto');

// Single-use download tokens: token -> { adminId, expiresAt }
const downloadTokens = new Map();

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

router.get('/analytics/daily', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as sessions_count,
        COUNT(DISTINCT user_id) as dau,
        SUM(messages_count) as total_messages
      FROM sessions
      WHERE started_at > NOW() - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Daily Analytics Error' }); }
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


router.get('/stats', async (req, res) => {
  try {
    // ✅ Считать "онлайн" только тех, у кого был heartbeat в последние 2 минуты
    const onlineResult = await db.query(`
      SELECT COUNT(DISTINCT s.user_id) as count 
      FROM sessions s
      WHERE s.is_active = true 
        AND s.last_heartbeat > NOW() - INTERVAL '2 minutes'
    `);

    const todayResult = await db.query(
      "SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE started_at >= current_date"
    );
    
    const totalUsersResult = await db.query("SELECT COUNT(*) as count FROM users");
    
    const durationResult = await db.query(
      `SELECT 
        COALESCE(SUM(duration_seconds), 0) as total_sec, 
        AVG(duration_seconds) as avg_sec 
       FROM sessions WHERE is_active = false`
    );

    res.json({
      onlineNow: parseInt(onlineResult.rows[0].count),
      todayUsers: parseInt(todayResult.rows[0].count),
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      avgSessionMinutes: Math.round((durationResult.rows[0].avg_sec || 0) / 60),
      totalHours: Math.round((durationResult.rows[0].total_sec || 0) / 3600),
      frontendUrl: process.env.FRONTEND_URL || ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/admin/generate-download-token
router.post('/generate-download-token', async (req, res) => {
  const downloadToken = crypto.randomBytes(16).toString('hex');
  downloadTokens.set(downloadToken, {
    adminId: req.user.adminId,
    expiresAt: Date.now() + 60000,
  });
  // Cleanup expired tokens
  for (const [key, val] of downloadTokens.entries()) {
    if (val.expiresAt < Date.now()) downloadTokens.delete(key);
  }
  res.json({ downloadToken });
});

// Экспорт пользователей
router.get('/users/export', async (req, res) => {
  const dt = req.query.dt;
  if (dt) {
    // Validate single-use download token (bypasses requireAdmin middleware already applied)
    const entry = downloadTokens.get(dt);
    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Токен недействителен или истёк' });
    }
    downloadTokens.delete(dt);
  }
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
        -- ✅ Считать онлайн по активному heartbeat (последние 2 минуты), не по last_seen
        EXISTS(
          SELECT 1 FROM sessions 
          WHERE user_id = u.id AND is_active = true AND last_heartbeat > NOW() - INTERVAL '2 minutes'
        ) as "isOnline"
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

// POST /api/admin/users/:id/temp-ban
router.post('/users/:id/temp-ban', async (req, res) => {
  try {
    const { reason } = req.body;
    await db.query(
      'INSERT INTO temp_bans (user_id, reason, banned_by) VALUES ($1, $2, $3)',
      [req.params.id, reason || null, req.user.adminId]
    );
    await logAdminAction(req.user.adminId, 'temp_ban_user', 'user', req.params.id, { reason });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка бана' });
  }
});

// POST /api/admin/users/:id/unban
// Разбанить и выдать новый инвайт
router.post('/users/:id/unban', async (req, res) => {
  try {
    const { label } = req.body; // подпись для нового инвайта

    // Генерируем новый инвайт для пользователя
    const newToken = crypto.randomBytes(32).toString('hex');
    const inviteRes = await db.query(
      'INSERT INTO invites (token, label, max_uses) VALUES ($1, $2, 1) RETURNING id',
      [newToken, label || 'Повторный доступ', 1]
    );
    const newInviteId = inviteRes.rows[0].id;

    // Закрываем активный бан
    await db.query(
      `UPDATE temp_bans SET unbanned_at = NOW(), new_invite_id = $1
       WHERE user_id = $2 AND unbanned_at IS NULL`,
      [newInviteId, req.params.id]
    );

    await logAdminAction(req.user.adminId, 'unban_user', 'user', req.params.id, { newInviteId });

    // Обратите внимание: URL фронтенда берется из окружения или пустой строки
    const newLink = `${process.env.FRONTEND_URL || req.headers.origin || ''}/auth.html?invite=${newToken}`;
    res.json({ success: true, newLink, inviteId: newInviteId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка разбана' });
  }
});

// ── Token Stats ──────────────────────────────────────────────
router.get('/token-stats', async (req, res) => {
  try {
    const { getDailyTokenStats } = require('../services/tokenTracker');
    const stats = await getDailyTokenStats();
    res.json(stats.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Evolution: Technique Stats ────────────────────────────────
router.get('/evolution/technique-stats', async (req, res) => {
  try {
    await db.query('REFRESH MATERIALIZED VIEW technique_stats');
    const result = await db.query('SELECT * FROM technique_stats ORDER BY success_rate_pct DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/evolution/suggestions', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM prompt_suggestions ORDER BY created_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/evolution/suggestions/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(
      `UPDATE prompt_suggestions
       SET status=$1, approved_by=$2, approved_at=NOW() WHERE id=$3`,
      [status, req.user.adminId, req.params.id]
    );
    await logAdminAction(req.user.adminId, `${status}_suggestion`, 'prompt_suggestion', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/evolution/crisis-events', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT ce.*, u.nickname FROM crisis_events ce
      LEFT JOIN users u ON ce.user_id = u.id
      ORDER BY ce.reviewed_at IS NULL DESC, ce.created_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/evolution/crisis-events/:id/review', async (req, res) => {
  try {
    await db.query(
      `UPDATE crisis_events SET reviewed_by=$1, reviewed_at=NOW() WHERE id=$2`,
      [req.user.adminId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// ─── Поиск по нику / IP / инвайту ───────────────────────────────────────────
router.get('/users/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Минимум 2 символа' });
  }
  try {
    const result = await db.query(`
      SELECT
        u.id, u.nickname, u.ip, u.country, u.country_code,
        u.device_type, u.browser, u.first_seen, u.last_seen,
        u.is_blocked, i.label as "inviteLabel",
        COUNT(s.id) as "totalSessions"
      FROM users u
      LEFT JOIN invites i ON u.invite_id = i.id
      LEFT JOIN sessions s ON u.id = s.user_id
      WHERE u.nickname ILIKE $1 OR u.ip ILIKE $1 OR i.label ILIKE $1
      GROUP BY u.id, i.label
      ORDER BY u.last_seen DESC
      LIMIT 50
    `, [`%${q.trim()}%`]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// ─── Блокировка / разблокировка ─────────────────────────────────────────────
router.patch('/users/:id/block', async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE users SET is_blocked = NOT is_blocked WHERE id=$1 RETURNING id, is_blocked',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Не найден' });

    const { is_blocked } = result.rows[0];
    await logAdminAction(
      req.user.adminId,
      is_blocked ? 'block_user' : 'unblock_user',
      'user', req.params.id, { is_blocked }
    );

    // При блокировке — закрыть активные сессии
    if (is_blocked) {
      await db.query(`
        UPDATE sessions
        SET is_active = false, ended_at = NOW(),
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
        WHERE user_id = $1 AND is_active = true
      `, [req.params.id]);
    }

    res.json({ success: true, is_blocked });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка блокировки' });
  }
});

// ─── Полное удаление (каскадное) ─────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    const userInfo = await db.query(
      'SELECT nickname, ip FROM users WHERE id=$1',
      [req.params.id]
    );
    if (!userInfo.rows.length) return res.status(404).json({ error: 'Не найден' });

    await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);

    await logAdminAction(
      req.user.adminId, 'delete_user', 'user', req.params.id,
      { ...userInfo.rows[0], deleted_at: new Date().toISOString() }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// ─── Сброс активных сессий без удаления аккаунта ────────────────────────────
router.post('/users/:id/reset-sessions', async (req, res) => {
  try {
    const result = await db.query(`
      UPDATE sessions
      SET is_active = false, ended_at = NOW(),
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
      WHERE user_id = $1 AND is_active = true RETURNING id
    `, [req.params.id]);

    await logAdminAction(req.user.adminId, 'reset_sessions', 'user', req.params.id, {
      sessions_closed: result.rowCount,
    });

    res.json({ success: true, sessions_closed: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сброса сессий' });
  }
});

module.exports = router;
