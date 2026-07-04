// ============================================
// ZERODHA (KITE CONNECT) ADAPTER — reference implementation
// ============================================
// Docs: https://kite.trade/docs/connect/v3/
// Zerodha uses an OAuth-like login flow:
//   1. User is redirected to Kite login with your app's API key.
//   2. Zerodha redirects back to your app with a `request_token`.
//   3. Your backend exchanges request_token + api_secret for an access_token.
//   4. access_token is used (with api_key) for all further API calls, valid ~1 trading day.
//
// This file only handles step 3 onward. Step 1/2 (the redirect) happens in the frontend.

const axios = require('axios');
const crypto = require('crypto');

const KITE_BASE = 'https://api.kite.trade';

/**
 * Step 3: Exchange request_token for access_token.
 * checksum = SHA-256(api_key + request_token + api_secret)
 */
async function generateSession({ apiKey, apiSecret, requestToken }) {
  const checksum = crypto
    .createHash('sha256')
    .update(apiKey + requestToken + apiSecret)
    .digest('hex');

  const response = await axios.post(
    `${KITE_BASE}/session/token`,
    new URLSearchParams({
      api_key: apiKey,
      request_token: requestToken,
      checksum,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  // response.data.data.access_token is what gets encrypted & stored via vaultService
  return response.data.data;
}

function authHeaders({ apiKey, accessToken }) {
  return {
    'X-Kite-Version': '3',
    Authorization: `token ${apiKey}:${accessToken}`,
  };
}

async function getProfile(creds) {
  const res = await axios.get(`${KITE_BASE}/user/profile`, { headers: authHeaders(creds) });
  return res.data.data;
}

async function getPositions(creds) {
  const res = await axios.get(`${KITE_BASE}/portfolio/positions`, { headers: authHeaders(creds) });
  return res.data.data;
}

async function getHoldings(creds) {
  const res = await axios.get(`${KITE_BASE}/portfolio/holdings`, { headers: authHeaders(creds) });
  return res.data.data;
}

async function placeOrder(creds, order) {
  // order: { exchange, tradingsymbol, transaction_type, quantity, order_type, product, variety }
  const res = await axios.post(
    `${KITE_BASE}/orders/${order.variety || 'regular'}`,
    new URLSearchParams(order),
    { headers: { ...authHeaders(creds), 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.data;
}

async function cancelOrder(creds, { variety, orderId }) {
  const res = await axios.delete(`${KITE_BASE}/orders/${variety || 'regular'}/${orderId}`, {
    headers: authHeaders(creds),
  });
  return res.data.data;
}

async function getOrders(creds) {
  const res = await axios.get(`${KITE_BASE}/orders`, { headers: authHeaders(creds) });
  return res.data.data;
}

module.exports = {
  generateSession,
  getProfile,
  getPositions,
  getHoldings,
  placeOrder,
  cancelOrder,
  getOrders,
};
