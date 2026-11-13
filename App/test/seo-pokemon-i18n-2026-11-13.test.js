'use strict';
// 🌐 Lot 6a : les 1025 pages Pokémon en anglais (/en/pokemon/…) et en espagnol (/es/pokemon/…), avec hreflang.
const test = require('node:test'), assert = require('node:assert/strict');
const render = require('../lib/seo-render');
const I = require('../lib/seo-pokemon-i18n');

test('Dracaufeu en anglais et Gromago en espagnol : noms et types officiels, mêmes faits', () => {
  const en = render.renderPokemonPageI18n(6, 'en');
  assert.match(en, /<html lang="en">/);
  assert.match(en, /<h1>Charizard<\/h1>/);
  assert.match(en, /Charizard is a Fire\/Flying-type Pokémon from Generation 1 \(Kanto region\)/);
  assert.match(en, /especially weak to Rock moves \(4× damage\)/);
  assert.match(en, /<link rel="canonical" href="https:\/\/pokdle\.fr\/en\/pokemon\/charizard">/);
  const es = render.renderPokemonPageI18n(1000, 'es');
  assert.match(es, /<html lang="es">/);
  assert.match(es, /Gholdengo es un Pokémon de tipo Acero y Fantasma de la 9\.ª generación/);
  assert.match(es, /Mide 1,2 m y pesa 30 kg/);
  assert.doesNotMatch(en + es, /Dracaufeu<\/h1>|Gromago<\/h1>/);
});

test('hreflang dans les 3 langues, sur la page française aussi', () => {
  const fr = render.renderPokemonPage(6);
  for (const html of [fr, render.renderPokemonPageI18n(6, 'en'), render.renderPokemonPageI18n(6, 'es')]) {
    assert.match(html, /hreflang="fr" href="https:\/\/pokdle\.fr\/pokemon\/dracaufeu"/);
    assert.match(html, /hreflang="en" href="https:\/\/pokdle\.fr\/en\/pokemon\/charizard"/);
    assert.match(html, /hreflang="es" href="https:\/\/pokdle\.fr\/es\/pokemon\/charizard"/);
    assert.match(html, /hreflang="x-default" href="https:\/\/pokdle\.fr\/pokemon\/dracaufeu"/);
  }
  assert.match(fr, /<html lang="fr">/);
});

test('une adresse par Pokémon et par langue, toutes dans le sitemap', () => {
  for (const lang of I.LANGS) assert.equal(new Set(I.SLUGS[lang].values()).size, 1025, lang);
  const locs = (render.sitemapXml().match(/<loc>/g) || []).length;
  assert.ok(locs >= 1065 + 2 * 1026, 'sitemap : ' + locs);
});

test('routes : nom de la langue, ancien nom français ou numéro → adresse canonique', async () => {
  const routes = [];
  const app = { get: (paths, fn) => routes.push([[].concat(paths), fn]) };
  render.mountSeoPages(app);
  const call = (path) => new Promise((resolve) => {
    const [, fn] = routes.find(([ps]) => ps.some((p) => p.includes(':slug') ? path.startsWith(p.split(':slug')[0]) && path.split('/').length === p.split('/').length : p === path));
    const slug = path.split('/').pop();
    const res = { set() {}, type() { return res; }, send: (b) => resolve({ body: b }), redirect: (code, to) => resolve({ code, to }) };
    fn({ params: { slug }, path, query: {} }, res, () => resolve({ next: true }));
  });
  assert.deepEqual(await call('/en/pokemon/dracaufeu'), { code: 301, to: '/en/pokemon/charizard' });
  assert.deepEqual(await call('/es/pokemon/6'), { code: 301, to: '/es/pokemon/charizard' });
  assert.match((await call('/en/pokemon/charizard')).body, /<h1>Charizard<\/h1>/);
  assert.match((await call('/en/pokemon')).body, /All 1025 Pokémon/);
});
