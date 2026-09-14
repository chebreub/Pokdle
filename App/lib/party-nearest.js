"use strict";

// The server owns the target, locked proposals and scoring. No PokeAPI request
// is needed: National Pokédex numbers come from our bundled species catalogue.
function nearestPool(catalogue, gens) {
  return catalogue.filter(p => !p.isAltForm && Number(p.id) > 0 && Number(p.id) < 10000 && gens.includes(Number(p.gen || p.generation)));
}

function startNearestRound(room, catalogue, random = Math.random) {
  const pool = nearestPool(catalogue, room.selectedGens);
  if (!pool.length) throw new Error("Aucun Pokémon disponible pour ces générations.");
  const fresh = pool.filter(p => Number(p.id) !== room.nearestTarget);
  const choices = fresh.length ? fresh : pool;
  room.target = choices[Math.floor(random() * choices.length)];
  room.nearestTarget = Number(room.target.id);
  room.roundSerial = (room.roundSerial || 0) + 1;
  room.nearestResolved = false;
  room.status = "playing";
  room.roundPlayerIds = room.players.filter(p => p.connected).map(p => p.id);
  for (const p of room.players) {
    p.nearestPick = null;
    p.correct = false;
    p.lastGain = 0;
    p.pickKey = null;
  }
}

function submitNearest(room, player, guess, roundSerial, catalogue, normalize, now = Date.now()) {
  if (room.status !== "playing" || now >= room.deadlineAt || roundSerial !== room.roundSerial) {
    return { error: "Cette manche est terminée ou a changé." };
  }
  if (!player.connected || !room.roundPlayerIds.includes(player.id)) return { error: "Tu ne participes pas à cette manche." };
  if (player.nearestPick) return { already: true };
  const name = typeof guess === "string" ? normalize(guess.slice(0, 100)) : "";
  const pokemon = name && nearestPool(catalogue, room.selectedGens).find(p => normalize(p.name) === name);
  if (!pokemon) return { error: "Choisis un Pokémon des générations sélectionnées (sans forme alternative)." };
  player.nearestPick = { id: Number(pokemon.id), name: pokemon.name, sprite: pokemon.sprite || null };
  return { submitted: true };
}

function allNearestSubmitted(room) {
  const active = room.players.filter(p => p.connected && room.roundPlayerIds.includes(p.id));
  return active.length > 0 && active.every(p => p.nearestPick);
}

function scoreNearestRound(room) {
  if (room.status !== "playing" || room.nearestResolved) return false;
  room.nearestResolved = true;
  const entries = room.players.filter(p => room.roundPlayerIds.includes(p.id) && p.nearestPick);
  const best = Math.min(...entries.map(p => Math.abs(p.nearestPick.id - room.nearestTarget)));
  for (const p of room.players) {
    p.correct = entries.includes(p) && Math.abs(p.nearestPick.id - room.nearestTarget) === best;
    p.lastGain = p.correct ? 100 : 0;
    p.score = (Number(p.score) || 0) + p.lastGain;
  }
  return true;
}

function publicNearestRound(room, revealed) {
  return {
    mode: "nearest", targetNumber: room.nearestTarget, roundSerial: room.roundSerial,
    answer: revealed && room.target ? { id: Number(room.target.id), name: room.target.name, sprite: room.target.sprite || null } : null,
    results: revealed ? room.players.map(p => ({
      playerId: p.id, nickname: p.nickname, pokemon: p.nearestPick || null,
      distance: p.nearestPick ? Math.abs(p.nearestPick.id - room.nearestTarget) : null,
      winner: Boolean(p.correct), gained: p.lastGain || 0,
    })).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)) : null,
  };
}

module.exports = { nearestPool, startNearestRound, submitNearest, allNearestSubmitted, scoreNearestRound, publicNearestRound };
