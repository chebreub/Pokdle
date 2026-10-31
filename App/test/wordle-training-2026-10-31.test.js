'use strict';
// Wordle Pokémon en entraînement (31/10/2026): the daily Wordle's grid, played in the page with a
// random Pokémon, in series of 1 / 5 / 10 / ∞ names, out of the rankings.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function helpers() {
  const src = read('src/script.10xn.wordle-training.js');
  const code = src.split('function wordleTrainingSize()')[0];
  const wordleNormalize = (name) => String(name).replace(/♀/g, 'F').replace(/♂/g, 'M').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  return Function('wordleNormalize', code + '; return { wordleTrainingLetters, wordleTrainingPattern, wordleTrainingCompare, WORDLE_TRAINING_SIZES };')(wordleNormalize);
}

test('the page scores letters exactly like the daily Wordle on the server', () => {
  const { wordleTrainingCompare, wordleTrainingPattern, wordleTrainingLetters, WORDLE_TRAINING_SIZES } = helpers();
  const server = read('lib/daily-wordle.js');
  // The server's rule, run on the same cases.
  const compareLetters = Function(server.slice(server.indexOf('function compareLetters'), server.indexOf('const error =')) + '; return compareLetters;')();
  for (const [guess, answer] of [['PIKACHU', 'PICHUUU'], ['ABRA', 'ARBA'], ['SALAMECHE', 'CARAPUCE'], ['EEEE', 'EAEB']]) {
    const g = guess.slice(0, answer.length).padEnd(answer.length, 'X');
    assert.deepEqual(wordleTrainingCompare(g, answer), compareLetters(g, answer), guess + ' / ' + answer);
  }
  assert.equal(wordleTrainingPattern('M. Mime'), '_. ____');
  assert.equal(wordleTrainingPattern('Porygon2'), '_______2');
  assert.equal(wordleTrainingLetters('Nidoran♀'), 'NIDORANF');
  assert.deepEqual(WORDLE_TRAINING_SIZES, [1, 5, 10, 0], '0 means no end');
});

test('training is found in Deviner, reached from the daily Wordle, and stays out of the rankings', () => {
  assert.match(read('index.html'), /data-args='\["startWordleTraining"\]'[^>]*><div class="pk-tile pk-tile-sm">.*<b>Wordle Pokémon<\/b>/);
  const src = read('src/script.10xn.wordle-training.js');
  assert.match(src, /data-action="startWordleTraining">🔁 S’entraîner en illimité<\/button>/);
  assert.match(src, /'ENTRAÎNEMENT · HORS CLASSEMENT'/);
  assert.match(src, /if \(!s \|\| !s\.training\) return wordleRequestBeforeTraining\.apply\(this, arguments\);/, 'the daily Wordle still asks the server');
  assert.match(read('game-shell.css'), /#screen-wordle\.is-training \.wordle-journey, #screen-wordle\.is-training \.wordle-toolbar \[data-action="openLeaderboardV2"\]/);
});
