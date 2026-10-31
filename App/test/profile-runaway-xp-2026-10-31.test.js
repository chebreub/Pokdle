'use strict';
// XP that ran away (31/10/2026): Kayan, level 73, became « Maître Pokémon ★11299825776381 ». The common
// copy of two devices only moved when a device sent its profile, so each reload counted the progress
// shared since an old copy twice. The merge now refuses broken copies and caps what one side can add;
// the common copy moves whenever the online copy is accepted; a broken value is repaired on load.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function merge() {
  const code = read('src/script.07a.profile-merge.js').split('// Repair (31/10/2026)')[0];
  return Function(code + '; return { profileMergeCounter, profileCounterCeiling, mergeSyncBlobs };')();
}

test('a stale common copy no longer doubles the XP, and a broken copy never spreads', () => {
  const { profileMergeCounter, mergeSyncBlobs } = merge();
  assert.equal(profileMergeCounter(300, 7, 0, 'xp'), 307, 'progress on both devices still adds up');
  assert.equal(profileMergeCounter(131400, 131500, 1000, 'xp'), 181500, 'a stale copy adds at most 50 000 XP, never doubles');
  assert.equal(profileMergeCounter(5.6e16, 131400, 120000, 'xp'), 131400, 'a broken copy is ignored');
  assert.equal(profileMergeCounter(131400, 120000, 130000, 'xp'), 131400, 'a common copy newer than one side is not common');
  // Twenty reloads with the same old common copy: before, the XP doubled each time.
  let a = 131400, b = 131400;
  for (let i = 0; i < 20; i++) { a = profileMergeCounter(a, b, 1000, 'xp'); b = a; }
  assert.ok(a <= 247500, 'stays under the ceiling: ' + a);
  const blob = (xp) => ({ profile: JSON.stringify({ xp }), stats: JSON.stringify({ played: 10, wins: 5, totalAttempts: 40 }) });
  assert.equal(JSON.parse(mergeSyncBlobs(blob(5.6e16), blob(131400), blob(130000)).profile).xp, 131400);
});

test('the XP ceiling is level 100 until 10/11/2026, then grows by 30 000 a day', () => {
  const { profileCounterCeiling } = merge();
  assert.equal(profileCounterCeiling('xp', Date.parse('2026-10-31T12:00:00Z')), 247500);
  assert.equal(profileCounterCeiling('xp', Date.parse('2026-11-12T12:00:00Z')), 247500 + 2 * 30000);
  assert.equal(profileCounterCeiling('played'), 20000);
  const { xpCeiling } = require('../lib/profile-sync');
  assert.equal(xpCeiling(Date.parse('2026-11-12T12:00:00Z')), 247500 + 2 * 30000, 'same ceiling on the server');
});

test('a broken counter is repaired from the highest sound copy the browser keeps', () => {
  const code = read('src/script.07a.profile-merge.js');
  const store = new Map([
    ['pokedle_restore_points_v1', JSON.stringify([{ at: 2, data: { profile: JSON.stringify({ xp: 9e15 }) } }, { at: 1, data: { profile: JSON.stringify({ xp: 131400 }) } }])],
    ['pokedle_sync_base_v1:7', JSON.stringify({ profile: JSON.stringify({ xp: 120000 }), stats: JSON.stringify({ played: 80 }) })],
  ]);
  const localStorage = { get length() { return store.size; }, key: (i) => [...store.keys()][i], getItem: (k) => store.get(k) ?? null };
  const env = { localStorage, loadProfile: undefined, loadStats: undefined };
  const { repairRunawayCounters } = Function(...Object.keys(env), code + '; return { repairRunawayCounters };')(...Object.values(env));
  const profile = { xp: 5.6e16, totalQuestsCompleted: 12 };
  assert.equal(repairRunawayCounters(profile, 'profile', { xp: 247500 }), true);
  assert.deepEqual(profile, { xp: 131400, totalQuestsCompleted: 12 });
  const stats = { played: 4e12, wins: 10 };
  repairRunawayCounters(stats, 'stats', {});
  assert.deepEqual(stats, { played: 80, wins: 10 });
  const lost = { xp: 1e20 };
  const empty = Function('localStorage', 'loadProfile', 'loadStats', code + '; return repairRunawayCounters;')({ length: 0, key: () => null, getItem: () => null }, undefined, undefined);
  empty(lost, 'profile', { xp: 247500 });
  assert.equal(lost.xp, 247500, 'no sound copy left: level 100 without stars');
  assert.equal(repairRunawayCounters({ xp: 131400 }, 'profile', {}), false, 'a sound profile is left alone');
});

test('the common copy moves when the online copy is accepted at load', () => {
  const src = read('src/script.07.delegation-party.js');
  const load = src.slice(src.indexOf('function activateAccount('), src.indexOf('// Last content known to match the server'));
  assert.equal((load.match(/saveSyncBase\(accountId, server\);/g) || []).length, 2, 'same content, and online copy taken or merged');
});
