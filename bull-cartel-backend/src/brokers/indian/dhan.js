// ============================================
// DHAN ADAPTER — INDIAN MARKET — ✅ complete reference implementation
// ============================================
// Docs: https://dhanhq.co/docs/v2/
// Auth model: access_token generated from web.dhan.co (Profile -> DhanHQ Trading APIs),
// valid 24h, renewable via /v2/RenewToken. No OAuth redirect needed — user pastes
// { dhanClientId, accessToken } straight into the vault.

const axios = require('axios');

const BASE = 'https://api.dhan.co/v2';

function authHeaders({ accessToken }) {
  return { 'access-token': accessToken, 'Content-Type': 'application/json' };
}

async function getProfile(creds) {
  const res = await axios.get(`${BASE}/profile`, { headers: authHeaders(creds) });
  return res.data;
}

async function getHoldings(creds) {
  const res = await axios.get(`${BASE}/holdings`, { headers: authHeaders(creds) });
  return res.data;
}

async function getPositions(creds) {
  const res = await axios.get(`${BASE}/positions`, { headers: authHeaders(creds) });
  return res.data;
}

async function getOrders(creds) {
  const res = await axios.get(`${BASE}/orders`, { headers: authHeaders(creds) });
  return res.data;
}

async function placeOrder(creds, order) {
  // order: { dhanClientId, transactionType, exchangeSegment, productType, orderType,
  //          validity, securityId, quantity, price, triggerPrice, disclosedQuantity }
  const res = await axios.post(`${BASE}/orders`, order, { headers: authHeaders(creds) });
  return res.data;
}

async function cancelOrder(creds, orderId) {
  const res = await axios.delete(`${BASE}/orders/${orderId}`, { headers: authHeaders(creds) });
  return res.data;
}

async function convertPosition(creds, conversion) {
  // conversion: { dhanClientId, fromProductType, exchangeSegment, positionType,
  //               securityId, convertQty, toProductType }
  const res = await axios.post(`${BASE}/positions/convert`, conversion, {
    headers: authHeaders(creds),
  });
  return res.data;
}

module.exports = {
  getProfile,
  getHoldings,
  getPositions,
  getOrders,
  placeOrder,
  cancelOrder,
  convertPosition,
};
