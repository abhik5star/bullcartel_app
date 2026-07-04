-- ============================================
-- BULL CARTEL DATABASE SCHEMA
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- Broker credentials: NEVER stored in plain text.
-- ciphertext/iv/auth_tag come from AES-256-GCM encryption in vaultService.js
-- The server can decrypt these (using VAULT_MASTER_KEY) only when it needs
-- to make an authenticated call to the broker's API on the user's behalf.
CREATE TABLE IF NOT EXISTS broker_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  broker VARCHAR(50) NOT NULL,          -- 'zerodha' | 'angelone' | 'dhan' | 'shoonya' | 'binance' | 'delta'
  label VARCHAR(100),                    -- user-friendly nickname, e.g. "My Zerodha"
  ciphertext TEXT NOT NULL,              -- encrypted JSON blob of {apiKey, apiSecret, accessToken, ...}
  iv VARCHAR(32) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, broker, label)
);

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  broker VARCHAR(50) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL,             -- 'BUY' | 'SELL'
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  order_id VARCHAR(100),
  status VARCHAR(30) DEFAULT 'PENDING',  -- 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED'
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  trade_id INTEGER REFERENCES trades(id) ON DELETE SET NULL,
  title VARCHAR(255),
  notes TEXT,
  pnl NUMERIC,
  tags VARCHAR(255)[],
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_credentials_user ON broker_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
