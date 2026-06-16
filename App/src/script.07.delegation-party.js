// ============================================================
function showChallengePanel() {
  const panel = document.getElementById("challenge-panel");
  panel.classList.toggle("hidden");

  if (!panel.classList.contains("hidden")) {
    document.getElementById("challenge-input").focus();
  }
}

let challengeSelected = null;
let chalAcIndex = -1;

function filterChallengeAC() {
  const input = document.getElementById("challenge-input");
  const list = document.getElementById("challenge-ac");
  chalAcIndex = -1;

  const qNorm = norm(input.value.trim());
  if (!qNorm) {
    list.classList.add("hidden");
    challengeSelected = null;
    return;
  }

  const matches = searchPokemonFast(qNorm, FULL_SEARCH_INDEX, challengeCache, null);

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
        <div class="ac-sub">Gen ${p.gen} ? ${p.type1}${p.type2 ? ` / ${p.type2}` : ""}</div>
      </div>
    `;

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectChallengeAC(p);
    });

    list.appendChild(item);
  }

  list.classList.remove("hidden");
}

function handleChallengeKey(e) {
  const list = document.getElementById("challenge-ac");
  const items = list.querySelectorAll(".ac-item");

  if (e.key === "ArrowDown") {
    e.preventDefault();
    chalAcIndex = Math.min(chalAcIndex + 1, items.length - 1);
    highlightItems(items, chalAcIndex);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    chalAcIndex = Math.max(chalAcIndex - 1, -1);
    highlightItems(items, chalAcIndex);
  } else if (e.key === "Enter" && chalAcIndex >= 0 && items[chalAcIndex]) {
    const name = items[chalAcIndex].querySelector(".ac-name").textContent;
    const p = POKEMON_LIST.find((pk) => pk.name === name);
    if (p) selectChallengeAC(p);
  }
}

function selectChallengeAC(pokemon) {
  challengeSelected = pokemon;

  document.getElementById("challenge-input").value = pokemon.name;
  document.getElementById("challenge-ac").classList.add("hidden");

  document.getElementById("challenge-sprite").src = getPokemonSprite(pokemon);
  document.getElementById("challenge-name").textContent = pokemon.name;
  document.getElementById("challenge-preview").classList.remove("hidden");
  document.getElementById("challenge-copied").classList.add("hidden");
}

function copyChallengeLink() {
  if (!challengeSelected) return;

  const encoded = btoa(String(challengeSelected.id));
  const url = `${window.location.origin}${window.location.pathname}?defi=${encoded}`;

  navigator.clipboard.writeText(url).then(() => {
    document.getElementById("challenge-copied").classList.remove("hidden");
    setTimeout(() => document.getElementById("challenge-copied").classList.add("hidden"), 3000);
  });
}

function checkChallengeURL() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("defi");
  if (!encoded) return false;

  try {
    const id = parseInt(atob(encoded), 10);
    const pokemon = POKEMON_BY_ID.get(id);
    if (!pokemon) return false;

    startChallengeGame(pokemon);
    return true;
  } catch (e) {
    console.warn("Lien de défi invalide:", e);
    return false;
  }
}

// ============================================================
// DAILY MODE (deterministic seed)
// ============================================================
function getUTCDateKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatUTCDateLabel(key) {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDailyPokemon() {
  const key = getUTCDateKey();
  const seed = hashString(`pokedle:${key}`);
  const rng = mulberry32(seed);
  // Pool stable : on exclut les formes alternatives (id >= 20000) et on trie par id
  // pour que le tirage daily reste reproductible si l'ordre d'injection change.
  const pool = POKEMON_LIST
    .filter((pokemon) => pokemon && !pokemon.isAltForm && Number(pokemon.id) < 20000)
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id));
  const index = Math.floor(rng() * pool.length);
  return pool[index];
}

function prevUTCDateKey(key) {
  const [y, m, d] = key.split("-").map((v) => Number(v));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return getUTCDateKey(date);
}

function refreshDailyStreakStatus() {
  const last = playerStats.lastDailyWinKey;
  if (!last) {
    playerStats.dailyCurrentStreak = 0;
    return;
  }

  const today = getUTCDateKey();
  const yesterday = prevUTCDateKey(today);

  if (last !== today && last !== yesterday) {
    playerStats.dailyCurrentStreak = 0;
  }
}

function registerDailyWinStreak() {
  const today = getUTCDateKey();

  // Already counted today.
  if (playerStats.lastDailyWinKey === today) return;

  const yesterday = prevUTCDateKey(today);
  if (playerStats.lastDailyWinKey === yesterday) {
    playerStats.dailyCurrentStreak = (playerStats.dailyCurrentStreak || 0) + 1;
  } else {
    playerStats.dailyCurrentStreak = 1;
  }

  if (playerStats.dailyCurrentStreak > (playerStats.dailyBestStreak || 0)) {
    playerStats.dailyBestStreak = playerStats.dailyCurrentStreak;
  }

  playerStats.lastDailyWinKey = today;
}

// ============================================================
// PLAYER STATS (localStorage)
// ============================================================
function loadStats() {
  const parsed = readJson(STORAGE_KEYS.stats, null);
  if (!parsed) {
    playerStats = { ...DEFAULT_STATS };
    return;
  }

  playerStats = {
    played: Number(parsed.played) || 0,
    wins: Number(parsed.wins) || 0,
    totalAttempts: Number(parsed.totalAttempts) || 0,
    dailyCurrentStreak: Number(parsed.dailyCurrentStreak) || 0,
    dailyBestStreak: Number(parsed.dailyBestStreak) || 0,
    lastDailyWinKey: typeof parsed.lastDailyWinKey === "string" ? parsed.lastDailyWinKey : null,
  };

  refreshDailyStreakStatus();
}

function saveStats() {
  writeJson(STORAGE_KEYS.stats, playerStats);
}

function renderStats() {
  const played = playerStats.played;
  const wins = playerStats.wins;
  const rate = played > 0 ? (wins / played) * 100 : 0;
  const avg = wins > 0 ? playerStats.totalAttempts / wins : 0;

  document.getElementById("stat-played").textContent = String(played);
  document.getElementById("stat-wins").textContent = String(wins);
  document.getElementById("stat-rate").textContent = `${rate.toFixed(1)}%`;
  document.getElementById("stat-avg").textContent = avg.toFixed(1);
  document.getElementById("stat-daily-streak").textContent = String(playerStats.dailyCurrentStreak || 0);
  document.getElementById("stat-daily-best").textContent = String(playerStats.dailyBestStreak || 0);

  // Stats par mode : records remplis depuis le profil, bloc masqué tant qu'il est vide.
  const modeStatBlock = document.querySelector(".mode-stat-block");
  const modeStatsList = document.getElementById("mode-stats-list");
  const modeStatTotal = document.getElementById("mode-stat-total");
  if (modeStatBlock && modeStatsList && modeStatTotal) {
    const records = [
      ["Higher or Lower", Number(playerProfile?.higherLowerHighScore) || 0, "série record"],
      ["Speedrun Pokédex", Number(playerProfile?.speedrunHighScore) || 0, "en 60 s"],
      ["Quiz Pokémon", Number(playerProfile?.quizHighScore) || 0, "bonnes réponses"],
      ["Party Pokémon", Number(playerProfile?.partyHighScore) || 0, "points record"],
      ["Intrus", Number(playerProfile?.oddOneOutHighScore) || 0, "d'affilée"],
      ["Duel de poids", Number(playerProfile?.weightBattleHighScore) || 0, "d'affilée"],
    ].filter(([, value]) => value > 0);
    if (!records.length) {
      modeStatBlock.classList.add("hidden");
    } else {
      modeStatBlock.classList.remove("hidden");
      modeStatTotal.textContent = `${records.length} mode${records.length > 1 ? "s" : ""}`;
      modeStatsList.innerHTML = records
        .map(([label, value, suffix]) => `<div class="mode-stat-row"><span>${label}</span><b>${value} ${suffix}</b></div>`)
        .join("");
    }
  }

  // DA 2026 : carte "Niveau joueur" de la home alignée sur le système XP réel (header).
  const homeLevelName = document.getElementById("player-level-name");
  const homeLevelXp = document.getElementById("player-level-xp");
  const homeLevelNext = document.getElementById("player-level-next");
  const homeLevelBar = document.getElementById("player-level-bar");
  if (homeLevelName || homeLevelXp || homeLevelBar) {
    const homeXp = Number(playerProfile?.xp || 0);
    const homeProg = getXpProgress(homeXp);
    if (homeLevelName) homeLevelName.textContent = `Niv. ${homeProg.tier.level} · ${homeProg.tier.name}`;
    if (homeLevelXp) homeLevelXp.textContent = `XP : ${homeXp}`;
    if (homeLevelNext) homeLevelNext.textContent = homeProg.next ? `Prochain : ${homeProg.next.name} (${homeProg.next.minXp - homeXp} XP)` : "Niveau max !";
    if (homeLevelBar) homeLevelBar.style.width = `${homeProg.percent}%`;
  }
}

function registerGameStart() {
  playerStats.played += 1;
  saveStats();
  evaluateAchievements();
  renderStats();
}

function registerWin() {
  if (winRegisteredForCurrentGame) return;

  winRegisteredForCurrentGame = true;
  playerStats.wins += 1;
  playerStats.totalAttempts += attempts;

  if (gameMode === "daily") {
    registerDailyWinStreak();
    // XP + quête : gagner le Pokédle du jour
    awardXp(80, "Pokédle du jour");
    progressQuest("win_daily", 1);
  } else if (gameMode === "normal" || gameMode === "challenge") {
    // XP variable selon le nombre d'essais (moins = mieux)
    const xpReward = Math.max(20, 80 - (attempts - 1) * 8);
    awardXp(xpReward, "Pokédle classique");
  } else {
    awardXp(40, `Mode ${gameMode}`);
  }

  saveStats();
  evaluateAchievements();
  renderStats();
}

// ============================================================
// AUTO-SAVE / RESTORE GAME
// ============================================================
function saveCurrentGame(forcedDailyKey = null) {
  if (!secretPokemon || gameOver) return;
  // Seuls les modes restaurables sont sauvegardés (cohérence avec VALID_MODES).
  if (!VALID_MODES.has(gameMode)) return;

  const payload = {
    version: 1,
    mode: gameMode,
    secretId: secretPokemon.id,
    attempts,
    guessedNames: guessedNames.slice(),
    historyIds: resultHistory.map((r) => r.pokemon.id),
    selectedGens: [...selectedGens],
    dailyKey: forcedDailyKey || (gameMode === "daily" ? getUTCDateKey() : null),
    savedAt: Date.now(),
  };

  // Le daily a son propre slot : une partie d'un autre mode ne l'écrase plus.
  writeJson(gameMode === "daily" ? STORAGE_KEYS.dailyGame : STORAGE_KEYS.game, payload);
}

function clearSavedGame(targetMode = gameMode) {
  try {
    localStorage.removeItem(targetMode === "daily" ? STORAGE_KEYS.dailyGame : STORAGE_KEYS.game);
  } catch (e) {
    console.warn("localStorage unavailable:", e);
  }
}

function restoreSavedGame() {
  // Priorité au daily du jour (slot dédié), sinon la dernière partie d'un autre mode.
  let save = readJson(STORAGE_KEYS.dailyGame, null);
  if (save && (save.mode !== "daily" || save.dailyKey !== getUTCDateKey())) {
    clearSavedGame("daily");
    save = null;
  }
  if (!save) {
    save = readJson(STORAGE_KEYS.game, null);
    if (save && save.mode === "daily") {
      // Migration : ancienne sauvegarde daily dans le slot commun.
      if (save.dailyKey === getUTCDateKey()) writeJson(STORAGE_KEYS.dailyGame, save);
      clearSavedGame("normal");
      if (save.dailyKey !== getUTCDateKey()) save = null;
    }
  }
  if (!save) return false;

  if (!VALID_MODES.has(save.mode)) {
    clearSavedGame(save.mode);
    return false;
  }

  if (save.mode === "daily" && save.dailyKey !== getUTCDateKey()) {
    clearSavedGame("daily");
    return false;
  }

  const secret = POKEMON_BY_ID.get(Number(save.secretId));
  if (!secret) {
    clearSavedGame();
    return false;
  }

  const safeGens = Array.isArray(save.selectedGens)
    ? save.selectedGens.map((n) => Number(n)).filter((n) => Number.isInteger(n) && GENERATIONS[n])
    : [];

  selectedGens = new Set(safeGens.length ? safeGens : [secret.gen]);
  buildGenGrid();

  gameMode = save.mode;
  activePool = gameMode === "daily" ? getPokemonUiList() : getPoolFromSelectedGens();

  if (!activePool.length) {
    activePool = [secret];
  }

  secretPokemon = secret;
  attempts = Math.max(0, Number(save.attempts) || 0);
  gameOver = false;
  winRegisteredForCurrentGame = false;

  guessedNames = Array.isArray(save.guessedNames) ? save.guessedNames.filter((n) => typeof n === "string") : [];
  guessedSet = new Set(guessedNames);

  resultHistory = [];
  document.getElementById("results-body").innerHTML = "";

  const historyIds = Array.isArray(save.historyIds) ? save.historyIds : [];
  for (const id of historyIds) {
    const guessed = POKEMON_BY_ID.get(Number(id));
    if (!guessed) continue;

    const cmp = compare(guessed, secretPokemon);
    resultHistory.push({ pokemon: guessed, cmp });
    addRow(guessed, cmp);
  }

  if (attempts < resultHistory.length) {
    attempts = resultHistory.length;
  }

  guessedNames = resultHistory.map((r) => r.pokemon.name);
  guessedSet = new Set(guessedNames);

  rebuildActiveSearchIndex();

  document.getElementById("try-count").textContent = String(attempts);
  document.getElementById("err-msg").textContent = "";
  document.getElementById("guess-input").value = "";
  document.getElementById("guess-ac").classList.add("hidden");

  document.getElementById("results-wrap").classList.toggle("hidden", resultHistory.length === 0);

  const winBox = document.getElementById("win-box");
  winBox.classList.add("hidden");
  winBox.classList.remove("win-animate");

  updateTopTag();
  updateModeBanners();
  updateSilhouettePanel(false);
  updatePixelPanel(false);
  if (gameMode === "mystery") {
    prepareMysteryClues(secretPokemon);
  } else {
    mysteryClues = [];
    updateMysteryPanel(false);
  }
  updateCryPanel(false);
  setQuizModeLayout(false);

  document.getElementById("screen-config").classList.add("hidden");
  showScreen("screen-game");
  setGlobalNavActive("game");

  document.getElementById("guess-input").focus();

  return true;
}

// ============================================================
// UTILS
// ============================================================
function norm(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


function normalizeColorValue(colorValue) {
  if (Array.isArray(colorValue)) {
    return colorValue.map((c) => String(c).trim()).filter(Boolean).join(" / ");
  }

  if (typeof colorValue !== "string") {
    return "Inconnu";
  }

  return colorValue
    .split(/[\/|,]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .join(" / ") || "Inconnu";
}

function colorTokens(colorValue) {
  return normalizeColorValue(colorValue)
    .split("/")
    .map((c) => norm(c.trim()))
    .filter(Boolean);
}

function compareColors(guessColor, secretColor) {
  const gSet = new Set(colorTokens(guessColor));
  const sSet = new Set(colorTokens(secretColor));

  let overlap = 0;
  for (const c of gSet) {
    if (sSet.has(c)) overlap += 1;
  }

  if (overlap === 0) return "wrong";
  if (overlap === gSet.size && overlap === sSet.size) return "ok";
  return "close";
}

function formatColorLabel(colorValue) {
  return normalizeColorValue(colorValue);
}
function normalizePokemonData() {
  for (const pokemon of POKEMON_LIST) {
    pokemon.gen = Number.isInteger(pokemon.gen) ? pokemon.gen : Number(pokemon.generation) || 1;
    pokemon.generation = pokemon.gen;
    pokemon.spriteId = Number.isInteger(pokemon.spriteId) ? pokemon.spriteId : (SPRITE_ID_OVERRIDES_BY_NAME[pokemon.name] || pokemon.id);
    pokemon.sprite = getSpriteUrl(pokemon.spriteId);
    pokemon.type2 = pokemon.type2 ?? null;
    pokemon.isAltForm = Boolean(pokemon.isAltForm || pokemon.id >= 20000);
    pokemon.color = normalizeColorValue(pokemon.color);
    pokemon.name = cleanMojibake(pokemon.name);
    pokemon.type1 = cleanMojibake(pokemon.type1);
    pokemon.type2 = pokemon.type2 ? cleanMojibake(pokemon.type2) : null;
    pokemon.habitat = cleanMojibake(pokemon.habitat);
    pokemon.color = cleanMojibake(pokemon.color);
  }
}

function cleanMojibake(value) {
  if (typeof value !== "string" || !value) return value;

  let out = value;

  if (/[ÃÂ�]/.test(out)) {
    try {
      out = decodeURIComponent(escape(out));
    } catch (_err) {
      // fallback below
    }
  }

  const fixes = {
    "Ã©": "é",
    "Ã¨": "è",
    "Ãª": "ê",
    "Ã«": "ë",
    "Ã¢": "à",
    "Ã§": "ç",
    "Ã´": "ô",
    "Ã¹": "ù",
    "Ã»": "û",
    "Ã¯": "ï",
    "Ã": "",
    "Â": "",
    "â€™": "'",
    "â€œ": "\"",
    "â€\u009d": "\"",
    "â€“": "-",
    "â€”": "-",
    "�": ""
  };

  for (const [bad, good] of Object.entries(fixes)) {
    if (out.includes(bad)) out = out.split(bad).join(good);
  }

  return out;
}

function getPokemonSpriteId(pokemon) {
  return pokemon.spriteId || pokemon.id;
}

function getPokemonSprite(pokemon) {
  if (!pokemon) return getSpriteUrl(25);
  return pokemon.sprite || getSpriteUrl(getPokemonSpriteId(pokemon));
}

function findPokemon(name) {
  return activeNameMap.get(norm(name)) || null;
}

var _appToastTimer = null;
(function () {
  function initDataActionDelegation() {
    if (window.__dataActionDelegationReady) return;
    window.__dataActionDelegationReady = true;
    document.addEventListener("click", function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest("[data-action]") : null;
      if (!el) return;
      var name = el.getAttribute("data-action");
      if (!name) return;
      var fn = window[name];
      if (typeof fn !== "function") return;
      var args = [];
      var raw = el.getAttribute("data-args");
      if (raw) { try { var parsed = JSON.parse(raw); args = Array.isArray(parsed) ? parsed : [parsed]; } catch (e) { args = []; } }
      fn.apply(el, args);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDataActionDelegation);
  else initDataActionDelegation();
})();

function openFromAllModes(name) {
  hideScreen("screen-all-modes");
  var fn = window[name];
  if (typeof fn === "function") fn();
}
window.openFromAllModes = openFromAllModes;

function openDefiAmiFromAllModes() {
  goToConfig();
  showChallengePanel();
}
window.openDefiAmiFromAllModes = openDefiAmiFromAllModes;

(function () {
  function bindEl(id, ev, fn) {
    var el = document.getElementById(id);
    if (el && typeof fn === "function") el.addEventListener(ev, fn);
  }
  function initInlineHandlerBindings() {
    if (window.__inlineHandlerBindingsReady) return;
    window.__inlineHandlerBindingsReady = true;
    bindEl("challenge-input", "input", window.filterChallengeAC);
    bindEl("challenge-input", "keydown", window.handleChallengeKey);
    bindEl("guess-input", "input", window.filterGuessAC);
    bindEl("guess-input", "keydown", window.handleGuessKey);
    bindEl("party-guess", "input", window.filterPartyGuessAC);
    bindEl("party-guess", "keydown", window.handlePartyGuessKey);
    bindEl("multiplayer-guess-input", "input", window.filterMultiplayerGuessAC);
    bindEl("multiplayer-guess-input", "keydown", window.handleMultiplayerGuessKey);
    var draftSel = document.getElementById("draft-battle-pokemon");
    if (draftSel) draftSel.addEventListener("change", function () { if (typeof selectDraftBattlePokemon === "function") selectDraftBattlePokemon(this.value); });
    var oddSel = document.getElementById("odd-difficulty-select");
    if (oddSel) oddSel.addEventListener("change", function () { if (typeof setOddDifficulty === "function") setOddDifficulty(this.value); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initInlineHandlerBindings);
  else initInlineHandlerBindings();
})();

(function () {
  if (window.__imgFallbackReady) return;
  window.__imgFallbackReady = true;
  // Les images migrées portent data-fallback="<url de secours>".
  // L'event "error" ne bouillonne pas -> on écoute en phase de capture.
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (!t || t.tagName !== "IMG") return;
    var fb = t.getAttribute("data-fallback");
    if (!fb || t.dataset.fallbackApplied === "1") return;
    t.dataset.fallbackApplied = "1";
    if (t.src !== fb) t.src = fb;
  }, true);
})();

// Wrappers pour handlers inline composés / à contexte (migration CSP vague B3)
window.partySubmitStatFromEl = function () {
  if (typeof partySubmitStat === "function") partySubmitStat(this.dataset.stat);
};
window.setPokedexCompareReferenceById = function (id) {
  if (typeof setPokedexCompareReference === "function" && typeof POKEMON_BY_ID !== "undefined") {
    setPokedexCompareReference(POKEMON_BY_ID.get(Number(id)));
  }
};
window.winOverlayRestartSame = function () {
  if (typeof hideMultiplayerWinOverlay === "function") hideMultiplayerWinOverlay();
  if (typeof restartMultiplayerRound === "function") restartMultiplayerRound("same");
};
window.winOverlayRestartUpdated = function () {
  if (typeof hideMultiplayerWinOverlay === "function") hideMultiplayerWinOverlay();
  if (typeof restartMultiplayerRound === "function") restartMultiplayerRound("updated");
};
window.winOverlayBackToConfig = function () {
  if (typeof hideMultiplayerWinOverlay === "function") hideMultiplayerWinOverlay();
  if (typeof goToConfig === "function") goToConfig();
};

// Délégation des events input/change/keydown/submit (migration CSP vague C)
(function () {
  if (window.__valueDelegationReady) return;
  window.__valueDelegationReady = true;
  function parseArgs(node) {
    var raw = node.getAttribute("data-args");
    if (!raw) return [];
    try { var p = JSON.parse(raw); return Array.isArray(p) ? p : [p]; } catch (e) { return []; }
  }
  function makeDelegator(eventName, attr, passEvent) {
    document.addEventListener(eventName, function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var node = t.closest("[" + attr + "]");
      if (!node) return;
      var fn = window[node.getAttribute(attr)];
      if (typeof fn !== "function") return;
      if (passEvent) fn.call(node, ev);
      else fn.apply(node, parseArgs(node));
    }, false);
  }
  makeDelegator("input", "data-input-action", false);
  makeDelegator("change", "data-change-action", false);
  makeDelegator("keydown", "data-keydown-action", true);
  makeDelegator("submit", "data-submit-action", true);
})();
window.statClashFormatFromEl = function () { if (typeof setStatClashFormat === "function") setStatClashFormat(this.value); };
window.statClashDifficultyFromEl = function () { if (typeof setStatClashDifficulty === "function") setStatClashDifficulty(this.value); };
window.statAuctionAllocationFromEl = function () { if (typeof setStatAuctionAllocation === "function") setStatAuctionAllocation(this.dataset.statKey, this.value); };
window.appSettingFromEl = function () { if (typeof updateAppSetting === "function") updateAppSetting(this.dataset.setting, this.dataset.bool === "1" ? this.checked : this.value); };
window.dailyQuestsKeydown = function (ev) { if (ev && ev.key === "Enter" && typeof openDailyQuestsModal === "function") openDailyQuestsModal(); };
window.speedrunFormSubmit = function (ev) { if (ev) ev.preventDefault(); var i = document.getElementById("speedrun-input"); if (i && i.value.trim()) { if (typeof speedrunSubmitGuess === "function") speedrunSubmitGuess(); } else if (typeof speedrunSkip === "function") speedrunSkip(); };

// ===== Team Builder : import / export texte (format façon Showdown, FR) =====
var TB_STAT_FR = { hp: "PV", atk: "Atq", def: "Déf", spa: "Atq Spé", spd: "Déf Spé", spe: "Vit" };
var TB_FR_STAT = { "pv": "hp", "atq": "atk", "def": "def", "atq spe": "spa", "def spe": "spd", "vit": "spe" };

function tbSpreadLine(spread, skipValue) {
  var order = ["hp", "atk", "def", "spa", "spd", "spe"];
  var parts = [];
  for (var i = 0; i < order.length; i++) {
    var v = Number(spread && spread[order[i]]);
    if (Number.isFinite(v) && v !== skipValue) parts.push(v + " " + TB_STAT_FR[order[i]]);
  }
  return parts.join(" / ");
}

function teamBuilderExportText() {
  var blocks = [];
  var state = teamBuilderState || [];
  for (var s = 0; s < state.length; s++) {
    var slot = state[s];
    var poke = getTeamBuilderPokemon(slot);
    if (!poke) continue;
    var lines = [];
    var item = slot.item && slot.item !== "Aucun" ? slot.item : "";
    lines.push(item ? poke.name + " @ " + item : poke.name);
    if (slot.talent) lines.push("Talent : " + slot.talent);
    if (slot.nature) lines.push("Nature : " + slot.nature);
    if (slot.gimmick && slot.gimmick !== "Aucun") lines.push("Gimmick : " + slot.gimmick);
    if (slot.teraType) lines.push("Tera : " + slot.teraType);
    lines.push("Niveau : 50");
    var ev = tbSpreadLine(slot.evs, 0);
    if (ev) lines.push("EVs : " + ev);
    var iv = tbSpreadLine(slot.ivs, 31);
    if (iv) lines.push("IVs : " + iv);
    for (var m = 0; m < (slot.moves || []).length; m++) if (slot.moves[m]) lines.push("- " + slot.moves[m]);
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

function openTeamBuilderExport() {
  var text = teamBuilderExportText();
  var body = text
    ? '<p class="card-desc">Copie ce texte pour partager ton équipe (format façon Showdown, en français).</p>'
      + '<textarea id="tb-export-area" class="tb-io-area" readonly rows="14">' + escapeHtml(text) + '</textarea>'
      + '<button class="btn-blue" type="button" data-action="teamBuilderCopyExport">📋 Copier</button>'
    : '<p class="card-desc">Ton équipe est vide : ajoute au moins un Pokémon avant d\'exporter.</p>';
  ensureOverlay("Exporter l'équipe", body);
}

function teamBuilderCopyExport() {
  var area = document.getElementById("tb-export-area");
  if (!area) return;
  area.select();
  try { navigator.clipboard.writeText(area.value); } catch (e) { try { document.execCommand("copy"); } catch (e2) {} }
  showToast("Équipe copiée ✅");
}

function openTeamBuilderImport() {
  var ph = "Dracaufeu @ Lunettes Choix\nTalent : Brasier\nNature : Timide\nEVs : 252 Atq Spé / 252 Vit / 4 PV\n- Lance-Flammes\n- Danse Draco";
  var body = '<p class="card-desc">Colle une équipe au format texte (façon Showdown, FR). Les noms de Pokémon doivent être en français.</p>'
    + '<textarea id="tb-import-area" class="tb-io-area" rows="14" placeholder="' + escapeHtml(ph) + '"></textarea>'
    + '<button class="btn-blue" type="button" data-action="teamBuilderImportConfirm">📥 Importer</button>';
  ensureOverlay("Importer une équipe", body);
}

function tbParseSpread(str, defVal) {
  var spread = { hp: defVal, atk: defVal, def: defVal, spa: defVal, spd: defVal, spe: defVal };
  var parts = String(str).split("/");
  for (var i = 0; i < parts.length; i++) {
    var m = parts[i].trim().match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    var key = TB_FR_STAT[norm(m[2])];
    if (key) spread[key] = Math.max(0, Math.min(defVal === 31 ? 31 : 252, Number(m[1])));
  }
  return spread;
}

function tbMatchNature(val) {
  var match = TEAM_BUILDER_NATURES.find(function (n) { return norm(n.value) === norm(val); });
  return match ? match.value : val;
}

function teamBuilderImportConfirm() {
  var area = document.getElementById("tb-import-area");
  var raw = area ? area.value : "";
  if (!raw.trim()) { showToast("Colle d'abord une équipe."); return; }
  var blocks = raw.replace(/\r/g, "").split(/\n\s*\n/).map(function (b) { return b.trim(); }).filter(Boolean);
  var slots = [];
  var imported = 0, skipped = 0;
  for (var b = 0; b < blocks.length && slots.length < 6; b++) {
    var lines = blocks[b].split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) continue;
    var at = lines[0].split("@");
    var poke = findPokemonGlobalByName(at[0].trim());
    if (!poke) { skipped++; continue; }
    var slot = createTeamBuilderEmptySlot();
    slot.pokemonId = poke.id;
    if (at[1]) slot.item = at[1].trim();
    var moves = [];
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i];
      if (line.charAt(0) === "-") { if (moves.length < 4) moves.push(line.replace(/^-\s*/, "").trim()); continue; }
      var ci = line.indexOf(":");
      if (ci === -1) {
        var mNat = line.match(/^(.+?)\s+Nature$/i);
        if (mNat) slot.nature = tbMatchNature(mNat[1].trim());
        continue;
      }
      var key = norm(line.slice(0, ci));
      var val = line.slice(ci + 1).trim();
      if (key === "talent" || key === "ability") slot.talent = val;
      else if (key === "nature") slot.nature = tbMatchNature(val);
      else if (key === "gimmick") slot.gimmick = val;
      else if (key === "tera" || key === "tera type" || key === "teracristal") { slot.gimmick = "Téra"; var tt = TEAM_BUILDER_TERA_TYPES.find(function (t) { return norm(t) === norm(val); }); if (tt) slot.teraType = tt; }
      else if (key === "evs" || key === "ev") { slot.evs = tbParseSpread(val, 0); slot.evPreset = "custom"; }
      else if (key === "ivs" || key === "iv") { slot.ivs = tbParseSpread(val, 31); slot.ivPreset = "custom"; }
    }
    while (moves.length < 4) moves.push("");
    slot.moves = moves;
    slots.push(slot);
    imported++;
  }
  if (!imported) { showToast("Aucun Pokémon reconnu (vérifie les noms en français)."); return; }
  while (slots.length < 6) slots.push(createTeamBuilderEmptySlot());
  teamBuilderState = normalizeTeamBuilderState(slots);
  saveTeamBuilderState();
  teamBuilderActiveSlot = 0;
  if (typeof renderTeamBuilderModule === "function") renderTeamBuilderModule();
  var overlay = document.getElementById("overlay-modal");
  if (overlay) overlay.classList.add("hidden");
  document.body.classList.remove("modal-open");
  showToast(imported + " Pokémon importé" + (imported > 1 ? "s" : "") + (skipped ? " · " + skipped + " ignoré" + (skipped > 1 ? "s" : "") : "") + " ✅");
}

function triggerProfilePhoto() {
  const input = document.getElementById("profile-photo-input");
  if (input) input.click();
}
function handleProfilePhotoFromEl() {
  const file = this && this.files && this.files[0];
  if (!file || !/^image\//.test(file.type)) { showToast("Choisis une image."); return; }
  const reader = new FileReader();
  reader.onload = function () {
    const img = new Image();
    img.onload = function () {
      const size = 160;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      try {
        playerProfile.avatarPhoto = canvas.toDataURL("image/jpeg", 0.82);
        saveProfile();
        if (typeof renderProfileScreen === "function") renderProfileScreen();
        showToast("Photo de profil enregistrée ✅");
      } catch (e) { showToast("Image trop lourde, réessaie."); }
    };
    img.onerror = function () { showToast("Image illisible."); };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function removeProfilePhoto() {
  if (playerProfile) { playerProfile.avatarPhoto = ""; saveProfile(); }
  if (typeof renderProfileScreen === "function") renderProfileScreen();
  showToast("Photo retirée.");
}

(function () {
  function renderAccount(data) {
    var el = document.getElementById("account-area");
    if (!el) return;
    if (!data || !data.auth) { el.innerHTML = ""; return; }
    if (data.user) {
      var av = data.user.avatar ? '<img class="account-avatar" src="' + escapeHtml(data.user.avatar) + '" alt="" />' : '';
      el.innerHTML = '<span class="account-chip">' + av + '<span class="account-name">' + escapeHtml(data.user.username || "Dresseur") + '</span><a class="account-logout" href="/auth/logout" title="Déconnexion" aria-label="Déconnexion">⏻</a></span>';
    } else {
      el.innerHTML = '<a class="account-login" href="/auth/discord"><svg class="account-login-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.291.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.339c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/></svg>Connexion Discord</a>';
    }
  }
  function initAccount() {
    try {
      var p = new URLSearchParams(location.search);
      var m = p.get("auth");
      if (m) {
        if (typeof showToast === "function") {
          if (m === "ok") showToast("Connecté avec Discord ✅");
          else if (m === "erreur") showToast("Échec de la connexion Discord.");
          else if (m === "indispo") showToast("Connexion indisponible pour le moment.");
        }
        p.delete("auth");
        var qs = p.toString();
        history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
      }
    } catch (e) {}
    fetch("/api/me", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(renderAccount)
      .catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAccount);
  else initAccount();
})();

(function () {
  var SYNC_KEYS = ["profile", "stats", "achievements", "teamBuilder"];
  var SYNC_AT = "pokedle_sync_at";
  var loggedIn = false;
  function storageKey(name) { return (typeof STORAGE_KEYS !== "undefined" && STORAGE_KEYS[name]) || null; }
  function buildLocalBlob() {
    var blob = { _savedAt: Date.now() };
    SYNC_KEYS.forEach(function (k) {
      var sk = storageKey(k); if (!sk) return;
      var v = null; try { v = localStorage.getItem(sk); } catch (e) {}
      if (v != null) blob[k] = v;
    });
    return blob;
  }
  function localSavedAt() { try { return Number(localStorage.getItem(SYNC_AT) || 0); } catch (e) { return 0; } }
  function setLocalSavedAt(t) { try { localStorage.setItem(SYNC_AT, String(t)); } catch (e) {} }
  function applyServerBlob(blob) {
    SYNC_KEYS.forEach(function (k) {
      var sk = storageKey(k); if (!sk) return;
      if (typeof blob[k] === "string") { try { localStorage.setItem(sk, blob[k]); } catch (e) {} }
    });
    setLocalSavedAt(Number(blob._savedAt) || Date.now());
  }
  function pushSync() {
    if (!loggedIn) return;
    var blob = buildLocalBlob();
    var hasContent = SYNC_KEYS.some(function (k) { return blob[k]; });
    if (!hasContent) return; // garde-fou : ne jamais écraser le compte avec du vide
    setLocalSavedAt(blob._savedAt);
    try {
      fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(blob) }).catch(function () {});
    } catch (e) {}
  }
  function initSync() {
    fetch("/api/me", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (me) {
      if (!me || !me.user) return;
      loggedIn = true;
      window.__pokedleAuthed = true;
      fetch("/api/profile", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (resp) {
        var server = (resp && resp.data) || {};
        var serverAt = Number(server._savedAt) || 0;
        var serverHas = SYNC_KEYS.some(function (k) { return typeof server[k] === "string"; });
        if (serverHas && serverAt > localSavedAt() && sessionStorage.getItem("pokedle_synced") !== "1") {
          applyServerBlob(server);
          try { sessionStorage.setItem("pokedle_synced", "1"); } catch (e) {}
          location.reload();
          return;
        }
        pushSync();
      }).catch(function () {});
    }).catch(function () {});
    setInterval(pushSync, 60000);
    window.addEventListener("pagehide", function () {
      if (!loggedIn) return;
      try {
        var blob = buildLocalBlob();
        if (SYNC_KEYS.some(function (k) { return blob[k]; }) && navigator.sendBeacon) {
          navigator.sendBeacon("/api/profile", new Blob([JSON.stringify(blob)], { type: "application/json" }));
        }
      } catch (e) {}
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSync);
  else initSync();
})();

function submitLeaderboardScores() {
  if (!window.__pokedleAuthed) return;
  if (typeof playerProfile === "undefined" || !playerProfile) return;
  var scores = {
    quiz: Number(playerProfile.quizHighScore) || 0,
    speedrun: Number(playerProfile.speedrunHighScore) || 0,
    party: Number(playerProfile.partyHighScore) || 0,
    intrus: Number(playerProfile.oddOneOutHighScore) || 0,
    poids: Number(playerProfile.weightBattleHighScore) || 0,
    higherlower: Number(playerProfile.higherLowerHighScore) || 0
  };
  var draft = playerProfile.draftScoreAttackRecords || {};
  Object.keys(draft).forEach(function (k) {
    var dv = Number(draft[k]) || 0;
    if (dv > 0) scores["draft_" + k] = dv;
  });
  try {
    fetch("/api/scores", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ scores: scores }) }).catch(function () {});
  } catch (e) {}
}
var __lbSubmitTimer = null;
function queueLeaderboardSubmit() {
  if (__lbSubmitTimer) clearTimeout(__lbSubmitTimer);
  __lbSubmitTimer = setTimeout(submitLeaderboardScores, 2500);
}
window.queueLeaderboardSubmit = queueLeaderboardSubmit;
(function () {
  setTimeout(submitLeaderboardScores, 8000);
  setInterval(submitLeaderboardScores, 60000);
})();

function switchLeaderboard() {
  var mode = this && this.dataset ? this.dataset.lbMode : "quiz";
  openLeaderboard(mode);
}
function openLeaderboard(mode) {
  var MODES = [["quiz", "Quiz"], ["speedrun", "Speedrun"], ["party", "Party"], ["intrus", "Intrus"], ["poids", "Duel de poids"], ["higherlower", "Higher/Lower"], ["draft", "Draft Score"]];
  var DRAFT_GENS = [["draft_all", "Tous"], ["draft_1", "G1"], ["draft_2", "G2"], ["draft_3", "G3"], ["draft_4", "G4"], ["draft_5", "G5"], ["draft_6", "G6"], ["draft_7", "G7"], ["draft_8", "G8"], ["draft_9", "G9"]];
  var MEDALS = ["🥇", "🥈", "🥉"];
  function isDraft(m) { return typeof m === "string" && m.indexOf("draft") === 0; }
  var current = mode;
  if (isDraft(current)) { if (current === "draft") current = "draft_all"; }
  else if (!MODES.some(function (m) { return m[0] === current; })) current = "quiz";
  ensureOverlay("🏆 Classement", '<p class="card-desc">Chargement du classement...</p>');
  fetch("/api/leaderboard?mode=" + encodeURIComponent(current), { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var tabs = MODES.map(function (m) {
        var act = (m[0] === "draft" ? isDraft(current) : m[0] === current);
        var target = (m[0] === "draft" ? "draft_all" : m[0]);
        return '<button type="button" class="lb-tab' + (act ? " is-active" : "") + '" data-action="switchLeaderboard" data-lb-mode="' + target + '">' + escapeHtml(m[1]) + '</button>';
      }).join("");
      var genRow = "";
      if (isDraft(current)) {
        genRow = '<div class="lb-subtabs">' + DRAFT_GENS.map(function (g) {
          return '<button type="button" class="lb-chip' + (g[0] === current ? " is-active" : "") + '" data-action="switchLeaderboard" data-lb-mode="' + g[0] + '">' + escapeHtml(g[1]) + '</button>';
        }).join("") + '</div>';
      }
      var list = ((data && data.top) || []).map(function (row, i) {
        var rankCls = i < 3 ? " lb-rank-top" : "";
        var rankTxt = i < 3 ? MEDALS[i] : (i + 1);
        var av = row.avatar ? '<img class="lb-avatar" src="' + escapeHtml(row.avatar) + '" alt="" />' : '<span class="lb-avatar lb-avatar-empty"></span>';
        return '<div class="lb-row' + (row.me ? " lb-row-me" : "") + '"><span class="lb-rank' + rankCls + '">' + rankTxt + '</span>' + av + '<span class="lb-name">' + escapeHtml(row.username || "Dresseur") + '</span><b class="lb-score">' + (Number(row.score) || 0) + '</b></div>';
      }).join("");
      if (!list) list = '<p class="card-desc">Aucun score pour ce mode pour le moment. Sois le premier !</p>';
      var me = "";
      if (data && data.me) me = '<div class="lb-me">Ta position : <b>#' + data.me.rank + '</b> — score <b>' + data.me.score + '</b></div>';
      else if (data && data.ok) me = '<div class="lb-me lb-me-empty">Connecte-toi avec Discord et joue pour apparaître ici.</div>';
      ensureOverlay("🏆 Classement", '<div class="lb-tabs">' + tabs + '</div>' + genRow + '<div class="lb-list">' + list + '</div>' + me);
    })
    .catch(function () { ensureOverlay("🏆 Classement", '<p class="card-desc">Classement indisponible pour le moment.</p>'); });
}

function showToast(msg) {
  var el = document.getElementById("app-toast");
  if (!el) { try { console.warn("toast:", msg); } catch (e) {} return; }
  el.textContent = String(msg == null ? "" : msg);
  el.classList.add("is-visible");
  if (_appToastTimer) clearTimeout(_appToastTimer);
  _appToastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 3200);
}
window.showToast = showToast;

function showErr(msg) {
  document.getElementById("err-msg").textContent = msg;
}

function clearErr() {
  document.getElementById("err-msg").textContent = "";
}

function readJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to read JSON from localStorage:", e);
    return fallbackValue;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Failed to write JSON to localStorage:", e);
  }
}

function loadProfile() {
  const parsed = readJson(STORAGE_KEYS.profile, null);
  playerProfile = {
    nickname: typeof parsed?.nickname === "string" ? parsed.nickname : "",
    favoritePokemonId: Number.isInteger(Number(parsed?.favoritePokemonId)) ? Number(parsed.favoritePokemonId) : null,
    avatarPhoto: typeof parsed?.avatarPhoto === "string" ? parsed.avatarPhoto : "",
    // Engagement system
    xp: Number(parsed?.xp) || 0,
    dailyQuests: Array.isArray(parsed?.dailyQuests) ? parsed.dailyQuests : null,
    dailyQuestsDate: typeof parsed?.dailyQuestsDate === "string" ? parsed.dailyQuestsDate : null,
    dailyLoginStreak: Number(parsed?.dailyLoginStreak) || 0,
    lastDailyLogin: typeof parsed?.lastDailyLogin === "string" ? parsed.lastDailyLogin : null,
    totalQuestsCompleted: Number(parsed?.totalQuestsCompleted) || 0,
    // Préserver les autres champs existants
    higherLowerHighScore: Number(parsed?.higherLowerHighScore) || 0,
    higherLower60sHighScore: Number(parsed?.higherLower60sHighScore) || 0,
    draftScoreAttackRecords: parsed?.draftScoreAttackRecords || {},
    draftScoreHeadToHead: parsed?.draftScoreHeadToHead || {},
    // Records par mode (P4)
    partyHighScore: Number(parsed?.partyHighScore) || 0,
    quizHighScore: Number(parsed?.quizHighScore) || 0,
    speedrunHighScore: Number(parsed?.speedrunHighScore) || 0,
    typeComboHighScore: Number(parsed?.typeComboHighScore) || 0,
    oddOneOutHighScore: Number(parsed?.oddOneOutHighScore) || 0,
    weightBattleHighScore: Number(parsed?.weightBattleHighScore) || 0,
  };
  // Tracking login quotidien pour streak
  const today = getDailyQuestKey();
  if (playerProfile.lastDailyLogin !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (playerProfile.lastDailyLogin === yesterday) {
      playerProfile.dailyLoginStreak = (playerProfile.dailyLoginStreak || 0) + 1;
    } else {
      playerProfile.dailyLoginStreak = 1;
    }
    playerProfile.lastDailyLogin = today;
    try { saveProfile(); } catch (_e) {}
  }
  // Init quests + badge
  ensureDailyQuests();
  if (typeof updateXpBadge === "function") {
    setTimeout(() => updateXpBadge(), 0);
  }
}

function saveProfile() {
  writeJson(STORAGE_KEYS.profile, playerProfile);
  try { if (typeof queueLeaderboardSubmit === "function") queueLeaderboardSubmit(); } catch (e) {}
}

function loadAchievementsState() {
  const parsed = readJson(STORAGE_KEYS.achievements, {});
  unlockedAchievements = parsed && typeof parsed === "object" ? parsed : {};
}

function saveAchievementsState() {
  writeJson(STORAGE_KEYS.achievements, unlockedAchievements);
}

function loadMatchHistory() {
  const parsed = readJson(STORAGE_KEYS.history, []);
  matchHistory = Array.isArray(parsed) ? parsed : [];
}

function saveMatchHistory() {
  writeJson(STORAGE_KEYS.history, matchHistory.slice(0, 120));
}

function getPlayerLevelInfo() {
  const wins = playerStats.wins || 0;
  let current = PLAYER_LEVELS[0];
  let next = null;
  for (let i = 0; i < PLAYER_LEVELS.length; i += 1) {
    if (wins >= PLAYER_LEVELS[i].minWins) current = PLAYER_LEVELS[i];
    if (wins < PLAYER_LEVELS[i].minWins) {
      next = PLAYER_LEVELS[i];
      break;
    }
  }
  const currentMin = current.minWins;
  const nextMin = next ? next.minWins : currentMin + 25;
  const span = Math.max(1, nextMin - currentMin);
  const progress = Math.max(0, Math.min(100, ((wins - currentMin) / span) * 100));
  return { current, next, xp: wins * 100, progress };
}

function evaluateAchievements() {
  let changed = false;
  for (const achievement of ACHIEVEMENT_DEFS) {
    const value = achievement.getValue();
    if (value >= achievement.target && !unlockedAchievements[achievement.id]) {
      unlockedAchievements[achievement.id] = { unlockedAt: Date.now() };
      changed = true;
    }
  }
  if (changed) saveAchievementsState();
}

function getAchievementProgress(achievement) {
  const value = achievement.getValue();
  const current = Math.max(0, Math.min(achievement.target, value));
  const pct = Math.max(0, Math.min(100, (current / achievement.target) * 100));
  return { current, pct, unlocked: Boolean(unlockedAchievements[achievement.id]) };
}

function modeLabelFr(mode) {
  const map = {
    normal: "Solo",
    challenge: "Défi ami",
    daily: "Pokémon du jour",
    silhouette: "Mode zoom progressif",
    pixel: "Mode pixelisé",
    mystery: "Stat Mystère",
    cry: "Cri du Pokémon",
    quiz: "Quiz Pokémon",
    description: "Description Pokédex",
    odd: "Intrus Pokémon",
    weight: "Duel de poids",
    evolution: "Chaîne d'évolution",
    order: "Ordre Pokédex",
    "stat-clash": "Stat Clash 1v1",
    "stat-auction": "Stat Auction 1v1",
    "higher-lower": "Higher or Lower",
    "higher-lower-rush": "Higher or Lower (60s)",
    "poke-connections": "Poké-Connections",
    speedrun: "Speedrun Pokédex",
    party: "Party Pokémon",
  };
  return map[mode] || mode || "Mode inconnu";
}

function findPokemonGlobalByName(raw) {
  const q = norm(String(raw || "").trim());
  if (!q) return null;
  return POKEMON_LIST.find((pokemon) => norm(pokemon.name) === q) || null;
}

function recordMatchHistory(entry) {
  matchHistory.unshift({
    mode: entry.mode || gameMode || "normal",
    result: entry.result || "win",
    attempts: Number(entry.attempts) || 0,
    targetName: entry.targetName || null,
    at: Date.now(),
  });
  matchHistory = matchHistory.slice(0, 120);
  saveMatchHistory();
}

function renderProfileScreen() {
  evaluateAchievements();
  const nicknameInput = document.getElementById("profile-nickname");
  const favoriteInput = document.getElementById("profile-favorite-input");
  const datalist = document.getElementById("profile-favorite-options");
  const saveMsg = document.getElementById("profile-save-msg");
  const favoriteCard = document.getElementById("profile-favorite-card");
  const levelName = document.getElementById("profile-level-name");
  const levelXp = document.getElementById("profile-level-xp");
  const levelBar = document.getElementById("profile-level-bar");
  const totalGames = document.getElementById("profile-total-games");
  const totalWins = document.getElementById("profile-total-wins");
  const currentStreak = document.getElementById("profile-current-streak");
  const bestStreak = document.getElementById("profile-best-streak");
  const achSummary = document.getElementById("profile-achievements-summary");
  const recentWrap = document.getElementById("profile-recent-achievements");

  if (nicknameInput) nicknameInput.value = playerProfile.nickname || "";
  if (favoriteInput) {
    const favorite = playerProfile.favoritePokemonId ? POKEMON_BY_ID.get(playerProfile.favoritePokemonId) : null;
    favoriteInput.value = favorite?.name || "";
  }
  if (datalist && !datalist.dataset.ready) {
    const names = [...new Set(getPokemonUiList()
      .map((pokemon) => pokemon?.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "fr")))];
    datalist.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
    datalist.dataset.ready = "1";
  }

  // DA 2026 : un seul système de niveau partout (XP réel + XP_TIERS, comme le header).
  const profileXp = Number(playerProfile.xp || 0);
  const profileProg = getXpProgress(profileXp);
  if (levelName) levelName.textContent = `Niv. ${profileProg.tier.level} · ${profileProg.tier.name}`;
  if (levelXp) levelXp.textContent = `XP : ${profileXp}`;
  if (levelBar) levelBar.style.width = `${profileProg.percent}%`;
  if (totalGames) totalGames.textContent = String(playerStats.played || 0);
  if (totalWins) totalWins.textContent = String(playerStats.wins || 0);
  if (currentStreak) currentStreak.textContent = String(playerStats.dailyCurrentStreak || 0);
  if (bestStreak) bestStreak.textContent = String(playerStats.dailyBestStreak || 0);

  if (favoriteCard) {
    favoriteCard.innerHTML = "";
    const favorite = playerProfile.favoritePokemonId ? POKEMON_BY_ID.get(playerProfile.favoritePokemonId) : null;
    if (favorite) {
      favoriteCard.innerHTML = `<div class="pokemon-mini-card"><img src="${getPokemonSprite(favorite)}" alt="${escapeHtml(favorite.name)}" loading="lazy" data-fallback="${getSpriteUrl(getPokemonSpriteId(favorite))}" /><strong>${escapeHtml(favorite.name)}</strong><div class="pokemon-card-types">${typeBadgesHtml(favorite.type1, favorite.type2)}</div></div>`;
    } else {
      favoriteCard.innerHTML = '<p class="card-desc">Choisis un Pokémon favori pour l’afficher ici.</p>';
    }
  }
  const trainerCard = document.getElementById("profile-trainer-card");
  if (trainerCard) {
    const fav = playerProfile.favoritePokemonId ? POKEMON_BY_ID.get(playerProfile.favoritePokemonId) : null;
    const photo = playerProfile.avatarPhoto || "";
    const avatar = photo
      ? `<img src="${photo}" alt="Photo de profil" />`
      : (fav
        ? `<img src="${getPokemonSprite(fav)}" alt="${escapeHtml(fav.name)}" loading="lazy" data-fallback="${getSpriteUrl(getPokemonSpriteId(fav))}" />`
        : `<span class="trainer-card-avatar-empty">?</span>`);
    const pseudo = playerProfile.nickname && playerProfile.nickname.trim() ? escapeHtml(playerProfile.nickname.trim()) : "Dresseur";
    const badgesUnlocked = ACHIEVEMENT_DEFS.filter((a) => unlockedAchievements[a.id]).length;
    trainerCard.innerHTML = `
      <div class="trainer-card-avatar">${avatar}</div>
      <div class="trainer-card-main">
        <span class="trainer-card-eyebrow">🎫 Carte de Dresseur</span>
        <strong class="trainer-card-name">${pseudo}</strong>
        <span class="trainer-card-title">Niv. ${profileProg.tier.level} · ${escapeHtml(profileProg.tier.name)}</span>
        <div class="trainer-card-bar"><i style="width:${profileProg.percent}%"></i></div>
        <div class="trainer-card-chips">
          <span class="trainer-card-chip">🏆 ${playerStats.wins || 0} victoires</span>
          <span class="trainer-card-chip">🎮 ${playerStats.played || 0} parties</span>
          <span class="trainer-card-chip">🔥 ${playerStats.dailyBestStreak || 0} record série</span>
          <span class="trainer-card-chip">🏅 ${badgesUnlocked}/${ACHIEVEMENT_DEFS.length} succès</span>
        </div>
        <div class="trainer-card-photo-actions"><button type="button" class="trainer-card-photo-action" data-action="triggerProfilePhoto">📷 ${photo ? "Changer" : "Ajouter"} ma photo</button>${photo ? '<button type="button" class="trainer-card-photo-action is-remove" data-action="removeProfilePhoto">Retirer</button>' : ''}</div>
      </div>`;
  }

  if (achSummary) {
    const unlockedCount = ACHIEVEMENT_DEFS.filter((a) => unlockedAchievements[a.id]).length;
    achSummary.innerHTML = `
      <div class="profile-stat-card"><span>Débloqués</span><b>${unlockedCount}</b></div>
      <div class="profile-stat-card"><span>Total</span><b>${ACHIEVEMENT_DEFS.length}</b></div>
    `;
  }

  if (recentWrap) {
    const recent = ACHIEVEMENT_DEFS
      .filter((a) => unlockedAchievements[a.id])
      .sort((a, b) => (unlockedAchievements[b.id]?.unlockedAt || 0) - (unlockedAchievements[a.id]?.unlockedAt || 0))
      .slice(0, 4);
    recentWrap.innerHTML = recent.length
      ? recent.map((a) => `<div class="profile-achievement-item"><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.desc)}</span><small>${new Date(unlockedAchievements[a.id].unlockedAt).toLocaleDateString("fr-FR")}</small></div>`).join("")
      : '<p class="card-desc">Aucun succès débloqué pour le moment.</p>';
  }

  // Records par mode
  const modeRecordsWrap = document.getElementById("profile-mode-records");
  if (modeRecordsWrap) {
    const records = [];
    // Higher or Lower
    const hlInf = Number(playerProfile.higherLowerHighScore) || 0;
    const hl60 = Number(playerProfile.higherLower60sHighScore) || 0;
    if (hlInf > 0 || hl60 > 0) {
      records.push({ icon: "📊", label: "Higher or Lower", value: `${hlInf} infini · ${hl60} en 60s`, color: "blue" });
    }
    // Speedrun
    const speedrun = Number(playerProfile.speedrunHighScore) || 0;
    if (speedrun > 0) {
      records.push({ icon: "⚡", label: "Speedrun Pokédex", value: `${speedrun} Pokémon en 60s`, color: "orange" });
    }
    // Quiz
    const quiz = Number(playerProfile.quizHighScore) || 0;
    if (quiz > 0) {
      records.push({ icon: "❓", label: "Quiz Pokémon", value: `${quiz} bonnes réponses`, color: "blue" });
    }
    // Party Pokémon
    const party = Number(playerProfile.partyHighScore) || 0;
    if (party > 0) {
      records.push({ icon: "🎲", label: "Party Pokémon", value: `${party} victoires en une session`, color: "gold" });
    }
    // Intrus / Poids — meilleure série
    const oddSerie = Number(playerProfile.oddOneOutHighScore) || 0;
    if (oddSerie > 0) {
      records.push({ icon: "🧩", label: "Intrus Pokémon", value: `${oddSerie} d'affilée`, color: "blue" });
    }
    const weightSerie = Number(playerProfile.weightBattleHighScore) || 0;
    if (weightSerie > 0) {
      records.push({ icon: "⚖️", label: "Duel de poids", value: `${weightSerie} d'affilée`, color: "blue" });
    }
    // Score Attack par gen
    const saRecords = playerProfile.draftScoreAttackRecords || {};
    for (const gen of Object.keys(saRecords)) {
      const val = Number(saRecords[gen]) || 0;
      if (val > 0) {
        records.push({ icon: "🎯", label: `Score Attack Gen ${gen}`, value: `${val} BST moyen`, color: "gold" });
      }
    }
    if (records.length) {
      modeRecordsWrap.innerHTML = records.map((r) => `<div class="profile-record-card is-${r.color}"><span class="profile-record-icon">${r.icon}</span><div><b>${escapeHtml(r.label)}</b><span>${escapeHtml(r.value)}</span></div></div>`).join("");
    } else {
      modeRecordsWrap.innerHTML = '<p class="card-desc">Pas encore de record. Joue à Higher or Lower, Score Attack, Speedrun, Quiz ou Party Pokémon pour battre tes premiers scores !</p>';
    }
  }

  // Bilans head-to-head
  const h2hWrap = document.getElementById("profile-h2h-records");
  if (h2hWrap) {
    const all = playerProfile.draftScoreHeadToHead || {};
    const opponents = Object.entries(all)
      .map(([nickname, stats]) => ({ nickname, wins: Number(stats.wins) || 0, losses: Number(stats.losses) || 0, draws: Number(stats.draws) || 0 }))
      .filter((entry) => (entry.wins + entry.losses + entry.draws) > 0)
      .sort((a, b) => (b.wins + b.losses + b.draws) - (a.wins + a.losses + a.draws));
    if (opponents.length) {
      h2hWrap.innerHTML = opponents.map((opp) => {
        const total = opp.wins + opp.losses + opp.draws;
        const lead = opp.wins > opp.losses ? "is-winning" : opp.losses > opp.wins ? "is-losing" : "is-tied";
        return `<div class="profile-h2h-card ${lead}"><b>${escapeHtml(opp.nickname)}</b><span class="profile-h2h-stats"><b class="is-w">${opp.wins}V</b> · <b class="is-l">${opp.losses}D</b>${opp.draws ? ` · <b class="is-t">${opp.draws}N</b>` : ""}</span><small>${total} duel${total > 1 ? "s" : ""}</small></div>`;
      }).join("");
    } else {
      h2hWrap.innerHTML = '<p class="card-desc">Aucun duel Score Attack 1v1 encore. Crée une room pour défier un ami.</p>';
    }
  }

  if (saveMsg) saveMsg.classList.add("hidden");
}

function renderAchievementsScreen() {
  evaluateAchievements();
  const summary = document.getElementById("achievements-summary");
  const list = document.getElementById("achievements-list");
  if (summary) {
    const unlockedCount = ACHIEVEMENT_DEFS.filter((a) => unlockedAchievements[a.id]).length;
    summary.innerHTML = `
      <div class="achievements-summary-item"><span>Débloqués</span><b>${unlockedCount}</b></div>
      <div class="achievements-summary-item"><span>Total</span><b>${ACHIEVEMENT_DEFS.length}</b></div>
      <div class="achievements-summary-item"><span>Progression</span><b>${Math.round((unlockedCount / Math.max(1, ACHIEVEMENT_DEFS.length)) * 100)}%</b></div>
    `;
  }
  if (list) {
    const CAT_ICONS = { "Devinette": "🎯", "Régularité": "📅", "Progression": "⭐", "Mini-jeux": "🎮" };
    const cats = [];
    ACHIEVEMENT_DEFS.forEach((a) => { const c = a.category || "Autres"; if (cats.indexOf(c) === -1) cats.push(c); });
    list.innerHTML = cats.map((cat) => {
      const defs = ACHIEVEMENT_DEFS.filter((a) => (a.category || "Autres") === cat);
      const unlockedN = defs.filter((a) => unlockedAchievements[a.id]).length;
      const cards = defs.map((achievement) => {
        const progress = getAchievementProgress(achievement);
        return `<article class="achievement-card ${progress.unlocked ? "unlocked" : ""}">
          <span class="achievement-medal">${progress.unlocked ? "✓" : "🔒"}</span>
          <div class="achievement-body">
            <div class="achievement-head"><strong>${escapeHtml(achievement.title)}</strong><span>${progress.unlocked ? "Débloqué" : "En cours"}</span></div>
            <p>${escapeHtml(achievement.desc)}</p>
            <div class="achievement-progress"><i style="width:${progress.pct}%"></i></div>
            <small>${progress.current} / ${achievement.target}</small>
          </div>
        </article>`;
      }).join("");
      return `<section class="achievement-category">
        <header class="achievement-cat-head"><h3>${CAT_ICONS[cat] || "🏅"} ${escapeHtml(cat)}</h3><span class="achievement-cat-count">${unlockedN}/${defs.length}</span></header>
        <div class="achievement-cat-grid">${cards}</div>
      </section>`;
    }).join("");
  }
}

function renderMatchHistoryScreen() {
  const filter = document.getElementById("match-history-filter");
  const list = document.getElementById("match-history-list");
  if (!filter || !list) return;

  const modes = ["all"].concat([...new Set(matchHistory.map((entry) => entry.mode))]);
  const current = filter.value || "all";
  filter.innerHTML = modes.map((mode) => `<option value="${mode}">${mode === "all" ? "Tous les modes" : modeLabelFr(mode)}</option>`).join("");
  filter.value = modes.includes(current) ? current : "all";

  const filtered = matchHistory.filter((entry) => filter.value === "all" || entry.mode === filter.value);
  list.innerHTML = filtered.length
    ? filtered.map((entry) => `<article class="match-history-item is-${entry.result === "win" ? "win" : "loss"}">
        <div class="match-history-main">
          <div class="match-history-top">
            <span class="match-history-mode">${escapeHtml(modeLabelFr(entry.mode))}</span>
            <span class="match-history-result">${entry.result === "win" ? "Victoire" : "Défaite"}</span>
          </div>
          <div class="match-history-meta">
            <span>${entry.attempts} essai${entry.attempts > 1 ? "s" : ""}</span>
            <span>${new Date(entry.at).toLocaleString("fr-FR")}</span>
          </div>
          <div class="match-history-target">Cible : <b>${escapeHtml(entry.targetName || "—")}</b></div>
        </div>
      </article>`).join("")
    : '<p class="card-desc">Aucune partie enregistrée pour le moment.</p>';
}




































































































































// ============================================================
// Compatibility layer for current homepage / screens
// ============================================================
function hideScreen(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function closeNavDropdowns() {
  var a = document.activeElement;
  if (a && typeof a.blur === 'function' && a.closest && a.closest('.nav-group')) {
    a.blur();
  }
}

function hideAllScreens() {
  closeNavDropdowns();
  document.querySelectorAll('[id^="screen-"]').forEach(function (el) {
    el.classList.add('hidden');
  });
}

function showScreen(id) {
  hideAllScreens();
  document.getElementById(id)?.classList.remove('hidden');
  window.scrollTo(0, 0);
}

function hideExtraScreens() {
  ['screen-profile','screen-achievements','screen-history','screen-odd-one-out','screen-multiplayer','screen-games-ranking','screen-type-chart','screen-team-builder','screen-teams','screen-stat-clash','screen-higher-lower','screen-poke-connections','screen-stat-auction','screen-draft-score-attack','screen-speedrun'].forEach(hideScreen);
}

function ensureOverlay(title, html) {
  const overlay = document.getElementById('overlay-modal');
  const titleEl = document.getElementById('overlay-title');
  const bodyEl = document.getElementById('overlay-body');
  if (!overlay || !titleEl || !bodyEl) {
    showToast(title);
    return;
  }
  titleEl.textContent = title;
  bodyEl.innerHTML = html;
  overlay.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeOverlayModal() {
  document.getElementById('overlay-modal')?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function onOverlayBackdropClick(event) {
  if (event.target && event.target.id === 'overlay-modal') closeOverlayModal();
}

const APP_SETTINGS_STORAGE_KEY = "pokedle_app_settings_v1";
const DEFAULT_APP_SETTINGS = {
  theme: "light",
  density: "normal",
  textScale: "normal",
  highContrast: false,
  reduceMotion: false,
};

function getStoredAppSettings() {
  // Lot C audit : on respecte @media (prefers-reduced-motion) par défaut,
  // tant que l'utilisateur n'a pas fait de choix explicite dans les paramètres.
  const defaults = { ...DEFAULT_APP_SETTINGS };
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      defaults.reduceMotion = true;
    }
  } catch (_err) { /* matchMedia indisponible */ }
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch (error) {
    console.warn("Failed to read app settings:", error);
    return { ...defaults };
  }
}

function saveAppSettings(settings) {
  try {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to save app settings:", error);
  }
}

function applyAppSettings(settings = getStoredAppSettings()) {
  document.body.classList.toggle("theme-dark", settings.theme === "dark");
  document.body.classList.toggle("density-compact", settings.density === "compact");
  document.body.classList.toggle("density-airy", settings.density === "airy");
  document.body.classList.toggle("text-scale-small", settings.textScale === "small");
  document.body.classList.toggle("text-scale-large", settings.textScale === "large");
  document.body.classList.toggle("a11y-high-contrast", Boolean(settings.highContrast));
  document.body.classList.toggle("reduce-motion", Boolean(settings.reduceMotion));
}

function updateAppSetting(key, value) {
  const settings = getStoredAppSettings();
  settings[key] = value;
  saveAppSettings(settings);
  applyAppSettings(settings);
}

function resetAppSettings() {
  saveAppSettings({ ...DEFAULT_APP_SETTINGS });
  applyAppSettings(DEFAULT_APP_SETTINGS);
  openSettingsModal();
}

function getActiveScreenId() {
  const screens = document.querySelectorAll('[id^="screen-"]');
  for (const el of screens) {
    if (!el.classList.contains('hidden')) return el.id;
  }
  return '';
}

function getHelpContentForGameMode(mode) {
  switch (mode) {
    case 'description':
      return {
        title: 'Description Pokédex',
        body: `
          <section class="app-help-card">
            <h4>Devine à partir du texte</h4>
            <p>Une description officielle du Pokédex s'affiche. Tape le nom du Pokémon qu'elle décrit — l'autocomplétion t'aide, accents facultatifs.</p>
          </section>`
      };
    case 'weight':
      return {
        title: 'Duel de poids',
        body: `
          <section class="app-help-card">
            <h4>Plus lourd ou plus léger ?</h4>
            <p>Deux Pokémon s'affrontent : choisis celui que tu penses être le plus lourd. Enchaîne les bonnes réponses pour faire grimper ta série.</p>
          </section>`
      };
    case 'evolution':
      return {
        title: 'Chaîne d\'évolution',
        body: `
          <section class="app-help-card">
            <h4>Le maillon manquant</h4>
            <p>Une lignée d'évolution s'affiche avec un membre masqué. Retrouve le Pokémon manquant avec la barre de recherche.</p>
          </section>`
      };
    case 'order':
      return {
        title: 'Ordre Pokédex',
        body: `
          <section class="app-help-card">
            <h4>Entre deux numéros</h4>
            <p>Deux entrées du Pokédex national s'affichent : trouve le Pokémon situé entre les deux numéros.</p>
          </section>`
      };
    case 'daily':
      return {
        title: 'Pokémon du jour',
        body: `
          <section class="app-help-card">
            <h4>Une cible quotidienne</h4>
            <p>Le Pokémon à deviner est <b>le même pour tous les joueurs</b>, et change à minuit (UTC). Tu peux tenter autant d'essais que tu veux dans la journée.</p>
          </section>
          <section class="app-help-card">
            <h4>Indices après chaque essai</h4>
            <p>Chaque ligne affiche un comparatif avec ton essai : <b>génération</b>, <b>types</b> (1 et 2), <b>habitat</b>, <b>couleur</b>, <b>stade</b> d'évolution, <b>taille</b> et <b>poids</b>. Vert = correct, jaune = proche, rouge = différent. Les flèches ▲/▼ t'indiquent si la vraie valeur est plus grande ou plus petite.</p>
          </section>
          <section class="app-help-card">
            <h4>Série & record</h4>
            <p>Gagner alimente ta <b>série actuelle</b> 🔥 et ton <b>record</b> 🏆 (visibles sur l'accueil). Une journée ratée remet la série à zéro.</p>
          </section>
        `,
      };
    case 'normal':
      return {
        title: 'Mode illimité',
        body: `
          <section class="app-help-card">
            <h4>Partie libre, à volonté</h4>
            <p>Devine un Pokémon mystère tiré <b>aléatoirement</b> dans les générations que tu as cochées sur l'accueil. Tu peux relancer autant que tu veux.</p>
          </section>
          <section class="app-help-card">
            <h4>Indices après chaque essai</h4>
            <p>Génération, types, habitat, couleur, stade, taille, poids — chaque colonne te dit si c'est correct, proche ou différent. Les flèches ▲/▼ pointent vers la vraie valeur.</p>
          </section>
        `,
      };
    case 'silhouette':
      return {
        title: 'Silhouette',
        body: `
          <section class="app-help-card">
            <h4>Zoom progressif</h4>
            <p>Le sprite est extrêmement <b>zoomé au départ</b> et se dézoome à chaque essai. Tu joues sur les générations cochées sur l'accueil.</p>
          </section>
          <section class="app-help-card">
            <h4>Indices classiques en plus</h4>
            <p>Les indices habituels (génération, types, habitat, etc.) s'ajoutent après chaque tentative, comme en Mode illimité.</p>
          </section>
        `,
      };
    case 'pixel':
      return {
        title: 'Mode pixelisé',
        body: `
          <section class="app-help-card">
            <h4>Le sprite se révèle</h4>
            <p>Le sprite est <b>très pixelisé</b> au départ. Le flou diminue à chaque essai pour rendre l'image de plus en plus lisible.</p>
          </section>
          <section class="app-help-card">
            <h4>Indices classiques</h4>
            <p>Tous les indices habituels (gen, types, habitat, couleur, etc.) s'affichent en parallèle après chaque essai.</p>
          </section>
        `,
      };
    case 'cry':
      return {
        title: 'Cri du Pokémon',
        body: `
          <section class="app-help-card">
            <h4>Écoute le cri 🔊</h4>
            <p>Le bouton lecture joue le <b>cri du Pokémon mystère</b>. Tu peux le rejouer autant de fois que tu veux. Devine à l'oreille.</p>
          </section>
          <section class="app-help-card">
            <h4>Indices classiques</h4>
            <p>Les comparatifs (gen, types, habitat, etc.) s'affichent à chaque essai pour t'aider à converger.</p>
          </section>
        `,
      };
    case 'mystery':
      return {
        title: 'Stat mystère',
        body: `
          <section class="app-help-card">
            <h4>Devine via les stats</h4>
            <p>Chaque essai te dévoile une <b>statistique de base</b> du Pokémon mystère (PV, Attaque, Défense, Atk Spé, Déf Spé, Vitesse). Compare avec ton essai pour resserrer le filet.</p>
          </section>
          <section class="app-help-card">
            <h4>Indices classiques en plus</h4>
            <p>Les indices habituels (gen, types, habitat…) restent dispos pour t'aider.</p>
          </section>
        `,
      };
    case 'quiz':
      return {
        title: 'Quiz Pokémon',
        body: `
          <section class="app-help-card">
            <h4>Questions à choix multiples</h4>
            <p>Une série de questions sur l'univers Pokémon (génération, type, stat dominante, signature, etc.). Choisis la bonne réponse parmi les 4 propositions.</p>
          </section>
          <section class="app-help-card">
            <h4>Score final</h4>
            <p>À la fin du quiz, tu vois ton score sur le total de questions. Aucun indice supplémentaire entre les questions.</p>
          </section>
        `,
      };
    case 'challenge':
      return {
        title: 'Défi personnalisé',
        body: `
          <section class="app-help-card">
            <h4>Le Pokémon est imposé</h4>
            <p>Quelqu'un t'a partagé un lien de défi qui choisit un Pokémon mystère pour toi. Devine-le avec les indices habituels.</p>
          </section>
        `,
      };
    default:
      return null;
  }
}

const HELP_BY_SCREEN = {
  'screen-config': {
    title: 'Accueil',
    body: `
      <section class="app-help-card">
        <h4>Choisis tes générations</h4>
        <p>La carte <b>🧬 Générations</b> en haut filtre le pool utilisé par les modes aléatoires (mode illimité, silhouette, pixelisé, cri, stat mystère…). Les boutons <b>Tout</b> et <b>Aucune</b> sélectionnent en masse. <b>Au moins une gen</b> doit rester cochée.</p>
      </section>
      <section class="app-help-card">
        <h4>Pokémon du jour</h4>
        <p>Le hero "▶ Jouer maintenant" et la pillar "Pokémon du jour" lancent le <b>mode daily</b> : une cible identique pour tous, qui change chaque jour. Indépendant des générations cochées.</p>
      </section>
      <section class="app-help-card">
        <h4>Tous les modes via la nav</h4>
        <p>Le menu <b>Jouer</b> liste tous les modes solo. <b>Social</b> contient Duel 1v1, Stat Clash, défis. <b>Outils</b> regroupe Team Builder, Draft Arènes, Table des types, Émulateur, etc.</p>
      </section>
      <section class="app-help-card">
        <h4>Profil & succès</h4>
        <p>Tes statistiques (série quotidienne, record, victoires) s'affichent en bas de l'accueil. Plus de détails via les boutons <b>Profil</b> et <b>Succès</b> dans la nav.</p>
      </section>
    `,
  },
  'screen-multiplayer': {
    title: 'Duel 1v1 (multijoueur)',
    body: `
      <section class="app-help-card">
        <h4>Créer ou rejoindre une room</h4>
        <p><b>Créer</b> une room te donne un code à partager. <b>Rejoindre</b> demande ce code à ton ami. Quand vous êtes 2, le créateur lance la partie.</p>
      </section>
      <section class="app-help-card">
        <h4>Même Pokémon, course à la victoire</h4>
        <p>Vous devinez tous les deux le <b>même Pokémon mystère</b> en parallèle, chacun avec ses essais. Le premier à trouver gagne la manche.</p>
      </section>
      <section class="app-help-card">
        <h4>Générations sélectionnées</h4>
        <p>Le créateur choisit les générations utilisées. Tu peux les modifier avant de relancer.</p>
      </section>
    `,
  },
  'screen-stat-clash': {
    title: 'Stat Clash 1v1',
    body: `
      <section class="app-help-card">
        <h4>Le principe</h4>
        <p>À chaque round, un Pokémon est tiré. Vous choisissez <b>chacun secrètement une stat</b> (Atk, Déf, Vit, etc.). Celui qui a la stat la plus haute marque le point.</p>
      </section>
      <section class="app-help-card">
        <h4>6 rounds, gestion de ressources</h4>
        <p>Tu ne peux pas réutiliser une stat déjà jouée. Bien planifier les "manches faciles" et garder ses meilleures stats pour les Pokémon ambigus est la clé.</p>
      </section>
      <section class="app-help-card">
        <h4>Solo ou 1v1 en ligne</h4>
        <p>Joue contre un bot pour t'entraîner, ou crée/rejoins une room pour affronter un ami.</p>
      </section>
    `,
  },
  'screen-draft-arena': {
    title: 'Draft Arènes',
    body: `
      <section class="app-help-card">
        <h4>1) Choisis une génération</h4>
        <p>La gen détermine les 8 arènes que tu vas affronter (chaque champion spécialiste d'un type) et le pool de Pokémon pour drafter.</p>
      </section>
      <section class="app-help-card">
        <h4>2) Drafte 6 Pokémon</h4>
        <p>À chaque tour, 4 propositions aléatoires (pondérées par stats). Tu en choisis 1, les autres se renouvellent. Tu ne peux pas reprendre un Pokémon déjà sélectionné.</p>
      </section>
      <section class="app-help-card">
        <h4>3) Combat GBA-style</h4>
        <p>Une fois l'équipe complète, lance le duel. Combat tour par tour façon Vert Feuille : menu <b>ATTAQUE</b> (4 attaques avec Type/PP), <b>POKÉMON</b> (changer de lead — switch manuel <b>ne consomme pas</b> ton tour), <b>SAC</b> et <b>FUITE</b> indisponibles en run arène.</p>
      </section>
      <section class="app-help-card">
        <h4>4) Affronter un ami</h4>
        <p>Bouton <b>🆚 Combat ami</b> dans la barre du haut : crée une room avec ta team draftée, partage le code. <b>🔗 Rejoindre code</b> pour rejoindre une room existante.</p>
      </section>
    `,
  },
  'screen-draft-score-attack': {
    title: 'Draft Score Attack',
    body: `
      <section class="app-help-card">
        <h4>Objectif</h4>
        <p>Drafte 6 Pokémon et vise la meilleure <b>moyenne BST</b> possible. Le total et la moyenne sont calculés en direct.</p>
      </section>
      <section class="app-help-card">
        <h4>Relances</h4>
        <p>Tu disposes d'un nombre limité de relances pour changer la vague de propositions avant de choisir.</p>
      </section>
      <section class="app-help-card">
        <h4>1v1 Score</h4>
        <p>Crée ou rejoins une room : chaque joueur drafte sa team, puis la meilleure moyenne BST gagne.</p>
      </section>
    `,
  },
  'screen-pokedex': {
    title: 'Pokédex',
    body: `
      <section class="app-help-card">
        <h4>Filtrer & trier</h4>
        <p>Recherche par nom, filtre par génération, par type principal et secondaire, et trie par numéro, nom, BST… Bouton <b>Shiny</b> pour basculer la grille en mode shiny.</p>
      </section>
      <section class="app-help-card">
        <h4>Fiche détaillée</h4>
        <p>Clique un Pokémon pour voir : sprite (normal/shiny toggle), types, talents (dont caché), stats avec barres, mensurations, formes alternatives (méga, alolan, gigamax…). Boutons <b>Comparer</b> et <b>Ajouter au Team Builder</b>.</p>
      </section>
      <section class="app-help-card">
        <h4>Comparateur</h4>
        <p>Ouvre une comparaison côte à côte entre 2 Pokémon. Utile pour choisir un draft, un duel ou un team builder.</p>
      </section>
    `,
  },
  'screen-team-builder': {
    title: 'Team Builder',
    body: `
      <section class="app-help-card">
        <h4>Composer une équipe de 6</h4>
        <p>Pour chaque slot : choisis un Pokémon, son objet tenu, son gimmick (Dynamax, Tera, etc.), et 4 attaques. La sauvegarde reste <b>locale</b> dans ton navigateur.</p>
      </section>
      <section class="app-help-card">
        <h4>EV / IV</h4>
        <p>Tu peux régler les EV et IV par stat. Le builder calcule les stats finales en N.100. Un panneau récap affiche la couverture de types offensive et défensive de l'équipe entière.</p>
      </section>
      <section class="app-help-card">
        <h4>Mes teams</h4>
        <p>Bouton <b>🧩 Bases d'équipes</b> pour sauvegarder et rappeler plusieurs teams. Tout reste en local.</p>
      </section>
    `,
  },
  'screen-teams': {
    title: 'Mes teams',
    body: `
      <section class="app-help-card">
        <h4>Tes équipes sauvegardées</h4>
        <p>Liste de toutes les teams enregistrées localement. Clique une pour la rouvrir dans le Team Builder, ou supprime celles dont tu ne te sers plus.</p>
      </section>
    `,
  },
  'screen-emulator': {
    title: 'Émulateur ROM',
    body: `
      <section class="app-help-card">
        <h4>ROMs intégrées</h4>
        <p>Sélectionne <b>Rouge Feu</b>, <b>Vert Feuille</b>, <b>Cristal</b> ou <b>Platine</b> dans le menu, puis clique ▶ Lancer.</p>
      </section>
      <section class="app-help-card">
        <h4>Charger une ROM</h4>
        <p>Bouton <b>📁 Charger une autre ROM</b> pour utiliser un fichier .gba / .gbc / .gb / .nds de ton disque dur.</p>
      </section>
      <section class="app-help-card">
        <h4>Contrôles clavier</h4>
        <p><b>Z</b> = A, <b>X</b> = B, <b>Entrée</b> = Start, <b>Shift</b> = Select, <b>A</b> = L, <b>S</b> = R, <b>Flèches</b> = direction. <b>Souris</b> = écran tactile (DS).</p>
      </section>
    `,
  },
  'screen-ranking': {
    title: 'Mode classement',
    body: `
      <section class="app-help-card">
        <h4>Tableau personnel</h4>
        <p>Une grille où tu places ton Pokémon préféré <b>par génération et par type</b> (plus quelques catégories spéciales). Sauvegarde locale, à toi de jouer aux tier listes.</p>
      </section>
      <section class="app-help-card">
        <h4>Clic = choix</h4>
        <p>Clique une case pour ouvrir le sélecteur de Pokémon correspondant à la gen et au type de la case.</p>
      </section>
    `,
  },
  'screen-games-ranking': {
    title: 'Classement des jeux',
    body: `
      <section class="app-help-card">
        <h4>Ton podium personnel</h4>
        <p>Classe les jeux Pokémon que tu as joués (par génération / version). Sauvegarde locale.</p>
      </section>
    `,
  },
  'screen-type-chart': {
    title: 'Table des types',
    body: `
      <section class="app-help-card">
        <h4>Référence d'efficacité</h4>
        <p>La table classique attaquant × défenseur : ×2 super efficace, ×½ peu efficace, ×0 sans effet. Filtre par générations pour voir les évolutions historiques (Gen 1 sans Acier/Ténèbres/Fée, etc.).</p>
      </section>
      <section class="app-help-card">
        <h4>Mode duel</h4>
        <p>Tu peux aussi voir l'efficacité d'un type contre 1 ou 2 types (idéal pour préparer une attaque ou une défense en double type).</p>
      </section>
    `,
  },
  'screen-profile': {
    title: 'Profil joueur',
    body: `
      <section class="app-help-card">
        <h4>Statistiques globales</h4>
        <p>Ton pseudo, ton Pokémon favori, ta série quotidienne, ton record, total de victoires par mode. Tout est stocké en local — pas de compte distant.</p>
      </section>
      <section class="app-help-card">
        <h4>Édition</h4>
        <p>Change ton pseudo ou ton Pokémon favori. Le pseudo est utilisé en multijoueur (Duel 1v1, Stat Clash, Draft 1v1).</p>
      </section>
    `,
  },
  'screen-achievements': {
    title: 'Succès',
    body: `
      <section class="app-help-card">
        <h4>Objectifs débloqués</h4>
        <p>Liste des accomplissements liés à tes parties (première victoire, séries, modes terminés, etc.). Plus tu joues, plus ça remplit.</p>
      </section>
    `,
  },
  'screen-history': {
    title: 'Historique des parties',
    body: `
      <section class="app-help-card">
        <h4>Tes 50 dernières parties</h4>
        <p>Mode joué, résultat (gagné/perdu/abandonné), Pokémon mystère, nombre d'essais, durée. Filtre par mode si besoin.</p>
      </section>
    `,
  },
  'screen-higher-lower': {
    title: 'Higher or Lower',
    body: `
      <section class="app-help-card">
        <h4>Devine si la stat est plus haute ou plus basse</h4>
        <p>Tu vois 2 Pokémon côte à côte avec la valeur d'une stat (PV/Attaque/Vitesse...) sur le 1er. Devine si le 2e est plus haut ou plus bas. Bonne réponse = streak, mauvaise = game over.</p>
      </section>
      <section class="app-help-card">
        <h4>Modes</h4>
        <p><b>Mode infini</b> : enchaîne jusqu'à la première erreur, record perso sauvegardé.<br><b>Course 60s</b> : maximum de bonnes réponses en 60s, les erreurs ne game over pas.<br><b>Versus 1v1</b> : crée une room avec un ami, course 60s synchronisée avec score adverse live.</p>
      </section>
    `,
  },
  'screen-speedrun': {
    title: 'Speedrun Pokédex',
    body: `
      <section class="app-help-card">
        <h4>60 secondes pour deviner le max de Pokémon</h4>
        <p>Tu vois le sprite, tape le nom (accents et casse ignorés). Entrée pour valider, Entrée vide pour passer. Best streak tracké. Record perso sauvegardé.</p>
      </section>
      <section class="app-help-card">
        <h4>Astuces</h4>
        <p>Tape vite, ne perds pas de temps sur ceux que tu connais pas. +5 XP par bonne réponse + bonus si nouveau record.</p>
      </section>
    `,
  },
  'screen-poke-connections': {
    title: 'Poké-Connections',
    body: `
      <section class="app-help-card">
        <h4>Regroupe les 16 Pokémon par 4</h4>
        <p>Style NYT Connections : 16 Pokémon en grille. Trouve les 4 groupes de 4 selon un thème caché (type, génération, habitat, couleur, stade d'évolution). 4 erreurs max.</p>
      </section>
      <section class="app-help-card">
        <h4>Astuces</h4>
        <p>Commence par les groupes les plus évidents pour réduire l'incertitude sur les autres. Le bouton "Mélanger" rebrasse les tuiles non trouvées si tu sèches.</p>
      </section>
    `,
  },
  'screen-stat-auction': {
    title: 'Stat Auction 1v1',
    body: `
      <section class="app-help-card">
        <h4>Réparts 100 pts secrètement sur 6 stats</h4>
        <p>Avant chaque manche, un Pokémon est révélé. Tu as 100 pts à mettre sur les 6 stats (PV/Atk/Def/AtkSp/DefSp/Vit). Score = somme (alloc × vraie_stat). Le total le plus haut gagne la manche. 5 manches en duel.</p>
      </section>
      <section class="app-help-card">
        <h4>Stratégie</h4>
        <p>Devine les stats fortes du Pokémon affiché. Un Pokémon physique = max Atk. Un mur = max Def/PV. Risk/reward : tout miser sur une stat ou répartir.</p>
      </section>
    `,
  },
  'screen-odd-one-out': {
    title: 'L\'intrus',
    body: `
      <section class="app-help-card">
        <h4>Trouve l'intrus</h4>
        <p>4 Pokémon sont affichés. Trois partagent une caractéristique commune (même type, même habitat, même gen, etc.), le quatrième est l'intrus. À toi de le repérer.</p>
      </section>
    `,
  },
};

function openHelpModal() {
  const activeScreenId = getActiveScreenId();
  // Cas spécial : screen-game → branche sur le gameMode actif pour aide précise
  if (activeScreenId === 'screen-game') {
    const modeHelp = getHelpContentForGameMode(typeof gameMode !== 'undefined' ? gameMode : '');
    if (modeHelp) {
      ensureOverlay(`Aide — ${modeHelp.title}`, `<div class="app-help-grid">${modeHelp.body}</div>`);
      return;
    }
  }
  const cfg = HELP_BY_SCREEN[activeScreenId];
  if (cfg) {
    ensureOverlay(`Aide — ${cfg.title}`, `<div class="app-help-grid">${cfg.body}</div>`);
    return;
  }
  // Fallback générique
  ensureOverlay('Aide', `
    <div class="app-help-grid">
      <section class="app-help-card">
        <h4>Deviner</h4>
        <p>Choisis les générations, lance un mode, puis utilise les indices après chaque tentative : génération, types, habitat, couleur, stade, taille et poids.</p>
      </section>
      <section class="app-help-card">
        <h4>Modes rapides</h4>
        <p>Pokémon du jour propose une cible quotidienne. Le Mode illimité relance une partie libre. Party Pokémon enchaîne plusieurs mini-jeux.</p>
      </section>
      <section class="app-help-card">
        <h4>Multijoueur</h4>
        <p>Crée une room, partage le code, puis affronte un ami sur le même Pokémon mystère.</p>
      </section>
      <section class="app-help-card">
        <h4>Outils</h4>
        <p>Le Pokédex sert à filtrer, comparer et consulter les fiches. Le Team Builder aide à préparer une équipe et la table des types sert de référence.</p>
      </section>
    </div>
    <p class="app-help-tip">Astuce : les boutons "Tout" et "Aucune" dans Générations changent le pool utilisé par la plupart des modes.</p>
  `);
}

function openSettingsModal() {
  const settings = getStoredAppSettings();
  ensureOverlay('Paramètres', `
    <div class="app-settings-grid app-settings-grid-rich">
      <section class="app-settings-section">
        <h4>Affichage</h4>
        <label class="app-setting-item app-setting-item-stack">
          <span><b>Thème</b><small>Basculer entre clair et sombre.</small></span>
          <select data-change-action="appSettingFromEl" data-setting="theme">
            <option value="light" ${settings.theme === "light" ? "selected" : ""}>Clair</option>
            <option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Sombre</option>
          </select>
        </label>
        <label class="app-setting-item app-setting-item-stack">
          <span><b>Densité</b><small>Compact pour voir plus d'infos, aéré pour plus de confort.</small></span>
          <select data-change-action="appSettingFromEl" data-setting="density">
            <option value="normal" ${settings.density === "normal" ? "selected" : ""}>Normale</option>
            <option value="compact" ${settings.density === "compact" ? "selected" : ""}>Compacte</option>
            <option value="airy" ${settings.density === "airy" ? "selected" : ""}>Aérée</option>
          </select>
        </label>
        <label class="app-setting-item app-setting-item-stack">
          <span><b>Taille du texte</b><small>Ajuste la lisibilité générale de l'interface.</small></span>
          <select data-change-action="appSettingFromEl" data-setting="textScale">
            <option value="small" ${settings.textScale === "small" ? "selected" : ""}>Petite</option>
            <option value="normal" ${settings.textScale === "normal" ? "selected" : ""}>Normale</option>
            <option value="large" ${settings.textScale === "large" ? "selected" : ""}>Grande</option>
          </select>
        </label>
      </section>
      <section class="app-settings-section">
        <h4>Accessibilité</h4>
        <label class="app-setting-item">
          <span><b>Contraste renforcé</b><small>Renforce les bordures et certains contrastes.</small></span>
          <input type="checkbox" ${settings.highContrast ? "checked" : ""} data-change-action="appSettingFromEl" data-setting="highContrast" data-bool="1" />
        </label>
        <label class="app-setting-item">
          <span><b>Réduire les animations</b><small>Limite les transitions et animations décoratives.</small></span>
          <input type="checkbox" ${settings.reduceMotion ? "checked" : ""} data-change-action="appSettingFromEl" data-setting="reduceMotion" data-bool="1" />
        </label>
      </section>
      <button class="btn-ghost app-settings-reset" type="button" data-action="resetAppSettings">Réinitialiser les paramètres</button>
    </div>
  `);
}

function confirmResetProgression() {
  ensureOverlay('Recommencer à zéro', '<p class="card-desc">Cette action efface <b>définitivement</b> ton profil, ta progression, tes statistiques, tes succès, tes équipes et ton historique sur cet appareil. C\'est irréversible.</p><div class="reset-confirm-actions"><button class="btn-ghost" type="button" data-action="closeResetOverlay">Annuler</button><button class="btn-red" type="button" data-action="doResetProfile">🗑️ Tout effacer</button></div>');
}
function closeResetOverlay() {
  const overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.classList.add('hidden');
  document.body.classList.remove('modal-open');
}
function doResetProfile() {
  try {
    Object.keys(STORAGE_KEYS).forEach((k) => { try { localStorage.removeItem(STORAGE_KEYS[k]); } catch (e) {} });
  } catch (e) {}
  try { location.reload(); } catch (e) {}
}

function openGamesRankingModeFallback() {
  goToConfig();
  hideScreen('screen-config');
  showScreen('screen-games-ranking');
  const wrap = document.getElementById('games-ranking-wrap');
  if (wrap) wrap.innerHTML = '<p class="card-desc">Le classement des jeux sera rétabli après stabilisation.</p>';
}

function openProfileScreen() {
  goToConfig();
  hideScreen('screen-config');
  showScreen('screen-profile');
  renderProfileScreen();
}

function openAchievementsScreen() {
  goToConfig();
  hideScreen('screen-config');
  showScreen('screen-achievements');
  renderAchievementsScreen();
}

function openMatchHistoryScreen() {
  goToConfig();
  hideScreen('screen-config');
  showScreen('screen-history');
  renderMatchHistoryScreen();
}

let oddDifficulty = "easy";
let oddOneOutState = { cards: [], oddId: null, explanation: "", revealed: false, count: 0 };
let weightBattleState = null;
let evolutionChainState = null;
let pokedexOrderState = null;
let descriptionState = { text: "" };

function hideCustomModeSurfaces() {
  [
    "description-banner",
    "description-box",
    "weight-banner",
    "weight-box",
    "evolution-banner",
    "evolution-box",
    "order-banner",
    "order-box",
    "party-banner",
    "party-box",
    "screen-odd-one-out",
  ].forEach((id) => document.getElementById(id)?.classList.add("hidden"));
}

function showStandardGameScreen() {
  hideScreen("screen-config");
  hideScreen("screen-ranking");
  hideScreen("screen-games-ranking");
  hideScreen("screen-pokedex");
  hideScreen("screen-draft-arena");
  hideScreen("screen-draft-score-attack");
  hideScreen("screen-team-builder");
  hideScreen("screen-teams");
  hideScreen("screen-profile");
  hideScreen("screen-achievements");
  hideScreen("screen-history");
  hideScreen("screen-multiplayer");
  hideScreen("screen-stat-clash");
  showScreen("screen-game");
  setGlobalNavActive("game");
}

function renderDescriptionMode() {
  hideCustomModeSurfaces();
  document.querySelector(".search-bar")?.classList.remove("hidden");
  document.getElementById("btn-surrender")?.classList.remove("hidden");
  document.getElementById("description-banner")?.classList.remove("hidden");
  document.getElementById("description-box")?.classList.remove("hidden");
  const text = document.getElementById("description-text");
  if (text) text.textContent = descriptionState.text || "";
}

function renderWeightBattlePanel() {
  if (!weightBattleState?.left || !weightBattleState?.right) return;
  hideCustomModeSurfaces();
  document.getElementById("weight-banner")?.classList.remove("hidden");
  document.getElementById("weight-box")?.classList.remove("hidden");
  document.querySelector(".search-bar")?.classList.add("hidden");
  document.getElementById("results-wrap")?.classList.add("hidden");
  document.getElementById("btn-surrender")?.classList.add("hidden");
  document.getElementById("win-box")?.classList.add("hidden");
  document.getElementById("try-count").textContent = String(weightBattleState.revealed ? 1 : 0);
  const status = document.getElementById("weight-status");
  const grid = document.getElementById("weight-grid");
  if (status) {
    status.textContent = !weightBattleState.revealed
      ? "Quel Pokémon est le plus lourd ?"
      : weightBattleState.selectedId === secretPokemon?.id
        ? `Bien vu : ${secretPokemon.name} est le plus lourd avec ${secretPokemon.weight} kg.`
        : `${secretPokemon?.name || "Le bon Pokémon"} était le plus lourd avec ${secretPokemon?.weight || "?"} kg.`;
  }
  if (!grid) return;
  grid.innerHTML = "";
  [weightBattleState.left, weightBattleState.right].forEach((pokemon) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "versus-card";
    if (weightBattleState.revealed) {
      btn.disabled = true;
      btn.classList.add(pokemon.id === secretPokemon?.id ? "is-correct" : "is-wrong");
    }
    btn.innerHTML = `<div class="pokemon-mini-card is-silhouette"><img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" data-fallback="${getSpriteUrl(getPokemonSpriteId(pokemon))}" /><strong>${escapeHtml(pokemon.name)}</strong></div>`;
    btn.addEventListener("click", () => {
      if (weightBattleState.revealed) return;
      weightBattleState.revealed = true;
      weightBattleState.selectedId = pokemon.id;
      attempts = 1;
      gameOver = true;
      const didWin = pokemon.id === secretPokemon?.id;
      renderWeightBattlePanel();
      // Standalone (hors party) : XP léger + historique + record streak
      if (!isPartySessionActive()) {
        try {
          recordMatchHistory({ mode: "weight", result: didWin ? "win" : "loss", attempts: 1, targetName: secretPokemon?.name || null });
        } catch (_e) {}
        if (didWin) {
          awardXp(10, "Duel de poids");
          if (playerProfile) {
            const next = (Number(playerProfile.weightBattleStreak) || 0) + 1;
            playerProfile.weightBattleStreak = next;
            const prev = Number(playerProfile.weightBattleHighScore) || 0;
            if (next > prev) {
              playerProfile.weightBattleHighScore = next;
              if (next >= 5) awardXp(20, "Nouveau record Poids");
            }
            try { saveProfile(); } catch (_e) {}
          }
        } else if (playerProfile) {
          playerProfile.weightBattleStreak = 0;
          try { saveProfile(); } catch (_e) {}
        }
      }
      finishPartyRound(didWin);
    });
    grid.appendChild(btn);
  });
  if (partySession) renderPartySessionUI();
}

function renderEvolutionChainPanel() {
  if (!evolutionChainState?.chain?.length) return;
  const chain = evolutionChainState.chain;
  hideCustomModeSurfaces();
  document.querySelector(".search-bar")?.classList.remove("hidden");
  document.getElementById("btn-surrender")?.classList.remove("hidden");
  document.getElementById("evolution-banner")?.classList.remove("hidden");
  document.getElementById("evolution-box")?.classList.remove("hidden");
  const status = document.getElementById("evolution-status");
  const chainEl = document.getElementById("evolution-chain");
  if (status) status.textContent = "Devine le Pokémon manquant avec la barre de recherche.";
  if (chainEl) {
    chainEl.innerHTML = `<div class="evolution-slot"><img src="${getPokemonSprite(chain[0])}" alt="${escapeHtml(chain[0].name)}"><small>${escapeHtml(chain[0].name)}</small></div><div class="evolution-arrow">→</div><div class="evolution-slot missing"><span>?</span><small>Manquant</small></div><div class="evolution-arrow">→</div><div class="evolution-slot"><img src="${getPokemonSprite(chain[2])}" alt="${escapeHtml(chain[2].name)}"><small>${escapeHtml(chain[2].name)}</small></div>`;
  }
}

function renderPokedexOrderPanel() {
  if (!pokedexOrderState?.lower || !pokedexOrderState?.upper) return;
  hideCustomModeSurfaces();
  document.querySelector(".search-bar")?.classList.remove("hidden");
  document.getElementById("btn-surrender")?.classList.remove("hidden");
  document.getElementById("order-banner")?.classList.remove("hidden");
  document.getElementById("order-box")?.classList.remove("hidden");
  document.getElementById("order-lower-label").textContent = `#${String(pokedexOrderState.lower.id).padStart(3, "0")} • ${pokedexOrderState.lower.name}`;
  document.getElementById("order-upper-label").textContent = `#${String(pokedexOrderState.upper.id).padStart(3, "0")} • ${pokedexOrderState.upper.name}`;
  const status = document.getElementById("order-status");
  if (status) status.textContent = "Entre le Pokémon placé entre ces deux numéros.";
}

function buildOddRuleSet() {
  return [
    {
      key: "type",
      build(pool) {
        const typeGroups = new Map();
        pool.forEach((pokemon) => {
          [pokemon.type1, pokemon.type2].filter(Boolean).forEach((type) => {
            if (!typeGroups.has(type)) typeGroups.set(type, []);
            typeGroups.get(type).push(pokemon);
          });
        });
        const valid = Array.from(typeGroups.entries()).filter(([, list]) => list.length >= 5);
        if (!valid.length) return null;
        const [sharedType, group] = valid[Math.floor(Math.random() * valid.length)];
        const common = shuffleArray(group.slice()).slice(0, 5);
        const commonIds = new Set(common.map((pokemon) => pokemon.id));
        const oddChoices = pool.filter((pokemon) => !commonIds.has(pokemon.id) && pokemon.type1 !== sharedType && pokemon.type2 !== sharedType);
        const odd = oddChoices[Math.floor(Math.random() * oddChoices.length)];
        if (!odd) return null;
        return {
          cards: shuffleArray(common.concat(odd)),
          oddId: odd.id,
          explanation: `${odd.name} est l'intrus car les 5 autres Pokémon possèdent tous le type ${sharedType}.`,
        };
      },
    },
    {
      key: "generation",
      build(pool) {
        const validGens = [...new Set(pool.map((pokemon) => pokemon.gen))].filter((gen) => pool.filter((pokemon) => pokemon.gen === gen).length >= 5);
        if (!validGens.length) return null;
        const gen = validGens[Math.floor(Math.random() * validGens.length)];
        const common = shuffleArray(pool.filter((pokemon) => pokemon.gen === gen)).slice(0, 5);
        const commonIds = new Set(common.map((pokemon) => pokemon.id));
        const oddChoices = pool.filter((pokemon) => !commonIds.has(pokemon.id) && pokemon.gen !== gen);
        const odd = oddChoices[Math.floor(Math.random() * oddChoices.length)];
        if (!odd) return null;
        return {
          cards: shuffleArray(common.concat(odd)),
          oddId: odd.id,
          explanation: `${odd.name} est l'intrus car les 5 autres viennent tous de la génération ${gen}.`,
        };
      },
    },
    {
      key: "letter",
      build(pool) {
        const groups = new Map();
        pool.forEach((pokemon) => {
          const first = norm(pokemon.name).replace(/[^a-z]/g, "").charAt(0);
          if (!first) return;
          if (!groups.has(first)) groups.set(first, []);
          groups.get(first).push(pokemon);
        });
        const valid = Array.from(groups.entries()).filter(([, list]) => list.length >= 5);
        if (!valid.length) return null;
        const [firstLetter, group] = valid[Math.floor(Math.random() * valid.length)];
        const common = shuffleArray(group.slice()).slice(0, 5);
        const commonIds = new Set(common.map((pokemon) => pokemon.id));
        const oddChoices = pool.filter((pokemon) => {
          const first = norm(pokemon.name).replace(/[^a-z]/g, "").charAt(0);
          return !commonIds.has(pokemon.id) && first !== firstLetter;
        });
        const odd = oddChoices[Math.floor(Math.random() * oddChoices.length)];
        if (!odd) return null;
        return {
          cards: shuffleArray(common.concat(odd)),
          oddId: odd.id,
          explanation: `${odd.name} est l'intrus car les 5 autres commencent tous par la lettre ${firstLetter.toUpperCase()}.`,
        };
      },
    },
  ];
}

function syncOddDifficultyUi() {
  const select = document.getElementById("odd-difficulty-select");
  const badge = document.getElementById("odd-puzzle-difficulty");
  if (select) select.value = oddDifficulty;
  if (badge) badge.textContent = `Difficulté : ${oddDifficulty === "hard" ? "Difficile" : oddDifficulty === "medium" ? "Moyen" : "Facile"}`;
}

function setOddDifficulty(value) {
  oddDifficulty = ["easy", "medium", "hard"].includes(value) ? value : "easy";
  try {
    localStorage.setItem("pokedle_odd_difficulty_v1", oddDifficulty);
  } catch (_err) {
    // noop
  }
  syncOddDifficultyUi();
  if (!document.getElementById("screen-odd-one-out")?.classList.contains("hidden")) nextOddOneOutPuzzle();
}

function nextOddOneOutPuzzle() {
  const pool = getPoolFromSelectedGens().filter((pokemon) => !pokemon.isAltForm);
  const source = pool.length >= 12 ? pool : getPokemonUiList({ includeAltForms: false });
  const rules = buildOddRuleSet();
  let puzzle = null;
  for (let i = 0; i < rules.length && !puzzle; i += 1) {
    puzzle = rules[i].build(source);
  }
  oddOneOutState = {
    cards: puzzle?.cards || [],
    oddId: puzzle?.oddId || null,
    explanation: puzzle?.explanation || "",
    revealed: false,
    count: oddOneOutState.count + 1,
  };
  renderOddOneOutPuzzle();
}

function submitOddOneOutChoice(pokemonId) {
  if (!oddOneOutState.oddId || oddOneOutState.revealed) return;
  oddOneOutState.revealed = true;
  gameOver = true;
  const status = document.getElementById("odd-status");
  const explanationBox = document.getElementById("odd-explanation-box");
  const explanationText = document.getElementById("odd-explanation-text");
  const selected = oddOneOutState.cards.find((pokemon) => pokemon.id === pokemonId);
  const odd = oddOneOutState.cards.find((pokemon) => pokemon.id === oddOneOutState.oddId);
  if (status) status.textContent = pokemonId === oddOneOutState.oddId ? `Bonne réponse : ${odd?.name || "Intrus trouvé"}.` : `Tu as choisi ${selected?.name || "ce Pokémon"}. L'intrus était ${odd?.name || "inconnu"}.`;
  explanationBox?.classList.remove("hidden");
  if (explanationText) explanationText.textContent = oddOneOutState.explanation;
  renderOddOneOutPuzzle(pokemonId);
  const didWin = pokemonId === oddOneOutState.oddId;
  // Standalone (hors party) : XP léger + historique + record streak
  if (!isPartySessionActive()) {
    try {
      recordMatchHistory({ mode: "odd", result: didWin ? "win" : "loss", attempts: 1, targetName: odd?.name || null });
    } catch (_e) {}
    if (didWin) {
      awardXp(10, "Intrus Pokémon");
      if (playerProfile) {
        const next = (Number(playerProfile.oddOneOutStreak) || 0) + 1;
        playerProfile.oddOneOutStreak = next;
        const prev = Number(playerProfile.oddOneOutHighScore) || 0;
        if (next > prev) {
          playerProfile.oddOneOutHighScore = next;
          if (next >= 5) awardXp(20, "Nouveau record Intrus");
        }
        try { saveProfile(); } catch (_e) {}
      }
    } else if (playerProfile) {
      playerProfile.oddOneOutStreak = 0;
      try { saveProfile(); } catch (_e) {}
    }
  }
  finishPartyRound(didWin);
  renderOddOneOutPuzzle(pokemonId);
}

function renderOddOneOutPuzzle(selectedId = null) {
  const grid = document.getElementById("odd-grid");
  const count = document.getElementById("odd-puzzle-count");
  const source = document.getElementById("odd-puzzle-source");
  const status = document.getElementById("odd-status");
  const newPuzzleBtn = document.getElementById("odd-new-puzzle-btn");
  const partyNextBtn = document.getElementById("odd-party-next-btn");
  const isPartyOddRound = Boolean(isPartySessionActive() && partySession?.currentModeKey === "odd");
  if (!grid || !count || !source || !status) return;
  if (newPuzzleBtn) newPuzzleBtn.classList.toggle("hidden", isPartyOddRound);
  if (partyNextBtn) {
    partyNextBtn.classList.toggle("hidden", !(isPartyOddRound && partySession?.roundResolved && !partySession?.completed));
  }
  count.textContent = `Énigme : ${oddOneOutState.count}`;
  source.textContent = "Source : générations sélectionnées";
  syncOddDifficultyUi();
  grid.innerHTML = "";
  if (!oddOneOutState.cards.length) {
    status.textContent = "Aucune énigme disponible avec la sélection actuelle.";
    return;
  }
  if (!oddOneOutState.revealed) status.textContent = "Quel Pokémon est l'intrus ?";
  oddOneOutState.cards.forEach((pokemon) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "odd-card";
    if (oddOneOutState.revealed) {
      btn.classList.add("is-revealed");
      if (pokemon.id === oddOneOutState.oddId) btn.classList.add("is-answer");
      if (pokemon.id === selectedId && pokemon.id !== oddOneOutState.oddId) btn.classList.add("is-wrong");
      if (pokemon.id === selectedId && pokemon.id === oddOneOutState.oddId) btn.classList.add("is-correct");
    }
    btn.innerHTML = `<img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" data-fallback="${getSpriteUrl(getPokemonSpriteId(pokemon))}" /><span class="odd-card-name">${escapeHtml(pokemon.name)}</span>`;
    btn.disabled = oddOneOutState.revealed;
    btn.addEventListener("click", () => submitOddOneOutChoice(pokemon.id));
    grid.appendChild(btn);
  });
}

function pickPokedexFlavorText(speciesData, pokemonName) {
  const entries = Array.isArray(speciesData?.flavor_text_entries) ? speciesData.flavor_text_entries : [];
  if (!entries.length) return null;
  // Priorité au français, fallback anglais
  const french = entries.filter((entry) => entry?.language?.name === "fr");
  const english = entries.filter((entry) => entry?.language?.name === "en");
  const pool = french.length ? french : english;
  if (!pool.length) return null;
  // Picks aléatoire pour ne pas toujours retomber sur la même entrée Rouge/Bleu
  const pick = pool[Math.floor(Math.random() * pool.length)];
  let text = String(pick?.flavor_text || "").replace(/[\f\n\r\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  // Masquer le nom du Pokémon pour ne pas révéler la réponse
  if (pokemonName) {
    const safeName = String(pokemonName).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    text = text.replace(new RegExp(safeName, "gi"), "ce Pokémon");
  }
  return text;
}

function buildDescriptionFallbackHint(secret) {
  // Indice générique sans révéler nom ni types : silhouette par catégorie
  if (!secret) return "Aucun indice disponible.";
  const gen = secret.gen ? `de la génération ${secret.gen}` : "";
  const stage = secret.stage ? `, stade d'évolution ${secret.stage}` : "";
  const habitat = secret.habitat && secret.habitat !== "Rare" ? `, habitat ${secret.habitat}` : "";
  return `Pokémon ${gen}${stage}${habitat}. (Description Pokédex indisponible, retombe sur indices génériques.)`.trim();
}

async function loadDescriptionFlavorText(secret) {
  descriptionState.loading = true;
  descriptionState.error = null;
  descriptionState.text = "Chargement de l'entrée Pokédex…";
  renderDescriptionMode();
  try {
    const speciesId = getPokemonSpeciesId(secret) || secret.id;
    const species = await fetchPokedexSpeciesData(speciesId);
    if (gameMode !== "description" || secretPokemon?.id !== secret.id) return; // mode quitté
    const flavor = pickPokedexFlavorText(species, secret.name);
    descriptionState.loading = false;
    if (flavor) {
      descriptionState.text = flavor;
    } else {
      descriptionState.error = "Aucune entrée Pokédex disponible.";
      descriptionState.text = buildDescriptionFallbackHint(secret);
    }
  } catch (_e) {
    descriptionState.loading = false;
    descriptionState.error = "Erreur réseau.";
    descriptionState.text = buildDescriptionFallbackHint(secret);
  }
  renderDescriptionMode();
}

function getPokemonSpeciesId(pokemon) {
  if (!pokemon) return null;
  // Les formes alternatives partagent souvent l'espèce de la forme de base
  const baseId = Number(pokemon.baseId || pokemon.speciesId || pokemon.id);
  return Number.isFinite(baseId) && baseId > 0 ? baseId : null;
}

function startDescriptionMode() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    showToast("Sélectionne au moins une génération !");
    return;
  }
  const secret = pickRandomPokemonFromPool(pool) || pool[0];
  descriptionState = { text: "Chargement de l'entrée Pokédex…", loading: true, error: null };
  gameMode = "description";
  startGameWithSecret(secret, pool);
  renderDescriptionMode();
  // Charge async la vraie description Pokédex
  loadDescriptionFlavorText(secret);
}

function openOddOneOutMode() {
  trackUsage("solo:odd");
  hideCustomModeSurfaces();
  hideScreen("screen-config");
  hideScreen("screen-game");
  hideScreen("screen-ranking");
  hideScreen("screen-games-ranking");
  hideScreen("screen-pokedex");
  hideScreen("screen-type-chart");
  hideScreen("screen-draft-arena");
  hideScreen("screen-draft-score-attack");
  hideScreen("screen-team-builder");
  hideScreen("screen-teams");
  hideScreen("screen-profile");
  hideScreen("screen-achievements");
  hideScreen("screen-history");
  showScreen("screen-odd-one-out");
  try {
    oddDifficulty = localStorage.getItem("pokedle_odd_difficulty_v1") || oddDifficulty;
  } catch (_err) {
    // noop
  }
  nextOddOneOutPuzzle();
  setGlobalNavActive("game");
}

function startWeightBattle() {
  const pool = getPoolFromSelectedGens().filter((pokemon) => !pokemon.isAltForm);
  if (pool.length < 2) {
    showToast("Sélectionne au moins une génération avec suffisamment de Pokémon.");
    return;
  }
  const left = pickRandomPokemonFromPool(pool) || pool[0];
  const rightPool = pool.filter((pokemon) => pokemon.id !== left.id);
  const right = pickRandomPokemonFromPool(rightPool) || rightPool[0];
  weightBattleState = { left, right, revealed: false, selectedId: null };
  gameMode = "weight";
  secretPokemon = left.weight >= right.weight ? left : right;
  activePool = pool;
  attempts = 0;
  gameOver = false;
  guessedNames = [];
  guessedSet = new Set();
  resultHistory = [];
  showStandardGameScreen();
  renderWeightBattlePanel();
}

function startEvolutionChainGame() {
  const pool = getPoolFromSelectedGens().filter((pokemon) => !pokemon.isAltForm);
  const candidates = getEvolutionChainCandidates(pool);
  let chain = null;
  if (candidates.length) {
    const previousMiddleId = evolutionChainState?.chain?.[1]?.id || null;
    const filtered = candidates.filter((candidate) => candidate[1]?.id !== previousMiddleId);
    const source = filtered.length ? filtered : candidates;
    chain = source[Math.floor(Math.random() * source.length)];
  }
  if (!chain) {
    showToast("Aucune chaîne d'évolution à trois stades disponible.");
    return;
  }
  evolutionChainState = { chain, missingIndex: 1 };
  gameMode = "evolution";
  startGameWithSecret(chain[1], pool);
  renderEvolutionChainPanel();
}

function startPokedexOrderGame() {
  const pool = getPoolFromSelectedGens().filter((pokemon) => !pokemon.isAltForm).sort((a, b) => a.id - b.id);
  if (pool.length < 3) {
    showToast("Il faut au moins trois Pokémon dans la sélection.");
    return;
  }
  const middleIndex = 1 + Math.floor(Math.random() * (pool.length - 2));
  pokedexOrderState = { lower: pool[middleIndex - 1], middle: pool[middleIndex], upper: pool[middleIndex + 1] };
  gameMode = "order";
  startGameWithSecret(pokedexOrderState.middle, pool);
  renderPokedexOrderPanel();
}

function startPartyMode() {
  partySession = createPartySession();
  launchPartyRound();
}

function createMultiplayerBotState(nickname, pool, secret) {
  return {
    status: "live",
    nickname,
    botName: "Bot Café",
    pool,
    secret,
    playerAttempts: 0,
    botAttempts: 0,
    playerLastGuess: null,
    botLastGuess: null,
    playerGuessIds: new Set(),
    botGuessIds: new Set(),
    chosenSecretName: secret.name,
    botSolveTurn: BOT_DUEL_MIN_SOLVE_TURN + Math.floor(Math.random() * (BOT_DUEL_MAX_SOLVE_TURN - BOT_DUEL_MIN_SOLVE_TURN + 1)),
    botTimer: null,
    winner: null,
  };
}

function clearMultiplayerBotTimer() {
  if (multiplayerBotState?.botTimer) {
    clearTimeout(multiplayerBotState.botTimer);
    multiplayerBotState.botTimer = null;
  }
}


function populateMultiplayerPokemonLists(pool) {
  const secretSelect = document.getElementById("multiplayer-secret-select");
  const guessList = document.getElementById("multiplayer-guess-options");
  if (secretSelect) {
    secretSelect.innerHTML = `<option value="">Pokémon aléatoire</option>${pool
      .map((pokemon) => `<option value="${pokemon.id}">${escapeHtml(pokemon.name)}</option>`)
      .join("")}`;
  }
  if (guessList) {
    guessList.innerHTML = pool.map((pokemon) => `<option value="${escapeHtml(pokemon.name)}"></option>`).join("");
  }
}

function renderMultiplayerSecretPreview() {
  const preview = document.getElementById("multiplayer-secret-preview");
  const secretSelect = document.getElementById("multiplayer-secret-select");
  if (!preview || !secretSelect) return;

  const pokemonId = Number(secretSelect.value);
  const pokemon = Number.isFinite(pokemonId) && pokemonId > 0 ? POKEMON_BY_ID.get(pokemonId) : null;
  if (!pokemon) {
    preview.classList.add("hidden");
    preview.innerHTML = "";
    return;
  }

  const fallbackSprite = getSpriteUrl(getPokemonSpriteId(pokemon));
  preview.classList.remove("hidden");
  preview.innerHTML = `
    <div class="pokemon-mini-card multiplayer-secret-card">
      <img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" data-fallback="${fallbackSprite}" />
      <strong>${escapeHtml(pokemon.name)}</strong>
      <span class="multiplayer-secret-card-meta">Gen ${pokemon.gen}</span>
      <div class="pokemon-card-types">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
    </div>
  `;
}


function clearMultiplayerResultsTable() {
  const tbody = document.getElementById("multiplayer-results-body");
  if (tbody) tbody.innerHTML = "";
}

function addMultiplayerGuessRow(pokemon) {
  if (!multiplayerBotState?.secret) return;
  const tbody = document.getElementById("multiplayer-results-body");
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.innerHTML = buildComparisonRowHtml(pokemon, compare(pokemon, multiplayerBotState.secret), multiplayerBotState.secret);
  tbody.insertBefore(tr, tbody.firstChild);
}



function scheduleBotTurn() {
  if (!multiplayerBotState || multiplayerBotState.status !== "live") return;
  clearMultiplayerBotTimer();
  multiplayerBotState.botTimer = setTimeout(runMultiplayerBotTurn, BOT_DUEL_TURN_DELAY_MS);
}

function runMultiplayerBotTurn() {
  if (!multiplayerBotState || multiplayerBotState.status !== "live") return;

  multiplayerBotState.botAttempts += 1;
  let guess = null;

  if (multiplayerBotState.botAttempts >= multiplayerBotState.botSolveTurn) {
    guess = multiplayerBotState.secret;
  } else {
    const candidates = multiplayerBotState.pool.filter((pokemon) => pokemon.id !== multiplayerBotState.secret.id && !multiplayerBotState.botGuessIds.has(pokemon.id));
    guess = candidates[Math.floor(Math.random() * candidates.length)] || multiplayerBotState.secret;
  }

  multiplayerBotState.botGuessIds.add(guess.id);
  multiplayerBotState.botLastGuess = guess.name;

  if (guess.id === multiplayerBotState.secret.id) {
    multiplayerBotState.winner = "bot";
    multiplayerBotState.status = "result";
    clearMultiplayerBotTimer();
    renderMultiplayerBotScreen();
    return;
  }

  renderMultiplayerBotScreen();
  scheduleBotTurn();
}



function handleMultiplayerGuessKey(event) {
  const list = document.getElementById("multiplayer-guess-ac");
  const items = list?.querySelectorAll(".ac-item") || [];

  if (event.key === "ArrowDown") {
    event.preventDefault();
    acIndex = Math.min(acIndex + 1, items.length - 1);
    highlightItems(items, acIndex);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    acIndex = Math.max(acIndex - 1, -1);
    highlightItems(items, acIndex);
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (acIndex >= 0 && items[acIndex]) {
      const name = items[acIndex].querySelector(".ac-name")?.textContent;
      if (name) {
        selectMultiplayerGuessAC(name);
        return;
      }
    }
    submitMultiplayerGuess();
  } else if (event.key === "Escape") {
    list?.classList.add("hidden");
  }
}





function createDefaultMultiplayerLiveState() {
  return {
    connectionStatus: "offline",
    room: null,
    submittedGuessNames: new Set(),
    selectedGens: new Set([...selectedGens].sort((a, b) => a - b)),
    lastGuessFocusKey: "",
    pendingGuessSubmit: false,
    lastRoomClosedReason: "",
  };
}

function ensureMultiplayerLiveState() {
  if (!multiplayerLiveState) multiplayerLiveState = createDefaultMultiplayerLiveState();
  return multiplayerLiveState;
}

function focusMultiplayerGuessInputIfReady() {
  const state = ensureMultiplayerLiveState();
  const room = state?.room;
  if (!room || room.status !== "live") {
    state.lastGuessFocusKey = "";
    return;
  }

  const input = document.getElementById("multiplayer-guess-input");
  if (!input || input.disabled) return;

  const self = Array.isArray(room.players) ? room.players.find((player) => player.isSelf) || null : null;
  const focusKey = [
    room.code || "",
    room.status || "",
    Number(self?.attempts) || 0,
    Array.isArray(self?.guessHistory) ? self.guessHistory.length : 0,
    state.submittedGuessNames?.size || 0,
  ].join(":");

  if (state.lastGuessFocusKey === focusKey) return;

  const active = document.activeElement;
  const activeIsEditable = !!active && (
    active.tagName === "INPUT" ||
    active.tagName === "TEXTAREA" ||
    active.isContentEditable
  );

  if (active === input) {
    state.lastGuessFocusKey = focusKey;
    return;
  }

  if (activeIsEditable) return;

  state.lastGuessFocusKey = focusKey;
  window.requestAnimationFrame(() => {
    const latestInput = document.getElementById("multiplayer-guess-input");
    if (!latestInput || latestInput.disabled) return;
    const latestActive = document.activeElement;
    const latestActiveIsEditable = !!latestActive && (
      latestActive.tagName === "INPUT" ||
      latestActive.tagName === "TEXTAREA" ||
      latestActive.isContentEditable
    );
    if (latestActive === latestInput || latestActiveIsEditable) return;
    latestInput.focus({ preventScroll: true });
  });
}

function ensureMultiplayerGuessInputBindings() {
  const input = document.getElementById("multiplayer-guess-input");
  if (!input || input.dataset.enterBound === "true") return;
  input.dataset.enterBound = "true";
  input.addEventListener("input", () => {
    updateMultiplayerGuessSubmitState();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const room = multiplayerLiveState?.room;
    const button = document.querySelector("#multiplayer-live-box .btn-red");
    if (!room || room.status !== "live" || input.disabled || button?.disabled) return;
    event.preventDefault();
    submitMultiplayerGuess();
  });
}

function canSubmitMultiplayerGuess() {
  const state = ensureMultiplayerLiveState();
  const room = state?.room;
  if (!room || room.status !== "live" || state.pendingGuessSubmit) return false;
  const input = document.getElementById("multiplayer-guess-input");
  const raw = String(input?.value || "").trim();
  if (!raw) return false;
  const picked = findPokemonGlobalByName(raw);
  if (!picked) return false;
  const pool = getMultiplayerRoomPool();
  if (!pool.some((pokemon) => pokemon.id === picked.id)) return false;
  if (state.submittedGuessNames.has(picked.name)) return false;
  return true;
}

function updateMultiplayerGuessSubmitState() {
  const input = document.getElementById("multiplayer-guess-input");
  const button = document.querySelector("#multiplayer-live-box .btn-red");
  if (!input || !button) return;
  const state = ensureMultiplayerLiveState();
  const room = state?.room;
  const liveReady = Boolean(room && room.status === "live" && !state.pendingGuessSubmit);
  input.disabled = !liveReady;
  button.disabled = !canSubmitMultiplayerGuess();
}

function getMultiplayerRoomPool() {
  const room = multiplayerLiveState?.room;
  const gens = Array.isArray(room?.selectedGens) && room.selectedGens.length
    ? new Set(room.selectedGens.map((value) => Number(value)))
    : new Set(getMultiplayerSelectedGens());
  return getPokemonUiList({ gens, includeAltForms: false });
}

function setMultiplayerError(message = "") {
  const error = document.getElementById("multiplayer-error");
  if (error) error.textContent = message;
}

function setMultiplayerConnectionStatus(status) {
  ensureMultiplayerLiveState().connectionStatus = status;
}

function getMultiplayerSelectedGens() {
  const values = [...(ensureMultiplayerLiveState().selectedGens || new Set([1]))]
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 9)
    .sort((a, b) => a - b);
  return values.length ? values : [1];
}

function renderMultiplayerGenerationGrid() {
  const grid = document.getElementById("multiplayer-gen-grid");
  if (!grid) return;

  const state = ensureMultiplayerLiveState();
  const selectedSet = new Set(
    Array.isArray(state.room?.selectedGens) && state.room.selectedGens.length
      ? state.room.selectedGens.map((value) => Number(value))
      : getMultiplayerSelectedGens()
  );

  grid.innerHTML = "";
  Object.entries(GENERATIONS).forEach(([n, data]) => {
    const gen = Number(n);
    const count = getPokemonCountForGeneration(gen, { includeAltForms: false });
    const isOn = selectedSet.has(gen);
    const item = document.createElement("label");
    item.className = "gen-item" + (isOn ? " on" : "");
    item.dataset.gen = String(gen);
    item.innerHTML = `
      <input type="checkbox" ${isOn ? "checked" : ""} />
      <div class="gen-check">${isOn ? "OK" : ""}</div>
      <div>
        <div class="gen-name">Gen ${gen}</div>
        <div class="gen-sub">${data.label} • ${count} Pokémon</div>
      </div>
    `;
    item.addEventListener("click", (event) => {
      event.preventDefault();
      handleMultiplayerGenerationChange(gen, item);
    });
    grid.appendChild(item);
  });

  const roomStatus = multiplayerLiveState?.room?.status || "";
  const self = state.room?.players?.find((player) => player.isSelf) || null;
  const disabled = roomStatus === "live" || Boolean(state.room?.code && !self?.isHost);
  grid.querySelectorAll(".gen-item").forEach((item) => {
    if (disabled) item.classList.add("is-disabled");
    else item.classList.remove("is-disabled");
  });
}

function handleMultiplayerGenerationChange(gen, item) {
  const roomStatus = multiplayerLiveState?.room?.status || "";
  if (roomStatus === "live") return;

  const state = ensureMultiplayerLiveState();
  const self = state.room?.players?.find((player) => player.isSelf) || null;
  if (state.room?.code && !self?.isHost) {
    setMultiplayerError("Seul le créateur de la room peut changer les générations.");
    return;
  }
  const values = state.selectedGens || new Set([1]);
  if (values.has(gen)) {
    if (values.size <= 1) return;
    values.delete(gen);
    item?.classList.remove("on");
    item?.querySelector(".gen-check") && (item.querySelector(".gen-check").textContent = "");
  } else {
    values.add(gen);
    item?.classList.add("on");
    item?.querySelector(".gen-check") && (item.querySelector(".gen-check").textContent = "OK");
  }
  state.selectedGens = new Set([...values].sort((a, b) => a - b));
  if (state.room?.code && multiplayerSocket?.connected) {
    multiplayerSocket.emit("duel:update-gens", { selectedGens: [...state.selectedGens] }, (response = {}) => {
      if (!response.ok) {
        setMultiplayerError(response.error || "Impossible de mettre à jour les générations.");
        return;
      }
      if (response.room) {
        state.room = response.room;
        state.selectedGens = new Set(response.room.selectedGens || [...state.selectedGens]);
      }
      renderMultiplayerBotScreen();
    });
    return;
  }
  renderMultiplayerGenerationSummary();
}

function resetMultiplayerLiveSession() {
  const preservedGens = getMultiplayerSelectedGens();
  const preservedConnectionStatus = multiplayerSocket?.connected
    ? "online"
    : multiplayerLiveState?.connectionStatus === "connecting"
      ? "connecting"
      : "offline";
  multiplayerLiveState = createDefaultMultiplayerLiveState();
  multiplayerLiveState.selectedGens = new Set(preservedGens);
  multiplayerLiveState.connectionStatus = preservedConnectionStatus;
  document.getElementById("multiplayer-room-input")?.value && (document.getElementById("multiplayer-room-input").value = "");
  document.getElementById("multiplayer-guess-input")?.value && (document.getElementById("multiplayer-guess-input").value = "");
  document.getElementById("multiplayer-guess-ac")?.classList.add("hidden");
  renderMultiplayerGenerationGrid();
}

// Grace period duel : session sauvegardée pour reprendre après coupure/refresh.
const DUEL_SESSION_STORAGE_KEY = "pokedle_duel_session_v1";
const DUEL_SESSION_TTL_MS = 10 * 60 * 1000;

function saveDuelSession(code, nickname) {
  try {
    sessionStorage.setItem(DUEL_SESSION_STORAGE_KEY, JSON.stringify({ code, nickname, ts: Date.now() }));
  } catch (_err) { /* stockage indisponible */ }
}

function clearDuelSession() {
  try { sessionStorage.removeItem(DUEL_SESSION_STORAGE_KEY); } catch (_err) { /* noop */ }
}

function attemptDuelResume() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(DUEL_SESSION_STORAGE_KEY) || "null"); } catch (_err) { return; }
  if (!saved?.code || !saved?.nickname) return;
  if (Date.now() - (saved.ts || 0) > DUEL_SESSION_TTL_MS) { clearDuelSession(); return; }
  if (!multiplayerSocket) return;

  multiplayerSocket.emit("duel:resume", { code: saved.code, nickname: saved.nickname }, (response = {}) => {
    if (!response.ok) {
      clearDuelSession();
      return;
    }
    const state = ensureMultiplayerLiveState();
    state.room = response.room || null;
    state.lastRoomClosedReason = "";
    setMultiplayerError("");
    saveDuelSession(saved.code, saved.nickname);
    // Après un refresh, on ré-ouvre l'écran duel si la manche est en cours.
    if (response.room?.status === "live" && document.getElementById("screen-multiplayer")?.classList.contains("hidden")) {
      openMultiplayerMode();
    }
    renderMultiplayerBotScreen();
    showToast(`Reconnecté à la room ${saved.code} !`);
  });
}

function ensureMultiplayerSocket() {
  if (multiplayerSocket) return multiplayerSocket;
  if (typeof window.io !== "function") {
    setMultiplayerError("Le client temps réel n'est pas chargé. Lance l'app via le serveur Node.");
    return null;
  }

  ensureMultiplayerLiveState();
  setMultiplayerConnectionStatus("connecting");
  multiplayerSocket = window.io();

  multiplayerSocket.on("connect", () => {
    setMultiplayerConnectionStatus("online");
    attemptDuelResume();
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("connect_error", () => {
    setMultiplayerConnectionStatus("offline");
    setMultiplayerError("Impossible de joindre le serveur Duel live. Vérifie que server.js tourne.");
    if (statClashState?.mode === "room") {
      statClashState.roomPendingAction = "";
      setStatClashRoomFeedback("Impossible de joindre le serveur Room 1v1.", "error");
      renderStatClashScreen();
    }
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("disconnect", () => {
    setMultiplayerConnectionStatus("offline");
    if (statClashState?.mode === "room") {
      statClashState.roomPendingAction = "";
      setStatClashRoomFeedback("Connexion room interrompue.", "error");
      renderStatClashScreen();
    }
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("duel:room-state", (roomState) => {
    const state = ensureMultiplayerLiveState();
    const previousRoom = state.room;
    state.room = roomState;
    state.pendingGuessSubmit = false;
    state.lastRoomClosedReason = "";
    if (Array.isArray(roomState?.selectedGens) && roomState.selectedGens.length) {
      state.selectedGens = new Set(roomState.selectedGens.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 9));
    }
    if (previousRoom?.code === roomState?.code && previousRoom?.status === "finished" && roomState?.status === "live") {
      state.submittedGuessNames = new Set();
      document.getElementById("multiplayer-guess-input")?.value && (document.getElementById("multiplayer-guess-input").value = "");
      document.getElementById("multiplayer-guess-ac")?.classList.add("hidden");
      setMultiplayerError("");
    }
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("duel:finished", (roomState) => {
    const state = ensureMultiplayerLiveState();
    state.room = roomState;
    state.pendingGuessSubmit = false;
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("duel:opponent-connection", (payload = {}) => {
    const nickname = String(payload.nickname || "L'adversaire");
    if (payload.connected) {
      setMultiplayerError("");
      showToast(`${nickname} est de retour !`);
    } else {
      const seconds = Math.round((Number(payload.graceMs) || 30000) / 1000);
      setMultiplayerError(`⚠️ ${nickname} a perdu la connexion — il a ${seconds} s pour revenir, sinon victoire automatique.`);
    }
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("duel:room-closed", (payload = {}) => {
    const reason = payload.reason || "La room a été fermée.";
    clearDuelSession();
    resetMultiplayerLiveSession();
    ensureMultiplayerLiveState().lastRoomClosedReason = reason;
    setMultiplayerError(reason);
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("stat-clash:room-state", (roomState) => {
    if (!statClashState) return;
    console.debug("[stat-clash][client][room-state] recv", roomState);
    applyStatClashRoomState(roomState);
  });

  multiplayerSocket.on("stat-clash:room-presence", (payload = {}) => {
    if (!statClashState?.mode || statClashState.mode !== "room") return;
    console.debug("[stat-clash][client][room-presence] recv", payload);
    if (payload?.code && statClashState.room?.code === payload.code) {
      setStatClashRoomFeedback(`Joueurs connectés : ${payload.connectedCount || 0}/${statClashState.room?.maxPlayers || 2}`, "success");
      renderStatClashScreen();
    }
  });

  multiplayerSocket.on("stat-clash:finished", (roomState) => {
    if (!statClashState) return;
    applyStatClashRoomState(roomState);
  });

  multiplayerSocket.on("stat-clash:room-closed", (payload = {}) => {
    if (!statClashState) return;
    statClashState.room = null;
    statClashState.roomToken = "";
    statClashState.mode = "room";
    statClashState.phase = "idle";
    statClashState.currentPokemon = null;
    statClashState.randomizerPokemon = null;
    statClashState.reveal = null;
    statClashState.players.right = createStatClashPlayer("right", "Adversaire en attente");
    statClashState.statusText = payload.reason || "La room Stat Clash a été fermée.";
    setStatClashRoomFeedback(statClashState.statusText, "error");
    renderStatClashScreen();
  });

  multiplayerSocket.on("draft-battle:room-state", (roomState) => {
    handleDraftSimpleBattleNetworkRoomState(roomState);
  });

  multiplayerSocket.on("draft-battle:state", (payload = {}) => {
    handleDraftSimpleBattleNetworkBattleState(payload);
  });

  multiplayerSocket.on("draft-battle:resolve-turn", (payload = {}) => {
    handleDraftSimpleBattleNetworkResolveTurn(payload);
  });

  multiplayerSocket.on("draft-battle:resolve-replacement", (payload = {}) => {
    handleDraftSimpleBattleNetworkResolveReplacement(payload);
  });

  multiplayerSocket.on("draft-battle:room-closed", (payload = {}) => {
    handleDraftSimpleBattleNetworkRoomClosed(payload);
  });

  multiplayerSocket.on("draft-score:room-state", (roomState) => {
    applyDraftScoreAttackRoomState(roomState);
  });

  multiplayerSocket.on("draft-score:room-closed", (payload = {}) => {
    if (!draftArenaState) return;
    draftArenaState.scoreAttackRoom = null;
    draftArenaState.scoreAttackSubmitted = false;
    draftArenaState.scoreAttackRoomPending = null;
    draftArenaState.scoreAttackRoomError = payload.reason || "La room Score Attack a été fermée.";
    if (draftArenaState.mode === "scoreAttack") renderDraftArena();
  });

  multiplayerSocket.on("higher-lower:room-state", (roomState) => {
    if (typeof applyHigherLowerRoomState === "function") applyHigherLowerRoomState(roomState);
  });

  multiplayerSocket.on("draft-score:reaction-received", (payload = {}) => {
    if (typeof showDraftScoreReactionEmoji === "function") showDraftScoreReactionEmoji(payload);
  });

  multiplayerSocket.on("stat-auction:room-state", (roomState) => {
    if (typeof applyStatAuctionRoomState === "function") applyStatAuctionRoomState(roomState);
  });

  return multiplayerSocket;
}

function renderMultiplayerGenerationSummary() {
  const genSummary = document.getElementById("multiplayer-gen-summary");
  if (!genSummary) return;
  const room = multiplayerLiveState?.room;
  const roomGens = Array.isArray(room?.selectedGens) && room.selectedGens.length
    ? room.selectedGens.slice().sort((a, b) => a - b)
    : null;
  const plannedGens = getMultiplayerSelectedGens();
  const plannedLabel = plannedGens.map((gen) => `Gen ${gen}`).join(", ");
  if (roomGens?.length) {
    const self = room.players?.find((player) => player.isSelf) || null;
    if (room.status === "finished") {
      genSummary.textContent = self?.isHost
        ? `Room : ${roomGens.map((gen) => `Gen ${gen}`).join(", ")} • Tu peux ajuster la prochaine manche`
        : `Room : ${roomGens.map((gen) => `Gen ${gen}`).join(", ")} • Le créateur choisit la prochaine manche`;
      return;
    }
    genSummary.textContent = `Générations de la room : ${roomGens.map((gen) => `Gen ${gen}`).join(", ")}`;
    return;
  }
  genSummary.textContent = `Générations choisies : ${plannedLabel}`;
}

function renderMultiplayerPlayers() {
  const wrap = document.getElementById("multiplayer-players");
  if (!wrap) return;

  const room = multiplayerLiveState?.room;
  const players = Array.isArray(room?.players) ? room.players : [];
  const self = players.find((player) => player.isSelf) || null;
  const opponent = players.find((player) => !player.isSelf) || null;
  const canStartSoon = Boolean(room?.code && players.length >= 2);

  const renderPlayerCard = (player, fallbackLabel) => {
    const isWinner = player && room?.winnerId && player.id === room.winnerId;
    const name = player?.nickname || fallbackLabel;
    const subtitle = player
      ? (player.isSelf ? "Toi" : "Adversaire")
      : "Slot libre";
    const status = player
      ? (player.connected === false
        ? (player.isSelf ? "Déconnecté" : "Adversaire parti")
        : room?.status === "waiting"
        ? (canStartSoon ? "Adversaire connecté" : "Présent dans la room")
        : room?.status === "live"
          ? "Partie lancée"
          : "Manche terminée")
      : "En attente d'un joueur";
    const attempts = player?.attempts || 0;
    const lastGuess = player?.lastGuess || "—";
    return `
      <article class="multiplayer-player-card ${player?.isSelf ? "is-self" : ""} ${isWinner ? "is-winner" : ""} ${player ? "is-present" : "is-empty"} ${player?.connected === false ? "is-disconnected" : ""}">
        <div class="multiplayer-player-head">
          <strong>${escapeHtml(name)}</strong>
          <span>${subtitle}</span>
        </div>
        <div class="multiplayer-player-room-status">${escapeHtml(status)}</div>
        <div class="multiplayer-player-stats">
          <span>Essais : <b>${attempts}</b></span>
          <span>Dernière tentative : <b>${escapeHtml(lastGuess)}</b></span>
        </div>
      </article>
    `;
  };

  wrap.innerHTML = `${renderPlayerCard(self, "Toi")}${renderPlayerCard(opponent, "Joueur 2")}`;
}

function buildMultiplayerComparisonRowHtml(entry) {
  const fallbackSprite = getSpriteUrl(getPokemonSpriteId(entry));
  const cmp = entry.feedback || {};
  const heightArrow = entry.heightArrow || "";
  const weightArrow = entry.weightArrow || "";

  return `
    <td>
      <div class="poke-cell">
        <img src="${entry.sprite || getPokemonSprite(entry)}" alt="${escapeHtml(entry.name)}" loading="lazy" data-fallback="${fallbackSprite}" />
        ${escapeHtml(entry.name)}
      </div>
    </td>
    <td class="${cls(cmp.generation)}">Gen ${entry.gen}</td>
    <td class="${cls(cmp.altForm)}">${entry.isAltForm ? "Oui" : "Non"}</td>
    <td class="${cls(cmp.type1)}">${escapeHtml(entry.type1 || "Aucun")}</td>
    <td class="${cls(cmp.type2)}">${escapeHtml(entry.type2 || "Aucun")}</td>
    <td class="${cls(cmp.habitat)}">${escapeHtml(entry.habitat || "Inconnu")}</td>
    <td class="${cls(cmp.color)}">${escapeHtml(formatColorLabel(entry.color || "Inconnu"))}</td>
    <td class="${cls(cmp.stage)}">${entry.stage ?? "—"}</td>
    <td class="${cls(cmp.height)}">
      <div class="cell-num">
        ${entry.height}m
        ${cmp.height !== "ok" && heightArrow ? `<span class="${heightArrow === "↑" ? "arrow-up" : "arrow-down"}">${heightArrow}</span>` : ""}
      </div>
    </td>
    <td class="${cls(cmp.weight)}">
      <div class="cell-num">
        ${entry.weight}kg
        ${cmp.weight !== "ok" && weightArrow ? `<span class="${weightArrow === "↑" ? "arrow-up" : "arrow-down"}">${weightArrow}</span>` : ""}
      </div>
    </td>
  `;
}

function renderMultiplayerAttempts() {
  const shell = document.getElementById("multiplayer-attempts-shell");
  const body = document.getElementById("multiplayer-my-attempts-body");
  const wrap = document.getElementById("multiplayer-my-attempts-wrap");
  const empty = document.getElementById("multiplayer-my-attempts-empty");
  const opponentBox = document.getElementById("multiplayer-opponent-attempts");
  if (!shell || !body || !wrap || !empty || !opponentBox) return;

  const room = multiplayerLiveState?.room;
  const status = room?.status;
  const players = Array.isArray(room?.players) ? room.players : [];
  const self = players.find((player) => player.isSelf) || null;
  const opponent = players.find((player) => !player.isSelf) || null;
  const myHistory = Array.isArray(self?.guessHistory) ? self.guessHistory : [];
  const opponentNames = Array.isArray(opponent?.guessNames) ? opponent.guessNames : [];

  if (!room || (status !== "live" && status !== "finished")) {
    shell.classList.add("hidden");
    body.innerHTML = "";
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
    opponentBox.textContent = "Aucune tentative adverse pour l’instant.";
    return;
  }

  shell.classList.remove("hidden");
  if (myHistory.length) {
    body.innerHTML = myHistory.map((entry) => `<tr>${buildMultiplayerComparisonRowHtml(entry)}</tr>`).join("");
    wrap.classList.remove("hidden");
    empty.classList.add("hidden");
  } else {
    body.innerHTML = "";
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
  }

  opponentBox.innerHTML = opponentNames.length
    ? `
      <div class="multiplayer-opponent-attempt-list">
        ${opponentNames.map((name, index) => `<span class="multiplayer-opponent-attempt-chip">#${opponentNames.length - index} ${escapeHtml(name)}</span>`).join("")}
      </div>
    `
    : "Aucune tentative adverse pour l’instant.";
}

function ensureMultiplayerWinOverlay() {
  let overlay = document.getElementById("multiplayer-win-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "multiplayer-win-overlay";
  overlay.className = "multiplayer-win-overlay hidden";
  overlay.innerHTML = `
    <div class="multiplayer-win-card">
      <button class="multiplayer-win-close" type="button" aria-label="Fermer" data-action="hideMultiplayerWinOverlay">×</button>
      <div id="multiplayer-win-content"></div>
      <div class="multiplayer-result-actions multiplayer-win-actions">
        <button class="btn-red" type="button" data-action="winOverlayRestartSame">Rejouer pareil</button>
        <button class="btn-blue" type="button" data-action="winOverlayRestartUpdated">Relancer avec ces générations</button>
        <button class="btn-ghost" type="button" data-action="winOverlayBackToConfig">Retour accueil</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function hideMultiplayerWinOverlay() {
  document.getElementById("multiplayer-win-overlay")?.classList.add("hidden");
}

function renderMultiplayerBotResult() {
  const content = document.getElementById("multiplayer-result-content");
  const resultBox = document.getElementById("multiplayer-result-box");
  const resultHeading = resultBox?.querySelector("h3");
  const multiplayerScreen = document.getElementById("screen-multiplayer");
  if (!content) return false;
  const room = multiplayerLiveState?.room;
  const players = Array.isArray(room?.players) ? room.players : [];
  const self = players.find((player) => player.isSelf) || null;
  const winner = players.find((player) => player.id === room?.winnerId) || null;
  const opponent = players.find((player) => !player.isSelf) || null;
  const playerId = self?.id || multiplayerSocket?.id || null;
  const playerWon = Boolean(playerId && winner && playerId === winner.id);
  const target = room?.targetRevealed;
  const bothPlayersPresent = players.length >= 2 && players.every((player) => player.connected !== false);
  const scoreLeftLabel = self?.nickname || "Toi";
  const scoreRightLabel = opponent?.nickname || "Adversaire";
  const scoreLeftValue = winner && self && winner.id === self.id ? 1 : 0;
  const scoreRightValue = winner && opponent && winner.id === opponent.id ? 1 : 0;
  const nextActionText = !bothPlayersPresent
    ? "En attente de l’autre joueur pour pouvoir relancer."
    : self?.isHost
    ? "Tu peux relancer la manche maintenant."
    : "Tu peux rejouer maintenant ou attendre une relance avec d’autres générations.";
  const waitStateText = !bothPlayersPresent
    ? "Room incomplète"
    : self?.isHost
    ? "Action disponible"
    : "Room prête";
  const disconnectedOpponent = players.find((player) => !player.isSelf && player.connected === false) || null;
  const reasonText = room?.endedReason === "disconnect"
    ? `${disconnectedOpponent?.nickname || "L'adversaire"} a quitté le duel. La manche est terminée.`
    : playerWon
    ? "Tu as trouvé le Pokémon avant ton adversaire."
    : winner
    ? `${winner.nickname} a trouvé le Pokémon avant toi.`
    : "La manche est terminée.";
  const resultTitle = playerWon ? "Félicitations, tu as gagné !" : "Défaite";
  const resultSupportText = playerWon
    ? "Belle manche. Tu remportes ce duel live avant ton adversaire."
    : "La manche t’échappe cette fois.";

  const postMatchMetaHtml = `
    <div class="multiplayer-postmatch-meta">
      <div class="multiplayer-postmatch-row">
        <span class="multiplayer-postmatch-label">Vainqueur</span>
        <strong class="multiplayer-postmatch-value">${escapeHtml(winner?.nickname || "Manche terminée")}</strong>
      </div>
      <div class="multiplayer-postmatch-row multiplayer-postmatch-score">
        <span class="multiplayer-postmatch-label">Score de manche</span>
        <strong class="multiplayer-postmatch-value">${escapeHtml(scoreLeftLabel)} ${scoreLeftValue} - ${scoreRightValue} ${escapeHtml(scoreRightLabel)}</strong>
      </div>
      <div class="multiplayer-postmatch-row">
        <span class="multiplayer-postmatch-label">${escapeHtml(waitStateText)}</span>
        <strong class="multiplayer-postmatch-value">${escapeHtml(nextActionText)}</strong>
      </div>
    </div>
  `;

  content.innerHTML = `
    <div class="multiplayer-result-summary ${playerWon ? "is-win" : "is-loss"}">
      <div>
        <p class="multiplayer-result-title">${resultTitle}</p>
        <p>${escapeHtml(reasonText)}</p>
        <p>${resultSupportText}</p>
        ${postMatchMetaHtml}
      </div>
      ${target ? `
      <div class="multiplayer-target-card">
        <div class="pokemon-mini-card">
          <img src="${target.sprite || getPokemonSprite(target)}" alt="${escapeHtml(target.name)}" loading="lazy" data-fallback="${getSpriteUrl(getPokemonSpriteId(target))}" />
          <strong>${escapeHtml(target.name)}</strong>
          <div class="pokemon-card-types">${typeBadgesHtml(target.type1, target.type2)}</div>
        </div>
      </div>` : ""}
    </div>
  `;

  if (resultBox) {
    if (resultHeading) resultHeading.textContent = playerWon ? "Victoire" : "Résultat du duel";
    resultBox.classList.toggle("is-win", playerWon);
    resultBox.classList.toggle("is-loss", !playerWon);
    resultBox.setAttribute("data-postmatch-state", !bothPlayersPresent ? "waiting" : self?.isHost ? "host-ready" : "guest-ready");
    multiplayerScreen?.classList.toggle("multiplayer-win-state", playerWon);
    if (playerWon) {
      const overlay = ensureMultiplayerWinOverlay();
      const overlayContent = document.getElementById("multiplayer-win-content");
      overlay.querySelector(".multiplayer-win-card")?.classList.remove("is-loss");
      if (overlayContent) {
        overlayContent.innerHTML = `
          <div class="multiplayer-result-summary is-win">
            <div>
              <p class="multiplayer-result-title">${resultTitle}</p>
              <p>${escapeHtml(reasonText)}</p>
              <p>${resultSupportText}</p>
              ${postMatchMetaHtml}
            </div>
            ${target ? `
            <div class="multiplayer-target-card">
              <div class="pokemon-mini-card">
                <img src="${target.sprite || getPokemonSprite(target)}" alt="${escapeHtml(target.name)}" loading="lazy" data-fallback="${getSpriteUrl(getPokemonSpriteId(target))}" />
                <strong>${escapeHtml(target.name)}</strong>
                <div class="pokemon-card-types">${typeBadgesHtml(target.type1, target.type2)}</div>
              </div>
            </div>` : ""}
          </div>
        `;
      }
      overlay.classList.remove("hidden");
      resultBox.classList.add("hidden");
      resultBox.classList.remove("win-animate");
      void resultBox.offsetWidth;
      resultBox.classList.add("win-animate");
      triggerWinCelebration(resultBox);
    } else {
      const overlay = ensureMultiplayerWinOverlay();
      const overlayContent = document.getElementById("multiplayer-win-content");
      overlay.querySelector(".multiplayer-win-card")?.classList.add("is-loss");
      if (overlayContent) {
        overlayContent.innerHTML = `
          <div class="multiplayer-result-summary is-loss">
            <div>
              <p class="multiplayer-result-title">${resultTitle}</p>
              <p>${escapeHtml(reasonText)}</p>
              <p>${resultSupportText}</p>
              ${postMatchMetaHtml}
            </div>
            ${target ? `
            <div class="multiplayer-target-card">
              <div class="pokemon-mini-card">
                <img src="${target.sprite || getPokemonSprite(target)}" alt="${escapeHtml(target.name)}" loading="lazy" data-fallback="${getSpriteUrl(getPokemonSpriteId(target))}" />
                <strong>${escapeHtml(target.name)}</strong>
                <div class="pokemon-card-types">${typeBadgesHtml(target.type1, target.type2)}</div>
              </div>
            </div>` : ""}
          </div>
        `;
      }
      overlay.classList.remove("hidden");
      resultBox.classList.add("hidden");
      resultBox.classList.remove("win-animate");
      document.body.classList.remove("win-page-celebrate");
    }
  }
  return playerWon;
}

function renderMultiplayerBotScreen() {
  ensureMultiplayerLiveState();
  ensureMultiplayerGuessInputBindings();

  const waitingBox = document.getElementById("multiplayer-waiting-box");
  const liveBox = document.getElementById("multiplayer-live-box");
  const resultBox = document.getElementById("multiplayer-result-box");
  const roundStatus = document.getElementById("multiplayer-round-status");
  const connection = document.getElementById("multiplayer-connection-status");
  const code = document.getElementById("multiplayer-room-code");
  const copyInviteButton = document.getElementById("multiplayer-copy-invite");
  const presenceAlert = document.getElementById("multiplayer-presence-alert");
  const liveText = document.getElementById("multiplayer-live-text");
  const waitingText = document.getElementById("multiplayer-waiting-text");
  const guessInput = document.getElementById("multiplayer-guess-input");
  const guessButton = document.querySelector("#multiplayer-live-box .btn-red");
  const roomInput = document.getElementById("multiplayer-room-input");
  const room = multiplayerLiveState.room;
  const players = Array.isArray(room?.players) ? room.players : [];
  const isWaiting = !room || room.status === "waiting";
  const isLive = room?.status === "live";
  const isFinished = room?.status === "finished";
  const playerCount = players.length;
  const roomReady = Boolean(room?.code && playerCount >= 2);
  const opponent = players.find((player) => !player.isSelf) || null;
  const opponentLeft = Boolean(opponent && opponent.connected === false);
  const screen = document.getElementById("screen-multiplayer");

  if (connection) {
    connection.textContent = multiplayerLiveState.connectionStatus === "online"
      ? "Connecté"
      : multiplayerLiveState.connectionStatus === "connecting"
      ? "Connexion..."
      : "Hors ligne";
  }
  if (code) code.textContent = room?.code ? `Code : ${room.code}` : "Code : —";
  if (copyInviteButton) {
    copyInviteButton.classList.toggle("hidden", !room?.code);
    copyInviteButton.disabled = !room?.code;
  }
  if (presenceAlert) {
    let presenceState = "offline";
    let presenceText = "Hors ligne : lance l'app via le serveur pour créer une room.";
    if (multiplayerLiveState.connectionStatus === "connecting") {
      presenceState = "connecting";
      presenceText = "Connexion au serveur Duel live...";
    } else if (multiplayerLiveState.connectionStatus === "online") {
      if (!room?.code) {
        presenceState = "idle";
        presenceText = "Connecté : crée une room ou rejoins un ami.";
      } else if (opponentLeft) {
        presenceState = "left";
        presenceText = `${opponent?.nickname || "L'adversaire"} a quitté le duel.`;
      } else if (isLive) {
        presenceState = "live";
        presenceText = "Partie lancée : les deux joueurs cherchent le même Pokémon.";
      } else if (isFinished) {
        presenceState = "finished";
        presenceText = "Manche terminée.";
      } else if (roomReady) {
        presenceState = "ready";
        presenceText = "Adversaire connecté : la room est complète.";
      } else {
        presenceState = "waiting";
        presenceText = "En attente d'adversaire : partage le lien d'invitation.";
      }
    } else if (multiplayerLiveState.lastRoomClosedReason) {
      presenceState = "left";
      presenceText = multiplayerLiveState.lastRoomClosedReason;
    }
    presenceAlert.dataset.state = presenceState;
    presenceAlert.textContent = presenceText;
  }
  if (screen) {
    screen.dataset.roomState = opponentLeft ? "left" : isLive ? "live" : isFinished ? "finished" : roomReady ? "ready" : room?.code ? "waiting" : "idle";
  }
  waitingBox?.setAttribute("data-room-state", opponentLeft ? "left" : roomReady ? "ready" : room?.code ? "waiting" : "idle");
  renderMultiplayerGenerationGrid();
  renderMultiplayerGenerationSummary();
  renderMultiplayerPlayers();
  renderMultiplayerAttempts();

  if (roomInput) roomInput.disabled = Boolean(isLive);

  if (isWaiting) {
    ensureMultiplayerLiveState().lastGuessFocusKey = "";
    ensureMultiplayerLiveState().pendingGuessSubmit = false;
    const resultHeading = resultBox?.querySelector("h3");
    if (resultHeading) resultHeading.textContent = "Résultat du duel";
    document.getElementById("screen-multiplayer")?.classList.remove("multiplayer-win-state");
    hideMultiplayerWinOverlay();
    resultBox?.classList.remove("is-win", "is-loss", "win-animate");
    if (roundStatus) roundStatus.textContent = roomReady ? "Adversaire connecté" : room?.code ? "En attente d'adversaire" : "Prêt";
    if (waitingText) {
      waitingText.textContent = room?.code
        ? roomReady
          ? "Les deux joueurs sont présents. La manche peut démarrer."
          : "Room créée. Partage le lien d'invitation et attends le second joueur."
        : "Choisis un pseudo, crée une room ou rejoins-en une pour lancer la manche.";
    }
    waitingBox?.classList.remove("hidden");
    liveBox?.classList.add("hidden");
    resultBox?.classList.add("hidden");
    if (guessInput) {
      guessInput.value = "";
    }
    updateMultiplayerGuessSubmitState();
    return;
  }

  if (isLive) {
    const resultHeading = resultBox?.querySelector("h3");
    if (resultHeading) resultHeading.textContent = "Résultat du duel";
    document.getElementById("screen-multiplayer")?.classList.remove("multiplayer-win-state");
    hideMultiplayerWinOverlay();
    resultBox?.classList.remove("is-win", "is-loss", "win-animate");
    if (roundStatus) roundStatus.textContent = "Partie lancée";
    if (liveText) {
      const opponent = players.find((player) => !player.isSelf);
      liveText.textContent = opponent?.lastGuess
        ? `La manche est lancée. ${opponent.nickname} vient de tenter ${opponent.lastGuess}.`
        : "La manche est lancée. Devine le Pokémon avant ton adversaire.";
    }
    waitingBox?.classList.add("hidden");
    liveBox?.classList.remove("hidden");
    resultBox?.classList.add("hidden");
    updateMultiplayerGuessSubmitState();
    focusMultiplayerGuessInputIfReady();
    return;
  }

  if (isFinished) {
    ensureMultiplayerLiveState().lastGuessFocusKey = "";
    ensureMultiplayerLiveState().pendingGuessSubmit = false;
    if (roundStatus) roundStatus.textContent = opponentLeft ? "Adversaire parti" : "Terminé";
    waitingBox?.classList.add("hidden");
    liveBox?.classList.add("hidden");
    resultBox?.classList.remove("hidden");
    updateMultiplayerGuessSubmitState();
    renderMultiplayerBotResult();
  }
}

function filterMultiplayerGuessAC() {
  const input = document.getElementById("multiplayer-guess-input");
  const list = document.getElementById("multiplayer-guess-ac");
  acIndex = -1;

  const qNorm = norm(input?.value.trim());
  const pool = getMultiplayerRoomPool();
  const guessed = multiplayerLiveState?.submittedGuessNames || new Set();
  if (!qNorm || !pool.length) {
    list?.classList.add("hidden");
    return;
  }

  const matches = pool
    .filter((pokemon) => norm(pokemon.name).includes(qNorm) && !guessed.has(pokemon.name))
    .slice(0, AC_LIMIT);
  renderMultiplayerGuessAC(matches);
}

function createMultiplayerRoom() {
  const socket = ensureMultiplayerSocket();
  const input = document.getElementById("multiplayer-nickname");
  const nickname = String(input?.value || playerProfile.nickname || "").trim() || "Dresseur";
  if (input) input.value = nickname;
  if (!nickname) {
    setMultiplayerError("Entre un pseudo valide.");
    return;
  }
  if (!socket) return;

  if (multiplayerLiveState?.room?.code) {
    socket.emit("duel:leave-room");
  }
  setMultiplayerError("");
  const selectedGensForRoom = getMultiplayerSelectedGens();
  multiplayerLiveState = createDefaultMultiplayerLiveState();
  multiplayerLiveState.selectedGens = new Set(selectedGensForRoom);
  setMultiplayerConnectionStatus(socket.connected ? "online" : "connecting");
  socket.emit("duel:create-room", { nickname, selectedGens: selectedGensForRoom }, (response = {}) => {
    if (!response.ok) {
      setMultiplayerError(response.error || "Impossible de créer la room.");
      return;
    }
    ensureMultiplayerLiveState().room = response.room || null;
    ensureMultiplayerLiveState().selectedGens = new Set(selectedGensForRoom);
    if (response.room?.code) saveDuelSession(response.room.code, nickname);
    renderMultiplayerBotScreen();
  });
}

function joinMultiplayerRoom() {
  const socket = ensureMultiplayerSocket();
  const input = document.getElementById("multiplayer-nickname");
  const codeInput = document.getElementById("multiplayer-room-input");
  const nickname = String(input?.value || playerProfile.nickname || "").trim() || "Dresseur";
  const code = String(codeInput?.value || "").trim().toUpperCase();

  if (input) input.value = nickname;
  if (codeInput) codeInput.value = code;
  if (!nickname) {
    setMultiplayerError("Entre un pseudo valide.");
    return;
  }
  if (!code) {
    setMultiplayerError("Entre un code de room.");
    return;
  }
  if (!socket) return;

  if (multiplayerLiveState?.room?.code) {
    socket.emit("duel:leave-room");
  }
  setMultiplayerError("");
  multiplayerLiveState = createDefaultMultiplayerLiveState();
  setMultiplayerConnectionStatus(socket.connected ? "online" : "connecting");

  socket.emit("duel:join-room", { nickname, code }, (response = {}) => {
    if (!response.ok) {
      setMultiplayerError(response.error || "Impossible de rejoindre la room.");
      return;
    }
    ensureMultiplayerLiveState().room = response.room || null;
    if (response.room?.code || code) saveDuelSession(response.room?.code || code, nickname);
    renderMultiplayerBotScreen();
  });
}

function submitMultiplayerGuess() {
  const state = ensureMultiplayerLiveState();
  const room = state?.room;
  if (!room || room.status !== "live") return;
  if (state.pendingGuessSubmit) return;

  const socket = ensureMultiplayerSocket();
  const input = document.getElementById("multiplayer-guess-input");
  const raw = String(input?.value || "").trim();
  const pool = getMultiplayerRoomPool();
  const picked = findPokemonGlobalByName(raw);
  const inPool = picked && pool.some((pokemon) => pokemon.id === picked.id);

  if (!raw) return;
  if (!picked || !inPool) {
    setMultiplayerError("Choisis un Pokémon présent dans les générations de la room.");
    return;
  }
  if (multiplayerLiveState.submittedGuessNames.has(picked.name)) {
    setMultiplayerError("Tu as déjà tenté ce Pokémon.");
    return;
  }
  if (!socket) return;

  setMultiplayerError("");
  state.pendingGuessSubmit = true;
  state.submittedGuessNames.add(picked.name);
  if (input) input.value = "";
  document.getElementById("multiplayer-guess-ac")?.classList.add("hidden");
  renderMultiplayerBotScreen();
  socket.emit("duel:submit-guess", { guess: picked.name }, (response = {}) => {
    state.pendingGuessSubmit = false;
    if (!response.ok) {
      state.submittedGuessNames.delete(picked.name);
      if (input) input.value = raw;
      setMultiplayerError(response.error || "Impossible d'envoyer la tentative.");
      renderMultiplayerBotScreen();
      return;
    }
    renderMultiplayerBotScreen();
  });
}

function restartMultiplayerRound(mode = "same") {
  const room = multiplayerLiveState?.room;
  if (!room || room.status !== "finished") return;
  if (!multiplayerSocket?.connected) {
    setMultiplayerError("Connexion perdue. Impossible de relancer la manche.");
    return;
  }

  setMultiplayerError("");
  const self = room.players?.find((player) => player.isSelf) || null;
  const selectedGensForRoom = mode === "updated"
    ? getMultiplayerSelectedGens()
    : Array.isArray(room.selectedGens) && room.selectedGens.length
      ? room.selectedGens.slice()
      : getMultiplayerSelectedGens();
  if (mode === "updated" && !self?.isHost) {
    setMultiplayerError("Seul le créateur peut relancer avec d'autres générations.");
    return;
  }
  multiplayerSocket.emit("duel:restart-round", { selectedGens: selectedGensForRoom }, (response = {}) => {
    if (!response.ok) {
      setMultiplayerError(response.error || "Impossible de relancer la manche.");
      return;
    }
    ensureMultiplayerLiveState().submittedGuessNames = new Set();
    ensureMultiplayerLiveState().selectedGens = new Set(selectedGensForRoom);
    ensureMultiplayerLiveState().room = response.room || room;
    document.getElementById("multiplayer-guess-input")?.value && (document.getElementById("multiplayer-guess-input").value = "");
    document.getElementById("multiplayer-guess-ac")?.classList.add("hidden");
    renderMultiplayerBotScreen();
  });
}

function leaveMultiplayerRoom(resetOnly = false) {
  if (multiplayerSocket?.connected && multiplayerLiveState?.room?.code) {
    multiplayerSocket.emit("duel:leave-room");
  }
  clearDuelSession();
  resetMultiplayerLiveSession();
  setMultiplayerError("");
  renderMultiplayerBotScreen();
  if (!resetOnly) goToConfig();
}

function getMultiplayerInviteLink(code) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", code);
  return url.toString();
}

function copyMultiplayerRoomCode() {
  const code = multiplayerLiveState?.room?.code;
  if (!code) {
    setMultiplayerError("Aucune room active à copier.");
    return;
  }
  const inviteLink = getMultiplayerInviteLink(code);
  navigator.clipboard?.writeText(inviteLink)
    .then(() => setMultiplayerError("Lien d'invitation copié."))
    .catch(() => setMultiplayerError(`Lien d'invitation : ${inviteLink}`));
}

function checkMultiplayerInviteURL() {
  const inviteCode = new URLSearchParams(window.location.search).get("room");
  if (!inviteCode) return false;
  openMultiplayerMode();
  const roomInput = document.getElementById("multiplayer-room-input");
  if (roomInput) roomInput.value = inviteCode.trim().toUpperCase().slice(0, 5);
  return true;
}

function openMultiplayerMode() {
  closeOverlayModal();
  goToConfig();
  hideScreen("screen-config");
  hideScreen("screen-team-builder");
  hideScreen("screen-teams");
  showScreen("screen-multiplayer");
  document.querySelector(".search-bar")?.classList.add("hidden");
  ensureMultiplayerLiveState();
  renderMultiplayerGenerationGrid();
  ensureMultiplayerSocket();
  const inviteCode = new URLSearchParams(window.location.search).get("room");
  const roomInput = document.getElementById("multiplayer-room-input");
  if (inviteCode && roomInput && !multiplayerLiveState?.room?.code) {
    roomInput.value = inviteCode.trim().toUpperCase().slice(0, 5);
  }
  renderMultiplayerBotScreen();
}

function initProfessionalModeMenu() {
  const select = document.getElementById('mode-select-pro');
  const desc = document.getElementById('mode-pro-desc');
  if (!select || !desc || typeof PROFESSIONAL_MODE_CONFIG === 'undefined') return;
  select.innerHTML = Object.entries(PROFESSIONAL_MODE_CONFIG).map(([fn, cfg]) => `<option value="${fn}">${cfg.label}</option>`).join('');
  const sync = () => {
    const cfg = PROFESSIONAL_MODE_CONFIG[select.value];
    desc.textContent = cfg?.description || 'Choisis un mode et lance immédiatement.';
  };
  select.addEventListener('change', sync);
  document.querySelectorAll('#mode-cat-filters .mode-cat-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#mode-cat-filters .mode-cat-btn').forEach((entry) => entry.classList.remove('active'));
      button.classList.add('active');
      const cat = button.dataset.cat || 'all';
      const entries = Object.entries(PROFESSIONAL_MODE_CONFIG).filter(([, cfg]) => cat === 'all' || cfg.category === cat);
      select.innerHTML = entries.map(([fn, cfg]) => `<option value="${fn}">${cfg.label}</option>`).join('');
      sync();
    });
  });
  sync();
}

function launchSelectedMode() {
  const select = document.getElementById('mode-select-pro');
  const fn = select?.value;
  if (fn && typeof window[fn] === 'function') window[fn]();
}

function selectChallengePokemon(id) {
  const pokemon = POKEMON_BY_ID.get(Number(id));
  if (!pokemon) return;
  const preview = document.getElementById('challenge-preview');
  const sprite = document.getElementById('challenge-sprite');
  const name = document.getElementById('challenge-name');
  const input = document.getElementById('challenge-input');
  if (preview) preview.classList.remove('hidden');
  if (sprite) { sprite.src = pokemon.sprite || getSpriteUrl(pokemon.id); sprite.alt = pokemon.name; }
  if (name) name.textContent = pokemon.name;
  if (input) input.value = pokemon.name;
  document.getElementById('challenge-ac')?.classList.add('hidden');
}

// Lot C audit : les dropdowns de nav s'ouvraient uniquement au :hover /
// :focus-within (fragile au tactile, pas de fermeture Escape, aria-expanded
// jamais mis à jour). Toggle explicite au clic + fermeture extérieure/Escape.
function initNavDropdownToggles() {
  const groups = Array.from(document.querySelectorAll(".nav-group"));
  if (!groups.length) return;

  const setOpen = (group, open) => {
    group.classList.toggle("open", open);
    const trigger = group.querySelector(".nav-pill-menu");
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    // Mobile : la nav défile horizontalement, le dropdown passe en position
    // fixe juste sous son déclencheur pour ne pas être rogné par l'overflow.
    const dropdown = group.querySelector(".nav-dropdown");
    if (dropdown) {
      if (open && window.matchMedia && window.matchMedia("(max-width: 640px)").matches && trigger) {
        dropdown.style.top = `${Math.round(trigger.getBoundingClientRect().bottom + 8)}px`;
      } else {
        dropdown.style.top = "";
      }
    }
  };
  const closeAll = (except = null) => {
    for (const group of groups) {
      if (group !== except) setOpen(group, false);
    }
  };

  for (const group of groups) {
    const trigger = group.querySelector(".nav-pill-menu");
    if (!trigger) continue;
    trigger.addEventListener("click", () => {
      const willOpen = !group.classList.contains("open");
      closeAll(group);
      setOpen(group, willOpen);
    });
    // Choisir une entrée du menu referme le dropdown.
    group.querySelectorAll(".nav-dropdown button").forEach((item) => {
      item.addEventListener("click", () => closeAll());
    });
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".nav-group")) closeAll();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });
}

// Vague motion : les sections de la home se révèlent au scroll (stagger par rangée).
function initHomeScrollReveals() {
  if (typeof IntersectionObserver !== "function") return;
  if (document.body.classList.contains("reduce-motion")) return;
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch (_err) { /* matchMedia indisponible */ }

  const targets = document.querySelectorAll(
    "#screen-config .home-section-head, #screen-config .home-pillar, #screen-config .home-generations-card, #screen-config .home-progress-card, #screen-config .home-engagement-widget, #screen-config .mode-stat-block"
  );
  if (!targets.length) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("sr-in");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

  targets.forEach((el, index) => {
    el.classList.add("sr-item");
    el.style.transitionDelay = `${(index % 3) * 70}ms`;
    observer.observe(el);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  applyAppSettings();
  initNavDropdownToggles();
  initHomeScrollReveals();
  loadProfile();
  // Le premier renderStats() tourne avant loadProfile() (autre listener) :
  // on re-rend après chargement du profil pour que la carte Niveau soit juste.
  if (typeof renderStats === "function") renderStats();
  loadAchievementsState();
  loadMatchHistory();
  evaluateAchievements();
  hideExtraScreens();
  // Grace duel : après un refresh en pleine manche, reconnecter le socket
  // (la reprise se fait dans le handler "connect" via attemptDuelResume).
  try {
    const rawDuelSession = sessionStorage.getItem(DUEL_SESSION_STORAGE_KEY);
    if (rawDuelSession) {
      const duelSession = JSON.parse(rawDuelSession);
      if (duelSession?.code && Date.now() - (duelSession.ts || 0) <= DUEL_SESSION_TTL_MS) {
        ensureMultiplayerSocket();
      }
    }
  } catch (_err) { /* stockage indisponible */ }
  // Lot D audit : sur /emulateur (page à CSP permissive), ouvrir directement l'écran émulateur.
  if (window.location.pathname === "/emulateur") openEmulatorMode();
  document.getElementById('logo-home')?.addEventListener('click', goToConfig);
  document.getElementById('overlay-modal')?.addEventListener('click', onOverlayBackdropClick);
  document.getElementById('match-history-filter')?.addEventListener('change', renderMatchHistoryScreen);
  document.getElementById('profile-nickname')?.addEventListener('change', (event) => {
    playerProfile.nickname = String(event.target.value || "").trim().slice(0, 24);
    saveProfile();
    document.getElementById('profile-save-msg')?.classList.remove('hidden');
    renderProfileScreen();
  });
  document.getElementById('profile-favorite-input')?.addEventListener('change', (event) => {
    const picked = findPokemonGlobalByName(String(event.target.value || "").trim());
    playerProfile.favoritePokemonId = picked ? picked.id : null;
    saveProfile();
    document.getElementById('profile-save-msg')?.classList.remove('hidden');
    renderProfileScreen();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeOverlayModal();
  });
  initProfessionalModeMenu();
});
