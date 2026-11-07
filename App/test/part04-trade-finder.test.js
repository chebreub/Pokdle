'use strict';
// PART-04 (7/11/2026): « 🔍 Trouver » in « Mes échanges » — the spare copies of all my friends at once,
// a search, and « Montrer mes doublons à mes amis ». Only duplicates are ever sent (never a friend's whole
// album nor what they miss); trade rules are unchanged and re-checked by the server.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const friendsLib = require('../lib/player-friends');
const trades = require('../lib/wild-trades');
const { initBallsDb } = require('../lib/poke-balls');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;
const caught = (db, who, id, shiny = false, n = 1) => db.query(
  "INSERT INTO wild_encounters(identity, account_id, day, pokemon_id, shiny, status, throws) SELECT $1, $2, '2026-11-02', $3, $4, 'caught', 1 FROM generate_series(1, $5)",
  [who, who.slice(5), id, shiny, n]);

test('PostgreSQL: Trouver lists only friends\' spare copies; hidden and blocked friends are left out', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'part04_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(USERS);
    await db.query("INSERT INTO users(discord_id, username) VALUES ('A','Kayan'),('B','Jade'),('C','Léo'),('D','Zoé'),('E','Inconnu')");
    await friendsLib.ensureTables(db); await initBallsDb(db); await trades.ensureTables(db); await trades.ensureTables(db);
    const fr = friendsLib.createPlayerFriends({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid });
    const tr = trades.createWildTrades({ db, friends: fr, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid, push: async () => 0, clock: () => new Date('2026-11-07T12:00:00Z') });
    const pid = (x) => ids.playerPid(x);
    for (const other of ['B', 'C', 'D']) {
      await fr.request('A', { pid: pid(other) });
      const req = (await fr.list(other)).incoming[0];
      await fr.respond(other, { id: req.id, accept: true });
    }
    await caught(db, 'user:A', 25, false, 1); await caught(db, 'user:A', 16, false, 3);
    await caught(db, 'user:B', 133, false, 2); await caught(db, 'user:B', 25, false, 3); await caught(db, 'user:B', 151, true, 2); await caught(db, 'user:B', 1, false, 1);
    await caught(db, 'user:C', 4, false, 2); await caught(db, 'user:D', 7, false, 2); await caught(db, 'user:E', 150, false, 2);
    await db.query("INSERT INTO player_challenge_blocks(account_id, blocked_id) VALUES ('D','A')");
    await tr.setShare('C', { share: false });

    const m = await tr.matches('A');
    assert.equal(m.ok, true);
    assert.equal(m.friendCount, 2, 'a blocked friend is not counted; a hidden one is');
    assert.deepEqual(m.friends, [{ pid: pid('B'), username: 'Jade', dupes: [{ id: 25, normal: 2, shiny: 0 }, { id: 133, normal: 1, shiny: 0 }, { id: 151, normal: 0, shiny: 1 }] }],
      'only spare copies: no single copy (n°1), no hidden friend (Léo), no blocked friend (Zoé), no stranger (n°150)');
    assert.deepEqual([...m.owned].sort((a, b) => a - b), [16, 25]);
    assert.deepEqual(m.mine, [{ id: 16, normal: 2, shiny: 0 }]);
    assert.equal(m.shareDupes, true, 'absent setting = shown, as before');
    assert.deepEqual([m.left, m.perDay], [3, 3]);
    assert.equal(JSON.stringify(m).includes('"username":"Inconnu"'), false);

    // Starting from a friend's Pokémon: the usual proposal and checks.
    const forC = await tr.friendDupes('A', pid('C'));
    assert.deepEqual([forC.hidden, forC.dupes], [true, []], 'a hidden friend shows nothing');
    assert.equal((await tr.propose('A', { pid: pid('C'), give: 16, want: 4 })).error, 'friend_not_a_duplicate', 'and cannot be asked for it');
    assert.equal((await tr.propose('A', { pid: pid('B'), give: 16, want: 133 })).ok, true);

    // The setting: boolean only, per account, reversible.
    assert.equal((await tr.setShare('A', { share: 'non' })).error, 'invalid');
    assert.deepEqual(await tr.setShare('A', { share: false }), { ok: true, shareDupes: false });
    assert.deepEqual((await tr.matches('B')).friends, [], 'Kayan hides his spares from Jade');
    assert.equal((await tr.matches('A')).shareDupes, false);
    await tr.setShare('A', { share: true });
    assert.deepEqual((await tr.matches('B')).friends.map((f) => f.username), ['Kayan']);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});

test('routes, account deletion and privacy page', () => {
  const lib = read('lib/wild-trades.js');
  assert.match(lib, /app\.get\("\/api\/trades\/matches", run\("matches"/);
  assert.match(lib, /app\.post\("\/api\/trades\/settings", json, run\("settings", \(user, body\) => trades\.setShare\(user\.id, \{ share: body\.share \}\)\)\);/);
  assert.match(read('server.js'), /\["trade_settings", "DELETE FROM trade_settings WHERE account_id = \$1", \[id\]\]/);
  assert.match(read('confidentialite.html'), /« Montrer mes doublons à mes amis »/);
});

test('client: the search filters a friend\'s spares by name or number, missing first', () => {
  const src = read('src/script.10xzg.trades.js');
  const pick = (name) => src.slice(src.indexOf('function ' + name + '('), src.indexOf('\n}\n', src.indexOf('function ' + name + '(')) + 3);
  const ctx = { POKEMON_BY_ID: new Map([[133, { id: 133, name: 'Évoli' }], [25, { id: 25, name: 'Pikachu' }], [151, { id: 151, name: 'Mew' }]]) };
  vm.runInNewContext(pick('tradeMon') + pick('tradeFold') + pick('tradeFindItems') + 'var tradeFind = { data: { owned: [25] }, q: "", filter: "missing", open: {} };', ctx);
  const friend = { dupes: [{ id: 25, normal: 2, shiny: 0 }, { id: 133, normal: 1, shiny: 0 }, { id: 151, normal: 0, shiny: 1 }] };
  const ids = () => ctx.tradeFindItems(friend).map((x) => x.id);
  assert.deepEqual(ids(), [133], 'Il me manque');
  ctx.tradeFind.filter = 'all'; assert.deepEqual(ids(), [25, 133]);
  ctx.tradeFind.filter = 'shiny'; assert.deepEqual(ids(), [151]);
  ctx.tradeFind.filter = 'all'; ctx.tradeFind.q = 'evoli'; assert.deepEqual(ids(), [133], 'accents ignored');
  ctx.tradeFind.q = '025'; assert.deepEqual(ids(), [25], 'by number');
  assert.match(src, /data-action="tradeStartWant"/);
  assert.match(src, /role="switch" aria-checked="' \+ share \+ '" data-action="tradeToggleShare"/);
});
