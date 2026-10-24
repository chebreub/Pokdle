
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
      ? '<small>Top 3 de la semaine</small>' + rows.map(row => '<div class="leaderboard-week-row rank-' + Number(row.rank) + (row.me ? ' is-me' : '') + '"><span>' + Number(row.rank) + '</span>' + leaderboardV2Avatar(row) + '<b>' + escapeHtml(row.username || "Dresseur") + '</b><strong>' + Number(row.score || 0) + ' pts</strong></div>').join("")
      : '<small>Personne n’a encore marqué cette semaine : la première place t’attend.</small>';
  }).catch(() => {
    const box = document.getElementById("leaderboard-week-top");
    if (box && isCurrent()) box.innerHTML = '<small>Top 3 de la semaine indisponible pour le moment.</small>';
  });
}

// Discord is always offered (its link also works without JavaScript); Google and Twitch only once configured.
function loginProviderButtonsHtml() {
  const providers = window.__pokedleProviders || { google: false, twitch: false };
  return (providers.google ? '<a class="btn-ghost login-google" href="/auth/google"><svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.83h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.24c1.9-1.75 2.96-4.32 2.96-7.34z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 13.91a6 6 0 0 1 0-3.82V7.51H3.06a10 10 0 0 0 0 8.98z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.51L6.4 10.1C7.19 7.73 9.4 5.97 12 5.97z"/></svg>Continuer avec Google</a>' : '') +
    '<a class="btn-blue login-discord" href="/auth/discord">Continuer avec Discord</a>' +
    (providers.twitch ? '<a class="btn-blue login-twitch" href="/auth/twitch">Continuer avec Twitch</a>' : '');
}
function openLoginWelcome() {
  if (connectedAccountUser) return openAccountMenu();
  ensureOverlay("Bienvenue sur Pokédle", '<div class="login-welcome"><div class="login-welcome-art" aria-hidden="true"><img src="'+modeCatalogSpriteUrl(133)+'" alt="" width="128" height="128"/><span>✦</span></div><span class="club-eyebrow">TON PETIT RENDEZ-VOUS POKÉMON</span><h3>Une aventure à retrouver.</h3><p>Connecte-toi pour synchroniser ta progression et retrouver tes classements.</p>'+loginProviderButtonsHtml()+'<button class="btn-ghost" data-action="closeOverlayModal">Continuer en invité</button><small>Tu peux jouer sans compte. Ta progression invitée reste sur cet appareil. <a href="/confidentialite">Confidentialité</a></small></div>');
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
