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
// ECO-02 G: one lighter retry after the very first failed encounter. The
// original quest, cooldown, 30-day window and capture mechanics stay unchanged.
const SALAMENCE_RECOVERY = Object.freeze({ minDays: 3, winsPerMode: 2 });
const DREAM_ANSWER = "drackhaus";
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
// The daily date comes from dailyCalendar(clock()).day (Europe/Paris), so the
// event must use that calendar day and never the server machine's local time.
function recoveryForSalamence(status, attempts, today, shiftDay) {
  const firstFailed = attempts.length === 1 && attempts[0].status === "fled";
  const goal = {
    days: SALAMENCE_RECOVERY.minDays,
    modes: Object.fromEntries(Object.keys(SALAMENCE.modes).map((mode) => [mode, SALAMENCE_RECOVERY.winsPerMode])),
  };
  const needs = {
    days: Math.max(0, goal.days - status.days),
    modes: Object.fromEntries(Object.keys(goal.modes).map((mode) =>
      [mode, Math.max(0, goal.modes[mode] - (status.wins[mode] || 0))])),
  };
  const weekday = new Date(today + "T12:00:00Z").getUTCDay();
  const weekendOpen = weekday === 0 || weekday === 6; // Saturday/Sunday, Paris day
  const nextEventDay = shiftDay(today, (6 - weekday + 7) % 7);
  const ready = firstFailed && status.hasLineage && !status.cooldown && needs.days === 0 &&
    Object.values(needs.modes).every((missing) => missing === 0);
  return { active: firstFailed, goal, needs, ready, weekendOpen, nextEventDay, available: ready && weekendOpen };
}
module.exports = { SALAMENCE, SALAMENCE_RECOVERY, statusForSalamence, recoveryForSalamence, verifyDreamAnswer };
