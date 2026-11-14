// ===== 🗺️ Zones des hautes herbes (3/11/2026, « go les 2 ») =====
// Avant chaque rencontre, on choisit où chercher : 6 décors en pixel art (img/zones, dessinés par tools/zone-art.py),
// 3 types chacun, ou « Au hasard ». Le serveur tire dans la zone (lib/poke-balls.js, ZONE_POOLS) ; gratuit.
const WILD_ZONES = [
  { key: "foret", name: "Forêt", types: ["Plante", "Insecte", "Poison"], mascot: 123 },
  { key: "mer", name: "Bord de mer", types: ["Eau", "Glace", "Vol"], mascot: 131 },
  { key: "montagne", name: "Montagne", types: ["Roche", "Sol", "Acier"], mascot: 75 },
  { key: "volcan", name: "Volcan", types: ["Feu", "Dragon", "Combat"], mascot: 126 },
  { key: "tour", name: "Tour hantée", types: ["Spectre", "Ténèbres", "Psy"], mascot: 94 },
  { key: "prairie", name: "Prairie", types: ["Normal", "Électrik", "Fée"], mascot: 179 }
];
const WILD_ZONE_KEY = "pokdle_wild_zone";
let wildZonePools = null;
let wildZoneChoice = null;
let wildZoneFilter = "missing";
let wildZonePage = 0;
let wildZoneLoadSerial = 0;
let wildZoneLoadState = "idle";
function wildZoneOf(key) { return WILD_ZONES.find((z) => z.key === key) || null; }
function wildZoneImg(key) { return "/img/zones/" + key + ".png"; }
function wildZoneRemembered() {
  try { const k = localStorage.getItem(WILD_ZONE_KEY); return k === "hasard" || wildZoneOf(k) ? k : "hasard"; } catch (_e) { return "hasard"; }
}
function wildZoneRemember(key) { try { localStorage.setItem(WILD_ZONE_KEY, key); } catch (_e) { /* rien */ } }
function wildZoneLoadPools() {
  const serial = ++wildZoneLoadSerial;
  wildZoneLoadState = "loading";
  // Relecture à chaque ouverture : les échanges / relâchements changent la possession.
  // Une erreur ne doit jamais afficher une ancienne collection comme si elle était à jour.
  return fetch("/api/wild/collection", { credentials: "same-origin", cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => {
    if (serial !== wildZoneLoadSerial) return null;
    if (data && data.ok && Array.isArray(data.captures) && data.zones && WILD_ZONES.every(z => Array.isArray(data.zones[z.key]))) {
      if (typeof wildSyncAlbum === "function") wildSyncAlbum(data.captures);
      wildZonePools = data.zones;
      wildZoneLoadState = "ready";
    } else {
      wildZoneLoadState = "error";
      return null;
    }
    return wildZonePools;
  }).catch(() => { if (serial === wildZoneLoadSerial) wildZoneLoadState = "error"; return null; });
}
function wildOwned(id) {
  const c = typeof wildCaptures !== "undefined" && wildCaptures && wildCaptures[id];
  return Boolean(c && (Number(c.normal) > 0 || Number(c.shiny) > 0));
}
function wildZoneProgress(key) {
  if (wildZoneLoadState !== "ready" || !wildCaptures || !Array.isArray(wildZonePools && wildZonePools[key])) return null;
  const ids = [...new Set(wildZonePools[key].map(Number).filter(id => Number.isInteger(id) && id > 0))];
  const owned = ids.filter(wildOwned).length;
  return { ids, owned, total: ids.length, missing: ids.length - owned, percent: ids.length ? Math.round(owned / ids.length * 100) : 0 };
}
function wildZoneMissing(key) {
  const progress = wildZoneProgress(key);
  return progress ? progress.missing : null;
}
function wildZoneTypeDots(zone) {
  return zone.types.map((t) => '<i style="background:' + (typeof pokemonTypeColor === "function" ? pokemonTypeColor(t) : "#999") + '" title="' + escapeHtml(t) + '"></i>').join("");
}
function wildZoneArt(id) {
  const p = typeof wildPokemon === "function" ? wildPokemon(id) : null;
  return p ? (typeof pokedexDetailArtwork === "function" ? pokedexDetailArtwork(p, false) : getPokemonSprite(p)) : "";
}

// Chaînes déjà vérifiées dans le Pokédex local, jamais déduites de numéros voisins.
// Ce sont des chaînes de trois espèces, pas des familles exhaustives (branches / bébés).
function wildCollectionChains(id) {
  if (!wildCaptures || typeof getEvolutionChainCandidates !== "function" || typeof POKEMON_LIST === "undefined") return [];
  const available = new Set(Object.values(wildZonePools || {}).flat().map(Number));
  return getEvolutionChainCandidates(POKEMON_LIST).map(chain => ({ chain, owned: chain.filter(p => wildOwned(p.id)).length }))
    .filter(item => id ? item.chain.some(p => p.id === Number(id)) :
      item.owned > 0 && item.owned < item.chain.length && item.chain.every(p => wildOwned(p.id) || available.has(p.id)))
    .sort((a, b) => b.owned - a.owned || a.chain[0].id - b.chain[0].id).slice(0, id ? 1 : 2);
}
function wildChainHtml(item) {
  return '<div class="wz-chain"><div class="wz-chain-mons">' + item.chain.map(p =>
    '<span class="wz-species' + (wildOwned(p.id) ? '' : ' is-missing') + '" title="' + escapeHtml(p.name) + (wildOwned(p.id) ? ' · Possédé' : ' · Manquant') + '">' +
    '<img src="' + escapeHtml(wildZoneArt(p.id)) + '" alt="' + escapeHtml(p.name) + (wildOwned(p.id) ? ', possédé' : ', manquant') + '" width="48" height="48" loading="lazy"></span>').join('') +
    '</div><span><b>Chaîne ' + escapeHtml(item.chain[0].name) + '</b><small>' + item.owned + ' / ' + item.chain.length + ' possédés</small></span></div>';
}
function wildZoneCollectionHtml(zone) {
  if (wildZoneLoadState === "loading" || wildZoneLoadState === "idle") return '<p class="wz-status" role="status">Lecture de ta collection…</p>';
  if (wildZoneLoadState === "error") return '<p class="wz-status" role="status">Collection indisponible. Tu peux toujours explorer. <button type="button" data-action="wildZoneRetry">Réessayer</button></p>';
  if (!zone) return '<p class="wz-status">Choisis une zone pour voir les espèces qui te manquent. La rencontre reste aléatoire.</p>';
  const progress = wildZoneProgress(zone.key);
  if (!progress) return '';
  const missing = wildZoneFilter !== "owned";
  const ids = progress.ids.filter(id => missing ? !wildOwned(id) : wildOwned(id));
  const pages = Math.max(1, Math.ceil(ids.length / 6));
  wildZonePage = Math.max(0, Math.min(wildZonePage, pages - 1));
  const mons = ids.slice(wildZonePage * 6, wildZonePage * 6 + 6).map(id => {
    const p = wildPokemon(id);
    return p ? '<span class="wz-species' + (missing ? ' is-missing' : '') + '"><img src="' + escapeHtml(wildZoneArt(id)) + '" alt="" width="48" height="48" loading="lazy"><small>' + escapeHtml(p.name) + '</small></span>' : '';
  }).join('');
  return '<section class="wz-preview" aria-label="Collection de la zone"><div class="wz-preview-head"><b>' + escapeHtml(zone.name) + ' · ' + progress.owned + ' / ' + progress.total + ' possédés</b>' +
    '<div class="wz-filters"><button type="button" data-action="wildZoneSetFilter" data-args=\'["missing"]\' aria-pressed="' + missing + '">Manquants</button>' +
    '<button type="button" data-action="wildZoneSetFilter" data-args=\'["owned"]\' aria-pressed="' + !missing + '">Possédés</button></div></div>' +
    '<div class="wz-species-grid">' + (mons || '<p>' + (missing ? 'Toutes les espèces de cette zone sont dans ta collection !' : 'Tes premières captures rempliront cette zone.') + '</p>') + '</div>' +
    (pages > 1 ? '<div class="wz-pages"><button type="button" data-action="wildZoneTurnPage" data-args="[-1]" aria-label="Espèces précédentes"' + (!wildZonePage ? ' disabled' : '') + '>←</button><span>' + (wildZonePage + 1) + ' / ' + pages + '</span><button type="button" data-action="wildZoneTurnPage" data-args="[1]" aria-label="Espèces suivantes"' + (wildZonePage === pages - 1 ? ' disabled' : '') + '>→</button></div>' : '') +
    '<small class="wz-preview-note">Possession actuelle · la rencontre reste aléatoire.</small></section>';
}
function wildZoneSetFilter(filter) { wildZoneFilter = filter === "owned" ? "owned" : "missing"; wildZonePage = 0; renderWildZonePicker(false); }
function wildZoneTurnPage(delta) { wildZonePage += delta < 0 ? -1 : 1; renderWildZonePicker(false); }
function wildZoneRetry() {
  const request = wildZoneLoadPools();
  renderWildZonePicker(false);
  request.then(() => { if (document.querySelector("#wild-scene .wz-pick")) renderWildZonePicker(false); });
}

// --- L'écran « Où veux-tu chercher ? » ---
function renderWildZonePicker(focus = true) {
  const scene = wildScene();
  const scroll = scene.querySelector('.wz-pick')?.scrollTop || 0;
  const active = document.activeElement;
  const focusAction = scene.contains(active) && active?.dataset.action;
  const focusArgs = focusAction && active.dataset.args;
  const s = typeof ballState !== "undefined" && ballState ? ballState : null;
  const pick = wildZoneChoice || wildZoneRemembered();
  const zone = wildZoneOf(pick);
  const tiles = WILD_ZONES.map((z) => {
    const progress = wildZoneProgress(z.key);
    return '<button type="button" class="wz-tile' + (z.key === pick ? " is-on" : "") + '" data-action="wildZonePick" data-args=\'["' + z.key + '"]\' aria-pressed="' + (z.key === pick) + '" style="background-image:url(' + wildZoneImg(z.key) + ')">' +
      '<img src="' + escapeHtml(wildZoneArt(z.mascot)) + '" alt="" draggable="false" loading="lazy">' +
      '<span class="wz-lab"><b>' + escapeHtml(z.name) + '</b><small class="wz-type-names">' + escapeHtml(z.types.join(' · ')) + '</small>' +
      (progress ? '<span class="wz-progress"><span class="wz-meter" aria-hidden="true"><i style="width:' + progress.percent + '%"></i></span><small>' + progress.owned + ' / ' + progress.total + ' possédés</small></span>' : '<small>Collection à vérifier</small>') + '</span></button>';
  }).join("");
  scene.innerHTML = wildHead(s) +
    '<div class="wz-pick"><div class="wz-heading"><h3>Où pars-tu aujourd’hui ?</h3><button type="button" class="btn-ghost" data-action="wildOpenAlbum">Mon album →</button></div>' +
    '<p>Choisis une zone. La rencontre reste une surprise.</p>' +
    '<div class="wz-grid">' + tiles + '</div>' +
    '<button type="button" class="wz-rand' + (pick === "hasard" ? " is-on" : "") + '" data-action="wildZonePick" data-args=\'["hasard"]\' aria-pressed="' + (pick === "hasard") + '">🎲 Au hasard <small>toutes les zones</small></button>' +
    '<button type="button" class="wz-go" data-action="wildZoneGo">' + (zone ? "Explorer : " + escapeHtml(zone.name) : "Explorer au hasard") + ' →</button>' +
    wildZoneCollectionHtml(zone) +
    (wildZoneLoadState === 'ready' && wildCollectionChains().length ? '<section class="wz-chains"><h4>Des chaînes à compléter</h4><div>' + wildCollectionChains().map(wildChainHtml).join('') + '</div><small>Ces espèces peuvent vivre dans différentes zones.</small></section>' : '') +
    '<p class="wz-note">Gratuit · change de zone à chaque rencontre</p></div>';
  if (focus) scene.querySelector(".wz-go")?.focus({ preventScroll: true });
  else {
    scene.querySelector('.wz-pick').scrollTop = scroll;
    Array.from(scene.querySelectorAll('[data-action]')).find(el => el.dataset.action === focusAction && el.dataset.args === focusArgs)?.focus({ preventScroll: true });
  }
}
function wildZonePick(key) {
  wildZoneChoice = key === "hasard" || wildZoneOf(key) ? key : "hasard";
  wildZoneRemember(wildZoneChoice);
  wildZonePage = 0;
  if (typeof moSfx === "function") moSfx("pop");
  renderWildZonePicker(false);
}
function wildZoneGo() {
  if (wildZoneLoadState === 'loading') { ++wildZoneLoadSerial; wildZoneLoadState = 'idle'; }
  const key = wildZoneChoice || wildZoneRemembered();
  wildStartEncounter(key === "hasard" ? null : key);
}
window.wildZonePick = wildZonePick;
window.wildZoneGo = wildZoneGo;
window.wildZoneSetFilter = wildZoneSetFilter;
window.wildZoneTurnPage = wildZoneTurnPage;
window.wildZoneRetry = wildZoneRetry;

// --- La rencontre, dans la zone choisie ---
function wildStartEncounter(zone) {
  if (wildBusy) return;
  wildBusy = true;
  const scene = wildScene();
  scene.innerHTML = wildHead(typeof ballState !== "undefined" ? ballState : null) + '<div class="wild-end"><div class="wild-gotcha is-empty"><h3>Les herbes bougent…</h3></div></div>';
  (wildCaptures ? Promise.resolve() : loadWildCaptures()).then(() => wildPost("/api/wild/encounter", zone ? { zone } : {})).then((data) => {
    if (data && data.ok) {
      if (typeof ballApply === "function") ballApply(data, { announce: false });
      renderWildEncounter(data, null, data.fresh);
      const p = wildPokemon(data.encounter.pokemonId);
      if (data.fresh && p && typeof playPokemonCry === "function") { try { playPokemonCry(p, 0.5); } catch (_e) {} }
      return;
    }
    const error = data && data.error;
    const s = typeof ballState !== "undefined" && ballState ? ballState : {};
    if (error === "no_balls") renderWildEnd({ ...s, wild: { ...(s.wild || {}), left: 1 }, bag: { poke: 0, great: 0, ultra: 0 } }, null);
    else if (error === "no_encounters_left") renderWildEnd({ ...s, wild: { ...(s.wild || {}), left: 0 } }, null);
    else { closeWildGrass(); if (typeof showToast === "function") showToast("Les hautes herbes sont indisponibles. Réessaie dans un instant."); }
  }).finally(() => { wildBusy = false; });
}

// Entrer dans les herbes : une rencontre déjà ouverte reprend tout de suite ; sinon, le choix de la zone.
// Sans Ball ou sans rencontre ce jour-là, l'écran habituel l'explique.
if (typeof openWildGrass === "function") {
  const openWildGrassBeforeZones = openWildGrass;
  openWildGrass = function () {
    const s = typeof ballState !== "undefined" && ballState ? ballState : null;
    const bag = s && s.bag || {};
    const canMeet = s && s.wild && !s.wild.open && Number(s.wild.left) > 0 && ["poke", "great", "ultra"].some((b) => Number(bag[b]) > 0);
    if (!canMeet) return openWildGrassBeforeZones.apply(this, arguments);
    wildZoneChoice = null;
    wildZonePage = 0;
    wildZoneFilter = "missing";
    const request = wildZoneLoadPools();
    renderWildZonePicker();
    request.then(() => { if (document.querySelector("#wild-scene .wz-pick")) renderWildZonePicker(false); });
  };
  window.openWildGrass = openWildGrass;
}

// Le décor de la zone pendant la rencontre (l'herbe dessinée reste pour la Forêt et la Prairie).
if (typeof renderWildEncounter === "function") {
  const renderWildEncounterBeforeZones = renderWildEncounter;
  renderWildEncounter = function (state) {
    const out = renderWildEncounterBeforeZones.apply(this, arguments);
    const e = state && (state.encounter || state.wild && state.wild.open);
    const zone = e && wildZoneOf(e.zone);
    const stage = document.querySelector("#wild-scene .wild-stage");
    if (zone && stage && !stage.querySelector(".wz-bg")) {
      stage.classList.add("has-zone", "zone-" + zone.key);
      stage.insertAdjacentHTML("afterbegin", '<div class="wz-bg" aria-hidden="true" style="background-image:url(' + wildZoneImg(zone.key) + ')"></div><div class="wz-fx" aria-hidden="true"></div>');
      const line = document.querySelector("#wild-scene .wild-line");
      if (line && !e.legend) line.insertAdjacentHTML("beforeend", ' <span class="wz-where">· ' + escapeHtml(zone.name) + '</span>');
    }
    return out;
  };
}
