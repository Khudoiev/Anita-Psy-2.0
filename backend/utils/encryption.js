const db = require('../db');

const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.warn('[Encryption] DB_ENCRYPTION_KEY not set or too short — messages will be stored as plaintext');
}

async function encryptText(plaintext) {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) return plaintext;
  const result = await db.query(
    `SELECT pgp_sym_encrypt($1, $2) as encrypted`,
    [plaintext, ENCRYPTION_KEY]
  );
  return result.rows[0].encrypted;
}

async function decryptText(encrypted) {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) return encrypted;
  try {
    const result = await db.query(
      `SELECT pgp_sym_decrypt($1::bytea, $2) as decrypted`,
      [encrypted, ENCRYPTION_KEY]
    );
    return result.rows[0].decrypted;
  } catch {
    return encrypted; // already plaintext or decryption error
  }
}

module.exports = { encryptText, decryptText };
