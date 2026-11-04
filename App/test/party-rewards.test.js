"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { issuePartyRewardProof, verifyPartyRewardProof } = require("../lib/party-rewards");

const secret = "secret-in-tests-only";
const completedAt = Date.parse("2026-11-04T10:00:00Z");
const day = "2026-11-04";
const room = () => ({
  status: "complete", completedAt, rewardRunId: "a".repeat(32),
  players: [{ rewardIdentity: "user:42" }, { rewardIdentity: "guest:g8" }]
});

test("Party reward proof requires a server-completed game with two distinct players", () => {
  const proof = issuePartyRewardProof(secret, room(), "user:42", day);
  assert.ok(proof && verifyPartyRewardProof(secret, proof, "user:42", day));
  assert.equal(verifyPartyRewardProof(secret, proof, "user:43", day), false, "proof is account-bound");
  assert.equal(verifyPartyRewardProof(secret, proof, "user:42", "2026-11-05"), false, "proof expires at the Paris day boundary");
  assert.equal(verifyPartyRewardProof("wrong-secret", proof, "user:42", day), false);
  assert.equal(verifyPartyRewardProof(secret, proof.slice(0, -1) + "A", "user:42", day), false);
  assert.equal(verifyPartyRewardProof(secret, "invented", "user:42", day), false);
  assert.equal(verifyPartyRewardProof(secret, null, "user:42", day), false);
});

test("Party room cannot mint a reward before completion or for a spectator", () => {
  const playing = {...room(), status:"playing"};
  assert.equal(issuePartyRewardProof(secret, playing, "user:42", day), null);
  assert.equal(issuePartyRewardProof(secret, {...room(), completedAt: null}, "user:42", day), null);
  assert.equal(issuePartyRewardProof(secret, room(), "user:50", day), null);
  assert.equal(issuePartyRewardProof(secret, {...room(), players:[{rewardIdentity:"user:42"},{rewardIdentity:"user:42"}]}, "user:42", day), null);
  assert.equal(issuePartyRewardProof(secret, {...room(), rewardRunId:"bogus"}, "user:42", day), null);
  assert.equal(issuePartyRewardProof(secret, {...room(), completedAt: Date.parse("2026-11-03T10:00:00Z")}, "user:42", day), null);
});
