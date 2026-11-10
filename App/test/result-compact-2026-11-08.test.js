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


test('a completed mini-game offers a capture only when Balls and encounters are really available', () => {
  const vm = require('node:vm');
  const requested = [];
  const c = vm.createContext({
    document: { getElementById: () => null },
    window: { requestAnimationFrame: fn => requested.push(fn) },
    ballTotal: s => Object.values(s.bag || {}).reduce((a, n) => a + Number(n || 0), 0),
    ballGrassLeft: s => s.wild.open ? Math.max(1, s.wild.left) : s.wild.left,
    ballApply: s => s,
  });
  vm.runInContext(SRC, c);
  const ready = { ok: true, bag: { poke: 1, great: 0, ultra: 0 }, wild: { left: 4 } };
  assert.match(c.rcCaptureCta(true, ready), /data-action="openWildGrass"/);
  assert.match(c.rcCaptureCta(true, ready), /Tenter une capture/);
  assert.match(c.rcCaptureCta(true, { ...ready, wild: { left: 0, open: { id: 1 } } }), /Reprendre la capture/);
  assert.equal(c.rcCaptureCta(false, ready), '', 'a loss does not suggest winning rewards');
  assert.equal(c.rcCaptureCta(true, { ...ready, bag: { poke: 0 } }), '', 'no Ball');
  assert.equal(c.rcCaptureCta(true, { ...ready, wild: { left: 0 } }), '', 'no encounter');
  assert.equal(c.rcCaptureCta(true, null), '', 'no stale or speculative counts');

  c.ballApply(ready);
  c.ballApply(ready);
  assert.equal(requested.length, 1, 'an async bag update schedules a single compact-result refresh');
  requested[0]();
  c.ballApply(ready);
  assert.equal(requested.length, 2, 'a subsequent reward can refresh the capture action');
  assert.match(CSS, /rc-chip\.rc-capture-cta/, 'the capture shortcut has dedicated compact styling');
  assert.match(CSS, /rc-capture-cta:focus-visible/, 'the action stays keyboard accessible');
});
