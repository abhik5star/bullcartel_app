// ============================================
// BROKER REGISTRY — organized into two sections
// ============================================
const zerodha = require('./indian/zerodha');
const angelone = require('./indian/angelone');
const dhan = require('./indian/dhan');
const shoonya = require('./indian/shoonya');
const binance = require('./crypto/binance');
const delta = require('./crypto/delta');

const INDIAN_MARKET = { zerodha, angelone, dhan, shoonya };
const CRYPTO = { binance, delta };

// Flat map so routes can do brokers[brokerName] regardless of section
const ALL = { ...INDIAN_MARKET, ...CRYPTO };

const SECTIONS = {
  indian: Object.keys(INDIAN_MARKET),
  crypto: Object.keys(CRYPTO),
};

module.exports = { ...ALL, INDIAN_MARKET, CRYPTO, SECTIONS };
