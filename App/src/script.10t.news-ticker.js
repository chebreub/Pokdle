// News ticker under the header: only real, current facts about the site, each
// one a door to the matching screen. Hidden when fewer than two facts exist.
const NEWS_TICKER_RELEASE = { until: "2026-11-05", text: "Nouveau : des animations quand tu montes de niveau, et la Draft revue", action: "openDraftScoreAttackMode" };
function newsTickerParisDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
async function newsTickerJson(url) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data?.ok) throw new Error("unavailable");
  return data;
}
async function newsTickerItems() {
  const items = [];
  if (typeof weeklyLeagueIsoWeek === "function" && typeof weeklyLeagueTimeLeft === "function") {
    items.push({ icon: "◆", text: "Ligue · semaine " + weeklyLeagueIsoWeek().week + " · le badge se joue encore " + weeklyLeagueTimeLeft(), action: "openWeeklyLeague" });
  }
  const [egg, board, news] = await Promise.allSettled([newsTickerJson("/api/egg"), newsTickerJson("/api/leaderboard?mode=journey&scope=today"), newsTickerJson("/api/news")]);
  if (egg.status === "fulfilled") {
    const state = egg.value, today = newsTickerParisDay();
    const fresh = (state.clues || []).filter(clue => clue.unlockedAt && newsTickerParisDay(new Date(clue.unlockedAt)) === today).pop();
    const text = state.solved ? "L’Œuf mystère a éclos : " + (state.winner?.name || "un dresseur") + " l’a trouvé"
      : fresh ? "Œuf mystère : nouvel indice aujourd’hui, " + fresh.label + " : " + fresh.value
      : "Œuf mystère : " + (state.eliminatedIds?.length || 0) + " pistes écartées, " + (state.remaining || 0) + " encore possibles";
    items.push({ icon: "◒", text, action: "openEggGame" });
  }
  if (board.status === "fulfilled") {
    const total = Number(board.value.total) || 0;
    // An empty ranking reads as an empty site: say nothing until someone is ranked.
    if (total) items.push({ icon: "★", text: total + " dresseur" + (total > 1 ? "s" : "") + " au classement Global du jour", action: "openLeaderboardV2" });
  }
  // The line set from the admin panel replaces the built-in one; until then the built-in one stays.
  const release = news.status === "fulfilled" && news.value.set ? news.value.news : NEWS_TICKER_RELEASE;
  if (release && newsTickerParisDay() <= release.until) items.push({ icon: "✦", text: release.text, action: release.action });
  return items;
}
async function renderNewsTicker() {
  const ticker = document.getElementById("news-ticker"), track = ticker?.querySelector(".news-ticker-track");
  if (!ticker || !track) return;
  let items = [];
  try { items = await newsTickerItems(); } catch (_error) { items = []; }
  if (items.length < 2) { ticker.hidden = true; return; }
  const html = items.map(item => '<button type="button" class="news-ticker-item" data-action="' + escapeHtml(item.action) + '"><span aria-hidden="true">' + escapeHtml(item.icon) + "</span>" + escapeHtml(item.text) + "</button>").join("");
  newsTickerState = { html, count: items.length };
  ticker.hidden = false;
  newsTickerFill();
}
// The second copy makes the loop seamless: clickable, but skipped by keyboard and screen readers.
// 13/11/2026 : avec peu de messages (2 courts), une série était moins large qu'un grand écran et laissait un
// vide à droite. Chaque série répète maintenant les messages jusqu'à couvrir la largeur du bandeau ; la durée
// grandit avec, pour garder la même vitesse.
let newsTickerState = null;
function newsTickerFill() {
  const ticker = document.getElementById("news-ticker"), track = ticker?.querySelector(".news-ticker-track");
  if (!ticker || !track || !newsTickerState) return;
  const { html, count } = newsTickerState;
  const hidden = html.replaceAll("<button ", '<button tabindex="-1" ');
  track.innerHTML = '<div class="news-ticker-group">' + html + '</div><div class="news-ticker-group" aria-hidden="true">' + hidden + "</div>";
  const one = track.firstElementChild ? track.firstElementChild.scrollWidth : 0;
  const wide = ticker.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0);
  const repeat = one > 0 && wide > 0 ? Math.min(12, Math.max(1, Math.ceil(wide / one))) : 1;
  if (repeat > 1) {
    // Les copies en plus ne sont lues ni au clavier ni par les lecteurs d'écran.
    const group = html + hidden.replaceAll("<button ", '<button aria-hidden="true" ').repeat(repeat - 1);
    track.innerHTML = '<div class="news-ticker-group">' + group + '</div><div class="news-ticker-group" aria-hidden="true">' + hidden.repeat(repeat) + "</div>";
  }
  ticker.style.setProperty("--ticker-duration", Math.max(28, count * 9) * repeat + "s");
  ticker.dataset.repeat = String(repeat);
}
if (typeof window !== "undefined" && window.addEventListener) {
  let newsTickerResize = null;
  window.addEventListener("resize", () => { clearTimeout(newsTickerResize); newsTickerResize = setTimeout(newsTickerFill, 250); });
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(renderNewsTicker, 400));
  else setTimeout(renderNewsTicker, 400);
}
