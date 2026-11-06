"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const feature=fs.readFileSync(path.join(__dirname,"../src/script.10xzr.dex-showcase.js"),"utf8");
const mergeSource=fs.readFileSync(path.join(__dirname,"../src/script.07a.profile-merge.js"),"utf8").split("// Repair (31/10/2026)")[0];

function fixture(){
  const ids=[1,4,7,10,25,133,150,380];
  const catalogue=new Map(ids.map(id=>[id,{id,name:"Pokémon "+id}]));
  const profile={pokedexShowcaseIds:[],pokedexShowcaseUpdatedAt:0};
  let saved=0,synced=0,shared=[],requestCount=0;
  let response={ok:true,captures:ids.map(id=>({id,normal:1,shiny:0})),captureHistory:[{id:1,normal:1,shiny:0},{id:25,normal:1,shiny:0}],catchableTotal:852};
  const ctx={
    playerProfile:profile,POKEMON_BY_ID:catalogue,pokedexExperienceView:"collection",pokedexSelectedId:25,
    wildCaptures:Object.fromEntries(ids.map(id=>[id,{normal:1,shiny:0}])),
    wildCaptureHistory:{1:{normal:1,shiny:0},25:{normal:1,shiny:0}},wildCatchableTotal:852,
    escapeHtml:s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;"),
    getPokemonSprite:p=>"sprite-"+p.id+".png",
    saveProfile(){saved++},syncProfileNow(){synced++},
    showToast(){},renderPokedexCollectionHub(){},renderPokedexDetail(){},
    document:{getElementById(){return null},querySelector(){return null}},
    fetch:async(url,config)=>{requestCount++;assert.equal(url,"/api/wild/collection");assert.equal(config.cache,"no-store");return {ok:true,json:async()=>response}},
    navigator:{share:async(v)=>{shared.push(v.text)},clipboard:{writeText:async t=>{shared.push(t)}}},
    Date,Array,Object,Map,Set,String,Number,Math
  };
  vm.createContext(ctx);
  vm.runInContext(feature+"\nthis.showcase={ids:pokedexShowcaseIds,toggle:togglePokedexShowcase,owned:pokedexShowcaseOwnedCount,button:pokedexShowcaseButtonHtml,html:pokedexShowcaseHubHtml,goal:pokedexShowcaseMilestone,shareText:pokedexShowcaseShareText,share:sharePokedexShowcase};",ctx);
  return {ctx,profile,shared,setResponse:x=>response=x,get saved(){return saved},get synced(){return synced},get calls(){return requestCount}};
}

test("DEX-04: exactly six optional selected and currently owned; no auto share",()=>{
  const f=fixture(),c=f.ctx,api=c.showcase;
  for(const id of [1,4,7,10,25,133])assert.equal(api.toggle(id),true);
  assert.deepEqual([...api.ids()],[1,4,7,10,25,133]);
  assert.equal(api.toggle(380),false,"seventh rejected");
  assert.equal(f.saved,6);assert.equal(f.synced,6);assert.equal(f.calls,0);
  assert.equal(f.shared.length,0,"never share automatically");
  assert.match(api.html(),/6 \/ 6/);
  assert.match(api.html(),/Partager volontairement \(6\)/);
  assert.match(api.button(c.POKEMON_BY_ID.get(380)),/disabled/);
  assert.equal(api.toggle(7),true);assert.equal(api.toggle(380),true);
  assert.deepEqual([...api.ids()],[1,4,10,25,133,380]);
  assert.equal(f.saved,8);
  assert.match(api.html(),/Objectif proche : 2 \/ 5 espèces capturées personnellement/);
});

test("DEX-04: ownership is mandatory for adding and only server-owned species appear in share",()=>{
  const f=fixture(),c=f.ctx,api=c.showcase;
  assert.equal(api.toggle(1),true); assert.equal(api.toggle(25),true);
  c.wildCaptures={25:{normal:1,shiny:0}};
  assert.equal(api.toggle(380),false,"no inventory proof");
  assert.match(api.html(),/Plus possédé · non partageable/);
  const safe=api.shareText([{id:25,normal:1,shiny:0}],[]);
  assert.match(safe,/Pokémon 25/);
  assert.doesNotMatch(safe,/Pokémon 1/);
  assert.equal(api.toggle(1),true,"lost species still removable from saved selection");
  c.wildCaptures=null;
  assert.equal(api.toggle(4),false,"unavailable inventory is not owned");
  assert.match(api.html(),/Inventaire indisponible/);
  assert.match(api.html(),/disabled/);
  assert.equal(api.shareText([],[]),null,"never share an empty result");
});

test("DEX-04: sharing is explicitly requested and validates a fresh server snapshot",async()=>{
  const f=fixture(),c=f.ctx,api=c.showcase;
  for(const id of [1,25])api.toggle(id);
  f.setResponse({ok:true,captures:[{id:25,normal:2,shiny:0}],captureHistory:[{id:25,normal:1,shiny:0}],catchableTotal:852});
  assert.equal(f.shared.length,0);
  assert.equal(await api.share(),true);
  assert.equal(f.calls,1);
  assert.equal(f.shared.length,1);
  assert.match(f.shared[0],/Pokémon 25/);
  assert.doesNotMatch(f.shared[0],/Pokémon 1/,"traded-away Pokemon excluded from share");
  assert.match(f.shared[0],/Objectif proche : 1 \/ 5/);
  f.setResponse({ok:false,captures:[]});
  assert.equal(await api.share(),false);
  assert.equal(f.shared.length,1,"API unavailable cannot share stale inventory");
});

test("DEX-04: damaged selections are bounded and the close goal is not a reward",()=>{
  const f=fixture(),c=f.ctx,api=c.showcase;
  assert.deepEqual([...api.ids([null,0,-1,1.2,"25","25",1,4,7,10,133,150,380])],[25,1,4,7,10,133]);
  assert.equal(api.goal(null),null,"missing capture history cannot be interpreted as zero");
  assert.equal(api.goal([{id:25,normal:1,shiny:0}],852).goal,5);
  assert.equal(api.goal(Array.from({length:7},(_,i)=>({id:i+1,normal:1,shiny:0})),852).goal,10);
  assert.equal(api.goal(Array.from({length:852},(_,i)=>({id:i+1,normal:1,shiny:0})),852).reached,true);
  const p=c.POKEMON_BY_ID.get(150);p.name='<script>bad</script>';
  assert.equal(api.toggle(150),true);
  assert.doesNotMatch(api.html(),/<script>/);
  assert.match(api.html(),/&lt;script>/);
});

test("DEX-04: cross-device latest explicit selection wins including clearing and old clients",()=>{
  const ctx={};vm.createContext(ctx);vm.runInContext(mergeSource+"\nthis.merge=mergeSyncBlobs;",ctx);
  const blob=p=>({_accountId:"X",profile:JSON.stringify(p)});
  const merge=(a,b,common)=>JSON.parse(ctx.merge(blob(a),blob(b),common?blob(common):null).profile);
  const base={pokedexShowcaseIds:[1,4,7],pokedexShowcaseUpdatedAt:100};
  const pc={pokedexShowcaseIds:[1,4,7,10],pokedexShowcaseUpdatedAt:200};
  const phone={pokedexShowcaseIds:[4],pokedexShowcaseUpdatedAt:300};
  assert.deepEqual([...merge(pc,phone,base).pokedexShowcaseIds],[4]);
  assert.deepEqual([...merge(phone,pc,base).pokedexShowcaseIds],[4]);
  assert.deepEqual([...merge({pokedexShowcaseIds:[],pokedexShowcaseUpdatedAt:400},phone,base).pokedexShowcaseIds],[]);
  assert.deepEqual([...merge({},pc,base).pokedexShowcaseIds],[1,4,7,10]);
  assert.deepEqual([...merge({pokedexShowcaseIds:[1,1,-3,null,4,7,10,25,133,380],pokedexShowcaseUpdatedAt:500},pc,base).pokedexShowcaseIds],[1,4,7,10,25,133]);
});
