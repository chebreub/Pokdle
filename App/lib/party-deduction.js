"use strict";

function startDeductionRound(room, catalogue, random = Math.random) {
  const pool = catalogue.filter(p => p && room.selectedGens.includes(Number(p.gen) || Number(p.generation)));
  room.target = pool[Math.floor(random() * pool.length)] || null;
  room.status = room.target ? "playing" : "waiting";
  room.roundSerial = (room.roundSerial || 0) + 1;
  room.deductionWinnerId = null;
  room.variant = null;
  room.typeCombo = null;
  room.nearestTarget = null;
  room.roundPlayerIds = room.players.filter(p => p.connected).map(p => p.id);
  for (const player of room.players) {
    player.correct = false;
    player.lastGain = 0;
    player.guesses = [];
    player.attempts = 0;
    player.gaveUp = false;
    player.pickKey = null;
    player.nearestPick = null;
  }
}

function validateDeductionAction(room, player, serial) {
  if (!room || room.gameMode !== "deduction" || room.status !== "playing" || !room.target) return "Aucune manche de déduction en cours.";
  if (serial !== room.roundSerial) return "Cette manche a changé.";
  if (room.deadlineAt && Date.now() >= room.deadlineAt) return "Le temps est écoulé.";
  if (!player || !player.connected || !room.players.includes(player) || !room.roundPlayerIds.includes(player.id)) return "Tu ne participes pas à cette manche.";
  if (player.gaveUp) return "Tu as abandonné cette manche.";
  if (player.correct) return "Tu as déjà trouvé.";
  return null;
}

function submitDeduction(room, player, raw, serial, resolvePokemon, buildFeedback) {
  const error = validateDeductionAction(room, player, serial);
  if (error) return { error };
  const name = String(raw || "").trim();
  if (!name || name.length > 100) return { error: "Choisis un Pokémon dans la liste." };
  const pokemon = resolvePokemon(room, name);
  if (!pokemon) return { error: "Pokémon indisponible dans les générations choisies." };
  if (player.guesses.some(entry => entry.id === pokemon.id)) return { error: "Tu as déjà proposé ce Pokémon." };
  player.guesses.unshift(buildFeedback(pokemon, room.target));
  player.attempts = player.guesses.length;
  const correct = pokemon.id === room.target.id;
  if (correct) {
    player.correct = true;
    player.lastGain = 100;
    player.score = (Number(player.score) || 0) + 100;
    room.deductionWinnerId = player.id;
  }
  return { correct, gained: correct ? 100 : 0 };
}

function allDeductionPlayersGaveUp(room) {
  return room.players.filter(p => p.connected && room.roundPlayerIds.includes(p.id)).every(p => p.gaveUp);
}

function forfeitDeduction(room, player, serial) {
  const error = validateDeductionAction(room, player, serial);
  if (error) return { error };
  player.gaveUp = true;
  return { abandoned: true };
}

function publicDeductionRound(room, revealed) {
  return {
    mode: "deduction",
    roundSerial: room.roundSerial,
    answer: revealed && room.target ? room.target.name : null,
    image: revealed && room.target ? room.target.sprite || null : null,
    winnerId: revealed ? room.deductionWinnerId || null : null,
  };
}

module.exports = { startDeductionRound, submitDeduction, forfeitDeduction, allDeductionPlayersGaveUp, publicDeductionRound };
