"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {partyInviteStatus,PARTY_INVITE_MAX_PLAYERS} = require("../lib/party-invites");
const read = p => fs.readFileSync(path.join(__dirname,"..",p),"utf8");

function room(partial={}) {
  return {code:"AB3DF",gameMode:"dessin",status:"waiting",players:[
    {id:"private-user",nickname:"Private nickname",email:"private@example.com",reconnectToken:"private-token",score:100}
  ],...partial};
}

test("PART-01: a working Dessine-le invitation reveals only game, code and capacity",()=>{
  const result=partyInviteStatus(room(),"dessin");
  assert.deepEqual(result,{ok:true,code:"AB3DF",gameMode:"dessin",seatsLeft:7});
  const json=JSON.stringify(result);
  for(const secret of ["Private nickname","private@example.com","private-token","private-user","score","players"])
    assert.equal(json.includes(secret),false,secret+" was exposed");
  assert.equal(PARTY_INVITE_MAX_PLAYERS,8);
});

test("PART-01: explicit invitation errors for missing, hostless, changed, started and full rooms",()=>{
  assert.equal(partyInviteStatus(null,"dessin").errorCode,"invite_expired");
  assert.equal(partyInviteStatus(room({players:[]}),"dessin").errorCode,"invite_expired");
  assert.equal(partyInviteStatus(room({gameMode:"guess"}),"dessin").errorCode,"invite_game_changed");
  for(const status of ["playing","finished","complete"])
    assert.equal(partyInviteStatus(room({status}),"dessin").errorCode,"invite_started");
  assert.equal(partyInviteStatus(room({players:Array.from({length:8},(_,i)=>({id:i}))}),"dessin").errorCode,"invite_full");
  assert.equal(partyInviteStatus(room(),"bad").errorCode,"invite_invalid");
  assert.ok(partyInviteStatus(room({gameMode:"guess"}),null).ok,"legacy generic room links are unchanged");
});

test("PART-01: existing server guest flow is retained and expected mode is rechecked at join",()=>{
  const server=read("server.js");
  const preview=server.slice(server.indexOf('socket.on("party:invite-preview"'),server.indexOf('socket.on("party:create-room"'));
  assert.match(preview,/checkRateLimit\(socket, "party-invite-preview"\)/);
  assert.match(server,/"party-invite-preview": \{ max: 8, ipMax: 30, windowMs: 30_000 \}/);

  assert.match(preview,/partyInviteStatus\(partyRooms.get\(code\)/);
  const create=server.slice(server.indexOf('socket.on("party:create-room"'),server.indexOf('socket.on("party:join-room"'));
  assert.match(create,/payload\.gameMode === "dessin"/);
  assert.match(create,/joinPlayerToPartyRoom\(room, socket, nickname/);
  const join=server.slice(server.indexOf('socket.on("party:join-room"'),server.indexOf('socket.on("party:resume"'));
  assert.match(join,/payload\.expectedMode === "dessin"/);
  assert.match(join,/partyInviteStatus\(room, "dessin"\)/);
  assert.match(join,/room\.players\.length >= PARTY_MAX_PLAYERS/);
  assert.doesNotMatch(join,/account_required|playerId|requiredLogin/);
});

test("PART-01: the lobby uses a server-previewed link with no account or secret in its URL",()=>{
  const client=read("src/script.04.jeu-pokedex.js");
  assert.match(client,/\?party=" \+ encodeURIComponent\(partyRoomState\.code\)/);
  assert.match(client,/isDessin \? "&game=dessin" : ""/);
  assert.match(client,/socket\.emit\("party:invite-preview", \{ code: code, expectedMode: "dessin" \}/);
  assert.match(client,/if \(expectedMode\) params\.delete\("game"\)/);
  assert.match(client,/partyRoomState\.inviteCode === code && partyRoomState\.inviteExpectedMode === "dessin"/);
  assert.match(read("index.html"),/id="party-invite-notice"[^>]*aria-live="polite"/);
});
