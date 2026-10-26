'use strict';
// 26/10, iPhone: the Pokédex detail ran past the right edge of the screen on every Pokémon.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the phone detail column never grows wider than the screen', () => {
  const css = read('pokedex.css');
  // A 1fr column grows to its widest content (« #3 Méga-Florizarre » in the Précédent / Suivant row).
  assert.match(css, /@media \(max-width: 760px\) \{\n  #screen-pokedex \.pokedex-layout \{ grid-template-columns: minmax\(0, 1fr\) !important; \}\n  #screen-pokedex \.pokedex-detail \{ grid-template-columns: minmax\(0, 1fr\) !important; \}\n\}/);
  assert.doesNotMatch(css, /#screen-pokedex \.pokedex-detail \{ grid-template-columns: 1fr !important; \}/);
});

test('a long neighbour name is cut with « … » instead of widening the page', () => {
  assert.match(read('src/script.04.jeu-pokedex.js'), /const neighbourHtml = \(target\) => `<small>#\$\{getPokemonDexNumber\(target\)\}<\/small> <span class="pokedex-detail-nav-name">\$\{escapeHtml\(target\.name\)\}<\/span>`;/);
  const css = read('pokedex.css');
  assert.match(css, /#screen-pokedex \.pokedex-detail-nav-name \{ min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \}/);
  assert.match(css, /#pokdle-app\.design-refresh #screen-pokedex \.pokedex-detail-nav-btn \{ flex: 1 1 0; gap: 4px; padding: 9px 10px !important; font-size: \.8125rem !important; \}/);
});

test('on phones, a three-stage family goes top to bottom instead of off the screen', () => {
  const css = read('pokedex.css');
  const phone = css.slice(css.indexOf('#screen-pokedex .pokedex-evo-targets { grid-template-columns: minmax(0, 1fr); }'));
  assert.match(phone, /#screen-pokedex \.pokedex-evo-chain:has\(> \.pokedex-evo-card:nth-child\(5\)\) \{ flex-direction: column; align-items: stretch; gap: 4px; \}/);
  assert.match(phone, /\.pokedex-evo-chain:has\(> \.pokedex-evo-card:nth-child\(5\)\) > \.pokedex-evo-step > i \{ order: -1; transform: rotate\(90deg\); \}/);
});
