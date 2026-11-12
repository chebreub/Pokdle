'use strict';
// 💡 Coup de pouce (12/11) : le serveur n'envoie l'aide qu'au bon essai, jamais avant.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createGuessGames, HELP } = require('../lib/verified-guess');
const wordle = require('../lib/daily-wordle');

const catalog = [
  { id: 1, name: 'Bulbizarre', type1: 'Plante', type2: 'Poison', gen: 1, height: 0.7, weight: 6.9, habitat: 'Prairie', color: 'Vert', stage: 1 },
  ...Array.from({ length: 20 }, (_, i) => ({ id: i + 2, name: 'Pokémon ' + (i + 2), type1: 'Eau', gen: 1, height: 1, weight: 10, habitat: 'Mer', color: 'Bleu', stage: 1 })),
];

function play(mode, count) {
  const games = createGuessGames(catalog, () => 0);
  const s = { mode, gens: [1], recent: [] };
  games.init(s);
  assert.equal(s.secretId, 1);
  for (let i = 0; i < count; i++) games.answer(s, i + 2);
  return { games, s };
}

test('illimité : silhouette au 8e essai, 1re lettre au 12e, rien avant', () => {
  assert.deepEqual(HELP.normal, { silhouette: 8, letter: 12 });
  assert.deepEqual(play('normal', 7).games.view(play('normal', 7).s).help, {});
  assert.deepEqual(play('normal', 8).games.view(play('normal', 8).s).help, { silhouette: true });
  const { games, s } = play('normal', 12);
  assert.deepEqual(games.view(s).help, { silhouette: true, letter: 'B' });
});

test('Stat Mystère : génération au 3e essai, silhouette au 7e', () => {
  assert.deepEqual(play('mystery', 2).games.view(play('mystery', 2).s).help, {});
  assert.deepEqual(play('mystery', 3).games.view(play('mystery', 3).s).help, { gen: 1 });
  assert.deepEqual(play('mystery', 7).games.view(play('mystery', 7).s).help, { silhouette: true, gen: 1 });
});

test('les autres jeux de devinette n’ont pas d’aide en plus', () => {
  const { games, s } = play('silhouette', 12);
  assert.equal(games.view(s).help, undefined);
});

test('la silhouette passe par une adresse opaque, envoyée seulement une fois méritée', () => {
  const src = fs.readFileSync(path.join(__dirname, '../lib/verified-arcade.js'), 'utf8');
  assert.match(src, /if \(v\.help && v\.help\.silhouette && s\.helpImage\) v\.helpImage = s\.helpImage;/);
  assert.match(src, /else if \(guessGames\.HELP\[s\.mode\]\) s\.helpImage = '\/api\/arcade\/art\/' \+ imageToken\(/);
});

test('Wordle du jour : type après 3 lignes, génération après 5 (même aide pour tous)', () => {
  assert.deepEqual(wordle.WORDLE_HELP, { type: 3, gen: 5 });
  const src = fs.readFileSync(path.join(__dirname, '../lib/daily-wordle.js'), 'utf8');
  assert.match(src, /row\.guessed\.length>=WORDLE_HELP\.type\|\|finished\?\{help:\{type1:target\.type1/);
  assert.match(src, /row\.guessed\.length>=WORDLE_HELP\.gen\|\|finished\?\{gen:/);
});

test('page : dernier essai en haut, « Voir la réponse », Wordle illimité dans « Deviner »', () => {
  const js = fs.readFileSync(path.join(__dirname, '../src/script.10zzzzh.coup-de-pouce.js'), 'utf8');
  assert.match(js, /body\.insertBefore\(body\.lastElementChild, body\.firstElementChild\)/);
  assert.match(js, /'👀 Voir la réponse'/);
  assert.match(js, /CDP_AT = \{ normal: \{ silhouette: 8, letter: 12 \}, mystery: \{ gen: 3, silhouette: 7 \} \}/);
  const club = fs.readFileSync(path.join(__dirname, '../src/script.09.club.js'), 'utf8');
  assert.match(club, /guess: \["startNormalGame", "startWordleTraining",/);
});
