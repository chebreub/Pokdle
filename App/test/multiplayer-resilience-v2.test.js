"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const server=fs.readFileSync(path.join(root,"server.js"),"utf8");
const duelClient=fs.readFileSync(path.join(root,"src/script.07.delegation-party.js"),"utf8");
const clashClient=fs.readFileSync(path.join(root,"src/script.02.statclash.js"),"utf8");
const auctionClient=fs.readFileSync(path.join(root,"src/script.03.minijeux.js"),"utf8");

test("Duel 1v1 reconnect uses a server token instead of nickname matching",()=>{
  assert.match(server,/function joinPlayerToRoom[\s\S]*reconnectToken:\s*crypto\.randomBytes/);
  assert.match(server,/socket\.on\("duel:resume"[\s\S]*payload\.resumeToken/);
  assert.match(server,/room\.players\.find\(\(entry\) => entry\.reconnectToken === token\)/);
  const resume=server.slice(server.indexOf('socket.on("duel:resume"'),server.indexOf('socket.on("duel:update-gens"'));
  assert.doesNotMatch(resume,/nickname\)\s*===|normalizeName\(entry\.nickname/);
  assert.match(duelClient,/pokedle_duel_session_v1/);
  assert.match(duelClient,/resumeToken/);
});

test("Duel waiting and live rooms both reserve seats for 30 seconds",()=>{
  assert.match(server,/DUEL_RECONNECT_GRACE_MS\s*=\s*30000/);
  const fn=server.slice(server.indexOf("function handleDisconnect(socketId, voluntary)"),server.indexOf("function handleStatClashDisconnect"));
  assert.match(fn,/player\.reconnectUntil = Date\.now\(\) \+ DUEL_RECONNECT_GRACE_MS/);
  assert.match(fn,/room\.status === "waiting"[\s\S]*finalizeWaitingDeparture/);
  assert.match(fn,/room\.status === "live"[\s\S]*finalizeLiveDeparture/);
  assert.match(server,/room\.status === "waiting"[\s\S]*room\.players\.every\(\(entry\) => entry\.connected\)[\s\S]*startRoom\(room\)/);
});

test("Stat Clash reserves host and opponent seats across a refresh",()=>{
  assert.match(server,/STAT_CLASH_RECONNECT_GRACE_MS\s*=\s*30000/);
  assert.match(server,/joinPlayerToStatClashRoom[\s\S]*reconnectToken:\s*crypto\.randomBytes/);
  assert.match(server,/socket\.on\("stat-clash:resume"/);
  assert.match(server,/player\.reconnectUntil = Date\.now\(\) \+ STAT_CLASH_RECONNECT_GRACE_MS/);
  assert.match(clashClient,/pokedle_statclash_session_v1/);
  assert.match(clashClient,/function attemptStatClashResume\(\)/);
  assert.match(clashClient,/stat-clash:resume/);
});

test("Stat Auction reserves the same side and score across a refresh",()=>{
  assert.match(server,/STAT_AUCTION_RECONNECT_GRACE_MS\s*=\s*30000/);
  assert.match(server,/stat-auction:create-room[\s\S]*reconnectToken:\s*crypto\.randomBytes/);
  assert.match(server,/socket\.on\("stat-auction:resume"/);
  assert.match(server,/player\.reconnectUntil = Date\.now\(\) \+ STAT_AUCTION_RECONNECT_GRACE_MS/);
  assert.match(auctionClient,/pokedle_statauction_session_v1/);
  assert.match(auctionClient,/function attemptStatAuctionResume\(\)/);
  assert.match(auctionClient,/stat-auction:resume/);
});

test("socket bootstrap resumes every supported competitive session",()=>{
  assert.match(duelClient,/attemptDuelResume\(\)/);
  assert.match(duelClient,/attemptPartyResume/);
  assert.match(duelClient,/attemptStatClashResume/);
  assert.match(duelClient,/attemptStatAuctionResume/);
  assert.match(duelClient,/pokedle_statclash_session_v1/);
  assert.match(duelClient,/pokedle_statauction_session_v1/);
});
