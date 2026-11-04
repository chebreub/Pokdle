"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const client = fs.readFileSync(path.join(__dirname, "../src/script.10xze.collection-caught.js"), "utf8");
const balls = fs.readFileSync(path.join(__dirname, "../lib/poke-balls.js"), "utf8");
const { WILD_POOL, EXPEDITIONS } = require("../lib/poke-balls");

function fixture() {
  const mons = [10,25,150,151,373,380,1009].map(id=>({id,name:"Pokemon "+id,gen:1}));
  const discoveries = {
    10:{source:"game"},
    25:{source:"game"},
    150:{source:"game", missions:{g1_mewtwo:100}},
    151:{source:"secret",secrets:{starters:100}},
    373:{source:"history"},
    380:{source:"capture"}
  };
  const profile = {
    discoveries,
    albumMissionClaims:{g1_mewtwo:100},
    secrets:{claimed:{starters:100}}
  };
  const header={textContent:""}, intro={textContent:""}, national={innerHTML:""};
  const identity={dataset:{},querySelector(sel){return sel==="h3"?header:sel==="p"?intro:null;}};
  const filters={dataset:{},innerHTML:"",querySelectorAll(){return [];}};
  const legend={dataset:{},innerHTML:""};
  const hub={querySelector(sel){return sel===".pokedex-collection-identity"?identity:null;}};
  const map=new Map([
    ["pokedex-collection-hub",hub],["pokedex-collection-filters",filters],
    ["pokedex-collection-legend",legend],["pokedex-collection-national",national]
  ]);
  let rendered=0;
  const ctx = {
    playerProfile:profile,pokedexExperienceView:"collection",pokedexCollectionFilter:"all",
    wildCaptures:{25:{normal:1,shiny:0},380:{normal:1,shiny:0}},
    wildCatchableTotal:852,
    ALBUM_MISSIONS:[{id:"g1_mewtwo",pokemonId:150}],
    SECRET_MISSIONS:[{id:"starters",pokemonId:151}],
    pokedexCollectionState(p){
      const entry=profile.discoveries[p.id]||null;
      return {kind:entry?"registered":"unknown",entry};
    },
    pokedexCollectionBaseCatalogue(){return mons;},
    pokedexCollectionNationalStats(){return {found:6,total:7,formsFound:0,formsTotal:0,missions:2};},
    pokedexCollectionMatchesFilter(){return true;},
    setPokedexCollectionFilter(){},
    renderPokedexGrid(){rendered++;},
    renderPokedexCollectionHub(){},
    createPokedexCard(){
      const classes=[];
      const badge={classList:{add(...args){classes.push(...args);}},innerHTML:"",insertAdjacentHTML(){}};
      return {classes,classList:{add(...args){classes.push(...args);}},querySelector(sel){return sel===".pokedex-collection-state"?badge:null;},badge};
    },
    document:{getElementById(id){return map.get(id)||null;}},
    Number,Object,Array,Math,Set,String,Boolean
  };
  vm.createContext(ctx);
  vm.runInContext(client+"\nthis.__filter=pokedexCollectionMatchesFilter;this.__progress=colCollectionProgress;this.__obtained=colIsObtained;this.__reward=colRewardKind;",ctx);
  return {ctx,mons,profile,header,intro,filters,legend,national,get rendered(){return rendered;}};
}

test("collection counts are disjoint in meaning and never turn a guessed Pokemon into a prize",()=>{
  const f=fixture(),before=JSON.stringify(f.profile);
  const p=f.ctx.__progress(f.mons);
  assert.deepEqual({...p},{seen:6,caught:2,obtained:4});
  assert.equal(f.ctx.__obtained(f.mons[0]),false,"guessed Chenipan is seen but not owned");
  assert.equal(f.ctx.__obtained(f.mons[4]),false,"historical Drattak guess is not a prestige prize");
  assert.equal(f.ctx.__obtained(f.mons[1]),true,"server-held Pikachu is captured");
  assert.equal(f.ctx.__reward(f.mons[2]),"mission");
  assert.equal(f.ctx.__reward(f.mons[3]),"secret");
  assert.equal(f.ctx.__obtained(f.mons[5]),true,"expedition encounter is held");
  assert.equal(JSON.stringify(f.profile),before,"no migration or profile writes");
});

test("filters distinguish all seen, actual capture, rewards and missing entries",()=>{
  const f=fixture(),c=f.ctx;
  function ids(key){
    c.pokedexCollectionFilter=key;
    return f.mons.filter(p=>c.__filter(p)).map(p=>p.id);
  }
  assert.deepEqual(ids("seen"),[10,25,150,151,373,380]);
  assert.deepEqual(ids("caught"),[25,380]);
  assert.deepEqual(ids("obtained"),[25,150,151,380]);
  assert.deepEqual(ids("missing"),[1009]);
  assert.ok(!ids("obtained").includes(373),"rarity is not bypassed by guessing");
});

test("collection UI shows 852 catchable, 1025 national on real site, and distinguishes mission badges",()=>{
  const f=fixture();
  f.ctx.renderPokedexCollectionHub();
  assert.match(f.national.innerHTML,/👁️ Vus[\s\S]*?<em>6 \/ 7<\/em>/);
  assert.match(f.national.innerHTML,/Capturés[\s\S]*?<em>2 \/ 852<\/em>/);
  assert.match(f.national.innerHTML,/◆ Obtenus[\s\S]*?<em>4 \/ 7<\/em>/);
  assert.match(f.filters.innerHTML,/Obtenus/);
  assert.match(f.intro.textContent,/Obtenu = capturé ou récompense réclamée/);
  const badge=f.ctx.createPokedexCard(f.mons[2]).badge.innerHTML;
  assert.match(badge,/Mission obtenue/);
  assert.match(f.ctx.createPokedexCard(f.mons[3]).badge.innerHTML,/Secret obtenu/);
  assert.match(f.ctx.createPokedexCard(f.mons[0]).badge.innerHTML,/Vu/);
  assert.match(f.ctx.createPokedexCard(f.mons[5]).badge.innerHTML,/Attrapé/);
});

test("missing server capture data never invents 0 captured or 0 obtained",()=>{
  const f=fixture();
  f.ctx.wildCaptures=null;
  f.ctx.wildCatchableTotal=null;
  f.ctx.renderPokedexCollectionHub();
  assert.match(f.national.innerHTML,/Capturés[\s\S]*?<em>… \/ …<\/em>/);
  assert.match(f.national.innerHTML,/Obtenus[\s\S]*?<em>… \/ 7<\/em>/);
});

test("server catchable total is exactly wild pool plus six expedition legends, not all national species",()=>{
  const ids=new Set([...WILD_POOL,...EXPEDITIONS.map(e=>e.legend)]);
  assert.equal(WILD_POOL.length,846);
  assert.equal(EXPEDITIONS.length,6);
  assert.equal(ids.size,852);
  assert.match(balls,/catchableTotal:\s*new Set\(\[\.\.\.WILD_POOL,\s*\.\.\.EXPEDITIONS\.map/);
  for(const id of EXPEDITIONS.map(e=>e.legend))assert.ok(!WILD_POOL.includes(id));
});


test("regional binder does not promise capture of mission-only species",()=>{
  const fx=fs.readFileSync(path.join(__dirname,"../src/script.10xzc.reveal-fx.js"),"utf8");
  const block=fx.match(/if \(typeof albumBinderHtml === "function"\) \{[\s\S]*?\n\}/);
  assert.ok(block,"actual production binder wrapper found");
  const context={
    albumBinderHtml:()=>"<h3>Hoenn <small>3 / 135</small></h3>",
    albumStats:()=>({gen:3,total:135,found:3,shinies:0}),
    albumView:{gen:3},
    albumCaughtIn:()=>1,
    albumRegionList:()=>[{id:10}],
    ballImg:()=>"<ball>"
  };
  vm.runInNewContext(block[0],context);
  const html=context.albumBinderHtml();
  assert.match(html,/3 \/ 135/,"viewed species still retain their full regional objective");
  assert.match(html,/1 espèce/,"captures show number owned without an impossible region denominator");
  assert.doesNotMatch(html,/1 \/ 135/,"do not use total national species as the capture target");
});

test("capture ceremony reuses server catchable total instead of claiming 1025 can be caught",()=>{
  const fx=fs.readFileSync(path.join(__dirname,"../src/script.10xzc.reveal-fx.js"),"utf8");
  assert.match(fx,/const total = typeof wildCatchableTotal/);
  assert.doesNotMatch(fx,/Math\.min\(1025, POKEMON_BY_ID\.size\)/);
  const wild=fs.readFileSync(path.join(__dirname,"../src/script.10xz.wild-grass.js"),"utf8");
  assert.match(wild,/wildCatchableTotal = data\.catchableTotal/);
});
