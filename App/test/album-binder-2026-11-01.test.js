'use strict';
// 📒 Mon album (01/11/2026): one binder per region in Pokédex order, 🥉 at a quarter, 🥈 at half,
// 🥇 complete; medals given once (XP once), kept in the profile and shown on the trainer card.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function load(discoveries, extra = {}) {
  const awarded = [], toasts = [];
  const catalogue = [];
  for (let id = 1; id <= 151; id++) catalogue.push({ id, gen: 1, name: 'P' + id });
  for (let id = 152; id <= 251; id++) catalogue.push({ id, gen: 2, name: 'P' + id });
  const c = {
    playerProfile: { discoveries, ...extra },
    POKEDEX_COLLECTION_REGIONS: ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unys', 'Kalos', 'Alola', 'Galar', 'Paldea'],
    pokedexCollectionBaseCatalogue: () => catalogue,
    pokedexCollectionState: (p) => ({ kind: p.id === 151 ? 'secret' : 'unknown' }),
    pokedexDetailArtwork: (p, shiny) => '/art/' + (shiny ? 'shiny/' : '') + p.id + '.png',
    getPokemonSprite: (p) => '/sprite/' + p.id + '.png',
    escapeHtml: (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])),
    awardXp: (n, why) => awarded.push([n, why]),
    saveProfile() {},
    showToast: (t) => toasts.push(t),
    setTimeout: (fn) => fn(),
    openDiscoveryAlbum() {},
    window: { addEventListener() {} },
    document: { querySelector: () => null, getElementById: () => null },
  };
  vm.createContext(c);
  vm.runInContext(read('src/script.10xw.album-binder.js'), c);
  return { c, awarded, toasts };
}
const found = (ids, shiny = []) => Object.fromEntries(ids.map((id) => [id, { at: 1, mode: 'normal', ...(shiny.includes(id) ? { shiny: '2026-11-01' } : {}) }]));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('medals: a quarter, half, complete; given once, XP once, gold relies on the region XP', () => {
  const { c, awarded, toasts } = load(found(range(1, 37)));
  assert.equal(c.albumStats(1).found, 37);
  assert.equal(c.albumTierNeed(c.ALBUM_TIERS[0], 151), 38, 'a quarter of Kanto, rounded up');
  assert.equal(c.albumClaimMedals(false).length, 0, '37 of 151: no medal yet');
  c.playerProfile.discoveries[38] = { at: 1 };
  const fresh = c.albumClaimMedals(false);
  assert.deepEqual(Array.from(fresh, (m) => m.gen + ':' + m.tier.key), ['1:b']);
  assert.deepEqual(awarded, [[100, 'Médaille d’album']]);
  assert.match(toasts.at(-1), /🥉 Médaille de bronze · Kanto : un quart de Kanto dans ton album ! \+100 XP/);
  assert.equal(c.albumClaimMedals(false).length, 0, 'once');
  assert.ok(c.playerProfile.albumMedals['1:b'] > 0);

  // Before this version: medals already deserved come at once, quietly, in one line.
  const old = load(found(range(1, 151).concat(range(152, 210))));
  old.c.albumClaimMedals(true);
  assert.deepEqual(Object.keys(old.c.playerProfile.albumMedals).sort(), ['1:b', '1:g', '1:s', '2:b', '2:s']);
  assert.deepEqual(old.awarded, [[100 + 200 + 0 + 100 + 200, 'Médailles d’album']], 'no XP for gold: the complete region already gives 1 000');
  assert.equal(old.toasts.length, 1);
  assert.match(old.toasts[0], /🥉 Kanto, 🥈 Kanto, 🥇 Kanto, 🥉 Johto, 🥈 Johto · \+600 XP/);
});

test('the binder: Pokédex order, 9 a page, silhouettes, secrets kept, shinies framed, next medal', () => {
  const { c } = load(found([1, 2, 5, 6, 7, 9], [5]));
  c.albumView.gen = 1; c.albumView.page = 0;
  const html = c.albumBinderHtml();
  assert.equal((html.match(/class="alb-slot/g) || []).length, 9);
  assert.match(html, /#001<\/span><img src="\/art\/1\.png"/);
  assert.match(html, /alb-slot is-shiny"><span class="alb-num">#005<\/span><span class="alb-sp" aria-label="shiny">✨<\/span><img src="\/art\/shiny\/5\.png"/);
  assert.match(html, /alb-slot is-miss"><span class="alb-num">#003<\/span><img class="alb-shadow"/);
  assert.match(html, /Page 1 \/ 17 · 6 sur 9/);
  assert.match(html, /Il te manque le #003/);
  assert.match(html, /data-action="albumPlayGen" data-args="\[1\]">Jouer Gen 1/);
  c.albumView.page = 16;
  assert.match(c.albumBinderHtml(), /alb-slot is-miss is-secret"><span class="alb-num">#151<\/span><span class="alb-mark" aria-hidden="true">✦<\/span>/, 'a secret entry shows no silhouette');
  const goal = c.albumNextGoal();
  assert.equal(goal.stats.name, 'Kanto', 'a region already started, not an empty one');
  assert.equal(goal.left, 32);
  assert.equal(goal.tier.icon, '🥉');
});

test('the trainer card: album total and best medal per region, from the profile only', () => {
  const { albumOf } = require('../lib/player-cards');
  assert.deepEqual(albumOf({}), { found: 0, total: 1025, medals: [] });
  const out = albumOf({ discoveries: { 1: {}, 25: {}, 10034: {}, abc: {} }, albumMedals: { '1:b': 1, '1:s': 2, '2:b': 3, '9:x': 4, '<b>': 5 } });
  assert.deepEqual(out, { found: 2, total: 1025, medals: [{ gen: 1, tier: 's' }, { gen: 2, tier: 'b' }] }, 'forms and odd keys ignored');
});

test('wired in: account menu and home strip open the album, medals merge across devices', () => {
  const src = read('src/script.10xw.album-binder.js');
  assert.match(src, /openDiscoveryAlbum = function \(\) \{ openAlbumBinder\(\); \};/);
  assert.match(src, /recordPokemonDiscovery = function \(\) \{/);
  assert.match(src, /if \(out\) albumClaimMedals\(false\);/);
  assert.match(read('src/script.07a.profile-merge.js'), /"weeklyLeagueBadges", "albumMedals"\]/);
  assert.match(read('lib/player-cards.js'), /album: albumOf\(profile\),/);
});
