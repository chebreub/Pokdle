"use strict";
const test=require("node:test"), assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const series=require("../lib/player-challenge-series");
const lib=require("../lib/player-challenges");
const playerIds=require("../lib/player-ids");
const {compareDaily}=require("../lib/daily-comparison");
const fs=require("node:fs"), path=require("node:path");
const root=path.join(__dirname,"..");
const catalog=Array.from({length:30},(_,i)=>({
  id:i+1,name:"Pokemon"+(i+1),gen:1,generation:1,type1:i%2?"Feu":"Eau",type2:null,
  color:"Bleu",habitat:"Ville",stage:1,height:1+i/10,weight:20+i,guessable:true
}));
const USERS=`CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER,xp INTEGER,photo_key TEXT,photo BYTEA)`;
const SCORES=`CREATE TABLE scores(discord_id TEXT NOT NULL,mode TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,
  username TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(discord_id,mode))`;
async function withSchema(work) {
  const {Pool}=require("pg");
  const schema="part02_"+randomUUID().replaceAll("-","");
  const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});
  let db;
  try{
    await admin.query("CREATE SCHEMA "+schema);
    db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:"-c search_path="+schema,max:6});
    await db.query(USERS);await db.query(SCORES);
    await db.query("INSERT INTO users(discord_id,username) VALUES ('A','Rival A'),('B','Rival B'),('C','Third')");
    await lib.ensureTables(db);
    playerIds.setPlayerIdSecret("part02-test-key");
    const push=[];
    const duels=lib.createPlayerChallenges({
      db,accountOfPid:playerIds.accountOfPid,playerPid:playerIds.playerPid,
      compare:compareDaily,pokemon:catalog,push:async(id,msg)=>{push.push({id,msg});return 1;}
    });
    await work({db,duels,push,pidB:playerIds.playerPid("B"),pidC:playerIds.playerPid("C")});
  }finally{
    if(db)await db.end();
    await admin.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE").catch(()=>{});
    await admin.end();
  }
}
test("PART-02: same-sequence series picks 10 unique Pokémon, validates generations and compares real attempts",()=>{
  assert.deepEqual(series.normalizeGens([3,1,3]),[1,3]);
  assert.equal(series.normalizeGens([0,1]),null);
  assert.equal(series.normalizeGens([]),null);
  const ids=series.pickSeries(catalog,[1],n=>n-1);
  assert.equal(ids.length,10);assert.equal(new Set(ids).size,10);
  const state=series.newProgress();
  assert.deepEqual(series.advance(state,"from",0,ids[0],false,ids,new Map(catalog.map(p=>[p.id,p])),[1]),
    {changed:true,roundFinished:true});
  assert.equal(state.from.found,1);assert.equal(state.from.index,1);
  assert.equal(series.advance(state,"from",0,ids[0],false,ids,new Map(catalog.map(p=>[p.id,p]))).replayed,true);
  assert.equal(series.scoreCompare({found:5,attemptsWon:8},{found:5,attemptsWon:10}),1);
  assert.equal(series.scoreCompare({found:5,attemptsWon:8},{found:6,attemptsWon:100}),-1);
  assert.equal(series.outcome(state),null);
});
test("PART-02: UI and endpoints do not use freeform leaderboard scores as proof",()=>{
  const api=fs.readFileSync(path.join(root,"lib/player-challenges.js"),"utf8");
  const front=fs.readFileSync(path.join(root,"src/script.10xq.player-challenges.js"),"utf8");
  assert.match(api,/WHERE id=\$1 AND mode=\$2 AND \(from_id=\$3 OR to_id=\$3\) FOR UPDATE/);
  assert.match(api,/series_progress=\$2::jsonb/);
  assert.match(api,/\'\/api\/challenges\/series\/play\'|"\/api\/challenges\/series\/play"/);
  assert.match(front,/openSharedSeriesGame/);
  assert.match(front,/pcPost\('\/api\/challenges\/series\/play'/);
  assert.ok(!front.includes("series_ids"),"never place secrets in frontend");
});
test("PART-02 PostgreSQL: both players share 10 stored secrets, guessing and replays are atomic",{
  skip:!process.env.QA_DATABASE_URL,timeout:60000
},()=>withSchema(async({db,duels,push,pidB})=>{
  const created=await duels.create("A",{pid:pidB,mode:series.MODE,phrase:0,days:3});
  assert.equal(created.ok,true);assert.equal(created.target,10);
  const id=created.id;
  const raw=(await db.query("SELECT series_ids,series_gens,series_progress FROM player_challenges WHERE id=$1",[id])).rows[0];
  assert.equal(raw.series_ids.length,10);
  assert.equal(new Set(raw.series_ids).size,10);
  assert.deepEqual(raw.series_gens,[1,2,3,4,5,6,7,8,9]);
  assert.equal(raw.series_progress.from.index,0);
  const listA=await duels.list("A"),listB=await duels.list("B");
  assert.equal(listA.challenges[0].kind,series.KIND);
  assert.equal(listB.challenges[0].kind,series.KIND);
  for(const response of [listA,listB,await duels.seriesGame("A",id),await duels.seriesGame("B",id)])
    for(const secret of ["series_ids","series_gens","series_progress","secretId","answerId"])
      assert.ok(!Object.hasOwn(response,secret)&&!JSON.stringify(response).includes('"'+secret+'"'),
        "private internal state leaked: "+secret);
  assert.equal((await duels.seriesGame("C",id)).error,"unknown");
  assert.equal((await duels.seriesPlay("C",{id,round:0,pass:true})).error,"unknown");
  assert.equal((await duels.seriesPlay("A",{id,round:0,pokemonId:1025})).error,"invalid_guess");
  assert.equal((await duels.seriesGame("A",id)).index,0);
  const [one,two]=await Promise.all([
    duels.seriesPlay("A",{id,round:0,pokemonId:raw.series_ids[0]}),
    duels.seriesPlay("A",{id,round:0,pokemonId:raw.series_ids[0]})
  ]);
  assert.equal([one,two].filter(r=>r.roundFinished===true).length,1);
  assert.equal([one,two].filter(r=>r.replayed===true).length,1);
  assert.equal((await duels.seriesGame("A",id)).index,1);
  assert.equal((await duels.seriesGame("B",id)).index,0,"opponent has independent progress");
  for(let i=1;i<10;i++)
    await duels.seriesPlay("A",{id,round:i,pokemonId:raw.series_ids[i]});
  const waiting=await duels.seriesGame("A",id);
  assert.equal(waiting.found,10);assert.equal(waiting.done,true);
  assert.equal(waiting.status,"open");
  assert.equal(Object.hasOwn(waiting,"opponentFound"),false,"hide rival score until both done");
  for(let i=0;i<10;i++) {
    const pass=await duels.seriesPlay("B",{id,round:i,pass:true});
    assert.equal(pass.index,i+1);
  }
  const a=await duels.seriesGame("A",id),b=await duels.seriesGame("B",id);
  assert.deepEqual([a.status,b.status],["lost","lost"]);
  assert.deepEqual([a.found,b.found],[10,0]);
  assert.equal(a.opponentFound,0);
  assert.equal(b.opponentFound,10);
  assert.equal(a.outcome,"gagné");assert.equal(b.outcome,"perdu");
  assert.deepEqual([a.rounds.length,b.rounds.length],[10,10]);
  assert.equal((await duels.seriesPlay("A",{id,round:9,pass:true})).replayed,true);
  const stored=(await db.query("SELECT status,best FROM player_challenges WHERE id=$1",[id])).rows[0];
  assert.deepEqual([stored.status,stored.best],["lost",0]);
  assert.equal(push.filter(x=>x.msg.title.includes("Série commune terminée")).length,2);
  assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM player_challenges WHERE mode=$1",[series.MODE])).rows[0].n,1);
}));
test("PART-02 PostgreSQL: tie, expired game, and legacy challenge records remain separate",{
  skip:!process.env.QA_DATABASE_URL,timeout:60000
},()=>withSchema(async({db,duels,pidB})=>{
  const first=await duels.create("A",{pid:pidB,mode:series.MODE,phrase:0});
  assert.equal(first.ok,true);
  assert.equal((await duels.create("A",{pid:pidB,mode:series.MODE,phrase:0})).error,"already");
  for(let i=0;i<10;i++){
    const a=await duels.seriesPlay("A",{id:first.id,round:i,pass:true});
    const b=await duels.seriesPlay("B",{id:first.id,round:i,pass:true});
    assert.equal(a.roundFinished,true);assert.equal(b.roundFinished,true);
  }
  const same=await duels.seriesGame("B",first.id);
  assert.equal(same.outcome,"égalité");assert.equal(same.status,"tied");
  const b=await duels.create("A",{pid:pidB,mode:"serie10",phrase:0});
  assert.equal(b.ok,true);
  await db.query("UPDATE player_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",[b.id]);
  const expired=await duels.seriesPlay("B",{id:b.id,round:0,pass:true});
  assert.equal(expired.status,"expired");
  assert.equal((await db.query("SELECT series_progress->'to'->>'index' AS idx FROM player_challenges WHERE id=$1",[b.id])).rows[0].idx,"0");
  await db.query("INSERT INTO scores(discord_id,mode,score) VALUES ('A','quiz',10)");
  assert.equal((await duels.create("A",{pid:pidB,mode:"quiz",phrase:0})).target,10);
}));
