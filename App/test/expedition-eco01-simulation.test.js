'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EXPEDITIONS,captureChance}=require('../lib/poke-balls');
const {SCENARIOS,STRATEGIES,playerDays,exactChance,simulate,compare,assertEngineConstraints}
 =require('../tools/simulate-expedition-eco01');
test('ECO-01 simulation uses actual server capture formula and current expedition species',()=>{
 assert.doesNotThrow(assertEngineConstraints);
 assert.deepEqual(EXPEDITIONS.map(e=>e.legend),[380,485,639,785,894,1001]);
 assert.ok(Math.abs(exactChance(380,STRATEGIES.poke.first)-
  (1-(1-captureChance(380,'poke'))**3))<1e-12);
 assert.ok(exactChance(1001,STRATEGIES.ultra.first)>exactChance(380,STRATEGIES.ultra.first));
});
test('ECO-01 explicitly hypothetical day distribution sums to 100',()=>{
 const counts={2:0,3:0,4:0,5:0};
 for(let i=0;i<100;i++)counts[playerDays(i)]++;
 assert.deepEqual(counts,{2:50,3:25,4:15,5:10});
});
test('ECO-01 deterministic replay, encounter ceiling and resource limits',()=>{
 const args={players:6000,seed:20261106};
 assert.deepEqual(compare(args),compare(args));
 for(const r of compare(args)){
  assert.equal(r.meetings,r.players+r.retries);
  assert.equal(r.captured,r.firstCaptures+r.secondCaptures);
  assert.ok(r.retries<=r.players-r.firstCaptures);
  assert.ok(r.meetings<=r.players*2);
  assert.ok(r.ballsPerPlayer>=0&&r.ballsPerPlayer<=6);
 }
 assert.throws(()=>simulate({players:601}),/players_must/);
});
test('ECO-01 controls: baseline and stricter participation, fee never creates odds',()=>{
 for(const strategy of Object.values(STRATEGIES)){
  const rows=SCENARIOS.map(scenario=>simulate({players:60000,seed:20261106,scenario,strategy}));
  assert.equal(rows[0].meetings,60000);
  assert.equal(rows[0].retries,0);
  assert.ok(rows[1].retries>=rows[2].retries);
  assert.ok(rows[2].retries>=rows[3].retries);
  assert.equal(rows[2].meetings,rows[4].meetings);
  assert.equal(rows[2].captured,rows[4].captured);
  assert.ok(rows[4].hypotheticalFeeTotal>0);
  assert.ok(rows[1].captured>=rows[0].captured);
 }
});
