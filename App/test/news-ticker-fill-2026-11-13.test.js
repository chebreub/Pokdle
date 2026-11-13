'use strict';
// Bandeau d'actualités : avec peu de messages, la série doit couvrir toute la largeur (plus de vide à droite),
// à la même vitesse, et seules les vraies copies restent atteignables au clavier.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10t.news-ticker.js'), 'utf8');

test('la série se répète jusqu’à couvrir le bandeau, durée proportionnelle', () => {
  assert.match(src, /Math\.ceil\(wide \/ one\)/);
  assert.match(src, /Math\.max\(28, count \* 9\) \* repeat/);
  assert.match(src, /aria-hidden="true" '\)\.repeat\(repeat - 1\)/, 'les copies en plus sont cachées aux lecteurs d’écran');
  assert.match(src, /addEventListener\("resize"/, 'recalculé quand la fenêtre change de taille');
});
