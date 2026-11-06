// ===== Collection : découvertes, missions et véritables captures =====
// Mission/secret = découverte uniquement. Seule la collection de captures côté
// serveur prouve qu'un Pokémon est possédé ; jamais un champ de profil local.
// Aucun changement des sauvegardes : tous ces compteurs sont dérivés.
function colCaughtCount(id) {
  const c = typeof wildCaptures !== "undefined" && wildCaptures ? wildCaptures[id] : null;
  return c ? (Number(c.normal) || 0) + (Number(c.shiny) || 0) : 0;
}
function colEverCaughtCount(id) {
  const history = typeof wildCaptureHistory !== "undefined" ? wildCaptureHistory : null;
  if (history === null) return null;
  const c = history[id];
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
  return colCaughtCount(pokemon.id) > 0;
}
function colCollectionProgress(base) {
  let seen = 0, caught = 0, obtained = 0;
  for (const pokemon of base) {
    if (pokedexCollectionState(pokemon).kind === "registered") seen++;
    if (colEverCaughtCount(pokemon.id) > 0) caught++;
    if (colIsObtained(pokemon)) obtained++;
  }
  return { seen, caught, obtained };
}
function colIsShiny(pokemon, state) {
  const c = typeof wildCaptures !== "undefined" && wildCaptures ? wildCaptures[pokemon.id] : null;
  return Boolean((state && state.entry && state.entry.shiny) || (c && Number(c.shiny) > 0));
}
let colCapturesAsked = false;
function colResetCaptureSnapshot() {
  colCapturesAsked = false;
  if (typeof wildCaptureHistory !== "undefined") wildCaptureHistory = null;
}
function colRefreshVisibleCollection() {
  const screen = document.getElementById("screen-pokedex");
  if (pokedexExperienceView !== "collection" || !screen || screen.classList.contains("hidden")) return;
  colResetCaptureSnapshot();
  renderPokedexGrid();
}

// DEX-02 : l'API de collection reste la source des voies de capture.
// Les missions et secrets visibles dans le client n'accordent que des découvertes.
// Ne pas reconstruire des captures ni déduire des routes si le serveur est indisponible.
function colAcquisitionHtml(pokemon) {
  if (!pokemon) return "";
  const id = Number(pokemon.id);
  const routes = typeof wildCaptureRoutes !== "undefined" ? wildCaptureRoutes : null;
  const mission = typeof ALBUM_MISSIONS !== "undefined"
    ? ALBUM_MISSIONS.find(m => Number(m.pokemonId) === id) : null;
  const secret = typeof SECRET_MISSIONS !== "undefined"
    ? SECRET_MISSIONS.some(m => Number(m.pokemonId) === id) : false;
  const state = typeof pokedexCollectionState === "function" ? pokedexCollectionState(pokemon) : null;
  const hidden = state?.kind === "secret" || Boolean(mission?.hidden);
  let capture;
  if (!routes) capture = "Informations indisponibles pour le moment.";
  else if (routes.prestige === id) capture = "Épreuve de prestige Drattak : conditions à remplir, rencontre avec Balls, capture non garantie.";
  else if (routes.expedition.includes(id)) capture = "Expédition hebdomadaire : lors de sa rotation et sous conditions de participation, rencontre avec Balls sans capture garantie.";
  else if (routes.wild.includes(id)) capture = "Hautes herbes : rencontre aléatoire selon les zones, puis lancer de Ball. Rien n’est garanti.";
  else capture = "Aucune voie de capture avec une Ball actuellement disponible.";
  const discovery = hidden || (secret && !mission)
    ? "Piste secrète : consulte le carnet des secrets. Découvrir ne donne pas le Pokémon."
    : mission
      ? "Mission d’album : débloque la découverte uniquement, jamais une capture automatique."
      : "Jeux de découverte : une entrée peut être révélée en jouant, sans donner de capture.";
  return '<section class="pokedex-acquisition" data-pokemon-id="' + id + '" aria-label="Voies d’obtention">' +
    '<h4>Voies d’obtention</h4><p><b>Capture :</b> ' + capture + '</p>' +
    '<p><b>Découverte :</b> ' + discovery + '</p>' +
    '<small>Un échange peut donner un exemplaire déjà détenu par un autre joueur, sans prouver une capture personnelle.</small></section>';
}

function colPersonalStatesHtml(pokemon) {
  const captured = colEverCaughtCount(pokemon.id);
  const owned = typeof wildCaptures !== "undefined" && wildCaptures !== null ? colCaughtCount(pokemon.id) : null;
  return '<div><span>Vu / découvert</span><b>Oui</b></div>' +
    '<div><span>Déjà capturé avec une Ball</span><b>' + (captured === null ? 'Données indisponibles' : captured > 0 ? 'Oui · capture enregistrée' : 'Aucune capture enregistrée') + '</b></div>' +
    '<div><span>Possédé actuellement</span><b>' + (owned === null ? 'Données indisponibles' : owned > 0 ? owned + ' exemplaire' + (owned > 1 ? 's' : '') : 'Non') + '</b></div>';
}
function colEnsureCaptures() {
  if (colCapturesAsked || typeof loadWildCaptures !== "function") return;
  colCapturesAsked = true;
  loadWildCaptures().then(() => {
    const loaded = typeof wildCaptures !== "undefined" && wildCaptures !== null;
    colCapturesAsked = loaded;
    if (loaded && typeof pokedexExperienceView !== "undefined" && pokedexExperienceView === "collection" && typeof renderPokedexGrid === "function") renderPokedexGrid();
  });
}
const COL_FILTERS = [["all", "Tous"], ["seen", "👁️ Découverts"], ["caught", "Déjà capturés"], ["obtained", "◆ Possédés actuellement"], ["shiny", "✨ Shinies"], ["missing", "? Non découverts"], ["mission", "◆ À mériter"], ["secret", "✦ Secrets"]];

if (typeof pokedexCollectionMatchesFilter === "function") {
  const colMatchesBefore = pokedexCollectionMatchesFilter;
  pokedexCollectionMatchesFilter = function (pokemon) {
    if (pokedexExperienceView !== "collection") return true;
    const f = pokedexCollectionFilter;
    if (!["caught", "obtained", "seen", "missing", "shiny"].includes(f)) return colMatchesBefore(pokemon);
    const state = pokedexCollectionState(pokemon);
    if (f === "caught") return colEverCaughtCount(pokemon.id) > 0;
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
      if (p) p.textContent = "Découvert = vu en jouant ou en mission · Déjà capturé = une capture avec une Ball enregistrée · Possédé actuellement = encore dans ta collection, y compris par échange. Une mission ne donne pas directement le Pokémon.";
    }
    const filters = document.getElementById("pokedex-collection-filters");
    if (filters && !filters.dataset.vus) {
      filters.dataset.vus = "1";
      filters.innerHTML = COL_FILTERS.map(([key, label]) => '<button type="button" data-collection-filter="' + key + '" data-action="setPokedexCollectionFilter" data-args=\'["' + key + '"]\'>' +
        (key === "caught" && typeof moBallSvg === "function" ? moBallSvg("poke") : "") + label + '</button>').join("");
    }
    filters?.querySelectorAll("[data-collection-filter]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.collectionFilter === pokedexCollectionFilter));
      b.disabled = (b.dataset.collectionFilter === "caught" && (typeof wildCaptureHistory === "undefined" || wildCaptureHistory === null))
        || (b.dataset.collectionFilter === "obtained" && (typeof wildCaptures === "undefined" || wildCaptures === null));
    });
    const legend = document.getElementById("pokedex-collection-legend");
    if (legend && !legend.dataset.vus) {
      legend.dataset.vus = "1";
      legend.innerHTML = '<span class="is-caught"><b>' + (typeof moBallSvg === "function" ? moBallSvg("poke") : "⚪") + '</b> Déjà capturé : reste enregistré après échange ou cession</span><span class="is-mission"><b>◆</b> Possédé actuellement : capture ou échange reçu</span><span class="is-seen"><b>👁️</b> Découvert en jouant</span>' +
        '<span class="is-mission"><b>◆</b> Mission accomplie : Pokémon vu, à capturer</span><span class="is-unknown"><b>?</b> Pas encore vu</span><span class="is-secret"><b>✦</b> Piste cachée</span>';
    }
    const national = document.getElementById("pokedex-collection-national");
    if (national) {
      const base = pokedexCollectionBaseCatalogue(), stats = pokedexCollectionNationalStats();
      const totals = colCollectionProgress(base);
      const loaded = typeof wildCaptures !== "undefined" && wildCaptures !== null;
      const historyLoaded = typeof wildCaptureHistory !== "undefined" && wildCaptureHistory !== null;
      const catchable = typeof wildCatchableTotal !== "undefined" && Number.isInteger(wildCatchableTotal) && wildCatchableTotal > 0 ? wildCatchableTotal : null;
      const shinies = base.filter((p) => colIsShiny(p, pokedexCollectionState(p))).length;
      const total = stats.total || base.length || 1;
      const bar = (cls, label, n, max, title) => {
        const known = Number.isFinite(n), limit = Number.isFinite(max) && max > 0 ? max : 0;
        const percent = known && limit ? Math.min(100, Math.max(0, Math.round(n * 100 / limit))) : 0;
        const amount = known ? String(n) : "…";
        return '<div class="alb-track col-track ' + cls + '" title="' + title + '"><span>' + label + '</span><i><b style="width:' + percent + '%"></b></i><em>' + amount + (max === 0 ? '' : ' / ' + (limit || '…')) + '</em></div>';
      };
      national.innerHTML = bar("is-seen", "👁️ Découverts", totals.seen, total, "Espèces découvertes en jouant ou en mission") +
        bar("is-caught", (typeof moBallSvg === "function" ? moBallSvg("poke") : "⚪") + " Déjà capturés", historyLoaded ? totals.caught : null, catchable, "Captures personnelles enregistrées, même après échange ou cession ; recevoir un échange ne compte pas comme une capture") +
        bar("is-mission", "◆ Possédés actuellement", loaded ? totals.obtained : null, total, "Espèces encore dans ta collection, y compris reçues par échange") +
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
    const ownedKnown = typeof wildCaptures !== "undefined" && wildCaptures !== null;
    const shiny = colIsShiny(pokemon, state);
    card.classList.add(n ? "is-caught" : reward ? "is-mission" : "is-seen");
    if (shiny) card.classList.add("is-shiny-entry");
    const badge = card.querySelector(".pokedex-collection-state");
    if (badge) {
      badge.classList.add(n ? "is-caught" : reward ? "is-mission" : "is-seen");
      badge.innerHTML = n ? "◆ Possédé" + (n > 1 ? " ×" + n : "") : colEverCaughtCount(pokemon.id) > 0 ? "⚪ Déjà capturé" + (ownedKnown ? " · non possédé" : "") : reward ? (reward === "secret" ? "✦ Secret découvert" : "◆ Mission accomplie · Vu") : "👁️ Vu";
      if (shiny) badge.insertAdjacentHTML("beforeend", " ✨");
    }
    return card;
  };
}
