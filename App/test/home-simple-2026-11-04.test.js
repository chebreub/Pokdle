'use strict';
// Accueil simplifié (4/11/2026, maquette validée) : « Ta prochaine capture », les 3 étapes pour un nouveau joueur,
// et les pastilles « +1 Ball » des mini-jeux, lues dans les modes que le serveur vérifie.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const verifiedArcade = require('../lib/verified-arcade');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10xzm.home-simple.js'), 'utf8');
function load(extra = {}) {
  const ctx = vm.createContext({
    document: { readyState: 'complete', getElementById: () => null, querySelector: () => null },
    window: {}, escapeHtml: (s) => String(s),
    ballTotal: (s) => (s.bag.poke || 0) + (s.bag.great || 0) + (s.bag.ultra || 0),
    ballGrassLeft: (s) => s.wild.left, ballImg: () => '<img>', ...extra
  });
  vm.runInContext(src, ctx);
  return ctx;
}

test('every home game that the server verifies has its Ball tag', () => {
  const ctx = load();
  const club = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.09.club.js'), 'utf8');
  const shelves = club.slice(club.indexOf('const shelves'), club.indexOf('grid.replaceChildren'));
  const keys = [...new Set(shelves.match(/"(start|open)\w+"/g).map((k) => k.slice(1, -1)))];
  for (const key of keys) assert.ok(ctx.HOME_TILE_MODES[key], key + ' has no mode');
  const mapped = new Set(Object.values(ctx.HOME_TILE_MODES));
  for (const mode of verifiedArcade.MODES) if (mode !== 'higher-lower-rush') assert.ok(mapped.has(mode), mode + ' is not on a tile');
});

test('a player with no Ball yet sees the 3 steps, a player who played sees the capture card', () => {
  const ctx = load();
  const fresh = { bag: {}, today: 0, cap: 10, gains: [], wild: { left: 4, caught: 0 }, streak: { days: 0 } };
  assert.equal(ctx.homeSimpleBeginner(fresh), true);
  assert.match(ctx.homeSimpleStepsHtml(), /Devine.*Gagne.*Attrape/s);
  const back = { ...fresh, bag: { poke: 2 }, today: 2, wild: { left: 4, caught: 1 } };
  assert.equal(ctx.homeSimpleBeginner(back), false);
  const html = ctx.homeSimpleCaptureHtml(back);
  assert.match(html, /2 Balls, 4 rencontres/);
  assert.match(html, /data-action="openWildGrass"/);
  assert.match(html, /2 sur 10/);
  // Une Ball déjà lancée hier, sac vide aujourd'hui : pas de bouton vers les herbes, on explique comment en gagner.
  const empty = { ...fresh, wild: { left: 4, caught: 3 } };
  assert.equal(ctx.homeSimpleBeginner(empty), false);
  assert.match(ctx.homeSimpleCaptureHtml(empty), /Comment gagner des Balls/);
});

test('« Aussi aujourd’hui » keeps 3 lines at most and always leads to the Egg, League and Expedition', () => {
  const ctx = load({ albumNextGoal: () => ({ stats: { name: 'Kanto', found: 112, total: 151 }, left: 2, tier: { icon: '🥈' } }), albumDiscoveries: () => ({ 1: 1 }) });
  ctx.expeditionState = { legend: { available: false }, chests: [{ canClaim: true }] };
  vm.runInContext('expeditionState = this.expeditionState', ctx);
  const html = ctx.homeSimpleMoreRows({ giftAvailable: true });
  assert.equal((html.match(/class="hs-row"/g) || []).length, 3);
  assert.match(html, /openHomeDayMore/);
  assert.match(html, /claimBallGift/);
});
