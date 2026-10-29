"use strict";
// « Dessine-le ! » (29/10): one player draws a Pokémon only they and the server know, the others guess.
// The drawer picks among three (easy, medium, hard); the strokes are relayed live and kept for late joiners.
const CHOOSE_MS = 10000;
const DRAW_MS = 80000;
const TYPE_HINT_MS = 30000;
const GEN_HINT_MS = 50000;
const MAX_POINTS = 9000;
const MAX_PIECE_NUMBERS = 400;
const MAX_WRONG_GUESSES = 30;
const COLORS = 16; // 0–15 are the palette, 16 is the eraser
const SIZES = 3;
const LEVELS = {
  easy: { label: "FACILE", points: 100 },
  medium: { label: "MOYEN", points: 150 },
  hard: { label: "DIFFICILE", points: 200 },
};
// Shapes most players can draw and recognise; « medium » comes from Gens 1–4, « hard » from Gens 5–9.
const EASY_IDS = new Set([
  1, 4, 7, 6, 9, 12, 25, 26, 35, 39, 52, 54, 74, 79, 81, 92, 94, 104, 113, 120, 129, 130, 131, 133, 134, 135, 136, 143, 147, 150, 151,
  152, 155, 158, 172, 175, 183, 196, 197, 202, 249, 250, 251, 252, 255, 258, 302, 320, 321, 351, 359, 382, 383, 384,
  387, 390, 393, 403, 427, 442, 448, 470, 471, 495, 498, 501, 570, 571, 607, 650, 653, 656, 658, 700, 722, 725, 728, 778, 810, 813, 816, 906, 909, 912,
]);

function pokemonLevel(pokemon) {
  if (EASY_IDS.has(Number(pokemon.id))) return "easy";
  return Number(pokemon.gen || pokemon.generation) <= 4 ? "medium" : "hard";
}

function dessinPool(room, catalogue) {
  const gens = Array.isArray(room.selectedGens) && room.selectedGens.length ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const used = new Set(room.dessinUsed || []);
  return catalogue.filter((p) => !p.isAltForm && p.id > 0 && p.id < 10000 && gens.includes(Number(p.gen || p.generation)) && !used.has(p.id));
}

// Three choices, one per level when the generations allow it, never twice the same Pokémon.
function pickDessinOptions(pool, random = Math.random) {
  const picked = [];
  for (const level of ["easy", "medium", "hard"]) {
    let bucket = pool.filter((p) => pokemonLevel(p) === level && !picked.includes(p));
    if (!bucket.length) bucket = pool.filter((p) => !picked.includes(p));
    if (!bucket.length) break;
    picked.push(bucket[Math.floor(random() * bucket.length)]);
  }
  return picked.map((p, i) => ({ id: p.id, name: p.name, level: ["easy", "medium", "hard"][i], type1: p.type1 || null, type2: p.type2 || null, gen: Number(p.gen || p.generation) || null }));
}

function presentPlayers(room, now = Date.now()) {
  return room.players.filter((p) => p.connected || Number(p.reconnectUntil) > now);
}

function nextDrawer(room) {
  const order = (room.dessinOrder || []).filter((id) => room.players.some((p) => p.id === id));
  for (const p of room.players) if (!order.includes(p.id)) order.push(p.id);
  room.dessinOrder = order;
  const start = Math.max(0, (Number(room.roundNumber) || 1) - 1);
  for (let i = 0; i < order.length; i++) {
    const id = order[(start + i) % order.length];
    if (room.players.some((p) => p.id === id && p.connected)) return id;
  }
  return order[0] || null;
}

function startDessinRound(room, catalogue, random = Math.random, now = Date.now()) {
  const pool = dessinPool(room, catalogue);
  const options = pickDessinOptions(pool.length >= 3 ? pool : catalogue.filter((p) => !p.isAltForm && p.id > 0 && p.id < 10000), random);
  room.roundSerial = (room.roundSerial || 0) + 1;
  room.status = "playing";
  room.target = null;
  room.variant = null;
  room.dessin = { phase: "choose", drawerId: nextDrawer(room), options, target: null, level: null, strokes: [], points: 0, guesses: [], found: {}, wrong: {}, chooseEndsAt: now + CHOOSE_MS, drawStartedAt: null, drawEndsAt: null };
  for (const p of room.players) { p.correct = false; p.lastGain = 0; }
}

function chooseDessin(room, player, index, serial, now = Date.now()) {
  const d = room.dessin;
  if (!d || room.status !== "playing" || d.phase !== "choose") return { error: "Le choix est déjà fait." };
  if (serial !== undefined && serial !== room.roundSerial) return { error: "Cette manche a changé." };
  if (player && player.id !== d.drawerId) return { error: "Ce n’est pas ton tour de dessiner." };
  const option = d.options[Number(index)] || d.options[0];
  if (!option) return { error: "Aucun Pokémon disponible." };
  d.phase = "draw";
  d.target = { id: option.id, name: option.name, type1: option.type1, type2: option.type2, gen: option.gen };
  d.level = option.level;
  d.drawStartedAt = now;
  d.drawEndsAt = now + DRAW_MS;
  room.dessinUsed = [...(room.dessinUsed || []), option.id].slice(-200);
  return { chosen: true, target: d.target };
}

function validDrawer(room, player, serial, now) {
  const d = room.dessin;
  if (!d || room.status !== "playing" || d.phase !== "draw") return "Le dessin n’a pas commencé.";
  if (serial !== room.roundSerial) return "Cette manche a changé.";
  if (!player || player.id !== d.drawerId) return "Seul le dessinateur peut dessiner.";
  if (now >= d.drawEndsAt) return "Le temps est écoulé.";
  return null;
}

// A piece of stroke: { k: stroke number, c: colour (16 = eraser), s: size, p: [x, y, x, y…] from 0 to 1000 }.
// A fill (« Remplir ») is a piece with f: 1 and a single point: the closed area under it takes the colour.
function addDessinPiece(room, player, raw, serial, now = Date.now()) {
  const error = validDrawer(room, player, serial, now);
  if (error) return { error };
  const d = room.dessin;
  const k = Number(raw?.k), c = Number(raw?.c), s = Number(raw?.s);
  const p = Array.isArray(raw?.p) ? raw.p : null;
  if (!Number.isInteger(k) || k < 0 || k > 100000 || !Number.isInteger(c) || c < 0 || c > COLORS || !Number.isInteger(s) || s < 0 || s >= SIZES) return { error: "Trait invalide." };
  const fill = raw?.f === 1;
  if (!p || p.length < 2 || p.length > MAX_PIECE_NUMBERS || p.length % 2 || (fill && p.length !== 2)) return { error: "Trait invalide." };
  const pts = p.map((v) => Math.round(Number(v)));
  if (pts.some((v) => !Number.isFinite(v) || v < 0 || v > 1000)) return { error: "Trait invalide." };
  if (d.points + pts.length / 2 > MAX_POINTS) return { error: "Le dessin est plein : efface un peu." };
  const piece = fill ? { k, c, s, p: pts, f: 1 } : { k, c, s, p: pts };
  d.strokes.push(piece);
  d.points += pts.length / 2;
  return { piece };
}

function undoDessin(room, player, serial, now = Date.now()) {
  const error = validDrawer(room, player, serial, now);
  if (error) return { error };
  const d = room.dessin;
  if (!d.strokes.length) return { undone: null };
  const last = d.strokes[d.strokes.length - 1].k;
  d.strokes = d.strokes.filter((piece) => piece.k !== last);
  d.points = d.strokes.reduce((sum, piece) => sum + piece.p.length / 2, 0);
  return { undone: last };
}

function clearDessin(room, player, serial, now = Date.now()) {
  const error = validDrawer(room, player, serial, now);
  if (error) return { error };
  room.dessin.strokes = [];
  room.dessin.points = 0;
  return { cleared: true };
}

function normalizeDessinName(value) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/[^a-z0-9]/g, "");
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// The faster, the more points; the drawer earns a share for each friend who finds.
function dessinGains(room, now) {
  const d = room.dessin;
  const points = LEVELS[d.level]?.points || 100;
  const left = Math.max(0, Math.min(1, (d.drawEndsAt - now) / DRAW_MS));
  const first = Object.keys(d.found).length === 0;
  return { guesser: Math.round(points * (0.5 + 0.5 * left) / 5) * 5 + (first ? 20 : 0), drawer: Math.round(points * 0.3 / 5) * 5 };
}

function guessers(room, now = Date.now()) {
  return presentPlayers(room, now).filter((p) => p.id !== room.dessin?.drawerId);
}

function submitDessinGuess(room, player, raw, serial, resolvePokemon, now = Date.now()) {
  const d = room.dessin;
  if (!d || room.status !== "playing" || d.phase !== "draw") return { error: "Le dessin n’a pas commencé." };
  if (serial !== room.roundSerial) return { error: "Cette manche a changé." };
  if (now >= d.drawEndsAt) return { error: "Le temps est écoulé." };
  if (!player?.connected || !room.players.includes(player)) return { error: "Tu ne participes pas à cette manche." };
  if (player.id === d.drawerId) return { error: "Tu es le dessinateur : à toi de faire deviner !" };
  if (d.found[player.id]) return { already: true };
  if ((d.wrong[player.id] || 0) >= MAX_WRONG_GUESSES) return { error: "Tu as fait le plein d’essais pour ce dessin." };
  const name = String(raw || "").trim();
  if (!name || name.length > 100) return { error: "Choisis un Pokémon dans la liste." };
  const pokemon = resolvePokemon(room, name);
  if (!pokemon) return { error: "Pokémon indisponible dans les générations choisies." };
  if (pokemon.id === d.target.id) {
    const gain = dessinGains(room, now);
    d.found[player.id] = gain.guesser;
    player.correct = true;
    player.lastGain = gain.guesser;
    player.score = (Number(player.score) || 0) + gain.guesser;
    const drawer = room.players.find((p) => p.id === d.drawerId);
    if (drawer) { drawer.lastGain = (Number(drawer.lastGain) || 0) + gain.drawer; drawer.score = (Number(drawer.score) || 0) + gain.drawer; }
    d.guesses.unshift({ playerId: player.id, nickname: player.nickname, correct: true, gain: gain.guesser });
    const ended = guessers(room, now).every((p) => d.found[p.id]);
    return { correct: true, gained: gain.guesser, ended };
  }
  d.wrong[player.id] = (d.wrong[player.id] || 0) + 1;
  const close = editDistance(normalizeDessinName(pokemon.name), normalizeDessinName(d.target.name)) <= 2;
  d.guesses.unshift({ playerId: player.id, nickname: player.nickname, name: pokemon.name, correct: false, close });
  d.guesses = d.guesses.slice(0, 40);
  return { correct: false, close, name: pokemon.name };
}

function drawerGone(room, now = Date.now()) {
  const d = room.dessin;
  return Boolean(d && room.status === "playing" && !room.players.some((p) => p.id === d.drawerId && (p.connected || Number(p.reconnectUntil) > now)));
}

function rekeyDessin(room, previousId, nextId) {
  const d = room.dessin;
  if (Array.isArray(room.dessinOrder)) room.dessinOrder = room.dessinOrder.map((id) => id === previousId ? nextId : id);
  if (!d) return;
  if (d.drawerId === previousId) d.drawerId = nextId;
  for (const map of [d.found, d.wrong]) if (previousId in map) { map[nextId] = map[previousId]; delete map[previousId]; }
  d.guesses.forEach((g) => { if (g.playerId === previousId) g.playerId = nextId; });
}

// « P _ _ _ _ » without the letters: spaces, dots and dashes stay so the shape of the name shows.
function namePattern(name) {
  return [...String(name || "")].map((ch) => /[\p{L}\p{N}]/u.test(ch) ? "_" : ch).join("");
}

function publicDessin(room, viewerId, revealed, now = Date.now()) {
  const d = room.dessin;
  if (!d) return null;
  const isDrawer = viewerId === d.drawerId;
  const drawer = room.players.find((p) => p.id === d.drawerId);
  const started = Number.isFinite(d.drawStartedAt);
  const elapsed = started ? now - d.drawStartedAt : 0;
  const target = d.target;
  const showAll = revealed || isDrawer;
  return {
    mode: "dessin", roundSerial: room.roundSerial, serverNow: now, phase: d.phase,
    drawerId: d.drawerId, drawerNickname: drawer ? drawer.nickname : "Joueur parti",
    chooseEndsAt: d.chooseEndsAt, drawEndsAt: d.drawEndsAt,
    options: isDrawer && d.phase === "choose" ? d.options.map((o) => ({ id: o.id, name: o.name, level: o.level, label: LEVELS[o.level].label, points: LEVELS[o.level].points })) : null,
    secret: isDrawer && d.target ? { id: d.target.id, name: d.target.name, level: d.level, label: LEVELS[d.level].label } : null,
    pattern: d.target ? namePattern(d.target.name) : null,
    typeHint: d.target && (showAll || elapsed >= TYPE_HINT_MS) ? [target?.type1, target?.type2].filter((t) => t && t !== "Aucun").join(" / ") || null : null,
    genHint: d.target && (showAll || elapsed >= GEN_HINT_MS) ? target.gen : null,
    typeHintAt: started ? d.drawStartedAt + TYPE_HINT_MS : null,
    genHintAt: started ? d.drawStartedAt + GEN_HINT_MS : null,
    strokes: d.strokes,
    foundIds: Object.keys(d.found),
    guesses: d.guesses.slice(0, 12).map((g) => ({ nickname: g.nickname, correct: g.correct, gain: g.gain || 0, close: Boolean(g.close), name: g.correct ? null : g.name, mine: g.playerId === viewerId })),
    answer: revealed && d.target ? d.target.name : null,
    answerId: revealed && d.target ? d.target.id : null,
  };
}

module.exports = {
  CHOOSE_MS, DRAW_MS, TYPE_HINT_MS, GEN_HINT_MS, MAX_POINTS, LEVELS, EASY_IDS,
  pokemonLevel, pickDessinOptions, startDessinRound, chooseDessin, addDessinPiece, undoDessin, clearDessin,
  submitDessinGuess, drawerGone, rekeyDessin, namePattern, publicDessin, guessers, editDistance,
};
