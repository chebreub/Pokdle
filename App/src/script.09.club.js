
/* Club: contextual shortcuts, a small curated selection and shared round moments. */
var CLUB_RECENT_KEY = "pokedle_recent_games_v1";
var clubLaunchers = new Map();
function clubRecentEntries(raw, allowed) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(key => typeof key === "string" && allowed.has(key)))].slice(0, 3);
}
function readClubRecent() {
  try { return clubRecentEntries(JSON.parse(localStorage.getItem(CLUB_RECENT_KEY) || "[]"), clubLaunchers); }
  catch (_error) { return []; }
}
function rememberClubGame(key) {
  if (!clubLaunchers.has(key)) return;
  const recent = clubRecentEntries([key, ...readClubRecent()], clubLaunchers);
  try { localStorage.setItem(CLUB_RECENT_KEY, JSON.stringify(recent)); } catch (_error) {}
}
function getClubResumeSave() {
  const saves = [readJson(STORAGE_KEYS.dailyGame, null), readJson(STORAGE_KEYS.game, null)];
  return saves.filter(save => save && VALID_MODES.has(save.mode) && (save.mode === "daily" ? save.version === 2 && save.accountId === dailyObservedAccountId() : POKEMON_BY_ID.has(Number(save.secretId))) &&
    (save.mode !== "daily" || save.dailyKey === getDailyDateKey()) && Number.isFinite(Number(save.savedAt)))
    .sort((a, b) => Number(b.savedAt) - Number(a.savedAt))[0] || null;
}
function resumeClubGame() {
  const save = getClubResumeSave();
  if (!save || !restoreSavedGame(save.mode)) {
    renderHomeReturn();
    showToast("Cette partie n’est plus disponible.");
    return;
  }
  const state = { screen: "game", mode: gameMode, secretId: secretPokemon?.id };
  history.pushState(state, "", location.pathname + location.search + "#game");
}
function clubLaunchRecent(key) {
  const entry = clubLaunchers.get(key);
  if (entry && typeof window[entry.name] === "function") window[entry.name](...entry.args);
}
function renderHomeReturn() {
  renderHomeDiscovery(true);
  if (typeof renderPartner === "function") renderPartner();
  const panel = document.getElementById("home-return");
  if (!panel) return;
  const resume = getClubResumeSave();
  // The daily already has its own resume action in the hero.
  const save = resume?.mode === "daily" ? null : resume;
  const recent = readClubRecent();
  panel.classList.toggle("hidden", !save && !recent.length);
  const modeNames = { normal: "Mode illimité", daily: "Pokémon du jour", silhouette: "Zoom progressif", pixel: "Pixelisé", cry: "Cri", mystery: "Stat mystère", description: "Description", evolution: "Évolution", order: "Ordre Pokédex", weight: "Duel de poids" };
  const resumeHtml = save
    ? '<div class="club-return-main"><span class="club-eyebrow">REPRENDRE</span><div><strong>' + escapeHtml(modeNames[save.mode] || "Partie en cours") + '</strong><small>' + Math.max(0, Number(save.attempts) || 0) + ' essai(s) · progression conservée</small></div><button type="button" class="btn-blue" data-action="resumeClubGame">Reprendre →</button></div>'
    : '';
  const recentHtml = recent.length
    ? '<div class="club-recent"><span>Récents</span>' + recent.map(key => '<button type="button" class="btn-ghost" data-action="clubLaunchRecent" data-args="' + escapeHtml(JSON.stringify([key])) + '">' + escapeHtml(clubLaunchers.get(key).label) + '</button>').join("") + '</div>'
    : '';
  panel.innerHTML = '<div class="club-return-bar">' + resumeHtml + recentHtml + '</div>';
}
var homeGameFilter = "popular";
function filterHomeGames(filter) {
  homeGameFilter = ["popular", "guess", "think", "arcade", "strategy"].includes(filter) ? filter : "popular";
  renderHomeDiscovery(true);
  document.querySelectorAll("#home-game-filters button").forEach(button => button.setAttribute("aria-pressed", String(JSON.parse(button.dataset.args)[0] === homeGameFilter)));
}
function renderHomeDiscovery(force = false) {
  const grid = document.getElementById("home-games-grid");
  if (!grid || (grid.childElementCount && !force) || typeof modeTileCloneForHome !== "function") return;
  // Same families and order as the catalogue; the daily keeps its own block above.
  const shelves = {
    popular: ["startSilhouetteGame", "startCryGame", "openPokeConnectionsMode", "startQuizGame", "openDraftScoreAttackMode", "openHigherLowerMode"],
    guess: ["startNormalGame", "startSilhouetteGame", "startPixelGame", "startDescriptionMode", "startCryGame", "startMysteryStatGame"],
    think: ["openPokeConnectionsMode", "openOddOneOutMode", "startQuizGame", "startEvolutionChainGame", "startPokedexOrderGame", "openTypeComboSolo"],
    arcade: ["startWeightBattle", "openHigherLowerMode", "openSpeedrunMode", "startPartyMode"],
    strategy: ["openDraftScoreAttackMode", ["openDraftScoreAttackMode", true]]
  };
  grid.replaceChildren(...(shelves[homeGameFilter] || shelves.popular).map(entry => [].concat(entry)).map(([key, pro]) => modeTileCloneForHome(key, Boolean(pro))).filter(Boolean));
}
function homeGameRecordHtml(action) {
  const records = { openHigherLowerMode:["higherLowerHighScore","de série"], startQuizGame:["quizHighScore","/ " + (typeof QUIZ_QUESTION_COUNT === "number" ? QUIZ_QUESTION_COUNT : 15)], openSpeedrunMode:["speedrunHighScore","Pokémon"], openTypeComboSolo:["typeComboHighScore","pts"], openOddOneOutMode:["oddOneOutHighScore","de série"], startWeightBattle:["weightBattleHighScore","de série"] };
  const spec = records[action], value = spec ? Number(playerProfile?.[spec[0]]) || 0 : 0;
  return value > 0 ? '<small class="home-game-record">Ton record : '+value+' '+spec[1]+'</small>' : '';
}
// One painted illustration per week leads the catalogue; the games themselves stay in their family.
var CATALOG_FEATURES = [
  ["startDailyGame", "daily", "Le Pokémon du jour", "Le même mystère pour tout le monde. Enquête, puis Wordle, Dossier et Défi.", "Carnet d’enquête, loupe et Pokédex sur un sentier"],
  ["openPokeConnectionsMode", "connections", "Poké-Connections", "16 Pokémon, quatre liens cachés. À toi de retrouver les quatre groupes.", "Évoli et ses évolutions autour d’un puzzle"],
  ["openDraftScoreAttackMode", "draft", "Draft Score Attack", "Six choix pour une équipe de rêve. Vise le meilleur total.", "Gardevoir, Lucario et Corvaillus devant une arène"]
];
function catalogFeatureOfWeek(now = Date.now()) {
  // 1 January 1970 was a Thursday: shifting by 3 days makes weeks start on Monday.
  const week = Math.floor((Math.floor(now / 864e5) + 3) / 7);
  return CATALOG_FEATURES[week % CATALOG_FEATURES.length];
}
function renderCatalogPicks(category, query, difficulty = "all", family = "all") {
  const panel = document.getElementById("catalog-picks");
  if (!panel) return;
  const show = category === "solo" && family === "all" && !String(query || "").trim() && difficulty === "all";
  panel.classList.toggle("hidden", !show);
  if (!show) return;
  const [action, image, title, line, alt] = catalogFeatureOfWeek();
  if (panel.dataset.feature === action) return;
  const base = "img/modes/" + image + "-v1-";
  panel.dataset.feature = action;
  panel.innerHTML = '<button type="button" class="catalog-feature catalog-feature-' + image + '" data-action="openFromAllModes" data-args="' + escapeHtml(JSON.stringify([action])) + '">' +
    '<img src="' + base + '960.webp" srcset="' + base + '480.webp 480w, ' + base + '960.webp 960w" sizes="(max-width:760px) 100vw, 640px" width="960" height="640" alt="' + alt + '" loading="lazy" decoding="async" />' +
    '<span class="catalog-feature-copy"><span class="catalog-feature-badge">À la une cette semaine</span><b>' + title + '</b><span>' + line + '</span><strong aria-hidden="true">Jouer →</strong></span></button>';
}
function partyShareCoopClue() {
  const room = partyRoomState.room, socket = ensureMultiplayerSocket();
  if (!socket?.connected || room?.gameMode !== "coop" || room.status !== "playing" || room.round?.myCluesShared || partyRoomState.sharingClue) return;
  partyRoomState.sharingClue = true;
  renderPartyRoom();
  socket.timeout(8000).emit("party:share-clue", { code: room.code, roundSerial: room.round.roundSerial }, function (error, res) {
    partyRoomState.sharingClue = false;
    if (partyRoomState.room?.code !== room.code || partyRoomState.room?.round?.roundSerial !== room.round.roundSerial) return;
    if (error || !res?.ok) setPartyStatus(error ? "Partage non confirmé. Tu peux réessayer." : res?.error || "Partage impossible.");
    else if (res.room) partyRoomState.room = res.room;
    renderPartyRoom();
  });
}
function coopCluesHtml(clues) {
  return (clues || []).map(clue => '<div class="coop-clue"><small>' + escapeHtml(clue.label) + '</small><b>' + escapeHtml(clue.value) + '</b></div>').join("");
}
function renderPartyCoop(room, enabled, playing) {
  const panel = document.getElementById("party-coop");
  if (!panel) return;
  panel.classList.toggle("hidden", !enabled);
  if (!enabled) { panel.innerHTML = ""; return; }
  const round = room.round || {};
  panel.innerHTML = '<div class="coop-team-status"><span>UNE SEULE ÉQUIPE</span><b>' + (playing ? round.attemptsLeft + ' / ' + round.maxAttempts + ' essais restants' : round.solved ? 'Enquête résolue !' : 'Enquête terminée') + '</b></div>' +
    (playing ? '<div class="coop-private"><h4>Tes indices</h4><p>Raconte-les aux autres, ou partage-les ici.</p><div class="coop-clues">' + coopCluesHtml(round.myClues) + '</div><button type="button" class="btn-blue" data-action="partyShareCoopClue"' + (round.myCluesShared || partyRoomState.sharingClue || !(round.myClues || []).length ? ' disabled' : '') + '>' + (round.myCluesShared ? 'Indices partagés ✓' : partyRoomState.sharingClue ? 'Partage…' : 'Partager mes indices') + '</button></div>' : '') +
    '<h4>Le tableau de l’équipe</h4>' + ((round.sharedClues || []).length ? round.sharedClues.map(entry => '<article class="coop-shared"><b>' + escapeHtml(entry.nickname) + '</b><div class="coop-clues">' + coopCluesHtml(entry.clues) + '</div></article>').join("") : '<p class="party-deduction-muted">Les indices partagés apparaîtront ici. Vous pouvez aussi discuter à l’oral.</p>') +
    '<details class="coop-attempts"' + (playing ? '' : ' open') + '><summary>Vos propositions (' + (round.guesses || []).length + ')</summary>' + (round.guesses || []).map(guess => '<p><b>' + escapeHtml(guess.name) + '</b> · ' + escapeHtml(guess.nickname) + (guess.correct ? ' ✓ Trouvé' : ' ×') + '</p>').join("") + '</details>';
}
function partyRankChange(players, me) {
  if (!me) return 0;
  const rank = score => 1 + players.filter(p => score(p) > score(me)).length;
  return rank(p => (Number(p.score) || 0) - (Number(p.lastGain) || 0)) - rank(p => Number(p.score) || 0);
}
function renderPartyRoundRecap(room, me) {
  const panel = document.getElementById("party-round-recap");
  if (!panel) return;
  const ended = room.status === "finished" || room.status === "complete";
  panel.classList.toggle("hidden", !ended);
  if (!ended) { panel.innerHTML = ""; return; }
  const players = room.players || [], coop = room.gameMode === "coop", complete = room.status === "complete";
  const gain = Number(me?.lastGain) || 0, movement = partyRankChange(players, me);
  const leaders = players.filter(p => (Number(p.score) || 0) === Math.max(...players.map(p => Number(p.score) || 0)));
  const earned = players.filter(p => (Number(p.lastGain) || 0) > 0);
  const title = coop ? room.round?.solved ? "Bien joué, l’équipe !" : "Le mystère est révélé" : complete ? "La soirée a ses champions" : gain ? "Bien joué !" : "La manche est terminée";
  const detail = coop ? (room.round?.solved ? "Chacun marque 100 points. Une réussite collective !" : "La réponse est révélée. Croisez vos indices pour la prochaine enquête.") : complete ? leaders.map(p => p.nickname).join(" & ") + " · en tête avec " + (Number(leaders[0]?.score) || 0) + " points" : earned.length ? earned.map(p => p.nickname).join(", ") + " marque" + (earned.length > 1 ? "nt" : "") + " des points." : "Aucun point cette manche.";
  panel.innerHTML = '<span class="club-eyebrow">' + (complete ? 'RÉSULTAT FINAL' : 'FIN DE MANCHE') + '</span><h3>' + title + '</h3><p>' + escapeHtml(detail) + '</p><div class="club-result-stats"><span><b>+' + gain + '</b> cette manche</span><span><b>' + (Number(me?.score) || 0) + '</b> points au total</span>' +
    (!coop && movement ? '<span><b>' + (movement > 0 ? '↑ ' : '↓ ') + Math.abs(movement) + '</b> place(s)</span>' : '') + '</div>';
  const key = room.code + ':' + room.roundNumber + ':' + room.round?.roundSerial + ':' + room.status;
  if (partyRoomState.recapKey !== key) {
    partyRoomState.recapKey = key;
    panel.classList.remove("club-result-enter");
    void panel.offsetWidth;
    panel.classList.add("club-result-enter");
  }
}
function renderSoloClubResult(won) {
  const box = document.getElementById("win-box");
  if (!box || !secretPokemon) return;
  let detail = document.getElementById("solo-club-result");
  if (!detail) {
    detail = document.createElement("div");
    detail.id = "solo-club-result";
    detail.className = "club-solo-result";
    const actions = box.querySelector(".win-btns");
    if (actions) box.insertBefore(detail, actions);
    else box.appendChild(detail);
  }
  const typeLabel = [secretPokemon.type1, secretPokemon.type2].filter(t => t && t !== "Aucun").join(" / ");
  const genLabel = secretPokemon.isAltForm ? "Forme alternative" : "Génération " + secretPokemon.gen;
  const copy = gameMode === "daily"
    ? "Défi quotidien terminé. Ton prochain Pokémon arrive demain."
    : won ? "Mystère enregistré dans ton Pokédex." : "Le mystère est révélé.";
  detail.innerHTML =
    '<div class="club-result-meta">' +
      '<span>' + escapeHtml(genLabel) + '</span>' +
      '<span>' + escapeHtml(typeLabel) + '</span>' +
    '</div>' +
    '<p>' + escapeHtml(copy) + '</p>' +
    (won ? '<button type="button" class="btn-ghost club-result-pokedex" data-action="openRegisteredPokemonInPokedex" data-args=\'[' + Number(secretPokemon.id) + ']\'>Voir ' + escapeHtml(secretPokemon.name) + ' dans le Pokédex →</button>' : '');
}
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("#screen-all-modes .all-modes-card[data-action='openFromAllModes']").forEach(card => {
    if (card.dataset.category === "explore") return;
    try {
      const [name, ...args] = JSON.parse(card.dataset.args);
      // Catalogue cards may already be redrawn as tiles when this runs.
      const label = card.querySelector(".mode-tile-title, b")?.textContent.trim() || name;
      clubLaunchers.set(JSON.stringify([name, ...args]), { name, args, label });
    } catch (_error) {}
  });
  const names = new Set([...clubLaunchers.values()].map(entry => entry.name));
  names.forEach(name => {
    const original = window[name];
    if (typeof original !== "function") return;
    window[name] = function (...args) {
      const result = original.apply(this, args);
      let key = JSON.stringify([name, ...args]);
      if (!clubLaunchers.has(key) && args.length === 1 && args[0] === false) key = JSON.stringify([name]);
      if (clubLaunchers.has(key)) rememberClubGame(key);
      return result;
    };
  });
  renderHomeReturn();
});
