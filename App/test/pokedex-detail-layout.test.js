'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '../src/script.04.jeu-pokedex.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../pokedex.css'), 'utf8');
const refresh = fs.readFileSync(path.join(__dirname, '../visual-refresh.css'), 'utf8');

test('the detail panel shows stats and weaknesses first, in both the loading and the full view', () => {
  const body = src.slice(src.indexOf('async function renderPokedexDetail('), src.indexOf('function defaultGameRatingEntry('));
  const order = ['is-stats', 'is-matchups', 'is-abilities', 'is-evolution', 'is-entry', 'is-places', 'is-extra'];
  const views = body.split('detail.innerHTML = `').slice(1);
  assert.equal(views.length, 2, 'loading view and full view');
  for (const view of views) {
    const at = order.map(name => view.indexOf('class="pokedex-section ' + name + '"'));
    assert.ok(at.every(i => i > 0), 'every section is tagged: ' + at);
    assert.deepEqual([...at].sort((a, b) => a - b), at, 'sections in order: ' + order.join(', '));
    assert.ok(view.indexOf('pokedex-detail-facts') < at[0], 'the six facts come before the sections');
    assert.match(view, /src="\$\{pokedexDetailArtwork\(pokemon, pokedexSelectedShiny\)\}"[^>]*data-fallback="\$\{getPokedexDisplaySprite\(pokemon, pokedexSelectedShiny\)\}"/);
  }
  assert.match(body, /detail\.dataset\.type = typeSlug\(pokemon\.type1\);/);
  // Précédent / Suivant stay together on one row, name the Pokémon they lead to, and sit above the header on a computer.
  assert.doesNotMatch(body, /pokedex-detail-head-nav/);
  assert.match(body, /&larr; \$\{navigation\.previous \? neighbourHtml\(navigation\.previous\) : "Précédent"\}/);
  assert.match(body, /\$\{navigation\.next \? neighbourHtml\(navigation\.next\) : "Suivant"\} &rarr;/);
  assert.match(css, /#pokedex-detail > \.pokedex-detail-nav \{ order: -1; justify-content: space-between; margin: 0; \}/);
});

test('one chip per type with its multiplier: Feu ×2, Plante ×¼, Eau ×½', () => {
  const fn = src.slice(src.indexOf('function typeMatchupHtml('), src.indexOf('function formatGenderRate('));
  assert.match(fn, /const multiplier = \(m\) => \(\{ 0\.25: "¼", 0\.5: "½" \}\)\[m\] \|\| String\(m\);/);
  assert.match(fn, /<b class=\\"match-badge-multiplier\\">×\$\{multiplier\(e\.m\)\}<\/b>/);
});

test('tiles and the detail header are tinted by the main type, for all 18 types', () => {
  assert.match(src, /card\.dataset\.type = typeSlug\(p\.type1\);/);
  const slugs = ['plante', 'feu', 'eau', 'electrik', 'insecte', 'normal', 'poison', 'sol', 'fee', 'vol', 'glace', 'psy', 'combat', 'roche', 'spectre', 'dragon', 'tenebres', 'acier'];
  for (const slug of slugs) assert.match(refresh, new RegExp('\\[data-type="' + slug + '"\\] \\{ --dex-tint: #[0-9a-f]{6}; \\}'), slug);
  assert.doesNotMatch(refresh, /\.pokedex-card:has\(\.type-/, 'the old four :has() tints are gone');
  // Same names as the badges: « Électrik » → electrik, « Ténèbres » → tenebres.
  const typeSlug = Function(src.match(/function typeSlug\(typeFr\) \{[\s\S]*?\n\}/)[0] + '; return typeSlug;')();
  assert.deepEqual(['Électrik', 'Ténèbres', 'Fée', 'Plante'].map(typeSlug), ['electrik', 'tenebres', 'fee', 'plante']);
});

test('on large screens the detail panel is 760 px and two columns wide; from 1200 px it takes 38 %', () => {
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(440px, 38%\);/);
  const wide = css.slice(css.indexOf('@media (min-width: 2000px) {\n  body:has(#screen-pokedex'));
  assert.match(wide, /grid-template-columns: minmax\(0, 1fr\) 760px;/);
  assert.match(css, /#pokedex-detail > :not\(\.is-stats, \.is-matchups, \.is-abilities\) \{ grid-column: 1 \/ -1; \}/);
  // Stats and abilities stack on the left, weaknesses span them on the right: no stretched empty box.
  // The evolution chain gets the full width so its pictures fit on one line.
  assert.match(css, /#pokedex-detail > :is\(\.is-stats, \.is-abilities\) \{ grid-column: 1; align-self: start; \}/);
  assert.match(css, /#pokedex-detail > \.is-matchups \{ grid-column: 2; grid-row: span 2; align-self: start; \}/);
});
