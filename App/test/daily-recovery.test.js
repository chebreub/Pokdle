"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {recordLeaderboardResultInTransaction}=require("../lib/leaderboard-store");
const full=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
const start=full.indexOf("function dailyUtcKey() {"),end=full.indexOf("// Legacy bulk score import",start);
assert.ok(start>=0&&end>start);const source=full.slice(start,end),DAY="2026-10-02";
const catalog=[{id:1,name:"Bulbizarre"},{id:25,name:"Pikachu"},{id:29,name:"Nidoran♀"},{id:32,name:"Nidoran♂"},{id:20001,name:"Mega Test",isAltForm:true}];
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu,"").toLowerCase();
function memoryPool(){let state={sessions:new Map(),events:new Map(),scores:new Map()};const pool={active:0,connections:0,failConnect:false,failScore:false,state:()=>state};
 function run(sql,args=[]){const key=String(args[0])+":"+String(args[1]);
  if(sql.startsWith("INSERT INTO daily_sessions")){if(!state.sessions.has(key))state.sessions.set(key,{attempts:0,guessed:[],finished:false});return {rows:[]};}
  if(sql.startsWith("SELECT attempts"))return {rows:state.sessions.has(key)?[structuredClone(state.sessions.get(key))]:[]};
  if(sql.startsWith("UPDATE daily_sessions")){state.sessions.set(key,{attempts:Number(args[2]),guessed:JSON.parse(args[3]),finished:Boolean(args[4])});return {rows:[]};}
  if(sql.startsWith("INSERT INTO leaderboard_events")){const event=key+":"+String(args[3]);if(state.events.has(event))return {rows:[]};state.events.set(event,Number(args[2]));return {rows:[{score:Number(args[2])}]};}
  if(sql.startsWith("SELECT score"))return {rows:[{score:state.events.get(key+":"+String(args[2]))}]};
  if(sql.startsWith("INSERT INTO scores")){if(pool.failScore)throw Error("score failure");state.scores.set(key,Number(args[2]));return {rows:[]};}
  throw Error("Unexpected SQL "+sql);}
 pool.query=async(sql,args)=>run(sql,args);pool.connect=async()=>{pool.connections++;if(pool.failConnect)throw Error("connect failure");assert.equal(pool.active,0);pool.active++;let before;
  return {query:async(sql,args)=>{if(sql==="BEGIN"){before=structuredClone(state);return {rows:[]};}if(sql==="ROLLBACK"){state=before;return {rows:[]};}if(sql==="COMMIT")return {rows:[]};return run(sql,args);},release(){pool.active--;}};};return pool;}
function fixture(pool=memoryPool()){let today=DAY;class Clock extends Date{constructor(...args){super(...(args.length?args:[today+"T12:00:00Z"]));}}
 const routes=new Map(),env={Date:Clock,pgPool:pool,POKEMON_LIST:catalog,POKEMON_BY_NORMALIZED_NAME:new Map(catalog.map(p=>[normalize(p.name),p])),normalizeName:normalize,
  authReady:()=>true,getSessionUser:req=>req.user,leaderboardConfig:()=>({direction:"asc",max:100}),recordLeaderboardResultInTransaction,
  console:{error(){}},app:{post(url,...fns){routes.set(url,fns.at(-1));}},express:{json:()=>({})}};vm.createContext(env);vm.runInContext(source,env);
 async function invoke(route,{name,day=DAY,accountId,user={id:"A"}}={}){const res={statusCode:200,status(c){this.statusCode=c;return this;},json(d){this.data=JSON.parse(JSON.stringify(d));return this;}};
  await routes.get("/api/daily/"+route)({user,body:{name,day,accountId:accountId===undefined?user?.id:accountId}},res);return res;}
 const answer=env.serverDailyPokemon(DAY),wrong=catalog.find(p=>!p.isAltForm&&p.id!==answer.id);return {pool,env,invoke,answer,wrong,setDay:v=>{today=v;}};}
test("Daily rejects stale context and invalid species before DB mutation",async()=>{const f=fixture();assert.equal((await f.invoke("guess",{name:f.wrong.name,user:null})).statusCode,401);
 assert.equal((await f.invoke("guess",{name:f.wrong.name,day:"2026-10-01"})).data.error,"stale_daily");assert.equal((await f.invoke("guess",{name:f.wrong.name,accountId:"B"})).data.error,"account_changed");
 assert.equal((await f.invoke("guess",{name:"Mega Test"})).statusCode,400);assert.equal(f.pool.connections,0);});
test("connection acquisition failure is an HTTP503",async()=>{const f=fixture();f.pool.failConnect=true;const r=await f.invoke("guess",{name:f.wrong.name});assert.equal(r.statusCode,503);assert.equal(f.pool.active,0);});
test("lost wrong response is reconstructible through duplicate and session snapshots",async()=>{const f=fixture();await f.invoke("guess",{name:f.wrong.name});const retry=await f.invoke("guess",{name:f.wrong.name});
 assert.equal(retry.data.error,"duplicate_guess");assert.equal(retry.data.attempts,1);assert.deepEqual(retry.data.guessed,[f.wrong.name]);const session=await f.invoke("session");assert.deepEqual(session.data.guessed,[f.wrong.name]);});
test("lost winning response is reconstructible without another score",async()=>{const f=fixture();await f.invoke("guess",{name:f.wrong.name});await f.invoke("guess",{name:f.answer.name});const retry=await f.invoke("guess",{name:f.answer.name});
 assert.equal(retry.data.error,"daily_finished");assert.equal(retry.data.finished,true);assert.equal(retry.data.attempts,2);assert.equal(f.pool.state().events.size,1);assert.equal(f.pool.state().scores.get("A:daily"),2);});
test("score failure rolls back Daily and retry remains clean",async()=>{const f=fixture();await f.invoke("guess",{name:f.wrong.name});f.pool.failScore=true;assert.equal((await f.invoke("guess",{name:f.answer.name})).statusCode,503);
 assert.equal(f.pool.state().sessions.get("A:"+DAY).attempts,1);assert.equal(f.pool.state().events.size,0);f.pool.failScore=false;assert.equal((await f.invoke("guess",{name:f.answer.name})).data.attempts,2);});
test("legacy normalized histories stay readable and new Nidoran uses a stable ID",async()=>{const f=fixture();f.pool.state().sessions.set("A:"+DAY,{attempts:1,guessed:[normalize(f.wrong.name)],finished:false});
 assert.deepEqual((await f.invoke("session")).data.guessed,[f.wrong.name]);const r=await f.invoke("guess",{name:"Nidoran♀"});if(r.statusCode===200)assert.ok(f.pool.state().sessions.get("A:"+DAY).guessed.includes("id:29"));});
test("UTC rollover during the transaction rolls back the old day",async()=>{const f=fixture(),orig=f.pool.connect;f.pool.connect=async()=>{const c=await orig();f.setDay("2026-10-03");return c;};
 const r=await f.invoke("guess",{name:f.wrong.name});assert.equal(r.data.error,"stale_daily");assert.equal(f.pool.state().sessions.size,0);assert.equal(f.pool.state().events.size,0);});
test("real PostgreSQL keeps failure/retry atomic and concurrent winners idempotent",{skip:!process.env.QA_DATABASE_URL,timeout:20000},async()=>{const {Pool}=require("pg"),{randomUUID}=require("node:crypto");
 const admin=new Pool({connectionString:process.env.QA_DATABASE_URL}),schema="daily_"+randomUUID().replaceAll("-","");let pool;try{await admin.query("CREATE SCHEMA "+schema);const options={connectionString:process.env.QA_DATABASE_URL,options:"-c search_path="+schema,connectionTimeoutMillis:1000};
 pool=new Pool({...options,max:1});await pool.query(`CREATE TABLE daily_sessions(discord_id TEXT,day DATE,attempts INTEGER NOT NULL DEFAULT 0,guessed JSONB NOT NULL DEFAULT '[]',finished BOOLEAN NOT NULL DEFAULT false,updated_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(discord_id,day));
 CREATE TABLE leaderboard_events(id BIGSERIAL PRIMARY KEY,discord_id TEXT,mode TEXT,score INTEGER,created_at TIMESTAMPTZ,result_key TEXT);CREATE UNIQUE INDEX daily_event_key ON leaderboard_events(discord_id,mode,result_key) WHERE result_key IS NOT NULL;
 CREATE TABLE scores(discord_id TEXT,mode TEXT,score INTEGER CONSTRAINT fail_score CHECK(score<0),username TEXT,avatar TEXT,updated_at TIMESTAMPTZ,PRIMARY KEY(discord_id,mode));`);
 let f=fixture(pool);await f.invoke("guess",{name:f.wrong.name});assert.equal((await f.invoke("guess",{name:f.answer.name})).statusCode,503);assert.deepEqual((await pool.query("SELECT attempts,finished FROM daily_sessions")).rows,[{attempts:1,finished:false}]);
 await pool.query("ALTER TABLE scores DROP CONSTRAINT fail_score");assert.equal((await f.invoke("guess",{name:f.answer.name})).statusCode,200);await pool.end();pool=new Pool({...options,max:2});f=fixture(pool);
 const rs=await Promise.all([f.invoke("guess",{name:f.answer.name,user:{id:"B"}}),f.invoke("guess",{name:f.answer.name,user:{id:"B"}})]);assert.deepEqual(rs.map(r=>r.statusCode).sort(),[200,409]);assert.equal((await pool.query("SELECT * FROM leaderboard_events WHERE discord_id='B'")).rowCount,1);
 }finally{if(pool)await pool.end();await admin.query("DROP SCHEMA IF EXISTS "+schema+" CASCADE");await admin.end();}});
