'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const c = {};
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/script.07a.profile-merge.js'), 'utf8'), c);
const blob = (profile, stats, achievements, teamBuilder) => ({ _accountId: '1', ...(profile ? { profile: JSON.stringify(profile) } : {}), ...(stats ? { stats: JSON.stringify(stats) } : {}), ...(achievements ? { achievements: JSON.stringify(achievements) } : {}), ...(teamBuilder ? { teamBuilder: JSON.stringify(teamBuilder) } : {}) });
const plain = (value) => JSON.parse(JSON.stringify(value));
const parsed = (merged, key) => JSON.parse(merged[key]);

test('progress made on both devices adds up from the common copy', () => {
  const base = blob({ xp: 100, totalQuestsCompleted: 2 }, { played: 10, wins: 5, totalAttempts: 40 });
  const phone = blob({ xp: 400, totalQuestsCompleted: 3 }, { played: 12, wins: 6, totalAttempts: 47 });
  const pc = blob({ xp: 107, totalQuestsCompleted: 2 }, { played: 11, wins: 5, totalAttempts: 44 });
  const merged = c.mergeSyncBlobs(pc, phone, base);
  assert.equal(parsed(merged, 'profile').xp, 407);
  assert.equal(parsed(merged, 'profile').totalQuestsCompleted, 3);
  assert.deepEqual(plain(parsed(merged, 'stats')), { played: 13, wins: 6, totalAttempts: 51, dailyBestStreak: 0 });
});

test('without a common copy, nothing goes down: the higher counter is kept', () => {
  const merged = c.mergeSyncBlobs(blob({ xp: 7 }, { played: 1 }), blob({ xp: 300 }, { played: 4 }), null);
  assert.equal(parsed(merged, 'profile').xp, 300);
  assert.equal(parsed(merged, 'stats').played, 4);
});

test('records keep the best, collections keep everything, choices follow the primary copy', () => {
  const primary = blob({ favoritePokemonId: 25, avatarChoice: 'partner', quizHighScore: 9, quiEstCeBest: 7, petitBacBest: 4, discoveries: { 1: { at: 1 } }, secrets: { a: true }, draftScoreAttackRecords: { 1: 520, 9: 480 }, pioneerMyth: false, dailyQuestsDate: '2026-10-29', dailyQuests: [{ id: 'win_daily', progress: 0, completed: false }, { id: 'play_3_modes', progress: 2, completed: false }] },
    null, { first_win: { unlockedAt: 50 } }, { team: ['pc'] });
  const other = blob({ favoritePokemonId: 6, avatarChoice: 'photo', quizHighScore: 12, quiEstCeBest: 5, petitBacBest: 6, discoveries: { 4: { at: 2 } }, secrets: { b: true }, draftScoreAttackRecords: { 1: 540, 2: 600 }, pioneerMyth: true, dailyQuestsDate: '2026-10-29', dailyQuests: [{ id: 'win_daily', progress: 1, completed: true }, { id: 'play_3_modes', progress: 1, completed: false }] },
    null, { first_win: { unlockedAt: 20 }, ten_wins: { unlockedAt: 70 } }, { team: ['phone'] });
  const merged = c.mergeSyncBlobs(primary, other, null);
  const p = plain(parsed(merged, 'profile'));
  assert.equal(p.favoritePokemonId, 25);
  assert.equal(p.avatarChoice, 'partner');
  assert.equal(p.quizHighScore, 12);
  assert.equal(p.quiEstCeBest, 5, 'Qui est-ce ? keeps the fewest questions');
  assert.equal(p.petitBacBest, 6);
  assert.deepEqual(Object.keys(p.discoveries).sort(), ['1', '4']);
  assert.deepEqual(p.secrets, { a: true, b: true });
  assert.deepEqual(p.draftScoreAttackRecords, { 1: 540, 9: 480, 2: 600 });
  assert.equal(p.pioneerMyth, true);
  assert.deepEqual(p.dailyQuests, [{ id: 'win_daily', progress: 1, completed: true }, { id: 'play_3_modes', progress: 2, completed: false }]);
  assert.deepEqual(plain(parsed(merged, 'achievements')), { first_win: { unlockedAt: 20 }, ten_wins: { unlockedAt: 70 } });
  assert.deepEqual(plain(parsed(merged, 'teamBuilder')), { team: ['pc'] }, 'the team stays the one of the device in use');
});

test('the daily streak belongs to the copy that won the latest day; a missing part is taken as is', () => {
  const merged = c.mergeSyncBlobs(blob(null, { dailyCurrentStreak: 2, dailyBestStreak: 9, lastDailyWinKey: '2026-10-27' }),
    blob({ xp: 50 }, { dailyCurrentStreak: 4, dailyBestStreak: 4, lastDailyWinKey: '2026-10-29' }), null);
  const s = plain(parsed(merged, 'stats'));
  assert.equal(s.dailyCurrentStreak, 4);
  assert.equal(s.lastDailyWinKey, '2026-10-29');
  assert.equal(s.dailyBestStreak, 9);
  assert.equal(parsed(merged, 'profile').xp, 50);
});
