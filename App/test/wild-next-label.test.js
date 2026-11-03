'use strict';
// « Les herbes se reposent jusqu'à 16 h » : l'heure de la prochaine vague, heure de Paris (bug « NaN h » du 3/11/2026).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');

test('the next wave of encounters is written as a Paris hour, never NaN', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/script.10xy.poke-balls.js'), 'utf8');
  const wildNextLabel = new Function(src.match(/function wildNextLabel[\s\S]*?\n}\n/)[0] + 'return wildNextLabel;')();
  assert.equal(wildNextLabel({ nextAt: '2026-11-03T15:00:00Z' }), 'à 16\u00a0h');
  assert.equal(wildNextLabel({ nextAt: '2026-11-03T03:00:00Z' }), 'à 4\u00a0h');
  assert.equal(wildNextLabel({ nextAt: '2026-11-03T23:00:00Z' }), 'à minuit');
  assert.equal(wildNextLabel({ nextAt: '2026-07-03T22:00:00Z' }), 'à minuit', 'summer time too');
  assert.equal(wildNextLabel({}), '');
});
