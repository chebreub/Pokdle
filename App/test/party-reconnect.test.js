"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
const partyClient=fs.readFileSync(path.join(root,"src/script.04.jeu-pokedex.js"),"utf8");
const socketClient=fs.readFileSync(path.join(root,"src/script.07.delegation-party.js"),"utf8");
const deduction=require("../lib/party-deduction");
const nearest=require("../lib/party-nearest");
const race=require("../lib/party-dexrace");
const coop=require("../lib/party-coop");

test("Party Room has a server-owned reconnect token and grace window",()=>{
  assert.match(server,/PARTY_RECONNECT_GRACE_MS\s*=\s*30000/);
  assert.match(server,/reconnectToken:\s*crypto\.randomBytes/);
  assert.match(server,/socket\.on\("party:resume"/);
  assert.match(server,/player\.reconnectUntil\s*=\s*Date\.now\(\) \+ PARTY_RECONNECT_GRACE_MS/);
  assert.match(server,/if \(voluntary\) \{[\s\S]*finalizeDeparture\(\)[\s\S]*return;/);
});

test("Party Room client persists and automatically resumes its seat",()=>{
  assert.match(partyClient,/pokedle_party_session_v1/);
  assert.match(partyClient,/function attemptPartyResume\(\)/);
  assert.match(partyClient,/multiplayerSocket\.emit\("party:resume"/);
  assert.match(socketClient,/typeof attemptPartyResume === "function"\) attemptPartyResume\(\)/);
  assert.match(socketClient,/typeof partyHandleSocketDisconnect === "function"\) partyHandleSocketDisconnect\(\)/);
  assert.match(socketClient,/typeof getStoredPartySession === "function" && getStoredPartySession\(\)/);
});

test("nearest waits for a reconnecting round participant",()=>{
  const now=1000;
  const room={roundPlayerIds:["a","b"],players:[
    {id:"a",connected:true,nearestPick:{id:1}},
    {id:"b",connected:false,reconnectUntil:now+30000,nearestPick:null},
  ]};
  assert.equal(nearest.allNearestSubmitted(room,now),false);
  assert.equal(nearest.allNearestSubmitted(room,now+30001),true);
});

test("deduction does not end while a reconnecting participant can still return",()=>{
  const now=1000;
  const room={roundPlayerIds:["a","b"],players:[
    {id:"a",connected:true,gaveUp:true},
    {id:"b",connected:false,reconnectUntil:now+30000,gaveUp:false},
  ]};
  assert.equal(deduction.allDeductionPlayersGaveUp(room,now),false);
  assert.equal(deduction.allDeductionPlayersGaveUp(room,now+30001),true);
});

test("Dex Race preserves a team during reconnect grace",()=>{
  const now=1000;
  const room={
    race:{roster:[{id:"a",team:"blue"},{id:"b",team:"coral"}]},
    players:[
      {id:"a",connected:true},
      {id:"b",connected:false,reconnectUntil:now+30000},
    ]
  };
  assert.equal(race.raceMissingSide(room,now),false);
  assert.equal(race.raceMissingSide(room,now+30001),true);
});

test("cooperative private clues are not leaked during reconnect grace",()=>{
  const future=Date.now()+60000;
  const room={
    target:{name:"Pikachu",sprite:""},
    roundSerial:1,roundPlayerIds:["a","b"],coopSolved:false,coopGuesses:[],
    players:[
      {id:"a",nickname:"A",connected:true},
      {id:"b",nickname:"B",connected:false,reconnectUntil:future},
    ],
    coopClues:{
      a:{clues:[{label:"A",value:"1"}],shared:false},
      b:{clues:[{label:"B",value:"2"}],shared:false},
    }
  };
  assert.equal(coop.publicCoopRound(room,"a",false).sharedClues.length,0);
  room.players[1].reconnectUntil=Date.now()-1;
  assert.equal(coop.publicCoopRound(room,"a",false).sharedClues.length,1);
  assert.equal(coop.publicCoopRound(room,"a",false).sharedClues[0].nickname,"B");
});
