"use strict";
// Défis entre joueurs (01/11/2026): from a trainer card, a signed-in player challenges another one
// to beat a record of theirs in an arcade game (« Bats ma série au Higher or Lower : 23 »). The
// target comes from the scores the server keeps, and the challenge is won by a result the server
// records for that game afterwards, never by anything the browser claims about the challenge.
// No free text between players: the challenger picks one of a few ready-made phrases. A player
// can refuse a challenge, stop one player's challenges, or turn challenges off. Kept 30 days.
const CHALLENGE_MODES = Object.freeze({
  higherlower: { label: "Higher or Lower", kind: "serie" },
  higherlower60: { label: "Higher or Lower 60 s", kind: "record" },
  poids: { label: "Duel de poids", kind: "serie" },
  intrus: { label: "Intrus", kind: "serie" },
  typecombo: { label: "Combo de types", kind: "record" },
  quiz: { label: "Quiz", kind: "record" },
  speedrun: { label: "Speedrun Pokédex", kind: "record" },
  draft_all: { label: "Draft Score Attack", kind: "record" },
});
const PHRASES = Object.freeze(["Tu tiendras pas 😏", "Facile pour toi ?", "Revanche ? 🔥", "Bonne chance 🍀", "À toi de jouer !"]);
const PER_DAY = 5;
const DAYS = 7;
const KEEP_DAYS = 30;
const ALL = "*";
const PARIS_DAY_START = "(date_trunc('day', timezone('Europe/Paris', now())) AT TIME ZONE 'Europe/Paris')";

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS player_challenges (
    id BIGSERIAL PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, mode TEXT NOT NULL,
    target INTEGER NOT NULL, phrase SMALLINT NOT NULL DEFAULT 0, best INTEGER,
    status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL, resolved_at TIMESTAMPTZ,
    seen_to BOOLEAN NOT NULL DEFAULT false, seen_from BOOLEAN NOT NULL DEFAULT true)`);
  await db.query("CREATE INDEX IF NOT EXISTS player_challenges_to ON player_challenges(to_id, status)");
  await db.query("CREATE INDEX IF NOT EXISTS player_challenges_from ON player_challenges(from_id, created_at)");
  // blocked_id '*' : this player takes no challenges at all.
  await db.query(`CREATE TABLE IF NOT EXISTS player_challenge_blocks (
    account_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, blocked_id))`);
}

const verb = (mode) => (CHALLENGE_MODES[mode]?.kind === "serie" ? "série" : "record");

function createPlayerChallenges({ db, accountOfPid, playerPid, push = async () => 0, ready = Promise.resolve(true), log = console }) {
  const nameOf = async (id) => (await db.query("SELECT username FROM users WHERE discord_id = $1", [String(id)])).rows[0]?.username || "Un dresseur";
  const tell = (to, payload) => Promise.resolve(push(String(to), payload)).catch((error) => log.warn("[defis] push:", String(error?.message || error).slice(0, 120)));

  async function options(accountId) {
    await ready;
    const id = String(accountId);
    const records = (await db.query("SELECT mode, score FROM scores WHERE discord_id = $1 AND mode = ANY($2) AND score > 0",
      [id, Object.keys(CHALLENGE_MODES)])).rows;
    const sent = (await db.query(`SELECT count(*)::int AS n FROM player_challenges WHERE from_id = $1 AND created_at >= ${PARIS_DAY_START}`, [id])).rows[0].n;
    const off = (await db.query("SELECT 1 FROM player_challenge_blocks WHERE account_id = $1 AND blocked_id = $2", [id, ALL])).rowCount > 0;
    const byMode = Object.fromEntries(records.map((row) => [row.mode, Number(row.score)]));
    return {
      ok: true, pid: playerPid(id), accepting: !off, left: Math.max(0, PER_DAY - sent), perDay: PER_DAY, days: DAYS, phrases: PHRASES,
      modes: Object.entries(CHALLENGE_MODES).map(([mode, cfg]) => ({ mode, label: cfg.label, kind: cfg.kind, record: byMode[mode] || 0 })),
    };
  }

  async function create(fromId, { pid, mode, phrase } = {}) {
    await ready;
    const from = String(fromId);
    const cfg = CHALLENGE_MODES[mode];
    if (!cfg) return { ok: false, error: "mode" };
    const said = Number(phrase);
    if (!Number.isInteger(said) || said < 0 || said >= PHRASES.length) return { ok: false, error: "phrase" };
    const to = await accountOfPid(db, String(pid || ""));
    if (!to) return { ok: false, error: "unknown" };
    if (to === from) return { ok: false, error: "self" };
    const target = Number((await db.query("SELECT score FROM scores WHERE discord_id = $1 AND mode = $2", [from, mode])).rows[0]?.score) || 0;
    if (target <= 0) return { ok: false, error: "no_record" };
    if ((await db.query("SELECT 1 FROM player_challenge_blocks WHERE account_id = $1 AND blocked_id IN ($2, $3) LIMIT 1", [to, from, ALL])).rowCount) return { ok: false, error: "refused" };
    const sent = (await db.query(`SELECT count(*)::int AS n FROM player_challenges WHERE from_id = $1 AND created_at >= ${PARIS_DAY_START}`, [from])).rows[0].n;
    if (sent >= PER_DAY) return { ok: false, error: "limit" };
    const open = (await db.query("SELECT 1 FROM player_challenges WHERE from_id = $1 AND to_id = $2 AND mode = $3 AND status = 'open' AND expires_at > now()", [from, to, mode])).rowCount;
    if (open) return { ok: false, error: "already" };
    const row = (await db.query(`INSERT INTO player_challenges(from_id, to_id, mode, target, phrase, expires_at)
      VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6)) RETURNING id`, [from, to, mode, target, said, DAYS])).rows[0];
    const name = await nameOf(from);
    tell(to, { title: `⚔️ ${name} te défie`, body: `Bats sa ${verb(mode)} au ${cfg.label} : ${target}. « ${PHRASES[said]} »`, url: "/?defis=1", tag: "pokedle-defi" });
    return { ok: true, id: Number(row.id), target };
  }

  // Called once a result of `mode` is stored for this player: an open challenge of theirs in that
  // game keeps their best score since it was sent, and is won once that score beats the target.
  async function afterResult(accountId, mode, score) {
    if (!CHALLENGE_MODES[mode]) return [];
    await ready;
    const n = Math.floor(Number(score));
    if (!Number.isFinite(n) || n <= 0) return [];
    const rows = (await db.query(`UPDATE player_challenges SET best = GREATEST(COALESCE(best, 0), $3),
        status = CASE WHEN GREATEST(COALESCE(best, 0), $3) > target THEN 'won' ELSE status END,
        resolved_at = CASE WHEN GREATEST(COALESCE(best, 0), $3) > target THEN now() ELSE resolved_at END,
        seen_from = CASE WHEN GREATEST(COALESCE(best, 0), $3) > target THEN false ELSE seen_from END
      WHERE to_id = $1 AND mode = $2 AND status = 'open' AND expires_at > now()
      RETURNING id, from_id, target, best, status`, [String(accountId), mode, n])).rows;
    const won = rows.filter((row) => row.status === "won");
    if (won.length) {
      const name = await nameOf(accountId);
      for (const row of won) tell(row.from_id, { title: `🏆 ${name} a battu ta ${verb(mode)}`, body: `${row.best} contre ${row.target} au ${CHALLENGE_MODES[mode].label}. Revanche ?`, url: "/?defis=1", tag: "pokedle-defi" });
    }
    return rows.map((row) => ({ id: Number(row.id), target: Number(row.target), best: Number(row.best), won: row.status === "won" }));
  }

  async function list(accountId) {
    await ready;
    const id = String(accountId);
    await db.query(`UPDATE player_challenges SET status = 'expired', resolved_at = now(), seen_from = false
      WHERE status = 'open' AND expires_at <= now() AND (from_id = $1 OR to_id = $1)`, [id]);
    await db.query(`DELETE FROM player_challenges WHERE created_at < now() - make_interval(days => $1)`, [KEEP_DAYS]);
    const rows = (await db.query(`SELECT c.id, c.from_id, c.to_id, c.mode, c.target, c.phrase, c.best, c.status, c.seen_to, c.seen_from,
        to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        to_char(c.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
        uf.username AS from_name, uf.partner_id AS from_partner, ut.username AS to_name, ut.partner_id AS to_partner
      FROM player_challenges c LEFT JOIN users uf ON uf.discord_id = c.from_id LEFT JOIN users ut ON ut.discord_id = c.to_id
      WHERE c.from_id = $1 OR c.to_id = $1 ORDER BY c.created_at DESC LIMIT 60`, [id])).rows;
    const off = (await db.query("SELECT 1 FROM player_challenge_blocks WHERE account_id = $1 AND blocked_id = $2", [id, ALL])).rowCount > 0;
    return {
      ok: true, accepting: !off,
      challenges: rows.map((row) => {
        const incoming = row.to_id === id;
        const cfg = CHALLENGE_MODES[row.mode] || { label: row.mode, kind: "record" };
        return {
          id: Number(row.id), incoming, mode: row.mode, label: cfg.label, kind: cfg.kind,
          target: Number(row.target), best: row.best == null ? null : Number(row.best),
          phrase: PHRASES[Number(row.phrase)] || PHRASES[0], status: row.status,
          seen: incoming ? Boolean(row.seen_to) : Boolean(row.seen_from),
          createdAt: row.created_at, expiresAt: row.expires_at,
          other: {
            pid: playerPid(incoming ? row.from_id : row.to_id),
            username: (incoming ? row.from_name : row.to_name) || "Un dresseur",
            partnerId: Number(incoming ? row.from_partner : row.to_partner) || null,
          },
        };
      }),
    };
  }

  async function seen(accountId, ids) {
    await ready;
    const list = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 60);
    if (!list.length) return { ok: true };
    await db.query("UPDATE player_challenges SET seen_to = true WHERE to_id = $1 AND id = ANY($2)", [String(accountId), list]);
    await db.query("UPDATE player_challenges SET seen_from = true WHERE from_id = $1 AND id = ANY($2)", [String(accountId), list]);
    return { ok: true };
  }

  async function decline(accountId, challengeId) {
    await ready;
    const r = await db.query(`UPDATE player_challenges SET status = 'declined', resolved_at = now(), seen_from = false
      WHERE id = $2 AND to_id = $1 AND status = 'open'`, [String(accountId), Number(challengeId)]);
    return { ok: r.rowCount > 0 };
  }

  // « Ne plus recevoir ses défis » : named by one of their challenges, never by their account id.
  async function block(accountId, challengeId) {
    await ready;
    const id = String(accountId);
    const from = (await db.query("SELECT from_id FROM player_challenges WHERE id = $2 AND to_id = $1", [id, Number(challengeId)])).rows[0]?.from_id;
    if (!from) return { ok: false };
    await db.query("INSERT INTO player_challenge_blocks(account_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, from]);
    await db.query(`UPDATE player_challenges SET status = 'declined', resolved_at = now(), seen_from = false
      WHERE to_id = $1 AND from_id = $2 AND status = 'open'`, [id, from]);
    return { ok: true };
  }

  // Challenges on or off; turning them back on also forgets the players stopped one by one.
  async function setAccepting(accountId, on) {
    await ready;
    const id = String(accountId);
    if (on) await db.query("DELETE FROM player_challenge_blocks WHERE account_id = $1", [id]);
    else await db.query("INSERT INTO player_challenge_blocks(account_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, ALL]);
    return { ok: true, accepting: Boolean(on) };
  }

  return { options, create, afterResult, list, seen, decline, block, setAccepting };
}

// The same notification the 🔔 reminders use, for the players who turned it on.
function pushSender({ db, webpush, configured, log = console }) {
  return async (to, payload) => {
    if (!webpush || !await configured) return 0;
    const rows = (await db.query("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE account_id = $1", [String(to)])).rows;
    let sent = 0;
    for (const row of rows) {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload), { TTL: 86400, urgency: "normal", topic: "pokedle-defi" });
        sent += 1;
      } catch (error) {
        if (error && (error.statusCode === 404 || error.statusCode === 410)) await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]);
        else log.warn("[defis] push failed:", String((error && (error.statusCode || error.message)) || error).slice(0, 120));
      }
    }
    return sent;
  };
}

function createRateLimit(limit = 30, windowMs = 3600000) {
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

function mountChallengeRoutes(app, { express, challenges, getUser, log = console, limited = createRateLimit() }) {
  const json = express.json({ limit: "2kb" });
  const signedIn = (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = challenges ? getUser(req) : null;
    if (!user || !user.id) { res.status(401).json({ ok: false, error: "login" }); return null; }
    return user;
  };
  const sameOrigin = (req, res) => {
    const origin = req.get("origin");
    let host = "";
    try { host = origin ? new URL(origin).host : ""; } catch (_e) { host = ""; }
    if (!origin || host !== req.get("host")) { res.status(403).json({ ok: false, error: "origin_denied" }); return false; }
    return true;
  };
  const run = (name, work) => async (req, res) => {
    const user = signedIn(req, res);
    if (!user) return;
    if (req.method === "POST") {
      if (!sameOrigin(req, res)) return;
      if (limited(String(user.id))) { res.set("Retry-After", "3600"); return res.status(429).json({ ok: false, error: "rate_limited" }); }
    }
    try { res.json(await work(user, req.body || {})); }
    catch (error) { log.error("[defis] " + name + ":", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  };
  app.get("/api/challenges", run("list", (user) => challenges.list(user.id)));
  app.get("/api/challenges/options", run("options", (user) => challenges.options(user.id)));
  app.post("/api/challenges", json, run("create", (user, body) => challenges.create(user.id, body)));
  app.post("/api/challenges/seen", json, run("seen", (user, body) => challenges.seen(user.id, body.ids)));
  app.post("/api/challenges/decline", json, run("decline", (user, body) => challenges.decline(user.id, body.id)));
  app.post("/api/challenges/block", json, run("block", (user, body) => challenges.block(user.id, body.id)));
  app.post("/api/challenges/settings", json, run("settings", (user, body) => challenges.setAccepting(user.id, body.accepting !== false)));
}

module.exports = { CHALLENGE_MODES, PHRASES, PER_DAY, DAYS, KEEP_DAYS, ensureTables, createPlayerChallenges, pushSender, mountChallengeRoutes };
