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

test('a burst of achievements shows three by name, then one line for the rest', () => {
  const { c } = context();
  c.celebrateAchievements([1, 2, 3, 4, 5].map((n) => ({ title: 'Succès ' + n, desc: 'Détail ' + n })));
  assert.deepEqual(Array.from(c.celebrationQueue, (item) => item.title), ['Succès 1', 'Succès 2', 'Succès 3', '+2 autres succès']);
  c.celebrateLevelUp(10, 10);
  assert.equal(c.celebrationQueue.length, 4, 'no card without a new level');
  c.celebrateLevelUp(10, 11);
  assert.equal(c.celebrationQueue.at(-1).kind, 'level');
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
