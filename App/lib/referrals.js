"use strict";
// « Invite un ami » (31/10/2026): a signed-in player shares pokdle.fr/?ami=<public id>. When the friend
// finds their very first Pokémon du jour, both get a bonus: the friend at once, the referrer at their
// next visit. One reward per friend, never one's own link, ten friends a day at most per referrer.
const REFERRAL_XP = 100;
const REFERRALS_PER_DAY = 10;

async function ensureReferralTables(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS referrals (
    friend_key TEXT PRIMARY KEY, referrer_id TEXT NOT NULL, day DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), claimed_at TIMESTAMPTZ)`);
  await db.query("CREATE INDEX IF NOT EXISTS referrals_referrer ON referrals(referrer_id, claimed_at)");
}

function createReferrals({ db, accountOfPid, playerPid, ready = Promise.resolve() }) {
  // Called by the friend's page right after a Pokémon du jour is found.
  async function friendFound(who, ref, day) {
    await ready;
    const referrer = await accountOfPid(db, String(ref || ""));
    if (!referrer) return { ok: false, error: "unknown" };
    if (who.accountId && String(who.accountId) === referrer) return { ok: false, error: "self" };
    // An account counts its wins under any identity it played with; a guest, this browser only.
    const wins = (await db.query(`SELECT count(*)::int AS n, bool_or(day = $3::date) AS today FROM daily_plays
      WHERE (($1::text <> '' AND account_id = $1::text) OR identity = $2::text) AND status = 'won'`,
      [who.accountId || "", who.key, day])).rows[0];
    if (!wins || !wins.today) return { ok: false, error: "no_win" };
    if (wins.n > 1) return { ok: false, error: "not_new" };
    const sent = (await db.query("SELECT count(*)::int AS n FROM referrals WHERE referrer_id = $1 AND day = $2", [referrer, day])).rows[0].n;
    if (sent >= REFERRALS_PER_DAY) return { ok: false, error: "limit" };
    const r = await db.query("INSERT INTO referrals(friend_key, referrer_id, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [who.key, referrer, day]);
    return r.rowCount ? { ok: true, xp: REFERRAL_XP } : { ok: false, error: "already" };
  }
  // The referrer's side: their link, how many friends joined, and the bonuses not given yet.
  async function mine(accountId) {
    await ready;
    const row = (await db.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE claimed_at IS NULL)::int AS pending FROM referrals WHERE referrer_id = $1", [String(accountId)])).rows[0];
    return { ok: true, pid: playerPid(accountId), xp: REFERRAL_XP, total: row.total, pending: row.pending };
  }
  async function claim(accountId) {
    await ready;
    const r = await db.query("UPDATE referrals SET claimed_at = now() WHERE referrer_id = $1 AND claimed_at IS NULL", [String(accountId)]);
    return { ok: true, friends: r.rowCount || 0, xp: (r.rowCount || 0) * REFERRAL_XP };
  }
  return { friendFound, mine, claim };
}

// The referrer's routes; the friend's one lives with the Pokémon du jour (it needs the same identity).
function mountReferralRoutes({ app, express, getUser, referrals, log = console }) {
  app.get("/api/referral/mine", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const user = getUser(req);
    if (!user || !user.id) return res.json({ ok: false, error: "login" });
    try { res.json(await referrals.mine(user.id)); }
    catch (error) { log.error("[referral] mine:", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  });
  app.post("/api/referral/claim", express.json({ limit: "1kb" }), async (req, res) => {
    res.set("Cache-Control", "no-store");
    const origin = req.get("origin");
    let host = "";
    try { host = origin ? new URL(origin).host : ""; } catch (_e) { host = ""; }
    if (!origin || host !== req.get("host")) return res.status(403).json({ ok: false, error: "origin_denied" });
    const user = getUser(req);
    if (!user || !user.id) return res.status(401).json({ ok: false, error: "login" });
    try { res.json(await referrals.claim(user.id)); }
    catch (error) { log.error("[referral] claim:", error.message); res.status(503).json({ ok: false, error: "unavailable" }); }
  });
}

module.exports = { REFERRAL_XP, REFERRALS_PER_DAY, ensureReferralTables, createReferrals, mountReferralRoutes };
