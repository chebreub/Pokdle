
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
  return saves.filter(save => save && VALID_MODES.has(save.mode) && POKEMON_BY_ID.has(Number(save.secretId)) &&
    (save.mode !== "daily" || save.dailyKey === getUTCDateKey()) && Number.isFinite(Number(save.savedAt)))
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
  if (typeof renderPartner === "function") renderPartner();
  const panel = document.getElementById("home-return");
  if (!panel) return;
  const save = getClubResumeSave();
  const recent = readClubRecent();
  panel.classList.toggle("hidden", !save && !recent.length);
  const modeNames = { normal: "Mode illimité", daily: "Pokémon du jour", silhouette: "Zoom progressif", pixel: "Pixelisé", cry: "Cri", mystery: "Stat mystère", description: "Description", evolution: "Évolution", order: "Ordre Pokédex", weight: "Duel de poids" };
  panel.innerHTML = (save ? '<div class="club-resume"><div><span class="club-eyebrow">ON REPREND ?</span><strong>' + escapeHtml(modeNames[save.mode] || "Partie en cours") + '</strong><small>' + Math.max(0, Number(save.attempts) || 0) + ' essai(s) · Ta progression est conservée</small></div><button type="button" class="btn-blue" data-action="resumeClubGame">Reprendre →</button></div>' : '') +
    (recent.length ? '<div class="club-recent"><span>Derniers jeux</span>' + recent.map(key => '<button type="button" class="btn-ghost" data-action="clubLaunchRecent" data-args="' + escapeHtml(JSON.stringify([key])) + '">' + escapeHtml(clubLaunchers.get(key).label) + '</button>').join("") + '</div>' : '');
}
function isClubFeatured(card, category, query) {
  if (String(query || "").trim() || !["solo", "friends"].includes(category)) return false;
  try {
    const [name, ...args] = JSON.parse(card.dataset.args || "[]");
    return args.length === 0 && (category === "solo"
      ? ["startDailyGame", "startNormalGame", "openDraftScoreAttackMode"]
      : ["openPartyRoomMode", "openMultiplayerMode", "openStatClashMode"]).includes(name);
  } catch (_error) { return false; }
}
function renderCatalogPicks(category, query) {
  const panel = document.getElementById("catalog-picks");
  if (!panel) return;
  const hide = Boolean(String(query || "").trim()) || category === "explore" || category === "all";
  panel.classList.toggle("hidden", hide);
  if (hide) return;
  const picks = category === "friends" ? [
    ["openPartyRoomMode", "La soirée à plusieurs", "Party Room", "2–8 joueurs · Déduction, numéros et nouvelle enquête coop.", "users"],
    ["openMultiplayerMode", "Le face-à-face", "Duel 1v1", "2 joueurs · Le même mystère, chacun ses indices.", "swords"],
    ["openStatClashMode", "Le défi stratégique", "Stat Clash", "2 joueurs · Choisis les bonnes statistiques.", "chart"]
  ] : [
    ["startDailyGame", "Le rendez-vous", "Pokémon du jour", "Une cible par jour · Des indices à chaque essai.", "calendar"],
    ["startNormalGame", "Le classique", "Mode illimité", "Sans limite · Idéal pour découvrir Pokédle.", "infinity"],
    ["openDraftScoreAttackMode", "Le défi de score", "Draft Score Attack", "Compose une équipe de six et vise le record.", "chart"]
  ];
  panel.innerHTML = '<div class="club-section-head"><h3>Commence ici</h3><span>Trois incontournables</span></div><div class="club-picks-grid">' +
    picks.map((p, i) => '<button type="button" class="club-pick club-pick-' + i + '" data-action="openFromAllModes" data-args="' + escapeHtml(JSON.stringify([p[0]])) + '"><span class="club-pick-icon" aria-hidden="true"><svg><use href="#i-' + p[4] + '"/></svg></span>' + (typeof modeCatalogArtHtml === "function" ? modeCatalogArtHtml(p[0], "pick") : "") + '<small>' + p[1] + '</small><b>' + p[2] + '</b><span>' + p[3] + '</span><strong aria-hidden="true">Jouer →</strong></button>').join("") + '</div><p class="club-more-label">Ou explore les autres jeux ci-dessous</p>';
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
      const label = card.querySelector("b")?.textContent || name;
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
