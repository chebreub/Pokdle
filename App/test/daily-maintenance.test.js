'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=file=>fs.readFileSync(path.join(__dirname,'../src/'+file),'utf8');
function fn(file,name){const text=source(file),start=text.indexOf('function '+name+'(');assert.ok(start>=0);let pos=text.indexOf('{',start),depth=1,end=pos+1;for(;depth&&end<text.length;end++){if(text[end]==='{')depth++;if(text[end]==='}')depth--;}return text.slice(start,end);}
test('Daily start counts a validated active day once, not every reopening or offline attempt',()=>{
  const c={gameMode:'daily',dailyServerState:null,playerStats:{played:0},saveStats(){},evaluateAchievements(){},renderStats(){}};vm.createContext(c);vm.runInContext(fn('script.07.delegation-party.js','registerGameStart'),c);
  c.registerGameStart();assert.equal(c.playerStats.played,0);
  c.dailyServerState={day:'2026-10-09',accountId:'A',finished:false};c.registerGameStart();c.registerGameStart();assert.equal(c.playerStats.played,1);
  c.dailyServerState.finished=true;c.registerGameStart();assert.equal(c.playerStats.played,1);
  c.dailyServerState={day:'2026-10-10',accountId:'A',finished:false};c.registerGameStart();assert.equal(c.playerStats.played,2);
  c.gameMode='normal';c.registerGameStart();assert.equal(c.playerStats.played,3);
});
test('HL quest requires a real ten-answer streak, including quests saved before the comparator fix',()=>{
  const quest={id:'hl_streak_10',target:10,progress:0,xp:90};let awards=0;
  const c={playerProfile:{},ensureDailyQuests:()=>[quest],awardXp(){awards++;},saveProfile(){},updateXpBadge(){},Date,Number,Math};vm.createContext(c);vm.runInContext(fn('script.01.core.js','progressQuest'),c);
  for(const n of [1,2,3,4,1,2,3,4,5,6,7,8,9])c.progressQuest(quest.id,n);
  assert.equal(quest.progress,9);assert.equal(awards,0);c.progressQuest(quest.id,10);c.progressQuest(quest.id,11);assert.equal(awards,1);
});
test('League launches prepare the correct screen before starting their timer/game',()=>{
  const calls=[],c={closeOverlayModal(){},openSpeedrunMode(){calls.push('open speed');},startSpeedrunGame(){calls.push('start speed');},openHigherLowerMode(){calls.push('open hl');},startHigherLowerMode(mode){calls.push(mode);}};
  vm.createContext(c);vm.runInContext(fn('script.10i.weekly-league.js','weeklyLeagueLaunch'),c);c.weeklyLeagueLaunch('speedrun');c.weeklyLeagueLaunch('higherlower');assert.deepEqual(calls,['open speed','start speed','open hl','infinite']);
});
test('Home chooses the first unfinished stage, or the final summary after four stages',()=>{
  const c={};vm.createContext(c);vm.runInContext(fn('script.10s.daily-home.js','dailyHomeNext'),c);
  for(let completed=0;completed<=4;completed++)assert.equal(c.dailyHomeNext({stages:Array.from({length:4},(_,i)=>({finished:i<completed}))}),completed===4?-1:completed);
});
