"use strict";
// « Jours passés » (31/10/2026): replay the Pokémon du jour of earlier days, for fun and a little XP,
// never for points. A signed-in player gets the last 7 days; each friend they invited (lib/referrals.js)
// unlocks 7 more, up to 60. A day's answer is only sent once that day is over and unlocked.
const PAST_BASE_DAYS = 7;
const PAST_PER_FRIEND = 7;
const PAST_MAX_DAYS = 60;

async function pastDays(db, accountId, today) {
  let friends = 0;
  if (accountId) {
    try { friends = (await db.query("SELECT count(*)::int AS n FROM referrals WHERE referrer_id = $1", [String(accountId)])).rows[0].n; }
    catch (_e) { friends = 0; }
  }
  const unlocked = accountId ? Math.min(PAST_MAX_DAYS, PAST_BASE_DAYS + PAST_PER_FRIEND * friends) : 0;
  const rows = (await db.query("SELECT to_char(day, 'YYYY-MM-DD') AS day, secret_id FROM daily_rounds WHERE day < $1::date ORDER BY day DESC LIMIT $2", [today, PAST_MAX_DAYS])).rows;
  return {
    ok: true, login: Boolean(accountId), unlocked, friends, perFriend: PAST_PER_FRIEND,
    days: rows.map((row, i) => ({ day: row.day, unlocked: i < unlocked, id: i < unlocked ? Number(row.secret_id) : null })),
  };
}

function mountPastRoutes({ app, db, getUser, today, log = console }) {
  app.get("/api/daily/past", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!db) return res.status(503).json({ ok: false, error: "unavailable" });
    const user = getUser(req);
    try { res.json(await pastDays(db, user && user.id ? user.id : null, today())); }
    catch (error) { log.error("[past] list:", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  });
}

module.exports = { PAST_BASE_DAYS, PAST_PER_FRIEND, PAST_MAX_DAYS, pastDays, mountPastRoutes };
