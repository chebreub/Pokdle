"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

// Exercise the actual Express auth routes with synthetic Discord and DB data.
// Never read production credentials or call Discord/Postgres during tests.
async function fixture(t, db = null, people = {}, env = {}) {
  const appDir = path.resolve(__dirname, "..");
  const appRequire = createRequire(path.join(appDir, "server.js"));
  const source = fs.readFileSync(path.join(appDir, "server.js"), "utf8").split("// ===== Fin auth Phase 1 =====")[0];
  const calls = [];
  let twitchHeaders = null;
  const sandbox = {
    require(name) {
      if (name === "pg") return { Pool: class {
        on() {}
        async query(sql, params) { return db ? db(sql, params || []) : { rows: [] }; }
        async connect() { return { query: (sql, params) => this.query(sql, params), release() {} }; }
      } };
      return appRequire(name);
    },
    process: { env: {
      PORT: "0", DATABASE_URL: "synthetic-test-only", DISCORD_CLIENT_ID: "test-client",
      DISCORD_CLIENT_SECRET: "test-secret", DISCORD_CALLBACK_URL: "https://example.test/auth/discord/callback",
      GOOGLE_CLIENT_ID: "test-google-client", GOOGLE_CLIENT_SECRET: "test-google-secret",
      GOOGLE_CALLBACK_URL: "https://example.test/auth/google/callback",
      TWITCH_CLIENT_ID: "test-twitch-client", TWITCH_CLIENT_SECRET: "test-twitch-secret",
      TWITCH_CALLBACK_URL: "https://example.test/auth/twitch/callback",
      SESSION_SECRET: "synthetic-session-secret-for-tests-only", ...env
    } },
    console: { log() {}, warn() {}, error() {} },
    URL, URLSearchParams, AbortSignal, Buffer, __dirname: appDir,
    module: { exports: {} },
    async fetch(url, options) {
      calls.push(url);
      if (url.includes("api.twitch.tv/helix/users")) {
        twitchHeaders = options && options.headers;
        return { ok: true, json: async () => ({ data: [{ id: people.twitchId || "44322889", login: "ondine_tv", display_name: "Ondine_TV", profile_image_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/synthetic.png", email: "never-stored@example.test" }] }) };
      }
      if (url.includes("openidconnect.googleapis.com")) return { ok: true, json: async () => ({ sub: people.googleSub || "109876543210987654321", given_name: "Sacha", name: "Sacha Ketchum", picture: "https://lh3.googleusercontent.com/a/synthetic", email: "never-stored@example.test" }) };
      return { ok: true, json: async () => url.endsWith("/token")
        ? { access_token: "synthetic-token" }
        : { id: people.discordId || "1234567890", username: "Test", avatar: null } };
    },
  };
  vm.runInNewContext(source + "\nmodule.exports = { server };", sandbox);
  const { server } = sandbox.module.exports;
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { calls, twitchHeaders: () => twitchHeaders, get: (url, cookie) => fetch(base + url, {
    redirect: "manual", headers: cookie ? { Cookie: cookie } : {}
  }), post: (url, cookie, body) => fetch(base + url, {
    method: "POST", redirect: "manual", body: JSON.stringify(body || {}),
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }
  }) };
}

test("OAuth routes bind, consume and clear an attempt before creating a session", async (t) => {
  const f = await fixture(t);
  const start = await f.get("/auth/discord");
  assert.equal(start.status, 302);
  const state = new URL(start.headers.get("location")).searchParams.get("state");
  assert.match(state, /^[a-f0-9]{64}$/);
  const setCookie = start.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  const cookie = setCookie.split(";")[0];
  const callback = `/auth/discord/callback?code=synthetic-code&state=${state}`;
  const missingCookie = await f.get(callback);
  assert.equal(missingCookie.headers.get("location"), "/?auth=erreur");
  assert.equal(f.calls.length, 0);
  const valid = await f.get(callback, cookie);
  assert.equal(valid.headers.get("location"), "/?auth=ok");
  assert.match(valid.headers.get("set-cookie"), /pokdle_session=/);
  assert.match(valid.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
  assert.equal(f.calls.length, 2);
  const replay = await f.get(callback, cookie);
  assert.equal(replay.headers.get("location"), "/?auth=erreur");
  assert.equal(f.calls.length, 2);
});

test("Google sign-in asks only for the profile and opens a google: account", async (t) => {
  const f = await fixture(t);
  const start = await f.get("/auth/google");
  assert.equal(start.status, 302);
  const target = new URL(start.headers.get("location"));
  assert.equal(target.origin + target.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(target.searchParams.get("scope"), "openid profile");
  assert.equal(target.searchParams.get("redirect_uri"), "https://example.test/auth/google/callback");
  const state = target.searchParams.get("state");
  const cookie = start.headers.get("set-cookie").split(";")[0];
  const callback = `/auth/google/callback?code=synthetic-code&state=${state}`;
  assert.equal((await f.get(callback)).headers.get("location"), "/?auth=erreur&via=google");
  assert.equal(f.calls.length, 0, "no call to Google without the bound attempt");
  const valid = await f.get(callback, cookie);
  assert.equal(valid.headers.get("location"), "/?auth=ok&via=google");
  assert.deepEqual(f.calls, ["https://oauth2.googleapis.com/token", "https://openidconnect.googleapis.com/v1/userinfo"]);
  const token = valid.headers.get("set-cookie").match(/pokdle_session=([^;]+)/)[1];
  const session = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  assert.equal(session.id, "google:109876543210987654321", "a Google account id can never look like a Discord id");
  assert.equal(session.username, "Sacha", "only the first name is shown");
  assert.equal(session.via, "google");
  assert.equal(JSON.stringify(session).includes("example.test"), false, "the email is never kept");
  const me = await (await f.get("/api/me", `pokdle_session=${token}`)).json();
  assert.deepEqual(me.providers, { discord: true, google: true, twitch: true });
  assert.equal(me.user.via, "google");
});

test("Twitch sign-in asks only for the identity and opens a twitch: account", async (t) => {
  const f = await fixture(t);
  const start = await f.get("/auth/twitch");
  assert.equal(start.status, 302);
  const target = new URL(start.headers.get("location"));
  assert.equal(target.origin + target.pathname, "https://id.twitch.tv/oauth2/authorize");
  assert.equal(target.searchParams.get("scope"), "openid", "no email or other scope is requested");
  assert.equal(target.searchParams.get("redirect_uri"), "https://example.test/auth/twitch/callback");
  const state = target.searchParams.get("state");
  const cookie = start.headers.get("set-cookie").split(";")[0];
  const callback = `/auth/twitch/callback?code=synthetic-code&state=${state}`;
  assert.equal((await f.get(callback)).headers.get("location"), "/?auth=erreur&via=twitch");
  assert.equal(f.calls.length, 0, "no call to Twitch without the bound attempt");
  const valid = await f.get(callback, cookie);
  assert.equal(valid.headers.get("location"), "/?auth=ok&via=twitch");
  assert.deepEqual(f.calls, ["https://id.twitch.tv/oauth2/token", "https://api.twitch.tv/helix/users"]);
  assert.equal(f.twitchHeaders()["Client-Id"], "test-twitch-client");
  const token = valid.headers.get("set-cookie").match(/pokdle_session=([^;]+)/)[1];
  const session = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  assert.equal(session.id, "twitch:44322889", "a Twitch account id can never look like a Discord id");
  assert.equal(session.username, "Ondine_TV");
  assert.equal(session.avatar, "https://static-cdn.jtvnw.net/jtv_user_pictures/synthetic.png");
  assert.equal(session.via, "twitch");
  assert.equal(JSON.stringify(session).includes("example.test"), false, "the email is never kept");
});

test("Twitch stays hidden and closed until its keys are set", async (t) => {
  const f = await fixture(t, null, {}, { TWITCH_CLIENT_ID: "", TWITCH_CLIENT_SECRET: "" });
  const me = await (await f.get("/api/me")).json();
  assert.deepEqual(me.providers, { discord: true, google: true, twitch: false });
  assert.equal((await f.get("/auth/twitch")).headers.get("location"), "/?auth=indispo");
  assert.equal((await f.get("/auth/twitch/callback?code=c&state=s")).headers.get("location"), "/?auth=indispo");
  assert.equal(f.calls.length, 0);
});

// Just enough of the accounts tables to follow sign-ins and links.
function accountsDb() {
  const users = new Map(), identities = new Map();
  const db = (sql, p) => {
    if (/SELECT account_id FROM account_identities/.test(sql)) { const id = identities.get(p[0] + "|" + p[1]); return { rows: id ? [{ account_id: id }] : [], rowCount: id ? 1 : 0 }; }
    if (/SELECT 1 FROM users/.test(sql)) return { rows: [], rowCount: users.has(p[0]) ? 1 : 0 };
    if (/^\s*INSERT INTO users/.test(sql)) { users.set(p[0], { username: p[1], avatar: p[2] }); return { rows: [], rowCount: 1 }; }
    if (/UPDATE users SET last_login/.test(sql)) { const u = users.get(p[0]); if (u && !u.avatar) u.avatar = p[1]; return { rows: [], rowCount: u ? 1 : 0 }; }
    if (/INSERT INTO account_identities\(provider, provider_user_id, account_id\) VALUES/.test(sql)) { const key = p[0] + "|" + p[1]; if (!identities.has(key)) identities.set(key, p[2]); return { rows: [], rowCount: 1 }; }
    if (/SELECT username, avatar FROM users/.test(sql)) { const u = users.get(p[0]); return { rows: u ? [u] : [], rowCount: u ? 1 : 0 }; }
    if (/SELECT to_regclass/.test(sql)) return { rows: [{ t: p[0] === "users" ? "users" : null }], rowCount: 1 };
    if (/DELETE FROM users WHERE discord_id/.test(sql)) {
      users.delete(p[0]);
      for (const [key, account] of identities) if (account === p[0]) identities.delete(key);
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  return { db, users, identities };
}
async function signIn(f, provider, session) {
  const start = await f.get("/auth/" + provider, session);
  const state = new URL(start.headers.get("location")).searchParams.get("state");
  const binding = start.headers.get("set-cookie").split(";")[0];
  const done = await f.get(`/auth/${provider}/callback?code=c&state=${state}`, binding + (session ? "; " + session : ""));
  const token = (done.headers.get("set-cookie") || "").match(/pokdle_session=([^;]+)/)?.[1];
  return { location: done.headers.get("location"), cookie: "pokdle_session=" + token, session: JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) };
}

test("signing in with Google while connected links Google to the same account", async (t) => {
  const store = accountsDb(), people = { discordId: "1234567890" };
  const f = await fixture(t, store.db, people);
  const discord = await signIn(f, "discord");
  assert.equal(discord.session.id, "1234567890");
  const linked = await signIn(f, "google", discord.cookie);
  assert.equal(linked.location, "/?auth=linked&via=google");
  assert.equal(linked.session.id, "1234567890", "Google opens the Discord account, records included");
  assert.equal(store.users.has("google:109876543210987654321"), false, "no second account was created");
  const again = await signIn(f, "google");
  assert.equal(again.location, "/?auth=ok&via=google");
  assert.equal(again.session.id, "1234567890", "later, Google alone opens that account");
});

test("signing in with Twitch while connected links Twitch to the same account", async (t) => {
  const store = accountsDb(), people = { discordId: "1234567890", twitchId: "987" };
  const f = await fixture(t, store.db, people);
  const discord = await signIn(f, "discord");
  const linked = await signIn(f, "twitch", discord.cookie);
  assert.equal(linked.location, "/?auth=linked&via=twitch");
  assert.equal(linked.session.id, "1234567890");
  assert.equal(store.identities.get("twitch|987"), "1234567890");
  assert.equal(store.users.has("twitch:987"), false, "no second account was created");
});

test("an existing Discord account with its own records is never linked into another account", async (t) => {
  const store = accountsDb(), people = { discordId: "555", googleSub: "42" };
  store.users.set("555", { username: "Ancien", avatar: "" });
  const f = await fixture(t, store.db, people);
  const google = await signIn(f, "google");
  assert.equal(google.session.id, "google:42");
  const discord = await signIn(f, "discord", google.cookie);
  assert.equal(discord.location, "/?auth=ok");
  assert.equal(discord.session.id, "555", "the Discord sign-in opens its own account");
  assert.equal(store.identities.get("discord|555"), "555");
});

test("deleting an account removes it and its sign-ins, then signs out", async (t) => {
  const store = accountsDb(), people = { discordId: "777" };
  const f = await fixture(t, store.db, people);
  const discord = await signIn(f, "discord");
  assert.equal((await f.post("/api/account/delete", null, { confirm: "SUPPRIMER" })).status, 401);
  assert.equal((await f.post("/api/account/delete", discord.cookie, {})).status, 400, "an explicit confirmation is required");
  assert.ok(store.users.has("777"));
  const done = await f.post("/api/account/delete", discord.cookie, { confirm: "SUPPRIMER" });
  assert.equal(done.status, 200);
  assert.match(done.headers.get("set-cookie"), /pokdle_session=;/);
  assert.equal(store.users.has("777"), false);
  assert.equal([...store.identities.values()].includes("777"), false);
  const again = await signIn(f, "google", discord.cookie);
  assert.equal(again.session.id, "google:109876543210987654321", "a stale session cannot link into a deleted account");
});

test("Google and Twitch avatars are allowed by the image policy", async (t) => {
  const f = await fixture(t);
  const response = await f.get("/api/me");
  assert.match(response.headers.get("content-security-policy"), /img-src[^;]*https:\/\/\*\.googleusercontent\.com/);
  assert.match(response.headers.get("content-security-policy"), /img-src[^;]*https:\/\/static-cdn\.jtvnw\.net/);
});

test("missing state is rejected without contacting Discord", async (t) => {
  const f = await fixture(t);
  const response = await f.get("/auth/discord/callback?code=synthetic-code");
  assert.equal(response.headers.get("location"), "/?auth=erreur");
  assert.equal(f.calls.length, 0);
});

test("security headers cover account JSON and OAuth redirects; malformed cookies do not crash", async (t) => {
  const f = await fixture(t);
  for (const url of ["/api/me", "/auth/discord"]) {
    const response = await f.get(url, "broken=%E0%A4%A");
    assert.ok(response.status < 500);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-security-policy"), /script-src 'self'/);
  }
});

test("a session from before the database move gets its account row back, a deleted account never", async (t) => {
  const queries = [], deleted = new Set(["99999"]), users = new Map();
  const db = (sql, p) => {
    queries.push([sql.replace(/\s+/g, " ").trim(), p]);
    if (/^\s*INSERT INTO users\(discord_id, username, avatar\) SELECT/.test(sql)) {
      if (deleted.has(p[0]) || users.has(p[0])) return { rows: [], rowCount: 0 };
      users.set(p[0], { username: p[1], avatar: p[2], data: {} }); return { rows: [], rowCount: 1 };
    }
    if (/SELECT data FROM users/.test(sql)) { const u = users.get(p[0]); return { rows: u ? [{ data: u.data }] : [], rowCount: u ? 1 : 0 }; }
    if (/UPDATE users SET data/.test(sql)) { const u = users.get(p[0]); if (u) u.data = JSON.parse(p[1]); return { rows: [], rowCount: u ? 1 : 0 }; }
    return { rows: [], rowCount: 0 };
  };
  const f = await fixture(t, db);
  const jwt = require("../node_modules/jsonwebtoken");
  const secret = "synthetic-session-secret-for-tests-only", before = Math.floor(Date.parse("2026-10-10T12:00:00Z") / 1000);
  const cookie = payload => "pokdle_session=" + jwt.sign(payload, secret);
  const rebuilt = q => q.filter(([sql]) => sql.startsWith("INSERT INTO users(discord_id, username, avatar) SELECT"));

  await f.get("/api/me", cookie({ id: "1234567890", username: "Sacha", avatar: "abc", via: "discord", iat: before }));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(users.get("1234567890"), { username: "Sacha", avatar: "abc", data: {} }, "the ranking name comes back from the session");
  assert.ok(queries.some(([sql, p]) => sql.includes("account_identities") && p[0] === "1234567890"), "the Discord sign-in link comes back too");

  queries.length = 0;
  await f.get("/api/me", cookie({ id: "1234567890", username: "Sacha", avatar: "abc", via: "discord", iat: before }));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(rebuilt(queries).length, 0, "checked once per account");

  await f.get("/api/me", cookie({ id: "99999", username: "Parti", avatar: "", via: "discord", iat: before }));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(users.has("99999"), false, "a deleted account stays deleted");

  queries.length = 0;
  await f.get("/api/me", cookie({ id: "555", username: "Nouveau", avatar: "", via: "discord" }));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(rebuilt(queries).length, 0, "sessions opened since the move already have their row");

  const google = cookie({ id: "google:42", username: "Ondine", avatar: "", via: "google", iat: before });
  const saved = await f.post("/api/profile", google, { _accountId: "google:42", profile: { xp: 12 } });
  assert.deepEqual(await saved.json(), { ok: true });
  assert.deepEqual(users.get("google:42").data, { _accountId: "google:42", profile: { xp: 12 } }, "a profile save no longer lands nowhere");
  assert.ok(queries.some(([sql, p]) => sql.includes("'google'") && p[0] === "42" && p[1] === "google:42"));
});

test("a profile built on an older online copy is refused with the newer one, so a device never wipes another", async (t) => {
  const users = new Map([["1234567890", { data: { _accountId: "1234567890", _savedAt: 2000, profile: '{"xp":300}' } }]]);
  const db = (sql, p) => {
    if (/SELECT data FROM users/.test(sql)) { const u = users.get(p[0]); return { rows: u ? [{ data: u.data }] : [], rowCount: u ? 1 : 0 }; }
    if (/UPDATE users SET data/.test(sql)) {
      const u = users.get(p[0]);
      // The real query compares the stored _savedAt with the base ($7) in SQL.
      if (!u || (p.length > 6 && Number(u.data._savedAt || 0) > Number(p[6]))) return { rows: [], rowCount: 0 };
      u.data = JSON.parse(p[1]); return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  };
  const f = await fixture(t, db);
  const jwt = require("../node_modules/jsonwebtoken");
  const cookie = "pokdle_session=" + jwt.sign({ id: "1234567890", username: "Sacha", avatar: "", via: "discord" }, "synthetic-session-secret-for-tests-only");
  const stale = await f.post("/api/profile", cookie, { _accountId: "1234567890", _savedAt: 3000, _baseSavedAt: 1000, profile: '{"xp":7}' });
  assert.equal(stale.status, 409);
  const body = await stale.json();
  assert.equal(body.error, "stale_profile");
  assert.equal(body.data.profile, '{"xp":300}', "the newer online copy comes back to be merged");
  assert.equal(users.get("1234567890").data.profile, '{"xp":300}', "nothing was overwritten");
  const fresh = await f.post("/api/profile", cookie, { _accountId: "1234567890", _savedAt: 4000, _baseSavedAt: 2000, profile: '{"xp":307}' });
  assert.deepEqual(await fresh.json(), { ok: true });
  assert.deepEqual(users.get("1234567890").data, { _accountId: "1234567890", _savedAt: 4000, profile: '{"xp":307}' }, "the base marker is not stored");
  const legacy = await f.post("/api/profile", cookie, { _accountId: "1234567890", _savedAt: 5000, profile: '{"xp":308}' });
  assert.deepEqual(await legacy.json(), { ok: true }, "a page from before this change still saves");
});

test("PostgreSQL: the stale-profile check runs on the real users table", { skip: !process.env.QA_DATABASE_URL, timeout: 20000 }, async () => {
  const { Pool } = require("pg"), { randomUUID } = require("node:crypto");
  const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const sql = source.match(/`(UPDATE users SET data = \$2[^`]+<= \$7)`/)[1];
  const schema = "sync_" + randomUUID().replaceAll("-", ""), root = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  let db;
  try {
    await root.query("CREATE SCHEMA " + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: "-c search_path=" + schema, max: 2 });
    await db.query("CREATE TABLE users(discord_id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}'::jsonb, partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)");
    await db.query("INSERT INTO users(discord_id, data) VALUES ('1', '{\"_savedAt\": 2000}'), ('2', '{}'), ('3', '{\"_savedAt\": \"oops\"}')");
    const run = (id, base) => db.query(sql, [id, JSON.stringify({ _savedAt: 9000 }), null, 0, null, null, base]);
    assert.equal((await run("1", 1000)).rowCount, 0, "older base: refused");
    assert.equal((await run("1", 2000)).rowCount, 1, "same base: saved");
    assert.equal((await run("2", 0)).rowCount, 1, "no online copy yet: saved");
    assert.equal((await run("3", 0)).rowCount, 1, "an unreadable stamp never blocks the save");
  } finally {
    if (db) await db.end();
    await root.query("DROP SCHEMA IF EXISTS " + schema + " CASCADE").catch(() => {});
    await root.end();
  }
});
