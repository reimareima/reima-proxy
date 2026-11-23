// ─────────────────────────────────────────────────────────────────────
//  CASA MORO FEED (Awin)
//  Same idea as teppich-feed.js: downloads the Casa Moro product feed
//  from Awin, keeps a search index in memory, refreshes it regularly.
//  Casa Moro sends a Google-format feed (no fid), served from the
//  "darwin" download URL. The gzip has several members; Node's gunzip
//  reads them all.
//
//  Config (Railway variables):
//    AWIN_API_KEY          the same Awin product-feed key Höffner uses
//    CASAMORO_FEED_ID      optional, default F3113 = Casa Moro DE
// ─────────────────────────────────────────────────────────────────────

const zlib = require('zlib');
const { Readable } = require('stream');
const { parse } = require('csv-parse');
const { buildIndex, search } = require('./casamoro-match');

const API_KEY = (process.env.AWIN_API_KEY || '').trim();
const FEED_ID = (process.env.CASAMORO_FEED_ID || 'F3113').trim();
const REFRESH_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;

function feedUrl() {
  if (!API_KEY) return '';
  return `https://ui.awin.com/productdata-darwin-download/publisher/2903059/${API_KEY}/1/feed/${FEED_ID}.csv.gz`;
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
      rows.push({
        title: r.title, description: String(r.description || '').slice(0, 600), link: r.link,
        image_link: r.image_link, aw_deep_link: r.aw_deep_link, availability: r.availability,
        price: r.price, sale_price: r.sale_price,
      });
    }
    if (rows.length < 300) throw new Error(`feed looks incomplete (${rows.length} rows)`);
    state.index = buildIndex(rows);
    state.count = state.index.models.length;
    state.loadedAt = Date.now();
    state.error = null;
    console.log(`[casamoro] feed loaded: ${state.count} products in stock (${rows.length} rows) in ${Math.round((Date.now() - started) / 1000)}s`);
    setTimeout(load, REFRESH_MS);
  } catch (err) {
    state.error = err.message;
    console.error('[casamoro] feed load failed:', err.message);
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

function searchMany(items, limit) {
  if (!state.index) return null;
  return items.map(q => {
    try { return search(state.index, q, limit); }
    catch (err) { console.error('[casamoro] search error:', err.message); return { matched: false, results: [] }; }
  });
}

module.exports = { load, status, searchMany };
