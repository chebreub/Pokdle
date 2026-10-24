const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/script.01.core.js'), 'utf8');
const forms = Function('return ' + source.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/)[1])();
const pokemonSource = fs.readFileSync(path.join(__dirname, '../pokemon.js'), 'utf8');
const start = pokemonSource.indexOf('[', pokemonSource.indexOf('POKEMON_LIST'));
const species = new Map(JSON.parse(pokemonSource.slice(start, pokemonSource.indexOf('];', start) + 1)).map(p => [p.id, p]));
const gigamax = forms.filter(form => / Gigamax$/.test(form.name));

test('the 34 Gigamax forms are in the Pokédex but never an answer, with no made-up weight', () => {
  assert.equal(gigamax.length, 34);
  assert.equal(new Set(forms.map(form => form.id)).size, forms.length, 'form ids stay unique');
  assert.deepEqual(gigamax.map(form => form.spriteId), Array.from({ length: 34 }, (_, i) => 10195 + i), 'PokeAPI Gigamax sprites');
  for (const form of gigamax) {
    const base = species.get(form.baseId);
    assert.ok(base, form.name + ' has its species');
    assert.ok(form.name.startsWith(base.name), form.name + ' is named after ' + base.name);
    assert.equal(form.guessable, false, form.name + ' stays out of guessing games');
    assert.equal(form.weight, null, form.name + ' has no official weight');
    assert.ok(form.height > base.height, form.name + ' is taller than ' + base.name);
    assert.equal(form.gen, 8);
  }
  const types = name => { const form = gigamax.find(f => f.name === name); return [form.type1, form.type2]; };
  assert.deepEqual(types('Dracaufeu Gigamax'), ['Feu', 'Vol']);
  assert.deepEqual(types('Shifours Style Mille Poings Gigamax'), ['Combat', 'Eau']);
  assert.deepEqual(types('Shifours Style Poing Final Gigamax'), ['Combat', 'Ténèbres']);
});

test('the Pokédex says « Inconnu » for an unknown weight and gives the Gigamax minimum height', () => {
  const pokedex = fs.readFileSync(path.join(__dirname, '../src/script.04.jeu-pokedex.js'), 'utf8');
  const labels = Function(pokedex.slice(pokedex.indexOf('function pokedexHeightLabel'), pokedex.indexOf('function getFilteredPokedexList')) + 'return { pokedexHeightLabel, pokedexWeightLabel };')();
  assert.equal(labels.pokedexWeightLabel({ weight: null }), 'Inconnu');
  assert.equal(labels.pokedexWeightLabel({ weight: 90.5 }), '90.5 kg');
  assert.equal(labels.pokedexHeightLabel({ name: 'Dracaufeu Gigamax', height: 28 }), '28 m et plus');
  assert.equal(labels.pokedexHeightLabel({ name: 'Dracaufeu', height: 1.7 }), '1.7 m');
  assert.doesNotMatch(pokedex, /\$\{pokemon\.weight\} kg/, 'no detail view prints « null kg »');
});
