'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
const slice = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test('the phone generation chip says what is chosen in a few characters', () => {
  const src = read('script.10n.generations.js');
  const c = {};
  vm.createContext(c);
  vm.runInContext(slice(src, 'function validGenerationChoices(', 'const savedGenerationPreference') + slice(src, 'function generationChoiceShort(', 'function renderGenerationSummaries('), c);
  assert.deepEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9], [1], [1, 2, 3, 4], [1, 3, 5], [1, 3, 5, 7]].map((g) => c.generationChoiceShort(g)),
    ['Toutes', '1', '1-4', '1, 3, 5', '4 gén.']);
});

test('the ranking says how far the next place is, and names the period', () => {
  const src = read('script.10g.leaderboard-v2.js');
  const c = { leaderboardV2IsDraft: (mode) => String(mode).startsWith('draft') };
  vm.createContext(c);
  vm.runInContext(slice(src, 'function leaderboardV2FormatScore(', '// R1:'), c);
  assert.equal(c.leaderboardV2GapText(12, 'journey', 'pts'), '12 pts');
  assert.equal(c.leaderboardV2GapText(1, 'journey', 'pts'), '1 pt');
  assert.equal(c.leaderboardV2GapText(1, 'quiz', 'bonnes réponses'), '1 bonne');
  assert.equal(c.leaderboardV2GapText(1, 'daily', 'essais'), '1 essai');
  assert.equal(c.leaderboardV2Title('Global du jour', 'week'), 'Global · 7 jours');
  assert.equal(c.leaderboardV2Title('Global du jour', 'today'), 'Global du jour');
  assert.equal(c.leaderboardV2Title('Pokémon du jour', 'all'), 'Pokémon du jour · records');
});
