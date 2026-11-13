'use strict';
// 🔢 Classe-les : 8 manches de 5 Pokémon, 1 point par Pokémon bien placé ; le bon ordre et les valeurs
// n'arrivent qu'après la réponse ; partie complète par le service des Balls (PostgreSQL).
const test = require('node:test'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const RT = require('../lib/rank-them');
const catalog = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../pokemon.js'), 'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
let seed = 7;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

test('une manche : 5 Pokémon différents, valeurs distinctes, bonne réponse cachée avant de répondre', () => {
  const g = RT.createRankThem(catalog, rnd);
  const s = { mode: 'rankthem', phase: 'playing', gens: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
  g.init(s);
  const v = g.view(s);
  assert.equal(v.question.ids.length, 5);
  assert.equal(new Set(v.question.ids).size, 5);
  assert.equal(v.reveal, undefined, 'pas de valeurs avant la réponse');
  assert.ok(RT.CRITERIA[v.question.key]);
  const values = Object.values(s.question.values);
  assert.equal(new Set(values).size, 5, 'pas d’égalité');
  // Bonne réponse = 5 points ; l'ordre est du plus grand au plus petit.
  const sorted = s.question.answer.map((id) => s.question.values[id]);
  assert.deepEqual(sorted, sorted.slice().sort((a, b) => b - a));
  g.answer(s, s.question.answer);
  assert.equal(s.score, 5); assert.equal(s.phase, 'reveal');
  assert.ok(g.view(s).reveal.values);
});

test('réponses invalides refusées, 8 manches puis fin', () => {
  const g = RT.createRankThem(catalog, rnd);
  const s = { mode: 'rankthem', phase: 'playing', gens: [1] };
  g.init(s);
  assert.throws(() => g.answer(s, [1, 2, 3]), /invalid_choice/);
  assert.throws(() => g.answer(s, [...s.question.ids.slice(0, 4), s.question.ids[0]]), /invalid_choice/);
  assert.throws(() => g.answer(s, [...s.question.ids.slice(0, 4), 9999]), /invalid_choice/);
  for (let r = 0; r < RT.ROUNDS; r++) {
    g.answer(s, s.question.ids.slice().reverse());
    if (r < RT.ROUNDS - 1) { assert.equal(s.phase, 'reveal'); g.next(s); }
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.history.length, RT.ROUNDS);
  assert.equal(g.result({ ...s, score: RT.WIN_AT }).result, 'win');
});

test('Classe-les est vérifié par le serveur : Ball, ₽, Super Ball à 32', () => {
  const { MODES } = require('../lib/verified-arcade');
  const { arcadeGain } = require('../lib/poke-balls');
  assert.ok(MODES.includes('rankthem'));
  assert.equal(arcadeGain('rankthem', 'win', 32).ball, 'great');
  assert.equal(arcadeGain('rankthem', 'win', 30).ball, 'poke');
});

const sql = { skip: !process.env.QA_DATABASE_URL, timeout: 60000 };
test('PostgreSQL: partie complète, réponse rejouée sans double point, gain une seule fois', sql, async () => {
  const { createBallService, initBallsDb } = require('../lib/poke-balls');
  const { Pool } = require('pg'), schema = 'rankthem_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }); let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await initBallsDb(db);
    const service = createBallService({ db, pokemon: catalog, secret: 'local-only', clock: () => new Date('2026-11-13T12:00:00Z'), randomInt: rnd });
    const me = { key: 'user:rt', guestKey: 'guest:rt', accountId: 'rt' };
    await service.state(me);
    let a = (await service.arcadeStart(me, { mode: 'rankthem', startId: randomUUID(), gens: [1, 2] })).arcade;
    let paid = 0;
    for (let r = 0; r < 8; r++) {
      const choice = a.question.ids;
      const body = { mode: 'rankthem', sessionId: a.sessionId, round: a.round, choice };
      const replies = await Promise.all([service.arcadeAnswer(me, body), service.arcadeAnswer(me, body)]);
      assert.equal(replies.filter((x) => !x.replayed).length, 1);
      paid += replies.flatMap((x) => x.added || []).filter((g) => g.source === 'mode:rankthem').length;
      a = replies[0].arcade;
      assert.ok(a.reveal.order.length === 5);
      if (r < 7) a = (await service.arcadeNext(me, { mode: 'rankthem', sessionId: a.sessionId, round: a.round })).arcade;
    }
    assert.equal(a.phase, 'over');
    assert.equal(paid, 1, 'la 1re partie du jour paie une fois');
    await assert.rejects(service.arcadeAnswer(me, { mode: 'rankthem', sessionId: a.sessionId, round: a.round, choice: [...a.question.ids].reverse() }), /answer_conflict/);
  } finally { if (db) await db.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.end(); }
});
