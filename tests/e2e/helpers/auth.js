async function registerNewUser(page, inviteToken, username, password = 'E2eTest123!') {
  await page.goto(`/register?token=${inviteToken}`);

  await page.waitForSelector('input[name="username"], #username', { timeout: 10_000 });

  const usernameInput = page.locator('input[name="username"], #username').first();
  const passwordInput = page.locator('input[name="password"], #password').first();
  await usernameInput.fill(username);
  await passwordInput.fill(password);

  const secretQuestion = page.locator('#secret-question, [name="secretQuestion"]');
  if (await secretQuestion.count() > 0) {
    await secretQuestion.fill('Любимый цвет');
    await page.locator('#secret-answer, [name="secretAnswer"]').fill('синий');
  }

  await page.locator('button[type="submit"], #register-btn').first().click();

  await page.waitForURL(/\/(index\.html)?(\?|$|#)/, { timeout: 15_000 });
}

async function loginExistingUser(page, username, password = 'E2eTest123!') {
  await page.goto('/auth.html');
  await page.locator('input[name="username"], #login-username').first().fill(username);
  await page.locator('input[name="password"], #login-password').first().fill(password);
  await page.locator('button[type="submit"], #login-btn').first().click();
  await page.waitForURL(/\/(index\.html)?(\?|$|#)/, { timeout: 15_000 });
}

module.exports = { registerNewUser, loginExistingUser };
