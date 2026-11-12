// ─────────────────────────────────────────────────────────────────────
//  TEPPICH.DE PRODUCT MATCHING
//  Pure functions, no Node APIs (same file can be tested in a browser).
//
//  Input:  rows from the Awin product feed "teppich.de - Produktdaten DE"
//  Output: buildIndex(rows) -> index; search(index, query) -> products
//
//  The feed is small (~360 models, ~2400 size/colour variants) and well
//  structured, so matching works on its fields, not on free text:
//    colour      main colour
//    custom_1    material(s)          "Wolle, Baumwolle"
//    custom_2    style(s)             "Boho, Skandi"
//    custom_3    features             "Waschbar, Rutschfest, Fransen"
//    custom_4    pile height          "12 mm"
//    custom_5    pattern              "Geometrisch"
//    dimensions  size and shape       "160x230 cm", "120 cm rund"
//
//  A query is scored per model+colour; then the size closest to the
//  asked one (or a sensible default) is picked. "sure" means every
//  property the query names (colour, material, shape, pile, style,
//  pattern, features) is really there, so the frontend may show it as
//  THE product. Otherwise it only gets the filtered teppich.de link.
// ─────────────────────────────────────────────────────────────────────

const SITE = 'https://www.teppich.de';

// teppich.de filter ids (Shopware property options, read 12.11.2026).
// Options of the same group are OR-ed, groups are AND-ed.
const P = {
  colour: {
    Beige: 'fedce6da51f1460ebde4a31244efa86d', Creme: 'd69ddc69e99a41c396d2d5b3054a1586',
    Grau: '061a8b086b6f4a0d976297b74920f300', Braun: '044e54dc57b146a0ba2df281369165d5',
    Blau: '3fb0000f270e4a0c97baf6f08a86581a', Rosa: '3a3d25a0d66949b5bf8bcf60ac18e985',
    'Grün': 'a014ee47c1594a648699659dfa1aed4e', Gelb: '50a0dcf30c204fd2a56001699676ec76',
    Rot: 'aa68b176289c44f0a93cc081fd241f27', Lila: 'fe02b186e983438a9e12a88d915553d7',
    Mehrfarbig: '61afd70af7a34aaf930c256c79c5197d', Schwarz: 'f67c8fb386f448439e516e94e89321a0',
    'Schwarz-Weiß': 'dc6c67ba6321447298b00730272b6c3e', 'Weiß': 'd9a6ed9a18f8422aa02d9a7d871aadbb',
  },
  material: {
    Baumwolle: 'b93ace286ece47e3be08ba8169a888db', Wolle: '28bc7f1ea2fa4e8ca4a70bd0df8ea00a',
    Jute: 'c8e745df471440b0ace600b5b0452a09', Viskose: '107e6034046442f6bc47989edc67da09',
  },
  shape: {
    rund: '11c2b71bfe35449195ada1f51a7cb587', laeufer: '3be8227e971d4ebc832ed13d60a509b1',
    quadrat: 'd394d76f97104ccda910ae3cee209bd2', oval: 'e36b402cc4f64b70a73aedd3d35ee657',
  },
  pile: {
    flach: '299ecb7a0ad64dc38b1693c4b94642a6', kurz: '4af8c375a4984863938330003888b5d1',
    hoch: 'bcb64288619d41e4a85656602d9954cd', extra: '5f14a95436654c389298f0138f620e6f',
  },
  style: {
    Schlicht: 'a86d1af77b5e435eab77bfb9e8faf7f6', Boho: '80bd70cc208647c297b728b544b03b80',
    Skandi: 'a49d73c8e91e4d15be24b7daec946b31', Industrial: '8782e49a8c824c22bf23405adae4a4da',
    Vintage: '90d2cfc2f75d4829921385442eb87723', Orientalisch: 'c79adba522de41d09ac08b5bc539eb9c',
    Handgewebt: 'fd51e3788dc748798b25ff29a20dd3b7', 'Hygge / Gemütlich': 'afd386d5e89e4bcdab6160ff1fa812d6',
  },
  pattern: {
    Einfarbig: '3a9ec39283544b86a181005b2af8b241', Abstrakt: 'bb42b46b48554b869faff5d083a55ee1',
    Floral: '125b2e2434b14a85acf23a6359002c11', Wellenmuster: '9538e599f02f4c61878e698b81d60972',
    Orientalisch: '1102b706b0814effa9b3717d075ac9c9', Gepunktet: '7a2eb24c178f4b228e20912bfec02412',
    Gestreift: 'b1f480d8c6ce4afa9230ab0b5351b5bc', Geometrisch: '0e9ef50129304efaa94fd8d79186d8f0',
    Kariert: '116f6db5c03249bdb8e65c2fe2865617', 'Auto/Straße': '1541e0b236a84211b5a38950f6aa532c',
    Tiere: 'e3127f1a5d4e4722a92c04432f1f697a', Geografie: 'b69eceb1fd6c4ff5b260fef9367e8886',
  },
  feature: {
    Waschbar: '5ddd46972003404badd170b7675964de', Rutschfest: 'b83772de2f0941079d871e9adad10667',
    Fransen: '423011e4d7da44a0ad6ab8ccbc8b2b71', 'Hoch-Tief-Effekt': 'e6135cc3d300443b8e593508b304ea7f',
    Wendbar: '3fa4aefebb47439fa4f4bf43e060f361',
  },
};

// Category pages for the special kinds of rug
const KIND_PATH = {
  bath: '/badezimmer-teppiche/', kids: '/kinderteppiche/', outdoor: '/outdoor-teppiche/',
  kitchen: '/kuechenteppiche/', rug: '/teppiche/',
};

// Feed colour -> the colour group teppich.de's filter puts it in
const SITE_COLOUR = {
  Beige: 'Beige', Sand: 'Beige', Natur: 'Beige', 'Dunkel-Beige': 'Beige', Taupe: 'Beige',
  Creme: 'Creme', Elfenbein: 'Creme', 'Creme-Pink': 'Creme',
  Grau: 'Grau', Silber: 'Grau', Anthrazit: 'Grau', Charcoal: 'Grau',
  Schwarz: 'Schwarz', 'Weiß': 'Weiß', 'Schwarz-Weiß': 'Schwarz-Weiß', 'Weiß-Anthrazit': 'Schwarz-Weiß',
  Braun: 'Braun', Coffee: 'Braun', Blau: 'Blau', 'Navy-Blau': 'Blau', 'Türkis': 'Blau',
  'Grün': 'Grün', 'Hellgrün': 'Grün', Gelb: 'Gelb', Gold: 'Gelb',
  Rot: 'Rot', Beerenfarben: 'Rot', Orange: 'Rot', Kupfer: 'Rot', Rosa: 'Rosa', Pink: 'Rosa',
  Lila: 'Lila', Mehrfarbig: 'Mehrfarbig',
};

// Query colour word -> [feed colours that ARE it, feed colours close enough,
// teppich.de filter colour]. First hit in the query wins.
const COLOURS = [
  [/^(schwarz-?weiß|schwarz-?weiss|schwarzweiß)/,     ['Schwarz-Weiß', 'Weiß-Anthrazit'], ['Schwarz', 'Weiß'], 'Schwarz-Weiß'],
  [/^(weiß|weiss|schneeweiß|reinweiß)/,               ['Weiß'], ['Creme', 'Elfenbein'], 'Weiß'],
  [/^(creme|cremeweiß|cremefarben|elfenbein|off-?white|ecru|wollweiß|naturweiß)/, ['Creme', 'Elfenbein'], ['Weiß', 'Beige', 'Sand', 'Natur'], 'Creme'],
  [/^(beige|sand|natur|naturfarben|hafer|leinen|camel|kamel|hellbeige)/, ['Beige', 'Sand', 'Natur', 'Dunkel-Beige'], ['Creme', 'Elfenbein', 'Taupe'], 'Beige'],
  [/^(taupe|greige)/,                                  ['Taupe'], ['Beige', 'Dunkel-Beige', 'Grau'], 'Beige'],
  [/^(anthrazit|dunkelgrau|charcoal|graphit|schiefer)/, ['Anthrazit', 'Charcoal'], ['Grau', 'Schwarz'], 'Grau'],
  [/^(grau|hellgrau|steingrau|silbergrau|silber)/,     ['Grau', 'Silber'], ['Anthrazit', 'Taupe'], 'Grau'],
  [/^(schwarz)/,                                       ['Schwarz'], ['Anthrazit', 'Charcoal', 'Schwarz-Weiß'], 'Schwarz'],
  [/^(braun|hellbraun|dunkelbraun|cognac|mokka|schoko|karamell|caramel|kastanie|walnuss|nussbaum|kaffee)/, ['Braun', 'Coffee'], ['Taupe', 'Dunkel-Beige'], 'Braun'],
  [/^(terrakotta|terracotta|rost|rostrot|rostfarben|rostbraun|orange|kupfer|zimt|apricot|ziegel)/, ['Orange', 'Kupfer'], ['Rot', 'Braun', 'Gold'], 'Rot'],
  [/^(gelb|senf|senfgelb|ocker|curry|honig)/,          ['Gelb', 'Gold'], ['Orange'], 'Gelb'],
  [/^(gold|goldfarben|messing)/,                       ['Gold'], ['Gelb', 'Kupfer'], 'Gelb'],
  [/^(mint|mintgrün)/,                                 ['Hellgrün', 'Türkis'], ['Grün'], 'Grün'],
  [/^(grün|gruen|salbei|salbeigrün|oliv|olivgrün|moosgrün|tannengrün|dunkelgrün|smaragd|khaki|flaschengrün|jade)/, ['Grün', 'Hellgrün'], ['Türkis'], 'Grün'],
  [/^(petrol|türkis|tuerkis|aqua)/,                    ['Türkis'], ['Blau', 'Grün'], 'Blau'],
  [/^(navy|marine|marineblau|dunkelblau|nachtblau|indigo)/, ['Navy-Blau', 'Blau'], ['Türkis'], 'Blau'],
  [/^(blau|hellblau|taubenblau|rauchblau|eisblau|graublau)/, ['Blau', 'Navy-Blau'], ['Türkis'], 'Blau'],
  [/^(beere|beerenfarben|aubergine)/,                  ['Beerenfarben'], ['Rot', 'Lila'], 'Rot'],
  [/^(rot|bordeaux|weinrot|dunkelrot)(e|er|es|en|em)?$/, ['Rot', 'Beerenfarben'], ['Orange', 'Pink'], 'Rot'],
  [/^(rosa|altrosa|rosé|rose|puder|pudrig|blush|pastellrosa)$/, ['Rosa', 'Creme-Pink'], ['Pink'], 'Rosa'],
  [/^(pink|magenta)/,                                  ['Pink'], ['Rosa'], 'Rosa'],
  [/^(lila|violett|lavendel|flieder|mauve)/,           ['Lila'], ['Beerenfarben', 'Rosa'], 'Lila'],
  [/^(bunt|mehrfarbig|multicolor|farbenfroh|farbig)/,  ['Mehrfarbig'], [], 'Mehrfarbig'],
];

// Query word -> material in the feed's custom_1
const MATERIALS = [
  [/baumwoll/, 'Baumwolle'],
  [/(^|[^m])woll|schurwoll|\bwool/, 'Wolle'],
  [/jute|sisal|seegras|naturfaser/, 'Jute'],
  [/viskose|viscose|seidenglanz/, 'Viskose'],
];

const STYLES = [
  [/boho|ethno/, 'Boho'],
  [/skandi|skandinavisch|nordisch|scandi/, 'Skandi'],
  [/vintage|used|shabby|verwaschen/, 'Vintage'],
  [/orient|perser|persisch|türkisch/, 'Orientalisch'],
  [/industrial|industrie/, 'Industrial'],
  [/handgewebt|handweb|handgeknüpft|handgefertigt/, 'Handgewebt'],
];
const PATTERNS = [
  [/einfarbig|unifarben|\buni\b|einfarben/, 'Einfarbig'],
  [/gestreift|streifen/, 'Gestreift'],
  [/geometrisch|rauten|raute|grafisch|gemustert|muster/, 'Geometrisch'],
  [/floral|blumen|blüten|blatt|blätter/, 'Floral'],
  [/abstrakt/, 'Abstrakt'],
  [/wellen|wellenmuster/, 'Wellenmuster'],
  [/gepunktet|punkte|tupfen/, 'Gepunktet'],
  [/kariert|karo/, 'Kariert'],
  // kids' motifs
  [/straße|strasse|straßen|autos?\b|verkehr|spielstraße/, 'Auto/Straße'],
  [/tiere?\b|tiermotiv|dschungel|safari|zoo/, 'Tiere'],
  [/weltkarte|landkarte|weltall|planeten|kosmos|globus/, 'Geografie'],
];
const FEATURES = [
  [/waschbar|maschinenwaschbar/, 'Waschbar'],
  [/rutschfest|antirutsch/, 'Rutschfest'],
  [/fransen/, 'Fransen'],
  [/hoch-?tief|relief|3d-?effekt|strukturiert|struktur/, 'Hoch-Tief-Effekt'],
  [/wendbar|beidseitig/, 'Wendbar'],
];

// Not rugs, or nothing teppich.de can honestly offer
const NOT_RUG = /kuscheldecke|kunstrasen|pendelleuchte|puzzlematte|antirutschmatte/i;
const EXCLUDE_Q = /teppichboden|auslegware|kunstrasen|tischläufer|treppenläufer|fußmatte|fussmatte|türmatte|schmutzfang/;
// Real sheepskin / cowhide: teppich.de only has faux fur
const REAL_FUR_Q = /schaffell|lammfell|kuhfell|echtfell|naturfell|rinderfell/;

function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
const split = s => String(s || '').split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);

function parseDims(d) {
  const s = String(d || '').toLowerCase();
  let m = s.match(/(\d+)\s*cm\s*rund/);
  if (m) return { w: +m[1], h: +m[1], shape: 'rund' };
  m = s.match(/(\d+)\s*cm\s*quadrat/);
  if (m) return { w: +m[1], h: +m[1], shape: 'quadrat' };
  m = s.match(/(\d+)\s*cm\s*stern/);
  if (m) return { w: +m[1], h: +m[1], shape: 'stern' };
  m = s.match(/(\d+)\s*x\s*(\d+)/);
  if (!m) return null;
  const w = Math.min(+m[1], +m[2]), h = Math.max(+m[1], +m[2]);
  const shape = h / w >= 2.4 ? 'laeufer' : (w === h ? 'quadrat' : 'rechteck');
  return { w, h, shape };
}

// "In- & outdoor-teppich Venezia grau" -> "In- & Outdoor-Teppich Venezia grau"
function prettyName(s) {
  return s.replace(/(^|[\s-])(teppich|kinderteppich|outdoor|in-)/g, (m, a, b) => a + b.charAt(0).toUpperCase() + b.slice(1))
    .replace(/^waschbarer /i, 'Waschbarer ').replace(/^wendbarer /i, 'Wendbarer ');
}

// ── Index ────────────────────────────────────────────────────────────
function buildIndex(rows) {
  const models = new Map();   // model name (without size) -> model
  for (const r of rows) {
    const full = String(r.product_name || '').trim();
    if (!full || NOT_RUG.test(full)) continue;
    const path = r.merchant_product_category_path || '';
    if (!/Teppiche|Badematten|Badteppiche/.test(path)) continue;
    if (r.in_stock === '0') continue;
    const price = parseFloat(r.search_price) || 0;
    if (!price) continue;
    const dims = parseDims(r.dimensions);
    if (!dims) continue;

    const name = full.replace(/\s+\d+\s*[xX]?\s*\d*\s*cm.*$/i, '').trim();
    let m = models.get(name);
    if (!m) {
      const lname = norm(name);
      const desc = norm(r.description);
      const mats = new Set(split(r.custom_1));
      // the name may name the material the feed field leaves out ("Jute-teppich")
      if (/^jute/.test(lname)) mats.add('Jute');
      const pile = parseInt(r.custom_4, 10) || 0;
      m = {
        name, title: prettyName(name), t: lname,
        series: lname.split(' ').slice(-2, -1)[0] || '',
        colour: r.colour || '',
        siteColour: SITE_COLOUR[r.colour] || null,
        materials: mats,
        styles: new Set(split(r.custom_2)),
        features: new Set(split(r.custom_3)),
        pattern: r.custom_5 || '',
        pile,
        pileClass: pile === 0 ? (/flachgewebe|in- & outdoor|handweb/.test(lname) ? 'flach' : '')
          : pile <= 6 ? 'flach' : pile < 18 ? 'kurz' : pile <= 35 ? 'hoch' : 'extra',
        kids: /kinderteppich|lillifee|die lieben sieben/.test(lname),
        outdoor: /outdoor/.test(lname),
        bath: /badematte|badteppich/.test(path.toLowerCase()) || /badematte/.test(lname),
        kitchen: /küchenteppich/.test(lname),
        fur: /^fellteppich/.test(lname),
        shaggy: /hochflor|shaggy|flauschig|fellteppich/.test(lname) || pile >= 20,
        flat: /flachgewebe|in- & outdoor|handweb|wendbar/.test(lname) || (pile > 0 && pile <= 6),
        berber: /berber|marokk/.test(desc),
        kelim: /kelim|kilim/.test(desc),
        variants: [],
      };
      models.set(name, m);
    }
    m.variants.push({
      id: r.aw_product_id, dims, size: String(r.dimensions || '').replace(/\s+/g, ' ').replace(/X/, 'x').trim(),
      price, oldPrice: parseFloat(r.product_price_old) || 0,
      image: String(r.aw_image_url || '').replace('w=200&h=200', 'w=400&h=400'),
      link: r.aw_deep_link, delivery: r.delivery_time || '',
    });
  }
  const list = [...models.values()];
  for (const m of list) m.shapes = new Set(m.variants.map(v => v.dims.shape));
  return { models: list, builtAt: Date.now() };
}

// ── Query parsing ────────────────────────────────────────────────────
function parseQuery(q) {
  const text = norm(`${q.text || ''} ${q.material || ''}`);
  const all = norm(`${text} ${q.alt || ''}`);
  const words = text.split(/[\s,/()+&]+/).filter(Boolean);

  const kind = /badematte|badteppich|badvorleger|badezimmer/.test(all) ? 'bath'
    : /kinderteppich|spielteppich|kinderzimmer|spielmatte|krabbel|straßenteppich/.test(all) ? 'kids'
    : /outdoor|außenteppich|balkon|terrasse|garten|draußen/.test(all) ? 'outdoor'
    : /küchenteppich|küchenläufer|küche/.test(all) ? 'kitchen'
    : 'rug';

  let shape = /\brund|kreis|ø/.test(text) ? 'rund'
    : /quadratisch|quadrat/.test(text) ? 'quadrat'
    : /\boval/.test(text) ? 'oval'
    : /läufer|runner|flurteppich|\bflur\b|\bdiele\b/.test(all) ? 'laeufer' : null;

  // asked size: "200x300", "160 x 230 cm", "Ø 160", "160 cm rund"
  let size = null;
  let sm = text.match(/(\d{2,3})\s*[x×]\s*(\d{2,3})/);
  if (sm) {
    const w = Math.min(+sm[1], +sm[2]), h = Math.max(+sm[1], +sm[2]);
    size = { w, h };
    if (!shape && h / w >= 2.4) shape = 'laeufer';
  } else if ((sm = text.match(/(?:ø|durchmesser)\s*(\d{2,3})|(\d{2,3})\s*cm\s*(?:rund|ø|durchmesser)/))) {
    const d = +(sm[1] || sm[2]); size = { w: d, h: d }; shape = shape || 'rund';
  }

  let colour = null;
  for (const w of words) {
    const hit = COLOURS.find(([re]) => re.test(w)) || COLOURS.find(([re]) => re.test(w.replace(/^(dunkel|hell|tief|zart|pastell|warm)/, '')));
    if (hit) { colour = { exact: hit[1], close: hit[2], site: hit[3], word: w }; break; }
  }

  const material = (MATERIALS.find(([re]) => re.test(text)) || [])[1] || null;
  const styles = STYLES.filter(([re]) => re.test(text)).map(([, s]) => s);
  const patterns = PATTERNS.filter(([re]) => re.test(text)).map(([, s]) => s);
  const features = FEATURES.filter(([re]) => re.test(text)).map(([, s]) => s);

  const pile = /hochflor|shaggy|langflor|flauschig|flokati|kuschelig|plüsch/.test(text) ? 'hoch'
    : /kunstfell|fellteppich|fell-?optik|\bfell\b/.test(text) ? 'fur'
    : /kurzflor/.test(text) ? 'kurz'
    : /flachgewebe|flachgewebt|flachflor|flach gewebt|kelim|kilim|webteppich|gewebt/.test(text) ? 'flach' : null;
  const berber = /berber|marokk|beni/.test(text);
  const kelim = /kelim|kilim/.test(text);

  let priceMin = 0, priceMax = 0;
  const pm = String(q.price || '').replace(/\./g, '').match(/(\d+)\D+(\d+)/);
  if (pm) { priceMin = +pm[1]; priceMax = +pm[2]; }

  const isRug = /teppich|läufer|\brugs?\b|badematte|badvorleger|vorleger|fell|flokati|kelim|kilim|berber|spielmatte|krabbelmatte/.test(all);
  return {
    text, kind, shape, size, colour, material, styles, patterns, features, pile, berber, kelim, priceMin, priceMax,
    excluded: !isRug || EXCLUDE_Q.test(text) ? 'not-a-rug' : REAL_FUR_Q.test(text) ? 'real-fur' : null,
  };
}

// ── Size choice ──────────────────────────────────────────────────────
// Without an asked size: what a typical room of that kind needs
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
    // no shape asked: a normal rectangle (not a runner or a round one)
    const rect = pool.filter(v => v.dims.shape === 'rechteck');
    if (rect.length) pool = rect;
  }
  const area = want.w * want.h;
  let best = null, bestD = Infinity;
  for (const v of pool) {
    const a = v.dims.w * v.dims.h;
    const d = Math.abs(Math.log(a / area)) + 0.3 * Math.abs(Math.log((v.dims.h / v.dims.w) / (want.h / want.w)));
    if (d < bestD) { bestD = d; best = v; }
  }
  if (!best) return { v: null, sizeOk: false };
  // the asked size is "there" if area is within ±25%
  if (Q.size) return { v: best, sizeOk: bestD < 0.25 };
  // No size asked: the feed doesn't carry every size of every model. A
  // living-room rug that only exists as a 80x150 mat isn't the right
  // suggestion, so less than half the usual area doesn't count.
  const roomRug = (Q.kind === 'rug' || Q.kind === 'outdoor') && !Q.shape;
  const tooSmall = roomRug && best.dims.w * best.dims.h < area * 0.5;
  return { v: best, sizeOk: !tooSmall };
}

// ── Scoring ──────────────────────────────────────────────────────────
function scoreModel(m, Q) {
  let s = 30;
  const why = [];
  const fail = [];   // asked-for properties this model doesn't have

  // kind: hard filters
  if (Q.kind === 'kids' && !m.kids) return null;
  if (Q.kind !== 'kids' && m.kids) return null;
  if (Q.kind === 'bath' && !m.bath) return null;
  if (Q.kind !== 'bath' && m.bath) return null;
  if (Q.kind === 'outdoor' && !m.outdoor) return null;
  if (Q.kind === 'kitchen') { if (m.kitchen) s += 25; else if (m.shapes.has('laeufer')) s += 5; else return null; }
  if (Q.kind === 'rug' && m.outdoor) s -= 4;   // In- & Outdoor rugs are fine inside, a little less preferred

  if (Q.shape) {
    if (m.shapes.has(Q.shape)) { s += 15; why.push(Q.shape); }
    else { s -= 40; fail.push('shape'); }
  }

  if (Q.colour) {
    if (Q.colour.exact.includes(m.colour)) { s += 40; why.push('colour'); }
    else if (Q.colour.close.includes(m.colour)) { s += 12; why.push('colour~'); fail.push('colour~'); }
    else { s -= 35; fail.push('colour'); }
  }

  if (Q.material) {
    if (m.materials.has(Q.material)) { s += 30; why.push('mat'); }
    else { s -= 25; fail.push('material'); }
  }

  if (Q.pile === 'hoch') { if (m.shaggy && !m.fur) { s += 25; why.push('hochflor'); } else if (m.fur) s += 10; else { s -= 25; fail.push('pile'); } }
  else if (Q.pile === 'fur') { if (m.fur) { s += 30; why.push('fell'); } else { s -= 30; fail.push('pile'); } }
  else if (Q.pile === 'kurz') { if (m.pileClass === 'kurz') { s += 12; why.push('kurzflor'); } else if (m.shaggy) { s -= 20; fail.push('pile'); } }
  else if (Q.pile === 'flach') { if (m.flat) { s += 20; why.push('flach'); } else { s -= 20; fail.push('pile'); } }
  else {
    // nothing said: fur and very long pile are a specific look, not a default
    if (m.fur) s -= 15;
    else if (m.pile >= 40) s -= 6;
  }

  for (const st of Q.styles) {
    if (m.styles.has(st) || (st === 'Orientalisch' && m.pattern === 'Orientalisch')) { s += 20; why.push(st); }
    else { s -= 12; fail.push('style'); }
  }
  for (const pt of Q.patterns) {
    if (m.pattern === pt) { s += 18; why.push(pt); }
    // "gemustert" (-> Geometrisch) is fine with any pattern that isn't plain
    else if (pt === 'Geometrisch' && /gemustert|muster/.test(Q.text) && m.pattern && m.pattern !== 'Einfarbig') { s += 10; why.push('muster'); }
    else { s -= 12; fail.push('pattern'); }
  }
  if (!Q.patterns.length && !Q.styles.length && !Q.berber && !Q.kelim) {
    // a plain "Teppich beige" is meant plain
    if (m.pattern === 'Einfarbig') s += 8;
    else {
      if (Q.colour && Q.colour.site !== 'Mehrfarbig' && m.colour === 'Mehrfarbig') s -= 10;
      // a patterned rug only counts when its colour is exactly the one asked
      // (a black-and-white Moroccan rug listed as "weiß" isn't "elfenbein")
      if (Q.colour && !Q.colour.exact.includes(m.colour)) fail.push('pattern');
    }
  }
  if (Q.berber) {
    if (m.berber) { s += 30; why.push('berber'); }
    else { if (m.styles.has('Boho') && /Geometrisch|Abstrakt/.test(m.pattern)) s += 8; fail.push('berber'); }
  }
  if (Q.kelim) { if (m.kelim) { s += 25; why.push('kelim'); } else { s -= 5; fail.push('kelim'); } }

  for (const f of Q.features) {
    if (m.features.has(f)) { s += 12; why.push(f); }
    else { s -= 10; fail.push('feature'); }
  }

  // the series name itself ("Teppich Calissa")
  if (m.series && m.series.length > 3 && Q.text.includes(m.series)) { s += 40; why.push('series'); }

  return { s, why, fail };
}

function priceScore(price, Q) {
  if (!Q.priceMax) return 0;
  if (price >= Q.priceMin && price <= Q.priceMax) return 14;
  if (price >= Q.priceMin * 0.6 && price <= Q.priceMax * 1.5) return 4;
  if (price > Q.priceMax * 3) return -18;
  return -8;
}

// ── teppich.de link with filters ──────────────────────────────────────
// Adds the asked filters in order of importance, but only as long as the
// feed says that combination still has products (no empty pages).
function buildUrl(index, Q) {
  let pool = index.models.filter(m => (Q.kind === 'kids' ? m.kids : !m.kids) && (Q.kind === 'bath' ? m.bath : true)
    && (Q.kind === 'outdoor' ? m.outdoor : true));
  const path = KIND_PATH[Q.kind] || KIND_PATH.rug;
  const props = [];
  const tryAdd = (ids, test) => {
    if (!ids) return;
    const next = pool.filter(test);
    if (next.length >= 2) { pool = next; props.push(ids); }
  };
  if (Q.shape && P.shape[Q.shape]) tryAdd(P.shape[Q.shape], m => m.shapes.has(Q.shape));
  if (Q.material) tryAdd(P.material[Q.material], m => m.materials.has(Q.material));
  if (Q.colour && P.colour[Q.colour.site]) tryAdd(P.colour[Q.colour.site], m => m.siteColour === Q.colour.site);
  if (Q.pile === 'hoch' || Q.pile === 'fur') tryAdd(`${P.pile.hoch}|${P.pile.extra}`, m => m.pileClass === 'hoch' || m.pileClass === 'extra');
  else if (Q.pile === 'kurz') tryAdd(P.pile.kurz, m => m.pileClass === 'kurz');
  else if (Q.pile === 'flach') tryAdd(P.pile.flach, m => m.pileClass === 'flach');
  for (const st of Q.styles) tryAdd(P.style[st], m => m.styles.has(st));
  for (const pt of Q.patterns) if (!/gemustert|muster\b/.test(Q.text) || pt !== 'Geometrisch') tryAdd(P.pattern[pt], m => m.pattern === pt);
  if (Q.berber) tryAdd(P.style.Boho, m => m.styles.has('Boho'));
  for (const f of Q.features) tryAdd(P.feature[f], m => m.features.has(f));
  return SITE + path + (props.length ? `?properties=${props.join('|')}` : '');
}

// ── Search ───────────────────────────────────────────────────────────
// query: { text, material?, price?, alt? } -> { matched, sure, url, results }
function search(index, query, limit = 4) {
  const Q = parseQuery(query);
  if (Q.excluded === 'not-a-rug') return { matched: false, reason: Q.excluded, results: [] };
  const url = buildUrl(index, Q);
  // real fur: only the link to teppich.de's fur category, never a "this is it"
  if (Q.excluded === 'real-fur') return { matched: false, reason: Q.excluded, url: SITE + '/fell-teppiche/', results: [] };

  const scored = [];
  for (const m of index.models) {
    const r = scoreModel(m, Q);
    if (!r) continue;
    const { v, sizeOk } = pickVariant(m, Q);
    if (!v) continue;
    let s = r.s + priceScore(v.price, Q);
    s += sizeOk ? (Q.size ? 10 : 0) : -15;
    // "sure": all named properties really there. A close colour (creme for
    // beige) is fine, a different one is not.
    const hardFails = r.fail.filter(f => f !== 'colour~');
    const sure = hardFails.length === 0 && sizeOk;
    scored.push({ m, v, s, why: r.why, sure });
  }
  scored.sort((a, b) => b.s - a.s || a.v.price - b.v.price);

  // variety: one colour per series unless there's nothing else
  const out = [];
  const seen = new Set();
  const top = scored.length ? scored[0].s : 0;
  for (const r of scored) {
    if (r.s < top - 50) break;   // far worse than the best: not worth showing
    if (seen.has(r.m.series) && scored.length > limit * 2) continue;
    seen.add(r.m.series);
    out.push(r);
    if (out.length >= limit) break;
  }

  return {
    matched: out.length > 0,
    sure: !!(out[0] && out[0].sure),
    url,
    colour: Q.colour ? Q.colour.exact[0] : null,
    results: out.map(({ m, v, s, why, sure }) => ({
      sure, id: v.id,
      title: `${m.title}, ${v.size}`,
      price: v.price, oldPrice: v.oldPrice > v.price ? v.oldPrice : 0,
      colour: m.colour, image: v.image, link: v.link, delivery: v.delivery,
      size: v.size, category: m.kids ? 'Kinderteppich' : m.outdoor ? 'In- & Outdoor' : 'Teppich',
      score: Math.round(s), why,
    })),
  };
}

if (typeof module !== 'undefined') module.exports = { buildIndex, search, parseQuery, parseDims };
