"use strict";
// Return of players (31/10/2026), read from the Pokémon du jour plays the game already keeps — nothing
// new is collected or stored. A play counts once a guess was made or the day was given up. Days are the
// days of Paris (daily_plays.day). Identities are an account, or a browser for guests (a guest who later
// signs in counts as a new identity, so the figures are slightly low, never high).
// DATA-04 (7/11/2026): a guest row merged into an account the same day (excluded_stats) is not a second player.
const PLAYED = "(jsonb_array_length(guessed) > 0 OR status <> 'playing') AND NOT excluded_stats";
const asList = (ids) => (Array.isArray(ids) ? ids : []).map(String).filter(Boolean);

// One query for any « identity, day » activity: J+1 and J+7 counted only on mature days (the day after, or
// the 7 days after, are all inside the window and over). toDay must be a finished day.
async function cohortRates(db, activitySql, fromDay, toDay, exclude) {
  const r = await db.query(`
    WITH act AS (SELECT DISTINCT identity, day FROM (${activitySql}) a WHERE NOT (identity = ANY($3::text[]))),
    p AS (SELECT identity, day FROM act WHERE day BETWEEN $1::date AND $2::date),
    firsts AS (SELECT identity, MIN(day) AS first_day FROM act GROUP BY identity),
    marked AS (
      SELECT a.day, f.first_day = a.day AS is_new,
        EXISTS (SELECT 1 FROM p b WHERE b.identity = a.identity AND b.day = a.day + 1) AS next_day,
        EXISTS (SELECT 1 FROM p b WHERE b.identity = a.identity AND b.day > a.day AND b.day <= a.day + 7) AS week
      FROM p a JOIN firsts f ON f.identity = a.identity)
    SELECT
      COUNT(*) FILTER (WHERE day < $2::date)::int AS base1,
      COUNT(*) FILTER (WHERE day < $2::date AND next_day)::int AS back1,
      COUNT(*) FILTER (WHERE day <= $2::date - 7)::int AS base7,
      COUNT(*) FILTER (WHERE day <= $2::date - 7 AND week)::int AS back7,
      COUNT(*) FILTER (WHERE is_new AND day <= $2::date - 7)::int AS new7,
      COUNT(*) FILTER (WHERE is_new AND day <= $2::date - 7 AND week)::int AS newback7
    FROM marked`, [fromDay, toDay, asList(exclude)]);
  const row = r.rows[0] || {};
  const rate = (back, base) => ({ back: Number(back) || 0, base: Number(base) || 0, rate: Number(base) > 0 ? Math.round(100 * Number(back) / Number(base)) : null });
  return { from: fromDay, to: toDay, nextDay: rate(row.back1, row.base1), week: rate(row.back7, row.base7), newWeek: rate(row.newback7, row.new7) };
}

// Return of players to the Pokémon du jour only.
async function dailyRetention(db, fromDay, toDay, exclude = []) {
  return cohortRates(db, `SELECT identity, day FROM daily_plays WHERE ${PLAYED}`, fromDay, toDay, exclude);
}

// V2-MES-01 (8/11/2026, audit GPT) : « tout le site » ne compte plus que des PARTIES JOUÉES, lues dans ce que
// le serveur garde déjà : un essai, une réponse ou une fin dans un jeu du jour, une Ball gagnée en jouant
// (« mode:… » ou Party Room), une rencontre dans les hautes herbes. Un cadeau, le bonus de bienvenue, un achat,
// un coffre, une série, une Ball de l'admin ou une simple ligne ouverte (« ready ») ne sont pas une partie.
// La mesure d'avant (« toute activité enregistrée ») reste affichée à part, sous son nom : rien n'est réécrit.
const RETENTION_DEFINITION = "parties-jouees-2026-11-08";
const SITE_SOURCES = [
  ["daily_plays", `SELECT identity, day FROM daily_plays WHERE ${PLAYED}`],
  ["wordle_plays", "SELECT identity, day FROM wordle_plays WHERE jsonb_array_length(guessed) > 0 OR status <> 'playing'"],
  ["dossier_plays", "SELECT identity, day FROM dossier_plays WHERE jsonb_array_length(answers) > 0 OR status <> 'playing'"],
  ["challenge_plays", "SELECT identity, day FROM challenge_plays WHERE jsonb_array_length(answers) > 0 OR jsonb_array_length(guessed) > 0 OR status IN ('completed','abandoned')"],
  ["grid_plays", "SELECT identity, day FROM grid_plays WHERE status = 'completed' OR jsonb_array_length(misses) > 0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(cells) c WHERE c <> 'null'::jsonb)"],
  ["petitbac_daily_plays", "SELECT identity, day FROM petitbac_daily_plays WHERE jsonb_array_length(answers) > 0 OR status = 'completed'"],
  ["ball_gains", "SELECT identity, day FROM ball_gains WHERE source LIKE 'mode:%' OR source = 'party'"],
  ["wild_encounters", "SELECT identity, day FROM wild_encounters WHERE kind <> 'trade' AND status IS DISTINCT FROM 'test_reset'"],
];
// DATA-04 (7/11, mesure d'avant, gardée sous son nom) : toute activité de jeu enregistrée, cadeaux et achats compris.
// A visit without any recorded row does not count, nor do Balls given by the admin or a Pokémon received in a trade.
const SITE_ACTIVITY_SOURCES = [
  ["daily_plays", `SELECT identity, day FROM daily_plays WHERE ${PLAYED}`],
  ["wordle_plays", "SELECT identity, day FROM wordle_plays"],
  ["dossier_plays", "SELECT identity, day FROM dossier_plays"],
  ["challenge_plays", "SELECT identity, day FROM challenge_plays"],
  ["grid_plays", "SELECT identity, day FROM grid_plays"],
  ["petitbac_daily_plays", "SELECT identity, day FROM petitbac_daily_plays"],
  ["ball_gains", "SELECT identity, day FROM ball_gains WHERE source NOT LIKE 'admin:%'"],
  ["wild_encounters", "SELECT identity, day FROM wild_encounters WHERE kind <> 'trade'"],
];
async function siteRetention(db, fromDay, toDay, exclude = [], sources = SITE_SOURCES) {
  const present = [];
  for (const [table, sql] of sources) {
    if ((await db.query("SELECT to_regclass($1) AS t", [table])).rows[0]?.t) present.push([table, sql]);
  }
  if (!present.length) return null;
  const out = await cohortRates(db, present.map(([, sql]) => sql).join(" UNION ALL "), fromDay, toDay, exclude);
  return { ...out, sources: present.map(([table]) => table), definition: sources === SITE_SOURCES ? RETENTION_DEFINITION : "activite-enregistree-2026-11-07" };
}

// Today's Pokémon du jour at a glance for /admin/stats: finders, give-ups, reactions, friends invited.
async function dailyToday(db, day) {
  const q = async (sql, fallback) => { try { return (await db.query(sql, [day])).rows[0]; } catch (_e) { return fallback; } };
  const plays = await q(`SELECT count(*) FILTER (WHERE status = 'won' AND NOT excluded_stats)::int AS found,
    count(*) FILTER (WHERE status = 'abandoned')::int AS gaveup FROM daily_plays WHERE day = $1`, { found: null, gaveup: null });
  const reactions = await q("SELECT COALESCE(json_object_agg(emoji, n), '{}'::json) AS r FROM (SELECT emoji, count(*)::int AS n FROM daily_reactions WHERE day = $1 GROUP BY emoji) x", { r: null });
  const friends = await q("SELECT count(*)::int AS n FROM referrals WHERE day = $1", { n: null });
  return { day, found: plays.found, gaveup: plays.gaveup, reactions: reactions.r, friends: friends.n };
}
function todaySectionHtml(t) {
  const n = (v) => (v == null ? "—" : String(Number(v)));
  const reactions = t.reactions ? ["😂", "🔥", "👏", "😱"].map((e) => e + " " + (Number(t.reactions[e]) || 0)).join(" · ") : "—";
  return `<p style="margin:16px 0 0">🎯 Pokémon du jour aujourd'hui : <b>${n(t.found)}</b> trouvé(s), <b>${n(t.gaveup)}</b> abandon(s) · réactions ${reactions} · 🎁 parrainages : <b>${n(t.friends)}</b></p>`;
}

module.exports = { dailyRetention, siteRetention, SITE_SOURCES, SITE_ACTIVITY_SOURCES, RETENTION_DEFINITION, dailyToday, todaySectionHtml };
