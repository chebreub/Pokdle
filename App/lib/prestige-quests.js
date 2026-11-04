"use strict";
// Unlike the Pokédex's client-side album claims, these requirements are
// computed from wins that the server verified and recorded after release.
const SALAMENCE = Object.freeze({
  pokemonId: 373,
  minDays: 14,
  minWins: 28,
  minModes: 5,
  windowDays: 45,
  cooldownDays: 21,
});

function statusForSalamence(progress, today, shiftDay) {
  const wins = Math.max(0, Number(progress.wins) || 0);
  const days = Math.max(0, Number(progress.days) || 0);
  const modes = Math.max(0, Number(progress.modes) || 0);
  const lastAttemptDay = progress.lastAttemptDay || null;
  const nextAttemptDay = lastAttemptDay ? shiftDay(lastAttemptDay, SALAMENCE.cooldownDays) : null;
  const cooldown = nextAttemptDay !== null && today < nextAttemptDay;
  const needs = {
    days: Math.max(0, SALAMENCE.minDays - days),
    wins: Math.max(0, SALAMENCE.minWins - wins),
    modes: Math.max(0, SALAMENCE.minModes - modes),
  };
  return {
    pokemonId: SALAMENCE.pokemonId,
    days, wins, modes,
    goal: { days: SALAMENCE.minDays, wins: SALAMENCE.minWins, modes: SALAMENCE.minModes },
    needs,
    nextAttemptDay,
    cooldown,
    eligible: !cooldown && Object.values(needs).every((n) => n === 0),
  };
}
module.exports = { SALAMENCE, statusForSalamence };
