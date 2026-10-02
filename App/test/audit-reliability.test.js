"use strict";
const test=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs"), vm=require("node:vm"), path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../src/script.10g.leaderboard-v2.js"),"utf8");
function fixture(){
 const store=new Map(), overlay={hidden:true,classList:{contains(){return overlay.hidden;}}};
 let markup="", token="", calls=[];
 const env={window:{__pokedleAuthed:true,addEventListener(){}},connectedAccountUser:{id:"A"},matchHistory:[],playerProfile:{},
 document:{getElementById(id){return id==="overlay-modal"?overlay:null;},querySelector(sel){return !overlay.hidden && token && sel.includes('"'+token+'"') ? {}:null;}},
 ensureOverlay(title,html){markup=html;token=html.match(/data-lb-request="(\d+)"/)?.[1]||"";overlay.hidden=false;},
 escapeHtml:s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;"),
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
 fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:true,top:[],around:[],total:0})};},
 setTimeout(){return 1;},clearTimeout(){},Date,Math,Map,Set,Array,Object,String,Number,Boolean,Promise,JSON};
 vm.createContext(env);vm.runInContext(source,env);
 return {env,store,overlay,calls,get html(){return markup;},replaceModal(){token="";markup="other";},close(){overlay.hidden=true;}};
}
function win(at=Date.now(),attempts=6){return {mode:"daily",result:"win",at,attempts};}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
test('daily recovery rejects missing/future/old times and noninteger scores',()=>{
 const f=fixture(),now=Date.now();f.env.matchHistory=[win(now-86400000,1),win(now+100000,1),win(undefined,2),win(now,1.2),win(now,101),win(now,6)];
 f.env.matchHistory[2].at=undefined;assert.equal(f.env.pendingDailyLeaderboardScore(),6);
});
test('daily recovery coalesces concurrent requests and scopes markers by account',async()=>{
 const f=fixture();f.env.matchHistory=[win()];const d=deferred();let posts=0;
 f.env.fetch=async()=>{posts++;await d.promise;return {ok:true,json:async()=>({ok:true})};};
 const a=f.env.syncPendingDailyLeaderboard(),b=f.env.syncPendingDailyLeaderboard();assert.equal(a,b);d.resolve();await a;assert.equal(posts,1);
 await f.env.syncPendingDailyLeaderboard();assert.equal(posts,1);f.env.connectedAccountUser={id:"B"};await f.env.syncPendingDailyLeaderboard();assert.equal(posts,2);
 assert.equal(f.store.size,2);
});
test('failed submissions remain retryable and never create success markers',async()=>{
 const f=fixture();f.env.matchHistory=[win()];f.env.fetch=async()=>({ok:false,status:503,json:async()=>({ok:false})});
 assert.equal(await f.env.syncPendingDailyLeaderboard(),false);assert.equal(f.store.size,0);
 f.env.fetch=async()=>({ok:true,json:async()=>({ok:true})});assert.equal(await f.env.syncPendingDailyLeaderboard(),true);
});
test('account changes during submission do not write a success marker',async()=>{
 const f=fixture();f.env.matchHistory=[win()];const d=deferred();f.env.fetch=async()=>{await d.promise;return {ok:true,json:async()=>({ok:true})};};
 const p=f.env.syncPendingDailyLeaderboard();f.env.connectedAccountUser={id:"B"};d.resolve();await p;assert.equal(f.store.size,0);
});
test('an application error with HTTP200 is not an empty leaderboard',async()=>{
 const f=fixture();f.env.fetch=async()=>({ok:true,json:async()=>({ok:false,top:[]})});await f.env.openLeaderboardV2('daily','today');
 assert.match(f.html,/indisponible/);assert.match(f.html,/Réessayer/);assert.doesNotMatch(f.html,/Pas encore de performance/);
});
test('empty successful boards remain a valid empty state',async()=>{
 const f=fixture();await f.env.openLeaderboardV2('daily','today');assert.match(f.html,/Pas encore de performance ici/);assert.doesNotMatch(f.html,/indisponible/);
});
test('a late successful response cannot reopen a closed dialog',async()=>{
 const f=fixture(),d=deferred(),started=deferred();f.env.fetch=async()=>{started.resolve();await d.promise;return {ok:true,json:async()=>({ok:true,top:[]})};};
 const p=f.env.openLeaderboardV2('daily','today');await started.promise;f.close();d.resolve();await p;assert.equal(f.overlay.hidden,true);
});
test('a late error cannot replace a different modal',async()=>{
 const f=fixture(),d=deferred(),started=deferred();f.env.fetch=async()=>{started.resolve();await d.promise;throw new Error('offline');};
 const p=f.env.openLeaderboardV2('daily','today');await started.promise;f.replaceModal();d.resolve();await p;assert.equal(f.html,'other');
});
test('connected users without rank never receive the disconnected instruction',()=>{
 const f=fixture();assert.doesNotMatch(f.env.leaderboardUnrankedCopy(true,true),/Connecte-toi/);assert.match(f.env.leaderboardUnrankedCopy(false,false),/Connecte-toi/);
});

test('newer leaderboard requests own the final modal even when the older response arrives last',async()=>{
 const f=fixture(),old=deferred(),started=deferred();
 f.env.fetch=async(url)=>{
  if(url.includes('mode=daily')){started.resolve();await old.promise;return {ok:true,json:async()=>({ok:true,label:'OLD DAILY',top:[]})};}
  return {ok:true,json:async()=>({ok:true,label:'LATEST QUIZ',top:[]})};
 };
 const stale=f.env.openLeaderboardV2('daily','today');await started.promise;
 await f.env.openLeaderboardV2('quiz','week');old.resolve();await stale;
 assert.match(f.html,/LATEST QUIZ/);assert.doesNotMatch(f.html,/OLD DAILY/);
});
