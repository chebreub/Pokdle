'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const chat = require('../lib/party-chat');

test('a chat message is short plain text, without links', () => {
  assert.deepEqual(chat.cleanChatText('  salut   la\nteam  '), { text: 'salut la team' });
  assert.ok(chat.cleanChatText('   ').error);
  assert.ok(chat.cleanChatText(null).error);
  assert.ok(chat.cleanChatText('x'.repeat(chat.MAX_LENGTH + 1)).error);
  assert.equal(chat.cleanChatText('x'.repeat(chat.MAX_LENGTH)).text.length, chat.MAX_LENGTH);
  for (const link of ['va sur https://site.example', 'www.pub.com', 'mon-site.fr/promo', 'discord.gg/abc']) assert.ok(chat.cleanChatText(link).error, link);
  assert.equal(chat.cleanChatText('ok... bien joué').text, 'ok... bien joué', 'dots are not links');
  assert.equal(chat.cleanChatText('a‮b\u0007c').text, 'a b c', 'no invisible or reversing characters');
});

test('the answer is spotted with or without accents, inside other words', () => {
  assert.ok(chat.namesAnswer('cest PIKACHUUU !!', ['Pikachu']));
  assert.ok(chat.namesAnswer('larmeleon facile', ['Larméléon']));
  assert.ok(chat.namesAnswer('m-e-w ?', ['Mew']));
  assert.ok(!chat.namesAnswer('un œuf avec des oreilles', ['Pikachu']));
  assert.ok(!chat.namesAnswer('ok', ['Ab']), 'names shorter than 3 letters are ignored');
});

test('only a round in progress has answers to hide, whatever the mini-game', () => {
  const name = (id) => ({ 25: 'Pikachu', 133: 'Évoli' }[id] || null);
  assert.deepEqual(chat.hiddenAnswers({ status: 'waiting', target: { id: 25, name: 'Pikachu' }, players: [] }, name), []);
  assert.deepEqual(chat.hiddenAnswers({ status: 'playing', target: { id: 25, name: 'Pikachu' }, players: [] }, name), ['Pikachu']);
  assert.deepEqual(chat.hiddenAnswers({ status: 'playing', target: { id: 0, name: '' }, players: [] }, name), [], 'Petit Bac: nothing to hide');
  assert.deepEqual(chat.hiddenAnswers({ status: 'playing', target: { name: 'Combo de types', sprite: null }, players: [] }, name), []);
  assert.deepEqual(chat.hiddenAnswers({ status: 'playing', dessin: { target: { name: 'Larméléon' } }, players: [] }, name), ['Larméléon']);
  assert.deepEqual(chat.hiddenAnswers({ status: 'playing', players: [{ quiSecretId: 25 }, { quiSecretId: 133 }, {}] }, name), ['Pikachu', 'Évoli']);
});

test('a message naming the answer reaches the others hidden; the sender keeps their text', () => {
  const room = { status: 'playing', dessin: { target: { name: 'Larméléon' } }, players: [] };
  const player = { id: 's1', nickname: 'Léa' };
  const hidden = chat.chatMessage(room, player, { text: 'c’est larméléon !' }, { now: 5, id: 7 });
  assert.deepEqual(hidden.others, { id: 7, playerId: 's1', nickname: 'Léa', at: 5, masked: true });
  assert.equal(hidden.mine.text, 'c’est larméléon !');
  assert.equal(hidden.mine.masked, true);
  const plain = chat.chatMessage(room, player, { text: 'joli dessin' }, { now: 5, id: 8 });
  assert.equal(plain.others.text, 'joli dessin');
  assert.equal(plain.others.masked, undefined);
  assert.equal(chat.chatMessage({ ...room, status: 'waiting' }, player, { text: 'c’était larméléon' }).others.text, 'c’était larméléon', 'after the round, everyone can talk about it');
  assert.equal(chat.chatMessage(room, player, { reaction: '🔥' }).others.reaction, '🔥');
  assert.ok(chat.chatMessage(room, player, { reaction: '💩' }).error);
  assert.ok(chat.chatMessage(room, player, { text: 'www.spam.com' }).error);
  assert.ok(chat.chatMessage(null, player, { text: 'hey' }).error);
});

test('the chat panel escapes what players write and hides the masked message for others', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/script.10xe.party-chat.js'), 'utf8');
  const fn = src.slice(src.indexOf('function partyChatMessageHtml'), src.indexOf('function renderPartyChat'));
  const c = { escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
  vm.createContext(c);
  vm.runInContext(fn, c);
  const other = c.partyChatMessageHtml({ nickname: '<b>Tom</b>', text: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(other, /<img|<b>Tom/);
  assert.match(other, /&lt;img/);
  assert.match(c.partyChatMessageHtml({ nickname: 'Léa', masked: true }), /Message caché : il contenait la réponse/);
  const mine = c.partyChatMessageHtml({ nickname: 'Kayan', text: 'pikachu', masked: true, mine: true });
  assert.match(mine, /<i>Moi<\/i>pikachu/);
  assert.match(mine, /Caché aux autres/);
  assert.match(c.partyChatMessageHtml({ nickname: 'Tom', reaction: '😂' }), /pchat-emoji">😂/);
});
