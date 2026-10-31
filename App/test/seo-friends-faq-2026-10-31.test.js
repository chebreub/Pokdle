'use strict';
// Step 2 of the plan, Google (31/10/2026): tips and frequent questions on the game pages, the
// « jeux Pokémon entre amis » page brought up to date, and a page for Dessine-le !.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GAMES } = require('../lib/seo-games');
const { renderGamePage, sitemapXml } = require('../lib/seo-render');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const page = (slug) => renderGamePage(GAMES.find((game) => game.slug === slug));
const graph = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])['@graph'];

test('tips and frequent questions show on the page and in its structured data', () => {
  const html = page('pokemon-du-jour');
  assert.match(html, /<h2>Astuces<\/h2>\n<div class="panel"><ul><li>Commence par un Pokémon à deux types/);
  assert.match(html, /<h2>Questions fréquentes<\/h2>\n<div class="panel faq"><h3>À quelle heure change le Pokémon du jour \?<\/h3><p>À minuit, heure de Paris\./);
  const faq = graph(html).find((node) => node['@type'] === 'FAQPage');
  const game = GAMES.find((g) => g.slug === 'pokemon-du-jour');
  assert.equal(faq.mainEntity.length, game.faq.length);
  assert.deepEqual(faq.mainEntity[0], { '@type': 'Question', name: game.faq[0][0], acceptedAnswer: { '@type': 'Answer', text: game.faq[0][1] } });
  assert.match(html, /chance d’être shiny : 1 sur 40, 1 sur 30 dès 7 jours de série, 1 sur 20 dès 30 jours/, 'the shiny odds of lib/daily-game.js');
  // A page without questions keeps its two blocks of structured data, and no empty section.
  const plain = page('ordre-pokedex');
  assert.doesNotMatch(plain, /Questions fréquentes/);
  assert.equal(graph(plain).length, 2);
  for (const game of GAMES) assert.ok(game.tips?.length >= 2, game.slug + ' has tips');
  for (const game of GAMES) for (const [question, answer] of game.faq || []) assert.ok(question.endsWith('?') && answer.length > 10, game.slug);
});

test('the friends page names the twelve games of the Party Room, Dessine-le ! and the chat', () => {
  const game = GAMES.find((g) => g.slug === 'jeux-pokemon-entre-amis');
  const listed = game.facts[0].replace(/^Les jeux : /, '').replace(/\.$/, '').split(/, | et /);
  const tiles = [...read('index.html').matchAll(/class="party-mode-btn party-mode-tile"[^>]*>.*?<b>([^<]+)<\/b>/g)].map((m) => m[1]);
  assert.equal(tiles.length, 12);
  assert.equal(listed.length, tiles.length);
  for (const name of tiles) assert.ok(game.facts[0].includes(name), name + ' is named on the page');
  assert.match(game.short, /douze mini-jeux/);
  assert.match(game.lead, /chat/);
  assert.ok(game.related.includes('dessine-le-pokemon'));
});

test('Dessine-le ! has its page, states the real rules and opens the room with the game chosen', () => {
  const game = GAMES.find((g) => g.slug === 'dessine-le-pokemon');
  assert.equal(game.group, 'friends');
  const rules = read('lib/party-dessin.js');
  assert.match(rules, /const CHOOSE_MS = 10000;/);
  assert.match(rules, /const DRAW_MS = 80000;/);
  assert.match(rules, /const TYPE_HINT_MS = 30000;/);
  assert.match(rules, /const GEN_HINT_MS = 50000;/);
  assert.match(rules, /easy: \{ label: "FACILE", points: 100 \},\n\s+medium: \{ label: "MOYEN", points: 150 \},\n\s+hard: \{ label: "DIFFICILE", points: 200 \}/);
  assert.match(rules, /const COLORS = 16;/);
  assert.match(game.steps.join(' '), /10 secondes[\s\S]*80 secondes/);
  assert.match(game.facts.join(' '), /100 points, un moyen 150, un difficile 200[\s\S]*20 points de plus[\s\S]*type à 30 secondes, la génération à 50 secondes[\s\S]*16 couleurs/);
  assert.match(read('src/script.10z.landing-links.js'), /'dessine-le-pokemon': \['openPartyRoomWithGame', \['dessin'\]\],/);
  assert.ok(fs.existsSync(path.join(__dirname, '../img/og/dessine-le-pokemon.jpg')));
  assert.match(sitemapXml(), /<loc>https:\/\/pokdle\.fr\/jeux\/dessine-le-pokemon<\/loc>/);
  assert.match(page('dessine-le-pokemon'), /href="\/\?jeu=dessine-le-pokemon"/);
});
