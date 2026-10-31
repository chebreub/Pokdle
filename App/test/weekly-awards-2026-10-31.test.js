'use strict';
// The week's prize (31/10/2026): podium 2-1-3, medals for the top three, shiny partner for the first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mondayOf, shiftDay, createWeeklyAwards } = require('../lib/weekly-awards');
const { dayBoard } = require('../lib/day-boards');
const { setChampions, isChampion } = require('../lib/week-champions');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test('a week runs from Monday to Sunday', () => {
  assert.equal(mondayOf('2026-10-31'), '2026-10-26', 'Saturday');
  assert.equal(mondayOf('2026-11-01'), '2026-10-26', 'Sunday still belongs to the week');
  assert.equal(mondayOf('2026-11-02'), '2026-11-02', 'Monday starts a new one');
  assert.equal(shiftDay('2026-10-26', -7), '2026-10-19');
  assert.match(read('lib/day-boards.js'), /date_trunc\('week',\$1::date\)::date/);
  for (const file of ['lib/daily-grid.js', 'lib/daily-petitbac.js']) assert.doesNotMatch(read(file), /\$1::date-7/, file);
});

test('the champion shows a shiny partner wherever a ranking names him', () => {
  setChampions(['A']);
  assert.equal(isChampion('A'), true);
  assert.equal(isChampion('B'), false);
  setChampions([]);
  for (const file of ['lib/day-boards.js', 'lib/daily-grid.js', 'lib/daily-petitbac.js']) assert.match(read(file), /champion:isChampion\(r\.discord_id\)/, file);
  assert.match(read('server.js'), /champion: isChampion\(row\.discord_id\),/);
  assert.match(read('server.js'), /await refreshWeeklyChampions\(\);\n\s+if\(playModes\.includes\(mode\)\)/);
});

function pageApi() {
  const src = read('src/script.10g.leaderboard-v2.js');
  const code = between(src, 'const LEADERBOARD_V2_DEFAULT_AVATAR', 'function leaderboardV2ArcadeCounts(') +
    between(src, 'function leaderboardLevelPill(', 'function leaderboardV2Row(') +
    between(src, 'const LEADERBOARD_PRIZE_EXAMPLE', '// The week\'s prize: last week\'s podium');
  const env = {
    POKEMON_BY_ID: new Map([[937, { id: 937, name: 'Malvalame' }], [133, { id: 133, name: 'Évoli' }]]),
    playerProfile: { favoritePokemonId: 937 },
    escapeHtml: (s) => String(s),
    getPokemonSprite: (p) => 'sprite-' + p.id,
    getPokemonShinySprite: (p) => 'shiny-sprite-' + p.id,
    pokedexDetailArtwork: (p, shiny) => (shiny ? 'shiny-art-' : 'art-') + p.id,
    pokemonIsRare: () => false,
    leaderboardV2FormatScore: (score) => score + ' pts',
    weeklyLeagueTimeLeft: () => '1 j 18 h',
  };
  return Function(...Object.keys(env), code + '; return { leaderboardV2PodiumHtml, leaderboardV2Avatar, leaderboardPrizeHtml };')(...Object.values(env));
}

test('the podium reads second, first, third, with the partner\'s artwork', () => {
  const api = pageApi();
  const rows = [
    { rank: 1, username: 'Kayan', partnerId: 937, level: 74, score: 282, champion: true, me: true },
    { rank: 2, username: 'Jade', avatar: 'photo.jpg', level: 7, score: 100 },
    { rank: 3, username: 'Gianni', level: 5, score: 40 },
  ];
  const html = api.leaderboardV2PodiumHtml(rows, 'journey', 'pts');
  const order = [...html.matchAll(/<div class="lbv5-step is-(\w+)[^"]*">\s*<span class="lbv5-medal">(\d)<\/span>/g)].map((m) => m[1] + m[2]);
  assert.deepEqual(order, ['silver2', 'gold1', 'bronze3']);
  assert.match(html, /is-gold is-me is-champion/);
  assert.match(html, /src="shiny-art-937" data-fallback="shiny-sprite-937"/, 'the champion\'s partner is shiny');
  assert.match(html, /src="photo\.jpg" data-fallback="[^"]*poke-ball\.png"/, 'a picture that fails falls back to the Poké Ball');
  assert.match(html, /<b>Kayan<\/b><span class="player-level-pill">Niv\. 74<\/span><strong>282 pts<\/strong><small>TOI<\/small>/);
  assert.equal(api.leaderboardV2PodiumHtml(rows.slice(0, 2), 'journey', 'pts'), '', 'below three players the list stays alone');
  assert.match(api.leaderboardV2Avatar({ partnerId: 937, champion: true }), /is-champion" src="shiny-sprite-937"/);
  assert.match(api.leaderboardV2Avatar({ partnerId: 937 }), /src="sprite-937"/);
});

test('the prize card says what is won, until when, and leads to the week\'s Global', () => {
  const api = pageApi();
  const card = api.leaderboardPrizeHtml('journey', 'today');
  assert.match(card, /<span class="lbv5-prize-tag">À gagner cette semaine<\/span>/);
  assert.match(card, /src="shiny-art-937"/);
  assert.match(card, /<h4>Ton Malvalame en shiny<\/h4>/);
  assert.match(card, /<b>1 j 18 h<\/b> avant le reset · lundi 0 h/);
  assert.match(card, /data-action="openLeaderboardV2" data-args="\[&quot;journey&quot;,&quot;week&quot;\]">Voir le Global de la semaine/);
  assert.doesNotMatch(api.leaderboardPrizeHtml('journey', 'week'), /Voir le Global de la semaine/, 'already on it');
  const src = read('src/script.10g.leaderboard-v2.js');
  assert.match(src, /\["week","Semaine"\]/);
  assert.match(src, /leaderboardPrizeHtml\(current, requestedScope\)\+/);
  assert.match(src, /leaderboardV2PodiumHtml\(rows, current, data\.unit\|\|meta\.unit\)\+/);
  assert.doesNotMatch(src, /leaderboardWeekHero/);
  assert.match(read('src/script.13.halloween.js'), /'\.lbv5-prize, \.lbv5-podium, '/, 'the Halloween ghost never rests on the prize');
});

test('PostgreSQL: the week that ended keeps its podium once, and its first plays shiny', { skip: !process.env.QA_DATABASE_URL, timeout: 30000 }, async () => {
  const { Pool } = require('pg'), { randomUUID } = require('node:crypto'), schema = 'awards_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  let db;
  try {
    await admin.query('CREATE SCHEMA ' + schema);
    db = new Pool({ connectionString: process.env.QA_DATABASE_URL, options: '-c search_path=' + schema, max: 4 });
    await db.query(`CREATE TABLE dossier_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,points INT,elapsed_ms BIGINT);
      CREATE TABLE challenge_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,points INT,elapsed_ms BIGINT);
      CREATE TABLE daily_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,guessed JSONB,hints_used INT,elapsed_ms BIGINT);
      CREATE TABLE wordle_plays(identity TEXT,day DATE,account_id TEXT,status TEXT,guessed JSONB,elapsed_ms BIGINT);
      CREATE TABLE users(discord_id TEXT PRIMARY KEY,username TEXT,avatar TEXT,partner_id INT,xp INT,photo_key TEXT);`);
    for (const [id, partner] of [['A', 937], ['B', null], ['C', 25], ['D', null]]) await db.query('INSERT INTO users(discord_id,username,partner_id,xp) VALUES($1,$1,$2,0)', [id, partner]);
    const dossier = (who, day, points) => db.query("INSERT INTO dossier_plays VALUES($1,$2,$1,'completed',$3,1000)", [who, day, points]);
    // Last week (19–25/10): A plays three days, B one great day, C two days; D only plays this week.
    for (const day of ['2026-10-19', '2026-10-21', '2026-10-25']) await dossier('A', day, 20);
    await dossier('B', '2026-10-22', 20); await dossier('C', '2026-10-23', 10); await dossier('C', '2026-10-24', 8);
    await dossier('D', '2026-10-27', 20); await dossier('A', '2026-10-26', 4);
    // « Semaine » on Monday 26/10 starts again from zero: Sunday 25/10 belongs to last week.
    const monday = await dayBoard(db, { mode: 'journey', scope: 'week', accountId: 'A', day: '2026-10-26' });
    assert.deepEqual(monday.top.map((r) => [r.username, r.score]), [['A', 4]]);

    const awards = createWeeklyAwards({ db });
    const summary = await awards.summary('2026-10-31', 'A');
    assert.deepEqual(summary.week, { start: '2026-10-26', lastStart: '2026-10-19' });
    assert.deepEqual(summary.podium.map((r) => [r.rank, r.username, r.points, r.partnerId]), [[1, 'A', 60, 937], [2, 'B', 20, null], [3, 'C', 18, 25]]);
    assert.equal(summary.champion, true);
    assert.deepEqual(summary.medals, [{ week: '2026-10-19', rank: 1 }]);
    assert.equal((await awards.summary('2026-10-31', 'B')).champion, false);
    assert.equal(isChampion('A'), true, 'the rankings now show A with a shiny partner');
    const week = await dayBoard(db, { mode: 'journey', scope: 'week', accountId: null, day: '2026-10-31' });
    assert.deepEqual(week.top.map((r) => [r.username, r.champion]), [['D', false], ['A', true]]);

    // A second server, or a play counted late, never rewrites a settled week.
    await dossier('D', '2026-10-25', 20);
    await createWeeklyAwards({ db }).summary('2026-11-01', null);
    assert.equal(Number((await db.query('SELECT COUNT(*) FROM weekly_awards')).rows[0].count), 3);
    // A week nobody played settles nothing.
    await createWeeklyAwards({ db }).refresh('2026-10-14');
    assert.equal(Number((await db.query("SELECT COUNT(*) FROM weekly_awards WHERE week = '2026-10-05'")).rows[0].count), 0);
  } finally {
    setChampions([]);
    if (db) await db.end();
    await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE');
    await admin.end();
  }
});
