'use strict';
// Lot 1 (4/11/2026) : pas de faux « doublon » à la 1re capture, plus de « 6 rencontres », Balls achetées par 5 ou 10.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the « Gotcha ! » line counts captures, not Pokémon seen while guessing', () => {
  const src = read('src/script.10xz.wild-grass.js');
  const line = new Function(src.match(/function wildCatchLine[\s\S]*?\n}\n/)[0] + 'return wildCatchLine;')();
  assert.match(line({ firstCatch: true, shiny: false }), /^1re capture/);
  assert.match(line({ firstCatch: true, shiny: true }), /shiny/);
  assert.match(line({ firstCatch: false, firstShiny: true, shiny: true }), /1er shiny/);
  assert.match(line({ firstCatch: false, firstShiny: false, shiny: false }), /doublon/);
  assert.doesNotMatch(line({ firstCatch: true, shiny: false }), /doublon/);
  assert.doesNotMatch(src, /outcome\.isNew/, 'the seen album no longer decides the text');
});

test('no « 6 rencontres » left on the home card or in the reminders', () => {
  assert.doesNotMatch(read('src/script.10xy.poke-balls.js'), /Balls et 6 rencontres/);
  assert.doesNotMatch(read('lib/push-reminders.js'), /6 rencontres/);
});

test('the shop sends the chosen quantity and its total price', () => {
  const src = read('src/script.10xzh.shop.js');
  assert.match(src, /const SHOP_QTYS = \[1, 5, 10\]/);
  assert.match(src, /\{ item, qty, expectedPrice: price \}/);
  assert.match(src, /\* \(shopQty\[item\] \|\| 1\)/);
  const { SHOP_PRICES } = require('../lib/poke-balls');
  assert.equal(SHOP_PRICES.great * 10, 1200, '10 Super Balls cost 1 200 ₽');
});
