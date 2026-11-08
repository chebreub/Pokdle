// 🏁 Écran de fin plus court (8/11/2026, « go fin »).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const SRC = read('src/script.10xzz.result-compact.js');
const CSS = read('game-feel.css');
const RC_CSS = CSS.slice(CSS.indexOf('/* 🏁 Écran de fin plus court'));

test('the Pokémon du jour keeps its own result screen', () => {
  assert.match(SRC, /var RC_KEEP_MODES = \{ daily: true \};/);
  assert.match(SRC, /if \(RC_KEEP_MODES\[box\.dataset\.resultMode\] \|\| !p\)/);
});

test('nothing is removed: counters, new entry, grade details and progress fold under « Mes stats et la fiche »', () => {
  assert.match(SRC, /\['shell-result-stats', 'win-new-entry', 'win-gamefeel-summary', 'win-ceremony-progress'\]/);
  assert.match(SRC, /<summary>Mes stats et la fiche<\/summary>/);
  assert.doesNotMatch(SRC, /\.remove\(\)[^;]*(shell-result-stats|win-ceremony-progress|win-new-entry)/);
  assert.doesNotMatch(SRC, /recordMatchHistory|saveDailyResult|registerWin|fetch\(/, 'only the layout changes');
});

test('the observer cannot loop on its own changes', () => {
  assert.match(SRC, /if \(!box\.classList\.contains\('rc-on'\)\) box\.classList\.add\('rc-on'\)/);
  assert.match(SRC, /if \(rcQueued\) return;/);
  assert.match(SRC, /attributeFilter: \['class', 'data-result-mode'\]/);
});

test('phones keep the 3 secondary actions as round icon buttons with their names', () => {
  assert.match(RC_CSS, /\.win-btns>button:not\(:first-child\):has\(\.btn-ico\)\{flex:0 0 46px;width:46px!important;padding:0!important;border-radius:50%!important;font-size:0!important/);
  assert.doesNotMatch(RC_CSS, /#btn-result-catalog\{display:none|\.win-btns\{display:none/);
});
