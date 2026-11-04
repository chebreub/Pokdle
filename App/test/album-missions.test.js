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
test('catalogue preserves all 108 original missions and adds a distinct Hoenn prestige mission',()=>{
  const f=fixture(),missions=Array.from(f.__missions);
  assert.equal(missions.length,109);
  assert.equal(new Set(missions.map(m=>m.id)).size,109);
  assert.equal(new Set(missions.map(m=>m.pokemonId)).size,109);
  for(let gen=1;gen<=9;gen++) assert.equal(missions.filter(m=>m.generation===gen).length,gen===3?13:12,'gen '+gen);
  assert.equal(missions.find(m=>m.id==='g3_salamence').pokemonId,373);
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
test('mission discovery puts ready rewards first, hidden spoilers last and closer goals before fresh ones',()=>{
  const f=fixture();
  const m=(id,tier='confirmed',hidden=false)=>({id,tier,hidden,generation:1});
  const s=(value,ready=false,claimed=false)=>({ready,claimed,reqs:[{value,goal:10}]});
  const rows=[[m('secret','secret',true),s(9)],[m('fresh'),s(0)],[m('closer','prestige'),s(8)],
    [m('ready','legendary'),s(10,true)],[m('claimed','expert'),s(10,true,true)]];
  rows.sort(f.compareAlbumMissionPriority);
  assert.deepEqual(rows.map(([m])=>m.id),['ready','closer','fresh','secret','claimed']);
  assert.equal(rows.length,5);
});
test('mission play action targets an unfinished objective, never a completed one or a reward claim',()=>{
  const f=fixture();
  const mission=f.albumMissionById('g1_alakazam');
  const state={reqs:[{req:{type:'quick',mode:'normal'},done:true},{req:{type:'record',field:'quizHighScore'},done:false}]};
  assert.equal(f.albumMissionNextAction(mission,state).action,'startQuizGame');
  assert.equal(f.albumMissionNextAction(mission,{reqs:[{req:{type:'gen',generation:9},done:false}]}).action,'openAllModesScreen');
  f.ensureAlbumMissionStats();
  const before=JSON.stringify(f.playerProfile);
  let opened=0;f.window.startWeightBattle=()=>opened++;
  f.playAlbumMission('g1_snorlax');
  assert.equal(opened,1);
  assert.equal(JSON.stringify(f.playerProfile),before);
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


test('Drattak prestige requires Métalosse claimed, 42 Hoenn discoveries, 12 Dragons and Draft 520',()=>{
  const f=fixture(), mission=f.albumMissionById('g3_salamence');
  assert.equal(mission.pokemonId,373);
  assert.equal(mission.tier,'prestige');
  assert.equal(f.isAlbumMissionGated(373),true);
  assert.equal(f.isAlbumMissionClaimedForPokemon(373),false);
  // Fixture : four independent conditions. A simple encounter or guessing Drattak
  // cannot satisfy the Métalosse mission prerequisite.
  for(let i=0;i<42;i++){
    const id=4000+i, p={id,gen:3,type1:i<12?'Dragon':'Eau',type2:null,name:'Test '+i};
    f.POKEMON_BY_ID.set(id,p);
    f.playerProfile.discoveries[id]={at:1000,source:'game'};
  }
  f.POKEMON_BY_ID.set(373,{id:373,name:'Drattak',gen:3,type1:'Dragon',type2:'Vol'});
  f.playerProfile.draftScoreAttackRecords[3]=520;
  assert.equal(f.albumMissionState(mission).ready,false,'missing Metagross blocks the reward');
  f.playerProfile.albumMissionClaims.g3_metagross=Date.now();
  assert.equal(f.albumMissionState(mission).ready,true,'all four requirements must be fulfilled');
  assert.equal(f.claimAlbumMission('g3_salamence'),true);
  assert.equal(f.playerProfile.discoveries[373].source,'mission');
  assert.ok(f.playerProfile.discoveries[373].missions.g3_salamence);
  assert.equal(f.claimAlbumMission('g3_salamence'),false,'one claim per mission');
});

test('a previously captured Drattak remains owned and gains its mission provenance without erasure',()=>{
  const f=fixture(),mission=f.albumMissionById('g3_salamence');
  f.POKEMON_BY_ID.set(373,{id:373,name:'Drattak',gen:3,type1:'Dragon',type2:'Vol'});
  f.playerProfile.discoveries[373]={at:900,mode:'capture',source:'capture',shiny:'capture'};
  for(let i=0;i<42;i++){
    const id=4000+i, p={id,gen:3,type1:i<12?'Dragon':'Eau',type2:null,name:'Test '+i};
    f.POKEMON_BY_ID.set(id,p);
    f.playerProfile.discoveries[id]={at:1000,source:'game'};
  }
  f.playerProfile.draftScoreAttackRecords[3]=520;
  f.playerProfile.albumMissionClaims.g3_metagross=Date.now();
  assert.equal(f.albumMissionState(mission).ready,true);
  assert.equal(f.claimAlbumMission('g3_salamence'),true);
  assert.equal(f.playerProfile.discoveries[373].source,'capture');
  assert.equal(f.playerProfile.discoveries[373].shiny,'capture');
  assert.equal(f.playerProfile.discoveries[373].at,900);
  assert.ok(f.playerProfile.discoveries[373].missions.g3_salamence);
});
