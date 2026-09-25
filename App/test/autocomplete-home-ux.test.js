'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const mini=fs.readFileSync(path.join(__dirname,'../src/script.03.minijeux.js'),'utf8');
const mobile=fs.readFileSync(path.join(__dirname,'../mobile.css'),'utf8');
const home=fs.readFileSync(path.join(__dirname,'../src/script.10f.home-adventure.js'),'utf8');

test('primary Pokémon inputs disable phone correction and spellcheck',()=>{
  for(const id of ['guess-input','multiplayer-guess-input','party-guess']){
    const re=new RegExp('<input[^>]*id="'+id+'"[^>]*>');
    const match=index.match(re);
    assert.ok(match, id+' input exists');
    assert.match(match[0],/autocomplete="off"/);
    assert.match(match[0],/autocorrect="off"/);
    assert.match(match[0],/autocapitalize="none"/);
    assert.match(match[0],/spellcheck="false"/);
  }
});

test('guess keyboard ignores IME composition and refreshes suggestions after composition',()=>{
  assert.match(mini,/guessInputComposing/);
  assert.match(mini,/e\.isComposing/);
  assert.match(mini,/e\.keyCode === 229/);
  assert.match(mini,/compositionstart/);
  assert.match(mini,/compositionend/);
  assert.match(mini,/setTimeout\(filterGuessAC, 0\)/);
});

test('touch selection uses pointer events instead of mouse-only selection',()=>{
  assert.match(mini,/item\.addEventListener\("pointerdown"/);
});

test('mobile autocomplete participates in layout instead of covering the game board',()=>{
  assert.match(mobile,/\.ac-wrapper > \.ac-list \{[\s\S]*position: static !important/);
  assert.match(mobile,/max-height: min\(34dvh, 238px\)/);
  assert.match(mobile,/min-height: 56px !important/);
  assert.match(mobile,/font-size: 16px !important/);
});

test('Pokémon du jour stays ahead of the adventure dashboard',()=>{
  assert.match(home,/const anchor = pathways \|\| weekly \|\| daily/);
  assert.match(home,/anchor\.insertAdjacentElement\('afterend', home\)/);
});
