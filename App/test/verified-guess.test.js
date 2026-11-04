'use strict';
// 🔒 Pokémon pixelisé et Zoom progressif vérifiés par le serveur (4/11/2026).
const test = require('node:test'), assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createBallService,initBallsDb} = require('../lib/poke-balls');
const {createVerifiedArcade,createArcadeArtworkLoader,MODES} = require('../lib/verified-arcade');
const {createGuessGames} = require('../lib/verified-guess');
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
