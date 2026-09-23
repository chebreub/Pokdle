'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/script.10e.gamefeel.js'),'utf8');

function fixture(){
  const missions=[
    {id:'m1',pokemonId:6,title:'La flamme du champion'},
    {id:'m2',pokemonId:150,title:'Le projet ultime'}
  ];
  let states={
    m1:{done:1,total:2,ready:false,claimed:false},
    m2:{done:2,total:3,ready:false,claimed:false}
  };
  const context={
    window:{addEventListener(){},matchMedia(){return {matches:false};}},
    document:{
      body:{appendChild(){},classList:{contains(){return false;}}},
      getElementById(){return null;},
      querySelector(){return null;},
      createElement(){return {className:'',setAttribute(){},appendChild(){},classList:{add(){},remove(){}}};}
    },
    getStoredAppSettings(){return {soundEffects:true,reduceMotion:false};},
    ALBUM_MISSIONS:missions,
    albumMissionState(m){return states[m.id];},
    POKEMON_BY_ID:new Map([[6,{id:6,name:'Dracaufeu'}],[150,{id:150,name:'Mewtwo'}]]),
    modeLabelFr:m=>m,
    escapeHtml:s=>String(s),
    playPokedexUiSfx(){},
    setTimeout(){return 1;},clearTimeout(){},
    Date,Math,Map,Set,Array,Object,String,Number,Boolean
  };
  vm.createContext(context);
  vm.runInContext(source+'\nthis.__snapshot=gameFeelMissionSnapshot;this.__changes=gameFeelMissionChanges;this.__grade=gameFeelSoloGrade;this.__label=gameFeelModeLabel;',context);
  context.__setStates=next=>{states=next;};
  return context;
}

test('solo result grades reward fast solves without changing gameplay',()=>{
  const f=fixture();
  assert.equal(f.__grade(true,1).grade,'S');
  assert.equal(f.__grade(true,3).grade,'A');
  assert.equal(f.__grade(true,5).grade,'B');
  assert.equal(f.__grade(true,8).grade,'C');
  assert.equal(f.__grade(false,2).grade,'—');
});

test('mission changes detect progress and newly ready missions',()=>{
  const f=fixture();
  const before=f.__snapshot();
  f.__setStates({
    m1:{done:2,total:2,ready:true,claimed:false},
    m2:{done:2,total:3,ready:false,claimed:false}
  });
  const changes=Array.from(f.__changes(before));
  assert.equal(changes.length,1);
  assert.equal(changes[0].mission.id,'m1');
  assert.equal(changes[0].delta,1);
  assert.equal(changes[0].becameReady,true);
});

test('claimed missions are never surfaced as pending progress',()=>{
  const f=fixture();
  const before=f.__snapshot();
  f.__setStates({
    m1:{done:2,total:2,ready:true,claimed:true},
    m2:{done:3,total:3,ready:true,claimed:true}
  });
  assert.equal(Array.from(f.__changes(before)).length,0);
});

test('mode labels cover core modes',()=>{
  const f=fixture();
  assert.equal(f.__label('speedrun'),'speedrun');
  assert.equal(typeof f.__label('normal'),'string');
});

test('game feel layer respects reduced motion and sound settings',()=>{
  assert.match(source,/prefers-reduced-motion: reduce/);
  assert.match(source,/settings\.reduceMotion/);
  assert.match(source,/soundEffects !== false/);
});
