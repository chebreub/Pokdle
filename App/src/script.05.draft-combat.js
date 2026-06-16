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
  // Équilibrage chantier B (2026-06-11) : l'ancien pool (base + 35) faisait des
  // combats en 1-2 coups (ex. Kabuto 65 PV vs Séisme STAB x2 ≈ 70 dégâts).
  // Nouveau pool : un STAB super-efficace ≈ 60-70 % des PV, un coup neutre ≈ 15-25 %.
  return clampDraftSimpleBattleHp(Math.round((Number(baseHp) || 0) * 1.2) + 70);
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
  const critMultiplier = critical ? 1.5 : 1;
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
  // Chantier B : une capacité connue de la bibliothèque mais sans type (Attraction,
  // Métronome, Abri...) est Normal — l'ancien fallback lui collait le type du Pokémon.
  const moveType = override?.type || entry?.types?.[0] || (entry ? "Normal" : (pokemon?.type1 || "Normal"));
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
  playPokemonCry(battler?.pokemon);
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
      ? `type="button" data-action="selectDraftSimpleBattlePreviewLead" data-args='[${index}]' aria-label="Choisir ${escapeHtml(member.pokemon.name)} comme Pokémon de départ"`
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
      <button type="button" class="btn-ghost" data-action="clearDraftSimpleBattleDevPanel">Fermer</button>
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

let __gbaMenuView = "main";
function setGbaMenuView(view) {
  __gbaMenuView = view === "moves" ? "moves" : "main";
  playGbaMenuBlip();
  if (draftSimpleBattleDevUiState) {
    renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
  }
}

