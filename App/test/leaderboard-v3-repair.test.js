'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

const delegation=fs.readFileSync(path.join(__dirname,'../src/script.07.delegation-party.js'),'utf8');
const leaderboard=fs.readFileSync(path.join(__dirname,'../src/script.10g.leaderboard-v2.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');

test('leaderboard sync includes all modern competitive records',()=>{
  assert.match(delegation,/higherlower60:\s*Number\(playerProfile\.higherLower60sHighScore\)/);
  assert.match(delegation,/typecombo:\s*Number\(playerProfile\.typeComboHighScore\)/);
  assert.match(delegation,/scores\.draft_all = draftAll/);
});

test('leaderboard sync runs immediately after authenticated profile sync',()=>{
  assert.match(delegation,/setTimeout\(function \(\) \{ try \{ submitLeaderboardScores\(\); \}/);
});

test('opening all-time leaderboard syncs local records before fetching',()=>{
  assert.match(leaderboard,/leaderboardV2Scope==="all"/);
  assert.match(leaderboard,/submitLeaderboardScores/);
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
