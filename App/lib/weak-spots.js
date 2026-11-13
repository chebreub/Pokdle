'use strict';
// ⚡ Faiblesses éclair (13/11/2026, maquette validée : « go 1 »). 10 Pokémon, 20 s chacun (horloge du serveur) :
// on touche tous les types qui lui font mal (×2 et ×4), puis « Valider ». Un Pokémon est « parfait » quand la
// sélection est exactement la bonne. Score = nombre de parfaits (10 au plus). La réponse n'arrive qu'après.
// Table des types : celle des guides (lib/seo-guides.js, TYPE_CHART[attaquant] = {super, not, no}).
const { TYPE_CHART } = require('./seo-guides');
const MODES = Object.freeze(['weakspots']);
const ROUNDS = 10, TURN_MS = 20000, GRACE_MS = 2000, WIN_AT = 5;
const TYPES = Object.freeze(Object.keys(TYPE_CHART));
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });

function multiplier(attack, defenders) {
  const row = TYPE_CHART[attack];
  return defenders.reduce((m, t) => m * (row.no.includes(t) ? 0 : row.super.includes(t) ? 2 : row.not.includes(t) ? 0.5 : 1), 1);
}
function weaknesses(defenders) {
  return TYPES.map((t) => [t, multiplier(t, defenders)]).filter(([, m]) => m >= 2);
}

function createWeakSpots(catalog, randomInt, clock) {
  const typesOf = (p) => [p.type1, p.type2].filter((t, i, a) => t && TYPES.includes(t) && a.indexOf(t) === i);
  const base = catalog.filter((p) => !p.isAltForm && p.guessable !== false && Number.isInteger(Number(p.id)) && Number(p.id) >= 1 && Number(p.id) <= 1025 && typesOf(p).length);
  const byId = new Map(base.map((p) => [Number(p.id), p]));
  function pick(s) {
    const pool = base.filter((p) => s.gens.includes(Number(p.generation)) && weaknesses(typesOf(p)).length > 0);
    if (pool.length < ROUNDS) throw fail('invalid_generations', 400);
    // Des types variés : jamais deux fois la même combinaison dans une partie ; 3 Pokémon à un seul type au plus.
    const ids = [], combos = new Set();
    let single = 0;
    for (let tries = 0; ids.length < ROUNDS && tries < 2000; tries++) {
      const p = pool[randomInt(pool.length)], t = typesOf(p), key = t.slice().sort().join('/');
      if (ids.includes(Number(p.id)) || combos.has(key) || (t.length === 1 && single >= 3 && tries < 1500)) continue;
      ids.push(Number(p.id)); combos.add(key); if (t.length === 1) single++;
    }
    if (ids.length < ROUNDS) throw fail('unavailable', 503);
    return ids;
  }
  function init(s) {
    s.ids = pick(s); s.round = 0; s.score = 0; s.history = []; s.answer = null;
    s.endsAt = +clock() + TURN_MS;
  }
  function answer(s, choice) {
    if (!Array.isArray(choice) || choice.length > TYPES.length || choice.some((t) => !TYPES.includes(t))) throw fail('invalid_choice', 400);
    const p = byId.get(s.ids[s.round]), weak = weaknesses(typesOf(p)).map(([t]) => t);
    // Trop tard (au-delà de la marge réseau) : la sélection ne compte pas.
    const late = +clock() > s.endsAt + GRACE_MS;
    const chosen = late ? [] : [...new Set(choice)];
    const good = chosen.filter((t) => weak.includes(t)).length, wrong = chosen.length - good;
    const perfect = !late && good === weak.length && wrong === 0;
    if (perfect) s.score++;
    s.answer = { choice: chosen, good, wrong, missed: weak.length - good, perfect, late };
    s.history.push(perfect ? 1 : 0);
    s.phase = s.round >= ROUNDS - 1 ? 'over' : 'reveal';
  }
  function next(s) { s.round++; s.phase = 'playing'; s.answer = null; s.endsAt = +clock() + TURN_MS; }
  function view(s) {
    const p = byId.get(s.ids[s.round]), t = typesOf(p);
    return {
      score: s.score, total: ROUNDS, history: s.history, turnMs: TURN_MS, endsAt: s.endsAt, serverNow: +clock(),
      question: { id: Number(p.id), name: p.name, types: t },
      ...(s.phase !== 'playing' ? { answer: s.answer, reveal: { weak: weaknesses(t).map(([type, m]) => ({ type, x: m })) } } : {})
    };
  }
  function result(s) { return { mode: s.mode, score: s.score, result: s.score >= WIN_AT ? 'win' : 'loss' }; }
  return { init, answer, next, view, result };
}

module.exports = { MODES, ROUNDS, TURN_MS, GRACE_MS, WIN_AT, TYPES, multiplier, weaknesses, createWeakSpots };
