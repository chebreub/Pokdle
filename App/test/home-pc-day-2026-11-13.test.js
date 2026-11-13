'use strict';
// 🖥️ Accueil PC « A » : à partir de 1 280 px, un seul panneau « Ta journée » à droite remplace à l'écran les cartes
// Capture, Expédition, Cette semaine, Pokédex et Récompenses ; elles restent dans la page et le téléphone ne change pas.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('le panneau « Ta journée » : mêmes actions que les cartes qu’il remplace', () => {
  const js = read('src/script.10zzzzq.home-pc-day.js');
  for (const action of ['openWildGrass', 'claimBallGift', 'openExpedition', 'openEggGame', 'openWeeklyLeague', 'openAlbumBinder', 'openBallBag', 'openLoginWelcome', 'openShop'])
    assert.ok(js.includes("'" + action + "'"), action);
  assert.match(js, /side\.appendChild\(box\)/, 'dans la colonne de droite, sous « Défie tes amis »');
  assert.match(js, /hvaDexCounts\(\)/, 'mêmes chiffres du Pokédex que les bulles du téléphone');
  assert.doesNotMatch(js, /\.remove\(\)/, 'aucune carte d’origine n’est retirée de la page');
});

test('la mise en page ne touche que les écrans d’au moins 1 280 px', () => {
  const css = read('home-v4.css');
  const at = css.indexOf('/* 🖥️ Accueil PC « A »'), end = css.indexOf("/* Bas de l'accueil sur téléphone");
  assert.ok(at > 0 && end > at, 'avant le bloc du bas de l’accueil téléphone (qui ne cache rien)');
  const block = css.slice(at, end);
  assert.match(block, /^\.hpd-day\{display:none\}$/m, 'caché par défaut (téléphone, tablette)');
  const media = block.slice(block.indexOf('@media (min-width:1280px){'));
  assert.ok(media.includes('#hv4-row>.hv4-main') && media.includes('#home-balls{display:none!important}'), 'les cartes remplacées sont cachées à l’écran, sur PC seulement');
  assert.match(media, /#hm-side \.hpd-day\{display:block\}/);
  // Très grand écran : la largeur reste plafonnée à ≈ 1 760 px (règle de la refonte PC, vérifiée par la QA pc0).
  assert.doesNotMatch(css, /--desktop-shell-max:2000px/);
});

test('la QA navigateur suit le nouvel accueil PC', () => {
  const qa = read('../tools/browser_quality.py');
  assert.match(qa, /elif width>=1280:/);
  assert.match(qa, /#hpd-day \[data-action="openEggGame"\]/);
});
