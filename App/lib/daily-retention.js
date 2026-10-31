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

module.exports = { dailyRetention };
