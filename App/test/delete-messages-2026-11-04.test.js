'use strict';
// 🗑 Supprimer des messages (4/11/2026) : dans la discussion entre amis (pour tout le monde / pour moi,
// effacer la discussion) et dans « Mes messages » (un message ou tous, chez le joueur seulement).
const test = require('node:test');
const assert = require('node:assert/strict');
const chatLib = require('../lib/friend-chat');
const friendLib = require('../lib/player-friends');
const messages = require('../lib/player-messages');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;
const sql = { skip: !process.env.QA_DATABASE_URL, timeout: 30000 };
async function withSchema(run) {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'delmsg_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 3 });
    await db.query(USERS);
    await db.query("INSERT INTO users(discord_id, username, created_at) VALUES ('A', 'Kayan', now() - interval '1 day'), ('B', 'Sacha', now() - interval '1 day')");
    await run(db);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
}

test('PostgreSQL: delete for everyone (own messages only), for me, clear the discussion; a report still copies the real text', sql, () => withSchema(async (db) => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  await friendLib.ensureTables(db); await chatLib.ensureTables(db); await chatLib.ensureTables(db);
  const friends = friendLib.createPlayerFriends({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid });
  const chat = chatLib.createFriendChat({ db, friends, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid });
  const A = ids.playerPid('A'), B = ids.playerPid('B');
  await friends.request('A', { pid: B }); await friends.request('B', { pid: A });
  const m1 = (await chat.send('A', { pid: B, body: 'salut' })).message;
  const m2 = (await chat.send('A', { pid: B, body: 'oups mauvais message' })).message;
  const m3 = (await chat.send('B', { pid: A, body: 'ok' })).message;

  // For everyone: only the author, and both see « deleted » (no text).
  assert.deepEqual(await chat.remove('B', { pid: A, id: m2.id, scope: 'all' }), { ok: false, error: 'not_found' }, 'not his message');
  assert.deepEqual(await chat.remove('A', { pid: B, id: m2.id, scope: 'all' }), { ok: true });
  const seenByB = (await chat.thread('B', { pid: A })).messages.find((m) => m.id === m2.id);
  assert.deepEqual([seenByB.deleted, seenByB.body], [true, '']);
  const poll = await chat.thread('B', { pid: A, after: m1.id });
  assert.ok(poll.deleted.includes(m2.id), 'an open window learns about it while polling');

  // For me: hidden on my side only.
  assert.deepEqual(await chat.remove('B', { pid: A, id: m1.id, scope: 'me' }), { ok: true });
  assert.deepEqual((await chat.thread('B', { pid: A })).messages.map((m) => m.id), [m2.id, m3.id]);
  assert.deepEqual((await chat.thread('A', { pid: B })).messages.map((m) => m.id), [m1.id, m2.id, m3.id]);
  assert.deepEqual(await chat.remove('A', { pid: B, id: m1.id, scope: 'nope' }), { ok: false, error: 'invalid' });

  // A report still gets the real text, marked as deleted.
  assert.deepEqual(await chat.report('B', { pid: A }), { ok: true });
  const excerpt = (await db.query('SELECT excerpt FROM friend_reports')).rows[0].excerpt;
  assert.deepEqual(excerpt.find((m) => m.deleted), { by: 'reported', body: 'oups mauvais message', at: excerpt.find((m) => m.deleted).at, deleted: true });

  // Clear: my window is empty, my friend keeps his, my list has no conversation left.
  assert.equal((await chat.clear('A', { pid: B })).ok, true);
  assert.deepEqual((await chat.thread('A', { pid: B })).messages, []);
  assert.equal((await chat.thread('B', { pid: A })).messages.length, 2);
  assert.deepEqual((await chat.conversations('A')).conversations, {});
  const next = (await chat.send('B', { pid: A, body: 're' })).message;
  assert.deepEqual((await chat.thread('A', { pid: B })).messages.map((m) => m.id), [next.id], 'new messages come back');
}));

test('PostgreSQL: « Mes messages » hides one or all for this player only', sql, () => withSchema(async (db) => {
  await messages.ensureTables(db); await messages.ensureTables(db);
  const one = (await messages.sendMessage(db, { to: 'A', body: 'Bienvenue sur Pokédle !' })).id;
  const all = (await messages.sendMessage(db, { to: null, body: 'Nouveau : les hautes herbes' })).id;
  assert.deepEqual((await messages.history(db, 'A')).map((m) => m.id).sort(), [one, all].sort());
  assert.deepEqual(await messages.hideMessages(db, 'A', { id: one }), { ok: true, hidden: 1 });
  assert.deepEqual((await messages.history(db, 'A')).map((m) => m.id), [all]);
  assert.deepEqual((await messages.inbox(db, 'A')).map((m) => m.id), [all], 'a hidden message counts as read');
  assert.deepEqual(await messages.hideMessages(db, 'B', { id: one }), { error: 'Message introuvable.' }, 'not his');
  assert.equal((await messages.hideMessages(db, 'A', { all: true })).ok, true);
  assert.deepEqual(await messages.history(db, 'A'), []);
  assert.deepEqual((await messages.history(db, 'B')).map((m) => m.id), [all], 'the others keep theirs');
}));
