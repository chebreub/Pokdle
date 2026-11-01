'use strict';
// « Mes Pokémon préférés » (01/11/2026): the favourites table rebuilt. Same keys as before (nothing
// chosen is lost), a shiny table under « s: » keys, a picker limited to the type and generation, a
// dice for empty cells only, an image to share, and a card in « Jouer ».
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const src = read('src/script.10xo.favorites-grid.js');

function load(choices = {}) {
  const list = [
    { id: 4, name: 'Salamèche', gen: 1, type1: 'Feu' }, { id: 6, name: 'Dracaufeu', gen: 1, type1: 'Feu', type2: 'Vol' },
    { id: 155, name: 'Héricendre', gen: 2, type1: 'Feu' }, { id: 7, name: 'Carapuce', gen: 1, type1: 'Eau' },
  ];
  const ctx = {
    window: {}, document: { getElementById: () => null, querySelectorAll: () => [], body: null, fonts: { load: async () => {} } },
    rankingChoices: { ...choices }, saved: 0, rendered: 0,
    POKEMON_LIST: list, POKEMON_BY_ID: new Map(list.map((p) => [p.id, p])),
    RANKING_COLUMNS: [{ key: 'type|Feu', label: 'Feu', matcher: (p) => p.type1 === 'Feu' || p.type2 === 'Feu' }, { key: 'type|Eau', label: 'Eau', matcher: (p) => p.type1 === 'Eau' || p.type2 === 'Eau' }, { key: 'starter', label: 'Starter', matcher: (p) => [4, 7].includes(p.id) }],
    rankingCellKey: (g, c) => g + '|' + c, rankingFavoriteKey: (g) => 'fav|' + g, rankingFavoriteRowKey: (c) => 'favrow|' + c,
    getPokemonSprite: (p) => 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/' + p.id + '.png',
    getPokemonDexNumber: (p) => p.id, getTypeIconPath: (t) => '/types/' + t + '.png', pokedexDetailArtwork: (p, s) => 'art-' + (s ? 'shiny-' : '') + p.id,
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'), norm: (s) => String(s).toLowerCase(),
    confirm: () => true, showToast: () => {}, matchMedia: () => ({ matches: true }),
  };
  ctx.saveRankingChoices = () => { ctx.saved += 1; };
  vm.createContext(ctx);
  vm.runInContext(src.replace(/function renderRankingGrid\(\) \{/, 'function renderRankingGrid() { rendered += 1; return;'), ctx);
  return ctx;
}

test('the choices keep their keys; the shiny table uses the same keys with « s: »', () => {
  const c = load({ '1|type|Feu': 6, 's:1|type|Feu': 4 });
  assert.equal(c.favPick('1|type|Feu', false).name, 'Dracaufeu', 'a choice made in the old table is still there');
  assert.equal(c.favPick('1|type|Feu', true).name, 'Salamèche');
  assert.equal(c.favKey('fav|1', true), 's:fav|1');
  assert.equal(c.favShinySpriteUrl('https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/6.png'), 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/shiny/6.png');
  assert.equal(c.favShinySpriteUrl('https://example.test/form.png'), 'https://example.test/form.png', 'an unknown address stays as it is');
});

test('a cell offers its type and generation only; a favourite picks among the cells', () => {
  const c = load({ '1|type|Feu': 6, '1|type|Eau': 7, '2|type|Feu': 155 });
  assert.deepEqual([...c.favCandidates('cell', 1, 'type|Feu')].map((p) => p.name), ['Salamèche', 'Dracaufeu']);
  assert.deepEqual([...c.favCandidates('gen', 1, '')].map((p) => p.name), ['Dracaufeu', 'Carapuce']);
  assert.deepEqual([...c.favCandidates('type', 0, 'type|Feu')].map((p) => p.name), ['Dracaufeu', 'Héricendre']);
  assert.equal(c.favCandidates('top', 0, 'favorite').length, 3, 'no favourite yet: the n°1 picks among every cell');
  c.rankingChoices['fav|1'] = 6;
  assert.deepEqual([...c.favCandidates('top', 0, 'favorite')].map((p) => p.name), ['Dracaufeu'], 'then among the favourites');
});

test('the dice fills empty cells only, with a Pokémon that fits; « Vider » empties one table', () => {
  const c = load({ '1|type|Feu': 6, 's:1|type|Eau': 7 });
  const n = c.favRandomFill(() => 0);
  assert.equal(c.rankingChoices['1|type|Feu'], 6, 'a chosen cell is kept');
  assert.equal(c.rankingChoices['1|type|Eau'], 7);
  assert.equal(c.rankingChoices['1|starter'], 4);
  assert.equal(c.rankingChoices['2|type|Feu'], 155);
  assert.equal(c.rankingChoices['fav|1'], undefined, 'favourites stay for the player');
  assert.ok(n >= 3 && c.saved === 1);
  c.favResetGrid();
  assert.deepEqual(Object.keys(c.rankingChoices), ['s:1|type|Eau'], 'the shiny table is untouched');
  assert.equal(c.favCellCount(true), 1);
});

test('the phone table fits the width: types in rows, 9 generations and ❤️ in columns', () => {
  const c = load({ '1|type|Feu': 6 });
  const html = c.favTallGridHtml();
  assert.equal((html.match(/fav-gen-head/g) || []).length, 9);
  assert.equal((html.match(/fav-row-head/g) || []).length, 4, '3 columns of the test + the ❤️ row');
  assert.match(html, /data-action="openFavPicker" data-args="\[&quot;cell&quot;,&quot;1\|type\|Feu&quot;,1,&quot;type\|Feu&quot;\]"[^>]*title="Dracaufeu"><img src="https:\/\/cdn\.jsdelivr\.net[^"]*\/6\.png"/);
  assert.match(html, /class="fav-cell is-none"/, 'a generation without such a Pokémon shows a plain square');
  assert.match(html, /aria-label="Ton n°1 : à choisir"/);
  const wide = c.favWideGridHtml();
  assert.equal((wide.match(/fav-col-head/g) || []).length, 3);
  assert.match(wide, /<b>Gen 9<\/b><small>Paldea<\/small>/);
});

test('the table is easy to find: a card in « Jouer », a game page, the old Favoris button', () => {
  const html = read('index.html');
  assert.match(html, /data-category="solo" data-action="openFromAllModes" data-args='\["openRankingMode"\]'[^>]*><div class="pk-tile pk-tile-sm"><svg class="pk-ico"><use href="#i-grid"\/><\/svg><\/div><b>Mes Pokémon préférés<\/b>/);
  assert.match(html, /data-action="openRankingMode">Favoris<\/button>/, 'still in the profile');
  assert.match(read('src/script.08.catalog.js'), /openRankingMode:\{ids:\[6,700\]/);
  assert.match(read('src/script.10z.landing-links.js'), /'pokemon-prefere-par-type': \['openRankingMode'\]/);
  const { GAMES } = require('../lib/seo-games');
  const page = GAMES.find((g) => g.slug === 'pokemon-prefere-par-type');
  assert.ok(page && page.cta === 'Faire ma grille');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'img/og/pokemon-prefere-par-type.jpg')));
  // The image to share: a story, drawn from the same keys, with the site's address.
  assert.match(src, /const FAV_IMG = Object\.freeze\(\{ w: 1080, h: 1920/);
  assert.match(src, /ctx\.fillText\("pokdle\.fr"/);
  assert.match(src, /img\.crossOrigin = "anonymous"/, 'the canvas stays exportable');
});
