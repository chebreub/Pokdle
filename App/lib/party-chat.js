"use strict";
// The Party Room chat: short messages and quick reactions between the players of one room.
// Nothing is stored: a message is relayed to the room and forgotten. No links, and a message
// that names the Pokémon being guessed is hidden from the others until the round ends.

const MAX_LENGTH = 120;
const REACTIONS = ["😂", "🔥", "👏", "😱"];
// « www.site », « http… » or « mot.fr/… » style addresses: the chat is for talking, not for links.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|fr|net|org|io|gg|be|ch|ca|ly|xyz|me|tv|co)\b)/i;

function cleanChatText(value) {
  const text = String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return { error: "Message vide." };
  if (text.length > MAX_LENGTH) return { error: `${MAX_LENGTH} caractères au plus.` };
  if (LINK.test(text)) return { error: "Pas de liens dans le chat." };
  return { text };
}

// Letters and digits only, without accents: « Pikachuuu ! » still contains « pikachu ».
function squash(value) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
}

function namesAnswer(text, names) {
  const said = squash(text);
  return names.some((name) => {
    const key = squash(name);
    return key.length >= 3 && said.includes(key);
  });
}

// The names a message must not give away right now, whatever mini-game the room plays.
function hiddenAnswers(room, pokemonName) {
  if (!room || room.status !== "playing") return [];
  const names = [];
  if (room.target && room.target.id && room.target.name) names.push(room.target.name);
  if (room.dessin && room.dessin.target && room.dessin.target.name) names.push(room.dessin.target.name);
  for (const player of room.players || []) {
    if (player.quiSecretId != null) {
      const name = pokemonName(player.quiSecretId);
      if (name) names.push(name);
    }
  }
  return names;
}

// One message, as the sender sees it and as the others see it.
function chatMessage(room, player, payload, { pokemonName = () => null, now = Date.now(), id } = {}) {
  if (!room || !player) return { error: "Tu n'es pas dans ce salon." };
  const base = { id, playerId: player.id, nickname: String(player.nickname || "Joueur").slice(0, 24), at: now };
  if (payload && payload.reaction != null) {
    if (!REACTIONS.includes(payload.reaction)) return { error: "Réaction inconnue." };
    const message = { ...base, reaction: payload.reaction };
    return { mine: message, others: message };
  }
  const cleaned = cleanChatText(payload && payload.text);
  if (cleaned.error) return cleaned;
  if (namesAnswer(cleaned.text, hiddenAnswers(room, pokemonName))) {
    return { mine: { ...base, text: cleaned.text, masked: true }, others: { ...base, masked: true } };
  }
  const message = { ...base, text: cleaned.text };
  return { mine: message, others: message };
}

module.exports = { MAX_LENGTH, REACTIONS, cleanChatText, namesAnswer, hiddenAnswers, chatMessage };
