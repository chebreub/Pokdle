'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/script.10b.album-missions.js'),'utf8');
function fixture() {
  const profile={discoveries:{},draftScoreAttackRecords:{},albumMissionClaims:{},albumMissionStats:null,secrets:{claimed:{}}};
  const context={
    window:{addEventListener(){}},
    document:{getElementById(){return null;}},
    playerProfile:profile,matchHistory:[],
    POKEMON_BY_ID:new Map(),
    getPokemonUiList(){return [];},
    modeLabelFr:m=>m,
    escapeHtml:s=>String(s),
    saveProfile(){},
    addDiscovery(collection,pokemon,mode,at,source){collection[pokemon.id]={at,mode,source};return true;},
    renderPartner(){},renderDiscoveryAlbum(){},showToast(){},
    Date,Math,Set,Map,Object,Array,Number,String,Boolean
  };
  vm.createContext(context);
  vm.runInContext(source+'\nthis.__missions=ALBUM_MISSIONS;this.__tiers=ALBUM_MISSION_TIERS;',context);
  return context;
}
test('catalogue contains exactly 108 curated missions, 12 for every generation',()=>{
  const f=fixture(),missions=Array.from(f.__missions);
  assert.equal(missions.length,108);
  assert.equal(new Set(missions.map(m=>m.id)).size,108);
  assert.equal(new Set(missions.map(m=>m.pokemonId)).size,108);
  for(let gen=1;gen<=9;gen++) assert.equal(missions.filter(m=>m.generation===gen).length,12,'gen '+gen);
});
test('prestige and legendary rewards are gated until their mission is claimed',()=>{
  const f=fixture();
  assert.equal(f.isAlbumMissionGated(150),true);
  assert.equal(f.isAlbumMissionClaimedForPokemon(150),false);
  f.playerProfile.albumMissionClaims.g1_mewtwo=100;
  assert.equal(f.isAlbumMissionClaimedForPokemon(150),true);
  assert.equal(f.isAlbumMissionGated(25),false);
});
test('dex race progression is idempotent and tracks team plus balanced wins',()=>{
  const f=fixture();
  assert.equal(f.recordAlbumMissionEvent('dexraceComplete',{key:'A:1',score:6,won:true,format:'teams',balanced:true}),true);
  assert.equal(f.recordAlbumMissionEvent('dexraceComplete',{key:'A:1',score:6,won:true,format:'teams',balanced:true}),false);
  const s=f.playerProfile.albumMissionStats;
  assert.equal(s.dexraceWins,1);assert.equal(s.dexraceTeamWins,1);assert.equal(s.dexraceBalancedWins,1);assert.equal(s.dexraceClaimsMax,6);
});
test('mission progress never relies on random loot',()=>{
  assert.equal(source.includes('Math.random'),false);
  const f=fixture();
  const hidden=Array.from(f.__missions).filter(m=>m.hidden);
  assert.ok(hidden.length>=8);
  assert.ok(hidden.every(m=>m.tier==='secret'));
});
test('mission claim records provenance and cannot be claimed twice',()=>{
  const f=fixture(),mission=f.albumMissionById('g8_falinks');
  f.POKEMON_BY_ID.set(870,{id:870,name:'Hexadron',gen:8});
  f.playerProfile.albumMissionStats=f.normalizeAlbumMissionStats({seeded:true,dexraceTeamWins:1,dexraceBalancedWins:1});
  assert.equal(f.albumMissionState(mission).ready,true);
  assert.equal(f.claimAlbumMission('g8_falinks',1000),true);
  assert.equal(f.playerProfile.discoveries[870].source,'mission');
  assert.equal(f.playerProfile.discoveries[870].missions.g8_falinks,1000);
  assert.equal(f.claimAlbumMission('g8_falinks',2000),false);
});
