'use strict';
// Pages Google des 3 nouveaux jeux du 13/11 : chaque règle écrite vient du code du jeu.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GAMES } = require('../lib/seo-games');
const LL = require('../lib/last-letter');
const RT = require('../lib/rank-them');
const WS = require('../lib/weak-spots');

const page = (slug) => GAMES.find((g) => g.slug === slug);
const text = (slug) => JSON.stringify(page(slug));

test('les 3 pages existent, avec image d’aperçu et lien qui ouvre le jeu', () => {
  const links = fs.readFileSync(path.join(__dirname, '../src/script.10z.landing-links.js'), 'utf8');
  for (const [slug, fn] of [['derniere-lettre-pokemon', 'openLastLetterMode'], ['classe-les-pokemon', 'openRankThemMode'], ['faiblesses-pokemon', 'openWeakSpotsMode']]) {
    assert.ok(page(slug), slug);
    assert.equal(page(slug).group, 'play');
    assert.ok(page(slug).faq.length >= 2 && page(slug).tips.length >= 2, slug);
    assert.ok(fs.existsSync(path.join(__dirname, '../img/og/' + slug + '.jpg')), slug + ' image');
    assert.match(links, new RegExp("'" + slug + "': \\['" + fn + "'\\]"));
  }
});

test('Dernière lettre : 15 s, 2 changements de lettre, 10 points, +2 quand le Bot sèche', () => {
  const t = text('derniere-lettre-pokemon');
  assert.equal(LL.TURN_MS, 15000); assert.match(t, /15 secondes/);
  assert.equal(LL.PASSES, 2); assert.match(t, /Deux « Changer de lettre »/);
  assert.equal(LL.WIN_AT, 10); assert.match(t, /10 points pour gagner/);
  assert.match(t, /tu gagnes 2 points/);
  assert.equal(LL.letters('Ursaring').slice(-1), 'g'); assert.equal(LL.firstLetter('Gardevoir'), 'g');
});

test('Classe-les : 8 manches de 5 Pokémon, 40 points au plus, les 6 critères', () => {
  const t = text('classe-les-pokemon');
  assert.equal(RT.ROUNDS, 8); assert.equal(RT.PER_ROUND, 5); assert.match(t, /8 manches de 5 Pokémon : 40 points au plus/);
  assert.deepEqual(Object.keys(RT.CRITERIA).sort(), ['attack', 'defense', 'height', 'hp', 'speed', 'weight']);
});

test('Faiblesses éclair : 10 Pokémon, 20 s, et les exemples de la page suivent la table des types', () => {
  const t = text('faiblesses-pokemon');
  assert.equal(WS.ROUNDS, 10); assert.equal(WS.TURN_MS, 20000); assert.match(t, /10 Pokémon par partie, 20 secondes chacun/);
  assert.deepEqual(Object.fromEntries(WS.weaknesses(['Dragon', 'Vol'])), { Glace: 4, Roche: 2, Dragon: 2, 'Fée': 2 });
  assert.equal(WS.multiplier('Électrik', ['Eau', 'Vol']), 4);
  assert.equal(WS.multiplier('Sol', ['Vol']), 0);
  assert.equal(WS.multiplier('Combat', ['Spectre']), 0);
});
