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
  xp: 0,
  dailyQuests: null,
  dailyQuestsDate: null,
  dailyLoginStreak: 0,
  lastDailyLogin: null,
  totalQuestsCompleted: 0,
  // Records par mode (P4)
  partyHighScore: 0,
  quizHighScore: 0,
  speedrunHighScore: 0,
  oddOneOutHighScore: 0,
  weightBattleHighScore: 0,
};

// === ENGAGEMENT — XP + quêtes quotidiennes ===
const XP_TIERS = [
  { level: 1, name: "Recrue", emoji: "🥚", minXp: 0 },
  { level: 2, name: "Novice", emoji: "🐣", minXp: 100 },
  { level: 3, name: "Apprenti", emoji: "🌱", minXp: 300 },
  { level: 4, name: "Dresseur", emoji: "🔥", minXp: 700 },
  { level: 5, name: "Expert", emoji: "⚡", minXp: 1500 },
  { level: 6, name: "Vétéran", emoji: "💎", minXp: 3000 },
  { level: 7, name: "Champion", emoji: "🏆", minXp: 6000 },
  { level: 8, name: "Maître", emoji: "👑", minXp: 12000 },
  { level: 9, name: "Légende", emoji: "🌟", minXp: 25000 },
  { level: 10, name: "Mythe Pokémon", emoji: "✨", minXp: 50000 },
];

const QUEST_POOL = [
  { id: "win_daily", icon: "📅", label: "Gagne le Pokédle du jour", target: 1, xp: 80 },
  { id: "play_3_modes", icon: "🎲", label: "Joue à 3 modes différents", target: 3, xp: 70 },
  { id: "hl_streak_10", icon: "📊", label: "10 d'affilée en Higher or Lower", target: 10, xp: 90 },
  { id: "score_attack_500", icon: "🎯", label: "500+ de moyenne BST en Score Attack", target: 500, xp: 80, comparator: "gte" },
  { id: "score_attack_600", icon: "👑", label: "600+ BST en Score Attack (Master)", target: 600, xp: 150, comparator: "gte" },
  { id: "stat_clash_win", icon: "⚔️", label: "Gagne 1 Stat Clash", target: 1, xp: 70 },
  { id: "connections_clear", icon: "🧩", label: "Résous un Poké-Connections", target: 1, xp: 100 },
  { id: "stat_auction_win", icon: "💰", label: "Gagne 1 Stat Auction", target: 1, xp: 80 },
  { id: "draft_complete", icon: "🏟️", label: "Termine un draft d'équipe", target: 1, xp: 50 },
  { id: "pokedex_browse", icon: "📖", label: "Consulte le Pokédex aujourd'hui", target: 1, xp: 30 },
];

function getXpTier(xp = 0) {
  let tier = XP_TIERS[0];
  for (const t of XP_TIERS) if (xp >= t.minXp) tier = t;
  return tier;
}

function getXpProgress(xp = 0) {
  const cur = getXpTier(xp);
  const next = XP_TIERS.find((t) => t.level > cur.level) || null;
  if (!next) return { tier: cur, next: null, percent: 100, xpInTier: xp - cur.minXp, xpToNext: 0 };
  const xpInTier = xp - cur.minXp;
  const xpToNext = next.minXp - cur.minXp;
  return { tier: cur, next, percent: Math.min(100, Math.round((xpInTier / xpToNext) * 100)), xpInTier, xpToNext };
}

function getDailyQuestKey() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDailyQuests() {
  if (!playerProfile) return [];
  const todayKey = getDailyQuestKey();
  if (playerProfile.dailyQuestsDate === todayKey && Array.isArray(playerProfile.dailyQuests)) return playerProfile.dailyQuests;
  // Génère 4 quêtes aléatoires depuis QUEST_POOL (seed basé sur la date pour stabilité dans la journée)
  const seed = Date.parse(todayKey + "T00:00:00Z");
  const rnd = (idx) => {
    const x = Math.sin(seed + idx * 9301) * 233280;
    return x - Math.floor(x);
  };
  const shuffled = QUEST_POOL.slice().map((q, i) => ({ q, r: rnd(i) })).sort((a, b) => a.r - b.r).map((entry) => entry.q);
  const picked = shuffled.slice(0, 4).map((q) => ({ ...q, progress: 0, completed: false }));
  playerProfile.dailyQuests = picked;
  playerProfile.dailyQuestsDate = todayKey;
  try { saveProfile(); } catch (_e) {}
  return picked;
}

function awardXp(amount, source = "") {
  if (!playerProfile || !Number.isFinite(amount) || amount <= 0) return;
  const prevTier = getXpTier(playerProfile.xp || 0);
  playerProfile.xp = Math.max(0, (Number(playerProfile.xp) || 0) + Math.round(amount));
  const newTier = getXpTier(playerProfile.xp);
  try { saveProfile(); } catch (_e) {}
  showXpToast(`+${Math.round(amount)} XP${source ? ` · ${source}` : ""}`);
  if (newTier.level > prevTier.level) {
    setTimeout(() => showXpToast(`🎉 Niveau ${newTier.level} — ${newTier.name} ${newTier.emoji}`, "is-levelup"), 700);
  }
  updateXpBadge();
}

function progressQuest(questId, amount = 1) {
  if (!playerProfile || !questId) return;
  const quests = ensureDailyQuests();
  const quest = quests.find((q) => q.id === questId);
  if (!quest || quest.completed) return;
  if (quest.comparator === "gte") {
    quest.progress = Math.max(quest.progress || 0, Number(amount) || 0);
  } else {
    quest.progress = (quest.progress || 0) + (Number(amount) || 0);
  }
  if (quest.progress >= quest.target) {
    quest.completed = true;
    quest.completedAt = Date.now();
    playerProfile.totalQuestsCompleted = (Number(playerProfile.totalQuestsCompleted) || 0) + 1;
    awardXp(quest.xp, `Quête : ${quest.label}`);
    try { saveProfile(); } catch (_e) {}
  } else {
    try { saveProfile(); } catch (_e) {}
  }
  updateXpBadge();
}

function showXpToast(message, extraClass = "") {
  let toast = document.getElementById("xp-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "xp-toast";
    toast.className = "xp-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `xp-toast is-visible ${extraClass}`;
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove("is-visible", "is-levelup"), 2400);
}

function openDailyQuestsModal() {
  const quests = ensureDailyQuests();
  const xp = Number(playerProfile?.xp) || 0;
  const prog = getXpProgress(xp);
  const completedCount = quests.filter((q) => q.completed).length;
  let overlay = document.getElementById("daily-quests-overlay");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "daily-quests-overlay";
  overlay.className = "daily-quests-overlay";
  overlay.innerHTML = `
    <div class="dq-backdrop" onclick="closeDailyQuestsModal()"></div>
    <div class="dq-content" role="dialog" aria-modal="true">
      <button class="dq-close" type="button" onclick="closeDailyQuestsModal()" aria-label="Fermer">×</button>
      <div class="dq-hero">
        <div class="dq-hero-tier"><span class="dq-hero-emoji">${prog.tier.emoji}</span><div><b>Niveau ${prog.tier.level} · ${escapeHtml(prog.tier.name)}</b><small>${xp} XP${prog.next ? ` · ${prog.next.minXp - xp} avant Niv. ${prog.next.level}` : ""}</small></div></div>
        <div class="dq-hero-bar"><div class="dq-hero-fill" style="width:${prog.percent}%"></div></div>
      </div>
      <div class="dq-header">
        <h3>🎯 Quêtes du jour</h3>
        <span class="dq-progress">${completedCount} / ${quests.length} terminée${completedCount > 1 ? "s" : ""}</span>
      </div>
      <div class="dq-list">
        ${quests.map((q) => {
          const pct = Math.min(100, Math.round(((q.progress || 0) / q.target) * 100));
          return `<div class="dq-item ${q.completed ? "is-done" : ""}">
            <div class="dq-item-head"><b>${escapeHtml(q.label)}</b><span class="dq-xp">+${q.xp} XP</span></div>
            <div class="dq-item-bar"><div class="dq-item-fill" style="width:${pct}%"></div></div>
            <div class="dq-item-meta"><span>${q.progress || 0} / ${q.target}</span>${q.completed ? '<span class="dq-done-tag">✅ Réussi</span>' : ""}</div>
          </div>`;
        }).join("")}
      </div>
      <div class="dq-actions">
        <button class="btn-red" type="button" onclick="shareLevelBadge()">📋 Partager mon niveau</button>
      </div>
      <p class="dq-footer">Nouvelles quêtes chaque jour à minuit · Total quêtes : <b>${Number(playerProfile?.totalQuestsCompleted) || 0}</b>${Number(playerProfile?.dailyLoginStreak) > 1 ? ` · 🔥 <b>${playerProfile.dailyLoginStreak}</b> jours d'affilée` : ""}</p>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
}

function closeDailyQuestsModal() {
  const overlay = document.getElementById("daily-quests-overlay");
  if (overlay) {
    overlay.classList.remove("is-visible");
    setTimeout(() => overlay.remove(), 250);
  }
}

window.openDailyQuestsModal = openDailyQuestsModal;
window.closeDailyQuestsModal = closeDailyQuestsModal;

// === PARTAGE SOCIAL — copy text Wordle-style ===
async function copyShareText(text, successMessage = "📋 Copié dans le presse-papier !") {
  if (!text) return false;
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (_e) { copied = false; }
  if (!copied) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand("copy");
      textarea.remove();
    } catch (_e) { copied = false; }
  }
  if (copied) {
    showXpToast(successMessage);
  } else {
    window.prompt("Copie ce texte :", text);
  }
  return copied;
}

function shareScoreAttackResult() {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack") return;
  const metrics = getDraftTeamBstMetrics(draftArenaState.team);
  if (!metrics?.average) return;
  const gen = draftArenaState.selectedGen ? `Gen ${draftArenaState.selectedGen}` : "Gen ?";
  const rank = getDraftScoreAttackResultLabel(metrics.average);
  const xp = Number(playerProfile?.xp) || 0;
  const tier = getXpTier(xp);
  const text = `🎯 Score Attack ${gen} : ${metrics.average} BST (${rank})
${tier.emoji} Niveau ${tier.level} · ${tier.name}
👉 https://pokdle.onrender.com`;
  copyShareText(text);
}

function generateScoreImagePng({ title, mainScore, mainLabel, subtitle, accentFrom = "#ff6b35", accentTo = "#ff3d7f" }) {
  return new Promise((resolve) => {
    const W = 1080, H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    // Background dégradé
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0e1e");
    bg.addColorStop(1, "#1c2745");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // Orbe lumineuse accent
    const orb = ctx.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, 600);
    orb.addColorStop(0, accentFrom + "55");
    orb.addColorStop(1, "transparent");
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, W, H);
    const orb2 = ctx.createRadialGradient(W * 0.15, H * 0.85, 0, W * 0.15, H * 0.85, 500);
    orb2.addColorStop(0, accentTo + "44");
    orb2.addColorStop(1, "transparent");
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, W, H);
    // Logo header "Pokédle"
    ctx.font = "900 56px Nunito, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("Pokédle", W / 2, 130);
    // Title
    ctx.font = "800 44px Nunito, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(title, W / 2, 230);
    // Score gradient
    const scoreGrad = ctx.createLinearGradient(0, 350, 0, 700);
    scoreGrad.addColorStop(0, accentFrom);
    scoreGrad.addColorStop(1, accentTo);
    ctx.fillStyle = scoreGrad;
    ctx.font = "900 280px Nunito, system-ui, sans-serif";
    ctx.fillText(String(mainScore), W / 2, 600);
    // Label
    ctx.font = "700 38px Nunito, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fillText(mainLabel, W / 2, 700);
    // Subtitle (niveau)
    ctx.font = "700 32px Nunito, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.fillText(subtitle, W / 2, 870);
    // URL bottom
    ctx.font = "800 28px Nunito, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.fillText("pokdle.onrender.com", W / 2, 1000);
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function downloadScoreImage(filename, options) {
  try {
    const blob = await generateScoreImagePng(options);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "pokedle-score.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    showXpToast("💾 Image sauvegardée");
  } catch (_e) {
    showXpToast("❌ Erreur lors de la génération");
  }
}

function downloadHigherLowerImage() {
  if (!higherLowerState) return;
  const xp = Number(playerProfile?.xp) || 0;
  const tier = getXpTier(xp);
  downloadScoreImage(`pokedle-hl-${higherLowerState.score}.png`, {
    title: "Higher or Lower",
    mainScore: higherLowerState.score,
    mainLabel: higherLowerState.mode === "rush60" ? "d'affilée en 60s" : "d'affilée",
    subtitle: `${tier.emoji} Niv. ${tier.level} · ${tier.name}`,
  });
}
window.downloadHigherLowerImage = downloadHigherLowerImage;

function shareHigherLowerResult() {
  if (!higherLowerState) return;
  const score = higherLowerState.score || 0;
  const record = higherLowerState.highScore || 0;
  const xp = Number(playerProfile?.xp) || 0;
  const tier = getXpTier(xp);
  const newRecord = score > 0 && score >= record;
  const text = `🎯 Higher or Lower : ${score} d'affilée${newRecord ? " 🏆 NOUVEAU RECORD !" : ""}
${tier.emoji} Niveau ${tier.level} · ${tier.name}
👉 https://pokdle.onrender.com`;
  copyShareText(text);
}

function shareLevelBadge() {
  if (!playerProfile) return;
  const xp = Number(playerProfile.xp) || 0;
  const tier = getXpTier(xp);
  const prog = getXpProgress(xp);
  const text = `${tier.emoji} Niveau ${tier.level} · ${tier.name}
🎯 ${xp} XP${prog.next ? ` · ${prog.next.minXp - xp} avant Niv. ${prog.next.level}` : " · MAX"}
🏆 ${Number(playerProfile.totalQuestsCompleted) || 0} quêtes réussies
👉 https://pokdle.onrender.com`;
  copyShareText(text);
}

window.shareScoreAttackResult = shareScoreAttackResult;
window.shareHigherLowerResult = shareHigherLowerResult;
window.shareLevelBadge = shareLevelBadge;

function updateXpBadge() {
  const badge = document.getElementById("global-xp-badge");
  if (!badge || !playerProfile) return;
  const xp = Number(playerProfile.xp) || 0;
  const prog = getXpProgress(xp);
  badge.innerHTML = `<span class="xp-badge-emoji">${prog.tier.emoji}</span><span class="xp-badge-info"><b>Niv. ${prog.tier.level} · ${escapeHtml(prog.tier.name)}</b><small>${xp} XP${prog.next ? ` · ${prog.next.minXp - xp} avant Niv. ${prog.next.level}` : " · Max"}</small></span><div class="xp-badge-bar"><div class="xp-badge-fill" style="width:${prog.percent}%"></div></div>`;
  renderHomeEngagementWidget();
}

function renderHomeEngagementWidget() {
  const widget = document.getElementById("home-engagement-widget");
  if (!widget || !playerProfile) return;
  const xp = Number(playerProfile.xp) || 0;
  const prog = getXpProgress(xp);
  const streak = Number(playerProfile.dailyLoginStreak) || 0;
  const totalQuests = Number(playerProfile.totalQuestsCompleted) || 0;
  const quests = ensureDailyQuests();
  const completedToday = quests.filter((q) => q.completed).length;
  const totalToday = quests.length;
  // Affichage seulement si l'utilisateur a déjà commencé (xp > 0 OU streak > 0)
  if (xp === 0 && streak === 0 && totalQuests === 0) {
    widget.innerHTML = `
      <div class="home-engagement-bar is-newcomer">
        <div class="heb-tier">
          <div class="heb-tier-emoji">🥚</div>
          <div class="heb-tier-info">
            <b>Bienvenue Dresseur !</b>
            <span>Joue pour gagner de l'XP + débloquer tes quêtes quotidiennes</span>
          </div>
        </div>
      </div>`;
    return;
  }
  // Widget compact : bandeau horizontal avec niveau + barre XP + chips quêtes/streak + CTA
  widget.innerHTML = `
    <div class="home-engagement-bar" onclick="openDailyQuestsModal()" role="button" tabindex="0" onkeydown="if(event.key==='Enter')openDailyQuestsModal()" aria-label="Voir mes quêtes quotidiennes">
      <div class="heb-tier">
        <div class="heb-tier-emoji">${prog.tier.emoji}</div>
        <div class="heb-tier-info">
          <b>Niv. ${prog.tier.level} · ${escapeHtml(prog.tier.name)}</b>
          <span>${xp} XP${prog.next ? ` · ${prog.next.minXp - xp} avant ${prog.next.emoji}` : " · MAX"}</span>
        </div>
      </div>
      <div class="heb-bar"><div class="heb-bar-fill" style="width:${prog.percent}%"></div></div>
      <div class="heb-chips">
        ${streak > 0 ? `<span class="heb-chip is-streak" title="${streak} jour${streak > 1 ? "s" : ""} d'affilée">🔥 ${streak}</span>` : ""}
        <span class="heb-chip is-quests" title="${completedToday} quête${completedToday !== 1 ? "s" : ""} terminée${completedToday !== 1 ? "s" : ""} sur ${totalToday}">🎯 ${completedToday}/${totalToday}</span>
      </div>
      <span class="heb-cta">Quêtes →</span>
    </div>`;
}
window.renderHomeEngagementWidget = renderHomeEngagementWidget;

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
  { id: 20039, name: "Pharamp Mega", baseId: 181, gen: 6, type2: "Dragon" },
  { id: 20040, name: "Cizayox Mega", baseId: 212, gen: 6 },
  { id: 20041, name: "Scarhino Mega", baseId: 214, gen: 6 },
  { id: 20042, name: "Tyranocif Mega", baseId: 248, gen: 6 },
  { id: 20043, name: "Braségali Mega", baseId: 257, gen: 6 },
  { id: 20044, name: "Rayquaza Mega", baseId: 384, gen: 6 },
  { id: 20045, name: "Nanméouïe Mega", baseId: 531, gen: 6, type2: "Fée" },
  { id: 20046, name: "Mélodelfe Mega", baseId: 36, gen: 6, type1: "Fée", type2: "Vol" },
  { id: 20047, name: "Empiflor Mega", baseId: 71, gen: 6, type1: "Plante", type2: "Poison" },
  { id: 20048, name: "Staross Mega", baseId: 121, gen: 6, type1: "Eau", type2: "Psy" },
  { id: 20049, name: "Dracolosse Mega", baseId: 149, gen: 6, type1: "Dragon", type2: "Vol" },
  { id: 20050, name: "Méganium Mega", baseId: 154, gen: 6, type1: "Plante", type2: "Fée" },
  { id: 20051, name: "Aligatueur Mega", baseId: 160, gen: 6, type1: "Eau", type2: "Dragon" },
  { id: 20052, name: "Airmure Mega", baseId: 227, gen: 6, type1: "Acier", type2: "Vol" },
  { id: 20053, name: "Momartik Mega", baseId: 478, gen: 6, type1: "Glace", type2: "Spectre" },
  { id: 20054, name: "Roitiflam Mega", baseId: 500, gen: 6, type1: "Feu", type2: "Combat" },
  { id: 20055, name: "Minotaupe Mega", baseId: 530, gen: 6, type1: "Sol", type2: "Acier" },
  { id: 20056, name: "Brutapode Mega", baseId: 545, gen: 6, type1: "Insecte", type2: "Poison" },
  { id: 20057, name: "Baggaïd Mega", baseId: 560, gen: 6, type1: "Ténèbres", type2: "Combat" },
  { id: 20058, name: "Ohmassacre Mega", baseId: 604, gen: 6, type1: "Électrik", type2: null },
  { id: 20059, name: "Lugulabre Mega", baseId: 609, gen: 6, type1: "Spectre", type2: "Feu" },
  { id: 20060, name: "Blindépique Mega", baseId: 652, gen: 6, type1: "Plante", type2: "Combat" },
  { id: 20061, name: "Goupelin Mega", baseId: 655, gen: 6, type1: "Feu", type2: "Psy" },
  { id: 20062, name: "Amphinobi Mega", baseId: 658, gen: 6, type1: "Eau", type2: "Ténèbres" },
  { id: 20063, name: "Némélios Mega", baseId: 668, gen: 6, type1: "Feu", type2: "Normal" },
  { id: 20064, name: "Floette Mega", baseId: 670, gen: 6, type1: "Fée", type2: null },
  { id: 20065, name: "Sepiatroce Mega", baseId: 687, gen: 6, type1: "Ténèbres", type2: "Psy" },
  { id: 20066, name: "Golgopathe Mega", baseId: 689, gen: 6, type1: "Roche", type2: "Combat" },
  { id: 20067, name: "Kravarech Mega", baseId: 691, gen: 6, type1: "Poison", type2: "Dragon" },
  { id: 20068, name: "Brutalibré Mega", baseId: 701, gen: 6, type1: "Combat", type2: "Vol" },
  { id: 20069, name: "Zygarde Mega", baseId: 718, gen: 6, type1: "Dragon", type2: "Sol" },
  { id: 20070, name: "Draïeul Mega", baseId: 780, gen: 6, type1: "Normal", type2: "Dragon" },
  { id: 20071, name: "Hexadron Mega", baseId: 870, gen: 6, type1: "Combat", type2: null },

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

  { id: 25014, name: "Groudon Primo", baseId: 383, gen: 6, type1: "Sol", type2: "Feu" },
  { id: 25015, name: "Kyogre Primo", baseId: 382, gen: 6, type1: "Eau", type2: null },
  { id: 25016, name: "Zacian Forme Épée Royale", baseId: 888, gen: 8, type1: "Fée", type2: "Acier" },
  { id: 25017, name: "Zamazenta Forme Bouclier Royal", baseId: 889, gen: 8, type1: "Combat", type2: "Acier" },
  { id: 25018, name: "Necrozma Crinière du Couchant", baseId: 800, gen: 7, type1: "Psy", type2: "Acier" },
  { id: 25019, name: "Necrozma Ailes de l'Aurore", baseId: 800, gen: 7, type1: "Psy", type2: "Spectre" },
  { id: 25020, name: "Ultra-Necrozma", baseId: 800, gen: 7, type1: "Psy", type2: "Dragon" },
  { id: 25021, name: "Hoopa Déchaîné", baseId: 720, gen: 6, type1: "Psy", type2: "Ténèbres" },
  { id: 25022, name: "Kyurem Blanc", baseId: 646, gen: 5, type1: "Dragon", type2: "Glace" },
  { id: 25023, name: "Kyurem Noir", baseId: 646, gen: 5, type1: "Dragon", type2: "Glace" },
  { id: 25024, name: "Sylveroy Cavalier du Froid", baseId: 898, gen: 8, type1: "Psy", type2: "Glace" },
  { id: 25025, name: "Sylveroy Cavalier d'Effroi", baseId: 898, gen: 8, type1: "Psy", type2: "Spectre" },
  { id: 25026, name: "Exagide Forme Lame", baseId: 681, gen: 6, type1: "Acier", type2: "Spectre" },
  { id: 25027, name: "Éthernatos Éternamax", baseId: 890, gen: 8, type1: "Poison", type2: "Dragon" },
  { id: 25028, name: "Dialga Originel", baseId: 483, gen: 4, type1: "Acier", type2: "Dragon" },
  { id: 25029, name: "Palkia Originel", baseId: 484, gen: 4, type1: "Eau", type2: "Dragon" },
  { id: 25030, name: "Zygarde 10%", baseId: 718, gen: 6, type1: "Dragon", type2: "Sol" },
  { id: 25031, name: "Zygarde Complet", baseId: 718, gen: 6, type1: "Dragon", type2: "Sol" },
  { id: 25032, name: "Genesect Module Aqua", baseId: 649, gen: 5, type1: "Insecte", type2: "Acier" },
  { id: 25033, name: "Genesect Module Chaleur", baseId: 649, gen: 5, type1: "Insecte", type2: "Acier" },
  { id: 25034, name: "Genesect Module Choc", baseId: 649, gen: 5, type1: "Insecte", type2: "Acier" },
  { id: 25035, name: "Genesect Module Froid", baseId: 649, gen: 5, type1: "Insecte", type2: "Acier" },
  { id: 25036, name: "Floette Fleur Éternelle", baseId: 670, gen: 6, type1: "Fée", type2: null },
  { id: 25037, name: "Amphinobi Ash", baseId: 658, gen: 6, type1: "Eau", type2: "Ténèbres" },
  { id: 25038, name: "Wimessir Femelle", baseId: 876, gen: 8, type1: "Normal", type2: "Psy" },
  { id: 25039, name: "Mistigrix Femelle", baseId: 678, gen: 6, type1: "Psy", type2: null },
  { id: 25040, name: "Morphéo Soleil", baseId: 351, gen: 3, type1: "Feu", type2: null },
  { id: 25041, name: "Morphéo Pluie", baseId: 351, gen: 3, type1: "Eau", type2: null },
  { id: 25042, name: "Morphéo Neige", baseId: 351, gen: 3, type1: "Glace", type2: null },
  { id: 25043, name: "Ceriflor Éveil", baseId: 421, gen: 4, type1: "Plante", type2: null },
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
  "Pharamp Mega": "ampharos-mega",
  "Cizayox Mega": "scizor-mega",
  "Scarhino Mega": "heracross-mega",
  "Tyranocif Mega": "tyranitar-mega",
  "Braségali Mega": "blaziken-mega",
  "Rayquaza Mega": "rayquaza-mega",
  "Nanméouïe Mega": "audino-mega",
  "Mélodelfe Mega": "clefable-mega",
  "Empiflor Mega": "victreebel-mega",
  "Staross Mega": "starmie-mega",
  "Dracolosse Mega": "dragonite-mega",
  "Méganium Mega": "meganium-mega",
  "Aligatueur Mega": "feraligatr-mega",
  "Airmure Mega": "skarmory-mega",
  "Momartik Mega": "froslass-mega",
  "Roitiflam Mega": "emboar-mega",
  "Minotaupe Mega": "excadrill-mega",
  "Brutapode Mega": "scolipede-mega",
  "Baggaïd Mega": "scrafty-mega",
  "Ohmassacre Mega": "eelektross-mega",
  "Lugulabre Mega": "chandelure-mega",
  "Blindépique Mega": "chesnaught-mega",
  "Goupelin Mega": "delphox-mega",
  "Amphinobi Mega": "greninja-mega",
  "Némélios Mega": "pyroar-mega",
  "Floette Mega": "floette-mega",
  "Sepiatroce Mega": "malamar-mega",
  "Golgopathe Mega": "barbaracle-mega",
  "Kravarech Mega": "dragalge-mega",
  "Brutalibré Mega": "hawlucha-mega",
  "Zygarde Mega": "zygarde-mega",
  "Draïeul Mega": "drampa-mega",
  "Hexadron Mega": "falinks-mega",
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
  "Groudon Primo": "groudon-primal",
  "Kyogre Primo": "kyogre-primal",
  "Zacian Forme Épée Royale": "zacian-crowned",
  "Zamazenta Forme Bouclier Royal": "zamazenta-crowned",
  "Necrozma Crinière du Couchant": "necrozma-dusk",
  "Necrozma Ailes de l'Aurore": "necrozma-dawn",
  "Ultra-Necrozma": "necrozma-ultra",
  "Hoopa Déchaîné": "hoopa-unbound",
  "Kyurem Blanc": "kyurem-white",
  "Kyurem Noir": "kyurem-black",
  "Sylveroy Cavalier du Froid": "calyrex-ice",
  "Sylveroy Cavalier d'Effroi": "calyrex-shadow",
  "Exagide Forme Lame": "aegislash-blade",
  "Éthernatos Éternamax": "eternatus-eternamax",
  "Dialga Originel": "dialga-origin",
  "Palkia Originel": "palkia-origin",
  "Zygarde 10%": "zygarde-10",
  "Zygarde Complet": "zygarde-complete",
  "Genesect Module Aqua": "genesect-douse",
  "Genesect Module Chaleur": "genesect-burn",
  "Genesect Module Choc": "genesect-shock",
  "Genesect Module Froid": "genesect-chill",
  "Floette Fleur Éternelle": "floette-eternal",
  "Amphinobi Ash": "greninja-ash",
  "Wimessir Femelle": "indeedee-female",
  "Mistigrix Femelle": "meowstic-female",
  "Morphéo Soleil": "castform-sunny",
  "Morphéo Pluie": "castform-rainy",
  "Morphéo Neige": "castform-snowy",
  "Ceriflor Éveil": "cherrim-sunshine",
};
const EXTRA_FORM_CACHE_KEY = "pokedle_form_sprites_v2";

function loadCachedExtraFormData() {
  try {
    const raw = localStorage.getItem(EXTRA_FORM_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_err) {
    return {};
  }
}

function saveCachedExtraFormData(cache) {
  try {
    localStorage.setItem(EXTRA_FORM_CACHE_KEY, JSON.stringify(cache));
  } catch (_err) { /* quota ou indisponible — silencieux */ }
}

function injectExtraForms() {
  const byId = new Set(POKEMON_LIST.map((p) => p.id));
  const byName = new Set(POKEMON_LIST.map((p) => p.name));
  const baseById = new Map(POKEMON_LIST.map((p) => [p.id, p]));
  const cached = loadCachedExtraFormData();

  for (const form of EXTRA_FORMS) {
    if (byId.has(form.id) || byName.has(form.name)) continue;

    const base = baseById.get(form.baseId);
    if (!base) continue;

    const spriteId = Number.isInteger(form.spriteId) ? form.spriteId : base.id;
    const gen = Number.isInteger(form.gen) ? form.gen : base.gen;
    const cachedForm = cached[form.name] || null;

    const entry = {
      id: form.id,
      name: form.name,
      baseId: form.baseId,
      type1: cachedForm?.type1 || form.type1 || base.type1,
      type2: cachedForm?.type2 !== undefined ? cachedForm.type2 : (form.type2 !== undefined ? form.type2 : base.type2),
      gen,
      generation: gen,
      habitat: form.habitat || base.habitat,
      color: form.color || base.color,
      stage: Number.isInteger(form.stage) ? form.stage : base.stage,
      height: typeof cachedForm?.height === "number" ? cachedForm.height : (typeof form.height === "number" ? form.height : base.height),
      weight: typeof cachedForm?.weight === "number" ? cachedForm.weight : (typeof form.weight === "number" ? form.weight : base.weight),
      spriteId,
      sprite: cachedForm?.sprite || getSpriteUrl(spriteId),
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
  const cache = loadCachedExtraFormData();
  let dirty = false;

  await Promise.allSettled(
    forms.map(async (pokemon) => {
      const apiName = pokemon.formApiName || FORM_API_NAME_BY_NAME[pokemon.name];
      if (!apiName) return;
      // Si déjà mis à jour depuis le cache (sprite ≠ base sprite par id), skip
      const cachedEntry = cache[pokemon.name];
      if (cachedEntry?.sprite && pokemon.sprite === cachedEntry.sprite) return;

      try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
        if (!response.ok) return;

        const data = await response.json();
        const sprite = data?.sprites?.front_default
          || data?.sprites?.other?.["official-artwork"]?.front_default
          || data?.sprites?.other?.home?.front_default;
        const apiTypes = Array.isArray(data?.types)
          ? data.types
              .slice()
              .sort((a, b) => (a?.slot || 0) - (b?.slot || 0))
              .map((entry) => typeLabelFrFromApiName(entry?.type?.name))
              .filter(Boolean)
          : [];

        const formCacheEntry = cache[pokemon.name] || {};
        if (sprite) {
          pokemon.sprite = sprite;
          formCacheEntry.sprite = sprite;
        }
        if (apiTypes[0]) {
          pokemon.type1 = apiTypes[0];
          formCacheEntry.type1 = apiTypes[0];
        }
        pokemon.type2 = apiTypes[1] || null;
        formCacheEntry.type2 = apiTypes[1] || null;
        if (typeof data?.height === "number") {
          pokemon.height = data.height / 10;
          formCacheEntry.height = pokemon.height;
        }
        if (typeof data?.weight === "number") {
          pokemon.weight = data.weight / 10;
          formCacheEntry.weight = pokemon.weight;
        }
        cache[pokemon.name] = formCacheEntry;
        dirty = true;
      } catch (_err) {
        // keep base sprite fallback if API is unavailable
      }
    })
  );

  if (dirty) saveCachedExtraFormData(cache);
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
const STAT_CLASH_PICK_TIME_MS = 12000;
const STAT_CLASH_START_DELAY_MS = 1400;
const STAT_CLASH_ROLL_MS = 2600;
const STAT_CLASH_RANDOMIZER_BASE_DELAY_MS = 70;
const STAT_CLASH_RANDOMIZER_STEPS = 15;
const STAT_CLASH_LOCKED_REVEAL_DELAY_MS = 1000;
const STAT_CLASH_POST_REVEAL_DELAY_MS = 2400;
const STAT_CLASH_INTER_ROUND_DELAY_MS = 1800;
const STAT_CLASH_SCORE_ANIMATION_MS = 1600;
const STAT_CLASH_STATS = [
  { key: "hp", label: "PV", short: "PV" },
  { key: "attack", label: "Attack", short: "ATK" },
  { key: "defense", label: "Defense", short: "DEF" },
  { key: "spAttack", label: "Special Attack", short: "SPA" },
  { key: "spDefense", label: "Special Defense", short: "SPD" },
  { key: "speed", label: "Speed", short: "SPE" },
];

// === STAT CLASH — extensions DA / gameplay / règles maison ===
const STAT_CLASH_STAT_ICONS = {
  hp: "❤",
  attack: "⚔",
  defense: "🛡",
  spAttack: "✨",
  spDefense: "🌀",
  speed: "⚡",
};
const STAT_CLASH_PRESSURE_TIMER_MS = 6500;
const STAT_CLASH_FORMATS = {
  bo3: { rounds: 3, label: "Best of 3", suddenDeath: false },
  standard: { rounds: 6, label: "Standard (6 manches)", suddenDeath: false },
  bo9: { rounds: 9, label: "Best of 9", suddenDeath: false },
  suddenDeath: { rounds: 6, label: "Sudden Death", suddenDeath: true },
};
const STAT_CLASH_BOT_DIFFICULTIES = {
  easy: { label: "Facile", topPickWeight: 0.2 },
  normal: { label: "Normal", topPickWeight: 0.55 },
  hard: { label: "Difficile", topPickWeight: 1 },
};
const STAT_CLASH_HOUSE_RULES = [
  {
    id: "noSpeedEarly",
    icon: "🚫",
    label: "Vitesse interdite avant la manche 4",
    desc: "Le bouton Vitesse est verrouillé pour les deux camps jusqu'à la M4 incluse.",
  },
  {
    id: "atkRound3",
    icon: "⚔️",
    label: "Manches 3-4 : Attaque obligatoire",
    desc: "Aux 3e et 4e manches, seul le bouton Attaque est jouable.",
  },
  {
    id: "noHpFinal",
    icon: "❤️‍🩹",
    label: "2 dernières manches : pas de PV",
    desc: "Le bouton PV est verrouillé sur les deux dernières manches.",
  },
  {
    id: "weakStart",
    icon: "🪨",
    label: "Manches 1-2 : stat la plus faible imposée",
    desc: "Aux M1 et M2, seule la stat la plus basse du Pokémon est sélectionnable.",
  },
  {
    id: "pressureLate",
    icon: "⏱️",
    label: "Pression : timer 5s à partir de la moitié",
    desc: "Dès la moitié de la partie incluse, le timer est divisé par deux (5s).",
  },
  {
    id: "doubleStat",
    icon: "⭐",
    label: "Stat star — vaut double",
    desc: "Une stat tirée au sort en début de partie vaut deux fois ses points quand elle est jouée.",
  },
  {
    id: "blindRound5",
    icon: "🎲",
    label: "Manche 5 : choix imposé entre 2 stats",
    desc: "À la M5, le camp qui subit choisit entre deux stats tirées au hasard parmi ses non utilisées.",
  },
  {
    id: "mirrorRound4",
    icon: "🪞",
    label: "Manche 4 : stat imposée identique",
    desc: "À la M4, une stat est tirée au sort et imposée des deux côtés.",
  },
  {
    id: "comboBonus",
    icon: "🔥",
    label: "Combo : 3 victoires d'affilée = +2 pts",
    desc: "Un bonus de 2 pts est appliqué chaque fois qu'un camp atteint un streak de 3.",
  },
];
const STAT_CLASH_IMPOSABLE_RULE_IDS = new Set(["noSpeedEarly", "atkRound3", "noHpFinal", "weakStart", "pressureLate", "blindRound5"]);
const STAT_CLASH_SHARED_RULE_IDS = new Set(["doubleStat", "mirrorRound4", "comboBonus"]);
const STAT_CLASH_ANNOUNCER_LINES = {
  roundStart: ["Que le meilleur stat-checker gagne.", "Nouvelle manche, nouveau Pokémon.", "On serre les fesses."],
  pickedHigh: ["Choix royal !", "C'était la stat à prendre.", "Pression maximale, lecture parfaite."],
  pickedLow: ["Aïe, c'est faible…", "On y croyait pas hein ?", "Le scoreboard va piquer."],
  tieRound: ["Match nul cette manche.", "Même valeur, on continue.", "Stat lock parfait des deux côtés."],
  streak2: ["Doublé !", "Ça commence à sentir le run.", "Streak en construction."],
  streak3: ["Triplé — combo bonus !", "Le run prend feu.", "On respire plus en face."],
  finish: ["Partie terminée.", "Et voilà.", "Stats checked."],
};
function buildStatClashJokers() {
  return { reroll: 1, preview: 1, double: 1, previewKey: null, doubleArmed: false };
}
function pickRandomStatClashHouseRule() {
  const pool = STAT_CLASH_HOUSE_RULES.slice();
  return pool[Math.floor(Math.random() * pool.length)];
}
function getStatClashRuleById(ruleId) {
  return STAT_CLASH_HOUSE_RULES.find((rule) => rule.id === ruleId) || null;
}
function getRandomStatClashRuleFromSet(ruleIds) {
  const pool = STAT_CLASH_HOUSE_RULES.filter((rule) => ruleIds.has(rule.id));
  return pool[Math.floor(Math.random() * pool.length)] || null;
}
function getOppositeStatClashSide(side) {
  return side === "left" ? "right" : side === "right" ? "left" : null;
}
function getStatClashLowestStat(stats) {
  if (!stats) return null;
  let best = null;
  STAT_CLASH_STATS.forEach((entry) => {
    const value = getStatClashValue(entry.key, stats);
    if (!best || value < best.value) best = { key: entry.key, value };
  });
  return best?.key || null;
}
function getStatClashHouseRuleForcedStats(state, side) {
  if (!state || !state.houseRuleEnabled) return null;
  const imposedRule = state.houseRuleBySide?.[side] || null;
  const legacyRule = !state.houseRuleBySide && state.houseRule ? state.houseRule : null;
  const sharedRule = state.houseRuleShared || legacyRule || null;
  const rule = imposedRule?.id || legacyRule?.id;
  const round = state.round;
  const totalRounds = state.totalRounds || STAT_CLASH_ROUND_TOTAL;
  const target = legacyRule ? state.houseRuleTargetSide || null : null;
  const targetOnly = target && side && side !== target;
  if (legacyRule && (rule === "atkRound3" || rule === "weakStart") && targetOnly) return null;
  if (rule === "atkRound3" && (round === 3 || round === 4)) return ["attack"];
  if (rule === "noSpeedEarly" && round <= Math.min(3, totalRounds - 1)) {
    return STAT_CLASH_STATS.map((s) => s.key).filter((k) => k !== "speed");
  }
  if (rule === "noHpFinal" && (round === totalRounds || round === totalRounds - 1)) {
    return STAT_CLASH_STATS.map((s) => s.key).filter((k) => k !== "hp");
  }
  if (rule === "weakStart" && (round === 1 || round === 2)) {
    const low = getStatClashLowestStat(state.currentStats);
    return low ? [low] : null;
  }
  if (sharedRule?.id === "mirrorRound4" && round === 4 && state.mirrorStatKey) {
    return [state.mirrorStatKey];
  }
  return null;
}
function getStatClashAllowedStats(state, side) {
  if (!state) return STAT_CLASH_STATS.map((s) => s.key);
  const used = new Set(state.usedStatsBySide?.[side] || state.usedStats || []);
  let pool = STAT_CLASH_STATS.map((s) => s.key).filter((k) => !used.has(k));
  if (state.suddenDeath) pool = STAT_CLASH_STATS.map((s) => s.key);
  const forced = getStatClashHouseRuleForcedStats(state, side);
  if (Array.isArray(forced) && forced.length) {
    pool = pool.filter((k) => forced.includes(k));
    if (!pool.length && forced.length) pool = forced.slice();
  }
  const blindOptions = state.blindRound5OptionsBySide?.[side];
  if (Array.isArray(blindOptions) && blindOptions.length) {
    const intersect = pool.filter((k) => blindOptions.includes(k));
    pool = intersect.length ? intersect : blindOptions.slice();
  }
  return pool;
}
function getStatClashHouseRuleTimerMs(state) {
  const base = STAT_CLASH_PICK_TIME_MS;
  if (!state?.houseRuleEnabled) return base;
  const imposedRules = Object.values(state.houseRuleBySide || {});
  const hasPressure = imposedRules.some((rule) => rule?.id === "pressureLate") || (!state.houseRuleBySide && state.houseRule?.id === "pressureLate");
  if (hasPressure && state.round >= Math.ceil((state.totalRounds || STAT_CLASH_ROUND_TOTAL) / 2)) {
    return STAT_CLASH_PRESSURE_TIMER_MS;
  }
  return base;
}
function pickStatClashAnnouncerLine(key) {
  const list = STAT_CLASH_ANNOUNCER_LINES[key] || [];
  if (!list.length) return "";
  return list[Math.floor(Math.random() * list.length)];
}
function getStatClashScoreForPick(state, statKey, value) {
  if (!state) return value;
  let total = Number(value) || 0;
  const sharedRule = state.houseRuleShared || (!state.houseRuleBySide ? state.houseRule : null);
  if (sharedRule?.id === "doubleStat" && state.doubleStatKey === statKey && state.houseRuleEnabled) total *= 2;
  return total;
}
function getStatClashPokemonTypeColor(pokemon) {
  const TYPE_COLORS = {
    normal: "#a8a878", feu: "#f08030", fire: "#f08030",
    eau: "#6890f0", water: "#6890f0", plante: "#78c850", grass: "#78c850",
    electrik: "#f8d030", electric: "#f8d030", glace: "#98d8d8", ice: "#98d8d8",
    combat: "#c03028", fighting: "#c03028", poison: "#a040a0",
    sol: "#e0c068", ground: "#e0c068", vol: "#a890f0", flying: "#a890f0",
    psy: "#f85888", psychic: "#f85888", insecte: "#a8b820", bug: "#a8b820",
    roche: "#b8a038", rock: "#b8a038", spectre: "#705898", ghost: "#705898",
    dragon: "#7038f8", ténèbres: "#705848", tenebres: "#705848", dark: "#705848",
    acier: "#b8b8d0", steel: "#b8b8d0", fée: "#ee99ac", fee: "#ee99ac", fairy: "#ee99ac",
  };
  const t = String(pokemon?.type1 || "").toLowerCase();
  return TYPE_COLORS[t] || "#7c8db5";
}

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
    finalizePartySession();
  }
  renderPartySessionUI();
}

function finalizePartySession() {
  if (!partySession || partySession.xpAwarded) return;
  partySession.xpAwarded = true;
  const wins = Number(partySession.wins) || 0;
  const losses = Number(partySession.losses) || 0;
  const rounds = wins + losses;
  if (rounds <= 0) return;
  // XP par victoire (15) + bonus complétion + bonus score parfait
  const baseXp = wins * 15;
  const completionBonus = rounds >= Number(partySession.maxRounds || rounds) ? 25 : 0;
  const perfectBonus = wins === rounds && wins >= 5 ? 50 : 0;
  const totalXp = baseXp + completionBonus + perfectBonus;
  if (totalXp > 0) awardXp(totalXp, `Party Pokémon ${wins}/${rounds}`);
  // Record session party (meilleur nombre de victoires)
  const prevRecord = Number(playerProfile?.partyHighScore) || 0;
  if (playerProfile && wins > prevRecord) {
    playerProfile.partyHighScore = wins;
    try { saveProfile(); } catch (_e) {}
    if (wins >= 5) awardXp(30, "Nouveau record Party");
  }
  // Historique de session (1 entrée par session, pas par mini-round)
  try {
    recordMatchHistory({
      mode: "party",
      result: wins >= losses ? "win" : "loss",
      attempts: rounds,
      targetName: `${wins} victoire${wins > 1 ? "s" : ""} / ${rounds}`,
    });
  } catch (_e) {}
}

function launchPartyRound() {
  if (!isPartySessionActive()) return;
  const mode = pickPartyMode();
  if (!mode) {
    partySession.completed = true;
    partySession.currentModeLabel = "Party Pokémon";
    finalizePartySession();
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
  if (checkMultiplayerInviteURL()) return;
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

function setSelectedGenerations(gens) {
  const validGens = (Array.isArray(gens) ? gens : [])
    .map((gen) => Number(gen))
    .filter((gen) => Number.isInteger(gen) && GENERATIONS[gen]);

  selectedGens = new Set(validGens.length ? validGens : [1]);
  buildGenGrid();
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
    alert("Sélectionne au moins une génération !");
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
    alert("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "silhouette";
  const secret = pickRandomPokemonFromPool(pool) || pool[0];
  startGameWithSecret(secret, pool);
}

function startPixelGame() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    alert("Sélectionne au moins une génération !");
    return;
  }

  gameMode = "pixel";
  const secret = pickRandomPokemonFromPool(pool) || pool[0];
  startGameWithSecret(secret, pool);
}

function startCryGame() {
  const pool = getPoolFromSelectedGens();
  if (!pool.length) {
    alert("Sélectionne au moins une génération !");
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
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
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
      if (!response.ok && response.error) alert(response.error);
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
      if (!response.ok && response.error) alert(response.error);
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
      if (!response.ok && response.error) alert(response.error);
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
        if (response.error) alert(response.error);
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
    if (!response.ok) return alert(response.error || "Impossible de relancer la partie.");
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
      alert(response.error || "Impossible de verrouiller ce choix.");
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
      return `<button type="button" class="${cls}" ${isLockedByOpponent ? "disabled" : ""} onclick="selectStatClashImposedRule('${rule.id}')"><b>${rule.icon || "📜"} ${escapeHtml(rule.label)}</b><small>${escapeHtml(rule.desc)}</small>${lockedNote}</button>`;
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
          return `<button type="button" class="${cls.join(" ")}" data-stat-key="${entry.key}" ${disabled ? "disabled" : ""} onclick="pickStatClashStat('left','${entry.key}')"><span><i class="stat-icon">${icon}</i> ${escapeHtml(entry.label)}</span>${valueHtml}</button>`;
        }).join("");
    const jokersHtml = !isOpponent && state.phase === "picking"
      ? (() => {
          const j = state.jokersBySide?.left || { reroll: 0, preview: 0, double: 0, doubleArmed: false };
          const disabledAttr = (n) => (n > 0 && !state.players.left.pendingPick) ? "" : "disabled";
          return `<div class="stat-clash-jokers">
            <button type="button" class="stat-clash-joker ${j.reroll > 0 ? "" : "is-spent"}" ${disabledAttr(j.reroll)} onclick="useStatClashJoker('left','reroll')" title="Reroll : change le Pokémon"><i>🔄</i><span>Reroll</span><small>${j.reroll}</small></button>
            <button type="button" class="stat-clash-joker ${j.preview > 0 ? "" : "is-spent"}" ${disabledAttr(j.preview)} onclick="useStatClashJoker('left','preview')" title="Aperçu : révèle 1 stat aléatoire 2s"><i>👁</i><span>Aperçu</span><small>${j.preview}</small></button>
            <button type="button" class="stat-clash-joker ${j.doubleArmed ? "is-armed" : j.double > 0 ? "" : "is-spent"}" ${j.doubleArmed ? "disabled" : disabledAttr(j.double)} onclick="useStatClashJoker('left','double')" title="Double : x2 si tu gagnes la manche, 0 si tu perds"><i>×2</i><span>Double</span><small>${j.doubleArmed ? "ON" : j.double}</small></button>
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
      : `<section class="stat-clash-room-panel"><div class="stat-clash-room-toolbar"><div class="stat-clash-room-row"><input id="stat-clash-nickname" class="stat-clash-room-input" type="text" maxlength="24" value="${escapeHtml(state.roomNameDraft || "")}" placeholder="Ton pseudo" oninput="syncStatClashNickname()" ${roomBusy ? "disabled" : ""} /><button class="btn-blue" type="button" data-stat-clash-action="create-room" ${roomBusy ? "disabled" : ""}>${state.roomPendingAction === "creating" ? "Création…" : "Créer"}</button></div><div class="stat-clash-room-row"><input id="stat-clash-room-input" class="stat-clash-room-input stat-clash-room-code-input" type="text" maxlength="6" value="${escapeHtml(state.roomCodeDraft || "")}" placeholder="Code de room" oninput="syncStatClashJoinCode()" ${roomBusy ? "disabled" : ""} /><button class="btn-ghost" type="button" data-stat-clash-action="join-room" ${roomBusy ? "disabled" : ""}>${state.roomPendingAction === "joining" ? "Connexion…" : "Rejoindre"}</button></div></div><div class="stat-clash-room-status ${escapeHtml(roomUi?.tone || "is-idle")}"><div><strong>${escapeHtml(roomUi?.title || "Room 1v1")}</strong><small>${escapeHtml(roomUi?.detail || "Crée une room pour inviter un autre joueur.")}</small></div>${state.roomFeedback ? `<span class="stat-clash-room-feedback ${escapeHtml(state.roomFeedbackTone || "info")}">${escapeHtml(state.roomFeedback)}</span>` : ""}</div></section>`
    : "";
  const lobbyCenterHtml = isBotLobby
    ? `<div class="stat-clash-lobby-center stat-clash-bot-lobby"><div class="stat-clash-lobby-center-head"><span>Vs Bot</span><strong>Prêt à jouer</strong></div><div class="stat-clash-lobby-center-body"><div class="stat-clash-sprite-placeholder">?</div><h3>${escapeHtml(state.statusText || "Lance une partie ou passe en Room 1v1.")}</h3><p>Tu peux régler le format, la difficulté et la règle maison avant le départ.</p><button class="btn-red" type="button" data-stat-clash-action="start-bot">Lancer vs bot</button></div></div>`
    : isRoom && roomIsLobby
    ? `<div class="stat-clash-lobby-center"><div class="stat-clash-lobby-center-head"><span>Lobby Room 1v1</span><strong>${escapeHtml(roomUi?.title || "Room 1v1")}</strong></div><div class="stat-clash-lobby-center-body"><div class="stat-clash-sprite-placeholder">?</div><h3>${escapeHtml(roomUi?.detail || "En attente de la room.")}</h3><p>${escapeHtml(selfRoomPlayer?.isHost ? "Partage le code puis lance la partie quand la room est complète." : room?.code ? `Connecté à ${room.code}. Attends le lancement par l’hôte.` : "Crée une room ou rejoins-en une avec un code.")}</p></div></div>`
    : `<div class="stat-clash-randomizer ${state.phase === "rolling" ? "is-rolling" : ""}"><div class="stat-clash-randomizer-head"><span>${state.phase === "starting-countdown" ? "Démarrage room" : "Pokémon tiré"}</span><strong>${escapeHtml(state.statusText)}</strong></div><div class="stat-clash-sprite-wrap">${current ? `<img src="${currentSprite}" alt="${escapeHtml(current.name)}" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(current))}'" />` : '<div class="stat-clash-sprite-placeholder">?</div>'}</div><div class="stat-clash-pokemon-meta"><h3>${escapeHtml(current?.name || (state.phase === "starting-countdown" ? "Prépare-toi…" : isRoom ? "Room en attente..." : "Chargement..."))}</h3><p>Les valeurs des 6 stats restent secrètes jusqu'à la révélation.</p></div><div class="stat-clash-timer ${["picking", "locked"].includes(state.phase) ? "is-live" : ""}"><div class="stat-clash-timer-ring"><span>${Math.max(0, Math.ceil(state.timerLeftMs / 1000))}</span></div><div class="stat-clash-timer-track"><span class="stat-clash-timer-fill" style="width:${timerPct}%"></span></div><small>${state.phase === "starting-countdown" ? "Le match commence quand le countdown atteint 0." : state.phase === "rolling" ? "Le randomizer termine son arrêt avant l'ouverture des choix." : ["picking", "locked"].includes(state.phase) ? "10 secondes complètes pour choisir ta stat." : "Le reveal arrive juste après les choix."}</small></div>${state.reveal ? `<div class="stat-clash-reveal-row"><div class="stat-clash-reveal-card"><span>${escapeHtml(state.players.left.label)}</span><b>${escapeHtml(state.reveal.left?.statLabel || "—")}</b><small>+${state.reveal.left?.value || 0}</small></div><div class="stat-clash-reveal-card"><span>${escapeHtml(state.players.right.label)}</span><b>${escapeHtml(state.reveal.right?.statLabel || "—")}</b><small>+${state.reveal.right?.value || 0}</small></div></div>${revealStatsHtml}` : ""}</div>`;
  const finalHtml = state.phase === "finished" ? `<section class="stat-clash-final-card ${winnerKey === "tie" ? "is-tie" : "is-win"}"><div class="stat-clash-final-head"><p class="stat-clash-final-kicker">Résultat final</p><h3>${winnerKey === "tie" ? "Égalité" : `${escapeHtml(state.players[winnerKey].label)} gagne`}</h3><p>${state.players.left.score} à ${state.players.right.score}</p></div><div class="stat-clash-final-actions"><button class="btn-red" type="button" onclick="restartStatClashGame()">Rejouer</button><button class="btn-ghost" type="button" onclick="goToConfig()">Retour menu</button></div></section>` : "";
  const imposedRulePickerHtml = (isBotLobby || (isRoom && roomIsLobby && room?.code)) ? renderImposedRulePicker() : "";
  // Type color (basé sur le Pokémon affiché)
  const typeColor = current ? getStatClashPokemonTypeColor(current) : "#7c8db5";
  // Settings bar (bot only)
  const isRoomLobbyHost = isRoom && roomIsLobby && Boolean(selfRoomPlayer?.isHost);
  const showSettingsBar = !isRoom || isRoomLobbyHost;
  const settingsBarHtml = !showSettingsBar ? "" : `<div class="stat-clash-settings-bar">
    <label class="stat-clash-setting"><span>Format</span><select onchange="setStatClashFormat(this.value)" ${isRoom && !isRoomLobbyHost ? "disabled" : ""}>${Object.entries(STAT_CLASH_FORMATS).map(([key, def]) => `<option value="${key}" ${state.format === key ? "selected" : ""}>${escapeHtml(def.label)}</option>`).join("")}</select></label>
    ${!isRoom ? `<label class="stat-clash-setting"><span>Bot</span><select onchange="setStatClashDifficulty(this.value)">${Object.entries(STAT_CLASH_BOT_DIFFICULTIES).map(([key, def]) => `<option value="${key}" ${state.botDifficulty === key ? "selected" : ""}>${escapeHtml(def.label)}</option>`).join("")}</select></label>` : ""}
    <label class="stat-clash-setting stat-clash-setting-toggle"><input type="checkbox" ${state.houseRuleEnabled ? "checked" : ""} onchange="toggleStatClashHouseRule()" ${isRoom && !isRoomLobbyHost ? "disabled" : ""} /><span>Handicaps imposés</span></label>
    <label class="stat-clash-setting stat-clash-setting-toggle"><input type="checkbox" ${state.houseRuleSharedEnabled ? "checked" : ""} onchange="toggleStatClashSharedHouseRule()" ${isRoom && !isRoomLobbyHost ? "disabled" : ""} /><span>Règle commune</span></label>
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
  prepareStatClashBotLobby();
  renderStatClashScreen();
}

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
  if (!pool.length) return alert("Impossible de charger la base Pokémon pour Higher or Lower.");
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
          <button class="higher-lower-mode-card" type="button" onclick="startHigherLowerMode('infinite')">
            <div class="higher-lower-mode-icon">♾️</div>
            <h4>Mode infini</h4>
            <p>Enchaîne jusqu'à la première erreur. Combien de bonnes réponses d'affilée ?</p>
            <div class="higher-lower-mode-record">Record : <b>${state.highScore}</b></div>
          </button>
          <button class="higher-lower-mode-card" type="button" onclick="startHigherLowerMode('rush60')">
            <div class="higher-lower-mode-icon">⏱️</div>
            <h4>Course 60s</h4>
            <p>60 secondes pour faire le max de bonnes réponses. Les erreurs ne pénalisent pas, juste le temps presse.</p>
            <div class="higher-lower-mode-record">Record : <b>${state.rushHighScore}</b></div>
          </button>
          <button class="higher-lower-mode-card" type="button" onclick="startHigherLowerVersusFromLobby()">
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
              <input id="higher-lower-nickname" type="text" maxlength="24" value="${escapeHtml(state.roomNicknameDraft || "")}" placeholder="Dresseur" oninput="syncHigherLowerNickname()" />
            </label>
            <div class="higher-lower-room-actions">
              <button class="btn-blue" type="button" onclick="createHigherLowerRoom()" ${pending ? "disabled" : ""}>${pending === "creating" ? "Création…" : "Créer une room"}</button>
            </div>
            <div class="higher-lower-room-join">
              <label>Code de room
                <input id="higher-lower-room-input" type="text" maxlength="6" value="${escapeHtml(state.roomDraftCode || "")}" placeholder="ABCD" oninput="syncHigherLowerJoinCode()" />
              </label>
              <button class="btn-ghost" type="button" onclick="joinHigherLowerRoom()" ${pending ? "disabled" : ""}>${pending === "joining" ? "Connexion…" : "Rejoindre"}</button>
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
            ${isHost ? `<button class="btn-red" type="button" onclick="startHigherLowerRoomMatch()" ${canStart && !pending ? "" : "disabled"}>${pending === "starting" ? "Lancement…" : "Lancer la partie"}</button>` : `<p class="card-desc">En attente du lancement par l'hôte.</p>`}
            <button class="btn-ghost" type="button" onclick="leaveHigherLowerRoom()">Quitter</button>
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
            ${isHost ? `<button class="btn-red" type="button" onclick="restartHigherLowerVersusMatch()">Relancer une partie</button>` : `<p class="card-desc">En attente du restart par l'hôte.</p>`}
            <button class="btn-ghost" type="button" onclick="leaveHigherLowerRoom()">Quitter la room</button>
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
          <button class="btn-red" type="button" onclick="restartHigherLowerGame()">Rejouer</button>
          <button class="btn-ghost" type="button" onclick="shareHigherLowerResult()">📋 Copier</button>
          <button class="btn-ghost" type="button" onclick="downloadHigherLowerImage()">💾 Image</button>
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
          <button class="btn-red higher-lower-btn-higher" type="button" onclick="${isVersus ? "answerHigherLowerVersus" : "answerHigherLower"}('higher')">▲ Plus haut</button>
          <button class="btn-blue higher-lower-btn-lower" type="button" onclick="${isVersus ? "answerHigherLowerVersus" : "answerHigherLower"}('lower')">▼ Plus bas</button>
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

function openSpeedrunMode() {
  const pool = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).filter((p) => Number(p.id) < 10000 && p.sprite);
  if (pool.length < 30) return alert("Pool Pokémon insuffisant pour Speedrun.");
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
        <button class="btn-red speedrun-start-btn" type="button" onclick="startSpeedrunGame()">⚡ Démarrer</button>
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
        <form class="speedrun-form" onsubmit="event.preventDefault(); if (document.getElementById('speedrun-input').value.trim()) speedrunSubmitGuess(); else speedrunSkip();">
          <input id="speedrun-input" class="speedrun-input" type="text" placeholder="Nom du Pokémon..." autocomplete="off" autocorrect="off" spellcheck="false" autofocus />
          <div class="speedrun-actions">
            <button class="btn-red" type="submit">Valider</button>
            <button class="btn-ghost" type="button" onclick="speedrunSkip()">Passer ⏭</button>
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
          <button class="btn-red" type="button" onclick="restartSpeedrunGame()">Rejouer</button>
          <button class="btn-ghost" type="button" onclick="shareSpeedrunResult()">📋 Copier</button>
          <button class="btn-ghost" type="button" onclick="downloadSpeedrunImage()">💾 Image</button>
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
  const puzzle = generatePokeConnectionsPuzzle();
  if (!puzzle) return alert("Impossible de générer un puzzle Poké-Connections.");
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
    }
  } else {
    pokeConnectionsState.mistakes += 1;
    pokeConnectionsState.lastShake = Date.now();
    if (pokeConnectionsState.mistakes >= POKE_CONNECTIONS_MAX_MISTAKES) {
      pokeConnectionsState.phase = "lost";
      try {
        recordMatchHistory({ mode: "poke-connections", result: "loss", attempts: pokeConnectionsState.foundGroupIdx.size, targetName: `${pokeConnectionsState.foundGroupIdx.size}/4 groupes` });
      } catch (_e) {}
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
      return `<button type="button" class="poke-connections-tile ${isSelected ? "is-selected" : ""}" onclick="togglePokeConnectionsTile(${idx})">
        <img src="${escapeHtml(t.sprite || "")}" alt="${escapeHtml(t.name)}" loading="lazy" />
        <span>${escapeHtml(t.name)}</span>
      </button>`;
    })
    .join("");
  const mistakeDots = Array.from({ length: POKE_CONNECTIONS_MAX_MISTAKES }, (_, i) => `<span class="poke-connections-mistake-dot ${i < mistakes ? "is-used" : ""}"></span>`).join("");
  const shakeClass = (Date.now() - state.lastShake < 700) ? "is-shaking" : "";
  let footer = "";
  if (phase === "won") {
    footer = `<div class="poke-connections-final is-won"><h3>🎉 Bravo !</h3><p>Tous les groupes trouvés en ${mistakes} erreur${mistakes > 1 ? "s" : ""}.</p><button class="btn-red" type="button" onclick="restartPokeConnectionsGame()">Nouveau puzzle</button></div>`;
  } else if (phase === "lost") {
    const remainingGroups = puzzle.groups
      .map((g, idx) => ({ g, idx }))
      .filter(({ idx }) => !foundGroupIdx.has(idx))
      .map(({ g, idx }) => `<div class="poke-connections-found-row group-${POKE_CONNECTIONS_GROUP_COLORS[idx]}"><div class="poke-connections-found-label">${escapeHtml(g.label)}</div><div class="poke-connections-found-list">${g.pokemon.map((p) => escapeHtml(p.name)).join(" · ")}</div></div>`)
      .join("");
    footer = `<div class="poke-connections-final is-lost"><h3>💀 Perdu</h3><p>Tu as épuisé tes 4 erreurs.</p>${remainingGroups ? `<div class="poke-connections-reveal-groups">${remainingGroups}</div>` : ""}<button class="btn-red" type="button" onclick="restartPokeConnectionsGame()">Nouveau puzzle</button></div>`;
  } else {
    footer = `<div class="poke-connections-actions">
      <button class="btn-ghost" type="button" onclick="shufflePokeConnectionsTiles()">🔀 Mélanger</button>
      <button class="btn-ghost" type="button" onclick="clearPokeConnectionsSelection()" ${selected.size === 0 ? "disabled" : ""}>Désélectionner tout</button>
      <button class="btn-red" type="button" onclick="submitPokeConnectionsGuess()" ${selected.size !== 4 ? "disabled" : ""}>Valider</button>
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
              <input id="stat-auction-nickname" type="text" maxlength="24" value="${escapeHtml(state.roomNicknameDraft || "")}" placeholder="Dresseur" oninput="syncStatAuctionNickname()" />
            </label>
            <div class="higher-lower-room-actions">
              <button class="btn-blue" type="button" onclick="createStatAuctionRoom()" ${pending ? "disabled" : ""}>${pending === "creating" ? "Création…" : "Créer une room"}</button>
            </div>
            <div class="higher-lower-room-join">
              <label>Code de room
                <input id="stat-auction-room-input" type="text" maxlength="6" value="${escapeHtml(state.roomDraftCode || "")}" placeholder="ABCD" oninput="syncStatAuctionJoinCode()" />
              </label>
              <button class="btn-ghost" type="button" onclick="joinStatAuctionRoom()" ${pending ? "disabled" : ""}>${pending === "joining" ? "Connexion…" : "Rejoindre"}</button>
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
            ${room.players.find((p) => p.isSelf)?.isHost ? `<button class="btn-red" type="button" onclick="startStatAuctionMatch()" ${room.canStart && !pending ? "" : "disabled"}>${pending === "starting" ? "Lancement…" : "Lancer la partie"}</button>` : `<p class="card-desc">En attente du lancement par l'hôte.</p>`}
            <button class="btn-ghost" type="button" onclick="leaveStatAuctionRoom()">Quitter</button>
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
          ${isHost ? `<button class="btn-red" type="button" onclick="restartStatAuctionMatch()">Relancer</button>` : `<p class="card-desc">En attente du restart par l'hôte.</p>`}
          <button class="btn-ghost" type="button" onclick="leaveStatAuctionRoom()">Quitter</button>
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
        <button type="button" class="btn-ghost stat-auction-step" ${cur <= 0 || state.submitted ? "disabled" : ""} onclick="changeStatAuctionAllocation('${s.key}', -5)">−5</button>
        <input type="number" class="stat-auction-input" min="0" max="100" value="${cur}" ${state.submitted ? "disabled" : ""} oninput="setStatAuctionAllocation('${s.key}', this.value)" />
        <button type="button" class="btn-ghost stat-auction-step" ${remaining <= 0 || state.submitted ? "disabled" : ""} onclick="changeStatAuctionAllocation('${s.key}', 5)">+5</button>
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
        <button type="button" class="btn-ghost" onclick="autoBalanceStatAuctionAllocation()" ${state.submitted ? "disabled" : ""}>Équilibrer</button>
        <button type="button" class="btn-ghost" onclick="clearStatAuctionAllocation()" ${state.submitted ? "disabled" : ""}>Reset</button>
        <button type="button" class="btn-red" onclick="submitStatAuctionAllocation()" ${state.submitted || totalUsed !== STAT_AUCTION_TOTAL || !statsLoaded ? "disabled" : ""}>${state.submitted ? "Soumis ✓" : "Valider"}</button>
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
  if (gameMode === "challenge") header += " • Défi ami";
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

function copyResult() {
  shareResult();
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
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
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
  openDraftScoreAttackMode: { label: "Draft Score Attack", description: "Drafte la meilleure moyenne BST en solo ou en 1v1.", category: "challenge" },
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
    "screen-draft-score-attack",
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
  const nextEmptySlotIndex = teamBuilderState.findIndex((slot) => !Number.isInteger(Number(slot?.pokemonId)));
  const activeSlotHasPokemon = Boolean(getTeamBuilderPokemon(teamBuilderState[teamBuilderActiveSlot]));

  teamBuilderState.forEach((slot, index) => {
    const pokemon = getTeamBuilderPokemon(slot);
    const card = document.createElement("button");
    card.type = "button";
    const isActive = index === teamBuilderActiveSlot;
    const isNextEmpty = !activeSlotHasPokemon && nextEmptySlotIndex !== -1 && index === nextEmptySlotIndex;
    card.className =
      "home-builder-slot" +
      (isActive ? " is-active" : "") +
      (pokemon ? " is-filled" : "") +
      (isNextEmpty ? " is-next-empty" : "");
    card.addEventListener("click", () => {
      teamBuilderActiveSlot = index;
      renderTeamBuilderModule();
    });

    const head = document.createElement("div");
    head.className = "home-builder-slot-head";
    let slotStatus = pokemon ? "Actif" : "Vide";
    if (isNextEmpty && !isActive) slotStatus = "Suivant";
    if (isNextEmpty && isActive) slotStatus = "À remplir";
    head.innerHTML = `<span>Slot ${index + 1}</span><small>${slotStatus}</small>`;

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

function isPokedexToolbarDirty() {
  return Boolean(
    (pokedexSearch || "").trim() ||
    pokedexGenFilter !== "all" ||
    pokedexTypeFilter !== "all" ||
    pokedexType2Filter !== "all" ||
    pokedexSortFilter !== "dex"
  );
}

function ensurePokedexToolbarMeta() {
  let meta = document.getElementById("pokedex-toolbar-meta");
  if (meta) return meta;
  const row = document.querySelector("#screen-pokedex .pokedex-toolbar-row-bottom");
  if (!row) return null;
  meta = document.createElement("div");
  meta.id = "pokedex-toolbar-meta";
  meta.className = "pokedex-toolbar-meta";
  meta.innerHTML = `
    <span id="pokedex-results-count" class="pokedex-results-count" aria-live="polite"></span>
    <button id="pokedex-reset-filters" class="btn-ghost pokedex-reset-filters" type="button">Réinitialiser</button>
  `;
  row.appendChild(meta);
  meta.querySelector("#pokedex-reset-filters")?.addEventListener("click", resetPokedexToolbar);
  return meta;
}

function updatePokedexToolbarMeta(resultCount) {
  const meta = ensurePokedexToolbarMeta();
  if (!meta) return;
  const count = meta.querySelector("#pokedex-results-count");
  const reset = meta.querySelector("#pokedex-reset-filters");
  const total = POKEMON_LIST.length;
  if (count) {
    count.textContent = `${resultCount} / ${total} affichés`;
  }
  const isDirty = isPokedexToolbarDirty();
  meta.classList.toggle("is-dirty", isDirty);
  if (reset) {
    reset.hidden = !isDirty;
    reset.disabled = !isDirty;
    reset.setAttribute("aria-hidden", isDirty ? "false" : "true");
  }
}

function resetPokedexToolbar() {
  pokedexSearch = "";
  pokedexGenFilter = "all";
  pokedexTypeFilter = "all";
  pokedexType2Filter = "all";
  pokedexSortFilter = "dex";
  const search = document.getElementById("pokedex-search");
  const gen = document.getElementById("pokedex-gen-filter");
  const type = document.getElementById("pokedex-type-filter");
  const type2 = document.getElementById("pokedex-type2-filter");
  const sort = document.getElementById("pokedex-sort-filter");
  if (search) search.value = "";
  if (gen) gen.value = "all";
  if (type) type.value = "all";
  if (type2) type2.value = "all";
  if (sort) sort.value = "dex";
  renderPokedexGrid();
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
  ensurePokedexToolbarMeta();

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
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
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
  updatePokedexToolbarMeta(list.length);
  grid.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "rank-empty-list pokedex-empty-state";
    empty.innerHTML = `
      <strong>Aucun Pokémon trouvé</strong>
      <p>Essaie d’ajuster la recherche ou les filtres actuels.</p>
      ${isPokedexToolbarDirty() ? '<button type="button" class="btn-ghost pokedex-empty-reset" onclick="resetPokedexToolbar()">Réinitialiser les filtres</button>' : ""}
    `;
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
    pokedexDetailRequestId += 1;
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
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
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
const DRAFT_SCORE_ATTACK_REROLLS = 5;
const DRAFT_SCORE_ATTACK_TARGETS = [
  { min: 600, label: "Master 600+" },
  { min: 550, label: "Elite 550+" },
  { min: 500, label: "Solide 500+" },
];
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
    mode: "arena",
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
    scoreAttackRerollsLeft: DRAFT_SCORE_ATTACK_REROLLS,
    scoreAttackBestAverage: 0,
    scoreAttackRoom: null,
    scoreAttackSubmitted: false,
    scoreAttackRoomPending: null,
    scoreAttackRoomError: null,
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

function getDraftTeamBstMetrics(team = []) {
  const members = (team || []).filter((entry) => entry?.pokemon);
  const total = members.reduce((sum, member) => sum + (Number(getDraftCachedPokemonPowerData(member.pokemon).statGlobal) || 0), 0);
  const average = members.length ? Math.round(total / members.length) : 0;
  const fullAverage = members.length >= DRAFT_TEAM_SIZE ? average : 0;
  const nextTarget = DRAFT_SCORE_ATTACK_TARGETS.slice().reverse().find((target) => average < target.min) || null;
  const rank = DRAFT_SCORE_ATTACK_TARGETS.find((target) => average >= target.min) || null;
  return { count: members.length, total, average, fullAverage, nextTarget, rank };
}

function getDraftScoreAttackResultLabel(average) {
  const rank = DRAFT_SCORE_ATTACK_TARGETS.find((target) => average >= target.min);
  return rank ? rank.label : "Run à améliorer";
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

let __gbaMenuView = "main";
function setGbaMenuView(view) {
  __gbaMenuView = view === "moves" ? "moves" : "main";
  playGbaMenuBlip();
  if (draftSimpleBattleDevUiState) {
    renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
  }
}

// === SFX combat GBA (Web Audio) ===
let __gbaAudioCtx = null;
function getGbaAudioCtx() {
  if (__gbaAudioCtx) return __gbaAudioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    __gbaAudioCtx = new Ctx();
    return __gbaAudioCtx;
  } catch (e) {
    return null;
  }
}
function playGbaBeep(freq = 700, durationMs = 60, volume = 0.05, type = "square") {
  const ctx = getGbaAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime;
    const tEnd = t0 + durationMs / 1000;
    gain.gain.setValueAtTime(Math.max(0.0001, volume), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(tEnd);
  } catch (e) { /* silent */ }
}

let __gbaLastSfxKey = "";
let __gbaLastAnimKey = "";
const __GBA_ONESHOT_ANIM_CLASSES = ["is-hit", "is-taking-hit", "is-ko", "is-switch-in"];
function stripGbaOneShotAnims(classString) {
  if (!classString) return "";
  let out = String(classString);
  __GBA_ONESHOT_ANIM_CLASSES.forEach((c) => {
    out = out.replace(new RegExp("\\b" + c + "\\b", "g"), "");
  });
  return out.replace(/\s+/g, " ").trim();
}
function maybePlayPhaseSfx(state) {
  const action = state?.visualReplay?.currentAction;
  const phase = state?.visualReplay?.phase || "";
  if (!action || !phase) { __gbaLastSfxKey = ""; return; }
  const turnNum = Number(state.visualReplay?.turn) || 0;
  const visibleCount = Number(state.visualReplay?.visibleCount) || 0;
  const key = `${turnNum}:${visibleCount}:${action.side || ""}:${action.event || ""}:${action.move?.name || action.moveName || ""}:${phase}`;
  if (key === __gbaLastSfxKey) return;
  __gbaLastSfxKey = key;

  if (phase === "impact") {
    if (action.missed) {
      playGbaBeep(320, 90, 0.025, "triangle"); // whiff doux
    } else if (action.critical) {
      playGbaBeep(180, 90, 0.05, "triangle");
      setTimeout(() => playGbaBeep(110, 220, 0.04, "sine"), 70);
    } else if (Number(action.effectiveness) > 1) {
      playGbaBeep(260, 100, 0.04, "triangle");
    } else if (Number(action.effectiveness) > 0 && Number(action.effectiveness) < 1) {
      playGbaBeep(200, 90, 0.025, "sine");
    } else if (Number(action.damage) > 0) {
      playGbaBeep(220, 80, 0.03, "triangle");
    }
  } else if (phase === "ko") {
    playGbaBeep(180, 260, 0.04, "sine");
    setTimeout(() => playGbaBeep(95, 400, 0.035, "sine"), 180);
  }
}

function playBattleStartTransition() {
  document.querySelectorAll(".gba-battle-start-overlay").forEach((el) => el.remove());
  const overlay = document.createElement("div");
  overlay.className = "gba-battle-start-overlay";
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 900);
}

function getGbaStatusBadgeHtml(status) {
  if (!status) return "";
  const map = {
    paralysed:      { abbr: "PAR", cls: "is-par" },
    burned:         { abbr: "BRN", cls: "is-brn" },
    poisoned:       { abbr: "PSN", cls: "is-psn" },
    badly_poisoned: { abbr: "TOX", cls: "is-tox" },
    asleep:         { abbr: "SLP", cls: "is-slp" },
    frozen:         { abbr: "FRZ", cls: "is-frz" },
  };
  const cfg = map[status];
  if (!cfg) return "";
  return `<span class="gba-status-badge ${cfg.cls}">${cfg.abbr}</span>`;
}

function getGbaPokeballsHtml(team, activeIndex) {
  const slots = Array.isArray(team) ? team.slice(0, 6) : [];
  while (slots.length < 6) slots.push(null);
  const balls = slots.map((slot, i) => {
    if (!slot) return `<span class="gba-pokeball is-empty" aria-hidden="true"></span>`;
    if (Number(slot.currentHp) <= 0) return `<span class="gba-pokeball is-fainted" aria-hidden="true"></span>`;
    if (i === Number(activeIndex)) return `<span class="gba-pokeball is-active" aria-hidden="true"></span>`;
    return `<span class="gba-pokeball" aria-hidden="true"></span>`;
  }).join("");
  return `<div class="gba-pokeballs">${balls}</div>`;
}

function playGbaMenuBlip() {
  playGbaBeep(620, 35, 0.025, "triangle");
}

function getGbaBattleLevel(battler) {
  if (!battler?.stats) return 50;
  const total = Object.values(battler.stats).reduce((s, v) => s + (Number(v) || 0), 0);
  if (!total) return 50;
  return Math.max(15, Math.min(100, Math.round(total / 12)));
}

let __gbaLastHpPercent = { left: 100, right: 100 };
let __gbaLastDisplayKey = { left: null, right: null };
function refreshGbaHpBars(leftTarget, rightTarget, leftDisplayKey, rightDisplayKey) {
  const apply = (selector, target, displayKey, side) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const next = Math.max(0, Math.min(100, Number(target) || 0));
    const sameDisplay = __gbaLastDisplayKey[side] != null && __gbaLastDisplayKey[side] === displayKey;
    if (!sameDisplay) {
      // Nouveau Pokémon affiché (switch / KO / 1er render) → snap sans animation
      el.style.transition = "none";
      el.style.width = next + "%";
      void el.offsetHeight;
      el.style.transition = "";
      __gbaLastHpPercent[side] = next;
      __gbaLastDisplayKey[side] = displayKey;
      return;
    }
    const prev = Number(__gbaLastHpPercent[side]);
    if (!Number.isFinite(prev) || prev === next) {
      el.style.width = next + "%";
      __gbaLastHpPercent[side] = next;
      return;
    }
    el.style.width = prev + "%";
    void el.offsetHeight; // force reflow so transition runs
    el.style.width = next + "%";
    __gbaLastHpPercent[side] = next;
  };
  apply(".gba-battle .gba-info-player .gba-info-hp-fill", leftTarget, leftDisplayKey, "left");
  apply(".gba-battle .gba-info-foe .gba-info-hp-fill", rightTarget, rightDisplayKey, "right");
}

let __gbaTextboxTimer = null;
let __gbaTextboxLastText = "";
function refreshGbaTextbox(text) {
  const box = document.querySelector(".gba-battle .gba-textbox-text");
  if (!box) {
    __gbaTextboxLastText = "";
    if (__gbaTextboxTimer) { clearInterval(__gbaTextboxTimer); __gbaTextboxTimer = null; }
    return;
  }
  const target = String(text || "");
  if (target === __gbaTextboxLastText) {
    box.textContent = target;
    return;
  }
  __gbaTextboxLastText = target;
  if (__gbaTextboxTimer) { clearInterval(__gbaTextboxTimer); __gbaTextboxTimer = null; }
  box.textContent = "";
  let i = 0;
  __gbaTextboxTimer = setInterval(() => {
    if (i >= target.length) {
      clearInterval(__gbaTextboxTimer);
      __gbaTextboxTimer = null;
      box.textContent = target;
      return;
    }
    box.textContent = target.slice(0, ++i);
  }, 38);
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
  const replayAction = state?.visualReplay?.active ? state.visualReplay.currentAction : null;
  const replayPhaseStr = state?.visualReplay?.phase || "";
  const inImpactPhase = replayPhaseStr === "impact" || replayPhaseStr === "hp";
  const isCriticalHit = Boolean(replayAction?.critical) && inImpactPhase;
  const isSuperEffective = Number(replayAction?.effectiveness) > 1 && inImpactPhase && !isCriticalHit;
  const gbaSceneExtraClass = isCriticalHit ? " gba-scene-crit" : "";
  const gbaTextboxToneClass = isCriticalHit ? " is-crit" : isSuperEffective ? " is-super" : "";
  // Gating animations one-shot : ne re-déclenche pas les keyframes si la phase de replay n'a pas changé
  // Inclut visibleCount + side + event pour différencier les actions successives du même tour
  const animFp = state?.visualReplay?.active
    ? `${state.visualReplay.turn || 0}:${state.visualReplay.visibleCount || 0}:${replayAction?.side || ""}:${replayAction?.event || ""}:${replayAction?.move?.name || replayAction?.moveName || ""}:${replayPhaseStr}`
    : "";
  const animFpChanged = animFp !== __gbaLastAnimKey;
  __gbaLastAnimKey = animFp;
  let leftFighterClass = animFpChanged ? visualFeedback.leftClass : stripGbaOneShotAnims(visualFeedback.leftClass);
  let rightFighterClass = animFpChanged ? visualFeedback.rightClass : stripGbaOneShotAnims(visualFeedback.rightClass);
  // F : sprite recule à la baseline dès la phase d'impact/hp/ko (au lieu de rester en lunge)
  if (replayPhaseStr === "impact" || replayPhaseStr === "hp" || replayPhaseStr === "ko") {
    leftFighterClass = leftFighterClass.replace(/\bis-attacking\b/g, "").replace(/\s+/g, " ").trim();
    rightFighterClass = rightFighterClass.replace(/\bis-attacking\b/g, "").replace(/\s+/g, " ").trim();
  }
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
  const replayPhase = state.visualReplay?.phase || "idle";
  const combatUiState = isFinished
    ? "finished"
    : needsForcedSwitch
      ? "switch"
      : isReplayingTurn
        ? "replay"
        : canLocalChooseAction
          ? "choice"
          : isEnemyTurn
            ? "enemy"
            : "waiting";
  panel.dataset.combatUi = combatUiState;
  panel.dataset.replayPhase = replayPhase;
  body.dataset.combatUi = combatUiState;
  body.dataset.replayPhase = replayPhase;

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
      class="btn-blue draft-dev-battle-move ${moveEffectivenessClass} ${move?.category === "status" ? "is-status" : "is-attack"}"
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

  // GBA action menu (B3) — only when player can act locally
  const showGbaMenu = canLocalChooseAction && !isReplayingTurn;
  const gbaMenuView = showGbaMenu ? __gbaMenuView : "main";
  const gbaSwitchAvailable = showGbaMenu && getDraftSimpleBattleAvailableSwitchIndexesForSide(state, currentActionSide).length > 0;
  let gbaMenuHtml = "";
  if (showGbaMenu) {
    if (gbaMenuView === "moves") {
      const movesGba = struggleOnly
        ? `<button type="button" class="gba-move-btn" onclick="runDraftSimpleBattleDevStruggle('${currentActionSide}')">
            <span class="gba-move-name">Lutte</span>
            <span class="gba-move-meta"><span>Normal</span><span>PP —</span></span>
          </button>`
        : (currentActionBattler.moves || []).map((move, i) => {
            const noPp = (Number(move?.ppCurrent) || 0) <= 0;
            return `<button type="button" class="gba-move-btn ${noPp ? "is-disabled" : ""}" onclick="runDraftSimpleBattleDevTurn(${i}, '${currentActionSide}')" ${noPp ? "disabled" : ""}>
              <span class="gba-move-name">${escapeHtml(move.name)}</span>
              <span class="gba-move-meta"><span>${escapeHtml(move.type)}</span><span>PP ${Number(move?.ppCurrent) || 0}/${Number(move?.ppMax) || 0}</span></span>
            </button>`;
          }).join("");
      gbaMenuHtml = `<div class="gba-menu" data-view="moves">
        ${movesGba}
        <button type="button" class="gba-menu-back" onclick="setGbaMenuView('main')">◀ RETOUR</button>
      </div>`;
    } else {
      gbaMenuHtml = `<div class="gba-menu" data-view="main">
        <button type="button" class="gba-menu-btn" onclick="setGbaMenuView('moves')">ATTAQUE</button>
        <button type="button" class="gba-menu-btn is-disabled" disabled title="Pas d'objets dans le Draft">SAC</button>
        <button type="button" class="gba-menu-btn${gbaSwitchAvailable ? "" : " is-disabled"}" ${gbaSwitchAvailable ? `onclick="openDraftSimpleBattleManualSwitch('${currentActionSide}')"` : "disabled"}>POKÉMON</button>
        <button type="button" class="gba-menu-btn is-disabled" disabled title="Impossible de fuir un combat d'arène">FUITE</button>
      </div>`;
    }
  }

  const playerWin = isDraftSimpleBattlePlayerWin(state);
  const leftRemaining = getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex);
  const rightRemaining = getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex);
  const sceneText = getDraftSimpleBattleSceneText(state);
  const liveResultTone = needsForcedSwitch
    ? "is-switch"
    : isReplayingTurn
      ? "is-resolving"
      : canLocalChooseAction
        ? "is-choice"
        : "is-waiting";
  const liveResultKicker = needsForcedSwitch
    ? "Remplacement"
    : isReplayingTurn
      ? "Résolution"
      : canLocalChooseAction
        ? "Ton tour"
        : "En attente";
  const resultHtml = isFinished
    ? `<div class="gba-result ${playerWin ? "is-win" : "is-loss"}">
        <h3 class="gba-result-title">${playerWin ? "VICTOIRE !" : "DÉFAITE"}</h3>
        <p class="gba-result-text">${playerWin ? "Tu as gagné le combat&nbsp;!" : "Tous tes Pokémon sont K.O…"}</p>
        <p class="gba-result-meta">${escapeHtml(winner)} clôture le match en ${state.log.length} tour${state.log.length > 1 ? "s" : ""} — ${leftRemaining} Pokémon restant${leftRemaining > 1 ? "s" : ""} côté joueur, ${rightRemaining} côté adverse.</p>
        <div class="gba-result-actions">
          <button type="button" class="btn-blue" onclick="${escapeHtml(state.mode === "arena-run" && state.postBattleAction?.action ? state.postBattleAction.action : "replayDraftSimpleBattleDevDuel")}()">${escapeHtml(state.mode === "arena-run" && state.postBattleAction?.label ? state.postBattleAction.label : "Rejouer")}</button>
          <button type="button" class="btn-ghost" onclick="clearDraftSimpleBattleDevPanel()">Retour au Draft</button>
        </div>
      </div>`
    : isEnemyTurn
      ? `<div class="draft-dev-battle-result ${liveResultTone}"><small class="draft-dev-battle-result-kicker">${liveResultKicker}</small><b>Action adverse</b><span>L’adversaire prépare sa réponse.</span></div>`
      : isPlayerTurn
        ? `<div class="draft-dev-battle-result ${liveResultTone}"><small class="draft-dev-battle-result-kicker">${liveResultKicker}</small><b>${escapeHtml(isReplayingTurn ? "Résolution du tour" : canLocalChooseAction ? `${currentActionBattler.pokemon.name} attend ton ordre` : isNetwork ? getDraftSimpleBattleNetworkRoomStatusText(state) : "Tour verrouillé")}</b><span>${escapeHtml(isNetwork ? networkTurnHint : (canLocalChooseAction ? "Choisis une attaque." : isReplayingTurn ? "Le tour se joue. Patiente jusqu’à la fin de la séquence." : "Action enregistrée ou en attente."))}</span></div>`
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
                <img class="draft-switch-sprite" src="${escapeHtml(getPokemonSprite(member.pokemon))}" alt="${escapeHtml(member.pokemon.name)}" loading="lazy">
                <span class="draft-switch-name">${escapeHtml(member.pokemon.name)}</span>
                <small class="draft-switch-hp">PV ${member.currentHp} / ${member.maxHp}</small>
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
      <div class="draft-dev-battle-hud">
        <div class="draft-dev-battle-hud-top">
          <span class="draft-dev-battle-hud-side">Joueur</span>
          <span class="draft-dev-battle-hud-meta">Équipe ${getDraftSimpleBattleRemainingCount(state.leftTeam, state.leftActiveIndex)} restant(s)</span>
        </div>
        <div class="draft-dev-battle-hud-main">
          <b class="draft-dev-battle-hud-name">${escapeHtml(displayLeft.pokemon.name)}</b>
          ${leftStatusLabel ? `<span class="draft-dev-battle-hud-status">${escapeHtml(leftStatusLabel)}</span>` : ""}
        </div>
        <small class="draft-dev-battle-hud-sub">PV ${displayLeft.currentHp} / ${displayLeft.maxHp} • Vitesse ${getDraftSimpleBattleCurrentSpeed(displayLeft)}</small>
        <div class="draft-dev-battle-hp">
          <div class="draft-dev-battle-hp-meta">
            <strong>PV</strong>
            <span>${displayLeft.currentHp} / ${displayLeft.maxHp}</span>
          </div>
          <div class="draft-dev-battle-hp-track">
            <span class="draft-dev-battle-hp-fill${leftHpPercent <= 25 ? " is-low-hp" : ""}" style="width:${leftHpPercent}%"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  const foeHudHtml = `
    <div class="draft-dev-battle-fighter-head">
      <div class="draft-dev-battle-hud">
        <div class="draft-dev-battle-hud-top">
          <span class="draft-dev-battle-hud-side">Adversaire</span>
          <span class="draft-dev-battle-hud-meta">Équipe ${getDraftSimpleBattleRemainingCount(state.rightTeam, state.rightActiveIndex)} restant(s)</span>
        </div>
        <div class="draft-dev-battle-hud-main">
          <b class="draft-dev-battle-hud-name">${escapeHtml(displayRight.pokemon.name)}</b>
          ${rightStatusLabel ? `<span class="draft-dev-battle-hud-status">${escapeHtml(rightStatusLabel)}</span>` : ""}
        </div>
        <small class="draft-dev-battle-hud-sub">PV ${displayRight.currentHp} / ${displayRight.maxHp} • Vitesse ${getDraftSimpleBattleCurrentSpeed(displayRight)}</small>
        <div class="draft-dev-battle-hp">
          <div class="draft-dev-battle-hp-meta">
            <strong>PV</strong>
            <span>${displayRight.currentHp} / ${displayRight.maxHp}</span>
          </div>
          <div class="draft-dev-battle-hp-track">
            <span class="draft-dev-battle-hp-fill${rightHpPercent <= 25 ? " is-low-hp" : ""}" style="width:${rightHpPercent}%"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  // LITE-RENDER : pendant une frame d'animation HP (ou autre re-render dans la même phase de replay),
  // ne reconstruit pas body.innerHTML. On met juste à jour le texte et les barres HP — évite le flicker
  // des sprites (recréés à chaque innerHTML).
  const replayLiteKey = state?.visualReplay?.active
    ? `${state.visualReplay.turn || 0}:${state.visualReplay.visibleCount || 0}:${replayPhaseStr}`
    : "";
  if (replayLiteKey && panel.dataset.gbaReplayLiteKey === replayLiteKey && !isFinished) {
    panel.classList.remove("hidden");
    refreshGbaTextbox(sceneText);
    const liteLeftKey = `${state.leftActiveIndex || 0}:${displayLeft?.pokemon?.id || displayLeft?.pokemon?.name || ""}`;
    const liteRightKey = `${state.rightActiveIndex || 0}:${displayRight?.pokemon?.id || displayRight?.pokemon?.name || ""}`;
    refreshGbaHpBars(leftHpPercent, rightHpPercent, liteLeftKey, liteRightKey);
    return;
  }
  panel.dataset.gbaReplayLiteKey = replayLiteKey;

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
    ${visualFeedback.badges.length ? `
      <div class="draft-dev-battle-event-strip ${isReplayingTurn ? "is-replay" : "is-resting"}">
        ${visualFeedback.badges.map((label) => `<span class="draft-dev-battle-event-badge">${escapeHtml(label)}</span>`).join("")}
      </div>
    ` : ""}
    <div class="gba-battle">
      <div class="gba-battle-scene${gbaSceneExtraClass}">
        <div class="gba-battle-bg"></div>
        <div class="gba-info-box gba-info-foe">
          <div class="gba-info-name-row">
            <span class="gba-info-name">${escapeHtml(displayRight.pokemon.name)}${getGbaStatusBadgeHtml(displayRight.status)}</span>
            <span class="gba-info-level">N.${getGbaBattleLevel(displayRight)}</span>
          </div>
          <div class="gba-info-hp-row">
            <span class="gba-info-hp-label">PV</span>
            <div class="gba-info-hp-bar">
              <span class="gba-info-hp-fill ${rightHpPercent <= 25 ? "is-low" : rightHpPercent <= 50 ? "is-medium" : ""}" style="width:${rightHpPercent}%"></span>
            </div>
          </div>
          ${getGbaPokeballsHtml(state.rightTeam, state.rightActiveIndex)}
        </div>
        <div class="gba-fighter gba-fighter-foe ${rightFighterClass}">
          <img class="gba-sprite gba-sprite-foe" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/firered-leafgreen/${getPokemonSpriteId(displayRight.pokemon)}.png" alt="${escapeHtml(displayRight.pokemon.name)}" onerror="this.onerror=null;this.src='${escapeHtml(getPokemonSprite(displayRight.pokemon))}';">
          <div class="gba-platform gba-platform-foe"></div>
        </div>
        <div class="gba-fighter gba-fighter-player ${leftFighterClass}">
          <img class="gba-sprite gba-sprite-player" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${getPokemonSpriteId(displayLeft.pokemon)}.png" alt="${escapeHtml(displayLeft.pokemon.name)}" onerror="this.onerror=null;this.src='${escapeHtml(getPokemonSprite(displayLeft.pokemon))}';">
          <div class="gba-platform gba-platform-player"></div>
        </div>
        <div class="gba-info-box gba-info-player">
          <div class="gba-info-name-row">
            <span class="gba-info-name">${escapeHtml(displayLeft.pokemon.name)}${getGbaStatusBadgeHtml(displayLeft.status)}</span>
            <span class="gba-info-level">N.${getGbaBattleLevel(displayLeft)}</span>
          </div>
          <div class="gba-info-hp-row">
            <span class="gba-info-hp-label">PV</span>
            <div class="gba-info-hp-bar">
              <span class="gba-info-hp-fill ${leftHpPercent <= 25 ? "is-low" : leftHpPercent <= 50 ? "is-medium" : ""}" style="width:${leftHpPercent}%"></span>
            </div>
          </div>
          <div class="gba-info-hp-numeric">${displayLeft.currentHp}/${displayLeft.maxHp}</div>
          <div class="gba-info-exp-bar">
            <span class="gba-info-exp-fill" style="width:50%"></span>
          </div>
          ${getGbaPokeballsHtml(state.leftTeam, state.leftActiveIndex)}
        </div>
      </div>
      <div class="gba-battle-bottom ${showGbaMenu ? "has-menu" : "no-menu"}">
        <div class="gba-textbox${gbaTextboxToneClass}" role="status" aria-live="polite">
          <span class="gba-textbox-text">${escapeHtml(sceneText)}</span>
          <span class="gba-textbox-arrow" aria-hidden="true">▼</span>
        </div>
        ${gbaMenuHtml}
      </div>
    </div>
    <details class="draft-dev-battle-extras-details">
      <summary>Détails du combat (bancs, statut, ordre, tours)</summary>
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
    </details>
    ${switchHtml}
    <div class="draft-dev-battle-battlebox" data-combat-ui="${combatUiState}" data-replay-phase="${replayPhase}">
      ${resultHtml ? `<div class="draft-dev-battle-battlebox-message">${resultHtml}</div>` : ""}
      ${isReplayingTurn ? `<div class="draft-dev-battle-extra-action"><button type="button" class="btn-ghost" onclick="requestDraftSimpleBattleReplaySkip()">Passer la résolution</button></div>` : ""}
      <details class="draft-dev-battle-log-details"><summary>Historique du combat</summary><div class="draft-dev-battle-log">${actionsHtml || "<p class=\"card-desc\">Aucune action simulée.</p>"}</div></details>
    </div>
  `;

  panel.classList.remove("hidden");
  refreshGbaTextbox(sceneText);
  const leftDisplayKey = `${state.leftActiveIndex || 0}:${displayLeft?.pokemon?.id || displayLeft?.pokemon?.name || ""}`;
  const rightDisplayKey = `${state.rightActiveIndex || 0}:${displayRight?.pokemon?.id || displayRight?.pokemon?.name || ""}`;
  refreshGbaHpBars(leftHpPercent, rightHpPercent, leftDisplayKey, rightDisplayKey);
  maybePlayPhaseSfx(state);
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
  if (__gbaTextboxTimer) { clearInterval(__gbaTextboxTimer); __gbaTextboxTimer = null; }
  __gbaTextboxLastText = "";
  __gbaMenuView = "main";
  __gbaLastHpPercent = { left: 100, right: 100 };
  __gbaLastDisplayKey = { left: null, right: null };
  __gbaLastSfxKey = "";
  __gbaLastAnimKey = "";
  const __gbaPanelEl = document.getElementById("draft-dev-battle-panel");
  if (__gbaPanelEl) delete __gbaPanelEl.dataset.gbaReplayLiteKey;
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
  playBattleStartTransition();
  renderDraftSimpleBattleDevPanel(draftSimpleBattleDevUiState);
  playPokemonCry(draftSimpleBattleDevUiState.right?.pokemon);
  setTimeout(() => playPokemonCry(draftSimpleBattleDevUiState?.left?.pokemon), 650);
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
  playGbaMenuBlip();

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
    // Règle : switch manuel = pas de tour adversaire auto. On exécute juste le switch
    // et on rend la main au joueur (équivalent d'un swap "gratuit" comme dans certaines
    // règles maison).
    const switched = executeDraftSimpleBattleSwitch(state, replacementSide, nextIndex, {
      reason: "manual-switch",
      forced: false,
    });
    if (!switched) return null;
    state.sceneMessage = `${switched.pokemon.name} entre au combat !`;
    state.turnState = replacementSide === "left" ? "left-action" : "right-action";
    renderDraftSimpleBattleDevPanel(state);
    return state;
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
  __gbaMenuView = "main";
  playGbaBeep(540, 50, 0.035, "triangle");
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
  __gbaMenuView = "main";
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

async function openDraftFriendBattle() {
  if (!draftArenaState || draftArenaState.team.length < DRAFT_TEAM_SIZE) {
    alert("Drafte d'abord 6 Pokémon avant d'affronter un ami.");
    return null;
  }
  // Ouvre la preview avec la team du joueur (mode arena-run, on bascule en network juste après)
  await launchDraftArenaBattle();
  if (!draftSimpleBattleDevUiState) return null;
  // Bascule en mode network-pvp et crée la room
  return hostDraftSimpleBattleNetworkRoom();
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
window.openDraftFriendBattle = openDraftFriendBattle;
window.createDraftScoreAttackRoom = createDraftScoreAttackRoom;
window.joinDraftScoreAttackRoom = joinDraftScoreAttackRoom;
window.leaveDraftScoreAttackRoom = leaveDraftScoreAttackRoom;
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
      const activeDraftScreen = document.getElementById(snapshot?.mode === "scoreAttack" ? "screen-draft-score-attack" : "screen-draft-arena");
      if (snapshot && snapshot === draftArenaState && activeDraftScreen && !activeDraftScreen.classList.contains("hidden")) {
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

function rerollDraftScoreAttackWave() {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || draftArenaState.phase !== "draft") return;
  // Mode duel synchronisé : router vers le serveur (host only)
  if (draftArenaState.duelMode && draftArenaState.scoreAttackRoom) {
    const socket = ensureMultiplayerSocket();
    if (!socket?.connected) return;
    socket.emit("draft-score:reroll-duel-wave", {}, (response = {}) => {
      if (!response.ok && draftArenaState) {
        draftArenaState.scoreAttackRoomError = response.error || "Reroll refusé.";
        renderDraftArena();
      }
    });
    return;
  }
  if (draftArenaState.scoreAttackRerollsLeft <= 0) {
    draftArenaState.message = "Plus de relance disponible pour cette tentative Score Attack.";
    return renderDraftArena();
  }
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);
  draftArenaState.options = buildDraftWeightedWave(pool, DRAFT_PICK_COUNT, excludeDexIds).map((pokemon) => createDraftOptionEntry(pokemon));
  draftArenaState.scoreAttackRerollsLeft -= 1;
  draftArenaState.message = `Relance utilisée. Encore ${draftArenaState.scoreAttackRerollsLeft} reroll${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""}.`;
  warmDraftPokemonMetrics([
    ...draftArenaState.options.map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
  renderDraftArena();
}

function rerollDraftScoreAttackOption(pokemonId) {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || draftArenaState.phase !== "draft") return;
  if (draftArenaState.scoreAttackRerollsLeft <= 0) {
    draftArenaState.message = "Plus de relance disponible. Lance le mode classique pour reset.";
    return renderDraftArena();
  }
  const optionIndex = draftArenaState.options.findIndex((option) => option.pokemon.id === pokemonId);
  if (optionIndex < 0) return;
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);
  for (const option of draftArenaState.options) {
    if (option && option.pokemon && option.pokemon.id !== pokemonId) {
      excludeDexIds.add(getDraftPoolEntryKey(option.pokemon));
    }
  }
  const replacement = buildDraftWeightedWave(pool, 1, excludeDexIds)[0];
  if (!replacement) {
    draftArenaState.message = "Pool épuisé pour reroll individuel.";
    return renderDraftArena();
  }
  draftArenaState.options[optionIndex] = createDraftOptionEntry(replacement);
  draftArenaState.scoreAttackRerollsLeft -= 1;
  draftArenaState.message = `Option remplacée. Encore ${draftArenaState.scoreAttackRerollsLeft} reroll${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""}.`;
  warmDraftPokemonMetrics([
    ...draftArenaState.options.map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
  renderDraftArena();
}

function getDraftScoreAttackRecord(gen) {
  if (!playerProfile || !gen) return 0;
  const records = playerProfile.draftScoreAttackRecords || {};
  return Number(records[gen]) || 0;
}

function updateDraftScoreAttackRecord(gen, average) {
  if (!playerProfile || !gen) return false;
  playerProfile.draftScoreAttackRecords = playerProfile.draftScoreAttackRecords || {};
  const prev = Number(playerProfile.draftScoreAttackRecords[gen]) || 0;
  if (average > prev) {
    playerProfile.draftScoreAttackRecords[gen] = average;
    try { saveProfile(); } catch (_e) {}
    return true;
  }
  return false;
}

function getDraftScoreAttackRoomSelf(room = draftArenaState?.scoreAttackRoom) {
  return room?.players?.find((player) => player.isSelf) || null;
}

function emitDraftScoreAttackProgress() {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || !draftArenaState.scoreAttackRoom) return;
  if (!multiplayerSocket?.connected) return;
  const team = draftArenaState.team
    .filter((entry) => entry?.pokemon)
    .slice(0, DRAFT_TEAM_SIZE)
    .map((entry) => ({
      id: Number(entry.pokemon.id) || 0,
      name: entry.pokemon.name,
      bst: Number(getDraftCachedPokemonPowerData(entry.pokemon).statGlobal) || 0,
      shiny: Boolean(entry.shiny),
    }));
  const metrics = getDraftTeamBstMetrics(draftArenaState.team);
  multiplayerSocket.emit("draft-score:pick-progress", {
    team,
    average: metrics.average || 0,
    total: metrics.total || 0,
  });
}

function getDraftScoreAttackRoomOpponent(room = draftArenaState?.scoreAttackRoom) {
  return room?.players?.find((player) => !player.isSelf) || null;
}

function applyDraftScoreAttackRoomState(roomState) {
  if (!draftArenaState) return;
  const prevRoom = draftArenaState.scoreAttackRoom;
  const prevStatus = prevRoom?.status || null;
  const prevDuelGen = prevRoom?.duel?.gen ?? null;
  const prevWaveIndex = Number(prevRoom?.duel?.waveIndex) || 0;
  const prevLastEventAt = Number(prevRoom?.duel?.lastEvent?.at) || 0;
  // Détecter un nouveau pick adverse → toast notification
  const newEvent = roomState?.duel?.lastEvent;
  if (newEvent && newEvent.kind === "pick" && Number(newEvent.at) > prevLastEventAt) {
    const self = getDraftScoreAttackRoomSelf(roomState);
    if (self && newEvent.side && newEvent.side !== self.side) {
      const opp = roomState.players?.find((p) => !p.isSelf);
      showDraftScoreOpponentToast(`⚡ ${opp?.nickname || "Adversaire"} a choisi !`);
    }
  }
  draftArenaState.scoreAttackRoom = roomState || null;
  draftArenaState.scoreAttackRoomPending = null;
  draftArenaState.scoreAttackRoomError = null;
  const self = getDraftScoreAttackRoomSelf(roomState);
  draftArenaState.scoreAttackSubmitted = Boolean(self?.hasSubmitted);
  // Détection nouveau duel après une partie finie (relance) → fermer la finale + reset
  const newGen = roomState?.duel?.gen ?? null;
  const newStatus = roomState?.status || null;
  const newWaveIndex = Number(roomState?.duel?.waveIndex) || 0;
  const isFreshDuel = newStatus === "live" && (
    prevStatus === "finished"
    || (newGen !== null && prevDuelGen !== null && newGen !== prevDuelGen)
    || (newWaveIndex === 0 && prevWaveIndex > 0)
  );
  if (isFreshDuel) {
    document.getElementById("draft-score-finale-overlay")?.remove();
    draftScoreFinaleShownFor = null;
  }
  // Mode pool indépendant : on ne synchronise PAS le state local depuis le serveur duel.
  // Le panneau VS lit la progression de l'autre via room.players[].progress (envoyé après chaque pick local)
  draftArenaState.duelMode = false;
  if (draftArenaState.mode === "scoreAttack") renderDraftArena();
  maybeShowDraftScoreFinale(roomState);
}

function syncDraftDuelStateFromServer(roomState) {
  if (!draftArenaState || !roomState?.duel) return;
  draftArenaState.duelMode = true;
  draftArenaState.selectedGen = Number(roomState.duel.gen) || draftArenaState.selectedGen;
  draftArenaState.phase = roomState.status === "finished" ? "result" : "draft";
  const self = getDraftScoreAttackRoomSelf(roomState);
  const selfSide = self?.side || "left";
  // Update team from server duel teams
  const serverTeam = roomState.duel.teams?.[selfSide] || [];
  draftArenaState.team = serverTeam.map((entry) => {
    const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
    return pokemon ? { pokemon, shiny: false } : null;
  }).filter(Boolean);
  draftArenaState.selectedDexIds = new Set(serverTeam.map((entry) => String(entry.id)));
  // Update options from currentWave
  const wave = roomState.duel.currentWave || [];
  draftArenaState.options = wave.map((entry) => {
    const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
    return pokemon ? createDraftOptionEntry(pokemon, false, false) : null;
  }).filter(Boolean);
  // Has self picked this wave ?
  const pendingSides = Array.isArray(roomState.duel.pendingSides) ? roomState.duel.pendingSides : [];
  draftArenaState.duelPendingSelf = pendingSides.includes(selfSide);
  draftArenaState.duelWaveIndex = Number(roomState.duel.waveIndex) || 0;
  draftArenaState.duelPicksRemaining = roomState.duel.picksRemaining || { left: 6, right: 6 };
  // Préchargement des vraies stats (PokéAPI) pour les options + l'équipe → évite BST fallback approximatif
  warmDraftPokemonMetrics([
    ...draftArenaState.options.filter(Boolean).map((opt) => opt.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
}

function startDraftScoreDuel(gen) {
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected || !draftArenaState) return;
  socket.emit("draft-score:start-duel", { gen: Number(gen) }, (response = {}) => {
    if (!response.ok) {
      draftArenaState.scoreAttackRoomError = response.error || "Impossible de lancer le duel.";
      renderDraftArena();
    }
  });
}

async function pickDraftScoreDuelOption(pokemonId) {
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected || !draftArenaState) return;
  const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(pokemonId));
  if (!pokemon) return;
  // S'assurer d'avoir le vrai BST (PokéAPI) avant d'envoyer, sinon le serveur stockera un fallback approximatif
  let bst = Number(getDraftCachedPokemonPowerData(pokemon).statGlobal) || 0;
  if (bst < 200 || bst > 800) {
    try {
      const data = await getDraftPokemonPowerData(pokemon);
      bst = Number(data?.statGlobal) || bst;
    } catch (_e) { /* on continue avec le fallback */ }
  }
  socket.emit("draft-score:pick-option", { pokemonId: Number(pokemonId), bst }, (response = {}) => {
    if (!response.ok && draftArenaState) {
      draftArenaState.scoreAttackRoomError = response.error || "Pick refusé.";
      renderDraftArena();
    }
  });
}

function createDraftScoreAttackRoom() {
  if (!draftArenaState) return;
  draftArenaState.mode = "scoreAttack";
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return;
  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour la room Score Attack :", playerProfile.nickname || "Joueur 1") || "") || "Joueur 1";
  draftArenaState.scoreAttackRoomPending = "create";
  draftArenaState.scoreAttackRoomError = null;
  renderDraftArena();
  socket.emit("draft-score:create-room", { nickname }, (response = {}) => {
    draftArenaState.scoreAttackRoomPending = null;
    if (!response.ok) {
      draftArenaState.scoreAttackRoomError = response.error || "Impossible de créer la room Score Attack.";
      renderDraftArena();
      return;
    }
    applyDraftScoreAttackRoomState(response.room);
  });
}

function joinDraftScoreAttackRoom() {
  if (!draftArenaState) return;
  draftArenaState.mode = "scoreAttack";
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return;
  const code = String(window.prompt("Code de room Score Attack :", "") || "").trim().toUpperCase();
  if (!code) return;
  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour rejoindre le Score Attack :", playerProfile.nickname || "Joueur 2") || "") || "Joueur 2";
  draftArenaState.scoreAttackRoomPending = "join";
  draftArenaState.scoreAttackRoomError = null;
  renderDraftArena();
  socket.emit("draft-score:join-room", { code, nickname }, (response = {}) => {
    draftArenaState.scoreAttackRoomPending = null;
    if (!response.ok) {
      draftArenaState.scoreAttackRoomError = response.error || "Impossible de rejoindre la room Score Attack.";
      renderDraftArena();
      return;
    }
    applyDraftScoreAttackRoomState(response.room);
  });
}

function leaveDraftScoreAttackRoom() {
  if (multiplayerSocket?.connected) multiplayerSocket.emit("draft-score:leave-room");
  if (!draftArenaState) return;
  draftArenaState.scoreAttackRoom = null;
  draftArenaState.scoreAttackSubmitted = false;
  draftArenaState.scoreAttackRoomPending = null;
  draftArenaState.scoreAttackRoomError = null;
  renderDraftArena();
}

function submitDraftScoreAttackResult(metrics = null) {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || !draftArenaState.scoreAttackRoom || draftArenaState.scoreAttackSubmitted) return;
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return;
  const finalMetrics = metrics || getDraftTeamBstMetrics(draftArenaState.team);
  const team = draftArenaState.team
    .filter((entry) => entry?.pokemon)
    .slice(0, DRAFT_TEAM_SIZE)
    .map((entry) => ({
      id: Number(entry.pokemon.id) || 0,
      name: entry.pokemon.name,
      bst: Number(getDraftCachedPokemonPowerData(entry.pokemon).statGlobal) || 0,
    }));
  if (team.length !== DRAFT_TEAM_SIZE || !finalMetrics.average) return;
  draftArenaState.scoreAttackSubmitted = true;
  socket.emit("draft-score:submit-result", {
    average: finalMetrics.average,
    total: finalMetrics.total,
    selectedGen: draftArenaState.selectedGen,
    label: getDraftScoreAttackResultLabel(finalMetrics.average),
    team,
  }, (response = {}) => {
    if (!response.ok) {
      draftArenaState.scoreAttackSubmitted = false;
      draftArenaState.scoreAttackRoomError = response.error || "Impossible d'envoyer le score.";
      renderDraftArena();
      return;
    }
    applyDraftScoreAttackRoomState(response.room);
  });
}

let draftScoreFinaleShownFor = null;
let draftScoreOpponentToastTimer = null;

function sendDraftScoreReaction(emoji) {
  if (!multiplayerSocket?.connected || !draftArenaState?.scoreAttackRoom) return;
  multiplayerSocket.emit("draft-score:reaction", { emoji });
  // Animation locale immédiate (sur soi-même)
  showDraftScoreReactionEmoji({ emoji, fromSide: "self", local: true });
}

function showDraftScoreReactionEmoji(payload = {}) {
  const emoji = String(payload.emoji || "").trim();
  if (!emoji) return;
  const isLocal = Boolean(payload.local);
  // Cibler la card du joueur qui envoie l'émoji (ou la card adverse si reçu)
  const targetSel = isLocal ? ".draft-score-vs-player.is-self" : ".draft-score-vs-player.is-opponent";
  const target = document.querySelector(targetSel);
  if (!target) return;
  const node = document.createElement("div");
  node.className = "draft-score-reaction-emoji";
  node.textContent = emoji;
  // Position random horizontale dans la card
  node.style.left = `${20 + Math.random() * 60}%`;
  target.appendChild(node);
  setTimeout(() => node.remove(), 2000);
}

function showDraftScoreOpponentToast(message) {
  let toast = document.getElementById("draft-score-opp-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "draft-score-opp-toast";
    toast.className = "draft-score-opp-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  if (draftScoreOpponentToastTimer) clearTimeout(draftScoreOpponentToastTimer);
  draftScoreOpponentToastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

function maybeShowDraftScoreFinale(room) {
  if (!room || room.status !== "finished") return;
  const fingerprint = `${room.code}:${room.players?.map((p) => `${p.side}-${p.result?.average || 0}-${p.result?.total || 0}`).join("|")}`;
  if (draftScoreFinaleShownFor === fingerprint) return;
  draftScoreFinaleShownFor = fingerprint;
  updateDraftScoreHeadToHead(room);
  showDraftScoreFinaleOverlay(room);
}

function getDraftScoreHeadToHead(opponentNickname) {
  if (!playerProfile || !opponentNickname) return { wins: 0, losses: 0, draws: 0 };
  const all = playerProfile.draftScoreHeadToHead || {};
  const entry = all[String(opponentNickname).toLowerCase()] || { wins: 0, losses: 0, draws: 0 };
  return {
    wins: Math.max(0, Number(entry.wins) || 0),
    losses: Math.max(0, Number(entry.losses) || 0),
    draws: Math.max(0, Number(entry.draws) || 0),
  };
}

function updateDraftScoreHeadToHead(room) {
  if (!playerProfile || !room || room.status !== "finished") return;
  const self = room.players?.find((p) => p.isSelf);
  const opp = room.players?.find((p) => !p.isSelf);
  if (!self || !opp || !opp.nickname) return;
  const key = String(opp.nickname).toLowerCase();
  playerProfile.draftScoreHeadToHead = playerProfile.draftScoreHeadToHead || {};
  const cur = playerProfile.draftScoreHeadToHead[key] || { wins: 0, losses: 0, draws: 0 };
  if (room.winnerSide === "tie") cur.draws = (Number(cur.draws) || 0) + 1;
  else if (room.winnerSide === self.side) cur.wins = (Number(cur.wins) || 0) + 1;
  else if (room.winnerSide === opp.side) cur.losses = (Number(cur.losses) || 0) + 1;
  playerProfile.draftScoreHeadToHead[key] = cur;
  try { saveProfile(); } catch (_e) {}
}

function showDraftScoreFinaleOverlay(room) {
  const existing = document.getElementById("draft-score-finale-overlay");
  if (existing) existing.remove();
  const self = room.players?.find((p) => p.isSelf);
  const opp = room.players?.find((p) => !p.isSelf);
  if (!self?.result || !opp?.result) return;
  const selfWon = room.winnerSide === self.side;
  const tie = room.winnerSide === "tie";
  const title = tie ? "🤝 ÉGALITÉ !" : selfWon ? "🏆 VICTOIRE !" : "💀 DÉFAITE";
  const titleClass = tie ? "is-tie" : selfWon ? "is-win" : "is-lose";
  const buildTeamRow = (player, side) => {
    const team = Array.isArray(player.result?.team) ? player.result.team : [];
    return `<div class="dsf-team-side dsf-side-${side}">
      <div class="dsf-team-head"><b>${escapeHtml(player.nickname || "Joueur")}</b><span class="dsf-side-label">${side === "left" ? "" : ""}${player.isSelf ? "TOI" : "ADVERSAIRE"}</span></div>
      <div class="dsf-team-sprites">${team.map((entry, idx) => {
        const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
        const sprite = pokemon ? getPokemonSprite(pokemon) : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${entry.id}.png`;
        return `<div class="dsf-pokemon-tile" style="--dsf-i:${idx}"><img src="${escapeHtml(sprite)}" alt="${escapeHtml(entry.name)}" onerror="this.onerror=null;this.src='${pokemon?.sprite || ''}'" /><b>${entry.bst}</b><span>${escapeHtml(entry.name)}</span></div>`;
      }).join("")}</div>
      <div class="dsf-team-score" data-target="${player.result?.average || 0}">0</div>
      <div class="dsf-team-score-label">Moyenne BST</div>
    </div>`;
  };
  // Head-to-head dans la finale
  const h2h = opp.nickname ? getDraftScoreHeadToHead(opp.nickname) : null;
  const h2hTotal = h2h ? (h2h.wins + h2h.losses + h2h.draws) : 0;
  const h2hHtml = h2hTotal > 0
    ? `<div class="dsf-h2h">Bilan contre <b>${escapeHtml(opp.nickname || "")}</b> : <b class="dsf-h2h-w">${h2h.wins}V</b> · <b class="dsf-h2h-l">${h2h.losses}D</b>${h2h.draws ? ` · <b class="dsf-h2h-t">${h2h.draws}N</b>` : ""}</div>`
    : "";
  const overlay = document.createElement("div");
  overlay.id = "draft-score-finale-overlay";
  overlay.className = "draft-score-finale-overlay";
  overlay.innerHTML = `
    <div class="dsf-backdrop"></div>
    <div class="dsf-content">
      <div class="dsf-title ${titleClass}">${title}</div>
      ${h2hHtml}
      <div class="dsf-versus">
        ${buildTeamRow(self, "left")}
        <div class="dsf-vs-center">VS</div>
        ${buildTeamRow(opp, "right")}
      </div>
      <div class="dsf-actions">
        <button class="btn-red" type="button" id="dsf-close">Continuer</button>
      </div>
      <div class="dsf-rematch-hint">${self.isHost ? "💡 Clique sur une génération en bas pour relancer un duel." : "💡 En attente de l'hôte pour choisir une nouvelle génération…"}</div>
    </div>`;
  document.body.appendChild(overlay);
  // Animate score counters
  setTimeout(() => {
    overlay.querySelectorAll(".dsf-team-score").forEach((el) => {
      const target = Number(el.dataset.target) || 0;
      const start = Date.now();
      const duration = 1400;
      const step = () => {
        const elapsed = Date.now() - start;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = target;
      };
      requestAnimationFrame(step);
    });
  }, 600);
  document.getElementById("dsf-close")?.addEventListener("click", () => {
    overlay.classList.add("is-closing");
    setTimeout(() => overlay.remove(), 300);
  });
  // Auto-focus close button for keyboard accessibility
  setTimeout(() => document.getElementById("dsf-close")?.focus(), 300);
}

function renderDraftScoreAttackPlayerCard(player, isSelf) {
  // Mode pool indépendant : lire depuis player.progress.team (mis à jour live à chaque pick)
  // Fallback sur player.result.team quand la partie est finalisée
  const team = Array.isArray(player.progress?.team) && player.progress.team.length
    ? player.progress.team
    : (Array.isArray(player.result?.team) ? player.result.team : []);
  const average = player.result?.average ?? player.progress?.average ?? 0;
  const total = player.result?.total ?? player.progress?.total ?? 0;
  const filled = team.length;
  const slotsHtml = Array.from({ length: DRAFT_TEAM_SIZE }, (_, i) => {
    const entry = team[i];
    if (!entry) {
      return `<div class="draft-score-vs-slot is-empty"><span>?</span></div>`;
    }
    // Résoudre le sprite via getPokemonSprite (gère les Mega/Z-A formes spéciales)
    const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
    let sprite;
    if (pokemon) {
      sprite = entry.shiny && typeof getPokemonShinySprite === "function" ? getPokemonShinySprite(pokemon) : getPokemonSprite(pokemon);
    } else {
      sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${entry.id}.png`;
    }
    return `<div class="draft-score-vs-slot is-filled${entry.shiny ? " is-shiny" : ""}" data-slot-key="${entry.id}-${i}" title="${escapeHtml(entry.name)} (BST ${entry.bst})"><img src="${escapeHtml(sprite)}" alt="${escapeHtml(entry.name)}" loading="lazy" onerror="this.onerror=null;this.src='${pokemon?.sprite || ''}'" /><b>${entry.bst}</b></div>`;
  }).join("");
  const status = player.hasSubmitted
    ? "✅ Soumis"
    : filled === 0
      ? "⏳ Choisit ses Pokémon…"
      : filled < DRAFT_TEAM_SIZE
        ? `🔥 ${filled}/6 picks`
        : "📤 Envoi du score…";
  return `
    <div class="draft-score-vs-player ${isSelf ? "is-self" : "is-opponent"} ${player.connected ? "" : "is-disconnected"}">
      <div class="draft-score-vs-head">
        <div class="draft-score-vs-name"><b>${escapeHtml(player.nickname || "Joueur")}</b>${isSelf ? "<span>TOI</span>" : ""}</div>
        <div class="draft-score-vs-status">${status}</div>
      </div>
      <div class="draft-score-vs-slots">${slotsHtml}</div>
      <div class="draft-score-vs-metrics">
        <div class="draft-score-vs-metric"><span>Moyenne BST</span><b>${average || "-"}</b></div>
        <div class="draft-score-vs-metric"><span>Total</span><b>${total || "-"}</b></div>
      </div>
    </div>`;
}

function renderDraftScoreAttackRoomStatus(room = draftArenaState?.scoreAttackRoom) {
  if (!draftArenaState?.scoreAttackRoomError && !room) {
    return `<div class="draft-score-vs-empty">
      <b>🎯 Score Attack solo</b>
      <span>Drafte pour battre ton record perso, ou défie un ami en duel live ci-dessous.</span>
      <div class="draft-score-vs-empty-actions">
        <button class="btn-blue" type="button" onclick="createDraftScoreAttackRoom()">🆚 Créer une room 1v1</button>
        <button class="btn-ghost" type="button" onclick="joinDraftScoreAttackRoom()">🔗 Rejoindre par code</button>
      </div>
    </div>`;
  }
  if (!room) {
    return `<div class="draft-score-vs-empty">
      <b>Score Attack 1v1</b>
      <span>${escapeHtml(draftArenaState.scoreAttackRoomError || "Room indisponible.")}</span>
      <div class="draft-score-vs-empty-actions">
        <button class="btn-blue" type="button" onclick="createDraftScoreAttackRoom()">🆚 Créer une room</button>
        <button class="btn-ghost" type="button" onclick="joinDraftScoreAttackRoom()">🔗 Rejoindre</button>
      </div>
    </div>`;
  }
  const self = getDraftScoreAttackRoomSelf(room);
  const opponent = getDraftScoreAttackRoomOpponent(room);
  let headTitle = "";
  if (room.status === "finished") {
    if (room.winnerSide === "tie") headTitle = "🤝 Égalité parfaite";
    else if (self && room.winnerSide === self.side) headTitle = "🏆 VICTOIRE !";
    else headTitle = "💀 Défaite";
  } else if (!opponent) {
    headTitle = `⏳ En attente d'un adversaire • Code : ${escapeHtml(room.code || "-")}`;
  } else {
    headTitle = `⚔️ DUEL EN COURS • Code ${escapeHtml(room.code || "-")}`;
  }
  const selfCard = self ? renderDraftScoreAttackPlayerCard(self, true) : "";
  const oppCard = opponent ? renderDraftScoreAttackPlayerCard(opponent, false) : `<div class="draft-score-vs-player is-opponent is-waiting"><div class="draft-score-vs-head"><div class="draft-score-vs-name"><b>En attente…</b></div></div><div class="draft-score-vs-slots">${Array.from({ length: DRAFT_TEAM_SIZE }, () => `<div class="draft-score-vs-slot is-empty"><span>?</span></div>`).join("")}</div><div class="draft-score-vs-share">Partage le code <b>${escapeHtml(room.code || "")}</b> à ton ami pour le faire rejoindre.</div></div>`;
  const selfAvg = self?.progress?.average || self?.result?.average || 0;
  const oppAvg = opponent?.progress?.average || opponent?.result?.average || 0;
  const leadIndicator = (selfAvg > 0 || oppAvg > 0) && opponent
    ? `<div class="draft-score-vs-lead">${selfAvg > oppAvg ? "🔥 Tu mènes !" : oppAvg > selfAvg ? "⚠️ Tu es mené" : "⚖️ Égalité"} (${selfAvg} vs ${oppAvg})</div>`
    : "";
  let headToHeadHtml = "";
  if (opponent?.nickname) {
    const h2h = getDraftScoreHeadToHead(opponent.nickname);
    const total = h2h.wins + h2h.losses + h2h.draws;
    if (total > 0) {
      const ledTxt = h2h.wins > h2h.losses ? "🏆 Tu mènes" : h2h.losses > h2h.wins ? "💀 Tu es mené" : "⚖️ Vous êtes à égalité";
      headToHeadHtml = `<div class="draft-score-vs-h2h"><span>${ledTxt} contre <b>${escapeHtml(opponent.nickname)}</b></span><span class="draft-score-h2h-numbers"><b class="is-win">${h2h.wins}V</b> · <b class="is-lose">${h2h.losses}D</b>${h2h.draws ? ` · <b class="is-tie">${h2h.draws}N</b>` : ""}</span></div>`;
    }
  }
  const leaveBtn = `<button class="draft-score-vs-leave" type="button" onclick="leaveDraftScoreAttackRoom()" title="Quitter la room">🚪 Quitter</button>`;
  const canReact = Boolean(opponent && room.status === "live");
  const reactionBar = canReact
    ? `<div class="draft-score-reaction-bar">${["🔥", "😱", "😈", "👍", "🤡", "💀", "👀", "🎯"].map((emoji) => `<button class="draft-score-reaction-btn" type="button" onclick="sendDraftScoreReaction('${emoji}')" title="Envoyer ${emoji}">${emoji}</button>`).join("")}</div>`
    : "";
  return `
    <div class="draft-score-vs-wrap">
      ${leaveBtn}
      <div class="draft-score-vs-title">${headTitle}</div>
      ${headToHeadHtml}
      ${leadIndicator}
      ${reactionBar}
      <div class="draft-score-vs-arena">
        ${selfCard}
        <div class="draft-score-vs-versus">VS</div>
        ${oppCard}
      </div>
    </div>
  `;
}

function selectDraftGeneration(gen) {
  if (!draftArenaState) return;
  // Mode Score Attack en room : chaque joueur draft INDÉPENDAMMENT avec son propre pool
  // Le panneau VS affiche la progression de l'autre en live (via pick-progress)
  // Reset côté serveur (efface result/progress, repasse status en live si les 2 ont reset)
  if (draftArenaState.mode === "scoreAttack" && draftArenaState.scoreAttackRoom && multiplayerSocket?.connected) {
    multiplayerSocket.emit("draft-score:reset-self");
  }

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
  draftArenaState.scoreAttackRerollsLeft = DRAFT_SCORE_ATTACK_REROLLS;
  draftArenaState.scoreAttackBestAverage = 0;
  draftArenaState.scoreAttackSubmitted = false;
  draftArenaState.message = draftArenaState.mode === "scoreAttack"
    ? `Score Attack ${draftGenLabel(gen)}. Monte la meilleure moyenne BST possible.`
    : `Génération sélectionnée : ${draftGenLabel(gen)}. Choisis ton premier Pokémon.`;

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
  if (draftArenaState?.mode === "scoreAttack" && draftArenaState.scoreAttackRoom && multiplayerSocket?.connected) {
    multiplayerSocket.emit("draft-score:leave-room");
  }
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
  closeRankingPicker();
  stopCrySound();
  setQuizModeLayout(false);
  stopEmulatorSession();
  mountDraftModeCard("arena");
  document.getElementById("screen-draft-arena").classList.remove("hidden");
  setGlobalNavActive("extras");

  if (!draftArenaState || draftArenaState.mode !== "arena") {
    draftArenaState = createDraftArenaState();
    draftArenaState.mode = "arena";
    draftArenaState.message = "Choisis une génération pour commencer le draft.";
  }

  renderDraftArena();
}

function openDraftScoreAttackMode() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  document.getElementById("screen-draft-arena")?.classList.add("hidden");
  closeRankingPicker();
  stopCrySound();
  setQuizModeLayout(false);
  stopEmulatorSession();
  clearDraftSimpleBattleDevPanel();
  mountDraftModeCard("scoreAttack");
  document.getElementById("screen-draft-score-attack")?.classList.remove("hidden");
  setGlobalNavActive("game");

  if (!draftArenaState || draftArenaState.mode !== "scoreAttack") {
    draftArenaState = createDraftArenaState();
    draftArenaState.mode = "scoreAttack";
    draftArenaState.message = "Score Attack prêt. Choisis une génération pour viser la meilleure moyenne BST.";
  }

  renderDraftArena();
}

function mountDraftModeCard(mode = "arena") {
  const card = document.getElementById("draft-mode-card");
  const arenaScreen = document.getElementById("screen-draft-arena");
  const scoreScreen = document.getElementById("screen-draft-score-attack");
  if (!card || !arenaScreen || !scoreScreen) return;
  const target = mode === "scoreAttack" ? scoreScreen : arenaScreen;
  if (card.parentElement !== target) target.appendChild(card);
  arenaScreen.classList.toggle("is-mode-score-attack", false);
  scoreScreen.classList.toggle("is-mode-score-attack", mode === "scoreAttack");
  // Adapter le titre + sous-titre selon le mode actif
  const title = card.querySelector(".card-title");
  if (title) title.innerHTML = mode === "scoreAttack" ? "🎯 Draft Score Attack" : "🏟️ Draft Arènes";
  const desc = card.querySelector(".card-desc");
  if (desc) desc.textContent = mode === "scoreAttack"
    ? "Drafte 6 Pokémon, optimise la moyenne BST et défie un ami en 1v1 Score."
    : "Choisis une génération, drafte 6 Pokémon, puis découvre les badges que ton équipe peut réellement viser.";
}

function restartDraftArenaRun() {
  // En mode duel synchronisé : ne PAS reset local, demander au serveur de relancer en gardant la room
  if (draftArenaState?.mode === "scoreAttack" && draftArenaState?.scoreAttackRoom && draftArenaState?.duelMode) {
    const room = draftArenaState.scoreAttackRoom;
    const self = getDraftScoreAttackRoomSelf(room);
    if (!self?.isHost) {
      draftArenaState.scoreAttackRoomError = "Seul l'hôte peut lancer une nouvelle partie. Tu peux changer la génération depuis chez l'hôte.";
      return renderDraftArena();
    }
    const currentGen = Number(draftArenaState.selectedGen) || Number(room?.duel?.gen) || null;
    if (currentGen) {
      // Relance avec la même gen
      return startDraftScoreDuel(currentGen);
    }
    draftArenaState.message = "Clique sur une génération pour lancer une nouvelle partie.";
    return renderDraftArena();
  }
  const previousMode = draftArenaState?.mode || "arena";
  const previousScoreRoom = draftArenaState?.scoreAttackRoom || null;
  draftArenaState = createDraftArenaState();
  draftArenaState.mode = previousMode;
  if (previousMode === "scoreAttack") {
    draftArenaState.scoreAttackRoom = previousScoreRoom;
    draftArenaState.scoreAttackSubmitted = false;
  }
  draftArenaState.message = previousMode === "scoreAttack"
    ? "Score Attack prêt. Choisis une génération pour viser la meilleure moyenne BST."
    : "Choisis une génération pour commencer le draft.";
  renderDraftArena();
}

function toggleDraftScoreAttackMode() {
  if (draftArenaState?.mode === "scoreAttack") openDraftArenaMode();
  else openDraftScoreAttackMode();
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
  emitDraftScoreAttackProgress();

  if (draftArenaState.team.length >= DRAFT_TEAM_SIZE) {
    if (draftArenaState.mode === "scoreAttack") {
      const metrics = getDraftTeamBstMetrics(draftArenaState.team);
      draftArenaState.phase = "result";
      draftArenaState.scoreAttackBestAverage = Math.max(Number(draftArenaState.scoreAttackBestAverage) || 0, metrics.average);
      const previousRecord = getDraftScoreAttackRecord(draftArenaState.selectedGen);
      const isNewRecord = updateDraftScoreAttackRecord(draftArenaState.selectedGen, metrics.average);
      draftArenaState.scoreAttackNewRecord = isNewRecord;
      draftArenaState.scoreAttackPreviousRecord = previousRecord;
      draftArenaState.runSummary = {
        status: `${getDraftScoreAttackResultLabel(metrics.average)} • Moyenne ${metrics.average}${isNewRecord ? " 🏆 NOUVEAU RECORD !" : ""}`,
        mvpName: draftArenaState.team
          .slice()
          .sort((left, right) => (getDraftCachedPokemonPowerData(right.pokemon).statGlobal || 0) - (getDraftCachedPokemonPowerData(left.pokemon).statGlobal || 0))[0]?.pokemon?.name || "-",
        balanceLabel: `Total BST ${metrics.total}`,
        offenseLabel: `${draftArenaState.scoreAttackRerollsLeft} reroll${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""} restant${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""}${previousRecord > 0 ? ` • Précédent record : ${previousRecord}` : ""}`,
      };
      draftArenaState.message = isNewRecord
        ? `🏆 NOUVEAU RECORD Gen ${draftArenaState.selectedGen} : moyenne BST ${metrics.average} ! (avant : ${previousRecord || 0})`
        : `Score Attack terminé : moyenne BST ${metrics.average}. ${getDraftScoreAttackResultLabel(metrics.average)}.`;
      // XP + quêtes Score Attack
      awardXp(Math.round(metrics.average / 10), `Score Attack ${metrics.average} BST`);
      if (isNewRecord) awardXp(50, "Nouveau record Score Attack");
      progressQuest("score_attack_500", metrics.average);
      progressQuest("score_attack_600", metrics.average);
      progressQuest("draft_complete", 1);
      submitDraftScoreAttackResult(metrics);
      renderDraftArena();
      return;
    }
    await prepareDraftArenaBattleRun();
    if (draftArenaState) {
      draftArenaState.message = `Équipe complète ! Clique "Lancer le duel" pour affronter la première arène.`;
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
  const screen = document.getElementById(draftArenaState?.mode === "scoreAttack" ? "screen-draft-score-attack" : "screen-draft-arena");
  if (!screen || !draftArenaState) return;
  mountDraftModeCard(draftArenaState.mode);

  const status = document.getElementById("draft-status");
  const genBadge = document.getElementById("draft-gen-badge");
  const picksBadge = document.getElementById("draft-picks-badge");
  const shinyBadge = document.getElementById("draft-shiny-badge");
  const averageBadge = document.getElementById("draft-bst-average-badge");
  const badgeCount = document.getElementById("draft-badge-count");
  const genButtons = document.getElementById("draft-gen-buttons");
  const options = document.getElementById("draft-options");
  const team = document.getElementById("draft-team");
  const teamMetrics = document.getElementById("draft-team-metrics");
  const runBar = document.getElementById("draft-run-bar");
  const resultWrap = document.getElementById("draft-result-wrap");
  const resultTitle = document.getElementById("draft-result-title");
  const runSummary = document.getElementById("draft-run-summary");
  const badgeGrid = document.getElementById("draft-badge-grid");
  const arenaList = document.getElementById("draft-arena-list");
  const battleLaunch = document.getElementById("draft-battle-launch");
  const battleClose = document.getElementById("draft-battle-close");
  const battlePokemonSelect = document.getElementById("draft-battle-pokemon");
  const scoreRerollButton = document.getElementById("draft-score-reroll");
  const scoreRoomCreate = document.getElementById("draft-score-room-create");
  const scoreRoomJoin = document.getElementById("draft-score-room-join");
  const scoreRoomLeave = document.getElementById("draft-score-room-leave");
  const scoreRoomStatus = document.getElementById("draft-score-room-status");
  const arenas = DRAFT_ARENAS_BY_GEN[draftArenaState.selectedGen] || [];
  const pageTitle = screen.querySelector(".ranking-head .card-title");
  const pageDesc = screen.querySelector(".draft-card > .card-desc");
  const isScoreAttackMode = draftArenaState.mode === "scoreAttack";

  if (pageTitle) pageTitle.textContent = isScoreAttackMode ? "🎯 Draft Score Attack" : "🎴 Draft Arènes";
  if (pageDesc) {
    pageDesc.textContent = isScoreAttackMode
      ? "Drafte 6 Pokémon, optimise la moyenne BST et défie un ami en 1v1 Score."
      : "Choisis une génération, drafte 6 Pokémon, puis découvre les badges que ton équipe peut réellement viser.";
  }

  if (status) status.textContent = draftArenaState.message;
  if (genBadge) genBadge.textContent = draftArenaState.selectedGen ? `Génération : ${draftGenLabel(draftArenaState.selectedGen)}` : "Génération : -";
  if (picksBadge) picksBadge.textContent = `Équipe : ${draftArenaState.team.length} / ${DRAFT_TEAM_SIZE}`;
  if (shinyBadge) shinyBadge.textContent = `Shiny : ${draftArenaState.shinyCount}`;
  const bstMetrics = getDraftTeamBstMetrics(draftArenaState.team);
  if (averageBadge) {
    averageBadge.textContent = `Moy. BST : ${bstMetrics.average || "-"}`;
    averageBadge.dataset.state = bstMetrics.average >= 550 ? "complete" : bstMetrics.average >= 500 ? "progress" : "empty";
  }
  const restartBtn = document.getElementById("draft-restart-btn");
  if (restartBtn) {
    const isDuel = Boolean(draftArenaState.duelMode && draftArenaState.scoreAttackRoom);
    const room = draftArenaState.scoreAttackRoom;
    const selfRoom = room ? getDraftScoreAttackRoomSelf(room) : null;
    const isLiveDuel = isDuel && room?.status === "live";
    if (isDuel) {
      restartBtn.textContent = isLiveDuel ? "⏳ Partie en cours…" : (selfRoom?.isHost ? "🎮 Nouvelle partie" : "⏳ En attente de l'hôte");
      restartBtn.disabled = isLiveDuel || !selfRoom?.isHost;
    } else {
      restartBtn.textContent = "🎲 Nouveau draft";
      restartBtn.disabled = false;
    }
  }
  const recordBadge = document.getElementById("draft-score-record-badge");
  if (recordBadge) {
    const isScoreAttack = draftArenaState.mode === "scoreAttack";
    const record = isScoreAttack ? getDraftScoreAttackRecord(draftArenaState.selectedGen) : 0;
    if (isScoreAttack && draftArenaState.selectedGen) {
      recordBadge.classList.remove("hidden");
      recordBadge.textContent = `🏆 Record Gen ${draftArenaState.selectedGen} : ${record || "-"}`;
      if (draftArenaState.scoreAttackNewRecord) recordBadge.classList.add("is-new-record");
      else recordBadge.classList.remove("is-new-record");
    } else {
      recordBadge.classList.add("hidden");
      recordBadge.classList.remove("is-new-record");
    }
  }
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
  if (badgeCount) badgeCount.textContent = draftArenaState.mode === "scoreAttack"
    ? `Rerolls : ${draftArenaState.scoreAttackRerollsLeft}`
    : `Badges : ${wonCount} / 8`;

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
    battleLaunch.classList.toggle("hidden", draftArenaState.mode === "scoreAttack");
    battleLaunch.dataset.state = battleMeta.disabled ? "locked" : draftArenaState.team.length >= DRAFT_TEAM_SIZE ? "ready" : "idle";
  }
  document.getElementById("draft-battle-friend")?.classList.toggle("hidden", draftArenaState.mode === "scoreAttack");
  document.getElementById("draft-battle-join")?.classList.toggle("hidden", draftArenaState.mode === "scoreAttack");
  if (scoreRoomCreate) {
    scoreRoomCreate.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || Boolean(draftArenaState.scoreAttackRoom));
    scoreRoomCreate.disabled = Boolean(draftArenaState.scoreAttackRoomPending);
  }
  if (scoreRoomJoin) {
    scoreRoomJoin.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || Boolean(draftArenaState.scoreAttackRoom));
    scoreRoomJoin.disabled = Boolean(draftArenaState.scoreAttackRoomPending);
  }
  if (scoreRoomLeave) {
    scoreRoomLeave.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || !draftArenaState.scoreAttackRoom);
  }
  if (scoreRoomStatus) {
    scoreRoomStatus.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack");
    scoreRoomStatus.innerHTML = renderDraftScoreAttackRoomStatus();
  }
  const scoreAttackToggle = document.getElementById("draft-score-attack-toggle");
  if (scoreAttackToggle) {
    const isScoreMode = draftArenaState.mode === "scoreAttack";
    scoreAttackToggle.textContent = isScoreMode ? "🏟️ Mode Arènes" : "🎯 Score Attack";
    scoreAttackToggle.classList.toggle("is-active-mode", isScoreMode);
  }
  screen.classList.toggle("is-mode-score-attack", draftArenaState.mode === "scoreAttack");
  screen.classList.toggle("is-mode-arena", draftArenaState.mode !== "scoreAttack");
  if (scoreRerollButton) {
    const canReroll = draftArenaState.mode === "scoreAttack"
      && draftArenaState.phase === "draft"
      && Boolean(draftArenaState.selectedGen)
      && draftArenaState.scoreAttackRerollsLeft > 0;
    // En mode duel : visible uniquement pour l'host, désactivé si un joueur a déjà pick ou plus de rerolls
    if (draftArenaState.duelMode && draftArenaState.scoreAttackRoom) {
      const room = draftArenaState.scoreAttackRoom;
      const selfRoom = getDraftScoreAttackRoomSelf(room);
      const duelRerollsLeft = Number(room?.duel?.rerollsLeft ?? 0);
      const someoneLocked = Boolean(room?.duel?.pendingSides?.length);
      const canHostReroll = Boolean(selfRoom?.isHost) && room?.status === "live" && !someoneLocked && duelRerollsLeft > 0;
      scoreRerollButton.classList.toggle("hidden", !selfRoom?.isHost || room?.status !== "live");
      scoreRerollButton.disabled = !canHostReroll;
      scoreRerollButton.textContent = `🔄 Relancer la vague duel (${duelRerollsLeft})`;
    } else {
      scoreRerollButton.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || draftArenaState.phase !== "draft");
      scoreRerollButton.disabled = !canReroll;
      scoreRerollButton.textContent = `Relancer la vague (${draftArenaState.scoreAttackRerollsLeft})`;
    }
  }
  if (battleClose && (!draftSimpleBattleDevUiState || document.getElementById("draft-dev-battle-panel")?.classList.contains("hidden"))) {
    battleClose.classList.add("hidden");
  }

  if (genButtons) {
    genButtons.innerHTML = "";
    const room = draftArenaState.scoreAttackRoom;
    const selfRoom = room ? getDraftScoreAttackRoomSelf(room) : null;
    const isDuelHost = Boolean(draftArenaState.mode === "scoreAttack" && room && selfRoom?.isHost);
    // L'host peut relancer à tout moment quand il y a 2 joueurs (live, lobby, finished)
    const canHostRelaunch = isDuelHost && (room?.players?.length || 0) === 2;
    for (const cfg of DRAFT_GEN_OPTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "draft-gen-btn" + (draftArenaState.selectedGen === cfg.gen ? " active" : "");
      btn.textContent = cfg.label;
      btn.disabled = draftArenaState.phase !== "gen" && !canHostRelaunch;
      btn.addEventListener("click", () => selectDraftGeneration(cfg.gen));
      genButtons.appendChild(btn);
    }
  }

  if (options) {
    options.innerHTML = "";
    options.classList.toggle("duel-pending", Boolean(draftArenaState.duelMode && draftArenaState.duelPendingSelf));

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
      // En duel actif : message d'attente du serveur. Sinon : message reset.
      if (draftArenaState.duelMode && draftArenaState.scoreAttackRoom?.duel) {
        msg.textContent = "⏳ Chargement de la wave du duel… Si bloqué, l'hôte peut cliquer sur une génération pour relancer.";
      } else {
        msg.textContent = "Aucune option disponible. Réinitialise le draft.";
      }
      options.appendChild(msg);
    } else {
      let optionIdx = 0;
      for (const option of draftArenaState.options) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "draft-option-card" + (option.shiny ? " is-shiny" : "") + (option.locked ? " picked locked" : "");
        card.style.setProperty("--draft-i", String(optionIdx));
        optionIdx += 1;
        const spriteId = getPokemonSpriteId(option.pokemon);
        const normalSprite = getPokemonSprite(option.pokemon);
        const shownSprite = option.shiny ? getPokemonShinySprite(option.pokemon) : normalSprite;
        const sparkle = option.shiny ? '<span class="draft-shiny-mark">&#10024; Shiny</span>' : "";
          const metrics = getDraftCachedPokemonPowerData(option.pokemon);
        const projectedAverage = draftArenaState.team.length < DRAFT_TEAM_SIZE
          ? Math.round((bstMetrics.total + metrics.statGlobal) / Math.max(1, draftArenaState.team.length + 1))
          : bstMetrics.average;
        const bstValue = Number(metrics.statGlobal) || 0;
        const rarity = bstValue >= 600 ? "legendary" : bstValue >= 500 ? "strong" : bstValue >= 400 ? "decent" : "common";
        card.dataset.rarity = rarity;
        if (option.pokemon.type1) card.dataset.type1 = option.pokemon.type1;
        const isScoreAttack = draftArenaState.mode === "scoreAttack";
        const canRerollOption = isScoreAttack && !option.locked && draftArenaState.scoreAttackRerollsLeft > 0 && !draftArenaState.duelMode;
        const rerollBtn = canRerollOption
          ? `<button type="button" class="draft-option-reroll" data-pokemon-id="${option.pokemon.id}" title="Reroll cette option (1 jeton)">↻</button>`
          : "";
        card.innerHTML = `
          ${rerollBtn}
          <img src="${shownSprite}" alt="${escapeHtml(option.pokemon.name)}" loading="lazy" onerror="this.onerror=null;this.src='${normalSprite}'" />
          <strong>${escapeHtml(option.pokemon.name)}</strong>
          <span>#${spriteId}</span>
          <span class="draft-card-meta">BST ${metrics.statGlobal} • ${escapeHtml(metrics.rarityLabel)}</span>
          <span class="draft-bst-projection">Moy. après pick : ${projectedAverage}</span>
          ${sparkle}
        `;
        card.disabled = Boolean(option.locked);
        if (!option.locked) {
          card.addEventListener("click", (event) => {
            if (event.target?.closest(".draft-option-reroll")) return;
            card.classList.add("picked");
            setTimeout(() => {
              void pickDraftArenaOption(option.pokemon.id);
            }, 140);
          });
          if (canRerollOption) {
            const btn = card.querySelector(".draft-option-reroll");
            if (btn) btn.addEventListener("click", (event) => {
              event.stopPropagation();
              event.preventDefault();
              rerollDraftScoreAttackOption(option.pokemon.id);
            });
          }
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
          <div class="draft-team-empty-icon">?</div>
          <div class="draft-team-card-body">
            <small class="draft-team-slot-label">Slot ${index + 1}</small>
            <b>Vide</b>
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
        <div class="draft-summary-card draft-score-main"><span>Moyenne BST</span><b>${bstMetrics.average}</b><small>${bstMetrics.rank?.label || (bstMetrics.nextTarget ? `${bstMetrics.nextTarget.min - bstMetrics.average} pts avant ${bstMetrics.nextTarget.label}` : "Objectif libre")}</small></div>
        <div class="draft-summary-card"><span>BST total</span><b>${currentTeamStatGlobal}</b></div>
        <div class="draft-summary-card"><span>Synergie</span><b>${draftArenaState.runSummary?.synergyLabel || currentSynergy?.label || "-"}</b></div>
        <div class="draft-summary-card"><span>${draftArenaState.mode === "scoreAttack" ? "Rerolls" : "Région"}</span><b>${draftArenaState.mode === "scoreAttack" ? draftArenaState.scoreAttackRerollsLeft : draftArenaState.selectedGen ? escapeHtml(draftGenLabel(draftArenaState.selectedGen)) : "-"}</b></div>
      `
      : "";
  }

  if (runBar) {
    runBar.innerHTML = arenas.map((arena, index) => {
      const result = draftArenaState.badgeResults[index];
      const statusClass = result?.status || (draftArenaState.phase === "result" && draftArenaState.evaluating ? "pending" : "pending");
      const isCurrent = draftArenaState.phase === "battle" && index === draftArenaState.currentArenaIndex && statusClass !== "won" && statusClass !== "blocked";
      const currentClass = isCurrent ? " is-current" : "";
      return `<div class="draft-run-node ${statusClass}${currentClass}" style="--draft-delay:${index * 80}ms">${getDraftBadgeMarkup(arena, statusClass)}<small>${index + 1}</small><b>${escapeHtml(arena.name)}</b><span>${escapeHtml(arena.type)}</span></div>`;
    }).join("");
  }

  if (resultWrap) {
    resultWrap.classList.toggle("hidden", draftArenaState.phase !== "result" && draftArenaState.phase !== "battle");
  }
  if (resultTitle) {
    resultTitle.textContent = draftArenaState.mode === "scoreAttack" ? "3) Résultat Score Attack" : "3) Résultats des arènes";
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
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
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

  // Pré-check ROM (HEAD) — détecte ROM 404 / réseau pour message clair
  if (rom.url && /^https?:\/\//i.test(rom.url)) {
    fetch(rom.url, { method: "HEAD", mode: "cors" })
      .then((res) => {
        if (!res.ok) {
          setEmuStatus(`ROM introuvable (${res.status}). Vérifie l'URL ou choisis-en une autre.`);
        }
      })
      .catch(() => {
        setEmuStatus("ROM injoignable. Vérifie ta connexion ou choisis une autre source.");
      });
  }

  const script = document.createElement("script");
  script.id = "emulatorjs-loader";
  script.src = `${window.EJS_pathtodata}loader.js?v=${Date.now()}`;
  script.onload = () => {
    setEmuStatus(`Emulateur ${rom.core.toUpperCase()} prêt. Si l'écran reste vide après 10s, recharge la page puis relance.`);
    // Watchdog : si après 12s aucun canvas EmulatorJS n'est apparu, on signale
    setTimeout(() => {
      if (!emulatorRunning) return;
      const playerNode = document.getElementById("emulator-player");
      const hasCanvas = playerNode?.querySelector("canvas, video");
      if (!hasCanvas) {
        setEmuStatus(`Émulateur lancé mais aucun affichage détecté (${rom.core.toUpperCase()}). ROM corrompue ? CDN indisponible ? Essaie de recharger la page.`);
      }
    }, 12000);
  };
  script.onerror = () => {
    emulatorRunning = false;
    setEmuStatus(`Échec de chargement EmulatorJS (${rom.core.toUpperCase()}). CDN injoignable — vérifie ta connexion internet.`);
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
  ['screen-profile','screen-achievements','screen-history','screen-odd-one-out','screen-multiplayer','screen-games-ranking','screen-type-chart','screen-team-builder','screen-teams','screen-stat-clash','screen-higher-lower','screen-poke-connections','screen-stat-auction','screen-draft-score-attack','screen-speedrun'].forEach(hideScreen);
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

const APP_SETTINGS_STORAGE_KEY = "pokedle_app_settings_v1";
const DEFAULT_APP_SETTINGS = {
  theme: "light",
  density: "normal",
  textScale: "normal",
  highContrast: false,
  reduceMotion: false,
};

function getStoredAppSettings() {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    return raw ? { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_APP_SETTINGS };
  } catch (error) {
    console.warn("Failed to read app settings:", error);
    return { ...DEFAULT_APP_SETTINGS };
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
          <select onchange="updateAppSetting('theme', this.value)">
            <option value="light" ${settings.theme === "light" ? "selected" : ""}>Clair</option>
            <option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Sombre</option>
          </select>
        </label>
        <label class="app-setting-item app-setting-item-stack">
          <span><b>Densité</b><small>Compact pour voir plus d'infos, aéré pour plus de confort.</small></span>
          <select onchange="updateAppSetting('density', this.value)">
            <option value="normal" ${settings.density === "normal" ? "selected" : ""}>Normale</option>
            <option value="compact" ${settings.density === "compact" ? "selected" : ""}>Compacte</option>
            <option value="airy" ${settings.density === "airy" ? "selected" : ""}>Aérée</option>
          </select>
        </label>
        <label class="app-setting-item app-setting-item-stack">
          <span><b>Taille du texte</b><small>Ajuste la lisibilité générale de l'interface.</small></span>
          <select onchange="updateAppSetting('textScale', this.value)">
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
          <input type="checkbox" ${settings.highContrast ? "checked" : ""} onchange="updateAppSetting('highContrast', this.checked)" />
        </label>
        <label class="app-setting-item">
          <span><b>Réduire les animations</b><small>Limite les transitions et animations décoratives.</small></span>
          <input type="checkbox" ${settings.reduceMotion ? "checked" : ""} onchange="updateAppSetting('reduceMotion', this.checked)" />
        </label>
      </section>
      <button class="btn-ghost app-settings-reset" type="button" onclick="resetAppSettings()">Réinitialiser les paramètres</button>
    </div>
  `);
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
    btn.innerHTML = `<div class="pokemon-mini-card is-silhouette"><img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(pokemon))}'" /><strong>${escapeHtml(pokemon.name)}</strong></div>`;
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
    btn.innerHTML = `<img src="${getPokemonSprite(pokemon)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getSpriteUrl(getPokemonSpriteId(pokemon))}'" /><span class="odd-card-name">${escapeHtml(pokemon.name)}</span>`;
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
    alert("Sélectionne au moins une génération !");
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
    alert("Sélectionne au moins une génération avec suffisamment de Pokémon.");
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

  multiplayerSocket.on("duel:room-closed", (payload = {}) => {
    const reason = payload.reason || "La room a été fermée.";
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
              <p class="multiplayer-result-title">${resultTitle}</p>
              <p>${escapeHtml(reasonText)}</p>
              <p>${resultSupportText}</p>
              ${postMatchMetaHtml}
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

window.addEventListener('DOMContentLoaded', () => {
  applyAppSettings();
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
