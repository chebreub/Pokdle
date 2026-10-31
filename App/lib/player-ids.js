'use strict';
// Public ids for players (31/10/2026): a ranking row names its player by a short hash, so a
// click can open their trainer card without ever showing their Discord, Google or Twitch number.
const crypto = require('node:crypto');
let secret = '';
const known = new Map();
function setPlayerIdSecret(value) { secret = String(value || ''); known.clear(); }
function playerPid(accountId) {
  if (!secret || accountId == null || accountId === '') return null;
  const pid = crypto.createHmac('sha256', secret).update('player:' + accountId).digest('hex').slice(0, 16);
  known.set(pid, String(accountId));
  return pid;
}
// The account behind a public id; after a restart every account is named once again.
async function accountOfPid(db, pid) {
  if (!secret || !/^[0-9a-f]{16}$/.test(String(pid))) return null;
  if (!known.has(pid)) for (const row of (await db.query('SELECT discord_id FROM users')).rows) playerPid(row.discord_id);
  return known.get(pid) || null;
}
module.exports = { setPlayerIdSecret, playerPid, accountOfPid };
