'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
// Objects made inside the game's context: compared as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

test('only Pokémon whose shiny clearly differs are asked', () => {
  const pool = JSON.parse(read('shiny-pool.json'));
  assert.ok(pool.ids.length > 600, 'enough variety: ' + pool.ids.length);
  assert.ok(pool.ids.every((id) => Number.isInteger(id) && id >= 1 && id <= 1025));
  assert.equal(new Set(pool.ids).size, pool.ids.length);
  // Shinies a shade away from the normal colours stay out; famous clear ones stay in.
  for (const id of [94, 143, 445]) assert.ok(!pool.ids.includes(id), 'too close to tell: #' + id);
  for (const id of [6, 25, 130, 133, 151]) assert.ok(pool.ids.includes(id), 'clearly different: #' + id);
});

function game(random) {
  const stored = new Map(), history = [], focus = { focus() {} };
  const root = { innerHTML: '' };
  const c = {
    localStorage: { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, String(v)) },
    POKEMON_BY_ID: new Map([[6, { name: 'Dracaufeu' }], [25, { name: 'Pikachu' }], [130, { name: 'Léviator' }]]),
    Image: function Image() {},
    document: { getElementById: (id) => (id === 'shiny-root' ? root : focus), addEventListener() {} },
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    recordMatchHistory: (entry) => history.push(entry),
    Math: Object.create(Math, { random: { value: random } }),
  };
  vm.createContext(c);
  vm.runInContext(read('src/script.10xd.shiny.js') + '\nthis.api={shinyNextRound,newShinyState,shinyStartRound,answerShiny,nextShinyRound,restartShinyGame,get state(){return shinyState},set pool(v){shinyPool=v}};', c);
  return { api: c.api, root, history, stored };
}

test('a new round avoids the Pokémon just seen and is shiny one time out of two', () => {
  const { api } = game(() => 0);
  assert.deepEqual(plain(api.shinyNextRound([6, 25, 130], [6], () => 0)), { id: 25, shiny: true });
  assert.deepEqual(plain(api.shinyNextRound([6, 25, 130], [6], () => 0.99)), { id: 130, shiny: false });
  assert.equal(api.shinyNextRound([6], [6], () => 0.2).id, 6, 'a tiny pool still plays');
});

test('three lives, one point per good answer, both versions shown after each answer', () => {
  let shinyNext = true;
  // Rounds alternate shiny / normal; the id draw always takes the first fresh Pokémon.
  const { api, root, history, stored } = game(() => { shinyNext = !shinyNext; return shinyNext ? 0 : 0.9; });
  api.pool = [6, 25, 130];
  api.restartShinyGame();
  const state = () => api.state;
  assert.equal(state().lives, 3);
  assert.match(root.innerHTML, /shiny ou normal \?/);
  assert.doesNotMatch(root.innerHTML, /shiny-compare/, 'no answer before the guess');

  api.answerShiny(state().round.shiny ? 'shiny' : 'normal');
  assert.equal(state().score, 1);
  assert.equal(state().phase, 'reveal');
  assert.match(root.innerHTML, /Bien vu/);
  assert.match(root.innerHTML, /official-artwork\/\d+\.png[\s\S]*official-artwork\/shiny\/\d+\.png/, 'normal and shiny side by side');

  api.answerShiny('shiny');
  assert.equal(state().score, 1, 'no second answer on the same Pokémon');

  for (let miss = 0; miss < 3; miss += 1) {
    api.nextShinyRound();
    api.answerShiny(state().round.shiny ? 'normal' : 'shiny');
  }
  assert.equal(state().lives, 0);
  assert.equal(state().phase, 'over');
  assert.match(root.innerHTML, /Partie terminée : 1 bonne réponse\./);
  assert.match(root.innerHTML, /Nouveau record/);
  assert.deepEqual(plain(history), [{ mode: 'shiny', result: 'loss', attempts: 1, targetName: 'Score 1' }]);
  assert.equal(stored.get('pokedle.shinyBest'), '1');
  api.nextShinyRound();
  assert.equal(state().phase, 'over', 'the game stays over until « Rejouer »');
});
