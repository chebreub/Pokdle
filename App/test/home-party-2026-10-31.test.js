'use strict';
// « À plusieurs » on the home (31/10/2026): newcomers see the party games by name, and each
// one opens the Party Room with that game already chosen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
const GAMES = ['dessin', 'quiestce1v1', 'petitbac', 'dexrace'];

test('the home names the party games right after the daily, before the solo games', () => {
  const html = read('index.html');
  const hero = html.indexOf('id="daily-hero"'), back = html.indexOf('id="home-return"');
  const party = html.indexOf('id="home-party"'), discovery = html.indexOf('class="home-discovery"');
  assert.ok(hero > 0 && hero < back && back < party && party < discovery, 'order: daily, recent games, À plusieurs, mini-games');
  const band = between(html, '<section class="home-party"', '</section>');
  assert.match(band, /<h2 id="home-party-title">Joue avec tes amis, en direct<\/h2>/);
  assert.match(band, /DE 2 À 8 JOUEURS/);
  const modes = [...band.matchAll(/class="home-party-game is-(\w+)" data-action="openPartyRoomWithGame" data-args='\["(\w+)"\]'/g)];
  assert.deepEqual(modes.map((m) => m[2]), GAMES);
  for (const m of modes) assert.equal(m[1], m[2]);
  for (const title of ['Dessine-le !', 'Qui est-ce ?', 'Petit Bac', 'Course au Pokédex']) assert.match(band, new RegExp('<b>' + title.replace('?', '\\?') + '</b>'));
  // Official artworks only, with the small sprite if the artwork does not load.
  const arts = [...band.matchAll(/<img src="([^"]+)" data-fallback="([^"]+)"/g)];
  assert.equal(arts.length, 4);
  for (const [, src, fallback] of arts) {
    assert.match(src, /\/sprites\/pokemon\/other\/official-artwork\/\d+\.png$/);
    assert.match(fallback, /\/sprites\/pokemon\/\d+\.png$/);
  }
  assert.match(band, /data-action="openPartyRoomWithGame" data-args='\[""\]'>Créer un salon/);
  assert.match(band, /data-action="openPartyRoomJoin">J’ai un code/);
  assert.doesNotMatch(band, /en ligne/i, 'no live counter: a near-empty one makes the site look dead');
  assert.doesNotMatch(html, /home-path-friends/, 'the old card far down the page is gone');
});

test('every game of the band is a game the Party Room accepts, with the same name', () => {
  const server = read('server.js');
  const allowed = between(server, 'socket.on("party:set-mode"', 'room.gameMode = mode;');
  for (const game of GAMES) assert.match(allowed, new RegExp('mode !== "' + game + '"'), game);
  const labels = between(read('src/script.04.jeu-pokedex.js'), 'var modeLabels = {', '};');
  const band = read('src/script.10xf.home-party.js');
  for (const game of GAMES) {
    const label = labels.match(new RegExp(game + ': "([^"]+)"'))[1];
    assert.match(band, new RegExp(game + ": '" + label.replace('?', '\\?') + "'"), game);
  }
});

function lobby({ room = null, nickname = 'Kayan' } = {}) {
  const src04 = read('src/script.04.jeu-pokedex.js');
  const code = between(src04, 'function openPartyRoomMode(', 'function setPartyStatus(') +
    between(src04, 'function partyCreateRoom(', 'function partyJoinRoom(') + read('src/script.10xf.home-party.js');
  const elements = {
    'party-nickname': { value: '' },
    'party-join-code': { value: '', focused: false, focus() { this.focused = true; }, scrollIntoView() {} },
    'party-pending-game': { hidden: true, innerHTML: '' },
  };
  const calls = { screens: [], modes: [], emits: [] };
  const socket = {
    emit(event, payload, ack) {
      calls.emits.push([event, payload]);
      ack({ ok: true, code: 'AB3DF', room: { code: 'AB3DF', status: 'waiting', players: [] }, resumeToken: 't' });
    },
  };
  const env = {
    partyRoomState: { code: null, room, listenersBound: false, reconnecting: false },
    playerProfile: { nickname },
    window: {},
    document: { getElementById: (id) => elements[id] || null },
    ensurePartyListeners: () => socket,
    showScreen: (id) => calls.screens.push(id),
    setGlobalNavActive: () => {},
    renderPartyRoom: () => { if (!env.partyRoomState.room) env.renderPartyPendingGame(); },
    setPartyStatus: () => {},
    savePartySession: () => {},
    partyPlayerLevel: () => 7,
    partySetMode: (mode) => calls.modes.push(mode),
    escapeHtml: (s) => String(s),
  };
  const api = Function(...Object.keys(env), code +
    '; return { openPartyRoomMode, partyCreateRoom, openPartyRoomWithGame, openPartyRoomJoin, clearPartyPendingGame, renderPartyPendingGame };')(...Object.values(env));
  env.renderPartyPendingGame = api.renderPartyPendingGame;
  return { api, env, elements, calls };
}

test('a game picked on the home is shown in the lobby and applied once the room exists', () => {
  const { api, env, elements, calls } = lobby();
  api.openPartyRoomWithGame('dessin');
  assert.deepEqual(calls.screens, ['screen-party-room']);
  assert.equal(env.partyRoomState.pendingMode, 'dessin');
  assert.equal(elements['party-nickname'].value, 'Kayan', 'the profile nickname is filled in');
  assert.equal(elements['party-pending-game'].hidden, false);
  assert.match(elements['party-pending-game'].innerHTML, /<span>Jeu choisi<\/span><b>Dessine-le !<\/b><button type="button" data-action="clearPartyPendingGame"/);

  api.partyCreateRoom();
  assert.deepEqual(calls.emits.map((e) => e[0]), ['party:create-room']);
  assert.deepEqual(calls.modes, ['dessin'], 'the host\'s new room switches to the game');
  assert.equal(env.partyRoomState.pendingMode, null);
});

test('the choice can be dropped, and never sticks to a later visit of the Party Room', () => {
  const { api, env, elements, calls } = lobby({ nickname: '' });
  api.openPartyRoomWithGame('petitbac');
  assert.equal(elements['party-nickname'].value, '', 'no nickname to fill in');
  api.clearPartyPendingGame();
  assert.equal(elements['party-pending-game'].hidden, true);
  api.openPartyRoomWithGame('quiestce1v1');
  api.openPartyRoomMode();
  assert.equal(env.partyRoomState.pendingMode, null, 'the menu « Entre amis » opens the room without a choice');
  api.openPartyRoomWithGame('statclash');
  assert.equal(env.partyRoomState.pendingMode, null, 'only the band\'s games can be picked from the home');
  api.openPartyRoomWithGame('');
  api.partyCreateRoom();
  assert.deepEqual(calls.modes, [], '« Créer un salon » leaves the game to choose in the room');
  api.openPartyRoomJoin();
  assert.equal(elements['party-join-code'].focused, true, '« J’ai un code » goes straight to the code');
});

test('from inside a room, only the host switches game, and never during a party', () => {
  const room = (status, isHost) => ({ code: 'AB3DF', status, gameMode: 'guess', players: [{ isSelf: true, isHost }] });
  let run = lobby({ room: room('waiting', true) });
  run.api.openPartyRoomWithGame('dexrace');
  assert.deepEqual(run.calls.modes, ['dexrace']);
  run = lobby({ room: room('waiting', false) });
  run.api.openPartyRoomWithGame('dexrace');
  assert.deepEqual(run.calls.modes, []);
  run = lobby({ room: room('playing', true) });
  run.api.openPartyRoomWithGame('dexrace');
  assert.deepEqual(run.calls.modes, []);
  assert.deepEqual(run.calls.screens, ['screen-party-room'], 'the player is brought back to the room');
});

test('the lobby has a place for the chosen game, above « Créer mon salon »', () => {
  const html = read('index.html');
  assert.match(html, /<p id="party-pending-game" class="party-pending-game" hidden><\/p><button class="btn-blue" type="button" data-action="partyCreateRoom">/);
  assert.match(read('src/script.04.jeu-pokedex.js'), /if \(typeof renderPartyPendingGame === "function"\) renderPartyPendingGame\(\);\n\s+return;/);
  const css = read('game-shell.css');
  assert.match(css, /\.home-party \{display:grid;/);
  assert.match(css, /\.theme-dark \.home-party \{/);
  assert.match(css, /reduce-motion \.home-party-game/);
});
