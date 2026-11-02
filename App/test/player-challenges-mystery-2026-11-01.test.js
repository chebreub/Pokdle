'use strict';
// « Trouve ce Pokémon » (01/11/2026): the challenger picks a Pokémon, kept on the server; the other
// player guesses it with the clues of the Pokémon du jour, compared by the server, in 6, 8 or 10 tries.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const lib = require('../lib/player-challenges');
const { compareDaily } = require('../lib/daily-comparison');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;
const SCORES = `CREATE TABLE scores (discord_id TEXT NOT NULL, mode TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0,
  username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (discord_id, mode))`;
const POKEMON = [
  { id: 6, name: 'Dracaufeu', type1: 'Feu', type2: 'Vol', gen: 1, habitat: 'Montagne', color: 'Rouge', stage: 3, height: 1.7, weight: 90.5 },
  { id: 94, name: 'Ectoplasma', type1: 'Spectre', type2: 'Poison', gen: 1, habitat: 'Grotte', color: 'Violet', stage: 3, height: 1.5, weight: 40.5 },
  { id: 110, name: 'Smogogo', type1: 'Poison', type2: null, gen: 1, habitat: 'Urbain', color: 'Violet', stage: 2, height: 1.2, weight: 9.5 },
  { id: 778, name: 'Mimiqui', type1: 'Spectre', type2: 'Fée', gen: 7, habitat: 'Forêt', color: 'Jaune', stage: 1, height: 0.2, weight: 0.7 },
  { id: 25, name: 'Pikachu', type1: 'Électrik', type2: null, gen: 1, habitat: 'Forêt', color: 'Jaune', stage: 2, height: 0.4, weight: 6 },
  { id: 10034, name: 'Méga-Dracaufeu X', type1: 'Feu', type2: 'Dragon', gen: 6, isAltForm: true, habitat: 'Montagne', color: 'Noir', stage: 3, height: 1.7, weight: 110.5 },
];

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

test('the site: a « Trouve ce Pokémon » tab, a game window whose clues come from the server', () => {
  const src = read('src/script.10xq.player-challenges.js');
  assert.match(src, /if \(pcForm\.tab === 'pokemon'\) return Object\.assign\(base, \{ mode: PC_MYSTERY, pokemonId: pcForm\.pokemonId, attempts: pcForm\.attempts \}\);/);
  assert.match(src, /pcPost\('\/api\/challenges\/guess', \{ id: pcGame\.id, pokemonId: id \}\)/, 'each try goes to the server');
  assert.match(src, /var state = row\.cmp\[cell\[0\]\] \|\| 'wrong';/, 'the colours come from the server\'s comparison');
  assert.doesNotMatch(src, /secretPokemon/, 'the game never holds the answer while it is played');
  assert.match(src, /if \(c && c\.kind === 'mystere'\) return openMysteryGame\(c\.id\);/);
  assert.match(read('server.js'), /pokemon: POKEMON_LIST, compare: require\("\.\/lib\/daily-comparison"\)\.compareDaily,/);
});

test('PostgreSQL: the hidden Pokémon, tries compared by the server, found or not, told to both', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  await withSchema('mystery_', async (db) => {
    await db.query(USERS); await db.query(SCORES);
    await db.query("INSERT INTO users(discord_id, username) VALUES ('A', 'Kayan'), ('B', 'Sacha')");
    await lib.ensureTables(db);
    await lib.ensureTables(db); // a second start keeps the table as it is
    const pushed = [];
    const duels = lib.createPlayerChallenges({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid, pokemon: POKEMON, compare: compareDaily,
      push: async (to, payload) => { pushed.push({ to, ...payload }); return 1; } });
    const B = ids.playerPid('B');
    assert.deepEqual((await duels.options('A')).mystery, { attempts: [6, 8, 10] });

    // No record needed; a real Pokémon (never a form) and 6, 8 or 10 tries.
    assert.deepEqual(await duels.create('A', { pid: B, mode: 'pokemon', phrase: 5, pokemonId: 9999, attempts: 8 }), { ok: false, error: 'pokemon' });
    assert.deepEqual(await duels.create('A', { pid: B, mode: 'pokemon', phrase: 5, pokemonId: 10034, attempts: 8 }), { ok: false, error: 'pokemon' });
    assert.deepEqual(await duels.create('A', { pid: B, mode: 'pokemon', phrase: 5, pokemonId: 94, attempts: 7 }), { ok: false, error: 'attempts' });
    const sent = await duels.create('A', { pid: B, mode: 'pokemon', phrase: 5, pokemonId: 94, attempts: 6 });
    assert.deepEqual(sent, { ok: true, id: sent.id, target: 6 });
    await new Promise((r) => setImmediate(r));
    assert.equal(pushed.pop().body, 'Trouve son Pokémon mystère en 6 essais. « Tu le trouveras jamais 😏 »');

    // The challenged player never gets the answer while playing; the challenger always does.
    const open = (await duels.list('B')).challenges[0];
    assert.equal(open.kind, 'mystere'); assert.equal(open.tries, 0); assert.equal('secretId' in open, false);
    assert.equal((await duels.list('A')).challenges[0].secretId, 94);
    const start = await duels.game('B', sent.id);
    assert.equal(start.answerId, undefined); assert.equal(start.incoming, true); assert.equal(start.other.username, 'Kayan');
    assert.equal((await duels.game('A', sent.id)).answerId, 94);
    assert.deepEqual(await duels.game('C', sent.id), { ok: false, error: 'unknown' }, 'nobody else');

    const first = await duels.guess('B', { id: sent.id, pokemonId: 6 });
    assert.equal(first.status, 'open'); assert.equal(first.attempts, 1); assert.equal(first.answerId, undefined);
    assert.deepEqual(first.rows[0], { pokemonId: 6, cmp: compareDaily(POKEMON[0], POKEMON[1]), generationDirection: '', heightDirection: '↓', weightDirection: '↓' });
    assert.equal((await duels.guess('B', { id: sent.id, pokemonId: 6 })).duplicate, true, 'the same Pokémon twice costs nothing');
    assert.deepEqual(await duels.guess('A', { id: sent.id, pokemonId: 94 }), { ok: false, error: 'unknown' }, 'the challenger cannot play it');
    assert.deepEqual(await duels.guess('B', { id: sent.id, pokemonId: 4242 }), { ok: false, error: 'invalid_guess' });
    await duels.guess('B', { id: sent.id, pokemonId: 110 });
    const found = await duels.guess('B', { id: sent.id, pokemonId: 94 });
    assert.equal(found.status, 'won'); assert.equal(found.attempts, 3); assert.equal(found.answerId, 94); assert.equal(found.fresh, true);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(pushed.pop(), { to: 'A', title: '🏆 Sacha a trouvé ton Pokémon mystère', body: 'Ectoplasma en 3 essais sur 6. Revanche ?', url: '/?defis=1', tag: 'pokedle-defi' });
    assert.equal((await duels.guess('B', { id: sent.id, pokemonId: 25 })).attempts, 3, 'a finished game takes no more tries');
    const forA = (await duels.list('A')).challenges[0];
    assert.equal(forA.status, 'won'); assert.equal(forA.best, 3); assert.equal(forA.seen, false);
    assert.equal((await duels.list('B')).challenges[0].secretId, 94, 'named once it is over');

    // Not found within the tries: lost, and the answer is shown.
    const hard = await duels.create('A', { pid: B, mode: 'pokemon', phrase: 0, pokemonId: 778, attempts: 6 });
    let last;
    for (const id of [6, 94, 110, 25]) last = await duels.guess('B', { id: hard.id, pokemonId: id });
    assert.equal(last.status, 'open');
    await db.query("UPDATE player_challenges SET target = 4 WHERE id = $1", [hard.id]); // 6 tries is long for a test
    const back = await duels.game('B', hard.id);
    assert.equal(back.attempts, 4); assert.equal(back.max, 4);
    await db.query("UPDATE player_challenges SET target = 5 WHERE id = $1", [hard.id]);
    last = await duels.guess('B', { id: hard.id, pokemonId: 10034 });
    assert.equal(last.status, 'lost'); assert.equal(last.answerId, 778);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(pushed.pop(), { to: 'A', title: "💪 Sacha n'a pas trouvé ton Mimiqui", body: "5 essais, sans le trouver. Bien joué !", url: '/?defis=1', tag: 'pokedle-defi' });

    // Seven days without finding it: over, no more tries.
    const late = await duels.create('A', { pid: B, mode: 'pokemon', phrase: 0, pokemonId: 25, attempts: 10 });
    await db.query("UPDATE player_challenges SET expires_at = now() - interval '1 minute' WHERE id = $1", [late.id]);
    const closed = await duels.guess('B', { id: late.id, pokemonId: 6 });
    assert.equal(closed.status, 'expired'); assert.equal(closed.attempts, 0); assert.equal(closed.answerId, 25);
  });
});
