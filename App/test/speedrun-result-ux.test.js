"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const src = read("src/script.03.minijeux.js");
const constants = src.slice(src.indexOf("const SPEEDRUN_DURATION_MS ="), src.indexOf("const TYPE_COMBO_DURATION_MS ="));
const controller = src.slice(src.indexOf("function speedrunIsPartyRound() {"), src.indexOf("// === POKÉ-CONNECTIONS"));
assert.ok(constants.startsWith("const SPEEDRUN_DURATION_MS ="));
assert.ok(controller.startsWith("function speedrunIsPartyRound() {"));

function fixture({ mobile = true, highScore = 0 } = {}) {
  const events = [], root = { innerHTML: "" }, input = { value: "", focus() {}, classList: { add() {}, remove() {} } };
  let headerHidden = false, activeIntervals = 0, timerSequence = 0;
  const header = { classList: { toggle(name, state) { assert.equal(name, "hidden"); headerHidden = state; } } };
  const actions = { scrollIntoView: (options) => events.push(["scroll-actions", options.block, options.behavior]) };
  const result = {
    focus: (options) => events.push(["focus-result", options.preventScroll]),
    scrollIntoView: (options) => events.push(["scroll-result", options.block, options.behavior]),
    querySelector: () => root.innerHTML.includes('class="speedrun-result-actions"') ? actions : null,
  };
  const document = {
    getElementById(id) { return id === "speedrun-root" ? root : id === "speedrun-input" ? input : null; },
    querySelector(selector) {
      if (selector.includes(".ranking-head-actions")) return header;
      if (selector.includes(".speedrun-gameover")) return root.innerHTML.includes("speedrun-gameover") ? result : null;
      return null;
    },
  };
  const context = vm.createContext({
    window: { matchMedia(query) { return { matches: query.includes("max-width") ? mobile : true }; } },
    document,
    POKEMON_LIST: Array.from({ length: 40 }, (_, index) => ({
      id: index + 1, name: "Pokemon" + index, sprite: "sprite-" + index,
    })),
    playerProfile: { speedrunHighScore: highScore, xp: 0 },
    getPokemonSprite: (pokemon) => pokemon.sprite,
    escapeHtml: (value) => String(value),
    trackUsage: (...args) => events.push(["usage", ...args]),
    awardXp: (...args) => events.push(["xp", ...args]),
    recordMatchHistory: (...args) => events.push(["history", ...args]),
    notifyPartyRoundFromScreenMode: (...args) => events.push(["party", ...args]),
    saveProfile: () => events.push(["save"]),
    goToConfig() {}, hideExtraScreens() {}, hideScreen() {}, showScreen() {},
    setGlobalNavActive() {}, showToast() {},
    setInterval() { activeIntervals++; return ++timerSequence; },
    clearInterval() { activeIntervals = Math.max(0, activeIntervals - 1); },
    setTimeout(handler) { handler(); return 1; },
    getXpTier() { return { emoji: "⚡", level: 1, name: "Débutant" }; },
    copyShareText() {}, downloadScoreImage() {},
    partySession: null,
  });
  vm.runInContext(constants + "\n" + controller, context);
  return {
    context, events, root,
    get state() { return vm.runInContext("speedrunState", context); },
    get headerHidden() { return headerHidden; },
    get activeIntervals() { return activeIntervals; },
  };
}

test("final result displays nearby replay, catalog and share actions once", () => {
  const game = fixture({ mobile: true, highScore: 20 });
  const { context, events, root } = game;
  context.openSpeedrunMode();
  context.startSpeedrunGame();
  game.state.correct = 8;
  game.state.bestStreak = 5;
  game.state.skipped = 2;
  context.finalizeSpeedrunGame();
  assert.equal(game.state.phase, "gameover");
  assert.match(root.innerHTML, /role="region" aria-label="Résultat Speedrun Pokédex"/);
  for (const action of ["replaySpeedrunGame", "openAllModesScreen", "shareSpeedrunResult", "downloadSpeedrunImage"]) {
    assert.equal(root.innerHTML.split('data-action="' + action + '"').length - 1, 1, action);
  }
  assert.deepEqual(events.filter(([name]) => name === "focus-result"), [["focus-result", true]]);
  assert.deepEqual(events.filter(([name]) => name === "scroll-actions"), [["scroll-actions", "end", "auto"]]);
  assert.equal(game.headerHidden, false);
  assert.equal(events.filter(([name]) => name === "history").length, 1);
});

test("replay starts a new 60-second round in one click with unchanged rules", () => {
  const game = fixture({ highScore: 7, mobile: false });
  const { context, root } = game;
  context.openSpeedrunMode();
  context.startSpeedrunGame();
  game.state.correct = 9;
  context.finalizeSpeedrunGame();
  context.replaySpeedrunGame();
  assert.equal(game.state.phase, "playing");
  assert.equal(game.state.correct, 0);
  assert.equal(game.state.skipped, 0);
  assert.equal(game.state.bestStreak, 0);
  assert.equal(game.state.leftMs, 60000);
  assert.equal(game.state.pool.length, 40);
  assert.match(root.innerHTML, /id="speedrun-timer"/);
  assert.equal(game.activeIntervals, 1, "old timer is cleared before launching a new one");
});

test("late finalization cannot award XP or write history twice", () => {
  const game = fixture();
  const { context, events } = game;
  context.openSpeedrunMode();
  context.startSpeedrunGame();
  game.state.correct = 11;
  context.finalizeSpeedrunGame();
  context.finalizeSpeedrunGame();
  assert.equal(events.filter(([name]) => name === "history").length, 1);
  assert.deepEqual(events.filter(([name]) => name === "xp").map(([, amount]) => amount), [50, 33]);
  assert.equal(events.filter(([name]) => name === "save").length, 1);
});

test("Party round, including completed Party, never displays or executes solo controls", () => {
  const game = fixture();
  const { context, root } = game;
  context.partySession = { currentModeKey: "speedrun", completed: false, roundResolved: false };
  context.openSpeedrunMode();
  context.startSpeedrunGame();
  game.state.correct = 11;
  context.finalizeSpeedrunGame();
  assert.equal(game.state.phase, "gameover");
  assert.ok(game.headerHidden);
  assert.doesNotMatch(root.innerHTML, /data-action="(?:replaySpeedrunGame|openAllModesScreen|shareSpeedrunResult|downloadSpeedrunImage)"/);
  context.partySession.completed = true;
  context.partySession.roundResolved = true;
  const prior = game.state;
  context.replaySpeedrunGame();
  context.restartSpeedrunGame();
  context.startSpeedrunGame();
  assert.equal(game.state, prior, "Party cannot start or replay a solo round");
  assert.equal(game.state.phase, "gameover");
  context.partySession = null;
  context.renderSpeedrunScreen();
  assert.equal(game.headerHidden, false);
  assert.match(root.innerHTML, /data-action="replaySpeedrunGame"/);
});

test("dedicated shell keeps stats but does not duplicate Speedrun catalog or leak into Party", () => {
  const shell = read("src/script.10k.mode-shells.js");
  assert.match(shell, /const partySpeedrun = id === "screen-speedrun"/);
  assert.match(shell, /state\?\.mode === "versus" \|\| partySpeedrun/);
  assert.match(shell, /catalogAction = id === "screen-speedrun" \? ""/);
});
