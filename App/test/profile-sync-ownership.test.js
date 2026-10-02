"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const accountSource=fs.readFileSync(path.join(root,"src/script.07.delegation-party.js"),"utf8");
const serverSource=fs.readFileSync(path.join(root,"server.js"),"utf8");
const {profileForClient,profileForStorage}=require("../lib/profile-sync");

const syncStart=accountSource.indexOf('(function () {\n  var SYNC_KEYS = ["profile", "stats", "achievements", "teamBuilder"];');
const syncEnd=accountSource.indexOf("\n// Public leaderboards are event-driven.",syncStart);
assert.ok(syncStart>=0&&syncEnd>syncStart,"profile sync IIFE not found");
const syncSource=accountSource.slice(syncStart,syncEnd);

const KEYS={profile:"profile",stats:"stats",achievements:"achievements",teamBuilder:"teamBuilder"};
function response(data,status=200){return {ok:status>=200&&status<300,status,json:async()=>data};}
function storage(initial={}){
 const map=new Map(Object.entries(initial).map(([k,v])=>[k,String(v)]));
 return {
  map,
  api:{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}
 };
}
async function flush(){for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));}
async function runSync({state,me,server={_accountId:String(me?.id||"")},postStatus=200}){
 const posts=[],beacons=[],intervals=[],listeners={};let reloads=0;
 const context={
  STORAGE_KEYS:KEYS,
  localStorage:state.api,
  document:{readyState:"complete",addEventListener(){}},
  window:{__pokedleAuthed:false,addEventListener(type,fn){listeners[type]=fn;}},
  location:{reload(){reloads++;}},
  navigator:{sendBeacon(url,blob){beacons.push({url,blob});return true;}},
  Blob:class Blob{constructor(parts,options){this.parts=parts;this.options=options;}},
  fetch:async(url,options={})=>{
   if(url==="/api/me")return response({auth:true,user:me||null});
   if(url==="/api/profile"&&options.method!=="POST")return response({ok:true,data:server});
   if(url==="/api/profile"&&options.method==="POST"){
    posts.push(JSON.parse(options.body));
    return response(postStatus<400?{ok:true}:{ok:false,error:"rejected"},postStatus);
   }
   throw new Error("unexpected fetch "+url);
  },
  setInterval(fn){intervals.push(fn);return intervals.length;},
  clearInterval(){},
  setTimeout,clearTimeout,Date,Promise,JSON,Object,Array,String,Number,Boolean,Math,encodeURIComponent,decodeURIComponent
 };
 vm.createContext(context);vm.runInContext(syncSource,context);await flush();
 return {context,posts,beacons,intervals,listeners,get reloads(){return reloads;}};
}
function j(value){return JSON.stringify(value);}

test("server profile ownership helpers stamp reads and reject foreign or ownerless writes",()=>{
 assert.deepEqual(profileForClient({profile:"x"},"A"),{profile:"x",_accountId:"A"});
 assert.equal(profileForStorage({_accountId:"B",profile:"x"},"A").error,"profile_owner_mismatch");
 assert.equal(profileForStorage({profile:"x"},"A").error,"profile_owner_mismatch");
 assert.deepEqual(profileForStorage({_accountId:"A",profile:"x"},"A"),{ok:true,data:{_accountId:"A",profile:"x"}});
 assert.match(serverSource,/profileForClient\(\(r\.rows\[0\][\s\S]*user\.id\)/);
 assert.match(serverSource,/profileForStorage\(req\.body, user\.id\)/);
 assert.match(serverSource,/profile_owner_mismatch" \? 409 : 400/);
});

test("logout caches account A and removes only synced A data from the anonymous browser",async()=>{
 const state=storage({pokedle_sync_owner_v2:"A",pokedle_sync_at:"100",profile:j({nickname:"A"}),stats:j({wins:8}),unrelated:"keep"});
 const run=await runSync({state,me:null,server:{}});
 assert.equal(run.reloads,1);
 assert.equal(state.map.get("pokedle_sync_owner_v2"),undefined);
 assert.equal(state.map.get("profile"),undefined);assert.equal(state.map.get("stats"),undefined);
 assert.equal(state.map.get("unrelated"),"keep");
 const cached=JSON.parse(state.map.get("pokedle_sync_cache_v2:A"));
 assert.equal(cached._accountId,"A");assert.equal(cached.profile,j({nickname:"A"}));
 assert.equal(run.posts.length,0);
});

test("A -> B never uploads A data when B has no server profile",async()=>{
 const state=storage({pokedle_sync_owner_v2:"A",pokedle_sync_at:"100",profile:j({nickname:"A"}),stats:j({wins:8})});
 const run=await runSync({state,me:{id:"B"},server:{_accountId:"B"}});
 assert.equal(run.reloads,1);assert.equal(run.posts.length,0);
 assert.equal(state.map.get("pokedle_sync_owner_v2"),"B");
 assert.equal(state.map.get("profile"),undefined);assert.equal(state.map.get("stats"),undefined);
 assert.equal(JSON.parse(state.map.get("pokedle_sync_cache_v2:A")).profile,j({nickname:"A"}));
});

test("switching back to A restores A's account-scoped cache instead of B's active values",async()=>{
 const state=storage({
  pokedle_sync_owner_v2:"B",pokedle_sync_at:"200",profile:j({nickname:"B"}),
  "pokedle_sync_cache_v2:A":j({_accountId:"A",_savedAt:150,profile:j({nickname:"A"}),stats:j({wins:9})})
 });
 const run=await runSync({state,me:{id:"A"},server:{_accountId:"A"}});
 assert.equal(run.reloads,1);assert.equal(run.posts.length,0);
 assert.equal(state.map.get("pokedle_sync_owner_v2"),"A");
 assert.equal(state.map.get("profile"),j({nickname:"A"}));assert.equal(state.map.get("stats"),j({wins:9}));
});

test("first login may claim genuinely anonymous progress and stamps the account on upload",async()=>{
 const state=storage({profile:j({nickname:"Anon"}),stats:j({wins:3})});
 const run=await runSync({state,me:{id:"B"},server:{_accountId:"B"}});
 assert.equal(run.reloads,0);assert.equal(run.posts.length,1);
 assert.equal(run.posts[0]._accountId,"B");
 assert.equal(run.posts[0].profile,j({nickname:"Anon"}));
 assert.equal(state.map.get("pokedle_sync_owner_v2"),"B");
 assert.ok(Number(state.map.get("pokedle_sync_at"))>0);
});

test("ambiguous legacy synced data is backed up and never claimed by a new empty account",async()=>{
 const state=storage({pokedle_sync_at:"123",profile:j({nickname:"LegacyA"}),stats:j({wins:11}),unrelated:"keep"});
 const run=await runSync({state,me:{id:"B"},server:{_accountId:"B"}});
 assert.equal(run.reloads,1);assert.equal(run.posts.length,0);
 assert.equal(state.map.get("pokedle_sync_owner_v2"),"B");
 assert.equal(state.map.get("profile"),undefined);assert.equal(state.map.get("stats"),undefined);
 assert.equal(state.map.get("unrelated"),"keep");
 const backup=JSON.parse(state.map.get("pokedle_sync_legacy_backup_v2"));
 assert.equal(backup.profile,j({nickname:"LegacyA"}));assert.equal(backup._savedAt,123);
});

test("matching legacy sync point lets the same account keep newer local values",async()=>{
 const state=storage({pokedle_sync_at:"123",profile:j({nickname:"LocalNewer"})});
 const run=await runSync({state,me:{id:"A"},server:{_accountId:"A",_savedAt:123,profile:j({nickname:"ServerOld"})}});
 assert.equal(run.reloads,0);assert.equal(run.posts.length,1);
 assert.equal(run.posts[0]._accountId,"A");assert.equal(run.posts[0].profile,j({nickname:"LocalNewer"}));
 assert.equal(state.map.get("pokedle_sync_owner_v2"),"A");
});

test("same-owner newer server state wins but displaced local state is preserved as a conflict backup",async()=>{
 const state=storage({pokedle_sync_owner_v2:"A",pokedle_sync_at:"100",profile:j({nickname:"Local"}),stats:j({wins:2})});
 const run=await runSync({state,me:{id:"A"},server:{_accountId:"A",_savedAt:200,profile:j({nickname:"Server"}),stats:j({wins:5})}});
 assert.equal(run.reloads,1);assert.equal(run.posts.length,0);
 assert.equal(state.map.get("profile"),j({nickname:"Server"}));assert.equal(state.map.get("stats"),j({wins:5}));
 const conflict=JSON.parse(state.map.get("pokedle_sync_conflict_v2:A"));
 assert.equal(conflict.profile,j({nickname:"Local"}));
});

test("a stale page cannot push after its owner marker changes underneath it",async()=>{
 const state=storage({pokedle_sync_owner_v2:"A",pokedle_sync_at:"100",profile:j({nickname:"A"})});
 const run=await runSync({state,me:{id:"A"},server:{_accountId:"A",_savedAt:100,profile:j({nickname:"A"})}});
 const before=run.posts.length;
 state.api.setItem("pokedle_sync_owner_v2","B");
 await run.intervals[0]();await flush();
 assert.equal(run.posts.length,before);
});

test("pagehide caches current account data and sends an owner-stamped beacon",async()=>{
 const state=storage({pokedle_sync_owner_v2:"A",pokedle_sync_at:"100",profile:j({nickname:"A"})});
 const run=await runSync({state,me:{id:"A"},server:{_accountId:"A",_savedAt:100,profile:j({nickname:"A"})}});
 run.listeners.pagehide();await flush();
 const cached=JSON.parse(state.map.get("pokedle_sync_cache_v2:A"));
 assert.equal(cached._accountId,"A");assert.equal(cached.profile,j({nickname:"A"}));
 assert.equal(run.beacons.length,1);
 assert.equal(run.beacons[0].url,"/api/profile");
 assert.match(String(run.beacons[0].blob.parts[0]),/"_accountId":"A"/);
});
