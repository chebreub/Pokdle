'use strict';
// Description Pokédex (31/10/2026): French Pokédex entries stop at Gen 8, so the mystery is drawn there,
// but every Pokémon of the chosen generations can be typed (Kayan could not enter a Gen 9 answer).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the mystery has a French entry, the answers cover every chosen generation', () => {
  const src = read('src/script.07.delegation-party.js');
  const start = src.slice(src.indexOf('function startDescriptionMode()'), src.indexOf('function openOddOneOutMode()'));
  assert.match(start, /const pool = selected\.filter\(\(pokemon\) => \(getPokemonSpeciesId\(pokemon\) \|\| 0\) <= DESCRIPTION_LAST_FRENCH_SPECIES\);/);
  assert.match(start, /const secret = pickRandomPokemonFromPool\(pool\) \|\| pool\[0\];/);
  assert.match(start, /startGameWithSecret\(secret, selected\);/, 'the guess list is every Pokémon of the chosen generations');
  assert.match(src, /const DESCRIPTION_LAST_FRENCH_SPECIES = 898;/);
});

test('players are told the mystery comes from generations 1 to 8 when Gen 9 is chosen', () => {
  assert.match(read('index.html'), /<p id="description-gen-note" class="description-gen-note hidden">Les descriptions du Pokédex en français s’arrêtent à la 8<sup>e<\/sup> génération : le Pokémon mystère vient des générations 1 à 8\.<\/p>/);
  assert.match(read('src/script.07.delegation-party.js'), /getElementById\("description-gen-note"\)\?\.classList\.toggle\("hidden", !\(selectedGens instanceof Set && \[\.\.\.selectedGens\]\.some\(\(gen\) => Number\(gen\) > 8\)\)\);/);
});
