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
// What a counter can hold at most today (31/10/2026). A copy above it is broken: until then a stale
// common copy let each reload count the shared progress twice, and XP doubled up to billions.
// XP: nobody could pass level 100 (247 500 XP) before 10/11/2026 (XP opened on 25/10, about 22 000 XP
// a day at most); after that the ceiling grows by 30 000 a day so a real player never reaches it.
const PROFILE_COUNTER_CEILINGS = { xp: 247500, totalQuestsCompleted: 2000, played: 20000, wins: 20000, totalAttempts: 200000 };
function profileCounterCeiling(field, now = Date.now()) {
  const base = PROFILE_COUNTER_CEILINGS[field];
  if (field !== "xp" || !base) return base || Infinity;
  const days = Math.max(0, Math.floor((now - Date.parse("2026-11-10T00:00:00Z")) / 86400000));
  return base + days * 30000;
}
// What one device can add since the last common copy, at most.
const PROFILE_MERGE_GAIN_MAX = { xp: 50000, totalQuestsCompleted: 200, played: 2000, wins: 2000, totalAttempts: 20000 };
// A counter both devices raised: what each added since the common copy, or the higher one.
// A broken copy never spreads, and a common copy newer than one side is not common: higher one.
function profileMergeCounter(p, o, b, field) {
  const ceiling = profileCounterCeiling(field), gainMax = PROFILE_MERGE_GAIN_MAX[field] || Infinity;
  let a = profileMergeNumber(p), c = profileMergeNumber(o);
  // Two broken copies: keep one, the repair on load brings it back to a sound value. Making it 0
  // (the first version of this fix) sent Kayan back to level 1.
  if (a > ceiling && c > ceiling) return Math.max(a, c);
  if (a > ceiling) a = 0;
  if (c > ceiling) c = 0;
  if (b === undefined || b === null || !Number.isFinite(Number(b))) return Math.max(a, c);
  const base = Number(b);
  if (base > ceiling || base > Math.min(a, c)) return Math.max(a, c);
  return Math.max(a, c, Math.min(a + c - base, Math.max(a, c) + gainMax, ceiling));
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
  // A level put back by the admin (« Niveau d'un joueur », 31/10/2026, lib/player-level-admin.js) wins
  // over a copy made before it: that copy's XP is the one it replaced, adding it would count it twice.
  // A common copy from before it is not common either.
  const setP = profileMergeNumber(p.xpSetAt), setO = profileMergeNumber(o.xpSetAt);
  if (setP !== setO) {
    out.xp = profileMergeNumber((setP > setO ? p : o).xp);
    out.xpSetAt = Math.max(setP, setO);
  } else {
    out.xp = profileMergeCounter(p.xp, o.xp, b && profileMergeNumber(base.xpSetAt) === setP ? base.xp : null, "xp");
  }
  out.totalQuestsCompleted = profileMergeCounter(p.totalQuestsCompleted, o.totalQuestsCompleted, b ? base.totalQuestsCompleted : null, "totalQuestsCompleted");
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
  for (const key of ["played", "wins", "totalAttempts"]) out[key] = profileMergeCounter(p[key], o[key], b ? base[key] : null, key);
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

// Repair (31/10/2026): a counter that ran away is set back to the highest sound value this browser
// still keeps (restore points, older synced copies), else to a safe default. Runs once per load.
function profileSoundValues(field, part) { return profileCounterCopies(field, part).sound; }
// Every copy of a counter this browser keeps: the sound values, and whether a broken one was seen.
function profileCounterCopies(field, part) {
  const ceiling = profileCounterCeiling(field), found = [];
  let broken = false;
  const visit = (value, depth) => {
    if (depth > 4 || value == null) return;
    if (typeof value === "string") {
      if (value.length > 2 && (value[0] === "{" || value[0] === "[")) { try { visit(JSON.parse(value), depth + 1); } catch (_e) {} }
      return;
    }
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    if (typeof value !== "object") return;
    if (part in value) {
      const inner = typeof value[part] === "string" ? (() => { try { return JSON.parse(value[part]); } catch (_e) { return null; } })() : value[part];
      const n = Number(inner && inner[field]);
      if (Number.isFinite(n) && n > 0 && n <= ceiling) found.push(n);
      if (Number.isFinite(n) && n > ceiling) broken = true;
    }
    Object.keys(value).forEach((key) => { if (key !== part) visit(value[key], depth + 1); });
  };
  try { for (let i = 0; i < localStorage.length; i += 1) visit(localStorage.getItem(localStorage.key(i)), 0); } catch (_e) {}
  return { sound: found, broken };
}
// XP lost to that first fix: when this browser still keeps a broken copy (the runaway happened here)
// and a sound copy well above today's XP, the sound one comes back. Done once per browser.
function recoverLostXp(target) {
  if (!target) return false;
  try { if (localStorage.getItem("pokedle.xpRecovered.v1")) return false; } catch (_e) { return false; }
  const copies = profileCounterCopies("xp", "profile");
  if (!copies.broken) return false;
  const best = copies.sound.length ? Math.max(...copies.sound) : 0;
  try { localStorage.setItem("pokedle.xpRecovered.v1", String(Date.now())); } catch (_e) {}
  if (best <= (Number(target.xp) || 0) + 1000) return false;
  target.xp = best;
  return true;
}
function repairRunawayCounters(target, part, fallback) {
  if (!target) return false;
  let repaired = false;
  for (const field of Object.keys(PROFILE_COUNTER_CEILINGS)) {
    if (!(field in target) || !(Number(target[field]) > profileCounterCeiling(field))) continue;
    const sound = profileSoundValues(field, part);
    target[field] = sound.length ? Math.max(...sound) : (fallback[field] || 0);
    repaired = true;
  }
  return repaired;
}
if (typeof loadProfile === "function") {
  const loadProfileBeforeRepair = loadProfile;
  loadProfile = function () {
    const value = loadProfileBeforeRepair.apply(this, arguments);
    // No sound copy left: level 100 without stars rather than billions or nothing.
    const repaired = repairRunawayCounters(playerProfile, "profile", { xp: typeof xpForLevel === "function" ? xpForLevel(100) : 247500 });
    if (recoverLostXp(playerProfile) || repaired) { try { saveProfile(); } catch (_e) {} }
    return value;
  };
}
if (typeof loadStats === "function") {
  const loadStatsBeforeRepair = loadStats;
  loadStats = function () {
    const value = loadStatsBeforeRepair.apply(this, arguments);
    if (repairRunawayCounters(playerStats, "stats", {})) { try { saveStats(); } catch (_e) {} }
    return value;
  };
}

// The same repair on the saved copies right away, before any sync can merge them (the sync may run
// before the page loads the profile).
(function repairStoredCopiesNow() {
  if (typeof STORAGE_KEYS === "undefined" || typeof localStorage === "undefined") return;
  for (const [key, part, fallback] of [[STORAGE_KEYS.profile, "profile", { xp: 247500 }], [STORAGE_KEYS.stats, "stats", {}]]) {
    try {
      const raw = localStorage.getItem(key);
      const value = raw ? JSON.parse(raw) : null;
      if (!value || typeof value !== "object") continue;
      const repaired = repairRunawayCounters(value, part, fallback);
      const recovered = part === "profile" && recoverLostXp(value);
      if (repaired || recovered) localStorage.setItem(key, JSON.stringify(value));
    } catch (_e) {}
  }
})();
