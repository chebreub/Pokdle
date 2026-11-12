'use strict';
// Profil épuré (12/11) : la carte de dresseur prend les couleurs Aurore de l'accueil, contenu inchangé.
// Le jaune plein reste au Pokémon du jour : « Partager ma carte » passe en blanc.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../home-v4.css'), 'utf8');
const block = css.slice(css.indexOf('/* Profil épuré Aurore'));

test('la carte de dresseur devient une carte Aurore', () => {
  assert.ok(block.length > 100, 'bloc du profil présent');
  assert.match(block, /#screen-profile \.profile-hero\{background-color:#4A2A8E!important;background-image:[^}]*linear-gradient\(118deg,#2A1F6B 0%,#5A2E9E 50%,#9A3C8E 100%\)!important/);
  assert.match(block, /\.profile-hero-name\{color:#fff!important\}/);
  assert.match(block, /\.profile-ring-fill\{stroke:#FFD45C!important\}/);
});

test('« Partager ma carte » en blanc, pas en jaune (réservé au Pokémon du jour)', () => {
  const share = block.match(/\.profile-hero-actions \.btn-blue\{([^}]*)\}/);
  assert.ok(share);
  assert.match(share[1], /background:#fff!important/);
  assert.doesNotMatch(share[1], /FFD45C/i);
});

test('pastilles et boutons sur fonds opaques (contrastes lisibles)', () => {
  for (const sel of ['.profile-hero-title', '.profile-hero-pioneer', '.profile-hero-partner', '.profile-hero-actions .btn-ghost']) {
    const rule = block.match(new RegExp(sel.replace(/[.]/g, '\\.') + '\\{([^}]*)\\}'));
    assert.ok(rule, sel);
    assert.doesNotMatch(rule[1], /background:[^;]*rgba/, sel);
  }
});

test('seules les couleurs changent : rien n’est caché dans la carte', () => {
  assert.doesNotMatch(block, /display:none|visibility:hidden/);
});
