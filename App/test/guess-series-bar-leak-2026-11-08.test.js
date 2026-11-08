// The « 5 / 10 / 20 » bar of a guess series stayed on screen in other games (Quiz, Duel de poids), 8/11/2026.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10xm.guess-series.js'), 'utf8');

test('the series bar is removed as soon as another game is shown', () => {
  assert.match(SRC, /function guessSeriesSyncBar\(\) \{\n  var bar = document\.getElementById\('guess-series-bar'\);\n  if \(bar && !guessSeriesActive\(\)\) bar\.remove\(\);/);
  assert.match(SRC, /showScreen = function \(\) \{[\s\S]*?guessSeriesSyncBar\(\);/);
  for (const name of ['startWeightBattle', 'startQuizGame', 'openHigherLowerMode']) assert.ok(SRC.includes("'" + name + "'"), name);
});
