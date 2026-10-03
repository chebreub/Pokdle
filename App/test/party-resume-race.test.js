"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");

function partyResumeFixture(resumeId="guest-new") {
  const room={
    code:"ABCDE",status:"playing",hostId:"host-old",
    roundPlayerIds:["host-old","guest-old"],deductionWinnerId:"guest-old",
    players:[
      {id:"host-old",nickname:"Host",connected:true,reconnectToken:"host-token",reconnectUntil:null,reconnectTimer:null},
      {id:"guest-old",nickname:"Guest",connected:true,reconnectToken:"guest-token",reconnectUntil:null,reconnectTimer:null,score:70}
    ],
    race:{
      roster:[{id:"host-old",team:"blue"},{id:"guest-old",team:"coral"}],
      claims:new Map([["25",{playerId:"guest-old"}]])
    },
    coopClues:{"guest-old":{clues:["x"]}}
  };
  const calls={left:[],joined:[],disconnected:[],emits:0};
  function oldSocket(id){
    return {
      id,connected:true,data:{partyRoomCode:room.code},
      leave(code){calls.left.push([id,code]);},
      disconnect(force){calls.disconnected.push([id,force]);this.connected=false;}
    };
  }
  const oldHost=oldSocket("host-old"),oldGuest=oldSocket("guest-old");
  let callback;
  const socket={
    id:resumeId,connected:true,data:{},
    on(name,fn){if(name==="party:resume")callback=fn;},
    join(code){calls.joined.push([this.id,code]);}
  };
  const context={
    socket,partyRooms:new Map([[room.code,room]]),
    io:{sockets:{sockets:new Map([["host-old",oldHost],["guest-old",oldGuest],[resumeId,socket]])}},
    checkRateLimit(){return false;},sanitizeRoomCode:v=>String(v||"").toUpperCase(),
    respond:(ack,value)=>ack(value),clearTimeout(){},clearPartyRoomCleanup(){},
    emitPartyRoomState(){calls.emits++;},
    publicPartyRoomState(value,viewerId){return {code:value.code,viewerId,players:value.players.map(p=>({id:p.id,connected:p.connected}))};}
  };
  const start=server.indexOf('  socket.on("party:resume"');
  const end=server.indexOf('\n  socket.on("party:leave-room"',start);
  assert.ok(start>=0&&end>start,"party:resume handler missing");
  new Function("env","with(env){"+server.slice(start,end)+"}")(context);
  return {
    room,calls,socket,oldHost,oldGuest,
    resume(token){
      let result;
      callback({code:room.code,resumeToken:token},value=>{result=value;});
      return result;
    }
  };
}

test("Party resume transfers a still-connected guest seat instead of rejecting Safari refresh race",()=>{
  const f=partyResumeFixture();
  const res=f.resume("guest-token");
  assert.equal(res.ok,true);
  assert.equal(f.room.players.length,2);
  assert.equal(f.room.players[1].id,"guest-new");
  assert.equal(f.room.players[1].score,70);
  assert.equal(f.room.players[1].connected,true);
  assert.equal(f.room.hostId,"host-old");
  assert.deepEqual(f.room.roundPlayerIds,["host-old","guest-new"]);
  assert.equal(f.room.deductionWinnerId,"guest-new");
  assert.equal(f.room.race.roster[1].id,"guest-new");
  assert.equal(f.room.race.claims.get("25").playerId,"guest-new");
  assert.deepEqual(f.room.coopClues["guest-new"],{clues:["x"]});
  assert.equal(f.room.coopClues["guest-old"],undefined);
  assert.equal(f.oldGuest.data.partyRoomCode,null);
  assert.deepEqual(f.calls.left,[["guest-old","ABCDE"]]);
  assert.deepEqual(f.calls.disconnected,[["guest-old",true]]);
  assert.deepEqual(f.calls.joined,[["guest-new","ABCDE"]]);
  assert.equal(f.socket.data.partyRoomCode,"ABCDE");
  assert.equal(f.calls.emits,1);
});

test("Party resume transfers host ownership atomically when replacement socket wins the race",()=>{
  const f=partyResumeFixture("host-new");
  const res=f.resume("host-token");
  assert.equal(res.ok,true);
  assert.equal(f.room.hostId,"host-new");
  assert.equal(f.room.players[0].id,"host-new");
  assert.equal(f.room.players[1].id,"guest-old");
  assert.deepEqual(f.room.roundPlayerIds,["host-new","guest-old"]);
  assert.equal(f.oldHost.data.partyRoomCode,null);
  assert.deepEqual(f.calls.disconnected,[["host-old",true]]);
});

test("same socket Party resume is idempotent",()=>{
  const f=partyResumeFixture("guest-old");
  const res=f.resume("guest-token");
  assert.equal(res.ok,true);
  assert.equal(f.room.players[1].id,"guest-old");
  assert.equal(f.calls.disconnected.length,0);
});
