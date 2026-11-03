
// ===== Les hautes herbes (PR B de la boucle, 3/11/2026) =====
// Le serveur (lib/poke-balls.js) tire le Pokémon, le shiny (1/150) et chaque lancer. Ici : la scène,
// la Ball qui tremble, « Gotcha ! », et le Pokémon capturé qui rejoint l'album (marque ⚪).
let wildCaptures = null;      // { [id]: { normal, shiny } } lu sur le serveur
let wildBusy = false;
let wildSkipAnim = null;

function wildPokemon(id) { return typeof POKEMON_BY_ID !== "undefined" ? POKEMON_BY_ID.get(Number(id)) || null : null; }
function wildArtwork(p, shiny) {
  return typeof pokedexDetailArtwork === "function" ? pokedexDetailArtwork(p, shiny) : getPokemonSprite(p);
}
function wildReducedMotion() {
  try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_e) { return false; }
}
function wildPost(url, body) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), credentials: "same-origin" })
    .then((r) => r.json().catch(() => null)).catch(() => null);
}
// Une capture faite sur un autre appareil remplit aussi la case ici, sans fête ni XP.
function wildSyncAlbum(list) {
  wildCaptures = {};
  let changed = false;
  for (const c of list || []) {
    wildCaptures[c.id] = { normal: Number(c.normal) || 0, shiny: Number(c.shiny) || 0 };
    const p = wildPokemon(c.id);
    if (!p || typeof playerProfile === "undefined" || !playerProfile) continue;
    playerProfile.discoveries ||= {};
    if (!playerProfile.discoveries[p.id] && typeof addDiscovery === "function" && addDiscovery(playerProfile.discoveries, p, "capture")) changed = true;
    const rec = playerProfile.discoveries[p.id];
    if (rec && c.shiny > 0 && !rec.shiny) { rec.shiny = "capture"; changed = true; }
  }
  if (changed && typeof saveProfile === "function") saveProfile();
}
function loadWildCaptures() {
  return fetch("/api/wild/collection", { credentials: "same-origin" }).then((r) => r.ok ? r.json() : null).then((data) => {
    if (data && data.ok) { wildSyncAlbum(data.captures); if (typeof ballApply === "function") ballApply(data, { announce: false }); }
    return wildCaptures;
  }).catch(() => wildCaptures);
}

function wildScene() {
  let scene = document.getElementById("wild-scene");
  if (!scene) {
    scene = document.createElement("div");
    scene.id = "wild-scene"; scene.className = "wild-scene";
    scene.setAttribute("role", "dialog"); scene.setAttribute("aria-modal", "true"); scene.setAttribute("aria-label", "Hautes herbes");
    document.body.appendChild(scene);
  }
  document.body.classList.add("modal-open");
  return scene;
}
function closeWildGrass() {
  const scene = document.getElementById("wild-scene");
  if (scene) scene.remove();
  document.body.classList.remove("modal-open");
  if (typeof refreshBalls === "function") refreshBalls({ announce: false });
}
function wildThrowsHtml(e) {
  return '<span class="wild-throws" aria-label="' + e.throwsLeft + ' lancer' + (e.throwsLeft > 1 ? "s" : "") + ' restant' + (e.throwsLeft > 1 ? "s" : "") + '">' +
    Array.from({ length: 3 }, (_, i) => '<i class="' + (i < e.throwsLeft ? "is-on" : "") + '"></i>').join("") + '</span>';
}
function wildHead(state) {
  const w = state && state.wild || { today: 0, max: 6 };
  return '<div class="wild-head"><b>🌿 Hautes herbes</b><span>Rencontre ' + Math.min(w.max, Math.max(1, w.today)) + ' / ' + w.max + '</span>' +
    '<button type="button" class="wild-close" data-action="closeWildGrass" aria-label="Fermer">×</button></div>';
}
function wildBallButtons(state, e) {
  const bag = state.bag || {};
  return '<div class="wild-balls">' + ["poke", "great", "ultra"].filter((k) => k !== "ultra" || Number(bag.ultra) > 0).map((k) => {
    const n = Number(bag[k]) || 0;
    return '<button type="button" class="wild-ball-btn" data-action="wildThrow" data-args=\'["' + k + '"]\'' + (n ? "" : " disabled") + '>' +
      ballImg(k, 34) + '<span><b>' + BALL_KINDS[k].name + '</b><small>× ' + n + ' · ' + (Number(e.chances && e.chances[k]) || 0) + ' %</small></span></button>';
  }).join("") + '</div>';
}
function renderWildEncounter(state, message) {
  const e = state.encounter || state.wild && state.wild.open;
  const p = e && wildPokemon(e.pokemonId);
  if (!e || !p) return renderWildEnd(state, null);
  const scene = wildScene();
  const name = escapeHtml(p.name);
  scene.innerHTML = wildHead(state) +
    '<div class="wild-stage' + (e.shiny ? " is-shiny" : "") + '">' +
      '<div class="wild-grass" aria-hidden="true"></div>' +
      '<img class="wild-mon" src="' + escapeHtml(wildArtwork(p, e.shiny)) + '" data-fallback="' + escapeHtml(getPokemonSprite(p)) + '" alt="' + name + (e.shiny ? " shiny" : "") + '" draggable="false">' +
      '<div class="wild-ball" aria-hidden="true">' + ballImg("poke", 44) + '</div>' +
    '</div>' +
    '<div class="wild-panel">' +
      '<p class="wild-line" aria-live="polite">' + (message || (e.shiny ? "✨ Un " + name + " <b>shiny</b> sauvage apparaît !" : "Un " + name + " sauvage apparaît !")) + '</p>' +
      '<div class="wild-meta">' + wildThrowsHtml(e) + '<span>' + (wildCaptures && wildCaptures[p.id] ? "⚪ Déjà dans ton album" : "Nouveau pour ton album ?") + '</span></div>' +
      wildBallButtons(state, e) +
      '<button type="button" class="wild-run" data-action="wildRun">Fuir</button>' +
    '</div>';
  scene.querySelector(".wild-close")?.focus({ preventScroll: true });
}
function renderWildEnd(state, outcome) {
  const scene = wildScene();
  const w = state && state.wild || { left: 0, max: 6 };
  const bag = state && state.bag || {};
  const hasBall = (Number(bag.poke) || 0) + (Number(bag.great) || 0) + (Number(bag.ultra) || 0) > 0;
  let body = "";
  if (outcome && outcome.caught) {
    const p = wildPokemon(outcome.pokemonId);
    body = '<div class="wild-gotcha' + (outcome.shiny ? " is-shiny" : "") + '"><img src="' + escapeHtml(wildArtwork(p, outcome.shiny)) + '" alt="" draggable="false">' +
      '<h3>Gotcha ! ' + escapeHtml(p.name) + (outcome.shiny ? " ✨" : "") + ' est attrapé !</h3>' +
      '<p>' + (outcome.isNew ? "Il rejoint ton album." : "Un doublon de plus dans ta collection.") + '</p></div>';
  } else if (outcome && outcome.fled) {
    const p = wildPokemon(outcome.pokemonId);
    body = '<div class="wild-gotcha is-fled"><h3>' + escapeHtml(p ? p.name : "Le Pokémon") + ' s’est enfui…</h3><p>Pas de chance cette fois.</p></div>';
  } else {
    body = '<div class="wild-gotcha is-empty"><h3>' + (w.left > 0 ? "Les herbes bougent…" : "Plus de rencontre aujourd’hui") + '</h3></div>';
  }
  const next = w.left > 0 && hasBall
    ? '<button type="button" class="wild-cta" data-action="openWildGrass">🌿 Continuer · ' + w.left + ' rencontre' + (w.left > 1 ? "s" : "") + '</button>'
    : '<p class="wild-note">' + (w.left > 0 ? "Plus de Ball dans ton sac : joue à un mode pour en gagner." : "6 rencontres par jour : reviens demain pour de nouveaux Pokémon.") + '</p>';
  scene.innerHTML = wildHead(state) + '<div class="wild-end">' + body + next +
    '<button type="button" class="btn-ghost" data-action="wildOpenAlbum">📒 Voir mon album</button></div>';
}
function wildOpenAlbum() {
  closeWildGrass();
  if (typeof openAlbumBinder === "function") openAlbumBinder(); else if (typeof openDiscoveryAlbum === "function") openDiscoveryAlbum();
}

function openWildGrass() {
  if (wildBusy) return;
  wildBusy = true;
  const scene = wildScene();
  scene.innerHTML = wildHead(typeof ballState !== "undefined" ? ballState : null) + '<div class="wild-end"><div class="wild-gotcha is-empty"><h3>Les herbes bougent…</h3></div></div>';
  (wildCaptures ? Promise.resolve() : loadWildCaptures()).then(() => wildPost("/api/wild/encounter")).then((data) => {
    if (data && data.ok) {
      if (typeof ballApply === "function") ballApply(data, { announce: false });
      renderWildEncounter(data);
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

// La Ball part, le Pokémon y entre, elle tremble 0 à 3 fois, puis le résultat. « Passer » saute l'animation.
function wildAnimate(scene, ball, shakes, caught) {
  const stage = scene.querySelector(".wild-stage");
  const ballEl = scene.querySelector(".wild-ball");
  if (!stage || !ballEl || wildReducedMotion()) return Promise.resolve();
  ballEl.innerHTML = ballImg(ball, 44);
  const panel = scene.querySelector(".wild-panel");
  if (panel) panel.insertAdjacentHTML("beforeend", '<button type="button" class="wild-skip" data-action="wildSkipAnimation">Passer ›</button>');
  return new Promise((resolve) => {
    const timers = [];
    const done = () => { timers.forEach(clearTimeout); wildSkipAnim = null; resolve(); };
    wildSkipAnim = done;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    stage.classList.add("is-throw");
    at(450, () => stage.classList.add("is-in"));
    let t = 900;
    for (let i = 0; i < shakes; i++) { at(t, () => { ballEl.classList.remove("is-shake"); void ballEl.offsetWidth; ballEl.classList.add("is-shake"); }); t += 650; }
    at(t, () => stage.classList.add(caught ? "is-caught" : "is-out"));
    at(t + (caught ? 700 : 500), done);
  });
}
function wildSkipAnimation() { if (wildSkipAnim) wildSkipAnim(); }
function wildThrow(ball) {
  if (wildBusy) return;
  wildBusy = true;
  const scene = document.getElementById("wild-scene");
  scene?.querySelectorAll(".wild-ball-btn,.wild-run").forEach((b) => { b.disabled = true; });
  const before = typeof ballState !== "undefined" && ballState && ballState.wild && ballState.wild.open;
  wildPost("/api/wild/throw", { ball }).then((data) => {
    if (!data || !data.ok) {
      wildBusy = false;
      if (typeof showToast === "function") showToast(data && data.error === "no_ball_left" ? "Plus de " + BALL_KINDS[ball].name + " dans ton sac." : "Le lancer n’a pas pu partir. Réessaie.");
      if (scene) scene.querySelectorAll(".wild-ball-btn,.wild-run").forEach((b) => { b.disabled = false; });
      return;
    }
    const r = data.result, e = data.encounter;
    return wildAnimate(scene, ball, r.shakes, r.caught).then(() => {
      if (typeof ballApply === "function") ballApply(data, { announce: false });
      if (r.caught) {
        const p = wildPokemon(e.pokemonId);
        const known = typeof playerProfile !== "undefined" && playerProfile && playerProfile.discoveries || {};
        const isNew = Boolean(p && !known[p.id]);
        // « Gotcha ! » d'abord ; la fiche « Nouvelle entrée » du Pokédex arrive juste après.
        const register = () => {
          if (p && typeof recordPokemonDiscovery === "function") recordPokemonDiscovery(p, "capture");
          const rec = p && typeof playerProfile !== "undefined" && playerProfile && playerProfile.discoveries && playerProfile.discoveries[p.id];
          if (rec && e.shiny && !rec.shiny) { rec.shiny = "capture"; if (typeof saveProfile === "function") saveProfile(); }
          if (typeof albumClaimMedals === "function") albumClaimMedals(false);
        };
        if (isNew && !wildReducedMotion()) setTimeout(register, 1800); else register();
        wildCaptures ||= {};
        const c = wildCaptures[e.pokemonId] ||= { normal: 0, shiny: 0 };
        c[e.shiny ? "shiny" : "normal"] += 1;
        renderWildEnd(data, { caught: true, pokemonId: e.pokemonId, shiny: e.shiny, isNew });
      } else if (r.fled) {
        renderWildEnd(data, { fled: true, pokemonId: e.pokemonId });
      } else {
        const p = wildPokemon(e.pokemonId);
        renderWildEncounter({ ...data, encounter: e }, (r.shakes ? "Raté ! La Ball a tremblé " + r.shakes + " fois. " : "Raté ! ") + "Plus que " + e.throwsLeft + " lancer" + (e.throwsLeft > 1 ? "s" : "") + " avant que " + escapeHtml(p ? p.name : "il") + " s’enfuie.");
      }
      wildBusy = false;
    });
  }).catch(() => { wildBusy = false; });
  return before;
}
function wildRun() {
  if (wildBusy) return;
  wildBusy = true;
  wildPost("/api/wild/skip").then((data) => {
    if (data && data.ok) { if (typeof ballApply === "function") ballApply(data, { announce: false }); renderWildEnd(data, null); }
    else closeWildGrass();
  }).finally(() => { wildBusy = false; });
}
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && document.getElementById("wild-scene") && !wildBusy) closeWildGrass(); });

// L'album : chaque case dit d'où vient le Pokémon : 🔍 deviné, ⚪ capturé (× doublons), ✨ shiny.
if (typeof albumSlotHtml === "function") {
  const albumSlotHtmlBeforeWild = albumSlotHtml;
  albumSlotHtml = function (p) {
    const html = albumSlotHtmlBeforeWild(p);
    const entry = typeof albumDiscoveries === "function" ? albumDiscoveries()[p.id] : null;
    if (!entry) return html;
    const c = wildCaptures && wildCaptures[p.id];
    const count = c ? c.normal + c.shiny : 0;
    const mark = entry.shiny ? "" : count ? '<span class="alb-origin is-caught" title="Capturé">⚪' + (count > 1 ? "×" + count : "") + '</span>' : '<span class="alb-origin" title="Deviné">🔍</span>';
    return mark ? html.replace('<span class="alb-num">', mark + '<span class="alb-num">') : html;
  };
}
if (typeof openAlbumBinder === "function") {
  const openAlbumBinderBeforeWild = openAlbumBinder;
  openAlbumBinder = function () {
    const out = openAlbumBinderBeforeWild.apply(this, arguments);
    if (!wildCaptures) loadWildCaptures().then(() => { if (typeof albumRender === "function" && document.querySelector(".alb-slot")) albumRender(); });
    return out;
  };
  openDiscoveryAlbum = function () { openAlbumBinder(); };
}
window.openWildGrass = openWildGrass;
window.closeWildGrass = closeWildGrass;
window.wildThrow = wildThrow;
window.wildRun = wildRun;
window.wildSkipAnimation = wildSkipAnimation;
window.wildOpenAlbum = wildOpenAlbum;
window.openAlbumBinder = openAlbumBinder;
