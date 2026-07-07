// src/routes/aiScreener.js
//
// AI STOCK SCREENER — matches bull-cartel-backend's existing structure exactly.
// Uses the same requireAuth middleware (src/middleware/auth.js) as your
// authRoutes / vaultRoutes / brokerRoutes.

const express = require("express");
const { OpenAI } = require("openai");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Keep this in sync with the fields renderMbFilter() on the frontend understands.
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
// (mounted at /api/ai in server.js, so the full path becomes /api/ai/screener)
router.post("/screener", requireAuth, async (req, res) => {
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
