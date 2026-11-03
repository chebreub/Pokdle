// ===== Pokédex › Ma collection : 👁️ Vus / Attrapés, comme dans les jeux (3/11/2026, « go les 3 ») =====
// « Vu » : trouvé en jouant (enregistré dans le profil). « Attrapé » : capturé avec une Ball (lu sur le serveur).
// Rien de nouveau n'est gardé : les captures viennent de /api/wild/collection (wildCaptures).
function colCaughtCount(id) {
  const c = typeof wildCaptures !== "undefined" && wildCaptures ? wildCaptures[id] : null;
  return c ? (Number(c.normal) || 0) + (Number(c.shiny) || 0) : 0;
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
    if (typeof pokedexExperienceView !== "undefined" && pokedexExperienceView === "collection" && typeof renderPokedexGrid === "function") renderPokedexGrid();
  });
}
const COL_FILTERS = [["all", "Tous"], ["caught", "Attrapés"], ["seen", "👁️ Vus"], ["shiny", "✨ Shinies"], ["missing", "? Manquants"], ["mission", "◆ À mériter"], ["secret", "✦ Secrets"]];

if (typeof pokedexCollectionMatchesFilter === "function") {
  const colMatchesBefore = pokedexCollectionMatchesFilter;
  pokedexCollectionMatchesFilter = function (pokemon) {
    if (pokedexExperienceView !== "collection") return true;
    const f = pokedexCollectionFilter;
    if (!["caught", "seen", "missing", "shiny"].includes(f)) return colMatchesBefore(pokemon);
    const state = pokedexCollectionState(pokemon);
    if (f === "caught") return colCaughtCount(pokemon.id) > 0;
    if (f === "seen") return state.kind === "registered" && !colCaughtCount(pokemon.id);
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
      if (p) p.textContent = "Vu = trouvé en jouant · Attrapé = capturé avec une Ball dans les hautes herbes.";
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
      legend.innerHTML = '<span class="is-caught"><b>' + (typeof moBallSvg === "function" ? moBallSvg("poke") : "⚪") + '</b> Attrapé avec une Ball</span><span class="is-seen"><b>👁️</b> Vu en jouant</span>' +
        '<span class="is-mission"><b>◆</b> Récompense de maîtrise</span><span class="is-unknown"><b>?</b> Pas encore vu</span><span class="is-secret"><b>✦</b> Piste cachée</span>';
    }
    const national = document.getElementById("pokedex-collection-national");
    if (national) {
      const base = pokedexCollectionBaseCatalogue(), stats = pokedexCollectionNationalStats();
      const caught = base.filter((p) => colCaughtCount(p.id) > 0).length;
      const shinies = base.filter((p) => colIsShiny(p, pokedexCollectionState(p))).length;
      const total = stats.total || base.length || 1;
      const bar = (cls, label, n, max, title) => '<div class="alb-track col-track ' + cls + '" title="' + title + '"><span>' + label + '</span><i><b style="width:' + (n ? Math.max(1, Math.round(n * 100 / max)) : 0) + '%"></b></i><em>' + n + (max ? ' / ' + max : '') + '</em></div>';
      national.innerHTML = bar("is-seen", "👁️ Vus", stats.found, total, "Trouvés en jouant") +
        bar("is-caught", (typeof moBallSvg === "function" ? moBallSvg("poke") : "⚪") + " Attrapés", caught, total, "Capturés avec une Ball") +
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
    const n = colCaughtCount(pokemon.id), shiny = colIsShiny(pokemon, state);
    card.classList.add(n ? "is-caught" : "is-seen");
    if (shiny) card.classList.add("is-shiny-entry");
    const badge = card.querySelector(".pokedex-collection-state");
    if (badge) {
      badge.classList.add(n ? "is-caught" : "is-seen");
      badge.innerHTML = n ? (typeof moBallSvg === "function" ? moBallSvg("poke") : "⚪") + "Attrapé" + (n > 1 ? " ×" + n : "") : "👁️ Vu";
      if (shiny) badge.insertAdjacentHTML("beforeend", " ✨");
    }
    return card;
  };
}
