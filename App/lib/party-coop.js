"use strict";
const { startDeductionRound } = require("./party-deduction");
const MAX_ATTEMPTS = 12;
function clueDeck(pokemon) {
  const present = value => value === undefined || value === null || value === "" ? "Non renseigné" : String(value);
  return [
    { label: "Génération", value: "Génération " + present(pokemon.gen || pokemon.generation) },
    { label: "Types", value: [pokemon.type1, pokemon.type2].filter(v => v && v !== "Aucun").join(" / ") || "Non renseignés" },
    { label: "Forme", value: pokemon.isAltForm ? "C’est une forme alternative." : "C’est une forme de base." },
    { label: "Habitat", value: present(pokemon.habitat) },
    { label: "Couleur", value: present(pokemon.color) },
    { label: "Évolution", value: "Stade " + present(pokemon.stage) },
    { label: "Taille", value: Number.isFinite(Number(pokemon.height)) ? (Number(pokemon.height) < 1 ? "Moins de 1 m" : Number(pokemon.height) < 2 ? "De 1 m à moins de 2 m" : "Au moins 2 m") : "Non renseignée" },
    { label: "Poids", value: Number.isFinite(Number(pokemon.weight)) ? (Number(pokemon.weight) < 10 ? "Moins de 10 kg" : Number(pokemon.weight) < 100 ? "De 10 à moins de 100 kg" : "Au moins 100 kg") : "Non renseigné" }
  ];
}
function startCoopRound(room, catalogue, random = Math.random) {
  startDeductionRound(room, catalogue, random);
  room.coopGuesses = [];
  room.coopSolved = false;
  room.coopClues = {};
  if (!room.target) return;
  const clues = clueDeck(room.target);
  // Distribute the full deck across players, with no duplicate private clue.
  const offset = Math.floor(random() * clues.length);
  room.roundPlayerIds.forEach((id, index) => {
    room.coopClues[id] = { clues: clues.filter((_, i) => i % room.roundPlayerIds.length === index).map((_, j) => clues[(index + j * room.roundPlayerIds.length + offset) % clues.length]), shared: false };
  });
}
function validate(room, player, serial) {
  if (!room || room.gameMode !== "coop" || room.status !== "playing" || !room.target) return "Aucune enquête en cours.";
  if (serial !== room.roundSerial) return "Cette manche a changé.";
  if (room.deadlineAt && Date.now() >= room.deadlineAt) return "Le temps est écoulé.";
  if (!player?.connected || !room.players.includes(player) || !room.roundPlayerIds.includes(player.id)) return "Tu ne participes pas à cette manche.";
  return null;
}
function submitCoop(room, player, raw, serial, resolvePokemon) {
  const error = validate(room, player, serial);
  if (error) return { error };
  const name = String(raw || "").trim();
  if (!name || name.length > 100) return { error: "Choisis un Pokémon dans la liste." };
  const pokemon = resolvePokemon(room, name);
  if (!pokemon) return { error: "Pokémon indisponible dans les générations choisies." };
  if (room.coopGuesses.some(g => g.id === pokemon.id)) return { error: "L’équipe a déjà essayé ce Pokémon." };
  if (room.coopGuesses.length >= MAX_ATTEMPTS) return { error: "Les 12 essais ont été utilisés." };
  const correct = pokemon.id === room.target.id;
  room.coopGuesses.unshift({ id: pokemon.id, name: pokemon.name, nickname: player.nickname, correct });
  player.attempts = (player.attempts || 0) + 1;
  if (correct) {
    room.coopSolved = true;
    for (const member of room.players.filter(p => room.roundPlayerIds.includes(p.id))) {
      member.correct = true;
      member.lastGain = 100;
      member.score = (Number(member.score) || 0) + 100;
    }
  }
  return { correct, gained: correct ? 100 : 0, ended: correct || room.coopGuesses.length >= MAX_ATTEMPTS };
}
function shareClue(room, player, serial) {
  const error = validate(room, player, serial);
  if (error) return { error };
  room.coopClues[player.id].shared = true;
  return { shared: true };
}
function publicCoopRound(room, viewerId, revealed) {
  const mine = room.roundPlayerIds.includes(viewerId) ? room.coopClues?.[viewerId] : null;
  return {
    mode: "coop", roundSerial: room.roundSerial,
    answer: revealed ? room.target?.name || null : null,
    image: revealed ? room.target?.sprite || null : null,
    solved: Boolean(room.coopSolved), maxAttempts: MAX_ATTEMPTS,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - (room.coopGuesses || []).length),
    myClues: mine?.clues || [], myCluesShared: Boolean(mine?.shared),
    sharedClues: Object.entries(room.coopClues || {}).filter(([id, entry]) => entry.shared || revealed || !room.players.some(p => p.id === id && p.connected)).map(([id, entry]) => ({
      nickname: room.players.find(p => p.id === id)?.nickname || "Joueur parti", clues: entry.clues
    })),
    guesses: (room.coopGuesses || []).map(g => ({ name: g.name, nickname: g.nickname, correct: g.correct }))
  };
}
module.exports = { MAX_ATTEMPTS, clueDeck, startCoopRound, submitCoop, shareClue, publicCoopRound };
