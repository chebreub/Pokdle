'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const deduction = require('../lib/party-deduction');
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
    POKEMON_LIST: catalogue, deductionParty: deduction, bestDuelProximity,
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

test('all species and alternative forms in every selected generation can be searched and submitted in Duel and Party', () => {
  const env = envFixture();
  let forms = 0;
  for (let gen = 1; gen <= 9; gen++) {
    const room = { selectedGens: [gen], gameMode: 'deduction' };
    env.multiplayerLiveState = { room }; env.partyRoomState = { room };
    const duelIds = new Set(env.getMultiplayerRoomPool().map(p => p.id));
    const partyIds = new Set(env.getPartyGuessSearchIndex().map(e => e.pokemon.id));
    for (const p of env.POKEMON_LIST.filter(p => Number(p.gen || p.generation) === gen)) {
      assert.ok(duelIds.has(p.id), 'Duel: ' + p.name); assert.ok(partyIds.has(p.id), 'Party: ' + p.name);
      assert.equal(env.resolveRoomPokemonGuess(room, p.name).id, p.id);
      assert.equal(env.findPokemonGlobalByName(p.name).id, p.id);
      if (p.isAltForm) forms++;
    }
    env.Math = Object.create(Math); env.Math.random = () => .999999;
    env.startRoom(room);
    assert.ok(duelIds.has(room.secretPokemon.id));
  }
  assert.ok(forms > 50, 'actual alternative forms tested');
});

test('eight-player room hides the target and all rival guess identities while retaining own feedback', () => {
  const env = envFixture(); const room = roomFixture(env);
  const submit = socketHandler(env, room, 'party:submit-answer');
  assert.equal(submit({ guess: 'Pikachu', roundSerial: room.roundSerial }).ok, true);
  assert.equal(room.status, 'playing');
  for (let i = 0; i < 8; i++) {
    const state = env.publicPartyRoomState(room, 'p' + i);
    assert.equal(state.round.answer, null); assert.equal(state.round.image, null);
    const rival = state.players[0];
    if (i === 0) assert.equal(rival.guessHistory[0].name, 'Pikachu');
    else {
      assert.equal(rival.guessHistory.length, 0);
      assert.ok(!JSON.stringify(state).includes('Pikachu'));
      assert.ok(!JSON.stringify(state).includes(room.target.name));
    }
    assert.ok(rival.proximity > 0 && rival.proximity < 100);
  }
});

test('first exact alternative form wins once, reveals to all eight, and rejects late guesses', () => {
  const env = envFixture(); const room = roomFixture(env);
  const form = env.POKEMON_LIST.find(p => p.isAltForm);
  room.selectedGens = [form.gen];
  const pool = env.POKEMON_LIST.filter(p => Number(p.gen || p.generation) === form.gen);
  const index = pool.findIndex(p => p.id === form.id);
  deduction.startDeductionRound(room, env.POKEMON_LIST, () => (index + .5) / pool.length);
  assert.equal(room.target.isAltForm, true);
  const submit = socketHandler(env, room, 'party:submit-answer');
  const name = room.target.name;
  const result = submit({ guess: name, roundSerial: room.roundSerial }, 'p7');
  assert.equal(result.ok, true); assert.equal(result.correct, true);
  assert.equal(room.status, 'finished'); assert.equal(room.players[7].score, 100);
  for (const p of room.players) {
    const state = env.publicPartyRoomState(room, p.id);
    assert.equal(state.round.answer, name); assert.equal(state.round.winnerId, 'p7');
    assert.equal(state.players[7].proximity, 100);
  }
  assert.equal(submit({ guess: name, roundSerial: room.roundSerial }, 'p0').ok, false);
  assert.equal(room.players[0].score, 0);
});

test('invalid generation, duplicates, expired and stale submissions do not change attempts or scores', () => {
  const env = envFixture(); const room = roomFixture(env);
  const submit = socketHandler(env, room, 'party:submit-answer');
  assert.equal(submit({ guess: 'Germignon', roundSerial: room.roundSerial }).ok, false);
  assert.equal(submit({ guess: 'Pikachu', roundSerial: room.roundSerial - 1 }).ok, false);
  assert.equal(submit({ guess: 'Pikachu', roundSerial: room.roundSerial }).ok, true);
  assert.equal(submit({ guess: 'Pikachu', roundSerial: room.roundSerial }).ok, false);
  room.deadlineAt = Date.now() - 1;
  assert.equal(submit({ guess: room.target.name, roundSerial: room.roundSerial }).ok, false);
  assert.equal(room.players[0].attempts, 1); assert.equal(room.players[0].score, 0);
});

test('individual abandonment preserves secrecy; the eighth abandonment reveals without points', () => {
  const env = envFixture(); const room = roomFixture(env);
  const forfeit = socketHandler(env, room, 'party:forfeit-deduction');
  for (let i = 0; i < 8; i++) {
    assert.equal(forfeit({ code: room.code, roundSerial: room.roundSerial }, 'p' + i).ok, true);
    assert.equal(room.status, i === 7 ? 'finished' : 'playing');
    if (i < 7) assert.equal(env.publicPartyRoomState(room, 'p' + i).round.answer, null);
  }
  assert.ok(room.players.every(p => p.score === 0));
  assert.equal(env.publicPartyRoomState(room, 'p0').round.answer, room.target.name);
});

test('deduction timer is three minutes; timeout and host reveal expose the target without awarding points', async () => {
  const env = envFixture(); const room = roomFixture(env);
  await env.startPartyRound(room);
  assert.equal(env.timer.duration, 180000);
  env.timer.fn(); assert.equal(room.status, 'finished');
  assert.equal(env.publicPartyRoomState(room, 'p0').round.answer, room.target.name);
  assert.ok(room.players.every(p => p.score === 0));
  deduction.startDeductionRound(room, env.POKEMON_LIST);
  const reveal = socketHandler(env, room, 'party:reveal-round');
  assert.equal(reveal({}, 'p1').ok, false);
  assert.equal(reveal({}, 'p0').ok, true); assert.equal(room.status, 'finished');
});

test('next round clears history and abandons, changes serial, keeps scores, and final round completes party', () => {
  const env = envFixture(); const room = roomFixture(env);
  const oldSerial = room.roundSerial;
  room.players[0].guesses = [{ name: 'old', feedback: {} }]; room.players[0].score = 100; room.players[0].gaveUp = true;
  deduction.startDeductionRound(room, env.POKEMON_LIST);
  assert.ok(room.roundSerial > oldSerial);
  assert.equal(room.players[0].score, 100);
  assert.equal(room.players[0].guesses.length, 0); assert.equal(room.players[0].gaveUp, false);
  room.roundNumber = room.totalRounds;
  env.endPartyRound(room); assert.equal(room.status, 'complete');
});

test('remaining abandoned players resolve when the last active player leaves', () => {
  const env = envFixture(); const room = roomFixture(env, 2);
  room.players[1].gaveUp = true;
  env.findPartyRoomBySocket = () => room;
  env.io = { sockets: { sockets: new Map() } };
  env.handlePartyDisconnect('p0', true);
  assert.equal(room.status, 'finished'); assert.equal(room.hostId, 'p1');
});

test('switching mode clears exposed deduction history and hides the old answer', () => {
  const env = envFixture(); const room = roomFixture(env);
  room.status = 'complete'; room.players[0].guesses = [{ name: 'PRIVATE', feedback: {} }];
  const setMode = socketHandler(env, room, 'party:set-mode');
  assert.equal(setMode({ mode: 'nearest' }).ok, true);
  const state = env.publicPartyRoomState(room, 'p0');
  assert.equal(state.round, null); assert.ok(!JSON.stringify(state).includes('PRIVATE'));
});

test('UI cards escape names, use own history only, and never show rival species', () => {
  const env = envFixture(); const room = roomFixture(env);
  const ids = ['party-deduction', 'party-deduction-forfeit', 'party-deduction-forfeit-btn', 'party-deduction-history', 'party-deduction-rivals', 'party-deduction-status'];
  const els = Object.fromEntries(ids.map(id => [id, { innerHTML: '', textContent: '', classList: { toggle() {} } }]));
  env.document = { getElementById: id => els[id] }; env.partyRoomState = {};
  env.escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  Object.assign(env, compile(client, ['partyDeductionGuessHtml', 'renderPartyDeduction'], env));
  const state = env.publicPartyRoomState(room, 'p0');
  state.players[1].nickname = '<img src=x>'; state.players[1].guessHistory = [{ name: 'PRIVATE' }];
  env.renderPartyDeduction(state, state.players[0], true, true);
  const html = els['party-deduction-rivals'].innerHTML;
  assert.ok(!html.includes('PRIVATE')); assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img src=x>'));
  assert.equal((html.match(/role="progressbar"/g) || []).length, 7);
});
