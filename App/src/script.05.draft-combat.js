// ============================================================
// Shared helpers left from the former Draft combat file:
// player nickname cleanup (1v1 Score rooms) and the Pokédex evolution summary.
// The dormant battle engine (Draft Arènes) was removed on 13/10/2026.
// ============================================================
function sanitizePlayerNickname(value) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, 24);
}

async function fetchPokedexEvolutionChainData(url) {
  if (typeof url !== "string" || !url) return null;
  if (POKEDEX_EVOLUTION_CACHE.has(url)) return POKEDEX_EVOLUTION_CACHE.get(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    POKEDEX_EVOLUTION_CACHE.set(url, data);
    return data;
  } catch (_err) {
    return null;
  }
}

function formatPokedexApiLabel(value) {
  if (typeof value !== "string" || !value) return "Inconnu";
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPokedexFrenchSpeciesName(speciesRef) {
  const speciesId = speciesIdFromUrl(speciesRef?.url);
  if (Number.isInteger(speciesId)) {
    const frenchMatch = POKEMON_LIST.find((pokemon) => {
      if (pokemon?.isAltForm) return false;
      return Number(getMysteryApiId(pokemon)) === speciesId;
    });
    if (frenchMatch?.name) return frenchMatch.name;
  }
  return formatPokedexApiLabel(speciesRef?.name || "");
}

// ---- How a Pokémon evolves, in French: « Pierre Feu », « Niveau 28 », « Poing de Colère ×20 »… ----
// Item and move names come from PokeAPI in French; the triggers use PokeAPI's French wording, shortened.
const POKEDEX_EVOLUTION_TRIGGERS_FR = {
  "level-up": "Montée de niveau",
  "in-battle-level-up": "Montée de niveau en combat",
  trade: "Échange",
  "use-item": "Objet",
  shed: "Place dans l’équipe et une Poké Ball",
  spin: "Tourner sur soi-même",
  "tower-of-darkness": "Tour des Ténèbres",
  "tower-of-waters": "Tour de l’Eau",
  "three-critical-hits": "3 coups critiques en un combat",
  "take-damage": "Encaisser des dégâts, puis aller à un lieu précis",
  "recoil-damage": "Subir des dégâts de contrecoup",
  "use-move": "Utiliser une capacité",
  "agile-style-move": "Capacité en style agile",
  "strong-style-move": "Capacité en style puissant",
  "three-defeated-bisharp": "Vaincre 3 Scalproie tenant un Emblème du Général",
  "gimmighoul-coins": "Collectionner 999 Pièces Mordudor",
  "meltan-candies": "400 Bonbons Meltan dans Pokémon GO",
};
const POKEDEX_TIME_OF_DAY_FR = { day: "de jour", night: "de nuit", dusk: "au crépuscule", "full-moon": "pleine lune" };
const POKEDEX_REGION_FORM = /-(alola|galar|hisui|paldea)\b/;
const POKEDEX_REGION_LABELS = { alola: "d’Alola", galar: "de Galar", hisui: "de Hisui", paldea: "de Paldea" };

function pokedexEvolutionDetailRegion(detail) {
  const forms = [detail?.required_pokemon_form?.name, detail?.evolved_pokemon_form?.name];
  return forms.map((name) => (String(name || "").match(POKEDEX_REGION_FORM) || [])[1]).find(Boolean) || "";
}

// One way to evolve per step: the one for this region (Goupix d'Alola → Pierre Glace), the one PokeAPI marks
// as the default, or one that does not depend on a place (Magnéton → Pierre Foudre rather than the Mont Couronné).
function pickPokedexEvolutionDetail(details, region = "") {
  const list = Array.isArray(details) ? details.filter(Boolean) : [];
  const sameRegion = list.filter((detail) => pokedexEvolutionDetailRegion(detail) === region);
  const pool = sameRegion.length ? sameRegion : list;
  return pool.find((detail) => detail.is_default) || pool.find((detail) => !detail.location) || pool[0] || null;
}

async function pokedexApiNameFr(ref) {
  if (!ref?.name) return "";
  const data = ref.url ? await fetchPokedexMoveData(ref.url) : null;
  const fr = Array.isArray(data?.names) ? data.names.find((entry) => entry?.language?.name === "fr") : null;
  return fr?.name || formatPokedexApiLabel(ref.name);
}

async function getPokedexEvolutionMethodText(detail, region = "") {
  if (!detail || typeof detail !== "object") return "";
  const trigger = detail.trigger?.name || "";
  const level = Number(detail.min_level);
  const damage = Number(detail.min_damage_taken);
  const moveCount = Number(detail.min_move_count) > 0 ? ` ×${Number(detail.min_move_count)}` : "";
  const style = { "agile-style-move": " en style agile", "strong-style-move": " en style puissant" }[trigger] || "";

  let main = "";
  if (level > 0) main = `Niveau ${level}${trigger === "in-battle-level-up" ? " en combat" : ""}`;
  else if (detail.item?.name) main = await pokedexApiNameFr(detail.item);
  else if (detail.used_move?.name) main = `${await pokedexApiNameFr(detail.used_move)}${moveCount}${style}`;
  else if (trigger === "recoil-damage" && damage > 0) main = `Subir ${damage} PV de dégâts de contrecoup`;
  else if (trigger === "take-damage" && damage > 0) main = `Encaisser ${damage} PV de dégâts, puis aller à un lieu précis`;
  else if (trigger === "trade") main = "Échange";
  else if (trigger !== "level-up") main = POKEDEX_EVOLUTION_TRIGGERS_FR[trigger] || "Méthode spéciale";
  if (trigger === "trade" && detail.held_item?.name) main += ` en tenant ${await pokedexApiNameFr(detail.held_item)}`;
  if (trigger === "trade" && detail.trade_species?.name) main += ` contre ${getPokedexFrenchSpeciesName(detail.trade_species)}`;

  const conditions = [];
  if (detail.min_happiness) conditions.push("amitié élevée");
  if (detail.min_affection) conditions.push("affection élevée");
  if (detail.min_beauty) conditions.push("beauté élevée");
  if (detail.known_move?.name) conditions.push(`connaît ${await pokedexApiNameFr(detail.known_move)}`);
  if (detail.known_move_type?.name) conditions.push(`connaît une capacité ${typeLabelFrFromApiName(detail.known_move_type.name)}`);
  if (trigger !== "trade" && detail.held_item?.name) conditions.push(`en tenant ${await pokedexApiNameFr(detail.held_item)}`);
  if (detail.party_species?.name) conditions.push(`avec ${getPokedexFrenchSpeciesName(detail.party_species)} dans l’équipe`);
  if (detail.party_type?.name) conditions.push(`avec un Pokémon ${typeLabelFrFromApiName(detail.party_type.name)} dans l’équipe`);
  if (Number.isInteger(detail.relative_physical_stats)) conditions.push(`Attaque ${{ 1: ">", 0: "=", "-1": "<" }[detail.relative_physical_stats]} Défense`);
  if (POKEDEX_TIME_OF_DAY_FR[detail.time_of_day]) conditions.push(POKEDEX_TIME_OF_DAY_FR[detail.time_of_day]);
  if (detail.gender === 1 || detail.gender === 2) conditions.push(detail.gender === 1 ? "femelle" : "mâle");
  if (detail.needs_overworld_rain) conditions.push("sous la pluie");
  if (detail.turn_upside_down) conditions.push("console retournée");
  if (detail.needs_multiplayer) conditions.push("en jouant à plusieurs");
  if (Number(detail.min_steps) > 0) conditions.push(`après ${Number(detail.min_steps)} pas`);
  if (Array.isArray(detail.allowed_natures) && detail.allowed_natures.length) conditions.push("selon sa nature");
  if (detail.location && !main && !conditions.length) conditions.push("à un lieu précis");

  const text = main
    ? [main, ...conditions].join(", ")
    : conditions.join(", ").replace(/^./, (c) => c.toUpperCase()) || POKEDEX_EVOLUTION_TRIGGERS_FR["level-up"];
  const detailRegion = pokedexEvolutionDetailRegion(detail);
  return detailRegion && detailRegion !== region ? `${text} (forme ${POKEDEX_REGION_LABELS[detailRegion]})` : text;
}

function findPokedexEvolutionNode(chain, speciesName, parent = null) {
  if (!chain || !speciesName) return null;
  if (chain.species?.name === speciesName) {
    return { node: chain, parent };
  }
  const nextNodes = Array.isArray(chain.evolves_to) ? chain.evolves_to : [];
  for (const child of nextNodes) {
    const found = findPokedexEvolutionNode(child, speciesName, chain);
    if (found) return found;
  }
  return null;
}

// The Pokémon of a chain: its regional form when the open sheet is one (Goupix d'Alola), else the usual one.
function pokedexEvolutionEntry(speciesRef, region) {
  const speciesId = speciesIdFromUrl(speciesRef?.url);
  if (!Number.isInteger(speciesId)) return null;
  const label = POKEDEX_REGION_LABELS[region];
  const regional = label ? POKEMON_LIST.find((pokemon) => pokemon?.isAltForm && Number(pokemon.baseId) === speciesId && pokemon.name.includes(label.replace("’", "'"))) : null;
  return regional || POKEMON_LIST.find((pokemon) => !pokemon?.isAltForm && Number(getMysteryApiId(pokemon)) === speciesId) || null;
}

function pokedexEvolutionCardHtml(node, region, currentSpecies, methodText = "") {
  const entry = pokedexEvolutionEntry(node?.species, region);
  const name = entry?.name || getPokedexFrenchSpeciesName(node?.species);
  const isCurrent = node?.species?.name === currentSpecies;
  const image = entry ? `<img src="${pokedexDetailArtwork(entry, false)}" alt="" loading="lazy" data-fallback="${getPokemonSprite(entry)}" />` : "";
  const label = methodText ? `<span><b>${escapeHtml(name)}</b><small>${escapeHtml(methodText)}</small></span>` : `<b>${escapeHtml(name)}</b>`;
  if (isCurrent || !entry) return `<div class="pokedex-evo-card${isCurrent ? " is-current" : ""}">${image}${label}</div>`;
  return `<button type="button" class="pokedex-evo-card" data-action="openPokedexRecent" data-args='[${entry.id}]' title="Voir la fiche de ${escapeHtml(name)}">${image}${label}</button>`;
}

// The whole family in pictures. A straight line reads left to right with the method on each arrow
// (Férosinge → Niveau 28 → Colossinge → Poing de Colère ×20 → Courrousinge); a branching family shows each
// starting Pokémon with one box per evolution and its method (Évoli → Aquali · Pierre Eau, Voltali · Pierre Foudre…).
async function pokedexEvolutionSummaryHtml(speciesData, pokeData) {
  const unavailable = "<p class=\"pokedex-muted\">Infos d’évolution non disponibles.</p>";
  const chainUrl = speciesData?.evolution_chain?.url;
  const speciesName = pokeData?.species?.name;
  if (!chainUrl || !speciesName) return unavailable;
  const chain = (await fetchPokedexEvolutionChainData(chainUrl))?.chain;
  if (!findPokedexEvolutionNode(chain, speciesName)) return unavailable;
  if (!chain.evolves_to?.length) return "<p class=\"pokedex-muted\">Ce Pokémon n’évolue pas.</p>";

  const region = (String(pokeData?.name || "").match(POKEDEX_REGION_FORM) || [])[1] || "";
  const card = (node, methodText) => pokedexEvolutionCardHtml(node, region, speciesName, methodText);
  const method = async (node) => (await getPokedexEvolutionMethodText(pickPokedexEvolutionDetail(node.evolution_details, region), region)) || "Méthode inconnue";
  const isLine = (node) => !node.evolves_to?.length || (node.evolves_to.length === 1 && isLine(node.evolves_to[0]));

  if (isLine(chain)) {
    const parts = [card(chain)];
    for (let node = chain.evolves_to[0]; node; node = node.evolves_to?.[0]) {
      parts.push(`<div class="pokedex-evo-step"><span>${escapeHtml(await method(node))}</span><i aria-hidden="true">→</i></div>`, card(node));
    }
    return `<div class="pokedex-evo-chain">${parts.join("")}</div>`;
  }

  const branches = [];
  const addBranches = async (node) => {
    if (!node.evolves_to?.length) return;
    const targets = await Promise.all(node.evolves_to.map(async (child) => card(child, await method(child))));
    branches.push(`<div class="pokedex-evo-branch">${card(node)}<i aria-hidden="true">→</i><div class="pokedex-evo-targets">${targets.join("")}</div></div>`);
    for (const child of node.evolves_to) await addBranches(child);
  };
  await addBranches(chain);
  return branches.join("");
}
