'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../src/script.10d.pokedex-collection.js'),'utf8');
const gameSource=fs.readFileSync(path.join(__dirname,'../src/script.04.jeu-pokedex.js'),'utf8');

function fixture(){
  const discoveries={25:{at:1000,mode:'normal',source:'game'},10094:{at:1200,mode:'normal',source:'game'}};
  const mons=[
    {id:25,name:'Pikachu',gen:1,type1:'Électrik',type2:null},
    {id:94,name:'Ectoplasma',gen:1,type1:'Spectre',type2:'Poison'},
    {id:150,name:'Mewtwo',gen:1,type1:'Psy',type2:null},
    {id:151,name:'Mew',gen:1,type1:'Psy',type2:null},
    {id:10094,baseId:94,name:'Ectoplasma Mega',gen:1,type1:'Spectre',type2:'Poison',isAltForm:true}
  ];
  const byId=new Map(mons.map(p=>[p.id,p]));
  const context={
    playerProfile:{discoveries,favoritePokemonId:null},
    POKEMON_LIST:mons,POKEMON_BY_ID:byId,
    SECRET_MISSIONS:[{id:'mew_secret',pokemonId:151,title:'Une présence familière',hint:'Cherche une trace.'}],
    getPokemonUiList(){return mons;},
    getAlbumMissionGate(id){if(id===150)return {id:'mewtwo',pokemonId:150,tier:'legendary',title:'Projet ultime',hint:'Mission',hidden:false,reqs:[]};return null;},
    albumMissionState(){return {done:1,total:2,ready:false,claimed:false,reqs:[]};},
    albumMissionRequirementLabel(){return 'Objectif';},
    getPokemonSpriteId:p=>p.id,
    getPokedexDisplaySprite:p=>'sprite/'+p.id,
    getSpriteUrl:id=>'fallback/'+id,
    discoveryModeLabel:()=> 'Mode illimité',
    discoveryProofHtml:()=> '',
    escapeHtml:s=>String(s),
    typeBadgesHtml:()=> '',
    document:{getElementById(){return null;},querySelectorAll(){return [];}},
    window:{addEventListener(){}},
    openPokedexMode(){},openProfileScreen(){},switchProfileView(){},
    playPokedexUiSfx(){},showToast(){},playPokemonCry(){},choosePartner(){},
    Date,Math,Map,Set,Array,Object,String,Number,Boolean
  };
  // Functions overridden at the end of the module need base stubs in this isolated test.
  context.getFilteredPokedexList=()=>mons;
  context.createPokedexCard=()=>({classList:{add(){}},dataset:{},querySelector(){return null;},appendChild(){}});
  context.renderPokedexDetail=async()=>{};
  context.renderPokedexGrid=()=>{};
  context.openPokedexMode=()=>{};
  vm.createContext(context);
  vm.runInContext(source+'\nthis.__state=pokedexCollectionState;this.__stats=pokedexCollectionNationalStats;this.__visible=pokedexCollectionVisibleName;',context);
  return context;
}

test('collection distinguishes registered, mission, secret and unknown entries',()=>{
  const f=fixture();
  assert.equal(f.__state(f.POKEMON_BY_ID.get(25)).kind,'registered');
  assert.equal(f.__state(f.POKEMON_BY_ID.get(150)).kind,'mission');
  assert.equal(f.__state(f.POKEMON_BY_ID.get(151)).kind,'secret');
  assert.equal(f.__state(f.POKEMON_BY_ID.get(94)).kind,'unknown');
});

test('secret and unknown names stay hidden while mission names can be shown',()=>{
  const f=fixture();
  assert.equal(f.__visible(f.POKEMON_BY_ID.get(151)),'???');
  assert.equal(f.__visible(f.POKEMON_BY_ID.get(94)),'???');
  assert.equal(f.__visible(f.POKEMON_BY_ID.get(150)),'Mewtwo');
  assert.equal(f.__visible(f.POKEMON_BY_ID.get(25)),'Pikachu');
});

test('national collection progress is based on actual discoveries',()=>{
  const f=fixture(),stats=f.__stats();
  assert.equal(stats.found,1);
  assert.equal(stats.total,4);
  assert.equal(stats.percent,25);
  assert.equal(stats.formsFound,1);
  assert.equal(stats.formsTotal,1);
});

test('guess results use staggered cell reveal and reduced-motion support',()=>{
  assert.match(gameSource,/guess-result-cell/);
  assert.match(gameSource,/--reveal-index/);
  assert.match(gameSource,/prefers-reduced-motion: reduce/);
  assert.match(gameSource,/playPokedexUiSfx/);
});
