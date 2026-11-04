'use strict';
// 🔒 Pokémon pixelisé et Zoom progressif vérifiés par le serveur (4/11/2026).
// Le serveur tire le mystère dans les générations choisies (mêmes Pokémon que le jeu du navigateur :
// formes comprises, sauf celles marquées guessable:false), reçoit chaque essai et renvoie les mêmes
// pastilles que le Pokémon du jour. La réponse ne part qu'à la fin ; l'image passe par une adresse opaque.
const { compareDaily } = require('./daily-comparison');
const MODES = Object.freeze(['pixel', 'silhouette']);
const MAX_GUESSES = 60;
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });
const direction = (a, b) => a === b ? '' : a < b ? '↑' : '↓';
const genOf = (p) => Number(p.gen) || Number(p.generation) || 0;

function createGuessGames(catalog, randomInt) {
  const playable = catalog.filter((p) => p && Number(p.id) > 0 && p.guessable !== false && genOf(p) >= 1 && genOf(p) <= 9);
  const byId = new Map(playable.map((p) => [Number(p.id), p]));
  const inGens = (p, gens) => gens.includes(genOf(p));
  function init(s) {
    const pool = playable.filter((p) => inGens(p, s.gens));
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
  function view(s) {
    return { attempts: s.guesses.length, rows: rows(s), won: s.won, ...(s.phase === 'over' ? { answerId: s.secretId } : {}) };
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
  return { init, view, result, answer, abandon, spriteOf, has: (id) => byId.has(Number(id)) };
}
module.exports = { MODES, MAX_GUESSES, createGuessGames };
