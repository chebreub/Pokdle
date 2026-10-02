"use strict";
async function ensureLeaderboardResultKeys(pool) {
  await pool.query("ALTER TABLE leaderboard_events ADD COLUMN IF NOT EXISTS result_key TEXT");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_result_key_idx ON leaderboard_events (discord_id, mode, result_key) WHERE result_key IS NOT NULL");
}
async function recordLeaderboardResultInTransaction(client, user, mode, score, config, resultKey = null) {
  const inserted = await client.query(
    `INSERT INTO leaderboard_events (discord_id, mode, score, created_at, result_key) VALUES ($1,$2,$3,now(),$4)
     ON CONFLICT (discord_id, mode, result_key) WHERE result_key IS NOT NULL DO NOTHING RETURNING score`,
    [user.id,mode,score,resultKey]
  );
  const duplicate = inserted.rows.length === 0;
  let accepted = score;
  if (duplicate) {
    const existing = await client.query("SELECT score FROM leaderboard_events WHERE discord_id=$1 AND mode=$2 AND result_key=$3",[user.id,mode,resultKey]);
    if (!existing.rows[0]) throw new Error("Missing duplicate leaderboard result");
    accepted = Number(existing.rows[0].score);
  }
  const ascending = config.direction === "asc";
  const best = ascending ? "LEAST" : "GREATEST";
  await client.query(
    `INSERT INTO scores (discord_id,mode,score,username,avatar,updated_at) VALUES ($1,$2,$3,$4,$5,now())
     ON CONFLICT (discord_id,mode) DO UPDATE SET score=${best}(scores.score,EXCLUDED.score), username=EXCLUDED.username,avatar=EXCLUDED.avatar,
     updated_at=CASE WHEN EXCLUDED.score ${ascending ? "<" : ">"} scores.score THEN now() ELSE scores.updated_at END`,
    [user.id,mode,accepted,user.username||"",user.avatar||""]
  );
  return {score:accepted,duplicate};
}
async function recordLeaderboardResult(pool, user, mode, score, config, resultKey = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const stored = await recordLeaderboardResultInTransaction(client,user,mode,score,config,resultKey);
    await client.query("COMMIT");
    return stored;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_rollbackError) {}
    throw error;
  } finally { client.release(); }
}
module.exports={ensureLeaderboardResultKeys,recordLeaderboardResult,recordLeaderboardResultInTransaction};
