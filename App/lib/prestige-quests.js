"use strict";
// Drattak : la légende de Draby qui rêvait de voler. Les étapes sont thématiques,
// mais toute l'éligibilité matérielle est calculée à partir de captures et de
// victoires enregistrées côté serveur (aucun claim local ne compte).
const SALAMENCE = Object.freeze({
  pokemonId: 373,
  lineageIds: Object.freeze([371, 372]),
  modes: Object.freeze({ cry: 3, silhouette: 3, description: 3 }),
  minDays: 5,
  windowDays: 30,
  cooldownDays: 21,
});
const DREAM_ANSWER = "draby";
function normalizeDreamAnswer(raw) {
  if (typeof raw !== "string" || raw.length > 50) return "";
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function verifyDreamAnswer(raw) {
  return normalizeDreamAnswer(raw) === DREAM_ANSWER;
}
// Puzzle is a narrative final door, not an authentication factor. Knowing its
// answer never bypasses the server-verified gameplay/capture requirements.
function statusForSalamence(progress, today, shiftDay) {
  const wins = Object.fromEntries(Object.keys(SALAMENCE.modes).map((mode) =>
    [mode, Math.max(0, Math.trunc(Number(progress?.wins?.[mode]) || 0))]));
  const days = Math.max(0, Math.trunc(Number(progress?.days) || 0));
  const lineageCaptured = SALAMENCE.lineageIds.filter((id) => (progress?.lineageIds || []).includes(id));
  const hasLineage = lineageCaptured.length > 0;
  const lastAttemptDay = progress?.lastAttemptDay || null;
  const nextAttemptDay = lastAttemptDay ? shiftDay(lastAttemptDay, SALAMENCE.cooldownDays) : null;
  const cooldown = nextAttemptDay !== null && today < nextAttemptDay;
  const needs = {
    lineage: !hasLineage,
    days: Math.max(0, SALAMENCE.minDays - days),
    modes: Object.fromEntries(Object.entries(SALAMENCE.modes).map(([mode, target]) =>
      [mode, Math.max(0, target - wins[mode])])),
  };
  return {
    pokemonId: SALAMENCE.pokemonId,
    lineageIds: lineageCaptured, hasLineage,
    wins, days,
    goal: { modes: SALAMENCE.modes, days: SALAMENCE.minDays },
    needs, nextAttemptDay, cooldown,
    eligible: !cooldown && !needs.lineage && needs.days === 0 &&
      Object.values(needs.modes).every((n) => n === 0),
  };
}
module.exports = { SALAMENCE, statusForSalamence, verifyDreamAnswer };
