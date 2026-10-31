'use strict';
// Pixelisé in series, the end of the day's journey, « Jours passés » and the generation hint (31/10/2026).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Pixelisé is a series of 10 images by default, 5 / 10 / 20 to pick, with a summary', () => {
  const src = read('src/script.10xm.pixel-series.js');
  assert.match(src, /var PIXEL_SERIES_SIZES = \[5, 10, 20\];/);
  assert.match(src, /return PIXEL_SERIES_SIZES\.indexOf\(n\) >= 0 \? n : 10;/, '10 when nothing was chosen');
  assert.match(src, /surrender\.textContent = pixelSeries \? 'Passer l’image' : 'Abandonner';/);
  assert.match(src, /restart\.innerHTML = last \? '🔁 Nouvelle série' : 'Image suivante →';/);
  // The summary, rendered with a sample series.
  const code = src.split("if (typeof startPixelGame === 'function')")[0];
  const env = { window: {}, escapeHtml: (s) => String(s), playerProfile: { xp: 1220, pixelSeriesBest: { 10: 6 } }, localStorage: { getItem: () => null } };
  const { pixelSeriesSummaryHtml } = Function(...Object.keys(env), code + '; return { pixelSeriesSummaryHtml };')(...Object.values(env));
  const html = pixelSeriesSummaryHtml({ total: 10, found: 7, attemptsWon: 21, xpStart: 1000, rounds: [{ won: true, name: 'Pikachu' }, { won: false, name: 'Mew' }] });
  assert.match(html, /<b>7<\/b><span>\/ 10 trouvés<\/span>/);
  assert.match(html, /3,0 essais en moyenne · \+220 XP · 🏆 Record !/);
  assert.match(html, /<i class="is-won" title="Pikachu">✓<\/i><i class="is-lost" title="Mew">×<\/i>/);
  assert.match(read('src/script.02.statclash.js'), /function startPixelGame\(\)/, 'the catalog still opens it the same way');
});

test('a finished day offers Pokédle in unlimited mode, the mini-games and the past days', () => {
  const src = read('src/script.10xl.day-done.js');
  assert.match(src, /data-action="startNormalGame">🔁 Pokédle en illimité<\/button>/);
  assert.match(src, /data-action="openAllModesScreen" data-args=\\'\["solo"\]\\'>Les mini-jeux<\/button>/);
  assert.match(src, /data-action="openPastDays">📅 Rejouer les jours passés<\/button>/);
  assert.match(src, /cta\.textContent = '🔁 Pokédle en illimité →';/);
  assert.match(read('src/script.07.delegation-party.js'), /data-args='\["past"\]'><span>📅 Jours passés<\/span>/);
});

test('the generation hint comes back each visit until the picker has been opened once', () => {
  const src = read('src/script.10n.generations.js');
  assert.match(src, /try\{localStorage\.setItem\(GENERATION_PICKED_KEY,'1'\);\}catch\(_e\)\{\}/);
  assert.match(src, /if\(generationHintShownThisVisit\)return;\n  try\{if\(localStorage\.getItem\(GENERATION_PICKED_KEY\)\)return;\}catch\(_e\)\{return;\}/);
});

test('PostgreSQL: past days, 7 with an account, 7 more per friend invited, answers only when unlocked', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const { pastDays, PAST_MAX_DAYS } = require('../lib/daily-past');
  const { initDailyDb, nextDay } = require('../lib/daily-game');
  const { ensureReferralTables } = require('../lib/referrals');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'past_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 2 });
    await initDailyDb(db, new Date('2026-10-31T10:00:00Z'));
    await ensureReferralTables(db);
    const today = '2026-10-31';
    for (let i = 0; i <= 20; i++) await db.query('INSERT INTO daily_rounds(day,secret_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [nextDay(today, -i), 100 + i]);
    const guest = await pastDays(db, null, today);
    assert.equal(guest.login, false);
    assert.ok(guest.days.every((d) => !d.unlocked && d.id === null), 'a guest gets no answer');
    const mine = await pastDays(db, 'A', today);
    assert.equal(mine.unlocked, 7);
    assert.equal(mine.days.length, 20, 'today is never listed');
    assert.deepEqual(mine.days[0], { day: '2026-10-30', unlocked: true, id: 101 });
    assert.deepEqual(mine.days[7], { day: '2026-10-23', unlocked: false, id: null });
    await db.query("INSERT INTO referrals(friend_key, referrer_id, day) VALUES ('guest:f1', 'A', $1), ('guest:f2', 'A', $1)", [today]);
    const more = await pastDays(db, 'A', today);
    assert.equal(more.unlocked, 21);
    assert.equal(more.friends, 2);
    assert.ok(more.days.every((d) => d.unlocked), 'every listed day is open with two friends');
    assert.equal(PAST_MAX_DAYS, 60);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});
