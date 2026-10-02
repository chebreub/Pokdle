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

module.exports = { profileForClient, profileForStorage };
