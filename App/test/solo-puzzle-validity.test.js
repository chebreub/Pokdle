"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const base = path.resolve(__dirname, "..");
const core = fs.readFileSync(path.join(base, "src/script.01.core.js"), "utf8");
const modes = fs.readFileSync(path.join(base, "src/script.07.delegation-party.js"), "utf8");
const data = fs.readFileSync(path.join(base, "pokemon.js"), "utf8");
const from = data.indexOf("const POKEMON_LIST =") + "const POKEMON_LIST =".length;
const to = data.indexOf("];", from) + 1;
assert.ok(from > 20 && to > from, "Pokémon source must remain readable");
const pokemon = JSON.parse(data.slice(from, to));
const byId = new Map(pokemon.map(p => [p.id, p]));
const pick = (...ids) => ids.map(id => {
  const p = byId.get(id);
  assert.ok(p, "Unknown test Pokémon #" + id);
  return p;
});
function block(source, first, after) {
  const a = source.indexOf(first), b = source.indexOf(after, a);
  assert.ok(a >= 0 && b > a, "Source region missing: " + first);
  return source.slice(a, b);
}
function context(source, extra = {}) {
  const c = vm.createContext({Math, Set, Map, Number, String, Array,
    norm: s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    shuffleArray: values => [...values].reverse(), ...extra});
  vm.runInContext(source, c);
  return c;
}
const coreCtx = context(block(core, "// Verified three-stage families", "function getPartyModePool()"));
const getEvolution = pool => coreCtx.getEvolutionChainCandidates(pool);
const getOrder = pool => coreCtx.getPokedexOrderCandidates(pool);

test("Evolution is built from genuine families, not consecutive unrelated species", () => {
  const chains = getEvolution(pokemon);
  const ids = chains.map(t => t[0].id);
  assert.equal(chains.length, 94, "Recheck curated set when updating Pokédex data");
  assert.ok(ids.includes(1), "Bulbizarre family");
  assert.ok(ids.includes(147), "Minidraco family");
  assert.ok(ids.includes(789), "Cosmog branching family");
  for (const wrong of [167,228,1017]) assert.ok(!ids.includes(wrong), "False consecutive chain #" + wrong);
  assert.ok(chains.every(t => t.length === 3 && new Set(t.map(p => p.id)).size === 3));
  assert.deepEqual(JSON.parse(JSON.stringify(getEvolution(pick(1,2,3,4,5,6)).map(t => t.map(p => p.id)))),[[1,2,3],[4,5,6]]);
});

test("Evolution respects the selected pool and Party never offers impossible selections", () => {
  assert.equal(getEvolution(pick(1,2,3)).length,1);
  assert.equal(getEvolution(pick(1,3,4,5)).length,0);
  assert.equal(getEvolution(pick(167,168,169,228,229,230)).length,0);
  const partyCtx = context(
    block(core, "// Verified three-stage families", "function getPartyModePool()"),
    {getPoolFromSelectedGens: () => pick(167,168,169)}
  );
  assert.equal(partyCtx.hasPartyEvolutionCandidate(),false);
});

test("Ordre Pokédex only hides an immediately adjacent national number", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(getOrder(pick(1,2,3,4)).map(x=>x.map(p=>p.id)))), [[1,2,3],[2,3,4]]);
  assert.equal(getOrder(pick(1,3,5,7)).length,0);
  assert.deepEqual(JSON.parse(JSON.stringify(getOrder(pick(101,102,104,105,106)).map(x=>x.map(p=>p.id)))), [[104,105,106]]);
  assert.equal(getOrder(pokemon).length,1023);
});

const oddSource = "let oddDifficulty='easy';\n" +
  block(modes, "// Six visible cards must have ONE defensible outsider", "function syncOddDifficultyUi()");
function oddCtx(difficulty) {
  const ctx = context(oddSource);
  vm.runInContext("oddDifficulty=" + JSON.stringify(difficulty), ctx);
  return ctx;
}
const gen1 = pokemon.filter(p => p.gen === 1 && !p.isAltForm);

test("Intrus difficulty changes the actual criterion and labels", () => {
  const easy = oddCtx("easy");
  const easyPuzzle = easy.buildOddRuleSet().map(r=>r.build(gen1)).find(Boolean);
  assert.equal(easyPuzzle.rule,"letter");
  assert.match(easyPuzzle.hint,/première lettre/);
  const medium = oddCtx("medium");
  const mediumPuzzle = medium.buildOddRuleSet().map(r=>r.build(gen1)).find(Boolean);
  assert.equal(mediumPuzzle.rule,"type","Single-generation selection cannot give a generation outlier");
  assert.match(mediumPuzzle.hint,/types/);
  const hard = oddCtx("hard");
  const hardPuzzle = hard.buildOddRuleSet().map(r=>r.build(gen1)).find(Boolean);
  assert.ok(hardPuzzle);
  assert.match(hardPuzzle.hint,/Trouve toi-même/);
});

test("Intrus rejects puzzles where different type categories create two plausible outsiders", () => {
  const context = oddCtx("hard");
  const cards = [
    {id:1,name:"Eau1",gen:1,type1:"Eau",type2:"Vol"},
    {id:2,name:"Eau2",gen:1,type1:"Eau",type2:"Vol"},
    {id:3,name:"Eau3",gen:1,type1:"Eau",type2:"Vol"},
    {id:4,name:"Eau4",gen:1,type1:"Eau",type2:"Vol"},
    {id:5,name:"Autre",gen:1,type1:"Eau",type2:"Poison"},
    {id:6,name:"Autre2",gen:1,type1:"Vol",type2:"Poison"},
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(context.oddPossibleOutliers(cards,["type"]))),[6,5]);
});

test("Across 3 difficulty tiers, every generated Intrus puzzle has exactly one justified outsider", () => {
  const extended = pokemon.filter(p=>[1,2,3].includes(p.gen) && !p.isAltForm);
  for (const tier of ["easy","medium","hard"]) {
    const ctx = oddCtx(tier);
    for (const pool of [gen1, extended]) {
      for (let round=0; round<25; round++) {
        const puzzle = ctx.buildOddRuleSet().map(r=>r.build(pool)).find(Boolean);
        assert.ok(puzzle, tier + " produces a puzzle for the selected generations");
        assert.equal(puzzle.cards.length,6);
        assert.equal(new Set(puzzle.cards.map(p=>p.id)).size,6);
        assert.ok(pool.some(p=>p.id === puzzle.oddId),"answer must belong to selected generations");
        const checked = tier === "hard" ? ["type","generation","letter"] : [puzzle.rule];
        assert.deepEqual(JSON.parse(JSON.stringify(ctx.oddPossibleOutliers(puzzle.cards,checked))),[puzzle.oddId],
          "No other card may satisfy the advertised rule");
      }
    }
  }
});
