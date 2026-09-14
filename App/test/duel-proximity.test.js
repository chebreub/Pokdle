'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { bestDuelProximity } = require('../lib/duel-proximity');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const client = fs.readFileSync(path.join(__dirname, '../src/script.07.delegation-party.js'), 'utf8');
function fn(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const guess = feedback => ({ name: 'Secret opponent proposal', id: 25, sprite: '/25.png', feedback });
test('proximity rewards matching and partial criteria and retains the best single attempt', () => {
  const player = { correct: false, guesses: [] };
  assert.equal(bestDuelProximity(player), 0);
  player.guesses.push(guess({ generation: 'ok' }));
  assert.equal(bestDuelProximity(player), 11);
  player.guesses.push(guess({ generation: 'ok', height: 'close' }));
  assert.equal(bestDuelProximity(player), 17);
  player.guesses.push(guess({ generation: 'ok', type1: 'ok', color: 'ok' }));
  assert.equal(bestDuelProximity(player), 33);
  player.guesses.push(guess({ generation: 'wrong' }));
  assert.equal(bestDuelProximity(player), 33);
  player.guesses = [];
  assert.equal(bestDuelProximity(player), 0);
});
test('100 percent is reserved for finding the actual Pokémon', () => {
  const feedback = Object.fromEntries(['generation', 'altForm', 'type1', 'type2', 'habitat', 'color', 'stage', 'height', 'weight'].map(key => [key, 'ok']));
  const player = { correct: false, guesses: [guess(feedback)] };
  assert.equal(bestDuelProximity(player), 99);
  player.correct = true;
  assert.equal(bestDuelProximity(player), 100);
});
test('room serialization exposes only the viewer’s guesses, including at round end', () => {
  const context = vm.createContext({ bestDuelProximity, serializePokemon: p => p });
  vm.runInContext(fn(server, 'publicRoomState'), context);
  const room = { code: 'DUEL', hostId: 'a', secretPokemon: { name: 'Mew' }, players: ['a', 'b'].map(id => ({ id, nickname: `Player ${id}`, attempts: 1, lastGuess: `Private ${id}`, guesses: [{ ...guess({ generation: 'ok' }), name: `Private ${id}` }] })) };
  for (const status of ['live', 'finished']) {
    room.status = status;
    for (const viewer of ['a', 'b', null]) {
      const state = context.publicRoomState(room, viewer);
      for (const player of state.players) {
        assert.equal(player.proximity, 11);
        if (player.id === viewer) {
          assert.equal(player.lastGuess, `Private ${viewer}`);
          assert.equal(player.guessHistory.length, 1);
          assert.equal(player.guessNames[0], `Private ${viewer}`);
        } else {
          assert.equal(player.lastGuess, null);
          assert.equal(player.guessHistory.length, 0);
          assert.equal(player.guessNames.length, 0);
          assert.doesNotMatch(JSON.stringify(player), /Private|sprite/);
        }
      }
      assert.equal(state.targetRevealed?.name || null, status === 'finished' ? 'Mew' : null);
    }
  }
});
test('opponent cards and attempts render only aggregate proximity even with legacy guess names', () => {
  const ids = ['multiplayer-players', 'multiplayer-attempts-shell', 'multiplayer-my-attempts-body', 'multiplayer-my-attempts-wrap', 'multiplayer-my-attempts-empty', 'multiplayer-opponent-attempts'];
  const elements = Object.fromEntries(ids.map(id => [id, { innerHTML: '', classList: { add() {}, remove() {} } }]));
  const context = vm.createContext({ document: { getElementById: id => elements[id] }, escapeHtml: String, multiplayerLiveState: { room: { code: 'DUEL', status: 'live', players: [{ id: 'a', isSelf: true, guesses: [], guessHistory: [] }, { id: 'b', nickname: 'Rival', attempts: 2, proximity: 56, lastGuess: 'NEVER_SHOW_ME', guessNames: ['NEVER_SHOW_ME'] }] } } });
  vm.runInContext(['multiplayerProximityValue', 'buildMultiplayerProximityHtml', 'renderMultiplayerPlayers', 'renderMultiplayerAttempts'].map(name => fn(client, name)).join('\n'), context);
  context.renderMultiplayerPlayers(); context.renderMultiplayerAttempts();
  const html = Object.values(elements).map(element => element.innerHTML).join('');
  assert.doesNotMatch(html, /NEVER_SHOW_ME/);
  assert.match(html, /aria-valuenow="56"/);
  assert.match(html, /2 essais/);
});
