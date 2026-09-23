'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/script.10f.home-adventure.js'),'utf8');

function fixture(){
  const mons=[
    {id:1,name:'Bulbizarre',gen:1},{id:4,name:'Salamèche',gen:1},
    {id:152,name:'Germignon',gen:2},{id:155,name:'Héricendre',gen:2},
    {id:252,name:'Arcko',gen:3},{id:255,name:'Poussifeu',gen:3}
  ];
  const byId=new Map(mons.map(p=>[p.id,p]));
  const states={
    g1:{done:1,total:2,ready:false,claimed:false,reqs:[{done:false,req:{label:'Objectif Kanto'},value:1,goal:2}]},
    g2:{done:2,total:2,ready:true,claimed:false,reqs:[]},
    g3:{done:0,total:2,ready:false,claimed:false,reqs:[]}
  };
  const context={
    playerProfile:{
      nickname:'Red',xp:1200,favoritePokemonId:4,
      discoveries:{1:{at:100},152:{at:300},155:{at:250}},
      albumMissionClaims:{},secrets:{claimed:{}}
    },
    POKEMON_BY_ID:byId,
    ALBUM_MISSIONS:[
      {id:'g1',pokemonId:4,generation:1,tier:'expert',title:'Mission Kanto',hint:'Kanto',hidden:false},
      {id:'g2',pokemonId:155,generation:2,tier:'prestige',title:'Mission Johto',hint:'Johto',hidden:false},
      {id:'g3',pokemonId:255,generation:3,tier:'secret',title:'Mission Hoenn',hint:'Hoenn',hidden:true}
    ],
    getPokemonUiList(){return mons;},
    albumMissionState(m){return states[m.id];},
    albumMissionRequirementLabel(req){return req.label||'Objectif';},
    albumMissionTierLabel(m){return m.tier;},
    getXpProgress(){return {tier:{level:3,name:'Dresseur',emoji:'⭐'},next:{name:'Confirmé'},percent:50,xpInTier:200,xpToNext:400};},
    getPokemonSprite(){return 'sprite';},getSpriteUrl(){return 'fallback';},getPokemonSpriteId:p=>p.id,
    escapeHtml:s=>String(s),
    renderPartner(){},goToConfig(){},recordMatchHistory(){},
    document:{getElementById(){return null;}},
    window:{addEventListener(){}},
    setTimeout(fn){fn();return 1;},Date,Math,Map,Set,Array,Object,String,Number,Boolean
  };
  vm.createContext(context);
  vm.runInContext(source+'\nthis.__region=homeAdventureCurrentRegion;this.__mission=homeAdventureMissionCandidate;this.__summary=homeAdventureMissionSummary;this.__name=homeAdventureTrainerName;',context);
  return context;
}

test('current region follows the latest discovered unfinished region',()=>{
  const f=fixture(),region=f.__region();
  assert.equal(region.gen,2);
  assert.equal(region.name,'Johto');
  assert.equal(region.found,2);
});

test('ready mission is prioritised over ordinary progress',()=>{
  const f=fixture(),candidate=f.__mission(1);
  assert.equal(candidate.mission.id,'g2');
  assert.equal(candidate.state.ready,true);
});

test('dormant hidden missions do not steal the home objective',()=>{
  const f=fixture();
  f.ALBUM_MISSIONS[1].id='missing';
  const candidate=f.__mission(1);
  assert.equal(candidate.mission.id,'g1');
});

test('mission summary surfaces the next unfinished requirement',()=>{
  const f=fixture(),candidate={mission:f.ALBUM_MISSIONS[0],state:f.albumMissionState(f.ALBUM_MISSIONS[0])};
  assert.equal(f.__summary(candidate),'Objectif Kanto');
});

test('trainer falls back to Dresseur when no nickname is configured',()=>{
  const f=fixture();
  assert.equal(f.__name(),'Red');
  f.playerProfile.nickname=' ';
  assert.equal(f.__name(),'Dresseur');
});
