'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {facts,buildDossierQuestions}=require('../lib/dossier-questions');
const {initDossierDb,createDossierService}=require('../lib/daily-dossier');
const {dailyCalendar}=require('../lib/daily-game');
test('verified question banks cover every base species, four distinct options, ties and French facts',()=>{
  assert.equal(Object.keys(facts).length,1025);
  for(const id of Object.keys(facts)) {
    const bank=buildDossierQuestions(id,'2026-10-08');assert.equal(bank.length,20,id);assert.equal(new Set(bank.map(q=>q.id)).size,20,id);
    for(const q of bank){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.answer>=0&&q.answer<4);assert.ok(q.explanation);}
  }
  const bank=buildDossierQuestions(25,'2026-10-08'),answer=id=>{const q=bank.find(q=>q.id===id);return q.options[q.answer];};
  assert.equal(answer('ability'),'Statik');assert.equal(answer('hidden'),'Paratonnerre');assert.equal(answer('parent'),'Pichu');assert.equal(answer('total'),'320');
  const mew=buildDossierQuestions(151,'2026-10-08').find(q=>q.id==='highest');assert.equal(mew.options[mew.answer].split(' / ').length,6);
  const tyrogue=buildDossierQuestions(236,'2026-10-08').find(q=>q.id==='children');assert.equal(tyrogue.options[tyrogue.answer].split(' / ').length,3);
  const magnemite=buildDossierQuestions(81,'2026-10-08').find(q=>q.id==='gender');assert.equal(magnemite.options[magnemite.answer],'Sans sexe');
});
test('questions and option order are shared, deterministic and vary by Paris day',()=>{
  assert.deepEqual(buildDossierQuestions(25,'2026-10-08'),buildDossierQuestions(25,'2026-10-08'));
  assert.notDeepEqual(buildDossierQuestions(25,'2026-10-08'),buildDossierQuestions(25,'2026-10-09'));
  for(const[before,after,day]of [['2026-03-28T22:59:59Z','2026-03-28T23:00:00Z','2026-03-29'],['2026-10-25T22:59:59Z','2026-10-25T23:00:00Z','2026-10-26']]){assert.notEqual(dailyCalendar(new Date(before)).day,day);assert.equal(dailyCalendar(new Date(after)).day,day);}
});
test('PostgreSQL: sequential private questions, scoring, bonus, recovery, migration, rankings and midnight rollback',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
  const {Pool}=require('pg'),{randomUUID}=require('node:crypto');const schema='dossier_'+randomUUID().replaceAll('-','');const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
  try {
    await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:6});
    await db.query(`CREATE TABLE daily_rounds(day DATE PRIMARY KEY,secret_id INTEGER);
      CREATE TABLE wordle_plays(identity TEXT,day DATE,status TEXT);
      CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT,avatar TEXT);
      CREATE TABLE leaderboard_events(id BIGSERIAL PRIMARY KEY,discord_id TEXT,mode TEXT,score INTEGER,created_at TIMESTAMPTZ,result_key TEXT);
      CREATE UNIQUE INDEX event_key ON leaderboard_events(discord_id,mode,result_key) WHERE result_key IS NOT NULL;
      CREATE TABLE scores(discord_id TEXT,mode TEXT,score INTEGER,username TEXT,avatar TEXT,updated_at TIMESTAMPTZ,PRIMARY KEY(discord_id,mode));
      INSERT INTO daily_rounds VALUES('2026-10-08',25),('2026-10-09',1);`);
    await initDossierDb(db);await initDossierDb(db);
    let now=new Date('2026-10-08T12:00:00Z');const service=()=>createDossierService({db,clock:()=>now});let game=service();
    const guest={key:'guest:g'},A={key:'user:A',accountId:'A',name:'Alice'},B={key:'user:B',accountId:'B',name:'Bob'};
    const unlock=async(who,status='abandoned',day='2026-10-08')=>{await db.query('INSERT INTO wordle_plays VALUES($1,$2,$3)',[who.key,day,status]);if(who.accountId)await db.query('INSERT INTO users VALUES($1,$2,\'\') ON CONFLICT DO NOTHING',[who.accountId,who.name||who.accountId]);};
    const body=(who,index,choice,day='2026-10-08')=>({day,accountId:who.accountId||null,index,choice});
    const questions=buildDossierQuestions(25,'2026-10-08');
    const answer=async(who,index,correct=true)=>{now=new Date(+now+1000);return game.answer(who,body(who,index,(questions[index].answer+(correct?0:1))%4));};
    await assert.rejects(game.state(guest),{code:'wordle_required'});await unlock(guest,'playing');await assert.rejects(game.state(guest),{code:'wordle_required'});await db.query("UPDATE wordle_plays SET status='lost' WHERE identity='guest:g'");
    await unlock(A);await unlock(B,'won');
    const initial=await game.state(A),shared=await game.state(guest);assert.deepEqual(initial.question,shared.question);assert.equal(initial.pokemonName,'Pikachu');assert.equal(initial.question.answer,undefined);assert.equal(initial.question.explanation,undefined);assert.equal(initial.questions,undefined);assert.equal(initial.results.length,0);
    await assert.rejects(game.answer(A,body(A,1,0)),{code:'question_changed'});await assert.rejects(game.answer(A,body(A,0,4)),{code:'invalid_answer'});await assert.rejects(game.answer(A,{...body(A,0,0),accountId:'B'}),{code:'account_changed'});
    const replies=await Promise.all([answer(A,0),answer(A,0)]);assert.ok(replies.every(s=>s.points===1));assert.equal((await game.state(A)).answered,1);assert.equal((await game.answer(A,body(A,0,0))).duplicate,true);
    for(let i=1;i<10;i++)await answer(A,i);
    let state=await service().state(A);assert.equal(state.bonusUnlocked,true);assert.equal(state.finished,false);assert.equal(state.total,20);assert.equal(state.question.index,10);assert.equal(state.feedback.answer,questions[9].answer);assert.equal(state.results[0].prompt,undefined);
    for(let i=10;i<20;i++)await answer(A,i);
    state=await game.state(A);assert.equal(state.finished,true);assert.equal(state.points,20);assert.equal(state.ranked,true);assert.equal(state.question,null);assert.equal(state.results.length,20);assert.ok(state.results[0].explanation);
    assert.equal((await answer(A,19,false)).points,20);assert.equal((await db.query("SELECT * FROM leaderboard_events WHERE discord_id='A'")).rowCount,1);
    for(let i=0;i<10;i++)state=await answer(B,i,i!==0);assert.equal(state.finished,true);assert.equal(state.points,9);assert.equal(state.bonusUnlocked,false);assert.equal(state.total,10);
    for(let i=0;i<10;i++)state=await answer(guest,i,false);assert.equal(state.points,0);assert.equal(state.ranked,false);
    const login={key:'user:G',accountId:'G',guestKey:guest.key};await unlock(login);assert.equal((await game.state(login)).finished,true);assert.equal((await game.state(login)).ranked,false);
    const ongoing={key:'guest:ongoing'};await unlock(ongoing);await answer(ongoing,0);
    const C={key:'user:C',accountId:'C',guestKey:ongoing.key};await unlock(C);assert.equal((await game.state(C)).answered,1);for(let i=1;i<10;i++)state=await answer(C,i,i!==1);assert.equal(state.ranked,true);
    const D={key:'user:D',accountId:'D'};await unlock(D);await answer(D,0);assert.equal((await game.abandon(D,body(D))).points,0);assert.equal((await answer(D,1)).status,'abandoned');
    let ranking=await game.leaderboard('today','B');assert.equal(ranking.total,3);assert.equal(ranking.top[0].score,20);assert.equal(ranking.me.score,9);assert.ok(ranking.around.length);assert.ok(ranking.top.every(r=>r.username!=='G'));
    // A completed zero-score account still sees its performance in the list.
    const Z={key:'user:Z',accountId:'Z'};await unlock(Z);for(let i=0;i<10;i++)await answer(Z,i,false);assert.equal((await game.leaderboard('today','Z')).me.score,0);
    const E={key:'user:E',accountId:'E'};await unlock(E);for(let i=0;i<9;i++)await answer(E,i,false);
    await db.query('ALTER TABLE scores ADD CONSTRAINT bad CHECK(score<0) NOT VALID');await assert.rejects(answer(E,9));assert.equal((await game.state(E)).answered,9);await db.query('ALTER TABLE scores DROP CONSTRAINT bad');
    now=new Date('2026-10-08T21:59:59Z');const lock=await db.connect();await lock.query('BEGIN');await lock.query("SELECT * FROM dossier_plays WHERE identity='user:E' AND day='2026-10-08' FOR UPDATE");
    const pending=game.answer(E,body(E,9,0));await new Promise(r=>setTimeout(r,50));now=new Date('2026-10-08T22:00:00Z');await lock.query('COMMIT');lock.release();await assert.rejects(pending,{code:'stale_daily'});
    assert.equal((await db.query("SELECT jsonb_array_length(answers) AS n FROM dossier_plays WHERE identity='user:E'")).rows[0].n,9);
    await assert.rejects(game.answer(A,body(A,0,0)),{code:'stale_daily'});await assert.rejects(game.state(A),{code:'wordle_required'});await unlock(A,'won','2026-10-09');state=await game.state(A);assert.equal(state.answered,0);assert.equal(state.pokemonId,1);assert.equal(state.day,'2026-10-09');
    assert.equal((await game.leaderboard('today','A')).total,0);assert.equal((await game.leaderboard('week','A')).me.score,20);assert.equal((await game.leaderboard('all','A')).me.score,20);
  }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
