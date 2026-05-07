// ─────────────────────────────────────────────────────────────────────
//  REIMA PROXY SERVER
//  - Hides API keys from the frontend
//  - Rate-limits per IP (minute + day) and globally (cost cap)
//  - Routes /anthropic and /gemini to the respective providers
// ─────────────────────────────────────────────────────────────────────

const express = require('express');
const cors = require('cors');

const app = express();

// ─── CORS ──────────────────────────────────────────────────────────
// Only allow requests from your own domains — prevents others from
// using your proxy on your bill. Set ALLOWED_ORIGINS env var to a
// comma-separated list of allowed origins (no spaces).
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500',
  'null',
];

function normalizeOrigin(s) {
  if (!s) return '';
  // Strip trailing slashes, lowercase scheme+host
  return s.trim().replace(/\/+$/, '').toLowerCase();
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(normalizeOrigin)
  : DEFAULT_ORIGINS.map(normalizeOrigin)
).filter(Boolean);

console.log('[cors] Allowed origins:', ALLOWED_ORIGINS);

app.use(cors({
  origin: (origin, callback) => {
    // Requests with no origin (curl, server-to-server) are allowed
    if (!origin) return callback(null, true);
    const norm = normalizeOrigin(origin);
    if (ALLOWED_ORIGINS.includes(norm)) {
      return callback(null, true);
    }
    console.warn(`[cors] Blocked origin: "${origin}" (normalized: "${norm}")`);
    // IMPORTANT: return false instead of throwing — throwing causes 500 on preflight
    return callback(null, false);
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
}));

// Image-edit prompts include base64 image data — needs a generous body limit
app.use(express.json({ limit: '20mb' }));

// Trust the first proxy (Railway, Cloudflare, etc.) so x-forwarded-for is read correctly
app.set('trust proxy', 1);

// ─── CONFIG ────────────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY    = process.env.GEMINI_API_KEY;
const PORT          = process.env.PORT || 3000;

if (!ANTHROPIC_KEY) console.warn('⚠ ANTHROPIC_API_KEY not set — /anthropic will fail');
if (!GEMINI_KEY)    console.warn('⚠ GEMINI_API_KEY not set — /gemini will fail');

// Rate limits — tweak in one place
const RL = {
  PER_IP_PER_MIN:  20,    // 20 requests per minute per IP
  PER_IP_PER_DAY:  200,   // 200 per day per IP
  GLOBAL_PER_DAY:  2000,  // hard cost cap across all users
};

// ─── RATE LIMITER ──────────────────────────────────────────────────
// In-memory counters. For multi-instance deployments use Redis instead.
const ipMinute = new Map();   // ip -> { count, resetAt }
const ipDay    = new Map();   // ip -> { count, resetAt }
const globalDay = { count: 0, resetAt: nextMidnightUTC() };

function nextMidnightUTC() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function getClientIp(req) {
  // x-forwarded-for can be a comma-separated list — take the first (client)
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function checkRateLimit(req, res) {
  const now = Date.now();
  const ip  = getClientIp(req);

  // Reset windows if expired
  if (globalDay.resetAt <= now) {
    globalDay.count = 0;
    globalDay.resetAt = nextMidnightUTC();
  }

  // Global daily cap (cost protection)
  if (globalDay.count >= RL.GLOBAL_PER_DAY) {
    const retry = Math.ceil((globalDay.resetAt - now) / 1000);
    res.set('Retry-After', String(retry));
    res.status(429).json({
      error: 'Service is currently at capacity. Please try again tomorrow.',
      retry_after: retry,
      reason: 'global_daily_cap',
    });
    return false;
  }

  // Per-IP minute window
  let minRec = ipMinute.get(ip);
  if (!minRec || minRec.resetAt <= now) {
    minRec = { count: 0, resetAt: now + 60_000 };
    ipMinute.set(ip, minRec);
  }
  if (minRec.count >= RL.PER_IP_PER_MIN) {
    const retry = Math.ceil((minRec.resetAt - now) / 1000);
    res.set('Retry-After', String(retry));
    res.status(429).json({
      error: 'Too many requests, please slow down.',
      retry_after: retry,
      reason: 'ip_per_minute',
    });
    return false;
  }

  // Per-IP day window
  let dayRec = ipDay.get(ip);
  if (!dayRec || dayRec.resetAt <= now) {
    dayRec = { count: 0, resetAt: nextMidnightUTC() };
    ipDay.set(ip, dayRec);
  }
  if (dayRec.count >= RL.PER_IP_PER_DAY) {
    const retry = Math.ceil((dayRec.resetAt - now) / 1000);
    res.set('Retry-After', String(retry));
    res.status(429).json({
      error: 'Daily request limit reached for your IP.',
      retry_after: retry,
      reason: 'ip_per_day',
    });
    return false;
  }

  // OK — increment all
  minRec.count++;
  dayRec.count++;
  globalDay.count++;

  res.set('X-RateLimit-Remaining-Minute', String(RL.PER_IP_PER_MIN - minRec.count));
  res.set('X-RateLimit-Remaining-Day',    String(RL.PER_IP_PER_DAY - dayRec.count));
  return true;
}

// Cleanup expired records every 5 minutes (memory leak protection)
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of ipMinute) if (rec.resetAt <= now) ipMinute.delete(ip);
  for (const [ip, rec] of ipDay)    if (rec.resetAt <= now) ipDay.delete(ip);
}, 5 * 60_000);

// ─── ROUTES ────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    rate_limits: RL,
    global_day_used: globalDay.count,
    global_day_remaining: RL.GLOBAL_PER_DAY - globalDay.count,
  });
});

// Anthropic Messages API proxy
app.post('/anthropic', async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: ANTHROPIC_API_KEY missing' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    console.error('Anthropic proxy error:', err);
    res.status(502).json({ error: 'Upstream Anthropic request failed', detail: err.message });
  }
});

// Gemini image generation/edit proxy
// Frontend sends: { model: 'gemini-2.5-flash-image', body: {...} }
app.post('/gemini', async (req, res) => {
  if (!checkRateLimit(req, res)) return;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: GEMINI_API_KEY missing' });
  }

  const model = req.body?.model || 'gemini-2.5-flash-image';
  const body  = req.body?.body  || {};

  // Whitelist allowed models so the frontend can't ask for something pricey
  const ALLOWED_MODELS = new Set([
    'gemini-2.5-flash-image',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ]);
  if (!ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: `Model not allowed: ${model}` });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    console.error('Gemini proxy error:', err);
    res.status(502).json({ error: 'Upstream Gemini request failed', detail: err.message });
  }
});

// ─── START ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Reima proxy listening on http://localhost:${PORT}`);
  console.log(`   Rate limits: ${RL.PER_IP_PER_MIN}/min, ${RL.PER_IP_PER_DAY}/day per IP, ${RL.GLOBAL_PER_DAY}/day global`);
});
