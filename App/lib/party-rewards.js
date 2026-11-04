"use strict";
// Une preuve de fin de Party Room est émise côté serveur pour chaque participant.
// Le navigateur ne peut ni fabriquer une partie finie, ni transférer le reçu à un autre compte.
const crypto = require("node:crypto");
const { dailyCalendar } = require("./daily-game");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RUN_ID = /^[a-f0-9]{32}$/;

function sign(secret, identity, day, runId) {
  return crypto.createHmac("sha256", secret)
    .update("pokdle:party-reward:v1\n" + identity + "\n" + day + "\n" + runId)
    .digest("base64url");
}

function issuePartyRewardProof(secret, room, identity, today) {
  if (!secret || !identity || !DAY.test(today || "") || !room ||
      room.status !== "complete" || !RUN_ID.test(room.rewardRunId || "") ||
      !Number.isFinite(room.completedAt) || room.completedAt <= 0 ||
      dailyCalendar(new Date(room.completedAt)).day !== today) return null;
  // Un même joueur dans deux onglets ne représente pas deux participants.
  const players = new Set((room.players || []).map((p) => p.rewardIdentity).filter(Boolean));
  if (players.size < 2 || !players.has(identity)) return null;
  return today + "." + room.rewardRunId + "." + sign(secret, identity, today, room.rewardRunId);
}

function verifyPartyRewardProof(secret, proof, identity, today) {
  if (!secret || !identity || typeof proof !== "string" || proof.length > 160) return false;
  const parts = proof.split(".");
  if (parts.length !== 3 || !DAY.test(parts[0]) || parts[0] !== today ||
      !RUN_ID.test(parts[1]) || !/^[a-zA-Z0-9_-]{43}$/.test(parts[2])) return false;
  const expected = Buffer.from(sign(secret, identity, parts[0], parts[1]), "ascii");
  const supplied = Buffer.from(parts[2], "ascii");
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

module.exports = { issuePartyRewardProof, verifyPartyRewardProof };
