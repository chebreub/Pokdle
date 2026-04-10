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
  teamBuilder: "pokedle_team_builder_v1",
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

// Keep overrides limited to data that still contains corrupted accents.
const NAME_OVERRIDES = {
  "??lectrode": "Électrode",
  "??lekid": "Élekid",
  "??crémeuh": "Écrémeuh",
  "??lecsprint": "Élecsprint",
  "??crapince": "Écrapince",
  "??oko": "Éoko",
  "??tourmi": "Étourmi",
  "??tourvol": "Étourvol",
  "??touraptor": "Étouraptor",
  "??cayon": "Écayon",
  "??lekable": "Élekable",
  "??caéd": "Écaïd",
  "??kaéser": "Ékaïser",
  "??thernatos": "Éthernatos",
};
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
  { id: 20016, name: "Dardargnan Mega", baseId: 15, gen: 6 },
  { id: 20017, name: "Roucarnage Mega", baseId: 18, gen: 6 },
  { id: 20018, name: "Flagadoss Mega", baseId: 80, gen: 6 },
  { id: 20019, name: "Steelix Mega", baseId: 208, gen: 6 },
  { id: 20020, name: "Jungko Mega", baseId: 254, gen: 6, type2: "Dragon" },
  { id: 20021, name: "Laggron Mega", baseId: 260, gen: 6 },
  { id: 20022, name: "Ténéfix Mega", baseId: 302, gen: 6 },
  { id: 20023, name: "Mysdibule Mega", baseId: 303, gen: 6, type1: "Acier", type2: "Fée" },
  { id: 20024, name: "Galeking Mega", baseId: 306, gen: 6, type2: null },
  { id: 20025, name: "Charmina Mega", baseId: 308, gen: 6 },
  { id: 20026, name: "Élecsprint Mega", baseId: 310, gen: 6 },
  { id: 20027, name: "Sharpedo Mega", baseId: 319, gen: 6 },
  { id: 20028, name: "Camérupt Mega", baseId: 323, gen: 6 },
  { id: 20029, name: "Altaria Mega", baseId: 334, gen: 6, type2: "Fée" },
  { id: 20030, name: "Branette Mega", baseId: 354, gen: 6 },
  { id: 20031, name: "Absol Mega", baseId: 359, gen: 6 },
  { id: 20032, name: "Drattak Mega", baseId: 373, gen: 6 },
  { id: 20033, name: "Latias Mega", baseId: 380, gen: 6 },
  { id: 20034, name: "Latios Mega", baseId: 381, gen: 6 },
  { id: 20035, name: "Lockpin Mega", baseId: 428, gen: 6, type2: "Combat" },
  { id: 20036, name: "Carchacrok Mega", baseId: 445, gen: 6 },
  { id: 20037, name: "Blizzaroi Mega", baseId: 460, gen: 6 },
  { id: 20038, name: "Diancie Mega", baseId: 719, gen: 6 },

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
  { id: 22011, name: "Ramoloss de Galar", baseId: 79, gen: 8, type1: "Psy", type2: null, color: "Rose / Jaune" },
  { id: 22012, name: "Flagadoss de Galar", baseId: 80, gen: 8, type1: "Poison", type2: "Psy" },
  { id: 22013, name: "Roigada de Galar", baseId: 199, gen: 8, type1: "Poison", type2: "Psy" },
  { id: 22014, name: "M. Mime de Galar", baseId: 122, gen: 8, type1: "Glace", type2: "Psy" },
  { id: 22015, name: "Tutafeh de Galar", baseId: 562, gen: 8, type1: "Sol", type2: "Spectre" },
  { id: 22016, name: "Limonde de Galar", baseId: 618, gen: 8, type1: "Sol", type2: "Acier" },
  { id: 22017, name: "Sulfura de Galar", baseId: 146, gen: 8, type1: "Ténèbres", type2: "Vol" },
  { id: 22018, name: "Électhor de Galar", baseId: 145, gen: 8, type1: "Combat", type2: "Vol" },
  { id: 22019, name: "Artikodin de Galar", baseId: 144, gen: 8, type1: "Psy", type2: "Vol" },

  { id: 23001, name: "Caninos de Hisui", baseId: 58, gen: 8, type1: "Feu", type2: "Roche" },
  { id: 23002, name: "Arcanin de Hisui", baseId: 59, gen: 8, type1: "Feu", type2: "Roche" },
  { id: 23003, name: "Voltorbe de Hisui", baseId: 100, gen: 8, type1: "Électrik", type2: "Plante" },
  { id: 23004, name: "Électrode de Hisui", baseId: 101, gen: 8, type1: "Électrik", type2: "Plante" },
  { id: 23005, name: "Qwilfish de Hisui", baseId: 211, gen: 8, type1: "Ténèbres", type2: "Poison" },
  { id: 23006, name: "Typhlosion de Hisui", baseId: 157, gen: 8, type1: "Feu", type2: "Spectre" },
  { id: 23007, name: "Clamiral de Hisui", baseId: 503, gen: 8, type1: "Eau", type2: "Ténèbres" },
  { id: 23008, name: "Archéduc de Hisui", baseId: 724, gen: 8, type1: "Plante", type2: "Combat" },
  { id: 23009, name: "Zorua de Hisui", baseId: 570, gen: 8, type1: "Normal", type2: "Spectre", color: "Blanc / Rouge" },
  { id: 23010, name: "Zoroark de Hisui", baseId: 571, gen: 8, type1: "Normal", type2: "Spectre", color: "Blanc / Rouge" },
  { id: 23011, name: "Farfuret de Hisui", baseId: 215, gen: 8, type1: "Combat", type2: "Poison" },
  { id: 23012, name: "Guériaigle de Hisui", baseId: 628, gen: 8, type1: "Psy", type2: "Vol" },
  { id: 23013, name: "Fragilady de Hisui", baseId: 549, gen: 8, type1: "Plante", type2: "Combat" },
  { id: 23014, name: "Amovénus Forme Totémique", baseId: 905, gen: 8 },
  { id: 23015, name: "Muplodocus de Hisui", baseId: 706, gen: 8, type1: "Acier", type2: "Dragon" },
  { id: 23016, name: "Séracrawl de Hisui", baseId: 713, gen: 8, type1: "Glace", type2: "Roche" },

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
  { id: 25006, name: "Deoxys Attaque", baseId: 386, gen: 3 },
  { id: 25007, name: "Deoxys Défense", baseId: 386, gen: 3 },
  { id: 25008, name: "Deoxys Vitesse", baseId: 386, gen: 3 },
  { id: 25009, name: "Motisma Chaleur", baseId: 479, gen: 4, type2: "Feu" },
  { id: 25010, name: "Motisma Lavage", baseId: 479, gen: 4, type2: "Eau" },
  { id: 25011, name: "Motisma Froid", baseId: 479, gen: 4, type2: "Glace" },
  { id: 25012, name: "Motisma Tonte", baseId: 479, gen: 4, type2: "Plante" },
  { id: 25013, name: "Motisma Hélice", baseId: 479, gen: 4, type2: "Vol" },
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
  "Dardargnan Mega": "beedrill-mega",
  "Roucarnage Mega": "pidgeot-mega",
  "Flagadoss Mega": "slowbro-mega",
  "Steelix Mega": "steelix-mega",
  "Jungko Mega": "sceptile-mega",
  "Laggron Mega": "swampert-mega",
  "Ténéfix Mega": "sableye-mega",
  "Mysdibule Mega": "mawile-mega",
  "Galeking Mega": "aggron-mega",
  "Charmina Mega": "medicham-mega",
  "Élecsprint Mega": "manectric-mega",
  "Sharpedo Mega": "sharpedo-mega",
  "Camérupt Mega": "camerupt-mega",
  "Altaria Mega": "altaria-mega",
  "Branette Mega": "banette-mega",
  "Absol Mega": "absol-mega",
  "Drattak Mega": "salamence-mega",
  "Latias Mega": "latias-mega",
  "Latios Mega": "latios-mega",
  "Lockpin Mega": "lopunny-mega",
  "Carchacrok Mega": "garchomp-mega",
  "Blizzaroi Mega": "abomasnow-mega",
  "Diancie Mega": "diancie-mega",
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
  "Ramoloss de Galar": "slowpoke-galar",
  "Flagadoss de Galar": "slowbro-galar",
  "Roigada de Galar": "slowking-galar",
  "M. Mime de Galar": "mr-mime-galar",
  "Tutafeh de Galar": "yamask-galar",
  "Limonde de Galar": "stunfisk-galar",
  "Sulfura de Galar": "moltres-galar",
  "Électhor de Galar": "zapdos-galar",
  "Artikodin de Galar": "articuno-galar",
  "Caninos de Hisui": "growlithe-hisui",
  "Arcanin de Hisui": "arcanine-hisui",
  "Voltorbe de Hisui": "voltorb-hisui",
  "Électrode de Hisui": "electrode-hisui",
  "Qwilfish de Hisui": "qwilfish-hisui",
  "Typhlosion de Hisui": "typhlosion-hisui",
  "Clamiral de Hisui": "samurott-hisui",
  "Archéduc de Hisui": "decidueye-hisui",
  "Zorua de Hisui": "zorua-hisui",
  "Zoroark de Hisui": "zoroark-hisui",
  "Farfuret de Hisui": "sneasel-hisui",
  "Guériaigle de Hisui": "braviary-hisui",
  "Fragilady de Hisui": "lilligant-hisui",
  "Amovénus Forme Totémique": "enamorus-therian",
  "Muplodocus de Hisui": "goodra-hisui",
  "Séracrawl de Hisui": "avalugg-hisui",
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
  "Deoxys Attaque": "deoxys-attack",
  "Deoxys Défense": "deoxys-defense",
  "Deoxys Vitesse": "deoxys-speed",
  "Motisma Chaleur": "rotom-heat",
  "Motisma Lavage": "rotom-wash",
  "Motisma Froid": "rotom-frost",
  "Motisma Tonte": "rotom-mow",
  "Motisma Hélice": "rotom-fan",
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
      baseId: form.baseId,
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
      formApiName: FORM_API_NAME_BY_NAME[form.name] || null,
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
      const apiName = pokemon.formApiName || FORM_API_NAME_BY_NAME[pokemon.name];
      if (!apiName) return;

      try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
        if (!response.ok) return;

        const data = await response.json();
        const sprite = data?.sprites?.front_default;
        const apiTypes = Array.isArray(data?.types)
          ? data.types
              .slice()
              .sort((a, b) => (a?.slot || 0) - (b?.slot || 0))
              .map((entry) => typeLabelFrFromApiName(entry?.type?.name))
              .filter(Boolean)
          : [];

        if (sprite) pokemon.sprite = sprite;
        if (apiTypes[0]) pokemon.type1 = apiTypes[0];
        pokemon.type2 = apiTypes[1] || null;
        if (typeof data?.height === "number") pokemon.height = data.height / 10;
        if (typeof data?.weight === "number") pokemon.weight = data.weight / 10;
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
let draftBattleNetworkSession = null;
let draftSimpleBattleActionFocusKey = "";

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

const POKEMON_CATALOG = POKEMON_LIST;

function getPokemonCatalog() {
  return POKEMON_CATALOG;
}

function getPokemonUiList({ gens = null, includeAltForms = true } = {}) {
  const source = getPokemonCatalog();
  const hasGenFilter = gens instanceof Set || Array.isArray(gens);
  const allowedGens = hasGenFilter
    ? gens instanceof Set
      ? gens
      : new Set(gens.map((value) => Number(value)))
    : null;

  return source.filter((pokemon) => {
    if (!pokemon) return false;
    if (!includeAltForms && pokemon.isAltForm) return false;
    if (allowedGens && !allowedGens.has(Number(pokemon.gen))) return false;
    return true;
  });
}

function getPokemonCountForGeneration(gen, { includeAltForms = true } = {}) {
  return getPokemonUiList({ gens: [gen], includeAltForms }).length;
}

const FULL_SEARCH_INDEX = getPokemonCatalog().map((pokemon) => ({
  pokemon,
  normName: norm(pokemon.name),
}));

const POKEMON_BY_ID = new Map(getPokemonCatalog().map((p) => [p.id, p]));

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
let teamBuilderState = null;
let teamBuilderActiveSlot = 0;
let teamBuilderPokemonSearch = "";
let teamBuilderPokemonPickerOpen = false;
let teamBuilderStrategicRenderVersion = 0;
let teamBuilderTalentOptionsCache = new Map();
let teamLibraryFilters = {
  generation: "all",
  format: "all",
  style: "all",
};
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
let pokedexType2Filter = "all";
let pokedexSortFilter = "dex";
let pokedexGridUseShiny = false;
let pokedexSelectedShiny = false;
let typeChartEra = "gen6+";
let typeChartOffenseFilter = "all";
let typeChartDefenseFilter = "all";
let statClashState = null;
let statClashRuntime = {
  timeouts: new Set(),
  intervals: new Set(),
  animationFrame: null,
  timerInterval: null,
};

const STAT_CLASH_ROUND_TOTAL = 6;
const STAT_CLASH_PICK_TIME_MS = 10000;
const STAT_CLASH_START_DELAY_MS = 900;
const STAT_CLASH_ROLL_MS = 1800;
const STAT_CLASH_RANDOMIZER_BASE_DELAY_MS = 70;
const STAT_CLASH_RANDOMIZER_STEPS = 15;
const STAT_CLASH_POST_REVEAL_DELAY_MS = 1200;
const STAT_CLASH_INTER_ROUND_DELAY_MS = 900;
const STAT_CLASH_SCORE_ANIMATION_MS = 1200;
const STAT_CLASH_STATS = [
  { key: "hp", label: "PV", short: "PV" },
  { key: "attack", label: "Attack", short: "ATK" },
  { key: "defense", label: "Defense", short: "DEF" },
  { key: "spAttack", label: "Special Attack", short: "SPA" },
  { key: "spDefense", label: "Special Defense", short: "SPD" },
  { key: "speed", label: "Speed", short: "SPE" },
];

const TEAM_BUILDER_ITEMS = [
  "Aucun",
  "Restes",
  "Orbe Vie",
  "Bandeau Choix",
  "Mouchoir Choix",
  "Lunettes Choix",
  "Veste de Combat",
  "Casque Brut",
  "Grosses Bottes",
  "Orbe Flamme",
  "Orbe Toxik",
  "Ceinture Force",
  "Baie Prine",
  "Baie Lampou",
  "Poudre Argentée",
  "Peau Métal",
  "Solide Roc",
  "Boue Noire",
  "Lumargile",
  "Herbe Pouvoir",
  "Vive Griffe",
  "Charbon",
  "Aimant",
  "Eau Mystique",
  "Evoluroc",
];

const TEAM_BUILDER_GIMMICKS = [
  "Aucun",
  "Méga",
  "Téra",
  "Move Z",
  "Dynamax",
  "Autre mécanique",
];

const TEAM_BUILDER_MOVE_LIBRARY = [
  { name: "Séisme", types: ["Sol"] },
  { name: "Lance-Flammes", types: ["Feu"] },
  { name: "Hydrocanon", types: ["Eau"] },
  { name: "Lame-Feuille", types: ["Plante"] },
  { name: "Tonnerre", types: ["Électrik"] },
  { name: "Laser Glace", types: ["Glace"] },
  { name: "Close Combat", types: ["Combat"] },
  { name: "Bomb-Beurk", types: ["Poison"] },
  { name: "Draco-Météore", types: ["Dragon"] },
  { name: "Boutefeu", types: ["Feu"] },
  { name: "Surf", types: ["Eau"] },
  { name: "Éco-Sphère", types: ["Plante"] },
  { name: "Fatal-Foudre", types: ["Électrik"] },
  { name: "Vent Violent", types: ["Vol"] },
  { name: "Clonage", types: [] },
  { name: "Change Éclair", types: ["Électrik"] },
  { name: "Machouille", types: ["Ténèbres"] },
  { name: "Ball'Ombre", types: ["Spectre"] },
  { name: "Vibrobscur", types: ["Ténèbres"] },
  { name: "Psyko", types: ["Psy"] },
  { name: "Aurasphère", types: ["Combat"] },
  { name: "Nœud Herbe", types: ["Plante"] },
  { name: "Ébullilave", types: ["Feu"] },
  { name: "Vive-Attaque", types: [] },
  { name: "Retour", types: [] },
  { name: "Plaquage", types: [] },
  { name: "Ultralaser", types: [] },
  { name: "Écrasement", types: [] },
  { name: "Bélier", types: [] },
  { name: "Métronome", types: [] },
  { name: "Attraction", types: [] },
  { name: "Repos", types: [] },
  { name: "Piège de Roc", types: ["Roche"] },
  { name: "Demi-Tour", types: ["Insecte"] },
  { name: "Tour Rapide", types: ["Sol"] },
  { name: "Abri", types: [] },
  { name: "Lame d'Air", types: ["Vol"] },
  { name: "Choc Mental", types: ["Psy"] },
  { name: "Direct Toxik", types: ["Poison"] },
  { name: "Canon Graine", types: ["Plante"] },
  { name: "Câlinerie", types: ["Fée"] },
  { name: "Éclat Magique", types: ["Fée"] },
  { name: "Tête de Fer", types: ["Acier"] },
  { name: "Pisto-Poing", types: ["Acier"] },
  { name: "Crocs Feu", types: ["Feu"] },
  { name: "Crocs Givre", types: ["Glace"] },
  { name: "Crocs Éclair", types: ["Électrik"] },
  { name: "Sabotage", types: ["Ténèbres"] },
  { name: "Danse-Lames", types: [] },
  { name: "Atterrissage", types: ["Vol"] },
  { name: "Toxik", types: ["Poison"] },
  { name: "Vœu Soin", types: ["Fée"] },
  { name: "Protection", types: [] },
  { name: "Mur Lumière", types: ["Psy"] },
  { name: "Reflet", types: ["Psy"] },
  { name: "Dracochoc", types: ["Dragon"] },
  { name: "Giga-Sangsue", types: ["Plante"] },
  { name: "Éclair Fou", types: ["Électrik"] },
  { name: "Telluriforce", types: ["Sol"] },
  { name: "Cradovague", types: ["Poison"] },
  { name: "Tricherie", types: ["Ténèbres"] },
  { name: "Poing Glace", types: ["Glace"] },
  { name: "Poing-Éclair", types: ["Électrik"] },
  { name: "Poing de Feu", types: ["Feu"] },
  { name: "Psykoud'Boul", types: ["Psy"] },
];
const TEAM_BUILDER_MOVES = TEAM_BUILDER_MOVE_LIBRARY.map((move) => move.name);

const TEAM_BUILDER_NATURES = [
  { value: "Hardi", label: "Hardi (neutre)" },
  { value: "Docile", label: "Docile (neutre)" },
  { value: "Sérieux", label: "Sérieux (neutre)" },
  { value: "Bizarre", label: "Bizarre (neutre)" },
  { value: "Pudique", label: "Pudique (neutre)" },
  { value: "Solo", label: "Solo (+Attaque, -Défense)" },
  { value: "Brave", label: "Brave (+Attaque, -Vitesse)" },
  { value: "Rigide", label: "Rigide (+Attaque, -Attaque Spé.)" },
  { value: "Mauvais", label: "Mauvais (+Attaque, -Défense Spé.)" },
  { value: "Assuré", label: "Assuré (+Défense, -Attaque)" },
  { value: "Relax", label: "Relax (+Défense, -Vitesse)" },
  { value: "Malin", label: "Malin (+Défense, -Attaque Spé.)" },
  { value: "Lâche", label: "Lâche (+Défense, -Défense Spé.)" },
  { value: "Timide", label: "Timide (+Vitesse, -Attaque)" },
  { value: "Pressé", label: "Pressé (+Vitesse, -Défense)" },
  { value: "Jovial", label: "Jovial (+Vitesse, -Attaque Spé.)" },
  { value: "Naïf", label: "Naïf (+Vitesse, -Défense Spé.)" },
  { value: "Modeste", label: "Modeste (+Attaque Spé., -Attaque)" },
  { value: "Doux", label: "Doux (+Attaque Spé., -Défense)" },
  { value: "Discret", label: "Discret (+Attaque Spé., -Vitesse)" },
  { value: "Foufou", label: "Foufou (+Attaque Spé., -Défense Spé.)" },
  { value: "Calme", label: "Calme (+Défense Spé., -Attaque)" },
  { value: "Gentil", label: "Gentil (+Défense Spé., -Défense)" },
  { value: "Prudent", label: "Prudent (+Défense Spé., -Attaque Spé.)" },
  { value: "Malpoli", label: "Malpoli (+Défense Spé., -Vitesse)" },
];

const TEAM_BUILDER_NATURE_EFFECTS = {
  Solo: { up: "atk", down: "def" },
  Brave: { up: "atk", down: "spe" },
  Rigide: { up: "atk", down: "spa" },
  Mauvais: { up: "atk", down: "spd" },
  Assuré: { up: "def", down: "atk" },
  Relax: { up: "def", down: "spe" },
  Malin: { up: "def", down: "spa" },
  Lâche: { up: "def", down: "spd" },
  Timide: { up: "spe", down: "atk" },
  Pressé: { up: "spe", down: "def" },
  Jovial: { up: "spe", down: "spa" },
  Naïf: { up: "spe", down: "spd" },
  Modeste: { up: "spa", down: "atk" },
  Doux: { up: "spa", down: "def" },
  Discret: { up: "spa", down: "spe" },
  Foufou: { up: "spa", down: "spd" },
  Calme: { up: "spd", down: "atk" },
  Gentil: { up: "spd", down: "def" },
  Prudent: { up: "spd", down: "spa" },
  Malpoli: { up: "spd", down: "spe" },
};

const TEAM_BUILDER_EV_PRESETS = [
  {
    value: "offensive-physique",
    label: "Offensif physique",
    spread: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
  },
  {
    value: "offensive-speciale",
    label: "Offensif spécial",
    spread: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
  },
  {
    value: "rapide",
    label: "Rapide",
    spread: { hp: 252, atk: 0, def: 4, spa: 0, spd: 0, spe: 252 },
  },
  {
    value: "bulky",
    label: "Bulky",
    spread: { hp: 252, atk: 0, def: 252, spa: 0, spd: 4, spe: 0 },
  },
  {
    value: "support",
    label: "Support",
    spread: { hp: 252, atk: 0, def: 0, spa: 0, spd: 252, spe: 4 },
  },
  { value: "custom", label: "Custom", spread: null },
];

const TEAM_BUILDER_IV_PRESETS = [
  { value: "all31", label: "31 partout", spread: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } },
  { value: "zero-attack", label: "0 Attaque", spread: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 } },
  { value: "zero-speed", label: "0 Vitesse", spread: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 0 } },
  { value: "custom", label: "Custom", spread: null },
];

const TEAM_LIBRARY_GENERATION_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "1", label: "Gen 1" },
  { value: "2", label: "Gen 2" },
  { value: "3", label: "Gen 3" },
  { value: "4", label: "Gen 4" },
  { value: "5", label: "Gen 5" },
  { value: "6", label: "Gen 6" },
  { value: "7", label: "Gen 7" },
  { value: "8", label: "Gen 8" },
  { value: "9", label: "Gen 9" },
];

const TEAM_LIBRARY_FORMAT_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "OU", label: "OU" },
  { value: "UU", label: "UU" },
  { value: "VGC", label: "VGC" },
  { value: "NatDex", label: "NatDex" },
  { value: "Doubles", label: "Doubles" },
];

const TEAM_LIBRARY_STYLE_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "balanced", label: "Balanced" },
  { value: "bulky-offense", label: "Bulky offense" },
  { value: "ho", label: "Hyper offense" },
  { value: "rain", label: "Rain" },
  { value: "sun", label: "Sun" },
  { value: "sand", label: "Sand" },
  { value: "trick-room", label: "Trick Room" },
];

const TEAM_LIBRARY_STYLE_LABELS = {
  balanced: "Balanced",
  "bulky-offense": "Bulky offense",
  ho: "Hyper offense",
  rain: "Rain",
  sun: "Sun",
  sand: "Sand",
  "trick-room": "Trick Room",
};

const TEAM_LIBRARY_TEMPLATES = [
  {
    id: "rain-tempo",
    name: "Tempo Pluie",
    generation: "7",
    format: "OU",
    style: "rain",
    summary: "Une base pluie simple à piloter avec pivot, pression spéciale et finitions rapides.",
    tags: ["Rain", "Pivot", "Speed control"],
    slots: [
      { pokemonId: 279, item: "Grosses Bottes", gimmick: "Aucun", moves: ["Surf", "Vent Violent", "Atterrissage", "Abri"], nature: "Calme", evPreset: "support", ivPreset: "all31" },
      { pokemonId: 230, item: "Orbe Vie", gimmick: "Aucun", moves: ["Hydrocanon", "Dracochoc", "Abri", "Surf"], nature: "Modeste", evPreset: "offensive-speciale", ivPreset: "all31" },
      { pokemonId: 260, item: "Restes", gimmick: "Aucun", moves: ["Séisme", "Surf", "Piège de Roc", "Toxik"], nature: "Rigide", evPreset: "offensive-physique", ivPreset: "all31" },
      { pokemonId: 748, item: "Restes", gimmick: "Aucun", moves: ["Toxik", "Bomb-Beurk", "Repos", "Abri"], nature: "Calme", evPreset: "bulky", ivPreset: "all31" },
      { pokemonId: 598, item: "Casque Brut", gimmick: "Aucun", moves: ["Piège de Roc", "Canon Graine", "Tête de Fer", "Sabotage"], nature: "Relax", evPreset: "bulky", ivPreset: "all31" },
      { pokemonId: 145, item: "Grosses Bottes", gimmick: "Aucun", moves: ["Fatal-Foudre", "Lame d'Air", "Atterrissage", "Demi-Tour"], nature: "Timide", evPreset: "offensive-speciale", ivPreset: "all31" },
    ],
  },
  {
    id: "sand-balance",
    name: "Balance Sable",
    generation: "4",
    format: "NatDex",
    style: "sand",
    summary: "Le sable pose les bases et laisse les pivots contrôler le rythme de la partie.",
    tags: ["Sand", "Balance", "Pivots"],
    slots: [
      { pokemonId: 248, item: "Restes", gimmick: "Aucun", moves: ["Piège de Roc", "Sabotage", "Tête de Fer", "Danse-Lames"], nature: "Rigide", evPreset: "offensive-physique", ivPreset: "all31" },
      { pokemonId: 450, item: "Restes", gimmick: "Aucun", moves: ["Séisme", "Repos", "Toxik", "Piège de Roc"], nature: "Assuré", evPreset: "bulky", ivPreset: "all31" },
      { pokemonId: 472, item: "Boue Noire", gimmick: "Aucun", moves: ["Séisme", "Atterrissage", "Toxik", "Protection"], nature: "Malin", evPreset: "bulky", ivPreset: "zero-attack" },
      { pokemonId: 485, item: "Restes", gimmick: "Aucun", moves: ["Lance-Flammes", "Telluriforce", "Piège de Roc", "Toxik"], nature: "Modeste", evPreset: "offensive-speciale", ivPreset: "all31" },
      { pokemonId: 227, item: "Grosses Bottes", gimmick: "Aucun", moves: ["Lame d'Air", "Atterrissage", "Protection", "Repos"], nature: "Assuré", evPreset: "bulky", ivPreset: "all31" },
      { pokemonId: 479, item: "Grosses Bottes", gimmick: "Aucun", moves: ["Tonnerre", "Hydrocanon", "Change Éclair", "Protection"], nature: "Timide", evPreset: "offensive-speciale", ivPreset: "all31" },
    ],
  },
  {
    id: "bulky-offense",
    name: "Offense Bulky",
    generation: "6",
    format: "OU",
    style: "bulky-offense",
    summary: "Des menaces claires et assez d’outils défensifs pour ne pas subir le tempo adverse.",
    tags: ["Balanced", "Offense", "Pressure"],
    slots: [
      { pokemonId: 445, item: "Casque Brut", gimmick: "Aucun", moves: ["Séisme", "Dracochoc", "Piège de Roc", "Tête de Fer"], nature: "Rigide", evPreset: "offensive-physique", ivPreset: "all31" },
      { pokemonId: 184, item: "Bandeau Choix", gimmick: "Aucun", moves: ["Câlinerie", "Sabotage", "Pisto-Poing", "Repos"], nature: "Rigide", evPreset: "offensive-physique", ivPreset: "all31" },
      { pokemonId: 36, item: "Restes", gimmick: "Aucun", moves: ["Câlinerie", "Toxik", "Protection", "Vœu Soin"], nature: "Calme", evPreset: "support", ivPreset: "all31" },
      { pokemonId: 663, item: "Grosses Bottes", gimmick: "Aucun", moves: ["Vent Violent", "Atterrissage", "Demi-Tour", "Poing de Feu"], nature: "Jovial", evPreset: "rapide", ivPreset: "all31" },
      { pokemonId: 681, item: "Restes", gimmick: "Aucun", moves: ["Ball'Ombre", "Tête de Fer", "Protection", "Clonage"], nature: "Brave", evPreset: "offensive-physique", ivPreset: "zero-speed" },
      { pokemonId: 448, item: "Orbe Vie", gimmick: "Aucun", moves: ["Close Combat", "Tête de Fer", "Pisto-Poing", "Danse-Lames"], nature: "Jovial", evPreset: "offensive-physique", ivPreset: "all31" },
    ],
  },
  {
    id: "sun-pressure",
    name: "Pression Soleil",
    generation: "8",
    format: "OU",
    style: "sun",
    summary: "Le soleil multiplie la pression immédiate et valorise les pivots qui prennent le terrain.",
    tags: ["Sun", "Pressure", "Tempo"],
    slots: [
      { pokemonId: 324, item: "Charbon", gimmick: "Aucun", moves: ["Ébullilave", "Piège de Roc", "Abri", "Repos"], nature: "Assuré", evPreset: "support", ivPreset: "all31" },
      { pokemonId: 3, item: "Boue Noire", gimmick: "Aucun", moves: ["Éco-Sphère", "Giga-Sangsue", "Clonage", "Toxik"], nature: "Modeste", evPreset: "offensive-speciale", ivPreset: "all31" },
      { pokemonId: 6, item: "Grosses Bottes", gimmick: "Aucun", moves: ["Lance-Flammes", "Vent Violent", "Dracochoc", "Atterrissage"], nature: "Timide", evPreset: "offensive-speciale", ivPreset: "all31" },
      { pokemonId: 59, item: "Grosses Bottes", gimmick: "Aucun", moves: ["Poing de Feu", "Crocs Éclair", "Atterrissage", "Toxik"], nature: "Jovial", evPreset: "bulky", ivPreset: "all31" },
      { pokemonId: 637, item: "Orbe Vie", gimmick: "Aucun", moves: ["Ébullilave", "Vent Violent", "Clonage", "Atterrissage"], nature: "Modeste", evPreset: "offensive-speciale", ivPreset: "all31" },
      { pokemonId: 887, item: "Mouchoir Choix", gimmick: "Aucun", moves: ["Draco-Météore", "Ball'Ombre", "Demi-Tour", "Tricherie"], nature: "Timide", evPreset: "rapide", ivPreset: "all31" },
    ],
  },
  {
    id: "trick-room-core",
    name: "Cœur Distorsion",
    generation: "9",
    format: "VGC",
    style: "trick-room",
    summary: "Un noyau lent et explosif pensé pour poser la Distorsion puis frapper fort.",
    tags: ["Trick Room", "VGC", "Slow power"],
    slots: [
      { pokemonId: 826, item: "Restes", gimmick: "Téra", moves: ["Éclat Magique", "Psyko", "Clonage", "Protection"], nature: "Discret", evPreset: "support", ivPreset: "zero-speed" },
      { pokemonId: 876, item: "Restes", gimmick: "Téra", moves: ["Choc Mental", "Mur Lumière", "Reflet", "Vœu Soin"], nature: "Calme", evPreset: "support", ivPreset: "all31" },
      { pokemonId: 901, item: "Orbe Vie", gimmick: "Téra", moves: ["Séisme", "Close Combat", "Bélier", "Protection"], nature: "Brave", evPreset: "offensive-physique", ivPreset: "zero-speed" },
      { pokemonId: 324, item: "Charbon", gimmick: "Téra", moves: ["Ébullilave", "Piège de Roc", "Abri", "Repos"], nature: "Relax", evPreset: "bulky", ivPreset: "zero-speed" },
      { pokemonId: 591, item: "Boue Noire", gimmick: "Téra", moves: ["Giga-Sangsue", "Toxik", "Clonage", "Abri"], nature: "Calme", evPreset: "support", ivPreset: "zero-speed" },
      { pokemonId: 983, item: "Bandeau Choix", gimmick: "Téra", moves: ["Tête de Fer", "Sabotage", "Danse-Lames", "Protection"], nature: "Brave", evPreset: "offensive-physique", ivPreset: "zero-speed" },
    ],
  },
  {
    id: "ho-blitz",
    name: "Blitz HO",
    generation: "9",
    format: "OU",
    style: "ho",
    summary: "Des menaces rapides et une forte densité de pression offensive pour jouer le tempo.",
    tags: ["HO", "Pressure", "Speed"],
    slots: [
      { pokemonId: 984, item: "Ceinture Force", gimmick: "Téra", moves: ["Séisme", "Close Combat", "Tour Rapide", "Piège de Roc"], nature: "Jovial", evPreset: "offensive-physique", ivPreset: "all31" },
      { pokemonId: 1006, item: "Orbe Vie", gimmick: "Téra", moves: ["Éclat Magique", "Close Combat", "Danse-Lames", "Tête de Fer"], nature: "Jovial", evPreset: "offensive-physique", ivPreset: "all31" },
      { pokemonId: 1000, item: "Grosses Bottes", gimmick: "Téra", moves: ["Ball'Ombre", "Tricherie", "Protection", "Reflet"], nature: "Modeste", evPreset: "offensive-speciale", ivPreset: "all31" },
      { pokemonId: 1005, item: "Orbe Vie", gimmick: "Téra", moves: ["Draco-Météore", "Tricherie", "Danse-Lames", "Clonage"], nature: "Jovial", evPreset: "offensive-physique", ivPreset: "all31" },
      { pokemonId: 887, item: "Mouchoir Choix", gimmick: "Téra", moves: ["Draco-Météore", "Ball'Ombre", "Demi-Tour", "Clonage"], nature: "Timide", evPreset: "rapide", ivPreset: "all31" },
      { pokemonId: 983, item: "Bandeau Choix", gimmick: "Téra", moves: ["Tête de Fer", "Sabotage", "Danse-Lames", "Protection"], nature: "Brave", evPreset: "offensive-physique", ivPreset: "zero-speed" },
    ],
  },
];

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
let pokedexRecentIds = [];
let pokedexRecentLoaded = false;
let pokedexRecentSuppressOnce = false;
let pokedexCompareId = null;
let pokedexCompareLoaded = false;
let pokedexCompareToastTimer = null;
let draftArenaState = null;

const POKEDEX_API_CACHE = new Map();
const POKEDEX_SPECIES_CACHE = new Map();
const POKEDEX_ABILITY_CACHE = new Map();
const POKEDEX_EVOLUTION_CACHE = new Map();
const TEAM_BUILDER_MOVE_POOL_CACHE = new Map();
const TEAM_BUILDER_MOVE_POOL_PENDING = new Map();

const POKEDEX_RECENT_STORAGE_KEY = "pokedexRecentIds";
const POKEDEX_RECENT_MAX = 6;
const POKEDEX_COMPARE_STORAGE_KEY = "pokedexCompareId";

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
  initTeamBuilderModule();
  initTeamsModule();
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
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
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
  cleanupStatClashMode();
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  document.getElementById("screen-profile")?.classList.add("hidden");
  document.getElementById("screen-achievements")?.classList.add("hidden");
  document.getElementById("screen-history")?.classList.add("hidden");
  document.getElementById("screen-multiplayer")?.classList.add("hidden");
  document.getElementById("screen-odd-one-out")?.classList.add("hidden");
  document.getElementById("screen-stat-clash")?.classList.add("hidden");
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

function getStatClashPool() {
  return getPoolFromSelectedGens().filter((pokemon) => !pokemon?.isAltForm && Number.isInteger(getMysteryApiId(pokemon)));
}

function createStatClashPlayer(side, label) {
  return {
    side,
    label,
    score: 0,
    displayScore: 0,
    pendingPick: null,
    history: [],
  };
}

function createStatClashState() {
  const leftLabel = String(playerProfile?.nickname || "").trim() || "Joueur 1";
  return {
    phase: "idle",
    round: 1,
    totalRounds: STAT_CLASH_ROUND_TOTAL,
    timerLeftMs: STAT_CLASH_PICK_TIME_MS,
    timerDurationMs: STAT_CLASH_PICK_TIME_MS,
    statusText: "Préparation du duel...",
    pool: getStatClashPool(),
    currentPokemon: null,
    currentStats: null,
    randomizerPokemon: null,
    usedPokemonIds: [],
    usedStats: [],
    reveal: null,
    autoPickedSides: [],
    transitionLocked: false,
    players: {
      left: createStatClashPlayer("left", leftLabel),
      right: createStatClashPlayer("right", "Joueur 2"),
    },
  };
}

function resetStatClashRuntime() {
  statClashRuntime.timeouts.forEach((id) => clearTimeout(id));
  statClashRuntime.intervals.forEach((id) => clearInterval(id));
  if (statClashRuntime.animationFrame !== null) {
    cancelAnimationFrame(statClashRuntime.animationFrame);
  }
  statClashRuntime = {
    timeouts: new Set(),
    intervals: new Set(),
    animationFrame: null,
  };
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
}

function setTrackedStatClashAnimationFrame(callback) {
  if (statClashRuntime.animationFrame !== null) {
    cancelAnimationFrame(statClashRuntime.animationFrame);
  }
  statClashRuntime.animationFrame = requestAnimationFrame((timestamp) => {
    statClashRuntime.animationFrame = null;
    callback(timestamp);
  });
}

function cleanupStatClashMode() {
  resetStatClashRuntime();
  statClashState = null;
}

function restartStatClashGame() {
  if (document.getElementById("screen-stat-clash")?.classList.contains("hidden")) {
    openStatClashMode();
    return;
  }
  openStatClashMode();
}

function getStatClashStatDef(statKey) {
  return STAT_CLASH_STATS.find((entry) => entry.key === statKey) || STAT_CLASH_STATS[0];
}

function getStatClashValue(statKey, stats) {
  const value = Number(stats?.[statKey]);
  return Number.isFinite(value) ? value : 0;
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

function buildStatClashRandomizerSequence(finalPokemon, pool) {
  const candidates = shuffleArray(pool.filter((pokemon) => pokemon.id !== finalPokemon.id)).slice(0, STAT_CLASH_RANDOMIZER_STEPS - 1);
  return [...candidates, finalPokemon];
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

function animateStatClashScores(nextTotals) {
  return new Promise((resolve) => {
    const state = statClashState;
    if (!state) {
      resolve();
      return;
    }

    const startValues = {
      left: state.players.left.displayScore,
      right: state.players.right.displayScore,
    };
    const startedAt = performance.now();
    state.phase = "scoring";

    const step = (now) => {
      const liveState = statClashState;
      if (!liveState) {
        resolve();
        return;
      }
      const progress = Math.max(0, Math.min(1, (now - startedAt) / STAT_CLASH_SCORE_ANIMATION_MS));
      const eased = 1 - Math.pow(1 - progress, 3);
      liveState.players.left.displayScore = startValues.left + (nextTotals.left - startValues.left) * eased;
      liveState.players.right.displayScore = startValues.right + (nextTotals.right - startValues.right) * eased;
      renderStatClashScreen();
      if (progress < 1) {
        setTrackedStatClashAnimationFrame(step);
        return;
      }
      liveState.players.left.displayScore = nextTotals.left;
      liveState.players.right.displayScore = nextTotals.right;
      renderStatClashScreen();
      resolve();
    };

    setTrackedStatClashAnimationFrame(step);
  });
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

function pickStatClashStat(side, statKey, auto = false) {
  const state = statClashState;
  if (!state || state.phase !== "picking" || state.transitionLocked) return;
  const player = state.players?.[side];
  if (!player || player.pendingPick) return;

  const available = getStatClashAvailableStats(state);
  if (!available.some((entry) => entry.key === statKey)) return;

  player.pendingPick = { key: statKey, auto };
  if (auto) {
    state.autoPickedSides = Array.from(new Set([...(state.autoPickedSides || []), side]));
  }

  renderStatClashScreen();

  if (state.players.left.pendingPick && state.players.right.pendingPick) {
    resolveStatClashRound();
  }
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

function runStatClashRandomizer(sequence, finalPokemon) {
  const state = statClashState;
  if (!state) return;

  state.phase = "rolling";
  state.statusText = "Le randomizer accélère puis ralentit...";
  state.randomizerPokemon = sequence[0] || finalPokemon;
  renderStatClashScreen();

  let totalDelay = 0;
  sequence.forEach((pokemon, index) => {
    totalDelay += STAT_CLASH_RANDOMIZER_BASE_DELAY_MS + index * 18;
    trackStatClashTimeout(() => {
      const liveState = statClashState;
      if (!liveState) return;
      liveState.randomizerPokemon = pokemon;
      liveState.statusText = index === sequence.length - 1
        ? `${pokemon.name} entre dans l'arène.`
        : "Le randomizer ralentit...";
      renderStatClashScreen();
      if (index === sequence.length - 1) {
        startStatClashTimer();
      }
    }, totalDelay);
  });
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

function openStatClashMode() {
  const pool = getStatClashPool();
  if (!pool.length) {
    alert("Sélectionne au moins une génération jouable avec les formes standards.");
    return;
  }

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
  renderStatClashScreen();
  startStatClashRound();
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
    if (action === "switch-bot") return switchStatClashMode("bot");
    if (action === "switch-room") return switchStatClashMode("room");
  });
}

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
  const best = getStatClashRemainingStats(state.usedStatsBySide[side])
    .sort((left, right) => getStatClashValue(right.key, state.currentStats) - getStatClashValue(left.key, state.currentStats))[0];
  if (!best) return;
  player.pendingPick = { key: best.key, auto: true };
  player.lockedAt = Date.now();
}

function maybeResolveLocalStatClashRound() {
  const state = statClashState;
  if (!state || state.mode !== "bot") return;
  if (!state.players.left.pendingPick || !state.players.right.pendingPick) return;
  resolveLocalStatClashRound();
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
    if (entry.key) state.usedStatsBySide[entry.side].push(entry.key);
  });
  state.reveal = reveal;
  state.revealStats = { ...state.currentStats };
  state.statusText = "Révélation des choix.";
  renderStatClashScreen();
  await animateStatClashScores({
    left: state.players.left.score + (reveal.left?.value || 0),
    right: state.players.right.score + (reveal.right?.value || 0),
  });
  if (!statClashState) return;
  ["left", "right"].forEach((side) => {
    const player = state.players[side];
    const entry = reveal[side];
    player.score += entry?.value || 0;
    player.pendingPick = null;
    player.lockedAt = null;
    if (entry?.key) player.history.push({ round: state.round, statKey: entry.key, statLabel: entry.statLabel, value: entry.value, pokemonName: state.currentPokemon.name, auto: entry.auto });
  });
  if (state.round >= state.totalRounds || state.usedStatsBySide.left.length >= STAT_CLASH_STATS.length || state.usedStatsBySide.right.length >= STAT_CLASH_STATS.length) {
    return trackStatClashTimeout(() => finalizeStatClashBotGame(), STAT_CLASH_POST_REVEAL_DELAY_MS);
  }
  state.round += 1;
  trackStatClashTimeout(() => startStatClashBotRound(), STAT_CLASH_INTER_ROUND_DELAY_MS);
}

function startStatClashBotTimer() {
  const state = statClashState;
  if (!state || state.mode !== "bot") return;
  state.phase = "picking";
  state.timerLeftMs = STAT_CLASH_PICK_TIME_MS;
  state.timerDurationMs = STAT_CLASH_PICK_TIME_MS;
  state.statusText = "Choisis une stat. Le choix adverse reste caché jusqu'au reveal.";
  renderStatClashScreen();
  trackStatClashTimeout(() => {
    if (!statClashState || statClashState.mode !== "bot" || statClashState.phase !== "picking") return;
    autoPickLocalStatClash("right");
    renderStatClashScreen();
    maybeResolveLocalStatClashRound();
  }, 1400 + Math.floor(Math.random() * 4200));
  const startedAt = Date.now();
  const intervalId = setStatClashTimerInterval(() => {
    if (!statClashState || statClashState.mode !== "bot" || statClashState.phase !== "picking") return clearTrackedStatClashInterval(intervalId);
    statClashState.timerLeftMs = Math.max(0, STAT_CLASH_PICK_TIME_MS - (Date.now() - startedAt));
    updateStatClashTimerUi();
    if (statClashState.timerLeftMs > 0) return;
    clearTrackedStatClashInterval(intervalId);
    autoPickLocalStatClash("left");
    autoPickLocalStatClash("right");
    renderStatClashScreen();
    maybeResolveLocalStatClashRound();
  }, 100);
}

async function startStatClashBotRound() {
  const state = statClashState;
  if (!state || state.mode !== "bot") return;
  resetStatClashRuntime();
  state.reveal = null;
  state.revealStats = null;
  state.players.left.pendingPick = null;
  state.players.right.pendingPick = null;
  state.players.left.lockedAt = null;
  state.players.right.lockedAt = null;
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
  const sequence = buildStatClashRandomizerSequence(roundData.pokemon, state.pool);
  runStatClashRandomizer(sequence, roundData.pokemon, () => startStatClashBotTimer(), STAT_CLASH_ROLL_MS);
}

function startStatClashBotGame() {
  if (!statClashState) return;
  statClashState.mode = "bot";
  statClashState.pool = getStatClashPool();
  statClashState.round = 1;
  statClashState.usedStatsBySide = { left: [], right: [] };
  statClashState.usedPokemonIds = [];
  statClashState.reveal = null;
  statClashState.revealStats = null;
  statClashState.players.left = createStatClashPlayer("left", statClashState.players.left.label || "Joueur 1");
  statClashState.players.right = createStatClashPlayer("right", "Bot Clash");
  renderStatClashScreen();
  startStatClashBotRound();
}

function finalizeStatClashBotGame() {
  if (!statClashState) return;
  statClashState.phase = "finished";
  statClashState.statusText = statClashState.players.left.score === statClashState.players.right.score
    ? "Égalité parfaite."
    : `${statClashState.players.left.score > statClashState.players.right.score ? statClashState.players.left.label : statClashState.players.right.label} gagne le duel.`;
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
  };
}

function updateStatClashRoomTimer() {
  const state = statClashState;
  if (!state?.room) return;
  const needsTimer = state.room.status === "starting" || state.room.roundPhase === "rolling" || state.room.roundPhase === "picking";
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
    statClashState.mode = "bot";
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
    if (!response.ok) return alert(response.error || "Impossible de relancer la partie.");
    applyStatClashRoomState(response.room);
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
      alert(response.error || "Impossible de verrouiller ce choix.");
    });
  }
  if (state.phase !== "picking" || state.players.left.pendingPick || state.usedStatsBySide.left.includes(statKey)) return;
  state.players.left.pendingPick = { key: statKey, auto };
  state.players.left.lockedAt = Date.now();
  renderStatClashScreen();
  maybeResolveLocalStatClashRound();
}

function switchStatClashMode(mode) {
  if (!statClashState || statClashState.mode === mode) return;
  if (mode === "room") {
    statClashState.mode = "room";
    statClashState.phase = "idle";
    statClashState.round = 1;
    statClashState.usedStatsBySide = { left: [], right: [] };
    statClashState.room = null;
    statClashState.roomToken = "";
    statClashState.currentPokemon = null;
    statClashState.randomizerPokemon = null;
    statClashState.reveal = null;
    statClashState.revealStats = null;
    statClashState.roomJoinCode = "";
    statClashState.roomCodeDraft = "";
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
  const current = roomHasStarted || !isRoom ? (state.randomizerPokemon || state.currentPokemon) : null;
  const currentSprite = current ? getPokemonSprite(current) : "";
  const timerDuration = Math.max(1, Number(state.timerDurationMs) || STAT_CLASH_PICK_TIME_MS);
  const timerPct = Math.max(0, Math.min(100, (state.timerLeftMs / timerDuration) * 100));
  const winnerKey = state.phase === "finished"
    ? state.players.left.score === state.players.right.score ? "tie" : state.players.left.score > state.players.right.score ? "left" : "right"
    : null;
  const toplineHtml = isRoom && roomIsLobby
    ? `<span class="tag-gen">Lobby Room 1v1</span><span class="tag-tries">Joueurs connectés : <b>${Number(room?.connectedCount || room?.players?.filter((player) => player.connected).length || 0)}/${Number(room?.maxPlayers || 2)}</b></span><span class="tag-gen stat-clash-rule-tag">${escapeHtml(roomUi?.detail || "En attente de la room.")}</span>`
    : `<span class="tag-gen">Manche ${state.round} / ${state.totalRounds}</span><span class="tag-tries">Tes stats restantes : <b>${STAT_CLASH_STATS.length - state.usedStatsBySide.left.length}</b></span><span class="tag-gen stat-clash-rule-tag">Les stats restent cachées jusqu'au reveal final de manche.</span>`;
  const remainingHtml = STAT_CLASH_STATS.map((entry) => `<span class="stat-clash-remaining-chip ${state.usedStatsBySide.left.includes(entry.key) ? "is-used" : ""}">${escapeHtml(entry.label)}</span>`).join("");
  const revealStatsHtml = state.revealStats
    ? `<div class="stat-clash-reveal-stats">${STAT_CLASH_STATS.map((entry) => `<div class="stat-clash-reveal-stat ${state.reveal?.left?.statKey === entry.key || state.reveal?.right?.statKey === entry.key ? "is-picked" : ""}"><span>${escapeHtml(entry.label)}</span><b>${getStatClashValue(entry.key, state.revealStats)}</b></div>`).join("")}</div>`
    : "";
  const renderPlayerCard = (side, player, isOpponent = false) => {
    const historyHtml = player.history.length
      ? player.history.map((entry) => `<div class="stat-clash-history-item"><span>Manche ${entry.round}</span><b>${escapeHtml(entry.statLabel)} +${entry.value}</b><small>${escapeHtml(entry.pokemonName)}${entry.auto ? " • auto" : ""}</small></div>`).join("")
      : '<p class="card-desc stat-clash-empty">Aucun pick pour le moment.</p>';
    const buttonsHtml = isOpponent || !["picking", "locked"].includes(state.phase)
      ? ""
      : STAT_CLASH_STATS.map((entry) => `<button type="button" class="stat-clash-stat-btn ${state.players.left.pendingPick?.key === entry.key ? "is-selected" : ""} ${state.usedStatsBySide.left.includes(entry.key) ? "is-used" : ""}" ${state.usedStatsBySide.left.includes(entry.key) || state.players.left.pendingPick ? "disabled" : ""} onclick="pickStatClashStat('left','${entry.key}')"><span>${escapeHtml(entry.label)}</span><b>Secret</b></button>`).join("");
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
    return `<section class="stat-clash-player-card ${winnerKey === side ? "is-winner" : ""}"><div class="stat-clash-player-head"><div><p class="stat-clash-player-side">${isOpponent ? (isRoom ? "Room 1v1" : "Bot") : "Toi"}</p><h3>${escapeHtml(player.label)}</h3></div><div class="stat-clash-score-box ${state.phase === "scoring" ? "is-animating" : ""}"><span>Total</span><b>${Math.round(player.displayScore || 0)}</b>${state.reveal?.[side] ? `<small>${escapeHtml(state.reveal[side].statLabel)} +${state.reveal[side].value}</small>` : ""}</div></div><div class="stat-clash-player-copy"><p class="stat-clash-player-status">${statusText}</p></div>${buttonsHtml ? `<div class="stat-clash-stat-grid">${buttonsHtml}</div>` : ""}<div class="stat-clash-history-block"><h4>Historique</h4><div class="stat-clash-history-list">${historyHtml}</div></div></section>`;
  };
  const roomControls = isRoom
    ? room?.code
      ? roomHasStarted
        ? `<section class="stat-clash-room-panel is-compact"><div class="stat-clash-room-summary"><span><b>Room :</b> ${escapeHtml(room.code)}</span><span><b>Joueurs :</b> ${Number(room.connectedCount || room.players?.filter((player) => player.connected).length || 0)}/${Number(room.maxPlayers || 2)}</span><span><b>Statut :</b> ${escapeHtml(room.status === "starting" ? "Countdown" : room.roundPhase === "rolling" ? "Préparation" : room.roundPhase === "picking" ? "Choix" : room.roundPhase === "reveal" ? "Reveal" : room.status === "finished" ? "Terminé" : "Live")}</span></div><div class="stat-clash-room-presence is-compact">${roomPlayersHtml}</div><div class="stat-clash-room-actions"><button class="btn-ghost" type="button" data-stat-clash-action="copy-room">Copier</button><button class="btn-ghost" type="button" data-stat-clash-action="leave-room">Quitter</button></div>${state.roomFeedback ? `<span class="stat-clash-room-feedback ${escapeHtml(state.roomFeedbackTone || "info")}">${escapeHtml(state.roomFeedback)}</span>` : ""}</section>`
        : `<section class="stat-clash-room-panel"><div class="stat-clash-room-status ${escapeHtml(roomUi?.tone || "is-idle")}"><div><strong>${escapeHtml(roomUi?.title || "Room 1v1")}</strong><small>${escapeHtml(roomUi?.detail || "Crée une room pour inviter un autre joueur.")}</small></div>${state.roomFeedback ? `<span class="stat-clash-room-feedback ${escapeHtml(state.roomFeedbackTone || "info")}">${escapeHtml(state.roomFeedback)}</span>` : ""}</div><div class="stat-clash-room-summary"><span><b>Room :</b> ${escapeHtml(room.code)}</span><span><b>Joueurs :</b> ${Number(room.connectedCount || room.players?.filter((player) => player.connected).length || 0)}/${Number(room.maxPlayers || 2)}</span><span><b>Statut :</b> ${escapeHtml(room.status === "starting" ? "Lancement..." : room.canStart ? "Prête" : "En attente")}</span></div><div class="stat-clash-room-presence">${roomPlayersHtml}</div><div class="stat-clash-room-actions"><button class="btn-ghost" type="button" data-stat-clash-action="copy-room">Copier</button><button class="btn-ghost" type="button" data-stat-clash-action="leave-room">Quitter</button>${selfRoomPlayer?.isHost ? `<button class="btn-red" type="button" data-stat-clash-action="start-room" ${roomBusy || !room?.canStart || room?.status === "live" || room?.status === "starting" ? "disabled" : ""}>${room?.status === "starting" ? "Lancement…" : "Lancer la partie"}</button>` : ""}</div>${!selfRoomPlayer?.isHost && room?.canStart && room?.status === "lobby" ? '<p class="card-desc stat-clash-room-waiting">En attente du lancement par l’hôte.</p>' : ""}</section>`
      : `<section class="stat-clash-room-panel"><div class="stat-clash-room-toolbar"><div class="stat-clash-room-row"><input id="stat-clash-nickname" class="stat-clash-room-input" type="text" maxlength="24" value="${escapeHtml(state.roomNameDraft || "")}" placeholder="Ton pseudo" oninput="syncStatClashNickname()" ${roomBusy ? "disabled" : ""} /><button class="btn-blue" type="button" data-stat-clash-action="create-room" ${roomBusy ? "disabled" : ""}>${state.roomPendingAction === "creating" ? "Création…" : "Créer"}</button></div><div class="stat-clash-room-row"><input id="stat-clash-room-input" class="stat-clash-room-input stat-clash-room-code-input" type="text" maxlength="6" value="${escapeHtml(state.roomCodeDraft || "")}" placeholder="Code de room" oninput="syncStatClashJoinCode()" ${roomBusy ? "disabled" : ""} /><button class="btn-ghost" type="button" data-stat-clash-action="join-room" ${roomBusy ? "disabled" : ""}>${state.roomPendingAction === "joining" ? "Connexion…" : "Rejoindre"}</button></div></div><div class="stat-clash-room-status ${escapeHtml(roomUi?.tone || "is-idle")}"><div><strong>${escapeHtml(roomUi?.title || "Room 1v1")}</strong><small>${escapeHtml(roomUi?.detail || "Crée une room pour inviter un autre joueur.")}</small></div>${state.roomFeedback ? `<span class="stat-clash-room-feedback ${escapeHtml(state.roomFeedbackTone || "info")}">${escapeHtml(state.roomFeedback)}</span>` : ""}</div></section>`
    : "";
  const lobbyCenterHtml = isRoom && roomIsLobby
    ? `<div class="stat-clash-lobby-center"><div class="stat-clash-lobby-center-head"><span>Lobby Room 1v1</span><strong>${escapeHtml(roomUi?.title || "Room 1v1")}</strong></div><div class="stat-clash-lobby-center-body"><div class="stat-clash-sprite-placeholder">?</div><h3>${escapeHtml(roomUi?.detail || "En attente de la room.")}</h3><p>${escapeHtml(selfRoomPlayer?.isHost ? "Partage le code puis lance la partie quand la room est complète." : room?.code ? `Connecté à ${room.code}. Attends le lancement par l’hôte.` : "Crée une room ou rejoins-en une avec un code.")}</p></div></div>`
    : `<div class="stat-clash-randomizer ${state.phase === "rolling" ? "is-rolling" : ""}"><div class="stat-clash-randomizer-head"><span>${state.phase === "starting-countdown" ? "Démarrage room" : "Pokémon tiré"}</span><strong>${escapeHtml(state.statusText)}</strong></div><div class="stat-clash-sprite-wrap">${current ? `<img src="${currentSprite}" alt="${escapeHtml(current.name)}" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(current))}'" />` : '<div class="stat-clash-sprite-placeholder">?</div>'}</div><div class="stat-clash-pokemon-meta"><h3>${escapeHtml(current?.name || (state.phase === "starting-countdown" ? "Prépare-toi…" : isRoom ? "Room en attente..." : "Chargement..."))}</h3><p>Les valeurs des 6 stats restent secrètes jusqu'à la révélation.</p></div><div class="stat-clash-timer ${["picking", "locked"].includes(state.phase) ? "is-live" : ""}"><div class="stat-clash-timer-ring"><span>${Math.max(0, Math.ceil(state.timerLeftMs / 1000))}</span></div><div class="stat-clash-timer-track"><span class="stat-clash-timer-fill" style="width:${timerPct}%"></span></div><small>${state.phase === "starting-countdown" ? "Le match commence quand le countdown atteint 0." : state.phase === "rolling" ? "Le randomizer termine son arrêt avant l'ouverture des choix." : ["picking", "locked"].includes(state.phase) ? "10 secondes complètes pour choisir ta stat." : "Le reveal arrive juste après les choix."}</small></div>${state.reveal ? `<div class="stat-clash-reveal-row"><div class="stat-clash-reveal-card"><span>${escapeHtml(state.players.left.label)}</span><b>${escapeHtml(state.reveal.left?.statLabel || "—")}</b><small>+${state.reveal.left?.value || 0}</small></div><div class="stat-clash-reveal-card"><span>${escapeHtml(state.players.right.label)}</span><b>${escapeHtml(state.reveal.right?.statLabel || "—")}</b><small>+${state.reveal.right?.value || 0}</small></div></div>${revealStatsHtml}` : ""}</div>`;
  const finalHtml = state.phase === "finished" ? `<section class="stat-clash-final-card ${winnerKey === "tie" ? "is-tie" : "is-win"}"><div class="stat-clash-final-head"><p class="stat-clash-final-kicker">Résultat final</p><h3>${winnerKey === "tie" ? "Égalité" : `${escapeHtml(state.players[winnerKey].label)} gagne`}</h3><p>${state.players.left.score} à ${state.players.right.score}</p></div><div class="stat-clash-final-actions"><button class="btn-red" type="button" onclick="restartStatClashGame()">Rejouer</button><button class="btn-ghost" type="button" onclick="goToConfig()">Retour menu</button></div></section>` : "";
  root.innerHTML = `<div class="stat-clash-shell mode-${isRoom ? "room" : "bot"} phase-${escapeHtml(state.phase)} ${roomHasStarted ? "is-live-layout" : "is-lobby-layout"}"><div class="stat-clash-mode-switch"><button class="btn-${isRoom ? "ghost" : "red"}" type="button" data-stat-clash-action="switch-bot">Vs Bot</button><button class="btn-${isRoom ? "red" : "ghost"}" type="button" data-stat-clash-action="switch-room">Room 1v1</button></div>${roomControls}${roomMetaPanelHtml}<div class="stat-clash-topline">${toplineHtml}</div><div class="stat-clash-board">${renderPlayerCard("left", state.players.left, false)}<section class="stat-clash-center-card">${lobbyCenterHtml}${(!isRoom || roomHasStarted) ? `<div class="stat-clash-remaining-block"><h4>Stats restantes pour toi</h4><div class="stat-clash-remaining-list">${remainingHtml}</div></div>` : ""}${finalHtml}</section>${renderPlayerCard("right", state.players.right, true)}</div></div>`;
}

function openStatClashMode() {
  const pool = getStatClashPool();
  if (!pool.length) return alert("Impossible de charger la base Pokémon complète pour Stat Clash.");
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
  renderStatClashScreen();
  startStatClashBotGame();
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
const RANKING_SPECIAL_FORM_NAMES = new Set([
  "Giratina Forme Originelle",
  "Shaymin Forme Céleste",
  "Fulguris Forme Totémique",
  "Boréas Forme Totémique",
  "Démétéros Forme Totémique",
  "Fort-Ivoire",
  "Hurle-Queue",
  "Fongus-Furie",
  "Flotte-Mèche",
  "Rampe-Ailes",
  "Pelage-Sablé",
  "Roue-de-Fer",
  "Hotte-de-Fer",
  "Paume-de-Fer",
  "Têtes-de-Fer",
  "Mite-de-Fer",
  "Épine-de-Fer",
  "Rugit-Lune",
  "Garde-de-Fer",
  "Koraidon",
  "Miraidon",
  "Serpente-Eau",
  "Vert-de-Fer",
]);

const SPECIAL_COLUMN_HEADER_INDEX = {
  starter: 18,
  gimmick: 19,
  legend: 20,
  favorite: 21,
};

function isRankingSpecialForm(pokemon) {
  return Boolean(pokemon?.isAltForm) || RANKING_SPECIAL_FORM_NAMES.has(pokemon?.name);
}

function buildRankingColumns() {
  const cols = RANKING_TYPES.map((type, index) => ({
    key: "type|" + type,
    label: type,
    headerIndex: index,
    matcher: (p) => p.type1 === type || p.type2 === type,
  }));

  cols.push(
    { key: "starter", label: "Starter", headerIndex: SPECIAL_COLUMN_HEADER_INDEX.starter, matcher: (p) => STARTER_IDS.has(p.id) },
    { key: "gimmick", label: "Forme", headerIndex: SPECIAL_COLUMN_HEADER_INDEX.gimmick, matcher: (p) => isRankingSpecialForm(p) },
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

function fillFavoriteRowCell(th) {
  const wrap = document.createElement("div");
  wrap.className = "rank-gen-sheet";
  wrap.style.setProperty("--sheet-index", String(GENBAR_ROW_COUNT - 1));
  wrap.style.setProperty("--sheet-count", String(GENBAR_ROW_COUNT - 1));
  wrap.style.setProperty("--sheet-url", `url("${RANKING_GENBAR_URL}")`);
  wrap.title = "Favorite";
  wrap.setAttribute("aria-label", "Favorite");
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

function rankingFavoriteRowKey(colKey) {
  return "favrow|" + String(colKey);
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
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
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

function getColumnCandidates(colKey) {
  const out = [];
  const seen = new Set();
  for (let gen = 1; gen <= 9; gen += 1) {
    const p = getRankingChoicePokemon(gen, colKey);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function getFavoriteRowCandidates(colKey) {
  if (colKey === "favorite") {
    const seen = new Set();
    const merged = [];
    for (let gen = 1; gen <= 9; gen += 1) {
      const rowFav = getRowFavoritePokemon(gen);
      if (rowFav && !seen.has(rowFav.id)) {
        seen.add(rowFav.id);
        merged.push(rowFav);
      }
    }
    for (const col of RANKING_COLUMNS) {
      const colFav = getFavoriteRowPokemon(col.key);
      if (colFav && !seen.has(colFav.id)) {
        seen.add(colFav.id);
        merged.push(colFav);
      }
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }
  return getColumnCandidates(colKey).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function getRowFavoritePokemon(gen) {
  const id = Number(rankingChoices[rankingFavoriteKey(gen)]);
  return Number.isInteger(id) ? POKEMON_BY_ID.get(id) || null : null;
}

function getFavoriteRowPokemon(colKey) {
  const id = Number(rankingChoices[rankingFavoriteRowKey(colKey)]);
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

  const favRow = document.createElement("tr");

  const favRowHead = document.createElement("th");
  favRowHead.className = "rank-gen-head rank-favorite-row-head";
  fillFavoriteRowCell(favRowHead);
  favRow.appendChild(favRowHead);

  for (const col of RANKING_COLUMNS) {
    const td = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rank-slot rank-favorite-slot";

    const pokemon = getFavoriteRowPokemon(col.key);
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

    btn.addEventListener("click", () => openRankingPickerForFavoriteRow(col.key, btn));
    td.appendChild(btn);
    favRow.appendChild(td);
  }

  const favTd = document.createElement("td");
  const favBtn = document.createElement("button");
  favBtn.type = "button";
  favBtn.className = "rank-slot rank-favorite-slot";

  const favPokemon = getFavoriteRowPokemon("favorite");
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

  favBtn.addEventListener("click", () => openRankingPickerForFavoriteRow("favorite", favBtn));
  favTd.appendChild(favBtn);
  favRow.appendChild(favTd);

  tbody.appendChild(favRow);

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

function openRankingPickerForFavoriteRow(colKey, anchorEl) {
  rankingSelected = { mode: "favRow", colKey, key: rankingFavoriteRowKey(colKey), anchorEl };
  rankingCandidates = getFavoriteRowCandidates(colKey);

  const col = colKey === "favorite"
    ? "Favori global"
    : (RANKING_COLUMNS.find((c) => c.key === colKey)?.label || "Type");
  const subtitle = colKey === "favorite"
    ? "Tous les Pokémon déjà retenus en ligne et en colonne"
    : "Choisis le meilleur Pokémon déjà retenu dans cette colonne";

  showRankingFloatPicker("Favorite • " + col, subtitle, rankingCandidates, anchorEl);
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
  const host = picker.closest("#screen-ranking > .card") || picker.parentElement;
  const hostRect = host ? host.getBoundingClientRect() : null;
  const margin = 12;

  let left = 20;
  let top = 20;

  if (anchor && hostRect) {
    const spaceBelow = hostRect.bottom - anchor.bottom - margin;
    const spaceAbove = anchor.top - hostRect.top - margin;
    const spaceRight = hostRect.right - anchor.right - margin;
    const spaceLeft = anchor.left - hostRect.left - margin;

    if (spaceBelow >= pickerRect.height + 8 || spaceBelow >= spaceAbove) {
      top = anchor.bottom - hostRect.top + 8;
    } else {
      top = anchor.top - hostRect.top - pickerRect.height - 8;
    }

    if (spaceRight >= pickerRect.width) {
      left = anchor.left - hostRect.left;
    } else if (spaceLeft >= pickerRect.width) {
      left = anchor.right - hostRect.left - pickerRect.width;
    } else {
      left = anchor.left - hostRect.left + (anchor.width / 2) - (pickerRect.width / 2);
    }

    const maxLeft = hostRect.width - pickerRect.width - margin;
    const maxTop = hostRect.height - pickerRect.height - margin;
    left = Math.max(margin, Math.min(left, Math.max(margin, maxLeft)));
    top = Math.max(margin, Math.min(top, Math.max(margin, maxTop)));
  }

  picker.style.left = Math.round(left) + "px";
  picker.style.top = Math.round(top) + "px";
  picker.style.right = "auto";
  picker.style.bottom = "auto";
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
  openStatClashMode: { label: "Stat Clash 1v1", description: "Draft de stats en 3 manches sur de vraies base stats Pokémon.", category: "challenge" },
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
    "screen-team-builder",
    "screen-teams",
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

const HOME_DEFENSE_TEAM_SELECT_IDS = [
  "home-defense-slot1-type1",
  "home-defense-slot1-type2",
  "home-defense-slot2-type1",
  "home-defense-slot2-type2",
  "home-defense-slot3-type1",
  "home-defense-slot3-type2",
];

const HOME_DEFENSE_TEAM_TYPES = Object.keys(TYPE_EFFECTIVENESS);

function renderHomeAnalysisChip(type, meta) {
  return `<span class="home-analysis-chip"><b>${escapeHtml(type)}</b><small>${escapeHtml(meta)}</small></span>`;
}

function getHomeDefenseTeamSlots() {
  const slots = [];
  for (let i = 1; i <= 3; i += 1) {
    const type1 = document.getElementById(`home-defense-slot${i}-type1`);
    const type2 = document.getElementById(`home-defense-slot${i}-type2`);
    if (!type1 || !type2) continue;
    const t1 = type1.value || "";
    const t2 = type2.value || "";
    if (!t1) continue;
    slots.push([t1].concat(t2 ? [t2] : []));
  }
  return slots;
}

function renderHomeDefenseTypeHelper() {
  const weak = document.getElementById("home-defense-team-weaknesses");
  const cover = document.getElementById("home-defense-team-coverage");
  if (!weak || !cover) return;

  const slots = getHomeDefenseTeamSlots();
  if (!slots.length) {
    weak.innerHTML = '<span class="home-type-helper-empty">Ajoute au moins un slot.</span>';
    cover.innerHTML = '<span class="home-type-helper-empty">La couverture apparaîtra ici.</span>';
    return;
  }

  const rows = HOME_DEFENSE_TEAM_TYPES.map((attackType) => {
    const multipliers = slots.map((slot) => slot.reduce((product, defenseType) => product * attackMultiplier(attackType, defenseType), 1));
    const weakCount = multipliers.filter((multiplier) => multiplier > 1).length;
    const coverCount = multipliers.filter((multiplier) => multiplier > 0 && multiplier < 1).length;
    const immuneCount = multipliers.filter((multiplier) => multiplier === 0).length;
    const coverageScore = coverCount + (immuneCount * 2);
    const maxMultiplier = multipliers.length ? Math.max(...multipliers) : 0;
    return { type: attackType, weakCount, coverCount, immuneCount, coverageScore, maxMultiplier };
  });

  const threats = rows
    .filter((row) => row.weakCount > 0)
    .sort((a, b) => b.weakCount - a.weakCount || b.maxMultiplier - a.maxMultiplier || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  const coverage = rows
    .filter((row) => row.coverageScore > 0)
    .sort((a, b) => b.coverageScore - a.coverageScore || b.immuneCount - a.immuneCount || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  weak.innerHTML = threats.length
    ? threats.map((row) => renderHomeAnalysisChip(row.type, `×${row.weakCount}`)).join("")
    : '<span class="home-type-helper-empty">Aucune faiblesse marquée.</span>';

  cover.innerHTML = coverage.length
    ? coverage.map((row) => renderHomeAnalysisChip(row.type, `×${row.coverageScore}`)).join("")
    : '<span class="home-type-helper-empty">Aucune couverture notable.</span>';
}

function initHomeDefenseTypeHelper() {
  for (const id of HOME_DEFENSE_TEAM_SELECT_IDS) {
    const select = document.getElementById(id);
    if (!select || select.dataset.ready) continue;
    select.innerHTML = [
      '<option value="">Aucun</option>',
      ...HOME_DEFENSE_TEAM_TYPES.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`),
    ].join("");
    select.dataset.ready = "1";
    if (id === "home-defense-slot1-type1") select.value = "Normal";
    else select.value = "";
    select.addEventListener("change", renderHomeDefenseTypeHelper);
  }
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

function createTeamBuilderEmptySlot() {
  return {
    pokemonId: null,
    item: "",
    gimmick: "",
    moves: ["", "", "", ""],
    nature: "Hardi",
    talent: "",
    evPreset: "offensive-physique",
    evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
    ivPreset: "all31",
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  };
}

function createTeamBuilderState() {
  return Array.from({ length: 6 }, () => createTeamBuilderEmptySlot());
}

function normalizeTeamBuilderSpread(spread, defaultStat = 0, minStat = 0, maxStat = 252) {
  const safe = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return defaultStat;
    return Math.max(minStat, Math.min(maxStat, Math.round(n)));
  };
  return {
    hp: safe(spread?.hp),
    atk: safe(spread?.atk),
    def: safe(spread?.def),
    spa: safe(spread?.spa),
    spd: safe(spread?.spd),
    spe: safe(spread?.spe),
  };
}

function normalizeTeamBuilderState(state) {
  const slots = Array.isArray(state) ? state.slice(0, 6) : [];
  while (slots.length < 6) slots.push(createTeamBuilderEmptySlot());
  return slots.map((slot) => ({
    pokemonId: (() => {
      const id = Number(slot?.pokemonId);
      return Number.isInteger(id) && id > 0 ? id : null;
    })(),
    item: TEAM_BUILDER_ITEMS.includes(slot?.item) ? slot.item : "",
    gimmick: TEAM_BUILDER_GIMMICKS.includes(slot?.gimmick) ? slot.gimmick : "",
    moves: Array.isArray(slot?.moves)
      ? slot.moves.slice(0, 4).map((move) => (typeof move === "string" ? move.trim() : ""))
      : ["", "", "", ""],
    nature: TEAM_BUILDER_NATURES.some((nature) => nature.value === slot?.nature) ? slot.nature : "Hardi",
    talent: typeof slot?.talent === "string" ? slot.talent : "",
    evPreset: TEAM_BUILDER_EV_PRESETS.some((preset) => preset.value === slot?.evPreset) ? slot.evPreset : "offensive-physique",
    evs: slot?.evs ? normalizeTeamBuilderSpread(slot.evs, 0, 0, 252) : createTeamBuilderEmptySlot().evs,
    ivPreset: TEAM_BUILDER_IV_PRESETS.some((preset) => preset.value === slot?.ivPreset) ? slot.ivPreset : "all31",
    ivs: slot?.ivs ? normalizeTeamBuilderSpread(slot.ivs, 31, 0, 31) : createTeamBuilderEmptySlot().ivs,
  }));
}

function loadTeamBuilderState() {
  const parsed = readJson(STORAGE_KEYS.teamBuilder, null);
  teamBuilderState = normalizeTeamBuilderState(parsed);
}

function saveTeamBuilderState() {
  writeJson(STORAGE_KEYS.teamBuilder, teamBuilderState);
}

function getTeamBuilderPokemon(slot) {
  return slot?.pokemonId ? POKEMON_BY_ID.get(slot.pokemonId) || null : null;
}

function getTeamBuilderSlotPokemonTypes(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  return pokemon ? [pokemon.type1, pokemon.type2].filter(Boolean) : [];
}

function getTeamBuilderOffenseBucket(slot) {
  const preset = String(slot?.evPreset || "");
  if (preset === "offensive-physique") return "physique";
  if (preset === "offensive-speciale") return "speciale";
  if (preset === "support" || preset === "bulky") return "support";
  if (preset === "rapide") {
    const atk = Number(slot?.evs?.atk) || 0;
    const spa = Number(slot?.evs?.spa) || 0;
    if (atk === spa) return "support";
    return atk > spa ? "physique" : "speciale";
  }
  if (preset !== "custom") return "support";

  const atk = Number(slot?.evs?.atk) || 0;
  const spa = Number(slot?.evs?.spa) || 0;
  const hp = Number(slot?.evs?.hp) || 0;
  const def = Number(slot?.evs?.def) || 0;
  const spd = Number(slot?.evs?.spd) || 0;
  const bulk = hp + def + spd;
  const speed = Number(slot?.evs?.spe) || 0;

  if (atk >= 180 && atk >= spa + 60) return "physique";
  if (spa >= 180 && spa >= atk + 60) return "speciale";
  if (bulk >= 420 || speed < 128) return "support";
  return atk >= spa ? "physique" : "speciale";
}

function getTeamBuilderSlotSelectedMoveTypes(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) return [];

  const movePool = getTeamBuilderMovePool(slot);
  const moveTypes = [];
  const seen = new Set();

  (slot.moves || []).forEach((moveName) => {
    if (!moveName) return;
    const move = movePool.find((entry) => entry.name === moveName);
    const type = Array.isArray(move?.types) && move.types.length
      ? move.types[0]
      : null;
    if (!type || seen.has(type)) return;
    seen.add(type);
    moveTypes.push(type);
  });

  return moveTypes;
}

function getTeamBuilderSuggestedTypes(synthesis, filledSlots) {
  const existingTypes = new Set();
  filledSlots.forEach(({ types }) => types.forEach((type) => existingTypes.add(type)));

  return Object.keys(TYPE_EFFECTIVENESS)
    .filter((candidate) => !existingTypes.has(candidate))
    .map((candidate) => {
      const weaknessHelp = (synthesis.weaknesses || []).reduce((sum, row) => {
        const multiplier = attackMultiplier(row.type, candidate);
        if (multiplier === 0) return sum + 4;
        if (multiplier < 1) return sum + 3;
        return sum;
      }, 0);
      const blindSpotHelp = (synthesis.offenseBlindSpots || []).reduce((sum, row) => {
        const offensiveMultiplier = attackMultiplier(candidate, row.type);
        if (offensiveMultiplier > 1) return sum + 3;
        if (offensiveMultiplier === 1) return sum + 1;
        return sum;
      }, 0);
      const duplicatePenalty = existingTypes.has(candidate) ? 4 : 0;
      const score = weaknessHelp + blindSpotHelp - duplicatePenalty;
      return { type: candidate, score };
    })
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);
}

function getTeamBuilderSlotDefenseProfile(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) {
    return {
      weaknesses: [],
      resistances: [],
      immunities: [],
    };
  }

  const defendingTypes = [pokemon.type1, pokemon.type2].filter(Boolean);
  const rows = Object.keys(TYPE_EFFECTIVENESS).map((attackType) => {
    const multiplier = defendingTypes.reduce((product, defenseType) => product * attackMultiplier(attackType, defenseType), 1);
    return { type: attackType, multiplier };
  });

  return {
    weaknesses: rows.filter((row) => row.multiplier > 1).sort((a, b) => b.multiplier - a.multiplier || a.type.localeCompare(b.type, "fr")).slice(0, 4),
    resistances: rows.filter((row) => row.multiplier > 0 && row.multiplier < 1).sort((a, b) => a.multiplier - b.multiplier || a.type.localeCompare(b.type, "fr")).slice(0, 4),
    immunities: rows.filter((row) => row.multiplier === 0).sort((a, b) => a.type.localeCompare(b.type, "fr")).slice(0, 3),
  };
}

function getTeamBuilderInternalCoverage(filledSlots) {
  const links = [];
  filledSlots.forEach((entry, index) => {
    const defense = getTeamBuilderSlotDefenseProfile(entry.slot);
    defense.weaknesses.forEach((weakness) => {
      const cover = filledSlots.find((candidate, candidateIndex) => {
        if (candidateIndex === index) return false;
        const candidateDefense = getTeamBuilderSlotDefenseProfile(candidate.slot);
        return candidateDefense.immunities.some((row) => row.type === weakness.type)
          || candidateDefense.resistances.some((row) => row.type === weakness.type);
      });
      if (!cover) return;
      links.push({
        weakTo: weakness.type,
        source: entry.pokemon.name,
        cover: cover.pokemon.name,
      });
    });
  });

  const seen = new Set();
  return links.filter((entry) => {
    const key = `${entry.source}:${entry.weakTo}:${entry.cover}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function getTeamBuilderSlotRoleData(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) {
    return {
      primary: "Slot vide",
      chips: [],
      bucket: "empty",
    };
  }

  const movePool = getTeamBuilderMovePool(slot);
  const selectedMoves = (slot.moves || [])
    .filter(Boolean)
    .map((moveName) => movePool.find((entry) => entry.name === moveName))
    .filter(Boolean);
  const stats = {
    hp: Number(slot?.evs?.hp) || 0,
    atk: Number(slot?.evs?.atk) || 0,
    def: Number(slot?.evs?.def) || 0,
    spa: Number(slot?.evs?.spa) || 0,
    spd: Number(slot?.evs?.spd) || 0,
    spe: Number(slot?.evs?.spe) || 0,
  };
  const bulk = stats.hp + stats.def + stats.spd;
  const speed = stats.spe;
  const attackBias = stats.atk - stats.spa;
  const supportMoves = ["Atterrissage", "Repos", "Abri", "Danse-Lames", "Mur Lumière", "Protection", "Reflet", "Toxik", "Vœu Soin"];
  const supportCount = selectedMoves.filter((move) => supportMoves.includes(move.name)).length;
  const selectedMoveTypes = getTeamBuilderSlotSelectedMoveTypes(slot);
  const stabCount = selectedMoves.filter((move) => move.types?.some((type) => type === pokemon.type1 || type === pokemon.type2)).length;
  const coverageCount = selectedMoveTypes.filter((type) => type !== pokemon.type1 && type !== pokemon.type2).length;

  let primary = "Pivot";
  let bucket = "pivot";
  if (supportCount >= 2 || (bulk >= 340 && speed <= 80)) {
    primary = "Support";
    bucket = "support";
  } else if (speed >= 180 && (stats.atk >= 180 || stats.spa >= 180)) {
    primary = "Revenge killer";
    bucket = "speed";
  } else if (stats.atk >= 220 && attackBias >= 40) {
    primary = "Sweeper physique";
    bucket = "physical";
  } else if (stats.spa >= 220 && attackBias <= -40) {
    primary = "Sweeper spécial";
    bucket = "special";
  } else if (bulk >= 430) {
    primary = "Tank";
    bucket = "tank";
  } else if (coverageCount >= 2 && stabCount >= 1) {
    primary = "Breaker";
    bucket = "breaker";
  }

  const chips = [];
  if (stabCount >= 2) chips.push("Double STAB");
  else if (stabCount >= 1) chips.push("STAB fiable");
  if (coverageCount >= 2) chips.push("Bonne couverture");
  else if (coverageCount === 1) chips.push("Couverture simple");
  if (speed >= 180) chips.push("Rapide");
  if (bulk >= 430) chips.push("Solide");
  if (supportCount >= 1) chips.push("Outil utile");

  return {
    primary,
    chips: chips.slice(0, 3),
    bucket,
  };
}

function getTeamBuilderTeamSynthesis() {
  const filledSlots = [];
  const typeCounts = new Map();
  const offenseCounts = { physique: 0, speciale: 0, support: 0 };
  const roleCounts = new Map();
  let moveCount = 0;
  let fastPressureCount = 0;
  let offensivePressureCount = 0;
  const selectedMoveTypes = new Set();

  for (const slot of teamBuilderState) {
    if (!slot) continue;
    moveCount += slot.moves.filter(Boolean).length;

    const pokemon = getTeamBuilderPokemon(slot);
    if (!pokemon) continue;

    const types = [pokemon.type1, pokemon.type2].filter(Boolean);
    filledSlots.push({ slot, pokemon, types });

    types.forEach((type) => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    const bucket = getTeamBuilderOffenseBucket(slot);
    offenseCounts[bucket] += 1;

    const role = getTeamBuilderSlotRoleData(slot);
    roleCounts.set(role.primary, (roleCounts.get(role.primary) || 0) + 1);
    if (["speed", "physical", "special", "breaker"].includes(role.bucket)) offensivePressureCount += 1;
    if (["speed", "physical", "special"].includes(role.bucket)) fastPressureCount += 1;

    getTeamBuilderSlotSelectedMoveTypes(slot).forEach((type) => selectedMoveTypes.add(type));
  }

  const attackTypes = Object.keys(TYPE_EFFECTIVENESS);
  const teamMatchups = attackTypes.map((attackType) => {
    const multipliers = filledSlots.map(({ types }) => {
      if (!types.length) return 1;
      return types.reduce((product, defenseType) => product * attackMultiplier(attackType, defenseType), 1);
    });
    const weakCount = multipliers.filter((multiplier) => multiplier > 1).length;
    const resistCount = multipliers.filter((multiplier) => multiplier > 0 && multiplier < 1).length;
    const immuneCount = multipliers.filter((multiplier) => multiplier === 0).length;
    const coverageScore = resistCount + immuneCount * 2;
    const threatScore = weakCount * 3 + (multipliers.length ? Math.max(...multipliers) : 0);
    const maxMultiplier = multipliers.length ? Math.max(...multipliers) : 0;
    return {
      type: attackType,
      weakCount,
      resistCount,
      immuneCount,
      coverageScore,
      threatScore,
      maxMultiplier,
    };
  });

  const weaknesses = teamMatchups
    .filter((row) => row.weakCount > 0)
    .sort((a, b) => b.threatScore - a.threatScore || b.weakCount - a.weakCount || b.maxMultiplier - a.maxMultiplier || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  const coverage = teamMatchups
    .filter((row) => row.coverageScore > 0)
    .sort((a, b) => b.coverageScore - a.coverageScore || b.immuneCount - a.immuneCount || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  const duplicates = [...typeCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));

  const offensiveCoverage = attackTypes
    .map((defenseType) => {
      const superCount = [...selectedMoveTypes].filter((attackType) => attackMultiplier(attackType, defenseType) > 1).length;
      const immuneCount = [...selectedMoveTypes].filter((attackType) => attackMultiplier(attackType, defenseType) === 0).length;
      const neutralCount = [...selectedMoveTypes].filter((attackType) => attackMultiplier(attackType, defenseType) === 1).length;
      return {
        type: defenseType,
        superCount,
        immuneCount,
        neutralCount,
      };
    })
    .sort((a, b) => b.superCount - a.superCount || a.immuneCount - b.immuneCount || a.type.localeCompare(b.type, "fr"));

  const bestOffense = offensiveCoverage
    .filter((row) => row.superCount > 0)
    .slice(0, 4);

  const offenseBlindSpots = offensiveCoverage
    .filter((row) => row.superCount === 0)
    .sort((a, b) => a.neutralCount - b.neutralCount || b.immuneCount - a.immuneCount || a.type.localeCompare(b.type, "fr"))
    .slice(0, 4);

  const synthesis = {
    filledCount: filledSlots.length,
    distinctTypeCount: typeCounts.size,
    moveCount,
    offenseCounts,
    fastPressureCount,
    offensivePressureCount,
    weaknesses,
    coverage,
    duplicates,
    selectedMoveTypeCount: selectedMoveTypes.size,
    bestOffense,
    offenseBlindSpots,
    roleSummary: [...roleCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
      .slice(0, 4),
    internalCoverage: getTeamBuilderInternalCoverage(filledSlots),
  };
  synthesis.suggestedTypes = getTeamBuilderSuggestedTypes(synthesis, filledSlots);

  return synthesis;
}

function getTeamBuilderPokemonCatalog() {
  return [...POKEMON_LIST].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function getTeamBuilderPokemonApiKey(pokemon) {
  if (!pokemon) return null;
  if (FORM_API_NAME_BY_NAME[pokemon.name]) return FORM_API_NAME_BY_NAME[pokemon.name];
  const baseId = Number.isInteger(pokemon.baseId) && pokemon.baseId > 0 ? pokemon.baseId : null;
  const spriteId = Number.isInteger(getPokemonSpriteId(pokemon)) && getPokemonSpriteId(pokemon) > 0 ? getPokemonSpriteId(pokemon) : null;
  return String(baseId || spriteId || "");
}

function getTeamBuilderPokemonTalentCacheKey(pokemon) {
  return getTeamBuilderPokemonApiKey(pokemon) || `pokemon-${pokemon?.id || "unknown"}`;
}

function getTeamBuilderPokemonNatureOptions() {
  return TEAM_BUILDER_NATURES;
}

function getTeamBuilderNatureLabel(value) {
  return TEAM_BUILDER_NATURES.find((nature) => nature.value === value)?.label || "Hardi (neutre)";
}

function getTeamBuilderNatureModifiers(natureValue) {
  const modifiers = { atk: 1, def: 1, spa: 1, spd: 1, spe: 1 };
  const nature = TEAM_BUILDER_NATURE_EFFECTS[natureValue];
  if (!nature) return modifiers;
  if (nature.up && modifiers[nature.up] != null) modifiers[nature.up] = 1.1;
  if (nature.down && modifiers[nature.down] != null) modifiers[nature.down] = 0.9;
  return modifiers;
}

function getTeamBuilderSpreadPreset(presets, value) {
  return presets.find((preset) => preset.value === value) || presets[0];
}

function cloneTeamBuilderSpread(spread) {
  return normalizeTeamBuilderSpread(spread, 0, 0, 999);
}

function formatTeamBuilderSpreadShort(spread) {
  if (!spread) return "0 / 0 / 0 / 0 / 0 / 0";
  return [spread.hp, spread.atk, spread.def, spread.spa, spread.spd, spread.spe].map((n) => String(Number(n) || 0)).join(" / ");
}

function applyTeamBuilderSpreadPreset(slot, presetValue, kind) {
  const presets = kind === "iv" ? TEAM_BUILDER_IV_PRESETS : TEAM_BUILDER_EV_PRESETS;
  const preset = getTeamBuilderSpreadPreset(presets, presetValue);
  if (!slot || !preset) return;

  if (kind === "iv") {
    slot.ivPreset = preset.value;
    if (preset.spread) slot.ivs = cloneTeamBuilderSpread(preset.spread);
  } else {
    slot.evPreset = preset.value;
    if (preset.spread) slot.evs = cloneTeamBuilderSpread(preset.spread);
  }
}

async function fetchTeamBuilderPokemonApiData(pokemon) {
  const key = getTeamBuilderPokemonApiKey(pokemon);
  if (!key) return null;
  const cacheKey = `team-builder:${key}`;
  if (POKEDEX_API_CACHE.has(cacheKey)) return POKEDEX_API_CACHE.get(cacheKey);

  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${key}`);
    if (!response.ok) return null;
    const data = await response.json();
    POKEDEX_API_CACHE.set(cacheKey, data);
    return data;
  } catch (_err) {
    return null;
  }
}

async function getTeamBuilderTalentOptions(pokemonData) {
  const abilities = Array.isArray(pokemonData?.abilities) ? pokemonData.abilities : [];
  if (!abilities.length) {
    return [{ value: "", label: "Talent principal" }];
  }
  return Promise.all(
    abilities
      .slice()
      .sort((a, b) => Number(a.slot) - Number(b.slot))
      .map(async (entry, index) => {
        const abilityData = await fetchPokedexAbilityData(entry.ability?.url);
        const fr = abilityNameFr(abilityData);
        const raw = entry.ability?.name || `talent-${index + 1}`;
        const fallback = raw
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const label = fr || fallback;
        return {
          value: label,
          label: entry.is_hidden ? `${label} (caché)` : label,
        };
      })
  );
}

const TEAM_BUILDER_MOVE_TYPE_LABELS = {
  normal: "Normal",
  fire: "Feu",
  water: "Eau",
  electric: "Électrik",
  grass: "Plante",
  ice: "Glace",
  fighting: "Combat",
  poison: "Poison",
  ground: "Sol",
  flying: "Vol",
  psychic: "Psy",
  bug: "Insecte",
  rock: "Roche",
  ghost: "Spectre",
  dragon: "Dragon",
  dark: "Ténèbres",
  steel: "Acier",
  fairy: "Fée",
};

function typeLabelFrFromApiName(typeName) {
  return TEAM_BUILDER_MOVE_TYPE_LABELS[typeName] || String(typeName || "").replace(/^\w/, (c) => c.toUpperCase());
}

function moveNameFr(moveData) {
  if (!moveData?.names) return null;
  const fr = moveData.names.find((entry) => entry?.language?.name === "fr");
  return fr?.name || null;
}

function moveMethodRank(methodName) {
  const normalized = String(methodName || "");
  if (normalized === "level-up") return 0;
  if (normalized === "machine") return 1;
  if (normalized === "tutor") return 2;
  if (normalized === "egg") return 3;
  return 4;
}

function getTeamBuilderMoveCacheKey(pokemon) {
  return `team-builder-moves:${getTeamBuilderPokemonApiKey(pokemon) || pokemon?.id || "unknown"}`;
}

async function fetchPokedexMoveData(url) {
  if (typeof url !== "string" || !url) return null;
  if (POKEDEX_API_CACHE.has(url)) return POKEDEX_API_CACHE.get(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    POKEDEX_API_CACHE.set(url, data);
    return data;
  } catch (_err) {
    return null;
  }
}

function buildTeamBuilderFallbackMovePool(pokemon) {
  const templateMoves = getTeamBuilderTemplateMovePool(pokemon);
  if (templateMoves.length) return templateMoves;

  const selectedTypes = pokemon ? [pokemon.type1, pokemon.type2].filter(Boolean) : [];
  const pool = TEAM_BUILDER_MOVE_LIBRARY.filter((move) => {
    if (!pokemon) return false;
    if (!Array.isArray(move?.types) || !move.types.length) return true;
    return move.types.some((type) => selectedTypes.includes(type));
  });
  const priority = new Map([
    ["Feu", 0],
    ["Eau", 1],
    ["Plante", 2],
    ["Électrik", 3],
    ["Glace", 4],
    ["Combat", 5],
    ["Dragon", 6],
    ["Ténèbres", 7],
    ["Psy", 8],
    ["Vol", 9],
    ["Fée", 10],
    ["Acier", 11],
    ["Poison", 12],
    ["Sol", 13],
    ["Spectre", 14],
    ["Roche", 15],
    ["Insecte", 16],
    ["Utilitaire", 50],
  ]);

  return pool.slice().sort((a, b) => {
    const score = (move) => {
      if (!selectedTypes.length) return move.types.length ? 2 : 1;
      if (!move.types.length) return 1;
      if (move.types.some((type) => selectedTypes.includes(type))) return 0;
      return 2;
    };
    const pa = score(a);
    const pb = score(b);
    const ta = a.types.length ? Math.min(...a.types.map((type) => priority.get(type) ?? 40)) : 99;
    const tb = b.types.length ? Math.min(...b.types.map((type) => priority.get(type) ?? 40)) : 99;
    return pa - pb || ta - tb || a.name.localeCompare(b.name, "fr");
  });
}

function getTeamBuilderTemplateMovePool(pokemon) {
  const pokemonId = Number(pokemon?.id);
  if (!Number.isInteger(pokemonId)) return [];

  const names = new Set();
  for (const template of TEAM_LIBRARY_TEMPLATES) {
    for (const slot of template?.slots || []) {
      if (Number(slot?.pokemonId) !== pokemonId) continue;
      for (const moveName of slot.moves || []) {
        if (moveName) names.add(moveName);
      }
    }
  }

  return [...names]
    .map((name) => {
      const entry = TEAM_BUILDER_MOVE_LIBRARY.find((move) => move.name === name);
      if (entry) return entry;
      return { name, types: [] };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

async function getTeamBuilderMovePoolForPokemon(pokemon) {
  const cacheKey = getTeamBuilderMoveCacheKey(pokemon);
  if (TEAM_BUILDER_MOVE_POOL_CACHE.has(cacheKey)) return TEAM_BUILDER_MOVE_POOL_CACHE.get(cacheKey);
  if (TEAM_BUILDER_MOVE_POOL_PENDING.has(cacheKey)) return TEAM_BUILDER_MOVE_POOL_PENDING.get(cacheKey);

  const promise = (async () => {
    const pokemonData = await fetchTeamBuilderPokemonApiData(pokemon);
    const fallback = buildTeamBuilderFallbackMovePool(pokemon);
    if (!pokemonData?.moves?.length) return fallback;

    const seen = new Map();
    for (const entry of pokemonData.moves) {
      const moveUrl = entry?.move?.url;
      const moveName = entry?.move?.name;
      const details = Array.isArray(entry?.version_group_details) ? entry.version_group_details : [];
      if (!moveUrl || !details.length) continue;

      const bestDetail = details
        .slice()
        .sort((a, b) => moveMethodRank(a?.move_learn_method?.name) - moveMethodRank(b?.move_learn_method?.name) || Number(a?.level_learned_at || 0) - Number(b?.level_learned_at || 0))[0];
      const rank = moveMethodRank(bestDetail?.move_learn_method?.name);
      const level = Number(bestDetail?.level_learned_at || 0);
      const prev = seen.get(moveUrl);
      if (prev && prev.rank <= rank && prev.level <= level) continue;
      seen.set(moveUrl, { moveUrl, moveName, rank, level });
    }

    const pokemonTypes = new Set([pokemon?.type1, pokemon?.type2].filter(Boolean));
    const moves = await Promise.all(
      [...seen.values()].map(async (entry) => {
        const moveData = await fetchPokedexMoveData(entry.moveUrl);
        const frName = moveNameFr(moveData);
        const rawName = entry.moveName || "Attaque";
        const fallbackName = rawName.charAt(0).toUpperCase() + rawName.slice(1).replace(/-/g, " ");
        const typeApi = moveData?.type?.name || "";
        const typeFr = typeLabelFrFromApiName(typeApi);
        const typeMatches = pokemonTypes.has(typeFr);
        return {
          name: frName || fallbackName,
          types: typeFr ? [typeFr] : [],
          rank: entry.rank,
          level: entry.level,
          typeMatches,
        };
      })
    );

    const unique = new Map();
    for (const move of moves) {
      if (!move?.name) continue;
      const prev = unique.get(move.name);
      if (!prev) {
        unique.set(move.name, move);
        continue;
      }
      if (move.rank < prev.rank || (move.rank === prev.rank && move.level < prev.level)) {
        unique.set(move.name, move);
      }
    }

    const sorted = [...unique.values()].sort((a, b) => {
      const typeScore = (move) => (move.typeMatches ? 0 : move.types.length ? 1 : 2);
      const rankScore = a.rank - b.rank || a.level - b.level;
      return typeScore(a) - typeScore(b) || rankScore || a.name.localeCompare(b.name, "fr");
    });

    return sorted.length ? sorted.slice(0, 48) : fallback;
  })();

  TEAM_BUILDER_MOVE_POOL_PENDING.set(cacheKey, promise);
  try {
    const result = await promise;
    TEAM_BUILDER_MOVE_POOL_CACHE.set(cacheKey, result);
    return result;
  } finally {
    TEAM_BUILDER_MOVE_POOL_PENDING.delete(cacheKey);
  }
}

function getTeamBuilderMovePool(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) return [];
  const cacheKey = getTeamBuilderMoveCacheKey(pokemon);
  return TEAM_BUILDER_MOVE_POOL_CACHE.get(cacheKey) || buildTeamBuilderFallbackMovePool(pokemon);
}

function sanitizeTeamBuilderSlotMoves(slot, movePool) {
  if (!slot) return false;
  const allowed = new Set(movePool.map((move) => move.name));
  let changed = false;
  slot.moves = slot.moves.map((move) => {
    if (!move) return "";
    if (!allowed.has(move)) {
      changed = true;
      return "";
    }
    return move;
  });
  return changed;
}

function renderTeamBuilderSummary() {
  const summary = document.getElementById("team-builder-summary");
  if (!summary) return;

  const synthesis = getTeamBuilderTeamSynthesis();
  const renderChip = (label, value) => `
    <span class="home-builder-summary-chip">
      ${escapeHtml(label)}: <b>${escapeHtml(value)}</b>
    </span>
  `;
  const renderTypeChip = (type, meta) => `
    <span class="home-analysis-chip">
      <b>${escapeHtml(type)}</b>
      <small>${escapeHtml(meta)}</small>
    </span>
  `;
  const defensiveCoverageScore = synthesis.coverage.reduce((sum, row) => sum + row.resistCount + (row.immuneCount * 2), 0);
  const immunityTotal = synthesis.coverage.reduce((sum, row) => sum + row.immuneCount, 0);
  const speedPressureLabel = synthesis.fastPressureCount >= 3 ? "Bonne pression vitesse" : synthesis.fastPressureCount >= 1 ? "Vitesse partielle" : "Vitesse limitée";
  const offenseBalanceLabel = synthesis.offenseCounts.physique && synthesis.offenseCounts.speciale
    ? "Mix physique / spécial"
    : synthesis.offenseCounts.physique
      ? "Orientation physique"
      : synthesis.offenseCounts.speciale
        ? "Orientation spéciale"
        : "Support dominant";

  const threatsHtml = synthesis.weaknesses.length
    ? synthesis.weaknesses
        .map((row) => renderTypeChip(row.type, row.weakCount === 1 ? "1 faiblesse" : `${row.weakCount} faiblesses`))
        .join("")
    : '<span class="home-type-helper-empty">Aucune faiblesse marquée.</span>';

  const coverageHtml = synthesis.coverage.length
    ? synthesis.coverage
        .map((row) => {
          const parts = [];
          if (row.resistCount) parts.push(`${row.resistCount} résistance${row.resistCount > 1 ? "s" : ""}`);
          if (row.immuneCount) parts.push(`${row.immuneCount} immunité${row.immuneCount > 1 ? "s" : ""}`);
          return renderTypeChip(row.type, parts.join(" + ") || "Couverture");
        })
        .join("")
    : '<span class="home-type-helper-empty">Aucune couverture notable.</span>';

  const duplicatesHtml = synthesis.duplicates.length
    ? synthesis.duplicates.map(([type, count]) => renderTypeChip(type, `x${count}`)).join("")
    : '<span class="home-type-helper-empty">Aucun doublon évident.</span>';

  const bestOffenseHtml = synthesis.bestOffense.length
    ? synthesis.bestOffense
        .map((row) => renderTypeChip(row.type, row.superCount === 1 ? "1 attaque forte" : `${row.superCount} attaques fortes`))
        .join("")
    : '<span class="home-type-helper-empty">Aucune couverture offensive claire.</span>';

  const blindSpotsHtml = synthesis.offenseBlindSpots.length
    ? synthesis.offenseBlindSpots
        .map((row) => renderTypeChip(row.type, row.immuneCount ? "attention aux immunités" : "peu de pression"))
        .join("")
    : '<span class="home-type-helper-empty">Aucun angle mort marqué.</span>';

  const suggestedTypesHtml = synthesis.suggestedTypes.length
    ? synthesis.suggestedTypes
        .map((row) => renderTypeChip(row.type, "à envisager"))
        .join("")
    : '<span class="home-type-helper-empty">Aucune suggestion claire.</span>';

  const roleSummaryHtml = synthesis.roleSummary.length
    ? synthesis.roleSummary
        .map(([role, count]) => renderTypeChip(role, count > 1 ? `${count} slots` : "1 slot"))
        .join("")
    : '<span class="home-type-helper-empty">Les rôles se liront ici au fur et à mesure.</span>';

  const internalCoverageHtml = synthesis.internalCoverage.length
    ? synthesis.internalCoverage
        .map((entry) => renderTypeChip(entry.weakTo, `${entry.source} -> ${entry.cover}`))
        .join("")
    : '<span class="home-type-helper-empty">Les relais défensifs apparaîtront ici avec plus de slots remplis.</span>';

  const overviewHtml = `
    <div class="team-builder-overview-groups">
      <div class="team-builder-overview-group is-alert">
        <span class="team-builder-overview-label">Doublons</span>
        <div class="team-builder-synthesis-list">${duplicatesHtml}</div>
      </div>
      <div class="team-builder-overview-group">
        <span class="team-builder-overview-label">Rôles présents</span>
        <div class="team-builder-synthesis-list">${roleSummaryHtml}</div>
      </div>
      <div class="team-builder-overview-group is-suggestion">
        <span class="team-builder-overview-label">Types à envisager</span>
        <div class="team-builder-synthesis-list">${suggestedTypesHtml}</div>
      </div>
    </div>
  `;

  const defensePanelHtml = `
    <div class="team-builder-overview-groups">
      <div class="team-builder-overview-group is-alert">
        <span class="team-builder-overview-label">Faiblesses à surveiller</span>
        <div class="team-builder-synthesis-list">${threatsHtml}</div>
      </div>
      <div class="team-builder-overview-group is-defense">
        <span class="team-builder-overview-label">Couvertures défensives</span>
        <div class="team-builder-synthesis-list">${coverageHtml}</div>
      </div>
      <div class="team-builder-overview-group is-link">
        <span class="team-builder-overview-label">Couvertures internes</span>
        <div class="team-builder-synthesis-list">${internalCoverageHtml}</div>
      </div>
    </div>
  `;

  const offensePanelHtml = `
    <div class="team-builder-overview-groups">
      <div class="team-builder-overview-group is-defense">
        <span class="team-builder-overview-label">Couverture offensive</span>
        <div class="team-builder-synthesis-list">${bestOffenseHtml}</div>
      </div>
      <div class="team-builder-overview-group is-alert">
        <span class="team-builder-overview-label">Angles morts</span>
        <div class="team-builder-synthesis-list">${blindSpotsHtml}</div>
      </div>
      <div class="team-builder-overview-group is-link">
        <span class="team-builder-overview-label">Répartition</span>
        <div class="team-builder-offense-grid">
          <div class="team-builder-offense-stat">
            <span>Physique</span>
            <strong>${synthesis.offenseCounts.physique}</strong>
          </div>
          <div class="team-builder-offense-stat">
            <span>Spécial</span>
            <strong>${synthesis.offenseCounts.speciale}</strong>
          </div>
          <div class="team-builder-offense-stat">
            <span>Support</span>
            <strong>${synthesis.offenseCounts.support}</strong>
          </div>
        </div>
      </div>
    </div>
  `;

  summary.innerHTML = `
    <div class="team-builder-summary-top">
      ${renderChip("Slots", `${synthesis.filledCount}/6`)}
      ${renderChip("Types présents", String(synthesis.distinctTypeCount))}
      ${renderChip("Attaques", `${synthesis.moveCount}/24`)}
      ${renderChip("Types offensifs", String(synthesis.selectedMoveTypeCount))}
      ${renderChip("Immunités", String(immunityTotal))}
      ${renderChip("Pression vitesse", speedPressureLabel)}
    </div>
    <div class="team-builder-synthesis-grid">
      <section class="team-builder-synthesis-card">
        <div class="team-builder-synthesis-head">
          <h5>Vue d’ensemble équipe</h5>
          <p>Lecture rapide de la construction actuelle et des grands repères de team.</p>
        </div>
        ${overviewHtml}
      </section>
      <section class="team-builder-synthesis-card">
        <div class="team-builder-synthesis-head">
          <h5>Couvertures et faiblesses</h5>
          <p>Ce que la team encaisse déjà bien, et les types encore les plus dangereux.</p>
        </div>
        <div class="team-builder-summary-mini-grid">
          <div class="team-builder-summary-mini-stat">
            <span>Faiblesses visibles</span>
            <strong>${synthesis.weaknesses.length}</strong>
          </div>
          <div class="team-builder-summary-mini-stat">
            <span>Résistances / immunités</span>
            <strong>${defensiveCoverageScore}</strong>
          </div>
        </div>
        ${defensePanelHtml}
      </section>
      <section class="team-builder-synthesis-card">
        <div class="team-builder-synthesis-head">
          <h5>Rôles et angles morts</h5>
          <p>Répartition offensive actuelle, menaces bien pressées et points encore faibles.</p>
        </div>
        <div class="team-builder-summary-mini-grid">
          <div class="team-builder-summary-mini-stat">
            <span>Équilibre</span>
            <strong>${escapeHtml(offenseBalanceLabel)}</strong>
          </div>
          <div class="team-builder-summary-mini-stat">
            <span>Pression offensive</span>
            <strong>${synthesis.offensivePressureCount}/6</strong>
          </div>
        </div>
        ${offensePanelHtml}
      </section>
    </div>
  `;
}

function renderTeamBuilderGrid() {
  const grid = document.getElementById("team-builder-grid");
  if (!grid) return;

  grid.innerHTML = "";

  teamBuilderState.forEach((slot, index) => {
    const pokemon = getTeamBuilderPokemon(slot);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "home-builder-slot" + (index === teamBuilderActiveSlot ? " is-active" : "") + (pokemon ? " is-filled" : "");
    card.addEventListener("click", () => {
      teamBuilderActiveSlot = index;
      renderTeamBuilderModule();
    });

    const head = document.createElement("div");
    head.className = "home-builder-slot-head";
    head.innerHTML = `<span>Slot ${index + 1}</span><small>${pokemon ? "Actif" : "Vide"}</small>`;

    const body = document.createElement("div");
    body.className = "home-builder-slot-body";
    if (pokemon) {
      const role = getTeamBuilderSlotRoleData(slot);
      const img = document.createElement("img");
      img.src = getPokemonSprite(pokemon);
      img.alt = pokemon.name;
      img.loading = "lazy";

      const info = document.createElement("div");
      info.className = "home-builder-slot-info";
      info.innerHTML = `
        <strong>${escapeHtml(pokemon.name)}</strong>
        <div class="pokemon-card-types">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
        <div class="team-builder-role-line">
          <span class="team-builder-role-badge">${escapeHtml(role.primary)}</span>
          ${role.chips[0] ? `<span class="team-builder-role-chip">${escapeHtml(role.chips[0])}</span>` : ""}
        </div>
        <small>${slot.moves.filter(Boolean).length} attaque(s)</small>
      `;

      body.appendChild(img);
      body.appendChild(info);
    } else {
      body.innerHTML = '<span class="home-builder-slot-empty">Ajoute un Pokémon</span>';
    }

    card.appendChild(head);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

function buildTeamBuilderOptions() {
  const itemSelect = document.getElementById("team-builder-item");
  const gimmickSelect = document.getElementById("team-builder-gimmick");

  const fillSelect = (select, values, allowEmptyLabel) => {
    if (!select || select.dataset.ready) return;
    select.innerHTML = [
      `<option value="">${escapeHtml(allowEmptyLabel)}</option>`,
      ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
    ].join("");
    select.dataset.ready = "1";
  };

  fillSelect(itemSelect, TEAM_BUILDER_ITEMS.filter((item) => item !== "Aucun"), "Aucun");
  fillSelect(gimmickSelect, TEAM_BUILDER_GIMMICKS.filter((gimmick) => gimmick !== "Aucun"), "Aucun");
}

function setTeamBuilderPokemonSelection(pokemon) {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot || !pokemon) return;
  slot.pokemonId = pokemon.id;
  teamBuilderPokemonSearch = "";
  teamBuilderPokemonPickerOpen = false;
  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function toggleTeamBuilderPokemonPicker() {
  if (teamBuilderPokemonPickerOpen) closeTeamBuilderPokemonPicker();
  else openTeamBuilderPokemonPicker();
}

function selectTeamBuilderPokemonById(pokemonId) {
  const id = Number(pokemonId);
  const pokemon = Number.isInteger(id) ? POKEMON_BY_ID.get(id) : null;
  if (pokemon) setTeamBuilderPokemonSelection(pokemon);
}

function openTeamBuilderPokemonPicker() {
  teamBuilderPokemonPickerOpen = true;
  renderTeamBuilderModule();
  window.requestAnimationFrame(() => {
    document.getElementById("team-builder-pokemon-search")?.focus();
  });
}

function closeTeamBuilderPokemonPicker() {
  if (!teamBuilderPokemonPickerOpen) return;
  teamBuilderPokemonPickerOpen = false;
  renderTeamBuilderModule();
}

function renderTeamBuilderPokemonPicker() {
  const trigger = document.getElementById("team-builder-pokemon-trigger");
  const triggerPreview = document.getElementById("team-builder-pokemon-trigger-preview");
  const triggerText = document.getElementById("team-builder-pokemon-trigger-text");
  const triggerCta = document.getElementById("team-builder-pokemon-trigger-cta");
  const picker = document.getElementById("team-builder-pokemon-picker");
  const search = document.getElementById("team-builder-pokemon-search");
  const clear = document.getElementById("team-builder-pokemon-clear");
  const results = document.getElementById("team-builder-pokemon-results");
  if (!trigger || !triggerPreview || !triggerText || !triggerCta || !picker || !search || !clear || !results) return;

  const slot = teamBuilderState[teamBuilderActiveSlot];
  const pokemon = getTeamBuilderPokemon(slot);
  const query = teamBuilderPokemonSearch.trim().toLowerCase();
  const catalog = getTeamBuilderPokemonCatalog().filter((entry) => {
    if (!query) return true;
    return entry.name.toLowerCase().includes(query) || [entry.type1, entry.type2].some((type) => type && type.toLowerCase().includes(query));
  });

  trigger.setAttribute("aria-expanded", String(teamBuilderPokemonPickerOpen));
  trigger.classList.toggle("is-empty", !pokemon);
  triggerPreview.innerHTML = pokemon
    ? `<img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" />`
    : `<span class="team-builder-pokemon-trigger-placeholder">?</span>`;
  triggerText.textContent = pokemon ? pokemon.name : "Choisir un Pokémon";
  triggerCta.textContent = pokemon ? "Changer" : "Ouvrir";

  picker.classList.toggle("hidden", !teamBuilderPokemonPickerOpen);
  search.value = teamBuilderPokemonSearch;
  clear.textContent = teamBuilderPokemonSearch ? "Effacer" : pokemon ? "Vider" : "Fermer";

  if (!teamBuilderPokemonPickerOpen) {
    results.innerHTML = "";
    return;
  }

  const visible = catalog.slice(0, 60);
  if (!visible.length) {
    results.innerHTML = '<p class="team-builder-pokemon-empty">Aucun Pokémon trouvé.</p>';
    return;
  }

  results.innerHTML = visible.map((entry) => {
    const isSelected = pokemon?.id === entry.id;
    return `
      <button type="button" class="team-builder-pokemon-card${isSelected ? " is-selected" : ""}" data-pokemon-id="${entry.id}" onclick="selectTeamBuilderPokemonById(${entry.id})">
        <img src="${getPokemonSprite(entry)}" alt="${escapeHtml(entry.name)}" loading="lazy" />
        <strong>${escapeHtml(entry.name)}</strong>
        <div class="pokemon-card-types">${typeBadgesHtml(entry.type1, entry.type2)}</div>
      </button>
    `;
  }).join("");
}

function fillTeamBuilderSelect(select, values, emptyLabel) {
  if (!select || select.dataset.ready) return;
  select.innerHTML = [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...values.map((entry) => `<option value="${escapeHtml(entry.value || entry)}">${escapeHtml(entry.label || entry)}</option>`),
  ].join("");
  select.dataset.ready = "1";
}

function getTeamBuilderComputedStatBaseMap(pokeData) {
  return {
    hp: statFromPokemonData(pokeData, "hp"),
    atk: statFromPokemonData(pokeData, "attack"),
    def: statFromPokemonData(pokeData, "defense"),
    spa: statFromPokemonData(pokeData, "special-attack"),
    spd: statFromPokemonData(pokeData, "special-defense"),
    spe: statFromPokemonData(pokeData, "speed"),
  };
}

function computeTeamBuilderFinalStats(pokeData, slot, level = 100) {
  const baseStats = getTeamBuilderComputedStatBaseMap(pokeData);
  const evs = normalizeTeamBuilderSpread(slot?.evs, 0, 0, 252);
  const ivs = normalizeTeamBuilderSpread(slot?.ivs, 31, 0, 31);
  const nature = getTeamBuilderNatureModifiers(slot?.nature || "Hardi");
  const finalStats = {};

  ["hp", "atk", "def", "spa", "spd", "spe"].forEach((key) => {
    const base = Number(baseStats[key]);
    if (!Number.isFinite(base)) {
      finalStats[key] = null;
      return;
    }
    const iv = Number(ivs[key]) || 0;
    const ev = Number(evs[key]) || 0;
    const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
    if (key === "hp") {
      finalStats.hp = core + level + 10;
    } else {
      finalStats[key] = Math.floor((core + 5) * (nature[key] || 1));
    }
  });

  finalStats.total = ["hp", "atk", "def", "spa", "spd", "spe"].reduce((sum, key) => {
    return sum + (Number.isFinite(finalStats[key]) ? finalStats[key] : 0);
  }, 0);
  return finalStats;
}

function renderTeamBuilderComputedStatsContent(content) {
  const root = document.getElementById("team-builder-computed-stats");
  if (!root) return;
  root.innerHTML = content;
}

function renderTeamBuilderComputedStats() {
  const root = document.getElementById("team-builder-computed-stats");
  if (!root) return;

  const slot = teamBuilderState[teamBuilderActiveSlot];
  const pokemon = getTeamBuilderPokemon(slot);
  const header = `
    <div class="team-builder-computed-stats-head">
      <div>
        <h5>Stats finales</h5>
        <p>Calcul simple au niveau 100 selon base stats, nature, EV et IV.</p>
      </div>
      <span class="home-coming-badge">Niv. 100</span>
    </div>
  `;

  if (!pokemon) {
    renderTeamBuilderComputedStatsContent(`${header}<p class="team-builder-computed-stats-empty">Choisis un Pokémon pour voir ses stats finales.</p>`);
    return;
  }

  renderTeamBuilderComputedStatsContent(`${header}<p class="team-builder-computed-stats-empty">Calcul des stats de ${escapeHtml(pokemon.name)}…</p>`);

  const activeSlotIndex = teamBuilderActiveSlot;
  const activePokemonId = pokemon.id;
  fetchTeamBuilderPokemonApiData(pokemon).then((data) => {
    const currentSlot = teamBuilderState[activeSlotIndex];
    const currentPokemon = getTeamBuilderPokemon(currentSlot);
    if (activeSlotIndex !== teamBuilderActiveSlot || !currentPokemon || currentPokemon.id !== activePokemonId) return;

    const finalStats = computeTeamBuilderFinalStats(data, currentSlot, 100);
    const hasStats = ["hp", "atk", "def", "spa", "spd", "spe"].some((key) => Number.isFinite(finalStats[key]));
    if (!hasStats) {
      renderTeamBuilderComputedStatsContent(`${header}<p class="team-builder-computed-stats-empty">Stats indisponibles pour ce Pokémon pour l’instant.</p>`);
      return;
    }

    const statsHtml = [
      { key: "hp", label: "PV", max: 450 },
      { key: "atk", label: "Attaque", max: 450 },
      { key: "def", label: "Défense", max: 450 },
      { key: "spa", label: "Att. Spé.", max: 450 },
      { key: "spd", label: "Déf. Spé.", max: 450 },
      { key: "spe", label: "Vitesse", max: 450 },
    ].map((entry) => {
      const value = Number.isFinite(finalStats[entry.key]) ? finalStats[entry.key] : "—";
      const ratio = Number.isFinite(finalStats[entry.key]) ? Math.max(0, Math.min(1, finalStats[entry.key] / entry.max)) : 0;
      return `
        <div class="team-builder-computed-stat">
          <span>${entry.label}</span>
          <strong>${value}</strong>
          <i><b style="width:${Math.round(ratio * 100)}%"></b></i>
        </div>
      `;
    }).join("");

    renderTeamBuilderComputedStatsContent(`
      ${header}
      <div class="team-builder-computed-stats-grid">${statsHtml}</div>
      <div class="team-builder-computed-stats-total">
        <span>Total estimé</span>
        <strong>${finalStats.total}</strong>
      </div>
    `);
  }).catch(() => {
    const currentSlot = teamBuilderState[activeSlotIndex];
    const currentPokemon = getTeamBuilderPokemon(currentSlot);
    if (activeSlotIndex !== teamBuilderActiveSlot || !currentPokemon || currentPokemon.id !== activePokemonId) return;
    renderTeamBuilderComputedStatsContent(`${header}<p class="team-builder-computed-stats-empty">Impossible de récupérer les stats pour ce Pokémon.</p>`);
  });
}

function renderTeamBuilderStrategicFields() {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot) return;

  const currentRenderVersion = ++teamBuilderStrategicRenderVersion;
  const pokemon = getTeamBuilderPokemon(slot);

  const natureSelect = document.getElementById("team-builder-nature");
  const talentSelect = document.getElementById("team-builder-talent");
  const evPresetSelect = document.getElementById("team-builder-ev-preset");
  const ivPresetSelect = document.getElementById("team-builder-iv-preset");
  const evCustom = document.getElementById("team-builder-ev-custom");
  const ivCustom = document.getElementById("team-builder-iv-custom");
  const evInputs = {
    hp: document.getElementById("team-builder-ev-hp"),
    atk: document.getElementById("team-builder-ev-atk"),
    def: document.getElementById("team-builder-ev-def"),
    spa: document.getElementById("team-builder-ev-spa"),
    spd: document.getElementById("team-builder-ev-spd"),
    spe: document.getElementById("team-builder-ev-spe"),
  };
  const ivInputs = {
    hp: document.getElementById("team-builder-iv-hp"),
    atk: document.getElementById("team-builder-iv-atk"),
    def: document.getElementById("team-builder-iv-def"),
    spa: document.getElementById("team-builder-iv-spa"),
    spd: document.getElementById("team-builder-iv-spd"),
    spe: document.getElementById("team-builder-iv-spe"),
  };

  fillTeamBuilderSelect(natureSelect, TEAM_BUILDER_NATURES, "Nature");
  fillTeamBuilderSelect(evPresetSelect, TEAM_BUILDER_EV_PRESETS, "Preset EV");
  fillTeamBuilderSelect(ivPresetSelect, TEAM_BUILDER_IV_PRESETS, "Preset IV");

  if (natureSelect) natureSelect.value = slot.nature || "Hardi";
  if (evPresetSelect) evPresetSelect.value = slot.evPreset || "offensive-physique";
  if (ivPresetSelect) ivPresetSelect.value = slot.ivPreset || "all31";

  const isEvCustom = slot.evPreset === "custom";
  const isIvCustom = slot.ivPreset === "custom";
  evCustom?.classList.toggle("hidden", !isEvCustom);
  ivCustom?.classList.toggle("hidden", !isIvCustom);

  if (isEvCustom) {
    Object.entries(evInputs).forEach(([key, input]) => {
      if (input) input.value = Number(slot.evs?.[key]) || 0;
    });
  }

  if (isIvCustom) {
    Object.entries(ivInputs).forEach(([key, input]) => {
      if (input) input.value = Number(slot.ivs?.[key]) || 0;
    });
  }

  if (!talentSelect) return;
  talentSelect.innerHTML = '<option value="">Chargement des talents…</option>';
  talentSelect.disabled = true;

  const finalizeTalentOptions = (options) => {
    if (currentRenderVersion !== teamBuilderStrategicRenderVersion) return;
    const validValues = new Set(options.map((option) => option.value));
    const currentValue = validValues.has(slot.talent) ? slot.talent : (options[0]?.value || "");
    if (slot.talent !== currentValue) {
      slot.talent = currentValue;
      saveTeamBuilderState();
    }

    talentSelect.disabled = false;
    talentSelect.innerHTML = [
      '<option value="">Talent principal</option>',
      ...options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`),
    ].join("");
    talentSelect.value = currentValue;
  };

  if (!pokemon) {
    finalizeTalentOptions([{ value: "", label: "Talent principal" }]);
    return;
  }

  const cacheKey = getTeamBuilderPokemonTalentCacheKey(pokemon);
  if (teamBuilderTalentOptionsCache.has(cacheKey)) {
    finalizeTalentOptions(teamBuilderTalentOptionsCache.get(cacheKey));
    return;
  }

  fetchTeamBuilderPokemonApiData(pokemon).then(async (data) => {
    if (currentRenderVersion !== teamBuilderStrategicRenderVersion) return;
    const options = await getTeamBuilderTalentOptions(data);
    teamBuilderTalentOptionsCache.set(cacheKey, options);
    finalizeTalentOptions(options);
  });
}

function updateTeamBuilderField(field, value, moveIndex = null) {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot) return;

  if (field === "pokemon") {
    const pokemon = findPokemonGlobalByName(String(value || "").trim());
    slot.pokemonId = pokemon ? pokemon.id : null;
  } else if (field === "item") {
    slot.item = value || "Aucun";
  } else if (field === "gimmick") {
    slot.gimmick = value || "Aucun";
  } else if (field === "move" && Number.isInteger(moveIndex)) {
    const movePool = getTeamBuilderMovePool(slot);
    const allowed = new Set(movePool.map((move) => move.name));
    const nextValue = typeof value === "string" ? value : "";
    slot.moves[moveIndex] = !nextValue || allowed.has(nextValue) ? nextValue : "";
  }

  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function updateTeamBuilderStrategicField(field, value) {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot) return;

  if (field === "nature") {
    slot.nature = TEAM_BUILDER_NATURES.some((nature) => nature.value === value) ? value : "Hardi";
  } else if (field === "talent") {
    slot.talent = String(value || "");
  } else if (field === "ev-preset") {
    applyTeamBuilderSpreadPreset(slot, String(value || "offensive-physique"), "ev");
  } else if (field === "iv-preset") {
    applyTeamBuilderSpreadPreset(slot, String(value || "all31"), "iv");
  } else if (field === "ev-custom" || field === "iv-custom") {
    const isEv = field === "ev-custom";
    const min = isEv ? 0 : 0;
    const max = isEv ? 252 : 31;
    const next = {
      hp: Number(document.getElementById(isEv ? "team-builder-ev-hp" : "team-builder-iv-hp")?.value) || 0,
      atk: Number(document.getElementById(isEv ? "team-builder-ev-atk" : "team-builder-iv-atk")?.value) || 0,
      def: Number(document.getElementById(isEv ? "team-builder-ev-def" : "team-builder-iv-def")?.value) || 0,
      spa: Number(document.getElementById(isEv ? "team-builder-ev-spa" : "team-builder-iv-spa")?.value) || 0,
      spd: Number(document.getElementById(isEv ? "team-builder-ev-spd" : "team-builder-iv-spd")?.value) || 0,
      spe: Number(document.getElementById(isEv ? "team-builder-ev-spe" : "team-builder-iv-spe")?.value) || 0,
    };
    const normalized = normalizeTeamBuilderSpread(next, isEv ? 0 : 31, min, max);
    if (isEv) {
      slot.evPreset = "custom";
      slot.evs = normalized;
    } else {
      slot.ivPreset = "custom";
      slot.ivs = normalized;
    }
  }

  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function clearTeamBuilderSlot() {
  teamBuilderState[teamBuilderActiveSlot] = createTeamBuilderEmptySlot();
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function renderTeamBuilderEditor() {
  const slot = teamBuilderState[teamBuilderActiveSlot];
  if (!slot) return;

  const title = document.getElementById("team-builder-editor-title");
  const sub = document.getElementById("team-builder-editor-sub");
  const identity = document.getElementById("team-builder-editor-identity");
  const itemSelect = document.getElementById("team-builder-item");
  const gimmickSelect = document.getElementById("team-builder-gimmick");
  const moveSelects = [
    document.getElementById("team-builder-move-1"),
    document.getElementById("team-builder-move-2"),
    document.getElementById("team-builder-move-3"),
    document.getElementById("team-builder-move-4"),
  ];

  const pokemon = getTeamBuilderPokemon(slot);
  if (title) title.textContent = `Slot ${teamBuilderActiveSlot + 1}`;
  if (sub) sub.textContent = pokemon ? `${pokemon.name} · Clique un autre slot pour l’éditer.` : "Choisis un Pokémon, un objet et une mécanique de slot.";
  if (identity) {
    identity.innerHTML = pokemon ? `
      <div class="team-builder-editor-identity-card">
        <div class="team-builder-editor-identity-visual">
          <img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" />
        </div>
        <div class="team-builder-editor-identity-copy">
          <div class="team-builder-editor-identity-top">
            <span class="team-builder-editor-slot-badge">Slot ${teamBuilderActiveSlot + 1}</span>
            <span class="team-builder-editor-status-badge">Actif</span>
          </div>
          <strong>${escapeHtml(pokemon.name)}</strong>
          <div class="pokemon-card-types">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
        </div>
      </div>
    ` : `
      <div class="team-builder-editor-identity-card is-empty">
        <div class="team-builder-editor-identity-copy">
          <div class="team-builder-editor-identity-top">
            <span class="team-builder-editor-slot-badge">Slot ${teamBuilderActiveSlot + 1}</span>
            <span class="team-builder-editor-status-badge">Vide</span>
          </div>
          <strong>Choisis un Pokémon</strong>
          <p>Le slot actif apparaîtra ici avec ses types.</p>
        </div>
      </div>
    `;
  }
  renderTeamBuilderPokemonPicker();
  renderTeamBuilderStrategicFields();
  renderTeamBuilderComputedStats();
  if (itemSelect) itemSelect.value = slot.item || "";
  if (gimmickSelect) gimmickSelect.value = slot.gimmick || "";
  moveSelects.forEach((select, index) => {
    if (!select) return;
    const field = document.getElementById(`team-builder-move-field-${index + 1}`);
    const state = document.getElementById(`team-builder-move-state-${index + 1}`);
    const clearBtn = field?.querySelector(".team-builder-move-clear");
    const currentMove = slot.moves[index] || "";
    field?.classList.toggle("is-filled", Boolean(currentMove));
    field?.classList.toggle("is-empty", !currentMove);
    clearBtn?.classList.toggle("hidden", !currentMove);
    if (state) state.textContent = currentMove ? `Choisie : ${currentMove}` : "Slot vide";
    select.innerHTML = [
      pokemon ? '<option value="">Chargement des attaques…</option>' : '<option value="">Aucune attaque</option>',
    ].join("");
    select.value = currentMove;
    select.disabled = !pokemon;
  });

  if (!pokemon) return;

  const renderVersion = teamBuilderStrategicRenderVersion;
  getTeamBuilderMovePoolForPokemon(pokemon).then((movePool) => {
    const currentPokemon = getTeamBuilderPokemon(teamBuilderState[teamBuilderActiveSlot]);
    if (renderVersion !== teamBuilderStrategicRenderVersion || !currentPokemon || currentPokemon.id !== pokemon.id) return;
    if (sanitizeTeamBuilderSlotMoves(slot, movePool)) saveTeamBuilderState();
    moveSelects.forEach((select, index) => {
      if (!select) return;
      const field = document.getElementById(`team-builder-move-field-${index + 1}`);
      const state = document.getElementById(`team-builder-move-state-${index + 1}`);
      const clearBtn = field?.querySelector(".team-builder-move-clear");
      const currentMove = slot.moves[index] || "";
      select.disabled = false;
      select.innerHTML = [
        '<option value="">Aucune attaque</option>',
        ...movePool.map((move) => `<option value="${escapeHtml(move.name)}">${escapeHtml(move.name)}${move.types.length ? ` (${escapeHtml(move.types.join(" / "))})` : ""}</option>`),
      ].join("");
      select.value = currentMove;
      field?.classList.toggle("is-filled", Boolean(currentMove));
      field?.classList.toggle("is-empty", !currentMove);
      clearBtn?.classList.toggle("hidden", !currentMove);
      if (state) state.textContent = currentMove ? `Choisie : ${currentMove}` : "Slot vide";
    });
    renderTeamBuilderSummary();
  });
}

function renderTeamBuilderModule() {
  if (!teamBuilderState) loadTeamBuilderState();
  renderTeamBuilderSummary();
  renderTeamBuilderGrid();
  renderTeamBuilderEditor();
  renderTeamBuilderExport();
}

function initTeamBuilderModule() {
  loadTeamBuilderState();
  buildTeamBuilderOptions();
  const moveSelects = [
    document.getElementById("team-builder-move-1"),
    document.getElementById("team-builder-move-2"),
    document.getElementById("team-builder-move-3"),
    document.getElementById("team-builder-move-4"),
  ];

  const root = document.getElementById("screen-team-builder");
  if (root && !root.dataset.delegated) {
    root.dataset.delegated = "1";
    root.addEventListener("click", (event) => {
      const target = event.target;
      const clear = target.closest("#team-builder-pokemon-clear");
      if (clear) {
        event.preventDefault();
        event.stopPropagation();
        const search = document.getElementById("team-builder-pokemon-search");
        if (teamBuilderPokemonPickerOpen && teamBuilderPokemonSearch) {
          teamBuilderPokemonSearch = "";
          renderTeamBuilderPokemonPicker();
          window.requestAnimationFrame(() => search?.focus());
        } else if (teamBuilderPokemonPickerOpen && getTeamBuilderPokemon(teamBuilderState[teamBuilderActiveSlot])) {
          clearTeamBuilderSlot();
        } else {
          closeTeamBuilderPokemonPicker();
        }
        return;
      }

      const card = target.closest("[data-pokemon-id]");
      if (card && root.contains(card)) {
        event.stopPropagation();
        const pokemonId = Number(card.getAttribute("data-pokemon-id"));
        const pokemon = Number.isInteger(pokemonId) ? POKEMON_BY_ID.get(pokemonId) : null;
        if (pokemon) setTeamBuilderPokemonSelection(pokemon);
      }
    });

    root.addEventListener("input", (event) => {
      const target = event.target;
      if (target?.id === "team-builder-pokemon-search") {
        teamBuilderPokemonSearch = target.value;
        renderTeamBuilderPokemonPicker();
      }
      if (target?.matches?.("#team-builder-ev-hp, #team-builder-ev-atk, #team-builder-ev-def, #team-builder-ev-spa, #team-builder-ev-spd, #team-builder-ev-spe")) {
        updateTeamBuilderStrategicField("ev-custom");
      }
      if (target?.matches?.("#team-builder-iv-hp, #team-builder-iv-atk, #team-builder-iv-def, #team-builder-iv-spa, #team-builder-iv-spd, #team-builder-iv-spe")) {
        updateTeamBuilderStrategicField("iv-custom");
      }
    });

    root.addEventListener("change", (event) => {
      const target = event.target;
      if (!target?.id) return;
      if (target.id === "team-builder-item") updateTeamBuilderField("item", target.value);
      else if (target.id === "team-builder-gimmick") updateTeamBuilderField("gimmick", target.value);
      else if (target.id === "team-builder-nature") updateTeamBuilderStrategicField("nature", target.value);
      else if (target.id === "team-builder-talent") updateTeamBuilderStrategicField("talent", target.value);
      else if (target.id === "team-builder-ev-preset") updateTeamBuilderStrategicField("ev-preset", target.value);
      else if (target.id === "team-builder-iv-preset") updateTeamBuilderStrategicField("iv-preset", target.value);
      else {
        const moveIndex = ["team-builder-move-1", "team-builder-move-2", "team-builder-move-3", "team-builder-move-4"].indexOf(target.id);
        if (moveIndex >= 0) updateTeamBuilderField("move", target.value, moveIndex);
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (!teamBuilderPokemonPickerOpen) return;
    const target = event.target;
    const pickerEl = document.getElementById("team-builder-pokemon-picker");
    const triggerEl = document.getElementById("team-builder-pokemon-trigger");
    if (pickerEl?.contains(target) || triggerEl?.contains(target)) return;
    closeTeamBuilderPokemonPicker();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTeamBuilderPokemonPicker();
  });

  renderTeamBuilderModule();
}

function openTeamBuilderScreen() {
  goToConfig();
  document.getElementById("screen-config").classList.add("hidden");
  document.querySelector(".search-bar")?.classList.add("hidden");
  showScreen("screen-team-builder");
  setGlobalNavActive("champions");
  renderTeamBuilderModule();
  window.requestAnimationFrame(() => {
    document.getElementById("screen-team-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function resetTeamBuilder() {
  teamBuilderState = createTeamBuilderState();
  teamBuilderActiveSlot = 0;
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  saveTeamBuilderState();
  renderTeamBuilderModule();
}

function getTeamBuilderExportStatLabel(key) {
  const labels = {
    hp: "HP",
    atk: "Atk",
    def: "Def",
    spa: "SpA",
    spd: "SpD",
    spe: "Spe",
  };
  return labels[key] || key;
}

function formatTeamBuilderExportSpread(spread, options = {}) {
  const defaultValue = Number(options.defaultValue);
  const showZeros = Boolean(options.showZeros);
  const parts = ["hp", "atk", "def", "spa", "spd", "spe"]
    .map((key) => {
      const value = Number(spread?.[key]);
      if (!Number.isFinite(value)) return null;
      if (!showZeros && value === 0) return null;
      if (Number.isFinite(defaultValue) && value === defaultValue) return null;
      return `${value} ${getTeamBuilderExportStatLabel(key)}`;
    })
    .filter(Boolean);
  return parts.join(" / ");
}

function buildTeamBuilderSlotExport(slot) {
  const pokemon = getTeamBuilderPokemon(slot);
  if (!pokemon) return "";

  const lines = [];
  lines.push(`${pokemon.name}${slot.item ? ` @ ${slot.item}` : ""}`);
  if (slot.talent) lines.push(`Talent: ${slot.talent}`);
  if (slot.gimmick) lines.push(`Gimmick: ${slot.gimmick}`);
  if (slot.nature) lines.push(`${slot.nature} Nature`);

  const evLine = formatTeamBuilderExportSpread(slot.evs, { defaultValue: 0 });
  if (evLine) lines.push(`EVs: ${evLine}`);

  const ivLine = formatTeamBuilderExportSpread(slot.ivs, { defaultValue: 31 });
  if (ivLine) lines.push(`IVs: ${ivLine}`);

  slot.moves
    .filter(Boolean)
    .forEach((move) => lines.push(`- ${move}`));

  return lines.join("\n");
}

function buildTeamBuilderExportText() {
  const filled = teamBuilderState
    .map((slot) => buildTeamBuilderSlotExport(slot))
    .filter(Boolean);

  return filled.length
    ? filled.join("\n\n")
    : "Aucun Pokémon ajouté pour l’instant.";
}

function renderTeamBuilderExport() {
  const output = document.getElementById("team-builder-export-output");
  const meta = document.getElementById("team-builder-export-meta");
  if (!output || !meta) return;

  const filledCount = teamBuilderState.filter((slot) => getTeamBuilderPokemon(slot)).length;
  output.value = buildTeamBuilderExportText();
  meta.textContent = `${filledCount} Pokémon`;
}

function copyTeamBuilderExport() {
  const text = buildTeamBuilderExportText();
  const msg = document.getElementById("team-builder-export-msg");
  navigator.clipboard.writeText(text).then(() => {
    if (!msg) return;
    msg.textContent = "Export copié.";
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2200);
  }).catch(() => {
    if (!msg) return;
    msg.textContent = "Copie impossible.";
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2200);
  });
}

function getTeamBuilderNatureValueFromImport(raw) {
  const target = norm(String(raw || "").replace(/\s+nature$/i, "").trim());
  if (!target) return "Hardi";
  const match = TEAM_BUILDER_NATURES.find((entry) => norm(entry.value) === target || norm(entry.label) === target);
  return match?.value || "Hardi";
}

function getTeamBuilderPresetValueFromSpread(presets, spread) {
  const keys = ["hp", "atk", "def", "spa", "spd", "spe"];
  const match = presets.find((preset) => preset.spread && keys.every((key) => Number(preset.spread[key] || 0) === Number(spread?.[key] || 0)));
  return match?.value || "custom";
}

function parseTeamBuilderSpreadLine(line, fallbackDefault = 0) {
  const spread = { hp: fallbackDefault, atk: fallbackDefault, def: fallbackDefault, spa: fallbackDefault, spd: fallbackDefault, spe: fallbackDefault };
  const map = {
    hp: "hp",
    atk: "atk",
    def: "def",
    spa: "spa",
    spd: "spd",
    spe: "spe",
  };
  const matches = String(line || "").match(/(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)/gi) || [];
  matches.forEach((chunk) => {
    const parts = chunk.match(/(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)/i);
    if (!parts) return;
    const value = Number(parts[1]);
    const key = map[String(parts[2]).toLowerCase()];
    if (!key || !Number.isFinite(value)) return;
    spread[key] = value;
  });
  return spread;
}

function parseTeamBuilderImportBlock(block) {
  const lines = String(block || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const head = lines[0];
  const [pokemonRaw, itemRaw] = head.split("@").map((part) => String(part || "").trim());
  const pokemonName = pokemonRaw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const pokemon = findPokemonGlobalByName(pokemonName);
  if (!pokemon) return null;

  const slot = createTeamBuilderEmptySlot();
  slot.pokemonId = pokemon.id;
  slot.item = TEAM_BUILDER_ITEMS.includes(itemRaw) ? itemRaw : "";

  lines.slice(1).forEach((line) => {
    if (/^talent\s*:/i.test(line)) {
      slot.talent = line.split(":").slice(1).join(":").trim();
      return;
    }
    if (/^gimmick\s*:/i.test(line)) {
      const gimmick = line.split(":").slice(1).join(":").trim();
      slot.gimmick = TEAM_BUILDER_GIMMICKS.includes(gimmick) ? gimmick : "";
      return;
    }
    if (/nature$/i.test(line)) {
      slot.nature = getTeamBuilderNatureValueFromImport(line);
      return;
    }
    if (/^evs\s*:/i.test(line)) {
      const spread = parseTeamBuilderSpreadLine(line, 0);
      slot.evs = normalizeTeamBuilderSpread(spread, 0, 0, 252);
      slot.evPreset = getTeamBuilderPresetValueFromSpread(TEAM_BUILDER_EV_PRESETS, slot.evs);
      return;
    }
    if (/^ivs\s*:/i.test(line)) {
      const spread = parseTeamBuilderSpreadLine(line, 31);
      slot.ivs = normalizeTeamBuilderSpread(spread, 31, 0, 31);
      slot.ivPreset = getTeamBuilderPresetValueFromSpread(TEAM_BUILDER_IV_PRESETS, slot.ivs);
      return;
    }
    if (/^-/.test(line)) {
      const moveName = line.replace(/^-+\s*/, "").trim();
      const nextIndex = slot.moves.findIndex((move) => !move);
      if (nextIndex >= 0) slot.moves[nextIndex] = moveName;
    }
  });

  return slot;
}

function importTeamBuilderText() {
  const input = document.getElementById("team-builder-import-input");
  const msg = document.getElementById("team-builder-import-msg");
  if (!input || !msg) return;

  const blocks = String(input.value || "")
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const slots = blocks
    .map((block) => parseTeamBuilderImportBlock(block))
    .filter(Boolean)
    .slice(0, 6);

  if (!slots.length) {
    msg.textContent = "Import impossible.";
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2200);
    return;
  }

  teamBuilderState = normalizeTeamBuilderState(slots);
  teamBuilderActiveSlot = 0;
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  saveTeamBuilderState();
  renderTeamBuilderModule();

  msg.textContent = `${slots.length} slot${slots.length > 1 ? "s" : ""} importé${slots.length > 1 ? "s" : ""}.`;
  msg.classList.remove("hidden");
  setTimeout(() => msg.classList.add("hidden"), 2200);
}

function getTeamLibraryTemplateById(id) {
  return TEAM_LIBRARY_TEMPLATES.find((template) => template.id === id) || null;
}

function getTeamLibraryStyleLabel(style) {
  return TEAM_LIBRARY_STYLE_LABELS[style] || style || "Balanced";
}

function renderTeamLibraryPokemonCard(pokemonId) {
  const pokemon = POKEMON_BY_ID.get(Number(pokemonId));
  if (!pokemon) {
    return `
      <div class="team-template-pokemon is-empty">
        <span class="team-template-pokemon-sprite">?</span>
        <strong>Pokémon</strong>
        <small>Indisponible</small>
      </div>
    `;
  }

  return `
    <div class="team-template-pokemon">
      <img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" />
      <strong>${escapeHtml(pokemon.name)}</strong>
      <div class="pokemon-card-types">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
    </div>
  `;
}

function applyTeamTemplateToBuilder(template) {
  if (!template) return;
  const slots = Array.isArray(template.slots) ? template.slots.map((slot) => ({
    pokemonId: Number.isInteger(slot?.pokemonId) ? slot.pokemonId : null,
    item: typeof slot?.item === "string" ? slot.item : "",
    gimmick: typeof slot?.gimmick === "string" ? slot.gimmick : "",
    moves: Array.isArray(slot?.moves)
      ? slot.moves.slice(0, 4).map((move) => (typeof move === "string" ? move.trim() : ""))
      : ["", "", "", ""],
    nature: TEAM_BUILDER_NATURES.some((nature) => nature.value === slot?.nature) ? slot.nature : "Hardi",
    talent: typeof slot?.talent === "string" ? slot.talent : "",
    evPreset: TEAM_BUILDER_EV_PRESETS.some((preset) => preset.value === slot?.evPreset) ? slot.evPreset : "offensive-physique",
    evs: slot?.evs ? normalizeTeamBuilderSpread(slot.evs, 0, 0, 252) : createTeamBuilderEmptySlot().evs,
    ivPreset: TEAM_BUILDER_IV_PRESETS.some((preset) => preset.value === slot?.ivPreset) ? slot.ivPreset : "all31",
    ivs: slot?.ivs ? normalizeTeamBuilderSpread(slot.ivs, 31, 0, 31) : createTeamBuilderEmptySlot().ivs,
  })) : [];

  teamBuilderState = normalizeTeamBuilderState(slots);
  teamBuilderActiveSlot = 0;
  teamBuilderPokemonPickerOpen = false;
  teamBuilderPokemonSearch = "";
  saveTeamBuilderState();
}

function openTeamTemplateInBuilder(templateId) {
  const template = getTeamLibraryTemplateById(templateId);
  if (!template) return;
  applyTeamTemplateToBuilder(template);
  openTeamBuilderScreen();
}

function resetTeamLibraryFilters() {
  teamLibraryFilters = {
    generation: "all",
    format: "all",
    style: "all",
  };
  renderTeamsScreen();
}

function fillTeamLibrarySelect(select, values) {
  if (!select || select.dataset.ready) return;
  select.innerHTML = values.map((entry) => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`).join("");
  select.dataset.ready = "1";
}

function renderTeamsScreen() {
  const generationSelect = document.getElementById("teams-filter-generation");
  const formatSelect = document.getElementById("teams-filter-format");
  const styleSelect = document.getElementById("teams-filter-style");
  const grid = document.getElementById("teams-grid");
  if (!generationSelect || !formatSelect || !styleSelect || !grid) return;

  fillTeamLibrarySelect(generationSelect, TEAM_LIBRARY_GENERATION_OPTIONS);
  fillTeamLibrarySelect(formatSelect, TEAM_LIBRARY_FORMAT_OPTIONS);
  fillTeamLibrarySelect(styleSelect, TEAM_LIBRARY_STYLE_OPTIONS);

  generationSelect.value = teamLibraryFilters.generation;
  formatSelect.value = teamLibraryFilters.format;
  styleSelect.value = teamLibraryFilters.style;

  const templates = TEAM_LIBRARY_TEMPLATES.filter((template) => {
    const generationMatch = teamLibraryFilters.generation === "all" || template.generation === teamLibraryFilters.generation;
    const formatMatch = teamLibraryFilters.format === "all" || template.format === teamLibraryFilters.format;
    const styleMatch = teamLibraryFilters.style === "all" || template.style === teamLibraryFilters.style;
    return generationMatch && formatMatch && styleMatch;
  });

  if (!templates.length) {
    grid.innerHTML = '<p class="teams-empty">Aucun template ne correspond à ces filtres.</p>';
    return;
  }

  grid.innerHTML = templates.map((template) => {
    const roster = (template.slots || []).slice(0, 6).map((slot) => renderTeamLibraryPokemonCard(slot.pokemonId)).join("");
    const tags = [
      `Gen ${template.generation}`,
      template.format,
      getTeamLibraryStyleLabel(template.style),
      ...(Array.isArray(template.tags) ? template.tags.slice(0, 2) : []),
    ].filter(Boolean);

    return `
      <article class="team-template-card">
        <div class="team-template-head">
          <div>
            <h3>${escapeHtml(template.name)}</h3>
            <p>${escapeHtml(template.summary)}</p>
          </div>
          <span class="team-template-count">6 Pokémon</span>
        </div>
        <div class="team-template-tags">
          ${tags.map((tag) => `<span class="team-template-tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="team-template-squad" aria-label="Équipe exemple">
          ${roster}
        </div>
        <div class="team-template-actions">
          <button class="btn-blue" type="button" onclick="openTeamTemplateInBuilder('${escapeHtml(template.id)}')">Utiliser comme base</button>
          <span>Ouvre le builder avec cette base déjà posée.</span>
        </div>
      </article>
    `;
  }).join("");
}

function openTeamsScreen() {
  closeOverlayModal();
  goToConfig();
  document.getElementById("screen-config").classList.add("hidden");
  document.querySelector(".search-bar")?.classList.add("hidden");
  showScreen("screen-teams");
  setGlobalNavActive("champions");
  renderTeamsScreen();
  window.requestAnimationFrame(() => {
    document.getElementById("screen-teams")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function initTeamsModule() {
  const generationSelect = document.getElementById("teams-filter-generation");
  const formatSelect = document.getElementById("teams-filter-format");
  const styleSelect = document.getElementById("teams-filter-style");
  if (!generationSelect || !formatSelect || !styleSelect) return;

  generationSelect.addEventListener("change", (event) => {
    teamLibraryFilters.generation = event.target.value || "all";
    renderTeamsScreen();
  });
  formatSelect.addEventListener("change", (event) => {
    teamLibraryFilters.format = event.target.value || "all";
    renderTeamsScreen();
  });
  styleSelect.addEventListener("change", (event) => {
    teamLibraryFilters.style = event.target.value || "all";
    renderTeamsScreen();
  });

  renderTeamsScreen();
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

let pokedexBuilderFeedbackTimer = null;
let teamBuilderBridgeFeedbackTimer = null;
let teamBuilderBridgeHighlightTimer = null;

function showPokedexBuilderFeedback(message, tone = "info") {
  const feedback = document.getElementById("pokedex-detail-builder-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = `pokedex-detail-builder-feedback is-visible is-${tone}`;
  window.clearTimeout(pokedexBuilderFeedbackTimer);
  pokedexBuilderFeedbackTimer = window.setTimeout(() => {
    feedback.className = "pokedex-detail-builder-feedback";
    feedback.textContent = "";
  }, 2200);
}

function showTeamBuilderBridgeFeedback(message, tone = "success") {
  const screen = document.getElementById("screen-team-builder");
  if (!screen) return;
  let feedback = screen.querySelector(".team-builder-bridge-feedback");
  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "team-builder-bridge-feedback";
    feedback.setAttribute("aria-live", "polite");
    screen.appendChild(feedback);
  }
  feedback.textContent = message;
  feedback.className = `team-builder-bridge-feedback is-visible is-${tone}`;
  window.clearTimeout(teamBuilderBridgeFeedbackTimer);
  teamBuilderBridgeFeedbackTimer = window.setTimeout(() => {
    feedback.className = "team-builder-bridge-feedback";
    feedback.textContent = "";
  }, 2200);
}

function focusTeamBuilderActiveSlotVisual() {
  window.requestAnimationFrame(() => {
    const activeSlot = document.querySelector("#team-builder-grid .home-builder-slot.is-active");
    if (!activeSlot) return;
    activeSlot.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    activeSlot.classList.add("is-bridge-highlight");
    window.clearTimeout(teamBuilderBridgeHighlightTimer);
    teamBuilderBridgeHighlightTimer = window.setTimeout(() => {
      activeSlot.classList.remove("is-bridge-highlight");
    }, 1600);
  });
}

function addSelectedPokedexPokemonToBuilder() {
  const pokemon = POKEMON_BY_ID.get(Number(pokedexSelectedId));
  if (!pokemon) return;
  const emptySlotIndex = teamBuilderState.findIndex((slot) => !Number.isInteger(Number(slot?.pokemonId)));
  if (emptySlotIndex === -1) {
    showPokedexBuilderFeedback("Équipe complète", "full");
    return;
  }
  teamBuilderActiveSlot = emptySlotIndex;
  const nextSlot = createTeamBuilderEmptySlot();
  nextSlot.pokemonId = pokemon.id;
  teamBuilderState[emptySlotIndex] = nextSlot;
  saveTeamBuilderState();
  openTeamBuilderScreen();
  focusTeamBuilderActiveSlotVisual();
  showTeamBuilderBridgeFeedback(`${pokemon.name} ajouté à l'équipe`, "success");
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
  const type2 = document.getElementById("pokedex-type2-filter");
  const sort = document.getElementById("pokedex-sort-filter");
  const shinyToggle = document.getElementById("pokedex-shiny-toggle");
  if (!search || !gen || !type || !type2 || !sort) return;

  gen.innerHTML = '<option value="all">Toutes les générations</option>';
  for (const [num, data] of Object.entries(GENERATIONS)) {
    const opt = document.createElement("option");
    opt.value = String(num);
    opt.textContent = `Gen ${num} - ${data.label}`;
    gen.appendChild(opt);
  }

  type.innerHTML = '<option value="all">Tous les types</option>';
  type2.innerHTML = '<option value="all">Tous les types</option>';
  for (const t of getPokedexTypes()) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    type.appendChild(opt);
    type2.appendChild(opt.cloneNode(true));
  }

  sort.innerHTML = `
    <option value="dex">N° Pokédex</option>
    <option value="name-asc">Nom A → Z</option>
    <option value="name-desc">Nom Z → A</option>
  `;
  sort.value = pokedexSortFilter;

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

  type2.addEventListener("change", () => {
    pokedexType2Filter = type2.value;
    renderPokedexGrid();
  });

  sort.addEventListener("change", () => {
    pokedexSortFilter = sort.value;
    renderPokedexGrid();
  });

  shinyToggle?.addEventListener("click", togglePokedexGridShiny);

  updatePokedexShinyButton();

  if (!document.body.dataset.pokedexKeysBound) {
    document.body.dataset.pokedexKeysBound = "1";
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const pokedexScreen = document.getElementById("screen-pokedex");
      if (!pokedexScreen || pokedexScreen.classList.contains("hidden")) return;
      if (!pokedexSelectedId) return;
      const target = event.target;
      if (target?.isContentEditable) return;
      const tagName = String(target?.tagName || "").toLowerCase();
      if (["input", "textarea", "select"].includes(tagName)) return;
      event.preventDefault();
      navigatePokedexDetail(event.key === "ArrowLeft" ? "prev" : "next");
    });
  }
}

function openPokedexMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  stopEmulatorSession();
  document.getElementById("screen-pokedex").classList.remove("hidden");
  setGlobalNavActive("pokedex");
  setQuizModeLayout(false);
  stopCrySound();
  closeRankingPicker();

  const search = document.getElementById("pokedex-search");
  const gen = document.getElementById("pokedex-gen-filter");
  const type = document.getElementById("pokedex-type-filter");
  const type2 = document.getElementById("pokedex-type2-filter");
  const sort = document.getElementById("pokedex-sort-filter");
  if (search) search.value = pokedexSearch;
  if (gen) gen.value = pokedexGenFilter;
  if (type) type.value = pokedexTypeFilter;
  if (type2) type2.value = pokedexType2Filter;
  if (sort) sort.value = pokedexSortFilter;
  updatePokedexShinyButton();

  renderPokedexGrid();
}

function getFilteredPokedexList() {
  const q = norm(pokedexSearch || "");
  const type1Filter = pokedexTypeFilter || "all";
  const type2Filter = pokedexType2Filter || "all";

  return POKEMON_LIST
    .filter((p) => {
      if (pokedexGenFilter !== "all" && String(p.gen) !== pokedexGenFilter) return false;
      if (type1Filter === "all" && type2Filter === "all") {
        // keep current behavior
      } else if (type1Filter !== "all" && type2Filter !== "all" && type1Filter !== type2Filter) {
        const pokemonTypes = [p.type1, p.type2].filter(Boolean).sort();
        const expectedTypes = [type1Filter, type2Filter].sort();
        if (pokemonTypes.length !== 2 || pokemonTypes[0] !== expectedTypes[0] || pokemonTypes[1] !== expectedTypes[1]) return false;
      } else {
        const singleType = type1Filter !== "all" ? type1Filter : type2Filter;
        if (singleType !== "all" && p.type1 !== singleType && p.type2 !== singleType) return false;
      }
      if (q && !norm(p.name).includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      if (pokedexSortFilter === "name-asc") {
        return a.name.localeCompare(b.name, "fr") || getPokemonSpriteId(a) - getPokemonSpriteId(b);
      }
      if (pokedexSortFilter === "name-desc") {
        return b.name.localeCompare(a.name, "fr") || getPokemonSpriteId(a) - getPokemonSpriteId(b);
      }
      return getPokemonSpriteId(a) - getPokemonSpriteId(b) || a.name.localeCompare(b.name, "fr");
    });
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
    card.dataset.pokemonId = String(p.id);

    const dexId = getPokemonSpriteId(p);
    const sprite = getPokedexDisplaySprite(p, pokedexGridUseShiny);

    card.innerHTML = `
      <img src="${sprite}" alt="${p.name}" onerror="this.onerror=null;this.src='${getSpriteUrl(dexId)}'" />
      <span class="pokedex-num">#${dexId}</span>
      <strong>${p.name}</strong>
      <div class="pokedex-card-types">${typeBadgesHtml(p.type1, p.type2 || null)}</div>
    `;

    card.addEventListener("click", () => {
      pokedexSelectedId = p.id;
      pokedexSelectedShiny = false;
      updatePokedexGridSelection();
      renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || p);
    });
    grid.appendChild(card);
  }

  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || list[0]);
}

function updatePokedexGridSelection() {
  const grid = document.getElementById("pokedex-grid");
  if (!grid) return;
  const cards = grid.querySelectorAll(".pokedex-card");
  cards.forEach((card) => {
    card.classList.toggle("selected", Number(card.dataset.pokemonId) === Number(pokedexSelectedId));
  });
}

function loadPokedexRecentIds() {
  if (pokedexRecentLoaded) return;
  pokedexRecentLoaded = true;
  try {
    const raw = localStorage.getItem(POKEDEX_RECENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      pokedexRecentIds = parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id));
    }
  } catch {
    pokedexRecentIds = [];
  }
}

function savePokedexRecentIds() {
  try {
    localStorage.setItem(POKEDEX_RECENT_STORAGE_KEY, JSON.stringify(pokedexRecentIds.slice(0, POKEDEX_RECENT_MAX)));
  } catch {
    // ignore storage failures
  }
}

function trackPokedexRecentId(pokemonId) {
  const id = Number(pokemonId);
  if (!Number.isInteger(id)) return;
  loadPokedexRecentIds();
  if (pokedexRecentIds[0] === id) return;
  pokedexRecentIds = [id, ...pokedexRecentIds.filter((entry) => entry !== id)].slice(0, POKEDEX_RECENT_MAX);
  savePokedexRecentIds();
}

function clearPokedexRecentHistory() {
  loadPokedexRecentIds();
  if (!pokedexRecentIds.length) {
    renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || null);
    return;
  }
  pokedexRecentIds = [];
  savePokedexRecentIds();
  pokedexRecentSuppressOnce = true;
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || null);
}

function renderPokedexRecentBlock() {
  loadPokedexRecentIds();
  const recent = pokedexRecentIds
    .map((id) => POKEMON_BY_ID.get(id))
    .filter((pokemon) => Boolean(pokemon));
  const items = recent.map((pokemon) => {
    const dexId = getPokemonSpriteId(pokemon);
    const sprite = getPokedexDisplaySprite(pokemon, false);
    const isActive = Number(pokemon.id) === Number(pokedexSelectedId);
    return `<button type="button" class="pokedex-recent-item${isActive ? " is-active" : ""}" onclick="openPokedexRecent(${pokemon.id})"><img src="${sprite}" alt="${escapeHtml(pokemon.name)}" onerror="this.onerror=null;this.src='${getSpriteUrl(dexId)}'" /><span>${escapeHtml(pokemon.name)}</span></button>`;
  }).join("");
  const clearDisabled = recent.length ? "" : "disabled";
  return `<div class="pokedex-recent-block"><div class="pokedex-recent-head"><h4>Derniers consultés</h4><button type="button" class="btn-ghost pokedex-recent-clear" onclick="clearPokedexRecentHistory()" ${clearDisabled}>Effacer</button></div>${recent.length ? `<div class="pokedex-recent-list">${items}</div>` : '<p class="pokedex-recent-empty">Aucun Pokémon récent</p>'}</div>`;
}

function loadPokedexCompareId() {
  if (pokedexCompareLoaded) return;
  pokedexCompareLoaded = true;
  try {
    const raw = localStorage.getItem(POKEDEX_COMPARE_STORAGE_KEY);
    const value = Number(raw);
    pokedexCompareId = Number.isInteger(value) ? value : null;
  } catch {
    pokedexCompareId = null;
  }
}

function savePokedexCompareId() {
  try {
    if (!Number.isInteger(Number(pokedexCompareId))) {
      localStorage.removeItem(POKEDEX_COMPARE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(POKEDEX_COMPARE_STORAGE_KEY, String(pokedexCompareId));
  } catch {
    // ignore storage failures
  }
}

function setPokedexCompareReference(pokemon) {
  if (!pokemon) return;
  pokedexCompareId = pokemon.id;
  savePokedexCompareId();
  showPokedexCompareFeedback(`${pokemon.name} défini comme référence`);
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || pokemon);
}

function clearPokedexCompareReference() {
  pokedexCompareId = null;
  savePokedexCompareId();
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || null);
}

function showPokedexCompareFeedback(message) {
  const el = document.getElementById("pokedex-compare-feedback");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  window.clearTimeout(pokedexCompareToastTimer);
  pokedexCompareToastTimer = window.setTimeout(() => {
    el.classList.remove("is-visible");
    el.textContent = "";
  }, 1800);
}

function statsTotalsFromPokemonData(pokeData) {
  if (!pokeData?.stats) return { total: 0, stats: {} };
  const map = {
    hp: statFromPokemonData(pokeData, "hp"),
    atk: statFromPokemonData(pokeData, "attack"),
    def: statFromPokemonData(pokeData, "defense"),
    spa: statFromPokemonData(pokeData, "special-attack"),
    spd: statFromPokemonData(pokeData, "special-defense"),
    spe: statFromPokemonData(pokeData, "speed"),
  };
  const total = Object.values(map).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  return { total, stats: map };
}

function renderPokedexCompareBlock(reference, current, referenceStats, currentStats) {
  if (!reference || !current || reference.id === current.id) return "";
  const totalDelta = (currentStats.total || 0) - (referenceStats.total || 0);
  const deltaLabel = totalDelta === 0 ? "0" : totalDelta > 0 ? `+${totalDelta}` : String(totalDelta);
  const lines = [
    { key: "hp", label: "PV" },
    { key: "atk", label: "Attaque" },
    { key: "def", label: "Défense" },
    { key: "spa", label: "Atk Spé" },
    { key: "spd", label: "Def Spé" },
    { key: "spe", label: "Vitesse" },
  ];
  const statsRows = lines.map((entry) => {
    const leftVal = Number(referenceStats.stats?.[entry.key]) || 0;
    const rightVal = Number(currentStats.stats?.[entry.key]) || 0;
    const diff = rightVal - leftVal;
    const diffLabel = diff === 0 ? "0" : diff > 0 ? `+${diff}` : String(diff);
    return `<div class="pokedex-compare-row"><span>${entry.label}</span><b>${leftVal}</b><i>${diffLabel}</i><b>${rightVal}</b></div>`;
  }).join("");
  return `
    <div class="pokedex-compare-block">
      <div class="pokedex-compare-head">
        <h4>Comparaison rapide</h4>
        <button type="button" class="btn-ghost pokedex-compare-clear" onclick="clearPokedexCompareReference()">Effacer la comparaison</button>
      </div>
      <div class="pokedex-compare-top">
        <div class="pokedex-compare-side">
          <strong>${escapeHtml(reference.name)}</strong>
          <small>#${getPokemonSpriteId(reference)} • ${typeBadgesHtml(reference.type1, reference.type2)}</small>
        </div>
        <div class="pokedex-compare-score">
          <span>Total</span>
          <b>${referenceStats.total}</b>
          <i>${deltaLabel}</i>
          <b>${currentStats.total}</b>
        </div>
        <div class="pokedex-compare-side">
          <strong>${escapeHtml(current.name)}</strong>
          <small>#${getPokemonSpriteId(current)} • ${typeBadgesHtml(current.type1, current.type2)}</small>
        </div>
      </div>
      <div class="pokedex-compare-grid">${statsRows}</div>
    </div>
  `;
}

function openPokedexRecent(pokemonId) {
  const id = Number(pokemonId);
  const pokemon = Number.isInteger(id) ? POKEMON_BY_ID.get(id) : null;
  if (!pokemon) return;
  pokedexSelectedId = id;
  pokedexSelectedShiny = false;
  updatePokedexGridSelection();
  renderPokedexDetail(pokemon);
  ensurePokedexSelectedCardVisible();
}

function getPokedexNavigationState() {
  const list = getFilteredPokedexList();
  const currentIndex = list.findIndex((pokemon) => Number(pokemon.id) === Number(pokedexSelectedId));
  return {
    list,
    currentIndex,
    previous: currentIndex > 0 ? list[currentIndex - 1] : null,
    next: currentIndex >= 0 && currentIndex < list.length - 1 ? list[currentIndex + 1] : null,
  };
}

function ensurePokedexSelectedCardVisible() {
  const grid = document.getElementById("pokedex-grid");
  if (!grid || !pokedexSelectedId) return;
  const target = grid.querySelector(`.pokedex-card[data-pokemon-id="${pokedexSelectedId}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

function navigatePokedexDetail(direction) {
  const { previous, next, currentIndex } = getPokedexNavigationState();
  if (currentIndex < 0) return;
  const target = direction === "prev" ? previous : next;
  if (!target) return;
  pokedexSelectedId = target.id;
  pokedexSelectedShiny = false;
  updatePokedexGridSelection();
  renderPokedexDetail(POKEMON_BY_ID.get(pokedexSelectedId) || target);
  ensurePokedexSelectedCardVisible();
}

async function renderPokedexDetail(pokemon) {
  const detail = document.getElementById("pokedex-detail");
  if (!detail) return;

  if (!pokemon) {
    detail.innerHTML = '<p class="card-desc">Clique un Pokémon pour afficher sa fiche.</p>';
    return;
  }

  if (pokedexRecentSuppressOnce) {
    pokedexRecentSuppressOnce = false;
  } else {
    trackPokedexRecentId(pokemon.id);
  }
  loadPokedexCompareId();
  const currentRequest = ++pokedexDetailRequestId;
  const dexId = getPokemonSpriteId(pokemon);
  const navigation = getPokedexNavigationState();
  const recentHtml = renderPokedexRecentBlock();
  const navigationHtml = `
    <div class="pokedex-detail-nav">
      <button type="button" class="btn-ghost pokedex-detail-nav-btn" onclick="navigatePokedexDetail('prev')" ${navigation.previous ? "" : "disabled"}>&larr; Précédent</button>
      <button type="button" class="btn-ghost pokedex-detail-nav-btn" onclick="navigatePokedexDetail('next')" ${navigation.next ? "" : "disabled"}>Suivant &rarr;</button>
    </div>
  `;
  const builderActionHtml = `
    <div class="pokedex-detail-head-actions">
      <button id="pokedex-detail-shiny-toggle" class="btn-ghost pokedex-detail-shiny-btn" type="button" onclick="togglePokedexShiny()">${pokedexSelectedShiny ? "Shiny" : "Normal"}</button>
      <button class="btn-ghost pokedex-detail-builder-btn" type="button" onclick="addSelectedPokedexPokemonToBuilder()">Ajouter au Builder</button>
      <button class="btn-ghost pokedex-detail-compare-btn" type="button" onclick="setPokedexCompareReference(POKEMON_BY_ID.get(${pokemon.id}))">Comparer</button>
      <span id="pokedex-detail-builder-feedback" class="pokedex-detail-builder-feedback" aria-live="polite"></span>
      <span id="pokedex-compare-feedback" class="pokedex-compare-feedback" aria-live="polite"></span>
    </div>
  `;
  const referencePokemon = Number.isInteger(Number(pokedexCompareId)) ? POKEMON_BY_ID.get(Number(pokedexCompareId)) : null;
  const compareBlockHtml = referencePokemon && referencePokemon.id !== pokemon.id
    ? `<div class="pokedex-section"><h4>Comparaison rapide</h4><p class="pokedex-muted">Chargement...</p></div>`
    : "";

  detail.innerHTML = `
    <div class="pokedex-detail-head">
      <div class="pokedex-detail-sticky">
        <div class="pokedex-detail-summary">
          <h3>${pokemon.name}</h3>
          <p>#${dexId}${pokemon.isAltForm ? " ? Forme alternative" : ""}</p>
          <div class="pokedex-type-row">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
        </div>
      </div>
      <div class="pokedex-detail-head-main">
        <img src="${getPokedexDisplaySprite(pokemon, pokedexSelectedShiny)}" alt="${pokemon.name}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(dexId)}'" />
        ${builderActionHtml}
      </div>
    </div>
    ${navigationHtml}
    ${recentHtml}
    ${compareBlockHtml}
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
    <div class="pokedex-section"><h4>Évolution</h4><p class="pokedex-muted">Chargement...</p></div>
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
  const evolution = await pokedexEvolutionSummaryHtml(speciesData, pokeData);
  const captureRate = Number.isFinite(Number(speciesData?.capture_rate)) ? String(speciesData.capture_rate) : "Inconnu";
  const gender = formatGenderRate(speciesData);
  const eggs = formatEggGroups(speciesData);
  const hatch = formatHatchCycles(speciesData);
  const currentStats = statsTotalsFromPokemonData(pokeData);
  const compareReference = Number.isInteger(Number(pokedexCompareId)) ? POKEMON_BY_ID.get(Number(pokedexCompareId)) : null;
  let compareHtml = "";
  if (compareReference && compareReference.id !== pokemon.id) {
    try {
      const refApiId = getMysteryApiId(compareReference);
      const refData = refApiId ? await fetchPokedexPokemonData(refApiId) : null;
      const referenceStats = statsTotalsFromPokemonData(refData);
      compareHtml = renderPokedexCompareBlock(compareReference, pokemon, referenceStats, currentStats);
    } catch {
      compareHtml = "";
    }
  }

  detail.innerHTML = `
    <div class="pokedex-detail-head">
      <div class="pokedex-detail-sticky">
        <div class="pokedex-detail-summary">
          <h3>${pokemon.name}</h3>
          <p>#${dexId}${pokemon.isAltForm ? " ? Forme alternative" : ""}</p>
          <div class="pokedex-type-row">${typeBadgesHtml(pokemon.type1, pokemon.type2)}</div>
        </div>
      </div>
      <div class="pokedex-detail-head-main">
        <img src="${getPokedexDisplaySprite(pokemon, pokedexSelectedShiny)}" alt="${pokemon.name}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(dexId)}'" />
        ${builderActionHtml}
      </div>
    </div>
    ${navigationHtml}
    ${recentHtml}
    ${compareHtml}
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
    <div class="pokedex-section"><h4>Évolution</h4>${evolution}</div>
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
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
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

const DRAFT_ARENA_SIGNATURES_BY_GEN = {
  1: {
    "Pierre": ["Racaillou", "Onix"],
    "Ondine": ["Stari", "Staross"],
    "Major Bob": ["Voltorbe", "Raichu"],
    "Erika": ["Saquedeneu", "Rafflesia"],
    "Koga": ["Smogo", "Smogogo", "Nosferalto"],
    "Sabrina": ["Kadabra", "Alakazam"],
    "Blaine": ["Caninos", "Arcanin", "Galopa"],
    "Giovanni": ["Nidoqueen", "Nidoking", "Rhinoféros"],
  },
  2: {
    "Falkner": ["Roucoups"],
    "Bugsy": ["Coconfort", "Insécateur"],
    "Whitney": ["Mélofée", "Écrémeuh"],
    "Morty": ["Spectrum", "Ectoplasma"],
    "Chuck": ["Colossinge", "Mackogneur"],
    "Jasmine": ["Magnéti", "Steelix"],
    "Pryce": ["Marcacrin", "Cochignon"],
    "Clair": ["Hypocéan", "Hyporoi"],
  },
  3: {
    "Roxanne": ["Racaillou", "Tarinor"],
    "Brawly": ["Makuhita", "Hariyama"],
    "Wattson": ["Magnéton", "Élecsprint"],
    "Flannery": ["Limagma", "Chartor"],
    "Norman": ["Vigoroth", "Monaflèmit"],
    "Winona": ["Airmure", "Altaria"],
    "Tate & Liza": ["Solaroc", "Séléroc"],
    "Wallace": ["Lovdisc", "Milobellus"],
  },
  4: {
    "Roark": ["Cranidos", "Onix"],
    "Gardenia": ["Ceribou", "Roserade"],
    "Maylene": ["Méditikka", "Lucario"],
    "Crasher Wake": ["Mustébouée", "Musteflott"],
    "Fantina": ["Magirêve", "Spectrum"],
    "Byron": ["Steelix", "Bastiodon"],
    "Candice": ["Blizzi", "Blizzaroi"],
    "Volkner": ["Luxray", "Raichu"],
  },
  5: {
    "Aloé": ["Ponchiot", "Miradar"],
    "Artie": ["Crabicoque", "Manternel"],
    "Iris": ["Drakkarmin", "Tranchodon"],
    "Parsemille": ["Minotaupe", "Crocorible"],
    "Bardane": ["Haydaim", "Fragilady"],
    "Inezia": ["Zeblitz"],
    "Anis": ["Tutankafer", "Moyade"],
    "Lino": ["Moyade"],
  },
  6: {
    "Violette": ["Prismillon"],
    "Ramos": ["Chevroum"],
    "Korrina": ["Lucario"],
    "Lem": ["Iguolta"],
    "Valériane": ["Nymphali", "Mysdibule"],
    "Olympia": ["Mistigrix"],
    "Glacia": ["Blizzaroi"],
  },
  7: {
    "Ilima": ["Manglouton"],
    "Néphie": ["Araqua", "Tarenbulle"],
    "Barbara": ["Smogogo", "Grotadmorv"],
    "Kiawe": ["Tritox", "Malamandre"],
    "Margie": ["Mimiqui"],
    "Pectorius": ["Mackogneur"],
    "Kahili": ["Bazoucan"],
    "Alyxia": ["Lougaroc"],
  },
  8: {
    "Donna": ["Tournicoton", "Blancoton"],
    "Nabil": ["Khélocrok"],
    "Savell": ["Grillepattes", "Scolocendre"],
    "Faïza": ["Mackogneur"],
    "Sally": ["Charmilly"],
    "Chaz": ["Monthracite"],
    "Alistair": ["Ectoplasma"],
    "Roy": ["Duralugon"],
  },
  9: {
    "Katy": ["Tissenboule", "Filentrappe"],
    "Larry": ["Étouraptor"],
    "Ryme": ["Téraclope", "Noctunoir"],
    "Tulip": ["Florges", "Gardevoir"],
    "Grusha": ["Altaria"],
    "Alisma": ["Terraiste"],
  },
};

const DRAFT_ARENA_TYPE_IMAGE_BY_TYPE = {
  "Normal": "Normal.png",
  "Feu": "Fire.png",
  "Eau": "Water.png",
  "Plante": "Grass.png",
  "Électrik": "Electric.png",
  "Glace": "Ice.png",
  "Combat": "Fighting.png",
  "Poison": "Poison.png",
  "Sol": "Ground.png",
  "Vol": "Flying.png",
  "Psy": "Psychic.png",
  "Insecte": "Bug.png",
  "Roche": "Rock.png",
  "Spectre": "Ghost.png",
  "Dragon": "Dragon.png",
  "Ténèbres": "Dark.png",
  "Acier": "Steel.png",
  "Fée": "Fairy.png",
};

const DRAFT_ARENA_BACKGROUND_IMAGE_BY_NAME = Object.freeze(
  Object.fromEntries(
    Object.values(DRAFT_ARENAS_BY_GEN)
      .flat()
      .filter((arena) => arena?.name && arena?.badgeFile)
      .map((arena) => [
        arena.name,
        `https://archives.bulbagarden.net/wiki/Special:Redirect/file/${arena.badgeFile}`,
      ])
  )
);

function createDraftArenaState() {
  return {
    phase: "gen", // gen | draft | battle | result
    selectedGen: null,
    team: [],
    selectedBattlePokemonId: null,
    enemyBattleTeam: [],
    currentArenaIndex: 0,
    teamData: [],
    synergyData: null,
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
  const statGlobal = values.length && values.every((value) => Number.isFinite(value))
    ? values.reduce((sum, value) => sum + value, 0)
    : getDraftFallbackStatTotal(pokemon);
  const rarity = getDraftRarityInfo(statGlobal, pokemon);
  const stageBonus = (Number(pokemon?.stage) || 1) * 4;
  const dualTypeBonus = pokemon?.type2 ? 4 : 0;
  // `power` stays as the internal balancing score for the Draft.
  // Visible UI now relies on the real base-stat total via `statGlobal`.
  const power = clampDraftValue(Math.round(statGlobal / 7.2 + rarity.score + stageBonus + dualTypeBonus), 35, 100);
  return {
    power,
    statGlobal,
    statsTotal: statGlobal,
    rarityLabel: rarity.label,
    rarityScore: rarity.score,
  };
}

function getDraftPowerCacheKey(pokemon) {
  return `${pokemon?.id || "?"}:${getPokemonSpriteId(pokemon)}`;
}

function getDraftPoolEntryKey(pokemon) {
  return String(pokemon?.id ?? getPokemonSpriteId(pokemon) ?? "?");
}

function getDraftCachedPokemonPowerData(pokemon) {
  const key = getDraftPowerCacheKey(pokemon);
  return DRAFT_POWER_CACHE.get(key) || buildDraftPowerMetrics(pokemon, null);
}

// ============================================================
// DRAFT SIMPLE BATTLE FOUNDATION
// Minimal future-ready combat scaffold for a simplified 1v1 mode.
// Intentionally excludes: status, items, abilities, switch, weather,
// terrain and complex stat boosts. Keep this isolated from the live draft
// flow until a dedicated combat phase is added.
// ============================================================

const DRAFT_SIMPLE_BATTLE_DEFAULT_MOVE_POWER = 70;
const DRAFT_SIMPLE_BATTLE_STAB = 1.5;
const DRAFT_SIMPLE_BATTLE_TEAM_SIZE = DRAFT_TEAM_SIZE;
const DRAFT_SIMPLE_BATTLE_MAJOR_STATUSES = new Set([
  "paralysed",
  "burned",
  "poisoned",
  "badly_poisoned",
  "asleep",
  "frozen",
]);
const DRAFT_SIMPLE_BATTLE_MOVE_OVERRIDES = {
  "Séisme": { power: 100, category: "physical", pp: 10 },
  "Lance-Flammes": { power: 90, category: "special", pp: 15, effect: { kind: "status", status: "burned", chance: 0.1, label: "Peut brûler" } },
  "Hydrocanon": { power: 110, category: "special", pp: 5, accuracy: 80, effect: { kind: "recharge", label: "Doit recharger" } },
  "Lame-Feuille": { power: 90, category: "physical", pp: 15 },
  "Tonnerre": { power: 90, category: "special", accuracy: 100, effect: { kind: "status", status: "paralysed", chance: 0.3, label: "Peut paralyser" } },
  "Laser Glace": { power: 90, category: "special", pp: 10, effect: { kind: "status", status: "frozen", chance: 0.1, label: "Peut geler" } },
  "Close Combat": { power: 120, category: "physical", pp: 5 },
  "Bomb-Beurk": { power: 90, category: "special" },
  "Draco-Météore": { power: 130, category: "special" },
  "Boutefeu": { power: 120, category: "physical", effects: [{ kind: "recoil", ratio: 0.33, label: "Subit du recul" }, { kind: "status", status: "burned", chance: 0.1, label: "Peut brûler" }] },
  "Surf": { power: 90, category: "special" },
  "Éco-Sphère": { power: 90, category: "special" },
  "Fatal-Foudre": { power: 110, category: "special", accuracy: 70, effect: { kind: "status", status: "paralysed", chance: 0.3, label: "Peut paralyser" } },
  "Vent Violent": { power: 110, category: "special", accuracy: 70, effect: { kind: "flinch", chance: 0.3, label: "Peut apeurer" } },
  "Change Éclair": { power: 70, category: "special" },
  "Machouille": { power: 80, category: "physical", effect: { kind: "debuff", stat: "defense", stages: 1, target: "foe", chance: 0.2, label: "Peut baisser la Défense" } },
  "Ball'Ombre": { power: 80, category: "special" },
  "Vibrobscur": { power: 80, category: "special" },
  "Psyko": { power: 90, category: "special" },
  "Aurasphère": { power: 80, category: "special" },
  "Nœud Herbe": { power: 80, category: "special" },
  "Ébullilave": { power: 80, category: "special" },
  "Vive-Attaque": { power: 40, category: "physical", priority: 1, type: "Normal" },
  "Retour": { power: 90, category: "physical", type: "Normal" },
  "Plaquage": { power: 85, category: "physical", type: "Normal", effect: { kind: "status", status: "paralysed", chance: 0.3, label: "Peut paralyser" } },
  "Ultralaser": { power: 150, category: "special", type: "Normal", accuracy: 90, effect: { kind: "recharge", label: "Doit recharger" } },
  "Écrasement": { power: 65, category: "physical", type: "Normal" },
  "Bélier": { power: 90, category: "physical", type: "Normal", effect: { kind: "recoil", ratio: 0.25, label: "Subit du recul" } },
  "Piège de Roc": { power: 0, category: "status" },
  "Demi-Tour": { power: 70, category: "physical" },
  "Tour Rapide": { power: 50, category: "physical" },
  "Abri": { power: 0, category: "status", effect: { kind: "protect", label: "Se protège" }, pp: 10 },
  "Clonage": { power: 0, category: "status" },
  "Repos": { power: 0, category: "status", effect: { kind: "rest", label: "S'endort et récupère des PV" }, pp: 10 },
  "Danse-Lames": { power: 0, category: "status", effect: { kind: "buff", stat: "attack", stages: 2, label: "L'Attaque augmente beaucoup !" } },
  "Protection": { power: 0, category: "status" },
  "Mur Lumière": { power: 0, category: "status", effect: { kind: "buff", stat: "spDefense", stages: 1, label: "La Défense Spéciale augmente !" } },
  "Reflet": { power: 0, category: "status", effect: { kind: "buff", stat: "evasion", stages: 1, label: "L'esquive augmente !" } },
  "Lame d'Air": { power: 75, category: "special", effect: { kind: "flinch", chance: 0.3, label: "Peut apeurer" } },
  "Choc Mental": { power: 50, category: "special" },
  "Direct Toxik": { power: 80, category: "physical" },
  "Canon Graine": { power: 80, category: "physical" },
  "Câlinerie": { power: 90, category: "physical" },
  "Éclat Magique": { power: 80, category: "special" },
  "Tête de Fer": { power: 80, category: "physical", effect: { kind: "flinch", chance: 0.3, label: "Peut apeurer" } },
  "Pisto-Poing": { power: 40, category: "physical", priority: 1 },
  "Crocs Feu": { power: 65, category: "physical", effects: [{ kind: "status", status: "burned", chance: 0.1, label: "Peut brûler" }, { kind: "flinch", chance: 0.1, label: "Peut apeurer" }] },
  "Crocs Givre": { power: 65, category: "physical", effects: [{ kind: "status", status: "frozen", chance: 0.1, label: "Peut geler" }, { kind: "flinch", chance: 0.1, label: "Peut apeurer" }] },
  "Crocs Éclair": { power: 65, category: "physical", effects: [{ kind: "status", status: "paralysed", chance: 0.1, label: "Peut paralyser" }, { kind: "flinch", chance: 0.1, label: "Peut apeurer" }] },
  "Sabotage": { power: 65, category: "physical" },
  "Atterrissage": { power: 0, category: "status", effect: { kind: "heal", ratio: 0.33, label: "Récupère des PV" } },
  "Toxik": { power: 0, category: "status", effect: { kind: "status", status: "badly_poisoned", chance: 1, label: "Empoisonne gravement" }, pp: 10, accuracy: 85 },
  "Vœu Soin": { power: 0, category: "status" },
  "Dracochoc": { power: 85, category: "special" },
  "Giga-Sangsue": { power: 75, category: "special", effect: { kind: "drain", ratio: 0.5, label: "Absorbe des PV" } },
  "Éclair Fou": { power: 90, category: "physical", effect: { kind: "recoil", ratio: 0.25, label: "Subit du recul" } },
  "Telluriforce": { power: 90, category: "special" },
  "Cradovague": { power: 95, category: "special" },
  "Tricherie": { power: 95, category: "physical" },
  "Poing Glace": { power: 75, category: "physical" },
  "Poing-Éclair": { power: 75, category: "physical", effect: { kind: "status", status: "paralysed", chance: 0.1, label: "Peut paralyser" } },
  "Cage-Éclair": { power: 0, category: "status", effect: { kind: "status", status: "paralysed", chance: 1, label: "Paralyse" } },
  "Poing de Feu": { power: 75, category: "physical", effect: { kind: "status", status: "burned", chance: 0.1, label: "Peut brûler" } },
  "Psykoud'Boul": { power: 80, category: "physical", effect: { kind: "flinch", chance: 0.2, label: "Peut apeurer" } },
  "Draco-Rage": { power: 1, category: "special", effect: { kind: "fixed-damage", value: 40, label: "Inflige 40 PV fixes" } },
  "Sonicboom": { power: 1, category: "special", effect: { kind: "fixed-damage", value: 20, label: "Inflige 20 PV fixes" } },
  "Ombre Nocturne": { power: 1, category: "special", effect: { kind: "fixed-damage", value: 50, label: "Inflige des dégâts fixes" } },
  "Frappe Atlas": { power: 1, category: "physical", effect: { kind: "fixed-damage", value: 50, label: "Inflige des dégâts fixes" } },
};
let draftSimpleBattleDevUiState = null;
let draftSimpleBattleIntroTimer = null;
let draftSimpleBattleTurnTimer = null;
let draftSimpleBattleReplayTimer = null;
let draftSimpleBattleReplayFrame = null;
let draftSimpleBattleActionResumeTimer = null;
let draftSimpleBattleAutoScrollFrame = null;

function clampDraftSimpleBattleHp(value) {
  return Math.max(1, Math.round(Number(value) || 1));
}

function getDraftSimpleBattleDefaultPp(options = {}) {
  const category = options.category === "status" ? "status" : "damaging";
  const power = Number(options.power) || 0;
  if (category === "status") return 20;
  if (power >= 120) return 5;
  if (power >= 90) return 10;
  if (power >= 70) return 15;
  return 20;
}

function createDraftSimpleBattleStruggleMove() {
  return createDraftSimpleBattleMove("Struggle", "Normal", {
    power: 50,
    category: "physical",
    pp: 1,
    effect: { kind: "recoil", ratio: 0.25, label: "Subit du recul" },
  });
}

function getDraftSimpleBattleMaxHpFromBaseHp(baseHp) {
  // Simple Draft-combat scaling:
  // keep the real base HP as the source, then add a flat buffer so fights stay
  // readable and slightly longer than a raw stat-for-stat conversion.
  return clampDraftSimpleBattleHp((Number(baseHp) || 0) + 35);
}

function getDraftSimpleBattleFallbackStats(pokemon) {
  const stage = Number(pokemon?.stage) || 1;
  return {
    hp: clampDraftSimpleBattleHp(55 + stage * 18 + Math.round((Number(pokemon?.weight) || 0) / 10)),
    attack: 60 + stage * 12,
    defense: 60 + stage * 12,
    spAttack: 60 + stage * 12,
    spDefense: 60 + stage * 12,
    speed: 55 + stage * 10,
  };
}

function getDraftSimpleBattleStats(pokemon) {
  const cached = MYSTERY_STAT_CACHE.get(getMysteryApiId(pokemon));
  const fallback = getDraftSimpleBattleFallbackStats(pokemon);
  if (cached) {
    return {
      hp: getDraftSimpleBattleMaxHpFromBaseHp(cached.hp),
      attack: Number(cached.attack) || 0,
      defense: Number(cached.defense) || 0,
      spAttack: Number(cached.spAttack) || 0,
      spDefense: Number(cached.spDefense) || 0,
      speed: Math.max(1, Number(cached.speed) || Number(fallback.speed) || 1),
    };
  }
  return fallback;
}

function createDraftSimpleBattleMove(label, type, options = {}) {
  const category = options.category === "special" ? "special" : options.category === "status" ? "status" : "physical";
  const ppMax = Math.max(1, Number(options.pp) || getDraftSimpleBattleDefaultPp({ category, power: options.power }));
  const accuracy = Math.max(1, Math.min(100, Number(options.accuracy) || 100));
  const critStage = Math.max(0, Number(options.critStage) || 0);
  const normalizedEffects = normalizeDraftSimpleBattleMoveEffects(options);
  return {
    name: label || "Attaque",
    type: type || "Normal",
    power: category === "status"
      ? Math.max(0, Number(options.power) || 0)
      : Math.max(1, Number(options.power) || DRAFT_SIMPLE_BATTLE_DEFAULT_MOVE_POWER),
    category,
    priority: Number.isFinite(Number(options.priority)) ? Number(options.priority) : 0,
    effect: normalizedEffects[0] || null,
    effects: normalizedEffects,
    flags: buildDraftSimpleBattleMoveFlags(normalizedEffects, options),
    accuracy,
    critStage,
    ppMax,
    ppCurrent: ppMax,
  };
}

function normalizeDraftSimpleBattleMoveEffects(options = {}) {
  const rawEffects = [];
  if (Array.isArray(options.effects)) rawEffects.push(...options.effects);
  if (options.effect) rawEffects.push(options.effect);
  return rawEffects
    .filter(Boolean)
    .map((effect) => ({ ...effect }));
}

function buildDraftSimpleBattleMoveFlags(effects = [], options = {}) {
  const flags = {
    contact: Boolean(options.contact),
    recoil: false,
    drain: false,
    recharge: false,
    protectLike: false,
    fixedDamage: false,
    flinch: false,
  };
  effects.forEach((effect) => {
    if (!effect?.kind) return;
    if (effect.kind === "recoil") flags.recoil = true;
    if (effect.kind === "drain") flags.drain = true;
    if (effect.kind === "recharge") flags.recharge = true;
    if (effect.kind === "protect") flags.protectLike = true;
    if (effect.kind === "fixed-damage") flags.fixedDamage = true;
    if (effect.kind === "flinch") flags.flinch = true;
  });
  return flags;
}

function getDraftSimpleBattleMoveEffects(move) {
  if (!move) return [];
  if (Array.isArray(move.effects) && move.effects.length) return move.effects;
  return move.effect ? [move.effect] : [];
}

function getDraftSimpleBattleOffenseProfile(pokemon) {
  const stats = getDraftSimpleBattleStats(pokemon);
  const attack = Number(stats.attack) || 1;
  const spAttack = Number(stats.spAttack) || 1;
  const speed = Number(stats.speed) || 1;
  const preferredCategory = spAttack > attack + 12 ? "special" : attack > spAttack + 12 ? "physical" : "mixed";
  return {
    stats,
    preferredCategory,
    fast: speed >= 95,
  };
}

function getDraftSimpleBattlePreferredMoveNamesForType(type, profile) {
  const category = profile?.preferredCategory || "mixed";
  const preferPhysical = category === "physical";
  const preferSpecial = category === "special";
  const byType = {
    "Feu": preferPhysical ? ["Boutefeu", "Crocs Feu", "Poing de Feu", "Lance-Flammes", "Ébullilave"] : ["Lance-Flammes", "Ébullilave", "Boutefeu", "Crocs Feu"],
    "Eau": ["Surf", "Hydrocanon"],
    "Plante": preferPhysical ? ["Lame-Feuille", "Canon Graine", "Giga-Sangsue", "Éco-Sphère", "Nœud Herbe"] : ["Éco-Sphère", "Giga-Sangsue", "Nœud Herbe", "Lame-Feuille", "Canon Graine"],
    "Électrik": preferPhysical ? ["Éclair Fou", "Crocs Éclair", "Poing-Éclair", "Tonnerre", "Fatal-Foudre", "Change Éclair"] : ["Tonnerre", "Change Éclair", "Fatal-Foudre", "Éclair Fou", "Crocs Éclair"],
    "Glace": preferPhysical ? ["Crocs Givre", "Poing Glace", "Laser Glace"] : ["Laser Glace", "Crocs Givre", "Poing Glace"],
    "Combat": preferPhysical ? ["Close Combat", "Aurasphère"] : ["Aurasphère", "Close Combat"],
    "Poison": preferPhysical ? ["Direct Toxik", "Cradovague", "Bomb-Beurk"] : ["Cradovague", "Bomb-Beurk", "Direct Toxik"],
    "Dragon": ["Draco-Météore", "Dracochoc"],
    "Vol": preferPhysical ? ["Vent Violent", "Lame d'Air"] : ["Vent Violent", "Lame d'Air"],
    "Psy": preferPhysical ? ["Psykoud'Boul", "Psyko", "Choc Mental"] : ["Psyko", "Choc Mental", "Psykoud'Boul"],
    "Ténèbres": preferPhysical ? ["Sabotage", "Machouille", "Tricherie", "Vibrobscur"] : ["Vibrobscur", "Machouille", "Sabotage", "Tricherie"],
    "Spectre": ["Ball'Ombre"],
    "Fée": preferPhysical ? ["Câlinerie", "Éclat Magique"] : ["Éclat Magique", "Câlinerie"],
    "Acier": preferPhysical ? ["Tête de Fer", "Pisto-Poing"] : ["Tête de Fer", "Pisto-Poing"],
    "Sol": preferPhysical ? ["Séisme", "Telluriforce", "Tour Rapide"] : ["Telluriforce", "Séisme", "Tour Rapide"],
    "Roche": ["Piège de Roc"],
    "Insecte": ["Demi-Tour"],
    "Normal": profile?.fast ? ["Vive-Attaque", "Plaquage", "Retour"] : ["Plaquage", "Retour", "Vive-Attaque"],
  };
  return byType[type] || [];
}

function getDraftSimpleBattleCoverageTypeTargets(pokemon) {
  const types = [pokemon?.type1, pokemon?.type2].filter(Boolean);
  const coverageMap = {
    "Feu": ["Sol", "Combat", "Dragon"],
    "Eau": ["Glace", "Sol", "Combat"],
    "Plante": ["Sol", "Poison", "Glace"],
    "Électrik": ["Glace", "Plante", "Ténèbres"],
    "Glace": ["Eau", "Acier", "Combat"],
    "Combat": ["Ténèbres", "Acier", "Psy"],
    "Poison": ["Sol", "Ténèbres", "Spectre"],
    "Sol": ["Roche", "Acier", "Glace"],
    "Vol": ["Combat", "Sol", "Dragon"],
    "Psy": ["Fée", "Combat", "Spectre"],
    "Insecte": ["Sol", "Combat", "Plante"],
    "Roche": ["Sol", "Combat", "Acier"],
    "Spectre": ["Poison", "Fée", "Combat"],
    "Dragon": ["Feu", "Eau", "Électrik"],
    "Ténèbres": ["Combat", "Poison", "Fée"],
    "Acier": ["Sol", "Fée", "Dragon"],
    "Fée": ["Psy", "Acier", "Plante"],
    "Normal": ["Combat", "Ténèbres"],
  };
  const targets = new Set();
  types.forEach((type) => (coverageMap[type] || []).forEach((target) => targets.add(target)));
  return [...targets];
}

function getDraftSimpleBattleUtilityMoveNames(pokemon, profile) {
  const types = [pokemon?.type1, pokemon?.type2].filter(Boolean);
  const utilities = [];
  if ((profile?.preferredCategory === "physical" || profile?.preferredCategory === "mixed")) utilities.push("Danse-Lames");
  if (profile?.fast) utilities.push("Abri");
  if (types.includes("Vol")) utilities.push("Atterrissage");
  if (types.includes("Roche")) utilities.push("Piège de Roc");
  if (types.includes("Électrik")) utilities.push("Change Éclair");
  if (types.includes("Insecte")) utilities.push("Demi-Tour");
  utilities.push("Abri");
  return [...new Set(utilities)];
}

function buildDraftSimpleBattleDefaultMoves(pokemon) {
  const profile = getDraftSimpleBattleOffenseProfile(pokemon);
  const selected = [];
  const selectedNames = new Set();
  const pushMoveByName = (moveName) => {
    if (!moveName || selected.length >= 4 || selectedNames.has(moveName)) return false;
    const move = convertDraftMoveNameToSimpleBattleMove(moveName, pokemon);
    if (!move?.name || selectedNames.has(move.name)) return false;
    selected.push(move);
    selectedNames.add(move.name);
    return true;
  };

  [pokemon?.type1, pokemon?.type2].filter(Boolean).forEach((type) => {
    getDraftSimpleBattlePreferredMoveNamesForType(type, profile).forEach(pushMoveByName);
  });

  getDraftSimpleBattleCoverageTypeTargets(pokemon).forEach((type) => {
    getDraftSimpleBattlePreferredMoveNamesForType(type, profile).forEach(pushMoveByName);
  });

  getDraftSimpleBattleUtilityMoveNames(pokemon, profile).slice(0, 1).forEach(pushMoveByName);

  ["Vive-Attaque", "Plaquage", "Retour"].forEach(pushMoveByName);

  if (!selected.length && pokemon?.type1) {
    selected.push(createDraftSimpleBattleMove(`${pokemon.type1} - STAB`, pokemon.type1, {
      category: profile.preferredCategory === "special" ? "special" : "physical",
    }));
  }
  if (selected.length < 2 && pokemon?.type2 && pokemon.type2 !== pokemon.type1) {
    selected.push(createDraftSimpleBattleMove(`${pokemon.type2} - STAB`, pokemon.type2, {
      category: profile.preferredCategory === "physical" ? "physical" : "special",
    }));
  }
  if (selected.length < 3) {
    const fallbackCoverageType = getDraftSimpleBattleCoverageTypeTargets(pokemon)[0] || "Normal";
    selected.push(createDraftSimpleBattleMove("Couverture fiable", fallbackCoverageType, {
      category: profile.preferredCategory === "physical" ? "physical" : "special",
      power: 75,
    }));
  }
  if (selected.length < 4) {
    selected.push(createDraftSimpleBattleMove(profile.fast ? "Frappe rapide" : "Couverture neutre", profile.fast ? "Normal" : (pokemon?.type1 || "Normal"), {
      power: profile.fast ? 40 : 70,
      priority: profile.fast ? 1 : 0,
      category: profile.fast ? "physical" : (profile.preferredCategory === "special" ? "special" : "physical"),
    }));
  }
  return selected.slice(0, 4);
}

function clampDraftSimpleBattleStage(value) {
  return clampDraftValue(Math.round(Number(value) || 0), -6, 6);
}

function getDraftSimpleBattleStageMultiplier(stage) {
  const clampedStage = clampDraftSimpleBattleStage(stage);
  if (clampedStage >= 0) {
    return (2 + clampedStage) / 2;
  }
  return 2 / (2 + Math.abs(clampedStage));
}

function getDraftSimpleBattleAccuracyMultiplier(accuracyStage, evasionStage) {
  const effectiveStage = clampDraftSimpleBattleStage((Number(accuracyStage) || 0) - (Number(evasionStage) || 0));
  if (effectiveStage >= 0) {
    return (3 + effectiveStage) / 3;
  }
  return 3 / (3 + Math.abs(effectiveStage));
}

function getDraftSimpleBattleStatStageLabel(statKey) {
  const labels = {
    attack: "L'Attaque",
    defense: "La Défense",
    spAttack: "L'Attaque Spéciale",
    spDefense: "La Défense Spéciale",
    speed: "La Vitesse",
    accuracy: "La Précision",
    evasion: "L'esquive",
  };
  return labels[statKey] || "La statistique";
}

function getDraftSimpleBattleStageChangeText(statKey, delta) {
  const label = getDraftSimpleBattleStatStageLabel(statKey);
  if (delta >= 2) return `${label} augmente beaucoup !`;
  if (delta === 1) return `${label} augmente !`;
  if (delta <= -2) return `${label} baisse beaucoup !`;
  if (delta === -1) return `${label} baisse !`;
  return `${label} ne change pas.`;
}

function applyDraftSimpleBattleStageChange(battler, statKey, delta) {
  if (!battler || !statKey || !delta) {
    return {
      changed: false,
      stage: 0,
      deltaApplied: 0,
      message: "",
    };
  }
  if (!battler.stages) {
    battler.stages = {
      attack: 0,
      defense: 0,
      spAttack: 0,
      spDefense: 0,
      speed: 0,
      accuracy: 0,
      evasion: 0,
    };
  }
  const previousStage = clampDraftSimpleBattleStage(battler.stages[statKey] || 0);
  const nextStage = clampDraftSimpleBattleStage(previousStage + delta);
  battler.stages[statKey] = nextStage;
  const deltaApplied = nextStage - previousStage;
  if (!deltaApplied) {
    return {
      changed: false,
      stage: nextStage,
      deltaApplied: 0,
      message: delta > 0
        ? `${getDraftSimpleBattleStatStageLabel(statKey)} est déjà au maximum.`
        : `${getDraftSimpleBattleStatStageLabel(statKey)} est déjà au minimum.`,
    };
  }
  return {
    changed: true,
    stage: nextStage,
    deltaApplied,
    message: getDraftSimpleBattleStageChangeText(statKey, deltaApplied),
  };
}

function createDraftSimpleBattlePokemonState(pokemon, moves = null) {
  const stats = getDraftSimpleBattleStats(pokemon);
  return {
    pokemon,
    currentHp: stats.hp,
    maxHp: stats.hp,
    speed: Math.max(1, Number(stats.speed) || 1),
    stats,
    stages: {
      attack: 0,
      defense: 0,
      spAttack: 0,
      spDefense: 0,
      speed: 0,
      accuracy: 0,
      evasion: 0,
    },
    status: null,
    statusState: {
      sleepTurns: 0,
      toxicCounter: 0,
    },
    volatileState: {
      flinched: false,
      mustRecharge: false,
    },
    protected: false,
    moves: (Array.isArray(moves) && moves.length ? moves : buildDraftSimpleBattleDefaultMoves(pokemon)).slice(0, 4),
  };
}

function getDraftSimpleBattleStatusLabel(status) {
  if (status === "paralysed") return "Paralysé";
  if (status === "burned") return "Brûlé";
  if (status === "poisoned") return "Empoisonné";
  if (status === "badly_poisoned") return "Toxique";
  if (status === "asleep") return "Endormi";
  if (status === "frozen") return "Gelé";
  return "";
}

function getDraftSimpleBattleStatusShortLabel(status) {
  if (status === "paralysed") return "PAR";
  if (status === "burned") return "BRN";
  if (status === "poisoned") return "PSN";
  if (status === "badly_poisoned") return "TOX";
  if (status === "asleep") return "SLP";
  if (status === "frozen") return "FRZ";
  return "";
}

function clearDraftSimpleBattleMajorStatus(battler) {
  if (!battler) return;
  battler.status = null;
  battler.statusState = {
    sleepTurns: 0,
    toxicCounter: 0,
  };
}

function getDraftSimpleBattleCurrentStat(sideState, statKey) {
  const baseValue = Math.max(1, Number(sideState?.stats?.[statKey]) || 1);
  const multiplier = getDraftSimpleBattleStageMultiplier(sideState?.stages?.[statKey] || 0);
  let effectiveValue = Math.max(1, Math.round(baseValue * multiplier));
  if (statKey === "attack" && sideState?.status === "burned") {
    effectiveValue = Math.max(1, Math.floor(effectiveValue / 2));
  }
  return effectiveValue;
}

function getDraftSimpleBattleCurrentSpeed(sideState) {
  const speed = getDraftSimpleBattleCurrentStat(sideState, "speed");
  if (sideState?.status === "paralysed") {
    return Math.max(1, Math.floor(speed / 4));
  }
  return speed;
}

function getDraftSimpleBattleStabMultiplier(attackerState, move) {
  const attacker = attackerState?.pokemon;
  return attacker && (attacker.type1 === move?.type || attacker.type2 === move?.type)
    ? DRAFT_SIMPLE_BATTLE_STAB
    : 1;
}

function getDraftSimpleBattleTypeMultiplier(gen, moveType, defenderState) {
  const defender = defenderState?.pokemon;
  if (!defender || !moveType) return 1;
  return getDraftAttackMultiplier(gen, moveType, defender.type1) * getDraftAttackMultiplier(gen, moveType, defender.type2 || null);
}

function getDraftSimpleBattleTurnOrder(leftState, rightState) {
  const leftSpeed = getDraftSimpleBattleCurrentSpeed(leftState);
  const rightSpeed = getDraftSimpleBattleCurrentSpeed(rightState);
  if (leftSpeed === rightSpeed) {
    return ["left", "right"];
  }
  return leftSpeed > rightSpeed ? ["left", "right"] : ["right", "left"];
}

function getDraftSimpleBattleTurnOrderForMoves(leftState, leftMove, rightState, rightMove) {
  const leftPriority = Number(leftMove?.priority) || 0;
  const rightPriority = Number(rightMove?.priority) || 0;
  if (leftPriority !== rightPriority) {
    return leftPriority > rightPriority ? ["left", "right"] : ["right", "left"];
  }
  const leftSpeed = getDraftSimpleBattleCurrentSpeed(leftState);
  const rightSpeed = getDraftSimpleBattleCurrentSpeed(rightState);
  if (leftSpeed === rightSpeed) {
    return Math.random() < 0.5 ? ["left", "right"] : ["right", "left"];
  }
  return leftSpeed > rightSpeed ? ["left", "right"] : ["right", "left"];
}

function clearDraftSimpleBattleTurnFlags(state) {
  if (!state) return;
  (state.leftTeam || []).forEach((member) => {
    if (member) {
      member.protected = false;
      if (member.volatileState) member.volatileState.flinched = false;
    }
  });
  (state.rightTeam || []).forEach((member) => {
    if (member) {
      member.protected = false;
      if (member.volatileState) member.volatileState.flinched = false;
    }
  });
}

function getDraftSimpleBattleUsableMoveIndexes(battler) {
  return (battler?.moves || [])
    .map((move, index) => ({ move, index }))
    .filter(({ move }) => (Number(move?.ppCurrent) || 0) > 0)
    .map(({ index }) => index);
}

function getDraftSimpleBattleMoveForAction(battler, action) {
  const normalized = getDraftSimpleBattleNormalizedAction(action, 0);
  if (normalized.kind === "struggle") return createDraftSimpleBattleStruggleMove();
  const move = battler?.moves?.[normalized.moveIndex] || null;
  if (move && (Number(move.ppCurrent) || 0) > 0) return move;
  const usableIndexes = getDraftSimpleBattleUsableMoveIndexes(battler);
  if (usableIndexes.length) {
    return battler.moves[usableIndexes[0]];
  }
  return createDraftSimpleBattleStruggleMove();
}

function consumeDraftSimpleBattleMovePp(battler, action) {
  const normalized = getDraftSimpleBattleNormalizedAction(action, 0);
  if (normalized.kind !== "move") return null;
  const move = battler?.moves?.[normalized.moveIndex] || null;
  if (!move || (Number(move.ppCurrent) || 0) <= 0) return null;
  move.ppCurrent = Math.max(0, (Number(move.ppCurrent) || 0) - 1);
  return move;
}

function getDraftSimpleBattleStatusFailureReason(defenderState, status, move) {
  if (!defenderState || !DRAFT_SIMPLE_BATTLE_MAJOR_STATUSES.has(status)) return "";
  if (defenderState.status) return "a déjà un statut majeur";
  const defender = defenderState.pokemon || {};
  if (status === "burned" && (defender.type1 === "Feu" || defender.type2 === "Feu")) return "immunité au Feu";
  if ((status === "poisoned" || status === "badly_poisoned") && (defender.type1 === "Poison" || defender.type2 === "Poison" || defender.type1 === "Acier" || defender.type2 === "Acier")) return "immunité au poison";
  if (status === "frozen" && (defender.type1 === "Glace" || defender.type2 === "Glace")) return "immunité à la Glace";
  if (status === "paralysed" && move?.type === "Électrik" && (defender.type1 === "Sol" || defender.type2 === "Sol")) return "immunité au Sol";
  return "";
}

function getDraftSimpleBattleNormalizedAction(action, fallbackMoveIndex = 0) {
  if (typeof action === "number") {
    return { kind: "move", moveIndex: action };
  }
  if (!action || typeof action !== "object") {
    return { kind: "move", moveIndex: fallbackMoveIndex };
  }
  if (action.kind === "struggle") {
    return { kind: "struggle" };
  }
  if (action.kind === "switch") {
    return {
      kind: "switch",
      teamIndex: Number(action.teamIndex),
      pokemonName: action.pokemonName || "",
    };
  }
  return {
    kind: "move",
    moveIndex: Number.isInteger(Number(action.moveIndex)) ? Number(action.moveIndex) : fallbackMoveIndex,
  };
}

function getDraftSimpleBattleActionPriority(state, side, action) {
  if (action?.kind === "switch") return 6;
  const battler = side === "left" ? state?.left : state?.right;
  const move = getDraftSimpleBattleMoveForAction(battler, action);
  return Number(move?.priority) || 0;
}

function getDraftSimpleBattleTurnOrderForActions(state, leftAction, rightAction) {
  const normalizedLeft = getDraftSimpleBattleNormalizedAction(leftAction, 0);
  const normalizedRight = getDraftSimpleBattleNormalizedAction(rightAction, 0);
  const leftPriority = getDraftSimpleBattleActionPriority(state, "left", normalizedLeft);
  const rightPriority = getDraftSimpleBattleActionPriority(state, "right", normalizedRight);
  if (leftPriority !== rightPriority) {
    return leftPriority > rightPriority ? ["left", "right"] : ["right", "left"];
  }
  const leftSpeed = getDraftSimpleBattleCurrentSpeed(state?.left);
  const rightSpeed = getDraftSimpleBattleCurrentSpeed(state?.right);
  if (leftSpeed === rightSpeed) {
    return Math.random() < 0.5 ? ["left", "right"] : ["right", "left"];
  }
  return leftSpeed > rightSpeed ? ["left", "right"] : ["right", "left"];
}

function canDraftSimpleBattleBattlerAct(battler) {
  return Boolean(battler && Number(battler.currentHp) > 0);
}

function resolveDraftSimpleBattleCanAct(state, side, battler) {
  if (!canDraftSimpleBattleBattlerAct(battler)) {
    return {
      canAct: false,
      reason: "ko",
    };
  }
  if (battler?.volatileState?.mustRecharge) {
    battler.volatileState.mustRecharge = false;
    return {
      canAct: false,
      reason: "recharge",
      action: {
        side,
        actorName: battler?.pokemon?.name || (side === "left" ? "Joueur" : "Adversaire"),
        prevented: true,
        preventedBy: "recharge",
        supportText: "Doit recharger ce tour",
      },
    };
  }
  if (battler?.volatileState?.flinched) {
    battler.volatileState.flinched = false;
    return {
      canAct: false,
      reason: "flinch",
      action: {
        side,
        actorName: battler?.pokemon?.name || (side === "left" ? "Joueur" : "Adversaire"),
        prevented: true,
        preventedBy: "flinched",
        supportText: "Apeuré, il ne peut pas agir",
      },
    };
  }
  if (battler?.status === "asleep") {
    const currentSleepTurns = Math.max(0, Number(battler?.statusState?.sleepTurns) || 0);
    if (currentSleepTurns > 0) {
      battler.statusState.sleepTurns = currentSleepTurns - 1;
    }
    if ((Number(battler?.statusState?.sleepTurns) || 0) > 0) {
      return {
        canAct: false,
        reason: "sleep",
        action: {
          side,
          actorName: battler?.pokemon?.name || (side === "left" ? "Joueur" : "Adversaire"),
          prevented: true,
          preventedBy: "asleep",
          supportText: "Endormi, il ne peut pas agir",
        },
      };
    }
    clearDraftSimpleBattleMajorStatus(battler);
    return {
      canAct: true,
      preAction: {
        side,
        actorName: battler?.pokemon?.name || (side === "left" ? "Joueur" : "Adversaire"),
        supportText: "Se réveille",
        appliedEffect: "wake-up",
      },
    };
  }
  if (battler?.status === "frozen") {
    if (Math.random() < 0.2) {
      clearDraftSimpleBattleMajorStatus(battler);
      return {
        canAct: true,
        preAction: {
          side,
          actorName: battler?.pokemon?.name || (side === "left" ? "Joueur" : "Adversaire"),
          supportText: "Dégèle",
          appliedEffect: "thawed",
        },
      };
    }
    return {
      canAct: false,
      reason: "frozen",
      action: {
        side,
        actorName: battler?.pokemon?.name || (side === "left" ? "Joueur" : "Adversaire"),
        prevented: true,
        preventedBy: "frozen",
        supportText: "Gelé, il ne peut pas agir",
      },
    };
  }
  if (battler?.status === "paralysed" && Math.random() < 0.25) {
    return {
      canAct: false,
      reason: "paralysis",
      action: {
        side,
        actorName: battler?.pokemon?.name || (side === "left" ? "Joueur" : "Adversaire"),
        prevented: true,
        preventedBy: "paralysed",
        supportText: "Paralysé, il ne peut pas agir",
      },
    };
  }
  return { canAct: true };
}

function tryDraftSimpleBattleApplyStatus(move, attackerState, defenderState) {
  const effect = move?.effect || null;
  if (!effect || effect.kind !== "status" || !effect.status || !defenderState) return null;
  const failureReason = getDraftSimpleBattleStatusFailureReason(defenderState, effect.status, move);
  if (failureReason) {
    return {
      status: effect.status,
      statusApplied: false,
      failureReason,
    };
  }
  const chance = Math.max(0, Math.min(1, Number(effect.chance) || 0));
  if (chance <= 0) return null;
  if (Math.random() > chance) return null;
  defenderState.status = effect.status;
  if (!defenderState.statusState) {
    defenderState.statusState = { sleepTurns: 0, toxicCounter: 0 };
  }
  if (effect.status === "asleep") {
    defenderState.statusState.sleepTurns = 2 + Math.floor(Math.random() * 3);
  }
  if (effect.status === "badly_poisoned") {
    defenderState.statusState.toxicCounter = 0;
  }
  return {
    status: effect.status,
    statusApplied: true,
    supportText: effect.label || getDraftSimpleBattleStatusLabel(effect.status) || "Statut appliqué",
  };
}

function runDraftSimpleBattleEndOfTurn(state, turnEntry) {
  const applyResidual = (side) => {
    const battler = side === "left" ? state?.left : state?.right;
    if (!battler || battler.currentHp <= 0 || !battler.status) return;
    let damage = 0;
    let supportText = "";
    if (battler.status === "burned") {
      damage = Math.max(1, Math.floor(Math.max(1, battler.maxHp) / 8));
      supportText = "Souffre de sa brûlure";
    } else if (battler.status === "poisoned") {
      damage = Math.max(1, Math.floor(Math.max(1, battler.maxHp) / 8));
      supportText = "Souffre du poison";
    } else if (battler.status === "badly_poisoned") {
      battler.statusState.toxicCounter = Math.max(1, Number(battler.statusState?.toxicCounter) || 0) + 1;
      damage = Math.max(1, Math.floor((Math.max(1, battler.maxHp) * battler.statusState.toxicCounter) / 16));
      supportText = "Le poison s'aggrave";
    }
    if (damage <= 0) return;
    battler.currentHp = Math.max(0, battler.currentHp - damage);
    turnEntry.actions.push({
      side,
      actorName: battler.pokemon.name,
      damage,
      knockout: battler.currentHp <= 0,
      supportText,
      appliedEffect: battler.status,
      residual: true,
    });
  };

  applyResidual("left");
  applyResidual("right");
  return { state, turnEntry };
}

function computeDraftSimpleBattleDamage(gen, attackerState, defenderState, move, options = {}) {
  const attackStat = move?.category === "special"
    ? getDraftSimpleBattleCurrentStat(attackerState, "spAttack")
    : getDraftSimpleBattleCurrentStat(attackerState, "attack");
  const defenseStat = move?.category === "special"
    ? getDraftSimpleBattleCurrentStat(defenderState, "spDefense")
    : getDraftSimpleBattleCurrentStat(defenderState, "defense");
  const stab = getDraftSimpleBattleStabMultiplier(attackerState, move);
  const effectiveness = getDraftSimpleBattleTypeMultiplier(gen, move?.type, defenderState);
  if (defenderState?.protected) {
    return {
      damage: 0,
      stab,
      effectiveness,
      blocked: true,
    };
  }
  const power = Math.max(1, Number(move?.power) || DRAFT_SIMPLE_BATTLE_DEFAULT_MOVE_POWER);
  const safeAttack = Math.max(1, Number(attackStat) || 1);
  const safeDefense = Math.max(1, Number(defenseStat) || 1);

  // Simplified Pokemon-like damage core:
  // - fixed virtual level
  // - physical/special split via attack/defense stats
  // - then STAB and type effectiveness apply at full weight
  // This keeps x2/x4 meaningful without turning every neutral hit into a one-shot.
  const virtualLevelFactor = 12;
  const baseDamage = (((virtualLevelFactor * power * (safeAttack / safeDefense)) / 50) + 2);
  const critical = Boolean(options.critical);
  const critMultiplier = critical ? 2 : 1;
  const modifiedDamage = baseDamage * critMultiplier * stab * effectiveness;
  const damage = effectiveness === 0 ? 0 : Math.max(1, Math.round(modifiedDamage));
  return {
    damage,
    stab,
    effectiveness,
    critical,
    blocked: false,
  };
}

function resolveDraftSimpleBattleMoveRecoil(attackerState, move, damageDealt) {
  const recoilEffect = getDraftSimpleBattleMoveEffects(move).find((effect) => effect?.kind === "recoil") || null;
  const ratio = Number(recoilEffect?.ratio) || 0;
  if (move?.name === "Struggle") {
    return Math.max(1, Math.floor(Math.max(1, damageDealt) / 4));
  }
  if (ratio <= 0 || !attackerState) return 0;
  return Math.max(1, Math.floor(Math.max(1, damageDealt) * ratio));
}

function resolveDraftSimpleBattleMoveDrain(attackerState, move, damageDealt) {
  const drainEffect = getDraftSimpleBattleMoveEffects(move).find((effect) => effect?.kind === "drain") || null;
  const ratio = Number(drainEffect?.ratio) || 0;
  if (!attackerState || ratio <= 0 || damageDealt <= 0) return 0;
  const healed = Math.max(1, Math.floor(damageDealt * ratio));
  const previousHp = attackerState.currentHp;
  attackerState.currentHp = Math.min(attackerState.maxHp, attackerState.currentHp + healed);
  return Math.max(0, attackerState.currentHp - previousHp);
}

function getDraftSimpleBattleFixedDamage(move, attackerState, defenderState) {
  const fixedEffect = getDraftSimpleBattleMoveEffects(move).find((effect) => effect?.kind === "fixed-damage") || null;
  if (!fixedEffect) return 0;
  if (fixedEffect.mode === "level") {
    return Math.max(1, Number(fixedEffect.value) || 50);
  }
  return Math.max(1, Number(fixedEffect.value) || 0);
}

function tryDraftSimpleBattleApplySecondaryEffect(effect, move, attackerState, defenderState, damageDealt) {
  if (!effect || !attackerState || !defenderState) return null;
  if (effect.kind === "status" && effect.status && damageDealt > 0) {
    return tryDraftSimpleBattleApplyStatus({ ...move, effect }, attackerState, defenderState);
  }
  if (effect.kind === "debuff" && effect.stat && damageDealt > 0) {
    const chance = Math.max(0, Math.min(1, Number(effect.chance) || 1));
    if (Math.random() > chance) return null;
    const target = effect.target === "self" ? attackerState : defenderState;
    const applied = applyDraftSimpleBattleStageChange(target, effect.stat, -(Math.abs(Number(effect.stages)) || 1));
    return {
      supportText: applied.message,
      appliedEffect: "debuff",
    };
  }
  if (effect.kind === "flinch" && damageDealt > 0 && defenderState.currentHp > 0) {
    const chance = Math.max(0, Math.min(1, Number(effect.chance) || 1));
    if (Math.random() > chance) return null;
    if (!defenderState.volatileState) defenderState.volatileState = { flinched: false, mustRecharge: false };
    defenderState.volatileState.flinched = true;
    return {
      supportText: effect.label || "Apeure la cible",
      appliedEffect: "flinch",
      flinchApplied: true,
    };
  }
  return null;
}

function doesDraftSimpleBattleMoveHit(move, attackerState, defenderState) {
  if (!move) return false;
  const baseAccuracy = Math.max(1, Math.min(100, Number(move.accuracy) || 100));
  const accuracyMultiplier = getDraftSimpleBattleAccuracyMultiplier(
    attackerState?.stages?.accuracy || 0,
    defenderState?.stages?.evasion || 0
  );
  const finalAccuracy = Math.max(1, Math.min(100, baseAccuracy * accuracyMultiplier));
  return Math.random() * 100 < finalAccuracy;
}

function doesDraftSimpleBattleMoveCrit(move) {
  const critStage = Math.max(0, Number(move?.critStage) || 0);
  const critChance = critStage >= 1 ? 0.125 : 0.0625;
  return Math.random() < critChance;
}

function getDraftSimpleBattleEstimatedMoveOutcome(gen, attackerState, defenderState, move) {
  if (!attackerState || !defenderState || !move) {
    return {
      move,
      damage: 0,
      stab: 1,
      effectiveness: 1,
      knockout: false,
      score: 0,
    };
  }
  if (move.category === "status") {
    const effect = getDraftSimpleBattleMoveEffects(move)[0] || {};
    let score = 12;
    let summary = effect.label || "Soutien";
    if (effect.kind === "heal") {
      const missingHp = Math.max(0, (Number(attackerState.maxHp) || 0) - (Number(attackerState.currentHp) || 0));
      const healAmount = Math.round(((Number(effect.ratio) || 0.3) * (Number(attackerState.maxHp) || 0)));
      score = missingHp > 0 ? Math.min(120, healAmount + missingHp) : 4;
      summary = "Soin";
    } else if (effect.kind === "protect") {
      score = defenderState?.currentHp > 0 ? 42 : 8;
      summary = "Protection";
    } else if (effect.kind === "buff") {
      score = 48;
      summary = effect.label || "Boost";
    } else if (effect.kind === "buff-multi") {
      score = 58;
      summary = effect.label || "Boost";
    } else if (effect.kind === "debuff") {
      score = 40;
      summary = effect.label || "Baisse";
    }
    return {
      move,
      damage: 0,
      stab: 1,
      effectiveness: 1,
      knockout: false,
      score,
      summary,
      isSupport: true,
    };
  }
  const result = computeDraftSimpleBattleDamage(gen, attackerState, defenderState, move);
  const defenderHp = Math.max(0, Number(defenderState.currentHp) || 0);
  const damage = Math.max(0, Number(result.damage) || 0);
  const knockout = defenderHp > 0 && damage >= defenderHp;
  const score =
    damage +
    (knockout ? 500 : 0) +
    ((Number(result.effectiveness) || 1) > 1 ? 80 : 0) +
    ((Number(result.effectiveness) || 1) === 0 ? -300 : 0) +
    ((Number(result.stab) || 1) > 1 ? 18 : 0);
  return {
    move,
    damage,
    stab: result.stab,
    effectiveness: result.effectiveness,
    knockout,
    score,
  };
}

function getDraftSimpleBattleUsableEnemyMoveEntries(state) {
  const enemy = state?.right;
  const player = state?.left;
  const usableIndexes = getDraftSimpleBattleUsableMoveIndexes(enemy);
  if (!enemy || !player) return [];
  return usableIndexes.map((index) => {
    const move = enemy.moves[index];
    const outcome = getDraftSimpleBattleEstimatedMoveOutcome(state.gen, enemy, player, move);
    return {
      index,
      multiplier: outcome.effectiveness,
      power: Number(move?.power) || DRAFT_SIMPLE_BATTLE_DEFAULT_MOVE_POWER,
      damage: outcome.damage,
      knockout: outcome.knockout,
      score: outcome.score,
      isSupport: Boolean(outcome.isSupport || move?.category === "status"),
      summary: outcome.summary || "",
      effect: move?.effect || null,
    };
  });
}

function resolveDraftSimpleBattleAttack(gen, attackerState, defenderState, actionOrMoveIndex = 0) {
  const normalizedAction = getDraftSimpleBattleNormalizedAction(actionOrMoveIndex, 0);
  const move = getDraftSimpleBattleMoveForAction(attackerState, normalizedAction);
  if (!move || !attackerState || !defenderState) return null;

  const effects = getDraftSimpleBattleMoveEffects(move);
  const primaryEffect = effects[0] || null;
  const rechargeEffect = effects.find((effect) => effect?.kind === "recharge") || null;
  const usedStruggle = move.name === "Struggle";

  if (!usedStruggle) {
    const spentMove = consumeDraftSimpleBattleMovePp(attackerState, normalizedAction);
    if (!spentMove) return null;
  }

  if (!doesDraftSimpleBattleMoveHit(move, attackerState, defenderState)) {
    if (rechargeEffect) {
      if (!attackerState.volatileState) attackerState.volatileState = { flinched: false, mustRecharge: false };
      attackerState.volatileState.mustRecharge = true;
    }
    return {
      move,
      damage: 0,
      stab: 1,
      effectiveness: 1,
      defenderRemainingHp: defenderState.currentHp,
      knockout: false,
      missed: true,
      supportText: "Rate sa cible",
      appliedEffect: "miss",
      needsRecharge: Boolean(rechargeEffect),
      usedStruggle,
    };
  }

  if (move.category === "status") {
    if (primaryEffect?.kind === "status" && primaryEffect.status) {
      const appliedStatus = tryDraftSimpleBattleApplyStatus(move, attackerState, defenderState);
      return {
        move,
        damage: 0,
        stab: 1,
        effectiveness: 1,
        defenderRemainingHp: defenderState.currentHp,
        knockout: false,
        supportText: appliedStatus?.statusApplied
          ? `${getDraftSimpleBattleStatusLabel(appliedStatus.status)}`
          : (appliedStatus?.failureReason || primaryEffect.label || "Statut tenté"),
        appliedEffect: appliedStatus?.statusApplied ? primaryEffect.status : "status-failed",
        statusApplied: Boolean(appliedStatus?.statusApplied),
        inflictedStatus: appliedStatus?.status || null,
        statusFailedReason: appliedStatus?.failureReason || "",
        usedStruggle,
      };
    }
    if (primaryEffect?.kind === "protect") {
      attackerState.protected = true;
      return {
        move,
        damage: 0,
        stab: 1,
        effectiveness: 1,
        defenderRemainingHp: defenderState.currentHp,
        knockout: false,
        supportText: primaryEffect.label || "Se protège",
        appliedEffect: "protect",
        usedStruggle,
      };
    }
    if (primaryEffect?.kind === "heal") {
      const healAmount = Math.max(1, Math.round((Number(primaryEffect.ratio) || 0.3) * Math.max(1, Number(attackerState.maxHp) || 1)));
      const previousHp = attackerState.currentHp;
      attackerState.currentHp = Math.min(attackerState.maxHp, attackerState.currentHp + healAmount);
      return {
        move,
        damage: 0,
        stab: 1,
        effectiveness: 1,
        defenderRemainingHp: defenderState.currentHp,
        knockout: false,
        heal: attackerState.currentHp - previousHp,
        supportText: primaryEffect.label || "Récupère des PV",
        appliedEffect: "heal",
        usedStruggle,
      };
    }
    if (primaryEffect?.kind === "rest") {
      const previousHp = attackerState.currentHp;
      attackerState.currentHp = attackerState.maxHp;
      attackerState.status = "asleep";
      attackerState.statusState.sleepTurns = 2;
      return {
        move,
        damage: 0,
        stab: 1,
        effectiveness: 1,
        defenderRemainingHp: defenderState.currentHp,
        knockout: false,
        heal: attackerState.currentHp - previousHp,
        supportText: primaryEffect.label || "S'endort",
        appliedEffect: "rest",
        statusApplied: true,
        inflictedStatus: "asleep",
        usedStruggle,
      };
    }
    if (primaryEffect?.kind === "buff" && primaryEffect.stat) {
      const result = applyDraftSimpleBattleStageChange(attackerState, primaryEffect.stat, Number(primaryEffect.stages) || 1);
      return {
        move,
        damage: 0,
        stab: 1,
        effectiveness: 1,
        defenderRemainingHp: defenderState.currentHp,
        knockout: false,
        supportText: result.message || primaryEffect.label || `${primaryEffect.stat} monte`,
        appliedEffect: "buff",
        usedStruggle,
      };
    }
    if (primaryEffect?.kind === "buff-multi" && primaryEffect.stats) {
      const messages = [];
      Object.entries(primaryEffect.stats).forEach(([statKey, factor]) => {
        const result = applyDraftSimpleBattleStageChange(attackerState, statKey, Number(factor) || 1);
        if (result.message) messages.push(result.message);
      });
      return {
        move,
        damage: 0,
        stab: 1,
        effectiveness: 1,
        defenderRemainingHp: defenderState.currentHp,
        knockout: false,
        supportText: messages[0] || primaryEffect.label || "Les stats augmentent !",
        appliedEffect: "buff",
        usedStruggle,
      };
    }
    if (primaryEffect?.kind === "debuff" && primaryEffect.stat) {
      const result = applyDraftSimpleBattleStageChange(defenderState, primaryEffect.stat, -(Math.abs(Number(primaryEffect.stages)) || 1));
      return {
        move,
        damage: 0,
        stab: 1,
        effectiveness: 1,
        defenderRemainingHp: defenderState.currentHp,
        knockout: false,
        supportText: result.message || primaryEffect.label || `${primaryEffect.stat} baisse`,
        appliedEffect: "debuff",
        usedStruggle,
      };
    }
  }

  if (defenderState.status === "frozen" && move.type === "Feu") {
    clearDraftSimpleBattleMajorStatus(defenderState);
  }

  const critical = doesDraftSimpleBattleMoveCrit(move);
  const fixedDamage = getDraftSimpleBattleFixedDamage(move, attackerState, defenderState);
  const result = fixedDamage > 0
    ? {
        damage: defenderState?.protected ? 0 : fixedDamage,
        stab: getDraftSimpleBattleStabMultiplier(attackerState, move),
        effectiveness: getDraftSimpleBattleTypeMultiplier(gen, move?.type, defenderState),
        critical,
        blocked: Boolean(defenderState?.protected),
        fixedDamage: true,
      }
    : computeDraftSimpleBattleDamage(gen, attackerState, defenderState, move, { critical });

  defenderState.currentHp = Math.max(0, defenderState.currentHp - result.damage);

  const secondaryResults = defenderState.currentHp > 0
    ? effects
      .map((effect) => tryDraftSimpleBattleApplySecondaryEffect(effect, move, attackerState, defenderState, result.damage))
      .filter(Boolean)
    : [];
  const appliedStatus = secondaryResults.find((entry) => entry?.statusApplied) || null;
  const appliedDebuff = secondaryResults.find((entry) => entry?.appliedEffect === "debuff") || null;
  const flinchResult = secondaryResults.find((entry) => entry?.flinchApplied) || null;
  const drain = resolveDraftSimpleBattleMoveDrain(attackerState, move, result.damage);
  const recoil = resolveDraftSimpleBattleMoveRecoil(attackerState, move, result.damage);

  if (recoil > 0) {
    attackerState.currentHp = Math.max(0, attackerState.currentHp - recoil);
  }
  if (rechargeEffect) {
    if (!attackerState.volatileState) attackerState.volatileState = { flinched: false, mustRecharge: false };
    attackerState.volatileState.mustRecharge = true;
  }

  return {
    move,
    damage: result.damage,
    stab: result.stab,
    effectiveness: result.effectiveness,
    critical: result.critical,
    blocked: result.blocked,
    fixedDamage: Boolean(result.fixedDamage),
    defenderRemainingHp: defenderState.currentHp,
    knockout: defenderState.currentHp <= 0,
    statusApplied: Boolean(appliedStatus?.statusApplied),
    inflictedStatus: appliedStatus?.status || null,
    statusFailedReason: appliedStatus?.failureReason || "",
    statDebuffApplied: Boolean(appliedDebuff),
    flinchApplied: Boolean(flinchResult),
    drain,
    recoil,
    needsRecharge: Boolean(rechargeEffect),
    supportText: flinchResult?.supportText || appliedDebuff?.supportText || "",
    selfKnockout: attackerState.currentHp <= 0,
    usedStruggle,
  };
}

function createDraftSimpleBattleState(leftPokemon, rightPokemon, options = {}) {
  // Future extension points:
  // - plug real move selection from draft picks
  // - add round loop / UI log
  // - add optional advanced rules in separate helpers, not here
  return {
    gen: Number(options.gen) || Number(leftPokemon?.gen) || Number(rightPokemon?.gen) || 1,
    phase: "ready",
    turn: 1,
    left: createDraftSimpleBattlePokemonState(leftPokemon, options.leftMoves),
    right: createDraftSimpleBattlePokemonState(rightPokemon, options.rightMoves),
    log: [],
  };
}

function resolveDraftSimpleBattleTurn(state, leftMoveIndex = 0, rightMoveIndex = 0) {
  if (!state?.left || !state?.right) return null;
  if (state.left.currentHp <= 0 || state.right.currentHp <= 0) return null;

  const leftAction = getDraftSimpleBattleNormalizedAction(leftMoveIndex, 0);
  const rightAction = getDraftSimpleBattleNormalizedAction(rightMoveIndex, 0);
  const order = getDraftSimpleBattleTurnOrderForActions(state, leftAction, rightAction);
  const turnLog = [];

  for (const side of order) {
    const attacker = side === "left" ? state.left : state.right;
    const defender = side === "left" ? state.right : state.left;
    const actionChoice = side === "left" ? leftAction : rightAction;
    const actCheck = resolveDraftSimpleBattleCanAct(state, side, attacker);
    if (actCheck.preAction) turnLog.push(actCheck.preAction);
    if (!actCheck.canAct) {
      if (actCheck.action) turnLog.push(actCheck.action);
      continue;
    }
    if (!canDraftSimpleBattleBattlerAct(defender)) continue;
    if (actionChoice.kind !== "move") continue;
    const action = resolveDraftSimpleBattleAttack(state.gen, attacker, defender, actionChoice.moveIndex);
    if (!action) continue;
    turnLog.push({ side, ...action });
    if (action.knockout) break;
  }

  state.log.push({ turn: state.turn, order: order.slice(), actions: turnLog });
  runDraftSimpleBattleEndOfTurn(state, state.log[state.log.length - 1]);
  state.turn += 1;
  state.phase = state.left.currentHp <= 0 || state.right.currentHp <= 0 ? "finished" : "ready";
  clearDraftSimpleBattleTurnFlags(state);
  return turnLog;
}

function getDraftSimpleBattleMoveLibraryEntry(moveName) {
  return TEAM_BUILDER_MOVE_LIBRARY.find((move) => move.name === moveName) || null;
}

function getDraftSimpleBattleTemplateMovesForPokemon(pokemon) {
  const pokemonId = Number(pokemon?.id);
  if (!Number.isInteger(pokemonId)) return [];
  for (const template of TEAM_LIBRARY_TEMPLATES) {
    const slot = template?.slots?.find((entry) => Number(entry?.pokemonId) === pokemonId);
    if (slot?.moves?.length) {
      return slot.moves.slice(0, 4);
    }
  }
  return [];
}

function getDraftSimpleBattleMoveCategory(type) {
  const specialTypes = new Set(["Feu", "Eau", "Plante", "Électrik", "Glace", "Psy", "Dragon", "Spectre", "Ténèbres", "Fée", "Poison"]);
  return specialTypes.has(type) ? "special" : "physical";
}

function convertDraftMoveNameToSimpleBattleMove(moveName, pokemon) {
  const entry = getDraftSimpleBattleMoveLibraryEntry(moveName);
  const override = DRAFT_SIMPLE_BATTLE_MOVE_OVERRIDES[moveName] || null;
  const moveType = override?.type || entry?.types?.[0] || pokemon?.type1 || "Normal";
  // Fallback intentionally stays simple: if the project has no richer move data
  // for this move, we still keep a usable typed attack for dev simulations.
  return createDraftSimpleBattleMove(
    moveName || "Attaque",
    moveType,
    {
      power: override?.power,
      category: override?.category || getDraftSimpleBattleMoveCategory(moveType),
      priority: override?.priority,
      effect: override?.effect,
      accuracy: override?.accuracy,
      pp: override?.pp,
    }
  );
}

function getDraftSimpleBattleUtilityMoveScore(move) {
  const effects = getDraftSimpleBattleMoveEffects(move);
  if (effects.some((effect) => effect?.kind === "heal" || effect?.kind === "rest")) return 5;
  if (effects.some((effect) => effect?.kind === "protect")) return 4;
  if (effects.some((effect) => effect?.kind === "buff-multi")) return 4;
  if (effects.some((effect) => effect?.kind === "buff")) return 3;
  if (effects.some((effect) => effect?.kind === "debuff" || effect?.kind === "status")) return 2;
  return 1;
}

function isDraftSimpleBattleLowPriorityCoverageMove(move, pokemon) {
  if (!move?.name) return false;
  const stabTypes = new Set([pokemon?.type1, pokemon?.type2].filter(Boolean));
  if (stabTypes.has(move.type)) return false;
  const lowPriorityNormalMoves = new Set(["Ultralaser", "Retour", "Plaquage", "Charge"]);
  return move.type === "Normal" && lowPriorityNormalMoves.has(move.name);
}

function isDraftSimpleBattleGenericNormalMove(move, pokemon) {
  if (!move?.name) return false;
  const stabTypes = new Set([pokemon?.type1, pokemon?.type2].filter(Boolean));
  if (stabTypes.has("Normal")) return false;
  const genericNormalMoves = new Set([
    "Ultralaser",
    "Retour",
    "Plaquage",
    "Charge",
  ]);
  return move.type === "Normal" && genericNormalMoves.has(move.name);
}

function getDraftSimpleBattleMoveSelectionScore(move, pokemon) {
  if (!move?.name) return -999;
  const stabTypes = new Set([pokemon?.type1, pokemon?.type2].filter(Boolean));
  const isStab = stabTypes.has(move.type);
  const isStatus = move.category === "status";
  const isGenericNormal = isDraftSimpleBattleGenericNormalMove(move, pokemon);
  const isLowPriorityCoverage = isDraftSimpleBattleLowPriorityCoverageMove(move, pokemon);

  if (isStatus) {
    return 120 + (getDraftSimpleBattleUtilityMoveScore(move) * 10);
  }

  let score = Number(move.power) || 0;
  if (isStab) score += 90;
  if (!isStab && move.type !== "Normal") score += 35;
  if (move.priority > 0) score += 18;
  if (isLowPriorityCoverage) score -= 60;
  if (isGenericNormal) score -= 180;
  return score;
}

function buildDraftSimpleBattleCuratedMoveSet(pokemon, sourceMoves = []) {
  const unique = [];
  const seen = new Set();
  sourceMoves.forEach((move) => {
    if (!move?.name || seen.has(move.name)) return;
    seen.add(move.name);
    unique.push(move);
  });
  if (!unique.length) return [];

  const stabTypes = new Set([pokemon?.type1, pokemon?.type2].filter(Boolean));
  const damaging = unique.filter((move) => Number(move.power) > 0 && move.category !== "status");
  const premiumDamaging = damaging.filter((move) => !isDraftSimpleBattleLowPriorityCoverageMove(move, pokemon));
  const nonGenericDamaging = damaging.filter((move) => !isDraftSimpleBattleGenericNormalMove(move, pokemon));
  const selected = [];
  const selectedNames = new Set();

  const pushMove = (move) => {
    if (!move?.name || selectedNames.has(move.name) || selected.length >= 4) return;
    selected.push(move);
    selectedNames.add(move.name);
  };

  premiumDamaging
    .filter((move) => stabTypes.has(move.type))
    .sort((a, b) => getDraftSimpleBattleMoveSelectionScore(b, pokemon) - getDraftSimpleBattleMoveSelectionScore(a, pokemon))
    .forEach(pushMove);

  premiumDamaging
    .filter((move) => !stabTypes.has(move.type) && move.type !== "Normal")
    .sort((a, b) => getDraftSimpleBattleMoveSelectionScore(b, pokemon) - getDraftSimpleBattleMoveSelectionScore(a, pokemon))
    .forEach(pushMove);

  unique
    .filter((move) => move.category === "status" && move.effect)
    .sort((a, b) => getDraftSimpleBattleUtilityMoveScore(b) - getDraftSimpleBattleUtilityMoveScore(a))
    .slice(0, 1)
    .forEach(pushMove);

  nonGenericDamaging
    .filter((move) => !premiumDamaging.includes(move))
    .sort((a, b) => getDraftSimpleBattleMoveSelectionScore(b, pokemon) - getDraftSimpleBattleMoveSelectionScore(a, pokemon))
    .forEach(pushMove);

  // Generic Normal nukes stay as a last resort only, so they stop appearing
  // on almost every non-Normal Pokémon when richer options exist.
  damaging
    .filter((move) => isDraftSimpleBattleGenericNormalMove(move, pokemon))
    .sort((a, b) => getDraftSimpleBattleMoveSelectionScore(b, pokemon) - getDraftSimpleBattleMoveSelectionScore(a, pokemon))
    .forEach(pushMove);

  unique.forEach(pushMove);
  return selected.slice(0, 4);
}

function buildDraftSimpleBattleMovesFromDraftPokemon(pokemon) {
  const templateMoves = getDraftSimpleBattleTemplateMovesForPokemon(pokemon)
    .map((moveName) => convertDraftMoveNameToSimpleBattleMove(moveName, pokemon))
    .slice(0, 8);

  if (templateMoves.length) {
    const curatedTemplateMoves = buildDraftSimpleBattleCuratedMoveSet(pokemon, templateMoves);
    if (curatedTemplateMoves.length >= 4) return curatedTemplateMoves;
  }

  const fallbackPool = buildTeamBuilderFallbackMovePool(pokemon)
    .map((entry) => convertDraftMoveNameToSimpleBattleMove(entry.name, pokemon));
  const strictFallbackPool = fallbackPool.filter((move) => !isDraftSimpleBattleGenericNormalMove(move, pokemon));
  const combinedPool = [...templateMoves, ...strictFallbackPool];
  let curatedFallbackPool = buildDraftSimpleBattleCuratedMoveSet(pokemon, combinedPool);
  if (curatedFallbackPool.length < 4) {
    curatedFallbackPool = buildDraftSimpleBattleCuratedMoveSet(pokemon, [...templateMoves, ...fallbackPool]);
  }
  if (curatedFallbackPool.length) {
    return curatedFallbackPool;
  }

  // Fallback path for Pokémon without stored moveset in project data.
  // Keep this minimal and deterministic for future integration with a real draft combat UI.
  return buildDraftSimpleBattleDefaultMoves(pokemon);
}

function getDraftSimpleBattlePokemonFromDraftEntry(draftEntry) {
  if (draftEntry?.pokemon) return draftEntry.pokemon;
  return draftEntry || null;
}

function convertDraftPokemonToSimpleBattler(draftEntry, options = {}) {
  const pokemon = getDraftSimpleBattlePokemonFromDraftEntry(draftEntry);
  if (!pokemon) return null;
  const moves = Array.isArray(options.moves) && options.moves.length
    ? options.moves.slice(0, 4)
    : buildDraftSimpleBattleMovesFromDraftPokemon(pokemon);
  return createDraftSimpleBattlePokemonState(pokemon, moves);
}

function getDraftSimpleBattleDevPokemon(id) {
  return POKEMON_BY_ID.get(id) || null;
}

function logDraftSimpleBattleDevResult(title, passed, details) {
  const prefix = passed ? "[OK]" : "[FAIL]";
  console.log(`${prefix} Draft Simple Battle Test - ${title}`);
  if (details) console.log(details);
}

function runDraftSimpleBattleDevTests() {
  const pikachu = getDraftSimpleBattleDevPokemon(25);
  const racaillou = getDraftSimpleBattleDevPokemon(74);
  const salameche = getDraftSimpleBattleDevPokemon(4);
  const carapuce = getDraftSimpleBattleDevPokemon(7);
  const abo = getDraftSimpleBattleDevPokemon(23);
  const nosferapti = getDraftSimpleBattleDevPokemon(41);
  const piafabec = getDraftSimpleBattleDevPokemon(21);
  const triopikeur = getDraftSimpleBattleDevPokemon(51);

  if (!pikachu || !racaillou || !salameche || !carapuce || !abo || !nosferapti || !piafabec || !triopikeur) {
    console.warn("Draft Simple Battle Dev Tests: Pokémon de test introuvables.");
    return;
  }

  console.group("Draft Simple Battle Dev Tests");

  const fastState = createDraftSimpleBattleState(
    pikachu,
    racaillou,
    {
      leftMoves: [createDraftSimpleBattleMove("Charge", "Normal")],
      rightMoves: [createDraftSimpleBattleMove("Charge", "Normal")],
      gen: 1,
    }
  );
  const speedOrder = getDraftSimpleBattleTurnOrder(fastState.left, fastState.right);
  logDraftSimpleBattleDevResult(
    "Ordre du tour selon la vitesse",
    speedOrder[0] === "left",
    `Premier à jouer : ${speedOrder[0]} (Pikachu ${fastState.left.speed} / Racaillou ${fastState.right.speed})`
  );

  const stabState = createDraftSimpleBattleState(
    pikachu,
    carapuce,
    {
      leftMoves: [createDraftSimpleBattleMove("Éclair", "Électrik")],
      rightMoves: [createDraftSimpleBattleMove("Charge", "Normal")],
      gen: 1,
    }
  );
  const stabOnly = computeDraftSimpleBattleDamage(1, stabState.left, stabState.right, stabState.left.moves[0]);
  logDraftSimpleBattleDevResult(
    "STAB appliqué",
    Math.abs(stabOnly.stab - 1.5) < 0.001,
    `STAB calculé : ${stabOnly.stab}`
  );

  const weaknessState = createDraftSimpleBattleState(
    pikachu,
    carapuce,
    {
      leftMoves: [createDraftSimpleBattleMove("Tonnerre", "Électrik", { power: 90, category: "special" })],
      rightMoves: [createDraftSimpleBattleMove("Charge", "Normal")],
      gen: 1,
    }
  );
  const weakness = computeDraftSimpleBattleDamage(1, weaknessState.left, weaknessState.right, weaknessState.left.moves[0]);
  logDraftSimpleBattleDevResult(
    "Faiblesse x2",
    Math.abs(weakness.effectiveness - 2) < 0.001,
    `Multiplicateur : ${weakness.effectiveness}, dégâts : ${weakness.damage}`
  );

  const resistState = createDraftSimpleBattleState(
    salameche,
    carapuce,
    {
      leftMoves: [createDraftSimpleBattleMove("Flammèche", "Feu", { power: 70, category: "special" })],
      rightMoves: [createDraftSimpleBattleMove("Charge", "Normal")],
      gen: 1,
    }
  );
  const resist = computeDraftSimpleBattleDamage(1, resistState.left, resistState.right, resistState.left.moves[0]);
  logDraftSimpleBattleDevResult(
    "Résistance x0.5",
    Math.abs(resist.effectiveness - 0.5) < 0.001,
    `Multiplicateur : ${resist.effectiveness}, dégâts : ${resist.damage}`
  );

  const immuneState = createDraftSimpleBattleState(
    abo,
    nosferapti,
    {
      leftMoves: [createDraftSimpleBattleMove("Séisme", "Sol", { power: 90 })],
      rightMoves: [createDraftSimpleBattleMove("Charge", "Normal")],
      gen: 6,
    }
  );
  const immune = computeDraftSimpleBattleDamage(6, immuneState.left, immuneState.right, immuneState.left.moves[0]);
  logDraftSimpleBattleDevResult(
    "Immunité de type",
    immune.effectiveness === 0 && immune.damage === 0,
    `Multiplicateur : ${immune.effectiveness}, dégâts : ${immune.damage}`
  );

  const koState = createDraftSimpleBattleState(
    triopikeur,
    piafabec,
    {
      leftMoves: [createDraftSimpleBattleMove("Éboulement", "Roche", { power: 240 })],
      rightMoves: [createDraftSimpleBattleMove("Charge", "Normal")],
      gen: 1,
    }
  );
  const koResult = resolveDraftSimpleBattleAttack(1, koState.left, koState.right, 0);
  logDraftSimpleBattleDevResult(
    "KO quand les PV tombent à 0",
    Boolean(koResult?.knockout) && koState.right.currentHp === 0,
    `PV restants défenseur : ${koState.right.currentHp}, KO : ${koResult?.knockout}`
  );

  console.groupEnd();
  return true;
}

function runDraftSimpleBattleDraftConversionDevTest() {
  const leftEntry = draftArenaState?.team?.[0] || { pokemon: getDraftSimpleBattleDevPokemon(6) };
  const rightEntry = draftArenaState?.team?.[1] || { pokemon: getDraftSimpleBattleDevPokemon(9) };
  const leftPokemon = getDraftSimpleBattlePokemonFromDraftEntry(leftEntry);
  const rightPokemon = getDraftSimpleBattlePokemonFromDraftEntry(rightEntry);

  if (!leftPokemon || !rightPokemon) {
    console.warn("Draft Simple Battle Draft Conversion Test: il faut 2 Pokémon valides.");
    return;
  }

  const left = convertDraftPokemonToSimpleBattler(leftEntry);
  const right = convertDraftPokemonToSimpleBattler(rightEntry);
  const state = {
    gen: Number(leftPokemon.gen) || Number(rightPokemon.gen) || 1,
    phase: "ready",
    turn: 1,
    left,
    right,
    log: [],
  };

  console.group("Draft Simple Battle Draft Conversion Test");
  console.log("Left fighter", {
    name: left.pokemon.name,
    types: [left.pokemon.type1, left.pokemon.type2].filter(Boolean),
    hp: left.maxHp,
    speed: left.speed,
    moves: left.moves.map((move) => `${move.name} (${move.type})`),
  });
  console.log("Right fighter", {
    name: right.pokemon.name,
    types: [right.pokemon.type1, right.pokemon.type2].filter(Boolean),
    hp: right.maxHp,
    speed: right.speed,
    moves: right.moves.map((move) => `${move.name} (${move.type})`),
  });

  let safety = 0;
  while (state.phase !== "finished" && safety < 12) {
    const turnLog = resolveDraftSimpleBattleTurn(state, 0, 0) || [];
    console.log(`Tour ${state.turn - 1}`, turnLog);
    safety += 1;
  }

  console.log("Résultat final", {
    leftHp: state.left.currentHp,
    rightHp: state.right.currentHp,
    winner: state.left.currentHp > 0 && state.right.currentHp <= 0
      ? state.left.pokemon.name
      : state.right.currentHp > 0 && state.left.currentHp <= 0
        ? state.right.pokemon.name
        : "Aucun vainqueur",
  });
  console.groupEnd();
  return state;
}

function simulateDraftSimpleBattleFromDraftEntries(leftEntry, rightEntry, maxTurns = 12) {
  const leftPokemon = getDraftSimpleBattlePokemonFromDraftEntry(leftEntry);
  const rightPokemon = getDraftSimpleBattlePokemonFromDraftEntry(rightEntry);
  if (!leftPokemon || !rightPokemon) return null;

  const state = {
    gen: Number(leftPokemon.gen) || Number(rightPokemon.gen) || 1,
    phase: "ready",
    turn: 1,
    left: convertDraftPokemonToSimpleBattler(leftEntry),
    right: convertDraftPokemonToSimpleBattler(rightEntry),
    log: [],
  };

  let safety = 0;
  while (state.phase !== "finished" && safety < maxTurns) {
    resolveDraftSimpleBattleTurn(state, 0, 0);
    safety += 1;
  }
  return state;
}

function getDraftSimpleBattlePlayerTeamEntries() {
  const teamEntries = Array.isArray(draftArenaState?.team) ? draftArenaState.team.filter((entry) => entry?.pokemon) : [];
  const selectedId = Number(draftArenaState?.selectedBattlePokemonId) || null;
  const selectedEntry = selectedId
    ? teamEntries.find((entry) => Number(entry?.pokemon?.id) === selectedId)
    : null;
  const ordered = selectedEntry
    ? [selectedEntry, ...teamEntries.filter((entry) => Number(entry?.pokemon?.id) !== selectedId)]
    : teamEntries.slice();

  return ordered.slice(0, DRAFT_SIMPLE_BATTLE_TEAM_SIZE);
}

function buildDraftSimpleBattleBotTeamEntries(playerEntries = []) {
  const playerDexIds = new Set(
    playerEntries
      .map((entry) => entry?.pokemon)
      .filter(Boolean)
      .map((pokemon) => getDraftPoolEntryKey(pokemon))
  );
  const desiredCount = DRAFT_SIMPLE_BATTLE_TEAM_SIZE;
  const picks = [];
  const usedDexIds = new Set(playerDexIds);

  const genPool = draftArenaState?.selectedGen
    ? getDraftPoolForGeneration(draftArenaState.selectedGen)
    : POKEMON_LIST;

  // Solo enemy team must come from a dedicated external pool, never from the
  // player's own picks. This same entry point can later accept a room enemy team.
  const weightedOpponents = buildDraftWeightedWave(genPool || [], desiredCount, usedDexIds);
  weightedOpponents.forEach((pokemon) => {
    if (!pokemon) return;
    usedDexIds.add(getDraftPoolEntryKey(pokemon));
    picks.push({ pokemon });
  });

  const fallbackIds = [9, 25, 7, 4, 74];
  for (const id of fallbackIds) {
    if (picks.length >= desiredCount) break;
    const pokemon = getDraftSimpleBattleDevPokemon(id);
    if (!pokemon || usedDexIds.has(getDraftPoolEntryKey(pokemon))) continue;
    usedDexIds.add(getDraftPoolEntryKey(pokemon));
    picks.push({ pokemon });
  }

  return picks.slice(0, desiredCount);
}

function getDraftSimpleBattleEnemyTeamEntries(options = {}) {
  const source = options.source || "bot";
  const playerEntries = Array.isArray(options.playerEntries) ? options.playerEntries : [];

  if (source === "room" && Array.isArray(options.enemyEntries) && options.enemyEntries.length) {
    return options.enemyEntries
      .filter((entry) => entry?.pokemon)
      .slice(0, DRAFT_SIMPLE_BATTLE_TEAM_SIZE);
  }

  return buildDraftSimpleBattleBotTeamEntries(playerEntries);
}

function getDraftSimpleBattleDevEntries() {
  const playerDraftTeam = getDraftSimpleBattlePlayerTeamEntries();
  const safePlayerDraftTeam = playerDraftTeam.length ? playerDraftTeam : [{ pokemon: getDraftSimpleBattleDevPokemon(6) }];
  const enemyDraftTeam = getDraftSimpleBattleEnemyTeamEntries({
    source: "bot",
    playerEntries: safePlayerDraftTeam,
  });
  const safeEnemyDraftTeam = enemyDraftTeam.length ? enemyDraftTeam : [{ pokemon: getDraftSimpleBattleDevPokemon(25) }];
  return {
    playerDraftTeam: safePlayerDraftTeam,
    enemyDraftTeam: safeEnemyDraftTeam,
  };
}

function selectDraftBattlePokemon(pokemonId) {
  if (!draftArenaState) return;
  const value = Number(pokemonId);
  draftArenaState.selectedBattlePokemonId = Number.isInteger(value) && value > 0 ? value : null;
  renderDraftArena();
}

function selectDraftSimpleBattlePreviewLead(teamIndex) {
  if (!draftSimpleBattleDevUiState || !draftArenaState || !draftSimpleBattleDevUiState.showPreview) return;
  const nextIndex = Number(teamIndex);
  const nextLead = draftSimpleBattleDevUiState.leftTeam[nextIndex];
  if (!Number.isInteger(nextIndex) || !nextLead?.pokemon) return;

  draftArenaState.selectedBattlePokemonId = nextLead.pokemon.id;
  draftSimpleBattleDevUiState.leftTeam = [
    nextLead,
    ...draftSimpleBattleDevUiState.leftTeam.filter((_, index) => index !== nextIndex),
  ];
  draftSimpleBattleDevUiState.leftActiveIndex = 0;
  syncDraftSimpleBattleActiveBattlers(draftSimpleBattleDevUiState);
  draftSimpleBattleDevUiState.sceneMessage = `${nextLead.pokemon.name} sera envoyé en premier.`;
  renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
}

function getDraftSimpleBattleRemainingCount(team = [], activeIndex = 0) {
  return team.filter((member) => member && member.currentHp > 0).length;
}

function findDraftSimpleBattleNextAliveIndex(team = [], currentIndex = 0) {
  if (!Array.isArray(team) || !team.length) return -1;
  for (let index = currentIndex + 1; index < team.length; index += 1) {
    if (team[index] && team[index].currentHp > 0) return index;
  }
  for (let index = 0; index < currentIndex; index += 1) {
    if (team[index] && team[index].currentHp > 0) return index;
  }
  return -1;
}

function syncDraftSimpleBattleActiveBattlers(state) {
  if (!state) return;
  state.left = state.leftTeam[state.leftActiveIndex] || null;
  state.right = state.rightTeam[state.rightActiveIndex] || null;
}

function runDraftSimpleBattleSwitchHooks(state, side, battler, context = {}) {
  if (!state || !battler) return;
  const hooks = state.switchHooks || {};
  const hookList = Array.isArray(hooks.onSwitchIn) ? hooks.onSwitchIn : [];
  hookList.forEach((hook) => {
    if (typeof hook === "function") {
      hook({ state, side, battler, context });
    }
  });
}

function executeDraftSimpleBattleSwitch(state, side, teamIndex, options = {}) {
  if (!state) return null;
  const teamKey = side === "left" ? "leftTeam" : "rightTeam";
  const indexKey = side === "left" ? "leftActiveIndex" : "rightActiveIndex";
  const team = state[teamKey] || [];
  const nextIndex = Number(teamIndex);
  const battler = team[nextIndex];
  if (!Number.isInteger(nextIndex) || !battler || battler.currentHp <= 0 || nextIndex === state[indexKey]) {
    return null;
  }
  state[indexKey] = nextIndex;
  syncDraftSimpleBattleActiveBattlers(state);
  runDraftSimpleBattleSwitchHooks(state, side, battler, options);
  return battler;
}

function sendNextDraftSimpleBattleBattler(state, side) {
  const teamKey = side === "left" ? "leftTeam" : "rightTeam";
  const indexKey = side === "left" ? "leftActiveIndex" : "rightActiveIndex";
  const team = state?.[teamKey] || [];
  const currentIndex = Math.max(0, Number(state?.[indexKey]) || 0);
  const nextIndex = findDraftSimpleBattleNextAliveIndex(team, currentIndex);
  if (nextIndex < 0) {
    state[indexKey] = team.length;
    syncDraftSimpleBattleActiveBattlers(state);
    return null;
  }
  return executeDraftSimpleBattleSwitch(state, side, nextIndex, {
    reason: "forced-ko",
    forced: true,
  });
}

function getDraftSimpleBattleNetworkMeta(state) {
  if (!state?.network) {
    state.network = {
      enabled: false,
      roomCode: "",
      localSide: "left",
      isHost: false,
      players: [],
      pendingTurn: null,
      pendingReplacement: null,
      waitingRemote: false,
      resolvingTurn: null,
      submittedTurn: null,
      submittedReplacementKey: "",
      stateVersion: 0,
    };
  }
  return state.network;
}

function isDraftSimpleBattleNetworkMode(state) {
  return Boolean(state?.network?.enabled && state?.network?.roomCode);
}

function getDraftSimpleBattleNetworkLocalSide(state) {
  return state?.network?.localSide || "left";
}

function cloneDraftSimpleBattleNetworkState(state) {
  if (!state) return null;
  const snapshot = JSON.parse(JSON.stringify(state));
  delete snapshot.onFinish;
  delete snapshot.postBattleAction;
  delete snapshot.finishHandled;
  snapshot.switchHooks = { onSwitchIn: [] };
  snapshot.network = {
    enabled: Boolean(state.network?.enabled),
    roomCode: state.network?.roomCode || "",
    localSide: state.network?.localSide || "left",
    isHost: Boolean(state.network?.isHost),
    players: Array.isArray(state.network?.players) ? state.network.players : [],
    pendingTurn: state.network?.pendingTurn || null,
    pendingReplacement: state.network?.pendingReplacement || null,
    waitingRemote: Boolean(state.network?.waitingRemote),
    resolvingTurn: state.network?.resolvingTurn || null,
    submittedTurn: state.network?.submittedTurn || null,
    submittedReplacementKey: state.network?.submittedReplacementKey || "",
    stateVersion: Number(state.network?.stateVersion) || 0,
  };
  return snapshot;
}

function hydrateDraftSimpleBattleNetworkState(snapshot, networkMeta = null) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const state = JSON.parse(JSON.stringify(snapshot));
  state.onFinish = null;
  state.postBattleAction = null;
  state.finishHandled = false;
  state.switchHooks = { onSwitchIn: [] };
  state.showPreview = Boolean(state.showPreview);
  state.showIntro = Boolean(state.showIntro);
  const meta = networkMeta || state.network || {};
  state.network = {
    enabled: Boolean(meta.enabled),
    roomCode: meta.roomCode || "",
    localSide: meta.localSide || "left",
    isHost: Boolean(meta.isHost),
    players: Array.isArray(meta.players) ? meta.players : [],
    pendingTurn: meta.pendingTurn || null,
    pendingReplacement: meta.pendingReplacement || null,
    waitingRemote: Boolean(meta.waitingRemote),
    resolvingTurn: meta.resolvingTurn || null,
    submittedTurn: meta.submittedTurn || null,
    submittedReplacementKey: meta.submittedReplacementKey || "",
    stateVersion: Number(meta.stateVersion) || 0,
  };
  syncDraftSimpleBattleActiveBattlers(state);
  return state;
}

function createDraftSimpleBattleDevUiState(leftEntries, rightEntries, options = {}) {
  const safeLeftEntries = Array.isArray(leftEntries) ? leftEntries.filter((entry) => entry?.pokemon) : [];
  const safeRightEntries = Array.isArray(rightEntries) ? rightEntries.filter((entry) => entry?.pokemon) : [];
  const leftLeadIndex = chooseDraftSimpleBattleOpeningIndex(safeLeftEntries, safeRightEntries);
  const rightLeadIndex = chooseDraftSimpleBattleOpeningIndex(safeRightEntries, safeLeftEntries);
  const orderedLeftEntries = safeLeftEntries[leftLeadIndex]
    ? [safeLeftEntries[leftLeadIndex], ...safeLeftEntries.filter((_, index) => index !== leftLeadIndex)]
    : safeLeftEntries;
  const orderedRightEntries = safeRightEntries[rightLeadIndex]
    ? [safeRightEntries[rightLeadIndex], ...safeRightEntries.filter((_, index) => index !== rightLeadIndex)]
    : safeRightEntries;

  const leftTeam = orderedLeftEntries.map((entry) => convertDraftPokemonToSimpleBattler(entry)).filter(Boolean);
  const rightTeam = orderedRightEntries.map((entry) => convertDraftPokemonToSimpleBattler(entry)).filter(Boolean);
  const leftPokemon = leftTeam[0]?.pokemon || null;
  const rightPokemon = rightTeam[0]?.pokemon || null;
  if (!leftPokemon || !rightPokemon) return null;

  const state = {
    gen: Number(leftPokemon.gen) || Number(rightPokemon.gen) || 1,
    phase: "ready",
    turn: 1,
    turnState: "left-action",
    pendingTurn: null,
    queuedTurn: null,
    pendingSwitch: false,
    pendingSwitchReason: null,
    pendingSwitchSide: null,
    hotseatPendingSide: null,
    leftTeam,
    rightTeam,
    leftActiveIndex: 0,
    rightActiveIndex: 0,
    left: null,
    right: null,
    log: [],
    sceneMessage: "",
    mode: options.mode || "dev",
    title: options.title || "Combat Draft",
    arena: options.arena || null,
    onFinish: typeof options.onFinish === "function" ? options.onFinish : null,
    postBattleAction: null,
    finishHandled: false,
    controllers: {
      left: options.controllers?.left || "human",
      right: options.controllers?.right || "ai",
    },
    switchHooks: {
      onSwitchIn: [],
    },
    network: {
      enabled: false,
      roomCode: "",
      localSide: "left",
      isHost: false,
      players: [],
      pendingTurn: null,
      pendingReplacement: null,
      waitingRemote: false,
      resolvingTurn: null,
      submittedTurn: null,
      submittedReplacementKey: "",
      stateVersion: 0,
    },
  };
  syncDraftSimpleBattleActiveBattlers(state);
  return state;
}

function isDraftSimpleBattleHumanControlled(state, side) {
  return (state?.controllers?.[side] || "ai") === "human";
}

function isDraftSimpleBattleLocalHotseat(state) {
  return isDraftSimpleBattleHumanControlled(state, "left") && isDraftSimpleBattleHumanControlled(state, "right");
}

function getDraftSimpleBattleCurrentActionSide(state) {
  if (state?.turnState === "right-action") return "right";
  return "left";
}

function createDraftSimpleBattlePendingTurn(state) {
  return {
    turn: Number(state?.turn) || 1,
    actions: {
      left: null,
      right: null,
    },
    required: {
      left: true,
      right: true,
    },
  };
}

function createDraftSimpleBattleSubmittedAction(side, action, options = {}) {
  return {
    side,
    source: options.source || "system",
    type: options.type || action?.kind || "move",
    action: getDraftSimpleBattleNormalizedAction(action, 0),
    submittedAtTurn: Number(options.turn) || 0,
  };
}

function getDraftSimpleBattleResolvedSubmittedAction(state, side, submitted) {
  const battler = side === "left" ? state?.left : state?.right;
  const action = getDraftSimpleBattleNormalizedAction(submitted?.action, 0);
  if (action.kind === "move" && !getDraftSimpleBattleUsableMoveIndexes(battler).length) {
    return { kind: "struggle" };
  }
  return action;
}

function isDraftSimpleBattleTurnReady(pendingTurn) {
  if (!pendingTurn) return false;
  return ["left", "right"].every((side) => !pendingTurn.required?.[side] || Boolean(pendingTurn.actions?.[side]));
}

function buildDraftSimpleBattleQueuedTurnFromPendingTurn(state) {
  if (!state?.pendingTurn || !isDraftSimpleBattleTurnReady(state.pendingTurn) || state.phase === "finished") return null;
  const leftAction = getDraftSimpleBattleResolvedSubmittedAction(state, "left", state.pendingTurn.actions.left);
  const rightAction = getDraftSimpleBattleResolvedSubmittedAction(state, "right", state.pendingTurn.actions.right);
  const queuedTurn = {
    turn: state.pendingTurn.turn,
    submissions: {
      left: state.pendingTurn.actions.left,
      right: state.pendingTurn.actions.right,
    },
    left: leftAction,
    right: rightAction,
    order: getDraftSimpleBattleTurnOrderForActions(state, leftAction, rightAction),
  };
  return queuedTurn;
}

function submitDraftSimpleBattleTurnAction(state, side, action, options = {}) {
  if (!state || state.phase === "finished" || !side) return null;
  syncDraftSimpleBattleActiveBattlers(state);
  if (!state.pendingTurn || Number(state.pendingTurn.turn) !== Number(state.turn)) {
    state.pendingTurn = createDraftSimpleBattlePendingTurn(state);
  }
  state.pendingTurn.actions[side] = createDraftSimpleBattleSubmittedAction(side, action, {
    source: options.source || "system",
    type: options.type,
    turn: state.turn,
  });
  if (isDraftSimpleBattleTurnReady(state.pendingTurn)) {
    state.queuedTurn = buildDraftSimpleBattleQueuedTurnFromPendingTurn(state);
    state.pendingTurn = null;
    return state.queuedTurn;
  }
  return null;
}

function prepareDraftSimpleBattleQueuedTurn(state, playerAction) {
  if (!state || !playerAction || state.phase === "finished") return null;
  syncDraftSimpleBattleActiveBattlers(state);
  const actingSide = getDraftSimpleBattleCurrentActionSide(state);
  const opposingSide = actingSide === "left" ? "right" : "left";
  if (isDraftSimpleBattleNetworkMode(state)) {
    return submitDraftSimpleBattleNetworkAction(state, actingSide, playerAction, { source: "player" });
  }
  submitDraftSimpleBattleTurnAction(state, actingSide, playerAction, {
    source: "player",
  });
  if (isDraftSimpleBattleHumanControlled(state, opposingSide)) {
    state.turnState = "hotseat-transition";
    state.hotseatPendingSide = opposingSide;
    state.sceneMessage = actingSide === "left"
      ? "Action gauche enregistrée. Passe au joueur droit."
      : "Action droite enregistrée. Passe au joueur gauche.";
    renderDraftSimpleBattleDevPanel(state);
    return state.pendingTurn;
  }
  const enemyAction = chooseDraftSimpleBattleEnemyAction(state);
  return submitDraftSimpleBattleTurnAction(state, opposingSide, enemyAction, {
    source: "ai",
  });
}

function continueDraftSimpleBattleHotseat() {
  const state = draftSimpleBattleDevUiState;
  if (!state || state.phase === "finished" || state.turnState !== "hotseat-transition") return null;
  const nextSide = state.hotseatPendingSide || "right";
  state.hotseatPendingSide = null;
  state.turnState = nextSide === "right" ? "right-action" : "left-action";
  if (state.pendingSwitch) {
    state.sceneMessage = nextSide === "right"
      ? "Joueur droit, choisis ton remplaçant."
      : "Joueur gauche, choisis ton remplaçant.";
  } else {
    state.sceneMessage = nextSide === "right"
      ? "Joueur droit, choisis ton action."
      : "Joueur gauche, choisis ton action.";
  }
  renderDraftSimpleBattleDevPanel(state);
  return state;
}

function ensureDraftSimpleBattleNetworkSession() {
  if (!draftBattleNetworkSession) {
    draftBattleNetworkSession = {
      room: null,
    };
  }
  return draftBattleNetworkSession;
}

function sanitizePlayerNickname(value) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, 24);
}

function buildDraftSimpleBattleNetworkMetaFromRoom(roomState, fallbackState = null) {
  const self = roomState?.players?.find?.((player) => player.isSelf) || null;
  const base = fallbackState?.network || {};
  return {
    enabled: true,
    roomCode: roomState?.code || base.roomCode || "",
    localSide: self?.side || base.localSide || "left",
    isHost: Boolean(self?.isHost || base.isHost),
    players: Array.isArray(roomState?.players) ? roomState.players : (base.players || []),
    pendingTurn: roomState?.pendingTurn || null,
    pendingReplacement: roomState?.pendingReplacement || null,
    waitingRemote: Boolean(base.waitingRemote),
    resolvingTurn: roomState?.resolvingTurn || base.resolvingTurn || null,
    submittedTurn: base.submittedTurn || null,
    submittedReplacementKey: base.submittedReplacementKey || "",
    stateVersion: Number(roomState?.version) || Number(base.stateVersion) || 0,
  };
}

function getDraftSimpleBattleCurrentNetworkActorLabel(state) {
  return getDraftSimpleBattleNetworkLocalSide(state) === "right" ? "joueur droite" : "joueur gauche";
}

function getDraftSimpleBattleNetworkOpponent(state) {
  const localSide = getDraftSimpleBattleNetworkLocalSide(state);
  return getDraftSimpleBattleNetworkMeta(state).players?.find?.((player) => player.side !== localSide) || null;
}

function isDraftSimpleBattleNetworkRoomReady(state) {
  const network = getDraftSimpleBattleNetworkMeta(state);
  const players = Array.isArray(network.players) ? network.players : [];
  return players.length >= 2 && players.every((player) => player.connected !== false);
}

function getDraftSimpleBattleNetworkRoleLabel(state) {
  return getDraftSimpleBattleNetworkMeta(state).isHost ? "Hôte" : "Invité";
}

function getDraftSimpleBattleNetworkRoomStatusText(state) {
  const network = getDraftSimpleBattleNetworkMeta(state);
  if (!network.roomCode) return "Aucune room réseau active";
  if (state?.phase === "finished") return "Combat réseau terminé";
  if (state?.showPreview) {
    return isDraftSimpleBattleNetworkRoomReady(state)
      ? "Room prête"
      : "En attente du second joueur";
  }
  if (state?.pendingSwitch) {
    return state.pendingSwitchSide === network.localSide
      ? "Ton remplacement est requis"
      : "Remplacement adverse en attente";
  }
  if (state?.turnState === "resolving" || network.resolvingTurn) return "Résolution du tour";
  if (network.waitingRemote) return "Action envoyée";
  if (getDraftSimpleBattleCurrentActionSide(state) === network.localSide) return "À toi de jouer";
  return "En attente de l’autre joueur";
}

function getDraftSimpleBattleNetworkLaunchHint(state) {
  if (isDraftSimpleBattleNetworkRoomReady(state)) {
    return getDraftSimpleBattleNetworkMeta(state).isHost
      ? "La room est complète. L’hôte peut lancer le combat."
      : "La room est complète. Attends que l’hôte lance le combat.";
  }
  return "Le combat réseau se lance dès que l’autre joueur a rejoint la room.";
}

function getDraftSimpleBattleNetworkTurnHint(state) {
  const network = getDraftSimpleBattleNetworkMeta(state);
  if (state?.phase === "finished") return "Le combat réseau est terminé.";
  if (state?.pendingSwitch) {
    return state.pendingSwitchSide === network.localSide
      ? "Choisis le Pokémon à envoyer pour continuer."
      : "L’adversaire doit choisir son remplaçant.";
  }
  if (state?.turnState === "resolving" || network.resolvingTurn) return "Les deux actions sont verrouillées. Résolution du tour en cours.";
  if (network.waitingRemote) return "Ton action est enregistrée. On attend maintenant l’autre joueur.";
  if (getDraftSimpleBattleCurrentActionSide(state) === network.localSide) return "À toi de choisir une action pour ce tour.";
  return "L’autre joueur est en train de choisir son action.";
}

function restoreDraftSimpleBattleInteractivePrompt(state) {
  if (!state || state.phase === "finished" || state.turnState === "hotseat-transition" || state.visualReplay?.active) return state;

  const isNetwork = isDraftSimpleBattleNetworkMode(state);
  const localSide = getDraftSimpleBattleNetworkLocalSide(state);
  const currentActionSide = getDraftSimpleBattleCurrentActionSide(state);
  const network = getDraftSimpleBattleNetworkMeta(state);

  if (state.pendingSwitch) {
    const switchSide = state.pendingSwitchSide || "left";
    state.sceneMessage = !isNetwork || switchSide === localSide
      ? "Choisis le Pokémon à envoyer pour reprendre le combat."
      : "En attente du choix de remplaçant de l’autre joueur.";
    return state;
  }

  if (state.turnState === "resolving" || network.resolvingTurn) {
    state.sceneMessage = "Résolution du tour en cours.";
    return state;
  }

  if (network.waitingRemote) {
    state.sceneMessage = "Action enregistrée. En attente de l’autre joueur.";
    return state;
  }

  if (!currentActionSide) return state;

  if (!isNetwork) {
    state.sceneMessage = state.actionResumeCueActive
      ? currentActionSide === "right"
        ? "Joueur droite, à toi de jouer."
        : "Joueur gauche, à toi de jouer."
      : currentActionSide === "right"
        ? "Joueur droite : choisis l’action suivante."
        : "Joueur gauche : choisis l’action suivante.";
    return state;
  }

  state.sceneMessage = currentActionSide === localSide
    ? (state.actionResumeCueActive ? "Ton tour. Choisis une action." : "À toi de jouer : choisis ton action.")
    : "L’autre joueur est en train de choisir son action.";
  return state;
}

function submitDraftSimpleBattleNetworkAction(state, side, action, options = {}) {
  const socket = ensureMultiplayerSocket();
  const network = getDraftSimpleBattleNetworkMeta(state);
  if (!socket?.connected || !network.roomCode) return null;
  if (getDraftSimpleBattleNetworkLocalSide(state) !== side) return null;
  if (network.resolvingTurn) return null;
  if (Number(network.submittedTurn) === Number(state.turn)) return null;

  syncDraftSimpleBattleActiveBattlers(state);
  if (!state.pendingTurn || Number(state.pendingTurn.turn) !== Number(state.turn)) {
    state.pendingTurn = createDraftSimpleBattlePendingTurn(state);
  }
  if (state.pendingTurn.actions[side]) return state.pendingTurn;
  state.pendingTurn.actions[side] = createDraftSimpleBattleSubmittedAction(side, action, {
    source: options.source || "player",
    type: options.type,
    turn: state.turn,
  });
  network.pendingTurn = state.pendingTurn;
  network.waitingRemote = true;
  network.submittedTurn = state.turn;
  state.sceneMessage = `${getDraftSimpleBattleCurrentNetworkActorLabel(state)} : action enregistrée. En attente de l'autre joueur.`;
  renderDraftSimpleBattleDevPanel(state);

  socket.emit("draft-battle:submit-action", {
    code: network.roomCode,
    turn: state.turn,
    submittedAction: state.pendingTurn.actions[side],
  }, (response = {}) => {
    if (!response.ok) {
      network.waitingRemote = false;
      network.submittedTurn = null;
      if (state.pendingTurn?.actions) state.pendingTurn.actions[side] = null;
      state.sceneMessage = response.error || "Action réseau refusée.";
      renderDraftSimpleBattleDevPanel(state);
    }
  });
  return state.pendingTurn;
}

function submitDraftSimpleBattleNetworkReplacement(state, side, teamIndex) {
  const socket = ensureMultiplayerSocket();
  const network = getDraftSimpleBattleNetworkMeta(state);
  if (!socket?.connected || !network.roomCode) return null;
  if (getDraftSimpleBattleNetworkLocalSide(state) !== side) return null;
  const replacementKey = `${state.turn}:${side}`;
  if (network.submittedReplacementKey === replacementKey) return null;
  network.pendingReplacement = { side, teamIndex };
  network.waitingRemote = true;
  network.submittedReplacementKey = replacementKey;
  state.sceneMessage = `${getDraftSimpleBattleCurrentNetworkActorLabel(state)} : remplaçant envoyé au serveur.`;
  renderDraftSimpleBattleDevPanel(state);
  socket.emit("draft-battle:submit-replacement", {
    code: network.roomCode,
    teamIndex,
  }, (response = {}) => {
    if (!response.ok) {
      network.waitingRemote = false;
      network.submittedReplacementKey = "";
      network.pendingReplacement = null;
      state.sceneMessage = response.error || "Remplacement réseau refusé.";
      renderDraftSimpleBattleDevPanel(state);
    }
  });
  return true;
}

function commitDraftSimpleBattleNetworkState(state) {
  const socket = ensureMultiplayerSocket();
  const network = getDraftSimpleBattleNetworkMeta(state);
  if (!socket?.connected || !network.roomCode || !network.isHost) return null;
  const snapshot = cloneDraftSimpleBattleNetworkState(state);
  socket.emit("draft-battle:commit-state", {
    code: network.roomCode,
    battleState: snapshot,
  });
  return snapshot;
}

function handleDraftSimpleBattleNetworkRoomState(roomState) {
  const session = ensureDraftSimpleBattleNetworkSession();
  session.room = roomState || null;
  if (!roomState?.battleState) return;

  const previousLogLength = draftSimpleBattleDevUiState?.log?.length || 0;
  const currentState = draftSimpleBattleDevUiState;
  if (currentState?.network?.stateVersion && Number(roomState?.version) < Number(currentState.network.stateVersion)) {
    return;
  }
  const networkMeta = buildDraftSimpleBattleNetworkMetaFromRoom(roomState, currentState);
  const nextState = hydrateDraftSimpleBattleNetworkState(roomState.battleState, networkMeta);
  if (!nextState) return;
  nextState.pendingTurn = roomState.pendingTurn === undefined ? (currentState?.pendingTurn || null) : roomState.pendingTurn;
  nextState.network.pendingTurn = nextState.pendingTurn;
  nextState.network.waitingRemote = Boolean(
    nextState.pendingTurn?.actions?.[nextState.network.localSide]
    && !nextState.pendingTurn?.actions?.[nextState.network.localSide === "left" ? "right" : "left"]
  );
  nextState.network.resolvingTurn = roomState.resolvingTurn || null;
  nextState.network.stateVersion = Number(roomState.version) || nextState.network.stateVersion || 0;
  nextState.title = roomState?.code ? `Draft Combat 1v1 • ${roomState.code}` : (nextState.title || "Draft Combat 1v1");
  draftSimpleBattleDevUiState = nextState;
  document.getElementById("draft-battle-close")?.classList.remove("hidden");
  if (!((nextState.log?.length || 0) > previousLogLength)) {
    restoreDraftSimpleBattleInteractivePrompt(nextState);
  }
  renderDraftSimpleBattleDevPanel(nextState);
  if ((nextState.log?.length || 0) > previousLogLength) {
    startDraftSimpleBattleTurnReplay(nextState, nextState.log[nextState.log.length - 1]);
  }
}

async function fetchPokedexEvolutionChainData(url) {
  if (typeof url !== "string" || !url) return null;
  if (POKEDEX_EVOLUTION_CACHE.has(url)) return POKEDEX_EVOLUTION_CACHE.get(url);
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    POKEDEX_EVOLUTION_CACHE.set(url, data);
    return data;
  } catch (_err) {
    return null;
  }
}

function formatPokedexApiLabel(value) {
  if (typeof value !== "string" || !value) return "Inconnu";
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPokedexFrenchSpeciesName(speciesRef) {
  const speciesId = speciesIdFromUrl(speciesRef?.url);
  if (Number.isInteger(speciesId)) {
    const frenchMatch = POKEMON_LIST.find((pokemon) => {
      if (pokemon?.isAltForm) return false;
      return Number(getMysteryApiId(pokemon)) === speciesId;
    });
    if (frenchMatch?.name) return frenchMatch.name;
  }
  return formatPokedexApiLabel(speciesRef?.name || "");
}

function getPokedexEvolutionMethodText(detail) {
  if (!detail || typeof detail !== "object") return "";
  if (Number.isFinite(Number(detail.min_level)) && Number(detail.min_level) > 0) return `Niveau ${Number(detail.min_level)}`;
  if (detail.item?.name) return `Pierre / objet : ${formatPokedexApiLabel(detail.item.name)}`;
  if (detail.trigger?.name === "trade") return "Échange";
  if (detail.trigger?.name === "use-item") return detail.item?.name ? `Objet : ${formatPokedexApiLabel(detail.item.name)}` : "Objet";
  if (detail.min_happiness) return "Bonheur";
  if (detail.time_of_day) return `Moment : ${formatPokedexApiLabel(detail.time_of_day)}`;
  if (detail.held_item?.name) return `Objet tenu : ${formatPokedexApiLabel(detail.held_item.name)}`;
  return detail.trigger?.name ? formatPokedexApiLabel(detail.trigger.name) : "";
}

function findPokedexEvolutionNode(chain, speciesName, parent = null) {
  if (!chain || !speciesName) return null;
  if (chain.species?.name === speciesName) {
    return { node: chain, parent };
  }
  const nextNodes = Array.isArray(chain.evolves_to) ? chain.evolves_to : [];
  for (const child of nextNodes) {
    const found = findPokedexEvolutionNode(child, speciesName, chain);
    if (found) return found;
  }
  return null;
}

async function pokedexEvolutionSummaryHtml(speciesData, pokeData) {
  const chainUrl = speciesData?.evolution_chain?.url;
  const speciesName = pokeData?.species?.name;
  if (!chainUrl || !speciesName) return "<p class=\"pokedex-muted\">Infos d’évolution non disponibles.</p>";
  const chainData = await fetchPokedexEvolutionChainData(chainUrl);
  const match = findPokedexEvolutionNode(chainData?.chain, speciesName);
  if (!match?.node) return "<p class=\"pokedex-muted\">Infos d’évolution non disponibles.</p>";

  const previousNode = match.parent || null;
  const nextNodes = Array.isArray(match.node.evolves_to) ? match.node.evolves_to : [];
  const previousDetail = Array.isArray(match.node.evolution_details) ? match.node.evolution_details[0] : null;

  const rows = [];
  if (previousNode?.species?.name) {
    rows.push(`
      <div><span>Évolue depuis</span><b>${escapeHtml(getPokedexFrenchSpeciesName(previousNode.species))}</b></div>
      <div><span>Méthode</span><b>${escapeHtml(getPokedexEvolutionMethodText(previousDetail) || "Non précisée")}</b></div>
    `);
  }

  if (nextNodes.length) {
    const nextLabels = nextNodes
      .map((node) => getPokedexFrenchSpeciesName(node?.species))
      .filter(Boolean)
      .join(" • ");
    const nextMethod = nextNodes
      .map((node) => getPokedexEvolutionMethodText(Array.isArray(node?.evolution_details) ? node.evolution_details[0] : null))
      .filter(Boolean)
      .join(" • ");
    rows.push(`
      <div><span>Évolue vers</span><b>${escapeHtml(nextLabels || "—")}</b></div>
      <div><span>Méthode</span><b>${escapeHtml(nextMethod || "Non précisée")}</b></div>
    `);
  }

  if (!rows.length) {
    return "<p class=\"pokedex-muted\">Aucune évolution liée connue pour ce Pokémon.</p>";
  }

  return `<div class="pokedex-detail-grid pokedex-extra-grid">${rows.join("")}</div>`;
}

function handleDraftSimpleBattleNetworkBattleState(payload = {}) {
  const previousLogLength = draftSimpleBattleDevUiState?.log?.length || 0;
  const roomState = ensureDraftSimpleBattleNetworkSession().room || {};
  const networkMeta = buildDraftSimpleBattleNetworkMetaFromRoom({
    ...(roomState || {}),
    code: payload.code || roomState.code,
    status: payload.status || roomState.status,
    pendingTurn: null,
    pendingReplacement: null,
    players: roomState.players || [],
  }, draftSimpleBattleDevUiState);
  const nextState = hydrateDraftSimpleBattleNetworkState(payload.battleState, networkMeta);
  if (!nextState) return;
  nextState.title = payload.code ? `Draft Combat 1v1 • ${payload.code}` : (nextState.title || "Draft Combat 1v1");
  nextState.network.waitingRemote = false;
  nextState.network.resolvingTurn = null;
  nextState.network.submittedTurn = null;
  nextState.network.submittedReplacementKey = "";
  nextState.network.stateVersion = Number(roomState.version) || nextState.network.stateVersion || 0;
  if (ensureDraftSimpleBattleNetworkSession().room) {
    ensureDraftSimpleBattleNetworkSession().room.battleState = payload.battleState;
    ensureDraftSimpleBattleNetworkSession().room.pendingTurn = null;
    ensureDraftSimpleBattleNetworkSession().room.pendingReplacement = null;
    ensureDraftSimpleBattleNetworkSession().room.resolvingTurn = null;
    ensureDraftSimpleBattleNetworkSession().room.resolvingReplacement = null;
  }
  draftSimpleBattleDevUiState = nextState;
  if (!((nextState.log?.length || 0) > previousLogLength)) {
    restoreDraftSimpleBattleInteractivePrompt(nextState);
  }
  renderDraftSimpleBattleDevPanel(nextState);
  if ((nextState.log?.length || 0) > previousLogLength) {
    startDraftSimpleBattleTurnReplay(nextState, nextState.log[nextState.log.length - 1]);
  }
}

function handleDraftSimpleBattleNetworkResolveTurn(payload = {}) {
  const state = draftSimpleBattleDevUiState;
  const network = getDraftSimpleBattleNetworkMeta(state);
  if (!state || !network.isHost || network.roomCode !== payload.code) return;
  if (Number(network.resolvingTurn) === Number(payload.turn)) return;
  network.resolvingTurn = payload.turn;
  state.pendingTurn = payload.pendingTurn || state.pendingTurn;
  state.queuedTurn = buildDraftSimpleBattleQueuedTurnFromPendingTurn(state);
  state.network.pendingTurn = state.pendingTurn;
  if (state.queuedTurn) {
    resolveDraftSimpleBattleQueuedTurn(state);
    commitDraftSimpleBattleNetworkState(state);
  }
}

function handleDraftSimpleBattleNetworkResolveReplacement(payload = {}) {
  const state = draftSimpleBattleDevUiState;
  const network = getDraftSimpleBattleNetworkMeta(state);
  const replacement = payload.replacement || null;
  if (!state || !network.isHost || network.roomCode !== payload.code || !replacement) return;
  if (network.pendingReplacement?.side === replacement.side && network.pendingReplacement?.teamIndex === replacement.teamIndex && network.waitingRemote) {
    return;
  }
  chooseDraftSimpleBattleReplacement(replacement.teamIndex, replacement.side, { bypassNetwork: true });
  commitDraftSimpleBattleNetworkState(state);
}

function handleDraftSimpleBattleNetworkRoomClosed(payload = {}) {
  draftBattleNetworkSession = null;
  if (!draftSimpleBattleDevUiState) return;
  const state = draftSimpleBattleDevUiState;
  if (state.network) {
    state.network.enabled = false;
    state.network.roomCode = "";
    state.network.waitingRemote = false;
    state.network.submittedTurn = null;
    state.network.submittedReplacementKey = "";
    state.network.resolvingTurn = null;
  }
  state.sceneMessage = payload.reason || "La room Draft Combat a été fermée.";
  renderDraftSimpleBattleDevPanel(state);
}

function scheduleDraftSimpleBattleTurnResolution(state) {
  if (!state?.queuedTurn) return null;
  state.turnState = "resolving";
  state.sceneMessage = "Actions choisies. Résolution du tour...";
  renderDraftSimpleBattleDevPanel(state);
  if (draftSimpleBattleTurnTimer) clearTimeout(draftSimpleBattleTurnTimer);
  draftSimpleBattleTurnTimer = setTimeout(() => {
    if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state) return;
    resolveDraftSimpleBattleQueuedTurn(state);
    draftSimpleBattleTurnTimer = null;
  }, 700);
  return state;
}

function resolveDraftSimpleBattleQueuedTurn(state) {
  if (!state?.queuedTurn || state.phase === "finished") return null;
  syncDraftSimpleBattleActiveBattlers(state);
  const queuedTurn = state.queuedTurn;
  const turnEntry = { turn: state.turn, order: queuedTurn.order?.slice?.() || ["left", "right"], actions: [] };
  state.log.push(turnEntry);

  for (const side of queuedTurn.order || ["left", "right"]) {
    syncDraftSimpleBattleActiveBattlers(state);
    const actingState = side === "left" ? state.left : state.right;
    const targetState = side === "left" ? state.right : state.left;
    const actingAction = side === "left" ? queuedTurn.left : queuedTurn.right;
    if (!actingAction) continue;

    if (actingAction.kind === "switch") {
      if (!canDraftSimpleBattleBattlerAct(actingState)) continue;
      const switched = executeDraftSimpleBattleSwitch(state, side, actingAction.teamIndex, {
        reason: "turn-switch",
        voluntary: true,
      });
      if (!switched) continue;
      turnEntry.actions.push({
        side,
        event: "sendout",
        pokemonName: switched.pokemon.name,
        forced: false,
      });
      state.sceneMessage = side === "left"
        ? `${switched.pokemon.name} rejoint le terrain !`
        : `L’adversaire rappelle son Pokémon et envoie ${switched.pokemon.name} !`;
      continue;
    }

    const actCheck = resolveDraftSimpleBattleCanAct(state, side, actingState);
    if (actCheck.preAction) {
      turnEntry.actions.push(actCheck.preAction);
    }
    if (!actCheck.canAct) {
      if (actCheck.action) {
        turnEntry.actions.push(actCheck.action);
        state.sceneMessage = `${actCheck.action.actorName} : ${actCheck.action.supportText}.`;
      }
      continue;
    }

    if (!canDraftSimpleBattleBattlerAct(targetState) && actingAction.kind === "move") {
      continue;
    }

    const resolvedAction = resolveDraftSimpleBattleAttack(state.gen, actingState, targetState, actingAction.moveIndex);
    if (!resolvedAction) continue;

    turnEntry.actions.push({
      side,
      actorName: actingState.pokemon.name,
      targetName: targetState.pokemon.name,
      ...resolvedAction,
    });

    if (side === "left") {
      state.sceneMessage = `${actingState.pokemon.name} lance ${resolvedAction.move?.name || "son attaque"} !`;
      if (resolvedAction.knockout && state.right.currentHp <= 0) {
        const nextOpponent = sendNextDraftSimpleBattleBattler(state, "right");
        if (nextOpponent) {
          turnEntry.actions.push({
            side: "right",
            event: "sendout",
            pokemonName: nextOpponent.pokemon.name,
            forced: true,
          });
        }
      }
    } else {
      state.sceneMessage = `${actingState.pokemon.name} utilise ${resolvedAction.move?.name || "son attaque"} !`;
      if (resolvedAction.knockout && state.left.currentHp <= 0) {
        state.pendingSwitch = getDraftSimpleBattleAvailableSwitchIndexes(state).length > 0;
        state.pendingSwitchReason = state.pendingSwitch ? "ko" : null;
      }
    }
  }

  runDraftSimpleBattleEndOfTurn(state, turnEntry);
  state.queuedTurn = null;
  state.pendingTurn = null;
  return finishDraftSimpleBattleDevTurn(state, turnEntry);
}

function getDraftSimpleBattleEffectivenessLabel(value) {
  if (value === 0) return "x0";
  if (value >= 4) return "x4";
  if (value >= 2) return "x2";
  if (value <= 0.25) return "x0.25";
  if (value <= 0.5) return "x0.5";
  return "x1";
}

function getDraftSimpleBattleEffectivenessText(value) {
  if (value === 0) return "Aucun effet";
  if (value > 1) return "Super efficace";
  if (value < 1) return "Pas très efficace";
  return "Efficace";
}

function getDraftSimpleBattleEffectivenessClass(value) {
  if (value === 0) return "is-none";
  if (value > 1) return "is-super";
  if (value < 1) return "is-low";
  return "is-neutral";
}

function getDraftSimpleBattleOrderHint(currentOrder, leftState, rightState) {
  const firstSide = currentOrder?.[0];
  if (!firstSide) return "Ordre du tour en attente.";
  const first = firstSide === "left" ? leftState : rightState;
  const second = firstSide === "left" ? rightState : leftState;
  const firstName = first?.pokemon?.name || (firstSide === "left" ? "Joueur" : "Adversaire");
  const firstSpeed = getDraftSimpleBattleCurrentSpeed(first);
  const secondSpeed = getDraftSimpleBattleCurrentSpeed(second);
  if (firstSpeed === secondSpeed) {
    return `${firstName} agit en premier à égalité de Vitesse.`;
  }
  return `${firstName} agit en premier grâce à sa Vitesse.`;
}

function getDraftSimpleBattleActionNotes(action) {
  if (action?.missed) {
    return "rate";
  }
  if (action?.preventedBy === "recharge") {
    return "recharge • ne peut pas agir";
  }
  if (action?.preventedBy === "flinched") {
    return "apeuré • ne peut pas agir";
  }
  if (action?.preventedBy === "paralysed") {
    return "paralysé • ne peut pas agir";
  }
  if (action?.preventedBy === "asleep") {
    return "endormi • ne peut pas agir";
  }
  if (action?.preventedBy === "frozen") {
    return "gelé • ne peut pas agir";
  }
  if (action?.move?.category === "status") {
    return action?.supportText || "soutien";
  }
  const notes = [];
  const category = action?.move?.category === "special" ? "attaque spéciale" : "attaque physique";
  notes.push(category);
  if (action?.usedStruggle) notes.push("Struggle");
  if (action?.critical) notes.push("coup critique");
  if (action?.fixedDamage) notes.push("dégâts fixes");
  if ((Number(action?.stab) || 1) > 1) notes.push("STAB");
  if (action?.blocked) notes.push("bloqué");
  if (action?.drain) notes.push(`drain ${action.drain}`);
  if (action?.recoil) notes.push(`recul ${action.recoil}`);
  if (action?.needsRecharge) notes.push("recharge");
  if (action?.flinchApplied) notes.push("apeure");
  if (action?.statusApplied && action?.inflictedStatus === "paralysed") notes.push("paralyse");
  if (action?.statusApplied && action?.inflictedStatus === "burned") notes.push("brûle");
  if (action?.statusApplied && action?.inflictedStatus === "poisoned") notes.push("empoisonne");
  if (action?.statusApplied && action?.inflictedStatus === "badly_poisoned") notes.push("toxique");
  if (action?.statusApplied && action?.inflictedStatus === "asleep") notes.push("endort");
  if (action?.statusApplied && action?.inflictedStatus === "frozen") notes.push("gèle");
  if (action?.effectiveness === 0) {
    notes.push("aucun effet");
  } else if ((Number(action?.effectiveness) || 1) > 1) {
    notes.push("très efficace");
  } else if ((Number(action?.effectiveness) || 1) < 1) {
    notes.push("peu efficace");
  } else {
    notes.push("efficace");
  }
  return notes.join(" • ");
}

function getDraftSimpleBattleStatusShortLabel(status) {
  return {
    paralysed: "PAR",
    burned: "BRÛLURE",
    poisoned: "POISON",
    badly_poisoned: "TOXIC",
    asleep: "SOMMEIL",
    frozen: "GEL",
  }[status] || "STATUT";
}

function buildDraftSimpleBattleActionFeedItem(action, displayLeft, displayRight) {
  if (!action) return null;
  if (action.event === "sendout") {
    return {
      kind: "switch",
      title: action.side === "left" ? "Entrée joueur" : "Entrée adverse",
      body: `${action.pokemonName || "Pokémon"} entre au combat.`,
      meta: action.forced ? "Remplacement forcé" : "Switch",
      tags: [action.forced ? "Remplacement" : "Switch"],
    };
  }

  const actor = action.actorName || (action.side === "left" ? displayLeft?.pokemon?.name : displayRight?.pokemon?.name) || "Pokémon";
  const target = action.targetName || (action.side === "left" ? displayRight?.pokemon?.name : displayLeft?.pokemon?.name) || "cible";

  if (action.residual) {
    return {
      kind: "residual",
      title: `${actor} subit la fin de tour`,
      body: `${action.supportText || "Effet résiduel"} : ${action.damage || 0} PV perdus.`,
      meta: action.knockout ? "KO" : "Fin de tour",
      tags: [getDraftSimpleBattleStatusShortLabel(action.appliedEffect), action.knockout ? "KO" : "Fin de tour"].filter(Boolean),
    };
  }

  if (!action.move) {
    return {
      kind: "info",
      title: actor,
      body: action.supportText || "Action résolue.",
      meta: "",
      tags: [],
    };
  }

  const tags = [];
  if (action.missed) tags.push("Raté");
  if (action.critical) tags.push("Critique");
  if (action.statusApplied) tags.push(getDraftSimpleBattleStatusShortLabel(action.inflictedStatus));
  if (action.knockout) tags.push("KO");
  if (action.recoil) tags.push("Recul");
  if (action.drain) tags.push("Drain");
  if (action.effectiveness === 0) tags.push("Aucun effet");
  else if ((Number(action.effectiveness) || 1) > 1) tags.push("Super efficace");
  else if ((Number(action.effectiveness) || 1) < 1) tags.push("Pas très efficace");

  if (action.move.category === "status") {
    return {
      kind: "status",
      title: `${actor} utilise ${action.move.name}`,
      body: action.statusApplied
        ? `${target} subit ${getDraftSimpleBattleStatusLabel(action.inflictedStatus) || "un statut"}.`
        : (action.statusFailedReason || action.supportText || "Effet de statut."),
      meta: action.statusApplied ? "Statut infligé" : "Aucun effet",
      tags,
    };
  }

  return {
    kind: action.missed ? "miss" : "attack",
    title: `${actor} utilise ${action.move.name}`,
    body: action.missed
      ? `${target} évite l’attaque.`
      : `${target} perd ${action.damage || 0} PV.${action.knockout ? " KO." : ""}`,
    meta: action.missed ? "Raté" : `${action.damage || 0} dégâts`,
    tags,
  };
}

function clearDraftSimpleBattleReplay(state = draftSimpleBattleDevUiState) {
  if (draftSimpleBattleReplayTimer) {
    clearTimeout(draftSimpleBattleReplayTimer);
    draftSimpleBattleReplayTimer = null;
  }
  if (draftSimpleBattleReplayFrame) {
    cancelAnimationFrame(draftSimpleBattleReplayFrame);
    draftSimpleBattleReplayFrame = null;
  }
  if (state?.visualReplay) {
    state.visualReplay.active = false;
    state.visualReplay.currentAction = null;
    state.visualReplay.phase = "";
    state.visualReplay.hpDisplay = null;
    state.visualReplay.skipRequested = false;
  }
}

function getDraftSimpleBattleReplayActionDelay(action) {
  if (!action) return 180;
  if (action.event === "sendout") return 280;
  if (action.knockout || action.selfKnockout) return 230;
  if (action.residual) return 220;
  if (action.missed) return 180;
  if (action.statusApplied || action.move?.category === "status") return 210;
  return 200;
}

function getDraftSimpleBattleReplayPhaseTiming(action) {
  if (action?.event === "sendout") {
    return {
      announce: 280,
      anticipation: 0,
      impact: 180,
      hp: 0,
      ko: 0,
      resultBuffer: 220,
    };
  }
  if (action?.knockout || action?.selfKnockout) {
    return {
      announce: 210,
      anticipation: 115,
      impact: 150,
      hp: 430,
      ko: 460,
      resultBuffer: 150,
    };
  }
  if (action?.residual) {
    return {
      announce: 180,
      anticipation: 0,
      impact: 130,
      hp: 380,
      ko: 0,
      resultBuffer: 110,
    };
  }
  if (action?.missed) {
    return {
      announce: 190,
      anticipation: 105,
      impact: 150,
      hp: 0,
      ko: 0,
      resultBuffer: 110,
    };
  }
  if (action?.statusApplied || action?.move?.category === "status") {
    return {
      announce: 200,
      anticipation: 110,
      impact: 140,
      hp: 0,
      ko: 0,
      resultBuffer: 130,
    };
  }
  return {
    announce: 200,
    anticipation: 110,
    impact: 140,
    hp: 430,
    ko: 380,
    resultBuffer: 110,
  };
}

function getDraftSimpleBattleReplayResumeCueDuration(turnEntry) {
  const actions = Array.isArray(turnEntry?.actions) ? turnEntry.actions : [];
  const lastAction = actions[actions.length - 1] || null;
  if (!lastAction) return 1000;
  if (lastAction.event === "sendout") return 1200;
  if (lastAction.knockout || lastAction.selfKnockout) return 1150;
  return 950;
}

function getDraftSimpleBattleReplayHpDuration(state, updates = [], fallbackDuration = 430) {
  const validUpdates = updates.filter((entry) => entry && Number.isFinite(entry.to));
  if (!validUpdates.length) return fallbackDuration;
  let strongestRatio = 0;
  validUpdates.forEach((entry) => {
    const side = entry.side === "right" ? "right" : "left";
    const from = Math.max(0, Number(state?.visualReplay?.hpDisplay?.[side]) || 0);
    const maxHp = Math.max(
      1,
      Number(side === "left" ? state?.left?.maxHp : state?.right?.maxHp) ||
        Number(side === "left" ? state?.left?.currentHp : state?.right?.currentHp) ||
        from ||
        1
    );
    const loss = Math.max(0, from - Math.max(0, Number(entry.to) || 0));
    strongestRatio = Math.max(strongestRatio, Math.min(1, loss / maxHp));
  });
  const minDuration = 280;
  const maxDuration = 620;
  const scaledDuration = minDuration + strongestRatio * (maxDuration - minDuration);
  return Math.max(minDuration, Math.min(maxDuration, Math.round(scaledDuration)));
}

function getDraftSimpleBattleReplayMessage(action) {
  if (!action) return "";
  if (action.event === "sendout") {
    return `${action.pokemonName || "Pokémon"} est en place.`;
  }
  const actor = action.actorName || "Pokémon";
  const target = action.targetName || "la cible";
  if (action.residual) {
    return `${actor} subit ${action.supportText || "les effets de fin de tour"}.`;
  }
  if (action.missed) {
    return `${target} évite l’attaque.`;
  }
  if (action.move?.category === "status") {
    return action.statusApplied
      ? `${target} subit ${getDraftSimpleBattleStatusLabel(action.inflictedStatus) || "un statut"}.`
      : `${action.move?.name || "La capacité"} n’a pas d’effet décisif.`;
  }
  if ((Number(action.damage) || 0) > 0) {
    let suffix = "";
    if (action.critical) suffix = " Coup critique.";
    else if ((Number(action.effectiveness) || 1) > 1) suffix = " C’est super efficace.";
    else if ((Number(action.effectiveness) || 1) > 0 && (Number(action.effectiveness) || 1) < 1) suffix = " Ce n’est pas très efficace.";
    return `${target} perd ${action.damage || 0} PV.${suffix}`;
  }
  return `${actor} termine son action.`;
}

function waitDraftSimpleBattleReplay(ms = 120) {
  const totalDuration = Math.max(0, Number(ms) || 0);
  if (!totalDuration) return Promise.resolve();
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const tick = () => {
      const state = draftSimpleBattleDevUiState;
      if (!state?.visualReplay?.active) {
        draftSimpleBattleReplayTimer = null;
        resolve();
        return;
      }
      if (state.visualReplay.skipRequested) {
        draftSimpleBattleReplayTimer = null;
        resolve();
        return;
      }
      const elapsed = performance.now() - startedAt;
      const remaining = totalDuration - elapsed;
      if (remaining <= 0) {
        draftSimpleBattleReplayTimer = null;
        resolve();
        return;
      }
      const slice = Math.min(remaining, 50);
      draftSimpleBattleReplayTimer = setTimeout(tick, slice);
    };
    if (draftSimpleBattleReplayTimer) clearTimeout(draftSimpleBattleReplayTimer);
    tick();
  });
}

function requestDraftSimpleBattleReplaySkip() {
  const state = draftSimpleBattleDevUiState;
  if (!state?.visualReplay?.active) return;
  state.visualReplay.skipRequested = true;
  renderDraftSimpleBattleDevPanel(state);
}

function triggerDraftSimpleBattleActionResumeCue(state, duration = 1400) {
  if (!state) return;
  state.actionResumeCueActive = true;
  if (draftSimpleBattleActionResumeTimer) {
    clearTimeout(draftSimpleBattleActionResumeTimer);
    draftSimpleBattleActionResumeTimer = null;
  }
  draftSimpleBattleActionResumeTimer = setTimeout(() => {
    draftSimpleBattleActionResumeTimer = null;
    if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state) return;
    state.actionResumeCueActive = false;
    renderDraftSimpleBattleDevPanel(state);
  }, duration);
}

function getDraftSimpleBattleReplayBaseHp(state, turnEntry) {
  const hp = {
    left: Math.max(0, Number(state?.left?.currentHp) || 0),
    right: Math.max(0, Number(state?.right?.currentHp) || 0),
  };
  const actions = Array.isArray(turnEntry?.actions) ? turnEntry.actions.slice().reverse() : [];
  actions.forEach((action) => {
    if (!action) return;
    const actorSide = action.side === "right" ? "right" : "left";
    const targetSide = actorSide === "left" ? "right" : "left";
    if ((Number(action.recoil) || 0) > 0) hp[actorSide] += Number(action.recoil) || 0;
    if ((Number(action.heal) || 0) > 0) hp[actorSide] -= Number(action.heal) || 0;
    if ((Number(action.drain) || 0) > 0) hp[actorSide] -= Number(action.drain) || 0;
    if ((Number(action.damage) || 0) > 0) hp[targetSide] += Number(action.damage) || 0;
  });
  return {
    left: Math.max(0, Math.min(Number(state?.left?.maxHp) || hp.left, hp.left)),
    right: Math.max(0, Math.min(Number(state?.right?.maxHp) || hp.right, hp.right)),
  };
}

function cloneDraftSimpleBattleReplayBattler(battler) {
  if (!battler) return null;
  return {
    ...battler,
    pokemon: battler.pokemon ? { ...battler.pokemon } : battler.pokemon,
    moves: Array.isArray(battler.moves) ? battler.moves.map((move) => ({ ...move })) : battler.moves,
    statusState: battler.statusState ? { ...battler.statusState } : battler.statusState,
    volatileState: battler.volatileState ? { ...battler.volatileState } : battler.volatileState,
  };
}

function getDraftSimpleBattleReplayBaseDisplayBattlers(state, turnEntry) {
  const display = {
    left: cloneDraftSimpleBattleReplayBattler(state?.left),
    right: cloneDraftSimpleBattleReplayBattler(state?.right),
  };
  const actions = Array.isArray(turnEntry?.actions) ? turnEntry.actions : [];
  actions.forEach((action, index) => {
    if (action?.event !== "sendout") return;
    const side = action.side === "right" ? "right" : "left";
    const team = side === "right" ? state?.rightTeam : state?.leftTeam;
    const previousKoAction = actions
      .slice(0, index)
      .reverse()
      .find((entry) => {
        if (!entry?.knockout) return false;
        const targetSide = entry.side === "right" ? "left" : "right";
        return targetSide === side;
      });
    const previousName = previousKoAction?.targetName || null;
    if (!previousName || !Array.isArray(team)) return;
    const previousBattler = team.find((member) => member?.pokemon?.name === previousName) || null;
    if (!previousBattler) return;
    const clone = cloneDraftSimpleBattleReplayBattler(previousBattler);
    clone.currentHp = 0;
    display[side] = clone;
  });
  return display;
}

function getDraftSimpleBattleReplayAnnouncement(action) {
  if (!action) return "";
  if (action.event === "sendout") {
    return action.side === "right"
      ? `L’adversaire envoie ${action.pokemonName || "un Pokémon"} !`
      : `${action.pokemonName || "Un Pokémon"} entre au combat !`;
  }
  const actor = action.actorName || "Pokémon";
  if (action.move?.category === "status") return `${actor} prépare ${action.move?.name || "sa capacité"} !`;
  return `${actor} utilise ${action.move?.name || "son attaque"} !`;
}

function getDraftSimpleBattleReplayImpactMessage(action) {
  if (!action || action.event === "sendout") return "";
  const actor = action.actorName || "Pokémon";
  const target = action.targetName || "la cible";
  if (action.missed) return `${target} esquive !`;
  if ((Number(action.damage) || 0) > 0) return `${target} est touché !`;
  if ((Number(action.heal) || 0) > 0 || (Number(action.drain) || 0) > 0) return `${actor} récupère de l’énergie.`;
  if (action.statusApplied) return `${target} est affecté.`;
  return "L’effet se produit.";
}

function getDraftSimpleBattleReplayKoMessage(action) {
  if (!action) return "";
  if (action.knockout) {
    return `${action.targetName || "Le Pokémon adverse"} est KO !`;
  }
  if (action.selfKnockout) {
    return `${action.actorName || "Le Pokémon"} tombe KO !`;
  }
  return "";
}

function animateDraftSimpleBattleReplayHp(state, updates = [], duration = 360) {
  const validUpdates = updates.filter((entry) => entry && Number.isFinite(entry.to));
  if (!state?.visualReplay?.active || !validUpdates.length) return Promise.resolve();
  const startValues = {};
  validUpdates.forEach((entry) => {
    const currentValue = state.visualReplay?.hpDisplay?.[entry.side];
    startValues[entry.side] = Math.max(0, Number.isFinite(currentValue) ? Number(currentValue) : 0);
  });
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const step = (now) => {
      if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state || !state.visualReplay?.active) {
        draftSimpleBattleReplayFrame = null;
        resolve();
        return;
      }
      const effectiveDuration = state.visualReplay?.skipRequested ? Math.min(duration, 90) : duration;
      const progress = Math.max(0, Math.min(1, (now - startedAt) / effectiveDuration));
      const eased = 1 - Math.pow(1 - progress, 3);
      validUpdates.forEach((entry) => {
        const from = startValues[entry.side];
        const to = Math.max(0, Number(entry.to) || 0);
        state.visualReplay.hpDisplay[entry.side] = Math.round(from + (to - from) * eased);
      });
      renderDraftSimpleBattleDevPanel(state);
      if (progress >= 1) {
        validUpdates.forEach((entry) => {
          state.visualReplay.hpDisplay[entry.side] = Math.max(0, Number(entry.to) || 0);
        });
        draftSimpleBattleReplayFrame = null;
        renderDraftSimpleBattleDevPanel(state);
        resolve();
        return;
      }
      draftSimpleBattleReplayFrame = requestAnimationFrame(step);
    };
    draftSimpleBattleReplayFrame = requestAnimationFrame(step);
  });
}

function startDraftSimpleBattleTurnReplay(state, turnEntry) {
  if (!state || !turnEntry || !Array.isArray(turnEntry.actions) || !turnEntry.actions.length) return state;
  clearDraftSimpleBattleReplay(state);
  state.visualReplay = {
    active: true,
    turn: turnEntry.turn,
    visibleCount: 0,
    phase: "announce",
    currentAction: null,
    hpDisplay: getDraftSimpleBattleReplayBaseHp(state, turnEntry),
    displayBattlers: getDraftSimpleBattleReplayBaseDisplayBattlers(state, turnEntry),
    skipRequested: false,
  };
  renderDraftSimpleBattleDevPanel(state);

  const runReplay = async () => {
    await waitDraftSimpleBattleReplay(120);
    for (let index = 0; index < turnEntry.actions.length; index += 1) {
      if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state || !state.visualReplay?.active) {
        clearDraftSimpleBattleReplay(state);
        return;
      }
      const action = turnEntry.actions[index];
      const actorSide = action?.side === "right" ? "right" : "left";
      const targetSide = actorSide === "left" ? "right" : "left";
      const phaseTiming = getDraftSimpleBattleReplayPhaseTiming(action);

      state.visualReplay.currentAction = action;
      state.visualReplay.phase = "announce";
      state.sceneMessage = getDraftSimpleBattleReplayAnnouncement(action) || state.sceneMessage;
      renderDraftSimpleBattleDevPanel(state);
      await waitDraftSimpleBattleReplay(phaseTiming.announce);

      if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state || !state.visualReplay?.active) {
        clearDraftSimpleBattleReplay(state);
        return;
      }

      if (action?.event !== "sendout") {
        state.visualReplay.phase = "anticipation";
        renderDraftSimpleBattleDevPanel(state);
        await waitDraftSimpleBattleReplay(phaseTiming.anticipation);

        if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state || !state.visualReplay?.active) {
          clearDraftSimpleBattleReplay(state);
          return;
        }
      }

      state.visualReplay.phase = "impact";
      const impactMessage = getDraftSimpleBattleReplayImpactMessage(action);
      if (impactMessage) state.sceneMessage = impactMessage;
      if (action?.event === "sendout" && state.visualReplay.displayBattlers) {
        state.visualReplay.displayBattlers[actorSide] = cloneDraftSimpleBattleReplayBattler(actorSide === "left" ? state.left : state.right);
      }
      renderDraftSimpleBattleDevPanel(state);
      await waitDraftSimpleBattleReplay(phaseTiming.impact);

      if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state || !state.visualReplay?.active) {
        clearDraftSimpleBattleReplay(state);
        return;
      }

      const hpUpdates = [];
      if ((Number(action?.damage) || 0) > 0) {
        const currentTargetHp = Math.max(0, Number(state.visualReplay.hpDisplay?.[targetSide]) || 0);
        hpUpdates.push({ side: targetSide, to: Math.max(0, currentTargetHp - (Number(action.damage) || 0)) });
      }
      if ((Number(action?.recoil) || 0) > 0) {
        const currentActorHp = Math.max(0, Number(state.visualReplay.hpDisplay?.[actorSide]) || 0);
        hpUpdates.push({ side: actorSide, to: Math.max(0, currentActorHp - (Number(action.recoil) || 0)) });
      }
      if ((Number(action?.heal) || 0) > 0 || (Number(action?.drain) || 0) > 0) {
        const gain = (Number(action?.heal) || 0) + (Number(action?.drain) || 0);
        const currentActorHp = Math.max(0, Number(state.visualReplay.hpDisplay?.[actorSide]) || 0);
        const maxActorHp = Number(actorSide === "left" ? state.left?.maxHp : state.right?.maxHp) || currentActorHp + gain;
        hpUpdates.push({ side: actorSide, to: Math.min(maxActorHp, currentActorHp + gain) });
      }
      if (hpUpdates.length) {
        state.visualReplay.phase = "hp";
        await animateDraftSimpleBattleReplayHp(
          state,
          hpUpdates,
          getDraftSimpleBattleReplayHpDuration(state, hpUpdates, phaseTiming.hp)
        );
      }

      if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state || !state.visualReplay?.active) {
        clearDraftSimpleBattleReplay(state);
        return;
      }

      if (action.knockout || action.selfKnockout) {
        state.visualReplay.phase = "ko";
        const koMessage = getDraftSimpleBattleReplayKoMessage(action);
        if (koMessage) state.sceneMessage = koMessage;
        renderDraftSimpleBattleDevPanel(state);
        await waitDraftSimpleBattleReplay(phaseTiming.ko);
      }

      if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state || !state.visualReplay?.active) {
        clearDraftSimpleBattleReplay(state);
        return;
      }

      state.visualReplay.visibleCount = index + 1;
      state.visualReplay.phase = "result";
      const replayMessage = getDraftSimpleBattleReplayMessage(action);
      if (replayMessage) state.sceneMessage = replayMessage;
      renderDraftSimpleBattleDevPanel(state);
      await waitDraftSimpleBattleReplay(getDraftSimpleBattleReplayActionDelay(action) + phaseTiming.resultBuffer);
    }

    if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState !== state || !state.visualReplay?.active) {
      clearDraftSimpleBattleReplay(state);
      return;
    }
    state.visualReplay.visibleCount = turnEntry.actions.length;
    state.visualReplay.currentAction = null;
    state.visualReplay.phase = "";
    state.visualReplay.active = false;
    state.visualReplay.hpDisplay = null;
    state.visualReplay.displayBattlers = null;
    triggerDraftSimpleBattleActionResumeCue(state, getDraftSimpleBattleReplayResumeCueDuration(turnEntry));
    restoreDraftSimpleBattleInteractivePrompt(state);
    renderDraftSimpleBattleDevPanel(state);
  };

  runReplay();
  return state;
}

function getDraftSimpleBattleWinnerName(state) {
  if (!state) return "Aucun vainqueur";
  const leftRemaining = getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex);
  const rightRemaining = getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex);
  if (leftRemaining > 0 && rightRemaining <= 0) return state.left?.pokemon?.name || state.leftTeam[state.leftTeam.length - 1]?.pokemon?.name || "Joueur";
  if (rightRemaining > 0 && leftRemaining <= 0) return state.right?.pokemon?.name || state.rightTeam[state.rightTeam.length - 1]?.pokemon?.name || "Adversaire";
  return "Aucun vainqueur";
}

function getDraftSimpleBattleTeamWinnerLabel(state) {
  if (!state) return "Aucune équipe";
  return isDraftSimpleBattlePlayerWin(state) ? "Équipe joueur" : "Équipe adverse";
}

function isDraftSimpleBattlePlayerWin(state) {
  if (!state) return false;
  const leftRemaining = getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex);
  const rightRemaining = getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex);
  return leftRemaining > 0 && rightRemaining <= 0;
}

function getDraftSimpleBattleDisplayBattler(state, side) {
  const replayBattler = state?.visualReplay?.active ? state?.visualReplay?.displayBattlers?.[side] : null;
  const team = side === "left" ? state?.leftTeam : state?.rightTeam;
  const active = side === "left" ? state?.left : state?.right;
  const activeIndex = side === "left" ? state?.leftActiveIndex : state?.rightActiveIndex;
  const sourceBattler = replayBattler || active;
  if (sourceBattler) {
    const replayHp = state?.visualReplay?.active ? state?.visualReplay?.hpDisplay?.[side] : null;
    if (Number.isFinite(replayHp)) {
      return {
        ...sourceBattler,
        currentHp: Math.max(0, Number(replayHp) || 0),
      };
    }
    return sourceBattler;
  }
  if (!Array.isArray(team) || !team.length) return null;
  const safeIndex = Math.min(Math.max(Number(activeIndex) || 0, 0), team.length - 1);
  return team[safeIndex] || team[team.length - 1] || null;
}

function replayDraftSimpleBattleDevDuel() {
  return runDraftSimpleBattleDraftConversionDevVisualTest();
}

function getDraftSimpleBattleHpPercent(sideState) {
  const maxHp = Math.max(1, Number(sideState?.maxHp) || 1);
  const currentHp = Math.max(0, Number(sideState?.currentHp) || 0);
  return Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
}

function getDraftSimpleBattleStatusText(state) {
  if (state?.phase === "finished") return "Combat terminé";
  if (state?.pendingSwitch) {
    const sideText = state.pendingSwitchSide === "right" ? "joueur droite" : "joueur gauche";
    return state.pendingSwitchReason === "manual" ? `Choisis le Pokémon à envoyer (${sideText})` : `Choisis le prochain Pokémon (${sideText})`;
  }
  if (state?.network?.waitingRemote) return "Action enregistrée • en attente de l’autre joueur";
  if (state?.pendingTurn?.actions?.left && !state?.pendingTurn?.actions?.right) return "Action gauche choisie • en attente action droite";
  if (state?.pendingTurn?.actions?.right && !state?.pendingTurn?.actions?.left) return "Action droite choisie • en attente action gauche";
  if (state?.turnState === "resolving") return "Résolution du tour...";
  if (state?.turnState === "enemy") return "L’adversaire attaque...";
  if (state?.turnState === "right-action") return "À droite de jouer";
  return "À gauche de jouer";
}

function getDraftSimpleBattleMatchupHint(gen, attackerState, defenderState) {
  if (!attackerState || !defenderState) return "Matchup en attente.";
  const attackPressure = getDraftSimpleBattleBestMoveScore(gen, attackerState, defenderState);
  const defensePressure = getDraftSimpleBattleBestMoveScore(gen, defenderState, attackerState);
  if (attackPressure >= defensePressure * 1.35) return "Matchup favorable";
  if (defensePressure >= attackPressure * 1.35) return "Matchup risqué";
  return "Matchup équilibré";
}

function getDraftSimpleBattleSceneText(state) {
  if (!state) return "";
  if (state.sceneMessage) return state.sceneMessage;
  if (state?.network?.enabled && state?.showPreview && state?.network?.roomCode) {
    return `Room ${state.network.roomCode} prête pour le 1v1 Draft Combat.`;
  }
  if (state.phase === "finished") return `${getDraftSimpleBattleTeamWinnerLabel(state)} remporte le duel.`;
  if (state.pendingSwitch) {
    const sideText = state.pendingSwitchSide === "right" ? "joueur droite" : "joueur gauche";
    return state.pendingSwitchReason === "manual"
      ? `Choisis le Pokémon à envoyer pour ${sideText}.`
      : `Un Pokémon de ${sideText} est KO. Envoie vite le suivant.`;
  }
  if (state.turnState === "enemy" && state.right?.pokemon?.name) {
    return `${state.right.pokemon.name} prépare sa réponse.`;
  }
  if (state.turnState === "resolving") {
    return "Les actions des deux camps sont verrouillées. Résolution du tour en cours.";
  }
  if (state.left?.pokemon?.name && state.right?.pokemon?.name) {
    return `${state.left.pokemon.name} fait face à ${state.right.pokemon.name}.`;
  }
  return "Le duel est prêt.";
}

function getDraftSimpleBattleVisualFeedback(state) {
  if (state?.visualReplay?.active && state.visualReplay.currentAction) {
    const action = state.visualReplay.currentAction;
    const feedback = {
      leftClass: "",
      rightClass: "",
      badges: [],
    };
    const side = action.side === "right" ? "right" : "left";
    const targetSide = side === "left" ? "right" : "left";
    const phase = state.visualReplay.phase || "";
    if (action.event === "sendout") {
      feedback[`${side}Class`] = "is-switch-in";
      feedback.badges.push(side === "left" ? "Entrée en jeu" : "Adversaire envoyé");
      return feedback;
    }
    const actorClasses = ["is-attacking"];
    const targetClasses = [];
    if (phase === "announce" || phase === "anticipation" || phase === "impact" || phase === "hp") {
      actorClasses.push("is-active-turn");
      targetClasses.push("is-waiting-turn");
    }
    if (phase === "impact" || phase === "hp" || phase === "ko") {
      targetClasses.push("is-taking-hit");
    }
    feedback[`${side}Class`] = actorClasses.join(" ");
    if (phase !== "announce") {
      if (action.knockout) {
        targetClasses.push("is-ko");
        feedback.badges.push("KO");
      } else if (action.missed) {
        targetClasses.push("is-dodged");
      } else if ((Number(action.damage) || 0) > 0) {
        targetClasses.push("is-hit");
      }
      if (action.critical) feedback.badges.push("Coup critique");
      if ((Number(action.effectiveness) || 1) > 1) feedback.badges.push("Super efficace");
      if ((Number(action.effectiveness) || 1) > 0 && (Number(action.effectiveness) || 1) < 1) feedback.badges.push("Pas très efficace");
      if (action.statusApplied) {
        const label = {
          paralysed: "Paralysie",
          burned: "Brûlure",
          poisoned: "Poison",
          badly_poisoned: "Toxic",
          asleep: "Sommeil",
          frozen: "Gel",
        }[action.inflictedStatus] || "Statut";
        feedback.badges.push(label);
      }
    }
    feedback[`${targetSide}Class`] = targetClasses.join(" ");
    return feedback;
  }

  const lastTurn = state?.log?.[state.log.length - 1];
  const actions = Array.isArray(lastTurn?.actions) ? lastTurn.actions : [];
  const feedback = {
    leftClass: "",
    rightClass: "",
    badges: [],
  };
  if (!actions.length) return feedback;

  const latestAttack = [...actions].reverse().find((action) => action?.move || action?.event === "sendout") || null;
  if (!latestAttack) return feedback;

  if (latestAttack.event === "sendout") {
    const side = latestAttack.side === "right" ? "right" : "left";
    feedback[`${side}Class`] = "is-switch-in";
    feedback.badges.push(side === "left" ? "Entrée en jeu" : "Adversaire envoyé");
    return feedback;
  }

  const actorSide = latestAttack.side === "right" ? "right" : "left";
  const targetSide = actorSide === "left" ? "right" : "left";
  feedback[`${actorSide}Class`] = "is-attacking";
  if (latestAttack.knockout) {
    feedback[`${targetSide}Class`] = "is-ko";
    feedback.badges.push("KO");
  } else if (latestAttack.damage > 0 || latestAttack.missed) {
    feedback[`${targetSide}Class`] = latestAttack.missed ? "is-dodged" : "is-hit";
  }
  if (latestAttack.critical) feedback.badges.push("Coup critique");
  if ((Number(latestAttack.effectiveness) || 1) > 1) feedback.badges.push("Super efficace");
  if ((Number(latestAttack.effectiveness) || 1) > 0 && (Number(latestAttack.effectiveness) || 1) < 1) feedback.badges.push("Pas très efficace");
  if (latestAttack.statusApplied) {
    const label = {
      paralysed: "Paralysie",
      burned: "Brûlure",
      poisoned: "Poison",
      badly_poisoned: "Toxic",
      asleep: "Sommeil",
      frozen: "Gel",
    }[latestAttack.inflictedStatus] || "Statut";
    feedback.badges.push(label);
  }
  return feedback;
}

function getDraftSimpleBattleStatusClass(state) {
  if (state?.phase === "finished") return "is-finished";
  if (state?.pendingSwitch) return "is-switch";
  if (state?.turnState === "resolving") return "is-enemy";
  if (state?.turnState === "enemy") return "is-enemy";
  return "is-player";
}

function getDraftSimpleBattleAvailableSwitchIndexes(state) {
  if (!state?.leftTeam) return [];
  const out = [];
  for (let index = 0; index < state.leftTeam.length; index += 1) {
    const member = state.leftTeam[index];
    if (!member || member.currentHp <= 0) continue;
    if (index === state.leftActiveIndex) continue;
    out.push(index);
  }
  return out;
}

function getDraftSimpleBattleAvailableEnemySwitchIndexes(state) {
  if (!state?.rightTeam) return [];
  const out = [];
  for (let index = 0; index < state.rightTeam.length; index += 1) {
    const member = state.rightTeam[index];
    if (!member || member.currentHp <= 0) continue;
    if (index === state.rightActiveIndex) continue;
    out.push(index);
  }
  return out;
}

function getDraftSimpleBattleAvailableSwitchIndexesForSide(state, side = "left") {
  return side === "right"
    ? getDraftSimpleBattleAvailableEnemySwitchIndexes(state)
    : getDraftSimpleBattleAvailableSwitchIndexes(state);
}

function getDraftSimpleBattleBestMoveScore(gen, attackerState, defenderState) {
  const moves = attackerState?.moves || [];
  let best = -Infinity;
  for (let index = 0; index < moves.length; index += 1) {
    const outcome = getDraftSimpleBattleEstimatedMoveOutcome(gen, attackerState, defenderState, moves[index]);
    const score = outcome.score;
    if (score > best) best = score;
  }
  return best > -Infinity ? best : 0;
}

function getDraftSimpleBattleBestDamagingMoveEntry(moveEntries = []) {
  return moveEntries
    .filter((entry) => !entry.isSupport)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function chooseDraftSimpleBattleEnemyAction(state) {
  const enemy = state?.right;
  const player = state?.left;
  if (!enemy || !player) {
    return { kind: "move", moveIndex: 0 };
  }

  const moveEntries = getDraftSimpleBattleUsableEnemyMoveEntries(state);
  if (!moveEntries.length) {
    return { kind: "struggle" };
  }

  const bestMove = moveEntries.slice().sort((a, b) => b.score - a.score)[0] || { index: 0, multiplier: 1, score: 0, damage: 0, knockout: false };
  const bestDamagingMove = getDraftSimpleBattleBestDamagingMoveEntry(moveEntries) || bestMove;
  const playerPressure = getDraftSimpleBattleBestMoveScore(state.gen, player, enemy);
  const enemyPressure = bestDamagingMove.score;
  const enemyHpRatio = (Number(enemy.currentHp) || 0) / Math.max(1, Number(enemy.maxHp) || 1);
  const enemySwitches = getDraftSimpleBattleAvailableEnemySwitchIndexes(state);
  const canFinishPlayer = moveEntries.filter((entry) => !entry.isSupport && entry.knockout && entry.multiplier > 0).sort((a, b) => b.score - a.score)[0];
  const supportMoves = moveEntries.filter((entry) => entry.isSupport);
  const healMove = supportMoves.find((entry) => entry.effect?.kind === "heal") || null;
  const protectMove = supportMoves.find((entry) => entry.effect?.kind === "protect") || null;
  const boostMove = supportMoves
    .filter((entry) => entry.effect?.kind === "buff" || entry.effect?.kind === "buff-multi")
    .sort((a, b) => b.score - a.score)[0] || null;
  const debuffMove = supportMoves.find((entry) => entry.effect?.kind === "debuff") || null;

  if (canFinishPlayer) {
    return { kind: "move", moveIndex: canFinishPlayer.index };
  }

  if (
    healMove &&
    enemyHpRatio <= 0.42 &&
    playerPressure < Math.max(enemy.currentHp, Math.round(enemy.maxHp * 0.55))
  ) {
    return { kind: "move", moveIndex: healMove.index };
  }

  if (
    protectMove &&
    enemyHpRatio <= 0.34 &&
    playerPressure >= Math.max(26, enemy.currentHp * 0.75)
  ) {
    return { kind: "move", moveIndex: protectMove.index };
  }

  // Very light switch logic:
  // - switch only if the current matchup is clearly bad
  // - or if all available attacks are terrible / ineffective
  // - keep switching rare and easy to reason about
  if (enemySwitches.length) {
    const allMovesBad = moveEntries.length && moveEntries.filter((entry) => !entry.isSupport).every((entry) => entry.multiplier <= 0.5);
    const noUsefulMove = moveEntries.length && moveEntries.filter((entry) => !entry.isSupport).every((entry) => entry.multiplier === 0);
    const threatenedNow = playerPressure >= Math.max(45, enemy.currentHp + 20);
    const badMatchup = playerPressure >= enemyPressure * 1.55 && enemyHpRatio <= 0.68;

    if (noUsefulMove || allMovesBad || badMatchup || threatenedNow) {
      const switchCandidates = enemySwitches
        .map((teamIndex) => {
          const battler = state.rightTeam[teamIndex];
          const playerBestIntoCandidate = getDraftSimpleBattleBestMoveScore(state.gen, player, battler);
          return {
            teamIndex,
            battler,
            pressure: getDraftSimpleBattleBestMoveScore(state.gen, battler, player),
            defense: playerBestIntoCandidate,
          };
        })
        .sort((a, b) => (b.pressure - b.defense) - (a.pressure - a.defense));

      if (switchCandidates[0] && switchCandidates[0].pressure > enemyPressure && switchCandidates[0].defense < playerPressure) {
        return { kind: "switch", teamIndex: switchCandidates[0].teamIndex };
      }
    }
  }

  if (
    boostMove &&
    enemyHpRatio >= 0.62 &&
    enemyPressure >= playerPressure * 0.82 &&
    bestDamagingMove &&
    !bestDamagingMove.knockout
  ) {
    return { kind: "move", moveIndex: boostMove.index };
  }

  if (
    debuffMove &&
    enemyHpRatio >= 0.5 &&
    playerPressure > enemyPressure * 1.2 &&
    !bestDamagingMove.knockout
  ) {
    return { kind: "move", moveIndex: debuffMove.index };
  }

  const superEffective = moveEntries.filter((entry) => !entry.isSupport && entry.multiplier > 1).sort((a, b) => b.score - a.score);
  if (superEffective[0]) {
    return { kind: "move", moveIndex: superEffective[0].index };
  }

  const neutral = moveEntries.filter((entry) => !entry.isSupport && entry.multiplier === 1).sort((a, b) => b.power - a.power);
  if (neutral[0]) {
    return { kind: "move", moveIndex: neutral[0].index };
  }

  const resisted = moveEntries.filter((entry) => !entry.isSupport && entry.multiplier > 0 && entry.multiplier < 1).sort((a, b) => b.score - a.score);
  if (resisted[0]) {
    return { kind: "move", moveIndex: resisted[0].index };
  }

  return { kind: "move", moveIndex: bestDamagingMove.index || bestMove.index || 0 };
}

function renderDraftSimpleBattlePreviewTeam(team = [], sideLabel = "Équipe", sideClass = "", options = {}) {
  const items = team.map((member, index) => {
    if (!member?.pokemon) return "";
    const isSelectable = Boolean(options.selectable);
    const isSelected = Boolean(options.selectedIndex === index);
    const elementTag = isSelectable ? "button" : "div";
    const actionAttrs = isSelectable
      ? `type="button" onclick="selectDraftSimpleBattlePreviewLead(${index})" aria-label="Choisir ${escapeHtml(member.pokemon.name)} comme Pokémon de départ"`
      : "";
    return `
      <${elementTag} class="draft-dev-battle-preview-member ${sideClass}${isSelected ? " is-selected" : ""}${isSelectable ? " is-selectable" : ""}" ${actionAttrs}>
        <img src="${escapeHtml(getPokemonSprite(member.pokemon))}" alt="${escapeHtml(member.pokemon.name)}">
        <div>
          <b>${escapeHtml(member.pokemon.name)}</b>
          <small>${isSelectable && isSelected ? "Lead sélectionné" : `Slot ${index + 1}`} • PV ${member.maxHp} • Vitesse ${member.speed}</small>
        </div>
      </${elementTag}>
    `;
  }).join("");

  return `
    <div class="draft-summary-card draft-dev-battle-preview-team ${sideClass}">
      <span>${escapeHtml(sideLabel)}</span>
      <div class="draft-dev-battle-preview-list">${items}</div>
    </div>
  `;
}

function renderDraftSimpleBattleBench(team = [], activeIndex = 0, sideLabel = "Équipe") {
  const items = team.map((member, index) => {
    if (!member?.pokemon) return "";
    const stateClass = member.currentHp <= 0 ? "is-ko" : index === activeIndex ? "is-active" : "is-ready";
    const statusShort = getDraftSimpleBattleStatusShortLabel(member.status);
    const stateLabel = member.currentHp <= 0
      ? "KO"
      : index === activeIndex
        ? `${statusShort ? `${statusShort} • ` : ""}Actif`
        : `${member.currentHp}/${member.maxHp} PV${statusShort ? ` • ${statusShort}` : ""}`;
    return `
      <div class="draft-dev-battle-bench-item ${stateClass}">
        <img src="${escapeHtml(getPokemonSprite(member.pokemon))}" alt="${escapeHtml(member.pokemon.name)}">
        <div>
          <b>${escapeHtml(member.pokemon.name)}</b>
          <small>${escapeHtml(stateLabel)}</small>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="draft-summary-card draft-dev-battle-bench">
      <span>${escapeHtml(sideLabel)}</span>
      <div class="draft-dev-battle-bench-list">${items}</div>
    </div>
  `;
}

function ensureDraftSimpleBattleDevPanel() {
  let panel = document.getElementById("draft-dev-battle-panel");
  if (panel) {
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    return panel;
  }

  panel = document.createElement("section");
  panel.id = "draft-dev-battle-panel";
  panel.className = "draft-panel draft-dev-battle-panel hidden";
  panel.innerHTML = `
    <div class="draft-dev-battle-head">
      <h3>Dev Battle Foundation</h3>
      <button type="button" class="btn-ghost" onclick="clearDraftSimpleBattleDevPanel()">Fermer</button>
    </div>
    <div id="draft-dev-battle-body"></div>
  `;
  document.body.appendChild(panel);
  return panel;
}

function scrollToDraftSimpleBattlePanel(panel) {
  if (!panel) return;
  if (draftSimpleBattleAutoScrollFrame) {
    cancelAnimationFrame(draftSimpleBattleAutoScrollFrame);
  }
  draftSimpleBattleAutoScrollFrame = requestAnimationFrame(() => {
    draftSimpleBattleAutoScrollFrame = null;
    if (!panel.isConnected || panel.classList.contains("hidden")) return;
    panel.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  });
}

function renderDraftSimpleBattleDevPanel(state) {
  const panel = ensureDraftSimpleBattleDevPanel();
  const body = document.getElementById("draft-dev-battle-body");
  if (!panel || !body || !state) return;
  const shouldAutoScroll = panel.classList.contains("hidden");
  document.body.classList.add("draft-battle-open");
  const heading = panel.querySelector(".draft-dev-battle-head h3");
  if (heading) heading.textContent = state.title || "Combat Draft";
  panel.className = `draft-panel draft-dev-battle-panel ${state.arena ? getDraftArenaThemeClass(state.arena) : "theme-neutral"}`;
  panel.style.setProperty("--draft-arena-image", state.arena ? `url("${getDraftArenaTypeImageUrl(state.arena)}")` : "none");

  if (state.showPreview) {
    const network = getDraftSimpleBattleNetworkMeta(state);
    const isNetwork = isDraftSimpleBattleNetworkMode(state);
    const roomReady = isDraftSimpleBattleNetworkRoomReady(state);
    const opponent = getDraftSimpleBattleNetworkOpponent(state);
    const roomStatusText = getDraftSimpleBattleNetworkRoomStatusText(state);
    const launchHint = getDraftSimpleBattleNetworkLaunchHint(state);
    const previewLeft = state.leftTeam[0] || null;
    const previewRight = state.rightTeam[0] || null;
    const previewHint = previewLeft && previewRight
      ? getDraftSimpleBattleMatchupHint(state.gen, previewLeft, previewRight)
      : "Lead à confirmer";
    const previewPlayer = previewLeft ? {
      currentHp: previewLeft.maxHp,
      maxHp: previewLeft.maxHp,
      speed: previewLeft.speed,
      pokemon: previewLeft.pokemon,
    } : null;
    const previewEnemy = previewRight ? {
      currentHp: previewRight.maxHp,
      maxHp: previewRight.maxHp,
      speed: previewRight.speed,
      pokemon: previewRight.pokemon,
    } : null;
    body.innerHTML = `
      <div class="draft-dev-battle-arena-banner is-live">
        <div class="draft-dev-battle-arena-badge">${state.arena ? getDraftBadgeMarkup(state.arena, "preview") : ""}</div>
        <div>
          <b>${escapeHtml(state.arena ? `Arène ${state.arena.name}` : "Préparation du duel")}</b>
          <span>${escapeHtml(state.arena ? getDraftArenaPreviewHint(state.arena) : "Choisis ton lead puis lance le duel.")}</span>
        </div>
      </div>
      <div class="draft-dev-battle-scene-note is-preview">
        <b>Préparation</b>
        <span>${escapeHtml(previewLeft?.pokemon?.name || "Ton lead")} vs ${escapeHtml(previewRight?.pokemon?.name || "Lead adverse")} • ${escapeHtml(previewHint)}</span>
      </div>
      ${isNetwork ? `
        <div class="draft-dev-battle-network-card">
          <div class="draft-dev-battle-network-head">
            <b>Room réseau</b>
            <span class="draft-dev-battle-network-role">${escapeHtml(getDraftSimpleBattleNetworkRoleLabel(state))}</span>
          </div>
          <div class="draft-dev-battle-network-grid">
            <div class="draft-dev-battle-network-item">
              <span>Code room</span>
              <b>${escapeHtml(network.roomCode || "—")}</b>
            </div>
            <div class="draft-dev-battle-network-item">
              <span>État</span>
              <b>${escapeHtml(roomStatusText)}</b>
            </div>
            <div class="draft-dev-battle-network-item">
              <span>Autre joueur</span>
              <b>${escapeHtml(opponent?.nickname || "Absent")}</b>
            </div>
            <div class="draft-dev-battle-network-item">
              <span>Connexion</span>
              <b>${escapeHtml(opponent?.connected === false || !opponent ? "En attente" : "Connecté")}</b>
            </div>
          </div>
          <small>${escapeHtml(launchHint)}</small>
        </div>
      ` : ""}
      <div class="draft-dev-battle-fighters draft-dev-battle-fighters-preview">
        <div class="draft-summary-card wide draft-dev-battle-fighter is-player">
          <div class="draft-dev-battle-fighter-head">
            <img src="${escapeHtml(getPokemonSprite(previewPlayer?.pokemon || {}))}" alt="${escapeHtml(previewPlayer?.pokemon?.name || "Pokémon joueur")}">
            <div>
              <span>Joueur</span>
              <b>${escapeHtml(previewPlayer?.pokemon?.name || "Lead à choisir")}</b>
              <small>${previewPlayer ? `PV ${previewPlayer.maxHp} • Vitesse ${previewPlayer.speed}` : "Choisis ton Pokémon de départ"}</small>
              ${previewPlayer ? `
                <div class="draft-dev-battle-hp">
                  <div class="draft-dev-battle-hp-meta">
                    <strong>PV</strong>
                    <span>${previewPlayer.maxHp} / ${previewPlayer.maxHp}</span>
                  </div>
                  <div class="draft-dev-battle-hp-track">
                    <span class="draft-dev-battle-hp-fill" style="width:100%"></span>
                  </div>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
        <div class="draft-summary-card wide draft-dev-battle-fighter is-foe">
          <div class="draft-dev-battle-fighter-head">
            <img src="${escapeHtml(getPokemonSprite(previewEnemy?.pokemon || {}))}" alt="${escapeHtml(previewEnemy?.pokemon?.name || "Pokémon adverse")}">
            <div>
              <span>Adversaire</span>
              <b>${escapeHtml(previewEnemy?.pokemon?.name || "Lead adverse")}</b>
              <small>${previewEnemy ? `PV ${previewEnemy.maxHp} • Vitesse ${previewEnemy.speed}` : "Lead adverse à venir"}</small>
              ${previewEnemy ? `
                <div class="draft-dev-battle-hp">
                  <div class="draft-dev-battle-hp-meta">
                    <strong>PV</strong>
                    <span>${previewEnemy.maxHp} / ${previewEnemy.maxHp}</span>
                  </div>
                  <div class="draft-dev-battle-hp-track">
                    <span class="draft-dev-battle-hp-fill" style="width:100%"></span>
                  </div>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      </div>
      <div class="draft-dev-battle-benches">
        ${renderDraftSimpleBattlePreviewTeam(state.leftTeam, "Équipe joueur", "is-player", { selectable: true, selectedIndex: state.leftActiveIndex || 0 })}
        ${renderDraftSimpleBattlePreviewTeam(state.rightTeam, state.arena?.name ? `Équipe de ${state.arena.name}` : "Équipe adverse", "is-foe")}
      </div>
      <div class="draft-dev-battle-meta">
        <div class="draft-summary-card draft-dev-battle-status is-player"><span>Statut</span><b>${escapeHtml(previewLeft ? "Lead verrouillé" : "Lead à choisir")}</b></div>
        <div class="draft-summary-card"><span>Ordre pressenti</span><b>${escapeHtml(previewLeft?.pokemon?.name || "Ton lead")} -> ${escapeHtml(previewRight?.pokemon?.name || "Adversaire")}</b><small>${escapeHtml(previewHint)}</small></div>
        <div class="draft-summary-card"><span>Équipe joueur</span><b>${state.leftTeam.length} Pokémon</b></div>
        <div class="draft-summary-card"><span>Équipe adverse</span><b>${state.rightTeam.length} Pokémon</b></div>
      </div>
      <div class="draft-dev-battle-actions draft-dev-battle-preview-actions">
        <button type="button" class="btn-red draft-dev-battle-preview-cta" onclick="startDraftSimpleBattlePreview()" ${isNetwork && (!network.isHost || !roomReady) ? "disabled" : ""}>${isNetwork ? "Lancer le combat réseau" : "Commencer le duel"}</button>
        <button type="button" class="btn-blue" onclick="runDraftSimpleBattleLocalPvpTest()">Mode local 1v1</button>
        <button type="button" class="btn-blue" onclick="hostDraftSimpleBattleNetworkRoom()">${isNetwork ? `Room ${escapeHtml(network.roomCode || "réseau")}` : "Créer room 1v1"}</button>
        <button type="button" class="btn-ghost" onclick="joinDraftSimpleBattleNetworkRoom()">Rejoindre room</button>
        <button type="button" class="btn-ghost" onclick="clearDraftSimpleBattleDevPanel()">Retour au Draft</button>
      </div>
      <div class="draft-dev-battle-log"><p class="card-desc">${escapeHtml(isNetwork
        ? (!network.roomCode
          ? "Crée une room ou rejoins-en une pour activer le 1v1 réseau."
          : launchHint)
        : "Clique un Pokémon dans le banc joueur pour choisir ton lead, puis lance le duel.")}</p></div>
    `;
    panel.classList.remove("hidden");
    return;
  }

  if (state.showIntro) {
    const introLeft = getDraftSimpleBattleDisplayBattler(state, "left");
    const introRight = getDraftSimpleBattleDisplayBattler(state, "right");
    if (!introLeft || !introRight) return;
    body.innerHTML = `
      <div class="draft-dev-battle-arena-banner is-intro">
        <div class="draft-dev-battle-arena-badge">${state.arena ? getDraftBadgeMarkup(state.arena, "intro") : ""}</div>
        <div>
          <b>${escapeHtml(state.arena ? `Arène ${state.arena.name}` : "Début du duel")}</b>
          <span>${escapeHtml(state.arena ? `${state.arena.name} t’attend avec une équipe ${state.arena.type}.` : "Le duel commence.")}</span>
        </div>
      </div>
      <div class="draft-dev-battle-intro">
        <div class="draft-summary-card draft-dev-battle-intro-side is-player">
          <span>Joueur</span>
          <img src="${escapeHtml(getPokemonSprite(introLeft.pokemon))}" alt="${escapeHtml(introLeft.pokemon.name)}">
          <b>${escapeHtml(introLeft.pokemon.name)}</b>
        </div>
        <div class="draft-dev-battle-intro-vs">VS</div>
        <div class="draft-summary-card draft-dev-battle-intro-side is-foe">
          <span>Adversaire</span>
          <img src="${escapeHtml(getPokemonSprite(introRight.pokemon))}" alt="${escapeHtml(introRight.pokemon.name)}">
          <b>${escapeHtml(introRight.pokemon.name)}</b>
        </div>
      </div>
    `;
    panel.classList.remove("hidden");
    return;
  }

  if (state.turnState === "hotseat-transition") {
    body.innerHTML = `
      <div class="draft-dev-battle-arena-banner is-live">
        <div class="draft-dev-battle-arena-badge">${state.arena ? getDraftBadgeMarkup(state.arena, "live") : ""}</div>
        <div>
          <b>${escapeHtml(state.title || "Combat Draft")}</b>
          <span>${escapeHtml(state.pendingSwitch
            ? "Passation du navigateur pour le choix du remplaçant."
            : "Passation du navigateur pour le choix de l’action suivante.")}</span>
        </div>
      </div>
      <div class="draft-dev-battle-scene-note is-preview">
        <b>Action enregistrée</b>
        <span>${escapeHtml(state.sceneMessage || "Passe l’écran au joueur suivant.")}</span>
      </div>
      <div class="draft-dev-battle-result">
        <b>${escapeHtml(state.hotseatPendingSide === "right" ? "Joueur droite en attente" : "Joueur gauche en attente")}</b>
        <span>${escapeHtml(state.pendingSwitch
          ? "Le joueur suivant va choisir le Pokémon à envoyer."
          : "Le joueur suivant va choisir son action sans voir celle de l’autre.")}</span>
      </div>
      <div class="draft-dev-battle-actions draft-dev-battle-preview-actions">
        <button type="button" class="btn-red draft-dev-battle-preview-cta" onclick="continueDraftSimpleBattleHotseat()">Passer au joueur suivant</button>
      </div>
    `;
    panel.classList.remove("hidden");
    return;
  }

  syncDraftSimpleBattleActiveBattlers(state);
  const displayLeft = getDraftSimpleBattleDisplayBattler(state, "left");
  const displayRight = getDraftSimpleBattleDisplayBattler(state, "right");
  if (!displayLeft || !displayRight) return;
  const lastTurn = state.log[state.log.length - 1] || null;
  const currentOrder = lastTurn?.order || getDraftSimpleBattleTurnOrder(displayLeft, displayRight);
  const orderLabel = currentOrder
    .map((side) => (side === "left" ? displayLeft.pokemon.name : displayRight.pokemon.name))
    .join(" -> ");
  const orderHint = getDraftSimpleBattleOrderHint(currentOrder, displayLeft, displayRight);
  const winner = getDraftSimpleBattleWinnerName(state);
  const leftHpPercent = getDraftSimpleBattleHpPercent(displayLeft);
  const rightHpPercent = getDraftSimpleBattleHpPercent(displayRight);
  const network = getDraftSimpleBattleNetworkMeta(state);
  const isNetwork = isDraftSimpleBattleNetworkMode(state);
  const localSide = getDraftSimpleBattleNetworkLocalSide(state);
  const networkOpponent = getDraftSimpleBattleNetworkOpponent(state);
  const networkTurnHint = getDraftSimpleBattleNetworkTurnHint(state);
  const visualFeedback = getDraftSimpleBattleVisualFeedback(state);
  const statusText = getDraftSimpleBattleStatusText(state);
  const statusClass = getDraftSimpleBattleStatusClass(state);
  const leftStatusLabel = getDraftSimpleBattleStatusLabel(displayLeft.status);
  const rightStatusLabel = getDraftSimpleBattleStatusLabel(displayRight.status);
  const isFinished = state.phase === "finished";
  panel.classList.toggle("is-finished-combat", isFinished);
  body.classList.toggle("is-finished-combat", isFinished);
  const needsForcedSwitch = !isFinished && state.pendingSwitch;
  const isEnemyTurn = !isFinished && !needsForcedSwitch && state.turnState === "enemy";
  const isPlayerTurn = !isFinished && !needsForcedSwitch && !isEnemyTurn;
  const isReplayingTurn = Boolean(state.visualReplay?.active);
  const currentActionSide = getDraftSimpleBattleCurrentActionSide(state);
  const currentActionBattler = currentActionSide === "right" ? displayRight : displayLeft;
  const currentActionTarget = currentActionSide === "right" ? displayLeft : displayRight;
  const canLocalChooseAction = isPlayerTurn && !isReplayingTurn && (!isNetwork || currentActionSide === localSide) && !network.waitingRemote;
  const showActionResumeCue = Boolean(state.actionResumeCueActive && canLocalChooseAction);
  const canLocalChooseReplacement = needsForcedSwitch && (!isNetwork || (state.pendingSwitchSide || "left") === localSide);

  const actionsHtml = state.log.map((entry) => {
    const maxVisible = state.visualReplay?.active && Number(state.visualReplay.turn) === Number(entry.turn)
      ? Math.max(0, Number(state.visualReplay.visibleCount) || 0)
      : (entry.actions || []).length;
    const cards = (entry.actions || []).slice(0, maxVisible).map((action) => {
      const item = buildDraftSimpleBattleActionFeedItem(action, displayLeft, displayRight);
      if (!item) return "";
      return `
        <article class="draft-dev-battle-feed-item is-${escapeHtml(item.kind || "info")}">
          <div class="draft-dev-battle-feed-head">
            <strong>${escapeHtml(item.title)}</strong>
            ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
          </div>
          <p>${escapeHtml(item.body)}</p>
          ${item.tags?.length ? `<div class="draft-dev-battle-feed-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </article>
      `;
    }).join("");
    return `
      <div class="draft-dev-battle-turn">
        <div class="draft-dev-battle-turn-head">
          <strong>Tour ${entry.turn}</strong>
          <span>${escapeHtml((entry.order || []).map((side) => side === "left" ? "Gauche" : "Droite").join(" → ") || "Ordre en attente")}</span>
        </div>
        <div class="draft-dev-battle-feed-list">${cards || (state.visualReplay?.active && Number(state.visualReplay.turn) === Number(entry.turn) ? '<p class="card-desc">Résolution du tour...</p>' : '<p class="card-desc">Aucune action.</p>')}</div>
      </div>
    `;
  }).join("");

  const movesHtml = (currentActionBattler.moves || []).map((move, index) => {
    const moveEffectiveness = getDraftSimpleBattleTypeMultiplier(state.gen, move?.type, currentActionTarget);
    const moveEffectivenessText = move?.category === "status"
      ? (move?.effect?.label || "Soutien")
      : getDraftSimpleBattleEffectivenessText(moveEffectiveness);
    const moveEffectivenessClass = move?.category === "status"
      ? "is-neutral"
      : getDraftSimpleBattleEffectivenessClass(moveEffectiveness);
    return `
    <button
      type="button"
      class="btn-blue draft-dev-battle-move"
      onclick="runDraftSimpleBattleDevTurn(${index}, '${currentActionSide}')"
      ${(state.phase === "finished" || !canLocalChooseAction || (Number(move?.ppCurrent) || 0) <= 0) ? "disabled" : ""}
    >
      <span class="draft-dev-battle-move-name">${escapeHtml(move.name)}</span>
      <span class="draft-dev-battle-move-meta">
        <small class="draft-dev-battle-move-type">${escapeHtml(move.type)}</small>
        ${Number(move.power) ? `<small class="draft-dev-battle-move-power">Puissance ${move.power}</small>` : ""}
        <small class="draft-dev-battle-move-power">PP ${Number(move?.ppCurrent) || 0}/${Number(move?.ppMax) || 0}</small>
      </span>
      <span class="draft-dev-battle-move-effect ${moveEffectivenessClass}">${escapeHtml(moveEffectivenessText)}</span>
    </button>
  `;
  }).join("");
  const struggleOnly = !getDraftSimpleBattleUsableMoveIndexes(currentActionBattler).length;
  const struggleHtml = struggleOnly
    ? `<button type="button" class="btn-blue draft-dev-battle-move" onclick="runDraftSimpleBattleDevStruggle('${currentActionSide}')" ${state.phase === "finished" || !canLocalChooseAction ? "disabled" : ""}>
        <span class="draft-dev-battle-move-name">Struggle</span>
        <span class="draft-dev-battle-move-meta">
          <small class="draft-dev-battle-move-type">Normal</small>
          <small class="draft-dev-battle-move-power">PP forcé</small>
        </span>
        <span class="draft-dev-battle-move-effect is-low">Frappe avec recul</span>
      </button>`
    : "";

  const playerWin = isDraftSimpleBattlePlayerWin(state);
  const leftRemaining = getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex);
  const rightRemaining = getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex);
  const sceneText = getDraftSimpleBattleSceneText(state);
  const resultHtml = isFinished
    ? `<div class="draft-dev-battle-result is-finished ${playerWin ? "is-win" : "is-loss"}">
        <b>${playerWin ? "Victoire !" : "Défaite"}</b>
        <span>${playerWin ? "Ton équipe remporte le duel avec brio." : "Le duel t’échappe cette fois."}</span>
        <span>${escapeHtml(winner)} termine le match pour ${playerWin ? "ton équipe" : "l’adversaire"}.</span>
        <span>${escapeHtml(getDraftSimpleBattleTeamWinnerLabel(state))} • Dernier Pokémon debout : ${escapeHtml(winner)}</span>
        <span>Résumé : ${state.log.length} tours • ${leftRemaining} survivant(s) côté joueur • ${rightRemaining} survivant(s) côté adverse.</span>
        <div class="draft-dev-battle-result-actions">
          <button type="button" class="btn-blue" onclick="${escapeHtml(state.mode === "arena-run" && state.postBattleAction?.action ? state.postBattleAction.action : "replayDraftSimpleBattleDevDuel")}()">${escapeHtml(state.mode === "arena-run" && state.postBattleAction?.label ? state.postBattleAction.label : "Rejouer")}</button>
          <button type="button" class="btn-ghost" onclick="clearDraftSimpleBattleDevPanel()">Retour au Draft</button>
        </div>
      </div>`
    : isEnemyTurn
      ? `<div class="draft-dev-battle-result"><b>Duel en cours</b><span>L’adversaire prépare sa réponse.</span></div>`
      : isPlayerTurn
        ? `<div class="draft-dev-battle-result"><b>${escapeHtml(isNetwork ? getDraftSimpleBattleNetworkRoomStatusText(state) : "Duel en cours")}</b><span>${escapeHtml(isNetwork ? networkTurnHint : (canLocalChooseAction ? "Choisis une attaque pour jouer le prochain tour." : "Action adverse en attente ou déjà verrouillée."))}</span></div>`
        : "";

  const switchHtml = needsForcedSwitch
    ? `
      <div class="draft-dev-battle-switch">
        <b>${state.pendingSwitchReason === "manual"
          ? `Choisis le Pokémon à envoyer (${state.pendingSwitchSide === "right" ? "droite" : "gauche"}) :`
          : `Le Pokémon ${state.pendingSwitchSide === "right" ? "droit" : "gauche"} est KO. Choisis le suivant :`}</b>
        ${isNetwork ? `<span class="draft-dev-battle-switch-note">${escapeHtml((state.pendingSwitchSide || "left") === localSide ? "Ton remplacement est requis pour continuer." : "On attend le remplacement de l’autre joueur.")}</span>` : ""}
        <div class="draft-dev-battle-switch-options">
          ${getDraftSimpleBattleAvailableSwitchIndexesForSide(state, state.pendingSwitchSide || "left").map((index) => {
            const member = (state.pendingSwitchSide === "right" ? state.rightTeam : state.leftTeam)[index];
            return `
              <button type="button" class="btn-ghost draft-dev-battle-switch-btn" onclick="chooseDraftSimpleBattleReplacement(${index}, '${state.pendingSwitchSide || "left"}')" ${!canLocalChooseReplacement ? "disabled" : ""}>
                <span>${escapeHtml(member.pokemon.name)}</span>
                <small>PV ${member.currentHp} / ${member.maxHp}</small>
              </button>
            `;
          }).join("")}
        </div>
        ${state.pendingSwitchReason === "manual"
          ? `<div class="draft-dev-battle-switch-cancel"><button type="button" class="btn-ghost" onclick="cancelDraftSimpleBattleManualSwitch()">Annuler</button></div>`
          : ""}
      </div>
    `
    : "";

  const playerHudHtml = `
    <div class="draft-dev-battle-fighter-head">
      <div>
        <span>Joueur</span>
        <b>${escapeHtml(displayLeft.pokemon.name)}</b>
        <small>PV ${displayLeft.currentHp} / ${displayLeft.maxHp} • Vitesse ${getDraftSimpleBattleCurrentSpeed(displayLeft)}${leftStatusLabel ? ` • ${leftStatusLabel}` : ""} • Équipe ${getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex)} restant(s)</small>
        <div class="draft-dev-battle-hp">
          <div class="draft-dev-battle-hp-meta">
            <strong>PV</strong>
            <span>${displayLeft.currentHp} / ${displayLeft.maxHp}</span>
          </div>
          <div class="draft-dev-battle-hp-track">
            <span class="draft-dev-battle-hp-fill" style="width:${leftHpPercent}%"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  const foeHudHtml = `
    <div class="draft-dev-battle-fighter-head">
      <div>
        <span>Adversaire</span>
        <b>${escapeHtml(displayRight.pokemon.name)}</b>
        <small>PV ${displayRight.currentHp} / ${displayRight.maxHp} • Vitesse ${getDraftSimpleBattleCurrentSpeed(displayRight)}${rightStatusLabel ? ` • ${rightStatusLabel}` : ""} • Équipe ${getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex)} restant(s)</small>
        <div class="draft-dev-battle-hp">
          <div class="draft-dev-battle-hp-meta">
            <strong>PV</strong>
            <span>${displayRight.currentHp} / ${displayRight.maxHp}</span>
          </div>
          <div class="draft-dev-battle-hp-track">
            <span class="draft-dev-battle-hp-fill" style="width:${rightHpPercent}%"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  body.innerHTML = isFinished
    ? `
    <div class="draft-dev-battle-finish-screen">
      ${resultHtml}
    </div>
  `
    : `
    ${state.arena ? `
      <div class="draft-dev-battle-arena-banner is-live">
        <div class="draft-dev-battle-arena-badge">${getDraftBadgeMarkup(state.arena, isFinished ? "finished" : "live")}</div>
        <div>
          <b>${escapeHtml(`Arène ${state.arena.name}`)}</b>
          <span>${escapeHtml(`Champion ${state.arena.name} • Spécialiste ${state.arena.type}`)}</span>
        </div>
      </div>
    ` : ""}
    ${isNetwork ? `
      <div class="draft-dev-battle-network-card is-live">
        <div class="draft-dev-battle-network-head">
          <b>Draft Combat 1v1</b>
          <span class="draft-dev-battle-network-role">${escapeHtml(getDraftSimpleBattleNetworkRoleLabel(state))}</span>
        </div>
        <div class="draft-dev-battle-network-grid">
          <div class="draft-dev-battle-network-item">
            <span>Code room</span>
            <b>${escapeHtml(network.roomCode || "—")}</b>
          </div>
          <div class="draft-dev-battle-network-item">
            <span>État réseau</span>
            <b>${escapeHtml(getDraftSimpleBattleNetworkRoomStatusText(state))}</b>
          </div>
          <div class="draft-dev-battle-network-item">
            <span>Camp local</span>
            <b>${escapeHtml(localSide === "left" ? "Gauche" : "Droite")}</b>
          </div>
          <div class="draft-dev-battle-network-item">
            <span>Autre joueur</span>
            <b>${escapeHtml(networkOpponent?.nickname || "Absent")}</b>
          </div>
        </div>
        <small>${escapeHtml(networkTurnHint)}</small>
      </div>
    ` : ""}
    <div class="draft-dev-battle-scene-note ${isFinished ? "is-finished" : isReplayingTurn && state.visualReplay?.phase === "ko" ? "is-switch" : isReplayingTurn && state.visualReplay?.phase === "anticipation" ? "is-anticipation" : isReplayingTurn && state.visualReplay?.phase === "impact" ? "is-enemy" : isReplayingTurn && state.visualReplay?.phase === "hp" ? "is-enemy" : isEnemyTurn ? "is-enemy" : needsForcedSwitch ? "is-switch" : "is-player"}">
      <b>${isFinished ? "Fin du match" : "Scène de combat"}</b>
      <span>${escapeHtml(sceneText)}</span>
    </div>
    ${visualFeedback.badges.length ? `
      <div class="draft-dev-battle-event-strip">
        ${visualFeedback.badges.map((label) => `<span class="draft-dev-battle-event-badge">${escapeHtml(label)}</span>`).join("")}
      </div>
    ` : ""}
    <div class="draft-dev-battle-stage">
      <div class="draft-dev-battle-fighters draft-dev-battle-scene-shell">
        <div class="draft-dev-battle-scene-row draft-dev-battle-scene-row-top">
          <div class="draft-dev-battle-slot draft-dev-battle-slot-sprite-foe">
            <img class="draft-dev-battle-scene-sprite draft-dev-battle-scene-sprite-foe" src="${escapeHtml(getPokemonSprite(displayRight.pokemon))}" alt="${escapeHtml(displayRight.pokemon.name)}">
          </div>
          <div class="draft-summary-card wide draft-dev-battle-fighter draft-dev-battle-slot draft-dev-battle-slot-hud-foe is-foe ${visualFeedback.rightClass}">
            ${foeHudHtml}
          </div>
        </div>
        <div class="draft-dev-battle-scene-row draft-dev-battle-scene-row-bottom">
          <div class="draft-summary-card wide draft-dev-battle-fighter draft-dev-battle-slot draft-dev-battle-slot-hud-player is-player ${visualFeedback.leftClass}">
            ${playerHudHtml}
          </div>
          <div class="draft-dev-battle-slot draft-dev-battle-slot-sprite-player">
            <img class="draft-dev-battle-scene-sprite draft-dev-battle-scene-sprite-player" src="${escapeHtml(getPokemonSprite(displayLeft.pokemon))}" alt="${escapeHtml(displayLeft.pokemon.name)}">
          </div>
        </div>
      </div>
    </div>
    <div class="draft-dev-battle-benches">
      ${renderDraftSimpleBattleBench(state.leftTeam, state.leftActiveIndex, "Banc joueur")}
      ${renderDraftSimpleBattleBench(state.rightTeam, state.rightActiveIndex, state.arena?.name ? `Banc de ${state.arena.name}` : "Banc adverse")}
    </div>
    <div class="draft-dev-battle-meta">
      <div class="draft-summary-card draft-dev-battle-status ${statusClass}"><span>Statut</span><b>${escapeHtml(statusText)}</b></div>
      <div class="draft-summary-card"><span>Ordre du tour</span><b>${escapeHtml(orderLabel)}</b><small>${escapeHtml(orderHint)}</small></div>
      <div class="draft-summary-card"><span>Tours</span><b>${state.log.length}</b></div>
      <div class="draft-summary-card"><span>Vainqueur</span><b>${escapeHtml(winner)}</b></div>
    </div>
    ${switchHtml}
    ${canLocalChooseAction && getDraftSimpleBattleAvailableSwitchIndexesForSide(state, currentActionSide).length
      ? `<div class="draft-dev-battle-extra-action"><button type="button" class="btn-ghost" onclick="openDraftSimpleBattleManualSwitch('${currentActionSide}')">Changer de Pokémon</button></div>`
      : ""}
    <div class="draft-dev-battle-battlebox">
      ${resultHtml ? `<div class="draft-dev-battle-battlebox-message">${resultHtml}</div>` : ""}
      ${isPlayerTurn ? `<div class="draft-dev-battle-battlebox-commands ${isReplayingTurn ? "is-resolving" : ""} ${showActionResumeCue ? "is-ready" : ""}"><div class="draft-dev-battle-actions ${isReplayingTurn ? "is-resolving" : ""} ${showActionResumeCue ? "is-ready" : ""}" aria-busy="${isReplayingTurn ? "true" : "false"}"><div class="card-desc">${isReplayingTurn ? "Résolution en cours" : showActionResumeCue ? "À toi de jouer" : `Tes attaques${isNetwork ? ` • ${escapeHtml(localSide === currentActionSide ? "à toi de jouer" : "en attente de l’autre joueur")}` : ""}`}</div>${canLocalChooseAction ? (struggleHtml || movesHtml) : `<p class="card-desc">${isReplayingTurn ? "Le tour se joue. Patiente jusqu’à la fin de la séquence." : `Action ${escapeHtml(currentActionSide === "right" ? "droite" : "gauche")} enregistrée ou en attente.`}</p>`}</div>${isReplayingTurn ? `<div class="draft-dev-battle-extra-action"><button type="button" class="btn-ghost" onclick="requestDraftSimpleBattleReplaySkip()">Passer</button></div>` : ""}</div>` : ""}
      <div class="draft-dev-battle-log">${actionsHtml || "<p class=\"card-desc\">Aucune action simulée.</p>"}</div>
    </div>
  `;

  panel.classList.remove("hidden");
  if (shouldAutoScroll) {
    scrollToDraftSimpleBattlePanel(panel);
  }
  focusDraftSimpleBattlePrimaryActionIfReady(state, panel);
}

function focusDraftSimpleBattlePrimaryActionIfReady(state, panel = document.getElementById("draft-dev-battle-panel")) {
  if (!state || !panel || panel.classList.contains("hidden")) {
    draftSimpleBattleActionFocusKey = "";
    return;
  }

  const network = state.network || {};
  const localSide = network.localSide || "left";
  const isPlayerTurn = state.phase === "battle" && (state.turnState === "left-action" || state.turnState === "right-action");
  const currentActionSide = state.turnState === "right-action" ? "right" : "left";
  const canLocalChooseAction = !isDraftSimpleBattleNetworkMode(state)
    || (localSide === currentActionSide && !network.waitingRemote && !network.resolvingTurn);
  const needsForcedSwitch = state.phase === "battle" && state.pendingSwitchSide && !state.pendingSwitchResolved;
  const canFocusMove = Boolean(isPlayerTurn && canLocalChooseAction && !needsForcedSwitch);
  const canFocusSwitch = Boolean(needsForcedSwitch && (!isDraftSimpleBattleNetworkMode(state) || localSide === state.pendingSwitchSide));
  const canFocusStart = Boolean(state.phase === "preview");

  let selector = "";
  let focusKey = "";

  if (canFocusSwitch) {
    selector = ".draft-dev-battle-switch-option:not([disabled]), .draft-dev-battle-extra-action .btn-ghost:not([disabled])";
    focusKey = `switch:${state.turn}:${state.pendingSwitchSide}:${state.pendingSwitchReason || ""}`;
  } else if (canFocusMove) {
    selector = ".draft-dev-battle-actions .draft-dev-battle-move:not([disabled]), .draft-dev-battle-extra-action .btn-ghost:not([disabled])";
    const submitted = state.pendingTurn?.actions?.[currentActionSide];
    focusKey = `action:${state.turn}:${currentActionSide}:${submitted ? "locked" : "open"}`;
  } else if (canFocusStart) {
    selector = ".draft-dev-battle-preview-cta:not([disabled])";
    focusKey = `preview:${state.mode || "default"}`;
  } else {
    draftSimpleBattleActionFocusKey = "";
    return;
  }

  if (draftSimpleBattleActionFocusKey === focusKey) return;

  const active = document.activeElement;
  const activeIsUseful = !!active && (
    active === panel ||
    panel.contains(active)
  ) && (
    active.tagName === "BUTTON" ||
    active.tagName === "INPUT" ||
    active.tagName === "SELECT" ||
    active.tagName === "TEXTAREA" ||
    active.isContentEditable
  );
  if (activeIsUseful) return;

  draftSimpleBattleActionFocusKey = focusKey;
  window.requestAnimationFrame(() => {
    const target = panel.querySelector(selector);
    if (!target || target.disabled) return;
    const latestActive = document.activeElement;
    const latestActiveIsUseful = !!latestActive && panel.contains(latestActive) && (
      latestActive.tagName === "BUTTON" ||
      latestActive.tagName === "INPUT" ||
      latestActive.tagName === "SELECT" ||
      latestActive.tagName === "TEXTAREA" ||
      latestActive.isContentEditable
    );
    if (latestActiveIsUseful) return;
    target.focus({ preventScroll: true });
  });
}

function clearDraftSimpleBattleDevPanel() {
  if (draftSimpleBattleIntroTimer) {
    clearTimeout(draftSimpleBattleIntroTimer);
    draftSimpleBattleIntroTimer = null;
  }
  if (draftSimpleBattleTurnTimer) {
    clearTimeout(draftSimpleBattleTurnTimer);
    draftSimpleBattleTurnTimer = null;
  }
  if (draftSimpleBattleAutoScrollFrame) {
    cancelAnimationFrame(draftSimpleBattleAutoScrollFrame);
    draftSimpleBattleAutoScrollFrame = null;
  }
  clearDraftSimpleBattleReplay();
  if (draftSimpleBattleDevUiState) {
    if (isDraftSimpleBattleNetworkMode(draftSimpleBattleDevUiState) && multiplayerSocket?.connected) {
      multiplayerSocket.emit("draft-battle:leave-room");
    }
    draftSimpleBattleDevUiState.pendingTurn = null;
    draftSimpleBattleDevUiState.hotseatPendingSide = null;
    draftSimpleBattleDevUiState.visualReplay = null;
  }
  draftBattleNetworkSession = null;
  draftSimpleBattleDevUiState = null;
  draftSimpleBattleActionFocusKey = "";
  document.body.classList.remove("draft-battle-open");
  document.getElementById("draft-dev-battle-panel")?.classList.add("hidden");
  document.getElementById("draft-battle-close")?.classList.add("hidden");
}

function startDraftSimpleBattlePreview() {
  if (!draftSimpleBattleDevUiState) return null;
  if (isDraftSimpleBattleNetworkMode(draftSimpleBattleDevUiState)) {
    const network = getDraftSimpleBattleNetworkMeta(draftSimpleBattleDevUiState);
    if (!network.isHost || (network.players || []).length < 2) return null;
    draftSimpleBattleDevUiState.showPreview = false;
    draftSimpleBattleDevUiState.showIntro = false;
    draftSimpleBattleDevUiState.turnState = "left-action";
    draftSimpleBattleDevUiState.sceneMessage = `${draftSimpleBattleDevUiState.left?.pokemon?.name || "Le Pokémon gauche"} entre au combat face à ${draftSimpleBattleDevUiState.right?.pokemon?.name || "l’adversaire"} !`;
    commitDraftSimpleBattleNetworkState(draftSimpleBattleDevUiState);
    renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
    return draftSimpleBattleDevUiState;
  }
  draftSimpleBattleDevUiState.showPreview = false;
  draftSimpleBattleDevUiState.showIntro = true;
  draftSimpleBattleDevUiState.sceneMessage = `${draftSimpleBattleDevUiState.left?.pokemon?.name || "Ton Pokémon"} entre au combat face à ${draftSimpleBattleDevUiState.right?.pokemon?.name || "l’adversaire"} !`;
  renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
  if (draftSimpleBattleIntroTimer) clearTimeout(draftSimpleBattleIntroTimer);
  draftSimpleBattleIntroTimer = setTimeout(() => {
    if (!draftSimpleBattleDevUiState) return;
    draftSimpleBattleDevUiState.showIntro = false;
    draftSimpleBattleDevUiState.turnState = "left-action";
    renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
    draftSimpleBattleIntroTimer = null;
  }, 1000);
  return draftSimpleBattleDevUiState;
}

function finishDraftSimpleBattleDevTurn(state, turnEntry) {
  const leftRemaining = getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex);
  const rightRemaining = getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex);
  state.turn += 1;
  state.phase = leftRemaining <= 0 || rightRemaining <= 0 ? "finished" : "ready";
  state.pendingTurn = null;
  state.queuedTurn = null;
  clearDraftSimpleBattleTurnFlags(state);
  if (state.phase === "finished") {
    state.pendingSwitch = false;
    state.pendingSwitchReason = null;
    state.pendingSwitchSide = null;
    state.hotseatPendingSide = null;
    state.sceneMessage = `${getDraftSimpleBattleTeamWinnerLabel(state)} gagne le match avec ${getDraftSimpleBattleWinnerName(state)}.`;
  } else if (state.left && state.left.currentHp <= 0) {
    const hasForcedReplacement = getDraftSimpleBattleAvailableSwitchIndexesForSide(state, "left").length > 0;
    state.pendingSwitch = hasForcedReplacement;
    state.pendingSwitchReason = hasForcedReplacement ? "ko" : null;
    state.pendingSwitchSide = hasForcedReplacement ? "left" : null;
    if (hasForcedReplacement && isDraftSimpleBattleLocalHotseat(state)) {
      state.turnState = "hotseat-transition";
      state.hotseatPendingSide = "left";
      state.sceneMessage = "Le Pokémon gauche est KO. Passe au joueur gauche.";
    } else {
      state.sceneMessage = hasForcedReplacement
        ? "Le Pokémon gauche tombe KO. Choisis vite le remplaçant."
        : state.sceneMessage;
    }
  } else if (state.right && state.right.currentHp <= 0 && isDraftSimpleBattleHumanControlled(state, "right")) {
    const hasForcedReplacement = getDraftSimpleBattleAvailableSwitchIndexesForSide(state, "right").length > 0;
    state.pendingSwitch = hasForcedReplacement;
    state.pendingSwitchReason = hasForcedReplacement ? "ko" : null;
    state.pendingSwitchSide = hasForcedReplacement ? "right" : null;
    if (hasForcedReplacement && isDraftSimpleBattleLocalHotseat(state)) {
      state.turnState = "hotseat-transition";
      state.hotseatPendingSide = "right";
      state.sceneMessage = "Le Pokémon droit est KO. Passe au joueur droit.";
    } else {
      state.sceneMessage = hasForcedReplacement
        ? "Le Pokémon droit tombe KO. Choisis vite le remplaçant."
        : state.sceneMessage;
    }
  } else if (state.pendingSwitch) {
    state.sceneMessage = state.pendingSwitchSide === "right"
      ? "Le Pokémon droit tombe KO. Choisis vite le remplaçant."
      : "Le Pokémon gauche tombe KO. Choisis vite le remplaçant.";
  } else {
    state.pendingSwitch = false;
    state.pendingSwitchReason = null;
    state.pendingSwitchSide = null;
    state.hotseatPendingSide = null;
    state.sceneMessage = "";
  }
  if (state.phase === "finished") {
    state.turnState = "finished";
  } else if (state.turnState === "hotseat-transition") {
    // keep transition state set above
  } else {
    state.turnState = state.pendingSwitch ? "switch" : "left-action";
  }
  if (turnEntry && !turnEntry.order?.length) {
    turnEntry.order = ["left", "right"];
  }
  syncDraftSimpleBattleActiveBattlers(state);
  clearDraftSimpleBattleReplay(state);
  renderDraftSimpleBattleDevPanel(state);
  if (turnEntry?.actions?.length) {
    startDraftSimpleBattleTurnReplay(state, turnEntry);
  }
  if (state.phase === "finished" && !state.finishHandled && typeof state.onFinish === "function") {
    state.finishHandled = true;
    state.onFinish(state);
    renderDraftSimpleBattleDevPanel(state);
  }
  return state;
}

function chooseDraftSimpleBattleReplacement(teamIndex, side = null, options = {}) {
  const state = draftSimpleBattleDevUiState;
  if (!state || !state.pendingSwitch || state.phase === "finished") return null;
  const replacementSide = side || state.pendingSwitchSide || "left";
  const nextIndex = Number(teamIndex);
  const team = replacementSide === "right" ? state.rightTeam : state.leftTeam;
  const activeIndex = replacementSide === "right" ? state.rightActiveIndex : state.leftActiveIndex;
  const nextMember = team[nextIndex];
  if (!Number.isInteger(nextIndex) || !nextMember || nextMember.currentHp <= 0 || nextIndex === activeIndex) return null;

  const switchReason = state.pendingSwitchReason;
  state.pendingSwitch = false;
  state.pendingSwitchReason = null;
  state.pendingSwitchSide = null;
  state.pendingTurn = null;
  state.queuedTurn = null;
  state.turnState = switchReason === "manual" ? "resolving" : "left-action";

  if (isDraftSimpleBattleNetworkMode(state) && !options.bypassNetwork) {
    if (switchReason === "manual") {
      state.pendingSwitch = false;
      state.pendingSwitchReason = null;
      state.pendingSwitchSide = null;
      state.turnState = replacementSide === "right" ? "right-action" : "left-action";
      return submitDraftSimpleBattleNetworkAction(state, replacementSide, {
        kind: "switch",
        teamIndex: nextIndex,
        pokemonName: nextMember.pokemon.name,
      }, { source: "player" });
    }
    return submitDraftSimpleBattleNetworkReplacement(state, replacementSide, nextIndex);
  }

  if (switchReason === "manual" && state.phase !== "finished") {
    state.turnState = replacementSide === "left" ? "left-action" : "right-action";
    submitDraftSimpleBattleTurnAction(state, replacementSide, {
      kind: "switch",
      teamIndex: nextIndex,
      pokemonName: nextMember.pokemon.name,
    }, {
      source: "player",
    });
    const otherSide = replacementSide === "left" ? "right" : "left";
    if (!isDraftSimpleBattleHumanControlled(state, otherSide)) {
      const enemyAction = chooseDraftSimpleBattleEnemyAction(state);
      submitDraftSimpleBattleTurnAction(state, otherSide, enemyAction, { source: "ai" });
    } else {
      state.turnState = otherSide === "left" ? "left-action" : "right-action";
      state.sceneMessage = replacementSide === "left"
        ? "Action gauche choisie. En attente action droite."
        : "Action droite choisie. En attente action gauche.";
      renderDraftSimpleBattleDevPanel(state);
      return state;
    }
    return scheduleDraftSimpleBattleTurnResolution(state);
  }

  const switched = executeDraftSimpleBattleSwitch(state, replacementSide, nextIndex, {
    reason: "forced-ko",
    forced: true,
  });
  if (!switched) return null;
  state.sceneMessage = `${switched.pokemon.name} rejoint le terrain !`;
  state.turnState = "left-action";
  renderDraftSimpleBattleDevPanel(state);
  return state;
}

function openDraftSimpleBattleManualSwitch(side = null) {
  const state = draftSimpleBattleDevUiState;
  if (!state || state.phase === "finished" || state.pendingSwitch) return null;
  const switchSide = side || getDraftSimpleBattleCurrentActionSide(state);
  if (isDraftSimpleBattleNetworkMode(state) && getDraftSimpleBattleNetworkLocalSide(state) !== switchSide) return null;
  const expectedTurnState = switchSide === "right" ? "right-action" : "left-action";
  if (state.turnState !== expectedTurnState) return null;
  if (!getDraftSimpleBattleAvailableSwitchIndexesForSide(state, switchSide).length) return null;

  state.pendingSwitch = true;
  state.pendingSwitchReason = "manual";
  state.pendingSwitchSide = switchSide;
  state.sceneMessage = switchSide === "right"
    ? "Choisis un autre Pokémon à droite : ce changement consommera ton tour."
    : "Choisis un autre Pokémon à gauche : ce changement consommera ton tour.";
  state.log.push({ turn: state.turn, order: ["left", "right"], actions: [] });
  renderDraftSimpleBattleDevPanel(state);
  return state;
}

function cancelDraftSimpleBattleManualSwitch() {
  const state = draftSimpleBattleDevUiState;
  if (!state || state.phase === "finished" || !state.pendingSwitch || state.pendingSwitchReason !== "manual") return null;
  const switchSide = state.pendingSwitchSide || "left";
  state.pendingSwitch = false;
  state.pendingSwitchReason = null;
  state.pendingSwitchSide = null;
  state.pendingTurn = null;
  state.queuedTurn = null;
  state.hotseatPendingSide = null;
  state.turnState = switchSide === "right" ? "right-action" : "left-action";
  state.sceneMessage = switchSide === "right"
    ? `${state.right?.pokemon?.name || "Le Pokémon droit"} reste au combat.`
    : `${state.left?.pokemon?.name || "Le Pokémon gauche"} reste au combat.`;
  if (state.log.length) {
    const lastTurn = state.log[state.log.length - 1];
    if (lastTurn && Array.isArray(lastTurn.actions) && lastTurn.actions.length === 0) {
      state.log.pop();
    }
  }
  renderDraftSimpleBattleDevPanel(state);
  return state;
}

function chooseDraftSimpleBattleEnemyReplacement(state) {
  const options = getDraftSimpleBattleAvailableEnemySwitchIndexes(state);
  if (!options.length) return null;
  const player = state?.left;
  const ranked = options
    .map((teamIndex) => {
      const battler = state.rightTeam[teamIndex];
      return {
        teamIndex,
        battler,
        pressure: getDraftSimpleBattleBestMoveScore(state.gen, battler, player),
      };
    })
    .sort((a, b) => b.pressure - a.pressure);
  return ranked[0]?.teamIndex ?? options[0];
}

function runDraftSimpleBattleDevTurn(moveIndex = 0, side = null) {
  if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState.phase === "finished" || draftSimpleBattleDevUiState.pendingSwitch) return null;

  const state = draftSimpleBattleDevUiState;
  const actionSide = side || getDraftSimpleBattleCurrentActionSide(state);
  if (isDraftSimpleBattleNetworkMode(state) && getDraftSimpleBattleNetworkLocalSide(state) !== actionSide) return null;
  const expectedTurnState = actionSide === "right" ? "right-action" : "left-action";
  if (state.turnState !== expectedTurnState) return null;
  prepareDraftSimpleBattleQueuedTurn(state, {
    kind: "move",
    moveIndex,
  });
  return state.queuedTurn ? scheduleDraftSimpleBattleTurnResolution(state) : state;
}

function runDraftSimpleBattleDevStruggle(side = null) {
  if (!draftSimpleBattleDevUiState || draftSimpleBattleDevUiState.phase === "finished" || draftSimpleBattleDevUiState.pendingSwitch) return null;
  const state = draftSimpleBattleDevUiState;
  const actionSide = side || getDraftSimpleBattleCurrentActionSide(state);
  if (isDraftSimpleBattleNetworkMode(state) && getDraftSimpleBattleNetworkLocalSide(state) !== actionSide) return null;
  const expectedTurnState = actionSide === "right" ? "right-action" : "left-action";
  if (state.turnState !== expectedTurnState) return null;
  prepareDraftSimpleBattleQueuedTurn(state, { kind: "struggle" });
  return state.queuedTurn ? scheduleDraftSimpleBattleTurnResolution(state) : state;
}

function runDraftSimpleBattleDraftConversionDevVisualTest() {
  if (draftArenaState?.team?.length >= DRAFT_TEAM_SIZE && (draftArenaState.phase === "battle" || draftArenaState.phase === "result")) {
    return launchDraftArenaBattle();
  }

  const screen = document.getElementById("screen-draft-arena");
  if (!screen || screen.classList.contains("hidden")) {
    console.warn("Ouvre d'abord l'écran Draft Arènes pour voir le panneau de dev.");
  }

  const { playerDraftTeam, enemyDraftTeam } = getDraftSimpleBattleDevEntries();
  const state = createDraftSimpleBattleDevUiState(playerDraftTeam, enemyDraftTeam, {
    mode: "dev",
    title: "Combat Draft",
  });
  if (!state) {
    console.warn("Impossible de construire la simulation de dev.");
    return null;
  }

  draftSimpleBattleDevUiState = state;
  draftSimpleBattleDevUiState.showPreview = true;
  draftSimpleBattleDevUiState.showIntro = false;
  renderDraftSimpleBattleDevPanel(state);
  document.getElementById("draft-battle-close")?.classList.remove("hidden");
  console.log("Draft Simple Battle Dev Duel", {
    left: state.left.pokemon.name,
    right: state.right.pokemon.name,
    moves: state.left.moves.map((move) => move.name),
  });
  return state;
}

function runDraftSimpleBattleLocalPvpTest() {
  const { playerDraftTeam, enemyDraftTeam } = getDraftSimpleBattleDevEntries();
  const state = createDraftSimpleBattleDevUiState(playerDraftTeam, enemyDraftTeam, {
    mode: "local-pvp",
    title: "Draft Combat Local 1v1",
    controllers: {
      left: "human",
      right: "human",
    },
  });
  if (!state) return null;
  draftSimpleBattleDevUiState = state;
  state.showPreview = false;
  state.showIntro = false;
  state.turnState = "left-action";
  state.sceneMessage = "Mode local 1v1 : joueur gauche, choisis ton action.";
  renderDraftSimpleBattleDevPanel(state);
  document.getElementById("draft-battle-close")?.classList.remove("hidden");
  return state;
}

function hostDraftSimpleBattleNetworkRoom() {
  const socket = ensureMultiplayerSocket();
  const baseState = draftSimpleBattleDevUiState?.showPreview
    ? draftSimpleBattleDevUiState
    : runDraftSimpleBattleDraftConversionDevVisualTest();
  if (!socket?.connected || !baseState) return null;
  if (draftBattleNetworkSession?.room?.code) {
    socket.emit("draft-battle:leave-room");
    draftBattleNetworkSession = null;
  }

  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour la room Draft Combat :", playerProfile.nickname || "Joueur 1") || "") || "Joueur 1";
  const state = hydrateDraftSimpleBattleNetworkState(cloneDraftSimpleBattleNetworkState(baseState), {
    enabled: true,
    localSide: "left",
    isHost: true,
    players: [],
    pendingTurn: null,
    pendingReplacement: null,
    waitingRemote: false,
  });
  if (!state) return null;
  state.mode = "network-pvp";
  state.title = "Draft Combat 1v1";
  state.controllers.left = "human";
  state.controllers.right = "human";
  state.showPreview = true;
  state.showIntro = false;
  state.turnState = "left-action";
  state.sceneMessage = "Room réseau en cours de création...";
  draftSimpleBattleDevUiState = state;
  renderDraftSimpleBattleDevPanel(state);

  socket.emit("draft-battle:create-room", {
    nickname,
    battleState: cloneDraftSimpleBattleNetworkState(state),
  }, (response = {}) => {
    if (!response.ok) {
      state.sceneMessage = response.error || "Impossible de créer la room réseau.";
      renderDraftSimpleBattleDevPanel(state);
      return;
    }
    const room = response.room || null;
    state.network = buildDraftSimpleBattleNetworkMetaFromRoom(room, state);
    state.sceneMessage = `Room ${room?.code || ""} créée. Partage le code au second joueur.`;
    draftBattleNetworkSession = { room };
    renderDraftSimpleBattleDevPanel(state);
  });
  return state;
}

function joinDraftSimpleBattleNetworkRoom() {
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return null;
  if (draftBattleNetworkSession?.room?.code) {
    socket.emit("draft-battle:leave-room");
    draftBattleNetworkSession = null;
  }
  const code = String(window.prompt("Code de room Draft Combat :", "") || "").trim().toUpperCase();
  if (!code) return null;
  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour rejoindre le combat :", playerProfile.nickname || "Joueur 2") || "") || "Joueur 2";
  socket.emit("draft-battle:join-room", {
    code,
    nickname,
  }, (response = {}) => {
    if (!response.ok) {
      alert(response.error || "Impossible de rejoindre la room.");
    }
  });
  return true;
}

window.runDraftSimpleBattleDevTests = runDraftSimpleBattleDevTests;
window.runDraftSimpleBattleDraftConversionDevTest = runDraftSimpleBattleDraftConversionDevTest;
window.runDraftSimpleBattleDraftConversionDevVisualTest = runDraftSimpleBattleDraftConversionDevVisualTest;
window.runDraftSimpleBattleLocalPvpTest = runDraftSimpleBattleLocalPvpTest;
window.hostDraftSimpleBattleNetworkRoom = hostDraftSimpleBattleNetworkRoom;
window.joinDraftSimpleBattleNetworkRoom = joinDraftSimpleBattleNetworkRoom;
window.continueDraftSimpleBattleHotseat = continueDraftSimpleBattleHotseat;
window.launchDraftArenaBattle = launchDraftArenaBattle;
window.continueDraftArenaBattleRun = continueDraftArenaBattleRun;
window.finishDraftArenaBattleView = finishDraftArenaBattleView;
window.selectDraftSimpleBattlePreviewLead = selectDraftSimpleBattlePreviewLead;
window.runDraftSimpleBattleDevTurn = runDraftSimpleBattleDevTurn;
window.runDraftSimpleBattleDevStruggle = runDraftSimpleBattleDevStruggle;
window.startDraftSimpleBattlePreview = startDraftSimpleBattlePreview;
window.openDraftSimpleBattleManualSwitch = openDraftSimpleBattleManualSwitch;
window.cancelDraftSimpleBattleManualSwitch = cancelDraftSimpleBattleManualSwitch;
window.chooseDraftSimpleBattleReplacement = chooseDraftSimpleBattleReplacement;
window.replayDraftSimpleBattleDevDuel = replayDraftSimpleBattleDevDuel;
window.clearDraftSimpleBattleDevPanel = clearDraftSimpleBattleDevPanel;


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

  return getPokemonUiList({ gens: [cfg.gen] }).filter(Boolean);
}

function pickRandomUniquePokemon(pool, count, excludeDexIds = new Set()) {
  const source = pool.filter((p) => !excludeDexIds.has(getDraftPoolEntryKey(p)));
  const out = [];

  while (source.length && out.length < count) {
    const idx = Math.floor(Math.random() * source.length);
    out.push(source[idx]);
    source.splice(idx, 1);
  }

  return out;
}

function getDraftWeightedChance(power) {
  // Draft weighting is intentionally centered on medium-power Pokemon:
  // - weak picks can still appear, but should not flood every wave
  // - medium picks are the most common draft backbone
  // - very strong picks stay possible, but much rarer
  const normalized = clampDraftValue(Number(power) || 0, 35, 110);

  if (normalized <= 48) {
    return 0.48;
  }
  if (normalized <= 58) {
    return 0.72;
  }
  if (normalized <= 72) {
    return 1;
  }
  if (normalized <= 82) {
    return 0.7;
  }
  if (normalized <= 92) {
    return 0.36;
  }
  return 0.15;
}

function pickWeightedDraftPokemon(pool, excludeDexIds = new Set(), options = {}) {
  const heavyThreatCount = Number(options.heavyThreatCount) || 0;
  const source = pool
    .filter((pokemon) => !excludeDexIds.has(getDraftPoolEntryKey(pokemon)))
    .map((pokemon) => {
      const power = getDraftCachedPokemonPowerData(pokemon).power;
      let weight = getDraftWeightedChance(power);

      // Once a wave already contains a very strong threat, heavily reduce the
      // chance of drawing another one. This keeps "wow" picks possible while
      // avoiding waves dominated by multiple huge threats too often.
      if (power >= 88 && heavyThreatCount >= 1) {
        weight *= 0.18;
      } else if (power >= 82 && heavyThreatCount >= 1) {
        weight *= 0.45;
      }

      return { pokemon, weight };
    })
    .filter((entry) => entry.weight > 0);

  if (!source.length) return null;

  const totalWeight = source.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of source) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.pokemon;
    }
  }
  return source[source.length - 1]?.pokemon || null;
}

function buildDraftWeightedWave(pool, count, excludeDexIds = new Set()) {
  const picks = [];
  const usedDexIds = new Set(excludeDexIds);
  let heavyThreatCount = 0;

  while (picks.length < count) {
    const picked = pickWeightedDraftPokemon(pool, usedDexIds, { heavyThreatCount });
    if (!picked) break;
    usedDexIds.add(getDraftPoolEntryKey(picked));
    picks.push(picked);
    if (getDraftCachedPokemonPowerData(picked).power >= 82) {
      heavyThreatCount += 1;
    }
  }

  return picks;
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
    if (option?.pokemon) excludeDexIds.add(getDraftPoolEntryKey(option.pokemon));
  });

  const missingCount = Math.max(0, DRAFT_PICK_COUNT - draftArenaState.options.length);
  const weightedWave = buildDraftWeightedWave(pool, missingCount, excludeDexIds);
  for (const pokemon of weightedWave) {
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
      excludeDexIds.add(getDraftPoolEntryKey(option.pokemon));
      return createDraftOptionEntry(option.pokemon, true, option.shiny);
    }
    return option;
  });

  const unlockedIndexes = [];
  for (let index = 0; index < draftArenaState.options.length; index += 1) {
    const option = draftArenaState.options[index];
    if (!option || option.locked) continue;
    unlockedIndexes.push(index);
  }

  const replacements = buildDraftWeightedWave(pool, unlockedIndexes.length, excludeDexIds);
  unlockedIndexes.forEach((index, replacementIndex) => {
    const replacement = replacements[replacementIndex];
    if (!replacement) return;
    draftArenaState.options[index] = createDraftOptionEntry(replacement);
  });
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

function buildDraftArenaLiveSummary(teamData, badgeResults, synergy, currentArena = null) {
  const summary = buildDraftRunSummary(teamData, badgeResults, synergy);
  const wonCount = badgeResults.filter((result) => result.status === "won").length;
  const blocked = badgeResults.find((result) => result.status === "blocked");
  if (blocked) return summary;
  if (currentArena) {
    summary.status = `Arène en cours : ${currentArena.name}`;
  } else if (wonCount) {
    summary.status = `${wonCount} badge${wonCount > 1 ? "s" : ""} obtenu${wonCount > 1 ? "s" : ""}`;
  } else {
    summary.status = "Run prête à commencer";
  }
  return summary;
}

function getDraftArenaEnemyPowerCap(arena) {
  const arenas = DRAFT_ARENAS_BY_GEN?.[draftArenaState?.selectedGen] || [];
  const arenaIndex = Math.max(0, arenas.findIndex((entry) => entry?.name === arena?.name && entry?.type === arena?.type));
  const caps = [76, 79, 82, 84, 86, 88, 91, 95];
  return caps[Math.min(arenaIndex, caps.length - 1)] || 88;
}

function buildDraftArenaBalancedEnemyPool(pool, arena, options = {}) {
  const cap = getDraftArenaEnemyPowerCap(arena);
  const allowExceptional = Boolean(options.allowExceptional);
  const candidates = (pool || []).filter((pokemon) => {
    if (!pokemon) return false;
    const metrics = getDraftCachedPokemonPowerData(pokemon);
    if (metrics.power > cap) return false;
    if (!allowExceptional && metrics.rarityLabel === "Exceptionnel") return false;
    return true;
  });
  return candidates.length >= 4 ? candidates : (pool || []).filter(Boolean);
}

function buildDraftArenaEnemyTeamEntries(arena, playerEntries = []) {
  if (!arena || !draftArenaState?.selectedGen) return [];

  const playerDexIds = new Set(
    playerEntries
      .map((entry) => entry?.pokemon)
      .filter(Boolean)
      .map((pokemon) => getDraftPoolEntryKey(pokemon))
  );
  const genPool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const rawThemedPool = genPool.filter((pokemon) => pokemon?.type1 === arena.type || pokemon?.type2 === arena.type);
  const themedPool = buildDraftArenaBalancedEnemyPool(rawThemedPool, arena);
  const fallbackPool = buildDraftArenaBalancedEnemyPool(genPool, arena);
  const usedDexIds = new Set(playerDexIds);
  const picks = [];

  const signatureNames = DRAFT_ARENA_SIGNATURES_BY_GEN?.[draftArenaState.selectedGen]?.[arena.name] || [];
  signatureNames.forEach((pokemonName) => {
    const pokemon = findDraftArenaSignaturePokemon(themedPool.length ? themedPool : genPool, pokemonName)
      || findDraftArenaSignaturePokemon(genPool, pokemonName);
    if (!pokemon) return;
    const metrics = getDraftCachedPokemonPowerData(pokemon);
    if (metrics.power > getDraftArenaEnemyPowerCap(arena) + 4) return;
    const dexId = getDraftPoolEntryKey(pokemon);
    if (usedDexIds.has(dexId)) return;
    usedDexIds.add(dexId);
    picks.push({ pokemon });
  });

  const themedPicks = buildDraftWeightedWave(themedPool, DRAFT_SIMPLE_BATTLE_TEAM_SIZE - picks.length, usedDexIds);
  themedPicks.forEach((pokemon) => {
    if (!pokemon) return;
    const dexId = getDraftPoolEntryKey(pokemon);
    if (usedDexIds.has(dexId)) return;
    usedDexIds.add(dexId);
    picks.push({ pokemon });
  });

  if (picks.length < DRAFT_SIMPLE_BATTLE_TEAM_SIZE) {
    const fallbackPicks = buildDraftWeightedWave(fallbackPool, DRAFT_SIMPLE_BATTLE_TEAM_SIZE - picks.length, usedDexIds);
    fallbackPicks.forEach((pokemon) => {
      if (!pokemon) return;
      const dexId = getDraftPoolEntryKey(pokemon);
      if (usedDexIds.has(dexId)) return;
      usedDexIds.add(dexId);
      picks.push({ pokemon });
    });
  }

  return picks.slice(0, DRAFT_SIMPLE_BATTLE_TEAM_SIZE);
}

function getDraftArenaCurrentArena() {
  if (!draftArenaState?.selectedGen) return null;
  const arenas = DRAFT_ARENAS_BY_GEN[draftArenaState.selectedGen] || [];
  const index = clampDraftValue(Number(draftArenaState.currentArenaIndex) || 0, 0, Math.max(0, arenas.length - 1));
  return arenas[index] || null;
}

function normalizeDraftArenaPokemonName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function findDraftArenaSignaturePokemon(genPool, pokemonName) {
  const wanted = normalizeDraftArenaPokemonName(pokemonName);
  if (!wanted) return null;
  return (genPool || []).find((pokemon) => normalizeDraftArenaPokemonName(pokemon?.name) === wanted) || null;
}

function getDraftArenaThemeClass(arena) {
  const normalizedType = normalizeDraftArenaPokemonName(arena?.type || "");
  return normalizedType ? `theme-${normalizedType}` : "theme-neutral";
}

function getDraftArenaPreviewHint(arena) {
  if (!arena) return "Un duel Draft vs Draft t’attend.";
  return `Champion ${arena.name} • Arène ${arena.type}`;
}

function getDraftArenaTypeImageUrl(arena) {
  const arenaImage = DRAFT_ARENA_BACKGROUND_IMAGE_BY_NAME[arena?.name || ""];
  if (arenaImage) return arenaImage;
  const fileName = DRAFT_ARENA_TYPE_IMAGE_BY_TYPE[arena?.type];
  return fileName ? `types/${fileName}` : "";
}

function chooseDraftSimpleBattleOpeningIndex(teamEntries = [], opponentEntries = []) {
  if (!teamEntries.length) return 0;
  const battlers = teamEntries.map((entry) => convertDraftPokemonToSimpleBattler(entry)).filter(Boolean);
  const opponentBattlers = opponentEntries.map((entry) => convertDraftPokemonToSimpleBattler(entry)).filter(Boolean);
  if (!battlers.length || !opponentBattlers.length) return 0;
  const opponentLead = opponentBattlers[0];

  let bestIndex = 0;
  let bestScore = -Infinity;
  battlers.forEach((battler, index) => {
    const attackScore = getDraftSimpleBattleBestMoveScore(Number(battler?.pokemon?.gen) || 1, battler, opponentLead);
    const defenseScore = getDraftSimpleBattleBestMoveScore(Number(battler?.pokemon?.gen) || 1, opponentLead, battler);
    const score = attackScore - defenseScore + getDraftSimpleBattleCurrentSpeed(battler) * 0.18;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function buildDraftArenaBattleButtonMeta() {
  const battleTeam = draftArenaState?.team?.filter((entry) => entry?.pokemon) || [];
  if (battleTeam.length < DRAFT_TEAM_SIZE) {
    return {
      disabled: true,
      label: "Lancer le duel",
      title: "Complète d’abord ton équipe de 6 Pokémon.",
    };
  }

  if (draftArenaState?.phase === "result" && draftArenaState?.runSummary) {
    return {
      disabled: true,
      label: "Run terminée",
      title: "Relance un nouveau draft pour recommencer la run.",
    };
  }

  const currentArena = getDraftArenaCurrentArena();
  if (draftArenaState?.phase === "battle" && currentArena) {
    return {
      disabled: false,
      label: `Affronter ${currentArena.name}`,
      title: `Lancer le vrai duel contre ${currentArena.name}.`,
    };
  }

  return {
    disabled: false,
    label: "Lancer le duel",
    title: "Ouvrir le combat simplifié du Draft.",
  };
}

async function prepareDraftArenaBattleRun() {
  if (!draftArenaState || draftArenaState.team.length < DRAFT_TEAM_SIZE || !draftArenaState.selectedGen) return false;
  const snapshot = draftArenaState;
  snapshot.evaluating = true;
  snapshot.message = `Préparation de la run ${draftGenLabel(snapshot.selectedGen)}...`;
  renderDraftArena();

  const teamData = await Promise.all(snapshot.team.map(async (member) => ({
    ...member,
    metrics: await getDraftPokemonPowerData(member.pokemon),
  })));

  if (snapshot !== draftArenaState) return false;

  const arenas = DRAFT_ARENAS_BY_GEN[snapshot.selectedGen] || [];
  const synergy = getDraftTeamSynergy(teamData);
  snapshot.teamData = teamData;
  snapshot.synergyData = synergy;
  snapshot.currentArenaIndex = 0;
  snapshot.badgeResults = arenas.map((arena, arenaIndex) => ({
    ...analyzeDraftArenaBattle(teamData, arena, arenaIndex, snapshot.selectedGen, synergy),
    won: false,
    status: arenaIndex === 0 ? "pending" : "untried",
  }));
  snapshot.teamPower = teamData.reduce((sum, member) => sum + member.metrics.power, 0);
  snapshot.teamSynergy = synergy.score;
  snapshot.runSummary = buildDraftArenaLiveSummary(teamData, snapshot.badgeResults, synergy, arenas[0] || null);
  snapshot.evaluating = false;
  snapshot.phase = "battle";
  snapshot.message = arenas[0]
    ? `Ton équipe est prête. Première arène : ${arenas[0].name} (${arenas[0].type}).`
    : "Ton équipe est prête pour le duel.";
  renderDraftArena();
  return true;
}

function updateDraftArenaRunAfterBattle(battleState) {
  if (!draftArenaState || !draftArenaState.teamData?.length || !draftArenaState.synergyData) return;

  const arenas = DRAFT_ARENAS_BY_GEN[draftArenaState.selectedGen] || [];
  const arenaIndex = clampDraftValue(Number(draftArenaState.currentArenaIndex) || 0, 0, Math.max(0, arenas.length - 1));
  const currentArena = arenas[arenaIndex];
  if (!currentArena || !draftArenaState.badgeResults[arenaIndex]) return;

  const playerWin = isDraftSimpleBattlePlayerWin(battleState);
  const winnerName = getDraftSimpleBattleWinnerName(battleState);
  const currentResult = draftArenaState.badgeResults[arenaIndex];

  draftArenaState.badgeResults[arenaIndex] = {
    ...currentResult,
    won: playerWin,
    status: playerWin ? "won" : "blocked",
    explanation: playerWin
      ? `Victoire réelle contre ${currentArena.name}. ${winnerName} termine le duel pour ton équipe.`
      : `Défaite réelle contre ${currentArena.name}. ${winnerName} bloque la progression de la run.`,
  };

  if (!playerWin) {
    for (let index = arenaIndex + 1; index < draftArenaState.badgeResults.length; index += 1) {
      draftArenaState.badgeResults[index] = {
        ...draftArenaState.badgeResults[index],
        won: false,
        status: "untried",
        explanation: "Arène non tentée car la run s'est arrêtée avant.",
      };
    }
    draftArenaState.phase = "result";
    draftArenaState.runSummary = buildDraftRunSummary(draftArenaState.teamData, draftArenaState.badgeResults, draftArenaState.synergyData);
    draftArenaState.message = `Run arrêtée contre ${currentArena.name}. ${draftArenaState.runSummary.wonCount} badge${draftArenaState.runSummary.wonCount > 1 ? "s" : ""} remporté${draftArenaState.runSummary.wonCount > 1 ? "s" : ""}.`;
    battleState.postBattleAction = {
      label: "Voir le bilan",
      action: "finishDraftArenaBattleView",
    };
    renderDraftArena();
    return;
  }

  const nextArenaIndex = arenaIndex + 1;
  if (nextArenaIndex >= arenas.length) {
    draftArenaState.phase = "result";
    draftArenaState.currentArenaIndex = arenas.length;
    draftArenaState.runSummary = buildDraftRunSummary(draftArenaState.teamData, draftArenaState.badgeResults, draftArenaState.synergyData);
    draftArenaState.message = `Run parfaite sur ${draftGenLabel(draftArenaState.selectedGen)}. Les ${draftArenaState.runSummary.wonCount} arènes sont remportées.`;
    battleState.postBattleAction = {
      label: "Voir le bilan",
      action: "finishDraftArenaBattleView",
    };
    renderDraftArena();
    return;
  }

  draftArenaState.currentArenaIndex = nextArenaIndex;
  draftArenaState.badgeResults = draftArenaState.badgeResults.map((result, index) => {
    if (index === nextArenaIndex) {
      return { ...result, status: "pending" };
    }
    if (index > nextArenaIndex && result.status !== "won") {
      return { ...result, status: "untried" };
    }
    return result;
  });
  draftArenaState.phase = "battle";
  draftArenaState.runSummary = buildDraftArenaLiveSummary(draftArenaState.teamData, draftArenaState.badgeResults, draftArenaState.synergyData, arenas[nextArenaIndex]);
  draftArenaState.message = `Badge obtenu. Prochaine arène : ${arenas[nextArenaIndex].name} (${arenas[nextArenaIndex].type}).`;
  battleState.postBattleAction = {
    label: "Arène suivante",
    action: "continueDraftArenaBattleRun",
  };
  renderDraftArena();
}

async function launchDraftArenaBattle() {
  if (!draftArenaState) return null;
  if (draftArenaState.team.length < DRAFT_TEAM_SIZE) return null;

  if (!draftArenaState.badgeResults.length || !draftArenaState.teamData?.length || !draftArenaState.synergyData) {
    const prepared = await prepareDraftArenaBattleRun();
    if (!prepared || !draftArenaState) return null;
  }

  const currentArena = getDraftArenaCurrentArena();
  if (!currentArena) return null;

  const playerDraftTeam = getDraftSimpleBattlePlayerTeamEntries();
  const enemyDraftTeam = buildDraftArenaEnemyTeamEntries(currentArena, playerDraftTeam);
  const state = createDraftSimpleBattleDevUiState(playerDraftTeam, enemyDraftTeam, {
    mode: "arena-run",
    title: `Arène ${draftArenaState.currentArenaIndex + 1} • ${currentArena.name}`,
    arena: currentArena,
    onFinish: updateDraftArenaRunAfterBattle,
  });
  if (!state) return null;

  draftArenaState.enemyBattleTeam = enemyDraftTeam;
  draftSimpleBattleDevUiState = state;
  draftSimpleBattleDevUiState.showPreview = true;
  draftSimpleBattleDevUiState.showIntro = false;
  renderDraftSimpleBattleDevPanel(state);
  document.getElementById("draft-battle-close")?.classList.remove("hidden");
  return state;
}

function continueDraftArenaBattleRun() {
  clearDraftSimpleBattleDevPanel();
  return launchDraftArenaBattle();
}

function finishDraftArenaBattleView() {
  clearDraftSimpleBattleDevPanel();
  renderDraftArena();
  return draftArenaState;
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
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
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

  const dexId = getDraftPoolEntryKey(picked.pokemon);
  if (draftArenaState.selectedDexIds.has(dexId)) return;

  draftArenaState.team.push({ pokemon: picked.pokemon, shiny: picked.shiny });
  draftArenaState.selectedDexIds.add(dexId);
  if (picked.shiny) draftArenaState.shinyCount += 1;

  if (draftArenaState.team.length >= DRAFT_TEAM_SIZE) {
    const prepared = await prepareDraftArenaBattleRun();
    if (prepared) {
      await launchDraftArenaBattle();
    }
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
  const battleLaunch = document.getElementById("draft-battle-launch");
  const battleClose = document.getElementById("draft-battle-close");
  const battlePokemonSelect = document.getElementById("draft-battle-pokemon");
  const arenas = DRAFT_ARENAS_BY_GEN[draftArenaState.selectedGen] || [];

  if (status) status.textContent = draftArenaState.message;
  if (genBadge) genBadge.textContent = draftArenaState.selectedGen ? `Génération : ${draftGenLabel(draftArenaState.selectedGen)}` : "Génération : -";
  if (picksBadge) picksBadge.textContent = `Équipe : ${draftArenaState.team.length} / ${DRAFT_TEAM_SIZE}`;
  if (shinyBadge) shinyBadge.textContent = `Shiny : ${draftArenaState.shinyCount}`;
  const wonCount = draftArenaState.badgeResults.filter((result) => result.status === "won").length;

  const progressRatio = Math.max(0, Math.min(1, (draftArenaState.team.length || 0) / DRAFT_TEAM_SIZE));
  const progressWrap = screen.querySelector(".draft-progress");
  if (progressWrap) {
    progressWrap.style.setProperty("--draft-progress-fill", `${Math.round(progressRatio * 100)}%`);
    progressWrap.dataset.stage = draftArenaState.team.length >= DRAFT_TEAM_SIZE ? "ready" : draftArenaState.selectedGen ? "drafting" : "idle";
  }
  if (genBadge) genBadge.dataset.state = draftArenaState.selectedGen ? "selected" : "empty";
  if (picksBadge) picksBadge.dataset.state = draftArenaState.team.length >= DRAFT_TEAM_SIZE ? "complete" : draftArenaState.team.length > 0 ? "progress" : "empty";
  if (badgeCount) badgeCount.dataset.state = wonCount > 0 ? "active" : "empty";
  if (badgeCount) badgeCount.textContent = `Badges : ${wonCount} / 8`;

  if (battlePokemonSelect) {
    const battleTeam = draftArenaState.team.filter((entry) => entry?.pokemon);
    const hasMultipleChoices = battleTeam.length > 1;
    const selectedId = Number(draftArenaState.selectedBattlePokemonId) || battleTeam[0]?.pokemon?.id || "";

    if (battleTeam.length && !battleTeam.some((entry) => Number(entry.pokemon.id) === Number(selectedId))) {
      draftArenaState.selectedBattlePokemonId = battleTeam[0].pokemon.id;
    } else if (!battleTeam.length) {
      draftArenaState.selectedBattlePokemonId = null;
    }

    battlePokemonSelect.innerHTML = battleTeam.length
      ? battleTeam.map((entry) => `<option value="${entry.pokemon.id}">${escapeHtml(entry.pokemon.name)}</option>`).join("")
      : `<option value="">Pokémon du joueur indisponible</option>`;
    battlePokemonSelect.disabled = battleTeam.length <= 1;
    battlePokemonSelect.value = String(draftArenaState.selectedBattlePokemonId || battleTeam[0]?.pokemon?.id || "");
    battlePokemonSelect.title = hasMultipleChoices
      ? "Choisis le Pokémon à envoyer au duel."
      : battleTeam.length === 1
        ? "Un seul Pokémon disponible pour le duel."
        : "Drafte au moins un Pokémon pour lancer le duel.";
  }

  if (battleLaunch) {
    const battleMeta = buildDraftArenaBattleButtonMeta();
    battleLaunch.disabled = battleMeta.disabled;
    battleLaunch.title = battleMeta.title;
    battleLaunch.textContent = battleMeta.label;
    battleLaunch.dataset.state = battleMeta.disabled ? "locked" : draftArenaState.team.length >= DRAFT_TEAM_SIZE ? "ready" : "idle";
  }
  if (battleClose && (!draftSimpleBattleDevUiState || document.getElementById("draft-dev-battle-panel")?.classList.contains("hidden"))) {
    battleClose.classList.add("hidden");
  }

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
    } else if (draftArenaState.phase === "result" || draftArenaState.phase === "battle") {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      msg.textContent = draftArenaState.evaluating
        ? "Préparation de la run en cours..."
        : draftArenaState.phase === "battle"
          ? "Ton équipe est prête. Lance ou poursuis l’arène en cours."
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
          <span class="draft-card-meta">Stat global ${metrics.statGlobal} • ${escapeHtml(metrics.rarityLabel)}</span>
          <div class="draft-type-row">${typeBadgesHtml(option.pokemon.type1, option.pokemon.type2)}</div>
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
        empty.innerHTML = `
          <div class="draft-team-card-body">
            <small class="draft-team-slot-label">Slot ${index + 1}</small>
            <b>En attente</b>
            <span>Choisis un Pokémon pour compléter l’équipe.</span>
          </div>
        `;
        team.appendChild(empty);
        continue;
      }

      const normalSprite = getPokemonSprite(member.pokemon);
      const shownSprite = member.shiny ? getPokemonShinySprite(member.pokemon) : normalSprite;
      const item = document.createElement("div");
      const metrics = getDraftCachedPokemonPowerData(member.pokemon);
      const isLatest = index === draftArenaState.team.length - 1;
      const typesHtml = [member.pokemon.type1, member.pokemon.type2].filter(Boolean).map((type) => typeBadgeHtml(type)).join("");
      item.className = "draft-team-card" + (member.shiny ? " is-shiny" : "") + (isLatest ? " is-latest" : " is-filled");
      item.innerHTML = `
        <img src="${shownSprite}" alt="${escapeHtml(member.pokemon.name)}" loading="lazy" onerror="this.onerror=null;this.src='${normalSprite}'" />
        <div class="draft-team-card-body">
          <small class="draft-team-slot-label">Slot ${index + 1}${isLatest ? " • Nouveau" : ""}</small>
          <b>${escapeHtml(member.pokemon.name)}</b>
          <div class="draft-team-card-types">${typesHtml}</div>
          <small>Stat global ${metrics.statGlobal} • ${escapeHtml(metrics.rarityLabel)}</small>
        </div>
      `;
      team.appendChild(item);
    }
  }

  if (teamMetrics) {
    const currentTeamStatGlobal = draftArenaState.team.reduce((sum, member) => sum + (getDraftCachedPokemonPowerData(member.pokemon).statGlobal || 0), 0);
    const currentSynergy = draftArenaState.team.length ? getDraftTeamSynergy(draftArenaState.team.map((member) => ({ ...member, metrics: getDraftCachedPokemonPowerData(member.pokemon) }))) : null;
    teamMetrics.innerHTML = draftArenaState.team.length
      ? `
        <div class="draft-summary-card"><span>Stat global total</span><b>${currentTeamStatGlobal}</b></div>
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
    resultWrap.classList.toggle("hidden", draftArenaState.phase !== "result" && draftArenaState.phase !== "battle");
  }
  if (detailToggle) {
    detailToggle.textContent = draftArenaState.showDetailedAnalysis ? "Masquer l'analyse détaillée" : "Voir l'analyse détaillée";
    detailToggle.classList.toggle("hidden", draftArenaState.phase !== "result" && draftArenaState.phase !== "battle");
  }

  if (runSummary) {
    if (draftArenaState.phase !== "result" && draftArenaState.phase !== "battle") {
      runSummary.innerHTML = "";
    } else if (draftArenaState.evaluating) {
      runSummary.innerHTML = `<div class="draft-summary-card wide"><span>Analyse</span><b>Préparation de la run en cours...</b></div>`;
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
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
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
    "stat-clash": "Stat Clash 1v1",
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
  ['screen-profile','screen-achievements','screen-history','screen-odd-one-out','screen-multiplayer','screen-games-ranking','screen-type-chart','screen-team-builder','screen-teams','screen-stat-clash'].forEach(hideScreen);
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
  hideScreen("screen-team-builder");
  hideScreen("screen-teams");
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
    lastGuessFocusKey: "",
    pendingGuessSubmit: false,
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

  multiplayerSocket.on("duel:room-closed", (payload = {}) => {
    resetMultiplayerLiveSession();
    setMultiplayerError(payload.reason || "La room a été fermée.");
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
        <button class="btn-red" type="button" onclick="hideMultiplayerWinOverlay(); restartMultiplayerRound('same')">Rejouer pareil</button>
        <button class="btn-blue" type="button" onclick="hideMultiplayerWinOverlay(); restartMultiplayerRound('updated')">Relancer avec ces générations</button>
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
  ensureMultiplayerGuessInputBindings();

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
    ensureMultiplayerLiveState().lastGuessFocusKey = "";
    ensureMultiplayerLiveState().pendingGuessSubmit = false;
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
    updateMultiplayerGuessSubmitState();
    focusMultiplayerGuessInputIfReady();
    return;
  }

  if (isFinished) {
    ensureMultiplayerLiveState().lastGuessFocusKey = "";
    ensureMultiplayerLiveState().pendingGuessSubmit = false;
    if (roundStatus) roundStatus.textContent = "Terminé";
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
  hideScreen("screen-team-builder");
  hideScreen("screen-teams");
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



