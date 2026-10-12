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
function partnerIdFromProfileData(data) {
  try {
    const raw = data && data.profile;
    const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
    const id = Number(profile && profile.favoritePokemonId);
    return Number.isInteger(id) && id > 0 && id < 30000 ? id : null;
  } catch (_error) {
    return null;
  }
}

module.exports = { profileForClient, profileForStorage, partnerIdFromProfileData };
