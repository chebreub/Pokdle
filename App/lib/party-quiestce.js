"use strict";

// Qui est-ce ? Pokémon in the Party Room, as the real game: two players, the same
// grid of 24, and each one secretly CHOOSES a Pokémon. Turn by turn, a player asks
// one question about the rival's Pokémon (a preset button, a written question, or
// one asked out loud) and the RIVAL answers yes or no. One question per category,
// five in all; a wrong guess only loses the turn. Preset questions flip the asker's
// cards from the rival's answer; otherwise players flip their own cards.
const GRID_SIZE = 24;
const WIN_POINTS = 100;
const CATEGORIES = ["type", "gen", "color", "body", "more"];
const TEXT_MAX = 90;
const LOG_MAX = 60;
const norm = value => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const letters = p => norm(p.name).replace(/[^a-z]/g, "");
const gen = p => Number(p.gen) || Number(p.generation) || 0;

// Preset questions: same ids as the solo game (src/script.10u.qui-est-ce.js).
const QUESTIONS = new Map();
const QUESTION_CATEGORY = new Map();
function preset(id, category, test) { QUESTIONS.set(id, test); QUESTION_CATEGORY.set(id, category); }
["Normal", "Feu", "Eau", "Plante", "Électrik", "Glace", "Combat", "Poison", "Sol", "Vol", "Psy", "Insecte", "Roche", "Spectre", "Dragon", "Ténèbres", "Acier", "Fée"]
  .forEach(t => preset("type:" + t, "type", p => norm(p.type1) === norm(t) || norm(p.type2) === norm(t)));
preset("dual", "type", p => Boolean(p.type2));
for (let g = 1; g <= 9; g += 1) preset("gen:" + g, "gen", p => gen(p) === g);
preset("gen:old", "gen", p => gen(p) <= 4);
["Rouge", "Bleu", "Vert", "Jaune", "Violet", "Rose", "Brun", "Noir", "Blanc", "Gris"]
  .forEach(c => preset("color:" + c, "color", p => norm(p.color) === norm(c)));
preset("stage:1", "body", p => Number(p.stage) === 1);
preset("stage:2", "body", p => Number(p.stage) === 2);
preset("stage:3", "body", p => Number(p.stage) === 3);
preset("height:small", "body", p => Number(p.height) < 0.5);
preset("height:1", "body", p => Number(p.height) > 1);
preset("height:2", "body", p => Number(p.height) > 2);
preset("weight:10", "body", p => Number(p.weight) > 10);
preset("weight:100", "body", p => Number(p.weight) > 100);
["Prairie", "Forêt", "Eau douce", "Mer", "Montagne", "Grotte", "Sentier accidenté", "Urbain", "Rare"]
  .forEach(h => preset("habitat:" + h, "more", p => norm(p.habitat) === norm(h)));
preset("name:am", "more", p => letters(p).charAt(0) <= "m");
preset("name:long", "more", p => letters(p).length > 7);

function duelists(room) { return room.players.filter(p => (room.roundPlayerIds || []).includes(p.id)); }
function rivalOf(room, player) { return duelists(room).find(p => p.id !== player.id) || null; }
function cleanText(value) { return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, TEXT_MAX); }
function log(room, entry) { room.quiLog.push(entry); if (room.quiLog.length > LOG_MAX) room.quiLog.shift(); }
function passTurn(room, player) { const rival = rivalOf(room, player); room.quiTurnId = rival ? rival.id : null; }

function startQuiEstCeDuel(room, catalogue, random = Math.random) {
  const gens = Array.isArray(room.selectedGens) && room.selectedGens.length ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pool = catalogue.filter(p => p && p.guessable !== false && !p.isAltForm && Number(p.id) > 0 && Number(p.id) <= 1025 && gens.includes(gen(p)));
  const ids = pool.map(p => Number(p.id));
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const pair = room.players.filter(p => p.connected).slice(0, 2);
  room.quiCards = ids.slice(0, GRID_SIZE);
  room.quiPokemon = new Map(room.quiCards.map(id => [id, pool.find(p => Number(p.id) === id)]));
  room.roundPlayerIds = pair.map(p => p.id);
  room.roundSerial = (room.roundSerial || 0) + 1;
  room.quiPhase = "choose";
  room.quiTurnId = null;
  room.quiPending = null;
  room.quiLog = [];
  room.quiWinnerId = null;
  room.quiEndReason = null;
  room.deductionWinnerId = null;
  room.variant = null;
  room.typeCombo = null;
  room.nearestTarget = null;
  const ready = pair.length === 2 && room.quiCards.length >= 2;
  // Generic room guards only check that a round has a target: never expose a real one.
  room.target = ready ? { id: 0, name: "", sprite: null } : null;
  room.status = ready ? "playing" : "waiting";
  for (const player of room.players) {
    player.correct = false;
    player.lastGain = 0;
    player.attempts = 0;
    player.gaveUp = false;
    player.guesses = [];
    player.pickKey = null;
    player.nearestPick = null;
    player.quiSecretId = null;
    player.quiOut = [];
    player.quiUsed = [];
  }
}

function check(room, player, serial, { phase = "play", turn = false } = {}) {
  if (!room || room.gameMode !== "quiestce1v1" || room.status !== "playing") return "Aucune partie de Qui est-ce ? en cours.";
  if (serial !== room.roundSerial) return "Cette manche a changé.";
  if (!player || !player.connected || !(room.roundPlayerIds || []).includes(player.id)) return "Tu regardes cette partie.";
  if (player.gaveUp || player.correct) return "Cette partie est finie pour toi.";
  if (room.quiPhase !== phase) return phase === "choose" ? "Les Pokémon secrets sont déjà choisis." : "Attends que les deux joueurs aient choisi leur Pokémon.";
  if (turn && room.quiTurnId !== player.id) return "Ce n’est pas ton tour.";
  if (turn && room.quiPending) return "Attends la réponse à ta question.";
  return null;
}

function chooseSecret(room, player, pokemonId, serial, random = Math.random) {
  const error = check(room, player, serial, { phase: "choose" });
  if (error) return { error };
  const id = Number(pokemonId);
  if (!room.quiCards.includes(id)) return { error: "Choisis un Pokémon de la grille." };
  if (player.quiSecretId != null) return { error: "Tu as déjà choisi ton Pokémon." };
  player.quiSecretId = id;
  const pair = duelists(room);
  if (pair.every(p => p.quiSecretId != null)) {
    room.quiPhase = "play";
    room.quiTurnId = pair[Math.floor(random() * pair.length)].id;
  }
  return { chosen: true, started: room.quiPhase === "play" };
}

function askQuestion(room, player, payload, serial) {
  const error = check(room, player, serial, { turn: true });
  if (error) return { error };
  const category = String(payload?.category || "");
  if (!CATEGORIES.includes(category)) return { error: "Choisis une catégorie." };
  if (player.quiUsed.includes(category)) return { error: "Tu as déjà posé ta question dans cette catégorie." };
  const questionId = payload?.questionId ? String(payload.questionId) : null;
  const oral = Boolean(payload?.oral) && !questionId;
  const text = questionId || oral ? "" : cleanText(payload?.text);
  if (questionId && QUESTION_CATEGORY.get(questionId) !== category) return { error: "Question inconnue dans cette catégorie." };
  if (!questionId && !oral && !text) return { error: "Écris ta question ou choisis-en une." };
  player.quiUsed.push(category);
  player.attempts += 1;
  if (oral) {
    // Asked and answered out loud: nothing to wait for, the turn passes.
    log(room, { by: player.id, kind: "oral", category, answer: null });
    passTurn(room, player);
    return { asked: true, oral: true };
  }
  room.quiPending = { askerId: player.id, category, questionId, text };
  log(room, { by: player.id, kind: "ask", category, questionId, text, answer: null });
  return { asked: true };
}

function answerQuestion(room, player, answer, serial) {
  const error = check(room, player, serial);
  if (error) return { error };
  const pending = room.quiPending;
  if (!pending || pending.askerId === player.id) return { error: "Aucune question ne t’attend." };
  if (answer !== "oui" && answer !== "non") return { error: "Réponds par oui ou par non." };
  const asker = room.players.find(p => p.id === pending.askerId);
  const entry = [...room.quiLog].reverse().find(item => item.kind === "ask" && item.by === pending.askerId && item.answer === null);
  if (entry) entry.answer = answer;
  let flipped = [];
  if (asker && pending.questionId && QUESTIONS.has(pending.questionId)) {
    // Preset question: turn down the asker's cards that no longer match the answer.
    const test = QUESTIONS.get(pending.questionId), yes = answer === "oui";
    flipped = room.quiCards.filter(id => !asker.quiOut.includes(id) && Boolean(test(room.quiPokemon.get(id) || {})) !== yes);
    asker.quiOut.push(...flipped);
  }
  room.quiPending = null;
  room.quiTurnId = player.id;
  return { answered: true, flipped };
}

function flipCard(room, player, pokemonId, serial) {
  const error = check(room, player, serial);
  if (error) return { error };
  const id = Number(pokemonId);
  if (!room.quiCards.includes(id)) return { error: "Carte inconnue." };
  const at = player.quiOut.indexOf(id);
  if (at >= 0) player.quiOut.splice(at, 1); else player.quiOut.push(id);
  return { flipped: at < 0 };
}

function guessSecret(room, player, pokemonId, serial) {
  const error = check(room, player, serial, { turn: true });
  if (error) return { error };
  const id = Number(pokemonId);
  if (!room.quiCards.includes(id)) return { error: "Choisis un Pokémon de la grille." };
  const rival = rivalOf(room, player);
  const correct = Boolean(rival) && id === Number(rival.quiSecretId);
  log(room, { by: player.id, kind: "guess", pokemonId: id, correct });
  if (correct) {
    player.correct = true;
    player.lastGain = WIN_POINTS;
    player.score = (Number(player.score) || 0) + WIN_POINTS;
    room.quiWinnerId = player.id;
    room.quiEndReason = "found";
    room.quiTurnId = null;
    return { correct: true, gained: WIN_POINTS };
  }
  // A wrong guess only costs the turn; that card goes down.
  if (!player.quiOut.includes(id)) player.quiOut.push(id);
  passTurn(room, player);
  return { correct: false, gained: 0 };
}

// Giving up hands the game to the rival.
function forfeitDuel(room, player, serial) {
  if (!room || room.gameMode !== "quiestce1v1" || room.status !== "playing") return { error: "Aucune partie de Qui est-ce ? en cours." };
  if (serial !== room.roundSerial) return { error: "Cette manche a changé." };
  if (!player || !(room.roundPlayerIds || []).includes(player.id) || player.gaveUp || player.correct) return { error: "Cette partie est finie pour toi." };
  player.gaveUp = true;
  const rival = rivalOf(room, player);
  if (rival) {
    rival.correct = true;
    rival.lastGain = WIN_POINTS;
    rival.score = (Number(rival.score) || 0) + WIN_POINTS;
    room.quiWinnerId = rival.id;
  }
  room.quiEndReason = "forfeit";
  room.quiTurnId = null;
  room.quiPending = null;
  return { abandoned: true, ended: true };
}

// Each player sees their own secret and board; the rival's secret only at the end.
function publicQuiEstCeDuel(room, viewerId, revealed) {
  const me = room.players.find(p => p.id === viewerId);
  const pair = duelists(room);
  const inGame = Boolean(me && pair.includes(me));
  const playing = room.status === "playing";
  return {
    mode: "quiestce1v1",
    roundSerial: room.roundSerial,
    phase: room.quiPhase || "choose",
    cards: (room.quiCards || []).slice(),
    duelistIds: pair.map(p => p.id),
    chosen: pair.map(p => ({ id: p.id, chosen: p.quiSecretId != null })),
    turnId: playing ? room.quiTurnId || null : null,
    pending: playing && room.quiPending ? { ...room.quiPending } : null,
    log: (room.quiLog || []).map(entry => ({ ...entry })),
    mySecretId: inGame && me.quiSecretId != null ? Number(me.quiSecretId) : null,
    myUsed: inGame ? (me.quiUsed || []).slice() : [],
    secrets: revealed ? pair.map(p => ({ id: p.id, pokemonId: p.quiSecretId != null ? Number(p.quiSecretId) : null })) : null,
    answer: null,
    image: null,
    winnerId: revealed ? room.quiWinnerId || null : null,
    endReason: revealed ? room.quiEndReason || null : null,
    mine: inGame ? { out: (me.quiOut || []).slice() } : { out: [] },
  };
}

function quiEstCeRemainingCount(room, player) {
  return room.gameMode === "quiestce1v1" ? (room.quiCards || []).filter(id => !(player.quiOut || []).includes(id)).length : 0;
}

module.exports = {
  QUESTIONS, QUESTION_CATEGORY, CATEGORIES, GRID_SIZE, startQuiEstCeDuel, chooseSecret, askQuestion,
  answerQuestion, flipCard, guessSecret, forfeitDuel, publicQuiEstCeDuel, quiEstCeRemainingCount,
};
