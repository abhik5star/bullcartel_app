// ============================================
// BINANCE ADAPTER — CRYPTO — ✅ complete reference implementation
// ============================================
// Docs: https://developers.binance.com/docs/binance-spot-api-docs
// Auth model: API key + HMAC-SHA256 signed query string (no OAuth redirect).
// User generates API key/secret on binance.com and enters both directly into
// the vault via POST /api/vault { broker: 'binance', apiKey, apiSecret }.

const axios = require('axios');
const crypto = require('crypto');

const BASE = 'https://api.binance.com';

function sign(queryString, apiSecret) {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

async function getHoldings({ apiKey, apiSecret }) {
  // Binance calls this "account info" — balances array is the equivalent of holdings.
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = sign(query, apiSecret);

  const res = await axios.get(`${BASE}/api/v3/account?${query}&signature=${signature}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  // Only return non-zero balances to keep the payload useful
  const balances = (res.data.balances || []).filter(
    (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
  );
  return { ...res.data, balances };
}

async function getPositions({ apiKey, apiSecret }) {
  // Spot Binance has no "positions" concept (that's futures); return open orders instead,
  // which is the closest equivalent for a spot-only integration.
  return getOpenOrders({ apiKey, apiSecret });
}

async function getOpenOrders({ apiKey, apiSecret }, symbol) {
  const timestamp = Date.now();
  let query = `timestamp=${timestamp}`;
  if (symbol) query += `&symbol=${symbol}`;
  const signature = sign(query, apiSecret);

  const res = await axios.get(`${BASE}/api/v3/openOrders?${query}&signature=${signature}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  return res.data;
}

async function placeOrder({ apiKey, apiSecret }, order) {
  // order: { symbol, side: 'BUY'|'SELL', type: 'MARKET'|'LIMIT', quantity, price (if LIMIT), timeInForce }
  const timestamp = Date.now();
  const params = new URLSearchParams({ ...order, timestamp });
  const signature = sign(params.toString(), apiSecret);
  params.append('signature', signature);

  const res = await axios.post(`${BASE}/api/v3/order?${params.toString()}`, null, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  return res.data;
}

async function cancelOrder({ apiKey, apiSecret }, { symbol, orderId }) {
  const timestamp = Date.now();
  const query = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
  const signature = sign(query, apiSecret);

  const res = await axios.delete(`${BASE}/api/v3/order?${query}&signature=${signature}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  return res.data;
}

module.exports = { getHoldings, getPositions, getOpenOrders, placeOrder, cancelOrder };
