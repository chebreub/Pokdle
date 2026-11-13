'use strict';
// Noms officiels des Pokémon en anglais et en espagnol (13/11/2026, lot 0 de la traduction).
// Source : PokéAPI, pokemon_species_names.csv (langue 9 = anglais, 7 = espagnol).
// Usage : node tools/i18n-names.js chemin/vers/pokemon_species_names.csv
// Écrit i18n/pokemon-names.json : { en: { id: nom }, es: { id: nom seulement s'il diffère de l'anglais } }.
const fs = require('fs');
const path = require('path');
const csv = process.argv[2];
if (!csv) { console.error('Donne le chemin de pokemon_species_names.csv'); process.exit(1); }
const lines = fs.readFileSync(csv, 'utf8').trim().split(/\r?\n/).slice(1);
const by = {};
for (const line of lines) {
  const [id, lang, name] = line.split(',');
  const n = Number(id);
  if (n < 1 || n > 1025) continue;
  (by[n] = by[n] || {})[lang] = name;
}
const en = {}, es = {};
for (let id = 1; id <= 1025; id++) {
  const row = by[id] || {};
  if (!row['9']) throw new Error('Nom anglais manquant : ' + id);
  en[id] = row['9'];
  if (row['7'] && row['7'] !== row['9']) es[id] = row['7'];
}
fs.writeFileSync(path.join(__dirname, '..', 'i18n', 'pokemon-names.json'), JSON.stringify({ source: 'PokeAPI pokemon_species_names.csv', en, es }) + '\n');
console.log('en', Object.keys(en).length, 'es (différents de l’anglais)', Object.keys(es).length);
