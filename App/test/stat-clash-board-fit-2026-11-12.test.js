// Stat Clash 1v1 : le plateau doit tenir dans son écran (bug du 12/11 : panneau du Bot coupé sur PC,
// 3 colonnes de 978 px sur téléphone). La règle de game-shell.css, chargée après style.css, doit garder
// des colonnes qui peuvent se resserrer (minmax(0, …)) et passer sur une colonne sous 980 px.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'game-shell.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('le plateau de Stat Clash se resserre au lieu de déborder', () => {
  assert.match(css, /#screen-stat-clash \.stat-clash-board,\s*#screen-stat-clash \.stat-clash-shell\.mode-room\.is-lobby-layout \.stat-clash-board\{grid-template-columns:minmax\(0,\.9fr\) minmax\(0,1\.6fr\) minmax\(0,\.9fr\)!important;width:100%;max-width:100%\}/);
});

test('sous 980 px, Stat Clash passe sur une seule colonne', () => {
  assert.match(css, /@media \(max-width:980px\)\{\s*#screen-stat-clash \.stat-clash-board,\s*#screen-stat-clash \.stat-clash-shell\.mode-room\.is-lobby-layout \.stat-clash-board\{grid-template-columns:minmax\(0,1fr\)!important\}/);
});

test('game-shell.css est chargé après style.css (sinon la correction ne gagne pas)', () => {
  const a = html.indexOf('dist/style.min.css');
  const b = html.indexOf('dist/game-shell.min.css');
  assert.ok(a >= 0 && b > a);
});
