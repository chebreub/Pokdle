'use strict';
// V2-MES-01 (8/11/2026, audit GPT) : « dans les 7 jours » ≠ « exactement à J+7 », et « tout le site » ne compte
// que des parties jouées (pas un cadeau, un achat, un bonus ni une partie ouverte sans réponse).
const test = require('node:test');
const assert = require('node:assert/strict');
const { siteRetention, SITE_SOURCES, SITE_ACTIVITY_SOURCES, RETENTION_DEFINITION } = require('../lib/daily-retention');
const { renderStatsDashboard } = require('../lib/admin-stats-dashboard');

test('PostgreSQL: a gift, a purchase or an opened game is not a played game', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'mes01_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE daily_plays(identity TEXT, day DATE, guessed JSONB NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'playing', excluded_stats BOOLEAN NOT NULL DEFAULT false);
      CREATE TABLE challenge_plays(identity TEXT, day DATE, answers JSONB NOT NULL DEFAULT '[]', guessed JSONB NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'ready');
      CREATE TABLE ball_gains(identity TEXT, day DATE, source TEXT);
      CREATE TABLE wild_encounters(identity TEXT, day DATE, kind TEXT NOT NULL DEFAULT 'wild', status TEXT NOT NULL DEFAULT 'caught');`);
    const daily = (who, day) => db.query("INSERT INTO daily_plays VALUES ($1,$2,'[25]','won',false)", [who, day]);
    // A : joue le 20, revient seulement le 22 (J+2) en gagnant une Ball à un mini-jeu.
    await daily('user:A', '2026-10-20');
    await db.query("INSERT INTO ball_gains VALUES ('user:A','2026-10-22','mode:quiz')");
    // B : joue le 20, revient le 21 seulement pour ouvrir le cadeau, acheter et ouvrir le Défi sans répondre.
    await daily('user:B', '2026-10-20');
    await db.query("INSERT INTO ball_gains VALUES ('user:B','2026-10-21','gift'), ('user:B','2026-10-21','shop:poke:x'), ('user:B','2026-10-21','welcome')");
    await db.query("INSERT INTO challenge_plays(identity, day) VALUES ('user:B','2026-10-21')");
    // C : joue le 20 et revient le 21 dans les hautes herbes ; D : seulement une remise à zéro de test le 21.
    await daily('user:C', '2026-10-20'); await db.query("INSERT INTO wild_encounters VALUES ('user:C','2026-10-21','wild','fled')");
    await daily('user:D', '2026-10-20'); await db.query("INSERT INTO wild_encounters VALUES ('user:D','2026-10-21','wild','test_reset')");

    const played = await siteRetention(db, '2026-10-20', '2026-10-30');
    assert.equal(played.definition, RETENTION_DEFINITION);
    // Lendemain : seul C (A revient à J+2, B et D n'ont pas joué le 21). 7 jours : A et C.
    assert.deepEqual([played.nextDay.back, played.week.back], [1, 2]);
    const activity = await siteRetention(db, '2026-10-20', '2026-10-30', [], SITE_ACTIVITY_SOURCES);
    assert.ok(activity.nextDay.back > played.nextDay.back, 'the old measure counted a gift or an opened game as a return');
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});

test('the played-games sources leave out gifts, purchases, bonuses and opened games', () => {
  const sql = Object.fromEntries(SITE_SOURCES);
  assert.match(sql.ball_gains, /source LIKE 'mode:%' OR source = 'party'/);
  assert.match(sql.challenge_plays, /jsonb_array_length\(answers\) > 0/);
  assert.match(sql.wordle_plays, /jsonb_array_length\(guessed\) > 0/);
  assert.match(sql.wild_encounters, /test_reset/);
  assert.deepEqual(SITE_SOURCES.map(([t]) => t), SITE_ACTIVITY_SOURCES.map(([t]) => t), 'same tables, stricter rows');
});

test('/admin/stats names « within 7 days » exactly and shows the old measure apart', () => {
  const part = (back, base) => ({ back, base, rate: base ? Math.round(100 * back / base) : null });
  const r = (a) => ({ from: '2026-10-10', to: '2026-11-06', nextDay: a, week: a, newWeek: a });
  const html = renderStatsDashboard({ days: 7, metrics: [], retention: r(part(1, 4)), siteRetention: r(part(2, 8)), siteActivity: r(part(3, 8)) });
  assert.match(html, /Revient dans les 7 jours \(entre J\+1 et J\+7\)/);
  assert.match(html, /revenu au moins une fois entre le lendemain et le 7e jour \(pas exactement le 7e jour\)/);
  assert.match(html, /<th scope="row">Tout le site : toute activité enregistrée \(mesure du 7\/11\)<\/th>/);
  assert.match(html, /un cadeau, le bonus de bienvenue, un achat, un coffre ou une partie ouverte sans réponse ne comptent pas/);
});
