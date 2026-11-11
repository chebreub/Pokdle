'use strict';
// Salon de la Party Room v2 (11/11/2026, « go salon ») : habillage seulement, les boutons d'origine restent.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const js = fs.readFileSync(path.join(__dirname, '../src/script.10zzzzc.party-salon-v2.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../party-room.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

test('chaque jeu du salon a sa couleur et son image locale', () => {
  const ids = [...html.matchAll(/id="party-mode-([a-z0-9]+)"[^>]*data-action="partySetMode"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 12);
  for (const id of ids) {
    assert.match(js, new RegExp('\\b' + id + ": \\['#[0-9A-F]{6}', 'img/(home|art)/\\d+\\.webp'"), id);
    const img = js.match(new RegExp(id + ": \\['#[0-9A-F]{6}', '(img/[^']+)'"))[1];
    assert.ok(fs.existsSync(path.join(__dirname, '..', img)), img);
  }
});
test('rien n’est retiré : on garde partySetMode et la règle d’origine (#party-mode-hint)', () => {
  assert.doesNotMatch(js, /\.remove\(\)/);
  assert.match(js, /getElementById\('party-mode-hint'\)/);
  assert.match(js, /pick\.querySelector\('\.psv-pick-text'\)\.appendChild\(hint\)/);
});
test('les filtres ne sont réécrits que s’ils changent (pas de boucle avec l’observateur)', () => {
  assert.match(js, /if \(chips\.dataset\.html !== chipsHtml\)/);
  assert.match(js, /window\.psvSetCat = psvSetCat/);
});
test('« Lancer » collé en bas, au-dessus de la barre d’onglets sur téléphone', () => {
  assert.match(css, /#party-action-dock\.psv-dock\{position:sticky;bottom:12px/);
  assert.match(css, /#party-action-dock\.psv-dock\{bottom:calc\(78px \+ env\(safe-area-inset-bottom,0px\)\)\}/);
});
