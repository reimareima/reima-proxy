// ─────────────────────────────────────────────────────────────────────
//  RUGVISTA PRODUCT MATCHING
//  Pure functions, no Node APIs.
//
//  Input:  rows from the Awin feed "RV_DE" (fid 88595, ~14.700 rows)
//  Output: buildIndex(rows) -> index; search(index, query) -> products
//
//  The feed has no colour/material fields. What a rug IS sits in:
//    merchant_deep_link  slug, very regular:
//        /p/keshan-teppich-245x354-cm-handgeknupft-dunkelrot-schwarz-
//           persien-iran-sehr-gross-wollteppich-ABCZU176
//        -> shape word (laufer/rund/quadratisch), make (handgeknupft,
//           handgewebt, maschinell hergestellt), main + second colour,
//           origin, size class, material word (wollteppich, juteteppich…)
//    product_type        "Rug > Kilim > Plain (single colored)" -> style, pattern
//    description         pile, washable, outdoor, faux fur, fringes …
//
//  About 2/3 of the feed are one-of-a-kind hand-made rugs (Persian,
//  Kelim, Gabbeh, Berber). They are grouped by name + colours + type, so
//  the different sizes of "Hamadan, dark red/black, medallion" behave like
//  one model with many sizes.
//
//  Query parsing is shared with teppich-match.js, so "sure" means the
//  same thing for both rug shops.
// ─────────────────────────────────────────────────────────────────────

const { parseQuery } = require('./teppich-match');

const SITE = 'https://www.rugvista.de';

// slug colour word -> colour name as used by the shared query colours
const COLMAP = {
  weiss: 'Weiß', 'off-white': 'Creme', cremeweiss: 'Creme', elfenbeinweiss: 'Elfenbein', naturweiss: 'Creme',
  beige: 'Beige', hellbeige: 'Beige', cremebeige: 'Beige', greige: 'Taupe', taupe: 'Taupe',
  grau: 'Grau', hellgrau: 'Grau', silbergrau: 'Silber', dunkelgrau: 'Anthrazit', kohlengrau: 'Anthrazit',
  schwarz: 'Schwarz', braun: 'Braun', hellbraun: 'Braun', dunkelbraun: 'Braun',
  rost: 'Orange', terrakotta: 'Orange', terra: 'Orange', orange: 'Orange',
  gelb: 'Gelb', dunkelgelb: 'Gelb', senfgelb: 'Gelb', altgelb: 'Gelb', hellgelb: 'Gelb', gold: 'Gold',
  grun: 'Grün', dunkelgrun: 'Grün', waldgrun: 'Grün', olivegrun: 'Grün', hellgrun: 'Hellgrün', minzgrun: 'Hellgrün',
  turkis: 'Türkis', dunkelturkis: 'Türkis', hellturkis: 'Türkis',
  blau: 'Blau', hellblau: 'Blau', altblau: 'Blau', dunkelblau: 'Navy-Blau', marineblau: 'Navy-Blau',
  rot: 'Rot', dunkelrot: 'Rot', korallenrot: 'Rot', burgunderrot: 'Beerenfarben',
  rosa: 'Rosa', hellrosa: 'Rosa', altrosa: 'Rosa', dunkelrosa: 'Pink',
  lila: 'Lila', dunkellila: 'Lila', helllila: 'Lila', mauve: 'Lila',
  mehrfarbig: 'Mehrfarbig', pastell: 'Mehrfarbig',
};
// colours that sit together in one family: a two-tone "Off white / Beige"
// still reads as one calm colour
const FAMILY = {
  'Weiß': 'hell', Creme: 'hell', Elfenbein: 'hell', Beige: 'hell', Taupe: 'hell',
  Grau: 'grau', Silber: 'grau', Anthrazit: 'grau',
};
// colour -> Rugvista category slug
const SITE_COLOUR = {
  'Weiß': 'weiss', Creme: 'weiss', Elfenbein: 'weiss', Beige: 'beige', Taupe: 'beige', Sand: 'beige', Natur: 'beige',
  Grau: 'grau', Silber: 'grau', Anthrazit: 'grau', Charcoal: 'grau', Schwarz: 'schwarz', 'Schwarz-Weiß': 'schwarz',
  Braun: 'braun', Coffee: 'braun', Orange: 'orange', Kupfer: 'orange', Gelb: 'gelb', Gold: 'gelb',
  'Grün': 'gruen', 'Hellgrün': 'gruen', 'Türkis': 'tuerkis', Blau: 'blau', 'Navy-Blau': 'blau',
  Rot: 'rot', Beerenfarben: 'rot', Rosa: 'rosa', Pink: 'rosa', Lila: 'lila', Mehrfarbig: 'mehrfarbig',
};
const SLUG_MATERIAL = {
  wollteppich: 'Wolle', baumwollteppich: 'Baumwolle', seidenteppich: 'Seide', viskoseteppich: 'Viskose',
  juteteppich: 'Jute', kunststoffteppich: 'Kunstfaser',
};
const SITE_MATERIAL = { Wolle: 'wolle', Baumwolle: 'baumwolle', Jute: 'jute', Viskose: 'viskose', Seide: 'seide' };
const SITE_PATTERN = {
  Einfarbig: 'einfarbig', Gestreift: 'gestreift', Geometrisch: 'geometrisch', Floral: 'blumen',
  Abstrakt: 'abstrakt', Kariert: 'kariert', Orientalisch: 'orientalisch',
};
const SITE_SHAPE = { rund: 'rund', laeufer: 'laeufer', quadrat: 'quadratisch' };

// product_type leaf -> pattern (names shared with teppich-match)
function typePattern(type) {
  const t = type.toLowerCase();
  if (/plain \(single colored\)/.test(t)) return 'Einfarbig';
  if (/striped/.test(t)) return 'Gestreift';
  if (/checkered/.test(t)) return 'Kariert';
  if (/floral|rose kilim/.test(t)) return 'Floral';
  if (/abstract/.test(t)) return 'Abstrakt';
  if (/dotted/.test(t)) return 'Gepunktet';
  if (/animal/.test(t)) return 'Tiere';
  if (/geometric|kilim|berber|gabbeh modern/.test(t)) return 'Geometrisch';
  if (/medallion|oriental|mamluk|kazak|keshan|heriz|nain|tabriz|ziegler|afghan|baluch|pakistan|china|kashmir/.test(t)) return 'Orientalisch';
  if (/patchwork|organic/.test(t)) return 'Patchwork';
  if (/pictorial/.test(t)) return 'Motiv';
  return '';
}

// description words -> flags (also accepts precomputed r._flags in tests)
const FLAG_RE = [
  ['w', /(?<!baum)wolle\b|schafswolle|\bwool|aus wolle|wollteppich/i], ['c', /baumwoll/i], ['j', /\bjute|sisal/i],
  ['p', /polypropylen|synthetisch|kunstfaser|polyester|kunststoff|plastik/i], ['v', /viskose/i], ['k', /seide|silk/i],
  ['h', /hochflor|shaggy|langflor|flauschig/i], ['f', /flachgewebe|flachgewebt|flach gewebt|kelim|kilim|dhurrie/i],
  ['x', /waschbar/i], ['o', /außenbereich|outdoor|terrasse|balkon/i], ['r', /rutschfest|anti-rutsch/i],
  ['u', /kunstfell|fellteppich|felloptik|fell-optik/i], ['q', /fransen/i], ['z', /hoch-tief|hoch- und tief|schlingen/i],
  ['g', /handgewebt|handgeknüpft|handgetuftet|handgefertigt|in handarbeit/i],
  ['m', /muster|gemustert|motiv|streifen|gestreift|geometrisch|abstrakt|ornament|grafisch|marmor|blumen|floral|karo|kariert|gepunktet|wellen/i],
];
function flagsOf(r) {
  if (r._flags != null) return r._flags;
  const d = String(r.description || '');
  return FLAG_RE.filter(([, re]) => re.test(d)).map(([k]) => k).join('');
}

function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

// slug -> { colours, shape word, make, material }
function parseSlug(link) {
  const s = String(link || '').replace(/^.*\/p\//, '').replace(/-[A-Z0-9]+$/, '');
  const tail = s.includes('-cm-') ? s.split('-cm-')[1] : s;
  const toks = tail.replace(/off-white/g, 'off_white').split('-').map(t => t.replace('off_white', 'off-white'));
  const colours = [];
  let shape = null, make = '', material = null, extra = '', tone = '';
  for (const t of toks) {
    if (COLMAP[t]) { if (!colours.length) tone = /^hell/.test(t) ? 'hell' : /^dunkel|^marine|^kohlen|^burgunder|^wald/.test(t) ? 'dunkel' : ''; if (colours.length < 2) colours.push(COLMAP[t]); continue; }
    if (t === 'laufer') shape = 'laeufer';
    else if (t === 'rund') shape = 'rund';
    else if (t === 'quadratisch') shape = 'quadrat';
    else if (t === 'unregelmassig') shape = 'frei';
    else if (/^hand(geknupft|gewebt|getuftet|loom)$/.test(t)) make = 'hand';
    else if (t === 'maschinell') make = 'maschine';
    else if (SLUG_MATERIAL[t]) material = SLUG_MATERIAL[t];
    else if (/badematte|fussmatte|kissenbezug|wanddeko|sitzpouf/.test(t)) extra = t;
  }
  return { colours, shape, make, material, extra, tone };
}

function parseDims(d, shapeWord) {
  const m = String(d || '').match(/(\d+)\s*x\s*(\d+)/);
  if (!m) return null;
  const w = Math.min(+m[1], +m[2]), h = Math.max(+m[1], +m[2]);
  const shape = shapeWord === 'rund' ? 'rund' : shapeWord === 'frei' ? 'frei'
    : shapeWord === 'laeufer' || h / w >= 2.4 ? 'laeufer' : (shapeWord === 'quadrat' || w === h ? 'quadrat' : 'rechteck');
  return { w, h, shape };
}

// Rugvista's own 450x600 picture; the zoom one is 1500x2000
function rvImage(u) {
  const id = (String(u || '').match(/desk_pdp_zoom\/(\d+)/) || [])[1];
  return id ? `https://images.rugvista.net/image/desk_pdp/${id}` : '';
}

// "Gabbeh Teppich 150x215" -> "Gabbeh Teppich"; "Ravi Teppich - Grau  Ø 200" -> "Ravi Teppich - Grau"
function baseName(n) {
  return String(n || '').replace(/\s+Ø\s*\d+\s*$/, '').replace(/\s+\d+\s*x\s*\d+\s*$/, '').replace(/\s+/g, ' ').trim();
}

// ── Index ────────────────────────────────────────────────────────────
function buildIndex(rows) {
  const models = new Map();
  for (const r of rows) {
    const full = String(r.product_name || '').trim();
    if (!full) continue;
    const price = parseFloat(r.search_price) || 0;
    if (!price) continue;
    if (r.in_stock === '0') continue;
    const slug = parseSlug(r.merchant_deep_link);
    if (/fussmatte|kissenbezug|wanddeko|sitzpouf/.test(slug.extra)) continue;
    const type = String(r.product_type || '');
    if (/door mat|cushion|wall decoration|ottoman/i.test(type)) continue;
    const dims = parseDims(r.dimensions, slug.shape);
    if (!dims) continue;
    const fl = flagsOf(r);
    if (/handloom|handgewebt|handgeknüpft|handgetuftet|handtufted|handweb/i.test(full) || /g/.test(fl)) slug.make = 'hand';

    const base = baseName(full);
    const key = `${base}|${slug.colours.join('/')}|${type}`;
    let m = models.get(key);
    if (!m) {
      const leaf = type.split(' > ').pop();
      let pattern = typePattern(type);
      const twoTone = slug.colours.length > 1 && FAMILY[slug.colours[0]] && FAMILY[slug.colours[0]] === FAMILY[slug.colours[1]];
      if (!pattern) {
        // "Modern" collections carry no pattern in the feed. Two colours or
        // pattern words = patterned; otherwise unknown (carved, relief,
        // trellis or a lion's head all exist): never "the plain rug"
        pattern = /m/.test(fl) || slug.colours.length > 1 || slug.colours[0] === 'Mehrfarbig' ? 'Muster' : '';
      }
      const materials = new Set();
      if (slug.material) materials.add(slug.material);
      else if (/p/.test(fl)) materials.add('Kunstfaser');
      else {
        if (/w/.test(fl)) materials.add('Wolle');
        if (/c/.test(fl)) materials.add('Baumwolle');
        if (/j/.test(fl)) materials.add('Jute');
        if (/v/.test(fl)) materials.add('Viskose');
      }
      const lt = type.toLowerCase();
      const styles = new Set();
      // knotted Oriental rugs; a kelim is a flat weave, not an "Orientteppich"
      if (!/kilim/.test(lt) && (/oriental|medallion|mamluk|vintage > (medallion|floral)/.test(lt) || pattern === 'Orientalisch')) styles.add('Orientalisch');
      if (/berber|kilim|gabbeh|patchwork/.test(lt)) styles.add('Boho');
      if (/vintage|patina/.test(lt)) styles.add('Vintage');
      if (/beni ourain|berber neutral/.test(lt)) styles.add('Skandi');
      if (slug.make === 'hand') styles.add('Handgewebt');
      if (pattern === 'Einfarbig') styles.add('Schlicht');
      const features = new Set();
      if (/x/.test(fl)) features.add('Waschbar');
      if (/r/.test(fl)) features.add('Rutschfest');
      if (/q/.test(fl)) features.add('Fransen');
      if (/z/.test(fl)) features.add('Hoch-Tief-Effekt');
      const kelim = /kilim/.test(lt);
      const fur = /u/.test(fl);
      m = {
        name: base, title: base.replace(/\s+-\s+/, ', '), t: norm(base), type, leaf,
        colour: slug.colours[0] || '', colour2: slug.colours[1] || '', twoTone, tone: slug.tone,
        materials, styles, features, pattern,
        pileClass: /f/.test(fl) || kelim ? 'flach' : /h/.test(fl) ? 'hoch' : '',
        shaggy: /h/.test(fl) && !kelim, fur, flat: /f/.test(fl) || kelim || materials.has('Jute'),
        kids: /> kids/.test(lt), outdoor: /o/.test(fl) && materials.has('Kunstfaser'),
        bath: /badematte/.test(slug.extra) || /bath mat/i.test(type) || /bade/i.test(r.merchant_category || ''),
        kitchen: false, berber: /berber/.test(lt), kelim,
        unique: slug.make === 'hand' && !/ - /.test(full),
        variants: [],
      };
      models.set(key, m);
    }
    m.variants.push({
      id: r.aw_product_id, dims, size: dims.shape === 'rund' ? `Ø ${dims.w} cm` : `${dims.w}x${dims.h} cm`,
      price, oldPrice: parseFloat(r.product_price_old) || 0,
      image: rvImage(r.merchant_image_url) || String(r.aw_image_url || ''),
      image2: String(r.aw_image_url || '').replace('w=200&h=200', 'w=400&h=400'),
      link: r.aw_deep_link, delivery: r.delivery_time || '2-5 Werktage',
    });
  }
  const list = [...models.values()];
  for (const m of list) m.shapes = new Set(m.variants.map(v => v.dims.shape));
  return { models: list, builtAt: Date.now() };
}

// ── Size choice (same rules as teppich.de) ───────────────────────────
const DEFAULT_SIZE = {
  rug: { w: 160, h: 230 }, kids: { w: 120, h: 170 }, bath: { w: 60, h: 100 }, outdoor: { w: 160, h: 230 },
  kitchen: { w: 80, h: 200 }, laeufer: { w: 80, h: 300 }, rund: { w: 160, h: 160 }, quadrat: { w: 200, h: 200 },
};
function pickVariant(m, Q) {
  const want = Q.size || DEFAULT_SIZE[Q.shape] || DEFAULT_SIZE[Q.kind] || DEFAULT_SIZE.rug;
  let pool = m.variants;
  const shape = Q.shape || (Q.kind === 'kitchen' ? 'laeufer' : null);
  if (shape) {
    const same = pool.filter(v => v.dims.shape === shape);
    if (same.length) pool = same;
  } else {
    const rect = pool.filter(v => v.dims.shape === 'rechteck');
    if (!rect.length) return { v: pool.reduce((a, b) => (b.price < a.price ? b : a)), sizeOk: false };
    pool = rect;
  }
  const area = want.w * want.h;
  let best = null, bestD = Infinity;
  for (const v of pool) {
    const a = v.dims.w * v.dims.h;
    const d = Math.abs(Math.log(a / area)) + 0.3 * Math.abs(Math.log((v.dims.h / v.dims.w) / (want.h / want.w)));
    // prefer the cheaper of two nearly equal pieces
    if (d < bestD - 0.02 || (Math.abs(d - bestD) <= 0.02 && best && v.price < best.price)) { bestD = d; best = v; }
  }
  if (!best) return { v: null, sizeOk: false };
  if (Q.size) return { v: best, sizeOk: bestD < 0.25 };
  const roomRug = (Q.kind === 'rug' || Q.kind === 'outdoor') && !Q.shape;
  const tooSmall = roomRug && best.dims.w * best.dims.h < area * 0.5;
  return { v: best, sizeOk: !tooSmall };
}

function priceScore(p, Q) {
  if (!Q.priceMax) return 0;
  if (p >= Q.priceMin && p <= Q.priceMax) return 14;
  if (p >= Q.priceMin * 0.6 && p <= Q.priceMax * 1.5) return 4;
  if (p > Q.priceMax * 3) return -25;
  return -10;
}

// ── Scoring ──────────────────────────────────────────────────────────
function scoreModel(m, Q) {
  let s = 30;
  const why = [];
  const fail = [];

  if (Q.kind === 'kids' && !m.kids) return null;
  if (Q.kind !== 'kids' && m.kids) return null;
  if (Q.kind === 'bath' && !m.bath) return null;
  if (Q.kind !== 'bath' && m.bath) return null;
  if (Q.kind === 'outdoor' && !m.outdoor) return null;
  if (Q.kind === 'kitchen') { if (m.shapes.has('laeufer')) s += 10; else return null; }
  if (Q.kind === 'rug' && m.outdoor) s -= 4;
  if (m.shapes.has('frei') && m.shapes.size === 1) return null;   // irregular hides / pieces

  if (Q.shape) {
    if (m.shapes.has(Q.shape)) { s += 15; why.push(Q.shape); }
    else { s -= 40; fail.push('shape'); }
  }

  if (Q.colour) {
    const c1 = m.colour, c2 = m.colour2;
    const near = c => Q.colour.exact.includes(c) || Q.colour.close.includes(c);
    // second colour of the rug: fine if it's the one asked second
    // ("Creme Terrakotta"), a shade of the first, or a calm two-tone
    const c2Ok = !c2 || m.twoTone || near(c2) || (Q.colour2 && (Q.colour2.exact.includes(c2) || Q.colour2.close.includes(c2)));
    if (Q.colour.exact.includes(c1)) { s += c2Ok ? 40 : 28; why.push('colour'); }
    else if (Q.colour.close.includes(c1)) { s += 12; why.push('colour~'); fail.push('colour~'); }
    else if (Q.colour2 && c2 && Q.colour.exact.includes(c2) && Q.colour2.exact.includes(c1)) { s += 36; why.push('colour'); }
    else { s -= 35; fail.push('colour'); }
    if (!c2Ok) fail.push('colour2');
    // "dunkelgrün" is not a light green, "hellgrau" not a charcoal
    const qTone = /^dunkel|^marine|^tannen|^wald|^flaschen|^nacht/.test(Q.colour.word) ? 'dunkel' : /^hell|^pastell|^zart/.test(Q.colour.word) ? 'hell' : '';
    if (qTone && m.tone && qTone !== m.tone) { s -= 15; fail.push('tone'); }
    // a dark colour asked: a merely related shade (greige for dark brown) isn't it
    if (qTone === 'dunkel' && !Q.colour.exact.includes(c1)) fail.push('tone');
    // two colours asked: the rug must show both
    if (Q.colour2 && !(c2 && ([c1, c2].some(c => Q.colour2.exact.includes(c) || Q.colour2.close.includes(c))))) { s -= 12; fail.push('colour2'); }
  }

  if (Q.material) {
    if (m.materials.has(Q.material)) { s += m.materials.size === 1 ? 36 : 30; why.push('mat'); }
    else { s -= 25; fail.push('material'); }
  }

  if (Q.pile === 'hoch') { if (m.shaggy && !m.fur) { s += 25; why.push('hochflor'); } else { s -= 25; fail.push('pile'); } }
  else if (Q.pile === 'fur') { if (m.fur) { s += 30; why.push('fell'); } else { s -= 30; fail.push('pile'); } }
  else if (Q.pile === 'kurz') { if (m.shaggy) { s -= 15; fail.push('pile'); } }
  else if (Q.pile === 'flach') { if (m.flat) { s += 20; why.push('flach'); } else { s -= 20; fail.push('pile'); } }
  else if (m.fur) s -= 15;

  for (const st of Q.styles) {
    if (m.styles.has(st)) { s += 20; why.push(st); }
    else { s -= 12; fail.push('style'); }
  }
  for (const pt of Q.patterns) {
    if (m.pattern === pt) { s += 18; why.push(pt); }
    else if (pt === 'Geometrisch' && /gemustert|muster/.test(Q.text) && m.pattern && m.pattern !== 'Einfarbig') { s += 10; why.push('muster'); }
    else { s -= 12; fail.push('pattern'); }
  }
  if (!Q.patterns.length && !Q.styles.length && !Q.berber && !Q.kelim) {
    if (m.pattern === 'Einfarbig') s += 8;
    else { s -= 10; fail.push('pattern'); }
  }
  if (Q.berber) { if (m.berber) { s += 30; why.push('berber'); } else fail.push('berber'); }
  if (Q.kelim) { if (m.kelim) { s += 25; why.push('kelim'); } else { s -= 5; fail.push('kelim'); } }

  for (const f of Q.features) {
    if (m.features.has(f)) { s += 12; why.push(f); }
    else { s -= 10; fail.push('feature'); }
  }
  return { s, why, fail };
}

// ── Rugvista category link with what the query asks for ──────────────
function buildUrl(index, Q) {
  if (Q.kind === 'bath') {
    const c = Q.colour && SITE_COLOUR[Q.colour.exact[0]];
    return { url: `${SITE}/c/badematten${c ? '/' + c : ''}`, complete: false };
  }
  const parts = [];
  let asked = 0, applied = 0;
  let pool = Q.kind === 'kids' ? index.models.filter(m => m.kids) : index.models.filter(m => !m.kids && !m.bath);
  const tryAdd = (slug, test) => {
    asked++;
    if (!slug) return;
    const next = pool.filter(test);
    if (next.length >= 2) { pool = next; parts.push(slug); applied++; }
  };
  if (Q.kind === 'kids') parts.push('kinderzimmer');
  if (Q.kind === 'outdoor') tryAdd('outdoor', m => m.outdoor);
  if (Q.kind === 'kitchen') tryAdd('kueche', m => m.shapes.has('laeufer'));
  if (Q.colour) { const c = SITE_COLOUR[Q.colour.exact[0]]; tryAdd(c, m => SITE_COLOUR[m.colour] === c); }
  if (Q.material) tryAdd(SITE_MATERIAL[Q.material], m => m.materials.has(Q.material));
  if (Q.shape) tryAdd(SITE_SHAPE[Q.shape], m => m.shapes.has(Q.shape));
  for (const p of Q.patterns) tryAdd(SITE_PATTERN[p], m => m.pattern === p);
  if (Q.kelim) tryAdd('kelim', m => m.kelim);
  if (Q.berber) tryAdd('berber', m => m.berber);
  if (Q.styles.includes('Orientalisch') && !Q.patterns.includes('Orientalisch')) tryAdd('orientalisch', m => m.styles.has('Orientalisch'));
  if (Q.styles.includes('Vintage')) tryAdd('vintage', m => m.styles.has('Vintage'));
  if (Q.styles.includes('Skandi')) tryAdd('skandinavisch', m => m.styles.has('Skandi'));
  if (Q.pile === 'hoch') tryAdd('hoch/flor', m => m.shaggy);
  if (Q.features.includes('Waschbar')) tryAdd('waschbar', m => m.features.has('Waschbar'));
  return { url: `${SITE}/c/teppiche${parts.length ? '/' + parts.join('/') : ''}`, complete: applied === asked };
}

// ── Search ───────────────────────────────────────────────────────────
// query: { text, material?, price?, alt? } -> { matched, sure, url, complete, results }
function search(index, q, limit = 4) {
  const Q = parseQuery(q);
  // a second colour word ("Wollteppich Creme Terrakotta")
  if (Q.colour) {
    const after = String(q.text || '').toLowerCase().split(/[\s,/()+&]+/).filter(w => w && w !== Q.colour.word);
    for (const w of after) {
      const c = parseQuery({ text: 'teppich ' + w }).colour;
      if (c && c.site !== Q.colour.site && !Q.colour.exact.includes(c.exact[0]) && !Q.colour.close.includes(c.exact[0])) { Q.colour2 = c; break; }
    }
  }
  if (Q.excluded === 'not-a-rug') return { matched: false, reason: Q.excluded, results: [] };
  // real sheepskin: Rugvista has none
  if (Q.excluded === 'real-fur') return { matched: false, reason: Q.excluded, url: `${SITE}/c/teppiche`, complete: false, results: [] };
  const { url, complete } = buildUrl(index, Q);

  const scored = [];
  for (const m of index.models) {
    const r = scoreModel(m, Q);
    if (!r) continue;
    const { v, sizeOk } = pickVariant(m, Q);
    if (!v) continue;
    let s = r.s + priceScore(v.price, Q);
    s += sizeOk ? (Q.size ? 10 : 0) : -15;
    // far above the budget isn't the rug that was meant (a 2.000 € Persian
    // for a 150–400 € suggestion)
    const priceOk = !Q.priceMax || v.price <= Q.priceMax * 2;
    const hardFails = r.fail.filter(f => f !== 'colour~');
    const sure = hardFails.length === 0 && sizeOk && priceOk;
    scored.push({ m, v, s, why: r.why, sure });
  }
  scored.sort((a, b) => (b.sure - a.sure) || (b.s - a.s) || (a.v.price - b.v.price));
  const top = scored[0] ? scored[0].s : 0;
  const out = scored.filter(x => x.s >= top - 50).slice(0, limit);

  return {
    matched: out.length > 0,
    sure: !!(out[0] && out[0].sure),
    url, complete,
    colour: Q.colour ? Q.colour.exact[0] : null,
    results: out.map(({ m, v, s, why, sure }) => ({
      sure, id: v.id,
      title: `${m.title}, ${v.size}`,
      price: v.price, oldPrice: v.oldPrice > v.price ? v.oldPrice : 0,
      colour: m.colour, image: v.image, image2: v.image2, link: v.link, delivery: v.delivery,
      size: v.size, category: m.unique ? 'Handgefertigtes Unikat' : m.kids ? 'Kinderteppich' : 'Teppich',
      score: Math.round(s), why,
    })),
  };
}

if (typeof module !== 'undefined') module.exports = { buildIndex, search, parseSlug };
