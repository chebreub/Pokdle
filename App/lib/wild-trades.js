"use strict";
// 🔁 Échanges entre amis (3/11/2026, « go les 2 », d'après l'étude PokeMind) : un doublon contre un doublon,
// seulement entre amis (les deux ont accepté), l'autre doit accepter. Jamais le dernier exemplaire,
// un shiny seulement contre un shiny, 3 propositions par jour (jour de Paris), 7 jours pour répondre.
// Les Pokémon sont ceux attrapés dans les hautes herbes (wild_encounters, lib/poke-balls.js) : l'exemplaire
// donné passe en 'traded', le reçu est une nouvelle ligne 'caught' de sorte 'trade' (hors des 6 rencontres du jour,
// sans Ball dépensée). Effacé avec le compte.
const { dailyCalendar } = require("./daily-game");
const safety = require("./social-safety");

const TRADES_PER_DAY = 3;
const PENDING_MAX = 10;
const ANSWER_DAYS = 7;
const KEEP_DAYS = 30;
const fail = (error, status = 409) => ({ ok: false, error, status });

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS wild_trades (
    id BIGSERIAL PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
    give_id INTEGER NOT NULL, want_id INTEGER NOT NULL, shiny BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending', day DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ, seen BOOLEAN NOT NULL DEFAULT false)`);
  await db.query("CREATE INDEX IF NOT EXISTS wild_trades_to ON wild_trades(to_id, status)");
  await db.query("CREATE INDEX IF NOT EXISTS wild_trades_from ON wild_trades(from_id, day)");
  // PART-04 : « Montrer mes doublons à mes amis » (absent = oui, comme avant). Effacé avec le compte.
  await db.query(`CREATE TABLE IF NOT EXISTS trade_settings (
    account_id TEXT PRIMARY KEY, share_dupes BOOLEAN NOT NULL DEFAULT true, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
}

const iso = (column) => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

function createWildTrades({ db, friends, accountOfPid, playerPid, push = async () => 0, ready = Promise.resolve(true), clock = () => new Date(), log = console }) {
  const tell = (to, payload) => Promise.resolve(push(String(to), payload)).catch((e) => log.warn("[echanges] push:", String(e && e.message || e).slice(0, 120)));
  const nameOf = async (id) => (await db.query("SELECT username FROM users WHERE discord_id = $1", [String(id)])).rows[0]?.username || "Un dresseur";
  const keyOf = (id) => "user:" + id;
  const today = () => dailyCalendar(clock()).day;
  const validId = (n) => Number.isInteger(n) && n >= 1 && n <= 1025;

  // Les doublons d'un joueur : combien d'exemplaires de chaque Pokémon il peut donner (tous sauf le dernier).
  async function dupesOf(accountId, client = db) {
    const rows = (await client.query(`SELECT pokemon_id, COUNT(*) FILTER (WHERE NOT shiny)::int AS normal, COUNT(*) FILTER (WHERE shiny)::int AS shiny
      FROM wild_encounters WHERE identity = $1 AND status = 'caught' GROUP BY pokemon_id HAVING COUNT(*) FILTER (WHERE NOT shiny) > 1 OR COUNT(*) FILTER (WHERE shiny) > 1
      ORDER BY pokemon_id`, [keyOf(accountId)])).rows;
    return rows.map((r) => ({ id: Number(r.pokemon_id), normal: Math.max(0, Number(r.normal) - 1), shiny: Math.max(0, Number(r.shiny) - 1) }));
  }
  async function owned(accountId, client = db) {
    const rows = (await client.query("SELECT DISTINCT pokemon_id FROM wild_encounters WHERE identity = $1 AND status = 'caught'", [keyOf(accountId)])).rows;
    return rows.map((r) => Number(r.pokemon_id));
  }
  const countOf = async (client, accountId, pokemonId, shiny) => Number((await client.query(
    "SELECT COUNT(*)::int AS n FROM wild_encounters WHERE identity = $1 AND status = 'caught' AND pokemon_id = $2 AND shiny = $3",
    [keyOf(accountId), pokemonId, shiny])).rows[0].n);

  async function sharesDupes(accountId) {
    const row = (await db.query("SELECT share_dupes FROM trade_settings WHERE account_id = $1", [String(accountId)])).rows[0];
    return !row || row.share_dupes !== false;
  }
  async function friendOf(me, pid) {
    const other = typeof pid === "string" && /^[0-9a-f]{16}$/.test(pid) ? await accountOfPid(db, pid) : null;
    if (!other || other === String(me)) return null;
    if (!friends || !await friends.areFriends(String(me), other)) return null;
    return other;
  }
  async function expire() {
    await db.query("UPDATE wild_trades SET status = 'expired', decided_at = now() WHERE status = 'pending' AND created_at < now() - make_interval(days => $1)", [ANSWER_DAYS]);
    await db.query("DELETE FROM wild_trades WHERE status <> 'pending' AND COALESCE(decided_at, created_at) < now() - make_interval(days => $1)", [KEEP_DAYS]);
  }
  const view = (row, me) => ({
    id: Number(row.id), mine: row.from_id === String(me), status: row.status, giveId: Number(row.give_id), wantId: Number(row.want_id),
    shiny: Boolean(row.shiny), createdAt: row.created_at, decidedAt: row.decided_at || null,
    other: { pid: playerPid(row.from_id === String(me) ? row.to_id : row.from_id), username: row.o_name || "Un dresseur" }
  });

  async function list(accountId) {
    await ready;
    const me = String(accountId);
    await expire();
    const rows = (await db.query(`SELECT t.*, ${iso("t.created_at")} AS created_at, ${iso("t.decided_at")} AS decided_at, u.username AS o_name
      FROM wild_trades t LEFT JOIN users u ON u.discord_id = CASE WHEN t.from_id = $1 THEN t.to_id ELSE t.from_id END
      WHERE (t.from_id = $1 OR t.to_id = $1) ORDER BY t.id DESC LIMIT 60`, [me])).rows;
    const trades = rows.map((r) => view(r, me));
    const used = Number((await db.query("SELECT COUNT(*)::int AS n FROM wild_trades WHERE from_id = $1 AND day = $2", [me, today()])).rows[0].n);
    return { ok: true, trades, incoming: trades.filter((t) => !t.mine && t.status === "pending").length,
      news: rows.filter((r) => r.from_id === me && r.status === "accepted" && !r.seen).length,
      left: Math.max(0, TRADES_PER_DAY - used), perDay: TRADES_PER_DAY, dupes: await dupesOf(me) };
  }
  async function seen(accountId) {
    await db.query("UPDATE wild_trades SET seen = true WHERE from_id = $1 AND status <> 'pending' AND NOT seen", [String(accountId)]);
    return { ok: true };
  }
  // Les doublons d'un ami (pour choisir ce qu'on veut), avec ce qui nous manque encore.
  async function friendDupes(accountId, pid) {
    await ready;
    const other = await friendOf(accountId, pid);
    if (!other) return fail("not_friends", 403);
    // PART-04 : un ami qui a choisi de cacher ses doublons n'en montre aucun.
    const hidden = !await sharesDupes(other);
    return { ok: true, pid, username: await nameOf(other), hidden, dupes: hidden ? [] : await dupesOf(other), mine: await dupesOf(accountId), owned: await owned(accountId) };
  }

  // PART-04 · 🔍 Trouver : les doublons de tous mes amis, en une fois. Rien d'autre de leur album n'est envoyé
  // (ni ce qu'ils possèdent en un seul exemplaire, ni ce qui leur manque) ; un ami qui cache ses doublons,
  // ou un joueur bloqué dans un sens ou dans l'autre, n'apparaît pas.
  async function matches(accountId) {
    await ready;
    const me = String(accountId);
    const rows = (await db.query(`SELECT u.discord_id AS other, u.username,
        EXISTS (SELECT 1 FROM trade_settings s WHERE s.account_id = u.discord_id AND s.share_dupes = false) AS hidden,
        EXISTS (SELECT 1 FROM (SELECT account_id, blocked_id FROM player_blocks UNION ALL
          SELECT account_id, blocked_id FROM player_challenge_blocks WHERE blocked_id <> '*') b
          WHERE (b.account_id = $1 AND b.blocked_id = u.discord_id) OR (b.account_id = u.discord_id AND b.blocked_id = $1)) AS blocked
      FROM player_friends f JOIN users u ON u.discord_id = CASE WHEN f.from_id = $1 THEN f.to_id ELSE f.from_id END
      WHERE f.status = 'accepted' AND (f.from_id = $1 OR f.to_id = $1)
      ORDER BY lower(u.username) LIMIT 100`, [me])).rows.filter((r) => !r.blocked);
    const byKey = new Map(rows.filter((r) => !r.hidden).map((r) => [keyOf(r.other), { pid: playerPid(r.other), username: r.username || "Un dresseur", dupes: [] }]));
    if (byKey.size) {
      const dupes = (await db.query(`SELECT identity, pokemon_id, COUNT(*) FILTER (WHERE NOT shiny)::int AS normal, COUNT(*) FILTER (WHERE shiny)::int AS shiny
        FROM wild_encounters WHERE identity = ANY($1::text[]) AND status = 'caught' GROUP BY identity, pokemon_id
        HAVING COUNT(*) FILTER (WHERE NOT shiny) > 1 OR COUNT(*) FILTER (WHERE shiny) > 1 ORDER BY identity, pokemon_id`, [[...byKey.keys()]])).rows;
      for (const d of dupes) byKey.get(d.identity).dupes.push({ id: Number(d.pokemon_id), normal: Math.max(0, Number(d.normal) - 1), shiny: Math.max(0, Number(d.shiny) - 1) });
    }
    const used = Number((await db.query("SELECT COUNT(*)::int AS n FROM wild_trades WHERE from_id = $1 AND day = $2", [me, today()])).rows[0].n);
    return { ok: true, friends: [...byKey.values()].filter((f) => f.dupes.length), friendCount: rows.length,
      owned: await owned(me), mine: await dupesOf(me), shareDupes: await sharesDupes(me),
      left: Math.max(0, TRADES_PER_DAY - used), perDay: TRADES_PER_DAY };
  }
  async function setShare(accountId, body = {}) {
    await ready;
    if (typeof body.share !== "boolean") return fail("invalid", 400);
    await db.query(`INSERT INTO trade_settings(account_id, share_dupes) VALUES ($1, $2)
      ON CONFLICT (account_id) DO UPDATE SET share_dupes = EXCLUDED.share_dupes, updated_at = now()`, [String(accountId), body.share]);
    return { ok: true, shareDupes: body.share };
  }

  async function propose(accountId, body = {}) {
    await ready;
    const me = String(accountId);
    const give = Number(body.give), want = Number(body.want), shiny = Boolean(body.shiny);
    if (!validId(give) || !validId(want)) return fail("invalid_pokemon", 400);
    if (give === want) return fail("same_pokemon", 400);
    const other = await friendOf(me, body.pid);
    if (!other) return fail("not_friends", 403);
    if (await safety.blockedEither(db, me, other)) return fail("not_friends", 403);
    const day = today();
    if (Number((await db.query("SELECT COUNT(*)::int AS n FROM wild_trades WHERE from_id = $1 AND day = $2", [me, day])).rows[0].n) >= TRADES_PER_DAY) return fail("trade_limit", 429);
    if (Number((await db.query("SELECT COUNT(*)::int AS n FROM wild_trades WHERE from_id = $1 AND status = 'pending'", [me])).rows[0].n) >= PENDING_MAX) return fail("too_many_pending", 429);
    if (await countOf(db, me, give, shiny) < 2) return fail("not_a_duplicate");
    if (!await sharesDupes(other) || await countOf(db, other, want, shiny) < 2) return fail("friend_not_a_duplicate");
    if ((await db.query("SELECT 1 FROM wild_trades WHERE from_id = $1 AND to_id = $2 AND give_id = $3 AND want_id = $4 AND shiny = $5 AND status = 'pending'", [me, other, give, want, shiny])).rowCount) return fail("already_proposed");
    const id = Number((await db.query("INSERT INTO wild_trades(from_id, to_id, give_id, want_id, shiny, day) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [me, other, give, want, shiny, day])).rows[0].id);
    tell(other, { title: "🔁 " + await nameOf(me) + " te propose un échange", body: "Ouvre Pokédle pour voir le Pokémon proposé.", url: "/?echanges=1", tag: "pokedle-echange" });
    return { ok: true, id };
  }

  async function cancel(accountId, body = {}) {
    await ready;
    const r = await db.query("UPDATE wild_trades SET status = 'cancelled', decided_at = now() WHERE id = $1 AND from_id = $2 AND status = 'pending'", [Number(body.id), String(accountId)]);
    return r.rowCount ? { ok: true } : fail("not_found", 404);
  }

  // Répondre : refuser, ou accepter (tout se vérifie de nouveau, dans une seule transaction).
  async function respond(accountId, body = {}) {
    await ready;
    const me = String(accountId), tradeId = Number(body.id);
    if (!Number.isInteger(tradeId)) return fail("not_found", 404);
    if (body.accept === false) {
      const r = await db.query("UPDATE wild_trades SET status = 'declined', decided_at = now() WHERE id = $1 AND to_id = $2 AND status = 'pending'", [tradeId, me]);
      return r.rowCount ? { ok: true, status: "declined" } : fail("not_found", 404);
    }
    const c = await db.connect();
    let trade = null;
    try {
      await c.query("BEGIN");
      trade = (await c.query("SELECT * FROM wild_trades WHERE id = $1 AND to_id = $2 AND status = 'pending' FOR UPDATE", [tradeId, me])).rows[0];
      if (!trade) { await c.query("ROLLBACK"); return fail("not_found", 404); }
      const a = trade.from_id, b = trade.to_id, shiny = Boolean(trade.shiny);
      if (!friends || !await friends.areFriends(a, b)) {
        await c.query("UPDATE wild_trades SET status = 'failed', decided_at = now() WHERE id = $1", [tradeId]); await c.query("COMMIT");
        return fail("not_friends", 403);
      }
      // Les deux joueurs dans le même ordre, pour ne jamais se bloquer mutuellement.
      for (const key of [keyOf(a), keyOf(b)].sort()) await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["balls:" + key]);
      if (await countOf(c, a, Number(trade.give_id), shiny) < 2 || await countOf(c, b, Number(trade.want_id), shiny) < 2) {
        await c.query("UPDATE wild_trades SET status = 'failed', decided_at = now() WHERE id = $1", [tradeId]); await c.query("COMMIT");
        return fail("no_longer_available");
      }
      const day = today();
      const move = async (fromId, toId, pokemonId) => {
        const row = (await c.query("SELECT id FROM wild_encounters WHERE identity = $1 AND status = 'caught' AND pokemon_id = $2 AND shiny = $3 ORDER BY id DESC LIMIT 1", [keyOf(fromId), pokemonId, shiny])).rows[0];
        await c.query("UPDATE wild_encounters SET status = 'traded' WHERE id = $1", [row.id]);
        await c.query(`INSERT INTO wild_encounters(identity, account_id, day, pokemon_id, shiny, status, kind, ended_at)
          VALUES ($1, $2, $3, $4, $5, 'caught', 'trade', now())`, [keyOf(toId), String(toId), day, pokemonId, shiny]);
      };
      await move(a, b, Number(trade.give_id));
      await move(b, a, Number(trade.want_id));
      await c.query("UPDATE wild_trades SET status = 'accepted', decided_at = now() WHERE id = $1", [tradeId]);
      await c.query("COMMIT");
    } catch (error) {
      await c.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { c.release(); }
    tell(trade.from_id, { title: "🔁 " + await nameOf(me) + " a accepté ton échange", body: "Ton nouveau Pokémon t’attend dans ton album.", url: "/?echanges=1", tag: "pokedle-echange" });
    return { ok: true, status: "accepted", received: { id: Number(trade.give_id), shiny: Boolean(trade.shiny) } };
  }

  return { list, seen, friendDupes, matches, setShare, propose, cancel, respond, dupesOf };
}

function mountTradeRoutes(app, { express, trades, getUser, log = console }) {
  const json = express.json({ limit: "1kb" });
  const hits = new Map();
  const limited = (key) => {
    const now = Date.now(), recent = (hits.get(key) || []).filter((t) => now - t < 3600000);
    recent.push(now); hits.set(key, recent); if (hits.size > 5000) hits.clear();
    return recent.length > 120;
  };
  const run = (name, work) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = trades ? getUser(req) : null;
    if (!user || !user.id) return res.status(401).json({ ok: false, error: "login" });
    if (req.method === "POST") {
      let host = "";
      try { host = req.get("origin") ? new URL(req.get("origin")).host : ""; } catch (_e) { host = ""; }
      if (!host || host !== req.get("host")) return res.status(403).json({ ok: false, error: "origin_denied" });
      if (limited(String(user.id))) { res.set("Retry-After", "3600"); return res.status(429).json({ ok: false, error: "rate_limited" }); }
    }
    try {
      const out = await work(user, req.body || {}, req);
      res.status(out && out.ok === false ? out.status || 409 : 200).json(out && out.ok === false ? { ok: false, error: out.error } : out);
    } catch (error) { log.error("[echanges] " + name + ":", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  };
  app.get("/api/trades", run("list", (user) => trades.list(user.id)));
  app.get("/api/trades/friend", run("friend", (user, _b, req) => trades.friendDupes(user.id, String(req.query.pid || ""))));
  app.get("/api/trades/matches", run("matches", (user) => trades.matches(user.id)));
  app.post("/api/trades/settings", json, run("settings", (user, body) => trades.setShare(user.id, { share: body.share })));
  app.post("/api/trades/propose", json, run("propose", (user, body) => trades.propose(user.id, body)));
  app.post("/api/trades/respond", json, run("respond", (user, body) => trades.respond(user.id, { id: body.id, accept: body.accept !== false })));
  app.post("/api/trades/cancel", json, run("cancel", (user, body) => trades.cancel(user.id, body)));
  app.post("/api/trades/seen", json, run("seen", (user) => trades.seen(user.id)));
}

module.exports = { TRADES_PER_DAY, PENDING_MAX, ANSWER_DAYS, KEEP_DAYS, ensureTables, createWildTrades, mountTradeRoutes };
