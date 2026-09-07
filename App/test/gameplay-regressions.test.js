'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const mini=fs.readFileSync(path.join(__dirname,'../src/script.03.minijeux.js'),'utf8');
function func(source,name){const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
function handler(name,next,context){let callback;context.socket={id:'a',on:(_,fn)=>{callback=fn;}};context.respond=(ack,r)=>ack(r);context.checkRateLimit=()=>false;const start=server.indexOf(`  socket.on("${name}"`);vm.runInNewContext(server.slice(start,server.indexOf(`  socket.on("${next}"`,start)),context);return(payload,id='a')=>{context.socket.id=id;let response;const result=callback(payload,r=>{response=r;});return result?.then?result.then(()=>response):response;};}
function players(){return ['a','b'].map((id,i)=>({id,side:i?'right':'left',connected:true,nickname:id,score:0,allocations:[],attempts:0,guesses:[]}));}

test('Duel rejects repeated Pokémon IDs and counts a winning guess once',()=>{
 const room={status:'live',players:players(),secretPokemon:{id:6,name:'Dracaufeu'}};
 const dex={pikachu:{id:25,name:'Pikachu'},PIKACHU:{id:25,name:'Pikachu'},dracaufeu:room.secretPokemon};
 const submit=handler('duel:submit-guess','duel:leave-room',{findRoomBySocket:()=>room,resolveRoomPokemonGuess:(_,n)=>dex[n],buildGuessFeedback:p=>p,normalizeName:n=>n.toLowerCase(),emitRoomState(){},emitRoomFinished(){}});
 assert.equal(submit({guess:'pikachu'}).attempts,1);assert.equal(submit({guess:'PIKACHU'}).ok,false);assert.equal(room.players[0].guesses.length,1);
 assert.equal(submit({guess:'dracaufeu'}).correct,true);assert.equal(room.players[0].attempts,2);assert.equal(submit({guess:'dracaufeu'}).ok,false);assert.equal(room.winnerId,'a');
});
function lifecycle(){
 const room={code:'TEST',hostId:'a',status:'live',players:players()},events=[],timers=[],left=[];
 const sockets=new Map(room.players.map(p=>[p.id,{data:{roomCode:room.code},leave:code=>left.push([p.id,code])}]));
 const context={rooms:new Map([[room.code,room]]),io:{sockets:{sockets},to:id=>({emit:event=>events.push({id,event})})},publicRoomState:(_,id)=>({id}),scheduleRoomCleanup(){},setTimeout:fn=>{timers.push(fn);return 1;},clearTimeout(){},DUEL_RECONNECT_GRACE_MS:30000};
 vm.runInNewContext(['emitRoomState','emitRoomFinished','findRoomBySocket','handleDisconnect'].map(n=>func(server,n)).join('\n'),context);
 return {context,room,events,timers,sockets,left};
}
test('Duel reset removes membership and sends the forfeit only to the remaining player',()=>{
 const f=lifecycle();f.context.handleDisconnect('a',true);assert.equal(f.room.status,'finished');assert.equal(f.room.winnerId,'b');assert.equal(f.sockets.get('a').data.roomCode,null);assert.deepEqual(f.left,[['a','TEST']]);assert.equal(f.context.findRoomBySocket('a'),null);assert.ok(f.events.length);assert.ok(f.events.every(e=>e.id==='b'));
});
test('Duel refresh preserves attempts and leaves time to reconnect',()=>{
 const f=lifecycle();f.room.players[0].attempts=2;f.context.handleDisconnect('a',false);assert.equal(f.room.status,'live');assert.equal(f.room.players[0].attempts,2);assert.equal(f.timers.length,1);f.room.players[0].connected=true;f.timers[0]();assert.equal(f.room.status,'live');
});
function auction(stats=async()=>({hp:50,attack:80,defense:60,spAttack:70,spDefense:60,speed:90})){
 const room={code:'TEST',hostId:'a',status:'live',round:1,totalRounds:5,sequence:[25,6,7,8,9],players:players(),history:[],currentAllocations:{left:null,right:null}};
 const context={findStatAuctionRoomBySocket:()=>room,sanitizeStatAuctionAllocation:raw=>raw,fetchPokemonStatsServer:stats,STAT_AUCTION_STAT_KEYS:['hp','attack','defense','spAttack','spDefense','speed'],emitStatAuctionRoomState(){}};
 return {room,submit:handler('stat-auction:submit-allocation','stat-auction:restart-match',context)};
}
const allocation={hp:100,attack:0,defense:0,spAttack:0,spDefense:0,speed:0};
test('Auction does not score missing server stats and allows retry',async()=>{
 const f=auction(async()=>null);assert.equal((await f.submit({allocation})).ok,false);assert.equal(f.room.round,1);assert.equal(f.room.history.length,0);assert.equal(f.room.currentAllocations.left,null);assert.equal(f.room.players[0].allocationPending,false);
});
test('Auction completes five rounds using server totals and rejecting repeated allocations',async()=>{
 const f=auction();for(let i=1;i<=5;i++){assert.equal((await f.submit({allocation,computedScore:999999})).ok,true);assert.equal((await f.submit({allocation})).ok,false);assert.equal((await f.submit({allocation},'b')).ok,true);assert.equal(f.room.history.length,i);}assert.equal(f.room.status,'finished');assert.equal(f.room.winnerSide,'tie');assert.equal(f.room.players[0].score,25000);assert.equal(f.room.players[1].score,25000);
});
test('Auction locks in-flight submissions and ignores a response after forfeit',async()=>{
 let resolve;const f=auction(()=>new Promise(r=>{resolve=r;}));const first=f.submit({allocation});assert.equal((await f.submit({allocation})).ok,false);f.room.status='finished';resolve({hp:50});assert.equal((await first).ok,false);assert.equal(f.room.history.length,0);assert.equal(f.room.players[0].allocationPending,false);
});
test('Auction host disconnect ends the match, preserves sides and transfers host',()=>{
 const f=auction(),events=[];const c={statAuctionRooms:new Map([['TEST',f.room]]),io:{sockets:{sockets:new Map([['a',{data:{}}]])}},emitStatAuctionRoomState:r=>events.push(r)};vm.runInNewContext(func(server,'handleStatAuctionDisconnect'),c);c.handleStatAuctionDisconnect('a',false);assert.equal(f.room.status,'finished');assert.equal(f.room.winnerSide,'right');assert.equal(f.room.hostId,'b');assert.equal(f.room.players[1].side,'right');assert.equal(f.room.finishReason,'disconnect');assert.equal(events.length,1);
});
test('Cry fallback survives switching to Quiz and is removed when panel closes',()=>{
 const els={};for(const id of ['cry-box','cry-reveal','cry-sprite','cry-name'])els[id]={classList:{add(){},remove(){}},removeAttribute(name){delete this[name];}};
 const c={document:{getElementById:id=>els[id]},gameMode:'cry',secretPokemon:{id:25,name:'Pikachu'},getPokemonSpriteId:p=>p.id,getSpriteUrl:id=>`fallback/${id}`,getPokemonSprite:p=>`primary/${p.id}`,stopCrySound(){}};
 vm.runInNewContext(func(mini,'updateCryPanel'),c);c.updateCryPanel(true);const callback=els['cry-sprite'].onerror;c.secretPokemon=null;c.gameMode='quiz';callback();assert.equal(els['cry-sprite'].src,'fallback/25');c.updateCryPanel(false);assert.equal(els['cry-sprite'].onerror,null);assert.equal(els['cry-sprite'].src,undefined);
});

test('Stat Clash returns to the lobby without a false draw when stats cannot load', async () => {
 const room = { status: 'live', roundPhase: 'picking', currentPokemon: { id: 25 }, currentStats: null };
 let emitted = false;
 const c = { clearStatClashRoomTimers() {}, clearStatClashPreviewTimers() {}, emitStatClashRoomState() { emitted = true; } };
 vm.runInNewContext('async ' + func(server, 'resolveStatClashRound'), c);
 await c.resolveStatClashRound(room);
 assert.equal(room.status, 'lobby'); assert.equal(room.roundPhase, 'waiting');
 assert.match(room.notice, /sans résultat/); assert.equal(emitted, true); assert.equal(room.winnerId, undefined);
});

function higherLower(stats=async(id)=>({hp:id===25?58:100})) {
 const room={status:'live',endsAt:Date.now()+60000,sequence:[{leftId:25,rightId:151,statKey:'hp'}],players:players()};room.players.forEach(p=>p.cursor=0);
 const submit=handler('higher-lower:submit-answer','higher-lower:restart-match',{findHigherLowerRoomBySocket:()=>room,fetchPokemonStatsServer:stats,emitHigherLowerRoomState(){}});
 return {room,submit};
}
test('Higher/Lower distinguishes correct from incorrect answers with server stats',async()=>{
 const f=higherLower();assert.equal((await f.submit({choice:'higher',cursor:0})).correct,true);assert.equal((await f.submit({choice:'lower',cursor:0},'b')).correct,false);assert.equal(f.room.players[0].score,1);assert.equal(f.room.players[1].score,0);assert.equal((await f.submit({choice:'higher',cursor:0})).ok,false);
});
test('Higher/Lower does not turn unavailable stats into a free point',async()=>{
 const f=higherLower(async()=>null);assert.equal((await f.submit({choice:'higher'})).ok,false);assert.equal(f.room.players[0].score,0);assert.equal(f.room.players[0].cursor,0);assert.equal(f.room.players[0].answerPending,false);
});
test('Higher/Lower rejects concurrent answers and late responses after the timer',async()=>{
 const resolvers=[];const f=higherLower(()=>new Promise(r=>resolvers.push(r)));const first=f.submit({choice:'higher'});assert.equal((await f.submit({choice:'higher'})).ok,false);f.room.endsAt=Date.now()-1;resolvers.forEach(r=>r({hp:100}));assert.equal((await first).ok,false);assert.equal(f.room.players[0].score,0);
});
test('Higher/Lower disconnect stops the timer and preserves the winning side',()=>{
 const f=higherLower();f.room.code='TEST';f.room.hostId='a';f.room.endTimer=1;let cleared=false;
 const c={higherLowerRooms:new Map([['TEST',f.room]]),io:{sockets:{sockets:new Map([['a',{data:{}}]])}},clearTimeout(){cleared=true;},emitHigherLowerRoomState(){}};
 vm.runInNewContext(func(server,'handleHigherLowerDisconnect'),c);c.handleHigherLowerDisconnect('a',false);assert.equal(f.room.status,'finished');assert.equal(f.room.winnerSide,'right');assert.equal(f.room.hostId,'b');assert.equal(cleared,true);
});

test('A late Duel result cannot open its overlay over another screen', () => {
 const source=fs.readFileSync(path.join(__dirname,'../src/script.07.delegation-party.js'),'utf8');
 let hidden=false;
 const c={document:{getElementById:id=>id==='screen-multiplayer'?{classList:{contains:()=>true}}:id==='multiplayer-result-box'?{querySelector:()=>null}:{}},hideMultiplayerWinOverlay(){hidden=true;}};
 vm.runInNewContext(func(source,'renderMultiplayerBotResult'),c);
 assert.equal(c.renderMultiplayerBotResult(),false);assert.equal(hidden,true);
});

test('Higher/Lower UI waits for acknowledgement and preserves the pair on a rejected answer', () => {
 const state={phase:'playing',isAnimating:false,roomPairIndex:0,score:0,left:{statValue:58},right:{statValue:100},room:{status:'live',players:[{isSelf:true,cursor:0}]}};
 let acknowledge;const timers=[];let loaded=null;
 const c={higherLowerState:state,renderHigherLowerScreen(){},multiplayerSocket:{connected:true,timeout:()=>({emit:(_,payload,callback)=>{assert.equal(payload.cursor,0);acknowledge=callback;}})},trackHigherLowerTimeout:fn=>timers.push(fn),loadHigherLowerVersusPair:index=>{loaded=index;}};
 vm.runInNewContext(func(mini,'answerHigherLowerVersus'),c);
 c.answerHigherLowerVersus('higher');assert.equal(state.score,0);assert.equal(state.phase,'playing');assert.equal(state.isAnimating,true);
 acknowledge(null,{ok:false,error:'Stats unavailable'});assert.equal(state.roomPairIndex,0);assert.equal(state.isAnimating,false);assert.equal(timers.length,0);
 c.answerHigherLowerVersus('higher');acknowledge(null,{ok:true,correct:true,leftVal:58,rightVal:100,score:1,cursor:1});
 assert.equal(state.phase,'revealing');assert.equal(state.score,1);timers[0]();assert.equal(loaded,1);assert.equal(state.roomPairIndex,1);
});
