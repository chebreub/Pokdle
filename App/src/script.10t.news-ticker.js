// News ticker under the header: only real, current facts about the site, each
// one a door to the matching screen. Hidden when fewer than two facts exist.
const NEWS_TICKER_RELEASE = { until: "2026-11-03", text: "Nouveau : une flèche pour la génération dans le Pokémon du jour", action: "startDailyGame" };
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
  const [egg, board] = await Promise.allSettled([newsTickerJson("/api/egg"), newsTickerJson("/api/leaderboard?mode=journey&scope=today")]);
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
  if (newsTickerParisDay() <= NEWS_TICKER_RELEASE.until) items.push({ icon: "✦", text: NEWS_TICKER_RELEASE.text, action: NEWS_TICKER_RELEASE.action });
  return items;
}
async function renderNewsTicker() {
  const ticker = document.getElementById("news-ticker"), track = ticker?.querySelector(".news-ticker-track");
  if (!ticker || !track) return;
  let items = [];
  try { items = await newsTickerItems(); } catch (_error) { items = []; }
  if (items.length < 2) { ticker.hidden = true; return; }
  const html = items.map(item => '<button type="button" class="news-ticker-item" data-action="' + escapeHtml(item.action) + '"><span aria-hidden="true">' + escapeHtml(item.icon) + "</span>" + escapeHtml(item.text) + "</button>").join("");
  // The second copy makes the loop seamless: clickable, but skipped by keyboard and screen readers.
  track.innerHTML = '<div class="news-ticker-group">' + html + '</div><div class="news-ticker-group" aria-hidden="true">' + html.replaceAll("<button ", '<button tabindex="-1" ') + "</div>";
  ticker.style.setProperty("--ticker-duration", Math.max(28, items.length * 9) + "s");
  ticker.hidden = false;
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(renderNewsTicker, 400));
  else setTimeout(renderNewsTicker, 400);
}
