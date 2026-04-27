/**
 * backend/__tests__/chat.test.js
 * Тесты: дневная квота, auth-защита chat endpoints.
 * Grok API мокируется — тесты не делают реальных запросов к xAI.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });
require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
process.env.DAILY_MESSAGE_LIMIT = '5'; // маленький лимит для теста квоты

const request = require('supertest');
const app = require('../app');
const { cleanDatabase, createTestUser } = require('./helpers/db');
const db = require('../db');

// Мок глобального fetch — чтобы не ходить в реальный xAI API
global.fetch = jest.fn();

beforeAll(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  jest.restoreAllMocks();
});

beforeEach(async () => {
  await cleanDatabase();
  // Сбрасываем мок перед каждым тестом
  global.fetch.mockReset();
  // По умолчанию — успешный ответ от Grok
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: 'Тестовый ответ Аниты' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }),
  });
});

// ─────────────────────────────────────────────────────────────
describe('GET /api/chat/quota — текущая квота', () => {
  test('возвращает квоту для авторизованного пользователя', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .get('/api/chat/quota')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('used');
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('remaining');
    expect(res.body.used).toBe(0);
    expect(res.body.limit).toBe(5);
  });

  test('возвращает 401 без JWT', async () => {
    const res = await request(app).get('/api/chat/quota');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/chat — отправка сообщения', () => {
  test('возвращает 401 без JWT', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'Привет' }] });

    expect(res.status).toBe(401);
  });

  test('возвращает 400 при отсутствии messages', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('возвращает 400 если messages не массив', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ messages: 'not-an-array' });

    expect(res.status).toBe(400);
  });

  test('успешно проксирует запрос к Grok и возвращает ответ', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ messages: [{ role: 'user', content: 'Привет, как дела?' }] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('choices');
    // Проверяем что квота инкрементировалась
    expect(res.headers['x-quota-used']).toBe('1');
  });

  test('возвращает 429 когда дневная квота исчерпана', async () => {
    const user = await createTestUser();
    // Используем все 5 сообщений из лимита
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ messages: [{ role: 'user', content: `Сообщение ${i + 1}` }] });
    }

    // 6-е должно упасть с 429
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ messages: [{ role: 'user', content: 'Лишнее сообщение' }] });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('daily_limit_exceeded');
  });

  test('возвращает 502 если Grok API вернул ошибку', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    });

    const user = await createTestUser();
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ messages: [{ role: 'user', content: 'Тест' }] });

    expect(res.status).toBe(502);
  });

  test('не даёт отправлять сообщения администратору (403)', async () => {
    const jwt = require('jsonwebtoken');
    const adminToken = jwt.sign(
      { adminId: 'some-id', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ messages: [{ role: 'user', content: 'Привет' }] });

    expect(res.status).toBe(403);
  });
});
