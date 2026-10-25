'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The evolution helpers, from formatPokedexApiLabel to the end of the file, with the app globals they use stubbed.
const file = fs.readFileSync(path.join(__dirname, '../src/script.05.draft-combat.js'), 'utf8');
const code = file.slice(file.indexOf('function formatPokedexApiLabel('));
const FRENCH = { '/api/v2/item/82/': 'Pierre Feu', '/api/v2/item/885/': 'Pierre Glace', '/api/v2/item/83/': 'Pierre Foudre', '/api/v2/item/85/': 'Pierre Plante',
  '/api/v2/item/109/': 'Pierre Aube', '/api/v2/item/210/': 'Peau Métal', '/api/v2/item/84/': 'Pierre Eau', '/api/v2/move/889/': 'Poing de Colère' };
const POKEMON_LIST = [
  { id: 37, name: 'Goupix' }, { id: 38, name: 'Feunard' }, { id: 56, name: 'Férosinge' }, { id: 57, name: 'Colossinge' }, { id: 979, name: 'Courrousinge' },
  { id: 133, name: 'Évoli' }, { id: 134, name: 'Aquali' }, { id: 135, name: 'Voltali' },
  { id: 21010, name: "Goupix d'Alola", baseId: 37, isAltForm: true }, { id: 21011, name: "Feunard d'Alola", baseId: 38, isAltForm: true },
];
const helpers = Function('fetchPokedexMoveData', 'fetchPokedexEvolutionChainData', 'POKEMON_LIST', code + `
  function getMysteryApiId(p) { return p.id; }
  function speciesIdFromUrl(url) { const m = String(url).match(/\\/(\\d+)\\/?$/); return m ? Number(m[1]) : null; }
  function typeLabelFrFromApiName(name) { return { fairy: 'Fée', dark: 'Ténèbres' }[name] || name; }
  function pokedexDetailArtwork(p) { return 'artwork-' + p.id; }
  function getPokemonSprite(p) { return 'sprite-' + p.id; }
  function escapeHtml(s) { return String(s); }
  return { pickPokedexEvolutionDetail, getPokedexEvolutionMethodText, pokedexEvolutionSummaryHtml };`);
let chainData = null;
const { pickPokedexEvolutionDetail, getPokedexEvolutionMethodText, pokedexEvolutionSummaryHtml } = helpers(
  async (url) => (FRENCH[url] ? { names: [{ language: { name: 'en' }, name: 'x' }, { language: { name: 'fr' }, name: FRENCH[url] }] } : null),
  async () => chainData,
  POKEMON_LIST,
);
const ref = (name, url) => ({ name, url });
const item = (name, id) => ref(name, `/api/v2/item/${id}/`);
const species = (name, id) => ref(name, `/api/v2/pokemon-species/${id}/`);

test('evolution methods read in French, with the official item and move names', async () => {
  const cases = [
    [{ trigger: ref('use-item'), item: item('fire-stone', 82) }, 'Pierre Feu'],
    [{ trigger: ref('level-up'), min_level: 28 }, 'Niveau 28'],
    [{ trigger: ref('use-move'), used_move: ref('rage-fist', '/api/v2/move/889/'), min_move_count: 20 }, 'Poing de Colère ×20'],
    [{ trigger: ref('level-up'), min_happiness: 160, time_of_day: 'day' }, 'Amitié élevée, de jour'],
    [{ trigger: ref('level-up'), known_move_type: ref('fairy'), min_happiness: 160 }, 'Amitié élevée, connaît une capacité Fée'],
    [{ trigger: ref('trade'), held_item: item('metal-coat', 210) }, 'Échange en tenant Peau Métal'],
    [{ trigger: ref('use-item'), item: item('dawn-stone', 109), gender: 2 }, 'Pierre Aube, mâle'],
    [{ trigger: ref('level-up'), min_level: 20, relative_physical_stats: -1 }, 'Niveau 20, Attaque < Défense'],
    [{ trigger: ref('level-up'), min_level: 32, party_type: ref('dark') }, 'Niveau 32, avec un Pokémon Ténèbres dans l’équipe'],
    [{ trigger: ref('three-defeated-bisharp') }, 'Vaincre 3 Scalproie tenant un Emblème du Général'],
    [{ trigger: ref('shed') }, 'Place dans l’équipe et une Poké Ball'],
    [{ trigger: ref('something-new') }, 'Méthode spéciale'],
    [{ trigger: ref('three-critical-hits'), required_pokemon_form: ref('farfetchd-galar') }, '3 coups critiques en un combat (forme de Galar)'],
  ];
  for (const [detail, expected] of cases) assert.equal(await getPokedexEvolutionMethodText(detail), expected);
  // An item PokeAPI does not name in French still reads as words, not as « some-item ».
  assert.equal(await getPokedexEvolutionMethodText({ trigger: ref('use-item'), item: item('tart-apple', 9999) }), 'Tart Apple');
});

test('one way to evolve per step: the regional one, the default one, or one that needs no special place', () => {
  const ninetales = [
    { is_default: true, trigger: ref('use-item'), item: item('fire-stone', 82) },
    { is_default: true, trigger: ref('use-item'), item: item('ice-stone', 885), required_pokemon_form: ref('vulpix-alola'), evolved_pokemon_form: ref('ninetales-alola') },
  ];
  assert.equal(pickPokedexEvolutionDetail(ninetales).item.name, 'fire-stone');
  assert.equal(pickPokedexEvolutionDetail(ninetales, 'alola').item.name, 'ice-stone');
  const magnezone = [{ trigger: ref('level-up'), location: ref('mt-coronet') }, { is_default: true, trigger: ref('use-item'), item: item('thunder-stone', 83) }];
  assert.equal(pickPokedexEvolutionDetail(magnezone).item.name, 'thunder-stone');
  // Older PokeAPI data has no is_default: the step that needs no special place wins.
  const leafeon = [{ trigger: ref('level-up'), location: ref('eterna-forest') }, { trigger: ref('use-item'), item: item('leaf-stone', 85) }];
  assert.equal(pickPokedexEvolutionDetail(leafeon).item.name, 'leaf-stone');
  assert.equal(pickPokedexEvolutionDetail([]), null);
});

test('a straight family reads left to right; a branching one gets one box per evolution', async () => {
  chainData = { chain: { species: species('mankey', 56), evolution_details: [], evolves_to: [
    { species: species('primeape', 57), evolution_details: [{ trigger: ref('level-up'), min_level: 28 }], evolves_to: [
      { species: species('annihilape', 979), evolution_details: [{ trigger: ref('use-move'), used_move: ref('rage-fist', '/api/v2/move/889/'), min_move_count: 20 }], evolves_to: [] }] }] } };
  const line = await pokedexEvolutionSummaryHtml({ evolution_chain: { url: 'chain' } }, { name: 'primeape', species: { name: 'primeape' } });
  const order = ['Férosinge', 'Niveau 28', 'Colossinge', 'Poing de Colère ×20', 'Courrousinge'].map((text) => line.indexOf(text));
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), line);
  assert.match(line, /<div class="pokedex-evo-card is-current"><img src="artwork-57" alt="" loading="lazy" data-fallback="sprite-57" \/><b>Colossinge<\/b><\/div>/);
  assert.match(line, /<button type="button" class="pokedex-evo-card" data-action="openPokedexRecent" data-args='\[979\]'/);

  chainData = { chain: { species: species('eevee', 133), evolution_details: [], evolves_to: [
    { species: species('vaporeon', 134), evolution_details: [{ trigger: ref('use-item'), item: item('water-stone', 84) }], evolves_to: [] },
    { species: species('jolteon', 135), evolution_details: [{ trigger: ref('use-item'), item: item('thunder-stone', 83) }], evolves_to: [] }] } };
  const branch = await pokedexEvolutionSummaryHtml({ evolution_chain: { url: 'chain' } }, { name: 'eevee', species: { name: 'eevee' } });
  assert.match(branch, /class="pokedex-evo-targets"/);
  assert.match(branch, /<b>Aquali<\/b><small>Pierre Eau<\/small>/);
  assert.match(branch, /<b>Voltali<\/b><small>Pierre Foudre<\/small>/);

  // On a regional sheet, the family shows the regional forms and their method.
  chainData = { chain: { species: species('vulpix', 37), evolution_details: [], evolves_to: [{ species: species('ninetales', 38), evolution_details: [
    { is_default: true, trigger: ref('use-item'), item: item('fire-stone', 82) },
    { is_default: true, trigger: ref('use-item'), item: item('ice-stone', 885), required_pokemon_form: ref('vulpix-alola'), evolved_pokemon_form: ref('ninetales-alola') }], evolves_to: [] }] } };
  const alola = await pokedexEvolutionSummaryHtml({ evolution_chain: { url: 'chain' } }, { name: 'ninetales-alola', species: { name: 'ninetales' } });
  assert.match(alola, /Goupix d'Alola[\s\S]*Pierre Glace[\s\S]*Feunard d'Alola/);
  const single = { chain: { species: species('tauros', 128), evolution_details: [], evolves_to: [] } };
  chainData = single;
  assert.match(await pokedexEvolutionSummaryHtml({ evolution_chain: { url: 'chain' } }, { name: 'tauros', species: { name: 'tauros' } }), /Ce Pokémon n’évolue pas/);
});

test('useful info in French: capture rate, egg groups, hatching', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/script.04.jeu-pokedex.js'), 'utf8');
  assert.equal((src.match(/<span>Taux de capture<\/span>/g) || []).length, 2);
  assert.equal((src.match(/<span>Groupes d’œufs<\/span>/g) || []).length, 2);
  assert.equal((src.match(/<span>Éclosion<\/span>/g) || []).length, 2);
  const block = src.slice(src.indexOf('const POKEDEX_EGG_GROUPS_FR'), src.indexOf('function formatHatchCycles('));
  const formatEggGroups = Function('formatPokedexApiLabel', block + '; return formatEggGroups;')((s) => s);
  assert.equal(formatEggGroups({ egg_groups: [{ name: 'ground' }, { name: 'humanshape' }] }), 'Terrestre / Humanoïde');
  assert.equal(formatEggGroups({ egg_groups: [] }), 'Inconnu');
});
