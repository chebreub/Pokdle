"use strict";

// Shared server-side rules: a challenge must not become a way around a chat block or suspension.
async function ensureTables(db) {
  for (const table of ["player_blocks", "player_challenge_blocks"]) {
    await db.query(`CREATE TABLE IF NOT EXISTS ${table} (
      account_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (account_id, blocked_id))`);
  }
  await db.query(`CREATE TABLE IF NOT EXISTS chat_suspensions (
    account_id TEXT PRIMARY KEY, until_at TIMESTAMPTZ, reason TEXT NOT NULL DEFAULT '',
    admin_id TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
}

async function blockedEither(db, a, b) {
  return (await db.query(`SELECT 1 FROM (
    SELECT account_id, blocked_id FROM player_blocks UNION ALL
    SELECT account_id, blocked_id FROM player_challenge_blocks WHERE blocked_id <> '*'
  ) blocks WHERE (account_id = $1 AND blocked_id = $2) OR (account_id = $2 AND blocked_id = $1) LIMIT 1`, [String(a), String(b)])).rowCount > 0;
}

async function discussionAllowed(db, a, b) {
  return !(await db.query(`SELECT 1 FROM chat_suspensions WHERE account_id IN ($1, $2)
    AND (until_at IS NULL OR until_at > now()) LIMIT 1`, [String(a), String(b)])).rowCount;
}

async function setSuspension(db, { accountId, days, reason, adminId }) {
  const id = String(accountId || "");
  // 0 = lift, -1 = indefinite. Only the admin route calls this function.
  const duration = Number(days);
  if (![-1, 0, 1, 7, 30].includes(duration) || !(await db.query("SELECT 1 FROM users WHERE discord_id = $1", [id])).rowCount) return false;
  if (duration === 0) await db.query("DELETE FROM chat_suspensions WHERE account_id = $1", [id]);
  else await db.query(`INSERT INTO chat_suspensions(account_id, until_at, reason, admin_id)
    VALUES ($1, CASE WHEN $2::int = -1 THEN NULL ELSE now() + make_interval(days => $2) END, $3, $4)
    ON CONFLICT (account_id) DO UPDATE SET until_at = EXCLUDED.until_at, reason = EXCLUDED.reason,
      admin_id = EXCLUDED.admin_id, updated_at = now()`, [id, duration, String(reason || "").trim().slice(0, 300), String(adminId)]);
  return true;
}

module.exports = { ensureTables, blockedEither, discussionAllowed, setSuspension };
