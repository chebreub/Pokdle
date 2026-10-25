'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The level system of script.01.core.js, from the titles to the Pionnier notice, with the app around it stubbed.
const src = fs.readFileSync(path.join(__dirname, '../src/script.01.core.js'), 'utf8');
const levels = src.slice(src.indexOf('const XP_MAX_LEVEL'), src.indexOf('const QUEST_POOL'));
const curve = src.slice(src.indexOf('function xpForLevel('), src.indexOf('// Quests and the login streak change'));
const award = src.slice(src.indexOf('const XP_GAME_DAILY_FULL'), src.indexOf('function showXpLevelsNotice('));

function load(profile, day = '2026-10-25') {
  const toasts = [];
  const ctx = Function('playerProfile', 'getDailyDateKey', 'saveProfile', 'queueXpToast', 'showXpToast', 'updateXpBadge', 'pokedexCollectionRegionStats', 'showXpLevelsNotice',
    levels + curve + award + '; return { xpForLevel, getXpTier, getXpProgress, awardXp, awardRegionXpIfComplete, migrateXpLevels };')(
    profile, () => day, () => {}, (amount, source) => toasts.push([amount, source]), () => {}, () => {},
    (gen) => profile.regions?.[gen] || { found: 0, total: 151 }, () => {},
  );
  return { ...ctx, toasts };
}

test('100 levels: level N needs 25 × N × (N − 1) XP, a title every 10 levels', () => {
  const { xpForLevel, getXpTier } = load({});
  assert.deepEqual([1, 2, 10, 50, 100].map(xpForLevel), [0, 50, 2250, 61250, 247500]);
  const at = (xp) => { const t = getXpTier(xp); return `${t.level} ${t.name}`; };
  assert.equal(at(0), '1 Recrue');
  assert.equal(at(49), '1 Recrue');
  assert.equal(at(50), '2 Recrue');
  assert.equal(at(2250), '10 Novice');
  assert.equal(at(50000), '45 Expert');
  assert.equal(at(122928), '70 Maître');
  assert.equal(at(200250), '90 Mythe Pokémon');
  assert.equal(at(247500), '100 Maître Pokémon');
  // Past level 100, one prestige star per 5 000 XP.
  assert.equal(at(257500), '100 Maître Pokémon ★2');
});

test('progress shows the next level and the next title', () => {
  const { getXpProgress } = load({});
  const p = getXpProgress(122928);
  assert.equal(p.next.level, 71);
  assert.equal(p.next.minXp - 122928, 1322);
  assert.deepEqual([p.xpInTier, p.xpToNext, p.percent], [2178, 3500, 62]);
  assert.deepEqual([p.nextTitle.level, p.nextTitle.name], [80, 'Légende']);
  const max = getXpProgress(250000);
  assert.equal(max.next, null);
  assert.equal(max.percent, 50);
});

test('a game gives its full XP up to 500 a day, then half; other awards are not counted', () => {
  const profile = { xp: 0 };
  const { awardXp, toasts } = load(profile);
  for (let i = 0; i < 7; i++) awardXp(70, 'Victoire Stat Clash', 'statclash');
  assert.equal(profile.xp, 490);
  awardXp(70, 'Victoire Stat Clash', 'statclash'); // 10 at full rate, 60 at half
  assert.equal(profile.xp, 530);
  assert.match(toasts.at(-1)[1], /½ XP au-delà de 500 par jeu et par jour/);
  awardXp(70, 'Victoire Stat Clash', 'statclash');
  assert.equal(profile.xp, 565);
  // Another game, the daily game and the adventure still give everything.
  awardXp(100, 'Poké-Connections résolu', 'connections');
  awardXp(80, 'Pokédle du jour');
  awardXp(20, 'Nouveau Pokémon : Évoli');
  assert.equal(profile.xp, 765);
  // A new day starts again at full rate.
  const next = load(profile, '2026-10-26');
  next.awardXp(70, 'Victoire Stat Clash', 'statclash');
  assert.equal(profile.xp, 835);
});

test('a completed region gives 1 000 XP once', () => {
  const profile = { xp: 0, regions: { 1: { found: 151, total: 151 }, 2: { found: 99, total: 100 } } };
  const { awardRegionXpIfComplete } = load(profile);
  awardRegionXpIfComplete({ gen: 2 });
  awardRegionXpIfComplete({ gen: 1 });
  awardRegionXpIfComplete({ gen: 1 });
  assert.equal(profile.xp, 1000);
  assert.ok(profile.regionXpClaims[1]);
});

test('the switch keeps the XP, marks old « Mythe Pokémon » players as Pionnier, and runs once', () => {
  const myth = { xp: 122928 };
  load(myth).migrateXpLevels();
  assert.deepEqual([myth.xp, myth.xpLevels, myth.pioneerMyth], [122928, 2, true]);
  const recent = { xp: 25000 };
  load(recent).migrateXpLevels();
  assert.equal(recent.pioneerMyth, undefined);
  const done = { xp: 60000, xpLevels: 2 };
  load(done).migrateXpLevels();
  assert.equal(done.pioneerMyth, undefined);
});

test('every repeatable game names itself for the daily limit; the adventure gives XP', () => {
  const dir = path.join(__dirname, '../src');
  const all = fs.readdirSync(dir).filter((f) => /^script\..*\.js$/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  for (const game of ['higherlower', 'typecombo', 'speedrun', 'connections', 'statauction', 'quiz', 'scoreattack', 'statclash', 'classic', 'weight', 'odd', 'petitbac', 'quiestce', 'party']) {
    assert.match(all, new RegExp(`awardXp\\([^;]*["']${game}["']\\)`), game);
  }
  assert.match(all, /awardXp\(80, "Pokédle du jour"\);/);
  assert.match(all, /awardXp\(ADVENTURE_XP\.discovery, `Nouveau Pokémon : \$\{pokemon\.name\}`\);/);
  assert.match(all, /awardXp\(ADVENTURE_XP\.mission\[mission\.tier\]/);
  assert.match(all, /awardXp\(ADVENTURE_XP\.secret, /);
  assert.match(all, /if \(typeof migrateXpLevels === "function"\) migrateXpLevels\(\);/);
});
