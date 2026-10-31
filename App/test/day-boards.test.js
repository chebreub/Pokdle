'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {dayBoard}=require('../lib/day-boards');
const {initChallengeDb}=require('../lib/daily-challenge');
const {initWordleDb}=require('../lib/daily-wordle');

test('PostgreSQL: 7 days and Total add every day up, and a stage left out only costs its own points',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto'),schema='boards_'+randomUUID().replaceAll('-',''),admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  try{await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:4});
    await db.query(`CREATE TABLE dossier_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,points INT,elapsed_ms BIGINT);
      CREATE TABLE daily_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,guessed JSONB,hints_used INT,elapsed_ms BIGINT);
      CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT,avatar TEXT,partner_id INT,xp INT,photo_key TEXT);
      CREATE TABLE leaderboard_events(id BIGSERIAL PRIMARY KEY,discord_id TEXT,mode TEXT,score INT,created_at TIMESTAMPTZ,result_key TEXT);
      CREATE TABLE scores(discord_id TEXT,mode TEXT,score INT,username TEXT,avatar TEXT,updated_at TIMESTAMPTZ,PRIMARY KEY(discord_id,mode));`);
    await initWordleDb(db);await initChallengeDb(db);
    for(const name of ['A','B','C','D','E'])await db.query('INSERT INTO users(discord_id,username,xp) VALUES($1,$1,0)',[name]);
    const days=['2026-10-02','2026-10-08','2026-10-09','2026-10-10'];
    for(const day of days){await db.query("INSERT INTO wordle_rounds(day,secret_id) VALUES($1,1)",[day]);await db.query("INSERT INTO challenge_rounds(day,mode,targets) VALUES($1,'pixel','[1]')",[day]);}
    const enquete=(who,day,guessed,status='won',hints=0)=>db.query('INSERT INTO daily_plays VALUES($1,$2,$1,$3,$4,$5,1000)',[who,day,status,JSON.stringify(guessed),hints]);
    const wordle=(who,day,guessed,status='won',identity=who)=>db.query('INSERT INTO wordle_plays(identity,day,account_id,status,guessed,started_at,elapsed_ms) VALUES($1,$2,$3,$4,$5,NOW(),1000)',[identity,day,who,status,JSON.stringify(guessed)]);
    const dossier=(who,day,points,status='completed')=>db.query('INSERT INTO dossier_plays VALUES($1,$2,$1,$3,$4,1000)',[who,day,status,points]);
    const challenge=(who,day,points,status='completed')=>db.query('INSERT INTO challenge_plays(identity,day,account_id,points,status,finished_at,elapsed_ms) VALUES($1,$2,$1,$3,$4,NOW(),1000)',[who,day,points,status]);
    // A plays the whole journey three days in a row: 36 + 10 + 20 + 28 = 94 a day.
    for(const day of days.slice(1)){await enquete('A',day,[1,2,3]);await wordle('A',day,[1]);await dossier('A',day,20);await challenge('A',day,28);}
    await dossier('A','2026-10-02',20);
    // B plays one perfect day only: 40 + 10 + 20 + 30.
    await enquete('B','2026-10-10',[1]);await wordle('B','2026-10-10',[1]);await dossier('B','2026-10-10',20);await challenge('B','2026-10-10',30);
    // C only does the Enquête, D gives up the Défi after 5 points, E has two Wordle plays (two devices).
    await enquete('C','2026-10-10',[1]);await challenge('D','2026-10-10',5,'abandoned');
    await wordle('E','2026-10-10',[1]);await wordle('E','2026-10-10',[1,2],'won','device-2');
    const board=(mode,scope,me=null)=>dayBoard(db,{mode,scope,accountId:me,day:'2026-10-10'});

    const today=await board('journey','today','A');
    assert.deepEqual(today.top.map(r=>[r.username,r.score]),[['B',100],['A',94],['C',40],['E',10],['D',5]],'one day: the best day wins, unfinished journeys still count');
    assert.equal(today.cumulative,false);assert.equal(today.me.days,undefined);
    const week=await board('journey','week','B');
    assert.deepEqual(week.top.slice(0,2).map(r=>[r.username,r.score,r.days]),[['A',282,3],['B',100,1]],'over 7 days, playing every day beats one perfect day');
    assert.deepEqual([week.me.rank,week.me.score,week.me.days],[2,100,1]);assert.equal(week.cumulative,true);
    assert.equal((await board('journey','all','A')).me.score,302,'Total keeps the days older than a week');

    assert.equal((await board('challenge','today','D')).me,null,'an abandoned Défi stays off the Défi board');
    assert.equal((await board('wordlepts','today','E')).me.score,10,'two plays of one day count once');
    const enq=await board('enquete','today','A');
    assert.deepEqual(enq.top.map(r=>[r.username,r.score,r.attempts]),[['B',40,1],['C',40,1],['A',36,3]]);
    assert.deepEqual([enq.me.score,enq.me.attempts,enq.me.hints],[36,3,0]);
    assert.deepEqual([(await board('dossier','week','A')).me.score,(await board('dossier','all','A')).me.score],[60,80]);
    assert.equal((await board('journey','today',null)).me,null);
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
