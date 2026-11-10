'use strict';
// Arène des Captures beta : vrais objets possedes, sans recompense ni mutation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../src/script.10xzn.capture-arena.js'), 'utf8');

const POKEMON = [
  { id: 25, name: 'Pikachu', type1: 'Électrik' },
  { id: 130, name: 'Léviator', type1: 'Eau', type2: 'Vol' },
  { id: 908, name: 'Miascarade', type1: 'Plante', type2: 'Ténèbres' },
  { id: 448, name: 'Lucario', type1: 'Combat', type2: 'Acier' },
  { id: 6, name: 'Dracaufeu', type1: 'Feu', type2: 'Vol' },
  { id: 157, name: 'Typhlosion', type1: 'Feu' },
  { id: 257, name: 'Braségali', type1: 'Feu', type2: 'Combat' },
  { id: 10034, name: 'Mega Dracaufeu', type1: 'Feu', isAltForm: true }
];
function fixture(extra = {}) {
  const calls = [];
  const known = new Map(POKEMON.map(p => [p.id, p]));
  const c = vm.createContext({
    window: {}, document: { getElementById: () => null, querySelector: () => null },
    POKEMON_BY_ID: known, Date,
    escapeHtml: str => String(str).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])),
    attackMultiplier: (move, defender) => ({
      'Feu:Plante': 2, 'Feu:Eau': 0.5, 'Feu:Vol': 1, 'Eau:Feu': 2,
      'Électrik:Eau': 2, 'Électrik:Vol': 2, 'Électrik:Sol': 0,
      'Plante:Eau': 2, 'Plante:Feu': 0.5, 'Combat:Ténèbres': 2
    }[move + ':' + defender] ?? 1),
    ensureOverlay: (...args) => calls.push({ name: 'overlay', args }),
    fetch: async (url, opts) => {
      calls.push({ name: 'fetch', url, opts });
      return { ok: true, json: async () => ({ ok: true, captures: [{ id: 25, normal: 1, shiny: 0 }] }) };
    },
    ...extra
  });
  vm.runInContext(src, c);
  return { c, calls };
}
const captured = (id, count = 1) => ({ id, normal: count, shiny: 0 });

test('le roster repose exclusivement sur les possessions renvoyees par le serveur', () => {
  const { c } = fixture();
  const owned = c.caOwnedFromServer({ ok: true, captures: [
    captured(25), captured(130, 0), { id: 908, normal: 0, shiny: 1 },
    captured(25), captured(10034), captured(9999), captured(6, -1)
  ] });
  assert.deepEqual(Array.from(owned, p => p.id), [25, 908]);
  assert.deepEqual(Array.from(c.caOwnedFromServer({ ok: false, captures: [captured(25)] })), []);
  assert.deepEqual(Array.from(c.caOwnedFromServer({ ok: true })), []);
  assert.equal(c.caPickHtml().includes('Explorer les hautes herbes'), true, 'pas de fausse equipe');
});

test('degats normalises : doubles types et immunites, aucune prime aux shinies/rares', () => {
  const { c } = fixture();
  const pikachu = POKEMON[0], leviator = POKEMON[1];
  assert.equal(c.caPower('Électrik', leviator), 40, 'efficacite 4x plafonnee a 40');
  assert.equal(c.caPower('Eau', POKEMON[4]), 20);
  assert.equal(c.caPower('Feu', leviator), 5);
  assert.equal(c.caPower('Électrik', { type1: 'Sol' }), 0, 'immunite');
  assert.equal(c.caPower('Électrik', pikachu), 10, 'l essence de l attaquant ne donne aucun avantage');
});

test('selectionner 1 a 3 captures et refuser un ID non possede', () => {
  const { c } = fixture();
  c.caState.stage = 'pick';
  c.caState.owned = POKEMON.slice(0, 4);
  c.caToggle(25); c.caToggle(130); c.caToggle(908); c.caToggle(448);
  assert.deepEqual(Array.from(c.caState.selected), [25, 130, 908], 'trois max');
  c.caToggle(9999);
  assert.deepEqual(Array.from(c.caState.selected), [25, 130, 908]);
  c.caToggle(130);
  assert.deepEqual(Array.from(c.caState.selected), [25, 908]);
  assert.match(c.caPickHtml(), /aria-pressed="true"/);
  assert.match(c.caPickHtml(), /Position 1/);
});

test('une partie est du pur entrainement et ne change pas la collection', () => {
  const { c, calls } = fixture();
  c.caState.stage = 'pick';
  c.caState.owned = [POKEMON[0]];
  c.caState.selected = [25];
  const before = JSON.stringify(c.caState.owned);
  c.caStart();
  assert.equal(c.caState.stage, 'fight');
  assert.equal(c.caState.enemies.length, 1);
  const count = c.caState.history.length;
  c.caAttack('Insecte');
  assert.equal(c.caState.history.length, count, 'on ne peut pas forger un type');
  c.caAttack('Électrik');
  assert.equal(c.caState.stage, 'done');
  assert.equal(c.caState.history.length, 1);
  assert.equal(JSON.stringify(c.caState.owned), before, 'aucun Pokemon consomme');
  assert.match(c.caDoneHtml(), /Recomposer mon équipe/);
  assert.match(c.caDoneHtml(), /Faire une capture/);
  assert.match(src, /Règles du duel/);
  assert.match(src, /Aucun avantage de rareté ou de shiny/);
  assert.equal(calls.filter(z => z.name === 'fetch').length, 0, 'pas de POST ou sauvegarde en jeu');
  assert.doesNotMatch(src, /awardXp|localStorage|sessionStorage|setItem|api\/coins|api\/balls/);
});

test('l ouverture relit les captures et refuse de jouer en cas de panne', async () => {
  const { c, calls } = fixture();
  await c.openCaptureArena();
  assert.equal(c.caState.stage, 'pick');
  assert.deepEqual(Array.from(c.caState.owned, p => p.id), [25]);
  const network = calls.find(z => z.name === 'fetch');
  assert.equal(network.url, '/api/wild/collection');
  assert.equal(network.opts.credentials, 'same-origin');
  assert.equal(network.opts.cache, 'no-store');

  const offline = fixture({ fetch: async () => { throw Error('offline'); } });
  await offline.c.openCaptureArena();
  assert.equal(offline.c.caState.stage, 'loading');
  assert.match(offline.c.caState.error, /Impossible de vérifier/);
  assert.deepEqual(Array.from(offline.c.caState.owned), [], 'ne pas se rabattre sur des decouvertes locales');
});

test('entree visible depuis le Pokedex sans doublon', () => {
  let html = '', exists = false;
  const hub = { querySelector: sel => sel === '.ca-entry' ? (exists ? {} : null)
    : sel === '.pokedex-experience-switch' ? { insertAdjacentHTML: (_pos, fragment) => { html += fragment; exists = true; } } : null };
  const { c } = fixture({ document: { getElementById: id => id === 'pokedex-collection-hub' ? hub : null, querySelector: () => null } });
  c.caEnsureEntry(); c.caEnsureEntry();
  assert.equal((html.match(/data-action="openCaptureArena"/g) || []).length, 1);
  assert.match(html, /Arène des Captures/);
});
