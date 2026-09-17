'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const adventure = fs.readFileSync(path.join(__dirname, '../src/script.10.adventure.js'), 'utf8');
const secrets = fs.readFileSync(path.join(__dirname, '../src/script.11.secrets.js'), 'utf8');
const accountSource = fs.readFileSync(path.join(__dirname, '../src/script.07.delegation-party.js'), 'utf8');
const account = accountSource.slice(accountSource.indexOf('let connectedAccountUser'), accountSource.indexOf('(function () {\n  function renderAccount'));
const pokemon = [ { id: 1, name: 'Bulbizarre', type1: 'Plante' }, { id: 4, name: 'Salamèche', type1: 'Feu' }, { id: 7, name: 'Carapuce', type1: 'Eau' }, { id: 25, name: 'Pikachu', type1: 'Électrik' }, { id: 26, name: 'Raichu', type1: 'Électrik' }, { id: 81, name: 'Magnéti', type1: 'Électrik' }, { id: 133, name: 'Évoli' }, { id: 479, name: 'Motisma', type1: 'Électrik' }, { id: 442, name: 'Spiritomb' } ];
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
