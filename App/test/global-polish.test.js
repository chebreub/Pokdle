'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

const delegation=fs.readFileSync(path.join(__dirname,'../src/script.07.delegation-party.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
const mobile=fs.readFileSync(path.join(__dirname,'../mobile.css'),'utf8');

test('overlay system assigns semantic visual variants',()=>{
  assert.match(delegation,/overlay\.dataset\.kind = overlayKind/);
  assert.match(delegation,/\/param\/i\.test\(title\) \? 'settings'/);
  assert.match(delegation,/\/comment jouer\|aide\/i\.test\(title\) \? 'help'/);
  assert.match(delegation,/\/compte\/i\.test\(title\) \? 'account'/);
  assert.match(delegation,/\/classement\/i\.test\(title\) \? 'ranking'/);
});

test('account menu exposes trainer identity and progression',()=>{
  assert.match(delegation,/account-menu-v2/);
  assert.match(delegation,/getXpTier/);
  assert.match(delegation,/pokedexCollectionNationalStats/);
  assert.match(delegation,/Profil de dresseur/);
  assert.match(delegation,/Ma collection/);
});

test('legacy modes receive dedicated modern styling',()=>{
  for(const selector of [
    '#description-text.description-text',
    '#evolution-chain .evolution-slot',
    '#order-box .order-clue',
    '#quiz-box #quiz-options',
    '#screen-odd-one-out .odd-grid'
  ]) assert.ok(style.includes(selector), selector);
});

test('quiz no longer inherits the old dark visual language',()=>{
  assert.match(style,/#quiz-box \{[\s\S]*color:#17375f !important/);
  assert.match(style,/#quiz-box #quiz-good[\s\S]*#ebf8f1/);
  assert.match(style,/#quiz-box #quiz-bad[\s\S]*#fff0ef/);
});

test('mobile polish keeps overlays touch-friendly and modes compact',()=>{
  assert.match(mobile,/#overlay-modal \{[\s\S]*align-items: flex-end/);
  assert.match(mobile,/max-height: 90dvh !important/);
  assert.match(mobile,/#quiz-box #quiz-options button[\s\S]*min-height: 50px/);
  assert.match(mobile,/#evolution-chain\.evolution-chain[\s\S]*scroll-snap-type/);
  assert.match(mobile,/#screen-odd-one-out \.odd-grid/);
});

test('dark mode is covered for refreshed surfaces',()=>{
  assert.match(style,/body\.theme-dark #screen-game \.challenge-panel/);
  assert.match(style,/body\.theme-dark #overlay-modal \.overlay-card/);
  assert.match(style,/body\.theme-dark \.account-menu-links button/);
});
