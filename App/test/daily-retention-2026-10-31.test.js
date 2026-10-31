'use strict';
// Return of players (31/10/2026), from the Pokémon du jour plays the game already keeps.
const test = require('node:test');
const assert = require('node:assert/strict');
const { dailyRetention } = require('../lib/daily-retention');
const { initDailyDb, nextDay } = require('../lib/daily-game');

test('PostgreSQL: next day, within 7 days, and new players who came back', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'ret_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 2 });
    await initDailyDb(db, new Date('2026-10-10T10:00:00Z'));
    const d = (n) => nextDay('2026-10-01', n - 1);
    for (let n = 1; n <= 10; n++) await db.query('INSERT INTO daily_rounds(day,secret_id) VALUES($1,25) ON CONFLICT DO NOTHING', [d(n)]);
    const play = (who, n, status = 'won') => db.query("INSERT INTO daily_plays(identity,day,guessed,status) VALUES($1,$2,'[25]',$3)", [who, d(n), status]);
    await play('user:A', 1); await play('user:A', 2);
    await play('guest:B', 1);
    await db.query("INSERT INTO daily_plays(identity,day) VALUES('guest:B',$1)", [d(2)]); // opened the page, no guess: not a play
    await play('user:C', 1, 'abandoned'); await play('user:C', 5);
    await play('user:D', 1); await play('user:D', 3);
    const r = await dailyRetention(db, d(1), d(10));
    assert.deepEqual(r.nextDay, { back: 1, base: 7, rate: 14 }, 'only A played the day after');
    assert.deepEqual(r.week, { back: 3, base: 6, rate: 50 }, 'days up to the 3rd have a full week after them');
    assert.deepEqual(r.newWeek, { back: 3, base: 4, rate: 75 }, 'A, C and D came back after their first day; B did not');
    assert.deepEqual(await dailyRetention(db, d(9), d(10)), { nextDay: { back: 0, base: 0, rate: null }, week: { back: 0, base: 0, rate: null }, newWeek: { back: 0, base: 0, rate: null } });
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});
