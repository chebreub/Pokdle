'use strict';
// Combo de types, style B (31/10/2026): the stage takes the colours of the two types, a single type reads
// « pur », the suggestions keep small images (a Méga artwork used to fill the list), and the Party Room
// round uses the same stage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const src = read('src/script.03.minijeux.js');

function helpers() {
  const code = src.slice(src.indexOf('function typeComboTypesHtml('), src.indexOf('function speedrunIsPartyRound('));
  const env = {
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    typeSlug: (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),
    getTypeIconPath: (t) => '/types/' + t + '.png',
    typeBadgeHtml: (t) => '<badge ' + t + '>',
    getPokemonSprite: (p) => 'sprite-' + p.id,
    pokedexDetailArtwork: (p) => 'art-' + p.id,
    typeComboState: null, TYPE_COMBO_DURATION_MS: 60000, document: { getElementById: () => null },
  };
  return Function(...Object.keys(env), code + '; return { typeComboStageHtml, typeComboFoundHtml, typeComboTypesHtml };')(...Object.values(env));
}

test('the stage shows the two types in their colours, or one colour for a single type', () => {
  const { typeComboStageHtml } = helpers();
  const duo = typeComboStageHtml(['Dragon', 'Sol'], '<x-extra>');
  assert.match(duo, /^<div class="tc-stage">/);
  assert.match(duo, /<div class="tc-half is-a type-dragon"><span class="tc-half-ic"><img src="\/types\/Dragon.png" alt="" \/><\/span><b>Dragon<\/b><\/div>/);
  assert.match(duo, /<div class="tc-half is-b type-sol">/);
  assert.match(duo, /<span class="tc-vs" aria-hidden="true">\+<\/span><x-extra><\/div>$/);
  const pure = typeComboStageHtml(['Ténèbres', 'Ténèbres']);
  assert.match(pure, /^<div class="tc-stage is-pure"><div class="tc-half is-full type-tenebres">/);
  assert.match(pure, /<span class="tc-pure-tag">Type pur<\/span>/);
  assert.doesNotMatch(pure, /tc-vs/, 'never « Ténèbres + Ténèbres »');
  assert.equal(typeComboStageHtml([]), '<div class="tc-stage"></div>');
});

test('the solo game asks in words, teaches the real types after a miss and lists the combos found', () => {
  const { typeComboFoundHtml, typeComboTypesHtml } = helpers();
  assert.match(src, /pure \? \("Trouve un Pokémon " \+ types\[0\] \+ " pur"\) : \("Trouve un Pokémon " \+ types\[0\] \+ " \/ " \+ types\[1\]\)/);
  assert.match(src, /"✗ " \+ escapeHtml\(mon\.name\) \+ " est " \+ typeComboTypesHtml\(\[mon\.type1, mon\.type2 \|\| mon\.type1\]\)/);
  assert.equal(typeComboTypesHtml(['Acier', 'Vol']), '<span class="tc-mini-types"><badge Acier><badge Vol></span>');
  assert.equal(typeComboTypesHtml(['Ténèbres', 'Ténèbres']), '<span class="tc-mini-types"><badge Ténèbres><span class="tc-pure">pur</span></span>');
  const found = typeComboFoundHtml([{ name: 'Lokhlass', ref: { id: 131 }, pts: 100 }]);
  assert.match(found, /Tes combos · 1/);
  assert.match(found, /<img src="art-131" data-fallback="sprite-131" alt="" loading="lazy" \/><span>Lokhlass<\/span><b>\+100<\/b>/);
  assert.match(typeComboFoundHtml([]), /Chaque Pokémon trouvé s'ajoute ici\./);
  // The clock stays where the game and the live ranking look for it.
  assert.match(src, /<b id="type-combo-timer">/);
});

test('suggestions keep small images, and the Party Room round uses the same stage', () => {
  const css = read('game-shell.css');
  assert.match(css, /#screen-type-combo \.tc-ac-sprite \{width:44px;height:44px;flex:none;object-fit:contain;\}/, 'a Méga artwork no longer fills the list');
  assert.match(css, /#screen-type-combo \.tc-ac \{position:absolute;/, 'the list opens over the page');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ #pokdle-app \.tc-timebar i \{transition:none;\} \}/);
  assert.match(read('src/script.04.jeu-pokedex.js'), /typeComboStageHtml\(\[types\[0\], types\[1\] \|\| types\[0\]\]\)/);
});
