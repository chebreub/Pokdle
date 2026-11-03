'use strict';
// « Mes défis » rangé (3/11/2026) : effacer de sa liste un défi fini, tout effacer, annuler un défi envoyé encore ouvert.
const test = require('node:test');
const assert = require('node:assert/strict');
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

test('PostgreSQL: each side erases a finished challenge from its own list; an open one is cancelled, not erased', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  await withSchema('tidy_', async (db) => {
    await db.query(USERS); await db.query(SCORES);
    await db.query("INSERT INTO users(discord_id, username) VALUES ('A', 'Kayan'), ('B', 'Sacha'), ('C', 'Ondine')");
    await db.query("INSERT INTO scores(discord_id, mode, score) VALUES ('A', 'quiz', 12), ('A', 'higherlower', 23)");
    await lib.ensureTables(db); await lib.ensureTables(db);
    const duels = lib.createPlayerChallenges({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid });
    const B = ids.playerPid('B'), C = ids.playerPid('C');
    const won = await duels.create('A', { pid: B, mode: 'quiz', phrase: 0 });
    const open = await duels.create('A', { pid: C, mode: 'quiz', phrase: 0 });
    const toB = await duels.create('A', { pid: B, mode: 'higherlower', phrase: 0 });
    await duels.afterResult('B', 'quiz', 13);
    const listed = async (who) => (await duels.list(who)).challenges.map((c) => c.id).sort();

    // A finished challenge: Sacha erases it, Kayan still sees it until he erases it too.
    assert.equal((await duels.hide('B', { ids: [won.id] })).hidden, 1);
    assert.deepEqual(await listed('B'), [toB.id]);
    assert.ok((await listed('A')).includes(won.id));
    // An open one cannot be erased (refuse or cancel it first).
    assert.equal((await duels.hide('B', { ids: [toB.id] })).hidden, 0);
    assert.equal((await duels.hide('C', { ids: [open.id] })).hidden, 0);
    // « Effacer tous les défis terminés » leaves the open ones.
    assert.equal((await duels.hide('A', { finished: true })).hidden, 1);
    assert.deepEqual(await listed('A'), [open.id, toB.id].sort());
    assert.deepEqual(await duels.hide('A', {}), { ok: false, error: 'nothing' });

    // Cancel: only the sender, only an open one; it leaves both lists and still counts in the day's sends.
    assert.equal((await duels.cancel('C', { ids: [open.id] })).cancelled, 0);
    assert.equal((await duels.cancel('A', { ids: [open.id, toB.id, won.id] })).cancelled, 2);
    assert.deepEqual(await listed('A'), []);
    assert.deepEqual(await listed('C'), []);
    assert.equal((await duels.options('A')).left, lib.PER_DAY - 3);
    assert.deepEqual(await duels.afterResult('B', 'higherlower', 99), [], 'a cancelled challenge cannot be won');
  });
});

test('the routes: erase and cancel need a signed-in player and the same origin', async () => {
  const express = require('express');
  const app = express();
  const calls = [];
  const challenges = new Proxy({}, { get: (_t, name) => async (...args) => { calls.push([name, ...args]); return { ok: true }; } });
  lib.mountChallengeRoutes(app, { express, challenges, getUser: (req) => (req.get('x-user') ? { id: req.get('x-user') } : null), log: { error() {} } });
  const server = app.listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const post = (path, headers, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    assert.equal((await post('/api/challenges/hide', { origin: base }, { ids: [1] })).status, 401);
    assert.equal((await post('/api/challenges/hide', { 'x-user': 'A' }, { ids: [1] })).status, 403);
    assert.equal((await post('/api/challenges/hide', { 'x-user': 'A', origin: base }, { ids: [1, 2], finished: 'yes' })).status, 200);
    assert.deepEqual(calls.at(-1), ['hide', 'A', { ids: [1, 2], finished: false }]);
    assert.equal((await post('/api/challenges/cancel', { 'x-user': 'A', origin: base }, { ids: [3] })).status, 200);
    assert.deepEqual(calls.at(-1), ['cancel', 'A', { ids: [3] }]);
  } finally { server.close(); }
});
