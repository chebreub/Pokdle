"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../src/script.07.delegation-party.js"), "utf8");
const start = source.indexOf('(function () {\n  var SYNC_KEYS = ["profile", "stats", "achievements", "teamBuilder"];');
const end = source.indexOf("\n// Public leaderboards are event-driven.", start);
assert.ok(start >= 0 && end > start, "Exercise the actual profile bootstrap");
const syncSource = source.slice(start, end);
const keys = { profile: "profile", stats: "stats", achievements: "achievements", teamBuilder: "teamBuilder" };
const json = JSON.stringify;
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };

function fixture() {
  const state = new Map(Object.entries({
    pokedle_sync_owner_v2: "A", pokedle_sync_at: "100",
    profile: json({ nickname: "Local", xp: 10 }), unrelated: "keep"
  }));
  const remote = { data: { _accountId: "A", _savedAt: 200, profile: json({ nickname: "Cloud" }) } };
  let now = 1000;
  async function load({ userId = "A", readFailure = false, holdRead = false, writeFailure = false } = {}) {
    const events = {}, intervals = [], posts = [], beacons = [];
    let reloads = 0, resolveRead;
    const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => structuredClone(data) });
    class Clock extends Date { static now() { return ++now; } }
    // As loadProfile does, normalize old profiles before async account sync.
    if (state.has("profile")) {
      const profile = JSON.parse(state.get("profile"));
      profile.xp = Number(profile.xp) || 0;
      state.set("profile", json(profile));
    }
    const env = {
      STORAGE_KEYS: keys, Date: Clock,
      localStorage: { getItem: key => state.get(key) ?? null,
        setItem: (key, value) => state.set(key, String(value)), removeItem: key => state.delete(key) },
      document: { readyState: "complete", addEventListener() {} },
      window: { __pokedleAuthed: true, addEventListener: (name, fn) => { events[name] = fn; } },
      navigator: { sendBeacon(url, blob) {
        const data = JSON.parse(blob.parts[0]); beacons.push({ url, data });
        if (data._accountId === userId) remote.data = structuredClone(data);
        return true;
      } },
      Blob: class { constructor(parts) { this.parts = parts; } },
      location: { reload() {
        reloads++;
        // Requesting a reload causes a later pagehide in the departing page.
        queueMicrotask(() => events.pagehide?.({ persisted: false }));
      } },
      setInterval: fn => intervals.push(fn),
      fetch: async (url, options = {}) => {
        if (url === "/api/me") return response({ auth: true, user: { id: userId } });
        assert.equal(url, "/api/profile");
        if (options.method === "POST") {
          const data = JSON.parse(options.body); posts.push(data);
          assert.equal(data._accountId, userId, "Never change the authenticated owner");
          if (writeFailure) return response({ ok: false }, 503);
          remote.data = structuredClone(data); return response({ ok: true });
        }
        if (holdRead) return new Promise(resolve => { resolveRead = resolve; });
        if (readFailure) return response({ ok: false, data: null }, 503);
        return response({ ok: true, data: remote.data });
      }
    };
    vm.createContext(env); vm.runInContext(syncSource, env); await flush();
    return { env, posts, beacons, events, intervals, get reloads() { return reloads; },
      releaseRead() { resolveRead(response({ ok: true, data: remote.data })); } };
  }
  return { state, remote, load };
}

test("profile restore cannot beacon the downloaded data back with a newer timestamp", async () => {
  const f = fixture(), page = await f.load();
  assert.equal(page.reloads, 1);
  assert.equal(page.beacons.length, 0, "Restore navigation is not a new save");
  assert.equal(page.posts.length, 0);
  assert.equal(f.remote.data._savedAt, 200);
  assert.equal(f.state.get("pokedle_sync_at"), "200");
  assert.equal(f.state.get("unrelated"), "keep");
  assert.equal(JSON.parse(f.state.get("pokedle_sync_conflict_v2:A")).profile, json({ nickname: "Local", xp: 10 }));
});
test("legacy normalization converges after one restore instead of repeatedly reloading", async () => {
  const f = fixture(), pages = [];
  for (let i = 0; i < 3; i++) pages.push(await f.load());
  const reloads = pages.map(page => page.reloads);
  console.log("PROFILE_RELOAD_CYCLES " + json(reloads));
  assert.deepEqual(reloads, [1, 0, 0]);
  assert.equal(f.state.get("pokedle_sync_owner_v2"), "A");
  assert.equal(f.remote.data._accountId, "A");
  assert.equal(JSON.parse(f.remote.data.profile).nickname, "Cloud");
  assert.equal(JSON.parse(f.remote.data.profile).xp, 0);
});
test("failed profile GET cannot authorize timed pushes or pagehide writes", async () => {
  const f = fixture(), page = await f.load({ readFailure: true });
  page.intervals.forEach(fn => fn()); page.events.pagehide({ persisted: false }); await flush();
  assert.equal(page.posts.length, 0); assert.equal(page.beacons.length, 0); assert.equal(page.reloads, 0);
  assert.equal(f.remote.data._savedAt, 200);
  assert.equal(f.state.get("profile"), json({ nickname: "Local", xp: 10 }));
});
test("pagehide and timers are inert while profile reconciliation is pending", async () => {
  const f = fixture(), page = await f.load({ holdRead: true });
  page.intervals.forEach(fn => fn()); page.events.pagehide({ persisted: false }); await flush();
  assert.equal(page.posts.length, 0); assert.equal(page.beacons.length, 0);
  page.releaseRead(); await flush();
  assert.equal(page.reloads, 1); assert.equal(page.beacons.length, 0);
});
test("ordinary pagehide still saves real progress after successful reconciliation", async () => {
  const f = fixture(); f.remote.data = { _accountId: "A", _savedAt: 100, profile: f.state.get("profile") };
  const page = await f.load();
  assert.equal(page.reloads, 0); assert.equal(page.posts.length, 0, "Content identical to the server is not re-sent");
  page.events.pagehide({ persisted: false }); await flush();
  assert.equal(page.beacons.length, 0, "Leaving without progress does not stamp old data as new");
  f.state.set("profile", json({ nickname: "Local", xp: 90 }));
  page.events.pagehide({ persisted: false }); await flush();
  assert.equal(page.beacons.length, 1); assert.equal(page.beacons[0].data._accountId, "A");
  assert.equal(JSON.parse(f.remote.data.profile).xp, 90);
  assert.equal(JSON.parse(f.state.get("pokedle_sync_cache_v2:A")).profile, f.state.get("profile"));
});
test("switch to B preserves A backup and never beacons during restore navigation", async () => {
  const f = fixture();
  f.remote.data = { _accountId: "B", _savedAt: 300, profile: json({ nickname: "Account B", xp: 7 }) };
  const page = await f.load({ userId: "B" });
  assert.equal(page.reloads, 1); assert.equal(page.beacons.length, 0); assert.equal(page.posts.length, 0);
  assert.equal(f.state.get("pokedle_sync_owner_v2"), "B");
  assert.equal(JSON.parse(f.state.get("pokedle_sync_cache_v2:A")).profile, json({ nickname: "Local", xp: 10 }));
  assert.equal(JSON.parse(f.state.get("profile")).nickname, "Account B");
});
test("an idle tab never re-sends unchanged progress over a newer save from another device", async () => {
  const f = fixture(); f.remote.data = { _accountId: "A", _savedAt: 100, profile: f.state.get("profile") };
  const page = await f.load();
  f.state.set("profile", json({ nickname: "Local", xp: 120 }));
  for (const tick of page.intervals) tick(); await flush();
  assert.equal(page.posts.length, 1); assert.equal(JSON.parse(f.remote.data.profile).xp, 120);
  // Another device saves more progress; this tab has nothing new and must stay silent.
  f.remote.data = { _accountId: "A", _savedAt: Date.now() + 1000, profile: json({ nickname: "Phone", xp: 300 }) };
  for (let i = 0; i < 3; i++) { for (const tick of page.intervals) tick(); await flush(); }
  page.events.pagehide({ persisted: false }); await flush();
  assert.equal(page.posts.length, 1); assert.equal(page.beacons.length, 0);
  assert.equal(JSON.parse(f.remote.data.profile).xp, 300);
});
