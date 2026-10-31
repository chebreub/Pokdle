"use strict";
// « Niveau d'un joueur » (31/10/2026): the admin puts back the level a player lost (Kayan fell from
// level 73 to 1 while the runaway XP was being fixed). The online copy of the profile gets the XP where
// that level starts, a mark of when it was set (xpSetAt) and a newer version stamp: each device of the
// player takes it at its next visit instead of sending its own XP back (script.07a.profile-merge.js).
const { playerLevelFromXp } = require("./profile-sync");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Same curve as the game (script.01.core.js): level N starts at 25 × N × (N − 1) XP.
const xpForLevel = (level) => 25 * level * (level - 1);

async function setPlayerLevel(db, accountId, level, now = Date.now()) {
  const id = String(accountId || "");
  const wanted = Number(level);
  if (!id) return { error: "Choisis un joueur." };
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > 100) return { error: "Choisis un niveau entre 1 et 100." };
  const xp = xpForLevel(wanted);
  // The player may be syncing at the same moment: the copy is only replaced if it did not change meanwhile.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = (await db.query("SELECT data, data->>'_savedAt' AS saved_at FROM users WHERE discord_id = $1", [id])).rows[0];
    if (!row) return { error: "Joueur introuvable." };
    const data = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : {};
    let profile = null;
    try { profile = typeof data.profile === "string" ? JSON.parse(data.profile) : null; } catch (_error) { profile = null; }
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) return { error: "Ce joueur n'a pas encore de progression enregistrée." };
    const previous = Number(data._savedAt);
    // Newer than the copy every device started from, even with a device clock ahead of the server.
    const savedAt = Math.max(now, (Number.isFinite(previous) ? previous : 0) + 1);
    // _xpSetAt: the same mark where the server checks it before accepting a device's copy.
    const next = { ...data, profile: JSON.stringify({ ...profile, xp, xpSetAt: savedAt }), _savedAt: savedAt, _xpSetAt: savedAt };
    const saved = await db.query("UPDATE users SET data = $2, xp = $3 WHERE discord_id = $1 AND (data->>'_savedAt') IS NOT DISTINCT FROM $4",
      [id, JSON.stringify(next), xp, row.saved_at]);
    if (saved.rowCount) return { ok: true, xp };
  }
  return { error: "Le joueur jouait au même moment : réessaie dans une minute." };
}

// Players with a saved profile, last seen first, with the level the rankings show.
async function playersWithLevel(db) {
  const rows = (await db.query("SELECT discord_id, username, xp FROM users WHERE username <> '' AND data ? 'profile' ORDER BY last_login DESC NULLS LAST LIMIT 300")).rows;
  return rows.map((r) => ({ id: r.discord_id, name: r.username, level: r.xp === null || r.xp === undefined ? null : playerLevelFromXp(r.xp) }));
}

function levelSectionHtml(players) {
  const options = players.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}${p.level ? ` · niveau ${p.level}` : ""}</option>`).join("");
  return `<section><h2>Niveau d'un joueur</h2><p class="hint">Pour un joueur qui a perdu son niveau. Ses appareils reprennent ce niveau à leur prochaine visite, à la place de leur propre XP.</p>
<form method="post" action="/admin/level"><label>Joueur<select name="account_id" required><option value="">Choisis un joueur</option>${options}</select></label>
<label for="level-value">Niveau (1 à 100)</label><input id="level-value" name="level" type="number" inputmode="numeric" min="1" max="100" step="1" required placeholder="73">
<div class="row"><button class="primary" type="submit">Remettre ce niveau</button></div></form></section>`;
}

module.exports = { xpForLevel, setPlayerLevel, playersWithLevel, levelSectionHtml };
