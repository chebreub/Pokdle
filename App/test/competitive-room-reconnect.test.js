"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
const clash=fs.readFileSync(path.join(root,"src/script.02.statclash.js"),"utf8");
const auction=fs.readFileSync(path.join(root,"src/script.03.minijeux.js"),"utf8");
const socket=fs.readFileSync(path.join(root,"src/script.07.delegation-party.js"),"utf8");

test("Stat Clash reserves a disconnected seat before applying forfeit semantics",()=>{
  assert.match(server,/STAT_CLASH_RECONNECT_GRACE_MS\\s*=\\s*30000/);
  assert.match(server,/socket\\.on\\("stat-clash:resume"/);
  assert.match(server,/player\\.reconnectUntil\\s*=\\s*Date\\.now\\(\\) \\+ STAT_CLASH_RECONNECT_GRACE_MS/);
  assert.match(server,/reconnectToken:\\s*crypto\\.randomBytes\\(18\\)/);
  const start=server.indexOf("function handleStatClashDisconnect");
  const end=server.indexOf("function findDraftBattleRoomBySocket",start);
  const section=server.slice(start,end);
  assert.match(section,/if \\(voluntary\\)[\\s\\S]*finalizeDeparture\\(\\)[\\s\\S]*return/);
  assert.match(section,/setTimeout\\([\\s\\S]*finalizeDeparture\\(\\)[\\s\\S]*STAT_CLASH_RECONNECT_GRACE_MS/);
});

test("Stat Auction also treats refresh differently from explicit leave",()=>{
  assert.match(server,/STAT_AUCTION_RECONNECT_GRACE_MS\\s*=\\s*30000/);
  assert.match(server,/socket\\.on\\("stat-auction:resume"/);
  assert.match(server,/player\\.reconnectUntil\\s*=\\s*Date\\.now\\(\\) \\+ STAT_AUCTION_RECONNECT_GRACE_MS/);
  const start=server.indexOf("function handleStatAuctionDisconnect");
  const end=server.indexOf("server.listen",start);
  const section=server.slice(start,end);
  assert.match(section,/if \\(forceLeave\\)[\\s\\S]*finalizeDeparture\\(\\)/);
  assert.match(section,/setTimeout\\([\\s\\S]*STAT_AUCTION_RECONNECT_GRACE_MS/);
});

test("competitive clients persist opaque resume tokens in session storage",()=>{
  assert.match(clash,/pokedle_stat_clash_session_v1/);
  assert.match(clash,/function attemptStatClashResume\\(\\)/);
  assert.match(clash,/multiplayerSocket\\.emit\\("stat-clash:resume"/);
  assert.match(clash,/clearStatClashSession\\(\\)/);
  assert.match(auction,/pokedle_stat_auction_session_v1/);
  assert.match(auction,/function attemptStatAuctionResume\\(\\)/);
  assert.match(auction,/multiplayerSocket\\.emit\\("stat-auction:resume"/);
  assert.match(auction,/clearStatAuctionSession\\(\\)/);
});

test("shared socket lifecycle auto-resumes and reports interrupted competitive rooms",()=>{
  assert.match(socket,/attemptStatClashResume/);
  assert.match(socket,/attemptStatAuctionResume/);
  assert.match(socket,/statClashHandleSocketDisconnect/);
  assert.match(socket,/statAuctionHandleSocketDisconnect/);
  assert.match(socket,/getStoredStatClashSession/);
  assert.match(socket,/getStoredStatAuctionSession/);
  assert.match(socket,/clearStatClashSession/);
});

test("Stat Clash keeps its existing round token separate from reconnect identity",()=>{
  assert.match(clash,/const nextToken = roomState\\?\\.currentPokemon/);
  assert.match(clash,/statClashState\\.roomToken = nextToken/);
  assert.doesNotMatch(clash,/roomToken:\\s*response\\.resumeToken/);
});
