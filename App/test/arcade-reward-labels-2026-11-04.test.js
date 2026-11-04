'use strict';
// Rewards should never misstate the rules for the two Higher or Lower variants.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/script.10xzl.reward-line.js'), 'utf8');
function fixture(overrides = {}) {
  const state = {
    today: 0, cap: 10, gains: [], bonus: [],
    verifiedModes: ['higher-lower', 'higher-lower-rush', 'quiz'],
    coins: { enabled: true, played: 0, playCap: 2000 },
    ...overrides
  };
  const ctx = vm.createContext({
    document: { body: { dataset: { screen: 'screen-higher-lower' } } },
    higherLowerState: { mode: 'rush60' }, ballState: state, escapeHtml: String
  });
  vm.runInContext(source, ctx);
  return { ctx, state };
}

test('the timed Higher or Lower uses the Rush 25-point threshold', () => {
  const { ctx } = fixture();
  assert.equal(ctx.rewardModeNow(), 'higher-lower-rush');
  const line = ctx.rewardLineHtml(ctx.rewardModeNow());
  assert.match(line, /25 points ou plus/);
  assert.doesNotMatch(line, /série de 15/);
  ctx.higherLowerState.mode = 'infinite';
  assert.equal(ctx.rewardModeNow(), 'higher-lower');
  assert.match(ctx.rewardLineHtml(ctx.rewardModeNow()), /série de 15/);
});

test('both Higher or Lower modes share their daily reward source', () => {
  const { ctx } = fixture({ gains: [{source:'mode:higherlower',ball:'poke'}] });
  assert.match(ctx.rewardLineHtml('higher-lower-rush'), /Récompense du jour gagnée/);
  assert.match(ctx.rewardLineHtml('higher-lower'), /Récompense du jour gagnée/);
});

test('an unverified mode remains training even after the Ball cap', () => {
  const { ctx } = fixture({today:10,verifiedModes:[]});
  assert.match(ctx.rewardLineHtml('quiz'), /Entraînement : pas de Ball ni de ₽/);
});

test('a verified mode at the Ball cap does not misstate the independent coins cap', () => {
  const { ctx } = fixture({today:10});
  const html = ctx.rewardLineHtml('quiz');
  assert.match(html, /Plafond quotidien des Balls atteint/);
  assert.match(html, /Pokédollars ont leur propre plafond/);
  assert.doesNotMatch(html, /revient demain/);
  ctx.ballState.coins.enabled = false;
  assert.doesNotMatch(ctx.rewardLineHtml('quiz'), /Pokédollars/);
});
