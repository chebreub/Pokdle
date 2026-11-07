'use strict';
// FX-01 (7/11/2026): « Animations » Normales / ⚡ Rapides / Réduites. Rapides halves the capture, gift, chest and
// new-entry effects (same steps, same server result); Réduites is the old switch; the system setting still wins;
// the site's setting now also counts in the tall grass.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const party = read('script.07.delegation-party.js');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

function settingsCtx(stored, systemReduce = false) {
  const store = new Map(stored ? [['pokedle_app_settings_v1', JSON.stringify(stored)]] : []);
  const classes = new Set();
  const ctx = {
    console, window: { matchMedia: () => ({ matches: systemReduce }) },
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    document: { body: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } }, querySelectorAll: () => [] },
  };
  vm.runInNewContext(between(party, 'const APP_SETTINGS_STORAGE_KEY', '// The master volume') +
    between(party, 'function getStoredAppSettings()', 'function updateAppSetting(') +
    ';this.appAnimationMode=appAnimationMode;this.setAnimationMode=setAnimationMode;this.getStoredAppSettings=getStoredAppSettings;', ctx);
  ctx.classes = classes; ctx.store = store;
  return ctx;
}

test('the old switch is kept: reduceMotion means « Réduites », nothing set means « Normales »', () => {
  assert.equal(settingsCtx(null).appAnimationMode(), 'normal');
  assert.equal(settingsCtx({ reduceMotion: true }).appAnimationMode(), 'reduced');
  assert.equal(settingsCtx({ animations: 'fast' }).appAnimationMode(), 'fast');
  assert.equal(settingsCtx({ animations: 'fast' }, true).appAnimationMode(), 'reduced', 'the system setting still wins');
  assert.equal(settingsCtx({ animations: 'nope' }).appAnimationMode(), 'normal');
});

test('choosing a mode saves it, keeps reduceMotion in step and sets the body class', () => {
  const c = settingsCtx(null);
  c.setAnimationMode('fast');
  assert.equal(c.getStoredAppSettings().animations, 'fast');
  assert.equal(c.getStoredAppSettings().reduceMotion, false);
  assert.ok(c.classes.has('anim-fast'));
  c.setAnimationMode('reduced');
  assert.equal(c.getStoredAppSettings().reduceMotion, true);
  assert.ok(c.classes.has('reduce-motion') && !c.classes.has('anim-fast'));
  c.setAnimationMode('bogus');
  assert.equal(c.getStoredAppSettings().animations, 'reduced', 'unknown values are ignored');
});

test('Rapides halves the effects; the tall grass follows the site setting; settings show three choices', () => {
  const fx = read('script.10xzc.reveal-fx.js');
  const ctx = { appAnimationMode: () => 'fast' };
  vm.runInNewContext(between(fx, 'function fxFast()', 'const FX_SCOPE') + ';this.fxMs=fxMs;', ctx);
  assert.equal(ctx.fxMs(1000), 500);
  ctx.appAnimationMode = () => 'normal';
  assert.equal(ctx.fxMs(1000), 1000);
  assert.match(fx, /timers\.push\(setTimeout\(finish, fxMs\(2400 \+ balls\.length \* 350\)\)\);/);
  const motion = read('script.10xzd.motion.js');
  assert.match(motion, /if \(o\.duration\) o\.duration = fxMs\(o\.duration\); if \(o\.delay\) o\.delay = fxMs\(o\.delay\);/);
  assert.match(motion, /run\.wait = \(ms\) => new Promise\(\(r\) => timers\.push\(setTimeout\(\(\) => r\(!run\.over\), typeof fxMs === "function" \? fxMs\(ms\) : ms\)\)\);/);
  assert.doesNotMatch(motion.replace(/fxMs\([^)]*\)/g, ''), /setTimeout\([^;]*?, \d+\)/, 'every timer of the capture is scaled');
  assert.match(read('script.10xz.wild-grass.js'), /if \(typeof appAnimationMode === "function"\) return appAnimationMode\(\) === "reduced";/);
  assert.match(party, /data-anim="\$\{mode\}"[^`]*data-action="setAnimationMode"/);
  assert.doesNotMatch(party, /data-setting="reduceMotion"/, 'the old checkbox is replaced');
});

test('« Réduites » cuts the movement, never the capture sounds', () => {
  const motion = read('script.10xzd.motion.js');
  assert.match(motion, /if \(wildReducedMotion\(\)\) \{ moReducedCaptureSounds\(shakes, caught\); return Promise\.resolve\(\); \}/);
  const played = [];
  const ctx = { moSfx: (k) => played.push(k), setTimeout: (fn, ms) => played.push(['at', ms]) && fn() };
  vm.runInNewContext(between(motion, 'function moReducedCaptureSounds', '// --- ⚪ Capture') + ';this.f=moReducedCaptureSounds;', ctx);
  played.length = 0; ctx.f(3, true);
  assert.deepEqual(played.filter((x) => typeof x === 'string'), ['throw', 'land', 'tick', 'tick', 'tick', 'caught']);
  played.length = 0; ctx.f(1, false);
  assert.deepEqual(played.filter((x) => typeof x === 'string'), ['throw', 'land', 'tick', 'breakFree']);
  assert.ok(played.filter(Array.isArray).every(([, ms]) => ms <= 1000), 'all within one second');
});
