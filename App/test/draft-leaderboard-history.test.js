'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const client = fs.readFileSync(path.join(__dirname, '../src/script.10g.leaderboard-v2.js'), 'utf8');

function savedDraftBest(records) {
  const context = {
    window: { __pokedleAuthed: false, addEventListener() {} },
    playerProfile: { draftScoreAttackRecords: records },
    matchHistory: [],
    document: { getElementById() { return null; } },
    escapeHtml: (value) => String(value),
    ensureOverlay() {},
    fetch() { return Promise.reject(new Error('offline')); },
    recordMatchHistory() {},
    localStorage: { getItem() { return null; }, setItem() {} },
    setTimeout() { return 0; }, clearTimeout() {},
    Date, Math, Map, Set, Array, Object, String, Number, Boolean, Promise
  };
  vm.createContext(context);
  vm.runInContext(client + '\nthis.readSavedDraftBest=leaderboardV2DraftLocalBest;', context);
  return context.readSavedDraftBest;
}

test('saved Draft scores remain available per generation and in the overall profile view', () => {
  const best = savedDraftBest({ 1: '490', 3: 610, 5: 'invalid', 9: 0 });
  assert.equal(best('draft_1'), 490);
  assert.equal(best('draft_3'), 610);
  assert.equal(best('draft_9'), 0);
  assert.equal(best('draft_all'), 610);
  assert.equal(best('draft'), 610);
  assert.equal(best('quiz'), 0);
  assert.equal(savedDraftBest({})('draft_all'), 0);
});

test('only valid positive integer BST records are displayed as saved scores', () => {
  const best = savedDraftBest({ 1: -2, 2: 1050, 3: 517.5, 4: 545 });
  assert.equal(best('draft_all'), 545);
  assert.equal(best('draft_1'), 0);
  assert.equal(best('draft_2'), 0);
  assert.equal(best('draft_3'), 0);
});

test('public Draft rankings include recorded generations without promoting profile data', () => {
  assert.match(server, /const LB_DRAFT_MODES = \["draft_all", \.\.\.Array\.from\(\{ length: 9 \}/);
  assert.match(server, /const scoreboardParams = globalDraft \? \[LB_DRAFT_MODES\] : \[mode\];/);
  assert.match(server, /SELECT DISTINCT ON \(s\.discord_id\)/);
  assert.match(server, /WHERE s\.mode = ANY\(\$1\)/);
  assert.match(server, /WHERE e\.mode \$\{globalDraft \? "= ANY\(\$1\)" : "= \$1"\}/);
  assert.match(server, /COUNT\(DISTINCT discord_id\)::int AS n FROM scores WHERE mode = ANY\(\$1\) GROUP BY 1/);
  assert.match(server, /COUNT\(DISTINCT discord_id\)::int AS n FROM leaderboard_events e WHERE e\.mode = ANY\(\$1\)/);
});

test('the profile and public records are separated; no old bulk upload is restored', () => {
  assert.match(client, /Record personnel|Ton record personnel/);
  assert.match(client, /lbv3-local-record/);
  assert.match(client, /localDraftBest > \(Number\(data\?\.me\?\.score\)\|\|0\)/);
  assert.doesNotMatch(client, /submitLeaderboardScores/);
  assert.match(server, /legacy_score_sync_retired/);
});
