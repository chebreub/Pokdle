'use strict';
// Finitions du 12/11 : la bulle « Astuce : générations » ne cache plus la ligne des récompenses ;
// bas de l'accueil téléphone en liste (mêmes boutons et liens).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const js = fs.readFileSync(path.join(__dirname, '../src/script.10n.generations.js'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, '../game-shell.css'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../home-v4.css'), 'utf8');

test('la bulle des générations se place à gauche (PC) ou au-dessus (téléphone), dessous en dernier recours', () => {
  const left = js.indexOf("side='left'"), above = js.indexOf("side='above'"), below = js.indexOf("side='below'");
  assert.ok(left > 0 && above > left && below > above);
  assert.match(js, /window\.innerWidth>=700/);
  for (const side of ['is-above', 'is-below', 'is-left']) assert.ok(shell.includes('.generation-hint.' + side), side);
});

test('bas de page téléphone : une liste, rien de caché, seulement sous 640 px', () => {
  const at = css.indexOf('/* Bas de page sur téléphone');
  assert.ok(at > 0);
  const block = css.slice(at);
  assert.ok(block.indexOf('@media (max-width:640px){') > 0);
  assert.doesNotMatch(block.replace(/[^{}]*::-webkit-scrollbar\{display:none\}/g, ''), /display:none/);
  for (const part of ['.site-footer-support', '.site-footer-feedback', '.site-footer-install']) assert.ok(block.includes(part), part);
});
