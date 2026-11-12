'use strict';
// Classement : animation d'ouverture (12/11). Seulement à l'ouverture, jamais avec « réduire les animations »,
// et les points retrouvent leur texte exact à la fin.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const js = fs.readFileSync(path.join(__dirname, '../src/script.10zzzzg.lb-anim.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../game-shell.css'), 'utf8');
const block = css.slice(css.indexOf('/* Classement : animation d\'ouverture'));

test('l’animation ne part qu’à l’ouverture du classement, sans « réduire les animations »', () => {
  assert.match(js, /var opening = !screen \|\| screen\.classList\.contains\('hidden'\)/);
  assert.match(js, /if \(opening && !lbaReduced\(\)\)/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /reduce-motion/);
  assert.match(block, /^\/\*[\s\S]*?\*\/\n@media \(prefers-reduced-motion:no-preference\)\{/);
});

test('les points retrouvent leur texte d’origine et la classe s’en va', () => {
  assert.match(js, /if \(k >= 1\) \{ el\.textContent = text; return; \}/);
  assert.match(js, /shell\.classList\.remove\('lba'\)/);
});

test('podium : 2e, puis 3e, puis 1er ; puis les lignes', () => {
  const delay = (sel) => Number((block.match(new RegExp('\\.lbv5-step\\.' + sel + '\\{animation-delay:([\\d.]+)s')) || [])[1]);
  assert.ok(delay('is-silver') < delay('is-bronze') && delay('is-bronze') < delay('is-gold'));
  assert.match(block, /\.lbv2-row:nth-child\(1\)\{animation-delay:1\.15s\}/);
});
