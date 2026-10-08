'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LIMIT,modeForDay,chooseTargets,initChallengeDb,createChallengeService,createMediaLoader}=require('../lib/daily-challenge');
const pokemon=Array.from({length:30},(_,i)=>({id:i+1,name:'Pokémon '+(i+1),gen:1,type1:'Normal'}));
test('recognition rotates through all three modes and draws ten distinct base species',()=>{
  assert.deepEqual(new Set(['2026-10-08','2026-10-09','2026-10-10'].map(modeForDay)),new Set(['zoom','cry','pixel']));
  assert.deepEqual(chooseTargets([...pokemon,{id:10001,isAltForm:true}],()=>0),[1,2,3,4,5,6,7,8,9,10]);
  assert.throws(()=>chooseTargets(pokemon.slice(0,9)),{code:'unavailable'});
});
test('media is transformed on the server, never redirected to a filename containing the answer',async()=>{
  const sharp=require('sharp'),raw=await sharp({create:{width:96,height:96,channels:4,background:'#4069e0'}}).png().toBuffer();let calls=0;
  const load=createMediaLoader({fetchAsset:async()=>{calls++;return {ok:true,arrayBuffer:async()=>raw};}});
  for(const mode of ['zoom','pixel'])for(const attempt of [0,5]){const asset=await load({id:25,mode,attempt});assert.equal(asset.type,'image/png');const meta=await sharp(asset.buffer).metadata();assert.equal(meta.width,288);assert.equal(meta.height,288);assert.equal(meta.exif,undefined);assert.equal(asset.url,undefined);}
  await load({id:25,mode:'pixel',attempt:5});assert.equal(calls,1);
  let attempts=0;const retry=createMediaLoader({fetchAsset:async()=>{attempts++;return {ok:attempts>1,arrayBuffer:async()=>raw};}});await assert.rejects(retry({id:1,mode:'cry',attempt:0}),{code:'media_unavailable'});assert.equal((await retry({id:1,mode:'cry',attempt:0})).type,'audio/ogg');
});
test('PostgreSQL: common targets, timer, hints, retries, migration, scores, global board and Paris rollover',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto'),schema='challenge_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  try{await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:6});
    await db.query(`CREATE TABLE dossier_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,points INT,elapsed_ms BIGINT);
      CREATE TABLE wordle_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,points INT,elapsed_ms BIGINT);
      CREATE TABLE daily_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,guessed JSONB,hints_used INT,elapsed_ms BIGINT);
      CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT,avatar TEXT);
      CREATE TABLE leaderboard_events(id BIGSERIAL PRIMARY KEY,discord_id TEXT,mode TEXT,score INT,created_at TIMESTAMPTZ,result_key TEXT);
      CREATE UNIQUE INDEX event_key ON leaderboard_events(discord_id,mode,result_key) WHERE result_key IS NOT NULL;
      CREATE TABLE scores(discord_id TEXT,mode TEXT,score INT,username TEXT,avatar TEXT,updated_at TIMESTAMPTZ,PRIMARY KEY(discord_id,mode));`);
    await initChallengeDb(db);await initChallengeDb(db);let now=new Date('2026-10-08T12:00:00Z');const make=()=>createChallengeService({db,pokemon,clock:()=>now,randomInt:()=>0});let game=make();
    const A={key:'user:A',accountId:'A',name:'Alice'},B={key:'user:B',accountId:'B',name:'Bob'},G={key:'guest:G'};
    const unlock=async(who,day='2026-10-08',status='completed')=>{await db.query('INSERT INTO dossier_plays VALUES($1,$2,$3,$4,9,20000);',[who.key,day,who.accountId||null,status]);await db.query("INSERT INTO wordle_plays VALUES($1,$2,$3,'won',6,10000)",[who.key,day,who.accountId||null]);await db.query("INSERT INTO daily_plays VALUES($1,$2,$3,'won','[1,2,3]',0,10000)",[who.key,day,who.accountId||null]);if(who.accountId)await db.query("INSERT INTO users VALUES($1,$2,'') ON CONFLICT DO NOTHING",[who.accountId,who.name||who.accountId]);};
    const body=(who,index,pokemonId,day='2026-10-08')=>({day,accountId:who.accountId||null,index,pokemonId});
    await assert.rejects(game.state(A),{code:'dossier_required'});await unlock(A);await unlock(B);await unlock(G);
    const first=await Promise.all([game.state(A),game.state(B)]);assert.equal(first[0].status,'ready');assert.equal(first[0].media,null);assert.equal(first[0].targets,undefined);assert.equal(first[0].remainingMs,LIMIT);now=new Date(+now+60000);assert.equal((await game.state(A)).remainingMs,LIMIT);
    await assert.rejects(game.guess(A,body(A,0,1)),{code:'not_started'});await game.start(A,body(A));await game.start(B,body(B));await game.start(G,body(G));
    assert.deepEqual(await game.media(A,{day:'2026-10-08',index:0,attempt:0}),await game.media(B,{day:'2026-10-08',index:0,attempt:0}));
    await assert.rejects(game.guess(A,{...body(A,0,1),accountId:'B'}),{code:'account_changed'});await assert.rejects(game.guess(A,body(A,1,2)),{code:'question_changed'});
    const duplicates=await Promise.all([game.guess(A,body(A,0,30)),game.guess(A,body(A,0,30))]);assert.ok(duplicates.some(s=>s.duplicate));assert.equal((await game.state(A)).guesses.length,1);
    let state=await game.guess(A,body(A,0,29));assert.equal(state.hints.length,1);await game.guess(A,body(A,0,28));state=await game.guess(A,body(A,0,27));assert.equal(state.hints.length,2);assert.equal(state.answerId,undefined);assert.equal(state.feedback.name,undefined);
    state=await game.guess(A,body(A,0,1));assert.equal(state.points,2);assert.equal(state.index,1);assert.equal(state.feedback.name,'Pokémon 1');assert.equal(state.results[0].attempts,5);assert.equal(state.guesses.length,0);
    for(let i=1;i<10;i++){now=new Date(+now+1000);state=await game.guess(A,body(A,i,i+1));}assert.equal(state.points,56);assert.equal(state.finished,true);assert.equal(state.ranked,true);assert.equal((await game.start(A,body(A))).finished,true);await game.guess(A,body(A,9,10));assert.equal((await db.query("SELECT * FROM leaderboard_events WHERE discord_id='A'")).rowCount,1);
    for(const id of [30,29,28,27,26,25])state=await game.guess(B,body(B,0,id));assert.equal(state.index,1);assert.equal(state.feedback.correct,false);assert.equal(state.points,0);
    now=new Date(+now+LIMIT);state=await make().state(B);assert.equal(state.finished,true);assert.equal(state.points,0);assert.equal(state.elapsedMs,LIMIT);assert.equal((await game.guess(B,body(B,1,2))).points,0);
    const expiredGuest={key:'guest:expired'};await unlock(expiredGuest);await game.start(expiredGuest,body(expiredGuest));now=new Date(+now+LIMIT);const expiredLogin={key:'user:X',accountId:'X',guestKey:expiredGuest.key};await unlock(expiredLogin);assert.equal((await game.state(expiredLogin)).ranked,false);assert.equal((await game.leaderboard('challenge','today','X')).me,null);
    assert.equal((await game.leaderboard('challenge','today','A')).me.score,56);assert.equal((await game.leaderboard('journey','today','A')).me.score,79);const summary=await game.summary(A);assert.equal(summary.points,79);assert.equal(summary.finished,true);assert.equal(summary.ranked,true);
    const late={key:'user:L',accountId:'L',guestKey:G.key};await unlock(late);assert.equal((await game.state(late)).finished,true);assert.equal((await game.state(late)).ranked,false);assert.equal((await game.leaderboard('challenge','today','L')).me,null);
    const ongoing={key:'guest:ongoing'};await unlock(ongoing);await game.start(ongoing,body(ongoing));await game.guess(ongoing,body(ongoing,0,30));const C={key:'user:C',accountId:'C',guestKey:ongoing.key};await unlock(C);assert.equal((await game.state(C)).guesses.length,1);assert.equal((await game.abandon(C,body(C))).points,0);assert.equal((await game.start(C,body(C))).status,'abandoned');assert.equal((await game.leaderboard('challenge','today','C')).me,null);assert.equal((await game.leaderboard('journey','today','C')).me.score,23);
    const E={key:'user:E',accountId:'E'};await unlock(E);await game.start(E,body(E));for(let i=0;i<9;i++)await game.guess(E,body(E,i,i+1));await db.query('ALTER TABLE scores ADD CONSTRAINT bad CHECK(score<0) NOT VALID');await assert.rejects(game.guess(E,body(E,9,10)));assert.equal((await game.state(E)).index,9);await db.query('ALTER TABLE scores DROP CONSTRAINT bad');
    now=new Date('2026-10-08T21:59:59Z');const F={key:'user:F',accountId:'F'};await unlock(F);await game.start(F,body(F));const lock=await db.connect();await lock.query('BEGIN');await lock.query("SELECT * FROM challenge_plays WHERE identity='user:F' FOR UPDATE");const pending=game.guess(F,body(F,0,1));await new Promise(r=>setTimeout(r,50));now=new Date('2026-10-08T22:00:00Z');await lock.query('COMMIT');lock.release();await assert.rejects(pending,{code:'stale_daily'});assert.equal((await db.query("SELECT jsonb_array_length(answers) AS n FROM challenge_plays WHERE identity='user:F'")).rows[0].n,0);
    await assert.rejects(game.start(A,body(A)),{code:'stale_daily'});await unlock(A,'2026-10-09');state=await game.state(A);assert.equal(state.status,'ready');assert.equal((await game.leaderboard('journey','today','A')).total,0);assert.equal((await game.leaderboard('journey','week','A')).me.score,79);
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
