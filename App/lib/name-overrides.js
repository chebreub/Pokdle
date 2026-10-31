"use strict";
// « Pseudo déplacé » (31/10/2026): the admin replaces a player's name with « Dresseur ». It stays so:
// the session name is replaced on every request and a new sign-in does not bring the old one back.
// « Rétablir » lifts it; the provider's name then returns at the player's next sign-in.
const REPLACED_NAME = "Dresseur";
const overrides = new Map();

async function ensureNameOverrides(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS name_overrides (
    account_id TEXT PRIMARY KEY, name TEXT NOT NULL, previous TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  overrides.clear();
  for (const row of (await db.query("SELECT account_id, name FROM name_overrides")).rows) overrides.set(String(row.account_id), row.name);
}
function overriddenName(accountId) { return accountId == null ? null : overrides.get(String(accountId)) || null; }
function withOverride(user) {
  const name = user && overriddenName(user.id);
  return name ? { ...user, username: name } : user;
}
async function replaceName(db, accountId) {
  const id = String(accountId || "");
  const user = (await db.query("SELECT username FROM users WHERE discord_id = $1", [id])).rows[0];
  if (!user) return { error: "Joueur introuvable." };
  await db.query(`INSERT INTO name_overrides(account_id, name, previous) VALUES ($1, $2, $3)
    ON CONFLICT (account_id) DO UPDATE SET name = EXCLUDED.name`, [id, REPLACED_NAME, String(user.username || "").slice(0, 64)]);
  await db.query("UPDATE users SET username = $2 WHERE discord_id = $1", [id, REPLACED_NAME]);
  await db.query("UPDATE scores SET username = $2 WHERE discord_id = $1", [id, REPLACED_NAME]).catch(() => {});
  overrides.set(id, REPLACED_NAME);
  return { ok: true };
}
async function restoreName(db, accountId) {
  const id = String(accountId || "");
  await db.query("DELETE FROM name_overrides WHERE account_id = $1", [id]);
  overrides.delete(id);
  return { ok: true };
}
async function listOverrides(db) {
  return (await db.query("SELECT account_id, previous, to_char(created_at AT TIME ZONE 'Europe/Paris', 'DD/MM') AS day FROM name_overrides ORDER BY created_at DESC LIMIT 50")).rows;
}
// The SQL that keeps a replaced name through a new sign-in (users upsert).
const KEEP_OVERRIDE_SQL = "COALESCE((SELECT o.name FROM name_overrides o WHERE o.account_id = EXCLUDED.discord_id), EXCLUDED.username)";

module.exports = { REPLACED_NAME, KEEP_OVERRIDE_SQL, ensureNameOverrides, overriddenName, withOverride, replaceName, restoreName, listOverrides };
