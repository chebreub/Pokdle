// Two devices, one account: when both made progress since the last sync, their copies are
// merged instead of the last one sent wiping the other. `primary` is the copy whose choices
// win (avatar, partner, team…); `base` is the copy both started from, when known, so counters
// add up (300 XP on the phone + 7 on the PC = 307), otherwise the higher value is kept.
const PROFILE_MERGE_KEYS = ["profile", "stats", "achievements", "teamBuilder"];

function profileMergeParse(raw) {
  if (typeof raw !== "string") return null;
  try { const value = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value : null; } catch (_e) { return null; }
}
function profileMergeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
// A counter both devices raised: what each added since the common copy, or the higher one.
function profileMergeCounter(p, o, b) {
  const a = profileMergeNumber(p), c = profileMergeNumber(o);
  if (b === undefined || b === null || !Number.isFinite(Number(b))) return Math.max(a, c);
  return Math.max(a, c, a + c - Number(b));
}
// Records and tallies: the higher number wins, objects are merged key by key.
function profileMergeMax(p, o) {
  if (typeof p === "number" || typeof o === "number") return Math.max(profileMergeNumber(p), profileMergeNumber(o));
  if (p && o && typeof p === "object" && typeof o === "object" && !Array.isArray(p) && !Array.isArray(o)) {
    const out = { ...o, ...p };
    for (const key of Object.keys(o)) if (key in p) out[key] = profileMergeMax(p[key], o[key]);
    return out;
  }
  return p !== undefined && p !== null ? p : o;
}
// Collections (Pokédex, missions, secrets…): everything found on either device.
function profileMergeUnion(p, o) {
  if (Array.isArray(p) || Array.isArray(o)) {
    const seen = new Set(), out = [];
    for (const item of [...(Array.isArray(p) ? p : []), ...(Array.isArray(o) ? o : [])]) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) { seen.add(key); out.push(item); }
    }
    return out;
  }
  if (p && typeof p === "object" || o && typeof o === "object") return { ...(o || {}), ...(p || {}) };
  return p !== undefined && p !== null ? p : o;
}
const PROFILE_UNION_FIELDS = ["discoveries", "albumMissionClaims", "regionXpClaims", "secrets", "weeklyLeagueBadges"];
const PROFILE_MAX_FIELDS = ["dailyLoginStreak", "xpLevels", "draftScoreAttackRecords", "weeklyLeagueScores", "weeklyLeagueStats", "albumMissionStats"];

function mergeProfileData(p, o, b) {
  const out = { ...o, ...p };
  const base = b || {};
  out.xp = profileMergeCounter(p.xp, o.xp, b ? base.xp : null);
  out.totalQuestsCompleted = profileMergeCounter(p.totalQuestsCompleted, o.totalQuestsCompleted, b ? base.totalQuestsCompleted : null);
  for (const key of Object.keys(out)) {
    if (/HighScore$/.test(key) || (key.endsWith("Best") && key !== "quiEstCeBest")) out[key] = Math.max(profileMergeNumber(p[key]), profileMergeNumber(o[key]));
  }
  // Qui est-ce ? keeps the fewest questions (0 = no record yet).
  const qa = profileMergeNumber(p.quiEstCeBest), qb = profileMergeNumber(o.quiEstCeBest);
  if (qa || qb) out.quiEstCeBest = qa && qb ? Math.min(qa, qb) : qa || qb;
  for (const key of PROFILE_UNION_FIELDS) if (key in p || key in o) out[key] = profileMergeUnion(p[key], o[key]);
  for (const key of PROFILE_MAX_FIELDS) if (key in p || key in o) out[key] = profileMergeMax(p[key], o[key]);
  if (p.pioneerMyth || o.pioneerMyth) out.pioneerMyth = true;
  if (String(o.lastDailyLogin || "") > String(p.lastDailyLogin || "")) out.lastDailyLogin = o.lastDailyLogin;
  // The day's XP per game and the day's quests: the same day merges, otherwise the later day wins.
  const dayA = p.xpGameDay, dayB = o.xpGameDay;
  if (dayA && dayB && dayA.date === dayB.date) out.xpGameDay = { date: dayA.date, games: profileMergeMax(dayA.games || {}, dayB.games || {}) };
  else if (dayB && (!dayA || String(dayB.date || "") > String(dayA.date || ""))) out.xpGameDay = dayB;
  if (p.dailyQuestsDate === o.dailyQuestsDate && Array.isArray(p.dailyQuests) && Array.isArray(o.dailyQuests)) {
    out.dailyQuests = p.dailyQuests.map((quest) => {
      const other = o.dailyQuests.find((q) => q && quest && q.id === quest.id);
      return other ? { ...quest, progress: Math.max(profileMergeNumber(quest.progress), profileMergeNumber(other.progress)), completed: Boolean(quest.completed || other.completed) } : quest;
    });
  } else if (String(o.dailyQuestsDate || "") > String(p.dailyQuestsDate || "")) {
    out.dailyQuests = o.dailyQuests;
    out.dailyQuestsDate = o.dailyQuestsDate;
  }
  return out;
}

function mergeStatsData(p, o, b) {
  const base = b || {};
  const out = { ...o, ...p };
  for (const key of ["played", "wins", "totalAttempts"]) out[key] = profileMergeCounter(p[key], o[key], b ? base[key] : null);
  out.dailyBestStreak = Math.max(profileMergeNumber(p.dailyBestStreak), profileMergeNumber(o.dailyBestStreak));
  // The current daily streak belongs to the copy that won the most recent day.
  if (String(o.lastDailyWinKey || "") > String(p.lastDailyWinKey || "")) {
    out.lastDailyWinKey = o.lastDailyWinKey;
    out.dailyCurrentStreak = o.dailyCurrentStreak;
  }
  if (String(o.lastDailyStartedKey || "") > String(p.lastDailyStartedKey || "")) out.lastDailyStartedKey = o.lastDailyStartedKey;
  return out;
}

// Achievements: every one unlocked on either device, with its first unlock date.
function mergeAchievementsData(p, o) {
  const out = { ...o, ...p };
  for (const key of Object.keys(o)) {
    if (!(key in p)) continue;
    const a = profileMergeNumber(p[key]?.unlockedAt), c = profileMergeNumber(o[key]?.unlockedAt);
    if (a && c) out[key] = { ...p[key], unlockedAt: Math.min(a, c) };
  }
  return out;
}

function mergeSyncBlobs(primary, other, base = null) {
  const out = { ...(other || {}), ...(primary || {}) };
  for (const key of PROFILE_MERGE_KEYS) {
    // A known common copy without this part means it was empty then: counters start from 0.
    const p = profileMergeParse(primary?.[key]), o = profileMergeParse(other?.[key]), b = base ? profileMergeParse(base[key]) || {} : null;
    if (!p && !o) continue;
    if (!p) { out[key] = other[key]; continue; }
    if (!o || key === "teamBuilder") { out[key] = primary[key]; continue; }
    const merged = key === "profile" ? mergeProfileData(p, o, b)
      : key === "stats" ? mergeStatsData(p, o, b)
        : key === "achievements" ? mergeAchievementsData(p, o)
          : p;
    out[key] = JSON.stringify(merged);
  }
  return out;
}
