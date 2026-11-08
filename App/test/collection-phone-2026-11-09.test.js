'use strict';
// 📱 Pokédex › Ma collection plus courte sur iPhone (9/11/2026) : versions courtes ajoutées, rien d'origine retiré.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('three short counters: « Attrapés » is what you still have, with the total captured underneath', () => {
  const js = read('src/script.10zzb.collection-phone.js');
  assert.match(js, /renderPokedexCollectionHub = function/);
  assert.match(js, /'Vus<\/small>/);
  assert.match(js, /'Attrapés<\/small><b>' \+ \(loaded \? totals\.obtained : '…'\)/);
  assert.match(js, /capturé' \+ \(totals\.caught > 1 \? 's' : ''\) \+ ' en tout/);
  // The original four bars and their labels stay (PC, DEX-01 tests).
  const col = read('src/script.10xze.collection-caught.js');
  assert.match(col, /Déjà capturés/);
  assert.match(col, /Possédés actuellement/);
});

test('short filter labels and region chips on phone only; the original controls stay clickable', () => {
  const js = read('src/script.10zzb.collection-phone.js');
  assert.match(js, /obtained: 'Attrapés'/);
  assert.match(js, /data-action="selectPokedexCollectionRegion"/);
  assert.match(js, /window\.colmAllGens = colmAllGens/);
  const css = read('game-shell.css');
  assert.match(css, /#screen-pokedex \.colm-stats,#screen-pokedex \.colm-gens,#screen-pokedex \.colm-short\{display:none\}/, 'nothing new on PC');
  assert.match(css, /\.pokedex-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  // The showcase still says « Plus possédé » (read by screen readers and the QA), only visually hidden.
  assert.match(css, /\.pokedex-showcase-slot:not\(\.is-empty\) > small\{display:block!important;position:absolute!important;width:1px!important/);
  assert.doesNotMatch(css, /\.pokedex-progress-details\{display:none/, 'the region details stay reachable');
});
