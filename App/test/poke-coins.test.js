'use strict';
// 💰 Pokédollars et 🏪 boutique (3/11/2026) : compte obligatoire, gains plafonnés, recharge qui double, Balls achetées hors plafond.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBallService, initBallsDb, COIN_PLAY_CAP, SHOP_PRICES, rechargePrice } = require('../lib/poke-balls');
const { issuePartyRewardProof } = require('../lib/party-rewards');

test('shop prices: the original ones, the recharge doubles each time', () => {
  assert.deepEqual(SHOP_PRICES, { recharge: 100, poke: 50, great: 120, ultra: 300 });
  assert.deepEqual([0, 1, 2, 3].map(rechargePrice), [100, 200, 400, 800]);
  assert.equal(COIN_PLAY_CAP, 2000);
});

async function withSchema(run) {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'coins_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await run(db);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
}

test('PostgreSQL: Pokédollars are earned with an account, spent at the shop, never below zero', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  await withSchema(async (db) => {
    const now = new Date('2026-11-03T08:30:00Z'); // 9 h 30 à Paris : 12 rencontres ouvertes
    const balls = createBallService({ db, clock: () => now, secret: 'test-secret' });
    await initBallsDb(db);
    await db.query('CREATE TABLE daily_plays(identity TEXT, day DATE, status TEXT)');

    // Sans compte : pas de ₽, et la boutique demande un compte.
    const guest = { key: 'guest:c1', guestKey: 'guest:c1', accountId: null };
    let s = await balls.state(guest);
    await assert.rejects(balls.earn(guest, { mode: 'odd', result: 'win', score: 14 }), /verified_game_required/);
    assert.deepEqual([s.coins.enabled, s.coins.balance, s.coinsAdded.length], [false, 0, 0]);
    await assert.rejects(balls.buy(guest, { item: 'poke' }), /account_required/);

    const me = { key: 'user:7', guestKey: 'guest:c2', accountId: '7' };
    // Aucun gain, même une Ball, ne provient d'un résultat inventé côté navigateur.
    await assert.rejects(balls.earn(me, { mode: 'odd', result: 'win', score: 14 }), /verified_game_required/);
    await assert.rejects(balls.earn(me, { mode: 'order', result: 'loss', score: 9 }), /verified_game_required/);
    s = await balls.state(me);
    assert.deepEqual([s.coins.balance, s.coins.today, s.coins.played], [0, 0, 0]);
    // 🎉 Party Room : 150 ₽ + 1 Poké Ball, une fois par jour.
    const bagBefore = s.bag.poke;
    await assert.rejects(balls.earn(me, { mode: 'party' }), /party_proof_required/);
    const room = {status:'complete',rewardRunId:'b'.repeat(32),completedAt:now.getTime(),
      players:[{rewardIdentity:'user:7'},{rewardIdentity:'guest:other'}]};
    const partyProof = issuePartyRewardProof('test-secret', room, 'user:7', '2026-11-03');
    s = await balls.earn(me, { mode: 'party', partyProof });
    assert.deepEqual(s.coinsAdded, [{ source: 'day:party', amount: 150 }]);
    assert.equal(s.bag.poke, bagBefore + 1);
    s = await balls.earn(me, { mode: 'party', partyProof });
    assert.deepEqual([s.coinsAdded.length, s.coins.balance], [0, 150]);
    assert.ok(s.coins.done.includes('party'));

    // Le Pokémon du jour : 300 ₽ une seule fois, lu dans sa table.
    await db.query("INSERT INTO daily_plays VALUES('user:7','2026-11-03','won')");
    s = await balls.state(me);
    assert.deepEqual(s.coinsAdded, [{ source: 'day:daily', amount: 300 }]);
    assert.deepEqual(s.coins.done.sort(), ['daily', 'party']);
    s = await balls.state(me);
    assert.deepEqual([s.coinsAdded.length, s.coins.balance], [0, 450], 'not paid twice');

    // De quoi tester la boutique (les gains des modes vérifiés sont testés dans verified-*.test.js).
    await db.query("INSERT INTO coin_ledger(identity,account_id,day,source,amount) VALUES('user:7','7','2026-11-03','admin:test',2000)");
    s = await balls.state(me);
    assert.equal(s.coins.balance, 300 + 150 + 2000);
    // Boutique : 3 Poké Balls = 150 ₽, hors du plafond des 10 Balls du jour.
    const before = s;
    s = await balls.buy(me, { item: 'poke', qty: 3 });
    assert.deepEqual(s.bought, { item: 'poke', qty: 3, price: 150 });
    assert.equal(s.bag.poke, before.bag.poke + 3);
    assert.equal(s.today, before.today, 'bought Balls are not in the 10 a day');
    assert.equal(s.coins.balance, 2300);
    await assert.rejects(balls.buy(me, { item: 'master' }), /invalid_item/);
    await assert.rejects(balls.buy(me, { item: 'ultra', qty: 11 }), /invalid_qty/);

    // Recharge : +4 rencontres tout de suite, 100 puis 200 ₽.
    const left = s.wild.left;
    s = await balls.buy(me, { item: 'recharge' });
    assert.deepEqual([s.bought.price, s.wild.left, s.wild.max, s.coins.rechargePrice], [100, left + 4, 28, 200]);
    s = await balls.buy(me, { item: 'recharge' });
    assert.deepEqual([s.bought.price, s.wild.left, s.coins.balance], [200, left + 8, 2000]);

    // Pas assez de ₽ : rien ne bouge.
    await assert.rejects(balls.buy(me, { item: 'ultra', qty: 7 }), /not_enough_coins/);
    assert.equal((await balls.state(me)).coins.balance, 2000);

    // Le lendemain : la recharge repart à 100 ₽, le solde reste.
    const tomorrow = createBallService({ db, clock: () => new Date('2026-11-04T08:30:00Z') });
    s = await tomorrow.state(me);
    assert.deepEqual([s.coins.balance, s.coins.today, s.coins.rechargePrice, s.wild.left], [2000, 0, 100, 12]);
  });
});

test('PostgreSQL: a released duplicate pays 15 ₽, a shiny 1 500 ₽ (with an account only)', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  await withSchema(async (db) => {
    const balls = createBallService({ db, clock: () => new Date('2026-11-03T12:30:00Z') });
    await initBallsDb(db);
    const add = (who, id, shiny, n) => db.query(
      "INSERT INTO wild_encounters(identity, account_id, day, pokemon_id, shiny, status, throws) SELECT $1, $2, '2026-11-02', $3, $4, 'caught', 1 FROM generate_series(1, $5)",
      [who, who.startsWith('user:') ? who.slice(5) : null, id, shiny, n]);
    const me = { key: 'user:9', guestKey: 'guest:r9', accountId: '9' };
    await add('user:9', 7, false, 2); await add('user:9', 6, true, 2);
    assert.equal((await balls.release(me, { id: 7 })).coinsEarned, 15);
    const s = await balls.release(me, { id: 6, shiny: true });
    assert.deepEqual([s.coinsEarned, s.coins.balance], [1500, 1515]);
    const guest = { key: 'guest:r8', guestKey: 'guest:r8', accountId: null };
    await add('guest:r8', 7, false, 2);
    assert.equal((await balls.release(guest, { id: 7 })).coinsEarned, 0);
  });
});
