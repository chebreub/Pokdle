
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
// Le décor : ciel, nuages, collines, plateforme et trois rangées de brins (SVG fait ici, sans image).
function wildBlades(seed, count, height, colors) {
  let x = seed * 7, out = "";
  const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  for (let i = 0; i < count; i++) {
    const cx = (i + rnd() * 0.8) * (400 / count), h = height * (0.55 + rnd() * 0.45), w = 5 + rnd() * 5, bend = (rnd() - 0.5) * 14;
    out += '<path d="M' + (cx - w).toFixed(1) + ' 100 Q' + (cx + bend * 0.4).toFixed(1) + ' ' + (100 - h * 0.6).toFixed(1) + ' ' + (cx + bend).toFixed(1) + ' ' + (100 - h).toFixed(1) +
      ' Q' + (cx + bend * 0.2 + w * 0.3).toFixed(1) + ' ' + (100 - h * 0.5).toFixed(1) + ' ' + (cx + w).toFixed(1) + ' 100Z" fill="' + colors[i % colors.length] + '"/>';
  }
  return '<svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">' + out + '</svg>';
}
function wildBackdropHtml() {
  return '<div class="wild-sky" aria-hidden="true"><i style="left:12%;top:16%;width:70px"></i><i style="left:64%;top:9%;width:54px;animation-duration:80s"></i><i style="left:88%;top:26%;width:46px;animation-duration:70s"></i></div>' +
    '<div class="wild-hills" aria-hidden="true"><svg viewBox="0 0 400 100" preserveAspectRatio="none"><path d="M0 38 Q60 12 130 30 T260 26 T400 34 V100 H0Z" fill="#B4DE9A"/><path d="M0 56 Q90 36 190 52 T400 48 V100 H0Z" fill="#9CD283"/><rect y="64" width="400" height="36" fill="#8DC874"/></svg></div>' +
    '<div class="wild-pad" aria-hidden="true"></div>' +
    '<div class="wild-grass-back" aria-hidden="true">' + wildBlades(3, 46, 90, ["#5DB36A", "#4FA45E", "#6CC077"]) + '</div>';
}
function wildFrontGrassHtml() {
  return '<div class="wild-grass-front" aria-hidden="true">' + wildBlades(11, 38, 100, ["#3E9B57", "#2F8A4A", "#48A862"]) + '</div>';
}
function wildSparklesHtml() {
  return '<div class="wild-sparkles" aria-hidden="true">' + [[30, 22, 0], [70, 18, .5], [24, 52, .9], [76, 46, .3], [52, 10, 1.2]]
    .map(([l, t, d]) => '<b style="left:' + l + '%;top:' + t + '%;animation-delay:' + d + 's">✦</b>').join("") + '</div>';
}
// Des sons doux, faits par le navigateur (réglages « Effets sonores » et « Volume » du site).
function wildSfx(kind) {
  if (typeof getPokedexFxAudioContext !== "function" || typeof pokedexFxTone !== "function") return;
  const ctx = getPokedexFxAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01, v = typeof appSoundVolume === "function" ? appSoundVolume() : 1;
  const notes = {
    throw: [[520, 0, .06, .012, "sine"], [420, .05, .07, .01, "sine"], [330, .1, .08, .008, "sine"]],
    absorb: [[880, 0, .08, .018, "sine"], [1320, .05, .1, .014, "sine"]],
    land: [[150, 0, .07, .03, "triangle"]],
    tick: [[240, 0, .05, .028, "triangle"], [200, .06, .05, .02, "triangle"]],
    click: [[1100, 0, .035, .02, "square"], [523.3, .12, .1, .026, "triangle"], [659.3, .22, .1, .026, "triangle"], [784, .32, .2, .03, "sine"]],
    free: [[600, 0, .05, .02, "sine"], [300, .05, .1, .018, "triangle"]]
  }[kind] || [];
  for (const [f, o, d, g, type] of notes) pokedexFxTone(ctx, f, t + o, d, g * v, type);
}
function renderWildEncounter(state, message, intro) {
  const e = state.encounter || state.wild && state.wild.open;
  const p = e && wildPokemon(e.pokemonId);
  if (!e || !p) return renderWildEnd(state, null);
  const scene = wildScene();
  const name = escapeHtml(p.name);
  scene.innerHTML = wildHead(state) +
    '<div class="wild-stage' + (e.shiny ? " is-shiny" : "") + (intro && !wildReducedMotion() ? " is-intro" : "") + '">' +
      wildBackdropHtml() +
      '<img class="wild-mon" src="' + escapeHtml(wildArtwork(p, e.shiny)) + '" data-fallback="' + escapeHtml(getPokemonSprite(p)) + '" alt="' + name + (e.shiny ? " shiny" : "") + '" draggable="false">' +
      (e.shiny ? wildSparklesHtml() : "") +
      '<div class="wild-ball" aria-hidden="true"><div class="wild-ball-arc"><div class="wild-ball-sh">' + ballImg("poke", 48) + '</div></div></div>' +
      '<div class="wild-flash" aria-hidden="true"></div><div class="wild-stars" aria-hidden="true"></div>' +
      wildFrontGrassHtml() +
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
      '<p>' + (outcome.isNew ? "Il rejoint ton album." : "Un doublon de plus dans ta collection.") + (outcome.shiny ? " Il brille dans ton carnet shiny ✨" : "") + '</p></div>';
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
    '<button type="button" class="btn-ghost" data-action="' + (outcome && outcome.shiny ? "wildOpenShinyLog" : "wildOpenAlbum") + '">' + (outcome && outcome.shiny ? "✨ Voir mon carnet shiny" : "📒 Voir mon album") + '</button></div>';
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

// La Ball part en cloche, flash, le Pokémon entre dedans, elle tombe sur la plateforme, tremble 0 à 3 fois,
// puis « clic » et étoiles, ou le Pokémon ressort. « Passer » saute l'animation ; rien si « réduire les animations ».
function wildAnimate(scene, ball, shakes, caught) {
  const stage = scene.querySelector(".wild-stage");
  const ballEl = scene.querySelector(".wild-ball"), mon = scene.querySelector(".wild-mon");
  if (!stage || !ballEl || !mon || wildReducedMotion()) return Promise.resolve();
  const sh = ballEl.querySelector(".wild-ball-sh");
  sh.innerHTML = ballImg(ball, 48);
  const sr = stage.getBoundingClientRect(), mr = mon.getBoundingClientRect();
  const hy = Math.max(60, mr.top - sr.top + mr.height * 0.45), ground = sr.height * 0.8 - 18;
  stage.style.setProperty("--hy", hy + "px");
  stage.style.setProperty("--sx", Math.round(sr.width * 0.36) + "px");
  stage.style.setProperty("--sy", Math.round(sr.height - hy + 40) + "px");
  stage.style.setProperty("--peak", -Math.round(Math.min(90, hy * 0.5)) + "px");
  stage.style.setProperty("--gy", Math.round(ground - hy) + "px");
  stage.style.setProperty("--gyabs", Math.round(ground) + "px");
  stage.classList.remove("is-intro");
  const flash = stage.querySelector(".wild-flash");
  const flashAt = (y) => { stage.style.setProperty("--fy", Math.round(y) + "px"); flash.classList.remove("is-on"); void flash.offsetWidth; flash.classList.add("is-on"); };
  const panel = scene.querySelector(".wild-panel");
  if (panel) panel.insertAdjacentHTML("beforeend", '<button type="button" class="wild-skip" data-action="wildSkipAnimation">Passer ›</button>');
  return new Promise((resolve) => {
    const timers = [];
    const done = () => { timers.forEach(clearTimeout); wildSkipAnim = null; resolve(); };
    wildSkipAnim = done;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    stage.classList.add("is-throw"); wildSfx("throw");
    at(620, () => { flashAt(hy); stage.classList.add("is-absorb"); wildSfx("absorb"); });
    at(1000, () => { stage.classList.remove("is-throw"); stage.classList.add("is-drop"); });
    at(1310, () => wildSfx("land"));
    let t = 1650;
    for (let i = 0; i < shakes; i++) { at(t, () => { sh.classList.remove("is-shake"); void sh.offsetWidth; sh.classList.add("is-shake"); wildSfx("tick"); }); t += 950; }
    if (caught) {
      at(t, () => {
        stage.classList.add("is-caught"); wildSfx("click");
        const stars = stage.querySelector(".wild-stars");
        stars.innerHTML = [[-70, -40], [0, -78], [70, -40], [-46, -66], [46, -66]].map(([dx, dy], i) => '<i style="--dx:' + dx + 'px;--dy:' + dy + 'px;animation-delay:' + (i * 0.04) + 's">★</i>').join("");
      });
      at(t + 1000, done);
    } else {
      at(t + 100, () => { flashAt(ground); stage.classList.add("is-free"); stage.classList.remove("is-absorb"); wildSfx("free"); });
      at(t + 750, done);
    }
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
function wildOpenShinyLog() { closeWildGrass(); if (typeof openShinyLog === "function") openShinyLog(); }
window.wildOpenShinyLog = wildOpenShinyLog;
window.openAlbumBinder = openAlbumBinder;
