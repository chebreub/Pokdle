'use strict';
// V2-REL-01 (7/11/2026, audit GPT) : relâcher un doublon = une confirmation, et une seule exécution par intention.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createBallService, initBallsDb, mountBallRoutes } = require('../lib/poke-balls');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const sql = { skip: !process.env.QA_DATABASE_URL, timeout: 60000 };

async function withDb(run) {
  const { Pool } = require('pg'), schema = 'rel01_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }); let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 8 });
    await initBallsDb(db); await run(db);
  } finally { if (db) await db.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.end(); }
}
const add = (db, who, id, shiny, n) => db.query(
  "INSERT INTO wild_encounters(identity, account_id, day, pokemon_id, shiny, status, throws) SELECT $1, $2, '2026-11-06', $3, $4, 'caught', 1 FROM generate_series(1, $5)",
  [who, who.startsWith('user:') ? who.slice(5) : null, id, shiny, n]);
const owned = async (db, who, id, shiny) => Number((await db.query(
  "SELECT COUNT(*)::int AS n FROM wild_encounters WHERE identity=$1 AND pokemon_id=$2 AND shiny=$3 AND status='caught'", [who, id, shiny])).rows[0].n);
const me = { key: 'user:rel', guestKey: 'guest:rel', accountId: 'rel' };

test('PostgreSQL: ten replays of the same release remove one copy and pay once', sql, () => withDb(async (db) => {
  const balls = createBallService({ db, clock: () => new Date('2026-11-07T12:00:00Z') });
  await balls.state(me);
  await add(db, me.key, 448, true, 3);
  const body = { id: 448, shiny: true, expectedCount: 3, actionId: randomUUID() };
  const replies = await Promise.all(Array.from({ length: 10 }, () => balls.release(me, { ...body })));
  assert.equal(await owned(db, me.key, 448, true), 2, 'one shiny released');
  assert.equal(replies.filter((r) => !r.replayed).length, 1);
  assert.ok(replies.every((r) => r.coins.balance === 1500), 'paid once: 1 500 ₽');
  // Une autre intention, mais faite sur l'ancien écran (×3) : refusée, rien ne bouge.
  await assert.rejects(balls.release(me, { id: 448, shiny: true, expectedCount: 3, actionId: randomUUID() }), /release_changed/);
  assert.equal(await owned(db, me.key, 448, true), 2);
  // Même identifiant, autre contenu : conflit.
  await assert.rejects(balls.release(me, { id: 448, shiny: false, expectedCount: 3, actionId: body.actionId }), /action_conflict/);
  // L'écran à jour (×2) peut relâcher encore un, jamais le dernier.
  await balls.release(me, { id: 448, shiny: true, expectedCount: 2, actionId: randomUUID() });
  await assert.rejects(balls.release(me, { id: 448, shiny: true, expectedCount: 1, actionId: randomUUID() }), /last_one/);
  assert.equal(await owned(db, me.key, 448, true), 1);
}));

test('PostgreSQL + HTTP: a release needs the page’s receipt, count and account', sql, () => withDb(async (db) => {
  const express = require('express'), app = express(); let user = { id: 'rel' };
  mountBallRoutes({ app, express, db, secret: 'local-only', getUser: () => user, readCookies: () => ({}) });
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  const root = 'http://127.0.0.1:' + server.address().port;
  const post = async (p, b) => { const r = await fetch(root + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
  try {
    const scope = (await (await fetch(root + '/api/balls')).json()).actionScope;
    await add(db, 'user:rel', 7, false, 3);
    assert.equal((await post('/api/wild/release', { id: 7 })).body.error, 'reload_required', 'old pages must reload');
    assert.equal((await post('/api/wild/release', { id: 7, actionId: randomUUID(), actionScope: scope })).body.error, 'reload_required', 'count required');
    user = { id: 'other' };
    const other = await post('/api/wild/release', { id: 7, expectedCount: 3, actionId: randomUUID(), actionScope: scope });
    assert.deepEqual([other.status, other.body.error], [409, 'account_changed'], 'account switched in another tab');
    user = { id: 'rel' };
    const ok = await post('/api/wild/release', { id: 7, expectedCount: 3, actionId: randomUUID(), actionScope: scope });
    assert.equal(ok.body.ok, true); assert.equal(ok.body.coinsEarned, 15);
    assert.equal(await owned(db, 'user:rel', 7, false), 2);
  } finally { server.close(); }
}));

test('the album asks before releasing and sends a receipt; cancel sends nothing', () => {
  const src = read('src/script.10xzg.trades.js');
  const ask = src.slice(src.indexOf('function tradeRelease('), src.indexOf('function tradeReleaseConfirm('));
  assert.doesNotMatch(ask, /tradePost|ballPaidAction|fetch\(/, 'the first tap only asks');
  assert.match(ask, /Oui, relâcher/); assert.match(ask, /data-action="openTradeMon"[^>]*>Annuler/);
  assert.match(src, /ballPaidAction\("\/api\/wild\/release", \{ id: Number\(id\), shiny: Boolean\(shiny\), expectedCount: Number\(expectedCount\) \}\)/);
  assert.match(src, /!data\.replayed && typeof awardXp/, 'a replayed answer gives no XP twice');
  assert.match(read('src/script.10xy.poke-balls.js'), /"release_changed", "last_one", "release_limit", "invalid_pokemon"/);
});
