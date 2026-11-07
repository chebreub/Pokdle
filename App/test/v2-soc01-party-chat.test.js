'use strict';
// V2-SOC-01 (8/11/2026, audit GPT) : le chat de la Party Room applique le même garde-fou que la discussion entre
// amis (pas de lien, d'adresse, de @pseudo, de numéro ni d'autre appli), sans refuser un nom de Pokémon.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cleanChatText, chatMessage } = require('../lib/party-chat');
const { checkBody } = require('../lib/friend-chat');

test('Party chat refuses what the friend chat refuses', () => {
  for (const text of ['appelle-moi au 06 12 34 56 78', 'toto.kayan@gmail.com', '@kayan_12', 'ajoute moi sur snap', 'écris moi sur insta',
    'mon discord c\'est kayan', 'pokdle point fr', 'w w w . site', 'https://exemple.fr', '0 6 1 2 3 4 5 6 7 8'])
    assert.ok(cleanChatText(text).error, text);
  assert.equal(cleanChatText('appelle-moi au 06 12 34 56 78').error, '🔒 Pas de liens ni de numéros ici.');
  // Le serveur relaie seulement ce que chatMessage accepte : rien n'est envoyé aux autres.
  const room = { status: 'lobby', players: [] }, player = { id: 's1', nickname: 'Kayan' };
  assert.ok(chatMessage(room, player, { text: 'whatsapp 0612345678' }).error);
  assert.equal(chatMessage(room, player, { text: 'gg bien joué !' }).others.text, 'gg bien joué !');
  // Le même texte est refusé des deux côtés.
  for (const text of ['ajoute moi sur snap', '06 12 34 56 78']) assert.equal(checkBody(text).error, 'contact');
});

test('no Pokémon or form name is refused in the Party chat', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'pokemon.js'), 'utf8') + ';this.list = POKEMON_LIST;', ctx);
  const forms = Object.keys(require('../forms-data.json'));
  const names = Array.from(ctx.list, (p) => p.name).concat(forms);
  assert.ok(names.length > 1200);
  const refused = names.filter((n) => cleanChatText(n).error || cleanChatText('c\'est ' + n + ' ?').error);
  assert.deepEqual(refused, []);
  for (const text of ['gg wp', 'j\'ai 3 points', 'ça fait 120 pts', 'Mr. Mime ou M. Mime ?', 'Type:0', '2 sec'])
    assert.equal(cleanChatText(text).error, undefined, text);
});

test('the browser QA checks a refused message never reaches the other player', () => {
  const qa = fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'mobile_chat_quality.py'), 'utf8');
  assert.match(qa, /V2-SOC-01/);
  assert.match(qa, /a refused message reached the other player/);
});
