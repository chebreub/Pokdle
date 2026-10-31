"use strict";
const crypto = require("crypto");

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
// A player who picked the account picture or a shared photo as « Image de profil » (26/10)
// gets none, so the rankings show that picture instead.
function partnerIdFromProfileData(data) {
  try {
    const raw = data && data.profile;
    const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (profile && (profile.avatarChoice === "account" || sharedPhotoFromProfileData(data))) return null;
    const id = Number(profile && profile.favoritePokemonId);
    return Number.isInteger(id) && id > 0 && id < 30000 ? id : null;
  } catch (_error) {
    return null;
  }
}

// The photo a player shows in the rankings (26/10): only once « Ma photo » was picked under the
// note saying the other players see it (avatarPhotoShared), so photos sent before stay private.
// A small JPEG, as the profile makes it (160 × 160); anything else is ignored.
const SHARED_PHOTO_MAX_BYTES = 60000;
function sharedPhotoFromProfileData(data) {
  try {
    const raw = data && data.profile;
    const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!profile || profile.avatarChoice !== "photo" || profile.avatarPhotoShared !== true) return null;
    const photo = typeof profile.avatarPhoto === "string" ? profile.avatarPhoto : "";
    if (photo.length > 100000) return null;
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
    if (!match) return null;
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.length > SHARED_PHOTO_MAX_BYTES || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
    return { key: crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 24), bytes };
  } catch (_error) {
    return null;
  }
}

// The picture a ranking row shows (SQL, users joined as u): the shared photo, else the fallback.
// The key is the photo's own hash, so a new photo gets a new address.
function rankingAvatarSql(fallback) {
  return `COALESCE('/api/avatar-photo/' || u.photo_key, ${fallback})`;
}

// Same ceiling as the page (script.07a.profile-merge.js): 247 500 XP (level 100) until 10/11/2026,
// then 30 000 more a day.
function xpCeiling(now = Date.now()) {
  return 247500 + Math.max(0, Math.floor((now - Date.parse("2026-11-10T00:00:00Z")) / 86400000)) * 30000;
}
// The profile's XP, copied next to the account so rankings can show each player's level.
// null when the account has no saved profile yet.
function xpFromProfileData(data) {
  try {
    const raw = data && data.profile;
    const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!profile || typeof profile !== "object") return null;
    const xp = Math.floor(Number(profile.xp));
    // A copy above what anyone could earn is broken (XP that ran away on 31/10/2026): no level from it.
    if (Number.isFinite(xp) && xp > xpCeiling()) return null;
    return Number.isFinite(xp) && xp > 0 ? xp : 0;
  } catch (_error) {
    return null;
  }
}

// When the admin last put back this player's level (lib/player-level-admin.js), 0 if never. A copy
// made before that moment never replaces the online one (POST /api/profile).
function xpSetAtFromProfileData(data) {
  try {
    const raw = data && data.profile;
    const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
    const at = Number(profile && profile.xpSetAt);
    return Number.isFinite(at) && at > 0 ? Math.floor(at) : 0;
  } catch (_error) {
    return 0;
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

module.exports = { xpCeiling, xpSetAtFromProfileData, profileForClient, profileForStorage, partnerIdFromProfileData, sharedPhotoFromProfileData, rankingAvatarSql, xpFromProfileData, playerLevelFromXp };
