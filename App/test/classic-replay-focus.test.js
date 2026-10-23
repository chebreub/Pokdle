"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const controller = fs.readFileSync(path.join(__dirname, "../src/script.02.statclash.js"), "utf8");
const markup = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../game-feel.css"), "utf8");
const start = controller.indexOf("function focusClassicClueAfterReplay(panelId) {");
const end = controller.indexOf("function restartCurrentMode() {", start);
assert.ok(start >= 0 && end > start, "Replay focus helper is present");

function runFocus({ mobile, reduced, hidden = false, gameOver = false }) {
  const calls = [];
  const panel = {
    classList: { contains(name) { return name === "hidden" && hidden; } },
    focus(options) { calls.push(["focus", options.preventScroll]); },
    scrollIntoView(options) { calls.push(["scroll", options.behavior, options.block]); }
  };
  const context = vm.createContext({
    gameOver,
    document: { getElementById(id) { calls.push(["target", id]); return panel; } },
    window: { matchMedia(query) { return { matches: query.includes("max-width") ? mobile : reduced }; } }
  });
  vm.runInContext(controller.slice(start, end) + "\nfocusClassicClueAfterReplay('order-box');", context);
  return calls;
}
test("mobile replay brings the clue into view without opening the soft keyboard", () => {
  const events = runFocus({ mobile: true, reduced: true });
  assert.deepEqual(events.map(x => x[0]), ["target", "focus", "scroll"]);
  assert.equal(events[1][1], true);
  assert.equal(events[2][1], "auto");
  assert.equal(events[2][2], "start");
});
test("desktop replay preserves input focus and respects user motion preference", () => {
  const events = runFocus({ mobile: false, reduced: false });
  assert.deepEqual(events.map(x => x[0]), ["target", "scroll"]);
  assert.equal(events[1][1], "smooth");
});
test("completed or hidden games cannot hijack focus or scroll", () => {
  assert.deepEqual(runFocus({ mobile: true, reduced: true, hidden: true }).map(x => x[0]), ["target"]);
  assert.deepEqual(runFocus({ mobile: true, reduced: true, gameOver: true }).map(x => x[0]), ["target"]);
});
test("both classic modes use the helper but a finished Party retains its controller", () => {
  const replay = controller.slice(end, controller.indexOf("function startChallengeGame(", end));
  assert.match(replay, /if \(partySession\?\.currentModeKey === "evolution"\) return;/);
  assert.match(replay, /if \(partySession\?\.currentModeKey === "order"\) return;/);
  assert.match(replay, /startEvolutionChainGame\(\);\s*focusClassicClueAfterReplay\("evolution-box"\)/);
  assert.match(replay, /startPokedexOrderGame\(\);\s*focusClassicClueAfterReplay\("order-box"\)/);
  for (const mode of ["evolution", "order"]) {
    assert.match(markup, new RegExp('id="' + mode + '-box"[^>]*tabindex="-1"'));
  }
  assert.match(css, /scroll-margin-block:20px calc\(105px \+ env\(safe-area-inset-bottom\)\)/);
});
