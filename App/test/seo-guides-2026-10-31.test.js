'use strict';
// The guides (31/10/2026): every rule they state is the game's own rule.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { GUIDES, TYPE_CHART, TYPE_ICONS, GENERATIONS, STARTERS, LEGENDARIES, MYTHICALS, ULTRA_BEASTS, PARADOX_LEGENDS } = require('../lib/seo-guides');
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
      const gamePage = renderGamePage(GAMES.find((game) => game.slug === slug));
      const block = gamePage.match(/<h2>(?:Le guide|Les guides) pour progresser<\/h2>\n<ul class="grid">(.*?)<\/ul>/);
      assert.ok(block && block[1].includes('<a href="/guides/' + g.slug + '">'), slug + ' links to ' + g.slug);
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

const BASE = POKEMON.filter((p) => p.id >= 1 && p.id <= 1025 && !p.isAltForm);
const byId = (id) => BASE.find((p) => p.id === id);

test('the generations guide: every number range, count and record comes from the Pokédex', () => {
  assert.equal(GENERATIONS.length, 9);
  assert.equal(GENERATIONS[0].from, 1);
  assert.equal(GENERATIONS[8].to, 1025);
  for (const [i, g] of GENERATIONS.entries()) {
    if (i) assert.equal(g.from, GENERATIONS[i - 1].to + 1);
    const ids = BASE.filter((p) => p.gen === g.gen).map((p) => p.id);
    assert.equal(ids.length, g.to - g.from + 1, 'gen ' + g.gen);
    assert.ok(ids.every((id) => id >= g.from && id <= g.to), 'gen ' + g.gen + ' range');
    if (g.gen === 5) assert.equal(byId(g.from).name, 'Victini', 'the one generation that does not open on its starters');
    else assert.equal(g.from, STARTERS[i][0], 'gen ' + g.gen + ' opens on its Plante starter');
  }
  const counts = GENERATIONS.map((g) => [g.gen, g.to - g.from + 1]).sort((a, b) => b[1] - a[1]);
  const text = JSON.stringify(guide('generations-pokemon'));
  assert.deepEqual(counts[0], [5, 156]);
  assert.deepEqual(counts[8], [6, 72]);
  assert.match(text, /La 5e, celle d’Unys, avec 156 nouveaux Pokémon/);
  assert.match(text, /La 6e, celle de Kalos, avec 72 nouveaux Pokémon/);
  assert.match(text, /Bulbizarre \(n° 1\), Germignon \(n° 152\), Arcko \(n° 252\)… Seule exception, la 5e commence par Victini \(n° 494\)/);
  assert.match(JSON.stringify(GAMES.find((game) => game.slug === 'ordre-pokedex').tips), /la 5e commence par Victini, n° 494/);
  assert.deepEqual([1, 152, 252].map((id) => byId(id).name), ['Bulbizarre', 'Germignon', 'Arcko']);
  const regions = read('src/script.10d.pokedex-collection.js').match(/POKEDEX_COLLECTION_REGIONS = \[([^\]]+)\]/)[1].replace(/'/g, '').split(',');
  assert.deepEqual(GENERATIONS.map((g) => g.region), regions, 'the region names of the site');
});

test('the starters guide: Plante, Feu, Eau, finals two numbers later, curiosities counted', () => {
  assert.equal(STARTERS.length, 9);
  for (const trio of STARTERS) {
    assert.deepEqual(trio.map((id) => byId(id).type1), ['Plante', 'Feu', 'Eau']);
    for (const id of trio) assert.equal(byId(id + 2).stage, 3, byId(id + 2).name + ' is a final stage');
  }
  assert.ok(TYPE_CHART.Plante.super.includes('Eau') && TYPE_CHART.Eau.super.includes('Feu') && TYPE_CHART.Feu.super.includes('Plante'));
  const all = STARTERS.flat();
  const twoTypes = all.filter((id) => byId(id).type2).map((id) => byId(id).name);
  assert.deepEqual(twoTypes, ['Bulbizarre', 'Brindibou']);
  const fireFighting = STARTERS.map((t) => byId(t[1] + 2)).filter((p) => p.type2 === 'Combat').map((p) => p.name);
  assert.deepEqual(fireFighting, ['Braségali', 'Simiabraz', 'Roitiflam']);
  const single = all.map((id) => byId(id + 2)).filter((p) => !p.type2).map((p) => p.name);
  assert.equal(single.length, 10);
  assert.ok(single.includes('Tortank') && single.includes('Typhlosion'));
  const text = JSON.stringify(guide('starters-pokemon'));
  assert.match(text, /Bulbizarre \(Plante et Poison\) et Brindibou \(Plante et Vol\)/);
  assert.match(text, /Trois starters Feu finissent Feu et Combat : Braségali, Simiabraz et Roitiflam/);
  assert.match(text, /10 évolutions finales sur 27 n’ont qu’un seul type, comme Tortank ou Typhlosion/);
  assert.deepEqual(STARTERS[8].map((id) => byId(id).name), ['Poussacha', 'Chochodile', 'Coiffeton']);
  assert.match(renderGuidePage(guide('starters-pokemon')), /Salamèche<\/span><small>Feu · évolue en Dracaufeu \(Feu et Vol\)<\/small>/);
});

test('the legendaries guide: the categories add up to the site\'s « Légendes », counts and records', () => {
  const core = read('src/script.01.core.js');
  const site = JSON.parse(core.match(/POKEDEX_LEGENDARY_IDS = new Set\((\[[^\]]+\])\)/)[1]);
  const grid = JSON.parse(read('lib/daily-grid.js').match(/const LEGENDARY_IDS=new Set\((\[[^\]]+\])\)/)[1]);
  const legendaries = Object.values(LEGENDARIES).flat();
  const union = [...legendaries, ...MYTHICALS, ...ULTRA_BEASTS, ...PARADOX_LEGENDS].sort((a, b) => a - b);
  assert.equal(new Set(union).size, union.length, 'no Pokémon in two categories');
  assert.deepEqual(union, [...site].sort((a, b) => a - b));
  assert.deepEqual(union, [...grid].sort((a, b) => a - b));
  assert.deepEqual([legendaries.length, MYTHICALS.length, ULTRA_BEASTS.length, PARADOX_LEGENDS.length, union.length], [71, 23, 11, 6, 111]);
  for (const [gen, ids] of Object.entries(LEGENDARIES)) for (const id of ids) assert.equal(byId(id).gen, Number(gen), byId(id).name);
  const most = Math.max(...Object.values(LEGENDARIES).map((ids) => ids.length));
  assert.deepEqual(Object.entries(LEGENDARIES).filter(([, ids]) => ids.length === most).map(([gen]) => gen), ['7', '8', '9']);
  assert.equal(most, 11);
  assert.equal(byId(MYTHICALS[0]).name, 'Mew');
  assert.equal(MYTHICALS[0], 151);
  for (const name of ['Zéroïd', 'Mouscoto', 'Pierroteknik']) assert.ok(ULTRA_BEASTS.includes(BASE.find((p) => p.name === name).id), name);
  const text = JSON.stringify(guide('pokemon-legendaires'));
  assert.match(text, /71 légendaires, les 23 fabuleux, les 11 Ultra-Chimères et six Pokémon Paradoxe, soit 111 Pokémon/);
  assert.match(text, /Les 7e, 8e et 9e générations, avec 11 légendaires chacune/);
  const html = renderGuidePage(guide('pokemon-legendaires'));
  assert.equal((html.match(/<ul class="mons">/g) || []).length, 10, 'nine generations and the mythicals');
  assert.match(html, /Mewtwo<small>n° 150<\/small>/);
});
