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
function wildZoneOf(key) { return WILD_ZONES.find((z) => z.key === key) || null; }
function wildZoneImg(key) { return "/img/zones/" + key + ".png"; }
function wildZoneRemembered() {
  try { const k = localStorage.getItem(WILD_ZONE_KEY); return k === "hasard" || wildZoneOf(k) ? k : "hasard"; } catch (_e) { return "hasard"; }
}
function wildZoneRemember(key) { try { localStorage.setItem(WILD_ZONE_KEY, key); } catch (_e) { /* rien */ } }
function wildZoneLoadPools() {
  if (wildZonePools) return Promise.resolve(wildZonePools);
  return fetch("/api/wild/collection", { credentials: "same-origin" }).then((r) => r.ok ? r.json() : null).then((data) => {
    if (data && data.ok) {
      if (typeof wildSyncAlbum === "function") wildSyncAlbum(data.captures);
      if (data.zones) wildZonePools = data.zones;
    }
    return wildZonePools;
  }).catch(() => wildZonePools);
}
function wildZoneMissing(key) {
  const ids = wildZonePools && wildZonePools[key];
  if (!ids) return null;
  const caught = typeof wildCaptures !== "undefined" && wildCaptures ? wildCaptures : {};
  return ids.filter((id) => !caught[id]).length;
}
function wildZoneTypeDots(zone) {
  return zone.types.map((t) => '<i style="background:' + (typeof pokemonTypeColor === "function" ? pokemonTypeColor(t) : "#999") + '" title="' + escapeHtml(t) + '"></i>').join("");
}
function wildZoneArt(id) {
  const p = typeof wildPokemon === "function" ? wildPokemon(id) : null;
  return p ? (typeof pokedexDetailArtwork === "function" ? pokedexDetailArtwork(p, false) : getPokemonSprite(p)) : "";
}

// --- L'écran « Où veux-tu chercher ? » ---
function renderWildZonePicker() {
  const scene = wildScene();
  const s = typeof ballState !== "undefined" && ballState ? ballState : null;
  const pick = wildZoneChoice || wildZoneRemembered();
  const zone = wildZoneOf(pick);
  const tiles = WILD_ZONES.map((z) => {
    const missing = wildZoneMissing(z.key);
    return '<button type="button" class="wz-tile' + (z.key === pick ? " is-on" : "") + '" data-action="wildZonePick" data-args=\'["' + z.key + '"]\' aria-pressed="' + (z.key === pick) + '" style="background-image:url(' + wildZoneImg(z.key) + ')">' +
      '<img src="' + escapeHtml(wildZoneArt(z.mascot)) + '" alt="" draggable="false" loading="lazy">' +
      '<span class="wz-lab"><b>' + escapeHtml(z.name) + '</b><small><span class="wz-dots">' + wildZoneTypeDots(z) + '</span>' +
      (missing === null ? "" : '<em title="Pokémon que tu n’as pas encore attrapés ici">' + missing + '</em>') + '</small></span></button>';
  }).join("");
  scene.innerHTML = wildHead(s) +
    '<div class="wz-pick"><h3>Où veux-tu chercher ?</h3>' +
    '<p>Chaque zone a ses types. En jaune : les Pokémon que tu n’as pas encore attrapés.</p>' +
    '<div class="wz-grid">' + tiles + '</div>' +
    '<button type="button" class="wz-rand' + (pick === "hasard" ? " is-on" : "") + '" data-action="wildZonePick" data-args=\'["hasard"]\' aria-pressed="' + (pick === "hasard") + '">🎲 Au hasard <small>toutes les zones</small></button>' +
    '<button type="button" class="wz-go" data-action="wildZoneGo">' + (zone ? "Chercher : " + escapeHtml(zone.name) : "Chercher au hasard") + ' →</button>' +
    '<p class="wz-note">Gratuit · change de zone à chaque rencontre</p></div>';
  scene.querySelector(".wz-go")?.focus({ preventScroll: true });
}
function wildZonePick(key) {
  wildZoneChoice = key === "hasard" || wildZoneOf(key) ? key : "hasard";
  wildZoneRemember(wildZoneChoice);
  if (typeof moSfx === "function") moSfx("pop");
  renderWildZonePicker();
}
function wildZoneGo() {
  const key = wildZoneChoice || wildZoneRemembered();
  wildStartEncounter(key === "hasard" ? null : key);
}
window.wildZonePick = wildZonePick;
window.wildZoneGo = wildZoneGo;

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
    renderWildZonePicker();
    wildZoneLoadPools().then(() => { if (document.querySelector("#wild-scene .wz-pick")) renderWildZonePicker(); });
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
