// ============================================
// VAULT SERVICE — server-side only encryption
// ============================================
// This is what makes credential storage actually secure (unlike the old
// frontend-only demo): VAULT_MASTER_KEY lives only in this server's
// environment variables. It is never sent to the browser, never in any
// API response, never in frontend JS. Only this backend process can
// decrypt broker credentials, and only in memory, only when needed to
// make a broker API call.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getMasterKey() {
  const keyHex = process.env.VAULT_MASTER_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'VAULT_MASTER_KEY missing or invalid. Generate one with: ' +
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a JS object (e.g. { apiKey, apiSecret, accessToken }) for storage.
 * Returns { ciphertext, iv, authTag } — all safe to store in Postgres as text.
 */
function encryptCredentials(dataObj) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(dataObj);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts a stored credential row back into the original JS object.
 * Throws if the auth tag doesn't match (tampering or wrong key).
 */
function decryptCredentials({ ciphertext, iv, authTag }) {
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = { encryptCredentials, decryptCredentials };
