'use strict';
// « Niveau d'un joueur » (31/10/2026): Kayan fell from level 73 to 1 while the runaway XP was being
// fixed. The admin puts the level back from /admin; each device takes it at its next visit instead of
// adding its own XP to it, and a copy made before it never replaces it online.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const admin = require('../lib/admin-panel');
const level = require('../lib/player-level-admin');
const { xpSetAtFromProfileData } = require('../lib/profile-sync');

function merge() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src/script.07a.profile-merge.js'), 'utf8').split('// Repair (31/10/2026)')[0];
  return Function(code + '; return { mergeSyncBlobs };')();
}
const blob = (profile) => ({ profile: JSON.stringify(profile) });
const xpOf = (b) => { const { xp, xpSetAt } = JSON.parse(b.profile); return xpSetAt === undefined ? { xp } : { xp, xpSetAt }; };

test('a level put back by the admin wins over a copy made before it, from either side', () => {
  const { mergeSyncBlobs } = merge();
  const online = blob({ xp: 131400, xpSetAt: 5000 });
  // The phone at level 1 with a little XP of today: the level put back wins, nothing is added to it.
  assert.deepEqual(xpOf(mergeSyncBlobs(online, blob({ xp: 120 }), blob({ xp: 0 }))), { xp: 131400, xpSetAt: 5000 });
  assert.deepEqual(xpOf(mergeSyncBlobs(blob({ xp: 120 }), online, blob({ xp: 0 }))), { xp: 131400, xpSetAt: 5000 }, 'same when the device copy leads (409)');
  // A browser that brought back its own old XP meanwhile: the two restorations never add up.
  assert.equal(xpOf(mergeSyncBlobs(online, blob({ xp: 131400 }), blob({ xp: 0 }))).xp, 131400);
  // Once both copies took it, progress adds up again from the common copy.
  assert.equal(xpOf(mergeSyncBlobs(blob({ xp: 131500, xpSetAt: 5000 }), blob({ xp: 131450, xpSetAt: 5000 }), blob({ xp: 131400, xpSetAt: 5000 }))).xp, 131550);
  // A common copy from before it is not common: the higher one, never doubled.
  assert.equal(xpOf(mergeSyncBlobs(blob({ xp: 131500, xpSetAt: 5000 }), blob({ xp: 131450, xpSetAt: 5000 }), blob({ xp: 0 }))).xp, 131500);
  // A second level put back wins over the first.
  assert.deepEqual(xpOf(mergeSyncBlobs(blob({ xp: 140000, xpSetAt: 5000 }), blob({ xp: 2450, xpSetAt: 7000 }), null)), { xp: 2450, xpSetAt: 7000 });
  // Players the admin never touched merge as before.
  assert.equal(xpOf(mergeSyncBlobs(blob({ xp: 300 }), blob({ xp: 7 }), blob({ xp: 0 }))).xp, 307);
});

test('the server reads the mark from the profile only', () => {
  assert.equal(xpSetAtFromProfileData({ profile: '{"xp":131400,"xpSetAt":1761930000000}' }), 1761930000000);
  assert.equal(xpSetAtFromProfileData({ profile: '{"xp":12}' }), 0);
  assert.equal(xpSetAtFromProfileData({ profile: '{"xpSetAt":"oops"}' }), 0);
  assert.equal(xpSetAtFromProfileData({ profile: 'not json' }), 0);
  assert.equal(xpSetAtFromProfileData(null), 0);
  assert.equal(level.xpForLevel(73), 131400);
  assert.equal(level.xpForLevel(1), 0);
  assert.equal(level.xpForLevel(100), 247500, 'level 100 stays under the ceiling of a sound copy');
});

async function serve(t, db) {
  const app = express();
  const getSessionUser = (req) => (req.get('x-test-user') ? { id: req.get('x-test-user'), username: 'Kayan' } : null);
  admin.mountAdminRoutes(app, { express, db, ready: Promise.resolve(Boolean(db)), getSessionUser, adminIds: new Set(['42']), today: () => '2026-10-31', log: { error() {} } });
  const listener = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise((resolve) => listener.close(resolve)));
  const base = 'http://127.0.0.1:' + listener.address().port;
  const post = (user, fields, origin = base) => fetch(base + '/admin/level', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-test-user': user, ...(origin ? { Origin: origin } : {}) },
    body: new URLSearchParams(fields).toString(),
  });
  return { post, panel: () => fetch(base + '/admin', { headers: { 'x-test-user': '42' } }).then((r) => r.text()) };
}

test('PostgreSQL: the admin puts a level back from /admin', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async (t) => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const schema = 'level_' + randomUUID().replaceAll('-', ''), root = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  let db;
  try {
    await root.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT '',data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_login TIMESTAMPTZ NOT NULL DEFAULT now(),partner_id INTEGER,xp INTEGER,photo_key TEXT,photo BYTEA)`);
    await admin.ensureTables(db);
    await db.query(`INSERT INTO users(discord_id,username,data,xp) VALUES
      ('325','Kayan',$1,0), ('8','Ondine','{}',NULL)`, [JSON.stringify({ _accountId: '325', _savedAt: 4102444800000, profile: JSON.stringify({ xp: 0, favoritePokemonId: 937 }), stats: '{"played":9}' })]);
    const s = await serve(t, db);

    const panel = await s.panel();
    assert.match(panel, /<h2>Niveau d'un joueur<\/h2>/);
    assert.match(panel, /<option value="325">Kayan · niveau 1<\/option>/);
    assert.doesNotMatch(panel, /<option value="8">Ondine/, 'only players with a saved profile');

    assert.equal((await s.post('7', { account_id: '325', level: '73' })).status, 403, 'not an admin');
    assert.equal((await s.post('42', { account_id: '325', level: '73' }, 'https://evil.example')).status, 403, 'another site');
    for (const [fields, err] of [[{ account_id: '325', level: '0' }, /entre 1 et 100/], [{ account_id: '325', level: '101' }, /entre 1 et 100/], [{ account_id: '325', level: '7.5' }, /entre 1 et 100/],
      [{ account_id: '', level: '73' }, /Choisis un joueur/], [{ account_id: '999', level: '73' }, /introuvable/], [{ account_id: '8', level: '73' }, /pas encore de progression/]]) {
      assert.match(new URLSearchParams((await s.post('42', fields)).headers.get('location').split('?')[1]).get('err'), err);
    }

    const done = await s.post('42', { account_id: '325', level: '73' });
    assert.equal(done.headers.get('location'), '/admin?ok=level');
    const row = (await db.query("SELECT data, xp FROM users WHERE discord_id='325'")).rows[0];
    const profile = JSON.parse(row.data.profile);
    assert.equal(row.xp, 131400, 'the rankings show level 73 right away');
    assert.equal(profile.xp, 131400);
    assert.equal(profile.favoritePokemonId, 937, 'the rest of the profile is kept');
    assert.equal(row.data.stats, '{"played":9}');
    // Newer than the copy every device started from, even one stamped by a clock far ahead.
    assert.equal(row.data._savedAt, 4102444800001);
    assert.equal(profile.xpSetAt, row.data._savedAt);
    assert.equal(row.data._xpSetAt, row.data._savedAt, 'the server checks the same mark');
    assert.match(await s.panel(), /Kayan · niveau 73/);
    assert.match(await (await fetch(done.url.replace(/\/admin\/level$/, '') + '/admin?ok=level', { headers: { 'x-test-user': '42' } })).text(), /Niveau remis/);

    // Synced meanwhile: the copy is read again, never overwritten blindly.
    let calls = 0;
    const busy = { query: (sql, params) => (/^UPDATE/.test(sql) && calls++ < 1 ? Promise.resolve({ rowCount: 0 }) : db.query(sql, params)) };
    assert.deepEqual(await level.setPlayerLevel(busy, '325', 74, 10), { ok: true, xp: 135050 });
    assert.equal(calls, 2);
  } finally {
    if (db) await db.end();
    await root.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await root.end();
  }
});
