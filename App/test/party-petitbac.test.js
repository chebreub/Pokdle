"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const bac = require("../lib/party-petitbac");

// The real catalogue: 1025 species plus the forms the server injects (Méga, régionales…).
function realCatalogue() {
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, "../pokemon.js"), "utf8").match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
  const core = fs.readFileSync(path.join(__dirname, "../src/script.01.core.js"), "utf8"), context = {};
  vm.createContext(context); vm.runInContext("forms=" + core.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/)[1], context);
  return list.concat(context.forms.map(f => ({ ...f, isAltForm: true })));
}
const catalogue = realCatalogue(), ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9];
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function room(players = 3) {
  return { code: "BAC1", gameMode: "petitbac", status: "waiting", selectedGens: ALL.slice(),
    players: Array.from({ length: players }, (_, i) => ({ id: "p" + i, nickname: "J" + i, connected: true, score: 0 })) };
}

test("a large catalogue of themes, and letters drawn only when every Pokémon theme can answer", () => {
  const cat = bac.catalogFor(catalogue);
  assert.ok(cat.list.length >= 55, "many themes to choose from");
  for (const key of ["any", "type:Feu", "gen:1", "color:Rouge", "special:starter", "special:legendary", "size:light", "free:move", "free:berry", "free:nickname"]) assert.ok(cat.byKey.has(key), key);
  assert.deepEqual([...new Set(cat.list.map(c => c.group))].sort(), ["color", "free", "gen", "pokemon", "type"]);
  assert.ok(bac.playableLetters(catalogue, ALL, bac.DEFAULT_THEMES).length >= 12, "the default game has plenty of letters");
  assert.equal(bac.playableLetters(catalogue, ALL, ["any", "free:move", "free:place"]).length, 26, "free themes never block a letter");
  const fire = bac.playableLetters(catalogue, ALL, ["type:Feu", "special:legendary", "color:Rose"]);
  for (const letter of fire) {
    const starting = catalogue.filter(p => !p.isAltForm && p.id <= 1025 && bac.initialOf(p.name) === letter);
    for (const key of ["type:Feu", "special:legendary", "color:Rose"]) assert.ok(starting.some(cat.byKey.get(key).test), letter + " has an answer for " + key);
  }
  const random = seeded(7);
  for (let i = 0; i < 12; i++) {
    const themes = bac.randomThemes(catalogue, ALL, random);
    assert.equal(themes.length, 6); assert.equal(themes[0], "any");
    assert.equal(themes.filter(k => k.startsWith("free:")).length, 2);
    assert.ok(bac.playableLetters(catalogue, ALL, themes).length >= 8, "a random set keeps at least eight letters");
  }
});

test("small spelling mistakes are forgiven, never on the first letter or on very short names", () => {
  const check = (text, letter, key = "any", gens = ALL) => bac.checkPokemonAnswer(text, letter, { key }, catalogue, gens);
  assert.deepEqual(check("  salamèche ", "S", "type:Feu"), { text: "salamèche", valid: true, pokemonId: 4, name: "Salamèche" });
  assert.equal(check("Salameche", "S", "type:Feu").valid, true, "accents do not matter");
  assert.deepEqual(check("Dracofeu", "D", "type:Feu"), { text: "Dracofeu", valid: true, pokemonId: 6, name: "Dracaufeu", fuzzy: true });
  assert.equal(check("pikachi", "P").pokemonId, 25);
  assert.equal(check("Nidorine", "N").valid, true, "between Nidorina and Nidorino, either counts");
  assert.equal(check("Meu", "M").reason, "unknown", "no typo allowed on a name this short");
  assert.equal(check("Ralamèche", "R").reason, "unknown", "the first letter must be right");
  assert.equal(check("Carapuce", "S").reason, "letter");
  assert.equal(check("", "S").reason, "empty");
  assert.deepEqual(check("Sabelette", "S", "type:Feu"), { text: "Sabelette", valid: false, reason: "criterion", pokemonId: 27, name: "Sabelette" });
  assert.equal(check("Salamèche", "S", "any", [2]).reason, "unknown", "only the chosen generations count");
});

test("solo sheets: six Pokémon themes, each with at least two answers for the letter", () => {
  const random = seeded(3), cat = bac.catalogFor(catalogue);
  for (let i = 0; i < 20; i++) {
    const sheet = bac.drawSoloSheet({ catalogue, gens: ALL, random });
    assert.equal(sheet.categories.length, 6);
    for (const c of sheet.categories) {
      assert.ok(c.family !== "free" && c.family !== "any", "solo themes are checked by the data");
      const answers = catalogue.filter(p => !p.isAltForm && p.id <= 1025 && bac.initialOf(p.name) === sheet.letter && cat.byKey.get(c.key).test(p));
      assert.ok(answers.length >= 2, sheet.letter + " / " + c.label);
    }
  }
  assert.ok(bac.drawSoloSheet({ catalogue, gens: [1], random }).categories.every(c => c.family !== "gen"));
});

test("the host sets 3 to 10 known themes and 1 min, 5 min or untimed rounds", () => {
  const r = room();
  assert.deepEqual(bac.petitBacOptions(r, catalogue), { themes: bac.DEFAULT_THEMES, time: 300 });
  assert.equal(bac.setPetitBacOptions(r, { themes: ["any", "type:Feu"] }, catalogue).error, "Choisis entre 3 et 10 thèmes.");
  assert.equal(bac.setPetitBacOptions(r, { themes: ["any", "type:Feu", "nope"] }, catalogue).error, "Thème inconnu.");
  assert.equal(bac.setPetitBacOptions(r, { time: 120 }, catalogue).error, "Durée inconnue.");
  assert.deepEqual(bac.setPetitBacOptions(r, { themes: ["any", "type:Feu", "free:move", "free:move"], time: 0 }, catalogue), { saved: true });
  assert.deepEqual(bac.petitBacOptions(r, catalogue), { themes: ["any", "type:Feu", "free:move"], time: 0 });
  assert.deepEqual(bac.setPetitBacOptions(r, { random: true }, catalogue, seeded(2)), { saved: true });
  assert.equal(r.bacThemes.length, 6, "a random set of six themes");
  const shown = bac.publicOptions(r, catalogue);
  assert.ok(shown.catalog.length >= 55 && shown.letters >= 8);
  r.status = "playing";
  assert.equal(bac.publicOptions(r, catalogue).catalog, null, "the long list only while setting up");
});

test("a round: private sheets, STOP, then a review where answers are right by default and the majority decides", () => {
  const r = room(3);
  bac.setPetitBacOptions(r, { themes: ["type:Feu", "type:Eau", "any", "free:move", "free:place"], time: 60 }, catalogue);
  bac.startPetitBacRound(r, catalogue, () => 0.99);
  assert.ok(bac.playableLetters(catalogue, ALL, r.bacThemes).includes(r.bac.letter));
  // A fixed letter keeps the answers readable.
  r.bac.letter = "S";
  const [a, b, c] = r.players, s = r.roundSerial;
  assert.deepEqual(r.bac.categories.map(x => x.label), ["Type Feu", "Type Eau", "N’importe quel Pokémon", "Attaque", "Ville ou lieu"]);
  assert.equal(r.bac.time, 60);
  assert.equal(bac.writeAnswers(r, a, ["x"], s).error, "Feuille invalide.");
  assert.deepEqual(bac.writeAnswers(r, a, ["Salamech", "Stari", "Sabelette", "Surf", "Safrania"], s), { saved: true, changed: true });
  bac.writeAnswers(r, b, ["Salamèche", "Spoink", "Simiabraz", "Séisme", ""], s);
  bac.writeAnswers(r, c, ["Simiabraz", "", "Smogo", "Surff", "Xyz"], s);
  const forB = bac.publicPetitBac(r, b.id);
  assert.equal(JSON.stringify(forB).includes("Smogo"), false, "nobody sees the others while writing");
  assert.equal(bac.stopRound(r, b, s).error, "Remplis toutes les colonnes avant de crier STOP.");
  assert.deepEqual(bac.stopRound(r, a, s), { stopped: true });
  assert.equal(bac.advancePetitBac(r, catalogue), "review");

  const ballot = bac.publicPetitBac(r, c.id).ballot, entry = (author, index) => ballot.find(e => e.author === author && e.index === index);
  assert.equal(entry("p0", 0).name, "Salamèche", "a forgiven typo shows the right name");
  assert.equal(entry("p1", 1).suggested, false, "Spoink is not Water: Pokédle says no");
  assert.equal(entry("p1", 1).reason, "criterion");
  assert.equal(entry("p0", 3).suggested, true, "free answers are right by default");
  assert.equal(entry("p2", 4).reason, "letter");
  assert.equal(entry("p2", 3).own, true);
  assert.equal(bac.voteAnswer(r, c, "p2", 3, false, s).error, "Tu ne votes pas pour toi-même.");
  assert.equal(bac.writeAnswers(r, c, Array(5).fill("S"), s).error, "Place à la vérification des réponses !");
  // Alice's « Surf » contested by one of two others: it stays. Ondine's « Séisme » refused by both: it goes.
  bac.voteAnswer(r, c, "p0", 3, false, s);
  bac.voteAnswer(r, a, "p1", 3, false, s); bac.voteAnswer(r, c, "p1", 3, false, s);
  // Spoink accepted by both others (a house rule): the majority wins over Pokédle.
  bac.voteAnswer(r, a, "p1", 1, true, s); bac.voteAnswer(r, c, "p1", 1, true, s);
  const now = bac.publicPetitBac(r, c.id).ballot.find(e => e.author === "p0" && e.index === 3);
  assert.equal(now.myVote, false); assert.equal(now.against, 1); assert.equal(now.valid, true);
  assert.deepEqual(bac.finishVoting(r, a, s), { done: true, allDone: false });
  bac.finishVoting(r, b, s);
  assert.deepEqual(bac.finishVoting(r, c, s), { done: true, allDone: true });
  assert.equal(bac.advancePetitBac(r, catalogue), "scored");

  const results = Object.fromEntries(bac.publicPetitBac(r, a.id).results.map(row => [row.playerId, row]));
  const points = id => results[id].answers.map(x => x.points);
  // Salamèche twice (typo included): shared. Surf and « Surff » are the same answer: shared.
  assert.deepEqual(points("p0"), [1, 2, 2, 1, 2]);
  assert.deepEqual(points("p1"), [1, 2, 2, 0, 0]);
  assert.deepEqual(points("p2"), [2, 0, 2, 1, 0]);
  assert.equal(results.p1.answers[1].accepted, true, "accepted by the vote");
  assert.equal(results.p1.answers[3].reason, "vote");
  assert.equal(results.p0.answers[0].shared, true, "Salamèche given twice in the same theme, typo or not");
  assert.equal(results.p2.answers[0].shared, undefined, "the same Pokémon in another theme does not count as shared");
  assert.equal(a.score, 8); assert.equal(b.score, 5); assert.equal(c.score, 5);
  assert.deepEqual(bac.publicPetitBac(r, a.id).examples[3], [], "examples for Pokémon themes only");
});

test("no answer skips the review; spectators watch; a reconnecting player keeps verdicts and votes", () => {
  const r = room(2);
  r.players.push({ id: "late", nickname: "Late", connected: false, score: 0 });
  bac.startPetitBacRound(r, catalogue, seeded(9));
  const late = r.players[2];
  late.connected = true;
  assert.equal(bac.writeAnswers(r, late, Array(r.bac.categories.length).fill(""), r.roundSerial).error, "Tu regardes cette manche : tu joueras à la suivante.");
  assert.equal(bac.publicPetitBac(r, late.id).mine, null);
  assert.equal(bac.advancePetitBac(r, catalogue), "scored", "nothing to review");

  const v = room(2);
  bac.setPetitBacOptions(v, { themes: ["any", "free:move", "free:place"] }, catalogue);
  bac.startPetitBacRound(v, catalogue, seeded(4));
  const letter = v.bac.letter;
  bac.writeAnswers(v, v.players[0], ["", letter + "ourire", ""], v.roundSerial);
  assert.equal(bac.advancePetitBac(v, catalogue), "review");
  bac.voteAnswer(v, v.players[1], "p0", 1, false, v.roundSerial);
  bac.rekeyPetitBac(v, "p0", "p0b"); v.players[0].id = "p0b"; v.roundPlayerIds = ["p0b", "p1"];
  bac.rekeyPetitBac(v, "p1", "p1b"); v.players[1].id = "p1b"; v.roundPlayerIds = ["p0b", "p1b"];
  const entry = bac.publicPetitBac(v, "p1b").ballot[0];
  assert.equal(entry.author, "p0b"); assert.equal(entry.myVote, false, "the vote follows both new connections");
  bac.finishVoting(v, v.players[0], v.roundSerial);
  assert.equal(bac.finishVoting(v, v.players[1], v.roundSerial).allDone, true);
  bac.advancePetitBac(v, catalogue);
  assert.equal(v.players[0].bacResults[1].reason, "vote", "with two players, one vote is the majority");
});
