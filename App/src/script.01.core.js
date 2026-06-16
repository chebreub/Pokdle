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
  dailyGame: "pokedle_game_daily_v1",
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
    <div class="dq-backdrop" data-action="closeDailyQuestsModal"></div>
    <div class="dq-content" role="dialog" aria-modal="true">
      <button class="dq-close" type="button" data-action="closeDailyQuestsModal" aria-label="Fermer">×</button>
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
        <button class="btn-red" type="button" data-action="shareLevelBadge">📋 Partager mon niveau</button>
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
  const gameStreak = Number(playerStats?.dailyCurrentStreak) || 0;
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
    <div class="home-engagement-bar" data-action="openDailyQuestsModal" role="button" tabindex="0" data-keydown-action="dailyQuestsKeydown" aria-label="Voir mes quêtes quotidiennes">
      <div class="heb-tier">
        <div class="heb-tier-emoji">${prog.tier.emoji}</div>
        <div class="heb-tier-info">
          <b>Niv. ${prog.tier.level} · ${escapeHtml(prog.tier.name)}</b>
          <span>${xp} XP${prog.next ? ` · ${prog.next.minXp - xp} avant ${prog.next.emoji}` : " · MAX"}</span>
        </div>
      </div>
      <div class="heb-bar"><div class="heb-bar-fill" style="width:${prog.percent}%"></div></div>
      <div class="heb-chips">
        ${gameStreak > 0 ? `<span class="heb-chip is-streak" title="Série Pokémon du jour : ${gameStreak}">📅🔥 ${gameStreak}</span>` : ""}
        ${streak > 0 ? `<span class="heb-chip is-streak" title="${streak} jour${streak > 1 ? "s" : ""} d'affilée">🔥 ${streak}</span>` : ""}
        <span class="heb-chip is-quests" title="${completedToday} quête${completedToday !== 1 ? "s" : ""} terminée${completedToday !== 1 ? "s" : ""} sur ${totalToday}">🎯 ${completedToday}/${totalToday}</span>
      </div>
      <span class="heb-cta">Quêtes →</span>
    </div>`;
}
window.renderHomeEngagementWidget = renderHomeEngagementWidget;

const ACHIEVEMENT_DEFS = [
  // — Devinette (Pokédle / parties) —
  { id: "first_game", title: "Premier pas", desc: "Jouer une première partie.", target: 1, category: "Devinette", getValue: () => playerStats.played || 0 },
  { id: "first_win", title: "Première capture", desc: "Remporter une première partie.", target: 1, category: "Devinette", getValue: () => playerStats.wins || 0 },
  { id: "ten_wins", title: "Apprenti dresseur", desc: "Atteindre 10 victoires.", target: 10, category: "Devinette", getValue: () => playerStats.wins || 0 },
  { id: "twentyfive_wins", title: "Sur la bonne voie", desc: "Atteindre 25 victoires.", target: 25, category: "Devinette", getValue: () => playerStats.wins || 0 },
  { id: "fifty_wins", title: "Dresseur confirmé", desc: "Atteindre 50 victoires.", target: 50, category: "Devinette", getValue: () => playerStats.wins || 0 },
  { id: "hundred_wins", title: "Maître de la devinette", desc: "Atteindre 100 victoires.", target: 100, category: "Devinette", getValue: () => playerStats.wins || 0 },
  { id: "fifty_games", title: "Habitué", desc: "Jouer 50 parties.", target: 50, category: "Devinette", getValue: () => playerStats.played || 0 },
  { id: "hundred_games", title: "Centurion", desc: "Jouer 100 parties.", target: 100, category: "Devinette", getValue: () => playerStats.played || 0 },
  { id: "twofifty_games", title: "Marathonien", desc: "Jouer 250 parties.", target: 250, category: "Devinette", getValue: () => playerStats.played || 0 },
  // — Régularité —
  { id: "daily_streak_3", title: "Régulier", desc: "Série journalière de 3.", target: 3, category: "Régularité", getValue: () => playerStats.dailyBestStreak || 0 },
  { id: "daily_streak_7", title: "Une semaine parfaite", desc: "Série journalière de 7.", target: 7, category: "Régularité", getValue: () => playerStats.dailyBestStreak || 0 },
  { id: "daily_streak_15", title: "Quinzaine en or", desc: "Série journalière de 15.", target: 15, category: "Régularité", getValue: () => playerStats.dailyBestStreak || 0 },
  { id: "daily_streak_30", title: "Inarrêtable", desc: "Série journalière de 30.", target: 30, category: "Régularité", getValue: () => playerStats.dailyBestStreak || 0 },
  { id: "login_7", title: "Fidèle", desc: "Se connecter 7 jours d'affilée.", target: 7, category: "Régularité", getValue: () => Number(playerProfile?.dailyLoginStreak) || 0 },
  { id: "login_30", title: "Pilier de l'arène", desc: "Se connecter 30 jours d'affilée.", target: 30, category: "Régularité", getValue: () => Number(playerProfile?.dailyLoginStreak) || 0 },
  { id: "quests_10", title: "Aventurier", desc: "Accomplir 10 quêtes du jour.", target: 10, category: "Régularité", getValue: () => Number(playerProfile?.totalQuestsCompleted) || 0 },
  { id: "quests_50", title: "Quêteur acharné", desc: "Accomplir 50 quêtes du jour.", target: 50, category: "Régularité", getValue: () => Number(playerProfile?.totalQuestsCompleted) || 0 },
  // — Progression —
  { id: "xp_500", title: "Badge Roche", desc: "Atteindre 500 XP.", target: 500, category: "Progression", getValue: () => Number(playerProfile?.xp) || 0 },
  { id: "xp_2500", title: "Badge Cascade", desc: "Atteindre 2 500 XP.", target: 2500, category: "Progression", getValue: () => Number(playerProfile?.xp) || 0 },
  { id: "xp_10000", title: "Conseil 4", desc: "Atteindre 10 000 XP.", target: 10000, category: "Progression", getValue: () => Number(playerProfile?.xp) || 0 },
  { id: "set_favorite", title: "Mon partenaire", desc: "Choisir un Pokémon favori.", target: 1, category: "Progression", getValue: () => (playerProfile?.favoritePokemonId ? 1 : 0) },
  // — Mini-jeux —
  { id: "quiz_5", title: "Quiz débutant", desc: "Marquer 5 au Quiz.", target: 5, category: "Mini-jeux", getValue: () => Number(playerProfile?.quizHighScore) || 0 },
  { id: "quiz_10", title: "Cerveau de Pierre", desc: "Marquer 10 au Quiz.", target: 10, category: "Mini-jeux", getValue: () => Number(playerProfile?.quizHighScore) || 0 },
  { id: "speedrun_10", title: "Vitesse Graine", desc: "Atteindre 10 au Speedrun.", target: 10, category: "Mini-jeux", getValue: () => Number(playerProfile?.speedrunHighScore) || 0 },
  { id: "party_5", title: "Esprit fête", desc: "Atteindre 5 en Party Pokémon.", target: 5, category: "Mini-jeux", getValue: () => Number(playerProfile?.partyHighScore) || 0 },
  { id: "odd_10", title: "Œil de lynx", desc: "Atteindre 10 à l'Intrus.", target: 10, category: "Mini-jeux", getValue: () => Number(playerProfile?.oddOneOutHighScore) || 0 },
  { id: "odd_streak_5", title: "Sans faute", desc: "Série de 5 à l'Intrus.", target: 5, category: "Mini-jeux", getValue: () => Number(playerProfile?.oddOneOutStreak) || 0 },
  { id: "weight_10", title: "Pèse-Pokémon", desc: "Atteindre 10 au Duel de poids.", target: 10, category: "Mini-jeux", getValue: () => Number(playerProfile?.weightBattleHighScore) || 0 },
  { id: "weight_streak_5", title: "Balance parfaite", desc: "Série de 5 au Duel de poids.", target: 5, category: "Mini-jeux", getValue: () => Number(playerProfile?.weightBattleStreak) || 0 },
  { id: "hl_10", title: "Plus haut, plus bas", desc: "Atteindre 10 à Higher or Lower.", target: 10, category: "Mini-jeux", getValue: () => Number(playerProfile?.higherLowerHighScore) || 0 },
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
  "Floette Fleur Éternelle": "floette-eternal",
  "Amphinobi Ash": "greninja-ash",
  "Wimessir Femelle": "indeedee-female",
  "Mistigrix Femelle": "meowstic-female",
  "Morphéo Soleil": "castform-sunny",
  "Morphéo Pluie": "castform-rainy",
  "Morphéo Neige": "castform-snowy",
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

// Lot B audit : cache partagé (promesses) des requêtes PokeAPI. Dédoublonne les
// appels identiques entre fonctionnalités (battle stats, Pokédex, Team Builder...)
// et les appels concurrents vers la même URL.
const POKEAPI_FETCH_CACHE = new Map();
function fetchPokeApiJson(url) {
  if (!POKEAPI_FETCH_CACHE.has(url)) {
    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .catch((err) => {
        POKEAPI_FETCH_CACHE.delete(url); // ne pas mémoriser les échecs
        throw err;
      });
    POKEAPI_FETCH_CACHE.set(url, promise);
  }
  return POKEAPI_FETCH_CACHE.get(url);
}

// Lot B audit : applique les données de formes embarquées (forms-data.json,
// servi par notre propre serveur) pour éviter ~170 appels PokeAPI au premier
// chargement. Retourne l'objet (ou {} si indisponible -> fallback PokeAPI).
async function loadBundledExtraFormData() {
  try {
    const response = await fetch("forms-data.json");
    if (!response.ok) return {};
    const data = await response.json();
    return data && typeof data === "object" ? data : {};
  } catch (_err) {
    return {};
  }
}

async function resolveExtraFormSprites() {
  const forms = POKEMON_LIST.filter((p) => p.id >= 20000);
  const cache = loadCachedExtraFormData();
  let dirty = false;

  const bundled = await loadBundledExtraFormData();
  for (const pokemon of forms) {
    const entry = bundled[pokemon.name];
    if (!entry || !entry.sprite) continue;
    pokemon.sprite = entry.sprite;
    if (entry.type1) pokemon.type1 = entry.type1;
    pokemon.type2 = entry.type2 !== undefined ? entry.type2 : pokemon.type2;
    if (typeof entry.height === "number") pokemon.height = entry.height;
    if (typeof entry.weight === "number") pokemon.weight = entry.weight;
    const cachedEntry = cache[pokemon.name];
    if (!cachedEntry || cachedEntry.sprite !== entry.sprite) {
      cache[pokemon.name] = { sprite: entry.sprite, type1: entry.type1, type2: entry.type2, height: entry.height, weight: entry.weight };
      dirty = true;
    }
  }

  await Promise.allSettled(
    forms.map(async (pokemon) => {
      const apiName = pokemon.formApiName || FORM_API_NAME_BY_NAME[pokemon.name];
      if (!apiName) return;
      // Si déjà mis à jour depuis le cache (sprite ≠ base sprite par id), skip
      const cachedEntry = cache[pokemon.name];
      if (cachedEntry?.sprite && pokemon.sprite === cachedEntry.sprite) return;

      try {
        const data = await fetchPokeApiJson(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
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
let pokedexCategoryFilter = "all";
const POKEDEX_LEGENDARY_IDS = new Set([144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,716,717,718,719,720,721,772,773,785,786,787,788,789,790,791,792,793,794,795,796,797,798,799,800,801,802,803,804,805,806,807,808,809,888,889,890,891,892,893,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1009,1010,1014,1015,1016,1017,1020,1021,1022,1023,1024,1025]);
function pokedexMatchesCategory(p) {
  const cat = pokedexCategoryFilter || "all";
  if (cat === "all") return true;
  const id = Number(p && p.id);
  const isAlt = Boolean(p && p.isAltForm) || id >= 20000;
  const name = (p && p.name) || "";
  switch (cat) {
    case "legendary": return POKEDEX_LEGENDARY_IDS.has(id) || (isAlt && POKEDEX_LEGENDARY_IDS.has(Number(p.baseId)));
    case "alt": return isAlt;
    case "mega": return / Mega(\s[XY])?$/i.test(name);
    case "regional": return /d['\u2019]Alola|de Galar|de Hisui|de Paldea/i.test(name);
    case "mono": return !(p && p.type2);
    case "dual": return Boolean(p && p.type2);
    case "base": return Number(p && p.stage) === 1;
    case "evolved": return Number(p && p.stage) >= 2;
    default: return true;
  }
}
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
const TEAM_BUILDER_TERA_TYPES = ["Normal", "Feu", "Eau", "Plante", "Électrik", "Glace", "Combat", "Poison", "Sol", "Vol", "Psy", "Insecte", "Roche", "Spectre", "Dragon", "Ténèbres", "Acier", "Fée"];

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
    // Modes à écran dédié (résolus via notifyPartyRoundFromScreenMode à la fin de leur run).
    { key: "higherlower", label: "Higher or Lower", launch: openHigherLowerMode, canLaunch: () => true },
    { key: "connections", label: "Poké-Connections", launch: openPokeConnectionsMode, canLaunch: () => true },
    { key: "speedrun", label: "Speedrun Pokédex", launch: openSpeedrunMode, canLaunch: () => true },
  ].filter((mode) => mode.canLaunch());
}

const PARTY_SCREEN_MODE_KEYS = new Set(["higherlower", "connections", "speedrun"]);
// Ces écrans (HL/Connections/Speedrun) appellent goToConfig() dans leur init,
// ce qui détruirait la session Party : ce flag la protège pendant le lancement.
let partyLaunchInProgress = false;

// Fin de round Party pour les modes à écran dédié : marque le round, annonce le
// résultat, puis enchaîne automatiquement (ou clôt la session).
function notifyPartyRoundFromScreenMode(didWin, summary) {
  if (!isPartySessionActive() || partySession.roundResolved) return;
  const round = partySession.currentRound;
  const max = partySession.maxRounds;
  finishPartyRound(didWin);
  showToast(`Round ${round}/${max} ${didWin ? "gagné" : "perdu"} — ${summary}`);
  if (partySession.completed) {
    setTimeout(() => {
      showToast(`Party terminée : ${partySession.wins} victoire${partySession.wins > 1 ? "s" : ""} sur ${max} !`);
      goToConfig();
    }, 2000);
  } else {
    setTimeout(() => advancePartyRound(), 2000);
  }
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
      stage.innerHTML = `<div class="party-summary"><b>Résultats de la session</b><span>Score total : ${partySession.score}</span><span>Rounds joués : ${roundsPlayed} / ${partySession.maxRounds}</span><span>Victoires : ${partySession.wins}</span><span>Défaites : ${partySession.losses}</span><span>Précision : ${accuracy}%</span></div>`;
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
  partyLaunchInProgress = true;
  try {
    mode.launch();
  } finally {
    partyLaunchInProgress = false;
  }
  renderPartySessionUI();
  // Les modes à écran dédié n'affichent pas le bandeau Party : on annonce le round.
  if (PARTY_SCREEN_MODE_KEYS.has(mode.key) && isPartySessionActive()) {
    showToast(`Round ${partySession.currentRound}/${partySession.maxRounds} : ${mode.label}`);
  }
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
// --- Fréquentation anonyme (compteurs maison, lecture sur /admin/stats) ---
function getUsageUid() {
  try {
    let uid = localStorage.getItem("pokedle_uid_v1");
    if (!uid) {
      uid = window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("pokedle_uid_v1", uid);
    }
    return uid;
  } catch (_e) { return ""; }
}
function trackUsage(event) {
  try {
    // En session Party, les mini-jeux sont des manches, pas des lancements solo.
    if (event.startsWith("solo:") && typeof isPartySessionActive === "function" && isPartySessionActive()) return;
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, uid: getUsageUid() }), keepalive: true }).catch(() => {});
  } catch (_e) {}
}
window.trackUsage = trackUsage;

window.addEventListener("DOMContentLoaded", () => {
  try {
    if (!sessionStorage.getItem("pokedle_visit_v1")) {
      sessionStorage.setItem("pokedle_visit_v1", "1");
      trackUsage("visit");
    }
  } catch (_e) {}
  buildGenGrid();
  loadStats();
  loadRankingChoices();
  loadGamesRanking();
  renderRankingGrid();
  renderGamesRankingTable();
  renderStats();
  initPokedex();
  initTypeChartScreen();
  renderDailyHero();
  initHomeTypeHelper();
  initHomeDefenseTypeHelper();
  initHomeTeamSuggestionHelper();
  initTeamBuilderModule();
  initTeamsModule();
  initEmulatorMode();
  resolveExtraFormSprites();

  if (checkChallengeURL()) return;
  if (checkMultiplayerInviteURL()) return;
  // Sur /emulateur, l'écran émulateur est ouvert par l'init dédié — ne pas
  // rappeler goToConfig() ici (il re-routerait vers /).
  if (window.location.pathname === "/emulateur") { removeAppSplash(); return; }
  goToConfig();
  removeAppSplash();
});

// Distribution des essais du Pokémon du jour (stats anonymes, en mémoire serveur).
const DAILY_REPORT_STORAGE_KEY = "pokedle_daily_reported_v1";

async function reportAndRenderDailyDistribution(attemptCount) {
  const box = document.getElementById("win-daily-distribution");
  if (!box) return;
  const todayKey = getUTCDateKey();
  try {
    let reported = null;
    try { reported = localStorage.getItem(DAILY_REPORT_STORAGE_KEY); } catch (_e) { /* noop */ }
    if (reported !== todayKey) {
      await fetch("/api/daily-stats/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: todayKey, attempts: attemptCount }),
      });
      try { localStorage.setItem(DAILY_REPORT_STORAGE_KEY, todayKey); } catch (_e) { /* noop */ }
    }
    const response = await fetch(`/api/daily-stats/today`);
    if (!response.ok) throw new Error("stats indisponibles");
    const stats = await response.json();
    renderDailyDistribution(box, stats, attemptCount);
  } catch (_err) {
    box.classList.add("hidden");
  }
}

function renderDailyDistribution(box, stats, playerAttempts) {
  const counts = stats?.counts || {};
  const buckets = ["1", "2", "3", "4", "5", "6", "7plus"];
  const total = buckets.reduce((acc, b) => acc + (Number(counts[b]) || 0), 0);
  if (!total) { box.classList.add("hidden"); return; }
  const max = Math.max(...buckets.map((b) => Number(counts[b]) || 0), 1);
  const playerBucket = playerAttempts >= 7 ? "7plus" : String(playerAttempts);
  const rows = buckets.map((bucket) => {
    const value = Number(counts[bucket]) || 0;
    const width = Math.max(4, Math.round((value / max) * 100));
    const me = bucket === playerBucket ? " is-me" : "";
    const label = bucket === "7plus" ? "7+" : bucket;
    return `<div class="ddist-row${me}"><span class="ddist-label">${label}</span><div class="ddist-bar-wrap"><div class="ddist-bar" style="width:${width}%"></div></div><span class="ddist-value">${value}</span></div>`;
  }).join("");
  box.innerHTML = `<p class="ddist-title">📊 ${total} dresseur${total > 1 ? "s" : ""} aujourd'hui — répartition des essais</p>${rows}`;
  box.classList.remove("hidden");
}

// DA 2026 : splash de chargement (perçu pendant le parse JS / les données).
function removeAppSplash() {
  const splash = document.getElementById("app-splash");
  if (!splash) return;
  splash.classList.add("app-splash-done");
  setTimeout(() => splash.remove(), 420);
}

