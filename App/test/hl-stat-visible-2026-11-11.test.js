'use strict';
// Higher or Lower (11/11) : la stat de la manche se voit (bandeau coloré, boutons « Plus de Vitesse »),
// et une bonne réponse laisse 1 s d'affichage au lieu de 1,8 s.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mini = fs.readFileSync(path.join(__dirname, '../src/script.03.minijeux.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../arcade-v2.css'), 'utf8');

test('les boutons nomment la stat, avec l’élision devant une voyelle', () => {
  const a = mini.indexOf('function higherLowerMoreLabel'), b = mini.indexOf('\n}\n', a) + 3;
  const ctx = vm.createContext({}); vm.runInContext(mini.slice(a, b), ctx);
  assert.equal(ctx.higherLowerMoreLabel({ label: 'Vitesse' }, true), 'Plus de Vitesse');
  assert.equal(ctx.higherLowerMoreLabel({ label: 'Attaque' }, false), 'Moins d’Attaque');
  assert.equal(ctx.higherLowerMoreLabel({ label: 'PV' }, false), 'Moins de PV');
  assert.match(mini, /higherLowerMoreLabel\(statMeta, true\)/);
  assert.match(mini, /higherLowerMoreLabel\(statMeta, false\)/);
});
test('le bandeau de la stat n’est plus caché et prend la couleur de la stat', () => {
  assert.doesNotMatch(css, /\.higher-lower-stat-banner\{display:none\}/);
  assert.match(css, /\.higher-lower-stat-banner\{order:-1;display:flex!important/);
  for (const k of ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed']) assert.match(css, new RegExp('data-stat="' + k + '"'));
  assert.match(mini, /<div class="higher-lower-board" data-stat="\$\{escapeHtml\(statMeta\.key\)\}">/);
});
test('version sans serveur : 1 s après une bonne réponse, 1,8 s après une erreur', () => {
  assert.match(mini, /higherLowerState\.mode === "rush60" \? 900 : \(correct \? 1000 : 1800\)/);
});
