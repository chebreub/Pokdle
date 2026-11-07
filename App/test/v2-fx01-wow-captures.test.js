'use strict';
// V2-FX-01 (7/11/2026, « A + carte C » choisi par Kayan) : seule la mise en scène change.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const SRC = read('src/script.10xzx.wow-capture.js');

test('the wow timeline follows the real capture animation (impact, landing, each shake, click)', () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  assert.deepEqual({ ...ctx.wowCaptureTimeline(0) }, { impact: 1000, landed: 2580, click: 2900 });
  assert.equal(ctx.wowCaptureTimeline(3).click, 5600);
  assert.equal(ctx.wowCaptureTimeline(9).click, 5600, 'never more than 3 shakes');
  // Les durées de script.10xzd.motion.js sur lesquelles la timeline est calée.
  const motion = read('src/script.10xzd.motion.js');
  for (const re of [/duration: 380, easing: MO_OUT/, /duration: 620, easing: "cubic-bezier/, /duration: 240 \}/, /duration: 600, easing: MO_IN/, /duration: 740, easing: MO_IN/, /run\.wait\(380\)/, /duration: 520, easing: "ease-in-out"/, /run\.wait\(caught \? 320 : 220\)/])
    assert.match(motion, re);
});

test('only the staging changes: no server call, same result, nothing in « Réduites »', () => {
  assert.doesNotMatch(SRC, /fetch\(|wildPost|ballPaidAction|\/api\//);
  assert.match(SRC, /if \(!intro \|\| !stage \|\| wowOff\(\)/);
  assert.match(SRC, /if \(!stage \|\| !mon \|\| wowOff\(\)\) return wildAnimateBeforeWow\.apply/);
  assert.match(SRC, /return wildAnimateBeforeWow\.apply\(this, arguments\)\.then/, 'the original capture still runs and decides the timing');
  assert.match(SRC, /fxReduced\(\)\)\) return out;/);
  const css = read('balls.css');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.wow-dark,/);
  assert.match(css, /\.wow-[a-z]+\{[^}]*pointer-events:none/, 'effects never block a tap');
  assert.match(css, /calc\(1\.3s \* var\(--wowk,1\)\)/, '« Rapides » halves the durations');
});
