'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html');
const cards = [...html.matchAll(/<button[^>]*class="card all-modes-card"[\s\S]*?<\/button>/g)].map(([markup]) => ({dataset:{
 category:markup.match(/data-category="([^"]+)"/)?.[1],
 action:markup.match(/data-action="([^"]+)"/)?.[1],
 args:markup.match(/data-args='([^']+)'/)?.[1] || '[]',
 search:markup.match(/data-search="([^"]+)"/)?.[1]
}, textContent:markup.replace(/<[^>]+>/g,' '), markup}));
function fixture() {
 const elements = Object.fromEntries(['mode-search','mode-empty','mode-results','mode-hub-title','mode-hub-description','home-gens-card','mode-difficulty','mode-difficulty-field'].map(id => [id,{value:id==='mode-difficulty'?'all':'',hidden:false,focus(){}}]));
 const rows = cards.map(card => ({...card,dataset:{...card.dataset}}));
 const context = { document:{getElementById:id=>elements[id],querySelectorAll:selector=>selector.includes('.all-modes-cat')?[{querySelectorAll:()=>rows}]:[],addEventListener(){}},history:{state:{screen:'allModes'},replaceState(state){this.state=state;}},location:{href:'https://example.test/#allModes'},setGlobalNavActive:key=>{context.activeNav=key;}};
 vm.createContext(context);vm.runInContext(read('src/script.08.catalog.js'),context);
 rows.forEach(card=>{card.dataset.difficulty=context.modeCatalogDifficultyForCard(card);});
 return {context,elements,rows};
}
test('every former menu destination remains reachable and categorized',()=>{
 assert.equal(cards.length,29); assert.ok(cards.every(card=>['solo','friends','explore'].includes(card.dataset.category)));
 for(const action of ['openEggGame','startPartyMode','openTypeComboSolo','openTeamsScreen','openEmulatorMode','openLeaderboard','openPartyRoomMode']) assert.ok(cards.some(card=>card.markup.includes(action)),action);
 // Entre amis is one door: the two-player games live in the Party Room lobby.
 const lobby=html.slice(html.indexOf('id="party-lobby"'),html.indexOf('id="party-joined"'));
 for(const action of ['openMultiplayerMode','openStatClashMode','openStatAuctionMode','openDefiAmiFromAllModes']) assert.ok(lobby.includes('data-action="'+action+'"'),action);
 // Draft Arènes and Draft PRO were removed: nothing on the page leads to them.
 for(const gone of ['openDraftScoreAttackProDuel','"openDraftArenaMode"','"openDraftScoreAttackMode", true']) assert.ok(!html.includes(gone),gone);
});
test('friends filter is a single door to the Party Room',()=>{
 const {context,rows}=fixture();context.setModeCatalogCategory('friends');const visible=rows.filter(card=>!card.hidden);
 assert.equal(visible.length,1);assert.ok(visible.every(card=>card.dataset.category==='friends'));assert.ok(visible[0].markup.includes('openPartyRoomMode'));assert.equal(context.activeNav,'social');
});
test('search ignores accents, matches unordered words and recovers from no results',()=>{
 const {context,rows,elements}=fixture();context.setModeCatalogCategory('all');elements['mode-search'].value='attack draft';context.renderModeCatalog();assert.equal(rows.filter(card=>!card.hidden).length,1);
 elements['mode-search'].value='emulateur';context.renderModeCatalog();assert.equal(rows.filter(card=>!card.hidden).length,1);
 elements['mode-search'].value='zzzznoresult';context.renderModeCatalog();assert.equal(elements['mode-empty'].hidden,false);
 context.resetModeCatalog();assert.equal(rows.filter(card=>!card.hidden).length,29);
 assert.ok(!rows.some(card=>card.markup.includes('openDraftArenaMode')),'Draft Arènes was removed');
});
test('search matches the start of words so short queries stay precise',()=>{
 const {context,rows,elements}=fixture();context.setModeCatalogCategory('solo');
 elements['mode-search'].value='cri';context.renderModeCatalog();
 const visible=rows.filter(card=>!card.hidden);assert.equal(visible.length,1);assert.ok(visible[0].markup.includes('startCryGame'));
});
test('family chips narrow the solo catalogue and reset with the category',()=>{
 const sections=['guess','play'].map(family=>({dataset:{family},rows:[]}));
 const {context,rows}=fixture();
 rows.forEach(card=>{(card.markup.includes('startCryGame')?sections[0]:sections[1]).rows.push(card);});
 context.document.querySelectorAll=selector=>selector.includes('.all-modes-cat')?sections.map(section=>({dataset:section.dataset,querySelectorAll:()=>section.rows})):[];
 context.setModeCatalogCategory('solo');context.setModeCatalogFamily('guess');
 assert.deepEqual(rows.filter(card=>!card.hidden).map(card=>card.dataset.args),['["startCryGame"]']);
 assert.equal(context.history.state.family,'guess');
 context.setModeCatalogCategory('solo');assert.equal(context.modeCatalogFamily,'all');
});
test('changing category clears stale searches and saves it for Back',()=>{
 const {context,elements}=fixture();elements['mode-search'].value='quiz';context.setModeCatalogDifficulty('hard');context.setModeCatalogCategory('friends');assert.equal(elements['mode-search'].value,'');assert.equal(context.history.state.category,'friends');assert.equal(context.history.state.difficulty,'hard');
});
test('difficulty filter narrows playable modes and never hides Explore tools',()=>{
 const {context,rows,elements}=fixture();
 context.setModeCatalogCategory('all');context.setModeCatalogDifficulty('expert');
 const expert=rows.filter(card=>!card.hidden);assert.equal(expert.length,0,'no expert game left since Draft PRO was removed');
 context.setModeCatalogCategory('explore');assert.equal(elements['mode-difficulty-field'].hidden,true);assert.ok(rows.filter(card=>!card.hidden).every(card=>card.dataset.category==='explore'));
 context.setModeCatalogCategory('solo');context.setModeCatalogDifficulty('easy');assert.equal(elements['mode-difficulty-field'].hidden,false);assert.ok(rows.filter(card=>!card.hidden).every(card=>card.dataset.difficulty==='easy'));
});
test('search and reset stay inside the destination the player opened',()=>{
 const {context,elements,rows}=fixture();
 context.setModeCatalogCategory('solo');
 elements['mode-search'].value='cri';context.renderModeCatalog();
 assert.equal(context.modeCatalogCategory,'solo');
 assert.ok(rows.filter(card=>!card.hidden).every(card=>card.dataset.category==='solo'));
 context.setModeCatalogDifficulty('hard');context.resetModeCatalog();
 assert.equal(context.modeCatalogDifficulty,'all');assert.equal(context.modeCatalogCategory,'solo');assert.equal(elements['mode-search'].value,'');
 assert.equal(elements['mode-hub-title'].textContent,'Jouer');
});
test('launch forwards PRO arguments and missing launchers do not hide the catalog',()=>{
 const source=read('src/script.07.delegation-party.js');const launcher=source.slice(source.indexOf('function openFromAllModes('),source.indexOf('window.openFromAllModes'));let hidden=false,pro;
 const context={hideScreen:()=>{hidden=true;},window:{openDraftScoreAttackMode:value=>{pro=value;}}};vm.createContext(context);vm.runInContext(launcher,context);
 context.openFromAllModes('missing');assert.equal(hidden,false);context.openFromAllModes('openDraftScoreAttackMode',true);assert.equal(pro,true);assert.equal(hidden,true);
});
test('the Outils chip opens the tools and any family chip brings back the games',()=>{
 const {context,rows}=fixture();context.setModeCatalogCategory('explore');
 assert.ok(rows.filter(card=>!card.hidden).every(card=>card.dataset.category==='explore'));
 context.setModeCatalogFamily('all');assert.equal(context.modeCatalogCategory,'solo');
 assert.ok(rows.filter(card=>!card.hidden).every(card=>card.dataset.category==='solo'));
});
