// 📕 Pokédex v2 (8/11/2026, « go poke ») : objets du jeu, badges dessinés, anneaux ; aucune donnée ne change.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10xzzr.dex-v2.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'game-shell.css'), 'utf8');

test('game items instead of emojis: Poké Radar, Poké Ball, Shiny Charm, Unown « ? »', () => {
  for (const item of ["dexItem('poke-radar')", "dexItem('poke-ball')", "dexItem('shiny-charm')"]) assert.ok(SRC.includes(item), item);
  assert.match(SRC, /201-question\.png/);
  assert.match(SRC, /sprites@master\/sprites\/items\//, 'official PokéAPI item sprites, like the Balls of the site');
});

test('medals are our own drawn badges on a track, the old text stays for screen readers', () => {
  assert.match(SRC, /pas une copie des vrais badges/);
  assert.match(SRC, /<path d="M20 2 33 9\.5v15L20 38 7 24\.5v-15z"/);
  assert.match(CSS, /\.dex-head \.dex-medals-text\{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset\(50%\)\}/);
});

test('nothing is computed differently: stats, tiers and zones come from the existing helpers', () => {
  assert.match(SRC, /albumStats\(gen\)/);
  assert.match(SRC, /albumTierReached\(t, s\)/);
  assert.match(SRC, /wildZonePools\[z\.key\]/, '« où le trouver » only for a Pokémon of a grass zone');
  assert.doesNotMatch(SRC, /fetch\(|saveProfile|playerProfile\.\w+\s*=/);
});

test('the shiny tab keeps one star (the item replaces the written ✨)', () => {
  assert.match(SRC, /n\.textContent\.replace\(\/✨\\s\*\/g, ''\)/);
});
