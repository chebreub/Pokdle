"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const { WILD_POOL, EXPEDITIONS, SALAMENCE, ACQUISITION_CATALOGUE, missionPokemonIds }=require("../lib/poke-balls");

const lib=fs.readFileSync(path.join(__dirname,"../lib/poke-balls.js"),"utf8");
const wild=fs.readFileSync(path.join(__dirname,"../src/script.10xz.wild-grass.js"),"utf8");
const source=fs.readFileSync(path.join(__dirname,"../src/script.10xze.collection-caught.js"),"utf8");

function htmlFixture(){
  const ctx={
    wildCaptureRoutes:{
      wild:WILD_POOL,
      expedition:EXPEDITIONS.map(e=>e.legend),
      prestige:SALAMENCE.pokemonId
    },
    ALBUM_MISSIONS:[{id:"mewtwo",pokemonId:150},{id:"drattak",pokemonId:373},{id:"darkrai",pokemonId:491,hidden:true}],
    SECRET_MISSIONS:[{id:"mew",pokemonId:151}],
    pokedexCollectionState(p){return {kind:p.id===151||p.id===491?"secret":"registered"};}
  };
  vm.createContext(ctx);
  vm.runInContext(source+"\nthis.routeHtml=colAcquisitionHtml;",ctx);
  return ctx;
}

test("DEX-02: server capture sources cover exactly 852, without mission or secret discovery granting captures",()=>{
  const routes=new Set([...WILD_POOL,...EXPEDITIONS.map(e=>e.legend),SALAMENCE.pokemonId]);
  assert.equal(WILD_POOL.length,845);
  assert.equal(EXPEDITIONS.length,6);
  assert.equal(routes.size,852);
  assert.equal(1025-routes.size,173);
  for(const e of EXPEDITIONS)assert.equal(WILD_POOL.includes(e.legend),false);
  assert.equal(WILD_POOL.includes(SALAMENCE.pokemonId),false);
  assert.equal(ACQUISITION_CATALOGUE[373],"mission","Drattak's discovery mission must not hide its separate prestige capture");
  assert.equal(ACQUISITION_CATALOGUE[151],"secret","Mew's secret is a discovery only");
  assert.equal(ACQUISITION_CATALOGUE[377],"unassigned");
  assert.equal(routes.has(150),false,"Mewtwo mission is not a capture route");
  assert.equal(missionPokemonIds().includes(373),true);
  assert.match(lib,/captureRoutes:\s*\{ wild: WILD_POOL, expedition: EXPEDITIONS\.map\(\(e\) => e\.legend\), prestige: SALAMENCE\.pokemonId \}/);
  assert.match(wild,/wildCaptureRoutes = routes && Array\.isArray\(routes\.wild\)/);
});

test("DEX-02: all display states use server routes, not discovered or owned flags",()=>{
  const c=htmlFixture(),show=id=>c.routeHtml({id,name:"Pokemon "+id});
  assert.match(show(25),/Hautes herbes.*rencontre aléatoire/);
  assert.match(show(380),/Expédition hebdomadaire.*rotation/);
  assert.match(show(373),/Épreuve de prestige Drattak/);
  assert.match(show(373),/Mission d’album.*découverte uniquement/);
  assert.match(show(150),/Aucune voie de capture avec une Ball actuellement disponible/);
  assert.match(show(150),/Mission d’album.*découverte uniquement/);
  assert.match(show(151),/Piste secrète.*Découvrir ne donne pas le Pokémon/);
  assert.match(show(377),/Aucune voie de capture avec une Ball actuellement disponible/);
  assert.doesNotMatch(show(377),/Expédition hebdomadaire|Hautes herbes|Épreuve de prestige/);
  assert.match(show(491),/Piste secrète/);
  assert.match(show(25),/échange.*sans prouver une capture personnelle/);
});

test("DEX-02: missing API data remains unknown, never falsely says not obtainable",()=>{
  const c=htmlFixture();
  c.wildCaptureRoutes=null;
  const html=c.routeHtml({id:377});
  assert.match(html,/Informations indisponibles pour le moment/);
  assert.doesNotMatch(html,/Aucune voie de capture/);
});
