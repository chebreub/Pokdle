'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/script.10.adventure.js'), 'utf8');
const base = { id: 6, name: 'Dracaufeu', gen: 1 }, form = { id: 20002, baseId: 6, name: 'Dracaufeu Mega X', gen: 6, isAltForm: true };
function fixture(extra = {}) {
  const context = { window: { addEventListener() {} }, document: { addEventListener() {}, getElementById() { return null; } }, POKEMON_BY_ID: new Map([[6, base], [20002, form]]), findPokemonGlobalByName: name => [base, form].find(p => p.name === name) || null, norm: s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), ...extra };
  vm.createContext(context); vm.runInContext(source, context); return context;
}
test('discovery storage rejects invalid ids, timestamps and malformed profiles', () => {
  const f = fixture();
  assert.equal(Object.keys(f.normalizeDiscoveries(null)).length, 0);
  assert.equal(Object.keys(f.normalizeDiscoveries([])).length, 0);
  const clean = f.normalizeDiscoveries({ 6: { at: 100, mode: 'daily' }, 20002: { at: 'bad' }, 999: { at: 100 }, '__proto__': { at: 10 } });
  assert.deepEqual(Object.keys(clean), ['6']); assert.equal(clean[6].at, 100);
});
test('repeated victories keep the first discovery; alternative forms stay distinct', () => {
  const f = fixture(), entries = {};
  assert.equal(f.addDiscovery(entries, base, 'daily', 100), true);
  assert.equal(f.addDiscovery(entries, base, 'duel', 200), false);
  assert.equal(f.addDiscovery(entries, form, 'deduction', 300), true);
  assert.equal(entries[6].at, 100); assert.equal(Object.keys(entries).length, 2);
});
test('legacy history accepts real guess wins, excludes losses and score-only games', () => {
  const f = fixture();
  assert.equal(f.historyDiscovery({ result: 'win', mode: 'daily', targetName: base.name }), base);
  assert.equal(f.historyDiscovery({ result: 'loss', mode: 'daily', targetName: base.name }), null);
  assert.equal(f.historyDiscovery({ result: 'win', mode: 'quiz', targetName: base.name }), null);
  assert.equal(f.historyDiscovery({ result: 'win', mode: 'normal', targetName: 'Score 6' }), null);
});
test('duel only counts own exact win, never a forfeit, disconnect or opponent victory', () => {
  const f = fixture(), room = { status: 'finished', endedReason: 'guess', winnerId: 'a', targetRevealed: form };
  assert.equal(f.duelDiscovery(room, { id: 'a' }), form);
  assert.equal(f.duelDiscovery(room, { id: 'b' }), null);
  for (const endedReason of ['forfeit', 'disconnect']) assert.equal(f.duelDiscovery({ ...room, endedReason }, { id: 'a' }), null);
  assert.equal(f.duelDiscovery({ ...room, status: 'playing' }, { id: 'a' }), null);
});
test('Party discoveries require own success and a revealed answer; nearest must be exact', () => {
  const f = fixture(), me = { id: 'a', correct: true };
  for (const gameMode of ['guess', 'deduction', 'coop']) {
    const room = { status: 'finished', gameMode, round: { answer: form.name } };
    assert.equal(f.partyDiscovery(room, me), form);
    assert.equal(f.partyDiscovery(room, { ...me, correct: false }), null);
    assert.equal(f.partyDiscovery({ ...room, status: 'playing' }, me), null);
  }
  const room = { status: 'complete', gameMode: 'nearest', round: { results: [{ playerId: 'a', pokemon: base, distance: 1 }] } };
  assert.equal(f.partyDiscovery(room, me), null);
  room.round.results[0].distance = 0;
  assert.equal(f.partyDiscovery(room, me), base);
  assert.equal(f.partyDiscovery(room, { id: 'b' }), null);
});
test('album search combines generation, discovery and national number for forms', () => {
  const f = fixture(), all = [base, form], entries = { 6: { at: 100 } };
  assert.equal(f.filterAlbum(all, entries, 'drac', '1', 'found')[0], base);
  assert.equal(f.filterAlbum(all, entries, '#006', '6', 'missing')[0], form);
  assert.equal(f.filterAlbum(all, entries, 'zzz', 'all', 'all').length, 0);
});
test('milestone progress stays bounded at transitions and final tier', () => {
  const f = fixture();
  assert.equal(f.partnerMilestone(0).percent, 0);
  assert.equal(f.partnerMilestone(9).percent, 90);
  assert.equal(f.partnerMilestone(10).name, 'Complices');
  assert.equal(f.partnerMilestone(150).percent, 100);
  assert.equal(f.partnerMilestone(1200).next, null);
});
test('awarding a discovered pokemon persists once, even if socket state renders twice', () => {
  let saved = 0, notified = 0;
  const f = fixture({ playerProfile: { discoveries: {} }, saveProfile() { saved++; }, showToast() { notified++; } });
  assert.equal(f.recordPokemonDiscovery(base, 'deduction'), true);
  assert.equal(f.recordPokemonDiscovery(base, 'deduction'), false);
  assert.equal(saved, 1); assert.equal(notified, 1);
});
test('startup recovers the oldest real win after profile/history loading, without notifications', () => {
  let startup, saved = 0;
  const profile = { discoveries: {}, favoritePokemonId: 6, xp: 1500 };
  const f = fixture({ window: { addEventListener(event, fn) { assert.equal(event, 'DOMContentLoaded'); startup = fn; } }, playerProfile: profile, matchHistory: [{ mode: 'daily', result: 'win', targetName: base.name, at: 200 }, { mode: 'normal', result: 'win', targetName: base.name, at: 100 }, { mode: 'normal', result: 'loss', targetName: form.name, at: 50 }], saveProfile() { saved++; }, showToast() { throw new Error('Migration should be silent'); } });
  startup();
  assert.equal(profile.discoveries[6].at, 100);
  assert.equal(Object.keys(profile.discoveries).length, 1);
  assert.equal(profile.favoritePokemonId, 6); assert.equal(profile.xp, 1500);
  assert.equal(saved, 1);
  startup(); assert.equal(saved, 1);
});
