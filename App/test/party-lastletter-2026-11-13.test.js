'use strict';
// 🔗 Dernière lettre en Party Room : chacun son tour, un mauvais nom ne coûte rien, temps écoulé = −1 ❤️ et nouvelle
// lettre pour le suivant, jamais deux fois le même, le dernier en vie gagne ; branché dans le salon (serveur et page).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const LL = require('../lib/party-lastletter');
const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '../pokemon.js'), 'utf8').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const key = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

function room(n = 3, opts) {
  const r = { code: 'ABCDE', status: 'waiting', selectedGens: [1, 2, 3, 4, 5, 6, 7, 8, 9], roundSerial: 0,
    players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, nickname: 'J' + i, connected: true, score: 0 })) };
  if (opts) assert.equal(LL.setLastLetterOptions(r, opts).ok, true);
  return r;
}
const answer = (r) => {
  const ll = r.lastLetter, used = new Set(ll.used);
  return catalogue.find((p) => key(p.name)[0] === ll.letter && !used.has(p.id) && p.id <= 1025).name;
};
const send = (r, id, guess, now) => LL.submitLastLetter(r, r.players.find((p) => p.id === id), { code: r.code, roundSerial: r.roundSerial, guess }, now);

test('réglages de l’hôte : 10 / 15 / 20 s et 1 / 2 / 3 ❤️, 15 s et 2 ❤️ par défaut', () => {
  const r = room();
  assert.deepEqual(LL.options(r), { turnSec: 15, lives: 2 });
  assert.equal(LL.setLastLetterOptions(r, { turnSec: 12, lives: 2 }).error, 'Réglage inconnu.');
  assert.equal(LL.setLastLetterOptions(r, { turnSec: 20, lives: 3 }).ok, true);
  assert.deepEqual(LL.options(r), { turnSec: 20, lives: 3 });
});

test('chacun son tour : mauvais nom sans pénalité, bon nom = la lettre suivante et le joueur suivant', () => {
  const r = room(3), t = 1000;
  LL.startLastLetter(r, catalogue, () => 0.3, t);
  const ll = r.lastLetter;
  assert.equal(ll.turnId, 'p0'); assert.equal(ll.turnMs, 15000);
  assert.equal(send(r, 'p1', answer(r), t).error, 'Ce n’est pas ton tour.');
  assert.match(send(r, 'p0', 'Pas un Pokémon', t).error, /inconnu/);
  const wrongLetter = catalogue.find((p) => key(p.name)[0] !== ll.letter).name;
  assert.match(send(r, 'p0', wrongLetter, t).error, /Il faut un Pokémon en/);
  assert.equal(ll.hearts.p0, 2, 'un mauvais nom ne coûte rien');
  const name = answer(r);
  assert.equal(send(r, 'p0', name.toUpperCase(), t + 2000).ok, true, 'majuscules et accents ignorés');
  assert.equal(ll.turnId, 'p1'); assert.equal(ll.given.p0, 1); assert.equal(r.players[0].score, 1);
  assert.equal(ll.endsAt, t + 2000 + 15000);
  // Le même Pokémon ne revient jamais.
  const again = catalogue.find((p) => p.name === name);
  ll.letter = key(again.name)[0];
  assert.match(send(r, 'p1', name, t + 3000).error, /déjà dans la chaîne/);
  // Trop tard : refusé (le serveur, lui, compte le tour comme perdu).
  assert.equal(send(r, 'p1', answer(r), ll.endsAt + LL.GRACE_MS + 1).error, 'Trop tard pour ce tour.');
});

test('temps écoulé : −1 ❤️, nouvelle lettre pour le suivant ; le dernier en vie gagne, puis les éliminés', () => {
  const r = room(3, { turnSec: 10, lives: 1 }), t = 5000;
  LL.startLastLetter(r, catalogue, () => 0.5, t);
  const ll = r.lastLetter;
  send(r, 'p0', answer(r), t);
  assert.equal(LL.timeoutLastLetter(r, () => 0.1, t + 11000).ended, false);
  assert.equal(ll.hearts.p1, 0); assert.deepEqual(ll.out, ['p1']);
  assert.equal(ll.turnId, 'p2', 'le joueur suivant');
  assert.equal(ll.feed.at(-1).kind, 'timeout');
  send(r, 'p2', answer(r), t + 12000);
  assert.equal(ll.turnId, 'p0', 'un éliminé ne joue plus');
  assert.equal(LL.timeoutLastLetter(r, () => 0.1, t + 30000).ended, true);
  assert.deepEqual(ll.ranking, ['p2', 'p0', 'p1']);
  const view = LL.publicLastLetter(r, t + 30000);
  assert.equal(view.endedReason, 'last'); assert.equal(view.players.find((p) => p.id === 'p1').out, true);
  assert.equal(view.traps[0].names[0], 'J1');
});

test('jamais une lettre sans Pokémon restant : nouvelle lettre annoncée', () => {
  const r = room(2), t = 0;
  r.selectedGens = [1];
  LL.startLastLetter(r, catalogue, () => 0, t);
  const ll = r.lastLetter;
  // On épuise les Pokémon de Kanto qui commencent par la dernière lettre de Pikachu (« u ») : il n'y en a aucun.
  ll.letter = 'p';
  assert.equal(send(r, 'p0', 'Pikachu', t).ok, true);
  assert.notEqual(ll.letter, 'u');
  assert.equal(ll.feed.at(-1).kind, 'letter'); assert.equal(ll.feed.at(-1).from, 'u');
});

test('un joueur qui quitte : son tour passe ; seul restant = fin ; reconnexion = même place', () => {
  const r = room(3), t = 0;
  LL.startLastLetter(r, catalogue, () => 0.2, t);
  LL.rekeyLastLetter(r, 'p0', 'p0b'); r.players[0].id = 'p0b';
  assert.equal(r.lastLetter.turnId, 'p0b');
  r.players.splice(0, 1);
  assert.equal(LL.departLastLetter(r, () => 0.2, t + 100).ended, false);
  assert.equal(r.lastLetter.turnId, 'p1');
  r.players.splice(0, 1);
  assert.equal(LL.departLastLetter(r, () => 0.2, t + 200).ended, true);
  assert.deepEqual(r.lastLetter.ranking[0], 'p2');
});

test('le salon connaît le jeu : serveur, page, réglages, stats et liste des jeux', () => {
  const server = read('server.js');
  assert.match(server, /mode !== "lastletter"\) return respond\(ack, \{ ok: false, error: "Ce mode n'est pas disponible\." \}\)/);
  assert.match(server, /socket\.on\("party:lastletter-options"/);
  assert.match(server, /if \(mode === "lastletter"\) return 1;/);
  assert.match(server, /lastLetterParty\.timeoutLastLetter\(room\)/);
  assert.match(server, /lastLetterParty\.rekeyLastLetter\(room, previousId, socket\.id\)/);
  assert.match(read('index.html'), /id="party-mode-lastletter"/);
  assert.match(read('index.html'), /id="party-lastletter"/);
  assert.match(read('lib/usage-metrics.js'), /"party:start:lastletter":"Dernière lettre"/);
  assert.match(read('src/script.10xzzu.party-lobby-v3.js'), /key: 'lastletter'/);
  assert.match(read('src/script.10zzl.party-tiles.js'), /lastletter: \['#/);
  assert.match(read('src/script.10zzzzc.party-salon-v2.js'), /lastletter: \['#/);
  const page = read('src/script.10zzzzn.party-lastletter.js');
  assert.match(page, /party:submit-answer/);
  assert.match(page, /La case de réponse n'est refaite qu'au changement de tour/);
});
