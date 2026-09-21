'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const race=require('../lib/party-dexrace');
const catalogue=[{id:1,gen:1,name:'Bulbizarre'},{id:4,gen:1,name:'Salamèche'},{id:25,gen:1,name:'Pikachu'},{id:29,gen:1,name:'Nidoran♀'},{id:32,gen:1,name:'Nidoran♂'},{id:122,gen:1,name:'M. Mime'},{id:152,gen:2,name:'Germignon'},{id:20001,gen:1,name:'Forme',isAltForm:true}];
function fixture(count=2,format='duel') {
 const room={code:'RACE',hostId:'a',status:'waiting',players:Array.from({length:count},(_,i)=>({id:String.fromCharCode(97+i),nickname:'Joueur '+i,connected:true,score:0})),gameMode:'dexrace',selectedGens:[1],raceFormat:format,raceDuration:180};
 race.balanceRaceTeams(room); return room;
}
function playing(count=2,format='duel'){const room=fixture(count,format);race.startRace(room,catalogue);room.deadlineAt=Date.now()+180000;return room;}
function submit(room,name,id='a',overrides={}){return race.submitRace(room,room.players.find(p=>p.id===id),{code:room.code,roundSerial:room.roundSerial,guess:name,...overrides});}
test('pool uses exactly one generation and no alternative forms; French accents and punctuation are tolerated',()=>{
 assert.deepEqual(race.racePool(catalogue,2).map(p=>p.id),[152]);
 const room=playing();assert.equal(submit(room,'  SALAMECHE ').claimed,true);assert.equal(submit(room,'mr mime').error!==undefined,true);
 assert.equal(submit(room,'M-Mime').claimed,true);assert.equal(submit(room,'nidoran f').claimed,true);assert.equal(submit(room,'nidoran m').claimed,true);
 assert.ok(submit(room,'Germignon').error);assert.ok(submit(room,'Forme').error);assert.ok(submit(room,{}).error);
});
test('first submission owns a case; rivals, teammates and retry cannot score it twice',()=>{
 const room=playing(4,'teams');
 assert.equal(submit(room,'Pikachu','a').claimed,true);
 assert.equal(submit(room,'pikachu','b').duplicate,true);assert.equal(submit(room,'PIKACHU','c').duplicate,true);
 assert.equal(room.race.claims.size,1);assert.deepEqual(room.players.map(p=>p.score),[1,0,0,0]);
 assert.deepEqual(race.publicRace(room).scores,{blue:1,coral:0});
});
test('late and stale answers and nonparticipants cannot alter scores',()=>{
 const room=playing();assert.ok(submit(room,'Pikachu','a',{roundSerial:0}).error);assert.ok(submit(room,'Pikachu','a',{code:'OTHER'}).error);
 room.players[0].connected=false;assert.ok(submit(room,'Pikachu').error);room.players[0].connected=true;
 room.deadlineAt=Date.now();assert.ok(submit(room,'Pikachu').error);assert.equal(room.race.claims.size,0);
});
test('teams must balance, duel has exactly two, and an eight-player game sums unique claims',()=>{
 assert.ok(race.raceStartError(fixture(3)));assert.ok(race.raceStartError(fixture(3,'teams')));
 const room=playing(8,'teams');submit(room,'Pikachu','a');submit(room,'Bulbizarre','c');submit(room,'Salamèche','b');
 assert.deepEqual(race.publicRace(room).scores,{blue:2,coral:1});
});
test('departure preserves claimed cases and contributions; a match only loses a side when its last player leaves',()=>{
 const room=playing(4,'teams');submit(room,'Pikachu','a');room.players=room.players.filter(p=>p.id!=='a');
 assert.equal(race.raceMissingSide(room),false);assert.equal(race.publicRace(room).roster[0].score,1);assert.equal(race.publicRace(room).roster[0].connected,false);
 room.players=room.players.filter(p=>p.id!=='c');assert.equal(race.raceMissingSide(room),true);assert.equal(race.publicRace(room).scores.blue,1);
});
test('fresh round resets claims and scores with a new serial; public board does not expose missing answers',()=>{
 const room=playing();submit(room,'Pikachu');const old=room.roundSerial;
 assert.ok(!JSON.stringify(race.publicRace(room)).includes('Bulbizarre'));
 race.startRace(room,catalogue);assert.equal(room.roundSerial,old+1);assert.equal(room.race.claims.size,0);assert.equal(room.players[0].score,0);
 assert.ok(submit(room,'Bulbizarre','a',{roundSerial:old}).error);
});
const source=fs.readFileSync(require.resolve('../server'),'utf8');
function fn(name){const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);}
function wired(room){
 const ctx={dexRace:race,Date,POKEMON_LIST:catalogue,PARTY_MIN_PLAYERS:2,PARTY_MAX_PLAYERS:8,PARTY_TOTAL_ROUNDS:5,checkRateLimit:()=>false,findPartyRoomBySocket:()=>room,respond:(ack,data)=>ack(data),clearPartyRoundTimer(){},emitPartyRoomState(){},isPartyStatMode:()=>false};
 vm.createContext(ctx);vm.runInContext(['publicPartyRoomState','endPartyRound','forcePartyRoundEnd'].map(fn).join('\n'),ctx);
 const event=(name,payload={},id='a')=>{
  let callback,response;ctx.socket={id,on:(_,handler)=>{callback=handler;}};
  const start=source.indexOf(`  socket.on("${name}"`),end=source.indexOf('\n  socket.on(',start+1);
  vm.runInContext(source.slice(start,end),ctx);callback(payload,r=>{response=r;});return response;
 };return {ctx,event};
}
test('production socket handler updates the common grid, refuses manual reveal and completes a full generation',()=>{
 const room=playing(),w=wired(room);
 const send=(guess,id='a')=>w.event('party:submit-answer',{code:room.code,roundSerial:room.roundSerial,guess},id);
 assert.equal(send('Pikachu').ok,true);assert.equal(send('Pikachu','b').duplicate,true);
 assert.equal(w.event('party:reveal-round').ok,false);assert.equal(room.status,'playing');
 for(const p of race.racePool(catalogue,1)) send(p.name);
 assert.equal(room.status,'complete');assert.equal(room.race.endedReason,'full');assert.equal(room.players[0].score,6);
 assert.equal(send('Pikachu').ok,false);
});
test('server timer completes and scores ties without inventing a winner',()=>{
 const room=playing(),w=wired(room);submit(room,'Pikachu');submit(room,'Salamèche','b');w.ctx.forcePartyRoundEnd(room);
 const state=w.ctx.publicPartyRoomState(room,'a');assert.equal(state.status,'complete');assert.equal(state.round.endedReason,'time');assert.deepEqual({...state.round.scores},{blue:1,coral:1});assert.equal(state.deadlineAt,null);
});
test('production controls are host-only and locked during a race; team choice cannot move scores',()=>{
 const room=fixture(4,'teams'),w=wired(room);const settings={format:'teams',duration:300};
 assert.equal(w.event('party:dexrace-options',settings,'b').ok,false);assert.equal(w.event('party:dexrace-options',settings).ok,true);
 assert.equal(room.raceDuration,300);assert.equal(w.event('party:dexrace-team',{team:'coral'},'c').ok,true);assert.ok(race.raceStartError(room));
 race.balanceRaceTeams(room);race.startRace(room,catalogue);room.deadlineAt=Date.now()+300000;
 assert.equal(w.event('party:dexrace-team',{team:'coral'}).ok,false);assert.equal(w.event('party:dexrace-options',settings).ok,false);
 assert.equal(w.event('party:set-gens',{gens:[2]}).ok,false);
});
test('board layout fits the largest generation on standard desktop and small laptop viewports',()=>{
 const script=fs.readFileSync(require.resolve('../src/script.12.dexrace'),'utf8');const start=script.indexOf('function dexRaceLayout('),ctx={};
 vm.runInNewContext(script.slice(start,script.indexOf('\n}',start)+2),ctx);
 for(const [width,height] of [[1280,480],[960,350],[1800,780]]) for(const count of [72,100,151,156]) {
  const f=ctx.dexRaceLayout(width,height,count);assert.ok(f.size>=36);assert.ok(f.columns*f.size+(f.columns-1)*3<=width);assert.ok(f.rows*f.size+(f.rows-1)*3<=height);assert.ok(f.columns*f.rows>=count);
 }
});
