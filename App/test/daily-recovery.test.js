"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {dailyCalendar,dailyGuest,issueDailyGuest,streakFromDays,initDailyDb,createDailyService}=require('../lib/daily-game');
const {compareDaily}=require('../lib/daily-comparison');
const base={gen:1,isAltForm:false,type1:'Plante',type2:'Poison',habitat:'Forêt',color:'Vert',stage:1,height:.7,weight:6.9};
const catalog=[{...base,id:1,name:'Bulbizarre'},{...base,id:25,name:'Pikachu',type1:'Électrik',type2:null,height:.4,weight:6,color:'Jaune'},{...base,id:29,name:'Nidoran♀'},{...base,id:32,name:'Nidoran♂'},{...base,id:20001,isAltForm:true}];
test('Paris date, midnight and both DST transitions use the civil calendar',()=>{
 assert.equal(dailyCalendar(new Date('2026-10-06T21:59:59Z')).day,'2026-10-06');
 assert.equal(dailyCalendar(new Date('2026-10-06T22:00:00Z')).day,'2026-10-07');
 assert.equal(dailyCalendar(new Date('2026-03-29T00:00:00Z')).resetAt,'2026-03-29T22:00:00.000Z');
 assert.equal(dailyCalendar(new Date('2026-10-25T00:00:00Z')).resetAt,'2026-10-25T23:00:00.000Z');
 assert.equal(dailyCalendar(new Date('2026-03-23T12:00:00Z')).number,1);
});
test('Daily guest cookies reject tampering and other secrets',()=>{const g=issueDailyGuest('test');assert.equal(dailyGuest('test',g.cookie),g.id);assert.equal(dailyGuest('other',g.cookie),null);assert.equal(dailyGuest('test',g.cookie+'x'),null);});
test('streak uses validated consecutive wins and abandonment breaks it immediately',()=>{
 const days=['2026-10-04','2026-10-05','2026-10-05','2026-10-06'];assert.deepEqual(streakFromDays(days,'2026-10-06'),{current:3,best:3,lastWin:'2026-10-06'});
 assert.equal(streakFromDays(days,'2026-10-07').current,3);assert.equal(streakFromDays(days,'2026-10-08').current,0);assert.equal(streakFromDays(days,'2026-10-07',true).current,0);
});
test('server comparison remains identical to the Unlimited comparator including tolerances and colors',()=>{
 const game=fs.readFileSync(path.join(__dirname,'../src/script.04.jeu-pokedex.js'),'utf8'),core=fs.readFileSync(path.join(__dirname,'../src/script.07.delegation-party.js'),'utf8');
 const extract=(s,n)=>{const a=s.indexOf('function '+n+'(');return s.slice(a,s.indexOf('\n}',a)+2);};
 const env={};vm.createContext(env);vm.runInContext(['compare','cmpNum'].map(n=>extract(game,n)).concat(['normalizeColorValue','colorTokens','compareColors','norm'].map(n=>extract(core,n))).join('\n'),env);
 const variations=[base,{...base,height:1,weight:21.9},{...base,height:1.01,weight:22},{...base,type1:'Poison',type2:'Plante'},{...base,color:['Vert','Bleu']},{...base,color:'Vert | Bleu'},{...base,type2:null},{...base,isAltForm:true}];
 for(const a of variations)for(const b of variations)assert.deepEqual(compareDaily(a,b),JSON.parse(JSON.stringify(env.compare(a,b))));
});
test('real PostgreSQL: shared private target, recovery, migration, guests, atomicity and Paris rollover',{skip:!process.env.QA_DATABASE_URL,timeout:30000},async()=>{
 const {Pool}=require('pg'),{randomUUID}=require('node:crypto');const admin=new Pool({connectionString:process.env.QA_DATABASE_URL}),schema='daily_v2_'+randomUUID().replaceAll('-','');let db;
 try{
  await admin.query('CREATE SCHEMA '+schema);db=new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:4});
  await db.query(`CREATE TABLE daily_sessions(discord_id TEXT,day DATE,attempts INT,guessed JSONB,finished BOOLEAN,updated_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(discord_id,day));
   CREATE TABLE leaderboard_events(id BIGSERIAL PRIMARY KEY,discord_id TEXT,mode TEXT,score INTEGER,created_at TIMESTAMPTZ,result_key TEXT);
   CREATE UNIQUE INDEX event_key ON leaderboard_events(discord_id,mode,result_key) WHERE result_key IS NOT NULL;
   CREATE TABLE scores(discord_id TEXT,mode TEXT,score INTEGER,username TEXT,avatar TEXT,updated_at TIMESTAMPTZ,PRIMARY KEY(discord_id,mode));`);
  let now=new Date('2026-10-06T12:00:00Z');await initDailyDb(db,now);
  const service=()=>createDailyService({db,pokemon:catalog,compare:compareDaily,legacyTarget:()=>catalog[0],randomInt:()=>0,clock:()=>now});let game=service();
  const guest={key:'guest:x'},A={key:'user:A',accountId:'A',name:'A'},body=(id,who,day='2026-10-06')=>({day,accountId:who.accountId||null,pokemonId:id});
  for(const who of [guest,A]){const s=await game.state(who);assert.equal(s.answerId,undefined);assert.equal(s.attempts,0);assert.equal(s.number,198);assert.equal(JSON.stringify(s).includes('secret'),false);}
  const wrong=await game.guess(guest,body(25,guest));assert.equal(wrong.rows[0].heightDirection,'↑');assert.equal(wrong.rows[0].cmp.height,'close');assert.equal(wrong.answerId,undefined);
  assert.equal((await game.guess(guest,body(25,guest))).attempts,1);assert.equal((await service().state(guest)).attempts,1);
  await assert.rejects(game.guess(A,body(20001,A)),{code:'invalid_guess'});await assert.rejects(game.guess(A,{...body(25,A),accountId:'B'}),{code:'account_changed'});
  await game.guess(guest,body(1,guest));assert.equal((await game.guess(guest,body(32,guest))).attempts,2);assert.equal((await db.query('SELECT * FROM leaderboard_events')).rowCount,0);
  const login={key:'user:G',accountId:'G',guestKey:guest.key};const restored=await game.state(login);assert.equal(restored.won,true);assert.equal(restored.ranked,false);assert.equal((await game.guess(login,body(1,login))).ranked,false);
  assert.equal((await game.distribution()).total,1);
  await game.guess(A,body(25,A));await db.query('ALTER TABLE scores ADD CONSTRAINT fail_score CHECK(score<0)');
  await assert.rejects(game.guess(A,body(1,A)));assert.equal((await game.state(A)).status,'playing');assert.equal((await game.state(A)).attempts,1);await db.query('ALTER TABLE scores DROP CONSTRAINT fail_score');
  const both=await Promise.all([game.guess(A,body(1,A)),game.guess(A,body(1,A))]);assert.equal(both.filter(s=>s.fresh).length,1);assert.equal((await db.query('SELECT * FROM leaderboard_events')).rowCount,1);
  const B={key:'user:B',accountId:'B'};await game.state(B);const loss=await game.abandon(B,body(undefined,B));assert.equal(loss.status,'abandoned');assert.equal(loss.answerId,1);assert.equal((await game.guess(B,body(1,B))).status,'abandoned');
  assert.deepEqual(await game.distribution(),{ok:true,key:'2026-10-06',counts:{'1':0,'2':2,'3':0,'4':0,'5':0,'6':0,'7plus':0},wins:2,abandoned:1,total:3});
  await db.query("INSERT INTO daily_sessions(discord_id,day,attempts,guessed,finished) VALUES('M','2026-10-06',1,'[\"id:1\"]',true),('A','2026-10-05',1,'[\"id:1\"]',true)");
  assert.equal((await game.distribution()).total,4); // Existing verified win counts before its owner returns.
  assert.equal((await game.state({key:'user:M',accountId:'M'})).won,true);assert.equal((await game.distribution()).total,4);assert.equal((await game.state(A)).streak.current,2);
  now=new Date('2026-10-06T22:00:00Z');await assert.rejects(game.guess(A,body(1,A)),{code:'stale_daily'});assert.equal((await game.state(A)).attempts,0);
  const secret=(await db.query("SELECT secret_id FROM daily_rounds WHERE day='2026-10-07'")).rows[0].secret_id;assert.notEqual(secret,1);
  await game.guess(A,body(secret,A,'2026-10-07'));assert.equal((await game.state(A)).streak.current,3);
  // Lock acquisition across midnight must roll back rather than charge tomorrow.
  now=new Date('2026-10-07T21:59:59Z');const blocked=await db.connect();await blocked.query('BEGIN');await blocked.query("SELECT * FROM daily_plays WHERE identity='user:A' AND day='2026-10-07' FOR UPDATE");
  const pending=game.guess(A,body(29,A,'2026-10-07'));await new Promise(r=>setTimeout(r,50));now=new Date('2026-10-07T22:00:00Z');await blocked.query('COMMIT');blocked.release();await assert.rejects(pending,{code:'stale_daily'});
 }finally{if(db)await db.end();await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();}
});
