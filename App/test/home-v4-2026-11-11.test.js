// Accueil V4 (11/11/2026, maquettes validées) : on réorganise les blocs existants, sans recopier ni retirer.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.10zzzz.home-v4.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'home-v4.css'), 'utf8');

test('le Défi du jour lit les vraies données du parcours, sans valeur inventée', () => {
  assert.match(js, /dailyHomeSnapshot/);
  assert.match(js, /sum\.points/);
  assert.match(js, /sum\.maxPoints/);
  assert.doesNotMatch(js, /points\s*=\s*\d{2}/);
});
test('le H1 d’origine reste dans la page (Google), la grande question est décorative', () => {
  assert.match(js, /q\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(css, /\.pk-hero-title\{position:absolute!important;width:1px!important/);
});
test('la découverte du jour reste (Essayer, Pas aujourd’hui) et devient la 1re tuile', () => {
  assert.match(js, /getElementById\('home-disc-card'\)/);
  assert.match(js, /grid\.insertBefore\(card, grid\.firstChild\)/);
  assert.doesNotMatch(css, /\.disc-later\{display:none/);
});
test('le carrousel n’avance seul que sur PC et s’arrête au doigt', () => {
  assert.match(js, /HC_EVERY = 7000/);
  assert.match(js, /\(pointer: coarse\)/);
  assert.match(js, /hcStop\(\)/);
});
test('les récompenses viennent de ballState (10 Balls par jour au plus, ₽ seulement si activés)', () => {
  assert.match(js, /s\.today \+ ' Ball/);
  assert.match(js, /s\.cap/);
  assert.match(js, /s\.coins && s\.coins\.enabled \? Number\(s\.coins\.balance\)/);
});
test('rien n’est supprimé : les blocs sont déplacés, la Ligue reste ouverte depuis sa ligne', () => {
  assert.doesNotMatch(js, /\.remove\(\);\s*\/\/ supprim/);
  assert.match(js, /openWeeklyLeague/);
  assert.match(js, /openEggGame|home-pathways/);
});
test('la barre d’onglets du téléphone ne cache pas la fin de la page', () => {
  assert.match(css, /padding-bottom:calc\(84px \+ env\(safe-area-inset-bottom,0px\)\)/);
});
test('la langue n’est qu’un emplacement visuel', () => {
  assert.match(js, /hv4-lang/);
  assert.doesNotMatch(js, /i18n|translate\(/);
});
