'use strict';
// V2-PERF-03 (8/11/2026, mesure OBS-01) : les tuiles de mini-jeux et la carte « À découvrir » servent l'artwork
// officiel en WebP 256 px depuis le site (avant : PNG 475 px via jsDelivr, ≈ 140 Ko chacun).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src', 'script.08.catalog.js'), 'utf8');

test('every tile artwork exists as a light local WebP', () => {
  const block = src.slice(src.indexOf('var MODE_TILE_THEME'), src.indexOf('var MODE_TILE_PROPS'));
  const ids = new Set([...block.matchAll(/ids:\[([\d,]+)\]/g)].flatMap((m) => m[1].split(',').map(Number)));
  assert.ok(ids.size >= 30);
  for (const id of ids) {
    const file = path.join(root, 'img', 'art', id + '.webp');
    assert.ok(fs.existsSync(file), 'missing ' + id);
    assert.ok(fs.statSync(file).size < 40000, id + ' stays light');
  }
  assert.match(src, /function modeTileArtworkUrl\(id\) \{\n  return 'img\/art\/'\+Number\(id\)\+'\.webp';/);
  assert.match(src, /data-fallback="'\+modeCatalogSpriteUrl\(id\)\+'"/, 'the small sprite stays as fallback');
  assert.match(fs.readFileSync(path.join(root, 'src', 'script.10xzt.discovery-card.js'), 'utf8'), /modeTileArtworkUrl\(id\)/);
});

test('V2-PERF-04: the Expedition legends use the same light WebP', () => {
  const balls = fs.readFileSync(path.join(root, 'lib', 'poke-balls.js'), 'utf8');
  const legends = [...balls.matchAll(/legend: (\d+) \}/g)].map((m) => Number(m[1]));
  assert.equal(legends.length, 6);
  for (const id of legends) assert.ok(fs.existsSync(path.join(root, 'img', 'art', id + '.webp')), 'missing ' + id);
  const exp = fs.readFileSync(path.join(root, 'src', 'script.10xzb.expedition.js'), 'utf8');
  assert.equal((exp.match(/typeof modeTileArtworkUrl === 'function' \? modeTileArtworkUrl\(p\.id\) : pokedexDetailArtwork\(p, false\)/g) || []).length, 2);
  assert.doesNotMatch(exp, /escapeHtml\(pokedexDetailArtwork\(p, false\)\)/);
});
