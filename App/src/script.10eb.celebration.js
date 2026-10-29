// Level-up card and achievement banner: the two rewards a player should feel. They wait for a
// calm moment (a finished game or a menu) so a game in progress is never covered, close on any
// tap or on their own, and stand still when the system asks for less motion.
const CELEBRATION_CALM_SCREENS = new Set(["screen-config", "screen-all-modes", "screen-profile", "screen-achievements", "screen-history",
  "screen-leaderboard", "screen-ranking", "screen-games-ranking", "screen-pokedex", "screen-egg", "screen-teams", "screen-type-chart"]);
// What a finished round looks like on the game screens that draw their own result.
const CELEBRATION_RESULT_SELECTOR = ".higher-lower-gameover, .grid-result, .challenge-result:not(.hidden), [class*='-gameover'], [class*='final-actions']";
const CELEBRATION_LEVEL_MS = 6500;
const CELEBRATION_ACHIEVEMENT_MS = 3800;
const CELEBRATION_MAX_ACHIEVEMENTS = 3;
const celebrationQueue = [];
// One lane each: the banner (top) can run while the level card (centre) is open.
const celebrationBusy = { level: false, achievement: false };
let celebrationWaitTimer = null;

function celebrationReducedMotion() {
  try { return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches); } catch (_e) { return false; }
}

function celebrationCalm() {
  const game = document.getElementById("screen-game");
  if (game && !game.classList.contains("hidden")) return Boolean(gameOver);
  const open = [...document.querySelectorAll('[id^="screen-"]')].filter((el) => !el.classList.contains("hidden") && el.offsetParent !== null);
  return open.every((el) => CELEBRATION_CALM_SCREENS.has(el.id) || el.querySelector(CELEBRATION_RESULT_SELECTOR));
}

// The next title above a level, for « Prochain titre : Apprenti au niveau 20 ».
function celebrationNextTitle(level) {
  return XP_TITLES.find((t) => t.level > level) || null;
}

function celebrationLevelHtml(from, to) {
  const tier = xpLevelEntry(to);
  const newTitle = xpLevelEntry(from).name !== tier.name;
  const next = celebrationNextTitle(to);
  return `<div class="lvc-rays" aria-hidden="true"></div>
    <p class="lvc-kick">NIVEAU SUPÉRIEUR</p>
    <div class="lvc-ring" aria-hidden="true"><span class="lvc-num"><span class="lvc-old">${from}</span><span class="lvc-new">${to}</span></span></div>
    <h2 class="lvc-title">Niveau ${to} !</h2>
    ${newTitle ? `<p class="lvc-badge">${escapeHtml(tier.emoji)} Nouveau titre : ${escapeHtml(tier.name)}</p>` : ""}
    <p class="lvc-next">${next ? `Prochain titre : ${escapeHtml(next.name)} ${escapeHtml(next.emoji)} au niveau ${next.level}` : "Tu as atteint le dernier titre !"}</p>
    <button type="button" class="lvc-btn">Continuer</button>`;
}

function celebrationAchievementHtml(item) {
  return `<span class="achc-medal" aria-hidden="true">🏆</span><span class="achc-text"><small>SUCCÈS DÉBLOQUÉ</small><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.desc)}</span></span>`;
}

function queueCelebration(item) {
  celebrationQueue.push(item);
  runCelebrations();
}

function runCelebrations() {
  if (!celebrationQueue.length || typeof document === "undefined") return;
  if (!celebrationCalm()) {
    // Check again shortly: the round ends, or the player goes back to a menu.
    clearTimeout(celebrationWaitTimer);
    celebrationWaitTimer = setTimeout(runCelebrations, 1200);
    return;
  }
  for (const lane of ["level", "achievement"]) {
    if (celebrationBusy[lane]) continue;
    const index = celebrationQueue.findIndex((item) => item.kind === lane);
    if (index < 0) continue;
    const [item] = celebrationQueue.splice(index, 1);
    celebrationBusy[lane] = true;
    const done = () => { celebrationBusy[lane] = false; setTimeout(runCelebrations, 250); };
    if (lane === "level") showLevelCelebration(item, done);
    else showAchievementCelebration(item, done);
  }
}

function showLevelCelebration({ from, to }, done) {
  const calm = celebrationReducedMotion();
  const back = document.createElement("div");
  back.className = "lvc-back" + (calm ? " is-still" : "");
  const card = document.createElement("div");
  card.className = "lvc-card" + (calm ? " is-still" : "");
  card.setAttribute("role", "status");
  card.innerHTML = celebrationLevelHtml(from, to);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    back.classList.add("is-leaving"); card.classList.add("is-leaving");
    setTimeout(() => { back.remove(); card.remove(); document.querySelectorAll(".lvc-conf").forEach((c) => c.remove()); done(); }, calm ? 0 : 220);
  };
  const onKey = (event) => { if (event.key === "Escape") close(); };
  // Any tap closes it: the card never stands between the player and what comes next.
  back.addEventListener("click", close);
  card.addEventListener("click", close);
  // Added after this event: the key that sent the winning guess must not close the card.
  setTimeout(() => { if (!closed) document.addEventListener("keydown", onKey); }, 0);
  const timer = setTimeout(close, CELEBRATION_LEVEL_MS);
  document.body.append(back, card);
  if (!calm) setTimeout(() => { if (!closed) celebrationConfetti(); }, 1500);
}

function celebrationConfetti() {
  const colors = ["#FFD45C", "#7C5BD6", "#4069E0", "#5DBE7E", "#FF7A7A"];
  for (let i = 0; i < 40; i += 1) {
    const piece = document.createElement("i");
    const angle = Math.random() * Math.PI * 2, distance = 150 + Math.random() * 210;
    piece.className = "lvc-conf";
    piece.style.cssText = `background:${colors[i % colors.length]};--x:${Math.round(Math.cos(angle) * distance)}px;--y:${Math.round(Math.sin(angle) * distance + 110)}px;--r:${Math.round((Math.random() - 0.5) * 900)}deg;animation-delay:${(Math.random() * 0.15).toFixed(2)}s`;
    piece.addEventListener("animationend", () => piece.remove());
    document.body.appendChild(piece);
  }
}

function showAchievementCelebration(item, done) {
  const banner = document.createElement("div");
  banner.className = "achc" + (celebrationReducedMotion() ? " is-still" : "");
  banner.setAttribute("role", "status");
  banner.innerHTML = celebrationAchievementHtml(item);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    banner.classList.add("is-leaving");
    setTimeout(() => { banner.remove(); done(); }, celebrationReducedMotion() ? 0 : 380);
  };
  banner.addEventListener("click", close);
  const timer = setTimeout(close, CELEBRATION_ACHIEVEMENT_MS);
  document.body.appendChild(banner);
}

function celebrateLevelUp(from, to) {
  if (to > from) queueCelebration({ kind: "level", from, to });
}

// Several unlocked at once: the first ones by name, the rest in one line.
function celebrateAchievements(list) {
  const shown = list.slice(0, CELEBRATION_MAX_ACHIEVEMENTS);
  shown.forEach((a) => queueCelebration({ kind: "achievement", title: a.title, desc: a.desc }));
  const more = list.length - shown.length;
  if (more > 0) queueCelebration({ kind: "achievement", title: `+${more} autre${more > 1 ? "s" : ""} succès`, desc: "Retrouve-les dans tes succès." });
}
