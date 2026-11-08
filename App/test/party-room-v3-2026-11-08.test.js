// 🎉 Party Room version C et « Mes amis » en liste (8/11/2026, « go les 2 »).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const SRC = read('src/script.10xzzu.party-lobby-v3.js');
const FR = read('src/script.10xu.friends.js');
const CSS = read('game-shell.css');
const P_CSS = CSS.slice(CSS.indexOf('/* 🎉 Party Room, version C'));

test('the original fields and buttons are reused, never duplicated (the QA scripts drive them)', () => {
  assert.doesNotMatch(SRC, /<button[^>]*data-action="party(Create|Join)Room"|<input[^>]*id="party-(nickname|join-code)"/, 'no second create / join control');
  assert.match(SRC, /querySelector\('#party-lobby \.party-entry-panel \[data-action="partyCreateRoom"\]'\)/);
  assert.match(SRC, /lobby\.querySelectorAll\('\.party-duels-grid \.party-duel-link'\)/, 'the 4 two-player buttons are moved, not copied');
  assert.match(SRC, /duo\.appendChild\(b\)/);
  assert.match(SRC, /pl3\.appendChild\(entry\)/);
});

test('picking a group game uses the same pending game as the home', () => {
  for (const key of ['dessin', 'quiestce1v1', 'petitbac', 'dexrace']) assert.match(SRC, new RegExp("key: '" + key + "'"));
  assert.match(SRC, /partyRoomState\.pendingMode = key; if \(typeof renderPartyPendingGame === 'function'\) renderPartyPendingGame\(\);/);
  assert.match(SRC, /clearPartyPendingGame\(\)/, 'touching it again drops it');
  assert.match(SRC, /var label = g \? '▶ Lancer ' \+ g\.name : 'Créer mon salon';/);
  assert.doesNotMatch(SRC, /pendingMode = 'dessin'/, 'no game is forced by default');
});

test('the lobby clutter is hidden, the room itself is untouched', () => {
  assert.match(P_CSS, /\.party-lobby\.pl3-on>:is\(\.party-welcome,\.party-duels\)\{display:none\}/);
  assert.match(P_CSS, /:has\(#party-lobby\.pl3-on:not\(\.hidden\)\) \.party-hero\{display:none\}/);
  assert.doesNotMatch(P_CSS, /#party-joined/);
});

test('friends: one line per friend, the line opens the chat, the avatar opens the card', () => {
  assert.match(FR, /class="fr-ava" data-action="openPlayerCard"/);
  assert.match(FR, /data-action="' \+ \(chatOn \? 'openFriendChat' : 'openPlayerCard'\) \+ '"/);
  assert.match(FR, /'<span class="fr-when">' \+ escapeHtml\(frWhen\(/);
  assert.match(FR, /var FR_SHOWN = 6;/);
  assert.match(CSS, /\.fr-v3-list:not\(\.is-all\) \.fr-row:nth-of-type\(n\+7\)\{display:none\}/);
  assert.match(FR, /data-action="frShowTab" data-args=\\'\["party"\]\\'>Créer un salon/);
});

test('message times are in Paris time', () => {
  assert.match(FR, /timeZone: 'Europe\/Paris', hour: '2-digit', minute: '2-digit'/);
  assert.match(FR, /return 'hier';/);
});
