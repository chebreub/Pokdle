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
test('la barre d’onglets du téléphone ne cache pas la fin de la page (marge déjà réservée par le body)', () => {
  const mobile = fs.readFileSync(path.join(__dirname, '..', 'mobile.css'), 'utf8');
  assert.match(mobile, /body \{ padding-bottom: calc\(86px \+ env\(safe-area-inset-bottom\)\); \}/);
  assert.doesNotMatch(css, /screen-config\.hv4\.hv4\.hv4\{padding-bottom:calc\(84px/);
});
test('Pokédex : mêmes chiffres que Ma collection, un Pokémon attrapé compte toujours comme vu', () => {
  const dex = js.slice(js.indexOf('function hv4Dex'), js.indexOf('function hv4Rewards'));
  assert.match(dex, /colIsObtained\(p\)/);
  assert.match(dex, /st\.kind === 'registered' \|\| own\) seen\+\+/);
  assert.match(dex, /loadWildCaptures\(\)/);
  assert.doesNotMatch(dex, /ballState/, 'plus de repli sur le compteur des hautes herbes');
});
test('carrousel : glissement vertical rendu à la page, flèches au-dessus des tuiles, page par page', () => {
  assert.match(css, /#home-games-grid\.hc-on\{overflow-y:hidden!important;overscroll-behavior-y:auto!important;touch-action:pan-x pan-y\}/);
  assert.match(css, /\.hc-box>\.hc-arrow\{z-index:6!important\}/);
  assert.match(js, /grid\.scrollBy\(\{ left: dir \* grid\.clientWidth \* 0\.98/);
  assert.match(css, /\.hc-box\.hv4-at-start \.hc-arrow\.is-prev/);
});
test('tuiles : grand artwork officiel en couleur, une seule tuile bouge à la fois, jamais avec Animations réduites', () => {
  assert.match(css, /\.mode-tile-art>\.hc-back\{display:block!important/);
  assert.match(css, /color-mix\(in oklab,var\(--t\) 72%,#fff\)/);
  assert.match(js, /hv4\.hopI = \(\(hv4\.hopI \|\| 0\) \+ 1\) % tiles\.length/);
  assert.match(js, /reduce-motion/);
  assert.match(css, /body\.reduce-motion[^{]*\.hc-back\{animation:none!important/);
});
test('zones tactiles du téléphone : 40 px au moins, « Entre amis » visible', () => {
  assert.match(css, /#home-game-filters>button\{min-height:40px!important/);
  assert.match(css, /#home-game-filters\{flex:1 1 100%!important;width:100%!important/);
  assert.match(css, /\.hc-dot::after\{content:"";position:absolute;inset:-16px -5px\}/);
});
test('la langue n’est qu’un emplacement visuel', () => {
  assert.match(js, /hv4-lang/);
  assert.doesNotMatch(js, /i18n|translate\(/);
});
