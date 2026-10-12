'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const minigames=fs.readFileSync(path.join(__dirname,'../src/script.03.minijeux.js'),'utf8');
const slice=(source,from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));

test('Stat Clash Party always plays six rounds, one per statistic, whatever the host picked',()=>{
  const c={};vm.createContext(c);
  vm.runInContext(slice(server,'function partyTotalRoundsForMode','function isPartyStatMode')+';this.rounds=partyTotalRoundsForMode;',c);
  for(const configured of [undefined,5,10,15,20])assert.equal(c.rounds('statclashparty',configured),6);
  assert.equal(c.rounds('guess',10),10);
  assert.equal(c.rounds('guess',undefined),5);
  assert.equal(c.rounds('dexrace',20),1);
  // Every place that sets the round count goes through the same rule.
  assert.doesNotMatch(server,/mode === "statclashparty" \? 6 : 5\)/);
});

test('the 60-second Higher or Lower ends the Marathon round once',()=>{
  let notified=[],recorded=0,rendered=0;
  const c={higherLowerState:{phase:'playing',score:12,rushHighScore:3},playerProfile:{},saveProfile(){},
    recordMatchHistory(){recorded++;},renderHigherLowerScreen(){rendered++;},notifyPartyRoundFromScreenMode:(win,summary)=>notified.push([win,summary])};
  vm.createContext(c);
  vm.runInContext(slice(minigames,'function finalizeHigherLowerRush','function pickHigherLowerStat')+';this.finish=finalizeHigherLowerRush;',c);
  c.finish();c.finish();
  assert.deepEqual(notified,[[true,'12 en 60 s']]);
  assert.equal(recorded,1);
  assert.equal(c.playerProfile.higherLower60sHighScore,12);
});
