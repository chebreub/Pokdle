
function leaderboardLeagueAside(data, mode, scope) {
  if (typeof weeklyLeagueState !== "function") return "";
  const league = weeklyLeagueState();
  const position = scope === "today" && data?.me ? '<b>#'+Number(data.me.rank)+'</b><span>'+escapeHtml(leaderboardV2ModeMeta(mode).label)+'</span>' : '<span>Retrouve ta position sur chaque jeu.</span>';
  const week = typeof weeklyLeagueIsoWeek === "function" ? weeklyLeagueIsoWeek().week : "";
  const prize = '<section class="leaderboard-prize"><span class="club-eyebrow">À GAGNER CETTE SEMAINE</span><h4>Badge Maître de Ligue</h4><p>Maîtrise les trois disciplines de la semaine '+escapeHtml(String(week))+(typeof weeklyLeagueTimeLeft === "function" ? ' · reset dans '+escapeHtml(weeklyLeagueTimeLeft()) : '')+'.</p><div id="leaderboard-week-top" class="leaderboard-week-top"><small>Top 3 de la semaine…</small></div></section>';
  return '<aside class="leaderboard-aside">'+prize+'<section><span class="club-eyebrow">TON ÉPREUVE DE LIGUE</span><h4>'+league.score+' <small>/ 600 pts</small></h4><progress max="600" value="'+league.score+'"></progress><p>'+league.completed+'/3 disciplines maîtrisées</p><p class="league-badge-note">'+(league.claimed?'◆ Badge de maîtrise obtenu':league.mastered?'◆ Ton badge est prêt':'◆ Maîtrise les trois disciplines pour obtenir le badge.')+'</p><button class="btn-blue" data-action="openWeeklyLeague">Voir mes objectifs →</button></section><section><span class="club-eyebrow">MA POSITION DU JOUR</span><div class="leaderboard-aside-position">'+position+'</div><button class="btn-ghost" data-action="openLeaderboardV2" data-args=\'["enquete","today"]\'>Enquête du jour →</button><button class="btn-ghost" data-action="openLeaderboardV2" data-args=\'["quiz","today"]\'>Quiz →</button><button class="btn-ghost" data-action="openLeaderboardV2" data-args=\'["speedrun","today"]\'>Speedrun →</button></section></aside>';
}

// Fills the "Top 3 de la semaine" of the leaderboard aside once the board is shown.
function fillLeaderboardWeekTop(isCurrent) {
  const mode = typeof weeklyLeagueLeaderboardMode === "function" ? weeklyLeagueLeaderboardMode() : null;
  if (!mode || typeof leaderboardFetchJson !== "function") return Promise.resolve();
  return leaderboardFetchJson("/api/leaderboard?mode=" + encodeURIComponent(mode) + "&scope=all").then(data => {
    const box = document.getElementById("leaderboard-week-top");
    if (!box || !isCurrent()) return;
    const rows = (Array.isArray(data?.top) ? data.top : []).filter(row => Number(row.rank) <= 3).slice(0, 3);
    box.innerHTML = rows.length
      ? '<small>Top 3 de la semaine</small>' + rows.map(row => '<div class="leaderboard-week-row' + (row.me ? ' is-me' : '') + '"><span>' + (["🥇","🥈","🥉"][Number(row.rank) - 1] || "#" + Number(row.rank)) + '</span>' + leaderboardV2Avatar(row) + '<b>' + escapeHtml(row.username || "Dresseur") + '</b><strong>' + Number(row.score || 0) + ' pts</strong></div>').join("")
      : '<small>Personne n’a encore marqué cette semaine : la première place t’attend.</small>';
  }).catch(() => {
    const box = document.getElementById("leaderboard-week-top");
    if (box && isCurrent()) box.innerHTML = '<small>Top 3 de la semaine indisponible pour le moment.</small>';
  });
}

function openLoginWelcome() {
  if (connectedAccountUser) return openAccountMenu();
  ensureOverlay("Bienvenue sur Pokédle", '<div class="login-welcome"><div class="login-welcome-art" aria-hidden="true"><img src="'+modeCatalogSpriteUrl(133)+'" alt="" width="128" height="128"/><span>✦</span></div><span class="club-eyebrow">TON PETIT RENDEZ-VOUS POKÉMON</span><h3>Une aventure à retrouver.</h3><p>Connecte-toi pour synchroniser ta progression et retrouver tes classements.</p><a class="btn-blue login-discord" href="/auth/discord">Continuer avec Discord</a><button class="btn-ghost" data-action="closeOverlayModal">Continuer en invité</button><small>Tu peux jouer sans compte. Ta progression invitée reste sur cet appareil.</small></div>');
  document.getElementById("overlay-modal").dataset.kind = "login";
}
// Existing Discord links remain functional with JavaScript disabled. Delegation
// opens the welcome view before the user explicitly starts the OAuth flow.
if (typeof document !== "undefined") document.addEventListener("click", event => {
  const link = event.target.closest?.(".account-login");
  if (!link) return;
  event.preventDefault();
  openLoginWelcome();
});
