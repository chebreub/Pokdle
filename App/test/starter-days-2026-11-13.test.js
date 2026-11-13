'use strict';
// 🌱 « Tes 3 premiers jours » : seulement pour un nouveau joueur, étapes cochées par le serveur, un cadeau par jour
// réussi (Super Ball, Hyper Ball, Évoli), jamais deux fois, le jour suivant attend le lendemain.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const PB = require('../lib/poke-balls');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('le programme : 3 jours, leurs étapes et leurs cadeaux hors plafond', () => {
  assert.deepEqual(PB.STARTER_DAYS.map((d) => d.steps), [['daily', 'mode', 'capture'], ['daily', 'mode'], ['daily', 'capture']]);
  assert.deepEqual(PB.STARTER_DAYS.map((d) => d.gift), [{ ball: 'great' }, { ball: 'ultra' }, { pokemon: 133 }]);
  assert.match(read('lib/poke-balls.js'), /source LIKE 'starter:%'\)";/, 'hors du plafond des 10 Balls');
  const page = read('src/script.10zzzzo.starter-days.js');
  assert.match(page, /\/api\/starter\/claim/);
  assert.match(page, /pokedle\.starterHidden/, '✕ cache la carte');
  assert.match(page, /insertBefore\(card, hero\)/, 'en haut de l’accueil, avant le Défi du jour');
});

const sql = { skip: !process.env.QA_DATABASE_URL, timeout: 60000 };
test('PostgreSQL: nouveau joueur → 3 jours de cadeaux ; ancien joueur → rien', sql, async () => {
  const { Pool } = require('pg'), schema = 'starter_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }); let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await PB.initBallsDb(db);
    await db.query('CREATE TABLE daily_plays(identity TEXT, day DATE, status TEXT)');
    let now = new Date('2026-11-14T10:00:00Z');
    const service = PB.createBallService({ db, secret: 'local-only', clock: () => now });
    const me = { key: 'user:new', guestKey: 'guest:new', accountId: 'new' };
    const day = () => now.toISOString().slice(0, 10);
    const win = () => db.query("INSERT INTO daily_plays VALUES($1,$2,'won')", [me.key, day()]);
    const mode = (m) => db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES($1,$2,$3,'poke')", [me.key, day(), 'mode:' + m]);
    const catchOne = () => db.query("INSERT INTO wild_encounters(identity,day,pokemon_id,status) VALUES($1,$2,16,'caught')", [me.key, day()]);

    let st = (await service.state(me)).starter;
    assert.equal(st.day, 1); assert.equal(st.claimable, false);
    assert.deepEqual(st.steps.map((s) => s.done), [false, false, false]);
    await assert.rejects(service.claimStarter(me), /starter_not_ready/);
    await win(); await mode('weight');
    st = (await service.state(me)).starter;
    assert.deepEqual(st.steps.map((s) => s.done), [true, true, false]);
    await catchOne();
    let out = await service.claimStarter(me);
    assert.deepEqual(out.starterClaimed, { day: 1, ball: 'great', granted: true });
    assert.equal(out.starter.claimedToday, true);
    assert.equal(out.bonus.filter((g) => g.source === 'starter:1').length, 1);
    await assert.rejects(service.claimStarter(me), /starter_not_ready/, 'une fois par jour');

    // Le lendemain : jour 2 (Pokémon du jour + un mini-jeu), Hyper Ball.
    now = new Date('2026-11-15T10:00:00Z');
    st = (await service.state(me)).starter;
    assert.equal(st.day, 2); assert.equal(st.claimedToday, false);
    await win(); await mode('quiz');
    out = await service.claimStarter(me);
    assert.equal(out.starterClaimed.ball, 'ultra');

    // Deux jours plus tard (les jours n'ont pas besoin de se suivre) : jour 3, capture du jour exigée, Évoli.
    now = new Date('2026-11-17T10:00:00Z');
    await win();
    st = (await service.state(me)).starter;
    assert.equal(st.day, 3); assert.deepEqual(st.steps.map((s) => s.done), [true, false]);
    await catchOne();
    out = await service.claimStarter(me);
    assert.equal(out.starterClaimed.pokemon, 133);
    assert.ok(out.captures.some((c) => c.id === 133));
    assert.equal(out.starter.finished, true);
    now = new Date('2026-11-18T10:00:00Z');
    assert.equal((await service.state(me)).starter, null, 'la carte disparaît le lendemain');

    // Un joueur qui avait des Balls avant la mise en ligne n'est pas nouveau.
    const old = { key: 'user:old', guestKey: 'guest:old', accountId: 'old' };
    await db.query("INSERT INTO ball_gains(identity,day,source,ball) VALUES('user:old','2026-11-05','gift','poke')");
    assert.equal((await service.state(old)).starter, null);
  } finally { if (db) await db.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.end(); }
});
