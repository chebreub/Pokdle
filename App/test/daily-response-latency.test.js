'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {dailyCalendar,issueDailyGuest}=require('../lib/daily-game');
const {mountWordleRoutes}=require('../lib/daily-wordle');
const {mountDossierRoutes}=require('../lib/daily-dossier');
const {buildDossierQuestions}=require('../lib/dossier-questions');
// Exercise registered route handlers, including cookie identity, prerequisites and transactions.
for(const mode of ['wordle','dossier'])test(mode+': answers use one transaction; restoring upstream games is limited to opening the stage',async()=>{
  const day=dailyCalendar().day,secret='latency-test',guest=issueDailyGuest(secret),routes=new Map(),queries=[],upstream=[];
  const now=new Date();let row=mode==='wordle'?{guessed:[],status:'playing',started_at:now,elapsed_ms:null,account_id:null}:{answers:[],points:0,status:'playing',started_at:now,elapsed_ms:null,account_id:null};
  const questions=buildDossierQuestions(25,day);
  const query=async(sql,args)=>{
    queries.push(sql);
    if(sql.startsWith('SELECT w.*,r.secret_id'))return {rows:[{...row,secret_id:25}]};
    if(sql.startsWith('SELECT status FROM'))return {rows:[{status:'won'}]};
    if(sql.startsWith('SELECT secret_id FROM wordle_rounds'))return {rows:[{secret_id:25}]};
    if(sql.startsWith('SELECT * FROM dossier_rounds'))return {rows:[{pokemon_id:25,questions}]};
    if(sql.includes('FOR UPDATE'))return {rows:[row]};
    if(sql.startsWith('UPDATE wordle_plays'))row={...row,guessed:JSON.parse(args[2]),status:args[3]};
    if(sql.startsWith('UPDATE dossier_plays'))row={...row,answers:JSON.parse(args[2]),points:args[3],status:args[4]};
    return {rows:[]};
  };
  const db={query,connect:async()=>({query,release(){}})},app={get:(path,handler)=>routes.set('GET '+path,handler),post:(path,_middleware,handler)=>routes.set('POST '+path,handler)};
  const daily={state:async()=>upstream.push('daily')},wordle={ready:Promise.resolve(true),state:async()=>upstream.push('wordle')};
  const options={app,express:{json:()=>()=>{}},db,secret,getUser:()=>null,readCookies:()=>({pokdle_daily:guest.cookie}),daily,wordle,pokemon:[{id:25,name:'Pikachu'},{id:4,name:'Salamèche'}]};
  if(mode==='wordle')mountWordleRoutes(options);else mountDossierRoutes(options);
  const invoke=async(method,body)=>{
    const res={headers:{},statusCode:200,set(name,value){this.headers[name]=value;return this;},cookie(){},status(code){this.statusCode=code;return this;},json(data){this.data=data;return this;}};
    const req={method,ip:'127.0.0.1',body,is:()=>true,get:()=>null};
    await routes.get(method+' /api/daily/'+mode+(method==='POST'?(mode==='wordle'?'/guess':'/answer'):''))(req,res);return res;
  };
  assert.equal((await invoke('GET')).data.ok,true);assert.deepEqual(upstream,mode==='wordle'?['daily']:['daily','wordle']);
  queries.length=0;upstream.length=0;
  const body=mode==='wordle'?{day,accountId:null,pokemonId:4}:{day,accountId:null,index:0,choice:(questions[0].answer+1)%4};
  let res=await invoke('POST',body);assert.equal(res.statusCode,200);assert.equal(res.data.ok,true);assert.deepEqual(upstream,[]);assert.ok(queries.length<=6,'Warm answer exceeded six SQL calls: '+queries.length);
  assert.ok(!queries.some(s=>s.includes('pg_advisory_xact_lock')),'Existing rounds must not serialize every player');
  if(mode==='wordle'){
    assert.equal(queries.length,4,'An established Wordle answer uses BEGIN, one locked read, UPDATE, COMMIT');
    assert.match(res.headers['Server-Timing'],/db_connect;dur=.*db;dur=.*sql;desc="4 queries"/);
    assert.equal(JSON.parse(JSON.stringify(res.data)).timing,undefined,'Internal diagnostics do not enter the game payload');
  }
  assert.match(res.headers['Server-Timing'],new RegExp('^'+mode+';dur=\\d+(?:\\.\\d+)?'));
  assert.equal(mode==='wordle'?res.data.attempts:res.data.answered,1);
  res=await invoke('POST',body);assert.equal(mode==='wordle'?res.data.attempts:res.data.answered,1);assert.equal(res.data.duplicate,true);
});
