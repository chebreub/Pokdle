// ============================================================
// GENERATION GRID
// ============================================================
function buildGenGrid() {
  const grid = document.getElementById("gen-grid");
  grid.innerHTML = "";

  Object.entries(GENERATIONS).forEach(([n, data]) => {
    const gen = parseInt(n, 10);
    const count = getPokemonCountForGeneration(gen, { includeAltForms: false });
    const isOn = selectedGens.has(gen);

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

    item.addEventListener("click", (e) => {
      e.preventDefault();
      toggleGen(gen, item);
    });

    grid.appendChild(item);
  });
  updateHomeGensSummary();
}

function toggleGen(gen, item) {
  if (selectedGens.has(gen)) {
    if (selectedGens.size <= 1) return;
    selectedGens.delete(gen);
    item.classList.remove("on");
    item.querySelector(".gen-check").textContent = "";
  } else {
    selectedGens.add(gen);
    item.classList.add("on");
    item.querySelector(".gen-check").textContent = "OK";
  }
  updateHomeGensSummary();
}

function setSelectedGenerations(gens) {
  const validGens = (Array.isArray(gens) ? gens : [])
    .map((gen) => Number(gen))
    .filter((gen) => Number.isInteger(gen) && GENERATIONS[gen]);

  selectedGens = new Set(validGens.length ? validGens : [1]);
  buildGenGrid();
}

// DA 2026 : résumé de la sélection dans l'en-tête de la carte repliable.
function updateHomeGensSummary() {
  const summary = document.getElementById("home-gens-summary");
  if (!summary) return;
  const gens = [...selectedGens].sort((a, b) => a - b);
  const total = gens.reduce((acc, gen) => acc + getPokemonCountForGeneration(gen, { includeAltForms: false }), 0);
  const label = gens.length === Object.keys(GENERATIONS).length
    ? "Toutes les générations"
    : gens.map((gen) => `Gen ${gen}`).join(" · ");
  summary.textContent = `${label} — ${total} Pokémon dans le pool.`;
}

function toggleHomeGensCard() {
  const card = document.getElementById("home-gens-card");
  const toggle = document.getElementById("home-gens-toggle");
  if (!card) return;
  const collapsed = card.classList.toggle("is-collapsed");
  if (toggle) {
    toggle.textContent = collapsed ? "Modifier ▾" : "Fermer ▴";
    toggle.setAttribute("aria-expanded", String(!collapsed));
  }
}
window.toggleHomeGensCard = toggleHomeGensCard;

// DA 2026 : hero "Pokémon du jour" (statut du jour, série, compte à rebours UTC).
let dailyHeroCountdownTimer = null;
function renderDailyHero() {
  const dateEl = document.getElementById("daily-hero-date");
  const streakEl = document.getElementById("daily-hero-streak");
  const statusEl = document.getElementById("daily-hero-status");
  const ctaEl = document.getElementById("daily-hero-cta");
  if (!dateEl && !streakEl) return;

  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }
  if (streakEl) streakEl.textContent = `🔥 Série : ${Number(playerStats?.dailyCurrentStreak) || 0}`;

  const today = getUTCDateKey();
  const wonToday = playerStats?.lastDailyWinKey === today;
  let inProgress = false;
  try {
    const save = readJson(STORAGE_KEYS.dailyGame, null) || readJson(STORAGE_KEYS.game, null);
    inProgress = Boolean(save && save.mode === "daily" && save.dailyKey === today);
  } catch (_err) { /* stockage indisponible */ }

  if (statusEl) {
    statusEl.classList.toggle("hidden", !wonToday && !inProgress);
    if (wonToday) statusEl.textContent = "✅ Trouvé aujourd'hui !";
    else if (inProgress) statusEl.textContent = "⏸ Partie en cours";
  }
  if (ctaEl) {
    ctaEl.textContent = wonToday ? "🔁 Revoir le mode du jour" : (inProgress ? "▶ Reprendre ma partie" : "▶ Jouer au Pokémon du jour");
  }

  updateDailyHeroCountdown();
  if (!dailyHeroCountdownTimer) {
    dailyHeroCountdownTimer = setInterval(updateDailyHeroCountdown, 30000);
  }
}

function updateDailyHeroCountdown() {
  const countdownEl = document.getElementById("daily-hero-countdown");
  if (!countdownEl) return;
  const now = new Date();
  const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = Math.max(0, nextUtcMidnight - now.getTime());
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  countdownEl.textContent = `⏳ Prochain Pokémon dans ${hours} h ${String(minutes).padStart(2, "0")} min`;
}

function selectAllGenerations() {
  setSelectedGenerations(Object.keys(GENERATIONS).map((gen) => Number(gen)));
}

function clearGenerationSelection() {
  setSelectedGenerations([1]);
}

document.addEventListener("keydown", (event) => {
  const target = event.target?.closest?.(".home-pillar[role='button']");
  if (!target || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  target.click();
});

// ============================================================
// GAME START / NAVIGATION
// ============================================================
// Pure random : chaque Pokémon du pool a la même probabilité (1/pool.length)
// à chaque tirage, sans mémoire des choix précédents.
function pickRandomPokemonFromPool(pool) {
  if (!Array.isArray(pool) || !pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function startNormalGame(forcedPokemon = null) {
  if (forcedPokemon) {
    startChallengeGame(forcedPokemon);
    return;
  }

  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    showToast("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "normal";
  const secret = pickRandomPokemonFromPool(pool) || pool[0];
  startGameWithSecret(secret, pool);
}

function startDailyGame() {
  gameMode = "daily";
  const pool = POKEMON_LIST.slice();
  const secret = getDailyPokemon();
  startGameWithSecret(secret, pool, { dailyKey: getUTCDateKey() });
}

function startSilhouetteGame() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    showToast("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "silhouette";
  const secret = pickRandomPokemonFromPool(pool) || pool[0];
  startGameWithSecret(secret, pool);
}

function startPixelGame() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    showToast("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "pixel";
  const secret = pickRandomPokemonFromPool(pool) || pool[0];
  startGameWithSecret(secret, pool);
}

function startCryGame() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    showToast("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "cry";
  const secret = pickRandomPokemonFromPool(pool) || pool[0];
  startGameWithSecret(secret, pool);
}

function startQuizGame() {
  gameMode = "quiz";
  attempts = 0;
  gameOver = false;
  winRegisteredForCurrentGame = false;
  quizSessionLogged = false;
  // En Party, un round Quiz est raccourci pour rester équilibré avec les autres mini-jeux.
  quizQuestions = shuffleArray(buildQuizQuestionPool()).slice(0, isPartySessionActive() ? 5 : QUIZ_QUESTION_COUNT);
  quizCurrentIndex = 0;
  quizScore = 0;
  quizAnswered = false;
  quizHistory = [];
  secretPokemon = null;
  activePool = [];

  document.getElementById("try-count").textContent = "0";
  document.getElementById("err-msg").textContent = "";
  document.getElementById("guess-input").value = "";
  document.getElementById("guess-ac").classList.add("hidden");
  document.getElementById("results-body").innerHTML = "";
  document.getElementById("results-wrap").classList.add("hidden");
  document.getElementById("win-box").classList.add("hidden");
  document.querySelector(".search-bar")?.classList.add("hidden");
  hideCustomModeSurfaces();
  document.getElementById("screen-odd-one-out")?.classList.add("hidden");
  document.getElementById("screen-multiplayer")?.classList.add("hidden");

  updateTopTag();
  updateModeBanners();
  updateSilhouettePanel(false);
  updatePixelPanel(false);
  mysteryClues = [];
  updateMysteryPanel(false);
  updateCryPanel(false);
  setQuizModeLayout(true);

  document.getElementById("screen-config").classList.add("hidden");
  showScreen("screen-game");
  setGlobalNavActive("game");

  renderQuizQuestion();
  registerGameStart();
}



function startMysteryStatGame() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    showToast("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "mystery";
  const secret = pickRandomPokemonFromPool(pool) || pool[0];
  startGameWithSecret(secret, pool);
}
function restartCurrentMode() {
  if (gameMode === "daily") {
    startDailyGame();
    return;
  }

  if (gameMode === "silhouette") {
    startSilhouetteGame();
    return;
  }

  if (gameMode === "pixel") {
    startPixelGame();
    return;
  }

  if (gameMode === "cry") {
    startCryGame();
    return;
  }

  if (gameMode === "mystery") {
    startMysteryStatGame();
    return;
  }

  if (gameMode === "quiz") {
    startQuizGame();
    return;
  }

  if (gameMode === "description") {
    startDescriptionMode();
    return;
  }

  if (gameMode === "odd") {
    openOddOneOutMode();
    return;
  }

  if (gameMode === "weight") {
    startWeightBattle();
    return;
  }

  if (gameMode === "evolution") {
    startEvolutionChainGame();
    return;
  }

  if (gameMode === "order") {
    startPokedexOrderGame();
    return;
  }

  if (gameMode === "party") {
    startPartyMode();
    return;
  }

  if (gameMode === "stat-clash") {
    restartStatClashGame();
    return;
  }

  if (gameMode === "challenge" && secretPokemon) {
    startChallengeGame(secretPokemon);
    return;
  }

  startNormalGame();
}
function startChallengeGame(pokemon) {
  if (!pokemon) return;

  gameMode = "challenge";
  selectedGens = new Set([pokemon.gen]);
  buildGenGrid();

  const pool = getPokemonUiList({ gens: [pokemon.gen] });
  startGameWithSecret(pokemon, pool);
}

// Onboarding nouveau joueur : modale "Comment jouer ?" au premier jeu de devinette.
const ONBOARDING_STORAGE_KEY = "pokedle_onboarding_v1";

function openOnboardingModal() {
  ensureOverlay("Comment jouer ?", `
    <div class="onboarding-steps">
      <section class="onboarding-step">
        <div class="onboarding-step-num">1</div>
        <div>
          <h4>Tape un nom de Pokémon</h4>
          <p>L'autocomplétion t'aide, accents facultatifs. Chaque essai compare ton Pokémon au Pokémon mystère.</p>
        </div>
      </section>
      <section class="onboarding-step">
        <div class="onboarding-step-num">2</div>
        <div>
          <h4>Lis les indices</h4>
          <p>
            <span class="legend-chip lc-ok">Vert</span> exact ·
            <span class="legend-chip lc-close">Jaune</span> proche ·
            <span class="legend-chip lc-wrong">Rouge</span> faux.
            Les flèches indiquent si le mystère est plus grand/lourd (↑) ou plus petit/léger (↓).
          </p>
          <div class="onboarding-example" aria-hidden="true">
            <span class="legend-chip lc-ok">Gen 1</span>
            <span class="legend-chip lc-wrong">Feu</span>
            <span class="legend-chip lc-close">Forêt</span>
            <span class="legend-chip lc-wrong">0,4 m ↑</span>
          </div>
        </div>
      </section>
      <section class="onboarding-step">
        <div class="onboarding-step-num">3</div>
        <div>
          <h4>Trouve-le en un minimum d'essais</h4>
          <p>Reviens chaque jour pour le Pokémon du jour : garde ta série 🔥 et partage ton résultat sans rien spoiler.</p>
        </div>
      </section>
    </div>
  `);
}
window.openOnboardingModal = openOnboardingModal;

function maybeShowOnboarding() {
  try {
    if (localStorage.getItem(ONBOARDING_STORAGE_KEY)) return;
    localStorage.setItem(ONBOARDING_STORAGE_KEY, String(Date.now()));
  } catch (_err) {
    return;
  }
  openOnboardingModal();
}

function startGameWithSecret(secret, pool, options = {}) {
  trackUsage("solo:" + gameMode);
  secretPokemon = secret;
  activePool = pool;

  if (["normal", "daily", "challenge"].includes(gameMode)) maybeShowOnboarding();

  attempts = 0;
  gameOver = false;
  guessedNames = [];
  guessedSet = new Set();
  resultHistory = [];
  acIndex = -1;
  winRegisteredForCurrentGame = false;

  guessCache.clear();
  challengeCache.clear();
  rebuildActiveSearchIndex();

  document.getElementById("try-count").textContent = "0";
  document.getElementById("err-msg").textContent = "";
  document.getElementById("results-body").innerHTML = "";
  document.getElementById("results-wrap").classList.add("hidden");
  document.querySelector(".search-bar")?.classList.remove("hidden");

  document.getElementById("guess-input").value = "";
  document.getElementById("guess-ac").classList.add("hidden");

  const winBox = document.getElementById("win-box");
  winBox.classList.add("hidden");
  winBox.classList.remove("win-animate");
  document.getElementById("share-ok").classList.add("hidden");
  const shareBtn = document.getElementById("btn-share");
  const surrenderBtn = document.getElementById("btn-surrender");
  if (shareBtn) shareBtn.classList.remove("hidden");
  if (surrenderBtn) surrenderBtn.classList.remove("hidden");
  hideCustomModeSurfaces();
  document.getElementById("screen-odd-one-out")?.classList.add("hidden");
  document.getElementById("screen-multiplayer")?.classList.add("hidden");

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

  registerGameStart();
  saveCurrentGame(options.dailyKey || null);

}


function setGlobalNavActive(key) {
  const map = {
    config: "nav-config",
    game: "nav-game",
    social: "nav-social",
    pokedex: "nav-collection",
    types: "nav-collection",
    extras: "nav-extras",
    draft: "nav-extras",
    emu: "nav-extras",
    rank: "nav-extras",
    champions: "nav-extras",
  };

  // Reset toutes les pills de nav (utiliser un Set pour éviter les doublons)
  const ids = new Set(Object.values(map));
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });

  // Tab bar mobile : état actif synchronisé sur les mêmes clés.
  const tabByKey = { config: "home", game: "game", pokedex: "pokedex", types: "pokedex", social: "social", profile: "profile" };
  document.querySelectorAll("#mobile-tabbar [data-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === (tabByKey[key] || ""));
  });

  const activeId = map[key] || map.config;
  const active = document.getElementById(activeId);
  if (active) active.classList.add("active");

}

function openCurrentGameScreen() {
  const canResumeGame = Boolean(secretPokemon) || gameMode === "quiz" || gameMode === "odd";
  if (!canResumeGame) {
    goToConfig();
    return;
  }

  if (gameMode === "odd") {
    openOddOneOutMode();
    return;
  }

  stopEmulatorSession();
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  document.getElementById("screen-profile")?.classList.add("hidden");
  document.getElementById("screen-achievements")?.classList.add("hidden");
  document.getElementById("screen-history")?.classList.add("hidden");
  document.getElementById("screen-multiplayer")?.classList.add("hidden");
  document.getElementById("screen-odd-one-out")?.classList.add("hidden");
  showScreen("screen-game");
  document.querySelector(".search-bar")?.classList.remove("hidden");
  hideCustomModeSurfaces();

  const input = document.getElementById("guess-input");
  if (input && gameMode !== "quiz") input.focus();

  if (gameMode === "description") {
    renderDescriptionMode();
  } else if (gameMode === "weight") {
    renderWeightBattlePanel();
  } else if (gameMode === "evolution") {
    renderEvolutionChainPanel();
  } else if (gameMode === "order") {
    renderPokedexOrderPanel();
  } else if (gameMode === "quiz") {
    document.querySelector(".search-bar")?.classList.add("hidden");
  }

  if (partySession) renderPartySessionUI();
  setGlobalNavActive("game");
}
function goToConfig() {
  // Lot D audit : quitter la page émulateur ramène sur la page principale (CSP stricte).
  if (window.location.pathname === "/emulateur") {
    window.location.assign("/");
    return;
  }
  if (typeof renderDailyHero === "function") renderDailyHero();
  if (!partyLaunchInProgress) partySession = null;
  cleanupStatClashMode();
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  document.getElementById("screen-profile")?.classList.add("hidden");
  document.getElementById("screen-achievements")?.classList.add("hidden");
  document.getElementById("screen-history")?.classList.add("hidden");
  document.getElementById("screen-multiplayer")?.classList.add("hidden");
  document.getElementById("screen-odd-one-out")?.classList.add("hidden");
  document.getElementById("screen-stat-clash")?.classList.add("hidden");
  document.getElementById("screen-all-modes")?.classList.add("hidden");
  stopEmulatorSession();
  setQuizModeLayout(false);
  stopCrySound();
  closeRankingPicker();
  document.querySelector(".search-bar")?.classList.remove("hidden");
  hideCustomModeSurfaces();
  showScreen("screen-config");
  setGlobalNavActive("config");
}

function scrollToHomeCategory(category) {
  const targetMap = {
    play: "home-play",
    social: "home-social",
    champions: "home-champions",
    collection: "home-collection",
    extras: "home-extras",
  };

  goToConfig();

  const activeMap = {
    play: "nav-game",
    social: "nav-social",
    champions: "nav-champions",
    collection: "nav-collection",
    extras: "nav-extras",
  };

  const navId = activeMap[category];
  document.querySelectorAll("#global-nav .nav-pill").forEach((button) => button.classList.remove("active"));
  if (navId) document.getElementById(navId)?.classList.add("active");

  const target = document.getElementById(targetMap[category]);
  if (!target) return;

  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function getPoolFromSelectedGens() {
  return getPokemonUiList({ gens: selectedGens });
}

function updateTopTag() {
  const tag = document.getElementById("tag-gen");

  if (gameMode === "daily") {
    tag.textContent = `Jour ${formatUTCDateLabel(getUTCDateKey())}`;
    return;
  }
  if (gameMode === "quiz") {
    tag.textContent = "Quiz";
    return;
  }


  const gens = [...selectedGens].sort((a, b) => a - b);
  tag.textContent = gens.length === 1 ? `Gen ${gens[0]}` : `Gen ${gens.join("+")}`;
}

function updateModeBanners() {
  const challengeBanner = document.getElementById("challenge-banner");
  const dailyBanner = document.getElementById("daily-banner");
  const silhouetteBanner = document.getElementById("silhouette-banner");
  const pixelBanner = document.getElementById("pixel-banner");
  const mysteryBanner = document.getElementById("mystery-banner");
  const cryBanner = document.getElementById("cry-banner");
  const quizBanner = document.getElementById("quiz-banner");

  challengeBanner.classList.add("hidden");
  dailyBanner.classList.add("hidden");
  silhouetteBanner.classList.add("hidden");
  pixelBanner.classList.add("hidden");
  if (mysteryBanner) mysteryBanner.classList.add("hidden");
  if (cryBanner) cryBanner.classList.add("hidden");
  if (quizBanner) quizBanner.classList.add("hidden");

  if (gameMode === "challenge") {
    challengeBanner.classList.remove("hidden");
  } else if (gameMode === "daily") {
    dailyBanner.classList.remove("hidden");
  } else if (gameMode === "silhouette") {
    silhouetteBanner.classList.remove("hidden");
  } else if (gameMode === "pixel") {
    pixelBanner.classList.remove("hidden");
  } else if (gameMode === "mystery" && mysteryBanner) {
    mysteryBanner.classList.remove("hidden");
  } else if (gameMode === "cry" && cryBanner) {
    cryBanner.classList.remove("hidden");
  } else if (gameMode === "quiz" && quizBanner) {
    quizBanner.classList.remove("hidden");
  }
}

function updateSilhouettePanel(reveal) {
  const box = document.getElementById("silhouette-box");
  const img = document.getElementById("silhouette-sprite");

  if (!box || !img) return;

  if (gameMode !== "silhouette" || !secretPokemon) {
    box.classList.add("hidden");
    box.classList.remove("revealed");
    img.src = "";
    return;
  }

  box.classList.remove("hidden");
  img.src = getPokemonSprite(secretPokemon);
  img.alt = "Silhouette du Pokémon mystère";
  if (reveal) {
    img.style.transform = "translate(0px, 0px) scale(1)";
  } else {
    const startScale = 4;
    const step = 0.55;
    const scale = Math.max(1, startScale - attempts * step);
    img.style.transform = `translate(0px, 0px) scale(${scale})`;
  }
  box.classList.toggle("revealed", Boolean(reveal));
}

function getPixelBlurForAttempts(tries) {
  const startBlur = 14;
  const step = 2;
  return Math.max(0, startBlur - tries * step);
}

function updatePixelPanel(reveal) {
  const box = document.getElementById("pixel-box");
  const img = document.getElementById("pixel-sprite");

  if (!box || !img) return;

  if (gameMode !== "pixel" || !secretPokemon) {
    box.classList.add("hidden");
    box.classList.remove("revealed");
    img.src = "";
    img.style.filter = "";
    return;
  }

  box.classList.remove("hidden");
  img.src = getPokemonSprite(secretPokemon);
  img.alt = "Pokémon pixelisé";

  if (reveal) {
    box.classList.add("revealed");
    img.style.filter = "none";
  } else {
    box.classList.remove("revealed");
    img.style.filter = `blur(${getPixelBlurForAttempts(attempts)}px)`;
  }
}

// ============================================================
// AUTOCOMPLETE (optimized)
// ============================================================

const MYSTERY_STAT_CACHE = new Map();

function getMysteryClues(secret) {
  if (!secret) return [];

  return [
    { label: "Type", value: secret.type1 + (secret.type2 ? " / " + secret.type2 : "") },
    { label: "PV", value: "?" },
    { label: "Attaque", value: "?" },
    { label: "Défense", value: "?" },
    { label: "Attaque Spéciale", value: "?" },
    { label: "Défense Spéciale", value: "?" },
    { label: "Vitesse", value: "?" },
    { label: "Total", value: "?" },
  ];
}

function getMysteryApiId(secret) {
  if (!secret) return null;
  if (FORM_API_NAME_BY_NAME[secret.name]) return FORM_API_NAME_BY_NAME[secret.name];
  const spriteId = getPokemonSpriteId(secret);
  if (Number.isInteger(spriteId) && spriteId > 0 && spriteId <= 1025) return spriteId;
  if (Number.isInteger(secret.id) && secret.id > 0 && secret.id <= 1025) return secret.id;
  return null;
}

async function fetchBattleStats(secret) {
  const apiId = getMysteryApiId(secret);
  if (!apiId) return null;

  if (MYSTERY_STAT_CACHE.has(apiId)) {
    return MYSTERY_STAT_CACHE.get(apiId);
  }

  try {
    const data = await fetchPokeApiJson(`https://pokeapi.co/api/v2/pokemon/${apiId}`);
    const stats = new Map((data?.stats || []).map((s) => [s.stat?.name, s.base_stat]));

    const parsed = {
      hp: Number(stats.get("hp")) || null,
      attack: Number(stats.get("attack")) || null,
      defense: Number(stats.get("defense")) || null,
      spAttack: Number(stats.get("special-attack")) || null,
      spDefense: Number(stats.get("special-defense")) || null,
      speed: Number(stats.get("speed")) || null,
    };

    MYSTERY_STAT_CACHE.set(apiId, parsed);
    return parsed;
  } catch (_err) {
    return null;
  }
}













function getStatClashAvailableStats(state = statClashState) {
  if (!state) return [];
  const roundLocked = new Set(
    Object.values(state.players || {})
      .map((player) => player?.pendingPick?.key)
      .filter(Boolean)
  );
  return STAT_CLASH_STATS.filter((entry) => !state.usedStats.includes(entry.key) && !roundLocked.has(entry.key));
}


async function pickStatClashRoundPokemon() {
  const state = statClashState;
  if (!state?.pool?.length) return null;

  const unusedPool = state.pool.filter((pokemon) => !state.usedPokemonIds.includes(pokemon.id));
  const source = shuffleArray((unusedPool.length ? unusedPool : state.pool).slice());
  for (const pokemon of source) {
    const stats = await fetchBattleStats(pokemon);
    if (!stats) continue;
    state.usedPokemonIds.push(pokemon.id);
    return { pokemon, stats };
  }

  return null;
}

function autoPickStatClashStat(side) {
  const state = statClashState;
  if (!state || state.phase !== "picking") return;
  const player = state.players?.[side];
  if (!player || player.pendingPick) return;

  const available = getStatClashAvailableStats(state);
  if (!available.length) return;

  const best = available
    .map((entry) => ({ ...entry, value: getStatClashValue(entry.key, state.currentStats) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "fr"))[0];

  if (!best) return;
  pickStatClashStat(side, best.key, true);
}

function finalizeStatClashGame() {
  const state = statClashState;
  if (!state) return;
  state.phase = "finished";
  state.statusText = state.players.left.score === state.players.right.score
    ? "Les deux joueurs terminent exactement à égalité."
    : `${state.players.left.score > state.players.right.score ? state.players.left.label : state.players.right.label} prend le dessus après 3 manches.`;
  renderStatClashScreen();
}


async function resolveStatClashRound() {
  const state = statClashState;
  if (!state || state.transitionLocked) return;

  state.transitionLocked = true;
  state.statusText = "Révélation des picks et montée des scores...";
  const leftPick = state.players.left.pendingPick;
  const rightPick = state.players.right.pendingPick;
  if (!leftPick || !rightPick) {
    state.transitionLocked = false;
    return;
  }

  const leftStat = getStatClashStatDef(leftPick.key);
  const rightStat = getStatClashStatDef(rightPick.key);
  const leftValue = getStatClashValue(leftPick.key, state.currentStats);
  const rightValue = getStatClashValue(rightPick.key, state.currentStats);
  state.usedStats.push(leftPick.key, rightPick.key);
  state.reveal = {
    left: { statKey: leftPick.key, statLabel: leftStat.label, value: leftValue, auto: Boolean(leftPick.auto) },
    right: { statKey: rightPick.key, statLabel: rightStat.label, value: rightValue, auto: Boolean(rightPick.auto) },
  };
  state.players.left.history.push({ round: state.round, statKey: leftPick.key, statLabel: leftStat.label, value: leftValue, pokemonName: state.currentPokemon.name });
  state.players.right.history.push({ round: state.round, statKey: rightPick.key, statLabel: rightStat.label, value: rightValue, pokemonName: state.currentPokemon.name });

  renderStatClashScreen();
  await animateStatClashScores({
    left: state.players.left.score + leftValue,
    right: state.players.right.score + rightValue,
  });

  if (!statClashState) return;
  state.players.left.score += leftValue;
  state.players.right.score += rightValue;
  state.players.left.pendingPick = null;
  state.players.right.pendingPick = null;
  state.autoPickedSides = [];

  if (state.round >= state.totalRounds || state.usedStats.length >= STAT_CLASH_STATS.length) {
    state.transitionLocked = false;
    trackStatClashTimeout(() => finalizeStatClashGame(), STAT_CLASH_POST_REVEAL_DELAY_MS);
    return;
  }

  state.round += 1;
  state.transitionLocked = false;
  trackStatClashTimeout(() => startStatClashRound(), STAT_CLASH_INTER_ROUND_DELAY_MS);
}


function startStatClashTimer() {
  const state = statClashState;
  if (!state) return;

  state.phase = "picking";
  state.timerLeftMs = STAT_CLASH_PICK_TIME_MS;
  state.statusText = "Les deux joueurs verrouillent chacun une stat différente.";
  renderStatClashScreen();

  const startedAt = Date.now();
  const intervalId = trackStatClashInterval(() => {
    const liveState = statClashState;
    if (!liveState || liveState.phase !== "picking") {
      clearTrackedStatClashInterval(intervalId);
      return;
    }

    liveState.timerLeftMs = Math.max(0, STAT_CLASH_PICK_TIME_MS - (Date.now() - startedAt));
    renderStatClashScreen();

    if (liveState.timerLeftMs > 0) return;

    clearTrackedStatClashInterval(intervalId);
    autoPickStatClashStat("left");
    autoPickStatClashStat("right");
    if (liveState.players.left.pendingPick && liveState.players.right.pendingPick) {
      resolveStatClashRound();
    }
  }, 120);
}


async function startStatClashRound() {
  const state = statClashState;
  if (!state) return;

  resetStatClashRuntime();
  state.reveal = null;
  state.timerLeftMs = STAT_CLASH_PICK_TIME_MS;
  state.transitionLocked = false;
  state.players.left.pendingPick = null;
  state.players.right.pendingPick = null;
  state.statusText = "Chargement des vraies base stats du prochain Pokémon...";
  state.phase = "loading";
  renderStatClashScreen();

  const roundData = await pickStatClashRoundPokemon();
  if (!statClashState) return;
  if (!roundData) {
    state.statusText = "Impossible de charger les base stats pour cette sélection.";
    state.phase = "error";
    renderStatClashScreen();
    return;
  }

  state.currentPokemon = roundData.pokemon;
  state.currentStats = roundData.stats;
  state.randomizerPokemon = roundData.pokemon;
  const sequence = buildStatClashRandomizerSequence(roundData.pokemon, state.pool);
  runStatClashRandomizer(sequence, roundData.pokemon);
}


function getStatClashPool() {
  return getPokemonUiList().filter((pokemon) => Boolean(getMysteryApiId(pokemon)));
}

function createStatClashPlayer(side, label) {
  return { side, label, score: 0, displayScore: 0, pendingPick: null, history: [], lockedAt: null };
}

function createStatClashState() {
  const nickname = String(playerProfile?.nickname || "").trim() || "Joueur 1";
  return {
    mode: "bot",
    phase: "idle",
    round: 1,
    totalRounds: STAT_CLASH_ROUND_TOTAL,
    timerLeftMs: STAT_CLASH_PICK_TIME_MS,
    timerDurationMs: STAT_CLASH_PICK_TIME_MS,
    statusText: "Choisis ton format de duel.",
    selectedGens: [...selectedGens].sort((a, b) => a - b),
    pool: getStatClashPool(),
    currentPokemon: null,
    currentStats: null,
    randomizerPokemon: null,
    usedPokemonIds: [],
    usedStatsBySide: { left: [], right: [] },
    reveal: null,
    revealStats: null,
    room: null,
    roomJoinCode: "",
    roomNameDraft: "",
    roomCodeDraft: "",
    roomToken: "",
    roomFeedback: "",
    roomFeedbackTone: "info",
    roomPendingAction: "",
    players: {
      left: createStatClashPlayer("left", nickname),
      right: createStatClashPlayer("right", "Bot Clash"),
    },
    // Extensions DA / gameplay
    houseRuleEnabled: true,
    houseRule: null,
    houseRuleBySide: { left: null, right: null },
    houseRuleShared: null,
    houseRuleSharedEnabled: false,
    pendingImposedRuleBySide: { left: null, right: null },
    doubleStatKey: null,
    mirrorStatKey: null,
    blindRound5OptionsBySide: { left: null, right: null },
    botDifficulty: "normal",
    format: "standard",
    suddenDeath: false,
    streakBySide: { left: 0, right: 0 },
    roundsWonBySide: { left: 0, right: 0 },
    jokersBySide: { left: buildStatClashJokers(), right: buildStatClashJokers() },
    announcerLine: "",
    announcerTone: "info",
    showVersusOverlay: false,
    pendingRoundResult: null,
    resolvePending: false,
  };
}

function resetStatClashRuntime() {
  statClashRuntime.timeouts.forEach((id) => clearTimeout(id));
  statClashRuntime.intervals.forEach((id) => clearInterval(id));
  if (statClashRuntime.animationFrame !== null) cancelAnimationFrame(statClashRuntime.animationFrame);
  if (statClashRuntime.timerInterval) clearInterval(statClashRuntime.timerInterval);
  statClashRuntime = { timeouts: new Set(), intervals: new Set(), animationFrame: null, timerInterval: null };
}

function trackStatClashTimeout(callback, delay) {
  const id = setTimeout(() => {
    statClashRuntime.timeouts.delete(id);
    callback();
  }, delay);
  statClashRuntime.timeouts.add(id);
  return id;
}

function trackStatClashInterval(callback, delay) {
  const id = setInterval(callback, delay);
  statClashRuntime.intervals.add(id);
  return id;
}

function clearTrackedStatClashInterval(id) {
  if (!id) return;
  clearInterval(id);
  statClashRuntime.intervals.delete(id);
  if (statClashRuntime.timerInterval === id) statClashRuntime.timerInterval = null;
}

function setTrackedStatClashAnimationFrame(callback) {
  if (statClashRuntime.animationFrame !== null) cancelAnimationFrame(statClashRuntime.animationFrame);
  statClashRuntime.animationFrame = requestAnimationFrame((timestamp) => {
    statClashRuntime.animationFrame = null;
    callback(timestamp);
  });
}

function updateStatClashTimerUi() {
  if (!statClashState) return;
  const seconds = Math.max(0, Math.ceil(statClashState.timerLeftMs / 1000));
  const duration = Math.max(1, Number(statClashState.timerDurationMs) || STAT_CLASH_PICK_TIME_MS);
  const pct = Math.max(0, Math.min(100, (statClashState.timerLeftMs / duration) * 100));
  document.querySelectorAll(".stat-clash-timer-ring span").forEach((node) => {
    node.textContent = String(seconds);
  });
  document.querySelectorAll(".stat-clash-timer-fill").forEach((node) => {
    node.style.width = `${pct}%`;
  });
}

function cleanupStatClashMode() {
  if (statClashState?.mode === "room" && statClashState?.room?.code && multiplayerSocket?.connected) {
    multiplayerSocket.emit("stat-clash:leave-room");
  }
  resetStatClashRuntime();
  const root = document.getElementById("stat-clash-root");
  if (root?.dataset) delete root.dataset.bound;
  statClashState = null;
}

function restartStatClashGame() {
  if (!statClashState) return openStatClashMode();
  if (statClashState.mode === "room") return restartStatClashRoom();
  startStatClashBotGame();
}

function prepareStatClashBotLobby() {
  if (!statClashState) return;
  resetStatClashRuntime();
  const leftLabel = statClashState.players?.left?.label || String(playerProfile?.nickname || "").trim() || "Joueur 1";
  statClashState.mode = "bot";
  statClashState.phase = "idle";
  statClashState.round = 1;
  statClashState.pool = getStatClashPool();
  statClashState.totalRounds = (STAT_CLASH_FORMATS[statClashState.format] || STAT_CLASH_FORMATS.standard).rounds;
  statClashState.suddenDeath = Boolean((STAT_CLASH_FORMATS[statClashState.format] || STAT_CLASH_FORMATS.standard).suddenDeath);
  statClashState.timerLeftMs = STAT_CLASH_PICK_TIME_MS;
  statClashState.timerDurationMs = STAT_CLASH_PICK_TIME_MS;
  statClashState.statusText = "Choisis ton mode, ton format, puis lance le duel.";
  statClashState.usedStatsBySide = { left: [], right: [] };
  statClashState.usedPokemonIds = [];
  statClashState.currentPokemon = null;
  statClashState.currentStats = null;
  statClashState.randomizerPokemon = null;
  statClashState.reveal = null;
  statClashState.revealStats = null;
  statClashState.room = null;
  statClashState.roomToken = "";
  statClashState.roomPendingAction = "";
  statClashState.players.left = createStatClashPlayer("left", leftLabel);
  statClashState.players.right = createStatClashPlayer("right", "Bot Clash");
  statClashState.streakBySide = { left: 0, right: 0 };
  statClashState.roundsWonBySide = { left: 0, right: 0 };
  statClashState.jokersBySide = { left: buildStatClashJokers(), right: buildStatClashJokers() };
  statClashState.announcerLine = "";
  statClashState.announcerTone = "info";
  statClashState.showVersusOverlay = false;
  statClashState.pendingRoundResult = null;
  statClashState.resolvePending = false;
  statClashState.finalWinnerSide = null;
  statClashState.houseRuleBySide = { left: null, right: null };
  statClashState.houseRuleShared = null;
  statClashState.pendingImposedRuleBySide = { left: null, right: null };
  statClashState.blindRound5OptionsBySide = { left: null, right: null };
}

function bindStatClashInteractions() {
  const root = document.getElementById("stat-clash-root");
  if (!root || root.dataset.bound === "true") return;
  root.dataset.bound = "true";
  root.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-stat-clash-action]");
    if (!actionEl) return;
    const action = actionEl.getAttribute("data-stat-clash-action");
    console.debug("[stat-clash][client][click]", { action, disabled: Boolean(actionEl.disabled), ariaDisabled: actionEl.getAttribute("aria-disabled") });
    if (!action) return;
    if (actionEl.disabled || actionEl.getAttribute("aria-disabled") === "true") return;

    if (action === "create-room") return createStatClashRoom();
    if (action === "join-room") return joinStatClashRoom();
    if (action === "copy-room") return copyStatClashRoomCode();
    if (action === "leave-room") return leaveStatClashRoom();
    if (action === "start-room") return startStatClashRoomGame();
    if (action === "start-bot") return startStatClashBotGame();
    if (action === "switch-bot") return switchStatClashMode("bot");
    if (action === "switch-room") return switchStatClashMode("room");
  });
}

// Audit DA : partie rapide — lance un duel vs bot avec les réglages par défaut,
// sans passer par le panneau de configuration.
function quickStatClashGame() {
  trackUsage("solo:statclash");
  try { switchStatClashMode("bot"); } catch (_err) { /* déjà en mode bot */ }
  startStatClashBotGame();
}
window.quickStatClashGame = quickStatClashGame;

function getStatClashStatDef(statKey) {
  return STAT_CLASH_STATS.find((entry) => entry.key === statKey) || STAT_CLASH_STATS[0];
}

function getStatClashValue(statKey, stats) {
  const value = Number(stats?.[statKey]);
  return Number.isFinite(value) ? value : 0;
}

function getStatClashRemainingStats(usedStats = []) {
  const blocked = new Set(usedStats || []);
  return STAT_CLASH_STATS.filter((entry) => !blocked.has(entry.key));
}

function setStatClashTimerInterval(callback, delay) {
  if (statClashRuntime.timerInterval) clearTrackedStatClashInterval(statClashRuntime.timerInterval);
  const id = trackStatClashInterval(callback, delay);
  statClashRuntime.timerInterval = id;
  return id;
}

function buildStatClashRandomizerSequence(finalPokemon, pool) {
  const source = shuffleArray(pool.filter((pokemon) => pokemon.id !== finalPokemon.id)).slice(0, Math.max(0, STAT_CLASH_RANDOMIZER_STEPS - 1));
  return [...source, finalPokemon];
}

async function pickStatClashRoundPokemon() {
  const state = statClashState;
  if (!state?.pool?.length) return null;
  const remaining = state.pool.filter((pokemon) => !state.usedPokemonIds.includes(pokemon.id));
  const source = shuffleArray((remaining.length ? remaining : state.pool).slice());
  for (const pokemon of source) {
    const stats = await fetchBattleStats(pokemon);
    if (!stats) continue;
    state.usedPokemonIds.push(pokemon.id);
    return { pokemon, stats };
  }
  return null;
}

function resolveHiddenStatClashChoices(picks, usedStatsBySide, stats) {
  const usedBySide = {
    left: new Set(usedStatsBySide?.left || []),
    right: new Set(usedStatsBySide?.right || []),
  };
  return picks.map((pick) => {
    const side = pick.side === "right" ? "right" : "left";
    let finalKey = pick.key && !usedBySide[side].has(pick.key) ? pick.key : null;
    let auto = Boolean(pick.auto);
    if (!finalKey) {
      const fallback = getStatClashRemainingStats([...usedBySide[side]])
        .sort((left, right) => getStatClashValue(right.key, stats) - getStatClashValue(left.key, stats))[0];
      finalKey = fallback?.key || null;
      auto = true;
    }
    return {
      side,
      key: finalKey,
      statLabel: getStatClashStatDef(finalKey).label,
      value: finalKey ? getStatClashValue(finalKey, stats) : 0,
      auto,
    };
  });
}

function runStatClashRandomizer(sequence, finalPokemon, onDone, totalDuration = STAT_CLASH_ROLL_MS) {
  const state = statClashState;
  if (!state) return;
  state.phase = "rolling";
  state.statusText = "Le randomizer tourne...";
  state.randomizerPokemon = sequence[0] || finalPokemon;
  renderStatClashScreen();
  const steps = Math.max(1, sequence.length);
  const effectiveDuration = Math.max(1200, totalDuration);
  const stepDuration = Math.max(90, Math.floor(effectiveDuration / steps));
  sequence.forEach((pokemon, index) => {
    const totalDelay = Math.min(effectiveDuration, stepDuration * (index + 1));
    trackStatClashTimeout(() => {
      if (!statClashState) return;
      statClashState.randomizerPokemon = pokemon;
      statClashState.statusText = index === sequence.length - 1 ? `${pokemon.name} est tiré.` : "Le randomizer ralentit...";
      renderStatClashScreen();
      if (index === sequence.length - 1 && typeof onDone === "function") onDone();
    }, totalDelay);
  });
}

function animateStatClashScores(nextTotals) {
  return new Promise((resolve) => {
    const state = statClashState;
    if (!state) return resolve();
    const startValues = { left: state.players.left.displayScore, right: state.players.right.displayScore };
    const startedAt = performance.now();
    state.phase = "scoring";
    const step = (now) => {
      if (!statClashState) return resolve();
      const progress = Math.max(0, Math.min(1, (now - startedAt) / STAT_CLASH_SCORE_ANIMATION_MS));
      const eased = 1 - Math.pow(1 - progress, 3);
      statClashState.players.left.displayScore = startValues.left + (nextTotals.left - startValues.left) * eased;
      statClashState.players.right.displayScore = startValues.right + (nextTotals.right - startValues.right) * eased;
      renderStatClashScreen();
      if (progress < 1) return setTrackedStatClashAnimationFrame(step);
      statClashState.players.left.displayScore = nextTotals.left;
      statClashState.players.right.displayScore = nextTotals.right;
      renderStatClashScreen();
      resolve();
    };
    setTrackedStatClashAnimationFrame(step);
  });
}

function autoPickLocalStatClash(side) {
  const state = statClashState;
  if (!state || state.mode !== "bot") return;
  const player = state.players[side];
  if (!player || player.pendingPick) return;
  const allowed = getStatClashAllowedStats(state, side);
  const ordered = allowed
    .map((key) => ({ key, value: getStatClashValue(key, state.currentStats) }))
    .sort((a, b) => b.value - a.value);
  if (!ordered.length) return;
  // Bot difficulty: weighted pick
  const diff = STAT_CLASH_BOT_DIFFICULTIES[state.botDifficulty] || STAT_CLASH_BOT_DIFFICULTIES.normal;
  let chosenKey = ordered[0].key;
  if (side === "right" && ordered.length > 1) {
    if (Math.random() > diff.topPickWeight) {
      // Pick a non-top option, weighted toward higher
      const idx = 1 + Math.floor(Math.random() * Math.min(ordered.length - 1, 3));
      chosenKey = ordered[Math.min(idx, ordered.length - 1)].key;
    }
  }
  player.pendingPick = { key: chosenKey, auto: true };
  player.lockedAt = Date.now();
}

function maybeResolveLocalStatClashRound() {
  const state = statClashState;
  if (!state || state.mode !== "bot") return;
  if (!state.players.left.pendingPick || !state.players.right.pendingPick) return;
  if (state.resolvePending) return;
  state.resolvePending = true;
  state.phase = "locked";
  state.statusText = "Choix verrouillés. Révélation dans un instant.";
  renderStatClashScreen();
  trackStatClashTimeout(() => {
    if (!statClashState || statClashState.mode !== "bot") return;
    if (!statClashState.players.left.pendingPick || !statClashState.players.right.pendingPick) {
      statClashState.resolvePending = false;
      return;
    }
    statClashState.resolvePending = false;
    resolveLocalStatClashRound();
  }, STAT_CLASH_LOCKED_REVEAL_DELAY_MS);
}

async function resolveLocalStatClashRound() {
  const state = statClashState;
  if (!state || state.mode !== "bot" || !state.currentStats) return;
  const resolved = resolveHiddenStatClashChoices([
    { side: "left", ...state.players.left.pendingPick, lockedAt: state.players.left.lockedAt },
    { side: "right", ...state.players.right.pendingPick, lockedAt: state.players.right.lockedAt },
  ], state.usedStatsBySide, state.currentStats);
  const reveal = {};
  resolved.forEach((entry) => {
    reveal[entry.side] = entry;
    if (entry.key && !state.suddenDeath) state.usedStatsBySide[entry.side].push(entry.key);
  });
  state.reveal = reveal;
  state.revealStats = { ...state.currentStats };
  state.statusText = "Révélation des choix.";

  // Round winner basé sur les valeurs brutes (avant multiplicateurs)
  const baseLeft = Number(reveal.left?.value || 0);
  const baseRight = Number(reveal.right?.value || 0);
  const leftWins = baseLeft > baseRight;
  const rightWins = baseRight > baseLeft;

  // Multiplicateurs: house rule doubleStat + joker double armé
  let adjLeft = getStatClashScoreForPick(state, reveal.left?.key, baseLeft);
  let adjRight = getStatClashScoreForPick(state, reveal.right?.key, baseRight);
  if (state.jokersBySide.left.doubleArmed) {
    adjLeft = leftWins ? adjLeft * 2 : 0;
    state.jokersBySide.left.doubleArmed = false;
  }
  if (state.jokersBySide.right.doubleArmed) {
    adjRight = rightWins ? adjRight * 2 : 0;
    state.jokersBySide.right.doubleArmed = false;
  }

  // Streak + roundsWon
  if (leftWins) {
    state.streakBySide.left += 1;
    state.streakBySide.right = 0;
    state.roundsWonBySide.left += 1;
  } else if (rightWins) {
    state.streakBySide.right += 1;
    state.streakBySide.left = 0;
    state.roundsWonBySide.right += 1;
  } else {
    state.streakBySide.left = 0;
    state.streakBySide.right = 0;
  }

  // Combo bonus house rule: +2 pts à l'atteinte d'un streak de 3
  const comboBonusBySide = { left: 0, right: 0 };
  if (state.houseRuleEnabled && (state.houseRuleShared || state.houseRule)?.id === "comboBonus") {
    if (state.streakBySide.left === 3) { adjLeft += 2; comboBonusBySide.left = 2; }
    if (state.streakBySide.right === 3) { adjRight += 2; comboBonusBySide.right = 2; }
  }
  // Bonus comeback aveugle : +3 pts si tu gagnes la manche en subissant blindRound5
  const comebackBonusBySide = { left: 0, right: 0 };
  if (state.houseRuleEnabled) {
    if (leftWins && Array.isArray(state.blindRound5OptionsBySide?.left) && state.blindRound5OptionsBySide.left.length) { adjLeft += 3; comebackBonusBySide.left = 3; }
    if (rightWins && Array.isArray(state.blindRound5OptionsBySide?.right) && state.blindRound5OptionsBySide.right.length) { adjRight += 3; comebackBonusBySide.right = 3; }
  }
  state.lastRoundBonusBySide = { left: { combo: comboBonusBySide.left, comeback: comebackBonusBySide.left }, right: { combo: comboBonusBySide.right, comeback: comebackBonusBySide.right } };

  // Annonceur
  if (state.streakBySide.left === 3 || state.streakBySide.right === 3) {
    const comboBonusActive = state.houseRuleEnabled && (state.houseRuleShared || state.houseRule)?.id === "comboBonus";
    state.announcerLine = comboBonusActive ? pickStatClashAnnouncerLine("streak3") : "Triplé ! Streak en feu.";
    state.announcerTone = "fire";
  } else if (state.streakBySide.left === 2 || state.streakBySide.right === 2) {
    state.announcerLine = pickStatClashAnnouncerLine("streak2");
    state.announcerTone = "warm";
  } else if (baseLeft === baseRight) {
    state.announcerLine = pickStatClashAnnouncerLine("tieRound");
    state.announcerTone = "info";
  } else if (Math.max(baseLeft, baseRight) >= 110) {
    state.announcerLine = pickStatClashAnnouncerLine("pickedHigh");
    state.announcerTone = "win";
  } else if (Math.min(baseLeft, baseRight) <= 60) {
    state.announcerLine = pickStatClashAnnouncerLine("pickedLow");
    state.announcerTone = "lose";
  }
  state.pendingRoundResult = { leftWins, rightWins, baseLeft, baseRight };
  renderStatClashScreen();

  await animateStatClashScores({
    left: state.players.left.score + adjLeft,
    right: state.players.right.score + adjRight,
  });
  if (!statClashState) return;
  state.players.left.score += adjLeft;
  state.players.right.score += adjRight;
  state.players.left.pendingPick = null;
  state.players.left.lockedAt = null;
  state.players.right.pendingPick = null;
  state.players.right.lockedAt = null;
  if (reveal.left?.key) state.players.left.history.push({ round: state.round, statKey: reveal.left.key, statLabel: reveal.left.statLabel, value: adjLeft, pokemonName: state.currentPokemon?.name, auto: reveal.left.auto, comboBonus: comboBonusBySide.left, comebackBonus: comebackBonusBySide.left });
  if (reveal.right?.key) state.players.right.history.push({ round: state.round, statKey: reveal.right.key, statLabel: reveal.right.statLabel, value: adjRight, pokemonName: state.currentPokemon?.name, auto: reveal.right.auto, comboBonus: comboBonusBySide.right, comebackBonus: comebackBonusBySide.right });

  // Sudden Death: première manche décisive termine la game
  if (state.suddenDeath && (leftWins || rightWins)) {
    return trackStatClashTimeout(() => finalizeStatClashBotGame(), STAT_CLASH_POST_REVEAL_DELAY_MS);
  }
  const usedAll = state.usedStatsBySide.left.length >= STAT_CLASH_STATS.length || state.usedStatsBySide.right.length >= STAT_CLASH_STATS.length;
  if (state.round >= state.totalRounds || (!state.suddenDeath && usedAll)) {
    return trackStatClashTimeout(() => finalizeStatClashBotGame(), STAT_CLASH_POST_REVEAL_DELAY_MS);
  }
  state.round += 1;
  trackStatClashTimeout(() => startStatClashBotRound(), STAT_CLASH_INTER_ROUND_DELAY_MS);
}

function startStatClashBotTimer() {
  const state = statClashState;
  if (!state || state.mode !== "bot") return;
  state.phase = "picking";
  const timerMs = getStatClashHouseRuleTimerMs(state);
  state.timerLeftMs = timerMs;
  state.timerDurationMs = timerMs;
  state.statusText = "Choisis une stat. Le choix adverse reste caché jusqu'au reveal.";
  renderStatClashScreen();
  const botDelayMax = Math.max(900, Math.min(timerMs - 500, 4200));
  trackStatClashTimeout(() => {
    if (!statClashState || statClashState.mode !== "bot" || statClashState.phase !== "picking") return;
    maybeBotUseJoker(statClashState);
    autoPickLocalStatClash("right");
    renderStatClashScreen();
    maybeResolveLocalStatClashRound();
  }, 1100 + Math.floor(Math.random() * botDelayMax));
  const startedAt = Date.now();
  const intervalId = setStatClashTimerInterval(() => {
    if (!statClashState || statClashState.mode !== "bot" || statClashState.phase !== "picking") return clearTrackedStatClashInterval(intervalId);
    statClashState.timerLeftMs = Math.max(0, timerMs - (Date.now() - startedAt));
    updateStatClashTimerUi();
    if (statClashState.timerLeftMs > 0) return;
    clearTrackedStatClashInterval(intervalId);
    autoPickLocalStatClash("left");
    autoPickLocalStatClash("right");
    renderStatClashScreen();
    maybeResolveLocalStatClashRound();
  }, 100);
}

// Bot peut activer Double juste avant son pick (uniquement si ratio espéré favorable)
function maybeBotUseJoker(state) {
  if (!state) return;
  const jokers = state.jokersBySide?.right;
  if (!jokers) return;
  const remaining = STAT_CLASH_STATS
    .map((s) => s.key)
    .filter((k) => !state.usedStatsBySide.right.includes(k));
  if (!remaining.length) return;
  const best = remaining
    .map((k) => getStatClashValue(k, state.currentStats))
    .sort((a, b) => b - a)[0];
  // Bot active double s'il reste un x2 et que la stat top est >=120 (lecture safe)
  if (jokers.double > 0 && !jokers.doubleArmed && best >= 120 && state.round >= 3) {
    jokers.double = 0;
    jokers.doubleArmed = true;
  }
}

async function startStatClashBotRound() {
  const state = statClashState;
  if (!state || state.mode !== "bot") return;
  resetStatClashRuntime();
  if (state.jokersBySide?.left) state.jokersBySide.left.doubleArmed = false;
  if (state.jokersBySide?.right) state.jokersBySide.right.doubleArmed = false;
  state.reveal = null;
  state.revealStats = null;
  state.players.left.pendingPick = null;
  state.players.right.pendingPick = null;
  state.players.left.lockedAt = null;
  state.players.right.lockedAt = null;
  state.jokersBySide.left.previewKey = null;
  state.jokersBySide.right.previewKey = null;
  state.resolvePending = false;
  state.statusText = "Chargement du prochain Pokémon...";
  state.phase = "loading";
  renderStatClashScreen();
  const roundData = await pickStatClashRoundPokemon();
  if (!statClashState) return;
  if (!roundData) {
    state.phase = "error";
    state.statusText = "Impossible de charger les vraies stats du Pokémon.";
    return renderStatClashScreen();
  }
  state.currentPokemon = roundData.pokemon;
  state.currentStats = roundData.stats;
  // Mirror rule : tirer une stat imposée pour la M4
  if (state.houseRuleEnabled && (state.houseRuleShared || state.houseRule)?.id === "mirrorRound4" && state.round === 4) {
    const candidates = STAT_CLASH_STATS
      .map((s) => s.key)
      .filter((k) => !state.usedStatsBySide.left.includes(k) && !state.usedStatsBySide.right.includes(k));
    state.mirrorStatKey = candidates[Math.floor(Math.random() * candidates.length)] || STAT_CLASH_STATS[0].key;
  } else {
    state.mirrorStatKey = null;
  }
  // Blind round 5 : tirer 2 stats parmi non utilisees pour chaque side qui subit la regle
  state.blindRound5OptionsBySide = { left: null, right: null };
  if (state.houseRuleEnabled && state.round === 5) {
    for (const side of ["left", "right"]) {
      if (state.houseRuleBySide?.[side]?.id !== "blindRound5") continue;
      const used = state.usedStatsBySide?.[side] || [];
      const remaining = STAT_CLASH_STATS.map((s) => s.key).filter((k) => !used.includes(k));
      const pool = remaining.length ? remaining : STAT_CLASH_STATS.map((s) => s.key);
      const shuffled = pool.slice().sort(() => Math.random() - 0.5);
      state.blindRound5OptionsBySide[side] = shuffled.slice(0, Math.min(2, shuffled.length));
    }
  }
  // Mini "round intro" overlay
  state.showVersusOverlay = "round";
  renderStatClashScreen();
  trackStatClashTimeout(() => {
    if (!statClashState) return;
    statClashState.showVersusOverlay = false;
    renderStatClashScreen();
    const sequence = buildStatClashRandomizerSequence(roundData.pokemon, state.pool);
    runStatClashRandomizer(sequence, roundData.pokemon, () => {
      if (!statClashState) return;
      startStatClashBotTimer();
    }, STAT_CLASH_ROLL_MS);
  }, 800);
}

function startStatClashBotGame() {
  if (!statClashState) return;
  if (statClashState.houseRuleEnabled && !STAT_CLASH_IMPOSABLE_RULE_IDS.has(statClashState.pendingImposedRuleBySide?.left)) {
    statClashState.statusText = "Choisis une règle à imposer au bot avant de lancer.";
    return renderStatClashScreen();
  }
  resetStatClashRuntime();
  statClashState.mode = "bot";
  statClashState.pool = getStatClashPool();
  statClashState.round = 1;
  statClashState.usedStatsBySide = { left: [], right: [] };
  statClashState.usedPokemonIds = [];
  statClashState.reveal = null;
  statClashState.revealStats = null;
  statClashState.players.left = createStatClashPlayer("left", statClashState.players.left.label || "Joueur 1");
  statClashState.players.right = createStatClashPlayer("right", "Bot Clash");
  // Reset extensions
  statClashState.streakBySide = { left: 0, right: 0 };
  statClashState.roundsWonBySide = { left: 0, right: 0 };
  statClashState.jokersBySide = { left: buildStatClashJokers(), right: buildStatClashJokers() };
  statClashState.announcerLine = "";
  statClashState.announcerTone = "info";
  statClashState.mirrorStatKey = null;
  statClashState.doubleStatKey = null;
  statClashState.blindRound5OptionsBySide = { left: null, right: null };
  statClashState.finalWinnerSide = null;
  statClashState.pendingRoundResult = null;
  statClashState.resolvePending = false;
  // Apply format
  const fmt = STAT_CLASH_FORMATS[statClashState.format] || STAT_CLASH_FORMATS.standard;
  statClashState.totalRounds = fmt.rounds;
  statClashState.suddenDeath = Boolean(fmt.suddenDeath);
  // Pick house rule
  if (statClashState.houseRuleEnabled) {
    const playerRule = getStatClashRuleById(statClashState.pendingImposedRuleBySide.left);
    const botPool = new Set(STAT_CLASH_IMPOSABLE_RULE_IDS);
    if (playerRule?.id) botPool.delete(playerRule.id);
    const botRule = getRandomStatClashRuleFromSet(botPool);
    statClashState.houseRuleBySide = { left: botRule, right: playerRule };
    statClashState.houseRuleShared = statClashState.houseRuleSharedEnabled ? getRandomStatClashRuleFromSet(STAT_CLASH_SHARED_RULE_IDS) : null;
    statClashState.houseRule = statClashState.houseRuleShared;
    statClashState.houseRuleTargetSide = null;
    if (statClashState.houseRuleShared?.id === "doubleStat") {
      statClashState.doubleStatKey = STAT_CLASH_STATS[Math.floor(Math.random() * STAT_CLASH_STATS.length)].key;
    }
  } else {
    statClashState.houseRule = null;
    statClashState.houseRuleBySide = { left: null, right: null };
    statClashState.houseRuleShared = null;
    statClashState.houseRuleTargetSide = null;
  }
  // Game intro overlay then start
  statClashState.showVersusOverlay = "game";
  statClashState.announcerLine = pickStatClashAnnouncerLine("roundStart");
  renderStatClashScreen();
  trackStatClashTimeout(() => {
    if (!statClashState) return;
    statClashState.showVersusOverlay = false;
    renderStatClashScreen();
    startStatClashBotRound();
  }, 1700);
}

function finalizeStatClashBotGame() {
  if (!statClashState) return;
  const s = statClashState;
  s.phase = "finished";
  const scoreLeft = s.players.left.score;
  const scoreRight = s.players.right.score;
  let winnerSide = null;
  let tiebreakerNote = "";
  if (scoreLeft === scoreRight) {
    // Tiebreaker: rounds won
    if (s.roundsWonBySide.left > s.roundsWonBySide.right) { winnerSide = "left"; tiebreakerNote = " (départage manches gagnées)"; }
    else if (s.roundsWonBySide.right > s.roundsWonBySide.left) { winnerSide = "right"; tiebreakerNote = " (départage manches gagnées)"; }
  } else if (scoreLeft > scoreRight) winnerSide = "left";
  else winnerSide = "right";
  if (!winnerSide) {
    s.statusText = "Égalité parfaite, même score et même nombre de manches gagnées.";
  } else {
    s.statusText = `${s.players[winnerSide].label} gagne le duel${tiebreakerNote}.`;
  }
  s.announcerLine = pickStatClashAnnouncerLine("finish");
  s.announcerTone = "win";
  s.finalWinnerSide = winnerSide;
  // XP + quête Stat Clash
  if (winnerSide === "left") {
    awardXp(70, "Victoire Stat Clash");
    progressQuest("stat_clash_win", 1);
  } else if (winnerSide === "right") {
    awardXp(20, "Stat Clash (défaite)");
  } else {
    awardXp(35, "Stat Clash (égalité)");
  }
  try {
    const result = winnerSide === "left" ? "win" : winnerSide === "right" ? "loss" : "draw";
    recordMatchHistory({
      mode: "stat-clash",
      result,
      attempts: scoreLeft + scoreRight,
      targetName: `vs Bot · ${scoreLeft}-${scoreRight}`,
    });
  } catch (_e) {}
  renderStatClashScreen();
}

// === STAT CLASH — Jokers handlers ===
function useStatClashJoker(side, type) {
  const state = statClashState;
  if (!state) return;
  if (side !== "left") return; // jokers utilisateur uniquement a gauche
  if (state.mode === "room") {
    if (!state.room || state.phase !== "picking" || state.players.left.pendingPick) return;
    const jokers = state.jokersBySide?.left;
    if (!jokers) return;
    if (type === "reroll" && jokers.reroll <= 0) return;
    if (type === "preview" && jokers.preview <= 0) return;
    if (type === "double" && (jokers.double <= 0 || jokers.doubleArmed)) return;
    return multiplayerSocket?.emit("stat-clash:use-joker", { type }, (response = {}) => {
      if (!response.ok && response.error) showToast(response.error);
    });
  }
  if (state.mode !== "bot") return;
  const jokers = state.jokersBySide?.left;
  if (!jokers) return;
  if (type === "reroll") {
    if (jokers.reroll <= 0 || state.phase !== "picking") return;
    jokers.reroll = 0;
    state.statusText = "Reroll utilisé — nouveau Pokémon en cours.";
    resetStatClashRuntime();
    state.players.left.pendingPick = null;
    state.players.left.lockedAt = null;
    state.players.right.pendingPick = null;
    state.players.right.lockedAt = null;
    state.reveal = null;
    state.revealStats = null;
    state.randomizerPokemon = null;
    state.jokersBySide.left.previewKey = null;
    state.jokersBySide.right.previewKey = null;
    // Repick a new Pokémon, redo randomizer then re-open timer
    state.phase = "loading";
    renderStatClashScreen();
    pickStatClashRoundPokemon().then((roundData) => {
      if (!statClashState || !roundData) return;
      statClashState.currentPokemon = roundData.pokemon;
      statClashState.currentStats = roundData.stats;
      // Recompute mirror stat if applicable
      if (statClashState.houseRuleEnabled && (statClashState.houseRuleShared || statClashState.houseRule)?.id === "mirrorRound4" && statClashState.round === 4) {
        const candidates = STAT_CLASH_STATS
          .map((s) => s.key)
          .filter((k) => !statClashState.usedStatsBySide.left.includes(k) && !statClashState.usedStatsBySide.right.includes(k));
        statClashState.mirrorStatKey = candidates[Math.floor(Math.random() * candidates.length)] || STAT_CLASH_STATS[0].key;
      }
      const sequence = buildStatClashRandomizerSequence(roundData.pokemon, statClashState.pool);
      runStatClashRandomizer(sequence, roundData.pokemon, () => startStatClashBotTimer(), STAT_CLASH_ROLL_MS);
    });
    return;
  }
  if (type === "preview") {
    if (jokers.preview <= 0 || state.phase !== "picking" || !state.currentStats) return;
    const allowed = getStatClashAllowedStats(state, "left");
    const candidates = allowed.length ? allowed : STAT_CLASH_STATS.map((s) => s.key);
    const key = candidates[Math.floor(Math.random() * candidates.length)];
    jokers.preview = 0;
    jokers.previewKey = key;
    renderStatClashScreen();
    trackStatClashTimeout(() => {
      if (!statClashState || !statClashState.jokersBySide?.left) return;
      statClashState.jokersBySide.left.previewKey = null;
      renderStatClashScreen();
    }, 2400);
    return;
  }
  if (type === "double") {
    if (jokers.double <= 0 || state.phase !== "picking" || state.players.left.pendingPick) return;
    jokers.double = 0;
    jokers.doubleArmed = true;
    renderStatClashScreen();
    return;
  }
}

// === STAT CLASH — Settings handlers ===
function setStatClashFormat(value) {
  if (!statClashState) return;
  if (!STAT_CLASH_FORMATS[value]) return;
  if (statClashState.mode === "room") {
    return multiplayerSocket?.emit("stat-clash:update-room-options", { format: value }, (response = {}) => {
      if (!response.ok && response.error) showToast(response.error);
    });
  }
  statClashState.format = value;
  if (statClashState.phase === "idle" && !statClashState.currentPokemon) {
    prepareStatClashBotLobby();
    return renderStatClashScreen();
  }
  restartStatClashGame();
}
function selectStatClashImposedRule(ruleId) {
  if (!statClashState) return;
  const rule = getStatClashRuleById(ruleId);
  if (!rule || !STAT_CLASH_IMPOSABLE_RULE_IDS.has(rule.id)) return;
  if (statClashState.mode === "room") {
    if (!statClashState.room?.code || !multiplayerSocket?.connected) return;
    return multiplayerSocket.emit("stat-clash:select-imposed-rule", { ruleId: rule.id }, (response = {}) => {
      if (!response.ok) {
        setStatClashRoomFeedback(response.error || "Impossible de choisir cette règle.", "error");
        return renderStatClashScreen();
      }
      applyStatClashRoomState(response.room);
      setStatClashRoomFeedback(`Règle choisie : ${rule.label}`, "success");
      renderStatClashScreen();
    });
  }
  statClashState.pendingImposedRuleBySide.left = rule.id;
  statClashState.statusText = `Tu imposes : ${rule.label}`;
  renderStatClashScreen();
}
function setStatClashDifficulty(value) {
  if (!statClashState || statClashState.mode === "room") return;
  if (!STAT_CLASH_BOT_DIFFICULTIES[value]) return;
  statClashState.botDifficulty = value;
  if (statClashState.phase === "idle" && !statClashState.currentPokemon) return renderStatClashScreen();
  restartStatClashGame();
}
function toggleStatClashHouseRule() {
  if (!statClashState) return;
  if (statClashState.mode === "room") {
    const next = !(statClashState.room?.houseRuleEnabled !== false);
    return multiplayerSocket?.emit("stat-clash:update-room-options", { houseRuleEnabled: next }, (response = {}) => {
      if (!response.ok && response.error) showToast(response.error);
    });
  }
  statClashState.houseRuleEnabled = !statClashState.houseRuleEnabled;
  if (statClashState.phase === "idle" && !statClashState.currentPokemon) return renderStatClashScreen();
  restartStatClashGame();
}
function toggleStatClashSharedHouseRule() {
  if (!statClashState) return;
  const next = !statClashState.houseRuleSharedEnabled;
  if (statClashState.mode === "room") {
    return multiplayerSocket?.emit("stat-clash:update-room-options", { houseRuleSharedEnabled: next }, (response = {}) => {
      if (!response.ok) {
        if (response.error) showToast(response.error);
        return;
      }
      applyStatClashRoomState(response.room);
    });
  }
  statClashState.houseRuleSharedEnabled = next;
  renderStatClashScreen();
}

function syncStatClashNickname() {
  const input = document.getElementById("stat-clash-nickname");
  if (!statClashState || !input) return;
  statClashState.roomNameDraft = String(input.value || "").slice(0, 24);
}

function syncStatClashJoinCode() {
  const input = document.getElementById("stat-clash-room-input");
  if (!statClashState || !input) return;
  const sanitized = String(input.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  statClashState.roomCodeDraft = sanitized;
  if (input.value !== sanitized) input.value = sanitized;
  const joinButton = document.querySelector('[data-stat-clash-action="join-room"]');
  if (joinButton) joinButton.disabled = Boolean(statClashState.roomPendingAction) || !sanitized;
}

function getStatClashRoomSubmittedNickname() {
  const draft = String(statClashState?.roomNameDraft || "").trim();
  const profileName = String(playerProfile?.nickname || "").trim();
  return draft || profileName || "Joueur 1";
}

function setStatClashRoomFeedback(message, tone = "info") {
  if (!statClashState) return;
  statClashState.roomFeedback = String(message || "");
  statClashState.roomFeedbackTone = tone || "info";
}

function getStatClashRoomUiState(state) {
  const room = state?.room || null;
  const localPlayer = room?.players?.find((player) => player.isSelf) || null;
  const opponent = room?.players?.find((player) => !player.isSelf) || null;
  const hasRoom = Boolean(room?.code);
  const connectedCount = Number(room?.connectedCount) || room?.players?.filter((player) => player.connected).length || 0;
  const maxPlayers = Number(room?.maxPlayers) || 2;
  const opponentConnected = Boolean(opponent?.connected);

  if (!hasRoom) {
    return {
      title: "Crée une room pour inviter un autre joueur",
      detail: state?.roomPendingAction === "joining" ? "Connexion à la room…" : "Entre un pseudo, crée une room ou rejoins-en une avec un code.",
      tone: state?.roomPendingAction ? "is-pending" : "is-idle",
    };
  }

  if (state?.roomPendingAction === "creating") {
    return {
      title: `Création de la room ${room.code || "…"}…`,
      detail: "Préparation du lobby.",
      tone: "is-pending",
    };
  }

  if (state?.roomPendingAction === "joining") {
    return {
      title: `Connexion à ${room.code || state.roomJoinCode || "la room"}…`,
      detail: "Synchronisation du lobby.",
      tone: "is-pending",
    };
  }

  if (room.status === "lobby") {
    return {
      title: `Room créée : ${room.code}`,
      detail: room?.canStart
        ? "Joueur 2 a rejoint. La partie est prête."
        : `En attente d'un autre joueur… ${connectedCount}/${maxPlayers}`,
      tone: room?.canStart ? "is-ready" : "is-waiting",
    };
  }

  if (room.status === "starting") {
    return {
      title: `Room ${room.code}`,
      detail: localPlayer?.isHost ? "Lancement par l'hôte…" : "L'hôte lance la partie…",
      tone: "is-pending",
    };
  }

  if (room.roundPhase === "rolling") {
    return {
      title: `Room ${room.code}`,
      detail: "Synchronisation en cours. La manche démarre.",
      tone: "is-ready",
    };
  }

  if (room.roundPhase === "picking") {
    return {
      title: `Room ${room.code}`,
      detail: localPlayer?.pendingPickKey ? "Choix verrouillé. En attente du choix adverse." : "Choisis une stat et verrouille ton choix.",
      tone: localPlayer?.pendingPickKey ? "is-ready" : "is-live",
    };
  }

  if (room.roundPhase === "locked") {
    return {
      title: `Room ${room.code}`,
      detail: "Choix verrouillés. Révélation imminente.",
      tone: "is-ready",
    };
  }

  if (room.roundPhase === "reveal") {
    return {
      title: `Room ${room.code}`,
      detail: "Révélation des choix.",
      tone: "is-live",
    };
  }

  if (room.status === "finished") {
    return {
      title: `Room ${room.code}`,
      detail: "Partie terminée.",
      tone: "is-ready",
    };
  }

  return {
    title: `Room ${room.code}`,
    detail: "Lobby synchronisé.",
    tone: "is-idle",
  };
}

function getStatClashRoomLocalPlayer() {
  return statClashState?.room?.players?.find((player) => player.isSelf) || null;
}

function getStatClashRoomOpponent() {
  return statClashState?.room?.players?.find((player) => !player.isSelf) || null;
}

function renderStatClashRoomMeta(room) {
  if (!room?.code) return "";
  const leftPlayer = room.players?.find((player) => player.side === "left") || room.players?.[0] || null;
  const rightPlayer = room.players?.find((player) => player.side === "right") || room.players?.[1] || null;
  const leftName = leftPlayer?.nickname || "Joueur 1";
  const rightName = rightPlayer?.nickname || "Joueur 2";
  const leftWins = Number(room?.matchWinsBySide?.left) || 0;
  const rightWins = Number(room?.matchWinsBySide?.right) || 0;
  const recordScore = Number(room?.sessionRecord?.score) || 359;
  const recordWinner = room?.sessionRecord?.winner || "Kayan";
  const recordLoser = room?.sessionRecord?.loser || "MG";
  return `<div class="stat-clash-room-meta"><div class="stat-clash-room-meta-card"><span>Score cumulé</span><b>${escapeHtml(leftName)} ${leftWins} - ${rightWins} ${escapeHtml(rightName)}</b></div><div class="stat-clash-room-meta-card"><span>Record d'écart</span><b>${recordScore} points</b><small>${escapeHtml(recordWinner)} contre ${escapeHtml(recordLoser)}</small></div></div>`;
}

function remapStatClashRoomSideData(roomState, localPlayer, opponent) {
  const localServerSide = localPlayer?.side || "left";
  const opponentServerSide = opponent?.side || (localServerSide === "left" ? "right" : "left");
  const pickBySide = roomState?.reveal || {};
  const streak = roomState?.streakBySide || {};
  const wins = roomState?.roundsWonBySide || {};
  const jokers = roomState?.jokersBySide || {};
  return {
    localServerSide,
    opponentServerSide,
    usedStatsBySide: {
      left: Array.isArray(roomState?.usedStatKeysBySide?.[localServerSide]) ? roomState.usedStatKeysBySide[localServerSide].slice() : [],
      right: Array.isArray(roomState?.usedStatKeysBySide?.[opponentServerSide]) ? roomState.usedStatKeysBySide[opponentServerSide].slice() : [],
    },
    reveal: {
      left: pickBySide?.[localServerSide] || null,
      right: pickBySide?.[opponentServerSide] || null,
    },
    streakBySide: {
      left: Number(streak[localServerSide]) || 0,
      right: Number(streak[opponentServerSide]) || 0,
    },
    roundsWonBySide: {
      left: Number(wins[localServerSide]) || 0,
      right: Number(wins[opponentServerSide]) || 0,
    },
    jokersBySide: {
      left: jokers[localServerSide] || buildStatClashJokers(),
      right: jokers[opponentServerSide] || buildStatClashJokers(),
    },
    blindRound5OptionsBySide: {
      left: Array.isArray(roomState?.blindRound5OptionsBySide?.[localServerSide]) ? roomState.blindRound5OptionsBySide[localServerSide].slice() : null,
      right: Array.isArray(roomState?.blindRound5OptionsBySide?.[opponentServerSide]) ? roomState.blindRound5OptionsBySide[opponentServerSide].slice() : null,
    },
  };
}

function updateStatClashRoomTimer() {
  const state = statClashState;
  if (!state?.room) return;
  const needsTimer = state.room.status === "starting" || ["rolling", "picking", "locked"].includes(state.room.roundPhase);
  if (!needsTimer) return;
  const intervalId = setStatClashTimerInterval(() => {
    if (!statClashState?.room) return clearTrackedStatClashInterval(intervalId);
    if (statClashState.room.status === "starting") {
      statClashState.timerDurationMs = STAT_CLASH_START_DELAY_MS;
      statClashState.timerLeftMs = Math.max(0, Number(statClashState.room.startedAt || 0) - Date.now());
    } else if (statClashState.room.roundPhase === "rolling") {
      statClashState.timerDurationMs = STAT_CLASH_ROLL_MS;
      statClashState.timerLeftMs = Math.max(0, Number(statClashState.room.rollEndsAt || 0) - Date.now());
    } else if (statClashState.room.roundPhase === "picking") {
      statClashState.timerDurationMs = STAT_CLASH_PICK_TIME_MS;
      statClashState.timerLeftMs = Math.max(0, Number(statClashState.room.deadlineAt || 0) - Date.now());
    } else if (statClashState.room.roundPhase === "locked") {
      statClashState.timerDurationMs = STAT_CLASH_LOCKED_REVEAL_DELAY_MS;
      statClashState.timerLeftMs = Math.max(0, Number(statClashState.room.lockedEndsAt || 0) - Date.now());
    } else {
      return clearTrackedStatClashInterval(intervalId);
    }
    updateStatClashTimerUi();
    if (statClashState.timerLeftMs <= 0) clearTrackedStatClashInterval(intervalId);
  }, 100);
}

function playStatClashRoomRolling(roomState) {
  if (!statClashState || !roomState?.currentPokemon) return;
  resetStatClashRuntime();
  statClashState.phase = "rolling";
  statClashState.timerDurationMs = STAT_CLASH_ROLL_MS;
  statClashState.timerLeftMs = Math.max(0, Number(roomState.rollEndsAt || 0) - Date.now());
  statClashState.randomizerPokemon = roomState.currentPokemon;
  const pool = getStatClashPool();
  const sequence = buildStatClashRandomizerSequence(roomState.currentPokemon, pool);
  runStatClashRandomizer(sequence, roomState.currentPokemon, () => {
    if (!statClashState?.room || statClashState.roomToken !== `${roomState.round}:${roomState.currentPokemon.id}` || statClashState.room.roundPhase !== "rolling") return;
    statClashState.phase = "rolling";
    statClashState.timerDurationMs = STAT_CLASH_ROLL_MS;
    statClashState.timerLeftMs = Math.max(0, Number(roomState.rollEndsAt || 0) - Date.now());
    renderStatClashScreen();
    updateStatClashRoomTimer();
  }, Math.max(200, Number(roomState.rollEndsAt || 0) - Date.now()));
}

function applyStatClashRoomState(roomState) {
  if (!statClashState) return;
  const previousPendingPick = statClashState.players?.left?.pendingPick || null;
  statClashState.mode = "room";
  statClashState.room = roomState;
  statClashState.round = Number(roomState?.round) || 1;
  statClashState.totalRounds = Number(roomState?.totalRounds) || STAT_CLASH_ROUND_TOTAL;
  statClashState.currentPokemon = roomState?.currentPokemon || null;
  statClashState.revealStats = roomState?.revealStats || null;
  const localPlayer = roomState?.players?.find((player) => player.isSelf) || null;
  const opponent = roomState?.players?.find((player) => !player.isSelf) || null;
  const mappedRoomSides = remapStatClashRoomSideData(roomState, localPlayer, opponent);
  statClashState.usedStatsBySide = mappedRoomSides.usedStatsBySide;
  statClashState.reveal = roomState?.reveal ? mappedRoomSides.reveal : null;
  statClashState.streakBySide = mappedRoomSides.streakBySide || { left: 0, right: 0 };
  statClashState.roundsWonBySide = mappedRoomSides.roundsWonBySide || { left: 0, right: 0 };
  statClashState.jokersBySide = {
    left: {
      reroll: Number(mappedRoomSides.jokersBySide.left.reroll) || 0,
      preview: Number(mappedRoomSides.jokersBySide.left.preview) || 0,
      double: Number(mappedRoomSides.jokersBySide.left.double) || 0,
      doubleArmed: Boolean(mappedRoomSides.jokersBySide.left.doubleArmed),
      previewKey: mappedRoomSides.jokersBySide.left.previewKey || null,
    },
    right: {
      reroll: Number(mappedRoomSides.jokersBySide.right.reroll) || 0,
      preview: Number(mappedRoomSides.jokersBySide.right.preview) || 0,
      double: Number(mappedRoomSides.jokersBySide.right.double) || 0,
      doubleArmed: Boolean(mappedRoomSides.jokersBySide.right.doubleArmed),
      previewKey: mappedRoomSides.jokersBySide.right.previewKey || null,
    },
  };
  statClashState.houseRule = roomState?.houseRule || null;
  statClashState.houseRuleBySide = roomState?.houseRuleBySide || { left: null, right: null };
  statClashState.houseRuleShared = roomState?.houseRuleShared || null;
  statClashState.houseRuleSharedEnabled = Boolean(roomState?.houseRuleSharedEnabled);
  statClashState.pendingImposedRuleBySide = roomState?.pendingImposedRuleBySide || { left: null, right: null };
  statClashState.houseRuleEnabled = roomState?.houseRuleEnabled !== false;
  statClashState.doubleStatKey = roomState?.doubleStatKey || null;
  statClashState.mirrorStatKey = roomState?.mirrorStatKey || null;
  statClashState.blindRound5OptionsBySide = mappedRoomSides.blindRound5OptionsBySide || { left: null, right: null };
  statClashState.houseRuleTargetSide = roomState?.houseRuleTargetSide || null;
  statClashState.format = roomState?.format || "standard";
  statClashState.suddenDeath = Boolean(roomState?.suddenDeath);
  statClashState.currentStats = roomState?.revealStats || null;
  statClashState.players.left = createStatClashPlayer("left", localPlayer?.nickname || statClashState.players.left.label || "Joueur 1");
  statClashState.players.right = createStatClashPlayer("right", opponent?.nickname || "Adversaire");
  statClashState.players.left.score = localPlayer?.score || 0;
  statClashState.players.left.displayScore = localPlayer?.score || 0;
  statClashState.players.left.history = Array.isArray(localPlayer?.history) ? localPlayer.history.slice() : [];
  statClashState.players.left.pendingPick = localPlayer?.pendingPickKey
    ? { key: localPlayer.pendingPickKey, auto: false }
    : roomState?.roundPhase === "picking" && previousPendingPick?.key
      ? previousPendingPick
      : null;
  statClashState.players.right.score = opponent?.score || 0;
  statClashState.players.right.displayScore = opponent?.score || 0;
  statClashState.players.right.history = Array.isArray(opponent?.history) ? opponent.history.slice() : [];
  statClashState.players.right.pendingPick = opponent?.hasLockedPick ? { key: null, auto: false } : null;
  if (!statClashState.roomNameDraft && localPlayer?.nickname) statClashState.roomNameDraft = localPlayer.nickname;
  if (roomState?.code) statClashState.roomJoinCode = roomState.code;
  statClashState.roomPendingAction = "";
  const nextToken = roomState?.currentPokemon ? `${roomState.round}:${roomState.currentPokemon.id}` : "";
  const isNewRound = nextToken && nextToken !== statClashState.roomToken;
  statClashState.roomToken = nextToken;
  statClashState.statusText = roomState?.status === "lobby"
    ? roomState?.canStart ? "Room complète. En attente du lancement par l'hôte." : "En attente d'un autre joueur."
    : roomState?.status === "starting"
      ? "Le match démarre dans un instant."
      : roomState?.roundPhase === "picking"
        ? (localPlayer?.pendingPickKey ? "Choix verrouillé. En attente du choix adverse." : "Choisis une stat. La stat adverse reste cachée jusqu'au reveal.")
        : roomState?.roundPhase === "reveal"
          ? "Révélation des choix."
          : roomState?.status === "finished"
            ? "Partie terminée."
            : roomState?.roundPhase === "rolling"
              ? "Le Pokémon apparaît… prépare ton choix."
              : roomState?.status === "live"
                ? "Randomizer en cours."
              : "Lobby room en attente.";
  if (roomState?.status === "starting") {
    statClashState.phase = "starting-countdown";
    statClashState.timerDurationMs = STAT_CLASH_START_DELAY_MS;
    statClashState.timerLeftMs = Math.max(0, Number(roomState.startedAt || 0) - Date.now());
    statClashState.randomizerPokemon = null;
  } else if (roomState?.roundPhase === "rolling") {
    statClashState.phase = "rolling";
    statClashState.timerDurationMs = STAT_CLASH_ROLL_MS;
    statClashState.timerLeftMs = Math.max(0, Number(roomState.rollEndsAt || 0) - Date.now());
    statClashState.randomizerPokemon = roomState.currentPokemon || null;
  } else if (roomState?.roundPhase === "picking") {
    statClashState.phase = localPlayer?.pendingPickKey ? "locked" : "picking";
    statClashState.timerDurationMs = STAT_CLASH_PICK_TIME_MS;
    statClashState.timerLeftMs = Math.max(0, Number(roomState.deadlineAt || 0) - Date.now());
  } else if (roomState?.roundPhase === "locked") {
    statClashState.phase = "locked";
    statClashState.timerDurationMs = STAT_CLASH_LOCKED_REVEAL_DELAY_MS;
    statClashState.timerLeftMs = Math.max(0, Number(roomState.lockedEndsAt || 0) - Date.now());
    statClashState.randomizerPokemon = roomState.currentPokemon || null;
  }
  renderStatClashScreen();
  if (roomState?.status === "starting") {
    updateStatClashRoomTimer();
  }
  if (roomState?.roundPhase === "rolling" && isNewRound) playStatClashRoomRolling(roomState);
  if (roomState?.roundPhase === "rolling" && !isNewRound) {
    updateStatClashRoomTimer();
  }
  if (roomState?.roundPhase === "picking") {
    updateStatClashRoomTimer();
  }
  if (roomState?.roundPhase === "locked") {
    updateStatClashRoomTimer();
  }
  if (roomState?.roundPhase === "reveal") {
    statClashState.phase = "reveal";
    statClashState.timerLeftMs = 0;
    statClashState.randomizerPokemon = roomState.currentPokemon || null;
    renderStatClashScreen();
  }
  if (roomState?.status === "finished") {
    statClashState.phase = "finished";
    statClashState.timerLeftMs = 0;
    statClashState.randomizerPokemon = roomState.currentPokemon || null;
    renderStatClashScreen();
  }
}

function createStatClashRoom() {
  if (!statClashState) return;
  if (statClashState.room?.code) {
    setStatClashRoomFeedback(`Room déjà créée : ${statClashState.room.code}`, "info");
    return renderStatClashScreen();
  }
  const socket = ensureMultiplayerSocket();
  if (!socket) {
    setStatClashRoomFeedback("Connexion temps réel indisponible.", "error");
    return renderStatClashScreen();
  }
  const nicknameInput = document.getElementById("stat-clash-nickname");
  const nicknameDraft = String(nicknameInput?.value || statClashState.roomNameDraft || playerProfile.nickname || "").trim();
  const nickname = nicknameDraft || "Joueur 1";
  statClashState.roomNameDraft = nicknameDraft;
  statClashState.players.left.label = nickname;
  if (statClashState.room?.code) {
    socket.emit("stat-clash:leave-room");
  }
  statClashState.room = null;
  statClashState.roomToken = "";
  statClashState.phase = "idle";
  statClashState.roomPendingAction = "creating";
  setStatClashRoomFeedback("Création de la room…", "info");
  console.debug("[stat-clash][client][create-room] emit", { nickname, selectedGens: [...selectedGens].sort((a, b) => a - b) });
  renderStatClashScreen();
  socket.emit("stat-clash:create-room", {
    nickname,
    selectedGens: [...selectedGens].sort((a, b) => a - b),
    houseRuleSharedEnabled: Boolean(statClashState.houseRuleSharedEnabled),
  }, (response = {}) => {
    console.debug("[stat-clash][client][create-room] ack", response);
    statClashState && (statClashState.roomPendingAction = "");
    if (!response.ok) {
      setStatClashRoomFeedback(response.error || "Impossible de créer la room Stat Clash.", "error");
      return renderStatClashScreen();
    }
    applyStatClashRoomState(response.room);
    setStatClashRoomFeedback(`Room créée : ${response.code || response.room?.code || ""}`, "success");
    renderStatClashScreen();
  });
}

function joinStatClashRoom() {
  console.debug("[stat-clash][client][join-room] handler-start");
  if (!statClashState) return;
  const socket = ensureMultiplayerSocket();
  if (!socket) {
    setStatClashRoomFeedback("Connexion temps réel indisponible.", "error");
    return renderStatClashScreen();
  }
  const nicknameInput = document.getElementById("stat-clash-nickname");
  const codeInput = document.getElementById("stat-clash-room-input");
  const nicknameDraft = String(nicknameInput?.value || statClashState.roomNameDraft || playerProfile.nickname || "").trim();
  const liveCode = String(codeInput?.value || statClashState.roomCodeDraft || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  statClashState.roomNameDraft = nicknameDraft;
  statClashState.roomCodeDraft = liveCode;
  statClashState.roomJoinCode = liveCode;
  if (codeInput && codeInput.value !== liveCode) codeInput.value = liveCode;
  const nickname = nicknameDraft || "Joueur 1";
  statClashState.players.left.label = nickname;
  if (!liveCode) {
    setStatClashRoomFeedback("Entre un code room valide avant de rejoindre.", "error");
    return renderStatClashScreen();
  }
  if (statClashState.room?.code) {
    socket.emit("stat-clash:leave-room");
  }
  statClashState.room = null;
  statClashState.roomToken = "";
  statClashState.phase = "idle";
  statClashState.roomPendingAction = "joining";
  setStatClashRoomFeedback(`Connexion à ${liveCode}…`, "info");
  console.debug("[stat-clash][client][join-room] emit", { nickname, code: liveCode });
  renderStatClashScreen();
  socket.emit("stat-clash:join-room", {
    nickname,
    code: liveCode,
  }, (response = {}) => {
    console.debug("[stat-clash][client][join-room] ack", response);
    statClashState && (statClashState.roomPendingAction = "");
    if (!response.ok) {
      setStatClashRoomFeedback(response.error || "Impossible de rejoindre la room Stat Clash.", "error");
      return renderStatClashScreen();
    }
    applyStatClashRoomState(response.room);
    setStatClashRoomFeedback(`Room rejointe : ${response.code || response.room?.code || ""}`, "success");
    renderStatClashScreen();
  });
}

function leaveStatClashRoom(resetOnly = false) {
  if (multiplayerSocket?.connected && statClashState?.room?.code) multiplayerSocket.emit("stat-clash:leave-room");
  if (!statClashState) return;
  statClashState.room = null;
  statClashState.roomToken = "";
  statClashState.roomPendingAction = "";
  if (resetOnly) {
    prepareStatClashBotLobby();
    return renderStatClashScreen();
  }
  statClashState.mode = "room";
  statClashState.phase = "idle";
  statClashState.round = 1;
  statClashState.usedStatsBySide = { left: [], right: [] };
  statClashState.currentPokemon = null;
  statClashState.randomizerPokemon = null;
  statClashState.reveal = null;
  statClashState.revealStats = null;
  statClashState.timerLeftMs = STAT_CLASH_PICK_TIME_MS;
  statClashState.players.left = createStatClashPlayer("left", statClashState.players.left.label || "Joueur 1");
  statClashState.players.right = createStatClashPlayer("right", "Adversaire en attente");
  statClashState.roomJoinCode = "";
  statClashState.roomCodeDraft = "";
  statClashState.pendingImposedRuleBySide = { left: null, right: null };
  statClashState.houseRuleBySide = { left: null, right: null };
  statClashState.houseRuleShared = null;
  statClashState.blindRound5OptionsBySide = { left: null, right: null };
  setStatClashRoomFeedback("Room quittée. Tu peux en créer une autre ou rejoindre un code.", "info");
  renderStatClashScreen();
}

function copyStatClashRoomCode() {
  const code = statClashState?.room?.code;
  if (!code) return;
  navigator.clipboard?.writeText(code)
    .then(() => {
      setStatClashRoomFeedback(`Code copié : ${code}`, "success");
      renderStatClashScreen();
    })
    .catch(() => {
      setStatClashRoomFeedback(`Impossible de copier automatiquement. Code : ${code}`, "error");
      renderStatClashScreen();
    });
}

function restartStatClashRoom() {
  if (!statClashState?.room?.code || !multiplayerSocket?.connected) return;
  multiplayerSocket.emit("stat-clash:restart-round", { selectedGens: [...selectedGens].sort((a, b) => a - b) }, (response = {}) => {
    if (!response.ok) return showToast(response.error || "Impossible de relancer la partie.");
    applyStatClashRoomState(response.room);
    const self = response.room?.players?.find((p) => p.isSelf);
    if (self?.isHost && response.room?.canStart) startStatClashRoomGame();
  });
}

function startStatClashRoomGame() {
  if (!statClashState?.room?.code || !multiplayerSocket?.connected) return;
  statClashState.roomPendingAction = "starting";
  setStatClashRoomFeedback("Lancement par l'hôte…", "info");
  statClashState.phase = "starting-countdown";
  statClashState.timerDurationMs = STAT_CLASH_START_DELAY_MS;
  statClashState.timerLeftMs = STAT_CLASH_START_DELAY_MS;
  renderStatClashScreen();
  multiplayerSocket.emit("stat-clash:start-game", {}, (response = {}) => {
    if (statClashState) statClashState.roomPendingAction = "";
    if (!response.ok) {
      setStatClashRoomFeedback(response.error || "Impossible de lancer la partie.", "error");
      return renderStatClashScreen();
    }
    applyStatClashRoomState(response.room);
    setStatClashRoomFeedback("Synchronisation en cours…", "success");
    renderStatClashScreen();
  });
}

function pickStatClashStat(side, statKey, auto = false) {
  const state = statClashState;
  if (!state || side !== "left") return;
  if (state.mode === "room") {
    if (!state.room || state.phase !== "picking" || state.players.left.pendingPick || state.usedStatsBySide.left.includes(statKey)) return;
    const allowedRoom = getStatClashAllowedStats(state, "left");
    if (allowedRoom.length && !allowedRoom.includes(statKey)) return;
    state.players.left.pendingPick = { key: statKey, auto };
    state.players.left.lockedAt = Date.now();
    renderStatClashScreen();
    return multiplayerSocket?.emit("stat-clash:submit-pick", { statKey }, (response = {}) => {
      if (response.ok) return;
      if (statClashState?.players?.left?.pendingPick?.key === statKey) {
        statClashState.players.left.pendingPick = null;
        statClashState.players.left.lockedAt = null;
        renderStatClashScreen();
      }
      showToast(response.error || "Impossible de verrouiller ce choix.");
    });
  }
  if (state.phase !== "picking" || state.players.left.pendingPick || state.usedStatsBySide.left.includes(statKey)) return;
  // Enforce house rule allowed-stats
  const allowed = getStatClashAllowedStats(state, "left");
  if (allowed.length && !allowed.includes(statKey)) return;
  state.players.left.pendingPick = { key: statKey, auto };
  state.players.left.lockedAt = Date.now();
  renderStatClashScreen();
  maybeResolveLocalStatClashRound();
}

function switchStatClashMode(mode) {
  if (!statClashState || statClashState.mode === mode) return;
  if (mode === "room") {
    resetStatClashRuntime();
    statClashState.mode = "room";
    statClashState.phase = "idle";
    statClashState.round = 1;
    statClashState.usedStatsBySide = { left: [], right: [] };
    statClashState.room = null;
    statClashState.roomToken = "";
    statClashState.currentPokemon = null;
    statClashState.currentStats = null;
    statClashState.randomizerPokemon = null;
    statClashState.reveal = null;
    statClashState.revealStats = null;
    statClashState.resolvePending = false;
    statClashState.timerLeftMs = STAT_CLASH_PICK_TIME_MS;
    statClashState.timerDurationMs = STAT_CLASH_PICK_TIME_MS;
    statClashState.roomJoinCode = "";
    statClashState.roomCodeDraft = "";
    statClashState.pendingImposedRuleBySide = { left: null, right: null };
    statClashState.houseRuleBySide = { left: null, right: null };
    statClashState.houseRuleShared = null;
    statClashState.blindRound5OptionsBySide = { left: null, right: null };
    statClashState.players.left = createStatClashPlayer("left", statClashState.players.left.label || "Joueur 1");
    statClashState.players.right = createStatClashPlayer("right", "Adversaire en attente");
    setStatClashRoomFeedback("Crée une room pour inviter un autre joueur.", "info");
    ensureMultiplayerSocket();
    return renderStatClashScreen();
  }
  leaveStatClashRoom(true);
}

function renderStatClashScreen() {
  const root = document.getElementById("stat-clash-root");
  if (!root) return;
  bindStatClashInteractions();
  if (!statClashState) return (root.innerHTML = '<p class="card-desc">Mode en attente.</p>');
  const state = statClashState;
  const isRoom = state.mode === "room";
  const room = state.room;
  const roomUi = isRoom ? getStatClashRoomUiState(state) : null;
  const isBotLobby = !isRoom && state.phase === "idle" && !state.currentPokemon && !state.randomizerPokemon;
  const roomBusy = Boolean(state.roomPendingAction);
  const roomIsLive = isRoom && room?.status === "live";
  const roomIsLobby = isRoom && (!room || room.status === "lobby");
  const roomHasStarted = isRoom && !!room?.code && room.status !== "lobby";
  const selfRoomPlayer = isRoom ? room?.players?.find((player) => player.isSelf) || null : null;
  const roomPlayersHtml = isRoom
    ? (room?.players?.length
      ? room.players
        .slice()
        .sort((left, right) => (Number(left.seatIndex) || 0) - (Number(right.seatIndex) || 0))
        .map((player, index) => `<div class="stat-clash-room-player ${player.connected ? "is-connected" : "is-disconnected"}"><div><strong>${escapeHtml(player.nickname || `Joueur ${index + 1}`)}</strong><small>${player.connected ? "Connecté" : "En attente"}</small></div><span class="stat-clash-room-player-badges">${player.isHost ? '<span class="stat-clash-room-badge is-host">Host</span>' : ""}${player.isSelf ? '<span class="stat-clash-room-badge is-self">Toi</span>' : '<span class="stat-clash-room-badge is-guest">Invité</span>'}</span></div>`).join("")
      : '<div class="stat-clash-room-player is-empty"><div><strong>Joueur 1</strong><small>En attente</small></div></div>')
    : "";
  const roomMetaHtml = isRoom ? renderStatClashRoomMeta(room) : "";
  const roomMetaPanelHtml = roomMetaHtml ? `<div class="stat-clash-room-meta-panel">${roomMetaHtml}</div>` : "";
  const localServerSide = isRoom ? selfRoomPlayer?.side || "left" : "left";
  const opponentServerSide = isRoom ? getOppositeStatClashSide(localServerSide) || "right" : "right";
  const imposedRuleId = state.pendingImposedRuleBySide?.[localServerSide] || null;
  const sufferedRuleId = state.pendingImposedRuleBySide?.[opponentServerSide] || null;
  const imposedRule = getStatClashRuleById(imposedRuleId);
  const sufferedRule = getStatClashRuleById(sufferedRuleId);
  const activeImposedRule = isRoom ? state.houseRuleBySide?.[opponentServerSide] : state.houseRuleBySide?.right;
  const activeSufferedRule = isRoom ? state.houseRuleBySide?.[localServerSide] : state.houseRuleBySide?.left;
  const sharedRule = state.houseRuleShared || state.houseRule || null;
  const renderRuleBadge = (label, rule, cls = "") => rule
    ? `<span class="tag-gen stat-clash-rule-tag ${cls}" title="${escapeHtml(rule.desc || "")}">${escapeHtml(label)} : ${rule.icon || "📜"} ${escapeHtml(rule.label)}</span>`
    : "";
  const renderImposedRulePicker = () => {
    if (!state.houseRuleEnabled) return "";
    const selected = isRoom ? imposedRuleId : state.pendingImposedRuleBySide?.left;
    const lockedByOpponentId = isRoom ? sufferedRuleId : null;
    return `<section class="stat-clash-imposed-rules"><div class="stat-clash-imposed-rules-head"><div><strong>Règle à imposer</strong><small>${isRoom ? "Choisis le handicap que l'adversaire subira." : "Choisis le handicap du bot. Le bot t'en imposera un au hasard."}</small></div>${selected ? `<span>Choisie</span>` : `<span>À choisir</span>`}</div><div class="stat-clash-rule-grid">${STAT_CLASH_HOUSE_RULES.filter((rule) => STAT_CLASH_IMPOSABLE_RULE_IDS.has(rule.id)).map((rule) => {
      const isLockedByOpponent = lockedByOpponentId && rule.id === lockedByOpponentId;
      const cls = `stat-clash-rule-card ${selected === rule.id ? "is-selected" : ""} ${isLockedByOpponent ? "is-locked-by-opponent" : ""}`;
      const lockedNote = isLockedByOpponent ? `<small class="stat-clash-rule-locked-note">🔒 prise par l'adversaire</small>` : "";
      return `<button type="button" class="${cls}" ${isLockedByOpponent ? "disabled" : ""} data-action="selectStatClashImposedRule" data-args='["${rule.id}"]'><b>${rule.icon || "📜"} ${escapeHtml(rule.label)}</b><small>${escapeHtml(rule.desc)}</small>${lockedNote}</button>`;
    }).join("")}</div>${isRoom ? `<div class="stat-clash-rule-summary"><span>Tu imposes : <b>${escapeHtml(imposedRule?.label || "à choisir")}</b></span><span>Tu subis : <b>${escapeHtml(sufferedRule?.label || "en attente")}</b></span></div>` : ""}</section>`;
  };
  const current = roomHasStarted || !isRoom ? (state.randomizerPokemon || state.currentPokemon) : null;
  const currentSprite = current ? getPokemonSprite(current) : "";
  const timerDuration = Math.max(1, Number(state.timerDurationMs) || STAT_CLASH_PICK_TIME_MS);
  const timerPct = Math.max(0, Math.min(100, (state.timerLeftMs / timerDuration) * 100));
  const winnerKey = state.phase === "finished"
    ? state.finalWinnerSide || (state.players.left.score === state.players.right.score ? "tie" : state.players.left.score > state.players.right.score ? "left" : "right")
    : null;
  const activeRuleBadges = `${renderRuleBadge("Tu imposes", activeImposedRule, "is-imposed")}${renderRuleBadge("Tu subis", activeSufferedRule, "is-suffered")}${state.houseRuleSharedEnabled && sharedRule ? renderRuleBadge("Commune", sharedRule, "is-shared") : ""}`;
  const toplineHtml = isRoom && roomIsLobby
    ? `<span class="tag-gen">Lobby Room 1v1</span><span class="tag-tries">Joueurs connectés : <b>${Number(room?.connectedCount || room?.players?.filter((player) => player.connected).length || 0)}/${Number(room?.maxPlayers || 2)}</b></span><span class="tag-gen stat-clash-rule-tag">${escapeHtml(roomUi?.detail || "En attente de la room.")}</span>`
    : isBotLobby
      ? `<span class="tag-gen">Stat Clash</span><span class="tag-tries">Mode : <b>Vs Bot</b></span><span class="tag-gen stat-clash-rule-tag">Choisis Bot ou Room avant de lancer.</span>`
    : `<span class="tag-gen">Manche ${state.round} / ${state.totalRounds}</span><span class="tag-tries">Tes stats restantes : <b>${state.suddenDeath ? STAT_CLASH_STATS.length : STAT_CLASH_STATS.length - state.usedStatsBySide.left.length}</b></span>${activeRuleBadges || `<span class="tag-gen stat-clash-rule-tag">${state.suddenDeath ? "Sudden Death" : "Stats secrètes jusqu'au reveal."}</span>`}`;
  const remainingHtml = STAT_CLASH_STATS.map((entry) => `<span class="stat-clash-remaining-chip ${state.usedStatsBySide.left.includes(entry.key) ? "is-used" : ""}">${escapeHtml(entry.label)}</span>`).join("");
  const revealStatsHtml = state.revealStats
    ? `<div class="stat-clash-reveal-stats">${STAT_CLASH_STATS.map((entry) => {
        const leftPick = state.reveal?.left?.key === entry.key;
        const rightPick = state.reveal?.right?.key === entry.key;
        const picked = leftPick || rightPick;
        const flipSide = leftPick && rightPick ? "both" : leftPick ? "left" : rightPick ? "right" : "";
        const icon = STAT_CLASH_STAT_ICONS[entry.key] || "";
        return `<div class="stat-clash-reveal-stat ${picked ? "is-picked" : ""} ${flipSide ? `flip-${flipSide}` : ""}" data-stat-key="${entry.key}"><span><i class="stat-icon">${icon}</i> ${escapeHtml(entry.label)}</span><b>${getStatClashValue(entry.key, state.revealStats)}</b></div>`;
      }).join("")}</div>`
    : "";
  const renderPlayerCard = (side, player, isOpponent = false) => {
    const historyHtml = player.history.length
      ? player.history.map((entry) => {
          const comboChip = entry.comboBonus > 0 ? `<span class="stat-clash-bonus-chip is-combo">+${entry.comboBonus} combo</span>` : "";
          const comebackChip = entry.comebackBonus > 0 ? `<span class="stat-clash-bonus-chip is-comeback">+${entry.comebackBonus} comeback</span>` : "";
          return `<div class="stat-clash-history-item"><span>Manche ${entry.round}</span><b>${escapeHtml(entry.statLabel)} +${entry.value}</b><small>${escapeHtml(entry.pokemonName)}${entry.auto ? " • auto" : ""}</small>${comboChip || comebackChip ? `<div class="stat-clash-bonus-chips">${comboChip}${comebackChip}</div>` : ""}</div>`;
        }).join("")
      : '<p class="card-desc stat-clash-empty">Aucun pick pour le moment.</p>';
    const allowedLeft = new Set(getStatClashAllowedStats(state, "left"));
    const forcedByHouseRule = getStatClashHouseRuleForcedStats(state, "left");
    const previewKey = state.jokersBySide?.left?.previewKey || null;
    const previewValue = previewKey ? getStatClashValue(previewKey, state.currentStats) : null;
    const buttonsHtml = isOpponent || state.phase !== "picking"
      ? ""
      : STAT_CLASH_STATS.map((entry) => {
          const isUsed = state.usedStatsBySide.left.includes(entry.key) && !state.suddenDeath;
          const isSelected = state.players.left.pendingPick?.key === entry.key;
          const isAllowed = allowedLeft.has(entry.key);
          const isForced = Array.isArray(forcedByHouseRule) && forcedByHouseRule.length === 1 && forcedByHouseRule[0] === entry.key;
          const isLockedByRule = !isAllowed && !isUsed;
          const disabled = isUsed || isLockedByRule || state.players.left.pendingPick;
          const cls = ["stat-clash-stat-btn"];
          if (isSelected) cls.push("is-selected");
          if (isUsed) cls.push("is-used");
          if (isLockedByRule) cls.push("is-locked-rule");
          if (isForced) cls.push("is-forced");
          cls.push(`stat-${entry.key}`);
          const icon = STAT_CLASH_STAT_ICONS[entry.key] || "";
          let valueHtml = `<b>Secret</b>`;
          if (previewKey === entry.key) {
            valueHtml = (Number.isFinite(previewValue) && previewValue > 0) ? `<b class="stat-preview-value">${previewValue}</b>` : `<b class="stat-preview-value">vu</b>`;
          }
          return `<button type="button" class="${cls.join(" ")}" data-stat-key="${entry.key}" ${disabled ? "disabled" : ""} data-action="pickStatClashStat" data-args='["left","${entry.key}"]'><span><i class="stat-icon">${icon}</i> ${escapeHtml(entry.label)}</span>${valueHtml}</button>`;
        }).join("");
    const jokersHtml = !isOpponent && state.phase === "picking"
      ? (() => {
          const j = state.jokersBySide?.left || { reroll: 0, preview: 0, double: 0, doubleArmed: false };
          const disabledAttr = (n) => (n > 0 && !state.players.left.pendingPick) ? "" : "disabled";
          return `<div class="stat-clash-jokers">
            <button type="button" class="stat-clash-joker ${j.reroll > 0 ? "" : "is-spent"}" ${disabledAttr(j.reroll)} data-action="useStatClashJoker" data-args='["left","reroll"]' title="Reroll : change le Pokémon"><i>🔄</i><span>Reroll</span><small>${j.reroll}</small></button>
            <button type="button" class="stat-clash-joker ${j.preview > 0 ? "" : "is-spent"}" ${disabledAttr(j.preview)} data-action="useStatClashJoker" data-args='["left","preview"]' title="Aperçu : révèle 1 stat aléatoire 2s"><i>👁</i><span>Aperçu</span><small>${j.preview}</small></button>
            <button type="button" class="stat-clash-joker ${j.doubleArmed ? "is-armed" : j.double > 0 ? "" : "is-spent"}" ${j.doubleArmed ? "disabled" : disabledAttr(j.double)} data-action="useStatClashJoker" data-args='["left","double"]' title="Double : x2 si tu gagnes la manche, 0 si tu perds"><i>×2</i><span>Double</span><small>${j.doubleArmed ? "ON" : j.double}</small></button>
          </div>`;
        })()
      : "";
    const streakLeft = state.streakBySide?.left || 0;
    const streakRight = state.streakBySide?.right || 0;
    const sideStreak = side === "left" ? streakLeft : streakRight;
    const streakBadge = sideStreak >= 2 ? `<span class="stat-clash-streak-badge streak-${Math.min(sideStreak, 5)}">🔥 STREAK x${sideStreak}</span>` : "";
    const statusText = isOpponent
      ? state.phase === "reveal" || state.phase === "finished"
        ? (state.reveal?.right ? `${escapeHtml(state.reveal.right.statLabel)} +${state.reveal.right.value}` : "Aucun choix")
        : state.players.right.pendingPick
          ? "Choix verrouillé (caché)"
          : isRoom && !room?.code
            ? "Aucune room active"
            : isRoom && room?.status === "waiting"
              ? "En attente d'un adversaire"
            : "Choix secret en cours"
      : state.players.left.pendingPick?.key
        ? `Ton choix est verrouillé : ${escapeHtml(getStatClashStatDef(state.players.left.pendingPick.key).label)}`
        : isRoom && state.phase === "locked"
          ? "Choix verrouillé. En attente du choix adverse."
        : isRoom && room?.roundPhase === "picking"
          ? "Choisis une stat puis attends le lock adverse."
          : isRoom && room?.status === "starting"
            ? "Démarrage synchronisé en cours."
          : isRoom && room?.roundPhase === "rolling"
            ? "Le Pokémon se révèle, prépare ton choix."
          : state.phase === "picking"
          ? "Choisis une stat sans voir les valeurs."
          : isRoom
            ? "Lobby room prêt."
            : "En attente du prochain reveal.";
    const lastEntry = player.history.length ? player.history[player.history.length - 1] : null;
    const hasBonusFlash = lastEntry && lastEntry.round === state.round && (lastEntry.comboBonus > 0 || lastEntry.comebackBonus > 0) && (state.phase === "scoring" || state.phase === "reveal" || state.phase === "post-reveal");
    return `<section class="stat-clash-player-card side-${side} ${winnerKey === side ? "is-winner" : ""} ${hasBonusFlash ? "has-bonus-pulse" : ""}" data-bonus-round="${hasBonusFlash ? state.round : ""}"><div class="stat-clash-player-head"><div><p class="stat-clash-player-side">${isOpponent ? (isRoom ? "Room 1v1" : "Bot") : "Toi"}</p><h3>${escapeHtml(player.label)} ${streakBadge}</h3></div><div class="stat-clash-score-box ${state.phase === "scoring" ? "is-animating" : ""}"><span>Total</span><b>${Math.round(player.displayScore || 0)}</b>${state.reveal?.[side] ? `<small>${escapeHtml(state.reveal[side].statLabel)} +${state.reveal[side].value}</small>` : ""}</div></div><div class="stat-clash-player-copy"><p class="stat-clash-player-status">${statusText}</p></div>${buttonsHtml ? `<div class="stat-clash-stat-grid">${buttonsHtml}</div>` : ""}${jokersHtml}<div class="stat-clash-history-block"><h4>Historique</h4><div class="stat-clash-history-list">${historyHtml}</div></div></section>`;
  };
  const roomControls = isRoom
    ? room?.code
      ? roomHasStarted
        ? `<section class="stat-clash-room-panel is-compact"><div class="stat-clash-room-summary"><span><b>Room :</b> ${escapeHtml(room.code)}</span><span><b>Joueurs :</b> ${Number(room.connectedCount || room.players?.filter((player) => player.connected).length || 0)}/${Number(room.maxPlayers || 2)}</span><span><b>Statut :</b> ${escapeHtml(room.status === "starting" ? "Countdown" : room.roundPhase === "rolling" ? "Préparation" : room.roundPhase === "picking" ? "Choix" : room.roundPhase === "locked" ? "Verrouillé" : room.roundPhase === "reveal" ? "Reveal" : room.status === "finished" ? "Terminé" : "Live")}</span></div><div class="stat-clash-room-presence is-compact">${roomPlayersHtml}</div><div class="stat-clash-room-actions"><button class="btn-ghost" type="button" data-stat-clash-action="copy-room">Copier</button><button class="btn-ghost" type="button" data-stat-clash-action="leave-room">Quitter</button></div>${state.roomFeedback ? `<span class="stat-clash-room-feedback ${escapeHtml(state.roomFeedbackTone || "info")}">${escapeHtml(state.roomFeedback)}</span>` : ""}</section>`
        : `<section class="stat-clash-room-panel"><div class="stat-clash-room-status ${escapeHtml(roomUi?.tone || "is-idle")}"><div><strong>${escapeHtml(roomUi?.title || "Room 1v1")}</strong><small>${escapeHtml(roomUi?.detail || "Crée une room pour inviter un autre joueur.")}</small></div>${state.roomFeedback ? `<span class="stat-clash-room-feedback ${escapeHtml(state.roomFeedbackTone || "info")}">${escapeHtml(state.roomFeedback)}</span>` : ""}</div><div class="stat-clash-room-summary"><span><b>Room :</b> ${escapeHtml(room.code)}</span><span><b>Joueurs :</b> ${Number(room.connectedCount || room.players?.filter((player) => player.connected).length || 0)}/${Number(room.maxPlayers || 2)}</span><span><b>Statut :</b> ${escapeHtml(room.status === "starting" ? "Lancement..." : room.canStart ? "Prête" : "En attente")}</span></div><div class="stat-clash-room-presence">${roomPlayersHtml}</div><div class="stat-clash-room-actions"><button class="btn-ghost" type="button" data-stat-clash-action="copy-room">Copier</button><button class="btn-ghost" type="button" data-stat-clash-action="leave-room">Quitter</button>${selfRoomPlayer?.isHost ? `<button class="btn-red" type="button" data-stat-clash-action="start-room" ${roomBusy || !room?.canStart || room?.status === "live" || room?.status === "starting" ? "disabled" : ""}>${room?.status === "starting" ? "Lancement…" : "Lancer la partie"}</button>` : ""}</div>${!selfRoomPlayer?.isHost && room?.canStart && room?.status === "lobby" ? '<p class="card-desc stat-clash-room-waiting">En attente du lancement par l’hôte.</p>' : ""}</section>`
      : `<section class="stat-clash-room-panel"><div class="stat-clash-room-toolbar"><div class="stat-clash-room-row"><input id="stat-clash-nickname" class="stat-clash-room-input" type="text" maxlength="24" value="${escapeHtml(state.roomNameDraft || "")}" placeholder="Ton pseudo" data-input-action="syncStatClashNickname" ${roomBusy ? "disabled" : ""} /><button class="btn-blue" type="button" data-stat-clash-action="create-room" ${roomBusy ? "disabled" : ""}>${state.roomPendingAction === "creating" ? "Création…" : "Créer"}</button></div><div class="stat-clash-room-row"><input id="stat-clash-room-input" class="stat-clash-room-input stat-clash-room-code-input" type="text" maxlength="6" value="${escapeHtml(state.roomCodeDraft || "")}" placeholder="Code de room" data-input-action="syncStatClashJoinCode" ${roomBusy ? "disabled" : ""} /><button class="btn-ghost" type="button" data-stat-clash-action="join-room" ${roomBusy ? "disabled" : ""}>${state.roomPendingAction === "joining" ? "Connexion…" : "Rejoindre"}</button></div></div><div class="stat-clash-room-status ${escapeHtml(roomUi?.tone || "is-idle")}"><div><strong>${escapeHtml(roomUi?.title || "Room 1v1")}</strong><small>${escapeHtml(roomUi?.detail || "Crée une room pour inviter un autre joueur.")}</small></div>${state.roomFeedback ? `<span class="stat-clash-room-feedback ${escapeHtml(state.roomFeedbackTone || "info")}">${escapeHtml(state.roomFeedback)}</span>` : ""}</div></section>`
    : "";
  const lobbyCenterHtml = isBotLobby
    ? `<div class="stat-clash-lobby-center stat-clash-bot-lobby"><div class="stat-clash-lobby-center-head"><span>Vs Bot</span><strong>Prêt à jouer</strong></div><div class="stat-clash-lobby-center-body"><div class="stat-clash-sprite-placeholder">?</div><h3>${escapeHtml(state.statusText || "Lance une partie ou passe en Room 1v1.")}</h3><p>Tu peux régler le format, la difficulté et la règle maison avant le départ.</p><button class="btn-red" type="button" data-stat-clash-action="start-bot">Lancer vs bot</button></div></div>`
    : isRoom && roomIsLobby
    ? `<div class="stat-clash-lobby-center"><div class="stat-clash-lobby-center-head"><span>Lobby Room 1v1</span><strong>${escapeHtml(roomUi?.title || "Room 1v1")}</strong></div><div class="stat-clash-lobby-center-body"><div class="stat-clash-sprite-placeholder">?</div><h3>${escapeHtml(roomUi?.detail || "En attente de la room.")}</h3><p>${escapeHtml(selfRoomPlayer?.isHost ? "Partage le code puis lance la partie quand la room est complète." : room?.code ? `Connecté à ${room.code}. Attends le lancement par l’hôte.` : "Crée une room ou rejoins-en une avec un code.")}</p></div></div>`
    : `<div class="stat-clash-randomizer ${state.phase === "rolling" ? "is-rolling" : ""}"><div class="stat-clash-randomizer-head"><span>${state.phase === "starting-countdown" ? "Démarrage room" : "Pokémon tiré"}</span><strong>${escapeHtml(state.statusText)}</strong></div><div class="stat-clash-sprite-wrap">${current ? `<img src="${currentSprite}" alt="${escapeHtml(current.name)}" data-fallback="${getSpriteUrl(getPokemonSpriteId(current))}" />` : '<div class="stat-clash-sprite-placeholder">?</div>'}</div><div class="stat-clash-pokemon-meta"><h3>${escapeHtml(current?.name || (state.phase === "starting-countdown" ? "Prépare-toi…" : isRoom ? "Room en attente..." : "Chargement..."))}</h3><p>Les valeurs des 6 stats restent secrètes jusqu'à la révélation.</p></div><div class="stat-clash-timer ${["picking", "locked"].includes(state.phase) ? "is-live" : ""}"><div class="stat-clash-timer-ring"><span>${Math.max(0, Math.ceil(state.timerLeftMs / 1000))}</span></div><div class="stat-clash-timer-track"><span class="stat-clash-timer-fill" style="width:${timerPct}%"></span></div><small>${state.phase === "starting-countdown" ? "Le match commence quand le countdown atteint 0." : state.phase === "rolling" ? "Le randomizer termine son arrêt avant l'ouverture des choix." : ["picking", "locked"].includes(state.phase) ? "10 secondes complètes pour choisir ta stat." : "Le reveal arrive juste après les choix."}</small></div>${state.reveal ? `<div class="stat-clash-reveal-row"><div class="stat-clash-reveal-card"><span>${escapeHtml(state.players.left.label)}</span><b>${escapeHtml(state.reveal.left?.statLabel || "—")}</b><small>+${state.reveal.left?.value || 0}</small></div><div class="stat-clash-reveal-card"><span>${escapeHtml(state.players.right.label)}</span><b>${escapeHtml(state.reveal.right?.statLabel || "—")}</b><small>+${state.reveal.right?.value || 0}</small></div></div>${revealStatsHtml}` : ""}</div>`;
  const finalHtml = state.phase === "finished" ? `<section class="stat-clash-final-card ${winnerKey === "tie" ? "is-tie" : "is-win"}"><div class="stat-clash-final-head"><p class="stat-clash-final-kicker">Résultat final</p><h3>${winnerKey === "tie" ? "Égalité" : `${escapeHtml(state.players[winnerKey].label)} gagne`}</h3><p>${state.players.left.score} à ${state.players.right.score}</p></div><div class="stat-clash-final-actions"><button class="btn-red" type="button" data-action="restartStatClashGame">Rejouer</button><button class="btn-ghost" type="button" data-action="goToConfig">Retour menu</button></div></section>` : "";
  const imposedRulePickerHtml = (isBotLobby || (isRoom && roomIsLobby && room?.code)) ? renderImposedRulePicker() : "";
  // Type color (basé sur le Pokémon affiché)
  const typeColor = current ? getStatClashPokemonTypeColor(current) : "#7c8db5";
  // Settings bar (bot only)
  const isRoomLobbyHost = isRoom && roomIsLobby && Boolean(selfRoomPlayer?.isHost);
  const showSettingsBar = !isRoom || isRoomLobbyHost;
  const settingsBarHtml = !showSettingsBar ? "" : `<div class="stat-clash-settings-bar">
    <label class="stat-clash-setting"><span>Format</span><select data-change-action="statClashFormatFromEl" ${isRoom && !isRoomLobbyHost ? "disabled" : ""}>${Object.entries(STAT_CLASH_FORMATS).map(([key, def]) => `<option value="${key}" ${state.format === key ? "selected" : ""}>${escapeHtml(def.label)}</option>`).join("")}</select></label>
    ${!isRoom ? `<label class="stat-clash-setting"><span>Bot</span><select data-change-action="statClashDifficultyFromEl">${Object.entries(STAT_CLASH_BOT_DIFFICULTIES).map(([key, def]) => `<option value="${key}" ${state.botDifficulty === key ? "selected" : ""}>${escapeHtml(def.label)}</option>`).join("")}</select></label>` : ""}
    <label class="stat-clash-setting stat-clash-setting-toggle"><input type="checkbox" ${state.houseRuleEnabled ? "checked" : ""} data-change-action="toggleStatClashHouseRule" ${isRoom && !isRoomLobbyHost ? "disabled" : ""} /><span>Handicaps imposés</span></label>
    <label class="stat-clash-setting stat-clash-setting-toggle"><input type="checkbox" ${state.houseRuleSharedEnabled ? "checked" : ""} data-change-action="toggleStatClashSharedHouseRule" ${isRoom && !isRoomLobbyHost ? "disabled" : ""} /><span>Règle commune</span></label>
    ${!isRoom ? `<button type="button" class="${isBotLobby ? "btn-red" : "btn-ghost"} stat-clash-restart-btn" data-stat-clash-action="start-bot">${isBotLobby ? "Lancer vs bot" : "↻ Nouvelle partie"}</button>` : ""}
  </div>`;
  // Versus overlay (game / round intro)
  const versusOverlay = (state.showVersusOverlay && !isRoom)
    ? state.showVersusOverlay === "game"
      ? `<div class="stat-clash-versus-overlay is-game"><div class="stat-clash-versus-inner"><span class="stat-clash-versus-kicker">Stat Clash</span><h2>${escapeHtml(state.players.left.label)}<span class="vs">VS</span>${escapeHtml(state.players.right.label)}</h2><p class="stat-clash-versus-format">${escapeHtml((STAT_CLASH_FORMATS[state.format] || STAT_CLASH_FORMATS.standard).label)}</p>${sharedRule && state.houseRuleSharedEnabled ? `<div class="stat-clash-versus-rule">${sharedRule.icon} <b>${escapeHtml(sharedRule.label)}</b><small>${escapeHtml(sharedRule.desc)}</small></div>` : ""}</div></div>`
      : `<div class="stat-clash-versus-overlay is-round"><div class="stat-clash-versus-inner"><span class="stat-clash-versus-kicker">Manche</span><h2 class="stat-clash-versus-round">${state.round} / ${state.totalRounds}</h2></div></div>`
    : "";
  // Announcer phylactère
  const announcerHtml = state.announcerLine && !isRoom
    ? `<div class="stat-clash-announcer tone-${escapeHtml(state.announcerTone || "info")}"><b>Prof. Stat</b><span>${escapeHtml(state.announcerLine)}</span></div>`
    : "";
  // Confetti pour victoire
  const showConfetti = state.phase === "finished" && (
    (!isRoom && state.finalWinnerSide === "left")
    || (isRoom && room && room.winnerId && room.winnerId === selfRoomPlayer?.id)
  );
  const confettiHtml = showConfetti
    ? `<div class="stat-clash-confetti-layer">${Array.from({ length: 28 }, (_, i) => `<span class="confetti c${i % 6}" style="left:${(i * 3.6) % 100}%;animation-delay:${(i % 7) * 0.18}s"></span>`).join("")}</div>`
    : "";
  // Urgent timer state
  const isUrgent = ["picking", "locked"].includes(state.phase) && state.timerLeftMs > 0 && state.timerLeftMs < 3000;
  root.innerHTML = `<div class="stat-clash-shell mode-${isRoom ? "room" : "bot"} phase-${escapeHtml(state.phase)} ${roomHasStarted ? "is-live-layout" : "is-lobby-layout"} ${isUrgent ? "is-urgent" : ""}" style="--sc-type-color:${typeColor}">${versusOverlay}${confettiHtml}<div class="stat-clash-mode-switch"><button class="btn-${isRoom ? "ghost" : "red"}" type="button" data-stat-clash-action="switch-bot">Vs Bot</button><button class="btn-${isRoom ? "red" : "ghost"}" type="button" data-stat-clash-action="switch-room">Room 1v1</button></div>${settingsBarHtml}${roomControls}${imposedRulePickerHtml}${roomMetaPanelHtml}<div class="stat-clash-topline">${toplineHtml}</div>${announcerHtml}<div class="stat-clash-board">${renderPlayerCard("left", state.players.left, false)}<section class="stat-clash-center-card">${lobbyCenterHtml}${(!isRoom && !isBotLobby) || roomHasStarted ? `<div class="stat-clash-remaining-block"><h4>Stats restantes pour toi</h4><div class="stat-clash-remaining-list">${remainingHtml}</div></div>` : ""}${finalHtml}</section>${renderPlayerCard("right", state.players.right, true)}</div></div>`;
}

function openStatClashMode() {
  const pool = getStatClashPool();
  if (!pool.length) return showToast("Impossible de charger la base Pokémon complète pour Stat Clash.");
  goToConfig();
  cleanupStatClashMode();
  statClashState = createStatClashState();
  statClashState.pool = pool;
  gameMode = "stat-clash";
  hideScreen("screen-config");
  hideScreen("screen-team-builder");
  hideScreen("screen-teams");
  hideScreen("screen-multiplayer");
  showScreen("screen-stat-clash");
  setGlobalNavActive("social");
  prepareStatClashBotLobby();
  renderStatClashScreen();
}

