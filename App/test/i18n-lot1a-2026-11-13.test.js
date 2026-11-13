'use strict';
// 🌐 Traduction, lot 1a : l'en-tête, les menus, l'accueil et le bas de page traduits à l'affichage (i18n/ui.json).
// En français, rien ne bouge ; un texte sans traduction reste en français.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ui = JSON.parse(read('i18n/ui.json'));
const names = JSON.parse(read('i18n/pokemon-names.json'));

function page(lang) {
  const ctx = {
    I18N_DATA: { texts: {}, names: { en: names.en, es: names.es }, ui: { en: ui.en, es: ui.es, patterns: ui.patterns } },
    POKEMON_LIST: [{ id: 785, name: 'Tokorico' }, { id: 131, name: 'Lokhlass' }, { id: 1000, name: 'Gromago' }],
    location: { search: '?lang=' + lang }, URLSearchParams, Intl,
    localStorage: { getItem: () => null, setItem: () => {} },
    window: { addEventListener: () => {} }, document: { readyState: 'loading', addEventListener: () => {}, documentElement: { lang: 'fr' } }
  };
  vm.createContext(ctx);
  vm.runInContext(read('src/script.00a.i18n.js') + '\n' + read('src/script.10zzzzr.i18n-dom.js'), ctx);
  return ctx;
}

test('les textes de l’accueil, avec nombres, Pokémon, jours et mois remis à leur place', () => {
  const en = page('en'), es = page('es');
  assert.equal(en.i18nTranslateText('Qui est le Pokémon du jour ?', 'en'), 'Who’s today’s Pokémon?');
  assert.equal(en.i18nTranslateText('⏳ Prochain Pokémon dans 0 h 55 min', 'en'), '⏳ Next Pokémon in 0 h 55 min');
  assert.equal(en.i18nTranslateText('JOUR #236 · vendredi 13 novembre', 'en'), 'DAY #236 · Friday, November 13');
  assert.equal(es.i18nTranslateText('JOUR #236 · vendredi 13 novembre', 'es'), 'DÍA #236 · viernes 13 de noviembre');
  assert.equal(en.i18nTranslateText('Réveiller Tokorico', 'en'), 'Wake up Tapu Koko');
  assert.equal(es.i18nTranslateText('Lokhlass !', 'es'), '¡Lapras!');
  assert.equal(en.i18nTranslateText('L’Œuf mystère a éclos : Marco l’a trouvé', 'en'), 'The Mystery Egg hatched: Marco found it');
  assert.equal(en.i18nTranslateText('La 1re partie du jour d’un jeu marqué « +1 Ball » rapporte une Ball. Encore 6 possibles aujourd’hui.', 'en'), 'Your first game of the day in a game marked “+1 Ball” earns a Ball. 6 more possible today.');
  assert.equal(en.i18nTranslateText('Un texte que personne n’a traduit', 'en'), null, 'reste en français');
});

test('le dictionnaire : mêmes jetons dans la traduction que dans le texte français', () => {
  for (const lang of ['en', 'es']) for (const [fr, tr] of Object.entries(ui[lang])) {
    const count = (s, re) => (s.match(re) || []).length;
    for (const re of [/%P/g, /%W/g, /%M/g]) assert.equal(count(tr, re), count(fr, re), lang + ' : ' + fr);
    // Les nombres : jamais plus que dans le texte français (une langue peut en sauter un : « 1re » → « first »).
    assert.ok(count(tr, /#|\{\d\}/g) <= count(fr, /#/g), lang + ' : ' + fr);
  }
});

test('en français, la page n’est jamais touchée', () => {
  const src = read('src/script.10zzzzr.i18n-dom.js');
  assert.match(src, /if \(lang === 'fr'\) \{ if \(i18nDom\.observer\)/, 'pas d’observateur en français');
  assert.match(src, /i18nDom\.touched\.forEach/, 'retour au français : les textes d’origine reviennent');
  assert.match(read('build.mjs'), /i18n\/ui\.json/);
  assert.match(read('src/script.00a.i18n.js'), /var I18N_AUTO_DETECT = false;/, 'langue du téléphone : après le lot 1b (Pokémon du jour)');
});

test('lot 1b : la recherche accepte les noms anglais et espagnols, seulement hors du français', () => {
  const core = read('src/script.01.core.js'), mini = read('src/script.03.minijeux.js'), deleg = read('src/script.07.delegation-party.js');
  assert.match(core, /normAlt: typeof pokemonName === "function"/);
  assert.match(mini, /const alt = typeof getLang === "function" && getLang\(\) !== "fr";/, 'en français, les suggestions ne changent pas');
  assert.match(deleg, /getLang\(\) !== "fr" \? activeAltNameMap\.get\(key\)/, 'un nom anglais tapé est reconnu (Charizard → Dracaufeu)');
  const dom = read('src/script.10zzzzr.i18n-dom.js');
  for (const root of ['#screen-game', '#screen-higher-lower', '#screen-odd-one-out', '#screen-poke-connections', '#screen-all-modes', '#overlay-modal']) assert.ok(dom.includes("'" + root + "'"), root);
  const en = page('en');
  assert.equal(en.i18nTranslateText('✓ Type 1 : Électrik', 'en'), '✓ Type 1: Electric');
  assert.equal(en.i18nTranslateText('Forêt', 'en'), 'Forest');
});
