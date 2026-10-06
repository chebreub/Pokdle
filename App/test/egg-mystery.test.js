"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {eggWeek,parisDay,eggClues,compatibleWithClues,issueGuest,signedGuest,initEggDb,createEggService}=require("../lib/egg-mystery");
test("Egg resets at Paris midnight across both daylight saving changes",()=>{
  for(const [now,start,reset] of [
    ["2026-03-29T21:59:59Z","2026-03-23","2026-03-29T22:00:00.000Z"],
    ["2026-03-29T22:00:00Z","2026-03-30","2026-04-05T22:00:00.000Z"],
    ["2026-10-25T22:59:59Z","2026-10-19","2026-10-25T23:00:00.000Z"],
    ["2026-10-25T23:00:00Z","2026-10-26","2026-11-01T23:00:00.000Z"]
  ]){const week=eggWeek(new Date(now));assert.equal(week.start,start);assert.equal(week.resetAt,reset);}
  assert.equal(parisDay(new Date("2026-10-06T22:00:00Z")),"2026-10-07");
});
test("Egg guest identity is signed and tampering is rejected",()=>{
  const guest=issueGuest("secret");assert.equal(signedGuest("secret",guest.cookie),guest.id);
  assert.equal(signedGuest("other-secret",guest.cookie),null);assert.equal(signedGuest("secret","attacker"),null);
  assert.equal(signedGuest("secret",guest.cookie.slice(0,-1)+(guest.cookie.endsWith("0")?"1":"0")),null);
});
test("Clues unlock only at 100-guess thresholds and compatible candidates obey them",()=>{
  const p={gen:1,type1:"Eau",color:"Bleu",habitat:"Mer",stage:2};
  assert.equal(eggClues(p,99).length,0);assert.equal(eggClues(p,100).length,1);assert.equal(eggClues(p,199).length,1);assert.equal(eggClues(p,999).length,5);
  assert.equal(compatibleWithClues({...p,gen:2},eggClues(p,100)),false);
  assert.equal(compatibleWithClues({...p,type1:"Feu"},eggClues(p,100)),true);
  assert.equal(compatibleWithClues({...p,type1:"Feu"},eggClues(p,200)),false);
});
test("Egg PostgreSQL quotas, duplicate races, atomic winner/reward, rollback and weekly reset",{skip:!process.env.QA_DATABASE_URL},async()=>{
  const {Pool}=require("pg"),admin=new Pool({connectionString:process.env.QA_DATABASE_URL});
  const schema="egg_qa_"+crypto.randomUUID().replaceAll("-","");let db;
  try{
    await admin.query('CREATE SCHEMA "'+schema+'"');db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:"-c search_path="+schema});
    await db.query("CREATE TABLE users(discord_id text PRIMARY KEY,data jsonb NOT NULL DEFAULT '{}'::jsonb)");
    await initEggDb(db);await initEggDb(db);
    const pokemon=Array.from({length:250},(_,i)=>({id:i+1,name:"Pokemon "+(i+1),gen:i<151?1:2,type1:"Eau",color:"Bleu",habitat:"Mer",stage:1}));
    pokemon.push({id:10001,name:"Alternative",isAltForm:true,gen:1});
    let now=new Date("2026-10-06T12:00:00Z"),draw=0;
    const service=createEggService({db,pokemon,randomInt:n=>(draw++)%n,clock:()=>now});
    const guest={anonId:"guest-a",ipHash:"shared-ip"},account={...guest,playerId:"A",name:"Alice"};
    let state=await service.state(guest);const roundId=state.roundId;
    assert.equal(state.candidateIds.length,250);assert.equal(state.candidateIds.includes(10001),false);
    assert.equal(state.winner,null);assert.equal("secret_id" in state,false);assert.equal("secretId" in state,false);assert.deepEqual(state.clues,[]);
    const secret=Number((await db.query("SELECT secret_id FROM egg_rounds WHERE id=$1",[roundId])).rows[0].secret_id);
    const wrong=pokemon.filter(p=>p.id!==secret&&p.id<1000).slice(0,6).map(p=>p.id);
    await service.guess(guest,roundId,wrong[0]);
    await assert.rejects(service.guess({...guest,anonId:"cleared-cookie"},roundId,wrong[1]),e=>e.code==="quota_reached");
    await assert.rejects(service.guess(guest,roundId,wrong[0]),e=>e.code==="already_guessed");
    assert.equal((await service.state(account)).quota.remaining,1,"login grants one extra guess after the guest guess");
    await service.guess(account,roundId,wrong[1]);
    await assert.rejects(service.guess({...account,anonId:"another-device"},roundId,wrong[2]),e=>e.code==="quota_reached");
    const bob={playerId:"B",name:"Bob",anonId:"bob",ipHash:"shared-ip"};
    assert.equal((await service.state(bob)).quota.remaining,2,"accounts keep their own allowance on a shared network");
    const duplicate=await Promise.allSettled([service.guess(bob,roundId,wrong[2]),service.guess({playerId:"C",name:"Charlie",anonId:"c",ipHash:"ip-c"},roundId,wrong[2])]);
    assert.equal(duplicate.filter(r=>r.status==="fulfilled").length,1);
    assert.equal((await db.query("SELECT count(*)::int n FROM egg_guesses WHERE round_id=$1 AND pokemon_id=$2",[roundId,wrong[2]])).rows[0].n,1);
    now=new Date("2026-10-06T22:00:00Z");assert.equal((await service.state(guest)).quota.remaining,1,"Paris date resets quota");
    const prize=(await db.query("SELECT reward_id FROM egg_rounds WHERE id=$1",[roundId])).rows[0].reward_id;
    await db.query("INSERT INTO users(discord_id,data) VALUES($1,$2),($3,$2)",["winner1",JSON.stringify({profile:JSON.stringify({discoveries:{[prize]:{at:1}}})}),"winner2"]);
    const racers=[1,2].map(i=>({playerId:"winner"+i,name:"Winner "+i,anonId:"w"+i,ipHash:"win-ip"+i}));
    const winners=await Promise.allSettled(racers.map(who=>service.guess(who,roundId,secret)));
    assert.equal(winners.filter(r=>r.status==="fulfilled").length,1);
    const winner=winners.find(r=>r.status==="fulfilled").value;assert.equal(winner.correct,true);assert.notEqual(winner.reward.id,prize,"owned companion replaced");
    assert.equal((await db.query("SELECT count(*)::int n FROM egg_rewards WHERE round_id=$1",[roundId])).rows[0].n,1);
    state=await service.state(guest);assert.equal(state.solved,true);assert.equal("pokemon" in state.winner,false);assert.equal(state.feed.find(row=>row.correct).pokemon.id,secret);
    now=new Date("2026-10-11T22:00:00Z");state=await service.state(guest);assert.notEqual(state.roundId,roundId);assert.equal(state.solved,false);
    await assert.rejects(service.guess(guest,roundId,wrong[4]),e=>e.code==="round_changed");
    let r=(await db.query("SELECT * FROM egg_rounds WHERE id=$1",[state.roundId])).rows[0];
    await db.query("ALTER TABLE egg_rewards ADD CONSTRAINT rollback_probe CHECK (player_id <> 'fail')");
    await assert.rejects(service.guess({playerId:"fail",name:"Fail",anonId:"fail",ipHash:"fail"},state.roundId,Number(r.secret_id)));
    assert.equal((await db.query("SELECT found_at FROM egg_rounds WHERE id=$1",[state.roundId])).rows[0].found_at,null);
    assert.equal((await db.query("SELECT count(*)::int n FROM egg_guesses WHERE round_id=$1",[state.roundId])).rows[0].n,0);
    const guestWin=await service.guess(guest,state.roundId,Number(r.secret_id));assert.equal(guestWin.claimAfterLogin,true);
    await assert.rejects(service.claim({...account,anonId:"stolen-cookie"},state.roundId),e=>e.code==="not_winner");
    const claimed=await service.claim(account,state.roundId);assert.ok(claimed.reward.id);
    assert.deepEqual((await service.claim(account,state.roundId)).reward,claimed.reward,"claim is idempotent");
    await assert.rejects(service.claim({...account,playerId:"impostor"},state.roundId),e=>e.code==="not_winner");
    assert.equal((await service.rewards(account)).rewards.length,1);
    now=new Date("2026-10-18T22:00:00Z");state=await service.state(guest);r=(await db.query("SELECT * FROM egg_rounds WHERE id=$1",[state.roundId])).rows[0];
    const ids=pokemon.filter(p=>p.id!==Number(r.secret_id)&&p.id<1000).slice(0,100).map(p=>p.id);
    await db.query("INSERT INTO egg_guesses(round_id,pokemon_id,anon_id,ip_hash,day,username) SELECT $1,unnest($2::int[]),'fixture','fixture','2026-10-19','Anonyme'",[state.roundId,ids]);
    state=await service.state(guest);assert.equal(state.clues.length,1);assert.equal(state.eliminatedIds.length,100);assert.equal(state.feed.length,20);assert.equal(state.compatibleIds.includes(Number(r.secret_id)),true);
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');await admin.end();}
});
