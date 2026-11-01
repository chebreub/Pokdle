'use strict';
// Une page Google par Pokémon (01/11/2026): /pokemon/<nom> for the 1025 Pokémon, built from the
// site's own data (types, generation, size, weight, stats), weaknesses computed with the guides'
// type chart, the clues of the Pokémon du jour, links to the games; a hub, the sitemap, redirects.
const test = require('node:test');
const assert = require('node:assert/strict');
const seo = require('../lib/seo-pokemon');
const { renderPokemonPage, renderPokemonHub, sitemapXml, mountSeoPages } = require('../lib/seo-render');

test('one address per Pokémon, readable and unique', () => {
  assert.equal(seo.BASE.length, 1025);
  assert.equal(seo.BY_SLUG.size, 1025);
  const at = (id) => seo.SLUGS.get(id);
  assert.equal(at(25), 'pikachu');
  assert.equal(at(29), 'nidoran-f');
  assert.equal(at(32), 'nidoran-m');
  assert.equal(at(122), 'm-mime');
  assert.equal(at(250), 'ho-oh');
  assert.equal(at(772), 'type-0');
  for (const slug of seo.BY_SLUG.keys()) assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, slug);
});

test('weaknesses multiply both types: ×4, ×2, ×½, ×¼ and immunities', () => {
  const w = (id) => seo.weaknesses(seo.BASE[id - 1]);
  assert.deepEqual(w(6).x4, ['Roche'], 'Dracaufeu (Feu/Vol)');
  assert.deepEqual(w(6).none, ['Sol']);
  assert.ok(w(6).quarter.includes('Plante') && w(6).quarter.includes('Insecte'));
  assert.deepEqual(w(208).none.sort(), ['Poison', 'Électrik'].sort(), 'Steelix (Acier/Sol)');
  assert.deepEqual(w(25).x2, ['Sol'], 'Pikachu');
  assert.deepEqual(w(92).none.sort(), ['Combat', 'Normal'].sort(), 'Fantominus (Spectre/Poison)');
});

test('every page renders without a hole, with its own title, FAQ data and links', () => {
  for (const p of seo.BASE) {
    const html = renderPokemonPage(p.id);
    assert.doesNotMatch(html, /undefined|NaN|>null</, 'page ' + p.id);
    assert.match(html, new RegExp('<link rel="canonical" href="[^"]+/pokemon/' + seo.SLUGS.get(p.id) + '">'));
  }
  const html = renderPokemonPage(25);
  assert.match(html, /<title>Pikachu \(n° 25\) : type Électrik, faiblesses, taille et poids · Pokédle<\/title>/);
  assert.match(html, /<h1>Pikachu<\/h1>/);
  assert.match(html, /Pikachu est un Pokémon de type Électrik de la 1re génération \(région de Kanto\), n° 25 du Pokédex national\. Il mesure 0,4 m pour 6 kg\./);
  assert.match(html, /<meta property="og:image" content="https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/master\/sprites\/pokemon\/other\/official-artwork\/25\.png">/);
  assert.match(html, /<meta name="twitter:card" content="summary">/, 'a square artwork');
  assert.match(html, /href="\/\?pokedex=25">Sa fiche dans le Pokédex/);
  assert.match(html, /← <a href="\/pokemon\/raichu"|<a href="\/pokemon\/raichu">Raichu<\/a> →/);
  assert.match(html, /<a href="\/pokemon\/pichu">|<a href="\/pokemon\/raichu">/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  const faq = ld['@graph'].find((node) => node['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity[0].name, 'Quel est le type de Pikachu ?');
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, 'Pikachu est de type Électrik.');
  // The clues are the ones the Pokémon du jour compares.
  assert.match(html, /<small>Habitat<\/small><b>Forêt<\/b>/);
  assert.match(html, /<small>Couleur<\/small><b>Jaune<\/b>/);
  assert.match(renderPokemonPage(150), /<span class="tag">Légendaire<\/span>/);
  assert.match(renderPokemonPage(151), /<span class="tag">Fabuleux<\/span>/);
  assert.match(renderPokemonPage(1), /<span class="tag">Pokémon de départ<\/span>/);
  assert.equal(renderPokemonPage(1026), null);
});

test('the hub lists the 1025 by generation; the sitemap has them all', () => {
  const hub = renderPokemonHub();
  assert.equal((hub.match(/<li><small>\d{4}<\/small> <a href="\/pokemon\//g) || []).length, 1025);
  assert.match(hub, /<h2 id="gen-9">9<sup>e<\/sup> génération · Paldea · 120 Pokémon<\/h2>/);
  const sitemap = sitemapXml();
  assert.match(sitemap, /\/pokemon\/pikachu<\/loc>/);
  assert.match(sitemap, /\/pokemon<\/loc>/);
  assert.ok((sitemap.match(/<url>/g) || []).length >= 1025 + 30);
});

test('the routes: page, hub, redirects to the right address, unknown name falls through', async () => {
  const express = require('express');
  const app = express();
  mountSeoPages(app);
  app.use((_req, res) => res.status(404).send('404'));
  const server = app.listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const page = await fetch(base + '/pokemon/pikachu');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<h1>Pikachu<\/h1>/);
    assert.equal((await fetch(base + '/pokemon')).status, 200);
    const upper = await fetch(base + '/pokemon/Pikachu', { redirect: 'manual' });
    assert.equal(upper.status, 301);
    assert.equal(upper.headers.get('location'), '/pokemon/pikachu');
    const byNumber = await fetch(base + '/pokemon/25', { redirect: 'manual' });
    assert.equal(byNumber.status, 301);
    assert.equal(byNumber.headers.get('location'), '/pokemon/pikachu');
    assert.equal((await fetch(base + '/pokemon/pas-un-pokemon')).status, 404);
  } finally { server.close(); }
});
