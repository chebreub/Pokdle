'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const deduction = require('../lib/party-deduction');
const coop = require('../lib/party-coop');
const { bestDuelProximity } = require('../lib/duel-proximity');
const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src/script.04.jeu-pokedex.js'), 'utf8');
const duel = fs.readFileSync(path.join(root, 'src/script.07.delegation-party.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'src/script.01.core.js'), 'utf8');
function extract(source, name) {
  let start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n}', start) + 2;
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  return source.slice(start, end);
}
function compile(source, names, env) {
  return new Function('env', 'with(env) {\n' + names.map(n => extract(source, n)).join('\n') + '\nreturn {' + names.join(',') + '};\n}')(env);
}
function envFixture() {
  const data = fs.readFileSync(path.join(root, 'pokemon.js'), 'utf8');
  const catalogue = JSON.parse(data.match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
  const extraForms = new Function('return ' + core.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/)[1])();
  const env = {
    POKEMON_LIST: catalogue, deductionParty: deduction, coopParty: coop, bestDuelProximity,
    loadStatClashExtraFormsConfig: () => ({ extraForms, apiNamesByName: {} }),
    PARTY_TOTAL_ROUNDS: 5, PARTY_MIN_PLAYERS: 2, PARTY_MAX_PLAYERS: 8, PARTY_ROUND_TIMER_MS: 30000,
    clearRoomCleanup() {}, clearTimeout() {}, setTimeout(fn, duration) { env.timer = { fn, duration }; return 1; },
    emitPartyRoomState(room) { env.emitted = room; }, clearPartyRoomCleanup() {}, schedulePartyRoomCleanup() {},
  };
  const names = ['injectStatClashExtraForms', 'buildSpriteUrl', 'normalizeName', 'normalizeDuelPokemonName',
    'isDuelPokemonAllowed', 'resolveRoomPokemonGuess', 'startRoom', 'buildGuessFeedback', 'compareGuessToSecret',
    'arrowFor', 'publicPartyRoomState', 'endPartyRound', 'clearPartyRoundTimer', 'armPartyRoundTimer',
    'forcePartyRoundEnd', 'isPartyStatMode', 'startPartyRound', 'handlePartyDisconnect'];
  // Include comparison helpers from the real server, not a duplicate scoring implementation.
  const compareNames = ['compareColors', 'cmpNum', 'colorTokens'];
  for (const n of compareNames) if (server.includes('function ' + n + '(')) names.push(n);
  Object.assign(env, compile(server, names, env));
  env.injectStatClashExtraForms(catalogue);
  env.getPokemonCatalog = () => catalogue;
  Object.assign(env, compile(core, ['getPokemonUiList'], env));
  Object.assign(env, compile(duel, ['getMultiplayerRoomPool', 'norm', 'findPokemonGlobalByName', 'multiplayerProximityValue'], env));
  env.FULL_SEARCH_INDEX = catalogue.map(pokemon => ({ pokemon, normName: env.norm(pokemon.name) }));
  Object.assign(env, compile(client, ['getPartyGuessSearchIndex'], env));
  return env;
}
function roomFixture(env, count = 8) {
  const room = { code: 'PARTY', gameMode: 'deduction', selectedGens: [1], roundNumber: 1, totalRounds: 5, hostId: 'p0',
    players: Array.from({ length: count }, (_, i) => ({ id: 'p' + i, nickname: 'Player ' + i, connected: true, score: 0 })) };
  deduction.startDeductionRound(room, env.POKEMON_LIST, () => .999999);
  room.deadlineAt = Date.now() + 180000;
  return room;
}
function socketHandler(env, room, event) {
  let callback;
  const start = server.indexOf('  socket.on("' + event + '"');
  assert.ok(start >= 0, event);
  const end = server.indexOf('\n  socket.on(', start + 1);
  env.socket = { id: 'p0', on: (_, fn) => { callback = fn; } };
  env.findPartyRoomBySocket = id => room.players.some(p => p.id === id) ? room : null;
  env.checkRateLimit = () => false;
  env.respond = (ack, result) => ack(result);
  new Function('env', 'with(env) {' + server.slice(start, end) + '}')(env);
  return (payload, id = 'p0') => {
    env.socket.id = id;
    let result;
    callback(payload, r => { result = r; });
    return result;
  };
}

function coopFixture(count = 8) {
  const env = envFixture(), room = roomFixture(env, count);
  room.gameMode = 'coop';
  coop.startCoopRound(room, env.POKEMON_LIST, () => .99999);
  room.deadlineAt = Date.now() + 180000;
  return { env, room };
}
test('2 to 8 players receive the complete clue deck without overlap or answer leaks', () => {
  for (let count = 2; count <= 8; count++) {
    const {env, room} = coopFixture(count);
    const labels = [];
    for (const player of room.players) {
      const state = env.publicPartyRoomState(room, player.id);
      labels.push(...state.round.myClues.map(c => c.label));
      assert.equal(state.round.answer, null);
      assert.equal(state.round.image, null);
      assert.equal(state.round.sharedClues.length, 0);
      assert.ok(state.round.myClues.length >= 1);
      assert.ok(!JSON.stringify(state).includes(room.target.name));
    }
    assert.equal(labels.length, 8); assert.equal(new Set(labels).size, 8);
    assert.equal(env.publicPartyRoomState(room, 'outsider').round.myClues.length, 0);
  }
});
test('sharing a clue publishes only that player clues and rejects stale, foreign and expired actions', () => {
  const {env, room} = coopFixture();
  const share = socketHandler(env, room, 'party:share-clue');
  const payload = { code: room.code, roundSerial: room.roundSerial };
  assert.equal(share({...payload, code:'OLD'}).ok, false);
  assert.equal(share({...payload, roundSerial:0}).ok, false);
  assert.equal(share(payload, 'outsider').ok, false);
  assert.equal(share(payload).ok, true);
  const state = env.publicPartyRoomState(room, 'p1');
  assert.equal(state.round.sharedClues.length, 1);
  assert.deepEqual(state.round.sharedClues[0].clues, room.coopClues.p0.clues);
  assert.equal(share(payload).ok, true); // idempotent
  assert.equal(env.publicPartyRoomState(room, 'p1').round.sharedClues.length, 1);
  room.deadlineAt = Date.now() - 1; assert.equal(share(payload, 'p2').ok, false);
});
test('the exact alternative form wins for all eight, with no double scoring or identity ambiguity', () => {
  const {env, room} = coopFixture();
  const form = env.POKEMON_LIST.find(p => p.isAltForm);
  room.selectedGens = [form.gen];
  const pool = env.POKEMON_LIST.filter(p => Number(p.gen || p.generation) === form.gen);
  const pos = pool.indexOf(form);
  coop.startCoopRound(room, env.POKEMON_LIST, () => (pos + .5) / pool.length);
  assert.equal(room.target.id, form.id);
  env.partyRoomState = {room};
  assert.ok(env.getPartyGuessSearchIndex().some(e => e.pokemon.id === form.id));
  const submit = socketHandler(env, room, 'party:submit-answer');
  const payload = {code:room.code, guess:form.name, roundSerial:room.roundSerial};
  assert.equal(submit({...payload,code:'OLD'}).ok,false);
  assert.equal(submit(payload,'p7').correct,true);
  assert.equal(room.status,'finished');
  assert.ok(room.players.every(p => p.score === 100 && p.lastGain === 100));
  for (const p of room.players) {
    const state = env.publicPartyRoomState(room,p.id);
    assert.equal(state.round.answer,form.name); assert.equal(state.round.solved,true);
  }
  assert.equal(submit(payload).ok,false);
  assert.ok(room.players.every(p => p.score === 100));
});
test('12 shared attempts end the round, duplicates and invalid guesses never consume attempts', () => {
  const {env,room} = coopFixture();
  const submit = socketHandler(env,room,'party:submit-answer');
  const payload = {code:room.code,roundSerial:room.roundSerial};
  assert.equal(submit({...payload,guess:'not-a-pokemon'}).ok,false);
  assert.equal(submit({...payload,guess:room.target.name,roundSerial:0}).ok,false);
  const choices = env.POKEMON_LIST.filter(p => p.gen === 1 && p.id !== room.target.id).slice(0,12);
  for (let i=0; i<12; i++) {
    const r=submit({...payload,guess:choices[i].name},'p'+(i%8));
    assert.equal(r.ok,true); assert.equal(room.status,i===11?'finished':'playing');
    if(i===0) assert.equal(submit({...payload,guess:choices[i].name},'p1').ok,false);
  }
  assert.equal(room.coopGuesses.length,12);
  assert.ok(room.players.every(p=>p.score===0));
  assert.equal(env.publicPartyRoomState(room,'p0').round.answer,room.target.name);
});
test('timeout, host reveal, next round and disconnection preserve cooperative play', async () => {
  const {env,room}=coopFixture(2);
  await env.startPartyRound(room); assert.equal(env.timer.duration,180000);
  env.timer.fn(); assert.equal(room.status,'finished');
  assert.equal(env.publicPartyRoomState(room,'p1').round.answer,room.target.name);
  const serial=room.roundSerial; coop.startCoopRound(room,env.POKEMON_LIST);
  assert.ok(room.roundSerial>serial);assert.equal(room.coopGuesses.length,0);
  env.findPartyRoomBySocket=()=>room;env.io={sockets:{sockets:new Map()}};
  env.handlePartyDisconnect('p0',true);
  assert.equal(room.status,'playing');assert.equal(room.hostId,'p1');
  assert.equal(env.publicPartyRoomState(room,'p1').round.sharedClues.length,1);
  const reveal=socketHandler(env,room,'party:reveal-round');
  assert.equal(reveal({},'p1').ok,true);assert.equal(room.status,'finished');
});
test('late joiners cannot consume attempts or receive private clues',()=>{
 const {env,room}=coopFixture(2);const newcomer={id:'late',nickname:'Late',connected:true,score:0};room.players.push(newcomer);
 assert.equal(coop.submitCoop(room,newcomer,room.target.name,room.roundSerial,env.resolveRoomPokemonGuess).error,'Tu ne participes pas à cette manche.');
 assert.equal(coop.publicCoopRound(room,'late',false).myClues.length,0);
});
test('cooperative UI escapes shared names and clues, and clears the panel when switching modes',()=>{
 const {env,room}=coopFixture();const panel={innerHTML:'',classList:{toggle(){}}};
 env.document={getElementById:()=>panel};env.escapeHtml=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 env.partyRoomState={};const ui=fs.readFileSync(path.join(root,'src/script.09.club.js'),'utf8');
 Object.assign(env,compile(ui,['coopCluesHtml','renderPartyCoop'],env));
 const state=env.publicPartyRoomState(room,'p0');state.round.sharedClues=[{nickname:'<img src=x>',clues:[{label:'<script>',value:'<img src=y>'}]}];
 env.renderPartyCoop(state,true,true);
 assert.ok(panel.innerHTML.includes('&lt;img'));assert.ok(!panel.innerHTML.includes('<img src='));
 env.renderPartyCoop(state,false,false);assert.equal(panel.innerHTML,'');
});
