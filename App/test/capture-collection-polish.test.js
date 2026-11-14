'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function context(fetch) {
  const ctx = { window: {}, fetch, wildCaptures: null, escapeHtml: s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
    getPokemonSprite: p => '/img/' + p.id + '.png',
    wildSyncAlbum: list => { ctx.wildCaptures = Object.fromEntries(list.map(c => [c.id, c])); } };
  vm.createContext(ctx);
  vm.runInContext(read('pokemon.js') + '\nthis.POKEMON_LIST = POKEMON_LIST;', ctx);
  ctx.POKEMON_BY_ID = new Map(ctx.POKEMON_LIST.map(p => [p.id, p]));
  ctx.wildPokemon = id => ctx.POKEMON_BY_ID.get(Number(id));
  const core = read('src/script.01.core.js');
  vm.runInContext(core.slice(core.indexOf('const VERIFIED_EVOLUTION_FAMILY_STARTS'), core.indexOf('function hasPartyEvolutionCandidate')), ctx);
  vm.runInContext(read('src/script.10xzf.wild-zones.js'), ctx);
  return ctx;
}
const zones = {foret:[1,2,3],mer:[7,8,9],montagne:[74],volcan:[4,5,6],tour:[92],prairie:[25]};
const response = data => Promise.resolve({ok:true,json:async()=>data});

test('zone progress counts distinct owned species, including shinies, never zero-count records', async () => {
  const ctx = context(() => response({ok:true,captures:[{id:1,normal:4},{id:2,normal:0,shiny:1},{id:3,normal:0,shiny:0}],zones:{...zones,foret:[1,1,2,3]}}));
  assert.equal(ctx.wildZoneProgress('foret'), null);
  await ctx.wildZoneLoadPools();
  const p = ctx.wildZoneProgress('foret');
  assert.deepEqual([p.owned,p.total,p.missing,p.percent],[2,3,1,67]);
  assert.equal(ctx.wildZoneMissing('lune'),null);
  assert.equal(ctx.wildOwned(3),false);
});

test('new reads reflect release/trade; a failed refresh hides stale counts instead of inventing zero progress', async () => {
  let payload = {ok:true,captures:[{id:1,normal:1}],zones};
  const ctx = context(() => response(payload));
  await ctx.wildZoneLoadPools();
  assert.equal(ctx.wildZoneProgress('foret').owned,1);
  payload = {ok:true,captures:[],zones};
  await ctx.wildZoneLoadPools();
  assert.equal(ctx.wildZoneProgress('foret').owned,0);
  payload = {ok:false};
  await ctx.wildZoneLoadPools();
  assert.equal(ctx.wildZoneProgress('foret'),null);
  assert.match(ctx.wildZoneCollectionHtml({key:'foret'}),/indisponible/);
});

test('an older request cannot replace a newer collection snapshot', async () => {
  const resolvers = [];
  const ctx = context(() => new Promise(resolve => resolvers.push(resolve)));
  const first = ctx.wildZoneLoadPools(), second = ctx.wildZoneLoadPools();
  resolvers[1]({ok:true,json:async()=>({ok:true,captures:[{id:2,shiny:1}],zones})});
  await second;
  resolvers[0]({ok:true,json:async()=>({ok:true,captures:[{id:1,normal:1}],zones})});
  await first;
  assert.equal(ctx.wildOwned(1),false);
  assert.equal(ctx.wildOwned(2),true);
});

test('zone preview filters ownership, paginates and distinguishes complete/empty collection', async () => {
  const ctx = context(() => response({ok:true,captures:[{id:1,normal:1}],zones:{...zones,foret:[1,2,3,10,11,12,13,14]}}));
  await ctx.wildZoneLoadPools();
  let html = ctx.wildZoneCollectionHtml({key:'foret',name:'Forêt'});
  assert.match(html,/Herbizarre/); assert.doesNotMatch(html,/Bulbizarre/); assert.match(html,/1 \/ 2/);
  vm.runInContext('wildZonePage = 1',ctx);
  html = ctx.wildZoneCollectionHtml({key:'foret',name:'Forêt'});
  assert.match(html,/Coconfort/);
  vm.runInContext('wildZoneFilter = "owned"',ctx);
  html = ctx.wildZoneCollectionHtml({key:'foret',name:'Forêt'});
  assert.match(html,/Bulbizarre/); assert.doesNotMatch(html,/Herbizarre/);
  assert.match(ctx.wildZoneCollectionHtml({key:'mer',name:'Mer'}),/premières captures/);
  ctx.wildCaptures[25] = {normal:1};
  vm.runInContext('wildZoneFilter = "missing"',ctx);
  assert.match(ctx.wildZoneCollectionHtml({key:'prairie',name:'Prairie'}),/Toutes les espèces/);
});

test('chains use verified relationships, prefer near completion and exclude unavailable missing species', async () => {
  const ctx = context(() => response({ok:true,captures:[{id:1,normal:1},{id:2,normal:1},{id:4,normal:1},{id:7,normal:1},{id:8,normal:1}],zones:{...zones,mer:[7,8]}}));
  await ctx.wildZoneLoadPools();
  const chains = ctx.wildCollectionChains();
  assert.deepEqual(Array.from(chains, x => x.chain[0].id),[1,4]);
  assert.equal(chains[0].owned,2);
  assert.equal(ctx.wildCollectionChains(1018).length,0);
});

test('result shows the server zone and offers only actual exchangeable duplicates', async () => {
  const ctx = context(() => response({ok:true,captures:[{id:1,normal:1,shiny:1}],zones}));
  await ctx.wildZoneLoadPools();
  ctx.BALL_KINDS = {poke:{name:'Poké Ball'}};
  ctx.wildArtwork = p => '/art/' + p.id;
  ctx.wildCatchLine = () => 'Capturé';
  vm.runInContext(read('src/script.10xzn.catch-card.js'),ctx);
  let html = ctx.catchCardHtml({pokemonId:1}, {encounter:{zone:'foret'}});
  assert.match(html,/Forêt/);
  assert.doesNotMatch(html,/cc-duplicate/,'one normal plus one shiny is not an exchangeable duplicate');
  ctx.wildCaptures[1].normal = 2;
  html = ctx.catchCardHtml({pokemonId:1}, {encounter:{zone:'foret'}});
  assert.match(html,/cc-duplicate/); assert.match(html,/Possédé ×3/);
  assert.doesNotMatch(ctx.catchCardHtml({pokemonId:1}, {encounter:{zone:null}}),/class="cc-zone"/);
});
