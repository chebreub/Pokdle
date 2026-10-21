"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const core = fs.readFileSync(path.join(__dirname, "../src/script.01.core.js"), "utf8");
const games = fs.readFileSync(path.join(__dirname, "../src/script.07.delegation-party.js"), "utf8");
function extract(source, beginning, end) {
  const from = source.indexOf(beginning), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, "Client instrumentation hooks must still exist");
  return source.slice(from, to);
}

test("completed rounds are sent without anonymous device ids; launches preserve their existing token", async () => {
  const calls = [], local = new Map();
  const context = {
    localStorage: {
      getItem(key) { return local.get(key) || null; },
      setItem(key, value) { local.set(key, value); }
    },
    window: {crypto: {randomUUID() { return "anonymous-browser-id"; }}},
    crypto: {randomUUID() { return "anonymous-browser-id"; }},
    fetch(_url, options) { calls.push(JSON.parse(options.body)); return Promise.resolve({ok:true}); },
    isPartySessionActive() { return false; },
    Date, Math, JSON
  };
  vm.createContext(context);
  vm.runInContext(extract(core, "function getUsageUid()", "const MOBILE_KEYBOARD_INPUT_SELECTOR"), context);
  context.trackUsage("complete:quiz:win");
  context.trackUsage("solo:quiz");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {event:"complete:quiz:win"}, {event:"solo:quiz",uid:"anonymous-browser-id"}
  ]);
  assert.equal(local.get("pokedle_uid_v1"),"anonymous-browser-id");
  context.isPartySessionActive = () => true;
  context.trackUsage("complete:quiz:loss");
  assert.equal(calls.length,2,"Party rounds should not leak into solo statistics");
});

test("the centralized match history emits only mode and outcome, never Pokémon or account details", () => {
  const events = [];
  const context = {
    matchHistory: [], matchHistoryOwner: () => "account-A",
    saveMatchHistory() {}, discoverFromHistory() {},
    renderShellResult() {}, trackUsage(event) { events.push(event); },
    gameMode: "normal", Date, Number, Array, Set
  };
  vm.createContext(context);
  vm.runInContext(extract(games, "function recordMatchHistory(entry) {", "let profileScoreAttackGeneration"), context);
  context.recordMatchHistory({mode:"quiz",result:"win",targetName:"Pikachu"});
  assert.deepEqual(events,["complete:quiz:win"]);
  assert.equal(context.matchHistory[0].owner,"account-A");
  assert.equal(context.matchHistory[0].targetName,"Pikachu");
  context.recordMatchHistory({mode:"normal",result:"unfinished"});
  assert.equal(events.length,1,"Unfinished games do not claim a result");
});
