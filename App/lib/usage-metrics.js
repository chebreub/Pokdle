"use strict";
const { createHash } = require("node:crypto");

// 131,072 anonymous presence slots per UTC day (16 KiB/day).
// A collision can slightly undercount; no UID, IP, or per-visitor hash is stored.
const UNIQUE_BITMAP_BITS = 131072;
const UNIQUE_BITMAP_BYTES = UNIQUE_BITMAP_BITS / 8;

// Product analytics deliberately store only daily aggregate event counters.
// No account id, anonymous browser id, IP, guessed Pokémon or answers are persisted.
const HISTORY_TO_LAUNCH = Object.freeze({
  normal: "normal",
  daily: "daily",
  silhouette: "silhouette",
  pixel: "pixel",
  mystery: "mystery",
  cry: "cry",
  quiz: "quiz",
  description: "description",
  weight: "weight",
  evolution: "evolution",
  order: "order",
  odd: "odd",
  quiestce: "quiestce",
  petitbac: "petitbac",
  "higher-lower": "higherlower",
  "higher-lower-rush": "higherlower",
  "poke-connections": "connections",
  speedrun: "speedrun",
  "stat-auction": "statauction",
  "stat-clash": "statclash",
  typecombo: "typecombo",
  challenge: "challenge",
});

const COMPLETION_EVENTS = Object.freeze(Object.keys(HISTORY_TO_LAUNCH).flatMap(
  (mode) => ["win", "loss"].map((result) => "complete:" + mode + ":" + result)
));
const COMPLETION_EVENT_SET = new Set(COMPLETION_EVENTS);
const FINISHABLE_LAUNCHES = new Set(Object.values(HISTORY_TO_LAUNCH));

function completionEvent(mode, result) {
  const event = "complete:" + mode + ":" + result;
  return COMPLETION_EVENT_SET.has(event) ? event : null;
}

function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function startDay(days = 14, now = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new RangeError("days");
  const today = utcDay(now);
  const origin = Date.parse(today + "T00:00:00.000Z");
  return new Date(origin - (days - 1) * 86400000).toISOString().slice(0, 10);
}

async function ensureTable(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS usage_event_daily (
    day DATE NOT NULL,
    event TEXT NOT NULL,
    hits BIGINT NOT NULL DEFAULT 0 CHECK (hits >= 0),
    PRIMARY KEY (day, event)
  )`);
  // Only an aggregate bitmap and a count: never store browser identifiers.
  await db.query(`CREATE TABLE IF NOT EXISTS usage_unique_daily (
    day DATE PRIMARY KEY,
    bitmap BYTEA NOT NULL,
    uniques INTEGER NOT NULL DEFAULT 0 CHECK (uniques >= 0)
  )`);
}

async function prune(db, now = new Date()) {
  const cutoff = startDay(90, now);
  await db.query("DELETE FROM usage_event_daily WHERE day < $1::date", [cutoff]);
  await db.query("DELETE FROM usage_unique_daily WHERE day < $1::date", [cutoff]);
}

async function increment(db, event, day = utcDay()) {
  if (typeof event !== "string" || !/^[a-z][a-z0-9:-]{0,70}$/.test(event)) throw new TypeError("event");
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError("day");
  await db.query(
    "INSERT INTO usage_event_daily(day,event,hits) VALUES($1::date,$2,1) ON CONFLICT(day,event) DO UPDATE SET hits=usage_event_daily.hits+1",
    [day, event]
  );
}

async function recent(db, days = 14, now = new Date()) {
  const from = startDay(days, now);
  const until = utcDay(now);
  const result = await db.query(
    "SELECT day::text AS day,event,hits FROM usage_event_daily WHERE day >= $1::date AND day <= $2::date ORDER BY day DESC,event",
    [from, until]
  );
  return result.rows;
}

// The browser provides an existing random local identifier. Hash it together
// with the UTC day to select one bitmap slot; keep neither its value nor its hash.
// Different days have different slots, so they cannot be linked from this table.
function uniqueSlot(uid, day = utcDay()) {
  if (typeof uid !== "string" || !/^[a-z0-9-]{8,40}$/i.test(uid)) return null;
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const digest = createHash("sha256").update(day).update("\0").update(uid).digest();
  return digest.readUInt32BE(0) % UNIQUE_BITMAP_BITS;
}

// PostgreSQL's ON CONFLICT serializes updates to the same day. A repeated
// browser/day sets the same bit and cannot increment again, even across workers.
async function recordUnique(db, uid, day = utcDay()) {
  const slot = uniqueSlot(uid, day);
  if (slot === null) return false;
  await db.query(
    `INSERT INTO usage_unique_daily(day,bitmap,uniques)
     VALUES($1::date,set_bit(decode(repeat('00',${UNIQUE_BITMAP_BYTES}), 'hex'),$2::int,1),1)
     ON CONFLICT(day) DO UPDATE SET
       uniques = usage_unique_daily.uniques + (1 - get_bit(usage_unique_daily.bitmap,$2::int)),
       bitmap = set_bit(usage_unique_daily.bitmap,$2::int,1)`,
    [day, slot]
  );
  return true;
}

async function recentUniques(db, days = 14, now = new Date()) {
  const result = await db.query(
    "SELECT day::text AS day,uniques FROM usage_unique_daily WHERE day >= $1::date AND day <= $2::date ORDER BY day DESC",
    [startDay(days, now), utcDay(now)]
  );
  return result.rows;
}

// 'Fins' are completed rounds declared by the browser, not verified session
// conversions. Continuous games can finish several rounds from a single launch.
function summarizeModes(rows, labels = {}) {
  const summary = new Map();
  function get(mode) {
    if (!summary.has(mode)) summary.set(mode, {
      mode, label: labels["solo:" + mode] || mode, launches: 0,
      completions: 0, wins: 0, losses: 0, finishInstrumented: FINISHABLE_LAUNCHES.has(mode)
    });
    return summary.get(mode);
  }
  for (const row of rows || []) {
    const event = String(row.event || "");
    const hits = Number(row.hits);
    if (!Number.isSafeInteger(hits) || hits < 0) continue;
    if (event.startsWith("solo:")) {
      const mode = event.slice(5);
      if (/^[a-z0-9]+$/.test(mode)) get(mode).launches += hits;
      continue;
    }
    if (!COMPLETION_EVENT_SET.has(event)) continue;
    const last = event.lastIndexOf(":");
    const mode = HISTORY_TO_LAUNCH[event.slice(9, last)];
    const outcome = event.slice(last + 1);
    const item = get(mode);
    item.completions += hits;
    if (outcome === "win") item.wins += hits;
    else item.losses += hits;
  }
  return [...summary.values()].sort((a, b) => b.launches - a.launches || b.completions - a.completions || a.mode.localeCompare(b.mode));
}

module.exports = { HISTORY_TO_LAUNCH, COMPLETION_EVENTS, completionEvent, utcDay, startDay, ensureTable, prune, increment, recent, uniqueSlot, recordUnique, recentUniques, summarizeModes };
