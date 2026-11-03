// ─────────────────────────────────────────────────────────────────────
//  HÖFFNER FEED (Awin)
//  Downloads the Möbel Höffner product feed from Awin, keeps a search
//  index in memory and refreshes it every few hours.
//
//  Höffner's programme terms: the Awin feed is the ONLY allowed data
//  source (no scraping) and it should be re-imported several times a day.
//
//  Config (Railway variables), one of:
//    AWIN_API_KEY   the Awin product-feed key (the long code in the
//                   "Feed-Übersicht" link under Tools > Create-a-Feed).
//                   Optional AWIN_FEED_ID, default 30097 = Möbel Höffner DE.
//    AWIN_FEED_URL  or the full download URL of the feed.
//  The key never goes into the frontend or the repo.
// ─────────────────────────────────────────────────────────────────────

const zlib = require('zlib');
const { Readable } = require('stream');
const { parse } = require('csv-parse');
const { buildIndex, search } = require('./hoeffner-match');

const API_KEY = (process.env.AWIN_API_KEY || '').trim();
const FEED_ID = (process.env.AWIN_FEED_ID || '30097').trim();
const FEED_URL = (process.env.AWIN_FEED_URL || '').trim()
  || (API_KEY ? `https://productdata.awin.com/datafeed/download/apikey/${API_KEY}/fid/${FEED_ID}/format/csv/language/de/delimiter/%2C/compression/gzip/columns/x/` : '');
const REFRESH_MS = 6 * 60 * 60 * 1000;   // every 6 hours
const RETRY_MS = 15 * 60 * 1000;         // after a failed download

// Only the columns we use: smaller download, less memory
const COLUMNS = [
  'aw_product_id', 'aw_deep_link', 'aw_image_url', 'product_name', 'description',
  'search_price', 'product_price_old', 'colour', 'custom_2',
  'merchant_product_category_path', 'delivery_time',
];

function feedUrl() {
  if (!FEED_URL) return '';
  // Ask for our column set and gzip, whatever the stored URL says
  return FEED_URL
    .replace(/\/columns\/[^/]*\/?/, `/columns/${COLUMNS.join('%2C')}/`)
    .replace(/\/compression\/[^/]*\//, '/compression/gzip/');
}

const state = { index: null, loadedAt: 0, count: 0, loading: false, error: null };

async function load() {
  if (state.loading) return;
  const url = feedUrl();
  if (!url) { state.error = 'AWIN_API_KEY not set'; return; }
  state.loading = true;
  const started = Date.now();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = [];
    const parser = Readable.fromWeb(res.body)
      .pipe(zlib.createGunzip())
      .pipe(parse({ columns: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }));
    for await (const r of parser) {
      // keep the description short, it's only used for matching
      if (r.description) r.description = r.description.slice(0, 600);
      // 400px product image instead of the 200px default
      if (r.aw_image_url) r.aw_image_url = r.aw_image_url.replace('w=200&h=200', 'w=400&h=400');
      rows.push(r);
    }
    if (rows.length < 1000) throw new Error(`feed looks incomplete (${rows.length} rows)`);
    state.index = buildIndex(rows);
    state.count = state.index.items.length;
    state.loadedAt = Date.now();
    state.error = null;
    console.log(`[hoeffner] feed loaded: ${state.count} products in ${Math.round((Date.now() - started) / 1000)}s`);
    setTimeout(load, REFRESH_MS);
  } catch (err) {
    // keep serving the previous index if we have one
    state.error = err.message;
    console.error('[hoeffner] feed load failed:', err.message);
    setTimeout(load, RETRY_MS);
  } finally {
    state.loading = false;
  }
}

function status() {
  return {
    ready: !!state.index,
    products: state.count,
    loaded_at: state.loadedAt ? new Date(state.loadedAt).toISOString() : null,
    loading: state.loading,
    error: state.error,
  };
}

// items: [{ text, material?, price? }]  ->  [{ matched, sure, results }]
function searchMany(items, limit) {
  if (!state.index) return null;
  return items.map(q => {
    try { return search(state.index, q, limit); }
    catch (err) { console.error('[hoeffner] search error:', err.message); return { matched: false, results: [] }; }
  });
}

module.exports = { load, status, searchMany };
