"use strict";
// Return of players (31/10/2026), read from the Pokémon du jour plays the game already keeps — nothing
// new is collected or stored. A play counts once a guess was made or the day was given up. Days are the
// days of Paris (daily_plays.day). Identities are an account, or a browser for guests (a guest who later
// signs in counts as a new identity, so the figures are slightly low, never high).
const PLAYED = "(jsonb_array_length(guessed) > 0 OR status <> 'playing')";

async function dailyRetention(db, fromDay, toDay) {
  const r = await db.query(`
    WITH p AS (SELECT DISTINCT identity, day FROM daily_plays WHERE ${PLAYED} AND day BETWEEN $1::date AND $2::date),
    firsts AS (SELECT identity, MIN(day) AS first_day FROM daily_plays WHERE ${PLAYED} GROUP BY identity),
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
    FROM marked`, [fromDay, toDay]);
  const row = r.rows[0] || {};
  const rate = (back, base) => ({ back: Number(back) || 0, base: Number(base) || 0, rate: Number(base) > 0 ? Math.round(100 * Number(back) / Number(base)) : null });
  return { nextDay: rate(row.back1, row.base1), week: rate(row.back7, row.base7), newWeek: rate(row.newback7, row.new7) };
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

module.exports = { dailyRetention, dailyToday, todaySectionHtml };
