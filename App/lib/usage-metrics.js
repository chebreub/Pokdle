"use strict";
const { createHash } = require("node:crypto");

// 131,072 anonymous presence slots per UTC day (16 KiB/day).
// A collision can slightly undercount; no UID, IP, or per-visitor hash is stored.
const UNIQUE_BITMAP_BITS = 131072;
const UNIQUE_BITMAP_BYTES = UNIQUE_BITMAP_BITS / 8;

// Product analytics deliberately store only daily aggregate event counters.
// No account id, anonymous browser id, IP, guessed Pokémon or answers are persisted.

// One catalogue for server validation, labels, groups and /admin/stats.
// An entry is a trackable opening, not a verified unique play. New counters
// start on deployment; past visits cannot be inferred.
const SOLO_CATALOG = Object.freeze({
  daily: {label:"Pokémon du jour · Enquête",group:"Quotidien"},
  wordle: {label:"Wordle du jour",group:"Quotidien"},
  dossier: {label:"Dossier du jour",group:"Quotidien"},
  grid: {label:"Grille du jour",group:"Quotidien"},
  challenge: {label:"Défi du jour",group:"Quotidien"},
  normal: {label:"Pokédle illimité",group:"Deviner"},
  silhouette: {label:"Silhouette",group:"Deviner"},
  pixel: {label:"Pixelisé",group:"Deviner"},
  mystery: {label:"Stat mystère",group:"Deviner"},
  cry: {label:"Cri Pokémon",group:"Deviner"},
  description: {label:"Description Pokédex",group:"Deviner"},
  evolution: {label:"Chaîne d'évolution",group:"Deviner"},
  order: {label:"Ordre Pokédex",group:"Deviner"},
  quiestce: {label:"Qui est-ce ?",group:"Deviner"},
  wordletraining: {label:"Wordle Pokémon · Entraînement",group:"Deviner"},
  shiny: {label:"Shiny ou normal ?",group:"Deviner"},
  quiz: {label:"Quiz",group:"Arcade"},
  weight: {label:"Duel de poids",group:"Arcade"},
  odd: {label:"Intrus",group:"Arcade"},
  petitbac: {label:"Petit Bac",group:"Arcade"},
  higherlower: {label:"Higher or Lower · Illimité",group:"Arcade"},
  higherlowerrush: {label:"Higher or Lower · 60 s",group:"Arcade"},
  connections: {label:"Poké-Connections",group:"Arcade"},
  speedrun: {label:"Speedrun",group:"Arcade"},
  statauction: {label:"Enchères de stats",group:"Arcade"},
  scoreattack: {label:"Score Attack",group:"Arcade"},
  draft: {label:"Draft Arènes",group:"Arcade"},
  statclash: {label:"Stat Clash",group:"Arcade"},
  typecombo: {label:"Combo de types",group:"Arcade"},
  lastletter: {label:"Dernière lettre",group:"Arcade"},
  rankthem: {label:"Classe-les",group:"Arcade"},
  weakspots: {label:"Faiblesses éclair",group:"Arcade"},
  emulator: {label:"Émulateur",group:"Autres"},
});

const PARTY_CATALOG = Object.freeze({
  "party:start:dexrace":"Course au Pokédex",
  "party:start:coop":"Enquête coop",
  "party:start:deduction":"Pokémon mystère",
  "party:start:quiestce1v1":"Qui est-ce ?",
  "party:start:petitbac":"Petit Bac",
  "party:start:nearest":"Numéro mystère",
  "party:start:guess":"Course Pokémon",
  "party:start:typecombo":"Combo de types",
  "party:start:duocriteria":"Duo de critères",
  "party:start:lastletter":"Dernière lettre",
  "party:start:statclash":"Meilleure stat",
  "party:start:statclashparty":"Stat Clash",
  "party:start:dessin":"Dessine-le !",
});
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
  lastletter: "lastletter",
  rankthem: "rankthem",
  weakspots: "weakspots",
  shiny: "shiny",
  challenge: "challenge",
});

const COMPLETION_EVENTS = Object.freeze(Object.keys(HISTORY_TO_LAUNCH).flatMap(
  (mode) => ["win", "loss"].map((result) => "complete:" + mode + ":" + result)
));
const COMPLETION_EVENT_SET = new Set(COMPLETION_EVENTS);
const FINISHABLE_LAUNCHES = new Set([...Object.values(HISTORY_TO_LAUNCH), "higherlowerrush"]);

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
  // DATA-02 is an additive, prospective view. Never rewrite historical totals.
  await db.query(`CREATE TABLE IF NOT EXISTS usage_event_segment_daily (
    day DATE NOT NULL,
    event TEXT NOT NULL,
    segment TEXT NOT NULL CHECK (segment IN ('admin','test','unmarked')),
    hits BIGINT NOT NULL DEFAULT 0 CHECK (hits >= 0),
    PRIMARY KEY (day, event, segment)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS usage_segment_metadata (
    name TEXT PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await db.query("INSERT INTO usage_segment_metadata(name) VALUES ('v1') ON CONFLICT (name) DO NOTHING");
}

async function prune(db, now = new Date()) {
  const cutoff = startDay(90, now);
  await db.query("DELETE FROM usage_event_daily WHERE day < $1::date", [cutoff]);
  await db.query("DELETE FROM usage_unique_daily WHERE day < $1::date", [cutoff]);
  await db.query("DELETE FROM usage_event_segment_daily WHERE day < $1::date", [cutoff]);
}

async function increment(db, event, day = utcDay()) {
  if (typeof event !== "string" || !/^[a-z][a-z0-9:-]{0,70}$/.test(event)) throw new TypeError("event");
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError("day");
  await db.query(
    "INSERT INTO usage_event_daily(day,event,hits) VALUES($1::date,$2,1) ON CONFLICT(day,event) DO UPDATE SET hits=usage_event_daily.hits+1",
    [day, event]
  );
}

// Write both aggregates in ONE statement: a failed scope insert cannot silently
// create an unmatched legacy total. The client never gets to choose a segment.
async function incrementSegmented(db, event, segment, day = utcDay()) {
  if (typeof event !== "string" || !/^[a-z][a-z0-9:-]{0,70}$/.test(event)) throw new TypeError("event");
  if (!["admin", "test", "unmarked"].includes(segment)) throw new TypeError("segment");
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError("day");
  await db.query(`
    WITH total AS (
      INSERT INTO usage_event_daily(day,event,hits)
      VALUES ($1::date,$2,1)
      ON CONFLICT(day,event) DO UPDATE SET hits=usage_event_daily.hits+1
      RETURNING day
    )
    INSERT INTO usage_event_segment_daily(day,event,segment,hits)
    SELECT day,$2,$3,1 FROM total WHERE TRUE
    ON CONFLICT(day,event,segment) DO UPDATE
      SET hits=usage_event_segment_daily.hits+1
  `, [day, event, segment]);
}

async function recentSegments(db, days = 14, now = new Date()) {
  const result = await db.query(
    "SELECT day::text AS day,event,segment,hits FROM usage_event_segment_daily WHERE day >= $1::date AND day <= $2::date ORDER BY day DESC,event,segment",
    [startDay(days, now), utcDay(now)]
  );
  return result.rows;
}

async function segmentTrackingStartedAt(db) {
  const result = await db.query("SELECT started_at FROM usage_segment_metadata WHERE name = 'v1'");
  return result.rows[0]?.started_at ? new Date(result.rows[0].started_at).toISOString() : null;
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
      mode, label: labels["solo:" + mode] || SOLO_CATALOG[mode]?.label || mode, group: SOLO_CATALOG[mode]?.group || "Autres", launches: 0,
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
    // Stats split the 60-second variant; the shared HISTORY_TO_LAUNCH mapping
    // remains unchanged because rewards also rely on it for daily caps.
    const modeName = event.slice(9, last);
    const mode = modeName === "higher-lower-rush" ? "higherlowerrush" : HISTORY_TO_LAUNCH[modeName];
    const outcome = event.slice(last + 1);
    const item = get(mode);
    item.completions += hits;
    if (outcome === "win") item.wins += hits;
    else item.losses += hits;
  }
  return [...summary.values()].sort((a, b) => b.launches - a.launches || b.completions - a.completions || a.mode.localeCompare(b.mode));
}

// DATA-03: messaging apps fetch a shared link to draw its preview card (WhatsApp, Discord…).
// Those fetches are counted apart (share:preview), never as a person opening the link.
const LINK_PREVIEW_AGENT = /bot\b|bot\/|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|embedly|vkshare|pinterest|redditbot|applebot|google-pagerenderer|headless/i;
function isLinkPreviewAgent(userAgent) {
  const ua = String(userAgent || "");
  return !ua || LINK_PREVIEW_AGENT.test(ua);
}

module.exports = { isLinkPreviewAgent, SOLO_CATALOG, PARTY_CATALOG, HISTORY_TO_LAUNCH, COMPLETION_EVENTS, completionEvent, utcDay, startDay, ensureTable, prune, increment, incrementSegmented, recent, recentSegments, segmentTrackingStartedAt, uniqueSlot, recordUnique, recentUniques, summarizeModes };
