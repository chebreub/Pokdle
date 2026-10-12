'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/script.01.core.js'),'utf8');
const client=fs.readFileSync(path.join(root,'src/script.07.delegation-party.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const extra=vm.runInNewContext(core.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/)[1]);
const api=vm.runInNewContext('('+core.match(/const FORM_API_NAME_BY_NAME =\s*({[\s\S]*?});/)[1]+')');
function extract(source,name){const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2);}
const normalization={};vm.createContext(normalization);
vm.runInContext(extract(client,'norm')+'\n'+extract(server,'normalizeName'),normalization);

test('Mega names use the French prefix without changing IDs or API mappings',()=>{
 const megas=extra.filter(p=>p.id>=20001&&p.id<21000);
 assert.equal(megas.length,93);
 for(const p of megas){assert.match(p.name,/^Méga-/);assert.match(api[p.name],/-mega(?:-[xyz])?$/);}
 assert.equal(extra.find(p=>p.id===20075).name,'Méga-Raichu X');
 assert.equal(extra.find(p=>p.id===20002).name,'Méga-Dracaufeu X');
 assert.equal(extra.find(p=>p.id===20003).name,'Méga-Dracaufeu Y');
});
test('canonical, unaccented and legacy Mega names resolve identically on client and server',()=>{
 for(const fn of [normalization.norm,normalization.normalizeName]){
  for(const p of extra.filter(p=>p.name.startsWith('Méga-'))){
   const legacy=p.name.replace(/^Méga-(.+?)( [XYZ])?$/,'$1 Mega$2');
   assert.equal(fn(legacy),fn(p.name));assert.equal(fn(p.name.replace('Méga-','mega ')),fn(p.name));
  }
  assert.equal(fn('Yanméga'),'yanmega');assert.equal(fn('Méganium'),'meganium');
 }
});
test('old form caches and bundled data keep their sprites and measurements after renaming',async()=>{
 const entry={sprite:'https://example.test/mega.png',height:2.4,weight:155.5};
 const env={EXTRA_FORM_CACHE_KEY:'cache',localStorage:{getItem:()=>JSON.stringify({'Florizarre Mega':entry})},
  fetch:async()=>({ok:true,json:async()=>({'Florizarre Mega':entry})})};
 vm.createContext(env);
 vm.runInContext(['rewriteLegacyPokeApiUrl','loadCachedExtraFormData'].map(n=>extract(core,n)).join('\n')+'\nasync '+extract(core,'loadBundledExtraFormData'),env);
 for(const data of [env.loadCachedExtraFormData(),await env.loadBundledExtraFormData()]){
  assert.equal(data['Méga-Florizarre'].sprite,entry.sprite);assert.equal(data['Méga-Florizarre'].height,2.4);assert.equal(data['Méga-Florizarre'].weight,155.5);
 }
});

test('forms added from PokeAPI can be told apart and keep their real data',()=>{
 // Two forms of one species with the same types and size could not be told apart in the game.
 const seen=new Map();
 // Forms added on 2026-10-12; older look-alikes (Deoxys, Ash-Greninja) predate this rule.
 const added=p=>(p.id>=20072&&p.id<21000)||p.id===22020||p.id===23017||p.id>=25044;
 for(const p of extra.filter(added)){
  const key=[p.baseId,p.type1,p.type2,p.height,p.weight].join('|');
  assert.ok(!seen.has(key),p.name+' duplicates '+seen.get(key));seen.set(key,p.name);
  assert.ok(Number.isInteger(p.spriteId)&&p.spriteId>10000,p.name+' needs its own sprite');assert.ok(api[p.name],p.name+' needs its API name');
 }
 for(const name of ['Méga-Raichu X','Méga-Raichu Y','Méga-Absol Z','Ogerpon Masque du Puits','Ogerpon Masque du Fourneau','Ogerpon Masque de la Pierre','Plumeline Style Hula','Shifours Style Mille Poings']) assert.ok(extra.some(p=>p.name===name),name);
 const puits=extra.find(p=>p.name==='Ogerpon Masque du Puits');assert.deepEqual([puits.type1,puits.type2],['Plante','Eau']);
 assert.equal(new Set(extra.map(p=>p.id)).size,extra.length,'form ids are unique');assert.equal(new Set(extra.map(p=>p.name)).size,extra.length,'form names are unique');
});

test('the server catalogue gives each form its own measurements and sprite',()=>{
 const context=vm.createContext({fs,path,vm,__dirname:root});
 vm.runInContext(['loadPokemonList','loadStatClashExtraFormsConfig','injectStatClashExtraForms','buildSpriteUrl'].map(n=>extract(server,n)).join('\n'),context);
 const list=context.loadPokemonList(),by=name=>list.find(p=>p.name===name);
 const mega=by('Méga-Florizarre'),base=by('Florizarre');
 assert.equal(mega.height,2.4);assert.equal(mega.weight,155.5);assert.notEqual(mega.height,base.height);assert.match(mega.sprite,/\/10033\.png$/);
 assert.equal(by('Smogogo de Galar').height,3);assert.equal(by('Ogerpon Masque du Puits').type2,'Eau');assert.match(by('Méga-Raichu X').sprite,/\/10304\.png$/);
});

test('every form carries its own sprite and the number shown is its species number',()=>{
 for(const p of extra){assert.ok(p.spriteId!==undefined&&String(p.spriteId)!==String(p.baseId),p.name+' would show its species sprite');}
 const context=vm.createContext({});vm.runInContext(extract(client,'getPokemonDexNumber'),context);
 assert.equal(context.getPokemonDexNumber({id:20075,baseId:26,isAltForm:true,spriteId:10304}),26);
 assert.equal(context.getPokemonDexNumber({id:26,spriteId:26}),26);
});

test('look-alike forms stay in the Pokédex but never enter a guessing game',()=>{
 const hidden=extra.filter(p=>p.guessable===false).map(p=>p.name).sort();
 assert.equal(JSON.stringify(hidden),JSON.stringify(['Amphinobi Ash','Deoxys Attaque','Deoxys Défense','Deoxys Vitesse','Genesect Module Aqua','Genesect Module Chaleur','Genesect Module Choc','Genesect Module Froid']));
 const context=vm.createContext({fs,path,vm,__dirname:root});
 vm.runInContext(['loadPokemonList','loadStatClashExtraFormsConfig','injectStatClashExtraForms','buildSpriteUrl','isDuelPokemonAllowed'].map(n=>extract(server,n)).join('\n'),context);
 const list=context.loadPokemonList(),room={selectedGens:[3,5,6],players:[]};
 assert.equal(context.isDuelPokemonAllowed(room,list.find(p=>p.name==='Deoxys Attaque')),false);
 assert.equal(context.isDuelPokemonAllowed(room,list.find(p=>p.name==='Méga-Amphinobi')),true);
 const {startDeductionRound}=require('../lib/party-deduction');let i=0;
 for(let n=0;n<600;n++){startDeductionRound(room,list,()=>(i++%600)/600);assert.notEqual(room.target.guessable,false,room.target.name);}
 const ui=vm.createContext({getPokemonCatalog:()=>list});vm.runInContext(extract(core,'getPokemonUiList'),ui);
 const pool=ui.getPokemonUiList({gens:[3,5,6]});
 assert.ok(pool.some(p=>p.name==='Deoxys')&&!pool.some(p=>p.guessable===false),'solo pools skip look-alikes');
});
