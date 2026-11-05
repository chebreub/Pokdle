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
const key='pokedle.guessSeries.v1:user%3AA:pixel';
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
  assert.ok(storage.has('pokedle.guessSeries.v1:user%3AB:pixel'));
  const again=fixture(storage,'A');again.env.window.startPixelGame();
  assert.equal(again.env.guessSeries.index,2);
  assert.equal(again.env.guessSeries.found,1);
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
