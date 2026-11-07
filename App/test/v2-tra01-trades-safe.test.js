'use strict';
// V2-TRA-01 (7/11/2026, audit GPT) : l'expiration compte au moment d'accepter ; le quota de 3 propositions
// par jour tient sous des appuis simultanés ; une double acceptation ne fait qu'un échange.
const test = require('node:test');
const assert = require('node:assert/strict');
const friendsLib = require('../lib/player-friends');
const trades = require('../lib/wild-trades');
const { initBallsDb } = require('../lib/poke-balls');
const sql = { skip: !process.env.QA_DATABASE_URL, timeout: 60000 };
const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;

async function setup(run) {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const ids = require('../lib/player-ids'); ids.setPlayerIdSecret('test-secret');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'tra01_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 10 });
    await db.query(USERS);
    await db.query("INSERT INTO users(discord_id, username) VALUES ('A', 'Kayan'), ('B', 'Léa')");
    await friendsLib.ensureTables(db); await initBallsDb(db); await trades.ensureTables(db);
    const fr = friendsLib.createPlayerFriends({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid });
    const tr = trades.createWildTrades({ db, friends: fr, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid, push: async () => 1, clock: () => new Date('2026-11-07T12:30:00Z') });
    await fr.request('A', { pid: ids.playerPid('B') });
    await fr.respond('B', { id: (await fr.list('B')).incoming[0].id, accept: true });
    const caught = (who, id, n) => db.query("INSERT INTO wild_encounters(identity, account_id, day, pokemon_id, shiny, status, throws) SELECT $1, $2, '2026-11-06', $3, false, 'caught', 1 FROM generate_series(1, $4)", ['user:' + who, who, id, n]);
    const count = async (who, id) => Number((await db.query("SELECT COUNT(*)::int AS n FROM wild_encounters WHERE identity=$1 AND pokemon_id=$2 AND status='caught'", ['user:' + who, id])).rows[0].n);
    await run({ db, tr, caught, count, B: ids.playerPid('B') });
  } finally { if (db) await db.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {}); await admin.end(); }
}

test('PostgreSQL: an 8-day-old proposal cannot be accepted, even without reloading the list', sql, () => setup(async ({ db, tr, caught, count, B }) => {
  await caught('A', 7, 2); await caught('B', 133, 2);
  const p = await tr.propose('A', { pid: B, give: 7, want: 133 });
  assert.equal(p.ok, true);
  await db.query("UPDATE wild_trades SET created_at = now() - interval '8 days' WHERE id = $1", [p.id]);
  assert.equal((await tr.respond('B', { id: p.id, accept: true })).error, 'expired');
  assert.deepEqual([await count('A', 7), await count('A', 133), await count('B', 7), await count('B', 133)], [2, 0, 0, 2], 'nothing moved');
  assert.equal((await db.query('SELECT status FROM wild_trades WHERE id=$1', [p.id])).rows[0].status, 'expired');
}));

test('PostgreSQL: 4 simultaneous proposals from 0 give at most 3', sql, () => setup(async ({ db, tr, caught, B }) => {
  await caught('A', 7, 2);
  for (const id of [133, 134, 135, 136]) await caught('B', id, 2);
  const out = await Promise.all([133, 134, 135, 136].map((want) => tr.propose('A', { pid: B, give: 7, want })));
  assert.equal(out.filter((o) => o.ok).length, 3);
  assert.deepEqual(out.filter((o) => !o.ok).map((o) => o.error), ['trade_limit']);
  assert.equal(Number((await db.query("SELECT COUNT(*)::int AS n FROM wild_trades WHERE from_id='A'")).rows[0].n), 3);
  // Le même échange envoyé deux fois en même temps n'est inscrit qu'une fois.
  await db.query("UPDATE wild_trades SET day = '2026-11-06', status = 'cancelled'");
  const twice = await Promise.all([1, 2].map(() => tr.propose('A', { pid: B, give: 7, want: 133 })));
  assert.deepEqual(twice.map((o) => o.ok ? 'ok' : o.error).sort(), ['already_proposed', 'ok']);
}));

test('PostgreSQL: a double acceptance makes a single trade', sql, () => setup(async ({ tr, caught, count, B }) => {
  await caught('A', 7, 3); await caught('B', 133, 3);
  const p = await tr.propose('A', { pid: B, give: 7, want: 133 });
  const answers = await Promise.all([1, 2, 3].map(() => tr.respond('B', { id: p.id, accept: true })));
  assert.equal(answers.filter((a) => a.ok).length, 1);
  assert.ok(answers.filter((a) => !a.ok).every((a) => a.error === 'not_found'));
  assert.deepEqual([await count('A', 7), await count('A', 133), await count('B', 7), await count('B', 133)], [2, 1, 1, 2]);
}));
