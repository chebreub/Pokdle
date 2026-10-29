'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../src/script.06.draft-emulateur.js'), 'utf8');
const slice = (from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

test('Score Attack card labels follow the BST goals, whatever the habitat', () => {
  const c = {};
  vm.createContext(c);
  vm.runInContext(slice('function draftScoreTier(', 'function mountDraftModeCard('), c);
  assert.deepEqual([300, 499, 500, 549, 550, 599, 600, 720].map((bst) => c.draftScoreTier(bst).label),
    ['Standard', 'Standard', 'Solide', 'Solide', 'Elite', 'Elite', 'Master', 'Master']);
  assert.equal(c.draftScoreTier(undefined).key, 'standard');
});

test('"Nouvelle draft" asks first only when picks would be lost', () => {
  const calls = [];
  const c = {
    DRAFT_TEAM_SIZE: 6, document: { querySelector: () => null }, window: {},
    restartDraftArenaRun: () => calls.push('restart'), closeOverlayModal: () => calls.push('close'),
    ensureOverlay: (title) => calls.push('ask:' + title),
  };
  vm.createContext(c);
  vm.runInContext(slice('function requestDraftRestart(', 'function openDraftDuelChoice('), c);
  c.draftArenaState = { mode: 'scoreAttack', phase: 'draft', team: [1, 2], duelMode: false };
  c.requestDraftRestart();
  assert.deepEqual(calls, ['ask:Nouvelle draft ?']);
  c.confirmDraftRestart();
  assert.deepEqual(calls.slice(1), ['close', 'restart']);
  calls.length = 0;
  c.draftArenaState = { mode: 'scoreAttack', phase: 'draft', team: [], duelMode: false };
  c.requestDraftRestart();
  assert.deepEqual(calls, ['restart'], 'nothing to lose: restart at once');
});
