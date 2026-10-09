"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const full=fs.readFileSync(path.join(__dirname,'../src/script.04.jeu-pokedex.js'),'utf8'),source=full.slice(full.indexOf('let dailyRequestInFlight'),full.indexOf('function surrenderGame()')),DAY='2026-10-06';
const cmp={generation:'ok',altForm:'ok',type1:'wrong',type2:'wrong',habitat:'wrong',color:'wrong',stage:'ok',height:'close',weight:'close'};
function response(data,status=200){return {ok:status>=200&&status<300,json:async()=>data};}
function snapshot(ids=[],status='playing',accountId='A'){
 return {ok:true,day:DAY,number:198,accountId,authenticated:Boolean(accountId),attempts:ids.length,rows:ids.map(pokemonId=>({pokemonId,cmp,heightDirection:'↑',weightDirection:'↑'})),status,finished:status!=='playing',won:status==='won',streak:{current:status==='won'?3:2,best:3,lastWin:status==='won'?DAY:'2026-10-05'},...(status!=='playing'?{answerId:1}:{})};
}
function fixture(accountId='A'){
 const nodes=new Map();let wins=0,renders=0,error='',timeoutFn=null;const added=[];
 function node(id){if(!nodes.has(id)){const classes=new Set();nodes.set(id,{value:'Pikachu',children:[],get innerHTML(){return '';},set innerHTML(value){this.children=[];},textContent:'',disabled:false,focus(){env.document.activeElement=this;},setAttribute(){},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c);}}});}return nodes.get(id);}
 const env={window:{addEventListener(){}},connectedAccountUser:accountId?{id:accountId}:null,gameMode:'daily',gameOver:false,secretPokemon:null,attempts:0,guessedNames:[],guessedSet:new Set(),resultHistory:[],POKEMON_LIST:[{id:1,name:'Bulbizarre'},{id:25,name:'Pikachu'}],
 document:{getElementById:node},getDailyDateKey:()=>DAY,findPokemon:name=>env.POKEMON_LIST.find(p=>p.name===name),compare:()=>cmp,addRow:(p,c,d,options)=>{added.push([p,c,d,options]);node('results-body').children.push({});},saveCurrentGame(){},saveDailyResult(){},clearSavedGame(){},saveStats(){},renderGameShell(){},renderDailyHero(){},
 renderGameOverBox(){renders++;},getTodayDailyResult:()=>null,playerStats:{},winRegisteredForCurrentGame:false,guessCache:new Map(),LIVE_RANK_CACHE:new Map([['daily',{}]]),updateSilhouettePanel(){},updatePixelPanel(){},showErr:v=>{error=v;},clearErr:()=>{error='';},showWin:()=>{wins++;},recordMatchHistory(){},
 AbortController,setTimeout:fn=>{timeoutFn=fn;return 1;},clearTimeout:()=>{timeoutFn=null;},fetch:async()=>response(snapshot([25],'playing',accountId))};
 env.registerGameStart=()=>{}; // Counter semantics are covered by daily-maintenance.test.js.
 env.POKEMON_BY_ID=new Map(env.POKEMON_LIST.map(p=>[p.id,p]));vm.createContext(env);vm.runInContext(source,env);vm.runInContext('dailyServerState='+JSON.stringify(snapshot([],'playing',accountId)),env);
 return {env,node,added,get wins(){return wins;},get renders(){return renders;},get error(){return error;},timeout(){timeoutFn?.();}};
}
for(const who of ['A',null])test('Daily sends guesses to the server for '+(who?'accounts':'guests'),async()=>{
 const f=fixture(who);let url,body;f.env.fetch=async(u,o)=>{url=u;body=JSON.parse(o.body);return response(snapshot([25],'playing',who));};await f.env.submitGuess();
 assert.equal(url,'/api/daily/guess');assert.deepEqual(body,{day:DAY,accountId:who,pokemonId:25});assert.equal(f.env.secretPokemon,null);assert.equal(f.env.attempts,1);assert.equal(f.added[0][2].heightDirection,'↑');assert.equal(f.added[0][1].height,'close');
});
test('Daily suppresses double submit and preserves text typed while waiting',async()=>{const f=fixture();let resolve,posts=0;f.env.fetch=()=>{posts++;return new Promise(r=>resolve=r);};const a=f.env.submitGuess(),b=f.env.submitGuess();assert.equal(posts,1);assert.equal(f.node('guess-input').disabled,false);assert.equal(f.env.document.activeElement,f.node('guess-input'));assert.equal(f.node('guess-input').value,'');assert.equal(f.node('btn-submit').disabled,true);f.node('guess-input').value='Bulbizarre';resolve(response(snapshot([25])));await a;await b;assert.equal(f.env.attempts,1);assert.equal(f.node('guess-input').value,'Bulbizarre');assert.equal(f.node('guess-input').disabled,false);});
test('network failure never resolves locally; retry restores a lost winning reply without awarding again',async()=>{const f=fixture();f.node('guess-input').value='Bulbizarre';f.env.fetch=async()=>{throw Error('lost');};await f.env.submitGuess();assert.equal(f.env.attempts,0);assert.equal(f.env.secretPokemon,null);assert.match(f.error,/serveur/);f.env.fetch=async()=>response({...snapshot([1],'won'),duplicate:true});await f.env.submitGuess();assert.equal(f.env.attempts,1);assert.equal(f.wins,0);assert.equal(f.renders,1);assert.equal(f.env.secretPokemon.id,1);});
test('fresh successful win awards once and updates streak before rendering',async()=>{const f=fixture();f.node('guess-input').value='Bulbizarre';f.env.fetch=async()=>response({...snapshot([1],'won'),fresh:true});await f.env.submitGuess();assert.equal(f.wins,1);assert.equal(f.env.playerStats.dailyCurrentStreak,3);await f.env.submitGuess();assert.equal(f.wins,1);});
test('duplicate response reconstructs the missing row',async()=>{const f=fixture();f.env.fetch=async()=>response({...snapshot([25]),duplicate:true});await f.env.submitGuess();assert.equal(f.env.attempts,1);assert.equal(f.env.resultHistory.length,1);assert.match(f.error,/déjà/);});
for(const [name,change] of Object.entries({mode:f=>f.env.gameMode='normal',account:f=>f.env.connectedAccountUser={id:'B'},round:f=>vm.runInContext('dailyRequestSerial++',f.env),navigation:f=>f.node('screen-game').classList.add('hidden'),midnight:f=>f.env.getDailyDateKey=()=> '2026-10-07'}))test('late response cannot mutate after '+name,async()=>{const f=fixture();let resolve;f.env.fetch=()=>new Promise(r=>resolve=r);const pending=f.env.submitGuess();change(f);resolve(response({...snapshot([1],'won'),fresh:true}));await pending;assert.equal(f.env.attempts,0);assert.equal(f.wins,0);assert.equal(f.renders,0);});
test('malformed or stale snapshots never partially mutate state',async()=>{for(const data of [{...snapshot([25]),accountId:'B'},{...snapshot([25]),day:'2026-10-07'},{...snapshot([25]),attempts:2},snapshot([9999]),{...snapshot([1],'won'),answerId:null},{...snapshot([25]),answerId:1}]){const f=fixture();f.env.fetch=async()=>response(data);await f.env.submitGuess();assert.equal(f.env.attempts,0);assert.equal(f.env.resultHistory.length,0);assert.ok(f.error);}});
test('timeout releases guard and retry succeeds',async()=>{const f=fixture();f.env.fetch=(_u,{signal})=>new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout'))));const pending=f.env.submitGuess();f.timeout();await pending;f.env.fetch=async()=>response(snapshot([25]));await f.env.submitGuess();assert.equal(f.env.attempts,1);});
test('resume is a GET using authoritative history without a guess',async()=>{const f=fixture();let url,body;f.env.fetch=async(u,o)=>{url=u;body=o.body;return response(snapshot([25]));};await f.env.syncDailyObservedState();assert.equal(url,'/api/daily');assert.equal(body,undefined);assert.equal(f.env.attempts,1);assert.equal(f.env.secretPokemon,null);});
test('abandonment requires server success and prevents another attempt',async()=>{const f=fixture();let url;f.env.fetch=async(u)=>{url=u;return response({...snapshot([],'abandoned'),fresh:true});};await f.env.requestDailyObservedState(null,'',true);assert.equal(url,'/api/daily/abandon');assert.equal(f.env.gameOver,true);assert.equal(f.wins,0);assert.equal(f.renders,1);assert.equal(f.env.secretPokemon.id,1);await f.env.submitGuess();assert.equal(f.env.attempts,0);});
test('Unlimited retains local play without a server request',async()=>{const f=fixture();f.env.gameMode='normal';f.env.secretPokemon=f.env.POKEMON_LIST[0];f.env.fetch=()=>{throw Error('unexpected network');};await f.env.submitGuess();assert.equal(f.env.attempts,1);assert.equal(f.env.resultHistory.length,1);});

test('Daily appends only new rows and restores history without replaying feedback',async()=>{
 const f=fixture();await f.env.submitGuess();assert.equal(f.added.length,1);assert.equal(f.added[0][3].animate,true);
 const oldRow=f.node('results-body').children[0];await f.env.syncDailyObservedState();
 assert.equal(f.added.length,1);assert.equal(f.node('results-body').children[0],oldRow);
 f.env.fetch=async()=>response(snapshot([25,1]));f.node('guess-input').value='Bulbizarre';await f.env.submitGuess();
 assert.equal(f.added.length,2);assert.equal(f.node('results-body').children[0],oldRow);
 const resumed=fixture();await resumed.env.syncDailyObservedState();assert.equal(resumed.added[0][3].animate,false);
});
test('Daily network failure restores the submitted text but preserves a new draft and focus elsewhere',async()=>{
 for(const draft of ['', 'Bulbizarre']){
  const f=fixture();let reject;f.env.fetch=()=>new Promise((_,r)=>reject=r);
  const pending=f.env.submitGuess();f.node('guess-input').value=draft;f.env.document.activeElement=f.node('other-control');
  reject(Error('offline'));await pending;
  assert.equal(f.node('guess-input').value,draft||'Pikachu');assert.equal(f.env.document.activeElement,f.node('other-control'));
  assert.equal(f.node('btn-submit').disabled,false);
 }
});
