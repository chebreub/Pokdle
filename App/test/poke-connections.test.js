"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const mini = read("src/script.03.minijeux.js");
const connections = mini.slice(mini.indexOf("// === POKÉ-CONNECTIONS"), mini.indexOf("// === STAT AUCTION"));
const shuffleStart = mini.indexOf("function shuffleArray(");
const shuffle = mini.slice(shuffleStart, mini.indexOf("\n}", shuffleStart) + 2);
const dexContext = vm.createContext({});
vm.runInContext(read("pokemon.js"), dexContext);
const dex = vm.runInContext("POKEMON_LIST", dexContext);
const generations = vm.runInContext("GENERATIONS", dexContext);

function fixture(seed = 42, pokemon = dex) {
  let randomState = seed;
  const math = Object.create(Math);
  math.random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 2 ** 32;
  };
  const root = { innerHTML: "" }, events = [];
  const context = vm.createContext({
    POKEMON_LIST: pokemon, GENERATIONS: generations, Math: math,
    document: { getElementById: () => root }, escapeHtml: (s) => String(s),
    trackUsage() {}, goToConfig() {}, hideExtraScreens() {}, hideScreen() {}, showScreen() {}, setGlobalNavActive() {},
    showToast: (message) => events.push(["toast", message]),
    awardXp: (...args) => events.push(["xp", ...args]), progressQuest: (...args) => events.push(["quest", ...args]),
    recordMatchHistory: (record) => events.push(["history", record]),
    notifyPartyRoundFromScreenMode: (...args) => events.push(["party", ...args]),
  });
  vm.runInContext(connections + "\n" + shuffle, context);
  vm.runInContext(`
    function testState() { return pokeConnectionsState; }
    function testStart(puzzle) {
      pokeConnectionsState = { puzzle, selected: new Set(), foundGroupIdx: new Set(), mistakes: 0, phase: "playing", lastShake: 0 };
    }
  `, context);
  return { context, root, events };
}

// Independent oracle: enumerate every quartet a player could select and check
// its common attributes directly, without the generator's validation helpers.
const values = (p, category) => category === "type" ? [p.type1, p.type2].filter(Boolean)
  : category === "gen" ? [Number(p.gen || p.generation)] : [p.color].filter(Boolean);
const key = (pokemon) => pokemon.map((p) => Number(p.id)).sort((a, b) => a - b).join(",");
function assertFairPuzzle(puzzle) {
  assert.ok(puzzle, "generator must return a playable puzzle");
  assert.equal(puzzle.groups.length, 4);
  assert.equal(puzzle.tiles.length, 16);
  assert.equal(new Set(puzzle.tiles.map((t) => Number(t.id))).size, 16);
  const accepted = new Set(puzzle.groups.map((g) => key(g.pokemon)));
  const board = puzzle.groups.flatMap((g) => g.pokemon), legal = new Set();
  for (const g of puzzle.groups) {
    assert.ok(["type", "gen", "color"].includes(g.category));
    assert.equal(g.pokemon.length, 4);
    assert.ok(g.pokemon.every((p) => values(p, g.category).includes(g.value)), g.label);
  }
  for (let a = 0; a < 13; a++) for (let b = a + 1; b < 14; b++)
    for (let c = b + 1; c < 15; c++) for (let d = c + 1; d < 16; d++) {
      const quartet = [board[a], board[b], board[c], board[d]];
      if (!["type", "gen", "color"].some((category) => values(quartet[0], category)
        .some((value) => quartet.slice(1).every((p) => values(p, category).includes(value))))) continue;
      const groupKey = key(quartet);
      assert.ok(accepted.has(groupKey), `valid quartet would be rejected: ${quartet.map((p) => p.name).join(", ")}`);
      legal.add(groupKey);
    }
  assert.equal(legal.size, 4, "the board must have exactly four possible groups");
  for (const tile of puzzle.tiles) {
    assert.ok(puzzle.groups[tile.groupIdx].pokemon.some((p) => p.id === tile.id));
    assert.ok(Number(tile.id) > 0 && Number(tile.id) < 10000);
  }
}

function simpleGroups() {
  return ["Feu", "Eau", "Plante", "Électrik"].map((type, groupIdx) => ({
    category: "type", value: type, label: `Type ${type}`,
    pokemon: Array.from({ length: 4 }, (_, idx) => {
      const id = groupIdx * 4 + idx + 1;
      return { id, name: `Pokémon ${id}`, type1: type, gen: Math.ceil(id / 2), color: `Couleur ${id % 6}`, stage: 1, habitat: "Rare" };
    }),
  }));
}

test("the reported board has six Normal Pokémon and cannot be a fair puzzle", () => {
  const ids = [[84, 293, 668, 128], [985, 757, 485, 313], [143, 95, 56, 132], [378, 92, 220, 42]];
  const themes = [["type", "Normal"], ["stage", 1], ["gen", 1], ["habitat", "Grotte"]];
  const groups = ids.map((group, idx) => ({ category: themes[idx][0], value: themes[idx][1], pokemon: group.map((id) => dex.find((p) => p.id === id)) }));
  assert.equal(groups.flatMap((g) => g.pokemon).filter((p) => values(p, "type").includes("Normal")).length, 6);
  assert.equal(fixture().context.pokeConnectionsHasUniqueGroups(groups), false);
});

test("the second reported board must not label every stage-two Pokémon as intermediate", () => {
  const names = [
    ["Corboss", "Pifeuil", "Grahyèna", "Dinglu"],
    ["Boskara", "Dunaja", "Jungko", "Cacnea"],
    ["Dispareptil", "Milobellus", "Cacturne", "Chaffreux"],
    ["Wailmer", "Rosabyss", "Vacilys", "Kabutops"],
  ];
  const themes = [["type", "Ténèbres"], ["color", "Vert"], ["stage", 2], ["habitat", "Mer"]];
  const groups = names.map((group, idx) => ({ category: themes[idx][0], value: themes[idx][1], pokemon: group.map((name) => dex.find((p) => p.name === name)) }));
  assert.ok(groups.every((g) => g.pokemon.every(Boolean)), "all Pokémon in the screenshot must exist in the real data");
  assert.ok(groups[2].pokemon.every((p) => p.stage === 2));
  assert.equal(fixture().context.pokeConnectionsHasUniqueGroups(groups), false);
});

test("validation rejects overlapping chosen themes, alternative quartets and duplicate Pokémon", () => {
  const { context } = fixture();
  assert.equal(context.pokeConnectionsHasUniqueGroups(simpleGroups()), true);
  const overlap = simpleGroups(); overlap[1].pokemon[0].type2 = "Feu";
  assert.equal(context.pokeConnectionsHasUniqueGroups(overlap), false);
  const alternative = simpleGroups(); alternative.forEach((g) => { g.pokemon[0].color = "Or"; });
  assert.equal(context.pokeConnectionsHasUniqueGroups(alternative), false);
  const duplicate = simpleGroups(); duplicate[1].pokemon[0].id = duplicate[0].pokemon[0].id;
  assert.equal(context.pokeConnectionsHasUniqueGroups(duplicate), false);
});

test("1000 seeded puzzles have exactly four legal quartets across all nine generations", () => {
  const seenGenerations = new Set(), seenCategories = new Set();
  for (const seed of [1, 42, 20261005, 987654321]) {
    const { context } = fixture(seed);
    for (let sample = 0; sample < 250; sample++) {
      const puzzle = context.generatePokeConnectionsPuzzle();
      assertFairPuzzle(puzzle);
      puzzle.groups.forEach((g) => { seenCategories.add(g.category); g.pokemon.forEach((p) => seenGenerations.add(p.gen)); });
    }
  }
  assert.deepEqual([...seenGenerations].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([...seenCategories].sort(), ["color", "gen", "type"]);
});

test("insufficient or unsolvable data returns no puzzle instead of an arbitrary answer", () => {
  assert.equal(fixture(42, dex.slice(0, 15)).context.generatePokeConnectionsPuzzle(), null);
  const impossible = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, name: `Test ${i}`, type1: "Normal", gen: 1, color: "Bleu" }));
  assert.equal(fixture(42, impossible).context.generatePokeConnectionsPuzzle(), null);
  const duplicate = dex.slice(0, 15).concat(dex[0], { ...dex[0], id: 10001 });
  assert.equal(fixture(42, duplicate).context.generatePokeConnectionsPuzzle(), null);
});

function select(context, indices) {
  context.clearPokeConnectionsSelection();
  indices.forEach((idx) => context.togglePokeConnectionsTile(idx));
}

test("shuffling preserves found groups and all four solutions win and reward once", () => {
  const { context, root, events } = fixture();
  context.openPokeConnectionsMode();
  const state = context.testState();
  select(context, state.puzzle.tiles.flatMap((t, idx) => t.groupIdx === 0 ? [idx] : []));
  context.submitPokeConnectionsGuess();
  assert.equal(state.foundGroupIdx.size, 1);
  const foundPositions = state.puzzle.tiles.flatMap((t, idx) => t.groupIdx === 0 ? [[idx, t.id]] : []);
  context.shufflePokeConnectionsTiles();
  foundPositions.forEach(([idx, id]) => assert.equal(state.puzzle.tiles[idx].id, id));
  assert.equal(state.selected.size, 0);
  for (let groupIdx = 1; groupIdx < 4; groupIdx++) {
    select(context, state.puzzle.tiles.flatMap((t, idx) => t.groupIdx === groupIdx ? [idx] : []));
    context.submitPokeConnectionsGuess();
  }
  assert.equal(state.phase, "won");
  assert.equal(state.mistakes, 0);
  assert.match(root.innerHTML, /Les 4 connexions sont trouvées/);
  context.submitPokeConnectionsGuess();
  assert.equal(events.filter(([type]) => type === "xp").length, 1);
  assert.equal(events.filter(([type]) => type === "history").length, 1);
  assert.deepEqual(events.filter(([type]) => type === "party"), [["party", true, "puzzle résolu"]]);
});

test("incomplete selection is ignored and four wrong groups reveal the solution without rewards", () => {
  const { context, root, events } = fixture(); context.openPokeConnectionsMode();
  const state = context.testState();
  select(context, [0, 1, 2]); context.submitPokeConnectionsGuess();
  assert.equal(state.mistakes, 0);
  const wrong = [0, 1, 2, 3].map((g) => state.puzzle.tiles.findIndex((t) => t.groupIdx === g));
  for (let attempt = 0; attempt < 4; attempt++) { select(context, wrong); context.submitPokeConnectionsGuess(); }
  assert.equal(state.phase, "lost"); assert.equal(state.mistakes, 4);
  assert.match(root.innerHTML, /Les 4 erreurs sont utilisées/);
  assert.equal((root.innerHTML.match(/is-reveal/g) || []).length, 4);
  assert.equal(events.filter(([type]) => type === "xp").length, 0);
  assert.deepEqual(events.filter(([type]) => type === "party"), [["party", false, "0/4 groupes"]]);
});
