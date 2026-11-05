"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const {initBallsDb}=require("../lib/poke-balls");
const {readEconomyStats,summarizeEconomy,checkPeriod}=require("../lib/economy-stats");
const {renderEconomySection}=require("../lib/admin-economy-section");
const {renderStatsDashboard}=require("../lib/admin-stats-dashboard");

test("economic totals add at the transaction grain and do not reinterpret stock as net flow",()=>{
  const s=summarizeEconomy({
    startDay:"2026-11-03",endDay:"2026-11-05",
    coinRows:[
      {category:"daily",gained:"300",spent:"0",operations:1},
      {category:"buy_poke",gained:"0",spent:"100",operations:1},
      {category:"other",gained:"120",spent:"0",operations:1}
    ],
    ballRows:[{category:"daily",ball:"poke",awarded:"2"},{category:"shop",ball:"great",awarded:"3"}],
    wildRows:[
      {kind:"wild",status:"caught",shiny:true,ball:"poke",encounters:1,attempted:1,poke:"1",great:"0",ultra:"0"},
      {kind:"wild",status:"released",shiny:false,ball:"great",encounters:1,attempted:1,poke:"1",great:"1",ultra:"0"},
      {kind:"wild",status:"traded",shiny:false,ball:"ultra",encounters:1,attempted:1,poke:"0",great:"0",ultra:"1"},
      {kind:"wild",status:"skipped",shiny:true,ball:null,encounters:2,attempted:0,poke:"0",great:"0",ultra:"0"},
      {kind:"legend",status:"open",shiny:false,ball:null,encounters:1,attempted:0,poke:"0",great:"0",ultra:"0"}
    ],actors:3
  });
  assert.deepEqual([s.coins.gained,s.coins.spent,s.coins.net],[420,100,320]);
  assert.deepEqual([s.balls.awarded,s.balls.byType.poke,s.balls.byType.great],[5,2,3]);
  assert.deepEqual([s.wild.encounters,s.wild.caught,s.wild.skipped,s.wild.open,s.wild.special],[6,3,2,1,1]);
  assert.deepEqual([s.wild.shinySeen,s.wild.shinyCaught,s.wild.throws,s.wild.successPerThrow],[3,1,4,75]);
  assert.deepEqual(s.wild.capturedWith,{poke:1,great:1,ultra:1});
  const html=renderEconomySection(s);
  for(const label of ["Économie et captures","Pokédollars crédités","Shinies capturés",
      "Du <b>03/11/2026","Captures par lancer","Achats · Poké Balls","Boutique"]) assert.ok(html.includes(label),label);
  assert.ok(!html.includes("user:")&&!html.includes("account_id"));
  assert.match(renderEconomySection(null),/Mesures indisponibles/);
  const board=renderStatsDashboard({days:3,endDay:"2026-11-05",metrics:[],uniqueRows:[],rawRows:[],economy:s});
  assert.match(board,/Shinies capturés/);
});

test("date range validation rejects invalid and overly broad requests",()=>{
  for(const dates of [["2026-11-05","2026-11-04"],["2026-01-01","2026-12-31"],
    ["2026-02-30","2026-03-01"],["2026-11-01';DROP TABLE x;--","2026-11-05"]])
    assert.throws(()=>checkPeriod(...dates),/invalid_economy_period/);
  assert.doesNotThrow(()=>checkPeriod("2026-11-05","2026-11-05"));
  assert.doesNotThrow(()=>checkPeriod("2026-11-01","2026-11-03"));
});

test("only date-bound SELECTs are issued; no players or raw ledger entries are returned",async()=>{
  const queries=[];
  const db={query:async(sql,params)=>{
    queries.push({sql,params});
    if(sql.includes("FROM coin_ledger"))return {rows:[]};
    if(sql.includes("FROM ball_gains"))return {rows:[]};
    if(sql.includes("COUNT(DISTINCT identity)"))return {rows:[{actors:0}]};
    if(sql.includes("FROM wild_encounters"))return {rows:[]};
    throw Error("unrecognized query");
  }};
  const out=await readEconomyStats(db,"2026-11-01","2026-11-03");
  assert.deepEqual([out.coins.gained,out.coins.spent,out.wild.encounters,out.wild.successPerThrow],[0,0,0,null]);
  assert.equal(queries.length,4);
  for(const q of queries){
    assert.match(q.sql,/^\s*SELECT /);
    assert.deepEqual(q.params,["2026-11-01","2026-11-03"]);
    assert.doesNotMatch(q.sql,/INSERT INTO|DELETE FROM|UPDATE /);
    assert.match(q.sql,/\$1::date AND \$2::date/);
  }
  assert.equal(JSON.stringify(out).includes("identity"),false);
  assert.equal(JSON.stringify(out).includes("account_id"),false);
});

const sql={skip:!process.env.QA_DATABASE_URL,timeout:60000};
test("PostgreSQL: mixed money flows, re-exports and traded originals are not double counted",sql,async()=>{
  const {Pool}=require("pg"),schema="economy_"+randomUUID().replaceAll("-","");
  const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  try{
    await admin.query("CREATE SCHEMA "+schema);
    db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:"-c search_path="+schema,max:5});
    await initBallsDb(db);
    const d="2026-11-04";
    for(const [source,amount] of [["day:daily",300],["play:pixel",90],["release:19",15],["shop:poke:a",-100],
      ["shop:recharge:1",-100],["admin:gift",1000]]){
      await db.query("INSERT INTO coin_ledger(identity,account_id,day,source,amount) VALUES ('user:1','1',$1,$2,$3)",[d,source,amount]);
    }
    await db.query("INSERT INTO coin_ledger(identity,account_id,day,source,amount) VALUES ('user:1','1','2026-11-02','day:daily',7000)");
    for(const [source,ball] of [["gift","poke"],["mode:pixel","great"],["shop:abc:1","ultra"],["exp:2026-11-02:25:1","poke"]])
      await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES('user:1',$1,$2,$3)",[d,source,ball]);
    for(const [identity,kind,status,shiny,ball,throws,poke,great,ultra] of [
      ["user:1","wild","caught",true,"poke",1,1,0,0],
      ["user:1","wild","fled",false,null,3,2,1,0],
      ["user:2","wild","skipped",false,null,0,0,0,0],
      ["user:2","wild","traded",false,"ultra",1,0,0,1],
      ["user:5","legend","open",true,null,0,0,0,0],
      ["user:3","trade","caught",true,null,0,0,0,0],
      ["user:4","test_reset","fled",false,null,0,0,0,0]
    ]){
      await db.query("INSERT INTO wild_encounters(identity,day,pokemon_id,kind,status,shiny,ball,throws,used_poke,used_great,used_ultra) VALUES ($1,$2,10,$3,$4,$5,$6,$7,$8,$9,$10)",
        [identity,d,kind,status,shiny,ball,throws,poke,great,ultra]);
    }
    const before=(await db.query("SELECT COUNT(*)::int AS n FROM coin_ledger")).rows[0].n;
    const out=await readEconomyStats(db,"2026-11-03","2026-11-04");
    assert.deepEqual([out.coins.gained,out.coins.spent,out.coins.net],[1405,200,1205]);
    assert.deepEqual([out.balls.awarded,out.balls.byType.poke,out.balls.byType.great,out.balls.byType.ultra],[4,2,1,1]);
    assert.deepEqual([out.wild.encounters,out.wild.ordinary,out.wild.special,out.wild.actors],[5,4,1,3]);
    assert.deepEqual([out.wild.caught,out.wild.fled,out.wild.skipped,out.wild.open],[2,1,1,1]);
    assert.deepEqual([out.wild.shinySeen,out.wild.shinyCaught,out.wild.throws,out.wild.successPerThrow],[2,1,5,40]);
    assert.equal(out.wild.capturedWith.ultra,1);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM coin_ledger")).rows[0].n,before,"read-only analytics");
  }finally{
    if(db)await db.end();
    await admin.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE").catch(()=>{});
    await admin.end();
  }
});
