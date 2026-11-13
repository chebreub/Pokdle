'use strict';
// 🔗 Dernière lettre en Party Room (13/11/2026, maquette validée : « go 1 »).
// Chacun son tour dans l'ordre du salon : un Pokémon qui commence par la dernière lettre du précédent.
// 10, 15 ou 20 s par tour, 1, 2 ou 3 ❤️ (choix de l'hôte ; 15 s et 2 ❤️ par défaut). Un mauvais nom ne coûte rien.
// Temps écoulé : −1 ❤️ et le joueur suivant reçoit une nouvelle lettre (jamais une lettre sans Pokémon restant).
// Jamais deux fois le même Pokémon. Le dernier en vie gagne ; classement : survie, puis nombre de Pokémon donnés.
// Tout est tenu par le serveur : l'ordre, l'horloge, la chaîne et les vies. Pokémon des générations du salon, sans formes.
const { letters, firstLetter, lastLetter } = require('./last-letter');

const TURN_CHOICES = Object.freeze([10, 15, 20]);
const LIVES_CHOICES = Object.freeze([1, 2, 3]);
const DEFAULT_TURN = 15, DEFAULT_LIVES = 2;
const GRACE_MS = 1000;   // réseau : un nom parti juste avant la fin du tour compte encore
const FEED_MAX = 14;

function options(room) {
  const o = room.llOptions || {};
  return { turnSec: TURN_CHOICES.includes(o.turnSec) ? o.turnSec : DEFAULT_TURN, lives: LIVES_CHOICES.includes(o.lives) ? o.lives : DEFAULT_LIVES };
}
function setLastLetterOptions(room, payload = {}) {
  const turnSec = Number(payload.turnSec), lives = Number(payload.lives);
  if (!TURN_CHOICES.includes(turnSec) || !LIVES_CHOICES.includes(lives)) return { error: 'Réglage inconnu.' };
  room.llOptions = { turnSec, lives };
  return { ok: true };
}

function poolOf(catalogue, gens) {
  return catalogue.filter((p) => !p.isAltForm && Number(p.id) >= 1 && Number(p.id) <= 1025 && gens.includes(Number(p.gen || p.generation)) && letters(p.name))
    .map((p) => ({ id: Number(p.id), name: p.name, key: letters(p.name), first: firstLetter(p.name), last: lastLetter(p.name) }));
}

const present = (room, id) => room.players.some((p) => p.id === id);
const openings = (ll, letter) => ll.pool.filter((p) => p.first === letter && !ll.used.has(p.id)).length;
// Une lettre au hasard : la première lettre d'un Pokémon pas encore donné (les lettres courantes sortent plus souvent).
function randomLetter(ll, rnd) {
  const free = ll.pool.filter((p) => !ll.used.has(p.id));
  return free.length ? free[Math.floor(rnd() * free.length)].first : null;
}
function alive(room, ll) { return ll.order.filter((id) => ll.hearts[id] > 0 && present(room, id)); }
function nextAlive(room, ll, fromId) {
  const n = ll.order.length, start = ll.order.indexOf(fromId);
  for (let i = 1; i <= n; i++) {
    const id = ll.order[(start + i) % n];
    if (ll.hearts[id] > 0 && present(room, id)) return id;
  }
  return null;
}
function nick(room, id) { return room.players.find((p) => p.id === id)?.nickname || 'Joueur parti'; }
function feed(ll, item) { ll.feed.push(item); if (ll.feed.length > FEED_MAX) ll.feed.shift(); }
function newTurn(ll, id, now) { ll.turnId = id; ll.turnStartedAt = now; ll.endsAt = now + ll.turnMs; }

function startLastLetter(room, catalogue, rnd = Math.random, now = Date.now()) {
  const gens = Array.isArray(room.selectedGens) && room.selectedGens.length ? room.selectedGens : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pool = poolOf(catalogue, gens);
  if (pool.length < 20) throw new Error('Pas assez de Pokémon dans ces générations.');
  const opt = options(room);
  const order = room.players.filter((p) => p.connected).map((p) => p.id);
  room.roundSerial = (room.roundSerial || 0) + 1;
  room.status = 'playing';
  room.target = null;
  room.totalRounds = 1;
  room.roundNumber = 1;
  const ll = room.lastLetter = {
    pool, byKey: new Map(pool.map((p) => [p.key, p])), used: new Set(), order,
    hearts: Object.fromEntries(order.map((id) => [id, opt.lives])), given: Object.fromEntries(order.map((id) => [id, 0])),
    lives: opt.lives, turnMs: opt.turnSec * 1000, feed: [], chainLength: 0, out: [], traps: {},
    fastest: null, letter: null, turnId: null, endsAt: 0, turnStartedAt: 0, endedReason: null, ranking: null
  };
  for (const p of room.players) { p.score = 0; p.correct = false; p.lastGain = 0; }
  ll.letter = randomLetter(ll, rnd);
  newTurn(ll, order[0], now);
}

// La fin : les joueurs en vie d'abord (par Pokémon donnés), puis les éliminés, du dernier sorti au premier.
function finish(room, ll, reason) {
  ll.endedReason = reason;
  ll.turnId = null;
  const standing = alive(room, ll).sort((a, b) => ll.given[b] - ll.given[a]);
  ll.ranking = [...standing, ...ll.out.slice().reverse().filter((id) => !standing.includes(id))];
  return { ended: true };
}

function submitLastLetter(room, player, payload = {}, now = Date.now()) {
  const ll = room.lastLetter;
  if (!ll || room.status !== 'playing' || ll.endedReason || payload.code !== room.code || payload.roundSerial !== room.roundSerial) return { error: 'Cette partie est terminée ou a changé.' };
  if (player.id !== ll.turnId) return { error: 'Ce n’est pas ton tour.' };
  if (now > ll.endsAt + GRACE_MS) return { error: 'Trop tard pour ce tour.' };
  const key = letters(typeof payload.guess === 'string' ? payload.guess.slice(0, 60) : '');
  if (!key) return { error: 'Écris un nom de Pokémon.' };
  const entry = ll.byKey.get(key);
  if (!entry) return { error: 'Pokémon inconnu dans les générations du salon.' };
  if (entry.first !== ll.letter) return { error: 'Il faut un Pokémon en « ' + ll.letter.toUpperCase() + ' ».' };
  if (ll.used.has(entry.id)) return { error: entry.name + ' est déjà dans la chaîne !' };
  const ms = Math.max(0, now - ll.turnStartedAt);
  ll.used.add(entry.id);
  ll.chainLength++;
  ll.given[player.id] = (ll.given[player.id] || 0) + 1;
  player.score = ll.given[player.id];
  player.lastGain = 1;
  if (!ll.fastest || ms < ll.fastest.ms) ll.fastest = { id: entry.id, name: entry.name, nickname: player.nickname, ms };
  feed(ll, { kind: 'poke', id: entry.id, name: entry.name, by: player.id, nickname: player.nickname, ms });
  // La lettre suivante ; si plus aucun Pokémon ne commence par elle, une nouvelle lettre.
  let next = entry.last;
  if (!openings(ll, next)) {
    next = randomLetter(ll, Math.random);
    if (!next) return { ok: true, name: entry.name, ...finish(room, ll, 'exhausted') };
    feed(ll, { kind: 'letter', from: entry.last, letter: next });
  }
  ll.letter = next;
  newTurn(ll, nextAlive(room, ll, player.id) || player.id, now);
  return { ok: true, name: entry.name };
}

// Fin du tour sans bonne réponse (ou joueur parti) : −1 ❤️, puis le suivant avec une nouvelle lettre.
function timeoutLastLetter(room, rnd = Math.random, now = Date.now()) {
  const ll = room.lastLetter;
  if (!ll || ll.endedReason) return { ended: true };
  const id = ll.turnId;
  const gone = !present(room, id);
  ll.hearts[id] = gone ? 0 : Math.max(0, ll.hearts[id] - 1);
  const out = ll.hearts[id] === 0;
  if (out && !ll.out.includes(id)) ll.out.push(id);
  if (!gone) (ll.traps[ll.letter] = ll.traps[ll.letter] || []).push(nick(room, id));
  feed(ll, { kind: 'timeout', by: id, nickname: nick(room, id), letter: ll.letter, out, gone });
  if (alive(room, ll).length <= 1) return finish(room, ll, 'last');
  const letter = randomLetter(ll, rnd);
  if (!letter) return finish(room, ll, 'exhausted');
  ll.letter = letter;
  newTurn(ll, nextAlive(room, ll, id), now);
  return { ended: false };
}

// Un joueur a quitté le salon : s'il jouait, son tour passe ; s'il reste un seul joueur, la partie s'arrête.
function departLastLetter(room, rnd = Math.random, now = Date.now()) {
  const ll = room.lastLetter;
  if (!ll || ll.endedReason) return { ended: false };
  for (const id of ll.order) if (!present(room, id) && ll.hearts[id] > 0 && id !== ll.turnId) { ll.hearts[id] = 0; ll.out.push(id); }
  if (!present(room, ll.turnId)) return timeoutLastLetter(room, rnd, now);
  if (alive(room, ll).length <= 1) return finish(room, ll, 'last');
  return { ended: false };
}

function publicLastLetter(room, now = Date.now()) {
  const ll = room.lastLetter;
  if (!ll) return null;
  const nextId = ll.turnId ? nextAlive(room, ll, ll.turnId) : null;
  return {
    mode: 'lastletter', roundSerial: room.roundSerial, serverNow: now,
    letter: ll.letter, turnId: ll.turnId, nextId: nextId !== ll.turnId ? nextId : null,
    endsAt: ll.endsAt, turnMs: ll.turnMs, lives: ll.lives, chainLength: ll.chainLength, endedReason: ll.endedReason,
    players: ll.order.map((id) => ({ id, nickname: nick(room, id), hearts: ll.hearts[id], given: ll.given[id] || 0, out: ll.hearts[id] === 0, connected: room.players.some((p) => p.id === id && p.connected) })),
    feed: ll.feed.slice().reverse(),
    ranking: ll.ranking, fastest: ll.fastest,
    traps: Object.entries(ll.traps).sort((a, b) => b[1].length - a[1].length).slice(0, 2).map(([letter, names]) => ({ letter, names: [...new Set(names)] }))
  };
}

// Un joueur qui revient avec un nouvel identifiant de connexion garde sa place, ses vies et ses Pokémon.
function rekeyLastLetter(room, previousId, nextId) {
  const ll = room.lastLetter;
  if (!ll || previousId === nextId) return;
  ll.order = ll.order.map((id) => (id === previousId ? nextId : id));
  for (const map of [ll.hearts, ll.given]) if (previousId in map) { map[nextId] = map[previousId]; delete map[previousId]; }
  ll.out = ll.out.map((id) => (id === previousId ? nextId : id));
  if (ll.turnId === previousId) ll.turnId = nextId;
  if (ll.ranking) ll.ranking = ll.ranking.map((id) => (id === previousId ? nextId : id));
  for (const f of ll.feed) if (f.by === previousId) f.by = nextId;
}

module.exports = { TURN_CHOICES, LIVES_CHOICES, DEFAULT_TURN, DEFAULT_LIVES, GRACE_MS, options, setLastLetterOptions, poolOf,
  startLastLetter, submitLastLetter, timeoutLastLetter, departLastLetter, publicLastLetter, rekeyLastLetter };
