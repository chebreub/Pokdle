'use strict';
// The week's prize (31/10/2026). Each week runs from Monday to Sunday in Paris. Once it is over,
// the first three of its Parcours keep a medal (gold, silver, bronze) on their trainer card, and
// the first one plays the whole next week with a shiny partner in every ranking.
// Nothing runs at midnight: the first visit of the new week settles the week that ended.
const { weekPodium } = require('./day-boards');
const { setChampions } = require('./week-champions');
const { playerLevelFromXp } = require('./profile-sync');

function shiftDay(day, days) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// The Monday of the week that holds `day` (YYYY-MM-DD, the day in Paris).
function mondayOf(day) {
  const d = new Date(day + 'T12:00:00Z');
  return shiftDay(day, -((d.getUTCDay() + 6) % 7));
}

function createWeeklyAwards({ db }) {
  let ready = null;
  let refreshed = null;
  function ensure() {
    ready ||= db.query(`CREATE TABLE IF NOT EXISTS weekly_awards (
      week DATE NOT NULL,
      rank INTEGER NOT NULL,
      discord_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (week, discord_id)
    )`).catch((error) => { ready = null; throw error; });
    return ready;
  }
  // Writes the podium of a finished week once; a second call, or a second server, changes nothing.
  async function settle(week) {
    await ensure();
    const done = await db.query('SELECT 1 FROM weekly_awards WHERE week = $1 LIMIT 1', [week]);
    if (done.rows.length) return;
    for (const row of await weekPodium(db, shiftDay(week, 6))) {
      await db.query('INSERT INTO weekly_awards (week, rank, discord_id, points) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [week, row.rank, row.discordId, row.points]);
    }
  }
  // Settles last week when a new one starts and keeps its champions in memory for the rankings.
  async function refresh(today) {
    const last = shiftDay(mondayOf(today), -7);
    if (refreshed === last) return last;
    await settle(last);
    const rows = (await db.query('SELECT discord_id FROM weekly_awards WHERE week = $1 AND rank = 1', [last])).rows;
    setChampions(rows.map((row) => row.discord_id));
    refreshed = last;
    return last;
  }
  // What the ranking page and the trainer card show: last week's podium and the player's medals.
  async function summary(today, accountId) {
    const last = await refresh(today);
    const podium = (await db.query(`SELECT w.rank, w.points, w.discord_id, COALESCE(u.username, 'Dresseur') AS username, u.partner_id, u.xp
      FROM weekly_awards w LEFT JOIN users u ON u.discord_id = w.discord_id WHERE w.week = $1 ORDER BY w.rank, username`, [last])).rows;
    const medals = accountId
      ? (await db.query("SELECT to_char(week, 'YYYY-MM-DD') AS week, rank FROM weekly_awards WHERE discord_id = $1 ORDER BY week DESC LIMIT 52", [String(accountId)])).rows
      : [];
    const me = accountId != null ? String(accountId) : null;
    return {
      ok: true,
      week: { start: mondayOf(today), lastStart: last },
      champion: podium.some((row) => row.rank === 1 && row.discord_id === me),
      podium: podium.map((row) => ({
        rank: Number(row.rank), points: Number(row.points), username: row.username,
        partnerId: row.partner_id ? Number(row.partner_id) : null, level: playerLevelFromXp(row.xp), me: row.discord_id === me,
      })),
      medals: medals.map((row) => ({ week: row.week, rank: Number(row.rank) })),
    };
  }
  return { refresh, summary, settle };
}

module.exports = { createWeeklyAwards, mondayOf, shiftDay };
