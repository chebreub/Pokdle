'use strict';
// Défis et messages visibles (01/11/2026): a red count on the account button and on « Amis », a card at
// the top of the home while a challenge waits, the challenges at the top of the Party Room, and
// « Mes défis » / « Mes messages » first in the account menu.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const src = read('src/script.10xs.inbox-visibility.js');

test('what counts: challenges waiting for me, news of mine, unread messages', () => {
  const future = new Date(Date.now() + 86400000).toISOString(), past = new Date(Date.now() - 1000).toISOString();
  const ctx = {
    window: { __pokedleAuthed: true }, document: { addEventListener() {} },
    playerMessagesQueue: [{ id: 1 }],
    pcState: { list: [
      { id: 1, incoming: true, status: 'open', expiresAt: future, seen: true },
      { id: 2, incoming: true, status: 'open', expiresAt: past, seen: false },
      { id: 3, incoming: false, status: 'won', seen: false },
      { id: 4, incoming: false, status: 'open', expiresAt: future, seen: false },
      { id: 5, incoming: false, status: 'lost', seen: true },
    ] },
  };
  ctx.pcOpen = (c) => c && c.status === 'open' && Date.parse(c.expiresAt) > Date.now();
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  assert.equal(JSON.stringify(ctx.inboxCounts()), JSON.stringify({ duels: 2, messages: 1, friends: 0, chat: 0 }), 'an expired one, a pending one sent and old news do not count');
  ctx.window.__pokedleAuthed = false;
  assert.equal(JSON.stringify(ctx.inboxCounts()), JSON.stringify({ duels: 0, messages: 0, friends: 0, chat: 0 }), 'nothing for a guest');
});

test('where it shows: account button, Amis tab and Entre amis, home card, Party Room, menu first', () => {
  // Friend requests (script.10xu.friends.js) and unread chat (script.10xv.friend-chat.js) count on the same dots.
  assert.match(src, /inboxSetDot\(document\.querySelector\('#account-area \.account-chip'\), n\.duels \+ n\.messages \+ \(n\.friends \|\| 0\) \+ \(n\.chat \|\| 0\)\);/);
  assert.match(src, /inboxSetDot\(document\.querySelector\('#mobile-tabbar \[data-tab="social"\]'\), n\.duels \+ \(n\.friends \|\| 0\) \+ \(n\.chat \|\| 0\)\);/);
  assert.match(src, /inboxSetDot\(document\.getElementById\('nav-social'\), n\.duels \+ \(n\.friends \|\| 0\) \+ \(n\.chat \|\| 0\)\);/);
  assert.match(src, /home\.insertBefore\(box, home\.firstChild\);/, 'the card sits at the top of the home');
  assert.match(src, /lobby\.parentNode\.insertBefore\(box, lobby\);/, 'in the Party Room, above the lobby, in its flow');
  assert.match(src, /if \(!window\.__pokedleAuthed \|\| inRoom \|\| lobby\.classList\.contains\('hidden'\)\)/, 'never inside a room being played');
  assert.doesNotMatch(read('game-shell.css').split('Défis et messages visibles')[1], /\.party-duels[^{]*\{[^}]*position:\s*fixed/, 'nothing floats over the Party Room');
  const menu = read('src/script.07.delegation-party.js');
  const defis = menu.indexOf(`data-args='["defis"]'`), messages = menu.indexOf(`data-args='["messages"]'`), profile = menu.indexOf(`data-args='["profile"]'`);
  assert.ok(defis > 0 && defis < messages && messages < profile, 'défis, then messages, then the profile');
});
