'use strict';
// 🌐 Accueils /en et /es (14/11/2026) : un accueil par langue pour Google, la même page pour le joueur.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const homeI18n = require('../lib/home-i18n');

const SOURCE = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

test("l'accueil français annonce ses versions anglaise et espagnole", () => {
  assert.ok(SOURCE.includes('<link rel="canonical" href="https://pokdle.fr/">'));
  for (const tag of homeI18n.hreflangTags().split('\n').map(s => s.trim())) assert.ok(SOURCE.includes(tag), tag);
});

test('/en et /es : titre, description, adresse canonique et H1 dans la langue, plus rien du français dans l’en-tête', () => {
  for (const lang of homeI18n.LANGS) {
    const html = homeI18n.homeHtml(SOURCE, lang), T = homeI18n.TEXTS[lang];
    assert.ok(html.includes('<html lang="' + lang + '">'));
    assert.ok(html.includes('<title>' + T.title + '</title>'));
    assert.ok(html.includes('<link rel="canonical" href="https://pokdle.fr/' + lang + '">'));
    assert.ok(html.includes('property="og:url" content="https://pokdle.fr/' + lang + '"'));
    assert.ok(html.includes('hreflang="x-default" href="https://pokdle.fr/"'));
    assert.ok(html.includes('>' + T.h1 + '</h1>'));
    for (const key of Object.keys(homeI18n.FR)) assert.ok(!html.includes(homeI18n.FR[key]), lang + ' garde le français : ' + key);
    const data = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)[1]);
    assert.equal(data['@graph'][1].inLanguage, lang);
    assert.equal(data['@graph'][1].url, 'https://pokdle.fr/' + lang);
    assert.equal(html.length - SOURCE.length < 600, true, 'seuls quelques textes changent');
  }
  assert.equal(homeI18n.homeHtml(SOURCE, 'fr'), SOURCE);
});

test('la page construite (dist) se traduit aussi', { skip: !fs.existsSync(path.join(__dirname, '../dist/index.html')) }, () => {
  const dist = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  for (const lang of homeI18n.LANGS) assert.ok(homeI18n.homeHtml(dist, lang).includes('<title>' + homeI18n.TEXTS[lang].title + '</title>'));
});

test('le sitemap liste /en et /es, et les pages Google mènent à ces accueils', () => {
  const seo = require('../lib/seo-render');
  const routes = {};
  seo.mountSeoPages({ get(p, h) { for (const one of [].concat(p)) routes[one] = h; } });
  let xml = '';
  routes['/sitemap.xml']({}, { set() {}, type() { return this; }, send(body) { xml = body; } });
  assert.ok(xml.includes('<loc>https://pokdle.fr/en</loc>'));
  assert.ok(xml.includes('<loc>https://pokdle.fr/es</loc>'));
  const render = fs.readFileSync(path.join(__dirname, '../lib/seo-render.js'), 'utf8');
  assert.doesNotMatch(render, /\?lang=/);
});

function page(pathname, search, saved) {
  const store = new Map(saved ? [['pokdle.lang', saved]] : []);
  const replaced = [];
  const ctx = {
    location: { pathname, search: search || '', hash: '' }, URLSearchParams, Intl,
    history: { state: null, replaceState(_s, _t, url) { replaced.push(url); } },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/script.00a.i18n.js'), 'utf8'), ctx);
  ctx.replaced = replaced; ctx.store = store;
  return ctx;
}

test("l'adresse /en ou /es choisit la langue ; ?lang= passe avant ; les autres adresses ne changent rien", () => {
  assert.equal(page('/en').getLang(), 'en');
  assert.equal(page('/es', '', 'fr').getLang(), 'es');
  assert.equal(page('/en', '?lang=es').getLang(), 'es');
  assert.equal(page('/').getLang(), 'fr');
  assert.equal(page('/emulateur').getLang(), 'fr');
  assert.equal(page('/en').store.get('pokdle.lang'), 'en');
});

test("un lien partagé depuis /en part de « / » ; choisir une langue dans 🌐 met l'adresse à jour", () => {
  assert.equal(page('/en').i18nSharePath(), '/');
  assert.equal(page('/emulateur').i18nSharePath(), '/emulateur');
  const p = page('/en', '?party=ABCDE');
  p.i18nSyncHomePath('fr');
  assert.deepEqual(p.replaced, ['/?party=ABCDE']);
  const q = page('/');
  q.i18nSyncHomePath('es');
  assert.deepEqual(q.replaced, ['/es']);
  const r = page('/emulateur');
  r.i18nSyncHomePath('en');
  assert.deepEqual(r.replaced, []);
});
