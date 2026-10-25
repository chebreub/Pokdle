'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { GAMES } = require('../lib/seo-games');
const { SITE, renderAboutPage, renderGamePage, sitemapXml, mountSeoPages } = require('../lib/seo-render');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const jsonLd = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);

test('the About page says what Pokédle is, who makes it and how to reach them', () => {
  const html = renderAboutPage();
  const title = html.match(/<title>(.*?)<\/title>/)[1];
  const description = html.match(/<meta name="description" content="(.*?)">/)[1];
  assert.ok(title.length <= 62, title);
  assert.ok(description.length >= 90 && description.length <= 160, description.length + ' characters');
  assert.ok(html.includes('<link rel="canonical" href="' + SITE + '/a-propos">'));
  // Assistants check for a real page, not a stub: well over 500 characters of text.
  const text = html.match(/<main>([\s\S]*)<\/main>/)[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(text.length > 1500, text.length + ' characters of text');
  for (const game of GAMES) assert.ok(html.includes('<a href="/jeux/' + game.slug + '">'), game.slug);
  for (const words of ['gratuits et sans publicité', 'sans compte', 'projet de fan', 'n’est pas affilié à Nintendo']) assert.ok(text.includes(words), words);
  assert.match(html, /<h2 id="contact">Contact<\/h2>/);
  assert.ok(html.includes('<a href="/?avis">Donne ton avis</a>'));
  // The same address as the privacy page; no postal address or phone number for a fan project.
  assert.ok(html.includes('<a href="mailto:chebreub@gmail.com">'));
  assert.ok(read('confidentialite.html').includes('chebreub@gmail.com'));
  assert.doesNotMatch(text, /\b\d{5}\b|(?:\+33|0[1-9])(?:[ .]?\d{2}){4}/);
  assert.ok(!/<script(?! type="application\/ld\+json")/.test(html), 'no executable script: the strict CSP stays happy');
  const graph = jsonLd(html)['@graph'];
  assert.equal(graph[0]['@type'], 'AboutPage');
  assert.equal(graph[0].mainEntity['@id'], SITE + '/#jeu');
});

test('the home page describes the game for assistants: a free web game in French', () => {
  const graph = jsonLd(read('index.html'))['@graph'];
  assert.equal(graph[0]['@type'], 'WebSite');
  const game = graph[1];
  assert.deepEqual(game['@type'], ['WebApplication', 'VideoGame']);
  assert.equal(game['@id'], SITE + '/#jeu');
  assert.equal(game.inLanguage, 'fr');
  assert.equal(game.isAccessibleForFree, true);
  assert.deepEqual(game.offers, { '@type': 'Offer', price: '0', priceCurrency: 'EUR' });
  assert.equal(game.subjectOf.url, SITE + '/a-propos');
});

test('/a-propos is served and listed; the English addresses lead to the French pages', async () => {
  assert.ok(sitemapXml().includes('<loc>' + SITE + '/a-propos</loc>'));
  const app = express();
  mountSeoPages(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const about = await fetch(base + '/a-propos');
    assert.equal(about.status, 200);
    assert.match(about.headers.get('content-type'), /html/);
    for (const [from, to] of [['/about', '/a-propos'], ['/contact', '/a-propos#contact'], ['/privacy', '/confidentialite']]) {
      const res = await fetch(base + from, { redirect: 'manual' });
      assert.equal(res.status, 301, from);
      assert.equal(res.headers.get('location'), to, from);
    }
  } finally {
    server.close();
  }
});

test('every footer links to the About page', () => {
  assert.match(read('index.html'), /<a href="\/jeux">Tous les jeux Pokémon<\/a> · <a href="\/a-propos">À propos<\/a> · <a href="\/confidentialite">Confidentialité<\/a>/);
  assert.match(renderGamePage(GAMES[0]), /<a href="\/a-propos">À propos<\/a>/);
  assert.match(read('confidentialite.html'), /<a href="\/a-propos">À propos de Pokédle<\/a>/);
});

test('/?avis opens « Donne ton avis » and leaves a clean address', () => {
  const opened = [];
  let address = null;
  const window = { openFeedbackModal: () => opened.push('avis'), startDailyGame: () => opened.push('daily') };
  const env = {
    window,
    location: { search: '?avis', pathname: '/', hash: '' },
    history: { state: null, replaceState: (_s, _t, url) => { address = url; } },
    document: { readyState: 'complete' },
    setTimeout: () => {},
  };
  const run = Function(...Object.keys(env), read('src/script.10z.landing-links.js') + '; return openLandingGame;')(...Object.values(env));
  run();
  assert.deepEqual(opened, ['avis']);
  assert.equal(address, '/');
  env.location.search = '?jeu=pokemon-du-jour';
  Function(...Object.keys(env), read('src/script.10z.landing-links.js') + '; return openLandingGame;')(...Object.values(env))();
  assert.deepEqual(opened, ['avis', 'daily'], 'game links still work');
});
