'use strict';
// 🔒 Pokémon pixelisé, Zoom progressif, Cri et Description Pokédex vérifiés par le serveur (4/11/2026).
// Le serveur tire le mystère dans les générations choisies (mêmes Pokémon que le jeu du navigateur :
// formes comprises, sauf celles marquées guessable:false), reçoit chaque essai et renvoie les mêmes
// pastilles que le Pokémon du jour. La réponse ne part qu'à la fin ; l'image passe par une adresse opaque.
const { compareDaily } = require('./daily-comparison');
const MODES = Object.freeze(['pixel', 'silhouette', 'cry', 'description', 'normal', 'mystery']);
// Stat Mystère : les stats de base embarquées (même source que le navigateur et le Higher or Lower).
const STATS = require('../base-stats.json');
const MYSTERY_LETTER_AFTER = 5;
// PokeAPI n'a d'entrées Pokédex en français que jusqu'au n° 898 : le mystère de la Description vient de là
// (on peut quand même proposer n'importe quel Pokémon des générations choisies, comme avant).
const DESCRIPTION_LAST_FRENCH_SPECIES = 898;
const MAX_GUESSES = 60;
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });
const direction = (a, b) => a === b ? '' : a < b ? '↑' : '↓';
const genOf = (p) => Number(p.gen) || Number(p.generation) || 0;

function createGuessGames(catalog, randomInt) {
  const playable = catalog.filter((p) => p && Number(p.id) > 0 && p.guessable !== false && genOf(p) >= 1 && genOf(p) <= 9);
  const byId = new Map(playable.map((p) => [Number(p.id), p]));
  const inGens = (p, gens) => gens.includes(genOf(p));
  const speciesOf = (p) => Number(p.baseId || p.id);
  function init(s) {
    const pool = playable.filter((p) => inGens(p, s.gens) && (s.mode !== 'description' || speciesOf(p) <= DESCRIPTION_LAST_FRENCH_SPECIES));
    if (!pool.length) throw fail('invalid_generations', 400);
    const fresh = pool.filter((p) => !(s.recent || []).includes(Number(p.id)));
    const pick = (fresh.length ? fresh : pool)[randomInt((fresh.length ? fresh : pool).length)];
    s.secretId = Number(pick.id);
    s.recent = [s.secretId, ...(s.recent || [])].slice(0, 40);
    s.guesses = [];
    s.won = false;
  }
  function rows(s) {
    const secret = byId.get(s.secretId);
    return s.guesses.map((id) => {
      const p = byId.get(id);
      return { pokemonId: id, cmp: compareDaily(p, secret), generationDirection: direction(genOf(p), genOf(secret)),
        heightDirection: direction(p.height, secret.height), weightDirection: direction(p.weight, secret.weight) };
    });
  }
  // Stat Mystère : les types et les 6 stats dès le début, la 1re lettre à partir du 5e essai (comme avant).
  function mysteryClues(s) {
    const p = byId.get(s.secretId), stats = STATS[String(p.apiId || p.baseId || p.id)];
    const ok = Array.isArray(stats) && stats.length === 6 && stats.every((v) => Number.isFinite(v) && v > 0);
    return { type1: p.type1, type2: p.type2 || null, stats: ok ? stats : null,
      ...(s.phase === 'over' || s.guesses.length >= MYSTERY_LETTER_AFTER ? { letter: [...String(p.name)][0].toUpperCase() } : {}) };
  }
  function view(s) {
    return { attempts: s.guesses.length, rows: rows(s), won: s.won, ...(s.mode === 'mystery' ? { mystery: mysteryClues(s) } : {}),
      ...(s.phase === 'over' ? { answerId: s.secretId } : {}) };
  }
  function result(s) { return { mode: s.mode, result: s.won ? 'win' : 'loss', score: s.guesses.length }; }
  function answer(s, choice) {
    const id = Number(choice), p = byId.get(id);
    if (!Number.isInteger(id) || !p || !inGens(p, s.gens)) throw fail('invalid_choice', 400);
    if (s.guesses.includes(id)) return false;
    if (s.guesses.length >= MAX_GUESSES) throw fail('invalid_choice', 400);
    s.guesses.push(id);
    if (id === s.secretId) { s.won = true; s.phase = 'over'; }
    return true;
  }
  function abandon(s) { s.phase = 'over'; s.won = false; }
  function spriteOf(id) { const p = byId.get(Number(id)); return p ? String(p.sprite || '') : ''; }
  // Même cri que le navigateur : celui de la forme quand PokeAPI en a un (sprite numéroté), sinon celui de l'espèce.
  function cryOf(id) {
    const p = byId.get(Number(id));
    if (!p) return 0;
    const sprite = p.spriteId ?? p.id;
    return /^\d+$/.test(String(sprite)) ? Number(sprite) : speciesOf(p);
  }
  return { init, view, result, answer, abandon, spriteOf, cryOf, speciesOf: (id) => speciesOf(byId.get(Number(id)) || {}), get: (id) => byId.get(Number(id)), has: (id) => byId.has(Number(id)) };
}
// L'entrée Pokédex en français : PokeAPI, avec sa copie GitHub en secours. Le nom est masqué comme dans le navigateur.
function createFlavorLoader(fetcher = fetch, randomInt = require('node:crypto').randomInt) {
  const cache = new Map();
  async function entries(speciesId) {
    if (cache.has(speciesId)) return cache.get(speciesId);
    let data = null;
    for (const url of ['https://pokeapi.co/api/v2/pokemon-species/' + speciesId + '/', 'https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2/pokemon-species/' + speciesId + '/index.json']) {
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
        if (response.ok) { data = await response.json(); break; }
      } catch (_) { /* try the next source */ }
    }
    const list = (Array.isArray(data?.flavor_text_entries) ? data.flavor_text_entries : [])
      .filter((e) => e?.language?.name === 'fr').map((e) => String(e.flavor_text || '').replace(/[\f\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (list.length) { cache.set(speciesId, list); if (cache.size > 300) cache.delete(cache.keys().next().value); }
    return list;
  }
  return async function describe(pokemon, speciesId) {
    const list = await entries(speciesId);
    if (!list.length) {
      const gen = genOf(pokemon) ? 'de la génération ' + genOf(pokemon) : '';
      const stage = pokemon.stage ? ', stade d’évolution ' + pokemon.stage : '';
      const habitat = pokemon.habitat && pokemon.habitat !== 'Rare' ? ', habitat ' + pokemon.habitat : '';
      return ('Pokémon ' + gen + stage + habitat + '. (Description Pokédex indisponible, retombe sur indices génériques.)').trim();
    }
    const safe = String(pokemon.name || '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const text = list[randomInt(list.length)];
    return safe ? text.replace(new RegExp(safe, 'gi'), 'ce Pokémon') : text;
  };
}
module.exports = { MODES, MAX_GUESSES, DESCRIPTION_LAST_FRENCH_SPECIES, createGuessGames, createFlavorLoader };
