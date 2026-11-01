'use strict';
// Défis entre joueurs (01/11/2026): a record of mine to beat, sent from a trainer card, won by a
// result the server records afterwards; ready-made phrases only; refuse, stop a player, or turn off.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const lib = require('../lib/player-challenges');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;
const SCORES = `CREATE TABLE scores (discord_id TEXT NOT NULL, mode TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0,
  username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (discord_id, mode))`;

async function withSchema(prefix, run) {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = prefix + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 3 });
    await run(db);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
}

test('the site: a ⚔️ Défier button on trainer cards, « Mes défis » in the menu, results checked by the server', () => {
  const src = read('src/script.10xq.player-challenges.js');
  assert.match(src, /return html\.replace\('<div class="player-card-figures">', button \+ '<div class="player-card-figures">'\);/, 'the button sits under the card\'s name');
  assert.match(src, /if \(!player\.pid \|\| \(pcState\.options && pcState\.options\.pid === player\.pid\)\) return html;/, 'never on one\'s own card');
  assert.match(src, /pcPost\('\/api\/challenges', \{ pid: pcForm\.pid, mode: pcForm\.mode, phrase: pcForm\.phrase \}\)/, 'a phrase by its number: no free text');
  assert.doesNotMatch(src, /<textarea|<input type="text"/);
  assert.match(src, /submitLeaderboardResult = function \(mode, score\) \{/, 'the result of a game is checked against the challenges');
  for (const fn of ['openHigherLowerMode', 'startHigherLowerMode', 'startWeightBattle', 'openOddOneOutMode', 'openTypeComboSolo', 'startQuizGame', 'openSpeedrunMode', 'openDraftScoreAttackMode']) {
    assert.ok(read('script.js').includes('function ' + fn + '('), fn + ' exists to launch a challenge');
  }
  assert.deepEqual(Object.keys(lib.CHALLENGE_MODES).sort(), src.match(/^ {2}([a-z0-9_]+): function \(\) \{/gm).map((l) => l.trim().split(':')[0]).sort(), 'every game of a challenge can be launched');
  const menu = read('src/script.07.delegation-party.js');
  assert.match(menu, /data-args='\["defis"\]'><span>⚔️ Mes défis/);
  assert.match(menu, /destination === 'defis' && typeof openMyChallenges === 'function'\) openMyChallenges\(\);/);
  const server = read('server.js');
  assert.match(server, /challenges=await playerChallenges\.afterResult\(user\.id,mode,stored\.score\);/, 'a stored result decides, never the browser');
  assert.match(server, /\["player_challenges", "DELETE FROM player_challenges WHERE from_id = \$1 OR to_id = \$1", \[id\]\]/, 'deleted with the account');
  assert.match(server, /\["player_challenge_blocks", "DELETE FROM player_challenge_blocks WHERE account_id = \$1 OR blocked_id = \$1", \[id\]\]/);
  assert.match(read('confidentialite.html'), /Les défis sont effacés au bout de 30 jours, ou avec ton compte\./);
});

test('PostgreSQL: send, beat (strictly), refuse, stop a player, turn off, limits and expiry', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  await withSchema('duel_', async (db) => {
    await db.query(USERS); await db.query(SCORES);
    await db.query("INSERT INTO users(discord_id, username, partner_id) VALUES ('A', 'Kayan', 6), ('B', 'Sacha', 25), ('C', 'Ondine', 121)");
    await db.query("INSERT INTO scores(discord_id, mode, score) VALUES ('A', 'higherlower', 23), ('A', 'quiz', 12), ('B', 'higherlower', 40)");
    await lib.ensureTables(db);
    const pushed = [];
    const duels = lib.createPlayerChallenges({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid, push: async (to, payload) => { pushed.push({ to, ...payload }); return 1; } });
    const B = ids.playerPid('B'), C = ids.playerPid('C');

    const options = await duels.options('A');
    assert.equal(options.pid, ids.playerPid('A'));
    assert.equal(options.left, lib.PER_DAY);
    assert.deepEqual(options.modes.filter((m) => m.record).map((m) => [m.mode, m.record]), [['higherlower', 23], ['quiz', 12]]);

    assert.deepEqual(await duels.create('A', { pid: B, mode: 'daily', phrase: 0 }), { ok: false, error: 'mode' });
    assert.deepEqual(await duels.create('A', { pid: B, mode: 'quiz', phrase: 9 }), { ok: false, error: 'phrase' });
    assert.deepEqual(await duels.create('A', { pid: '0000000000000000', mode: 'quiz', phrase: 0 }), { ok: false, error: 'unknown' });
    assert.deepEqual(await duels.create('A', { pid: ids.playerPid('A'), mode: 'quiz', phrase: 0 }), { ok: false, error: 'self' });
    assert.deepEqual(await duels.create('A', { pid: B, mode: 'typecombo', phrase: 0 }), { ok: false, error: 'no_record' });
    const sent = await duels.create('A', { pid: B, mode: 'higherlower', phrase: 0 });
    assert.equal(sent.ok, true); assert.equal(sent.target, 23);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(pushed.pop(), { to: 'B', title: '⚔️ Kayan te défie', body: 'Bats sa série au Higher or Lower : 23. « Tu tiendras pas 😏 »', url: '/?defis=1', tag: 'pokedle-defi' });
    assert.deepEqual(await duels.create('A', { pid: B, mode: 'higherlower', phrase: 1 }), { ok: false, error: 'already' });

    // Sacha's record (40) is older: only results after the challenge count, and a tie does not win.
    assert.deepEqual(await duels.afterResult('B', 'higherlower', 20), [{ id: sent.id, target: 23, best: 20, won: false }]);
    assert.deepEqual(await duels.afterResult('B', 'higherlower', 23), [{ id: sent.id, target: 23, best: 23, won: false }]);
    assert.deepEqual(await duels.afterResult('B', 'quiz', 50), [], 'another game changes nothing');
    assert.deepEqual(await duels.afterResult('B', 'higherlower', 25), [{ id: sent.id, target: 23, best: 25, won: true }]);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(pushed.pop(), { to: 'A', title: '🏆 Sacha a battu ta série', body: '25 contre 23 au Higher or Lower. Revanche ?', url: '/?defis=1', tag: 'pokedle-defi' });
    assert.deepEqual(await duels.afterResult('B', 'higherlower', 30), [], 'a won challenge is closed');

    const forB = (await duels.list('B')).challenges[0];
    assert.equal(forB.incoming, true); assert.equal(forB.status, 'won'); assert.equal(forB.best, 25);
    assert.deepEqual(forB.other, { pid: ids.playerPid('A'), username: 'Kayan', partnerId: 6 });
    const forA = (await duels.list('A')).challenges[0];
    assert.equal(forA.incoming, false); assert.equal(forA.seen, false, 'Kayan has news');
    await duels.seen('A', [forA.id]);
    assert.equal((await duels.list('A')).challenges[0].seen, true);

    // Refuse one, then stop this player: nothing more from Kayan, until challenges are turned back on.
    const quiz = await duels.create('A', { pid: B, mode: 'quiz', phrase: 2 });
    assert.deepEqual(await duels.decline('B', quiz.id), { ok: true });
    assert.deepEqual(await duels.decline('A', quiz.id), { ok: false }, 'only the challenged player refuses');
    assert.deepEqual(await duels.block('B', quiz.id), { ok: true });
    assert.deepEqual(await duels.create('A', { pid: B, mode: 'quiz', phrase: 0 }), { ok: false, error: 'refused' });
    assert.deepEqual(await duels.setAccepting('B', true), { ok: true, accepting: true });
    assert.equal((await duels.create('A', { pid: B, mode: 'quiz', phrase: 0 })).ok, true);
    await duels.setAccepting('C', false);
    assert.deepEqual(await duels.create('A', { pid: C, mode: 'quiz', phrase: 0 }), { ok: false, error: 'refused' });
    assert.equal((await duels.list('C')).accepting, false);

    // Five a day; a challenge not beaten in 7 days ends, and nothing stays past 30 days.
    await duels.setAccepting('C', true);
    await db.query("INSERT INTO player_challenges(from_id, to_id, mode, target, expires_at) SELECT 'A', 'C', 'quiz', 12, now() + interval '7 days' FROM generate_series(1, 2)");
    assert.equal((await duels.options('A')).left, 0);
    assert.deepEqual(await duels.create('A', { pid: C, mode: 'higherlower', phrase: 0 }), { ok: false, error: 'limit' });
    await db.query("UPDATE player_challenges SET expires_at = now() - interval '1 minute' WHERE to_id = 'C'");
    assert.ok((await duels.list('C')).challenges.every((c) => c.status === 'expired'));
    await db.query("UPDATE player_challenges SET created_at = now() - interval '31 days' WHERE to_id = 'C'");
    assert.equal((await duels.list('C')).challenges.length, 0);
  });
});

test('the routes: signed in, same origin for every change', async () => {
  const express = require('express');
  const app = express();
  const calls = [];
  const challenges = new Proxy({}, { get: (_t, name) => async (...args) => { calls.push([name, ...args]); return { ok: true }; } });
  lib.mountChallengeRoutes(app, { express, challenges, getUser: (req) => (req.get('x-user') ? { id: req.get('x-user') } : null), log: { error() {} } });
  const server = app.listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/api/challenges')).status, 401);
    assert.equal((await fetch(base + '/api/challenges', { headers: { 'x-user': 'A' } })).status, 200);
    const post = (headers) => fetch(base + '/api/challenges', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user': 'A', ...headers }, body: JSON.stringify({ pid: 'abc', mode: 'quiz', phrase: 1, body: 'texte libre' }) });
    assert.equal((await post({})).status, 403, 'no origin, no change');
    assert.equal((await post({ origin: 'https://evil.example' })).status, 403);
    assert.equal((await post({ origin: base })).status, 200);
    assert.deepEqual(calls.at(-1), ['create', 'A', { pid: 'abc', mode: 'quiz', phrase: 1, body: 'texte libre' }]);
    assert.match(read('lib/player-challenges.js'), /async function create\(fromId, \{ pid, mode, phrase \} = \{\}\) \{/, 'a free text sent anyway is never read');
  } finally { server.close(); }
});
