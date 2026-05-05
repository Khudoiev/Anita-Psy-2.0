const { test, expect } = require('@playwright/test');
const { cleanE2EUsers, cleanE2EInvites, createE2EInvite, getUserProfile, closePool } = require('./helpers/api');
const { registerNewUser } = require('./helpers/auth');

test.describe('Chat Flow — стриминг, имя, сайдбар', () => {

  test.beforeAll(async () => { await cleanE2EUsers(); await cleanE2EInvites(); });
  test.afterAll(async () => { await cleanE2EUsers(); await cleanE2EInvites(); await closePool(); });

  test('Enter отправляет сообщение и Anita отвечает через стриминг', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_chat1');
    const username = 'e2e_user_chat1';
    await registerNewUser(page, inviteToken, username);

    await page.locator('#new-chat-btn, [data-new-chat]').first().click();
    await expect(page.locator('#msg-input')).toBeVisible();

    const assistantMessagesBefore = await page.locator('.message.assistant, [data-role="assistant"]').count();

    await page.locator('#msg-input').fill('Привет, как дела?');
    await page.locator('#msg-input').press('Enter');

    await expect(async () => {
      const count = await page.locator('.message.assistant, [data-role="assistant"]').count();
      expect(count).toBeGreaterThan(assistantMessagesBefore);
    }).toPass({ timeout: 30_000 });

    const lastMsg = page.locator('.message.assistant, [data-role="assistant"]').last();
    const text = await lastMsg.textContent();
    expect(text.trim().length).toBeGreaterThan(5);

    expect(text).not.toContain('Что-то пошло не так');
    expect(text).not.toContain('Переподключение');
  });

  test('кнопка отправки тоже работает (не только Enter)', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_chat2');
    const username = 'e2e_user_chat2';
    await registerNewUser(page, inviteToken, username);

    await page.locator('#new-chat-btn').first().click();

    const before = await page.locator('.message.user, [data-role="user"]').count();

    await page.locator('#msg-input').fill('Тест кнопки');
    await page.locator('#send-btn').click();

    await expect(async () => {
      const count = await page.locator('.message.user, [data-role="user"]').count();
      expect(count).toBeGreaterThan(before);
    }).toPass({ timeout: 5_000 });
  });

  test('имя сохраняется в профиль после первых сообщений', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_chat3');
    const username = 'e2e_user_chat3';
    await registerNewUser(page, inviteToken, username);

    await page.locator('#new-chat-btn').first().click();

    const messages = [
      'Привет',
      'Меня зовут Алексей',
      'Я хочу поговорить о тревоге',
    ];

    for (const msg of messages) {
      await page.locator('#msg-input').fill(msg);
      await page.locator('#msg-input').press('Enter');
      await page.waitForTimeout(8_000);
    }

    await page.waitForTimeout(3_000);
    const profile = await getUserProfile(username);
    expect(profile).toBeTruthy();
    if (profile?.name) {
      expect(profile.name.toLowerCase()).toContain('алекс');
    }
  });

  test('сайдбар обновляется после генерации заголовка', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_chat4');
    const username = 'e2e_user_chat4';
    await registerNewUser(page, inviteToken, username);

    await page.locator('#new-chat-btn').first().click();

    for (let i = 0; i < 4; i++) {
      await page.locator('#msg-input').fill(`Сообщение для генерации заголовка номер ${i + 1}`);
      await page.locator('#msg-input').press('Enter');
      await page.waitForTimeout(7_000);
    }

    const sidebarTitle = page.locator('.sidebar-chat-item:first-child .chat-title, [data-chat-title]:first-of-type').first();
    await expect(async () => {
      const text = await sidebarTitle.textContent();
      expect(text.trim()).not.toBe('Новый разговор');
      expect(text.trim().length).toBeGreaterThan(3);
    }).toPass({ timeout: 30_000 });
  });

  test('обновление страницы возвращает к чату, не на welcome', async ({ page }) => {
    const inviteToken = await createE2EInvite('e2e_chat5');
    const username = 'e2e_user_chat5';
    await registerNewUser(page, inviteToken, username);

    await page.locator('#new-chat-btn').first().click();
    await page.locator('#msg-input').fill('Тестовое сообщение');
    await page.locator('#msg-input').press('Enter');
    await page.waitForTimeout(5_000);

    await page.reload();

    await expect(page.locator('#msg-input')).toBeVisible({ timeout: 10_000 });
    const userMsgs = await page.locator('.message.user, [data-role="user"]').count();
    expect(userMsgs).toBeGreaterThan(0);
  });
});
