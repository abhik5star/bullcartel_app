// ============================================
// DELTA EXCHANGE INDIA ADAPTER — CRYPTO — ✅ complete reference implementation
// ============================================
// Docs: https://docs.india.delta.exchange/
// Auth model: API key + HMAC-SHA256 signature over
//   method + timestamp + requestPath + queryString + body
// Signature must arrive within 5 seconds of the timestamp (replay protection) —
// keep server clock NTP-synced.
// User generates API key/secret at https://www.delta.exchange/app/account/manageapikeys
// (IP whitelisting is required to create a key with trading permissions).

const axios = require('axios');
const crypto = require('crypto');

const BASE = 'https://api.india.delta.exchange';

function sign({ method, path, queryString = '', body = '', apiSecret, timestamp }) {
  const message = method + timestamp + path + queryString + body;
  return crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
}

function authHeaders({ apiKey, apiSecret }, { method, path, queryString = '', body = '' }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign({ method, path, queryString, body, apiSecret, timestamp });
  return {
    'api-key': apiKey,
    signature,
    timestamp,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function getPositions(creds) {
  const path = '/v2/positions/margined';
  const headers = authHeaders(creds, { method: 'GET', path });
  const res = await axios.get(`${BASE}${path}`, { headers });
  return res.data;
}

async function getHoldings(creds) {
  // Delta (derivatives exchange) equivalent of "holdings" is wallet balances.
  const path = '/v2/wallet/balances';
  const headers = authHeaders(creds, { method: 'GET', path });
  const res = await axios.get(`${BASE}${path}`, { headers });
  return res.data;
}

async function getOpenOrders(creds, productId) {
  const path = '/v2/orders';
  const queryString = productId ? `?product_id=${productId}&state=open` : '?state=open';
  const headers = authHeaders(creds, { method: 'GET', path, queryString });
  const res = await axios.get(`${BASE}${path}${queryString}`, { headers });
  return res.data;
}

async function placeOrder(creds, order) {
  // order: { product_id, size, side: 'buy'|'sell', order_type: 'limit_order'|'market_order', limit_price }
  const path = '/v2/orders';
  const body = JSON.stringify(order);
  const headers = authHeaders(creds, { method: 'POST', path, body });
  const res = await axios.post(`${BASE}${path}`, body, { headers });
  return res.data;
}

async function cancelOrder(creds, { id, product_id }) {
  const path = '/v2/orders';
  const body = JSON.stringify({ id, product_id });
  const headers = authHeaders(creds, { method: 'DELETE', path, body });
  const res = await axios.delete(`${BASE}${path}`, { headers, data: body });
  return res.data;
}

module.exports = { getHoldings, getPositions, getOpenOrders, placeOrder, cancelOrder };
