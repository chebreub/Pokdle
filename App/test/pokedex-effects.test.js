'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/script.10c.pokedex-effects.js'),'utf8');

function fixture(){
  const played=[];
  const body={classList:{add(){},remove(){}}};
  const context={
    window:{AudioContext:null,webkitAudioContext:null,matchMedia(){return {matches:false};}},
    document:{body,getElementById(){return null;}},
    getStoredAppSettings(){return {soundEffects:true,pokemonCries:true,reduceMotion:false};},
    playPokemonCry(p,v){played.push([p.id,v]);},
    getPokemonSpriteId:p=>p.id,
    getPokemonSprite:p=>'sprite/'+p.id,
    escapeHtml:s=>String(s),
    typeBadgesHtml:()=>'',setTimeout(fn){fn();return 1;},clearTimeout(){},
    Date,Math,Number,String,Boolean,Object,Array
  };
  vm.createContext(context);
  vm.runInContext(source+'\nthis.__tier=pokedexRegistrationTierMeta;this.__cry=playPokedexRegistrationCry;',context);
  return {context,played};
}

test('registration tiers have distinct prestige, legendary and secret identities',()=>{
  const {context}=fixture();
  assert.equal(context.__tier('prestige').sfx,'prestige');
  assert.equal(context.__tier('legendary').sfx,'legendary');
  assert.equal(context.__tier('secret').sfx,'secret');
  assert.notEqual(context.__tier('legendary').kicker,context.__tier('secret').kicker);
});

test('Pokémon cries respect the dedicated setting',()=>{
  const {context,played}=fixture();
  context.__cry({id:150},.5);
  assert.deepEqual(played,[[150,.5]]);
  context.getStoredAppSettings=()=>({soundEffects:true,pokemonCries:false,reduceMotion:false});
  context.__cry({id:151},.5);
  assert.deepEqual(played,[[150,.5]]);
});

test('registration SFX are synthesized and do not bundle copyrighted audio assets',()=>{
  assert.equal(/\.(mp3|wav|ogg)['"]/.test(source),false);
  assert.equal(source.includes('createOscillator'),true);
  assert.equal(source.includes('PokeAPI/cries'),false);
});

test('reduced motion is explicitly supported by the ceremony engine',()=>{
  assert.equal(source.includes('prefers-reduced-motion: reduce'),true);
  assert.equal(source.includes('settings.reduceMotion'),true);
});
