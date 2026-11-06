'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createBallService, initBallsDb, EXP_CHESTS} = require('../lib/poke-balls');

const dbTest = {skip:!process.env.QA_DATABASE_URL,timeout:60000};
const WEEK = '2026-11-02';
const source = (tier,slot)=>'exp:'+WEEK+':'+tier+':'+slot;

async function withDatabase(work) {
  const {Pool}=require('pg');
  const schema='eco04_'+randomUUID().replaceAll('-','');
  const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});
  let db;
  try {
    await admin.query('CREATE SCHEMA '+schema);
    db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:8});
    await initBallsDb(db);
    return await work(db);
  } finally {
    if(db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');
    await admin.end();
  }
}
async function play(db,key) {
  for(const source of ['mode:quiz','mode:pixel'])
    await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,$3,'poke') ON CONFLICT DO NOTHING",
      [key,WEEK,source]);
}
async function reachAllTiers(db,key) {
  await play(db,key);
  for(let i=0;i<6;i++) await play(db,'guest:eco04-community-'+i);
}
async function chestRows(db,identity) {
  return (await db.query("SELECT source,ball,to_char(day,'YYYY-MM-DD') AS day FROM ball_gains WHERE identity=$1 AND source LIKE $2 ORDER BY source,day",
    [identity,'exp:'+WEEK+':%'])).rows;
}

test('ECO-04: the original chest denominations and three weekly tiers stay unchanged',()=>{
  assert.deepEqual(EXP_CHESTS,{25:['poke','poke'],50:['great','poke'],75:['great','great']});
});

test('ECO-04 PostgreSQL: partial legacy chest is recoverable, atomic and never paid twice across days',dbTest,()=>withDatabase(async db=>{
  let now=new Date('2026-11-03T12:00:00Z');
  const me={key:'user:eco04',guestKey:'guest:eco04',accountId:'eco04'};
  const service=createBallService({db,clock:()=>now,secret:'test-eco04',randomInt:()=>1});
  await reachAllTiers(db,me.key);
  // A previous interrupted import wrote only the first of a 25% chest's 2 Balls.
  await db.query("INSERT INTO ball_gains(identity,day,source,ball,account_id) VALUES($1,$2,$3,'poke',$4)",
    [me.key,WEEK,source(25,1),me.accountId]);
  let st=(await service.expedition(me)).expedition;
  assert.equal(st.pct,100);
  assert.deepEqual(st.chests.map(c=>[c.tier,c.remainingBalls,c.claimed,c.canClaim]),
    [[25,1,false,true],[50,2,false,true],[75,2,false,true]]);
  // A failure on the fourth slot must roll back *every* attempted grant.
  await db.query("ALTER TABLE ball_gains ADD CONSTRAINT eco04_fail CHECK(source <> '"+source(50,2)+"')");
  await assert.rejects(service.claimChests(me));
  assert.deepEqual((await chestRows(db,me.key)).map(r=>r.source),[source(25,1)]);
  await db.query('ALTER TABLE ball_gains DROP CONSTRAINT eco04_fail');

  const outcomes=await Promise.allSettled(Array.from({length:3},()=>service.claimChests(me)));
  const successful=outcomes.filter(o=>o.status==='fulfilled');
  const rejected=outcomes.filter(o=>o.status==='rejected');
  assert.equal(successful.length,1,'only one of the parallel attempts may claim the remaining slots');
  assert.equal(rejected.length,2);
  assert.ok(rejected.every(o=>o.reason.code==='no_chest'));
  const payout=successful[0].value;
  assert.equal(payout.added.length,5,'only five missing Balls, not six new Balls');
  assert.deepEqual(payout.expedition.chests.map(c=>[c.claimed,c.remainingBalls]),
    [[true,0],[true,0],[true,0]]);
  const saved=await chestRows(db,me.key);
  assert.deepEqual(saved.map(r=>r.source),[source(25,1),source(25,2),source(50,1),source(50,2),source(75,1),source(75,2)]);
  assert.equal(new Set(saved.map(r=>r.source)).size,6);
  assert.deepEqual(saved.map(r=>r.ball).sort(),['great','great','great','poke','poke','poke'].sort());

  // Next day of the same expedition, even if the original claim happened on Tuesday.
  now=new Date('2026-11-06T12:00:00Z');
  st=(await service.expedition(me)).expedition;
  assert.ok(st.chests.every(c=>c.claimed&&!c.canClaim&&c.remainingBalls===0));
  await assert.rejects(service.claimChests(me),/no_chest/);
  assert.deepEqual(await chestRows(db,me.key),saved,'a lost HTTP response may not mint more Balls');

  // The next expedition must never reopen or mutate this week's historical prizes.
  now=new Date('2026-11-09T12:00:00Z');
  st=(await service.expedition(me)).expedition;
  assert.equal(st.week,'2026-11-09');
  assert.equal(st.progress,0);
  await assert.rejects(service.claimChests(me),/no_chest/);
  assert.deepEqual(await chestRows(db,me.key),saved,'unopened older prizes are not extended automatically');
}));

test('ECO-04 PostgreSQL: guest-to-account import never duplicates a chest source claimed on another day',dbTest,()=>withDatabase(async db=>{
  let now=new Date('2026-11-03T12:00:00Z');
  const me={key:'user:eco04-merge',guestKey:'guest:eco04-merge',accountId:'eco04-merge'};
  const service=createBallService({db,clock:()=>now,secret:'test-eco04'});
  await reachAllTiers(db,me.key);
  // Same chest slot existed as guest on Monday and as account on Tuesday.
  await db.query("INSERT INTO ball_gains(identity,day,source,ball,account_id) VALUES($1,$2,$3,'poke',$4)",
    [me.key,'2026-11-03',source(25,1),me.accountId]);
  await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,$3,'poke')",
    [me.guestKey,WEEK,source(25,1)]);
  let st=(await service.expedition(me)).expedition;
  assert.equal(st.chests[0].remainingBalls,1);
  let saved=await chestRows(db,me.key);
  assert.equal(saved.filter(r=>r.source===source(25,1)).length,1);
  assert.equal((await chestRows(db,me.guestKey)).length,0,'guest rows are adopted, not retained twice');
  const result=await service.claimChests(me);
  assert.equal(result.added.length,5);
  saved=await chestRows(db,me.key);
  assert.equal(saved.length,6);
  assert.equal(new Set(saved.map(r=>r.source)).size,6);
  await assert.rejects(service.claimChests(me),/no_chest/);
}));

test('ECO-04 PostgreSQL: other eligible player can claim the same tier independently',dbTest,()=>withDatabase(async db=>{
  const service=createBallService({db,clock:()=>new Date('2026-11-03T12:00:00Z'),secret:'test-eco04'});
  const first={key:'user:eco04-a',accountId:'eco04-a'};
  const second={key:'user:eco04-b',accountId:'eco04-b'};
  await reachAllTiers(db,first.key);
  await play(db,second.key);
  const [a,b]=await Promise.all([service.claimChests(first),service.claimChests(second)]);
  assert.equal(a.added.length,6);
  assert.equal(b.added.length,6);
  assert.equal((await chestRows(db,first.key)).length,6);
  assert.equal((await chestRows(db,second.key)).length,6);
}));
