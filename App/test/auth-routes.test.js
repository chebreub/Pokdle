"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

// Exercise the actual Express auth routes with synthetic Discord and DB data.
// Never read production credentials or call Discord/Postgres during tests.
async function fixture(t) {
  const appDir = path.resolve(__dirname, "..");
  const appRequire = createRequire(path.join(appDir, "server.js"));
  const source = fs.readFileSync(path.join(appDir, "server.js"), "utf8").split("// ===== Fin auth Phase 1 =====")[0];
  const calls = [];
  const sandbox = {
    require(name) {
      if (name === "pg") return { Pool: class {
        on() {}
        async query() { return { rows: [] }; }
      } };
      return appRequire(name);
    },
    process: { env: {
      PORT: "0", DATABASE_URL: "synthetic-test-only", DISCORD_CLIENT_ID: "test-client",
      DISCORD_CLIENT_SECRET: "test-secret", DISCORD_CALLBACK_URL: "https://example.test/auth/discord/callback",
      SESSION_SECRET: "synthetic-session-secret-for-tests-only"
    } },
    console: { log() {}, warn() {}, error() {} },
    URL, URLSearchParams, AbortSignal, Buffer, __dirname: appDir,
    module: { exports: {} },
    async fetch(url) {
      calls.push(url);
      return { ok: true, json: async () => url.endsWith("/token")
        ? { access_token: "synthetic-token" }
        : { id: "1234567890", username: "Test", avatar: null } };
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
