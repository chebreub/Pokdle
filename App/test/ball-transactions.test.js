'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createBallService, initBallsDb, mountBallRoutes } = require('../lib/poke-balls');
const sql = { skip: !process.env.QA_DATABASE_URL, timeout: 60000 };

async function withSchema(run) {
  const { Pool } = require('pg');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  const schema = 'ball_tx_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 6 });
    await initBallsDb(db);
    await run(db);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    await admin.end();
  }
}
const who = n => ({ key: 'user:' + n, accountId: String(n), guestKey: 'guest:' + n });
const day = '2026-11-03';
const seed = (db, me, amount = 1000) => db.query(
  "INSERT INTO coin_ledger(identity,account_id,day,source,amount) VALUES($1,$2,$3,'test', $4)", [me.key, me.accountId, day, amount]);

test('PostgreSQL: retries debit once, payload conflicts roll back, quoted price is binding', sql, async () => withSchema(async db => {
  let now = new Date(day + 'T12:00:00Z');
  const service = createBallService({ db, clock: () => now });
  const me = who('buy'); await seed(db, me);
  const body = { actionId: randomUUID(), item: 'recharge', expectedPrice: 100 };
  const results = await Promise.all(Array.from({ length: 4 }, () => service.buy(me, body)));
  assert.equal(results.filter(r => !r.replayed).length, 1);
  assert.ok(results.every(r => r.coins.balance === 900 && r.coins.recharges === 1));
  await assert.rejects(() => service.buy(me, { ...body, item: 'poke', expectedPrice: 50 }), /action_conflict/);
  const stale = { ...body, actionId: randomUUID() };
  await assert.rejects(() => service.buy(me, stale), /price_changed/);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ball_actions')).rows[0].n, 1);
  await service.buy(me, { ...stale, expectedPrice: 200 }); // Failed operations do not consume the receipt id.
  now = new Date('2026-11-04T12:00:00Z');
  const replay = await service.buy(me, body);
  assert.equal(replay.replayed, true);
  assert.equal(replay.coins.balance, 700);
  assert.equal(replay.coins.recharges, 0, 'yesterday’s purchase is not executed again today');
  const other = who('other'); await seed(db, other);
  assert.equal((await service.buy(other, body)).replayed, undefined, 'receipts belong to one identity');
}));

test('PostgreSQL: competing fresh purchases cannot overspend or skip the quoted recharge price', sql, async () => withSchema(async db => {
  const service = createBallService({ db, clock: () => new Date(day + 'T12:00:00Z') });
  const me = who('parallel'); await seed(db, me, 100);
  const replies = await Promise.allSettled(Array.from({ length: 4 }, () => service.buy(me,
    { actionId: randomUUID(), item: 'poke', expectedPrice: 50 })));
  assert.equal(replies.filter(r => r.status === 'fulfilled').length, 2);
  assert.equal((await service.state(me)).coins.balance, 0);
  const r = who('recharges'); await seed(db, r);
  const recharges = await Promise.allSettled(Array.from({ length: 3 }, () => service.buy(r,
    { actionId: randomUUID(), item: 'recharge', expectedPrice: 100 })));
  assert.equal(recharges.filter(r => r.status === 'fulfilled').length, 1);
  assert.ok(recharges.filter(r => r.status === 'rejected').every(r => /price_changed/.test(r.reason.message)));
}));

test('PostgreSQL: throws bind to the encounter AND attempt, with receipts across retries', sql, async () => withSchema(async db => {
  let rolls = 0;
  const service = createBallService({ db, clock: () => new Date(day + 'T12:00:00Z'), random: () => { rolls++; return .999; } });
  const me = who('throw'); await service.state(me);
  const e = (await service.encounter(me)).encounter;
  const body = { actionId: randomUUID(), ball: 'poke', encounterId: e.id, expectedThrows: 0 };
  const initial = await Promise.all([service.throwBall(me, body), service.throwBall(me, body)]);
  assert.equal(rolls, 1);
  assert.equal(initial[1].replayed, true);
  const attempts = await Promise.allSettled(Array.from({ length: 3 }, () => service.throwBall(me,
    { ...body, actionId: randomUUID(), expectedThrows: 1 })));
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(rolls, 2);
  await service.skip(me);
  const next = (await service.encounter(me)).encounter;
  await assert.rejects(() => service.throwBall(me, { ...body, actionId: randomUUID() }), /encounter_changed/);
  const replay = await service.throwBall(me, body);
  assert.equal(replay.wild.open.id, next.id);
  assert.equal(replay.wild.open.throws, 0);
  assert.equal(rolls, 2, 'retry never rerolls a capture');
}));

test('PostgreSQL: guest merge caps each day, preserves captures and never consumes account stock', sql, async () => withSchema(async db => {
  const service = createBallService({ db, clock: () => new Date(day + 'T12:00:00Z') });
  const me = who('merge'); await service.state(me);
  await db.query("INSERT INTO ball_gains(identity,account_id,day,source,ball) SELECT $1,$2,$3,'mode:'||n,'poke' FROM generate_series(1,10) n", [me.key, me.accountId, day]);
  const before = await service.state(me);
  await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,'gift','poke'),($1,'2026-11-02','gift','great')", [me.guestKey, day]);
  await db.query("INSERT INTO wild_encounters(identity,day,pokemon_id,status,throws,used_poke) VALUES($1,$2,10,'caught',1,1)", [me.guestKey, day]);
  const merged = await Promise.all([service.state(me), service.state(me)]);
  for (const s of merged) {
    assert.equal(s.today, 10);
    assert.equal(s.bag.poke, before.bag.poke, 'excluded spent guest gain must not debit existing account stock');
    assert.equal(s.bag.great, before.bag.great + 1, 'a different day’s unspent gain is retained');
    assert.equal(s.wild.caught, 1);
  }
  assert.equal((await db.query('SELECT poke FROM ball_merge_credits')).rows[0].poke, 1);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ball_gains WHERE identity=$1', [me.guestKey])).rows[0].n, 0);
  // Repeated guest sessions can’t add spendable stock once the account’s quota is full.
  for (let i = 0; i < 2; i++) {
    await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,'gift','poke')", [me.guestKey, day]);
    assert.equal((await service.state(me)).bag.poke, before.bag.poke);
  }
  // A duplicate source below the cap is excluded too; its spent Ball is still offset.
  const duplicate = who('duplicate'); await service.gift(duplicate);
  const prior = await service.state(duplicate);
  await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,'gift','poke')", [duplicate.guestKey, day]);
  await db.query("INSERT INTO wild_encounters(identity,day,pokemon_id,status,throws,used_poke) VALUES($1,$2,19,'caught',1,1)", [duplicate.guestKey, day]);
  assert.equal((await service.state(duplicate)).bag.poke, prior.bag.poke);
}));

test('PostgreSQL + HTTP: old clients cannot bypass receipts or quoted prices', sql, async () => withSchema(async db => {
  const express = require('express'), app = express();
  mountBallRoutes({ app, express, db, secret: 'local-test-only', getUser: () => ({ id: 'http' }), readCookies: () => ({}), clock: () => new Date(day + 'T12:00:00Z') });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const path of ['/api/shop/buy', '/api/wild/throw', '/api/shop/buy/', '/API/WILD/THROW']) {
      const r = await fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: 'poke', ball: 'poke' }) });
      assert.equal(r.status, 400); assert.equal((await r.json()).error, 'reload_required');
    }
    const r = await fetch(url + '/api/shop/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: 'poke', actionId: randomUUID() }) });
    assert.equal(r.status, 400);
    const switched = await fetch(url + '/api/shop/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: 'poke', expectedPrice: 50, actionId: randomUUID(), actionScope: 'a-different-account' }) });
    assert.equal(switched.status, 409);
    assert.equal((await switched.json()).error, 'account_changed');
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM coin_ledger')).rows[0].n, 0);
    await seed(db, who('http'), 100);
    const current = await (await fetch(url + '/api/balls')).json();
    const purchase = { item: 'poke', expectedPrice: 50, actionId: randomUUID(), actionScope: current.actionScope };
    for (const path of ['/api/shop/buy', '/API/SHOP/BUY/']) {
      const reply = await fetch(url + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(purchase)});
      assert.equal(reply.status, 200);
      assert.equal((await reply.json()).coins.balance, 50);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
}));
