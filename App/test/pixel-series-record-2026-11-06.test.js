"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const seriesSource = fs.readFileSync(path.join(__dirname, "../src/script.10xm.guess-series.js"), "utf8");
const mergeSource = fs.readFileSync(path.join(__dirname, "../src/script.07a.profile-merge.js"), "utf8");
const plain = v => JSON.parse(JSON.stringify(v));
function prefixFixture(profile = {}) {
  const c = {window:{}, playerProfile:profile, escapeHtml:String,
    localStorage:{getItem(){return null;}}, GUESS_SERIES_SIZES:[5,10,20]};
  vm.createContext(c);
  vm.runInContext(seriesSource.split("GUESS_SERIES_ON.forEach(")[0], c);
  return c;
}
function finished(found, attemptsWon, total = 10) {
  return { mode:"pixel", total, found, attemptsWon, recorded:true,
    index:total, rounds:Array.from({length:total}, (_,i)=>({
      id:i+1, name:"Pokemon" + i, won:i<found
    })), xpStart:0 };
}

test("SER-01: historic count-only best is not falsely given an attempt count", () => {
  const profile = {xp:200, guessSeriesBest:{pixel:{5:4,10:7}}};
  const c=prefixFixture(profile);
  let state=c.guessSeriesPixelStatus(finished(7,15));
  assert.equal(state.bestCount,7);
  assert.equal(state.previous,null,"legacy score has no attempt history");
  assert.equal(state.countRecord,false,"equal legacy found is not a new record");
  assert.equal(state.firstReference,true);
  assert.match(c.guessSeriesSummaryHtml(finished(7,15)), /record égalé ; 1re référence d’essais/);
  assert.doesNotMatch(c.guessSeriesSummaryHtml(finished(7,15)), /🏆 Record !/);
  assert.equal(profile.guessSeriesBest.pixel[5],4,"other series lengths are untouched");
});

test("SER-01: found count wins before attempts; tracked ties use fewer guesses", () => {
  const profile = {xp:200,guessSeriesBest:{pixel:{10:7}},guessSeriesPrecision:{pixel:{10:{found:7,attemptsWon:18}}}};
  const c=prefixFixture(profile);
  assert.equal(c.guessSeriesPixelStatus(finished(6,6)).precisionBetter,false);
  assert.equal(c.guessSeriesPixelStatus(finished(7,20)).precisionBetter,false);
  assert.equal(c.guessSeriesPixelStatus(finished(7,18)).precisionBetter,false);
  assert.equal(c.guessSeriesPixelStatus(finished(7,17)).precisionBetter,true);
  assert.equal(c.guessSeriesPixelStatus(finished(7,17)).countRecord,false);
  assert.match(c.guessSeriesSummaryHtml(finished(7,17)), /Meilleur départage suivi/);
  assert.doesNotMatch(c.guessSeriesSummaryHtml(finished(7,17)), /🏆 Record !/);
  assert.equal(c.guessSeriesPixelStatus(finished(8,30)).countRecord,true);
  assert.match(c.guessSeriesSummaryHtml(finished(8,30)), /🏆 Record !/);
});

test("SER-01: unfinished, corrupted, zero-win and wrong-length records never become measured bests", () => {
  const c=prefixFixture({guessSeriesBest:{pixel:{10:5}},guessSeriesPrecision:{pixel:{10:{found:10,attemptsWon:2}}}});
  assert.equal(c.guessSeriesPixelStatus(finished(5,10)).previous,null);
  for(const s of [
    {...finished(7,10),recorded:false},
    {...finished(7,10),rounds:[]},
    {...finished(0,0)},
    {...finished(7,6)},
    {...finished(11,22)},
    {...finished(7,Infinity)},
    {...finished(7,10),total:8}
  ]) assert.equal(c.guessSeriesPixelStatus(s).current,null);
  assert.equal(c.guessSeriesPixelStatus(finished(5,10)).firstReference,true);
});

function runFixture(profile) {
  const summaries=[],submitted=[],saved=[];
  const storage=new Map();
  const ctx={
    window:{__pokedleAccountKnown:true},
    playerProfile:profile,
    dailyObservedAccountId:()=> "account-A",
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},
    selectedGens:new Set([1]),gameMode:"pixel",gameOver:false,attempts:0,
    secretPokemon:null,resultHistory:[],guessedNames:[],
    escapeHtml:String,showToast(){},
    saveProfile(){saved.push(plain(ctx.playerProfile));},
    submitLeaderboardResult(...args){submitted.push(args);},
    renderGameOverBox(){},
    document:{
      querySelector(){return null;},
      getElementById(id) {return id==="win-box" ? {insertAdjacentHTML(_at,html){summaries.push(html);}}:null;}
    }
  };
  ctx.window.startPixelGame=()=> {
    ctx.gameMode="pixel";ctx.gameOver=false;ctx.secretPokemon={id:25,name:"Pikachu"};ctx.attempts=0;
  };
  vm.createContext(ctx);
  vm.runInContext(seriesSource,ctx);
  ctx.startGuessSeries("pixel",10);
  return {ctx,storage,summaries,submitted,saved};
}
function completeRun(f, found, totalAttempts) {
  const s=f.ctx.guessSeries;
  s.index=10;s.found=found-1;s.attemptsWon=totalAttempts-2;
  s.recorded=false;
  s.rounds=Array.from({length:9},(_,i)=>({id:100+i,name:"Poke"+i,won:i<found-1}));
  f.ctx.secretPokemon={id:25,name:"Pikachu"};
  f.ctx.attempts=2;f.ctx.gameOver=true;
  f.ctx.renderGameOverBox({won:true});
  return s;
}

test("SER-01: finishing Pixel10 persists precision independently of legacy score and leaderboard", () => {
  const original={pixel:{5:3,10:7,20:13},cry:{10:6}};
  const f=runFixture({xp:100,guessSeriesBest:plain(original)});
  completeRun(f,7,16);
  assert.equal(f.saved.length,1,"one coherent profile write at end");
  assert.deepEqual(plain(f.ctx.playerProfile.guessSeriesBest),original,"equal old count unchanged");
  assert.deepEqual(plain(f.ctx.playerProfile.guessSeriesPrecision),
    {pixel:{"10":{found:7,attemptsWon:16}}});
  assert.match(f.summaries[0],/record égalé ; 1re référence d’essais/);
  assert.deepEqual(plain(f.submitted),[["pixel10",7]],"public challenge score remains found-only");
  const stored = [...f.storage.values()].map(JSON.parse).find(x=>x.mode==="pixel");
  assert.ok(stored && stored.found===7 && stored.rounds.length===10,
    "existing account/round checkpoint behavior preserved");
});

test("SER-01: improvement with equal found updates ONLY measured precision, not historical count", () => {
  const f=runFixture({xp:100,guessSeriesBest:{pixel:{10:7}},guessSeriesPrecision:{pixel:{10:{found:7,attemptsWon:19}}}});
  completeRun(f,7,17);
  assert.deepEqual(plain(f.ctx.playerProfile.guessSeriesPrecision.pixel[10]),{found:7,attemptsWon:17});
  assert.equal(f.ctx.playerProfile.guessSeriesBest.pixel[10],7);
  assert.match(f.summaries[0],/Meilleur départage suivi/);
  assert.deepEqual(plain(f.submitted),[["pixel10",7]]);
});

function mergedProfile(a,b) {
  const ctx={};vm.createContext(ctx);vm.runInContext(mergeSource,ctx);
  const blob=p=>({_accountId:"user-A",profile:JSON.stringify(p)});
  return JSON.parse(ctx.mergeSyncBlobs(blob(a),blob(b)).profile);
}

test("SER-01: account sync never resets historical series best from either device", () => {
  for(const [a,b] of [
    [{guessSeriesBest:{pixel:{5:4,10:7},cry:{10:6}}},{guessSeriesBest:{pixel:{10:8,20:15},cry:{10:5}}}],
    [{guessSeriesBest:{pixel:{10:8,20:15},cry:{10:5}}},{guessSeriesBest:{pixel:{5:4,10:7},cry:{10:6}}}]
  ]) {
    const got=mergedProfile(a,b);
    assert.deepEqual(got.guessSeriesBest,{pixel:{"5":4,"10":8,"20":15},cry:{"10":6}});
    assert.equal(typeof got.guessSeriesBest,"object","a non-numeric Best must never become zero");
  }
});

test("SER-01: previously corrupted zero wrappers never erase surviving series bests", () => {
  const valid = {guessSeriesBest:{pixel:{"5":"4",10:7},cry:{"10":6}}};
  for (const corrupted of [
    {guessSeriesBest:0},
    {guessSeriesBest:{pixel:0,cry:null}},
    {guessSeriesBest:{pixel:{10:0},cry:{10:"not-a-score"}}}
  ]) {
    for (const [a,b] of [[valid,corrupted],[corrupted,valid]]) {
      const result=mergedProfile(a,b);
      assert.deepEqual(result.guessSeriesBest,{pixel:{"5":4,"10":7},cry:{"10":6}},
        "intact per-length records win over broken legacy wrappers, in both merge directions");
    }
  }
});

test("SER-01: account sync prefers more found then fewer attempts, ignores invalid copies", () => {
  const a={guessSeriesBest:{pixel:{10:7}},guessSeriesPrecision:{pixel:{5:{found:3,attemptsWon:9},10:{found:7,attemptsWon:17},20:{found:12,attemptsWon:35}}}};
  const b={guessSeriesBest:{pixel:{10:8}},guessSeriesPrecision:{pixel:{5:{found:4,attemptsWon:15},10:{found:7,attemptsWon:19},20:{found:15,attemptsWon:50}}}};
  for(const [left,right] of [[a,b],[b,a]]) {
    const got=mergedProfile(left,right);
    assert.equal(got.guessSeriesBest.pixel[10],8);
    assert.deepEqual(got.guessSeriesPrecision.pixel,{
      "5":{found:4,attemptsWon:15},"10":{found:7,attemptsWon:17},"20":{found:15,attemptsWon:50}
    });
  }
  const corrupted={guessSeriesPrecision:{pixel:{10:{found:10,attemptsWon:1}}}};
  assert.deepEqual(mergedProfile(corrupted,a).guessSeriesPrecision.pixel[10],{found:7,attemptsWon:17});
  assert.equal(mergedProfile({guessSeriesBest:{pixel:{10:9}}},a).guessSeriesBest.pixel[10],9,
    "a legacy best outliving measured precision must keep its genuine found count");
});
