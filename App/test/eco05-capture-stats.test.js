"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const {randomUUID} = require("node:crypto");
const {createBallService,initBallsDb} = require("../lib/poke-balls");
const {readEconomyStats,summarizeCaptureRows} = require("../lib/economy-stats");
const {buildEconomyExport} = require("../lib/economy-export");
const {renderEconomySection} = require("../lib/admin-economy-section");

test("ECO-05: one-dimensional anonymized cohorts suppress sparse species and reject invalid groups",()=>{
  const result=summarizeCaptureRows([
    {dimension:"rules",segment:"shiny-1-150",throws:"2",catches:"1"},
    {dimension:"rules",segment:"shiny-1-500",throws:"1",catches:"1"},
    {dimension:"ball",segment:"poke",throws:"3",catches:"2"},
    {dimension:"throw_order",segment:"1",throws:"2",catches:"1"},
    {dimension:"throw_order",segment:"2",throws:"1",catches:"1"},
    {dimension:"pokemon",segment:"25",throws:"9",catches:"1"},
    {dimension:"pokemon",segment:"10",throws:"10",catches:"2"},
    {dimension:"pokemon",segment:"user:private",throws:"100",catches:"50"},
    {dimension:"encounter_kind",segment:"account_id",throws:"10",catches:"5"},
    {dimension:"rules",segment:"shiny-1-500",throws:"-2",catches:"1"}
  ]);
  assert.equal(result.available,true);
  assert.deepEqual([result.throws,result.catches,result.speciesSuppressed],[3,2,1]);
  assert.deepEqual(result.species,[{pokemonId:10,throws:10,catches:2}]);
  assert.equal(result.kinds.length,0);
  assert.equal(JSON.stringify(result).includes("user:private"),false);
});

test("ECO-05: private admin report presents distinct cohorts, not official odds or player records",()=>{
  const capture=summarizeCaptureRows([
    {dimension:"rules",segment:"shiny-1-500",throws:13,catches:3},
    {dimension:"ball",segment:"poke",throws:13,catches:3},
    {dimension:"pokemon",segment:"10",throws:13,catches:3}
  ]);
  const econ={startDay:"2026-11-05",endDay:"2026-11-06",
    coins:{gained:0,spent:0,net:0,sources:[]},
    balls:{awarded:0,byType:{poke:0,great:0,ultra:0},sources:[]},
    wild:{encounters:0,ordinary:0,special:0,attempted:0,caught:0,
      fled:0,skipped:0,open:0,shinySeen:0,shinyCaught:0,actors:0,
      throws:0,used:{poke:0,great:0,ultra:0},
      capturedWith:{poke:0,great:0,ultra:0},successPerThrow:null},
    capture};
  const exportJson=buildEconomyExport(econ);
  assert.equal(exportJson.captureDiagnostics.recordedThrows,13);
  assert.equal(exportJson.captureDiagnostics.byRuleVersion[0].group,"shiny-1-500");
  assert.deepEqual(exportJson.captureDiagnostics.speciesWithAtLeast10Throws,
    [{pokemonId:10,throws:13,caught:3}]);
  const html=renderEconomySection(econ);
  assert.match(html,/Observer les captures par règles/);
  assert.match(html,/1\/500/);
  assert.match(html,/mesures prospectives/i);
  assert.doesNotMatch(JSON.stringify(exportJson),/action_id|account_id|guest:|user:/);
});

test("ECO-05: PostgreSQL real throw, replay and old/new rule cohorts remain consistent",{
  skip:!process.env.QA_DATABASE_URL,timeout:60000
},async()=>{
  const {Pool}=require("pg"),schema="eco05_"+randomUUID().replaceAll("-","");
  const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});
  let db;
  try{
    await admin.query("CREATE SCHEMA "+schema);
    db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:"-c search_path="+schema,max:5});
    await initBallsDb(db);
    let now=new Date("2026-11-04T12:00:00Z");
    const rolls=[.99,0,0];
    const service=createBallService({db,clock:()=>now,randomInt:()=>1,random:()=>rolls.length?rolls.shift():0});
    const old={key:"guest:eco05old",guestKey:"guest:eco05old",accountId:null};
    const newest={key:"guest:eco05new",guestKey:"guest:eco05new",accountId:null};
    await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,'gift','poke'),($1,$2,'mode:quiz','poke')",
      [old.key,"2026-11-04"]);
    const encounter=(await service.encounter(old)).encounter;
    const actionId=randomUUID();
    const body={ball:"poke",actionId,encounterId:encounter.id,expectedThrows:0};
    let attempt=await service.throwBall(old,body);
    assert.deepEqual([attempt.result.caught,attempt.encounter.throws],[false,1]);
    const replay=await service.throwBall(old,body);
    assert.equal(replay.replayed,true,"receipt replay cannot increment a metric");
    attempt=await service.throwBall(old,{ball:"poke",actionId:randomUUID(),
      encounterId:encounter.id,expectedThrows:1});
    assert.deepEqual([attempt.result.caught,attempt.encounter.status],[true,"caught"]);
    now=new Date("2026-11-05T12:00:00Z");
    await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,'gift','poke')",
      [newest.key,"2026-11-05"]);
    const fresh=(await service.encounter(newest)).encounter;
    attempt=await service.throwBall(newest,{ball:"poke",actionId:randomUUID(),
      encounterId:fresh.id,expectedThrows:0});
    assert.equal(attempt.result.caught,true);
    const counts=await db.query("SELECT dimension,segment,SUM(throws)::int AS n,SUM(catches)::int AS caught FROM capture_stats_daily GROUP BY dimension,segment");
    const rows=counts.rows;
    const cell=(dim,seg)=>rows.find(x=>x.dimension===dim && x.segment===seg);
    assert.deepEqual([cell("rules","shiny-1-150").n,cell("rules","shiny-1-500").n],[2,1]);
    assert.deepEqual([cell("rules","shiny-1-150").caught,cell("rules","shiny-1-500").caught],[1,1]);
    assert.equal(cell("throw_order","1").n,2);
    assert.equal(cell("throw_order","2").n,1);
    assert.equal(cell("ball","poke").n,3);
    assert.equal(cell("encounter_kind","wild").n,3);
    const result=await readEconomyStats(db,"2026-11-04","2026-11-05");
    assert.deepEqual([result.capture.throws,result.capture.catches,result.capture.available],[3,2,true]);
    assert.deepEqual([result.wild.throws,result.wild.caught],[3,2],"legacy counters still intact");
    assert.equal(result.capture.species.length,0,"sparse Pokémon do not escape into export");
    assert.equal(buildEconomyExport(result).captureDiagnostics.recordedThrows,3);
    const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='capture_stats_daily'",[schema])).rows.map(r=>r.column_name);
    for(const forbidden of ["identity","account_id","ip","action_id","encounter_id","user_id"])
      assert.ok(!columns.includes(forbidden),"forbid personal dimension: "+forbidden);
  }finally{
    if(db)await db.end();
    await admin.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE").catch(()=>{});
    await admin.end();
  }
});

test("ECO-05: capture works even when anonymous statistics become unavailable",{
  skip:!process.env.QA_DATABASE_URL,timeout:60000
},async()=>{
  const {Pool}=require("pg"),schema="eco05_fail_"+randomUUID().replaceAll("-","");
  const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});
  let db;
  try{
    await admin.query("CREATE SCHEMA "+schema);
    db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:"-c search_path="+schema,max:4});
    await initBallsDb(db);
    await db.query("DROP TABLE capture_stats_daily");
    const who={key:"guest:eco05fail",guestKey:"guest:eco05fail",accountId:null};
    await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,'2026-11-05','gift','poke')",[who.key]);
    const service=createBallService({db,clock:()=>new Date("2026-11-05T12:00:00Z"),randomInt:()=>1,random:()=>0});
    const first=(await service.encounter(who)).encounter;
    const result=await service.throwBall(who,{ball:"poke",actionId:randomUUID(),encounterId:first.id,expectedThrows:0});
    assert.equal(result.result.caught,true);
    assert.equal(result.bag.poke,0,"only one Ball spent despite metric outage");
    assert.equal((await db.query("SELECT status FROM wild_encounters WHERE id=$1",[first.id])).rows[0].status,"caught");
  }finally{
    if(db)await db.end();
    await admin.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE").catch(()=>{});
    await admin.end();
  }
});
