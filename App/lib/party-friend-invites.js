"use strict";
// 🎉 Inviter un ami en un appui (8/11/2026, « go les 2 »). Dans la Party Room, « Avec qui ? » montre les amis :
// on en touche quelques-uns, et à la création du salon chacun reçoit l'invitation dans le site (carte sur
// l'accueil et dans la Party Room) et, s'il a activé 🔔, une notification. Seulement entre amis.
// Une invitation pointe vers un salon VIVANT : elle disparaît quand le salon n'attend plus de joueurs,
// au bout de 2 heures, ou quand l'ami la ferme. Rien d'autre n'est gardé (pas de pseudo de salon, pas de score).
const KEEP_MINUTES = 120;
const PER_DAY = 40;
const PER_SEND = 10;
const CODE = /^[A-Z0-9]{4,8}$/;
const PARIS_DAY_START = "(date_trunc('day', timezone('Europe/Paris', now())) AT TIME ZONE 'Europe/Paris')";

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS party_friend_invites (
    id BIGSERIAL PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, code TEXT NOT NULL,
    game_mode TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), dismissed BOOLEAN NOT NULL DEFAULT false)`);
  await db.query("CREATE INDEX IF NOT EXISTS party_friend_invites_to ON party_friend_invites(to_id, created_at)");
  await db.query("CREATE INDEX IF NOT EXISTS party_friend_invites_from ON party_friend_invites(from_id, created_at)");
  // Rien ne sert au-delà de quelques heures : on fait le ménage au démarrage.
  await db.query("DELETE FROM party_friend_invites WHERE created_at < now() - interval '2 days'");
}

const GAME_LABELS = Object.freeze({ dessin: "Dessine-le !", dexrace: "Course au Pokédex", coop: "Enquête coop", deduction: "Pokémon mystère",
  quiestce1v1: "Qui est-ce ?", petitbac: "Petit Bac", nearest: "Numéro mystère", guess: "Course Pokémon", typecombo: "Combo de types", lastletter: "Dernière lettre",
  duocriteria: "Duo de critères", statclash: "Meilleure stat", statclashparty: "Stat Clash Party" });

// roomStatus(code) -> { ok, gameMode } : la même réponse que les liens d'invitation (lib/party-invites.js).
function createPartyFriendInvites({ db, friends, accountOfPid, playerPid, roomStatus, push = async () => 0, ready = Promise.resolve(true), log = console }) {
  const tell = (to, payload) => Promise.resolve(push(String(to), payload)).catch((error) => log.warn("[salon] push:", String(error?.message || error).slice(0, 120)));
  const nameOf = async (id) => (await db.query("SELECT username FROM users WHERE discord_id = $1", [String(id)])).rows[0]?.username || "Un dresseur";

  async function send(me, { pids, code } = {}) {
    if (!(await ready)) return { ok: false, error: "unavailable" };
    code = String(code || "").trim().toUpperCase();
    if (!CODE.test(code)) return { ok: false, error: "bad_code" };
    const status = roomStatus(code);
    if (!status || !status.ok) return { ok: false, error: (status && status.errorCode) || "invite_expired" };
    const list = Array.from(new Set((Array.isArray(pids) ? pids : []).map((p) => String(p || "")).filter(Boolean))).slice(0, PER_SEND);
    if (!list.length) return { ok: true, sent: 0 };
    // 9/11/2026 (audit) : compter, chercher un doublon puis insérer se fait sous un verrou par joueur, dans une transaction :
    // deux envois simultanés ne donnent plus deux invitations (ni deux notifications), ni un dépassement du quota.
    const name = await nameOf(me);
    const label = GAME_LABELS[status.gameMode] || "la Party Room";
    const client = typeof db.connect === "function" ? await db.connect() : null;
    const q = (text, params) => (client || db).query(text, params);
    const toTell = [];
    let sent = 0;
    try {
      if (client) { await q("BEGIN"); await q("SELECT pg_advisory_xact_lock(hashtext($1))", ["party-invite:" + String(me)]); }
      const today = Number((await q(`SELECT COUNT(*)::int AS n FROM party_friend_invites WHERE from_id = $1 AND created_at >= ${PARIS_DAY_START}`, [String(me)])).rows[0]?.n) || 0;
      if (today >= PER_DAY) { if (client) await q("ROLLBACK"); return { ok: false, error: "daily_limit" }; }
      for (const pid of list) {
        if (today + sent >= PER_DAY) break;
        const other = await accountOfPid(db, pid);
        if (!other || String(other) === String(me)) continue;
        if (!(await friends.areFriends(me, other))) continue;
        const again = await q(`SELECT 1 FROM party_friend_invites WHERE from_id = $1 AND to_id = $2 AND code = $3
          AND created_at > now() - interval '${KEEP_MINUTES} minutes'`, [String(me), String(other), code]);
        if (again.rows.length) { sent += 1; continue; }
        await q("INSERT INTO party_friend_invites (from_id, to_id, code, game_mode) VALUES ($1, $2, $3, $4)", [String(me), String(other), code, status.gameMode || null]);
        toTell.push(other);
        sent += 1;
      }
      if (client) await q("COMMIT");
    } catch (error) {
      if (client) await q("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      if (client) client.release();
    }
    for (const other of toTell) tell(other, { title: "🎉 " + name + " t’invite à " + label, body: "Son salon t’attend dans la Party Room : rejoins-le maintenant.", url: "/?party=" + encodeURIComponent(code), tag: "pokedle-salon-" + code });
    return { ok: true, sent };
  }

  async function list(me) {
    if (!(await ready)) return { ok: true, invites: [] };
    const { rows } = await db.query(`SELECT i.id, i.from_id, i.code, u.username AS from_name
      FROM party_friend_invites i LEFT JOIN users u ON u.discord_id = i.from_id
      WHERE i.to_id = $1 AND NOT i.dismissed AND i.created_at > now() - interval '${KEEP_MINUTES} minutes'
      ORDER BY i.created_at DESC LIMIT 20`, [String(me)]);
    const seen = new Set(), invites = [];
    for (const row of rows) {
      if (seen.has(row.code)) continue;
      seen.add(row.code);
      const status = roomStatus(row.code);
      if (!status || !status.ok) continue; // le salon a commencé, est plein ou n'existe plus
      if (!(await friends.areFriends(me, row.from_id))) continue;
      invites.push({ id: Number(row.id), code: row.code, gameMode: status.gameMode || null, game: GAME_LABELS[status.gameMode] || "la Party Room",
        from: { pid: playerPid(row.from_id), username: row.from_name || "Un dresseur" } });
    }
    return { ok: true, invites };
  }

  async function dismiss(me, { id } = {}) {
    if (!(await ready)) return { ok: false, error: "unavailable" };
    const n = Number(id);
    if (!Number.isSafeInteger(n) || n <= 0) return { ok: false, error: "bad_id" };
    await db.query("UPDATE party_friend_invites SET dismissed = true WHERE to_id = $1 AND code = (SELECT code FROM party_friend_invites WHERE id = $2 AND to_id = $1)", [String(me), n]);
    return { ok: true };
  }

  return { send, list, dismiss };
}

function createRateLimit(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now(), entry = hits.get(key);
    if (!entry || now - entry.at > windowMs) { hits.set(key, { at: now, n: 1 }); return false; }
    entry.n += 1;
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > windowMs) hits.delete(k);
    return entry.n > limit;
  };
}

function mountPartyInviteRoutes(app, { express, invites, getUser, log = console, limited = createRateLimit(30, 600000), limitedReads = createRateLimit(600, 600000) }) {
  const json = express.json({ limit: "2kb" });
  const run = (name, work, limit) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = invites ? getUser(req) : null;
    if (!user || !user.id) return res.status(401).json({ ok: false, error: "login" });
    if (req.method === "POST") {
      const origin = req.get("origin");
      let host = "";
      try { host = origin ? new URL(origin).host : ""; } catch (_e) { host = ""; }
      if (!origin || host !== req.get("host")) return res.status(403).json({ ok: false, error: "origin_denied" });
    }
    if (limit(String(user.id))) { res.set("Retry-After", "60"); return res.status(429).json({ ok: false, error: "rate_limited" }); }
    try { res.json(await work(user, req.body || {})); }
    catch (error) { log.error("[salon] " + name + ":", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  };
  app.get("/api/party/invites", run("list", (user) => invites.list(user.id), limitedReads));
  app.post("/api/party/invite", json, run("send", (user, body) => invites.send(user.id, { pids: body.pids, code: body.code }), limited));
  app.post("/api/party/invites/dismiss", json, run("dismiss", (user, body) => invites.dismiss(user.id, { id: body.id }), limitedReads));
}

module.exports = { KEEP_MINUTES, PER_DAY, PER_SEND, GAME_LABELS, ensureTables, createPartyFriendInvites, mountPartyInviteRoutes };
