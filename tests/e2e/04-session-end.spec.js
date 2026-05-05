const { test, expect } = require('@playwright/test');
const { cleanE2EUsers, cleanE2EInvites, createE2EInvite, closePool } = require('./helpers/api');
const { registerNewUser } = require('./helpers/auth');

test.describe('Session End — завершение сеанса', () => {

  test.beforeAll(async () => { await cleanE2EUsers(); await cleanE2EInvites(); });
  test.afterAll(async () => { await cleanE2EUsers(); await cleanE2EInvites(); await closePool(); });

  test('кнопка "Завершить сеанс" открывает модал инсайтов', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_session1');
    const username = 'e2e_user_session1';
    await registerNewUser(page, inviteToken, username);

    const skipBtn = page.locator('#onboarding-skip-btn');
    if (await skipBtn.isVisible()) await skipBtn.click();

    await page.locator('#new-chat-btn').first().click();
    for (let i = 0; i < 3; i++) {
      await page.locator('#msg-input').fill(`Сообщение ${i + 1} для теста сессии`);
      await page.locator('#msg-input').press('Enter');
      await page.waitForTimeout(7_000);
    }

    await page.locator('#end-session-btn, [data-end-session]').first().click();

    await expect(page.locator('#insights-modal.show')).toBeVisible({ timeout: 30_000 });
  });

  test('кнопка "Пропустить" в инсайтах закрывает модал', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_session2');
    const username = 'e2e_user_session2';
    await registerNewUser(page, inviteToken, username);

    const skipBtn = page.locator('#onboarding-skip-btn');
    if (await skipBtn.isVisible()) await skipBtn.click();

    await page.locator('#new-chat-btn').first().click();
    await page.locator('#msg-input').fill('Тест');
    await page.locator('#msg-input').press('Enter');
    await page.waitForTimeout(7_000);

    await page.locator('#end-session-btn').first().click();
    await expect(page.locator('#insights-modal.show')).toBeVisible({ timeout: 30_000 });

    await page.locator('#insights-skip-btn').click();
    await expect(page.locator('#insights-modal.show')).not.toBeVisible();
  });
});
