/**
 * Contract тесты — проверяют что бэкенд возвращает
 * именно тот формат который ожидает фронт (frontend/app.js).
 *
 * Источник правды: frontend/app.js + docs/audit/frontend-api-usage.md
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env.local') });
require('dotenv').config();
process.env.JWT_SECRET        = process.env.JWT_SECRET        || 'test-jwt-secret';
process.env.DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || 'test-encryption-key-32-chars!!';

const request = require('supertest');
const app     = require('../../app');
const db      = require('../../db');
const { schemas, validate } = require('./schemas');
const crypto  = require('crypto');

// ─── Setup ───────────────────────────────────────────────────────────────

let authToken;
let testUsername;
let conversationId;
let sessionId;

const TEST_PREFIX = 'contract_test_';

beforeAll(async () => {
  const token = crypto.randomBytes(16).toString('hex');
  testUsername = `${TEST_PREFIX}${Date.now()}`;

  await db.query(
    `INSERT INTO invites (token, label, max_uses, is_active)
     VALUES ($1, $2, 10, true)`,
    [token, `${TEST_PREFIX}invite`]
  );

  const joinRes = await request(app)
    .post('/api/auth/join').send({ token });
  const guestToken = joinRes.body?.token;

  await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${guestToken}`)
    .send({
      username:       testUsername,
      password:       'ContractTest123!',
      secretQuestion: 'test',
      secretAnswer:   'test',
    });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: testUsername, password: 'ContractTest123!' });

  authToken = loginRes.body?.token;
});

afterAll(async () => {
  await db.query(
    `DELETE FROM users WHERE username LIKE '${TEST_PREFIX}%'`
  );
  await db.query(
    `DELETE FROM invites WHERE label LIKE '${TEST_PREFIX}%'`
  );
});

// ─── AUTH контракты ────────────────────────────────────────────────────────

describe('AUTH — контракт с frontend/auth.html и app.js', () => {

  test('POST /api/auth/login → { token, username } (username обязателен)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: testUsername, password: 'ContractTest123!' });

    expect(res.status).toBe(200);
    expect(() => validate(schemas.loginResponse, res.body)).not.toThrow();
    expect(res.body.username).toBe(testUsername);
  });

  test('GET /api/auth/me → { username } (эндпоинт должен существовать)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(() => validate(schemas.authMeResponse, res.body)).not.toThrow();
  });

  test('POST /api/auth/join → { token }', async () => {
    const token = crypto.randomBytes(16).toString('hex');
    await db.query(
      `INSERT INTO invites (token, label, max_uses, is_active) VALUES ($1, $2, 1, true)`,
      [token, `${TEST_PREFIX}join_test`]
    );

    const res = await request(app)
      .post('/api/auth/join')
      .send({ token });

    expect(res.status).toBe(200);
    expect(() => validate(schemas.joinResponse, res.body)).not.toThrow();
  });
});

// ─── CONVERSATIONS контракты ───────────────────────────────────────────────

describe('CONVERSATIONS — контракт с StorageManager в app.js', () => {

  test('GET /api/conversations → массив (fetchChats)', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(() => validate(schemas.conversationsList, res.body)).not.toThrow();
  });

  test('POST /api/conversations → { id } (createChat)', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Contract Test Chat' });

    expect(res.status).toBe(200);
    expect(() => validate(schemas.createConversation, res.body)).not.toThrow();
    conversationId = res.body.id;
  });

  test('GET /api/conversations/:id → { messages: [] } (fetchMessages)', async () => {
    expect(conversationId).toBeDefined();

    const res = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(() => validate(schemas.conversationDetail, res.body)).not.toThrow();
  });

  test('POST /api/conversations/:id/messages → { id } (saveMessage)', async () => {
    expect(conversationId).toBeDefined();

    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ role: 'user', content: 'Contract test message' });

    expect(res.status).toBe(200);
    expect(() => validate(schemas.saveMessage, res.body)).not.toThrow();
  });
});

// ─── MEMORY контракт ──────────────────────────────────────────────────────

describe('MEMORY — контракт с checkAndShowOnboarding в app.js', () => {

  test('GET /api/conversations/memory → { is_onboarded: boolean } (обязательное поле)', async () => {
    const res = await request(app)
      .get('/api/conversations/memory')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(() => validate(schemas.memoryResponse, res.body)).not.toThrow();
    expect(typeof res.body.is_onboarded).toBe('boolean');
  });
});

// ─── SESSIONS контракт ────────────────────────────────────────────────────

describe('SESSIONS — контракт с startSession/endSession в app.js', () => {

  test('POST /api/sessions/start → { sessionId }', async () => {
    const res = await request(app)
      .post('/api/sessions/start')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ conversationId });

    expect(res.status).toBe(200);
    expect(() => validate(schemas.sessionStart, res.body)).not.toThrow();
    sessionId = res.body.sessionId;
  });

  test('POST /api/sessions/end → { success: true }', async () => {
    const res = await request(app)
      .post('/api/sessions/end')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ sessionId, conversationId });

    expect(res.status).toBe(200);
    expect(() => validate(schemas.sessionEnd, res.body)).not.toThrow();
    expect(res.body.success).toBe(true);
  });
});

// ─── LEGACY API AUDIT ─────────────────────────────────────────────────────

describe('LEGACY — /api/chats совместимость (из frontend-api-usage.md)', () => {

  test('/api/chats существует или /api/conversations используется фронтом', async () => {
    const convRes = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${authToken}`);

    const legacyRes = await request(app)
      .get('/api/chats')
      .set('Authorization', `Bearer ${authToken}`);

    const atLeastOneWorks =
      convRes.status === 200 ||
      (legacyRes.status !== 404 && legacyRes.status !== 500);

    if (!atLeastOneWorks) {
      console.warn(
        '⚠️  LEGACY API AUDIT: фронт вызывает /api/chats которого нет.',
        'Нужна миграция фронта на /api/conversations или алиас в app.js'
      );
    }

    expect(convRes.status).toBe(200);
  });
});
