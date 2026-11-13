'use strict';
// Combo de types : la fin de partie n'était jamais comptée (« 0 fin » dans /admin/stats, 12/11).
// Elle est maintenant envoyée comme les autres jeux, et le serveur l'accepte.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { completionEvent } = require('../lib/usage-metrics');

const src = fs.readFileSync(path.join(__dirname, '../src/script.03.minijeux.js'), 'utf8');
const start = src.indexOf('function finalizeTypeComboGame()');
const body = src.slice(start, src.indexOf('\nfunction ', start + 10));

test('la fin d’une partie de Combo de types est envoyée aux stats', () => {
  assert.ok(start > 0);
  assert.match(body, /trackUsage\("complete:typecombo:" \+ \(st\.solved >= 5 \? "win" : "loss"\)\)/);
  // Seulement le compteur : pas d'historique de partie en plus (il déclencherait Ball, classement et fenêtres en double).
  assert.doesNotMatch(body, /recordMatchHistory/);
});

test('le serveur accepte la fin de Combo de types', () => {
  assert.equal(completionEvent('typecombo', 'win'), 'complete:typecombo:win');
  assert.equal(completionEvent('typecombo', 'loss'), 'complete:typecombo:loss');
});
