'use strict';
// 🔗 Dernière lettre (13/11/2026, maquette validée : « go 1 »). Chacun son tour contre le Bot : le Pokémon proposé
// doit commencer par la dernière lettre du précédent, jamais deux fois le même, 15 s par tour (horloge du serveur).
// Le joueur peut proposer n'importe lequel des 1025 ; le Bot pioche dans les générations choisies. Le Bot devient
// plus fort au fil de la partie : il sèche de moins en moins souvent et choisit des lettres de plus en plus dures.
// 2 « Changer de lettre » par partie. La partie finit quand le temps d'un tour est écoulé.
// Accents, espaces, points, tirets et symboles sont ignorés : « M. Mime » → mmime, « Nidoran♀ » → nidoran.
const MODES = Object.freeze(['lastletter']);
const TURN_MS = 15000;
const GRACE_MS = 1500;   // réseau : une réponse partie juste avant la fin du tour compte encore
const PASSES = 2;
const WIN_AT = 10;
const BOT_FAIL_BONUS = 2;
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });

function letters(name) {
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z]/g, '');
}
const firstLetter = (name) => letters(name).charAt(0);
const lastLetter = (name) => { const l = letters(name); return l.charAt(l.length - 1); };

function createLastLetter(catalog, randomInt, clock) {
  const base = catalog.filter((p) => !p.isAltForm && Number.isInteger(Number(p.id)) && Number(p.id) >= 1 && Number(p.id) <= 1025 && letters(p.name));
  const byId = new Map(base.map((p) => [Number(p.id), p]));
  const byLetter = new Map();
  for (const p of base) {
    const k = firstLetter(p.name);
    if (!byLetter.has(k)) byLetter.set(k, []);
    byLetter.get(k).push(Number(p.id));
  }
  // Une lettre « dure » a peu de Pokémon qui commencent par elle.
  const openings = (letter, used) => (byLetter.get(letter) || []).filter((id) => !used.includes(id)).length;

  function botPick(s, letter) {
    const used = s.used;
    let options = (byLetter.get(letter) || []).filter((id) => !used.includes(id) && s.gens.includes(Number(byId.get(id).generation)));
    if (!letter) {
      // Pour ouvrir, une lettre où il reste au moins 8 Pokémon ; sinon n'importe lequel.
      const free = base.filter((p) => !used.includes(Number(p.id)) && s.gens.includes(Number(p.generation)));
      const easy = free.filter((p) => openings(lastLetter(p.name), used) >= 8);
      options = (easy.length ? easy : free).map((p) => Number(p.id));
    }
    if (!options.length) return null;
    // Jamais une lettre sans aucun Pokémon restant pour le joueur (« u », « x », « i » s'épuisent vite) :
    // le joueur, lui, peut piéger le Bot de cette façon.
    const fair = options.filter((id) => openings(lastLetter(byId.get(id).name), [...used, id]) > 0);
    if (fair.length) options = fair;
    // Plus fort au fil de la partie : après 8 bonnes réponses, il vise les lettres où il reste peu de Pokémon.
    if (letter && s.score >= 8 && options.length > 3) {
      const ranked = options.map((id) => [id, openings(lastLetter(byId.get(id).name), [...used, id])]).sort((a, b) => a[1] - b[1]);
      options = ranked.slice(0, Math.max(2, Math.ceil(ranked.length / 3))).map((r) => r[0]);
    }
    return options[randomInt(options.length)];
  }
  function botFails(s) {
    // Il sèche parfois au début (≈ 1 fois sur 7), presque jamais ensuite (1 fois sur 30).
    const chance = Math.max(1 / 30, 0.15 - 0.015 * s.score);
    return randomInt(1000) < Math.round(chance * 1000);
  }
  function botPlays(s, letter) {
    const id = botPick(s, letter);
    if (!id) return false;
    s.used.push(id);
    s.chain.push({ id, by: 'bot' });
    s.letter = lastLetter(byId.get(id).name);
    s.turnEndsAt = +clock() + TURN_MS;
    return true;
  }
  function freshStart(s) {
    if (!botPlays(s, '')) throw fail('unavailable', 503);
  }

  function init(s) {
    s.chain = []; s.used = []; s.score = 0; s.passes = PASSES; s.event = null; s.round = 0;
    freshStart(s);
  }
  function expire(s) {
    if (s.mode !== 'lastletter' || s.phase === 'over' || +clock() < s.turnEndsAt + GRACE_MS) return false;
    s.phase = 'over'; s.event = { kind: 'time' };
    return true;
  }
  function answer(s, choice) {
    const id = Number(choice), p = byId.get(id);
    if (!p) throw fail('invalid_choice', 400);
    if (firstLetter(p.name) !== s.letter) throw fail('wrong_letter', 400);
    if (s.used.includes(id)) throw fail('already_used', 400);
    s.used.push(id);
    s.chain.push({ id, by: 'me' });
    s.score++;
    s.round++;
    const letter = lastLetter(p.name);
    if (botFails(s) || !botPlays(s, letter)) {
      // Le Bot sèche : bonus, et il relance avec un nouveau Pokémon.
      s.score += BOT_FAIL_BONUS;
      s.event = { kind: 'bot_stuck', letter, bonus: BOT_FAIL_BONUS };
      s.chain.push({ stuck: true, letter });
      freshStart(s);
    } else s.event = null;
    s.chain = s.chain.slice(-40);
  }
  // « Changer de lettre » : le Bot rejoue un autre Pokémon, 2 fois par partie.
  function pass(s) {
    if (s.passes <= 0) throw fail('no_pass', 400);
    s.passes--;
    s.round++;
    s.event = { kind: 'pass' };
    freshStart(s);
  }
  function view(s) {
    return {
      score: s.score, passes: s.passes, letter: s.letter, used: s.used.length,
      chain: s.chain.slice(-12).map((c) => c.stuck ? { stuck: true, letter: c.letter } : { id: c.id, by: c.by, name: byId.get(c.id).name }),
      event: s.event, turnMs: TURN_MS, turnEndsAt: s.turnEndsAt, serverNow: +clock(), winAt: WIN_AT
    };
  }
  function result(s) { return { mode: s.mode, score: s.score, result: s.score >= WIN_AT ? 'win' : 'loss' }; }
  return { init, expire, answer, pass, view, result };
}

module.exports = { MODES, TURN_MS, GRACE_MS, PASSES, WIN_AT, letters, firstLetter, lastLetter, createLastLetter };
