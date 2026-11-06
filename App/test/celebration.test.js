'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
const core = read('script.01.core.js');
const titles = core.slice(core.indexOf('const XP_TITLES = ['), core.indexOf('// Under the 10 old levels'));
const entry = core.slice(core.indexOf('function xpLevelEntry('), core.indexOf('// Big numbers read'));

function context(overrides = {}) {
  const c = {
    escapeHtml: (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`),
    xpForLevel: (level) => level * 100, document: undefined, setTimeout, clearTimeout, ...overrides,
  };
  vm.createContext(c);
  vm.runInContext(titles + entry + read('script.10eb.celebration.js') + '\nthis.celebrationQueue = celebrationQueue;', c);
  return { c };
}

test('a level-up names the new title only when it changes, and the next title to aim for', () => {
  const { c } = context();
  const titled = c.celebrationLevelHtml(9, 10);
  assert.match(titled, /Niveau 10 !/);
  assert.match(titled, /Nouveau titre : Novice/);
  assert.match(titled, /Prochain titre : Apprenti 🌱 au niveau 20/);
  const plain = c.celebrationLevelHtml(11, 12);
  assert.doesNotMatch(plain, /Nouveau titre/);
  assert.match(plain, /au niveau 20/);
  assert.match(c.celebrationLevelHtml(99, 100), /dernier titre/);
});

test('a burst of achievements produces one banner showing three titles plus overflow', () => {
  const { c } = context();
  c.celebrateAchievements([1, 2, 3, 4, 5].map((n) => ({ title: 'Succès ' + n, desc: 'Détail ' + n })));
  assert.equal(c.celebrationQueue.length, 1);
  const banner = c.celebrationAchievementHtml(c.celebrationQueue[0]);
  assert.match(banner, /Succès 1/);
  assert.match(banner, /Succès 2/);
  assert.match(banner, /Succès 3/);
  assert.ok(banner.includes('+2 autres succès'));
  assert.doesNotMatch(banner, /Succès 4|Succès 5/);
  c.celebrateLevelUp(10, 10);
  assert.equal(c.celebrationQueue.length, 1, 'no card without a new level');
  c.celebrateLevelUp(10, 11);
  assert.equal(c.celebrationQueue.at(-1).kind, 'level');
  c.celebrateAchievements([{ title: 'Succès 6', desc: 'Détail 6' }]);
  assert.equal(c.celebrationQueue.length, 2, 'newly queued achievements join the pending banner');
  assert.equal(c.celebrationQueue[0].items.length, 6);
});


function presentationFixture() {
  let modalOpen = false;
  const pending = [], shown = [], done = [], queried = [];
  const doc = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: (selector) => { queried.push(selector); return modalOpen ? {} : null; }
  };
  const { c } = context({
    document: doc,
    setTimeout(callback) { pending.push(callback); return pending.length; },
    clearTimeout() {}
  });
  c.showLevelCelebration = (item, complete) => { shown.push({ kind: 'level', item }); done.push(complete); };
  c.showAchievementCelebration = (item, complete) => { shown.push({ kind: 'achievement', item }); done.push(complete); };
  return { c, shown, done, queried, block: (value) => { modalOpen = value; } };
}

test('level and achievement never overlap, and two level jumps share one card', () => {
  const f = presentationFixture();
  f.c.celebrateLevelUp(9, 10);
  f.c.celebrateLevelUp(10, 11);
  f.c.celebrateAchievements([{title:'Une victoire',desc:'Bien joué'}]);
  assert.equal(f.c.celebrationQueue.length, 2, 'two level gains are grouped');
  f.c.runCelebrations();
  assert.deepEqual(f.shown.map(s => s.kind), ['level']);
  assert.equal(f.shown[0].item.from, 9);
  assert.equal(f.shown[0].item.to, 11);
  f.c.runCelebrations();
  assert.equal(f.shown.length, 1, 'the second overlay stays queued');
  f.done.shift()();
  f.c.runCelebrations();
  assert.deepEqual(f.shown.map(s => s.kind), ['level','achievement']);
});

test('captures, gifts and existing modals delay celebrations until they close', () => {
  const f = presentationFixture();
  f.block(true);
  f.c.celebrateLevelUp(9, 10);
  f.c.celebrateAchievements([{title:'Premier succès',desc:'Bravo'}]);
  f.c.runCelebrations();
  assert.equal(f.shown.length, 0, 'no overlay on top of a capture');
  assert.equal(f.c.celebrationQueue.length, 2, 'no celebration is lost');
  assert.ok(f.queried.some(selector => selector.includes('.xp-toast.is-visible')
    && selector.includes('.gamefeel-layer.is-visible')
    && selector.includes('.fx-catch')), 'visible XP/result and capture overlays all block celebrations');
  f.block(false);
  f.c.runCelebrations();
  assert.deepEqual(f.shown.map(s => s.kind), ['level']);
  f.done.shift()();
  f.c.runCelebrations();
  assert.deepEqual(f.shown.map(s => s.kind), ['level','achievement']);
});

test('dismissal transitions cannot intercept touches after a celebration closes', () => {
  const css = fs.readFileSync(path.join(__dirname, '../game-feel.css'), 'utf8');
  assert.ok(css.includes('.lvc-back.is-leaving,.lvc-card.is-leaving{transition:opacity .2s ease;opacity:0 !important;pointer-events:none}'));
  assert.ok(css.includes('.achc.is-leaving{animation:achcOut .38s ease forwards;pointer-events:none}'));
});

test('the first achievement check of a page load unlocks quietly; later ones are celebrated', () => {
  const src = read('script.07.delegation-party.js');
  const fn = src.slice(src.indexOf('let achievementsCheckedOnce'), src.indexOf('function getAchievementProgress('));
  let value = 1;
  const celebrated = [];
  const c = { ACHIEVEMENT_DEFS: [{ id: 'a', target: 1, getValue: () => value }, { id: 'b', target: 2, getValue: () => value }],
    unlockedAchievements: {}, saveAchievementsState() {}, celebrateAchievements: (list) => celebrated.push(Array.from(list, (a) => a.id)) };
  vm.createContext(c);
  vm.runInContext(fn, c);
  c.evaluateAchievements();
  assert.deepEqual(celebrated, [], 'old progress on page load');
  value = 2;
  c.evaluateAchievements();
  assert.deepEqual(celebrated, [['b']]);
});

test('mobile keyboard keeps celebrations queued, then resumes without losing their order', () => {
  const f = presentationFixture();
  let keyboard = true;
  f.c.document.body = { classList: { contains: name => name === 'mobile-keyboard-open' && keyboard } };
  f.c.celebrateLevelUp(9, 10);
  f.c.celebrateAchievements([{ title: 'Premier succès', desc: 'Bravo' }]);
  f.c.runCelebrations();
  assert.equal(f.shown.length, 0);
  assert.equal(f.c.celebrationQueue.length, 2);
  keyboard = false;
  f.c.runCelebrations();
  f.done.shift()();
  f.c.runCelebrations();
  assert.deepEqual(f.shown.map(s => s.kind), ['level', 'achievement']);
});

test('an open Party chat delays celebrations even after its keyboard closes', () => {
  const f = presentationFixture();
  let chatOpen = true;
  f.c.document.querySelector = selector => chatOpen && selector.includes('#party-chat:not(.hidden)') ? {} : null;
  f.c.celebrateLevelUp(9, 10);
  f.c.runCelebrations();
  assert.equal(f.shown.length, 0);
  assert.equal(f.c.celebrationQueue.length, 1);
  chatOpen = false;
  f.c.runCelebrations();
  assert.deepEqual(f.shown.map(s => s.kind), ['level']);
});
