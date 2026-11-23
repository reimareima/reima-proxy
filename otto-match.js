// ─────────────────────────────────────────────────────────────────────
//  OTTO PRODUCT MATCHING
//  OTTO's category tree differs from Höffner's, the scoring doesn't:
//  these rules map a product type to OTTO categories and hand the rest
//  to hoeffner-match.js (index.rules).
//
//  OTTO paths, root "Einrichten & Wohnen > " cut off, e.g.
//  "Möbel > Tische > Couchtisch". The third level is the product type.
// ─────────────────────────────────────────────────────────────────────

const { buildIndex: hBuild, search: hSearch, parseQuery } = require('./hoeffner-match');

const L = 'Leuchten > Leuchten > ';
const M = 'Möbel > ';
const W = 'Wohntextilien > ';
const D = 'Deko, Accessoires > ';
const RUG = W + 'Teppiche > ';
const G = 'Garten > Pflanzgefäße > ';
const LK = 'Leuchten > Lichterketten > ';
const B = D + 'Bilder > ';
const all = (base, names) => names.map(n => base + n);

const OTTO_RULES = [
  // ── Specific first: these contain words of more general types below
  [/tischläufer/,                                   [W + 'Tischdecken > Tischläufer']],
  [/tischdecke|mitteldecke/,                        [W + 'Tischdecken > Tischdecke', W + 'Tischdecken > Mitteldecke@0.6']],
  [/au(ß|ss)en.?wand|fassadenleuchte/,              all(L, ['Außen-Wandleuchte', 'LED Außen-Wandleuchte'])],
  [/led.?kerze|flammenlose|elektrische kerze/,      [L + 'LED-Kerze', D + 'Kerzen > LED-Kerze']],
  [/led.?(streifen|stripe?s?|band)|lichtleiste|lichtband/, [LK + 'LED-Streifen', LK + 'LED Stripe', L + 'LED Lichtleiste']],
  [/lichterkette|lichtervorhang|lichternetz|lichtergirlande|fairy/, [LK + 'LED-Lichterkette', LK + 'Lichterkette', LK + 'LED-Lichtervorhang@0.7', LK + 'Lichtervorhang@0.7', LK + 'LED-Girlande@0.6']],
  [/kunst(pflanze|baum|blume|gras|zweig|orchidee)|künstliche?r?s? |trockenblume|trockengras|pampas/, all(D + 'Kunstpflanzen > ', ['Kunstpflanze', 'Künstliche Zimmerpflanze', 'Kunstbaum', 'Kunstblume@0.8', 'Kunstblumenstrauß@0.7', 'Trockenblume', 'Kunstgras@0.7', 'Kunstzweig@0.6'])],
  [/übertopf|blumentopf|pflanzkübel|pflanztopf|pflanzgefäß|pflanzschale/, [G + 'Übertopf', G + 'Blumentopf', G + 'Pflanzkübel', G + 'Pflanzschale@0.6', G + 'Blumenkasten@0.5', G + 'Balkonkasten@0.5']],
  [/blumenständer|pflanzenständer|pflanzenregal|pflanzentreppe|blumenhocker/, [G + 'Blumenständer', G + 'Pflanzentreppe@0.7', 'Haushalt > Hocker > Blumenhocker']],
  [/led.?panel|deckenpanel/,                        [L + 'LED Panel']],
  [/gewürzregal/,                                   [M + 'Regale > Gewürzregal']],
  [/schuhbank/,                                     [M + 'Sitzbänke > Schuhbank']],
  [/balkonkasten|blumenkasten/,                     [G + 'Balkonkasten', G + 'Blumenkasten']],
  [/sonnenschirm|balkonschirm/,                     ['Garten > Standschirme > Sonnenschirm', 'Garten > Standschirme > Balkonschirm']],
  [/rollcontainer/,                                 [M + 'Rollwagen > Rollcontainer']],
  [/hängeschrank|oberschrank/,                      [M + 'Schränke > Hängeschrank']],
  [/wandhaken|kleiderhaken|garderobenhaken/,        [M + 'Haken > Wandhaken', M + 'Haken > Kleiderhaken', D + 'Haken > Dekohaken@0.7']],
  [/buchstütze/,                                    [D + 'Buchstützen > Buchstütze']],
  [/kopfteil/,                                      [M + 'Polsterauflagen > Kopfteil']],
  [/standspiegel|stehspiegel|bodenspiegel|spiegel stehend/, ['Haushalt > Spiegel > Standspiegel', 'Haushalt > Spiegel > Ganzkörperspiegel']],
  [/badematte|badvorleger|badteppich/,              [W + 'Badematten > Badematte']],
  [/wandteppich|wandbehang/,                        [RUG + 'Wandteppich']],
  [/küchenläufer/,                                  [RUG + 'Küchenläufer', RUG + 'Läufer@0.6']],
  [/badspiegel|spiegelschrank/,                     ['Haushalt > Spiegel > Badspiegel', M + 'Schränke > Spiegelschrank', M + 'Schränke > Badezimmerspiegelschrank']],
  [/waschbeckenunterschrank|waschtisch|badkommode|badschrank|badmöbel/, [M + 'Schränke > Waschbeckenunterschrank', M + 'Waschtische > Waschtisch', M + 'Sideboards > Badkommode', M + 'Kastenmöbel-Sets > Badmöbel-Set@0.6', M + 'Schränke > Hochschrank@0.5']],
  [/badregal|duschregal/,                           [M + 'Regale > Badregal']],
  [/handtuchhalter|handtuchständer|handtuchleiter/, [M + 'Handtuchhalter > Handtuchhalter', M + 'Handtuchhalter > Handtuchständer']],
  [/handtuch|handtücher|badetuch/,                  all(W + 'Handtücher > ', ['Handtuch', 'Handtücher', 'Handtuch Set', 'Badetuch@0.7'])],
  [/duschvorhang/,                                  [W + 'Duschvorhänge > Duschvorhang']],

  // ── Lighting
  [/schreibtischlampe|schreibtischleuchte|arbeitsleuchte|klemmleuchte/, all(L, ['Schreibtischlampe', 'LED Schreibtischlampe', 'Klemmleuchte', 'LED Klemmleuchte'])],
  [/nachttischlampe|nachttischleuchte|tischlampe|tischleuchte|leselampe/, all(L, ['Tischleuchte', 'LED Tischleuchte', 'Nachttischlampe', 'LED Nachttischlampe'])],
  [/bogenlampe|bogenleuchte/,                       all(L, ['Bogenlampe', 'Stehlampe@0.6', 'LED Stehlampe@0.6'])],
  [/stehlampe|stehleuchte|deckenfluter/,            all(L, ['Stehlampe', 'LED Stehlampe', 'Bogenlampe@0.7', 'Deckenfluter@0.6'])],
  [/kronleuchter|lüster/,                           all(L, ['Kronleuchter'])],
  [/pendel|hängelampe|hängeleuchte|esstischlampe/,  all(L, ['Pendelleuchte', 'LED Pendelleuchte', 'Hängeleuchte', 'LED-Hängeleuchte'])],
  [/deckenstrahler|deckenspot|strahler|spots?\b/,   all(L, ['Deckenstrahler', 'LED Deckenstrahler', 'Deckenspot', 'LED Aufbaustrahler@0.7'])],
  [/deckenlampe|deckenleuchte|deckenlicht/,         all(L, ['Deckenleuchte', 'LED Deckenleuchte', 'Deckenleuchten'])],
  [/wandlampe|wandleuchte/,                         all(L, ['Wandleuchte', 'LED Wandleuchte'])],
  [/solarleuchte|solarlampe|gartenleuchte|gartenlampe|balkonleuchte|balkonlampe|außenleuchte|outdoor.?(lampe|leuchte)/, all(L, ['LED Solarleuchte', 'LED Gartenleuchte', 'Gartenleuchte', 'LED Außen-Tischleuchte'])],
  [/lampenschirm/,                                  ['Leuchten > Lampenschirme > Lampenschirm']],
  [/kugelleuchte|kugellampe|leuchtkugel/,           [L + 'LED Kugelleuchte']],
  [/nachtlicht/,                                    all(L, ['Nachtlicht', 'LED Nachtlicht'])],
  [/pflanzenlampe|pflanzenleuchte|grow/,            [L + 'Pflanzenlampe']],
  [/lavalampe/,                                     [L + 'Lavalampe']],
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
  [/kissen/,                                        [W + 'Kissen > Dekokissen', W + 'Kissen > Fellkissen@0.7', ...all(W + 'Kissenbezüge > ', ['Kissenhülle@0.8', 'Kissenbezug@0.8'])]],
  [/decke|plaid|überwurf/,                          all(W + 'Wohndecken > ', ['Wohndecke', 'Plaid', 'Wolldecke', 'Überwurf'])],
  [/gardinenstange|vorhangstange/,                  all(W + 'Gardinenstangen > ', ['Gardinenstange', 'Vorhangschiene', 'Gardinenschiene'])],
  [/plissee/,                                       [W + 'Plissees > Plissee']],
  [/raffrollo/,                                     [W + 'Raffrollos > Raffrollo']],
  [/rollo/,                                         all(W + 'Rollos > ', ['Rollo', 'Doppelrollo', 'Verdunklungsrollo', 'Seitenzugrollo']).concat([W + 'Plissees > Plissee@0.6'])],
  [/scheibengardine|bistrogardine|caféhaus|cafehaus/, [W + 'Gardinen > Scheibengardine']],
  [/schiebegardine|flächenvorhang/,                 [W + 'Gardinen > Schiebegardine']],
  [/türvorhang/,                                    [W + 'Gardinen > Türvorhang']],
  [/sofahusse|sofabezug|sofaüberwurf|couchbezug|sofaschoner|(sofa|couch).*(husse|bezug)|(husse|bezug).*(sofa|couch|sitzer)/, [W + 'Hussen > Sofahusse', W + 'Hussen > Sofabezug', 'Haushalt > Sesselschoner > Sofaschoner@0.7']],
  [/sesselhusse|sesselschoner/,                     [W + 'Hussen > Sesselhusse', 'Haushalt > Sesselschoner > Sesselschoner']],
  [/husse|stuhlbezug/,                              [W + 'Hussen > Stuhlhusse', W + 'Hussen > Stuhlbezug']],
  [/verdunkelung/,                                  [W + 'Gardinen > Verdunkelungsvorhang']],
  [/vorhang|vorhänge|gardine|schlaufenschal|ösenschal/, all(W + 'Gardinen > ', ['Vorhang', 'Gardine', 'Verdunkelungsvorhang@0.6'])],

  // ── Seating
  [/sitzsack|beanbag/,                              [M + 'Sitzsäcke > Sitzsack']],
  [/daybett|tagesbett/,                             [M + 'Daybetten > Daybett']],
  [/strandkorb/,                                    [M + 'Strandkörbe > Strandkorb']],
  [/gartenliege|sonnenliege|liegestuhl/,            [M + 'Gartenliegen > Gartenliege']],
  [/balkonset|bistroset|bistro-set|balkonmöbel/,    all(M + 'Sitzmöbel-Sets > ', ['Balkonset', 'Garten-Essgruppe@0.6'])],
  [/loungeset|lounge-set|gartenlounge|loungemöbel|outdoor.?lounge/, all(M + 'Sitzmöbel-Sets > ', ['Gartenlounge-Set', 'Loungeset'])],
  [/gartenstuhl|balkonstuhl|terrassenstuhl|bistrostuhl|klappstuhl|outdoor.?stuhl/, [M + 'Stühle > Gartenstuhl', M + 'Stühle > Klappstuhl']],
  [/gartentisch|balkontisch|terrassentisch|bistrotisch|klapptisch|balkonhängetisch|outdoor.?tisch/, all(M + 'Tische > ', ['Gartentisch', 'Balkonhängetisch', 'Klapptisch'])],
  [/gartenbank|balkonbank/,                         [M + 'Sitzbänke > Gartenbank']],
  [/essgruppe|tischgruppe/,                         [M + 'Sitzmöbel-Sets > Essgruppe']],
  [/gaming.?stuhl|gamingstuhl|gaming.?sessel/,      [M + 'Stühle > Gaming-Stuhl']],
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
  [/boxspring/,                                      [M + 'Komplettbetten > Boxspringbett', M + 'Komplettbetten > Boxbett']],
  [/etagenbett/,                                    [M + 'Etagenbetten > Etagenbett']],
  [/hochbett/,                                      [M + 'Hochbetten > Hochbett']],
  [/kinderbett/,                                    [M + 'Betten > Kinderbett']],
  [/polsterbett/,                                   [M + 'Betten > Polsterbett']],
  [/massivholzbett|holzbett/,                       all(M + 'Betten > ', ['Massivholzbett', 'Holzbett', 'Bettgestell@0.6'])],
  [/metallbett/,                                    [M + 'Betten > Metallbett']],
  [/himmelbett/,                                    [M + 'Betten > Himmelbett']],
  [/bettgestell|bettrahmen|bett\b|doppelbett/,      all(M + 'Betten > ', ['Bett', 'Bettgestell', 'Polsterbett', 'Massivholzbett', 'Holzbett', 'Metallbett', 'Stauraumbett@0.6']).concat([M + 'Komplettbetten > Boxspringbett@0.5'])],

  // ── Tables
  [/nachttisch|nachtkonsole|nachtschrank/,          [M + 'Tische > Nachttisch', M + 'Sideboards > Nachtkommode', M + 'Sideboards > Nachtkonsole', M + 'Schränke > Nachtschrank']],
  [/schminktisch|frisiertisch/,                     [M + 'Tische > Schminktisch']],
  [/schreibtisch|computertisch/,                    all(M + 'Tische > ', ['Schreibtisch', 'Computertisch', 'Laptoptisch@0.6', 'Eckschreibtisch@0.6'])],
  [/couchtisch|sofatisch|wohnzimmertisch/,          all(M + 'Tische > ', ['Couchtisch', 'Wohnzimmertisch'])],
  [/beistelltisch|satztisch|tabletttisch/,          all(M + 'Tische > ', ['Beistelltisch', 'Satztisch', 'Tabletttisch'])],
  [/konsole|konsolentisch|wandtisch/,               [M + 'Tische > Konsolentisch', M + 'Sideboards > Konsole']],
  [/bartisch|stehtisch/,                            all(M + 'Tische > ', ['Bartisch', 'Stehtisch'])],
  [/esstisch|küchentisch|esszimmertisch/,           all(M + 'Tische > ', ['Esstisch', 'Säulen-Esstisch', 'Baumkantentisch', 'Küchentisch@0.7'])],
  [/\btische?\b|(holz|glas|marmor|runder?|ovaler?)tisch/, all(M + 'Tische > ', ['Esstisch', 'Couchtisch@0.7', 'Beistelltisch@0.7'])],

  // ── Storage
  [/kleiderschrank/,                                all(M + 'Schränke > ', ['Kleiderschrank', 'Drehtürenschrank', 'Schwebetürenschrank'])],
  [/vitrine/,                                       all(M + 'Schränke > ', ['Vitrine', 'Standvitrine', 'Glasvitrine'])],
  [/highboard/,                                     [M + 'Sideboards > Highboard']],
  [/sideboard|anrichte/,                            [M + 'Sideboards > Sideboard', M + 'Sideboards > Lowboard@0.5']],
  [/lowboard|tv-board|tv-bank|tv-schrank|fernsehschrank/, all(M + 'Sideboards > ', ['Lowboard', 'TV-Board', 'TV-Bank']).concat([M + 'Schränke > TV-Schrank'])],
  [/schuhkipper|schuhschrank/,                      [M + 'Sideboards > Schuhkipper', M + 'Schränke > Schuhschrank']],
  [/kommode/,                                       all(M + 'Sideboards > ', ['Kommode', 'Schubkastenkommode', 'Kombikommode', 'Hochkommode'])],
  [/schuhregal/,                                    [M + 'Regale > Schuhregal', M + 'Sitzbänke > Schuhbank@0.6']],
  [/weinregal/,                                     [M + 'Regale > Weinregal']],
  [/eckregal/,                                      [M + 'Regale > Eckregal']],
  [/kinderregal/,                                   [M + 'Regale > Kinderregal']],
  [/wohnwand|schrankwand|wohnzimmerwand/,           [M + 'Kastenmöbel-Sets > Wohnwand']],
  [/balkonsichtschutz|balkon.*sichtschutz|sichtschutz.*balkon|balkonbespannung/, ['Garten > Markisen > Balkonsichtschutz']],
  [/paravent|trennwand|raumtrenner/,          ['Haushalt > Stellwände > Paravent']],
  [/rollwagen|servierwagen|küchenwagen|barwagen/,   [M + 'Rollwagen > Rollwagen', M + 'Rollwagen > Küchenwagen']],
  [/wandboard/,                                     [M + 'Regale > Wandboard']],
  [/wandregal|hängeregal/,                          all(M + 'Regale > ', ['Wandregal', 'Hängeregal', 'Wandboard@0.7'])],
  [/leiterregal/,                                   [M + 'Regale > Leiterregal']],
  [/raumteiler/,                                    all(M + 'Regale > ', ['Raumteiler', 'Raumteilerregal']).concat(['Haushalt > Stellwände > Paravent@0.6'])],
  [/bücherregal|standregal|regal/,                  all(M + 'Regale > ', ['Bücherregal', 'Standregal', 'Regal', 'Wandregal@0.6'])],
  [/garderobenständer|kleiderständer|kleiderstange/, all(M + 'Garderobenständer > ', ['Garderobenständer', 'Kleiderständer'])],
  [/garderobenpaneel|wandgarderobe|garderobenleiste|hakenleiste|garderobe(?!nständer|nschrank)/, [M + 'Garderobenpaneele > Wandgarderobe', M + 'Garderobenpaneele > Garderobenpaneel', M + 'Garderobenpaneele > Garderobe', M + 'Garderobenhalter > Garderobenleiste', M + 'Kastenmöbel-Sets > Garderoben-Set@0.7']],
  [/garderobenschrank/,                             [M + 'Schränke > Garderobenschrank']],
  [/wäschekorb|wäschesammler/,                      [W + 'Wäschesammler']],
  [/kaminholz/,                                     [D + 'Aufbewahrungsboxen > Kaminholzkorb']],
  [/korb|körbe/,                                    all(D + 'Aufbewahrungsboxen > ', ['Aufbewahrungskorb', 'Flechtkorb', 'Dekokorb', 'Allzweckkorb'])],
  [/aufbewahrungsbox|box(en)?\b|organizer/,         all(D + 'Aufbewahrungsboxen > ', ['Aufbewahrungsbox', 'Allzweckkiste@0.7', 'Organizer@0.6'])],
  [/truhe|kiste/,                                   [D + 'Aufbewahrungsboxen > Holzkiste', M + 'Sitzbänke > Sitztruhe@0.6']],

  // ── Decor
  [/ganzkörperspiegel|standspiegel/,               ['Haushalt > Spiegel > Ganzkörperspiegel']],
  [/spiegel/,                                       ['Haushalt > Spiegel > Wandspiegel', 'Haushalt > Spiegel > Spiegel', 'Haushalt > Spiegel > Ganzkörperspiegel@0.6']],
  [/wanduhr|\buhr\b/,                               all(D + 'Wanduhren > ', ['Wanduhr', 'Uhr'])],
  [/bilderrahmen/,                                  all(D + 'Bilderrahmen > ', ['Bilderrahmen', 'Bilderrahmen-Set'])],
  [/wandtattoo|wandsticker|wandaufkleber/,         [D + 'Wandtattoos > Wandtattoo', D + 'Wandtattoos > Wandsticker']],
  [/poster|kunstdruck|print\b/,                    [B + 'Poster', B + 'Kunstdruck', B + 'Bild mit Rahmen@0.7']],
  [/leinwand/,                                      [B + 'Leinwandbild', B + 'Mehrteilige Bilder@0.6']],
  [/gemälde|ölbild|acrylbild/,                      [B + 'Gemälde', B + 'Leinwandbild@0.7']],
  [/wandbild|\bbild\b|bilder\b|wandkunst|kunstwerk|bilderset/, [B + 'Wandbild', B + 'Leinwandbild', B + 'Bild mit Rahmen', B + 'Poster@0.7', B + 'Mehrteilige Bilder@0.6', B + 'Glasbild@0.5']],
  [/\btafel\b|kreidetafel|magnettafel|pinnwand|memoboard/,                      [D + 'Tafeln > Magnettafel']],
  [/tischfeuer|tischkamin/,                 [D + 'Dekokamine > Tischfeuer']],
  [/geschirr|tafelservice|kombiservice/,            ['Haushalt > Geschirr-Sets > Geschirr-Set', 'Haushalt > Geschirr-Sets > Kombiservice', 'Haushalt > Geschirr-Sets > Tafelservice']],
  [/obstschale|obstkorb/,                           ['Haushalt > Schüsseln > Obstschale']],
  [/vase/,                                          all(D + 'Vasen > ', ['Dekovase', 'Tischvase', 'Bodenvase'])],
  [/tablett/,                                       [D + 'Tabletts > Tablett', D + 'Dekoschalen > Dekotablett']],
  [/schale|schüssel/,                               all(D + 'Dekoschalen > ', ['Dekoschale', 'Dekoteller'])],
  [/kerzenständer|kerzenhalter|kerzenleuchter/,     all(D + 'Kerzenhalter > ', ['Kerzenständer', 'Kerzenhalter', 'Kerzenleuchter', 'Wandkerzenhalter@0.6'])],
  [/teelicht/,                                      [D + 'Kerzenhalter > Teelichthalter']],
  [/duftkerze/,                                     [D + 'Kerzen > Duftkerze']],
  [/kerze/,                                         all(D + 'Kerzen > ', ['Stumpenkerze', 'Spitzkerze', 'Duftkerze@0.7', 'LED-Kerze@0.5'])],
  [/skulptur|figur/,                                all(D + 'Dekofiguren > ', ['Skulptur', 'Dekofigur', 'Dekoobjekt@0.7'])],
  [/wanddeko|wandobjekt/,                           [D + 'Wanddekoobjekte > Wanddekoobjekt']],
];

// Things OTTO's Wohnen feed doesn't have as the piece itself (floors,
// wallpaper, cables, real plants): no match, the search link is used.
const OTTO_EXCLUDE = /^(?!.*(kunst|künstlich)).*(\bkamin(?!holz)|kaminofen|vinyl|laminat|parkett|fliese|tapete|wandfarbe|teppichboden|bodenbelag|sockelleiste|glühbirne|leuchtmittel|smart plug|steckdose|kabel|monstera|ficus|(oliven|zitronen|geld|gummi|feigen|lorbeer|bananen|zier|zimmer)baum|palme|kaktus|eukalyptus|bonsai)/;

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
  const path = String(r.merchant_product_category_path || '').replace(/^(Einrichten & Wohnen|Garten & Heimwerken) > /, '');
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
  index.exclude = OTTO_EXCLUDE;
  index.extra = new Map(shaped.map(r => [r.aw_deep_link, { brand: r.brand, rating: r.rating }]));
  return index;
}

// OTTO titles are long ("Bruno Banani Gardine Tilo, 1 Stück, Kräuselband, …"):
// the display title is the part before the first comma.
// Real plants: OTTO's Wohnen feed sells pots and artificial plants, not
// the plant itself. "Monstera im Keramiktopf" must not become a pot.
const PLANT_RE = /monstera|ficus|feige|olivenbaum|palme|kaktus|bonsai|farn|eukalyptus|strelitzie|calathea|pothos|efeu|zimmerpflanze|grünpflanze|pflanze\b|pflanzen\b/;

// Style and filler words: a title rarely says "skandinavisch" or "natur"
const LOOSE_RE = /^(natur|natürlich|form|groß|große|großer|klein|kleine|mid|century|modern|moderne|skandinavisch|nordisch|boho|vintage|retro|industrial|minimalistisch|schlicht|elegant|gemütlich|hell|dunkel|warm|style|stil|look|optik|design|wohnzimmer|schlafzimmer|flur|esszimmer|küche|innen)$/;

function search(index, q, limit = 4) {
  const text = String(q.text || '').toLowerCase();
  const first = text.split(/[\s,]+/)[0] || '';
  if (PLANT_RE.test(first) && !/kunst|künstlich|trocken/.test(text)) return { matched: false, sure: false, results: [] };
  // OTTO titles are long and say what the piece is: the describing words of
  // the query ("botanisch", "Wiener Geflecht", "Sonne") must be in there
  // too, at least half of them, for the match to count as THE piece.
  const Q = parseQuery(q, OTTO_RULES, OTTO_EXCLUDE);
  const stem = w => (w.length > 5 ? w.slice(0, -1) : w);
  const rest = Q.rest.filter(w => !/\d/.test(w) && !LOOSE_RE.test(w) && !OTTO_RULES.some(([re]) => re.test(w)));
  const restOk = title => {
    const t = String(title).toLowerCase();
    const hits = rest.filter(w => t.includes(stem(w))).length;
    return hits * 2 >= rest.length;
  };
  const r = hSearch(index, q, Math.max(limit, 12));
  const bonus = p => {
    const x = index.extra.get(p.link) || {};
    let b = 0;
    if (GOOD_BRANDS.test(x.brand || '')) b += 12;
    if (x.rating >= 4.5) b += 10; else if (x.rating >= 4) b += 5; else if (x.rating && x.rating < 3.5) b -= 15;
    if (p.price < 20) b -= 10;   // the cheapest marketplace items are rarely what a design shows
    return b;
  };
  for (const p of r.results || []) p.sure = !!p.sure && restOk(p.title);
  const ranked = (r.results || []).map(p => ({ p, s: (p.score || 0) + bonus(p) })).sort((a, b) => (b.p.sure - a.p.sure) || (b.s - a.s)).slice(0, limit).map(x => x.p);
  for (const p of ranked) {
    let t = String(p.title).split(/,\s/)[0];
    const dash = t.split(/ [–-] /)[0];
    if (dash.length >= 15) t = dash;   // "exxpo - sofa fashion 3-Sitzer" keeps the part after the brand
    p.title = t.slice(0, 90);
  }
  // OTTO's own picture, sharp and without Awin's letterbox; Awin's copy stays as fallback
  for (const p of ranked) {
    const id = (decodeURIComponent((String(p.image2 || p.image).match(/[?&]url=([^&]+)/) || [])[1] || '').match(/i\.otto\.de\/i\/otto\/([\w-]+)/) || [])[1];
    if (id) p.image = `https://i.otto.de/i/otto/${id}?w=600&h=600`;
  }
  return { ...r, sure: !!(ranked[0] && ranked[0].sure), results: ranked };
}

module.exports = { shapeRow, buildIndex, search, OTTO_RULES };
