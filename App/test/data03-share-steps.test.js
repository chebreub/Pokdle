'use strict';
// DATA-03 (7/11/2026): three separate steps for a shared link — the share action, the link opened by a
// person (preview robots of messaging apps counted apart), and a game really started, counted once by
// the server. Aggregated counters only: no identifier, no fingerprint, no rebuilt history.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const { isLinkPreviewAgent } = require('../lib/usage-metrics');
const { initDailyDb, createDailyService } = require('../lib/daily-game');
const { compareDaily } = require('../lib/daily-comparison');

test('preview robots of messaging apps are not people opening the link', () => {
  for (const robot of ['WhatsApp/2.23.20.0', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)', 'facebookexternalhit/1.1',
    'Twitterbot/1.0', 'Slackbot-LinkExpanding 1.0', 'TelegramBot (like TwitterBot)', 'Mozilla/5.0 (compatible; Googlebot/2.1)', '',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0 Safari/537.36']) {
    assert.equal(isLinkPreviewAgent(robot), true, robot);
  }
  for (const person of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0']) {
    assert.equal(isLinkPreviewAgent(person), false, person);
  }
});

test('the server wires the three steps, each counted apart', () => {
  const server = read('server.js');
  assert.match(server, /"share:party", "share:party-visit", "share:preview", "share:daily-start", "share:party-start",/);
  assert.match(server, /recordUsage\(preview \? "share:preview" : "share:party-visit", null, usageSegmentForRequest\(req\)\);/);
  assert.match(server, /recordUsage\(preview \? "share:preview" : "share:visit", null, usageSegmentForRequest\(req\)\);/);
  assert.match(server, /if \(payload\.via === "link"\) player\.viaLink = true;/, 'the join only marks the player; nothing is counted yet');
  assert.match(server, /if \(!room\.shareStartCounted && room\.players\.some\(\(player\) => player\.viaLink && player\.connected\)\) \{\n\s+room\.shareStartCounted = true;\n\s+recordUsage\("share:party-start"/, 'once per room, at a real start');
  assert.match(server, /onSharedStart:\(req\)=>recordUsage\("share:daily-start"/);
  const daily = read('lib/daily-game.js');
  assert.match(daily, /if\(first&&req\.body&&req\.body\.arrival==="defi"&&typeof onSharedStart==="function"\)/);
  assert.match(daily, /if\(data\)delete data\.firstGuess;/, 'the flag never reaches the browser');
  // The client: a copied invitation, a join from the link, the defi arrival kept for this tab and this day.
  const client = read('src/script.04.jeu-pokedex.js');
  assert.match(client, /if \(typeof trackUsage === "function"\) trackUsage\("share:party"\);/);
  assert.match(client, /var viaLink = partyRoomState\.inviteCode === code;/);
  assert.match(client, /sessionStorage\.getItem\('pokedle_arrival_defi'\) === String\(day\)/);
  assert.match(read('src/script.10z.landing-links.js'), /sessionStorage\.setItem\('pokedle_arrival_defi', getDailyDateKey\(\)\)/);
  assert.doesNotMatch(read('src/script.10z.landing-links.js'), /localStorage\.clear/);
  // Admin: one row per shared link, three columns, robots apart.
  const admin = read('lib/admin-stats-dashboard.js');
  assert.match(admin, /\["Pokémon du jour", \["share:daily","share:visit","share:daily-start"\]\]/);
  assert.match(admin, /\["Invitation Party", \["share:party","share:party-visit","share:party-start"\]\]/);
});

test('PostgreSQL: only the first guess the server accepts marks a start; retries and abandons never do', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'data03_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE daily_sessions(discord_id TEXT,day DATE,attempts INT,guessed JSONB,finished BOOLEAN,updated_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(discord_id,day));
      CREATE TABLE leaderboard_events(id BIGSERIAL PRIMARY KEY,discord_id TEXT,mode TEXT,score INTEGER,created_at TIMESTAMPTZ,result_key TEXT);
      CREATE UNIQUE INDEX event_key ON leaderboard_events(discord_id,mode,result_key) WHERE result_key IS NOT NULL;
      CREATE TABLE scores(discord_id TEXT,mode TEXT,score INTEGER,username TEXT,avatar TEXT,updated_at TIMESTAMPTZ,PRIMARY KEY(discord_id,mode));`);
    const base = { gen: 1, isAltForm: false, type1: 'Plante', type2: null, habitat: 'Forêt', color: 'Vert', stage: 1, height: 0.7, weight: 6.9 };
    const catalog = [{ ...base, id: 1, name: 'Bulbizarre' }, { ...base, id: 4, name: 'Salamèche' }, { ...base, id: 25, name: 'Pikachu' }];
    const now = new Date('2026-11-07T10:00:00Z'), day = '2026-11-07';
    await initDailyDb(db, now);
    await db.query('INSERT INTO daily_rounds(day,secret_id) VALUES($1,25)', [day]);
    const game = createDailyService({ db, pokemon: catalog, compare: compareDaily, legacyTarget: () => catalog[0], randomInt: () => 1, clock: () => now });
    const who = (k) => ({ key: 'guest:' + k, guestKey: 'guest:' + k, accountId: null, name: 'Dresseur' });

    assert.equal((await game.guess(who('A'), { day, accountId: null, pokemonId: 1 })).firstGuess, true, 'first accepted guess');
    assert.equal((await game.guess(who('A'), { day, accountId: null, pokemonId: 1 })).firstGuess, undefined, 'a retry of the same guess');
    assert.equal((await game.guess(who('A'), { day, accountId: null, pokemonId: 4 })).firstGuess, false, 'a second guess');
    assert.equal((await game.guess(who('A'), { day, accountId: null, pokemonId: 25 })).firstGuess, false, 'the win');
    assert.equal((await game.guess(who('A'), { day, accountId: null, pokemonId: 1 })).firstGuess, undefined, 'after the end');
    assert.equal((await game.abandon(who('B'), { day, accountId: null })).firstGuess, false, 'giving up without playing is not a start');
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});
