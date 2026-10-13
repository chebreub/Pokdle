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
function duel(players = 2) {
  const r = { code: "QUI1", gameMode: "quiestce1v1", selectedGens: [1, 2, 3], players: Array.from({ length: players }, (_, i) => ({ id: "p" + i, nickname: "J" + i, connected: true, score: 0 })) };
  let seed = 7;
  party.startQuiEstCeDuel(r, catalogue, () => (seed = (seed * 16807) % 2147483647) / 2147483647);
  return r;
}
// Both players choose; returns [whoseTurn, other].
function started(r) {
  const [a, b] = r.players;
  party.chooseSecret(r, a, r.quiCards[0], r.roundSerial, () => 0);
  party.chooseSecret(r, b, r.quiCards[1], r.roundSerial, () => 0);
  const first = r.players.find(p => p.id === r.quiTurnId);
  return [first, r.players.find(p => p !== first && r.roundPlayerIds.includes(p.id))];
}

test("a game deals one grid of 24, waits for both players to choose their own secret", () => {
  const r = duel(), [a, b] = r.players;
  assert.equal(r.status, "playing");
  assert.equal(r.quiPhase, "choose");
  assert.equal(r.quiCards.length, 24);
  assert.deepEqual(r.target, { id: 0, name: "", sprite: null }, "no real target is ever exposed to generic code");
  assert.equal(party.askQuestion(r, a, { category: "type", questionId: "dual" }, r.roundSerial).error, "Attends que les deux joueurs aient choisi leur Pokémon.");
  assert.equal(party.chooseSecret(r, a, 999, r.roundSerial).error, "Choisis un Pokémon de la grille.");
  assert.equal(party.chooseSecret(r, a, r.quiCards[3], r.roundSerial).started, false);
  assert.equal(party.chooseSecret(r, a, r.quiCards[4], r.roundSerial).error, "Tu as déjà choisi ton Pokémon.");
  assert.equal(party.chooseSecret(r, b, r.quiCards[3], r.roundSerial).started, true, "both may even pick the same Pokémon");
  assert.equal(r.quiPhase, "play");
  assert.ok([a.id, b.id].includes(r.quiTurnId));
});

test("the rival answers; a preset question flips the asker's cards from that answer; then the rival asks", () => {
  const r = duel();
  const [asker, rival] = started(r);
  assert.equal(party.askQuestion(r, rival, { category: "type", questionId: "dual" }, r.roundSerial).error, "Ce n’est pas ton tour.");
  assert.ok(party.askQuestion(r, asker, { category: "type", questionId: "dual" }, r.roundSerial).asked);
  assert.equal(party.guessSecret(r, asker, r.quiCards[5], r.roundSerial).error, "Attends la réponse à ta question.");
  assert.equal(party.answerQuestion(r, asker, "oui", r.roundSerial).error, "Aucune question ne t’attend.", "nobody answers their own question");
  const res = party.answerQuestion(r, rival, "non", r.roundSerial);
  assert.ok(res.answered);
  const dualCards = r.quiCards.filter(id => catalogue[id - 1].type2);
  assert.deepEqual(res.flipped.slice().sort(), dualCards.slice().sort(), "the answer given, not the data, decides the flips");
  assert.equal(r.quiTurnId, rival.id, "whoever answered asks next");
  assert.equal(r.quiLog.at(-1).answer, "non");
});

test("one question per category, written and spoken questions too, and only five in all", () => {
  const r = duel();
  let [a, b] = started(r);
  const play = (who, payload) => { const out = party.askQuestion(r, who, payload, r.roundSerial); if (!payload.oral && out.asked) party.answerQuestion(r, r.players.find(p => p !== who && r.roundPlayerIds.includes(p.id)), "oui", r.roundSerial); return out; };
  assert.equal(play(a, { category: "type", text: "  Est-ce   qu’il <b>vole</b> ?  " }).asked, true);
  assert.equal(r.quiLog[0].text, "Est-ce qu’il bvole/b ?", "written questions are cleaned");
  assert.ok(play(b, { category: "color", oral: true }).oral, "an oral question passes the turn at once");
  assert.equal(r.quiTurnId, a.id);
  assert.equal(party.askQuestion(r, a, { category: "type", questionId: "dual" }, r.roundSerial).error, "Tu as déjà posé ta question dans cette catégorie.");
  assert.equal(party.askQuestion(r, a, { category: "gen", questionId: "dual" }, r.roundSerial).error, "Question inconnue dans cette catégorie.");
  assert.equal(party.askQuestion(r, a, { category: "gen", text: "   " }, r.roundSerial).error, "Écris ta question ou choisis-en une.");
  for (const category of ["gen", "color", "body", "more"]) {
    play(a, { category, oral: true });
    if (r.quiTurnId !== a.id) play(b, { category: ["gen", "body", "more", "type"].find(c => !b.quiUsed.includes(c)), oral: true });
  }
  assert.equal(a.quiUsed.length, 5);
  assert.equal(a.attempts, 5);
});

test("a wrong guess only loses the turn; the right one wins 100 points", () => {
  const r = duel();
  const [first, second] = started(r);
  const wrong = r.quiCards.find(id => id !== second.quiSecretId);
  const miss = party.guessSecret(r, first, wrong, r.roundSerial);
  assert.deepEqual(miss, { correct: false, gained: 0 });
  assert.ok(first.quiOut.includes(wrong));
  assert.equal(r.quiTurnId, second.id);
  const win = party.guessSecret(r, second, first.quiSecretId, r.roundSerial);
  assert.deepEqual(win, { correct: true, gained: 100 });
  assert.equal(second.score, 100);
  assert.equal(r.quiWinnerId, second.id);
  assert.equal(r.quiEndReason, "found");
});

test("cards are flipped by hand on your own board only, and can be put back up", () => {
  const r = duel();
  const [first, second] = started(r);
  const card = r.quiCards[7];
  assert.equal(party.flipCard(r, second, card, r.roundSerial).flipped, true, "flipping works out of turn");
  assert.ok(second.quiOut.includes(card));
  assert.equal(first.quiOut.includes(card), false);
  assert.equal(party.flipCard(r, second, card, r.roundSerial).flipped, false);
  assert.equal(second.quiOut.includes(card), false);
});

test("secrets stay private until the end, a third player watches, giving up hands the win over", () => {
  const r = duel(3);
  const watcher = r.players[2];
  assert.equal(party.chooseSecret(r, watcher, r.quiCards[0], r.roundSerial).error, "Tu regardes cette partie.");
  const [first, second] = started(r);
  const forFirst = party.publicQuiEstCeDuel(r, first.id, false);
  assert.equal(forFirst.mySecretId, first.quiSecretId);
  assert.equal(forFirst.secrets, null);
  assert.equal(party.publicQuiEstCeDuel(r, watcher.id, false).mySecretId, null);
  party.flipCard(r, second, r.quiCards[9], r.roundSerial);
  assert.deepEqual(forFirst.mine.out, [], "the rival's board stays private");
  assert.deepEqual(party.forfeitDuel(r, first, r.roundSerial), { abandoned: true, ended: true });
  assert.equal(r.quiWinnerId, second.id);
  assert.equal(second.score, 100);
  const end = party.publicQuiEstCeDuel(r, watcher.id, true);
  assert.deepEqual(Array.from(end.secrets, s => s.pokemonId).sort(), [first.quiSecretId, second.quiSecretId].sort());
  assert.equal(end.endReason, "forfeit");
});

test("every preset question of the solo game exists on the server, in the same category, with the same answers", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/script.10u.qui-est-ce.js"), "utf8");
  const context = { pokemonIsRare: () => false, Math, Number, String, Boolean, Array, Object, JSON };
  vm.createContext(context);
  vm.runInContext(source, context);
  const client = Array.from(vm.runInContext("quiEstCeQuestions()", context)).filter(q => q.id !== "rare");
  assert.ok(client.length >= 50);
  assert.deepEqual(Array.from(client.filter(q => party.QUESTION_CATEGORY.get(q.id) !== q.group), q => q.id), [], "same category on both sides");
  for (const p of catalogue.slice(0, 10)) {
    for (const q of client) assert.equal(Boolean(q.test(p)), Boolean(party.QUESTIONS.get(q.id)(p)), q.id + " answers like the solo game");
  }
  assert.deepEqual(Array.from(vm.runInContext("QUI_GROUPS.map(([key]) => key)", context)), party.CATEGORIES);
});
