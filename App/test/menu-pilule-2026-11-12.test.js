'use strict';
// Menu « Pilule » (12/11) : sur téléphone, « Jouer » au centre (Accueil · Pokédex · Jouer · Amis · Profil),
// sans dépasser de la barre ; sur PC, les liens dans une pilule claire. Les boutons et leurs actions ne changent pas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../home-v4.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

test('téléphone : Jouer au centre, Pokédex en accès direct', () => {
  const order = ['home', 'pokedex', 'game', 'social', 'profile'];
  order.forEach((tab, i) => assert.match(css, new RegExp('\\.mobile-tabbar \\[data-tab="' + tab + '"\\]\\{order:' + (i + 1) + '\\}')));
  // Le bouton Jouer reste dans la hauteur de la barre : pas de position décalée vers le haut.
  const block = css.slice(css.indexOf('button[data-tab="game"]{'), css.indexOf('button[data-tab="game"] svg'));
  assert.doesNotMatch(block, /top:-|translateY\(-|position:absolute/);
  for (const tab of order) assert.ok(html.includes('data-tab="' + tab + '"'), tab);
});

test('PC : la navigation en pilule claire, page ouverte en blanc', () => {
  assert.match(css, /#global-nav\{flex:0 0 auto!important;width:auto!important;max-width:max-content!important;margin-inline:auto!important;background:#F5EDE2!important/);
  assert.match(css, /#global-nav \.nav-pill\.active\{background:#fff!important;color:#2E2A33!important/);
});
