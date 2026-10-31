'use strict';
// The guides (31/10/2026): every rule they state is the game's own rule.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { GUIDES, TYPE_CHART, TYPE_ICONS } = require('../lib/seo-guides');
const { renderGuidePage, renderGamePage, renderHubPage, sitemapXml, mountSeoPages } = require('../lib/seo-render');
const { GAMES } = require('../lib/seo-games');
const { shinyOdds } = require('../lib/daily-game');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const guide = (slug) => GUIDES.find((g) => g.slug === slug);
const text = (g) => JSON.stringify(g);
const POKEMON = JSON.parse(read('pokemon.js').match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/)[1]);
const byName = (name) => POKEMON.find((p) => p.name === name);

test('the guide\'s type chart is the one the site uses, and its claims follow from it', () => {
  const src = read('src/script.04.jeu-pokedex.js');
  const site = Function('return ' + src.slice(src.indexOf('{', src.indexOf('const TYPE_EFFECTIVENESS = ')), src.indexOf('};', src.indexOf('const TYPE_EFFECTIVENESS = ')) + 1))();
  assert.deepEqual(JSON.parse(JSON.stringify(TYPE_CHART)), site);
  assert.equal(Object.keys(TYPE_CHART).length, 18);
  for (const type of Object.keys(TYPE_CHART)) assert.ok(fs.existsSync(path.join(__dirname, '../img/type-icons', TYPE_ICONS[type] + '.svg')), type);

  const strongest = Object.entries(TYPE_CHART).map(([type, row]) => [type, row.super.length]).sort((a, b) => b[1] - a[1]);
  assert.deepEqual(strongest.filter(([, n]) => n === 5).map(([t]) => t).sort(), ['Combat', 'Sol']);
  assert.deepEqual(strongest.filter(([, n]) => n === 4).map(([t]) => t).sort(), ['Feu', 'Glace', 'Roche']);
  assert.equal(TYPE_CHART.Normal.super.length, 0);
  const g = guide('table-des-types-pokemon');
  assert.match(text(g), /Combat et Sol sont super efficaces contre 5 types chacun\. Feu, Glace et Roche suivent avec 4\. À l’inverse, Normal n’est super efficace contre aucun type\./);

  // The immunities: eight pairs, all listed.
  const immunities = Object.entries(TYPE_CHART).flatMap(([attack, row]) => row.no.map((defence) => [attack, defence]));
  assert.equal(immunities.length, 8);
  const items = g.sections.find((s) => s.h2 === 'Les 8 immunités à connaître').list;
  for (const [attack, defence] of immunities) {
    assert.ok(items.some((item) => item.split(' ne touche')[0].split(' et ').includes(attack) && item.endsWith(' pas ' + defence + '.')), attack + ' → ' + defence);
  }
  assert.equal(items.flatMap((item) => item.split(' ne touche')[0].split(' et ')).length, 8, 'no immunity that does not exist');

  // ×4 and ×¼ examples: the real types of Dracolosse and Dracaufeu.
  const factor = (attack, pokemon) => [pokemon.type1, pokemon.type2].filter(Boolean)
    .reduce((m, t) => m * (TYPE_CHART[attack].super.includes(t) ? 2 : TYPE_CHART[attack].not.includes(t) ? 0.5 : TYPE_CHART[attack].no.includes(t) ? 0 : 1), 1);
  assert.equal(factor('Glace', byName('Dracolosse')), 4);
  assert.equal(factor('Plante', byName('Dracaufeu')), 0.25);
  assert.match(text(g), /Glace contre Dracolosse \(Dragon et Vol\)/);
  assert.match(text(g), /Plante contre Dracaufeu \(Feu et Vol\)/);
  assert.deepEqual([byName('Dracolosse').type1, byName('Dracolosse').type2], ['Dragon', 'Vol']);
  assert.match(text(g), /Poison et Acier sont super efficaces contre Fée\. Fée, lui, est super efficace contre Combat, Dragon et Ténèbres\./);
  assert.deepEqual(Object.entries(TYPE_CHART).filter(([, row]) => row.super.includes('Fée')).map(([t]) => t).sort(), ['Acier', 'Poison']);
  assert.deepEqual(TYPE_CHART.Fée.super, ['Combat', 'Dragon', 'Ténèbres']);
  assert.match(read('src/script.04.jeu-pokedex.js'), /label: "Gen 1",[\s\S]*label: "Gen 2-5",[\s\S]*label: "Gen 6\+"/, 'the three eras of the site\'s chart');
});

test('the Pokémon du jour method states the real comparison, points and odds', () => {
  const g = text(guide('methode-pokemon-du-jour'));
  const compare = read('lib/daily-comparison.js');
  assert.match(compare, /height:numeric\(guess\.height,secret\.height,0\.3\),weight:numeric\(guess\.weight,secret\.weight,15\)/);
  assert.match(g, /orange à 0,3 m près[\s\S]*orange à 15 kg près/);
  assert.match(compare, /type1:guess\.type1===secret\.type1\?"ok":guess\.type1&&guess\.type1===secret\.type2\?"close"/);
  assert.match(g, /orange s’il existe mais à l’autre place/);
  assert.match(compare, /color:!overlap\?"wrong":overlap===g\.size&&overlap===s\.size\?"ok":"close"/);
  assert.match(g, /orange si une couleur est en commun/);
  // Targets are base species only.
  assert.match(read('lib/daily-game.js'), /const pool=pokemon\.filter\(p=>p&&!p\.isAltForm&&/);
  assert.match(g, /toujours une forme de base/);
  assert.match(read('lib/daily-points.js'), /const ENQUIRY_TRY_COST = 2, ENQUIRY_HINT_COST = 4, ENQUIRY_FLOOR = 4;/);
  assert.match(read('lib/daily-points.js'), /enquiry:40/);
  assert.match(g, /40 points si tu trouves du premier coup, 2 de moins par essai en plus, et au moins 4 points/);
  assert.match(g, /Un indice coûte 4 points/);
  assert.deepEqual([0, 7, 30].map(shinyOdds), [40, 30, 20]);
  assert.match(g, /1 sur 40, 1 sur 30 dès 7 jours de série, 1 sur 20 dès 30 jours/);
  assert.equal((g.match(/Génération|Forme|Types 1 et 2|Habitat|Couleur|Stade d’évolution|Taille|Poids/g) || []).length >= 8, true);
});

test('each guide is a findable page: titles, structured data, sitemap and links from the games', async (t) => {
  for (const g of GUIDES) {
    assert.ok(g.title.length <= 62 && g.description.length >= 90 && g.description.length <= 160, g.slug);
    const html = renderGuidePage(g);
    assert.ok(html.includes('<link rel="canonical" href="https://pokdle.fr/guides/' + g.slug + '">'));
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])['@graph'];
    assert.deepEqual(graph.map((node) => node['@type']), ['Article', 'BreadcrumbList', 'FAQPage']);
    assert.ok(!/<script(?! type="application\/ld\+json")/.test(html), 'no executable script');
    assert.ok(html.includes('href="' + g.cta.href + '"'));
    for (const slug of g.games) {
      assert.ok(GAMES.some((game) => game.slug === slug), slug);
      assert.match(renderGamePage(GAMES.find((game) => game.slug === slug)), new RegExp('<h2>Le guide pour progresser</h2>\\n<ul class="grid"><li><a href="/guides/' + g.slug + '">'));
    }
    assert.match(sitemapXml(), new RegExp('<loc>https://pokdle\\.fr/guides/' + g.slug + '</loc>'));
  }
  assert.equal((renderGuidePage(guide('table-des-types-pokemon')).match(/<tr><th scope="row">/g) || []).length, 18);
  assert.match(renderHubPage(), /<h2>Guides<\/h2>/);

  const app = express();
  mountSeoPages(app);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.match(await (await fetch(base + '/guides')).text(), /<h1>Guides Pokémon<\/h1>/);
  assert.match(await (await fetch(base + '/guides/methode-pokemon-du-jour')).text(), /<h1>Pokémon du jour : la méthode/);
  const unknown = await fetch(base + '/guides/inconnu', { redirect: 'manual' });
  assert.equal(unknown.status, 301);
  assert.equal(unknown.headers.get('location'), '/guides');
});
