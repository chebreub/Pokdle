"use strict";

// Qui est-ce ? Pokémon in the Party Room: everybody races on the same mystery.
// One grid of 24 for all, private questions and answers, the first to find it wins
// the round. Question ids match the solo game (src/script.10u.qui-est-ce.js); the
// answers are always computed here, never trusted from a client.
const GRID_SIZE = 24;
const WRONG_GUESS_COST = 2;
const WIN_POINTS = 100;
const norm = value => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const letters = p => norm(p.name).replace(/[^a-z]/g, "");
const gen = p => Number(p.gen) || Number(p.generation) || 0;

const QUESTIONS = new Map();
["Normal", "Feu", "Eau", "Plante", "Électrik", "Glace", "Combat", "Poison", "Sol", "Vol", "Psy", "Insecte", "Roche", "Spectre", "Dragon", "Ténèbres", "Acier", "Fée"]
  .forEach(t => QUESTIONS.set("type:" + t, p => norm(p.type1) === norm(t) || norm(p.type2) === norm(t)));
QUESTIONS.set("dual", p => Boolean(p.type2));
for (let g = 1; g <= 9; g += 1) QUESTIONS.set("gen:" + g, p => gen(p) === g);
QUESTIONS.set("gen:old", p => gen(p) <= 4);
["Rouge", "Bleu", "Vert", "Jaune", "Violet", "Rose", "Brun", "Noir", "Blanc", "Gris"]
  .forEach(c => QUESTIONS.set("color:" + c, p => norm(p.color) === norm(c)));
QUESTIONS.set("stage:1", p => Number(p.stage) === 1);
QUESTIONS.set("stage:2", p => Number(p.stage) === 2);
QUESTIONS.set("stage:3", p => Number(p.stage) === 3);
QUESTIONS.set("height:small", p => Number(p.height) < 0.5);
QUESTIONS.set("height:1", p => Number(p.height) > 1);
QUESTIONS.set("height:2", p => Number(p.height) > 2);
QUESTIONS.set("weight:10", p => Number(p.weight) > 10);
QUESTIONS.set("weight:100", p => Number(p.weight) > 100);
["Prairie", "Forêt", "Eau douce", "Mer", "Montagne", "Grotte", "Sentier accidenté", "Urbain", "Rare"]
  .forEach(h => QUESTIONS.set("habitat:" + h, p => norm(p.habitat) === norm(h)));
QUESTIONS.set("name:am", p => letters(p).charAt(0) <= "m");
QUESTIONS.set("name:long", p => letters(p).length > 7);

function startQuiEstCeRound(room, catalogue, random = Math.random) {
  const gens = Array.isArray(room.selectedGens) && room.selectedGens.length ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pool = catalogue.filter(p => p && p.guessable !== false && !p.isAltForm && Number(p.id) > 0 && Number(p.id) <= 1025 && gens.includes(gen(p)));
  const ids = pool.map(p => Number(p.id));
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const cards = ids.slice(0, GRID_SIZE);
  room.quiCards = cards;
  room.quiPokemon = new Map(cards.map(id => [id, pool.find(p => Number(p.id) === id)]));
  room.target = cards.length >= 2 ? room.quiPokemon.get(cards[Math.floor(random() * cards.length)]) || null : null;
  room.status = room.target ? "playing" : "waiting";
  room.roundSerial = (room.roundSerial || 0) + 1;
  room.quiWinnerId = null;
  room.deductionWinnerId = null;
  room.variant = null;
  room.typeCombo = null;
  room.nearestTarget = null;
  room.roundPlayerIds = room.players.filter(p => p.connected).map(p => p.id);
  for (const player of room.players) {
    player.correct = false;
    player.lastGain = 0;
    player.attempts = 0;
    player.gaveUp = false;
    player.guesses = [];
    player.pickKey = null;
    player.nearestPick = null;
    player.quiOut = [];
    player.quiAsked = [];
  }
}

function validateQuiEstCeAction(room, player, serial) {
  if (!room || room.gameMode !== "quiestce" || room.status !== "playing" || !room.target) return "Aucune manche de Qui est-ce ? en cours.";
  if (serial !== room.roundSerial) return "Cette manche a changé.";
  if (room.deadlineAt && Date.now() >= room.deadlineAt) return "Le temps est écoulé.";
  if (!player || !player.connected || !room.players.includes(player) || !room.roundPlayerIds.includes(player.id)) return "Tu ne participes pas à cette manche.";
  if (player.gaveUp) return "Tu as abandonné cette manche.";
  if (player.correct) return "Tu as déjà trouvé.";
  return null;
}

function remainingCards(room, player) {
  return (room.quiCards || []).filter(id => !(player.quiOut || []).includes(id));
}

function askQuiEstCe(room, player, questionId, serial) {
  const error = validateQuiEstCeAction(room, player, serial);
  if (error) return { error };
  const id = String(questionId || "");
  const test = QUESTIONS.get(id);
  if (!test) return { error: "Question inconnue." };
  if (player.quiAsked.some(entry => entry.id === id)) return { error: "Tu as déjà posé cette question." };
  const remaining = remainingCards(room, player);
  const yes = remaining.filter(cardId => test(room.quiPokemon.get(cardId) || {})).length;
  if (yes === 0 || yes === remaining.length) return { error: "Cette question ne départage plus aucune carte." };
  const answer = Boolean(test(room.target));
  const flipped = remaining.filter(cardId => Boolean(test(room.quiPokemon.get(cardId) || {})) !== answer);
  player.quiOut.push(...flipped);
  player.quiAsked.unshift({ id, answer });
  player.attempts += 1;
  return { answer, flipped };
}

function proposeQuiEstCe(room, player, pokemonId, serial) {
  const error = validateQuiEstCeAction(room, player, serial);
  if (error) return { error };
  const id = Number(pokemonId);
  if (!room.quiCards.includes(id) || player.quiOut.includes(id)) return { error: "Choisis une carte encore debout." };
  if (id === Number(room.target.id)) {
    player.correct = true;
    player.lastGain = WIN_POINTS;
    player.score = (Number(player.score) || 0) + WIN_POINTS;
    room.quiWinnerId = player.id;
    return { correct: true, gained: WIN_POINTS };
  }
  player.quiOut.push(id);
  player.attempts += WRONG_GUESS_COST;
  return { correct: false, gained: 0 };
}

function forfeitQuiEstCe(room, player, serial) {
  const error = validateQuiEstCeAction(room, player, serial);
  if (error) return { error };
  player.gaveUp = true;
  return { abandoned: true };
}

function allQuiEstCePlayersGaveUp(room, now = Date.now()) {
  const active = room.players.filter(p => room.roundPlayerIds.includes(p.id) && (p.connected || Number(p.reconnectUntil) > now));
  return active.length > 0 && active.every(p => p.gaveUp);
}

// The grid is shared; each player only ever receives their own flipped cards and
// answers. The mystery leaves the server only once the round is over.
function publicQuiEstCeRound(room, viewerId, revealed) {
  const me = room.players.find(p => p.id === viewerId);
  return {
    mode: "quiestce",
    roundSerial: room.roundSerial,
    cards: (room.quiCards || []).slice(),
    answer: revealed && room.target ? room.target.name : null,
    answerId: revealed && room.target ? Number(room.target.id) : null,
    image: revealed && room.target ? room.target.sprite || null : null,
    winnerId: revealed ? room.quiWinnerId || null : null,
    mine: me ? { out: (me.quiOut || []).slice(), asked: (me.quiAsked || []).map(entry => ({ ...entry })) } : null,
  };
}

function quiEstCeRemainingCount(room, player) {
  return room.gameMode === "quiestce" ? remainingCards(room, player).length : 0;
}

module.exports = {
  QUESTIONS, GRID_SIZE, WRONG_GUESS_COST, startQuiEstCeRound, askQuiEstCe, proposeQuiEstCe,
  forfeitQuiEstCe, allQuiEstCePlayersGaveUp, publicQuiEstCeRound, quiEstCeRemainingCount,
};
