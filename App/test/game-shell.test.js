"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const context = vm.createContext({ renderGameOverBox() {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/script.10j.game-shell.js"), "utf8"), context);
const facts = rows => Array.from(context.shellObservedFacts(rows));

test("notebook never discloses facts absent from observed comparisons", () => {
  const pokemon = { name: "Bulbizarre", gen: 1, type1: "Plante", height: 0.7, weight: 6.9 };
  assert.deepEqual(facts([{ pokemon, cmp: { generation: "wrong", type1: "close", height: "wrong", weight: "close" } }]), []);
  assert.deepEqual(facts([{ pokemon, cmp: { generation: "ok", type1: "wrong" } }]), ["Génération : 1"]);
});
test("notebook tightens observed bounds and replaces them when exact", () => {
  const rows = [5, 8, 6].map(weight => ({ pokemon: { weight }, cmp: { weight: "wrong" }, weightDirection: "↑" }));
  assert.deepEqual(facts(rows), ["Poids : plus de 8 kg"]);
  rows.push({ pokemon: { weight: 10 }, cmp: { weight: "ok" } });
  assert.deepEqual(facts(rows), ["Poids : 10 kg"]);
});
test("result statistics are scoped to the actual mode and respect losses", () => {
  const history = [{ mode: "daily", result: "loss" }, ...["win", "win", "loss", "win", "win", "win"].map(result => ({ mode: "normal", result }))];
  assert.deepEqual(JSON.parse(JSON.stringify(context.shellRecentStats(history, "normal"))), { played: 6, wins: 5, current: 2, best: 3 });
  assert.deepEqual(JSON.parse(JSON.stringify(context.shellRecentStats([], "daily"))), { played: 0, wins: 0, current: 0, best: 0 });
});
