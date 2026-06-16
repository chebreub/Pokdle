// === HIGHER OR LOWER — mode solo ===
const HIGHER_LOWER_STATS = [
  { key: "hp", label: "PV", icon: "❤️" },
  { key: "attack", label: "Attaque", icon: "⚔️" },
  { key: "defense", label: "Défense", icon: "🛡️" },
  { key: "spAttack", label: "Atk. Spé.", icon: "✨" },
  { key: "spDefense", label: "Déf. Spé.", icon: "🪄" },
  { key: "speed", label: "Vitesse", icon: "💨" },
];

let higherLowerState = null;
const higherLowerTimeouts = new Set();
let higherLowerRushIntervalId = null;
const HIGHER_LOWER_RUSH_MS = 60000;
const HIGHER_LOWER_STAT_KEY_TO_API = { hp: "hp", attack: "attack", defense: "defense", spAttack: "spAttack", spDefense: "spDefense", speed: "speed" };

function getHigherLowerPool() {
  return getPokemonUiList().filter((pokemon) => Boolean(getMysteryApiId(pokemon)));
}

function createHigherLowerState(mode = "lobby") {
  return {
    phase: mode === "lobby" ? "lobby" : "loading",
    mode,
    left: null,
    right: null,
    statKey: null,
    score: 0,
    highScore: Number(playerProfile?.higherLowerHighScore) || 0,
    rushHighScore: Number(playerProfile?.higherLower60sHighScore) || 0,
    rushEndsAt: null,
    rushLeftMs: HIGHER_LOWER_RUSH_MS,
    lastChoice: null,
    lastCorrect: null,
    isAnimating: false,
    room: null,
    roomDraftCode: "",
    roomNicknameDraft: String(playerProfile?.nickname || "").trim(),
    roomPairIndex: 0,
    roomPendingAction: null,
    roomError: null,
  };
}

function clearHigherLowerRushInterval() {
  if (higherLowerRushIntervalId) {
    clearInterval(higherLowerRushIntervalId);
    higherLowerRushIntervalId = null;
  }
}

function startHigherLowerRushTimer() {
  if (!higherLowerState) return;
  if (higherLowerState.mode !== "rush60" && higherLowerState.mode !== "versus") return;
  clearHigherLowerRushInterval();
  if (higherLowerState.mode === "rush60") {
    higherLowerState.rushEndsAt = Date.now() + HIGHER_LOWER_RUSH_MS;
    higherLowerState.rushLeftMs = HIGHER_LOWER_RUSH_MS;
  } else if (higherLowerState.rushEndsAt) {
    higherLowerState.rushLeftMs = Math.max(0, higherLowerState.rushEndsAt - Date.now());
  }
  higherLowerRushIntervalId = setInterval(() => {
    if (!higherLowerState) return clearHigherLowerRushInterval();
    if (higherLowerState.mode !== "rush60" && higherLowerState.mode !== "versus") return clearHigherLowerRushInterval();
    higherLowerState.rushLeftMs = Math.max(0, (higherLowerState.rushEndsAt || 0) - Date.now());
    const timerEl = document.getElementById("higher-lower-timer");
    if (timerEl) timerEl.textContent = `${Math.ceil(higherLowerState.rushLeftMs / 1000)}s`;
    if (higherLowerState.rushLeftMs <= 0) {
      clearHigherLowerRushInterval();
      if (higherLowerState.mode === "rush60") finalizeHigherLowerRush();
    }
  }, 100);
}

function finalizeHigherLowerRush() {
  if (!higherLowerState) return;
  if (higherLowerState.score > higherLowerState.rushHighScore) {
    higherLowerState.rushHighScore = higherLowerState.score;
    if (typeof playerProfile === "object" && playerProfile) {
      playerProfile.higherLower60sHighScore = higherLowerState.rushHighScore;
      try { saveProfile(); } catch (_e) {}
    }
  }
  higherLowerState.phase = "gameover";
  try {
    recordMatchHistory({ mode: "higher-lower-rush", result: higherLowerState.score >= 10 ? "win" : "loss", attempts: higherLowerState.score, targetName: `60s · ${higherLowerState.score} pts` });
  } catch (_e) {}
  renderHigherLowerScreen();
}

function pickHigherLowerStat() {
  return HIGHER_LOWER_STATS[Math.floor(Math.random() * HIGHER_LOWER_STATS.length)];
}

async function pickHigherLowerPokemonWithStats(excludeId) {
  const pool = getHigherLowerPool();
  if (!pool.length) return null;
  const filtered = excludeId ? pool.filter((p) => p.id !== excludeId) : pool;
  const shuffled = shuffleArray((filtered.length ? filtered : pool).slice());
  for (const pokemon of shuffled.slice(0, 12)) {
    const stats = await fetchBattleStats(pokemon);
    if (stats) return { pokemon, stats };
  }
  return null;
}

function trackHigherLowerTimeout(fn, ms) {
  const id = setTimeout(() => { higherLowerTimeouts.delete(id); fn(); }, ms);
  higherLowerTimeouts.add(id);
  return id;
}

function clearHigherLowerTimeouts() {
  for (const id of higherLowerTimeouts) clearTimeout(id);
  higherLowerTimeouts.clear();
}

function openHigherLowerMode() {
  const pool = getHigherLowerPool();
  if (!pool.length) return showToast("Impossible de charger la base Pokémon pour Higher or Lower.");
  goToConfig();
  clearHigherLowerTimeouts();
  clearHigherLowerRushInterval();
  hideExtraScreens();
  hideScreen("screen-config");
  hideScreen("screen-game");
  showScreen("screen-higher-lower");
  setGlobalNavActive("game");
  gameMode = "higher-lower";
  higherLowerState = createHigherLowerState("lobby");
  renderHigherLowerScreen();
}

function startHigherLowerMode(mode) {
  trackUsage("solo:higherlower");
  if (!higherLowerState) higherLowerState = createHigherLowerState(mode);
  higherLowerState.mode = mode === "rush60" ? "rush60" : "infinite";
  higherLowerState.score = 0;
  higherLowerState.left = null;
  higherLowerState.right = null;
  higherLowerState.lastChoice = null;
  higherLowerState.lastCorrect = null;
  higherLowerState.isAnimating = false;
  higherLowerState.rushLeftMs = HIGHER_LOWER_RUSH_MS;
  higherLowerState.rushEndsAt = null;
  if (higherLowerState.mode === "rush60") startHigherLowerRushTimer();
  startHigherLowerRound();
}

async function startHigherLowerRound() {
  if (!higherLowerState) return;
  higherLowerState.phase = "loading";
  higherLowerState.lastChoice = null;
  higherLowerState.lastCorrect = null;
  renderHigherLowerScreen();
  if (!higherLowerState.left) {
    higherLowerState.left = await pickHigherLowerPokemonWithStats(null);
  } else if (higherLowerState.right) {
    higherLowerState.left = higherLowerState.right;
  }
  if (!higherLowerState || !higherLowerState.left) return;
  higherLowerState.right = await pickHigherLowerPokemonWithStats(higherLowerState.left.pokemon.id);
  if (!higherLowerState || !higherLowerState.right) {
    higherLowerState.phase = "gameover";
    return renderHigherLowerScreen();
  }
  const statMeta = pickHigherLowerStat();
  higherLowerState.statKey = statMeta.key;
  higherLowerState.left.statValue = Number(higherLowerState.left.stats?.[statMeta.key]) || 0;
  higherLowerState.right.statValue = Number(higherLowerState.right.stats?.[statMeta.key]) || 0;
  higherLowerState.phase = "playing";
  renderHigherLowerScreen();
}

function answerHigherLower(choice) {
  if (!higherLowerState || higherLowerState.phase !== "playing" || higherLowerState.isAnimating) return;
  const leftVal = Number(higherLowerState.left?.statValue) || 0;
  const rightVal = Number(higherLowerState.right?.statValue) || 0;
  let correct;
  if (rightVal === leftVal) correct = true;
  else if (rightVal > leftVal) correct = (choice === "higher");
  else correct = (choice === "lower");
  higherLowerState.lastChoice = choice;
  higherLowerState.lastCorrect = correct;
  higherLowerState.phase = "revealing";
  higherLowerState.isAnimating = true;
  renderHigherLowerScreen();
  trackHigherLowerTimeout(() => {
    if (!higherLowerState) return;
    higherLowerState.isAnimating = false;
    if (higherLowerState.mode === "rush60") {
      if (correct) {
        higherLowerState.score += 1;
      }
      if (higherLowerState.rushLeftMs > 0) {
        startHigherLowerRound();
      } else {
        finalizeHigherLowerRush();
      }
      return;
    }
    if (correct) {
      higherLowerState.score += 1;
      awardXp(3, "Higher or Lower");
      progressQuest("hl_streak_10", higherLowerState.score);
      if (higherLowerState.score > higherLowerState.highScore) {
        higherLowerState.highScore = higherLowerState.score;
        if (typeof playerProfile === "object" && playerProfile) {
          playerProfile.higherLowerHighScore = higherLowerState.highScore;
          try { saveProfile(); } catch (_e) {}
        }
      }
      startHigherLowerRound();
    } else {
      higherLowerState.phase = "gameover";
      try {
        recordMatchHistory({ mode: "higher-lower", result: higherLowerState.score >= 5 ? "win" : "loss", attempts: higherLowerState.score, targetName: `Score ${higherLowerState.score}` });
      } catch (_e) {}
      renderHigherLowerScreen();
      notifyPartyRoundFromScreenMode(higherLowerState.score >= 5, `score ${higherLowerState.score}`);
    }
  }, higherLowerState.mode === "rush60" ? 900 : 1800);
}

function restartHigherLowerGame() {
  if (!higherLowerState) return openHigherLowerMode();
  if (higherLowerState.mode === "versus" && higherLowerState.room) {
    return leaveHigherLowerRoom();
  }
  clearHigherLowerTimeouts();
  clearHigherLowerRushInterval();
  higherLowerState.phase = "lobby";
  higherLowerState.mode = "lobby";
  higherLowerState.score = 0;
  higherLowerState.left = null;
  higherLowerState.right = null;
  higherLowerState.lastChoice = null;
  higherLowerState.lastCorrect = null;
  higherLowerState.isAnimating = false;
  higherLowerState.rushLeftMs = HIGHER_LOWER_RUSH_MS;
  higherLowerState.rushEndsAt = null;
  renderHigherLowerScreen();
}

function renderHigherLowerScreen() {
  const root = document.getElementById("higher-lower-root");
  if (!root) return;
  const state = higherLowerState;
  if (!state) { root.innerHTML = ""; return; }
  if (state.phase === "lobby") {
    root.innerHTML = `
      <div class="higher-lower-lobby">
        <h3>Choisis ton mode</h3>
        <div class="higher-lower-modes">
          <button class="higher-lower-mode-card" type="button" data-action="startHigherLowerMode" data-args='["infinite"]'>
            <div class="higher-lower-mode-icon">♾️</div>
            <h4>Mode infini</h4>
            <p>Enchaîne jusqu'à la première erreur. Combien de bonnes réponses d'affilée ?</p>
            <div class="higher-lower-mode-record">Record : <b>${state.highScore}</b></div>
          </button>
          <button class="higher-lower-mode-card" type="button" data-action="startHigherLowerMode" data-args='["rush60"]'>
            <div class="higher-lower-mode-icon">⏱️</div>
            <h4>Course 60s</h4>
            <p>60 secondes pour faire le max de bonnes réponses. Les erreurs ne pénalisent pas, juste le temps presse.</p>
            <div class="higher-lower-mode-record">Record : <b>${state.rushHighScore}</b></div>
          </button>
          <button class="higher-lower-mode-card" type="button" data-action="startHigherLowerVersusFromLobby">
            <div class="higher-lower-mode-icon">🆚</div>
            <h4>Versus 1v1</h4>
            <p>Course 60s en temps réel contre un ami. Mêmes Pokémon synchronisés, score adverse visible en live.</p>
            <div class="higher-lower-mode-record">Multi temps réel</div>
          </button>
        </div>
      </div>`;
    return;
  }
  if (state.phase === "room") {
    const room = state.room;
    const code = room?.code || "";
    const players = Array.isArray(room?.players) ? room.players : [];
    const selfPlayer = players.find((p) => p.isSelf) || null;
    const opponent = players.find((p) => !p.isSelf) || null;
    const isHost = Boolean(selfPlayer?.isHost);
    const canStart = Boolean(room?.canStart) && isHost;
    const pending = state.roomPendingAction;
    root.innerHTML = `
      <div class="higher-lower-room">
        ${!room ? `
          <h3>Versus 1v1 — Room</h3>
          <p class="card-desc">Crée une room et partage le code, ou rejoins une room existante.</p>
          <div class="higher-lower-room-form">
            <label>Ton pseudo
              <input id="higher-lower-nickname" type="text" maxlength="24" value="${escapeHtml(state.roomNicknameDraft || "")}" placeholder="Dresseur" data-input-action="syncHigherLowerNickname" />
            </label>
            <div class="higher-lower-room-actions">
              <button class="btn-blue" type="button" data-action="createHigherLowerRoom" ${pending ? "disabled" : ""}>${pending === "creating" ? "Création…" : "Créer une room"}</button>
            </div>
            <div class="higher-lower-room-join">
              <label>Code de room
                <input id="higher-lower-room-input" type="text" maxlength="6" value="${escapeHtml(state.roomDraftCode || "")}" placeholder="ABCD" data-input-action="syncHigherLowerJoinCode" />
              </label>
              <button class="btn-ghost" type="button" data-action="joinHigherLowerRoom" ${pending ? "disabled" : ""}>${pending === "joining" ? "Connexion…" : "Rejoindre"}</button>
            </div>
          </div>
        ` : `
          <h3>Versus 1v1 — Room ${escapeHtml(code)}</h3>
          <div class="higher-lower-room-summary">
            <span><b>Code :</b> ${escapeHtml(code)}</span>
            <span><b>Joueurs :</b> ${room.connectedCount || 0}/${room.maxPlayers || 2}</span>
            <span><b>Statut :</b> ${escapeHtml(room.status === "lobby" ? (canStart ? "Prête" : "En attente") : room.status)}</span>
          </div>
          <div class="higher-lower-room-players">
            ${players.map((p) => `<div class="higher-lower-room-player ${p.connected ? "is-connected" : "is-disconnected"}"><b>${escapeHtml(p.nickname || "Joueur")}</b><span>${p.isHost ? "Hôte" : "Invité"}${p.isSelf ? " · Toi" : ""}</span></div>`).join("")}
            ${players.length < 2 ? `<div class="higher-lower-room-player is-empty"><b>En attente…</b><span>Partage le code</span></div>` : ""}
          </div>
          <div class="higher-lower-room-actions">
            ${isHost ? `<button class="btn-red" type="button" data-action="startHigherLowerRoomMatch" ${canStart && !pending ? "" : "disabled"}>${pending === "starting" ? "Lancement…" : "Lancer la partie"}</button>` : `<p class="card-desc">En attente du lancement par l'hôte.</p>`}
            <button class="btn-ghost" type="button" data-action="leaveHigherLowerRoom">Quitter</button>
          </div>
        `}
        ${state.roomError ? `<p class="higher-lower-feedback is-wrong">${escapeHtml(state.roomError)}</p>` : ""}
      </div>`;
    return;
  }
  if (state.phase === "loading" || !state.left || (state.phase !== "gameover" && !state.right)) {
    root.innerHTML = `<div class="higher-lower-loading"><div class="higher-lower-spinner"></div><p>Chargement des Pokémon…</p></div>`;
    return;
  }
  const statMeta = HIGHER_LOWER_STATS.find((s) => s.key === state.statKey) || HIGHER_LOWER_STATS[0];
  const leftSprite = getPokemonSprite(state.left.pokemon);
  const rightSprite = state.right ? getPokemonSprite(state.right.pokemon) : "";
  const isReveal = state.phase === "revealing" || state.phase === "gameover";
  const isRush = state.mode === "rush60";
  const isVersus = state.mode === "versus";
  const versusSelf = isVersus ? state.room?.players?.find((p) => p.isSelf) : null;
  const versusOpp = isVersus ? state.room?.players?.find((p) => !p.isSelf) : null;
  const versusWinner = state.room?.winnerSide || null;
  if (state.phase === "gameover") {
    if (isVersus) {
      const selfSide = versusSelf?.side;
      const selfWon = versusWinner === selfSide;
      const tie = versusWinner === "tie";
      const title = tie ? "🤝 Égalité" : selfWon ? "🏆 Victoire !" : "💀 Défaite";
      const isHost = Boolean(versusSelf?.isHost);
      root.innerHTML = `
        <div class="higher-lower-gameover">
          <h3>${title}</h3>
          <p>Toi <b>${versusSelf?.score ?? state.score}</b> · ${escapeHtml(versusOpp?.nickname || "Adversaire")} <b>${versusOpp?.score ?? 0}</b></p>
          <div class="higher-lower-room-actions">
            ${isHost ? `<button class="btn-red" type="button" data-action="restartHigherLowerVersusMatch">Relancer une partie</button>` : `<p class="card-desc">En attente du restart par l'hôte.</p>`}
            <button class="btn-ghost" type="button" data-action="leaveHigherLowerRoom">Quitter la room</button>
          </div>
        </div>`;
      return;
    }
    const refScore = isRush ? state.rushHighScore : state.highScore;
    const isRecord = state.score > 0 && state.score >= refScore;
    const title = isRush ? "⏱️ Temps écoulé" : "💥 Game over";
    const desc = isRush
      ? `Tu as fait <b>${state.score}</b> bonne${state.score > 1 ? "s" : ""} réponse${state.score > 1 ? "s" : ""} en 60 secondes.`
      : `Tu as fait <b>${state.score}</b> bonne${state.score > 1 ? "s" : ""} réponse${state.score > 1 ? "s" : ""} d'affilée.`;
    root.innerHTML = `
      <div class="higher-lower-gameover">
        <h3>${title}</h3>
        <p>${desc}</p>
        <p class="higher-lower-record">${isRecord ? "🏆 Nouveau record !" : `Record actuel : <b>${refScore}</b>`}</p>
        ${state.right ? `<div class="higher-lower-final-pair">
          <div class="higher-lower-card-mini"><img src="${escapeHtml(leftSprite)}" alt="${escapeHtml(state.left.pokemon.name)}" /><span>${escapeHtml(state.left.pokemon.name)}</span><b>${statMeta.icon} ${state.left.statValue}</b></div>
          <div class="higher-lower-final-vs">VS</div>
          <div class="higher-lower-card-mini ${state.lastCorrect ? "is-correct" : "is-wrong"}"><img src="${escapeHtml(rightSprite)}" alt="${escapeHtml(state.right.pokemon.name)}" /><span>${escapeHtml(state.right.pokemon.name)}</span><b>${statMeta.icon} ${state.right.statValue}</b></div>
        </div>` : ""}
        <div class="higher-lower-final-actions">
          <button class="btn-red" type="button" data-action="restartHigherLowerGame">Rejouer</button>
          <button class="btn-ghost" type="button" data-action="shareHigherLowerResult">📋 Copier</button>
          <button class="btn-ghost" type="button" data-action="downloadHigherLowerImage">💾 Image</button>
        </div>
      </div>`;
    return;
  }
  let scoreHtml;
  if (isVersus) {
    scoreHtml = `<span>Toi : <b>${versusSelf?.score ?? state.score}</b></span><span>${escapeHtml(versusOpp?.nickname || "Adversaire")} : <b>${versusOpp?.score ?? 0}</b></span><span class="higher-lower-rush-timer">⏱️ <b id="higher-lower-timer">${Math.ceil((state.rushLeftMs || 0) / 1000)}s</b></span>`;
  } else if (isRush) {
    scoreHtml = `<span>Score : <b>${state.score}</b></span><span>Record : <b>${state.rushHighScore}</b></span><span class="higher-lower-rush-timer">⏱️ <b id="higher-lower-timer">${Math.ceil((state.rushLeftMs || 0) / 1000)}s</b></span>`;
  } else {
    scoreHtml = `<span>Score : <b>${state.score}</b></span><span>Record : <b>${state.highScore}</b></span>`;
  }
  root.innerHTML = `
    <div class="higher-lower-board">
      <div class="higher-lower-scoreline">${scoreHtml}</div>
      <div class="higher-lower-stat-banner">Stat à comparer : <b>${statMeta.icon} ${escapeHtml(statMeta.label)}</b></div>
      <div class="higher-lower-pair">
        <div class="higher-lower-card-pokemon side-left">
          <img class="higher-lower-sprite" src="${escapeHtml(leftSprite)}" alt="${escapeHtml(state.left.pokemon.name)}" />
          <h4>${escapeHtml(state.left.pokemon.name)}</h4>
          <div class="higher-lower-stat-value"><span>${statMeta.icon} ${escapeHtml(statMeta.label)}</span><b>${state.left.statValue}</b></div>
        </div>
        <div class="higher-lower-vs">VS</div>
        <div class="higher-lower-card-pokemon side-right ${isReveal && state.lastCorrect ? "is-correct" : ""} ${isReveal && state.lastCorrect === false ? "is-wrong" : ""}">
          <img class="higher-lower-sprite" src="${escapeHtml(rightSprite)}" alt="${escapeHtml(state.right.pokemon.name)}" />
          <h4>${escapeHtml(state.right.pokemon.name)}</h4>
          <div class="higher-lower-stat-value"><span>${statMeta.icon} ${escapeHtml(statMeta.label)}</span><b>${isReveal ? state.right.statValue : "?"}</b></div>
        </div>
      </div>
      ${isReveal ? `<p class="higher-lower-feedback ${state.lastCorrect ? "is-correct" : "is-wrong"}">${state.lastCorrect ? "✅ Bien vu !" : "❌ Raté."} ${escapeHtml(state.right.pokemon.name)} a <b>${state.right.statValue}</b> en ${escapeHtml(statMeta.label)}.</p>` : `
        <div class="higher-lower-actions">
          <button class="btn-red higher-lower-btn-higher" type="button" data-action="${isVersus ? "answerHigherLowerVersus" : "answerHigherLower"}" data-args='["higher"]'>▲ Plus haut</button>
          <button class="btn-blue higher-lower-btn-lower" type="button" data-action="${isVersus ? "answerHigherLowerVersus" : "answerHigherLower"}" data-args='["lower"]'>▼ Plus bas</button>
        </div>
      `}
    </div>`;
}

// === HIGHER OR LOWER — Versus 1v1 multi ===
function startHigherLowerVersusFromLobby() {
  if (!higherLowerState) higherLowerState = createHigherLowerState("lobby");
  higherLowerState.mode = "versus";
  higherLowerState.phase = "room";
  higherLowerState.score = 0;
  higherLowerState.roomPairIndex = 0;
  higherLowerState.roomError = null;
  higherLowerState.room = null;
  ensureMultiplayerSocket();
  renderHigherLowerScreen();
}
function syncHigherLowerNickname() {
  const input = document.getElementById("higher-lower-nickname");
  if (input && higherLowerState) higherLowerState.roomNicknameDraft = input.value || "";
}
function syncHigherLowerJoinCode() {
  const input = document.getElementById("higher-lower-room-input");
  if (input && higherLowerState) higherLowerState.roomDraftCode = (input.value || "").toUpperCase();
}
function createHigherLowerRoom() {
  if (!higherLowerState) return;
  const socket = ensureMultiplayerSocket();
  if (!socket) return;
  const nickname = String(higherLowerState.roomNicknameDraft || playerProfile?.nickname || "").trim() || "Dresseur";
  higherLowerState.roomPendingAction = "creating";
  higherLowerState.roomError = null;
  renderHigherLowerScreen();
  socket.emit("higher-lower:create-room", { nickname, selectedGens: [...selectedGens] }, (response = {}) => {
    higherLowerState.roomPendingAction = null;
    if (!response.ok) higherLowerState.roomError = response.error || "Impossible de créer la room.";
    else higherLowerState.room = response.room;
    renderHigherLowerScreen();
  });
}
function joinHigherLowerRoom() {
  if (!higherLowerState) return;
  const socket = ensureMultiplayerSocket();
  if (!socket) return;
  const nickname = String(higherLowerState.roomNicknameDraft || playerProfile?.nickname || "").trim() || "Invité";
  const code = String(higherLowerState.roomDraftCode || "").trim().toUpperCase();
  if (!code) { higherLowerState.roomError = "Entre un code de room."; renderHigherLowerScreen(); return; }
  higherLowerState.roomPendingAction = "joining";
  higherLowerState.roomError = null;
  renderHigherLowerScreen();
  socket.emit("higher-lower:join-room", { nickname, code }, (response = {}) => {
    higherLowerState.roomPendingAction = null;
    if (!response.ok) higherLowerState.roomError = response.error || "Impossible de rejoindre.";
    else higherLowerState.room = response.room;
    renderHigherLowerScreen();
  });
}
function leaveHigherLowerRoom() {
  if (multiplayerSocket?.connected) multiplayerSocket.emit("higher-lower:leave-room");
  if (!higherLowerState) return;
  clearHigherLowerTimeouts();
  higherLowerState.room = null;
  higherLowerState.roomPendingAction = null;
  higherLowerState.roomError = null;
  higherLowerState.phase = "lobby";
  higherLowerState.mode = "lobby";
  higherLowerState.left = null;
  higherLowerState.right = null;
  renderHigherLowerScreen();
}
function startHigherLowerRoomMatch() {
  const socket = ensureMultiplayerSocket();
  if (!socket || !higherLowerState?.room) return;
  higherLowerState.roomPendingAction = "starting";
  renderHigherLowerScreen();
  socket.emit("higher-lower:start-game", { selectedGens: [...selectedGens] }, (response = {}) => {
    higherLowerState.roomPendingAction = null;
    if (!response.ok) {
      higherLowerState.roomError = response.error || "Lancement impossible.";
      renderHigherLowerScreen();
    }
  });
}
function restartHigherLowerVersusMatch() {
  const socket = ensureMultiplayerSocket();
  if (!socket || !higherLowerState?.room) return;
  socket.emit("higher-lower:restart-match", {}, (response = {}) => {
    if (!response.ok) {
      higherLowerState.roomError = response.error || "Restart impossible.";
      renderHigherLowerScreen();
    }
  });
}
function findHigherLowerPokemonById(id) {
  const list = Array.isArray(POKEMON_LIST) ? POKEMON_LIST : [];
  return list.find((p) => Number(p.id) === Number(id));
}
async function loadHigherLowerVersusPair(index) {
  if (!higherLowerState?.room?.sequence) return;
  const pair = higherLowerState.room.sequence[index];
  if (!pair) {
    higherLowerState.phase = "loading";
    renderHigherLowerScreen();
    return;
  }
  const leftPokemon = findHigherLowerPokemonById(pair.leftId);
  const rightPokemon = findHigherLowerPokemonById(pair.rightId);
  if (!leftPokemon || !rightPokemon) {
    higherLowerState.roomPairIndex = index + 1;
    return loadHigherLowerVersusPair(higherLowerState.roomPairIndex);
  }
  higherLowerState.phase = "loading";
  renderHigherLowerScreen();
  const [leftStats, rightStats] = await Promise.all([
    fetchBattleStats(leftPokemon),
    fetchBattleStats(rightPokemon),
  ]);
  if (!higherLowerState || higherLowerState.roomPairIndex !== index) return;
  if (!leftStats || !rightStats) {
    higherLowerState.roomPairIndex = index + 1;
    return loadHigherLowerVersusPair(higherLowerState.roomPairIndex);
  }
  higherLowerState.left = { pokemon: leftPokemon, stats: leftStats, statValue: Number(leftStats[pair.statKey]) || 0 };
  higherLowerState.right = { pokemon: rightPokemon, stats: rightStats, statValue: Number(rightStats[pair.statKey]) || 0 };
  higherLowerState.statKey = pair.statKey;
  higherLowerState.phase = "playing";
  higherLowerState.lastChoice = null;
  higherLowerState.lastCorrect = null;
  renderHigherLowerScreen();
}
function answerHigherLowerVersus(choice) {
  if (!higherLowerState || higherLowerState.phase !== "playing" || higherLowerState.isAnimating) return;
  const leftVal = Number(higherLowerState.left?.statValue) || 0;
  const rightVal = Number(higherLowerState.right?.statValue) || 0;
  let correct;
  if (rightVal === leftVal) correct = true;
  else if (rightVal > leftVal) correct = (choice === "higher");
  else correct = (choice === "lower");
  higherLowerState.lastChoice = choice;
  higherLowerState.lastCorrect = correct;
  higherLowerState.phase = "revealing";
  higherLowerState.isAnimating = true;
  if (correct) higherLowerState.score += 1;
  if (multiplayerSocket?.connected) multiplayerSocket.emit("higher-lower:submit-answer", { choice });
  renderHigherLowerScreen();
  trackHigherLowerTimeout(() => {
    if (!higherLowerState) return;
    higherLowerState.isAnimating = false;
    if (higherLowerState.room?.status !== "live") return;
    higherLowerState.roomPairIndex += 1;
    loadHigherLowerVersusPair(higherLowerState.roomPairIndex);
  }, 900);
}
function applyHigherLowerRoomState(room) {
  if (!higherLowerState) {
    higherLowerState = createHigherLowerState("lobby");
    higherLowerState.mode = "versus";
  }
  const previousStatus = higherLowerState.room?.status || null;
  higherLowerState.room = room;
  if (!room) return;
  if (room.status === "live" && previousStatus !== "live") {
    higherLowerState.mode = "versus";
    higherLowerState.score = 0;
    higherLowerState.roomPairIndex = 0;
    higherLowerState.phase = "loading";
    if (room.endsAt) {
      higherLowerState.rushEndsAt = room.endsAt;
      higherLowerState.rushLeftMs = Math.max(0, room.endsAt - Date.now());
    }
    loadHigherLowerVersusPair(0);
    startHigherLowerRushTimer();
    return;
  }
  if (room.status === "finished") {
    higherLowerState.phase = "gameover";
    clearHigherLowerRushInterval();
    renderHigherLowerScreen();
    return;
  }
  if (room.status === "lobby") {
    higherLowerState.phase = "room";
    higherLowerState.score = 0;
    higherLowerState.roomPairIndex = 0;
    higherLowerState.left = null;
    higherLowerState.right = null;
  }
  renderHigherLowerScreen();
}

// === SPEEDRUN POKÉDEX — devine le maximum de Pokémon en 60s ===
const SPEEDRUN_DURATION_MS = 60000;
let speedrunState = null;
let speedrunTimerId = null;

function createSpeedrunState() {
  return {
    phase: "lobby",
    pool: [],
    currentIndex: 0,
    correct: 0,
    skipped: 0,
    streak: 0,
    bestStreak: 0,
    endsAt: 0,
    leftMs: SPEEDRUN_DURATION_MS,
    history: [],
    highScore: Number(playerProfile?.speedrunHighScore) || 0,
    currentInput: "",
  };
}

const TYPE_COMBO_DURATION_MS = 60000;
let typeComboState = null;
let typeComboTimerId = null;

function typeComboTier(count) {
  const n = Number(count) || 0;
  if (n <= 2) return { tier: "legendaire", label: "Légendaire", points: 200 };
  if (n <= 7) return { tier: "difficile", label: "Difficile", points: 140 };
  if (n <= 19) return { tier: "moyen", label: "Moyen", points: 100 };
  return { tier: "facile", label: "Facile", points: 80 };
}
function typeComboKey(t1, t2) {
  const a = String(t1 || "").trim(), b = String(t2 || t1 || "").trim();
  return [a, b].sort().join("|");
}
function typeComboPool() {
  const list = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []);
  const byId = new Map(list.map((p) => [Number(p.id), p]));
  const out = [];
  for (const p of list) {
    const id = Number(p.id);
    if (!((id > 0 && id < 10000) || id >= 20000)) continue;
    const base = p.baseId ? byId.get(Number(p.baseId)) : null;
    const t1 = p.type1 || (base && base.type1) || null;
    const t2 = Object.prototype.hasOwnProperty.call(p, "type2") ? p.type2 : (base ? base.type2 : null);
    if (!t1) continue;
    out.push({ ref: p, name: p.name, type1: t1, type2: t2 || t1 });
  }
  return out;
}
function buildTypeComboMap(pool) {
  const map = new Map();
  for (const p of pool) {
    const key = typeComboKey(p.type1, p.type2 || p.type1);
    if (!map.has(key)) map.set(key, { key, types: [p.type1, p.type2 || p.type1], matches: [] });
    map.get(key).matches.push(p);
  }
  return Array.from(map.values()).filter((c) => c.matches.length > 0);
}
function typeComboFindMon(name, pool) {
  const n = norm(name);
  if (!n) return null;
  return pool.find((p) => norm(p.name) === n) || null;
}
function createTypeComboState() {
  return { phase: "lobby", score: 0, solved: 0, leftMs: TYPE_COMBO_DURATION_MS, endsAt: 0, combo: null, recent: [], pool: [], combos: [], highScore: Number(playerProfile?.typeComboHighScore) || 0, feedback: "", last: null };
}
function pickTypeComboSolo() {
  const st = typeComboState;
  if (!st || !st.combos.length) return null;
  let cands = st.combos.filter((c) => !st.recent.includes(c.key));
  if (!cands.length) cands = st.combos;
  const picked = cands[Math.floor(Math.random() * cands.length)];
  st.recent = [picked.key].concat(st.recent).slice(0, 8);
  const displayTypes = picked.types.slice();
  if (displayTypes[0] !== displayTypes[1] && Math.random() < 0.5) displayTypes.reverse();
  return { key: picked.key, types: picked.types, displayTypes, count: picked.matches.length, tier: typeComboTier(picked.matches.length) };
}
function openTypeComboSolo() {
  const pool = typeComboPool();
  if (pool.length < 30) return showToast("Pool Pokémon insuffisant.");
  goToConfig();
  hideExtraScreens();
  hideScreen("screen-config");
  hideScreen("screen-game");
  showScreen("screen-type-combo");
  setGlobalNavActive("game");
  gameMode = "typeCombo";
  typeComboState = createTypeComboState();
  renderTypeComboScreen();
}
function startTypeComboGame() {
  try { trackUsage("solo:typecombo"); } catch (e) {}
  if (!typeComboState) typeComboState = createTypeComboState();
  const st = typeComboState;
  st.pool = typeComboPool();
  st.combos = buildTypeComboMap(st.pool);
  st.score = 0; st.solved = 0; st.recent = []; st.feedback = ""; st.last = null;
  st.endsAt = Date.now() + TYPE_COMBO_DURATION_MS;
  st.leftMs = TYPE_COMBO_DURATION_MS;
  st.phase = "playing";
  st.combo = pickTypeComboSolo();
  renderTypeComboScreen();
  if (typeComboTimerId) clearInterval(typeComboTimerId);
  typeComboTimerId = setInterval(() => {
    if (!typeComboState || typeComboState.phase !== "playing") return clearInterval(typeComboTimerId);
    typeComboState.leftMs = Math.max(0, typeComboState.endsAt - Date.now());
    const t = document.getElementById("type-combo-timer");
    if (t) t.textContent = Math.ceil(typeComboState.leftMs / 1000) + "s";
    if (typeComboState.leftMs <= 0) { clearInterval(typeComboTimerId); finalizeTypeComboGame(); }
  }, 100);
  setTimeout(() => { const i = document.getElementById("type-combo-input"); if (i) i.focus(); }, 100);
}
function restartTypeComboGame() { typeComboState = createTypeComboState(); startTypeComboGame(); }
function typeComboNextCombo() {
  const st = typeComboState; if (!st) return;
  st.combo = pickTypeComboSolo();
  const input = document.getElementById("type-combo-input");
  if (input) input.value = "";
  renderTypeComboScreen();
  setTimeout(() => { const i = document.getElementById("type-combo-input"); if (i) i.focus(); }, 40);
}
function typeComboSubmitGuess() {
  const st = typeComboState;
  if (!st || st.phase !== "playing" || !st.combo) return;
  const input = document.getElementById("type-combo-input");
  const guess = input ? String(input.value || "").trim() : "";
  if (!guess) { typeComboSkip(); return; }
  let mon = typeComboFindMon(guess, st.pool);
  if (!mon) { const __q = norm(guess); if (__q) mon = st.pool.find((p) => norm(p.name).indexOf(__q) === 0) || st.pool.find((p) => norm(p.name).indexOf(__q) >= 0) || null; }
  const ok = mon && typeComboKey(mon.type1, mon.type2 || mon.type1) === st.combo.key;
  if (ok) {
    const pts = st.combo.tier.points;
    st.score += pts;
    st.solved += 1;
    st.last = { name: mon.name, pts: pts, label: st.combo.tier.label };
    st.feedback = "";
    try { awardXp(6, "Combo de types"); } catch (e) {}
    typeComboNextCombo();
  } else {
    st.feedback = mon ? (escapeHtml(mon.name) + " n'a pas cette paire de types") : "Pokémon inconnu";
    if (input) { input.classList.add("is-wrong"); setTimeout(() => input.classList.remove("is-wrong"), 280); }
    const fb = document.getElementById("type-combo-feedback");
    if (fb) fb.textContent = st.feedback;
  }
}
function typeComboSkip() {
  const st = typeComboState; if (!st || st.phase !== "playing") return;
  st.last = null; st.feedback = "";
  typeComboNextCombo();
}
function typeComboFormSubmit(ev) { if (ev && ev.preventDefault) ev.preventDefault(); typeComboSubmitGuess(); }
let typeComboAcIndex = -1;
function typeComboInput() {
  const st = typeComboState;
  const list = document.getElementById("type-combo-ac");
  const input = document.getElementById("type-combo-input");
  if (!st || !list || !input) return;
  const q = norm(String(input.value || "").trim());
  if (!q) { list.innerHTML = ""; list.classList.remove("is-open"); return; }
  const seen = {}; const starts = []; const contains = [];
  for (const p of st.pool) {
    const n = norm(p.name);
    if (seen[n]) continue;
    const i = n.indexOf(q);
    if (i === 0) { seen[n] = 1; starts.push(p); }
    else if (i > 0) { seen[n] = 1; contains.push(p); }
  }
  const matches = starts.concat(contains).slice(0, 8);
  if (!matches.length) { list.innerHTML = ""; list.classList.remove("is-open"); return; }
  list.innerHTML = matches.map((p) => '<button type="button" class="tc-ac-item" data-action="typeComboPick" data-name="' + escapeHtml(String(p.name).replace(/"/g, "&quot;")) + '" data-args=\'["' + String(p.name).replace(/["\\]/g, "") + '"]\'><img class="tc-ac-sprite" src="' + escapeHtml(getPokemonSprite(p.ref || p)) + '" alt="" loading="lazy" />' + escapeHtml(p.name) + '</button>').join("");
  typeComboAcIndex = -1;
  list.classList.add("is-open");
}
function typeComboKeydown(e) {
  const list = document.getElementById("type-combo-ac");
  if (!list) return;
  const items = list.querySelectorAll(".tc-ac-item");
  if (e.key === "ArrowDown") {
    if (!items.length) return;
    e.preventDefault();
    typeComboAcIndex = Math.min(typeComboAcIndex + 1, items.length - 1);
    items.forEach((it, i) => { const on = i === typeComboAcIndex; it.classList.toggle("is-active", on); if (on) it.scrollIntoView({ block: "nearest" }); });
  } else if (e.key === "ArrowUp") {
    if (!items.length) return;
    e.preventDefault();
    typeComboAcIndex = Math.max(typeComboAcIndex - 1, -1);
    items.forEach((it, i) => it.classList.toggle("is-active", i === typeComboAcIndex));
  } else if (e.key === "Enter") {
    if (typeComboAcIndex >= 0 && items[typeComboAcIndex]) {
      e.preventDefault();
      typeComboPick(items[typeComboAcIndex].getAttribute("data-name") || "");
    }
  } else if (e.key === "Escape") {
    list.classList.remove("is-open");
    list.innerHTML = "";
    typeComboAcIndex = -1;
  }
}
function typeComboPick(name) {
  const input = document.getElementById("type-combo-input");
  if (input) input.value = name;
  const list = document.getElementById("type-combo-ac");
  if (list) { list.innerHTML = ""; list.classList.remove("is-open"); }
  typeComboSubmitGuess();
}
function finalizeTypeComboGame() {
  const st = typeComboState; if (!st) return;
  st.phase = "gameover";
  const isRecord = st.score > 0 && st.score >= st.highScore;
  if (isRecord && playerProfile) {
    playerProfile.typeComboHighScore = st.score;
    st.highScore = st.score;
    try { saveProfile(); } catch (e) {}
    try { awardXp(50, "Record Combo de types"); } catch (e) {}
  }
  renderTypeComboScreen();
}
function renderTypeComboScreen() {
  const root = document.getElementById("type-combo-root");
  if (!root) return;
  const st = typeComboState;
  if (!st) { root.innerHTML = ""; return; }
  if (st.phase === "lobby") {
    root.innerHTML =
      '<div class="tc-lobby">' +
        '<div class="tc-lobby-icon">🧬</div>' +
        '<h3>Combo de types — 60 secondes</h3>' +
        '<p>On t\'affiche une paire de types. Nomme un Pokémon qui a exactement cette paire pour marquer. Plus la paire est rare, plus ça rapporte. Enchaîne un max de combos !</p>' +
        '<div class="tc-lobby-stats"><div class="tc-lobby-stat"><span>Ton record</span><b>' + (st.highScore || 0) + '</b></div><div class="tc-lobby-stat"><span>Durée</span><b>60s</b></div></div>' +
        '<button class="btn-red tc-start-btn" type="button" data-action="startTypeComboGame">🧬 Démarrer</button>' +
      '</div>';
    return;
  }
  if (st.phase === "playing") {
    const c = st.combo;
    const badges = c ? c.displayTypes.map((t) => typeBadgeHtml(t)).join('<span class="tc-plus">+</span>') : "";
    const lastHtml = st.last ? ('<div class="tc-last">✅ ' + escapeHtml(st.last.name) + ' <b>+' + st.last.pts + '</b> <small>' + escapeHtml(st.last.label) + '</small></div>') : "";
    root.innerHTML =
      '<div class="tc-board">' +
        '<div class="tc-status">' +
          '<div class="tc-chip"><span>Score</span><b>' + st.score + '</b></div>' +
          '<div class="tc-chip"><span>Combos</span><b>' + st.solved + '</b></div>' +
          '<div class="tc-chip is-timer">⏱️ <b id="type-combo-timer">' + Math.ceil(st.leftMs / 1000) + 's</b></div>' +
        '</div>' +
        '<div class="tc-combo">' +
          '<div class="tc-combo-label">Trouve un Pokémon de type</div>' +
          '<div class="tc-combo-types">' + badges + '</div>' +
          '<div class="tc-combo-tier tc-tier-' + (c ? c.tier.tier : "") + '">' + (c ? c.tier.label : "") + ' · ' + (c ? c.tier.points : 0) + ' pts</div>' +
        '</div>' +
        '<form class="tc-form" data-submit-action="typeComboFormSubmit">' +
          '<input id="type-combo-input" class="tc-input" type="text" placeholder="Nom d\'un Pokémon..." autocomplete="off" autocorrect="off" spellcheck="false" data-input-action="typeComboInput" data-keydown-action="typeComboKeydown" autofocus />' +
          '<div class="tc-ac" id="type-combo-ac"></div>' +
          '<div class="tc-actions"><button class="btn-red" type="submit">Valider</button><button class="btn-ghost" type="button" data-action="typeComboSkip">Passer ⏭</button></div>' +
        '</form>' +
        '<p class="tc-feedback" id="type-combo-feedback"></p>' +
        lastHtml +
      '</div>';
    return;
  }
  if (st.phase === "gameover") {
    const isRecord = st.score > 0 && st.score >= st.highScore;
    root.innerHTML =
      '<div class="tc-gameover">' +
        '<h3>⏱️ Temps écoulé</h3>' +
        '<div class="tc-final-score">' + st.score + '</div>' +
        '<p>' + st.solved + ' combos réussis' + (isRecord ? ' · <b>🏆 Nouveau record !</b>' : (' · record : ' + st.highScore)) + '</p>' +
        '<div class="tc-actions"><button class="btn-red" type="button" data-action="startTypeComboGame">🔁 Rejouer</button><button class="btn-ghost" type="button" data-action="goToConfig">← Retour</button></div>' +
      '</div>';
    return;
  }
}
function openSpeedrunMode() {
  const pool = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).filter((p) => Number(p.id) < 10000 && p.sprite);
  if (pool.length < 30) return showToast("Pool Pokémon insuffisant pour Speedrun.");
  goToConfig();
  hideExtraScreens();
  hideScreen("screen-config");
  hideScreen("screen-game");
  showScreen("screen-speedrun");
  setGlobalNavActive("game");
  gameMode = "speedrun";
  speedrunState = createSpeedrunState();
  renderSpeedrunScreen();
}

function startSpeedrunGame() {
  trackUsage("solo:speedrun");
  if (!speedrunState) return;
  const pool = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).filter((p) => Number(p.id) < 10000 && p.sprite);
  speedrunState.pool = pool.slice().sort(() => Math.random() - 0.5);
  speedrunState.currentIndex = 0;
  speedrunState.correct = 0;
  speedrunState.skipped = 0;
  speedrunState.streak = 0;
  speedrunState.bestStreak = 0;
  speedrunState.history = [];
  speedrunState.endsAt = Date.now() + SPEEDRUN_DURATION_MS;
  speedrunState.leftMs = SPEEDRUN_DURATION_MS;
  speedrunState.phase = "playing";
  speedrunState.currentInput = "";
  renderSpeedrunScreen();
  if (speedrunTimerId) clearInterval(speedrunTimerId);
  speedrunTimerId = setInterval(() => {
    if (!speedrunState || speedrunState.phase !== "playing") return clearInterval(speedrunTimerId);
    speedrunState.leftMs = Math.max(0, speedrunState.endsAt - Date.now());
    const timerEl = document.getElementById("speedrun-timer");
    if (timerEl) timerEl.textContent = `${Math.ceil(speedrunState.leftMs / 1000)}s`;
    if (speedrunState.leftMs <= 0) {
      clearInterval(speedrunTimerId);
      finalizeSpeedrunGame();
    }
  }, 100);
  // Focus l'input après render
  setTimeout(() => document.getElementById("speedrun-input")?.focus(), 100);
}

function speedrunNormalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

function speedrunSubmitGuess() {
  if (!speedrunState || speedrunState.phase !== "playing") return;
  const input = document.getElementById("speedrun-input");
  const guess = speedrunNormalize(input?.value || "");
  if (!guess) return;
  const target = speedrunState.pool[speedrunState.currentIndex];
  if (!target) return;
  const targetNorm = speedrunNormalize(target.name);
  if (guess === targetNorm) {
    speedrunState.correct += 1;
    speedrunState.streak += 1;
    if (speedrunState.streak > speedrunState.bestStreak) speedrunState.bestStreak = speedrunState.streak;
    speedrunState.history.push({ id: target.id, name: target.name, correct: true });
    awardXp(5, "Speedrun Pokédex");
    speedrunState.currentIndex += 1;
    if (input) input.value = "";
    speedrunState.currentInput = "";
    renderSpeedrunScreen();
    setTimeout(() => document.getElementById("speedrun-input")?.focus(), 50);
  } else {
    // Wrong guess: flash input
    if (input) {
      input.classList.add("is-wrong");
      setTimeout(() => input.classList.remove("is-wrong"), 280);
    }
    speedrunState.streak = 0;
  }
}

function speedrunSkip() {
  if (!speedrunState || speedrunState.phase !== "playing") return;
  const target = speedrunState.pool[speedrunState.currentIndex];
  if (target) speedrunState.history.push({ id: target.id, name: target.name, correct: false });
  speedrunState.skipped += 1;
  speedrunState.streak = 0;
  speedrunState.currentIndex += 1;
  const input = document.getElementById("speedrun-input");
  if (input) input.value = "";
  speedrunState.currentInput = "";
  renderSpeedrunScreen();
  setTimeout(() => document.getElementById("speedrun-input")?.focus(), 50);
}

function finalizeSpeedrunGame() {
  if (!speedrunState) return;
  speedrunState.phase = "gameover";
  const isRecord = speedrunState.correct > speedrunState.highScore;
  if (isRecord && playerProfile) {
    playerProfile.speedrunHighScore = speedrunState.correct;
    speedrunState.highScore = speedrunState.correct;
    try { saveProfile(); } catch (_e) {}
    awardXp(50, "Nouveau record Speedrun");
  }
  // XP global selon score
  if (speedrunState.correct >= 10) awardXp(speedrunState.correct * 3, `Speedrun ${speedrunState.correct} Pokémon`);
  try {
    recordMatchHistory({
      mode: "speedrun",
      result: speedrunState.correct >= 10 ? "win" : "loss",
      attempts: speedrunState.correct,
      targetName: `${speedrunState.correct} Pokémon`,
    });
  } catch (_e) {}
  renderSpeedrunScreen();
  notifyPartyRoundFromScreenMode(speedrunState.correct >= 10, `${speedrunState.correct} Pokémon en 60 s`);
}

function restartSpeedrunGame() {
  if (speedrunTimerId) clearInterval(speedrunTimerId);
  speedrunState = createSpeedrunState();
  renderSpeedrunScreen();
}

function shareSpeedrunResult() {
  if (!speedrunState) return;
  const xp = Number(playerProfile?.xp) || 0;
  const tier = getXpTier(xp);
  const text = `⚡ Speedrun Pokédex : ${speedrunState.correct} Pokémon en 60s (best streak ${speedrunState.bestStreak})
${tier.emoji} Niveau ${tier.level} · ${tier.name}
👉 https://pokdle.onrender.com`;
  copyShareText(text);
}

function downloadSpeedrunImage() {
  if (!speedrunState) return;
  const xp = Number(playerProfile?.xp) || 0;
  const tier = getXpTier(xp);
  downloadScoreImage(`pokedle-speedrun-${speedrunState.correct}.png`, {
    title: "Speedrun Pokédex 60s",
    mainScore: speedrunState.correct,
    mainLabel: `Pokémon devinés · best streak ${speedrunState.bestStreak}`,
    subtitle: `${tier.emoji} Niv. ${tier.level} · ${tier.name}`,
  });
}

window.openSpeedrunMode = openSpeedrunMode;
window.startSpeedrunGame = startSpeedrunGame;
window.speedrunSubmitGuess = speedrunSubmitGuess;
window.speedrunSkip = speedrunSkip;
window.restartSpeedrunGame = restartSpeedrunGame;
window.shareSpeedrunResult = shareSpeedrunResult;
window.downloadSpeedrunImage = downloadSpeedrunImage;

function renderSpeedrunScreen() {
  const root = document.getElementById("speedrun-root");
  if (!root) return;
  const state = speedrunState;
  if (!state) { root.innerHTML = ""; return; }
  if (state.phase === "lobby") {
    root.innerHTML = `
      <div class="speedrun-lobby">
        <div class="speedrun-lobby-icon">⚡</div>
        <h3>Prêt pour 60 secondes intenses ?</h3>
        <p>Tu vois le sprite du Pokémon, tu tapes son nom (accent et casse ignorés). Si tu sèches, "Passer" (Entrée vide).</p>
        <div class="speedrun-lobby-stats">
          <div class="speedrun-lobby-stat"><span>Ton record</span><b>${state.highScore || 0}</b></div>
          <div class="speedrun-lobby-stat"><span>Durée</span><b>60s</b></div>
        </div>
        <button class="btn-red speedrun-start-btn" type="button" data-action="startSpeedrunGame">⚡ Démarrer</button>
      </div>`;
    return;
  }
  if (state.phase === "playing") {
    const current = state.pool[state.currentIndex];
    const sprite = current ? getPokemonSprite(current) : "";
    root.innerHTML = `
      <div class="speedrun-board">
        <div class="speedrun-status">
          <div class="speedrun-stat-chip"><span>Trouvés</span><b>${state.correct}</b></div>
          <div class="speedrun-stat-chip is-streak"><span>Streak</span><b>${state.streak}</b></div>
          <div class="speedrun-stat-chip"><span>Passés</span><b>${state.skipped}</b></div>
          <div class="speedrun-stat-chip is-timer">⏱️ <b id="speedrun-timer">${Math.ceil(state.leftMs / 1000)}s</b></div>
        </div>
        <div class="speedrun-pokemon">
          <img class="speedrun-sprite" src="${escapeHtml(sprite)}" alt="?" />
        </div>
        <form class="speedrun-form" data-submit-action="speedrunFormSubmit">
          <input id="speedrun-input" class="speedrun-input" type="text" placeholder="Nom du Pokémon..." autocomplete="off" autocorrect="off" spellcheck="false" autofocus />
          <div class="speedrun-actions">
            <button class="btn-red" type="submit">Valider</button>
            <button class="btn-ghost" type="button" data-action="speedrunSkip">Passer ⏭</button>
          </div>
        </form>
        <p class="speedrun-hint">💡 Astuce : Entrée pour valider, Entrée vide pour passer</p>
      </div>`;
    return;
  }
  if (state.phase === "gameover") {
    const isRecord = state.correct > 0 && state.correct >= state.highScore;
    root.innerHTML = `
      <div class="speedrun-gameover">
        <h3>⏱️ Temps écoulé</h3>
        <div class="speedrun-final-score">${state.correct}</div>
        <p class="speedrun-final-label">Pokémon devinés en 60s</p>
        <div class="speedrun-final-stats">
          <div><span>Meilleur streak</span><b>${state.bestStreak}</b></div>
          <div><span>Passés</span><b>${state.skipped}</b></div>
          <div><span>Record perso</span><b>${state.highScore}</b></div>
        </div>
        ${isRecord ? '<div class="speedrun-record-flash">🏆 NOUVEAU RECORD !</div>' : ""}
        <div class="higher-lower-final-actions">
          <button class="btn-red" type="button" data-action="restartSpeedrunGame">Rejouer</button>
          <button class="btn-ghost" type="button" data-action="shareSpeedrunResult">📋 Copier</button>
          <button class="btn-ghost" type="button" data-action="downloadSpeedrunImage">💾 Image</button>
        </div>
      </div>`;
    return;
  }
}

// === POKÉ-CONNECTIONS — mode solo (style NYT Connections) ===
const POKE_CONNECTIONS_CATEGORIES = ["type", "gen", "habitat", "color", "stage"];
const POKE_CONNECTIONS_GROUP_COLORS = ["yellow", "green", "blue", "purple"];
const POKE_CONNECTIONS_MAX_MISTAKES = 4;
let pokeConnectionsState = null;

function pokeConnectionsGetThemeLabel(category, value) {
  if (category === "type") return `Type ${value}`;
  if (category === "gen") {
    const labelGen = (typeof GENERATIONS === "object" && GENERATIONS?.[value]?.label) ? ` (${GENERATIONS[value].label})` : "";
    return `Génération ${value}${labelGen}`;
  }
  if (category === "habitat") return `Habitat : ${value}`;
  if (category === "color") return `Couleur : ${value}`;
  if (category === "stage") {
    if (value === 1) return "Stade 1 (forme initiale)";
    if (value === 2) return "Stade 2 (intermédiaire)";
    if (value === 3) return "Stade 3 (forme finale)";
    return `Stade ${value}`;
  }
  return `${category} : ${value}`;
}

function pokeConnectionsMatchValue(pokemon, category, value) {
  if (category === "type") return pokemon.type1 === value || pokemon.type2 === value;
  if (category === "gen") return Number(pokemon.gen || pokemon.generation) === Number(value);
  if (category === "habitat") return pokemon.habitat === value;
  if (category === "color") return pokemon.color === value;
  if (category === "stage") return Number(pokemon.stage) === Number(value);
  return false;
}

function pokeConnectionsCountValues(pool, category) {
  const counts = new Map();
  for (const p of pool) {
    let values = [];
    if (category === "type") {
      if (p.type1) values.push(p.type1);
      if (p.type2 && p.type2 !== p.type1) values.push(p.type2);
    } else if (category === "gen") values.push(Number(p.gen || p.generation));
    else if (category === "habitat" && p.habitat) values.push(p.habitat);
    else if (category === "color" && p.color) values.push(p.color);
    else if (category === "stage" && p.stage) values.push(Number(p.stage));
    for (const v of values) {
      if (v === undefined || v === null || v === "") continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
  }
  return counts;
}

function generatePokeConnectionsPuzzle() {
  const all = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).filter((p) => Number(p.id) < 10000);
  if (all.length < 16) return null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const categories = shuffleArray(POKE_CONNECTIONS_CATEGORIES.slice()).slice(0, 4);
    const groups = [];
    const usedIds = new Set();
    let ok = true;
    for (const cat of categories) {
      const counts = pokeConnectionsCountValues(all.filter((p) => !usedIds.has(p.id)), cat);
      const candidates = [...counts.entries()].filter(([, c]) => c >= 4);
      if (!candidates.length) { ok = false; break; }
      const [value] = candidates[Math.floor(Math.random() * candidates.length)];
      const pool = all.filter((p) => !usedIds.has(p.id) && pokeConnectionsMatchValue(p, cat, value));
      if (pool.length < 4) { ok = false; break; }
      const picks = shuffleArray(pool.slice()).slice(0, 4);
      for (const p of picks) usedIds.add(p.id);
      groups.push({ category: cat, value, label: pokeConnectionsGetThemeLabel(cat, value), pokemon: picks });
    }
    if (!ok || groups.length !== 4) continue;
    const tiles = shuffleArray(groups.flatMap((g, idx) => g.pokemon.map((p) => ({ id: p.id, name: p.name, sprite: p.sprite, groupIdx: idx }))));
    return { groups, tiles };
  }
  return null;
}

function openPokeConnectionsMode() {
  trackUsage("solo:connections");
  const puzzle = generatePokeConnectionsPuzzle();
  if (!puzzle) return showToast("Impossible de générer un puzzle Poké-Connections.");
  goToConfig();
  hideExtraScreens();
  hideScreen("screen-config");
  hideScreen("screen-game");
  showScreen("screen-poke-connections");
  setGlobalNavActive("game");
  gameMode = "poke-connections";
  pokeConnectionsState = {
    puzzle,
    selected: new Set(),
    foundGroupIdx: new Set(),
    mistakes: 0,
    phase: "playing",
    lastShake: 0,
  };
  renderPokeConnectionsScreen();
}

function restartPokeConnectionsGame() {
  openPokeConnectionsMode();
}

function togglePokeConnectionsTile(tileIndex) {
  if (!pokeConnectionsState || pokeConnectionsState.phase !== "playing") return;
  const tile = pokeConnectionsState.puzzle.tiles[tileIndex];
  if (!tile || pokeConnectionsState.foundGroupIdx.has(tile.groupIdx)) return;
  if (pokeConnectionsState.selected.has(tileIndex)) {
    pokeConnectionsState.selected.delete(tileIndex);
  } else {
    if (pokeConnectionsState.selected.size >= 4) return;
    pokeConnectionsState.selected.add(tileIndex);
  }
  renderPokeConnectionsScreen();
}

function shufflePokeConnectionsTiles() {
  if (!pokeConnectionsState || pokeConnectionsState.phase !== "playing") return;
  const unfound = pokeConnectionsState.puzzle.tiles
    .map((t, idx) => ({ t, idx }))
    .filter(({ t }) => !pokeConnectionsState.foundGroupIdx.has(t.groupIdx));
  const shuffled = shuffleArray(unfound.slice());
  const newTiles = pokeConnectionsState.puzzle.tiles.slice();
  let si = 0;
  for (let i = 0; i < newTiles.length; i++) {
    if (!pokeConnectionsState.foundGroupIdx.has(newTiles[i].groupIdx)) {
      newTiles[i] = shuffled[si].t;
      si += 1;
    }
  }
  pokeConnectionsState.puzzle.tiles = newTiles;
  pokeConnectionsState.selected = new Set();
  renderPokeConnectionsScreen();
}

function clearPokeConnectionsSelection() {
  if (!pokeConnectionsState) return;
  pokeConnectionsState.selected = new Set();
  renderPokeConnectionsScreen();
}

function submitPokeConnectionsGuess() {
  if (!pokeConnectionsState || pokeConnectionsState.phase !== "playing") return;
  if (pokeConnectionsState.selected.size !== 4) return;
  const tiles = pokeConnectionsState.puzzle.tiles;
  const selectedIdxs = [...pokeConnectionsState.selected];
  const groupIdxs = selectedIdxs.map((i) => tiles[i].groupIdx);
  const allSame = groupIdxs.every((g) => g === groupIdxs[0]);
  if (allSame) {
    pokeConnectionsState.foundGroupIdx.add(groupIdxs[0]);
    pokeConnectionsState.selected = new Set();
    if (pokeConnectionsState.foundGroupIdx.size === 4) {
      pokeConnectionsState.phase = "won";
      awardXp(100, "Poké-Connections résolu");
      progressQuest("connections_clear", 1);
      try {
        recordMatchHistory({ mode: "poke-connections", result: "win", attempts: 4 - pokeConnectionsState.mistakes, targetName: `${pokeConnectionsState.mistakes} erreur${pokeConnectionsState.mistakes > 1 ? "s" : ""}` });
      } catch (_e) {}
      notifyPartyRoundFromScreenMode(true, "puzzle résolu");
    }
  } else {
    pokeConnectionsState.mistakes += 1;
    pokeConnectionsState.lastShake = Date.now();
    if (pokeConnectionsState.mistakes >= POKE_CONNECTIONS_MAX_MISTAKES) {
      pokeConnectionsState.phase = "lost";
      try {
        recordMatchHistory({ mode: "poke-connections", result: "loss", attempts: pokeConnectionsState.foundGroupIdx.size, targetName: `${pokeConnectionsState.foundGroupIdx.size}/4 groupes` });
      } catch (_e) {}
      notifyPartyRoundFromScreenMode(false, `${pokeConnectionsState.foundGroupIdx.size}/4 groupes`);
    }
  }
  renderPokeConnectionsScreen();
}

function renderPokeConnectionsScreen() {
  const root = document.getElementById("poke-connections-root");
  if (!root) return;
  const state = pokeConnectionsState;
  if (!state) { root.innerHTML = ""; return; }
  const { puzzle, foundGroupIdx, selected, mistakes, phase } = state;
  const foundGroupsHtml = [...foundGroupIdx]
    .map((idx) => {
      const g = puzzle.groups[idx];
      const color = POKE_CONNECTIONS_GROUP_COLORS[idx];
      return `<div class="poke-connections-found-row group-${color}">
        <div class="poke-connections-found-label">${escapeHtml(g.label)}</div>
        <div class="poke-connections-found-list">${g.pokemon.map((p) => escapeHtml(p.name)).join(" · ")}</div>
      </div>`;
    })
    .join("");
  const tilesHtml = puzzle.tiles
    .map((t, idx) => {
      if (foundGroupIdx.has(t.groupIdx)) return "";
      const isSelected = selected.has(idx);
      return `<button type="button" class="poke-connections-tile ${isSelected ? "is-selected" : ""}" data-action="togglePokeConnectionsTile" data-args='[${idx}]'>
        <img src="${escapeHtml(t.sprite || "")}" alt="${escapeHtml(t.name)}" loading="lazy" />
        <span>${escapeHtml(t.name)}</span>
      </button>`;
    })
    .join("");
  const mistakeDots = Array.from({ length: POKE_CONNECTIONS_MAX_MISTAKES }, (_, i) => `<span class="poke-connections-mistake-dot ${i < mistakes ? "is-used" : ""}"></span>`).join("");
  const shakeClass = (Date.now() - state.lastShake < 700) ? "is-shaking" : "";
  let footer = "";
  if (phase === "won") {
    footer = `<div class="poke-connections-final is-won"><h3>🎉 Bravo !</h3><p>Tous les groupes trouvés en ${mistakes} erreur${mistakes > 1 ? "s" : ""}.</p><button class="btn-red" type="button" data-action="restartPokeConnectionsGame">Nouveau puzzle</button></div>`;
  } else if (phase === "lost") {
    const remainingGroups = puzzle.groups
      .map((g, idx) => ({ g, idx }))
      .filter(({ idx }) => !foundGroupIdx.has(idx))
      .map(({ g, idx }) => `<div class="poke-connections-found-row group-${POKE_CONNECTIONS_GROUP_COLORS[idx]}"><div class="poke-connections-found-label">${escapeHtml(g.label)}</div><div class="poke-connections-found-list">${g.pokemon.map((p) => escapeHtml(p.name)).join(" · ")}</div></div>`)
      .join("");
    footer = `<div class="poke-connections-final is-lost"><h3>💀 Perdu</h3><p>Tu as épuisé tes 4 erreurs.</p>${remainingGroups ? `<div class="poke-connections-reveal-groups">${remainingGroups}</div>` : ""}<button class="btn-red" type="button" data-action="restartPokeConnectionsGame">Nouveau puzzle</button></div>`;
  } else {
    footer = `<div class="poke-connections-actions">
      <button class="btn-ghost" type="button" data-action="shufflePokeConnectionsTiles">🔀 Mélanger</button>
      <button class="btn-ghost" type="button" data-action="clearPokeConnectionsSelection" ${selected.size === 0 ? "disabled" : ""}>Désélectionner tout</button>
      <button class="btn-red" type="button" data-action="submitPokeConnectionsGuess" ${selected.size !== 4 ? "disabled" : ""}>Valider</button>
    </div>`;
  }
  root.innerHTML = `
    <div class="poke-connections-board">
      <div class="poke-connections-status">
        <span>Erreurs : <span class="poke-connections-mistake-dots">${mistakeDots}</span></span>
        <span>Groupes trouvés : <b>${foundGroupIdx.size}/4</b></span>
      </div>
      ${foundGroupsHtml ? `<div class="poke-connections-found">${foundGroupsHtml}</div>` : ""}
      <div class="poke-connections-grid ${shakeClass}">${tilesHtml}</div>
      ${footer}
    </div>`;
}

// === STAT AUCTION — 1v1 multi ===
const STAT_AUCTION_STATS = [
  { key: "hp", label: "PV", icon: "❤️" },
  { key: "attack", label: "Attaque", icon: "⚔️" },
  { key: "defense", label: "Défense", icon: "🛡️" },
  { key: "spAttack", label: "Atk. Spé.", icon: "✨" },
  { key: "spDefense", label: "Déf. Spé.", icon: "🪄" },
  { key: "speed", label: "Vitesse", icon: "💨" },
];
const STAT_AUCTION_TOTAL = 100;
let statAuctionState = null;

function createStatAuctionState() {
  return {
    phase: "room",
    room: null,
    roomDraftCode: "",
    roomNicknameDraft: String(playerProfile?.nickname || "").trim(),
    roomPendingAction: null,
    roomError: null,
    allocation: STAT_AUCTION_STATS.reduce((acc, s) => { acc[s.key] = 0; return acc; }, {}),
    currentPokemon: null,
    currentStats: null,
    submitted: false,
    lastReveal: null,
  };
}

function openStatAuctionMode() {
  goToConfig();
  hideExtraScreens();
  hideScreen("screen-config");
  hideScreen("screen-game");
  showScreen("screen-stat-auction");
  setGlobalNavActive("game");
  gameMode = "stat-auction";
  statAuctionState = createStatAuctionState();
  ensureMultiplayerSocket();
  renderStatAuctionScreen();
}

function syncStatAuctionNickname() {
  const input = document.getElementById("stat-auction-nickname");
  if (input && statAuctionState) statAuctionState.roomNicknameDraft = input.value || "";
}
function syncStatAuctionJoinCode() {
  const input = document.getElementById("stat-auction-room-input");
  if (input && statAuctionState) statAuctionState.roomDraftCode = (input.value || "").toUpperCase();
}
function createStatAuctionRoom() {
  if (!statAuctionState) return;
  const socket = ensureMultiplayerSocket();
  if (!socket) return;
  const nickname = String(statAuctionState.roomNicknameDraft || playerProfile?.nickname || "").trim() || "Dresseur";
  statAuctionState.roomPendingAction = "creating";
  statAuctionState.roomError = null;
  renderStatAuctionScreen();
  socket.emit("stat-auction:create-room", { nickname, selectedGens: [...selectedGens] }, (response = {}) => {
    statAuctionState.roomPendingAction = null;
    if (!response.ok) statAuctionState.roomError = response.error || "Création impossible.";
    else statAuctionState.room = response.room;
    renderStatAuctionScreen();
  });
}
function joinStatAuctionRoom() {
  if (!statAuctionState) return;
  const socket = ensureMultiplayerSocket();
  if (!socket) return;
  const nickname = String(statAuctionState.roomNicknameDraft || playerProfile?.nickname || "").trim() || "Invité";
  const code = String(statAuctionState.roomDraftCode || "").trim().toUpperCase();
  if (!code) { statAuctionState.roomError = "Entre un code de room."; renderStatAuctionScreen(); return; }
  statAuctionState.roomPendingAction = "joining";
  statAuctionState.roomError = null;
  renderStatAuctionScreen();
  socket.emit("stat-auction:join-room", { nickname, code }, (response = {}) => {
    statAuctionState.roomPendingAction = null;
    if (!response.ok) statAuctionState.roomError = response.error || "Join impossible.";
    else statAuctionState.room = response.room;
    renderStatAuctionScreen();
  });
}
function leaveStatAuctionRoom() {
  if (multiplayerSocket?.connected) multiplayerSocket.emit("stat-auction:leave-room");
  if (!statAuctionState) return;
  statAuctionState.room = null;
  statAuctionState.roomPendingAction = null;
  statAuctionState.roomError = null;
  statAuctionState.phase = "room";
  statAuctionState.currentPokemon = null;
  statAuctionState.currentStats = null;
  statAuctionState.submitted = false;
  renderStatAuctionScreen();
}
function startStatAuctionMatch() {
  trackUsage("solo:statauction");
  const socket = ensureMultiplayerSocket();
  if (!socket) return;
  statAuctionState.roomPendingAction = "starting";
  renderStatAuctionScreen();
  socket.emit("stat-auction:start-game", { selectedGens: [...selectedGens] }, (response = {}) => {
    statAuctionState.roomPendingAction = null;
    if (!response.ok) {
      statAuctionState.roomError = response.error || "Lancement impossible.";
      renderStatAuctionScreen();
    }
  });
}
function restartStatAuctionMatch() {
  const socket = ensureMultiplayerSocket();
  if (!socket) return;
  socket.emit("stat-auction:restart-match", {}, (response = {}) => {
    if (!response.ok) {
      statAuctionState.roomError = response.error || "Restart impossible.";
      renderStatAuctionScreen();
    }
  });
}

function changeStatAuctionAllocation(statKey, delta) {
  if (!statAuctionState || statAuctionState.submitted) return;
  const cur = Number(statAuctionState.allocation[statKey]) || 0;
  const totalUsed = STAT_AUCTION_STATS.reduce((s, st) => s + (Number(statAuctionState.allocation[st.key]) || 0), 0);
  const remaining = STAT_AUCTION_TOTAL - totalUsed;
  let next = cur + delta;
  if (next < 0) next = 0;
  if (delta > 0 && delta > remaining) next = cur + remaining;
  statAuctionState.allocation[statKey] = next;
  renderStatAuctionScreen();
}
function setStatAuctionAllocation(statKey, value) {
  if (!statAuctionState || statAuctionState.submitted) return;
  const num = Math.max(0, Math.min(STAT_AUCTION_TOTAL, Math.round(Number(value) || 0)));
  const others = STAT_AUCTION_STATS.reduce((s, st) => st.key === statKey ? s : s + (Number(statAuctionState.allocation[st.key]) || 0), 0);
  const final = Math.min(num, STAT_AUCTION_TOTAL - others);
  statAuctionState.allocation[statKey] = final;
  renderStatAuctionScreen();
}
function autoBalanceStatAuctionAllocation() {
  if (!statAuctionState || statAuctionState.submitted) return;
  const base = Math.floor(STAT_AUCTION_TOTAL / STAT_AUCTION_STATS.length);
  let remaining = STAT_AUCTION_TOTAL - base * STAT_AUCTION_STATS.length;
  for (const s of STAT_AUCTION_STATS) {
    statAuctionState.allocation[s.key] = base + (remaining > 0 ? 1 : 0);
    if (remaining > 0) remaining -= 1;
  }
  renderStatAuctionScreen();
}
function clearStatAuctionAllocation() {
  if (!statAuctionState || statAuctionState.submitted) return;
  for (const s of STAT_AUCTION_STATS) statAuctionState.allocation[s.key] = 0;
  renderStatAuctionScreen();
}

async function submitStatAuctionAllocation() {
  if (!statAuctionState || !statAuctionState.room || statAuctionState.submitted) return;
  const total = STAT_AUCTION_STATS.reduce((s, st) => s + (Number(statAuctionState.allocation[st.key]) || 0), 0);
  if (total !== STAT_AUCTION_TOTAL) {
    statAuctionState.roomError = `Tu dois répartir exactement ${STAT_AUCTION_TOTAL} pts (actuellement ${total}).`;
    renderStatAuctionScreen();
    return;
  }
  if (!statAuctionState.currentPokemon || !statAuctionState.currentStats) {
    statAuctionState.roomError = "Pokémon non chargé.";
    renderStatAuctionScreen();
    return;
  }
  let computedScore = 0;
  for (const s of STAT_AUCTION_STATS) {
    const alloc = Number(statAuctionState.allocation[s.key]) || 0;
    const val = Number(statAuctionState.currentStats[s.key]) || 0;
    computedScore += alloc * val;
  }
  statAuctionState.submitted = true;
  statAuctionState.roomError = null;
  renderStatAuctionScreen();
  if (multiplayerSocket?.connected) {
    multiplayerSocket.emit("stat-auction:submit-allocation", {
      allocation: { ...statAuctionState.allocation },
      computedScore,
      realStats: statAuctionState.currentStats,
    }, (response = {}) => {
      if (!response.ok) {
        statAuctionState.submitted = false;
        statAuctionState.roomError = response.error || "Submit échoué.";
        renderStatAuctionScreen();
      }
    });
  }
}

async function loadStatAuctionPokemonForRound(round) {
  if (!statAuctionState?.room?.sequence) return;
  const id = statAuctionState.room.sequence[round - 1];
  if (!id) return;
  const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(id));
  if (!pokemon) return;
  statAuctionState.currentPokemon = pokemon;
  statAuctionState.currentStats = null;
  for (const s of STAT_AUCTION_STATS) statAuctionState.allocation[s.key] = 0;
  statAuctionState.submitted = false;
  renderStatAuctionScreen();
  const stats = await fetchBattleStats(pokemon);
  if (!statAuctionState || statAuctionState.room?.round !== round) return;
  statAuctionState.currentStats = stats || null;
  renderStatAuctionScreen();
}

function applyStatAuctionRoomState(room) {
  if (!statAuctionState) { statAuctionState = createStatAuctionState(); }
  const prevRound = statAuctionState.room?.round || 0;
  const prevStatus = statAuctionState.room?.status || null;
  statAuctionState.room = room;
  if (!room) return;
  if (room.status === "lobby") {
    statAuctionState.phase = "room";
    statAuctionState.currentPokemon = null;
    statAuctionState.currentStats = null;
    statAuctionState.submitted = false;
  } else if (room.status === "live") {
    statAuctionState.phase = "allocating";
    if (room.round !== prevRound || prevStatus !== "live") {
      loadStatAuctionPokemonForRound(room.round);
    }
    const me = room.players?.find((p) => p.isSelf);
    if (me?.submittedThisRound) statAuctionState.submitted = true;
    else if (room.round !== prevRound) statAuctionState.submitted = false;
  } else if (room.status === "finished") {
    const wasFinished = statAuctionState.phase === "finished";
    statAuctionState.phase = "finished";
    if (!wasFinished) {
      const self = room.players?.find((p) => p.isSelf);
      let result = "loss";
      if (self && room.winnerSide === self.side) {
        awardXp(80, "Victoire Stat Auction");
        progressQuest("stat_auction_win", 1);
        result = "win";
      } else if (room.winnerSide === "tie") {
        awardXp(40, "Stat Auction (égalité)");
        result = "draw";
      } else {
        awardXp(25, "Stat Auction (défaite)");
      }
      try {
        const opp = room.players?.find((p) => !p.isSelf);
        recordMatchHistory({
          mode: "stat-auction",
          result,
          attempts: room.round || 0,
          targetName: opp?.nickname ? `vs ${opp.nickname}` : "Stat Auction",
        });
      } catch (_e) {}
    }
  }
  renderStatAuctionScreen();
}

function renderStatAuctionScreen() {
  const root = document.getElementById("stat-auction-root");
  if (!root) return;
  const state = statAuctionState;
  if (!state) { root.innerHTML = ""; return; }
  const room = state.room;
  if (state.phase === "room" || !room) {
    const pending = state.roomPendingAction;
    root.innerHTML = `
      <div class="stat-auction-room">
        ${!room ? `
          <h3>Stat Auction 1v1 — Room</h3>
          <p class="card-desc">Crée une room ou rejoins-en une par code.</p>
          <div class="higher-lower-room-form">
            <label>Ton pseudo
              <input id="stat-auction-nickname" type="text" maxlength="24" value="${escapeHtml(state.roomNicknameDraft || "")}" placeholder="Dresseur" data-input-action="syncStatAuctionNickname" />
            </label>
            <div class="higher-lower-room-actions">
              <button class="btn-blue" type="button" data-action="createStatAuctionRoom" ${pending ? "disabled" : ""}>${pending === "creating" ? "Création…" : "Créer une room"}</button>
            </div>
            <div class="higher-lower-room-join">
              <label>Code de room
                <input id="stat-auction-room-input" type="text" maxlength="6" value="${escapeHtml(state.roomDraftCode || "")}" placeholder="ABCD" data-input-action="syncStatAuctionJoinCode" />
              </label>
              <button class="btn-ghost" type="button" data-action="joinStatAuctionRoom" ${pending ? "disabled" : ""}>${pending === "joining" ? "Connexion…" : "Rejoindre"}</button>
            </div>
          </div>
        ` : `
          <h3>Stat Auction — Room ${escapeHtml(room.code)}</h3>
          <div class="higher-lower-room-summary">
            <span><b>Code :</b> ${escapeHtml(room.code)}</span>
            <span><b>Joueurs :</b> ${room.connectedCount || 0}/${room.maxPlayers || 2}</span>
            <span><b>Manches :</b> ${room.totalRounds}</span>
          </div>
          <div class="higher-lower-room-players">
            ${room.players.map((p) => `<div class="higher-lower-room-player ${p.connected ? "is-connected" : "is-disconnected"}"><b>${escapeHtml(p.nickname || "Joueur")}</b><span>${p.isHost ? "Hôte" : "Invité"}${p.isSelf ? " · Toi" : ""}</span></div>`).join("")}
            ${room.players.length < 2 ? `<div class="higher-lower-room-player is-empty"><b>En attente…</b><span>Partage le code</span></div>` : ""}
          </div>
          <div class="higher-lower-room-actions">
            ${room.players.find((p) => p.isSelf)?.isHost ? `<button class="btn-red" type="button" data-action="startStatAuctionMatch" ${room.canStart && !pending ? "" : "disabled"}>${pending === "starting" ? "Lancement…" : "Lancer la partie"}</button>` : `<p class="card-desc">En attente du lancement par l'hôte.</p>`}
            <button class="btn-ghost" type="button" data-action="leaveStatAuctionRoom">Quitter</button>
          </div>
        `}
        ${state.roomError ? `<p class="higher-lower-feedback is-wrong">${escapeHtml(state.roomError)}</p>` : ""}
      </div>`;
    return;
  }
  if (state.phase === "finished") {
    const self = room.players.find((p) => p.isSelf);
    const opp = room.players.find((p) => !p.isSelf);
    const selfWon = room.winnerSide === self?.side;
    const tie = room.winnerSide === "tie";
    const isHost = Boolean(self?.isHost);
    const title = tie ? "🤝 Égalité" : selfWon ? "🏆 Victoire !" : "💀 Défaite";
    root.innerHTML = `
      <div class="stat-auction-final">
        <h3>${title}</h3>
        <p>Toi <b>${self?.score ?? 0}</b> · ${escapeHtml(opp?.nickname || "Adv.")} <b>${opp?.score ?? 0}</b></p>
        <div class="higher-lower-room-actions">
          ${isHost ? `<button class="btn-red" type="button" data-action="restartStatAuctionMatch">Relancer</button>` : `<p class="card-desc">En attente du restart par l'hôte.</p>`}
          <button class="btn-ghost" type="button" data-action="leaveStatAuctionRoom">Quitter</button>
        </div>
      </div>`;
    return;
  }
  // Allocating phase
  const pokemon = state.currentPokemon;
  const me = room.players.find((p) => p.isSelf);
  const opp = room.players.find((p) => !p.isSelf);
  const totalUsed = STAT_AUCTION_STATS.reduce((s, st) => s + (Number(state.allocation[st.key]) || 0), 0);
  const remaining = STAT_AUCTION_TOTAL - totalUsed;
  const oppSubmitted = Boolean(opp?.submittedThisRound);
  if (!pokemon) {
    root.innerHTML = `<div class="higher-lower-loading"><div class="higher-lower-spinner"></div><p>Chargement du Pokémon…</p></div>`;
    return;
  }
  const lastHist = Array.isArray(room.history) && room.history.length ? room.history[room.history.length - 1] : null;
  const statsLoaded = Boolean(state.currentStats);
  const allocatorHtml = STAT_AUCTION_STATS.map((s) => {
    const cur = Number(state.allocation[s.key]) || 0;
    return `<div class="stat-auction-row">
      <div class="stat-auction-stat-label"><span>${s.icon}</span><b>${escapeHtml(s.label)}</b></div>
      <div class="stat-auction-stat-controls">
        <button type="button" class="btn-ghost stat-auction-step" ${cur <= 0 || state.submitted ? "disabled" : ""} data-action="changeStatAuctionAllocation" data-args='["${s.key}",-5]'>−5</button>
        <input type="number" class="stat-auction-input" min="0" max="100" value="${cur}" ${state.submitted ? "disabled" : ""} data-input-action="statAuctionAllocationFromEl" data-stat-key="${s.key}" />
        <button type="button" class="btn-ghost stat-auction-step" ${remaining <= 0 || state.submitted ? "disabled" : ""} data-action="changeStatAuctionAllocation" data-args='["${s.key}",5]'>+5</button>
      </div>
    </div>`;
  }).join("");
  root.innerHTML = `
    <div class="stat-auction-board">
      <div class="stat-auction-status">
        <span>Manche : <b>${room.round}/${room.totalRounds}</b></span>
        <span>Toi : <b>${me?.score ?? 0}</b></span>
        <span>${escapeHtml(opp?.nickname || "Adv.")} : <b>${opp?.score ?? 0}</b></span>
        <span class="${oppSubmitted ? "is-ready" : ""}">${oppSubmitted ? "✅ Adv. prêt" : "⏳ Adv. en cours"}</span>
      </div>
      <div class="stat-auction-pokemon">
        <img class="higher-lower-sprite" src="${escapeHtml(getPokemonSprite(pokemon))}" alt="${escapeHtml(pokemon.name)}" />
        <h3>${escapeHtml(pokemon.name)}</h3>
        <p class="card-desc">Répartis ${STAT_AUCTION_TOTAL} pts sur les 6 stats. ${statsLoaded ? "" : "(Chargement des vraies stats…)"}</p>
      </div>
      <div class="stat-auction-allocator ${state.submitted ? "is-submitted" : ""}">${allocatorHtml}</div>
      <div class="stat-auction-totalbar">
        <span>Total alloué : <b>${totalUsed}</b> / ${STAT_AUCTION_TOTAL}</span>
        <span>Reste : <b>${remaining}</b></span>
      </div>
      <div class="higher-lower-room-actions">
        <button type="button" class="btn-ghost" data-action="autoBalanceStatAuctionAllocation" ${state.submitted ? "disabled" : ""}>Équilibrer</button>
        <button type="button" class="btn-ghost" data-action="clearStatAuctionAllocation" ${state.submitted ? "disabled" : ""}>Reset</button>
        <button type="button" class="btn-red" data-action="submitStatAuctionAllocation" ${state.submitted || totalUsed !== STAT_AUCTION_TOTAL || !statsLoaded ? "disabled" : ""}>${state.submitted ? "Soumis ✓" : "Valider"}</button>
      </div>
      ${state.roomError ? `<p class="higher-lower-feedback is-wrong">${escapeHtml(state.roomError)}</p>` : ""}
      ${lastHist ? `<div class="stat-auction-last-reveal"><h4>Manche ${lastHist.round} — reveal</h4><div class="stat-auction-reveal-grid">${STAT_AUCTION_STATS.map((s) => `<div><b>${s.icon} ${escapeHtml(s.label)}</b><span>Toi ${lastHist[me?.side]?.allocation?.[s.key] || 0}pt × ${lastHist[me?.side]?.realStats?.[s.key] || "?"}</span><span>${escapeHtml(opp?.nickname || "Adv")} ${lastHist[opp?.side]?.allocation?.[s.key] || 0}pt × ${lastHist[opp?.side]?.realStats?.[s.key] || "?"}</span></div>`).join("")}</div><p>Score manche : Toi <b>${lastHist[me?.side]?.computedScore || 0}</b> · ${escapeHtml(opp?.nickname || "Adv.")} <b>${lastHist[opp?.side]?.computedScore || 0}</b></p></div>` : ""}
    </div>`;
}

function buildMysteryBattleClues(secret, stats) {
  const hp = Number.isFinite(stats?.hp) ? stats.hp : null;
  const attack = Number.isFinite(stats?.attack) ? stats.attack : null;
  const defense = Number.isFinite(stats?.defense) ? stats.defense : null;
  const spAttack = Number.isFinite(stats?.spAttack) ? stats.spAttack : null;
  const spDefense = Number.isFinite(stats?.spDefense) ? stats.spDefense : null;
  const speed = Number.isFinite(stats?.speed) ? stats.speed : null;
  const total =
    hp === null || attack === null || defense === null || spAttack === null || spDefense === null || speed === null
      ? null
      : hp + attack + defense + spAttack + spDefense + speed;

  const clues = [
    { label: "Type", value: secret.type1 + (secret.type2 ? " / " + secret.type2 : "") },
    { label: "PV", value: hp ?? "?" },
    { label: "Attaque", value: attack ?? "?" },
    { label: "Défense", value: defense ?? "?" },
    { label: "Attaque Spéciale", value: spAttack ?? "?" },
    { label: "Défense Spéciale", value: spDefense ?? "?" },
    { label: "Vitesse", value: speed ?? "?" },
    { label: "Total", value: total ?? "?" },
  ];

  return clues;
}

async function prepareMysteryClues(secret) {
  mysteryClues = [
    { label: "Type", value: secret.type1 + (secret.type2 ? " / " + secret.type2 : "") },
    { label: "PV", value: "Chargement..." },
    { label: "Attaque", value: "Chargement..." },
    { label: "Défense", value: "Chargement..." },
    { label: "Attaque Spéciale", value: "Chargement..." },
    { label: "Défense Spéciale", value: "Chargement..." },
    { label: "Vitesse", value: "Chargement..." },
    { label: "Total", value: "Chargement..." },
  ];
  updateMysteryPanel(false);

  const stats = await fetchBattleStats(secret);
  mysteryClues = buildMysteryBattleClues(secret, stats);

  if (gameMode === "mystery" && secretPokemon && secretPokemon.id === secret.id && !gameOver) {
    updateMysteryPanel(false);
  }
}

function getMysteryStatMeta(label) {
  const map = {
    PV: { max: 255, scale: "regular" },
    Attaque: { max: 255, scale: "regular" },
    "Défense": { max: 255, scale: "regular" },
    "Attaque Spéciale": { max: 255, scale: "regular" },
    "Défense Spéciale": { max: 255, scale: "regular" },
    Vitesse: { max: 255, scale: "regular" },
    Total: { max: 780 },
  };
  return map[label] || null;
}

function getMysteryScaleColor(value, statMeta) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "#58a6ff";
  const max = Number(statMeta?.max) || 255;
  const ratio = max > 0 ? n / max : 0;
  if (ratio < 0.18) return "#4f8ff5";
  if (ratio < 0.32) return "#49c7d9";
  if (ratio < 0.5) return "#78c95f";
  if (ratio < 0.68) return "#e6cf4f";
  if (ratio < 0.82) return "#f08a4b";
  return "#ea5b57";
}

function updateMysteryPanel(reveal) {
  const box = document.getElementById("mystery-box");
  const list = document.getElementById("mystery-list");
  const revealBox = document.getElementById("mystery-reveal");
  const sprite = document.getElementById("mystery-sprite");
  const name = document.getElementById("mystery-name");

  if (!box || !list || !revealBox || !sprite || !name) return;

  if (gameMode !== "mystery" || !secretPokemon) {
    box.classList.add("hidden");
    revealBox.classList.add("hidden");
    list.innerHTML = "";
    sprite.src = "";
    name.textContent = "";
    return;
  }

  if (!Array.isArray(mysteryClues) || mysteryClues.length === 0) {
    mysteryClues = getMysteryClues(secretPokemon);
  }

  box.classList.remove("hidden");
  list.innerHTML = "";

  const head = document.createElement("li");
  head.className = "mystery-head";
  head.innerHTML = "<span>Stat</span><span>Barre</span><span>Base</span>";
  list.appendChild(head);

  for (const clue of mysteryClues) {
    const li = document.createElement("li");
    li.className = "mystery-item";

    const label = document.createElement("span");
    label.className = "mystery-label";
    label.textContent = clue.label;

    const value = document.createElement("strong");
    value.className = "mystery-value";
    value.textContent = String(clue.value);

    const statMeta = getMysteryStatMeta(clue.label);
    if (statMeta && Number.isFinite(Number(clue.value))) {
      const n = Number(clue.value);
      const ratio = Math.max(0, Math.min(1, n / statMeta.max));
      const statColor = getMysteryScaleColor(n, statMeta);
      const bar = document.createElement("div");
      bar.className = "mystery-bar";

      const fill = document.createElement("i");
      fill.style.width = `${Math.round(ratio * 100)}%`;
      fill.style.background = statColor;
      value.style.color = statColor;

      bar.appendChild(fill);
      li.appendChild(label);
      li.appendChild(bar);
      li.appendChild(value);
      list.appendChild(li);
      continue;
    }

    if (clue.label === "Type") {
      li.classList.add("mystery-item-type");
    }

    li.appendChild(label);
    li.appendChild(value);
    list.appendChild(li);
  }

  if (reveal) {
    revealBox.classList.remove("hidden");
    sprite.onerror = () => {
      sprite.onerror = null;
      sprite.src = getSpriteUrl(getPokemonSpriteId(secretPokemon));
    };
    sprite.src = getPokemonSprite(secretPokemon);
    sprite.alt = secretPokemon.name;
    name.textContent = secretPokemon.name;
  } else {
    revealBox.classList.add("hidden");
    sprite.src = "";
    name.textContent = "";
  }
}

function getPokemonCryId(pokemon) {
  return getPokemonSpriteId(pokemon);
}

function getPokemonCryUrl(pokemon) {
  return `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${getPokemonCryId(pokemon)}.ogg`;
}

function stopCrySound() {
  if (!cryAudio) return;
  try { cryAudio.pause(); } catch (_e) {}
  try { cryAudio.currentTime = 0; } catch (_e) {}
  setCryUiStatus("idle", "");
}

function setCryUiStatus(state, message = "") {
  const statusEl = document.getElementById("cry-status-text");
  const btn = document.getElementById("cry-play-btn");
  if (statusEl) {
    statusEl.classList.remove("hidden", "is-loading", "is-error", "is-ready");
    if (!message) {
      statusEl.classList.add("hidden");
      statusEl.textContent = "";
    } else {
      statusEl.classList.add(`is-${state}`);
      statusEl.textContent = message;
    }
  }
  if (btn) {
    btn.disabled = state === "loading";
    btn.classList.toggle("is-loading", state === "loading");
  }
}

function playCrySound() {
  if (gameMode !== "cry" || !secretPokemon) return;

  const url = getPokemonCryUrl(secretPokemon);

  // Nouveau cri : reset audio + UI
  if (!cryAudio || cryAudio.src !== url) {
    if (cryAudio) {
      try { cryAudio.pause(); } catch (_e) {}
    }
    cryAudio = new Audio();
    cryAudio.preload = "auto";
    cryAudio.addEventListener("loadstart", () => {
      if (cryAudio?.src === url) setCryUiStatus("loading", "Chargement du cri…");
    });
    cryAudio.addEventListener("canplay", () => {
      if (cryAudio?.src === url) setCryUiStatus("ready", "");
    });
    cryAudio.addEventListener("error", () => {
      if (cryAudio?.src === url) {
        setCryUiStatus("error", "Cri indisponible pour ce Pokémon (réseau ou source). Réessaie ou abandonne.");
      }
    });
    cryAudio.src = url;
  }

  setCryUiStatus("loading", "Chargement du cri…");
  try { cryAudio.currentTime = 0; } catch (_e) {}
  const playPromise = cryAudio.play();
  if (playPromise && typeof playPromise.then === "function") {
    playPromise
      .then(() => setCryUiStatus("ready", ""))
      .catch((err) => {
        const blocked = err?.name === "NotAllowedError";
        setCryUiStatus("error", blocked
          ? "Lecture audio bloquée par le navigateur — clique encore une fois pour autoriser."
          : "Impossible de lire le cri (réseau ?). Réessaie."
        );
      });
  }
}

let __draftBattleCryAudio = null;
function playPokemonCry(pokemon, volume = 0.55) {
  if (!pokemon) return;
  try {
    const url = getPokemonCryUrl(pokemon);
    if (__draftBattleCryAudio) {
      try { __draftBattleCryAudio.pause(); } catch (e) { /* noop */ }
    }
    __draftBattleCryAudio = new Audio(url);
    __draftBattleCryAudio.volume = volume;
    __draftBattleCryAudio.play().catch(() => { /* silent fail (autoplay block / 404) */ });
  } catch (e) { /* noop */ }
}

function updateCryPanel(reveal) {
  const box = document.getElementById("cry-box");
  const revealBox = document.getElementById("cry-reveal");
  const sprite = document.getElementById("cry-sprite");
  const name = document.getElementById("cry-name");

  if (!box || !revealBox || !sprite || !name) return;

  if (gameMode !== "cry" || !secretPokemon) {
    box.classList.add("hidden");
    revealBox.classList.add("hidden");
    sprite.src = "";
    name.textContent = "";
    stopCrySound();
    return;
  }

  box.classList.remove("hidden");

  if (reveal) {
    revealBox.classList.remove("hidden");
    sprite.onerror = () => {
      sprite.onerror = null;
      sprite.src = getSpriteUrl(getPokemonSpriteId(secretPokemon));
    };
    sprite.src = getPokemonSprite(secretPokemon);
    sprite.alt = secretPokemon.name;
    name.textContent = secretPokemon.name;
  } else {
    revealBox.classList.add("hidden");
    sprite.src = "";
    name.textContent = "";
  }
}
function setQuizModeLayout(isQuizMode) {
  const searchBar = document.querySelector(".search-bar");
  const errMsg = document.getElementById("err-msg");
  const results = document.getElementById("results-wrap");
  const winBox = document.getElementById("win-box");
  const quizBox = document.getElementById("quiz-box");

  if (isQuizMode) {
    if (searchBar) searchBar.classList.add("hidden");
    if (errMsg) errMsg.classList.add("hidden");
    if (results) results.classList.add("hidden");
    if (winBox) winBox.classList.add("hidden");
    if (quizBox) quizBox.classList.remove("hidden");
    return;
  }

  if (searchBar) searchBar.classList.remove("hidden");
  if (errMsg) errMsg.classList.remove("hidden");
  if (quizBox) quizBox.classList.add("hidden");
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function randomUniqueChoices(baseList, correctValue, count = 4) {
  const pool = baseList.filter((v) => v !== correctValue);
  shuffleArray(pool);
  const options = [correctValue, ...pool.slice(0, Math.max(0, count - 1))];
  shuffleArray(options);
  return options;
}

function buildQuizQuestionPool() {
  const pool = QUIZ_QUESTIONS.slice();

  const base = getPokemonUiList({ includeAltForms: false }).filter((p) => Number.isInteger(p.id) && p.id <= 1025);
  const sampled = shuffleArray(base.slice()).slice(0, 120);

  const allTypes = [...new Set(base.map((p) => p.type1).filter(Boolean))];
  const allGens = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  for (const p of sampled.slice(0, 40)) {
    const correct = String(getPokemonSpriteId(p));
    const distractors = [
      String(Math.max(1, getPokemonSpriteId(p) - 1)),
      String(Math.min(1025, getPokemonSpriteId(p) + 1)),
      String(Math.max(1, getPokemonSpriteId(p) + 10)),
      String(Math.max(1, getPokemonSpriteId(p) - 10)),
    ];
    const options = randomUniqueChoices([...new Set(distractors)], correct);
    pool.push({
      question: `Quel est le numéro Pokédex de ${p.name} ?`,
      options,
      answer: options.indexOf(correct),
    });
  }

  for (const p of sampled.slice(40, 80)) {
    const correct = p.type1;
    const options = randomUniqueChoices(allTypes, correct);
    pool.push({
      question: `Quel est le type principal de ${p.name} ?`,
      options,
      answer: options.indexOf(correct),
    });
  }

  for (const p of sampled.slice(80, 120)) {
    const correct = `Gen ${p.gen}`;
    const options = randomUniqueChoices(allGens.map((g) => `Gen ${g}`), correct);
    pool.push({
      question: `${p.name} appartient à quelle génération ?`,
      options,
      answer: options.indexOf(correct),
    });
  }

  return pool;
}

function renderQuizMeta() {
  const progressFill = document.getElementById("quiz-progress-fill");
  const goodEl = document.getElementById("quiz-good");
  const badEl = document.getElementById("quiz-bad");
  const historyEl = document.getElementById("quiz-history");

  const total = quizQuestions.length || 1;
  const answered = quizHistory.length;
  const bad = answered - quizScore;
  const pct = Math.round((answered / total) * 100);

  if (progressFill) progressFill.style.width = `${pct}%`;
  if (goodEl) goodEl.textContent = `Bonnes : ${quizScore}`;
  if (badEl) badEl.textContent = `Mauvaises : ${bad}`;

  if (historyEl) {
    historyEl.innerHTML = quizHistory
      .map((h) => `<div class="quiz-history-item ${h.ok ? "ok" : "bad"}">${h.ok ? "✓" : "✕"} ${h.text}</div>`)
      .join("");
  }
}

function renderQuizQuestion() {
  if (gameMode !== "quiz") return;

  const progress = document.getElementById("quiz-progress");
  const questionEl = document.getElementById("quiz-question");
  const optionsEl = document.getElementById("quiz-options");
  const feedbackEl = document.getElementById("quiz-feedback");
  const nextBtn = document.getElementById("quiz-next-btn");

  if (!progress || !questionEl || !optionsEl || !feedbackEl || !nextBtn) return;

  renderQuizMeta();

  if (quizCurrentIndex >= quizQuestions.length) {
    gameOver = true;
    if (!quizSessionLogged) {
      quizSessionLogged = true;
      recordMatchHistory({
        mode: "quiz",
        result: quizScore >= Math.ceil(quizQuestions.length / 2) ? "win" : "loss",
        attempts: quizQuestions.length,
        targetName: `Score ${quizScore}/${quizQuestions.length}`,
      });
      // XP : 5 par bonne réponse + bonus si > 50%
      const xpReward = quizScore * 5 + (quizScore >= Math.ceil(quizQuestions.length / 2) ? 30 : 0);
      if (xpReward > 0) awardXp(xpReward, `Quiz ${quizScore}/${quizQuestions.length}`);
      // Record perso
      const prevRecord = Number(playerProfile?.quizHighScore) || 0;
      if (playerProfile && quizScore > prevRecord) {
        playerProfile.quizHighScore = quizScore;
        try { saveProfile(); } catch (_e) {}
        if (quizScore >= Math.ceil(quizQuestions.length / 2)) awardXp(20, "Nouveau record Quiz");
      }
    }
    progress.textContent = `Quiz terminé • Score final : ${quizScore} / ${quizQuestions.length}`;
    questionEl.textContent = "Fin du quiz";
    optionsEl.innerHTML = "";
    feedbackEl.textContent = "";
    if (isPartySessionActive()) {
      nextBtn.classList.add("hidden");
      finishPartyRound(quizScore >= Math.ceil(quizQuestions.length / 2));
    } else {
      nextBtn.classList.remove("hidden");
      nextBtn.textContent = "Rejouer";
    }
    return;
  }

  const current = quizQuestions[quizCurrentIndex];
  quizAnswered = false;
  progress.textContent = `Question ${quizCurrentIndex + 1} / ${quizQuestions.length}`;
  questionEl.textContent = current.question;
  optionsEl.innerHTML = "";
  feedbackEl.textContent = "";
  nextBtn.classList.add("hidden");
  nextBtn.textContent = "Question suivante";

  current.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn-blue";
    btn.textContent = opt;
    btn.addEventListener("click", () => submitQuizAnswer(idx));
    optionsEl.appendChild(btn);
  });
}
function submitQuizAnswer(choiceIndex) {
  if (gameMode !== "quiz" || gameOver || quizAnswered) return;

  const current = quizQuestions[quizCurrentIndex];
  const feedbackEl = document.getElementById("quiz-feedback");
  const nextBtn = document.getElementById("quiz-next-btn");
  const optionButtons = document.querySelectorAll("#quiz-options button");

  quizAnswered = true;
  attempts += 1;
  document.getElementById("try-count").textContent = String(attempts);

  optionButtons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === current.answer) {
      btn.className = "btn-yellow";
    } else if (idx === choiceIndex) {
      btn.className = "btn-red";
    }
  });

  const ok = choiceIndex === current.answer;
  if (ok) {
    quizScore += 1;
    if (feedbackEl) feedbackEl.textContent = "Bonne réponse !";
  } else if (feedbackEl) {
    feedbackEl.textContent = `Mauvaise réponse. Bonne réponse : ${current.options[current.answer]}`;
  }

  quizHistory.push({
    ok,
    text: `${quizCurrentIndex + 1}. ${current.options[current.answer]}`,
  });
  renderQuizMeta();

  if (nextBtn) nextBtn.classList.remove("hidden");
}
function nextQuizQuestion() {
  if (gameMode !== "quiz") return;
  if (gameOver) {
    if (isPartySessionActive()) return;
    startQuizGame();
    return;
  }

  if (!quizAnswered) return;
  quizCurrentIndex += 1;
  renderQuizQuestion();
}

function rebuildActiveSearchIndex() {
  const activeIds = new Set(activePool.map((p) => p.id));

  activeSearchIndex = [];
  activeNameMap = new Map();

  for (const entry of FULL_SEARCH_INDEX) {
    if (!activeIds.has(entry.pokemon.id)) continue;
    activeSearchIndex.push(entry);
    if (!activeNameMap.has(entry.normName)) {
      activeNameMap.set(entry.normName, entry.pokemon);
    }
  }

  guessCache.clear();
}

function searchPokemonFast(qNorm, indexEntries, cache, excludedNames) {
  let baseEntries = cache.get(qNorm);

  if (!baseEntries) {
    const parentKey = qNorm.slice(0, -1);
    const parent = parentKey ? cache.get(parentKey) : null;
    const source = parent || indexEntries;

    baseEntries = [];
    for (const entry of source) {
      if (entry.normName.includes(qNorm)) {
        baseEntries.push(entry);
      }
    }

    cache.set(qNorm, baseEntries);
  }

  const out = [];
  for (const entry of baseEntries) {
    const pokemon = entry.pokemon;
    if (excludedNames && excludedNames.has(pokemon.name)) continue;
    out.push(pokemon);
    if (out.length >= AC_LIMIT) break;
  }

  return out;
}

function filterGuessAC() {
  const input = document.getElementById("guess-input");
  const list = document.getElementById("guess-ac");
  acIndex = -1;

  const qNorm = norm(input.value.trim());
  if (!qNorm) {
    list.classList.add("hidden");
    return;
  }

  const matches = searchPokemonFast(qNorm, activeSearchIndex, guessCache, guessedSet);
  renderGuessAC(matches);
}

function renderGuessAC(matches) {
  const list = document.getElementById("guess-ac");

  if (!matches.length) {
    list.classList.add("hidden");
    return;
  }

  list.innerHTML = "";

  for (const p of matches) {
    const fallbackSprite = getSpriteUrl(getPokemonSpriteId(p));
    const item = document.createElement("div");
    item.className = "ac-item";
    item.innerHTML = `
      <img src="${getPokemonSprite(p)}" alt="${p.name}" loading="lazy" data-fallback="${fallbackSprite}" />
      <div>
        <div class="ac-name">${p.name}</div>
        <div class="ac-sub">${p.type1}${p.type2 ? ` / ${p.type2}` : ""} • Gen ${p.gen}</div>
      </div>
    `;

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectGuessAC(p.name);
    });

    list.appendChild(item);
  }

  list.classList.remove("hidden");
}

function selectGuessAC(name) {
  document.getElementById("guess-input").value = name;
  document.getElementById("guess-ac").classList.add("hidden");
  acIndex = -1;
  submitGuess();
}

function handleGuessKey(e) {
  const list = document.getElementById("guess-ac");
  const items = list.querySelectorAll(".ac-item");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    acIndex = Math.min(acIndex + 1, items.length - 1);
    highlightItems(items, acIndex);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    acIndex = Math.max(acIndex - 1, -1);
    highlightItems(items, acIndex);
  } else if (e.key === "Enter") {
    if (acIndex >= 0 && items[acIndex]) {
      const name = items[acIndex].querySelector(".ac-name").textContent;
      selectGuessAC(name);
    } else {
      submitGuess();
    }
  } else if (e.key === "Escape") {
    list.classList.add("hidden");
  }
}

function highlightItems(items, index) {
  items.forEach((it, i) => it.classList.toggle("hl", i === index));
}


function renderMultiplayerGuessAC(matches) {
  const list = document.getElementById("multiplayer-guess-ac");
  if (!list) return;

  if (!matches.length) {
    list.classList.add("hidden");
    return;
  }

  list.innerHTML = "";

  for (const p of matches) {
    const fallbackSprite = getSpriteUrl(getPokemonSpriteId(p));
    const item = document.createElement("div");
    item.className = "ac-item";
    item.innerHTML = `
      <img src="${getPokemonSprite(p)}" alt="${p.name}" loading="lazy" data-fallback="${fallbackSprite}" />
      <div>
        <div class="ac-name">${p.name}</div>
        <div class="ac-sub">${p.type1}${p.type2 ? ` / ${p.type2}` : ""} • Gen ${p.gen}</div>
      </div>
    `;

    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectMultiplayerGuessAC(p.name);
    });

    list.appendChild(item);
  }

  list.classList.remove("hidden");
}

function selectMultiplayerGuessAC(name) {
  document.getElementById("multiplayer-guess-input").value = name;
  document.getElementById("multiplayer-guess-ac").classList.add("hidden");
  acIndex = -1;
  submitMultiplayerGuess();
}

// close autocomplete when clicking outside
window.addEventListener("click", (e) => {
  if (!e.target.closest(".ac-wrapper")) {
    document.querySelectorAll(".ac-list").forEach((l) => l.classList.add("hidden"));
  }
});

