require('dotenv').config({ path: require('path').join(__dirname, '../../../.env.local') });
require('dotenv').config();
process.env.JWT_SECRET        = process.env.JWT_SECRET        || 'test-jwt-secret';
process.env.DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || 'test-key-32-chars-exactly-here!!';

const request = require('supertest');
const app     = require('../../app');
const db      = require('../../db');
const crypto  = require('crypto');
const { createTestUser } = require('../helpers/db');

let validUserToken;
let validAdminToken;
let testUserId;
let testAdminId;
const TEST_IP     = '10.99.99.99';
const TEST_PREFIX = 'sec_test_';

beforeAll(async () => {
  // --- Create User ---
  const inviteToken = crypto.randomBytes(16).toString('hex');
  await db.query(
    `INSERT INTO invites (token, label, max_uses, is_active) VALUES ($1, $2, 10, true)`,
    [inviteToken, `${TEST_PREFIX}invite`]
  );
  const joinRes  = await request(app).post('/api/auth/join').send({ token: inviteToken });
  const guestToken = joinRes.body?.token;
  const username = `${TEST_PREFIX}user_${Date.now()}`;
  await request(app)
    .post('/api/auth/register')
    .set('Authorization', `Bearer ${guestToken}`)
    .send({ username, password: 'SecTest123!', secretQuestion: 'q', secretAnswer: 'a' });
  const loginRes = await request(app)
    .post('/api/auth/login').send({ username, password: 'SecTest123!' });
  validUserToken = loginRes.body?.token;
  const userRes  = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  testUserId = userRes.rows[0]?.id;

  // --- Create Admin ---
  const adminUsername = `${TEST_PREFIX}admin_${Date.now()}`;
  const adminRes = await db.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, 'fake_hash') RETURNING id`,
    [adminUsername]
  );
  testAdminId = adminRes.rows[0].id;
  const jwt = require('jsonwebtoken');
  validAdminToken = jwt.sign(
    { adminId: testAdminId, role: 'admin' },
    process.env.JWT_SECRET
  );
});

afterAll(async () => {
  await db.query(`DELETE FROM users  WHERE username LIKE '${TEST_PREFIX}%'`);
  await db.query(`DELETE FROM invites WHERE label    LIKE '${TEST_PREFIX}%'`);
  await db.query(`DELETE FROM ip_blacklist WHERE ip = $1`, [TEST_IP]);
  await db.query(`DELETE FROM admins WHERE username LIKE '${TEST_PREFIX}%'`);
});

// ─── 1. BLACKLIST ─────────────────────────────────────────────────────────

describe('Blacklist — IP блокировка не обходится через JWT', () => {

  beforeEach(async () => {
    await db.query(
      `INSERT INTO ip_blacklist (ip, reason, created_by)
       VALUES ($1, 'security test', (SELECT id FROM admins LIMIT 1))
       ON CONFLICT (ip) DO NOTHING`,
      [TEST_IP]
    );
  });

  afterEach(async () => {
    await db.query('DELETE FROM ip_blacklist WHERE ip = $1', [TEST_IP]);
  });

  test('заблокированный IP без JWT → 403 или 429', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('X-Forwarded-For', TEST_IP);
    expect([403, 429]).toContain(res.status);
  });

  test('заблокированный IP с валидным JWT → НЕ 200', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${validUserToken}`)
      .set('X-Forwarded-For', TEST_IP);
    expect(res.status).not.toBe(200);
    expect([403, 429]).toContain(res.status);
  });
});

// ─── 2. RATE LIMITING ─────────────────────────────────────────────────────

describe('Rate Limiting — брутфорс защита', () => {

  test('7 неудачных попыток логина → хотя бы одна 429', async () => {
    const results = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.88.88.88')
        .send({ username: 'nonexistent', password: 'wrong' });
      results.push(res.status);
    }
    expect(results).toContain(429);
  });

  test('первые 2 попытки логина не блокируются', async () => {
    const results = [];
    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.77.77.77')
        .send({ username: 'nonexistent2', password: 'wrong' });
      results.push(res.status);
    }
    expect(results[0]).not.toBe(429);
    expect(results[1]).not.toBe(429);
  });

  test('POST /api/auth/admin/login тоже ограничен', async () => {
    const results = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app)
        .post('/api/auth/admin/login')
        .set('X-Forwarded-For', '10.66.66.66')
        .send({ username: 'fake_admin', password: 'wrong' });
      results.push(res.status);
    }
    expect(results).toContain(429);
  });
});

// ─── 3. SECURITY HEADERS ──────────────────────────────────────────────────

describe('Security Headers — Helmet', () => {

  test('X-Content-Type-Options: nosniff присутствует', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('защита от clickjacking присутствует', async () => {
    const res = await request(app).get('/api/health');
    const ok =
      res.headers['x-frame-options'] ||
      res.headers['content-security-policy']?.includes('frame-ancestors');
    expect(ok).toBeTruthy();
  });

  test('Content-Security-Policy присутствует', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  test('CSP не разрешает скрипты с любых доменов', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'] || '';
    expect(csp).toContain('script-src');
    expect(csp).not.toContain('script-src *');
  });
});

// ─── 4. ИЗОЛЯЦИЯ ДАННЫХ ───────────────────────────────────────────────────

describe('Изоляция данных — юзер не читает чужие данные', () => {

  let secondUserToken;
  let secondUserConvId;

  beforeAll(async () => {
    // Используем прямые вставки в БД — не зависим от rate limiting HTTP-эндпоинтов
    const user2 = await createTestUser();
    secondUserToken = user2.token;
    const convRes = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({});
    secondUserConvId = convRes.body?.id;
  });

  test('юзер A не читает разговор юзера B', async () => {
    const res = await request(app)
      .get(`/api/conversations/${secondUserConvId}`)
      .set('Authorization', `Bearer ${validUserToken}`);
    expect(res.status).not.toBe(200);
    expect([403, 404]).toContain(res.status);
  });

  test('юзер A не пишет в разговор юзера B', async () => {
    const res = await request(app)
      .post(`/api/conversations/${secondUserConvId}/messages`)
      .set('Authorization', `Bearer ${validUserToken}`)
      .send({ role: 'user', content: 'чужое сообщение' });
    expect(res.status).not.toBe(200);
    expect([403, 404]).toContain(res.status);
  });

  test('юзер A не удаляет разговор юзера B', async () => {
    const res = await request(app)
      .delete(`/api/conversations/${secondUserConvId}`)
      .set('Authorization', `Bearer ${validUserToken}`);
    expect(res.status).not.toBe(200);
    expect([403, 404]).toContain(res.status);
  });
});

// ─── 5. УТЕЧКИ ────────────────────────────────────────────────────────────

describe('Утечки — stack trace не в ответах', () => {

  test('несуществующий эндпоинт не возвращает stack trace', async () => {
    const res = await request(app)
      .get('/api/nonexistent_xyz')
      .set('Authorization', `Bearer ${validUserToken}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/at Object\.|at async|\/backend\/|\/app\//);
    expect(body).not.toMatch(/SELECT|INSERT|UPDATE|FROM|WHERE/i);
  });

  test('401 не содержит технических деталей', async () => {
    const res = await request(app).get('/api/conversations');
    expect(res.status).toBe(401);
    expect(res.body.error).not.toMatch(/jwt|token|secret|hash/i);
  });
});

// ─── 6. ПОДДЕЛЬНЫЕ ТОКЕНЫ ─────────────────────────────────────────────────

describe('Auth — поддельные и истёкшие токены', () => {

  test('поддельный JWT → 401', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', 'Bearer fake.jwt.token');
    expect(res.status).toBe(401);
  });

  test('истёкший JWT → 401', async () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign(
      { userId: testUserId, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test('токен с неверной подписью → 401', async () => {
    const jwt = require('jsonwebtoken');
    const wrongSig = jwt.sign({ userId: testUserId, role: 'user' }, 'wrong-secret');
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${wrongSig}`);
    expect(res.status).toBe(401);
  });

  test('эскалация user → admin → 403', async () => {
    const jwt = require('jsonwebtoken');
    const escalated = jwt.sign(
      { userId: testUserId, role: 'admin' },
      process.env.JWT_SECRET
    );
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${escalated}`);
    expect([401, 403]).toContain(res.status);
  });
});
