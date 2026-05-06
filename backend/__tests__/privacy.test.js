/**
 * backend/__tests__/privacy.test.js
 * Тесты: DELETE /api/auth/me удаляет все данные пользователя (GDPR Art. 17).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });
require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';

const request = require('supertest');
const app = require('../app');
const { cleanDatabase, createTestUser } = require('./helpers/db');
const db = require('../db');

beforeAll(async () => { await cleanDatabase(); });
afterAll(async () => { 
  jest.restoreAllMocks(); 
  await db.pool.end();
});
afterEach(async () => { await cleanDatabase(); });

// ─────────────────────────────────────────────────────────────
describe('DELETE /api/auth/me — удаление аккаунта (GDPR)', () => {
  test('удаляет пользователя и все связанные данные', async () => {
    const user = await createTestUser();

    // Создаём связанные данные
    await db.query(
      `INSERT INTO conversations (user_id, title) VALUES ($1, 'Test Chat')`,
      [user.id]
    );
    await db.query(
      `INSERT INTO message_quota (user_id, date, count) VALUES ($1, CURRENT_DATE, 5)`,
      [user.id]
    );
    await db.query(
      `INSERT INTO user_memory (user_id, category, fact, importance)
       VALUES ($1, 'personal', 'Тестовый факт', 'medium')`,
      [user.id]
    );
    await db.query(
      `INSERT INTO user_consent (user_id, terms_version, data_processing, ai_improvement)
       VALUES ($1, '1.0', true, false)`,
      [user.id]
    );

    // Удаляем аккаунт
    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');

    // Проверяем что пользователь удалён
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [user.id]);
    expect(userCheck.rows.length).toBe(0);

    // Проверяем что данные удалены каскадно
    const convCheck = await db.query('SELECT id FROM conversations WHERE user_id = $1', [user.id]);
    expect(convCheck.rows.length).toBe(0);

    const quotaCheck = await db.query('SELECT id FROM message_quota WHERE user_id = $1', [user.id]);
    expect(quotaCheck.rows.length).toBe(0);

    const memoryCheck = await db.query('SELECT id FROM user_memory WHERE user_id = $1', [user.id]);
    expect(memoryCheck.rows.length).toBe(0);

    const consentCheck = await db.query('SELECT user_id FROM user_consent WHERE user_id = $1', [user.id]);
    expect(consentCheck.rows.length).toBe(0);
  });

  test('возвращает 401 без JWT', async () => {
    const res = await request(app).delete('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('не позволяет удалять аккаунт с ролью admin', async () => {
    const jwt = require('jsonwebtoken');
    const adminToken = jwt.sign(
      { adminId: 'some-id', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/save-consent — сохранение согласия', () => {
  test('сохраняет согласие пользователя', async () => {
    const user = await createTestUser();

    const res = await request(app)
      .post('/api/auth/save-consent')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ termsVersion: '1.0', dataProcessing: true, aiImprovement: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Проверяем что запись создана в БД
    const consent = await db.query(
      'SELECT * FROM user_consent WHERE user_id = $1',
      [user.id]
    );
    expect(consent.rows.length).toBe(1);
    expect(consent.rows[0].terms_version).toBe('1.0');
    expect(consent.rows[0].data_processing).toBe(true);
  });

  test('обновляет согласие при повторном запросе (upsert)', async () => {
    const user = await createTestUser();

    // Первый раз
    await request(app)
      .post('/api/auth/save-consent')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ termsVersion: '1.0', dataProcessing: false, aiImprovement: false });

    // Второй раз — обновляем
    await request(app)
      .post('/api/auth/save-consent')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ termsVersion: '1.1', dataProcessing: true, aiImprovement: true });

    const consent = await db.query(
      'SELECT * FROM user_consent WHERE user_id = $1',
      [user.id]
    );
    expect(consent.rows.length).toBe(1); // только одна запись
    expect(consent.rows[0].terms_version).toBe('1.1');
    expect(consent.rows[0].data_processing).toBe(true);
  });
});
