'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/script.10h.live-rank.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');

function fixture(){
  const context={
    window:{},
    playerProfile:{
      quizHighScore:8,
      speedrunHighScore:14,
      higherLowerHighScore:12,
      higherLower60sHighScore:19,
      typeComboHighScore:240,
      draftScoreAttackRecords:{3:515,4:530}
    },
    matchHistory:[
      {mode:'daily',result:'win',attempts:7},
      {mode:'daily',result:'win',attempts:4}
    ],
    attempts:5,quizScore:6,
    speedrunState:{correct:9},
    higherLowerState:{score:11,mode:'infinite'},
    typeComboState:{score:180},
    draftArenaState:{team:[],selectedGen:4,mode:'scoreAttack'},
    getDraftTeamBstMetrics(){return {average:505};},
    leaderboardV2ModeMeta(mode){
      if(mode==='daily') return {unit:'essais',direction:'asc'};
      return {unit:'pts',direction:'desc'};
    },
    leaderboardV2FormatScore(score){return String(score);},
    document:{getElementById(){return null;},querySelector(){return null;}},
    fetch(){return Promise.resolve({json:()=>Promise.resolve({ok:true})});},
    escapeHtml:s=>String(s),
    CSS:{escape:s=>String(s)},
    Date,Math,Map,Set,Array,Object,String,Number,Boolean,Promise,
    setTimeout(){return 1;},clearTimeout(){}
  };
  vm.createContext(context);
  vm.runInContext(source+'\nthis.__best=liveRankPersonalBest;this.__ctx=liveRankCurrentContext;this.__goal=liveRankGoal;this.__copy=liveRankGoalCopy;',context);
  return context;
}

test('personal best uses the correct record source for each mode',()=>{
  const f=fixture();
  assert.equal(f.__best('quiz'),8);
  assert.equal(f.__best('speedrun'),14);
  assert.equal(f.__best('higherlower'),12);
  assert.equal(f.__best('higherlower60'),19);
  assert.equal(f.__best('typecombo'),240);
  assert.equal(f.__best('draft_4'),530);
  assert.equal(f.__best('draft_all'),530);
  assert.equal(f.__best('daily'),4);
});

test('current live score maps correctly to each competitive mode',()=>{
  const f=fixture();
  assert.equal(f.__ctx('daily').score,5);
  assert.equal(f.__ctx('quiz').score,6);
  assert.equal(f.__ctx('speedrun').score,9);
  assert.equal(f.__ctx('higherlower').score,11);
  assert.equal(f.__ctx('typecombo').score,180);
  assert.equal(f.__ctx('draft_4').score,505);
});

test('next rank target respects leaderboard direction',()=>{
  const f=fixture();
  const data={me:{rank:5,score:10},top:[],around:[
    {rank:4,score:12,username:'A'},
    {rank:5,score:10,username:'Me',me:true},
    {rank:6,score:8,username:'B'}
  ]};
  let goal=f.__goal(data,'quiz');
  assert.equal(goal.rank,4);
  assert.equal(goal.score,13);

  const daily={me:{rank:5,score:7},top:[],around:[
    {rank:4,score:6,username:'A'},
    {rank:5,score:7,username:'Me',me:true}
  ]};
  goal=f.__goal(daily,'daily');
  assert.equal(goal.rank,4);
  assert.equal(goal.score,5);
});

test('leader message and reachable target copy are explicit',()=>{
  const f=fixture();
  assert.equal(f.__copy({me:{rank:1,score:10},top:[],around:[]},'quiz',10).tone,'leader');
  const copy=f.__copy({me:{rank:3,score:10},top:[],around:[
    {rank:2,score:11,username:'A'},{rank:3,score:10,username:'Me'}
  ]},'quiz',12);
  assert.equal(copy.tone,'hot');
});

test('live rank HUD has responsive and reduced-motion styling',()=>{
  assert.match(style,/\.live-rank-hud/);
  assert.match(style,/@media \(max-width:640px\)[\s\S]*\.live-rank-hud/);
  assert.match(style,/prefers-reduced-motion/);
});
