"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../src/script.07.delegation-party.js"), "utf8").replace(/\r\n/g, "\n");
const start = source.indexOf('(function () {\n  var SYNC_KEYS = ["profile", "stats", "achievements", "teamBuilder"];');
const end = source.indexOf("\n// Public leaderboards are event-driven.", start);
assert.ok(start >= 0 && end > start, "Exercise the actual profile bootstrap");
const syncSource = source.slice(start, end);
const keys = { profile: "profile", stats: "stats", achievements: "achievements", teamBuilder: "teamBuilder", history: "history" };
const json = JSON.stringify;
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };

function device(initial, remote = null) {
  const state = new Map(Object.entries(initial));
  let now = Date.parse("2026-10-13T08:00:00Z");
  async function load({ userId = null } = {}) {
    const posts = [];
    let reloads = 0;
    class Clock extends Date { static now() { return now += 1000; } }
    const response = data => ({ ok: true, status: 200, json: async () => structuredClone(data) });
    const env = {
      STORAGE_KEYS: keys, Date: Clock, Math, JSON,
      localStorage: { getItem: key => state.get(key) ?? null, setItem: (key, value) => state.set(key, String(value)), removeItem: key => state.delete(key) },
      document: { readyState: "complete", addEventListener() {} },
      window: { addEventListener() {} },
      navigator: {},
      location: { reload() { reloads++; } },
      setInterval() {},
      fetch: async (url, options = {}) => {
        if (url === "/api/me") return response(userId ? { user: { id: userId } } : { user: null });
        if (options.method === "POST") { const data = JSON.parse(options.body); posts.push(data); if (remote) remote.data = data; return response({ ok: true }); }
        return response({ ok: true, data: remote.data });
      }
    };
    vm.createContext(env); vm.runInContext(syncSource, env); await flush();
    return { api: env.window.pokedleRestorePoints, posts, get reloads() { return reloads; } };
  }
  return { state, load, advanceDays(days) { now += days * 86400000; } };
}

test("a guest gets one dated copy a day, one before a reset, and can go back", async () => {
  const phone = device({ profile: json({ xp: 120, discoveries: { 1: { at: 1 }, 4: { at: 2 } } }), stats: json({ wins: 3 }), history: json([{ mode: "daily" }]) });
  let page = await phone.load();
  assert.equal(page.api.list().length, 1, "first visit of the day keeps a copy");
  page = await phone.load();
  assert.equal(page.api.list().length, 1, "same day, same progress: no duplicate");

  phone.state.set("profile", json({ xp: 500, discoveries: { 1: { at: 1 }, 4: { at: 2 }, 7: { at: 3 } } }));
  assert.equal(page.api.capture("reset"), true, "reset keeps the progress it is about to erase");
  ["profile", "stats", "history"].forEach(key => phone.state.delete(key));

  const [beforeReset, firstDay] = page.api.list();
  assert.equal(beforeReset.reason, "reset");
  assert.equal(firstDay.reason, "daily");
  assert.equal(page.api.restore(beforeReset.id), true);
  assert.equal(page.reloads, 1, "restoring reloads the page from the restored storage");
  assert.equal(JSON.parse(phone.state.get("profile")).xp, 500);
  assert.equal(phone.state.get("history"), json([{ mode: "daily" }]));
  assert.equal(phone.state.has("pokedle_sync_at"), false, "a guest restore keeps first-login claiming possible");

  page = await phone.load();
  phone.state.set("profile", json({ xp: 900 }));
  page.api.restore(page.api.list().find(p => p.reason === "daily").id);
  assert.equal(JSON.parse(phone.state.get("profile")).xp, 120);
  assert.ok(page.api.list().some(p => p.reason === "before-restore" && JSON.parse(p.data.profile).xp === 900), "a restore can be undone");
  assert.ok(page.api.list().length <= 5, "only the latest copies are kept");
});

test("an account keeps the local copy the online one replaced, and a restore wins the next sync", async () => {
  const remote = { data: { _accountId: "A", _savedAt: 5000, profile: json({ xp: 10 }) } };
  const laptop = device({ pokedle_sync_owner_v2: "A", pokedle_sync_at: "100", profile: json({ xp: 800 }) }, remote);
  let page = await laptop.load({ userId: "A" });
  assert.equal(page.reloads, 1, "the newer online copy replaces local progress");
  assert.equal(JSON.parse(laptop.state.get("profile")).xp, 10);

  page = await laptop.load({ userId: "A" });
  const replaced = page.api.list().find(p => JSON.parse(p.data.profile).xp === 800);
  assert.ok(replaced, "the replaced local progress is offered");
  page.api.restore(replaced.id);
  assert.equal(JSON.parse(laptop.state.get("profile")).xp, 800);
  assert.ok(Number(laptop.state.get("pokedle_sync_at")) > remote.data._savedAt, "the restore is newer than the online copy");

  page = await laptop.load({ userId: "A" });
  assert.equal(page.reloads, 0, "the next load keeps the restored progress");
  assert.equal(JSON.parse(page.posts.at(-1).profile).xp, 800, "and uploads it");
});

test("copies of another account on the same device are never offered", async () => {
  const shared = device({ pokedle_sync_owner_v2: "A", pokedle_sync_at: "100", profile: json({ xp: 50 }) }, { data: { _accountId: "A", _savedAt: 100, profile: json({ xp: 50 }) } });
  let page = await shared.load({ userId: "A" });
  assert.equal(page.api.list().length, 1);
  shared.state.set("pokedle_sync_owner_v2", "B");
  page = await shared.load();
  assert.ok(page.api.list().every(p => p.owner === ""), "a guest only sees guest copies");
});
