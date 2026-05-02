const { request, app, db } = require('./helpers');

describe('Deep Health Check — инфраструктура', () => {

  test('pgcrypto extension активна', async () => {
    const res = await db.query(`SELECT pgp_sym_encrypt('test', 'testkey32chars!!testkey32chars!') as ok`);
    expect(res.rows[0].ok).toBeTruthy();
  });

  test('profile колонка существует в user_memory', async () => {
    await expect(
      db.query('SELECT profile FROM user_memory LIMIT 0')
    ).resolves.not.toThrow();
  });

  test('messages таблица существует', async () => {
    await expect(
      db.query('SELECT id FROM messages LIMIT 0')
    ).resolves.not.toThrow();
  });

  test('conversations таблица существует', async () => {
    await expect(
      db.query('SELECT id FROM conversations LIMIT 0')
    ).resolves.not.toThrow();
  });

  test('GET /api/health возвращает 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  test('db.query работает', async () => {
    const res = await db.query('SELECT 1 as one');
    expect(res.rows[0].one).toBe(1);
  });

  test('contextManager импортирует db без ошибок', () => {
    expect(() => require('../../services/contextManager')).not.toThrow();
    const cm = require('../../services/contextManager');
    expect(cm).toHaveProperty('buildContextWindow');
    expect(typeof cm.buildContextWindow).toBe('function');
  });

  test('encryption работает для сохранения и чтения', async () => {
    const { encryptText, decryptText } = require('../../utils/encryption');
    const original = 'Тестовое сообщение для шифрования';
    const encrypted = await encryptText(original);
    const decrypted = await decryptText(encrypted);
    expect(decrypted).toBe(original);
  });
});
