'use strict';
// Équilibrage (4/11/2026, maquette validée) : seuils de Super Ball du Combo (10 points), du Stat Clash et des Enchères
// (victoire) et du Draft (palier Elite, 550+), prêts pour quand ces jeux seront vérifiés par le serveur. Gains annoncés.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arcadeGain, ARCADE } = require('../lib/poke-balls');

test('the new fine-game thresholds', () => {
  assert.equal(arcadeGain('typecombo', 'loss', 10).ball, 'great');
  assert.equal(arcadeGain('typecombo', 'loss', 9).ball, 'poke');
  assert.equal(arcadeGain('stat-clash', 'win', 3).ball, 'great');
  assert.equal(arcadeGain('stat-clash', 'loss', 3).ball, 'poke');
  assert.equal(arcadeGain('stat-auction', 'win', 1).ball, 'great');
  assert.ok(ARCADE.includes('draft'));
  assert.deepEqual(arcadeGain('draft', 'win', 551), { source: 'mode:draft', ball: 'great' });
  assert.deepEqual(arcadeGain('draft', 'win', 520), { source: 'mode:draft', ball: 'poke' });
});

test('every game the reward line names has a rule, and unchecked games say they are training', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10xzl.reward-line.js'), 'utf8');
  for (const mode of ['normal', 'pixel', 'quiz', 'higher-lower', 'typecombo', 'stat-clash', 'draft', 'shiny']) assert.match(src, new RegExp("'?" + mode + "'?: '"));
  assert.match(src, /Entraînement : pas de Ball ni de ₽/, 'a game the server does not check yet says it pays nothing');
});
