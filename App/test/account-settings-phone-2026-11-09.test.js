'use strict';
// 📱 Mon compte et Paramètres plus courts sur iPhone (9/11/2026) : versions courtes ajoutées,
// éléments d'origine gardés (QA, PC), vrais menus déroulants toujours là.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('account menu and settings get short phone versions without removing the originals', () => {
  const js = read('src/script.10zze.account-settings-phone.js');
  assert.match(js, /openAccountMenu = function/);
  assert.match(js, /openSettingsModal = function/);
  // Les tuiles gardent la vraie action (accountNavigate) : on ajoute des morceaux, on ne remplace pas le bouton.
  assert.match(js, /insertAdjacentHTML\('afterbegin', '<span class="am2-ic/);
  assert.doesNotMatch(js, /\.remove\(\)/);
  // Les boutons Clair / Sombre… règlent le vrai menu déroulant et préviennent comme avant.
  assert.match(js, /select\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  for (const key of ['theme', 'textScale', 'density']) assert.match(js, new RegExp(key + ': \\['));
  const css = read('game-shell.css');
  // Le menu déroulant reste visible pour la QA (1 px, transparent) au lieu d'être retiré.
  assert.match(css, /\.as2 \.as2-select \{position:absolute!important;width:1px!important/);
  assert.doesNotMatch(css, /\.as2-select \{[^}]*display:none/);
  // Les versions courtes sont cachées sur PC.
  assert.match(css, /@media \(min-width:641px\)\{#pokdle-app #overlay-modal \.am2 \.am2-ic/);
  // La source « Paramètres » de base garde ses réglages.
  const base = read('src/script.07.delegation-party.js');
  for (const key of ['seasonalDecorations', 'theme', 'density', 'textScale', 'soundEffects', 'pokemonCries', 'highContrast', 'ballFlick']) {
    assert.match(base, new RegExp('data-setting="' + key + '"'));
  }
});
