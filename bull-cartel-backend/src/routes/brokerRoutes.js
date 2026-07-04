const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDecryptedCredential } = require('./vaultRoutes');
const brokers = require('../brokers');

const router = express.Router();
router.use(requireAuth);

// GET /api/broker/sections -> { indian: [...], crypto: [...] } for building UI tabs
router.get('/sections', (req, res) => {
  res.json(brokers.SECTIONS);
});

// GET /api/broker/:broker/holdings
// Fetches the user's real holdings from the broker, using their vault-stored
// credentials. Credentials are decrypted in memory only for this one call.
router.get('/:broker/holdings', async (req, res) => {
  const { broker } = req.params;
  const adapter = brokers[broker];

  if (!adapter) {
    return res.status(400).json({ error: `Unknown broker: ${broker}` });
  }
  if (!adapter.getHoldings) {
    return res.status(501).json({
      error: `${broker} adapter does not implement getHoldings yet — see src/brokers/${broker}.js TODOs`,
    });
  }

  try {
    const creds = await getDecryptedCredential(req.userId, broker);
    if (!creds) {
      return res.status(404).json({ error: `No ${broker} credentials found in your vault` });
    }
    const holdings = await adapter.getHoldings(creds);
    res.json({ broker, holdings });
  } catch (err) {
    console.error(`${broker} holdings error:`, err.message);
    res.status(502).json({ error: `Failed to fetch holdings from ${broker}`, detail: err.message });
  }
});

// GET /api/broker/:broker/positions
router.get('/:broker/positions', async (req, res) => {
  const { broker } = req.params;
  const adapter = brokers[broker];

  if (!adapter) return res.status(400).json({ error: `Unknown broker: ${broker}` });
  if (!adapter.getPositions) {
    return res.status(501).json({ error: `${broker} adapter does not implement getPositions yet` });
  }

  try {
    const creds = await getDecryptedCredential(req.userId, broker);
    if (!creds) return res.status(404).json({ error: `No ${broker} credentials found in your vault` });
    const positions = await adapter.getPositions(creds);
    res.json({ broker, positions });
  } catch (err) {
    console.error(`${broker} positions error:`, err.message);
    res.status(502).json({ error: `Failed to fetch positions from ${broker}`, detail: err.message });
  }
});

// POST /api/broker/:broker/order
// body: broker-specific order shape — see each adapter's placeOrder() comment
router.post('/:broker/order', async (req, res) => {
  const { broker } = req.params;
  const adapter = brokers[broker];

  if (!adapter) return res.status(400).json({ error: `Unknown broker: ${broker}` });
  if (!adapter.placeOrder) {
    return res.status(501).json({ error: `${broker} adapter does not implement placeOrder yet` });
  }

  try {
    const creds = await getDecryptedCredential(req.userId, broker);
    if (!creds) return res.status(404).json({ error: `No ${broker} credentials found in your vault` });
    const result = await adapter.placeOrder(creds, req.body);
    res.json({ broker, order: result });
  } catch (err) {
    console.error(`${broker} order error:`, err.message);
    res.status(502).json({ error: `Failed to place order via ${broker}`, detail: err.message });
  }
});

// DELETE /api/broker/:broker/order
// body: broker-specific cancel shape (e.g. Zerodha: {variety, orderId}, Binance: {symbol, orderId})
router.delete('/:broker/order', async (req, res) => {
  const { broker } = req.params;
  const adapter = brokers[broker];

  if (!adapter) return res.status(400).json({ error: `Unknown broker: ${broker}` });
  if (!adapter.cancelOrder) {
    return res.status(501).json({ error: `${broker} adapter does not implement cancelOrder yet` });
  }

  try {
    const creds = await getDecryptedCredential(req.userId, broker);
    if (!creds) return res.status(404).json({ error: `No ${broker} credentials found in your vault` });
    const result = await adapter.cancelOrder(creds, req.body);
    res.json({ broker, cancelled: result });
  } catch (err) {
    console.error(`${broker} cancel error:`, err.message);
    res.status(502).json({ error: `Failed to cancel order via ${broker}`, detail: err.message });
  }
});

// Zerodha-specific: exchange request_token for access_token (login step 3)
router.post('/zerodha/session', async (req, res) => {
  const { apiKey, apiSecret, requestToken, label } = req.body;
  try {
    const session = await brokers.zerodha.generateSession({ apiKey, apiSecret, requestToken });
    res.json({
      message: 'Session created. Now save apiKey + apiSecret + accessToken to /api/vault to persist it.',
      accessToken: session.access_token,
    });
  } catch (err) {
    console.error('Zerodha session error:', err.message);
    res.status(502).json({ error: 'Failed to create Zerodha session', detail: err.message });
  }
});

// Angel One-specific: login with clientcode+password+TOTP to get jwtToken
router.post('/angelone/session', async (req, res) => {
  const { apiKey, clientCode, password, totp } = req.body;
  try {
    const session = await brokers.angelone.login({ apiKey, clientCode, password, totp });
    res.json({
      message: 'Session created. Save apiKey + jwtToken + refreshToken to /api/vault to persist it.',
      ...session,
    });
  } catch (err) {
    console.error('Angel One session error:', err.message);
    res.status(502).json({ error: 'Failed to create Angel One session', detail: err.message });
  }
});

// Shoonya-specific: QuickAuth login to get susertoken
router.post('/shoonya/session', async (req, res) => {
  const { userId, password, totp, vendorCode, apiKey } = req.body;
  try {
    const session = await brokers.shoonya.login({ userId, password, totp, vendorCode, apiKey });
    if (session.stat !== 'Ok') {
      return res.status(401).json({ error: session.emsg || 'Shoonya login failed' });
    }
    res.json({
      message: 'Session created. Save userId + susertoken to /api/vault to persist it.',
      susertoken: session.susertoken,
    });
  } catch (err) {
    console.error('Shoonya session error:', err.message);
    res.status(502).json({ error: 'Failed to create Shoonya session', detail: err.message });
  }
});

module.exports = router;
