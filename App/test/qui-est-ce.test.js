"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../src/script.10u.qui-est-ce.js"), "utf8");

// 30 distinct Pokémon spread over types, generations, colours, stages and sizes.
const TYPES = ["Feu", "Eau", "Plante", "Électrik", "Psy", "Roche"];
const COLORS = ["Rouge", "Bleu", "Vert", "Jaune", "Violet"];
const pokemon = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1, name: "Pkmn" + String.fromCharCode(65 + (i % 26)) + i,
  type1: TYPES[i % 6], type2: i % 4 === 0 ? "Vol" : null, gen: (i % 9) + 1,
  color: COLORS[i % 5], stage: (i % 3) + 1, height: 0.3 + (i % 7) * 0.4, weight: 4 + i * 5,
  habitat: i % 2 ? "Forêt" : "Mer"
}));

function fixture(random) {
  const history = [], profile = { quiEstCeBest: 0 };
  const context = {
    POKEMON_BY_ID: new Map(pokemon.map(p => [p.id, p])),
    getPokemonUiList: () => pokemon, pokemonIsRare: p => p.id === 7,
    escapeHtml: s => String(s), getPokemonSprite: p => "sprite/" + p.id,
    document: { getElementById: () => null },
    playerProfile: profile, saveProfile() {}, awardXp() {},
    recordMatchHistory: entry => history.push(entry),
    Math, Number, String, Boolean, Array, Object, JSON
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  vm.runInContext("quiEstCeState = newQuiEstCeState(quiEstCePool(), __random);", Object.assign(context, { __random: random }));
  return { context, history, profile, state: () => vm.runInContext("quiEstCeState", context) };
}
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

test("a new grid holds 24 different Pokémon and the secret is one of them", () => {
  const { state } = fixture(seeded(7));
  const s = state();
  assert.equal(s.cards.length, 24);
  assert.equal(new Set(s.cards).size, 24);
  assert.ok(s.cards.includes(s.secretId));
  assert.equal(s.phase, "playing");
});

test("answers come from the data, flip only the cards that do not match, never the secret", () => {
  const { context, state } = fixture(seeded(11));
  const questions = vm.runInContext("quiEstCeQuestions()", context);
  for (let round = 0; round < 40 && state().phase === "playing"; round++) {
    const useful = questions.find(q => context.quiQuestionUseful(q));
    if (!useful) break;
    const before = context.quiRemaining().length;
    assert.equal(context.askQuiEstCe(useful.id), true);
    const s = state();
    assert.ok(!s.out.includes(s.secretId), "the secret is never flipped");
    const secret = pokemon.find(p => p.id === s.secretId);
    for (const id of context.quiRemaining()) assert.equal(useful.test(pokemon[id - 1]), useful.test(secret), "remaining cards share the secret's answer");
    assert.ok(context.quiRemaining().length < before, "a useful question always flips something");
    assert.equal(context.askQuiEstCe(useful.id), false, "the same question cannot be asked twice");
  }
  assert.ok(state().questions > 0);
});

test("questions that no longer split the grid are refused", () => {
  const { context, state } = fixture(seeded(3));
  const all = vm.runInContext("quiEstCeQuestions()", context);
  const s = state();
  const remaining = context.quiRemaining();
  const useless = all.find(q => remaining.every(id => q.test(pokemon[id - 1])) || remaining.every(id => !q.test(pokemon[id - 1])));
  if (useless) assert.equal(context.askQuiEstCe(useless.id), false);
  assert.equal(s.questions, 0);
});

test("a wrong proposal costs two questions, the right one wins and keeps the best record", () => {
  const { context, history, profile, state } = fixture(seeded(5));
  const s = state();
  const wrong = s.cards.find(id => id !== s.secretId);
  context.selectQuiEstCeCard(wrong);
  assert.equal(context.proposeQuiEstCe(), false);
  assert.equal(s.questions, 2);
  assert.ok(s.out.includes(wrong));
  context.selectQuiEstCeCard(s.secretId);
  assert.equal(context.proposeQuiEstCe(), true);
  assert.equal(s.phase, "finished");
  assert.equal(s.won, true);
  assert.equal(profile.quiEstCeBest, 2);
  assert.deepEqual({ ...history[0] }, { mode: "quiestce", result: "win", attempts: 2, targetName: pokemon[s.secretId - 1].name });
  context.selectQuiEstCeCard(wrong);
  assert.equal(s.selected, null, "a finished grid ignores clicks");
});

test("giving up reveals the secret as a loss without touching the record", () => {
  const { context, history, profile, state } = fixture(seeded(9));
  profile.quiEstCeBest = 4;
  context.giveUpQuiEstCe();
  assert.equal(state().phase, "finished");
  assert.equal(state().won, false);
  assert.equal(profile.quiEstCeBest, 4);
  assert.equal(history[0].result, "loss");
});
