const { test, expect } = require('@playwright/test');
const { cleanE2EUsers, cleanE2EInvites, createE2EInvite, userExists, closePool } = require('./helpers/api');
const { registerNewUser, loginExistingUser } = require('./helpers/auth');

test.describe('Auth Flow — регистрация, логин, имя', () => {

  test.beforeAll(async () => {
    await cleanE2EUsers();
    await cleanE2EInvites();
  });

  test.afterAll(async () => {
    await cleanE2EUsers();
    await cleanE2EInvites();
    await closePool();
  });

  test('новый юзер регистрируется и сразу видит своё имя на welcome', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_auth1');
    const username = 'e2e_user_auth1';

    await registerNewUser(page, inviteToken, username);

    const userNameEl = page.locator('.user-name, #user-name, [data-user-name]').first();
    await expect(userNameEl).toBeVisible({ timeout: 10_000 });
    await expect(userNameEl).toContainText(username);

    expect(await userExists(username)).toBe(true);
  });

  test('после логина имя отображается мгновенно', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_auth2');
    const username = 'e2e_user_auth2';

    await registerNewUser(page, inviteToken, username);

    await page.evaluate(() => localStorage.clear());
    await loginExistingUser(page, username);

    const userNameEl = page.locator('.user-name, #user-name, [data-user-name]').first();
    await expect(userNameEl).toContainText(username, { timeout: 5_000 });
  });

  test('logout очищает сессию и редиректит на auth', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_auth3');
    const username = 'e2e_user_auth3';
    await registerNewUser(page, inviteToken, username);

    await page.locator('#settings-btn, [data-settings]').first().click();
    await expect(page.locator('#settings-modal.show')).toBeVisible();

    page.on('dialog', d => d.accept());
    await page.locator('#logout-btn').click();

    await page.waitForURL(/\/$|\/\?/, { timeout: 5_000 });

    const token = await page.evaluate(() => localStorage.getItem('anita_jwt'));
    expect(token).toBeNull();
  });
});
