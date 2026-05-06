/**
 * backend/__tests__/auth.test.js
 * Тесты: регистрация, вход, валидация токенов, admin login.
 *
 * Требует переменной DATABASE_URL для подключения к тестовой БД.
 * В CI используется отдельный Postgres сервис.
 */

// Загружаем env до импорта app
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });
require('dotenv').config();

// Гарантируем, что JWT_SECRET есть в тестах
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';

const request = require('supertest');
const app = require('../app');
const { cleanDatabase, createTestInvite, createTestUser } = require('./helpers/db');
const db = require('../db');

beforeAll(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  // Закрываем пул соединений чтобы Jest не зависал
  await db.pool.end();
});

afterEach(async () => {
  await cleanDatabase();
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/join — вход по инвайту', () => {
  test('создаёт пользователя и возвращает JWT при валидном инвайте', async () => {
    const invite = await createTestInvite({ token: 'valid-token-001' });

    const res = await request(app)
      .post('/api/auth/join')
      .send({ token: 'valid-token-001' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.isRegistered).toBe(false);

    // Проверяем что пользователь создан в БД
    const users = await db.query('SELECT * FROM users');
    expect(users.rows.length).toBe(1);
  });

  test('возвращает 400 при несуществующем токене', async () => {
    const res = await request(app)
      .post('/api/auth/join')
      .send({ token: 'non-existent-token' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('возвращает 400 если токен не передан', async () => {
    const res = await request(app)
      .post('/api/auth/join')
      .send({});

    expect(res.status).toBe(400);
  });

  test('возвращает 400 если инвайт исчерпан (uses_count >= max_uses)', async () => {
    await createTestInvite({ token: 'exhausted-token', maxUses: 1 });
    // Используем инвайт первый раз
    await request(app).post('/api/auth/join').send({ token: 'exhausted-token' });
    // Второй раз должен упасть
    const res = await request(app).post('/api/auth/join').send({ token: 'exhausted-token' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/register — регистрация аккаунта', () => {
  test('успешно регистрирует пользователя с валидными данными', async () => {
    const user = await createTestUser();

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        username: 'testuser123',
        password: 'ValidPassword1',
        secretQuestion: 'Имя питомца?',
        secretAnswer: 'Барсик',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.username).toBe('testuser123');
  });

  test('возвращает 400 при слишком коротком username', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ username: 'ab', password: 'ValidPassword1', secretQuestion: 'q', secretAnswer: 'a' });

    expect(res.status).toBe(400);
  });

  test('возвращает 400 при пароле короче 8 символов', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ username: 'validname', password: 'short', secretQuestion: 'q', secretAnswer: 'ans' });

    expect(res.status).toBe(400);
  });

  test('возвращает 409 при уже занятом username', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();

    // Регистрируем первого пользователя
    await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ username: 'taken_name', password: 'ValidPassword1', secretQuestion: 'q', secretAnswer: 'ans' });

    // Пытаемся взять тот же username вторым
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ username: 'taken_name', password: 'ValidPassword1', secretQuestion: 'q', secretAnswer: 'ans' });

    expect(res.status).toBe(409);
  });

  test('возвращает 401 без JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'noauth', password: 'ValidPassword1', secretQuestion: 'q', secretAnswer: 'ans' });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/login — вход по username/пароль', () => {
  test('успешно входит с правильными данными', async () => {
    const user = await createTestUser({ registered: true, username: 'logintest', password: 'MyPassword123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'logintest', password: 'MyPassword123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('возвращает 401 при неверном пароле', async () => {
    await createTestUser({ registered: true, username: 'logintest2', password: 'CorrectPass123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'logintest2', password: 'WrongPass123' });

    expect(res.status).toBe(401);
  });

  test('возвращает 401 при несуществующем username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost_user', password: 'SomePass123' });

    expect(res.status).toBe(401);
    // Не раскрываем что именно неверно
    expect(res.body.error).not.toMatch(/не существует/i);
  });

  test('возвращает 400 если username или password не переданы', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'only_user' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/auth/admin/login — вход администратора', () => {
  test('успешно входит с правильными данными', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('adminpass123', 10);
    await db.query(`INSERT INTO admins (username, password_hash) VALUES ('admin_test', $1)`, [hash]);

    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ username: 'admin_test', password: 'adminpass123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('возвращает 401 при неверных данных', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ username: 'ghost_admin', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
describe('GET /api/health — health check', () => {
  test('возвращает status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
