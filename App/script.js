// ============================================================
// script.js - Pokedle V3 (enhanced)
// Features:
// - Daily Pokemon mode (deterministic by UTC date)
// - Persistent player stats (localStorage)
// - Auto-save and auto-restore game in progress
// - Optimized autocomplete (pre-index + cache)
// - Lightweight victory animation trigger
// ============================================================

const STORAGE_KEYS = {
  stats: "pokedle_stats_v1",
  game: "pokedle_game_v1",
  ranking: "pokedle_ranking_v1",
  gamesRanking: "pokedle_games_ranking_v1",
  profile: "pokedle_profile_v1",
  achievements: "pokedle_achievements_v1",
  history: "pokedle_history_v1",
};

const DEFAULT_STATS = {
  played: 0,
  wins: 0,
  totalAttempts: 0,
  dailyCurrentStreak: 0,
  dailyBestStreak: 0,
  lastDailyWinKey: null,
};

const DEFAULT_PROFILE = {
  nickname: "",
  favoritePokemonId: null,
};

const ACHIEVEMENT_DEFS = [
  { id: "first_game", title: "Premier pas", desc: "Jouer une première partie.", target: 1, getValue: () => playerStats.played || 0 },
  { id: "first_win", title: "Première victoire", desc: "Remporter une première partie.", target: 1, getValue: () => playerStats.wins || 0 },
  { id: "ten_wins", title: "En forme", desc: "Atteindre 10 victoires.", target: 10, getValue: () => playerStats.wins || 0 },
  { id: "fifty_games", title: "Habitué", desc: "Jouer 50 parties.", target: 50, getValue: () => playerStats.played || 0 },
  { id: "daily_streak_3", title: "Régulier", desc: "Atteindre une série journalière de 3.", target: 3, getValue: () => playerStats.dailyBestStreak || 0 },
];

const PLAYER_LEVELS = [
  { name: "Débutant", minWins: 0 },
  { name: "Dresseur", minWins: 5 },
  { name: "Champion", minWins: 20 },
  { name: "Maître Pokémon", minWins: 50 },
];

const AC_LIMIT = 8;
const VALID_MODES = new Set(["normal", "challenge", "daily", "silhouette", "pixel", "mystery", "cry", "quiz"]);
const PARTY_MODE_MAX_ROUNDS = 5;
const BOT_DUEL_MIN_SOLVE_TURN = 4;
const BOT_DUEL_MAX_SOLVE_TURN = 7;
const BOT_DUEL_TURN_DELAY_MS = 2200;

// Keep overrides empty: pokemon.js is the source of truth (ids + FR names + sprites).
const NAME_OVERRIDES = {};
const SPRITE_ID_OVERRIDES_BY_NAME = {};
// Extra playable forms (regional, mega, special).
// We keep base species sprites by default to avoid broken links.
const EXTRA_FORMS = [
  { id: 20001, name: "Florizarre Mega", baseId: 3, gen: 6 },
  { id: 20002, name: "Dracaufeu Mega X", baseId: 6, gen: 6, type2: "Dragon" },
  { id: 20003, name: "Dracaufeu Mega Y", baseId: 6, gen: 6 },
  { id: 20004, name: "Tortank Mega", baseId: 9, gen: 6 },
  { id: 20005, name: "Alakazam Mega", baseId: 65, gen: 6 },
  { id: 20006, name: "Ectoplasma Mega", baseId: 94, gen: 6 },
  { id: 20007, name: "Kangourex Mega", baseId: 115, gen: 6 },
  { id: 20008, name: "Léviator Mega", baseId: 130, gen: 6, type2: "Ténèbres" },
  { id: 20009, name: "Ptéra Mega", baseId: 142, gen: 6 },
  { id: 20010, name: "Mewtwo Mega X", baseId: 150, gen: 6, type2: "Combat" },
  { id: 20011, name: "Mewtwo Mega Y", baseId: 150, gen: 6 },
  { id: 20012, name: "Lucario Mega", baseId: 448, gen: 6 },
  { id: 20013, name: "Gardevoir Mega", baseId: 282, gen: 6 },
  { id: 20014, name: "Gallame Mega", baseId: 475, gen: 6 },
  { id: 20015, name: "Métalosse Mega", baseId: 376, gen: 6 },

  { id: 21001, name: "Rattata d'Alola", baseId: 19, gen: 7, type2: "Ténèbres" },
  { id: 21002, name: "Rattatac d'Alola", baseId: 20, gen: 7, type2: "Ténèbres" },
  { id: 21003, name: "Raichu d'Alola", baseId: 26, gen: 7, type1: "Électrik", type2: "Psy" },
  { id: 21004, name: "Sabelette d'Alola", baseId: 27, gen: 7, type1: "Glace", type2: "Acier" },
  { id: 21005, name: "Sablaireau d'Alola", baseId: 28, gen: 7, type1: "Glace", type2: "Acier", color: "Blanc / Bleu" },
  { id: 21006, name: "Goupix d'Alola", baseId: 37, gen: 7, type1: "Glace", type2: null },
  { id: 21007, name: "Feunard d'Alola", baseId: 38, gen: 7, type1: "Glace", type2: "Fée", color: "Blanc / Bleu" },
  { id: 21008, name: "Taupiqueur d'Alola", baseId: 50, gen: 7, type1: "Sol", type2: "Acier" },
  { id: 21009, name: "Triopikeur d'Alola", baseId: 51, gen: 7, type1: "Sol", type2: "Acier" },
  { id: 21010, name: "Miaouss d'Alola", baseId: 52, gen: 7, type1: "Ténèbres", type2: null },
  { id: 21011, name: "Persian d'Alola", baseId: 53, gen: 7, type1: "Ténèbres", type2: null },
  { id: 21012, name: "Racaillou d'Alola", baseId: 74, gen: 7, type1: "Roche", type2: "Électrik" },
  { id: 21013, name: "Gravalanch d'Alola", baseId: 75, gen: 7, type1: "Roche", type2: "Électrik" },
  { id: 21014, name: "Grolem d'Alola", baseId: 76, gen: 7, type1: "Roche", type2: "Électrik", color: "Gris / Jaune" },
  { id: 21015, name: "Tadmorv d'Alola", baseId: 88, gen: 7, type1: "Poison", type2: "Ténèbres" },
  { id: 21016, name: "Grotadmorv d'Alola", baseId: 89, gen: 7, type1: "Poison", type2: "Ténèbres" },
  { id: 21017, name: "Ossatueur d'Alola", baseId: 105, gen: 7, type1: "Feu", type2: "Spectre" },
  { id: 21018, name: "Noadkoko d'Alola", baseId: 103, gen: 7, type1: "Plante", type2: "Dragon", color: "Vert / Jaune" },

  { id: 22001, name: "Ponyta de Galar", baseId: 77, gen: 8, type1: "Psy", type2: null },
  { id: 22002, name: "Galopa de Galar", baseId: 78, gen: 8, type1: "Psy", type2: "Fée" },
  { id: 22003, name: "Canarticho de Galar", baseId: 83, gen: 8, type1: "Combat", type2: null },
  { id: 22004, name: "Smogogo de Galar", baseId: 110, gen: 8, type1: "Poison", type2: "Fée", color: "Gris / Vert" },
  { id: 22005, name: "Corayon de Galar", baseId: 222, gen: 8, type1: "Spectre", type2: null },
  { id: 22006, name: "Miaouss de Galar", baseId: 52, gen: 8, type1: "Acier", type2: null },
  { id: 22007, name: "Darumarond de Galar", baseId: 554, gen: 8, type1: "Glace", type2: null },
  { id: 22008, name: "Darumacho de Galar", baseId: 555, gen: 8, type1: "Glace", type2: null },
  { id: 22009, name: "Zigzaton de Galar", baseId: 263, gen: 8, type1: "Ténèbres", type2: "Normal" },
  { id: 22010, name: "Linéon de Galar", baseId: 264, gen: 8, type1: "Ténèbres", type2: "Normal" },

  { id: 23001, name: "Caninos de Hisui", baseId: 58, gen: 8, type1: "Feu", type2: "Roche" },
  { id: 23002, name: "Arcanin de Hisui", baseId: 59, gen: 8, type1: "Feu", type2: "Roche" },
  { id: 23003, name: "Voltorbe de Hisui", baseId: 100, gen: 8, type1: "Électrik", type2: "Plante" },
  { id: 23004, name: "Electrode de Hisui", baseId: 101, gen: 8, type1: "Électrik", type2: "Plante" },
  { id: 23005, name: "Qwilfish de Hisui", baseId: 211, gen: 8, type1: "Ténèbres", type2: "Poison" },
  { id: 23006, name: "Typhlosion de Hisui", baseId: 157, gen: 8, type1: "Feu", type2: "Spectre" },
  { id: 23007, name: "Clamiral de Hisui", baseId: 503, gen: 8, type1: "Eau", type2: "Ténèbres" },
  { id: 23008, name: "Archéduc de Hisui", baseId: 724, gen: 8, type1: "Plante", type2: "Combat" },

  { id: 24001, name: "Tauros de Paldea (Combat)", baseId: 128, gen: 9, type1: "Combat", type2: null },
  { id: 24002, name: "Tauros de Paldea (Feu)", baseId: 128, gen: 9, type1: "Combat", type2: "Feu", color: "Noir / Rouge" },
  { id: 24003, name: "Tauros de Paldea (Eau)", baseId: 128, gen: 9, type1: "Combat", type2: "Eau", color: "Noir / Bleu" },
  { id: 24004, name: "Axoloto de Paldea", baseId: 194, gen: 9, type1: "Poison", type2: "Sol" },
  { id: 24005, name: "Ursaking Lune Vermeille", baseId: 901, gen: 9, type1: "Sol", type2: "Normal" },

  { id: 25001, name: "Giratina Forme Originelle", baseId: 487, gen: 4 },
  { id: 25002, name: "Shaymin Forme Céleste", baseId: 492, gen: 4, type2: "Vol" },
  { id: 25003, name: "Fulguris Forme Totémique", baseId: 642, gen: 5 },
  { id: 25004, name: "Boréas Forme Totémique", baseId: 641, gen: 5 },
  { id: 25005, name: "Démétéros Forme Totémique", baseId: 645, gen: 5 },
];

const FORM_API_NAME_BY_NAME = {
  "Florizarre Mega": "venusaur-mega",
  "Dracaufeu Mega X": "charizard-mega-x",
  "Dracaufeu Mega Y": "charizard-mega-y",
  "Tortank Mega": "blastoise-mega",
  "Alakazam Mega": "alakazam-mega",
  "Ectoplasma Mega": "gengar-mega",
  "Kangourex Mega": "kangaskhan-mega",
  "Léviator Mega": "gyarados-mega",
  "Ptéra Mega": "aerodactyl-mega",
  "Mewtwo Mega X": "mewtwo-mega-x",
  "Mewtwo Mega Y": "mewtwo-mega-y",
  "Lucario Mega": "lucario-mega",
  "Gardevoir Mega": "gardevoir-mega",
  "Gallame Mega": "gallade-mega",
  "Métalosse Mega": "metagross-mega",
  "Rattata d'Alola": "rattata-alola",
  "Rattatac d'Alola": "raticate-alola",
  "Raichu d'Alola": "raichu-alola",
  "Sabelette d'Alola": "sandshrew-alola",
  "Sablaireau d'Alola": "sandslash-alola",
  "Goupix d'Alola": "vulpix-alola",
  "Feunard d'Alola": "ninetales-alola",
  "Taupiqueur d'Alola": "diglett-alola",
  "Triopikeur d'Alola": "dugtrio-alola",
  "Miaouss d'Alola": "meowth-alola",
  "Persian d'Alola": "persian-alola",
  "Racaillou d'Alola": "geodude-alola",
  "Gravalanch d'Alola": "graveler-alola",
  "Grolem d'Alola": "golem-alola",
  "Tadmorv d'Alola": "grimer-alola",
  "Grotadmorv d'Alola": "muk-alola",
  "Ossatueur d'Alola": "marowak-alola",
  "Noadkoko d'Alola": "exeggutor-alola",
  "Ponyta de Galar": "ponyta-galar",
  "Galopa de Galar": "rapidash-galar",
  "Canarticho de Galar": "farfetchd-galar",
  "Smogogo de Galar": "weezing-galar",
  "Corayon de Galar": "corsola-galar",
  "Miaouss de Galar": "meowth-galar",
  "Darumarond de Galar": "darumaka-galar",
  "Darumacho de Galar": "darmanitan-galar-standard",
  "Zigzaton de Galar": "zigzagoon-galar",
  "Linéon de Galar": "linoone-galar",
  "Caninos de Hisui": "growlithe-hisui",
  "Arcanin de Hisui": "arcanine-hisui",
  "Voltorbe de Hisui": "voltorb-hisui",
  "Electrode de Hisui": "electrode-hisui",
  "Qwilfish de Hisui": "qwilfish-hisui",
  "Typhlosion de Hisui": "typhlosion-hisui",
  "Clamiral de Hisui": "samurott-hisui",
  "Archéduc de Hisui": "decidueye-hisui",
  "Tauros de Paldea (Combat)": "tauros-paldea-combat-breed",
  "Tauros de Paldea (Feu)": "tauros-paldea-blaze-breed",
  "Tauros de Paldea (Eau)": "tauros-paldea-aqua-breed",
  "Axoloto de Paldea": "wooper-paldea",
  "Ursaking Lune Vermeille": "ursaluna-bloodmoon",
  "Giratina Forme Originelle": "giratina-origin",
  "Shaymin Forme Céleste": "shaymin-sky",
  "Fulguris Forme Totémique": "thundurus-therian",
  "Boréas Forme Totémique": "tornadus-therian",
  "Démétéros Forme Totémique": "landorus-therian",
};
function injectExtraForms() {
  const byId = new Set(POKEMON_LIST.map((p) => p.id));
  const byName = new Set(POKEMON_LIST.map((p) => p.name));
  const baseById = new Map(POKEMON_LIST.map((p) => [p.id, p]));

  for (const form of EXTRA_FORMS) {
    if (byId.has(form.id) || byName.has(form.name)) continue;

    const base = baseById.get(form.baseId);
    if (!base) continue;

    const spriteId = Number.isInteger(form.spriteId) ? form.spriteId : base.id;
    const gen = Number.isInteger(form.gen) ? form.gen : base.gen;

    const entry = {
      id: form.id,
      name: form.name,
      type1: form.type1 || base.type1,
      type2: form.type2 !== undefined ? form.type2 : base.type2,
      gen,
      generation: gen,
      habitat: form.habitat || base.habitat,
      color: form.color || base.color,
      stage: Number.isInteger(form.stage) ? form.stage : base.stage,
      height: typeof form.height === "number" ? form.height : base.height,
      weight: typeof form.weight === "number" ? form.weight : base.weight,
      spriteId,
      sprite: getSpriteUrl(spriteId),
      isAltForm: true,
    };

    POKEMON_LIST.push(entry);
    byId.add(entry.id);
    byName.add(entry.name);
  }
}

async function resolveExtraFormSprites() {
  const forms = POKEMON_LIST.filter((p) => p.id >= 20000);

  await Promise.allSettled(
    forms.map(async (pokemon) => {
      const apiName = FORM_API_NAME_BY_NAME[pokemon.name];
      if (!apiName) return;

      try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
        if (!response.ok) return;

        const data = await response.json();
        const sprite = data?.sprites?.front_default;
        if (!sprite) return;

        pokemon.sprite = sprite;
      } catch (_err) {
        // keep base sprite fallback if API is unavailable
      }
    })
  );
}
// ---------- game state ----------
let selectedGens = new Set([1]);
let activePool = [];
let secretPokemon = null;
let attempts = 0;
let gameOver = false;
let guessedNames = [];
let guessedSet = new Set();
let resultHistory = [];
let acIndex = -1;
let multiplayerBotState = null;
let multiplayerLiveState = null;
let multiplayerSocket = null;

let gameMode = "normal"; // normal | challenge | daily
let winRegisteredForCurrentGame = false;

// ---------- stats ----------
let playerStats = { ...DEFAULT_STATS };
let playerProfile = { ...DEFAULT_PROFILE };
let unlockedAchievements = {};
let matchHistory = [];
let quizSessionLogged = false;

// ---------- search/index ----------
injectExtraForms();
normalizePokemonData();

const FULL_SEARCH_INDEX = POKEMON_LIST.map((pokemon) => ({
  pokemon,
  normName: norm(pokemon.name),
}));

const POKEMON_BY_ID = new Map(POKEMON_LIST.map((p) => [p.id, p]));

let activeSearchIndex = [];
let activeNameMap = new Map(); // normalized name -> pokemon (active pool)

const guessCache = new Map();
const challengeCache = new Map();
const rankingCache = new Map();
const GAME_RATING_FIELDS = ["story", "pokemon", "region", "difficulty", "nostalgia"];
const POKEMON_MAIN_GAMES = [
  { key: "rb", name: "Rouge / Bleu" },
  { key: "gs", name: "Or / Argent" },
  { key: "rs", name: "Rubis / Saphir" },
  { key: "dp", name: "Diamant / Perle" },
  { key: "bw", name: "Noir / Blanc" },
  { key: "xy", name: "X / Y" },
  { key: "sm", name: "Soleil / Lune" },
  { key: "swsh", name: "Épée / Bouclier" },
  { key: "sv", name: "Écarlate / Violet" },
  { key: "pla", name: "Légendes Arceus" },
];

let gamesRanking = {};

const RANKING_TYPES = [
  "Normal",
  "Feu",
  "Eau",
  "Plante",
  "Électrik",
  "Glace",
  "Combat",
  "Poison",
  "Sol",
  "Vol",
  "Psy",
  "Insecte",
  "Roche",
  "Spectre",
  "Dragon",
  "Ténèbres",
  "Acier",
  "Fée",
];

let rankingChoices = {};
let rankingSelected = null;
let rankingCandidates = [];
let rankingFiltered = [];
let rankAcIndex = -1;
let mysteryClues = [];
let cryAudio = null;
let quizQuestions = [];
let quizCurrentIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let quizHistory = [];
let partySession = null;
const QUIZ_QUESTION_COUNT = 15;
let pokedexSearch = "";
let pokedexGenFilter = "all";
let pokedexTypeFilter = "all";
let pokedexGridUseShiny = false;
let pokedexSelectedShiny = false;
let typeChartEra = "gen6+";
let typeChartOffenseFilter = "all";
let typeChartDefenseFilter = "all";

function createPartySession() {
  return {
    currentRound: 1,
    maxRounds: PARTY_MODE_MAX_ROUNDS,
    score: 0,
    wins: 0,
    losses: 0,
    currentModeKey: null,
    currentModeLabel: "Mini-jeu",
    modeQueue: [],
    roundResolved: false,
    completed: false,
  };
}

function isPartySessionActive() {
  return Boolean(partySession && !partySession.completed);
}

function hasPartyEvolutionCandidate() {
  const pool = getPoolFromSelectedGens().filter((pokemon) => !pokemon.isAltForm);
  const sorted = pool.slice().sort((a, b) => a.id - b.id);
  for (let i = 0; i <= sorted.length - 3; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const c = sorted[i + 2];
    if (a && b && c && a.gen === b.gen && b.gen === c.gen && Number(a.stage) === 1 && Number(b.stage) === 2 && Number(c.stage) === 3 && b.id === a.id + 1 && c.id === b.id + 1) {
      return true;
    }
  }
  return false;
}

function getEvolutionChainCandidates(pool) {
  const sorted = pool.slice().sort((a, b) => a.id - b.id);
  const candidates = [];
  for (let i = 0; i <= sorted.length - 3; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const c = sorted[i + 2];
    if (
      a &&
      b &&
      c &&
      a.gen === b.gen &&
      b.gen === c.gen &&
      Number(a.stage) === 1 &&
      Number(b.stage) === 2 &&
      Number(c.stage) === 3 &&
      b.id === a.id + 1 &&
      c.id === b.id + 1
    ) {
      candidates.push([a, b, c]);
    }
  }
  return candidates;
}

function getPartyModePool() {
  const basePool = getPoolFromSelectedGens();
  const noAltPool = basePool.filter((pokemon) => !pokemon.isAltForm);
  return [
    { key: "normal", label: "Pokémon Mystère", launch: startNormalGame, canLaunch: () => basePool.length > 0 },
    { key: "silhouette", label: "Zoom progressif", launch: startSilhouetteGame, canLaunch: () => basePool.length > 0 },
    { key: "pixel", label: "Mode pixelisé", launch: startPixelGame, canLaunch: () => basePool.length > 0 },
    { key: "cry", label: "Cri du Pokémon", launch: startCryGame, canLaunch: () => basePool.length > 0 },
    { key: "quiz", label: "Quiz Pokémon", launch: startQuizGame, canLaunch: () => true },
    { key: "mystery", label: "Stat Mystère", launch: startMysteryStatGame, canLaunch: () => basePool.length > 0 },
    { key: "weight", label: "Duel de poids", launch: startWeightBattle, canLaunch: () => noAltPool.length >= 2 },
    { key: "evolution", label: "Chaîne d'évolution", launch: startEvolutionChainGame, canLaunch: () => hasPartyEvolutionCandidate() },
    { key: "order", label: "Ordre Pokédex", launch: startPokedexOrderGame, canLaunch: () => noAltPool.length >= 3 },
    { key: "description", label: "Description Pokédex", launch: startDescriptionMode, canLaunch: () => basePool.length > 0 },
    { key: "odd", label: "Intrus Pokémon", launch: openOddOneOutMode, canLaunch: () => true },
  ].filter((mode) => mode.canLaunch());
}

function pickPartyMode() {
  const modes = getPartyModePool();
  if (!modes.length) return null;
  if (modes.length === 1) return modes[0];
  if (!partySession) {
    return modes[Math.floor(Math.random() * modes.length)];
  }
  const availableKeys = new Set(modes.map((mode) => mode.key));
  partySession.modeQueue = Array.isArray(partySession.modeQueue)
    ? partySession.modeQueue.filter((key) => availableKeys.has(key))
    : [];

  if (!partySession.modeQueue.length) {
    const refill = modes
      .filter((mode) => mode.key !== partySession.currentModeKey)
      .map((mode) => mode.key);
    partySession.modeQueue = shuffleArray(refill);
  }

  const nextKey = partySession.modeQueue.shift();
  return modes.find((mode) => mode.key === nextKey) || modes[0];
}

function getPartyModeInstruction(modeKey) {
  const instructions = {
    normal: "Devine le Pokémon mystère en comparant les indices du tableau.",
    silhouette: "Trouve le Pokémon avant que le zoom ne révèle trop son sprite.",
    pixel: "Devine le Pokémon pendant que le sprite se dévoile progressivement.",
    cry: "Écoute le cri et retrouve le bon Pokémon.",
    quiz: "Réponds correctement aux questions pour remporter la manche.",
    mystery: "Retrouve le Pokémon grâce à ses statistiques et à leurs indices.",
    weight: "Choisis le Pokémon le plus lourd entre les deux propositions.",
    evolution: "Trouve le Pokémon manquant dans la chaîne d'évolution.",
    order: "Devine quel Pokémon se place entre les deux numéros du Pokédex.",
    description: "Lis l'indice Pokédex et retrouve le bon Pokémon.",
    odd: "Repère le Pokémon intrus parmi les six cartes affichées.",
  };
  return instructions[modeKey] || "";
}

function renderPartySessionUI() {
  const banner = document.getElementById("party-banner");
  const box = document.getElementById("party-box");
  const roundBadge = document.getElementById("party-round-badge");
  const scoreBadge = document.getElementById("party-score-badge");
  const modeLabel = document.getElementById("party-mode-label");
  const status = document.getElementById("party-status");
  const stage = document.getElementById("party-stage");
  const nextBtn = document.getElementById("party-next-btn");
  const restartBtn = document.getElementById("party-restart-btn");
  const roundsPlayed = (partySession?.wins || 0) + (partySession?.losses || 0);
  const accuracy = roundsPlayed > 0 ? Math.round((partySession.wins / roundsPlayed) * 100) : 0;

  if (!partySession) {
    banner?.classList.add("hidden");
    box?.classList.add("hidden");
    return;
  }

  banner?.classList.add("hidden");
  box?.classList.remove("hidden");

  if (roundBadge) {
    roundBadge.textContent = `Round ${partySession.currentRound} / ${partySession.maxRounds}`;
  }
  if (scoreBadge) {
    scoreBadge.textContent = `Score : ${partySession.score}`;
  }

  const showInterRoundSummary = Boolean(partySession.roundResolved && !partySession.completed);
  const showFinalSummary = Boolean(partySession.completed);
  const showSummaryBlock = showInterRoundSummary || showFinalSummary;
  const activeInstruction = getPartyModeInstruction(partySession.currentModeKey);

  if (modeLabel) {
    modeLabel.textContent = showFinalSummary
      ? "Résultats Party Pokémon"
      : showInterRoundSummary
        ? "Party Pokémon"
        : (partySession.currentModeLabel || "Mini-jeu");
    modeLabel.classList.toggle("hidden", false);
  }
  if (status) {
    if (showFinalSummary) {
      status.textContent = "Session terminée.";
    } else if (showInterRoundSummary) {
      status.textContent = partySession.currentRound >= partySession.maxRounds
        ? "Dernière manche terminée."
        : "Manche terminée. Passe à la suivante.";
    } else {
      status.textContent = activeInstruction;
    }
    status.classList.toggle("hidden", false);
  }
  if (stage) {
    if (showFinalSummary) {
      stage.innerHTML = `<div class="party-summary"><b>Resultats de la session</b><span>Score total : ${partySession.score}</span><span>Rounds joues : ${roundsPlayed} / ${partySession.maxRounds}</span><span>Victoires : ${partySession.wins}</span><span>Defaites : ${partySession.losses}</span><span>Precision : ${accuracy}%</span></div>`;
    } else if (showInterRoundSummary) {
      stage.innerHTML = `<div class="party-summary"><b>${partySession.wins} victoire${partySession.wins > 1 ? "s" : ""} • ${partySession.losses} défaite${partySession.losses > 1 ? "s" : ""}</b></div>`;
    } else {
      stage.innerHTML = "";
    }
    stage.classList.toggle("hidden", !showSummaryBlock);
  }
  if (nextBtn) nextBtn.classList.toggle("hidden", !partySession.roundResolved || partySession.completed);
  if (restartBtn) {
    restartBtn.textContent = partySession.completed ? "Rejouer" : "Nouvelle session";
    restartBtn.classList.toggle("hidden", !partySession.completed);
  }
}

function finishPartyRound(didWin, scoreDelta = didWin ? 1 : 0) {
  if (!isPartySessionActive() || partySession.roundResolved) return;
  partySession.roundResolved = true;
  if (didWin) {
    partySession.wins += 1;
    partySession.score += scoreDelta;
  } else {
    partySession.losses += 1;
  }
  if (partySession.currentRound >= partySession.maxRounds) {
    partySession.completed = true;
  }
  renderPartySessionUI();
}

function launchPartyRound() {
  if (!isPartySessionActive()) return;
  const mode = pickPartyMode();
  if (!mode) {
    partySession.completed = true;
    partySession.currentModeLabel = "Party Pokémon";
    renderPartySessionUI();
    return;
  }
  partySession.currentModeKey = mode.key;
  partySession.currentModeLabel = mode.label;
  partySession.roundResolved = false;
  renderPartySessionUI();
  mode.launch();
  renderPartySessionUI();
}

function advancePartyRound() {
  if (!partySession || !partySession.roundResolved || partySession.completed) return;
  partySession.currentRound += 1;
  launchPartyRound();
}
let pokedexSelectedId = null;
let pokedexDetailRequestId = 0;
let draftArenaState = null;

const POKEDEX_API_CACHE = new Map();
const POKEDEX_SPECIES_CACHE = new Map();
const POKEDEX_ABILITY_CACHE = new Map();

const QUIZ_QUESTIONS = [
  { question: "Quel type est immunisé aux attaques Dragon ?", options: ["Acier", "Fée", "Glace", "Psy"], answer: 1 },
  { question: "Quel Pokémon est le n° 384 du Pokédex National ?", options: ["Groudon", "Kyogre", "Rayquaza", "Deoxys"], answer: 2 },
  { question: "Quel Pokémon a une faiblesse x4 au type Combat ?", options: ["Tyranocif", "Milobellus", "Dracolosse", "Airmure"], answer: 0 },
  { question: "Quelle capacité augmente fortement l'Attaque Spéciale mais baisse la Défense Spéciale ?", options: ["Danse Draco", "Machination", "Vibra Soin", "Exuviation"], answer: 3 },
  { question: "Quel talent rend immunisé aux attaques Sol ?", options: ["Lévitation", "Fermeté", "Intimidation", "Technicien"], answer: 0 },
  { question: "Quel starter final de Sinnoh est de type Feu/Combat ?", options: ["Simiabraz", "Braségali", "Torterra", "Pingoléon"], answer: 0 },
  { question: "Quel Pokémon légendaire est de type Psy/Vol ?", options: ["Lugia", "Mewtwo", "Yveltal", "Dialga"], answer: 0 },
  { question: "Quel est le talent signature de Métamorph en français ?", options: ["Imposteur", "Mue", "Calque", "Synchro"], answer: 0 },
  { question: "Quel objet augmente la puissance des attaques super efficaces ?", options: ["Lunettes Choix", "Orbe Vie", "Veste de Combat", "Lentilscope"], answer: 1 },
  { question: "Dans les versions Rouge/Bleu, quel type n'avait aucune faiblesse ?", options: ["Normal", "Psy", "Combat", "Roche"], answer: 1 },
  { question: "Quel Pokémon est n° 25 du Pokédex ?", options: ["Raichu", "Pikachu", "Rondoudou", "Évoli"], answer: 1 },
  { question: "Quel duo de types est celui de Magnézone ?", options: ["Électrik/Acier", "Électrik/Vol", "Acier/Psy", "Acier/Dragon"], answer: 0 },
  { question: "Quel Pokémon possède la forme Originelle en Gen 4 ?", options: ["Dialga", "Giratina", "Palkia", "Darkrai"], answer: 1 },
  { question: "Quel type est super efficace contre le type Fée ?", options: ["Dragon", "Acier", "Ténèbres", "Spectre"], answer: 1 },
  { question: "Quel Pokémon évolue avec une Pierre Nuit ?", options: ["Kirlia", "Roserade", "Corboss", "Nostenfer"], answer: 2 },
  { question: "Quel est le type secondaire de Brutalibré ?", options: ["Vol", "Acier", "Ténèbres", "Psy"], answer: 0 },
  { question: "Quel Pokémon est de type Eau/Dragon en 9G ?", options: ["Lanssorien", "Serpente-Eau", "Hydragon", "Nigirigon"], answer: 1 },
  { question: "Quel statut réduit l'Attaque physique de moitié (hors talents/objets) ?", options: ["Paralysie", "Brûlure", "Gel", "Sommeil"], answer: 1 },
  { question: "Quelle statistique détermine l'ordre d'action par défaut ?", options: ["Attaque", "Défense", "Vitesse", "PV"], answer: 2 },
  { question: "Quel Pokémon est n° 150 du Pokédex ?", options: ["Mew", "Dracolosse", "Mewtwo", "Lugia"], answer: 2 },
];


window.addEventListener("pagehide", () => {
  stopEmulatorSession();
});

window.addEventListener("beforeunload", () => {
  stopEmulatorSession();
});

window.addEventListener("popstate", () => {
  stopEmulatorSession();
});
window.addEventListener("DOMContentLoaded", () => {
  buildGenGrid();
  loadStats();
  loadRankingChoices();
  loadGamesRanking();
  renderRankingGrid();
  renderGamesRankingTable();
  renderStats();
  initPokedex();
  initTypeChartScreen();
  initHomeTypeHelper();
  initHomeDefenseTypeHelper();
  initHomeTeamSuggestionHelper();
  initEmulatorMode();
  resolveExtraFormSprites();

  if (checkChallengeURL()) return;
  goToConfig();
});

// ============================================================
// GENERATION GRID
// ============================================================
function buildGenGrid() {
  const grid = document.getElementById("gen-grid");
  grid.innerHTML = "";

  Object.entries(GENERATIONS).forEach(([n, data]) => {
    const gen = parseInt(n, 10);
    const count = POKEMON_LIST.filter((p) => p.gen === gen).length;
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
}

// ============================================================
// GAME START / NAVIGATION
// ============================================================
function startNormalGame(forcedPokemon = null) {
  if (forcedPokemon) {
    startChallengeGame(forcedPokemon);
    return;
  }

  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    alert("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "normal";
  const secret = pool[Math.floor(Math.random() * pool.length)];
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
    alert("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "silhouette";
  const secret = pool[Math.floor(Math.random() * pool.length)];
  startGameWithSecret(secret, pool);
}

function startPixelGame() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    alert("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "pixel";
  const secret = pool[Math.floor(Math.random() * pool.length)];
  startGameWithSecret(secret, pool);
}

function startCryGame() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    alert("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "cry";
  const secret = pool[Math.floor(Math.random() * pool.length)];
  startGameWithSecret(secret, pool);
}

function startQuizGame() {
  gameMode = "quiz";
  attempts = 0;
  gameOver = false;
  winRegisteredForCurrentGame = false;
  quizSessionLogged = false;
  quizQuestions = shuffleArray(buildQuizQuestionPool()).slice(0, QUIZ_QUESTION_COUNT);
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
  document.getElementById("screen-game").classList.remove("hidden");
  setGlobalNavActive("game");

  renderQuizQuestion();
  registerGameStart();
}



function startMysteryStatGame() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    alert("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "mystery";
  const secret = pool[Math.floor(Math.random() * pool.length)];
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

  const pool = POKEMON_LIST.filter((p) => p.gen === pokemon.gen);
  startGameWithSecret(pokemon, pool);
}

function startGameWithSecret(secret, pool, options = {}) {
  secretPokemon = secret;
  activePool = pool;

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
  document.getElementById("screen-game").classList.remove("hidden");
  setGlobalNavActive("game");

  document.getElementById("guess-input").focus();

  registerGameStart();
  saveCurrentGame(options.dailyKey || null);

}


function setGlobalNavActive(key) {
  const map = {
    config: "nav-config",
    game: "nav-game",
    pokedex: "nav-collection",
    types: "nav-collection",
    draft: "nav-extras",
    emu: "nav-extras",
    rank: "nav-extras",
  };

  Object.values(map).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
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
  document.getElementById("screen-profile")?.classList.add("hidden");
  document.getElementById("screen-achievements")?.classList.add("hidden");
  document.getElementById("screen-history")?.classList.add("hidden");
  document.getElementById("screen-multiplayer")?.classList.add("hidden");
  document.getElementById("screen-odd-one-out")?.classList.add("hidden");
  document.getElementById("screen-game").classList.remove("hidden");
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
  partySession = null;
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-profile")?.classList.add("hidden");
  document.getElementById("screen-achievements")?.classList.add("hidden");
  document.getElementById("screen-history")?.classList.add("hidden");
  document.getElementById("screen-multiplayer")?.classList.add("hidden");
  document.getElementById("screen-odd-one-out")?.classList.add("hidden");
  stopEmulatorSession();
  setQuizModeLayout(false);
  stopCrySound();
  closeRankingPicker();
  document.querySelector(".search-bar")?.classList.remove("hidden");
  hideCustomModeSurfaces();
  document.getElementById("screen-config").classList.remove("hidden");
  setGlobalNavActive("config");
}

function scrollToHomeCategory(category) {
  const targetMap = {
    play: "home-play",
    social: "home-social",
    champions: "home-extras",
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
  return POKEMON_LIST.filter((p) => selectedGens.has(p.gen));
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
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiId}`);
    if (!response.ok) return null;

    const data = await response.json();
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
  cryAudio.pause();
  cryAudio.currentTime = 0;
}

function playCrySound() {
  if (gameMode !== "cry" || !secretPokemon) return;

  const url = getPokemonCryUrl(secretPokemon);

  if (!cryAudio || cryAudio.src !== url) {
    cryAudio = new Audio(url);
    cryAudio.preload = "auto";
  }

  cryAudio.currentTime = 0;
  cryAudio.play().catch(() => {
    showErr("Impossible de lire le cri pour ce Pokémon.");
  });
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

  const base = POKEMON_LIST.filter((p) => !p.isAltForm && Number.isInteger(p.id) && p.id <= 1025);
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
      <img src="${getPokemonSprite(p)}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSprite}'" />
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

function filterMultiplayerGuessAC() {
  const input = document.getElementById("multiplayer-guess-input");
  const list = document.getElementById("multiplayer-guess-ac");
  acIndex = -1;

  const qNorm = norm(input?.value.trim());
  if (!qNorm || !multiplayerBotState?.pool?.length) {
    list?.classList.add("hidden");
    return;
  }

  const excludedNames = new Set(
    [...(multiplayerBotState.playerGuessIds || new Set())]
      .map((id) => POKEMON_BY_ID.get(id)?.name)
      .filter(Boolean)
  );
  const matches = multiplayerBotState.pool
    .filter((pokemon) => norm(pokemon.name).includes(qNorm) && !excludedNames.has(pokemon.name))
    .slice(0, AC_LIMIT);
  renderMultiplayerGuessAC(matches);
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
      <img src="${getPokemonSprite(p)}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSprite}'" />
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

// ============================================================
// GAMEPLAY
// ============================================================
function submitGuess() {
  if (gameOver) return;

  document.getElementById("guess-ac").classList.add("hidden");

  const raw = document.getElementById("guess-input").value.trim();
  if (!raw) {
    showErr("Entre un nom de Pokémon !");
    return;
  }

  const found = findPokemon(raw);
  if (!found) {
    showErr(`"${raw}" introuvable dans le pool actif.`);
    return;
  }

  if (guessedSet.has(found.name)) {
    showErr(`Tu as déjà proposé ${found.name} !`);
    return;
  }

  clearErr();
  attempts += 1;
  document.getElementById("try-count").textContent = String(attempts);

  guessedNames.push(found.name);
  guessedSet.add(found.name);

  const cmp = compare(found, secretPokemon);
  resultHistory.push({ pokemon: found, cmp });

  addRow(found, cmp);
  document.getElementById("results-wrap").classList.remove("hidden");
  document.getElementById("guess-input").value = "";
  document.getElementById("guess-input").focus();

  guessCache.clear();
  updateSilhouettePanel(false);
  updatePixelPanel(false);
  saveCurrentGame();

  if (found.name === secretPokemon.name) {
    gameOver = true;
    showWin();
  }
}

function surrenderGame() {
  if (gameOver || !secretPokemon || gameMode === "quiz") return;

  gameOver = true;
  const box = document.getElementById("win-box");
  const winSprite = document.getElementById("win-sprite");
  const winTitle = document.getElementById("win-title");
  const shareBtn = document.getElementById("btn-share");
  const surrenderBtn = document.getElementById("btn-surrender");

  winSprite.onerror = () => {
    winSprite.onerror = null;
    winSprite.src = getSpriteUrl(getPokemonSpriteId(secretPokemon));
  };
  winSprite.src = getPokemonSprite(secretPokemon);

  if (winTitle) winTitle.textContent = "Abandon";
  document.getElementById("win-text").textContent = `Tu as abandonné. Le Pokémon était ${secretPokemon.name}.`;

  if (shareBtn) shareBtn.classList.add("hidden");
  if (surrenderBtn) surrenderBtn.classList.add("hidden");
  document.getElementById("share-ok").classList.add("hidden");

  box.classList.remove("hidden");
  box.classList.remove("win-animate");
  void box.offsetWidth;
  box.classList.add("win-animate");

  updateSilhouettePanel(true);
  updatePixelPanel(true);
  updateMysteryPanel(true);
  updateCryPanel(true);
  stopCrySound();
  recordMatchHistory({ mode: gameMode, result: "loss", attempts, targetName: secretPokemon.name });
  clearSavedGame();
  finishPartyRound(false);

  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function compare(guess, secret) {
  const type1State =
    guess.type1 === secret.type1
      ? "ok"
      : guess.type1 && guess.type1 === secret.type2
      ? "close"
      : "wrong";

  const type2State =
    guess.type2 === secret.type2
      ? "ok"
      : guess.type2 && guess.type2 === secret.type1
      ? "close"
      : "wrong";

  return {
    generation: guess.gen === secret.gen ? "ok" : "wrong",
    altForm: Boolean(guess.isAltForm) === Boolean(secret.isAltForm) ? "ok" : "wrong",
    type1: type1State,
    type2: type2State,
    habitat: guess.habitat === secret.habitat ? "ok" : "wrong",
    color: compareColors(guess.color, secret.color),
    stage: guess.stage === secret.stage ? "ok" : "wrong",
    height: cmpNum(guess.height, secret.height, 0.3),
    weight: cmpNum(guess.weight, secret.weight, 15),
  };
}

function cmpNum(gVal, sVal, tolerance) {
  if (gVal === sVal) return "ok";
  if (Math.abs(gVal - sVal) <= tolerance) return "close";
  return "wrong";
}

function buildComparisonRowHtml(pokemon, cmp, targetPokemon) {
  const hArrow = arrowFor(pokemon.height, targetPokemon.height);
  const wArrow = arrowFor(pokemon.weight, targetPokemon.weight);
  const fallbackSprite = getSpriteUrl(getPokemonSpriteId(pokemon));

  return `
    <td>
      <div class="poke-cell">
        <img src="${getPokemonSprite(pokemon)}" alt="${pokemon.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSprite}'" />
        ${pokemon.name}
      </div>
    </td>
    <td class="${cls(cmp.generation)}">Gen ${pokemon.gen}</td>
    <td class="${cls(cmp.altForm)}">${pokemon.isAltForm ? "Oui" : "Non"}</td>
    <td class="${cls(cmp.type1)}">${pokemon.type1}</td>
    <td class="${cls(cmp.type2)}">${pokemon.type2 || "Aucun"}</td>
    <td class="${cls(cmp.habitat)}">${pokemon.habitat}</td>
    <td class="${cls(cmp.color)}">${formatColorLabel(pokemon.color)}</td>
    <td class="${cls(cmp.stage)}">${pokemon.stage}</td>
    <td class="${cls(cmp.height)}">
      <div class="cell-num">
        ${pokemon.height}m
        ${cmp.height !== "ok" ? `<span class="${hArrow === "↑" ? "arrow-up" : "arrow-down"}">${hArrow}</span>` : ""}
      </div>
    </td>
    <td class="${cls(cmp.weight)}">
      <div class="cell-num">
        ${pokemon.weight}kg
        ${cmp.weight !== "ok" ? `<span class="${wArrow === "↑" ? "arrow-up" : "arrow-down"}">${wArrow}</span>` : ""}
      </div>
    </td>
  `;
}

function addRow(pokemon, cmp) {
  const tbody = document.getElementById("results-body");
  const tr = document.createElement("tr");
  tr.innerHTML = buildComparisonRowHtml(pokemon, cmp, secretPokemon);
  tbody.insertBefore(tr, tbody.firstChild);
}

function cls(result) {
  if (result === "ok") return "c-ok";
  if (result === "close") return "c-close";
  return "c-wrong";
}

function arrowFor(guessVal, secretVal) {
  if (guessVal === secretVal) return "";
  return guessVal < secretVal ? "↑" : "↓";
}

function triggerWinCelebration(box) {
  if (!box) return;

  document.body.classList.remove("win-page-celebrate");
  void document.body.offsetWidth;
  document.body.classList.add("win-page-celebrate");

  const oldFlash = document.querySelector(".win-page-flash");
  if (oldFlash) oldFlash.remove();
  const flash = document.createElement("div");
  flash.className = "win-page-flash";
  document.body.appendChild(flash);

  const oldConfetti = document.querySelector(".win-confetti-layer");
  if (oldConfetti) oldConfetti.remove();
  const confettiLayer = document.createElement("div");
  confettiLayer.className = "win-confetti-layer";
  for (let i = 0; i < 56; i += 1) {
    const c = document.createElement("span");
    c.className = "win-confetti";
    c.style.left = `${Math.random() * 100}%`;
    c.style.animationDelay = `${Math.random() * 0.35}s`;
    c.style.animationDuration = `${1.4 + Math.random() * 1.1}s`;
    c.style.transform = `translateY(-10px) rotate(${Math.floor(Math.random() * 360)}deg)`;
    c.style.background = ["#ffd45f", "#ff7a59", "#5db4ff", "#7ce98d", "#c49cff"][Math.floor(Math.random() * 5)];
    confettiLayer.appendChild(c);
  }
  document.body.appendChild(confettiLayer);

  box.classList.remove("win-celebrate");
  void box.offsetWidth;
  box.classList.add("win-celebrate");

  const oldBurst = box.querySelector(".win-burst");
  if (oldBurst) oldBurst.remove();

  const burst = document.createElement("div");
  burst.className = "win-burst";

  for (let i = 0; i < 36; i += 1) {
    const star = document.createElement("span");
    star.className = "burst-star";
    const angle = (i / 36) * 360;
    const dist = 52 + Math.floor(Math.random() * 58);
    star.style.setProperty("--a", `${angle}deg`);
    star.style.setProperty("--d", `${dist}px`);
    star.style.animationDelay = `${(i % 9) * 0.025}s`;
    burst.appendChild(star);
  }

  box.appendChild(burst);
  setTimeout(() => {
    burst.remove();
    box.classList.remove("win-celebrate");
    flash.remove();
    confettiLayer.remove();
    document.body.classList.remove("win-page-celebrate");
  }, 1700);
}

function showWin() {
  const box = document.getElementById("win-box");
  const winSprite = document.getElementById("win-sprite");
  const winTitle = document.getElementById("win-title");
  const shareBtn = document.getElementById("btn-share");
  const surrenderBtn = document.getElementById("btn-surrender");

  winSprite.onerror = () => {
    winSprite.onerror = null;
    winSprite.src = getSpriteUrl(getPokemonSpriteId(secretPokemon));
  };
  winSprite.src = getPokemonSprite(secretPokemon);

  if (winTitle) winTitle.textContent = "BRAVO !";
  if (shareBtn) shareBtn.classList.remove("hidden");
  if (surrenderBtn) surrenderBtn.classList.add("hidden");

  document.getElementById("win-text").textContent =
    `C'était ${secretPokemon.name} • trouvé en ${attempts} essai${attempts > 1 ? "s" : ""} !`;

  box.classList.remove("hidden");
  document.getElementById("share-ok").classList.add("hidden");

  // restart animation cleanly
  box.classList.remove("win-animate");
  void box.offsetWidth;
  box.classList.add("win-animate");
  triggerWinCelebration(box);

  updateSilhouettePanel(true);
  updatePixelPanel(true);
  updateMysteryPanel(true);
  updateCryPanel(true);
  registerWin();
  recordMatchHistory({ mode: gameMode, result: "win", attempts, targetName: secretPokemon?.name || null });
  clearSavedGame();
  finishPartyRound(true);

  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function shareResult() {
  if (!secretPokemon) return;

  const emojiMap = { ok: "🟩", close: "🟨", wrong: "⬜" };

  let header = "Pokédle";
  if (gameMode === "daily") header += " • Pokémon du jour";
  if (gameMode === "challenge") header += " • Défi Ami";
  if (gameMode === "pixel") header += " • Mode pixelisé";
  if (gameMode === "mystery") header += " • Stat Mystère";
  if (gameMode === "cry") header += " • Cri du Pokémon";

  let text = `${header}\n${attempts} essai${attempts > 1 ? "s" : ""}\n\n`;

  resultHistory.forEach(({ pokemon, cmp }) => {
    const line = [cmp.generation, cmp.altForm, cmp.type1, cmp.type2, cmp.habitat, cmp.color, cmp.stage, cmp.height, cmp.weight]
      .map((r) => emojiMap[r])
      .join("");
    text += `${pokemon.name}: ${line}\n`;
  });

  text += "\nJoue ici : " + window.location.href;

  navigator.clipboard.writeText(text).then(() => {
    document.getElementById("share-ok").classList.remove("hidden");
    setTimeout(() => document.getElementById("share-ok").classList.add("hidden"), 3000);
  });
}

// ============================================================
// ============================================================
// RANKING MODE
// ============================================================
const STARTER_IDS = new Set([
  1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393,
  495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816,
  906, 909, 912,
]);

const LEGENDARY_IDS = new Set([
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251,
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
  638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  716, 717, 718, 719, 720, 721,
  785, 786, 787, 788, 789, 790, 791, 792, 800, 801, 802, 803, 804, 805, 806, 807,
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898,
  1001, 1002, 1003, 1004, 1007, 1008, 1024, 1025,
]);


const RANKING_TYPEBAR_URL = "typebar.png";
const RANKING_GENBAR_URL = "genbar.png";
const TYPEBAR_COL_COUNT = 22; // Normal..Favorite
const GENBAR_ROW_COUNT = 10; // Pick your favorites + Gen I..IX

const SPECIAL_COLUMN_HEADER_INDEX = {
  starter: 18,
  gimmick: 19,
  legend: 20,
  favorite: 21,
};

function buildRankingColumns() {
  const cols = RANKING_TYPES.map((type, index) => ({
    key: "type|" + type,
    label: type,
    headerIndex: index,
    matcher: (p) => p.type1 === type || p.type2 === type,
  }));

  cols.push(
    { key: "starter", label: "Starter", headerIndex: SPECIAL_COLUMN_HEADER_INDEX.starter, matcher: (p) => STARTER_IDS.has(p.id) },
    { key: "gimmick", label: "Forme", headerIndex: SPECIAL_COLUMN_HEADER_INDEX.gimmick, matcher: (p) => Boolean(p.isAltForm) },
    { key: "legend", label: "Légendes", headerIndex: SPECIAL_COLUMN_HEADER_INDEX.legend, matcher: (p) => LEGENDARY_IDS.has(p.id) }
  );

  return cols;
}

const RANKING_COLUMNS = buildRankingColumns();

function fillTypeHeaderCell(th, label, index) {
  const wrap = document.createElement("div");
  wrap.className = "rank-type-sheet";
  wrap.style.setProperty("--sheet-index", String(index));
  wrap.style.setProperty("--sheet-count", String(TYPEBAR_COL_COUNT - 1));
  wrap.style.setProperty("--sheet-url", `url("${RANKING_TYPEBAR_URL}")`);
  wrap.title = label;
  wrap.setAttribute("aria-label", label);
  th.innerHTML = "";
  th.appendChild(wrap);
}

function fillGenHeaderCell(th, gen) {
  const wrap = document.createElement("div");
  wrap.className = "rank-gen-sheet";
  wrap.style.setProperty("--sheet-index", String(gen - 1));
  wrap.style.setProperty("--sheet-count", String(GENBAR_ROW_COUNT - 1));
  wrap.style.setProperty("--sheet-url", `url("${RANKING_GENBAR_URL}")`);
  wrap.title = "Gen " + gen;
  wrap.setAttribute("aria-label", "Gen " + gen);
  th.innerHTML = "";
  th.appendChild(wrap);
}

function fillCornerHeaderCell(th) {
  const wrap = document.createElement("div");
  wrap.className = "rank-corner-label";
  wrap.textContent = "Gen";
  wrap.title = "Génération";
  wrap.setAttribute("aria-label", "Génération");
  th.innerHTML = "";
  th.appendChild(wrap);
}
function rankingCellKey(gen, colKey) {
  return String(gen) + "|" + colKey;
}

function rankingFavoriteKey(gen) {
  return "fav|" + String(gen);
}

function loadRankingChoices() {
  const parsed = readJson(STORAGE_KEYS.ranking, {});
  rankingChoices = parsed && typeof parsed === "object" ? parsed : {};
}

function saveRankingChoices() {
  writeJson(STORAGE_KEYS.ranking, rankingChoices);
}

function openRankingMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  stopEmulatorSession();
  document.getElementById("screen-ranking").classList.remove("hidden");
  setGlobalNavActive("rank");
  closeRankingPicker();
  renderRankingGrid();
}

function getRankingChoicePokemon(gen, colKey) {
  const id = Number(rankingChoices[rankingCellKey(gen, colKey)]);
  return Number.isInteger(id) ? POKEMON_BY_ID.get(id) || null : null;
}

function getRowCandidates(gen) {
  const out = [];
  const seen = new Set();
  for (const col of RANKING_COLUMNS) {
    const p = getRankingChoicePokemon(gen, col.key);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function getRowFavoritePokemon(gen) {
  const id = Number(rankingChoices[rankingFavoriteKey(gen)]);
  return Number.isInteger(id) ? POKEMON_BY_ID.get(id) || null : null;
}

function renderRankingGrid() {
  const wrap = document.getElementById("ranking-grid");
  if (!wrap) return;

  wrap.innerHTML = "";

  const table = document.createElement("table");
  table.className = "ranking-table";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  const corner = document.createElement("th");
  corner.className = "rank-corner";
  fillCornerHeaderCell(corner);
  hr.appendChild(corner);

  for (const col of RANKING_COLUMNS) {
    const th = document.createElement("th");
    th.className = "rank-type-head";
    fillTypeHeaderCell(th, col.label, col.headerIndex);
    hr.appendChild(th);
  }

  const favHead = document.createElement("th");
  favHead.className = "rank-type-head rank-fav-head";
  fillTypeHeaderCell(favHead, "Préféré", SPECIAL_COLUMN_HEADER_INDEX.favorite);
  hr.appendChild(favHead);

  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let gen = 1; gen <= 9; gen += 1) {
    const tr = document.createElement("tr");

    const gth = document.createElement("th");
    gth.className = "rank-gen-head";
    fillGenHeaderCell(gth, gen);
    tr.appendChild(gth);

    for (const col of RANKING_COLUMNS) {
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rank-slot";

      const pokemon = getRankingChoicePokemon(gen, col.key);
      if (pokemon) {
        btn.classList.add("filled");
        const img = document.createElement("img");
        img.src = getPokemonSprite(pokemon);
        img.alt = pokemon.name;
        img.loading = "lazy";
        const label = document.createElement("span");
        label.textContent = pokemon.name;
        btn.appendChild(img);
        btn.appendChild(label);
      } else {
        const empty = document.createElement("span");
        empty.className = "rank-slot-empty";
        empty.textContent = "+";
        btn.appendChild(empty);
      }

      btn.addEventListener("click", () => openRankingPickerForCell(gen, col.key, btn));
      td.appendChild(btn);
      tr.appendChild(td);
    }

    const favTd = document.createElement("td");
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    favBtn.className = "rank-slot rank-favorite-slot";

    const favPokemon = getRowFavoritePokemon(gen);
    if (favPokemon) {
      favBtn.classList.add("filled");
      const img = document.createElement("img");
      img.src = getPokemonSprite(favPokemon);
      img.alt = favPokemon.name;
      img.loading = "lazy";
      const label = document.createElement("span");
      label.textContent = favPokemon.name;
      favBtn.appendChild(img);
      favBtn.appendChild(label);
    } else {
      const empty = document.createElement("span");
      empty.className = "rank-slot-empty";
      empty.textContent = "?";
      favBtn.appendChild(empty);
    }

    favBtn.addEventListener("click", () => openRankingPickerForRowFavorite(gen, favBtn));
    favTd.appendChild(favBtn);
    tr.appendChild(favTd);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  renderPickedSummary();
}

function openRankingPickerForCell(gen, colKey, anchorEl) {
  const col = RANKING_COLUMNS.find((c) => c.key === colKey);
  if (!col) return;

  rankingSelected = { mode: "cell", gen, colKey, key: rankingCellKey(gen, colKey), anchorEl };

  rankingCandidates = POKEMON_LIST
    .filter((p) => p.gen === gen && col.matcher(p))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  showRankingFloatPicker("Gen " + gen + " • " + col.label, String(rankingCandidates.length) + " Pokémon possibles", rankingCandidates, anchorEl);
}

function openRankingPickerForRowFavorite(gen, anchorEl) {
  rankingSelected = { mode: "rowFav", gen, key: rankingFavoriteKey(gen), anchorEl };
  rankingCandidates = getRowCandidates(gen);

  const sub = rankingCandidates.length
    ? "Choisis parmi les Pokémon déjà placés sur cette ligne"
    : "Aucun Pokémon sélectionné sur cette ligne";

  showRankingFloatPicker("Gen " + gen + " • Préféré", sub, rankingCandidates, anchorEl);
}

function showRankingFloatPicker(title, subtitle, candidates, anchorEl) {
  const picker = document.getElementById("rank-float-picker");
  const titleEl = document.getElementById("rank-picker-title");
  const subEl = document.getElementById("rank-picker-sub");
  const list = document.getElementById("rank-float-list");

  titleEl.textContent = title;
  subEl.textContent = subtitle;
  list.innerHTML = "";

  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "rank-empty-list";
    empty.textContent = "Aucun Pokémon disponible.";
    list.appendChild(empty);
  } else {
    for (const p of candidates) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "rank-float-item";
      item.title = p.name;

      const img = document.createElement("img");
      img.src = getPokemonSprite(p);
      img.alt = p.name;
      img.loading = "lazy";

      const label = document.createElement("span");
      label.textContent = p.name;

      item.appendChild(img);
      item.appendChild(label);
      item.addEventListener("click", () => selectRankingPokemon(p.id));
      list.appendChild(item);
    }
  }

  picker.classList.remove("hidden");

  const anchor = anchorEl ? anchorEl.getBoundingClientRect() : null;
  const pickerRect = picker.getBoundingClientRect();

  let left = 20;
  let top = 20;

  if (anchor) {
    left = anchor.left + (anchor.width / 2) - (pickerRect.width / 2);
    top = anchor.top + anchor.height + 8;

    const maxLeft = window.innerWidth - pickerRect.width - 12;
    left = Math.max(12, Math.min(left, Math.max(12, maxLeft)));

    const maxTop = window.innerHeight - pickerRect.height - 12;
    if (top > maxTop) {
      top = Math.max(12, anchor.top - pickerRect.height - 8);
    }
  }

  picker.style.left = Math.round(left) + "px";
  picker.style.top = Math.round(top) + "px";
}

function closeRankingPicker() {
  rankingSelected = null;
  rankingCandidates = [];
  const picker = document.getElementById("rank-float-picker");
  const list = document.getElementById("rank-float-list");
  if (list) list.innerHTML = "";
  if (picker) picker.classList.add("hidden");
}

function selectRankingPokemon(pokemonId) {
  if (!rankingSelected) return;

  rankingChoices[rankingSelected.key] = pokemonId;
  saveRankingChoices();
  renderRankingGrid();
  closeRankingPicker();
}

function clearRankingSelection() {
  if (!rankingSelected) return;

  delete rankingChoices[rankingSelected.key];
  saveRankingChoices();
  renderRankingGrid();
  closeRankingPicker();
}

function resetRankingChoices() {
  rankingChoices = {};
  saveRankingChoices();
  renderRankingGrid();
  closeRankingPicker();
}

function renderPickedSummary() {
  const wrap = document.getElementById("ranking-picked-grid");
  if (!wrap) return;

  wrap.innerHTML = "";

  const seen = new Set();
  const picked = [];

  for (const value of Object.values(rankingChoices)) {
    const id = Number(value);
    if (!Number.isInteger(id) || seen.has(id)) continue;
    const p = POKEMON_BY_ID.get(id);
    if (!p) continue;
    seen.add(id);
    picked.push(p);
  }

  picked.sort((a, b) => a.gen - b.gen || a.name.localeCompare(b.name, "fr"));

  if (!picked.length) {
    const empty = document.createElement("div");
    empty.className = "rank-empty-list";
    empty.textContent = "Aucun Pokémon sélectionné pour le moment.";
    wrap.appendChild(empty);
    return;
  }

  for (const p of picked) {
    const card = document.createElement("div");
    card.className = "picked-card";

    const img = document.createElement("img");
    img.src = getPokemonSprite(p);
    img.alt = p.name;
    img.loading = "lazy";

    const name = document.createElement("span");
    name.textContent = p.name + " (Gen " + p.gen + ")";

    card.appendChild(img);
    card.appendChild(name);
    wrap.appendChild(card);
  }
}

window.addEventListener("click", (e) => {
  const picker = document.getElementById("rank-float-picker");
  if (!picker || picker.classList.contains("hidden")) return;
  if (e.target.closest("#rank-float-picker") || e.target.closest(".rank-slot")) return;
  closeRankingPicker();
});

const TYPE_ICON_FILE_BY_FR = {
  Normal: "Normal",
  Feu: "Fire",
  Eau: "Water",
  Plante: "Grass",
  "Électrik": "Electric",
  Glace: "Ice",
  Combat: "Fighting",
  Poison: "Poison",
  Sol: "Ground",
  Vol: "Flying",
  Psy: "Psychic",
  Insecte: "Bug",
  Roche: "Rock",
  Spectre: "Ghost",
  Dragon: "Dragon",
  "Ténèbres": "Dark",
  Acier: "Steel",
  "Fée": "Fairy",
};

const TYPE_EFFECTIVENESS = {
  Normal: { super: [], not: ["Roche", "Acier"], no: ["Spectre"] },
  Feu: { super: ["Plante", "Glace", "Insecte", "Acier"], not: ["Feu", "Eau", "Roche", "Dragon"], no: [] },
  Eau: { super: ["Feu", "Sol", "Roche"], not: ["Eau", "Plante", "Dragon"], no: [] },
  Plante: { super: ["Eau", "Sol", "Roche"], not: ["Feu", "Plante", "Poison", "Vol", "Insecte", "Dragon", "Acier"], no: [] },
  "Électrik": { super: ["Eau", "Vol"], not: ["Plante", "Électrik", "Dragon"], no: ["Sol"] },
  Glace: { super: ["Plante", "Sol", "Vol", "Dragon"], not: ["Feu", "Eau", "Glace", "Acier"], no: [] },
  Combat: { super: ["Normal", "Glace", "Roche", "Ténèbres", "Acier"], not: ["Poison", "Vol", "Psy", "Insecte", "Fée"], no: ["Spectre"] },
  Poison: { super: ["Plante", "Fée"], not: ["Poison", "Sol", "Roche", "Spectre"], no: ["Acier"] },
  Sol: { super: ["Feu", "Électrik", "Poison", "Roche", "Acier"], not: ["Plante", "Insecte"], no: ["Vol"] },
  Vol: { super: ["Plante", "Combat", "Insecte"], not: ["Électrik", "Roche", "Acier"], no: [] },
  Psy: { super: ["Combat", "Poison"], not: ["Psy", "Acier"], no: ["Ténèbres"] },
  Insecte: { super: ["Plante", "Psy", "Ténèbres"], not: ["Feu", "Combat", "Poison", "Vol", "Spectre", "Acier", "Fée"], no: [] },
  Roche: { super: ["Feu", "Glace", "Vol", "Insecte"], not: ["Combat", "Sol", "Acier"], no: [] },
  Spectre: { super: ["Psy", "Spectre"], not: ["Ténèbres"], no: ["Normal"] },
  Dragon: { super: ["Dragon"], not: ["Acier"], no: ["Fée"] },
  "Ténèbres": { super: ["Psy", "Spectre"], not: ["Combat", "Ténèbres", "Fée"], no: [] },
  Acier: { super: ["Glace", "Roche", "Fée"], not: ["Feu", "Eau", "Électrik", "Acier"], no: [] },
  "Fée": { super: ["Combat", "Dragon", "Ténèbres"], not: ["Feu", "Poison", "Acier"], no: [] },
};

const PROFESSIONAL_MODE_CONFIG = {
  startNormalGame: { label: "Solo classique", description: "Le mode principal pour deviner le Pokémon mystère.", category: "classic" },
  startDailyGame: { label: "Pokémon du jour", description: "Une partie quotidienne avec un Pokémon fixe selon la date.", category: "classic" },
  startSilhouetteGame: { label: "Zoom progressif", description: "Découvre progressivement le sprite en zoomant sur l'image.", category: "classic" },
  startPixelGame: { label: "Mode pixelisé", description: "Le sprite se révèle au fil des essais.", category: "classic" },
  startQuizGame: { label: "Quiz Pokémon", description: "Réponds à une série de questions sur l'univers Pokémon.", category: "challenge" },
  startMysteryStatGame: { label: "Stat Mystère", description: "Retrouve le Pokémon grâce à ses statistiques.", category: "challenge" },
  startWeightBattle: { label: "Duel de poids", description: "Choisis le Pokémon le plus lourd entre deux propositions.", category: "challenge" },
  startEvolutionChainGame: { label: "Chaîne d'évolution", description: "Complète la lignée d'évolution manquante.", category: "challenge" },
  startPokedexOrderGame: { label: "Ordre Pokédex", description: "Trouve le Pokémon placé entre deux numéros.", category: "challenge" },
  startPartyMode: { label: "Party Pokémon", description: "Enchaîne plusieurs mini-jeux dans une même session.", category: "challenge" },
  openPokedexMode: { label: "Pokédex", description: "Consulte les fiches détaillées des Pokémon disponibles.", category: "collection" },
  openTypeChartScreen: { label: "Table des types", description: "Affiche les tableaux d'efficacité des types selon les générations.", category: "collection" },
  openProfileScreen: { label: "Profil joueur", description: "Retrouve ton profil local et ta progression.", category: "collection" },
  openAchievementsScreen: { label: "Succès", description: "Consulte les objectifs débloqués et à venir.", category: "collection" },
  openRankingMode: { label: "Mode classement", description: "Organise les Pokémon dans des tableaux thématiques.", category: "collection" },
  openDraftArenaMode: { label: "Draft Arènes", description: "Compose une équipe et affronte une série d'arènes.", category: "tools" },
  openEmulatorMode: { label: "Émulateur", description: "Lance un jeu Pokémon directement depuis l'interface.", category: "tools" },
};

const TYPE_CHART_CONFIG = {
  gen1: {
    label: "Gen 1",
    description: "Table spécifique à la première génération, avant l'ajout des types Acier, Ténèbres et Fée.",
    types: ["Combat", "Dragon", "Eau", "Électrik", "Feu", "Glace", "Insecte", "Normal", "Plante", "Poison", "Psy", "Roche", "Sol", "Spectre", "Vol"],
  },
  "gen2-5": {
    label: "Gen 2-5",
    description: "Ajout des types Acier et Ténèbres. Le type Fée n'existe pas encore dans cette période.",
    types: ["Acier", "Combat", "Dragon", "Eau", "Électrik", "Feu", "Glace", "Insecte", "Normal", "Plante", "Poison", "Psy", "Roche", "Sol", "Spectre", "Ténèbres", "Vol"],
  },
  "gen6+": {
    label: "Gen 6+",
    description: "Table moderne avec le type Fée et les interactions actuelles.",
    types: ["Acier", "Combat", "Dragon", "Eau", "Électrik", "Fée", "Feu", "Glace", "Insecte", "Normal", "Plante", "Poison", "Psy", "Roche", "Sol", "Spectre", "Ténèbres", "Vol"],
  },
};

const TYPE_EFFECTIVENESS_GEN1 = {
  Normal: { super: [], not: ["Roche"], no: ["Spectre"] },
  Feu: { super: ["Plante", "Glace", "Insecte"], not: ["Feu", "Eau", "Roche", "Dragon"], no: [] },
  Eau: { super: ["Feu", "Sol", "Roche"], not: ["Eau", "Plante", "Dragon"], no: [] },
  Plante: { super: ["Eau", "Sol", "Roche"], not: ["Feu", "Plante", "Poison", "Vol", "Insecte", "Dragon"], no: [] },
  "Électrik": { super: ["Eau", "Vol"], not: ["Plante", "Électrik", "Dragon"], no: ["Sol"] },
  Glace: { super: ["Plante", "Sol", "Vol", "Dragon"], not: ["Eau"], no: [] },
  Combat: { super: ["Normal", "Glace", "Roche"], not: ["Poison", "Vol", "Psy", "Insecte"], no: ["Spectre"] },
  Poison: { super: ["Plante", "Insecte"], not: ["Poison", "Sol", "Roche", "Spectre"], no: [] },
  Sol: { super: ["Feu", "Électrik", "Poison", "Roche"], not: ["Plante", "Insecte"], no: ["Vol"] },
  Vol: { super: ["Plante", "Combat", "Insecte"], not: ["Électrik", "Roche"], no: [] },
  Psy: { super: ["Combat", "Poison"], not: ["Psy"], no: [] },
  Insecte: { super: ["Plante", "Psy", "Poison"], not: ["Feu", "Combat", "Vol", "Spectre"], no: [] },
  Roche: { super: ["Feu", "Glace", "Vol", "Insecte"], not: ["Combat", "Sol"], no: [] },
  Spectre: { super: ["Spectre"], not: [], no: ["Normal", "Psy"] },
  Dragon: { super: ["Dragon"], not: [], no: [] },
};

function cloneTypeChart(chart) {
  const out = {};
  Object.entries(chart).forEach(([type, data]) => {
    out[type] = {
      super: data.super.slice(),
      not: data.not.slice(),
      no: data.no.slice(),
    };
  });
  return out;
}

function removeTypeFromChart(chart, type) {
  delete chart[type];
  Object.values(chart).forEach((data) => {
    data.super = data.super.filter((entry) => entry !== type);
    data.not = data.not.filter((entry) => entry !== type);
    data.no = data.no.filter((entry) => entry !== type);
  });
}

function getTypeChartEffectiveness(eraKey) {
  if (eraKey === "gen1") return cloneTypeChart(TYPE_EFFECTIVENESS_GEN1);

  const chart = cloneTypeChart(TYPE_EFFECTIVENESS);

  if (eraKey === "gen2-5") {
    removeTypeFromChart(chart, "Fée");
    if (chart.Spectre && !chart.Spectre.not.includes("Acier")) chart.Spectre.not.push("Acier");
    if (chart["Ténèbres"] && !chart["Ténèbres"].not.includes("Acier")) chart["Ténèbres"].not.push("Acier");
  }

  return chart;
}

function getTypeChartMultiplier(chart, attackType, defenseType) {
  const data = chart[attackType];
  if (!data) return 1;
  if (data.no.includes(defenseType)) return 0;
  if (data.super.includes(defenseType)) return 2;
  if (data.not.includes(defenseType)) return 0.5;
  return 1;
}

function formatTypeChartMultiplier(multiplier) {
  if (multiplier === 2) return "x2";
  if (multiplier === 0.5) return "x1/2";
  if (multiplier === 0) return "x0";
  return "x1";
}

function getTypeChartCellClass(multiplier) {
  if (multiplier === 2) return "is-super";
  if (multiplier === 0.5) return "is-not-very";
  if (multiplier === 0) return "is-immune";
  return "is-neutral";
}

function renderTypeChartScreen() {
  const wrap = document.getElementById("type-chart-wrap");
  const note = document.getElementById("type-chart-note");
  const select = document.getElementById("type-chart-era");
  const offenseSelect = document.getElementById("type-chart-offense-filter");
  const defenseSelect = document.getElementById("type-chart-defense-filter");
  const config = TYPE_CHART_CONFIG[typeChartEra] || TYPE_CHART_CONFIG["gen6+"];
  if (!wrap || !note || !select || !offenseSelect || !defenseSelect) return;

  select.value = typeChartEra;
  if (!config.types.includes(typeChartOffenseFilter)) typeChartOffenseFilter = "all";
  if (!config.types.includes(typeChartDefenseFilter)) typeChartDefenseFilter = "all";

  offenseSelect.innerHTML = `<option value="all">Tous les types offensifs</option>${config.types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;
  defenseSelect.innerHTML = `<option value="all">Tous les types défensifs</option>${config.types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;
  offenseSelect.value = typeChartOffenseFilter;
  defenseSelect.value = typeChartDefenseFilter;

  note.textContent = `${config.description} Lignes = type offensif (attaque), colonnes = type défensif. Exemple : en Gen 2-5, l'immunité Spectre contre Combat se lit ligne Combat, colonne Spectre = x0.`;

  const chart = getTypeChartEffectiveness(typeChartEra);
  const offenseTypes = typeChartOffenseFilter === "all" ? config.types : config.types.filter((type) => type === typeChartOffenseFilter);
  const defenseTypes = typeChartDefenseFilter === "all" ? config.types : config.types.filter((type) => type === typeChartDefenseFilter);
  const head = defenseTypes.map((type) => `<th class="type-chart-type-head">${typeBadgeHtml(type)}</th>`).join("");
  const body = offenseTypes.map((attackType) => {
    const cells = defenseTypes.map((defenseType) => {
      const multiplier = getTypeChartMultiplier(chart, attackType, defenseType);
      return `<td class="type-chart-cell ${getTypeChartCellClass(multiplier)}">${formatTypeChartMultiplier(multiplier)}</td>`;
    }).join("");
    return `<tr><th class="type-chart-type-side">${typeBadgeHtml(attackType)}</th>${cells}</tr>`;
  }).join("");

  wrap.innerHTML = `
    <div class="type-chart-scroll">
      <table class="type-chart-table">
        <thead>
          <tr>
            <th class="type-chart-corner">Att. / Déf.</th>
            ${head}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function initTypeChartScreen() {
  const select = document.getElementById("type-chart-era");
  const offenseSelect = document.getElementById("type-chart-offense-filter");
  const defenseSelect = document.getElementById("type-chart-defense-filter");
  if (!select || !offenseSelect || !defenseSelect) return;
  select.addEventListener("change", () => {
    typeChartEra = select.value;
    renderTypeChartScreen();
  });
  offenseSelect.addEventListener("change", () => {
    typeChartOffenseFilter = offenseSelect.value;
    renderTypeChartScreen();
  });
  defenseSelect.addEventListener("change", () => {
    typeChartDefenseFilter = defenseSelect.value;
    renderTypeChartScreen();
  });
}

function openTypeChartScreen() {
  [
    "screen-config",
    "screen-game",
    "screen-ranking",
    "screen-games-ranking",
    "screen-pokedex",
    "screen-draft-arena",
    "screen-profile",
    "screen-achievements",
    "screen-history",
    "screen-multiplayer",
    "screen-odd-one-out",
    "screen-emulator",
  ].forEach(hideScreen);
  stopEmulatorSession();
  stopCrySound();
  setQuizModeLayout(false);
  closeRankingPicker();
  showScreen("screen-type-chart");
  setGlobalNavActive("types");
  renderTypeChartScreen();
}

function getTypeIconPath(typeFr) {
  const file = TYPE_ICON_FILE_BY_FR[typeFr];
  return file ? `types/${file}.png` : null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function typeBadgeHtml(typeFr) {
  if (!typeFr) return "";
  const icon = getTypeIconPath(typeFr);
  const iconHtml = icon ? `<img src="${icon}" alt="${escapeHtml(typeFr)}" loading="lazy" />` : "";
  return `<span class="type-badge">${iconHtml}<span>${escapeHtml(typeFr)}</span></span>`;
}

function renderHomeTypeHelper() {
  const select = document.getElementById("home-type-helper-select");
  const strong = document.getElementById("home-type-helper-strong");
  const weak = document.getElementById("home-type-helper-weak");
  const resisted = document.getElementById("home-type-helper-resisted");
  if (!select || !strong || !weak || !resisted) return;

  const data = TYPE_EFFECTIVENESS[select.value];
  if (!data) return;

  const renderList = (items) => items.length ? items.map((type) => typeBadgeHtml(type)).join("") : '<span class="home-type-helper-empty">Aucun</span>';

  strong.innerHTML = renderList(data.super);
  weak.innerHTML = renderList(data.no);
  resisted.innerHTML = renderList(data.not);
}

function initHomeTypeHelper() {
  const select = document.getElementById("home-type-helper-select");
  if (!select) return;
  select.addEventListener("change", renderHomeTypeHelper);
  renderHomeTypeHelper();
}

function renderHomeDefenseTypeHelper() {
  const type1 = document.getElementById("home-defense-type1");
  const type2 = document.getElementById("home-defense-type2");
  const weak = document.getElementById("home-defense-weaknesses");
  const resist = document.getElementById("home-defense-resistances");
  const immune = document.getElementById("home-defense-immunities");
  if (!type1 || !type2 || !weak || !resist || !immune) return;

  const selectedType1 = type1.value;
  const selectedType2 = type2.value || null;
  const entries = Object.keys(TYPE_EFFECTIVENESS).map((atk) => {
    const multiplier = attackMultiplier(atk, selectedType1) * attackMultiplier(atk, selectedType2);
    return { type: atk, multiplier };
  });

  const renderList = (items) => items.length ? items.map((entry) => typeBadgeHtml(entry.type)).join("") : '<span class="home-type-helper-empty">Aucun</span>';

  weak.innerHTML = renderList(entries.filter((entry) => entry.multiplier > 1).sort((a, b) => b.multiplier - a.multiplier));
  resist.innerHTML = renderList(entries.filter((entry) => entry.multiplier > 0 && entry.multiplier < 1).sort((a, b) => a.multiplier - b.multiplier));
  immune.innerHTML = renderList(entries.filter((entry) => entry.multiplier === 0));
}

function initHomeDefenseTypeHelper() {
  const type1 = document.getElementById("home-defense-type1");
  const type2 = document.getElementById("home-defense-type2");
  if (!type1 || !type2) return;
  type1.addEventListener("change", renderHomeDefenseTypeHelper);
  type2.addEventListener("change", renderHomeDefenseTypeHelper);
  renderHomeDefenseTypeHelper();
}

function renderHomeTeamSuggestionHelper() {
  const type1 = document.getElementById("home-team-type1");
  const type2 = document.getElementById("home-team-type2");
  const output = document.getElementById("home-team-suggestions");
  if (!type1 || !type2 || !output) return;

  const selected = [type1.value, type2.value || null].filter(Boolean);
  const uniqueSelected = [...new Set(selected)];
  const currentWeaknesses = Object.keys(TYPE_EFFECTIVENESS)
    .map((attackType) => ({
      type: attackType,
      multiplier: uniqueSelected.reduce((product, defenseType) => product * attackMultiplier(attackType, defenseType), 1),
    }))
    .filter((entry) => entry.multiplier > 1);

  const suggestions = Object.keys(TYPE_EFFECTIVENESS)
    .filter((candidate) => !uniqueSelected.includes(candidate))
    .map((candidate) => {
      const resistCount = currentWeaknesses.filter((weakness) => attackMultiplier(weakness.type, candidate) < 1).length;
      const immuneCount = currentWeaknesses.filter((weakness) => attackMultiplier(weakness.type, candidate) === 0).length;
      const pressureCount = currentWeaknesses.filter((weakness) => attackMultiplier(candidate, weakness.type) > 1).length;
      const diversityBonus = uniqueSelected.every((existing) => attackMultiplier(candidate, existing) !== 0.5) ? 1 : 0;
      const score = immuneCount * 5 + resistCount * 3 + pressureCount * 2 + diversityBonus;
      return { type: candidate, score };
    })
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type, "fr"))
    .slice(0, 5);

  output.innerHTML = suggestions.length
    ? suggestions.map((entry) => typeBadgeHtml(entry.type)).join("")
    : '<span class="home-type-helper-empty">Aucune suggestion</span>';
}

function initHomeTeamSuggestionHelper() {
  const type1 = document.getElementById("home-team-type1");
  const type2 = document.getElementById("home-team-type2");
  if (!type1 || !type2) return;
  type1.addEventListener("change", renderHomeTeamSuggestionHelper);
  type2.addEventListener("change", renderHomeTeamSuggestionHelper);
  renderHomeTeamSuggestionHelper();
}

function typeBadgesHtml(type1, type2) {
  const badges = [typeBadgeHtml(type1)];
  if (type2) badges.push(typeBadgeHtml(type2));
  return badges.join("");
}

function flavorTextFr(speciesData) {
  if (!speciesData?.flavor_text_entries) return "Description non disponible.";

  const entries = speciesData.flavor_text_entries;
  const fr = entries.find((e) => e?.language?.name === "fr");
  const en = entries.find((e) => e?.language?.name === "en");
  const chosen = fr || en;
  if (!chosen?.flavor_text) return "Description non disponible.";

  return chosen.flavor_text.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
}

function statFromPokemonData(pokeData, key) {
  if (!pokeData?.stats) return null;
  const entry = pokeData.stats.find((s) => s?.stat?.name === key);
  return Number.isFinite(Number(entry?.base_stat)) ? Number(entry.base_stat) : null;
}

function statsRowsHtml(pokeData) {
  const rows = [
    { key: "hp", label: "PV", max: 255 },
    { key: "attack", label: "Attaque", max: 190 },
    { key: "defense", label: "Défense", max: 250 },
    { key: "special-attack", label: "Attaque Spé.", max: 194 },
    { key: "special-defense", label: "Défense Spé.", max: 250 },
    { key: "speed", label: "Vitesse", max: 200 },
  ];

  const values = rows.map((r) => ({
    label: r.label,
    value: statFromPokemonData(pokeData, r.key),
    max: r.max,
  }));

  const total = values.reduce((sum, s) => sum + (Number.isFinite(s.value) ? s.value : 0), 0);

  const lines = values.map((s) => {
    const value = Number.isFinite(s.value) ? s.value : "?";
    const ratio = Number.isFinite(s.value) ? Math.max(0, Math.min(1, s.value / s.max)) : 0;
    return `<div class="pokedex-stat-row"><span>${s.label}</span><div class="pokedex-stat-track"><i style="width:${Math.round(ratio * 100)}%"></i></div><b>${value}</b></div>`;
  });

  lines.push(`<div class="pokedex-stat-row total"><span>Total</span><div class="pokedex-stat-track"><i style="width:${Math.round(Math.max(0, Math.min(1, total / 780)) * 100)}%"></i></div><b>${total}</b></div>`);
  return lines.join("");
}

function abilityNameFr(abilityData) {
  if (!abilityData?.names) return null;
  const fr = abilityData.names.find((n) => n?.language?.name === "fr");
  return fr?.name || null;
}

async function fetchPokedexAbilityData(url) {
  if (typeof url !== "string" || !url) return null;
  if (POKEDEX_ABILITY_CACHE.has(url)) return POKEDEX_ABILITY_CACHE.get(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    POKEDEX_ABILITY_CACHE.set(url, data);
    return data;
  } catch (_err) {
    return null;
  }
}

async function abilitiesHtml(pokeData) {
  if (!pokeData?.abilities?.length) return "<p class=\"pokedex-muted\">Talents non disponibles.</p>";

  const abilities = await Promise.all(
    pokeData.abilities
      .slice()
      .sort((a, b) => Number(a.slot) - Number(b.slot))
      .map(async (a) => {
        const abilityData = await fetchPokedexAbilityData(a.ability?.url);
        const fr = abilityNameFr(abilityData);
        const rawName = a.ability?.name || "Talent";
        const fallback = rawName.charAt(0).toUpperCase() + rawName.slice(1).replace(/-/g, " ");
        const name = fr || fallback;
        const hidden = a.is_hidden ? "<em>Talent caché</em>" : "";
        return `<div class=\"pokedex-ability\"><b>${escapeHtml(name)}</b>${hidden}</div>`;
      })
  );

  return abilities.join("");
}

function getPokemonShinySprite(pokemon) {
  if (!pokemon) return "";
  const sprite = getPokemonSprite(pokemon);
  if (typeof sprite === "string" && sprite.includes("/sprites/pokemon/")) {
    return sprite.replace("/sprites/pokemon/", "/sprites/pokemon/shiny/");
  }
  return draftShinySpriteUrl(getPokemonSpriteId(pokemon));
}

function getPokedexDisplaySprite(pokemon, useShiny = false) {
  if (!pokemon) return "";
  return useShiny ? getPokemonShinySprite(pokemon) : getPokemonSprite(pokemon);
}

function updatePokedexShinyButton() {
  const button = document.getElementById("pokedex-shiny-toggle");
  const localButton = document.getElementById("pokedex-detail-shiny-toggle");
  if (button) {
    button.textContent = `Shiny : ${pokedexGridUseShiny ? "Oui" : "Non"}`;
    button.classList.toggle("active", pokedexGridUseShiny);
  }
  if (localButton) {
    localButton.textContent = pokedexSelectedShiny ? "Shiny" : "Normal";
    localButton.classList.toggle("active", pokedexSelectedShiny);
  }
}

function togglePokedexGridShiny() {
  pokedexGridUseShiny = !pokedexGridUseShiny;
  updatePokedexShinyButton();
  renderPokedexGrid();
}

function togglePokedexShiny() {
  pokedexSelectedShiny = !pokedexSelectedShiny;
  updatePokedexShinyButton();
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || null);
}

function attackMultiplier(attackType, defenseType) {
  if (!defenseType) return 1;
  const m = TYPE_EFFECTIVENESS[attackType];
  if (!m) return 1;
  if (m.no.includes(defenseType)) return 0;
  if (m.super.includes(defenseType)) return 2;
  if (m.not.includes(defenseType)) return 0.5;
  return 1;
}

function typeMatchupHtml(type1, type2) {
  const entries = Object.keys(TYPE_EFFECTIVENESS).map((atk) => {
    const m = attackMultiplier(atk, type1) * attackMultiplier(atk, type2 || null);
    return { type: atk, m };
  });

  const weak = entries.filter((e) => e.m > 1).sort((a, b) => b.m - a.m);
  const resist = entries.filter((e) => e.m > 0 && e.m < 1).sort((a, b) => a.m - b.m);
  const immune = entries.filter((e) => e.m === 0);

  const badge = (e) => `<span class=\"match-badge\"><span class=\"match-badge-type\">${typeBadgeHtml(e.type)}</span><b class=\"match-badge-multiplier\">x${e.m}</b></span>`;
  const none = '<span class="pokedex-muted">Aucun</span>';

  return `
    <div class=\"pokedex-match-section\"><span>Faiblesses</span><div class=\"pokedex-match-list\">${weak.length ? weak.map(badge).join("") : none}</div></div>
    <div class=\"pokedex-match-section\"><span>Résistances</span><div class=\"pokedex-match-list\">${resist.length ? resist.map(badge).join("") : none}</div></div>
    <div class=\"pokedex-match-section\"><span>Immunités</span><div class=\"pokedex-match-list\">${immune.length ? immune.map(badge).join("") : none}</div></div>
  `;
}

function formatGenderRate(speciesData) {
  const rate = Number(speciesData?.gender_rate);
  if (!Number.isFinite(rate) || rate < 0) return "Asexué / inconnu";
  const female = Math.round((rate / 8) * 100);
  const male = 100 - female;
  return `${male}% mâle / ${female}% femelle`;
}

function formatEggGroups(speciesData) {
  const list = Array.isArray(speciesData?.egg_groups) ? speciesData.egg_groups : [];
  if (!list.length) return "Inconnu";
  return list.map((g) => g?.name || "?").join(" / ");
}

function formatHatchCycles(speciesData) {
  const n = Number(speciesData?.hatch_counter);
  return Number.isFinite(n) && n >= 0 ? `${n} cycles` : "Inconnu";
}

async function fetchPokedexPokemonData(apiId) {
  if (!apiId) return null;
  if (POKEDEX_API_CACHE.has(apiId)) return POKEDEX_API_CACHE.get(apiId);

  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiId}`);
    if (!response.ok) return null;
    const data = await response.json();
    POKEDEX_API_CACHE.set(apiId, data);
    return data;
  } catch (_err) {
    return null;
  }
}

async function fetchPokedexSpeciesData(speciesId) {
  if (!speciesId) return null;
  if (POKEDEX_SPECIES_CACHE.has(speciesId)) return POKEDEX_SPECIES_CACHE.get(speciesId);

  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
    if (!response.ok) return null;
    const data = await response.json();
    POKEDEX_SPECIES_CACHE.set(speciesId, data);
    return data;
  } catch (_err) {
    return null;
  }
}

function speciesIdFromUrl(url) {
  if (typeof url !== "string") return null;
  const m = url.match(/\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

function getPokedexTypes() {
  const set = new Set();
  for (const p of POKEMON_LIST) {
    if (p.type1) set.add(p.type1);
    if (p.type2) set.add(p.type2);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}
function initPokedex() {
  const search = document.getElementById("pokedex-search");
  const gen = document.getElementById("pokedex-gen-filter");
  const type = document.getElementById("pokedex-type-filter");
  const shinyToggle = document.getElementById("pokedex-shiny-toggle");
  if (!search || !gen || !type) return;

  gen.innerHTML = '<option value="all">Toutes les générations</option>';
  for (const [num, data] of Object.entries(GENERATIONS)) {
    const opt = document.createElement("option");
    opt.value = String(num);
    opt.textContent = `Gen ${num} - ${data.label}`;
    gen.appendChild(opt);
  }

  type.innerHTML = '<option value="all">Tous les types</option>';
  for (const t of getPokedexTypes()) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    type.appendChild(opt);
  }

  search.addEventListener("input", () => {
    pokedexSearch = search.value.trim();
    renderPokedexGrid();
  });

  gen.addEventListener("change", () => {
    pokedexGenFilter = gen.value;
    renderPokedexGrid();
  });

  type.addEventListener("change", () => {
    pokedexTypeFilter = type.value;
    renderPokedexGrid();
  });

  shinyToggle?.addEventListener("click", togglePokedexGridShiny);

  updatePokedexShinyButton();
}

function openPokedexMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  stopEmulatorSession();
  document.getElementById("screen-pokedex").classList.remove("hidden");
  setGlobalNavActive("pokedex");
  setQuizModeLayout(false);
  stopCrySound();
  closeRankingPicker();

  const search = document.getElementById("pokedex-search");
  const gen = document.getElementById("pokedex-gen-filter");
  const type = document.getElementById("pokedex-type-filter");
  if (search) search.value = pokedexSearch;
  if (gen) gen.value = pokedexGenFilter;
  if (type) type.value = pokedexTypeFilter;
  updatePokedexShinyButton();

  renderPokedexGrid();
}

function getFilteredPokedexList() {
  const q = norm(pokedexSearch || "");

  return POKEMON_LIST
    .filter((p) => {
      if (pokedexGenFilter !== "all" && String(p.gen) !== pokedexGenFilter) return false;
      if (pokedexTypeFilter !== "all" && p.type1 !== pokedexTypeFilter && p.type2 !== pokedexTypeFilter) return false;
      if (q && !norm(p.name).includes(q)) return false;
      return true;
    })
    .sort((a, b) => getPokemonSpriteId(a) - getPokemonSpriteId(b) || a.name.localeCompare(b.name, "fr"));
}

function renderPokedexGrid() {
  const grid = document.getElementById("pokedex-grid");
  if (!grid) return;

  const list = getFilteredPokedexList();
  grid.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "rank-empty-list";
    empty.textContent = "Aucun Pokémon trouvé avec ces filtres.";
    grid.appendChild(empty);
    renderPokedexDetail(null);
    return;
  }

  const ids = new Set(list.map((p) => p.id));
  if (!pokedexSelectedId || !ids.has(pokedexSelectedId)) {
    pokedexSelectedId = list[0].id;
  }

  for (const p of list) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "pokedex-card" + (p.id === pokedexSelectedId ? " selected" : "");

    const dexId = getPokemonSpriteId(p);
    const sprite = getPokedexDisplaySprite(p, pokedexGridUseShiny);

    card.innerHTML = `
      <img src="${sprite}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(dexId)}'" />
      <span class="pokedex-num">#${dexId}</span>
      <strong>${p.name}</strong>
    `;

    card.addEventListener("click", () => {
      pokedexSelectedId = p.id;
      pokedexSelectedShiny = false;
      renderPokedexGrid();
    });

    grid.appendChild(card);
  }

  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || list[0]);
}

async function renderPokedexDetail(pokemon) {
  const detail = document.getElementById("pokedex-detail");
  if (!detail) return;

  if (!pokemon) {
    detail.innerHTML = '<p class="card-desc">Clique un Pokémon pour afficher sa fiche.</p>';
    return;
  }

  const currentRequest = ++pokedexDetailRequestId;
  const dexId = getPokemonSpriteId(pokemon);

  detail.innerHTML = `
    <div class="pokedex-detail-head">
      <img src="${getPokedexDisplaySprite(pokemon, pokedexSelectedShiny)}" alt="${pokemon.name}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(dexId)}'" />
      <div>
        <div class="pokedex-detail-title-row">
          <h3>${pokemon.name}</h3>
          <button id="pokedex-detail-shiny-toggle" class="btn-ghost pokedex-detail-shiny-btn" type="button" onclick="togglePokedexShiny()">${pokedexSelectedShiny ? "Shiny" : "Normal"}</button>
        </div>
        <p>#${dexId}${pokemon.isAltForm ? " ? Forme alternative" : ""}</p>
        <div class="pokedex-type-row">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
      </div>
    </div>
    <div class="pokedex-detail-grid">
      <div><span>Génération</span><b>Gen ${pokemon.gen}</b></div>
      <div><span>Taille</span><b>${pokemon.height} m</b></div>
      <div><span>Poids</span><b>${pokemon.weight} kg</b></div>
      <div><span>Habitat</span><b>${escapeHtml(pokemon.habitat || "Inconnu")}</b></div>
      <div><span>Couleur</span><b>${escapeHtml(formatColorLabel(pokemon.color))}</b></div>
      <div><span>Stade</span><b>${pokemon.stage}</b></div>
    </div>
    <div class="pokedex-section"><h4>Entrée Pokédex</h4><p class="pokedex-muted">Chargement...</p></div>
    <div class="pokedex-section"><h4>Talents</h4><p class="pokedex-muted">Chargement...</p></div>
    <div class="pokedex-section"><h4>Statistiques de base</h4><p class="pokedex-muted">Chargement...</p></div>
    <div class="pokedex-section"><h4>Faiblesses et résistances</h4>${typeMatchupHtml(pokemon.type1, pokemon.type2)}</div>
    <div class="pokedex-section"><h4>Infos utiles</h4><div class="pokedex-detail-grid pokedex-extra-grid"><div><span>Capture</span><b>Chargement...</b></div><div><span>Genre</span><b>Chargement...</b></div><div><span>Groupes d'oeufs</span><b>Chargement...</b></div><div><span>Eclosion</span><b>Chargement...</b></div></div></div>
  `;

  const apiId = getMysteryApiId(pokemon);
  if (!apiId) return;

  const pokeData = await fetchPokedexPokemonData(apiId);
  if (!pokeData || currentRequest !== pokedexDetailRequestId) return;

  const speciesId = speciesIdFromUrl(pokeData?.species?.url) || apiId;
  const speciesData = await fetchPokedexSpeciesData(speciesId);
  if (currentRequest !== pokedexDetailRequestId) return;

  const description = flavorTextFr(speciesData);
  const abilities = await abilitiesHtml(pokeData);
  const stats = statsRowsHtml(pokeData);
  const captureRate = Number.isFinite(Number(speciesData?.capture_rate)) ? String(speciesData.capture_rate) : "Inconnu";
  const gender = formatGenderRate(speciesData);
  const eggs = formatEggGroups(speciesData);
  const hatch = formatHatchCycles(speciesData);

  detail.innerHTML = `
    <div class="pokedex-detail-head">
      <img src="${getPokedexDisplaySprite(pokemon, pokedexSelectedShiny)}" alt="${pokemon.name}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(dexId)}'" />
      <div>
        <div class="pokedex-detail-title-row">
          <h3>${pokemon.name}</h3>
          <button id="pokedex-detail-shiny-toggle" class="btn-ghost pokedex-detail-shiny-btn" type="button" onclick="togglePokedexShiny()">${pokedexSelectedShiny ? "Shiny" : "Normal"}</button>
        </div>
        <p>#${dexId}${pokemon.isAltForm ? " ? Forme alternative" : ""}</p>
        <div class="pokedex-type-row">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
      </div>
    </div>
    <div class="pokedex-detail-grid">
      <div><span>Génération</span><b>Gen ${pokemon.gen}</b></div>
      <div><span>Taille</span><b>${pokemon.height} m</b></div>
      <div><span>Poids</span><b>${pokemon.weight} kg</b></div>
      <div><span>Habitat</span><b>${escapeHtml(pokemon.habitat || "Inconnu")}</b></div>
      <div><span>Couleur</span><b>${escapeHtml(formatColorLabel(pokemon.color))}</b></div>
      <div><span>Stade</span><b>${pokemon.stage}</b></div>
    </div>
    <div class="pokedex-section"><h4>Entrée Pokédex</h4><p>${escapeHtml(description)}</p></div>
    <div class="pokedex-section"><h4>Talents</h4><div class="pokedex-abilities">${abilities}</div></div>
    <div class="pokedex-section"><h4>Statistiques de base</h4><div class="pokedex-stats-wrap">${stats}</div></div>
    <div class="pokedex-section"><h4>Faiblesses et résistances</h4>${typeMatchupHtml(pokemon.type1, pokemon.type2)}</div>
    <div class="pokedex-section"><h4>Infos utiles</h4><div class="pokedex-detail-grid pokedex-extra-grid"><div><span>Capture</span><b>${captureRate}</b></div><div><span>Genre</span><b>${escapeHtml(gender)}</b></div><div><span>Groupes d'oeufs</span><b>${escapeHtml(eggs)}</b></div><div><span>Eclosion</span><b>${escapeHtml(hatch)}</b></div></div></div>
  `;
}
function defaultGameRatingEntry() {
  return {
    story: 5,
    pokemon: 5,
    region: 5,
    difficulty: 5,
    nostalgia: 5,
  };
}

function clampGameScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function normalizeGameRatingEntry(raw) {
  const base = defaultGameRatingEntry();
  const src = raw && typeof raw === "object" ? raw : {};
  for (const key of GAME_RATING_FIELDS) {
    base[key] = clampGameScore(src[key]);
  }
  return base;
}

function calcGameGlobalNote(entry) {
  let sum = 0;
  for (const key of GAME_RATING_FIELDS) sum += clampGameScore(entry[key]);
  return sum / GAME_RATING_FIELDS.length;
}

function loadGamesRanking() {
  const parsed = readJson(STORAGE_KEYS.gamesRanking, {});
  const safe = parsed && typeof parsed === "object" ? parsed : {};
  gamesRanking = {};

  for (const game of POKEMON_MAIN_GAMES) {
    gamesRanking[game.key] = normalizeGameRatingEntry(safe[game.key]);
  }
}

function saveGamesRanking() {
  writeJson(STORAGE_KEYS.gamesRanking, gamesRanking);
}

function openGamesRankingMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  stopEmulatorSession();
  closeRankingPicker();
  document.getElementById("screen-games-ranking").classList.remove("hidden");
  setGlobalNavActive("rank");
  renderGamesRankingTable();
}

function resetGamesRanking() {
  gamesRanking = {};
  loadGamesRanking();
  saveGamesRanking();
  renderGamesRankingTable();
}

function renderGamesRankingTable() {
  const wrap = document.getElementById("games-ranking-wrap");
  if (!wrap) return;

  wrap.innerHTML = "";

  const table = document.createElement("table");
  table.className = "games-ranking-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Jeu</th>
      <th>Histoire</th>
      <th>Pokémon</th>
      <th>Région</th>
      <th>Difficulté</th>
      <th>Nostalgie</th>
      <th>Note globale</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (const game of POKEMON_MAIN_GAMES) {
    const entry = normalizeGameRatingEntry(gamesRanking[game.key]);
    gamesRanking[game.key] = entry;

    const tr = document.createElement("tr");

    const tdGame = document.createElement("td");
    tdGame.className = "games-name";
    tdGame.textContent = game.name;
    tr.appendChild(tdGame);

    for (const key of GAME_RATING_FIELDS) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.className = "games-score-input";
      input.min = "1";
      input.max = "10";
      input.step = "1";
      input.value = String(entry[key]);

      const commit = () => {
        const next = clampGameScore(input.value);
        input.value = String(next);
        entry[key] = next;
        gamesRanking[game.key] = entry;
        avgValue.textContent = calcGameGlobalNote(entry).toFixed(1);
        saveGamesRanking();
      };

      input.addEventListener("change", commit);
      input.addEventListener("blur", commit);

      td.appendChild(input);
      tr.appendChild(td);
    }

    const tdAvg = document.createElement("td");
    tdAvg.className = "games-global-note";
    const avgValue = document.createElement("b");
    avgValue.textContent = calcGameGlobalNote(entry).toFixed(1);
    tdAvg.appendChild(avgValue);
    tr.appendChild(tdAvg);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
  saveGamesRanking();
}

const DRAFT_TEAM_SIZE = 6;
const DRAFT_PICK_COUNT = 6;
const DRAFT_SHINY_CHANCE = 0.01;
const DRAFT_POWER_CACHE = new Map();

const DRAFT_GEN_OPTIONS = [
  { gen: 1, label: "Gen 1 (Kanto)", min: 1, max: 151 },
  { gen: 2, label: "Gen 2 (Johto)", min: 152, max: 251 },
  { gen: 3, label: "Gen 3 (Hoenn)", min: 252, max: 386 },
  { gen: 4, label: "Gen 4 (Sinnoh)", min: 387, max: 493 },
  { gen: 5, label: "Gen 5 (Unys)", min: 494, max: 649 },
  { gen: 6, label: "Gen 6 (Kalos)", min: 650, max: 721 },
  { gen: 7, label: "Gen 7 (Alola)", min: 722, max: 809 },
  { gen: 8, label: "Gen 8 (Galar)", min: 810, max: 905 },
  { gen: 9, label: "Gen 9 (Paldea)", min: 906, max: 99999 },
];

const DRAFT_ARENAS_BY_GEN = {
  1: [
    { name: "Pierre", type: "Roche", badgeName: "Boulder Badge", badgeFile: "Boulder_Badge.png" },
    { name: "Ondine", type: "Eau", badgeName: "Cascade Badge", badgeFile: "Cascade_Badge.png" },
    { name: "Major Bob", type: "Électrik", badgeName: "Thunder Badge", badgeFile: "Thunder_Badge.png" },
    { name: "Erika", type: "Plante", badgeName: "Rainbow Badge", badgeFile: "Rainbow_Badge.png" },
    { name: "Koga", type: "Poison", badgeName: "Soul Badge", badgeFile: "Soul_Badge.png" },
    { name: "Sabrina", type: "Psy", badgeName: "Marsh Badge", badgeFile: "Marsh_Badge.png" },
    { name: "Blaine", type: "Feu", badgeName: "Volcano Badge", badgeFile: "Volcano_Badge.png" },
    { name: "Giovanni", type: "Sol", badgeName: "Earth Badge", badgeFile: "Earth_Badge.png" },
  ],
  2: [
    { name: "Falkner", type: "Vol", badgeName: "Zephyr Badge", badgeFile: "Zephyr_Badge.png" },
    { name: "Bugsy", type: "Insecte", badgeName: "Hive Badge", badgeFile: "Hive_Badge.png" },
    { name: "Whitney", type: "Normal", badgeName: "Plain Badge", badgeFile: "Plain_Badge.png" },
    { name: "Morty", type: "Spectre", badgeName: "Fog Badge", badgeFile: "Fog_Badge.png" },
    { name: "Chuck", type: "Combat", badgeName: "Storm Badge", badgeFile: "Storm_Badge.png" },
    { name: "Jasmine", type: "Acier", badgeName: "Mineral Badge", badgeFile: "Mineral_Badge.png" },
    { name: "Pryce", type: "Glace", badgeName: "Glacier Badge", badgeFile: "Glacier_Badge.png" },
    { name: "Clair", type: "Dragon", badgeName: "Rising Badge", badgeFile: "Rising_Badge.png" },
  ],
  3: [
    { name: "Roxanne", type: "Roche", badgeName: "Stone Badge", badgeFile: "Stone_Badge.png" },
    { name: "Brawly", type: "Combat", badgeName: "Knuckle Badge", badgeFile: "Knuckle_Badge.png" },
    { name: "Wattson", type: "Électrik", badgeName: "Dynamo Badge", badgeFile: "Dynamo_Badge.png" },
    { name: "Flannery", type: "Feu", badgeName: "Heat Badge", badgeFile: "Heat_Badge.png" },
    { name: "Norman", type: "Normal", badgeName: "Balance Badge", badgeFile: "Balance_Badge.png" },
    { name: "Winona", type: "Vol", badgeName: "Feather Badge", badgeFile: "Feather_Badge.png" },
    { name: "Tate & Liza", type: "Psy", badgeName: "Mind Badge", badgeFile: "Mind_Badge.png" },
    { name: "Wallace", type: "Eau", badgeName: "Rain Badge", badgeFile: "Rain_Badge.png" },
  ],
  4: [
    { name: "Roark", type: "Roche", badgeName: "Coal Badge", badgeFile: "Coal_Badge.png" },
    { name: "Gardenia", type: "Plante", badgeName: "Forest Badge", badgeFile: "Forest_Badge.png" },
    { name: "Maylene", type: "Combat", badgeName: "Cobble Badge", badgeFile: "Cobble_Badge.png" },
    { name: "Crasher Wake", type: "Eau", badgeName: "Fen Badge", badgeFile: "Fen_Badge.png" },
    { name: "Fantina", type: "Spectre", badgeName: "Relic Badge", badgeFile: "Relic_Badge.png" },
    { name: "Byron", type: "Acier", badgeName: "Mine Badge", badgeFile: "Mine_Badge.png" },
    { name: "Candice", type: "Glace", badgeName: "Icicle Badge", badgeFile: "Icicle_Badge.png" },
    { name: "Volkner", type: "Électrik", badgeName: "Beacon Badge", badgeFile: "Beacon_Badge.png" },
  ],
  5: [
    { name: "Aloé", type: "Normal", badgeName: "Basic Badge", badgeFile: "Basic_Badge.png" },
    { name: "Artie", type: "Insecte", badgeName: "Insect Badge", badgeFile: "Insect_Badge.png" },
    { name: "Iris", type: "Dragon", badgeName: "Legend Badge", badgeFile: "Legend_Badge.png" },
    { name: "Parsemille", type: "Sol", badgeName: "Quake Badge", badgeFile: "Quake_Badge.png" },
    { name: "Bardane", type: "Plante", badgeName: "Plant Badge", badgeFile: "Plant_Badge.png" },
    { name: "Inezia", type: "Électrik", badgeName: "Bolt Badge", badgeFile: "Bolt_Badge.png" },
    { name: "Anis", type: "Spectre", badgeName: "Toxic Badge", badgeFile: "Toxic_Badge.png" },
    { name: "Lino", type: "Eau", badgeName: "Wave Badge", badgeFile: "Wave_Badge.png" },
  ],
  6: [
    { name: "Violette", type: "Insecte", badgeName: "Bug Badge", badgeFile: "Bug_Badge.png" },
    { name: "Ramos", type: "Plante", badgeName: "Plant Badge", badgeFile: "Plant_Badge.png" },
    { name: "Korrina", type: "Combat", badgeName: "Rumble Badge", badgeFile: "Rumble_Badge.png" },
    { name: "Amaro", type: "Plante", badgeName: "Plant Badge", badgeFile: "Plant_Badge.png" },
    { name: "Lem", type: "Électrik", badgeName: "Voltage Badge", badgeFile: "Voltage_Badge.png" },
    { name: "Valériane", type: "Fée", badgeName: "Fairy Badge", badgeFile: "Fairy_Badge.png" },
    { name: "Olympia", type: "Psy", badgeName: "Psychic Badge", badgeFile: "Psychic_Badge.png" },
    { name: "Glacia", type: "Glace", badgeName: "Iceberg Badge", badgeFile: "Iceberg_Badge.png" },
  ],
  7: [
    { name: "Ilima", type: "Normal", badgeName: "Normalium Z" },
    { name: "Néphie", type: "Eau", badgeName: "Waterium Z" },
    { name: "Barbara", type: "Poison", badgeName: "Poisonium Z" },
    { name: "Kiawe", type: "Feu", badgeName: "Firium Z" },
    { name: "Margie", type: "Spectre", badgeName: "Ghostium Z" },
    { name: "Pectorius", type: "Combat", badgeName: "Fightinium Z" },
    { name: "Kahili", type: "Vol", badgeName: "Flyinium Z" },
    { name: "Alyxia", type: "Roche", badgeName: "Rockium Z" },
  ],
  8: [
    { name: "Donna", type: "Plante", badgeName: "Grass Badge", badgeFile: "Grass_Badge.png" },
    { name: "Nabil", type: "Eau", badgeName: "Water Badge", badgeFile: "Water_Badge.png" },
    { name: "Savell", type: "Feu", badgeName: "Fire Badge", badgeFile: "Fire_Badge.png" },
    { name: "Faïza", type: "Combat", badgeName: "Fighting Badge", badgeFile: "Fighting_Badge.png" },
    { name: "Sally", type: "Fée", badgeName: "Fairy Badge", badgeFile: "Fairy_Badge.png" },
    { name: "Chaz", type: "Roche", badgeName: "Rock Badge", badgeFile: "Rock_Badge.png" },
    { name: "Alistair", type: "Spectre", badgeName: "Ghost Badge", badgeFile: "Ghost_Badge.png" },
    { name: "Roy", type: "Dragon", badgeName: "Dragon Badge", badgeFile: "Dragon_Badge.png" },
  ],
  9: [
    { name: "Katy", type: "Insecte", badgeName: "Badge Insecte" },
    { name: "Mashynn", type: "Électrik", badgeName: "Badge Électrik" },
    { name: "Kofu", type: "Eau", badgeName: "Badge Eau" },
    { name: "Larry", type: "Normal", badgeName: "Badge Normal" },
    { name: "Ryme", type: "Spectre", badgeName: "Badge Spectre" },
    { name: "Tulip", type: "Psy", badgeName: "Badge Psy" },
    { name: "Grusha", type: "Glace", badgeName: "Badge Glace" },
    { name: "Alisma", type: "Sol", badgeName: "Badge Sol" },
  ],
};

function createDraftArenaState() {
  return {
    phase: "gen", // gen | draft | result
    selectedGen: null,
    team: [],
    selectedDexIds: new Set(),
    options: [],
    shinyCount: 0,
    badgeResults: [],
    teamPower: 0,
    teamSynergy: 0,
    runSummary: null,
    evaluating: false,
    showDetailedAnalysis: false,
    message: "Choisis une génération pour commencer le draft.",
  };
}

function draftGenLabel(gen) {
  const found = DRAFT_GEN_OPTIONS.find((g) => g.gen === gen);
  return found ? found.label : `Gen ${gen}`;
}

function draftShinySpriteUrl(dexId) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${dexId}.png`;
}

function getDraftBadgeImageUrl(arena) {
  if (!arena?.badgeFile) return "";
  return `https://archives.bulbagarden.net/wiki/Special:Redirect/file/${arena.badgeFile}`;
}

function getDraftBadgeMarkup(arena, statusClass = "") {
  const badgeName = arena?.badgeName || `${arena?.type || "Badge"}`;
  const imageUrl = getDraftBadgeImageUrl(arena);
  if (imageUrl) {
    return `<span class="draft-official-badge ${statusClass}"><img src="${imageUrl}" alt="${escapeHtml(badgeName)}" loading="lazy" /></span>`;
  }
  return `<span class="draft-official-badge draft-official-badge-fallback ${statusClass}">${typeBadgeHtml(arena?.type || "Normal")}<small>${escapeHtml(badgeName)}</small></span>`;
}

function clampDraftValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function draftEraKeyForGen(gen) {
  if (gen === 1) return "gen1";
  if (gen >= 2 && gen <= 5) return "gen2-5";
  return "gen6+";
}

function getDraftTypeChart(gen) {
  return getTypeChartEffectiveness(draftEraKeyForGen(gen));
}

function getDraftAttackMultiplier(gen, attackType, defenseType) {
  if (!defenseType) return 1;
  return getTypeChartMultiplier(getDraftTypeChart(gen), attackType, defenseType);
}

function getDraftBestOffenseMultiplier(gen, pokemon, arenaType) {
  const first = getDraftAttackMultiplier(gen, pokemon.type1, arenaType);
  const second = pokemon.type2 ? getDraftAttackMultiplier(gen, pokemon.type2, arenaType) : 0;
  return Math.max(first, second);
}

function getDraftDefenseMultiplier(gen, pokemon, arenaType) {
  return getDraftAttackMultiplier(gen, arenaType, pokemon.type1) * getDraftAttackMultiplier(gen, arenaType, pokemon.type2 || null);
}

function getDraftCounterTypes(gen, arenaType) {
  return (getDraftTypeChart(gen)?.[arenaType] ? Object.keys(getDraftTypeChart(gen)) : Object.keys(TYPE_EFFECTIVENESS))
    .filter((type) => getDraftAttackMultiplier(gen, type, arenaType) > 1);
}

function getDraftFallbackStatTotal(pokemon) {
  const stage = Number(pokemon?.stage) || 1;
  const weightScore = Math.min(48, Math.round((Number(pokemon?.weight) || 0) / 4));
  const heightScore = Math.min(24, Math.round((Number(pokemon?.height) || 0) * 8));
  const dualTypeBonus = pokemon?.type2 ? 34 : 0;
  const habitatBonus = pokemon?.habitat === "Rare" ? 48 : 0;
  return clampDraftValue(255 + stage * 52 + weightScore + heightScore + dualTypeBonus + habitatBonus, 240, 680);
}

function getDraftRarityInfo(statsTotal, pokemon) {
  const rareHabitat = pokemon?.habitat === "Rare";
  if (statsTotal >= 610 || rareHabitat) return { label: "Exceptionnel", score: 12 };
  if (statsTotal >= 540) return { label: "Rare", score: 8 };
  if (statsTotal >= 470) return { label: "Solide", score: 4 };
  return { label: "Standard", score: 0 };
}

function buildDraftPowerMetrics(pokemon, stats = null) {
  const values = stats ? [stats.hp, stats.attack, stats.defense, stats.spAttack, stats.spDefense, stats.speed] : [];
  const statsTotal = values.length && values.every((value) => Number.isFinite(value))
    ? values.reduce((sum, value) => sum + value, 0)
    : getDraftFallbackStatTotal(pokemon);
  const rarity = getDraftRarityInfo(statsTotal, pokemon);
  const stageBonus = (Number(pokemon?.stage) || 1) * 4;
  const dualTypeBonus = pokemon?.type2 ? 4 : 0;
  const power = clampDraftValue(Math.round(statsTotal / 7.2 + rarity.score + stageBonus + dualTypeBonus), 35, 100);
  return {
    power,
    statsTotal,
    rarityLabel: rarity.label,
    rarityScore: rarity.score,
  };
}

function getDraftPowerCacheKey(pokemon) {
  return `${pokemon?.id || "?"}:${getPokemonSpriteId(pokemon)}`;
}

function getDraftCachedPokemonPowerData(pokemon) {
  const key = getDraftPowerCacheKey(pokemon);
  return DRAFT_POWER_CACHE.get(key) || buildDraftPowerMetrics(pokemon, null);
}

async function getDraftPokemonPowerData(pokemon) {
  const key = getDraftPowerCacheKey(pokemon);
  if (DRAFT_POWER_CACHE.has(key)) return DRAFT_POWER_CACHE.get(key);
  const stats = await fetchBattleStats(pokemon);
  const metrics = buildDraftPowerMetrics(pokemon, stats);
  DRAFT_POWER_CACHE.set(key, metrics);
  return metrics;
}

function getDraftPoolForGeneration(gen) {
  const cfg = DRAFT_GEN_OPTIONS.find((g) => g.gen === gen);
  if (!cfg) return [];

  return POKEMON_LIST.filter((p) => {
    if (!p || p.isAltForm) return false;
    const dexId = getPokemonSpriteId(p);
    if (!Number.isFinite(dexId)) return false;
    return dexId >= cfg.min && dexId <= cfg.max;
  });
}

function pickRandomUniquePokemon(pool, count, excludeDexIds = new Set()) {
  const source = pool.filter((p) => !excludeDexIds.has(getPokemonSpriteId(p)));
  const out = [];

  while (source.length && out.length < count) {
    const idx = Math.floor(Math.random() * source.length);
    out.push(source[idx]);
    source.splice(idx, 1);
  }

  return out;
}

function createDraftOptionEntry(pokemon, locked = false, shiny = Math.random() < DRAFT_SHINY_CHANCE) {
  return {
    pokemon,
    shiny,
    locked,
  };
}

function warmDraftPokemonMetrics(pokemonList) {
  const snapshot = draftArenaState;
  Promise.all((pokemonList || []).map((pokemon) => getDraftPokemonPowerData(pokemon)))
    .then(() => {
      if (snapshot && snapshot === draftArenaState && document.getElementById("screen-draft-arena") && !document.getElementById("screen-draft-arena").classList.contains("hidden")) {
        renderDraftArena();
      }
    })
    .catch(() => {
      // noop
    });
}

function fillDraftArenaOptions() {
  if (!draftArenaState || draftArenaState.phase !== "draft") return;
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);
  draftArenaState.options.forEach((option) => {
    if (option?.pokemon) excludeDexIds.add(getPokemonSpriteId(option.pokemon));
  });

  while (draftArenaState.options.length < DRAFT_PICK_COUNT) {
    const pokemon = pickRandomUniquePokemon(pool, 1, excludeDexIds)[0];
    if (!pokemon) break;
    excludeDexIds.add(getPokemonSpriteId(pokemon));
    draftArenaState.options.push(createDraftOptionEntry(pokemon));
  }

  warmDraftPokemonMetrics([
    ...draftArenaState.options.map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
}

function replaceDraftArenaOption(optionIndex) {
  if (!draftArenaState || draftArenaState.phase !== "draft") return;
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);

  draftArenaState.options = draftArenaState.options.map((option, index) => {
    if (!option?.pokemon) return option;
    if (index === optionIndex) {
      excludeDexIds.add(getPokemonSpriteId(option.pokemon));
      return createDraftOptionEntry(option.pokemon, true, option.shiny);
    }
    return option;
  });

  for (let index = 0; index < draftArenaState.options.length; index += 1) {
    const option = draftArenaState.options[index];
    if (!option || option.locked) continue;
    const replacement = pickRandomUniquePokemon(pool, 1, excludeDexIds)[0];
    if (!replacement) continue;
    excludeDexIds.add(getPokemonSpriteId(replacement));
    draftArenaState.options[index] = createDraftOptionEntry(replacement);
  }
  warmDraftPokemonMetrics([
    ...draftArenaState.options.filter(Boolean).map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
}

function selectDraftGeneration(gen) {
  if (!draftArenaState) return;

  draftArenaState.phase = "draft";
  draftArenaState.selectedGen = gen;
  draftArenaState.team = [];
  draftArenaState.selectedDexIds = new Set();
  draftArenaState.options = [];
  draftArenaState.shinyCount = 0;
  draftArenaState.badgeResults = [];
  draftArenaState.teamPower = 0;
  draftArenaState.teamSynergy = 0;
  draftArenaState.runSummary = null;
  draftArenaState.evaluating = false;
  draftArenaState.message = `Génération sélectionnée : ${draftGenLabel(gen)}. Choisis ton premier Pokémon.`;

  fillDraftArenaOptions();
  renderDraftArena();
}

function getDraftTeamSynergy(teamData) {
  const typeCounts = new Map();
  let dualTypeCount = 0;

  teamData.forEach((member) => {
    [member.pokemon.type1, member.pokemon.type2].filter(Boolean).forEach((type) => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });
    if (member.pokemon.type2) dualTypeCount += 1;
  });

  const uniqueTypes = typeCounts.size;
  let duplicatePenalty = 0;
  typeCounts.forEach((count) => {
    if (count > 2) duplicatePenalty += count - 2;
  });

  const score = clampDraftValue(uniqueTypes * 2 + dualTypeCount - duplicatePenalty * 2, 0, 24);
  return {
    score,
    label: score >= 18 ? "Excellente" : score >= 12 ? "Bonne" : score >= 7 ? "Correcte" : "Fragile",
    uniqueTypes,
  };
}

function analyzeDraftArenaBattle(teamData, arena, arenaIndex, gen, synergy) {
  const counterTypes = getDraftCounterTypes(gen, arena.type);
  const memberScores = teamData.map((member) => {
    const bestOffense = getDraftBestOffenseMultiplier(gen, member.pokemon, arena.type);
    const defenseMult = getDraftDefenseMultiplier(gen, member.pokemon, arena.type);
    const offenseBonus = bestOffense === 2 ? 14 : bestOffense === 0.5 ? -6 : bestOffense === 0 ? -14 : 0;
    const defenseBonus = defenseMult === 0 ? 16 : defenseMult === 0.25 ? 10 : defenseMult === 0.5 ? 6 : defenseMult >= 4 ? -18 : defenseMult === 2 ? -10 : 0;
    return {
      ...member,
      bestOffense,
      defenseMult,
      arenaScore: member.metrics.power + offenseBonus + defenseBonus + Math.round(member.metrics.rarityScore / 2),
    };
  });

  const topMembers = memberScores.slice().sort((a, b) => b.arenaScore - a.arenaScore).slice(0, 4);
  const offensivePressure = memberScores.filter((member) => member.bestOffense > 1);
  const resistances = memberScores.filter((member) => member.defenseMult < 1);
  const weaknesses = memberScores.filter((member) => member.defenseMult > 1);
  const uniquePressureTypes = new Set();
  offensivePressure.forEach((member) => {
    if (getDraftAttackMultiplier(gen, member.pokemon.type1, arena.type) > 1) uniquePressureTypes.add(member.pokemon.type1);
    if (member.pokemon.type2 && getDraftAttackMultiplier(gen, member.pokemon.type2, arena.type) > 1) uniquePressureTypes.add(member.pokemon.type2);
  });

  const pressureBonus = Math.min(18, offensivePressure.length * 3 + uniquePressureTypes.size * 2);
  const defensiveBonus = Math.min(18, resistances.length * 3 + memberScores.filter((member) => member.defenseMult === 0).length * 4);
  const weaknessPenalty = Math.min(18, weaknesses.length * 4);
  const topAverage = topMembers.length ? topMembers.reduce((sum, member) => sum + member.arenaScore, 0) / topMembers.length : 0;
  const estimatedScore = Math.round(topAverage + synergy.score + pressureBonus + defensiveBonus - weaknessPenalty - arenaIndex * 2);
  const threshold = 66 + arenaIndex * 4;
  const won = estimatedScore >= threshold;

  let explanation = "";
  if (won) {
    const mvp = topMembers[0]?.pokemon?.name || "l'équipe";
    const support = resistances.length ? ` et ${resistances.length} résistance${resistances.length > 1 ? "s" : ""} utiles contre ${arena.type}` : "";
    explanation = `Victoire contre ${arena.name} grâce à ${mvp}, une bonne pression offensive${support}.`;
  } else {
    const reasons = [];
    if (!offensivePressure.length) reasons.push(`manque de pression offensive ${counterTypes.slice(0, 3).join(" / ") || "adaptée"}`);
    if (!resistances.length || weaknesses.length >= Math.ceil(memberScores.length / 2)) reasons.push(`manque de résistance ${arena.type}`);
    if (synergy.score < 8) reasons.push("a une synergie trop fragile");
    explanation = `Échec contre ${arena.name} car l’équipe ${reasons.length ? reasons.join(" et ") : "n'atteint pas le niveau requis"}.`;
  }

  return {
    arena,
    won,
    status: won ? "won" : "blocked",
    estimatedScore,
    threshold,
    explanation,
    topMembers,
    offensivePressureCount: offensivePressure.length,
    resistanceCount: resistances.length,
    weaknessCount: weaknesses.length,
  };
}

function buildDraftRunSummary(teamData, badgeResults, synergy) {
  const attempted = badgeResults.filter((result) => result.status !== "untried");
  const wonCount = badgeResults.filter((result) => result.status === "won").length;
  const blocked = badgeResults.find((result) => result.status === "blocked") || null;
  const mvpScores = new Map();

  attempted.forEach((result) => {
    result.topMembers.forEach((member, index) => {
      const weight = index === 0 ? 3 : index === 1 ? 2 : 1;
      mvpScores.set(member.pokemon.name, (mvpScores.get(member.pokemon.name) || 0) + weight);
    });
  });

  const mvpEntry = [...mvpScores.entries()].sort((a, b) => b[1] - a[1])[0];
  const mvpName = mvpEntry?.[0] || teamData[0]?.pokemon?.name || "-";
  const status = blocked ? `Run arrêtée sur ${blocked.arena.name}` : "Run parfaite";

  return {
    wonCount,
    blockedArena: blocked?.arena?.name || null,
    attemptedCount: attempted.length,
    status,
    mvpName,
    synergyLabel: synergy.label,
    offenseLabel: wonCount >= 6 ? "Forte pression offensive" : wonCount >= 3 ? "Pression offensive correcte" : "Pression offensive limitée",
    balanceLabel: synergy.score >= 12 ? "Équipe équilibrée" : "Équipe encore fragile",
  };
}

function buildDraftArenaIndicators(result, runSummary) {
  if (!result || result.status === "untried") return ["Arène non tentée"];

  const indicators = [];
  if (result.offensivePressureCount >= 2) indicators.push("Forte pression offensive");
  if (result.resistanceCount >= 2) indicators.push("Bonne couverture défensive");
  if (result.weaknessCount >= 3) indicators.push(`Faiblesse contre ${result.arena.type}`);
  if (runSummary?.synergyLabel === "Excellente" || runSummary?.synergyLabel === "Bonne") indicators.push("Bonne synergie");
  if (!indicators.length) indicators.push(result.won ? "Match-up correct" : "Match-up difficile");
  return indicators.slice(0, 3);
}

function toggleDraftDetailAnalysis() {
  if (!draftArenaState || draftArenaState.phase !== "result") return;
  draftArenaState.showDetailedAnalysis = !draftArenaState.showDetailedAnalysis;
  renderDraftArena();
}

async function resolveDraftArenaRun() {
  if (!draftArenaState || draftArenaState.team.length < DRAFT_TEAM_SIZE) return;
  const snapshot = draftArenaState;
  snapshot.evaluating = true;
  snapshot.phase = "result";
  snapshot.message = `Analyse de la run ${draftGenLabel(snapshot.selectedGen)} en cours...`;
  snapshot.badgeResults = [];
  renderDraftArena();

  const teamData = await Promise.all(snapshot.team.map(async (member) => ({
    ...member,
    metrics: await getDraftPokemonPowerData(member.pokemon),
  })));

  if (snapshot !== draftArenaState) return;

  const arenas = DRAFT_ARENAS_BY_GEN[snapshot.selectedGen] || [];
  const synergy = getDraftTeamSynergy(teamData);
  const badgeResults = [];
  let blocked = false;

  arenas.forEach((arena, arenaIndex) => {
    if (blocked) {
      badgeResults.push({
        arena,
        won: false,
        status: "untried",
        estimatedScore: null,
        threshold: null,
        explanation: "Arène non tentée car la run s'est arrêtée avant.",
        topMembers: [],
      });
      return;
    }

    const result = analyzeDraftArenaBattle(teamData, arena, arenaIndex, snapshot.selectedGen, synergy);
    badgeResults.push(result);
    if (!result.won) blocked = true;
  });

  snapshot.badgeResults = badgeResults;
  snapshot.teamPower = teamData.reduce((sum, member) => sum + member.metrics.power, 0);
  snapshot.teamSynergy = synergy.score;
  snapshot.runSummary = buildDraftRunSummary(teamData, badgeResults, synergy);
  snapshot.evaluating = false;
  snapshot.message = snapshot.runSummary.blockedArena
    ? `Run arrêtée contre ${snapshot.runSummary.blockedArena}. ${snapshot.runSummary.wonCount} badge${snapshot.runSummary.wonCount > 1 ? "s" : ""} remporté${snapshot.runSummary.wonCount > 1 ? "s" : ""}.`
    : `Run parfaite sur ${draftGenLabel(snapshot.selectedGen)}. Les 8 arènes sont passées.`;

  renderDraftArena();
}

function openDraftArenaMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  closeRankingPicker();
  stopCrySound();
  setQuizModeLayout(false);
  stopEmulatorSession();
  document.getElementById("screen-draft-arena").classList.remove("hidden");
  setGlobalNavActive("draft");

  if (!draftArenaState) {
    restartDraftArenaRun();
    return;
  }

  renderDraftArena();
}

function restartDraftArenaRun() {
  draftArenaState = createDraftArenaState();
  renderDraftArena();
}

async function pickDraftArenaOption(pokemonId) {
  if (!draftArenaState || draftArenaState.phase !== "draft") return;
  if (draftArenaState.team.length >= DRAFT_TEAM_SIZE) return;

  const optionIndex = draftArenaState.options.findIndex((option) => option.pokemon.id === pokemonId);
  const picked = optionIndex >= 0 ? draftArenaState.options[optionIndex] : null;
  if (!picked) return;

  const dexId = getPokemonSpriteId(picked.pokemon);
  if (draftArenaState.selectedDexIds.has(dexId)) return;

  draftArenaState.team.push({ pokemon: picked.pokemon, shiny: picked.shiny });
  draftArenaState.selectedDexIds.add(dexId);
  if (picked.shiny) draftArenaState.shinyCount += 1;

  if (draftArenaState.team.length >= DRAFT_TEAM_SIZE) {
    draftArenaState.phase = "result";
    await resolveDraftArenaRun();
    return;
  } else {
    const remain = DRAFT_TEAM_SIZE - draftArenaState.team.length;
    draftArenaState.message = `Pokémon ajouté. Encore ${remain} choix.`;
    replaceDraftArenaOption(optionIndex);
  }

  renderDraftArena();
}

function renderDraftArena() {
  const screen = document.getElementById("screen-draft-arena");
  if (!screen || !draftArenaState) return;

  const status = document.getElementById("draft-status");
  const genBadge = document.getElementById("draft-gen-badge");
  const picksBadge = document.getElementById("draft-picks-badge");
  const shinyBadge = document.getElementById("draft-shiny-badge");
  const badgeCount = document.getElementById("draft-badge-count");
  const genButtons = document.getElementById("draft-gen-buttons");
  const options = document.getElementById("draft-options");
  const team = document.getElementById("draft-team");
  const teamMetrics = document.getElementById("draft-team-metrics");
  const runBar = document.getElementById("draft-run-bar");
  const resultWrap = document.getElementById("draft-result-wrap");
  const runSummary = document.getElementById("draft-run-summary");
  const badgeGrid = document.getElementById("draft-badge-grid");
  const arenaList = document.getElementById("draft-arena-list");
  const detailToggle = document.getElementById("draft-detail-toggle");
  const arenas = DRAFT_ARENAS_BY_GEN[draftArenaState.selectedGen] || [];

  if (status) status.textContent = draftArenaState.message;
  if (genBadge) genBadge.textContent = draftArenaState.selectedGen ? `Génération : ${draftGenLabel(draftArenaState.selectedGen)}` : "Génération : -";
  if (picksBadge) picksBadge.textContent = `Équipe : ${draftArenaState.team.length} / ${DRAFT_TEAM_SIZE}`;
  if (shinyBadge) shinyBadge.textContent = `Shiny : ${draftArenaState.shinyCount}`;

  const wonCount = draftArenaState.badgeResults.filter((result) => result.status === "won").length;
  if (badgeCount) badgeCount.textContent = `Badges : ${wonCount} / 8`;

  if (genButtons) {
    genButtons.innerHTML = "";
    for (const cfg of DRAFT_GEN_OPTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "draft-gen-btn" + (draftArenaState.selectedGen === cfg.gen ? " active" : "");
      btn.textContent = cfg.label;
      btn.disabled = draftArenaState.phase !== "gen";
      btn.addEventListener("click", () => selectDraftGeneration(cfg.gen));
      genButtons.appendChild(btn);
    }
  }

  if (options) {
    options.innerHTML = "";

    if (draftArenaState.phase === "gen") {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      msg.textContent = "Sélectionne d'abord une génération.";
      options.appendChild(msg);
    } else if (draftArenaState.phase === "result") {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      msg.textContent = draftArenaState.evaluating
        ? "Calcul de la run en cours..."
        : "Draft terminé. Consulte la run ci-dessous.";
      options.appendChild(msg);
    } else if (!draftArenaState.options.length) {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      msg.textContent = "Aucune option disponible. Réinitialise le draft.";
      options.appendChild(msg);
    } else {
      for (const option of draftArenaState.options) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "draft-option-card" + (option.shiny ? " is-shiny" : "") + (option.locked ? " picked locked" : "");
        const spriteId = getPokemonSpriteId(option.pokemon);
        const normalSprite = getPokemonSprite(option.pokemon);
        const shownSprite = option.shiny ? getPokemonShinySprite(option.pokemon) : normalSprite;
        const sparkle = option.shiny ? '<span class="draft-shiny-mark">&#10024; Shiny</span>' : "";
        const metrics = getDraftCachedPokemonPowerData(option.pokemon);
        card.innerHTML = `
          <img src="${shownSprite}" alt="${escapeHtml(option.pokemon.name)}" loading="lazy" onerror="this.onerror=null;this.src='${normalSprite}'" />
          <strong>${escapeHtml(option.pokemon.name)}</strong>
          <span>#${spriteId}</span>
          <span class="draft-card-meta">Puissance ${metrics.power} • ${escapeHtml(metrics.rarityLabel)}</span>
          <div class="draft-type-row">${typeBadgesHtml(option.pokemon.type1, option.pokemon.type2)}</div>
          ${option.locked ? '<span class="draft-lock-mark">Sélectionné</span>' : ""}
          ${sparkle}
        `;
        card.disabled = Boolean(option.locked);
        if (!option.locked) {
          card.addEventListener("click", () => {
            card.classList.add("picked");
            setTimeout(() => {
              void pickDraftArenaOption(option.pokemon.id);
            }, 140);
          });
        }
        options.appendChild(card);
      }
    }
  }

  if (team) {
    team.innerHTML = "";
    for (let index = 0; index < DRAFT_TEAM_SIZE; index += 1) {
      const member = draftArenaState.team[index];
      if (!member) {
        const empty = document.createElement("div");
        empty.className = "draft-team-card placeholder";
        empty.innerHTML = `<div><b>Slot ${index + 1}</b><span>En attente de sélection</span></div>`;
        team.appendChild(empty);
        continue;
      }

      const normalSprite = getPokemonSprite(member.pokemon);
      const shownSprite = member.shiny ? getPokemonShinySprite(member.pokemon) : normalSprite;
      const item = document.createElement("div");
      const metrics = getDraftCachedPokemonPowerData(member.pokemon);
      item.className = "draft-team-card" + (member.shiny ? " is-shiny" : "");
      item.innerHTML = `
        <img src="${shownSprite}" alt="${escapeHtml(member.pokemon.name)}" loading="lazy" onerror="this.onerror=null;this.src='${normalSprite}'" />
        <div>
          <b>${escapeHtml(member.pokemon.name)}</b>
          <span>${escapeHtml(member.pokemon.type1)}${member.pokemon.type2 ? ` / ${escapeHtml(member.pokemon.type2)}` : ""}</span>
          <small>Puissance ${metrics.power} • ${escapeHtml(metrics.rarityLabel)}</small>
        </div>
      `;
      team.appendChild(item);
    }
  }

  if (teamMetrics) {
    const currentTeamPower = draftArenaState.team.reduce((sum, member) => sum + getDraftCachedPokemonPowerData(member.pokemon).power, 0);
    const currentSynergy = draftArenaState.team.length ? getDraftTeamSynergy(draftArenaState.team.map((member) => ({ ...member, metrics: getDraftCachedPokemonPowerData(member.pokemon) }))) : null;
    teamMetrics.innerHTML = draftArenaState.team.length
      ? `
        <div class="draft-summary-card"><span>Puissance totale</span><b>${draftArenaState.teamPower || currentTeamPower}</b></div>
        <div class="draft-summary-card"><span>Synergie</span><b>${draftArenaState.runSummary?.synergyLabel || currentSynergy?.label || "-"}</b></div>
        <div class="draft-summary-card"><span>Région</span><b>${draftArenaState.selectedGen ? escapeHtml(draftGenLabel(draftArenaState.selectedGen)) : "-"}</b></div>
      `
      : "";
  }

  if (runBar) {
    runBar.innerHTML = arenas.map((arena, index) => {
      const result = draftArenaState.badgeResults[index];
      const statusClass = result?.status || (draftArenaState.phase === "result" && draftArenaState.evaluating ? "pending" : "pending");
      return `<div class="draft-run-node ${statusClass}" style="--draft-delay:${index * 80}ms">${getDraftBadgeMarkup(arena, statusClass)}<small>${index + 1}</small><b>${escapeHtml(arena.name)}</b><span>${escapeHtml(arena.type)}</span></div>`;
    }).join("");
  }

  if (resultWrap) {
    resultWrap.classList.toggle("hidden", draftArenaState.phase !== "result");
  }
  if (detailToggle) {
    detailToggle.textContent = draftArenaState.showDetailedAnalysis ? "Masquer l'analyse détaillée" : "Voir l'analyse détaillée";
    detailToggle.classList.toggle("hidden", draftArenaState.phase !== "result");
  }

  if (runSummary) {
    if (draftArenaState.phase !== "result") {
      runSummary.innerHTML = "";
    } else if (draftArenaState.evaluating) {
      runSummary.innerHTML = `<div class="draft-summary-card wide"><span>Analyse</span><b>Simulation de la run en cours...</b></div>`;
    } else if (draftArenaState.runSummary) {
      runSummary.innerHTML = `
        <div class="draft-summary-card"><span>Statut</span><b>${escapeHtml(draftArenaState.runSummary.status)}</b></div>
        <div class="draft-summary-card"><span>MVP</span><b>${escapeHtml(draftArenaState.runSummary.mvpName)}</b></div>
        <div class="draft-summary-card"><span>Lecture d'équipe</span><b>${escapeHtml(draftArenaState.runSummary.balanceLabel)}</b></div>
        <div class="draft-summary-card"><span>Tendance</span><b>${escapeHtml(draftArenaState.runSummary.offenseLabel)}</b></div>
      `;
    } else {
      runSummary.innerHTML = "";
    }
  }

  if (badgeGrid) {
    badgeGrid.innerHTML = "";
    for (const r of draftArenaState.badgeResults) {
      const b = document.createElement("div");
      b.className = "draft-badge-item " + r.status;
      b.style.setProperty("--draft-delay", `${badgeGrid.children.length * 90}ms`);
      b.innerHTML = `${getDraftBadgeMarkup(r.arena, r.status)}<b>${escapeHtml(r.arena.name)}</b><small>${r.arena.badgeName ? escapeHtml(r.arena.badgeName) : escapeHtml(r.arena.type)}</small><small>${r.status === "won" ? "Arène gagnée" : r.status === "blocked" ? "Arène de blocage" : "Arène non tentée"}</small>`;
      badgeGrid.appendChild(b);
    }
  }

  if (arenaList) {
    arenaList.innerHTML = "";
    for (const r of draftArenaState.badgeResults) {
      const row = document.createElement("div");
      row.className = "draft-arena-row " + r.status;
      row.style.setProperty("--draft-delay", `${arenaList.children.length * 110}ms`);
      const bestMembers = r.topMembers?.slice(0, 2).map((member) => member.pokemon.name).join(", ") || "-";
      const indicators = buildDraftArenaIndicators(r, draftArenaState.runSummary);
      row.innerHTML = `
        <b>${escapeHtml(r.arena.name)} • ${escapeHtml(r.arena.type)}</b>
        <span>${escapeHtml(indicators.join(" • "))}</span>
        <span>${escapeHtml(r.explanation)}</span>
        ${r.estimatedScore === null ? "" : `<span>MVP pressenti : ${escapeHtml(bestMembers)}</span>`}
        ${draftArenaState.showDetailedAnalysis && r.estimatedScore !== null ? `<span>Analyse détaillée : score ${r.estimatedScore} / seuil ${r.threshold}</span>` : ""}
      `;
      arenaList.appendChild(row);
    }
  }
}
const EMU_ROM_OPTIONS = [
  { label: "Pokemon Rouge Feu (FR)", url: "roms/Pokemon - Version Rouge Feu (FR).gba", core: "gba" },
  { label: "Pokemon Vert Feuille (FR)", url: "roms/Pokemon - Version Vert Feuille (FR).gba", core: "gba" },
  { label: "Pokemon Platine (FR)", url: "roms/DS/Pokemon - Version Platine (France).nds", core: "nds" },
];

let emulatorCustomRomUrl = "";
let emulatorCustomRomName = "";
let emulatorRunning = false;

function coreFromRomPath(pathOrName) {
  const src = String(pathOrName || "").toLowerCase();
  if (src.endsWith(".nds")) return "nds";
  return "gba";
}

function controlsHintForCore(core) {
  if (core === "nds") {
    return '<b>Touches DS:</b> <span>Z = A</span> <span>X = B</span> <span>Entrée = Start</span> <span>Shift = Select</span> <span>A = L</span> <span>S = R</span> <span>Flèches = direction</span> <span>Souris = écran tactile</span>';
  }
  return '<b>Touches GBA:</b> <span>Z = A</span> <span>X = B</span> <span>Entrée = Start</span> <span>Shift = Select</span> <span>A = L</span> <span>S = R</span> <span>Flèches = direction</span>';
}

function renderEmuControlsHint(core) {
  const help = document.getElementById("emu-controls-help");
  if (!help) return;
  help.innerHTML = controlsHintForCore(core);
}

function setEmuStatus(message) {
  const status = document.getElementById("emu-status");
  if (status) status.textContent = message || "";
}

function initEmulatorMode() {
  const select = document.getElementById("emu-rom-select");
  const fileInput = document.getElementById("emu-rom-file");
  if (!select || !fileInput) return;

  select.innerHTML = "";
  for (const rom of EMU_ROM_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = rom.url;
    opt.textContent = `${rom.label} (${rom.core.toUpperCase()})`;
    select.appendChild(opt);
  }

  select.addEventListener("change", () => {
    emulatorCustomRomUrl = "";
    emulatorCustomRomName = "";
    const selected = EMU_ROM_OPTIONS.find((r) => r.url === select.value);
    renderEmuControlsHint(selected?.core || coreFromRomPath(select.value));
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".gba") && !lower.endsWith(".nds")) {
      setEmuStatus("Fichier invalide: choisis une ROM .gba ou .nds.");
      return;
    }

    if (emulatorCustomRomUrl) {
      try { URL.revokeObjectURL(emulatorCustomRomUrl); } catch (_err) {}
    }
    emulatorCustomRomUrl = URL.createObjectURL(file);
    emulatorCustomRomName = file.name;

    const core = coreFromRomPath(file.name);
    renderEmuControlsHint(core);
    setEmuStatus(`ROM chargee: ${file.name} (${core.toUpperCase()}). Clique sur Lancer.`);
  });

  renderEmuControlsHint("gba");
  setEmuStatus("Selectionne une ROM puis clique sur Lancer.");
}

function stopEmulatorSession(hardStop = false) {
  const screen = document.getElementById("screen-emulator");
  if (screen) screen.classList.add("hidden");

  const player = document.getElementById("emulator-player");
  if (player) player.innerHTML = "";

  const loader = document.getElementById("emulatorjs-loader");
  if (loader) loader.remove();

  document.querySelectorAll("audio, video").forEach((media) => {
    try {
      media.pause();
      media.src = "";
      media.load();
    } catch (_err) {}
  });

  try {
    delete window.EJS_player;
    delete window.EJS_core;
    delete window.EJS_gameUrl;
    delete window.EJS_startOnLoaded;
    delete window.EJS_defaultControls;
    delete window.EJS_controlScheme;
    delete window.EJS_mouse;
  } catch (_err) {
    window.EJS_player = undefined;
    window.EJS_core = undefined;
    window.EJS_gameUrl = undefined;
    window.EJS_startOnLoaded = undefined;
    window.EJS_defaultControls = undefined;
    window.EJS_controlScheme = undefined;
    window.EJS_mouse = undefined;
  }

  emulatorRunning = false;
  setEmuStatus("Emulateur arrete.");

  if (hardStop) {
    setTimeout(() => { window.location.reload(); }, 20);
  }
}

function closeEmulatorMode() {
  stopEmulatorSession(true);
}

function openEmulatorMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  closeRankingPicker();
  stopCrySound();
  setQuizModeLayout(false);

  const screen = document.getElementById("screen-emulator");
  if (screen) screen.classList.remove("hidden");
  setGlobalNavActive("emu");

  const select = document.getElementById("emu-rom-select");
  if (select && !select.options.length) initEmulatorMode();
}

function getSelectedEmuRom() {
  if (emulatorCustomRomUrl) {
    const core = coreFromRomPath(emulatorCustomRomName || emulatorCustomRomUrl);
    return { url: emulatorCustomRomUrl, core, label: emulatorCustomRomName || "ROM locale" };
  }

  const select = document.getElementById("emu-rom-select");
  const url = select ? select.value : "";
  const preset = EMU_ROM_OPTIONS.find((r) => r.url === url);
  if (preset) return preset;

  if (!url) return null;
  return { url, core: coreFromRomPath(url), label: url };
}

function launchSelectedEmuRom() {
  const rom = getSelectedEmuRom();
  if (!rom?.url) {
    setEmuStatus("Aucune ROM selectionnee.");
    return;
  }

  if (location.protocol === "file:") {
    setEmuStatus(`Mode file:// detecte. Lancement ${rom.core.toUpperCase()}: si echec, utilise le bouton fichier ou un serveur local.`);
  } else {
    setEmuStatus(`Chargement de l'emulateur ${rom.core.toUpperCase()}...`);
  }

  renderEmuControlsHint(rom.core);

  const player = document.getElementById("emulator-player");
  if (!player) return;

  player.innerHTML = '<div id="emulatorjs"></div>';

  window.EJS_player = "#emulatorjs";
  window.EJS_core = rom.core;
  window.EJS_gameUrl = rom.url;
  window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
  window.EJS_startOnLoaded = true;
  window.EJS_controlScheme = rom.core;
  window.EJS_mouse = rom.core === "nds";
  window.EJS_defaultControls = {
    0: {
      0: { value: "x", value2: "BUTTON_2" },
      2: { value: "shift", value2: "SELECT" },
      3: { value: "enter", value2: "START" },
      4: { value: "up arrow", value2: "DPAD_UP" },
      5: { value: "down arrow", value2: "DPAD_DOWN" },
      6: { value: "left arrow", value2: "DPAD_LEFT" },
      7: { value: "right arrow", value2: "DPAD_RIGHT" },
      8: { value: "z", value2: "BUTTON_1" },
      10: { value: "a", value2: "LEFT_TOP_SHOULDER" },
      11: { value: "s", value2: "RIGHT_TOP_SHOULDER" },
      24: { value: "1" },
      25: { value: "2" },
      27: { value: "space" }
    },
    1: {},
    2: {},
    3: {}
  };

  const oldLoader = document.getElementById("emulatorjs-loader");
  if (oldLoader) oldLoader.remove();

  emulatorRunning = true;

  const script = document.createElement("script");
  script.id = "emulatorjs-loader";
  script.src = `${window.EJS_pathtodata}loader.js?v=${Date.now()}`;
  script.onload = () => setEmuStatus(`Emulateur ${rom.core.toUpperCase()} pret. Si l'ecran reste vide, recharge la page puis relance.`);
  script.onerror = () => {
    emulatorRunning = false;
    setEmuStatus(`Echec de chargement EmulatorJS (${rom.core.toUpperCase()}). Verifie ta connexion internet.`);
  };
  document.body.appendChild(script);
}
// CHALLENGE MODE
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
      <img src="${getPokemonSprite(p)}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSprite}'" />
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
  const index = Math.floor(rng() * POKEMON_LIST.length);
  return POKEMON_LIST[index];
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

  writeJson(STORAGE_KEYS.game, payload);
}

function clearSavedGame() {
  try {
    localStorage.removeItem(STORAGE_KEYS.game);
  } catch (e) {
    console.warn("localStorage unavailable:", e);
  }
}

function restoreSavedGame() {
  const save = readJson(STORAGE_KEYS.game, null);
  if (!save) return false;

  if (!VALID_MODES.has(save.mode)) {
    clearSavedGame();
    return false;
  }

  if (save.mode === "daily" && save.dailyKey !== getUTCDateKey()) {
    clearSavedGame();
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
  activePool = gameMode === "daily" ? POKEMON_LIST.slice() : getPoolFromSelectedGens();

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
  document.getElementById("screen-game").classList.remove("hidden");
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
    if (NAME_OVERRIDES[pokemon.name]) {
      pokemon.name = NAME_OVERRIDES[pokemon.name];
    }

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

  if (out.includes("?") || out.includes("?") || out.includes("?")) {
    try {
      out = decodeURIComponent(escape(out));
    } catch (_err) {
      // fallback below
    }
  }

  const fixes = {
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "?",
    "?": "'",
    "?": "-",
    "?": "-",
    "?": "?",
    "?": "?",
    "?": "?"
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
  };
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
    challenge: "Défi Ami",
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
    datalist.innerHTML = POKEMON_LIST.slice(0, 1025).map((pokemon) => `<option value="${escapeHtml(pokemon.name)}"></option>`).join("");
    datalist.dataset.ready = "1";
  }

  const levelInfo = getPlayerLevelInfo();
  if (levelName) levelName.textContent = levelInfo.current.name;
  if (levelXp) levelXp.textContent = `XP : ${levelInfo.xp}`;
  if (levelBar) levelBar.style.width = `${levelInfo.progress}%`;
  if (totalGames) totalGames.textContent = String(playerStats.played || 0);
  if (totalWins) totalWins.textContent = String(playerStats.wins || 0);
  if (currentStreak) currentStreak.textContent = String(playerStats.dailyCurrentStreak || 0);
  if (bestStreak) bestStreak.textContent = String(playerStats.dailyBestStreak || 0);

  if (favoriteCard) {
    favoriteCard.innerHTML = "";
    const favorite = playerProfile.favoritePokemonId ? POKEMON_BY_ID.get(playerProfile.favoritePokemonId) : null;
    if (favorite) {
      favoriteCard.innerHTML = `<div class="pokemon-mini-card"><img src="${getPokemonSprite(favorite)}" alt="${escapeHtml(favorite.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(favorite))}'" /><strong>${escapeHtml(favorite.name)}</strong><div class="pokemon-card-types">${typeBadgesHtml(favorite.type1, favorite.type2)}</div></div>`;
    } else {
      favoriteCard.innerHTML = '<p class="card-desc">Choisis un Pokémon favori pour l’afficher ici.</p>';
    }
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
    list.innerHTML = ACHIEVEMENT_DEFS.map((achievement) => {
      const progress = getAchievementProgress(achievement);
      return `<article class="achievement-card ${progress.unlocked ? "unlocked" : ""}">
        <div class="achievement-head"><strong>${escapeHtml(achievement.title)}</strong><span>${progress.unlocked ? "Débloqué" : "En cours"}</span></div>
        <p>${escapeHtml(achievement.desc)}</p>
        <div class="achievement-progress"><i style="width:${progress.pct}%"></i></div>
        <small>${progress.current} / ${achievement.target}</small>
      </article>`;
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

function showScreen(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function hideExtraScreens() {
  ['screen-profile','screen-achievements','screen-history','screen-odd-one-out','screen-multiplayer','screen-games-ranking','screen-type-chart'].forEach(hideScreen);
}

function ensureOverlay(title, html) {
  const overlay = document.getElementById('overlay-modal');
  const titleEl = document.getElementById('overlay-title');
  const bodyEl = document.getElementById('overlay-body');
  if (!overlay || !titleEl || !bodyEl) {
    alert(title);
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

function openHelpModal() {
  ensureOverlay('Aide', '<p class="card-desc">Les options avancées seront rétablies après stabilisation. Les modes solo de base restent prioritaires.</p>');
}

function openSettingsModal() {
  ensureOverlay('Paramètres', '<p class="card-desc">Les paramètres avancés sont temporairement simplifiés pendant la remise en état du site.</p>');
}

function confirmResetProgression() {
  ensureOverlay('Réinitialisation', '<p class="card-desc">La réinitialisation complète sera réactivée une fois le site stabilisé.</p>');
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
  hideScreen("screen-profile");
  hideScreen("screen-achievements");
  hideScreen("screen-history");
  hideScreen("screen-multiplayer");
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
    btn.innerHTML = `<div class="pokemon-mini-card is-silhouette"><img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(pokemon))}'" /><strong>${escapeHtml(pokemon.name)}</strong></div>`;
    btn.addEventListener("click", () => {
      if (weightBattleState.revealed) return;
      weightBattleState.revealed = true;
      weightBattleState.selectedId = pokemon.id;
      attempts = 1;
      gameOver = true;
      renderWeightBattlePanel();
      finishPartyRound(pokemon.id === secretPokemon?.id);
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
  const source = pool.length >= 12 ? pool : POKEMON_LIST.filter((pokemon) => !pokemon.isAltForm);
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
  finishPartyRound(pokemonId === oddOneOutState.oddId);
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
    btn.innerHTML = `<img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(pokemon))}'" /><span class="odd-card-name">${escapeHtml(pokemon.name)}</span>`;
    btn.disabled = oddOneOutState.revealed;
    btn.addEventListener("click", () => submitOddOneOutChoice(pokemon.id));
    grid.appendChild(btn);
  });
}

function startDescriptionMode() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    alert("Sélectionne au moins une génération !");
    return;
  }
  const secret = pool[Math.floor(Math.random() * pool.length)];
  descriptionState.text = `Ce Pokémon appartient à la génération ${secret.gen}, possède le type ${secret.type1}${secret.type2 ? ` / ${secret.type2}` : ""} et pèse ${secret.weight} kg.`;
  gameMode = "description";
  startGameWithSecret(secret, pool);
  renderDescriptionMode();
}

function openOddOneOutMode() {
  hideCustomModeSurfaces();
  hideScreen("screen-config");
  hideScreen("screen-game");
  hideScreen("screen-ranking");
  hideScreen("screen-games-ranking");
  hideScreen("screen-pokedex");
  hideScreen("screen-type-chart");
  hideScreen("screen-draft-arena");
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
    alert("Sélectionne au moins une génération avec suffisamment de Pokémon.");
    return;
  }
  const left = pool[Math.floor(Math.random() * pool.length)];
  const rightPool = pool.filter((pokemon) => pokemon.id !== left.id);
  const right = rightPool[Math.floor(Math.random() * rightPool.length)];
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
    alert("Aucune chaîne d'évolution à trois stades disponible.");
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
    alert("Il faut au moins trois Pokémon dans la sélection.");
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

function renderMultiplayerPlayers() {
  const wrap = document.getElementById("multiplayer-players");
  if (!wrap) return;

  const nicknameInput = document.getElementById("multiplayer-nickname");
  const playerName = multiplayerBotState?.nickname || nicknameInput?.value?.trim() || playerProfile.nickname || "Dresseur";
  const botName = multiplayerBotState?.botName || "Bot Café";
  const playerWinner = multiplayerBotState?.winner === "player";
  const botWinner = multiplayerBotState?.winner === "bot";

  wrap.innerHTML = `
    <article class="multiplayer-player-card is-self ${playerWinner ? "is-winner" : ""}">
      <div class="multiplayer-player-head">
        <strong>${escapeHtml(playerName)}</strong>
        <span>Toi</span>
      </div>
      <div class="multiplayer-player-stats">
        <span>Essais : <b>${multiplayerBotState?.playerAttempts || 0}</b></span>
        <span>Dernière tentative : <b>${escapeHtml(multiplayerBotState?.playerLastGuess || "—")}</b></span>
      </div>
    </article>
    <article class="multiplayer-player-card multiplayer-player-card-bot ${botWinner ? "is-winner" : ""}">
      <div class="multiplayer-player-head">
        <strong>${escapeHtml(botName)}</strong>
        <span>Bot</span>
      </div>
      <div class="multiplayer-player-stats">
        <span>Essais : <b>${multiplayerBotState?.botAttempts || 0}</b></span>
        <span>Dernière tentative : <b>${escapeHtml(multiplayerBotState?.botLastGuess || "—")}</b></span>
      </div>
    </article>
  `;
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
      <img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSprite}'" />
      <strong>${escapeHtml(pokemon.name)}</strong>
      <span class="multiplayer-secret-card-meta">Gen ${pokemon.gen}</span>
      <div class="pokemon-card-types">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
    </div>
  `;
}

function renderMultiplayerGenerationSummary() {
  const genSummary = document.getElementById("multiplayer-gen-summary");
  if (!genSummary) return;
  const gens = [...selectedGens].sort((a, b) => a - b);
  genSummary.textContent = gens.length === 0
    ? "Générations actives : aucune"
    : gens.length === 1
    ? `Génération active : Gen ${gens[0]}`
    : `Générations actives : ${gens.map((gen) => `Gen ${gen}`).join(", ")}`;
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

function renderMultiplayerBotResult() {
  const content = document.getElementById("multiplayer-result-content");
  if (!content || !multiplayerBotState?.secret) return;
  const playerWon = multiplayerBotState.winner === "player";
  const target = multiplayerBotState.secret;
  content.innerHTML = `
    <div class="multiplayer-result-summary ${playerWon ? "is-win" : "is-loss"}">
      <div>
        <p class="multiplayer-result-title">${playerWon ? "Victoire" : "Défaite"}</p>
        <p>${playerWon ? "Tu as trouvé le Pokémon avant le bot." : "Le bot a trouvé le Pokémon avant toi."}</p>
        <p>Essais : toi ${multiplayerBotState.playerAttempts} • bot ${multiplayerBotState.botAttempts}</p>
      </div>
      <div class="multiplayer-target-card">
        <div class="pokemon-mini-card">
          <img src="${getPokemonSprite(target)}" alt="${escapeHtml(target.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(target))}'" />
          <strong>${escapeHtml(target.name)}</strong>
          <div class="pokemon-card-types">${typeBadgesHtml(target.type1, target.type2)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderMultiplayerBotScreen() {
  const waitingBox = document.getElementById("multiplayer-waiting-box");
  const liveBox = document.getElementById("multiplayer-live-box");
  const resultBox = document.getElementById("multiplayer-result-box");
  const roundStatus = document.getElementById("multiplayer-round-status");
  const connection = document.getElementById("multiplayer-connection-status");
  const code = document.getElementById("multiplayer-room-code");
  const liveText = document.getElementById("multiplayer-live-text");
  const waitingText = document.getElementById("multiplayer-waiting-text");
  const guessInput = document.getElementById("multiplayer-guess-input");
  const guessButton = document.querySelector("#multiplayer-live-box .btn-red");
  const error = document.getElementById("multiplayer-error");
  const secretSelect = document.getElementById("multiplayer-secret-select");
  const pool = getPoolFromSelectedGens().filter((pokemon) => !pokemon.isAltForm);

  if (connection) connection.textContent = "Mode local";
  if (code) code.textContent = "Adversaire : Bot";
  if (error && !multiplayerBotState) error.textContent = "";
  renderMultiplayerGenerationSummary();
  populateMultiplayerPokemonLists(pool);

  renderMultiplayerPlayers();

  if (!multiplayerBotState) {
    if (roundStatus) roundStatus.textContent = "Prêt";
    if (waitingText) waitingText.textContent = "Choisis un pseudo puis lance une partie. Le bot commencera à chercher le Pokémon mystère en même temps que toi.";
    waitingBox?.classList.remove("hidden");
    liveBox?.classList.add("hidden");
    resultBox?.classList.add("hidden");
    if (guessInput) guessInput.value = "";
    if (secretSelect) secretSelect.value = "";
    clearMultiplayerResultsTable();
    renderMultiplayerSecretPreview();
    return;
  }

  if (multiplayerBotState.status === "live") {
    if (roundStatus) roundStatus.textContent = "En duel";
    if (liveText) liveText.textContent = multiplayerBotState.botLastGuess
      ? `Toi et le bot cherchez le même Pokémon mystère. Le bot vient de tenter ${multiplayerBotState.botLastGuess}.`
      : "Toi et le bot cherchez le même Pokémon mystère. Trouve-le avant lui pour remporter la manche.";
    waitingBox?.classList.add("hidden");
    liveBox?.classList.remove("hidden");
    resultBox?.classList.add("hidden");
    if (secretSelect) {
      const matched = multiplayerBotState.pool.find((pokemon) => pokemon.name === multiplayerBotState.chosenSecretName);
      secretSelect.value = matched ? String(matched.id) : "";
    }
    renderMultiplayerSecretPreview();
    if (guessInput) guessInput.disabled = false;
    if (guessButton) guessButton.disabled = false;
    return;
  }

  if (roundStatus) roundStatus.textContent = multiplayerBotState.winner === "player" ? "Victoire joueur" : "Victoire bot";
  waitingBox?.classList.add("hidden");
  liveBox?.classList.add("hidden");
  resultBox?.classList.remove("hidden");
  if (guessInput) guessInput.disabled = true;
  if (guessButton) guessButton.disabled = true;
  renderMultiplayerBotResult();
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

function createMultiplayerRoom() {
  const input = document.getElementById("multiplayer-nickname");
  const error = document.getElementById("multiplayer-error");
  const guessInput = document.getElementById("multiplayer-guess-input");
  const nickname = String(input?.value || playerProfile.nickname || "").trim() || "Dresseur";
  const pool = getPoolFromSelectedGens().filter((pokemon) => !pokemon.isAltForm);
  const secretSelect = document.getElementById("multiplayer-secret-select");
  const chosenSecretId = Number(secretSelect?.value || 0);
  const chosenSecret = chosenSecretId ? POKEMON_BY_ID.get(chosenSecretId) : null;

  if (input) input.value = nickname;
  if (error) error.textContent = "";

  if (pool.length < 10) {
    if (error) error.textContent = "Sélectionne au moins une génération avec suffisamment de Pokémon pour lancer un duel.";
    return;
  }

  if (chosenSecretId && (!chosenSecret || !pool.some((pokemon) => pokemon.id === chosenSecret.id))) {
    if (error) error.textContent = "Choisis un Pokémon à faire deviner présent dans les générations actives.";
    return;
  }

  const secret = chosenSecret || pool[Math.floor(Math.random() * pool.length)];
  multiplayerBotState = createMultiplayerBotState(nickname, pool, secret);
  populateMultiplayerPokemonLists(pool);
  clearMultiplayerResultsTable();
  if (guessInput) {
    guessInput.value = "";
    guessInput.disabled = false;
    guessInput.focus();
  }
  document.getElementById("multiplayer-guess-ac")?.classList.add("hidden");

  renderMultiplayerBotScreen();
  scheduleBotTurn();
}

function joinMultiplayerRoom() {
  createMultiplayerRoom();
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

function submitMultiplayerGuess() {
  if (!multiplayerBotState || multiplayerBotState.status !== "live") return;

  const input = document.getElementById("multiplayer-guess-input");
  const error = document.getElementById("multiplayer-error");
  const raw = String(input?.value || "").trim();
  if (!raw) return;

  const picked = findPokemonGlobalByName(raw);
  const inPool = picked && multiplayerBotState.pool.some((pokemon) => pokemon.id === picked.id);
  if (!picked || !inPool) {
    if (error) error.textContent = "Choisis un Pokémon présent dans les générations sélectionnées.";
    return;
  }

  if (multiplayerBotState.playerGuessIds.has(picked.id)) {
    if (error) error.textContent = "Tu as déjà tenté ce Pokémon.";
    return;
  }

  if (error) error.textContent = "";
  multiplayerBotState.playerGuessIds.add(picked.id);
  multiplayerBotState.playerAttempts += 1;
  multiplayerBotState.playerLastGuess = picked.name;
  if (input) input.value = "";
  document.getElementById("multiplayer-guess-ac")?.classList.add("hidden");
  addMultiplayerGuessRow(picked);

  if (picked.id === multiplayerBotState.secret.id) {
    multiplayerBotState.winner = "player";
    multiplayerBotState.status = "result";
    clearMultiplayerBotTimer();
    renderMultiplayerBotScreen();
    return;
  }

  renderMultiplayerBotScreen();
}

function leaveMultiplayerRoom(resetOnly = false) {
  clearMultiplayerBotTimer();
  multiplayerBotState = null;
  const error = document.getElementById("multiplayer-error");
  const guessInput = document.getElementById("multiplayer-guess-input");
  const secretSelect = document.getElementById("multiplayer-secret-select");
  if (error) error.textContent = "";
  if (guessInput) {
    guessInput.value = "";
    guessInput.disabled = false;
  }
  document.getElementById("multiplayer-guess-ac")?.classList.add("hidden");
  if (secretSelect) secretSelect.value = "";
  clearMultiplayerResultsTable();
  renderMultiplayerBotScreen();
  if (!resetOnly) goToConfig();
}

function copyMultiplayerRoomCode() {
  const error = document.getElementById("multiplayer-error");
  if (error) error.textContent = "Le duel contre le bot est local : aucun code à partager.";
}

function openMultiplayerMode() {
  closeOverlayModal();
  goToConfig();
  hideScreen("screen-config");
  showScreen("screen-multiplayer");
  document.querySelector(".search-bar")?.classList.add("hidden");
  renderMultiplayerBotScreen();
}

function createDefaultMultiplayerLiveState() {
  return {
    connectionStatus: "offline",
    room: null,
    submittedGuessNames: new Set(),
    selectedGens: new Set([...selectedGens].sort((a, b) => a - b)),
  };
}

function ensureMultiplayerLiveState() {
  if (!multiplayerLiveState) multiplayerLiveState = createDefaultMultiplayerLiveState();
  return multiplayerLiveState;
}

function getMultiplayerRoomPool() {
  const room = multiplayerLiveState?.room;
  const gens = Array.isArray(room?.selectedGens) && room.selectedGens.length
    ? new Set(room.selectedGens.map((value) => Number(value)))
    : new Set(getMultiplayerSelectedGens());
  return POKEMON_LIST.filter((pokemon) => !pokemon.isAltForm && gens.has(Number(pokemon.gen)));
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
    const count = POKEMON_LIST.filter((p) => p.gen === gen).length;
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
  const disabled = roomStatus === "waiting" || roomStatus === "live" || Boolean(state.room?.code && !self?.isHost);
  grid.querySelectorAll(".gen-item").forEach((item) => {
    if (disabled) item.classList.add("is-disabled");
    else item.classList.remove("is-disabled");
  });
}

function handleMultiplayerGenerationChange(gen, item) {
  const roomStatus = multiplayerLiveState?.room?.status || "";
  if (roomStatus === "waiting" || roomStatus === "live") return;

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
  multiplayerLiveState = createDefaultMultiplayerLiveState();
  multiplayerLiveState.selectedGens = new Set(preservedGens);
  document.getElementById("multiplayer-room-input")?.value && (document.getElementById("multiplayer-room-input").value = "");
  document.getElementById("multiplayer-guess-input")?.value && (document.getElementById("multiplayer-guess-input").value = "");
  document.getElementById("multiplayer-guess-ac")?.classList.add("hidden");
  renderMultiplayerGenerationGrid();
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
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("connect_error", () => {
    setMultiplayerConnectionStatus("offline");
    setMultiplayerError("Impossible de joindre le serveur Duel live. Vérifie que server.js tourne.");
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("disconnect", () => {
    setMultiplayerConnectionStatus("offline");
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("duel:room-state", (roomState) => {
    const state = ensureMultiplayerLiveState();
    const previousRoom = state.room;
    state.room = roomState;
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
    renderMultiplayerBotScreen();
  });

  multiplayerSocket.on("duel:room-closed", (payload = {}) => {
    resetMultiplayerLiveSession();
    setMultiplayerError(payload.reason || "La room a été fermée.");
    renderMultiplayerBotScreen();
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

  const renderPlayerCard = (player, fallbackLabel) => {
    const isWinner = player && room?.winnerId && player.id === room.winnerId;
    const name = player?.nickname || fallbackLabel;
    const subtitle = player ? (player.isSelf ? "Toi" : "Adversaire") : "En attente";
    const attempts = player?.attempts || 0;
    const lastGuess = player?.lastGuess || "—";
    return `
      <article class="multiplayer-player-card ${player?.isSelf ? "is-self" : ""} ${isWinner ? "is-winner" : ""}">
        <div class="multiplayer-player-head">
          <strong>${escapeHtml(name)}</strong>
          <span>${subtitle}</span>
        </div>
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
        <img src="${entry.sprite || getPokemonSprite(entry)}" alt="${escapeHtml(entry.name)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSprite}'" />
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
      <button class="multiplayer-win-close" type="button" aria-label="Fermer" onclick="hideMultiplayerWinOverlay()">×</button>
      <div id="multiplayer-win-content"></div>
      <div class="multiplayer-result-actions multiplayer-win-actions">
        <button class="btn-red" type="button" onclick="hideMultiplayerWinOverlay(); restartMultiplayerRound()">Rejouer</button>
        <button class="btn-ghost" type="button" onclick="hideMultiplayerWinOverlay(); goToConfig()">Retour accueil</button>
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
  const playerId = self?.id || multiplayerSocket?.id || null;
  const playerWon = Boolean(playerId && winner && playerId === winner.id);
  const target = room?.targetRevealed;
  const reasonText = room?.endedReason === "disconnect"
    ? "La manche s'est terminée sur déconnexion."
    : playerWon
    ? "Tu as trouvé le Pokémon avant ton adversaire."
    : winner
    ? `${winner.nickname} a trouvé le Pokémon avant toi.`
    : "La manche est terminée.";

  content.innerHTML = `
    <div class="multiplayer-result-summary ${playerWon ? "is-win" : "is-loss"}">
      <div>
        <p class="multiplayer-result-title">${playerWon ? "Félicitations, tu as gagné !" : "Défaite"}</p>
        <p>${escapeHtml(reasonText)}</p>
        <p>${playerWon ? "Belle manche. Tu remportes ce duel live avant ton adversaire." : "La manche t’échappe cette fois."}</p>
      </div>
      ${target ? `
      <div class="multiplayer-target-card">
        <div class="pokemon-mini-card">
          <img src="${target.sprite || getPokemonSprite(target)}" alt="${escapeHtml(target.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(target))}'" />
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
    multiplayerScreen?.classList.toggle("multiplayer-win-state", playerWon);
    if (playerWon) {
      const overlay = ensureMultiplayerWinOverlay();
      const overlayContent = document.getElementById("multiplayer-win-content");
      overlay.querySelector(".multiplayer-win-card")?.classList.remove("is-loss");
      if (overlayContent) {
        overlayContent.innerHTML = `
          <div class="multiplayer-result-summary is-win">
            <div>
              <p class="multiplayer-result-title">Félicitations, tu as gagné !</p>
              <p>${escapeHtml(reasonText)}</p>
              <p>La manche est remportée. Tu peux rejouer tout de suite ou revenir à l’accueil.</p>
            </div>
            ${target ? `
            <div class="multiplayer-target-card">
              <div class="pokemon-mini-card">
                <img src="${target.sprite || getPokemonSprite(target)}" alt="${escapeHtml(target.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(target))}'" />
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
              <p class="multiplayer-result-title">Défaite</p>
              <p>${escapeHtml(reasonText)}</p>
              <p>La manche t’échappe cette fois. Tu peux rejouer immédiatement ou revenir à l’accueil.</p>
            </div>
            ${target ? `
            <div class="multiplayer-target-card">
              <div class="pokemon-mini-card">
                <img src="${target.sprite || getPokemonSprite(target)}" alt="${escapeHtml(target.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(target))}'" />
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

  const waitingBox = document.getElementById("multiplayer-waiting-box");
  const liveBox = document.getElementById("multiplayer-live-box");
  const resultBox = document.getElementById("multiplayer-result-box");
  const roundStatus = document.getElementById("multiplayer-round-status");
  const connection = document.getElementById("multiplayer-connection-status");
  const code = document.getElementById("multiplayer-room-code");
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

  if (connection) {
    connection.textContent = multiplayerLiveState.connectionStatus === "online"
      ? "Connecté"
      : multiplayerLiveState.connectionStatus === "connecting"
      ? "Connexion..."
      : "Hors ligne";
  }
  if (code) code.textContent = room?.code ? `Code : ${room.code}` : "Code : —";
  renderMultiplayerGenerationGrid();
  renderMultiplayerGenerationSummary();
  renderMultiplayerPlayers();
  renderMultiplayerAttempts();

  if (roomInput) roomInput.disabled = Boolean(isLive);

  if (isWaiting) {
    const resultHeading = resultBox?.querySelector("h3");
    if (resultHeading) resultHeading.textContent = "Résultat du duel";
    document.getElementById("screen-multiplayer")?.classList.remove("multiplayer-win-state");
    hideMultiplayerWinOverlay();
    resultBox?.classList.remove("is-win", "is-loss", "win-animate");
    if (roundStatus) roundStatus.textContent = room?.code ? "En attente" : "Prêt";
    if (waitingText) {
      waitingText.textContent = room?.code
        ? players.length >= 2
          ? "Les deux joueurs sont là. La manche démarre..."
          : "Room créée. Partage le code et attends ton adversaire."
        : "Crée une room ou rejoins-en une. La manche démarre automatiquement dès que les deux joueurs sont présents.";
    }
    waitingBox?.classList.remove("hidden");
    liveBox?.classList.add("hidden");
    resultBox?.classList.add("hidden");
    if (guessInput) {
      guessInput.value = "";
      guessInput.disabled = true;
    }
    if (guessButton) guessButton.disabled = true;
    return;
  }

  if (isLive) {
    const resultHeading = resultBox?.querySelector("h3");
    if (resultHeading) resultHeading.textContent = "Résultat du duel";
    document.getElementById("screen-multiplayer")?.classList.remove("multiplayer-win-state");
    hideMultiplayerWinOverlay();
    resultBox?.classList.remove("is-win", "is-loss", "win-animate");
    if (roundStatus) roundStatus.textContent = "En duel";
    if (liveText) {
      const opponent = players.find((player) => !player.isSelf);
      liveText.textContent = opponent?.lastGuess
        ? `La manche est lancée. ${opponent.nickname} vient de tenter ${opponent.lastGuess}.`
        : "La manche est lancée. Devine le Pokémon avant ton adversaire.";
    }
    waitingBox?.classList.add("hidden");
    liveBox?.classList.remove("hidden");
    resultBox?.classList.add("hidden");
    if (guessInput) {
      guessInput.disabled = false;
      guessInput.focus();
    }
    if (guessButton) guessButton.disabled = false;
    return;
  }

  if (isFinished) {
    if (roundStatus) roundStatus.textContent = "Terminé";
    waitingBox?.classList.add("hidden");
    liveBox?.classList.add("hidden");
    resultBox?.classList.remove("hidden");
    if (guessInput) guessInput.disabled = true;
    if (guessButton) guessButton.disabled = true;
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
  multiplayerLiveState = createDefaultMultiplayerLiveState();
  setMultiplayerConnectionStatus(socket.connected ? "online" : "connecting");

  const selectedGensForRoom = getMultiplayerSelectedGens();
  socket.emit("duel:create-room", { nickname, selectedGens: selectedGensForRoom }, (response = {}) => {
    if (!response.ok) {
      setMultiplayerError(response.error || "Impossible de créer la room.");
      return;
    }
    ensureMultiplayerLiveState().room = response.room || null;
    ensureMultiplayerLiveState().selectedGens = new Set(selectedGensForRoom);
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
    renderMultiplayerBotScreen();
  });
}

function submitMultiplayerGuess() {
  const room = multiplayerLiveState?.room;
  if (!room || room.status !== "live") return;

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
  multiplayerLiveState.submittedGuessNames.add(picked.name);
  socket.emit("duel:submit-guess", { guess: picked.name }, (response = {}) => {
    if (!response.ok) {
      multiplayerLiveState.submittedGuessNames.delete(picked.name);
      setMultiplayerError(response.error || "Impossible d'envoyer la tentative.");
      return;
    }
    if (input) input.value = "";
    document.getElementById("multiplayer-guess-ac")?.classList.add("hidden");
    renderMultiplayerBotScreen();
  });
}

function restartMultiplayerRound() {
  const room = multiplayerLiveState?.room;
  if (!room || room.status !== "finished") return;
  if (!multiplayerSocket?.connected) {
    setMultiplayerError("Connexion perdue. Impossible de relancer la manche.");
    return;
  }

  setMultiplayerError("");
  const selectedGensForRoom = Array.isArray(room.selectedGens) && room.selectedGens.length
    ? room.selectedGens.slice()
    : getMultiplayerSelectedGens();
  multiplayerSocket.emit("duel:restart-round", {}, (response = {}) => {
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
  resetMultiplayerLiveSession();
  setMultiplayerError("");
  renderMultiplayerBotScreen();
  if (!resetOnly) goToConfig();
}

function copyMultiplayerRoomCode() {
  const code = multiplayerLiveState?.room?.code;
  if (!code) {
    setMultiplayerError("Aucune room active à copier.");
    return;
  }
  navigator.clipboard?.writeText(code)
    .then(() => setMultiplayerError("Code copié."))
    .catch(() => setMultiplayerError(`Code de room : ${code}`));
}

function openMultiplayerMode() {
  closeOverlayModal();
  goToConfig();
  hideScreen("screen-config");
  showScreen("screen-multiplayer");
  document.querySelector(".search-bar")?.classList.add("hidden");
  ensureMultiplayerLiveState();
  renderMultiplayerGenerationGrid();
  ensureMultiplayerSocket();
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

window.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  loadAchievementsState();
  loadMatchHistory();
  evaluateAchievements();
  hideExtraScreens();
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



