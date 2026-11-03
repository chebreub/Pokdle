'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createBallService,initBallsDb,mountBallRoutes} = require('../lib/poke-balls');
const {createVerifiedArcade,createArcadeArtworkLoader,TTL} = require('../lib/verified-arcade');
const pokemon = [{id:6,name:'Dracaufeu',generation:1,weight:5},{id:25,name:'Pikachu',generation:1,weight:20},{id:133,name:'Évoli',generation:2,weight:8}];
const me = {key:'user:arcade',guestKey:'guest:arcade',accountId:'arcade'};
const other = {key:'user:other',guestKey:'guest:other',accountId:'other'};
const sql = {skip:!process.env.QA_DATABASE_URL,timeout:60000};
async function withDb(run) {
  const {Pool} = require('pg'), schema = 'verified_' + randomUUID().replaceAll('-','');
  const admin = new Pool({connectionString:process.env.QA_DATABASE_URL}); let db;
  try {
    await admin.query('CREATE SCHEMA '+schema);
    db = new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:6});
    await initBallsDb(db); await run(db);
  } finally { if(db)await db.end(); await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE'); await admin.end(); }
}
const start = (service,who,mode,extra={}) => service.arcadeStart(who,{mode,startId:randomUUID(),...extra});
const answer = (service,who,s,choice,extra={}) => service.arcadeAnswer(who,{mode:s.mode,sessionId:s.sessionId,round:s.round,choice,...extra});
const next = (service,who,s) => service.arcadeNext(who,{mode:s.mode,sessionId:s.sessionId,round:s.round});

test('PostgreSQL: weight rejects declarations and forged scores; retries pay once; other accounts cannot answer',sql,()=>withDb(async db=>{
  const service = createBallService({db,pokemon,secret:'local-only',clock:()=>new Date('2026-11-03T12:00:00Z'),randomInt:()=>0});
  await service.state(me);
  for(const mode of ['weight','shiny',['weight'],['shiny']]) await assert.rejects(service.earn(me,{mode,result:'win',score:100000}),/verified_game_required/);
  const initial = (await start(service,me,'weight',{gens:[1],score:999})).arcade;
  assert.deepEqual(initial.question,{left:6,right:25}); assert.equal(initial.score,0);
  assert.equal(initial.reveal,undefined); assert.equal(initial.question.correctId,undefined);
  assert.equal((await start(service,me,'weight',{gens:[1]})).arcade.sessionId,initial.sessionId,'reload resumes the same question');
  await assert.rejects(answer(service,other,initial,25),/session_changed/);
  await assert.rejects(answer(service,me,initial,133),/invalid_choice/);
  const replies = await Promise.all(Array.from({length:3},()=>answer(service,me,initial,25,{score:999,result:'win'})));
  assert.equal(replies.filter(r=>!r.replayed).length,1);
  assert.ok(replies.every(r=>r.arcade.score===1 && r.coins.balance===60));
  assert.equal(replies.flatMap(r=>r.coinsAdded).length,1);
  assert.equal(replies.flatMap(r=>r.added).filter(g=>g.source==='mode:weight').length,1);
  await assert.rejects(answer(service,me,initial,6),/answer_conflict/);
  const second = (await start(service,me,'weight',{gens:[1]})).arcade;
  assert.equal(second.score,1);
  const lost = await answer(service,me,second,6,{score:10000,result:'win'});
  assert.equal(lost.arcade.score,0); assert.equal(lost.arcade.answer.correct,false);
  assert.deepEqual(lost.coinsAdded,[],'only the first duel of the day pays');
  assert.equal(lost.coins.balance,60);
  await assert.rejects(answer(service,me,initial,25),/session_changed/);
}));

test('PostgreSQL: server streak survives service restarts/days; tenth correct duel retains the gold threshold',sql,()=>withDb(async db=>{
  let now = new Date('2026-11-03T12:00:00Z');
  const options = {db,pokemon,secret:'local-only',clock:()=>now,randomInt:()=>0};
  let service = createBallService(options); await service.state(me);
  for(let i=0;i<9;i++) await answer(service,me,(await start(service,me,'weight',{gens:[1]})).arcade,25);
  now = new Date('2026-11-04T12:00:00Z'); service = createBallService(options);
  const s = (await start(service,me,'weight',{gens:[1]})).arcade;
  assert.equal(s.score,9);
  const gold = await answer(service,me,s,25);
  assert.equal(gold.arcade.score,10); assert.deepEqual(gold.coinsAdded,[{source:'play:weight',amount:90}]);
  assert.ok(gold.added.some(g=>g.source==='mode:weight'&&g.ball==='great'));
  const pending = (await start(service,me,'weight',{gens:[1]})).arcade;
  const restart = (await start(service,me,'weight',{gens:[1],restart:true})).arcade;
  assert.equal(restart.score,0,'abandoning an unanswered duel cannot preserve a streak while rerolling');
  await assert.rejects(answer(service,me,pending,25),/session_changed/);
  await assert.rejects(start(service,me,'weight',{gens:[99]}),/invalid_generations/);
}));

test('PostgreSQL: shiny lives, score, reveal, opaque images, next/retry and gold reward come from the server',sql,()=>withDb(async db=>{
  let now = new Date('2026-11-03T12:00:00Z');
  const service = createBallService({db,pokemon,secret:'local-only',clock:()=>now,randomInt:()=>0}); await service.state(me);
  let s = (await start(service,me,'shiny')).arcade;
  assert.equal(s.question.shiny,undefined); assert.equal(s.reveal,undefined);
  assert.match(s.question.image,/^\/api\/arcade\/art\/[A-Za-z0-9_-]+$/);
  const token = s.question.image.split('/').at(-1);
  assert.equal(service.arcadeImageSpec(token,me).shiny,true);
  assert.equal(service.arcadeImageSpec(token,other),null);
  assert.equal(service.arcadeImageSpec('bad'+token,me),null);
  await assert.rejects(next(service,me,s),/round_changed/);
  const first = s;
  let r = await answer(service,me,s,'shiny',{score:1000,lives:1000});
  assert.equal(r.arcade.score,1); assert.equal(r.arcade.lives,3); assert.equal(r.arcade.reveal.shiny,true);
  assert.deepEqual(r.coinsAdded,[]); assert.equal(r.added.some(g=>g.source==='mode:shiny'),false);
  assert.equal((await answer(service,me,s,'shiny')).arcade.score,1);
  await assert.rejects(answer(service,me,s,'normal'),/answer_conflict/);
  s = r.arcade;
  const advanced = await Promise.all([next(service,me,s),next(service,me,s)]);
  assert.equal(advanced[0].arcade.round,advanced[1].arcade.round);
  s = advanced[0].arcade;
  await assert.rejects(answer(service,me,first,'shiny'),/round_changed/);
  for(let score=1;score<20;score++) {
    r = await answer(service,me,s,'shiny'); s = r.arcade;
    if(score<19) s = (await next(service,me,s)).arcade;
  }
  assert.equal(s.score,20);
  for(let miss=0;miss<3;miss++) {
    s = (await next(service,me,s)).arcade;
    r = await answer(service,me,s,'normal',{result:'win'}); s = r.arcade;
  }
  assert.equal(s.phase,'over'); assert.equal(s.lives,0); assert.equal(s.score,20);
  assert.deepEqual(r.coinsAdded,[{source:'play:shiny',amount:90}]);
  assert.ok(r.added.some(g=>g.source==='mode:shiny'&&g.ball==='great'));
  const replay = await answer(service,me,s,'normal');
  assert.deepEqual(replay.coinsAdded,[]); assert.equal(replay.coins.balance,90);
  await assert.rejects(next(service,me,s),/round_changed/);
  now = new Date(+now + TTL + 1);
  assert.equal(service.arcadeImageSpec(token,me),null);
  await assert.rejects(answer(service,me,s,'normal'),/session_expired/);
}));

test('PostgreSQL: losing shiny pays 30 once, guests get no coins, and reward failure rolls back the answer',sql,()=>withDb(async db=>{
  const service = createBallService({db,pokemon,secret:'local-only',clock:()=>new Date('2026-11-03T12:00:00Z'),randomInt:()=>0}); await service.state(me);
  let s = (await start(service,me,'shiny')).arcade, r;
  for(let i=0;i<3;i++){r=await answer(service,me,s,'normal');s=r.arcade;if(i<2)s=(await next(service,me,s)).arcade;}
  assert.deepEqual(r.coinsAdded,[{source:'play:shiny',amount:30}]); assert.ok(r.added.some(g=>g.source==='mode:shiny'&&g.ball==='poke'));
  const guest = {key:'guest:solo',guestKey:'guest:solo',accountId:null};
  s=(await start(service,guest,'weight',{gens:[1]})).arcade; r=await answer(service,guest,s,25);
  assert.equal(r.coins.balance,0); assert.ok(r.added.some(g=>g.source==='mode:weight'));
  s=(await start(service,me,'weight',{gens:[1]})).arcade;
  await db.query("ALTER TABLE coin_ledger ADD CONSTRAINT reject_weight CHECK(source <> 'play:weight')");
  await assert.rejects(answer(service,me,s,25));
  assert.equal((await start(service,me,'weight',{gens:[1]})).arcade.phase,'playing');
  await db.query('ALTER TABLE coin_ledger DROP CONSTRAINT reject_weight');
  assert.equal((await answer(service,me,s,25)).coins.balance,90);
}));

test('PostgreSQL + HTTP: account binding, route aliases, old earn rejection and protected artwork',sql,()=>withDb(async db=>{
  const express = require('express'), app = express(); let user = {id:'arcade'};
  const png = Buffer.from('89504e470d0a1a0a','hex');
  mountBallRoutes({app,express,db,pokemon,secret:'local-only',getUser:()=>user,readCookies:()=>({}),artworkLoader:async()=>png});
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  const root='http://127.0.0.1:'+server.address().port;
  const post=async(path,body)=>{const r=await fetch(root+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  try {
    const state=await(await fetch(root+'/api/balls')).json();
    assert.equal((await post('/API/ARCADE/START/',{mode:'weight',startId:randomUUID(),actionScope:'wrong'})).status,409);
    assert.equal((await post('/api/balls/earn',{mode:['weight'],result:'win',score:999})).body.error,'verified_game_required');
    const s=(await post('/api/arcade/start',{mode:'shiny',startId:randomUUID(),actionScope:state.actionScope})).body.arcade;
    assert.equal((await fetch(root+s.question.image)).status,200);
    user={id:'other'};
    assert.equal((await fetch(root+s.question.image)).status,404);
    const scope=(await(await fetch(root+'/api/balls')).json()).actionScope;
    assert.equal((await post('/API/ARCADE/ANSWER/',{mode:'shiny',sessionId:s.sessionId,round:s.round,choice:'normal',actionScope:scope})).body.error,'session_changed');
  } finally {await new Promise(r=>server.close(r));}
}));

test('artwork proxy uses a fixed URL, checks PNGs, shares concurrent loads and retries failures',async()=>{
  let calls=0, fail=true;
  const load=createArcadeArtworkLoader(async url=>{
    calls++; assert.equal(url,'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/shiny/6.png');
    return {ok:!fail,headers:{get:()=>null},arrayBuffer:async()=>Buffer.from('89504e470d0a1a0a','hex')};
  });
  await assert.rejects(load({id:6,shiny:true}),/image_unavailable/);
  fail=false; await Promise.all([load({id:6,shiny:true}),load({id:6,shiny:true})]); assert.equal(calls,2);
});

// AES-GCM hides content, not plaintext length. Both answers must have the same
// token length for an otherwise identical question/owner/date.
test('shiny artwork tokens do not disclose the answer through their length',async()=>{
  let bit=0;
  const arcade=createVerifiedArcade({pokemon,secret:'local-only',clock:()=>new Date('2026-11-03T12:00:00Z'),randomInt:n=>n===2?bit:0});
  const c={query:async()=>({rows:[]})};
  const a=await arcade.start(c,me,{mode:'shiny',startId:randomUUID()});
  bit=1;
  const b=await arcade.start(c,me,{mode:'shiny',startId:randomUUID()});
  const token=s=>s.arcade.question.image.split('/').at(-1);
  assert.equal(a.arcade.question.id,b.arcade.question.id);
  assert.equal(token(a).length,token(b).length);
  assert.equal(arcade.imageSpec(token(a),me).shiny,true);
  assert.equal(arcade.imageSpec(token(b),me).shiny,false);
});
