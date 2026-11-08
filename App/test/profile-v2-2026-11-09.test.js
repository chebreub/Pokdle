'use strict';
// 📱 Profil plus court (9/11/2026) : rien d'origine n'est retiré, des versions courtes sont ajoutées.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Modifier in the header, an XP bar from the level ring, duplicate tabs hidden', () => {
  const js = read('src/script.10zzc.profile-v2.js');
  assert.match(js, /renderProfileScreen = function/);
  assert.match(js, /class="btn-ghost pf2-edit" data-action="openProfileEditor"/);
  assert.match(js, /stroke-dasharray/);
  assert.match(js, /action === 'openPokedexCollection' \|\| \(action === 'switchProfileView' && \/album\|secrets\/\.test\(args\)\)/);
  const css = read('game-shell.css');
  assert.match(css, /#screen-profile \.profile-tabs > button\.pf2-dup\{display:none!important\}/);
  assert.match(css, /grid-template-areas:"art name level" "art chips level" "art partner level" "xp xp xp"/);
  // The four tiles still lead to the Pokédex, missions, secrets and achievements.
  const html = read('index.html');
  assert.match(html, /class="profile-figure"[^>]*data-action="openPokedexCollection"|data-action="openPokedexCollection"/);
});
