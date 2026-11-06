"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const tracking = fs.readFileSync(path.join(__dirname,"../src/script.10xzq.dex-tracking.js"),"utf8");
const profileMerge = fs.readFileSync(path.join(__dirname,"../src/script.07a.profile-merge.js"),"utf8").split("// Repair (31/10/2026)")[0];

function fixture() {
  const pokemon = new Map([25,150,151,373,380,377,94].map(id=>[id,{id,name:"Pokemon "+id}]));
  const profile={ discoveries:{25:{mode:"game"}},pokedexTrackedTargets:[],pokedexTrackedUpdatedAt:0 };
  let saved=0,synced=0;
  const ctx={
    playerProfile:profile, POKEMON_BY_ID:pokemon,pokedexExperienceView:"encyclopedia",
    pokedexSelectedId:25,wildCaptures:null,wildCaptureRoutes:{wild:[25,94],expedition:[380],prestige:373},
    pokedexCollectionState(p){return {kind:p.id===151?"secret":p.id===25?"registered":p.id===150?"mission":"unknown"};},
    escapeHtml:v=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;"),
    saveProfile(){saved++},syncProfileNow(){synced++},renderPokedexCollectionHub(){},renderPokedexDetail(){},
    document:{getElementById(){return null;},querySelector(){return null;}},
    showToast(){},Date,Number,String,Math,Set,Array,Object
  };
  vm.createContext(ctx);
  vm.runInContext(tracking+"\nthis.ids=pokedexTrackedTargetIds;this.toggle=togglePokedexTrackedTarget;this.control=pokedexTrackingButtonHtml;this.dashboard=pokedexTrackingHubHtml;",ctx);
  return {ctx,profile,get saved(){return saved},get synced(){return synced}};
}

test("DEX-03: add, remove, dedupe and enforce three targets; saving uses existing profile",()=>{
  const f=fixture(),c=f.ctx;
  assert.equal(c.toggle(25),true);
  assert.equal(c.toggle(150),true);
  assert.equal(c.toggle(380),true);
  assert.deepEqual([...f.profile.pokedexTrackedTargets],[25,150,380]);
  const before=f.saved;
  assert.equal(c.toggle(94),false,"fourth target rejected");
  assert.equal(f.saved,before,"rejected change never writes profile");
  assert.equal(c.toggle(150),true,"removing a target saves a removal");
  assert.equal(c.toggle(94),true,"vacated slot can be filled");
  assert.deepEqual([...f.profile.pokedexTrackedTargets],[25,380,94]);
  assert.equal(f.saved,5);
  assert.equal(f.synced,5);
  assert.match(c.dashboard(),/3 \/ 3/);
  assert.match(c.dashboard(),/Hautes herbes/);
  assert.match(c.dashboard(),/Expédition hebdomadaire/);
});

test("DEX-03: secrets are not targetable and unknown names remain hidden in collection",()=>{
  const f=fixture(),c=f.ctx;
  assert.equal(c.toggle(151),false,"secret journal entry not a public target");
  assert.equal(f.saved,0);
  assert.doesNotMatch(c.control(c.POKEMON_BY_ID.get(151)),/Suivre/);
  assert.equal(c.toggle(94),true,"an explicit encyclopedia selection may be tracked");
  c.pokedexExperienceView="collection";
  const html=c.dashboard();
  assert.match(html,/Cible non révélée/);
  assert.doesNotMatch(html,/Pokemon 94/);
  assert.equal(c.control(c.POKEMON_BY_ID.get(94)),"","unknown locked collection card cannot be used to reveal");
  assert.match(c.control(c.POKEMON_BY_ID.get(150)),/Suivre ce Pokémon/,"visible mission stays targetable");
  c.pokedexExperienceView="encyclopedia";
  assert.match(c.dashboard(),/Pokemon 94/,"only encyclopedia has its normal full names");
});

test("DEX-03: invalid or hostile saved targets never escape bounded display",()=>{
  const f=fixture(),c=f.ctx;
  const normalized=c.ids([null,0,-1,1.5,"25","25",151,373,380,10000,"oops"]);
  assert.deepEqual([...normalized],[25,151,373]);
  f.profile.pokedexTrackedTargets=[151,25,25,150,373];
  c.pokedexExperienceView="collection";
  assert.match(c.dashboard(),/Cible non révélée/,"old hidden entry is masked");
  assert.doesNotMatch(c.dashboard(),/Pokemon 151/);
  assert.equal(c.toggle(151),true,"a previously saved secret can be removed");
  assert.deepEqual([...f.profile.pokedexTrackedTargets],[25,150]);
});

test("DEX-03: account merge uses most recent explicit change incl. removal, not union",()=>{
  const context={Date,Math,Number,Set,Object,Array};
  vm.createContext(context);
  vm.runInContext(profileMerge+"\nthis.merge=mergeSyncBlobs;",context);
  const blob=profile=>({_accountId:"a",profile:JSON.stringify(profile)});
  const merge=(p,o,base)=>JSON.parse(context.merge(blob(p),blob(o),base?blob(base):null).profile);
  const base={pokedexTrackedTargets:[25,150],pokedexTrackedUpdatedAt:100};
  const remote={pokedexTrackedTargets:[25,150,373],pokedexTrackedUpdatedAt:200};
  const local={pokedexTrackedTargets:[25],pokedexTrackedUpdatedAt:300};
  assert.deepEqual([...merge(local,remote,base).pokedexTrackedTargets],[25]);
  assert.deepEqual([...merge(remote,local,base).pokedexTrackedTargets],[25]);
  assert.deepEqual([...merge({pokedexTrackedTargets:[],pokedexTrackedUpdatedAt:400},local,base).pokedexTrackedTargets],[]);
  assert.deepEqual([...merge({},remote,base).pokedexTrackedTargets],[25,150,373],"legacy device does not erase targets");
  assert.deepEqual([...merge({pokedexTrackedTargets:[25,25,-2,373,380,9999],pokedexTrackedUpdatedAt:500},remote,base).pokedexTrackedTargets],[25,373,380]);
});
