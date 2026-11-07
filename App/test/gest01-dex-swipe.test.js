'use strict';
// GEST-01 (7/11/2026): on phones, the Pokédex fiche gets ‹ › around its picture, the neighbours' names, and a swipe
// on the picture only (pan-y keeps the page scroll). Short or mostly vertical moves never change the fiche.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10xzu.dex-swipe.js'), 'utf8');
const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {} } };
vm.runInNewContext(SRC, ctx);

test('a swipe changes the fiche only when long enough, horizontal enough and towards an existing neighbour', () => {
  const both = { previous: { id: 24 }, next: { id: 26 } };
  assert.equal(ctx.dexSwipeDecision(-120, 0, 360, both), 'next', 'to the left: next');
  assert.equal(ctx.dexSwipeDecision(120, 0, 360, both), 'prev', 'to the right: previous');
  assert.equal(ctx.dexSwipeDecision(-60, 0, 360, both), null, 'under a quarter of the width: the fiche comes back');
  assert.equal(ctx.dexSwipeDecision(-30, 0, 100, both), null, 'never under 40 px');
  assert.equal(ctx.dexSwipeDecision(-120, 100, 360, both), null, 'a diagonal move is a scroll');
  assert.equal(ctx.dexSwipeDecision(-120, 0, 360, { previous: { id: 1 }, next: null }), null, 'no next at the end of the list');
});

test('phone only, picture only, page scroll kept, reduced animations respected, nothing sent', () => {
  assert.match(SRC, /window\.matchMedia\('\(max-width: 640px\)'\)\.matches\)\) return;/);
  assert.match(SRC, /detail\.querySelector\('\.pokedex-detail-head-main > img'\)/);
  assert.match(SRC, /if \(e\.pointerType === 'mouse' \|\| e\.target\.closest\('button'\)\) return;/);
  assert.match(SRC, /if \(dexSwipeReduced\(\)\) \{ go\(\); return; \}/);
  assert.match(SRC, /navigatePokedexDetail\(dir\)/, 'the same navigation as the buttons (current filter kept)');
  assert.doesNotMatch(SRC, /fetch\(|trackUsage\(/);
  const css = fs.readFileSync(path.join(__dirname, '..', 'pokedex.css'), 'utf8');
  assert.match(css, /#screen-pokedex \.dex-swipe \{[^}]*touch-action:pan-y;/);
  assert.match(css, /#screen-pokedex \.dex-swipe-chev \{[^}]*width:44px;height:44px;/);
});

test('the hint shows twice at most, and never again once the gesture is used', () => {
  assert.equal(ctx.DEX_SWIPE_HINT_MAX, 2);
  assert.match(SRC, /if \(hints < DEX_SWIPE_HINT_MAX && \(nav\.previous \|\| nav\.next\)/);
  assert.match(SRC, /dexSwipeSetHint\(DEX_SWIPE_HINT_MAX\); \/\/ le geste est compris/);
});
