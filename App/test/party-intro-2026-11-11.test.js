"use strict";
// Intro de la Party Room (11/11/2026, maquette validée : « go ») : au lancement, tout le monde voit les joueurs,
// la roue du « Jeu surprise » qui tombe sur le jeu tiré par le serveur, puis la carte du jeu. La partie démarre
// après l'intro, donc aucun chrono de manche ne tourne pendant l'animation.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "../src/script.10xzzx.party-intro.js"), "utf8");

function slice(startText, endText) {
  const start = server.indexOf(startText);
  assert.ok(start >= 0, startText + " missing");
  const end = server.indexOf(endText, start + 1);
  assert.ok(end > start, endText + " boundary missing");
  return server.slice(start, end);
}

function world(players = 2, mode = "guess") {
  const room = {
    code: "ABCDE", status: "waiting", hostId: "host", gameMode: mode, configuredRounds: 5, bacRounds: 3, selectedGens: [1],
    players: Array.from({ length: players }, (_, i) => ({ id: i ? "p" + i : "host", nickname: "J" + i, connected: true, score: 0 })),
  };
  const timers = [];
  const emitted = [];
  const started = [];
  const handlers = {};
  const socket = { id: "host", request: {}, on(name, fn) { handlers[name] = fn; } };
  const env = {
    socket, room, crypto: require("node:crypto"), console,
    partyRooms: new Map([["ABCDE", room]]),
    PARTY_MIN_PLAYERS: 2,
    POKEMON_LIST: [],
    findPartyRoomBySocket() { return room; },
    respond(ack, value) { ack(value); },
    emitPartyRoomState() { emitted.push(room.status); },
    publicPartyRoomState(value) { return { status: value.status, gameMode: value.gameMode, intro: value.intro ? { mode: value.intro.mode } : null }; },
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    async startPartyGame(value) { started.push(value.gameMode); value.status = "playing"; value.target = { id: 25 }; value.typeCombo = { key: "x" }; },
    recordUsage() {},
    usageSegmentForSocket() { return null; },
    partyTotalRoundsForMode() { return 5; },
    dexRace: { balanceRaceTeams() {}, raceStartError() { return null; } },
    petitBacParty: { publicOptions() { return { letters: ["A"] }; } },
    io: { to() { return { emit() {} }; } },
  };
  const code = slice("const PARTY_SURPRISE_MODES", "function endPartyRound(") + "\n" +
    slice('  socket.on("party:start"', '  socket.on("party:submit-answer"') + "\n" +
    slice('  socket.on("party:set-mode"', '  socket.on("party:set-rounds"') +
    "\nthis.launchPartyAfterIntro = launchPartyAfterIntro; this.partySurprisePool = partySurprisePool; this.PARTY_INTRO_MS = PARTY_INTRO_MS; this.PARTY_INTRO_WHEEL_MS = PARTY_INTRO_WHEEL_MS;";
  new Function("env", "with(env){" + code + "}").call(env, env);
  const call = (event, payload = {}) => new Promise((resolve) => handlers[event](payload, resolve));
  return { room, env, timers, emitted, started, call };
}

test("a normal start plays a short intro first, then the game starts once for everyone", async () => {
  const w = world(3, "petitbac");
  const res = await w.call("party:start");
  assert.equal(res.ok, true);
  assert.equal(w.room.status, "waiting", "no round runs during the intro");
  assert.equal(w.room.intro.mode, "petitbac");
  assert.equal(w.room.intro.surprise, false);
  assert.equal(w.timers.length, 1);
  assert.equal(w.timers[0].ms, w.env.PARTY_INTRO_MS);
  assert.equal((await w.call("party:start")).ok, false, "a second press during the intro does nothing");
  assert.equal((await w.call("party:set-mode", { mode: "guess" })).ok, false, "the game cannot change during the intro");
  await w.timers[0].fn();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(w.started, ["petitbac"]);
  assert.equal(w.room.intro, null);
  assert.equal(w.room.status, "playing");
});

test("« Jeu surprise » : the server draws the game from the wheel's list and the wheel lasts longer", async () => {
  for (let i = 0; i < 25; i++) {
    const w = world(3);
    assert.equal((await w.call("party:set-mode", { mode: "surprise" })).ok, true);
    assert.equal(w.room.surprise, true);
    await w.call("party:start");
    const intro = w.room.intro;
    assert.equal(intro.surprise, true);
    assert.equal(w.timers[0].ms, w.env.PARTY_INTRO_WHEEL_MS);
    assert.ok(intro.pool.includes(intro.mode), "the drawn game is on the wheel");
    assert.equal(w.room.gameMode, intro.mode);
    assert.ok(!intro.pool.includes("dexrace"), "the Pokédex race needs its own setup");
    assert.ok(!intro.pool.includes("quiestce1v1"), "Qui est-ce ? only with exactly two players");
  }
  const duo = world(2);
  await duo.call("party:set-mode", { mode: "surprise" });
  await duo.call("party:start");
  assert.ok(duo.room.intro.pool.includes("quiestce1v1"));
});

test("picking a real game turns the surprise off", async () => {
  const w = world(3);
  await w.call("party:set-mode", { mode: "surprise" });
  await w.call("party:set-mode", { mode: "dessin" });
  assert.equal(w.room.surprise, false);
  assert.equal(w.room.gameMode, "dessin");
});

test("a player who drops during the intro cancels the start instead of starting without them", async () => {
  const w = world(3);
  await w.call("party:start");
  w.room.players[2].connected = false;
  await w.timers[0].fn();
  assert.deepEqual(w.started, []);
  assert.equal(w.room.status, "waiting");
  assert.equal(w.room.intro, null);
});

test("a stale intro timer never starts a second game", async () => {
  const w = world(2);
  await w.call("party:start");
  const first = w.timers[0];
  w.room.intro = null; // e.g. the room was closed and reopened
  await first.fn();
  assert.deepEqual(w.started, []);
});

test("each player's partner is sent to the room and checked by the server", () => {
  const sanitize = new Function(slice("function sanitizePartyPartner(", "function joinPlayerToPartyRoom(") + "; return sanitizePartyPartner;")();
  assert.equal(sanitize(25), 25);
  assert.equal(sanitize("6"), 6);
  for (const bad of [0, 1026, 2.5, "x", null, -3]) assert.equal(sanitize(bad), null);
  assert.match(server, /partner: player\.partner \|\| null/);
  assert.match(read04(), /partner: partyPlayerPartner\(\)/);
});

test("the intro respects « réduire les animations » and the wheel shows each game's name", () => {
  assert.match(client, /prefers-reduced-motion|reducedMotion/);
  assert.match(client, /Jeu surprise/);
  for (const name of ["Dessine-le !", "Petit Bac", "Stat Clash", "Meilleure stat"]) assert.ok(client.includes(name), name);
  assert.doesNotMatch(client, /[\u{1F300}-\u{1FAFF}]/u, "no emoji in the intro");
});

function read04() { return fs.readFileSync(path.join(__dirname, "../src/script.04.jeu-pokedex.js"), "utf8"); }
