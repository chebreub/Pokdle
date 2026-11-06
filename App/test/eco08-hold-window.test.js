'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {POLICIES, SAMPLES, parisDate, nextParisMidnight, nextMondayParis,
  expiresAt, previewEncounter, compare} = require('../tools/study-special-encounter-window');

test('ECO-08: baseline expiration is midnight Europe/Paris, not 24 hours later', () => {
  assert.equal(new Date(nextParisMidnight('2026-11-06T21:00:00Z')).toISOString(), '2026-11-06T23:00:00.000Z');
  assert.equal(new Date(expiresAt('2026-11-06T21:00:00Z', 'current_midnight')).toISOString(), '2026-11-06T23:00:00.000Z');
  assert.equal(parisDate('2026-11-06T23:00:00Z'), '2026-11-07');
});
test('ECO-08: rolling 72h is absolute elapsed time, even across DST change', () => {
  const opened = '2026-10-25T00:30:00Z'; // 02:30 in Paris just before the fallback
  assert.equal(new Date(expiresAt(opened, 'rolling_72h')).toISOString(), '2026-10-28T00:30:00.000Z');
  assert.equal(new Date(nextParisMidnight(opened)).toISOString(), '2026-10-25T23:00:00.000Z');
  assert.equal(new Date(nextParisMidnight('2027-03-28T00:30:00Z')).toISOString(), '2027-03-28T22:00:00.000Z');
});
test('ECO-08: crossing expedition week can be allowed or capped by explicit policy', () => {
  const sunday = '2026-11-08T20:00:00Z'; // Sunday 21:00 Paris
  assert.equal(new Date(nextMondayParis(sunday)).toISOString(), '2026-11-08T23:00:00.000Z');
  assert.equal(new Date(expiresAt(sunday, 'rolling_72h')).toISOString(), '2026-11-11T20:00:00.000Z');
  assert.equal(new Date(expiresAt(sunday, 'weekly_cap_72h')).toISOString(), '2026-11-08T23:00:00.000Z');
});
test('ECO-08: resume is same encounter, not a new chance or shiny roll', () => {
  const row = {id: 987, kind:'legend',status:'open',pokemonId:639,shiny:true,throws:1,createdAt:'2026-11-06T21:00:00Z'};
  assert.equal(previewEncounter(row,'2026-11-07T12:00:00Z','current_midnight'),null);
  const resumed = previewEncounter(row,'2026-11-07T12:00:00Z','rolling_72h');
  assert.deepEqual(resumed,{id:987,pokemonId:639,shiny:true,throws:1,throwsLeft:2,expiresAt:'2026-11-09T21:00:00.000Z'});
  assert.deepEqual(previewEncounter(row,'2026-11-07T12:00:00Z','rolling_72h'),resumed);
  assert.equal(previewEncounter({...row,kind:'prestige'},'2026-11-07T12:00:00Z','rolling_72h'),null);
  assert.equal(previewEncounter({...row,status:'caught'},'2026-11-07T12:00:00Z','rolling_72h'),null);
  assert.equal(previewEncounter(row,'2026-11-09T21:00:00Z','rolling_72h'),null);
});
test('ECO-08: bounded, complete sample comparison; proposed policy cannot edit engine', () => {
  const rows=compare();
  assert.equal(rows.length, POLICIES.length * SAMPLES.length);
  for(const sample of SAMPLES){
    const all=rows.filter(r=>r.sample===sample.name);
    assert.ok(all[0].availableHours>0);
    assert.equal(all[2].availableHours,72);
    assert.ok(all[3].availableHours<=72 && all[3].availableHours<=all[2].availableHours);
  }
  assert.throws(()=>expiresAt('2026-11-06T00:00:00Z', 'unknown'),/unknown_policy/);
});
