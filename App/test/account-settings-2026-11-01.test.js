'use strict';
// « Mon compte » and « Paramètres » tidied (01/11/2026, mockup approved): the account window is wider
// on a computer with the links in two groups; each setting on one line; help and support together;
// « Réinitialiser » a small link instead of a stretched button.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the account menu: two groups, the XP bar, the links at the bottom', () => {
  const src = read('src/script.07.delegation-party.js');
  const menu = src.slice(src.indexOf('function openAccountMenu'), src.indexOf('const ACCOUNT_PROVIDER_NAMES'));
  assert.match(menu, /<section><h5>Entre joueurs<\/h5>[\s\S]*\["defis"\][\s\S]*\["messages"\][\s\S]*\["amis"\][\s\S]*\["invite"\][\s\S]*<\/section>/);
  assert.match(menu, /<section><h5>Ma progression<\/h5>[\s\S]*\["profile"\][\s\S]*\["album"\][\s\S]*\["past"\][\s\S]*\["settings"\][\s\S]*<\/section>/);
  assert.match(menu, /account-menu-xpbar/);
  assert.match(menu, /<div class="account-menu-foot">[\s\S]*account-menu-logout[\s\S]*account-menu-privacy[\s\S]*account-menu-delete/);
  const css = read('game-shell.css');
  assert.match(css, /#overlay-modal\[data-kind="account"\] \.overlay-card \{width:min\(780px,calc\(100vw - 32px\)\)!important;\}/);
  assert.match(css, /@media \(max-width:640px\) \{\n {2}#pokdle-app \.account-menu-groups, #pokdle-app \.account-menu-extra \{grid-template-columns:1fr;\}/, 'one column on a phone');
});

test('the settings: one section for help and support, reset as a link', () => {
  assert.match(read('src/script.10y.support.js'), /section\.innerHTML = '<h4>Aide & soutien<\/h4>';/);
  assert.match(read('src/script.10yb.feedback.js'), /section\.insertBefore\(row, section\.querySelector\('\.app-settings-support'\)\);/, 'the idea first, then the support');
  assert.match(read('game-shell.css'), /\.app-settings-reset \{grid-column:1 \/ -1;justify-self:end;width:auto;[^}]*text-decoration:underline;\}/);
  assert.match(read('src/script.07.delegation-party.js'), /data-action="openInstallApp">Voir comment<\/button>/);
});
