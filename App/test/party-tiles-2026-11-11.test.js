// Tuiles colorées et animées de la Party Room (11/11/2026) : mêmes boutons, une scène à la fois, rien avec « Animations réduites ».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10zzl.party-tiles.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'game-shell.css'), 'utf8');

test('les 12 jeux de salon et les 4 jeux à deux ont une couleur et une scène', () => {
  for (const k of ['dessin', 'quiestce1v1', 'petitbac', 'dexrace', 'coop', 'deduction', 'guess', 'nearest', 'typecombo', 'duocriteria', 'statclashparty', 'statclash']) assert.match(js, new RegExp(k + ": \\['#"));
  for (const a of ['openMultiplayerMode', 'openStatClashMode', 'openStatAuctionMode', 'openDefiAmiFromAllModes']) assert.match(js, new RegExp(a + ": \\['#"));
});
test('une scène à la fois, seulement visible, rien si onglet caché ou animations réduites', () => {
  assert.match(js, /if \(document\.hidden \|\| ptReduced\(\)\) return;/);
  assert.match(js, /pt-tile\.pt-play'\)\) return;/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{#party-lobby\.pt-on \.pt-tile \*,#party-lobby\.pt-on \.pt-tile\{animation:none!important\}/);
  assert.match(css, /\.reduce-motion #party-lobby\.pt-on \.pt-fx\{display:none\}/);
});
test('les boutons ne changent pas : on n’ajoute qu’un décor aria-hidden', () => {
  assert.match(js, /fx\.setAttribute\('aria-hidden', 'true'\)/);
  assert.doesNotMatch(js, /removeAttribute\('data-action'\)|\.onclick\s*=/);
});
