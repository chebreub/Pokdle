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
const POKEMON_LIST = loadPokemonList();
const POKEMON_BY_NORMALIZED_NAME = new Map(POKEMON_LIST.map((pokemon) => [normalizeName(pokemon.name), pokemon]));
const MAX_ROOM_SIZE = 2;
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
  { id: "atkRound3", label: "Manche 3 : Attaque obligatoire", desc: "A la 3e manche, seul le bouton Attaque est jouable." },
  { id: "noHpFinal", label: "Manche finale : pas de PV", desc: "Le bouton PV est verrouille a la derniere manche." },
  { id: "weakStart", label: "Manche 1 : stat la plus faible imposee", desc: "A la M1, seule la stat la plus basse du Pokemon est selectionnable." },
  { id: "pressureLate", label: "Pression : timer 5s aux manches 4-5-6", desc: "Le timer est divise par deux dans la seconde moitie de la partie." },
  { id: "doubleStat", label: "Stat star vaut double", desc: "Une stat tiree au sort en debut de partie vaut deux fois ses points quand elle est jouee." },
  { id: "blindRound5", label: "Manche 5 : choix aleatoire impose", desc: "Les deux camps recoivent un pick aleatoire en M5, aucune action humaine." },
  { id: "mirrorRound4", label: "Manche 4 : stat imposee identique", desc: "A la M4, une stat est tiree au sort et imposee des deux cotes." },
  { id: "comboBonus", label: "Combo : 3 victoires d'affilee = +2 pts", desc: "Un bonus de 2 pts est applique chaque fois qu'un camp atteint un streak de 3." },
];
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
  if (!room || !room.houseRule || !room.houseRuleEnabled) return null;
  const id = room.houseRule.id;
  const round = room.round;
  const total = room.totalRounds || STAT_CLASH_TOTAL_ROUNDS;
  const target = room.houseRuleTargetSide || null;
  const targetOnly = target && side && side !== target;
  if (id === "atkRound3" && round === 3) return targetOnly ? null : ["attack"];
  if (id === "noSpeedEarly" && round <= Math.min(3, total - 1)) return STAT_CLASH_STAT_KEYS.filter((k) => k !== "speed");
  if (id === "noHpFinal" && round === total) return STAT_CLASH_STAT_KEYS.filter((k) => k !== "hp");
  if (id === "weakStart" && round === 1) {
    if (targetOnly) return null;
    const low = getStatClashLowestStatKey(room.currentStats);
    return low ? [low] : null;
  }
  if (id === "mirrorRound4" && round === 4 && room.mirrorStatKey) return [room.mirrorStatKey];
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
  return pool;
}
function getStatClashHouseRuleTimerMsRoom(room) {
  const base = STAT_CLASH_PICK_MS;
  if (!room || !room.houseRule || !room.houseRuleEnabled) return base;
  if (room.houseRule.id === "pressureLate" && room.round >= Math.ceil((room.totalRounds || STAT_CLASH_TOTAL_ROUNDS) / 2) + 1) return STAT_CLASH_PRESSURE_PICK_MS;
  return base;
}
function applyStatClashDoubleStatRoom(room, statKey, value) {
  let total = Number(value) || 0;
  if (room && room.houseRule && room.houseRule.id === "doubleStat" && room.doubleStatKey === statKey && room.houseRuleEnabled) total *= 2;
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
        doubleStatKey: null,
        mirrorStatKey: null,
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
        if (room.houseRuleEnabled && room.houseRule && room.houseRule.id === "mirrorRound4" && room.round === 4) {
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
});

server.listen(PORT, () => {
  console.log(`Pokédle multiplayer server running on port ${PORT}`);
  if (!ALLOWED_ORIGINS.length) {
    console.warn("[security] ALLOWED_ORIGINS not set — CORS is open to all origins. Set ALLOWED_ORIGINS in production.");
  }
});

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
  room.doubleStatKey = null;
  room.mirrorStatKey = null;
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
  return getConnectedStatClashPlayers(room).length >= (room.maxPlayers || STAT_CLASH_MAX_PLAYERS);
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
    room.houseRule = pickRandomStatClashHouseRule();
    room.houseRuleTargetSide = Math.random() < 0.5 ? "left" : "right";
    if (room.houseRule.id === "doubleStat") {
      room.doubleStatKey = STAT_CLASH_STAT_KEYS[Math.floor(Math.random() * STAT_CLASH_STAT_KEYS.length)];
    }
  } else {
    room.houseRule = null;
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
  if (room.houseRuleEnabled && room.houseRule && room.houseRule.id === "mirrorRound4" && room.round === 4) {
    const cand = STAT_CLASH_STAT_KEYS.filter((k) => !room.usedStatKeysBySide.left.includes(k) && !room.usedStatKeysBySide.right.includes(k));
    room.mirrorStatKey = cand[Math.floor(Math.random() * cand.length)] || STAT_CLASH_STAT_KEYS[0];
  } else {
    room.mirrorStatKey = null;
  }
  emitStatClashRoomState(room);
  room.rollTimer = setTimeout(() => {
    if (room.houseRuleEnabled && room.houseRule && room.houseRule.id === "blindRound5" && room.round === 5) {
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
  if (room.houseRuleEnabled && room.houseRule && room.houseRule.id === "comboBonus") {
    if (room.streakBySide.left === 3) adjLeft += 2;
    if (room.streakBySide.right === 3) adjRight += 2;
  }

  room.reveal = {};
  for (const entry of resolved) {
    if (!entry.key) continue;
    const adj = entry.player.side === "left" ? adjLeft : adjRight;
    if (!room.suddenDeath) room.usedStatKeysBySide[entry.player.side].push(entry.key);
    entry.player.score += adj;
    entry.player.history.push({
      round: room.round,
      statKey: entry.key,
      statLabel: STAT_CLASH_STAT_LABELS[entry.key] || entry.key,
      value: adj,
      pokemonName: room.currentPokemon.name,
      auto: entry.auto,
    });
    room.reveal[entry.player.side] = {
      statKey: entry.key,
      statLabel: STAT_CLASH_STAT_LABELS[entry.key] || entry.key,
      value: adj,
      auto: entry.auto,
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
    doubleStatKey: room.doubleStatKey || null,
    mirrorStatKey: room.mirrorStatKey || null,
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
