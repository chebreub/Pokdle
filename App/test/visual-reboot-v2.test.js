'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

const home=fs.readFileSync(path.join(__dirname,'../home.css'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
const mobile=fs.readFileSync(path.join(__dirname,'../mobile.css'),'utf8');
const visual=fs.readFileSync(path.join(__dirname,'../visual-refresh.css'),'utf8');
const adventure=fs.readFileSync(path.join(__dirname,'../src/script.10f.home-adventure.js'),'utf8');
const weekly=fs.readFileSync(path.join(__dirname,'../src/script.10i.weekly-league.js'),'utf8');
const core=fs.readFileSync(path.join(__dirname,'../src/script.01.core.js'),'utf8');
const club=fs.readFileSync(path.join(__dirname,'../src/script.09.club.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('visual reboot establishes a strong final design authority layer',()=>{
  assert.match(home,/VISUAL REBOOT V2 — final authority layer/);
  assert.match(home,/--vr-navy:#0d2344/);
  assert.match(home,/#screen-config \.pk-hero\{[\s\S]*linear-gradient\(118deg/);
  assert.match(home,/body:not\(\.theme-dark\) header\{[\s\S]*#0d2344/);
});

test('home offers Daily and game pathways before optional League and adventure',()=>{
  assert.match(weekly,/const anchor=pathways\|\|daily/);
  assert.match(weekly,/anchor\.nextElementSibling!==card/);
  assert.match(adventure,/const anchor = weekly \|\| pathways \|\| daily/);
  assert.match(adventure,/anchor\.nextElementSibling !== home/);
});

test('mode library is redesigned as a dense three-column game library',()=>{
  assert.match(home,/#screen-all-modes \.all-modes-grid\{[\s\S]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(home,/#screen-all-modes \.all-modes-card\{[\s\S]*grid-template-columns:40px minmax\(0,1fr\)/);
  assert.match(home,/#screen-all-modes \.mode-hub-controls\{[\s\S]*grid-template-columns/);
});

test('gameplay receives the same visual language',()=>{
  assert.match(style,/VISUAL REBOOT V2 — gameplay authority layer/);
  assert.match(style,/#screen-game \.search-bar\{[\s\S]*background:#fff/);
  assert.match(style,/#screen-game \.win-box\{[\s\S]*linear-gradient/);
  assert.match(style,/\.live-rank-hud\{[\s\S]*border-radius:13px/);
});

test('mobile reboot keeps hero compact and catalog single-column on narrow screens',()=>{
  assert.match(mobile,/VISUAL REBOOT V2 — mobile authority layer/);
  assert.match(mobile,/#screen-config \.pk-hero\{[\s\S]*border-radius:18px/);
  assert.match(mobile,/#screen-all-modes \.all-modes-card\{[\s\S]*min-height:92px/);
  assert.match(home,/@media \(max-width:520px\)[\s\S]*#screen-all-modes \.all-modes-grid\{grid-template-columns:1fr/);
});

test('dark mode and reduced motion remain covered',()=>{
  assert.match(home,/body\.theme-dark #screen-config \.pk-hero/);
  assert.match(style,/body\.theme-dark #screen-game \.game-topbar/);
  assert.match(style,/prefers-reduced-motion:reduce/);
});

test('visual reboot never forces the home screen visible while navigation hides it',()=>{
  assert.match(home,/#screen-config:not\(\.hidden\)\{[\s\S]*display:grid !important/);
  assert.match(home,/#screen-config\.hidden\{[\s\S]*display:none !important/);
  assert.doesNotMatch(home,/\/\* Home spacing \*\/\s*#screen-config\{\s*display:grid !important/);
});

test('startup deep links always dismiss the splash screen',()=>{
  assert.match(core,/if \(checkChallengeURL\(\)\) \{ removeAppSplash\(\); return; \}/);
  assert.match(core,/if \(checkMultiplayerInviteURL\(\)\) \{ removeAppSplash\(\); return; \}/);
});


test('desktop gameplay keeps the full available width',()=>{
  assert.match(style,/#screen-game\{[\s\S]*width:100%;[\s\S]*max-width:1180px;[\s\S]*align-self:stretch;/);
});


test('desktop header actions stay compact beside XP and profile',()=>{
  assert.match(visual,/\.header-actions \.header-action-btn \{[\s\S]*width: 42px !important;[\s\S]*font-size: 0 !important;/);
});


test('consolidation pass removes duplicate primary destinations without deleting features',()=>{
  assert.match(visual,/CONSOLIDATION PASS V1/);
  assert.match(visual,/#global-nav #nav-extras[\s\S]*display:none !important/);
  assert.match(visual,/#screen-config #home-partner,[\s\S]*home-progress-legacy[\s\S]*display:none !important/);
  assert.match(visual,/mode-filters-redundant[\s\S]*display:none !important/);
});


test('professional pass keeps discovery compact and semantically grouped',()=>{
  assert.match(visual,/PROFESSIONAL PASS V1/);
  const controls=index.slice(index.indexOf('<div class="mode-hub-controls">'),index.indexOf('<p class="mode-results"'));
  assert.match(controls,/id="mode-search"/);
  assert.match(controls,/id="mode-difficulty"/);
  assert.match(controls,/id="home-gens-card"/);
  assert.match(club,/club-return-bar/);
  assert.match(visual,/mode-card-art-orbit,[\s\S]*display:none/);
});


test('desktop header stays in document flow on long gameplay pages',()=>{
  assert.match(visual,/@media \(min-width:641px\)[\s\S]*#pokdle-app\.design-refresh > header[\s\S]*position:relative !important;[\s\S]*top:auto !important;/);
});
