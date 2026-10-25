"use strict";

// The « Donne ton avis » box: a player sends an idea, a bug or an opinion. Only what they
// typed is stored, with the screen they were on: no e-mail, account, IP or device id.
// Messages are read on the private /admin/stats page and kept 90 days.
const KINDS = Object.freeze({ idea: "Idée", bug: "Bug", opinion: "Avis" });
const MESSAGE_MIN = 5;
const MESSAGE_MAX = 1000;
const PSEUDO_MAX = 60;
const CONTEXT_MAX = 80;
const KEEP_DAYS = 90;
const PER_HOUR = 5;

// Control characters out (newlines and tabs stay in a message), spaces trimmed.
const clean = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
const oneLine = (value) => clean(value).replace(/\s+/g, " ");

function validateFeedback(body) {
  if (!body || typeof body !== "object") return { error: "invalid" };
  // A field people never see: only robots fill it in.
  if (oneLine(body.website)) return { spam: true };
  if (!Object.hasOwn(KINDS, body.kind)) return { error: "kind" };
  const message = clean(body.message).replace(/\r\n?/g, "\n");
  if (message.length < MESSAGE_MIN) return { error: "too_short" };
  if (message.length > MESSAGE_MAX) return { error: "too_long" };
  return {
    kind: body.kind,
    message,
    pseudo: oneLine(body.pseudo).slice(0, PSEUDO_MAX),
    context: oneLine(body.context).replace(/[^\p{L}\p{N} ·:_-]/gu, "").slice(0, CONTEXT_MAX),
  };
}

async function ensureTable(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS feedback_messages (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    pseudo TEXT NOT NULL DEFAULT '',
    context TEXT NOT NULL DEFAULT ''
  )`);
}
async function prune(db) {
  await db.query(`DELETE FROM feedback_messages WHERE created_at < now() - interval '${KEEP_DAYS} days'`);
}
async function save(db, entry) {
  await prune(db);
  await db.query("INSERT INTO feedback_messages(kind, message, pseudo, context) VALUES ($1, $2, $3, $4)",
    [entry.kind, entry.message, entry.pseudo, entry.context]);
}
async function recent(db, limit = 50) {
  await prune(db);
  const result = await db.query("SELECT created_at, kind, message, pseudo, context FROM feedback_messages ORDER BY created_at DESC, id DESC LIMIT $1", [limit]);
  return result.rows;
}

// At most PER_HOUR messages an hour from one address, kept in memory only.
function createRateLimit(now = () => Date.now()) {
  const seen = new Map();
  return function limited(key) {
    const t = now();
    const list = (seen.get(key) || []).filter((at) => t - at < 3600000);
    const over = list.length >= PER_HOUR;
    if (!over) list.push(t);
    seen.set(key, list);
    if (seen.size > 5000) seen.clear();
    return over;
  };
}

// POST /api/feedback. `ready` resolves to true once the table exists.
function mountFeedbackRoutes(app, { express, db, ready, limited = createRateLimit(), log = console }) {
  app.post("/api/feedback", express.json({ limit: "8kb" }), async (req, res) => {
    res.set("Cache-Control", "no-store");
    let sameSite = true;
    try { sameSite = !req.get("origin") || new URL(req.get("origin")).host === req.get("host"); } catch (_error) { sameSite = false; }
    if (!sameSite) return res.status(403).json({ ok: false, error: "origin_denied" });
    const entry = validateFeedback(req.body);
    // Robots get the same answer as people, so they do not learn about the trap.
    if (entry.spam) return res.json({ ok: true });
    if (entry.error) return res.status(400).json({ ok: false, error: entry.error });
    if (limited(req.ip || "?")) return res.status(429).json({ ok: false, error: "rate_limited" });
    if (!db || !(await ready)) return res.status(503).json({ ok: false, error: "unavailable" });
    try {
      await save(db, entry);
      res.json({ ok: true });
    } catch (error) {
      log.error("[feedback] save failed:", String(error.message || error).slice(0, 160));
      res.status(503).json({ ok: false, error: "unavailable" });
    }
  });
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const parisTime = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// The private stats page section. Every field comes from a player: always escaped.
function feedbackSectionHtml(rows) {
  const items = (rows || []).map((row) => `<tr><td>${escapeHtml(parisTime.format(new Date(row.created_at)))}</td><td>${escapeHtml(KINDS[row.kind] || row.kind)}</td>` +
    `<td style="white-space:pre-wrap;max-width:520px">${escapeHtml(row.message)}</td><td>${escapeHtml(row.pseudo || "—")}</td><td>${escapeHtml(row.context || "—")}</td></tr>`).join("");
  return `<h2 style="margin-top:24px">Messages des joueurs (« Donne ton avis », ${KEEP_DAYS} derniers jours)</h2>` +
    (items ? `<table><thead><tr><th>Date</th><th>Type</th><th>Message</th><th>Pseudo</th><th>Écran</th></tr></thead><tbody>${items}</tbody></table>`
      : "<p>Aucun message pour l'instant.</p>");
}

module.exports = { KINDS, MESSAGE_MAX, PSEUDO_MAX, KEEP_DAYS, PER_HOUR, validateFeedback, ensureTable, prune, save, recent, createRateLimit, mountFeedbackRoutes, feedbackSectionHtml };
