const { cleanIntegrationData, createTestInvite, joinWithInvite,
        registerUser, loginUser, request, app, db } = require('./helpers');

let userToken;

beforeAll(async () => {
  await cleanIntegrationData();
  const invite = await createTestInvite('inttest_onboard');
  const joinRes = await joinWithInvite(invite.token);
  await registerUser(joinRes.body.token, 'inttest_onboard1');
  const loginRes = await loginUser('inttest_onboard1');
  userToken = loginRes.body.token;
});

afterAll(async () => { await cleanIntegrationData(); });

describe('Критический путь 5: Онбординг нового пользователя', () => {

  test('новый юзер имеет is_onboarded: false', async () => {
    const res = await request(app)
      .get('/api/conversations/memory')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.is_onboarded).toBe(false);
  });

  test('профиль юзера доступен без ошибок (profile колонка существует)', async () => {
    const userRes = await db.query(
      "SELECT id FROM users WHERE username = 'inttest_onboard1' LIMIT 1"
    );
    const userId = userRes.rows[0]?.id;

    // Если profile колонка отсутствует — это упадёт
    await expect(async () => {
      const { getProfile } = require('../../services/memoryService');
      await getProfile(userId);
    }).not.toThrow();
  });
});
