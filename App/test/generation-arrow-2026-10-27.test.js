'use strict';
// The generation gets its own arrow (27/10): ↑ the Pokémon to find is more recent, ↓ older.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

function rowBuilder() {
  const src = read('src/script.04.jeu-pokedex.js');
  const code = between(src, 'function comparisonTypeHtml(', 'function addRow(') + between(src, 'function cls(', 'function triggerWinCelebration(').replace(/^const DIRECTION_WORDS/m, 'var DIRECTION_WORDS');
  const env = {
    escapeHtml: (s) => String(s), getSpriteUrl: () => 'sprite', getPokemonSpriteId: (p) => p.id, getPokemonSprite: () => 'sprite',
    pokemonTypeColor: () => '#000', formatColorLabel: (c) => c, comparisonStatusHtml: () => '',
  };
  return Function(...Object.keys(env), code + '; return buildComparisonRowHtml;')(...Object.values(env));
}
const pokemon = (id, gen) => ({ id, gen, name: 'P' + id, type1: 'Feu', type2: null, habitat: 'Plaine', color: 'Rouge', stage: 1, height: 1, weight: 10, isAltForm: false });
const cell = (label) => (html) => html.match(new RegExp(`<td data-label="${label}"[\\s\\S]*?<\\/td>`))[0];
const genCell = cell('Génération');

test('the generation cell points to the right generation, like height and weight', () => {
  const build = rowBuilder();
  const cmp = (generation) => ({ generation, altForm: 'ok', type1: 'ok', type2: 'ok', habitat: 'ok', color: 'ok', stage: 'ok', height: 'ok', weight: 'ok' });
  // Unlimited game: the secret is in the browser.
  assert.match(genCell(build(pokemon(1, 3), cmp('wrong'), pokemon(2, 5))), /Gen 3\s*<span class="dir-pill dir-up"[^>]*><b aria-hidden="true">↑<\/b> <span class="dir-more">plus <\/span>récente<\/span>/);
  assert.match(genCell(build(pokemon(1, 7), cmp('wrong'), pokemon(2, 5))), /Gen 7\s*<span class="dir-pill dir-down"[^>]*><b aria-hidden="true">↓<\/b> <span class="dir-more">plus <\/span>ancienne<\/span>/);
  assert.doesNotMatch(genCell(build(pokemon(1, 5), cmp('ok'), pokemon(2, 5))), /dir-pill/);
  // Pokémon du jour and Party Rooms: the server sends the direction, never the secret.
  assert.match(genCell(build(pokemon(1, 2), cmp('wrong'), null, { generationDirection: '↑', heightDirection: '', weightDirection: '' })), /dir-up/);
  assert.doesNotMatch(genCell(build(pokemon(1, 2), cmp('wrong'), null, { heightDirection: '', weightDirection: '' })), /dir-pill/, 'an older answer without the field shows no arrow');
});

test('height and weight say it in words too, for screen readers as well', () => {
  const build = rowBuilder();
  const cmp = { generation: 'ok', altForm: 'ok', type1: 'ok', type2: 'ok', habitat: 'ok', color: 'ok', stage: 'ok', height: 'close', weight: 'wrong' };
  const html = build(pokemon(1, 5), cmp, null, { generationDirection: '', heightDirection: '↑', weightDirection: '↓' });
  assert.match(cell('Hauteur')(html), /aria-label="Le Pokémon recherché est plus grand"><b aria-hidden="true">↑<\/b> <span class="dir-more">plus <\/span>grand</);
  assert.match(cell('Poids')(html), /aria-label="Le Pokémon recherché est plus léger"><b aria-hidden="true">↓<\/b> <span class="dir-more">plus <\/span>léger</);
  const party = read('src/script.07.delegation-party.js');
  assert.match(party, /directionPillHtml\("gen", entry\.genArrow \|\| ""\)/, 'the 1 vs 1 table has the generation pill');
  assert.doesNotMatch(party, /"arrow-up" : "arrow-down"/);
});

test('the server sends the generation direction for the daily game and Party Rooms', () => {
  assert.match(read('lib/daily-game.js'), /generationDirection:direction\(p\.gen,secret\.gen\)/);
  assert.match(read('server.js'), /genArrow: arrowFor\(guess\.gen, secret\.gen\),/);
  const client = read('src/script.04.jeu-pokedex.js');
  assert.match(client, /generationDirection:row\.generationDirection/);
  assert.match(client, /var directions = \{ generationDirection: entry\.genArrow \|\| "",/);
});

test('the notebook narrows the generation down from the arrows', () => {
  const src = read('src/script.10j.game-shell.js');
  const facts = Function(between(src, 'function shellObservedFacts(', 'function prepareGameShell(') + '; return shellObservedFacts;')();
  const row = (gen, generation, generationDirection) => ({ pokemon: pokemon(gen, gen), cmp: { generation }, generationDirection });
  assert.deepEqual(facts([row(3, 'wrong', '↑')]), ['Génération : 4 ou plus récente']);
  assert.deepEqual(facts([row(7, 'wrong', '↓')]), ['Génération : 6 ou plus ancienne']);
  assert.deepEqual(facts([row(3, 'wrong', '↑'), row(7, 'wrong', '↓'), row(2, 'wrong', '↑')]), ['Génération : entre 4 et 6']);
  assert.deepEqual(facts([row(4, 'wrong', '↑'), row(6, 'wrong', '↓')]), ['Génération : 5']);
  assert.deepEqual(facts([row(3, 'wrong', '↑'), row(5, 'ok', '')]), ['Génération : 5']);
  assert.match(src, /les flèches concernent la génération, la taille et le poids\./);
});
