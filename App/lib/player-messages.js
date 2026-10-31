"use strict";

// Messages from the site's creator to signed-in players (31/10/2026). Pokédle keeps no e-mail
// address and has no Discord server, so the creator writes from /admin and the player reads the
// message on the site, in a 📬 window at their next visit, and may answer. A player who turned on
// the 🔔 reminder also gets a notification. Messages and answers are erased after 90 days.

const MESSAGE_MAX = 500;
const REPLY_MAX = 500;
const REPLIES_PER_MESSAGE = 3;
const KEEP_DAYS = 90;
// A message to everyone shows to the players who come back within two weeks.
const BROADCAST_DAYS = 14;

// Keeps line breaks (at most one empty line in a row), drops other control characters.
function cleanText(value, max) {
  const text = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ")
    .split("\n").map((line) => line.replace(/\s+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < 2) return { error: "Le message est trop court." };
  if (text.length > max) return { error: `Le message dépasse ${max} caractères.` };
  return { text };
}

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS player_messages (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS player_messages_account ON player_messages(account_id)");
  await db.query(`CREATE TABLE IF NOT EXISTS player_message_reads (
    message_id BIGINT NOT NULL REFERENCES player_messages(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, account_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS player_message_replies (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES player_messages(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

async function purge(db) {
  await db.query(`DELETE FROM player_messages WHERE created_at < now() - interval '${KEEP_DAYS} days'`);
}

// `to` is an account id, or null for every player who already has an account.
async function sendMessage(db, { to, body }) {
  const checked = cleanText(body, MESSAGE_MAX);
  if (checked.error) return checked;
  if (to != null) {
    const known = await db.query("SELECT 1 FROM users WHERE discord_id = $1", [String(to)]);
    if (!known.rows.length) return { error: "Joueur introuvable." };
  }
  const days = to == null ? BROADCAST_DAYS : KEEP_DAYS;
  const r = await db.query(`INSERT INTO player_messages(account_id, body, expires_at)
    VALUES ($1, $2, now() + interval '${days} days') RETURNING id`, [to == null ? null : String(to), checked.text]);
  return { id: Number(r.rows[0].id) };
}

// A message is for a player when it names them, or when it went to everyone after they signed up.
const FOR_PLAYER = `(m.account_id = $1 OR (m.account_id IS NULL AND EXISTS (
  SELECT 1 FROM users u WHERE u.discord_id = $1 AND u.created_at <= m.created_at)))`;

async function inbox(db, accountId) {
  const r = await db.query(`SELECT m.id, m.body, to_char(m.created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS day
    FROM player_messages m
    WHERE ${FOR_PLAYER} AND m.expires_at > now()
      AND NOT EXISTS (SELECT 1 FROM player_message_reads r WHERE r.message_id = m.id AND r.account_id = $1)
    ORDER BY m.created_at, m.id LIMIT 5`, [String(accountId)]);
  return r.rows.map((row) => ({ id: Number(row.id), body: row.body, day: row.day }));
}

async function visibleTo(db, id, accountId) {
  const r = await db.query(`SELECT 1 FROM player_messages m WHERE m.id = $2 AND m.expires_at > now() AND ${FOR_PLAYER}`, [String(accountId), id]);
  return r.rows.length > 0;
}

async function markRead(db, id, accountId) {
  if (!await visibleTo(db, id, accountId)) return false;
  await db.query("INSERT INTO player_message_reads(message_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, String(accountId)]);
  return true;
}

async function reply(db, id, accountId, body) {
  const checked = cleanText(body, REPLY_MAX);
  if (checked.error) return checked;
  if (!await visibleTo(db, id, accountId)) return { error: "Message introuvable." };
  const count = await db.query("SELECT COUNT(*)::int AS n FROM player_message_replies WHERE message_id = $1 AND account_id = $2", [id, String(accountId)]);
  if (count.rows[0].n >= REPLIES_PER_MESSAGE) return { error: "Tu as déjà répondu à ce message." };
  await db.query("INSERT INTO player_message_replies(message_id, account_id, body) VALUES ($1, $2, $3)", [id, String(accountId), checked.text]);
  await db.query("INSERT INTO player_message_reads(message_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, String(accountId)]);
  return { ok: true };
}

async function removeMessage(db, id) {
  const r = await db.query("DELETE FROM player_messages WHERE id = $1", [id]);
  return r.rowCount || 0;
}

// What the admin page lists: the players to write to, and the messages sent with their answers.
async function adminState(db) {
  await purge(db);
  const players = (await db.query(`SELECT discord_id, username, to_char(last_login AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS seen
    FROM users WHERE username <> '' ORDER BY last_login DESC LIMIT 300`)).rows;
  const messages = (await db.query(`SELECT m.id, m.account_id, m.body, to_char(m.created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS day,
      m.expires_at > now() AS live, u.username,
      (SELECT COUNT(*)::int FROM player_message_reads r WHERE r.message_id = m.id) AS reads
    FROM player_messages m LEFT JOIN users u ON u.discord_id = m.account_id
    ORDER BY m.created_at DESC, m.id DESC LIMIT 30`)).rows;
  const ids = messages.map((m) => m.id);
  const replies = ids.length ? (await db.query(`SELECT p.message_id, p.body, COALESCE(u.username, 'Dresseur') AS username,
      to_char(p.created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS day
    FROM player_message_replies p LEFT JOIN users u ON u.discord_id = p.account_id
    WHERE p.message_id = ANY($1) ORDER BY p.created_at`, [ids])).rows : [];
  return {
    players,
    messages: messages.map((m) => ({
      id: Number(m.id), to: m.account_id, username: m.username, body: m.body, day: m.day, live: m.live, reads: m.reads,
      replies: replies.filter((p) => String(p.message_id) === String(m.id)).map((p) => ({ username: p.username, body: p.body, day: p.day })),
    })),
  };
}

// The notification that tells a player a message is waiting: only for those who turned on 🔔.
async function notify(db, webpush, to, log = console) {
  const rows = (await db.query(to == null
    ? "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE account_id IS NOT NULL"
    : "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE account_id = $1", to == null ? [] : [String(to)])).rows;
  const payload = JSON.stringify({ title: "📬 Un message pour toi", body: "Le créateur de Pokédle t'a écrit. Ouvre le site pour le lire.", url: "/?messages=1", tag: "pokedle-message" });
  let sent = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 86400, urgency: "normal", topic: "pokedle-message" });
      sent += 1;
    } catch (error) {
      if (error && (error.statusCode === 404 || error.statusCode === 410)) await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]);
      else log.warn("[messages] push failed:", String((error && (error.statusCode || error.message)) || error).slice(0, 120));
    }
  }
  return sent;
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const frDay = (day) => String(day || "").split("-").reverse().slice(0, 2).join("/");
const multiline = (text) => escapeHtml(text).replace(/\n/g, "<br>");

function adminSectionHtml(state, pushCount) {
  const options = state.players.map((p) => `<option value="${escapeHtml(p.discord_id)}">${escapeHtml(p.username)} · vu le ${escapeHtml(frDay(p.seen))}</option>`).join("");
  const sent = state.messages.map((m) => {
    const who = m.to == null ? "Tous les joueurs" : escapeHtml(m.username || "Joueur supprimé");
    const read = m.to == null ? `Lu par ${m.reads}` : (m.reads ? "Lu ✓" : "Pas encore lu");
    const answers = m.replies.map((p) => `<div class="answer"><b>${escapeHtml(p.username)}</b> · ${escapeHtml(frDay(p.day))}<br>${multiline(p.body)}</div>`).join("");
    return `<div class="message"><div class="meta">${escapeHtml(frDay(m.day))} → <b>${who}</b> · ${read}${m.live ? "" : " · expiré"}</div><div class="body">${multiline(m.body)}</div>${answers}
<details><summary class="btn ghost">Retirer…</summary><form method="post" action="/admin/messages/remove"><input type="hidden" name="id" value="${m.id}"><button class="danger" type="submit">Oui, retirer ce message</button></form></details></div>`;
  }).join("");
  return `<section id="messages"><h2>Écrire aux joueurs</h2><p class="hint">Le joueur voit ton message dans une fenêtre 📬 à sa prochaine visite (avec un compte), et peut te répondre. Ceux qui ont activé le rappel 🔔 (${Number.isFinite(pushCount) ? pushCount : "—"} en tout) reçoivent aussi une notification. Un message à tous reste visible ${BROADCAST_DAYS} jours. Tout est effacé au bout de ${KEEP_DAYS} jours.</p>
<form method="post" action="/admin/messages">
<label for="message-to">À qui ?</label><select id="message-to" name="to"><option value="">Un joueur…</option><option value="all">Tous les joueurs qui ont un compte</option>${options}</select>
<label for="message-body">Message (${MESSAGE_MAX} caractères max)</label><textarea id="message-body" name="body" maxlength="${MESSAGE_MAX}" rows="5" required placeholder="Salut ! …"></textarea>
<label class="check"><input type="checkbox" name="push" value="1" checked> Prévenir aussi par notification</label>
<div class="row"><button class="primary" type="submit">Envoyer</button></div></form>
<h3>Messages envoyés</h3>${sent || "<p>Aucun message pour l'instant.</p>"}</section>`;
}

function createRateLimit(limit = 10, windowMs = 3600000) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) hits.clear();
    return list.length > limit;
  };
}

// The player's side: read the waiting messages, mark one read, answer it.
function mountPlayerRoutes(app, { express, db, ready, getUser, log = console, limited = createRateLimit() }) {
  const json = express.json({ limit: "4kb" });
  const userOf = (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = getUser(req);
    if (!user) { res.status(401).json({ ok: false, error: "not_signed_in" }); return null; }
    return user;
  };
  const sameOrigin = (req, res) => {
    const origin = req.get("origin");
    let host = "";
    try { host = origin ? new URL(origin).host : ""; } catch (_e) { host = ""; }
    if (!origin || host !== req.get("host")) { res.status(403).json({ ok: false, error: "origin_denied" }); return false; }
    return true;
  };
  const idOf = (req) => {
    const id = Number(req.body && req.body.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };
  const dbReady = async () => Boolean(db) && await ready;

  app.get("/api/messages", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = getUser(req);
    if (!user || !await dbReady()) return res.json({ ok: true, messages: [] });
    try { res.json({ ok: true, messages: await inbox(db, user.id) }); }
    catch (error) { log.error("[messages] inbox:", error.message); res.json({ ok: false, messages: [] }); }
  });

  app.post("/api/messages/read", json, async (req, res) => {
    const user = userOf(req, res);
    if (!user || !sameOrigin(req, res)) return;
    const id = idOf(req);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });
    if (!await dbReady()) return res.status(503).json({ ok: false, error: "unavailable" });
    try { res.json({ ok: await markRead(db, id, user.id) }); }
    catch (error) { log.error("[messages] read:", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  });

  app.post("/api/messages/reply", json, async (req, res) => {
    const user = userOf(req, res);
    if (!user || !sameOrigin(req, res)) return;
    const id = idOf(req);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });
    if (limited(String(user.id))) { res.set("Retry-After", "3600"); return res.status(429).json({ ok: false, error: "rate_limited" }); }
    if (!await dbReady()) return res.status(503).json({ ok: false, error: "unavailable" });
    try {
      const result = await reply(db, id, user.id, req.body && req.body.body);
      if (result.error) return res.status(400).json({ ok: false, error: result.error });
      res.json({ ok: true });
    } catch (error) { log.error("[messages] reply:", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  });
}

module.exports = {
  MESSAGE_MAX, REPLY_MAX, REPLIES_PER_MESSAGE, KEEP_DAYS, BROADCAST_DAYS,
  cleanText, ensureTables, purge, sendMessage, inbox, markRead, reply, removeMessage, adminState, notify,
  adminSectionHtml, mountPlayerRoutes,
};
