const { cleanIntegrationData, createTestInvite, joinWithInvite,
        registerUser, loginUser, request, app, db } = require('./helpers');

let userToken;
let conversationId;

beforeAll(async () => {
  await cleanIntegrationData();
  const invite = await createTestInvite('inttest_session');
  const joinRes = await joinWithInvite(invite.token);
  await registerUser(joinRes.body.token, 'inttest_session1');
  const loginRes = await loginUser('inttest_session1');
  userToken = loginRes.body.token;

  // Создаём разговор с сообщениями
  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${userToken}`)
    .send({});
  conversationId = convRes.body.id;

  // Добавляем несколько сообщений
  for (let i = 0; i < 3; i++) {
    await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Тест сообщение ${i}` });
  }
});

afterAll(async () => { 
  await cleanIntegrationData(); 
  await db.pool.end();
});

describe('Критический путь 4: Завершение сеанса', () => {

  test('POST /conversations/:id/end не возвращает 500', async () => {
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/end`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    // Может вернуть 200 с пустыми инсайтами (мало сообщений) — это нормально
    expect(res.status).not.toBe(500);
    expect(res.body).toHaveProperty('success', true);
  });

  test('удаление инвайта не удаляет юзера', async () => {
    const crypto = require('crypto');
    const db = require('../../db');

    // Создаём новый инвайт
    const invRes = await db.query(
      `INSERT INTO invites (token, label, max_uses, is_active)
       VALUES ($1, 'inttest_del', 1, true) RETURNING id, token`,
      [crypto.randomBytes(16).toString('hex')]
    );
    const inviteId = invRes.rows[0].id;
    const inviteToken = invRes.rows[0].token;

    // Юзер переходит по инвайту
    const joinRes = await joinWithInvite(inviteToken);
    expect(joinRes.status).toBe(200);
    const guestToken = joinRes.body.token;

    // Находим id юзера
    const jwtPayload = require('jsonwebtoken').decode(guestToken);
    const userId = jwtPayload.userId;

    // Удаляем инвайт напрямую через БД (имитируем admin delete)
    await db.query('UPDATE users SET invite_id = NULL WHERE invite_id = $1', [inviteId]);
    await db.query('DELETE FROM invites WHERE id = $1', [inviteId]);

    // Юзер должен остаться
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
    expect(userCheck.rows.length).toBe(1);
  });
});
