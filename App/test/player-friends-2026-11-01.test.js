'use strict';
// Amis (01/11/2026, option B): a request from a trainer card, accepted by the other player; refuse
// (discreetly), remove, block; 50 friends and 20 requests a day at most; unanswered requests erased
// after 30 days; everything erased with the account. The base of the private chat between friends.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const lib = require('../lib/player-friends');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;

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

test('PostgreSQL: ask, accept, refuse discreetly, remove, block, limits and expiry', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  await withSchema('amis_', async (db) => {
    await db.query(USERS);
    await db.query("INSERT INTO users(discord_id, username, partner_id, xp) VALUES ('A', 'Kayan', 6, 3000), ('B', 'Sunaii', 94, 400), ('C', 'Léo', 448, 0)");
    await lib.ensureTables(db); await lib.ensureTables(db);
    const pushed = [];
    const fr = lib.createPlayerFriends({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid, push: async (to, payload) => { pushed.push({ to, ...payload }); return 1; } });
    const A = ids.playerPid('A'), B = ids.playerPid('B'), C = ids.playerPid('C');
    const tick = () => new Promise((r) => setImmediate(r));

    assert.deepEqual(await fr.request('A', { pid: A }), { ok: false, error: 'self' });
    assert.deepEqual(await fr.request('A', { pid: '0000000000000000' }), { ok: false, error: 'unknown' });
    assert.deepEqual(await fr.request('A', { pid: 'pas-un-pid' }), { ok: false, error: 'unknown' });
    assert.deepEqual(await fr.status('A', B), { ok: true, relation: 'none' });

    assert.deepEqual(await fr.request('A', { pid: B }), { ok: true, relation: 'sent' });
    await tick();
    assert.deepEqual(pushed.pop(), { to: 'B', title: '🤝 Kayan veut être ton ami', body: 'Accepte sa demande dans « Mes amis » pour vous défier et discuter.', url: '/?amis=1', tag: 'pokedle-ami' });
    assert.deepEqual(await fr.request('A', { pid: B }), { ok: true, relation: 'sent' }, 'asking twice changes nothing');
    assert.equal(pushed.length, 0, 'and notifies once');
    assert.deepEqual(await fr.status('A', B), { ok: true, relation: 'sent' });
    const forB = await fr.list('B');
    assert.equal(forB.pid, B);
    assert.equal(forB.incoming.length, 1);
    assert.deepEqual({ ...forB.incoming[0], createdAt: 'x' }, { pid: A, username: 'Kayan', partnerId: 6, xp: 3000, id: forB.incoming[0].id, createdAt: 'x', seen: false });
    assert.deepEqual(await fr.status('B', A), { ok: true, relation: 'received', id: forB.incoming[0].id });
    assert.deepEqual(await fr.respond('A', { id: forB.incoming[0].id }), { ok: false, error: 'unknown' }, 'only the asked player answers');

    assert.deepEqual(await fr.respond('B', { id: forB.incoming[0].id, accept: true }), { ok: true, relation: 'friends' });
    await tick();
    assert.equal(pushed.pop().title, '🤝 Sunaii a accepté ta demande');
    assert.equal(await fr.areFriends('A', 'B'), true);
    assert.equal(await fr.areFriends('B', 'A'), true);
    const forA = await fr.list('A');
    assert.deepEqual(forA.friends.map((f) => f.username), ['Sunaii']);
    assert.deepEqual(forA.news.map((f) => f.username), ['Sunaii'], 'Kayan has news');
    await fr.seen('A');
    assert.deepEqual((await fr.list('A')).news, []);
    assert.deepEqual(await fr.request('B', { pid: A }), { ok: false, error: 'already' });

    // Léo asks Kayan, who had asked nothing: Kayan refuses. Léo still reads « sent », and asking again
    // does not notify Kayan a second time.
    await fr.request('C', { pid: A }); await tick(); pushed.length = 0;
    const leo = (await fr.list('A')).incoming[0];
    assert.deepEqual(await fr.respond('A', { id: leo.id, accept: false }), { ok: true, relation: 'none' });
    assert.deepEqual(await fr.status('C', A), { ok: true, relation: 'sent' }, 'a refusal stays discreet');
    assert.deepEqual(await fr.request('C', { pid: A }), { ok: true, relation: 'sent' });
    await tick();
    assert.equal(pushed.length, 0);
    assert.equal((await fr.list('A')).incoming.length, 0);
    // Kayan changes his mind and asks Léo: a new request.
    assert.deepEqual(await fr.request('A', { pid: C }), { ok: true, relation: 'sent' });
    // Asking back someone who asked first is accepting.
    assert.deepEqual(await fr.request('C', { pid: A }), { ok: true, relation: 'friends' });
    assert.equal(await fr.areFriends('A', 'C'), true);

    // Remove, then block: no more requests from the blocked player, friendship gone.
    assert.deepEqual(await fr.remove('A', { pid: C }), { ok: true, relation: 'none' });
    assert.equal(await fr.areFriends('A', 'C'), false);
    assert.deepEqual(await fr.block('A', { pid: B }), { ok: true, relation: 'blocked' });
    assert.equal(await fr.areFriends('A', 'B'), false);
    assert.deepEqual(await fr.request('B', { pid: A }), { ok: false, error: 'refused' });
    assert.deepEqual(await fr.request('A', { pid: B }), { ok: false, error: 'refused' });
    assert.deepEqual(await fr.status('A', B), { ok: true, relation: 'blocked' });
    assert.deepEqual((await fr.list('A')).blocked.map((f) => f.username), ['Sunaii']);
    assert.deepEqual(await fr.unblock('A', { pid: B }), { ok: true, relation: 'none' });
    assert.deepEqual(await fr.request('B', { pid: A }), { ok: true, relation: 'sent' });

    // 20 requests a day; 50 friends at most; unanswered requests erased after 30 days.
    await db.query("INSERT INTO users(discord_id, username) SELECT 'u' || g, 'Joueur ' || g FROM generate_series(1, 60) g");
    await db.query("DELETE FROM player_friends WHERE from_id = 'C' OR to_id = 'C'");
    await db.query("INSERT INTO player_friends(from_id, to_id) SELECT 'C', 'u' || g FROM generate_series(1, 20) g");
    assert.deepEqual(await fr.request('C', { pid: ids.playerPid('u30') }), { ok: false, error: 'limit' });
    await db.query("UPDATE player_friends SET status = 'accepted', created_at = now() - interval '2 days' WHERE from_id = 'C'");
    await db.query("INSERT INTO player_friends(from_id, to_id, status, created_at) SELECT 'C', 'u' || g, 'accepted', now() - interval '2 days' FROM generate_series(21, 50) g");
    assert.deepEqual(await fr.request('C', { pid: ids.playerPid('u55') }), { ok: false, error: 'full' });
    assert.deepEqual(await fr.request('u55', { pid: C }), { ok: false, error: 'full_other' });
    await db.query("INSERT INTO player_friends(from_id, to_id, created_at) VALUES ('u56', 'u57', now() - interval '31 days')");
    await fr.list('u57');
    assert.equal((await db.query("SELECT count(*)::int AS n FROM player_friends WHERE from_id = 'u56'")).rows[0].n, 0);
  });
});

test('the routes: signed in, same origin for every change, no free text read', async () => {
  const express = require('express');
  const app = express();
  const calls = [];
  const friends = new Proxy({}, { get: (_t, name) => async (...args) => { calls.push([name, ...args]); return { ok: true }; } });
  lib.mountFriendRoutes(app, { express, friends, getUser: (req) => (req.get('x-user') ? { id: req.get('x-user') } : null), log: { error() {} } });
  const server = app.listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/api/friends')).status, 401);
    assert.equal((await fetch(base + '/api/friends', { headers: { 'x-user': 'A' } })).status, 200);
    await fetch(base + '/api/friends/status?pid=abc', { headers: { 'x-user': 'A' } });
    assert.deepEqual(calls.at(-1), ['status', 'A', 'abc']);
    const post = (url, body, headers) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user': 'A', ...headers }, body: JSON.stringify(body) });
    assert.equal((await post('/api/friends/request', { pid: 'abc' }, {})).status, 403, 'no origin, no change');
    assert.equal((await post('/api/friends/request', { pid: 'abc' }, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('/api/friends/request', { pid: 'abc', message: 'salut' }, { origin: base })).status, 200);
    assert.deepEqual(calls.at(-1), ['request', 'A', { pid: 'abc' }], 'only the pid is passed on');
    await post('/api/friends/respond', { id: 3, accept: false }, { origin: base });
    assert.deepEqual(calls.at(-1), ['respond', 'A', { id: 3, accept: false }]);
    await post('/api/friends/respond', { id: 3 }, { origin: base });
    assert.deepEqual(calls.at(-1), ['respond', 'A', { id: 3, accept: true }]);
    for (const name of ['remove', 'block', 'unblock']) {
      await post('/api/friends/' + name, { pid: 'abc' }, { origin: base });
      assert.deepEqual(calls.at(-1), [name, 'A', { pid: 'abc' }]);
    }
  } finally { server.close(); }
});

test('the site: a button on trainer cards, « Mes amis » next to the Party Room, counts, menu, privacy', () => {
  const src = read('src/script.10xu.friends.js');
  assert.match(src, /return html\.replace\('<div class="player-card-figures">', '<div class="fr-card-slot"/, 'the button sits on the card');
  assert.match(src, /🤝 Ajouter en ami/);
  assert.doesNotMatch(src, /<textarea|<input type="text"|\/api\/friends\/search/, 'no search by name, no free text');
  assert.match(src, /anchor\.parentNode\.insertBefore\(seg, anchor\)/, 'the tabs sit in the page');
  assert.doesNotMatch(src, /position:\s*fixed/);
  assert.match(read('game-shell.css'), /#screen-party-room\.party-tab-friends #party-lobby, #screen-party-room\.party-tab-friends #party-duels \{display:none !important;\}/);
  const inbox = read('src/script.10xs.inbox-visibility.js');
  assert.match(inbox, /var friends = typeof frPendingCount === 'function' \? frPendingCount\(\) : 0;/);
  assert.match(inbox, /n\.duels \+ n\.messages \+ \(n\.friends \|\| 0\)/);
  assert.match(inbox, /html \+= friendLine;/);
  const menu = read('src/script.07.delegation-party.js');
  assert.match(menu, /data-args='\["amis"\]'><span>🤝 Mes amis/);
  assert.match(menu, /destination === 'amis' && typeof openMyFriends === 'function'\) openMyFriends\(\);/);
  const server = read('server.js');
  assert.match(server, /\["player_friends", "DELETE FROM player_friends WHERE from_id = \$1 OR to_id = \$1", \[id\]\]/, 'erased with the account');
  assert.match(server, /\["player_blocks", "DELETE FROM player_blocks WHERE account_id = \$1 OR blocked_id = \$1", \[id\]\]/);
  assert.match(server, /friendLib\.mountFriendRoutes\(app, /);
  assert.match(read('confidentialite.html'), /Une demande sans réponse est effacée au bout de 30 jours ; tout le reste est effacé avec ton compte\./);
});
