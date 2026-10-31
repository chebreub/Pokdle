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
    '/jeux/jeux-pokemon-entre-amis',
    '/jeux/dessine-le-pokemon',
    '/jeux',
  ]);
  const knownSlugs = new Set(GAMES.map(game => game.slug));
  for (const href of hrefs.filter(href => href !== '/jeux')) {
    assert.ok(knownSlugs.has(href.slice('/jeux/'.length)), href + ' has a real landing page');
  }
  assert.match(html, /data-action="openAllModesScreen"/, 'existing game navigation buttons are preserved');
});

test('home describes the daily Pokémon break in its visible H1', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const header = html.match(/<header>[\s\S]*?<\/header>/)?.[0];
  assert.ok(header, 'the global header exists');
  assert.match(header, /<span class="logo-wordmark">Pokédle<\/span>/, 'wordmark is not a document heading');
  assert.doesNotMatch(header, /<h1\b/, 'global logo must not add an H1 to every screen');
  assert.match(header, /id="logo-home"/, 'return-home navigation remains available');

  const hero = html.match(/<section class="pk-hero" id="daily-hero">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(hero, 'daily hero exists on the home screen');
  assert.match(hero, /<h1 class="pk-hero-title">Le Pokémon du jour à deviner, et plein de mini-jeux Pokémon<\/h1>/);
  assert.equal((hero.match(/<h1\b/g) || []).length, 1, 'daily hero has a single H1');
  assert.match(hero, /Ta pause Pokémon du jour/);
  assert.match(hero, /défis entre amis\. Gratuit, sans pub, sans compte\./);
  assert.match(hero, /data-action="startDailyGame"/, 'original daily game action is preserved');
  assert.ok(hero.indexOf('id="daily-hero-cta"') < hero.indexOf('class="pk-hero-chips"'), 'the main button comes before the day\'s progress');

  for (const label of [
    'Choisis ton mini-jeu Pokémon',
    'Œuf mystère de la semaine',
    'Mini-jeux Pokémon en solo',
    'Joue avec tes amis, en direct',
  ]) assert.ok(html.includes(label), label + ' is explicit for new visitors');
});

test('no script rewrites the home presentation, the day\'s state has its own line', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /<p class="pk-hero-note hidden" id="daily-hero-note"><\/p>/);
  const src = path.join(__dirname, '../src');
  for (const file of fs.readdirSync(src).filter(name => name.endsWith('.js'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(src, file), 'utf8'), /pk-hero-sub/, file + ' must leave the presentation alone');
  }
});

test('blocks added to the home by scripts never add a second H1', () => {
  const src = path.join(__dirname, '../src');
  const adventure = fs.readFileSync(path.join(src, 'script.10f.home-adventure.js'), 'utf8');
  assert.doesNotMatch(adventure, /<h1\b/, 'the adventure block sits under the home H1');
  const league = fs.readFileSync(path.join(src, 'script.10i.weekly-league.js'), 'utf8');
  assert.match(league, /<h2><span class="sr-only">Épreuve de Ligue de la semaine : <\/span>/, 'the League card heading says what it is');
});

test('the delivered page has one H1, no skipped level, no empty or repeated heading', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map(([, level, inner]) => ({ level: Number(level), text: inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() }));
  assert.equal(headings.filter(h => h.level === 1).length, 1, 'a single H1');
  headings.forEach((h, i) => {
    assert.ok(h.text, 'heading ' + i + ' (H' + h.level + ') is empty');
    if (i) assert.ok(h.level <= headings[i - 1].level + 1, 'H' + headings[i - 1].level + ' → H' + h.level + ' before « ' + h.text + ' »');
  });
  const seen = new Set();
  for (const { text } of headings) { assert.ok(!seen.has(text.toLowerCase()), 'repeated heading « ' + text + ' »'); seen.add(text.toLowerCase()); }
});

test('every form field of the page has a name for screen readers', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const forIds = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m => m[1]));
  const wrapped = new Set();
  for (const [label] of html.matchAll(/<label\b[\s\S]*?<\/label>/g)) for (const [, id] of label.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g)) wrapped.add(id);
  for (const [tag, id] of [...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)].map(([t]) => [t, (t.match(/\bid="([^"]+)"/) || [])[1]])) {
    if (/type="(?:hidden|submit|button|reset|image)"/.test(tag)) continue;
    assert.ok(/aria-label(?:ledby)?="/.test(tag) || forIds.has(id) || wrapped.has(id), 'unlabelled field: ' + tag.slice(0, 80));
  }
});

test('the built page loads one local stylesheet and a long-cached Socket.IO client', () => {
  const built = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  const sheets = [...built.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(sheets.map(href => href.replace(/\?v=\w+$/, '')), ['dist/app.min.css']);
  assert.match(built, /<script src="dist\/socket\.io\.min\.js\?v=\w+" defer><\/script>/);
  assert.doesNotMatch(built, /\/socket\.io\/socket\.io\.js/);
  // Same cascade: the bundle is the source page's stylesheets, in their order.
  const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const files = [...source.matchAll(/<link rel="stylesheet" href="dist\/([\w.-]+\.min\.css)">/g)].map(m => m[1]);
  assert.equal(files.length, 22);
  assert.equal(fs.readFileSync(path.join(__dirname, '../dist/app.min.css'), 'utf8'), files.map(file => fs.readFileSync(path.join(__dirname, '../dist', file), 'utf8')).join('\n'));
});

test('regulars see the daily first: recent games come right after the daily hero', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const hero = html.indexOf('id="daily-hero"'), back = html.indexOf('id="home-return"'), discovery = html.indexOf('class="home-discovery"');
  assert.ok(hero > 0 && hero < back && back < discovery, 'order: daily hero, recent games, game catalogue');
});

test('the sitemap lists only canonical pages, never /emulateur (the home page under another path)', () => {
  const xml = sitemapXml();
  assert.doesNotMatch(xml, /\/emulateur/);
  assert.match(xml, /<loc>https:\/\/pokdle\.fr\/<\/loc>/);
  assert.doesNotMatch(xml, /onrender/);
});

test('the home page, robots.txt and share texts point to pokdle.fr, never to the old address', () => {
  const files = ['index.html', 'robots.txt', ...fs.readdirSync(path.join(__dirname, '../src')).map(file => 'src/' + file)];
  for (const file of files.filter(file => file !== 'src/script.00.transfert.js')) {
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), /pokdle\.onrender\.com/, file);
  }
  const home = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(home.includes('<link rel="canonical" href="https://pokdle.fr/">'));
  assert.match(fs.readFileSync(path.join(__dirname, '../robots.txt'), 'utf8'), /^Sitemap: https:\/\/pokdle\.fr\/sitemap\.xml$/m);
});

test('every image of the game pages has a description, and the illustration names its Pokémon', () => {
  const { renderHubPage } = require('../lib/seo-render');
  for (const html of [renderHubPage(), ...GAMES.map(renderGamePage)]) {
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) assert.match(tag, /\balt="[^"]+"/, 'Bing reports an image without alt: ' + tag);
  }
  const hero = renderGamePage(GAMES.find(g => g.slug === 'qui-est-ce-pokemon')).match(/<section class="hero">[\s\S]*?<\/section>/)[0];
  assert.match(hero, /alt="Pikachu, illustration du jeu Qui est-ce \? Pokémon"/);
  assert.match(renderHubPage(), /official-artwork\/149\.png" alt="Dracolosse"/);
});

test('search engines find a real icon file: /favicon.ico (16, 32 and 48 px) and /favicon.svg', async () => {
  const pages = {
    'index.html': fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8'),
    'confidentialite.html': fs.readFileSync(path.join(__dirname, '../confidentialite.html'), 'utf8'),
    '/jeux/team-builder': renderGamePage(GAMES.find(g => g.slug === 'team-builder')),
  };
  for (const [name, html] of Object.entries(pages)) {
    assert.ok(html.includes('<link rel="icon" href="/favicon.ico" sizes="48x48">'), name + ' links /favicon.ico');
    assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">'), name + ' links /favicon.svg');
    assert.doesNotMatch(html, /rel="icon"[^>]*href="data:/, name + ': search engines ignore a data: icon');
  }
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(server, /app\.get\("\/favicon\.ico", \(_req, res\) => res\.sendFile\(path\.join\(__dirname, "favicon\.ico"\)/);
  assert.match(server, /app\.get\("\/favicon\.svg", \(_req, res\) => res\.sendFile\(path\.join\(__dirname, "favicon\.svg"\)/);

  const ico = fs.readFileSync(path.join(__dirname, '../favicon.ico'));
  assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1], 'an ICO header');
  const sharp = require('sharp');
  const sizes = [];
  for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const at = 6 + 16 * i, length = ico.readUInt32LE(at + 8), offset = ico.readUInt32LE(at + 12);
    const { width, height, format } = await sharp(ico.subarray(offset, offset + length)).metadata();
    assert.deepEqual([width, height, format], [ico[at], ico[at + 1], 'png']);
    sizes.push(width);
  }
  assert.deepEqual(sizes, [16, 32, 48], 'run node tools/favicon.js after changing favicon.svg');
  assert.match(fs.readFileSync(path.join(__dirname, '../favicon.svg'), 'utf8'), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">/);
});

test('every game page shows its own link preview: a 1200×630 image that exists and stays light', async () => {
  const sharp = require('sharp');
  for (const game of GAMES) {
    const image = renderGamePage(game).match(/<meta property="og:image" content="([^"]+)">/)[1];
    if (game.ogImage) { assert.equal(image, SITE + game.ogImage); continue; }
    assert.equal(image, SITE + '/img/og/' + game.slug + '.jpg', game.slug);
    const file = path.join(__dirname, '../img/og', game.slug + '.jpg');
    assert.ok(fs.existsSync(file), game.slug + ' has no preview image: run node tools/og-game-images.js');
    assert.ok(fs.statSync(file).size < 120 * 1024, game.slug + ' preview is too heavy');
    const { width, height, format } = await sharp(file).metadata();
    assert.deepEqual([width, height, format], [1200, 630, 'jpeg'], game.slug);
  }
});
