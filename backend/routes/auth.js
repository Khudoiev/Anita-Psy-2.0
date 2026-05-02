/**
 * backend/routes/auth.js — обновлённая версия
 *
 * Новые эндпоинты:
 *   POST /api/auth/register      — регистрация после первого чата
 *   POST /api/auth/login         — вход по username + пароль
 *   POST /api/auth/reset-request — запрос восстановления пароля
 *   POST /api/auth/reset-password— смена пароля по токену (от админа)
 *
 * Существующие — без изменений:
 *   POST /api/auth/join          — первый вход по инвайт-ссылке
 *   POST /api/auth/admin/login
 *   POST /api/sessions/start|heartbeat|end|ping
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

// ── Хелперы ──────────────────────────────────────────────────

const getGeoAndDevice = (req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim().replace(/^::ffff:/, '');
  const geo = geoip.lookup(ip) || {};
  const parser = new UAParser(req.headers['user-agent'] || '');
  const browser = parser.getBrowser().name || 'Unknown';
  let deviceType = parser.getDevice().type || 'desktop';
  if (!['mobile','tablet','desktop'].includes(deviceType)) {
    deviceType = parser.getDevice().model ? 'mobile' : 'desktop';
  }
  let countryName = geo.country;
  if (geo.country) {
    try { countryName = regionNames.of(geo.country); } catch(e) {}
  }
  return { ip, country: countryName, country_code: geo.country, city: geo.city,
           user_agent: req.headers['user-agent'], deviceType, browser };
};

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

// ══════════════════════════════════════════════════════════════
// POST /api/auth/join  — первый вход по инвайт-ссылке
// Создаёт анонимного пользователя (без логина/пароля)
// ══════════════════════════════════════════════════════════════
router.post('/auth/join', async (req, res) => {
  const token = req.body.token || req.query.token || req.query.invite;
  if (!token) return res.status(400).json({ error: 'Токен не передан' });

  try {
    await db.query('BEGIN');
    const inviteRes = await db.query(
      `SELECT * FROM invites
       WHERE token = $1 AND is_active = true
         AND uses_count < max_uses
         AND (expires_at IS NULL OR expires_at > NOW() AT TIME ZONE 'UTC')
       FOR UPDATE`,
      [token]
    );
    if (inviteRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Ссылка недействительна или устарела' });
    }
    const invite = inviteRes.rows[0];
    const { ip, country, country_code, city, user_agent, deviceType, browser } = getGeoAndDevice(req);
    const sessionToken = crypto.randomBytes(32).toString('hex');

    const userRes = await db.query(
      `INSERT INTO users
         (invite_id, session_token, ip, country, country_code, city, user_agent, device_type, browser)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [invite.id, sessionToken, ip, country, country_code, city, user_agent, deviceType, browser]
    );
    const userId = userRes.rows[0].id;
    await db.query('UPDATE invites SET uses_count = uses_count + 1 WHERE id = $1', [invite.id]);
    await db.query('COMMIT');

    const jwtToken = jwt.sign({ userId, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    // isRegistered: false — фронт покажет предложение зарегистрироваться
    res.json({ token: jwtToken, isRegistered: false });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error('[join]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/register  — регистрация (после первого чата)
// Привязывает username + пароль к существующему user_id из JWT
// ══════════════════════════════════════════════════════════════
router.post('/auth/register', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });

  const { username, password, secretQuestion, secretAnswer } = req.body;

  // Валидация
  if (!username || !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username: 3–30 символов, только латиница, цифры и _' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Пароль минимум 8 символов' });
  }
  if (!secretQuestion || !secretAnswer || secretAnswer.trim().length < 2) {
    return res.status(400).json({ error: 'Укажи секретный вопрос и ответ' });
  }

  try {
    // Проверяем что этот user ещё не зарегистрирован
    const existing = await db.query(
      'SELECT username, registered_at FROM users WHERE id = $1', [req.user.userId]
    );
    if (existing.rows[0]?.registered_at) {
      return res.status(409).json({ error: 'Аккаунт уже зарегистрирован' });
    }

    // Проверяем уникальность username
    const taken = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (taken.rows.length > 0) {
      return res.status(409).json({ error: 'Этот username уже занят' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const answerHash   = await bcrypt.hash(secretAnswer.trim().toLowerCase(), 10);

    await db.query(
      `UPDATE users SET
         username = $1,
         password_hash = $2,
         secret_question = $3,
         secret_answer = $4,
         registered_at = NOW(),
         last_login_at = NOW()
       WHERE id = $5`,
      [username, passwordHash, secretQuestion, answerHash, req.user.userId]
    );

    // Выдаём новый JWT с пометкой isRegistered
    const newToken = jwt.sign(
      { userId: req.user.userId, role: 'user', registered: true },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token: newToken, username, message: 'Аккаунт создан. Запомни свой username и пароль — восстановление только через администратора.' });

  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/login  — вход по username + пароль
// ══════════════════════════════════════════════════════════════
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Укажи username и пароль' });
  }

  try {
    const result = await db.query(
      `SELECT id, username, password_hash, is_blocked, registered_at FROM users WHERE username = $1`,
      [username]
    );
    if (result.rows.length === 0) {
      // Не раскрываем существует ли username
      return res.status(401).json({ error: 'Неверный username или пароль' });
    }
    const user = result.rows[0];
    if (!user.registered_at || !user.password_hash) {
      return res.status(401).json({ error: 'Аккаунт не зарегистрирован' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Аккаунт заблокирован. Обратись к администратору.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Неверный username или пароль' });
    }

    // Обновляем гео и last_login
    const { ip, country, country_code, city, deviceType, browser, user_agent } = getGeoAndDevice(req);
    await db.query(
      `UPDATE users SET
         last_login_at = NOW(),
         last_seen = NOW(),
         ip = $2, country = COALESCE($3, country),
         country_code = COALESCE($4, country_code),
         city = COALESCE($5, city),
         device_type = $6, browser = $7, user_agent = $8
       WHERE id = $1`,
      [user.id, ip, country, country_code, city, deviceType, browser, user_agent]
    );

    const token = jwt.sign(
      { userId: user.id, role: 'user', registered: true },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, username: user.username });

  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/reset-request  — запрос сброса пароля
// Создаёт запись в БД, админ видит в панели
// ══════════════════════════════════════════════════════════════
router.post('/auth/reset-request', async (req, res) => {
  const { username, contactHint, reason } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Укажи username' });
  }

  try {
    // Найти user_id (не раскрываем существует ли юзер — всегда 200)
    const userRes = await db.query(
      'SELECT id FROM users WHERE username = $1 AND registered_at IS NOT NULL', [username.trim()]
    );
    const userId = userRes.rows[0]?.id || null;

    await db.query(
      `INSERT INTO password_reset_requests (user_id, username, contact_hint, reason)
       VALUES ($1, $2, $3, $4)`,
      [userId, username.trim(), contactHint || null, reason || null]
    );

    // Всегда один и тот же ответ — не раскрываем есть ли такой юзер
    res.json({ message: 'Запрос отправлен. Администратор рассмотрит его и свяжется с тобой.' });

  } catch (err) {
    console.error('[reset-request]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/reset-password  — смена пароля по токену
// Токен одноразовый, живёт 1 час, генерит админ
// ══════════════════════════════════════════════════════════════
router.post('/auth/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Токен и новый пароль (мин. 8 символов) обязательны' });
  }

  try {
    const reqRes = await db.query(
      `SELECT id, user_id, status, token_expires_at FROM password_reset_requests
       WHERE reset_token = $1`,
      [resetToken]
    );
    if (reqRes.rows.length === 0) {
      return res.status(400).json({ error: 'Токен недействителен' });
    }
    const resetReq = reqRes.rows[0];
    if (resetReq.status !== 'approved') {
      return res.status(400).json({ error: 'Токен недействителен или уже использован' });
    }
    if (new Date() > new Date(resetReq.token_expires_at)) {
      return res.status(400).json({ error: 'Срок действия токена истёк. Создай новый запрос.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetReq.user_id]);
    await db.query(
      `UPDATE password_reset_requests SET status = 'used', resolved_at = NOW() WHERE id = $1`,
      [resetReq.id]
    );

    res.json({ message: 'Пароль успешно изменён. Можешь войти.' });

  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ══════════════════════════════════════════════════════════════
// DELETE /api/auth/me  — удалить все свои данные (GDPR-like)
// ══════════════════════════════════════════════════════════════
router.delete('/auth/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  try {
    // CASCADE удалит user_memory, user_chats, chat_messages, sessions
    await db.query('DELETE FROM users WHERE id = $1', [req.user.userId]);
    res.json({ message: 'Все твои данные удалены.' });
  } catch (err) {
    console.error('[delete-me]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/auth/admin/login
// ══════════════════════════════════════════════════════════════
router.post('/auth/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const adminRes = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (adminRes.rows.length === 0) return res.status(401).json({ error: 'Неверные данные' });
    const admin = adminRes.rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: 'Неверные данные' });
    const token = jwt.sign({ adminId: admin.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (err) {
    console.error('[admin/login error]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/auth/save-consent
router.post('/auth/save-consent', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Только для пользователей' });
  const { termsVersion, dataProcessing, aiImprovement } = req.body;
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim();

  try {
    await db.query(`
      INSERT INTO user_consent
        (user_id, terms_version, data_processing, ai_improvement, ip_at_acceptance)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        terms_version=$2, data_processing=$3, ai_improvement=$4, accepted_at=NOW()
    `, [req.user.userId, termsVersion, dataProcessing, aiImprovement, ip]);

    res.json({ success: true });
  } catch (err) {
    console.error('[save-consent]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/auth/me — текущий авторизованный пользователь
router.get('/auth/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await db.query(
      'SELECT id, username, registered_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Не найден' });
    res.json({ username: result.rows[0].username });
  } catch (err) {
    console.error('[GET /auth/me]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
