'use strict';
// 🔒 Pokémon pixelisé et Zoom progressif vérifiés par le serveur (4/11/2026).
const test = require('node:test'), assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createBallService,initBallsDb} = require('../lib/poke-balls');
const {createVerifiedArcade,createArcadeArtworkLoader,createArcadeCryLoader,MODES} = require('../lib/verified-arcade');
const {createGuessGames,createFlavorLoader} = require('../lib/verified-guess');
const sprite = (id) => 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/' + id + '.png';
const pokemon = [
  {id:1,name:'Bulbizarre',gen:1,generation:1,type1:'Plante',type2:'Poison',color:'Vert',habitat:'Prairie',stage:1,height:0.7,weight:6.9,sprite:sprite(1)},
  {id:25,name:'Pikachu',gen:1,generation:1,type1:'Électrik',type2:null,color:'Jaune',habitat:'Forêt',stage:2,height:0.4,weight:6,sprite:sprite(25)},
  {id:152,name:'Germignon',gen:2,generation:2,type1:'Plante',type2:null,color:'Vert',habitat:'Prairie',stage:1,height:0.9,weight:6.4,sprite:sprite(152)},
  {id:25006,name:'Deoxys Attaque',gen:3,generation:3,type1:'Psy',type2:null,isAltForm:true,guessable:false,sprite:sprite(10001)},
];
const me = {key:'user:guess',guestKey:'guest:guess',accountId:'guess'};
const other = {key:'user:other',guestKey:'guest:other',accountId:'other'};
const sql = {skip:!process.env.QA_DATABASE_URL,timeout:60000};
async function withDb(run) {
  const {Pool} = require('pg'), schema = 'vguess_' + randomUUID().replaceAll('-','');
  const admin = new Pool({connectionString:process.env.QA_DATABASE_URL}); let db;
  try {
    await admin.query('CREATE SCHEMA '+schema);
    db = new Pool({connectionString:process.env.QA_DATABASE_URL,options:'-c search_path='+schema,max:6});
    await initBallsDb(db); await run(db);
  } finally { if(db)await db.end(); await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE'); await admin.end(); }
}
const start = (service,who,mode,extra={}) => service.arcadeStart(who,{mode,startId:randomUUID(),gens:[1],...extra});
const guess = (service,who,s,choice) => service.arcadeAnswer(who,{mode:s.mode,sessionId:s.sessionId,round:0,choice});

test('pixel and silhouette are verified modes; the pool follows the generations and skips unguessable forms', () => {
  assert.ok(MODES.includes('pixel') && MODES.includes('silhouette'));
  const games = createGuessGames(pokemon, (n) => n - 1);
  const s = {mode:'pixel', gens:[1], recent:[]};
  games.init(s);
  assert.ok([1,25].includes(s.secretId));
  assert.equal(games.has(25006), false, 'guessable:false stays out');
  assert.throws(() => games.init({mode:'pixel', gens:[3], recent:[]}), /invalid_generations/);
});

test('PostgreSQL: the answer stays on the server until the end; a guess pays once, with the same pastilles as the daily', sql, () => withDb(async db => {
  const service = createBallService({db,pokemon,secret:'local-only',clock:()=>new Date('2026-11-04T12:00:00Z'),randomInt:()=>0});
  await service.state(me);
  await assert.rejects(service.earn(me,{mode:'pixel',result:'win',score:1}),/verified_game_required/);
  const s = (await start(service,me,'pixel')).arcade;
  assert.equal(s.answerId, undefined, 'no answer while playing');
  assert.match(s.image, /^\/api\/arcade\/art\/[\w-]+$/);
  assert.doesNotMatch(JSON.stringify(s), /Bulbizarre|"secretId"/);
  // Reload: the same mystery comes back.
  assert.equal((await start(service,me,'pixel')).arcade.sessionId, s.sessionId);
  await assert.rejects(guess(service,me,s,152), /invalid_choice/, 'outside the chosen generations');
  await assert.rejects(guess(service,other,s,25), /session_changed/);
  const miss = await guess(service,me,s,25);
  assert.equal(miss.arcade.phase, 'playing');
  assert.equal(miss.arcade.rows[0].cmp.type1, 'wrong');
  assert.equal(miss.arcade.rows[0].heightDirection, '↑');
  assert.deepEqual(miss.coinsAdded, []);
  assert.equal((await guess(service,me,s,25)).replayed, true, 'the same name twice counts once');
  const wins = await Promise.all([guess(service,me,s,1), guess(service,me,s,1)]);
  const won = wins.find((r) => !r.replayed) || wins[0];
  assert.equal(won.arcade.phase, 'over'); assert.equal(won.arcade.won, true); assert.equal(won.arcade.answerId, 1);
  assert.equal(wins.flatMap((r) => r.coinsAdded).length, 1);
  assert.deepEqual(wins.flatMap((r) => r.coinsAdded), [{source:'play:pixel', amount:90}], 'found in 2: a fine game');
  assert.ok(wins.flatMap((r) => r.added).some((g) => g.source === 'mode:pixel' && g.ball === 'great'));
  // Next mystery: a fresh run, no second reward the same day.
  const n = (await start(service,me,'pixel',{restart:true})).arcade;
  assert.notEqual(n.sessionId, s.sessionId);
  const gaveUp = await service.arcadeAbandon(me,{mode:'pixel',sessionId:n.sessionId,round:0});
  assert.equal(gaveUp.arcade.phase, 'over'); assert.equal(gaveUp.arcade.won, false); assert.ok(gaveUp.arcade.answerId);
  assert.deepEqual(gaveUp.coinsAdded, []);
  // Zoom progressif: its own first game of the day; a skip pays the small reward.
  const z = (await start(service,me,'silhouette')).arcade;
  const skipped = await service.arcadeAbandon(me,{mode:'silhouette',sessionId:z.sessionId,round:0});
  assert.deepEqual(skipped.coinsAdded, [{source:'play:silhouette', amount:30}]);
}));

test('the picture token only opens for its player, and only a PokeAPI sprite is fetched', async () => {
  const arcade = createVerifiedArcade({pokemon,secret:'local-only',randomInt:()=>0});
  const rows = [];
  const c = {query: async (q, p) => { if (/^SELECT state/.test(q)) return {rows}; if (/^INSERT/.test(q)) { rows[0] = {state: JSON.parse(p[3])}; } return {rows:[]}; }};
  const s = (await arcade.start(c, me, {mode:'silhouette', startId:randomUUID(), gens:[1]})).arcade;
  const token = s.image.split('/').pop();
  const spec = arcade.imageSpec(token, me);
  assert.equal(spec.src, sprite(rows[0].state.secretId));
  assert.equal(arcade.imageSpec(token, other), null);
  const seen = [];
  const png = Buffer.from('89504e470d0a1a0a00', 'hex');
  const load = createArcadeArtworkLoader(async (url) => { seen.push(url); if (seen.length === 1) throw new Error('cdn down'); return {ok:true, headers:{get:()=>null}, arrayBuffer:async()=>png}; });
  assert.deepEqual(await load(spec), png);
  assert.match(seen[1], /^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/master\/sprites\/pokemon\/\d+\.png$/);
  await assert.rejects(createArcadeArtworkLoader(async () => ({}))({src:'https://evil.example/x.png'}), /image_unavailable/);
});

test('Cri and Description are verified too: an opaque cry, the Pokédex text without the name', async () => {
  assert.ok(MODES.includes('cry') && MODES.includes('description'));
  const rows = [];
  const c = {query: async (q, p) => { if (/^SELECT state/.test(q)) return {rows}; if (/^INSERT/.test(q)) { rows[0] = {state: JSON.parse(p[3])}; } return {rows:[]}; }};
  const arcade = createVerifiedArcade({pokemon,secret:'local-only',randomInt:()=>0,describe:async (p) => 'Texte de ' + p.name.length + ' lettres'});
  const cry = (await arcade.start(c, me, {mode:'cry', startId:randomUUID(), gens:[1]})).arcade;
  assert.match(cry.cry, /^\/api\/arcade\/cry\/[\w-]+$/);
  assert.equal(cry.image, undefined);
  const spec = arcade.imageSpec(cry.cry.split('/').pop(), me);
  assert.equal(spec.cry, rows[0].state.secretId);
  assert.equal(arcade.imageSpec(cry.cry.split('/').pop(), other), null);
  const d = (await arcade.start(c, me, {mode:'description', startId:randomUUID(), gens:[1,2]})).arcade;
  assert.match(d.clue, /^Texte de \d+ lettres$/);
  assert.equal(d.answerId, undefined);
  // The Pokédex text hides the name; without any French entry, generic hints instead.
  const loader = createFlavorLoader(async () => ({ok:true, json:async () => ({flavor_text_entries:[{language:{name:'en'},flavor_text:'Pikachu'}, {language:{name:'fr'},flavor_text:'PIKACHU\nstocke'}]})}), () => 0);
  assert.equal(await loader({name:'Pikachu'}, 25), 'ce Pokémon stocke');
  const empty = createFlavorLoader(async () => { throw new Error('down'); }, () => 0);
  assert.match(await empty({name:'Pikachu', gen:1, stage:2}, 25), /génération 1, stade d’évolution 2/);
  // The cry: PokeAPI's Ogg file, GitHub when the CDN fails, nothing else.
  const seen = [];
  const ogg = Buffer.from('OggS0000');
  const cryLoad = createArcadeCryLoader(async (url) => { seen.push(url); if (seen.length === 1) throw new Error('cdn'); return {ok:true, headers:{get:()=>null}, arrayBuffer:async()=>ogg}; });
  assert.deepEqual(await cryLoad({cry:25}), ogg);
  assert.equal(seen[1], 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg');
  await assert.rejects(createArcadeCryLoader(async () => ({ok:true, headers:{get:()=>null}, arrayBuffer:async()=>Buffer.from('<html>')}))({cry:26}), /cry_unavailable/);
});

test('Description draws its mystery up to #898 only, but any Pokémon of the generations can be proposed', () => {
  const list = [...pokemon, {id:906,name:'Poussacha',gen:9,generation:9,sprite:sprite(906)}];
  const games = createGuessGames(list, (n) => n - 1);
  const s = {mode:'description', gens:[9], recent:[]};
  assert.throws(() => games.init(s), /invalid_generations/, 'no French Pokédex text for Gen 9');
  const t = {mode:'description', gens:[1,9], recent:[]};
  games.init(t);
  assert.ok(t.secretId <= 898);
  assert.equal(games.answer(t, 906), true, 'a Gen 9 guess is allowed');
});

test('Classique and Stat Mystère are verified: the mystery gets its types and stats, the first letter only from the 5th guess', async () => {
  assert.ok(MODES.includes('normal') && MODES.includes('mystery'));
  const list = [...pokemon, ...[4,7,10,13,16].map((id) => ({id,name:'P'+id,gen:1,generation:1,sprite:sprite(id)}))];
  const rows = [];
  const c = {query: async (q, p) => { if (/^SELECT state/.test(q)) return {rows}; if (/^INSERT/.test(q)) { rows[0] = {state: JSON.parse(p[3])}; } return {rows:[]}; }};
  const arcade = createVerifiedArcade({pokemon:list,secret:'local-only',randomInt:()=>0});
  const n = (await arcade.start(c, me, {mode:'normal', startId:randomUUID(), gens:[1]})).arcade;
  assert.equal(n.image, undefined); assert.equal(n.mystery, undefined); assert.equal(n.answerId, undefined);
  rows.length = 0;
  let m = (await arcade.start(c, me, {mode:'mystery', startId:randomUUID(), gens:[1]})).arcade;
  const secretId = rows[0].state.secretId;
  assert.deepEqual(m.mystery.stats, require('../base-stats.json')[String(secretId)]);
  assert.equal(m.mystery.letter, undefined, 'no letter at first');
  const wrong = list.filter((p) => p.gen === 1 && p.id !== secretId).slice(0, 5);
  for (const p of wrong) m = (await arcade.answer(c, me, {mode:'mystery', sessionId:m.sessionId, round:0, choice:p.id})).arcade;
  assert.equal(m.attempts, 5);
  assert.equal(m.mystery.letter, list.find((p) => p.id === secretId).name[0].toUpperCase());
  assert.equal(m.answerId, undefined);
});
