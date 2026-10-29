'use strict';
// « Dessine-le ! » (29/10): only the drawer and the server know the Pokémon; the others guess the drawing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../lib/party-dessin');

const catalogue = [
  { id: 25, name: 'Pikachu', type1: 'Électrik', type2: null, gen: 1 },
  { id: 172, name: 'Pichu', type1: 'Électrik', type2: null, gen: 2 },
  { id: 280, name: 'Tarsal', type1: 'Psy', type2: 'Fée', gen: 3 },
  { id: 291, name: 'Ninjask', type1: 'Insecte', type2: 'Vol', gen: 3 },
  { id: 448, name: 'Lucario', type1: 'Combat', type2: 'Acier', gen: 4 },
  { id: 10100, name: 'Raichu d’Alola', type1: 'Électrik', type2: 'Psy', gen: 7, isAltForm: true },
];
const resolve = (room, name) => catalogue.find((p) => p.name.toLowerCase() === String(name).toLowerCase()) || null;
const rnd = () => 0;

function room(n = 3) {
  const r = { code: 'ABCDE', status: 'waiting', roundNumber: 1, selectedGens: [1, 2, 3, 4], players: [] };
  for (let i = 0; i < n; i++) r.players.push({ id: 's' + i, nickname: ['Kayan', 'Léa', 'Tom', 'Inès'][i], connected: true, score: 0 });
  r.dessinOrder = r.players.map((p) => p.id);
  return r;
}

test('three choices, one per level when possible, never an alternative form', () => {
  const r = room();
  D.startDessinRound(r, catalogue, rnd, 1000);
  const opts = r.dessin.options;
  assert.equal(opts.length, 3);
  assert.deepEqual(opts.map((o) => o.level), ['easy', 'medium', 'hard']);
  assert.equal(new Set(opts.map((o) => o.id)).size, 3);
  assert.ok(opts.every((o) => o.id !== 10100));
  assert.equal(D.pokemonLevel({ id: 25, gen: 1 }), 'easy');
  assert.equal(D.pokemonLevel({ id: 280, gen: 3 }), 'medium');
  assert.equal(D.pokemonLevel({ id: 906, gen: 9 }), 'easy');
  assert.equal(D.pokemonLevel({ id: 950, gen: 9 }), 'hard');
});

test('the drawer changes every round, and only the drawer sees the choices and the secret', () => {
  const r = room();
  D.startDessinRound(r, catalogue, rnd, 1000);
  assert.equal(r.dessin.drawerId, 's0');
  assert.ok(D.publicDessin(r, 's0', false, 1000).options.length === 3);
  assert.equal(D.publicDessin(r, 's1', false, 1000).options, null);
  D.chooseDessin(r, r.players[0], 1, r.roundSerial, 2000);
  const mine = D.publicDessin(r, 's0', false, 2000), theirs = D.publicDessin(r, 's1', false, 2000);
  assert.equal(mine.secret.name, r.dessin.target.name);
  assert.equal(theirs.secret, null);
  assert.equal(theirs.answer, null);
  assert.ok(!JSON.stringify(theirs).includes(r.dessin.target.name), 'the name never reaches the guessers');
  assert.match(theirs.pattern, /^_+$/);
  r.roundNumber = 2; D.startDessinRound(r, catalogue, rnd, 3000);
  assert.equal(r.dessin.drawerId, 's1');
  r.players[2].connected = false; r.roundNumber = 3; D.startDessinRound(r, catalogue, rnd, 4000);
  assert.equal(r.dessin.drawerId, 's0', 'a disconnected friend is skipped');
});

test('no choice in time: the easy Pokémon is drawn; nobody else can choose', () => {
  const r = room();
  D.startDessinRound(r, catalogue, rnd, 1000);
  assert.ok(D.chooseDessin(r, r.players[1], 0, r.roundSerial).error);
  D.chooseDessin(r, null, 0, undefined, 11000);
  assert.equal(r.dessin.phase, 'draw');
  assert.equal(r.dessin.level, 'easy');
  assert.equal(r.dessin.drawEndsAt, 11000 + D.DRAW_MS);
});

test('strokes: only the drawer draws, coordinates stay on the page, undo removes the whole last stroke', () => {
  const r = room();
  D.startDessinRound(r, catalogue, rnd, 1000);
  D.chooseDessin(r, r.players[0], 0, r.roundSerial, 1000);
  const s = r.roundSerial;
  assert.ok(D.addDessinPiece(r, r.players[1], { k: 1, c: 0, s: 1, p: [1, 2, 3, 4] }, s, 2000).error);
  assert.ok(D.addDessinPiece(r, r.players[0], { k: 1, c: 0, s: 1, p: [1, 2, 3, 4000] }, s, 2000).error);
  assert.ok(D.addDessinPiece(r, r.players[0], { k: 1, c: 9, s: 1, p: [1, 2] }, s, 2000).error);
  assert.ok(D.addDessinPiece(r, r.players[0], { k: 1, c: 0, s: 1, p: [1, 2, 3, 4] }, s - 1, 2000).error, 'an old round is refused');
  D.addDessinPiece(r, r.players[0], { k: 1, c: 0, s: 1, p: [1, 2, 3, 4] }, s, 2000);
  D.addDessinPiece(r, r.players[0], { k: 2, c: 3, s: 0, p: [10, 10, 20, 20] }, s, 2000);
  D.addDessinPiece(r, r.players[0], { k: 2, c: 3, s: 0, p: [20, 20, 30, 30] }, s, 2000);
  assert.equal(r.dessin.strokes.length, 3);
  assert.equal(D.undoDessin(r, r.players[0], s, 2000).undone, 2);
  assert.deepEqual(r.dessin.strokes.map((p) => p.k), [1]);
  assert.ok(D.clearDessin(r, r.players[0], s, 2000).cleared);
  assert.equal(r.dessin.strokes.length, 0);
  assert.ok(D.addDessinPiece(r, r.players[0], { k: 3, c: 0, s: 1, p: [1, 2] }, s, 1000 + D.DRAW_MS).error, 'no drawing after the clock');
  const big = { k: 4, c: 0, s: 1, p: Array.from({ length: 400 }, () => 5) };
  let error = null;
  for (let i = 0; i < 60 && !error; i++) error = D.addDessinPiece(r, r.players[0], big, s, 3000).error;
  assert.match(error || '', /plein/);
});

test('guesses: faster finds pay more, the drawer earns for each friend, the round ends when all have found', () => {
  const r = room();
  D.startDessinRound(r, catalogue, rnd, 0);
  D.chooseDessin(r, r.players[0], 0, r.roundSerial, 0);
  const target = r.dessin.target.name, s = r.roundSerial;
  assert.equal(target, 'Pikachu');
  assert.ok(D.submitDessinGuess(r, r.players[0], 'Pikachu', s, resolve, 1000).error, 'the drawer cannot guess');
  const near = D.submitDessinGuess(r, r.players[1], 'Pichu', s, resolve, 1000);
  assert.equal(near.correct, false); assert.equal(near.close, true);
  const first = D.submitDessinGuess(r, r.players[1], 'Pikachu', s, resolve, 8000);
  assert.equal(first.correct, true); assert.equal(first.ended, false);
  const late = D.submitDessinGuess(r, r.players[2], 'Pikachu', s, resolve, 70000);
  assert.equal(late.ended, true);
  assert.ok(first.gained > late.gained, 'the first and faster finder earns more');
  assert.equal(r.players[0].score, 60, 'the drawer earns 30 per friend on an easy Pokémon');
  assert.ok(D.submitDessinGuess(r, r.players[1], 'Pikachu', s, resolve, 9000).already);
  const pub = D.publicDessin(r, 's2', false, 70000);
  assert.ok(pub.guesses.filter((g) => g.correct).every((g) => g.name === null), 'a right answer is never written in the feed');
  assert.equal(D.publicDessin(r, 's2', true, 70000).answer, 'Pikachu');
});

test('hints open with time: the type after 30 s, the generation after 50 s', () => {
  const r = room();
  D.startDessinRound(r, catalogue, rnd, 0);
  D.chooseDessin(r, r.players[0], 2, r.roundSerial, 0);
  const at = (ms) => D.publicDessin(r, 's1', false, ms);
  assert.equal(at(1000).typeHint, null); assert.equal(at(1000).genHint, null);
  const t = r.dessin.target;
  assert.equal(at(D.TYPE_HINT_MS).typeHint, [t.type1, t.type2].filter(Boolean).join(' / '));
  assert.equal(at(D.TYPE_HINT_MS).genHint, null);
  assert.equal(at(D.GEN_HINT_MS).genHint, t.gen);
  assert.equal(D.namePattern('M. Mime'), '_. ____');
});

test('a refresh keeps the drawer, the finds and the feed', () => {
  const r = room();
  D.startDessinRound(r, catalogue, rnd, 0);
  D.chooseDessin(r, r.players[0], 0, r.roundSerial, 0);
  D.submitDessinGuess(r, r.players[1], 'Pikachu', r.roundSerial, resolve, 1000);
  D.rekeyDessin(r, 's0', 'n0'); D.rekeyDessin(r, 's1', 'n1');
  assert.equal(r.dessin.drawerId, 'n0');
  assert.ok(r.dessin.found.n1 && !r.dessin.found.s1);
  assert.equal(r.dessinOrder[0], 'n0');
  r.players[0].id = 'n0'; r.players[0].connected = false; r.players[0].reconnectUntil = 5000;
  assert.equal(D.drawerGone(r, 4000), false);
  assert.equal(D.drawerGone(r, 6000), true);
});

test('server: the mode is allowed, pieces are relayed with a rate limit, hints refresh the room', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(server, /mode !== "dexrace" && mode !== "dessin"\) return respond/);
  assert.match(server, /socket\.on\("party:dessin-draw"/);
  assert.match(server, /"party-draw":\s+\{ max: 160, ipMax: 400/);
  assert.match(server, /for \(const other of room\.players\) if \(other\.connected && other\.id !== socket\.id\) io\.to\(other\.id\)\.emit\("party:dessin-draw", relay\)/);
  assert.match(server, /dessinParty\.rekeyDessin\(room, previousId, socket\.id\)/);
  assert.match(server, /dessinParty\.drawerGone\(room\)/);
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /id="party-mode-dessin"[^>]*data-args='\["dessin"\]'/);
  assert.match(html, /<section id="party-dessin" class="party-dessin hidden"/);
});
