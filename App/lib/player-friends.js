"use strict";
// Amis (01/11/2026, option B choisie par Kayan) : from a trainer card, a signed-in player asks another
// one to be friends; both have to accept. There is no search by name: a player is added after being
// met (rankings, Party Room, a challenge). The friends list is what the private chat (next PR) will
// use: only friends can write to each other. A request can be refused, a player blocked (no request
// from them any more, and the friendship ends). A request with no answer is erased after 30 days.
const MAX_FRIENDS = 50;
const REQUESTS_PER_DAY = 20;
const KEEP_PENDING_DAYS = 30;
const PARIS_DAY_START = "(date_trunc('day', timezone('Europe/Paris', now())) AT TIME ZONE 'Europe/Paris')";

async function ensureTables(db) {
  // status: 'pending' (from_id asked to_id), 'accepted', or 'declined' (kept quiet: the asker is not
  // told, and is not notified again by a new request). seen: the receiver saw a pending request, or
  // the asker saw that it was accepted.
  await db.query(`CREATE TABLE IF NOT EXISTS player_friends (
    id BIGSERIAL PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ, seen BOOLEAN NOT NULL DEFAULT false)`);
  await db.query("CREATE UNIQUE INDEX IF NOT EXISTS player_friends_pair ON player_friends (LEAST(from_id, to_id), GREATEST(from_id, to_id))");
  await db.query("CREATE INDEX IF NOT EXISTS player_friends_to ON player_friends(to_id, status)");
  await db.query("CREATE INDEX IF NOT EXISTS player_friends_from ON player_friends(from_id, status)");
  // A blocked player can no longer ask this one to be friends (nor write, with the chat).
  await db.query(`CREATE TABLE IF NOT EXISTS player_blocks (
    account_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, blocked_id))`);
}

const iso = (column) => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

function createPlayerFriends({ db, accountOfPid, playerPid, push = async () => 0, ready = Promise.resolve(true), log = console }) {
  const nameOf = async (id) => (await db.query("SELECT username FROM users WHERE discord_id = $1", [String(id)])).rows[0]?.username || "Un dresseur";
  const tell = (to, payload) => Promise.resolve(push(String(to), payload)).catch((error) => log.warn("[amis] push:", String(error?.message || error).slice(0, 120)));
  const person = (row, prefix = "") => ({
    pid: playerPid(row[prefix + "id"]),
    username: row[prefix + "name"] || "Un dresseur",
    partnerId: Number(row[prefix + "partner"]) || null,
    xp: Number(row[prefix + "xp"]) || 0,
  });
  async function target(accountId, pid) {
    const me = String(accountId);
    const other = typeof pid === "string" && /^[0-9a-f]{16}$/.test(pid) ? await accountOfPid(db, pid) : null;
    if (!other) return { me, error: "unknown" };
    if (other === me) return { me, error: "self" };
    const exists = (await db.query("SELECT 1 FROM users WHERE discord_id = $1", [other])).rowCount > 0;
    return exists ? { me, other } : { me, error: "unknown" };
  }
  const pairRow = async (a, b, client = db) => (await client.query(
    "SELECT id, from_id, to_id, status FROM player_friends WHERE LEAST(from_id, to_id) = LEAST($1::text, $2::text) AND GREATEST(from_id, to_id) = GREATEST($1::text, $2::text)", [a, b])).rows[0] || null;
  const friendCount = async (id, client = db) => Number((await client.query(
    "SELECT count(*)::int AS n FROM player_friends WHERE status = 'accepted' AND (from_id = $1 OR to_id = $1)", [id])).rows[0].n);
  const blockedEither = async (a, b) => (await db.query(
    "SELECT 1 FROM player_blocks WHERE (account_id = $1 AND blocked_id = $2) OR (account_id = $2 AND blocked_id = $1)", [a, b])).rowCount > 0;

  async function purge() {
    await db.query(`DELETE FROM player_friends WHERE status IN ('pending', 'declined') AND created_at < now() - make_interval(days => $1)`, [KEEP_PENDING_DAYS]);
  }

  // 'self' | 'friends' | 'sent' | 'received' | 'blocked' (blocked by me) | 'none', for a trainer card.
  async function status(accountId, pid) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: true, relation: t.error === "self" ? "self" : "none" };
    if ((await db.query("SELECT 1 FROM player_blocks WHERE account_id = $1 AND blocked_id = $2", [t.me, t.other])).rowCount) return { ok: true, relation: "blocked" };
    const row = await pairRow(t.me, t.other);
    if (!row) return { ok: true, relation: "none" };
    if (row.status === "accepted") return { ok: true, relation: "friends" };
    // A refused request still reads « sent » to the one who asked: refusing stays discreet.
    if (row.from_id === t.me) return { ok: true, relation: "sent" };
    return { ok: true, relation: row.status === "pending" ? "received" : "none", ...(row.status === "pending" ? { id: Number(row.id) } : {}) };
  }

  async function list(accountId) {
    await ready;
    const me = String(accountId);
    await purge();
    const rows = (await db.query(`SELECT f.id, f.from_id, f.to_id, f.status, f.seen, ${iso("f.created_at")} AS created_at, ${iso("f.accepted_at")} AS accepted_at,
        o.discord_id AS o_id, o.username AS o_name, o.partner_id AS o_partner, o.xp AS o_xp
      FROM player_friends f JOIN users o ON o.discord_id = CASE WHEN f.from_id = $1 THEN f.to_id ELSE f.from_id END
      WHERE (f.from_id = $1 OR f.to_id = $1) ORDER BY COALESCE(f.accepted_at, f.created_at) DESC LIMIT 300`, [me])).rows;
    const blocked = (await db.query(`SELECT b.blocked_id AS o_id, u.username AS o_name, u.partner_id AS o_partner, u.xp AS o_xp
      FROM player_blocks b JOIN users u ON u.discord_id = b.blocked_id WHERE b.account_id = $1 ORDER BY b.created_at DESC LIMIT 100`, [me])).rows;
    const friends = [], incoming = [], outgoing = [], news = [];
    for (const row of rows) {
      const who = person(row, "o_");
      if (row.status === "accepted") {
        friends.push({ ...who, since: row.accepted_at });
        if (row.from_id === me && !row.seen) news.push(who);
      } else if (row.status === "pending" && row.to_id === me) incoming.push({ ...who, id: Number(row.id), createdAt: row.created_at, seen: Boolean(row.seen) });
      else if (row.from_id === me) outgoing.push({ ...who, createdAt: row.created_at });
    }
    return { ok: true, pid: playerPid(me), max: MAX_FRIENDS, friends, incoming, outgoing, news, blocked: blocked.map((row) => person(row, "o_")) };
  }

  async function request(accountId, { pid } = {}) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: false, error: t.error };
    const { me, other } = t;
    if (await blockedEither(me, other)) return { ok: false, error: "refused" };
    const row = await pairRow(me, other);
    if (row && row.status === "accepted") return { ok: false, error: "already" };
    if (row && row.from_id === me) return { ok: true, relation: "sent" };
    // They had asked first: asking back is accepting.
    if (row && row.status === "pending") return respond(me, { id: row.id, accept: true });
    if (await friendCount(me) >= MAX_FRIENDS) return { ok: false, error: "full" };
    if (await friendCount(other) >= MAX_FRIENDS) return { ok: false, error: "full_other" };
    const today = Number((await db.query(`SELECT count(*)::int AS n FROM player_friends WHERE from_id = $1 AND created_at >= ${PARIS_DAY_START}`, [me])).rows[0].n);
    if (today >= REQUESTS_PER_DAY) return { ok: false, error: "limit" };
    // A request they had refused before goes: this one is new.
    if (row) await db.query("DELETE FROM player_friends WHERE id = $1", [row.id]);
    await db.query("INSERT INTO player_friends(from_id, to_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [me, other]);
    const name = await nameOf(me);
    tell(other, { title: "🤝 " + name + " veut être ton ami", body: "Accepte sa demande dans « Mes amis » pour vous défier et discuter.", url: "/?amis=1", tag: "pokedle-ami" });
    return { ok: true, relation: "sent" };
  }

  async function respond(accountId, { id, accept } = {}) {
    await ready;
    const me = String(accountId);
    const rowId = Number(id);
    if (!Number.isSafeInteger(rowId) || rowId <= 0) return { ok: false, error: "unknown" };
    const row = (await db.query("SELECT id, from_id, to_id, status FROM player_friends WHERE id = $1 AND to_id = $2 AND status = 'pending'", [rowId, me])).rows[0];
    if (!row) return { ok: false, error: "unknown" };
    if (accept === false) {
      await db.query("UPDATE player_friends SET status = 'declined', seen = true WHERE id = $1", [rowId]);
      return { ok: true, relation: "none" };
    }
    if (await friendCount(me) >= MAX_FRIENDS) return { ok: false, error: "full" };
    if (await friendCount(row.from_id) >= MAX_FRIENDS) return { ok: false, error: "full_other" };
    await db.query("UPDATE player_friends SET status = 'accepted', accepted_at = now(), seen = false WHERE id = $1", [rowId]);
    const name = await nameOf(me);
    tell(row.from_id, { title: "🤝 " + name + " a accepté ta demande", body: "Vous êtes amis sur Pokédle. Un petit défi pour fêter ça ?", url: "/?amis=1", tag: "pokedle-ami" });
    return { ok: true, relation: "friends" };
  }

  // Ends a friendship, or takes back a request not answered yet.
  async function remove(accountId, { pid } = {}) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: false, error: t.error };
    await db.query(`DELETE FROM player_friends WHERE LEAST(from_id, to_id) = LEAST($1::text, $2::text) AND GREATEST(from_id, to_id) = GREATEST($1::text, $2::text)
      AND (status = 'accepted' OR (status = 'pending' AND from_id = $1))`, [t.me, t.other]);
    return { ok: true, relation: "none" };
  }

  async function block(accountId, { pid } = {}) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: false, error: t.error };
    await db.query("INSERT INTO player_blocks(account_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [t.me, t.other]);
    await db.query("DELETE FROM player_friends WHERE LEAST(from_id, to_id) = LEAST($1::text, $2::text) AND GREATEST(from_id, to_id) = GREATEST($1::text, $2::text)", [t.me, t.other]);
    return { ok: true, relation: "blocked" };
  }

  async function unblock(accountId, { pid } = {}) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: false, error: t.error };
    await db.query("DELETE FROM player_blocks WHERE account_id = $1 AND blocked_id = $2", [t.me, t.other]);
    return { ok: true, relation: "none" };
  }

  async function seen(accountId) {
    await ready;
    const me = String(accountId);
    await db.query("UPDATE player_friends SET seen = true WHERE NOT seen AND ((to_id = $1 AND status = 'pending') OR (from_id = $1 AND status = 'accepted'))", [me]);
    return { ok: true };
  }

  // For the chat (next PR): only friends can write to each other.
  async function areFriends(a, b) {
    await ready;
    const row = await pairRow(String(a), String(b));
    return Boolean(row && row.status === "accepted");
  }

  return { status, list, request, respond, remove, block, unblock, seen, areFriends };
}

function createRateLimit(limit = 60, windowMs = 3600000) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > limit;
  };
}

function mountFriendRoutes(app, { express, friends, getUser, log = console, limited = createRateLimit() }) {
  const json = express.json({ limit: "1kb" });
  const run = (name, work) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = friends ? getUser(req) : null;
    if (!user || !user.id) return res.status(401).json({ ok: false, error: "login" });
    if (req.method === "POST") {
      const origin = req.get("origin");
      let host = "";
      try { host = origin ? new URL(origin).host : ""; } catch (_e) { host = ""; }
      if (!origin || host !== req.get("host")) return res.status(403).json({ ok: false, error: "origin_denied" });
      if (limited(String(user.id))) { res.set("Retry-After", "3600"); return res.status(429).json({ ok: false, error: "rate_limited" }); }
    }
    try { res.json(await work(user, req.body || {}, req)); }
    catch (error) { log.error("[amis] " + name + ":", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  };
  app.get("/api/friends", run("list", (user) => friends.list(user.id)));
  app.get("/api/friends/status", run("status", (user, _body, req) => friends.status(user.id, String(req.query.pid || ""))));
  app.post("/api/friends/request", json, run("request", (user, body) => friends.request(user.id, { pid: body.pid })));
  app.post("/api/friends/respond", json, run("respond", (user, body) => friends.respond(user.id, { id: body.id, accept: body.accept !== false })));
  app.post("/api/friends/remove", json, run("remove", (user, body) => friends.remove(user.id, { pid: body.pid })));
  app.post("/api/friends/block", json, run("block", (user, body) => friends.block(user.id, { pid: body.pid })));
  app.post("/api/friends/unblock", json, run("unblock", (user, body) => friends.unblock(user.id, { pid: body.pid })));
  app.post("/api/friends/seen", json, run("seen", (user) => friends.seen(user.id)));
}

module.exports = { MAX_FRIENDS, REQUESTS_PER_DAY, KEEP_PENDING_DAYS, ensureTables, createPlayerFriends, mountFriendRoutes };
