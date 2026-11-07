'use strict';
// DISC-02 (7/11/2026): more games get a quest, at most one quest per family a day, none of yesterday's,
// XP within the existing range (no new reward), 4 optional quests as before.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = fs.readFileSync(path.join(__dirname, '../src/script.01.core.js'), 'utf8');
const between = (from, to) => core.slice(core.indexOf(from), core.indexOf(to, core.indexOf(from)));
const ctx = {};
vm.runInNewContext(between('const QUEST_POOL = [', 'function xpForLevel(') + ';this.QUEST_POOL=QUEST_POOL;this.pickDailyQuestIds=pickDailyQuestIds;this.dailyQuestIdsFor=dailyQuestIdsFor;', ctx);
const { QUEST_POOL, pickDailyQuestIds, dailyQuestIdsFor } = ctx;
const byId = new Map(QUEST_POOL.map((q) => [q.id, q]));
const day = (n) => new Date(Date.UTC(2026, 10, 8) + n * 864e5).toISOString().slice(0, 10);

test('no new reward: every quest stays within the XP range that already existed', () => {
  for (const q of QUEST_POOL) {
    assert.ok(q.xp >= 30 && q.xp <= 150, q.id);
    assert.ok(q.family, q.id + ' has a family');
    if (q.mode) assert.equal(q.xp, 50, q.id + ' pays like « Termine un draft »');
  }
  assert.equal(new Set(QUEST_POOL.map((q) => q.id)).size, QUEST_POOL.length);
});

test('4 quests a day, stable, one per family, never yesterday\'s again', () => {
  const seen = new Set();
  let prev = dailyQuestIdsFor(day(-1));
  for (let n = 0; n < 120; n++) {
    const ids = dailyQuestIdsFor(day(n));
    assert.deepEqual(dailyQuestIdsFor(day(n)), ids, 'stable within the day');
    assert.equal(ids.length, 4);
    assert.equal(new Set(ids.map((id) => byId.get(id).family)).size, 4, day(n) + ': one quest per family');
    assert.equal(ids.filter((id) => prev.includes(id)).length, 0, day(n) + ': none of yesterday\'s');
    ids.forEach((id) => seen.add(id));
    prev = ids;
  }
  assert.ok(seen.size >= QUEST_POOL.length - 2, 'over four months, nearly every quest comes up (' + seen.size + '/' + QUEST_POOL.length + ')');
  // Two Score Attack quests never fall on the same day any more.
  for (let n = 0; n < 365; n++) assert.ok(dailyQuestIdsFor(day(n)).filter((id) => byId.get(id).family === 'draft').length <= 1);
});

test('a finished game completes its own quest once, and still counts for « 3 modes »', () => {
  const quests = [
    { ...byId.get('play_pixel'), progress: 0, completed: false },
    { ...byId.get('play_3_modes'), progress: 0, completed: false },
  ];
  const awarded = [];
  const c = { playerProfile: { dailyQuests: quests }, ensureDailyQuests: () => quests, saveProfile() {}, updateXpBadge() {}, awardXp: (xp) => awarded.push(xp) };
  vm.createContext(c);
  vm.runInContext(between('function progressQuest(', '// XP earned by one action'), c);
  c.progressQuestMode('pixel'); c.progressQuestMode('pixel'); c.progressQuestMode('cry');
  assert.equal(quests[0].completed, true);
  assert.equal(quests[1].progress, 2);
  assert.deepEqual(awarded, [50], 'the Pixelisé quest pays once');
});

test('quests already drawn for today are kept (only a new day draws again)', () => {
  assert.match(core, /if \(playerProfile\.dailyQuestsDate === todayKey && Array\.isArray\(playerProfile\.dailyQuests\)\) return playerProfile\.dailyQuests;/);
  assert.match(core, /dailyQuestIdsFor\(todayKey\)/);
  assert.equal(pickDailyQuestIds(day(3)).length, 4);
});
