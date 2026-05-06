const { cleanIntegrationData, createTestInvite, joinWithInvite,
        registerUser, loginUser, request, app, db } = require('./helpers');

let adminToken;
let userToken;
let userId;

beforeAll(async () => {
  await cleanIntegrationData();

  // Создаём тестового админа
  const bcrypt = require('bcrypt');
  const jwt = require('jsonwebtoken');
  const hash = await bcrypt.hash('AdminPass123!', 10);
  const adminRes = await db.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id`,
    ['inttest_admin_mod', hash]
  );
  adminToken = jwt.sign(
    { adminId: adminRes.rows[0].id, role: 'admin' },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );

  // Создаём тестового пользователя
  const invite = await createTestInvite('inttest_mod');
  const joinRes = await joinWithInvite(invite.token);
  await registerUser(joinRes.body.token, 'inttest_mod_user');
  const loginRes = await loginUser('inttest_mod_user');
  userToken = loginRes.body.token;
  userId = require('jsonwebtoken').decode(userToken).userId;
});

afterAll(async () => {
  await db.query(`
    DELETE FROM admin_logs WHERE admin_id = (
      SELECT id FROM admins WHERE username = 'inttest_admin_mod'
    )
  `);
  await db.query(`DELETE FROM admins WHERE username = 'inttest_admin_mod'`);
  await cleanIntegrationData();
  await db.pool.end();
});

// ─────────────────────────────────────────────────────────────
// Temp ban flow
// ─────────────────────────────────────────────────────────────
describe('Temp ban: бан → 403 → разбан → 200', () => {

  test('до бана: запрос проходит нормально', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });

  test('POST /admin/users/:id/temp-ban возвращает success', async () => {
    const res = await request(app)
      .post(`/api/admin/users/${userId}/temp-ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'тест бан' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('после бана: запрос возвращает 403 temp_banned', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('temp_banned');
  });

  test('POST /admin/users/:id/unban возвращает success', async () => {
    const res = await request(app)
      .post(`/api/admin/users/${userId}/unban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'тест разбан' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('после разбана: запрос снова проходит', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────
// Шифрование сообщений: round-trip
// ─────────────────────────────────────────────────────────────
describe('Шифрование: сохранить → прочитать → текст совпадает', () => {

  let convId;
  const originalText = 'Привет, это тестовое сообщение для проверки шифрования 123!';

  test('создать разговор и сохранить сообщение', async () => {
    // Создаём нового юзера с рабочим инвайтом (у текущего инвайт удалён)
    const invite2 = await createTestInvite('inttest_enc');
    const joinRes = await joinWithInvite(invite2.token);
    await registerUser(joinRes.body.token, 'inttest_enc_user');
    const loginRes = await loginUser('inttest_enc_user');
    const encToken = loginRes.body.token;

    const convRes = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${encToken}`)
      .send({});
    expect(convRes.status).toBe(200);
    convId = convRes.body.id;

    const msgRes = await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${encToken}`)
      .send({ role: 'user', content: originalText });
    expect(msgRes.status).toBe(200);
  });

  test('в БД хранится не plaintext (зашифровано)', async () => {
    if (!convId) return;
    const row = await db.query(
      'SELECT content FROM messages WHERE conversation_id = $1 LIMIT 1',
      [convId]
    );
    expect(row.rows.length).toBe(1);
    // Если шифрование включено — контент не должен совпадать с оригиналом
    if (process.env.DB_ENCRYPTION_KEY && process.env.DB_ENCRYPTION_KEY.length >= 32) {
      expect(row.rows[0].content).not.toBe(originalText);
    }
  });

  test('GET /conversations/:id возвращает расшифрованный текст', async () => {
    if (!convId) return;
    const invite3 = await createTestInvite('inttest_enc2');
    const joinRes = await joinWithInvite(invite3.token);
    await registerUser(joinRes.body.token, 'inttest_enc_user2');
    const loginRes = await loginUser('inttest_enc_user2');
    const encToken2 = loginRes.body.token;

    // Нужен токен владельца разговора — используем тот что создал convId
    const loginOwner = await loginUser('inttest_enc_user');
    const ownerToken = loginOwner.body.token;

    const res = await request(app)
      .get(`/api/conversations/${convId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.messages[0].content).toBe(originalText);
  });
});
