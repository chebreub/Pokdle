'use strict';
// 🎉 Inviter un ami en un appui (8/11/2026) : seulement entre amis, vers un salon vivant, une fois par salon,
// 40 par jour, gardées 2 heures, fermables, effacées avec le compte.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const lib = require('../lib/party-friend-invites');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '')`;

async function withSchema(run) {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'pfi_' + randomUUID().replaceAll('-', '');
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

function setup(db, rooms) {
  const friendsOf = { A: ['B', 'C'], B: ['A'], C: ['A'], D: [] };
  const pushes = [];
  const invites = lib.createPartyFriendInvites({
    db,
    friends: { areFriends: async (a, b) => (friendsOf[a] || []).includes(String(b)) },
    accountOfPid: async (_db, pid) => ({ pB: 'B', pC: 'C', pD: 'D', pA: 'A' })[pid] || null,
    playerPid: (id) => 'p' + id,
    roomStatus: (code) => rooms[code] || { ok: false, errorCode: 'invite_expired' },
    push: async (to, payload) => { pushes.push({ to, payload }); return 1; },
  });
  return { invites, pushes };
}

test('only friends, only a live room, once per room; the friend sees it and can close it', { skip: !process.env.QA_DATABASE_URL }, async () => {
  await withSchema(async (db) => {
    await db.query(USERS);
    await db.query("INSERT INTO users VALUES ('A','Kayan'),('B','Jade'),('C','Fabi'),('D','Gecko')");
    await lib.ensureTables(db);
    const rooms = { ABC12: { ok: true, gameMode: 'dessin' } };
    const { invites, pushes } = setup(db, rooms);
    assert.deepEqual(await invites.send('A', { pids: ['pB', 'pD', 'pA'], code: 'abc12' }), { ok: true, sent: 1 }, 'Gecko is not a friend, no self-invite');
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].to, 'B');
    assert.match(pushes[0].payload.title, /Kayan t’invite à Dessine-le !/);
    assert.equal(pushes[0].payload.url, '/?party=ABC12');
    await invites.send('A', { pids: ['pB'], code: 'ABC12' });
    assert.equal(pushes.length, 1, 'no second notification for the same room');
    const seen = await invites.list('B');
    assert.equal(seen.invites.length, 1);
    assert.equal(seen.invites[0].from.username, 'Kayan');
    assert.equal(seen.invites[0].game, 'Dessine-le !');
    rooms.ABC12 = { ok: false, errorCode: 'invite_started' };
    assert.equal((await invites.list('B')).invites.length, 0, 'a started room is not offered');
    rooms.ABC12 = { ok: true, gameMode: 'dessin' };
    assert.deepEqual(await invites.dismiss('B', { id: seen.invites[0].id }), { ok: true });
    assert.equal((await invites.list('B')).invites.length, 0, 'closed');
    assert.deepEqual(await invites.send('A', { pids: ['pC'], code: 'ZZZZ9' }), { ok: false, error: 'invite_expired' });
    assert.deepEqual(await invites.send('A', { pids: ['pC'], code: 'bad code!' }), { ok: false, error: 'bad_code' });
  });
});

test('40 invitations a day at most', { skip: !process.env.QA_DATABASE_URL }, async () => {
  await withSchema(async (db) => {
    await db.query(USERS);
    await db.query("INSERT INTO users VALUES ('A','Kayan'),('B','Jade')");
    await lib.ensureTables(db);
    for (let i = 0; i < lib.PER_DAY; i++) await db.query("INSERT INTO party_friend_invites (from_id, to_id, code) VALUES ('A','B','OLD" + i + "')");
    const { invites } = setup(db, { NEW11: { ok: true, gameMode: 'petitbac' } });
    assert.deepEqual(await invites.send('A', { pids: ['pB'], code: 'NEW11' }), { ok: false, error: 'daily_limit' });
  });
});

test('wired in the server, erased with the account, shown in the lobby and on the home', () => {
  const server = read('server.js');
  assert.match(server, /salonInviteLib\.mountPartyInviteRoutes\(app, /);
  assert.match(server, /roomStatus: \(code\) => partyInviteStatus\(partyRooms\.get\(code\)\)/);
  assert.match(server, /\["party_friend_invites", "DELETE FROM party_friend_invites WHERE from_id = \$1 OR to_id = \$1", \[id\]\]/);
  const src = read('src/script.10xzzv.party-friend-invites.js');
  assert.match(src, /if \(!window\.__pokedleAuthed \|\| !friends\.length\) return '';/, 'nothing without an account or friends');
  assert.match(src, /pfiState\.sentFor === code/, 'sent once per room');
  assert.match(src, /frHomeLineHtml = function/);
  assert.doesNotMatch(src, /<button[^>]*data-action="partyCreateRoom"/, 'the original create button stays the only one');
});
