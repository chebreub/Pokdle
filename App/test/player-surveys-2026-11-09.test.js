'use strict';
// 📊 Sondage unique (9/11/2026) : une fois par joueur qui avait déjà un compte, « Non merci » = jamais redemandé,
// une seule réponse, +1 Poké Ball hors plafond, réponses dans /admin, effacé avec le compte.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const lib = require('../lib/player-surveys');

async function withSchema(run) {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'svy_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 3 });
    await db.query(`CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await db.query(`CREATE TABLE ball_gains (identity TEXT NOT NULL, day DATE NOT NULL, source TEXT NOT NULL, ball TEXT NOT NULL,
      account_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(identity,day,source))`);
    await run(db);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
}

test('first survey: shown once to older accounts, answer once, skip for good, Ball outside the cap', { skip: !process.env.QA_DATABASE_URL }, async () => {
  await withSchema(async (db) => {
    await db.query("INSERT INTO users(discord_id, username, created_at) VALUES ('A','Sacha', now() - interval '3 days'), ('B','Ondine', now() - interval '3 days'), ('C','Pierre', now() - interval '3 days')");
    await lib.ensureTables(db);
    await lib.ensureTables(db); // une 2e mise en route ne crée pas un 2e sondage
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM player_surveys')).rows[0].n, 1);
    // Un compte créé après le lancement ne le voit pas.
    await db.query("INSERT INTO users(discord_id, username) VALUES ('N','Nouveau')");
    assert.equal(await lib.current(db, 'N'), null);

    const s = await lib.current(db, 'A');
    assert.equal(s.title, lib.FIRST_SURVEY.title);
    assert.equal(s.q2, lib.FIRST_SURVEY.q2);
    // Vu seulement (rechargement) : il revient.
    assert.deepEqual(await lib.markSeen(db, 'A', s.id), { ok: true });
    assert.ok(await lib.current(db, 'A'));
    // Il faut une tête pour chaque question.
    assert.equal((await lib.answer(db, 'A', { id: s.id, a1: 3 })).error, 'pick');
    assert.equal((await lib.answer(db, 'A', { id: s.id, a1: 9, a2: 2 })).error, 'pick');
    const done = await lib.answer(db, 'A', { id: s.id, a1: 3, a2: 2, comment: '  J’adore le Pokédex​\n\n\n\npar contre la Party Room ' + 'x'.repeat(400) });
    assert.deepEqual(done, { ok: true, ball: true });
    assert.equal(await lib.current(db, 'A'), null);
    assert.equal((await lib.answer(db, 'A', { id: s.id, a1: 1, a2: 1 })).error, 'already');
    const row = (await db.query("SELECT a1, a2, comment FROM player_survey_answers WHERE account_id = 'A'")).rows[0];
    assert.equal(row.a1, 3); assert.equal(row.a2, 2);
    assert.ok(row.comment.length <= lib.COMMENT_MAX && !row.comment.includes('​') && !row.comment.includes('\n\n\n'));
    const balls = (await db.query("SELECT source, ball FROM ball_gains WHERE identity = 'user:A'")).rows;
    assert.deepEqual(balls, [{ source: 'survey:' + s.id, ball: 'poke' }]);
    // La Ball du sondage est hors du plafond de 10 par jour.
    assert.match(read('lib/poke-balls.js'), /const BONUS_SQL = .*source LIKE 'survey:%'/);

    // « Non merci » : jamais redemandé, et plus de réponse possible.
    assert.deepEqual(await lib.skip(db, 'B', s.id), { ok: true });
    assert.equal(await lib.current(db, 'B'), null);
    assert.equal((await lib.answer(db, 'B', { id: s.id, a1: 1, a2: 1 })).error, 'already');
    // Un refus après une réponse ne l'efface pas.
    await lib.skip(db, 'A', s.id);
    assert.equal((await db.query("SELECT status FROM player_survey_answers WHERE account_id = 'A'")).rows[0].status, 'answered');

    // /admin : chiffres, barres, commentaires et texte pour Claude.
    const state = await lib.adminState(db);
    assert.equal(state.length, 1);
    assert.equal(state[0].answered, 1); assert.equal(state[0].skipped, 1); assert.equal(state[0].seen, 2);
    assert.deepEqual(state[0].r1, [0, 0, 1]); assert.deepEqual(state[0].r2, [0, 1, 0]);
    assert.equal(state[0].list[0].username, 'Sacha');
    const html = lib.adminSectionHtml(state, (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
    assert.match(html, /Sondage en cours/);
    assert.match(html, /Texte à copier pour Claude/);
    assert.match(lib.surveyText(state[0]), /1 réponses · 1 « Non merci »/);

    // Nouveau sondage : remplace l'ancien ; C ne voit plus que le nouveau, A le voit aussi (autre sondage).
    assert.ok((await lib.create(db, { title: 'X' })).error);
    const made = await lib.create(db, { title: 'Et la Party Room ?', q1: 'La Party Room', q2: '', hint: 'ignoré sans question 2' });
    assert.ok(made.id);
    const next = await lib.current(db, 'C');
    assert.equal(next.id, made.id); assert.equal(next.q2, null); assert.equal(next.hint, null);
    assert.equal((await lib.answer(db, 'C', { id: s.id, a1: 1, a2: 1 })).error, 'gone');
    assert.deepEqual(await lib.answer(db, 'C', { id: made.id, a1: 2 }), { ok: true, ball: true });
    assert.equal(await lib.stop(db, made.id), 1);
    assert.equal(await lib.current(db, 'A'), null);
  });
});

test('wired in the server, the admin panel, the page and the privacy page', () => {
  const server = read('server.js');
  assert.match(server, /playerSurveys\.ensureTables\(pgPool\)/);
  assert.match(server, /surveys: \{ module: playerSurveys \}/);
  assert.match(server, /playerSurveys\.mountPlayerRoutes\(app/);
  assert.match(server, /\["player_survey_answers", "DELETE FROM player_survey_answers WHERE account_id = \$1"/);
  const admin = read('lib/admin-panel.js');
  assert.match(admin, /app\.post\("\/admin\/survey", form/);
  assert.match(admin, /app\.post\("\/admin\/survey\/stop", form/);
  assert.match(admin, /\$\{newsSection\(news, day\)\}\$\{surveyHtml\}/);
  const js = read('src/script.10xzzw.survey.js');
  assert.match(js, /fetch\('\/api\/survey'/);
  assert.match(js, /svPost\('\/api\/survey\/skip'/);
  assert.match(js, /svPost\('\/api\/survey\/seen'/);
  // Jamais par-dessus une partie ou une autre fenêtre.
  assert.match(js, /screen !== 'screen-config'/);
  for (const fn of ['svPick', 'svSkip', 'svSend', 'svClose']) assert.match(js, new RegExp('window\\.' + fn + ' = ' + fn));
  assert.match(read('game-shell.css'), /\.sv-veil\{position:fixed/);
  assert.match(read('game-shell.css'), /body\.reduce-motion \.sv-veil/);
  assert.match(read('confidentialite.html'), /Sondage « Ton avis sur Pokédle/);
});
