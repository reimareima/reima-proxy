// ─────────────────────────────────────────────────────────────────────
//  OTTO FEED (Awin)
//  OTTO's "Wohnen, Spielzeug und Baumarkt" feed has ~326.000 rows. While
//  streaming it we keep only furniture, lighting, rugs, textiles and decor
//  in the categories otto-match.js searches, one row per product and
//  colour, without descriptions. Matching itself reuses hoeffner-match.js.
//
//  Config (Railway variables):
//    AWIN_API_KEY     the same Awin product-feed key Höffner uses
//    OTTO_FEED_ID     optional, default 54165
// ─────────────────────────────────────────────────────────────────────

const zlib = require('zlib');
const { Readable } = require('stream');
const { parse } = require('csv-parse');
const { shapeRow, buildIndex, search } = require('./otto-match');

const API_KEY = (process.env.AWIN_API_KEY || '').trim();
const FEED_ID = (process.env.OTTO_FEED_ID || '54165').trim();
const REFRESH_MS = 12 * 60 * 60 * 1000;   // big feed: twice a day
const RETRY_MS = 20 * 60 * 1000;

const COLUMNS = [
  'aw_product_id', 'aw_deep_link', 'aw_image_url', 'product_name', 'search_price',
  'product_price_old', 'colour', 'custom_5', 'ShoppingNL:material',
  'merchant_product_category_path', 'parent_product_id', 'stock_quantity', 'delivery_time',
  'brand_name', 'average_rating',
];

function feedUrl() {
  if (!API_KEY) return '';
  const cols = COLUMNS.map(encodeURIComponent).join('%2C');
  return `https://productdata.awin.com/datafeed/download/apikey/${API_KEY}/fid/${FEED_ID}/format/csv/language/de/delimiter/%2C/compression/gzip/columns/${cols}/`;
}

const state = { index: null, loadedAt: 0, count: 0, rows: 0, loading: false, error: null };

async function load() {
  if (state.loading) return;
  const url = feedUrl();
  if (!url) { state.error = 'AWIN_API_KEY not set'; return; }
  state.loading = true;
  const started = Date.now();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const kept = [];
    const seen = new Set();
    let rows = 0;
    const parser = Readable.fromWeb(res.body)
      .pipe(zlib.createGunzip())
      .pipe(parse({ columns: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }));
    for await (const r of parser) {
      rows++;
      const s = shapeRow(r, seen);
      if (s) kept.push(s);
    }
    if (rows < 50000) throw new Error(`feed looks incomplete (${rows} rows)`);
    state.index = buildIndex(kept);
    state.count = state.index.items.length;
    state.rows = rows;
    state.loadedAt = Date.now();
    state.error = null;
    console.log(`[otto] feed loaded: ${state.count} products kept of ${rows} rows in ${Math.round((Date.now() - started) / 1000)}s`);
    setTimeout(load, REFRESH_MS);
  } catch (err) {
    state.error = err.message;
    console.error('[otto] feed load failed:', err.message);
    setTimeout(load, RETRY_MS);
  } finally {
    state.loading = false;
  }
}

function status() {
  return {
    ready: !!state.index,
    products: state.count,
    rows: state.rows,
    loaded_at: state.loadedAt ? new Date(state.loadedAt).toISOString() : null,
    loading: state.loading,
    error: state.error,
  };
}

function searchMany(items, limit) {
  if (!state.index) return null;
  return items.map(q => {
    try { return search(state.index, q, limit); }
    catch (err) { console.error('[otto] search error:', err.message); return { matched: false, results: [] }; }
  });
}

// Current price of hand-picked products (Partnershop), by Awin link
let byLink = null, byLinkFor = null;
function lookup(links) {
  if (!state.index) return null;
  if (byLinkFor !== state.index) {
    byLink = new Map();
    for (const v of state.index.items) if (v.link && !byLink.has(v.link)) byLink.set(v.link, v);
    byLinkFor = state.index;
  }
  return links.map(l => {
    const v = byLink.get(l);
    return v ? { price: v.price, oldPrice: v.oldPrice > v.price ? v.oldPrice : 0 } : null;
  });
}

module.exports = { load, status, searchMany, lookup };
