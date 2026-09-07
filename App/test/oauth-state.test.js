"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createOAuthStateStore } = require("../lib/oauth-state");
const cookiesFor = (attempt) => ({ [attempt.cookieName]: attempt.binding });

test("an OAuth attempt needs the initiating browser cookie and can be used once", () => {
  const store = createOAuthStateStore();
  const attempt = store.issue();
  assert.equal(store.consume(attempt.state, {}), false);
  assert.equal(store.consume(attempt.state, { [attempt.cookieName]: "0".repeat(64) }), false);
  assert.equal(store.consume(attempt.state, cookiesFor(attempt)), true);
  assert.equal(store.consume(attempt.state, cookiesFor(attempt)), false);
});

test("malformed and expired states never authorize a callback", () => {
  let time = 0;
  const store = createOAuthStateStore({ ttlMs: 100, now: () => time });
  const attempt = store.issue();
  for (const state of [undefined, [attempt.state], {}, "bad", "a".repeat(64)]) {
    assert.equal(store.consume(state, cookiesFor(attempt)), false);
  }
  time = 100;
  assert.equal(store.consume(attempt.state, cookiesFor(attempt)), false);
});

test("two concurrent tabs have independent states and cookies", () => {
  const store = createOAuthStateStore();
  const first = store.issue();
  const second = store.issue();
  assert.notEqual(first.state, second.state);
  const cookies = { ...cookiesFor(first), ...cookiesFor(second) };
  assert.equal(store.consume(second.state, cookies), true);
  assert.equal(store.consume(first.state, cookies), true);
});

test("the store is bounded and expired entries release capacity", () => {
  let time = 0;
  const store = createOAuthStateStore({ maxEntries: 1, ttlMs: 100, now: () => time });
  assert.ok(store.issue());
  assert.equal(store.issue(), null);
  time = 100;
  assert.ok(store.issue());
});
