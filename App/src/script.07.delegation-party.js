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

function getDailyDateKey(date = new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function getDailyNumber(date = new Date()) { return Math.floor((Date.parse(getDailyDateKey(date))-Date.parse("2026-03-23"))/86400000)+1; }
function getDailyResetAt(date = new Date()) {
  const next=new Date(Date.parse(getDailyDateKey(date)+"T12:00:00Z")+86400000).toISOString().slice(0,10);
  const nominal=Date.parse(next+"T00:00:00Z");let instant=nominal;
  for(let i=0;i<3;i++){
    const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
    instant=nominal-(Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-instant);
  }
  return instant;
}

function prevUTCDateKey(key) {
  const [y, m, d] = key.split("-").map((v) => Number(v));
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return getDailyDateKey(date);
}

function refreshDailyStreakStatus() {
  const last = playerStats.lastDailyWinKey;
  if (!last) {
    playerStats.dailyCurrentStreak = 0;
    return;
  }

  const today = getDailyDateKey();
  const yesterday = prevUTCDateKey(today);

  if (last !== today && last !== yesterday) {
    playerStats.dailyCurrentStreak = 0;
  }
}

function registerDailyWinStreak() {
  if (dailyServerState?.authenticated) { playerStats.dailyCurrentStreak=dailyServerState.streak.current;playerStats.dailyBestStreak=dailyServerState.streak.best;playerStats.lastDailyWinKey=dailyServerState.streak.lastWin;return; }
  const today = getDailyDateKey();

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
    lastDailyStartedKey: typeof parsed.lastDailyStartedKey === "string" ? parsed.lastDailyStartedKey : null,
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
      ["Marathon mini-jeux", Number(playerProfile?.partyHighScore) || 0, "points record"],
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
    if (homeLevelNext) homeLevelNext.textContent = homeProg.next ? `Niveau ${homeProg.next.level} dans ${homeProg.next.minXp - homeXp} XP` : "Niveau max !";
    if (homeLevelBar) homeLevelBar.style.width = `${homeProg.percent}%`;
  }
}

function registerGameStart() {
  if(gameMode==='daily'){
    if(!dailyServerState||dailyServerState.finished)return;
    const key=String(dailyServerState.accountId||'guest')+':'+dailyServerState.day;
    if(playerStats.lastDailyStartedKey===key)return;
    playerStats.lastDailyStartedKey=key;
  }
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
    // XP + quête uniquement pour la première victoire du jour (anti double-comptage).
    const firstDailyWinToday = dailyServerState ? dailyServerState.won : playerStats.lastDailyWinKey !== getDailyDateKey();
    registerDailyWinStreak();
    if (firstDailyWinToday) {
      awardXp(80, "Pokédle du jour");
      progressQuest("win_daily", 1);
    }
  } else if (gameMode === "normal" || gameMode === "challenge") {
    // XP variable selon le nombre d'essais (moins = mieux)
    const xpReward = Math.max(20, 80 - (attempts - 1) * 8);
    awardXp(xpReward, "Pokédle classique", "classic");
  } else {
    awardXp(40, `Mode ${gameMode}`, gameMode);
  }

  saveStats();
  evaluateAchievements();
  renderStats();
}

// ============================================================
// AUTO-SAVE / RESTORE GAME
// ============================================================
function saveCurrentGame(forcedDailyKey = null) {
  if(gameMode === "daily") { if(dailyServerState && !dailyServerState.finished) writeJson(STORAGE_KEYS.dailyGame,{version:2,mode:"daily",dailyKey:dailyServerState.day,accountId:dailyServerState.accountId,attempts,historyIds:resultHistory.map(r=>r.pokemon.id),rows:dailyServerState.rows,savedAt:Date.now()});return; }
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
    dailyKey: forcedDailyKey || (gameMode === "daily" ? getDailyDateKey() : null),
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

function restoreSavedGame(preferredMode = null) {
  // Priorité au daily du jour (slot dédié), sinon la dernière partie d'un autre mode.
  let save = preferredMode && preferredMode !== "daily" ? null : readJson(STORAGE_KEYS.dailyGame, null);
  if (save && (save.mode !== "daily" || save.dailyKey !== getDailyDateKey())) {
    clearSavedGame("daily");
    save = null;
  }
  if (!save) {
    save = readJson(STORAGE_KEYS.game, null);
    if (save && save.mode === "daily") {
      // Migration : ancienne sauvegarde daily dans le slot commun.
      if (save.dailyKey === getDailyDateKey()) writeJson(STORAGE_KEYS.dailyGame, save);
      clearSavedGame("normal");
      if (save.dailyKey !== getDailyDateKey()) save = null;
    }
  }
  if (!save || (preferredMode && save.mode !== preferredMode)) return false;

  if (!VALID_MODES.has(save.mode)) {
    clearSavedGame(save.mode);
    return false;
  }

  if (save.mode === "daily" && save.dailyKey !== getDailyDateKey()) {
    clearSavedGame("daily");
    return false;
  }

  if(save.mode === "daily") { startDailyGame();return true; }
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

  guessedNames = Array.isArray(save.guessedNames) ? save.guessedNames.filter((n) => typeof n === "string").map(n => n.replace(/^(.+) Mega( [XY])?$/, "Méga-$1$2")) : [];
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

  setGameCounter(attempts);
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

  if (gameMode === "daily") syncDailyObservedState();
  return true;
}

// ============================================================
// DAILY : RÉSULTAT DU JOUR (grille-trophée, anti-rejeu)
// ============================================================
// Le daily se joue une seule fois par jour : le résultat (gagné ou abandonné)
// est conservé pour ré-afficher la grille terminée au lieu de relancer une partie.
function saveDailyResult(won) {
  if(gameMode !== "daily" || !dailyServerState?.finished)return;
  writeJson(STORAGE_KEYS.dailyResult,{version:2,dailyKey:dailyServerState.day,number:dailyServerState.number,accountId:dailyServerState.accountId,won:Boolean(won),attempts,secretId:dailyServerState.answerId,historyIds:resultHistory.map(r=>r.pokemon.id),rows:dailyServerState.rows,finishedAt:Date.now()});
}
function getTodayDailyResult() {
  const rec=readJson(STORAGE_KEYS.dailyResult,null);
  return rec?.version===2 && rec.dailyKey===getDailyDateKey() && rec.accountId===dailyObservedAccountId() ? rec : null;
}
function showDailyCompletedView() { if(!getTodayDailyResult())return false;startDailyGame();return true; }

// ============================================================
// UTILS
// ============================================================
function norm(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(.+?) mega( [xyz])?$/, "mega $1$2")
    .replace(/^mega[-\s]+/, "mega ");
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
    // A form keeps its own PokeAPI sprite id (10033, or "649-douse" for form-only sprites).
    pokemon.spriteId = pokemon.spriteId || SPRITE_ID_OVERRIDES_BY_NAME[pokemon.name] || pokemon.id;
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

// The National Pokédex number shown to players: a form keeps its species' number.
function getPokemonDexNumber(pokemon) {
  const base = Number(pokemon?.baseId);
  return (pokemon?.isAltForm || Number(pokemon?.id) >= 20000) && base > 0 ? base : Number(pokemon?.id) || 0;
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

function openFromAllModes(name, ...args) {
  var fn = window[name];
  if (typeof fn !== "function") return;
  hideScreen("screen-all-modes");
  fn(...args);
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
        playerProfile.avatarChoice = "photo";
        playerProfile.avatarPhotoShared = true;
        saveProfile();
        syncProfileNow();
        refreshAccountChipAvatar();
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
  if (playerProfile) {
    playerProfile.avatarPhoto = "";
    if (playerProfile.avatarChoice === "photo") playerProfile.avatarChoice = "";
    saveProfile();
    syncProfileNow();
  }
  if (typeof renderProfileScreen === "function") renderProfileScreen();
  refreshAccountChipAvatar();
  showToast("Photo retirée.");
}


let connectedAccountUser = null;
// « Image de profil » (26/10): the player picks the picture shown on their card, in the top bar
// and in the rankings. A photo shows in the rankings once picked under the note saying so
// (avatarPhotoShared); photos sent before stay private. Without a choice, the card shows
// the photo, then the partner, then the account picture, and the top bar the account picture.
const PROFILE_AVATAR_CHOICES = ["partner", "photo", "account"];
// The rankings follow a new picture right away instead of at the next minute's sync.
function syncProfileNow() {
  if (typeof window !== "undefined" && typeof window.pokedleSyncNow === "function") window.pokedleSyncNow();
}
function profileAvatarOptions() {
  const partner = playerProfile?.favoritePokemonId ? POKEMON_BY_ID.get(Number(playerProfile.favoritePokemonId)) : null;
  return {
    partner: partner ? getPokemonSprite(partner) : "",
    photo: playerProfile?.avatarPhoto || "",
    account: connectedAccountUser?.avatar || "",
  };
}
// The chosen picture when it still exists, otherwise "" and each place keeps its own rule.
function profileAvatarChoice() {
  const choice = playerProfile?.avatarChoice;
  return PROFILE_AVATAR_CHOICES.includes(choice) && profileAvatarOptions()[choice] ? choice : "";
}
function setProfileAvatarChoice(choice) {
  if (!playerProfile || !PROFILE_AVATAR_CHOICES.includes(choice) || !profileAvatarOptions()[choice]) return;
  playerProfile.avatarChoice = choice;
  if (choice === "photo") playerProfile.avatarPhotoShared = true;
  saveProfile();
  syncProfileNow();
  if (typeof renderProfileScreen === "function") renderProfileScreen();
  refreshAccountChipAvatar();
  showToast("Image de profil mise à jour ✅");
}
function renderProfileAvatarChoices() {
  const box = document.getElementById("profile-avatar-choices");
  if (!box) return;
  const options = profileAvatarOptions();
  const current = profileAvatarChoice() || PROFILE_AVATAR_CHOICES.slice().sort((a, b) => ["photo", "partner", "account"].indexOf(a) - ["photo", "partner", "account"].indexOf(b)).find((key) => options[key]) || "";
  const labels = { partner: "Mon partenaire", photo: "Ma photo", account: "Image du compte" };
  const missing = { partner: "Choisis d’abord un partenaire", photo: "Ajoute d’abord une photo", account: "Connecte-toi avec Discord, Google ou Twitch" };
  box.innerHTML = PROFILE_AVATAR_CHOICES.map((key) => {
    const src = options[key];
    return `<button type="button" class="profile-avatar-choice${key === current ? " is-selected" : ""}${key === "partner" ? " is-pokemon" : ""}" role="radio" aria-checked="${key === current}" data-action="setProfileAvatarChoice" data-args='["${key}"]'${src ? "" : " disabled"}>` +
      (src ? `<img src="${escapeHtml(src)}" alt="" />` : `<span class="profile-avatar-choice-empty" aria-hidden="true">?</span>`) +
      `<b>${labels[key]}</b>${src ? "" : `<small>${missing[key]}</small>`}</button>`;
  }).join("");
}
// The picture of the top bar and of the « Mon compte » menu: the chosen one, else the account's.
function accountAvatarSrc(user) {
  const choice = profileAvatarChoice();
  return choice && choice !== "account" ? profileAvatarOptions()[choice] : (user?.avatar || "");
}
function refreshAccountChipAvatar() {
  const area = document.getElementById("account-area");
  if (area && connectedAccountUser && area.querySelector(".account-chip")) area.innerHTML = accountChipHtml(connectedAccountUser);
}
function accountChipHtml(user) {
  const name = escapeHtml(user.username || 'Dresseur');
  const src = accountAvatarSrc(user);
  const avatar = src ? `<img class="account-avatar${profileAvatarChoice() === "partner" ? " is-pokemon" : ""}" src="${escapeHtml(src)}" alt="" />` : `<span class="account-avatar account-avatar-fallback" aria-hidden="true">${escapeHtml((user.username || 'D').charAt(0).toUpperCase())}</span>`;
  return `<button type="button" class="account-chip account-profile" data-action="openAccountMenu" aria-label="Ouvrir mon compte" aria-haspopup="dialog">${avatar}<span class="account-name">${name}</span><span class="account-chevron" aria-hidden="true">⌄</span></button>`;
}
function openAccountMenu() {
  if (!connectedAccountUser) return;
  const menuAvatar = accountAvatarSrc(connectedAccountUser);
  const avatar = menuAvatar
    ? `<img${profileAvatarChoice() === "partner" ? ' class="is-pokemon"' : ""} src="${escapeHtml(menuAvatar)}" alt="" />`
    : `<span class="account-menu-avatar-fallback">${escapeHtml((connectedAccountUser.username || 'D').charAt(0).toUpperCase())}</span>`;
  const level = typeof getXpTier === 'function' ? getXpTier(Number(playerProfile?.xp) || 0) : { level: 1, name: 'Dresseur' };
  const dex = typeof pokedexCollectionNationalStats === 'function' ? pokedexCollectionNationalStats() : { found: Object.keys(playerProfile?.discoveries || {}).length, total: 0 };
  ensureOverlay('Mon compte', `
    <div class="account-menu account-menu-v2">
      <div class="account-menu-identity">
        <div class="account-menu-avatar">${avatar}</div>
        <div><span class="adventure-eyebrow">CONNECTÉ AVEC ${(ACCOUNT_PROVIDER_NAMES[connectedAccountUser.via] || 'Discord').toUpperCase()}</span><h4>${escapeHtml(connectedAccountUser.username || 'Dresseur')}</h4><small>Niv. ${Number(level.level)||1} · ${escapeHtml(level.name || 'Dresseur')}</small></div>
      </div>
      <div class="account-menu-stats">
        <div><strong>${Number(playerProfile?.xp)||0}</strong><span>XP</span></div>
        <div><strong>${Number(dex.found)||0}${dex.total ? '<small>/'+Number(dex.total)+'</small>' : ''}</strong><span>Pokédex</span></div>
        <div><strong>${Object.keys(playerProfile?.weeklyLeagueBadges || {}).length}</strong><span>Badges Ligue</span></div>
      </div>
      <nav class="account-menu-links">
        <button type="button" class="${typeof inboxCounts === 'function' && inboxCounts().duels ? 'is-hot' : ''}" data-action="accountNavigate" data-args='["defis"]'><span>⚔️ Mes défis${typeof inboxCounts === 'function' && inboxCounts().duels ? ' <i class="pc-badge">' + inboxCounts().duels + '</i>' : ''}</span><b>→</b></button>
        <button type="button" class="${typeof inboxCounts === 'function' && inboxCounts().messages ? 'is-hot' : ''}" data-action="accountNavigate" data-args='["messages"]'><span>📬 Mes messages${typeof inboxCounts === 'function' && inboxCounts().messages ? ' <i class="pc-badge">' + inboxCounts().messages + '</i>' : ''}</span><b>→</b></button>
        <button type="button" data-action="accountNavigate" data-args='["profile"]'><span>Profil de dresseur</span><b>→</b></button>
        <button type="button" data-action="accountNavigate" data-args='["album"]'><span>Ma collection</span><b>→</b></button>
        <button type="button" data-action="accountNavigate" data-args='["invite"]'><span>🎁 Invite un ami</span><b>→</b></button>
        <button type="button" data-action="accountNavigate" data-args='["past"]'><span>📅 Jours passés</span><b>→</b></button>
        ${typeof installIsStandalone === 'function' && installIsStandalone() ? '' : `<button type="button" data-action="accountNavigate" data-args='["install"]'><span>📲 Installer l’appli</span><b>→</b></button>`}
        <button type="button" data-action="accountNavigate" data-args='["settings"]'><span>Paramètres</span><b>→</b></button>
        ${connectedAccountUser.admin ? `<button type="button" data-action="accountNavigate" data-args='["admin"]'><span>Panneau admin</span><b>→</b></button>` : ''}
      </nav>
      <div class="account-menu-linked" id="account-menu-linked" aria-live="polite"></div>
      <a class="account-menu-logout" href="/auth/logout">Se déconnecter</a>
      <a class="account-menu-privacy" href="/confidentialite">Confidentialité</a>
      <button type="button" class="account-menu-delete" data-action="confirmDeleteAccount">Supprimer mon compte</button>
    </div>`);
  renderAccountLinkedProviders();
}
const ACCOUNT_PROVIDER_NAMES = { discord: 'Discord', google: 'Google', twitch: 'Twitch' };
// "Relier Google / Discord / Twitch": the missing sign-ins of this account, one tap away.
// Signing in with them while connected adds them to this account.
function renderAccountLinkedProviders() {
  const box = document.getElementById('account-menu-linked');
  if (!box || !connectedAccountUser) return;
  const providers = window.__pokedleProviders || {};
  fetch('/api/account/identities', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.json()).then(data => {
    if (!data?.ok || !document.getElementById('account-menu-linked')) return;
    const names = ACCOUNT_PROVIDER_NAMES;
    const linked = data.identities.filter(id => names[id]);
    const missing = Object.keys(names).filter(id => providers[id] && !linked.includes(id));
    box.innerHTML = '<span>Connexion avec : ' + escapeHtml(linked.map(id => names[id]).join(' et ') || '—') + '</span>' +
      missing.map(id => '<a class="btn-ghost account-link-provider" href="/auth/' + id + '">Relier ' + names[id] + '</a>').join('');
  }).catch(() => {});
}
function confirmDeleteAccount() {
  if (!connectedAccountUser) return;
  ensureOverlay('Supprimer mon compte ?', '<p class="card-desc">Ton compte, ta progression en ligne et tes résultats des classements seront <b>effacés pour de bon</b>. Les connexions (Discord, Google, Twitch) reliées à ce compte disparaissent aussi.</p><p class="card-desc">Ta progression reste sur cet appareil, comme pour un invité.</p><div class="reset-confirm-actions"><button class="btn-ghost" type="button" data-action="openAccountMenu">Annuler</button><button class="btn-red" type="button" data-action="doDeleteAccount">Supprimer définitivement</button></div>');
}
function doDeleteAccount() {
  const accountId = connectedAccountUser ? String(connectedAccountUser.id) : '';
  if (!accountId) return;
  fetch('/api/account/delete', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'SUPPRIMER' }) })
    .then(r => r.json().catch(() => ({})).then(data => ({ ok: r.ok && data.ok })))
    .then(({ ok }) => {
      if (!ok) { showToast('Suppression impossible pour le moment. Réessaie.'); return; }
      // The account is gone: forget its copies on this device, keep playing as a guest.
      try {
        const encoded = encodeURIComponent(accountId);
        ['pokedle_sync_cache_v2:' + encoded, 'pokedle_sync_conflict_v2:' + encoded, 'pokedle_sync_owner_v2', 'pokedle_sync_at'].forEach(key => localStorage.removeItem(key));
        const points = JSON.parse(localStorage.getItem('pokedle_restore_points_v1') || '[]');
        if (Array.isArray(points)) localStorage.setItem('pokedle_restore_points_v1', JSON.stringify(points.filter(p => String(p?.owner || '') !== accountId)));
      } catch (_e) {}
      location.href = '/?auth=deleted';
    })
    .catch(() => showToast('Suppression impossible pour le moment. Réessaie.'));
}
function accountNavigate(destination) {
  closeOverlayModal();
  if (destination === 'album') openDiscoveryAlbum();
  else if (destination === 'settings') openSettingsModal();
  else if (destination === 'admin') location.assign('/admin');
  else if (destination === 'messages' && typeof openMyMessages === 'function') openMyMessages();
  else if (destination === 'defis' && typeof openMyChallenges === 'function') openMyChallenges();
  else if (destination === 'install' && typeof openInstallApp === 'function') openInstallApp();
  else if (destination === 'invite' && typeof openInviteFriend === 'function') openInviteFriend();
  else if (destination === 'past' && typeof openPastDays === 'function') openPastDays();
  else { openProfileScreen(); switchProfileView('trainer'); }
}
(function () {
  function renderAccount(data) {
    connectedAccountUser = data?.auth ? data.user || null : null;
    window.__pokedleProviders = data?.providers || { discord: Boolean(data?.auth), google: false };
    window.__pokedleAuthed = Boolean(data?.user);
    // Guest or signed in, the account is now known: progress seeded from the shared log can start.
    if (!window.__pokedleAccountKnown) {
      window.__pokedleAccountKnown = true;
      try { window.dispatchEvent(new CustomEvent("pokedle:account-known", { detail: { user: connectedAccountUser } })); } catch (_e) {}
    }
    if (window.__pokedleAuthed) {
      try { window.dispatchEvent(new CustomEvent("pokedle:auth-ready", { detail: { user: data.user } })); } catch (_e) {}
    }
    var el = document.getElementById("account-area");
    if (!el) return;
    if (!data || !data.auth) { el.innerHTML = ""; return; }
    if (data.user) {
      el.innerHTML = accountChipHtml(data.user);
    } else {
      el.innerHTML = '<a class="account-login" href="/auth/discord" aria-label="Se connecter" title="Se connecter"><svg class="account-login-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.24-8 5v1.5h16V19c0-2.76-3.6-5-8-5Z"/></svg>Se connecter</a>';
    }
  }
  function initAccount() {
    try {
      var p = new URLSearchParams(location.search);
      var m = p.get("auth");
      if (m) {
        if (typeof showToast === "function") {
          var via = Object.prototype.hasOwnProperty.call(ACCOUNT_PROVIDER_NAMES, p.get("via")) ? ACCOUNT_PROVIDER_NAMES[p.get("via")] : "Discord";
          if (m === "ok") showToast("Connecté avec " + via + " ✅");
          else if (m === "linked") showToast(via + " est maintenant relié à ton compte ✅");
          else if (m === "deleted") showToast("Ton compte a été supprimé.");
          else if (m === "erreur") showToast("Échec de la connexion " + via + ".");
          else if (m === "indispo") showToast("Connexion indisponible pour le moment.");
        }
        p.delete("auth");
        p.delete("via");
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
  var SYNC_OWNER = "pokedle_sync_owner_v2";
  var CACHE_PREFIX = "pokedle_sync_cache_v2:";
  var ANON_CACHE = "pokedle_sync_cache_v2:anonymous";
  var LEGACY_BACKUP = "pokedle_sync_legacy_backup_v2";
  var CONFLICT_PREFIX = "pokedle_sync_conflict_v2:";
  // The last copy known to match the server, kept across reloads: it lets a merge add up
  // what each device earned since then instead of only keeping the higher numbers.
  var BASE_PREFIX = "pokedle_sync_base_v1:";
  var loggedIn = false;
  // Local/server ownership must be reconciled before this page is allowed to upload.
  // This also prevents a restore-triggered reload from beaconing the restored blob back
  // with a newer timestamp and creating a reload feedback loop on Safari.
  var syncReady = false;
  var activeAccountId = "";

  function storageKey(name) { return (typeof STORAGE_KEYS !== "undefined" && STORAGE_KEYS[name]) || null; }
  function readItem(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writeItem(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }
  function removeItem(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function parseBlob(raw) {
    if (!raw) return null;
    try {
      var value = JSON.parse(raw);
      return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch (e) { return null; }
  }
  function hasContent(blob) {
    return Boolean(blob && SYNC_KEYS.some(function (k) { return typeof blob[k] === "string"; }));
  }
  function sameContent(a, b) {
    return SYNC_KEYS.every(function (k) {
      return (typeof a?.[k] === "string" ? a[k] : null) === (typeof b?.[k] === "string" ? b[k] : null);
    });
  }
  function snapshotLocal(accountId, savedAt) {
    var blob = { _savedAt: Math.max(0, Number(savedAt) || 0) };
    if (accountId) blob._accountId = String(accountId);
    SYNC_KEYS.forEach(function (k) {
      var sk = storageKey(k); if (!sk) return;
      var value = readItem(sk);
      if (value != null) blob[k] = value;
    });
    return blob;
  }
  function buildLocalBlob(accountId) {
    return snapshotLocal(accountId, Date.now());
  }
  function localSavedAt() { return Math.max(0, Number(readItem(SYNC_AT) || 0)); }
  function setLocalSavedAt(value) { writeItem(SYNC_AT, String(Math.max(0, Number(value) || 0))); }
  function localOwner() { return String(readItem(SYNC_OWNER) || ""); }
  function setLocalOwner(accountId) {
    if (accountId) writeItem(SYNC_OWNER, String(accountId));
    else removeItem(SYNC_OWNER);
  }
  function cacheKey(accountId) { return CACHE_PREFIX + encodeURIComponent(String(accountId)); }
  function readAccountCache(accountId) {
    var blob = parseBlob(readItem(cacheKey(accountId)));
    return blob && String(blob._accountId || "") === String(accountId) ? blob : null;
  }
  function saveAccountCache(accountId, blob) {
    if (!accountId || !blob) return;
    var copy = Object.assign({}, blob, { _accountId: String(accountId) });
    writeItem(cacheKey(accountId), JSON.stringify(copy));
  }
  function saveAnonymousCache(blob) {
    if (!hasContent(blob)) return;
    var copy = Object.assign({}, blob);
    delete copy._accountId;
    writeItem(ANON_CACHE, JSON.stringify(copy));
  }
  function readAnonymousCache() { return parseBlob(readItem(ANON_CACHE)); }
  function saveSyncBase(accountId, blob) {
    if (!accountId || !hasContent(blob)) return;
    writeItem(BASE_PREFIX + encodeURIComponent(String(accountId)), JSON.stringify(Object.assign({}, blob, { _accountId: String(accountId) })));
  }
  function readSyncBase(accountId) {
    var blob = parseBlob(readItem(BASE_PREFIX + encodeURIComponent(String(accountId))));
    return blob && String(blob._accountId || "") === String(accountId) ? blob : null;
  }
  function backupOnce(key, blob) {
    if (!hasContent(blob) || readItem(key)) return;
    writeItem(key, JSON.stringify(blob));
  }
  function backupLegacy(blob) { backupOnce(LEGACY_BACKUP, blob); }
  function backupConflict(accountId, blob) {
    if (!accountId || !hasContent(blob)) return;
    writeItem(CONFLICT_PREFIX + encodeURIComponent(String(accountId)), JSON.stringify(blob));
  }
  function applySyncedKeys(blob) {
    SYNC_KEYS.forEach(function (k) {
      var sk = storageKey(k); if (!sk) return;
      if (typeof blob?.[k] === "string") writeItem(sk, blob[k]);
      else removeItem(sk);
    });
  }
  function applyAccountBlob(blob, accountId) {
    applySyncedKeys(blob || {});
    setLocalOwner(accountId);
    setLocalSavedAt(Number(blob?._savedAt) || 0);
  }
  function applyAnonymousBlob(blob) {
    applySyncedKeys(blob || {});
    setLocalOwner("");
    setLocalSavedAt(0);
  }
  function reloadAfterStorageSwitch() {
    // Applying a server/cache snapshot is not a new local save. Disable all upload
    // paths before requesting navigation because pagehide fires after reload() starts.
    syncReady = false;
    loggedIn = false;
    try { location.reload(); } catch (e) {}
    return true;
  }
  function cacheActiveOwner() {
    var owner = localOwner();
    if (!owner) return;
    saveAccountCache(owner, snapshotLocal(owner, Date.now()));
  }
  function switchToAnonymousIfNeeded() {
    var owner = localOwner();
    if (!owner) return false;
    saveAccountCache(owner, snapshotLocal(owner, Date.now()));
    var anonymous = readAnonymousCache();
    applyAnonymousBlob(anonymous || {});
    return reloadAfterStorageSwitch();
  }
  function activateAccount(accountId, server) {
    accountId = String(accountId || "");
    if (!accountId || String(server?._accountId || "") !== accountId) return { reload: false, ready: false };

    var owner = localOwner();
    var localAt = localSavedAt();
    var local = snapshotLocal(owner, localAt);
    var serverAt = Math.max(0, Number(server?._savedAt) || 0);
    var serverHas = hasContent(server);

    if (owner && owner !== accountId) {
      saveAccountCache(owner, snapshotLocal(owner, Date.now()));
      var cachedForAccount = readAccountCache(accountId);
      var cachedAt = Math.max(0, Number(cachedForAccount?._savedAt) || 0);
      var chosen = cachedForAccount && hasContent(cachedForAccount) && (!serverHas || cachedAt > serverAt)
        ? cachedForAccount
        : (serverHas ? server : { _savedAt: 0, _accountId: accountId });
      applyAccountBlob(chosen, accountId);
      if (hasContent(chosen)) saveAccountCache(accountId, chosen);
      return { reload: reloadAfterStorageSwitch(), ready: true };
    }

    if (owner === accountId) {
      if (serverHas && sameContent(local, server)) {
        var confirmedAt = Math.max(localAt, serverAt);
        setLocalSavedAt(confirmedAt);
        saveAccountCache(accountId, Object.assign({}, server, { _savedAt: confirmedAt, _accountId: accountId }));
        // The online copy is now common to both: the next merge counts from it (31/10/2026).
        saveSyncBase(accountId, server);
        return { reload: false, ready: true };
      }
      if (serverHas && (serverAt > localAt || !hasContent(local))) {
        var incoming = server;
        if (hasContent(local) && !sameContent(local, server)) {
          captureRestorePoint("server");
          backupConflict(accountId, snapshotLocal(accountId, Date.now()));
          // Another device synced meanwhile: keep both. The online copy's choices win, nothing
          // earned here is lost; the merged copy is sent back once the page has reloaded.
          if (typeof mergeSyncBlobs === "function") incoming = Object.assign(mergeSyncBlobs(server, local, readSyncBase(accountId)), { _savedAt: serverAt, _accountId: accountId });
        }
        applyAccountBlob(incoming, accountId);
        saveAccountCache(accountId, incoming);
        // Before 31/10/2026 the common copy only moved when this device sent: every reload then
        // counted the progress shared since an old copy twice, and XP ran away. It moves here too.
        saveSyncBase(accountId, server);
        return { reload: reloadAfterStorageSwitch(), ready: true };
      }
      return { reload: false, ready: true };
    }

    // No owner marker yet: migrate pre-v2 storage conservatively.
    var legacy = snapshotLocal("", localAt);
    var legacyHas = hasContent(legacy);
    var cached = readAccountCache(accountId);
    if (cached && hasContent(cached)) {
      if (legacyHas) {
        if (localAt === 0) saveAnonymousCache(Object.assign({}, legacy, { _savedAt: Date.now() }));
        else backupLegacy(legacy);
      }
      var cachedSavedAt = Math.max(0, Number(cached._savedAt) || 0);
      var selected = serverHas && serverAt >= cachedSavedAt ? server : cached;
      if (sameContent(legacy, selected)) {
        setLocalOwner(accountId);
        setLocalSavedAt(Math.max(serverAt, cachedSavedAt));
        saveAccountCache(accountId, selected);
        return { reload: false, ready: true };
      }
      applyAccountBlob(selected, accountId);
      saveAccountCache(accountId, selected);
      return { reload: reloadAfterStorageSwitch(), ready: true };
    }

    if (serverHas) {
      if (legacyHas && sameContent(legacy, server)) {
        setLocalOwner(accountId);
        setLocalSavedAt(serverAt);
        saveAccountCache(accountId, server);
        return { reload: false, ready: true };
      }
      if (legacyHas && localAt > 0 && serverAt > 0 && localAt === serverAt) {
        // Same previous sync point: local values may simply contain newer, unsent progress.
        setLocalOwner(accountId);
        saveAccountCache(accountId, Object.assign({}, legacy, { _accountId: accountId }));
        return { reload: false, ready: true };
      }
      if (legacyHas) {
        if (localAt === 0) saveAnonymousCache(Object.assign({}, legacy, { _savedAt: Date.now() }));
        else backupLegacy(legacy);
      }
      applyAccountBlob(server, accountId);
      saveAccountCache(accountId, server);
      return { reload: reloadAfterStorageSwitch(), ready: true };
    }

    if (legacyHas && localAt === 0) {
      // First authenticated account on an anonymous browser may safely claim anonymous progress.
      setLocalOwner(accountId);
      setLocalSavedAt(0);
      return { reload: false, ready: true };
    }
    if (legacyHas) {
      // Legacy synced data with no owner is ambiguous: preserve it, never upload it to a new account.
      backupLegacy(legacy);
      applyAccountBlob({ _savedAt: 0, _accountId: accountId }, accountId);
      return { reload: reloadAfterStorageSwitch(), ready: true };
    }

    setLocalOwner(accountId);
    setLocalSavedAt(0);
    return { reload: false, ready: true };
  }
  // Last content known to match the server (received, or sent successfully) in this page.
  // An unchanged profile is never re-sent: an idle tab would otherwise stamp old data with a
  // fresh time every minute and overwrite progress made meanwhile on another device.
  var lastSyncedBlob = null;
  // Version of the online copy this page last saw (received or sent): the server refuses a
  // copy built on an older one, so a device never wipes what another device just synced.
  var serverSavedAt = null;
  function unchangedSinceSync(blob) {
    return Boolean(lastSyncedBlob) && sameContent(blob, lastSyncedBlob);
  }
  function withBase(blob) {
    return serverSavedAt === null ? blob : Object.assign({}, blob, { _baseSavedAt: serverSavedAt });
  }
  // Both devices progressed: merge the online copy into this one (this device's choices win,
  // counters add up from the last common copy), reload the game state, then send again.
  function mergeOnlineCopy(accountId, server) {
    if (typeof mergeSyncBlobs !== "function" || String(server?._accountId || "") !== accountId) return false;
    var local = snapshotLocal(accountId, localSavedAt());
    var merged = mergeSyncBlobs(local, server, lastSyncedBlob);
    captureRestorePoint("server");
    applySyncedKeys(merged);
    serverSavedAt = Math.max(0, Number(server._savedAt) || 0);
    lastSyncedBlob = server;
    saveSyncBase(accountId, server);
    try { if (typeof loadProfile === "function") loadProfile(); } catch (e) {}
    try { if (typeof loadStats === "function") loadStats(); } catch (e) {}
    try { if (typeof loadAchievementsState === "function") loadAchievementsState(); } catch (e) {}
    try { if (typeof updateXpBadge === "function") updateXpBadge(); } catch (e) {}
    try { if (typeof renderStats === "function") renderStats(); } catch (e) {}
    return true;
  }
  function pushSync(retried) {
    var accountId = activeAccountId;
    if (!syncReady || !loggedIn || !accountId || localOwner() !== accountId) return Promise.resolve(false);
    var blob = buildLocalBlob(accountId);
    if (!hasContent(blob) || unchangedSinceSync(blob)) return Promise.resolve(false);
    try {
      return fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(withBase(blob))
      }).then(function (response) {
        return response.json().catch(function () { return null; }).then(function (data) {
          if (response.status === 409 && data?.error === "stale_profile") {
            if (!syncReady || !loggedIn || activeAccountId !== accountId || localOwner() !== accountId) return false;
            if (retried !== true && mergeOnlineCopy(accountId, data.data)) return pushSync(true);
            return false;
          }
          if (!response.ok || !data?.ok) return false;
          if (!syncReady || !loggedIn || activeAccountId !== accountId || localOwner() !== accountId) return false;
          setLocalSavedAt(blob._savedAt);
          saveAccountCache(accountId, blob);
          lastSyncedBlob = blob;
          serverSavedAt = blob._savedAt;
          saveSyncBase(accountId, blob);
          return true;
        });
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  // Restore points: dated copies of this device's progress. One a day, plus one
  // before a reset, before the online copy replaces local progress and before a
  // restore (so a restore can be undone). Only the current owner's copies are offered.
  var RESTORE_POINTS = "pokedle_restore_points_v1";
  var RESTORE_KEYS = SYNC_KEYS.concat(["history"]);
  var RESTORE_LIMIT = 5;
  function parisDayOf(ms) {
    try { return new Date(ms).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" }); }
    catch (e) { return new Date(ms).toISOString().slice(0, 10); }
  }
  function readRestorePoints() {
    try {
      var list = JSON.parse(readItem(RESTORE_POINTS) || "[]");
      return Array.isArray(list) ? list.filter(function (p) { return p && typeof p.id === "string" && p.data && typeof p.data === "object"; }) : [];
    } catch (e) { return []; }
  }
  function writeRestorePoints(list) {
    list = list.slice(0, RESTORE_LIMIT);
    // Storage full: give up the oldest copies rather than the newest one.
    while (list.length) { if (writeItem(RESTORE_POINTS, JSON.stringify(list))) return true; list.pop(); }
    removeItem(RESTORE_POINTS);
    return false;
  }
  function currentRestoreData() {
    var data = {};
    RESTORE_KEYS.forEach(function (k) {
      var sk = storageKey(k); if (!sk) return;
      var value = readItem(sk);
      if (value != null) data[k] = value;
    });
    return data;
  }
  function sameRestoreData(a, b) {
    return RESTORE_KEYS.every(function (k) { return (typeof a?.[k] === "string" ? a[k] : null) === (typeof b?.[k] === "string" ? b[k] : null); });
  }
  function captureRestorePoint(reason) {
    var data = currentRestoreData();
    if (!hasContent(data)) return false;
    var owner = localOwner(), now = Date.now(), list = readRestorePoints();
    var mine = list.filter(function (p) { return String(p.owner || "") === owner; });
    if (mine.length && sameRestoreData(mine[0].data, data)) return false;
    if (reason === "daily" && mine.some(function (p) { return p.reason === "daily" && parisDayOf(p.at) === parisDayOf(now); })) return false;
    list.unshift({ id: now.toString(36) + Math.random().toString(36).slice(2, 6), at: now, reason: String(reason || "daily"), owner: owner, data: data });
    return writeRestorePoints(list);
  }
  function restorePointsForOwner() {
    var owner = localOwner();
    var list = readRestorePoints().filter(function (p) { return String(p.owner || "") === owner; });
    // Copies kept by the older conflict backup are offered too.
    var conflict = owner ? parseBlob(readItem(CONFLICT_PREFIX + encodeURIComponent(owner))) : null;
    if (conflict && hasContent(conflict) && !list.some(function (p) { return sameContent(p.data, conflict); })) {
      list.push({ id: "conflict", at: Math.max(0, Number(conflict._savedAt) || 0), reason: "server", owner: owner, data: conflict });
    }
    return list.sort(function (a, b) { return (Number(b.at) || 0) - (Number(a.at) || 0); });
  }
  function restorePointById(id) {
    var point = restorePointsForOwner().find(function (p) { return p.id === id; });
    if (!point || !hasContent(point.data)) return false;
    captureRestorePoint("before-restore");
    applySyncedKeys(point.data);
    var historyKey = storageKey("history");
    if (historyKey && typeof point.data.history === "string") writeItem(historyKey, point.data.history);
    // For an account, the restored copy is the newest progress: the next load keeps
    // it and uploads it instead of the older online copy. Guests keep no sync stamp,
    // so a first login can still claim their progress.
    if (localOwner()) setLocalSavedAt(Date.now());
    return reloadAfterStorageSwitch();
  }
  function initSync() {
    captureRestorePoint("daily");
    fetch("/api/me", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (me) {
      if (!me || !me.user) {
        syncReady = false;
        loggedIn = false;
        activeAccountId = "";
        switchToAnonymousIfNeeded();
        return;
      }
      activeAccountId = String(me.user.id || "");
      if (!activeAccountId) return;
      syncReady = false;
      loggedIn = true;
      window.__pokedleAuthed = true;
      fetch("/api/profile", { credentials: "same-origin" }).then(function (response) {
        return response.json().catch(function () { return null; }).then(function (resp) {
          if (!response.ok || !resp?.ok || !resp.data) return;
          var server = resp.data;
          if (String(server._accountId || "") !== activeAccountId) return;
          var activation = activateAccount(activeAccountId, server);
          if (!activation.ready || activation.reload) return;
          lastSyncedBlob = server;
          serverSavedAt = Math.max(0, Number(server._savedAt) || 0);
          saveSyncBase(activeAccountId, server);
          syncReady = true;
          pushSync();
        });
      }).catch(function () {});
    }).catch(function () {});
    setInterval(function () { pushSync(); }, 60000);
    window.addEventListener("pagehide", function () {
      if (!syncReady || !loggedIn || !activeAccountId || localOwner() !== activeAccountId) return;
      try {
        var blob = buildLocalBlob(activeAccountId);
        if (!hasContent(blob)) return;
        saveAccountCache(activeAccountId, blob);
        if (unchangedSinceSync(blob)) return;
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/profile", new Blob([JSON.stringify(withBase(blob))], { type: "application/json" }));
        }
      } catch (e) {}
    });
  }
  window.pokedleRestorePoints = { list: restorePointsForOwner, capture: captureRestorePoint, restore: restorePointById };
  window.pokedleSyncNow = pushSync;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSync);
  else initSync();
})();

// Public leaderboards are event-driven. Historical local profile records are deliberately
// not bulk-uploaded: localStorage/playerProfile is user-controlled and is not evidence of
// a completed game. New performances flow through /api/leaderboard/result instead.
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
        return '<div class="lb-row' + (row.me ? " lb-row-me" : "") + '"><span class="lb-rank' + rankCls + '">' + rankTxt + '</span>' + av + '<span class="lb-name">' + escapeHtml(row.username || "Dresseur") + (typeof leaderboardLevelPill === "function" ? leaderboardLevelPill(row) : "") + '</span><b class="lb-score">' + (Number(row.score) || 0) + '</b></div>';
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
  const message = document.getElementById("err-msg");
  message.textContent = msg;
  message.classList.remove("pk-skel-text");
  // A refused name nudges the field, so the player notices it without reading.
  [message, document.querySelector("#screen-game .search-bar")].forEach(node => {
    if (!node) return;
    node.classList.remove("is-nudged");
    void node.offsetWidth;
    node.classList.add("is-nudged");
  });
}

// A waiting message, not a mistake: it shimmers and leaves the field still.
function showLoadingNotice(msg) {
  const message = document.getElementById("err-msg");
  message.textContent = msg;
  message.classList.add("pk-skel-text");
}

function clearErr() {
  const message = document.getElementById("err-msg");
  message.textContent = "";
  message.classList.remove("pk-skel-text");
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

// Plain objects of records keyed by week, generation or opponent; anything else becomes empty.
function profileRecordMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function loadProfile() {
  const parsed = readJson(STORAGE_KEYS.profile, null);
  // Fields this function does not know yet are kept as saved: a reload must never drop progress.
  const saved = profileRecordMap(parsed);
  playerProfile = {
    ...saved,
    nickname: typeof parsed?.nickname === "string" ? parsed.nickname : "",
    favoritePokemonId: parsed?.favoritePokemonId != null && Number.isInteger(Number(parsed.favoritePokemonId)) ? Number(parsed.favoritePokemonId) : null,
    discoveries: normalizeDiscoveries(parsed?.discoveries),
    secrets: normalizeSecretProgress(parsed?.secrets),
    albumMissionClaims: typeof normalizeAlbumMissionClaims === 'function' ? normalizeAlbumMissionClaims(parsed?.albumMissionClaims) : (parsed?.albumMissionClaims || {}),
    albumMissionStats: typeof normalizeAlbumMissionStats === 'function' ? normalizeAlbumMissionStats(parsed?.albumMissionStats) : (parsed?.albumMissionStats || null),
    avatarPhoto: typeof parsed?.avatarPhoto === "string" ? parsed.avatarPhoto : "",
    avatarChoice: ["partner", "photo", "account"].includes(parsed?.avatarChoice) ? parsed.avatarChoice : "",
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
    // Formerly dropped on reload: League weeks and badges, Draft PRO records, current streaks.
    oddOneOutStreak: Number(parsed?.oddOneOutStreak) || 0,
    weightBattleStreak: Number(parsed?.weightBattleStreak) || 0,
    draftScoreProRecords: profileRecordMap(parsed?.draftScoreProRecords),
    draftScoreProHeadToHead: profileRecordMap(parsed?.draftScoreProHeadToHead),
    weeklyLeagueScores: profileRecordMap(parsed?.weeklyLeagueScores),
    weeklyLeagueBadges: profileRecordMap(parsed?.weeklyLeagueBadges),
    weeklyLeagueStats: profileRecordMap(parsed?.weeklyLeagueStats),
  };
  // Tracking login quotidien pour streak
  const today = getDailyQuestKey();
  if (playerProfile.lastDailyLogin !== today) {
    const yesterday = prevUTCDateKey(today);
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
  if (typeof migrateXpLevels === "function") migrateXpLevels();
  if (typeof updateXpBadge === "function") {
    setTimeout(() => updateXpBadge(), 0);
  }
}

function saveProfile() {
  writeJson(STORAGE_KEYS.profile, playerProfile);
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

// The first check of a page load only catches up on old progress: it unlocks quietly.
let achievementsCheckedOnce = false;
function evaluateAchievements() {
  const fresh = [];
  for (const achievement of ACHIEVEMENT_DEFS) {
    const value = achievement.getValue();
    if (value >= achievement.target && !unlockedAchievements[achievement.id]) {
      unlockedAchievements[achievement.id] = { unlockedAt: Date.now() };
      fresh.push(achievement);
    }
  }
  if (fresh.length) saveAchievementsState();
  if (fresh.length && achievementsCheckedOnce && typeof celebrateAchievements === "function") celebrateAchievements(fresh);
  achievementsCheckedOnce = true;
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
    quiestce: "Qui est-ce ?",
    weight: "Duel de poids",
    evolution: "Chaîne d'évolution",
    order: "Ordre Pokédex",
    "stat-clash": "Stat Clash 1v1",
    "stat-auction": "Stat Auction 1v1",
    "higher-lower": "Higher or Lower",
    "higher-lower-rush": "Higher or Lower (60s)",
    "poke-connections": "Poké-Connections",
    speedrun: "Speedrun Pokédex",
    party: "Marathon mini-jeux",
    shiny: "Shiny ou normal",
  };
  return map[mode] || mode || "Mode inconnu";
}

function findPokemonGlobalByName(raw) {
  const q = norm(String(raw || "").trim());
  if (!q) return null;
  return POKEMON_LIST.find((pokemon) => norm(pokemon.name) === q) || null;
}

// The local game log is shared by every account used in this browser. Each game is tagged
// with its account ("owner"), so one account's games never count for another one.
// undefined: account not known yet; null: guest; otherwise the account id.
function matchHistoryOwner() {
  if (typeof window === "undefined" || !window.__pokedleAccountKnown) return undefined;
  return connectedAccountUser?.id ? String(connectedAccountUser.id) : null;
}
function matchHistoryBelongsToCurrent(entry) {
  // Untagged games (guest, older versions, or played before the account loaded) stay shared.
  return !entry?.owner || entry.owner === matchHistoryOwner();
}
function recordMatchHistory(entry) {
  const owner = matchHistoryOwner();
  matchHistory.unshift({
    mode: entry.mode || gameMode || "normal",
    result: entry.result || "win",
    attempts: Number(entry.attempts) || 0,
    targetName: entry.targetName || null,
    ...(entry.mode === "daily" ? {dailyAccountId:entry.dailyAccountId||null} : {}),
    ...(owner ? { owner } : {}),
    at: Date.now(),
  });
  matchHistory = matchHistory.slice(0, 120);
  saveMatchHistory();
  // Browser-declared aggregate only: no account, Pokémon name or result details
  // are sent. The server accepts only known mode/outcome combinations.
  const recorded = matchHistory[0];
  if (typeof trackUsage === "function" && (recorded.result === "win" || recorded.result === "loss")) {
    trackUsage("complete:" + recorded.mode + ":" + recorded.result);
  }
  discoverFromHistory(matchHistory[0]);
  if (typeof progressQuestMode === "function") progressQuestMode(recorded.mode);
  if (typeof renderShellResult === "function") renderShellResult();
}

let profileScoreAttackGeneration = 1;

function renderProfileScoreAttackRecord() {
  const select = document.getElementById("profile-score-attack-gen");
  const wrap = document.getElementById("profile-score-attack-record");
  if (!select || !wrap) return;

  const records = playerProfile?.draftScoreAttackRecords || {};
  const playedGenerations = Array.from({ length: 9 }, (_, i) => i + 1)
    .filter((gen) => (Number(records[gen]) || 0) > 0);

  if (!Number.isInteger(profileScoreAttackGeneration) || profileScoreAttackGeneration < 1 || profileScoreAttackGeneration > 9) {
    profileScoreAttackGeneration = playedGenerations[0] || 1;
  }
  if (!playedGenerations.includes(profileScoreAttackGeneration) && playedGenerations.length && !select.dataset.userPicked) {
    profileScoreAttackGeneration = playedGenerations[0];
  }

  select.value = String(profileScoreAttackGeneration);
  const score = Number(records[profileScoreAttackGeneration]) || 0;
  const bestScore = Math.max(0, ...Array.from({ length: 9 }, (_, i) => Number(records[i + 1]) || 0));
  const bestGeneration = bestScore > 0
    ? Array.from({ length: 9 }, (_, i) => i + 1).find((gen) => (Number(records[gen]) || 0) === bestScore)
    : null;
  const isBest = score > 0 && score === bestScore;

  wrap.innerHTML = `
    <article class="profile-score-attack-card${isBest ? " is-best" : ""}">
      <div><span>Gen ${profileScoreAttackGeneration}</span><small>${score > 0 ? "Record personnel" : "Pas encore joué"}</small></div>
      <strong>${score > 0 ? score : "—"}</strong>
      <span class="profile-score-attack-unit">BST moyen</span>
      ${isBest ? '<b class="profile-score-attack-best">Meilleur record</b>' : (bestGeneration ? `<small class="profile-score-attack-best-note">Meilleur : Gen ${bestGeneration} · ${bestScore}</small>` : "")}
    </article>`;
}

window.profileScoreAttackGenerationFromEl = function () {
  const next = Number(this.value);
  if (Number.isInteger(next) && next >= 1 && next <= 9) profileScoreAttackGeneration = next;
  this.dataset.userPicked = "1";
  renderProfileScoreAttackRecord();
};

function initProfileDisclosureState() {
  document.querySelectorAll("#screen-profile [data-profile-mobile-collapse]").forEach((details) => {
    if (details.dataset.profileDisclosureReady) return;
    details.open = window.innerWidth > 640;
    details.dataset.profileDisclosureReady = "1";
  });
}

// Profile (25/10, proposal A): one trainer card at the top, four adventure figures under it.
function profileDaysLabel(value) {
  const days = Number(value) || 0;
  return `${formatNumberFr(days)} jour${days > 1 ? "s" : ""}`;
}

function profileLevelRingHtml(prog, size) {
  const radius = size / 2 - 11;
  const length = 2 * Math.PI * radius;
  const filled = Math.round((length * Math.max(0, Math.min(100, prog.percent))) / 100);
  return `<div class="profile-ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Niveau ${prog.tier.level}, ${prog.percent} % vers le niveau suivant">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" class="profile-ring-track" stroke-width="12"></circle>
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" class="profile-ring-fill" stroke-width="12" stroke-linecap="round" stroke-dasharray="${filled} ${Math.ceil(length)}" transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
    </svg>
    <span><b>${prog.tier.level}</b><small>NIVEAU</small></span>
  </div>`;
}

function renderProfileHero(prog, xp) {
  const hero = document.getElementById("profile-trainer-card");
  if (!hero) return;
  hero.className = "profile-hero";
  const fav = playerProfile.favoritePokemonId ? POKEMON_BY_ID.get(playerProfile.favoritePokemonId) : null;
  const avatars = profileAvatarOptions();
  const shown = profileAvatarChoice() || ["photo", "partner", "account"].find((key) => avatars[key]) || "";
  const photo = shown === "photo" ? avatars.photo : "";
  const pseudo = playerProfile.nickname && playerProfile.nickname.trim() ? escapeHtml(playerProfile.nickname.trim()) : "Dresseur";
  // The week's prize (31/10/2026): last week's champion shows a shiny partner, medals sit with the titles.
  const awards = typeof window !== "undefined" ? window.__pokedleWeeklyAwards : null;
  const shiny = Boolean(awards?.champion);
  const medalCount = [1, 2, 3].map((rank) => (awards?.medals || []).filter((m) => m.rank === rank).length);
  const medals = medalCount.some(Boolean)
    ? `<span class="profile-hero-medals" title="Médailles du podium de la semaine">${["🥇", "🥈", "🥉"].map((icon, i) => medalCount[i] ? `${icon} ×${medalCount[i]}` : "").filter(Boolean).join(" · ")}</span>`
    : "";
  const art = shown === "photo"
    ? `<img class="is-photo" src="${photo}" alt="Photo de profil" />`
    : shown === "account"
      ? `<img class="is-photo" src="${escapeHtml(avatars.account)}" alt="Image du compte" />`
      : fav
        ? `<img src="${pokedexDetailArtwork(fav, shiny)}" alt="${escapeHtml(fav.name)}${shiny ? " shiny" : ""}" loading="lazy" data-fallback="${shiny ? getPokemonShinySprite(fav) : getPokemonSprite(fav)}" />`
        : `<span class="profile-hero-empty" aria-hidden="true">?</span>`;
  const streak = Number(playerStats.dailyCurrentStreak) || 0;
  const quests = Number(playerProfile.totalQuestsCompleted) || 0;
  const line = [
    streak ? `Pokédle du jour : ${profileDaysLabel(streak)} d’affilée` : "",
    quests ? `${formatNumberFr(quests)} quête${quests > 1 ? "s" : ""} réussie${quests > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(" · ");
  const titleHint = prog.nextTitle ? `<span>Prochain titre : ${escapeHtml(prog.nextTitle.name)} au niveau ${prog.nextTitle.level}</span>` : "";
  const next = prog.next
    ? `<strong>${formatNumberFr(prog.next.minXp - xp)} XP avant le niveau ${prog.next.level}</strong>${titleHint}`
    : `<strong>Niveau maximum</strong><span>${formatNumberFr(prog.xpToNext - prog.xpInTier)} XP avant la prochaine étoile</span>`;
  hero.innerHTML = `
    <div class="profile-hero-art">
      <div class="profile-hero-circle"${fav && shown === "partner" ? ` data-type="${typeSlug(fav.type1)}"` : ""}>${art}</div>
      ${fav ? `<span class="profile-hero-partner">Partenaire · ${escapeHtml(fav.name)}${shiny ? " ✨ shiny, champion de la semaine" : ""}</span>` : `<button type="button" class="profile-hero-partner" data-action="openProfileEditor">Choisir mon partenaire</button>`}
    </div>
    <div class="profile-hero-main">
      <span class="profile-hero-eyebrow">Carte de Dresseur</span>
      <h3 class="profile-hero-name">${pseudo}</h3>
      <div class="profile-hero-chips">
        <span class="profile-hero-title">${prog.tier.emoji} ${escapeHtml(prog.tier.name)}</span>
        ${playerProfile.pioneerMyth ? '<span class="profile-hero-pioneer" title="A atteint « Mythe Pokémon » avant le passage à 100 niveaux">✦ Pionnier · ancien Mythe Pokémon</span>' : ""}
        ${medals}
      </div>
      ${line ? `<p class="profile-hero-line">${line}</p>` : ""}
      ${typeof profileShinyHtml === "function" ? profileShinyHtml() : ""}
      <div class="profile-hero-actions">
        <button type="button" class="btn-blue" data-action="shareLevelBadge">Partager ma carte</button>
        <button type="button" class="btn-ghost" data-action="openProfileEditor">Modifier mon profil</button>
        <button type="button" class="profile-hero-photo" data-action="triggerProfilePhoto">${avatars.photo ? "Changer ma photo" : "Ajouter ma photo"}</button>
        ${avatars.photo ? '<button type="button" class="profile-hero-photo" data-action="removeProfilePhoto">Retirer la photo</button>' : ""}
      </div>
    </div>
    <div class="profile-hero-level">
      ${profileLevelRingHtml(prog, 156)}
      <div class="profile-hero-level-text">
        ${next}
        <small>${formatNumberFr(xp)} XP au total</small>
      </div>
    </div>`;
}

function renderProfileKeyFigures() {
  const box = document.getElementById("profile-key-figures");
  if (!box) return;
  const dex = typeof pokedexCollectionNationalStats === "function"
    ? pokedexCollectionNationalStats()
    : { found: Object.keys(playerProfile.discoveries || {}).length, total: 1025 };
  const missionsTotal = typeof ALBUM_MISSIONS !== "undefined" ? ALBUM_MISSIONS.length : 108;
  const missions = Object.keys(playerProfile.albumMissionClaims || {}).length;
  const secretsTotal = typeof SECRET_MISSIONS !== "undefined" ? SECRET_MISSIONS.length : 12;
  const secrets = Object.keys(playerProfile.secrets?.claimed || {}).length;
  const achievements = ACHIEVEMENT_DEFS.filter((a) => unlockedAchievements[a.id]).length;
  const figure = (label, value, total, action, args = "") => {
    const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
    return `<button type="button" class="profile-figure${total && value >= total ? " is-complete" : ""}" data-action="${action}"${args ? ` data-args='${args}'` : ""}>
      <span>${label}</span>
      <b>${formatNumberFr(value)} <small>/ ${formatNumberFr(total)}</small></b>
      <i aria-hidden="true"><em style="width:${percent}%"></em></i>
    </button>`;
  };
  box.innerHTML = figure("Pokédex", dex.found, dex.total, "openPokedexCollection")
    + figure("Missions", missions, missionsTotal, "switchProfileView", '["album"]')
    + figure("Secrets", secrets, secretsTotal, "switchProfileView", '["secrets"]')
    + figure("Succès", achievements, ACHIEVEMENT_DEFS.length, "openAchievementsScreen");
}

// « Modifier mon profil »: opens the pseudo and partner panel and puts the cursor in it.
function openProfileEditor() {
  if (typeof switchProfileView === "function") switchProfileView("trainer");
  const panel = document.getElementById("profile-identity");
  if (!panel) return;
  panel.open = true;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => document.getElementById("profile-nickname")?.focus({ preventScroll: true }), 350);
}
window.openProfileEditor = openProfileEditor;

function renderProfileScreen() {
  evaluateAchievements();
  const nicknameInput = document.getElementById("profile-nickname");
  const favoriteInput = document.getElementById("profile-favorite-input");
  const datalist = document.getElementById("profile-favorite-options");
  const saveMsg = document.getElementById("profile-save-msg");
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

  // DA 2026 : un seul système de niveau partout (XP réel + getXpProgress, comme le header).
  const profileXp = Number(playerProfile.xp || 0);
  const profileProg = getXpProgress(profileXp);
  const played = Number(playerStats.played) || 0;
  const wins = Number(playerStats.wins) || 0;
  const winRate = document.getElementById("profile-win-rate");
  const questsTotal = document.getElementById("profile-quests-total");
  if (levelName) levelName.textContent = `Niv. ${profileProg.tier.level} · ${profileProg.tier.name}`;
  if (levelXp) levelXp.textContent = `XP : ${formatNumberFr(profileXp)}`;
  if (levelBar) levelBar.style.width = `${profileProg.percent}%`;
  if (totalGames) totalGames.textContent = formatNumberFr(played);
  if (totalWins) totalWins.textContent = formatNumberFr(wins);
  if (winRate) winRate.textContent = played ? `${Math.round((wins / played) * 100)} %` : "—";
  if (currentStreak) currentStreak.textContent = profileDaysLabel(playerStats.dailyCurrentStreak);
  if (bestStreak) bestStreak.textContent = profileDaysLabel(playerStats.dailyBestStreak);
  if (questsTotal) questsTotal.textContent = formatNumberFr(playerProfile.totalQuestsCompleted);

  renderPartner();
  renderDiscoveryAlbum();
  renderSecretMissions();
  renderProfileHero(profileProg, profileXp);
  renderProfileAvatarChoices();
  renderProfileKeyFigures();

  if (achSummary) {
    const unlockedCount = ACHIEVEMENT_DEFS.filter((a) => unlockedAchievements[a.id]).length;
    // One medal per achievement: gold when unlocked; the title shows on hover.
    achSummary.innerHTML = `<div class="profile-medals">${ACHIEVEMENT_DEFS.map((a) => `<span class="profile-medal${unlockedAchievements[a.id] ? " is-on" : ""}" title="${escapeHtml(a.title)}${unlockedAchievements[a.id] ? "" : " (à débloquer)"}"></span>`).join("")}</div>`;
    const achLabel = document.getElementById("profile-achievements-summary-label");
    if (achLabel) achLabel.textContent = `${unlockedCount}/${ACHIEVEMENT_DEFS.length} débloqués`;
  }

  if (recentWrap) {
    const recent = ACHIEVEMENT_DEFS
      .filter((a) => unlockedAchievements[a.id])
      .sort((a, b) => (unlockedAchievements[b.id]?.unlockedAt || 0) - (unlockedAchievements[a.id]?.unlockedAt || 0))
      .slice(0, 3);
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
      records.push({ icon: "🎲", label: "Marathon mini-jeux", value: `${party} victoires en une session`, color: "gold" });
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
    const saRecords = playerProfile.draftScoreAttackRecords || {};
    const scoreAttackCount = Array.from({ length: 9 }, (_, i) => Number(saRecords[i + 1]) || 0).filter((value) => value > 0).length;
    if (records.length) {
      modeRecordsWrap.innerHTML = records.map((r) => `<div class="profile-record-card is-${r.color}"><span class="profile-record-icon">${r.icon}</span><div><b>${escapeHtml(r.label)}</b><span>${escapeHtml(r.value)}</span></div></div>`).join("");
    } else {
      modeRecordsWrap.innerHTML = '<p class="card-desc">Pas encore de record hors Score Attack. Joue à Higher or Lower, Speedrun, Quiz, Intrus, Duel de poids ou Marathon mini-jeux.</p>';
    }
    const recordsSummary = document.getElementById("profile-records-summary");
    const recordCount = records.length + scoreAttackCount;
    if (recordsSummary) recordsSummary.textContent = recordCount
      ? `${recordCount} record${recordCount > 1 ? "s" : ""} · Score Attack par génération`
      : "Tes meilleurs scores";
    renderProfileScoreAttackRecord();
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
    const h2hSummary = document.getElementById("profile-h2h-summary");
    const duelCount = opponents.reduce((sum, opp) => sum + opp.wins + opp.losses + opp.draws, 0);
    if (h2hSummary) h2hSummary.textContent = duelCount
      ? `${duelCount} duel${duelCount > 1 ? "s" : ""} contre ${opponents.length} adversaire${opponents.length > 1 ? "s" : ""}`
      : "Tes duels Score Attack";
  }

  initProfileDisclosureState();
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
        <div class="achievement-cat-head"><h3>${CAT_ICONS[cat] || "🏅"} ${escapeHtml(cat)}</h3><span class="achievement-cat-count">${unlockedN}/${defs.length}</span></div>
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
function setScreenVisibility(element, visible) {
  if (!element) return false;
  if (visible) {
    element.classList.remove('hidden');
    element.removeAttribute('aria-hidden');
    // A previous hide uses an inline !important so no stylesheet can keep a screen hidden.
    element.style.removeProperty('display');
  } else {
    element.classList.add('hidden');
    element.setAttribute('aria-hidden', 'true');
    // Screen visibility is a navigation invariant, not a theme concern. Inline !important
    // prevents later visual layers from accidentally overriding the hidden state.
    element.style.setProperty('display', 'none', 'important');
  }
  return true;
}

function hideScreen(id) {
  return setScreenVisibility(document.getElementById(id), false);
}

function toggleMultiplayerGenerations() {
  const panel = document.getElementById('multiplayer-gen-panel');
  const button = document.getElementById('multiplayer-gen-toggle');
  if (!panel || !button) return;
  const collapsed = panel.classList.toggle('is-collapsed');
  button.setAttribute('aria-expanded', String(!collapsed));
  button.textContent = collapsed ? 'Modifier ▾' : 'Fermer ▴';
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
    setScreenVisibility(el, false);
  });
}

function showScreen(id) {
  // The Draft's phone bar belongs to its screen only.
  if (id !== "screen-draft-score-attack") document.getElementById("draft-mobile-bar")?.remove();
  const target = document.getElementById(id);
  // Never blank the app because of a stale or mistyped navigation target.
  if (!target) {
    try { console.warn("Unknown Pokédle screen:", id); } catch (_e) {}
    return false;
  }
  if (id !== "screen-multiplayer") hideMultiplayerWinOverlay();
  hideAllScreens();
  setScreenVisibility(target, true);
  // Lets styles know which screen is shown (the news ticker stays off during games).
  if (document.body) document.body.dataset.screen = id;
  if (id === "screen-game" && typeof renderGameShell === "function") renderGameShell();
  // The « Consulte le Pokédex » quest, whatever way the Pokédex was opened.
  if (id === "screen-pokedex" && typeof progressQuest === "function") progressQuest("pokedex_browse", 1);
  if (typeof prepareDedicatedShell === "function") prepareDedicatedShell(id);
  window.scrollTo(0, 0);
  return true;
}

function hideExtraScreens() {
  ['screen-profile','screen-achievements','screen-history','screen-odd-one-out','screen-shiny','screen-qui-est-ce','screen-petit-bac','screen-multiplayer','screen-games-ranking','screen-type-chart','screen-team-builder','screen-teams','screen-stat-clash','screen-higher-lower','screen-poke-connections','screen-stat-auction','screen-draft-score-attack','screen-speedrun'].forEach(hideScreen);
}

let overlayReturnFocus = null;
function ensureOverlay(title, html) {
  const overlay = document.getElementById('overlay-modal');
  const titleEl = document.getElementById('overlay-title');
  const bodyEl = document.getElementById('overlay-body');
  if (!overlay || !titleEl || !bodyEl) {
    showToast(title);
    return;
  }
  if (overlay.classList.contains('hidden')) overlayReturnFocus = document.activeElement;
  // Escape main's stacking/containing context so the dialog covers footer and navigation.
  if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
  titleEl.textContent = title;
  bodyEl.innerHTML = html;
  const overlayKind = /param/i.test(title) ? 'settings'
    : /comment jouer|aide/i.test(title) ? 'help'
    : /compte/i.test(title) ? 'account'
    : /classement/i.test(title) ? 'ranking'
    : /quitter|supprimer|confirmer/i.test(title) ? 'confirm'
    : 'default';
  overlay.dataset.kind = overlayKind;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  overlay.querySelector('.overlay-close')?.focus({ preventScroll: true });
}

function closeOverlayModal() {
  const overlay = document.getElementById('overlay-modal');
  const wasOpen = overlay && !overlay.classList.contains('hidden');
  overlay?.classList.add('hidden');
  overlay?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (wasOpen && overlayReturnFocus?.isConnected) overlayReturnFocus.focus({ preventScroll: true });
  overlayReturnFocus = null;
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
  soundEffects: true,
  pokemonCries: true,
  soundVolume: 100,
  seasonalDecorations: true,
};

// The master volume (31/10/2026): from 10 to 100 %, for the sound effects and the cries alike.
// Turning a sound off stays the job of its own switch.
function appSoundVolume(settings = getStoredAppSettings()) {
  const value = Number(settings && settings.soundVolume);
  return Number.isFinite(value) ? Math.min(1, Math.max(0.1, Math.round(value) / 100)) : 1;
}
function appVolumeLabel(value) {
  return Math.round(appSoundVolume({ soundVolume: value }) * 100) + ' %';
}
// While the slider moves, only its label changes; the setting is saved when it is let go.
window.appVolumePreview = function () {
  const output = document.getElementById('app-volume-value');
  if (output) output.textContent = appVolumeLabel(this.value);
};
window.appVolumeFromEl = function () {
  updateAppSetting('soundVolume', Math.round(appSoundVolume({ soundVolume: this.value }) * 100));
  window.appVolumePreview.call(this);
  testAppSound();
};
function testAppSound() {
  const settings = getStoredAppSettings();
  if (settings.soundEffects !== false && typeof playPokedexUiSfx === 'function') { playPokedexUiSfx('correct'); return; }
  const pikachu = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(25) : null;
  if (settings.pokemonCries !== false && pikachu && typeof playPokemonCry === 'function') { playPokemonCry(pikachu, 0.55); return; }
  if (typeof showToast === 'function') showToast('Les effets sonores et les cris sont coupés.');
}
window.testAppSound = testAppSound;

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
  document.body.classList.toggle("seasonal-disabled", settings.seasonalDecorations === false);
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
            <p>Le Pokémon à deviner est <b>le même pour tous les joueurs</b>, et change à minuit, heure de Paris. Tu peux tenter autant d'essais que tu veux dans la journée.</p>
          </section>
          <section class="app-help-card">
            <h4>Indices après chaque essai</h4>
            <p>Chaque ligne compare la <b>génération</b>, la <b>forme</b>, les <b>types</b>, l’<b>habitat</b>, la <b>couleur</b>, le <b>stade</b>, la <b>taille</b> et le <b>poids</b>. <b>✓ Exact / ≈ Partiel ou proche / × Différent.</b> L’orange indique notamment un type à l’autre place, une couleur partiellement commune, une taille à 0,3 m près ou un poids à 15 kg près. ↑ signifie que le Pokémon recherché est plus grand ou plus lourd ; ↓ signifie plus petit ou plus léger.</p>
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
            <p>Devine un Pokémon mystère tiré <b>aléatoirement</b> dans les générations choisies avec le bouton Générations. Tu peux relancer autant que tu veux.</p>
          </section>
          <section class="app-help-card">
            <h4>Indices après chaque essai</h4>
            <p>Génération, forme, types, habitat, couleur, stade, taille, poids — chaque colonne te dit si c'est correct (✓), proche (≈) ou différent (×). Les flèches ▲/▼ pointent vers la vraie valeur.</p>
          </section>
          <section class="app-help-card">
            <h4>Formes alternatives incluses</h4>
            <p>Le Pokémon mystère peut être une forme régionale, une Méga ou une autre forme (masques d’Ogerpon, styles de Plumeline…) des générations choisies : la colonne <b>Forme</b> te dit s'il s'agit d'une forme alternative.</p>
          </section>
        `,
      };
    case 'silhouette':
      return {
        title: 'Zoom progressif',
        body: `
          <section class="app-help-card">
            <h4>Zoom progressif</h4>
            <p>Le sprite est extrêmement <b>zoomé au départ</b>, sur un détail pris au hasard (une oreille, une queue, une patte), et se dézoome à chaque essai. Les <b>trois premiers indices sont en noir et blanc</b>, puis les couleurs reviennent. Tu joues sur les générations choisies avec le bouton Générations.</p>
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
            <p>L'image est <b>très floue</b> au départ. Le flou diminue à chaque essai pour rendre l'image de plus en plus lisible.</p>
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
            <p>Les types et les <b>six statistiques de base</b> du Pokémon mystère (PV, Attaque, Défense, Attaque Spé., Défense Spé., Vitesse) et leur total s’affichent dès le départ. Propose les Pokémon qui y correspondent.</p>
          </section>
          <section class="app-help-card">
            <h4>Indices classiques en plus</h4>
            <p>Les indices habituels (gen, types, habitat…) restent dispos pour t'aider.</p>
          </section>
          <section class="app-help-card">
            <h4>Coup de pouce</h4>
            <p>Après 5 essais, la <b>première lettre</b> du nom s’affiche.</p>
          </section>
        `,
      };
    case 'quiz':
      return {
        title: 'Quiz Pokémon',
        body: `
          <section class="app-help-card">
            <h4>Questions à choix multiples</h4>
            <p>15 questions en solo, 5 par manche en Party Room. Choisis la bonne réponse parmi les 4 propositions. L’objectif de Ligue est de réussir au moins 12 réponses sur 15.</p>
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
        <p>Touche <b>Générations</b> sur l’accueil, dans le catalogue ou dans un mode compatible. Choisis tes régions, puis valide. En cours de jeu, <b>Appliquer et jouer</b> lance une nouvelle partie. Au moins une génération reste sélectionnée.</p>
      </section>
      <section class="app-help-card">
        <h4>Pokémon du jour</h4>
        <p>Touche <b>Jouer au Pokémon du jour</b> pour trouver la même cible que les autres joueurs. Elle change chaque jour et ne dépend pas des générations cochées. Une partie commencée peut être reprise.</p>
      </section>
      <section class="app-help-card">
        <h4>Retrouver les jeux</h4>
        <p>Sur mobile, utilise <b>Jouer</b> dans la barre du bas ou <b>Tous les modes</b> sur l'accueil. Les cartes de l'accueil donnent aussi accès à Party Room, au Draft et aux outils Pokémon.</p>
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
        <p>16 Pokémon en grille. Trouve les 4 groupes de 4 selon un type, une génération ou une couleur en commun. Chaque thème correspond à exactement 4 Pokémon de la grille : aucun groupe valable n'est refusé au profit d'une répartition cachée. 4 erreurs max.</p>
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
        <p>Pokémon du jour propose une cible quotidienne. Le Mode illimité relance une partie libre. Le Marathon mini-jeux enchaîne plusieurs défis.</p>
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
    <p class="app-help-tip">Astuce : le bouton "Générations" permet de choisir les régions de tes prochaines parties dans les modes compatibles.</p>
  `);
}

function openSettingsModal() {
  const settings = getStoredAppSettings();
  ensureOverlay('Paramètres', `
    <div class="app-settings-grid app-settings-grid-rich">
      <section class="app-settings-section">
        <h4>Affichage</h4>
        <label class="app-setting-item">
          <span><b>Décorations de saison</b><small>Une touche d’Halloween en octobre. Se désactive après la fête.</small></span>
          <input type="checkbox" ${settings.seasonalDecorations !== false ? "checked" : ""} data-change-action="appSettingFromEl" data-setting="seasonalDecorations" data-bool="1" />
        </label>
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
        <h4>Son & accessibilité</h4>
        <label class="app-setting-item">
          <span><b>Effets sonores</b><small>Feedbacks Pokédex et actions importantes.</small></span>
          <input type="checkbox" ${settings.soundEffects !== false ? "checked" : ""} data-change-action="appSettingFromEl" data-setting="soundEffects" data-bool="1" />
        </label>
        <label class="app-setting-item">
          <span><b>Cris des Pokémon</b><small>Joue le cri lors des révélations et rencontres.</small></span>
          <input type="checkbox" ${settings.pokemonCries !== false ? "checked" : ""} data-change-action="appSettingFromEl" data-setting="pokemonCries" data-bool="1" />
        </label>
        <div class="app-setting-item app-setting-item-stack app-setting-volume">
          <span><b>Volume</b><small>Pour les effets et les cris. Le mode Cri suit aussi ce volume.</small></span>
          <div class="app-volume-row">
            <input id="app-volume" type="range" min="10" max="100" step="10" value="${Math.round(appSoundVolume(settings) * 100)}" aria-label="Volume des sons" aria-describedby="app-volume-value" data-input-action="appVolumePreview" data-change-action="appVolumeFromEl" />
            <output id="app-volume-value" for="app-volume">${appVolumeLabel(settings.soundVolume)}</output>
            <button class="btn-ghost" type="button" data-action="testAppSound">▶ Tester</button>
          </div>
        </div>
        <label class="app-setting-item">
          <span><b>Contraste renforcé</b><small>Renforce les bordures et certains contrastes.</small></span>
          <input type="checkbox" ${settings.highContrast ? "checked" : ""} data-change-action="appSettingFromEl" data-setting="highContrast" data-bool="1" />
        </label>
        <label class="app-setting-item">
          <span><b>Réduire les animations</b><small>Limite les transitions et animations décoratives.</small></span>
          <input type="checkbox" ${settings.reduceMotion ? "checked" : ""} data-change-action="appSettingFromEl" data-setting="reduceMotion" data-bool="1" />
        </label>
      </section>
      <section class="app-settings-section">
        <h4>Appli & notifications</h4>
        <div class="app-setting-item app-setting-item-stack">
          <span><b>📲 Pokédle en appli</b><small>Une icône sur ton écran d’accueil, en plein écran. Sur iPhone, c’est ce qui permet les notifications.</small></span>
          <button class="btn-ghost" type="button" data-action="openInstallApp">Comment l’installer</button>
        </div>
        <div class="app-setting-item app-setting-item-stack">
          <span><b>🔔 Notifications</b><small>Défis reçus ou relevés, et un rappel du Pokémon du jour à l’heure de ton choix.</small></span>
          <button class="btn-ghost" type="button" data-action="openNotifSetup">${typeof notifIsOn === 'function' && notifIsOn() ? 'Changer l’heure ou arrêter' : 'Activer'}</button>
        </div>
      </section>
      <button class="btn-ghost app-settings-reset" type="button" data-action="resetAppSettings">Réinitialiser les paramètres</button>
    </div>
  `);
}

function confirmResetProgression() {
  ensureOverlay('Recommencer à zéro', '<p class="card-desc">Cette action efface ton profil, ta progression, tes statistiques, tes succès, tes équipes et ton historique sur cet appareil. Une copie est gardée : tu pourras la retrouver dans « Restaurer une copie ».</p><div class="reset-confirm-actions"><button class="btn-ghost" type="button" data-action="closeResetOverlay">Annuler</button><button class="btn-red" type="button" data-action="doResetProfile">🗑️ Tout effacer</button></div>');
}
function closeResetOverlay() {
  const overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.classList.add('hidden');
  document.body.classList.remove('modal-open');
}
function doResetProfile() {
  try { window.pokedleRestorePoints?.capture('reset'); } catch (e) {}
  try {
    Object.keys(STORAGE_KEYS).forEach((k) => { try { localStorage.removeItem(STORAGE_KEYS[k]); } catch (e) {} });
  } catch (e) {}
  try { location.reload(); } catch (e) {}
}

const RESTORE_POINT_REASONS = {
  daily: 'Copie du jour',
  reset: 'Avant une réinitialisation',
  server: 'Remplacée par ta sauvegarde en ligne',
  'before-restore': 'Avant une restauration'
};
function restorePointDate(at) {
  try {
    const text = new Date(Number(at) || 0).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch (e) { return ''; }
}
function restorePointSummary(data) {
  const read = (raw) => { try { return JSON.parse(raw || 'null') || {}; } catch (e) { return {}; } };
  const profile = read(data?.profile), stats = read(data?.stats);
  const seen = profile.discoveries && typeof profile.discoveries === 'object' ? Object.keys(profile.discoveries).length : 0;
  const number = (n) => Math.max(0, Math.round(Number(n) || 0)).toLocaleString('fr-FR');
  return [seen + ' Pokémon découvert' + (seen > 1 ? 's' : ''), number(profile.xp) + ' XP', number(stats.wins) + ' victoire' + ((Number(stats.wins) || 0) > 1 ? 's' : '')].join(' · ');
}
function openRestoreProgress() {
  const points = window.pokedleRestorePoints ? window.pokedleRestorePoints.list() : [];
  if (!points.length) {
    ensureOverlay('Restaurer une copie', '<p class="card-desc">Aucune copie pour l’instant. Pokédle en garde une par jour sur cet appareil, et une avant chaque réinitialisation.</p>');
    return;
  }
  const rows = points.map(p => '<li class="restore-point"><div><b>' + escapeHtml(restorePointDate(p.at)) + '</b><span>' + escapeHtml(RESTORE_POINT_REASONS[p.reason] || 'Copie') + '</span><small>' + escapeHtml(restorePointSummary(p.data)) + '</small></div>' +
    '<button class="btn-ghost" type="button" data-action="confirmRestoreProgress" data-args=\'' + escapeHtml(JSON.stringify([p.id])) + '\'>Restaurer</button></li>').join('');
  ensureOverlay('Restaurer une copie', '<p class="card-desc">Pokédle garde sur cet appareil une copie par jour de ta progression, et une avant chaque réinitialisation. Ta progression actuelle sera gardée elle aussi.</p><ol class="restore-points">' + rows + '</ol>');
}
function confirmRestoreProgress(id) {
  const point = (window.pokedleRestorePoints ? window.pokedleRestorePoints.list() : []).find(p => p.id === id);
  if (!point) return openRestoreProgress();
  ensureOverlay('Restaurer cette copie ?', '<p class="card-desc">Ta progression va revenir à celle du <b>' + escapeHtml(restorePointDate(point.at).toLowerCase()) + '</b> (' + escapeHtml(restorePointSummary(point.data)) + '). Ta progression actuelle reste dans la liste : tu pourras y revenir.</p>' +
    '<div class="reset-confirm-actions"><button class="btn-ghost" type="button" data-action="openRestoreProgress">Retour</button><button class="btn-blue" type="button" data-action="doRestoreProgress" data-args=\'' + escapeHtml(JSON.stringify([point.id])) + '\'>Restaurer</button></div>');
}
function doRestoreProgress(id) {
  if (!window.pokedleRestorePoints || !window.pokedleRestorePoints.restore(id)) showToast('Cette copie n’est plus disponible.');
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
  setGlobalNavActive('profile');
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
  // Gen 9 can be typed, but the mystery never comes from it: say so rather than let players search there.
  document.getElementById("description-gen-note")?.classList.toggle("hidden", !(selectedGens instanceof Set && [...selectedGens].some((gen) => Number(gen) > 8)));
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
  setGameCounter(Number(playerProfile?.weightBattleStreak) || 0, "Série");
  const status = document.getElementById("weight-status");
  const grid = document.getElementById("weight-grid");
  // The last Party round remains a Party round after completion. Do not let its
  // finished state reveal the solo replay or catalog actions.
  const isPartyWeightRound = Boolean(partySession?.currentModeKey === "weight");
  const showSoloResult = weightBattleState.revealed && !isPartyWeightRound;
  document.getElementById("weight-result-actions")?.classList.toggle("hidden", !showSoloResult);
  document.getElementById("weight-restart")?.classList.toggle("hidden", !showSoloResult);
  if (status) {
    status.textContent = !weightBattleState.revealed
      ? "Quel Pokémon est le plus lourd ?"
      : weightBattleState.selectedId === secretPokemon?.id
        ? `Bien vu : ${secretPokemon.name} est le plus lourd avec ${secretPokemon.weight} kg.`
        : `${secretPokemon?.name || "Le bon Pokémon"} était le plus lourd avec ${secretPokemon?.weight || "?"} kg.`;
  }
  const detail = document.getElementById("weight-result-detail");
  if (detail) detail.textContent = showSoloResult ? (status?.textContent || "") : "";
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
      if (typeof gameFeelAnswer === "function") {
        const selectedCard = Array.from(document.querySelectorAll("#weight-grid .versus-card")).find(card => card.textContent.includes(pokemon.name)) || document.getElementById("weight-grid");
        gameFeelAnswer(didWin, selectedCard, didWin ? "✓" : "×");
      }
      // Standalone (hors party) : XP léger + historique + record streak
      if (!isPartySessionActive()) {
        try {
          recordMatchHistory({ mode: "weight", result: didWin ? "win" : "loss", attempts: 1, targetName: secretPokemon?.name || null });
        } catch (_e) {}
        if (didWin) {
          awardXp(10, "Duel de poids", "weight");
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
      if (!isPartyWeightRound) {
        // Keep the explanation and replay controls in the same viewport on
        // iPhone/Android and keep keyboard focus off the now-disabled card.
        const result = document.getElementById("weight-result-actions");
        result?.focus({ preventScroll: true });
        result?.scrollIntoView({
          behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
          block: "center",
        });
      }
    });
    grid.appendChild(btn);
  });
  if (partySession) renderPartySessionUI();
}

function replayWeightBattle() {
  // A completed Party round cannot be replayed through the solo CTA.
  if (!weightBattleState?.revealed || partySession?.currentModeKey === "weight") return;
  startWeightBattle();
  const status = document.getElementById("weight-status");
  status?.focus({ preventScroll: true });
  status?.scrollIntoView({
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
    block: "center",
  });
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

// Six visible cards must have ONE defensible outsider. When a category is
// disclosed (easy/medium), uniqueness is checked inside that category. On
// hard, the category is hidden, so uniqueness is checked across ALL categories.
function oddRuleValues(pokemon, category) {
  if (!pokemon) return [];
  if (category === "type") return [...new Set([pokemon.type1, pokemon.type2].filter(Boolean).map(String))];
  if (category === "generation") return Number.isInteger(Number(pokemon.gen)) ? [String(pokemon.gen)] : [];
  if (category === "stage") return Number.isInteger(Number(pokemon.stage)) && Number(pokemon.stage) > 0 ? [String(pokemon.stage)] : [];
  if (category === "color" || category === "habitat") return pokemon[category] ? [String(pokemon[category])] : [];
  if (category === "letter") {
    const first = norm(pokemon.name).replace(/[^a-z]/g, "").charAt(0);
    return first ? [first] : [];
  }
  return [];
}

function oddPossibleOutliers(cards, categories) {
  const outliers = new Set();
  for (const category of categories) {
    const groups = new Map();
    cards.forEach((pokemon) => {
      for (const value of oddRuleValues(pokemon, category)) {
        if (!groups.has(value)) groups.set(value, new Set());
        groups.get(value).add(pokemon.id);
      }
    });
    for (const ids of groups.values()) {
      if (ids.size !== cards.length - 1) continue;
      const remaining = cards.find((pokemon) => !ids.has(pokemon.id));
      if (remaining) outliers.add(remaining.id);
    }
  }
  return [...outliers];
}

function buildOddPuzzle(pool, category, requireGlobalUnique = false) {
  if (pool.length < 6) return null;
  const groups = new Map();
  for (const pokemon of pool) {
    for (const value of oddRuleValues(pokemon, category)) {
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(pokemon);
    }
  }
  const valid = [...groups.entries()].filter(([, group]) => group.length >= 5 && group.length < pool.length);
  if (!valid.length) return null;

  for (let attempt = 0; attempt < 80; attempt++) {
    const [commonValue, members] = valid[Math.floor(Math.random() * valid.length)];
    const common = shuffleArray(members.slice()).slice(0, 5);
    const oddChoices = pool.filter(pokemon => !oddRuleValues(pokemon, category).includes(commonValue));
    if (!oddChoices.length) continue;
    const odd = oddChoices[Math.floor(Math.random() * oddChoices.length)];
    const cards = shuffleArray([...common, odd]);
    // In hard mode the criterion is hidden: reject alternative answers
    // also justified by the visible color, habitat or evolution stage.
    const categories = requireGlobalUnique
      ? ["type", "generation", "letter", "color", "habitat", "stage"]
      : [category];
    const answers = oddPossibleOutliers(cards, categories);
    if (answers.length !== 1 || answers[0] !== odd.id) continue;
    const descriptions = {
      type: `les 5 autres Pokémon possèdent tous le type ${commonValue}`,
      generation: `les 5 autres viennent de la génération ${commonValue}`,
      letter: `les 5 autres commencent par la lettre ${String(commonValue).toUpperCase()}`,
    };
    const hints = {
      type: "Indice : compare les types affichés dans le Pokédex.",
      generation: "Indice : regarde les générations.",
      letter: "Indice : regarde la première lettre des noms.",
    };
    return {
      cards, oddId: odd.id, rule: category,
      hint: requireGlobalUnique ? "Trouve toi-même le critère commun aux cinq autres." : hints[category],
      explanation: `${odd.name} est l'intrus car ${descriptions[category]}.`,
    };
  }
  return null;
}

function buildOddRuleSet() {
  const keyOrder = oddDifficulty === "easy"
    ? ["letter", "type", "generation"]
    : oddDifficulty === "medium"
      ? ["generation", "type", "letter"]
      : ["type", "generation", "letter"];
  const requireGlobalUnique = oddDifficulty === "hard";
  return keyOrder.map(key => ({
    key, build: pool => buildOddPuzzle(pool, key, requireGlobalUnique),
  }));
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
  const source = getPoolFromSelectedGens().filter(pokemon => !pokemon.isAltForm && pokemon.guessable !== false);
  const rules = buildOddRuleSet();
  let puzzle = null;
  for (let i = 0; i < rules.length && !puzzle; i += 1) {
    puzzle = rules[i].build(source);
  }
  oddOneOutState = {
    cards: puzzle?.cards || [],
    oddId: puzzle?.oddId || null,
    explanation: puzzle?.explanation || "",
    hint: puzzle?.hint || "",
    rule: puzzle?.rule || "",
    revealed: false,
    count: oddOneOutState.count + 1,
  };
  gameOver = false;
  document.getElementById("odd-explanation-box")?.classList.add("hidden");
  document.getElementById("odd-result-actions")?.classList.add("hidden");
  const explanation = document.getElementById("odd-explanation-text");
  if (explanation) explanation.textContent = "";
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
  const soloResult = !isPartySessionActive();
  // Standalone (hors party) : XP léger + historique + record streak
  if (soloResult) {
    try {
      recordMatchHistory({ mode: "odd", result: didWin ? "win" : "loss", attempts: 1, targetName: odd?.name || null });
    } catch (_e) {}
    if (didWin) {
      awardXp(10, "Intrus Pokémon", "odd");
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
  if (soloResult && explanationBox) {
    // The answer lives beneath six cards. Move keyboard/screen-reader focus to
    // the result and bring its replay button into view above the mobile tabbar.
    explanationBox.focus({ preventScroll: true });
    explanationBox.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
      block: "center",
    });
  }
}

function replayOddOneOutPuzzle() {
  // A Party round, including its final resolved round, must never restart
  // through the solo replay CTA.
  if (!oddOneOutState.revealed || !oddOneOutState.oddId || partySession?.currentModeKey === "odd") return;
  nextOddOneOutPuzzle();
  const status = document.getElementById("odd-status");
  status?.focus({ preventScroll: true });
  status?.scrollIntoView({
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
    block: "center",
  });
}

function renderOddOneOutPuzzle(selectedId = null) {
  const grid = document.getElementById("odd-grid");
  const count = document.getElementById("odd-puzzle-count");
  const source = document.getElementById("odd-puzzle-source");
  const status = document.getElementById("odd-status");
  const newPuzzleBtn = document.getElementById("odd-new-puzzle-btn");
  const partyNextBtn = document.getElementById("odd-party-next-btn");
  const resultActions = document.getElementById("odd-result-actions");
  // Keep the last Party round in Party context after it marks the session
  // completed; isPartySessionActive() alone would then incorrectly be false.
  const isPartyOddRound = Boolean(partySession?.currentModeKey === "odd");
  if (!grid || !count || !source || !status) return;
  resultActions?.classList.toggle("hidden", !oddOneOutState.revealed || isPartyOddRound);
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
  if (!oddOneOutState.revealed) status.textContent = "Quel Pokémon est l'intrus ? " + oddOneOutState.hint;
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
  // French entries only: an English text would break the game for French players.
  const pool = entries.filter((entry) => entry?.language?.name === "fr");
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

// PokeAPI has French Pokédex entries up to #898; Hisui and Paldea (#899+) only have English.
const DESCRIPTION_LAST_FRENCH_SPECIES = 898;
function startDescriptionMode() {
  const selected = getPoolFromSelectedGens();
  const pool = selected.filter((pokemon) => (getPokemonSpeciesId(pokemon) || 0) <= DESCRIPTION_LAST_FRENCH_SPECIES);
  if (!pool.length) {
    showToast(selected.length ? "Pas encore de descriptions en français pour ces Pokémon : ajoute une autre génération." : "Sélectionne au moins une génération !");
    return;
  }
  const secret = pickRandomPokemonFromPool(pool) || pool[0];
  descriptionState = { text: "Chargement de l'entrée Pokédex…", loading: true, error: null };
  gameMode = "description";
  // Every Pokémon of the chosen generations can be typed (Gen 9 included); only the mystery needs a
  // French Pokédex entry. Same pool as a reloaded game (restoreGame uses getPoolFromSelectedGens()).
  startGameWithSecret(secret, selected);
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
    const savedDifficulty = localStorage.getItem("pokedle_odd_difficulty_v1");
    if (["easy", "medium", "hard"].includes(savedDifficulty)) oddDifficulty = savedDifficulty;
  } catch (_err) {
    // noop
  }
  nextOddOneOutPuzzle();
  setGlobalNavActive("game");
}

function startWeightBattle() {
  // Each next duel calls this again: only entering the game counts as a start.
  const entering = gameMode !== "weight";
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
  if (entering) trackUsage("solo:weight");
  secretPokemon = left.weight >= right.weight ? left : right;
  activePool = pool;
  attempts = 0;
  gameOver = false;
  guessedNames = [];
  guessedSet = new Set();
  resultHistory = [];
  setQuizModeLayout(false);
  updateTopTag();
  updateModeBanners();
  updateSilhouettePanel(false);
  updatePixelPanel(false);
  updateMysteryPanel(false);
  updateCryPanel(false);
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
  const pool = getPoolFromSelectedGens().filter((pokemon) => !pokemon.isAltForm);
  const candidates = getPokedexOrderCandidates(pool);
  if (!candidates.length) {
    showToast("Aucun trio de numéros consécutifs dans cette sélection. Choisis d'autres générations.");
    return;
  }
  const previousMiddleId = pokedexOrderState?.middle?.id ?? null;
  const fresh = candidates.filter((trio) => trio[1].id !== previousMiddleId);
  const source = fresh.length ? fresh : candidates;
  const [lower, middle, upper] = source[Math.floor(Math.random() * source.length)];
  pokedexOrderState = { lower, middle, upper };
  gameMode = "order";
  startGameWithSecret(middle, pool);
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
  if (typeof hydrateComparisonRowEncounter === "function") hydrateComparisonRowEncounter(tr, pokemon);
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
    const button = document.querySelector('#multiplayer-live-box [data-action="submitMultiplayerGuess"]');
    if (!room || room.status !== "live" || input.disabled || button?.disabled) return;
    event.preventDefault();
    submitMultiplayerGuess();
  });
}

function canSubmitMultiplayerGuess() {
  const state = ensureMultiplayerLiveState();
  const room = state?.room;
  if (!room || room.status !== "live" || state.pendingGuessSubmit || state.pendingForfeit) return false;
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
  const button = document.querySelector('#multiplayer-live-box [data-action="submitMultiplayerGuess"]');
  if (!input || !button) return;
  const state = ensureMultiplayerLiveState();
  const room = state?.room;
  const liveReady = Boolean(room && room.status === "live" && !state.pendingGuessSubmit && !state.pendingForfeit);
  input.disabled = !liveReady;
  button.disabled = !canSubmitMultiplayerGuess();
  const forfeitButton = document.getElementById("multiplayer-forfeit-confirm");
  if (forfeitButton) forfeitButton.disabled = !liveReady || !multiplayerSocket?.connected;
}

function getMultiplayerRoomPool() {
  const room = multiplayerLiveState?.room;
  const gens = Array.isArray(room?.selectedGens) && room.selectedGens.length
    ? new Set(room.selectedGens.map((value) => Number(value)))
    : new Set(getMultiplayerSelectedGens());
  return getPokemonUiList({ gens, includeAltForms: true });
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
    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      handleMultiplayerGenerationChange(gen, item);
      checkbox.checked = new Set(getMultiplayerSelectedGens()).has(gen);
    });
    grid.appendChild(item);
  });

  const roomStatus = multiplayerLiveState?.room?.status || "";
  const self = state.room?.players?.find((player) => player.isSelf) || null;
  const disabled = roomStatus === "live" || Boolean(state.room?.code && !self?.isHost);
  grid.querySelectorAll(".gen-item").forEach((item) => {
    if (disabled) item.classList.add("is-disabled");
    else item.classList.remove("is-disabled");
    item.querySelector("input").disabled = disabled;
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
  hideMultiplayerWinOverlay();
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

function saveDuelSession(code, nickname, resumeToken) {
  try {
    sessionStorage.setItem(DUEL_SESSION_STORAGE_KEY, JSON.stringify({ code, nickname, resumeToken, ts: Date.now() }));
  } catch (_err) { /* stockage indisponible */ }
}

function clearDuelSession() {
  try { sessionStorage.removeItem(DUEL_SESSION_STORAGE_KEY); } catch (_err) { /* noop */ }
}

function attemptDuelResume() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(DUEL_SESSION_STORAGE_KEY) || "null"); } catch (_err) { return; }
  if (!saved?.code || !saved?.resumeToken) return;
  if (Date.now() - (saved.ts || 0) > DUEL_SESSION_TTL_MS) { clearDuelSession(); return; }
  if (!multiplayerSocket) return;

  multiplayerSocket.emit("duel:resume", { code: saved.code, resumeToken: saved.resumeToken }, (response = {}) => {
    if (!response.ok) {
      clearDuelSession();
      return;
    }
    const state = ensureMultiplayerLiveState();
    state.room = response.room || null;
    state.lastRoomClosedReason = "";
    setMultiplayerError("");
    saveDuelSession(saved.code, saved.nickname || response.room?.players?.find((player) => player.isSelf)?.nickname || "", response.resumeToken || saved.resumeToken);
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
    if (typeof attemptPartyResume === "function") attemptPartyResume();
    if (typeof attemptStatClashResume === "function") attemptStatClashResume();
    if (typeof attemptStatAuctionResume === "function") attemptStatAuctionResume();
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("connect_error", () => {
    setMultiplayerConnectionStatus("offline");
    setMultiplayerError("Impossible de joindre le serveur Duel live. Vérifie que server.js tourne.");
    if (typeof partyHandleSocketDisconnect === "function") partyHandleSocketDisconnect();
    if (statClashState?.mode === "room") {
      statClashState.roomPendingAction = "";
      setStatClashRoomFeedback("Impossible de joindre le serveur Room 1v1.", "error");
      renderStatClashScreen();
    }
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("disconnect", () => {
    setMultiplayerConnectionStatus("offline");
    if (typeof partyHandleSocketDisconnect === "function") partyHandleSocketDisconnect();
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
    const ownGuesses = roomState?.players?.find((player) => player.isSelf)?.guessHistory || [];
    state.submittedGuessNames = new Set(ownGuesses.map((entry) => entry.name));
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
    if (typeof clearStatClashSession === "function") clearStatClashSession();
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

function multiplayerProximityValue(player) {
  return Math.max(0, Math.min(100, Math.round(Number(player?.proximity) || 0)));
}

function buildMultiplayerProximityHtml(player) {
  const percent = multiplayerProximityValue(player);
  const attempts = Number(player?.attempts) || 0;
  const label = player?.correct ? "Pokémon trouvé !" : !attempts ? "Le duel ne fait que commencer" : percent >= 75 ? "Une piste très proche" : percent >= 50 ? "La piste se précise" : percent > 0 ? "Des critères en commun" : "Encore à la recherche d’une piste";
  return `<div class="multiplayer-proximity">
    <div class="multiplayer-proximity-ring" style="--proximity:${percent}%" role="progressbar" aria-label="Meilleure proximité adverse" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><strong>${percent}<small>%</small></strong></div>
    <b class="multiplayer-proximity-label">${label}</b>
    <span class="multiplayer-proximity-attempts">${attempts} essai${attempts > 1 ? "s" : ""} · Meilleure proximité</span>
    <p>Ses propositions et ses indices restent privés.</p>
    <details class="multiplayer-proximity-rules"><summary>Comment est calculée la jauge ?</summary><p>Le meilleur essai compte : génération, forme, deux types, habitat, couleur, stade, taille et poids ont le même poids. Un critère exact vaut un point, un critère partiel un demi-point. La jauge ne redescend pas. 100 % signifie que le Pokémon est trouvé ; ce n’est pas une probabilité de victoire.</p></details>
  </div>`;
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
    const proximity = multiplayerProximityValue(player);
    return `
      <article class="multiplayer-player-card ${player?.isSelf ? "is-self" : ""} ${isWinner ? "is-winner" : ""} ${player ? "is-present" : "is-empty"} ${player?.connected === false ? "is-disconnected" : ""}">
        <div class="multiplayer-player-head">
          <strong>${escapeHtml(name)}</strong>
          <span>${subtitle}</span>
        </div>
        <div class="multiplayer-player-room-status">${escapeHtml(status)}</div>
        <div class="multiplayer-player-stats">
          <span>Essais : <b>${attempts}</b></span>
          <span>Meilleure proximité : <b>${proximity} %</b></span>
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

  const rowHtml = `
    <td data-label="Pokémon">
      <div class="poke-cell">
        <img src="${entry.sprite || getPokemonSprite(entry)}" alt="${escapeHtml(entry.name)}" loading="lazy" data-fallback="${fallbackSprite}" />
        ${escapeHtml(entry.name)}
      </div>
    </td>
    <td data-label="Génération" class="${cls(cmp.generation)}">
      <div class="cell-num">
        Gen ${entry.gen}
        ${cmp.generation !== "ok" ? directionPillHtml("gen", entry.genArrow || "") : ""}
      </div>
    </td>
    <td data-label="Forme" class="${cls(cmp.altForm)}">${entry.isAltForm ? "Oui" : "Non"}</td>
    <td data-label="Type 1" class="${cls(cmp.type1)}">${escapeHtml(entry.type1 || "Aucun")}</td>
    <td data-label="Type 2" class="${cls(cmp.type2)}">${escapeHtml(entry.type2 || "Aucun")}</td>
    <td data-label="Habitat" class="${cls(cmp.habitat)}">${escapeHtml(entry.habitat || "Inconnu")}</td>
    <td data-label="Couleur" class="${cls(cmp.color)}">${escapeHtml(formatColorLabel(entry.color || "Inconnu"))}</td>
    <td data-label="Stade" class="${cls(cmp.stage)}">${entry.stage ?? "—"}</td>
    <td data-label="Hauteur" class="${cls(cmp.height)}">
      <div class="cell-num">
        ${entry.height}m
        ${cmp.height !== "ok" ? directionPillHtml("height", heightArrow) : ""}
      </div>
    </td>
    <td data-label="Poids" class="${cls(cmp.weight)}">
      <div class="cell-num">
        ${entry.weight}kg
        ${cmp.weight !== "ok" ? directionPillHtml("weight", weightArrow) : ""}
      </div>
    </td>
  `;
  return rowHtml.replace(/(<td data-label="[^"]+" class="c-(ok|close|wrong)">)/g, (_, cell, state) => cell + comparisonStatusHtml(state));
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

  opponentBox.innerHTML = buildMultiplayerProximityHtml(opponent);

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
        <button class="btn-red" type="button" data-action="winOverlayRestartSame">Revanche →</button>
        <details class="club-replay-options"><summary>Changer les générations</summary><p>Modifie les générations dans le salon, puis relance.</p><button class="btn-ghost" type="button" data-action="winOverlayRestartUpdated">Relancer avec cette sélection</button></details>
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
  if (!multiplayerScreen || multiplayerScreen.classList.contains("hidden")) {
    hideMultiplayerWinOverlay();
    return false;
  }
  const room = multiplayerLiveState?.room;
  const players = Array.isArray(room?.players) ? room.players : [];
  const self = players.find((player) => player.isSelf) || null;
  const winner = players.find((player) => player.id === room?.winnerId) || null;
  const opponent = players.find((player) => !player.isSelf) || null;
  const playerId = self?.id || multiplayerSocket?.id || null;
  const playerWon = Boolean(playerId && winner && playerId === winner.id);
  const target = room?.targetRevealed;
  const discovery = duelDiscovery(room, self);
  if (discovery) recordPokemonDiscovery(discovery, "duel");
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
  const reasonText = room?.endedReason === "forfeit"
    ? (playerWon ? "Ton adversaire a abandonné la manche." : "Tu as abandonné la manche. Voici le Pokémon à trouver.")
    : room?.endedReason === "disconnect"
    ? `${disconnectedOpponent?.nickname || "L'adversaire"} a quitté le duel. La manche est terminée.`
    : playerWon
    ? "Tu as trouvé le Pokémon avant ton adversaire."
    : winner
    ? `${winner.nickname} a trouvé le Pokémon avant toi.`
    : "La manche est terminée.";
  const resultTitle = playerWon ? "Félicitations, tu as gagné !" : "Défaite";
  const resultSupportText = playerWon
    ? (["disconnect", "forfeit"].includes(room?.endedReason) ? "Tu remportes la manche par forfait." : "Belle manche. Tu remportes ce duel live avant ton adversaire.")
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
    const overlayActions = ensureMultiplayerWinOverlay();
    overlayActions.querySelectorAll('[data-action="winOverlayRestartSame"], [data-action="winOverlayRestartUpdated"]').forEach((button) => {
      button.disabled = !bothPlayersPresent || !self?.isHost;
    });
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
  const guessButton = document.querySelector('#multiplayer-live-box [data-action="submitMultiplayerGuess"]');
  const roomInput = document.getElementById("multiplayer-room-input");
  const room = multiplayerLiveState.room;
  const players = Array.isArray(room?.players) ? room.players : [];
  const isWaiting = !room || room.status === "waiting";
  const isLive = room?.status === "live";
  const isFinished = room?.status === "finished";
  if (!isLive) {
    const forfeitDetails = document.getElementById("multiplayer-forfeit");
    if (forfeitDetails) forfeitDetails.open = false;
  }
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
      liveText.textContent = "Devine le Pokémon avant ton adversaire. Vos propositions restent privées ; seule la meilleure proximité est partagée.";
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
    if (response.room?.code) saveDuelSession(response.room.code, nickname, response.resumeToken);
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
    if (response.room?.code || code) saveDuelSession(response.room?.code || code, nickname, response.resumeToken);
    renderMultiplayerBotScreen();
  });
}

function submitMultiplayerGuess() {
  const state = ensureMultiplayerLiveState();
  const room = state?.room;
  if (!room || room.status !== "live") return;
  if (state.pendingGuessSubmit || state.pendingForfeit) return;

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

function forfeitMultiplayerRound() {
  const state = ensureMultiplayerLiveState();
  const room = state.room;
  if (!room || room.status !== "live" || state.pendingForfeit || state.pendingGuessSubmit) return;
  if (!multiplayerSocket?.connected) {
    setMultiplayerError("Connexion perdue. Reconnecte-toi pour abandonner.");
    return;
  }
  state.pendingForfeit = true;
  setMultiplayerError("");
  updateMultiplayerGuessSubmitState();
  multiplayerSocket.timeout(8000).emit("duel:forfeit", { code: room.code, roundSerial: room.roundSerial }, (error, response = {}) => {
    state.pendingForfeit = false;
    if (state.room?.code === room.code && state.room?.roundSerial === room.roundSerial && state.room?.status === "live" && (error || !response.ok)) {
      setMultiplayerError(error ? "Connexion lente : vérifie le résultat avant de réessayer." : response.error || "Impossible d'abandonner.");
    }
    updateMultiplayerGuessSubmitState();
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
  try {
    if (typeof getStoredPartySession === "function" && getStoredPartySession()) {
      ensureMultiplayerSocket();
    }
  } catch (_err) { /* stockage indisponible */ }
  try {
    if (sessionStorage.getItem("pokedle_statclash_session_v1") || sessionStorage.getItem("pokedle_statauction_session_v1")) {
      ensureMultiplayerSocket();
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
    const message = document.getElementById("profile-save-msg");
    if (!picked) {
      event.target.setAttribute("aria-invalid", "true");
      if (message) { message.textContent = "Choisis un Pokémon dans la liste. Ton partenaire actuel est conservé."; message.classList.remove("hidden"); }
      return;
    }
    event.target.removeAttribute("aria-invalid");
    choosePartner(picked.id);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeOverlayModal();
    if (event.key !== 'Tab') return;
    const overlay = document.getElementById('overlay-modal');
    if (!overlay || overlay.classList.contains('hidden')) return;
    const controls = [...overlay.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) return;
    if (!overlay.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
});
