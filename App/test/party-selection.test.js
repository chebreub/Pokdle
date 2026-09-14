'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/script.04.jeu-pokedex.js'), 'utf8');
function fn(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function fixture() {
  const input = { value: '', focus() {} };
  const list = { classList: { add() {} }, querySelectorAll: () => [] };
  const button = { disabled: false };
  const room = { code: 'TEST', gameMode: 'nearest', status: 'playing', roundNumber: 1, round: { roundSerial: 7 } };
  const sent = [], messages = [];
  const socket = { timeout: () => socket, emit: (event, payload, ack) => sent.push({ event, payload, ack }) };
  const c = {
    document: { getElementById: id => ({ 'party-guess': input, 'party-guess-ac': list, 'party-submit-btn': button })[id] },
    partyRoomState: { room }, partyAcIndex: -1,
    ensureMultiplayerSocket: () => socket, setPartyStatus: m => messages.push(m), renderPartyRoom() {},
  };
  vm.runInNewContext(['partySubmitAnswer', 'selectPartyGuessAC', 'handlePartyGuessKey'].map(fn).join('\n'), c);
  return { c, input, list, room, sent, button, messages };
}
test('selecting a suggested Pokémon sends the nearest proposal without a second click', () => {
  const f = fixture(); f.c.selectPartyGuessAC('Pikachu');
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].event, 'party:submit-answer');
  assert.equal(f.sent[0].payload.guess, 'Pikachu');
  assert.equal(f.sent[0].payload.roundSerial, 7);
  assert.equal(f.input.value, 'Pikachu'); // Keep the choice until the server confirms.
});
test('Enter on a highlighted suggestion submits immediately', () => {
  const f = fixture(); let prevented = false;
  f.c.partyAcIndex = 0; f.list.querySelectorAll = () => [{ dataset: { name: 'Mew' } }];
  f.c.handlePartyGuessKey({ key: 'Enter', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].payload.guess, 'Mew');
});
test('typing a name and pressing Enter still submits; rejection keeps the text', () => {
  const f = fixture(); f.input.value = 'Invalid';
  f.c.handlePartyGuessKey({ key: 'Enter', preventDefault() {} });
  assert.equal(f.sent.length, 1);
  f.sent[0].ack(null, { ok: false, error: 'Choisis un Pokémon valide.' });
  assert.equal(f.input.value, 'Invalid'); assert.equal(f.button.disabled, false);
  assert.equal(f.messages.at(-1), 'Choisis un Pokémon valide.');
});
test('a pending submission cannot be doubled and a confirmed choice is recorded', () => {
  const f = fixture(); f.input.value = 'Pikachu';
  f.c.partySubmitAnswer(); f.c.partySubmitAnswer(); assert.equal(f.sent.length, 1);
  f.sent[0].ack(null, { ok: true, submitted: true, room: { ...f.room, players: [{ isSelf: true, submitted: true, proposal: 'Pikachu' }] } });
  assert.equal(f.c.partyRoomState.room.players[0].proposal, 'Pikachu');
  assert.equal(f.c.partyRoomState.room.players[0].submitted, true);
  assert.equal(f.input.value, ''); assert.equal(f.button.disabled, false);
});
