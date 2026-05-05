const { test, expect } = require('@playwright/test');
const { cleanE2EUsers, cleanE2EInvites, createE2EInvite, closePool } = require('./helpers/api');
const { registerNewUser } = require('./helpers/auth');

test.describe('Console Errors — никаких ошибок в консоли', () => {

  test.beforeAll(async () => { await cleanE2EUsers(); await cleanE2EInvites(); });
  test.afterAll(async () => { await cleanE2EUsers(); await cleanE2EInvites(); await closePool(); });

  test('главные экраны не выбрасывают ошибок в консоль', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    const inviteToken = await createE2EInvite('e2e_console1');
    const username = 'e2e_user_console1';

    await registerNewUser(page, inviteToken, username);
    await page.waitForTimeout(2_000);

    const skipBtn = page.locator('#onboarding-skip-btn');
    if (await skipBtn.isVisible()) await skipBtn.click();

    await page.locator('#settings-btn').first().click();
    await page.waitForTimeout(500);
    await page.locator('#settings-close-btn, [data-close-settings]').first().click().catch(() => {});

    await page.locator('#new-chat-btn').first().click();
    await page.waitForTimeout(1_000);

    await page.locator('#msg-input').fill('Тест на ошибки');
    await page.waitForTimeout(500);

    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource: the server responded with a status of 404')
    );

    if (realErrors.length > 0) {
      console.error('Найдены ошибки в консоли:');
      realErrors.forEach(e => console.error('  -', e));
    }
    expect(realErrors).toHaveLength(0);
  });
});
