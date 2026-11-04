"use strict";

// Rareté de rencontre (Pokédle, pas une statistique officielle Pokémon).
// Les taux de capture PokéAPI restent inchangés : ils ne servent ici qu'à
// classer les espèces déjà autorisées dans les hautes herbes.
// Les 108 récompenses de mission et les légendaires restent exclus en amont.
const RARITY_WEIGHTS = Object.freeze({
  common: 36,
  uncommon: 18,
  rare: 8,
  scarce: 3,
  // Ces quatre espèces (taux de capture 3) sont très dures à attraper.
  // Les rendre aussi presque invisibles serait une double pénalité disproportionnée.
  elusive: 16,
  prestige: 1,
});

// Drattak est le seul pseudo-légendaire non déjà protégé par une
// mission d'album. Il reste obtenable provisoirement, mais exceptionnel.
// Prévoir une véritable voie de prestige avant de le retirer du pool.
const PRESTIGE_WILD_IDS = Object.freeze([373]);
const PRESTIGE_SET = new Set(PRESTIGE_WILD_IDS);

function wildRarity(id, captureRates) {
  if (!Number.isInteger(id) || id < 1 || id > 1025) throw new Error("invalid_pokemon_id");
  const captureRate = Number(captureRates && captureRates[id]);
  if (!Number.isInteger(captureRate) || captureRate < 1 || captureRate > 255) throw new Error("missing_capture_rate");
  if (PRESTIGE_SET.has(id)) return "prestige";
  if (captureRate >= 190) return "common";
  if (captureRate >= 100) return "uncommon";
  if (captureRate >= 60) return "rare";
  if (captureRate >= 25) return "scarce";
  return "elusive";
}

function buildWildEncounterTable(pool, captureRates) {
  if (!Array.isArray(pool) || pool.length < 1) throw new Error("empty_wild_pool");
  const ids = [], limits = [];
  const seen = new Set();
  let totalWeight = 0;
  for (const id of pool) {
    if (seen.has(id)) throw new Error("duplicate_wild_pokemon");
    seen.add(id);
    totalWeight += RARITY_WEIGHTS[wildRarity(id, captureRates)];
    ids.push(id);
    limits.push(totalWeight);
  }
  if (!Number.isSafeInteger(totalWeight)) throw new Error("invalid_wild_weights");
  return Object.freeze({
    ids: Object.freeze(ids),
    limits: Object.freeze(limits),
    totalWeight,
  });
}

function drawWildPokemon(table, randomInt) {
  const ticket = randomInt(table.totalWeight);
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= table.totalWeight) throw new Error("invalid_wild_draw");
  let lo = 0, hi = table.limits.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ticket < table.limits[mid]) hi = mid;
    else lo = mid + 1;
  }
  return table.ids[lo];
}

// Used for deterministic simulation/tests and future rarity diagnostics.
function wildTicketFor(table, pokemonId) {
  const index = table.ids.indexOf(pokemonId);
  return index < 0 ? null : index === 0 ? 0 : table.limits[index - 1];
}

// Exhaustive classification of all national species by first obtainable route.
// "unassigned" means not yet obtainable via a dedicated collection route;
// it must never be mislabeled as a catchable Pokémon.
function acquisitionCatalogue(total, wildIds, missionIds, expeditionIds, secretIds) {
  if (!Number.isInteger(total) || total < 1) throw new Error("invalid_species_total");
  const wild = new Set(wildIds), missions = new Set(missionIds),
    expeditions = new Set(expeditionIds), secrets = new Set(secretIds);
  const result = {};
  for (let id = 1; id <= total; id++) {
    result[id] = missions.has(id) ? "mission"
      : expeditions.has(id) ? "expedition"
      : wild.has(id) ? PRESTIGE_SET.has(id) ? "prestige_wild" : "wild"
      : secrets.has(id) ? "secret"
      : "unassigned";
  }
  return Object.freeze(result);
}

module.exports = {
  RARITY_WEIGHTS, PRESTIGE_WILD_IDS, wildRarity, buildWildEncounterTable,
  drawWildPokemon, wildTicketFor, acquisitionCatalogue,
};
