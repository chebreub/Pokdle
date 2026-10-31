'use strict';
// The shiny hunt (31/10/2026): each Pokémon du jour found is captured, shiny with odds that
// improve with the streak (1/40, 1/30 from 7 days, 1/20 from 30), rolled once by the server.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { shinyOdds, shinyState, SHINY_TIERS, initDailyDb, createDailyService, nextDay } = require('../lib/daily-game');
const { compareDaily } = require('../lib/daily-comparison');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the odds follow the streak, and the result card knows what a win today would bring', () => {
  assert.deepEqual([0, 1, 6, 7, 29, 30, 365].map(shinyOdds), [40, 40, 40, 30, 30, 20, 20]);
  assert.deepEqual(shinyState('won', true, 12), { captured: true, shiny: true, streak: 12, odds: 30 });
  assert.deepEqual(shinyState('playing', false, 6), { captured: false, shiny: false, streak: 7, odds: 30 }, 'a win today makes a 7-day streak');
  assert.deepEqual(shinyState('abandoned', false, 0), { captured: false, shiny: false, streak: 0, odds: null });
  // The page and the server share the same tiers.
  assert.match(read('src/script.10xh.shiny-hunt.js'), new RegExp('var SHINY_HUNT_TIERS = ' + JSON.stringify(SHINY_TIERS).replace(/[[\]]/g, '\\$&').replace(/,/g, ', ') + ';'));
});

function page() {
  const code = read('src/script.10xh.shiny-hunt.js').split('if (typeof renderGameOverBox')[0];
  const env = {
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    pokedexDetailArtwork: (p, shiny) => (shiny ? 'shiny-art-' : 'art-') + p.id,
    getPokemonShinySprite: (p) => 'shiny-sprite-' + p.id,
    getPokemonSprite: (p) => 'sprite-' + p.id,
    window: { __pokedleShinies: null },
    playerStats: { dailyCurrentStreak: 6 },
    shinyShowcaseHtml: (list, count) => '<showcase ' + list.length + '/' + count + '>',
  };
  return { env, api: Function(...Object.keys(env), code + '; return { dailyCaptureHtml, profileShinyHtml, shinyHuntOdds, shinyHuntNextTier };')(...Object.values(env)) };
}

test('the capture card says what was caught, the odds, and what the streak will bring', () => {
  const { api } = page();
  const pikachu = { id: 25, name: 'Pikachu' };
  const shiny = api.dailyCaptureHtml({ shiny: { captured: true, shiny: true, streak: 12, odds: 30 } }, pikachu);
  assert.match(shiny, /class="daily-capture is-shiny"/);
  assert.match(shiny, /<img src="shiny-art-25" data-fallback="shiny-sprite-25" alt="Pikachu shiny"/);
  assert.match(shiny, /<small>✨ Shiny ! · Capturé<\/small><b>Pikachu shiny rejoint ta collection<\/b>/);
  assert.match(shiny, /✨ Chance de shiny : 1\/30 · série de 12 jours/);
  const hint = (streak) => api.dailyCaptureHtml({ shiny: { captured: true, shiny: false, streak, odds: api.shinyHuntOdds(streak) } }, pikachu).match(/daily-capture-hint">([^<]+)</)[1];
  assert.equal(hint(5), 'Encore 2 jours de série pour passer à 1/30.');
  assert.equal(hint(6), 'Demain, si tu le trouves, ta chance passe à 1/30.');
  assert.equal(hint(29), 'Demain, si tu le trouves, ta chance passe à 1/20.');
  assert.equal(hint(30), 'Ta série te donne déjà la meilleure chance.');
  assert.equal(api.dailyCaptureHtml({ shiny: { captured: false } }, pikachu), '', 'nothing before the win or after giving up');
  assert.match(api.dailyCaptureHtml({ shiny: { captured: true, shiny: false, streak: 1, odds: 40 } }, { id: 1, name: '<Bulbi>' }), /&lt;Bulbi> rejoint ta collection/);
});

test('the trainer card shows the shinies, or the odds of the next Pokémon du jour', () => {
  const { api, env } = page();
  assert.match(api.profileShinyHtml(), /✨ Chasse au shiny : 1\/30 sur ton prochain Pokémon du jour/);
  env.window.__pokedleShinies = { count: 9, shinies: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, day: '2026-10-0' + (i + 1) })) };
  assert.equal(api.profileShinyHtml(), '<div class="profile-shinies"><span class="profile-shinies-title">✨ Mes shinies · 9</span><showcase 6/9></div>');
  const src = read('src/script.07.delegation-party.js');
  assert.match(src, /\$\{typeof profileShinyHtml === "function" \? profileShinyHtml\(\) : ""\}/);
  assert.match(read('src/script.10d.pokedex-collection.js'), /if \(pokedexCollectionFilter === 'shiny'\) return Boolean\(state\.entry\?\.shiny\);/);
  assert.match(read('src/script.10d.pokedex-collection.js'), /data-args='\["shiny"\]'>✨ Shinies<\/button>/);
});

test('PostgreSQL: one roll at the win, with the streak this win makes, kept with the play', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL }), schema = 'shiny_' + randomUUID().replaceAll('-', '');
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
    // A: seven days won in a row before today; D: twenty-nine; B: nothing.
    const won = async (account, days) => {
      for (let i = 1; i <= days; i++) {
        const d = nextDay(day, -i);
        await db.query('INSERT INTO daily_rounds(day,secret_id) VALUES($1,1) ON CONFLICT DO NOTHING', [d]);
        await db.query("INSERT INTO daily_plays(identity,day,account_id,guessed,status,migrated) VALUES($1,$2,$3,'[1]','won',true)", ['user:' + account, d, account]);
      }
    };
    await won('A', 7); await won('D', 29);
    await db.query('INSERT INTO daily_rounds(day,secret_id) VALUES($1,25)', [day]);
    const rolls = [], results = [];
    const randomInt = (n) => { if ([20, 30, 40].includes(n)) { rolls.push(n); return results.shift() ?? 1; } return 0; };
    const game = createDailyService({ db, pokemon: catalog, compare: compareDaily, legacyTarget: () => catalog[0], randomInt, clock: () => now });
    const who = (account) => ({ key: 'user:' + account, accountId: account, name: account });
    const guess = (w, pokemonId) => game.guess(w, { day, accountId: w.accountId || null, pokemonId });

    assert.deepEqual((await game.state(who('A'))).shiny, { captured: false, shiny: false, streak: 8, odds: 30 }, 'while playing: the odds of a win today');
    assert.equal(rolls.length, 0, 'a wrong guess or a visit never rolls');
    await guess(who('A'), 1);
    assert.equal(rolls.length, 0);
    results.push(0);
    const a = await guess(who('A'), 25);
    assert.deepEqual(a.shiny, { captured: true, shiny: true, streak: 8, odds: 30 });
    assert.deepEqual(rolls, [30], 'one roll at 1/30 for an 8-day streak');
    assert.equal((await guess(who('A'), 25)).duplicate, true);
    assert.deepEqual(rolls, [30], 'a retried win never rolls again');
    assert.equal((await game.state(who('A'))).shiny.shiny, true, 'kept with the play');

    const b = await guess(who('B'), 25);
    assert.deepEqual(b.shiny, { captured: true, shiny: false, streak: 1, odds: 40 });
    await guess(who('D'), 25);
    const guest = { key: 'guest:g' };
    results.push(0);
    const g = await game.guess(guest, { day, accountId: null, pokemonId: 25 });
    assert.deepEqual(rolls, [30, 40, 20, 40], 'B starts at 1/40, D reaches 1/20 with 30 days, a guest has no streak');
    assert.equal(g.shiny.shiny, true);

    assert.deepEqual(await game.shinies(who('A')), { ok: true, count: 1, shinies: [{ id: 25, day }] });
    assert.deepEqual(await game.shinies(who('B')), { ok: true, count: 0, shinies: [] });
    assert.equal((await game.shinies(guest)).count, 1, 'a guest sees the shinies of this browser');
    assert.equal((await game.shinies({ key: 'user:G', accountId: 'G' })).count, 0, 'a guest shiny never becomes an account one by itself');
  } finally {
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE').catch(() => {});
    await admin.end();
  }
});
