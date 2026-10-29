'use strict';
// Two daily quests could never be completed (29/10): « Consulte le Pokédex » and « Joue à 3 modes différents ».
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readdirSync(path.join(__dirname, '../src')).filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
const core = fs.readFileSync(path.join(__dirname, '../src/script.01.core.js'), 'utf8');
const between = (from, to) => core.slice(core.indexOf(from), core.indexOf(to, core.indexOf(from)));

test('every daily quest of the pool is counted somewhere in the game', () => {
  const ids = [...between('const QUEST_POOL = [', '];').matchAll(/id: "([a-z_0-9]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 10);
  for (const id of ids) assert.match(src, new RegExp(`progressQuest\\("${id}"`), `${id} is never counted`);
});

test('three different finished modes complete the quest, a repeated mode does not count twice', () => {
  const quests = [{ id: 'play_3_modes', target: 3, xp: 70, label: 'Joue à 3 modes différents', progress: 0, completed: false }];
  const awarded = [];
  const c = { playerProfile: { dailyQuests: quests }, ensureDailyQuests: () => quests, saveProfile() {}, updateXpBadge() {},
    awardXp: (xp) => awarded.push(xp) };
  vm.createContext(c);
  vm.runInContext(between('function progressQuest(', '// XP earned by one action'), c);
  for (const mode of ['normal', 'normal', 'quiz', 'pixel', 'cry']) c.progressQuestMode(mode);
  assert.equal(quests[0].progress, 3);
  assert.equal(quests[0].completed, true);
  assert.deepEqual(awarded, [70]);
  assert.equal(JSON.stringify(quests[0].modes), JSON.stringify(['normal', 'quiz', 'pixel']));
});

test('the Pokédex quest is counted when the Pokédex screen opens, and finished games count for the modes quest', () => {
  assert.match(src, /if \(id === "screen-pokedex" && typeof progressQuest === "function"\) progressQuest\("pokedex_browse", 1\);/);
  assert.match(src, /progressQuestMode\(recorded\.mode\);/);
});
