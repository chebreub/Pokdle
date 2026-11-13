'use strict';
// 🧬 Combo de types vérifié par le serveur (13/11/2026, « go 2 »). Mêmes règles que la page :
// 60 s, une paire de types, un Pokémon qui a exactement cette paire (formes comprises), « Passer » sans limite,
// 80 / 100 / 140 / 200 points selon la rareté de la paire. Le serveur tire les paires, juge chaque nom,
// tient le chrono et le score. Ball et ₽ de la 1re partie du jour, Super Ball à 10 combos trouvés.
const MODES = Object.freeze(['typecombo']);
const DURATION_MS = 60000, GRACE_MS = 1500, WIN_AT = 5, MAX_FOUND = 60;
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });

// Comme norm() de la page (script.07) : minuscules, sans accents, « Méga X » rangé comme « mega x ».
function norm(str) {
  return String(str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^(.+?) mega( [xyz])?$/, 'mega $1$2').replace(/^mega[-\s]+/, 'mega ');
}
function tierOf(count) {
  const n = Number(count) || 0;
  if (n <= 2) return { tier: 'legendaire', label: 'Légendaire', points: 200 };
  if (n <= 7) return { tier: 'difficile', label: 'Difficile', points: 140 };
  if (n <= 19) return { tier: 'moyen', label: 'Moyen', points: 100 };
  return { tier: 'facile', label: 'Facile', points: 80 };
}
const keyOf = (a, b) => [String(a || '').trim(), String(b || a || '').trim()].sort().join('|');

// Le même ensemble que typeComboPool() de la page : les 1025 et leurs formes (id ≥ 20000), types hérités de l'espèce.
function comboPool(catalog) {
  const byId = new Map(catalog.map((p) => [Number(p.id), p]));
  const out = [];
  for (const p of catalog) {
    const id = Number(p.id);
    if (!((id > 0 && id < 10000) || id >= 20000)) continue;
    const base = p.baseId ? byId.get(Number(p.baseId)) : null;
    const t1 = p.type1 || (base && base.type1) || null;
    const t2 = Object.prototype.hasOwnProperty.call(p, 'type2') ? p.type2 : (base ? base.type2 : null);
    if (!t1) continue;
    out.push({ id, name: p.name, key: norm(p.name), type1: t1, type2: t2 || t1 });
  }
  return out;
}

function createTypeCombo(catalog, randomInt, clock) {
  const pool = comboPool(catalog);
  const combos = new Map();
  for (const p of pool) {
    const k = keyOf(p.type1, p.type2);
    if (!combos.has(k)) combos.set(k, { key: k, types: [p.type1, p.type2], count: 0 });
    combos.get(k).count++;
  }
  const list = [...combos.values()];
  // Un nom tapé : d'abord le nom exact, sinon le 1er qui commence ainsi, sinon le 1er qui le contient (comme la page).
  function findMon(text) {
    const q = norm(text).trim();
    if (!q) return null;
    return pool.find((p) => p.key === q) || pool.find((p) => p.key.indexOf(q) === 0) || pool.find((p) => p.key.indexOf(q) >= 0) || null;
  }
  function pick(s) {
    let cands = list.filter((c) => !s.recent.includes(c.key));
    if (!cands.length) cands = list;
    const c = cands[randomInt(cands.length)];
    s.recent = [c.key, ...s.recent].slice(0, 8);
    const shown = c.types.slice();
    if (shown[0] !== shown[1] && randomInt(2) === 0) shown.reverse();
    s.combo = { key: c.key, types: shown, count: c.count };
  }
  function init(s) {
    s.score = 0; s.solved = 0; s.found = []; s.recent = []; s.event = null; s.last = null;
    s.endsAt = +clock() + DURATION_MS;
    pick(s);
  }
  function expire(s) {
    if (s.mode !== 'typecombo' || s.phase === 'over' || +clock() < s.endsAt + GRACE_MS) return false;
    s.phase = 'over'; s.event = { kind: 'time' };
    return true;
  }
  function answer(s, text) {
    if (typeof text !== 'string' || !text.trim() || text.length > 60) throw fail('invalid_choice', 400);
    const mon = findMon(text);
    s.last = { round: s.round, text };
    if (mon && keyOf(mon.type1, mon.type2) === s.combo.key) {
      const t = tierOf(s.combo.count);
      s.score += t.points; s.solved++;
      s.found = [{ id: mon.id, name: mon.name, pts: t.points }, ...s.found].slice(0, MAX_FOUND);
      s.event = { kind: 'ok', id: mon.id, name: mon.name, pts: t.points, label: t.label };
      s.round++;
      pick(s);
      return true;
    }
    // Un nom faux montre ses vrais types : l'essai suivant est mieux renseigné. La paire ne change pas.
    s.event = mon ? { kind: 'wrong', id: mon.id, name: mon.name, types: [mon.type1, mon.type2] } : { kind: 'unknown' };
    return false;
  }
  function pass(s) { s.event = { kind: 'pass' }; s.last = null; s.round++; pick(s); }
  function view(s) {
    const c = s.combo, t = tierOf(c.count);
    return {
      score: s.score, solved: s.solved, found: s.found, winAt: WIN_AT, durationMs: DURATION_MS,
      endsAt: s.endsAt, serverNow: +clock(), event: s.event,
      combo: { types: c.types, count: c.count, tier: t }
    };
  }
  // Le score qui compte pour la Ball : le nombre de combos trouvés (Super Ball à 10).
  function result(s) { return { mode: s.mode, score: s.solved, result: s.solved >= WIN_AT ? 'win' : 'loss' }; }
  return { init, expire, answer, pass, view, result, findMon, combos: list, pool };
}

module.exports = { MODES, DURATION_MS, GRACE_MS, WIN_AT, norm, tierOf, comboPool, createTypeCombo };
