'use strict';
// A click on a ranked name opens that player's trainer card (31/10/2026), as on PokeQuizz.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setPlayerIdSecret, playerPid, accountOfPid } = require('../lib/player-ids');
const { createPlayerCards } = require('../lib/player-cards');
const { setChampions } = require('../lib/week-champions');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test('players are named by a public id, never by their account number', async () => {
  setPlayerIdSecret('');
  assert.equal(playerPid('123'), null, 'no secret, no id: the names are not clickable');
  setPlayerIdSecret('test-secret');
  const pid = playerPid('123456789');
  assert.match(pid, /^[0-9a-f]{16}$/);
  assert.equal(playerPid('123456789'), pid, 'always the same id for a player');
  assert.notEqual(playerPid('google:42'), pid);
  assert.ok(!pid.includes('123456789'));
  // After a restart the ids are found again from the accounts.
  setPlayerIdSecret('test-secret');
  const db = { query: async () => ({ rows: [{ discord_id: '123456789' }, { discord_id: 'google:42' }] }) };
  assert.equal(await accountOfPid(db, pid), '123456789');
  assert.equal(await accountOfPid(db, 'ffffffffffffffff'), null);
  assert.equal(await accountOfPid(db, '../etc/passwd'), null);
  for (const file of ['lib/day-boards.js', 'lib/daily-grid.js', 'lib/daily-petitbac.js']) assert.match(read(file), /pid:playerPid\(r\.discord_id\)/, file);
  assert.match(read('server.js'), /pid: playerPid\(row\.discord_id\),/);
  assert.match(read('server.js'), /setPlayerIdSecret\(SESSION_SECRET\);/);
  assert.match(read('server.js'), /app\.get\("\/api\/player\/:pid"/);
});

function cardApi() {
  const src = read('src/script.10g.leaderboard-v2.js');
  const code = between(src, 'const LEADERBOARD_V2_DEFAULT_AVATAR', 'function leaderboardV2ArcadeCounts(') +
    between(src, 'function leaderboardLevelPill(', "// The week's prize (31/10/2026)");
  const env = {
    POKEMON_BY_ID: new Map([[571, { id: 571, name: 'Zoroark' }], [149, { id: 149, name: 'Dracolosse' }], [201, { id: 201, name: 'Zarbi' }], [65, { id: 65, name: 'Alakazam' }], [137, { id: 137, name: 'Porygon' }]]),
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    getPokemonSprite: (p) => 'sprite-' + p.id,
    getPokemonShinySprite: (p) => 'shiny-sprite-' + p.id,
    pokedexDetailArtwork: (p, shiny) => (shiny ? 'shiny-art-' : 'art-') + p.id,
    pokemonIsRare: () => false,
    leaderboardV2FormatScore: (score) => score + ' pts',
    leaderboardV2ScoreHtml: (row) => row.score + ' pts',
    getXpTier: () => ({ level: 70, name: 'Maître', emoji: '👑' }),
    formatNumberFr: (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
  };
  return Function(...Object.keys(env), code + '; return { leaderboardV2Row, playerCardHtml };')(...Object.values(env));
}

test('a ranked row opens the card by a click, or Enter once focused', () => {
  const api = cardApi();
  const row = api.leaderboardV2Row({ rank: 4, username: 'Sacha', pid: 'abcdef0123456789', score: 44 }, 4, 'journey', 'pts');
  assert.match(row, /class="lbv2-row is-clickable" data-action="openPlayerCard" data-args='\["abcdef0123456789"\]' role="button" tabindex="0" aria-label="Voir la carte de dresseur de Sacha">/);
  assert.doesNotMatch(api.leaderboardV2Row({ rank: 4, username: 'Invité', score: 4 }, 4, 'journey', 'pts'), /openPlayerCard/, 'no public id, no link');
  const src = read('src/script.10g.leaderboard-v2.js');
  assert.match(src, /'<div class="lbv5-step is-' \+ metal[^\n]*leaderboardPlayerAttrs\(row\)/, 'the podium too');
  assert.match(src, /'<div class="lbv5-champion"'\+leaderboardPlayerAttrs\(row\)/, 'and last week\'s champion');
  assert.match(src, /event\.key === "Enter" \|\| event\.key === " "/);
});

test('the card shows the partner, the level, medals and what the player did', () => {
  const html = cardApi().playerCardHtml({
    player: { username: 'Kayan', partnerId: 571, champion: true, xp: 123368, pioneer: true, since: '2026-09', medals: { 1: 1, 2: 0, 3: 2 } },
    figures: { days: 34, found: 31, bestStreak: 12, points: 2840 },
    games: [{ game: 'enquete', played: 31, points: 1120 }, { game: 'wordlepts', played: 28, points: 220 }, { game: 'dossier', played: 1, points: 18 }, { game: 'challenge', played: 0, points: 0 }],
    records: [{ label: 'Quiz', unit: 'bonnes réponses', score: 15 }],
  });
  assert.match(html, /<div class="player-card-circle is-champion"><img src="shiny-art-571" data-fallback="shiny-sprite-571" alt="Zoroark shiny" \/>/);
  assert.match(html, /<h3>Kayan<\/h3>/);
  assert.match(html, /<span class="player-card-title">👑 Maître · Niv\. 70<\/span><span class="player-card-pioneer">✦ Pionnier<\/span><span class="profile-hero-medals">🥇 ×1 · 🥉 ×2<\/span>/);
  assert.match(html, /✨ Partenaire shiny : champion de la semaine/);
  assert.match(html, /<small>Membre depuis septembre 2026<\/small>/);
  assert.match(html, /<div><b>34<\/b><span>jours joués<\/span><\/div><div><b>31<\/b><span>Pokémon du jour trouvés<\/span><\/div><div><b>12 j<\/b><span>meilleure série<\/span><\/div><div><b>2 840<\/b><span>points cumulés<\/span><\/div>/);
  assert.match(html, /<b>Pokémon du jour<\/b><span>31 parties · 1 120 pts<\/span>/);
  assert.match(html, /<b>Dossier<\/b><span>1 partie · 18 pts<\/span>/);
  assert.match(html, /<b>Défi<\/b><span>Pas encore joué<\/span>/);
  assert.match(html, /<span>Quiz<\/span><b>15 bonnes réponses<\/b>/);
  // A player without a partner shows their picture, or the Poké Ball; a name is always escaped.
  const plain = cardApi().playerCardHtml({ player: { username: '<b>x</b>', avatar: '', medals: {} }, figures: {}, games: [], records: [] });
  assert.match(plain, /<img class="is-photo" src="[^"]*poke-ball\.png"/);
  assert.match(plain, /<h3>&lt;b>x&lt;\/b><\/h3>/);
  assert.doesNotMatch(plain, /Derniers records|Membre depuis|Pionnier|profile-hero-medals/);
});

test('PostgreSQL: the card counts the finished plays, the Pokémon found, the best streak and the latest records', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto'), schema = 'cards_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE dossier_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,points INT,elapsed_ms BIGINT);
      CREATE TABLE challenge_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,points INT,elapsed_ms BIGINT);
      CREATE TABLE daily_rounds(day DATE PRIMARY KEY,secret_id INTEGER NOT NULL);
      CREATE TABLE daily_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,guessed JSONB,hints_used INT,elapsed_ms BIGINT,shiny BOOLEAN NOT NULL DEFAULT false);
      CREATE TABLE wordle_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,guessed JSONB,elapsed_ms BIGINT);
      CREATE TABLE scores(discord_id TEXT,mode TEXT,score INT,username TEXT,avatar TEXT,updated_at TIMESTAMPTZ,PRIMARY KEY(discord_id,mode));
      CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT,avatar TEXT,partner_id INT,xp INT,photo_key TEXT,data JSONB DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ DEFAULT now());`);
    await db.query(`INSERT INTO users(discord_id,username,partner_id,xp,data,created_at) VALUES('K','Kayan',571,123368,$1,'2026-09-12T10:00:00Z'),('S','Sacha',null,500,'{}','2026-10-20T10:00:00Z')`,
      [JSON.stringify({ profile: JSON.stringify({ pioneerMyth: true }) })]);
    const enquete = (day, guessed, status = 'won', shiny = false) => db.query('INSERT INTO daily_plays(identity,day,account_id,status,guessed,hints_used,elapsed_ms,shiny) VALUES($1,$2,$1,$3,$4,0,1000,$5)', ['K', day, status, JSON.stringify(guessed), shiny]);
    // Three days in a row, a gap, then one more: 4 Pokémon found, a best streak of 3.
    await enquete('2026-10-20', [1, 2, 3]); await enquete('2026-10-21', [1]); await enquete('2026-10-22', [1, 2]); await enquete('2026-10-25', [1, 2, 3, 4], 'won', true);
    await db.query("INSERT INTO daily_rounds VALUES('2026-10-25',571)");
    await enquete('2026-10-26', [1, 2], 'abandoned'); await enquete('2026-10-27', [1], 'playing');
    await db.query("INSERT INTO dossier_plays VALUES('K','2026-10-20','K','completed',18,1000),('K','2026-10-28','K','completed',20,1000)");
    await db.query("INSERT INTO challenge_plays VALUES('K','2026-10-21','K','abandoned',5,1000)");
    await db.query("INSERT INTO scores VALUES('K','quiz',15,'Kayan','',now() - interval '1 day'),('K','speedrun',42,'Kayan','',now()),('K','higherlower60',900,'Kayan','',now() - interval '3 days'),('K','intrus',8,'Kayan','',now() - interval '5 days'),('K','wordle',3,'Kayan','',now())");

    setPlayerIdSecret('test-secret'); setChampions(['K']);
    const config = (mode) => ({ quiz: { label: 'Quiz', unit: 'bonnes réponses' }, speedrun: { label: 'Speedrun', unit: 'Pokémon' }, higherlower60: { label: 'Higher/Lower 60s', unit: 'points' }, intrus: { label: 'Intrus', unit: 'série' } }[mode] || null);
    const cards = createPlayerCards({ db, arcadeModes: ['quiz', 'speedrun', 'higherlower60', 'intrus'], modeConfig: config });
    const card = await cards.card(playerPid('K'), '2026-10-31');
    assert.deepEqual(card.player, { pid: playerPid('K'), username: 'Kayan', avatar: '', partnerId: 571, champion: true, xp: 123368, pioneer: true, since: '2026-09', medals: { 1: 0, 2: 0, 3: 0 } });
    // Days with a finished stage: 20, 21, 22, 25, 26 (the abandoned Enquête counts), 28.
    assert.deepEqual(card.figures, { days: 6, found: 4, attempts: 2.5, bestStreak: 3, points: 36 + 40 + 38 + 34 + 0 + 18 + 20 + 5 });
    assert.deepEqual(card.games.map((g) => [g.game, g.played]), [['enquete', 5], ['wordlepts', 0], ['dossier', 2], ['challenge', 1]]);
    assert.deepEqual(card.shinies, { count: 1, latest: [{ id: 571, day: '2026-10-25' }] }, 'the shiny caught on 25/10');
    assert.deepEqual(card.records.map((r) => [r.label, r.score]), [['Speedrun', 42], ['Quiz', 15], ['Higher/Lower 60s', 900]], 'the three latest arcade records, not the daily boards');
    const other = await cards.card(playerPid('S'), '2026-10-31');
    assert.deepEqual([other.player.champion, other.player.pioneer, other.figures.days, other.records.length, other.shinies.count], [false, false, 0, 0, 0]);
    assert.equal(await cards.card('0000000000000000', '2026-10-31'), null);
  } finally {
    setChampions([]);
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    await admin.end();
  }
});
