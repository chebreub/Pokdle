'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=fs.readFileSync(path.join(__dirname,'../src/script.07.delegation-party.js'),'utf8');
const league=fs.readFileSync(path.join(__dirname,'../src/script.10i.weekly-league.js'),'utf8');
const slice=(source,from,to)=>source.slice(source.indexOf(from),source.indexOf(to));

function profileFixture(saved){
  const context={readJson:()=>saved,normalizeDiscoveries:v=>v||{},normalizeSecretProgress:v=>v||{},getDailyQuestKey:()=>'2026-10-09',
    saved:null,saveProfile(){context.saved=JSON.parse(JSON.stringify(context.playerProfile));},ensureDailyQuests(){},setTimeout(){},Date,Number,Array,Object,String,JSON,STORAGE_KEYS:{profile:'p'},playerProfile:null};
  vm.createContext(context);
  vm.runInContext(slice(core,'// Plain objects of records keyed','function saveProfile()')+';this.load=loadProfile;',context);
  context.load();
  return context;
}

test('a reload keeps League weeks and badges, Draft PRO records, streaks and unknown fields',()=>{
  const saved={nickname:'Sacha',xp:420,lastDailyLogin:'2026-10-09',
    weeklyLeagueScores:{'2026-W41':370},weeklyLeagueBadges:{'2026-W41':{at:1,score:600,title:'Maître de Ligue'}},weeklyLeagueStats:{'2026-W41':{odd:7}},
    draftScoreProRecords:{all:512},draftScoreProHeadToHead:{B:{wins:2}},oddOneOutStreak:4,weightBattleStreak:3,futureField:{kept:true},favoritePokemonId:null};
  const {playerProfile}=profileFixture(saved);
  for(const key of ['weeklyLeagueScores','weeklyLeagueBadges','weeklyLeagueStats','draftScoreProRecords','draftScoreProHeadToHead','futureField'])
    assert.deepEqual(JSON.parse(JSON.stringify(playerProfile[key])),saved[key],key);
  assert.equal(playerProfile.oddOneOutStreak,4);assert.equal(playerProfile.weightBattleStreak,3);
  assert.equal(playerProfile.favoritePokemonId,null,'An unset favourite must not become Pokémon #0');
  assert.equal(playerProfile.xp,420);
});

function leagueFixture({history,profile,owner='A'}){
  const context={window:{addEventListener(){},__pokedleAuthed:true,__pokedleAccountKnown:true},document:{getElementById(){return null;}},
    playerProfile:profile,matchHistory:history,connectedAccountUser:{id:owner},escapeHtml:s=>String(s),saves:0,saveProfile(){context.saves++;},
    matchHistoryBelongsToCurrent:e=>!e?.owner||e.owner===owner,submitLeaderboardResult(){return Promise.resolve(true);},
    closeOverlayModal(){},ensureOverlay(){},showToast(){},setTimeout(){return 1;},Date,Math,Map,Set,Array,Object,String,Number,Boolean,Promise};
  vm.createContext(context);
  vm.runInContext(league+';this.state=weeklyLeagueState;this.record=weeklyLeagueRecord;this.templates=WEEKLY_LEAGUE_TEMPLATES;this.week=weeklyLeagueIsoWeek;this.metric=weeklyLeagueMetric;',context);
  return context;
}
const now=()=>Date.now();

test('the week survives games rolling out of the 120-game log',()=>{
  const history=Array.from({length:6},()=>({mode:'odd',result:'win',owner:'A',at:now()}));
  const f=leagueFixture({history,profile:{weeklyLeagueBadges:{},weeklyLeagueScores:{}}});
  const oddTemplate=Array.from(f.templates).find(t=>t.id==='odd');
  assert.equal(f.metric(oddTemplate).value,6,'seeded from this week\'s log');
  // A long session pushes those wins out of the log; two new wins are recorded live.
  f.matchHistory.length=0;
  for(let i=0;i<2;i++){const row={mode:'odd',result:'win',owner:'A',at:now()};f.matchHistory.unshift(row);f.record(row);}
  assert.equal(f.metric(oddTemplate).value,8);
  assert.equal(f.metric(oddTemplate).score,200);
});

test('another account\'s games in the shared log never count for this account',()=>{
  const history=[{mode:'odd',result:'win',owner:'B',at:now()},{mode:'odd',result:'win',owner:'B',at:now()},{mode:'odd',result:'win',owner:'A',at:now()}];
  const f=leagueFixture({history,profile:{weeklyLeagueBadges:{},weeklyLeagueScores:{}}});
  const oddTemplate=Array.from(f.templates).find(t=>t.id==='odd');
  assert.equal(f.metric(oddTemplate).value,1);
  f.record({mode:'odd',result:'win',owner:'B',at:now()});
  assert.equal(f.metric(oddTemplate).value,1);
});

test('nothing is stored before the account is known',()=>{
  const f=leagueFixture({history:[{mode:'odd',result:'win',at:now()}],profile:{weeklyLeagueBadges:{},weeklyLeagueScores:{}}});
  f.window.__pokedleAccountKnown=false;
  const oddTemplate=Array.from(f.templates).find(t=>t.id==='odd');
  assert.equal(f.metric(oddTemplate).value,1,'the log is still shown');
  assert.equal(f.playerProfile.weeklyLeagueStats,undefined,'but no week is seeded');
});
