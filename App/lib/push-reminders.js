"use strict";
// « 🔔 Me rappeler le Pokémon du jour » : one browser notification a day, at the hour the
// player chose, and none once today's Pokémon is found or given up. Players opt in from a
// button: the site never asks for the permission on its own.
const crypto = require("node:crypto");
const { parisDay } = require("./egg-mystery");
const { dailyGuest, streakFromDays } = require("./daily-game");

const HOURS = [8, 12, 18, 20];
// A notification left unread past this delay is dropped by the push service.
const TTL_SECONDS = 4 * 3600;
// The server only ever posts to the browsers' own push services, never to an address a
// visitor could point at something else.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/,
  /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/, /^android\.googleapis\.com$/];
const KEY_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

function parisHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(now));
}

function reminderMessage(streak) {
  const title = "🔍 Le Pokémon du jour t'attend";
  return streak >= 2
    ? { title, body: `Ta série de ${streak} jours continue si tu le trouves avant minuit.` }
    : { title, body: "Un nouveau Pokémon mystère est à trouver aujourd'hui." };
}

function pushHostAllowed(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((pattern) => pattern.test(url.hostname));
  } catch (_e) { return false; }
}

function validateSubscription(body) {
  const sub = body && body.subscription, keys = sub && sub.keys, hour = Number(body && body.hour);
  if (!sub || typeof sub.endpoint !== "string" || sub.endpoint.length > 1000 || !pushHostAllowed(sub.endpoint)) return null;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length > 200 || keys.auth.length > 64 || !KEY_PATTERN.test(keys.p256dh) || !KEY_PATTERN.test(keys.auth)) return null;
  if (!HOURS.includes(hour)) return null;
  return { endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth, hour };
}

async function ensureTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23), guest_key TEXT, account_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_sent DATE
  )`);
  await db.query("CREATE INDEX IF NOT EXISTS push_subscriptions_hour ON push_subscriptions(hour)");
  // The server's own signing keys. Kept in the database unless Render provides them, so
  // turning the feature on needs no setting, and subscriptions and keys live and go together.
  await db.query(`CREATE TABLE IF NOT EXISTS push_keys (
    id SMALLINT PRIMARY KEY CHECK (id = 1), public_key TEXT NOT NULL, private_key TEXT NOT NULL
  )`);
}

async function vapidKeys(db, env, generate) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const read = async () => (await db.query("SELECT public_key, private_key FROM push_keys WHERE id = 1")).rows[0];
  let row = await read();
  if (!row) {
    const fresh = generate();
    await db.query("INSERT INTO push_keys(id, public_key, private_key) VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING", [fresh.publicKey, fresh.privateKey]);
    row = await read();
  }
  return { publicKey: row.public_key, privateKey: row.private_key };
}

// Turned on during the chosen hour itself: the first reminder waits for the next day
// instead of arriving a minute later.
async function saveSubscription(db, sub, who, now = new Date()) {
  const quietDay = parisHour(now) === sub.hour ? parisDay(now) : null;
  await db.query(`INSERT INTO push_subscriptions(endpoint, p256dh, auth, hour, guest_key, account_id, last_sent)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, hour = EXCLUDED.hour,
      guest_key = COALESCE(EXCLUDED.guest_key, push_subscriptions.guest_key),
      account_id = COALESCE(EXCLUDED.account_id, push_subscriptions.account_id),
      last_sent = GREATEST(push_subscriptions.last_sent, EXCLUDED.last_sent)`,
  [sub.endpoint, sub.p256dh, sub.auth, sub.hour, who.guestKey, who.accountId, quietDay]);
}

async function deleteSubscription(db, endpoint) {
  await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [String(endpoint || "").slice(0, 1000)]);
}

async function countActive(db) {
  return Number((await db.query("SELECT count(*)::int AS n FROM push_subscriptions")).rows[0].n);
}

// The same identities the daily game records: the guest cookie and the account.
const PLAYED_BY = `(p.identity = s.guest_key OR (s.account_id IS NOT NULL AND (p.identity = 'user:' || s.account_id OR p.account_id = s.account_id)))`;

// Marks today's due reminders as sent before sending them, so a restart or a slow minute
// never sends one twice. A finished daily game (found or given up) means no reminder.
async function claimDue(db, now) {
  const day = parisDay(now), hour = parisHour(now);
  return (await db.query(`UPDATE push_subscriptions s SET last_sent = $1
    WHERE s.hour = $2 AND (s.last_sent IS NULL OR s.last_sent < $1)
      AND NOT EXISTS (SELECT 1 FROM daily_plays p WHERE p.day = $1 AND p.status <> 'playing' AND ${PLAYED_BY})
    RETURNING s.endpoint, s.p256dh, s.auth, s.guest_key, s.account_id`, [day, hour])).rows;
}

async function streakFor(db, row, day) {
  const days = (await db.query(`SELECT DISTINCT p.day::text AS day FROM daily_plays p, (SELECT $1::text AS guest_key, $2::text AS account_id) s
    WHERE p.status = 'won' AND p.day > $3::date - 400 AND ${PLAYED_BY}`, [row.guest_key, row.account_id, day])).rows.map((r) => r.day);
  return streakFromDays(days, day).current;
}

async function sendDue({ db, webpush, now = new Date(), log = console }) {
  const day = parisDay(now);
  let sent = 0;
  for (const row of await claimDue(db, now)) {
    let streak = 0;
    try { streak = await streakFor(db, row, day); } catch (_e) { streak = 0; }
    const payload = JSON.stringify({ ...reminderMessage(streak), url: "/" });
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload,
        { TTL: TTL_SECONDS, urgency: "normal", topic: "pokedle-daily" });
      sent += 1;
    } catch (error) {
      // 404 and 410: the player turned notifications off or the browser dropped them.
      if (error && (error.statusCode === 404 || error.statusCode === 410)) await deleteSubscription(db, row.endpoint);
      else log.warn("[push] send failed:", String((error && (error.statusCode || error.message)) || error).slice(0, 120));
    }
  }
  return sent;
}

function createRateLimit(limit = 20, windowMs = 3600000) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    if (hits.size > 5000) for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.until <= now) { hits.set(key, { count: 1, until: now + windowMs }); return false; }
    entry.count += 1;
    return entry.count > limit;
  };
}

function mountPushRoutes(app, { express, db, ready, secret, getUser, readCookies, webpush, env = process.env, log = console,
  limited = createRateLimit(), generate = () => webpush.generateVAPIDKeys(), clock = () => new Date() }) {
  let keys = null;
  const configured = (async () => {
    if (!db || !secret || !await ready) return false;
    keys = await vapidKeys(db, env, generate);
    webpush.setVapidDetails(env.SITE_URL || "https://pokdle.fr", keys.publicKey, keys.privateKey);
    return true;
  })().catch((error) => { log.warn("[push] unavailable:", String(error.message || error).slice(0, 160)); return false; });

  const guard = (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!req.is("application/json")) { res.status(415).json({ ok: false, error: "json_required" }); return false; }
    const origin = req.get("origin");
    if (origin) {
      let host = "";
      try { host = new URL(origin).host; } catch (_e) { host = ""; }
      if (host !== req.get("host")) { res.status(403).json({ ok: false, error: "origin_denied" }); return false; }
    }
    const ip = crypto.createHmac("sha256", secret).update("push-ip:" + String(req.ip)).digest("hex");
    if (limited(ip)) { res.set("Retry-After", "3600"); res.status(429).json({ ok: false, error: "rate_limited" }); return false; }
    return true;
  };

  app.get("/api/push/key", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    if (!await configured) return res.status(503).json({ ok: false, error: "unavailable" });
    res.json({ ok: true, publicKey: keys.publicKey, hours: HOURS });
  });
  app.post("/api/push/subscribe", express.json({ limit: "4kb" }), async (req, res) => {
    if (!await configured) return res.status(503).json({ ok: false, error: "unavailable" });
    if (!guard(req, res)) return;
    const sub = validateSubscription(req.body);
    if (!sub) return res.status(400).json({ ok: false, error: "invalid_subscription" });
    const guest = dailyGuest(secret, readCookies(req).pokdle_daily), user = getUser(req);
    try {
      await saveSubscription(db, sub, { guestKey: guest ? "guest:" + guest : null, accountId: user && user.id ? String(user.id) : null }, clock());
      res.json({ ok: true, hour: sub.hour });
    } catch (error) {
      log.warn("[push] subscribe failed:", String(error.message || error).slice(0, 120));
      res.status(503).json({ ok: false, error: "unavailable" });
    }
  });
  app.post("/api/push/unsubscribe", express.json({ limit: "2kb" }), async (req, res) => {
    if (!await configured) return res.status(503).json({ ok: false, error: "unavailable" });
    if (!guard(req, res)) return;
    try {
      await deleteSubscription(db, req.body && req.body.endpoint);
      res.json({ ok: true });
    } catch (error) {
      log.warn("[push] unsubscribe failed:", String(error.message || error).slice(0, 120));
      res.status(503).json({ ok: false, error: "unavailable" });
    }
  });
  return { configured };
}

// Checks once a minute: a reminder goes out during the first minute of its hour, or later in
// that hour if the server was restarting.
function startScheduler({ db, webpush, configured, log = console, everyMs = 60000 }) {
  let running = false;
  const tick = async () => {
    if (running || !await configured) return;
    running = true;
    try { await sendDue({ db, webpush, log }); }
    catch (error) { log.warn("[push] scheduler:", String(error.message || error).slice(0, 160)); }
    finally { running = false; }
  };
  const timer = setInterval(tick, everyMs);
  if (timer.unref) timer.unref();
  return timer;
}

function pushSectionHtml(count) {
  return `<p style="margin:16px 0 0">🔔 Rappels du Pokémon du jour activés : <b>${Number.isFinite(count) ? count : "—"}</b></p>`;
}

module.exports = { HOURS, TTL_SECONDS, parisHour, reminderMessage, pushHostAllowed, validateSubscription, ensureTables, vapidKeys,
  saveSubscription, deleteSubscription, countActive, claimDue, streakFor, sendDue, createRateLimit, mountPushRoutes, startScheduler, pushSectionHtml };
