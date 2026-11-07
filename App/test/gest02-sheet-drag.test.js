'use strict';
// GEST-02 (7/11/2026): on phones, a window or bottom sheet closes when pulled down by its handle or title.
// The ✕ stays; the content never starts the gesture; short pulls snap back.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10xzv.sheet-drag.js'), 'utf8');
const ctx = { window: {}, document: undefined };
vm.runInNewContext(SRC, ctx);

test('closes only when pulled far enough, or with a quick pull already under way', () => {
  const close = ctx.sheetDragShouldClose;
  assert.equal(close(40, 2000, 600), false, 'a short slow pull snaps back');
  assert.equal(close(140, 2000, 600), true, '22 % of the height (at least 90 px) closes');
  assert.equal(close(100, 2000, 600), false, 'under 22 % of a tall window');
  assert.equal(close(95, 2000, 300), true, '90 px on a small sheet');
  assert.equal(close(60, 60, 600), true, 'a quick flick closes');
  assert.equal(close(30, 10, 600), false, 'too short, even fast');
  assert.equal(close(0, 10, 600), false);
});

test('only the handle or the title starts it, never buttons or fields; phone only; reduced animations respected', () => {
  assert.match(SRC, /zone: '\.sheet-grab, \.overlay-head'/);
  assert.match(SRC, /zone: '\.fav-sheet-grab, \.fav-sheet-head'/);
  assert.match(SRC, /if \(e\.target\.closest\('button, input, select, textarea, a, label'\)\) return;/);
  assert.match(SRC, /if \(e\.pointerType === 'mouse' \|\| !sheetDragPhone\(\)/);
  assert.match(SRC, /if \(sheetDragReduced\(\)\) \{ finish\(\); return; \}/);
  assert.match(SRC, /closeOverlayModal\(\)/);
  assert.doesNotMatch(SRC, /fetch\(|trackUsage\(/);
  const css = fs.readFileSync(path.join(__dirname, '..', 'game-shell.css'), 'utf8');
  assert.match(css, /\.sheet-grab \{display:none;\}\n@media \(max-width:640px\) \{/, 'no handle on desktop');
  assert.match(css, /#overlay-modal \.overlay-head, \.fav-sheet-head \{touch-action:none;\}/);
});
