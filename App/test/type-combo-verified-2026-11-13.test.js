'use strict';
// 🧬 Combo de types vérifié par le serveur : mêmes paires et mêmes points que la page, un nom faux ne coûte rien,
// le chrono est tenu par le serveur, puis une partie complète avec le service des Balls (PostgreSQL).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const TC = require('../lib/type-combo');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../pokemon.js'), 'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
// Les formes, ajoutées comme le fait le serveur (injectStatClashExtraForms : EXTRA_FORMS puis forms-data.json).
const core = fs.readFileSync(path.join(__dirname, '../src/script.01.core.js'), 'utf8');
const measured = JSON.parse(fs.readFileSync(path.join(__dirname, '../forms-data.json'), 'utf8').replace(/^\uFEFF/, ''));
for (const f of new Function('return ' + core.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/)[1])()) {
  const base = catalog.find((p) => p.id === f.baseId), d = measured[f.name] || {};
  if (base) catalog.push({ ...base, id: f.id, name: f.name, baseId: f.baseId, isAltForm: true,
    type1: d.type1 || f.type1 || base.type1, type2: d.type2 !== undefined ? d.type2 : (f.type2 !== undefined ? f.type2 : (base.type2 || null)) });
}
let seed = 7;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const answerFor = (g, combo) => {
  const key = combo.types.slice().sort().join('|');
  return g.pool.find((p) => [p.type1, p.type2].sort().join('|') === key).name;
};

test('mêmes points que la page : 200 / 140 / 100 / 80 selon le nombre de Pokémon possibles', () => {
  assert.equal(TC.tierOf(2).points, 200); assert.equal(TC.tierOf(7).points, 140);
  assert.equal(TC.tierOf(19).points, 100); assert.equal(TC.tierOf(20).points, 80);
  const page = fs.readFileSync(path.join(__dirname, '../src/script.03.minijeux.js'), 'utf8');
  for (const pts of [200, 140, 100, 80]) assert.match(page, new RegExp('points: ' + pts));
  assert.match(page, /TYPE_COMBO_DURATION_MS = 60000/); assert.equal(TC.DURATION_MS, 60000);
});

test('les formes comptent, comme sur la page (Feunard d’Alola est Glace / Fée)', () => {
  const g = TC.createTypeCombo(catalog, rnd, () => new Date(0));
  assert.ok(g.pool.some((p) => p.id >= 20000), 'formes dans le jeu');
  const alola = g.findMon("Feunard d'Alola");
  assert.deepEqual([alola.type1, alola.type2], ['Glace', 'Fée']);
  assert.equal(g.findMon('airmure').name, 'Airmure');
  assert.equal(g.findMon('AIRM').name, 'Airmure', 'début de nom accepté');
  assert.equal(g.findMon('zzzz'), null);
});

test('une partie : bon nom = points et nouvelle paire, nom faux = ses vrais types, fin au bout de 60 s', () => {
  let now = 5000000;
  const g = TC.createTypeCombo(catalog, rnd, () => new Date(now));
  const s = { mode: 'typecombo', phase: 'playing', round: 0 };
  g.init(s);
  const first = g.view(s);
  assert.equal(first.score, 0);
  assert.equal(g.answer(s, answerFor(g, first.combo)), true);
  assert.equal(s.solved, 1); assert.equal(s.score, first.combo.tier.points); assert.equal(s.round, 1);
  // Un nom qui n'a pas la paire : rien ne change, sauf le message.
  const combo = g.view(s).combo, key = combo.types.slice().sort().join('|');
  const wrong = g.pool.find((p) => [p.type1, p.type2].sort().join('|') !== key);
  assert.equal(g.answer(s, wrong.name), false);
  assert.equal(s.event.kind, 'wrong'); assert.deepEqual(s.event.types, [wrong.type1, wrong.type2]); assert.equal(s.round, 1);
  g.pass(s); assert.equal(s.round, 2);
  assert.throws(() => g.answer(s, 'x'.repeat(61)), /invalid_choice/);
  assert.equal(g.expire(s), false);
  now += TC.DURATION_MS + TC.GRACE_MS;
  assert.equal(g.expire(s), true); assert.equal(s.phase, 'over');
  assert.deepEqual(g.result(s), { mode: 'typecombo', score: 1, result: 'loss' });
});

test('Combo de types est vérifié par le serveur : Ball, ₽, Super Ball à 10 combos', () => {
  const { MODES } = require('../lib/verified-arcade');
  const { arcadeGain } = require('../lib/poke-balls');
  assert.ok(MODES.includes('typecombo'));
  assert.equal(arcadeGain('typecombo', 'win', 10).ball, 'great');
  assert.equal(arcadeGain('typecombo', 'win', 9).ball, 'poke');
  const line = fs.readFileSync(path.join(__dirname, '../src/script.10xzl.reward-line.js'), 'utf8');
  assert.match(line, /typecombo: '10 combos ou plus'/);
  const page = fs.readFileSync(path.join(__dirname, '../src/script.10zzzzm.type-combo-verified.js'), 'utf8');
  for (const fn of ['startTypeComboGame', 'typeComboSubmitGuess', 'typeComboSkip', 'finalizeTypeComboGame']) assert.match(page, new RegExp(fn + ' = '));
  assert.match(page, /isPartySessionActive/, 'jamais en Party Room');
});

const sql = { skip: !process.env.QA_DATABASE_URL, timeout: 60000 };
test('PostgreSQL: partie complète, bon nom rejoué sans double point, fin à l’heure du serveur, gain une seule fois', sql, async () => {
  const { createBallService, initBallsDb } = require('../lib/poke-balls');
  const { Pool } = require('pg'), schema = 'typecombo_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }); let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await initBallsDb(db);
    let now = Date.parse('2026-11-13T12:00:00Z');
    const service = createBallService({ db, pokemon: catalog, secret: 'local-only', clock: () => new Date(now), randomInt: rnd });
    const g = TC.createTypeCombo(catalog, rnd, () => new Date(now));
    const me = { key: 'user:tc', guestKey: 'guest:tc', accountId: 'tc' };
    await service.state(me);
    let a = (await service.arcadeStart(me, { mode: 'typecombo', startId: randomUUID(), restart: true })).arcade;
    assert.equal(a.phase, 'playing'); assert.equal(a.found.length, 0);
    for (let i = 0; i < 10; i++) {
      const body = { mode: 'typecombo', sessionId: a.sessionId, round: a.round, choice: answerFor(g, a.combo) };
      const replies = await Promise.all([service.arcadeAnswer(me, body), service.arcadeAnswer(me, body)]);
      assert.equal(replies.filter((x) => !x.replayed).length, 1, 'un seul compte');
      a = replies.find((x) => !x.replayed).arcade;
      now += 1000;
    }
    assert.equal(a.solved, 10);
    // Passer change de paire ; finir avant l'heure est refusé.
    a = (await service.arcadeNext(me, { mode: 'typecombo', sessionId: a.sessionId, round: a.round })).arcade;
    await assert.rejects(service.arcadeFinish(me, { mode: 'typecombo', sessionId: a.sessionId, round: a.round }), /round_wait/);
    now = a.endsAt + TC.GRACE_MS + 1;
    // Un nom envoyé trop tard ne compte plus : la partie est close avec le score confirmé.
    const late = await service.arcadeAnswer(me, { mode: 'typecombo', sessionId: a.sessionId, round: a.round, choice: answerFor(g, a.combo) });
    assert.equal(late.arcade.phase, 'over'); assert.equal(late.arcade.solved, 10);
    const gains = (late.added || []).filter((x) => x.source === 'mode:typecombo');
    assert.equal(gains.length, 1); assert.equal(gains[0].ball, 'great');
    const again = await service.arcadeFinish(me, { mode: 'typecombo', sessionId: a.sessionId, round: a.round });
    assert.equal(again.replayed, true);
    assert.equal((again.added || []).filter((x) => x.source === 'mode:typecombo').length, 0);
  } finally { if (db) await db.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.end(); }
});
