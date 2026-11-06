'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {SALAMENCE}=require('../lib/prestige-quests');
const {MAX_THROWS,SHINY_ODDS,captureChance}=require('../lib/poke-balls');
const {SCENARIOS,ASSUMPTIONS,isWeekend,eligible,simulate,compare}=require('../tools/simulate-drattak-eco02');
test('ECO-02 uses unchanged server quest, capture and shiny constraints',()=>{
  assert.deepEqual(SALAMENCE.modes,{cry:3,silhouette:3,description:3});
  assert.equal(SALAMENCE.minDays,5);
  assert.equal(SALAMENCE.windowDays,30);
  assert.equal(SALAMENCE.cooldownDays,21);
  assert.equal(SALAMENCE.pokemonId,373);
  assert.equal(MAX_THROWS,3);
  assert.equal(SHINY_ODDS,500);
  assert.ok(captureChance(373,'poke')>0&&captureChance(373,'ultra')>captureChance(373,'great'));
});
test('ECO-02 verified wins reset after attempt and expire from 30-day period',()=>{
  const proofs=[{day:3,mode:'cry'},{day:4,mode:'silhouette'},{day:5,mode:'description'},
    {day:5,mode:'cry'},{day:5,mode:'silhouette'}];
  assert.equal(eligible(proofs,6,0,SCENARIOS[1]),true);
  assert.equal(eligible(proofs,6,5,SCENARIOS[1]),false,'old wins must not count after a failed attempt');
  assert.equal(eligible(proofs,40,0,SCENARIOS[1]),false,'old wins expire after 30 days');
  assert.equal(eligible(proofs,6,0,SCENARIOS[0]),false,'initial quest remains stricter');
});
test('ECO-02 event gates and assumptions are explicitly hypothetical',()=>{
  assert.equal(isWeekend(1),true);
  assert.equal(isWeekend(2),true);
  assert.equal(isWeekend(3),false);
  assert.equal(SCENARIOS.length,6);
  assert.equal(SCENARIOS[0].gate,'always');
  assert.equal(SCENARIOS[5].onlyOnce,true);
  assert.equal(ASSUMPTIONS.randomEventDailyChance,0.15);
});
test('ECO-02 seeded replay, cooldown ceilings, no invented Pokédollar charges',()=>{
  const opts={players:1200,seed:20261106,horizon:90};
  assert.deepEqual(compare(opts),compare(opts));
  for(const r of compare(opts)){
    assert.ok(r.retries<=opts.players*4,'21-day cooldown permits at most 4 retries in 90 days');
    assert.ok(r.captures<=opts.players);
    assert.ok(r.playersRetriedPct>=0&&r.playersRetriedPct<=100);
    assert.ok(r.ballsUsedPerAccount>=0&&r.ballsUsedPerAccount<=12);
    assert.equal(r.actualPokedollarsCharged,0);
    assert.equal(r.expectedNewShinyRolls,r.retries/SHINY_ODDS);
    assert.ok(r.medianDaysToFirstRetry===null||r.medianDaysToFirstRetry>=21);
  }
  assert.throws(()=>simulate({players:0}),/invalid_simulation_parameters/);
  assert.throws(()=>simulate({players:100,activeDayChance:-1}),/invalid_simulation_parameters/);
});
