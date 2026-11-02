'use strict';
// Défis v2, étape 1 (01/11/2026, « carte blanche »): 15 games (play first when there is no record
// yet), the Draft of one generation, « 📅 Du jour » (fewer tries at today's Pokémon), a duration of
// 24 h, 3 or 7 days, a free message between friends, several friends at once, 20 a day between
// friends and still 5 with the other players. A target at the game's maximum is won by matching it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const lib = require('../lib/player-challenges');
const friendLib = require('../lib/player-friends');
const { checkBody } = require('../lib/friend-chat');

const USERS = `CREATE TABLE users (discord_id TEXT PRIMARY KEY, username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  partner_id INTEGER, xp INTEGER, photo_key TEXT, photo BYTEA)`;
const SCORES = `CREATE TABLE scores (discord_id TEXT NOT NULL, mode TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0,
  username TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (discord_id, mode))`;

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

test('15 games to challenge, each one with a score the server keeps', () => {
  const main = Object.keys(lib.CHALLENGE_MODES).filter((mode) => !/^draft_\d$/.test(mode));
  assert.equal(main.length, 15);
  for (let gen = 1; gen <= 9; gen += 1) assert.equal(lib.CHALLENGE_MODES['draft_' + gen].label, 'Draft Gen ' + gen);
  const server = read('server.js');
  for (const mode of ['pixel10', 'silhouette10', 'cry10', 'description10', 'shiny', 'petitbac']) {
    assert.match(server, new RegExp('\\n  ' + mode + ': \\{ direction: "desc"'), mode + ' is stored by /api/leaderboard/result');
  }
  assert.match(server, /\n  party: \{ direction: "desc"/);
  // The guessing series send their score at the end of a series of 10 only.
  assert.match(read('src/script.10xm.guess-series.js'), /if \(s\.index >= s\.total && s\.total === 10 && s\.found > 0 && typeof submitLeaderboardResult === 'function'\) submitLeaderboardResult\(s\.mode \+ '10', s\.found\);/);
  const board = read('src/script.10g.leaderboard-v2.js');
  assert.match(board, /if \(mode === "shiny"\) return \{mode:"shiny",score:Number\(entry\.attempts\)\|\|0\};/);
  assert.match(board, /if \(mode === "petitbac"\) return \{mode:"petitbac",score:Number\(entry\.attempts\)\|\|0\};/);
  // A challenge in a guessing game always plays 10, whatever size the player keeps.
  const src = read('src/script.10xq.player-challenges.js');
  for (const mode of ['pixel', 'silhouette', 'cry', 'description']) assert.match(src, new RegExp('  ' + mode + "10: function \\(\\) \\{ startGuessSeries\\('" + mode + "', 10\\); \\},"));
  assert.match(src, /draft_3: function \(\) \{ pcOpenDraft\(3\); \},/);
});

test('the site: play first, « Du jour », durations, a note for friends, several friends, the clipped list', () => {
  const src = read('src/script.10xq.player-challenges.js');
  assert.match(src, /'<button type="button" class="btn-blue pc-send" data-action="' \+ \(playFirst \? 'pcPlayFirst' : 'sendChallenge'\) \+ '"'/);
  assert.match(src, /pcPending\.timer = setTimeout\(pcSendPending, PC_PER_ANSWER\[mode\] \? 9000 : 600\);/, 'the first score sends the challenge');
  assert.match(src, /tab\('jour', '📅 Du jour'\)/);
  assert.match(src, /if \(c && c\.kind === PC_DAILY\) \{\n {4}closeOverlayModal\(\);\n {4}if \(typeof startDailyGame === 'function'\) startDailyGame\(\);/);
  assert.match(src, /\(d === 1 \? '24 h' : d \+ ' jours'\)/);
  assert.match(src, /data-pc-allfriends="1" class="is-all">\+ Tous mes amis<\/button>/);
  assert.match(src, /escapeHtml\(c\.note \|\| c\.phrase\)/, 'the friend\'s message replaces the phrase');
  assert.match(read('src/script.10xs.inbox-visibility.js'), /if \(c\.kind === 'jour'\) return 'Pokémon du jour en moins de ' \+ Number\(c\.target\) \+ ' essais, aujourd’hui';/);
  const css = read('game-shell.css');
  assert.match(css, /#pokdle-app #challenge-panel \{overflow:visible!important;\}/, 'the « Défi ami » list is no longer cut');
  assert.match(css, /\.pc-note-input \{[^}]*font:700 16px Nunito/, '16 px: no zoom on iPhone');
});

test('PostgreSQL: durations, a note between friends, 20 a day with friends and 5 with others, the maximum, the Draft of a generation', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  await withSchema('duel2_', async (db) => {
    await db.query(USERS); await db.query(SCORES);
    const people = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    await db.query("INSERT INTO users(discord_id, username) SELECT x, 'P' || x FROM unnest($1::text[]) x", [people]);
    await db.query("INSERT INTO scores(discord_id, mode, score) VALUES ('A', 'quiz', 15), ('A', 'higherlower', 9), ('A', 'draft_3', 520), ('A', 'pixel10', 7)");
    await friendLib.ensureTables(db); await lib.ensureTables(db); await lib.ensureTables(db);
    const friends = friendLib.createPlayerFriends({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid });
    const pushed = [];
    const duels = lib.createPlayerChallenges({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid, friends, checkNote: checkBody,
      push: async (to, payload) => { pushed.push({ to, ...payload }); return 1; } });
    const pid = Object.fromEntries(people.map((x) => [x, ids.playerPid(x)]));
    await friends.request('A', { pid: pid.B }); await friends.request('B', { pid: pid.A });

    const options = await duels.options('A');
    assert.deepEqual(options.dayChoices, [1, 3, 7]);
    assert.equal(options.noteMax, 100);
    assert.equal(options.modes.find((m) => m.mode === 'quiz').max, 15);
    assert.equal(options.modes.find((m) => m.mode === 'draft_3').record, 520);
    assert.equal(options.modes.find((m) => m.mode === 'shiny').record, 0, 'no record yet: play first');

    // A duration from the list; 24 h ends a day from now.
    assert.deepEqual(await duels.create('A', { pid: pid.B, mode: 'quiz', phrase: 0, days: 2 }), { ok: false, error: 'days' });
    const short = await duels.create('A', { pid: pid.B, mode: 'quiz', phrase: 0, days: 1, note: '  Toi tu passes pas 15 😏  ' });
    assert.equal(short.ok, true);
    const hours = (await db.query('SELECT EXTRACT(EPOCH FROM expires_at - created_at) / 3600 AS h, note FROM player_challenges WHERE id = $1', [short.id])).rows[0];
    assert.ok(Math.abs(Number(hours.h) - 24) < 0.1);
    assert.equal(hours.note, 'Toi tu passes pas 15 😏');
    const seenByB = (await duels.list('B')).challenges[0];
    assert.equal(seenByB.note, 'Toi tu passes pas 15 😏');
    assert.equal(seenByB.max, 15);
    assert.match(pushed.at(-1).body, /« Toi tu passes pas 15 😏 »$/);

    // The note: friends only, 100 characters, no links nor numbers.
    assert.deepEqual(await duels.create('A', { pid: pid.C, mode: 'quiz', phrase: 0, note: 'salut' }), { ok: false, error: 'note_friends' });
    assert.deepEqual(await duels.create('A', { pid: pid.B, mode: 'higherlower', phrase: 0, note: 'x'.repeat(101) }), { ok: false, error: 'note' });
    assert.deepEqual(await duels.create('A', { pid: pid.B, mode: 'higherlower', phrase: 0, note: 'viens sur snap' }), { ok: false, error: 'note_contact' });

    // At the maximum (15 / 15 au Quiz): matching it wins; elsewhere, beating it strictly.
    assert.deepEqual((await duels.afterResult('B', 'quiz', 14)).map((r) => r.won), [false]);
    assert.deepEqual((await duels.afterResult('B', 'quiz', 15)).map((r) => r.won), [true]);
    const hl = await duels.create('A', { pid: pid.B, mode: 'higherlower', phrase: 1 });
    assert.equal(hl.target, 9);
    assert.deepEqual((await duels.afterResult('B', 'higherlower', 9)).map((r) => r.won), [false]);
    assert.deepEqual((await duels.afterResult('B', 'higherlower', 10)).map((r) => r.won), [true]);

    // The Draft of one generation is its own challenge; a series of 10 too.
    const draft = await duels.create('A', { pid: pid.B, mode: 'draft_3', phrase: 2 });
    assert.equal(draft.target, 520);
    assert.deepEqual(await duels.afterResult('B', 'draft_all', 600), [], 'another Draft does not count');
    assert.deepEqual((await duels.afterResult('B', 'draft_3', 530)).map((r) => r.won), [true]);
    assert.equal((await duels.create('A', { pid: pid.B, mode: 'pixel10', phrase: 0 })).target, 7);
    assert.deepEqual((await duels.create('A', { pid: pid.B, mode: 'shiny', phrase: 0 })), { ok: false, error: 'no_record' });

    // 5 a day to other players, then only friends, up to 20 in all.
    for (const x of ['C', 'D', 'E', 'F', 'G']) assert.equal((await duels.create('A', { pid: pid[x], mode: 'quiz', phrase: 0 })).ok, true, x);
    assert.deepEqual(await duels.create('A', { pid: pid.H, mode: 'quiz', phrase: 0 }), { ok: false, error: 'limit' });
    const left = await duels.options('A');
    assert.equal(left.left, 0);
    assert.equal(left.leftFriends, 20 - 9, '4 to B and 5 to the others');
    assert.equal((await duels.create('A', { pid: pid.B, mode: 'speedrun', phrase: 0 })).error, 'no_record', 'a friend can still be challenged');
    await db.query("INSERT INTO scores(discord_id, mode, score) VALUES ('A', 'speedrun', 30)");
    assert.equal((await duels.create('A', { pid: pid.B, mode: 'speedrun', phrase: 0 })).ok, true);
  });
});

test('PostgreSQL: « Du jour » — fewer tries at today\'s Pokémon, decided by the day\'s play, ends at midnight', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const ids = require('../lib/player-ids');
  ids.setPlayerIdSecret('test-secret');
  await withSchema('duel3_', async (db) => {
    await db.query(USERS); await db.query(SCORES);
    await db.query("INSERT INTO users(discord_id, username) VALUES ('A', 'Kayan'), ('B', 'Sacha'), ('C', 'Ondine')");
    await require('../lib/daily-game').initDailyDb(db);
    await db.query("INSERT INTO daily_rounds(day, secret_id) VALUES (timezone('Europe/Paris', now())::date, 25)");
    const play = (who, tries, status) => db.query(`INSERT INTO daily_plays(identity, day, account_id, guessed, status)
      VALUES ($1, timezone('Europe/Paris', now())::date, $1, $2::jsonb, $3)
      ON CONFLICT (identity, day) DO UPDATE SET guessed = EXCLUDED.guessed, status = EXCLUDED.status`, [who, JSON.stringify(Array.from({ length: tries }, (_, i) => i + 1)), status]);
    await lib.ensureTables(db);
    const pushed = [];
    const duels = lib.createPlayerChallenges({ db, accountOfPid: ids.accountOfPid, playerPid: ids.playerPid,
      push: async (to, payload) => { pushed.push({ to, ...payload }); return 1; } });
    const B = ids.playerPid('B'), C = ids.playerPid('C');

    assert.equal((await duels.options('A')).daily, null);
    assert.deepEqual(await duels.create('A', { pid: B, mode: 'jour', phrase: 0 }), { ok: false, error: 'no_daily' }, 'find it first');
    await play('A', 3, 'won');
    assert.deepEqual((await duels.options('A')).daily, { tries: 3 });
    await play('C', 2, 'won');
    assert.deepEqual(await duels.create('A', { pid: C, mode: 'jour', phrase: 0 }), { ok: false, error: 'daily_done' }, 'already played today');
    const sent = await duels.create('A', { pid: B, mode: 'jour', phrase: 0 });
    assert.deepEqual(sent, { ok: true, id: sent.id, target: 3 });
    assert.equal(pushed.at(-1).body.startsWith('Trouve le Pokémon du jour en moins de 3 essais, aujourd’hui.'), true);
    const row = (await db.query(`SELECT expires_at <= ((date_trunc('day', timezone('Europe/Paris', now())) + interval '1 day') AT TIME ZONE 'Europe/Paris') AS by_midnight
      FROM player_challenges WHERE id = $1`, [sent.id])).rows[0];
    assert.equal(row.by_midnight, true, 'ends at midnight in Paris');

    // Still playing: open. Found in 3 (not fewer): lost.
    await play('B', 2, 'playing');
    assert.equal((await duels.list('A')).challenges[0].status, 'open');
    await play('B', 3, 'won');
    const lost = (await duels.list('B')).challenges[0];
    assert.equal(lost.status, 'lost');
    assert.equal(lost.kind, 'jour');
    assert.equal(lost.best, 3);

    // Another day, another challenge: found in 2 → won, and the challenger is told.
    await db.query('DELETE FROM player_challenges');
    await db.query("DELETE FROM daily_plays WHERE identity = 'B'");
    const again = await duels.create('A', { pid: B, mode: 'jour', phrase: 1 });
    await play('B', 2, 'won');
    const won = (await duels.list('A')).challenges.find((c) => c.id === again.id);
    assert.equal(won.status, 'won');
    assert.equal(won.best, 2);
    assert.deepEqual(pushed.at(-1), { to: 'A', title: '🏆 Sacha a fait mieux que toi', body: 'Pokémon du jour en 2 essais contre 3. Revanche demain ?', url: '/?defis=1', tag: 'pokedle-defi' });
    assert.deepEqual(await duels.afterResult('B', 'jour', 1), [], 'never decided by a result the browser sends');
  });
});
