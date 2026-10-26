"use strict";

function profileForClient(value, userId) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return { ...source, _accountId: String(userId) };
}

function profileForStorage(value, userId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "invalid_profile" };
  }
  const owner = typeof value._accountId === "string" ? value._accountId : "";
  if (!owner || owner !== String(userId)) {
    return { ok: false, error: "profile_owner_mismatch" };
  }
  return { ok: true, data: profileForClient(value, userId) };
}

// The partner Pokémon chosen in the profile; rankings show it as the player's avatar.
// A player who picked the account picture as « Image de profil » (26/10) gets none, so the
// rankings show that picture instead.
function partnerIdFromProfileData(data) {
  try {
    const raw = data && data.profile;
    const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (profile && profile.avatarChoice === "account") return null;
    const id = Number(profile && profile.favoritePokemonId);
    return Number.isInteger(id) && id > 0 && id < 30000 ? id : null;
  } catch (_error) {
    return null;
  }
}

// The profile's XP, copied next to the account so rankings can show each player's level.
// null when the account has no saved profile yet.
function xpFromProfileData(data) {
  try {
    const raw = data && data.profile;
    const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!profile || typeof profile !== "object") return null;
    const xp = Math.floor(Number(profile.xp));
    return Number.isFinite(xp) && xp > 0 ? Math.min(xp, 100000000) : 0;
  } catch (_error) {
    return null;
  }
}

// Same curve as the game (script.01.core.js): level N needs 25 × N × (N − 1) XP, from 1 to 100.
function playerLevelFromXp(xp) {
  if (xp === null || xp === undefined) return null;
  const total = Math.max(0, Number(xp) || 0);
  let level = Math.min(100, Math.max(1, Math.floor((1 + Math.sqrt(1 + total / 6.25)) / 2)));
  while (level < 100 && 25 * (level + 1) * level <= total) level += 1;
  while (level > 1 && 25 * level * (level - 1) > total) level -= 1;
  return level;
}

module.exports = { profileForClient, profileForStorage, partnerIdFromProfileData, xpFromProfileData, playerLevelFromXp };
