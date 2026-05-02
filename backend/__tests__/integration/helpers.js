require('dotenv').config({ path: require('path').join(__dirname, '../../../.env.local') });
require('dotenv').config();
process.env.JWT_SECRET    = process.env.JWT_SECRET    || 'test-jwt-secret';
process.env.DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || 'ci-test-encryption-key-32-chars-!';

const request = require('supertest');
const app     = require('../../app');
const db      = require('../../db');
const jwt     = require('jsonwebtoken');

async function cleanIntegrationData() {
  await db.query(`
    DELETE FROM users WHERE username LIKE 'inttest_%' OR session_token LIKE 'inttest_%'
  `);
  // Инвайты для тестов
  await db.query(`DELETE FROM invites WHERE label LIKE 'inttest_%'`);
}

async function createTestInvite(label = 'inttest_default') {
  const res = await db.query(
    `INSERT INTO invites (token, label, max_uses, is_active)
     VALUES ($1, $2, 100, true) RETURNING id, token`,
    [require('crypto').randomBytes(16).toString('hex'), label]
  );
  return res.rows[0];
}

async function joinWithInvite(token) {
  const res = await request(app)
    .post('/api/auth/join')
    .send({ token });
  return res;
}

async function registerUser(authToken, username, password = 'TestPass123!') {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ username, password, secretQuestion: 'test', secretAnswer: 'test' });
  return res;
}

async function loginUser(username, password = 'TestPass123!') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password });
  return res;
}

module.exports = { cleanIntegrationData, createTestInvite, joinWithInvite, registerUser, loginUser, request, app, db };
