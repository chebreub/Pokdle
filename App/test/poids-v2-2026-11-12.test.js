'use strict';
// Duel de poids v2 (12/11) : le résultat reste lisible (phrase qui compare les deux poids, badges),
// la fiche « Nouvelle entrée » s'ouvre au clic sur « Manche suivante » au lieu de couvrir le résultat.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../src/script.10zzzze.poids-v2.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../arcade-v2.css'), 'utf8');

function fn(name) {
  const a = src.indexOf('function ' + name), b = src.indexOf('\n}\n', a) + 3;
  return src.slice(a, b);
}
const ctx = vm.createContext({});
vm.runInContext(fn('poidsKg') + fn('poidsComparison'), ctx);
const mon = (id, name, weight) => ({ id, name, weight });

test('la phrase donne les deux poids et l’écart', () => {
  const s = { left: mon(143, 'Ronflex', 460), right: mon(25, 'Pikachu', 6) };
  assert.equal(ctx.poidsComparison(s, 143), 'Ronflex pèse 460 kg, Pikachu 6 kg : 77 fois plus lourd.');
  const t = { left: mon(1, 'Galopa', 95), right: mon(2, 'Insécateur', 56) };
  assert.equal(ctx.poidsComparison(t, 1), 'Galopa pèse 95 kg, Insécateur 56 kg : 39 kg de plus.');
  const u = { left: mon(3, 'Abo', 6.9), right: mon(4, 'Papilusion', 32) };
  assert.equal(ctx.poidsComparison(u, 4), 'Papilusion pèse 32 kg, Abo 6,9 kg : 5 fois plus lourd.');
  const v = { left: mon(5, 'A', 10), right: mon(6, 'B', 10) };
  assert.equal(ctx.poidsComparison(v, 5), 'A et B pèsent tous les deux 10 kg.');
});

test('la grande fiche du nouveau Pokémon attend « Manche suivante » au lieu de couvrir le résultat (solo seulement)', () => {
  assert.match(src, /celebrateStandardDiscovery = function \(pokemon, mode, at\)/);
  assert.match(src, /mode === 'weight' && pokemon && box && !box\.classList\.contains\('hidden'\) && poidsSoloResult\(state\)/);
  assert.match(src, /poidsPendingDiscovery = \{ pokemon, mode \}/);
  assert.match(src, /closest\?\.\('#weight-restart, #weight-result-catalog'\)/);
  assert.match(src, /poidsCelebrateBefore\(pending\.pokemon, pending\.mode, Date\.now\(\)\)/);
  assert.match(src, /partySession\?\.currentModeKey === 'weight'/);
  assert.match(src, /return poidsCelebrateBefore\.apply\(this, arguments\)/);
});

test('le bouton dit « Manche suivante → » ou « ↻ Nouvelle série », et rien ne s’enchaîne tout seul', () => {
  assert.match(src, /won \? 'Manche suivante →' : '↻ Nouvelle série'/);
  assert.doesNotMatch(src, /replayWeightBattle\(\)|startWeightBattle\(\)/);
  assert.match(css, /\.pv2-heavy\{/);
});
