// Vérification des noms FR de pokemon.js contre la source officielle (PokeAPI).
// Usage : depuis le dossier App/, lancer `node verify-names.mjs`
// (nécessite Node 18+ et une connexion internet). Outil jetable, à supprimer après.
import { readFileSync } from "fs";

const src = readFileSync(new URL("./pokemon.js", import.meta.url), "utf8");

// Extrait les paires id -> name des espèces de base (1..1025)
const pairs = [...src.matchAll(/"id":(\d+),"name":"((?:[^"\\]|\\.)*)"/g)]
  .map((m) => [Number(m[1]), m[2]])
  .filter(([id]) => id >= 1 && id <= 1025);
const dataById = new Map(pairs);

console.log(`${pairs.length} espèces à vérifier (1..1025)…`);

async function officialFr(id) {
  for (let tryN = 0; tryN < 3; tryN++) {
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
      if (!r.ok) return null;
      const j = await r.json();
      const fr = j.names.find((n) => n.language.name === "fr");
      return fr ? fr.name : null;
    } catch {
      await new Promise((res) => setTimeout(res, 400));
    }
  }
  return null;
}

const ids = [...dataById.keys()].sort((a, b) => a - b);
const queue = ids.slice();
const mismatches = [];
const unreachable = [];
let done = 0;

async function worker() {
  while (queue.length) {
    const id = queue.shift();
    const off = await officialFr(id);
    const data = dataById.get(id);
    if (off == null) unreachable.push(id);
    else if (off !== data) mismatches.push({ id, data, official: off });
    if (++done % 100 === 0) console.log(`  …${done}/${ids.length}`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));

mismatches.sort((a, b) => a.id - b.id);
console.log(`\n=== ÉCARTS (${mismatches.length}) ===`);
for (const m of mismatches) {
  console.log(`#${m.id}  data="${m.data}"  officiel="${m.official}"`);
}
if (unreachable.length) {
  console.log(`\n(${unreachable.length} ids non récupérés : ${unreachable.slice(0, 30).join(", ")}${unreachable.length > 30 ? "…" : ""})`);
}
console.log("\nTermine. Colle la liste des ÉCARTS pour que je corrige.");
