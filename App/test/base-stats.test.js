"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const stats = require("../base-stats.json");
const core = fs.readFileSync(path.join(__dirname, "../src/script.01.core.js"), "utf8");
const apiNamesStart = core.indexOf("{", core.indexOf("const FORM_API_NAME_BY_NAME"));
let depth = 0, apiNamesEnd = apiNamesStart;
for (; apiNamesEnd < core.length; apiNamesEnd++) {
  if (core[apiNamesEnd] === "{") depth++;
  else if (core[apiNamesEnd] === "}" && !--depth) break;
}
const FORM_API_NAME_BY_NAME = Function("return " + core.slice(apiNamesStart, apiNamesEnd + 1))();

test("base-stats.json gives the six base stats of every Pokémon and every form the site asks PokeAPI for", () => {
  const sixStats = value => Array.isArray(value) && value.length === 6 && value.every(n => Number.isInteger(n) && n > 0 && n <= 255);
  for (let id = 1; id <= 1025; id++) assert.ok(sixStats(stats[id]), "species " + id);
  for (const [name, apiName] of Object.entries(FORM_API_NAME_BY_NAME)) assert.ok(sixStats(stats[apiName]), name + " (" + apiName + ")");
  assert.deepEqual(stats["25"], [35, 55, 40, 50, 50, 90], "Pikachu");
  assert.deepEqual(stats["150"], [106, 110, 90, 154, 90, 130], "Mewtwo");
  assert.deepEqual(stats["charizard-mega-x"], [78, 130, 111, 130, 85, 100], "Méga-Dracaufeu X");
});

test("Stat Mystère reads its stats from the site, never waiting for PokeAPI", async () => {
  const src = fs.readFileSync(path.join(__dirname, "../src/script.02.statclash.js"), "utf8");
  const code = src.slice(src.indexOf("const MYSTERY_STAT_CACHE"), src.indexOf("async function fetchBattleStats("))
    + src.slice(src.indexOf("async function fetchBattleStats("), src.indexOf("\n}\n", src.indexOf("async function fetchBattleStats(")) + 2);
  const calls = [];
  const context = vm.createContext({
    FORM_API_NAME_BY_NAME: { "Méga-Dracaufeu X": "charizard-mega-x" },
    getPokemonDexNumber: p => p.dex,
    fetch: async url => { calls.push(url); return { ok: true, json: async () => stats }; },
    fetchPokeApiJson: async url => { calls.push(url); throw new Error("PokeAPI is down"); },
  });
  vm.runInContext(code, context);
  assert.deepEqual({ ...await context.fetchBattleStats({ name: "Pikachu", dex: 25 }) }, { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 });
  assert.equal((await context.fetchBattleStats({ name: "Méga-Dracaufeu X", dex: 6 })).attack, 130);
  assert.deepEqual(calls, ["base-stats.json"], "one local file, no PokeAPI call");
});
