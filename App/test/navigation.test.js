"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../src/script.04.jeu-pokedex.js"), "utf8");
const routing = source.slice(source.indexOf("/* Screen history:"), source.indexOf("/* Party Room L1"));
const invite = source.slice(source.indexOf("function initPartyFromUrl()"), source.indexOf('\nif (document.readyState', source.indexOf("function initPartyFromUrl()")));

function fixture(url = "https://example.test/") {
  const listeners = {}, deferred = [], pushes = [];
  const screen = { hidden: true, classList: { contains: () => screen.hidden } };
  const input = { value: "" };
  const context = {
    URLSearchParams, location: new URL(url), gameMode: "normal", secretPokemon: null,
    current: "config", starts: 0, restoredMode: null,
    setTimeout: (fn) => deferred.push(fn),
    addEventListener: (event, fn) => { listeners[event] = fn; },
    document: { readyState: "complete", getElementById: (id) => id === "screen-game" ? screen : input },
    showScreen: (id) => { context.current = id.replace("screen-", ""); screen.hidden = id !== "screen-game"; },
    updateTopTag() {}, updateModeBanners() {}, setGlobalNavActive() {},
    showDailyCompletedView: () => false,
    restoreSavedGame: (mode) => { context.restoredMode = mode; context.current = "game"; return true; },
    setPartyStatus: (message) => { context.message = message; },
  };
  for (const [name, key] of Object.entries({ goToConfig: "config", openPokedexMode: "pokedex", openPartyRoomMode: "party", openProfileScreen: "profile" })) {
    context[name] = () => context.showScreen("screen-" + key);
  }
  for (const [name, mode] of Object.entries({ startDailyGame: "daily", startNormalGame: "normal" })) {
    context[name] = () => {
      if (context.failStart) return;
      context.starts++;
      context.gameMode = mode;
      context.secretPokemon = { id: mode === "daily" ? 25 : 6 };
      context.showScreen("screen-game");
    };
  }
  context.history = {
    state: null,
    replaceState(state, _, target) { this.state = state; context.location = new URL(target, context.location); },
    pushState(state, _, target) { pushes.push(state); this.replaceState(state, _, target); },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(routing + invite, context);
  return { context, listeners, deferred, pushes, input, screen };
}

test("back from the Pokédex restores the daily view without drawing or counting a game", () => {
  const f = fixture();
  f.context.startDailyGame();
  const game = f.context.history.state;
  f.context.openPokedexMode();
  f.listeners.popstate({ state: game });
  assert.equal(f.context.current, "game");
  assert.equal(f.context.starts, 1);
  assert.equal(f.context.restoredMode, null);
  assert.equal(f.pushes.length, 2);
});

test("normal history asks for the normal save instead of the daily save", () => {
  const f = fixture();
  f.listeners.popstate({ state: { screen: "game", mode: "normal", secretId: 6 } });
  assert.equal(f.context.restoredMode, "normal");
  assert.equal(f.context.starts, 0);
});

test("home updates the route and an unsuccessful game launch adds no history entry", () => {
  const f = fixture();
  f.context.startDailyGame();
  f.context.goToConfig();
  assert.equal(f.context.history.state.screen, "config");
  assert.equal(f.context.location.hash, "");
  f.context.failStart = true;
  const count = f.pushes.length;
  f.context.startNormalGame();
  assert.equal(f.pushes.length, count);
});

test("a direct Pokédex link survives initialization and restores after app setup", () => {
  const f = fixture("https://example.test/#pokedex");
  assert.equal(f.context.location.hash, "#pokedex");
  f.deferred.forEach((fn) => fn());
  assert.equal(f.context.current, "pokedex");
  assert.equal(f.pushes.length, 0);
});

test("an invitation is consumed, keeps its code on reload, and leaves other query parameters intact", () => {
  const f = fixture("https://example.test/?party=ab123&source=test#game");
  assert.equal(f.deferred.length, 0);
  f.context.initPartyFromUrl();
  assert.equal(f.input.value, "AB123");
  assert.equal(f.context.location.search, "?source=test");
  assert.equal(f.context.location.hash, "#party");
  assert.match(f.context.message, /prérempli/);
  const state = f.context.history.state;
  f.input.value = "";
  f.listeners.popstate({ state });
  assert.equal(f.input.value, "AB123");
  f.context.goToConfig();
  f.context.initPartyFromUrl();
  assert.equal(f.context.current, "config");
});
