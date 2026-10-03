"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/script.04.jeu-pokedex.js"),"utf8");
const start=source.indexOf("var partyRoomState =");
const end=source.indexOf("var partyGuessCache",start);
assert.ok(start>=0&&end>start,"Party session block missing");
const block=source.slice(start,end);

function storage(){
  const values=new Map();
  return {
    values,
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    clear:()=>values.clear()
  };
}
function fixture(){
  let now=1000,status="";
  const sessionStorage=storage(),localStorage=storage();
  const env={
    sessionStorage,localStorage,Date:{now:()=>now},
    multiplayerSocket:null,
    ensurePartyListeners(){return env.multiplayerSocket;},
    setPartyStatus:value=>{status=String(value||"");},
    renderPartyRoom(){},
    document:{getElementById(){return {classList:{contains:()=>false}};}},
    openPartyRoomMode(){}
  };
  vm.createContext(env);
  vm.runInContext(block+"\nthis.__get=getStoredPartySession;this.__save=savePartySession;this.__clear=clearPartySession;this.__resume=attemptPartyResume;",env);
  return {env,sessionStorage,localStorage,setNow:v=>{now=v;},get status(){return status;}};
}

test("Party resume token survives closing the tab so the old invite link can recover the seat",()=>{
  const f=fixture();
  f.env.__save("ABCDE","Guest","opaque-token");
  assert.equal(f.env.__get().resumeToken,"opaque-token");
  f.sessionStorage.clear();
  const recovered=f.env.__get();
  assert.ok(recovered,"persistent recovery copy missing");
  assert.equal(recovered.code,"ABCDE");
  assert.equal(recovered.nickname,"Guest");
  assert.equal(recovered.resumeToken,"opaque-token");
});

test("explicit Party leave clears both tab and persistent recovery copies",()=>{
  const f=fixture();
  f.env.__save("ABCDE","Guest","opaque-token");
  f.env.__clear();
  assert.equal(f.env.__get(),null);
  assert.equal([...f.sessionStorage.values.keys()].filter(k=>k.includes("party_session")).length,0);
  assert.equal([...f.localStorage.values.keys()].filter(k=>k.includes("party_session")).length,0);
});

test("transient Party resume error retains the token for a retry or old invite link",()=>{
  const f=fixture();
  f.env.__save("ABCDE","Guest","opaque-token");
  f.env.multiplayerSocket={
    connected:true,
    emit(_event,_payload,callback){callback({ok:false,errorCode:"rate_limited",error:"Réessaie"});}
  };
  f.env.__resume();
  assert.equal(f.env.__get().resumeToken,"opaque-token");
  assert.match(f.status,/Réessaie/);
});

test("terminal Party resume error clears an expired or invalid seat",()=>{
  const f=fixture();
  f.env.__save("ABCDE","Guest","opaque-token");
  f.env.multiplayerSocket={
    connected:true,
    emit(_event,_payload,callback){callback({ok:false,errorCode:"resume_expired",error:"Expiré"});}
  };
  f.env.__resume();
  assert.equal(f.env.__get(),null);
});
