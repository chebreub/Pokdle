'use strict';
// Accueil épuré (12/11) : le défi du jour en carte Aurore, bouton principal jaune (Pokémon du jour),
// contenu et états inchangés ; le panneau « Défie tes amis » est gardé tel quel (choix A de Kayan).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../home-v4.css'), 'utf8');
const block = css.slice(css.indexOf('/* Accueil épuré'));

test('le défi du jour devient une carte Aurore, bouton jaune', () => {
  assert.match(block, /#daily-hero\.hv4-hero\{background:radial-gradient\([^}]*linear-gradient\(118deg,#2A1F6B 0%,#5A2E9E 50%,#9A3C8E 100%\)!important/);
  assert.match(block, /#daily-hero\.hv4-hero #daily-hero-cta\{background:#FFD45C!important;color:#2E2A33!important/);
  assert.match(block, /#daily-hero\.hv4-hero\.hv4-done\{/);
});

test('seules les couleurs changent : rien n’est caché dans la carte', () => {
  const rules = block.split('\n').filter((line) => line.includes('#daily-hero.hv4-hero'));
  assert.ok(rules.length > 10);
  // Seule exception voulue : le petit « / 100 » de l'anneau réduit sur téléphone.
  for (const rule of rules.filter((r) => !r.includes('.hv4-ring small'))) assert.doesNotMatch(rule, /display:none|visibility:hidden/, rule);
});

test('sur téléphone, l’anneau de progression ne mord plus sur le bouton', () => {
  assert.match(block, /#daily-hero\.hv4-hero\.hv4-progress \.hv4-ring\{width:60px;height:60px;margin-top:0\}/);
});
