'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The places block of the Pokédex, from the game names to the encounter summary, with PokeAPI stubbed.
const src = fs.readFileSync(path.join(__dirname, '../src/script.04.jeu-pokedex.js'), 'utf8');
const block = src.slice(src.indexOf('const POKEAPI_VERSION_LABELS'), src.indexOf('async function fetchPokemonEncounterAreas('));
const AREAS = {
  '/api/v2/location-area/144/': 'Route 204 (sud, vers Féli-Cité)',
  '/api/v2/location-area/143/': 'Route 203',
  '/api/v2/location-area/900/': 'Route 203',
};
const { summarizeEncounterAreas, formatPokeApiVersionLabel } = Function('fetchPokeApiJson', block + '; return { summarizeEncounterAreas, formatPokeApiVersionLabel };')(
  async (url) => {
    if (url === '/api/v2/location-area/500/') throw new Error('HTTP 404');
    return { names: AREAS[url] ? [{ language: { name: 'en' }, name: 'Road' }, { language: { name: 'fr' }, name: AREAS[url] }] : [] };
  },
);
const area = (name, id, ...versions) => ({ location_area: { name, url: `/api/v2/location-area/${id}/` }, version_details: versions.map((v) => ({ version: { name: v } })) });

test('places use the French names PokeAPI gives, and the games their French titles', async () => {
  const entries = await summarizeEncounterAreas([
    area('sinnoh-route-204-south-towards-jubilife-city', 144, 'diamond', 'pearl'),
    area('sinnoh-route-203-area', 143, 'platinum'),
    area('sinnoh-route-203-grass', 900, 'brilliant-diamond'),
    area('eterna-forest-area', 500, 'heartgold'),
    area('unknown-meadow', 501, 'sword', 'scarlet', 'lets-go-eevee'),
  ], 10);
  assert.deepEqual(entries, [
    { label: 'Route 204 (sud, vers Féli-Cité)', versions: ['Diamant', 'Perle'] },
    // Two areas with the same French name make one line with both games.
    { label: 'Route 203', versions: ['Platine', 'Diamant Étincelant'] },
    // No answer from PokeAPI, or no French name: the old word-by-word name.
    { label: 'Eterna Forêt', versions: ['Or HeartGold'] },
    { label: 'Unknown Prairie', versions: ['Épée', 'Écarlate', 'Let’s Go, Évoli'] },
  ]);
  assert.equal(await summarizeEncounterAreas(null), null);
});

test('every PokeAPI game has a French title with its accents', () => {
  const versions = ['red', 'blue', 'yellow', 'gold', 'silver', 'crystal', 'ruby', 'sapphire', 'emerald', 'firered', 'leafgreen', 'diamond', 'pearl', 'platinum', 'heartgold', 'soulsilver', 'black', 'white', 'colosseum', 'xd', 'black-2', 'white-2', 'x', 'y', 'omega-ruby', 'alpha-sapphire', 'sun', 'moon', 'ultra-sun', 'ultra-moon', 'lets-go-pikachu', 'lets-go-eevee', 'sword', 'shield', 'the-isle-of-armor-sword', 'the-crown-tundra-sword', 'brilliant-diamond', 'shining-pearl', 'legends-arceus', 'scarlet', 'violet', 'the-teal-mask-scarlet', 'the-indigo-disk-scarlet', 'red-japan', 'green-japan', 'blue-japan', 'legends-za', 'mega-dimension', 'the-isle-of-armor-shield', 'the-crown-tundra-shield', 'the-teal-mask-violet', 'the-indigo-disk-violet'];
  const block2 = src.slice(src.indexOf('const POKEAPI_VERSION_LABELS'), src.indexOf('const POKEAPI_LOCATION_WORDS'));
  const labels = Function(block2 + '; return POKEAPI_VERSION_LABELS;')();
  assert.deepEqual(versions.filter((v) => !labels[v]), []);
  assert.equal(formatPokeApiVersionLabel('omega-ruby'), 'Rubis Oméga');
  assert.equal(formatPokeApiVersionLabel('legends-arceus'), 'Légendes : Arceus');
  assert.doesNotMatch(Object.values(labels).join(' '), /\b(Epée|Ecarlate|Emeraude|Etincelant|Evoli)\b/);
});
