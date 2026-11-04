// 🔒 Pokémon pixelisé et Zoom progressif vérifiés par le serveur (4/11/2026).
// Hors Party Room, le serveur tire le mystère et garde la réponse : la page reçoit une image sous une
// adresse opaque, envoie chaque essai et reçoit les mêmes pastilles que le Pokémon du jour. La 1re partie
// du jour de chaque mode rapporte sa Ball et ses ₽ (payés par le serveur, plus déclarés par la page).
// Si le service ne répond pas : partie d'entraînement locale, sans ₽ ni Ball, comme avant.
let verifiedGuess = null;
let verifiedGuessResumed = {};

// Pendant le chargement, une image vide garde la case visible (pas de saut de mise en page).
const VERIFIED_GUESS_LOADING = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
function verifiedGuessImage(mode) {
  if (!verifiedGuess || verifiedGuess.mode !== mode || gameMode !== mode) return "";
  return verifiedGuess.image || VERIFIED_GUESS_LOADING;
}
function verifiedGuessActive() {
  return Boolean(verifiedGuess && verifiedGuess.sessionId && gameMode === verifiedGuess.mode && !secretPokemon && !gameOver);
}
function verifiedGuessControls(busy, label) {
  for (const id of ["guess-input", "btn-submit", "btn-surrender"]) { const node = document.getElementById(id); if (node) node.disabled = Boolean(busy); }
  const submit = document.getElementById("btn-submit");
  if (submit) { submit.textContent = busy && label ? label : "Deviner"; if (busy) submit.setAttribute("aria-busy", "true"); else submit.removeAttribute("aria-busy"); }
}
function verifiedGuessPanels() {
  if (typeof updatePixelPanel === "function") updatePixelPanel(false);
  if (typeof updateSilhouettePanel === "function") updateSilhouettePanel(false);
}
// Ajoute les essais que le serveur connaît et que la page n'a pas encore affichés (reprise, réponse rejouée).
function verifiedGuessApplyRows(view, animate) {
  const rows = Array.isArray(view.rows) ? view.rows : [];
  for (let i = resultHistory.length; i < rows.length; i += 1) {
    const row = rows[i], pokemon = POKEMON_BY_ID.get(row.pokemonId);
    if (!pokemon) continue;
    resultHistory.push({ pokemon, cmp: row.cmp });
    guessedNames.push(pokemon.name); guessedSet.add(pokemon.name);
    addRow(pokemon, row.cmp, row, { animate: animate && i === rows.length - 1 });
  }
  attempts = rows.length;
  setGameCounter(attempts);
  document.getElementById("results-wrap")?.classList.toggle("hidden", attempts === 0);
  guessCache.clear();
  verifiedGuessPanels();
}
function verifiedGuessFinish(view) {
  const answer = POKEMON_BY_ID.get(view.answerId);
  if (!answer) return;
  secretPokemon = answer;
  gameOver = true;
  if (view.won) { showWin(); return; }
  renderGameOverBox({ won: false });
  if (typeof stopCrySound === "function") stopCrySound();
  recordMatchHistory({ mode: gameMode, result: "loss", attempts, targetName: answer.name });
  clearSavedGame();
}
function verifiedGuessLocal(mode, pool, reason) {
  verifiedGuess = null;
  verifiedGuessControls(false);
  if (reason && typeof showToast === "function") showToast(reason);
  gameMode = mode;
  startGameWithSecret(pickRandomPokemonFromPool(pool) || pool[0], pool);
}

// Appelé par startPixelGame / startSilhouetteGame : true quand le serveur prend la partie.
function verifiedGuessStart(mode, pool) {
  verifiedGuess = null;
  if (typeof isPartySessionActive === "function" && isPartySessionActive()) return false;
  if (typeof verifiedArcadeOnline !== "function" || !verifiedArcadeOnline(mode)) return false;
  const ticket = {};
  verifiedGuess = { mode, ticket, sessionId: null, image: "" };
  startGameWithSecret(null, pool);
  verifiedGuessControls(true, "Chargement…");
  // Après un rechargement, la partie en cours reprend ; ensuite, chaque mystère est neuf.
  const restart = Boolean(verifiedGuessResumed[mode]);
  verifiedGuessResumed[mode] = true;
  verifiedArcadeRequest("start", { mode, startId: crypto.randomUUID(), gens: [...selectedGens].map(Number), restart }).then((data) => {
    if (!verifiedGuess || verifiedGuess.ticket !== ticket || gameMode !== mode) return;
    if (!data || !data.ok || !data.arcade || !data.arcade.image) {
      verifiedGuessLocal(mode, pool, "Le serveur ne répond pas : partie d’entraînement, sans Pokédollars ni Ball.");
      return;
    }
    const view = data.arcade;
    verifiedGuess = { mode, ticket, sessionId: view.sessionId, image: view.image };
    verifiedGuessControls(false);
    verifiedGuessApplyRows(view, false);
    if (view.phase === "over") verifiedGuessFinish(view);
    else if (window.matchMedia("(min-width: 641px)").matches) document.getElementById("guess-input")?.focus({ preventScroll: true });
  }).catch(() => {
    if (verifiedGuess && verifiedGuess.ticket === ticket && gameMode === mode) verifiedGuessLocal(mode, pool, "Le serveur ne répond pas : partie d’entraînement, sans Pokédollars ni Ball.");
  });
  return true;
}

function verifiedGuessSend(action, extra, raw) {
  const vg = verifiedGuess;
  if (!vg || vg.busy) return Promise.resolve(false);
  vg.busy = true;
  verifiedGuessControls(true, action === "abandon" ? "…" : "Vérification…");
  return verifiedArcadeRequest(action, { mode: vg.mode, sessionId: vg.sessionId, round: 0, ...extra }).then((data) => {
    if (verifiedGuess !== vg || gameMode !== vg.mode) return false;
    vg.busy = false;
    verifiedGuessControls(false);
    if (!data || !data.ok || !data.arcade) {
      const input = document.getElementById("guess-input");
      if (raw && input && !input.value) input.value = raw;
      const code = data && data.error;
      showErr(code === "session_changed" || code === "session_expired" ? "Cette partie a changé. Relance une partie." : code === "rate_limited" ? "Un peu trop d’essais d’un coup. Réessaie dans une minute." : "Essai non confirmé par le serveur. Réessaie : il ne comptera qu’une fois.");
      return false;
    }
    verifiedGuessApplyRows(data.arcade, action === "answer");
    if (data.arcade.phase === "over") verifiedGuessFinish(data.arcade);
    else if (typeof saveCurrentGame === "function") saveCurrentGame();
    return true;
  }).catch(() => {
    if (verifiedGuess === vg) { vg.busy = false; verifiedGuessControls(false); showErr("Essai non confirmé par le serveur. Réessaie : il ne comptera qu’une fois."); }
    return false;
  });
}
function verifiedGuessSubmit(found, raw) {
  if (guessedSet.has(found.name)) { showErr(`Tu as déjà proposé ${found.name} !`); return; }
  const input = document.getElementById("guess-input");
  if (input) input.value = "";
  return verifiedGuessSend("answer", { choice: found.id }, raw);
}
function verifiedGuessAbandon() { return verifiedGuessSend("abandon", {}); }
