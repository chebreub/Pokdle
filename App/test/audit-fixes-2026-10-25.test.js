'use strict';
// The four bugs of the 25/10 audit: Quiz ranking, Zoom in black, Connections result, daily give-up.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test('a Quiz of 15 questions can rank 11 to 15 good answers', () => {
  const server = read('server.js');
  const count = Number(read('src/script.01.core.js').match(/const QUIZ_QUESTION_COUNT = (\d+);/)[1]);
  assert.equal(Number(server.match(/quiz: \{ direction: "desc", label: "Quiz", unit: "bonnes réponses", max: (\d+) \}/)[1]), count);
  const clamp = Function(between(server, 'function clampLeaderboardScore(', '\n}\n') + '\n}; return clampLeaderboardScore;')();
  for (const score of [10, 11, 15]) assert.equal(clamp(score, { max: count }), score);
  assert.equal(clamp(16, { max: count }), null);
});

test('the Zoom shows the Pokémon in colour, centred on its body', () => {
  const css = read('style.css');
  assert.doesNotMatch(between(css, '.zoom-sprite {', '}'), /brightness\(0\)/);
  const src = read('src/script.02.statclash.js');
  const focusOf = Function(between(src, 'function zoomFocusFromAlpha(', 'function zoomFocus(') + '; return zoomFocusFromAlpha;')();
  const side = 8;
  const sprite = (cells) => { const a = new Uint8Array(side * side); for (const [x, y] of cells) a[y * side + x] = 255; return a; };
  // A body on the left of the sprite: the view goes there, not to the empty middle.
  const left = focusOf(sprite([[0, 3], [1, 3], [0, 4], [1, 4]]), side);
  assert.ok(left.x < 0.25 && left.y > 0.4 && left.y < 0.6, JSON.stringify(left));
  // A ring: its centre is empty, so the view goes to the nearest visible pixel.
  const ring = [];
  for (let x = 1; x < 7; x += 1) ring.push([x, 1], [x, 6]);
  for (let y = 2; y < 6; y += 1) ring.push([1, y], [6, y]);
  const onRing = focusOf(sprite(ring), side);
  const cell = [Math.floor(onRing.x * side), Math.floor(onRing.y * side)];
  assert.ok(ring.some(([x, y]) => x === cell[0] && y === cell[1]), JSON.stringify(onRing));
  // Nothing readable: the middle, as before.
  assert.deepEqual(focusOf(new Uint8Array(side * side), side), { x: 0.5, y: 0.5 });
  assert.match(src, /img\.style\.transform = `translate\(\$\{\(-\(focus\.x - 0\.5\) \* scale \* 100\)\.toFixed\(2\)\}%/);
});

test('at the end of Connections, the result takes the puzzle’s place instead of covering the groups', () => {
  assert.match(read('src/script.03.minijeux.js'), /<div class="poke-connections-board\$\{phase === "won" \|\| phase === "lost" \? " is-over" : ""\}"/);
  const css = read('visual-refresh.css');
  assert.match(css, /\.poke-connections-board\.is-over \.poke-connections-grid \{\n\s*display:none;\n\s*\}/);
  assert.match(css, /#screen-poke-connections \.poke-connections-final \{\n\s*grid-column:1;\n\s*grid-row:1 \/ span 3;/);
});

test('giving up the Pokémon du jour asks first; only « Révéler la réponse » ends it', () => {
  const src = read('src/script.04.jeu-pokedex.js');
  const block = between(src, 'function surrenderGame()', '// Rendu partagé');
  const calls = [];
  const env = { gameMode: 'daily', gameOver: false, secretPokemon: null };
  const api = Function('env', 'calls', `
    let { gameMode, gameOver, secretPokemon } = env;
    const requestDailyObservedState = (...a) => calls.push(['request', ...a]);
    const ensureOverlay = (title, html) => calls.push(['ask', title, html]);
    const closeOverlayModal = () => calls.push(['close']);
    ${block}
    return { surrenderGame, abandonDailyGame, finish: () => { gameOver = true; } };`)(env, calls);
  api.surrenderGame();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'ask');
  assert.equal(calls[0][1], 'Abandonner le Pokémon du jour ?');
  assert.match(calls[0][2], /data-action="closeOverlayModal">Continuer à chercher<\/button>/);
  assert.match(calls[0][2], /data-action="abandonDailyGame">Révéler la réponse<\/button>/);
  api.abandonDailyGame();
  assert.deepEqual(calls.slice(1), [['close'], ['request', null, '', true]]);
  // Once the day is over, the button does nothing.
  api.finish();
  calls.length = 0;
  api.surrenderGame();
  api.abandonDailyGame();
  assert.deepEqual(calls, [['close']]);
});
