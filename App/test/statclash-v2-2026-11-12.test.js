'use strict';
// Stat Clash 1v1, habillage (12/11) : stats en français (site et 1v1 en ligne), artwork officiel, tableau des scores,
// révélation qui dit qui gagne la manche. Les règles et les calculs ne changent pas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = fs.readFileSync(path.join(__dirname, '../src/script.01.core.js'), 'utf8');
const clash = fs.readFileSync(path.join(__dirname, '../src/script.02.statclash.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../game-shell.css'), 'utf8');
const disc = fs.readFileSync(path.join(__dirname, '../src/script.10xzt.discovery-card.js'), 'utf8');

test('les 6 stats sont nommées en français, dans le site et sur le serveur (1v1 en ligne)', () => {
  for (const label of ['"Attaque"', '"Défense"', '"Attaque Spé."', '"Défense Spé."', '"Vitesse"']) {
    assert.ok(core.includes('label: ' + label), label + ' (site)');
  }
  assert.match(server, /attack: "Attaque",\s*defense: "Défense",\s*spAttack: "Attaque Spé\.",\s*spDefense: "Défense Spé\.",\s*speed: "Vitesse"/);
  assert.doesNotMatch(core, /label: "Special Attack"/);
  // Les clés internes ne changent pas.
  assert.match(core, /\{ key: "spAttack", label:/);
});

test('artwork officiel une fois le Pokémon tiré, petits sprites pendant le tirage', () => {
  assert.match(clash, /state\.phase !== "rolling" && typeof pokedexDetailArtwork === "function"/);
  assert.match(css, /\.stat-clash-sprite-wrap img\.is-artwork\{/);
});

test('tableau des scores et verdict de la manche', () => {
  assert.match(clash, /<div class="stat-clash-scoreboard">/);
  assert.match(clash, /\$\{scoreboardHtml\}\$\{announcerHtml\}<div class="stat-clash-board">/);
  assert.match(clash, /Égalité sur cette manche/);
  assert.match(clash, /remporte la manche/);
});

test('Évolution et Ordre Pokédex ne sont plus proposés par la carte « À découvrir » (retirés le 13/11)', () => {
  assert.doesNotMatch(disc, /startEvolutionChainGame|startPokedexOrderGame/);
});
