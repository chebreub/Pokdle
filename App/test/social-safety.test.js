"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const chatLib = require("../lib/friend-chat");
const friendLib = require("../lib/player-friends");
const challengeLib = require("../lib/player-challenges");
const safety = require("../lib/social-safety");

test("contact filter: separated domains, punctuated numbers and invisible characters", () => {
  for (const body of ["x . fr", "x.fr", "example . fr", "example .com", "example. fr", "example [ . ] fr", "example point fr", "example.zip",
    "06+12+34+56+78", "06|12|34|56|78", "06☎12☎34☎56☎78", "06,12,34,56,78", "06 ; 12 ; 34 ; 56 ; 78", "０６１２３４５６７８", "٠٦،١٢،٣٤،٥٦،٧٨",
    "sn\u200bap", "s\u2060nap", "sn\u00adap", "s\uFE0Fnap", "s n a p", "s.n.a.p", "d i s c o r d", "ＩＮＳＴＡ", "sna\u0301p"]) {
    assert.equal(chatLib.checkBody(body).error, "contact", JSON.stringify(body));
  }
  for (const body of ["J’ai fait 15/15 au quiz !", "Pikachu, niveau 50", "On joue à 18 h ?", "ok. me voilà", "Bien joué 👨‍👩‍👧", "Gen 1, 2 et 3"]) {
    assert.deepEqual(chatLib.checkBody(body), { body });
  }
});

test("PostgreSQL: shared blocks, archived reports, cancellation and suspension including challenge notes", { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async (t) => {
  const { Pool } = require("pg");
  const { randomUUID } = require("node:crypto");
  const ids = require("../lib/player-ids");
  ids.setPlayerIdSecret("social-test-only");
  const root = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  const schema = "safe_" + randomUUID().replaceAll("-", "");
  await root.query("CREATE SCHEMA " + schema);
  const db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: "-c search_path=" + schema });
  t.after(async () => { await db.end(); await root.query("DROP SCHEMA " + schema + " CASCADE"); await root.end(); });
  await db.query(`CREATE TABLE users(discord_id TEXT PRIMARY KEY, username TEXT, partner_id INTEGER, xp INTEGER);
    INSERT INTO users VALUES ('A', 'Alice', NULL, 0), ('B', 'Bob', NULL, 0), ('C', 'Charly', NULL, 0);
    CREATE TABLE scores(discord_id TEXT, mode TEXT, score INTEGER);
    INSERT INTO scores VALUES ('A', 'quiz', 15), ('B', 'quiz', 15)`);
  await challengeLib.ensureTables(db);
  await friendLib.ensureTables(db);
  await chatLib.ensureTables(db);
  await safety.ensureTables(db); // migrations are idempotent
  const config = { db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid };
  const friends = friendLib.createPlayerFriends(config);
  const chat = chatLib.createFriendChat({ ...config, friends });
  const challenges = challengeLib.createPlayerChallenges({ ...config, friends, checkNote: chatLib.checkBody });
  const A = ids.playerPid("A"), B = ids.playerPid("B"), C = ids.playerPid("C");
  const befriend = async () => { await friends.request("A", { pid: B }); await friends.request("B", { pid: A }); };
  const challenge = (note) => challenges.create("A", { pid: B, mode: "quiz", phrase: 0, note });
  await befriend();
  assert.equal((await chat.send("A", { pid: B, body: "Bonjour" })).ok, true);
  for (const note of ["example . fr", "06,12,34,56,78", "sn\u200bap"]) {
    assert.equal((await chat.send("A", { pid: B, body: note })).error, "contact");
    assert.equal((await challenge(note)).error, "note_contact");
  }
  await friends.remove("A", { pid: B });
  assert.equal((await chat.send("A", { pid: B, body: "Encore" })).error, "not_friends");
  const archived = await chat.thread("B", { pid: A });
  assert.equal(archived.friends, false);
  assert.equal(archived.canSend, false);
  assert.equal(archived.messages[0].body, "Bonjour");
  assert.equal((await chat.conversations("B")).conversations[A].friends, false);
  assert.equal((await chat.report("B", { pid: A })).ok, true);
  assert.equal((await chatLib.adminReports(db))[0].excerpt[0].body, "Bonjour");
  assert.deepEqual((await chat.thread("C", { pid: A })).messages, []);
  assert.equal((await chat.report("C", { pid: A })).error, "no_messages");

  // Declined outgoing requests must really disappear when cancelled, including after a reload.
  await friends.request("A", { pid: C });
  const incoming = (await friends.list("C")).incoming[0];
  await friends.respond("C", { id: incoming.id, accept: false });
  await friends.remove("A", { pid: C });
  assert.equal((await friends.status("A", C)).relation, "none");
  assert.equal((await friends.list("A")).outgoing.length, 0);

  await befriend();
  await friends.block("B", { pid: A });
  assert.equal((await challenge()).error, "refused");
  await challenges.setAccepting("B", false);
  await challenges.setAccepting("B", true);
  assert.equal((await challenge()).error, "refused");
  assert.equal((await friends.request("A", { pid: B })).error, "refused");
  assert.equal((await chat.report("B", { pid: A })).ok, true, "report remains possible after blocking");
  await friends.unblock("B", { pid: A });
  await befriend();
  const duel = await challenge();
  assert.equal(duel.ok, true);
  await challenges.block("B", duel.id);
  assert.equal(await friends.areFriends("A", "B"), false, "blocking from a challenge also closes chat");
  assert.equal((await chat.send("A", { pid: B, body: "Encore" })).error, "not_friends");
  assert.equal((await friends.list("B")).blocked[0].pid, A);
  await friends.unblock("B", { pid: A });
  await befriend();

  // Old challenge-specific blocks also work and can be lifted in Mes amis.
  await db.query("INSERT INTO player_challenge_blocks(account_id, blocked_id) VALUES ('B', 'A')");
  assert.equal((await challenge()).error, "refused");
  await challenges.setAccepting("B", true);
  assert.equal(await safety.blockedEither(db, "A", "B"), true);
  await friends.unblock("B", { pid: A });
  assert.equal(await safety.blockedEither(db, "A", "B"), false);

  assert.equal(await safety.setSuspension(db, { accountId: "A", days: 7, reason: "Test", adminId: "admin" }), true);
  for (const [me, pid] of [["A", B], ["B", A]]) {
    assert.equal((await chat.send(me, { pid, body: "Bonjour" })).error, "discussion_unavailable");
    assert.equal((await chat.thread(me, { pid })).canSend, false);
  }
  assert.equal((await challenge("Revanche ?")).error, "discussion_unavailable");
  const fixed = await challenge();
  assert.equal(fixed.ok, true, "playing with fixed phrases remains allowed");
  await challenges.decline("B", fixed.id);
  assert.equal((await chat.report("A", { pid: B })).ok, true, "suspension does not prevent reporting");
  await db.query("UPDATE chat_suspensions SET until_at = now() - interval '1 minute'");
  assert.equal((await chat.send("A", { pid: B, body: "Bonjour" })).ok, true, "automatic expiry");
  await safety.setSuspension(db, { accountId: "A", days: -1, adminId: "admin" });
  assert.equal(await safety.discussionAllowed(db, "A", "B"), false);
  await safety.setSuspension(db, { accountId: "A", days: 0, adminId: "admin" });
  assert.equal((await challenge("Revanche ?")).ok, true);
  assert.equal(await safety.setSuspension(db, { accountId: "A", days: 99, adminId: "admin" }), false);
  assert.equal(await safety.setSuspension(db, { accountId: "missing", days: 1, adminId: "admin" }), false);
});

test("admin suspension route rejects unsigned, non-admin and cross-origin writes", async (t) => {
  const express = require("express");
  const app = express();
  let writes = 0;
  const db = { query: async () => { writes++; return { rowCount: 1, rows: [] }; } };
  require("../lib/admin-panel").mountAdminRoutes(app, { express, db, ready: Promise.resolve(true),
    getSessionUser: (req) => req.get("x-test-user") ? { id: req.get("x-test-user") } : null,
    adminIds: new Set(["admin"]), reports: { module: chatLib } });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (user, origin) => fetch(base + "/admin/chat/suspension", { method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(user ? { "x-test-user": user } : {}), ...(origin ? { origin } : {}) },
    body: new URLSearchParams({ accountId: "A", days: "7" }) });
  assert.equal((await post(null, base)).status, 401);
  assert.equal((await post("player", base)).status, 403);
  assert.equal((await post("admin", "https://evil.example")).status, 403);
  assert.equal((await post("admin", null)).status, 403);
  assert.equal(writes, 0);
  assert.equal((await post("admin", base)).status, 303);
  assert.equal(writes, 2);
});


test("challenge blocking confirms success only after the server accepts it, then refreshes friends and chat", async () => {
  const vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "../src/script.10xq.player-challenges.js"), "utf8");
  const fn = source.match(/function blockChallenger\(id\) \{[\s\S]*?\n\}/)[0];
  for (const ok of [false, true]) {
    const calls = [], toasts = [];
    const ctx = { pcPost: async () => ({ ok }), pcRefresh: async () => calls.push("challenges"),
      frRefresh: async () => calls.push("friends"), chatRefresh: async () => calls.push("chat"),
      showToast: (s) => toasts.push(s), document: { querySelector: () => null }, closeOverlayModal() {} };
    vm.createContext(ctx); vm.runInContext(fn, ctx);
    await ctx.blockChallenger(1);
    assert.deepEqual(calls, ok ? ["challenges", "friends", "chat"] : []);
    assert.match(toasts[0], ok ? /Joueur bloqué/ : /Blocage impossible/);
  }
});
