"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {randomUUID}=require("node:crypto");
const {SALAMENCE,statusForSalamence,verifyDreamAnswer}=require("../lib/prestige-quests");
const {createBallService,initBallsDb,WILD_POOL,EXPEDITIONS}=require("../lib/poke-balls");
function shiftDay(day,n){const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
const ready={days:5,lineageIds:[371],wins:{cry:3,silhouette:3,description:3}};
test("Draby quest: captured lineage, three verified themed modes and five distinct days",()=>{
  const none=statusForSalamence({},"2026-11-04",shiftDay);
  assert.deepEqual(none.needs,{lineage:true,days:5,modes:{cry:3,silhouette:3,description:3}});
  assert.equal(none.eligible,false);
  assert.deepEqual(SALAMENCE.lineageIds,[371,372]);
  assert.deepEqual([SALAMENCE.windowDays,SALAMENCE.cooldownDays],[30,21]);
  assert.equal(statusForSalamence({...ready,lineageIds:[]},"2026-11-04",shiftDay).eligible,false);
  assert.equal(statusForSalamence({...ready,days:4},"2026-11-04",shiftDay).eligible,false);
  assert.equal(statusForSalamence({...ready,wins:{cry:2,silhouette:3,description:3}},"2026-11-04",shiftDay).eligible,false);
  assert.equal(statusForSalamence({...ready,lineageIds:[372]},"2026-11-04",shiftDay).eligible,true);
  assert.equal(statusForSalamence(ready,"2026-11-04",shiftDay).eligible,true);
  const cooldown=statusForSalamence({...ready,lastAttemptDay:"2026-11-03"},"2026-11-04",shiftDay);
  assert.deepEqual([cooldown.cooldown,cooldown.nextAttemptDay,cooldown.eligible],[true,"2026-11-24",false]);
  assert.equal(statusForSalamence({...ready,lastAttemptDay:"2026-11-03"},"2026-11-24",shiftDay).eligible,true);
});
test("riddle is a narrative gate, never a substitute for verified progress",()=>{
  assert.equal(verifyDreamAnswer("Drackhaus"),true);
  assert.equal(verifyDreamAnswer("  DRACKHAUS  "),true);
  for(const answer of ["Draby","Drattak","", "x".repeat(200)])assert.equal(verifyDreamAnswer(answer),false);
});
test("Drattak remains outside wild grass and weekly expeditions",()=>{
  assert.equal(WILD_POOL.includes(373),false);
  assert.equal(EXPEDITIONS.some(e=>e.legend===373),false);
  assert.equal(new Set([...WILD_POOL,...EXPEDITIONS.map(e=>e.legend),373]).size,852);
});
test("quest clues are gated by real mode progress and riddle appears after completion",()=>{
  const script=fs.readFileSync(path.join(__dirname,"../src/script.10xzb.expedition.js"),"utf8");
  const start=script.indexOf("function drattakPrestigeHtml() {"),end=script.indexOf("function meetPrestigeDrattak() {",start);
  assert.ok(start>=0&&end>start);
  const ctx={drattakPrestigeState:{needsAccount:false,hasLineage:false,lineageIds:[],
    wins:{cry:0,silhouette:0,description:0},days:0,
    goal:{days:5,modes:{cry:3,silhouette:3,description:3}},cooldown:false,available:false,
    chances:{poke:23,great:32,ultra:46}},escapeHtml:String};
  vm.createContext(ctx);
  vm.runInContext(script.slice(start,end)+"\nthis.render=drattakPrestigeHtml;",ctx);
  let html=ctx.render();
  assert.match(html,/capture un Draby ou un Drackhaus/);
  assert.doesNotMatch(html,/Une silhouette immobile/);
  assert.doesNotMatch(html,/prestige-drattak-answer/);
  ctx.drattakPrestigeState={...ctx.drattakPrestigeState,hasLineage:true,lineageIds:[371],
    wins:{cry:3,silhouette:3,description:3},days:5,available:true};
  html=ctx.render();
  assert.match(html,/Une silhouette immobile/);
  assert.match(html,/Ce Pokémon n’est ni le premier rêveur/);
  assert.match(html,/prestige-drattak-answer/);
  assert.match(html,/meetPrestigeDrattak/);
  assert.doesNotMatch(html,/Drackhaus a été capturé/);
});
test("PostgreSQL: verified play and captured Draby allow one real capture attempt, not an automatic Pokémon",{
  skip:!process.env.QA_DATABASE_URL,timeout:60000
},async()=>{
  const {Pool}=require("pg"),schema="prestige_"+randomUUID().replaceAll("-","");
  const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  try{
    await admin.query("CREATE SCHEMA "+schema);
    db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:"-c search_path="+schema,max:4});
    let now=new Date("2026-11-04T11:00:00Z");
    const pokemon=[{id:6,name:"Dracaufeu",generation:1,weight:5},{id:25,name:"Pikachu",generation:1,weight:20},{id:133,name:"Évoli",generation:2,weight:8}];
    const service=createBallService({db,clock:()=>now,pokemon,secret:"qa-prestige-secret",randomInt:n=>0,random:()=>0.99});
    await initBallsDb(db);
    const me={key:"user:prestige",guestKey:"guest:prestige",accountId:"prestige"};
    const guest={key:"guest:other",guestKey:"guest:other",accountId:null};
    const who={key:"user:proof",guestKey:"guest:proof",accountId:"proof"};
    const s=(await service.arcadeStart(who,{mode:"weight",startId:randomUUID(),gens:[1]})).arcade;
    const evidence=await service.arcadeAnswer(who,{mode:"weight",sessionId:s.sessionId,round:s.round,choice:25,score:99999,result:"win"});
    assert.equal(evidence.arcade.score,1);
    assert.equal((await service.arcadeAnswer(who,{mode:"weight",sessionId:s.sessionId,round:s.round,choice:25})).replayed,true);
    const proof=(await db.query("SELECT mode FROM prestige_verified_wins WHERE identity=$1",[who.key])).rows;
    assert.deepEqual(proof.map(r=>r.mode),["weight"]);
    await assert.rejects(service.meetPrestige(guest,{answer:"Drackhaus"}),/account_required/);
    await assert.rejects(service.meetPrestige(me,{answer:"Drackhaus",completed:true}),/prestige_not_ready/);
    await db.query("INSERT INTO wild_encounters(identity,account_id,day,pokemon_id,shiny,status) VALUES($1,$2,$3,371,false,'caught')",
      [me.key,me.accountId,"2026-10-01"]);
    const events=[
      ["2026-10-31","cry"],["2026-10-31","silhouette"],
      ["2026-11-01","description"],["2026-11-01","cry"],
      ["2026-11-02","silhouette"],["2026-11-02","description"],
      ["2026-11-03","cry"],["2026-11-03","silhouette"],["2026-11-04","description"]
    ];
    for(const [day,mode] of events)await db.query(
      "INSERT INTO prestige_verified_wins(identity,account_id,day,mode) VALUES($1,$2,$3,$4)",
      [me.key,me.accountId,day,mode]);
    let status=(await service.prestige(me)).prestige;
    assert.deepEqual([status.days,status.wins.cry,status.wins.silhouette,status.wins.description,status.hasLineage,status.available],
      [5,3,3,3,true,true]);
    await assert.rejects(service.meetPrestige(me,{answer:"Draby"}),/prestige_riddle_wrong/);
    assert.equal((await service.prestige(me)).prestige.available,true);
    await assert.rejects(service.meetPrestige(me,{answer:"Drackhaus"}),/prestige_need_three_balls/);
    await service.state(me);
    const started=await service.meetPrestige(me,{answer:"Drackhaus"});
    assert.deepEqual([started.encounter.pokemonId,started.encounter.prestige,started.encounter.legend,started.encounter.throws],[373,true,false,0]);
    assert.equal(started.wild.open.id,started.encounter.id);
    await assert.rejects(service.meetPrestige(me,{answer:"Drackhaus"}),/prestige_cooldown/);
    for(let i=0;i<3;i++)await service.throwBall(me,{ball:"poke"});
    assert.equal((await service.collection(me)).captures.some(c=>c.id===373),false);
    status=(await service.prestige(me)).prestige;
    assert.deepEqual([status.days,status.wins.cry||0,status.lastStatus,status.cooldown],[0,0,"fled",true]);
    now=new Date("2026-12-10T11:00:00Z");
    status=(await service.prestige(me)).prestige;
    assert.equal(status.cooldown,false);
    assert.equal(status.available,false);
  }finally{
    if(db)await db.end();
    await admin.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE");
    await admin.end();
  }
});
test("account deletion clears server-held prestige progression",()=>{
  const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
  assert.ok(server.includes('"arcade_runs", "prestige_verified_wins"'));
});
test("network response loss can resume the single open prestige encounter",()=>{
  const script=fs.readFileSync(path.join(__dirname,"../src/script.10xzb.expedition.js"),"utf8");
  assert.match(script,/\["prestige_cooldown","encounter_open"\]\.includes\(data\?\.error\)/);
  assert.match(script,/refreshBalls\(\{announce:false\}\)/);
  assert.match(script,/current\?\.wild\?\.open\?\.prestige/);
  assert.match(script,/renderWildEncounter\(current\)/);
});


test("a captured Drattak stays visible even when its album mission was never claimed",()=>{
  const adventure=fs.readFileSync(path.join(__dirname,"../src/script.10.adventure.js"),"utf8");
  const wild=fs.readFileSync(path.join(__dirname,"../src/script.10xz.wild-grass.js"),"utf8");
  const s1=adventure.indexOf("function normalizeDiscoveries(");
  const s2=adventure.indexOf("function addDiscovery(",s1);
  const s3=adventure.indexOf("function historyDiscovery(",s2);
  const w1=wild.indexOf("function wildSyncAlbum(");
  const w2=wild.indexOf("function loadWildCaptures(",w1);
  assert.ok([s1,s2,s3,w1,w2].every(n=>n>=0));
  const pokemon={id:373,name:"Drattak",gen:3,type1:"Dragon",type2:"Vol"};
  let saves=0;
  const ctx={
    Date,Math,Number,Array,Object,Set,Map,Boolean,String,
    POKEMON_BY_ID:new Map([[373,pokemon]]),
    playerProfile:{discoveries:{}},
    wildPokemon:(id)=>Number(id)===373?pokemon:null,
    isAlbumMissionGated:()=>true,
    isAlbumMissionClaimedForPokemon:()=>false,
    saveProfile:()=>{saves++;}
  };
  vm.createContext(ctx);
  vm.runInContext("let wildCaptures=null;\n"+adventure.slice(s1,s3)+"\n"+
    wild.slice(w1,w2)+"\nthis.sync=wildSyncAlbum;this.captureState=()=>wildCaptures;",ctx);
  ctx.sync([{id:373,normal:1,shiny:0}]);
  assert.equal(ctx.playerProfile.discoveries[373].source,"capture");
  assert.equal(ctx.captureState()[373].normal,1);
  assert.equal(saves,1);
  const clean=ctx.normalizeDiscoveries(ctx.playerProfile.discoveries);
  assert.equal(clean[373].source,"capture","cross-device profile normalization preserves trusted capture origin");
  ctx.sync([{id:373,normal:1,shiny:0}]);
  assert.equal(saves,1,"sync never manufactures a duplicate discovery");
});
