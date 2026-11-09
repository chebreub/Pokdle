'use strict';
// 📱 Passe iPhone, lot 2 (9/11/2026) : Mon sac, Expédition, Hautes herbes, Mes amis plus courts sur téléphone.
// Les textes restent dans la page (repliés derrière un bouton), le PC ne change pas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('phone pass 2 folds long texts behind buttons without removing them', () => {
  const js = read('src/script.10zzf.iphone-pass2.js');
  assert.doesNotMatch(js, /\.remove\(\)/);
  assert.match(js, /window\.sxToggle = sxToggle/);
  for (const kind of ['how', 'rules', 'story', 'friends']) assert.match(js, new RegExp(kind + ": \\["));
  // Repassé après chaque nouveau rendu des fenêtres (onglets du sac, coffres, liste d'amis).
  assert.match(js, /\['overlay-modal', 'screen-party-room'\]/);
  const css = read('balls.css');
  // Les boutons n'existent que sur téléphone ; les textes repliés seulement sous 640 px.
  assert.match(css, /\.sx-toggle,\.sx-links\{display:none\}\n@media \(max-width:640px\)\{/);
  assert.match(css, /\.exp\.sx-on:not\(\.sx-rules\) \.sx-more\{display:none\}/);
  assert.match(css, /\.wz-grid\{grid-template-columns:repeat\(3,1fr\);gap:6px\}/);
  assert.match(css, /#party-friends \.fr-note\.sx-fold:not\(\.is-open\)\{display:none\}/);
  // Les textes repliés existent toujours dans les écrans d'origine.
  assert.match(read('src/script.10xu.friends.js'), /fr-note/);
  assert.match(read('src/script.10xy.poke-balls.js'), /ball-how/);
});
