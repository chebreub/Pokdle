'use strict';
// Draft Score Attack « arène de nuit » (refonte visuelle du 11/11/2026) : la nouvelle feuille ne
// touche que l'écran Draft, et le gameplay (relances, pondération, paliers) reste celui d'avant.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const src = read('src/script.06.draft-emulateur.js');
const core = read('src/script.04.jeu-pokedex.js');
const css = read('draft-arena.css');
const slice = (from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test('every draft-arena.css rule stays on the Score Attack screen', () => {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  // Selector lists of style rules (not @media / @keyframes headers nor keyframe steps).
  for (const [, head] of withoutComments.matchAll(/([^{}]+)\{/g)) {
    const text = head.trim();
    if (!text || text.startsWith('@') || /^(from|to|\d+%)(\s*,\s*(from|to|\d+%))*$/.test(text)) continue;
    selectors.push(...text.split(/,(?![^(]*\))/).map((s) => s.trim()));
  }
  assert.ok(selectors.length > 100);
  for (const selector of selectors) {
    assert.match(selector, /^#pokdle-app(:not\(\.reduce-motion\))? (#screen-draft-score-attack\.dsa|#draft-mobile-bar)/, selector);
  }
});

test('the new sheet is bundled last and its animations follow both reduce-motion settings', () => {
  assert.match(read('build.mjs'), /"trainer-profile\.css", "draft-arena\.css"(, "arcade-v2\.css")?(, "home-v4\.css")?\]/);
  assert.match(read('index.html'), /dist\/trainer-profile\.min\.css">\n {2}<link rel="stylesheet" href="dist\/draft-arena\.min\.css">/);
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'), css.indexOf('@keyframes'));
  assert.ok(motion.includes('animation'));
  for (const line of motion.split('\n').filter((l) => l.includes('{') && l.includes('#pokdle-app'))) {
    assert.ok(line.includes('#pokdle-app:not(.reduce-motion)'), line);
  }
});

test('the redesign keeps the gameplay constants and the weighted draw untouched', () => {
  assert.match(core, /const DRAFT_TEAM_SIZE = 6;/);
  assert.match(core, /const DRAFT_PICK_COUNT = 6;/);
  assert.match(core, /const DRAFT_SHINY_CHANCE = 0\.01;/);
  assert.match(core, /const DRAFT_SCORE_ATTACK_REROLLS = 5;/);
  const c = {};
  vm.createContext(c);
  vm.runInContext(core.slice(core.indexOf('function clampDraftValue('), core.indexOf('function draftEraKeyForGen(')), c);
  vm.runInContext(slice('function getDraftWeightedChance(', 'function pickWeightedDraftPokemon('), c);
  assert.deepEqual([40, 50, 70, 80, 90, 100].map((p) => c.getDraftWeightedChance(p)), [0.48, 0.72, 1, 0.7, 0.36, 0.15]);
});

test('screen classes, generation tiles and « Rejouer » are presentation only', () => {
  assert.match(src, /screen\.classList\.toggle\("dsa", isScoreAttackMode\)/);
  // Tiles keep the same click handler and the same « disabled while drafting » rule.
  const genLoop = slice('if (genButtons) {', 'if (options) {');
  assert.match(genLoop, /btn\.disabled = draftArenaState\.phase !== "gen" && !canHostRelaunch;/);
  assert.match(genLoop, /btn\.addEventListener\("click", \(\) => selectDraftGeneration\(cfg\.gen\)\);/);

  const calls = [];
  const c = {
    window: {}, document: { getElementById: () => null },
    draftGenLabel: (gen) => ['', 'Gen 1 (Kanto)', 'Gen 2 (Johto)'][gen],
    getDraftPoolForGeneration: (gen) => new Array(gen === 1 ? 151 : 100),
    restartDraftArenaRun: () => calls.push('restart'),
    selectDraftGeneration: (gen) => calls.push('gen:' + gen),
  };
  vm.createContext(c);
  vm.runInContext(slice('const DRAFT_GEN_MASCOTS', 'function mountDraftModeCard('), c);
  assert.equal(c.draftGenRegion(1), 'Kanto');
  assert.equal(c.getDraftGenPoolSize(1), 151);
  c.draftArenaState = { selectedGen: 2, scoreAttackRoom: null };
  c.replayDraftScoreAttackGen();
  assert.deepEqual(calls, ['restart', 'gen:2'], 'solo: same generation again');
  calls.length = 0;
  c.draftArenaState = { selectedGen: 2, scoreAttackRoom: { code: 'X' } };
  c.replayDraftScoreAttackGen();
  assert.deepEqual(calls, ['restart'], 'in a 1v1 room the usual restart decides');
});

test('the result shows the whole team with the highest BST as MVP', () => {
  const result = slice('const previousRecord = Number(draftArenaState.scoreAttackPreviousRecord)', 'endActions.classList.remove("hidden");');
  assert.match(result, /class="dse-team"/);
  assert.match(result, /Math\.max\(0, \.\.\.teamMetricsList\.map\(\(entry\) => entry\.bst\)\)/);
  assert.match(result, /data-action="replayDraftScoreAttackGen"/);
  assert.match(result, /data-action="restartDraftArenaRun"/);
  assert.match(result, /data-action="openLeaderboard"/);
  assert.match(result, /data-action="shareDraftScore"/);
});
