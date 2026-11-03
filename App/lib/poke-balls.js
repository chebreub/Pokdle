"use strict";
// Les Balls (PR A de la boucle « jouer → gagner des Balls → attraper », validée le 3/11/2026).
// Le serveur décide de tout : une Ball par source et par jour (jour de Paris), 10 par jour au
// plus. Les jeux du jour (Pokémon du jour, Wordle, Dossier, Défi, parcours 4/4) sont vérifiés
// dans leurs tables ; les autres modes sont déclarés en fin de partie, comme leurs classements.
// Sans compte, les Balls sont gardées sous l'identité invitée et passent sur le compte à la connexion.
const crypto = require("node:crypto");
const { dailyCalendar, dailyGuest, issueDailyGuest } = require("./daily-game");
const { HISTORY_TO_LAUNCH } = require("./usage-metrics");

const DAILY_CAP = 10;
// Bonus hors plafond (3/11/2026) : la série de jours (Hyper Ball tous les 7 jours joués d'affilée)
// et les 5 Balls offertes une fois par compte.
const STREAK_EVERY = 7;
const WELCOME_BALLS = Object.freeze(["poke", "poke", "poke", "poke", "great"]);
// Hors du plafond de 10 par jour : série, Balls de bienvenue, coffres d'Expédition, et les Balls de test de l'admin.
const BONUS_SQL = "(source='streak' OR source LIKE 'welcome:%' OR source LIKE 'exp:%' OR source LIKE 'admin:%')";

// ===== L'Expédition de la semaine (PR 2 du plan, 3/11/2026) =====
// Une région par semaine (lundi → dimanche, Paris). 1 participation = un jour où le joueur a gagné des Balls
// dans 2 jeux différents. Objectif commun = 1,5 × les joueurs actifs de la semaine d'avant, 7 au moins.
// Coffres à 25 / 50 / 75 % (perdus s'ils ne sont pas ouverts avant dimanche minuit), et à 100 % une rencontre
// avec le légendaire de la région (compte et 2 participations au moins ; vrai taux de capture, rien de garanti).
// Seulement des légendaires qui ne sont pas des récompenses de missions d'album (sinon la capture ne remplirait pas l'album).
const EXPEDITIONS = Object.freeze([
  { region: "Hoenn", gen: 3, legend: 380 }, { region: "Sinnoh", gen: 4, legend: 485 }, { region: "Unys", gen: 5, legend: 639 },
  { region: "Alola", gen: 7, legend: 785 }, { region: "Galar", gen: 8, legend: 894 }, { region: "Paldea", gen: 9, legend: 1001 }
]);
const EXP_CHESTS = Object.freeze({ 25: ["poke", "poke"], 50: ["great", "poke"], 75: ["great", "great"] });
const EXP_MIN_GOAL = 7;
const PLAY_SOURCES_SQL = "(source LIKE 'mode:%' OR source IN ('daily','wordle','dossier','challenge'))";
function shiftDay(day, n) { const t = new Date(day + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function weekStart(day) { const t = new Date(day + "T12:00:00Z"); return shiftDay(day, -((t.getUTCDay() + 6) % 7)); }
function expeditionOf(monday) { const n = Math.round(Date.parse(monday + "T12:00:00Z") / (7 * 86400000)); return EXPEDITIONS[((n % EXPEDITIONS.length) + EXPEDITIONS.length) % EXPEDITIONS.length]; }
const BALLS = Object.freeze(["poke", "great", "ultra"]);

// ===== Les hautes herbes : 3 lancers par rencontre, shiny à 1 sur 150. =====
// Rencontres (3/11 au soir, à sa demande) : 4 de plus toutes les 4 h, heure de Paris (0 h, 4 h, 8 h, 12 h, 16 h, 20 h),
// celles qu'on n'a pas utilisées restent jusqu'à minuit : 24 par jour au plus. Les Balls (10 par jour) restent le vrai frein.
const ENCOUNTERS_PER_BATCH = 4;
const BATCH_HOURS = 4;
const ENCOUNTERS_PER_DAY = ENCOUNTERS_PER_BATCH * (24 / BATCH_HOURS);
function parisHourOf(date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(date));
}
// La prochaine vague : l'heure ronde à Paris, comptée depuis minuit du lendemain (resetAt).
function nextBatchAt(resetAt, hour) { return new Date(Date.parse(resetAt) - (24 - hour) * 3600000).toISOString(); }
const MAX_THROWS = 3;
const SHINY_ODDS = 150;
// Taux de capture officiels (capture-rates.json, fait par tools/capture-rates.js depuis PokéAPI).
const CAPTURE = require("../capture-rates.json");
const BALL_BONUS = Object.freeze({ poke: 1, great: 1.4, ultra: 2 });
// Formule simplifiée validée le 2/11 : 255 → Poké 80 %, 45 → Poké 23 %, Super 32 %, Hyper 46 % ; 95 % au plus.
function captureChance(pokemonId, ball) {
  const rate = Number(CAPTURE.rates[pokemonId]);
  if (!rate || !BALL_BONUS[ball]) return 0;
  return Math.min(0.95, 0.8 * Math.pow(rate / 255, 0.72) * BALL_BONUS[ball]);
}
// Les Pokémon des 108 missions d'album restent des récompenses : jamais dans les hautes herbes, ni les légendaires et fabuleux.
function missionPokemonIds(source = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "script.10b.album-missions.js"), "utf8")) {
  return [...source.matchAll(/albumMission\('[^']+',\s*(\d+)/g)].map((m) => Number(m[1]));
}
// Les « Légendes » du site (Pokédex, Grille du jour : Ultra-Chimères et Paradoxes légendaires compris) en plus de PokéAPI.
function siteLegendIds() {
  const { ULTRA_BEASTS, PARADOX_LEGENDS } = require("./seo-guides");
  return [...require("./daily-grid").LEGENDARY_IDS, ...Object.values(ULTRA_BEASTS || {}).flat(), ...(PARADOX_LEGENDS || [])].map(Number);
}
const WILD_POOL = Object.freeze((() => {
  const out = new Set([...CAPTURE.legendary, ...CAPTURE.mythical, ...siteLegendIds(), ...missionPokemonIds()]);
  return Array.from({ length: 1025 }, (_, i) => i + 1).filter((id) => !out.has(id));
})());
// 🗺️ Zones des hautes herbes (3/11/2026) : 6 décors de 3 types chacun ; « Au hasard » garde tout le pool.
const ZONES = Object.freeze({
  foret: ["Plante", "Insecte", "Poison"],
  mer: ["Eau", "Glace", "Vol"],
  montagne: ["Roche", "Sol", "Acier"],
  volcan: ["Feu", "Dragon", "Combat"],
  tour: ["Spectre", "Ténèbres", "Psy"],
  prairie: ["Normal", "Électrik", "Fée"]
});
const ZONE_POOLS = Object.freeze((() => {
  const fs = require("fs"), path = require("path");
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "pokemon.js"), "utf8").match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
  const types = new Map(list.filter((p) => p.id <= 1025).map((p) => [Number(p.id), [p.type1, p.type2].filter(Boolean)]));
  return Object.fromEntries(Object.entries(ZONES).map(([key, zone]) => [key, Object.freeze(WILD_POOL.filter((id) => (types.get(id) || []).some((t) => zone.includes(t))))]));
})());
const RELEASES_PER_DAY = 10;
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });

// Super Ball (« l'or ») pour une belle partie ; sinon une Poké Ball. Score = celui du classement
// du mode quand il en a un, sinon le nombre d'essais.
const GUESS = (most) => ({ result, score }) => result === "win" && score >= 1 && score <= most;
const AT_LEAST = (least) => ({ score }) => score >= least;
const GOLD = Object.freeze({
  normal: GUESS(6), mystery: GUESS(6),
  silhouette: GUESS(3), pixel: GUESS(3), cry: GUESS(3), description: GUESS(3), evolution: GUESS(3), order: GUESS(3),
  quiestce: GUESS(8),
  quiz: AT_LEAST(12), speedrun: AT_LEAST(25), "higher-lower": AT_LEAST(15), "higher-lower-rush": AT_LEAST(25),
  odd: AT_LEAST(10), weight: AT_LEAST(10), petitbac: AT_LEAST(6), shiny: AT_LEAST(20),
  "poke-connections": ({ result, score }) => result === "win" && score >= 4
});
// Les jeux du jour passent par leur propre vérification, pas par une déclaration du navigateur.
const ARCADE = Object.freeze(Object.keys(HISTORY_TO_LAUNCH).filter((mode) => !["daily", "challenge"].includes(mode)));

function arcadeGain(mode, result, score) {
  mode = String(mode || "");
  if (!ARCADE.includes(mode)) throw fail("unknown_mode", 400);
  if (!["win", "loss"].includes(result)) throw fail("invalid_result", 400);
  const n = Number(score);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw fail("invalid_score", 400);
  const gold = GOLD[mode];
  return { source: "mode:" + HISTORY_TO_LAUNCH[mode], ball: gold && gold({ result, score: n }) ? "great" : "poke" };
}

async function initBallsDb(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS ball_gains(
    identity TEXT NOT NULL, day DATE NOT NULL, source TEXT NOT NULL, ball TEXT NOT NULL,
    account_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(identity,day,source))`);
  await db.query("CREATE INDEX IF NOT EXISTS ball_gains_identity ON ball_gains(identity)");
  // Une rencontre : le Pokémon tiré, les Balls lancées (une colonne par sorte) et la fin.
  await db.query(`CREATE TABLE IF NOT EXISTS wild_encounters(
    id BIGSERIAL PRIMARY KEY, identity TEXT NOT NULL, account_id TEXT, day DATE NOT NULL,
    pokemon_id INT NOT NULL, shiny BOOLEAN NOT NULL DEFAULT false, throws INT NOT NULL DEFAULT 0,
    used_poke INT NOT NULL DEFAULT 0, used_great INT NOT NULL DEFAULT 0, used_ultra INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open', ball TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ended_at TIMESTAMPTZ)`);
  await db.query("CREATE INDEX IF NOT EXISTS wild_encounters_identity ON wild_encounters(identity,day)");
  // « legend » : la rencontre de l'Expédition, hors des 6 rencontres du jour.
  await db.query("ALTER TABLE wild_encounters ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'wild'");
  await db.query("ALTER TABLE wild_encounters ADD COLUMN IF NOT EXISTS zone TEXT");
  await db.query("ALTER TABLE wild_encounters ADD COLUMN IF NOT EXISTS released_on DATE");
  await db.query("CREATE INDEX IF NOT EXISTS ball_gains_day ON ball_gains(day)");
}

function createBallService({ db, clock = () => new Date(), randomInt = crypto.randomInt, random = () => crypto.randomInt(1000000) / 1000000 }) {
  const lock = (c, key) => c.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["balls:" + key]);
  async function tx(fn) {
    const c = await db.connect();
    try { await c.query("BEGIN"); const out = await fn(c); await c.query("COMMIT"); return out; }
    catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
    finally { c.release(); }
  }
  // Les Balls gagnées sans compte rejoignent le compte ; une source déjà gagnée sur le compte ce jour-là n'est pas doublée.
  async function adopt(c, who) {
    if (!who.accountId || who.guestKey === who.key) return;
    await lock(c, who.guestKey);
    await c.query(`INSERT INTO ball_gains(identity,day,source,ball,account_id,created_at)
      SELECT $2,day,source,ball,$3,created_at FROM ball_gains WHERE identity=$1 ON CONFLICT DO NOTHING`, [who.guestKey, who.key, who.accountId]);
    await c.query("DELETE FROM ball_gains WHERE identity=$1", [who.guestKey]);
    await c.query("UPDATE wild_encounters SET identity=$2,account_id=$3 WHERE identity=$1", [who.guestKey, who.key, who.accountId]);
  }
  async function grant(c, who, day, gains) {
    const added = [];
    for (const g of gains) {
      const count = Number((await c.query(`SELECT COUNT(*)::int AS n FROM ball_gains WHERE identity=$1 AND day=$2 AND NOT ${BONUS_SQL}`, [who.key, day])).rows[0].n);
      if (count >= DAILY_CAP) break;
      const row = (await c.query("INSERT INTO ball_gains(identity,day,source,ball,account_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING source,ball",
        [who.key, day, g.source, g.ball, who.accountId || null])).rows[0];
      if (row) added.push(row);
    }
    return added;
  }
  // Ce que les jeux du jour ont déjà rapporté, lu dans leurs propres tables.
  async function dailyGains(c, who, day) {
    // Un jeu du jour pas encore prêt (table absente) ne bloque pas les autres : point de sauvegarde par lecture.
    const one = async (sql) => {
      await c.query("SAVEPOINT ball_read");
      try { const row = (await c.query(sql, [who.key, day])).rows[0] || null; await c.query("RELEASE SAVEPOINT ball_read"); return row; }
      catch (_e) { await c.query("ROLLBACK TO SAVEPOINT ball_read"); return null; }
    };
    const enquete = await one("SELECT status FROM daily_plays WHERE identity=$1 AND day=$2");
    const wordle = await one("SELECT status FROM wordle_plays WHERE identity=$1 AND day=$2");
    const dossier = await one("SELECT status,points FROM dossier_plays WHERE identity=$1 AND day=$2");
    const challenge = await one("SELECT status,points FROM challenge_plays WHERE identity=$1 AND day=$2");
    const done = (row) => row && !["ready", "playing"].includes(row.status);
    const gains = [];
    if (enquete?.status === "won") gains.push({ source: "daily", ball: "poke" });
    if (wordle?.status === "won") gains.push({ source: "wordle", ball: "poke" });
    if (dossier?.status === "completed") gains.push({ source: "dossier", ball: Number(dossier.points) >= 20 ? "great" : "poke" });
    if (challenge?.status === "completed") gains.push({ source: "challenge", ball: Number(challenge.points) >= 25 ? "great" : "poke" });
    if (done(enquete) && done(wordle) && done(dossier) && ["completed", "abandoned"].includes(challenge?.status)) gains.push({ source: "journey", ball: "great" });
    return gains;
  }
  // La série : les jours d'affilée où le joueur a gagné au moins une Ball en jouant (le cadeau et les bonus ne comptent pas).
  async function streakOf(c, who, day) {
    const days = (await c.query(`SELECT DISTINCT to_char(day,'YYYY-MM-DD') AS d FROM ball_gains WHERE identity=$1 AND source<>'gift' AND NOT ${BONUS_SQL} ORDER BY d DESC LIMIT 400`, [who.key])).rows.map((r) => r.d);
    const prev = (d) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };
    const playedToday = days[0] === day;
    let cursor = playedToday ? day : prev(day), n = 0;
    for (const d of days) { if (d === cursor) { n += 1; cursor = prev(cursor); } else if (d < cursor) break; }
    const inCycle = n % STREAK_EVERY === 0 && n > 0 && playedToday ? STREAK_EVERY : n % STREAK_EVERY;
    return { days: n, playedToday, inCycle, every: STREAK_EVERY, left: STREAK_EVERY - inCycle };
  }
  async function bonuses(c, who, day) {
    const added = [];
    const streak = await streakOf(c, who, day);
    if (streak.playedToday && streak.days > 0 && streak.days % STREAK_EVERY === 0) {
      const row = (await c.query("INSERT INTO ball_gains(identity,day,source,ball,account_id) VALUES($1,$2,'streak','ultra',$3) ON CONFLICT DO NOTHING RETURNING source,ball", [who.key, day, who.accountId || null])).rows[0];
      if (row) added.push(row);
    }
    if (who.accountId && !(await c.query("SELECT 1 FROM ball_gains WHERE identity=$1 AND source LIKE 'welcome:%' LIMIT 1", [who.key])).rows.length) {
      for (const [i, ball] of WELCOME_BALLS.entries()) {
        const row = (await c.query("INSERT INTO ball_gains(identity,day,source,ball,account_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING source,ball", [who.key, day, "welcome:" + (i + 1), ball, who.accountId])).rows[0];
        if (row) added.push(row);
      }
    }
    return added;
  }
  async function state(c, who, day, added = []) {
    const today = (await c.query(`SELECT source,ball FROM ball_gains WHERE identity=$1 AND day=$2 AND NOT ${BONUS_SQL} ORDER BY created_at,source`, [who.key, day])).rows;
    const bonus = (await c.query(`SELECT source,ball FROM ball_gains WHERE identity=$1 AND day=$2 AND ${BONUS_SQL} ORDER BY created_at,source`, [who.key, day])).rows;
    const bag = await bagOf(c, who);
    const cal = dailyCalendar(clock());
    return { ok: true, day, resetAt: cal.resetAt, cap: DAILY_CAP, today: today.length, gains: today, added, bag,
      giftAvailable: today.length < DAILY_CAP && !today.some((g) => g.source === "gift"), authenticated: Boolean(who.accountId),
      bonus, streak: await streakOf(c, who, day), welcomeBalls: WELCOME_BALLS.length,
      wild: await wildState(c, who, day) };
  }
  // Le sac = les Balls gagnées moins les Balls lancées.
  async function bagOf(c, who) {
    const bag = Object.fromEntries(BALLS.map((b) => [b, 0]));
    for (const r of (await c.query("SELECT ball,COUNT(*)::int AS n FROM ball_gains WHERE identity=$1 GROUP BY ball", [who.key])).rows) if (r.ball in bag) bag[r.ball] = Number(r.n);
    const used = (await c.query("SELECT COALESCE(SUM(used_poke),0)::int AS poke,COALESCE(SUM(used_great),0)::int AS great,COALESCE(SUM(used_ultra),0)::int AS ultra FROM wild_encounters WHERE identity=$1", [who.key])).rows[0];
    for (const b of BALLS) bag[b] = Math.max(0, bag[b] - Number(used[b]));
    return bag;
  }
  function encounterView(row) {
    if (!row) return null;
    return { id: Number(row.id), pokemonId: Number(row.pokemon_id), shiny: Boolean(row.shiny), throws: Number(row.throws),
      throwsLeft: Math.max(0, MAX_THROWS - Number(row.throws)), status: row.status, ball: row.ball || null, legend: row.kind === "legend", zone: row.zone || null,
      chances: Object.fromEntries(BALLS.map((b) => [b, Math.round(captureChance(Number(row.pokemon_id), b) * 100)])) };
  }
  async function wildState(c, who, day) {
    // Une rencontre restée ouverte un autre jour : le Pokémon est parti.
    await c.query("UPDATE wild_encounters SET status='fled',ended_at=NOW() WHERE identity=$1 AND status='open' AND day<>$2", [who.key, day]);
    const used = Number((await c.query("SELECT COUNT(*)::int AS n FROM wild_encounters WHERE identity=$1 AND day=$2 AND kind='wild'", [who.key, day])).rows[0].n);
    const open = (await c.query("SELECT * FROM wild_encounters WHERE identity=$1 AND status='open' ORDER BY id DESC LIMIT 1", [who.key])).rows[0];
    const caught = Number((await c.query("SELECT COUNT(DISTINCT pokemon_id)::int AS n FROM wild_encounters WHERE identity=$1 AND status='caught'", [who.key])).rows[0].n);
    const now = clock(), batch = Math.floor(parisHourOf(now) / BATCH_HOURS);
    const available = Math.min(ENCOUNTERS_PER_DAY, (batch + 1) * ENCOUNTERS_PER_BATCH);
    const nextHour = (batch + 1) * BATCH_HOURS;
    const nextAt = nextHour < 24 ? nextBatchAt(dailyCalendar(now).resetAt, nextHour) : dailyCalendar(now).resetAt;
    return { max: ENCOUNTERS_PER_DAY, available, today: used, left: Math.max(0, available - used), nextAt, nextCount: ENCOUNTERS_PER_BATCH, everyHours: BATCH_HOURS, open: encounterView(open), caught };
  }
  // Entrer dans les hautes herbes : la rencontre ouverte, ou une nouvelle si le jour en laisse.
  async function encounter(c, who, day, zone) {
    if (zone && !ZONE_POOLS[zone]) throw fail("invalid_zone", 400);
    const st = await wildState(c, who, day);
    if (st.open) return { encounter: st.open, fresh: false };
    if (st.left <= 0) throw fail("no_encounters_left");
    const bag = await bagOf(c, who);
    if (!BALLS.some((b) => bag[b] > 0)) throw fail("no_balls");
    const pool = zone ? ZONE_POOLS[zone] : WILD_POOL;
    const pokemonId = pool[randomInt(pool.length)];
    const shiny = randomInt(SHINY_ODDS) === 0;
    const row = (await c.query("INSERT INTO wild_encounters(identity,account_id,day,pokemon_id,shiny,zone) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [who.key, who.accountId || null, day, pokemonId, shiny, zone || null])).rows[0];
    return { encounter: encounterView(row), fresh: true };
  }
  // Un lancer : le serveur tire, la Ball tremble 0 à 3 fois ; au 3e lancer raté, le Pokémon s'enfuit.
  async function throwBall(c, who, day, ball) {
    if (!BALLS.includes(ball)) throw fail("invalid_ball", 400);
    const row = (await c.query("SELECT * FROM wild_encounters WHERE identity=$1 AND status='open' AND day=$2 ORDER BY id DESC LIMIT 1 FOR UPDATE", [who.key, day])).rows[0];
    if (!row) throw fail("no_encounter");
    if ((await bagOf(c, who))[ball] <= 0) throw fail("no_ball_left");
    const chance = captureChance(Number(row.pokemon_id), ball);
    const caught = random() < chance;
    const throws = Number(row.throws) + 1;
    const status = caught ? "caught" : throws >= MAX_THROWS ? "fled" : "open";
    const shakes = caught ? 3 : randomInt(3);
    const updated = (await c.query(`UPDATE wild_encounters SET throws=$2,used_${ball}=used_${ball}+1,status=$3,ball=$4,ended_at=CASE WHEN $3='open' THEN NULL ELSE NOW() END WHERE id=$1 RETURNING *`,
      [row.id, throws, status, caught ? ball : null])).rows[0];
    return { result: { caught, fled: status === "fled", shakes, ball }, encounter: encounterView(updated) };
  }
  // L'Expédition : tout est recalculé depuis les Balls gagnées, rien d'autre n'est gardé.
  async function expedition(c, who, day) {
    const monday = weekStart(day), sunday = shiftDay(monday, 6), exp = expeditionOf(monday);
    const parts = `SELECT identity,day FROM ball_gains WHERE day BETWEEN $1 AND $2 AND ${PLAY_SOURCES_SQL} GROUP BY identity,day HAVING COUNT(DISTINCT source)>=2`;
    const all = (await c.query(`SELECT COUNT(*)::int AS n,COUNT(DISTINCT identity)::int AS p FROM (${parts}) x`, [monday, day])).rows[0];
    const prev = Number((await c.query(`SELECT COUNT(DISTINCT identity)::int AS p FROM (${parts}) x`, [shiftDay(monday, -7), shiftDay(monday, -1)])).rows[0].p);
    const goal = Math.max(EXP_MIN_GOAL, Math.ceil(prev * 1.5));
    const mine = (await c.query(`SELECT to_char(day,'YYYY-MM-DD') AS d FROM ball_gains WHERE identity=$3 AND day BETWEEN $1 AND $2 AND ${PLAY_SOURCES_SQL} GROUP BY day HAVING COUNT(DISTINCT source)>=2`, [monday, day, who.key])).rows.map((r) => r.d);
    const claimed = new Set((await c.query("SELECT DISTINCT split_part(source,':',3) AS t FROM ball_gains WHERE identity=$1 AND source LIKE $2", [who.key, "exp:" + monday + ":%"])).rows.map((r) => Number(r.t)));
    const progress = Number(all.n), pct = Math.min(100, Math.floor(progress * 100 / goal));
    const legendRow = (await c.query("SELECT status FROM wild_encounters WHERE identity=$1 AND kind='legend' AND day BETWEEN $2 AND $3 ORDER BY id DESC LIMIT 1", [who.key, monday, sunday])).rows[0];
    const eligible = Boolean(who.accountId) && mine.length >= 2;
    return { week: monday, endsOn: sunday, region: exp.region, gen: exp.gen, legendId: exp.legend,
      legendChances: Object.fromEntries(BALLS.map((b) => [b, Math.round(captureChance(exp.legend, b) * 100)])),
      goal, progress, pct, participants: Number(all.p), myDays: mine, days: Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)),
      chests: Object.keys(EXP_CHESTS).map(Number).map((tier) => ({ tier, balls: EXP_CHESTS[tier], reached: pct >= tier, claimed: claimed.has(tier), canClaim: pct >= tier && !claimed.has(tier) && mine.length >= 1 })),
      legend: { reached: pct >= 100, eligible, needsAccount: !who.accountId, needsDays: Math.max(0, 2 - mine.length), status: legendRow ? legendRow.status : null, available: pct >= 100 && eligible && !legendRow } };
  }
  async function claimChests(c, who, day) {
    const st = await expedition(c, who, day), added = [];
    for (const chest of st.chests.filter((x) => x.canClaim)) {
      for (const [i, ball] of chest.balls.entries()) {
        const row = (await c.query("INSERT INTO ball_gains(identity,day,source,ball,account_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING source,ball",
          [who.key, day, "exp:" + st.week + ":" + chest.tier + ":" + (i + 1), ball, who.accountId || null])).rows[0];
        if (row) added.push(row);
      }
    }
    if (!added.length) throw fail("no_chest");
    return { added };
  }
  async function meetLegend(c, who, day) {
    const st = await expedition(c, who, day);
    if (!st.legend.reached) throw fail("expedition_not_done");
    if (st.legend.needsAccount) throw fail("account_required", 401);
    if (!st.legend.eligible) throw fail("not_enough_days");
    if (st.legend.status) throw fail("legend_already_met");
    if ((await c.query("SELECT 1 FROM wild_encounters WHERE identity=$1 AND status='open' LIMIT 1", [who.key])).rows.length) throw fail("encounter_open");
    if (!Object.values(await bagOf(c, who)).some((n) => n > 0)) throw fail("no_balls");
    const shiny = randomInt(SHINY_ODDS) === 0;
    const row = (await c.query("INSERT INTO wild_encounters(identity,account_id,day,pokemon_id,shiny,kind) VALUES($1,$2,$3,$4,$5,'legend') RETURNING *", [who.key, who.accountId, day, st.legendId, shiny])).rows[0];
    return { encounter: encounterView(row), fresh: true };
  }
  async function skipEncounter(c, who, day) {
    const r = await c.query("UPDATE wild_encounters SET status='skipped',ended_at=NOW() WHERE identity=$1 AND status='open' AND day=$2", [who.key, day]);
    return { skipped: r.rowCount > 0 };
  }
  // Le carnet shiny : chaque shiny croisé dans les hautes herbes, attrapé ou non (le plus récent d'abord).
  async function shinyLog(c, who) {
    return (await c.query(`SELECT pokemon_id,status,to_char(day,'YYYY-MM-DD') AS day FROM wild_encounters
      WHERE identity=$1 AND shiny AND status NOT IN ('open','released','traded') ORDER BY id DESC LIMIT 100`, [who.key])).rows
      .map((r) => ({ id: Number(r.pokemon_id), day: r.day, caught: r.status === "caught" }));
  }
  async function collection(c, who) {
    return (await c.query(`SELECT pokemon_id,COUNT(*) FILTER (WHERE NOT shiny)::int AS normal,COUNT(*) FILTER (WHERE shiny)::int AS shiny
      FROM wild_encounters WHERE identity=$1 AND status='caught' GROUP BY pokemon_id ORDER BY pokemon_id`, [who.key])).rows
      .map((r) => ({ id: Number(r.pokemon_id), normal: Number(r.normal), shiny: Number(r.shiny) }));
  }
  // 🌿 Relâcher un doublon (3/11) : jamais le dernier exemplaire (normal et shiny comptent à part), 10 par jour.
  async function release(c, who, day, body) {
    const id = Number(body && body.id), shiny = Boolean(body && body.shiny);
    if (!Number.isInteger(id) || id < 1 || id > 1025) throw fail("invalid_pokemon", 400);
    await lock(c, who.key);
    const today = Number((await c.query("SELECT COUNT(*)::int AS n FROM wild_encounters WHERE identity=$1 AND status='released' AND released_on=$2", [who.key, day])).rows[0].n);
    if (today >= RELEASES_PER_DAY) throw fail("release_limit", 429);
    const rows = (await c.query("SELECT id FROM wild_encounters WHERE identity=$1 AND status='caught' AND pokemon_id=$2 AND shiny=$3 ORDER BY id DESC", [who.key, id, shiny])).rows;
    if (rows.length < 2) throw fail("last_one");
    await c.query("UPDATE wild_encounters SET status='released',released_on=$2 WHERE id=$1", [rows[0].id, day]);
    return { released: { id, shiny }, captures: await collection(c, who) };
  }
  // Chaque appel commence par récupérer les Balls dues par les jeux du jour : rien ne se perd si une requête a échoué.
  const run = (who, extra) => tx(async (c) => {
    const day = dailyCalendar(clock()).day;
    await adopt(c, who);
    await lock(c, who.key);
    const extraGains = extra ? await extra(c, day) : [];
    const added = await grant(c, who, day, [...extraGains, ...await dailyGains(c, who, day)]);
    added.push(...await bonuses(c, who, day));
    return state(c, who, day, added);
  });
  // Une action des hautes herbes, puis le sac et l'état à jour.
  const wild = (who, action) => tx(async (c) => {
    const day = dailyCalendar(clock()).day;
    await adopt(c, who);
    await lock(c, who.key);
    const out = await action(c, day);
    return { ...await state(c, who, day), ...out };
  });
  return {
    state: (who) => run(who),
    gift: (who) => run(who, async () => [{ source: "gift", ball: "poke" }]),
    earn: (who, body) => run(who, async () => [arcadeGain(body.mode, body.result, body.score)]),
    encounter: (who, body) => wild(who, (c, day) => encounter(c, who, day, body && body.zone ? String(body.zone) : null)),
    throwBall: (who, body) => wild(who, (c, day) => throwBall(c, who, day, String(body && body.ball || ""))),
    skip: (who) => wild(who, (c, day) => skipEncounter(c, who, day)),
    collection: (who) => wild(who, async (c) => ({ captures: await collection(c, who), shinyLog: await shinyLog(c, who), zones: ZONE_POOLS })),
    expedition: (who) => wild(who, async (c, day) => ({ expedition: await expedition(c, who, day) })),
    claimChests: (who) => wild(who, async (c, day) => { const out = await claimChests(c, who, day); return { ...out, expedition: await expedition(c, who, day) }; }),
    meetLegend: (who) => wild(who, (c, day) => meetLegend(c, who, day)),
    release: (who, body) => wild(who, (c, day) => release(c, who, day, body))
  };
}

function mountBallRoutes({ app, express, db, secret, getUser, readCookies, readyBefore = Promise.resolve(), clock }) {
  const service = db && secret ? createBallService({ db, clock }) : null;
  const ready = service ? readyBefore.then(() => initBallsDb(db)).then(() => true).catch((e) => { console.error("[balls] init:", e.message); return false; }) : Promise.resolve(false);
  const buckets = new Map();
  function rate(key, limit, now) {
    if (buckets.size > 10000) for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
    const b = buckets.get(key);
    if (b && b.until > now) { if (++b.count > limit) throw fail("rate_limited", 429); }
    else buckets.set(key, { count: 1, until: now + 60000 });
  }
  const handle = (action) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!service || !await ready) return res.status(503).json({ ok: false, error: "unavailable" });
    try {
      if (req.method === "POST") {
        if (!req.is("application/json")) throw fail("json_required", 415);
        const origin = req.get("origin"); if (origin && new URL(origin).host !== req.get("host")) throw fail("origin_denied", 403);
      }
      let id = dailyGuest(secret, readCookies(req).pokdle_daily);
      if (!id) { const issued = issueDailyGuest(secret); id = issued.id; res.cookie("pokdle_daily", issued.cookie, { httpOnly: true, secure: req.secure, sameSite: "lax", path: "/", maxAge: 180 * 86400000 }); }
      const user = getUser(req), who = { key: user?.id ? "user:" + user.id : "guest:" + id, guestKey: "guest:" + id, accountId: user?.id ? String(user.id) : null };
      const ip = crypto.createHmac("sha256", secret).update("balls-ip:" + String(req.ip)).digest("hex");
      rate("ip:" + ip, 120, Date.now()); rate("id:" + who.key, 40, Date.now());
      res.json(await action(who, req));
    } catch (e) {
      if (!e.status) console.error("[balls] request:", e.message);
      if (e.status === 429) res.set("Retry-After", "60");
      res.status(e.status || 503).json({ ok: false, error: e.status ? e.code : "unavailable" });
    }
  };
  app.get("/api/balls", handle((who) => service.state(who)));
  app.post("/api/balls/gift", express.json({ limit: "1kb" }), handle((who) => service.gift(who)));
  app.post("/api/balls/earn", express.json({ limit: "1kb" }), handle((who, req) => service.earn(who, req.body || {})));
  app.post("/api/wild/encounter", express.json({ limit: "1kb" }), handle((who, req) => service.encounter(who, req.body || {})));
  app.post("/api/wild/throw", express.json({ limit: "1kb" }), handle((who, req) => service.throwBall(who, req.body || {})));
  app.post("/api/wild/skip", express.json({ limit: "1kb" }), handle((who) => service.skip(who)));
  app.get("/api/wild/collection", handle((who) => service.collection(who)));
  app.post("/api/wild/release", express.json({ limit: "1kb" }), handle((who, req) => service.release(who, req.body || {})));
  app.get("/api/expedition", handle((who) => service.expedition(who)));
  app.post("/api/expedition/chests", express.json({ limit: "1kb" }), handle((who) => service.claimChests(who)));
  app.post("/api/expedition/legend", express.json({ limit: "1kb" }), handle((who) => service.meetLegend(who)));
  return service;
}

module.exports = { RELEASES_PER_DAY, ZONES, ZONE_POOLS, ENCOUNTERS_PER_BATCH, BATCH_HOURS, EXPEDITIONS, EXP_CHESTS, weekStart, expeditionOf, STREAK_EVERY, WELCOME_BALLS, siteLegendIds, DAILY_CAP, BALLS, GOLD, ARCADE, ENCOUNTERS_PER_DAY, MAX_THROWS, SHINY_ODDS, WILD_POOL, captureChance, missionPokemonIds, arcadeGain, initBallsDb, createBallService, mountBallRoutes };
