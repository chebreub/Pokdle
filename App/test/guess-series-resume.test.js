'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../src/script.10xm.guess-series.js'),'utf8');

function fixture(store=new Map(),account='A') {
  const starts=[],resumes=[],rewards=[];
  const env={
    window:{__pokedleAccountKnown:true},
    localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))},
    dailyObservedAccountId:()=>account,
    gameMode:'pixel',gameOver:false,attempts:0,secretPokemon:null,
    guessedNames:[],resultHistory:[],selectedGens:new Set([1]),
    playerProfile:{xp:100,guessSeriesBest:{}},escapeHtml:String,
    POKEMON_BY_ID:new Map([[101,{id:101,name:'Pikachu'}],[102,{id:102,name:'Pikachu'}]]),
    document:{getElementById:()=>null,querySelector:()=>null},
    restoreSavedGame(mode,data){resumes.push({mode,data});env.gameMode=mode;env.gameOver=false;env.secretPokemon={id:data.secretId,name:'Pikachu'};return true;},
    renderGameOverBox(){},saveProfile(){},showToast(){},
    submitLeaderboardResult(...args){rewards.push(args);}
  };
  env.window.startPixelGame=()=>{
    starts.push(true);env.gameMode='pixel';env.gameOver=false;
    env.secretPokemon={id:100+starts.length,name:'Pikachu'};
    env.attempts=0;env.resultHistory=[];env.guessedNames=[];
    env.saveGuessSeriesCheckpoint();
  };
  vm.createContext(env);vm.runInContext(source,env);
  return {env,store,starts,resumes,rewards};
}
const key='pokedle.guessSeries.v1:user%3AA:pixel:1';
function endRound(f,won=true) {
  f.env.secretPokemon={id:200+f.env.guessSeries.index,name:'Pikachu'};
  f.env.attempts=2;f.env.gameOver=true;
  f.env.renderGameOverBox({won});
}
test('reloading at sixth round retains five results without replaying them',()=>{
  const store=new Map(),a=fixture(store);
  a.env.window.startPixelGame();
  for(let i=1;i<=5;i++){endRound(a,i!==3);if(i<5)a.env.guessSeriesNext();}
  const save=JSON.parse(store.get(key));
  assert.equal(save.index,5);assert.equal(save.rounds.length,5);assert.equal(save.found,4);
  const b=fixture(store);b.env.window.startPixelGame();
  assert.equal(b.env.guessSeries.index,6);
  assert.equal(b.env.guessSeries.found,4);
  assert.equal(b.env.guessSeries.rounds.length,5);
  assert.equal(b.starts.length,1);
  assert.equal(b.rewards.length,0);
});
test('local partial round resumes exact Pokémon and attempts via override',()=>{
  const store=new Map(),a=fixture(store);a.env.window.startPixelGame();
  endRound(a);a.env.guessSeriesNext();
  a.env.attempts=3;
  a.env.guessedNames=['Bulbizarre','Tortank','Roucool'];
  a.env.resultHistory=[1,9,16].map(id=>({pokemon:{id}}));
  a.env.saveGuessSeriesCheckpoint();
  const snap=JSON.parse(store.get(key));
  const b=fixture(store);b.env.window.startPixelGame();
  assert.equal(b.starts.length,0,'no fresh random mystery');
  assert.equal(b.resumes.length,1);
  assert.equal(b.resumes[0].data.secretId,snap.round.secretId);
  assert.equal(b.resumes[0].data.attempts,3);
  assert.deepEqual(Array.from(b.resumes[0].data.historyIds),[1,9,16]);
  assert.equal(b.env.guessSeries.index,2);
  assert.equal(b.env.guessSeries.found,1);
});
test('saving and reading remain isolated to account identity',()=>{
  const storage=new Map(),a=fixture(storage,'A');
  a.env.window.startPixelGame();endRound(a);
  const b=fixture(storage,'B');b.env.window.startPixelGame();
  assert.equal(b.env.guessSeries.index,1);
  assert.equal(b.env.guessSeries.found,0);
  assert.ok(storage.has(key));
  assert.ok(storage.has('pokedle.guessSeries.v1:user%3AB:pixel:1'));
  const again=fixture(storage,'A');again.env.window.startPixelGame();
  assert.equal(again.env.guessSeries.index,2);
  assert.equal(again.env.guessSeries.found,1);
});
test('changing generations starts a different pool without erasing the previous series',()=>{
  const store=new Map(),f=fixture(store,'A');
  f.env.window.startPixelGame();
  endRound(f);
  const original=store.get(key);
  assert.ok(original);
  f.env.selectedGens=new Set([9]);
  f.env.window.startPixelGame();
  assert.equal(f.env.guessSeries.index,1);
  assert.equal(f.env.guessSeries.found,0);
  assert.equal(f.env.guessSeries.gens,'9');
  assert.ok(store.has('pokedle.guessSeries.v1:user%3AA:pixel:9'));
  assert.equal(store.get(key),original,'a different pool may not overwrite the first series');
  f.env.selectedGens=new Set([1]);
  f.env.window.startPixelGame();
  assert.equal(f.env.guessSeries.index,2);
  assert.equal(f.env.guessSeries.found,1);
  assert.equal(f.env.guessSeries.gens,'1');
});

test('unresolved account never touches any checkpoint',()=>{
  const f=fixture();f.env.window.__pokedleAccountKnown=false;
  f.env.window.startPixelGame();
  assert.equal(f.store.size,0);
});
test('invalid or foreign checkpoints are ignored',()=>{
  const storage=new Map([[key,JSON.stringify({version:1,owner:'user:B',mode:'pixel',index:6,total:10,found:5,rounds:[]})]]);
  const f=fixture(storage,'A');f.env.window.startPixelGame();
  assert.equal(f.env.guessSeries.index,1);
  const g=fixture(new Map([[key,'{invalid']]),'A');g.env.window.startPixelGame();
  assert.equal(g.env.guessSeries.index,1);
});
test('server-verified checkpoint never contains an unrevealed answer',()=>{
  const storage=new Map(),a=fixture(storage);a.env.window.startPixelGame();
  a.env.secretPokemon=null;a.env.saveGuessSeriesCheckpoint();
  const raw=storage.get(key);
  assert.equal(JSON.parse(raw).round,null);
  assert.doesNotMatch(raw,/"secretId"/);
  const b=fixture(storage);b.env.window.startPixelGame();
  assert.equal(b.starts.length,1,'existing server-aware start flow remains authoritative');
  assert.equal(b.env.guessSeries.index,1);
});

test('restoring a series round cannot clear an unrelated Daily or ordinary save', () => {
  const accountSource=fs.readFileSync(path.join(__dirname,'../src/script.07.delegation-party.js'),'utf8');
  const start=accountSource.indexOf('function restoreSavedGame(');
  const stop=accountSource.indexOf('\n// ============================================================',start);
  assert.ok(start>=0 && stop>start,'real restore function must be available');
  const section=accountSource.slice(start,stop);
  const deleted=[],elements=new Map();
  const el=(id)=>{
    if(!elements.has(id))elements.set(id,{
      classList:{add(){},remove(){},toggle(){}},
      focus(){},style:{},innerHTML:'',textContent:'',value:''
    });
    return elements.get(id);
  };
  const secret={id:25,name:'Pikachu',gen:1};
  const env={
    STORAGE_KEYS:{dailyGame:'daily-slot',game:'ordinary-slot'},
    readJson(){throw Error('series restore must never read shared save slots');},
    clearSavedGame(mode){deleted.push(mode);},
    VALID_MODES:new Set(['pixel','daily']),
    POKEMON_BY_ID:new Map([[25,secret],[1,{id:1,name:'Bulbizarre'}]]),
    GENERATIONS:{1:true},
    getDailyDateKey:()=> '2026-11-05',
    selectedGens:new Set([1]),gameMode:'normal',attempts:0,gameOver:true,
    guessedNames:[],guessedSet:new Set(),resultHistory:[],activePool:[],
    document:{getElementById:el},
    buildGenGrid(){},getPoolFromSelectedGens(){return [secret];},
    compare(){return {type1:'ok'};},addRow(){},rebuildActiveSearchIndex(){},
    setGameCounter(){},updateTopTag(){},updateModeBanners(){},
    updateSilhouettePanel(){},updatePixelPanel(){},updateCryPanel(){},
    setQuizModeLayout(){},showScreen(){},setGlobalNavActive(){},updateMysteryPanel(){}
  };
  vm.createContext(env);
  vm.runInContext(section,env);
  assert.equal(env.restoreSavedGame('pixel',{version:1,mode:'pixel',secretId:25,attempts:2,selectedGens:[1],historyIds:[1],guessedNames:['Bulbizarre']}),true);
  assert.equal(env.secretPokemon.id,25);
  assert.equal(env.attempts,2);
  assert.equal(env.resultHistory.length,1);
  assert.deepEqual(deleted,[],'other saved games must not be touched');
  assert.equal(env.restoreSavedGame('pixel',{version:1,mode:'pixel',secretId:999999}),false);
  assert.deepEqual(deleted,[],'corrupt series snapshot must not erase other slots');
});

test('series save and completion preserve another mode legacy slot',()=>{
  const accountSource=fs.readFileSync(path.join(__dirname,'../src/script.07.delegation-party.js'),'utf8');
  const a=accountSource.indexOf('function saveCurrentGame(');
  const b=accountSource.indexOf('\nfunction restoreSavedGame(',a);
  assert.ok(a>=0 && b>a);
  const removed=[],state={legacy:{mode:'normal'},snapshots:0};
  const ctx={
    gameMode:'pixel',STORAGE_KEYS:{dailyGame:'daily-slot',game:'ordinary-slot'},
    guessSeriesActive(){return true;},guessSeriesOwner(){return 'user:A';},
    saveGuessSeriesCheckpoint(){state.snapshots++;},
    readJson(){return state.legacy;},
    localStorage:{removeItem:key=>removed.push(key)},
    writeJson(){throw Error('series may not write shared slot');}
  };
  vm.createContext(ctx);
  vm.runInContext(accountSource.slice(a,b),ctx);
  ctx.saveCurrentGame();
  assert.equal(state.snapshots,1);
  assert.deepEqual(removed,[]);
  ctx.clearSavedGame('pixel');
  assert.deepEqual(removed,[],'another mode save must stay intact');
  state.legacy={mode:'pixel'};
  ctx.clearSavedGame('pixel');
  assert.deepEqual(removed,['ordinary-slot'],'a legacy save for the active mode may still be cleared');
  ctx.clearSavedGame('daily');
  assert.deepEqual(removed,['ordinary-slot','daily-slot'],'Daily retains its own original slot');
});
