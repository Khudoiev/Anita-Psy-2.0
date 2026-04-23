/**
 * backend/utils/crypto.js
 * AES-256-GCM шифрование для сообщений чата
 *
 * Ключ берётся из ENCRYPTION_KEY в .env (64 hex-символа = 32 байта)
 * Генерация: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const crypto = require('crypto');

const KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : null;

function assertKey() {
  if (!KEY || KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
}

/**
 * Зашифровать строку
 * Формат: iv(32hex):tag(32hex):ciphertext(hex)
 */
function encrypt(plaintext) {
  assertKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Расшифровать строку
 */
function decrypt(ciphertext) {
  assertKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, tagHex, encHex] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
