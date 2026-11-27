// ─────────────────────────────────────────────────────────────────────
//  SIMILAR PRODUCTS (picture check)
//  The feeds find candidates by words (type, colour, material). Words
//  can't see shape, legs or tufting, so a "green velvet sofa" from the
//  feed may look nothing like the sofa in the design. Here Gemini looks
//  at the design and at each candidate's photo and scores how similar
//  they really are. Only high scores go back to the app.
//
//  POST /similar  { image: base64 JPEG of the design (≤ ~1 MB),
//                   items: [{ title, text, material?, price?, reason?, shops: [...] }] }
//  →  { results: [{ checked, found, matches: [{ shop, title, price, oldPrice, image, link, score }] }] }
// ─────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

// The newest plain "flash" model Google offers (models retire), unless set
let MODEL = (process.env.SIMILAR_MODEL || '').trim();
async function model(apiKey) {
  if (MODEL) return MODEL;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`);
  const names = ((await r.json()).models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(n => /^gemini-\d+(\.\d+)?-flash(-latest)?$/.test(n));
  names.sort((a, b) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1]));
  MODEL = names[0] || 'gemini-flash-latest';
  console.log('[similar] model:', MODEL, 'of', names.join(', '));
  return MODEL;
}
const MIN_SCORE = 8;
const IDEA_SCORE = 6;          // 6 = same kind of product, different look            // 8 = a shopper would accept it as that piece
const PER_SHOP = { otto: 10 };  // candidates per shop, others DEFAULT_PER_SHOP
const DEFAULT_PER_SHOP = 3;
const MAX_CANDIDATES = 14;
const MAX_ITEMS = 8;
const DAY_CAP = 4000;           // item checks per day (cost guard, ~0.1 ct each)

const cache = new Map();        // key -> result (last 600)
const day = { count: 0, resetAt: 0 };

// A smaller version of the product photo: fewer tokens, faster download
function smallImage(u) {
  u = String(u || '');
  if (/i\.otto\.de\//.test(u)) return u.replace(/\?.*$/, '') + '?w=200&h=200';
  if (/media\.hoeffner\.de\/medias\/(medium|zoom)\//.test(u)) return u.replace(/\/medias\/(medium|zoom)\//, '/medias/small/');
  if (/[?&]width=\d+/.test(u)) return u.replace(/([?&]width=)\d+/, '$1300');
  return u.replace('w=400&h=400', 'w=300&h=300');
}

async function fetchImage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'image/jpeg,image/png,image/webp,image/*' } });
    if (!r.ok) return null;
    const type = (r.headers.get('content-type') || '').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 600_000) return null;
    return { mime_type: type, data: buf.toString('base64') };
  } catch { return null; } finally { clearTimeout(t); }
}

function prompt(item, n) {
  const what = [item.title, item.text && item.text !== item.title ? `(${item.text})` : '', item.reason ? `– ${item.reason}` : '']
    .filter(Boolean).join(' ');
  return `Picture 1 is a room design. Find this piece in it: ${what}.
Pictures 2 to ${n + 1} are shop photos of candidate products C1 to C${n}.
For each candidate, rate how similar it looks to THAT piece as it appears in the room:
overall shape and silhouette, colour, material and texture, and details such as legs, arms, tufting, shade shape, pattern.
10 = could be the same piece. 8 = very similar, someone who likes the piece in the room would happily buy this one.
6 = same kind of product but a clearly different look. 3 = only the same product type. 0 = a different product or an unusable photo.
Be strict: a different silhouette or a different colour is at most 6.
If the piece is not visible in the room, set found to false.
Answer only with JSON: {"found": true, "scores": [{"id": "C1", "score": 0}]}`;
}

async function checkItem(look, item, FEEDS, apiKey) {
  // Candidates from the feeds (words only, may or may not look right)
  // Far outside the expected price it isn't what the design shows
  const pm = item.price.replace(/\./g, '').match(/(\d+)\D+(\d+)/);
  const lo = pm ? +pm[1] * 0.3 : 0, hi = pm ? +pm[2] * 2.2 : Infinity;
  const cands = [];
  for (const shop of item.shops) {
    const feed = FEEDS[shop];
    if (!feed) continue;
    const r = (feed.searchMany([{ text: item.text, alt: item.title, material: item.material, price: item.price }], 24) || [])[0];
    if (!r || !r.results) continue;
    // one per model: "Handloom Teppich, Naturweiß" and ", Off white" are the same rug
    const seen = new Set();
    const list = r.results.filter(p => {
      const base = String(p.title).split(/,\s/)[0].toLowerCase();
      if (seen.has(base) || (p.price && (p.price < lo || p.price > hi))) return false;
      seen.add(base);
      return true;
    });
    for (const p of list.slice(0, PER_SHOP[shop] || DEFAULT_PER_SHOP)) cands.push({ ...p, shop });
  }
  if (!cands.length) return { checked: true, found: null, matches: [] };
  const picked = cands.slice(0, MAX_CANDIDATES);
  const imgs = await Promise.all(picked.map(p => fetchImage(smallImage(p.image)) .then(x => x || (p.image2 ? fetchImage(p.image2) : null))));
  const usable = picked.map((p, i) => ({ p, img: imgs[i] })).filter(x => x.img);
  if (!usable.length) return { checked: true, found: null, matches: [] };

  const parts = [{ text: prompt(item, usable.length) }, { inline_data: look }];
  usable.forEach((x, i) => { parts.push({ text: `C${i + 1}:` }, { inline_data: x.img }); });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${await model(apiKey)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status} ${(await res.text()).slice(0, 80)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  let out;
  try { out = JSON.parse(text); } catch { throw new Error('bad JSON from Gemini'); }
  const score = new Map((out.scores || []).map(s => [String(s.id), Number(s.score) || 0]));
  const shape = m => ({ shop: m.shop, title: m.title, price: m.price, oldPrice: m.oldPrice || 0, image: m.image, image2: m.image2, link: m.link, score: m.score });
  const scored = usable.map((x, i) => ({ ...x.p, score: score.get(`C${i + 1}`) || 0 })).sort((a, b) => b.score - a.score);
  const matches = scored.filter(m => out.found !== false && m.score >= MIN_SCORE).slice(0, 3).map(shape);
  // No close match: the same kind of product in a different look, shown
  // as "ideas" so every card has something to look at
  const ideas = matches.length ? [] : scored.filter(m => m.score >= IDEA_SCORE).slice(0, 3).map(shape);
  return { checked: true, found: out.found !== false, matches, ideas, scores: usable.map((x, i) => [x.p.shop, x.p.title.slice(0, 40), score.get(`C${i + 1}`) || 0]) };
}

async function similar(body, FEEDS, apiKey) {
  const b64 = String(body?.image || '').replace(/^data:image\/\w+;base64,/, '');
  if (!b64 || b64.length > 1_600_000) return { error: 'image missing or too big' };
  const look = { mime_type: 'image/jpeg', data: b64 };
  const hash = crypto.createHash('sha1').update(b64).digest('hex');
  const items = (Array.isArray(body?.items) ? body.items : []).slice(0, MAX_ITEMS).map(q => ({
    title: String(q?.title || '').slice(0, 80),
    text: String(q?.text || '').slice(0, 160),
    material: String(q?.material || '').slice(0, 60),
    price: String(q?.price || '').slice(0, 30),
    reason: String(q?.reason || '').slice(0, 160),
    shops: (Array.isArray(q?.shops) ? q.shops : []).filter(s => FEEDS[s]).slice(0, 4),
  }));

  const now = Date.now();
  if (day.resetAt <= now) { day.count = 0; day.resetAt = now + 24 * 3600_000; }

  const results = await Promise.all(items.map(async item => {
    const key = `${hash}|${item.text}|${item.title}|${item.shops.join(',')}`;
    if (cache.has(key)) return cache.get(key);
    if (day.count >= DAY_CAP) return { checked: false, matches: [] };
    day.count++;
    try {
      const r = await checkItem(look, item, FEEDS, apiKey);
      cache.set(key, r);
      if (cache.size > 600) cache.delete(cache.keys().next().value);
      return r;
    } catch (err) {
      console.error('[similar]', err.message);
      return { checked: false, error: String(err.message).slice(0, 120), matches: [] };
    }
  }));
  return { results, used_today: day.count, model: MODEL };
}

module.exports = { similar };
