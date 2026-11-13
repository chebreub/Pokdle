'use strict';
// 🔗 Dernière lettre : règles (lettres, déjà joué, horloge du serveur, Bot qui sèche, changer de lettre),
// puis la partie complète par le service des Balls (PostgreSQL) : Ball et ₽ seulement pour la 1re partie du jour.
const test = require('node:test'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const LL = require('../lib/last-letter');

const POKE = [
  { id: 25, name: 'Pikachu', generation: 1 }, { id: 217, name: 'Ursaring', generation: 2 },
  { id: 282, name: 'Gardevoir', generation: 3 }, { id: 19, name: 'Rattata', generation: 1 },
  { id: 65, name: 'Alakazam', generation: 1 }, { id: 151, name: 'Mew', generation: 1 },
  { id: 122, name: 'M. Mime', generation: 1 }, { id: 29, name: 'Nidoran♀', generation: 1 },
  { id: 6, name: 'Dracaufeu', generation: 1 }, { id: 133, name: 'Évoli', generation: 1 },
  { id: 20, name: 'Rattatac', generation: 1 }, { id: 135, name: 'Voltali', generation: 1 },
];
// Le Bot pioche toujours le premier choix possible et ne sèche jamais (randomInt(1000) = 999).
const rnd = (n) => (n === 1000 ? 999 : 0);

test('les lettres ignorent accents, espaces, points et symboles', () => {
  assert.equal(LL.letters('M. Mime'), 'mmime');
  assert.equal(LL.lastLetter('Nidoran♀'), 'n');
  assert.equal(LL.firstLetter('Évoli'), 'e');
  assert.equal(LL.lastLetter('Porygon-Z'), 'z');
});

test('une partie : bonne lettre, déjà joué, Bot qui répond, horloge de 15 s', () => {
  let now = 1000000;
  const g = LL.createLastLetter(POKE, rnd, () => new Date(now));
  const s = { mode: 'lastletter', phase: 'playing', gens: [1, 2, 3] };
  // Aucune génération possible : le Bot ne peut pas ouvrir.
  assert.throws(() => g.init({ ...s, gens: [9] }), /unavailable/);
  const many = [...POKE, ...'abcdefghij'.split('').map((c, i) => ({ id: 900 + i, name: 'U' + c + 'x', generation: 1 }))];
  const g2 = LL.createLastLetter(many.map((p, i) => ({ ...p, name: p.id >= 900 ? 'Ur' + 'abcdefghij'[i - POKE.length] + 'a' : p.name })), rnd, () => new Date(now));
  g2.init(s);
  assert.equal(s.chain.length, 1); assert.equal(s.chain[0].by, 'bot');
  const letter = s.letter;
  const right = many.find((p) => LL.firstLetter(p.name) === letter && !s.used.includes(p.id) && p.id < 900);
  const wrong = POKE.find((p) => LL.firstLetter(p.name) !== letter);
  assert.throws(() => g2.answer(s, wrong.id), /wrong_letter/);
  assert.throws(() => g2.answer(s, 99999), /invalid_choice/);
  if (right) {
    g2.answer(s, right.id);
    assert.equal(s.score >= 1, true);
    assert.throws(() => g2.answer(s, right.id), /already_used|wrong_letter/);
  }
  // L'horloge : 15 s + 1,5 s de marge pour le réseau.
  assert.equal(g2.expire(s), false);
  now += LL.TURN_MS + LL.GRACE_MS;
  assert.equal(g2.expire(s), true);
  assert.equal(s.phase, 'over'); assert.deepEqual(s.event, { kind: 'time' });
});

test('le Bot qui sèche donne 2 points et relance ; « Changer de lettre » 2 fois seulement', () => {
  const now = 2000000;
  const names = ['Pikachu', 'Ursaring', 'Gardevoir', 'Rattata', 'Alakazam', 'Mew', 'Nidoran', 'Natu', 'Noctali', 'Nosferapti', 'Nidorina', 'Nidoking'];
  const list = names.map((name, i) => ({ id: i + 1, name, generation: 1 }));
  let botFails = false;
  const r = (n) => (n === 1000 ? (botFails ? 0 : 999) : 0);
  const g = LL.createLastLetter(list, r, () => new Date(now));
  const s = { mode: 'lastletter', phase: 'playing', gens: [1] };
  s.chain = []; s.used = []; s.score = 0; s.passes = LL.PASSES; s.round = 0;
  // On force la lettre « n » pour le test.
  s.letter = 'n'; s.turnEndsAt = now + LL.TURN_MS;
  botFails = true;
  g.answer(s, 7); // Nidoran → « n », le Bot sèche
  assert.equal(s.score, 1 + 2);
  assert.equal(s.event.kind, 'bot_stuck');
  g.pass(s); g.pass(s);
  assert.throws(() => g.pass(s), /no_pass/);
  assert.equal(g.result(s).result, 'loss');
  assert.equal(g.result({ ...s, score: LL.WIN_AT }).result, 'win');
});

test('Dernière lettre est un jeu vérifié par le serveur (Ball et ₽), Super Ball à 20 points', () => {
  const { MODES } = require('../lib/verified-arcade');
  const { arcadeGain } = require('../lib/poke-balls');
  assert.ok(MODES.includes('lastletter'));
  assert.equal(arcadeGain('lastletter', 'win', 20).ball, 'great');
  assert.equal(arcadeGain('lastletter', 'win', 12).ball, 'poke');
  assert.equal(arcadeGain('lastletter', 'loss', 3).source, 'mode:lastletter');
});

const sql = { skip: !process.env.QA_DATABASE_URL, timeout: 60000 };
test('PostgreSQL: une partie complète, réponses rejouées sans double compte, gain à la fin du temps', sql, async () => {
  const { createBallService, initBallsDb } = require('../lib/poke-balls');
  const { Pool } = require('pg'), schema = 'lastletter_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }); let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await initBallsDb(db);
    let now = Date.parse('2026-11-13T12:00:00Z');
    const pokemon = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../pokemon.js'), 'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
    const service = createBallService({ db, pokemon, secret: 'local-only', clock: () => new Date(now), randomInt: (n) => (n === 1000 ? 999 : 0) });
    const me = { key: 'user:ll', guestKey: 'guest:ll', accountId: 'll' };
    await service.state(me);
    let a = (await service.arcadeStart(me, { mode: 'lastletter', startId: randomUUID(), gens: [1] })).arcade;
    assert.equal(a.chain.length, 1); assert.equal(a.chain[0].by, 'bot');
    const named = new Map(pokemon.filter((p) => !p.isAltForm && p.id <= 1025).map((p) => [p.id, p]));
    const usedNow = new Set(a.chain.map((c) => c.id));
    const pick = (letter) => [...named.values()].find((p) => LL.firstLetter(p.name) === letter && !usedNow.has(p.id));
    const p1 = pick(a.letter);
    const reqs = await Promise.all([0, 1].map(() => service.arcadeAnswer(me, { mode: 'lastletter', sessionId: a.sessionId, round: a.round, choice: p1.id })
      .catch((e) => ({ error: e.code }))));
    assert.equal(reqs.filter((r) => r.arcade && !r.replayed).length, 1, 'une seule réponse acceptée');
    a = reqs.find((r) => r.arcade && !r.replayed).arcade;
    assert.equal(a.score, 1);
    a.chain.forEach((c) => c.id && usedNow.add(c.id));
    await assert.rejects(service.arcadeAnswer(me, { mode: 'lastletter', sessionId: a.sessionId, round: a.round, choice: p1.id }), /already_used|wrong_letter/);
    // Le temps du tour passe : la partie finit et paie sa 1re partie du jour.
    now += 17000;
    const end = await service.arcadeFinish(me, { mode: 'lastletter', sessionId: a.sessionId, round: a.round });
    assert.equal(end.arcade.phase, 'over');
    assert.equal(end.added.filter((g) => g.source === 'mode:lastletter').length, 1);
    assert.equal(end.coinsAdded.length, 1);
    const again = await service.arcadeFinish(me, { mode: 'lastletter', sessionId: a.sessionId, round: a.round });
    assert.ok(again.replayed || again.arcade.phase === 'over');
    assert.equal((again.added || []).length, 0, 'pas de 2e paiement');
  } finally { if (db) await db.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.end(); }
});
