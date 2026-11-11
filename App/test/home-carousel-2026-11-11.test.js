'use strict';
// Grande tuile des jeux sur l'accueil (11/11/2026, maquette validée : « go mais faut que les tuiles soient animées »).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const js = fs.readFileSync(path.join(__dirname, '../src/script.10zzg.home-carousel.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../home.css'), 'utf8');

test('the home games become one big tile that plays its animated scene when it arrives', () => {
  assert.match(js, /hmPlay\(tiles\[best\]\)/, 'the scene of the game in view plays');
  assert.match(js, /HC_EVERY = 5000/, 'five seconds per game');
  assert.match(js, /hcReduced\(\)/, '« Animations réduites » stops the automatic scrolling');
  assert.match(js, /document\.hidden/, 'nothing moves in a hidden tab');
  assert.match(js, /pointerdown/, 'a finger stops the automatic scrolling');
  assert.match(js, /hc\.paused = true/, 'the mouse over the tile pauses it');
  assert.match(js, /aria-label="Jeu suivant"/);
  assert.match(css, /@media \(hover:hover\) and \(pointer:fine\)\{[\s\S]*?\.hc-arrow\{display:grid\}/, 'arrows only on screens with a mouse');
  assert.match(css, /scroll-snap-type:x mandatory/, 'native swipe on phones');
});

test('the tiles stay the same buttons in the same grid (filters and QA unchanged)', () => {
  assert.match(js, /getElementById\('home-games-grid'\)/);
  assert.doesNotMatch(js, /\.remove\(\)/, 'no game tile is removed');
  assert.doesNotMatch(js, /[\u{1F300}-\u{1FAFF}]/u, 'no emoji');
});
