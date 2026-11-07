'use strict';
// DISC-01 (7/11/2026): one « À découvrir aujourd'hui » card under the home mini-games, one game per Paris day,
// never one already on the home shelf or recently played, never-opened games first; nothing sent to the server.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10xzt.discovery-card.js'), 'utf8');
function load() {
  const store = new Map();
  const ctx = { window: {}, localStorage: { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) }, matchHistory: [], document: { querySelector: () => null, querySelectorAll: () => [] } };
  vm.runInNewContext(SRC, ctx);
  return ctx;
}

test('one game per day, never-opened first, never one on the home shelf or recent', () => {
  const c = load();
  const all = c.DISC_CANDIDATES.map((x) => x[0]);
  assert.equal(new Set(all).size, all.length);
  for (const action of c.DISC_HOME_SHELF) assert.ok(!all.includes(action), action + ' is already on the home shelf');
  const day = '2026-11-07';
  const a = c.discPick(day, { shelf: c.DISC_HOME_SHELF, played: new Set() });
  assert.deepEqual(c.discPick(day, { shelf: c.DISC_HOME_SHELF, played: new Set() }), a, 'stable for the day');
  assert.notEqual(c.discPick('2026-11-08', { played: new Set() }).action, a.action, 'changes the next day');
  assert.equal(a.fresh, true);
  // Everything played but one: that one comes up, whatever the day.
  const keep = 'openShinyMode';
  const played = new Set(all.filter((x) => x !== keep));
  for (const d of ['2026-11-07', '2026-11-08', '2026-12-01']) assert.equal(c.discPick(d, { played }).action, keep);
  // Everything played: still a suggestion, without « Jamais joué ».
  const any = c.discPick(day, { played: new Set(all) });
  assert.equal(any.fresh, false);
  // Recent games and games missing from the catalogue are skipped.
  assert.notEqual(c.discPick(day, { played: new Set(), recent: [a.action] }).action, a.action);
  assert.equal(c.discPick(day, { exists: () => false }), null);
});

test('played = opened from the card or in the match history; « Pas aujourd\'hui » is per day', () => {
  const c = load();
  c.matchHistory.push({ mode: 'pixel' });
  c.discMarkOpened('startCryGame');
  const played = c.discPlayedSet();
  assert.ok(played.has('startPixelGame') && played.has('startCryGame'));
  assert.ok(!played.has('openShinyMode'));
  assert.match(SRC, /function discoveryLater\(\) \{\n\s+discWrite\(DISC_HIDE_KEY, discToday\(\)\);/);
  assert.match(SRC, /if \(discRead\(DISC_HIDE_KEY, ''\) === day\)/);
});

test('nothing is sent to the server, the card sits inside the mini-games section, styles exist', () => {
  assert.doesNotMatch(SRC, /fetch\(|trackUsage\(|sendBeacon|XMLHttpRequest/);
  assert.match(SRC, /document\.querySelector\('#screen-config \.home-discovery'\)/);
  assert.match(SRC, /host\.appendChild\(old\)/);
  const css = fs.readFileSync(path.join(__dirname, '..', 'home.css'), 'utf8');
  assert.match(css, /\.disc-card\{display:grid;/);
  assert.match(css, /\.disc-go\{min-height:44px;/);
  assert.match(css, /body\.theme-dark \.disc-card\{/);
});
