'use strict';
// ⚡ Faiblesses éclair : la table des types (×2, ×4, immunités), 10 Pokémon variés, « parfait » seulement
// pour la bonne sélection exacte et à temps, puis la partie complète par le service des Balls (PostgreSQL).
const test = require('node:test'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const WS = require('../lib/weak-spots');
const catalog = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../pokemon.js'), 'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
let seed = 11;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

test('les faiblesses suivent la table des types (Dracolosse, Ectoplasma, Léviator)', () => {
  const w = (t) => Object.fromEntries(WS.weaknesses(t));
  assert.deepEqual(w(['Dragon', 'Vol']), { Glace: 4, Roche: 2, Dragon: 2, 'Fée': 2 });
  assert.deepEqual(Object.keys(w(['Spectre', 'Poison'])).sort(), ['Psy', 'Sol', 'Spectre', 'Ténèbres'].sort());
  assert.deepEqual(w(['Eau', 'Vol']), { 'Électrik': 4, Roche: 2 });
  assert.equal(WS.multiplier('Sol', ['Vol']), 0, 'immunité');
});

test('une partie : 10 Pokémon tous différents, combinaisons variées, parfait seulement si exact et à temps', () => {
  let now = 1000000;
  const g = WS.createWeakSpots(catalog, rnd, () => new Date(now));
  const s = { mode: 'weakspots', phase: 'playing', gens: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
  g.init(s);
  assert.equal(new Set(s.ids).size, 10);
  const v = g.view(s);
  assert.equal(v.reveal, undefined, 'pas de réponse avant de valider');
  const right = WS.weaknesses(v.question.types).map(([t]) => t);
  assert.throws(() => g.answer(s, ['Pas un type']), /invalid_choice/);
  g.answer(s, right);
  assert.equal(s.score, 1); assert.equal(s.answer.perfect, true);
  g.next(s);
  const right2 = WS.weaknesses(g.view(s).question.types).map(([t]) => t);
  g.answer(s, right2.slice(1));
  assert.equal(s.answer.perfect, false); assert.equal(s.answer.missed, 1);
  g.next(s);
  // Trop tard : la sélection ne compte pas, même juste.
  now += WS.TURN_MS + WS.GRACE_MS + 1;
  g.answer(s, WS.weaknesses(g.view(s).question.types).map(([t]) => t));
  assert.equal(s.answer.late, true); assert.equal(s.answer.perfect, false);
  assert.equal(s.score, 1);
});

test('Faiblesses éclair est vérifié par le serveur : Ball, ₽, Super Ball à 8 parfaits', () => {
  const { MODES } = require('../lib/verified-arcade');
  const { arcadeGain } = require('../lib/poke-balls');
  assert.ok(MODES.includes('weakspots'));
  assert.equal(arcadeGain('weakspots', 'win', 8).ball, 'great');
  assert.equal(arcadeGain('weakspots', 'win', 6).ball, 'poke');
});

const sql = { skip: !process.env.QA_DATABASE_URL, timeout: 60000 };
test('PostgreSQL: partie complète, réponse rejouée sans double point, gain une seule fois', sql, async () => {
  const { createBallService, initBallsDb } = require('../lib/poke-balls');
  const { Pool } = require('pg'), schema = 'weakspots_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }); let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await initBallsDb(db);
    const service = createBallService({ db, pokemon: catalog, secret: 'local-only', clock: () => new Date('2026-11-13T12:00:00Z'), randomInt: rnd });
    const me = { key: 'user:ws', guestKey: 'guest:ws', accountId: 'ws' };
    await service.state(me);
    let a = (await service.arcadeStart(me, { mode: 'weakspots', startId: randomUUID(), gens: [1, 2, 3] })).arcade;
    let paid = 0;
    for (let r = 0; r < 10; r++) {
      const choice = WS.weaknesses(a.question.types).map(([t]) => t);
      const body = { mode: 'weakspots', sessionId: a.sessionId, round: a.round, choice };
      const replies = await Promise.all([service.arcadeAnswer(me, body), service.arcadeAnswer(me, { ...body, choice: choice.slice().reverse() })]);
      assert.equal(replies.filter((x) => !x.replayed).length, 1);
      paid += replies.flatMap((x) => x.added || []).filter((g) => g.source === 'mode:weakspots').length;
      a = replies[0].arcade;
      if (r < 9) a = (await service.arcadeNext(me, { mode: 'weakspots', sessionId: a.sessionId, round: a.round })).arcade;
    }
    assert.equal(a.phase, 'over'); assert.equal(a.score, 10);
    assert.equal(paid, 1);
    await assert.rejects(service.arcadeAnswer(me, { mode: 'weakspots', sessionId: a.sessionId, round: a.round, choice: ['Feu'] }), /answer_conflict/);
  } finally { if (db) await db.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.end(); }
});
