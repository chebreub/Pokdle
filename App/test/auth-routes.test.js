"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

// Exercise the actual Express auth routes with synthetic Discord and DB data.
// Never read production credentials or call Discord/Postgres during tests.
async function fixture(t, db = null, people = {}) {
  const appDir = path.resolve(__dirname, "..");
  const appRequire = createRequire(path.join(appDir, "server.js"));
  const source = fs.readFileSync(path.join(appDir, "server.js"), "utf8").split("// ===== Fin auth Phase 1 =====")[0];
  const calls = [];
  const sandbox = {
    require(name) {
      if (name === "pg") return { Pool: class {
        on() {}
        async query(sql, params) { return db ? db(sql, params || []) : { rows: [] }; }
      } };
      return appRequire(name);
    },
    process: { env: {
      PORT: "0", DATABASE_URL: "synthetic-test-only", DISCORD_CLIENT_ID: "test-client",
      DISCORD_CLIENT_SECRET: "test-secret", DISCORD_CALLBACK_URL: "https://example.test/auth/discord/callback",
      GOOGLE_CLIENT_ID: "test-google-client", GOOGLE_CLIENT_SECRET: "test-google-secret",
      GOOGLE_CALLBACK_URL: "https://example.test/auth/google/callback",
      SESSION_SECRET: "synthetic-session-secret-for-tests-only"
    } },
    console: { log() {}, warn() {}, error() {} },
    URL, URLSearchParams, AbortSignal, Buffer, __dirname: appDir,
    module: { exports: {} },
    async fetch(url) {
      calls.push(url);
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
  return { calls, get: (url, cookie) => fetch(base + url, {
    redirect: "manual", headers: cookie ? { Cookie: cookie } : {}
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
  assert.deepEqual(me.providers, { discord: true, google: true });
  assert.equal(me.user.via, "google");
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

test("Google avatars are allowed by the image policy", async (t) => {
  const f = await fixture(t);
  const response = await f.get("/api/me");
  assert.match(response.headers.get("content-security-policy"), /img-src[^;]*https:\/\/\*\.googleusercontent\.com/);
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
