'use strict';
// Reactions under the Pokémon du jour, « Nouveau » badges and « Reviens demain ? » (31/10/2026).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DAILY_REACTIONS, DAILY_FOUND_MIN, initDailyDb, createDailyService } = require('../lib/daily-game');
const { compareDaily } = require('../lib/daily-comparison');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the « Nouveau » badges end by themselves, whatever today is', () => {
  const code = read('src/script.10xi.new-badges.js').split('function applyNewGameBadges')[0];
  const { NEW_GAME_BADGES, newGameBadgesActive } = Function(code + '; return { NEW_GAME_BADGES, newGameBadgesActive };')();
  const last = NEW_GAME_BADGES.map((b) => b.until).sort().pop();
  assert.equal(newGameBadgesActive('2026-10-31').length, NEW_GAME_BADGES.length);
  assert.deepEqual(newGameBadgesActive('2099-01-01'), []);
  assert.ok(newGameBadgesActive(last).length >= 1, 'still shown on its last day');
  for (const badge of NEW_GAME_BADGES) assert.match(badge.until, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(read('index.html'), /data-args='\["openShinyMode"\]'/, 'Shiny ou normal tile');
  assert.match(read('index.html'), /data-args='\["dessin"\]'/, 'Dessine-le ! tiles');
});

test('the win card offers the reminder only while none is on', () => {
  const src = read('src/script.10xc.daily-reminder.js');
  const code = src.slice(src.indexOf('function dailyRemindCtaHtml'), src.indexOf("if (typeof renderGameOverBox === 'function')"));
  const make = (support, permission, saved, ok = true) => Function('dailyReminderSupport', 'dailyReminderServer', 'Notification', 'dailyReminderSaved',
    code + '; return dailyRemindCtaHtml();')(() => support, { ok }, { permission }, () => saved);
  assert.match(make('push', 'default', null), /<b>Reviens demain \?<\/b>.*data-action="openDailyReminder">Activer<\/button>/);
  assert.match(make('ios-install', 'default', null), /Reviens demain/, 'an iPhone gets the home-screen guide from the same button');
  assert.equal(make('push', 'granted', { hour: 18 }), '', 'already on');
  assert.equal(make(null, 'default', null), '', 'no notifications in this browser');
  assert.equal(make('push', 'default', null, false), '', 'server keys missing');
});

test('PostgreSQL: one reaction per player and per day, after playing; finders shown from 5', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'react_' + randomUUID().replaceAll('-', '');
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE daily_sessions(discord_id TEXT,day DATE,attempts INT,guessed JSONB,finished BOOLEAN,updated_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(discord_id,day));
      CREATE TABLE leaderboard_events(id BIGSERIAL PRIMARY KEY,discord_id TEXT,mode TEXT,score INTEGER,created_at TIMESTAMPTZ,result_key TEXT);
      CREATE UNIQUE INDEX event_key ON leaderboard_events(discord_id,mode,result_key) WHERE result_key IS NOT NULL;
      CREATE TABLE scores(discord_id TEXT,mode TEXT,score INTEGER,username TEXT,avatar TEXT,updated_at TIMESTAMPTZ,PRIMARY KEY(discord_id,mode));`);
    const base = { gen: 1, isAltForm: false, type1: 'Plante', type2: null, habitat: 'Forêt', color: 'Vert', stage: 1, height: 0.7, weight: 6.9 };
    const catalog = [{ ...base, id: 1, name: 'Bulbizarre' }, { ...base, id: 25, name: 'Pikachu' }];
    const now = new Date('2026-10-31T10:00:00Z'), day = '2026-10-31';
    await initDailyDb(db, now);
    await db.query('INSERT INTO daily_rounds(day,secret_id) VALUES($1,25)', [day]);
    const game = createDailyService({ db, pokemon: catalog, compare: compareDaily, legacyTarget: () => catalog[0], randomInt: () => 1, clock: () => now });
    const who = (k) => ({ key: 'user:' + k, accountId: k, name: k });
    const win = (k) => game.guess(who(k), { day, accountId: k, pokemonId: 25 });

    assert.deepEqual(DAILY_REACTIONS, ['😂', '🔥', '👏', '😱']);
    const empty = await game.reactions(who('A'));
    assert.deepEqual([empty.counts, empty.mine, empty.found], [{ '😂': 0, '🔥': 0, '👏': 0, '😱': 0 }, null, null]);
    await assert.rejects(game.react(who('A'), { emoji: '🔥' }), { code: 'play_first', status: 409 }, 'only once the day is played');
    await game.guess(who('A'), { day, accountId: 'A', pokemonId: 1 });
    await assert.rejects(game.react(who('A'), { emoji: '🔥' }), { code: 'play_first' }, 'a wrong guess is not the end of the day');
    await win('A');
    await assert.rejects(game.react(who('A'), { emoji: '💩' }), { code: 'bad_reaction', status: 400 });
    let r = await game.react(who('A'), { emoji: '🔥' });
    assert.deepEqual([r.counts['🔥'], r.mine], [1, '🔥']);
    r = await game.react(who('A'), { emoji: '😂' });
    assert.deepEqual([r.counts['🔥'], r.counts['😂'], r.mine], [0, 1, '😂'], 'another emoji replaces it');
    r = await game.react(who('A'), { emoji: '😂' });
    assert.deepEqual([r.counts['😂'], r.mine], [0, null], 'the same one takes it back');
    await game.abandon(who('B'), { day, accountId: 'B' });
    assert.equal((await game.react(who('B'), { emoji: '😱' })).counts['😱'], 1, 'giving up also ends the day');
    assert.equal((await game.reactions(who('A'))).found, null, 'one finder stays hidden');
    for (const k of ['C', 'D', 'E', 'F']) await win(k);
    assert.equal(DAILY_FOUND_MIN, 5);
    assert.equal((await game.reactions(who('A'))).found, 5);
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});
