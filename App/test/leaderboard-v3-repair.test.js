'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

const delegation=fs.readFileSync(path.join(__dirname,'../src/script.07.delegation-party.js'),'utf8');
const leaderboard=fs.readFileSync(path.join(__dirname,'../src/script.10g.leaderboard-v2.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');

test('public leaderboard never bulk-uploads browser profile records',()=>{
  assert.doesNotMatch(delegation,/function submitLeaderboardScores\(/);
  assert.doesNotMatch(delegation,/fetch\("\/api\/scores"/);
  assert.doesNotMatch(leaderboard,/submitLeaderboardScores/);
});

test('leaderboard results remain event-driven',()=>{
  assert.match(leaderboard,/fetchJson\("\/api\/leaderboard\/result"/);
  assert.match(leaderboard,/resultId/);
  assert.match(leaderboard,/Synchronisation du classement/);
});

test('leaderboard empty state is singular and contextual',()=>{
  assert.match(leaderboard,/Pas encore de performance ici/);
  assert.equal((leaderboard.match(/lbv3-empty/g)||[]).length>=1,true);
  assert.equal(leaderboard.includes('lbv2-login-note'),false);
});

test('leaderboard v3 uses grids instead of horizontal mode scrolling',()=>{
  assert.match(style,/\.lbv3-mode-grid \{[\s\S]*grid-template-columns:repeat\(5/);
  assert.match(style,/\.lbv3-gen-tabs \{[\s\S]*grid-template-columns:repeat\(10/);
  assert.match(style,/@media \(max-width:760px\)[\s\S]*\.lbv3-mode-grid \{[\s\S]*repeat\(2/);
});


test('account bootstrap exposes auth before leaderboard submission',()=>{
  assert.match(delegation,/window\.__pokedleAuthed = Boolean\(data\?\.user\)/);
  assert.match(delegation,/pokedle:auth-ready/);
});

test('daily leaderboard backfills a completed win after auth becomes ready',()=>{
  assert.match(leaderboard,/function syncPendingDailyLeaderboard\(\)/);
  assert.match(leaderboard,/pendingDailyLeaderboardScore/);
  assert.match(leaderboard,/pokedle:auth-ready/);
});
