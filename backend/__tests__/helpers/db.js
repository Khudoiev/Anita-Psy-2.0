/**
 * backend/__tests__/helpers/db.js
 * Хелперы для тестовой БД: создание, очистка, seed данных.
 */

const db = require('../../db');

/**
 * Очищает все данные из таблиц в правильном порядке (с учётом CASCADE).
 * НЕ удаляет таблицы — только строки.
 */
async function cleanDatabase() {
  await db.query(`
    TRUNCATE TABLE
      technique_outcomes,
      crisis_events,
      messages,
      conversations,
      chat_messages,
      user_chats,
      user_memory,
      user_consent,
      token_usage,
      message_quota,
      sessions,
      password_reset_requests,
      admin_logs,
      users,
      invites,
      admins,
      prompt_suggestions,
      ip_blacklist
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Создаёт тестовый инвайт.
 * @param {object} opts
 * @returns {Promise<{id: string, token: string}>}
 */
async function createTestInvite(opts = {}) {
  const token = opts.token || 'test-invite-token-' + Math.random().toString(36).slice(2);
  const res = await db.query(
    `INSERT INTO invites (token, label, max_uses, is_active)
     VALUES ($1, $2, $3, $4) RETURNING id, token`,
    [token, opts.label || 'Test Invite', opts.maxUses || 10, opts.isActive !== false]
  );
  return res.rows[0];
}

/**
 * Создаёт тестового пользователя напрямую в БД (минуя invite flow).
 * @returns {Promise<{id: string, sessionToken: string, jwt: string}>}
 */
async function createTestUser(opts = {}) {
  const { v4: uuidv4 } = require('uuid');
  const crypto = require('crypto');
  const jwt = require('jsonwebtoken');

  const inviteRes = await db.query(
    `INSERT INTO invites (token, max_uses, is_active)
     VALUES ($1, 999, true) RETURNING id`,
    ['invite-for-test-' + Math.random().toString(36).slice(2)]
  );
  const inviteId = inviteRes.rows[0].id;
  const sessionToken = crypto.randomBytes(32).toString('hex');

  const userRes = await db.query(
    `INSERT INTO users (invite_id, session_token, ip) VALUES ($1, $2, '127.0.0.1') RETURNING id`,
    [inviteId, sessionToken]
  );
  const userId = userRes.rows[0].id;

  if (opts.registered) {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(opts.password || 'TestPassword123', 10);
    await db.query(
      `UPDATE users SET username=$1, password_hash=$2, registered_at=NOW()
       WHERE id=$3`,
      [opts.username || 'testuser_' + Math.random().toString(36).slice(2, 8), hash, userId]
    );
  }

  const token = jwt.sign(
    { userId, role: 'user', registered: !!opts.registered },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );

  return { id: userId, sessionToken, token };
}

/**
 * Создаёт тестового администратора.
 * @returns {Promise<{id: string, jwt: string}>}
 */
async function createTestAdmin(opts = {}) {
  const bcrypt = require('bcrypt');
  const jwt = require('jsonwebtoken');

  const hash = await bcrypt.hash(opts.password || 'AdminPassword123', 10);
  const res = await db.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id`,
    [opts.username || 'admin_' + Math.random().toString(36).slice(2, 8), hash]
  );
  const adminId = res.rows[0].id;

  const token = jwt.sign(
    { adminId, role: 'admin' },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );

  return { id: adminId, token };
}

module.exports = { cleanDatabase, createTestInvite, createTestUser, createTestAdmin };
