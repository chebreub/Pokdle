"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../src/script.10h.live-rank.js"), "utf8");
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const data = score => ({ ok: true, unit: "essais", me: { rank: 1, score }, top: [], around: [] });

function fixture() {
  let hud = null;
  const pending = [], timers = [];
  const anchor = { insertAdjacentElement(_position, element) { hud = element; element.isConnected = true; } };
  const screen = { querySelector(selector) { return selector === ".game-topbar" ? anchor : selector.includes("live-rank-hud") ? hud : null; } };
  const env = {
    window: {}, gameMode: "daily", gameOver: false, attempts: 1, quizScore: 0,
    playerProfile: {}, matchHistory: [], account: "A", day: "2026-10-02",
    leaderboardAccountId: () => env.account, leaderboardTodayKey: () => env.day,
    leaderboardFetchJson() { return new Promise(resolve => pending.push(resolve)); },
    leaderboardV2ModeMeta(mode) { return { unit: mode === "daily" ? "essais" : "pts", direction: mode === "daily" ? "asc" : "desc" }; },
    leaderboardV2FormatScore: score => String(score), escapeHtml: value => String(value), CSS: { escape: value => value },
    isPartySessionActive: () => false,
    updateTopTag() { return "topbar"; }, renderGameOverBox() { return "result"; },
    document: {
      getElementById: id => id === "screen-game" ? screen : null,
      querySelector: selector => selector.includes("live-rank-hud") ? hud : null,
      createElement() {
        return { dataset: {}, innerHTML: "", isConnected: false, classList: { add() {}, remove() {} },
          setAttribute() {}, remove() { this.isConnected = false; if (hud === this) hud = null; } };
      }
    },
    setTimeout: fn => timers.push(fn), clearTimeout() {}, Date, Promise
  };
  vm.createContext(env); vm.runInContext(source, env);
  return { env, pending, get hud() { return hud; }, timers,
    tick() { while (timers.length) timers.shift()(); },
    resolve(index, score = 1) { pending[index](data(score)); } };
}

test("switching Daily to Solo removes the obsolete Daily HUD", async () => {
  const f = fixture(); f.env.renderLiveRankHud("screen-game", "daily");
  assert.equal(f.hud.dataset.mode, "daily");
  f.env.gameMode = "normal"; f.env.attempts = 5;
  assert.equal(f.env.updateTopTag(), "topbar"); f.tick();
  assert.equal(f.hud, null, "Solo must not display a Daily panel");
  f.resolve(0); await flush();
  assert.equal(f.hud, null, "A late Daily response cannot recreate the panel");
});

test("a response reads the current attempts rather than the value captured before fetch", async () => {
  const f = fixture(); f.env.renderLiveRankHud("screen-game", "daily");
  f.env.attempts = 5;
  f.resolve(0); await flush();
  assert.match(f.hud.innerHTML, /Essais en cours<\/span><strong>5<\/strong>/);
});

test("an older forced request cannot overwrite a newer leaderboard cache or render", async () => {
  const f = fixture();
  f.env.renderLiveRankHud("screen-game", "daily", { score: 1, label: "Current" });
  const forced = f.env.liveRankFetch("daily", true);
  f.env.renderLiveRankHud("screen-game", "daily", { score: 5, label: "Current" });
  f.resolve(1, 5); await forced; await flush();
  const latest = f.hud.innerHTML;
  f.resolve(0, 1); await flush();
  assert.equal(f.hud.innerHTML, latest, "Old render must not replace the newer result");
  assert.equal((await f.env.liveRankFetch("daily")).me.score, 5, "Old fetch must not poison the cache");
});

test("Daily completion refreshes the final counter even without another guess row", async () => {
  const f = fixture(); f.env.renderLiveRankHud("screen-game", "daily");
  f.resolve(0); await flush();
  f.env.attempts = 5; f.env.gameOver = true;
  assert.equal(f.env.renderGameOverBox({ won: true }), "result"); f.tick(); await flush();
  assert.match(f.hud.innerHTML, /Essais finaux<\/span><strong>5<\/strong>/);
});

test("same shared screen changes cleanly from Daily to Quiz", async () => {
  const f = fixture(); f.env.renderLiveRankHud("screen-game", "daily");
  f.env.gameMode = "quiz"; f.env.quizScore = 6; f.env.updateTopTag(); f.tick();
  assert.equal(f.hud.dataset.mode, "quiz");
  f.resolve(1, 6); await flush(); const latest = f.hud.innerHTML;
  f.resolve(0); await flush(); assert.equal(f.hud.innerHTML, latest);
  assert.match(latest, /Score en cours<\/span><strong>6<\/strong>/);
});

test("Party quiz is not presented as the public Solo quiz leaderboard", () => {
  const f = fixture(); f.env.renderLiveRankHud("screen-game", "daily");
  f.env.gameMode = "quiz"; f.env.isPartySessionActive = () => true; f.env.updateTopTag(); f.tick();
  assert.equal(f.hud, null);
});

test("late responses from another account or UTC day do not repaint", async () => {
  for (const field of ["account", "day"]) {
    const f = fixture(); f.env.renderLiveRankHud("screen-game", "daily");
    const before = f.hud.innerHTML;
    f.env[field] = field === "account" ? "B" : "2026-10-03";
    f.resolve(0); await flush(); assert.equal(f.hud.innerHTML, before);
  }
});
