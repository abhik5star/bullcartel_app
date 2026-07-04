# Bull Cartel — Backend

Real backend for the Bull Cartel trading dashboard. This replaces the old
frontend-only "vault" with actual server-side security: broker API keys are
encrypted with a server-only key, decrypted only in memory, only when a
broker API call needs to be made — never sent to or stored in the browser.

## What this actually secures (and what it doesn't)

**Secured:**
- Passwords: hashed with bcrypt (cost 12), never stored or logged in plain text.
- Broker API keys/tokens: AES-256-GCM encrypted at rest in Postgres, using
  `VAULT_MASTER_KEY` which lives only in this server's environment variables.
- Auth: JWT-based sessions, rate-limited login/register endpoints.
- Transport: deploy behind HTTPS (Railway/Render provide this automatically).

**Still your responsibility:**
- `VAULT_MASTER_KEY` and `JWT_SECRET` must be kept secret — anyone with them
  can decrypt all stored broker credentials or forge login tokens. Never
  commit `.env`, never share these values.
- Each broker (Zerodha, Angel One, Dhan, Shoonya, Binance, Delta Exchange
  India) requires you to register your own developer app / generate your own
  API key and get real credentials — see the header comments in each
  `src/brokers/indian/*.js` and `src/brokers/crypto/*.js` file for exact
  registration links.
- All 6 broker adapters are implemented (holdings, positions, place order,
  cancel order) against each broker's current public documentation. Test
  everything against sandbox/testnet or with tiny real amounts before
  trusting it with serious capital — broker APIs change their contracts
  without much notice.
- This backend places real orders when you call the order endpoints with
  real credentials. Test with paper-trading/sandbox credentials first.

## Local setup

```bash
cd bull-cartel-backend
npm install
cp .env.example .env
# edit .env: fill DATABASE_URL, JWT_SECRET, VAULT_MASTER_KEY at minimum

# generate secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # for VAULT_MASTER_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"  # for JWT_SECRET

npm run migrate   # creates tables in your Postgres database
npm run dev       # starts on http://localhost:4000
```

## Deploying to Railway (recommended)

1. Push this folder to a new GitHub repo (keep `.env` out of git — `.gitignore` already excludes it).
2. On [railway.app](https://railway.app): New Project → Deploy from GitHub repo.
3. Add a **PostgreSQL** plugin to the project — Railway sets `DATABASE_URL` automatically.
4. In your service's Variables tab, add: `JWT_SECRET`, `VAULT_MASTER_KEY`, `FRONTEND_URL`, `NODE_ENV=production`.
5. Once deployed, open a one-off shell (or add a deploy step) to run `npm run migrate`.
6. Update your frontend dashboard's API base URL to point at the Railway-provided domain.

## Broker coverage (2 sections)

**🇮🇳 Indian Market** — `src/brokers/indian/`
| Broker | Status | Auth model |
|---|---|---|
| Zerodha (Kite Connect) | ✅ holdings, positions, orders, cancel | OAuth-like: request_token → access_token |
| Angel One (SmartAPI) | ✅ holdings, positions, orders, cancel | clientcode+password+TOTP → jwtToken (⚠️ see note below) |
| Dhan | ✅ holdings, positions, orders, cancel, position-convert | access_token pasted directly from web.dhan.co |
| Shoonya (Finvasia) | ✅ holdings, positions, orders, cancel | userid+password+TOTP+vendor code → susertoken |

**₿ Crypto** — `src/brokers/crypto/`
| Broker | Status | Auth model |
|---|---|---|
| Binance | ✅ holdings (balances), open orders, place/cancel order | API key + HMAC-SHA256 signed query |
| Delta Exchange India | ✅ wallet balances, positions, open orders, place/cancel order | API key + HMAC-SHA256 signed request |

⚠️ **Angel One-specific note:** SEBI's algo-trading circular (effective 1 Aug 2025)
requires a **static IP registered with Angel One** before your API key's orders
will execute, and is progressively moving login to OAuth. Check
https://smartapi.angelone.in/docs for the current login method before relying
on the password+TOTP flow in `angelone.js` for live trading.

## API overview

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Get JWT |
| GET | `/api/vault` | ✅ | List connected brokers (no secrets returned) |
| POST | `/api/vault` | ✅ | Save/update a broker's credentials (encrypted) |
| DELETE | `/api/vault/:id` | ✅ | Remove a stored credential |
| GET | `/api/broker/sections` | ✅ | `{ indian: [...], crypto: [...] }` for building UI tabs |
| GET | `/api/broker/:broker/holdings` | ✅ | Fetch real holdings/balances |
| GET | `/api/broker/:broker/positions` | ✅ | Fetch real positions/open orders |
| POST | `/api/broker/:broker/order` | ✅ | Place a real order |
| DELETE | `/api/broker/:broker/order` | ✅ | Cancel an order |
| POST | `/api/broker/zerodha/session` | — | Exchange Zerodha request_token for access_token |
| POST | `/api/broker/angelone/session` | — | Angel One login (clientCode+password+TOTP) |
| POST | `/api/broker/shoonya/session` | — | Shoonya QuickAuth login |

All `✅` routes need `Authorization: Bearer <token>` header from login/register.

## Folder structure

```
src/
  server.js              # Express app entry point, security middleware
  db/
    schema.sql           # Postgres table definitions
    pool.js              # connection pool
    migrate.js            # run schema.sql against DATABASE_URL
  services/
    vaultService.js       # AES-256-GCM encrypt/decrypt for broker credentials
  middleware/
    auth.js               # JWT verification middleware
  routes/
    authRoutes.js         # register/login
    vaultRoutes.js         # CRUD for encrypted broker credentials
    brokerRoutes.js        # holdings/positions/orders, broker-agnostic
  brokers/
    index.js               # registry, exports SECTIONS = {indian:[...], crypto:[...]}
    indian/
      zerodha.js            # ✅ complete
      angelone.js            # ✅ complete (see SEBI/OAuth note above)
      dhan.js                 # ✅ complete
      shoonya.js               # ✅ complete
    crypto/
      binance.js              # ✅ complete
      delta.js                 # ✅ complete
```

## Next steps

1. Connect this backend to your existing dashboard frontend (replace the
   frontend-only vault/PIN logic with calls to these API routes).
2. Finish the stub adapters one broker at a time, starting with whichever
   you'll actually trade on first.
3. Add HTTPS custom domain + consider 2FA on your own login (on top of
   whatever 2FA each broker already requires).
