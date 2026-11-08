'use strict';
// 🎬 « Tous les jeux » et Party Room en mouvement (9/11/2026) : mêmes scènes que l'accueil, rien de plus lourd.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the home scenes are reused on « Tous les jeux » and the Party Room thumbnails', () => {
  const js = read('src/script.10zzd.motion-all-modes.js');
  assert.match(js, /openAllModesScreen = function/);
  assert.match(js, /pl3Paint = function/);
  assert.match(js, /hmDecorateTile\(card\)/);
  assert.match(js, /hmPartySceneHtml\(kind\)/);
  // One scene at a time, only on screen, never with reduced motion or a hidden tab.
  assert.match(js, /document\.hidden \|\| \(typeof hmReduced === 'function' && hmReduced\(\)\)/);
  const css = read('home.css');
  assert.match(css, /#screen-all-modes\.hm-on \.hm-scene\{position:absolute/);
  assert.match(css, /#party-lobby\.hm-on \.hm-who\{/);
  assert.match(css, /\.reduce-motion :is\(#screen-all-modes,#party-lobby\)\.hm-on \.mo2-idle \*/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{:is\(#screen-all-modes,#party-lobby\)\.hm-on \.mo2-idle \*/);
});
