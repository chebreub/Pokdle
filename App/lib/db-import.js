"use strict";
// One-time import of the old database (Neon, blocked by its free quota on 19/10/2026)
// into the current one. It runs on its own once OLD_DATABASE_URL is reachable, keeps
// everything played since the move, and never runs twice (data_imports marker).
const IMPORT_NAME = "legacy-neon-2026-10";
// Calendar days stay plain text on the way, whatever the server's time zone.
const DATE_AS_TEXT = { getTypeParser: (oid, format) => oid === 1082 ? (value => value) : require("pg").types.getTypeParser(oid, format) };
const DAILY_TABLES = [
  ["daily_rounds", "daily_plays"],
  ["wordle_rounds", "wordle_plays"],
  ["dossier_rounds", "dossier_plays"],
  ["challenge_rounds", "challenge_plays"],
  ["grid_rounds", "grid_plays"],
];

async function tableExists(q, table) {
  return Boolean((await q.query("SELECT to_regclass($1) IS NOT NULL AS ok", [table])).rows[0]?.ok);
}
async function columnTypes(q, table) {
  const rows = (await q.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 AND table_schema=current_schema()", [table])).rows;
  return new Map(rows.map(r => [r.column_name, r.data_type]));
}
// Copies rows with the columns both sides know; JSON columns travel as text.
async function insertRows(db, table, rows, { skip = [], conflict = "ON CONFLICT DO NOTHING" } = {}) {
  if (!rows.length) return 0;
  const types = await columnTypes(db, table);
  const columns = Object.keys(rows[0]).filter(c => types.has(c) && !skip.includes(c));
  let inserted = 0;
  for (let start = 0; start < rows.length; start += 200) {
    const chunk = rows.slice(start, start + 200), values = [], params = [];
    chunk.forEach(row => {
      values.push("(" + columns.map(c => {
        const json = types.get(c) === "jsonb" || types.get(c) === "json";
        params.push(json && row[c] != null ? JSON.stringify(row[c]) : row[c]);
        return "$" + params.length + (json ? "::jsonb" : "");
      }).join(",") + ")");
    });
    const result = await db.query(`INSERT INTO ${table}(${columns.join(",")}) VALUES ${values.join(",")} ${conflict}`, params);
    inserted += result.rowCount || 0;
  }
  return inserted;
}
async function oldRows(old, table, where = "", params = []) {
  if (!(await tableExists(old, table))) return [];
  return (await old.query(`SELECT * FROM ${table} ${where}`, params)).rows;
}
// A saved profile is a complete snapshot, not an append-only progress log.
// JSON length is never evidence that one version is newer or safer to keep.
const PROFILE_METADATA = new Set(["_accountId", "_savedAt"]);
const isRecord = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
const hasProfileData = data => isRecord(data) && Object.keys(data).some(key => !PROFILE_METADATA.has(key));
const isBlankProfile = data => isRecord(data) && !hasProfileData(data);
function canRestoreLegacyProfile(current, legacy, accountId) {
  return isBlankProfile(current) && hasProfileData(legacy) &&
    (!current._accountId || String(current._accountId) === String(accountId)) &&
    (!legacy._accountId || String(legacy._accountId) === String(accountId));
}

async function importLegacy({ db, old, ascModes = [] }) {
  const report = {};
  // Keep both snapshots when an existing account already has progress. Backups
  // are private to the database and vanish with the account via ON DELETE CASCADE.
  await db.query(`CREATE TABLE IF NOT EXISTS legacy_profile_backups (
    discord_id TEXT PRIMARY KEY REFERENCES users(discord_id) ON DELETE CASCADE,
    legacy_data JSONB NOT NULL,
    current_data JSONB NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const deleted = new Set((await tableExists(db, "deleted_accounts")) ? (await db.query("SELECT id FROM deleted_accounts")).rows.map(r => r.id) : []);
  const kept = (rows, field) => rows.filter(r => !deleted.has(String(r[field] ?? "")));
  // Accounts: never replace live progress with a longer (possibly older) blob.
  const users = kept(await oldRows(old, "users"), "discord_id");
  for (const user of users) {
    // In production importLegacy runs in one transaction. Lock each existing row
    // so a concurrent /api/profile write cannot race the blank-profile check.
    const current = (await db.query("SELECT data FROM users WHERE discord_id=$1 FOR UPDATE", [user.discord_id])).rows[0];
    if (!current) { report.users = (report.users || 0) + await insertRows(db, "users", [user]); continue; }
    if (canRestoreLegacyProfile(current.data, user.data, user.discord_id)) {
      await db.query("UPDATE users SET data=$2::jsonb, partner_id=COALESCE(partner_id,$3), created_at=LEAST(created_at,$4) WHERE discord_id=$1", [user.discord_id, JSON.stringify(user.data), user.partner_id ?? null, user.created_at]);
      report.profilesRestored = (report.profilesRestored || 0) + 1;
    } else {
      // A conflict needs a deliberate merge/recovery; save BOTH sides without
      // changing the currently playable profile, irrespective of JSON size.
      if (hasProfileData(user.data) && JSON.stringify(user.data) !== JSON.stringify(current.data)) {
        await db.query("INSERT INTO legacy_profile_backups(discord_id,legacy_data,current_data) VALUES($1,$2::jsonb,$3::jsonb) ON CONFLICT (discord_id) DO NOTHING",
          [user.discord_id, JSON.stringify(user.data), JSON.stringify(current.data)]);
        report.profilesBackedUp = (report.profilesBackedUp || 0) + 1;
      }
      await db.query("UPDATE users SET partner_id=COALESCE(partner_id,$2), created_at=LEAST(created_at,$3) WHERE discord_id=$1", [user.discord_id, user.partner_id ?? null, user.created_at]);
    }
  }
  report.identities = await insertRows(db, "account_identities", kept(await oldRows(old, "account_identities"), "account_id"));
  // Records: the best of both sides, in each board's direction.
  const scores = kept(await oldRows(old, "scores"), "discord_id");
  const asc = "'{" + ascModes.map(m => String(m).replace(/[^a-z0-9_]/gi, "")).join(",") + "}'::text[]";
  report.scores = await insertRows(db, "scores", scores, { conflict: `ON CONFLICT (discord_id, mode) DO UPDATE SET
    score = CASE WHEN EXCLUDED.mode = ANY(${asc}) THEN LEAST(scores.score, EXCLUDED.score) ELSE GREATEST(scores.score, EXCLUDED.score) END,
    updated_at = GREATEST(scores.updated_at, EXCLUDED.updated_at)` });
  report.events = await insertRows(db, "leaderboard_events", kept(await oldRows(old, "leaderboard_events"), "discord_id"), { skip: ["id"] });
  report.sessions = await insertRows(db, "daily_sessions", kept(await oldRows(old, "daily_sessions"), "discord_id"));
  report.visits = await insertRows(db, "visits", await oldRows(old, "visits"), { conflict: "ON CONFLICT (day) DO UPDATE SET hits = visits.hits + EXCLUDED.hits" });
  // Daily stages: only the days the current database has not drawn itself.
  for (const [roundTable, playTable] of DAILY_TABLES) {
    if (!(await tableExists(db, roundTable))) continue;
    const taken = new Set((await db.query(`SELECT day::text AS day FROM ${roundTable}`)).rows.map(r => r.day));
    const rounds = (await oldRows(old, roundTable, "ORDER BY day")).filter(r => !taken.has(dayKey(r.day)));
    report[roundTable] = await insertRows(db, roundTable, rounds);
    const days = rounds.map(r => dayKey(r.day));
    report[playTable] = days.length ? await insertRows(db, playTable, kept(await oldRows(old, playTable, "WHERE day::text = ANY($1)", [days]), "account_id")) : 0;
  }
  // Egg of the week: rounds get new ids, guesses and rewards follow them.
  if (await tableExists(db, "egg_rounds")) {
    const takenWeeks = new Set((await db.query("SELECT week_start::text AS w FROM egg_rounds")).rows.map(r => r.w));
    const rounds = (await oldRows(old, "egg_rounds", "ORDER BY week_start")).filter(r => !takenWeeks.has(dayKey(r.week_start)));
    const ids = new Map();
    for (const round of rounds) {
      const { id, ...rest } = round;
      const cols = Object.keys(rest), params = cols.map(c => rest[c]);
      const created = await db.query(`INSERT INTO egg_rounds(${cols.join(",")}) VALUES (${cols.map((_, i) => "$" + (i + 1)).join(",")}) ON CONFLICT (week_start) DO NOTHING RETURNING id`, params);
      if (created.rows[0]) ids.set(String(id), created.rows[0].id);
    }
    report.egg_rounds = ids.size;
    const mapped = rows => rows.filter(r => ids.has(String(r.round_id))).map(r => ({ ...r, round_id: ids.get(String(r.round_id)) }));
    // A deleted player's guesses stay in the shared investigation, anonymised.
    const guesses = mapped(await oldRows(old, "egg_guesses")).map(g => deleted.has(String(g.player_id ?? "")) || deleted.has(String(g.credited_player_id ?? "")) ? { ...g, player_id: null, credited_player_id: null, username: "Anonyme" } : g);
    report.egg_guesses = await insertRows(db, "egg_guesses", guesses, { skip: ["id"] });
    report.egg_rewards = await insertRows(db, "egg_rewards", kept(mapped(await oldRows(old, "egg_rewards")), "player_id"));
  }
  return report;
}
function dayKey(value) {
  if (value instanceof Date) return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
  return String(value).slice(0, 10);
}

// Tries once now and then every few hours until the old database answers once.
function scheduleLegacyImport({ db, oldUrl, ascModes = [], readyBefore = Promise.resolve(), Pool = require("pg").Pool, everyMs = 6 * 3600000, log = console }) {
  if (!db || !oldUrl) return null;
  let timer = null, running = false;
  async function attempt() {
    if (running) return;
    running = true;
    const client = await db.connect().catch(() => null);
    if (!client) { running = false; return; }
    let old = null;
    try {
      await client.query("CREATE TABLE IF NOT EXISTS data_imports(name TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now(), report JSONB)");
      if ((await client.query("SELECT 1 FROM data_imports WHERE name=$1", [IMPORT_NAME])).rows.length) { clearInterval(timer); return; }
      if (!(await client.query("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [IMPORT_NAME])).rows[0].ok) return;
      try {
        old = new Pool({ connectionString: oldUrl, ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 15000, types: DATE_AS_TEXT });
        await old.query("SELECT 1");
        await client.query("BEGIN");
        const report = await importLegacy({ db: client, old, ascModes });
        await client.query("INSERT INTO data_imports(name, report) VALUES($1, $2::jsonb)", [IMPORT_NAME, JSON.stringify(report)]);
        await client.query("COMMIT");
        clearInterval(timer);
        log.log("[import] old data restored:", JSON.stringify(report));
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        log.log("[import] old database not available yet:", String(e.message || e).slice(0, 160));
      } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [IMPORT_NAME]).catch(() => {});
      }
    } catch (e) {
      log.log("[import] skipped:", String(e.message || e).slice(0, 160));
    } finally {
      if (old) await old.end().catch(() => {});
      client.release(); running = false;
    }
  }
  readyBefore.then(() => { timer = setInterval(attempt, everyMs); timer.unref?.(); return attempt(); }).catch(() => {});
  return { attempt };
}

module.exports = { IMPORT_NAME, DATE_AS_TEXT, hasProfileData, canRestoreLegacyProfile, importLegacy, scheduleLegacyImport };
