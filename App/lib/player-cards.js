'use strict';
// A player's trainer card, opened by a click on their name in a ranking (31/10/2026), as on
// PokeQuizz. Everything comes from the plays the server recorded, never from the browser, and
// the player is named by their public id only.
const { STAGES, FINISHED } = require('./day-boards');
const { accountOfPid, playerPid } = require('./player-ids');
const { isChampion } = require('./week-champions');
const { streakFromDays } = require('./daily-game');
const { rankingAvatarSql } = require('./profile-sync');

const DAY_GAMES = ['enquete', 'wordlepts', 'dossier', 'challenge'];

function profileOf(raw) {
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw && typeof raw === 'object' ? raw : {}); } catch (_error) { return {}; }
}

function createPlayerCards({ db, arcadeModes = [], modeConfig = () => null }) {
  async function card(pid, today) {
    const id = await accountOfPid(db, pid);
    if (!id) return null;
    const user = (await db.query(`SELECT u.username, ${rankingAvatarSql("COALESCE(u.avatar, '')")} AS avatar, u.partner_id, u.xp,
      to_char(u.created_at, 'YYYY-MM') AS since, u.data->'profile' AS profile FROM users u WHERE u.discord_id = $1`, [id])).rows[0];
    if (!user) return null;

    // One row per stage and day, as in the rankings: a stage counts once it is finished.
    const days = DAY_GAMES.map((name) => `SELECT '${name}' AS game, p.day, MAX(${STAGES[name].points})::int AS points
      FROM ${STAGES[name].table} p WHERE p.account_id = $1 AND ${FINISHED[name]} GROUP BY p.day`).join(' UNION ALL ');
    const games = (await db.query(`SELECT game, COUNT(*)::int AS played, COALESCE(SUM(points), 0)::int AS points FROM (${days}) d GROUP BY game`, [id])).rows;
    const daysPlayed = Number((await db.query(`SELECT COUNT(DISTINCT day)::int AS n FROM (${days}) d`, [id])).rows[0].n);
    const wins = (await db.query(`SELECT to_char(day, 'YYYY-MM-DD') AS day, jsonb_array_length(guessed) AS attempts
      FROM daily_plays WHERE account_id = $1 AND status = 'won' ORDER BY day`, [id])).rows;
    const records = arcadeModes.length
      ? (await db.query('SELECT mode, score FROM scores WHERE discord_id = $1 AND mode = ANY($2) ORDER BY updated_at DESC LIMIT 3', [id, arcadeModes])).rows
      : [];
    let medals = [];
    try {
      medals = (await db.query('SELECT rank, COUNT(*)::int AS n FROM weekly_awards WHERE discord_id = $1 GROUP BY rank', [id])).rows;
    } catch (_error) { medals = []; }
    // The shiny hunt: the Pokémon du jour this player caught shiny (31/10/2026).
    let shinies = [];
    try {
      shinies = (await db.query(`SELECT to_char(p.day, 'YYYY-MM-DD') AS day, r.secret_id FROM daily_plays p JOIN daily_rounds r ON r.day = p.day
        WHERE p.account_id = $1 AND p.status = 'won' AND p.shiny ORDER BY p.day DESC LIMIT 60`, [id])).rows;
    } catch (_error) { shinies = []; }

    const byGame = Object.fromEntries(games.map((row) => [row.game, row]));
    const profile = profileOf(user.profile);
    return {
      ok: true,
      player: {
        pid: playerPid(id),
        username: user.username || 'Dresseur',
        avatar: user.avatar || '',
        partnerId: user.partner_id ? Number(user.partner_id) : null,
        champion: isChampion(id),
        xp: Math.max(0, Number(user.xp) || 0),
        pioneer: profile.pioneerMyth === true,
        since: user.since || null,
        medals: Object.fromEntries([1, 2, 3].map((rank) => [rank, Number(medals.find((m) => Number(m.rank) === rank)?.n) || 0])),
      },
      figures: {
        days: daysPlayed,
        found: wins.length,
        attempts: wins.length ? Math.round(wins.reduce((sum, row) => sum + Number(row.attempts), 0) / wins.length * 10) / 10 : null,
        bestStreak: streakFromDays(wins.map((row) => row.day), today).best,
        points: games.reduce((sum, row) => sum + Number(row.points), 0),
      },
      shinies: { count: shinies.length, latest: shinies.slice(0, 8).map((row) => ({ id: Number(row.secret_id), day: row.day })) },
      games: DAY_GAMES.map((game) => ({ game, played: Number(byGame[game]?.played) || 0, points: Number(byGame[game]?.points) || 0 })),
      records: records.map((row) => {
        const config = modeConfig(row.mode) || {};
        return { mode: row.mode, label: config.label || row.mode, unit: config.unit || '', score: Number(row.score) };
      }),
    };
  }
  return { card };
}

module.exports = { createPlayerCards, DAY_GAMES };
