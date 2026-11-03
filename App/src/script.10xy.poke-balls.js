
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
  "mode:typecombo": "Combo de types", "mode:shiny": "Shiny ou normal",
  streak: "🔥 Série de 7 jours", party: "🎉 Party Room"
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
  return fetch(url, options).then((r) => r.json().catch(() => null)).catch(() => null);
}
// Chaque réponse du serveur dit ce qui vient d'être gagné : on l'annonce, puis on redessine.
function ballApply(data, { announce = true } = {}) {
  if (!data || !data.ok) return ballState;
  ballState = data;
  if (announce && Array.isArray(data.added) && data.added.length) {
    const added = data.added;
    const welcome = added.filter((g) => String(g.source).startsWith("welcome:")).length;
    const streak = added.some((g) => g.source === "streak");
    const rest = added.filter((g) => !String(g.source).startsWith("welcome:") && g.source !== "streak");
    const great = rest.filter((g) => g.ball === "great").length, poke = rest.length - great;
    const parts = [great ? "+" + great + " Super Ball" + (great > 1 ? "s" : "") : "", poke ? "+" + poke + " Poké Ball" + (poke > 1 ? "s" : "") : ""].filter(Boolean);
    const lines = [];
    if (parts.length) lines.push(parts.join(" · ") + " · " + data.today + "/" + data.cap + " aujourd’hui");
    if (streak) lines.push("🔥 Série de " + ((data.streak && data.streak.days) || 7) + " jours : +1 Hyper Ball !");
    if (welcome) lines.push("🎁 " + welcome + " Balls offertes pour ton compte !");
    if (typeof showToast === "function") lines.forEach((line, i) => setTimeout(() => showToast(line), i * 2600));
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
        '<li>' + ballImg("poke", 20) + '<span>Ta <b>1re partie du jour en Party Room</b></span></li>' +
        '<li>' + ballImg("ultra", 20) + '<span>Une <b>Hyper Ball</b> tous les <b>7 jours joués d’affilée</b></span></li>' +
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
    if ((!data || !data.ok) && typeof showToast === "function") showToast("Le cadeau n’a pas pu s’ouvrir. Réessaie dans un instant.");
  }).finally(() => { if (button) button.disabled = false; });
}

// « Ta journée » (maquette validée le 3/11) : une seule carte pour les Balls du jour, les hautes herbes,
// le cadeau, l'Œuf mystère et la Ligue. Sur PC, à côté du Pokémon du jour tant que l'enquête n'a pas commencé ;
// sinon (et sur téléphone) juste dessous. Les anciennes cartes de l'Œuf et de la Ligue sont cachées.
const HOME_DAY_SUGGEST = [["daily", "Pokémon du jour", "+1"], ["party", "une partie en Party Room", "+1 et 150 ₽"], ["journey", "Parcours 4/4", "Super"], ["mode:higherlower", "Higher or Lower", "+1"], ["mode:quiz", "Quiz", "+1"], ["mode:pixel", "Pixelisé", "+1"], ["mode:shiny", "Shiny ou normal", "+1"]];
let homeDayEgg = null, homeDayEggAt = 0;
function homeDayLoadEgg() {
  if (typeof eggRequest !== "function" || Date.now() - homeDayEggAt < 300000) return;
  homeDayEggAt = Date.now();
  eggRequest("/api/egg").then((data) => { homeDayEgg = data; renderBallHomeCard(); }).catch(() => {});
}
function homeDayEggTile() {
  const e = homeDayEgg || (typeof eggState !== "undefined" ? eggState : null);
  const clues = e && Array.isArray(e.clues) ? e.clues.filter((c) => c.unlockedAt) : [];
  const last = clues[clues.length - 1];
  const line = e && e.solved ? "Trouvé cette semaine ✓" : last ? "Indice : " + escapeHtml(last.label) + " · " + escapeHtml(String(last.display ?? last.value)) : "Un mystère pour la semaine";
  return '<button type="button" class="day-tile t-egg" data-action="openEggGame"><b>🥚 Œuf mystère</b><small>' + line + '</small><span class="go">Deviner →</span></button>';
}
function homeDayLeagueTile() {
  let st = null;
  try { st = typeof weeklyLeagueState === "function" ? weeklyLeagueState() : null; } catch (_e) { st = null; }
  if (!st) return '<button type="button" class="day-tile t-league" data-action="openWeeklyLeague"><b>🏅 Ligue</b><small>Les épreuves de la semaine</small><span class="go">Voir →</span></button>';
  const left = typeof weeklyLeagueTimeLeft === "function" ? weeklyLeagueTimeLeft() : "";
  const ready = st.mastered && !st.claimed;
  return '<button type="button" class="day-tile t-league" data-action="openWeeklyLeague"><b>🏅 Ligue</b><small>' + (ready ? "Badge prêt à récupérer !" : st.completed + "/3 épreuves" + (left ? " · " + escapeHtml(left) : "")) + '</small>' +
    '<span class="day-bar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round((Number(st.score) || 0) / 6)) + '%"></i></span><span class="go">' + (ready ? "Récupérer →" : "Voir →") + '</span></button>';
}
// « à 16 h », « à minuit » : l'heure de la prochaine vague de rencontres, heure de Paris.
function wildNextLabel(w) {
  if (!w || !w.nextAt) return "";
  try {
    // formatToParts : en français, l'heure seule s'écrit « 16 h » (Number("16 h") donnait « NaN h »).
    const part = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(w.nextAt)).find((x) => x.type === "hour");
    const h = Number(part && part.value);
    if (!Number.isInteger(h)) return "";
    return h === 0 ? "à minuit" : "à " + h + "\u00a0h"; // espace insécable : « 20 h » ne se coupe pas en fin de ligne
  } catch (_e) { return ""; }
}
function homeDayGrassTile(s) {
  const w = s.wild || { left: 4, max: 24 }, left = ballGrassLeft(s), balls = ballTotal(s);
  const later = w.nextAt ? "+" + (w.nextCount || 4) + " " + wildNextLabel(w) : "";
  const line = !balls ? "Gagne une Ball pour y entrer" : left <= 0 ? (later ? "🕐 " + later : "Plus de rencontre aujourd’hui") : w.open ? "Un Pokémon t’attend !" : left + " rencontre" + (left > 1 ? "s" : "") + (later ? " · " + later : " · un Pokémon rôde");
  const action = balls && left > 0 ? "openWildGrass" : "openBallBag";
  return '<button type="button" class="day-tile t-grass" data-action="' + action + '"><b>🌿 Hautes herbes</b><small>' + line + '</small><span class="go">' + (balls && left > 0 ? "Capturer →" : "Mon sac →") + '</span></button>';
}
function homeDayBagTile(s) {
  return s.giftAvailable
    ? '<button type="button" class="day-tile t-gift" data-action="claimBallGift"><b>🎁 Cadeau</b><small>+1 Poké Ball à ouvrir</small><span class="go">Ouvrir →</span>' + ballImg("poke", 34) + '</button>'
    : '<button type="button" class="day-tile t-bag" data-action="openBallBag"><b>🎒 Mon sac</b><small>' + ballTotal(s) + ' Ball' + (ballTotal(s) > 1 ? "s" : "") + (s.wild && s.wild.caught ? " · " + s.wild.caught + " attrapé" + (s.wild.caught > 1 ? "s" : "") : "") + '</small><span class="go">Voir →</span></button>';
}
function homeDayBallsRow(s) {
  const gains = s.gains || [];
  return '<div class="day-balls" role="img" aria-label="' + s.today + ' Balls gagnées sur ' + s.cap + ' aujourd’hui">' +
    Array.from({ length: s.cap }, (_, i) => gains[i] ? ballImg(gains[i].ball, 24) : '<i></i>').join("") + '</div>';
}
// Ce qui fait revenir : quand tout se recharge, et la série qui mène à l'Hyper Ball.
function homeDayCountdown(resetAt) {
  const ms = Math.max(0, Date.parse(resetAt) - Date.now());
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h ? h + " h " + String(m).padStart(2, "0") : m + " min";
}
function homeDayResetHtml(s) {
  if (!s.resetAt) return "";
  return '<p class="day-reset">⏳ Nouvelles Balls et 6 rencontres dans <b data-reset-at="' + escapeHtml(s.resetAt) + '">' + homeDayCountdown(s.resetAt) + '</b></p>';
}
function homeDayStreakHtml(s) {
  const st = s.streak;
  if (!st) return "";
  const every = st.every || 7, done = Math.min(every, st.inCycle || 0);
  const names = ["J1", "J2", "J3", "J4", "J5", "J6"];
  const boxes = Array.from({ length: every }, (_, i) => i === every - 1
    ? '<span class="goal' + (done >= every ? " on" : "") + '">' + ballImg("ultra", 20) + '</span>'
    : '<span class="' + (i < done ? "on" : "") + '">' + names[i] + '</span>').join("");
  const line = done >= every && st.playedToday ? "🔥 Série de " + st.days + " jours : Hyper Ball gagnée aujourd’hui !"
    : st.days ? "🔥 Série de " + st.days + " jour" + (st.days > 1 ? "s" : "") + (st.playedToday ? "" : " · joue aujourd’hui pour la garder") + " · encore " + st.left + " pour une Hyper Ball"
    : "🔥 Joue un jour de suite après l’autre : au 7e, une Hyper Ball";
  return '<div class="day-streak"><b>' + escapeHtml(line) + '</b><div class="day-streak-days">' + boxes + '</div></div>';
}
setInterval(() => {
  if (document.hidden) return;
  document.querySelectorAll("[data-reset-at]").forEach((el) => {
    const at = el.getAttribute("data-reset-at");
    if (Date.parse(at) <= Date.now()) { if (typeof refreshBalls === "function") refreshBalls(); return; }
    el.textContent = homeDayCountdown(at);
  });
}, 30000);
function renderBallHomeCard() {
  const hero = document.getElementById("daily-hero");
  if (!hero || !ballState) return;
  let card = document.getElementById("home-balls");
  if (!card) {
    card = document.createElement("section");
    card.id = "home-balls"; card.className = "home-balls home-day"; card.setAttribute("aria-label", "Ta journée");
  }
  // À côté du Pokémon du jour (dans le bloc du haut) quand la grille d'enquête est vide, sinon juste dessous.
  const notebook = document.getElementById("daily-notebook");
  const inside = !notebook || notebook.dataset.progress === "empty" || notebook.classList.contains("hidden") || notebook.hidden;
  hero.classList.toggle("has-day", inside);
  if (inside) { if (card.parentElement !== hero) hero.appendChild(card); }
  else if (hero.nextElementSibling !== card) hero.insertAdjacentElement("afterend", card);
  document.getElementById("screen-config")?.classList.add("has-home-day");
  const s = ballState, full = s.today >= s.cap;
  const got = new Set((s.gains || []).map((g) => g.source));
  const todo = HOME_DAY_SUGGEST.filter(([src]) => !got.has(src)).slice(0, 3).map(([, label, gain]) => label + " " + gain);
  card.innerHTML = '<div class="day-head"><h2>Ta journée</h2><span>' + s.today + ' / ' + s.cap + ' Balls</span></div>' + homeDayBallsRow(s) +
    '<p class="day-hint">' + (full ? "Sac plein pour aujourd’hui 🎉 Reviens demain." : todo.length ? "Encore : " + escapeHtml(todo.join(" · ")) : "1 Ball par mode joué aujourd’hui.") + '</p>' +
    homeDayResetHtml(s) + homeDayStreakHtml(s) +
    '<div class="day-tiles">' + homeDayGrassTile(s) + homeDayBagTile(s) + homeDayEggTile() + homeDayLeagueTile() + '</div>';
  homeDayLoadEgg();
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
// 🎉 Party Room (3/11) : la 1re partie de salon finie du jour (2 joueurs au moins) rapporte 1 Poké Ball et 150 ₽.
// Le serveur ne la paie qu'une fois par jour.
let ballPartyPaid = "";
if (typeof renderPartyRoom === "function") {
  const renderPartyRoomBeforeBalls = renderPartyRoom;
  renderPartyRoom = function () {
    const out = renderPartyRoomBeforeBalls.apply(this, arguments);
    try {
      const room = typeof partyRoomState !== "undefined" && partyRoomState ? partyRoomState.room : null;
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
      if (room && room.status === "complete" && (room.players || []).length >= 2 && ballPartyPaid !== today) {
        ballPartyPaid = today;
        ballFetch("/api/balls/earn", { mode: "party" }).then((data) => ballApply(data));
      }
    } catch (_e) {}
    return out;
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

// Retry an uncertain paid operation using its original id, including after a reload.
function ballPaidAction(url, payload) {
  const scope = ballState && ballState.actionScope;
  if (!scope) return Promise.resolve({ ok: false, error: "reload_required" });
  const key = "pokdle_paid_action:" + scope + ":" + url;
  let pending;
  try { pending = JSON.parse(sessionStorage.getItem(key) || "null"); } catch (_) {}
  if (pending && (typeof pending.fingerprint !== "string" || !pending.body || typeof pending.body.actionId !== "string")) return Promise.resolve({ ok: false, error: "storage_unavailable" });
  const fingerprint = JSON.stringify(payload);
  const recovering = pending && pending.fingerprint !== fingerprint;
  if (!pending) {
    pending = { fingerprint, body: { ...payload, actionScope: scope, actionId: crypto.randomUUID() } };
    try { sessionStorage.setItem(key, JSON.stringify(pending)); } catch (_) {
      return Promise.resolve({ ok: false, error: "storage_unavailable" });
    }
  }
  return ballFetch(url, pending.body).then((data) => {
    if (data && (data.ok || ["price_changed", "encounter_changed", "no_ball_left", "no_encounter", "not_enough_coins", "recharge_limit", "reload_required", "action_conflict", "account_changed"].includes(data.error))) {
      try { sessionStorage.removeItem(key); } catch (_) {}
    }
    if (!ballState || ballState.actionScope !== scope) return { ok: false, error: "account_changed" };
    if (recovering) {
      if (data && data.ok) ballApply(data, { announce: false });
      refreshBalls({ announce: false });
      return { ok: false, error: "previous_action" };
    }
    return data;
  });
}
