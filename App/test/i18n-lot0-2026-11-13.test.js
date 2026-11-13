'use strict';
// 🌐 Traduction, lot 0 : la fonction t(), les fichiers de langue et les noms officiels des Pokémon.
// Rien ne change en français : la langue par défaut reste le français et la langue du téléphone n'est pas encore lue.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const texts = Object.fromEntries(['fr', 'en', 'es'].map((l) => [l, JSON.parse(read('i18n/' + l + '.json'))]));
const names = JSON.parse(read('i18n/pokemon-names.json'));

function page({ search = '', saved = null, navLang = 'en-US' } = {}) {
  const store = new Map(saved ? [['pokdle.lang', saved]] : []);
  const ctx = {
    I18N_DATA: { texts, names: { en: names.en, es: names.es } },
    location: { search }, URLSearchParams,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    navigator: { language: navLang, languages: [navLang] }, Intl, document: { documentElement: { lang: 'fr' } }
  };
  vm.createContext(ctx);
  vm.runInContext(read('src/script.00a.i18n.js'), ctx);
  return ctx;
}

test('les 3 fichiers de langue ont exactement les mêmes clés', () => {
  const keys = Object.keys(texts.fr).sort();
  assert.ok(keys.length > 0);
  for (const l of ['en', 'es']) assert.deepEqual(Object.keys(texts[l]).sort(), keys, l);
});

test('le français reste la langue par défaut, même sur un téléphone en anglais (lot 0)', () => {
  const p = page({ navLang: 'en-US' });
  assert.equal(p.getLang(), 'fr');
  assert.equal(p.t('lang.name'), 'Français');
});

test('?lang= choisit la langue et la garde ; une langue inconnue est ignorée', () => {
  const p = page({ search: '?lang=es' });
  assert.equal(p.getLang(), 'es');
  assert.equal(p.t('lang.title'), 'Idioma');
  assert.equal(page({ saved: 'en' }).t('lang.title'), 'Language');
  assert.equal(page({ search: '?lang=de' }).getLang(), 'fr');
});

test('t() : secours en français puis la clé, variables et pluriel', () => {
  const p = page({ search: '?lang=en' });
  p.I18N_DATA.texts.fr['test.only.fr'] = 'Seulement en français';
  assert.equal(p.t('test.only.fr'), 'Seulement en français');
  assert.equal(p.t('cle.inconnue'), 'cle.inconnue');
  p.I18N_DATA.texts.en['test.vars'] = '{n} tries for {name}';
  assert.equal(p.t('test.vars', { n: 3, name: 'Pikachu' }), '3 tries for Pikachu');
  p.I18N_DATA.texts.en['test.plural'] = { one: '{count} try', other: '{count} tries' };
  assert.equal(p.t('test.plural', { count: 1 }), '1 try');
  assert.equal(p.t('test.plural', { count: 4 }), '4 tries');
  assert.equal(p.setLang('de'), false);
  assert.equal(p.setLang('fr'), true);
  assert.equal(p.document.documentElement.lang, 'fr');
});

test('noms officiels : les 1025 en anglais, l’espagnol seulement quand il diffère', () => {
  assert.equal(Object.keys(names.en).length, 1025);
  assert.ok(Object.keys(names.es).length < 60);
  const p = page({ search: '?lang=en' });
  assert.equal(p.pokemonName({ id: 1000, name: 'Gromago' }), 'Gholdengo');
  assert.equal(p.pokemonName({ id: 122, name: 'M. Mime' }), 'Mr. Mime');
  assert.equal(p.pokemonName({ id: 21003, name: "Raichu d'Alola", isAltForm: true }), "Raichu d'Alola", 'formes : nom français pour l’instant');
  assert.equal(p.pokemonName({ id: 1000, name: 'Gromago' }, 'fr'), 'Gromago');
  assert.equal(page({ search: '?lang=es' }).pokemonName({ id: 25, name: 'Pikachu' }), 'Pikachu');
});

test('le build met les textes et les noms en tête du script, avant tous les morceaux', () => {
  const build = read('build.mjs');
  assert.match(build, /var I18N_DATA = /);
  assert.match(build, /i18n\/pokemon-names\.json/);
  assert.match(read('src/script.00a.i18n.js'), /var I18N_AUTO_DETECT = false;/, 'langue du téléphone : seulement au lot 1');
});
