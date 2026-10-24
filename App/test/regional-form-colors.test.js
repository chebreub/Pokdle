const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const COLORS = ['Vert', 'Rouge', 'Bleu', 'Blanc', 'Brun', 'Jaune', 'Violet', 'Rose', 'Gris', 'Noir'];
const source = fs.readFileSync(path.join(__dirname, '../src/script.01.core.js'), 'utf8');
const forms = Function('return ' + source.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/)[1])();
const regional = forms.filter(form => /(d['’]Alola|de Galar|de Hisui|de Paldea)$/.test(form.name) || /^Tauros de Paldea/.test(form.name));

test('every regional form has its own Pokédex colour instead of its species one', () => {
  assert.equal(regional.length, 57);
  for (const form of regional) assert.ok(COLORS.includes(form.color), form.name + ' has colour ' + form.color);
  const byName = Object.fromEntries(regional.map(form => [form.name, form.color]));
  // The forms players noticed: Artikodin de Galar is not blue, Goupix d'Alola is not brown.
  assert.equal(byName['Artikodin de Galar'], 'Violet');
  assert.equal(byName["Goupix d'Alola"], 'Blanc');
  assert.equal(byName['Smogogo de Galar'], 'Gris');
});
