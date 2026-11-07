'use strict';
// V2-PERF-01 / V2-ACC-01 (8/11/2026, contrôle Osytools) : la bande « À plusieurs » de l'accueil sert des vignettes
// WebP 192 px faites depuis les artworks officiels (avant : 4 PNG 475 px, ≈ 460 Ko), et un lien « Contact » est en bas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('the home party band uses light local WebP artworks', () => {
  for (const id of [235, 132, 201, 479]) {
    assert.match(html, new RegExp('class="home-party-art"[^>]*><img src="img/home/' + id + '\\.webp"[^>]*width="96" height="96"'));
    const file = path.join(root, 'img', 'home', id + '.webp');
    assert.ok(fs.statSync(file).size < 20000, id + ' stays light');
    assert.equal(fs.readFileSync(file).subarray(8, 12).toString(), 'WEBP');
  }
  assert.doesNotMatch(html, /home-party-art"[^>]*><img src="https:\/\/cdn\.jsdelivr/);
});

test('the footer has a Contact link to the About page contact section', () => {
  assert.match(html, /<a href="\/a-propos#contact">Contact<\/a>/);
  assert.match(fs.readFileSync(path.join(root, 'lib', 'seo-render.js'), 'utf8'), /<h2 id="contact">Contact<\/h2>/);
});
