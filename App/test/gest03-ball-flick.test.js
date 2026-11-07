'use strict';
// GEST-03 (7/11/2026, option): « Lancer la Ball d'un geste ». Off by default; a flick upwards calls the very same
// wildThrow as the buttons (same server call, same odds); short, downward, sideways or cancelled gestures spend nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const SRC = read('script.10xzw.ball-flick.js');
const ctx = { window: {} };
vm.runInNewContext(SRC, ctx);

test('only a long enough, mostly upward flick throws', () => {
  const t = ctx.ballFlickShouldThrow;
  assert.equal(t(0, -180), true);
  assert.equal(t(60, -100), true);
  assert.equal(t(0, -40), false, 'too short');
  assert.equal(t(0, 150), false, 'downwards');
  assert.equal(t(150, -90), false, 'sideways');
});

test('same throw as the buttons, nothing spent otherwise, off by default', () => {
  assert.match(SRC, /window\.wildThrow\(kindNow\); \/\/ le même lancer que le bouton/);
  assert.equal((SRC.match(/wildThrow\(/g) || []).length, 1, 'the only way to throw');
  assert.doesNotMatch(SRC, /fetch\(|XMLHttpRequest|sendBeacon/, 'no server call of its own');
  assert.match(SRC, /el\.addEventListener\('pointercancel', end\);/);
  assert.match(SRC, /if \(e\.type === 'pointerup' && ballFlickShouldThrow\(dx, dy\)/, 'a cancelled gesture never throws');
  const party = read('script.07.delegation-party.js');
  assert.match(party, /ballFlick: false,\n\};/, 'off by default');
  assert.match(party, /data-setting="ballFlick" data-bool="1"/);
});
