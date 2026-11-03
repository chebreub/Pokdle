"use strict";
// Les Balls (PR A de la boucle « jouer → gagner des Balls → attraper », validée le 3/11/2026).
// Le serveur décide de tout : une Ball par source et par jour (jour de Paris), 10 par jour au
// plus. Les jeux du jour (Pokémon du jour, Wordle, Dossier, Défi, parcours 4/4) sont vérifiés
// dans leurs tables ; les autres modes sont déclarés en fin de partie, comme leurs classements.
// Sans compte, les Balls sont gardées sous l'identité invitée et passent sur le compte à la connexion.
const crypto = require("node:crypto");
const { dailyCalendar, dailyGuest, issueDailyGuest } = require("./daily-game");
const { HISTORY_TO_LAUNCH } = require("./usage-metrics");

const DAILY_CAP = 10;
const BALLS = Object.freeze(["poke", "great", "ultra"]);
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });

// Super Ball (« l'or ») pour une belle partie ; sinon une Poké Ball. Score = celui du classement
// du mode quand il en a un, sinon le nombre d'essais.
const GUESS = (most) => ({ result, score }) => result === "win" && score >= 1 && score <= most;
const AT_LEAST = (least) => ({ score }) => score >= least;
const GOLD = Object.freeze({
  normal: GUESS(6), mystery: GUESS(6),
  silhouette: GUESS(3), pixel: GUESS(3), cry: GUESS(3), description: GUESS(3), evolution: GUESS(3), order: GUESS(3),
  quiestce: GUESS(8),
  quiz: AT_LEAST(12), speedrun: AT_LEAST(25), "higher-lower": AT_LEAST(15), "higher-lower-rush": AT_LEAST(25),
  odd: AT_LEAST(10), weight: AT_LEAST(10), petitbac: AT_LEAST(6), shiny: AT_LEAST(20),
  "poke-connections": ({ result, score }) => result === "win" && score >= 4
});
// Les jeux du jour passent par leur propre vérification, pas par une déclaration du navigateur.
const ARCADE = Object.freeze(Object.keys(HISTORY_TO_LAUNCH).filter((mode) => !["daily", "challenge"].includes(mode)));

function arcadeGain(mode, result, score) {
  mode = String(mode || "");
  if (!ARCADE.includes(mode)) throw fail("unknown_mode", 400);
  if (!["win", "loss"].includes(result)) throw fail("invalid_result", 400);
  const n = Number(score);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw fail("invalid_score", 400);
  const gold = GOLD[mode];
  return { source: "mode:" + HISTORY_TO_LAUNCH[mode], ball: gold && gold({ result, score: n }) ? "great" : "poke" };
}

async function initBallsDb(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS ball_gains(
    identity TEXT NOT NULL, day DATE NOT NULL, source TEXT NOT NULL, ball TEXT NOT NULL,
    account_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(identity,day,source))`);
  await db.query("CREATE INDEX IF NOT EXISTS ball_gains_identity ON ball_gains(identity)");
}

function createBallService({ db, clock = () => new Date() }) {
  const lock = (c, key) => c.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["balls:" + key]);
  async function tx(fn) {
    const c = await db.connect();
    try { await c.query("BEGIN"); const out = await fn(c); await c.query("COMMIT"); return out; }
    catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
    finally { c.release(); }
  }
  // Les Balls gagnées sans compte rejoignent le compte ; une source déjà gagnée sur le compte ce jour-là n'est pas doublée.
  async function adopt(c, who) {
    if (!who.accountId || who.guestKey === who.key) return;
    await lock(c, who.guestKey);
    await c.query(`INSERT INTO ball_gains(identity,day,source,ball,account_id,created_at)
      SELECT $2,day,source,ball,$3,created_at FROM ball_gains WHERE identity=$1 ON CONFLICT DO NOTHING`, [who.guestKey, who.key, who.accountId]);
    await c.query("DELETE FROM ball_gains WHERE identity=$1", [who.guestKey]);
  }
  async function grant(c, who, day, gains) {
    const added = [];
    for (const g of gains) {
      const count = Number((await c.query("SELECT COUNT(*)::int AS n FROM ball_gains WHERE identity=$1 AND day=$2", [who.key, day])).rows[0].n);
      if (count >= DAILY_CAP) break;
      const row = (await c.query("INSERT INTO ball_gains(identity,day,source,ball,account_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING source,ball",
        [who.key, day, g.source, g.ball, who.accountId || null])).rows[0];
      if (row) added.push(row);
    }
    return added;
  }
  // Ce que les jeux du jour ont déjà rapporté, lu dans leurs propres tables.
  async function dailyGains(c, who, day) {
    // Un jeu du jour pas encore prêt (table absente) ne bloque pas les autres : point de sauvegarde par lecture.
    const one = async (sql) => {
      await c.query("SAVEPOINT ball_read");
      try { const row = (await c.query(sql, [who.key, day])).rows[0] || null; await c.query("RELEASE SAVEPOINT ball_read"); return row; }
      catch (_e) { await c.query("ROLLBACK TO SAVEPOINT ball_read"); return null; }
    };
    const enquete = await one("SELECT status FROM daily_plays WHERE identity=$1 AND day=$2");
    const wordle = await one("SELECT status FROM wordle_plays WHERE identity=$1 AND day=$2");
    const dossier = await one("SELECT status,points FROM dossier_plays WHERE identity=$1 AND day=$2");
    const challenge = await one("SELECT status,points FROM challenge_plays WHERE identity=$1 AND day=$2");
    const done = (row) => row && !["ready", "playing"].includes(row.status);
    const gains = [];
    if (enquete?.status === "won") gains.push({ source: "daily", ball: "poke" });
    if (wordle?.status === "won") gains.push({ source: "wordle", ball: "poke" });
    if (dossier?.status === "completed") gains.push({ source: "dossier", ball: Number(dossier.points) >= 20 ? "great" : "poke" });
    if (challenge?.status === "completed") gains.push({ source: "challenge", ball: Number(challenge.points) >= 25 ? "great" : "poke" });
    if (done(enquete) && done(wordle) && done(dossier) && ["completed", "abandoned"].includes(challenge?.status)) gains.push({ source: "journey", ball: "great" });
    return gains;
  }
  async function state(c, who, day, added = []) {
    const today = (await c.query("SELECT source,ball FROM ball_gains WHERE identity=$1 AND day=$2 ORDER BY created_at,source", [who.key, day])).rows;
    const bag = Object.fromEntries(BALLS.map((b) => [b, 0]));
    for (const r of (await c.query("SELECT ball,COUNT(*)::int AS n FROM ball_gains WHERE identity=$1 GROUP BY ball", [who.key])).rows) if (r.ball in bag) bag[r.ball] = Number(r.n);
    const cal = dailyCalendar(clock());
    return { ok: true, day, resetAt: cal.resetAt, cap: DAILY_CAP, today: today.length, gains: today, added, bag,
      giftAvailable: today.length < DAILY_CAP && !today.some((g) => g.source === "gift"), authenticated: Boolean(who.accountId) };
  }
  // Chaque appel commence par récupérer les Balls dues par les jeux du jour : rien ne se perd si une requête a échoué.
  const run = (who, extra) => tx(async (c) => {
    const day = dailyCalendar(clock()).day;
    await adopt(c, who);
    await lock(c, who.key);
    const extraGains = extra ? await extra(c, day) : [];
    const added = await grant(c, who, day, [...extraGains, ...await dailyGains(c, who, day)]);
    return state(c, who, day, added);
  });
  return {
    state: (who) => run(who),
    gift: (who) => run(who, async () => [{ source: "gift", ball: "poke" }]),
    earn: (who, body) => run(who, async () => [arcadeGain(body.mode, body.result, body.score)])
  };
}

function mountBallRoutes({ app, express, db, secret, getUser, readCookies, readyBefore = Promise.resolve(), clock }) {
  const service = db && secret ? createBallService({ db, clock }) : null;
  const ready = service ? readyBefore.then(() => initBallsDb(db)).then(() => true).catch((e) => { console.error("[balls] init:", e.message); return false; }) : Promise.resolve(false);
  const buckets = new Map();
  function rate(key, limit, now) {
    if (buckets.size > 10000) for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
    const b = buckets.get(key);
    if (b && b.until > now) { if (++b.count > limit) throw fail("rate_limited", 429); }
    else buckets.set(key, { count: 1, until: now + 60000 });
  }
  const handle = (action) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!service || !await ready) return res.status(503).json({ ok: false, error: "unavailable" });
    try {
      if (req.method === "POST") {
        if (!req.is("application/json")) throw fail("json_required", 415);
        const origin = req.get("origin"); if (origin && new URL(origin).host !== req.get("host")) throw fail("origin_denied", 403);
      }
      let id = dailyGuest(secret, readCookies(req).pokdle_daily);
      if (!id) { const issued = issueDailyGuest(secret); id = issued.id; res.cookie("pokdle_daily", issued.cookie, { httpOnly: true, secure: req.secure, sameSite: "lax", path: "/", maxAge: 180 * 86400000 }); }
      const user = getUser(req), who = { key: user?.id ? "user:" + user.id : "guest:" + id, guestKey: "guest:" + id, accountId: user?.id ? String(user.id) : null };
      const ip = crypto.createHmac("sha256", secret).update("balls-ip:" + String(req.ip)).digest("hex");
      rate("ip:" + ip, 120, Date.now()); rate("id:" + who.key, 40, Date.now());
      res.json(await action(who, req));
    } catch (e) {
      if (!e.status) console.error("[balls] request:", e.message);
      if (e.status === 429) res.set("Retry-After", "60");
      res.status(e.status || 503).json({ ok: false, error: e.status ? e.code : "unavailable" });
    }
  };
  app.get("/api/balls", handle((who) => service.state(who)));
  app.post("/api/balls/gift", express.json({ limit: "1kb" }), handle((who) => service.gift(who)));
  app.post("/api/balls/earn", express.json({ limit: "1kb" }), handle((who, req) => service.earn(who, req.body || {})));
  return service;
}

module.exports = { DAILY_CAP, BALLS, GOLD, ARCADE, arcadeGain, initBallsDb, createBallService, mountBallRoutes };
