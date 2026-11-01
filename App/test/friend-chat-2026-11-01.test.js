'use strict';
// Discussion entre amis (01/11/2026, option B, 2e PR): friends only, 200 characters, no links nor
// numbers, one notification at a time, « Signaler » copies the last messages to /admin, blocking ends
// the chat, 30 days, erased with the account.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const chatLib = require('../lib/friend-chat');
const friendLib = require('../lib/player-friends');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;

test('no links, addresses, numbers or other apps: nobody is drawn away from the site', () => {
  for (const ok of ['salut ça va ?', 't’as trouvé le Pokémon du jour ? moi en 3 😎', 'revanche au higher or lower ce soir ?', 'j’ai fait 23 au H/L', 'ok. me voilà', 'la tele', 'Gen 3 ↑']) {
    assert.deepEqual(chatLib.checkBody(ok), { body: ok }, ok);
  }
  for (const bad of ['mon snap c toto', 'ajoute moi sur insta', 'Insta : toto', 'whatsapp ?', 'viens sur discord', '06 12 34 56 78', '0612345678', 'va sur monsite.com', 'monsite point com', 'monsite(.)fr', 'https://x.y', 'www.truc', 'écris à a.b@gmail.com', '@toto123', 'mon tiktok', 'tik tok']) {
    assert.deepEqual(chatLib.checkBody(bad), { error: 'contact' }, bad);
  }
  assert.deepEqual(chatLib.checkBody('   '), { error: 'empty' });
  assert.deepEqual(chatLib.checkBody('é'.repeat(201)), { error: 'long' });
  assert.deepEqual(chatLib.checkBody('😀'.repeat(200)), { body: '😀'.repeat(200) }, 'characters, not bytes');
  assert.deepEqual(chatLib.checkBody('a\u0000b\n\n\n\nc'), { body: 'ab\n\nc' });
});

test('PostgreSQL: friends only, one notification at a time, report, block, 30 days', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'chat_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 3 });
    await db.query(USERS);
    await db.query("INSERT INTO users(discord_id, username) VALUES ('A', 'Kayan'), ('B', 'Sunaii'), ('C', 'Léo')");
    await friendLib.ensureTables(db); await chatLib.ensureTables(db); await chatLib.ensureTables(db);
    const pushed = [];
    const push = async (to, payload) => { pushed.push({ to, ...payload }); return 1; };
    const friends = friendLib.createPlayerFriends({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid });
    const chat = chatLib.createFriendChat({ db, friends, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid, push });
    const A = ids.playerPid('A'), B = ids.playerPid('B'), C = ids.playerPid('C');
    const tick = () => new Promise((r) => setImmediate(r));

    assert.deepEqual(await chat.send('A', { pid: B, body: 'salut' }), { ok: false, error: 'not_friends' }, 'not friends yet');
    await friends.request('A', { pid: B });
    assert.deepEqual(await chat.send('A', { pid: B, body: 'salut' }), { ok: false, error: 'not_friends' }, 'a request is not enough');
    await friends.request('B', { pid: A });

    const first = await chat.send('A', { pid: B, body: '  salut 👋  ' });
    assert.equal(first.ok, true);
    assert.equal(first.message.body, 'salut 👋');
    assert.equal(first.message.mine, true);
    await tick();
    assert.deepEqual(pushed.pop(), { to: 'B', title: '💬 Kayan', body: 'salut 👋', url: '/?chat=' + A, tag: 'pokedle-chat-' + A });
    await chat.send('A', { pid: B, body: 'ça va ?' });
    await tick();
    assert.equal(pushed.length, 0, 'no second notification while the first waits unread');
    assert.deepEqual(await chat.send('A', { pid: B, body: 'mon snap c toto' }), { ok: false, error: 'contact' });
    assert.deepEqual(await chat.send('A', { pid: C, body: 'salut' }), { ok: false, error: 'not_friends' });
    assert.deepEqual(await chat.send('A', { pid: A, body: 'salut' }), { ok: false, error: 'self' });

    const forB = await chat.conversations('B');
    assert.equal(forB.unread, 2);
    assert.equal(forB.conversations[A].unread, 2);
    assert.equal(forB.conversations[A].last.body, 'ça va ?');
    assert.equal(forB.conversations[A].last.mine, false);
    const threadB = await chat.thread('B', { pid: A });
    assert.deepEqual(threadB.messages.map((m) => [m.body, m.mine]), [['salut 👋', false], ['ça va ?', false]]);
    assert.equal((await chat.conversations('B')).unread, 0, 'opening the conversation reads it');
    const reply = await chat.send('B', { pid: A, body: 'oui et toi ?' });
    assert.deepEqual((await chat.thread('A', { pid: B, after: threadB.messages[1].id })).messages.map((m) => m.body), ['oui et toi ?'], 'polling: only what is new');
    void reply;

    // 30 messages per 10 minutes.
    await db.query("INSERT INTO friend_messages(from_id, to_id, body) SELECT 'A', 'B', 'x' FROM generate_series(1, 30)");
    assert.deepEqual(await chat.send('A', { pid: B, body: 'encore' }), { ok: false, error: 'limit' });

    // Report: the last 30 messages are copied, and stay for /admin after the chat is gone.
    assert.deepEqual(await chat.report('B', { pid: A }), { ok: true });
    const reports = await chatLib.adminReports(db);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].reporter_name, 'Sunaii');
    assert.equal(reports[0].reported_name, 'Kayan');
    assert.equal(reports[0].excerpt.length, 30);
    assert.equal(reports[0].excerpt.at(-1).by, 'reported');
    const html = chatLib.adminSectionHtml(reports, (v) => String(v).replace(/</g, '&lt;'));
    assert.match(html, /Signalements \(1 à lire\)/);
    assert.match(html, /<b>Sunaii<\/b> signale <b>Kayan<\/b>/);
    await chatLib.resolveReport(db, reports[0].id);
    assert.doesNotMatch(chatLib.adminSectionHtml(await chatLib.adminReports(db), String), /à lire/);

    // Blocking ends the friendship, so the chat.
    await friends.block('B', { pid: A });
    assert.deepEqual(await chat.send('A', { pid: B, body: 'hé' }), { ok: false, error: 'not_friends' });
    assert.deepEqual(await chat.thread('A', { pid: B }), { ok: true, friends: false, messages: [] });
    assert.deepEqual((await chat.conversations('A')).conversations, {});

    // 30 days for messages, 90 for reports.
    await db.query("UPDATE friend_messages SET created_at = now() - interval '31 days'");
    await db.query("UPDATE friend_reports SET created_at = now() - interval '91 days'");
    await chat.conversations('C');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM friend_messages')).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM friend_reports')).rows[0].n, 0);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});

test('the routes: signed in, same origin to send or report', async () => {
  const express = require('express');
  const app = express();
  const calls = [];
  const chat = new Proxy({}, { get: (_t, name) => async (...args) => { calls.push([name, ...args]); return { ok: true }; } });
  chatLib.mountChatRoutes(app, { express, chat, getUser: (req) => (req.get('x-user') ? { id: req.get('x-user') } : null), log: { error() {} } });
  const server = app.listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/api/chat')).status, 401);
    await fetch(base + '/api/chat/thread?pid=abc&after=5', { headers: { 'x-user': 'A' } });
    assert.deepEqual(calls.at(-1), ['thread', 'A', { pid: 'abc', after: '5' }]);
    const post = (url, body, headers) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user': 'A', ...headers }, body: JSON.stringify(body) });
    assert.equal((await post('/api/chat/send', { pid: 'abc', body: 'salut' }, {})).status, 403);
    assert.equal((await post('/api/chat/send', { pid: 'abc', body: 'salut' }, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('/api/chat/send', { pid: 'abc', body: 'salut', to: 'X' }, { origin: base })).status, 200);
    assert.deepEqual(calls.at(-1), ['send', 'A', { pid: 'abc', body: 'salut' }]);
    await post('/api/chat/report', { pid: 'abc' }, { origin: base });
    assert.deepEqual(calls.at(-1), ['report', 'A', { pid: 'abc' }]);
  } finally { server.close(); }
});

test('wired in: card, friends list, counts, admin, account deletion, privacy', () => {
  const src = read('src/script.10xv.friend-chat.js');
  assert.match(src, /maxlength="' \+ CHAT_MAX \+ '"/);
  assert.match(src, /chatState\.timer = setTimeout\(chatPoll, 4000\);/);
  assert.match(src, /if \(!chatIsOpen\(\)\) \{ chatState\.pid = null; chatRefresh\(\); return; \}/, 'no polling once closed');
  assert.doesNotMatch(src, /\.innerHTML = [^;]*m\.body(?!\))/, 'messages are escaped');
  const friends = read('src/script.10xu.friends.js');
  assert.match(friends, /💬 Écrire/);
  assert.match(friends, /data-action="openFriendChat"/);
  const inbox = read('src/script.10xs.inbox-visibility.js');
  assert.match(inbox, /var chat = typeof chatUnreadCount === 'function' \? chatUnreadCount\(\) : 0;/);
  assert.match(inbox, /\(n\.friends \|\| 0\) \+ \(n\.chat \|\| 0\)\);/);
  const panel = read('lib/admin-panel.js');
  assert.match(panel, /app\.post\("\/admin\/reports\/done", form,/);
  assert.match(panel, /\$\{reportsHtml\}\$\{newsSection\(news, day\)\}/, 'reports first in /admin');
  const server = read('server.js');
  assert.match(server, /reports: \{ module: require\("\.\/lib\/friend-chat"\) \}/);
  assert.match(server, /\["friend_messages", "DELETE FROM friend_messages WHERE from_id = \$1 OR to_id = \$1", \[id\]\]/);
  assert.match(server, /\["friend_reports", "DELETE FROM friend_reports WHERE reporter_id = \$1 OR reported_id = \$1", \[id\]\]/);
  assert.match(read('confidentialite.html'), /les 30 derniers messages de votre discussion sont alors envoyés au créateur de Pokédle/);
});
