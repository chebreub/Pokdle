"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const bac = require("../lib/party-petitbac");
const { buildCriteria } = require("../lib/daily-grid");

// The real catalogue: 1025 species plus the forms the server injects (Méga, régionales…).
function realCatalogue() {
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, "../pokemon.js"), "utf8").match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
  const core = fs.readFileSync(path.join(__dirname, "../src/script.01.core.js"), "utf8"), context = {};
  vm.createContext(context); vm.runInContext("forms=" + core.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/)[1], context);
  return list.concat(context.forms.map(f => ({ ...f, isAltForm: true })));
}
const catalogue = realCatalogue(), criteria = buildCriteria(catalogue);
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function room(players = 3, free = true) {
  return { code: "BAC1", gameMode: "petitbac", selectedGens: [1, 2, 3, 4, 5, 6, 7, 8, 9], bacFree: free,
    players: Array.from({ length: players }, (_, i) => ({ id: "p" + i, nickname: "J" + i, connected: true, score: 0 })) };
}
// A fixed sheet keeps the scoring test readable: letter S, four Pokémon columns, two free ones.
function fixedSheet(r) {
  r.bac.letter = "S";
  r.bac.categories = [
    { key: "type:Feu", family: "type", label: "Type Feu", value: "Feu" },
    { key: "type:Eau", family: "type", label: "Type Eau", value: "Eau" },
    { key: "gen:1", family: "gen", label: "Kanto (gén. 1)", value: 1 },
    { key: "shape:dual", family: "shape", label: "Deux types" },
    { key: "free:move", family: "free", label: "Attaque" },
    { key: "free:place", family: "free", label: "Lieu" },
  ];
  for (const p of r.players) p.bacAnswers = Array(6).fill("");
}

test("a letter is drawn only when every Pokémon column has at least two answers for it", () => {
  const random = seeded(11), used = [];
  for (let i = 0; i < 30; i++) {
    const sheet = bac.drawSheet({ catalogue, gens: [1, 2, 3, 4, 5, 6, 7, 8, 9], used, random, free: i % 2 ? 2 : 0 });
    assert.ok(sheet, "a sheet is always found");
    if (used.length < 15) assert.ok(!used.includes(sheet.letter), "letters do not repeat within a game");
    used.push(sheet.letter);
    assert.equal(sheet.categories.length, 6);
    const auto = sheet.categories.filter(c => c.family !== "free"), free = sheet.categories.filter(c => c.family === "free");
    assert.equal(free.length, i % 2 ? 2 : 0);
    assert.equal(new Set(sheet.categories.map(c => c.key)).size, 6);
    assert.ok(auto.filter(c => c.family === "type").length <= 2 && auto.filter(c => c.family === "gen").length <= 1);
    for (const c of auto) {
      const answers = catalogue.filter(p => !p.isAltForm && p.id <= 1025 && bac.initialOf(p.name) === sheet.letter && criteria.get(c.key).test(p));
      assert.ok(answers.length >= 2, sheet.letter + " / " + c.label + " has " + answers.length + " answers");
    }
  }
  const kanto = bac.drawSheet({ catalogue, gens: [1], random: seeded(5) });
  assert.ok(kanto.categories.every(c => c.family !== "gen"), "with one generation the region column would be free points");
});

test("Pokémon answers are checked on our data: letter, name, then the column", () => {
  const fire = { key: "type:Feu" };
  assert.deepEqual(bac.checkPokemonAnswer("  salamèche ", "S", fire, catalogue), { text: "Salamèche", valid: true, pokemonId: 4, key: "p4" });
  assert.equal(bac.checkPokemonAnswer("SALAMECHE", "S", fire, catalogue).valid, true, "accents and capitals do not matter");
  assert.equal(bac.checkPokemonAnswer("", "S", fire, catalogue).reason, "empty");
  assert.equal(bac.checkPokemonAnswer("Carapuce", "S", fire, catalogue).reason, "letter");
  assert.equal(bac.checkPokemonAnswer("Salamouche", "S", fire, catalogue).reason, "unknown");
  assert.deepEqual(bac.checkPokemonAnswer("Sabelette", "S", fire, catalogue), { text: "Sabelette", valid: false, reason: "criterion", pokemonId: 27 });
  assert.equal(bac.checkPokemonAnswer("Salamèche", "S", fire, catalogue, [2]).reason, "unknown", "only the chosen generations count");
});

test("a round: private sheets, STOP once full, a vote on free answers, then 2 or 1 points", () => {
  const r = room(3);
  bac.startPetitBacRound(r, catalogue, seeded(3));
  assert.equal(r.status, "playing");
  assert.deepEqual(r.target, { id: 0, name: "", sprite: null }, "generic code sees a placeholder target");
  assert.equal(r.bac.categories.length, 6);
  fixedSheet(r);
  const [a, b, c] = r.players, s = r.roundSerial;
  assert.equal(bac.writeAnswers(r, a, ["x"], s).error, "Feuille invalide.");
  assert.equal(bac.writeAnswers(r, a, Array(6).fill("x"), s + 1).error, "Cette manche a changé.");
  assert.deepEqual(bac.writeAnswers(r, a, ["Salamèche", "Stari", "Smogo", "Scarabrute", "Surf", "Safrania"], s), { saved: true, changed: true });
  assert.equal(bac.stopRound(r, b, s).error, "Remplis toutes les colonnes avant de crier STOP.");
  bac.writeAnswers(r, b, ["Salamèche", "Staross", "Sabelette", "Scarhino", "Séisme", ""], s);
  bac.writeAnswers(r, c, ["Simiabraz", "", "", "", "Surf", "Xyz <b>"], s);

  // While writing, nobody sees the others' answers.
  const forB = bac.publicPetitBac(r, b.id);
  assert.deepEqual(forB.mine, ["Salamèche", "Staross", "Sabelette", "Scarhino", "Séisme", ""]);
  assert.equal(JSON.stringify(forB).includes("Simiabraz"), false);
  assert.deepEqual(forB.progress.map(p => p.filled), [6, 5, 3]);

  assert.deepEqual(bac.stopRound(r, a, s), { stopped: true });
  assert.equal(r.bac.phase, "stopping");
  assert.deepEqual(bac.writeAnswers(r, b, ["Salamèche", "Staross", "Sabelette", "Scarhino", "Séisme", "Safrania"], s), { saved: true, changed: true }, "the last seconds still count");
  assert.equal(bac.advancePetitBac(r, catalogue), "vote");
  assert.equal(bac.writeAnswers(r, c, Array(6).fill("S"), s).error, "Place au vote !");

  const ballot = bac.publicPetitBac(r, c.id).ballot;
  assert.deepEqual(ballot.map(e => [e.author, e.index, e.text, e.own]), [["p0", 4, "Surf", false], ["p1", 4, "Séisme", false], ["p2", 4, "Surf", true], ["p0", 5, "Safrania", false], ["p1", 5, "Safrania", false], ["p2", 5, "Xyz b", true]]);
  assert.equal(bac.voteAnswer(r, c, "p2", 4, false, s).error, "Tu ne votes pas pour toi-même.");
  assert.equal(bac.voteAnswer(r, c, "p0", 0, false, s).error, "On ne vote que sur les colonnes libres.");
  // Both others reject Chloé's « Xyz b » (wrong letter anyway) and Alice's « Surf » is kept by a split vote.
  bac.voteAnswer(r, a, "p2", 5, false, s); bac.voteAnswer(r, b, "p2", 5, false, s);
  bac.voteAnswer(r, b, "p0", 4, false, s); bac.voteAnswer(r, c, "p0", 4, true, s);
  assert.equal(bac.publicPetitBac(r, c.id).ballot.find(e => e.author === "p0" && e.index === 4).myVote, true);
  assert.deepEqual(bac.finishVoting(r, a, s), { done: true, allDone: false });
  bac.finishVoting(r, b, s);
  assert.deepEqual(bac.finishVoting(r, c, s), { done: true, allDone: true });
  assert.equal(bac.advancePetitBac(r, catalogue), "scored");

  const results = Object.fromEntries(bac.publicPetitBac(r, a.id).results.map(row => [row.playerId, row]));
  const points = id => results[id].answers.map(x => x.points);
  // Salamèche twice (1 each), Simiabraz alone (2); Stari and Staross are both Water but different; Surf and Safrania shared.
  assert.deepEqual(points("p0"), [1, 2, 2, 0, 1, 1]);
  assert.deepEqual(points("p1"), [1, 2, 2, 2, 2, 1]);
  assert.deepEqual(points("p2"), [2, 0, 0, 0, 1, 0]);
  assert.equal(results.p0.answers[3].reason, "criterion", "Scarabrute is a single type");
  assert.equal(results.p2.answers[5].reason, "letter");
  assert.equal(a.score, 7); assert.equal(b.score, 10); assert.equal(c.score, 3);
  assert.equal(results.p1.gained, 10);
  const examples = bac.publicPetitBac(r, a.id).examples;
  assert.ok(examples[3].length >= 1 && examples[4].length === 0, "examples for Pokémon columns only");
});

test("no free answers skips the vote; spectators watch; a reconnecting player keeps their votes", () => {
  const r = room(2, false);
  r.players.push({ id: "late", nickname: "Late", connected: false, score: 0 });
  bac.startPetitBacRound(r, catalogue, seeded(9));
  const late = r.players[2];
  late.connected = true;
  assert.equal(bac.writeAnswers(r, late, Array(6).fill(""), r.roundSerial).error, "Tu regardes cette manche : tu joueras à la suivante.");
  assert.equal(bac.publicPetitBac(r, late.id).mine, null);
  assert.equal(bac.advancePetitBac(r, catalogue), "scored", "nothing to vote on");
  assert.equal(r.bac.phase, "done");

  const v = room(2, true);
  bac.startPetitBacRound(v, catalogue, seeded(4));
  const freeIndex = v.bac.categories.findIndex(c => c.family === "free"), letter = v.bac.letter;
  const sheet = v.bac.categories.map((c, i) => i === freeIndex ? letter + "ourire" : "");
  bac.writeAnswers(v, v.players[0], sheet, v.roundSerial);
  assert.equal(bac.advancePetitBac(v, catalogue), "vote");
  bac.voteAnswer(v, v.players[1], "p0", freeIndex, false, v.roundSerial);
  bac.rekeyPetitBac(v, "p1", "p1b"); v.players[1].id = "p1b"; v.roundPlayerIds = ["p0", "p1b"];
  assert.equal(bac.publicPetitBac(v, "p1b").ballot[0].myVote, false, "the vote follows the new connection");
  bac.finishVoting(v, v.players[0], v.roundSerial);
  assert.equal(bac.finishVoting(v, v.players[1], v.roundSerial).allDone, true);
  bac.advancePetitBac(v, catalogue);
  assert.equal(v.players[0].bacResults[freeIndex].reason, "vote", "with two players, one rejection is the majority");
});
