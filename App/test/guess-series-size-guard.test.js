'use strict';
// Changing 5/10/20 must not silently erase a player's partially completed run.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../src/script.10xm.guess-series.js'), 'utf8');
// Isolate the series module before its hooks into the rest of the browser app.
const seriesSource = src.split('GUESS_SERIES_ON.forEach(')[0];

function fixture() {
  const saved = [], notices = [], confirms = [], starts = [];
  let approve = false;
  const context = {
    window: { confirm(message) { confirms.push(message); return approve; } },
    localStorage: { getItem: () => null, setItem(key, value) { saved.push([key, value]); } },
    playerProfile: { xp: 0 },
    document: { getElementById: () => null },
    gameMode: 'pixel', gameOver: false, attempts: 0,
    showToast(text) { notices.push(text); },
    escapeHtml: String,
  };
  vm.createContext(context);
  vm.runInContext(seriesSource, context);
  context.guessSeriesStarts.pixel = () => { starts.push('pixel'); };
  context.startGuessSeries('pixel', 10);
  return { context, saved, notices, confirms, starts, allow() { approve = true; } };
}

test('tapping already selected series length never restarts, saves or confirms', () => {
  const f = fixture(), current = f.context.guessSeries;
  current.index = 7;
  current.found = 5;
  f.context.gameOver = false;
  f.context.attempts = 2;
  f.context.setGuessSeriesSize(10);
  assert.equal(f.context.guessSeries, current);
  assert.equal(current.index, 7);
  assert.equal(current.found, 5);
  assert.equal(f.starts.length, 1);
  assert.equal(f.saved.length, 0);
  assert.equal(f.confirms.length, 0);
});

test('the first unanswered round can change length without losing the mystery', () => {
  const f = fixture(), current = f.context.guessSeries;
  f.context.setGuessSeriesSize(5);
  assert.equal(f.context.guessSeries, current);
  assert.equal(current.index, 1);
  assert.equal(current.total, 5);
  assert.equal(f.starts.length, 1);
  assert.deepEqual(f.saved, [['pokedle.guessSeries.pixel', '5']]);
  assert.equal(f.confirms.length, 0);
});

test('declining a destructive length change preserves progress and preference', () => {
  const f = fixture(), current = f.context.guessSeries;
  current.index = 3;
  current.found = 2;
  f.context.gameOver = true; // Finished the current Pokémon, not the whole series.
  f.context.setGuessSeriesSize(20);
  assert.equal(f.confirms.length, 1);
  assert.match(f.confirms[0], /effacera la série en cours/);
  assert.equal(f.context.guessSeries, current);
  assert.equal(current.index, 3);
  assert.equal(current.found, 2);
  assert.equal(f.saved.length, 0);
  assert.equal(f.starts.length, 1);
});

test('accepting the change starts exactly one fresh series', () => {
  const f = fixture();
  f.context.guessSeries.index = 6;
  f.context.attempts = 1;
  f.allow();
  f.context.setGuessSeriesSize(20);
  assert.equal(f.confirms.length, 1);
  assert.equal(f.context.guessSeries.total, 20);
  assert.equal(f.context.guessSeries.index, 1);
  assert.equal(f.context.guessSeries.found, 0);
  assert.equal(f.starts.length, 2);
  assert.deepEqual(f.saved, [['pokedle.guessSeries.pixel', '20']]);
});

test('changing length after a complete series needs no discard confirmation', () => {
  const f = fixture();
  f.context.guessSeries.index = 10;
  f.context.gameOver = true;
  f.context.setGuessSeriesSize(5);
  assert.equal(f.confirms.length, 0);
  assert.equal(f.context.guessSeries.total, 5);
  assert.equal(f.starts.length, 2);
});
