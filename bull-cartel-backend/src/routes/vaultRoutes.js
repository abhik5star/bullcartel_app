const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { encryptCredentials, decryptCredentials } = require('../services/vaultService');

const router = express.Router();
const VALID_BROKERS = [
  // Indian market
  'zerodha', 'angelone', 'dhan', 'shoonya',
  // Crypto
  'binance', 'delta',
];

router.use(requireAuth); // every route below requires a valid logged-in user

// GET /api/vault  -> list connected brokers (NEVER returns decrypted secrets)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, broker, label, is_active, created_at FROM broker_credentials WHERE user_id = $1',
      [req.userId]
    );
    res.json({ credentials: result.rows });
  } catch (err) {
    console.error('Vault list error:', err.message);
    res.status(500).json({ error: 'Failed to load vault' });
  }
});

// POST /api/vault  -> add/update a broker's credentials
// body: { broker, label, apiKey, apiSecret, accessToken (optional, broker-specific) }
router.post('/', async (req, res) => {
  const { broker, label, ...secretFields } = req.body;

  if (!VALID_BROKERS.includes(broker)) {
    return res.status(400).json({ error: `Broker must be one of: ${VALID_BROKERS.join(', ')}` });
  }
  if (!secretFields.apiKey) {
    return res.status(400).json({ error: 'apiKey is required' });
  }

  try {
    const { ciphertext, iv, authTag } = encryptCredentials(secretFields);

    const result = await pool.query(
      `INSERT INTO broker_credentials (user_id, broker, label, ciphertext, iv, auth_tag)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, broker, label)
       DO UPDATE SET ciphertext = $4, iv = $5, auth_tag = $6, updated_at = NOW()
       RETURNING id, broker, label, created_at`,
      [req.userId, broker, label || 'default', ciphertext, iv, authTag]
    );

    res.status(201).json({ credential: result.rows[0] });
  } catch (err) {
    console.error('Vault save error:', err.message);
    res.status(500).json({ error: 'Failed to save credentials' });
  }
});

// DELETE /api/vault/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM broker_credentials WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error('Vault delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete credentials' });
  }
});

// Internal helper (used by broker routes) — decrypts credentials in-memory only,
// never sends them back to the frontend.
async function getDecryptedCredential(userId, broker, label = 'default') {
  const result = await pool.query(
    'SELECT ciphertext, iv, auth_tag FROM broker_credentials WHERE user_id = $1 AND broker = $2 AND label = $3 AND is_active = true',
    [userId, broker, label]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return decryptCredentials({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag });
}

module.exports = { router, getDecryptedCredential };
