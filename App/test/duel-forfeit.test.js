'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { bestDuelProximity } = require('../lib/duel-proximity');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const client = fs.readFileSync(path.join(__dirname, '../src/script.07.delegation-party.js'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, '../src/script.01.core.js'), 'utf8');
function fn(source, name) {
 const start = source.indexOf(`function ${name}(`); assert.ok(start >= 0, name);
 return source.slice(start, source.indexOf('\n}', start) + 2);
}
function catalogueContext() {
 const context = vm.createContext({ fs, path, vm, __dirname: path.join(__dirname, '..'), clearRoomCleanup() {} });
 vm.runInContext(['loadPokemonList', 'loadStatClashExtraFormsConfig', 'injectStatClashExtraForms', 'buildSpriteUrl', 'normalizeName', 'normalizeDuelPokemonName', 'isDuelPokemonAllowed', 'resolveRoomPokemonGuess', 'startRoom', 'resetRoomForNewRound'].map(name => fn(server, name)).join('\n'), context);
 context.POKEMON_LIST = context.loadPokemonList();
 context.POKEMON_BY_NORMALIZED_NAME = new Map(context.POKEMON_LIST.map(p => [context.normalizeName(p.name), p]));
 context.getPokemonCatalog = () => context.POKEMON_LIST;
 vm.runInContext(fn(core, 'getPokemonUiList') + '\n' + fn(client, 'getMultiplayerRoomPool'), context);
 return context;
}
test('every draw candidate in the real catalogue is selectable and accepted, for every generation', () => {
 const c = catalogueContext();
 assert.ok(c.POKEMON_LIST.some(p => p.isAltForm), 'fixture includes the previously impossible forms');
 for (let gen = 1; gen <= 9; gen++) {
  const room = { selectedGens: [gen] }; c.multiplayerLiveState = { room };
  const visibleIds = new Set(c.getMultiplayerRoomPool().map(p => p.id));
  const candidates = c.POKEMON_LIST.filter(p => c.isDuelPokemonAllowed(room, p));
  assert.ok(candidates.length > 0);
  for (const p of candidates) {
   assert.ok(visibleIds.has(p.id), p.name);
   assert.equal(c.resolveRoomPokemonGuess(room, p.name), p, p.name);
  }
  // Sweep the entire random interval, including the old tail containing extra forms.
  for (const random of [0, .25, .5, .75, .999999]) {
   c.Math = Object.create(Math); c.Math.random = () => random;
   c.startRoom(room); assert.ok(visibleIds.has(room.secretPokemon.id));
   assert.equal(room.secretPokemon.isAltForm || false, false);
  }
 }
});
test('empty generation pools never fall back to unplayable Pokémon', () => {
 const c = catalogueContext(); const room = { selectedGens: [99] };
 c.startRoom(room); assert.equal(room.secretPokemon, null); assert.equal(room.status, 'waiting');
});
function forfeitFixture() {
 const room = { code: 'DUEL', roundSerial: 4, hostId: 'a', status: 'live', selectedGens: [1], secretPokemon: { id: 25, name: 'Pikachu' }, players: ['a', 'b'].map(id => ({ id, connected: true, guesses: [], attempts: 0, correct: false })) };
 const events = []; let callback; let timerCleared = false;
 const c = vm.createContext({ bestDuelProximity, serializePokemon: p => p, socket: { id: 'a', on: (_, f) => { callback = f; } }, findRoomBySocket: id => room.players.some(p => p.id === id) ? room : null, respond: (ack, result) => ack(result), emitRoomState: r => events.push(r.status), emitRoomFinished: r => events.push(r.status), clearTimeout: () => { timerCleared = true; }, clearRoomCleanup() {} });
 vm.runInContext(['publicRoomState', 'resetRoomForNewRound'].map(name => fn(server, name)).join('\n'), c);
 const start = server.indexOf('  socket.on("duel:forfeit"');
 vm.runInContext(server.slice(start, server.indexOf('  socket.on("duel:resume"', start)), c);
 return { room, events, c, cleared: () => timerCleared, submit: (payload = { code: 'DUEL', roundSerial: 4 }, id = 'a') => { c.socket.id = id; let result; callback(payload, r => { result = r; }); return result; } };
}
test('abandon reveals the answer to both players, awards the rival, and preserves the salon for replay', () => {
 const f = forfeitFixture(); f.room.graceTimer = 1;
 assert.equal(f.submit().ok, true); assert.equal(f.room.status, 'finished');
 assert.equal(f.room.winnerId, 'b'); assert.equal(f.room.endedReason, 'forfeit');
 assert.equal(f.room.players.length, 2); assert.ok(f.room.players.every(p => p.connected && !p.correct));
 for (const p of f.room.players) assert.equal(f.c.publicRoomState(f.room, p.id).targetRevealed.name, 'Pikachu');
 assert.equal(f.events.length, 2); assert.equal(f.cleared(), true);
 assert.equal(f.submit().ok, false); assert.equal(f.events.length, 2);
 f.c.resetRoomForNewRound(f.room); assert.equal(f.room.endedReason, null); assert.equal(f.room.winnerId, null);
 assert.ok(f.room.players.every(p => p.connected));
});
test('abandon rejects outsiders, stale rounds, wrong salons, and waiting games', () => {
 const f = forfeitFixture();
 assert.equal(f.submit(undefined, 'outsider').ok, false);
 assert.equal(f.submit({ code: 'DUEL', roundSerial: 3 }).ok, false);
 assert.equal(f.submit({ code: 'OTHER', roundSerial: 4 }).ok, false);
 f.room.status = 'waiting'; assert.equal(f.submit().ok, false);
 assert.equal(f.events.length, 0); assert.equal(f.room.winnerId, undefined);
});
test('guest can abandon and a late abandon cannot override an already won game', () => {
 const f = forfeitFixture(); assert.equal(f.submit(undefined, 'b').ok, true); assert.equal(f.room.winnerId, 'a');
 const g = forfeitFixture(); g.room.status = 'finished'; g.room.winnerId = 'a'; g.room.endedReason = 'guess';
 assert.equal(g.submit(undefined, 'a').ok, false); assert.equal(g.room.winnerId, 'a'); assert.equal(g.room.endedReason, 'guess');
});
test('client prevents duplicate abandons and recovers after a timeout', () => {
 const state = { room: { code: 'DUEL', roundSerial: 4, status: 'live' } }; let callback; let calls = 0; let errorText;
 const c = vm.createContext({ ensureMultiplayerLiveState: () => state, setMultiplayerError: text => { errorText = text; }, updateMultiplayerGuessSubmitState() {}, multiplayerSocket: { connected: true, timeout: () => ({ emit: (event, payload, ack) => { calls++; assert.equal(event, 'duel:forfeit'); assert.equal(payload.roundSerial, 4); callback = ack; } }) } });
 vm.runInContext(fn(client, 'forfeitMultiplayerRound'), c);
 c.forfeitMultiplayerRound(); c.forfeitMultiplayerRound(); assert.equal(calls, 1); assert.equal(state.pendingForfeit, true);
 callback(new Error('timeout')); assert.equal(state.pendingForfeit, false); assert.match(errorText, /Connexion lente/);
 c.forfeitMultiplayerRound(); state.room = { code: 'DUEL', roundSerial: 5, status: 'live' }; errorText = '';
 callback(new Error('timeout')); assert.equal(errorText, '');
});

test('Nidoran female and male resolve to distinct IDs and keep accented names usable', () => {
 const c = catalogueContext(); const room = { selectedGens: [1] };
 assert.equal(c.resolveRoomPokemonGuess(room, 'Nidoran♀').id, 29);
 assert.equal(c.resolveRoomPokemonGuess(room, 'Nidoran♂').id, 32);
 assert.equal(c.resolveRoomPokemonGuess(room, 'Nidoran'), null);
 assert.equal(c.resolveRoomPokemonGuess(room, 'evoli').id, 133);
});

test('winning requires the exact Pokémon ID, including both Nidoran', () => {
 const c = catalogueContext(); let callback;
 const room = { status: 'live', selectedGens: [1], secretPokemon: c.POKEMON_LIST.find(p => p.id === 29), players: [{ id: 'a', guesses: [], attempts: 0 }] };
 Object.assign(c, { socket: { id: 'a', on: (_, f) => { callback = f; } }, findRoomBySocket: () => room, respond: (ack, result) => ack(result), checkRateLimit: () => false, buildGuessFeedback: p => p, emitRoomState() {}, emitRoomFinished() {} });
 const start = server.indexOf('  socket.on("duel:submit-guess"');
 vm.runInContext(server.slice(start, server.indexOf('  socket.on("duel:leave-room"', start)), c);
 let result; callback({ guess: 'Nidoran♂' }, r => { result = r; }); assert.equal(result.correct, false); assert.equal(room.status, 'live');
 callback({ guess: 'Nidoran♀' }, r => { result = r; }); assert.equal(result.correct, true); assert.equal(room.status, 'finished'); assert.equal(room.players[0].attempts, 2);
});
