'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the free Pixelisé starts with the very same pixel ladder as the daily Défi', () => {
  const daily = JSON.parse(read('lib/daily-challenge.js').match(/side=(\[[\d,]+\])\[attempt\]/)[1]);
  const free = JSON.parse(read('src/script.02.statclash.js').match(/const PIXEL_SIDES = (\[[\d, ]+\]);/)[1]);
  assert.deepEqual(free.slice(0, daily.length), daily);
  assert.ok(free.length > daily.length, 'the free mode keeps one sharper step before the picture');
});

test('Description shows French Pokédex entries only, and skips species without any', () => {
  const source = read('src/script.07.delegation-party.js');
  const body = source.slice(source.indexOf('function pickPokedexFlavorText'), source.indexOf('function buildDescriptionFallbackHint'));
  assert.ok(!/"en"/.test(body), 'no English fallback');
  const pick = Function(body + '; return pickPokedexFlavorText;')();
  assert.equal(pick({ flavor_text_entries: [{ language: { name: 'en' }, flavor_text: 'Only English.' }] }, 'X'), null);
  assert.equal(pick({ flavor_text_entries: [{ language: { name: 'fr' }, flavor_text: 'Bulbizarre dort au soleil.' }] }, 'Bulbizarre'), 'ce Pokémon dort au soleil.');
  assert.match(source, /const DESCRIPTION_LAST_FRENCH_SPECIES = 898;/);
});
