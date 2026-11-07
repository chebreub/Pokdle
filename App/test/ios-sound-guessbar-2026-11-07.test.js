'use strict';
// 7/11/2026, retours de Kayan sur iPhone : (1) après le cri du Pokémon, les sons des hautes herbes restaient en
// attente puis sortaient tous d'un coup au retour dans l'appli ; (2) la barre « Tape un nom de Pokémon… »
// descendait sous le menu du bas à chaque essai.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function loadSound(state) {
  const listeners = {};
  let resumed = 0;
  class FakeCtx { constructor() { this.state = state; } resume() { resumed++; return Promise.resolve(); } }
  const ctx = {
    window: { AudioContext: FakeCtx, matchMedia: () => ({ matches: false }) },
    document: { addEventListener: (t, f) => { listeners[t] = f; }, hidden: false },
    getStoredAppSettings: () => ({ soundEffects: true }),
    Date,
  };
  vm.createContext(ctx);
  vm.runInContext(read('src/script.10c.pokedex-effects.js').split('function pokedexFxTone')[0], ctx);
  return { ctx, listeners, resumed: () => resumed };
}

test('a paused sound engine is woken by each touch, and never plays a late burst', () => {
  const s = loadSound('interrupted');
  assert.equal(s.ctx.getPokedexFxAudioContext(), null, 'far from a touch: skipped, not queued');
  assert.ok(s.resumed() >= 1, 'resume is still asked');
  s.listeners.touchend();
  const audio = s.ctx.getPokedexFxAudioContext();
  assert.ok(audio, 'right after a touch: the sound is played');
  audio.state = 'running';
  vm.runInContext('pokedexFxGestureAt = 0', s.ctx);
  assert.equal(s.ctx.getPokedexFxAudioContext(), audio, 'a running engine always plays');
  audio.state = 'closed';
  assert.notEqual(s.ctx.getPokedexFxAudioContext(), audio, 'a closed engine is replaced');
});

test('the guess bar scrolls back above the menu only when it slipped under it', () => {
  const ctx = {};
  vm.createContext(ctx);
  const src = read('src/script.10jb.guess-bar-anchor.js');
  vm.runInContext(src.slice(src.indexOf('function guessBarScrollDelta'), src.indexOf('function guessBarKeepVisible')), ctx);
  const limits = { top: 80, bottom: 586 };
  assert.equal(ctx.guessBarScrollDelta(458, 586, limits), 0, 'already visible: nothing moves');
  assert.equal(ctx.guessBarScrollDelta(570, 698, limits), 112, 'under the menu (iPhone screenshot): back above');
  assert.equal(ctx.guessBarScrollDelta(1000, 1128, limits), 542);
  assert.equal(ctx.guessBarScrollDelta(100, 900, limits), 20, 'never pushes its top under the header');
  assert.match(src, /new MutationObserver[\s\S]*observe\(body, \{ childList: true \}\)/);
  assert.match(src, /max-width: 640px/, 'phone only');
});
