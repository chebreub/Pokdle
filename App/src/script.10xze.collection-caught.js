// ===== Collection : découvertes, captures et récompenses (4/11/2026) =====
// Découvert (vu) : trouvé en jouant, depuis les découvertes du profil.
// Capturé : encore possédé, depuis /api/wild/collection uniquement.
// Obtenu : capturé OU véritable mission/secret réclamé (jamais une simple devinette).
// Ces compteurs sont des vues dérivées : aucune migration ni nouvelle donnée locale.
function colCaughtCount(id) {
  const c = typeof wildCaptures !== "undefined" && wildCaptures ? wildCaptures[id] : null;
  return c ? (Number(c.normal) || 0) + (Number(c.shiny) || 0) : 0;
}
function colRewardKind(pokemon) {
  const profile = typeof playerProfile !== "undefined" && playerProfile ? playerProfile : null;
  if (!profile || !pokemon) return null;
  const state = pokedexCollectionState(pokemon);
  if (state.kind !== "registered") return null;
  const entry = state.entry || {};
  const id = Number(pokemon.id);
  // Une récompense déjà réclamée reste reconnue même si la provenance de la
  // découverte a changé après une synchronisation de profil.
  const mission = typeof ALBUM_MISSIONS !== "undefined" && ALBUM_MISSIONS.some(
    (m) => Number(m.pokemonId) === id && Boolean(profile.albumMissionClaims?.[m.id])
  );
  const secret = typeof SECRET_MISSIONS !== "undefined" && SECRET_MISSIONS.some(
    (m) => Number(m.pokemonId) === id && Boolean(profile.secrets?.claimed?.[m.id])
  );
  if (mission || entry.source === "mission" || Object.keys(entry.missions || {}).length > 0) return "mission";
  if (secret || entry.source === "secret" || Object.keys(entry.secrets || {}).length > 0) return "secret";
  return null;
}
function colIsObtained(pokemon) {
  return colCaughtCount(pokemon.id) > 0 || Boolean(colRewardKind(pokemon));
}
function colCollectionProgress(base) {
  let seen = 0, caught = 0, obtained = 0;
  for (const pokemon of base) {
    if (pokedexCollectionState(pokemon).kind === "registered") seen++;
    if (colCaughtCount(pokemon.id) > 0) caught++;
    if (colIsObtained(pokemon)) obtained++;
  }
  return { seen, caught, obtained };
}
function colIsShiny(pokemon, state) {
  const c = typeof wildCaptures !== "undefined" && wildCaptures ? wildCaptures[pokemon.id] : null;
  return Boolean((state && state.entry && state.entry.shiny) || (c && Number(c.shiny) > 0));
}
let colCapturesAsked = false;
function colEnsureCaptures() {
  if (colCapturesAsked || typeof loadWildCaptures !== "function") return;
  colCapturesAsked = true;
  loadWildCaptures().then(() => {
    const loaded = typeof wildCaptures !== "undefined" && wildCaptures !== null;
    colCapturesAsked = loaded;
    if (loaded && typeof pokedexExperienceView !== "undefined" && pokedexExperienceView === "collection" && typeof renderPokedexGrid === "function") renderPokedexGrid();
  });
}
const COL_FILTERS = [["all", "Tous"], ["seen", "👁️ Vus"], ["caught", "Attrapés"], ["obtained", "◆ Obtenus"], ["shiny", "✨ Shinies"], ["missing", "? Manquants"], ["mission", "◆ À mériter"], ["secret", "✦ Secrets"]];

if (typeof pokedexCollectionMatchesFilter === "function") {
  const colMatchesBefore = pokedexCollectionMatchesFilter;
  pokedexCollectionMatchesFilter = function (pokemon) {
    if (pokedexExperienceView !== "collection") return true;
    const f = pokedexCollectionFilter;
    if (!["caught", "obtained", "seen", "missing", "shiny"].includes(f)) return colMatchesBefore(pokemon);
    const state = pokedexCollectionState(pokemon);
    if (f === "caught") return colCaughtCount(pokemon.id) > 0;
    if (f === "obtained") return colIsObtained(pokemon);
    if (f === "seen") return state.kind === "registered";
    if (f === "missing") return state.kind !== "registered";
    return colIsShiny(pokemon, state);
  };
}
setPokedexCollectionFilter = function (filter) {
  pokedexCollectionFilter = COL_FILTERS.some(([key]) => key === filter) ? filter : "all";
  renderPokedexGrid();
};

if (typeof renderPokedexCollectionHub === "function") {
  const colHubBefore = renderPokedexCollectionHub;
  renderPokedexCollectionHub = function () {
    const out = colHubBefore.apply(this, arguments);
    const hub = document.getElementById("pokedex-collection-hub");
    if (!hub) return out;
    if (pokedexExperienceView === "collection") colEnsureCaptures();
    const id = hub.querySelector(".pokedex-collection-identity");
    if (id && !id.dataset.vus) {
      id.dataset.vus = "1";
      const h3 = id.querySelector("h3"), p = id.querySelector("p");
      if (h3) h3.textContent = "Ma collection";
      if (p) p.textContent = "Vu = découvert en jouant · Capturé = avec une Ball · Obtenu = capturé ou récompense réclamée.";
    }
    const filters = document.getElementById("pokedex-collection-filters");
    if (filters && !filters.dataset.vus) {
      filters.dataset.vus = "1";
      filters.innerHTML = COL_FILTERS.map(([key, label]) => '<button type="button" data-collection-filter="' + key + '" data-action="setPokedexCollectionFilter" data-args=\'["' + key + '"]\'>' +
        (key === "caught" && typeof moBallSvg === "function" ? moBallSvg("poke") : "") + label + '</button>').join("");
    }
    filters?.querySelectorAll("[data-collection-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.collectionFilter === pokedexCollectionFilter)));
    const legend = document.getElementById("pokedex-collection-legend");
    if (legend && !legend.dataset.vus) {
      legend.dataset.vus = "1";
      legend.innerHTML = '<span class="is-caught"><b>' + (typeof moBallSvg === "function" ? moBallSvg("poke") : "⚪") + '</b> Capturé avec une Ball (herbes ou expédition)</span><span class="is-seen"><b>👁️</b> Découvert en jouant</span>' +
        '<span class="is-mission"><b>◆</b> Obtenu en récompense</span><span class="is-unknown"><b>?</b> Pas encore vu</span><span class="is-secret"><b>✦</b> Piste cachée</span>';
    }
    const national = document.getElementById("pokedex-collection-national");
    if (national) {
      const base = pokedexCollectionBaseCatalogue(), stats = pokedexCollectionNationalStats();
      const totals = colCollectionProgress(base);
      const loaded = typeof wildCaptures !== "undefined" && wildCaptures !== null;
      const catchable = typeof wildCatchableTotal !== "undefined" && Number.isInteger(wildCatchableTotal) && wildCatchableTotal > 0 ? wildCatchableTotal : null;
      const shinies = base.filter((p) => colIsShiny(p, pokedexCollectionState(p))).length;
      const total = stats.total || base.length || 1;
      const bar = (cls, label, n, max, title) => {
        const known = Number.isFinite(n), limit = Number.isFinite(max) && max > 0 ? max : 0;
        const percent = known && limit ? Math.min(100, Math.max(0, Math.round(n * 100 / limit))) : 0;
        const amount = known ? String(n) : "…";
        return '<div class="alb-track col-track ' + cls + '" title="' + title + '"><span>' + label + '</span><i><b style="width:' + percent + '%"></b></i><em>' + amount + (max === 0 ? '' : ' / ' + (limit || '…')) + '</em></div>';
      };
      national.innerHTML = bar("is-seen", "👁️ Vus", totals.seen, total, "Espèces découvertes en jouant") +
        bar("is-caught", (typeof moBallSvg === "function" ? moBallSvg("poke") : "⚪") + " Capturés", loaded ? totals.caught : null, catchable, "Capturés avec une Ball parmi les espèces sauvages et d'expédition") +
        bar("is-mission", "◆ Obtenus", loaded ? totals.obtained : null, total, "Captures encore possédées et récompenses de missions ou secrets réclamées ; une simple découverte ne suffit pas") +
        bar("is-shiny", "✨ Shinies", shinies, 0, "Shinies trouvés ou capturés") +
        '<div class="pokedex-collection-substats"><span><b>' + stats.formsFound + '</b> / ' + stats.formsTotal + ' formes</span><span><b>' + stats.missions + '</b> récompenses spéciales à débloquer</span></div>';
    }
    return out;
  };
}

if (typeof createPokedexCard === "function") {
  const colCardBefore = createPokedexCard;
  createPokedexCard = function (pokemon) {
    const card = colCardBefore.apply(this, arguments);
    if (pokedexExperienceView !== "collection" || !card) return card;
    const state = pokedexCollectionState(pokemon);
    if (state.kind !== "registered") return card;
    const n = colCaughtCount(pokemon.id), reward = colRewardKind(pokemon);
    const shiny = colIsShiny(pokemon, state);
    card.classList.add(n ? "is-caught" : reward ? "is-mission" : "is-seen");
    if (shiny) card.classList.add("is-shiny-entry");
    const badge = card.querySelector(".pokedex-collection-state");
    if (badge) {
      badge.classList.add(n ? "is-caught" : reward ? "is-mission" : "is-seen");
      badge.innerHTML = n ? (typeof moBallSvg === "function" ? moBallSvg("poke") : "⚪") + "Attrapé" + (n > 1 ? " ×" + n : "") : reward ? (reward === "secret" ? "✦ Secret obtenu" : "◆ Mission obtenue") : "👁️ Vu";
      if (shiny) badge.insertAdjacentHTML("beforeend", " ✨");
    }
    return card;
  };
}
