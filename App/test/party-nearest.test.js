'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nearest = require('../lib/party-nearest');
const catalogue = [
  { id: 1, name: 'Bulbizarre', gen: 1, sprite: '/1.png' },
  { id: 23, name: 'Abo', gen: 1 }, { id: 25, name: 'Pikachu', gen: 1 },
  { id: 27, name: 'Sabelette', gen: 1 }, { id: 152, name: 'Germignon', gen: 2 },
  { id: 10025, name: 'Pikachu costume', gen: 1, isAltForm: true },
];
const normalize = name => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
function fixture() {
  const room = { code: 'TEST', gameMode: 'nearest', selectedGens: [1], roundNumber: 1, totalRounds: 5, hostId: 'a', players: ['a', 'b'].map(id => ({ id, nickname: id, connected: true, score: 0 })) };
  nearest.startNearestRound(room, catalogue, () => .5); // Pikachu's #025
  room.deadlineAt = Date.now() + 30000;
  return room;
}
function submit(room, index, guess, serial = room.roundSerial) {
  return nearest.submitNearest(room, room.players[index], guess, serial, catalogue, normalize);
}
test('targets and proposals respect selected generations and exclude forms', () => {
  const room = fixture();
  assert.deepEqual(nearest.nearestPool(catalogue, [2]).map(p => p.id), [152]);
  assert.equal(room.nearestTarget, 25);
  assert.match(submit(room, 0, 'Germignon').error, /générations/);
  assert.match(submit(room, 0, 'Pikachu costume').error, /générations/);
  assert.match(submit(room, 0, 'unknown').error, /Choisis/);
  assert.equal(submit(room, 0, 'PIKACHU').submitted, true);
});
test('one locked proposal per player, with no points before reveal', () => {
  const room = fixture();
  assert.equal(submit(room, 0, 'Abo').submitted, true);
  assert.equal(submit(room, 0, 'Pikachu').already, true);
  assert.equal(room.players[0].nearestPick.id, 23);
  assert.equal(room.players[0].score, 0);
  assert.equal(nearest.allNearestSubmitted(room), false);
  const publicState = nearest.publicNearestRound(room, false);
  assert.equal(publicState.targetNumber, 25);
  assert.equal(publicState.results, null);
  assert.ok(!JSON.stringify(publicState).includes('Abo'));
});
test('closest wins; exact hit beats an earlier answer, reveal scores once', () => {
  const room = fixture();
  submit(room, 0, 'Abo'); submit(room, 1, 'Pikachu');
  assert.equal(nearest.allNearestSubmitted(room), true);
  assert.equal(nearest.scoreNearestRound(room), true);
  assert.deepEqual(room.players.map(p => p.score), [0, 100]);
  assert.equal(nearest.scoreNearestRound(room), false);
  assert.equal(room.players[1].score, 100);
  const results = nearest.publicNearestRound(room, true).results;
  assert.equal(results[0].playerId, 'b'); assert.equal(results[0].distance, 0);
  assert.equal(results[1].distance, 2);
});
test('equal distances and identical guesses award every tied winner 100 points', () => {
  for (const guesses of [['Abo', 'Sabelette'], ['Pikachu', 'Pikachu']]) {
    const room = fixture(); guesses.forEach((name, i) => submit(room, i, name));
    nearest.scoreNearestRound(room);
    assert.deepEqual(room.players.map(p => p.score), [100, 100]);
  }
});
test('timeout/reveal excludes unanswered players and no-answer rounds award nothing', () => {
  const room = fixture(); submit(room, 0, 'Bulbizarre'); nearest.scoreNearestRound(room);
  assert.deepEqual(room.players.map(p => p.score), [100, 0]);
  assert.equal(nearest.publicNearestRound(room, true).results[1].distance, null);
  const empty = fixture(); nearest.scoreNearestRound(empty);
  assert.deepEqual(empty.players.map(p => p.score), [0, 0]);
});
test('expired, stale, disconnected and non-participating submissions are rejected', () => {
  const room = fixture();
  assert.match(submit(room, 0, 'Pikachu', 0).error, /changé/);
  room.players[0].connected = false; assert.match(submit(room, 0, 'Pikachu').error, /participes/);
  room.players[0].connected = true; room.roundPlayerIds = ['b']; assert.match(submit(room, 0, 'Pikachu').error, /participes/);
  room.roundPlayerIds.push('a'); room.deadlineAt = Date.now() - 1;
  assert.match(submit(room, 0, 'Pikachu').error, /terminée/);
  assert.equal(room.players[0].nearestPick, null);
});
test('next round and replay clear picks but keep a unique serial across games', () => {
  const room = fixture(); submit(room, 0, 'Pikachu'); nearest.scoreNearestRound(room);
  const oldSerial = room.roundSerial;
  nearest.startNearestRound(room, catalogue, () => 0);
  assert.equal(room.players[0].score, 100); assert.equal(room.players[0].lastGain, 0);
  assert.equal(room.players[0].nearestPick, null); assert.equal(room.players[0].correct, false);
  assert.notEqual(room.nearestTarget, 25); assert.equal(room.roundSerial, oldSerial + 1);
  assert.ok(submit(room, 0, 'Pikachu', oldSerial).error);
});

// Exercise the production room serializer and Socket.IO dispatch, not a copy
// of their logic. Network-independent: no ports, credentials or external API.
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
function fn(name) {
  const start = server.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return server.slice(start, server.indexOf('\n}', start) + 2);
}
function wired(room) {
  const context = {
    nearestParty: nearest, POKEMON_LIST: catalogue, normalizeName: normalize,
    PARTY_MIN_PLAYERS: 2, PARTY_MAX_PLAYERS: 8, PARTY_TOTAL_ROUNDS: 5,
    clearPartyRoundTimer() {}, emitPartyRoomState() {},
    findPartyRoomBySocket: () => room, checkRateLimit: () => false,
    respond: (ack, value) => ack(value),
  };
  vm.runInNewContext(['endPartyRound', 'publicPartyNearestRoundState', 'resolvePartyNearestRound', 'publicPartyRoomState'].map(fn).join('\n'), context);
  function event(name, next, payload, id = 'a') {
    let callback, response;
    context.socket = { id, on: (_, handler) => { callback = handler; } };
    const start = server.indexOf(`  socket.on("${name}"`);
    vm.runInNewContext(server.slice(start, server.indexOf(`  socket.on("${next}"`, start)), context);
    callback(payload, result => { response = result; });
    return response;
  }
  return { context, event };
}
test('real submission handler hides rival picks, auto-reveals and completes final round', () => {
  const room = fixture(), w = wired(room); room.roundNumber = 5;
  const answer = (guess, id) => w.event('party:submit-answer', 'party:reveal-round', { guess, roundSerial: room.roundSerial }, id);
  assert.equal(answer('Abo', 'a').submitted, true);
  const rivalView = w.context.publicPartyRoomState(room, 'b');
  assert.equal(rivalView.players[0].submitted, true);
  assert.equal(rivalView.players[0].proposal, null);
  assert.equal(rivalView.round.results, null);
  assert.equal(w.context.publicPartyRoomState(room, 'a').players[0].proposal, 'Abo');
  const result = answer('Pikachu', 'b');
  assert.equal(result.ok, true); assert.equal(result.room.status, 'complete');
  assert.equal(result.room.players[1].score, 100);
  assert.equal(answer('Pikachu', 'a').ok, false);
});
test('host-only reveal scores the nearest mode and timer uses the same scorer', () => {
  const room = fixture(), w = wired(room); submit(room, 0, 'Abo');
  assert.equal(w.event('party:reveal-round', 'party:submit-stat', {}, 'b').ok, false);
  assert.equal(room.status, 'playing');
  assert.equal(w.event('party:reveal-round', 'party:submit-stat', {}, 'a').ok, true);
  assert.equal(room.status, 'finished'); assert.equal(room.players[0].score, 100);
  assert.equal(w.event('party:reveal-round', 'party:submit-stat', {}, 'a').ok, false);
  const timed = fixture(), timer = wired(timed); submit(timed, 1, 'Sabelette');
  vm.runInNewContext(fn('forcePartyRoundEnd'), timer.context);
  timer.context.forcePartyRoundEnd(timed);
  assert.equal(timed.status, 'finished'); assert.equal(timed.players[1].score, 100);
});
test('leaving transfers host and resolves when remaining players have submitted', () => {
  const room = fixture(), w = wired(room); submit(room, 1, 'Sabelette');
  let left;
  w.context.io = { sockets: { sockets: new Map([['a', { data: {}, leave: code => { left = code; } }]]) } };
  vm.runInNewContext(fn('handlePartyDisconnect'), w.context);
  w.context.handlePartyDisconnect('a', true);
  assert.equal(left, 'TEST'); assert.equal(room.hostId, 'b');
  assert.equal(room.status, 'finished'); assert.equal(room.players[0].score, 100);
});
test('eight players resolve only after the final proposal and share ties fairly', () => {
  const room = fixture();
  room.players = Array.from({ length: 8 }, (_, i) => ({ id: String(i), nickname: 'Player ' + i, connected: true, score: 0 }));
  nearest.startNearestRound(room, catalogue, () => 0);
  room.deadlineAt = Date.now() + 30000;
  for (let i = 0; i < 8; i++) {
    assert.equal(nearest.allNearestSubmitted(room), false);
    assert.equal(submit(room, i, i < 3 ? 'Bulbizarre' : 'Abo').submitted, true);
  }
  assert.equal(nearest.allNearestSubmitted(room), true);
  nearest.scoreNearestRound(room);
  assert.deepEqual(room.players.map(p => p.score), [100,100,100,0,0,0,0,0]);
});
test('changing mode after a completed game clears stale round data', () => {
  const room = fixture(); submit(room, 0, 'Pikachu'); nearest.scoreNearestRound(room); room.status = 'complete';
  const w = wired(room);
  assert.equal(w.event('party:set-mode', 'party:set-rounds', { mode: 'typecombo' }, 'b').ok, false);
  const changed = w.event('party:set-mode', 'party:set-rounds', { mode: 'typecombo' }, 'a');
  assert.equal(changed.ok, true); assert.equal(changed.room.status, 'waiting');
  assert.equal(changed.room.round, null); assert.equal(room.nearestTarget, null);
});
