"use strict";

const { randomBytes, timingSafeEqual } = require("node:crypto");

// A separate host-only cookie per attempt permits concurrent sign-in tabs.
// The server consumes an attempt before exchanging the code with Discord.
function createOAuthStateStore({ ttlMs = 600000, maxEntries = 5000, now = Date.now } = {}) {
  const pending = new Map();
  const cookieName = (state) => `__Host-pokdle_oauth_${state}`;
  function issue() {
    const time = now();
    for (const [key, entry] of pending) {
      if (entry.expiresAt <= time) pending.delete(key);
    }
    if (pending.size >= maxEntries) return null;
    const state = randomBytes(32).toString("hex");
    const binding = randomBytes(32).toString("hex");
    pending.set(state, { binding, expiresAt: time + ttlMs });
    return { state, binding, cookieName: cookieName(state), maxAge: ttlMs };
  }
  function consume(state, cookies) {
    if (typeof state !== "string" || !/^[a-f0-9]{64}$/.test(state)) return false;
    const entry = pending.get(state);
    if (!entry) return false;
    if (entry.expiresAt <= now()) { pending.delete(state); return false; }
    const binding = cookies[cookieName(state)];
    if (typeof binding !== "string" || !/^[a-f0-9]{64}$/.test(binding)) return false;
    if (!timingSafeEqual(Buffer.from(binding, "hex"), Buffer.from(entry.binding, "hex"))) return false;
    pending.delete(state);
    return true;
  }
  return { issue, consume, cookieName };
}

module.exports = { createOAuthStateStore };
