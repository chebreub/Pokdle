

window.createDraftScoreAttackRoom = createDraftScoreAttackRoom;
window.joinDraftScoreAttackRoom = joinDraftScoreAttackRoom;
window.leaveDraftScoreAttackRoom = leaveDraftScoreAttackRoom;


async function getDraftPokemonPowerData(pokemon) {
  const key = getDraftPowerCacheKey(pokemon);
  if (DRAFT_POWER_CACHE.has(key)) return DRAFT_POWER_CACHE.get(key);
  const stats = await fetchBattleStats(pokemon);
  const metrics = buildDraftPowerMetrics(pokemon, stats);
  DRAFT_POWER_CACHE.set(key, metrics);
  return metrics;
}

function getDraftPoolForGeneration(gen) {
  const cfg = DRAFT_GEN_OPTIONS.find((g) => g.gen === gen);
  if (!cfg) return [];

  return getPokemonUiList({ gens: [cfg.gen] }).filter(Boolean);
}


function getDraftWeightedChance(power) {
  // Draft weighting is intentionally centered on medium-power Pokemon:
  // - weak picks can still appear, but should not flood every wave
  // - medium picks are the most common draft backbone
  // - very strong picks stay possible, but much rarer
  const normalized = clampDraftValue(Number(power) || 0, 35, 110);

  if (normalized <= 48) {
    return 0.48;
  }
  if (normalized <= 58) {
    return 0.72;
  }
  if (normalized <= 72) {
    return 1;
  }
  if (normalized <= 82) {
    return 0.7;
  }
  if (normalized <= 92) {
    return 0.36;
  }
  return 0.15;
}

function pickWeightedDraftPokemon(pool, excludeDexIds = new Set(), options = {}) {
  const heavyThreatCount = Number(options.heavyThreatCount) || 0;
  const source = pool
    .filter((pokemon) => !excludeDexIds.has(getDraftPoolEntryKey(pokemon)))
    .map((pokemon) => {
      const power = getDraftCachedPokemonPowerData(pokemon).power;
      let weight = getDraftWeightedChance(power);

      // Once a wave already contains a very strong threat, heavily reduce the
      // chance of drawing another one. This keeps "wow" picks possible while
      // avoiding waves dominated by multiple huge threats too often.
      if (power >= 88 && heavyThreatCount >= 1) {
        weight *= 0.18;
      } else if (power >= 82 && heavyThreatCount >= 1) {
        weight *= 0.45;
      }

      return { pokemon, weight };
    })
    .filter((entry) => entry.weight > 0);

  if (!source.length) return null;

  const totalWeight = source.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of source) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.pokemon;
    }
  }
  return source[source.length - 1]?.pokemon || null;
}

function buildDraftWeightedWave(pool, count, excludeDexIds = new Set()) {
  const picks = [];
  const usedDexIds = new Set(excludeDexIds);
  let heavyThreatCount = 0;

  while (picks.length < count) {
    const picked = pickWeightedDraftPokemon(pool, usedDexIds, { heavyThreatCount });
    if (!picked) break;
    usedDexIds.add(getDraftPoolEntryKey(picked));
    picks.push(picked);
    if (getDraftCachedPokemonPowerData(picked).power >= 82) {
      heavyThreatCount += 1;
    }
  }

  return picks;
}

function createDraftOptionEntry(pokemon, locked = false, shiny = Math.random() < DRAFT_SHINY_CHANCE) {
  return {
    pokemon,
    shiny,
    locked,
  };
}

function warmDraftPokemonMetrics(pokemonList) {
  const snapshot = draftArenaState;
  Promise.all((pokemonList || []).map((pokemon) => getDraftPokemonPowerData(pokemon)))
    .then(() => {
      const activeDraftScreen = document.getElementById(snapshot?.mode === "scoreAttack" ? "screen-draft-score-attack" : "screen-draft-arena");
      if (snapshot && snapshot === draftArenaState && activeDraftScreen && !activeDraftScreen.classList.contains("hidden")) {
        renderDraftArena();
      }
    })
    .catch(() => {
      // noop
    });
}

function fillDraftArenaOptions() {
  if (!draftArenaState || draftArenaState.phase !== "draft") return;
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);
  draftArenaState.options.forEach((option) => {
    if (option?.pokemon) excludeDexIds.add(getDraftPoolEntryKey(option.pokemon));
  });

  const missingCount = Math.max(0, DRAFT_PICK_COUNT - draftArenaState.options.length);
  const weightedWave = buildDraftWeightedWave(pool, missingCount, excludeDexIds);
  for (const pokemon of weightedWave) {
    draftArenaState.options.push(createDraftOptionEntry(pokemon));
  }

  warmDraftPokemonMetrics([
    ...draftArenaState.options.map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
}

function replaceDraftArenaOption(optionIndex) {
  if (!draftArenaState || draftArenaState.phase !== "draft") return;
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);

  draftArenaState.options = draftArenaState.options.map((option, index) => {
    if (!option?.pokemon) return option;
    if (index === optionIndex) {
      excludeDexIds.add(getDraftPoolEntryKey(option.pokemon));
      return createDraftOptionEntry(option.pokemon, true, option.shiny);
    }
    return option;
  });

  const unlockedIndexes = [];
  for (let index = 0; index < draftArenaState.options.length; index += 1) {
    const option = draftArenaState.options[index];
    if (!option || option.locked) continue;
    unlockedIndexes.push(index);
  }

  const replacements = buildDraftWeightedWave(pool, unlockedIndexes.length, excludeDexIds);
  unlockedIndexes.forEach((index, replacementIndex) => {
    const replacement = replacements[replacementIndex];
    if (!replacement) return;
    draftArenaState.options[index] = createDraftOptionEntry(replacement);
  });
  warmDraftPokemonMetrics([
    ...draftArenaState.options.filter(Boolean).map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
}

function rerollDraftScoreAttackWave() {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || draftArenaState.phase !== "draft") return;
  // Mode duel synchronisé : router vers le serveur (host only)
  if (draftArenaState.duelMode && draftArenaState.scoreAttackRoom) {
    const socket = ensureMultiplayerSocket();
    if (!socket?.connected) return;
    socket.emit("draft-score:reroll-duel-wave", {}, (response = {}) => {
      if (!response.ok && draftArenaState) {
        draftArenaState.scoreAttackRoomError = response.error || "Reroll refusé.";
        renderDraftArena();
      }
    });
    return;
  }
  if (draftArenaState.scoreAttackRerollsLeft <= 0) {
    draftArenaState.message = "Plus de relance disponible pour cette tentative Score Attack.";
    return renderDraftArena();
  }
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);
  draftArenaState.options = buildDraftWeightedWave(pool, DRAFT_PICK_COUNT, excludeDexIds).map((pokemon) => createDraftOptionEntry(pokemon));
  draftArenaState.scoreAttackRerollsLeft -= 1;
  draftArenaState.message = `Relance utilisée. Encore ${draftArenaState.scoreAttackRerollsLeft} reroll${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""}.`;
  emitDraftScoreAttackProgress();
  warmDraftPokemonMetrics([
    ...draftArenaState.options.map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
  renderDraftArena();
}

function rerollDraftScoreAttackOption(pokemonId) {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || draftArenaState.phase !== "draft") return;
  if (draftArenaState.scoreAttackRerollsLeft <= 0) {
    draftArenaState.message = "Plus de relance disponible. Lance le mode classique pour reset.";
    return renderDraftArena();
  }
  const optionIndex = draftArenaState.options.findIndex((option) => option.pokemon.id === pokemonId);
  if (optionIndex < 0) return;
  const pool = getDraftPoolForGeneration(draftArenaState.selectedGen);
  const excludeDexIds = new Set(draftArenaState.selectedDexIds);
  for (const option of draftArenaState.options) {
    if (option && option.pokemon && option.pokemon.id !== pokemonId) {
      excludeDexIds.add(getDraftPoolEntryKey(option.pokemon));
    }
  }
  const replacement = buildDraftWeightedWave(pool, 1, excludeDexIds)[0];
  if (!replacement) {
    draftArenaState.message = "Pool épuisé pour reroll individuel.";
    return renderDraftArena();
  }
  draftArenaState.options[optionIndex] = createDraftOptionEntry(replacement);
  draftArenaState.scoreAttackRerollsLeft -= 1;
  draftArenaState.message = `Option remplacée. Encore ${draftArenaState.scoreAttackRerollsLeft} reroll${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""}.`;
  emitDraftScoreAttackProgress();
  warmDraftPokemonMetrics([
    ...draftArenaState.options.map((option) => option.pokemon),
    ...draftArenaState.team.map((member) => member.pokemon),
  ]);
  renderDraftArena();
}

function getDraftScoreAttackRecord(gen) {
  if (!playerProfile || !gen) return 0;
  const records = playerProfile.draftScoreAttackRecords || {};
  return Number(records[gen]) || 0;
}

function updateDraftScoreAttackRecord(gen, average) {
  if (!playerProfile || !gen) return false;
  playerProfile.draftScoreAttackRecords = playerProfile.draftScoreAttackRecords || {};
  const prev = Number(playerProfile.draftScoreAttackRecords[gen]) || 0;
  if (average > prev) {
    playerProfile.draftScoreAttackRecords[gen] = average;
    try { saveProfile(); } catch (_e) {}
    return true;
  }
  return false;
}

function getDraftScoreAttackRoomSelf(room = draftArenaState?.scoreAttackRoom) {
  return room?.players?.find((player) => player.isSelf) || null;
}

function emitDraftScoreAttackProgress() {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || !draftArenaState.scoreAttackRoom) return;
  if (!multiplayerSocket?.connected) return;
  const team = draftArenaState.team
    .filter((entry) => entry?.pokemon)
    .slice(0, DRAFT_TEAM_SIZE)
    .map((entry) => ({
      id: Number(entry.pokemon.id) || 0,
      name: entry.pokemon.name,
      bst: Number(getDraftCachedPokemonPowerData(entry.pokemon).statGlobal) || 0,
      shiny: Boolean(entry.shiny),
    }));
  const metrics = getDraftTeamBstMetrics(draftArenaState.team);
  multiplayerSocket.emit("draft-score:pick-progress", {
    team,
    average: metrics.average || 0,
    total: metrics.total || 0,
    rerollsLeft: Math.max(0, Number(draftArenaState.scoreAttackRerollsLeft ?? DRAFT_SCORE_ATTACK_REROLLS)),
  });
}

function getDraftScoreAttackRoomOpponent(room = draftArenaState?.scoreAttackRoom) {
  return room?.players?.find((player) => !player.isSelf) || null;
}

function applyDraftScoreAttackRoomState(roomState) {
  if (!draftArenaState) return;
  const prevRoom = draftArenaState.scoreAttackRoom;
  const prevStatus = prevRoom?.status || null;
  const prevDuelGen = prevRoom?.duel?.gen ?? null;
  const prevWaveIndex = Number(prevRoom?.duel?.waveIndex) || 0;
  const prevLastEventAt = Number(prevRoom?.duel?.lastEvent?.at) || 0;
  // Détecter un nouveau pick adverse → toast notification
  const newEvent = roomState?.duel?.lastEvent;
  if (newEvent && newEvent.kind === "pick" && Number(newEvent.at) > prevLastEventAt) {
    const self = getDraftScoreAttackRoomSelf(roomState);
    if (self && newEvent.side && newEvent.side !== self.side) {
      const opp = roomState.players?.find((p) => !p.isSelf);
      showDraftScoreOpponentToast(`⚡ ${opp?.nickname || "Adversaire"} a choisi !`);
    }
  }
  draftArenaState.scoreAttackRoom = roomState || null;
  draftArenaState.scoreAttackRoomPending = null;
  draftArenaState.scoreAttackRoomError = null;
  const self = getDraftScoreAttackRoomSelf(roomState);
  draftArenaState.scoreAttackSubmitted = Boolean(self?.hasSubmitted);
  // Détection nouveau duel après une partie finie (relance) → fermer la finale + reset
  const newGen = roomState?.duel?.gen ?? null;
  const newStatus = roomState?.status || null;
  const newWaveIndex = Number(roomState?.duel?.waveIndex) || 0;
  const isFreshDuel = newStatus === "live" && (
    prevStatus === "finished"
    || (newGen !== null && prevDuelGen !== null && newGen !== prevDuelGen)
    || (newWaveIndex === 0 && prevWaveIndex > 0)
  );
  if (isFreshDuel) {
    document.getElementById("draft-score-finale-overlay")?.remove();
    draftScoreFinaleShownFor = null;
  }
  // Mode pool indépendant : on ne synchronise PAS le state local depuis le serveur duel.
  // Le panneau VS lit la progression de l'autre via room.players[].progress (envoyé après chaque pick local)
  draftArenaState.duelMode = false;
  if (draftArenaState.mode === "scoreAttack") renderDraftArena();
  maybeShowDraftScoreFinale(roomState);
}


function startDraftScoreDuel(gen) {
  trackUsage("solo:scoreattack");
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected || !draftArenaState) return;
  socket.emit("draft-score:start-duel", { gen: Number(gen) }, (response = {}) => {
    if (!response.ok) {
      draftArenaState.scoreAttackRoomError = response.error || "Impossible de lancer le duel.";
      renderDraftArena();
    }
  });
}


function createDraftScoreAttackRoom() {
  if (!draftArenaState) return;
  draftArenaState.mode = "scoreAttack";
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return;
  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour la room Score Attack :", playerProfile.nickname || "Joueur 1") || "") || "Joueur 1";
  draftArenaState.scoreAttackRoomPending = "create";
  draftArenaState.scoreAttackRoomError = null;
  renderDraftArena();
  socket.emit("draft-score:create-room", { nickname }, (response = {}) => {
    draftArenaState.scoreAttackRoomPending = null;
    if (!response.ok) {
      draftArenaState.scoreAttackRoomError = response.error || "Impossible de créer la room Score Attack.";
      renderDraftArena();
      return;
    }
    applyDraftScoreAttackRoomState(response.room);
  });
}

function joinDraftScoreAttackRoom() {
  if (!draftArenaState) return;
  draftArenaState.mode = "scoreAttack";
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return;
  const code = String(window.prompt("Code de room Score Attack :", "") || "").trim().toUpperCase();
  if (!code) return;
  const nickname = sanitizePlayerNickname(window.prompt("Pseudo pour rejoindre le Score Attack :", playerProfile.nickname || "Joueur 2") || "") || "Joueur 2";
  draftArenaState.scoreAttackRoomPending = "join";
  draftArenaState.scoreAttackRoomError = null;
  renderDraftArena();
  socket.emit("draft-score:join-room", { code, nickname }, (response = {}) => {
    draftArenaState.scoreAttackRoomPending = null;
    if (!response.ok) {
      draftArenaState.scoreAttackRoomError = response.error || "Impossible de rejoindre la room Score Attack.";
      renderDraftArena();
      return;
    }
    applyDraftScoreAttackRoomState(response.room);
  });
}

function leaveDraftScoreAttackRoom() {
  if (multiplayerSocket?.connected) multiplayerSocket.emit("draft-score:leave-room");
  if (!draftArenaState) return;
  draftArenaState.scoreAttackRoom = null;
  draftArenaState.scoreAttackSubmitted = false;
  draftArenaState.scoreAttackRoomPending = null;
  draftArenaState.scoreAttackRoomError = null;
  renderDraftArena();
}

function submitDraftScoreAttackResult(metrics = null) {
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || !draftArenaState.scoreAttackRoom || draftArenaState.scoreAttackSubmitted) return;
  const socket = ensureMultiplayerSocket();
  if (!socket?.connected) return;
  const finalMetrics = metrics || getDraftTeamBstMetrics(draftArenaState.team);
  const team = draftArenaState.team
    .filter((entry) => entry?.pokemon)
    .slice(0, DRAFT_TEAM_SIZE)
    .map((entry) => ({
      id: Number(entry.pokemon.id) || 0,
      name: entry.pokemon.name,
      bst: Number(getDraftCachedPokemonPowerData(entry.pokemon).statGlobal) || 0,
    }));
  if (team.length !== DRAFT_TEAM_SIZE || !finalMetrics.average) return;
  draftArenaState.scoreAttackSubmitted = true;
  socket.emit("draft-score:submit-result", {
    average: finalMetrics.average,
    total: finalMetrics.total,
    selectedGen: draftArenaState.selectedGen,
    label: getDraftScoreAttackResultLabel(finalMetrics.average),
    team,
  }, (response = {}) => {
    if (!response.ok) {
      draftArenaState.scoreAttackSubmitted = false;
      draftArenaState.scoreAttackRoomError = response.error || "Impossible d'envoyer le score.";
      renderDraftArena();
      return;
    }
    applyDraftScoreAttackRoomState(response.room);
  });
}

let draftScoreFinaleShownFor = null;
let draftScoreOpponentToastTimer = null;

function sendDraftScoreReaction(emoji) {
  if (!multiplayerSocket?.connected || !draftArenaState?.scoreAttackRoom) return;
  multiplayerSocket.emit("draft-score:reaction", { emoji });
  // Animation locale immédiate (sur soi-même)
  showDraftScoreReactionEmoji({ emoji, fromSide: "self", local: true });
}

function showDraftScoreReactionEmoji(payload = {}) {
  const emoji = String(payload.emoji || "").trim();
  if (!emoji) return;
  const isLocal = Boolean(payload.local);
  // Cibler la card du joueur qui envoie l'émoji (ou la card adverse si reçu)
  const targetSel = isLocal ? ".draft-score-vs-player.is-self" : ".draft-score-vs-player.is-opponent";
  const target = document.querySelector(targetSel);
  if (!target) return;
  const node = document.createElement("div");
  node.className = "draft-score-reaction-emoji";
  node.textContent = emoji;
  // Position random horizontale dans la card
  node.style.left = `${20 + Math.random() * 60}%`;
  target.appendChild(node);
  setTimeout(() => node.remove(), 2000);
}

function showDraftScoreOpponentToast(message) {
  let toast = document.getElementById("draft-score-opp-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "draft-score-opp-toast";
    toast.className = "draft-score-opp-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  if (draftScoreOpponentToastTimer) clearTimeout(draftScoreOpponentToastTimer);
  draftScoreOpponentToastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

function maybeShowDraftScoreFinale(room) {
  if (!room || room.status !== "finished") return;
  const fingerprint = `${room.code}:${room.players?.map((p) => `${p.side}-${p.result?.average || 0}-${p.result?.total || 0}`).join("|")}`;
  if (draftScoreFinaleShownFor === fingerprint) return;
  draftScoreFinaleShownFor = fingerprint;
  updateDraftScoreHeadToHead(room, false);
  showDraftScoreFinaleOverlay(room);
}

function getDraftScoreHeadToHead(opponentNickname, pro) {
  if (!playerProfile || !opponentNickname) return { wins: 0, losses: 0, draws: 0 };
  const all = (pro ? playerProfile.draftScoreProHeadToHead : playerProfile.draftScoreHeadToHead) || {};
  const entry = all[String(opponentNickname).toLowerCase()] || { wins: 0, losses: 0, draws: 0 };
  return {
    wins: Math.max(0, Number(entry.wins) || 0),
    losses: Math.max(0, Number(entry.losses) || 0),
    draws: Math.max(0, Number(entry.draws) || 0),
  };
}

function updateDraftScoreHeadToHead(room, pro) {
  if (!playerProfile || !room || room.status !== "finished") return;
  const self = room.players?.find((p) => p.isSelf);
  const opp = room.players?.find((p) => !p.isSelf);
  if (!self || !opp || !opp.nickname) return;
  const key = String(opp.nickname).toLowerCase();
  const storeKey = pro ? "draftScoreProHeadToHead" : "draftScoreHeadToHead";
  playerProfile[storeKey] = playerProfile[storeKey] || {};
  const cur = playerProfile[storeKey][key] || { wins: 0, losses: 0, draws: 0 };
  if (room.winnerSide === "tie") cur.draws = (Number(cur.draws) || 0) + 1;
  else if (room.winnerSide === self.side) cur.wins = (Number(cur.wins) || 0) + 1;
  else if (room.winnerSide === opp.side) cur.losses = (Number(cur.losses) || 0) + 1;
  playerProfile[storeKey][key] = cur;
  try { saveProfile(); } catch (_e) {}
}

function showDraftScoreFinaleOverlay(room) {
  const existing = document.getElementById("draft-score-finale-overlay");
  if (existing) existing.remove();
  const self = room.players?.find((p) => p.isSelf);
  const opp = room.players?.find((p) => !p.isSelf);
  if (!self?.result || !opp?.result) return;
  const selfWon = room.winnerSide === self.side;
  const tie = room.winnerSide === "tie";
  const title = tie ? "🤝 ÉGALITÉ !" : selfWon ? "🏆 VICTOIRE !" : "💀 DÉFAITE";
  const titleClass = tie ? "is-tie" : selfWon ? "is-win" : "is-lose";
  const buildTeamRow = (player, side) => {
    const team = Array.isArray(player.result?.team) ? player.result.team : [];
    return `<div class="dsf-team-side dsf-side-${side}">
      <div class="dsf-team-head"><b>${escapeHtml(player.nickname || "Joueur")}</b><span class="dsf-side-label">${side === "left" ? "" : ""}${player.isSelf ? "TOI" : "ADVERSAIRE"}</span></div>
      <div class="dsf-team-sprites">${team.map((entry, idx) => {
        const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
        const sprite = pokemon ? getPokemonSprite(pokemon) : `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${entry.id}.png`;
        return `<div class="dsf-pokemon-tile" style="--dsf-i:${idx}"><img src="${escapeHtml(sprite)}" alt="${escapeHtml(entry.name)}" data-fallback="${pokemon?.sprite || ''}" /><b>${entry.bst}</b><span>${escapeHtml(entry.name)}</span></div>`;
      }).join("")}</div>
      <div class="dsf-team-score" data-target="${player.result?.average || 0}">0</div>
      <div class="dsf-team-score-label">Moyenne BST</div>
    </div>`;
  };
  // Head-to-head dans la finale
  const h2h = opp.nickname ? getDraftScoreHeadToHead(opp.nickname) : null;
  const h2hTotal = h2h ? (h2h.wins + h2h.losses + h2h.draws) : 0;
  const h2hHtml = h2hTotal > 0
    ? `<div class="dsf-h2h">Bilan contre <b>${escapeHtml(opp.nickname || "")}</b> : <b class="dsf-h2h-w">${h2h.wins}V</b> · <b class="dsf-h2h-l">${h2h.losses}D</b>${h2h.draws ? ` · <b class="dsf-h2h-t">${h2h.draws}N</b>` : ""}</div>`
    : "";
  const overlay = document.createElement("div");
  overlay.id = "draft-score-finale-overlay";
  overlay.className = "draft-score-finale-overlay";
  overlay.innerHTML = `
    <div class="dsf-backdrop"></div>
    <div class="dsf-content">
      <div class="dsf-title ${titleClass}">${title}</div>
      ${h2hHtml}
      <div class="dsf-versus">
        ${buildTeamRow(self, "left")}
        <div class="dsf-vs-center">VS</div>
        ${buildTeamRow(opp, "right")}
      </div>
      <div class="dsf-actions">
        <button class="btn-red" type="button" id="dsf-close">Continuer</button>
      </div>
      <div class="dsf-rematch-hint">${self.isHost ? "💡 Clique sur une génération en bas pour relancer un duel." : "💡 En attente de l'hôte pour choisir une nouvelle génération…"}</div>
    </div>`;
  document.body.appendChild(overlay);
  // Animate score counters
  setTimeout(() => {
    overlay.querySelectorAll(".dsf-team-score").forEach((el) => {
      const target = Number(el.dataset.target) || 0;
      const start = Date.now();
      const duration = 1400;
      const step = () => {
        const elapsed = Date.now() - start;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = target;
      };
      requestAnimationFrame(step);
    });
  }, 600);
  document.getElementById("dsf-close")?.addEventListener("click", () => {
    overlay.classList.add("is-closing");
    setTimeout(() => overlay.remove(), 300);
  });
  // Auto-focus close button for keyboard accessibility
  setTimeout(() => document.getElementById("dsf-close")?.focus(), 300);
}

function renderDraftScoreAttackPlayerCard(player, isSelf) {
  // Mode pool indépendant : lire depuis player.progress.team (mis à jour live à chaque pick)
  // Fallback sur player.result.team quand la partie est finalisée
  const team = Array.isArray(player.progress?.team) && player.progress.team.length
    ? player.progress.team
    : (Array.isArray(player.result?.team) ? player.result.team : []);
  const average = player.result?.average ?? player.progress?.average ?? 0;
  const total = player.result?.total ?? player.progress?.total ?? 0;
  const filled = team.length;
  const slotsHtml = Array.from({ length: DRAFT_TEAM_SIZE }, (_, i) => {
    const entry = team[i];
    if (!entry) {
      return `<div class="draft-score-vs-slot is-empty"><span>?</span></div>`;
    }
    // Résoudre le sprite via getPokemonSprite (gère les Mega/Z-A formes spéciales)
    const pokemon = (Array.isArray(POKEMON_LIST) ? POKEMON_LIST : []).find((p) => Number(p.id) === Number(entry.id));
    let sprite;
    if (pokemon) {
      sprite = entry.shiny && typeof getPokemonShinySprite === "function" ? getPokemonShinySprite(pokemon) : getPokemonSprite(pokemon);
    } else {
      sprite = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${entry.id}.png`;
    }
    return `<div class="draft-score-vs-slot is-filled${entry.shiny ? " is-shiny" : ""}" data-rarity="${Number(entry.bst) >= 600 ? "legendary" : Number(entry.bst) >= 500 ? "strong" : Number(entry.bst) >= 400 ? "decent" : "common"}" data-slot-key="${entry.id}-${i}" title="${escapeHtml(entry.name)} (BST ${entry.bst})"><img src="${escapeHtml(sprite)}" alt="${escapeHtml(entry.name)}" loading="lazy" data-fallback="${pokemon?.sprite || ''}" /><b>${entry.bst}</b></div>`;
  }).join("");
  const status = player.hasSubmitted
    ? "✅ Soumis"
    : filled === 0
      ? "⏳ Choisit ses Pokémon…"
      : filled < DRAFT_TEAM_SIZE
        ? `🔥 ${filled}/6 picks`
        : "📤 Envoi du score…";
  return `
    <div class="draft-score-vs-player ${isSelf ? "is-self" : "is-opponent"} ${player.connected ? "" : "is-disconnected"}">
      <div class="draft-score-vs-head">
        <div class="draft-score-vs-name"><b>${escapeHtml(player.nickname || "Joueur")}</b>${isSelf ? "<span>TOI</span>" : ""}</div>
        <div class="draft-score-vs-status">${status}</div>
      </div>
      <div class="draft-score-vs-slots">${slotsHtml}</div>
      <div class="draft-score-vs-metrics">
        <div class="draft-score-vs-metric"><span>Moyenne BST</span><b>${average || "-"}</b></div>
        <div class="draft-score-vs-metric"><span>Total</span><b>${total || "-"}</b></div>
        <div class="draft-score-vs-metric"><span>Relances</span><b>${player.progress?.rerollsLeft ?? DRAFT_SCORE_ATTACK_REROLLS}</b></div>
      </div>
    </div>`;
}

function renderDraftScoreAttackRoomStatus(room = draftArenaState?.scoreAttackRoom) {
  if (!draftArenaState?.scoreAttackRoomError && !room) {
    return `<div class="draft-score-vs-empty">
      <b>🎯 Score Attack solo</b>
      <span>Drafte pour battre ton record perso, ou défie un ami en duel live ci-dessous.</span>
      <div class="draft-score-vs-empty-actions">
        <button class="btn-blue" type="button" data-action="createDraftScoreAttackRoom">🆚 Créer un salon 1v1</button>
        <button class="btn-ghost" type="button" data-action="joinDraftScoreAttackRoom">🔗 Rejoindre par code</button>
      </div>
    </div>`;
  }
  if (!room) {
    return `<div class="draft-score-vs-empty">
      <b>Score Attack 1v1</b>
      <span>${escapeHtml(draftArenaState.scoreAttackRoomError || "Room indisponible.")}</span>
      <div class="draft-score-vs-empty-actions">
        <button class="btn-blue" type="button" data-action="createDraftScoreAttackRoom">🆚 Créer une room</button>
        <button class="btn-ghost" type="button" data-action="joinDraftScoreAttackRoom">🔗 Rejoindre</button>
      </div>
    </div>`;
  }
  const self = getDraftScoreAttackRoomSelf(room);
  const opponent = getDraftScoreAttackRoomOpponent(room);
  let headTitle = "";
  if (room.status === "finished") {
    if (room.winnerSide === "tie") headTitle = "🤝 Égalité parfaite";
    else if (self && room.winnerSide === self.side) headTitle = "🏆 VICTOIRE !";
    else headTitle = "💀 Défaite";
  } else if (!opponent) {
    headTitle = `⏳ En attente d'un adversaire • Code : ${escapeHtml(room.code || "-")}`;
  } else {
    headTitle = `⚔️ DUEL EN COURS • Code ${escapeHtml(room.code || "-")}`;
  }
  const selfCard = self ? renderDraftScoreAttackPlayerCard(self, true) : "";
  const oppCard = opponent ? renderDraftScoreAttackPlayerCard(opponent, false) : `<div class="draft-score-vs-player is-opponent is-waiting"><div class="draft-score-vs-head"><div class="draft-score-vs-name"><b>En attente…</b></div></div><div class="draft-score-vs-slots">${Array.from({ length: DRAFT_TEAM_SIZE }, () => `<div class="draft-score-vs-slot is-empty"><span>?</span></div>`).join("")}</div><div class="draft-score-vs-share">Partage le code <b>${escapeHtml(room.code || "")}</b> à ton ami pour le faire rejoindre.</div></div>`;
  const selfAvg = self?.progress?.average || self?.result?.average || 0;
  const oppAvg = opponent?.progress?.average || opponent?.result?.average || 0;
  const leadIndicator = (selfAvg > 0 || oppAvg > 0) && opponent
    ? `<div class="draft-score-vs-lead">${selfAvg > oppAvg ? "🔥 Tu mènes !" : oppAvg > selfAvg ? "⚠️ Tu es mené" : "⚖️ Égalité"} (${selfAvg} vs ${oppAvg})</div>`
    : "";
  let headToHeadHtml = "";
  if (opponent?.nickname) {
    const h2h = getDraftScoreHeadToHead(opponent.nickname);
    const total = h2h.wins + h2h.losses + h2h.draws;
    if (total > 0) {
      const ledTxt = h2h.wins > h2h.losses ? "🏆 Tu mènes" : h2h.losses > h2h.wins ? "💀 Tu es mené" : "⚖️ Vous êtes à égalité";
      headToHeadHtml = `<div class="draft-score-vs-h2h"><span>${ledTxt} contre <b>${escapeHtml(opponent.nickname)}</b></span><span class="draft-score-h2h-numbers"><b class="is-win">${h2h.wins}V</b> · <b class="is-lose">${h2h.losses}D</b>${h2h.draws ? ` · <b class="is-tie">${h2h.draws}N</b>` : ""}</span></div>`;
    }
  }
  const leaveBtn = `<button class="draft-score-vs-leave" type="button" data-action="leaveDraftScoreAttackRoom" title="Quitter la room">🚪 Quitter</button>`;
  const canReact = Boolean(opponent && room.status === "live");
  const reactionBar = canReact
    ? `<div class="draft-score-reaction-bar">${["🔥", "😱", "😈", "👍", "🤡", "💀", "👀", "🎯"].map((emoji) => `<button class="draft-score-reaction-btn" type="button" data-action="sendDraftScoreReaction" data-args='["${emoji}"]' title="Envoyer ${emoji}">${emoji}</button>`).join("")}</div>`
    : "";
  return `
    <div class="draft-score-vs-wrap">
      ${leaveBtn}
      <div class="draft-score-vs-title">${headTitle}</div>
      ${headToHeadHtml}
      ${leadIndicator}
      ${reactionBar}
      <div class="draft-score-vs-arena">
        ${selfCard}
        <div class="draft-score-vs-versus">VS</div>
        ${oppCard}
      </div>
    </div>
  `;
}

function selectDraftGeneration(gen) {
  if (!draftArenaState) return;
  // Mode Score Attack en room : chaque joueur draft INDÉPENDAMMENT avec son propre pool
  // Le panneau VS affiche la progression de l'autre en live (via pick-progress)
  // Reset côté serveur (efface result/progress, repasse status en live si les 2 ont reset)
  if (draftArenaState.mode === "scoreAttack" && draftArenaState.scoreAttackRoom && multiplayerSocket?.connected) {
    multiplayerSocket.emit("draft-score:reset-self");
  }

  draftArenaState.phase = "draft";
  draftArenaState.selectedGen = gen;
  draftArenaState.team = [];
  draftArenaState.selectedDexIds = new Set();
  draftArenaState.options = [];
  draftArenaState.shinyCount = 0;
  draftArenaState.badgeResults = [];
  draftArenaState.teamPower = 0;
  draftArenaState.teamSynergy = 0;
  draftArenaState.runSummary = null;
  draftArenaState.evaluating = false;
  draftArenaState.scoreAttackRerollsLeft = DRAFT_SCORE_ATTACK_REROLLS;
  draftArenaState.scoreAttackBestAverage = 0;
  draftArenaState.scoreAttackSubmitted = false;
  draftArenaState.message = draftArenaState.mode !== "scoreAttack"
    ? `Génération sélectionnée : ${draftGenLabel(gen)}. Choisis ton premier Pokémon.`
    : draftArenaState.scoreAttackPro
      ? `🔥 Score Attack PRO ${draftGenLabel(gen)}. Drafte 6 Pokémon — les bonus tombent à la fin !`
      : `Score Attack ${draftGenLabel(gen)}. Monte la meilleure moyenne BST possible.`;

  fillDraftArenaOptions();
  renderDraftArena();
}

function getDraftTeamSynergy(teamData) {
  const typeCounts = new Map();
  let dualTypeCount = 0;

  teamData.forEach((member) => {
    [member.pokemon.type1, member.pokemon.type2].filter(Boolean).forEach((type) => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });
    if (member.pokemon.type2) dualTypeCount += 1;
  });

  const uniqueTypes = typeCounts.size;
  let duplicatePenalty = 0;
  typeCounts.forEach((count) => {
    if (count > 2) duplicatePenalty += count - 2;
  });

  const score = clampDraftValue(uniqueTypes * 2 + dualTypeCount - duplicatePenalty * 2, 0, 24);
  return {
    score,
    label: score >= 18 ? "Excellente" : score >= 12 ? "Bonne" : score >= 7 ? "Correcte" : "Fragile",
    uniqueTypes,
  };
}

// Draft Arènes and Draft PRO were removed on 13 October 2026: old links, saved
// runs and history entries open the normal Draft instead.
function openDraftArenaMode() {
  return openDraftScoreAttackMode();
}

function openDraftScoreAttackMode(pro) {
  hideAllScreens();
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  document.getElementById("screen-draft-arena")?.classList.add("hidden");
  closeRankingPicker();
  stopCrySound();
  setQuizModeLayout(false);
  stopEmulatorSession();
  mountDraftModeCard("scoreAttack");
  showScreen("screen-draft-score-attack");
  setGlobalNavActive("game");

  const wantPro = false;
  // Reset propre : on repart d'une partie fraîche si on (re)choisit un mode ou si on change de mode.
  if (!draftArenaState || draftArenaState.mode !== "scoreAttack" || draftArenaState.scoreAttackPro !== wantPro) {
    draftArenaState = createDraftArenaState();
    draftArenaState.mode = "scoreAttack";
    draftArenaState.scoreAttackPro = wantPro;
    draftArenaState.message = wantPro
      ? "Score Attack PRO — choisis une génération pour lancer une run à bonus."
      : "Score Attack — choisis une génération pour viser la meilleure moyenne BST.";
  }
  draftArenaState.scoreAttackPro = wantPro;
  renderDraftArena();
  window.scrollTo(0, 0);
}


function mountDraftModeCard(mode = "arena") {
  const card = document.getElementById("draft-mode-card");
  const arenaScreen = document.getElementById("screen-draft-arena");
  const scoreScreen = document.getElementById("screen-draft-score-attack");
  if (!card || !arenaScreen || !scoreScreen) return;
  const target = mode === "scoreAttack" ? scoreScreen : arenaScreen;
  if (card.parentElement !== target) target.appendChild(card);
  arenaScreen.classList.toggle("is-mode-score-attack", false);
  scoreScreen.classList.toggle("is-mode-score-attack", mode === "scoreAttack");
  // Adapter le titre + sous-titre selon le mode actif
  const title = card.querySelector(".card-title");
  if (title) title.textContent = mode === "scoreAttack"
    ? (draftArenaState?.scoreAttackPro ? "🔥 Draft Score Attack PRO" : "🎯 Draft Score Attack")
    : "🏟️ Draft Arènes";
  const desc = card.querySelector(".card-desc");
  if (desc) desc.textContent = mode === "scoreAttack"
    ? "Drafte 6 Pokémon, optimise la moyenne BST et défie un ami en 1v1 Score."
    : DRAFT_BATTLE_ENABLED
        ? "Choisis une génération, drafte 6 Pokémon, puis découvre les badges que ton équipe peut réellement viser."
        : "Drafte 6 Pokémon et analyse ton équipe. Les combats d’arène sont en préparation ; Score Attack est disponible pour jouer une partie complète.";
}

function restartDraftArenaRun() {
  // En mode duel synchronisé : ne PAS reset local, demander au serveur de relancer en gardant la room
  if (draftArenaState?.mode === "scoreAttack" && draftArenaState?.scoreAttackRoom && draftArenaState?.duelMode) {
    const room = draftArenaState.scoreAttackRoom;
    const self = getDraftScoreAttackRoomSelf(room);
    if (!self?.isHost) {
      draftArenaState.scoreAttackRoomError = "Seul l'hôte peut lancer une nouvelle partie. Tu peux changer la génération depuis chez l'hôte.";
      return renderDraftArena();
    }
    const currentGen = Number(draftArenaState.selectedGen) || Number(room?.duel?.gen) || null;
    if (currentGen) {
      // Relance avec la même gen
      return startDraftScoreDuel(currentGen);
    }
    draftArenaState.message = "Clique sur une génération pour lancer une nouvelle partie.";
    return renderDraftArena();
  }
  const previousMode = draftArenaState?.mode || "arena";
  const previousScoreRoom = draftArenaState?.scoreAttackRoom || null;
  const previousPro = !!(draftArenaState && draftArenaState.scoreAttackPro);
  clearDraftArenaProgress();
  draftArenaState = createDraftArenaState();
  draftArenaState.mode = previousMode;
  draftArenaState.scoreAttackPro = previousPro;
  if (previousMode === "scoreAttack") {
    draftArenaState.scoreAttackRoom = previousScoreRoom;
    draftArenaState.scoreAttackSubmitted = false;
  }
  draftArenaState.message = previousMode === "scoreAttack"
    ? (previousPro ? "🔥 Score Attack PRO prêt. Choisis une génération." : "Score Attack prêt. Choisis une génération pour viser la meilleure moyenne BST.")
    : "Choisis une génération pour commencer le draft.";
  renderDraftArena();
}


async function pickDraftArenaOption(pokemonId) {
  if (!draftArenaState || draftArenaState.phase !== "draft") return;
  if (draftArenaState.team.length >= DRAFT_TEAM_SIZE) return;

  const optionIndex = draftArenaState.options.findIndex((option) => option.pokemon.id === pokemonId);
  const picked = optionIndex >= 0 ? draftArenaState.options[optionIndex] : null;
  if (!picked) return;

  const dexId = getDraftPoolEntryKey(picked.pokemon);
  if (draftArenaState.selectedDexIds.has(dexId)) return;

  draftArenaState.team.push({ pokemon: picked.pokemon, shiny: picked.shiny });
  draftArenaState.selectedDexIds.add(dexId);
  if (picked.shiny) draftArenaState.shinyCount += 1;
  emitDraftScoreAttackProgress();

  if (draftArenaState.team.length >= DRAFT_TEAM_SIZE) {
    if (draftArenaState.mode === "scoreAttack") {
      const metrics = getDraftTeamBstMetrics(draftArenaState.team);
      draftArenaState.phase = "result";
      draftArenaState.scoreAttackBestAverage = Math.max(Number(draftArenaState.scoreAttackBestAverage) || 0, metrics.average);
      const previousRecord = getDraftScoreAttackRecord(draftArenaState.selectedGen);
      const isNewRecord = updateDraftScoreAttackRecord(draftArenaState.selectedGen, metrics.average);
      draftArenaState.scoreAttackNewRecord = isNewRecord;
      draftArenaState.scoreAttackPreviousRecord = previousRecord;
      draftArenaState.runSummary = {
        status: `${getDraftScoreAttackResultLabel(metrics.average)} • Moyenne ${metrics.average}${isNewRecord ? " 🏆 NOUVEAU RECORD !" : ""}`,
        mvpName: draftArenaState.team
          .slice()
          .sort((left, right) => (getDraftCachedPokemonPowerData(right.pokemon).statGlobal || 0) - (getDraftCachedPokemonPowerData(left.pokemon).statGlobal || 0))[0]?.pokemon?.name || "-",
        balanceLabel: `Total BST ${metrics.total}`,
        offenseLabel: `${draftArenaState.scoreAttackRerollsLeft} reroll${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""} restant${draftArenaState.scoreAttackRerollsLeft > 1 ? "s" : ""}${previousRecord > 0 ? ` • Précédent record : ${previousRecord}` : ""}`,
      };
      draftArenaState.message = isNewRecord
        ? `🏆 NOUVEAU RECORD Gen ${draftArenaState.selectedGen} : moyenne BST ${metrics.average} ! (avant : ${previousRecord || 0})`
        : `Score Attack terminé : moyenne BST ${metrics.average}. ${getDraftScoreAttackResultLabel(metrics.average)}.`;
      // XP + quêtes Score Attack
      awardXp(Math.round(metrics.average / 10), `Score Attack ${metrics.average} BST`);
      if (isNewRecord) awardXp(50, "Nouveau record Score Attack");
      progressQuest("score_attack_500", metrics.average);
      progressQuest("score_attack_600", metrics.average);
      progressQuest("draft_complete", 1);
      submitDraftScoreAttackResult(metrics);
      if (typeof submitLeaderboardResult === "function") {
        submitLeaderboardResult("draft_" + draftArenaState.selectedGen, metrics.average);
        submitLeaderboardResult("draft_all", metrics.average);
      }
      renderDraftArena();
      return;
    }
    renderDraftArena();
    return;
  } else {
    const remain = DRAFT_TEAM_SIZE - draftArenaState.team.length;
    draftArenaState.message = `Pokémon ajouté. Encore ${remain} choix.`;
    replaceDraftArenaOption(optionIndex);
  }

  renderDraftArena();
}

function updateDraftRankChip(gen) {
  if (!window.__pokedleAuthed || !gen) return;
  var el = document.getElementById("dsh-rank-val");
  if (!el) return;
  window.__draftRankCache = window.__draftRankCache || {};
  var c = window.__draftRankCache[gen];
  if (c && Date.now() - c.t < 15000) { el.textContent = c.rank ? "#" + c.rank : "\u2013"; return; }
  fetch("/api/leaderboard?mode=draft_" + gen, { credentials: "same-origin" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var rank = d && d.me ? d.me.rank : null;
      window.__draftRankCache[gen] = { rank: rank, t: Date.now() };
      var e = document.getElementById("dsh-rank-val");
      if (e) e.textContent = rank ? "#" + rank : "\u2013";
    })
    .catch(function () {});
}
function animateDraftCount(el, target) {
  if (!el) return;
  target = Number(target) || 0;
  var dur = 900, start = performance.now();
  function tick(now) {
    var t = Math.min(1, (now - start) / dur);
    var eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased);
    if (t < 1) requestAnimationFrame(tick); else el.textContent = target;
  }
  requestAnimationFrame(tick);
}
function launchDraftConfetti(container) {
  if (!container) return;
  var colors = ["#2f76ff", "#e4382f", "#ffcc33", "#7a2bd0", "#1f8a37"];
  var layer = document.createElement("div");
  layer.className = "dse-confetti";
  for (var i = 0; i < 42; i++) {
    var p = document.createElement("span");
    p.style.left = (Math.random() * 100) + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.35) + "s";
    layer.appendChild(p);
  }
  container.appendChild(layer);
  setTimeout(function () { layer.remove(); }, 2800);
}
function shareDraftScore() {
  try {
    if (typeof draftArenaState === "undefined" || !draftArenaState) return;
    var avg = getDraftTeamBstMetrics(draftArenaState.team).average;
    var gen = draftArenaState.selectedGen;
    var label = getDraftScoreAttackResultLabel(avg);
    var txt = "\ud83c\udfaf Draft Score Attack \u2014 Gen " + gen + " : moyenne BST " + avg + " (" + label + ") sur Pok\u00e9dle ! https://pokdle.fr";
    if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(function () { if (typeof showToast === "function") showToast("R\u00e9sultat copi\u00e9 !"); }).catch(function () {}); }
  } catch (e) {}
}
window.shareDraftScore = shareDraftScore;
function renderDraftArena() {
  const screen = document.getElementById(draftArenaState?.mode === "scoreAttack" ? "screen-draft-score-attack" : "screen-draft-arena");
  if (!screen || !draftArenaState) return;
  saveDraftArenaProgress();
  mountDraftModeCard(draftArenaState.mode);

  const status = document.getElementById("draft-status");
  const genBadge = document.getElementById("draft-gen-badge");
  const picksBadge = document.getElementById("draft-picks-badge");
  const shinyBadge = document.getElementById("draft-shiny-badge");
  const averageBadge = document.getElementById("draft-bst-average-badge");
  const badgeCount = document.getElementById("draft-badge-count");
  const genButtons = document.getElementById("draft-gen-buttons");
  const options = document.getElementById("draft-options");
  const team = document.getElementById("draft-team");
  const teamMetrics = document.getElementById("draft-team-metrics");
  const resultWrap = document.getElementById("draft-result-wrap");
  const resultTitle = document.getElementById("draft-result-title");
  const runSummary = document.getElementById("draft-run-summary");
  const scoreRerollButton = document.getElementById("draft-score-reroll");
  const scoreRoomCreate = document.getElementById("draft-score-room-create");
  const scoreRoomJoin = document.getElementById("draft-score-room-join");
  const scoreRoomLeave = document.getElementById("draft-score-room-leave");
  const scoreRoomStatus = document.getElementById("draft-score-room-status");
  const endActions = document.getElementById("draft-end-actions");
  const pageTitle = screen.querySelector(".ranking-head .card-title");
  const pageDesc = screen.querySelector(".draft-card > .card-desc");
  const isScoreAttackMode = draftArenaState.mode === "scoreAttack";
  const draftFinished = draftArenaState.phase === "result" && draftArenaState.team.length >= DRAFT_TEAM_SIZE && !draftArenaState.evaluating;

  if (pageTitle) pageTitle.textContent = isScoreAttackMode
    ? (draftArenaState.scoreAttackPro ? "🔥 Draft Score Attack PRO" : "🎯 Draft Score Attack")
    : "🎴 Draft Arènes";
  if (pageDesc) {
    pageDesc.textContent = isScoreAttackMode
      ? "Drafte 6 Pokémon, optimise la moyenne BST et défie un ami en 1v1 Score."
      : "Choisis une génération, drafte 6 Pokémon, puis découvre les badges que ton équipe peut réellement viser.";
  }

  if (status) status.textContent = draftArenaState.message;
  if (genBadge) genBadge.textContent = draftArenaState.selectedGen ? `Génération : ${draftGenLabel(draftArenaState.selectedGen)}` : "Génération : -";
  if (picksBadge) picksBadge.textContent = `Équipe : ${draftArenaState.team.length} / ${DRAFT_TEAM_SIZE}`;
  if (shinyBadge) shinyBadge.textContent = `Shiny : ${draftArenaState.shinyCount}`;
  const bstMetrics = getDraftTeamBstMetrics(draftArenaState.team);
  if (averageBadge) {
    averageBadge.textContent = `Moy. BST : ${bstMetrics.average || "-"}`;
    averageBadge.dataset.state = bstMetrics.average >= 550 ? "complete" : bstMetrics.average >= 500 ? "progress" : "empty";
  }
  const restartBtn = document.getElementById("draft-restart-btn");
  if (restartBtn) {
    const isDuel = Boolean(draftArenaState.duelMode && draftArenaState.scoreAttackRoom);
    const room = draftArenaState.scoreAttackRoom;
    const selfRoom = room ? getDraftScoreAttackRoomSelf(room) : null;
    const isLiveDuel = isDuel && room?.status === "live";
    if (isDuel) {
      restartBtn.textContent = isLiveDuel ? "⏳ Partie en cours…" : (selfRoom?.isHost ? "🎮 Nouvelle partie" : "⏳ En attente de l'hôte");
      restartBtn.disabled = isLiveDuel || !selfRoom?.isHost;
    } else {
      restartBtn.textContent = "🎲 Nouveau draft";
      restartBtn.disabled = false;
    }
  }
  const recordBadge = document.getElementById("draft-score-record-badge");
  if (recordBadge) {
    const isScoreAttack = draftArenaState.mode === "scoreAttack";
    const record = isScoreAttack ? getDraftScoreAttackRecord(draftArenaState.selectedGen) : 0;
    if (isScoreAttack && draftArenaState.selectedGen) {
      recordBadge.classList.remove("hidden");
      recordBadge.textContent = `🏆 Record Gen ${draftArenaState.selectedGen} : ${record || "-"}`;
      if (draftArenaState.scoreAttackNewRecord) recordBadge.classList.add("is-new-record");
      else recordBadge.classList.remove("is-new-record");
    } else {
      recordBadge.classList.add("hidden");
      recordBadge.classList.remove("is-new-record");
    }
  }
  const wonCount = draftArenaState.badgeResults.filter((result) => result.status === "won").length;
  const prioritizeScoreResult = Boolean(isScoreAttackMode && draftFinished && !draftArenaState.scoreAttackRoom);
  if (endActions) {
    const picksPanel = screen.querySelector(".draft-panel-picks");
    const teamPanel = screen.querySelector(".draft-panel-team");
    if (prioritizeScoreResult && picksPanel && options && endActions.parentElement !== picksPanel) {
      picksPanel.insertBefore(endActions, options);
    } else if (!prioritizeScoreResult && teamPanel && endActions.parentElement !== teamPanel) {
      teamPanel.appendChild(endActions);
    }
    endActions.classList.toggle("draft-end-actions-priority", prioritizeScoreResult);
  }

  const progressRatio = Math.max(0, Math.min(1, (draftArenaState.team.length || 0) / DRAFT_TEAM_SIZE));
  const progressWrap = screen.querySelector(".draft-progress");
  if (progressWrap) {
    progressWrap.style.setProperty("--draft-progress-fill", `${Math.round(progressRatio * 100)}%`);
    progressWrap.dataset.stage = draftArenaState.team.length >= DRAFT_TEAM_SIZE ? "ready" : draftArenaState.selectedGen ? "drafting" : "idle";
  }
  if (genBadge) genBadge.dataset.state = draftArenaState.selectedGen ? "selected" : "empty";
  if (picksBadge) picksBadge.dataset.state = draftArenaState.team.length >= DRAFT_TEAM_SIZE ? "complete" : draftArenaState.team.length > 0 ? "progress" : "empty";
  if (badgeCount) badgeCount.dataset.state = wonCount > 0 ? "active" : "empty";
  if (badgeCount) badgeCount.textContent = draftArenaState.mode === "scoreAttack"
    ? `Rerolls : ${draftArenaState.scoreAttackRerollsLeft}`
    : `Badges : ${wonCount} / 8`;

  if (scoreRoomCreate) {
    scoreRoomCreate.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || Boolean(draftArenaState.scoreAttackRoom));
    scoreRoomCreate.disabled = Boolean(draftArenaState.scoreAttackRoomPending);
  }
  if (scoreRoomJoin) {
    scoreRoomJoin.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || Boolean(draftArenaState.scoreAttackRoom));
    scoreRoomJoin.disabled = Boolean(draftArenaState.scoreAttackRoomPending);
  }
  if (scoreRoomLeave) {
    scoreRoomLeave.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || !draftArenaState.scoreAttackRoom);
  }
  if (scoreRoomStatus) {
    const shouldShowScoreRoom = draftArenaState.mode === "scoreAttack"
      && (!draftFinished || Boolean(draftArenaState.scoreAttackRoom) || Boolean(draftArenaState.scoreAttackRoomError));
    scoreRoomStatus.classList.toggle("hidden", !shouldShowScoreRoom);
    scoreRoomStatus.innerHTML = shouldShowScoreRoom ? renderDraftScoreAttackRoomStatus() : "";
  }
  screen.classList.toggle("is-mode-score-attack", draftArenaState.mode === "scoreAttack");
  screen.classList.toggle("is-drafting", draftArenaState.mode === "scoreAttack" && draftArenaState.phase !== "gen");
  screen.classList.toggle("is-mode-arena", draftArenaState.mode !== "scoreAttack");
  if (scoreRerollButton) {
    const canReroll = draftArenaState.mode === "scoreAttack"
      && draftArenaState.phase === "draft"
      && Boolean(draftArenaState.selectedGen)
      && draftArenaState.scoreAttackRerollsLeft > 0;
    // En mode duel : visible uniquement pour l'host, désactivé si un joueur a déjà pick ou plus de rerolls
    if (draftArenaState.duelMode && draftArenaState.scoreAttackRoom) {
      const room = draftArenaState.scoreAttackRoom;
      const selfRoom = getDraftScoreAttackRoomSelf(room);
      const duelRerollsLeft = Number(room?.duel?.rerollsLeft ?? 0);
      const someoneLocked = Boolean(room?.duel?.pendingSides?.length);
      const canHostReroll = Boolean(selfRoom?.isHost) && room?.status === "live" && !someoneLocked && duelRerollsLeft > 0;
      scoreRerollButton.classList.toggle("hidden", !selfRoom?.isHost || room?.status !== "live");
      scoreRerollButton.disabled = !canHostReroll;
      scoreRerollButton.textContent = `🔄 Relancer la vague duel (${duelRerollsLeft})`;
    } else {
      scoreRerollButton.classList.toggle("hidden", draftArenaState.mode !== "scoreAttack" || draftArenaState.phase !== "draft");
      scoreRerollButton.disabled = !canReroll;
      scoreRerollButton.textContent = `Relancer la vague (${draftArenaState.scoreAttackRerollsLeft})`;
    }
  }
  if (genButtons) {
    genButtons.innerHTML = "";
    const room = draftArenaState.scoreAttackRoom;
    const selfRoom = room ? getDraftScoreAttackRoomSelf(room) : null;
    const isDuelHost = Boolean(draftArenaState.mode === "scoreAttack" && room && selfRoom?.isHost);
    // L'host peut relancer à tout moment quand il y a 2 joueurs (live, lobby, finished)
    const canHostRelaunch = isDuelHost && (room?.players?.length || 0) === 2;
    for (const cfg of DRAFT_GEN_OPTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "draft-gen-btn" + (draftArenaState.selectedGen === cfg.gen ? " active" : "");
      btn.textContent = cfg.label;
      btn.disabled = draftArenaState.phase !== "gen" && !canHostRelaunch;
      btn.addEventListener("click", () => selectDraftGeneration(cfg.gen));
      genButtons.appendChild(btn);
    }
  }

  if (options) {
    options.innerHTML = "";
    options.classList.toggle("duel-pending", Boolean(draftArenaState.duelMode && draftArenaState.duelPendingSelf));

    if (draftArenaState.phase === "gen") {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      msg.textContent = "Sélectionne d'abord une génération.";
      options.appendChild(msg);
    } else if (draftArenaState.phase === "result" || draftArenaState.phase === "battle") {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      msg.textContent = draftArenaState.evaluating
        ? "Préparation de la run en cours..."
        : draftArenaState.phase === "battle"
          ? (DRAFT_BATTLE_ENABLED ? "Ton équipe est prête. Lance ou poursuis l’arène en cours." : "Draft terminé. Consulte l’analyse de ton équipe ci-dessous.")
          : "Draft terminé. Consulte la run ci-dessous.";
      options.appendChild(msg);
    } else if (!draftArenaState.options.length) {
      const msg = document.createElement("p");
      msg.className = "pokedex-muted";
      // En duel actif : message d'attente du serveur. Sinon : message reset.
      if (draftArenaState.duelMode && draftArenaState.scoreAttackRoom?.duel) {
        msg.textContent = "⏳ Chargement de la wave du duel… Si bloqué, l'hôte peut cliquer sur une génération pour relancer.";
      } else {
        msg.textContent = "Aucune option disponible. Réinitialise le draft.";
      }
      options.appendChild(msg);
    } else {
      let optionIdx = 0;
      for (const option of draftArenaState.options) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "dsc-card" + (option.shiny ? " is-shiny" : "") + (option.locked ? " picked locked" : "");
        card.style.setProperty("--draft-i", String(optionIdx));
        optionIdx += 1;
        const spriteId = getPokemonSpriteId(option.pokemon);
        const normalSprite = getPokemonSprite(option.pokemon);
        const shownSprite = option.shiny ? getPokemonShinySprite(option.pokemon) : normalSprite;
        const sparkle = option.shiny ? '<span class="draft-shiny-mark">&#10024; Shiny</span>' : "";
          const metrics = getDraftCachedPokemonPowerData(option.pokemon);
        const projectedAverage = draftArenaState.team.length < DRAFT_TEAM_SIZE
          ? Math.round((bstMetrics.total + metrics.statGlobal) / Math.max(1, draftArenaState.team.length + 1))
          : bstMetrics.average;
        const bstValue = Number(metrics.statGlobal) || 0;
        const rarity = bstValue >= 600 ? "legendary" : bstValue >= 500 ? "strong" : bstValue >= 400 ? "decent" : "common";
        const optLoading = !DRAFT_POWER_CACHE.has(getDraftPowerCacheKey(option.pokemon));
        card.dataset.rarity = optLoading ? "loading" : rarity;
        if (option.pokemon.type1) card.dataset.type1 = option.pokemon.type1;
        const isScoreAttack = draftArenaState.mode === "scoreAttack";
        const canRerollOption = isScoreAttack && !option.locked && draftArenaState.scoreAttackRerollsLeft > 0 && !draftArenaState.duelMode;
        const rerollBtn = canRerollOption
          ? `<button type="button" class="draft-option-reroll" data-pokemon-id="${option.pokemon.id}" title="Reroll cette option (1 jeton)" aria-label="Reroll ${escapeHtml(option.pokemon.name)}">↻</button>`
          : "";
        card.innerHTML = `
          ${rerollBtn}
          <div class="dsc-top"><span class="dsc-tier">${optLoading ? "\u2026" : escapeHtml(metrics.rarityLabel)}</span><span class="dsc-bst">${optLoading ? "\u2026" : metrics.statGlobal}</span></div>
          <div class="dsc-art"><img src="${shownSprite}" alt="${escapeHtml(option.pokemon.name)}" loading="lazy" data-fallback="${normalSprite}" /></div>
          <strong class="dsc-name">${escapeHtml(option.pokemon.name)}</strong>
          <div class="dsc-proj">Moy. <b>${optLoading ? "\u2026" : projectedAverage}</b></div>
          ${sparkle}
        `;
        card.disabled = Boolean(option.locked);
        if (!option.locked) {
          card.addEventListener("click", (event) => {
            if (event.target?.closest(".draft-option-reroll")) return;
            card.classList.add("picked");
            setTimeout(() => {
              void pickDraftArenaOption(option.pokemon.id);
            }, 140);
          });
          if (canRerollOption) {
            const btn = card.querySelector(".draft-option-reroll");
            if (btn) btn.addEventListener("click", (event) => {
              event.stopPropagation();
              event.preventDefault();
              rerollDraftScoreAttackOption(option.pokemon.id);
            });
          }
        }
        options.appendChild(card);
      }
    }
  }

  if (team) {
    team.innerHTML = "";
    for (let index = 0; index < DRAFT_TEAM_SIZE; index += 1) {
      const member = draftArenaState.team[index];
      if (!member) {
        const empty = document.createElement("div");
        empty.className = "draft-team-card placeholder";
        empty.innerHTML = `
          <div class="draft-team-empty-icon">?</div>
          <div class="draft-team-card-body">
            <small class="draft-team-slot-label">Slot ${index + 1}</small>
            <b>Vide</b>
          </div>
        `;
        team.appendChild(empty);
        continue;
      }

      const normalSprite = getPokemonSprite(member.pokemon);
      const shownSprite = member.shiny ? getPokemonShinySprite(member.pokemon) : normalSprite;
      const item = document.createElement("div");
      const metrics = getDraftCachedPokemonPowerData(member.pokemon);
      const isLatest = index === draftArenaState.team.length - 1;
      const typesHtml = [member.pokemon.type1, member.pokemon.type2].filter(Boolean).map((type) => typeBadgeHtml(type)).join("");
      item.className = "draft-team-card" + (member.shiny ? " is-shiny" : "") + (isLatest ? " is-latest" : " is-filled");
      var __tb = Number(metrics.statGlobal) || 0; item.dataset.rarity = __tb >= 600 ? "legendary" : __tb >= 500 ? "strong" : __tb >= 400 ? "decent" : "common";
      item.innerHTML = `
        <img src="${shownSprite}" alt="${escapeHtml(member.pokemon.name)}" loading="lazy" data-fallback="${normalSprite}" />
        <div class="draft-team-card-body">
          <small class="draft-team-slot-label">Slot ${index + 1}${isLatest ? " • Nouveau" : ""}</small>
          <b>${escapeHtml(member.pokemon.name)}</b>
          <div class="draft-team-card-types">${typesHtml}</div>
          <small>Stat global ${metrics.statGlobal} • ${escapeHtml(metrics.rarityLabel)}</small>
        </div>
      `;
      team.appendChild(item);
    }
  }

  if (teamMetrics) {
    const currentTeamStatGlobal = draftArenaState.team.reduce((sum, member) => sum + (getDraftCachedPokemonPowerData(member.pokemon).statGlobal || 0), 0);
    const currentSynergy = draftArenaState.team.length ? getDraftTeamSynergy(draftArenaState.team.map((member) => ({ ...member, metrics: getDraftCachedPokemonPowerData(member.pokemon) }))) : null;
    teamMetrics.innerHTML = draftArenaState.team.length
      ? `
        <div class="draft-summary-card draft-score-main"><span>Moyenne BST</span><b>${bstMetrics.average}</b><small>${bstMetrics.rank?.label || (bstMetrics.nextTarget ? `${bstMetrics.nextTarget.min - bstMetrics.average} pts avant ${bstMetrics.nextTarget.label}` : "Objectif libre")}</small></div>
        <div class="draft-summary-card"><span>BST total</span><b>${currentTeamStatGlobal}</b></div>
        <div class="draft-summary-card"><span>Synergie</span><b>${draftArenaState.runSummary?.synergyLabel || currentSynergy?.label || "-"}</b></div>
        <div class="draft-summary-card"><span>${draftArenaState.mode === "scoreAttack" ? "Rerolls" : "Région"}</span><b>${draftArenaState.mode === "scoreAttack" ? draftArenaState.scoreAttackRerollsLeft : draftArenaState.selectedGen ? escapeHtml(draftGenLabel(draftArenaState.selectedGen)) : "-"}</b></div>
      `
      : "";
  }

  const scoreHero = document.getElementById("draft-score-hero");
  if (scoreHero) {
    if (draftArenaState.mode === "scoreAttack" && draftArenaState.selectedGen) {
      const avg = bstMetrics.average || 0;
      const pct = avg ? Math.max(4, Math.min(100, Math.round((avg / 600) * 100))) : 0;
      const rec = getDraftScoreAttackRecord(draftArenaState.selectedGen);
      const sub = bstMetrics.nextTarget
        ? (bstMetrics.nextTarget.min - avg) + " pts avant " + escapeHtml(bstMetrics.nextTarget.label)
        : (bstMetrics.rank ? "Palier " + escapeHtml(bstMetrics.rank.label) + " atteint !" : "Commence \u00e0 drafter");
      scoreHero.innerHTML =
        '<div class="dsh-main">' +
          '<div class="dsh-label" title="BST : total des statistiques de base de chaque Pokémon">Puissance moyenne · BST</div>' +
          '<div class="dsh-score">' + (avg || "\u2013") + '</div>' +
          '<div class="dsh-gauge"><span style="width:' + pct + '%"></span></div>' +
          '<div class="dsh-sub">' + sub + '</div>' +
        '</div>' +
        '<div class="dsh-stats">' +
          '<div class="dsh-chip"><span>\ud83c\udfc6 Record G' + draftArenaState.selectedGen + '</span><b>' + (rec || "\u2013") + '</b></div>' +
          (window.__pokedleAuthed ? '<div class="dsh-chip dsh-chip-rank"><span>\ud83c\udfc5 Ton rang</span><b id="dsh-rank-val">\u2026</b></div>' : '') +
          '<div class="dsh-chip"><span>\ud83d\udd04 Relances</span><b>' + draftArenaState.scoreAttackRerollsLeft + '</b></div>' +
          '<div class="dsh-chip dsh-chip-team"><span>\ud83d\udc65 \u00c9quipe</span><b>' + draftArenaState.team.length + '/' + DRAFT_TEAM_SIZE + '</b></div>' +
        '</div>';
      scoreHero.classList.remove("hidden");
      updateDraftRankChip(draftArenaState.selectedGen);
      if (window.__lastDraftAvg != null && avg > window.__lastDraftAvg) { var __sc = scoreHero.querySelector(".dsh-score"); if (__sc) { __sc.classList.remove("is-gain"); void __sc.offsetWidth; __sc.classList.add("is-gain"); } }
      window.__lastDraftAvg = avg;
    } else {
      scoreHero.classList.add("hidden");
      scoreHero.innerHTML = "";
    }
  }

  if (endActions) {
    const isDuelLive = Boolean(draftArenaState.duelMode && draftArenaState.scoreAttackRoom && draftArenaState.scoreAttackRoom.status === "live");
    if (draftFinished && !isDuelLive) {
      const isScore = draftArenaState.mode === "scoreAttack";
      const lbMode = "draft_" + (draftArenaState.selectedGen || "all");
      if (isScore) {
        const avg = bstMetrics.average || 0;
        const rankLabel = getDraftScoreAttackResultLabel(avg);
        const tier = avg >= 600 ? "master" : avg >= 550 ? "elite" : avg >= 500 ? "solide" : "rookie";
        const medal = avg >= 600 ? "👑" : avg >= 550 ? "🏆" : avg >= 500 ? "🥇" : "🎯";
        const isNew = Boolean(draftArenaState.scoreAttackNewRecord);
        const rec = getDraftScoreAttackRecord(draftArenaState.selectedGen);
        const recHtml = isNew
          ? `<div class="dse-record is-new">🎉 Nouveau record !</div>`
          : (rec ? `<div class="dse-record">Record Gen ${draftArenaState.selectedGen} : <b>${rec}</b></div>` : "");
        endActions.innerHTML =
          `<div class="dse-reveal" data-tier="${tier}">` +
            `<div class="dse-badge">${medal}</div>` +
            `<div class="dse-rank">${escapeHtml(rankLabel)}</div>` +
            `<div class="dse-score"><b class="dse-num" data-target="${avg}">0</b><small>Moyenne BST finale</small></div>` +
            recHtml +
            `<div class="dse-buttons">` +
              `<button type="button" class="btn-yellow" data-action="restartDraftArenaRun">🎲 Nouvelle draft</button>` +
              `<button type="button" class="btn-blue" data-action="openLeaderboard" data-args='["${lbMode}"]'>🏆 Classement</button>` +
              `<button type="button" class="btn-ghost" data-action="shareDraftScore">📤 Partager</button>` +
            `</div>` +
          `</div>`;
        endActions.classList.remove("hidden");
        const revealKey = avg + "|" + (isNew ? "R" : "");
        if (endActions.dataset.revealKey !== revealKey) {
          endActions.dataset.revealKey = revealKey;
          try { animateDraftCount(endActions.querySelector(".dse-num"), avg); } catch (e) {}
          if (isNew) { try { launchDraftConfetti(endActions.querySelector(".dse-reveal")); } catch (e) {} }
        }
      } else {
        endActions.innerHTML =
          `<div class="draft-end-headline">🏆 Run terminée</div>` +
          `<div class="draft-end-buttons"><button type="button" class="btn-yellow" data-action="restartDraftArenaRun">🎲 Nouvelle draft</button></div>`;
        endActions.classList.remove("hidden");
      }
    } else {
      endActions.classList.add("hidden");
      endActions.innerHTML = "";
      endActions.dataset.revealKey = "";
    }
  }

  if (resultWrap) {
    resultWrap.classList.toggle("hidden", draftArenaState.phase !== "result" && draftArenaState.phase !== "battle");
  }
  if (resultTitle) {
    resultTitle.textContent = draftArenaState.mode === "scoreAttack" ? "3) Résultat Score Attack" : "3) Résultats des arènes";
  }
  if (runSummary) {
    if (draftArenaState.phase !== "result" && draftArenaState.phase !== "battle") {
      runSummary.innerHTML = "";
    } else if (draftArenaState.evaluating) {
      runSummary.innerHTML = `<div class="draft-summary-card wide"><span>Analyse</span><b>Préparation de la run en cours...</b></div>`;
    } else if (draftArenaState.runSummary) {
      runSummary.innerHTML = `
        <div class="draft-summary-card"><span>Statut</span><b>${escapeHtml(draftArenaState.runSummary.status)}</b></div>
        <div class="draft-summary-card"><span>MVP</span><b>${escapeHtml(draftArenaState.runSummary.mvpName)}</b></div>
        <div class="draft-summary-card"><span>Lecture d'équipe</span><b>${escapeHtml(draftArenaState.runSummary.balanceLabel)}</b></div>
        <div class="draft-summary-card"><span>Tendance</span><b>${escapeHtml(draftArenaState.runSummary.offenseLabel)}</b></div>
      `;
    } else {
      runSummary.innerHTML = "";
    }
  }

}
// Pas de ROMs par défaut hébergées (évite les 404 + souci de copyright) : seul le chargement local est proposé.
const EMU_ROM_OPTIONS = [];

let emulatorCustomRomUrl = "";
let emulatorCustomRomName = "";
let emulatorRunning = false;

function coreFromRomPath(pathOrName) {
  const src = String(pathOrName || "").toLowerCase();
  if (src.endsWith(".nds")) return "nds";
  if (src.endsWith(".gbc") || src.endsWith(".gb")) return "gb";
  return "gba";
}

function controlsHintForCore(core) {
  if (core === "nds") {
    return '<b>Touches DS:</b> <span>Z = A</span> <span>X = B</span> <span>Entrée = Start</span> <span>Shift = Select</span> <span>A = L</span> <span>S = R</span> <span>Flèches = direction</span> <span>Souris = écran tactile</span>';
  }
  if (core === "gb") {
    return '<b>Touches Game Boy:</b> <span>Z = A</span> <span>X = B</span> <span>Entrée = Start</span> <span>Shift = Select</span> <span>Flèches = direction</span>';
  }
  return '<b>Touches GBA:</b> <span>Z = A</span> <span>X = B</span> <span>Entrée = Start</span> <span>Shift = Select</span> <span>A = L</span> <span>S = R</span> <span>Flèches = direction</span>';
}

function renderEmuControlsHint(core) {
  const help = document.getElementById("emu-controls-help");
  if (!help) return;
  help.innerHTML = controlsHintForCore(core);
}

function setEmuStatus(message) {
  const status = document.getElementById("emu-status");
  if (status) status.textContent = message || "";
}

function initEmulatorMode() {
  const select = document.getElementById("emu-rom-select");
  const fileInput = document.getElementById("emu-rom-file");
  if (!select || !fileInput) return;

  select.innerHTML = "";
  for (const rom of EMU_ROM_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = rom.url;
    opt.textContent = `${rom.label} (${rom.core.toUpperCase()})`;
    select.appendChild(opt);
  }
  if (!EMU_ROM_OPTIONS.length) {
    const ph = document.createElement("option");
    ph.value = ""; ph.textContent = "— Charge ta ROM ci-dessous —"; ph.disabled = true; ph.selected = true;
    select.appendChild(ph);
  }

  select.addEventListener("change", () => {
    emulatorCustomRomUrl = "";
    emulatorCustomRomName = "";
    const selected = EMU_ROM_OPTIONS.find((r) => r.url === select.value);
    renderEmuControlsHint(selected?.core || coreFromRomPath(select.value));
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".gba") && !lower.endsWith(".nds") && !lower.endsWith(".gbc") && !lower.endsWith(".gb")) {
      setEmuStatus("Fichier invalide: choisis une ROM .gba, .gbc, .gb ou .nds.");
      return;
    }

    if (emulatorCustomRomUrl) {
      try { URL.revokeObjectURL(emulatorCustomRomUrl); } catch (_err) {}
    }
    emulatorCustomRomUrl = URL.createObjectURL(file);
    emulatorCustomRomName = file.name;

    const core = coreFromRomPath(file.name);
    renderEmuControlsHint(core);
    setEmuStatus(`ROM chargee: ${file.name} (${core.toUpperCase()}). Clique sur Lancer.`);
  });

  renderEmuControlsHint("gba");
  setEmuStatus("Selectionne une ROM puis clique sur Lancer.");
}

function stopEmulatorSession(hardStop = false) {
  const screen = document.getElementById("screen-emulator");
  if (screen) screen.classList.add("hidden");

  const player = document.getElementById("emulator-player");
  if (player) player.innerHTML = "";

  const loader = document.getElementById("emulatorjs-loader");
  if (loader) loader.remove();

  document.querySelectorAll("audio, video").forEach((media) => {
    try {
      media.pause();
      media.src = "";
      media.load();
    } catch (_err) {}
  });

  try {
    delete window.EJS_player;
    delete window.EJS_core;
    delete window.EJS_gameUrl;
    delete window.EJS_startOnLoaded;
    delete window.EJS_defaultControls;
    delete window.EJS_controlScheme;
    delete window.EJS_mouse;
  } catch (_err) {
    window.EJS_player = undefined;
    window.EJS_core = undefined;
    window.EJS_gameUrl = undefined;
    window.EJS_startOnLoaded = undefined;
    window.EJS_defaultControls = undefined;
    window.EJS_controlScheme = undefined;
    window.EJS_mouse = undefined;
  }

  emulatorRunning = false;
  setEmuStatus("Emulateur arrete.");

  if (hardStop) {
    setTimeout(() => { window.location.reload(); }, 20);
  }
}

function closeEmulatorMode() {
  stopEmulatorSession(true);
}

function openEmulatorMode() {
  // Lot D audit : EmulatorJS exige une CSP permissive (unsafe-eval), servie
  // uniquement sur /emulateur. Depuis la page principale (CSP stricte), on
  // navigue en pleine page ; l'écran s'ouvre automatiquement à l'arrivée.
  if (window.location.pathname !== "/emulateur") {
    window.location.assign("/emulateur");
    return;
  }
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-game").classList.add("hidden");
  document.getElementById("screen-ranking").classList.add("hidden");
  document.getElementById("screen-games-ranking").classList.add("hidden");
  document.getElementById("screen-pokedex").classList.add("hidden");
  document.getElementById("screen-type-chart")?.classList.add("hidden");
  document.getElementById("screen-draft-arena").classList.add("hidden");
  document.getElementById("screen-draft-score-attack")?.classList.add("hidden");
  document.getElementById("screen-team-builder")?.classList.add("hidden");
  document.getElementById("screen-teams")?.classList.add("hidden");
  closeRankingPicker();
  stopCrySound();
  setQuizModeLayout(false);

  const screen = document.getElementById("screen-emulator");
  if (screen) screen.classList.remove("hidden");
  setGlobalNavActive("emu");

  const select = document.getElementById("emu-rom-select");
  if (select && !select.options.length) initEmulatorMode();
}

function getSelectedEmuRom() {
  if (emulatorCustomRomUrl) {
    const core = coreFromRomPath(emulatorCustomRomName || emulatorCustomRomUrl);
    return { url: emulatorCustomRomUrl, core, label: emulatorCustomRomName || "ROM locale" };
  }

  const select = document.getElementById("emu-rom-select");
  const url = select ? select.value : "";
  const preset = EMU_ROM_OPTIONS.find((r) => r.url === url);
  if (preset) return preset;

  if (!url) return null;
  return { url, core: coreFromRomPath(url), label: url };
}

function launchSelectedEmuRom() {
  const rom = getSelectedEmuRom();
  if (!rom?.url) {
    setEmuStatus("Charge d'abord ta ROM (.gba, .gbc, .gb ou .nds) via « Charger ma ROM » ci-dessous.");
    return;
  }

  // EmulatorJS ne supporte pas d'être relancé sur la même page (re-déclare EJS_STORAGE -> écran noir).
  // Au 2e lancement, on recharge proprement la page et on reprend la ROM (presets en auto).
  if (window.__emuLoadedOnce) {
    if (emulatorCustomRomUrl) {
      setEmuStatus("Pour relancer une ROM locale, recharge la page (F5) puis recharge ton fichier.");
      return;
    }
    try { sessionStorage.setItem("emu_autostart", rom.url); } catch (e) {}
    setEmuStatus("Redémarrage de l'émulateur…");
    location.reload();
    return;
  }

  if (location.protocol === "file:") {
    setEmuStatus(`Mode file:// detecte. Lancement ${rom.core.toUpperCase()}: si echec, utilise le bouton fichier ou un serveur local.`);
  } else {
    setEmuStatus(`Chargement de l'emulateur ${rom.core.toUpperCase()}...`);
  }

  renderEmuControlsHint(rom.core);

  const player = document.getElementById("emulator-player");
  if (!player) return;

  player.innerHTML = '<div id="emulatorjs"></div>';

  window.EJS_player = "#emulatorjs";
  window.EJS_core = rom.core;
  window.EJS_gameUrl = rom.url;
  window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
  window.EJS_startOnLoaded = true;
  window.EJS_controlScheme = rom.core;
  window.EJS_mouse = rom.core === "nds";
  window.EJS_defaultControls = {
    0: {
      0: { value: "x", value2: "BUTTON_2" },
      2: { value: "shift", value2: "SELECT" },
      3: { value: "enter", value2: "START" },
      4: { value: "up arrow", value2: "DPAD_UP" },
      5: { value: "down arrow", value2: "DPAD_DOWN" },
      6: { value: "left arrow", value2: "DPAD_LEFT" },
      7: { value: "right arrow", value2: "DPAD_RIGHT" },
      8: { value: "z", value2: "BUTTON_1" },
      10: { value: "a", value2: "LEFT_TOP_SHOULDER" },
      11: { value: "s", value2: "RIGHT_TOP_SHOULDER" },
      24: { value: "1" },
      25: { value: "2" },
      27: { value: "space" }
    },
    1: {},
    2: {},
    3: {}
  };

  const oldLoader = document.getElementById("emulatorjs-loader");
  if (oldLoader) oldLoader.remove();

  emulatorRunning = true;

  // Pré-check ROM (HEAD) — détecte ROM 404 / réseau pour message clair
  if (rom.url && /^https?:\/\//i.test(rom.url)) {
    fetch(rom.url, { method: "HEAD", mode: "cors" })
      .then((res) => {
        if (!res.ok) {
          setEmuStatus(`ROM introuvable (${res.status}). Vérifie l'URL ou choisis-en une autre.`);
        }
      })
      .catch(() => {
        setEmuStatus("ROM injoignable. Vérifie ta connexion ou choisis une autre source.");
      });
  }

  const script = document.createElement("script");
  script.id = "emulatorjs-loader";
  script.src = `${window.EJS_pathtodata}loader.js?v=${Date.now()}`;
  script.onload = () => {
    window.__emuLoadedOnce = true;
    setEmuStatus(`Emulateur ${rom.core.toUpperCase()} prêt. Si l'écran reste vide après 10s, recharge la page puis relance.`);
    // Watchdog : si après 12s aucun canvas EmulatorJS n'est apparu, on signale
    setTimeout(() => {
      if (!emulatorRunning) return;
      const playerNode = document.getElementById("emulator-player");
      const hasCanvas = playerNode?.querySelector("canvas, video");
      if (!hasCanvas) {
        setEmuStatus(`Émulateur lancé mais aucun affichage détecté (${rom.core.toUpperCase()}). ROM corrompue ? CDN indisponible ? Essaie de recharger la page.`);
      }
    }, 12000);
  };
  script.onerror = () => {
    emulatorRunning = false;
    setEmuStatus(`Échec de chargement EmulatorJS (${rom.core.toUpperCase()}). CDN injoignable — vérifie ta connexion internet.`);
  };
  document.body.appendChild(script);
}

// Reprise auto de l'émulateur après le reload de relance (presets uniquement).
(function () {
  function emuAutostart() {
    let url = null;
    try { url = sessionStorage.getItem("emu_autostart"); } catch (e) {}
    if (!url) return;
    try { sessionStorage.removeItem("emu_autostart"); } catch (e) {}
    if (!EMU_ROM_OPTIONS.some((r) => r.url === url)) return;
    if (typeof openEmulatorMode === "function") openEmulatorMode();
    const select = document.getElementById("emu-rom-select");
    if (select) select.value = url;
    if (typeof launchSelectedEmuRom === "function") setTimeout(launchSelectedEmuRom, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", emuAutostart);
  else emuAutostart();
})();
// CHALLENGE MODE
