"use strict";
// ⚔️ Défi par lien (11/11/2026, maquette validée par Kayan : « go défi »).
// Un joueur connecté crée un défi, joue sa « série de 10 » et partage un lien pokdle.fr/d/<jeton>.
// Chacun peut le relever, même sans compte et plus tard : mêmes 10 Pokémon, mêmes générations, chaque
// essai vérifié par le serveur avec la logique existante (lib/player-challenge-series.js) — aucun nouveau jeu.
// Plusieurs personnes peuvent relever le même lien : classement du défi (trouvés, puis essais).
// Une tentative par personne : identité de compte ou d'invité (cookie signé pokdle_daily), et au plus
// quelques tentatives par réseau sur un même défi. Ça ne prétend pas empêcher un changement de navigateur.
// Les blocages existants (player_blocks, player_challenge_blocks) sont respectés entre comptes.
// Tables à part (link_duels, link_duel_entries) : les défis entre amis ne changent pas, et l'historique
// des duels (victoires, défaites, classement compétitif) pourra s'appuyer dessus plus tard.
const crypto = require("node:crypto");
const series = require("./player-challenge-series");
const { dailyGuest, issueDailyGuest } = require("./daily-game");

const DAYS = 7;               // un lien reste ouvert 7 jours après la série du créateur
const DRAFT_HOURS = 24;       // une série commencée mais pas finie par le créateur expire au bout d'un jour
const PER_DAY = 20;           // défis créés par compte sur 24 h
const MAX_ENTRIES = 200;      // participants par défi
const PER_NETWORK = 3;        // tentatives d'invités par réseau et par défi
const BOARD = 20;             // lignes du classement envoyées
const TOKEN_RE = /^[A-Za-z0-9_-]{8,16}$/;

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS link_duels (
    id BIGSERIAL PRIMARY KEY, token TEXT NOT NULL UNIQUE, creator_id TEXT NOT NULL,
    series_ids JSONB NOT NULL, series_gens INTEGER[] NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
    rematch_of BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), opened_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL)`);
  await db.query("CREATE INDEX IF NOT EXISTS link_duels_creator ON link_duels(creator_id, created_at)");
  await db.query(`CREATE TABLE IF NOT EXISTS link_duel_entries (
    duel_id BIGINT NOT NULL REFERENCES link_duels(id) ON DELETE CASCADE, identity TEXT NOT NULL,
    account_id TEXT, name TEXT NOT NULL, net TEXT, progress JSONB NOT NULL,
    found INTEGER NOT NULL DEFAULT 0, attempts_won INTEGER NOT NULL DEFAULT 0, done BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), finished_at TIMESTAMPTZ, PRIMARY KEY(duel_id, identity))`);
  await db.query("CREATE UNIQUE INDEX IF NOT EXISTS link_duel_entries_account ON link_duel_entries(duel_id, account_id) WHERE account_id IS NOT NULL");
  await db.query("CREATE INDEX IF NOT EXISTS link_duel_entries_identity ON link_duel_entries(identity)");
}

// Un pseudo d'invité : lettres, chiffres, espaces, - _ . ; 2 à 16 caractères ; jamais un lien ni un @.
function guestName(value) {
  const name = String(value || "").normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 16);
  return /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,15}$/u.test(name) ? name : "Invité";
}

// Les essais d'une manche en cours, avec les mêmes pastilles que le Pokémon du jour (comme publicView).
function roundRows(player, secretIds, byId, compare) {
  if (!player || player.index >= series.TOTAL) return [];
  const secret = byId.get(Number(secretIds[player.index]));
  if (!secret) return [];
  const direction = (a, b) => (a === b ? "" : a < b ? "↑" : "↓");
  const gen = (p) => Number(p.gen || p.generation);
  return player.guesses.map((id) => {
    const p = byId.get(Number(id));
    if (!p) return null;
    return { pokemonId: Number(id), cmp: compare(p, secret), generationDirection: direction(gen(p), gen(secret)),
      heightDirection: direction(Number(p.height), Number(secret.height)), weightDirection: direction(Number(p.weight), Number(secret.weight)) };
  }).filter(Boolean);
}

function createLinkDuels({ db, pokemon = [], compare, secret, ready = Promise.resolve(true), nameOf = async () => "Un dresseur",
  blocked = async () => false, push = async () => 0, now = () => new Date(), randomInt = crypto.randomInt, log = console } = {}) {
  const byId = new Map(pokemon.map((p) => [Number(p.id), p]));
  const netKey = (ip) => crypto.createHmac("sha256", String(secret || "")).update("duel-net:" + String(ip || "")).digest("hex").slice(0, 24);
  const isReady = async () => Boolean(db && compare && await ready);

  async function duelByToken(token, client = db, lock = false) {
    if (!TOKEN_RE.test(String(token || ""))) return null;
    return (await client.query("SELECT * FROM link_duels WHERE token = $1" + (lock ? " FOR UPDATE" : ""), [String(token)])).rows[0] || null;
  }
  const expired = (duel) => new Date(duel.expires_at) <= now();
  const stateOf = (duel) => (duel.status === "draft" ? (expired(duel) ? "expired" : "draft") : expired(duel) ? "closed" : "open");

  // Un invité qui se connecte retrouve ses défis : ses lignes passent sur son compte (sauf s'il avait déjà joué ce défi avec son compte).
  async function claim(who) {
    if (!who.accountId || !who.guestKey || who.guestKey === who.key) return 0;
    const moved = await db.query(`UPDATE link_duel_entries e SET identity = $2, account_id = $3
      WHERE e.identity = $1 AND NOT EXISTS (SELECT 1 FROM link_duel_entries o WHERE o.duel_id = e.duel_id AND (o.identity = $2 OR o.account_id = $3))`,
      [who.guestKey, who.key, who.accountId]);
    return moved.rowCount || 0;
  }

  async function board(duelId, who) {
    const rows = (await db.query(`SELECT identity, account_id, name, found, attempts_won, finished_at FROM link_duel_entries
      WHERE duel_id = $1 AND done ORDER BY found DESC, attempts_won ASC, finished_at ASC LIMIT $2`, [duelId, BOARD])).rows;
    const total = Number((await db.query("SELECT COUNT(*)::int AS n FROM link_duel_entries WHERE duel_id = $1 AND done", [duelId])).rows[0].n);
    return { total, rows: rows.map((r, i) => ({ rank: i + 1, name: r.name, found: Number(r.found), attempts: Number(r.attempts_won), me: r.identity === who.key })) };
  }

  function gameView(duel, entry) {
    const p = entry.progress;
    return { index: p.index, total: series.TOTAL, max: series.MAX_TRIES, attempts: p.guesses.length, found: Number(entry.found),
      attemptsWon: Number(entry.attempts_won), done: Boolean(entry.done), rounds: p.rounds.map((r) => ({ won: r.won, tries: r.tries })),
      rows: entry.done ? [] : roundRows(p, duel.series_ids, byId, compare) };
  }

  async function view(token, who) {
    if (!await isReady()) return { ok: false, error: "unavailable" };
    await claim(who).catch(() => 0);
    const duel = await duelByToken(token);
    if (!duel) return { ok: false, error: "not_found" };
    const isCreator = who.accountId && String(duel.creator_id) === String(who.accountId);
    const state = stateOf(duel);
    if (state === "draft" && !isCreator) return { ok: false, error: "not_ready" };
    const creator = (await db.query("SELECT found, attempts_won, done FROM link_duel_entries WHERE duel_id = $1 AND identity = $2", [duel.id, "user:" + duel.creator_id])).rows[0];
    const entry = who.key ? (await db.query("SELECT * FROM link_duel_entries WHERE duel_id = $1 AND identity = $2", [duel.id, who.key])).rows[0] : null;
    const count = Number((await db.query("SELECT COUNT(*)::int AS n FROM link_duel_entries WHERE duel_id = $1", [duel.id])).rows[0].n);
    const isBlocked = !entry && !isCreator && who.accountId ? await blocked(duel.creator_id, who.accountId).catch(() => false) : false;
    const base = { ok: true, token: duel.token, state, gens: duel.series_gens, total: series.TOTAL, max: series.MAX_TRIES,
      expiresAt: new Date(duel.expires_at).toISOString(), creator: { name: await nameOf(duel.creator_id), found: creator ? Number(creator.found) : 0,
        attempts: creator ? Number(creator.attempts_won) : 0, done: Boolean(creator?.done) },
      isCreator: Boolean(isCreator), signedIn: Boolean(who.accountId),
      canPlay: !entry && !isCreator && state === "open" && !isBlocked && count < MAX_ENTRIES,
      blocked: Boolean(isBlocked), full: !entry && count >= MAX_ENTRIES };
    if (entry) base.game = gameView(duel, entry);
    if (entry?.done || state !== "draft") base.board = await board(duel.id, who);
    return base;
  }

  async function create(accountId, { rematchOf } = {}) {
    if (!await isReady()) return { ok: false, error: "unavailable" };
    const id = String(accountId || "");
    if (!id) return { ok: false, error: "login" };
    prune().catch(() => {});
    const recent = Number((await db.query("SELECT COUNT(*)::int AS n FROM link_duels WHERE creator_id = $1 AND created_at > NOW() - INTERVAL '24 hours'", [id])).rows[0].n);
    if (recent >= PER_DAY) return { ok: false, error: "daily_limit", limit: PER_DAY };
    const ids = series.pickSeries(pokemon, series.DEFAULT_GENS, randomInt);
    if (!ids) return { ok: false, error: "unavailable" };
    const previous = rematchOf ? await duelByToken(rematchOf) : null;
    const name = await nameOf(id);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      let duel = null;
      for (let i = 0; i < 5 && !duel; i++) {
        const token = crypto.randomBytes(8).toString("base64url").slice(0, 10);
        duel = (await client.query(`INSERT INTO link_duels(token, creator_id, series_ids, series_gens, rematch_of, expires_at)
          VALUES ($1, $2, $3::jsonb, $4, $5, NOW() + make_interval(hours => $6)) ON CONFLICT (token) DO NOTHING RETURNING *`,
          [token, id, JSON.stringify(ids), series.DEFAULT_GENS, previous ? previous.id : null, DRAFT_HOURS])).rows[0] || null;
      }
      if (!duel) throw new Error("token");
      await client.query(`INSERT INTO link_duel_entries(duel_id, identity, account_id, name, progress) VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [duel.id, "user:" + id, id, name, JSON.stringify(series.newProgress().from)]);
      await client.query("COMMIT");
      return { ok: true, token: duel.token };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async function start(token, who, { name, ip } = {}) {
    if (!await isReady()) return { ok: false, error: "unavailable" };
    if (!who.key) return { ok: false, error: "identity" };
    await claim(who).catch(() => 0);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const duel = await duelByToken(token, client, true);
      if (!duel) { await client.query("ROLLBACK"); return { ok: false, error: "not_found" }; }
      const mine = (await client.query("SELECT 1 FROM link_duel_entries WHERE duel_id = $1 AND (identity = $2 OR ($3::text IS NOT NULL AND account_id = $3))",
        [duel.id, who.key, who.accountId])).rowCount;
      if (mine) { await client.query("COMMIT"); return { ok: true, already: true }; }
      if (stateOf(duel) !== "open") { await client.query("ROLLBACK"); return { ok: false, error: stateOf(duel) === "draft" ? "not_ready" : "closed" }; }
      if (who.accountId && String(duel.creator_id) === String(who.accountId)) { await client.query("ROLLBACK"); return { ok: false, error: "own" }; }
      if (who.accountId && await blocked(duel.creator_id, who.accountId).catch(() => false)) { await client.query("ROLLBACK"); return { ok: false, error: "blocked" }; }
      const count = Number((await client.query("SELECT COUNT(*)::int AS n FROM link_duel_entries WHERE duel_id = $1", [duel.id])).rows[0].n);
      if (count >= MAX_ENTRIES) { await client.query("ROLLBACK"); return { ok: false, error: "full" }; }
      const net = netKey(ip);
      if (!who.accountId) {
        const fromNet = Number((await client.query("SELECT COUNT(*)::int AS n FROM link_duel_entries WHERE duel_id = $1 AND net = $2 AND account_id IS NULL", [duel.id, net])).rows[0].n);
        if (fromNet >= PER_NETWORK) { await client.query("ROLLBACK"); return { ok: false, error: "network_limit" }; }
      }
      const display = who.accountId ? await nameOf(who.accountId) : guestName(name);
      await client.query(`INSERT INTO link_duel_entries(duel_id, identity, account_id, name, net, progress) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [duel.id, who.key, who.accountId, display, net, JSON.stringify(series.newProgress().from)]);
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error && error.code === "23505") return { ok: true, already: true };
      throw error;
    } finally { client.release(); }
  }

  async function play(token, who, { round, pokemonId, pass } = {}) {
    if (!await isReady()) return { ok: false, error: "unavailable" };
    if (!who.key) return { ok: false, error: "identity" };
    const client = await db.connect();
    let finished = null, duel = null;
    try {
      await client.query("BEGIN");
      duel = await duelByToken(token, client);
      if (!duel) { await client.query("ROLLBACK"); return { ok: false, error: "not_found" }; }
      const entry = (await client.query("SELECT * FROM link_duel_entries WHERE duel_id = $1 AND identity = $2 FOR UPDATE", [duel.id, who.key])).rows[0];
      if (!entry) { await client.query("ROLLBACK"); return { ok: false, error: "not_started" }; }
      const isCreator = String(entry.account_id || "") === String(duel.creator_id);
      // Le créateur joue avant que le lien ne s'ouvre ; les autres tant que le défi est ouvert.
      const st = stateOf(duel);
      if (!entry.done && (isCreator ? st !== "draft" : st !== "open")) {
        await client.query("ROLLBACK"); return { ok: false, error: "closed" };
      }
      const state = { p: entry.progress };
      const move = series.advance(state, "p", Number(round), pokemonId, pass === true, duel.series_ids, byId, duel.series_gens);
      if (move.error) { await client.query("ROLLBACK"); return { ok: false, error: move.error }; }
      if (move.changed) {
        const p = state.p;
        await client.query(`UPDATE link_duel_entries SET progress = $3::jsonb, found = $4, attempts_won = $5, done = $6,
          finished_at = CASE WHEN $6 AND finished_at IS NULL THEN NOW() ELSE finished_at END WHERE duel_id = $1 AND identity = $2`,
          [duel.id, who.key, JSON.stringify(p), p.found, p.attemptsWon, p.done]);
        if (p.done && !entry.done) {
          finished = { isCreator, name: entry.name, found: p.found, attempts: p.attemptsWon };
          if (isCreator && duel.status === "draft") {
            await client.query("UPDATE link_duels SET status = 'open', opened_at = NOW(), expires_at = NOW() + make_interval(days => $2) WHERE id = $1", [duel.id, DAYS]);
          }
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
    if (finished && !finished.isCreator) {
      const creator = (await db.query("SELECT found, attempts_won FROM link_duel_entries WHERE duel_id = $1 AND identity = $2", [duel.id, "user:" + duel.creator_id])).rows[0];
      const beat = creator && series.scoreCompare({ found: finished.found, attemptsWon: finished.attempts }, { found: Number(creator.found), attemptsWon: Number(creator.attempts_won) }) > 0;
      push(duel.creator_id, { title: beat ? `🏆 ${finished.name} a battu ton défi` : `⚔️ ${finished.name} a relevé ton défi`,
        body: `${finished.found}/10 contre ${creator ? creator.found : "?"}/10. Regarde le classement !`, url: "/d/" + duel.token, tag: "pokedle-duel-" + duel.token })
        .catch((e) => log.warn("[duels] push:", String(e && e.message || e).slice(0, 120)));
    }
    return { ...(await view(token, who)), fresh: Boolean(finished) };
  }

  // « Mes défis par lien » : ceux que j'ai créés et ceux que j'ai relevés (les plus récents).
  async function mine(who) {
    if (!await isReady()) return { ok: false, error: "unavailable" };
    await claim(who).catch(() => 0);
    if (!who.key) return { ok: true, duels: [] };
    const rows = (await db.query(`SELECT d.token, d.status, d.expires_at, d.creator_id, e.found, e.attempts_won, e.done,
        (SELECT COUNT(*)::int FROM link_duel_entries x WHERE x.duel_id = d.id AND x.done) AS players
      FROM link_duel_entries e JOIN link_duels d ON d.id = e.duel_id WHERE e.identity = $1 ORDER BY e.started_at DESC LIMIT 30`, [who.key])).rows;
    return { ok: true, duels: rows.map((r) => ({ token: r.token, state: stateOf(r), mine: String(r.creator_id) === String(who.accountId || ""),
      found: Number(r.found), attempts: Number(r.attempts_won), done: r.done, players: Number(r.players) })) };
  }

  // Aperçu des messageries : le score du créateur, rien d'autre (jamais les Pokémon).
  async function preview(token) {
    if (!await isReady()) return null;
    const duel = await duelByToken(token);
    if (!duel || duel.status !== "open") return null;
    const creator = (await db.query("SELECT found, attempts_won FROM link_duel_entries WHERE duel_id = $1 AND identity = $2", [duel.id, "user:" + duel.creator_id])).rows[0];
    if (!creator) return null;
    const players = Number((await db.query("SELECT COUNT(*)::int AS n FROM link_duel_entries WHERE duel_id = $1 AND done", [duel.id])).rows[0].n);
    return { token: duel.token, name: await nameOf(duel.creator_id), found: Number(creator.found), attempts: Number(creator.attempts_won), players, closed: expired(duel) };
  }

  async function prune() {
    // Gardés 30 jours après leur fin, comme les défis entre joueurs.
    await db.query("DELETE FROM link_duels WHERE expires_at < NOW() - INTERVAL '30 days'");
  }

  return { view, create, start, play, mine, preview, claim, prune, guestName };
}

function previewTexts({ name, found, players, closed }) {
  const who = String(name || "Un dresseur").slice(0, 24);
  return {
    title: closed ? `Défi de ${who} : ${found} Pokémon sur 10` : `${who} te défie : ${found} Pokémon sur 10. Tu fais mieux ?`,
    description: (players > 1 ? `${players} joueurs l'ont déjà relevé. ` : "") +
      "Les mêmes 10 Pokémon mystère pour tous, avec les indices du Pokémon du jour. Gratuit, sans inscription.",
  };
}

function duelPageHtml(html, data) {
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const { title, description } = previewTexts(data);
  const meta = (attribute, key, value) => {
    const pattern = new RegExp(`(<meta ${attribute}="${key}" content=")[^"]*(")`);
    html = html.replace(pattern, (_m, a, b) => a + esc(value) + b);
  };
  meta("property", "og:title", title);
  meta("property", "og:description", description);
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", description);
  meta("property", "og:image", "https://pokdle.fr/img/og/defi-lien.jpg");
  meta("name", "twitter:image", "https://pokdle.fr/img/og/defi-lien.jpg");
  if (data.token) meta("property", "og:url", "https://pokdle.fr/d/" + data.token);
  return duelShell(html);
}

// La page vit sous /d/<jeton> : ses fichiers (dist/…) sont cherchés depuis la racine, et Google ne l'indexe pas.
function duelShell(html) {
  return html.replace(/<head>/i, '<head>\n  <base href="/">').replace('<link rel="canonical"', '<meta name="robots" content="noindex">\n  <link rel="canonical"');
}

function mountLinkDuelRoutes(app, { express, duels, getUser, readCookies, secret, log = console, limited, limitedPlay }) {
  const json = express.json({ limit: "2kb" });
  const hits = (limit, windowMs) => { const m = new Map(); return (key) => { const t = Date.now(); const r = (m.get(key) || []).filter((x) => t - x < windowMs); r.push(t); m.set(key, r); if (m.size > 5000) m.clear(); return r.length > limit; }; };
  limited = limited || hits(40, 3600000);
  limitedPlay = limitedPlay || hits(400, 3600000);
  // Même identité que les Balls et les jeux vérifiés : compte, sinon invité (cookie signé, créé au besoin).
  const who = (req, res, issue) => {
    let guest = dailyGuest(secret, readCookies(req).pokdle_daily);
    if (!guest && issue) {
      const issued = issueDailyGuest(secret);
      guest = issued.id;
      res.cookie("pokdle_daily", issued.cookie, { httpOnly: true, secure: req.secure, sameSite: "lax", path: "/", maxAge: 180 * 86400000 });
    }
    const user = getUser(req);
    return { key: user?.id ? "user:" + user.id : guest ? "guest:" + guest : "", guestKey: guest ? "guest:" + guest : "", accountId: user?.id ? String(user.id) : null };
  };
  const sameOrigin = (req) => { try { return Boolean(req.get("origin")) && new URL(req.get("origin")).host === req.get("host"); } catch (_e) { return false; } };
  const run = (name, work, { post = false, limit = limited, issue = false } = {}) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!duels) return res.status(503).json({ ok: false, error: "unavailable" });
    if (post && !sameOrigin(req)) return res.status(403).json({ ok: false, error: "origin_denied" });
    const w = who(req, res, issue);
    if (post && limit(w.key || req.ip)) { res.set("Retry-After", "3600"); return res.status(429).json({ ok: false, error: "rate_limited" }); }
    try { res.json(await work(w, req.body || {}, req)); }
    catch (error) { log.error("[duels] " + name + ":", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  };
  app.post("/api/duels", json, run("create", (w, body) => w.accountId ? duels.create(w.accountId, { rematchOf: body.rematchOf }) : { ok: false, error: "login" }, { post: true }));
  app.get("/api/duels", run("mine", (w) => duels.mine(w)));
  app.get("/api/duels/:token", run("view", (w, _b, req) => duels.view(req.params.token, w)));
  app.post("/api/duels/:token/start", json, run("start", (w, body, req) => duels.start(req.params.token, w, { name: body.name, ip: req.ip }), { post: true, issue: true }));
  app.post("/api/duels/:token/play", json, run("play", (w, body, req) => duels.play(req.params.token, w, body), { post: true, limit: limitedPlay }));
}

module.exports = { duelShell, DAYS, PER_DAY, MAX_ENTRIES, PER_NETWORK, ensureTables, createLinkDuels, mountLinkDuelRoutes, duelPageHtml, previewTexts, guestName, TOKEN_RE };
