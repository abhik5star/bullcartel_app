// ============================================
// SHOONYA (Finvasia) ADAPTER — INDIAN MARKET — ✅ complete reference implementation
// ============================================
// Docs: https://shoonya.com/api-documentation
// Auth model: QuickAuth login (userid + SHA-256 hashed password + TOTP/OTP +
// vendor code + an appkey = SHA256(userid|api_key)) -> susertoken, used as
// jKey on every subsequent request.

const axios = require('axios');
const crypto = require('crypto');

const BASE = 'https://api.shoonya.com/NorenWClientTP';

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function login({ userId, password, totp, vendorCode, apiKey }) {
  const appkey = sha256(`${userId}|${apiKey}`);
  const pwd = sha256(password);

  const payload = {
    uid: userId,
    pwd,
    factor2: totp,
    vc: vendorCode,
    appkey,
    imei: 'api',
    source: 'API',
  };

  const res = await axios.post(`${BASE}/QuickAuth`, `jData=${JSON.stringify(payload)}`);
  return res.data; // { stat: 'Ok', susertoken, ... }
}

async function getHoldings({ userId, susertoken }) {
  const payload = { uid: userId };
  const res = await axios.post(
    `${BASE}/Holdings`,
    `jData=${JSON.stringify(payload)}&jKey=${susertoken}`
  );
  return res.data;
}

async function getPositions({ userId, susertoken }) {
  const payload = { uid: userId, actid: userId };
  const res = await axios.post(
    `${BASE}/PositionBook`,
    `jData=${JSON.stringify(payload)}&jKey=${susertoken}`
  );
  return res.data;
}

async function getOrderBook({ userId, susertoken }) {
  const payload = { uid: userId };
  const res = await axios.post(
    `${BASE}/OrderBook`,
    `jData=${JSON.stringify(payload)}&jKey=${susertoken}`
  );
  return res.data;
}

async function placeOrder({ userId, susertoken }, order) {
  // order: { exch, tsym, qty, dscqty, prc, prd, trantype, prctyp, ret }
  const payload = { uid: userId, actid: userId, ordersource: 'API', ...order };
  const res = await axios.post(
    `${BASE}/PlaceOrder`,
    `jData=${JSON.stringify(payload)}&jKey=${susertoken}`
  );
  return res.data;
}

async function cancelOrder({ susertoken }, orderno) {
  const payload = { norenordno: orderno };
  const res = await axios.post(
    `${BASE}/CancelOrder`,
    `jData=${JSON.stringify(payload)}&jKey=${susertoken}`
  );
  return res.data;
}

module.exports = { login, getHoldings, getPositions, getOrderBook, placeOrder, cancelOrder };
