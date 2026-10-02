"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");

function extractFunction(name){
  const start=source.indexOf("function "+name+"(");
  if(start<0) throw new Error("Missing function "+name);
  const brace=source.indexOf("{",start);
  let depth=0, quote=null, escape=false, templateDepth=0;
  for(let i=brace;i<source.length;i++){
    const ch=source[i], prev=source[i-1];
    if(quote){
      if(escape){escape=false;continue;}
      if(ch==="\\"){escape=true;continue;}
      if(quote==="\`" && ch==="$" && source[i+1]==="{"){templateDepth++;i++;depth++;continue;}
      if(ch===quote && (quote!=="\`" || templateDepth===0)){quote=null;continue;}
      if(quote==="\`" && ch==="}" && templateDepth>0){templateDepth--;depth--;continue;}
      continue;
    }
    if(ch==="'"||ch==='"'||ch==="\`"){quote=ch;continue;}
    if(ch==="{") depth++;
    else if(ch==="}"){depth--;if(depth===0)return source.slice(start,i+1);}
  }
  throw new Error("Unclosed function "+name);
}

function fixture({hostLeaves=true}={}){
  const host={id:"host",nickname:"Host",side:"left",connected:true,reconnectTimer:null,reconnectUntil:null};
  const guest={id:"guest",nickname:"Guest",side:"right",connected:true,reconnectTimer:null,reconnectUntil:null};
  const room={
    code:"CLASH",status:"lobby",roundPhase:"waiting",hostId:"host",
    players:[host,guest],pendingImposedRuleBySide:{left:"noSpeedEarly",right:"atkRound3"},
    startedAt:123,rollEndsAt:456,lockedEndsAt:789,deadlineAt:999
  };
  const rooms=new Map([[room.code,room]]);
  const leaves=[],emits=[],timers=[];
  const sockets=new Map([
    ["host",{data:{statClashRoomCode:"CLASH"},leave:code=>leaves.push(["host",code])}],
    ["guest",{data:{statClashRoomCode:"CLASH"},leave:code=>leaves.push(["guest",code])}]
  ]);
  const context=vm.createContext({
    console,
    statClashRooms:rooms,
    findStatClashRoomBySocket:id=>room.players.some(p=>p.id===id)?room:null,
    io:{sockets:{sockets:{get:id=>sockets.get(id)}},to:()=>({emit(){}})},
    clearTimeout(){},
    setTimeout(fn){timers.push(fn);return timers.length;},
    STAT_CLASH_RECONNECT_GRACE_MS:30000,
    clearStatClashRoomTimers(){},
    emitStatClashRoomState:r=>emits.push({hostId:r.hostId,count:r.players.length,notice:r.notice}),
    emitStatClashFinished(){},
    scheduleStatClashRoomCleanup(){}
  });
  vm.runInContext(extractFunction("handleStatClashDisconnect"),context);
  return {context,room,rooms,host,guest,leaves,emits};
}

test("Stat Clash host voluntary leave transfers lobby ownership",()=>{
  const f=fixture();
  f.context.handleStatClashDisconnect("host",true);
  assert.equal(f.room.players.length,1);
  assert.equal(f.room.players[0].id,"guest");
  assert.equal(f.room.hostId,"guest");
  assert.equal(f.room.status,"lobby");
  assert.equal(f.room.roundPhase,"waiting");
  assert.equal(f.room.pendingImposedRuleBySide.left,null);
  assert.equal(f.room.pendingImposedRuleBySide.right,"atkRound3");
  assert.equal(f.room.startedAt,null);
  assert.equal(f.room.rollEndsAt,null);
  assert.equal(f.room.lockedEndsAt,null);
  assert.equal(f.room.deadlineAt,null);
  assert.match(f.room.notice,/Guest devient l'hôte/);
  assert.deepEqual(f.leaves,[["host","CLASH"]]);
  assert.equal(f.rooms.has("CLASH"),true);
  assert.equal(f.emits.at(-1).hostId,"guest");
});

test("Stat Clash guest voluntary leave preserves host and clears the vacated side rule",()=>{
  const f=fixture();
  f.context.handleStatClashDisconnect("guest",true);
  assert.equal(f.room.players.length,1);
  assert.equal(f.room.players[0].id,"host");
  assert.equal(f.room.hostId,"host");
  assert.equal(f.room.pendingImposedRuleBySide.left,"noSpeedEarly");
  assert.equal(f.room.pendingImposedRuleBySide.right,null);
  assert.deepEqual(f.leaves,[["guest","CLASH"]]);
});

test("Stat Clash deletes an empty lobby after its last player leaves",()=>{
  const f=fixture();
  f.room.players=[f.host];
  f.context.handleStatClashDisconnect("host",true);
  assert.equal(f.rooms.has("CLASH"),false);
});
