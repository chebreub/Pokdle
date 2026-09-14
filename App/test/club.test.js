'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/script.09.club.js'),'utf8');
function fixture(extra={}) {
 const context={document:{addEventListener(){}},...extra};vm.createContext(context);vm.runInContext(source,context);return context;
}
test('recent shortcuts reject corrupted or unknown actions, remove duplicates and keep three',()=>{
 const env=fixture(), allowed=new Map(['a','b','c','d'].map(k=>[k,{}]));
 assert.equal(env.clubRecentEntries(null,allowed).length,0);
 assert.deepEqual(Array.from(env.clubRecentEntries(['a','bad','a','b','c','d',{}],allowed)),['a','b','c']);
});
test('resume selects the newest valid save, excluding yesterday daily and unknown species',()=>{
 const saves={daily:{mode:'daily',dailyKey:'yesterday',secretId:25,savedAt:300},game:{mode:'normal',secretId:25,savedAt:100}};
 const env=fixture({readJson:key=>saves[key],STORAGE_KEYS:{dailyGame:'daily',game:'game'},VALID_MODES:new Set(['normal','daily']),POKEMON_BY_ID:new Map([[25,{}]]),getUTCDateKey:()=> 'today'});
 assert.equal(env.getClubResumeSave().mode,'normal');
 saves.daily.dailyKey='today';assert.equal(env.getClubResumeSave().mode,'daily');
 saves.daily.secretId=99999;assert.equal(env.getClubResumeSave().mode,'normal');
 saves.game=null;assert.equal(env.getClubResumeSave(),null);
});
test('resume restores without drawing another target or counting a new game',()=>{
 let mode, pushed;const save={mode:'normal',secretId:25,savedAt:1};
 const env=fixture({readJson:()=>save,STORAGE_KEYS:{},VALID_MODES:new Set(['normal']),POKEMON_BY_ID:new Map([[25,{}]]),getUTCDateKey:()=> 'today',restoreSavedGame:m=>{mode=m;return true;},history:{pushState:s=>{pushed=s;}},gameMode:'normal',secretPokemon:{id:25},location:{pathname:'/',search:''}});
 env.resumeClubGame();assert.equal(mode,'normal');assert.equal(pushed.secretId,25);assert.equal(pushed.screen,'game');
});
test('featured picks hide duplicate entries only without a search and preserve the PRO variant',()=>{
 const env=fixture();
 const card=args=>({dataset:{args:JSON.stringify(args)}});
 assert.equal(env.isClubFeatured(card(['openDraftScoreAttackMode']),'solo',''),true);
 assert.equal(env.isClubFeatured(card(['openDraftScoreAttackMode',true]),'solo',''),false);
 assert.equal(env.isClubFeatured(card(['startDailyGame']),'solo','daily'),false);
 assert.equal(env.isClubFeatured(card(['openPartyRoomMode']),'friends',''),true);
 assert.equal(env.isClubFeatured(card(['openPartyRoomMode']),'all',''),false);
});
test('rank movement handles ties and no gain correctly',()=>{
 const env=fixture(),players=[{score:100,lastGain:0},{score:150,lastGain:100},{score:50,lastGain:0}];
 assert.equal(env.partyRankChange(players,players[1]),1);
 assert.equal(env.partyRankChange(players,players[0]),-1);
 assert.equal(env.partyRankChange([{score:100,lastGain:100},{score:100,lastGain:100}],null),0);
});
