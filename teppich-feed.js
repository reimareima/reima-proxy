// ─────────────────────────────────────────────────────────────────────
//  TEPPICH.DE FEED (Awin)
//  Same idea as hoeffner-feed.js: downloads the teppich.de product feed
//  from Awin, keeps a search index in memory, refreshes it regularly.
//
//  Config (Railway variables):
//    AWIN_API_KEY          the same Awin product-feed key Höffner uses
//    TEPPICH_FEED_ID       optional, default 86518 = "teppich.de - Produktdaten DE"
// ─────────────────────────────────────────────────────────────────────

const zlib = require('zlib');
const { Readable } = require('stream');
const { parse } = require('csv-parse');
const { buildIndex, search } = require('./teppich-match');

const API_KEY = (process.env.AWIN_API_KEY || '').trim();
const FEED_ID = (process.env.TEPPICH_FEED_ID || '86518').trim();
const REFRESH_MS = 6 * 60 * 60 * 1000;   // every 6 hours (teppich.de updates once a day)
const RETRY_MS = 15 * 60 * 1000;

const COLUMNS = [
  'aw_product_id', 'aw_deep_link', 'aw_image_url', 'product_name', 'description',
  'search_price', 'product_price_old', 'colour', 'custom_1', 'custom_2', 'custom_3',
  'custom_4', 'custom_5', 'dimensions', 'merchant_product_category_path',
  'delivery_time', 'in_stock',
];

function feedUrl() {
  if (!API_KEY) return '';
  return `https://productdata.awin.com/datafeed/download/apikey/${API_KEY}/fid/${FEED_ID}/format/csv/language/de/delimiter/%2C/compression/gzip/columns/${COLUMNS.join('%2C')}/`;
}

const state = { index: null, loadedAt: 0, count: 0, variants: 0, loading: false, error: null };

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
      if (r.description) r.description = r.description.slice(0, 400);
      rows.push(r);
    }
    if (rows.length < 300) throw new Error(`feed looks incomplete (${rows.length} rows)`);
    state.index = buildIndex(rows);
    state.count = state.index.models.length;
    state.variants = state.index.models.reduce((n, m) => n + m.variants.length, 0);
    state.loadedAt = Date.now();
    state.error = null;
    console.log(`[teppich] feed loaded: ${state.count} models, ${state.variants} variants in ${Math.round((Date.now() - started) / 1000)}s`);
    setTimeout(load, REFRESH_MS);
  } catch (err) {
    state.error = err.message;
    console.error('[teppich] feed load failed:', err.message);
    setTimeout(load, RETRY_MS);
  } finally {
    state.loading = false;
  }
}

function status() {
  return {
    ready: !!state.index,
    models: state.count,
    variants: state.variants,
    loaded_at: state.loadedAt ? new Date(state.loadedAt).toISOString() : null,
    loading: state.loading,
    error: state.error,
  };
}

function searchMany(items, limit) {
  if (!state.index) return null;
  return items.map(q => {
    try { return search(state.index, q, limit); }
    catch (err) { console.error('[teppich] search error:', err.message); return { matched: false, results: [] }; }
  });
}

module.exports = { load, status, searchMany };
