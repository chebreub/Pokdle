'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { GAMES, GROUPS } = require('../lib/seo-games');
const { SITE, renderGamePage, sitemapXml, mountSeoPages } = require('../lib/seo-render');

const client = fs.readFileSync(path.join(__dirname, '../src/script.10z.landing-links.js'), 'utf8');
const LANDING = Function(client.slice(client.indexOf('Object.freeze('), client.indexOf('});') + 2).replace(/^/, 'return '))();

test('every game page has a unique slug, title and description of search-friendly length', () => {
  for (const key of ['slug', 'title', 'description', 'h1']) assert.equal(new Set(GAMES.map(game => game[key])).size, GAMES.length, key + ' must be unique');
  for (const game of GAMES) {
    assert.match(game.slug, /^[a-z0-9-]+$/);
    assert.ok(GROUPS[game.group], game.slug + ' has a known group');
    assert.ok(game.title.length <= 62, game.slug + ' title is ' + game.title.length + ' characters');
    assert.ok(game.description.length >= 90 && game.description.length <= 160, game.slug + ' description is ' + game.description.length + ' characters');
    assert.ok(game.steps.length >= 3 && game.facts.length >= 2, game.slug + ' has enough text');
  }
});

test('the « Jouer » link of every page opens a game known to the app', () => {
  assert.deepEqual(Object.keys(LANDING).sort(), GAMES.map(game => game.slug).sort());
  for (const [slug, [opener]] of Object.entries(LANDING)) {
    assert.match(opener, /^(start|open)[A-Z]\w+$/, slug);
    assert.ok(fs.readdirSync(path.join(__dirname, '../src')).some(file => new RegExp('function ' + opener + '\\b').test(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'))), opener + ' exists');
  }
});

test('pages carry their own canonical URL, structured data and a play link', () => {
  const game = GAMES.find(g => g.slug === 'petit-bac-pokemon');
  const html = renderGamePage(game);
  assert.ok(html.includes('<link rel="canonical" href="' + SITE + '/jeux/petit-bac-pokemon">'));
  assert.ok(html.includes('<title>Petit Bac Pokémon : seul ou entre amis | Pokédle</title>'));
  assert.ok(html.includes('href="/?jeu=petit-bac-pokemon"'));
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(data['@graph'][1]['@type'], 'BreadcrumbList');
  assert.ok(!/<script(?! type="application\/ld\+json")/.test(html), 'no executable script: the strict CSP stays happy');
  const sitemap = sitemapXml();
  for (const g of GAMES) assert.ok(sitemap.includes('<loc>' + SITE + '/jeux/' + g.slug + '</loc>'));
  assert.ok(sitemap.includes('<loc>' + SITE + '/</loc>') && sitemap.includes('<loc>' + SITE + '/jeux</loc>'));
});

test('routes serve the hub, each page and the sitemap; an unknown game goes back to the hub', async () => {
  const app = express();
  mountSeoPages(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const hub = await fetch(base + '/jeux');
    assert.equal(hub.status, 200);
    assert.equal((await hub.text()).match(/href="\/jeux\/[a-z0-9-]+"/g).length, GAMES.length);
    const page = await fetch(base + '/jeux/Grille-Pokemon');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('cache-control'), /max-age=3600/);
    const unknown = await fetch(base + '/jeux/pas-un-jeu', { redirect: 'manual' });
    assert.equal(unknown.status, 301);
    assert.equal(unknown.headers.get('location'), '/jeux');
    const sitemap = await fetch(base + '/sitemap.xml');
    assert.match(sitemap.headers.get('content-type'), /xml/);
  } finally {
    server.close();
  }
});

test('home exposes static links to featured pages for crawlers without changing game buttons', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const match = html.match(/<nav class="home-seo-links"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(match, 'a visible game-discovery navigation is present in the HTML');
  const hrefs = [...match[1].matchAll(/<a href="([^"]+)"/g)].map(item => item[1]);
  assert.deepEqual(hrefs, [
    '/jeux/pokemon-du-jour',
    '/jeux/wordle-pokemon',
    '/jeux/grille-pokemon',
    '/jeux/quiz-pokemon',
    '/jeux/petit-bac-pokemon',
    '/jeux',
  ]);
  const knownSlugs = new Set(GAMES.map(game => game.slug));
  for (const href of hrefs.filter(href => href !== '/jeux')) {
    assert.ok(knownSlugs.has(href.slice('/jeux/'.length)), href + ' has a real landing page');
  }
  assert.match(html, /data-action="openAllModesScreen"/, 'existing game navigation buttons are preserved');
});
