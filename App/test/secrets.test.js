'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const adventure = fs.readFileSync(path.join(__dirname, '../src/script.10.adventure.js'), 'utf8');
const secrets = fs.readFileSync(path.join(__dirname, '../src/script.11.secrets.js'), 'utf8');
const accountSource = fs.readFileSync(path.join(__dirname, '../src/script.07.delegation-party.js'), 'utf8');
const account = accountSource.slice(accountSource.indexOf('let connectedAccountUser'), accountSource.indexOf('(function () {\n  function renderAccount'));
const pokemon = [ { id: 1, name: 'Bulbizarre', type1: 'Plante' }, { id: 4, name: 'Salamèche', type1: 'Feu' }, { id: 7, name: 'Carapuce', type1: 'Eau' }, { id: 25, name: 'Pikachu', type1: 'Électrik' }, { id: 26, name: 'Raichu', type1: 'Électrik' }, { id: 81, name: 'Magnéti', type1: 'Électrik' }, { id: 133, name: 'Évoli' }, { id: 479, name: 'Motisma', type1: 'Électrik' }, { id: 442, name: 'Spiritomb', type1: 'Spectre' },
 {id:151,name:'Mew',gen:1}, {id:142,name:'Ptéra',gen:1}, {id:138,name:'Amonita',gen:1}, {id:140,name:'Kabuto',gen:1},
 {id:147,name:'Minidraco',type1:'Dragon',gen:1}, {id:148,name:'Draco',type1:'Dragon',gen:1}, {id:149,name:'Dracolosse',type1:'Dragon',gen:1},
 {id:353,name:'Polichombr',type1:'Spectre',gen:3}, {id:92,name:'Fantominus',type1:'Spectre',gen:1},
 {id:132,name:'Métamorph',gen:1}, {id:251,name:'Celebi',gen:2}, {id:235,name:'Queulorior',gen:2}, {id:385,name:'Jirachi',gen:3}, {id:570,name:'Zorua',gen:5},
 {id:20001,name:'Forme A',gen:6,isAltForm:true}, {id:20002,name:'Forme B',gen:7,isAltForm:true}, {id:20003,name:'Forme C',gen:8,isAltForm:true}
 ];
function fixture(extra = {}) {
 const listeners = [];
 const ctx = { window: { addEventListener(e, fn) { listeners.push(fn); } }, document: { getElementById() { return null; }, querySelectorAll() { return []; } }, POKEMON_BY_ID: new Map(pokemon.map(p => [p.id,p])), playerProfile: { discoveries: {}, favoritePokemonId: 4 }, matchHistory: [], findPokemonGlobalByName: name => pokemon.find(p=>p.name===name), modeLabelFr: m => ({ daily: 'Pokémon du jour', normal: 'Solo' }[m] || m), escapeHtml: s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), saveProfile() {}, showToast() {}, ...extra };
 vm.createContext(ctx); vm.runInContext(adventure + secrets + account, ctx); return {ctx,listeners};
}
test('missions start empty and reject corrupt, duplicate or irrelevant progress', () => {
 const {ctx} = fixture();
 const state = ctx.normalizeSecretProgress({ wins: [1,1,99999,4,7,25], electric: [1,25,25,26], runes: ['home','home','dex','invalid'], claimed: {runes:-1,signal:'yesterday',unknown:100} });
 assert.deepEqual(Array.from(state.wins),[1,4,7]); assert.deepEqual(Array.from(state.electric),[25,26]); assert.deepEqual(Array.from(state.runes),['home','dex']); assert.equal(Object.keys(state.claimed).length,0);
 assert.equal(ctx.normalizeSecretProgress().wins.length,0);
});
test('partner mission requires a partner and three different actual wins, never imported history', () => {
 const {ctx,listeners} = fixture({matchHistory:[{mode:'normal',result:'win',targetName:'Bulbizarre',at:100}]});
 listeners.forEach(fn=>fn()); assert.equal(ctx.secretProgress().wins.length,0);
 assert.equal(ctx.playerProfile.discoveries[1].source,'history');
 const state = ctx.secretProgress();
 assert.equal(ctx.advanceSecretProgress(state,'wins',1,null),false);
 assert.equal(ctx.advanceSecretProgress(state,'wins',1,4),true);
 assert.equal(ctx.advanceSecretProgress(state,'wins',1,4),false);
 ctx.advanceSecretProgress(state,'wins',4,4); ctx.advanceSecretProgress(state,'wins',7,4);
 assert.equal(ctx.claimSecretReward(state,ctx.playerProfile.discoveries,'companion',4,1000),true);
 assert.equal(ctx.playerProfile.discoveries[133].source,'secret');
 assert.equal(ctx.claimSecretReward(state,ctx.playerProfile.discoveries,'companion',4,2000),false);
});
test('a new win with an already collected pokemon still advances its mission', () => {
 const {ctx} = fixture();
 ctx.playerProfile.discoveries[1] = { at: 100, mode: 'daily', source: 'history' };
 assert.equal(ctx.recordPokemonDiscovery(pokemon[0],'normal'),false);
 assert.deepEqual(Array.from(ctx.secretProgress().wins),[1]);
 assert.equal(ctx.playerProfile.discoveries[1].at,100);
 assert.equal(ctx.playerProfile.discoveries[1].confirmed.mode,'normal');
});
test('electric mission counts distinct electric sheets only, reward cannot be claimed early', () => {
 const {ctx} = fixture(), state = ctx.normalizeSecretProgress(), album = {};
 assert.equal(ctx.advanceSecretProgress(state,'electric',1,4),false);
 assert.equal(ctx.advanceSecretProgress(state,'electric',25,4),true);
 assert.equal(ctx.advanceSecretProgress(state,'electric',25,4),false);
 assert.equal(ctx.claimSecretReward(state,album,'signal',4),false);
 ctx.advanceSecretProgress(state,'electric',26,4);ctx.advanceSecretProgress(state,'electric',81,4);
 assert.equal(ctx.claimSecretReward(state,album,'signal',4,1000),true);assert.equal(album[479].secrets.signal,1000);
});
test('three runes unlock once and an existing card retains its original source and date', () => {
 const {ctx} = fixture(), state = ctx.normalizeSecretProgress(), album = {442:{at:10,mode:'daily',source:'game'}};
 assert.equal(ctx.claimSecretReward(state,album,'runes',null),false);
 for (const place of ['home','dex','profile']) ctx.advanceSecretProgress(state,'runes',place,null);
 assert.equal(ctx.claimSecretReward(state,album,'runes',null,200),true);
 assert.equal(album[442].at,10);assert.equal(album[442].source,'game');assert.equal(album[442].secrets.runes,200);
 const restored=ctx.normalizeSecretProgress(JSON.parse(JSON.stringify(state)));
 assert.equal(ctx.claimSecretReward(restored,album,'runes',null,300),false);
});
test('provenance survives reload; legacy origin is not invented; secret rewards never become wins', () => {
 const {ctx} = fixture();
 const clean=ctx.normalizeDiscoveries({1:{at:100,mode:'normal'},25:{at:100,mode:'daily',source:'history'},442:{at:100,mode:'secret',source:'secret',secrets:{runes:100,unknown:2}}});
 assert.equal(clean[1].source,'legacy');assert.equal(clean[25].source,'history');assert.deepEqual(Object.keys(clean[442].secrets),['runes']);
 assert.match(ctx.discoveryProofHtml(clean[1]),/origine exacte n’avait pas été conservée/);
 assert.match(ctx.discoveryProofHtml(clean[25]),/récupérée automatiquement/);
 assert.match(ctx.discoveryProofHtml(clean[442]),/Les trois marques/);
 ctx.recordSecretWin(pokemon[0],'secret');assert.equal(ctx.secretProgress().wins.length,0);
});
test('Discord avatar is an accessible actionable button and escapes account data', () => {
 const {ctx} = fixture();
 const html=ctx.accountChipHtml({username:'<script>x</script>',avatar:'https://example.test/a"b'});
 assert.match(html,/<button type="button"/);assert.match(html,/data-action="openAccountMenu"/);assert.match(html,/aria-haspopup="dialog"/);
 assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/a&quot;b/);
 assert.match(ctx.accountChipHtml({username:'Lou'}),/account-avatar-fallback/);
});
test('account menu navigation closes the dialog and opens the requested existing screen', () => {
 const calls=[], {ctx} = fixture({closeOverlayModal(){calls.push('close');},openProfileScreen(){calls.push('profile');},openDiscoveryAlbum(){calls.push('album');},openSettingsModal(){calls.push('settings');}});
 ctx.openDiscoveryAlbum=()=>calls.push('album');ctx.switchProfileView=v=>calls.push(v);
 ctx.accountNavigate('profile');assert.deepEqual(calls,['close','profile','trainer']);calls.length=0;
 ctx.accountNavigate('album');assert.deepEqual(calls,['close','album']);calls.length=0;
 ctx.accountNavigate('settings');assert.deepEqual(calls,['close','settings']);
});

test('nine added secrets require their specific actions, not old album entries', () => {
 const {ctx} = fixture(); const state=ctx.secretProgress();
 for (const key of ['starters','fossils','dragons','ghosts','forms','regions','variety','melody','aurora']) assert.equal(ctx.claimSecretReward(state,{},key,4),false);
 for(const id of [1,4,7,138,140,142,147,148,149,442,353,92,20001,20002,20003,251]) ctx.trackSecretDexVisit(ctx.POKEMON_BY_ID.get(id));
 const album={};
 for (const key of ['starters','fossils','dragons','ghosts','forms','regions']) assert.equal(ctx.claimSecretReward(state,album,key,4,100),true,key);
 assert.equal(ctx.claimSecretReward(state,album,'variety',4,100),false);
 assert.equal(ctx.claimSecretReward(state,album,'aurora',4,100),false);
});
test('the elemental trail resets on another sheet, survives reload and remains complete', () => {
 const {ctx}=fixture(); const visit=id=>ctx.trackSecretDexVisit(ctx.POKEMON_BY_ID.get(id));
 visit(4);visit(1);assert.equal(ctx.secretProgress().trail.length,0);
 visit(4);visit(7);
 ctx.playerProfile.secrets=ctx.normalizeSecretProgress(JSON.parse(JSON.stringify(ctx.secretProgress())));
 visit(1);visit(25);assert.deepEqual(Array.from(ctx.secretProgress().trail),[4,7,1]);
 assert.equal(ctx.claimSecretReward(ctx.secretProgress(),{},'aurora',4,100),true);
});
test('wish box rejects wrong symbols, persists a valid prefix and awards once', () => {
 const {ctx}=fixture();let state=ctx.normalizeSecretProgress();
 assert.equal(ctx.advanceSecretMelody(state,'invalid'),false);
 ctx.advanceSecretMelody(state,'leaf');ctx.advanceSecretMelody(state,'moon');assert.equal(state.melody.length,0);
 ctx.advanceSecretMelody(state,'leaf');ctx.advanceSecretMelody(state,'sun');
 state=ctx.normalizeSecretProgress(JSON.parse(JSON.stringify(state)));
 ctx.advanceSecretMelody(state,'moon');ctx.advanceSecretMelody(state,'leaf');
 assert.equal(ctx.advanceSecretMelody(state,'sun'),false);
 assert.equal(ctx.claimSecretReward(state,{},'melody',null,100),true);
 assert.equal(ctx.claimSecretReward(state,{},'melody',null,200),false);
 assert.equal(ctx.normalizeSecretProgress({melody:['sun'],trail:[7,1]}).melody.length,0);
});
test('mode variety needs actual eligible discoveries in different games', () => {
 const {ctx}=fixture(); const p=ctx.POKEMON_BY_ID.get(1);
 for(const mode of ['secret','quiz','normal','normal','silhouette']) ctx.recordSecretWin(p,mode);
 assert.equal(ctx.claimSecretReward(ctx.secretProgress(),{},'variety',4),false);
 ctx.recordSecretWin(p,'duel');assert.equal(ctx.claimSecretReward(ctx.secretProgress(),{},'variety',4,100),true);
 assert.deepEqual(Array.from(ctx.secretProgress().modes),['normal','silhouette','duel']);
});
test('expanded provenance and old claims survive normalization without awarding visits retroactively', () => {
 const {ctx}=fixture();
 const state=ctx.normalizeSecretProgress({wins:[1,4,7],electric:[25,26,81],claimed:{signal:100,forms:200},visits:[20001,20001,999999]});
 assert.deepEqual(Array.from(state.visits),[20001]);assert.equal(state.claimed.signal,100);assert.equal(state.claimed.forms,200);
 const restored=ctx.normalizeDiscoveries({132:{at:100,source:'secret',mode:'secret',secrets:{forms:200}}});
 assert.equal(restored[132].secrets.forms,200);assert.match(ctx.discoveryProofHtml(restored[132]),/Un visage peut en cacher un autre/);
});
test('reward is saved before the confirmation scene; replay and double clicks cannot reaward', () => {
 const calls=[],{ctx}=fixture({saveProfile(){calls.push('saved');},ensureOverlay(title,html){calls.push('scene');assert.match(html,/Enregistré dans ton album/);},getPokemonSprite:p=>'sprite/'+p.id});
 const state=ctx.secretProgress();state.runes=['home','dex','profile'];
 ctx.claimSecretPokemon('runes');assert.deepEqual(calls,['saved','scene']);
 ctx.claimSecretPokemon('runes');assert.deepEqual(calls,['saved','scene']);
 ctx.replaySecretEncounter('runes');assert.deepEqual(calls,['saved','scene','scene']);
 assert.equal(Object.keys(ctx.playerProfile.discoveries).length,1);
});
