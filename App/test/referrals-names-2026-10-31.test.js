'use strict';
// « Invite un ami » and « Pseudo déplacé » (31/10/2026).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;

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

test('the page keeps the friend link, rewards both and offers the invite in the menu', () => {
  const src = read('src/script.10xk.referral.js');
  assert.match(src, /\/\[\?&\]ami=\(\[0-9a-f\]\{16\}\)\\b\//, 'only a public id is read from the address');
  assert.match(src, /if \(data && data\.won && options && options\.awardFreshWin\) setTimeout\(sendReferralFriendWin, 800\);/, 'claimed at a fresh win only');
  assert.match(src, /if \(data\.ok \|\| data\.error !== 'unavailable'\) referralStore\(null\);/);
  assert.match(read('src/script.07.delegation-party.js'), /data-args='\["invite"\]'><span>🎁 Invite un ami<\/span>/);
  assert.match(read('src/script.10xj.daily-reactions.js'), /data-action="openInviteFriend">🎁 Invite un ami : \+100 XP chacun<\/button>/);
});

test('PostgreSQL: a friend\'s first Pokémon du jour rewards both, once', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  const { createReferrals, ensureReferralTables, REFERRAL_XP, REFERRALS_PER_DAY } = require('../lib/referrals');
  const { initDailyDb } = require('../lib/daily-game');
  ids.setPlayerIdSecret('test-secret');
  await withSchema('ref_', async (db) => {
    await db.query(USERS);
    await db.query("INSERT INTO users(discord_id, username) VALUES ('A', 'Kayan'), ('F', 'Sacha')");
    await initDailyDb(db, new Date('2026-10-31T10:00:00Z'));
    await ensureReferralTables(db);
    for (const day of ['2026-10-30', '2026-10-31']) await db.query('INSERT INTO daily_rounds(day,secret_id) VALUES($1,25)', [day]);
    const day = '2026-10-31', won = (identity, d, account = null) => db.query("INSERT INTO daily_plays(identity,day,account_id,guessed,status) VALUES($1,$2,$3,'[25]','won')", [identity, d, account]);
    const refs = createReferrals({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid });
    const ref = ids.playerPid('A');
    const guest = { key: 'guest:g1', accountId: null };

    assert.deepEqual(await refs.friendFound(guest, ref, day), { ok: false, error: 'no_win' }, 'only once today\'s Pokémon is found');
    await won('guest:g1', day);
    assert.deepEqual(await refs.friendFound(guest, '0000000000000000', day), { ok: false, error: 'unknown' });
    assert.deepEqual(await refs.friendFound(guest, ref, day), { ok: true, xp: REFERRAL_XP });
    assert.deepEqual(await refs.friendFound(guest, ref, day), { ok: false, error: 'already' });
    // An old player is not a new friend; one's own link never pays.
    await won('guest:old', '2026-10-30'); await won('guest:old', day);
    assert.deepEqual(await refs.friendFound({ key: 'guest:old', accountId: null }, ref, day), { ok: false, error: 'not_new' });
    await won('user:A', day, 'A');
    assert.deepEqual(await refs.friendFound({ key: 'user:A', accountId: 'A' }, ref, day), { ok: false, error: 'self' });

    assert.deepEqual(await refs.mine('A'), { ok: true, pid: ref, xp: REFERRAL_XP, total: 1, pending: 1 });
    assert.deepEqual(await refs.claim('A'), { ok: true, friends: 1, xp: REFERRAL_XP });
    assert.deepEqual(await refs.claim('A'), { ok: true, friends: 0, xp: 0 }, 'paid once');
    assert.equal((await refs.mine('A')).total, 1);

    for (let i = 1; i < REFERRALS_PER_DAY; i++) await db.query("INSERT INTO referrals(friend_key, referrer_id, day) VALUES ($1, 'A', $2)", ['guest:x' + i, day]);
    await won('guest:late', day);
    assert.deepEqual(await refs.friendFound({ key: 'guest:late', accountId: null }, ref, day), { ok: false, error: 'limit' });
  });
});

test('PostgreSQL: a replaced name stays « Dresseur » through a new sign-in, until restored', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const names = require('../lib/name-overrides');
  await withSchema('names_', async (db) => {
    await db.query(USERS);
    await db.query('CREATE TABLE scores(discord_id TEXT, mode TEXT, score INTEGER, username TEXT, avatar TEXT, updated_at TIMESTAMPTZ, PRIMARY KEY(discord_id, mode))');
    await db.query("INSERT INTO users(discord_id, username) VALUES ('7', 'GrosMot')");
    await db.query("INSERT INTO scores VALUES ('7', 'daily', 40, 'GrosMot', '', now())");
    await names.ensureNameOverrides(db);
    assert.deepEqual(await names.replaceName(db, '404'), { error: 'Joueur introuvable.' });
    assert.deepEqual(await names.replaceName(db, '7'), { ok: true });
    assert.equal((await db.query("SELECT username FROM users WHERE discord_id = '7'")).rows[0].username, 'Dresseur');
    assert.equal((await db.query("SELECT username FROM scores WHERE discord_id = '7'")).rows[0].username, 'Dresseur');
    assert.deepEqual(names.withOverride({ id: '7', username: 'GrosMot' }), { id: '7', username: 'Dresseur' }, 'the session name is replaced');
    // The sign-in upsert of server.js keeps it.
    const signIn = (name) => db.query(`INSERT INTO users (discord_id, username, avatar, last_login) VALUES ($1, $2, '', now())
      ON CONFLICT (discord_id) DO UPDATE SET username = ${names.KEEP_OVERRIDE_SQL}, last_login = now()`, ['7', name]);
    await signIn('GrosMot');
    assert.equal((await db.query("SELECT username FROM users WHERE discord_id = '7'")).rows[0].username, 'Dresseur');
    assert.equal((await names.listOverrides(db))[0].previous, 'GrosMot', 'the admin sees which name was replaced');
    await names.restoreName(db, '7');
    assert.equal(names.withOverride({ id: '7', username: 'GrosMot' }).username, 'GrosMot');
    await signIn('GrosMot');
    assert.equal((await db.query("SELECT username FROM users WHERE discord_id = '7'")).rows[0].username, 'GrosMot', 'back at the next sign-in');
  });
  assert.match(read('server.js'), /ON CONFLICT \(discord_id\) DO UPDATE SET username = \$\{nameOverrides\.KEEP_OVERRIDE_SQL\}/);
  assert.match(read('server.js'), /try \{ return nameOverrides\.withOverride\(jwtLib\.verify\(token, SESSION_SECRET\)\); \}/);
});

test('admin stats show today\'s finders, give-ups, reactions and friends invited', () => {
  const { todaySectionHtml } = require('../lib/daily-retention');
  assert.equal(todaySectionHtml({ found: 7, gaveup: 2, reactions: { '🔥': 3, '😂': 1 }, friends: 1 }),
    '<p style="margin:16px 0 0">🎯 Pokémon du jour aujourd\'hui : <b>7</b> trouvé(s), <b>2</b> abandon(s) · réactions 😂 1 · 🔥 3 · 👏 0 · 😱 0 · 🎁 parrainages : <b>1</b></p>');
  assert.match(todaySectionHtml({ found: null, gaveup: null, reactions: null, friends: null }), /<b>—<\/b> trouvé\(s\).*réactions — · 🎁 parrainages : <b>—<\/b>/);
});
