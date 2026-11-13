'use strict';
// Évolution et Ordre Pokédex retirés le 13/11/2026 (« bcp trop simple », Kayan) : plus dans le catalogue,
// la carte « À découvrir », le Marathon mini-jeux ni les pages Google (leurs adresses renvoient vers /jeux).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GAMES } = require('../lib/seo-games');
const { GUIDES } = require('../lib/seo-guides');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('les deux jeux ne sont plus dans le catalogue ni proposés', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /data-action="openFromAllModes" data-args='\["(startEvolutionChainGame|startPokedexOrderGame)"\]'/);
  assert.doesNotMatch(read('src/script.10xzt.discovery-card.js'), /startEvolutionChainGame|startPokedexOrderGame/);
  assert.doesNotMatch(read('src/script.10z.landing-links.js'), /evolution-pokemon|ordre-pokedex/);
  const marathon = read('src/script.01.core.js').match(/function getPartyModePool\(\)[\s\S]*?\n}/)[0];
  assert.doesNotMatch(marathon, /launch: startEvolutionChainGame|launch: startPokedexOrderGame/);
});

test('plus de page Google pour eux, et aucun lien vers elles', () => {
  const slugs = new Set(GAMES.map((g) => g.slug));
  assert.ok(!slugs.has('evolution-pokemon') && !slugs.has('ordre-pokedex'));
  for (const g of GAMES) assert.doesNotMatch(JSON.stringify(g.related || []), /evolution-pokemon|ordre-pokedex/, g.slug);
  for (const g of GUIDES) {
    assert.doesNotMatch(JSON.stringify(g.games || []), /evolution-pokemon|ordre-pokedex/, g.slug);
    assert.doesNotMatch(g.cta?.href || '', /evolution-pokemon|ordre-pokedex/, g.slug);
  }
});
