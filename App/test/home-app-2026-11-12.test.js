'use strict';
// Accueil téléphone « appli » (12/11) : 4 rubriques sans cadre au lieu de 9 cartes empilées.
// Les bulles « Aujourd'hui » déclenchent les mêmes actions que les cartes qu'elles remplacent ;
// les cartes restent dans la page et rien ne change au-dessus de 640 px.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const js = fs.readFileSync(path.join(__dirname, '../src/script.10zzzzf.home-app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../home-v4.css'), 'utf8');
const block = css.slice(css.indexOf('/* Accueil téléphone « appli »'));

test('les bulles reprennent les actions des cartes remplacées', () => {
  for (const action of ['claimBallGift', 'openWildGrass', 'openExpedition', 'openEggGame', 'openWeeklyLeague', 'openAlbumBinder', 'openBallBag', 'openLoginWelcome']) {
    assert.match(js, new RegExp("action: '" + action + "'"), action);
  }
  // « Ta prochaine capture » : la même logique que la carte (offerte, boutique, gagner des Balls, herbes).
  for (const action of ["'claimBallGift'", "'openShop'", "'openAllModesScreen'", "'openWildGrass'"]) assert.ok(js.includes(action), action);
});

test('rien n’est retiré : les cartes d’origine sont seulement cachées sur téléphone', () => {
  assert.doesNotMatch(js, /\.remove\(\)|removeChild|replaceChildren/);
  const media = block.indexOf('@media (max-width:640px){');
  assert.ok(media > 0, 'tout est sous 640 px');
  const before = block.slice(0, media);
  assert.doesNotMatch(before, /#hv4-row|display:none!important/, 'aucune règle hors du téléphone ne cache une carte');
  assert.match(block, /> #hv4-row\{display:none!important\}/);
});

test('ordre sur téléphone : Défi du jour, Aujourd’hui, Mini-jeux, Entre amis', () => {
  const order = (re) => Number((block.match(re) || [])[1]);
  const hero = order(/> #daily-hero\{order:(\d+)/), today = order(/> #hva-today\{order:(\d+)/);
  const games = order(/:is\(\.home-discovery-head,#hva-x\)\{order:(\d+)/), friends = order(/> #hva-party-head\{order:(\d+)/);
  const party = order(/> #home-party\{order:(\d+)/);
  assert.ok(hero < today && today < games && games < friends && friends < party, [hero, today, games, friends, party].join(' '));
});

test('le texte des épreuves reste lisible (versions courtes, le titre d’origine reste pour Google)', () => {
  assert.match(block, /#daily-hero-steps \.hp-long\{display:none\}/);
  assert.match(js, /hva-h" aria-hidden="true">Mini-jeux/);
  assert.match(block, /\.home-discovery-head > div:not\(\.home-discovery-actions\)\{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect\(0 0 0 0\)/);
});
