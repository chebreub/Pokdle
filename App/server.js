const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = new Map();
const draftBattleRooms = new Map();
const NAME_OVERRIDES = {
  "??lectrode": "Électrode",
  "??lekid": "Élekid",
  "??crémeuh": "Écrémeuh",
  "??lecsprint": "Élecsprint",
  "??crapince": "Écrapince",
  "??oko": "Éoko",
  "??tourmi": "Étourmi",
  "??tourvol": "Étourvol",
  "??touraptor": "Étouraptor",
  "??cayon": "Écayon",
  "??lekable": "Élekable",
  "??caéd": "Écaïd",
  "??kaéser": "Ékaïser",
  "??thernatos": "Éthernatos",
};
const POKEMON_LIST = loadPokemonList();
const POKEMON_BY_NORMALIZED_NAME = new Map(POKEMON_LIST.map((pokemon) => [normalizeName(pokemon.name), pokemon]));
const MAX_ROOM_SIZE = 2;

app.use(express.static(__dirname));

app.get("/api/multiplayer/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, pokemon: POKEMON_LIST.length });
});

io.on("connection", (socket) => {
  socket.on("duel:create-room", (payload = {}, ack) => {
    try {
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
    const room = findRoomBySocket(socket.id);
    if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
    if (room.status !== "live" || !room.secretPokemon) return respond(ack, { ok: false, error: "La manche n'est pas en cours." });

    const player = room.players.find((entry) => entry.id === socket.id);
    if (!player) return respond(ack, { ok: false, error: "Joueur introuvable." });

    const guess = String(payload.guess || "").trim();
    if (!guess) return respond(ack, { ok: false, error: "Entre un nom de Pokémon." });
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
  });

  socket.on("duel:leave-room", () => {
    handleDisconnect(socket.id, true);
  });

  socket.on("duel:update-gens", (payload = {}, ack) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return respond(ack, { ok: false, error: "Aucune room active." });
    if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul le créateur peut modifier les générations." });
    if (room.status === "live") return respond(ack, { ok: false, error: "Impossible de changer les générations pendant une manche." });

    room.selectedGens = normalizeSelectedGens(payload.selectedGens);
    emitRoomState(room);
    respond(ack, { ok: true, room: publicRoomState(room, socket.id) });
  });

  socket.on("duel:restart-round", (payload = {}, ack) => {
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
  });

  socket.on("disconnect", () => {
    handleDisconnect(socket.id, false);
    handleDraftBattleDisconnect(socket.id, false);
  });

  socket.on("draft-battle:create-room", (payload = {}, ack) => {
    try {
      handleDraftBattleDisconnect(socket.id, true);
      const nickname = sanitizeNickname(payload.nickname) || "Joueur 1";
      const battleState = payload.battleState && typeof payload.battleState === "object" ? payload.battleState : null;
      if (!battleState) return respond(ack, { ok: false, error: "État de combat invalide." });

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
    handleDraftBattleDisconnect(socket.id, true);
  });

  socket.on("draft-battle:submit-action", (payload = {}, ack) => {
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
  });

  socket.on("draft-battle:submit-replacement", (payload = {}, ack) => {
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

    room.pendingReplacement = {
      side: player.side,
      teamIndex: Number(payload.teamIndex),
    };
    room.resolvingReplacement = room.pendingReplacement;
    emitDraftBattleRoomState(room);
    io.to(room.hostId).emit("draft-battle:resolve-replacement", {
      code: room.code,
      replacement: room.pendingReplacement,
    });
    respond(ack, { ok: true });
  });

  socket.on("draft-battle:commit-state", (payload = {}, ack) => {
    const room = findDraftBattleRoomBySocket(socket.id);
    if (!room) return respond(ack, { ok: false, error: "Aucune room Draft Combat active." });
    if (room.hostId !== socket.id) return respond(ack, { ok: false, error: "Seul l'hôte peut valider l'état." });
    if (!payload.battleState || typeof payload.battleState !== "object") {
      return respond(ack, { ok: false, error: "État de combat invalide." });
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
  });
});

server.listen(PORT, () => {
  console.log(`Pokédle multiplayer server running on port ${PORT}`);
});

function respond(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function loadPokemonList() {
  const filePath = path.join(__dirname, "pokemon.js");
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/const POKEMON_LIST =\s*(\[[\s\S]*\]);/);
  if (!match) throw new Error("POKEMON_LIST introuvable dans pokemon.js");
  return JSON.parse(match[1]).map((pokemon) => {
    if (pokemon && NAME_OVERRIDES[pokemon.name]) pokemon.name = NAME_OVERRIDES[pokemon.name];
    return pokemon;
  });
}

function sanitizeNickname(value) {
  const text = String(value || "").trim().slice(0, 24);
  return text.replace(/[<>]/g, "");
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

function generateDraftBattleRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = `DB${Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
  } while (draftBattleRooms.has(code));
  return code;
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

function emitRoomState(room) {
  for (const player of room.players) {
    io.to(player.id).emit("duel:room-state", publicRoomState(room, player.id));
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
