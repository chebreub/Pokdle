"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const party = require("../lib/party-quiestce");

const TYPES = ["Feu", "Eau", "Plante", "Électrik", "Psy", "Roche"];
const catalogue = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1, name: "Pkmn" + String.fromCharCode(65 + (i % 26)) + i, gen: (i % 3) + 1,
  type1: TYPES[i % 6], type2: i % 5 === 0 ? "Vol" : null, color: ["Rouge", "Bleu", "Vert"][i % 3],
  stage: (i % 3) + 1, height: 0.2 + (i % 8) * 0.3, weight: 3 + i * 4, habitat: i % 2 ? "Forêt" : "Mer", sprite: "s/" + (i + 1)
}));
function room(players = 3) {
  const r = { code: "QUI1", gameMode: "quiestce", selectedGens: [1, 2, 3], players: Array.from({ length: players }, (_, i) => ({ id: "p" + i, nickname: "J" + i, connected: true, score: 0 })) };
  let seed = 9;
  party.startQuiEstCeRound(r, catalogue, () => (seed = (seed * 16807) % 2147483647) / 2147483647);
  return r;
}

test("a round deals one grid of 24 to everybody, the mystery is one of the cards", () => {
  const r = room();
  assert.equal(r.status, "playing");
  assert.equal(r.quiCards.length, 24);
  assert.equal(new Set(r.quiCards).size, 24);
  assert.ok(r.quiCards.includes(r.target.id));
  assert.ok(r.players.every(p => p.quiOut.length === 0 && p.quiAsked.length === 0 && p.attempts === 0));
});

test("answers come from the server data, flip only the asker's cards, never the mystery", () => {
  const r = room(), [a, b] = r.players;
  const question = [...party.QUESTIONS.keys()].find(id => {
    const test = party.QUESTIONS.get(id), yes = r.quiCards.filter(c => test(catalogue[c - 1])).length;
    return yes > 0 && yes < 24;
  });
  const result = party.askQuiEstCe(r, a, question, r.roundSerial);
  assert.equal(result.answer, party.QUESTIONS.get(question)(r.target));
  assert.ok(result.flipped.length > 0);
  assert.ok(!a.quiOut.includes(r.target.id));
  assert.equal(b.quiOut.length, 0, "another player's grid is untouched");
  assert.equal(party.askQuiEstCe(r, a, question, r.roundSerial).error, "Tu as déjà posé cette question.");
  assert.equal(party.askQuiEstCe(r, a, "nope", r.roundSerial).error, "Question inconnue.");
  assert.equal(party.askQuiEstCe(r, a, question, r.roundSerial + 1).error, "Cette manche a changé.");
});

test("the public state keeps the mystery and the other players' answers private until the end", () => {
  const r = room(), [a, b] = r.players;
  const question = [...party.QUESTIONS.keys()].find(id => { const t = party.QUESTIONS.get(id), y = r.quiCards.filter(c => t(catalogue[c - 1])).length; return y > 0 && y < 24; });
  party.askQuiEstCe(r, a, question, r.roundSerial);
  const forB = party.publicQuiEstCeRound(r, b.id, false);
  assert.equal(forB.answer, null);
  assert.equal(forB.answerId, null);
  assert.deepEqual(forB.mine, { out: [], asked: [] });
  assert.equal(JSON.stringify(forB).includes(r.target.name), false);
  const forA = party.publicQuiEstCeRound(r, a.id, false);
  assert.equal(forA.mine.asked.length, 1);
  const revealed = party.publicQuiEstCeRound(r, b.id, true);
  assert.equal(revealed.answerId, r.target.id);
});

test("a wrong card costs two questions, the first right card wins 100 points", () => {
  const r = room(), [a, b] = r.players;
  const wrong = r.quiCards.find(id => id !== r.target.id);
  assert.equal(party.proposeQuiEstCe(r, a, wrong, r.roundSerial).correct, false);
  assert.equal(a.attempts, 2);
  assert.ok(a.quiOut.includes(wrong));
  assert.equal(party.proposeQuiEstCe(r, a, wrong, r.roundSerial).error, "Choisis une carte encore debout.");
  const win = party.proposeQuiEstCe(r, b, r.target.id, r.roundSerial);
  assert.deepEqual(win, { correct: true, gained: 100 });
  assert.equal(b.score, 100);
  assert.equal(r.quiWinnerId, b.id);
  assert.equal(party.proposeQuiEstCe(r, b, r.target.id, r.roundSerial).error, "Tu as déjà trouvé.");
});

test("the round ends when every active player gives up", () => {
  const r = room(2);
  party.forfeitQuiEstCe(r, r.players[0], r.roundSerial);
  assert.equal(party.allQuiEstCePlayersGaveUp(r), false);
  party.forfeitQuiEstCe(r, r.players[1], r.roundSerial);
  assert.equal(party.allQuiEstCePlayersGaveUp(r), true);
});

test("every question of the party grid exists on the server with the same id", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/script.10u.qui-est-ce.js"), "utf8");
  const context = { pokemonIsRare: () => false, Math, Number, String, Boolean, Array, Object, JSON };
  vm.createContext(context);
  vm.runInContext(source, context);
  const clientIds = vm.runInContext("quiEstCeQuestions().map(q => q.id)", context).filter(id => id !== "rare");
  assert.deepEqual(Array.from(clientIds.filter(id => !party.QUESTIONS.has(id))), [], "client questions missing on the server");
  assert.ok(clientIds.length >= 50);
  for (const p of catalogue.slice(0, 10)) {
    for (const q of vm.runInContext("quiEstCeQuestions()", context).filter(q => q.id !== "rare")) {
      assert.equal(Boolean(q.test(p)), Boolean(party.QUESTIONS.get(q.id)(p)), q.id + " answers like the solo game");
    }
  }
});
