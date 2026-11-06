'use strict';
// Doublons (3/11/2026) : relâcher un doublon (jamais le dernier) et l'échanger avec un ami, qui accepte.
const test = require('node:test');
const assert = require('node:assert/strict');
const friendsLib = require('../lib/player-friends');
const trades = require('../lib/wild-trades');
const { createBallService, initBallsDb, RELEASES_PER_DAY } = require('../lib/poke-balls');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;

async function withSchema(prefix, run) {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = prefix + randomUUID().replaceAll('-', '');
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
const caught = (db, who, id, shiny = false, n = 1) => db.query(
  "INSERT INTO wild_encounters(identity, account_id, day, pokemon_id, shiny, status, throws) SELECT $1, $2, '2026-11-02', $3, $4, 'caught', 1 FROM generate_series(1, $5)",
  [who, who.startsWith('user:') ? who.slice(5) : null, id, shiny, n]);
const count = async (db, who, id, shiny = false) => Number((await db.query(
  "SELECT COUNT(*)::int AS n FROM wild_encounters WHERE identity = $1 AND pokemon_id = $2 AND shiny = $3 AND status = 'caught'", [who, id, shiny])).rows[0].n);

test('PostgreSQL: a duplicate can be released, never the last one, 10 a day', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  await withSchema('lacher_', async (db) => {
    const balls = createBallService({ db, clock: () => new Date('2026-11-03T12:30:00Z') });
    await initBallsDb(db);
    const g = { key: 'guest:r1', guestKey: 'guest:r1', accountId: null };
    await caught(db, 'guest:r1', 7, false, 3); await caught(db, 'guest:r1', 7, true, 1);
    let s = await balls.release(g, { id: 7 });
    assert.deepEqual(s.released, { id: 7, shiny: false });
    assert.deepEqual(s.captures, [{ id: 7, normal: 2, shiny: 1 }]);
    await balls.release(g, { id: 7 });
    await assert.rejects(balls.release(g, { id: 7 }), /last_one/, 'the last one stays');
    await assert.rejects(balls.release(g, { id: 7, shiny: true }), /last_one/, 'a single shiny stays too');
    await assert.rejects(balls.release(g, { id: 2000 }), /invalid_pokemon/);
    assert.equal((await balls.state(g)).wild.today, 0, 'releasing is not one of the day\'s encounters');
    assert.deepEqual((await balls.collection(g)).shinyLog.map((e) => e.caught), [true]);
    await caught(db, 'guest:r1', 10, false, RELEASES_PER_DAY + 3);
    for (let i = 0; i < RELEASES_PER_DAY - 2; i++) await balls.release(g, { id: 10 });
    await assert.rejects(balls.release(g, { id: 10 }), /release_limit/);
  });
});

test('PostgreSQL: friends swap duplicates, shiny for shiny, 3 a day, re-checked on accept', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  await withSchema('echange_', async (db) => {
    await db.query(USERS);
    await db.query("INSERT INTO users(discord_id, username) VALUES ('A', 'Kayan'), ('B', 'Léa'), ('C', 'Léo')");
    await friendsLib.ensureTables(db);
    await initBallsDb(db);
    await trades.ensureTables(db); await trades.ensureTables(db);
    const fr = friendsLib.createPlayerFriends({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid });
    const pushed = [];
    const tr = trades.createWildTrades({ db, friends: fr, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid,
      push: async (to, p) => { pushed.push({ to, title: p.title }); return 1; }, clock: () => new Date('2026-11-03T12:30:00Z') });
    const A = ids.playerPid('A'), B = ids.playerPid('B'), C = ids.playerPid('C');
    await fr.request('A', { pid: B });
    await fr.respond('B', { id: (await fr.list('B')).incoming[0].id, accept: true });

    await caught(db, 'user:A', 7, false, 3); await caught(db, 'user:A', 25, true, 2); await caught(db, 'user:A', 1, false, 1);
    await caught(db, 'user:B', 133, false, 2); await caught(db, 'user:B', 151, true, 2); await caught(db, 'user:C', 4, false, 2);

    assert.deepEqual((await tr.friendDupes('A', C)), { ok: false, error: 'not_friends', status: 403 }, 'only friends see each other\'s duplicates');
    const seen = await tr.friendDupes('A', B);
    assert.deepEqual(seen.dupes, [{ id: 133, normal: 1, shiny: 0 }, { id: 151, normal: 0, shiny: 1 }]);
    assert.deepEqual(seen.mine.map((d) => d.id), [7, 25]);

    assert.equal((await tr.propose('A', { pid: C, give: 7, want: 4 })).error, 'not_friends');
    assert.equal((await tr.propose('A', { pid: B, give: 1, want: 133 })).error, 'not_a_duplicate', 'never the last one');
    assert.equal((await tr.propose('A', { pid: B, give: 7, want: 151 })).error, 'friend_not_a_duplicate', 'a normal is not traded for a shiny');
    assert.equal((await tr.propose('A', { pid: B, give: 7, want: 7 })).error, 'same_pokemon');
    const first = await tr.propose('A', { pid: B, give: 7, want: 133 });
    assert.equal(first.ok, true);
    assert.equal((await tr.propose('A', { pid: B, give: 7, want: 133 })).error, 'already_proposed');
    await new Promise((r) => setImmediate(r));
    assert.match(pushed.at(-1).title, /Kayan te propose un échange/);

    let forB = await tr.list('B');
    assert.equal(forB.incoming, 1);
    assert.deepEqual([forB.trades[0].giveId, forB.trades[0].wantId, forB.trades[0].mine, forB.trades[0].other.username], [7, 133, false, 'Kayan']);
    assert.equal((await tr.respond('A', { id: first.id, accept: true })).error, 'not_found', 'only the asked friend answers');
    const done = await tr.respond('B', { id: first.id, accept: true });
    assert.deepEqual(done, { ok: true, status: 'accepted', received: { id: 7, shiny: false } });
    assert.deepEqual([await count(db, 'user:A', 7), await count(db, 'user:A', 133), await count(db, 'user:B', 7), await count(db, 'user:B', 133)], [2, 1, 1, 1]);
    const balls = createBallService({ db, clock: () => new Date('2026-11-03T12:30:00Z') });
    const bWho = { key: 'user:B', guestKey: 'guest:x', accountId: 'B' };
    assert.equal((await balls.state(bWho)).wild.today, 0, 'a traded Pokémon is not one of the day\'s encounters');
    assert.deepEqual((await tr.list('A')).news, 1);
    await tr.seen('A'); assert.equal((await tr.list('A')).news, 0);

    // Shiny contre shiny ; un échange devenu impossible échoue proprement.
    const shiny = await tr.propose('A', { pid: B, give: 25, want: 151, shiny: true });
    assert.equal(shiny.ok, true);
    await db.query("UPDATE wild_encounters SET status = 'released' WHERE id = (SELECT id FROM wild_encounters WHERE identity = 'user:B' AND pokemon_id = 151 LIMIT 1)");
    assert.equal((await tr.respond('B', { id: shiny.id, accept: true })).error, 'no_longer_available');
    assert.equal(await count(db, 'user:A', 25, true), 2, 'nothing moved');

    // 3 propositions par jour ; refuser et annuler.
    assert.equal((await tr.propose('A', { pid: B, give: 7, want: 133 })).error, 'friend_not_a_duplicate');
    await caught(db, 'user:B', 133, false, 2);
    const third0 = await tr.propose('A', { pid: B, give: 7, want: 133 });
    assert.equal(third0.ok, true, 'the 3rd proposal of the day');
    await tr.cancel('A', { id: third0.id });
    assert.equal((await tr.propose('A', { pid: B, give: 7, want: 133 })).error, 'trade_limit', 'a cancelled proposal still counts');
    assert.equal((await tr.list('A')).left, 0);
    await db.query("UPDATE wild_trades SET day = '2026-11-02'");
    const third = await tr.propose('A', { pid: B, give: 7, want: 133 });
    assert.deepEqual(await tr.respond('B', { id: third.id, accept: false }), { ok: true, status: 'declined' });
    const fourth = await tr.propose('A', { pid: B, give: 7, want: 133 });
    assert.deepEqual(await tr.cancel('A', { id: fourth.id }), { ok: true });
    assert.equal((await tr.respond('B', { id: fourth.id, accept: true })).error, 'not_found');
  });
});

test('PostgreSQL: DEX-01 capture history survives cessions and excludes received trades and failed encounters', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  await withSchema('dexstates_', async (db) => {
    await initBallsDb(db);
    const balls = createBallService({ db, clock: () => new Date('2026-11-06T12:00:00Z') });
    const who = { key: 'guest:dex', guestKey: 'guest:dex', accountId: null };
    for (const [id,kind,status,shiny] of [[25,'trade','caught',false],[4,'wild','released',false],[4,'wild','traded',true],[7,'legend','caught',false],[8,'trade','released',false],[9,'trade','traded',true],[10,'wild','fled',false],[11,'wild','open',false]]) {
      await db.query("INSERT INTO wild_encounters(identity,day,pokemon_id,kind,status,shiny) VALUES ($1,'2026-11-06',$2,$3,$4,$5)", [who.key,id,kind,status,shiny]);
    }
    await caught(db,'guest:someone-else',150);
    const before = (await db.query('SELECT * FROM wild_encounters ORDER BY id')).rows;
    const state = await balls.collection(who);
    assert.deepEqual(state.captures,[{id:7,normal:1,shiny:0},{id:25,normal:1,shiny:0}]);
    assert.deepEqual(state.captureHistory,[{id:4,normal:1,shiny:1},{id:7,normal:1,shiny:0}]);
    assert.deepEqual((await db.query('SELECT * FROM wild_encounters ORDER BY id')).rows,before,'reading the states never changes encounters');
    assert.deepEqual((await balls.collection(who)).captureHistory,state.captureHistory,'repeated reads are stable');
  });
});
