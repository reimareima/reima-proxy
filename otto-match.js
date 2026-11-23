// ─────────────────────────────────────────────────────────────────────
//  OTTO PRODUCT MATCHING
//  OTTO's category tree differs from Höffner's, the scoring doesn't:
//  these rules map a product type to OTTO categories and hand the rest
//  to hoeffner-match.js (index.rules).
//
//  OTTO paths, root "Einrichten & Wohnen > " cut off, e.g.
//  "Möbel > Tische > Couchtisch". The third level is the product type.
// ─────────────────────────────────────────────────────────────────────

const { buildIndex: hBuild, search: hSearch } = require('./hoeffner-match');

const L = 'Leuchten > Leuchten > ';
const M = 'Möbel > ';
const W = 'Wohntextilien > ';
const D = 'Deko, Accessoires > ';
const RUG = W + 'Teppiche > ';
const all = (base, names) => names.map(n => base + n);

const OTTO_RULES = [
  // ── Lighting
  [/schreibtischlampe|schreibtischleuchte|arbeitsleuchte|klemmleuchte/, all(L, ['Schreibtischlampe', 'LED Schreibtischlampe', 'Klemmleuchte', 'LED Klemmleuchte'])],
  [/nachttischlampe|nachttischleuchte|tischlampe|tischleuchte|leselampe/, all(L, ['Tischleuchte', 'LED Tischleuchte', 'Nachttischlampe', 'LED Nachttischlampe'])],
  [/bogenlampe|bogenleuchte/,                       all(L, ['Bogenlampe', 'Stehlampe@0.6', 'LED Stehlampe@0.6'])],
  [/stehlampe|stehleuchte|deckenfluter/,            all(L, ['Stehlampe', 'LED Stehlampe', 'Bogenlampe@0.7', 'Deckenfluter@0.6'])],
  [/kronleuchter|lüster/,                           all(L, ['Kronleuchter'])],
  [/pendel|hängelampe|hängeleuchte|esstischlampe/,  all(L, ['Pendelleuchte', 'LED Pendelleuchte', 'Hängeleuchte', 'LED-Hängeleuchte'])],
  [/deckenlampe|deckenleuchte|deckenlicht/,         all(L, ['Deckenleuchte', 'LED Deckenleuchte'])],
  [/wandlampe|wandleuchte/,                         all(L, ['Wandleuchte', 'LED Wandleuchte'])],
  [/laterne|windlicht/,                             [...all(D + 'Kerzenhalter > ', ['Windlicht', 'Kerzenlaterne', 'Bodenwindlicht']), L + 'LED Laterne@0.6']],

  // ── Rugs
  [/fußmatte|türmatte|schmutzfang|fussmatte/,       [RUG + 'Fußmatte']],
  [/läufer/,                                        [RUG + 'Läufer', RUG + 'Hochflor-Läufer']],
  [/kinderteppich|spielteppich/,                    [RUG + 'Kinderteppich']],
  [/outdoor.*teppich|teppich.*(outdoor|balkon|terrasse)|außenteppich|balkonteppich/, [RUG + 'Outdoorteppich']],
  [/fell|fellteppich/,                              [RUG + 'Fellteppich']],
  [/(orient|perser).*teppich|orientteppich|perserteppich/, [RUG + 'Orientteppich', RUG + 'Teppich@0.5']],
  [/(hochflor|shaggy|langflor).*teppich|teppich.*(hochflor|shaggy)/, [RUG + 'Hochflor-Teppich', RUG + 'Langflor-Teppich']],
  [/(sisal|jute|seegras).*teppich|teppich.*(sisal|jute)/, [RUG + 'Sisalteppich', RUG + 'Teppich@0.6']],
  [/woll.*teppich|teppich.*wolle/,                  [RUG + 'Wollteppich', RUG + 'Teppich@0.6']],
  [/teppich/,                                       all(RUG, ['Teppich', 'Wollteppich', 'Designteppich', 'Schlingenteppich@0.8', 'Hochflor-Teppich@0.6', 'Orientteppich@0.6'])],

  // ── Textiles
  [/tagesdecke|bettüberwurf/,                       all(W + 'Tagesdecken > ', ['Tagesdecke', 'Bettüberwurf'])],
  [/bettwäsche|bettbezug/,                          all(W + 'Bettwäsche > ', ['Bettwäsche', 'Wendebettwäsche'])],
  [/stuhlkissen|sitzkissen|sitzauflage/,            all(W + 'Kissen > ', ['Sitzkissen', 'Stuhlkissen'])],
  [/kissenhülle|kissenbezug/,                       all(W + 'Kissenbezüge > ', ['Kissenhülle', 'Kissenhüllen', 'Kissenbezug', 'Kissenbezüge'])],
  [/kissen/,                                        [W + 'Kissen > Dekokissen', ...all(W + 'Kissenbezüge > ', ['Kissenhülle@0.8', 'Kissenbezug@0.8'])]],
  [/decke|plaid|überwurf/,                          all(W + 'Wohndecken > ', ['Wohndecke', 'Plaid', 'Wolldecke', 'Überwurf'])],
  [/gardinenstange|vorhangstange/,                  all(W + 'Gardinenstangen > ', ['Gardinenstange', 'Vorhangschiene', 'Gardinenschiene'])],
  [/verdunkelung/,                                  [W + 'Gardinen > Verdunkelungsvorhang']],
  [/vorhang|vorhänge|gardine|schlaufenschal|ösenschal/, all(W + 'Gardinen > ', ['Vorhang', 'Gardine', 'Verdunkelungsvorhang@0.6'])],

  // ── Seating
  [/pouf|sitzpouf/,                                 [D + 'Poufs > Pouf', M + 'Hocker > Sitzwürfel', M + 'Hocker > Polsterhocker@0.7']],
  [/fußhocker|polsterhocker|sitzwürfel/,            all(M + 'Hocker > ', ['Polsterhocker', 'Fußhocker', 'Sitzwürfel', 'Sitzhocker@0.7'])],
  [/barhocker|tresenhocker/,                        [M + 'Hocker > Barhocker']],
  [/hocker/,                                        all(M + 'Hocker > ', ['Hocker', 'Sitzhocker', 'Polsterhocker@0.7'])],
  [/ohrensessel/,                                   [M + 'Sessel > Ohrensessel']],
  [/relaxsessel|fernsehsessel|tv-sessel/,           all(M + 'Sessel > ', ['Relaxsessel', 'TV-Sessel'])],
  [/schaukelsessel|schaukelstuhl/,                  [M + 'Sessel > Schaukelsessel', M + 'Stühle > Schaukelstuhl']],
  [/drehsessel/,                                    [M + 'Sessel > Drehsessel']],
  [/hängesessel/,                                   [M + 'Sessel > Hängesessel']],
  [/sessel/,                                        all(M + 'Sessel > ', ['Sessel', 'Loungesessel', 'Cocktailsessel', 'Ohrensessel@0.8', 'Drehsessel@0.7', 'Loveseat@0.6', 'Relaxsessel@0.25'])],
  [/recamiere|récamière|ottomane|chaiselongue/,     all(M + 'Sofas > ', ['Recamiere', 'Ottomane', 'Chaiselongue'])],
  [/schlafsofa|schlafcouch|bettsofa/,               [M + 'Sofas > Schlafsofa']],
  [/wohnlandschaft|u-sofa|u-form/,                  [M + 'Sofas > Wohnlandschaft']],
  [/big-sofa|bigsofa/,                              [M + 'Sofas > Big-Sofa']],
  [/ecksofa|eckcouch|l-sofa|l-form/,                [M + 'Sofas > Ecksofa']],
  [/chesterfield/,                                  [M + 'Sofas > Chesterfield-Sofa', M + 'Sessel > Sessel@0.5']],
  [/(?<!\d\s?-\s?)2[\s-]?sitzer(?!\s?-\s?\d)|zweisitzer/, all(M + 'Sofas > ', ['2-Sitzer', '2,5-Sitzer@0.8', 'Sofa@0.7'])],
  [/(?<!\d\s?-\s?)3[\s-]?sitzer|dreisitzer/,        all(M + 'Sofas > ', ['3-Sitzer', 'Sofa@0.7'])],
  [/sofa|couch(?!tisch)/,                           all(M + 'Sofas > ', ['Sofa', '3-Sitzer', '2-Sitzer', '2,5-Sitzer', 'Big-Sofa', 'Loungesofa', 'Chesterfield-Sofa@0.8', 'Ecksofa@0.5'])],
  [/eckbank/,                                       [M + 'Sitzbänke > Eckbank']],
  [/sitzbank|bank\b|bänke/,                         all(M + 'Sitzbänke > ', ['Sitzbank', 'Polsterbank', 'Essbank', 'Bank', 'Truhenbank@0.7'])],
  [/freischwinger|schwingstuhl/,                    [M + 'Stühle > Freischwinger']],
  [/rattanstuhl|korbstuhl/,                         [M + 'Stühle > Rattanstuhl']],
  [/bürostuhl|schreibtischstuhl|chefsessel|drehstuhl/, all(M + 'Stühle > ', ['Bürostuhl', 'Schreibtischstuhl', 'Drehstuhl', 'Chefsessel'])],
  [/esszimmerstuhl|polsterstuhl|armlehnstuhl|holzstuhl|stuhl|stühle/, all(M + 'Stühle > ', ['Esszimmerstuhl', 'Polsterstuhl', 'Stuhl', 'Armlehnstuhl', 'Holzstuhl', '4-Fußstuhl', 'Freischwinger@0.8', 'Küchenstuhl@0.6'])],

  // ── Beds
  [/polsterbett/,                                   [M + 'Betten > Polsterbett']],
  [/massivholzbett|holzbett/,                       all(M + 'Betten > ', ['Massivholzbett', 'Holzbett', 'Bettgestell@0.6'])],
  [/metallbett/,                                    [M + 'Betten > Metallbett']],
  [/himmelbett/,                                    [M + 'Betten > Himmelbett']],
  [/bettgestell|bettrahmen|bett\b|doppelbett/,      all(M + 'Betten > ', ['Bett', 'Bettgestell', 'Polsterbett', 'Massivholzbett', 'Holzbett', 'Metallbett', 'Stauraumbett@0.6'])],

  // ── Tables
  [/nachttisch|nachtkonsole|nachtschrank/,          [M + 'Tische > Nachttisch', M + 'Sideboards > Nachtkommode', M + 'Sideboards > Nachtkonsole', M + 'Schränke > Nachtschrank']],
  [/schminktisch|frisiertisch/,                     [M + 'Tische > Schminktisch']],
  [/schreibtisch|computertisch/,                    all(M + 'Tische > ', ['Schreibtisch', 'Computertisch', 'Eckschreibtisch@0.6'])],
  [/couchtisch|sofatisch|wohnzimmertisch/,          all(M + 'Tische > ', ['Couchtisch', 'Wohnzimmertisch'])],
  [/beistelltisch|satztisch|tabletttisch/,          all(M + 'Tische > ', ['Beistelltisch', 'Satztisch', 'Tabletttisch'])],
  [/konsole|konsolentisch|wandtisch/,               [M + 'Tische > Konsolentisch', M + 'Sideboards > Konsole']],
  [/bartisch|stehtisch/,                            all(M + 'Tische > ', ['Bartisch', 'Stehtisch'])],
  [/esstisch|küchentisch|esszimmertisch/,           all(M + 'Tische > ', ['Esstisch', 'Säulen-Esstisch', 'Baumkantentisch', 'Küchentisch@0.7'])],
  [/\btische?\b|(bistro|klapp|holz|glas|marmor|runder?|ovaler?)tisch/, all(M + 'Tische > ', ['Esstisch', 'Couchtisch@0.7', 'Beistelltisch@0.7'])],

  // ── Storage
  [/kleiderschrank/,                                all(M + 'Schränke > ', ['Kleiderschrank', 'Drehtürenschrank', 'Schwebetürenschrank'])],
  [/vitrine/,                                       all(M + 'Schränke > ', ['Vitrine', 'Standvitrine', 'Glasvitrine'])],
  [/highboard/,                                     [M + 'Sideboards > Highboard']],
  [/sideboard|anrichte/,                            [M + 'Sideboards > Sideboard', M + 'Sideboards > Lowboard@0.5']],
  [/lowboard|tv-board|tv-bank|tv-schrank|fernsehschrank/, all(M + 'Sideboards > ', ['Lowboard', 'TV-Board', 'TV-Bank']).concat([M + 'Schränke > TV-Schrank'])],
  [/schuhkipper|schuhschrank/,                      [M + 'Sideboards > Schuhkipper', M + 'Schränke > Schuhschrank']],
  [/kommode/,                                       all(M + 'Sideboards > ', ['Kommode', 'Schubkastenkommode', 'Kombikommode', 'Hochkommode'])],
  [/wandboard/,                                     [M + 'Regale > Wandboard']],
  [/wandregal|hängeregal/,                          all(M + 'Regale > ', ['Wandregal', 'Hängeregal', 'Wandboard@0.7'])],
  [/leiterregal/,                                   [M + 'Regale > Leiterregal']],
  [/raumteiler/,                                    all(M + 'Regale > ', ['Raumteiler', 'Raumteilerregal'])],
  [/bücherregal|standregal|regal/,                  all(M + 'Regale > ', ['Bücherregal', 'Standregal', 'Regal', 'Wandregal@0.6'])],
  [/garderobenständer|kleiderständer|kleiderstange/, all(M + 'Garderobenständer > ', ['Garderobenständer', 'Kleiderständer'])],
  [/wäschekorb|wäschesammler/,                      [W + 'Wäschesammler']],
  [/korb|körbe/,                                    all(D + 'Aufbewahrungsboxen > ', ['Aufbewahrungskorb', 'Flechtkorb', 'Dekokorb', 'Allzweckkorb'])],
  [/truhe|kiste/,                                   [D + 'Aufbewahrungsboxen > Holzkiste', M + 'Sitzbänke > Sitztruhe@0.6']],

  // ── Decor
  [/ganzkörperspiegel|standspiegel/,               ['Haushalt > Spiegel > Ganzkörperspiegel']],
  [/spiegel/,                                       ['Haushalt > Spiegel > Wandspiegel', 'Haushalt > Spiegel > Spiegel', 'Haushalt > Spiegel > Ganzkörperspiegel@0.6']],
  [/wanduhr|\buhr\b/,                               all(D + 'Wanduhren > ', ['Wanduhr', 'Uhr'])],
  [/bilderrahmen/,                                  all(D + 'Bilderrahmen > ', ['Bilderrahmen', 'Bilderrahmen-Set'])],
  [/vase/,                                          all(D + 'Vasen > ', ['Dekovase', 'Tischvase', 'Bodenvase'])],
  [/tablett/,                                       [D + 'Tabletts > Tablett', D + 'Dekoschalen > Dekotablett']],
  [/schale|schüssel/,                               all(D + 'Dekoschalen > ', ['Dekoschale', 'Dekoteller'])],
  [/kerzenständer|kerzenhalter|kerzenleuchter/,     all(D + 'Kerzenhalter > ', ['Kerzenständer', 'Kerzenhalter', 'Kerzenleuchter', 'Wandkerzenhalter@0.6'])],
  [/teelicht/,                                      [D + 'Kerzenhalter > Teelichthalter']],
  [/skulptur|figur/,                                all(D + 'Dekofiguren > ', ['Skulptur', 'Dekofigur', 'Dekoobjekt@0.7'])],
  [/wanddeko|wandobjekt/,                           [D + 'Wanddekoobjekte > Wanddekoobjekt']],
];

// Every category any rule can return; rows outside them aren't kept
const KEEP = new Set(OTTO_RULES.flatMap(r => r[1].map(p => p.split('@')[0].replace(/=$/, ''))));

// OTTO colour words -> the colour names the scoring uses
const COLOUR = [
  [/weiß|weiss/, 'Weiß'], [/creme|ecru|elfenbein|wollweiß|offwhite|off-white/, 'Creme'], [/schwarz/, 'Schwarz'],
  [/grau|anthrazit/, 'Grau'], [/beige|sand|taupe|natur|greige/, 'Beige'], [/braun|cognac|nuss|eiche|holz|kaffee|mokka/, 'Braun'],
  [/türkis|petrol|mint/, 'Türkis'], [/blau|navy/, 'Blau'], [/grün|oliv|salbei/, 'Grün'], [/rot|bordeaux/, 'Rot'],
  [/gelb|senf|ocker/, 'Gelb'], [/orange|terrakotta|rost|apricot/, 'Orange'], [/rosa|pink|rosé|altrosa/, 'Rosa'],
  [/lila|violett|flieder|lavendel/, 'Lila'], [/gold|messing/, 'Gold'], [/kupfer|bronze/, 'Kupfer'],
  [/silber|chrom|edelstahl/, 'Silber'], [/bunt|mehrfarbig|multi/, 'Bunt'],
];
function colourOf(c) {
  const t = String(c || '').toLowerCase().split(/[,/]/)[0];
  const hit = COLOUR.find(([re]) => re.test(t));
  return hit ? hit[1] : '';
}

// One OTTO feed row -> the shape hoeffner-match expects, or null when the
// category isn't one we search in, it's out of stock, or the same product
// in the same colour was already kept (OTTO lists every size as a row).
function shapeRow(r, seen) {
  const path = String(r.merchant_product_category_path || '').replace(/^Einrichten & Wohnen > /, '');
  const parts = path.split(' > ');
  if (!KEEP.has(parts.slice(0, 3).join(' > ')) && !KEEP.has(parts.slice(0, 2).join(' > '))) return null;
  if (r.stock_quantity !== undefined && r.stock_quantity !== '' && Number(r.stock_quantity) <= 0) return null;
  const colour = colourOf(r.colour);
  const key = `${r.parent_product_id || r.aw_product_id}|${colour}`;
  if (seen.has(key)) return null;
  seen.add(key);
  return {
    aw_product_id: r.aw_product_id,
    product_name: r.product_name,
    merchant_product_category_path: path,
    search_price: r.search_price,
    product_price_old: r.product_price_old,
    colour,
    custom_2: r['ShoppingNL:material'] || r.custom_5 || '',
    description: '',
    aw_image_url: r.aw_image_url,
    aw_deep_link: r.aw_deep_link,
    delivery_time: r.delivery_time,
    brand: r.brand_name || '',
    rating: parseFloat(String(r.average_rating || '').replace(',', '.')) || 0,
  };
}

// OTTO is a marketplace: next to OTTO's own and well-known brands sit many
// cheap no-name sellers. Known brands and good ratings rank higher.
const GOOD_BRANDS = /^(otto products|otto home|home affaire|andas|leger home|guido maria kretschmer|inosign|leonique|my home|places of style|w\.?\s?schillig|exxpo|collection ab|sit ?& ?more|domo collection|set one by musterring|musterring|schöner wohnen|esprit|tom tailor|paco home|luxor living|carpetfine|theko|wecon|morgenland|hochwertig|jahnke|loberon|zuiver|kave home|house doctor|bloomingville|broste|villeroy|rosenthal|asa selection|gino falcone|bruno banani|joop|bassetti|möve|hülsta|now! by hülsta|wöstmann|rauch|wiemann|nolte|staud|hartmann|venjakob|niehoff|standard furniture|mca furniture|hela|stuhlfabrik|paidi|lambert|fischer & honsel|brilliant|paul neuhaus|lindby|nordlux|eglo|globo|trio|luce design|sompex|näve)\b/i;

function buildIndex(shaped) {
  const index = hBuild(shaped);
  index.rules = OTTO_RULES;
  index.extra = new Map(shaped.map(r => [r.aw_deep_link, { brand: r.brand, rating: r.rating }]));
  return index;
}

// OTTO titles are long ("Bruno Banani Gardine Tilo, 1 Stück, Kräuselband, …"):
// the display title is the part before the first comma.
function search(index, q, limit = 4) {
  const r = hSearch(index, q, Math.max(limit, 12));
  const bonus = p => {
    const x = index.extra.get(p.link) || {};
    let b = 0;
    if (GOOD_BRANDS.test(x.brand || '')) b += 12;
    if (x.rating >= 4.5) b += 10; else if (x.rating >= 4) b += 5; else if (x.rating && x.rating < 3.5) b -= 15;
    if (p.price < 20) b -= 10;   // the cheapest marketplace items are rarely what a design shows
    return b;
  };
  const ranked = (r.results || []).map(p => ({ p, s: (p.score || 0) + bonus(p) })).sort((a, b) => (b.p.sure - a.p.sure) || (b.s - a.s)).slice(0, limit).map(x => x.p);
  for (const p of ranked) p.title = String(p.title).split(/,\s| [–-] /)[0].slice(0, 90);
  return { ...r, sure: !!(ranked[0] && ranked[0].sure), results: ranked };
}

module.exports = { shapeRow, buildIndex, search, OTTO_RULES };
