"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const {
  RARITY_WEIGHTS, PRESTIGE_WILD_IDS, wildRarity,
  buildWildEncounterTable, drawWildPokemon, wildTicketFor,
} = require("../lib/wild-rarity");
const {
  WILD_POOL, WILD_ENCOUNTER_TABLE, ZONE_POOLS, ZONE_ENCOUNTER_TABLES,
  ACQUISITION_CATALOGUE, EXPEDITIONS, missionPokemonIds, siteLegendIds,
} = require("../lib/poke-balls");
const CAPTURE = require("../capture-rates.json");

test("every national species has a single acquisition route without unlocking excluded species", () => {
  assert.equal(Object.keys(ACQUISITION_CATALOGUE).length, 1025);
  const totals = {};
  for (const route of Object.values(ACQUISITION_CATALOGUE)) totals[route] = (totals[route] || 0) + 1;
  assert.deepEqual(totals, {wild:845,mission:108,secret:3,unassigned:62,expedition:6,prestige_wild:1});
  assert.equal(WILD_POOL.length, 846);
  assert.equal(missionPokemonIds().length, 108);
  assert.equal(EXPEDITIONS.length, 6);
  assert.equal(ACQUISITION_CATALOGUE[373], "prestige_wild");
  for (const id of missionPokemonIds()) assert.equal(ACQUISITION_CATALOGUE[id], "mission", "protected mission #"+id);
  for (const id of siteLegendIds()) assert.ok(!WILD_POOL.includes(id), "protected legendary #"+id);
  for (const id of CAPTURE.mythical) assert.ok(!WILD_POOL.includes(id), "protected mythical #"+id);
  for (const id of [151,251,385]) assert.equal(ACQUISITION_CATALOGUE[id], "secret");
});

test("rarity is custom encounter weighting, not a change to official catch rates", () => {
  assert.equal(wildRarity(10, CAPTURE.rates), "common");
  assert.equal(wildRarity(25, CAPTURE.rates), "common");
  assert.equal(wildRarity(11, CAPTURE.rates), "uncommon");
  assert.equal(wildRarity(26, CAPTURE.rates), "rare");
  assert.equal(wildRarity(1, CAPTURE.rates), "scarce");
  assert.equal(wildRarity(374, CAPTURE.rates), "exceptional");
  assert.equal(wildRarity(373, CAPTURE.rates), "prestige");
  assert.deepEqual(PRESTIGE_WILD_IDS, [373]);
  assert.ok(RARITY_WEIGHTS.common > RARITY_WEIGHTS.uncommon);
  assert.ok(RARITY_WEIGHTS.uncommon > RARITY_WEIGHTS.rare);
  assert.ok(RARITY_WEIGHTS.rare > RARITY_WEIGHTS.scarce);
  assert.ok(RARITY_WEIGHTS.scarce > RARITY_WEIGHTS.prestige);
  assert.equal(CAPTURE.rates[373], 45);
  assert.equal(CAPTURE.rates[10], 255);
});

test("weighted draw is deterministic, bounded and excludes nonmembers", () => {
  const table=buildWildEncounterTable([10,11,373],CAPTURE.rates);
  assert.equal(table.totalWeight, RARITY_WEIGHTS.common+RARITY_WEIGHTS.uncommon+RARITY_WEIGHTS.prestige);
  assert.equal(wildTicketFor(table,10), 0);
  assert.equal(wildTicketFor(table,11), RARITY_WEIGHTS.common);
  assert.equal(wildTicketFor(table,373), RARITY_WEIGHTS.common+RARITY_WEIGHTS.uncommon);
  assert.equal(wildTicketFor(table,149), null);
  for (const id of table.ids) {
    const ticket=wildTicketFor(table,id);
    assert.equal(drawWildPokemon(table,()=>ticket),id);
  }
  assert.equal(drawWildPokemon(table,()=>table.totalWeight-1),373);
  assert.equal(drawWildPokemon(table,()=>RARITY_WEIGHTS.common-1),10);
  assert.throws(()=>drawWildPokemon(table,()=>table.totalWeight),/invalid_wild_draw/);
  assert.throws(()=>drawWildPokemon(table,()=>-1),/invalid_wild_draw/);
  assert.throws(()=>buildWildEncounterTable([10,10],CAPTURE.rates),/duplicate_wild_pokemon/);
  assert.throws(()=>buildWildEncounterTable([99999],CAPTURE.rates),/invalid_pokemon_id/);
  assert.throws(()=>buildWildEncounterTable([] ,CAPTURE.rates),/empty_wild_pool/);
});

test("all six encounter zones retain their original species but use the weighted draw", () => {
  assert.equal(WILD_ENCOUNTER_TABLE.ids.length, WILD_POOL.length);
  assert.equal(WILD_ENCOUNTER_TABLE.totalWeight, WILD_POOL.reduce((n,id)=>n+RARITY_WEIGHTS[wildRarity(id,CAPTURE.rates)],0));
  for (const [zone, ids] of Object.entries(ZONE_POOLS)) {
    const table=ZONE_ENCOUNTER_TABLES[zone];
    assert.deepEqual(table.ids, ids, zone+" uses the same 6-zone pools");
    assert.ok(table.totalWeight > table.ids.length);
    assert.equal(drawWildPokemon(table,()=>0),ids[0]);
    assert.equal(drawWildPokemon(table,()=>table.totalWeight-1),ids[ids.length-1]);
  }
  assert.equal(new Set(Object.values(ZONE_POOLS).flat()).size,WILD_POOL.length);
});
