const { cleanIntegrationData, createTestInvite, joinWithInvite,
        registerUser, loginUser, request, app } = require('./helpers');

beforeAll(async () => { await cleanIntegrationData(); });
afterAll(async ()  => { await cleanIntegrationData(); });

describe('Критический путь 1: Авторизация и имя', () => {

  test('полный цикл: инвайт → регистрация → логин → имя в /auth/me', async () => {
    const invite = await createTestInvite('inttest_auth');

    // Шаг 1: переход по инвайту
    const joinRes = await joinWithInvite(invite.token);
    expect(joinRes.status).toBe(200);
    expect(joinRes.body).toHaveProperty('token');
    const guestToken = joinRes.body.token;

    // Шаг 2: регистрация
    const regRes = await registerUser(guestToken, 'inttest_user1');
    expect(regRes.status).toBe(200);
    expect(regRes.body).toHaveProperty('token');
    expect(regRes.body).toHaveProperty('username', 'inttest_user1');

    // Шаг 3: логин
    const loginRes = await loginUser('inttest_user1');
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    // КРИТИЧНО: логин должен возвращать username
    expect(loginRes.body).toHaveProperty('username', 'inttest_user1');
    const loginToken = loginRes.body.token;

    // Шаг 4: GET /auth/me возвращает имя
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body).toHaveProperty('username', 'inttest_user1');
  });

  test('GET /api/auth/me возвращает 401 без токена', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login возвращает 401 при неверном пароле', async () => {
    const res = await loginUser('inttest_user1', 'WrongPass999!');
    expect(res.status).toBe(401);
  });
});
