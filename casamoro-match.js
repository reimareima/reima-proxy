// ─────────────────────────────────────────────────────────────────────
//  CASA MORO PRODUCT MATCHING
//  Input:  rows from the Awin feed "Casa Moro DE" (Google format,
//          feed F3113, ~1200 rows, ~700 in stock)
//  Casa Moro sells oriental / Moroccan / boho pieces: lanterns,
//  perforated metal lamps, side and mosaic tables, poufs, cushions,
//  baskets, planters, trays, stools, chests, basins, tiles.
//  The feed has no colour or material fields, so both are read from
//  title and description.
//
//  A match is SURE only when
//    1. the product type matches (lantern = lantern, pouf = pouf),
//    2. the query is oriental / boho in style (a Scandinavian lantern
//       is not a Casa Moro lantern), and
//    3. every colour and material the query names is in the product.
//  Otherwise the frontend links to the right Casa Moro category page
//  (`url` in the answer).
// ─────────────────────────────────────────────────────────────────────

const SITE = 'https://casa-moro.de';

// [key, query regex, product-title regex, collection]
// Specific types first (Wäschekorb before Korb, Mosaiktisch before Tisch).
const TYPES = [
  ['laterne',      /laterne|windlicht/,                                                     /laterne|windlicht/,                       'laternen'],
  ['deckenlampe',  /hängelampe|haengelampe|hängeleuchte|pendelleuchte|pendellampe|deckenlampe|deckenleuchte/, /hängelampe|deckenlampe|deckenleuchte|pendel/, 'deckenleuchten'],
  ['wandlampe',    /wandlampe|wandleuchte/,                                                 /wandlampe|wandleuchte/,                   'wandlampen'],
  ['stehlampe',    /stehlampe|stehleuchte/,                                                 /stehlampe|stehleuchte/,                   'stehlampen'],
  ['tischlampe',   /tischlampe|tischleuchte|nachttischlampe/,                               /tischlampe|tischleuchte/,                 'tischlampen'],
  ['pouf',         /pouf|puff\b|sitzkissen|bodenkissen|sitzwürfel/,                         /pouf|sitzkissen|bodenkissen|sitzwürfel/,  'ledersitzkissen_poufs'],
  ['kissen',       /kissen/,                                                                /kissen/,                                  'sofakissen'],
  ['mosaiktisch',  /mosaik\w*tisch|mosaiktisch/,                                            /mosaik\w*tisch|mosaiktisch|\btisch\b.*mosaik/, 'mosaiktische-aus-marokko'],
  ['beistelltisch',/beistelltisch|teetisch|tabletttisch|satztisch/,                         /beistelltisch|teetisch|satztisch|tabletttisch|\btisch\b/, 'beistelltische'],
  ['couchtisch',   /couchtisch/,                                                            /couchtisch/,                              'couchtische'],
  ['kommode',      /kommode|sideboard|schrank|truhe/,                                       /kommode|sideboard|schrank|truhe/,         'schraenke-kommoden'],
  ['waeschekorb',  /wäschekorb|waeschekorb|wäschetruhe/,                                    /wäschekorb|wäschetruhe/,                  'waeschekoerbe'],
  ['korb',         /korb|körbe/,                                                            /korb|körbe/,                              'koerbe-und-boxen'],
  ['blumentopf',   /blumentopf|übertopf|pflanztopf|pflanzkübel|pflanzenständer/,            /blumentopf|übertopf|pflanztopf|pflanzkübel|pflanzgefäß/, 'blumentoepfe-regale'],
  ['tablett',      /tablett(?!tisch)/,                                                      /tablett(?!tisch)/,                        'teetische-tabletts'],
  ['hocker',       /hocker|sitzbank|\bbank\b/,                                              /hocker|bank\b/,                           'orient-hocker-sitzbaenke'],
  ['stuhl',        /stuhl|sessel/,                                                          /stuhl|sessel/,                            'stuehle'],
  ['waschbecken',  /waschbecken|aufsatzbecken/,                                             /waschbecken|aufsatzbecken/,               'orientalische-waschbecken'],
  ['fliese',       /fliese|zellige/,                                                        /fliese|zellige/,                          'orientalische-fliesen'],
  ['kerzenhalter', /kerzenhalter|kerzenständer|teelicht/,                                   /kerzenhalter|kerzenständer|teelicht/,     'kerzenlichter'],
];

// Words that make a query "Casa Moro style"
const STYLE_RE = /kamelhocker|orient|marokk|maroc|maurisch|arabisch|boho|ethno|berber|zellige|mosaik|kasbah|riad|indisch|punktloch|lochmuster|filigran|ornament|messing|kupfer|tadelakt|mangoholz|rattan|jute|seegras|patchwork|kelim/;

// Colour word in the query -> words that count as that colour in the product
const COLOURS = [
  [/^(schwarz)/,                                    /schwarz/],
  [/^(weiß|weiss|creme|elfenbein|natur ?weiß)/,     /weiß|weiss|creme|elfenbein|naturweiß/],
  [/^(beige|sand|natur|hafer|camel|taupe)/,         /beige|sand|natur|creme|camel|taupe/],
  [/^(grau|anthrazit)/,                             /grau|anthrazit/],
  [/^(braun|cognac|karamell|mokka|schoko)/,         /braun|cognac|karamel|mokka|schoko|natur/],
  [/^(blau|navy|indigo|petrol)/,                    /blau|navy|indigo|petrol|türkis/],
  [/^(türkis|tuerkis)/,                             /türkis|tuerkis|petrol/],
  [/^(grün|gruen|oliv|salbei|smaragd|mint)/,        /grün|gruen|oliv|salbei|smaragd|mint/],
  [/^(gelb|senf|ocker|curry)/,                      /gelb|senf|ocker|curry/],
  [/^(orange|terrakotta|terracotta|rost|kupfer)/,   /orange|terrakotta|terracotta|rost|kupfer/],
  [/^(rot|bordeaux|weinrot)/,                       /\brot|bordeaux|weinrot|rot-/],
  [/^(rosa|pink|altrosa|rosé)/,                     /rosa|pink|rosé/],
  [/^(lila|violett|lavendel)/,                      /lila|violett|lavendel/],
  [/^(gold|golden|messing)/,                        /gold|messing/],
  [/^(silber|silbern)/,                             /silber/],
  [/^(bunt|mehrfarbig)/,                            /bunt|mehrfarbig|patchwork|farbig/],
];
// Material word in the query -> words that count as that material
const MATERIALS = [
  [/messing/,                 /messing/],
  [/kupfer/,                  /kupfer/],
  [/\bglas/,                  /glas/],
  [/leder/,                   /leder/],
  [/rattan/,                  /rattan/],
  [/jute/,                    /jute/],
  [/seegras/,                 /seegras/],
  [/mangoholz/,               /mango/],
  [/teak/,                    /teak/],
  [/keramik|ton\b|terrakotta/,/keramik|\bton\b|terrakotta|terracotta/],
  [/marmor/,                  /marmor/],
  [/baumwoll/,                /baumwoll/],
  [/samt/,                    /samt/],
  [/eisen|schmiede/,          /eisen|schmiede/],
  [/\bholz|massivholz/,       /holz|mango|teak/],
  [/metall/,                  /metall|eisen|messing|kupfer|alu/],
];

const STOP = new Set(['mit','und','aus','für','der','die','das','im','in','am','auf','von','ein','eine','einer','zum','zur','stil','look','style','klein','groß','gross','mittel','set','modern']);

function norm(s) { return String(s || '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9äöü\s-]/g, ' '); }
function low(s) { return String(s || '').toLowerCase(); }

function typeOf(text) {
  const t = low(text);
  // a "Sitzkissen" is a pouf, not a cushion; a "Tabletttisch" is a table
  return TYPES.find(([, qre]) => qre.test(t)) || null;
}

function parsePrice(v) { const n = parseFloat(String(v || '').replace(',', '.')); return isFinite(n) ? n : 0; }

// Shopify serves a smaller picture with &width=
function img(u, w) {
  if (!u) return '';
  return u + (u.includes('?') ? '&' : '?') + 'width=' + w;
}

function buildIndex(rows) {
  const byHandle = new Map();
  for (const r of rows) {
    if (String(r.availability || '').toLowerCase() !== 'in_stock') continue;
    const title = String(r.title || '').trim();
    if (!title || !r.aw_deep_link) continue;
    const handle = (String(r.link || '').match(/\/products\/([^?#/]+)/) || [])[1] || title;
    const t = low(title);
    const type = TYPES.find(([, , pre]) => pre.test(t));
    const price = parsePrice(r.sale_price) || parsePrice(r.price);
    const old = parsePrice(r.sale_price) ? parsePrice(r.price) : 0;
    if (!price) continue;
    const v = {
      title, price, oldPrice: old > price ? old : 0,
      tlow: low(title),
      link: r.aw_deep_link,
      image: img(r.image_link, 600), image2: r.image_link || '',
      text: low(title + ' ' + String(r.description || '').slice(0, 600)),
      words: new Set(norm(title).split(/\s+/).filter(w => w.length > 2)),
    };
    if (!byHandle.has(handle)) byHandle.set(handle, { handle, type: type ? type[0] : null, variants: [] });
    byHandle.get(handle).variants.push(v);
  }
  return { models: [...byHandle.values()], builtAt: Date.now() };
}

function wantedAttrs(q) {
  const text = low(`${q.text} ${q.alt} ${q.material}`);
  const colours = [];
  for (const w of text.split(/[\s,/()-]+/)) {
    const hit = COLOURS.find(([re]) => re.test(w)) || COLOURS.find(([re]) => re.test(w.replace(/^(dunkel|hell|zart|tief|pastell)/, '')));
    if (hit && !colours.includes(hit[1])) colours.push(hit[1]);
  }
  const materials = MATERIALS.filter(([re]) => re.test(text)).map(([, m]) => m);
  return { colours, materials };
}

function search(index, q, limit = 4) {
  const qtext = low(`${q.text} ${q.alt}`);
  const type = typeOf(qtext);
  if (!type) return { matched: false, sure: false, results: [] };
  const url = `${SITE}/collections/${type[3]}`;
  const styled = STYLE_RE.test(low(`${qtext} ${q.material}`));
  const { colours, materials } = wantedAttrs(q);
  const qwords = norm(qtext).split(/\s+/).filter(w => w.length > 3 && !STOP.has(w));

  const scored = [];
  for (const m of index.models) {
    if (m.type !== type[0]) continue;
    // pick the variant that fits the colours best, else the cheapest
    let best = null, bestS = -1;
    for (const v of m.variants) {
      const cOk = colours.every(c => c.test(v.text));
      const mOk = materials.every(x => x.test(v.text));
      let s = (cOk ? 4 : 0) + (mOk ? 3 : 0);
      // colour and material named in the title beat a mention in the text
      for (const c of colours) if (c.test(v.tlow)) s += 3;
      for (const x of materials) if (x.test(v.tlow)) s += 3;
      for (const w of qwords) { if (v.words.has(w)) s += 2; else if (v.text.includes(w)) s += 1; }
      if (s > bestS || (s === bestS && best && v.price < best.price)) { best = v; bestS = s; best.ok = cOk && mOk; }
    }
    if (best) scored.push({ v: best, s: bestS, ok: best.ok });
  }
  scored.sort((a, b) => (b.ok - a.ok) || (b.s - a.s) || (a.v.price - b.v.price));
  const top = scored.slice(0, limit);
  const sure = !!(styled && top[0] && top[0].ok);
  return {
    matched: top.length > 0,
    sure,
    url,
    results: top.map(({ v }) => ({
      title: v.title, price: v.price, oldPrice: v.oldPrice,
      image: v.image, image2: v.image2, link: v.link,
    })),
  };
}

module.exports = { buildIndex, search, TYPES, STYLE_RE };
