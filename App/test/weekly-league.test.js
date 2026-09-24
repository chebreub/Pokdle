'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../src/script.10i.weekly-league.js'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const homeCss=fs.readFileSync(path.join(__dirname,'../home.css'),'utf8');
const account=fs.readFileSync(path.join(__dirname,'../src/script.07.delegation-party.js'),'utf8');

function fixture(){
  const context={
    window:{addEventListener(){},__pokedleAuthed:false},
    document:{getElementById(){return null;}},
    playerProfile:{weeklyLeagueBadges:{},weeklyLeagueScores:{}},
    matchHistory:[],
    escapeHtml:s=>String(s),
    saveProfile(){},
    submitLeaderboardResult(){return Promise.resolve(true);},
    closeOverlayModal(){},
    ensureOverlay(){},
    showToast(){},
    setTimeout(){return 1;},
    Date,Math,Map,Set,Array,Object,String,Number,Boolean,Promise
  };
  vm.createContext(context);
  vm.runInContext(source+'\nthis.__week=weeklyLeagueIsoWeek;this.__disc=weeklyLeagueDisciplines;this.__metric=weeklyLeagueMetric;this.__mode=weeklyLeagueLeaderboardMode;this.__templates=WEEKLY_LEAGUE_TEMPLATES;',context);
  return context;
}

test('ISO week id is stable and shared by all players',()=>{
  const f=fixture();
  const info=f.__week(new Date('2026-09-24T12:00:00Z'));
  assert.equal(info.id,'2026-W39');
  assert.equal(info.week,39);
});

test('weekly League always selects three unique disciplines deterministically',()=>{
  const f=fixture();
  const info={year:2026,week:39,id:'2026-W39'};
  const a=Array.from(f.__disc(info)).map(x=>x.id);
  const b=Array.from(f.__disc(info)).map(x=>x.id);
  assert.equal(a.length,3);
  assert.equal(new Set(a).size,3);
  assert.deepEqual(a,b);
});

test('discipline metrics reward mastery and cap at 200 points',()=>{
  const f=fixture();
  const templates=Array.from(f.__templates || []);
  const quiz=templates.find(x=>x.id==='quiz');
  const speed=templates.find(x=>x.id==='speedrun');
  const daily=templates.find(x=>x.id==='daily');
  let metric=f.__metric(quiz,[{mode:'quiz',targetName:'Score 9/10',result:'win'}]);
  assert.equal(metric.complete,true);
  assert.equal(metric.score,180);
  metric=f.__metric(speed,[{mode:'speedrun',attempts:27,result:'win'}]);
  assert.equal(metric.complete,true);
  assert.equal(metric.score,200);
  metric=f.__metric(daily,[{mode:'daily',attempts:4,result:'win'}]);
  assert.equal(metric.complete,true);
  assert.equal(metric.score,170);
});

test('weekly leaderboard mode is isolated by ISO week',()=>{
  const f=fixture();
  assert.equal(f.__mode({id:'2026-W39'}),'weekly_2026-W39');
  assert.match(server,/\^weekly_\\d\{4\}-W\\d\{2\}\$/);
  assert.match(server,/label: "Épreuve de Ligue", unit: "pts", max: 600/);
});

test('League visual system includes home card, modal, ranking and mobile layouts',()=>{
  assert.match(homeCss,/\.weekly-league-home/);
  assert.match(homeCss,/\.weekly-league-modal/);
  assert.match(homeCss,/\.weekly-ranking-list/);
  assert.match(homeCss,/@media \(max-width:520px\)/);
});

test('permanent League badge count is exposed in account menu',()=>{
  assert.match(account,/weeklyLeagueBadges/);
  assert.match(account,/Badges Ligue/);
});
