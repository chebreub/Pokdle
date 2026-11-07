'use strict';
// DATA-04 (7/11/2026): J+1 / J+7 on mature days only, the Pokémon du jour apart from the whole site,
// admin accounts left out, read from the activity the server already keeps (nothing new collected).
const test = require('node:test');
const assert = require('node:assert/strict');
const { dailyRetention, siteRetention, SITE_SOURCES } = require('../lib/daily-retention');
const { renderStatsDashboard } = require('../lib/admin-stats-dashboard');

test('PostgreSQL: mature cohorts, daily vs whole site, admin excluded', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'data04_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE daily_plays(identity TEXT, day DATE, guessed JSONB NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'playing', excluded_stats BOOLEAN NOT NULL DEFAULT false);
      CREATE TABLE ball_gains(identity TEXT, day DATE, source TEXT);
      CREATE TABLE wild_encounters(identity TEXT, day DATE, kind TEXT NOT NULL DEFAULT 'wild');`);
    const play = (who, day, extra = {}) => db.query("INSERT INTO daily_plays(identity, day, guessed, status, excluded_stats) VALUES ($1,$2,$3,$4,$5)",
      [who, day, JSON.stringify(extra.guessed ?? [25]), extra.status ?? 'won', extra.excluded ?? false]);
    // Window 2026-10-20 → 2026-10-30 (finished days). A: daily on 20 and 21. B: daily on 20, back on the
    // site only (a Ball) on 21. C: daily on 29 only (next day 30 inside, so counts for J+1 but too recent for J+7).
    await play('user:A', '2026-10-20'); await play('user:A', '2026-10-21');
    await play('user:B', '2026-10-20');
    await db.query("INSERT INTO ball_gains VALUES ('user:B','2026-10-21','play:quiz')");
    await play('user:C', '2026-10-29');
    // Not players: an opened day without a guess, a guest row merged into an account, an admin.
    await play('guest:open', '2026-10-20', { guessed: [], status: 'playing' });
    await play('guest:merged', '2026-10-20', { excluded: true });
    await play('user:ADMIN', '2026-10-20'); await play('user:ADMIN', '2026-10-21');
    // Site activity that does not count: Balls from the admin, a Pokémon received in a trade.
    await db.query("INSERT INTO ball_gains VALUES ('user:D','2026-10-20','play:quiz'), ('user:D','2026-10-21','admin:test')");
    await db.query("INSERT INTO wild_encounters VALUES ('user:E','2026-10-20','wild'), ('user:E','2026-10-21','trade')");

    const d = await dailyRetention(db, '2026-10-20', '2026-10-30', ['user:ADMIN']);
    // J+1 base: A20, A21, B20, C29 = 4 ; back: A20 → 1.  J+7 base (≤ 23): A20, A21, B20 = 3 ; back: A20 → 1.
    assert.deepEqual(d.nextDay, { back: 1, base: 4, rate: 25 });
    assert.deepEqual(d.week, { back: 1, base: 3, rate: 33 });
    assert.deepEqual(d.newWeek, { back: 1, base: 2, rate: 50 }, 'A and B were new on the 20th');

    const s = await siteRetention(db, '2026-10-20', '2026-10-30', ['user:ADMIN']);
    assert.deepEqual(s.sources, ['daily_plays', 'ball_gains', 'wild_encounters'], 'missing tables are skipped');
    // Site: A20, A21, B20, B21, C29, D20, E20 → J+1 base 7, back A20 + B20 = 2. J+7 base (≤ 23): 6, back 2.
    assert.deepEqual(s.nextDay, { back: 2, base: 7, rate: 29 });
    assert.deepEqual(s.week, { back: 2, base: 6, rate: 33 });

    const withAdmin = await dailyRetention(db, '2026-10-20', '2026-10-30');
    assert.equal(withAdmin.nextDay.base, 6, 'without the exclusion the admin would count');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM daily_plays')).rows[0].n, 8, 'reading changes nothing');
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});

test('the site measure only reads tables the server already keeps, never visits', () => {
  assert.deepEqual(SITE_SOURCES.map(([t]) => t), ['daily_plays', 'wordle_plays', 'dossier_plays', 'challenge_plays', 'grid_plays', 'petitbac_daily_plays', 'ball_gains', 'wild_encounters']);
  const sql = SITE_SOURCES.map(([, q]) => q).join(' ');
  assert.match(sql, /source NOT LIKE 'admin:%'/);
  assert.match(sql, /kind <> 'trade'/);
  assert.doesNotMatch(sql, /usage_|visits/);
});

test('/admin/stats shows both measures with their bases and flags small samples', () => {
  const part = (back, base) => ({ back, base, rate: base ? Math.round(100 * back / base) : null });
  const r = (a, b, c) => ({ from: '2026-10-10', to: '2026-11-06', nextDay: a, week: b, newWeek: c });
  const html = renderStatsDashboard({ days: 7, metrics: [], retention: r(part(12, 40), part(18, 40), part(3, 10)), siteRetention: r(part(30, 80), part(40, 80), part(0, 0)) });
  assert.match(html, /Retour des joueurs \(J\+1, J\+7\)/);
  assert.match(html, /<th scope="row">Pokémon du jour<\/th><td><strong>30 %<\/strong> <small>\(12 \/ 40\)<\/small><\/td>/);
  assert.match(html, /<th scope="row">Tout le site \(parties enregistrées\)<\/th><td><strong>38 %<\/strong> <small>\(30 \/ 80\)<\/small><\/td>/);
  assert.match(html, /\(3 \/ 10\)<\/small><br><span class="pill warn"[^>]*>petit effectif<\/span>/);
  assert.match(html, /2026-10-10 → 2026-11-06/);
  assert.match(html, /Comptes admin exclus/);
  const none = renderStatsDashboard({ days: 7, metrics: [], retention: null, siteRetention: null });
  assert.match(none, /<th scope="row">Tout le site \(parties enregistrées\)<\/th><td colspan="3">Indisponible<\/td>/);
});
