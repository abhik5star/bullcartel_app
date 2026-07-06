aiScreener.js/*
  AI STOCK SCREENER — BACKEND ROUTE (fully self-contained, no edits needed)
  --------------------------------------------------------------------------
  File: routes/aiScreener.js  (save it here in your existing bull-cartel-backend)

  Wiring (in your main server file, e.g. server.js / app.js) — ONE line:
      app.use(require('./routes/aiScreener'));

  Env vars needed (Railway → your project → Variables):
      OPENAI_API_KEY=sk-...
      JWT_SECRET=...        (the SAME secret your /api/auth/login already signs
                              tokens with — must match or every request will 401)

  Install once:
      npm install openai express jsonwebtoken

  Notes:
  - No dependency on your existing middleware file/path — auth is verified
    inline right here with the standard `jsonwebtoken` package, using the
    Bearer token the frontend already sends (authToken from apiRequest()).
    That means this file works as-is, with zero edits.
  - The OpenAI key stays server-side, in an env var. It never reaches the browser.
  - The model returns STRUCTURED JSON only (fixed fields) — never a code string,
    so the frontend never eval()s anything. A bad/adversarial prompt can at worst
    produce a filter that matches nothing or everything, not run arbitrary code.
  - Matches what the frontend already expects: POST /api/ai/screener { prompt },
    called from runAiScreener() in the dashboard.
*/

const express = require("express");
const jwt = require("jsonwebtoken");
const { OpenAI } = require("openai");

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Inline auth check — verifies the same Bearer JWT your /api/auth/login issues.
// No import needed from your existing middleware folder, so nothing to wire up.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET not set on server" });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Keep this in sync with the fields renderMbFilter() on the frontend actually
// understands. Add fields on both sides together if you extend it later.
const SCREENER_SCHEMA_DESCRIPTION = `
Return ONLY a JSON object (no markdown, no explanation text outside the JSON) with this exact shape:
{
  "filters": {
    "maxPrice": number | null,
    "minPrice": number | null,
    "minVolSurge": number | null,
    "minDelivery": number | null,
    "minRevCagr": number | null,
    "minProfitCagr": number | null,
    "minRoe": number | null,
    "maxDe": number | null,
    "maxPledge": number | null,
    "minPromoterHold": number | null,
    "newsSent": "pos" | "neu" | "neg" | "all" | null,
    "sector": string | null,
    "cap": "Small" | "Mid" | "Large" | "all" | null
  },
  "explanation": string
}
Only set fields the user's query actually implies; leave everything else null.
"explanation" should be a short (<20 words) plain-language summary of what you filtered for, in the same language mix (Hindi/English) the user used.
`.trim();

function sanitizeFilters(raw) {
  // Whitelist + type-check every field. Anything unexpected is dropped
  // rather than passed through, regardless of what the model returned.
  const numeric = [
    "maxPrice", "minPrice", "minVolSurge", "minDelivery",
    "minRevCagr", "minProfitCagr", "minRoe", "maxDe",
    "maxPledge", "minPromoterHold",
  ];
  const out = {};
  if (raw && typeof raw === "object") {
    for (const key of numeric) {
      if (typeof raw[key] === "number" && Number.isFinite(raw[key])) out[key] = raw[key];
    }
    if (["pos", "neu", "neg", "all"].includes(raw.newsSent)) out.newsSent = raw.newsSent;
    if (["Small", "Mid", "Large", "all"].includes(raw.cap)) out.cap = raw.cap;
    if (typeof raw.sector === "string" && raw.sector.length < 60) out.sector = raw.sector;
  }
  return out;
}

// POST /api/ai/screener   { prompt: string }
router.post("/api/ai/screener", requireAuth, async (req, res) => {
  const prompt = (req.body?.prompt || "").toString().trim();
  if (!prompt) return res.status(400).json({ error: "prompt is required" });
  if (prompt.length > 300) return res.status(400).json({ error: "prompt too long" });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY not set on server" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SCREENER_SCHEMA_DESCRIPTION },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    let parsed;
    try {
      parsed = JSON.parse(completion.choices[0].message.content);
    } catch {
      return res.status(502).json({ error: "AI response was not valid JSON" });
    }

    return res.json({
      filters: sanitizeFilters(parsed.filters),
      explanation: typeof parsed.explanation === "string" ? parsed.explanation.slice(0, 200) : "Filters applied.",
    });
  } catch (err) {
    console.error("AI screener error:", err);
    return res.status(500).json({ error: "AI screener failed, try again" });
  }
});

module.exports = router;

