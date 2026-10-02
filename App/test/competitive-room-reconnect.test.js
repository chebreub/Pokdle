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
  assert.ok(server.includes("const STAT_CLASH_RECONNECT_GRACE_MS = 30000"));
  assert.ok(server.includes('socket.on("stat-clash:resume"'));
  assert.ok(server.includes("player.reconnectUntil = Date.now() + STAT_CLASH_RECONNECT_GRACE_MS"));
  assert.ok(server.includes('reconnectToken: crypto.randomBytes(18).toString("hex")'));
  const start=server.indexOf("function handleStatClashDisconnect");
  const end=server.indexOf("function findDraftBattleRoomBySocket",start);
  const section=server.slice(start,end);
  assert.ok(section.indexOf("if (voluntary)") < section.indexOf("player.reconnectUntil = Date.now() + STAT_CLASH_RECONNECT_GRACE_MS"));
  assert.ok(section.includes("}, STAT_CLASH_RECONNECT_GRACE_MS)"));
});

test("Stat Auction also treats refresh differently from explicit leave",()=>{
  assert.ok(server.includes("const STAT_AUCTION_RECONNECT_GRACE_MS = 30000"));
  assert.ok(server.includes('socket.on("stat-auction:resume"'));
  assert.ok(server.includes("player.reconnectUntil = Date.now() + STAT_AUCTION_RECONNECT_GRACE_MS"));
  const start=server.indexOf("function handleStatAuctionDisconnect");
  const end=server.indexOf("server.listen",start);
  const section=server.slice(start,end);
  assert.ok(section.indexOf("if (forceLeave)") < section.indexOf("player.reconnectUntil = Date.now() + STAT_AUCTION_RECONNECT_GRACE_MS"));
  assert.ok(section.includes("}, STAT_AUCTION_RECONNECT_GRACE_MS)"));
});

test("competitive clients persist opaque resume tokens in session storage",()=>{
  assert.ok(clash.includes("pokedle_stat_clash_session_v1"));
  assert.ok(clash.includes("function attemptStatClashResume()"));
  assert.ok(clash.includes('multiplayerSocket.emit("stat-clash:resume"'));
  assert.ok(clash.includes("clearStatClashSession()"));
  assert.ok(auction.includes("pokedle_stat_auction_session_v1"));
  assert.ok(auction.includes("function attemptStatAuctionResume()"));
  assert.ok(auction.includes('multiplayerSocket.emit("stat-auction:resume"'));
  assert.ok(auction.includes("clearStatAuctionSession()"));
});

test("shared socket lifecycle auto-resumes and reports interrupted competitive rooms",()=>{
  for (const token of [
    "attemptStatClashResume",
    "attemptStatAuctionResume",
    "statClashHandleSocketDisconnect",
    "statAuctionHandleSocketDisconnect",
    "getStoredStatClashSession",
    "getStoredStatAuctionSession",
    "clearStatClashSession",
  ]) assert.ok(socket.includes(token), token);
});

test("Stat Clash keeps its existing round token separate from reconnect identity",()=>{
  assert.ok(clash.includes("const nextToken = roomState?.currentPokemon"));
  assert.ok(clash.includes("statClashState.roomToken = nextToken"));
  assert.ok(!clash.includes("roomToken: response.resumeToken"));
});


test("Stat Auction completion is idempotent across refresh recovery",()=>{
  assert.ok(auction.includes("function hasRecordedStatAuctionResult"));
  assert.ok(auction.includes("function markStatAuctionResultRecorded"));
  assert.ok(auction.includes("const alreadyRecorded = hasRecordedStatAuctionResult(room.code)"));
  assert.ok(auction.includes("if (!wasFinished && !alreadyRecorded)"));
  assert.ok(auction.includes("markStatAuctionResultRecorded(room.code)"));
});


test("socket reconnect resumes only the most recent realtime room",()=>{
  assert.ok(socket.includes("function attemptPreferredRealtimeResume()"));
  assert.ok(socket.includes("candidates.sort((a, b) => b.ts - a.ts)"));
  const connectStart=socket.indexOf('multiplayerSocket.on("connect"');
  const connectEnd=socket.indexOf('multiplayerSocket.on("connect_error"',connectStart);
  const connectBlock=socket.slice(connectStart,connectEnd);
  assert.ok(connectBlock.includes("attemptPreferredRealtimeResume()"));
  assert.ok(!connectBlock.includes("attemptDuelResume();\n    if"));
});
