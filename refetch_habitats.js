#!/usr/bin/env node
// ============================================================
// refetch_habitats.js
// Re-dérive les habitats Pokémon depuis PokéAPI species et patche
// App/pokemon.js (qui a 649/1025 Pokémon avec habitat "Rare" par défaut).
//
// Usage (depuis la racine du projet) :
//   node refetch_habitats.js              # dry-run, montre le diff
//   node refetch_habitats.js --apply      # écrit App/pokemon.js + backup
//
// Requiert Node >= 18 (fetch natif).
// ============================================================

const fs = require("fs");
const path = require("path");

const POKEMON_JS_PATH = path.join(__dirname, "App", "pokemon.js");
const CACHE_PATH = path.join(__dirname, ".habitat-cache.json");
const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 25;
const RETRY_LIMIT = 3;
const RETRY_BACKOFF_MS = 1500;

// Mapping habitat PokéAPI (anglais) -> habitat français utilisé dans pokemon.js
const HABITAT_FR_MAP = {
  "cave": "Grotte",
  "forest": "Forêt",
  "grassland": "Prairie",
  "mountain": "Montagne",
  "rare": "Rare",
  "rough-terrain": "Sentier accidenté",
  "sea": "Mer",
  "urban": "Urbain",
  "waters-edge": "Eau douce",
};

function loadPokemonJs() {
  const text = fs.readFileSync(POKEMON_JS_PATH, "utf8");
  const m = text.match(/POKEMON_LIST\s*=\s*(\[)/);
  if (!m) throw new Error("POKEMON_LIST array not found in pokemon.js");
  const start = m.index + m[0].length - 1; // position of '['
  // Walk to matching ']'
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) { i += 1; break; }
    }
    i += 1;
  }
  const arrText = text.slice(start, i);
  const arr = JSON.parse(arrText);
  return { text, arr, arrStart: start, arrEnd: i };
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch (_e) {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0), "utf8");
}

async function fetchSpeciesHabitat(id, retries = RETRY_LIMIT) {
  const url = `https://pokeapi.co/api/v2/pokemon-species/${id}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "pokdle-habitat-refetch/1.0" } });
    if (!res.ok) {
      if (res.status === 404) return { id, habitat: null, status: "not-found" };
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const habitatName = data?.habitat?.name || null; // null pour Gen 6+
    return { id, habitat: habitatName, status: "ok" };
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      return fetchSpeciesHabitat(id, retries - 1);
    }
    return { id, habitat: null, status: "error", error: String(err.message || err) };
  }
}

async function fetchAllHabitats(ids, cache) {
  const results = new Map();
  const toFetch = [];
  for (const id of ids) {
    if (cache[id] && cache[id].habitat !== undefined) {
      results.set(id, cache[id]);
    } else {
      toFetch.push(id);
    }
  }
  console.log(`Cache hits: ${results.size} / ${ids.length}. Fetch needed: ${toFetch.length}.`);

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((id) => fetchSpeciesHabitat(id)));
    for (const r of batchResults) {
      results.set(r.id, r);
      cache[r.id] = { habitat: r.habitat, status: r.status };
    }
    // Save cache every batch (résilient aux interruptions)
    saveCache(cache);
    const done = Math.min(i + BATCH_SIZE, toFetch.length);
    process.stdout.write(`\r  fetched ${done}/${toFetch.length}…`);
  }
  if (toFetch.length) process.stdout.write("\n");
  return results;
}

function computeChanges(arr, habitatResults) {
  const changes = [];
  const stats = { unchanged: 0, fixed: 0, stillRare: 0, errored: 0 };
  for (const p of arr) {
    const r = habitatResults.get(p.id);
    if (!r) { stats.errored += 1; continue; }
    const apiHabitat = r.habitat;
    let newHabitat;
    if (!apiHabitat) {
      // PokéAPI n'a pas d'habitat (Gen 6+ ou rare) → garder l'actuel s'il n'est pas Rare, sinon Rare
      newHabitat = p.habitat && p.habitat !== "Rare" ? p.habitat : "Rare";
      if (newHabitat === "Rare") stats.stillRare += 1;
    } else {
      newHabitat = HABITAT_FR_MAP[apiHabitat] || p.habitat;
    }
    if (newHabitat !== p.habitat) {
      changes.push({ id: p.id, name: p.name, from: p.habitat, to: newHabitat });
      stats.fixed += 1;
    } else {
      stats.unchanged += 1;
    }
  }
  return { changes, stats };
}

function buildNewPokemonJs(originalText, arr, arrStart, arrEnd, changes) {
  const changeMap = new Map(changes.map((c) => [c.id, c.to]));
  const newArr = arr.map((p) => {
    if (changeMap.has(p.id)) {
      return { ...p, habitat: changeMap.get(p.id) };
    }
    return p;
  });
  const newArrText = JSON.stringify(newArr);
  return originalText.slice(0, arrStart) + newArrText + originalText.slice(arrEnd);
}

async function main() {
  console.log("=== Pokédle — Re-dérivation habitats PokéAPI ===");
  console.log(`Mode : ${APPLY ? "APPLY (écriture activée)" : "DRY-RUN (lecture seule)"}\n`);

  const { text, arr, arrStart, arrEnd } = loadPokemonJs();
  console.log(`Pokémon chargés : ${arr.length}`);

  // Stats initiales
  const initialRare = arr.filter((p) => p.habitat === "Rare").length;
  console.log(`Habitats "Rare" actuels : ${initialRare}\n`);

  const cache = loadCache();
  const ids = arr.map((p) => p.id);
  const habitatResults = await fetchAllHabitats(ids, cache);

  const { changes, stats } = computeChanges(arr, habitatResults);

  console.log("\n--- Résumé ---");
  console.log(`  Inchangés          : ${stats.unchanged}`);
  console.log(`  Mis à jour         : ${stats.fixed}`);
  console.log(`  Restent "Rare"     : ${stats.stillRare}`);
  console.log(`  Erreurs            : ${stats.errored}`);

  if (changes.length) {
    console.log("\n--- Aperçu des changements (premiers 25) ---");
    for (const c of changes.slice(0, 25)) {
      console.log(`  #${String(c.id).padStart(4, "0")} ${c.name.padEnd(20)} : ${c.from || "(vide)"} → ${c.to}`);
    }
    if (changes.length > 25) console.log(`  … et ${changes.length - 25} autres.`);
  }

  if (!APPLY) {
    console.log("\nDry-run terminé. Pour appliquer : `node refetch_habitats.js --apply`");
    return;
  }

  if (!changes.length) {
    console.log("\nRien à patcher.");
    return;
  }

  // Backup + écriture
  const backupPath = POKEMON_JS_PATH + ".bak";
  fs.writeFileSync(backupPath, text, "utf8");
  console.log(`\nBackup créé : ${backupPath}`);

  const newText = buildNewPokemonJs(text, arr, arrStart, arrEnd, changes);
  fs.writeFileSync(POKEMON_JS_PATH, newText, "utf8");
  console.log(`Fichier patché : ${POKEMON_JS_PATH}`);
  console.log(`Habitats fixés : ${stats.fixed}.`);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
