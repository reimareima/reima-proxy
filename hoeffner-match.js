// ─────────────────────────────────────────────────────────────────────
//  HÖFFNER PRODUCT MATCHING
//  Pure functions, no Node APIs: the same file runs on the server and
//  can be pasted into a browser console for testing against the feed.
//
//  Input:  rows from the Awin product feed (Möbel Höffner DE)
//  Output: buildIndex(rows) -> index; search(index, query) -> products
//
//  How a match is found:
//    1. The product TYPE decides which Höffner categories are allowed
//       (a "Sessel" never returns a sofa). No type -> no result, the
//       frontend then falls back to the category link.
//    2. Inside those categories products are scored on colour,
//       material, other descriptive words and price.
//    3. Variants of the same product are collapsed, best one kept.
// ─────────────────────────────────────────────────────────────────────

// Product type -> allowed category paths (prefix match on Höffner's
// "merchant_product_category_path"). Order matters: specific first.
// Optional per path weight (default 1); `need` = word the product
// title must contain (for categories that mix several things).
const T = 'Heimtextilien > Teppiche > ';
const RUGS = ['Wohnteppiche', 'Einfarbige Teppiche', 'Kurzflorteppiche', 'Hochflorteppiche',
  'Naturteppiche', 'Vintage Teppiche', 'Orientteppiche', 'Mehr Teppiche'].map(p => T + p);
const SESSEL = 'Polstermöbel > Sessel > ';

const TYPE_RULES = [
  // ── Lighting
  [/nachttischlampe|nachttischleuchte|tischlampe|tischleuchte|leselampe|schreibtischlampe|schreibtischleuchte/,
                                                   ['Lampen & Leuchten > Tischlampen', 'Lampen & Leuchten > Möbelleuchten@0.3']],
  [/bogenlampe|bogenleuchte|stehlampe|stehleuchte|deckenfluter/, ['Lampen & Leuchten > Stehlampen']],
  [/pendel|hängelampe|hängeleuchte|esstischlampe/,  ['Lampen & Leuchten > Hängeleuchten']],
  [/deckenlampe|deckenleuchte|deckenlicht/,         ['Lampen & Leuchten > Deckenleuchten']],
  [/wandlampe|wandleuchte/,                         ['Lampen & Leuchten > Wandleuchten']],
  [/strahler|spots?\b/,                             ['Lampen & Leuchten > Strahler & Spots']],
  [/kinderlampe|kinderleuchte|nachtlicht/,          ['Lampen & Leuchten > Kinderlampen']],
  [/außenleuchte|außenlampe|gartenleuchte/,         ['Lampen & Leuchten > Außenleuchten']],

  // ── Textiles
  [/kinderbettwäsche/,                              ['Heimtextilien > Bettwäsche > Kinderbettwäsche']],
  [/bettwäsche|bettbezug|bettgarnitur/,             ['Heimtextilien > Bettwäsche > Bettwäsche ganzjährig', 'Heimtextilien > Bettwäsche > Bettwäsche Sommer', 'Heimtextilien > Bettwäsche > Bettwäsche Winter']],
  [/spannbettlaken|bettlaken|spannbetttuch/,        ['Heimtextilien > Bettwäsche > Bettlaken']],
  [/kopfkissenbezug/,                               ['Heimtextilien > Bettwäsche > Kopfkissenbezüge']],
  [/kopfkissen/,                                    ['Heimtextilien > Bettwaren > Kopfkissen']],
  [/bettdecke|steppdecke|daunendecke|bettdecken/,   ['Heimtextilien > Bettwaren > Bettdecken']],
  [/tagesdecke|bettüberwurf/,                       ['Heimtextilien > Dekokissen & Decken > Tagesdecken & Bettüberwürfe']],
  [/tischdecke/,                                    ['Heimtextilien > Tischwäsche & Küchentextilien > Tischdecken']],
  [/tischläufer/,                                   ['Heimtextilien > Tischwäsche & Küchentextilien > Tischläufer']],
  [/platzset|tischset/,                             ['Heimtextilien > Tischwäsche & Küchentextilien > Platzsets']],
  [/stuhlkissen|sitzkissen|sitzauflage/,            ['Heimtextilien > Dekokissen & Decken > Kissen', 'Garten > Auflagen & Kissen > Outdoor-Sitzkissen']],
  [/kissen|kissenbezug|kissenhülle/,                ['Heimtextilien > Dekokissen & Decken > Kissen']],
  [/decke|plaid|überwurf|wohndecke/,                ['Heimtextilien > Dekokissen & Decken > Kuscheldecken & Wohndecken', 'Heimtextilien > Dekokissen & Decken > Tagesdecken & Bettüberwürfe@0.5']],
  [/gardinenstange|vorhangstange/,                  ['Heimtextilien > Gardinen & Rollos > Gardinenstangen & Zubehör']],
  [/rollo|jalousie|plissee/,                        ['Heimtextilien > Gardinen & Rollos > Rollos & Jalousien']],
  [/vorhang|vorhänge|gardine|schlaufenschal|ösenschal|store\b/, ['Heimtextilien > Gardinen & Rollos > Gardinen & Vorhänge']],
  [/badematte|badvorleger|badteppich/,              ['Heimtextilien > Badtextilien > Badematten & Badvorleger']],
  [/bademantel/,                                    ['Heimtextilien > Badtextilien > Bademäntel']],
  [/handtuch|handtücher|badetuch|duschtuch/,        ['Heimtextilien > Badtextilien > Handtücher & Badetücher', 'Heimtextilien > Badtextilien > Handtuch-Sets']],

  // ── Rugs
  [/schaffell|lammfell|\bfell\b|fellteppich/,       [T + 'Felle']],
  [/fußmatte|türmatte|schmutzfang|fussmatte/,       [T + 'Fußmatten & Stufenmatten']],
  [/bettumrandung/,                                 [T + 'Bettumrandungen']],
  [/läufer/,                                        [T + 'Läufer']],
  [/kinderteppich|spielteppich/,                    [T + 'Kinderteppiche']],
  [/outdoor.*teppich|teppich.*(outdoor|balkon|terrasse)|außenteppich|balkonteppich/, [T + 'Outdoor Teppiche']],
  [/(orient|perser).*teppich|orientteppich|perserteppich/, [T + 'Orientteppiche']],
  [/vintage.*teppich|teppich.*vintage/,             [T + 'Vintage Teppiche', ...RUGS.map(p => p + '@0.4')]],
  [/(hochflor|shaggy).*teppich|teppich.*(hochflor|shaggy)|flokati/, [T + 'Hochflorteppiche']],
  [/kurzflor.*teppich|teppich.*kurzflor/,           [T + 'Kurzflorteppiche', ...RUGS.map(p => p + '@0.4')]],
  [/(jute|sisal|seegras|natur).*teppich|teppich.*(jute|sisal|seegras)|naturteppich/, [T + 'Naturteppiche', ...RUGS.map(p => p + '@0.4')]],
  [/teppich/,                                       RUGS],

  // ── Seating
  [/chefsessel|bürostuhl|schreibtischstuhl|drehstuhl|bürosessel|gamingstuhl/, ['Stühle > Bürostühle']],
  [/sitzsack/,                                      ['Hocker > Sitzsäcke']],
  [/pouf|sitzpouf|fußhocker|polsterhocker/,         ['Hocker > Sitzpouf', 'Hocker@0.6']],
  [/barhocker|tresenhocker/,                        ['Hocker > Barhocker']],
  [/hocker/,                                        ['Hocker', 'Hocker > Sitzpouf@0.6']],
  [/ohrensessel/,                                   [SESSEL + 'Ohrensessel']],
  [/relaxsessel|fernsehsessel|tv-sessel|liegesessel/, [SESSEL + 'Relaxsessel', SESSEL + 'Fernsehsessel']],
  [/schaukelsessel/,                                [SESSEL + 'Schaukelsessel']],
  [/drehsessel/,                                    [SESSEL + 'Drehsessel']],
  [/schlafsessel/,                                  [SESSEL + 'Schlafsessel']],
  [/rattansessel|korbsessel|rattanstuhl/,           ['Stühle > Rattanstühle', SESSEL + 'Lounge Sessel@0.6', SESSEL + 'Cocktailsessel@0.6']],
  // Generic armchair: accent chairs first, TV/relax chairs only as last resort
  [/sessel/,                                        [SESSEL + 'Cocktailsessel', SESSEL + 'Lounge Sessel', SESSEL + 'Ohrensessel@0.8',
                                                     SESSEL + 'Drehsessel@0.7', SESSEL + 'Ledersessel@0.7', SESSEL + 'Mehr Sessel@0.7',
                                                     SESSEL + 'Relaxsessel@0.25', SESSEL + 'Fernsehsessel@0.15']],
  [/recamiere|récamière|récamiere|ottomane|chaiselongue/, ['Polstermöbel > Ottomanen & Recamiere']],
  [/daybed|liege\b|relaxliege/,                     ['Polstermöbel > Liegen', 'Polstermöbel > Relaxliegen']],
  [/schlafsofa|schlafcouch|bettsofa/,               ['Polstermöbel > Sofas > Schlafsofas']],
  [/wohnlandschaft|u-sofa|u-form|big-sofa|bigsofa/, ['Polstermöbel > Sofas > Wohnlandschaften', 'Polstermöbel > Sofas > Big-Sofas']],
  [/ecksofa|eckcouch|ecksofas|l-sofa|l-form/,       ['Polstermöbel > Sofas > Ecksofas']],
  [/modulsofa|modul-sofa/,                          ['Polstermöbel > Sofas > Modulsofas']],
  [/2-sitzer|zweisitzer/,                           ['Polstermöbel > Sofas > 2-Sitzer']],
  [/3-sitzer|dreisitzer/,                           ['Polstermöbel > Sofas > 3-Sitzer']],
  [/sofa|couch(?!tisch)/,                           ['Polstermöbel > Sofas > 3-Sitzer', 'Polstermöbel > Sofas > 2-Sitzer', 'Polstermöbel > Sofas > Einzelsofas',
                                                     'Polstermöbel > Sofas > Big-Sofas', 'Polstermöbel > Sofas > Modulsofas@0.8', 'Polstermöbel > Sofas > Ecksofas@0.5']],
  [/eckbank/,                                       ['Bänke > Eckbänke']],
  [/sitzbank|bank\b|bänke/,                         ['Bänke > Einzelbänke']],
  [/freischwinger|schwingstuhl/,                    ['Stühle > Schwingstühle']],
  [/klappstuhl/,                                    ['Stühle > Klappstühle']],
  [/küchenstuhl/,                                   ['Stühle > Küchenstühle']],
  [/polsterstuhl/,                                  ['Stühle > Polsterstühle', 'Stühle > Esszimmerstühle@0.7']],
  [/holzstuhl/,                                     ['Stühle > Holzstühle', 'Stühle > Esszimmerstühle@0.7']],
  [/esszimmerstuhl|esstischstuhl|armlehnstuhl|stuhl|stühle/, ['Stühle > Esszimmerstühle', 'Stühle > Polsterstühle', 'Stühle > Holzstühle',
                                                     'Stühle > Schwingstühle@0.8', 'Stühle > Rattanstühle@0.8', 'Stühle > Küchenstühle@0.5']],

  // ── Beds
  [/babybett|beistellbett/,                         ['Baby > Babymöbel > Babybetten', 'Baby > Babymöbel > Beistellbetten']],
  [/hochbett|etagenbett|kinderbett/,                ['Kindermöbel > Kinderbetten']],
  [/boxspring/,                                     ['Betten > Boxspringbetten']],
  [/polsterbett/,                                   ['Betten > Polsterbetten']],
  [/gästebett/,                                     ['Betten > Gästebetten']],
  [/massivholzbett|holzbett/,                       ['Betten > Massivholzbetten', 'Betten > Bettgestelle', 'Betten > Komfortbetten@0.6']],
  [/metallbett/,                                    ['Betten > Bettgestelle', 'Betten > Komfortbetten@0.6']],
  [/bettgestell|bettrahmen|bett\b|betten\b|doppelbett|einzelbett/, ['Betten > Bettgestelle', 'Betten > Polsterbetten', 'Betten > Massivholzbetten',
                                                     'Betten > Doppelbetten', 'Betten > Einzelbetten', 'Betten > Komfortbetten@0.7', 'Betten > Boxspringbetten@0.4']],

  // ── Tables
  [/nachttisch|nachtkonsole|nachtschrank/,          ['Tische > Nachttische']],
  [/schminktisch|frisiertisch|frisierkommode/,      ['Tische > Schminktische']],
  [/kinderschreibtisch/,                            ['Kindermöbel > Kinderschreibtische']],
  [/schreibtisch|computertisch/,                    ['Tische > Schreibtische', 'Tische > Computertische']],
  [/couchtisch|sofatisch|wohnzimmertisch/,          ['Tische > Couchtische']],
  [/blumenständer|pflanzenständer/,                 ['Tische > Beistelltische > Blumenständer']],
  [/beistelltisch|satztisch/,                       ['Tische > Beistelltische']],
  [/konsole|konsolentisch|wandtisch/,               ['Tische > Konsolentische']],
  [/bartisch|stehtisch/,                            ['Tische > Bartische']],
  [/servierwagen|rollwagen|teewagen/,               ['Tische > Servierwagen']],
  [/esstisch|küchentisch|esszimmertisch/,           ['Tische > Esstische']],
  [/tisch/,                                         ['Tische > Esstische', 'Tische > Couchtische@0.7', 'Tische > Beistelltische@0.6']],

  // ── Storage
  [/kleiderschrank/,                                ['Schränke > Kleiderschränke']],
  [/schuhschrank|schuhregal/,                       ['Schränke > Schuhschränke', 'Regale > Schuhregale']],
  [/dielenschrank/,                                 ['Schränke > Dielenschränke']],
  [/spiegelschrank/,                                ['Schränke > Badschränke > Spiegelschränke']],
  [/waschbeckenunterschrank|waschtischunterschrank|waschtisch/, ['Schränke > Badschränke > Waschbecken-unterschränke', 'Schränke > Badschränke > Waschplätze']],
  [/badschrank|hochschrank|badmöbel/,               ['Schränke > Badschränke']],
  [/hängeschrank/,                                  ['Schränke > Hängeschränke']],
  [/vitrine/,                                       ['Schränke > Vitrinen']],
  [/highboard/,                                     ['Kommoden & Sideboards > Highboards']],
  [/sideboard|anrichte/,                            ['Kommoden & Sideboards > Sideboards', 'Kommoden & Sideboards > Lowboards@0.5']],
  [/lowboard|tv-board|tv-möbel|tv-schrank|tv-bank|fernsehschrank|tv-lowboard/, ['Kommoden & Sideboards > TV Lowboards', 'Kommoden & Sideboards > Lowboards']],
  [/buffet/,                                        ['Schränke > Buffets']],
  [/sekretär/,                                      ['Kommoden & Sideboards > Sekretäre']],
  [/wohnwand/,                                      ['Kommoden & Sideboards > Wohnwände']],
  [/wickelkommode/,                                 ['Baby > Babymöbel > Wickelkommoden']],
  [/kommode/,                                       ['Kommoden & Sideboards > Kommoden']],
  [/weinregal/,                                     ['Regale > Weinregale']],
  [/wandboard/,                                     ['Regale > Wandboards']],
  [/wandregal|hängeregal|schweberegal/,             ['Regale > Wandregale', 'Regale > Wandboards@0.7']],
  [/eckregal/,                                      ['Regale > Eckregale']],
  [/badregal/,                                      ['Regale > Badregale']],
  [/raumteiler|paravent/,                           ['Regale > Raumteiler', 'Regale > Standregale@0.6']],
  [/bücherregal|standregal|regal/,                  ['Regale > Bücherregale', 'Regale > Standregale', 'Regale > Wandregale@0.6']],
  [/garderobenständer|kleiderständer|kleiderstange/, ['Garderoben & Kleiderstangen > Garderobenständer']],
  [/wandgarderobe|hakenleiste|garderobenhaken|wandhaken/, ['Garderoben & Kleiderstangen > Wandgarderoben', 'Garderoben & Kleiderstangen > Hakenleisten']],
  [/garderobe/,                                     ['Garderoben & Kleiderstangen > Garderoben', 'Garderoben & Kleiderstangen > Garderobensysteme', 'Garderoben & Kleiderstangen > Wandgarderoben@0.7']],
  [/truhe|kiste/,                                   ['Aufbewahrung > Truhen & Kisten', 'Aufbewahrung > Aufbewahrungsboxen@0.6']],
  [/wäschekorb|wäschesammler|wäschetruhe/,          ['Aufbewahrung > Wäscheaufbewahrung']],
  [/korb|körbe/,                                    ['Aufbewahrung > Körbe']],
  [/aufbewahrungsbox|box\b|boxen/,                  ['Aufbewahrung > Aufbewahrungsboxen']],
  [/schirmständer|zeitungsständer/,                 ['Aufbewahrung > Zeitungsständer & Schirmständer']],
  [/schrank|schränke/,                              ['Schränke > Dielenschränke', 'Schränke > Mehr Schränke', 'Schränke > Vitrinen@0.6', 'Schränke > Kleiderschränke@0.6']],

  // ── Decor
  [/spiegel/,                                       ['Accessoires > Spiegel', 'Garderoben & Kleiderstangen > Garderoben Spiegel']],
  [/bilderrahmen/,                                  ['Accessoires > Bilderrahmen']],
  [/wanduhr|\buhr\b/,                               ['Accessoires > Uhren']],
  [/vase/,                                          ['Accessoires > Vasen']],
  [/schale|schüssel/,                               ['Accessoires > Deko-Schalen']],
  [/tablett|etagere/,                               ['Küchenzubehör & Helfer > Küchenhelfer > Tabletts & Etageren', 'Accessoires > Deko-Schalen@0.5']],
  [/kerzenständer|kerzenhalter|kerzenleuchter/,     ['Accessoires > Kerzen & Kerzenständer > Kerzenständer', 'Accessoires > Kerzen & Kerzenständer@0.6']],
  [/teelicht/,                                      ['Accessoires > Kerzen & Kerzenständer > Teelichthalter']],
  [/laterne|windlicht/,                             ['Accessoires > Kerzen & Kerzenständer', 'Accessoires > Dekoartikel@0.6'], /laterne|windlicht/],
  [/kerze/,                                         ['Accessoires > Kerzen & Kerzenständer']],
  [/figur|skulptur|deko|objekt|buchstütze/,         ['Accessoires > Dekoartikel']],
];

// Never matched (Höffner doesn't carry these well; also plants by request)
const EXCLUDE_RE = /vinyl|laminat|parkett|fliese|tapete|wandfarbe|teppichboden|bodenbelag|sockelleiste|led-?streifen|led strip|lichterkette|glühbirne|leuchtmittel|smart plug|steckdose|kabel|pflanze|baum\b|monstera|olive|ficus|palme|kaktus|eukalyptus|bonsai|trockenblume|pampas|kunstblume/;

// Query colour words -> Höffner feed colours. First entry = exact match,
// the rest count as "close enough".
const COLOURS = [
  [/^(weiß|weiss|schneeweiß|reinweiß)/,              ['Weiß', 'Creme']],
  [/^(off-?white|ecru|elfenbein|creme|cremeweiß|wollweiß)/, ['Creme', 'Weiß', 'Beige']],
  [/^(schwarz|anthrazitschwarz)/,                    ['Schwarz', 'Grau']],
  [/^(hellgrau|grau|anthrazit|steingrau|dunkelgrau|silbergrau)/, ['Grau', 'Silber']],
  [/^(braun|cognac|nussbaum|walnuss|schoko|mokka|karamell|hellbraun|dunkelbraun|kastanie|caramel)/, ['Braun', 'Beige']],
  [/^(beige|taupe|sand|champagner|hafer|greige|natur|naturfarben|leinenfarben|camel)/, ['Beige', 'Creme', 'Braun']],
  [/^(petrol)/,                                      ['Türkis', 'Blau', 'Grün']],
  [/^(türkis|tuerkis|mint)/,                         ['Türkis', 'Grün', 'Blau']],
  [/^(blau|navy|marine|dunkelblau|hellblau|taubenblau|rauchblau|nachtblau)/, ['Blau', 'Türkis']],
  [/^(grün|gruen|salbei|oliv|tannengrün|smaragd|moosgrün|dunkelgrün|flaschengrün|khaki|jade)/, ['Grün']],
  [/^(rot|bordeaux|weinrot|dunkelrot|ziegelrot)(e|er|es|en|em)?$/, ['Rot']],
  [/^(gelb|senf|ocker|curry|honig)/,                 ['Gelb', 'Orange']],
  [/^(orange|terrakotta|terracotta|rostrot|rostfarben|rost|zimt|kupferrot|apricot)$/, ['Orange', 'Rot', 'Braun']],
  [/^(rosa|altrosa|rosé|rose|puder|blush|pastellrosa)$/, ['Rosa']],
  [/^(pink|magenta)/,                                ['Rosa']],
  [/^(lila|violett|aubergine|lavendel|flieder|mauve)/, ['Lila', 'Rosa']],
  [/^(kupfer|bronze)/,                               ['Kupfer', 'Gold']],
  [/^(gold|messing|goldfarben)/,                     ['Gold', 'Kupfer']],
  [/^(silber|chrom|edelstahl|silberfarben)/,         ['Silber', 'Grau']],
  [/^(bunt|mehrfarbig|multicolor)/,                  ['Bunt']],
];

// Materials and finishes: query word -> words to look for in the product.
const MATERIALS = [
  ['samt',      /samt|velours|velvet/],
  ['cord',      /cord/],
  ['bouclé',    /bouclé|boucle|bouclè/],
  ['boucle',    /bouclé|boucle|bouclè/],
  ['teddy',     /teddy|plüsch|sherpa/],
  ['leder',     /leder/],
  ['leinen',    /leinen/],
  ['baumwolle', /baumwolle/],
  ['wolle',     /wolle|wool/],
  ['chenille',  /chenille/],
  ['strick',    /strick/],
  ['jute',      /jute/],
  ['sisal',     /sisal/],
  ['rattan',    /rattan|geflecht|korbgeflecht|wiener geflecht/],
  ['geflecht',  /rattan|geflecht/],
  ['bambus',    /bambus/],
  ['eiche',     /eiche/],
  ['nussbaum',  /nussbaum|walnuss/],
  ['walnuss',   /nussbaum|walnuss/],
  ['buche',     /buche/],
  ['akazie',    /akazie/],
  ['mango',     /mango/],
  ['teak',      /teak/],
  ['kiefer',    /kiefer|pinie/],
  ['massivholz', /massivholz|massiv/],
  ['massiv',    /massiv/],
  ['holz',      /holz|eiche|buche|akazie|nussbaum|kiefer|mango/],
  ['marmor',    /marmor/],
  ['travertin', /travertin/],
  ['stein',     /stein|marmor|travertin|beton/],
  ['beton',     /beton/],
  ['glas',      /glas/],
  ['metall',    /metall|stahl|eisen/],
  ['messing',   /messing|gold/],
  ['chrom',     /chrom/],
  ['keramik',   /keramik|steinzeug|porzellan/],
  ['steinzeug', /steinzeug|keramik/],
  ['porzellan', /porzellan/],
  ['terrakotta', /terrakotta|terracotta|ton\b/],
  ['papier',    /papier/],
  ['stoff',     /stoff|webstoff/],
  ['filz',      /filz/],
  ['seide',     /seide/],
  ['satin',     /satin/],
  ['kunstleder', /kunstleder/],
];

// Feature words with the different ways Höffner writes them
const FEATURE_SYNONYMS = {
  rillen: /rillen|riffel|gerillt|lamellen|rippen/, gerillt: /rillen|riffel|gerillt|lamellen|rippen/,
  schwebend: /schwebend|hängend|wandmontage|wandhänge/, geflochten: /geflecht|geflochten/,
  rund: /rund|ø/, ausziehbar: /ausziehbar|ausziehfunktion|auszug/, dimmbar: /dimmbar|dimmfunktion/,
  schlaffunktion: /schlaffunktion|bettfunktion/, bettkasten: /bettkasten|stauraum/,
};
// Wood words imply a colour when the query names none
const WOOD_TONES = [
  [/eiche|buche|kiefer|birke|esche|natur/, ['Beige', 'Braun']],
  [/nussbaum|walnuss|akazie|mango|teak|wildeiche|räuchereiche|kernbuche/, ['Braun']],
];

// Shape / feature words worth rewarding when they appear in a product
const FEATURES = ['rund', 'oval', 'eckig', 'quadratisch', 'rechteckig', 'ausziehbar', 'schwebend', 'hängend',
  'dimmbar', 'schlaffunktion', 'bettkasten', 'armlehne', 'armlehnen', 'drehbar', 'höhenverstellbar', 'stapelbar',
  'gesteppt', 'gerillt', 'rillen', 'geflochten', 'skandinavisch', 'industrial', 'vintage', 'landhaus', 'boho',
  'japandi', 'retro', 'modern', 'minimalistisch', 'klassisch', 'chesterfield', 'tulpe', 'kugel', 'schirm',
  'rollen', 'schubladen', 'türen', 'glastüren', 'offen', 'klappbar', 'kissen', 'fransen', 'muster', 'gestreift',
  'karo', 'hochflor', 'kurzflor', 'waschbar', 'blickdicht', 'transparent', 'verdunkelung', 'led', 'kabellos',
  'akku', 'groß', 'klein', 'schmal', 'breit', 'hoch', 'niedrig', 'xxl', 'mini', 'organisch', 'geschwungen'];

const STOP = new Set(['mit', 'und', 'für', 'aus', 'der', 'die', 'das', 'im', 'in', 'am', 'set', 'stück', 'cm',
  'design', 'deko', 'wohnzimmer', 'schlafzimmer', 'esszimmer', 'flur', 'bad', 'modern', 'stil', 'look']);

function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

// ── Index ────────────────────────────────────────────────────────────
// rows: objects with the Awin feed column names
function buildIndex(rows) {
  const items = [];
  for (const r of rows) {
    const path = r.merchant_product_category_path || '';
    if (!path) continue;
    const title = String(r.product_name || '').split('¦')[0].replace(/[`´']/g, '').replace(/\s+/g, ' ').trim();
    if (!title) continue;
    const price = parseFloat(r.search_price) || 0;
    if (!price) continue;
    const material = String(r.custom_2 || '').replace(/•/g, ' ').replace(/\s+/g, ' ').trim();
    const desc = norm(String(r.description || '').slice(0, 600));
    items.push({
      id: r.aw_product_id,
      title,
      path,
      colour: r.colour || '',
      material,
      price,
      oldPrice: parseFloat(r.product_price_old) || 0,
      image: r.aw_image_url || '',
      imageLarge: r.merchant_image_url || r.large_image || '',
      link: r.aw_deep_link,
      delivery: r.delivery_time || '',
      // what we search in: title weighs most, so it's kept separate
      t: norm(title),
      x: norm(`${path} ${material} ${desc}`),
    });
  }
  return { items, builtAt: Date.now() };
}

// ── Query parsing ────────────────────────────────────────────────────
function parseQuery(q) {
  const text = norm(q.text);
  const words = text.split(/[\s,/()+&-]+/).filter(Boolean);

  // Product type: first word decides if it names a type, otherwise the whole text
  const findRule = s => TYPE_RULES.find(([re]) => re.test(s));
  let rule = (words[0] && !/^(deko|set|design|moderne?[rs]?|große?[rs]?|kleine?[rs]?|runde?[rs]?)$/.test(words[0]) && findRule(words[0])) || findRule(text);
  // A more specific rule of the same family wins ("Sofa 3-Sitzer" -> 3-Sitzer,
  // "Teppich Jute" -> Naturteppiche), but never a different product type
  // ("Sessel mit Kissen" stays a Sessel).
  if (rule) {
    const fam = p => p.split('@')[0].split(' > ').slice(0, 2).join(' > ');
    const ruleFams = new Set(rule[1].map(fam));
    const better = TYPE_RULES.find(r => r !== rule && TYPE_RULES.indexOf(r) < TYPE_RULES.indexOf(rule)
      && r[0].test(text) && r[1].every(p => ruleFams.has(fam(p))) && r[1].length <= rule[1].length);
    if (better) rule = better;
  }

  const paths = rule ? rule[1].map(p => {
    const [path, w] = p.split('@');
    return { path, w: w ? parseFloat(w) : 1 };
  }) : [];

  let colour = null;
  for (const w of words) {
    const hit = COLOURS.find(([re]) => re.test(w));
    if (hit) { colour = hit[1]; break; }
  }

  // material: from the explicit field first, then the text
  const matText = norm(`${q.material || ''} ${text}`);
  const materials = MATERIALS.filter(([k]) => matText.includes(k)).map(([, re]) => re);
  // drop "holz" if a specific wood was found, "stein" if marble etc.
  const features = FEATURES.filter(f => words.includes(f));
  const wood = colour ? null : (WOOD_TONES.find(([re]) => re.test(matText)) || [])[1] || null;
  const massiv = /massiv/.test(matText);

  // Leftover descriptive words (not type, colour, material, stop words)
  const rest = words.filter(w => w.length >= 4 && !STOP.has(w) && !features.includes(w)
    && !COLOURS.some(([re]) => re.test(w)) && !MATERIALS.some(([k]) => w.includes(k))
    && !(rule && rule[0].test(w)));

  let priceMin = 0, priceMax = 0;
  const pm = String(q.price || '').replace(/\./g, '').match(/(\d+)\D+(\d+)/);
  if (pm) { priceMin = +pm[1]; priceMax = +pm[2]; }

  return { text, rule, need: rule && rule[2], paths, colour, wood, massiv, materials, features, rest, priceMin, priceMax,
    excluded: EXCLUDE_RE.test(text) };
}

// ── Search ───────────────────────────────────────────────────────────
function scoreItem(it, Q, pathW) {
  let s = 30 * pathW;
  const why = [];

  if (Q.colour) {
    if (it.colour === Q.colour[0]) { s += 40; why.push('colour'); }
    else if (Q.colour.includes(it.colour)) { s += 15; why.push('colour~'); }
    else if (it.colour) s -= 30;
    else s -= 10;
  }

  const all = it.t + ' ' + it.x;
  let matHits = 0;
  for (const re of Q.materials) {
    if (re.test(it.t)) { s += 28; matHits++; why.push('mat'); }
    else if (re.test(all)) { s += 20; matHits++; why.push('mat~'); }
    else s -= 8;
  }
  if (Q.wood) {
    if (Q.wood.includes(it.colour)) s += 12;
    else if (/^(Weiß|Grau|Schwarz|Silber)$/.test(it.colour)) s -= 12;
  }
  if (Q.massiv && /dekor/.test(all) && !/massiv/.test(all)) s -= 12;

  for (const f of Q.features) {
    const re = FEATURE_SYNONYMS[f];
    if (re ? re.test(all) : all.includes(f)) { s += 9; why.push(f); }
  }
  for (const w of Q.rest) {
    const stem = w.length > 5 ? w.slice(0, -1) : w;
    if (it.t.includes(stem)) { s += 8; why.push(w); }
    else if (it.x.includes(stem)) s += 3;
  }

  if (Q.priceMax) {
    const lo = Q.priceMin * 0.6, hi = Q.priceMax * 1.5;
    if (it.price >= Q.priceMin && it.price <= Q.priceMax) { s += 14; why.push('price'); }
    else if (it.price >= lo && it.price <= hi) s += 4;
    else if (it.price > Q.priceMax * 3) s -= 18;
    else s -= 8;
  }
  const colourOk = !Q.colour || it.colour === Q.colour[0] || Q.colour.includes(it.colour);
  const materialOk = !Q.materials.length || matHits > 0;
  return { s, why, sure: colourOk && materialOk };
}

// query: { text, material?, price? }  ->  { type, results: [...] }
function search(index, query, limit = 4) {
  const Q = parseQuery(query);
  if (Q.excluded || !Q.paths.length) return { matched: false, reason: Q.excluded ? 'excluded' : 'no-type', results: [] };

  const best = new Map();   // collapse variants by title
  for (const it of index.items) {
    let pathW = 0;
    for (const p of Q.paths) if (it.path === p.path || it.path.startsWith(p.path + ' >')) { pathW = Math.max(pathW, p.w); }
    if (!pathW) continue;
    if (Q.need && !Q.need.test(it.t)) continue;
    const { s, why, sure } = scoreItem(it, Q, pathW);
    const key = it.t;
    const prev = best.get(key);
    if (!prev || s > prev.score) best.set(key, { it, score: s, why, sure });
  }

  const ranked = [...best.values()].sort((a, b) => b.score - a.score || a.it.price - b.it.price);
  // A little variety: don't return 4 near-identical series members
  const out = [];
  const seenSeries = new Set();
  for (const r of ranked) {
    const series = r.it.t.split(' ').slice(-1)[0];
    if (seenSeries.has(series) && out.length < limit - 1 && ranked.length > limit * 3) continue;
    seenSeries.add(series);
    out.push(r);
    if (out.length >= limit) break;
  }

  return {
    matched: out.length > 0,
    // "sure" = the best hit has the asked-for colour and material, so the
    // frontend may show it as THE product; otherwise it's just inspiration
    sure: !!(out[0] && out[0].sure),
    colour: Q.colour ? Q.colour[0] : null,
    results: out.map(({ it, score, why, sure }) => ({ sure,
      id: it.id, title: it.title, price: it.price, oldPrice: it.oldPrice > it.price ? it.oldPrice : 0,
      colour: it.colour, image: it.image, imageLarge: it.imageLarge, link: it.link, delivery: it.delivery,
      category: it.path.split(' > ').slice(-1)[0], score: Math.round(score), why,
    })),
  };
}

if (typeof module !== 'undefined') module.exports = { buildIndex, search, parseQuery, TYPE_RULES };
