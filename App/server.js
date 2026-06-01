const fs = require("fs");
const path = require("path");
const vm = require("vm");
const express = require("express");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : "*",
  },
});

const rooms = new Map();
const statClashRooms = new Map();
const draftBattleRooms = new Map();
const draftScoreRooms = new Map();
const partyRooms = new Map();
const POKEMON_LIST = loadPokemonList();
const POKEMON_BY_NORMALIZED_NAME = new Map(POKEMON_LIST.map((pokemon) => [normalizeName(pokemon.name), pokemon]));
const MAX_ROOM_SIZE = 2;
const PARTY_MIN_PLAYERS = 2;
const PARTY_MAX_PLAYERS = 8;
const STAT_CLASH_TOTAL_ROUNDS = 6;
const STAT_CLASH_MAX_PLAYERS = 2;
const STAT_CLASH_PLAYER_SEATS = ["left", "right", "seat3", "seat4"];
const STAT_CLASH_ROLL_MS = 2600;
const STAT_CLASH_START_DELAY_MS = 1400;
const STAT_CLASH_PICK_MS = 12000;
const STAT_CLASH_REVEAL_MS = 2600;
const STAT_CLASH_LOCKED_REVEAL_MS = 1000;
const STAT_CLASH_SESSION_RECORD_DEFAULT = Object.freeze({
  score: 359,
  winner: "Kayan",
  loser: "MG",
});
const STAT_CLASH_STAT_KEYS = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"];
const STAT_CLASH_STAT_LABELS = {
  hp: "PV",
  attack: "Attack",
  defense: "Defense",
  spAttack: "Special Attack",
  spDefense: "Special Defense",
  speed: "Speed",
};
const STAT_CLASH_STATS_CACHE = new Map();
const STAT_CLASH_STATS_CACHE_MAX = 1500;
const STAT_CLASH_PRESSURE_PICK_MS = 6500;
const STAT_CLASH_PREVIEW_DURATION_MS = 3000;
const STAT_CLASH_FORMATS = {
  bo3: { rounds: 3, suddenDeath: false, label: "Best of 3" },
  standard: { rounds: 6, suddenDeath: false, label: "Standard (6 manches)" },
  bo9: { rounds: 9, suddenDeath: false, label: "Best of 9" },
  suddenDeath: { rounds: 6, suddenDeath: true, label: "Sudden Death" },
};
const STAT_CLASH_HOUSE_RULES = [
  { id: "noSpeedEarly", label: "Vitesse interdite avant la manche 4", desc: "Le bouton Vitesse est verrouille pour les deux camps jusqu'a la M4 incluse." },
  { id: "atkRound3", label: "Manches 3-4 : Attaque obligatoire", desc: "Aux 3e et 4e manches, seul le bouton Attaque est jouable." },
  { id: "noHpFinal", label: "2 dernieres manches : pas de PV", desc: "Le bouton PV est verrouille sur les deux dernieres manches." },
  { id: "weakStart", label: "Manches 1-2 : stat la plus faible imposee", desc: "Aux M1 et M2, seule la stat la plus basse du Pokemon est selectionnable." },
  { id: "pressureLate", label: "Pression : timer 5s a partir de la moitie", desc: "Des la moitie de la partie incluse, le timer est divise par deux (5s)." },
  { id: "doubleStat", label: "Stat star vaut double", desc: "Une stat tiree au sort en debut de partie vaut deux fois ses points quand elle est jouee." },
  { id: "blindRound5", label: "Manche 5 : choix impose entre 2 stats", desc: "A la M5, le camp qui subit choisit entre deux stats tirees au hasard parmi ses non utilisees." },
  { id: "mirrorRound4", label: "Manche 4 : stat imposee identique", desc: "A la M4, une stat est tiree au sort et imposee des deux cotes." },
  { id: "comboBonus", label: "Combo : 3 victoires d'affilee = +2 pts", desc: "Un bonus de 2 pts est applique chaque fois qu'un camp atteint un streak de 3." },
];
const STAT_CLASH_IMPOSABLE_RULE_IDS = new Set(["noSpeedEarly", "atkRound3", "noHpFinal", "weakStart", "pressureLate", "blindRound5"]);
const STAT_CLASH_SHARED_RULE_IDS = new Set(["doubleStat", "mirrorRound4", "comboBonus"]);
function getStatClashRuleById(ruleId) {
  return STAT_CLASH_HOUSE_RULES.find((rule) => rule.id === ruleId) || null;
}
function getRandomStatClashRuleFromSet(ruleIds) {
  const pool = STAT_CLASH_HOUSE_RULES.filter((rule) => ruleIds.has(rule.id));
  return pool[Math.floor(Math.random() * pool.length)] || null;
}
function getOppositeStatClashSide(side) {
  return side === "left" ? "right" : side === "right" ? "left" : null;
}
function buildStatClashRoomJokers() {
  return {
    left: { reroll: 1, preview: 1, double: 1, previewKey: null, doubleArmed: false, previewExpiresAt: null },
    right: { reroll: 1, preview: 1, double: 1, previewKey: null, doubleArmed: false, previewExpiresAt: null },
  };
}
function pickRandomStatClashHouseRule() {
  return STAT_CLASH_HOUSE_RULES[Math.floor(Math.random() * STAT_CLASH_HOUSE_RULES.length)];
}
function getStatClashLowestStatKey(stats) {
  if (!stats) return null;
  let best = null;
  for (const k of STAT_CLASH_STAT_KEYS) {
    const v = Number(stats[k]) || 0;
    if (!best || v < best.value) best = { key: k, value: v };
  }
  return best ? best.key : null;
}
function getStatClashHouseRuleForcedStatsRoom(room, side) {
  if (!room || !room.houseRuleEnabled) return null;
  const imposedRule = room.houseRuleBySide?.[side] || null;
  const legacyRule = !room.houseRuleBySide && room.houseRule ? room.houseRule : null;
  const sharedRule = room.houseRuleShared || legacyRule || null;
  const rule = imposedRule || null;
  const id = rule?.id || legacyRule?.id;
  const round = room.round;
  const total = room.totalRounds || STAT_CLASH_TOTAL_ROUNDS;
  const target = legacyRule ? room.houseRuleTargetSide || null : null;
  const targetOnly = target && side && side !== target;
  if (legacyRule && (id === "atkRound3" || id === "weakStart") && targetOnly) return null;
  if (id === "atkRound3" && (round === 3 || round === 4)) return ["attack"];
  if (id === "noSpeedEarly" && round <= Math.min(3, total - 1)) return STAT_CLASH_STAT_KEYS.filter((k) => k !== "speed");
  if (id === "noHpFinal" && (round === total || round === total - 1)) return STAT_CLASH_STAT_KEYS.filter((k) => k !== "hp");
  if (id === "weakStart" && (round === 1 || round === 2)) {
    const low = getStatClashLowestStatKey(room.currentStats);
    return low ? [low] : null;
  }
  if (sharedRule?.id === "mirrorRound4" && round === 4 && room.mirrorStatKey) return [room.mirrorStatKey];
  return null;
}
function getStatClashAllowedStatsRoom(room, side) {
  if (!room) return STAT_CLASH_STAT_KEYS.slice();
  const used = new Set((room.usedStatKeysBySide && room.usedStatKeysBySide[side]) || []);
  let pool = STAT_CLASH_STAT_KEYS.filter((k) => !used.has(k));
  if (room.suddenDeath) pool = STAT_CLASH_STAT_KEYS.slice();
  const forced = getStatClashHouseRuleForcedStatsRoom(room, side);
  if (Array.isArray(forced) && forced.length) {
    pool = pool.filter((k) => forced.includes(k));
    if (!pool.length && forced.length) pool = forced.slice();
  }
  const blindOptions = room.blindRound5OptionsBySide?.[side];
  if (Array.isArray(blindOptions) && blindOptions.length) {
    const intersect = pool.filter((k) => blindOptions.includes(k));
    pool = intersect.length ? intersect : blindOptions.slice();
  }
  return pool;
}
function getStatClashHouseRuleTimerMsRoom(room) {
  const base = STAT_CLASH_PICK_MS;
  if (!room || !room.houseRuleEnabled) return base;
  const imposedRules = Object.values(room.houseRuleBySide || {});
  const hasPressure = imposedRules.some((rule) => rule?.id === "pressureLate") || (!room.houseRuleBySide && room.houseRule?.id === "pressureLate");
  if (hasPressure && room.round >= Math.ceil((room.totalRounds || STAT_CLASH_TOTAL_ROUNDS) / 2)) return STAT_CLASH_PRESSURE_PICK_MS;
  return base;
}
function applyStatClashDoubleStatRoom(room, statKey, value) {
  let total = Number(value) || 0;
  const sharedRule = room?.houseRuleShared || (!room?.houseRuleBySide ? room?.houseRule : null);
  if (room && sharedRule?.id === "doubleStat" && room.doubleStatKey === statKey && room.houseRuleEnabled) total *= 2;
  return total;
}
function normalizeStatClashFormat(value) {
  return STAT_CLASH_FORMATS[value] ? value : "standard";
}
function clearStatClashPreviewTimers(room) {
  if (!room || !room.previewTimers) return;
  for (const side of ["left", "right"]) {
    if (room.previewTimers[side]) { clearTimeout(room.previewTimers[side]); room.previewTimers[side] = null; }
  }
}
const FETCH_TIMEOUT_MS = 8000;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMITS = {
  "room-join":   { max: 5,  windowMs: 30_000 },
  "guess":       { max: 10, windowMs: RATE_LIMIT_WINDOW_MS },
  "pick":        { max: 6,  windowMs: RATE_LIMIT_WINDOW_MS },
  "action":      { max: 10, windowMs: RATE_LIMIT_WINDOW_MS },
  "gen-update":  { max: 5,  windowMs: RATE_LIMIT_WINDOW_MS },
  "restart":     { max: 3,  windowMs: RATE_LIMIT_WINDOW_MS },
  "commit":      { max: 10, windowMs: RATE_LIMIT_WINDOW_MS },
};
const PAYLOAD_MAX_BYTES = 64_000;
const DRAFT_BATTLE_MAX_TEAM_INDEX = 5;
const rateLimitBuckets = new Map();

function normalizeClientAddress(value) {
  let address = String(value || "").trim();
  if (!address) return "";
  const bracketMatch = address.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) address = bracketMatch[1];
  if (address.startsWith("::ffff:")) address = address.slice(7);
  const ipv4WithPort = address.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4WithPort) address = ipv4WithPort[1];
  return address.toLowerCase();
}

function getClientAddress(socket) {
  const forwarded = socket?.handshake?.headers?.["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const forwardedAddress = String(forwardedValue || "").split(",")[0];
  return normalizeClientAddress(forwardedAddress)
    || normalizeClientAddress(socket?.handshake?.address)
    || normalizeClientAddress(socket?.request?.socket?.remoteAddress)
    || "unknown";
}

function getRateLimitBucket(key, windowMs) {
  let bucket = rateLimitBuckets.get(key);
  if (!bucket) {
    bucket = { hits: [], windowMs };
    rateLimitBuckets.set(key, bucket);
  }
  bucket.windowMs = windowMs;
  return bucket;
}

function pruneBucket(bucket, now) {
  const cutoff = now - bucket.windowMs;
  while (bucket.hits.length && bucket.hits[0] <= cutoff) bucket.hits.shift();
}

function pruneRateLimitBuckets(now) {
  if (rateLimitBuckets.size < 1000) return;
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    pruneBucket(bucket, now);
    if (!bucket.hits.length) rateLimitBuckets.delete(key);
  }
}

function getRateLimitBucketSpecs(socket, category, cfg) {
  const socketId = typeof socket === "string" ? socket : socket?.id;
  const clientAddress = typeof socket === "string" ? "" : getClientAddress(socket);
  const specs = [];
  if (socketId) {
    specs.push({ key: `socket:${socketId}:${category}`, max: cfg.max, windowMs: cfg.windowMs });
  }
  if (clientAddress && clientAddress !== "unknown") {
    specs.push({ key: `ip:${clientAddress}:${category}`, max: cfg.ipMax || Math.max(cfg.max * 2, cfg.max + 2), windowMs: cfg.windowMs });
  }
  return specs;
}

function checkRateLimit(socket, category) {
  const cfg = RATE_LIMITS[category];
  if (!cfg) return false;
  const now = Date.now();
  pruneRateLimitBuckets(now);
  const specs = getRateLimitBucketSpecs(socket, category, cfg);
  if (!specs.length) return false;
  const limited = specs.some((spec) => {
    const bucket = getRateLimitBucket(spec.key, spec.windowMs);
    pruneBucket(bucket, now);
    return bucket.hits.length >= spec.max;
  });
  if (limited) return true;
  specs.forEach((spec) => getRateLimitBucket(spec.key, spec.windowMs).hits.push(now));
  return false;
}

function cleanupRateLimitBuckets(socketId) {
  const prefix = `socket:${socketId}:`;
  for (const key of rateLimitBuckets.keys()) {
    if (key.startsWith(prefix)) rateLimitBuckets.delete(key);
  }
}

function maskCode(code) {
  if (!code || code.length <= 2) return "**";
  return code.slice(0, 2) + "*".repeat(code.length - 2);
}

function isPayloadOversized(payload) {
  try {
    return JSON.stringify(payload).length > PAYLOAD_MAX_BYTES;
  } catch (_error) {
    return true;
  }
}

// Security headers (CSP désactivé : on garde les onclick inline et les CDN externes).
// Tu pourras réactiver une CSP plus stricte une fois les onclick remplacés par addEventListener.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(express.static(__dirname));

app.get("/api/multiplayer/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, pokemon: POKEMON_LIST.length });
});

function generatePartyRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (partyRooms.has(code));
  return code;
}

function joinPlayerToPartyRoom(room, socket, nickname) {
  socket.join(room.code);
  socket.data.partyRoomCode = room.code;
  room.players.push({ id: socket.id, nickname, connected: true, score: 0, correct: false });
}

function publicPartyRoomState(room, viewerId = null) {
  const finished = room.status === "finished";
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    minPlayers: PARTY_MIN_PLAYERS,
    maxPlayers: PARTY_MAX_PLAYERS,
    round: room.target ? { image: room.target.sprite || null, answer: finished ? room.target.name : null } : null,
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      connected: player.connected,
      score: Number(player.score) || 0,
      correct: Boolean(player.correct),
      isSelf: player.id === viewerId,
      isHost: player.id === room.hostId,
    })),
  };
}

function emitPartyRoomState(room) {
  for (const player of room.players) {
    io.to(player.id).emit("party:room-state", publicPartyRoomState(room, player.id));
  }
}

function findPartyRoomBySocket(socketId) {
  const roomCode = io.sockets.sockets.get(socketId)?.data?.partyRoomCode;
  if (roomCode && partyRooms.has(roomCode)) return partyRooms.get(roomCode);
  for (const room of partyRooms.values()) {
    if (room.players.some((player) => player.id === socketId)) return room;
  }
  return null;
}

function schedulePartyRoomCleanup(room) {
  clearPartyRoomCleanup(room);
  room.cleanupTimer = setTimeout(() => { partyRooms.delete(room.code); }, 60_000);
}

function clearPartyRoomCleanup(room) {
  if (!room?.cleanupTimer) return;
  clearTimeout(room.cleanupTimer);
  room.cleanupTimer = null;
}

const PARTY_COMMON_POOL_GENS = [1];

function pickPartyTarget() {
  const pool = POKEMON_LIST.filter((p) => PARTY_COMMON_POOL_GENS.includes(Number(p.gen || p.generation)) && !p.isAltForm && Number(p.id) < 20000);
  const source = pool.length ? pool : POKEMON_LIST;
  return source[Math.floor(Math.random() * source.length)] || null;
}

function startPartyRound(room) {
  room.status = "playing";
  room.target = pickPartyTarget();
  room.roundPlayerIds = room.players.filter((player) => player.connected).map((player) => player.id);
  for (const player of room.players) {
    player.correct = false;
  }
}

function checkPartyRoundFinished(room) {
  const roster = Array.isArray(room.roundPlayerIds) && room.roundPlayerIds.length ? room.roundPlayerIds : room.players.map((p) => p.id);
  const active = room.players.filter((p) => p.connected && roster.includes(p.id));
  if (active.length > 0 && active.every((p) => p.correct)) {
    room.status = "finished";
  }
}

function handlePartyDisconnect(socketId, voluntary) {
  const room = findPartyRoomBySocket(socketId);
  if (!room) return;
  const socket = io.sockets.sockets.get(socketId);
  if (socket?.data) socket.data.partyRoomCode = null;
  const index = room.players.findIndex((entry) => entry.id === socketId);
  if (index === -1) return;
  const wasHost = room.players[index].id === room.hostId;
  room.players.splice(index, 1);
  if (room.players.length === 0) {
    schedulePartyRoomCleanup(room);
    return;
  }
  if (wasHost) {
    const next = room.players.find((entry) => entry.connected) || room.players[0];
    room.hostId = next.id;
  }
  emitPartyRoomState(room);
}

io.on("connection", (socket) => {
  socket.on("duel:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const nickname = sanitizeNickname(payload.nickname);
      const selectedGens = normalizeSelectedGens(payload.selectedGens);
      if (!nickname) return respond(ack, { ok: false, error: "Pseudo invalide." });

      const code = generateRoomCode();
      const room = {
        code,
        status: "waiting",
        createdAt: Date.now(),
        hostId: socket.id,
        players: [],
        selectedGens,
        secretPokemon: null,
        winnerId: null,
        endedReason: null,
        cleanupTimer: null,
      };
      rooms.set(code, room);
      joinPlayerToRoom(room, socket, nickname);
      emitRoomState(room);
      respond(ack, { ok: true, code, room: publicRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de créer la room." });
    }
  });

  socket.on("duel:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const code = sanitizeRoomCode(payload.code);
      const nickname = sanitizeNickname(payload.nickname);
      const room = rooms.get(code);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (!nickname) return respond(ack, { ok: false, error: "Pseudo invalide." });
      if (room.players.length >= MAX_ROOM_SIZE) return respond(ack, { ok: false, error: "La room est déjà complète." });
      if (room.status === "finished") return respond(ack, { ok: false, error: "Cette room est terminée." });

      joinPlayerToRoom(room, socket, nickname);
      if (room.players.length === MAX_ROOM_SIZE) {
        startRoom(room);
      }
      emitRoomState(room);
      respond(ack, { ok: true, code, room: publicRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de rejoindre la room." });
    }
  });

  socket.on("duel:submit-guess", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "guess")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.status !== "live" || !room.secretPokemon) return respond(ack, { ok: false, error: "La manche n'est pas en cours." });

      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });

      const guess = String(payload.guess || "").trim();
      if (!guess) return respond(ack, { ok: false, error: "Entre un nom de Pokémon." });
      if (guess.length > 100) return respond(ack, { ok: false, error: "Nom trop long." });
      const guessedPokemon = resolveRoomPokemonGuess(room, guess);
      if (!guessedPokemon) return respond(ack, { ok: false, error: "Pokémon invalide pour cette room." });

      player.attempts += 1;
      player.lastGuess = guessedPokemon.name;
      player.guesses.unshift(buildGuessFeedback(guessedPokemon, room.secretPokemon));
      const normalizedGuess = normalizeName(guessedPokemon.name);
      const normalizedSecret = normalizeName(room.secretPokemon.name);
      const correct = normalizedGuess === normalizedSecret;

      if (correct) {
        room.status = "finished";
        room.winnerId = player.id;
        room.endedReason = "guess";
        player.correct = true;
      }

      emitRoomState(room);
      if (correct) emitRoomFinished(room);
      respond(ack, { ok: true, correct, attempts: player.attempts });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du guess." });
    }
  });

  socket.on("duel:leave-room", () => {
    try { handleDisconnect(socket.id, true); } catch (_error) { console.error("[duel:leave-room] error", _error?.message || "unknown"); }
  });

  socket.on("duel:update-gens", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "gen-update")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul le créateur peut modifier les générations." });
      if (room.status === "live") return respond(ack, { ok: false, error: "Impossible de changer les générations pendant une manche." });

      room.selectedGens = normalizeSelectedGens(payload.selectedGens);
      emitRoomState(room);
      respond(ack, { ok: true, room: publicRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors de la mise à jour des générations." });
    }
  });

  socket.on("duel:restart-round", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "restart")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.status !== "finished") return respond(ack, { ok: false, error: "La manche n'est pas terminée." });
      if (room.players.length !== MAX_ROOM_SIZE || room.players.some((player) => !player.connected)) {
        return respond(ack, { ok: false, error: "Les deux joueurs doivent être présents pour rejouer." });
      }
      if (Array.isArray(payload.selectedGens)) {
        if (room.hostId !== socket.id) {
          return respond(ack, { ok: false, error: "Seul le créateur peut changer les générations." });
        }
        room.selectedGens = normalizeSelectedGens(payload.selectedGens);
      }
      resetRoomForNewRound(room);
      startRoom(room);
      emitRoomState(room);
      respond(ack, { ok: true, room: publicRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du redémarrage." });
    }
  });

  socket.on("party:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requetes, reessaie dans quelques secondes." });
      const nickname = sanitizeNickname(payload.nickname);
      if (!nickname) return respond(ack, { ok: false, error: "Pseudo invalide." });
      const code = generatePartyRoomCode();
      const room = { code, status: "waiting", createdAt: Date.now(), hostId: socket.id, players: [], cleanupTimer: null };
      partyRooms.set(code, room);
      joinPlayerToPartyRoom(room, socket, nickname);
      emitPartyRoomState(room);
      respond(ack, { ok: true, code, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de creer la room." });
    }
  });

  socket.on("party:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requetes, reessaie dans quelques secondes." });
      const code = sanitizeRoomCode(payload.code);
      const nickname = sanitizeNickname(payload.nickname);
      const room = partyRooms.get(code);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (!nickname) return respond(ack, { ok: false, error: "Pseudo invalide." });
      if (room.players.length >= PARTY_MAX_PLAYERS) return respond(ack, { ok: false, error: "La room est deja complete (8 max)." });
      if (room.status !== "waiting") return respond(ack, { ok: false, error: "La partie a deja demarre." });
      clearPartyRoomCleanup(room);
      joinPlayerToPartyRoom(room, socket, nickname);
      emitPartyRoomState(room);
      respond(ack, { ok: true, code, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de rejoindre la room." });
    }
  });

  socket.on("party:leave-room", () => {
    try { handlePartyDisconnect(socket.id, true); } catch (_error) { console.error("[party:leave-room] error", _error?.message || "unknown"); }
  });

  socket.on("party:start", (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hote peut lancer." });
      if (room.players.length < PARTY_MIN_PLAYERS) return respond(ack, { ok: false, error: "Il faut au moins 2 joueurs." });
      if (room.status === "playing") return respond(ack, { ok: false, error: "Une manche est deja en cours." });
      startPartyRound(room);
      if (!room.target) return respond(ack, { ok: false, error: "Aucune cible disponible." });
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de lancer." });
    }
  });

  socket.on("party:submit-answer", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "party-guess")) return respond(ack, { ok: false, error: "Trop de requetes." });
      const room = findPartyRoomBySocket(socket.id);
      if (!room || room.status !== "playing" || !room.target) return respond(ack, { ok: false, error: "Aucune manche en cours." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Tu n'es pas dans la room." });
      if (player.correct) return respond(ack, { ok: true, already: true, room: publicPartyRoomState(room, socket.id) });
      const guessName = normalizeName(payload.guess);
      const isCorrect = Boolean(guessName) && guessName === normalizeName(room.target.name);
      if (isCorrect) {
        player.correct = true;
        player.score = (Number(player.score) || 0) + 100;
        checkPartyRoundFinished(room);
        emitPartyRoomState(room);
      }
      respond(ack, { ok: true, correct: isCorrect, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Erreur lors de la reponse." });
    }
  });

  socket.on("party:reveal-round", (payload = {}, ack) => {
    try {
      const room = findPartyRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hote peut reveler la manche." });
      if (room.status !== "playing") return respond(ack, { ok: false, error: "Aucune manche en cours." });
      room.status = "finished";
      emitPartyRoomState(room);
      respond(ack, { ok: true, room: publicPartyRoomState(room, socket.id) });
    } catch (error) {
      respond(ack, { ok: false, error: "Impossible de reveler la manche." });
    }
  });

  socket.on("stat-clash:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      console.log("[stat-clash][create-room] request");
      handleStatClashDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const selectedGens = normalizeSelectedGens(payload.selectedGens);
      const code = generateStatClashRoomCode();
      const room = {
        code,
        status: "lobby",
        roundPhase: "waiting",
        createdAt: Date.now(),
        hostId: socket.id,
        players: [],
        maxPlayers: STAT_CLASH_MAX_PLAYERS,
        selectedGens,
        round: 0,
        totalRounds: STAT_CLASH_TOTAL_ROUNDS,
        matchWinsBySide: { left: 0, right: 0 },
        sessionRecord: { ...STAT_CLASH_SESSION_RECORD_DEFAULT },
        usedStatKeysBySide: { left: [], right: [] },
        usedPokemonIds: [],
        currentPokemon: null,
        currentStats: null,
        reveal: null,
        deadlineAt: null,
        winnerId: null,
        endedReason: null,
        cleanupTimer: null,
        startTimer: null,
        rollTimer: null,
        resolveTimer: null,
        nextRoundTimer: null,
        previewTimers: { left: null, right: null },
        format: normalizeStatClashFormat(payload.format),
        houseRuleEnabled: payload.houseRuleEnabled !== false,
        houseRule: null,
        houseRuleBySide: { left: null, right: null },
        houseRuleShared: null,
        houseRuleSharedEnabled: Boolean(payload.houseRuleSharedEnabled),
        pendingImposedRuleBySide: { left: null, right: null },
        doubleStatKey: null,
        mirrorStatKey: null,
        blindRound5OptionsBySide: { left: null, right: null },
        suddenDeath: false,
        streakBySide: { left: 0, right: 0 },
        roundsWonBySide: { left: 0, right: 0 },
        jokersBySide: buildStatClashRoomJokers(),
      };
      statClashRooms.set(code, room);
      joinPlayerToStatClashRoom(room, socket, nickname);
      console.log("[stat-clash][create-room] created", { code: maskCode(code) });
      emitStatClashRoomState(room);
      respond(ack, { ok: true, code, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      console.error("[stat-clash][create-room] error", _error?.message || "unknown");
      respond(ack, { ok: false, error: "Impossible de créer la room Stat Clash." });
    }
  });

  socket.on("stat-clash:join-room", async (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      console.log("[stat-clash][join-room] request");
      handleStatClashDisconnect(socket.id, true);
      const code = sanitizeRoomCode(payload.code);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 2";
      console.log("[stat-clash][join-room] sanitized");
      if (!code) return respond(ack, { ok: false, error: "Code de room invalide." });
      const room = statClashRooms.get(code);
      console.log("[stat-clash][join-room] lookup", { exists: Boolean(room) });
      if (!room) return respond(ack, { ok: false, error: "Room Stat Clash introuvable." });
      if (room.players.length >= (room.maxPlayers || STAT_CLASH_MAX_PLAYERS)) return respond(ack, { ok: false, error: "La room est déjà complète." });
      if (room.status === "finished") return respond(ack, { ok: false, error: "Cette room est terminée." });

      joinPlayerToStatClashRoom(room, socket, nickname);
      console.log("[stat-clash][join-room] joined", { code: maskCode(code), playerCount: room.players.length });
      emitStatClashRoomState(room);
      io.to(room.code).emit("stat-clash:room-presence", { code: room.code, connectedCount: getConnectedStatClashPlayers(room).length });
      respond(ack, { ok: true, code, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      console.error("[stat-clash][join-room] error", _error?.message || "unknown");
      respond(ack, { ok: false, error: "Impossible de rejoindre la room Stat Clash." });
    }
  });

  socket.on("stat-clash:select-imposed-rule", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "gen-update")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Les règles se choisissent dans le lobby." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      const rule = getStatClashRuleById(String(payload.ruleId || ""));
      if (!rule || !STAT_CLASH_IMPOSABLE_RULE_IDS.has(rule.id)) return respond(ack, { ok: false, error: "Règle non disponible." });
      room.pendingImposedRuleBySide = room.pendingImposedRuleBySide || { left: null, right: null };
      const opponentSide = getOppositeStatClashSide(player.side);
      const opponentChoice = opponentSide ? room.pendingImposedRuleBySide[opponentSide] : null;
      if (opponentChoice && opponentChoice === rule.id) return respond(ack, { ok: false, error: "L'adversaire a déjà choisi cette règle, prends-en une autre." });
      room.pendingImposedRuleBySide[player.side] = rule.id;
      emitStatClashRoomState(room);
      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du choix de règle." });
    }
  });

  socket.on("stat-clash:start-game", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "restart")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut lancer la partie." });
      if (!canStatClashRoomStart(room)) return respond(ack, { ok: false, error: "La room n'est pas prête. Il faut deux joueurs connectés." });
      if (room.status === "starting" || room.status === "live") return respond(ack, { ok: false, error: "La partie est déjà en cours de lancement." });

      room.status = "starting";
      room.roundPhase = "waiting";
      room.startedAt = Date.now() + STAT_CLASH_START_DELAY_MS;
      emitStatClashRoomState(room);
      clearStatClashRoomTimers(room);
      room.startTimer = setTimeout(async () => {
        room.startTimer = null;
        if (!canStatClashRoomStart(room)) {
          room.status = "lobby";
          room.roundPhase = "waiting";
          room.startedAt = null;
          emitStatClashRoomState(room);
          return;
        }
        await startStatClashMatch(room);
      }, STAT_CLASH_START_DELAY_MS);

      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du lancement." });
    }
  });

  socket.on("stat-clash:submit-pick", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "pick")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.status !== "live" || room.roundPhase !== "picking") return respond(ack, { ok: false, error: "La manche n'est pas en phase de choix." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      if (player.pendingPickKey) return respond(ack, { ok: false, error: "Choix déjà verrouillé pour cette manche." });

      const statKey = normalizeStatClashStatKey(payload.statKey);
      if (!statKey) return respond(ack, { ok: false, error: "Stat invalide." });
      if (!room.suddenDeath && (room.usedStatKeysBySide?.[player.side] || []).includes(statKey)) {
        return respond(ack, { ok: false, error: "Tu as déjà utilisé cette stat plus tôt." });
      }
      const allowed = getStatClashAllowedStatsRoom(room, player.side);
      if (!allowed.includes(statKey)) {
        return respond(ack, { ok: false, error: "Stat verrouillee par la regle maison cette manche." });
      }

      player.pendingPickKey = statKey;
      player.pendingSubmittedAt = Date.now();
      emitStatClashRoomState(room);
      if (getConnectedStatClashPlayers(room).every((entry) => entry.pendingPickKey)) {
        if (room.resolveTimer) clearTimeout(room.resolveTimer);
        room.roundPhase = "locked";
        room.lockedEndsAt = Date.now() + STAT_CLASH_LOCKED_REVEAL_MS;
        emitStatClashRoomState(room);
        room.resolveTimer = setTimeout(() => resolveStatClashRound(room), STAT_CLASH_LOCKED_REVEAL_MS);
      }
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du choix de stat." });
    }
  });

  socket.on("stat-clash:update-gens", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "gen-update")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul le créateur peut modifier les générations." });
      if (room.status === "live") return respond(ack, { ok: false, error: "Impossible de changer les générations pendant une partie." });

      room.selectedGens = normalizeSelectedGens(payload.selectedGens);
      emitStatClashRoomState(room);
      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors de la mise à jour des générations." });
    }
  });

  socket.on("stat-clash:restart-round", async (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "restart")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.status !== "finished") return respond(ack, { ok: false, error: "La partie n'est pas terminée." });
      if (!canStatClashRoomStart(room)) {
        return respond(ack, { ok: false, error: "Les deux joueurs doivent être présents pour rejouer." });
      }
      if (Array.isArray(payload.selectedGens)) {
        if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul le créateur peut changer les générations." });
        room.selectedGens = normalizeSelectedGens(payload.selectedGens);
      }
      resetStatClashRoomForNewMatch(room);
      room.pendingImposedRuleBySide = { left: null, right: null };
      room.status = "lobby";
      room.roundPhase = "waiting";
      emitStatClashRoomState(room);
      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du redémarrage Stat Clash." });
    }
  });

  socket.on("stat-clash:update-room-options", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "gen-update")) return respond(ack, { ok: false, error: "Trop de requetes, reessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul le createur peut modifier les options." });
      if (room.status === "live" || room.status === "starting") return respond(ack, { ok: false, error: "Impossible de changer les options pendant une partie." });
      if (typeof payload.format === "string") room.format = normalizeStatClashFormat(payload.format);
      if (typeof payload.houseRuleEnabled === "boolean") room.houseRuleEnabled = payload.houseRuleEnabled;
      if (typeof payload.houseRuleSharedEnabled === "boolean") room.houseRuleSharedEnabled = payload.houseRuleSharedEnabled;
      emitStatClashRoomState(room);
      respond(ack, { ok: true, room: publicStatClashRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors de la mise a jour des options." });
    }
  });

  socket.on("stat-clash:use-joker", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "pick")) return respond(ack, { ok: false, error: "Trop de requetes, reessaie dans quelques secondes." });
      const room = findStatClashRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Stat Clash active." });
      if (room.status !== "live" || room.roundPhase !== "picking") return respond(ack, { ok: false, error: "Tu ne peux utiliser un joker que pendant la phase de choix." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      if (player.pendingPickKey) return respond(ack, { ok: false, error: "Choix deja verrouille pour cette manche." });
      const side = player.side;
      const jokers = room.jokersBySide && room.jokersBySide[side];
      if (!jokers) return respond(ack, { ok: false, error: "Aucun joker disponible." });
      const type = String(payload.type || "");
      if (type === "reroll") {
        if (jokers.reroll <= 0) return respond(ack, { ok: false, error: "Joker Reroll deja consomme." });
        jokers.reroll = 0;
        for (const p of room.players) { p.pendingPickKey = null; p.pendingSubmittedAt = null; }
        clearStatClashRoomTimers(room);
        clearStatClashPreviewTimers(room);
        const pool = getStatClashPoolForRoom(room);
        const pokemon = pool[Math.floor(Math.random() * pool.length)] || null;
        room.currentPokemon = pokemon;
        room.reveal = null;
        room.roundPhase = "rolling";
        room.rollEndsAt = Date.now() + STAT_CLASH_ROLL_MS;
        room.deadlineAt = null;
        if (pokemon) room.usedPokemonIds.push(Number(pokemon.id));
        if (room.houseRuleEnabled && (room.houseRuleShared || room.houseRule)?.id === "mirrorRound4" && room.round === 4) {
          const cand = STAT_CLASH_STAT_KEYS.filter((k) => !room.usedStatKeysBySide.left.includes(k) && !room.usedStatKeysBySide.right.includes(k));
          room.mirrorStatKey = cand[Math.floor(Math.random() * cand.length)] || STAT_CLASH_STAT_KEYS[0];
        }
        emitStatClashRoomState(room);
        (async () => {
          try { room.currentStats = pokemon ? await fetchStatClashPokemonStats(pokemon.apiId || pokemon.id) : null; } catch (_e) { room.currentStats = null; }
          room.rollTimer = setTimeout(() => {
            const pickMs = getStatClashHouseRuleTimerMsRoom(room);
            room.roundPhase = "picking";
            room.rollEndsAt = null;
            room.deadlineAt = Date.now() + pickMs;
            emitStatClashRoomState(room);
            room.resolveTimer = setTimeout(() => resolveStatClashRound(room), pickMs);
          }, STAT_CLASH_ROLL_MS);
        })();
        return respond(ack, { ok: true });
      }
      if (type === "preview") {
        if (jokers.preview <= 0) return respond(ack, { ok: false, error: "Joker Apercu deja consomme." });
        const allowed = getStatClashAllowedStatsRoom(room, side);
        const candidates = allowed.length ? allowed : STAT_CLASH_STAT_KEYS;
        jokers.preview = 0;
        jokers.previewKey = candidates[Math.floor(Math.random() * candidates.length)];
        jokers.previewExpiresAt = Date.now() + STAT_CLASH_PREVIEW_DURATION_MS;
        emitStatClashRoomState(room);
        if (!room.previewTimers) room.previewTimers = { left: null, right: null };
        if (room.previewTimers[side]) clearTimeout(room.previewTimers[side]);
        room.previewTimers[side] = setTimeout(() => {
          if (room.jokersBySide && room.jokersBySide[side]) {
            room.jokersBySide[side].previewKey = null;
            room.jokersBySide[side].previewExpiresAt = null;
            emitStatClashRoomState(room);
          }
          if (room.previewTimers) room.previewTimers[side] = null;
        }, STAT_CLASH_PREVIEW_DURATION_MS);
        return respond(ack, { ok: true });
      }
      if (type === "double") {
        if (jokers.double <= 0) return respond(ack, { ok: false, error: "Joker Double deja consomme." });
        if (jokers.doubleArmed) return respond(ack, { ok: false, error: "Joker Double deja arme." });
        jokers.double = 0;
        jokers.doubleArmed = true;
        emitStatClashRoomState(room);
        return respond(ack, { ok: true });
      }
      return respond(ack, { ok: false, error: "Type de joker inconnu." });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors de l'utilisation du joker." });
    }
  });

  socket.on("stat-clash:leave-room", () => {
    try { handleStatClashDisconnect(socket.id, true); } catch (_error) { console.error("[stat-clash:leave-room] error", _error?.message || "unknown"); }
  });

  socket.on("disconnect", () => {
    try { handleDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][duel] error", _error?.message || "unknown"); }
    try { handleStatClashDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][stat-clash] error", _error?.message || "unknown"); }
    try { handleDraftBattleDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][draft-battle] error", _error?.message || "unknown"); }
    try { handleDraftScoreDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][draft-score] error", _error?.message || "unknown"); }
    try { handleHigherLowerDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][higher-lower] error", _error?.message || "unknown"); }
    try { handleStatAuctionDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][stat-auction] error", _error?.message || "unknown"); }
    try { handlePartyDisconnect(socket.id, false); } catch (_error) { console.error("[disconnect][party] error", _error?.message || "unknown"); }
    cleanupRateLimitBuckets(socket.id);
  });

  socket.on("draft-battle:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      handleDraftBattleDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const battleState = payload.battleState && typeof payload.battleState === "object" ? payload.battleState : null;
      if (!battleState) return respond(ack, { ok: false, error: "État de combat invalide." });
      if (isPayloadOversized(battleState)) return respond(ack, { ok: false, error: "Payload trop volumineux." });

      const code = generateDraftBattleRoomCode();
      const room = {
        code,
        status: "waiting",
        hostId: socket.id,
        players: [],
        battleState,
        pendingTurn: null,
        pendingReplacement: null,
        resolvingTurn: null,
        resolvingReplacement: null,
        version: 1,
        cleanupTimer: null,
      };
      draftBattleRooms.set(code, room);
      joinPlayerToDraftBattleRoom(room, socket, nickname, "left");
      emitDraftBattleRoomState(room);
      respond(ack, { ok: true, code, room: publicDraftBattleRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible de créer la room Draft Combat." });
    }
  });

  socket.on("draft-battle:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      handleDraftBattleDisconnect(socket.id, true);
      const code = sanitizeRoomCode(payload.code);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 2";
      const room = draftBattleRooms.get(code);
      if (!room) return respond(ack, { ok: false, error: "Room Draft Combat introuvable." });
      if (room.players.length >= MAX_ROOM_SIZE) return respond(ack, { ok: false, error: "La room est déjà complète." });

      joinPlayerToDraftBattleRoom(room, socket, nickname, "right");
      room.status = room.players.length === MAX_ROOM_SIZE ? "live" : "waiting";
      emitDraftBattleRoomState(room);
      respond(ack, { ok: true, code, room: publicDraftBattleRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible de rejoindre la room Draft Combat." });
    }
  });

  socket.on("draft-battle:leave-room", () => {
    try { handleDraftBattleDisconnect(socket.id, true); } catch (_error) { console.error("[draft-battle:leave-room] error", _error?.message || "unknown"); }
  });

  socket.on("draft-battle:submit-action", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "action")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findDraftBattleRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Draft Combat active." });
      if (room.status !== "live") return respond(ack, { ok: false, error: "Le combat n'est pas prêt." });
      if (room.resolvingTurn) return respond(ack, { ok: false, error: "La résolution du tour est déjà en cours." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      const expectedTurn = Number(room.battleState?.turn) || 1;
      const requestedTurn = Number(payload.turn) || expectedTurn;
      if (requestedTurn !== expectedTurn) return respond(ack, { ok: false, error: "Tour réseau obsolète." });

      if (!room.pendingTurn || Number(room.pendingTurn.turn) !== requestedTurn) {
        room.pendingTurn = {
          turn: requestedTurn,
          actions: { left: null, right: null },
        };
      }
      if (room.pendingTurn.actions[player.side]) {
        return respond(ack, { ok: false, error: "Action déjà enregistrée pour ce tour." });
      }
      if (payload.submittedAction && isPayloadOversized(payload.submittedAction)) {
        return respond(ack, { ok: false, error: "Payload trop volumineux." });
      }
      room.pendingTurn.actions[player.side] = payload.submittedAction || null;
      emitDraftBattleRoomState(room);

      if (room.pendingTurn.actions.left && room.pendingTurn.actions.right) {
        room.resolvingTurn = room.pendingTurn.turn;
        io.to(room.hostId).emit("draft-battle:resolve-turn", {
          code: room.code,
          turn: room.pendingTurn.turn,
          pendingTurn: room.pendingTurn,
        });
      }
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors de la soumission d'action." });
    }
  });

  socket.on("draft-battle:submit-replacement", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "action")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findDraftBattleRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Draft Combat active." });
      if (room.status === "finished") return respond(ack, { ok: false, error: "Le combat est terminé." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      if (!room.battleState?.pendingSwitch || room.battleState?.pendingSwitchSide !== player.side) {
        return respond(ack, { ok: false, error: "Aucun remplacement forcé attendu pour ce camp." });
      }
      if (room.resolvingReplacement || room.pendingReplacement?.side === player.side) {
        return respond(ack, { ok: false, error: "Remplaçant déjà envoyé." });
      }

      const teamIndex = Number(payload.teamIndex);
      if (!Number.isInteger(teamIndex) || teamIndex < 0 || teamIndex > DRAFT_BATTLE_MAX_TEAM_INDEX) {
        return respond(ack, { ok: false, error: "Index de remplacement invalide." });
      }
      room.pendingReplacement = {
        side: player.side,
        teamIndex,
      };
      room.resolvingReplacement = room.pendingReplacement;
      emitDraftBattleRoomState(room);
      io.to(room.hostId).emit("draft-battle:resolve-replacement", {
        code: room.code,
        replacement: room.pendingReplacement,
      });
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du remplacement." });
    }
  });

  socket.on("draft-battle:commit-state", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "commit")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findDraftBattleRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Draft Combat active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut valider l'état." });
      if (!payload.battleState || typeof payload.battleState !== "object") {
        return respond(ack, { ok: false, error: "État de combat invalide." });
      }
      if (isPayloadOversized(payload.battleState)) {
        return respond(ack, { ok: false, error: "Payload trop volumineux." });
      }
      if (!room.resolvingTurn && !room.resolvingReplacement) {
        return respond(ack, { ok: false, error: "Aucune résolution en attente." });
      }

      room.battleState = payload.battleState;
      room.pendingTurn = null;
      room.pendingReplacement = null;
      room.resolvingTurn = null;
      room.resolvingReplacement = null;
      room.version += 1;
      room.status = payload.battleState?.phase === "finished" ? "finished" : "live";
      emitDraftBattleState(room);
      emitDraftBattleRoomState(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du commit d'état." });
    }
  });

  socket.on("draft-score:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      handleDraftScoreDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const code = generateDraftScoreRoomCode();
      const room = {
        code,
        hostId: socket.id,
        status: "lobby",
        players: [{ id: socket.id, side: "left", nickname, connected: true, result: null }],
        winnerSide: null,
        createdAt: Date.now(),
      };
      draftScoreRooms.set(code, room);
      socket.data.draftScoreRoomCode = code;
      socket.join(code);
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true, room: publicDraftScoreRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible de créer la room Score Attack." });
    }
  });

  socket.on("draft-score:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      handleDraftScoreDisconnect(socket.id, true);
      const code = sanitizeRoomCode(payload.code);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 2";
      const room = draftScoreRooms.get(code);
      if (!room) return respond(ack, { ok: false, error: "Room Score Attack introuvable." });
      if (room.players.length >= MAX_ROOM_SIZE) return respond(ack, { ok: false, error: "La room est déjà complète." });
      if (room.status === "finished") return respond(ack, { ok: false, error: "Cette room est terminée." });
      room.players.push({ id: socket.id, side: "right", nickname, connected: true, result: null });
      room.status = "live";
      socket.data.draftScoreRoomCode = code;
      socket.join(code);
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true, room: publicDraftScoreRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible de rejoindre la room Score Attack." });
    }
  });

  socket.on("draft-score:leave-room", () => {
    try { handleDraftScoreDisconnect(socket.id, true); } catch (_error) { console.error("[draft-score:leave-room] error", _error?.message || "unknown"); }
  });

  socket.on("draft-score:start-duel", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "action")) return respond(ack, { ok: false, error: "Trop de requêtes." });
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut lancer le duel." });
      if (room.players.length < 2) return respond(ack, { ok: false, error: "En attente d'un adversaire." });
      // L'host peut toujours (re)lancer un duel — reset complet
      const gen = Number(payload.gen);
      if (!Number.isInteger(gen) || gen < 1 || gen > 9) return respond(ack, { ok: false, error: "Génération invalide." });
      const pool = generateDraftDuelPool(gen);
      if (!pool.length || pool.length < 12) return respond(ack, { ok: false, error: "Pool Pokémon insuffisant." });
      room.duel = {
        gen,
        pool,
        draftedIds: new Set(),
        currentWave: [],
        waveIndex: 0,
        pendingPicks: { left: null, right: null },
        teams: { left: [], right: [] },
        picksRemaining: { left: 6, right: 6 },
        rerollsLeft: 5,
        lastEvent: { kind: "started", at: Date.now() },
      };
      room.duel.currentWave = generateDraftDuelNextWave(room);
      room.status = "live";
      room.winnerSide = null;
      for (const p of room.players) { p.result = null; p.progress = null; }
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du lancement du duel." });
    }
  });

  socket.on("draft-score:pick-option", (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room || !room.duel || room.status !== "live") return respond(ack, { ok: false, error: "Pas de duel actif." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      const side = player.side;
      if (room.duel.pendingPicks[side]) return respond(ack, { ok: false, error: "Tu as déjà choisi pour cette manche." });
      if (room.duel.picksRemaining[side] <= 0) return respond(ack, { ok: false, error: "Plus de picks pour toi." });
      const pokemonId = Number(payload.pokemonId);
      if (!room.duel.currentWave.includes(pokemonId)) return respond(ack, { ok: false, error: "Pokémon hors de la wave courante." });
      const bst = Math.max(0, Math.min(900, Math.round(Number(payload.bst) || 0)));
      room.duel.pendingPicks[side] = { id: pokemonId, bst, timestamp: Date.now() };
      room.duel.lastEvent = { kind: "pick", side, pokemonId, at: Date.now() };

      const both = room.duel.pendingPicks.left && room.duel.pendingPicks.right;
      if (both) {
        const leftPick = room.duel.pendingPicks.left;
        const rightPick = room.duel.pendingPicks.right;
        const conflict = leftPick.id === rightPick.id;
        if (conflict) {
          const winnerSide = Math.random() < 0.5 ? "left" : "right";
          const winnerEntry = buildDuelPokemonEntry(leftPick.id);
          const winnerBst = (winnerSide === "left" ? leftPick.bst : rightPick.bst) || leftPick.bst || rightPick.bst || 0;
          if (winnerEntry) {
            room.duel.teams[winnerSide].push({ ...winnerEntry, bst: winnerBst });
            room.duel.draftedIds.add(winnerEntry.id);
            room.duel.picksRemaining[winnerSide] -= 1;
          }
          room.duel.pendingPicks = { left: null, right: null };
          room.duel.lastEvent = { kind: "conflict", winnerSide, pokemonId: winnerEntry?.id || 0, at: Date.now() };
        } else {
          const leftEntry = buildDuelPokemonEntry(leftPick.id);
          const rightEntry = buildDuelPokemonEntry(rightPick.id);
          if (leftEntry) { room.duel.teams.left.push({ ...leftEntry, bst: leftPick.bst || 0 }); room.duel.draftedIds.add(leftEntry.id); room.duel.picksRemaining.left -= 1; }
          if (rightEntry) { room.duel.teams.right.push({ ...rightEntry, bst: rightPick.bst || 0 }); room.duel.draftedIds.add(rightEntry.id); room.duel.picksRemaining.right -= 1; }
          room.duel.pendingPicks = { left: null, right: null };
          room.duel.lastEvent = { kind: "resolved", at: Date.now() };
        }
        const allDone = room.duel.picksRemaining.left <= 0 && room.duel.picksRemaining.right <= 0;
        if (allDone) {
          for (const p of room.players) {
            const team = room.duel.teams[p.side] || [];
            const bstSum = team.reduce((s, t) => s + (Number(t.bst) || 0), 0);
            const avg = team.length ? Math.round(bstSum / team.length) : 0;
            p.result = {
              average: avg,
              total: bstSum,
              selectedGen: room.duel.gen,
              team: team.map((entry) => ({ id: entry.id, name: entry.name, bst: Number(entry.bst) || 0 })),
              label: avg >= 600 ? "Master 600+" : avg >= 550 ? "Elite 550+" : avg >= 500 ? "Solide 500+" : "Run à améliorer",
              submittedAt: Date.now(),
            };
          }
          finalizeDraftScoreRoom(room);
        } else {
          room.duel.waveIndex += 1;
          room.duel.currentWave = generateDraftDuelNextWave(room);
          emitDraftScoreRoomState(room);
        }
      } else {
        emitDraftScoreRoomState(room);
      }
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du pick." });
    }
  });

  socket.on("draft-score:reset-self", (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false });
      player.result = null;
      player.progress = null;
      // Si tous les joueurs ont reset, la room repasse en live (relance possible)
      if (room.players.every((p) => !p.result)) {
        room.status = "live";
        room.winnerSide = null;
      }
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false });
    }
  });

  socket.on("draft-score:reroll-duel-wave", (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room || !room.duel || room.status !== "live") return respond(ack, { ok: false, error: "Pas de duel actif." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut relancer la vague." });
      // Bloquer si un joueur a déjà pick dans cette wave
      if (room.duel.pendingPicks?.left || room.duel.pendingPicks?.right) return respond(ack, { ok: false, error: "Un joueur a déjà choisi pour cette manche." });
      // Limiter les rerolls (5 max par duel)
      room.duel.rerollsLeft = Math.max(0, Number(room.duel.rerollsLeft ?? 5));
      if (room.duel.rerollsLeft <= 0) return respond(ack, { ok: false, error: "Plus de rerolls disponibles." });
      room.duel.rerollsLeft -= 1;
      room.duel.currentWave = generateDraftDuelNextWave(room);
      room.duel.lastEvent = { kind: "reroll", at: Date.now() };
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false, error: "Erreur lors du reroll." });
    }
  });

  socket.on("draft-score:reaction", (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false });
      const allowed = new Set(["🔥", "😱", "😈", "👍", "🤡", "💀", "👀", "🎯"]);
      const emoji = String(payload.emoji || "").trim();
      if (!allowed.has(emoji)) return respond(ack, { ok: false });
      // Relay to other players in room
      for (const other of room.players) {
        if (other.id === socket.id || !other.connected) continue;
        io.to(other.id).emit("draft-score:reaction-received", { emoji, fromSide: player.side, fromNickname: player.nickname || "Adversaire", at: Date.now() });
      }
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false });
    }
  });

  socket.on("draft-score:pick-progress", (payload = {}, ack) => {
    try {
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room || room.status === "finished") return respond(ack, { ok: false });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false });
      const team = Array.isArray(payload.team) ? payload.team.slice(0, 6).map((entry) => ({
        id: Number(entry?.id) || 0,
        name: String(entry?.name || "").slice(0, 40),
        bst: Math.max(0, Math.min(800, Math.round(Number(entry?.bst) || 0))),
        shiny: Boolean(entry?.shiny),
      })) : [];
      const average = Math.max(0, Math.min(800, Math.round(Number(payload.average) || 0)));
      const total = Math.max(0, Math.min(4800, Math.round(Number(payload.total) || 0)));
      player.progress = { team, average, total, updatedAt: Date.now() };
      emitDraftScoreRoomState(room);
      respond(ack, { ok: true });
    } catch (_error) {
      respond(ack, { ok: false });
    }
  });

  socket.on("draft-score:submit-result", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "action")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie dans quelques secondes." });
      const room = findDraftScoreRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Aucune room Score Attack active." });
      if (room.status === "finished") return respond(ack, { ok: false, error: "La room est déjà terminée." });
      const player = room.players.find((entry) => entry.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      const result = sanitizeDraftScoreResult(payload);
      if (!result) return respond(ack, { ok: false, error: "Résultat Score Attack invalide." });
      player.result = result;
      if (room.players.length === MAX_ROOM_SIZE && room.players.every((entry) => entry.result)) finalizeDraftScoreRoom(room);
      else emitDraftScoreRoomState(room);
      respond(ack, { ok: true, room: publicDraftScoreRoomState(room, socket.id) });
    } catch (_error) {
      respond(ack, { ok: false, error: "Impossible d'envoyer le résultat Score Attack." });
    }
  });

  // === HIGHER OR LOWER — multi 1v1 ===
  socket.on("higher-lower:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie." });
      handleHigherLowerDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const code = generateHigherLowerRoomCode();
      const room = {
        code,
        hostId: socket.id,
        status: "lobby",
        players: [{ id: socket.id, side: "left", nickname, score: 0, cursor: 0, connected: true }],
        sequence: null,
        startedAt: null,
        endsAt: null,
        endTimer: null,
        winnerSide: null,
        selectedGens: Array.isArray(payload.selectedGens) ? payload.selectedGens.map(Number).filter(Boolean) : [],
      };
      higherLowerRooms.set(code, room);
      socket.data.higherLowerRoomCode = code;
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true, room: publicHigherLowerRoomState(room, socket.id) });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors de la création." });
    }
  });

  socket.on("higher-lower:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes, réessaie." });
      handleHigherLowerDisconnect(socket.id, true);
      const code = String(payload.code || "").trim().toUpperCase();
      const nickname = sanitizeNickname(payload.nickname) || "Invité";
      if (!higherLowerRooms.has(code)) return respond(ack, { ok: false, error: "Room introuvable." });
      const room = higherLowerRooms.get(code);
      if (room.players.length >= 2) return respond(ack, { ok: false, error: "Room pleine." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Partie déjà lancée." });
      room.players.push({ id: socket.id, side: "right", nickname, score: 0, cursor: 0, connected: true });
      socket.data.higherLowerRoomCode = code;
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true, room: publicHigherLowerRoomState(room, socket.id) });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors du join." });
    }
  });

  socket.on("higher-lower:leave-room", () => {
    handleHigherLowerDisconnect(socket.id, true);
  });

  socket.on("higher-lower:start-game", (payload = {}, ack) => {
    try {
      const room = findHigherLowerRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut lancer." });
      if (room.players.length < 2) return respond(ack, { ok: false, error: "En attente d'un adversaire." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Déjà lancée." });
      if (Array.isArray(payload.selectedGens) && payload.selectedGens.length) {
        room.selectedGens = payload.selectedGens.map(Number).filter(Boolean);
      }
      const sequence = generateHigherLowerSequence(room.selectedGens);
      if (!sequence?.length) return respond(ack, { ok: false, error: "Pool Pokémon insuffisant pour générer la séquence." });
      room.sequence = sequence;
      room.status = "live";
      room.winnerSide = null;
      for (const p of room.players) { p.score = 0; p.cursor = 0; }
      startHigherLowerMatchTimer(room);
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors du lancement." });
    }
  });

  socket.on("higher-lower:submit-answer", async (payload = {}, ack) => {
    try {
      const room = findHigherLowerRoomBySocket(socket.id);
      if (!room || room.status !== "live") return respond(ack, { ok: false, error: "Pas de partie en cours." });
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      const choice = String(payload.choice || "").toLowerCase();
      if (choice !== "higher" && choice !== "lower") return respond(ack, { ok: false, error: "Choix invalide." });
      // Le serveur recalcule lui-même si la réponse est correcte (no client trust)
      const pair = Array.isArray(room.sequence) ? room.sequence[player.cursor] : null;
      if (!pair) return respond(ack, { ok: false, error: "Paire courante introuvable." });
      const leftStats = await fetchPokemonStatsServer(pair.leftId);
      const rightStats = await fetchPokemonStatsServer(pair.rightId);
      const statKey = pair.statKey || "hp";
      const leftVal = Number(leftStats?.[statKey]) || 0;
      const rightVal = Number(rightStats?.[statKey]) || 0;
      let correct;
      if (rightVal === leftVal) correct = true;
      else if (rightVal > leftVal) correct = (choice === "higher");
      else correct = (choice === "lower");
      if (correct) player.score += 1;
      player.cursor += 1;
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true, correct, leftVal, rightVal });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors de la soumission." });
    }
  });

  socket.on("higher-lower:restart-match", (payload = {}, ack) => {
    try {
      const room = findHigherLowerRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut relancer." });
      if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
      room.status = "lobby";
      room.sequence = null;
      room.startedAt = null;
      room.endsAt = null;
      room.winnerSide = null;
      for (const p of room.players) { p.score = 0; p.cursor = 0; }
      emitHigherLowerRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) {
      respond(ack, { ok: false, error: "Erreur lors du restart." });
    }
  });

  // === STAT AUCTION — multi 1v1 ===
  socket.on("stat-auction:create-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes." });
      handleStatAuctionDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const code = generateStatAuctionRoomCode();
      const room = {
        code,
        hostId: socket.id,
        status: "lobby",
        round: 0,
        totalRounds: 5,
        players: [{ id: socket.id, side: "left", nickname, score: 0, allocations: [], connected: true }],
        sequence: null,
        currentAllocations: { left: null, right: null },
        history: [],
        winnerSide: null,
        selectedGens: Array.isArray(payload.selectedGens) ? payload.selectedGens.map(Number).filter(Boolean) : [],
      };
      statAuctionRooms.set(code, room);
      socket.data.statAuctionRoomCode = code;
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true, room: publicStatAuctionRoomState(room, socket.id) });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur création." }); }
  });

  socket.on("stat-auction:join-room", (payload = {}, ack) => {
    try {
      if (checkRateLimit(socket, "room-join")) return respond(ack, { ok: false, error: "Trop de requêtes." });
      handleStatAuctionDisconnect(socket.id, true);
      const code = String(payload.code || "").trim().toUpperCase();
      const nickname = sanitizeNickname(payload.nickname) || "Invité";
      if (!statAuctionRooms.has(code)) return respond(ack, { ok: false, error: "Room introuvable." });
      const room = statAuctionRooms.get(code);
      if (room.players.length >= 2) return respond(ack, { ok: false, error: "Room pleine." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Partie déjà lancée." });
      room.players.push({ id: socket.id, side: "right", nickname, score: 0, allocations: [], connected: true });
      socket.data.statAuctionRoomCode = code;
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true, room: publicStatAuctionRoomState(room, socket.id) });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur join." }); }
  });

  socket.on("stat-auction:leave-room", () => { handleStatAuctionDisconnect(socket.id, true); });

  socket.on("stat-auction:start-game", (payload = {}, ack) => {
    try {
      const room = findStatAuctionRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut lancer." });
      if (room.players.length < 2) return respond(ack, { ok: false, error: "En attente d'un adversaire." });
      if (room.status !== "lobby") return respond(ack, { ok: false, error: "Déjà lancée." });
      if (Array.isArray(payload.selectedGens) && payload.selectedGens.length) {
        room.selectedGens = payload.selectedGens.map(Number).filter(Boolean);
      }
      const sequence = generateStatAuctionSequence(room.selectedGens, room.totalRounds);
      if (!sequence?.length) return respond(ack, { ok: false, error: "Pool Pokémon insuffisant." });
      room.sequence = sequence;
      room.status = "live";
      room.round = 1;
      room.currentAllocations = { left: null, right: null };
      room.history = [];
      room.winnerSide = null;
      for (const p of room.players) { p.score = 0; p.allocations = []; }
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur lancement." }); }
  });

  socket.on("stat-auction:submit-allocation", async (payload = {}, ack) => {
    try {
      const room = findStatAuctionRoomBySocket(socket.id);
      if (!room || room.status !== "live") return respond(ack, { ok: false, error: "Pas de partie." });
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });
      const allocation = sanitizeStatAuctionAllocation(payload.allocation);
      if (!allocation) return respond(ack, { ok: false, error: "Allocation invalide (somme doit être 100)." });
      // Le serveur calcule le score lui-même depuis les vraies stats serveur (no client trust)
      const pokemonId = Array.isArray(room.sequence) ? room.sequence[room.round - 1] : null;
      const realStats = await fetchPokemonStatsServer(pokemonId);
      let computedScore = 0;
      if (realStats) {
        for (const k of STAT_AUCTION_STAT_KEYS) {
          const alloc = Number(allocation[k]) || 0;
          const val = Number(realStats[k]) || 0;
          computedScore += alloc * val;
        }
      }
      room.currentAllocations[player.side] = { allocation, computedScore, realStats };
      if (room.currentAllocations.left && room.currentAllocations.right) {
        const leftEntry = room.currentAllocations.left;
        const rightEntry = room.currentAllocations.right;
        const leftPlayer = room.players.find((p) => p.side === "left");
        const rightPlayer = room.players.find((p) => p.side === "right");
        if (leftPlayer) { leftPlayer.score += leftEntry.computedScore; leftPlayer.allocations.push(leftEntry.allocation); }
        if (rightPlayer) { rightPlayer.score += rightEntry.computedScore; rightPlayer.allocations.push(rightEntry.allocation); }
        room.history.push({
          round: room.round,
          pokemonId: room.sequence[room.round - 1],
          left: leftEntry,
          right: rightEntry,
        });
        room.currentAllocations = { left: null, right: null };
        if (room.round >= room.totalRounds) {
          room.status = "finished";
          if (leftPlayer && rightPlayer) {
            if (leftPlayer.score > rightPlayer.score) room.winnerSide = "left";
            else if (rightPlayer.score > leftPlayer.score) room.winnerSide = "right";
            else room.winnerSide = "tie";
          }
        } else {
          room.round += 1;
        }
      }
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur submit." }); }
  });

  socket.on("stat-auction:restart-match", (payload = {}, ack) => {
    try {
      const room = findStatAuctionRoomBySocket(socket.id);
      if (!room) return respond(ack, { ok: false, error: "Room introuvable." });
      if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut relancer." });
      room.status = "lobby";
      room.round = 0;
      room.sequence = null;
      room.currentAllocations = { left: null, right: null };
      room.history = [];
      room.winnerSide = null;
      for (const p of room.players) { p.score = 0; p.allocations = []; }
      emitStatAuctionRoomState(room);
      respond(ack, { ok: true });
    } catch (_e) { respond(ack, { ok: false, error: "Erreur restart." }); }
  });
});

// === HIGHER OR LOWER — helpers serveur ===
const higherLowerRooms = new Map();
const HIGHER_LOWER_RUSH_MS_SERVER = 60000;
const HIGHER_LOWER_STAT_KEYS_SERVER = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"];
const HIGHER_LOWER_SEQ_COUNT = 50;

function generateHigherLowerRoomCode() {
  let code;
  do { code = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (higherLowerRooms.has(code));
  return code;
}

function generateHigherLowerSequence(selectedGens) {
  const all = Array.isArray(POKEMON_LIST) ? POKEMON_LIST.filter((p) => Number(p.id) < 10000) : [];
  const filtered = (Array.isArray(selectedGens) && selectedGens.length)
    ? all.filter((p) => selectedGens.includes(Number(p.generation || p.gen)))
    : all.slice();
  if (filtered.length < 2) return null;
  const shuffled = filtered.slice().sort(() => Math.random() - 0.5);
  const seq = [];
  for (let i = 0; i < HIGHER_LOWER_SEQ_COUNT && i + 1 < shuffled.length; i++) {
    const stat = HIGHER_LOWER_STAT_KEYS_SERVER[Math.floor(Math.random() * HIGHER_LOWER_STAT_KEYS_SERVER.length)];
    seq.push({ leftId: shuffled[i].id, rightId: shuffled[i + 1].id, statKey: stat });
  }
  return seq;
}

function findHigherLowerRoomBySocket(socketId) {
  const code = io.sockets.sockets.get(socketId)?.data?.higherLowerRoomCode;
  if (code && higherLowerRooms.has(code)) return higherLowerRooms.get(code);
  for (const room of higherLowerRooms.values()) {
    if (room.players.some((p) => p.id === socketId)) return room;
  }
  return null;
}

function publicHigherLowerRoomState(room, viewerId = null) {
  return {
    code: room.code,
    status: room.status,
    maxPlayers: 2,
    connectedCount: room.players.filter((p) => p.connected).length,
    canStart: room.players.length === 2 && room.players.every((p) => p.connected),
    startedAt: room.startedAt || null,
    endsAt: room.endsAt || null,
    sequence: room.status === "live" || room.status === "finished" ? room.sequence : null,
    selectedGens: Array.isArray(room.selectedGens) ? room.selectedGens.slice() : [],
    players: room.players.map((p) => ({
      id: p.id,
      side: p.side,
      nickname: p.nickname,
      score: p.score,
      cursor: p.cursor,
      connected: p.connected,
      isHost: p.id === room.hostId,
      isSelf: p.id === viewerId,
    })),
    winnerSide: room.winnerSide || null,
  };
}

function emitHigherLowerRoomState(room) {
  for (const p of room.players) {
    if (!p.connected) continue;
    io.to(p.id).emit("higher-lower:room-state", publicHigherLowerRoomState(room, p.id));
  }
}

function finalizeHigherLowerMatch(room) {
  if (!room || room.status === "finished") return;
  room.status = "finished";
  if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
  const left = room.players.find((p) => p.side === "left");
  const right = room.players.find((p) => p.side === "right");
  if (left && right) {
    if (left.score > right.score) room.winnerSide = "left";
    else if (right.score > left.score) room.winnerSide = "right";
    else room.winnerSide = "tie";
  } else if (left || right) {
    room.winnerSide = (left || right).side;
  }
  emitHigherLowerRoomState(room);
}

function startHigherLowerMatchTimer(room) {
  if (room.endTimer) clearTimeout(room.endTimer);
  room.startedAt = Date.now();
  room.endsAt = room.startedAt + HIGHER_LOWER_RUSH_MS_SERVER;
  room.endTimer = setTimeout(() => finalizeHigherLowerMatch(room), HIGHER_LOWER_RUSH_MS_SERVER);
}

function handleHigherLowerDisconnect(socketId, forceLeave) {
  for (const room of Array.from(higherLowerRooms.values())) {
    const player = room.players.find((p) => p.id === socketId);
    if (!player) continue;
    if (forceLeave) {
      room.players = room.players.filter((p) => p.id !== socketId);
    } else {
      player.connected = false;
    }
    const sock = io.sockets.sockets.get(socketId);
    if (sock?.data) sock.data.higherLowerRoomCode = null;
    if (!room.players.length || room.players.every((p) => !p.connected)) {
      if (room.endTimer) { clearTimeout(room.endTimer); room.endTimer = null; }
      higherLowerRooms.delete(room.code);
      continue;
    }
    if (room.hostId === socketId && room.players.length) {
      room.hostId = room.players[0].id;
      room.players[0].side = "left";
    }
    emitHigherLowerRoomState(room);
  }
}

// === STAT AUCTION — helpers serveur ===
const statAuctionRooms = new Map();
const STAT_AUCTION_STAT_KEYS = ["hp", "attack", "defense", "spAttack", "spDefense", "speed"];
const STAT_AUCTION_TOTAL_POINTS = 100;
const STAT_AUCTION_DEFAULT_ROUNDS = 5;

function generateStatAuctionRoomCode() {
  let code;
  do { code = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (statAuctionRooms.has(code));
  return code;
}

function generateStatAuctionSequence(selectedGens, count) {
  const all = Array.isArray(POKEMON_LIST) ? POKEMON_LIST.filter((p) => Number(p.id) < 10000) : [];
  const filtered = (Array.isArray(selectedGens) && selectedGens.length)
    ? all.filter((p) => selectedGens.includes(Number(p.generation || p.gen)))
    : all.slice();
  if (filtered.length < count) return null;
  return filtered.slice().sort(() => Math.random() - 0.5).slice(0, count).map((p) => Number(p.id));
}

function sanitizeStatAuctionAllocation(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  let total = 0;
  for (const k of STAT_AUCTION_STAT_KEYS) {
    const v = Math.max(0, Math.min(STAT_AUCTION_TOTAL_POINTS, Math.round(Number(raw[k]) || 0)));
    out[k] = v;
    total += v;
  }
  if (total !== STAT_AUCTION_TOTAL_POINTS) return null;
  return out;
}

function findStatAuctionRoomBySocket(socketId) {
  const code = io.sockets.sockets.get(socketId)?.data?.statAuctionRoomCode;
  if (code && statAuctionRooms.has(code)) return statAuctionRooms.get(code);
  for (const room of statAuctionRooms.values()) {
    if (room.players.some((p) => p.id === socketId)) return room;
  }
  return null;
}

function publicStatAuctionRoomState(room, viewerId = null) {
  return {
    code: room.code,
    status: room.status,
    round: room.round,
    totalRounds: room.totalRounds || STAT_AUCTION_DEFAULT_ROUNDS,
    maxPlayers: 2,
    connectedCount: room.players.filter((p) => p.connected).length,
    canStart: room.players.length === 2 && room.players.every((p) => p.connected),
    sequence: room.status === "live" || room.status === "finished" ? room.sequence : null,
    selectedGens: Array.isArray(room.selectedGens) ? room.selectedGens.slice() : [],
    history: Array.isArray(room.history) ? room.history.slice() : [],
    currentAllocations: {
      left: room.currentAllocations?.left ? { submitted: true } : null,
      right: room.currentAllocations?.right ? { submitted: true } : null,
    },
    players: room.players.map((p) => ({
      id: p.id,
      side: p.side,
      nickname: p.nickname,
      score: p.score,
      submittedThisRound: Boolean(room.currentAllocations?.[p.side]),
      connected: p.connected,
      isHost: p.id === room.hostId,
      isSelf: p.id === viewerId,
    })),
    winnerSide: room.winnerSide || null,
  };
}

function emitStatAuctionRoomState(room) {
  for (const p of room.players) {
    if (!p.connected) continue;
    io.to(p.id).emit("stat-auction:room-state", publicStatAuctionRoomState(room, p.id));
  }
}

function handleStatAuctionDisconnect(socketId, forceLeave) {
  for (const room of Array.from(statAuctionRooms.values())) {
    const player = room.players.find((p) => p.id === socketId);
    if (!player) continue;
    if (forceLeave) {
      room.players = room.players.filter((p) => p.id !== socketId);
    } else {
      player.connected = false;
    }
    const sock = io.sockets.sockets.get(socketId);
    if (sock?.data) sock.data.statAuctionRoomCode = null;
    if (!room.players.length || room.players.every((p) => !p.connected)) {
      statAuctionRooms.delete(room.code);
      continue;
    }
    if (room.hostId === socketId && room.players.length) {
      room.hostId = room.players[0].id;
      room.players[0].side = "left";
    }
    emitStatAuctionRoomState(room);
  }
}

server.listen(PORT, () => {
  console.log(`Pokédle multiplayer server running on port ${PORT}`);
  if (!ALLOWED_ORIGINS.length) {
    console.warn("[security] ALLOWED_ORIGINS not set — CORS is open to all origins. Set ALLOWED_ORIGINS in production.");
  }
});

// === Cache stats Pokémon serveur (sécurité 1v1) ===
const POKEMON_STATS_SERVER_CACHE = new Map();
const POKEAPI_STAT_KEY_MAP = {
  "hp": "hp",
  "attack": "attack",
  "defense": "defense",
  "special-attack": "spAttack",
  "special-defense": "spDefense",
  "speed": "speed",
};

async function fetchPokemonStatsServer(pokemonId) {
  const id = Number(pokemonId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (POKEMON_STATS_SERVER_CACHE.has(id)) return POKEMON_STATS_SERVER_CACHE.get(id);
  if (typeof fetch !== "function") return null;
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`, { headers: { "User-Agent": "pokdle-server/1.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    const statsRaw = Array.isArray(data?.stats) ? data.stats : [];
    const stats = { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
    for (const s of statsRaw) {
      const key = POKEAPI_STAT_KEY_MAP[s?.stat?.name];
      const value = Number(s?.base_stat) || 0;
      if (key) stats[key] = value;
    }
    POKEMON_STATS_SERVER_CACHE.set(id, stats);
    return stats;
  } catch (_e) {
    return null;
  }
}

function respond(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function loadPokemonList() {
  const filePath = path.join(__dirname, "pokemon.js");
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error("POKEMON_LIST introuvable dans pokemon.js");
  const list = JSON.parse(match[1]);
  injectStatClashExtraForms(list);
  return list;
}

function loadStatClashExtraFormsConfig() {
  const filePath = path.join(__dirname, "script.js");
  const raw = fs.readFileSync(filePath, "utf8");
  const extraMatch = raw.match(/const EXTRA_FORMS =\s*(\[[\s\S]*?\]);/);
  const apiMapMatch = raw.match(/const FORM_API_NAME_BY_NAME =\s*({[\s\S]*?});/);
  if (!extraMatch || !apiMapMatch) return { extraForms: [], apiNamesByName: {} };

  const context = {};
  vm.createContext(context);
  vm.runInContext(`extraForms = ${extraMatch[1]}; apiNamesByName = ${apiMapMatch[1]};`, context);
  return {
    extraForms: Array.isArray(context.extraForms) ? context.extraForms : [],
    apiNamesByName: context.apiNamesByName && typeof context.apiNamesByName === "object" ? context.apiNamesByName : {},
  };
}

function buildSpriteUrl(spriteId) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${spriteId}.png`;
}

function injectStatClashExtraForms(list) {
  const { extraForms, apiNamesByName } = loadStatClashExtraFormsConfig();
  const byId = new Set(list.map((pokemon) => pokemon.id));
  const byName = new Set(list.map((pokemon) => pokemon.name));
  const baseById = new Map(list.map((pokemon) => [pokemon.id, pokemon]));

  for (const form of extraForms) {
    if (!form || byId.has(form.id) || byName.has(form.name)) continue;
    const base = baseById.get(form.baseId);
    if (!base) continue;

    const spriteId = Number.isInteger(form.spriteId) ? form.spriteId : base.spriteId || base.id;
    const gen = Number(form.gen) || Number(base.gen) || Number(base.generation) || 1;
    const apiId = apiNamesByName?.[form.name] || String(form.baseId || base.id);

    list.push({
      ...base,
      id: form.id,
      name: form.name,
      type1: form.type1 || base.type1,
      type2: form.type2 !== undefined ? form.type2 : (base.type2 || null),
      gen,
      generation: gen,
      color: form.color || base.color,
      habitat: form.habitat || base.habitat,
      stage: Number.isInteger(form.stage) ? form.stage : base.stage,
      height: typeof form.height === "number" ? form.height : base.height,
      weight: typeof form.weight === "number" ? form.weight : base.weight,
      spriteId,
      sprite: form.sprite || base.sprite || buildSpriteUrl(spriteId),
      isAltForm: true,
      baseId: form.baseId,
      apiId,
    });
    byId.add(form.id);
    byName.add(form.name);
  }
}

function sanitizeNickname(value) {
  const text = String(value || "").trim().slice(0, 24);
  return text.replace(/[<>"'`\\\n\r\t\x00-\x1f]/g, "");
}

function sanitizeRoomCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function normalizeSelectedGens(input) {
  const source = Array.isArray(input) ? input : [];
  const out = Array.from(new Set(source.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 9)));
  return out.length ? out : [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function generateStatClashRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = `SC${Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
  } while (statClashRooms.has(code));
  return code;
}

function generateDraftBattleRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = `DB${Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
  } while (draftBattleRooms.has(code));
  return code;
}

function generateDraftScoreRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = `DS${Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
  } while (draftScoreRooms.has(code));
  return code;
}

function normalizeStatClashStatKey(value) {
  const key = String(value || "").trim();
  return STAT_CLASH_STAT_KEYS.includes(key) ? key : null;
}

async function fetchStatClashPokemonStats(pokemonId) {
  const apiId = typeof pokemonId === "string" && pokemonId.trim()
    ? pokemonId.trim()
    : Number(pokemonId);
  if ((!Number.isInteger(apiId) || apiId <= 0) && typeof apiId !== "string") return null;
  if (STAT_CLASH_STATS_CACHE.has(apiId)) return STAT_CLASH_STATS_CACHE.get(apiId);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiId}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const data = await response.json();
    const statsMap = new Map((data?.stats || []).map((entry) => [entry.stat?.name, Number(entry.base_stat) || 0]));
    const parsed = {
      hp: statsMap.get("hp") || 0,
      attack: statsMap.get("attack") || 0,
      defense: statsMap.get("defense") || 0,
      spAttack: statsMap.get("special-attack") || 0,
      spDefense: statsMap.get("special-defense") || 0,
      speed: statsMap.get("speed") || 0,
    };
    if (STAT_CLASH_STATS_CACHE.size >= STAT_CLASH_STATS_CACHE_MAX) {
      const oldest = STAT_CLASH_STATS_CACHE.keys().next().value;
      STAT_CLASH_STATS_CACHE.delete(oldest);
    }
    STAT_CLASH_STATS_CACHE.set(apiId, parsed);
    return parsed;
  } catch (_error) {
    return null;
  }
}

function resetStatClashRoomForNewMatch(room) {
  clearStatClashCleanup(room);
  clearStatClashRoomTimers(room);
  room.status = "lobby";
  room.roundPhase = "waiting";
  room.round = 0;
  room.usedStatKeysBySide = { left: [], right: [] };
  room.usedPokemonIds = [];
  room.currentPokemon = null;
  room.currentStats = null;
  room.reveal = null;
  room.deadlineAt = null;
  room.rollEndsAt = null;
  room.lockedEndsAt = null;
  room.startedAt = null;
  room.winnerId = null;
  room.endedReason = null;
  for (const player of room.players) {
    player.score = 0;
    player.history = [];
    player.pendingPickKey = null;
    player.pendingSubmittedAt = null;
  }
  room.houseRule = null;
  room.houseRuleBySide = { left: null, right: null };
  room.houseRuleShared = null;
  room.doubleStatKey = null;
  room.mirrorStatKey = null;
  room.blindRound5OptionsBySide = { left: null, right: null };
  room.streakBySide = { left: 0, right: 0 };
  room.roundsWonBySide = { left: 0, right: 0 };
  room.jokersBySide = buildStatClashRoomJokers();
  room.suddenDeath = false;
  clearStatClashPreviewTimers(room);
}

function getConnectedStatClashPlayers(room) {
  return room.players.filter((player) => player.connected);
}

function canStatClashRoomStart(room) {
  const connected = getConnectedStatClashPlayers(room);
  if (connected.length < (room.maxPlayers || STAT_CLASH_MAX_PLAYERS)) return false;
  if (room.houseRuleEnabled === false) return true;
  const pending = room.pendingImposedRuleBySide || {};
  return connected.every((player) => STAT_CLASH_IMPOSABLE_RULE_IDS.has(pending[player.side]));
}

function getStatClashPoolForRoom(room) {
  const unused = POKEMON_LIST.filter((pokemon) => !room.usedPokemonIds.includes(Number(pokemon.id)));
  return unused.length ? unused : POKEMON_LIST;
}

async function startStatClashMatch(room) {
  resetStatClashRoomForNewMatch(room);
  const fmt = STAT_CLASH_FORMATS[normalizeStatClashFormat(room.format)] || STAT_CLASH_FORMATS.standard;
  room.totalRounds = fmt.rounds;
  room.suddenDeath = Boolean(fmt.suddenDeath);
  if (room.houseRuleEnabled !== false) {
    const pending = room.pendingImposedRuleBySide || {};
    room.houseRuleBySide = { left: null, right: null };
    for (const player of room.players) {
      const targetSide = getOppositeStatClashSide(player.side);
      const rule = getStatClashRuleById(pending[player.side]);
      if (targetSide && rule && STAT_CLASH_IMPOSABLE_RULE_IDS.has(rule.id)) room.houseRuleBySide[targetSide] = rule;
    }
    room.houseRuleShared = room.houseRuleSharedEnabled ? getRandomStatClashRuleFromSet(STAT_CLASH_SHARED_RULE_IDS) : null;
    room.houseRule = room.houseRuleShared;
    room.houseRuleTargetSide = null;
    if (room.houseRuleShared?.id === "doubleStat") {
      room.doubleStatKey = STAT_CLASH_STAT_KEYS[Math.floor(Math.random() * STAT_CLASH_STAT_KEYS.length)];
    }
  } else {
    room.houseRule = null;
    room.houseRuleBySide = { left: null, right: null };
    room.houseRuleShared = null;
    room.houseRuleTargetSide = null;
  }
  room.jokersBySide = buildStatClashRoomJokers();
  room.streakBySide = { left: 0, right: 0 };
  room.roundsWonBySide = { left: 0, right: 0 };
  room.status = "live";
  room.round = 1;
  await startStatClashRound(room);
}

async function startStatClashRound(room) {
  clearStatClashCleanup(room);
  clearStatClashRoomTimers(room);
  clearStatClashPreviewTimers(room);
  if (room.jokersBySide && room.jokersBySide.left) room.jokersBySide.left.doubleArmed = false;
  if (room.jokersBySide && room.jokersBySide.right) room.jokersBySide.right.doubleArmed = false;
  const pool = getStatClashPoolForRoom(room);
  const pokemon = pool[Math.floor(Math.random() * pool.length)] || null;
  room.currentPokemon = pokemon;
  room.currentStats = pokemon ? await fetchStatClashPokemonStats(pokemon.apiId || pokemon.id) : null;
  room.currentPokemon && room.usedPokemonIds.push(Number(room.currentPokemon.id));
  room.reveal = null;
  room.roundPhase = "rolling";
  room.rollEndsAt = Date.now() + STAT_CLASH_ROLL_MS;
  room.lockedEndsAt = null;
  room.deadlineAt = null;
  for (const player of room.players) {
    player.pendingPickKey = null;
    player.pendingSubmittedAt = null;
  }
  if (room.jokersBySide && room.jokersBySide.left) { room.jokersBySide.left.previewKey = null; room.jokersBySide.left.previewExpiresAt = null; }
  if (room.jokersBySide && room.jokersBySide.right) { room.jokersBySide.right.previewKey = null; room.jokersBySide.right.previewExpiresAt = null; }
  if (room.houseRuleEnabled && (room.houseRuleShared || room.houseRule)?.id === "mirrorRound4" && room.round === 4) {
    const cand = STAT_CLASH_STAT_KEYS.filter((k) => !room.usedStatKeysBySide.left.includes(k) && !room.usedStatKeysBySide.right.includes(k));
    room.mirrorStatKey = cand[Math.floor(Math.random() * cand.length)] || STAT_CLASH_STAT_KEYS[0];
  } else {
    room.mirrorStatKey = null;
  }
  // Pre-tirage : pour chaque side subissant blindRound5 a M5, choisir 2 stats non utilisees parmi lesquelles le joueur devra choisir
  room.blindRound5OptionsBySide = { left: null, right: null };
  if (room.houseRuleEnabled && room.round === 5 && room.houseRuleBySide) {
    for (const player of room.players) {
      if (room.houseRuleBySide?.[player.side]?.id !== "blindRound5") continue;
      const used = new Set((room.usedStatKeysBySide && room.usedStatKeysBySide[player.side]) || []);
      const remaining = STAT_CLASH_STAT_KEYS.filter((k) => !used.has(k));
      const pool = remaining.length ? remaining : STAT_CLASH_STAT_KEYS.slice();
      const shuffled = pool.slice().sort(() => Math.random() - 0.5);
      room.blindRound5OptionsBySide[player.side] = shuffled.slice(0, Math.min(2, shuffled.length));
    }
  }
  emitStatClashRoomState(room);
  room.rollTimer = setTimeout(() => {
    const legacyBlindRound = !room.houseRuleBySide && room.houseRule?.id === "blindRound5";
    if (room.houseRuleEnabled && room.round === 5 && (legacyBlindRound || room.players.every((player) => room.houseRuleBySide?.[player.side]?.id === "blindRound5"))) {
      room.roundPhase = "picking";
      room.rollEndsAt = null;
      room.deadlineAt = Date.now() + 800;
      for (const player of room.players) {
        const allowed = getStatClashAllowedStatsRoom(room, player.side);
        const candidates = allowed.length ? allowed : STAT_CLASH_STAT_KEYS;
        player.pendingPickKey = candidates[Math.floor(Math.random() * candidates.length)];
        player.pendingSubmittedAt = Date.now();
      }
      room.roundPhase = "locked";
      room.lockedEndsAt = Date.now() + STAT_CLASH_LOCKED_REVEAL_MS;
      emitStatClashRoomState(room);
      room.resolveTimer = setTimeout(() => resolveStatClashRound(room), STAT_CLASH_LOCKED_REVEAL_MS);
      return;
    }
    const pickMs = getStatClashHouseRuleTimerMsRoom(room);
    room.roundPhase = "picking";
    room.rollEndsAt = null;
    room.deadlineAt = Date.now() + pickMs;
    emitStatClashRoomState(room);
    room.resolveTimer = setTimeout(() => resolveStatClashRound(room), pickMs);
  }, STAT_CLASH_ROLL_MS);
}

function pickBestRemainingStatKey(usedKeys, stats) {
  const available = STAT_CLASH_STAT_KEYS.filter((key) => !usedKeys.has(key));
  if (!available.length) return null;
  return available.sort((left, right) => (Number(stats?.[right]) || 0) - (Number(stats?.[left]) || 0))[0];
}

function resolveStatClashAssignedPicks(room) {
  return room.players.map((player) => {
    const used = new Set(room.usedStatKeysBySide?.[player.side] || []);
    let finalKey = player.pendingPickKey && !used.has(player.pendingPickKey) ? player.pendingPickKey : null;
    let auto = false;
    if (!finalKey) {
      finalKey = pickBestRemainingStatKey(used, room.currentStats);
      auto = true;
    }
    if (!finalKey) return { player, key: null, value: 0, auto: true };
    return {
      player,
      key: finalKey,
      value: Number(room.currentStats?.[finalKey]) || 0,
      auto: auto || finalKey !== player.pendingPickKey,
    };
  });
}

function finalizeStatClashMatch(room) {
  room.status = "finished";
  room.roundPhase = "finished";
  const [leftPlayer, rightPlayer] = room.players;
  if (!leftPlayer || !rightPlayer) {
    room.winnerId = null;
  } else if (leftPlayer.score === rightPlayer.score) {
    const wL = Number(room.roundsWonBySide && room.roundsWonBySide.left) || 0;
    const wR = Number(room.roundsWonBySide && room.roundsWonBySide.right) || 0;
    if (wL > wR) room.winnerId = leftPlayer.id;
    else if (wR > wL) room.winnerId = rightPlayer.id;
    else room.winnerId = null;
  } else {
    room.winnerId = leftPlayer.score > rightPlayer.score ? leftPlayer.id : rightPlayer.id;
  }
  if (room.winnerId && leftPlayer && rightPlayer) {
    const winnerSide = room.winnerId === leftPlayer.id ? "left" : "right";
    room.matchWinsBySide[winnerSide] = (Number(room.matchWinsBySide?.[winnerSide]) || 0) + 1;
  }
  const scoreGap = Math.abs((Number(leftPlayer?.score) || 0) - (Number(rightPlayer?.score) || 0));
  if (scoreGap > (Number(room.sessionRecord?.score) || 0)) {
    const winner = !leftPlayer || !rightPlayer || leftPlayer.score === rightPlayer.score
      ? null
      : leftPlayer.score > rightPlayer.score
        ? leftPlayer
        : rightPlayer;
    const loser = winner?.id === leftPlayer?.id ? rightPlayer : leftPlayer;
    if (winner && loser) {
      room.sessionRecord = {
        score: scoreGap,
        winner: winner.nickname || "Joueur 1",
        loser: loser.nickname || "Joueur 2",
      };
    }
  }
  room.endedReason = "completed";
  emitStatClashRoomState(room);
  emitStatClashFinished(room);
}

async function resolveStatClashRound(room) {
  if (!room || room.status !== "live" || !["picking", "rolling", "locked"].includes(room.roundPhase)) return;
  clearStatClashRoomTimers(room);
  clearStatClashPreviewTimers(room);
  room.lockedEndsAt = null;
  if (!room.currentPokemon || !room.currentStats) {
    finalizeStatClashMatch(room);
    return;
  }

  const resolved = resolveStatClashAssignedPicks(room);
  const leftEntry = resolved.find((e) => e.player.side === "left");
  const rightEntry = resolved.find((e) => e.player.side === "right");
  const baseLeft = Number(leftEntry && leftEntry.value) || 0;
  const baseRight = Number(rightEntry && rightEntry.value) || 0;
  const leftWins = baseLeft > baseRight;
  const rightWins = baseRight > baseLeft;
  let adjLeft = applyStatClashDoubleStatRoom(room, leftEntry && leftEntry.key, baseLeft);
  let adjRight = applyStatClashDoubleStatRoom(room, rightEntry && rightEntry.key, baseRight);
  if (room.jokersBySide && room.jokersBySide.left && room.jokersBySide.left.doubleArmed) {
    adjLeft = leftWins ? adjLeft * 2 : 0;
    room.jokersBySide.left.doubleArmed = false;
  }
  if (room.jokersBySide && room.jokersBySide.right && room.jokersBySide.right.doubleArmed) {
    adjRight = rightWins ? adjRight * 2 : 0;
    room.jokersBySide.right.doubleArmed = false;
  }
  if (leftWins) { room.streakBySide.left += 1; room.streakBySide.right = 0; room.roundsWonBySide.left += 1; }
  else if (rightWins) { room.streakBySide.right += 1; room.streakBySide.left = 0; room.roundsWonBySide.right += 1; }
  else { room.streakBySide.left = 0; room.streakBySide.right = 0; }
  const comboBonusBySide = { left: 0, right: 0 };
  if (room.houseRuleEnabled && (room.houseRuleShared || room.houseRule)?.id === "comboBonus") {
    if (room.streakBySide.left === 3) { adjLeft += 2; comboBonusBySide.left = 2; }
    if (room.streakBySide.right === 3) { adjRight += 2; comboBonusBySide.right = 2; }
  }
  // Bonus comeback aveugle : +3 pts si tu gagnes la manche en subissant blindRound5
  const comebackBonusBySide = { left: 0, right: 0 };
  if (room.houseRuleEnabled) {
    if (leftWins && Array.isArray(room.blindRound5OptionsBySide?.left) && room.blindRound5OptionsBySide.left.length) { adjLeft += 3; comebackBonusBySide.left = 3; }
    if (rightWins && Array.isArray(room.blindRound5OptionsBySide?.right) && room.blindRound5OptionsBySide.right.length) { adjRight += 3; comebackBonusBySide.right = 3; }
  }

  room.reveal = {};
  for (const entry of resolved) {
    if (!entry.key) continue;
    const adj = entry.player.side === "left" ? adjLeft : adjRight;
    const comboBonus = comboBonusBySide[entry.player.side] || 0;
    const comebackBonus = comebackBonusBySide[entry.player.side] || 0;
    if (!room.suddenDeath) room.usedStatKeysBySide[entry.player.side].push(entry.key);
    entry.player.score += adj;
    entry.player.history.push({
      round: room.round,
      statKey: entry.key,
      statLabel: STAT_CLASH_STAT_LABELS[entry.key] || entry.key,
      value: adj,
      pokemonName: room.currentPokemon.name,
      auto: entry.auto,
      comboBonus,
      comebackBonus,
    });
    room.reveal[entry.player.side] = {
      statKey: entry.key,
      statLabel: STAT_CLASH_STAT_LABELS[entry.key] || entry.key,
      value: adj,
      auto: entry.auto,
      comboBonus,
      comebackBonus,
    };
    entry.player.pendingPickKey = null;
    entry.player.pendingSubmittedAt = null;
  }
  if (room.jokersBySide && room.jokersBySide.left) { room.jokersBySide.left.previewKey = null; room.jokersBySide.left.previewExpiresAt = null; }
  if (room.jokersBySide && room.jokersBySide.right) { room.jokersBySide.right.previewKey = null; room.jokersBySide.right.previewExpiresAt = null; }

  room.roundPhase = "reveal";
  emitStatClashRoomState(room);

  if (room.suddenDeath && (leftWins || rightWins)) {
    room.nextRoundTimer = setTimeout(() => finalizeStatClashMatch(room), STAT_CLASH_REVEAL_MS);
    return;
  }
  room.nextRoundTimer = setTimeout(async () => {
    const leftDone = !room.suddenDeath && (room.usedStatKeysBySide.left || []).length >= STAT_CLASH_STAT_KEYS.length;
    const rightDone = !room.suddenDeath && (room.usedStatKeysBySide.right || []).length >= STAT_CLASH_STAT_KEYS.length;
    if (room.round >= room.totalRounds || leftDone || rightDone) {
      finalizeStatClashMatch(room);
      return;
    }
    room.round += 1;
    await startStatClashRound(room);
  }, STAT_CLASH_REVEAL_MS);
}

function joinPlayerToRoom(room, socket, nickname) {
  socket.join(room.code);
  socket.data.roomCode = room.code;
  room.players.push({
    id: socket.id,
    nickname,
    connected: true,
    attempts: 0,
    lastGuess: "",
    correct: false,
    guesses: [],
  });
}

function joinPlayerToStatClashRoom(room, socket, nickname, side) {
  socket.join(room.code);
  socket.data.statClashRoomCode = room.code;
  const assignedSide = side || STAT_CLASH_PLAYER_SEATS.find((seat) => !room.players.some((player) => player.side === seat)) || `seat${room.players.length + 1}`;
  room.players.push({
    id: socket.id,
    nickname,
    side: assignedSide,
    seatIndex: room.players.length,
    connected: true,
    score: 0,
    history: [],
    pendingPickKey: null,
    pendingSubmittedAt: null,
  });
}

function joinPlayerToDraftBattleRoom(room, socket, nickname, side) {
  socket.join(room.code);
  socket.data.draftBattleRoomCode = room.code;
  room.players.push({
    id: socket.id,
    nickname,
    side,
    connected: true,
  });
}

function startRoom(room) {
  clearRoomCleanup(room);
  const pool = POKEMON_LIST.filter((pokemon) => room.selectedGens.includes(Number(pokemon.gen) || Number(pokemon.generation)));
  const source = pool.length ? pool : POKEMON_LIST;
  room.secretPokemon = source[Math.floor(Math.random() * source.length)] || null;
  room.status = room.secretPokemon ? "live" : "waiting";
}

function resetRoomForNewRound(room) {
  clearRoomCleanup(room);
  room.secretPokemon = null;
  room.status = "waiting";
  room.winnerId = null;
  room.endedReason = null;
  for (const player of room.players) {
    player.attempts = 0;
    player.lastGuess = "";
    player.correct = false;
    player.guesses = [];
  }
}

function publicRoomState(room, viewerId = null) {
  const players = room.players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    connected: player.connected,
    attempts: player.attempts,
    lastGuess: player.lastGuess,
    correct: player.correct,
    isSelf: player.id === viewerId,
    isHost: player.id === room.hostId,
    guessHistory: player.id === viewerId ? player.guesses : [],
    guessNames: player.guesses.map((entry) => entry.name),
  }));
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    selectedGens: room.selectedGens,
    players,
    winnerId: room.winnerId,
    endedReason: room.endedReason,
    targetRevealed: room.status === "finished" ? serializePokemon(room.secretPokemon) : null,
  };
}

function publicStatClashRoomState(room, viewerId = null) {
  const connectedCount = getConnectedStatClashPlayers(room).length;
  return {
    code: room.code,
    status: room.status,
    roundPhase: room.roundPhase,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers || STAT_CLASH_MAX_PLAYERS,
    connectedCount,
    canStart: canStatClashRoomStart(room) && room.status !== "live" && room.status !== "starting",
    startedAt: room.startedAt || null,
    rollEndsAt: room.rollEndsAt || null,
    lockedEndsAt: room.lockedEndsAt || null,
    selectedGens: room.selectedGens,
    round: room.round,
    totalRounds: room.totalRounds,
    matchWinsBySide: {
      left: Number(room.matchWinsBySide?.left) || 0,
      right: Number(room.matchWinsBySide?.right) || 0,
    },
    sessionRecord: {
      score: Number(room.sessionRecord?.score) || STAT_CLASH_SESSION_RECORD_DEFAULT.score,
      winner: room.sessionRecord?.winner || STAT_CLASH_SESSION_RECORD_DEFAULT.winner,
      loser: room.sessionRecord?.loser || STAT_CLASH_SESSION_RECORD_DEFAULT.loser,
    },
    usedStatKeysBySide: {
      left: (room.usedStatKeysBySide?.left || []).slice(),
      right: (room.usedStatKeysBySide?.right || []).slice(),
    },
    deadlineAt: room.deadlineAt,
    winnerId: room.winnerId,
    endedReason: room.endedReason,
    currentPokemon: serializePokemon(room.currentPokemon),
    reveal: room.reveal,
    revealStats: room.roundPhase === "reveal" || room.status === "finished" ? room.currentStats : null,
    format: room.format || "standard",
    houseRuleEnabled: room.houseRuleEnabled !== false,
    houseRule: room.houseRule || null,
    houseRuleBySide: {
      left: room.houseRuleBySide?.left || null,
      right: room.houseRuleBySide?.right || null,
    },
    houseRuleShared: room.houseRuleShared || null,
    houseRuleSharedEnabled: Boolean(room.houseRuleSharedEnabled),
    pendingImposedRuleBySide: {
      left: room.pendingImposedRuleBySide?.left || null,
      right: room.pendingImposedRuleBySide?.right || null,
    },
    doubleStatKey: room.doubleStatKey || null,
    mirrorStatKey: room.mirrorStatKey || null,
    blindRound5OptionsBySide: {
      left: Array.isArray(room.blindRound5OptionsBySide?.left) ? room.blindRound5OptionsBySide.left.slice() : null,
      right: Array.isArray(room.blindRound5OptionsBySide?.right) ? room.blindRound5OptionsBySide.right.slice() : null,
    },
    houseRuleTargetSide: room.houseRuleTargetSide || null,
    suddenDeath: Boolean(room.suddenDeath),
    streakBySide: { left: Number(room.streakBySide && room.streakBySide.left) || 0, right: Number(room.streakBySide && room.streakBySide.right) || 0 },
    roundsWonBySide: { left: Number(room.roundsWonBySide && room.roundsWonBySide.left) || 0, right: Number(room.roundsWonBySide && room.roundsWonBySide.right) || 0 },
    jokersBySide: (function () {
      const viewerSide = (room.players.find((p) => p.id === viewerId) || {}).side || null;
      const sj = (side) => {
        const j = (room.jokersBySide && room.jokersBySide[side]) || {};
        return {
          reroll: Number(j.reroll) || 0,
          preview: Number(j.preview) || 0,
          double: Number(j.double) || 0,
          doubleArmed: Boolean(j.doubleArmed),
          previewKey: viewerSide === side ? (j.previewKey || null) : null,
          previewExpiresAt: viewerSide === side ? (j.previewExpiresAt || null) : null,
        };
      };
      return { left: sj("left"), right: sj("right") };
    })(),
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      side: player.side,
      seatIndex: Number(player.seatIndex) || 0,
      connected: player.connected,
      score: player.score,
      history: player.history,
      isSelf: player.id === viewerId,
      isHost: player.id === room.hostId,
      pendingImposedRuleId: room.pendingImposedRuleBySide?.[player.side] || null,
      hasSelectedImposedRule: Boolean(room.pendingImposedRuleBySide?.[player.side]),
      hasLockedPick: Boolean(player.pendingPickKey),
      pendingPickKey: player.id === viewerId && ["picking", "locked"].includes(room.roundPhase) ? player.pendingPickKey : null,
    })),
  };
}

function emitRoomState(room) {
  for (const player of room.players) {
    io.to(player.id).emit("duel:room-state", publicRoomState(room, player.id));
  }
}

function emitStatClashRoomState(room) {
  console.log("[stat-clash][room-state] emit", { code: maskCode(room.code), status: room.status, roundPhase: room.roundPhase });
  for (const player of room.players) {
    io.to(player.id).emit("stat-clash:room-state", publicStatClashRoomState(room, player.id));
  }
}

function emitStatClashFinished(room) {
  for (const player of room.players) {
    io.to(player.id).emit("stat-clash:finished", publicStatClashRoomState(room, player.id));
  }
}

function emitRoomFinished(room) {
  for (const player of room.players) {
    io.to(player.id).emit("duel:finished", publicRoomState(room, player.id));
  }
}

function findRoomBySocket(socketId) {
  const roomCode = io.sockets.sockets.get(socketId)?.data?.roomCode;
  if (roomCode && rooms.has(roomCode)) return rooms.get(roomCode);
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.id === socketId)) return room;
  }
  return null;
}

function findStatClashRoomBySocket(socketId) {
  const roomCode = io.sockets.sockets.get(socketId)?.data?.statClashRoomCode;
  if (roomCode && statClashRooms.has(roomCode)) return statClashRooms.get(roomCode);
  for (const room of statClashRooms.values()) {
    if (room.players.some((player) => player.id === socketId)) return room;
  }
  return null;
}

function handleDisconnect(socketId, voluntary) {
  const room = findRoomBySocket(socketId);
  if (!room) return;

  const player = room.players.find((entry) => entry.id === socketId);
  if (!player) return;

  player.connected = false;

  if (room.status === "waiting") {
    io.to(room.code).emit("duel:room-closed", {
      reason: voluntary ? "Le créateur a quitté la room." : `${player.nickname} s'est déconnecté.`
    });
    rooms.delete(room.code);
    return;
  }

  if (room.status === "live") {
    const opponent = room.players.find((entry) => entry.id !== socketId && entry.connected);
    room.status = "finished";
    room.winnerId = opponent?.id || null;
    room.endedReason = "disconnect";
    emitRoomState(room);
    emitRoomFinished(room);
    scheduleRoomCleanup(room);
    return;
  }

  if (room.status === "finished") {
    scheduleRoomCleanup(room);
  }
}

function handleStatClashDisconnect(socketId, voluntary) {
  const room = findStatClashRoomBySocket(socketId);
  if (!room) return;

  const socket = io.sockets.sockets.get(socketId);
  if (socket?.data) socket.data.statClashRoomCode = null;
  const player = room.players.find((entry) => entry.id === socketId);
  if (!player) return;
  player.connected = false;
  clearStatClashRoomTimers(room);

  if (room.status === "lobby" || room.status === "starting") {
    if (room.hostId === socketId) {
      io.to(room.code).emit("stat-clash:room-closed", {
        reason: voluntary ? "L'hôte a fermé la room." : `${player.nickname} s'est déconnecté.`,
      });
      statClashRooms.delete(room.code);
      return;
    }
    room.players = room.players.filter((entry) => entry.id !== socketId);
    room.status = "lobby";
    room.roundPhase = "waiting";
    room.startedAt = null;
    emitStatClashRoomState(room);
    return;
  }

  if (room.status === "live") {
    const opponent = room.players.find((entry) => entry.id !== socketId && entry.connected);
    room.status = "finished";
    room.roundPhase = "finished";
    room.winnerId = opponent?.id || null;
    room.endedReason = "disconnect";
    emitStatClashRoomState(room);
    emitStatClashFinished(room);
    scheduleStatClashRoomCleanup(room);
    return;
  }

  if (room.status === "finished") {
    scheduleStatClashRoomCleanup(room);
  }
}

function findDraftBattleRoomBySocket(socketId) {
  const roomCode = io.sockets.sockets.get(socketId)?.data?.draftBattleRoomCode;
  if (roomCode && draftBattleRooms.has(roomCode)) return draftBattleRooms.get(roomCode);
  for (const room of draftBattleRooms.values()) {
    if (room.players.some((player) => player.id === socketId)) return room;
  }
  return null;
}

function publicDraftBattleRoomState(room, viewerId = null) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      side: player.side,
      connected: player.connected,
      isSelf: player.id === viewerId,
      isHost: player.id === room.hostId,
    })),
    pendingTurn: room.pendingTurn,
    pendingReplacement: room.pendingReplacement,
    resolvingTurn: room.resolvingTurn,
    resolvingReplacement: room.resolvingReplacement,
    version: room.version,
    battleState: room.battleState,
  };
}

function emitDraftBattleRoomState(room) {
  for (const player of room.players) {
    io.to(player.id).emit("draft-battle:room-state", publicDraftBattleRoomState(room, player.id));
  }
}

function emitDraftBattleState(room) {
  io.to(room.code).emit("draft-battle:state", {
    code: room.code,
    battleState: room.battleState,
    status: room.status,
  });
}

function handleDraftBattleDisconnect(socketId, voluntary, options = {}) {
  const room = findDraftBattleRoomBySocket(socketId);
  if (!room) return;
  const socket = io.sockets.sockets.get(socketId);
  if (socket?.data) socket.data.draftBattleRoomCode = null;
  const player = room.players.find((entry) => entry.id === socketId);
  if (!player) return;
  player.connected = false;

  if (!options.silent) {
    io.to(room.code).emit("draft-battle:room-closed", {
      reason: voluntary ? `${player.nickname} a quitté le combat.` : `${player.nickname} s'est déconnecté.`,
    });
  }
  draftBattleRooms.delete(room.code);
}

function findDraftScoreRoomBySocket(socketId) {
  const roomCode = io.sockets.sockets.get(socketId)?.data?.draftScoreRoomCode;
  if (roomCode && draftScoreRooms.has(roomCode)) return draftScoreRooms.get(roomCode);
  for (const room of draftScoreRooms.values()) {
    if (room.players.some((player) => player.id === socketId)) return room;
  }
  return null;
}

function sanitizeDraftScoreResult(payload = {}) {
  const average = Math.max(0, Math.min(900, Math.round(Number(payload.average) || 0)));
  const total = Math.max(0, Math.min(5400, Math.round(Number(payload.total) || 0)));
  const selectedGen = Number.isInteger(Number(payload.selectedGen)) ? Number(payload.selectedGen) : null;
  const team = Array.isArray(payload.team)
    ? payload.team.slice(0, 6).map((entry) => ({
      id: Math.max(0, Math.round(Number(entry?.id) || 0)),
      name: sanitizeNickname(entry?.name || "").slice(0, 32),
      bst: Math.max(0, Math.min(900, Math.round(Number(entry?.bst) || 0))),
    })).filter((entry) => entry.id && entry.name)
    : [];
  if (team.length !== 6 || average <= 0 || total <= 0) return null;
  return {
    average,
    total,
    selectedGen,
    team,
    label: sanitizeNickname(payload.label || "").slice(0, 32),
    submittedAt: Date.now(),
  };
}

function publicDraftScoreRoomState(room, viewerId = null) {
  return {
    code: room.code,
    status: room.status,
    maxPlayers: MAX_ROOM_SIZE,
    connectedCount: room.players.filter((player) => player.connected).length,
    winnerSide: room.winnerSide || null,
    duel: room.duel ? {
      gen: room.duel.gen,
      currentWave: (room.duel.currentWave || []).map((id) => {
        const p = POKEMON_LIST.find((entry) => Number(entry.id) === Number(id));
        return p ? { id: Number(p.id), name: p.name, type1: p.type1 || null, type2: p.type2 || null } : null;
      }).filter(Boolean),
      waveIndex: room.duel.waveIndex || 0,
      pendingSides: ["left", "right"].filter((side) => room.duel.pendingPicks?.[side]),
      teams: {
        left: (room.duel.teams?.left || []).map((e) => ({ id: e.id, name: e.name, bst: Number(e.bst) || 0 })),
        right: (room.duel.teams?.right || []).map((e) => ({ id: e.id, name: e.name, bst: Number(e.bst) || 0 })),
      },
      picksRemaining: {
        left: Math.max(0, Number(room.duel.picksRemaining?.left) || 0),
        right: Math.max(0, Number(room.duel.picksRemaining?.right) || 0),
      },
      rerollsLeft: Math.max(0, Number(room.duel.rerollsLeft ?? 0)),
      lastEvent: room.duel.lastEvent || null,
    } : null,
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      side: player.side,
      connected: player.connected,
      isSelf: player.id === viewerId,
      isHost: player.id === room.hostId,
      hasSubmitted: Boolean(player.result),
      result: player.result || null,
      progress: player.progress || null,
    })),
  };
}

function generateDraftDuelPool(gen) {
  const list = Array.isArray(POKEMON_LIST) ? POKEMON_LIST.filter((p) => Number(p.id) < 10000) : [];
  const filtered = gen ? list.filter((p) => Number(p.gen || p.generation) === Number(gen)) : list.slice();
  return filtered.map((p) => ({ id: Number(p.id), name: String(p.name || ""), type1: p.type1, type2: p.type2 }));
}

function generateDraftDuelNextWave(room) {
  const available = (room.duel.pool || []).filter((p) => !room.duel.draftedIds.has(p.id));
  if (available.length < 1) return [];
  const shuffled = available.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(6, shuffled.length)).map((p) => p.id);
}

function buildDuelPokemonEntry(pokemonId) {
  const pokemon = POKEMON_LIST.find((p) => Number(p.id) === Number(pokemonId));
  if (!pokemon) return null;
  return { id: Number(pokemon.id), name: pokemon.name, type1: pokemon.type1 || null, type2: pokemon.type2 || null };
}

function emitDraftScoreRoomState(room) {
  for (const player of room.players) {
    if (!player.connected) continue;
    io.to(player.id).emit("draft-score:room-state", publicDraftScoreRoomState(room, player.id));
  }
}

function finalizeDraftScoreRoom(room) {
  const left = room.players.find((player) => player.side === "left");
  const right = room.players.find((player) => player.side === "right");
  if (left?.result && right?.result) {
    if (left.result.average > right.result.average) room.winnerSide = "left";
    else if (right.result.average > left.result.average) room.winnerSide = "right";
    else if (left.result.total > right.result.total) room.winnerSide = "left";
    else if (right.result.total > left.result.total) room.winnerSide = "right";
    else room.winnerSide = "tie";
  }
  room.status = "finished";
  emitDraftScoreRoomState(room);
}

function handleDraftScoreDisconnect(socketId, voluntary) {
  const room = findDraftScoreRoomBySocket(socketId);
  if (!room) return;
  const socket = io.sockets.sockets.get(socketId);
  if (socket?.data) socket.data.draftScoreRoomCode = null;
  const player = room.players.find((entry) => entry.id === socketId);
  if (!player) return;
  player.connected = false;

  if (room.status !== "finished") {
    io.to(room.code).emit("draft-score:room-closed", {
      reason: voluntary ? `${player.nickname} a quitté le Score Attack.` : `${player.nickname} s'est déconnecté.`,
    });
    draftScoreRooms.delete(room.code);
    return;
  }

  if (room.players.every((entry) => !entry.connected)) {
    draftScoreRooms.delete(room.code);
  }
}

function scheduleRoomCleanup(room) {
  clearRoomCleanup(room);
  room.cleanupTimer = setTimeout(() => {
    rooms.delete(room.code);
  }, 60_000);
}

function clearRoomCleanup(room) {
  if (!room?.cleanupTimer) return;
  clearTimeout(room.cleanupTimer);
  room.cleanupTimer = null;
}

function scheduleStatClashRoomCleanup(room) {
  clearStatClashCleanup(room);
  clearStatClashRoomTimers(room);
  room.cleanupTimer = setTimeout(() => {
    statClashRooms.delete(room.code);
  }, 60_000);
}

function clearStatClashCleanup(room) {
  if (!room?.cleanupTimer) return;
  clearTimeout(room.cleanupTimer);
  room.cleanupTimer = null;
}

function clearStatClashRoomTimers(room) {
  ["startTimer", "rollTimer", "resolveTimer", "nextRoundTimer"].forEach((key) => {
    if (!room?.[key]) return;
    clearTimeout(room[key]);
    room[key] = null;
  });
}

function serializePokemon(pokemon) {
  if (!pokemon) return null;
  return {
    id: pokemon.id,
    name: pokemon.name,
    sprite: pokemon.sprite,
    type1: pokemon.type1,
    type2: pokemon.type2,
    gen: pokemon.gen || pokemon.generation,
  };
}

function resolveRoomPokemonGuess(room, guess) {
  const pokemon = POKEMON_BY_NORMALIZED_NAME.get(normalizeName(guess));
  if (!pokemon) return null;
  const gen = Number(pokemon.gen || pokemon.generation);
  if (!room.selectedGens.includes(gen)) return null;
  if (pokemon.isAltForm || pokemon.id >= 20000) return null;
  return pokemon;
}

function buildGuessFeedback(guess, secret) {
  return {
    id: guess.id,
    spriteId: guess.spriteId || guess.id,
    name: guess.name,
    sprite: guess.sprite,
    gen: guess.gen || guess.generation,
    isAltForm: Boolean(guess.isAltForm || guess.id >= 20000),
    type1: guess.type1,
    type2: guess.type2 || null,
    habitat: guess.habitat || "Inconnu",
    color: guess.color || "Inconnu",
    stage: guess.stage,
    height: guess.height,
    weight: guess.weight,
    feedback: compareGuessToSecret(guess, secret),
    heightArrow: arrowFor(guess.height, secret.height),
    weightArrow: arrowFor(guess.weight, secret.weight),
  };
}

function compareGuessToSecret(guess, secret) {
  const type1State =
    guess.type1 === secret.type1
      ? "ok"
      : guess.type1 && guess.type1 === secret.type2
      ? "close"
      : "wrong";

  const type2State =
    guess.type2 === secret.type2
      ? "ok"
      : guess.type2 && guess.type2 === secret.type1
      ? "close"
      : "wrong";

  return {
    generation: guess.gen === secret.gen ? "ok" : "wrong",
    altForm: Boolean(guess.isAltForm) === Boolean(secret.isAltForm) ? "ok" : "wrong",
    type1: type1State,
    type2: type2State,
    habitat: guess.habitat === secret.habitat ? "ok" : "wrong",
    color: compareColors(guess.color, secret.color),
    stage: guess.stage === secret.stage ? "ok" : "wrong",
    height: cmpNum(guess.height, secret.height, 0.3),
    weight: cmpNum(guess.weight, secret.weight, 15),
  };
}

function cmpNum(guessValue, secretValue, tolerance) {
  if (guessValue === secretValue) return "ok";
  if (Math.abs(guessValue - secretValue) <= tolerance) return "close";
  return "wrong";
}

function compareColors(guessColor, secretColor) {
  const guessTokens = colorTokens(guessColor);
  const secretTokens = colorTokens(secretColor);
  const guessSet = new Set(guessTokens);
  const secretSet = new Set(secretTokens);
  let overlap = 0;
  for (const token of guessSet) {
    if (secretSet.has(token)) overlap += 1;
  }
  if (overlap === 0) return "wrong";
  if (overlap === guessSet.size && overlap === secretSet.size) return "ok";
  return "close";
}

function colorTokens(value) {
  return String(value || "")
    .split(/[\/,\-]+/)
    .map((entry) => normalizeName(entry))
    .filter(Boolean);
}

function arrowFor(guessValue, secretValue) {
  if (guessValue === secretValue) return "";
  return guessValue < secretValue ? "↑" : "↓";
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}
