"use strict";

const CRITERIA = ["generation", "altForm", "type1", "type2", "habitat", "color", "stage", "height", "weight"];

// One gauge, no guessed species or per-criterion details in the rival's packet.
// Equal weighting mirrors the nine columns in the player's own clue table.
function bestDuelProximity(player) {
  if (player.correct) return 100;
  let best = 0;
  for (const entry of player.guesses || []) {
    const feedback = entry.feedback || {};
    const matched = CRITERIA.reduce((sum, key) => sum + (feedback[key] === "ok" ? 1 : feedback[key] === "close" ? 0.5 : 0), 0);
    best = Math.max(best, Math.round(100 * matched / CRITERIA.length));
  }
  // Different species can share every compared attribute.
  return Math.min(99, best);
}

module.exports = { bestDuelProximity };
