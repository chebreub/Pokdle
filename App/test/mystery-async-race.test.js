"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const src = fs.readFileSync(path.join(__dirname, "../src/script.03.minijeux.js"),"utf8");
const from = src.indexOf("function buildMysteryBattleClues(");
const to = src.indexOf("function getMysteryStatMeta(",from);
assert.ok(from >= 0 && to > from, "Mystery implementation source must be available");
const logic = src.slice(from,to);
const poke = (id, type1 = "Plante") => ({id,name:"Pokemon"+id,type1,type2:null});
const stats = hp => ({hp,attack:60,defense:70,spAttack:80,spDefense:90,speed:100});

function fixture(fetchBattleStats) {
  const rendered = [];
  const context = vm.createContext({
    gameMode:"mystery", secretPokemon:null, gameOver:false, mysteryClues:[],
    fetchBattleStats,
    updateMysteryPanel(reveal) {
      rendered.push({reveal, values:context.mysteryClues.map(i=>String(i.value))});
    },
  });
  vm.runInContext(logic, context);
  return {context,rendered};
}

test("a late response from an earlier Mystery round cannot corrupt the next round", async () => {
  const pending = new Map();
  const {context,rendered} = fixture(pokemon => new Promise(resolve => pending.set(pokemon.id,resolve)));
  const first = poke(25,"Électrik"), second = poke(1,"Plante");
  context.secretPokemon = first;
  const p1 = context.prepareMysteryClues(first);
  assert.equal(context.mysteryClues[0].value,"Électrik");
  context.secretPokemon = second;
  const p2 = context.prepareMysteryClues(second);
  assert.equal(context.mysteryClues[0].value,"Plante");

  pending.get(25)(stats(35));
  await p1;
  assert.equal(context.mysteryClues[0].value,"Plante");
  assert.equal(context.mysteryClues[1].value,"Chargement...");
  assert.equal(rendered.length,2,"Stale response must not repaint the new round");

  context.gameOver = true; // The second game finished before fetch completed.
  pending.get(1)(stats(45));
  await p2;
  assert.equal(context.mysteryClues[1].value,45);
  assert.equal(context.mysteryClues[7].value,445);
  assert.equal(rendered.at(-1).reveal,true,"Late stats should update an already revealed answer");
});

test("even the same Pokémon reselected in a new round uses the latest request", async () => {
  const promises=[];
  const {context} = fixture(() => new Promise(resolve => promises.push(resolve)));
  const secret = poke(1);
  context.secretPokemon = secret;
  const first=context.prepareMysteryClues(secret);
  const second=context.prepareMysteryClues(secret);
  promises[0](stats(10));
  await first;
  assert.equal(context.mysteryClues[1].value,"Chargement...");
  promises[1](stats(55));
  await second;
  assert.equal(context.mysteryClues[1].value,55);
});

test("failed PokeAPI stats become neutral unknown fields rather than endless loading", async () => {
  const secret=poke(25);
  const {context,rendered}=fixture(async()=>{throw Error("network unavailable");});
  context.secretPokemon=secret;
  await context.prepareMysteryClues(secret);
  assert.equal(context.mysteryClues.length,8);
  assert.equal(context.mysteryClues[0].value,"Plante");
  assert.ok(context.mysteryClues.slice(1).every(v=>v.value==="?"));
  assert.equal(rendered.at(-1).reveal,false);
});

test("Mystery shows actual battle stats and their sum", () => {
  const {context}=fixture(async()=>stats(50));
  const rows=context.buildMysteryBattleClues(poke(1),stats(50));
  assert.equal(rows.length,8);
  assert.equal(rows[1].value,50);
  assert.equal(rows[7].value,450);
});
