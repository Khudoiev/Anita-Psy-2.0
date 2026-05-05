const { test, expect } = require('@playwright/test');
const { cleanE2EUsers, cleanE2EInvites, createE2EInvite, closePool } = require('./helpers/api');
const { registerNewUser } = require('./helpers/auth');

test.describe('Onboarding — новый юзер', () => {

  test.beforeAll(async () => { await cleanE2EUsers(); await cleanE2EInvites(); });
  test.afterAll(async () => { await cleanE2EUsers(); await cleanE2EInvites(); await closePool(); });

  test('новый юзер видит онбординг при первом входе', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_onboard1');
    const username = 'e2e_user_onboard1';

    await registerNewUser(page, inviteToken, username);

    const onboardingModal = page.locator('#onboarding-modal');
    await expect(onboardingModal).toBeVisible({ timeout: 10_000 });
  });

  test('кнопка "Пропустить" закрывает онбординг', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_onboard2');
    const username = 'e2e_user_onboard2';
    await registerNewUser(page, inviteToken, username);

    await page.locator('#onboarding-skip-btn').click();
    await expect(page.locator('#onboarding-modal')).not.toBeVisible();
  });

  test('GET /api/conversations/memory не возвращает 500', async ({ page, request }) => {
    const inviteToken = await createE2EInvite('e2e_onboard3');
    const username = 'e2e_user_onboard3';
    await registerNewUser(page, inviteToken, username);

    const token = await page.evaluate(() => localStorage.getItem('anita_jwt'));

    const res = await request.get('/api/conversations/memory', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('is_onboarded');
    expect(typeof body.is_onboarded).toBe('boolean');
  });
});
