'use strict';
// Correctifs de l'audit GPT du 9/11/2026 (« go 1-6 ») : noms lisibles par les lecteurs d'écran, contraste sombre,
// profil sans texte superposé, une animation à la fois, invitations et Ball du sondage sans doublon ni perte.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const invitesLib = require('../lib/party-friend-invites');

test('short phone labels keep a readable name and the layout fixes are in place', () => {
  const css = read('game-shell.css');
  // Texte long caché à l'œil seulement (plus de display:none), pour les filtres, le menu du compte et les Paramètres.
  for (const sel of ['#screen-pokedex .colm-long{position:absolute', '.am2 .am2-long {position:absolute', '.as2 .as2-long {position:absolute']) assert.ok(css.includes(sel), sel);
  assert.doesNotMatch(css, /#screen-pokedex \.colm-long\{display:none\}/);
  assert.match(css, /body\.theme-dark #screen-pokedex \.colm-st small,[^{]*\{color:#d6cfdc\}/);
  assert.match(css, /#screen-profile \.profile-hero-main > p\{grid-area:auto;grid-column:1 \/ -1;/);
  assert.match(read('src/script.10xzy.home-motion.js'), /if \(document\.querySelector\('\.hm-has-scene\.hm-play'\)\) return;/);
  assert.match(read('src/script.10zzd.motion-all-modes.js'), /if \(document\.querySelector\('\.hm-has-scene\.hm-play'\)\) return;/);
  assert.match(read('lib/player-surveys.js'), /SAVEPOINT survey_ball/);
});

test('two simultaneous invites to the same friend give one invite and one notification', { skip: !process.env.QA_DATABASE_URL }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'afx_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '')`);
    await db.query("INSERT INTO users VALUES ('A','Kayan'),('B','Jade')");
    await invitesLib.ensureTables(db);
    const pushes = [];
    const invites = invitesLib.createPartyFriendInvites({
      db,
      friends: { areFriends: async () => true },
      accountOfPid: async (_db, pid) => ({ pB: 'B' })[pid] || null,
      playerPid: (id) => 'p' + id,
      roomStatus: () => ({ ok: true, gameMode: 'dessin' }),
      push: async (to) => { pushes.push(to); return 1; },
    });
    await Promise.all([1, 2, 3].map(() => invites.send('A', { pids: ['pB'], code: 'ABC12' })));
    assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM party_friend_invites")).rows[0].n, 1);
    assert.equal(pushes.length, 1);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});
