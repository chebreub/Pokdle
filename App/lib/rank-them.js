'use strict';
// 🔢 Classe-les (13/11/2026, maquette validée : « go »). 8 manches : 5 Pokémon à ranger dans l'ordre d'un critère
// (vitesse, attaque, PV, défense, poids ou taille). 1 point par Pokémon à sa bonne place, 40 au plus.
// Le serveur tire les Pokémon et le critère, et ne donne les vraies valeurs qu'après la réponse.
// Manches 1 à 3 : des valeurs bien écartées ; ensuite elles se rapprochent.
const STATS = require('../base-stats.json');
const MODES = Object.freeze(['rankthem']);
const ROUNDS = 8, PER_ROUND = 5, WIN_AT = 24;
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });
const STAT_INDEX = { hp: 0, attack: 1, defense: 2, speed: 5 };
const CRITERIA = Object.freeze({
  speed: { label: '⚡ Du plus rapide au plus lent', unit: 'Vitesse de base' },
  attack: { label: '💪 De la meilleure Attaque à la moins bonne', unit: 'Attaque de base' },
  hp: { label: '❤️ Du plus de PV au moins de PV', unit: 'PV de base' },
  defense: { label: '🛡️ De la meilleure Défense à la moins bonne', unit: 'Défense de base' },
  weight: { label: '⚖️ Du plus lourd au plus léger', unit: 'Poids (kg)' },
  height: { label: '📏 Du plus grand au plus petit', unit: 'Taille (m)' }
});
const KEYS = Object.keys(CRITERIA);

function createRankThem(catalog, randomInt) {
  const base = catalog.filter((p) => !p.isAltForm && p.guessable !== false && Number.isInteger(Number(p.id)) && Number(p.id) >= 1 && Number(p.id) <= 1025);
  const byId = new Map(base.map((p) => [Number(p.id), p]));
  function value(p, key) {
    if (key === 'weight' || key === 'height') { const v = Number(p[key]); return Number.isFinite(v) && v > 0 ? v : null; }
    const s = STATS[String(p.id)];
    const v = Array.isArray(s) ? Number(s[STAT_INDEX[key]]) : NaN;
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  // L'écart minimal entre deux valeurs voisines : bien visible au début, plus fin ensuite.
  function gapOk(values, key, round) {
    const sorted = values.slice().sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if (a === b) return false;
      if (round < 3) {
        if ((key === 'weight' || key === 'height') ? b < a * 1.25 : b - a < 12) return false;
      }
    }
    return true;
  }
  function draw(s) {
    const key = KEYS[(s.criteriaOrder[s.round % KEYS.length])];
    const pool = base.filter((p) => s.gens.includes(Number(p.generation)) && value(p, key) != null && !s.seen.includes(Number(p.id)));
    if (pool.length < PER_ROUND) throw fail('invalid_generations', 400);
    for (let tries = 0; tries < 400; tries++) {
      const pick = [];
      while (pick.length < PER_ROUND) { const p = pool[randomInt(pool.length)]; if (!pick.includes(p)) pick.push(p); }
      const values = pick.map((p) => value(p, key));
      if (!gapOk(values, key, tries > 300 ? 3 : s.round)) continue;
      const ids = pick.map((p) => Number(p.id));
      const answer = ids.slice().sort((x, y) => value(byId.get(y), key) - value(byId.get(x), key));
      s.question = { key, ids, answer, values: Object.fromEntries(ids.map((id) => [id, value(byId.get(id), key)])) };
      s.seen = [...s.seen, ...ids].slice(-120);
      return;
    }
    throw fail('unavailable', 503);
  }
  function init(s) {
    s.score = 0; s.history = []; s.seen = []; s.round = 0;
    // Les 6 critères dans un ordre tiré au hasard, puis on recommence (8 manches).
    const order = KEYS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    s.criteriaOrder = order;
    draw(s);
  }
  function answer(s, choice) {
    const q = s.question;
    if (!Array.isArray(choice) || choice.length !== PER_ROUND) throw fail('invalid_choice', 400);
    const ids = choice.map(Number);
    if (new Set(ids).size !== PER_ROUND || ids.some((id) => !q.ids.includes(id))) throw fail('invalid_choice', 400);
    const good = ids.filter((id, i) => q.answer[i] === id).length;
    s.score += good;
    s.answer = { choice: ids, good };
    s.history.push(good);
    s.phase = s.round >= ROUNDS - 1 ? 'over' : 'reveal';
  }
  function next(s) { s.round++; s.phase = 'playing'; s.answer = null; draw(s); }
  function view(s) {
    const q = s.question, c = CRITERIA[q.key];
    return {
      score: s.score, total: ROUNDS, perRound: PER_ROUND, history: s.history,
      question: { key: q.key, label: c.label, unit: c.unit, ids: q.ids },
      ...(s.phase !== 'playing' ? { answer: s.answer, reveal: { order: q.answer, values: q.values } } : {})
    };
  }
  function result(s) { return { mode: s.mode, score: s.score, result: s.score >= WIN_AT ? 'win' : 'loss' }; }
  return { init, answer, next, view, result };
}

module.exports = { MODES, ROUNDS, PER_ROUND, WIN_AT, CRITERIA, createRankThem };
