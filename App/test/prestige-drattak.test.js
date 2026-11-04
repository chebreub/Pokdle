"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { SALAMENCE, statusForSalamence } = require("../lib/prestige-quests");
const { createBallService, initBallsDb, WILD_POOL, EXPEDITIONS } = require("../lib/poke-balls");

function shiftDay(day, n) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
test("a mission claim can never unlock a prestige Ball capture without server-verified wins", () => {
  const base = statusForSalamence({days:0,wins:0,modes:0}, "2026-11-04", shiftDay);
  assert.deepEqual(base.needs,{days:14,wins:28,modes:5});
  assert.equal(base.eligible,false);
  assert.equal(SALAMENCE.pokemonId,373);
  const almost = statusForSalamence({days:14,wins:28,modes:4}, "2026-11-04", shiftDay);
  assert.equal(almost.eligible,false,"four unique verified modes are not enough");
  const done = statusForSalamence({days:14,wins:28,modes:5},"2026-11-04",shiftDay);
  assert.equal(done.eligible,true);
  const cool = statusForSalamence({days:14,wins:28,modes:5,lastAttemptDay:"2026-11-03"},"2026-11-04",shiftDay);
  assert.equal(cool.cooldown,true);
  assert.equal(cool.nextAttemptDay,"2026-11-24");
  assert.equal(cool.eligible,false);
  const readyAgain = statusForSalamence({days:14,wins:28,modes:5,lastAttemptDay:"2026-11-03"},"2026-11-24",shiftDay);
  assert.equal(readyAgain.eligible,true);
});
test("Drattak is excluded from all wild grass; a special encounter is the only available server capture path", () => {
  assert.equal(WILD_POOL.includes(373),false);
  assert.equal(EXPEDITIONS.some(e=>e.legend===373),false);
  assert.equal(new Set([...WILD_POOL,...EXPEDITIONS.map(e=>e.legend),373]).size,852);
});
test("PostgreSQL: verified win records across 14 days are required, account-bound, and one prestige encounter per cooldown",{skip:!process.env.QA_DATABASE_URL,timeout:45000},async()=>{
  const {Pool}=require("pg"),{randomUUID}=require("node:crypto");
  const schema="prestige_"+randomUUID().replaceAll("-","");
  const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});
  let db;
  try {
    await admin.query("CREATE SCHEMA "+schema);
    db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:"-c search_path="+schema,max:4});
    let now=new Date("2026-11-04T11:00:00Z");
    const pokemon=[{id:6,name:"Dracaufeu",generation:1,weight:5},{id:25,name:"Pikachu",generation:1,weight:20},{id:133,name:"Évoli",generation:2,weight:8}];
    const service=createBallService({db,clock:()=>now,pokemon,secret:"qa-prestige-secret",randomInt:n=>0,random:()=>0.99});
    await initBallsDb(db);
    // Exercise a genuine completed server round: an invented client result cannot
    // create a prestige win, and repeating the same answer must stay idempotent.
    const proofWho={key:"user:proof",guestKey:"guest:proof",accountId:"proof"};
    const initial=(await service.arcadeStart(proofWho,{mode:"weight",startId:randomUUID(),gens:[1]})).arcade;
    const evidence=await service.arcadeAnswer(proofWho,{mode:"weight",sessionId:initial.sessionId,
      round:initial.round,choice:25,result:"win",score:999999});
    assert.equal(evidence.arcade.score,1);
    const replay=await service.arcadeAnswer(proofWho,{mode:"weight",sessionId:initial.sessionId,round:initial.round,choice:25});
    assert.equal(replay.replayed,true);
    const trusted=await db.query("SELECT day,mode FROM prestige_verified_wins WHERE identity=$1",[proofWho.key]);
    assert.deepEqual(trusted.rows.map(r=>r.mode),["weight"]);
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM prestige_verified_wins WHERE identity=$1",["guest:proof"])).rows[0].n,0);
    const me={key:"user:prestige",guestKey:"guest:prestige",accountId:"prestige"};
    const guest={key:"guest:other",guestKey:"guest:other",accountId:null};
    let s=(await service.prestige(me)).prestige;
    assert.equal(s.available,false);
    assert.equal(s.days,0);
    await assert.rejects(service.meetPrestige(me,{completed:true,pokemonId:373}),/prestige_not_ready/);
    await assert.rejects(service.meetPrestige(guest),/account_required/);
    // A profile/mission claim never writes these rows; only verified arcade
    // server outcomes can. Test database state is seeded as that trusted evidence.
    const modes=["normal","quiz","pixel","shiny","weight"];
    for(let i=0;i<14;i++){
      const day=shiftDay("2026-10-21",i);
      for(const mode of [modes[i%5],modes[(i+1)%5]]) {
        await db.query("INSERT INTO prestige_verified_wins(identity,account_id,day,mode) VALUES($1,$2,$3,$4)",[me.key,me.accountId,day,mode]);
      }
    }
    s=(await service.prestige(me)).prestige;
    assert.deepEqual([s.days,s.wins,s.modes,s.available],[14,28,5,true]);
    await assert.rejects(service.meetPrestige(me),/no_balls/);
    await service.state(me); // Grants normal welcome Balls, never a prestige capture
    let started=await service.meetPrestige(me);
    assert.deepEqual([started.encounter.pokemonId,started.encounter.prestige,started.encounter.legend,started.encounter.throws],[373,true,false,0]);
    assert.equal(started.wild.open.id,started.encounter.id);
    await assert.rejects(service.meetPrestige(me),/prestige_cooldown/);
    for(let i=0;i<3;i++)started=await service.throwBall(me,{ball:"poke"});
    assert.equal(started.encounter.status,"fled");
    assert.equal((await service.collection(me)).captures.some(c=>c.id===373),false,"a completed mission alone never owns Drattak");
    s=(await service.prestige(me)).prestige;
    assert.deepEqual([s.days,s.wins,s.lastStatus,s.cooldown],[0,0,"fled",true]);
    now=new Date("2026-12-10T11:00:00Z");
    s=(await service.prestige(me)).prestige;
    assert.equal(s.cooldown,false);
    assert.equal(s.available,false,"a new window requires new verified wins after the last meeting");
  } finally {
    if(db) await db.end();
    await admin.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE");
    await admin.end();
  }
});

test("prestige play evidence is erased when a player deletes their account",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const source=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
  assert.match(source,/"prestige_verified_wins"\]\.map\(\(table\) => \[table, `DELETE FROM \$\{table\} WHERE account_id = \$1 OR identity = \$2`/);
});
