"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");

function extractFunction(name){
  const start=server.indexOf("function "+name+"(");
  assert.ok(start>=0,name+" helper missing");
  const end=server.indexOf("\n}",start);
  assert.ok(end>start,name+" helper boundary missing");
  return server.slice(start,end+2);
}
function extractHandler(event,nextEvent){
  const start=server.indexOf('  socket.on("'+event+'"');
  assert.ok(start>=0,event+" handler missing");
  const end=server.indexOf('\n  socket.on("'+nextEvent+'"',start+1);
  assert.ok(end>start,nextEvent+" boundary missing");
  return server.slice(start,end);
}
function fixture(status="playing"){
  const room={
    code:"ABCDE",status,hostId:"host",gameMode:"deduction",
    roundNumber:3,totalRounds:5,configuredRounds:5,
    deadlineAt:Date.now()+50000,roundStartedAt:Date.now()-5000,roundTimer:77,
    target:{id:25,name:"Pikachu"},variant:"pixel",roundPlayerIds:["host","guest"],
    deductionWinnerId:"guest",nearestTarget:25,nearestResolved:true,
    typeCombo:{key:"Feu|Vol"},typeComboWinnerAnswer:"Dracaufeu",typeComboWinnerSprite:"x",typeComboWinnerGain:90,typeComboUsedNames:["Dracaufeu"],
    duoCriteria:[{kind:"type",label:"Feu"}],duoWinnerAnswer:"Dracaufeu",duoWinnerSprite:"x",duoWinnerGain:80,duoUsedNames:["Dracaufeu"],
    targetStats:{hp:1},bestStatKey:"hp",coopGuesses:[{id:25}],coopSolved:true,coopClues:{host:{clues:["a"]}},
    race:{claims:new Map([["25",{playerId:"host"}]]),roster:[{id:"host"},{id:"guest"}]},
    recentComboKeys:["x"],recentDuoKeys:["y"],
    players:[
      {id:"host",nickname:"Host",connected:true,score:170,correct:true,lastGain:70,usedStatKeys:["hp"],pickKey:"hp",nearestPick:{id:25},guesses:[{id:1}],attempts:2,gaveUp:false},
      {id:"guest",nickname:"Guest",connected:true,score:100,correct:true,lastGain:100,usedStatKeys:["speed"],pickKey:"speed",nearestPick:{id:26},guesses:[{id:2}],attempts:1,gaveUp:true}
    ]
  };
  let callback,emits=0,cleared=0,usage=[];
  const socket={id:"host",on(name,fn){if(name==="party:return-to-setup")callback=fn;}};
  const context={
    socket,
    findPartyRoomBySocket(){return room;},
    respond(ack,value){ack(value);},
    emitPartyRoomState(){emits++;},
    publicPartyRoomState(value,viewerId){return {code:value.code,status:value.status,hostId:value.hostId,gameMode:value.gameMode,roundNumber:value.roundNumber,players:value.players.map(p=>({id:p.id,score:p.score,connected:p.connected,isSelf:p.id===viewerId,isHost:p.id===value.hostId}))};},
    recordUsage(value){usage.push(value);},
    clearTimeout(){cleared++;}
  };
  new Function("env","with(env){"+extractFunction("clearPartyRoundTimer")+"\n"+extractFunction("resetPartyCampaign")+"\nthis.resetPartyCampaign=resetPartyCampaign;}")(context);
  new Function("env","with(env){"+extractHandler("party:return-to-setup","party:set-mode")+"}")(context);
  function invoke(id="host"){
    socket.id=id;let result;
    callback({},value=>{result=value;});
    return result;
  }
  return {room,context,invoke,get emits(){return emits;},get cleared(){return cleared;},usage};
}

test("only the host can leave a live Party game for the persistent room setup",()=>{
  const f=fixture();
  const denied=f.invoke("guest");
  assert.equal(denied.ok,false);
  assert.match(denied.error,/hote/i);
  assert.equal(f.room.status,"playing");
  const ok=f.invoke("host");
  assert.equal(ok.ok,true);
  assert.equal(f.room.code,"ABCDE");
  assert.equal(f.room.hostId,"host");
  assert.deepEqual(f.room.players.map(p=>[p.id,p.connected]),[["host",true],["guest",true]]);
  assert.equal(f.room.status,"waiting");
  assert.equal(f.room.roundNumber,0);
  assert.equal(f.room.deadlineAt,null);
  assert.equal(f.room.roundTimer,null);
  assert.equal(f.room.target,null);
  assert.equal(f.room.race,null);
  assert.equal(f.room.typeCombo,null);
  assert.equal(f.room.duoCriteria,null);
  assert.deepEqual(f.room.roundPlayerIds,[]);
  assert.deepEqual(f.room.players.map(p=>p.score),[0,0]);
  assert.ok(f.room.players.every(p=>!p.correct && p.lastGain===0 && p.pickKey===null && p.nearestPick===null && p.attempts===0 && p.guesses.length===0 && p.gaveUp===false));
  assert.equal(f.emits,1);
  assert.equal(f.cleared,1);
  assert.deepEqual(f.usage,["party:return-to-setup"]);
});

test("returning from a finished round also resets the campaign without removing players",()=>{
  const f=fixture("finished");
  const res=f.invoke();
  assert.equal(res.ok,true);
  assert.equal(f.room.status,"waiting");
  assert.equal(f.room.players.length,2);
  assert.equal(f.room.gameMode,"deduction");
});

test("after returning to setup the existing mode selector can choose another game",()=>{
  const f=fixture();
  assert.equal(f.invoke().ok,true);
  let setMode;
  f.context.socket.on=(name,fn)=>{if(name==="party:set-mode")setMode=fn;};
  f.context.dexRace={balanceRaceTeams(){}};
  new Function("env","with(env){"+extractHandler("party:set-mode","party:set-rounds")+"}")(f.context);
  let response;
  setMode({mode:"guess"},value=>{response=value;});
  assert.equal(response.ok,true);
  assert.equal(f.room.status,"waiting");
  assert.equal(f.room.gameMode,"guess");
  assert.equal(f.room.players.length,2);
});
