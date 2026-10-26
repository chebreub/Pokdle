'use strict';
// 26/10, from a video on iPhone: the guess list jumped with every letter, and the Zoom had become too easy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test('typing on a phone no longer scrolls the page with every letter', () => {
  const shell = read('src/script.10j.game-shell.js');
  // Our own scroll fired visualViewport « scroll », which called the fit again.
  assert.doesNotMatch(shell, /visualViewport\?\.addEventListener\("scroll", scheduleMobileGuessSearch\)/);
  assert.match(shell, /visualViewport\?\.addEventListener\("resize", scheduleMobileGuessSearch\)/);
  // The page moves only for the field itself (hidden, or no room for three suggestions), not for the list.
  const fit = between(shell, 'function fitMobileGuessSearch()', 'function scheduleMobileGuessSearch()');
  assert.match(fit, /const needed = field\.bottom \+ 8 \+ rowHeight \* 3;/);
  assert.doesNotMatch(fit, /bar\.getBoundingClientRect\(\)/);
  // While the keyboard is open, the list keeps one height and its place, so the buttons stay put.
  const css = read('game-shell.css');
  assert.match(css, /#pokdle-app\.design-refresh\.mobile-keyboard-open #screen-game\[data-shell="focused"\] #guess-ac \{height:var\(--guess-list-height,282px\)!important;\}/);
  assert.match(css, /\.mobile-keyboard-open #screen-game\[data-shell="focused"\] \.search-bar:focus-within #guess-ac\.hidden \{display:block!important;visibility:hidden;pointer-events:none;\}/);
});

function zoomApi() {
  const src = read('src/script.02.statclash.js');
  return Function(between(src, 'function zoomFocusFromAlpha(', 'function zoomFocus(') + '; return zoomDetailFromAlpha;')();
}

test('the Zoom starts on a detail of the outline, not on the middle of the body', () => {
  const detail = zoomApi();
  const side = 20;
  // A filled square from 4 to 15: its middle is all body, its outline mixes body and background.
  const alpha = new Uint8Array(side * side);
  for (let y = 4; y < 16; y += 1) for (let x = 4; x < 16; x += 1) alpha[y * side + x] = 255;
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    const r = i / 40;
    const focus = detail(alpha, side, () => r);
    const [x, y] = [Math.floor(focus.x * side), Math.floor(focus.y * side)];
    assert.ok(alpha[y * side + x] > 128, 'on the Pokémon');
    assert.ok(x <= 5 || x >= 14 || y <= 5 || y >= 14, 'near its outline: ' + [x, y]);
    seen.add(x + ',' + y);
  }
  assert.ok(seen.size > 10, 'a different detail from game to game');
  // A sprite that cannot be read falls back to the middle.
  assert.deepEqual(detail(new Uint8Array(side * side), side, () => 0), { x: 0.5, y: 0.5 });
});

test('the first three clues are in black and white, zoomed five times; the Zoom is now « Moyen »', () => {
  const src = read('src/script.02.statclash.js');
  const panel = between(src, 'function updateSilhouettePanel(', 'const ZOOM_GREY_CLUES');
  assert.match(src, /const ZOOM_GREY_CLUES = 3;/);
  assert.match(panel, /img\.style\.filter = attempts < ZOOM_GREY_CLUES \? "grayscale\(1\)" : "none";/);
  assert.match(panel, /const startScale = 5;\n\s+const step = 0\.7;/);
  // The view drifts back to the whole Pokémon: at the widest clue (scale 1) it is centred.
  assert.match(panel, /const drift = \(scale - 1\) \/ \(startScale - 1\);/);
  assert.match(panel, /img\.style\.visibility = "hidden";/, 'nothing shows before the detail is chosen');
  assert.match(panel, /if \(reveal\) \{\n\s+img\.style\.transform = "translate\(0px, 0px\) scale\(1\)";\n\s+img\.style\.filter = "none";/);
  assert.match(read('src/script.08.catalog.js'), /startSilhouetteGame:'medium'/);
  assert.match(read('lib/seo-games.js'), /'Observe le détail affiché, zoomé cinq fois et en noir et blanc\.',/);
});
