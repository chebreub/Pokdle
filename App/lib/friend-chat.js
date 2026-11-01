"use strict";
// Discussion entre amis (01/11/2026, option B, 2e PR) : two friends (lib/player-friends.js, both
// accepted) can write to each other, 200 characters at a time. No word filter for now (Kayan: « plus
// tard, y a pas grand monde »); one guard only: no links, addresses, numbers or other apps' names, so
// nobody is drawn away from the site (many players are children). « Signaler » sends the last
// messages of the conversation to the creator's /admin; « Bloquer » ends the friendship (and so the
// chat). Messages are erased after 30 days, reports after 90, everything with the account.
const MAX_LEN = 200;
const KEEP_DAYS = 30;
const REPORT_KEEP_DAYS = 90;
const PER_10_MIN = 30;
const REPORTS_PER_DAY = 5;
const PUSH_GAP_MINUTES = 10;
const PARIS_DAY_START = "(date_trunc('day', timezone('Europe/Paris', now())) AT TIME ZONE 'Europe/Paris')";

// Links, e-mail addresses, @pseudos, phone numbers and the names of other messaging apps.
const CONTACT_PATTERNS = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]{2,}(\.|\s?\(\.\)\s?|\s?\[\.\]\s?|\s(point|dot)\s)(com|fr|net|org|gg|io|xyz|ly|tv|be)\b/i,
  /[\w.+-]+@[\w-]+\.[\w.]+/,
  /(^|[\s(])@[\w.]{3,}/,
  /(\d[\s.\-_/]*){6,}/,
  /\b(snap(chat)?|insta(gram)?|ig|whats?\s?app|wh?ats?ap+|telegram|tiktok|tik\s?tok|discord|kik|facebook|fb|messenger|twitter|wechat|skype)\b/i,
];
function checkBody(raw) {
  const body = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) return { error: "empty" };
  if ([...body].length > MAX_LEN) return { error: "long" };
  const flat = body.normalize("NFKC");
  if (CONTACT_PATTERNS.some((re) => re.test(flat))) return { error: "contact" };
  return { body };
}

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS friend_messages (
    id BIGSERIAL PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ)`);
  await db.query("CREATE INDEX IF NOT EXISTS friend_messages_pair ON friend_messages (LEAST(from_id, to_id), GREATEST(from_id, to_id), id)");
  await db.query("CREATE INDEX IF NOT EXISTS friend_messages_unread ON friend_messages (to_id) WHERE read_at IS NULL");
  // A report keeps a copy of the last messages: the conversation itself goes after 30 days.
  await db.query(`CREATE TABLE IF NOT EXISTS friend_reports (
    id BIGSERIAL PRIMARY KEY, reporter_id TEXT NOT NULL, reported_id TEXT NOT NULL,
    excerpt JSONB NOT NULL DEFAULT '[]'::jsonb, status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), done_at TIMESTAMPTZ)`);
}

const iso = (column) => `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
const pairWhere = "LEAST(from_id, to_id) = LEAST($1::text, $2::text) AND GREATEST(from_id, to_id) = GREATEST($1::text, $2::text)";

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
  const view = (row, me) => ({ id: Number(row.id), mine: row.from_id === me, body: row.body, at: row.created_at });
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
    const checked = checkBody(body);
    if (checked.error) return { ok: false, error: checked.error };
    const recent = Number((await db.query("SELECT count(*)::int AS n FROM friend_messages WHERE from_id = $1 AND created_at > now() - interval '10 minutes'", [me])).rows[0].n);
    if (recent >= PER_10_MIN) return { ok: false, error: "limit" };
    // One notification at a time: none while an earlier message of mine waits unread (10 min).
    const waiting = (await db.query(`SELECT 1 FROM friend_messages WHERE from_id = $1 AND to_id = $2 AND read_at IS NULL
      AND created_at > now() - make_interval(mins => $3) LIMIT 1`, [me, other, PUSH_GAP_MINUTES])).rowCount > 0;
    const row = (await db.query(`INSERT INTO friend_messages(from_id, to_id, body) VALUES ($1, $2, $3)
      RETURNING id, from_id, body, ${iso("created_at")} AS created_at`, [me, other, checked.body])).rows[0];
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
    if (!areFriends) return { ok: true, friends: false, messages: [] };
    const since = Number(after);
    const rows = Number.isSafeInteger(since) && since > 0
      ? (await db.query(`SELECT id, from_id, body, ${iso("created_at")} AS created_at FROM friend_messages WHERE ${pairWhere} AND id > $3 ORDER BY id LIMIT 60`, [me, other, since])).rows
      : (await db.query(`SELECT * FROM (SELECT id, from_id, body, ${iso("created_at")} AS created_at FROM friend_messages WHERE ${pairWhere}
          AND created_at > now() - make_interval(days => $3) ORDER BY id DESC LIMIT 60) last ORDER BY id`, [me, other, KEEP_DAYS])).rows;
    await db.query("UPDATE friend_messages SET read_at = now() WHERE to_id = $1 AND from_id = $2 AND read_at IS NULL", [me, other]);
    return { ok: true, friends: true, messages: rows.map((row) => view(row, me)) };
  }

  // For the friends list: the last message and the unread count of each conversation.
  async function conversations(accountId) {
    await ready;
    const me = String(accountId);
    await purge();
    const rows = (await db.query(`SELECT DISTINCT ON (other) other, id, from_id, body, ${iso("created_at")} AS created_at,
        (SELECT count(*)::int FROM friend_messages u WHERE u.to_id = $1 AND u.from_id = m.other AND u.read_at IS NULL) AS unread
      FROM (SELECT *, CASE WHEN from_id = $1 THEN to_id ELSE from_id END AS other FROM friend_messages WHERE from_id = $1 OR to_id = $1) m
      ORDER BY other, id DESC`, [me])).rows;
    const out = {};
    let unread = 0;
    for (const row of rows) {
      if (!await friends.areFriends(me, row.other)) continue;
      out[playerPid(row.other)] = { last: view(row, me), unread: Number(row.unread) || 0 };
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
    const rows = (await db.query(`SELECT * FROM (SELECT id, from_id, body, ${iso("created_at")} AS created_at FROM friend_messages WHERE ${pairWhere}
      ORDER BY id DESC LIMIT 30) last ORDER BY id`, [me, other])).rows;
    const excerpt = rows.map((row) => ({ by: row.from_id === me ? "reporter" : "reported", body: row.body, at: row.created_at }));
    await db.query("INSERT INTO friend_reports(reporter_id, reported_id, excerpt) VALUES ($1, $2, $3)", [me, other, JSON.stringify(excerpt)]);
    return { ok: true };
  }

  return { send, thread, conversations, report };
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
      `<li><b>${escapeHtml(m.by === "reporter" ? r.reporter_name || "?" : r.reported_name || "?")}</b> · <small>${escapeHtml(day(m.at))}</small><br>${escapeHtml(m.body)}</li>`).join("");
    return `<details${r.status === "open" ? " open" : ""}><summary>${r.status === "open" ? "🚩" : "✓"} ${escapeHtml(day(r.created_at))} · <b>${escapeHtml(r.reporter_name || "?")}</b> signale <b>${escapeHtml(r.reported_name || "?")}</b> <small>(compte ${escapeHtml(r.reported_id)})</small></summary>
<ol class="hint">${lines || "<li>Aucun message dans la discussion.</li>"}</ol>
${r.status === "open" ? `<form method="post" action="/admin/reports/done"><input type="hidden" name="id" value="${Number(r.id)}"><button class="btn" type="submit">Traité</button></form>` : ""}</details>`;
  }).join("");
  return `<section><h2>Signalements${open ? ` (${open} à lire)` : ""}</h2><p class="hint">Quand un joueur signale un ami, ses 30 derniers messages arrivent ici. Pour agir : « Pseudo déplacé » plus bas, ou écrire au joueur. Gardé 90 jours.</p>${items || "<p>Aucun signalement.</p>"}</section>`;
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
}

module.exports = { MAX_LEN, KEEP_DAYS, REPORT_KEEP_DAYS, checkBody, ensureTables, createFriendChat, adminReports, resolveReport, adminSectionHtml, mountChatRoutes };
