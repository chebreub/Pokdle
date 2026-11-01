'use strict';
// « Mon équipe » (01/11/2026): the Team Builder made visual. The builder underneath does not change
// (moves, item, nature, EV/IV, Téra, analysis, saved teams, import/export); on top: big cards,
// « Ton équipe face aux types », the editor in tabs (a sheet on a phone), a randomizer that keeps the
// 🔒 Pokémon, and an image of the team to share.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const src = read('src/script.10xp.team-builder-v2.js');
const pokedexSrc = read('src/script.04.jeu-pokedex.js');
// The real type chart and multiplier, so the coverage is checked against the site's own rules.
const typeChart = pokedexSrc.match(/const TYPE_EFFECTIVENESS = \{[\s\S]*?\n\};/)[0];
const multiplier = pokedexSrc.match(/function attackMultiplier\(attackType, defenseType\) \{[\s\S]*?\n\}/)[0];

const LIST = [
  { id: 6, name: 'Dracaufeu', gen: 1, type1: 'Feu', type2: 'Vol' },
  { id: 130, name: 'Léviator', gen: 1, type1: 'Eau', type2: 'Vol' },
  { id: 10, name: 'Chenipan', gen: 1, type1: 'Insecte' },
  { id: 150, name: 'Mewtwo', gen: 1, type1: 'Psy' },
  { id: 248, name: 'Tyranocif', gen: 2, type1: 'Roche', type2: 'Ténèbres' },
  { id: 445, name: 'Carchacrok', gen: 4, type1: 'Dragon', type2: 'Sol' },
  { id: 448, name: 'Lucario', gen: 4, type1: 'Combat', type2: 'Acier' },
  { id: 282, name: 'Gardevoir', gen: 3, type1: 'Psy', type2: 'Fée' },
  { id: 609, name: 'Lugulabre', gen: 5, type1: 'Spectre', type2: 'Feu' },
  { id: 10034, name: 'Méga-Dracaufeu X', gen: 6, type1: 'Feu', type2: 'Dragon', isAltForm: true },
  { id: 908, name: 'Miascarade', gen: 9, type1: 'Plante', type2: 'Ténèbres' },
];
// A move pool as the site builds it: the Pokémon's own types first, with « joke » moves inside.
const MOVES = [
  { name: 'Flammèche', types: ['Feu'] }, { name: 'Lance-Flammes', types: ['Feu'] }, { name: 'Lame d’Air', types: ['Vol'] },
  { name: 'Séisme', types: ['Sol'] }, { name: 'Abri', types: [] }, { name: 'Métronome', types: [] }, { name: 'Attraction', types: [] },
  { name: 'Danse-Lames', types: [] },
];
const STATS = { 6: [78, 84, 78, 109, 85, 100], 130: [95, 125, 79, 60, 100, 81], 10: [45, 30, 35, 20, 20, 45], 150: [106, 110, 90, 154, 90, 130], 248: [100, 134, 110, 95, 100, 61], 445: [108, 130, 95, 80, 85, 102], 448: [70, 110, 70, 115, 70, 90], 282: [68, 65, 65, 125, 115, 80], 609: [60, 55, 90, 145, 90, 80], 908: [76, 110, 70, 81, 70, 123] };

function load(state) {
  const empty = () => ({ pokemonId: null, item: '', gimmick: '', teraType: '', moves: ['', '', '', ''], nature: 'Hardi', talent: '', evPreset: 'offensive-physique', evs: {}, ivPreset: 'all31', ivs: {} });
  const store = {};
  const ctx = {
    window: {}, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: { classList: { add() {}, remove() {} } } },
    POKEMON_LIST: LIST, LEGENDARY_IDS: new Set([150]),
    teamBuilderState: state || Array.from({ length: 6 }, empty), teamBuilderActiveSlot: 0,
    getTeamBuilderPokemon: (slot) => LIST.find((p) => p.id === slot?.pokemonId) || null,
    createTeamBuilderEmptySlot: empty,
    loadLocalBaseStats: async () => STATS, getMysteryApiId: (p) => p.id,
    TEAM_BUILDER_ITEMS: ['Aucun', 'Restes', 'Evoluroc', 'Orbe Vie'], TEAM_BUILDER_NATURES: [{ value: 'Rigide' }, { value: 'Modeste' }],
    getTeamBuilderMovePoolForPokemon: async () => [],
    getTeamBuilderMovePool: () => MOVES,
    TEAM_BUILDER_MOVE_LIBRARY: [{ name: 'Séisme' }, { name: 'Lance-Flammes' }, { name: 'Abri' }, { name: 'Métronome' }],
    applyTeamBuilderSpreadPreset: (slot, value) => { slot.evPreset = value; },
    readJson: (k, d) => (k in store ? store[k] : d), writeJson: (k, v) => { store[k] = v; },
    saved: 0, rendered: 0, toasts: [],
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    getTypeIconPath: (t) => '/types/' + t + '.png', typeBadgesHtml: () => '', pokedexDetailArtwork: (p) => 'art-' + p.id, getPokemonSprite: (p) => 'sprite-' + p.id,
    setTimeout: (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; },
    Promise, Math, Set, Map, Number, String, Array, Object,
  };
  ctx.saveTeamBuilderState = () => { ctx.saved += 1; };
  ctx.renderTeamBuilderModule = () => { ctx.rendered += 1; };
  ctx.closeRankingPicker = () => {};
  ctx.showToast = (m) => ctx.toasts.push(m);
  vm.createContext(ctx);
  vm.runInContext(typeChart + '\n' + multiplier + '\n' + src, ctx);
  ctx.store = store;
  return ctx;
}
const slotOf = (id) => ({ pokemonId: id, item: '', moves: ['', '', '', ''] });
// A fixed sequence instead of Math.random.
const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };

test('« Ton équipe face aux types »: a type 2 Pokémon fear is flagged, with the real type chart', () => {
  const c = load([slotOf(6), slotOf(130), {}, {}, {}, {}]);
  const cov = c.tbCoverage();
  assert.equal(cov.size, 2);
  assert.equal(cov.rows.length, 18, 'one cell per type');
  const elec = cov.rows.find((r) => r.type === 'Électrik');
  assert.deepEqual([elec.weak, elec.resist], [2, 0], 'Dracaufeu and Léviator both fear Électrik');
  assert.deepEqual(cov.weak.map((r) => r.type).sort(), ['Roche', 'Électrik'].sort());
  const sol = cov.rows.find((r) => r.type === 'Sol');
  assert.equal(sol.weak, 0, 'Vol is immune to Sol: not a weakness');
  const html = c.tbCoverageHtml(cov);
  assert.match(html, /Craint surtout <b>(Roche et Électrik|Électrik et Roche)<\/b>/);
  assert.equal((html.match(/class="tb-cov-cell"/g) || []).length, 18);
  assert.match(html, /<em class="is-bad">−2<\/em>/);
  // Under 2 Pokémon: a sentence, no empty table.
  const one = load([slotOf(6), {}, {}, {}, {}, {}]);
  assert.match(one.tbCoverageHtml(), /Ajoute au moins 2 Pokémon/);
});

test('the randomizer pool: chosen generations, no alternate forms, no legendaries, strong Pokémon only', async () => {
  const c = load();
  const names = (pool) => pool.map((p) => p.name).sort();
  const all = await c.tbRandomPool({ gens: [1, 2, 3, 4, 5, 6, 7, 8, 9], strong: true, noLegend: true, varied: true, sets: true });
  assert.ok(!names(all).includes('Chenipan'), 'pas de Chenipan');
  assert.ok(!names(all).includes('Mewtwo'), 'no legendary');
  assert.ok(!names(all).includes('Méga-Dracaufeu X'), 'no alternate form');
  const withLegends = await c.tbRandomPool({ gens: [1], strong: false, noLegend: false });
  assert.deepEqual(names(withLegends), ['Chenipan', 'Dracaufeu', 'Léviator', 'Mewtwo'].sort());
  // « strong » never leaves fewer than 6 Pokémon to draw from.
  const gen1 = await c.tbRandomPool({ gens: [1], strong: true, noLegend: true });
  assert.ok(names(gen1).includes('Chenipan'), 'too few strong Pokémon: the rule is relaxed');
});

test('a drawn team has no Pokémon twice, keeps the locked ones out, and varies the types', () => {
  const c = load();
  const pool = LIST.filter((p) => !p.isAltForm);
  const keep = [LIST[0]]; // Dracaufeu, locked
  const picks = c.tbPickTeam(pool, keep, 5, { varied: true }, seq([0.01, 0.1, 0.2, 0.3, 0.45, 0.5, 0.62, 0.7, 0.8, 0.9, 0.99]));
  assert.equal(picks.length, 5);
  const ids = picks.map((p) => p.id);
  assert.equal(new Set(ids).size, 5, 'no Pokémon twice');
  assert.ok(!ids.includes(6), 'the locked Pokémon is not drawn again');
  const types = [...keep, ...picks].flatMap((p) => [p.type1, p.type2].filter(Boolean));
  // With these 10 Pokémon, varied types cannot always be met: the rule relaxes instead of failing.
  assert.ok(types.length >= 6);
  const strict = c.tbPickTeam(pool, keep, 2, { varied: true }, seq([0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]));
  const strictTypes = [...keep, ...strict].flatMap((p) => [p.type1, p.type2].filter(Boolean));
  assert.equal(new Set(strictTypes).size, strictTypes.length, 'no type twice when it is possible');
});

test('« Tirer l’équipe » keeps the 🔒 slots and fills the others with a full set', async () => {
  const locked = { pokemonId: 445, item: 'Mouchoir Choix', moves: ['Séisme', 'Danse Draco', '', ''], nature: 'Jovial' };
  const c = load([locked, slotOf(6), {}, {}, {}, {}]);
  vm.runInContext('tbLocks.add(0)', c);
  const picks = await c.rollTeam(seq([0.13, 0.37, 0.61, 0.07, 0.83, 0.29, 0.53, 0.97, 0.41, 0.71, 0.19, 0.89]));
  assert.equal(c.teamBuilderState[0], locked, 'the locked slot is the same object, set included');
  assert.equal(picks.length, 5);
  const team = c.teamBuilderState.map((s) => s.pokemonId);
  assert.equal(new Set(team).size, 6);
  for (const slot of c.teamBuilderState.slice(1)) {
    assert.ok(slot.pokemonId, 'every free slot gets a Pokémon');
    assert.notEqual(slot.item, 'Aucun');
    assert.ok(['Restes', 'Orbe Vie'].includes(slot.item), 'never « Aucun » nor Evoluroc');
    assert.ok(['Rigide', 'Modeste'].includes(slot.nature));
    const moves = slot.moves.filter(Boolean);
    assert.equal(moves.length, 4);
    assert.equal(new Set(moves).size, 4, '4 different attacks');
    assert.ok(!moves.includes('Métronome') && !moves.includes('Attraction'), 'no joke move');
    const st = STATS[slot.pokemonId];
    assert.equal(slot.evPreset, st[3] > st[1] ? 'offensive-speciale' : 'offensive-physique', 'EV follow the better attacking stat');
  }
  assert.equal(c.saved, 1);
  assert.match(c.toasts[0], /1 Pokémon gardé/);
});

test('the randomizer remembers its options; at least one generation stays chosen', () => {
  const c = load();
  assert.deepEqual(JSON.parse(JSON.stringify(c.tbRandomSettings())), { gens: [1, 2, 3, 4, 5, 6, 7, 8, 9], strong: true, noLegend: true, varied: true, sets: true });
  c.tbSaveRandomSettings({ gens: [4, 99], strong: false, noLegend: true, varied: false, sets: false });
  const s = c.tbRandomSettings();
  assert.deepEqual([...s.gens], [4], 'an impossible generation is dropped');
  assert.equal(s.strong, false);
  assert.equal(s.varied, false);
  c.tbSaveRandomSettings({ gens: [] });
  assert.equal(c.tbRandomSettings().gens.length, 9, 'no generation saved: all of them');
  assert.match(src, /querySelectorAll\('\[data-tb-gen\]\[aria-pressed="true"\]'\)\.length <= 1\) return;/, 'the last chosen generation cannot be turned off');
});

test('the page: the new header, the editor in 4 tabs, a sheet on a phone, and the image to share', () => {
  const html = read('index.html');
  for (const action of ['openTeamShare', 'openTeamRandomizer', 'openTeamsScreen', 'openTeamBuilderExport', 'openTeamBuilderImport', 'resetTeamBuilder']) {
    assert.match(html, new RegExp(`data-action="${action}"`), action + ' is still reachable');
  }
  assert.match(html, /<h2 class="card-title">Mon équipe<\/h2>/);
  assert.equal(vm.runInContext('TB_TABS.map(([k]) => k).join()', load()), 'set,reglages,stats,tera');
  assert.match(src, /document\.querySelector\("#screen-team-builder \.home-builder-editor, \.tb-editor-sheet \.home-builder-editor"\)/, 'the tabs work in the page and in the sheet');
  assert.match(src, /tbEditorMark\.replaceWith\(editor\)/, 'the editor goes back in place when the sheet closes');
  const css = read('game-shell.css');
  assert.match(css, /\.tb-editor-sheet \{position:fixed;z-index:1201;/);
  assert.match(css, /#screen-team-builder \.team-builder-module > \.home-builder-grid \{order:1;\}/, 'on a phone the team comes first');
  // The image to share: a story with the site's address.
  assert.match(src, /canvas\.width = 1080; canvas\.height = 1920;/);
  assert.match(src, /ctx\.fillText\("pokdle\.fr"/);
  assert.match(src, /favLoadImage\(pokedexDetailArtwork\(p\)\)/, 'artworks load through the CORS-safe loader of the favourites grid');
  assert.ok(read('src/script.10xo.favorites-grid.js').includes('img.crossOrigin = "anonymous"'));
});

test('a drawn set: one attack of each of its types, one of another type, known moves first', () => {
  const c = load();
  const draco = LIST[0]; // Feu / Vol
  for (const r of [0, 0.5, 0.99]) {
    const moves = c.tbPickMoves(MOVES, draco, () => r);
    assert.equal(moves.length, 4);
    assert.equal(moves[0], 'Lance-Flammes', 'a Feu attack, the known one before Flammèche');
    assert.equal(moves[1], 'Lame d’Air', 'a Vol attack');
    assert.equal(moves[2], 'Séisme', 'then another type for coverage');
    assert.ok(!moves.includes('Métronome') && !moves.includes('Attraction'));
  }
  // A Pokémon with almost nothing to learn still gets what it has.
  assert.deepEqual([...c.tbPickMoves([{ name: 'Trempette', types: [] }, { name: 'Métronome', types: [] }], draco, () => 0)].sort(), ['Métronome', 'Trempette']);
});
