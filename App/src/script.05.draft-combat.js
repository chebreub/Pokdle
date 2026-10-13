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

function getPokedexEvolutionMethodText(detail) {
  if (!detail || typeof detail !== "object") return "";
  if (Number.isFinite(Number(detail.min_level)) && Number(detail.min_level) > 0) return `Niveau ${Number(detail.min_level)}`;
  if (detail.item?.name) return `Pierre / objet : ${formatPokedexApiLabel(detail.item.name)}`;
  if (detail.trigger?.name === "trade") return "Échange";
  if (detail.trigger?.name === "use-item") return detail.item?.name ? `Objet : ${formatPokedexApiLabel(detail.item.name)}` : "Objet";
  if (detail.min_happiness) return "Bonheur";
  if (detail.time_of_day) return `Moment : ${formatPokedexApiLabel(detail.time_of_day)}`;
  if (detail.held_item?.name) return `Objet tenu : ${formatPokedexApiLabel(detail.held_item.name)}`;
  return detail.trigger?.name ? formatPokedexApiLabel(detail.trigger.name) : "";
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

async function pokedexEvolutionSummaryHtml(speciesData, pokeData) {
  const chainUrl = speciesData?.evolution_chain?.url;
  const speciesName = pokeData?.species?.name;
  if (!chainUrl || !speciesName) return "<p class=\"pokedex-muted\">Infos d’évolution non disponibles.</p>";
  const chainData = await fetchPokedexEvolutionChainData(chainUrl);
  const match = findPokedexEvolutionNode(chainData?.chain, speciesName);
  if (!match?.node) return "<p class=\"pokedex-muted\">Infos d’évolution non disponibles.</p>";

  const previousNode = match.parent || null;
  const nextNodes = Array.isArray(match.node.evolves_to) ? match.node.evolves_to : [];
  const previousDetail = Array.isArray(match.node.evolution_details) ? match.node.evolution_details[0] : null;

  const rows = [];
  if (previousNode?.species?.name) {
    rows.push(`
      <div><span>Évolue depuis</span><b>${escapeHtml(getPokedexFrenchSpeciesName(previousNode.species))}</b></div>
      <div><span>Méthode</span><b>${escapeHtml(getPokedexEvolutionMethodText(previousDetail) || "Non précisée")}</b></div>
    `);
  }

  if (nextNodes.length) {
    const nextLabels = nextNodes
      .map((node) => getPokedexFrenchSpeciesName(node?.species))
      .filter(Boolean)
      .join(" • ");
    const nextMethod = nextNodes
      .map((node) => getPokedexEvolutionMethodText(Array.isArray(node?.evolution_details) ? node.evolution_details[0] : null))
      .filter(Boolean)
      .join(" • ");
    rows.push(`
      <div><span>Évolue vers</span><b>${escapeHtml(nextLabels || "—")}</b></div>
      <div><span>Méthode</span><b>${escapeHtml(nextMethod || "Non précisée")}</b></div>
    `);
  }

  if (!rows.length) {
    return "<p class=\"pokedex-muted\">Aucune évolution liée connue pour ce Pokémon.</p>";
  }

  return `<div class="pokedex-detail-grid pokedex-extra-grid">${rows.join("")}</div>`;
}

