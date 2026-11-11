// Party Room et Mes amis sur PC (11/11/2026, maquette validée) : « Mes défis » en pastilles,
// demandes envoyées en pastilles dans la colonne de droite (PC), liste d'origine gardée sur téléphone.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('Mes défis : une ligne de pastilles, mêmes actions', () => {
  const js = src('src/script.10xs.inbox-visibility.js');
  assert.match(js, /party-duels-chips/);
  assert.match(js, /data-action="acceptChallenge"/);
  assert.match(js, /data-action="openMyChallenges"/);
  assert.doesNotMatch(js, /party-duels-row/);
});

test('Mes amis : demandes envoyées en pastilles sur PC, liste gardée sur téléphone', () => {
  const js = src('src/script.10xu.friends.js');
  assert.match(js, /fr-pend-chip/);
  assert.match(js, /fr-out-list/);
  assert.equal((js.match(/data-action="frCancel"/g) || []).length >= 2, true);
  const css = src('game-shell.css');
  assert.match(css, /@container \(min-width:760px\)\{\s*\.fr-v3 \.fr-pend\{display:block\}/);
  assert.match(css, /\.fr-v3 \.fr-out-sub,\.fr-v3 \.fr-out-list,\.fr-v3 \.fr-main-note\{display:none\}/);
});

test('PC : une seule largeur et les jeux sur 3 colonnes', () => {
  const css = src('game-shell.css');
  assert.match(css, /:is\(#party-seg,#party-duels,#party-lobby,#party-friends\)\{width:auto;max-width:1180px/);
  assert.match(css, /#pl3-group\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css, /#screen-party-room\.party-tab-friends #party-duels\.is-chips\{display:none!important\}/);
});
