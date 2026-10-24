// Builds base-stats.json: the six base stats of every Pokémon (key: national number) and of
// every PokeAPI form (key: its PokeAPI name, as in FORM_API_NAME_BY_NAME), in the order
// PV, Attaque, Défense, Attaque Spéciale, Défense Spéciale, Vitesse. Stat Mystère reads it
// instead of waiting for PokeAPI. Data: PokeAPI (data/POKEAPI-LICENSE.txt).
//   node tools/base-stats.js
const fs = require("fs");
const path = require("path");

const CSV = (name) => `https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/${name}.csv`;
async function rows(name) {
  const response = await fetch(CSV(name), { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(name + ": HTTP " + response.status);
  const [head, ...lines] = (await response.text()).trim().split(/\r?\n/);
  const keys = head.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, i) => [keys[i], value])));
}

(async () => {
  const [pokemon, stats] = await Promise.all([rows("pokemon"), rows("pokemon_stats")]);
  const keyOf = new Map(pokemon.map((p) => [p.id, Number(p.id) <= 1025 ? p.id : p.identifier]));
  const out = {};
  for (const { pokemon_id: id, stat_id: stat, base_stat: value } of stats) {
    const key = keyOf.get(id);
    if (!key || Number(stat) < 1 || Number(stat) > 6) continue;
    (out[key] ||= [0, 0, 0, 0, 0, 0])[Number(stat) - 1] = Number(value);
  }
  fs.writeFileSync(path.join(__dirname, "..", "base-stats.json"), JSON.stringify(out));
  console.log("[base-stats] " + Object.keys(out).length + " Pokémon and forms");
})().catch((error) => { console.error(error); process.exit(1); });
