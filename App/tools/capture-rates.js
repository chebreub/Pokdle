// Les taux de capture officiels (« capture_rate » des jeux), tirés du fichier de PokéAPI,
// jamais de mémoire : node tools/capture-rates.js <pokemon_species.csv>
// Source : https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv
"use strict";
const fs = require("fs"), path = require("path");
const file = process.argv[2];
if (!file) { console.error("Usage : node tools/capture-rates.js pokemon_species.csv"); process.exit(1); }
const [head, ...lines] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
const col = head.split(","), at = (name) => col.indexOf(name);
const rates = {}, legendary = [], mythical = [];
for (const line of lines) {
  const cells = line.split(","), id = Number(cells[at("id")]);
  if (!(id >= 1 && id <= 1025)) continue;
  rates[id] = Number(cells[at("capture_rate")]);
  if (cells[at("is_legendary")] === "1") legendary.push(id);
  if (cells[at("is_mythical")] === "1") mythical.push(id);
}
if (Object.keys(rates).length !== 1025) throw new Error("1025 Pokémon attendus, " + Object.keys(rates).length + " trouvés");
fs.writeFileSync(path.join(__dirname, "..", "capture-rates.json"), JSON.stringify({ source: "PokéAPI pokemon_species.csv (capture_rate, is_legendary, is_mythical)", rates, legendary, mythical }) + "\n");
console.log("capture-rates.json : 1025 taux, " + legendary.length + " légendaires, " + mythical.length + " fabuleux");
