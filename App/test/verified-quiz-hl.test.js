'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {createBallService,initBallsDb,mountBallRoutes}=require('../lib/poke-balls');
const {createQuizHigherLower}=require('../lib/quiz-higher-lower');
const all=JSON.parse(fs.readFileSync(path.join(__dirname,'../pokemon.js'),'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
const small=all.filter(p=>[6,25,133].includes(p.id));
const who=id=>({key:'user:'+id,guestKey:'guest:'+id,accountId:id});
const me=who('quiz-hl');
const opts={skip:!process.env.QA_DATABASE_URL,timeout:60000};
async function withDb(run){
 const {Pool}=require('pg'),schema='quiz_hl_'+randomUUID().replaceAll('-','');
 const admin=new Pool({connectionString:process.env.QA_DATABASE_URL});let db;
 try{await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:6});await initBallsDb(db);await run(db);}
 finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
}
const start=(service,user,mode,extra={})=>service.arcadeStart(user,{mode,startId:randomUUID(),...extra});
const body=s=>({mode:s.mode,sessionId:s.sessionId,round:s.round});
const answer=(service,user,s,choice,extra={})=>service.arcadeAnswer(user,{...body(s),choice,...extra});
const next=(service,user,s)=>service.arcadeNext(user,body(s));
const stored=async(db,user,mode)=>(await db.query('SELECT state FROM arcade_runs WHERE identity=$1 AND mode=$2',[user.key,mode])).rows[0].state;
const correctHL=q=>q.rightValue>=q.leftValue?'higher':'lower';

test('Quiz preserves the 4/4/4/3 mix, 15 distinct questions and the shared written bank',()=>{
 const engine=createQuizHigherLower(all,require('node:crypto').randomInt,()=>new Date());
 for(let n=0;n<30;n++){
  const s={mode:'quiz',round:0};engine.init(s);
  assert.equal(s.questions.length,15);assert.equal(new Set(s.questions.map(q=>q.question)).size,15);
  assert.deepEqual(['culture','type','gen','dex'].map(k=>s.questions.filter(q=>q.kind===k).length),[4,4,4,3]);
  for(const q of s.questions){assert.ok(q.options.length>=3&&q.options.length<=4);assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.answer>=0&&q.answer<q.options.length);}
  const view=engine.view({...s,phase:'playing'});assert.equal(view.questions,undefined);assert.equal(view.question.answer,undefined);
 }
 assert.equal(require('../src/script.00b.quiz-bank').length,20);
});

test('Higher or Lower uses form stats, promotes the right Pokémon and accepts either button on equal values',()=>{
 const catalog=[{id:6},{id:20002,apiId:'charizard-mega-x',isAltForm:true}];
 const engine=createQuizHigherLower(catalog,()=>0,()=>new Date());
 const s={mode:'higher-lower',round:0,score:0,phase:'playing'};engine.init(s);
 assert.equal(s.question.leftValue,78);assert.equal(s.question.rightValue,78);
 assert.equal(engine.view(s).question.rightValue,undefined);
 engine.answer(s,'lower');assert.equal(s.score,1);assert.equal(s.phase,'reveal');
 s.nextAt=0;engine.next(s);assert.equal(s.question.left,20002);assert.equal(s.question.right,6);
 engine.answer(s,'higher');assert.equal(s.score,2);
 assert.throws(()=>engine.answer(s,'anything'),/invalid_choice/);
});

test('PostgreSQL: Quiz validates 15 answers, prevents skips/forgery/replays, atomically awards 30/60/90',opts,()=>withDb(async db=>{
 const service=createBallService({db,pokemon:all,secret:'isolated-test',randomInt:()=>0});
 for(const mode of ['quiz','higher-lower','higher-lower-rush'])for(const value of [mode,[mode]])await assert.rejects(service.earn(me,{mode:value,result:'win',score:999}),/verified_game_required/);
 for(const target of [0,8,12,15]){
  const user=who('quiz-'+target);let s=(await start(service,user,'quiz',{score:999})).arcade;
  const initial=s;assert.equal(s.score,0);assert.equal(s.total,15);assert.equal(s.questions,undefined);assert.equal(s.question.answer,undefined);
  assert.equal((await start(service,user,'quiz')).arcade.sessionId,s.sessionId);
  await assert.rejects(next(service,user,s),/round_changed/);
  await assert.rejects(answer(service,user,s,4),/invalid_choice/);
  await assert.rejects(answer(service,who('other'),s,0),/session_changed/);
  for(let i=0;i<15;i++){
   const state=await stored(db,user,'quiz'),correct=state.question.answer,choice=i<target?correct:(correct+1)%4;
   const replies=await Promise.all([answer(service,user,s,choice,{score:999,result:'win'}),answer(service,user,s,choice)]);
   assert.equal(replies.filter(r=>!r.replayed).length,1);
   if(i<14)assert.ok(replies.every(r=>r.coinsAdded.length===0));
   else assert.deepEqual(replies.flatMap(r=>r.coinsAdded).map(g=>g.amount),[target>=12?90:target>=8?60:30]);
   await assert.rejects(answer(service,user,s,(choice+1)%4),/answer_conflict/);
   s=replies[0].arcade;assert.equal(s.history.length,i+1);assert.equal(s.score,Math.min(i+1,target));
   if(i<14){const a=await Promise.all([next(service,user,s),next(service,user,s)]);assert.equal(a[0].arcade.round,a[1].arcade.round);s=a[0].arcade;assert.equal(s.reveal,undefined);}
  }
  assert.equal(s.phase,'over');assert.equal(s.round,14);
  assert.deepEqual((await next(service,user,s)).coinsAdded,[]);
  await assert.rejects(answer(service,user,initial,0),/round_changed/);
  const gains=(await service.state(user)).gains.filter(g=>g.source==='mode:quiz');assert.equal(gains.length,1);assert.equal(gains[0].ball,target>=12?'great':'poke');
 }
}));

test('PostgreSQL: Quiz reward failure rolls back the last answer and retry grants once',opts,()=>withDb(async db=>{
 const service=createBallService({db,pokemon:all,secret:'isolated-test',randomInt:()=>0});let s=(await start(service,me,'quiz')).arcade;
 for(let i=0;i<14;i++){const q=(await stored(db,me,'quiz')).question;s=(await answer(service,me,s,q.answer)).arcade;s=(await next(service,me,s)).arcade;}
 await db.query("ALTER TABLE coin_ledger ADD CONSTRAINT reject_quiz CHECK(source <> 'play:quiz')");
 const choice=(await stored(db,me,'quiz')).question.answer;
 await assert.rejects(answer(service,me,s,choice));assert.equal((await stored(db,me,'quiz')).phase,'playing');
 await db.query('ALTER TABLE coin_ledger DROP CONSTRAINT reject_quiz');
 assert.equal((await answer(service,me,s,choice)).coins.balance,90);assert.deepEqual((await answer(service,me,s,choice)).coinsAdded,[]);
}));

test('PostgreSQL: infinite HL ends at first error, enforces reveals, and awards according to the observed score',opts,()=>withDb(async db=>{
 let now=new Date('2026-11-03T12:00:00Z');const service=createBallService({db,pokemon:small,secret:'isolated-test',randomInt:()=>0,clock:()=>now});
 for(const target of [0,5,15]){
  const user=who('hl-'+target);let s=(await start(service,user,'higher-lower')).arcade;
  assert.equal(s.question.rightValue,undefined);assert.equal(s.reveal,undefined);
  for(let i=0;i<target;i++){
   const q=(await stored(db,user,s.mode)).question,choice=correctHL(q),right=q.right;
   const replies=await Promise.all([answer(service,user,s,choice),answer(service,user,s,choice)]);
   assert.equal(replies[0].arcade.score,i+1);assert.equal(replies[1].arcade.score,i+1);
   assert.deepEqual(replies.flatMap(r=>r.coinsAdded),[]);s=replies[0].arcade;
   await assert.rejects(next(service,user,s),/round_wait/);
   now=new Date(+now+1800);const pair=await Promise.all([next(service,user,s),next(service,user,s)]);
   assert.equal(pair[0].arcade.round,pair[1].arcade.round);s=pair[0].arcade;assert.equal(s.question.left,right);
  }
  const q=(await stored(db,user,s.mode)).question,wrong=correctHL(q)==='higher'?'lower':'higher';
  const ended=await answer(service,user,s,wrong,{score:999,result:'win'});s=ended.arcade;
  assert.equal(s.phase,'over');assert.equal(s.score,target);assert.deepEqual(ended.coinsAdded.map(g=>g.amount),[target>=15?90:target>=5?60:30]);
  assert.deepEqual((await answer(service,user,s,wrong)).coinsAdded,[]);
 }
}));

test('PostgreSQL: rush keeps a server deadline across reloads, rejects extra time and shares the HL daily reward',opts,()=>withDb(async db=>{
 let now=new Date('2026-11-03T12:00:00Z');const options={db,pokemon:small,secret:'isolated-test',randomInt:()=>0,clock:()=>now};let service=createBallService(options);
 let s=(await start(service,me,'higher-lower-rush',{endsAt:9999999999999})).arcade;const deadline=s.endsAt;
 assert.equal(deadline,+now+60000);await assert.rejects(service.arcadeFinish(me,body(s)),/round_wait/);
 for(let i=0;i<25;i++){
  const q=(await stored(db,me,s.mode)).question;s=(await answer(service,me,s,correctHL(q),{score:999})).arcade;
  await assert.rejects(next(service,me,s),/round_wait/);now=new Date(+now+900);s=(await next(service,me,s)).arcade;
 }
 // A wrong answer in rush does not terminate the game or deduct a point.
 const q=(await stored(db,me,s.mode)).question;s=(await answer(service,me,s,correctHL(q)==='higher'?'lower':'higher')).arcade;
 assert.equal(s.phase,'reveal');assert.equal(s.score,25);now=new Date(+now+900);s=(await next(service,me,s)).arcade;
 service=createBallService(options);assert.equal((await start(service,me,s.mode)).arcade.endsAt,deadline);
 now=new Date(deadline);
 const rs=await Promise.all([service.arcadeFinish(me,body(s)),service.arcadeFinish(me,body(s)),answer(service,me,s,'higher',{endsAt:deadline+999999})]);
 assert.ok(rs.every(r=>r.arcade.phase==='over'&&r.arcade.score===25));assert.deepEqual(rs.flatMap(r=>r.coinsAdded).map(g=>g.amount),[90]);
 assert.equal(rs.flatMap(r=>r.added).filter(g=>g.source==='mode:higherlower').length,1);
 // Infinite and rush still share one daily reward.
 s=(await start(service,me,'higher-lower')).arcade;const left=(await stored(db,me,s.mode)).question;
 const ended=await answer(service,me,s,correctHL(left)==='higher'?'lower':'higher');assert.deepEqual(ended.coinsAdded,[]);assert.equal(ended.coins.balance,90);
 // Returning after time ran out settles the previous run; it does not restart its timer.
 const late=who('late');s=(await start(service,late,'higher-lower-rush')).arcade;now=new Date(s.endsAt+1);
  const resumed=await start(service,late,'higher-lower-rush');assert.equal(resumed.arcade.phase,'over');assert.equal(resumed.coins.balance,0,'untouched run is not rewarded');
  assert.equal(resumed.gains.some(g=>g.source==='mode:higherlower'),false,'no Ball without any valid answer');
 // Guests may earn a Ball, but no currency.
 const guest={key:'guest:hl',guestKey:'guest:hl',accountId:null};s=(await start(service,guest,'higher-lower-rush')).arcade;now=new Date(s.endsAt);
  const g=await service.arcadeFinish(guest,body(s));assert.equal(g.coins.balance,0);
  assert.equal(g.added.some(x=>x.source==='mode:higherlower'),false,'guest cannot passively earn a Ball');
}));

test('ECO-06 PostgreSQL: an untouched rush or invalid guess never grants coins or a Ball',opts,()=>withDb(async db=>{
  let now=new Date('2026-11-03T12:00:00Z');
  const service=createBallService({db,pokemon:small,secret:'isolated-test',clock:()=>now,randomInt:()=>0});
  for(const [label,path] of [['start','start'],['finish','finish'],['answer','answer'],['next','next']]){
    const player=who('eco06-idle-'+label);
    now=new Date('2026-11-03T12:00:00Z');
    const s=(await start(service,player,'higher-lower-rush')).arcade;
    await assert.rejects(answer(service,player,s,'not-a-valid-choice'),/invalid_choice/);
    now=new Date(s.endsAt+1);
    let result;
    if(path==='start') result=await start(service,player,'higher-lower-rush');
    else if(path==='finish') result=await service.arcadeFinish(player,body(s));
    else if(path==='answer') result=await answer(service,player,s,'higher');
    else result=await next(service,player,s);
    assert.equal(result.arcade.phase,'over');
    assert.deepEqual(result.coinsAdded,[],'no passive coin grant via '+path);
    assert.equal(result.added.some(g=>g.source==='mode:higherlower'),false,'no passive Ball via '+path);
    const [coins,balls]=await Promise.all([
      db.query("SELECT COUNT(*)::int AS n FROM coin_ledger WHERE identity=$1 AND source='play:higherlower'",[player.key]),
      db.query("SELECT COUNT(*)::int AS n FROM ball_gains WHERE identity=$1 AND source='mode:higherlower'",[player.key])
    ]);
    assert.equal(coins.rows[0].n,0);
    assert.equal(balls.rows[0].n,0);
    assert.deepEqual((await service.state(player)).coins.balance,0);
  }
}));

test('ECO-06 PostgreSQL: one real accepted rush answer still earns 30 once across parallel expiry requests',opts,()=>withDb(async db=>{
  let now=new Date('2026-11-03T12:00:00Z');
  const service=createBallService({db,pokemon:small,secret:'isolated-test',clock:()=>now,randomInt:()=>0});
  const player=who('eco06-played');
  const s=(await start(service,player,'higher-lower-rush')).arcade;
  const valid=await answer(service,player,s,'higher');
  assert.equal(valid.arcade.phase,'reveal');
  assert.equal(valid.coins.balance,0);
  assert.equal(valid.added.some(g=>g.source==='mode:higherlower'),false);
  now=new Date(s.endsAt+1);
  const results=await Promise.all([
    service.arcadeFinish(player,body(s)),
    answer(service,player,s,'lower'),
    next(service,player,s)
  ]);
  assert.ok(results.every(r=>r.arcade.phase==='over'));
  assert.deepEqual(results.flatMap(r=>r.coinsAdded).map(x=>x.amount),[30]);
  assert.equal(results.flatMap(r=>r.added).filter(x=>x.source==='mode:higherlower').length,1);
  const [coins,balls]=await Promise.all([
    db.query("SELECT COUNT(*)::int AS n,COALESCE(SUM(amount),0)::int AS amount FROM coin_ledger WHERE identity=$1 AND source='play:higherlower'",[player.key]),
    db.query("SELECT COUNT(*)::int AS n FROM ball_gains WHERE identity=$1 AND source='mode:higherlower'",[player.key])
  ]);
  assert.deepEqual([coins.rows[0].n,coins.rows[0].amount,balls.rows[0].n],[1,30,1]);
  const replay=await service.arcadeFinish(player,body(s));
  assert.deepEqual(replay.coinsAdded,[]);
  assert.equal(replay.coins.balance,30);
}));

test('PostgreSQL + HTTP: finish is account-bound, JSON-only and cannot end a rush early',opts,()=>withDb(async db=>{
 const express=require('express'),app=express();let now=new Date('2026-11-03T12:00:00Z'),user={id:'http-hl'};
 mountBallRoutes({app,express,db,pokemon:small,secret:'isolated-test',clock:()=>now,randomInt:()=>0,getUser:()=>user,readCookies:()=>({})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const root='http://127.0.0.1:'+server.address().port;
 const post=async(url,b)=>{const r=await fetch(root+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return {status:r.status,...await r.json()};};
 try{
  const state=await(await fetch(root+'/api/balls')).json(),scope=state.actionScope;
  const started=await post('/api/arcade/start',{mode:'higher-lower-rush',startId:randomUUID(),actionScope:scope});const s=started.arcade;
  assert.equal((await post('/API/ARCADE/FINISH/',{...body(s),actionScope:'wrong'})).error,'account_changed');
  assert.equal((await post('/api/arcade/finish',{...body(s),actionScope:scope})).error,'round_wait');
  user={id:'other'};assert.equal((await post('/api/arcade/finish',{...body(s),actionScope:scope})).error,'account_changed');
  user={id:'http-hl'};now=new Date(s.endsAt);
    const done=await post('/api/arcade/finish',{...body(s),actionScope:scope});assert.equal(done.arcade.phase,'over');
    assert.equal(done.coins.balance,0,'no coins on no-answer timeout');
    assert.equal(done.gains.some(x=>x.source==='mode:higherlower'),false);
 }finally{await new Promise(r=>server.close(r));}
}));
