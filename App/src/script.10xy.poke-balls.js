
// ===== Les Balls (PR A de la boucle « jouer → Balls → attraper », 3/11/2026) =====
// Le serveur (lib/poke-balls.js) compte tout : une Ball par jeu et par jour, 10 par jour au plus,
// le cadeau du jour 🎁. Ici on montre le sac, le cadeau et le « +1 Ball » de fin de partie.
const BALL_SPRITE = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/";
const BALL_KINDS = Object.freeze({
  poke: { name: "Poké Ball", file: "poke-ball.png" },
  great: { name: "Super Ball", file: "great-ball.png" },
  ultra: { name: "Hyper Ball", file: "ultra-ball.png" }
});
const BALL_SOURCES = Object.freeze({
  gift: "🎁 Cadeau du jour", daily: "Pokémon du jour", wordle: "Wordle du jour", dossier: "Dossier du jour",
  challenge: "Défi du jour", journey: "Parcours du jour 4/4",
  "mode:normal": "Mode classique", "mode:silhouette": "Zoom", "mode:pixel": "Pixelisé", "mode:mystery": "Stat Mystère",
  "mode:cry": "Cri", "mode:quiz": "Quiz", "mode:description": "Description", "mode:weight": "Duel de poids",
  "mode:evolution": "Évolutions", "mode:order": "Ordre", "mode:odd": "Intrus", "mode:quiestce": "Qui est-ce ?",
  "mode:petitbac": "Petit Bac", "mode:higherlower": "Higher or Lower", "mode:connections": "Connexions",
  "mode:speedrun": "Speedrun", "mode:statauction": "Enchères de stats", "mode:statclash": "Stat Clash",
  "mode:typecombo": "Combo de types", "mode:shiny": "Shiny ou normal"
});
// Les modes de fin de partie que le serveur accepte (les jeux du jour sont vérifiés par lui).
const BALL_ARCADE_MODES = new Set(["normal","silhouette","pixel","mystery","cry","quiz","description","weight","evolution","order","odd","quiestce","petitbac","higher-lower","higher-lower-rush","poke-connections","speedrun","stat-auction","stat-clash","typecombo","shiny"]);
let ballState = null;
let ballRequest = null;

function ballImg(kind, size = 28) {
  const k = BALL_KINDS[kind] || BALL_KINDS.poke;
  return '<img class="ball-img" src="' + BALL_SPRITE + k.file + '" alt="" width="' + size + '" height="' + size + '" loading="lazy" decoding="async">';
}
function ballTotal(state) {
  const bag = state && state.bag || {};
  return (Number(bag.poke) || 0) + (Number(bag.great) || 0) + (Number(bag.ultra) || 0);
}
function ballFetch(url, body) {
  const options = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" } : { credentials: "same-origin" };
  return fetch(url, options).then((r) => r.ok ? r.json() : null).catch(() => null);
}
// Chaque réponse du serveur dit ce qui vient d'être gagné : on l'annonce, puis on redessine.
function ballApply(data, { announce = true } = {}) {
  if (!data || !data.ok) return ballState;
  ballState = data;
  if (announce && Array.isArray(data.added) && data.added.length) {
    const great = data.added.filter((g) => g.ball === "great").length, poke = data.added.length - great;
    const parts = [great ? "+" + great + " Super Ball" + (great > 1 ? "s" : "") : "", poke ? "+" + poke + " Poké Ball" + (poke > 1 ? "s" : "") : ""].filter(Boolean);
    if (typeof showToast === "function") showToast(parts.join(" · ") + " · " + data.today + "/" + data.cap + " aujourd’hui");
  }
  renderBallHeader();
  renderBallHomeCard();
  return data;
}
function refreshBalls(options) {
  if (ballRequest) return ballRequest;
  ballRequest = ballFetch("/api/balls").then((data) => ballApply(data, options)).finally(() => { ballRequest = null; });
  return ballRequest;
}

function renderBallHeader() {
  const actions = document.querySelector("header .header-actions");
  if (!actions) return;
  let btn = document.getElementById("ball-bag-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "ball-bag-btn"; btn.type = "button"; btn.className = "ball-bag-btn";
    btn.setAttribute("data-action", "openBallBag");
    actions.insertBefore(btn, actions.firstChild);
  }
  const total = ballTotal(ballState), gift = Boolean(ballState && ballState.giftAvailable);
  btn.classList.toggle("has-gift", gift);
  btn.setAttribute("aria-label", "Mon sac : " + total + " Ball" + (total > 1 ? "s" : "") + (gift ? ", cadeau du jour à ouvrir" : ""));
  // Poké Balls et Super Balls séparées (🔴 4 · 🔵 1), comme sur la maquette du 2/11 ; l'Hyper Ball seulement si on en a.
  const bag = ballState && ballState.bag || {};
  const kinds = ["poke", "great", "ultra"].filter((k) => k !== "ultra" || Number(bag.ultra) > 0);
  btn.innerHTML = kinds.map((k) => ballImg(k, 22) + '<b>' + (Number(bag[k]) || 0) + '</b>').join('<span class="ball-sep" aria-hidden="true"></span>') +
    (gift ? '<span class="ball-gift-dot" aria-hidden="true">🎁</span>' : "");
}

function ballGainsHtml(state) {
  const gains = state && state.gains || [];
  if (!gains.length) return '<p class="ball-empty">Pas encore de Ball aujourd’hui. Ouvre ton cadeau ou joue à un mode pour gagner la première.</p>';
  return '<ul class="ball-gains">' + gains.map((g) => '<li>' + ballImg(g.ball, 22) + '<span>' + escapeHtml(BALL_SOURCES[g.source] || "Partie") + '</span><b>' + escapeHtml((BALL_KINDS[g.ball] || BALL_KINDS.poke).name) + '</b></li>').join("") + '</ul>';
}
function ballMeterHtml(state) {
  const today = Number(state && state.today) || 0, cap = Number(state && state.cap) || 10;
  return '<div class="ball-meter" role="img" aria-label="' + today + ' Balls gagnées sur ' + cap + ' aujourd’hui">' +
    Array.from({ length: cap }, (_, i) => '<span class="' + (i < today ? "is-on" : "") + '"></span>').join("") + '</div>';
}
// Les hautes herbes : 6 rencontres par jour pour lancer ses Balls (script.10xz.wild-grass.js).
function ballGrassLeft(s) { const w = s && s.wild; return w ? (w.open ? Math.max(1, w.left) : w.left) : 6; }
function ballGrassHtml(s) {
  const w = s && s.wild || { left: 6, max: 6, caught: 0 }, left = ballGrassLeft(s);
  return '<section class="ball-soon"><span aria-hidden="true">🌿</span><p><b>Les hautes herbes</b> · ' + (w.open ? "un Pokémon t’attend !" : left + " rencontre" + (left > 1 ? "s" : "") + " sur " + w.max + " aujourd’hui") +
    (w.caught ? '<br><small>' + w.caught + ' Pokémon attrapé' + (w.caught > 1 ? "s" : "") + '</small>' : "") + '</p>' +
    (left > 0 ? '<button type="button" class="ball-grass-cta" data-action="ballGoGrass">' + (w.open ? "Y retourner" : "Y aller") + '</button>' : "") + '</section>';
}
function ballGoGrass() { if (typeof closeOverlayModal === "function") closeOverlayModal(); if (typeof openWildGrass === "function") openWildGrass(); }
window.ballGoGrass = ballGoGrass;
function openBallBag() {
  const draw = () => {
    const s = ballState || { bag: { poke: 0, great: 0, ultra: 0 }, today: 0, cap: 10, gains: [] };
    const counts = ["poke", "great", "ultra"].filter((k) => k !== "ultra" || Number(s.bag.ultra) > 0)
      .map((k) => '<div class="ball-count">' + ballImg(k, 40) + '<b>' + (Number(s.bag[k]) || 0) + '</b><small>' + BALL_KINDS[k].name + '</small></div>').join("");
    const gift = s.giftAvailable ? '<button type="button" class="ball-gift-cta" data-action="claimBallGift">🎁 Ouvrir mon cadeau du jour <small>+1 Poké Ball</small></button>' : "";
    const guest = s.authenticated ? "" : '<p class="ball-note">Sans compte, tes Balls restent sur cet appareil. Connecte-toi pour les garder partout : elles passent sur ton compte.</p>';
    ensureOverlay("🎒 Mon sac", '<div class="ball-bag">' +
      '<div class="ball-counts">' + counts + '</div>' + gift +
      '<section class="ball-today"><div class="ball-today-head"><h4>Aujourd’hui</h4><span>' + (Number(s.today) || 0) + ' / ' + (Number(s.cap) || 10) + '</span></div>' + ballMeterHtml(s) + ballGainsHtml(s) + '</section>' +
      '<section class="ball-how"><h4>Comment gagner des Balls</h4><ul>' +
        '<li>' + ballImg("poke", 20) + '<span>Ta <b>1re partie du jour</b> de chaque mode</span></li>' +
        '<li>' + ballImg("great", 20) + '<span>Une <b>Super Ball</b> si tu fais une belle partie</span></li>' +
        '<li>' + ballImg("poke", 20) + '<span>Le <b>Pokémon du jour</b> trouvé</span></li>' +
        '<li>' + ballImg("great", 20) + '<span>Le <b>parcours du jour</b> fini (4/4)</span></li>' +
      '</ul><p class="ball-note">10 Balls par jour au plus. Rejouer au même mode ne rapporte plus de Ball ce jour-là.</p></section>' +
      ballGrassHtml(s) +
      guest + '</div>');
  };
  draw();
  refreshBalls().then(() => {
    const overlay = document.getElementById("overlay-modal");
    if (overlay && !overlay.classList.contains("hidden") && document.querySelector("#overlay-body .ball-bag")) draw();
  });
}
function claimBallGift() {
  const button = this && this.tagName === "BUTTON" ? this : null;
  if (button) button.disabled = true;
  return ballFetch("/api/balls/gift", {}).then((data) => {
    ballApply(data);
    if (document.querySelector("#overlay-body .ball-bag")) openBallBag();
    if (!data && typeof showToast === "function") showToast("Le cadeau n’a pas pu s’ouvrir. Réessaie dans un instant.");
  }).finally(() => { if (button) button.disabled = false; });
}

// La carte de l'accueil : les Balls du jour et le cadeau, juste après le Pokémon du jour.
function renderBallHomeCard() {
  const hero = document.getElementById("daily-hero");
  if (!hero || !ballState) return;
  let card = document.getElementById("home-balls");
  if (!card) {
    card = document.createElement("section");
    card.id = "home-balls"; card.className = "home-balls"; card.setAttribute("aria-label", "Mes Balls du jour");
    hero.insertAdjacentElement("afterend", card);
  }
  const s = ballState, full = s.today >= s.cap;
  card.innerHTML = '<div class="home-balls-main"><span class="home-balls-art">' + ballImg(s.today && s.gains.some((g) => g.ball === "great") ? "great" : "poke", 44) + '</span>' +
    '<div><span class="home-balls-eyebrow">TES BALLS DU JOUR</span><b>' + (full ? "Sac plein pour aujourd’hui 🎉" : s.today + " / " + s.cap + " gagnées") + '</b>' + ballMeterHtml(s) +
    '<small>' + (full ? "Reviens demain pour 10 nouvelles Balls." : "1 Ball par mode joué aujourd’hui, une Super Ball pour une belle partie.") + '</small></div></div>' +
    '<div class="home-balls-actions">' + (s.giftAvailable ? '<button type="button" class="ball-gift-cta" data-action="claimBallGift">🎁 Cadeau</button>' : "") +
    (ballGrassLeft(s) > 0 && ballTotal(s) > 0 ? '<button type="button" class="ball-grass-cta" data-action="openWildGrass">🌿 Hautes herbes · ' + ballGrassLeft(s) + '/' + ((s.wild && s.wild.max) || 6) + '</button>' : "") +
    '<button type="button" class="btn-ghost" data-action="openBallBag">🎒 Mon sac · ' + ballTotal(s) + '</button></div>';
}

// Fin de partie : la 1re partie du jour d'un mode rapporte sa Ball. Les jeux du jour passent
// par le serveur ; on relit juste le sac pour annoncer leur Ball.
function ballScoreFromHistory(entry) {
  try {
    const perf = typeof leaderboardResultFromHistory === "function" ? leaderboardResultFromHistory(entry) : null;
    if (perf && Number.isInteger(perf.score)) return perf.score;
  } catch (_e) {}
  return Math.max(0, Math.floor(Number(entry && entry.attempts) || 0));
}
function earnBallsAfterGame(entry) {
  const mode = String(entry && entry.mode || "");
  if (mode === "daily" || mode === "challenge") return refreshBalls();
  if (!BALL_ARCADE_MODES.has(mode) || !["win", "loss"].includes(entry.result)) return Promise.resolve(null);
  // Une partie de la Party Room ne compte pas : elle a ses propres récompenses.
  if (typeof isPartySessionActive === "function" && isPartySessionActive()) return Promise.resolve(null);
  return ballFetch("/api/balls/earn", { mode, result: entry.result, score: ballScoreFromHistory(entry) }).then((data) => ballApply(data));
}
if (typeof recordMatchHistory === "function") {
  const recordMatchHistoryBeforeBalls = recordMatchHistory;
  recordMatchHistory = function (entry) {
    const result = recordMatchHistoryBeforeBalls(entry);
    try { earnBallsAfterGame(matchHistory && matchHistory[0] || entry); } catch (_e) {}
    return result;
  };
}
// Retour à l'accueil : le serveur ajoute les Balls des jeux du jour finis entre-temps.
if (typeof goToConfig === "function") {
  const goToConfigBeforeBalls = goToConfig;
  goToConfig = function () {
    const result = goToConfigBeforeBalls.apply(this, arguments);
    refreshBalls();
    return result;
  };
}
function initBalls() {
  if (location.pathname !== "/" && location.pathname !== "/index.html") return;
  renderBallHeader();
  refreshBalls({ announce: true });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBalls);
else initBalls();
window.openBallBag = openBallBag;
window.claimBallGift = claimBallGift;
window.refreshBalls = refreshBalls;
