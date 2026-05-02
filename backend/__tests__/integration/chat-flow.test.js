const { cleanIntegrationData, createTestInvite, joinWithInvite,
        registerUser, loginUser, request, app, db } = require('./helpers');

let userToken;
let conversationId;

beforeAll(async () => {
  await cleanIntegrationData();
  const invite = await createTestInvite('inttest_chat');
  const joinRes = await joinWithInvite(invite.token);
  await registerUser(joinRes.body.token, 'inttest_chat1');
  const loginRes = await loginUser('inttest_chat1');
  userToken = loginRes.body.token;
});

afterAll(async () => { await cleanIntegrationData(); });

describe('Критический путь 2: Создание и сохранение сообщений', () => {

  test('создать новый разговор', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    conversationId = res.body.id;
  });

  test('сохранить сообщение в разговор', async () => {
    expect(conversationId).toBeDefined();
    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ role: 'user', content: 'Тестовое сообщение интеграционного теста' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('created_at');
  });

  test('прочитать разговор с сообщениями', async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe('Тестовое сообщение интеграционного теста');
  });
});

describe('Критический путь 3: contextManager не падает', () => {

  test('buildContextWindow не выбрасывает ReferenceError для db', async () => {
    // Проверяем что db импортирован в contextManager
    let contextManager;
    expect(() => {
      contextManager = require('../../services/contextManager');
    }).not.toThrow();
    expect(contextManager).toHaveProperty('buildContextWindow');

    // Проверяем что функция не падает с реальными данными
    const { buildContextWindow } = contextManager;
    const messages = [{ role: 'user', content: 'тест' }];

    // Получаем userId из БД
    const userRes = await db.query(
      "SELECT id FROM users WHERE username = 'inttest_chat1' LIMIT 1"
    );
    const userId = userRes.rows[0]?.id;
    expect(userId).toBeDefined();

    await expect(
      buildContextWindow(messages, 'System prompt', userId)
    ).resolves.not.toThrow();
  });
});

describe('Критический путь 2: GET /api/conversations/memory', () => {

  test('возвращает is_onboarded в ответе', async () => {
    const res = await request(app)
      .get('/api/conversations/memory')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    // КРИТИЧНО: is_onboarded должен присутствовать
    expect(res.body).toHaveProperty('is_onboarded');
    expect(typeof res.body.is_onboarded).toBe('boolean');
  });

  test('GET /api/conversations/memory не возвращает 500', async () => {
    const res = await request(app)
      .get('/api/conversations/memory')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).not.toBe(500);
  });
});
