'use strict';
// Prevent regression of the November 2026 album layout and discovery/capture terminology.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('desktop album no longer uses the old two-column binder, tools precede the grid', () => {
  const css = src('game-shell.css');
  assert.match(css, /@media \(min-width:900px\)\s*\{\s*#overlay-modal\.is-dex \.alb\.is-binder\s*\{\s*display:flex;\s*flex-direction:column;/);
  assert.match(css, /#overlay-modal\.is-dex \.alb\.is-binder > \.dex-tools,[\s\S]*?width:100%;/);
  const dex = src('src/script.10xzp.dex-carnet.js');
  assert.ok(dex.indexOf("head.insertAdjacentHTML('afterend'") >= 0);
  assert.ok(src('src/script.10xw.album-binder.js').includes("'<div class=\"alb-binder\"><div class=\"alb-page\">'"));
});

test('seen filter includes caught Pokemon, not missing Pokemon', () => {
  const code = src('src/script.10xzp.dex-carnet.js');
  const context = vm.createContext({
    albumView: {tab:'binder'}, ALBUM_PAGE: 9,
    document: {readyState:'complete'}, window: {}
  });
  vm.runInContext(code, context);
  const slot = (classes) => ({
    classList: {contains: (c) => classes.includes(c)},
    querySelector: () => ({textContent:''})
  });
  context.albumView.filter = 'seen';
  assert.equal(context.dexSlotMatches(slot(['alb-slot','is-caught'])), true);
  assert.equal(context.dexSlotMatches(slot(['alb-slot','is-seen'])), true);
  assert.equal(context.dexSlotMatches(slot(['alb-slot','is-miss'])), false);
  context.albumView.filter = 'caught';
  assert.equal(context.dexSlotMatches(slot(['alb-slot','is-seen'])), false);
  assert.equal(context.dexSlotMatches(slot(['alb-slot','is-caught'])), true);
});

test('album mission counter derives from the catalog and rewards are discoveries', () => {
  const home = src('src/script.10f.home-adventure.js');
  assert.match(home, /function homeAdventureMissionTotal\(\)/);
  assert.match(home, /ALBUM_MISSIONS\.length/);
  assert.match(home, /homeAdventureMissionTotal\(\)\}<\/small>/);
  assert.match(home, /DÉCOUVERTE PRÊTE/);
  assert.match(home, /Voir la découverte/);
  assert.doesNotMatch(home, /Réclamer la récompense|RÉCOMPENSE PRÊTE/);
  assert.match(src('src/script.10b.album-missions.js'), /Ta prochaine découverte/);
});

test('home only promises Balls from tagged eligible mini-games', () => {
  const home = src('src/script.10xzm.home-simple.js');
  assert.match(home, /mini-jeux marqués \+1 Ball/);
  assert.doesNotMatch(home, /Chaque mini-jeu te donne une Ball/);
});
