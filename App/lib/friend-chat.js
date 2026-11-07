"use strict";
// Discussion entre amis (01/11/2026, option B, 2e PR) : two friends (lib/player-friends.js, both
// accepted) can write to each other, 200 characters at a time. No word filter for now (Kayan: « plus
// tard, y a pas grand monde »); one guard only: no links, addresses, numbers or other apps' names, so
// nobody is drawn away from the site (many players are children). « Signaler » sends the last
// messages of the conversation to the creator's /admin; « Bloquer » ends the friendship (and so the
// chat). Messages are erased after 30 days, reports after 90, everything with the account.
const MAX_LEN = 200;
const safety = require("./social-safety");
const KEEP_DAYS = 30;
const REPORT_KEEP_DAYS = 90;
const PER_10_MIN = 30;
const REPORTS_PER_DAY = 5;
const PUSH_GAP_MINUTES = 10;
const PARIS_DAY_START = "(date_trunc('day', timezone('Europe/Paris', now())) AT TIME ZONE 'Europe/Paris')";

// Links, e-mail addresses, @pseudos, phone numbers and the names of other messaging apps.
const CONTACT_PATTERNS = [
  /https?:\/\//i,
  /\bwww\s*\./i,
  /\b[a-z0-9-]+\.[a-z]{2,24}\b/i,
  /\b[a-z0-9-]+\s*(\.|\(\s*\.\s*\)|\[\s*\.\s*\]|\b(point|dot)\b)\s*(com|fr|net|org|gg|io|xyz|ly|tv|be|app|dev|site|online|info|zip|eu)\b/i,
  /[\w.+-]+@[\w-]+\.[\w.]+/,
  /(^|[\s(])@[\w.]{3,}/,
  /(\p{Nd}[\p{P}\p{S}\p{Z}\s]*){6,}/u,
  /\b(snap(chat)?|insta(gram)?|ig|whats?\s?app|wh?ats?ap+|telegram|tiktok|tik\s?tok|discord|kik|facebook|fb|messenger|twitter|wechat|skype)\b/i,
];
// V2-SOC-01 (8/11) : the same guard is used by the Party Room chat (lib/party-chat.js).
function hasContact(text) {
  // Check a canonical copy; preserve the player's accents and emoji in the stored message.
  const flat = String(text == null ? "" : text).normalize("NFKD").replace(/[\p{Default_Ignorable_Code_Point}\p{M}]/gu, "");
  if (CONTACT_PATTERNS.some((re) => re.test(flat))) return true;
  return /\b(?:s[\s._-]*n[\s._-]*a[\s._-]*p|d[\s._-]*i[\s._-]*s[\s._-]*c[\s._-]*o[\s._-]*r[\s._-]*d|i[\s._-]*n[\s._-]*s[\s._-]*t[\s._-]*a)\b/i.test(flat);
}
function checkBody(raw) {
  const body = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) return { error: "empty" };
  if ([...body].length > MAX_LEN) return { error: "long" };
  if (hasContact(body)) return { error: "contact" };
  return { body };
}

async function ensureTables(db) {
  await safety.ensureTables(db);
  await db.query(`CREATE TABLE IF NOT EXISTS friend_messages (
    id BIGSERIAL PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ)`);
  await db.query("CREATE INDEX IF NOT EXISTS friend_messages_pair ON friend_messages (LEAST(from_id, to_id), GREATEST(from_id, to_id), id)");
  await db.query("CREATE INDEX IF NOT EXISTS friend_messages_unread ON friend_messages (to_id) WHERE read_at IS NULL");
  // 🗑 Supprimer (4/11/2026) : « pour tout le monde » (l'auteur seulement : « Message supprimé » des deux côtés)
  // ou « pour moi » (caché de ma discussion seulement). Le texte reste en base jusqu'aux 30 jours : un
  // signalement copie toujours les vrais messages, pour protéger les plus jeunes.
  await db.query("ALTER TABLE friend_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ");
  await db.query("ALTER TABLE friend_messages ADD COLUMN IF NOT EXISTS hidden_from BOOLEAN NOT NULL DEFAULT false");
  await db.query("ALTER TABLE friend_messages ADD COLUMN IF NOT EXISTS hidden_to BOOLEAN NOT NULL DEFAULT false");
  // A report keeps a copy of the last messages: the conversation itself goes after 30 days.
  await db.query(`CREATE TABLE IF NOT EXISTS friend_reports (
    id BIGSERIAL PRIMARY KEY, reporter_id TEXT NOT NULL, reported_id TEXT NOT NULL,
    excerpt JSONB NOT NULL DEFAULT '[]'::jsonb, status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), done_at TIMESTAMPTZ)`);
}

const iso = (column) => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
const pairWhere = "LEAST(from_id, to_id) = LEAST($1::text, $2::text) AND GREATEST(from_id, to_id) = GREATEST($1::text, $2::text)";
// Ce que $1 voit encore : pas les messages qu'il a supprimés « pour moi ».
const visibleTo = "NOT (CASE WHEN from_id = $1 THEN hidden_from ELSE hidden_to END)";
const COLS = (iso) => `id, from_id, body, deleted_at IS NOT NULL AS deleted, ${iso("created_at")} AS created_at`;

function createFriendChat({ db, friends, accountOfPid, playerPid, push = async () => 0, ready = Promise.resolve(true), log = console }) {
  const nameOf = async (id) => (await db.query("SELECT username FROM users WHERE discord_id = $1", [String(id)])).rows[0]?.username || "Un dresseur";
  const tell = (to, payload) => Promise.resolve(push(String(to), payload)).catch((error) => log.warn("[chat] push:", String(error?.message || error).slice(0, 120)));
  async function target(accountId, pid) {
    const me = String(accountId);
    const other = typeof pid === "string" && /^[0-9a-f]{16}$/.test(pid) ? await accountOfPid(db, pid) : null;
    if (!other) return { me, error: "unknown" };
    if (other === me) return { me, error: "self" };
    return { me, other };
  }
  const view = (row, me) => ({ id: Number(row.id), mine: row.from_id === me, body: row.deleted ? "" : row.body, at: row.created_at, ...(row.deleted ? { deleted: true } : {}) });
  async function purge() {
    await db.query("DELETE FROM friend_messages WHERE created_at < now() - make_interval(days => $1)", [KEEP_DAYS]);
    await db.query("DELETE FROM friend_reports WHERE created_at < now() - make_interval(days => $1)", [REPORT_KEEP_DAYS]);
  }

  async function send(accountId, { pid, body } = {}) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: false, error: t.error };
    const { me, other } = t;
    if (!await friends.areFriends(me, other)) return { ok: false, error: "not_friends" };
    if (!await safety.discussionAllowed(db, me, other)) return { ok: false, error: "discussion_unavailable" };
    const checked = checkBody(body);
    if (checked.error) return { ok: false, error: checked.error };
    const recent = Number((await db.query("SELECT count(*)::int AS n FROM friend_messages WHERE from_id = $1 AND created_at > now() - interval '10 minutes'", [me])).rows[0].n);
    if (recent >= PER_10_MIN) return { ok: false, error: "limit" };
    // One notification at a time: none while an earlier message of mine waits unread (10 min).
    const waiting = (await db.query(`SELECT 1 FROM friend_messages WHERE from_id = $1 AND to_id = $2 AND read_at IS NULL
      AND created_at > now() - make_interval(mins => $3) LIMIT 1`, [me, other, PUSH_GAP_MINUTES])).rowCount > 0;
    const row = (await db.query(`INSERT INTO friend_messages(from_id, to_id, body) VALUES ($1, $2, $3)
      RETURNING ${COLS(iso)}`, [me, other, checked.body])).rows[0];
    if (!waiting) {
      const name = await nameOf(me);
      tell(other, { title: "💬 " + name, body: [...checked.body].slice(0, 120).join(""), url: "/?chat=" + playerPid(me), tag: "pokedle-chat-" + playerPid(me) });
    }
    return { ok: true, message: view(row, me) };
  }

  // The conversation with one friend: the last 60 messages, or those after a given id (polling).
  async function thread(accountId, { pid, after } = {}) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: false, error: t.error };
    const { me, other } = t;
    const areFriends = await friends.areFriends(me, other);
    const canSend = areFriends && await safety.discussionAllowed(db, me, other);
    const since = Number(after);
    const rows = Number.isSafeInteger(since) && since > 0
      ? (await db.query(`SELECT ${COLS(iso)} FROM friend_messages WHERE ${pairWhere} AND ${visibleTo} AND id > $3
          AND created_at > now() - make_interval(days => $4) ORDER BY id LIMIT 60`, [me, other, since, KEEP_DAYS])).rows
      : (await db.query(`SELECT * FROM (SELECT ${COLS(iso)} FROM friend_messages WHERE ${pairWhere} AND ${visibleTo}
          AND created_at > now() - make_interval(days => $3) ORDER BY id DESC LIMIT 60) last ORDER BY id`, [me, other, KEEP_DAYS])).rows;
    // Pendant que la fenêtre est ouverte : les messages supprimés depuis peu (« Message supprimé » chez l'autre aussi).
    const deleted = Number.isSafeInteger(since) && since > 0
      ? (await db.query(`SELECT id FROM friend_messages WHERE ${pairWhere} AND deleted_at > now() - interval '5 minutes'`, [me, other])).rows.map((r) => Number(r.id))
      : [];
    await db.query("UPDATE friend_messages SET read_at = now() WHERE to_id = $1 AND from_id = $2 AND read_at IS NULL", [me, other]);
    return { ok: true, friends: areFriends, canSend, messages: rows.map((row) => view(row, me)), deleted };
  }

  // For the friends list: the last message and the unread count of each conversation.
  async function conversations(accountId) {
    await ready;
    const me = String(accountId);
    await purge();
    const rows = (await db.query(`SELECT DISTINCT ON (other) other, id, from_id, body, deleted_at IS NOT NULL AS deleted, ${iso("created_at")} AS created_at,
        (SELECT count(*)::int FROM friend_messages u WHERE u.to_id = $1 AND u.from_id = m.other AND u.read_at IS NULL AND u.deleted_at IS NULL AND NOT u.hidden_to) AS unread
      FROM (SELECT *, CASE WHEN from_id = $1 THEN to_id ELSE from_id END AS other FROM friend_messages WHERE (from_id = $1 OR to_id = $1) AND ${visibleTo}) m
      ORDER BY other, id DESC`, [me])).rows;
    const out = {};
    let unread = 0;
    for (const row of rows) {
      const isFriend = await friends.areFriends(me, row.other);
      out[playerPid(row.other)] = { last: view(row, me), unread: Number(row.unread) || 0, friends: isFriend, username: await nameOf(row.other) };
      unread += Number(row.unread) || 0;
    }
    return { ok: true, unread, conversations: out };
  }

  async function report(accountId, { pid } = {}) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: false, error: t.error };
    const { me, other } = t;
    const today = Number((await db.query(`SELECT count(*)::int AS n FROM friend_reports WHERE reporter_id = $1 AND created_at >= ${PARIS_DAY_START}`, [me])).rows[0].n);
    if (today >= REPORTS_PER_DAY) return { ok: false, error: "limit" };
    // Les vrais messages, même supprimés ou cachés : c'est ce que l'admin doit pouvoir lire.
    const rows = (await db.query(`SELECT * FROM (SELECT id, from_id, body, deleted_at, ${iso("created_at")} AS created_at FROM friend_messages WHERE ${pairWhere}
      AND created_at > now() - make_interval(days => $3) ORDER BY id DESC LIMIT 30) last ORDER BY id`, [me, other, KEEP_DAYS])).rows;
    if (!rows.length) return { ok: false, error: "no_messages" };
    const excerpt = rows.map((row) => ({ by: row.from_id === me ? "reporter" : "reported", body: row.body, at: row.created_at, ...(row.deleted_at ? { deleted: true } : {}) }));
    await db.query("INSERT INTO friend_reports(reporter_id, reported_id, excerpt) VALUES ($1, $2, $3)", [me, other, JSON.stringify(excerpt)]);
    return { ok: true };
  }

  // 🗑 Un message : « all » = le mien, supprimé pour nous deux ; « me » = n'importe lequel, caché chez moi seulement.
  async function remove(accountId, { pid, id, scope } = {}) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: false, error: t.error };
    const { me, other } = t;
    const mid = Number(id);
    if (!Number.isSafeInteger(mid) || mid <= 0 || !["all", "me"].includes(scope)) return { ok: false, error: "invalid" };
    const res = scope === "all"
      ? await db.query(`UPDATE friend_messages SET deleted_at = COALESCE(deleted_at, now()) WHERE id = $3 AND from_id = $1 AND to_id = $2`, [me, other, mid])
      : await db.query(`UPDATE friend_messages SET hidden_from = hidden_from OR from_id = $1, hidden_to = hidden_to OR to_id = $1
          WHERE id = $3 AND ${pairWhere}`, [me, other, mid]);
    return res.rowCount ? { ok: true } : { ok: false, error: "not_found" };
  }
  // 🧹 Effacer la discussion (pour moi) : tout ce qui est là disparaît de ma fenêtre ; l'ami garde la sienne.
  async function clear(accountId, { pid } = {}) {
    await ready;
    const t = await target(accountId, pid);
    if (t.error) return { ok: false, error: t.error };
    const { me, other } = t;
    const res = await db.query(`UPDATE friend_messages SET hidden_from = hidden_from OR from_id = $1, hidden_to = hidden_to OR to_id = $1,
      read_at = CASE WHEN to_id = $1 THEN COALESCE(read_at, now()) ELSE read_at END WHERE ${pairWhere}`, [me, other]);
    return { ok: true, cleared: res.rowCount };
  }

  return { send, thread, conversations, report, remove, clear };
}

// /admin : the reports, with the copied messages, and « Traité ».
async function adminReports(db) {
  return (await db.query(`SELECT r.id, r.reporter_id, r.reported_id, r.excerpt, r.status, ${iso("r.created_at")} AS created_at,
      a.username AS reporter_name, b.username AS reported_name
    FROM friend_reports r LEFT JOIN users a ON a.discord_id = r.reporter_id LEFT JOIN users b ON b.discord_id = r.reported_id
    ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 40`)).rows;
}
async function resolveReport(db, id) {
  await db.query("UPDATE friend_reports SET status = 'done', done_at = now() WHERE id = $1", [Number(id)]);
}
function adminSectionHtml(reports, escapeHtml) {
  const open = reports.filter((r) => r.status === "open").length;
  // Paris time, like everywhere for Kayan.
  const day = (value) => {
    const d = new Date(value);
    return isNaN(d) ? "" : new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  };
  const items = reports.map((r) => {
    const lines = (Array.isArray(r.excerpt) ? r.excerpt : []).map((m) =>
      `<li><b>${escapeHtml(m.by === "reporter" ? r.reporter_name || "?" : r.reported_name || "?")}</b> · <small>${escapeHtml(day(m.at))}${m.deleted ? " · 🗑 supprimé par son auteur" : ""}</small><br>${escapeHtml(m.body)}</li>`).join("");
    return `<details${r.status === "open" ? " open" : ""}><summary>${r.status === "open" ? "🚩" : "✓"} ${escapeHtml(day(r.created_at))} · <b>${escapeHtml(r.reporter_name || "?")}</b> signale <b>${escapeHtml(r.reported_name || "?")}</b> <small>(compte ${escapeHtml(r.reported_id)})</small></summary>
<ol class="hint">${lines || "<li>Aucun message dans la discussion.</li>"}</ol>
${suspensionForm(r.reported_id, escapeHtml)}
${r.status === "open" ? `<form method="post" action="/admin/reports/done"><input type="hidden" name="id" value="${Number(r.id)}"><button class="btn" type="submit">Traité</button></form>` : ""}</details>`;
  }).join("");
  return `<section><h2>Signalements${open ? ` (${open} à lire)` : ""}</h2><p class="hint">Quand un joueur signale un ami, ses 30 derniers messages arrivent ici. Tu peux suspendre la discussion du joueur signalé, puis marquer le signalement comme traité. Gardé 90 jours.</p>${items || "<p>Aucun signalement.</p>"}</section>`;
}

function suspensionForm(id, escapeHtml) {
  return `<form method="post" action="/admin/chat/suspension" class="row">
    <input type="hidden" name="accountId" value="${escapeHtml(id)}">
    <label>Discussion <select name="days"><option value="1">Suspendre 24 h</option><option value="7">Suspendre 7 jours</option><option value="30">Suspendre 30 jours</option><option value="-1">Suspendre sans date de fin</option><option value="0">Rétablir</option></select></label>
    <label>Motif privé <input name="reason" maxlength="300" placeholder="Facultatif"></label>
    <button class="btn" type="submit">Appliquer</button></form>`;
}
async function suspensionSectionHtml(db, escapeHtml) {
  const rows = (await db.query(`SELECT s.account_id, s.until_at, s.reason, u.username FROM chat_suspensions s
    LEFT JOIN users u ON u.discord_id = s.account_id WHERE s.until_at IS NULL OR s.until_at > now() ORDER BY s.updated_at DESC`)).rows;
  return `<section><h2>Suspendre la discussion</h2><p class="hint">Coupe les messages privés et les messages libres des défis. Le joueur peut toujours jouer, lire et signaler. Les suspensions temporaires se lèvent automatiquement.</p>
    <form method="post" action="/admin/chat/suspension" class="row"><label>Identifiant du compte <input name="accountId" required></label>
    <label>Durée <select name="days"><option value="1">24 heures</option><option value="7">7 jours</option><option value="30">30 jours</option><option value="-1">Sans date de fin</option><option value="0">Rétablir</option></select></label>
    <label>Motif privé <input name="reason" maxlength="300"></label><button class="btn" type="submit">Appliquer</button></form>
    ${rows.map((r) => `<details><summary>${escapeHtml(r.username || r.account_id)} · ${r.until_at ? 'jusqu’au ' + escapeHtml(new Date(r.until_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })) : 'sans date de fin'}</summary><p>${escapeHtml(r.reason)}</p>${suspensionForm(r.account_id, escapeHtml)}</details>`).join('') || '<p>Aucune suspension en cours.</p>'}</section>`;
}

function createRateLimit(limit, windowMs) {
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

function mountChatRoutes(app, { express, chat, getUser, log = console, limited = createRateLimit(120, 600000), limitedReads = createRateLimit(600, 600000) }) {
  const json = express.json({ limit: "2kb" });
  const run = (name, work, limit) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = chat ? getUser(req) : null;
    if (!user || !user.id) return res.status(401).json({ ok: false, error: "login" });
    if (req.method === "POST") {
      const origin = req.get("origin");
      let host = "";
      try { host = origin ? new URL(origin).host : ""; } catch (_e) { host = ""; }
      if (!origin || host !== req.get("host")) return res.status(403).json({ ok: false, error: "origin_denied" });
    }
    if (limit(String(user.id))) { res.set("Retry-After", "60"); return res.status(429).json({ ok: false, error: "rate_limited" }); }
    try { res.json(await work(user, req.body || {}, req)); }
    catch (error) { log.error("[chat] " + name + ":", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  };
  app.get("/api/chat", run("list", (user) => chat.conversations(user.id), limitedReads));
  app.get("/api/chat/thread", run("thread", (user, _b, req) => chat.thread(user.id, { pid: String(req.query.pid || ""), after: req.query.after }), limitedReads));
  app.post("/api/chat/send", json, run("send", (user, body) => chat.send(user.id, { pid: body.pid, body: body.body }), limited));
  app.post("/api/chat/report", json, run("report", (user, body) => chat.report(user.id, { pid: body.pid }), limited));
  app.post("/api/chat/delete", json, run("delete", (user, body) => chat.remove(user.id, { pid: body.pid, id: body.id, scope: body.scope }), limited));
  app.post("/api/chat/clear", json, run("clear", (user, body) => chat.clear(user.id, { pid: body.pid }), limited));
}

module.exports = { MAX_LEN, KEEP_DAYS, REPORT_KEEP_DAYS, checkBody, hasContact, ensureTables, createFriendChat, adminReports, resolveReport, adminSectionHtml, suspensionSectionHtml, mountChatRoutes };
