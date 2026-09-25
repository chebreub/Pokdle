'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const client=fs.readFileSync(path.join(__dirname,'../src/script.10g.leaderboard-v2.js'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const club=fs.readFileSync(path.join(__dirname,'../src/script.09.club.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');

function clientFixture(){
  const context={
    window:{__pokedleAuthed:false},
    playerProfile:{oddOneOutStreak:4,weightBattleStreak:7},
    document:{getElementById(){return null;}},
    escapeHtml:s=>String(s),
    ensureOverlay(){},
    fetch(){return Promise.reject(new Error('offline'));},
    recordMatchHistory(){},
    setTimeout(){return 1;},clearTimeout(){},
    Date,Math,Map,Set,Array,Object,String,Number,Boolean,Promise
  };
  vm.createContext(context);
  vm.runInContext(client+'\nthis.__map=leaderboardResultFromHistory;this.__format=leaderboardV2FormatScore;this.__meta=leaderboardV2ModeMeta;',context);
  return context;
}

test('daily leaderboard is ascending while score modes remain descending',()=>{
  const f=clientFixture();
  assert.equal(f.__meta('daily').direction,'asc');
  assert.equal(f.__meta('quiz').direction,'desc');
  assert.equal(f.__meta('draft_3').direction,'desc');
});

test('history entries map to the right competitive metric',()=>{
  const f=clientFixture();
  assert.deepEqual(JSON.parse(JSON.stringify(f.__map({mode:'daily',result:'win',attempts:6}))),{mode:'daily',score:6});
  assert.deepEqual(JSON.parse(JSON.stringify(f.__map({mode:'quiz',result:'win',targetName:'Score 8/10'}))),{mode:'quiz',score:8});
  assert.deepEqual(JSON.parse(JSON.stringify(f.__map({mode:'speedrun',result:'win',attempts:14}))),{mode:'speedrun',score:14});
  assert.deepEqual(JSON.parse(JSON.stringify(f.__map({mode:'party',result:'win',targetName:'4 victoires / 5'}))),{mode:'party',score:4});
  assert.deepEqual(JSON.parse(JSON.stringify(f.__map({mode:'odd',result:'win',attempts:1}))),{mode:'intrus',score:5});
  assert.equal(f.__map({mode:'daily',result:'loss',attempts:11}),null);
});

test('server stores dated events and exposes today week all scopes',()=>{
  assert.match(server,/CREATE TABLE IF NOT EXISTS leaderboard_events/);
  assert.match(server,/leaderboard_events_mode_created_idx/);
  assert.match(server,/\["today", "week", "all"\]/);
  assert.match(server,/date_trunc\('day'/);
  assert.match(server,/interval '7 days'/);
  assert.match(server,/RANK\(\) OVER/);
  assert.match(server,/around:/);
});

test('server sanity-checks mode-specific score ceilings',()=>{
  assert.match(server,/Quiz", unit: "bonnes réponses", max: 10/);
  assert.match(server,/Pokémon du jour", unit: "essais", max: 100/);
  assert.match(server,/if \(n > max\) return null/);
});

test('result screen is compact and contains leaderboard preview styling',()=>{
  assert.match(club,/box\.insertBefore\(detail, actions\)/);
  assert.match(club,/openRegisteredPokemonInPokedex/);\n  assert.match(club,/dans le Pokédex/);
  assert.match(style,/\.win-ranking-preview/);
  assert.match(style,/\.lbv2-podium/);
  assert.match(style,/\.lbv2-around/);
});
