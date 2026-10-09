"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {wordleLetters,compareLetters,initWordleDb,createWordleService}=require('../lib/daily-wordle');
test('French Pokémon names ignore accents/punctuation and keep Nidoran distinguishable',()=>{
  for(const [name,expected] of [['Évoli','EVOLI'],['Ho-Oh','HOOH'],['M. Mime','MMIME'],['Porygon2','PORYGON'],['Nidoran♀','NIDORANF'],['Nidoran♂','NIDORANM']])assert.equal(wordleLetters(name),expected);
});
test('letter feedback reserves exacts, counts duplicates and accepts unequal lengths',()=>{
  assert.deepEqual(compareLetters('EEEEE','EVOLI'),['exact','absent','absent','absent','absent']);
  assert.deepEqual(compareLetters('AAAA','BAAA'),['absent','exact','exact','exact']);
  assert.deepEqual(compareLetters('OLIVIER','EVOLI'),['present','present','absent','present','exact','present','absent']);
  assert.deepEqual(compareLetters('MEW','MEW'),['exact','exact','exact']);
  assert.deepEqual(compareLetters('M','MEW'),['exact']);
});
test('real PostgreSQL: private shared Wordle after Daily, six tries, recovery, login and Paris midnight',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto');const admin=new Pool({connectionString:process.env.QA_DATABASE_URL}),schema='wordle_'+randomUUID().replaceAll('-','');let db;
  try {
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:4});
    await db.query(`CREATE TABLE daily_rounds(day DATE PRIMARY KEY,secret_id INTEGER);
      CREATE TABLE daily_plays(identity TEXT,day DATE,status TEXT);
      CREATE TABLE leaderboard_events(id BIGSERIAL PRIMARY KEY,discord_id TEXT,mode TEXT,score INTEGER,created_at TIMESTAMPTZ,result_key TEXT);
      CREATE UNIQUE INDEX event_key ON leaderboard_events(discord_id,mode,result_key) WHERE result_key IS NOT NULL;
      CREATE TABLE scores(discord_id TEXT,mode TEXT,score INTEGER,username TEXT,avatar TEXT,updated_at TIMESTAMPTZ,PRIMARY KEY(discord_id,mode));
      INSERT INTO daily_rounds VALUES('2026-10-08',1),('2026-10-09',1);`);
    await initWordleDb(db);await initWordleDb(db);
    const pokemon=[{id:1,name:'Bulbizarre'},{id:25,name:'Pikachu'},{id:4,name:'Salamèche'},{id:7,name:'Carapuce'},{id:133,name:'Évoli'},{id:151,name:'Mew'},{id:2,name:'Herbizarre'},{id:3,name:'Florizarre'},{id:20001,name:'Méga-Florizarre',isAltForm:true},{id:137,name:'Porygon'},{id:233,name:'Porygon2'}];
    let now=new Date('2026-10-08T12:00:00Z');const service=()=>createWordleService({db,pokemon,clock:()=>now,randomInt:()=>0});let game=service();
    const guest={key:'guest:g'},A={key:'user:A',accountId:'A',name:'A'},body=(p,who,day='2026-10-08')=>({day,accountId:who.accountId||null,pokemonId:p});
    const unlock=who=>db.query("INSERT INTO daily_plays VALUES($1,$2,'abandoned')",[who.key,'2026-10-08']);
    await assert.rejects(game.state(guest),{code:'daily_required'});
    await unlock(guest);await unlock(A);
    for(const who of [guest,A]){const state=await game.state(who);assert.equal(state.length,7);assert.equal(state.answerId,undefined);assert.equal(state.answerName,undefined);assert.equal(state.rows.length,0);assert.equal(state.maxTries,6);}
    assert.equal((await db.query('SELECT secret_id FROM wordle_rounds')).rows[0].secret_id,25);
    await db.query("UPDATE daily_plays SET status='playing' WHERE identity=$1",[guest.key]);
    await assert.rejects(game.guess(guest,body(4,guest)),{code:'daily_required'});
    await db.query("UPDATE daily_plays SET status='abandoned' WHERE identity=$1",[guest.key]);
    await assert.rejects(game.guess(A,body(9999,A)),{code:'invalid_guess'});await assert.rejects(game.guess(A,{...body(4,A),accountId:'B'}),{code:'account_changed'});
    await game.guess(guest,body(4,guest));assert.equal((await game.guess(guest,body(4,guest))).duplicate,true);assert.equal((await service().state(guest)).attempts,1);
    const won=await game.guess(guest,body(25,guest));assert.equal(won.won,true);assert.equal(won.points,8);assert.equal(won.maxPoints,10);assert.equal(won.answerName,'Pikachu');assert.equal(won.ranked,false);
    assert.equal((await db.query('SELECT * FROM leaderboard_events')).rowCount,0);
    const login={key:'user:G',accountId:'G',guestKey:guest.key};await unlock(login);assert.equal((await game.state(login)).won,true);assert.equal((await game.guess(login,body(25,login))).ranked,false);
    const wins=await Promise.all([game.guess(A,body(25,A)),game.guess(A,body(25,A))]);assert.ok(wins.every(s=>s.points===10));assert.equal((await db.query('SELECT * FROM leaderboard_events')).rowCount,1);
    assert.equal((await game.guess(A,body(4,A))).attempts,1);
    const B={key:'user:B',accountId:'B'};await unlock(B);
    for(const id of [1,4,7,133,151,25])await game.guess(B,body(id,B));assert.equal((await game.state(B)).points,1);
    const C={key:'user:C',accountId:'C'};await unlock(C);
    for(const id of [1,4,7,133,151,2])await game.guess(C,body(id,C));assert.equal((await game.state(C)).status,'lost');assert.equal((await game.guess(C,body(25,C))).won,false);
    const D={key:'user:D',accountId:'D'};await unlock(D);assert.equal((await game.abandon(D,body(undefined,D))).status,'abandoned');assert.equal((await game.guess(D,body(25,D))).points,0);
    const ongoing={key:'guest:login'};await unlock(ongoing);await game.guess(ongoing,body(4,ongoing));const E={key:'user:E',accountId:'E',guestKey:ongoing.key};await unlock(E);assert.equal((await game.state(E)).attempts,1);assert.equal((await game.guess(E,body(25,E))).ranked,true);
    const F={key:'user:F',accountId:'F'};await unlock(F);await game.guess(F,body(4,F));await db.query('ALTER TABLE scores ADD CONSTRAINT bad CHECK(score<0) NOT VALID');await assert.rejects(game.guess(F,body(25,F)));assert.equal((await game.state(F)).attempts,1);await db.query('ALTER TABLE scores DROP CONSTRAINT bad');
    const I={key:'guest:ambiguous'};await unlock(I);await game.guess(I,body(137,I));assert.equal((await game.guess(I,body(233,I))).duplicate,true);assert.equal((await game.state(I)).attempts,1);
    now=new Date('2026-10-08T21:59:59Z');const lock=await db.connect();await lock.query('BEGIN');await lock.query("SELECT * FROM wordle_plays WHERE identity='user:F' AND day='2026-10-08' FOR UPDATE");
    const pending=game.guess(F,body(25,F));await new Promise(r=>setTimeout(r,50));now=new Date('2026-10-08T22:00:00Z');await lock.query('COMMIT');lock.release();await assert.rejects(pending,{code:'stale_daily'});
    await assert.rejects(game.guess(A,body(25,A)),{code:'stale_daily'});await db.query("INSERT INTO daily_plays VALUES('user:A','2026-10-09','won')");const tomorrow=await game.state(A);assert.equal(tomorrow.attempts,0);assert.equal(tomorrow.day,'2026-10-09');assert.notEqual((await db.query("SELECT secret_id FROM wordle_rounds WHERE day='2026-10-09'")).rows[0].secret_id,25);
    now=new Date('2026-10-10T12:00:00Z');await db.query("INSERT INTO daily_rounds VALUES('2026-10-10',1); INSERT INTO daily_plays VALUES('guest:letters','2026-10-10','won'); INSERT INTO wordle_rounds VALUES('2026-10-10',233)");const equivalent=await game.guess({key:'guest:letters'},{day:'2026-10-10',accountId:null,pokemonId:137});assert.equal(equivalent.won,true);assert.equal(equivalent.points,10);assert.ok(equivalent.rows[0].colors.every(c=>c==='exact'));
  } finally {if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
