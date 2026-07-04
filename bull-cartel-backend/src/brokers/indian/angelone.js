// ============================================
// ANGEL ONE (SmartAPI) ADAPTER — INDIAN MARKET — ✅ complete reference implementation
// ============================================
// Docs: https://smartapi.angelone.in/docs
//
// ⚠️ IMPORTANT — SEBI compliance changes (effective 1 Aug 2025, still in force):
//   1. Static IP required — you must register a static IP with Angel One before
//      orders from your API key will execute. Register via SmartAPI -> My Profile -> My APIs.
//   2. Order rate limit: ~10-20 orders/sec enforced on place/modify/cancel/GTT.
//   3. Login is transitioning to OAuth — the old loginByPassword (clientcode+password+TOTP)
//      flow below may be phased out. Check https://smartapi.angelone.in/docs for the
//      current recommended login method before going live, since Angel One said full
//      OAuth docs would roll out progressively.
//
// Auth flow (current, password-based): clientcode + password/PIN + TOTP -> jwtToken + refreshToken.
// Session is valid until midnight or manual logout, whichever is first.

const axios = require('axios');

const BASE = 'https://apiconnect.angelone.in';

function baseHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    // Angel One requires these IP/MAC headers on every request. For a server-side
    // backend, use your server's actual outbound static IP here (must match what
    // you registered with Angel One), not a placeholder.
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '127.0.0.1',
    'X-MACAddress': '00:00:00:00:00:00',
    'X-PrivateKey': apiKey,
  };
}

async function login({ apiKey, clientCode, password, totp }) {
  const res = await axios.post(
    `${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`,
    { clientcode: clientCode, password, totp },
    { headers: baseHeaders(apiKey) }
  );
  return res.data.data; // { jwtToken, refreshToken, feedToken }
}

async function getProfile({ apiKey, jwtToken }) {
  const res = await axios.get(`${BASE}/rest/secure/angelbroking/user/v1/getProfile`, {
    headers: { ...baseHeaders(apiKey), Authorization: `Bearer ${jwtToken}` },
  });
  return res.data.data;
}

async function getHoldings({ apiKey, jwtToken }) {
  const res = await axios.get(`${BASE}/rest/secure/angelbroking/portfolio/v1/getHolding`, {
    headers: { ...baseHeaders(apiKey), Authorization: `Bearer ${jwtToken}` },
  });
  return res.data.data;
}

async function getPositions({ apiKey, jwtToken }) {
  const res = await axios.get(`${BASE}/rest/secure/angelbroking/order/v1/getPosition`, {
    headers: { ...baseHeaders(apiKey), Authorization: `Bearer ${jwtToken}` },
  });
  return res.data.data;
}

async function placeOrder({ apiKey, jwtToken }, order) {
  // order: { variety, tradingsymbol, symboltoken, transactiontype, exchange,
  //          ordertype, producttype, duration, price, quantity }
  const res = await axios.post(
    `${BASE}/rest/secure/angelbroking/order/v1/placeOrder`,
    order,
    { headers: { ...baseHeaders(apiKey), Authorization: `Bearer ${jwtToken}` } }
  );
  return res.data.data;
}

async function cancelOrder({ apiKey, jwtToken }, { variety, orderid }) {
  const res = await axios.post(
    `${BASE}/rest/secure/angelbroking/order/v1/cancelOrder`,
    { variety, orderid },
    { headers: { ...baseHeaders(apiKey), Authorization: `Bearer ${jwtToken}` } }
  );
  return res.data.data;
}

async function getOrderBook({ apiKey, jwtToken }) {
  const res = await axios.get(`${BASE}/rest/secure/angelbroking/order/v1/getOrderBook`, {
    headers: { ...baseHeaders(apiKey), Authorization: `Bearer ${jwtToken}` },
  });
  return res.data.data;
}

module.exports = { login, getProfile, getHoldings, getPositions, placeOrder, cancelOrder, getOrderBook };
