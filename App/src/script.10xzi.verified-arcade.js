// Verified economy for Duel de poids and Shiny ou normal. Local play remains available
// when the service is unavailable, explicitly without Pokédollars/Balls.
const VERIFIED_ARCADE_ERRORS = {
  session_changed: 'Cette partie a changé sur un autre onglet. Reprends la partie.',
  round_changed: 'Cette question a déjà été jouée. Reprends la partie.',
  answer_conflict: 'Une réponse a déjà été enregistrée. Reprends la partie.',
  session_expired: 'Cette partie a expiré. Reprends une partie.',
  account_changed: 'Le compte a changé. Reprends la partie.',
  invalid_generations: 'Sélectionne au moins une génération.',
  rate_limited: 'Un peu trop de demandes. Réessaie dans une minute.'
};
let verifiedWeightLoading = false, verifiedShinyLoading = false;
let weightPrefetch = null;
function verifiedArcadeOnline(mode) {
  return Boolean(ballState && ballState.actionScope && ballState.verifiedModes?.includes(mode));
}
async function verifiedArcadeRequest(action, body) {
  const scope = ballState && ballState.actionScope;
  if (!scope) return {ok:false,error:'account_changed'};
  const data = await ballFetch('/api/arcade/' + action, {...body, actionScope:scope});
  if (ballState?.actionScope !== scope) return {ok:false,error:'account_changed'};
  if (data?.ok) ballApply(data);
  return data;
}
function verifiedArcadeError(data, mode) {
  const code = data && data.error;
  if (typeof showToast === 'function') showToast(VERIFIED_ARCADE_ERRORS[code] || 'Réponse non confirmée. Réessaie : elle ne sera comptée qu’une fois.');
  if (['session_changed','round_changed','answer_conflict','session_expired','account_changed'].includes(code)) {
    const root = document.getElementById(mode === 'weight' ? 'weight-status' : 'shiny-root');
    if (root) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-blue'; b.textContent = 'Reprendre la partie';
      b.addEventListener('click', async () => {
        await refreshBalls({announce:false});
        if (mode === 'weight') startWeightBattle(); else openShinyMode();
      });
      root.appendChild(b);
    }
  }
}
const startWeightBattleLocal = startWeightBattle;
startWeightBattle = function () {
  if (verifiedWeightLoading) return;
  if (!verifiedArcadeOnline('weight') || (typeof partySession !== 'undefined' && partySession?.currentModeKey === 'weight')) return startWeightBattleLocal();
  verifiedWeightLoading = true;
  const modeBefore = gameMode, screenBefore = document.body.dataset.screen;
  if (modeBefore === 'weight' && screenBefore === 'screen-game') {
    const status = document.getElementById('weight-status');
    if (status) status.textContent = 'Chargement du duel…';
  }
  // 4/11 : la question suivante a souvent déjà été demandée pendant que le joueur lisait le résultat.
  const gensKey = [...selectedGens].map(Number).sort().join(',');
  const prefetch = weightPrefetch && weightPrefetch.gens === gensKey ? weightPrefetch.promise : null;
  weightPrefetch = null;
  const pending = weightBattleState && weightBattleState.pending ? weightBattleState.pending : Promise.resolve();
  return pending.then(() => prefetch || verifiedArcadeRequest('start', {mode:'weight',startId:crypto.randomUUID(),gens:[...selectedGens].map(Number)})).then(data => {
    if (gameMode !== modeBefore || document.body.dataset.screen !== screenBefore) return;
    if (!data?.ok) {
      if (modeBefore === 'weight' && screenBefore === 'screen-game') renderWeightBattlePanel();
      verifiedArcadeError(data,'weight'); return;
    }
    const s = data.arcade;
    startWeightBattleLocal();
    weightBattleState = {left:POKEMON_BY_ID.get(s.question.left),right:POKEMON_BY_ID.get(s.question.right),
      revealed:s.phase === 'over',selectedId:s.answer?.choice || null,verified:s,busy:false};
    secretPokemon = s.reveal ? POKEMON_BY_ID.get(s.reveal.correctId) : null;
    gameOver = s.phase === 'over';
    if (playerProfile) playerProfile.weightBattleStreak = s.score;
    renderWeightBattlePanel();
    document.getElementById('weight-status')?.focus({preventScroll:true});
  }).finally(() => { verifiedWeightLoading = false; });
};
const renderWeightBattleLocal = renderWeightBattlePanel;
renderWeightBattlePanel = function () {
  const out = renderWeightBattleLocal.apply(this,arguments), state = weightBattleState;
  if (!state) return out;
  if (!state.verified) {
    if (!partySession) {
      const status = document.getElementById('weight-status');
      if (status) status.textContent += ' · Entraînement sans Pokédollars ni Balls';
    }
    return out;
  }
  document.querySelectorAll('#weight-grid .versus-card').forEach((button,index) => {
    if (state.busy) button.disabled = true;
    button.addEventListener('click', event => {
      if (state.allowLocalCommit) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (state.busy || state.revealed) return;
      state.busy = true;
      const p = index === 0 ? state.left : state.right, s = state.verified;
      // 4/11/2026 : le résultat s'affiche tout de suite (les deux poids sont déjà connus de la page, même règle
      // que le serveur : le plus lourd, égalité pour celui de gauche). Le serveur confirme et compte la série,
      // les Balls et les ₽ en arrière-plan ; s'il voit autre chose, c'est lui qui a raison et l'écran se corrige.
      const localCorrectId = Number(state.left.weight) >= Number(state.right.weight) ? state.left.id : state.right.id;
      const localCorrect = p.id === localCorrectId;
      secretPokemon = POKEMON_BY_ID.get(localCorrectId);
      if (playerProfile && localCorrect) playerProfile.weightBattleStreak = s.score;
      // Juste après ce clic (un clic dans un clic serait ignoré par le navigateur) : moins d'une image d'attente.
      setTimeout(() => {
        if (weightBattleState !== state || state.revealed) return;
        state.allowLocalCommit = true; button.disabled = false; button.click(); state.allowLocalCommit = false;
        setGameCounter(state.verified === s ? (localCorrect ? s.score + 1 : 0) : state.verified.score, "Série");
      }, 0);
      const onScreen = () => weightBattleState === state && gameMode === 'weight' && document.body.dataset.screen === 'screen-game';
      // Réponse perdue sur le réseau : la même réponse repart une fois (le serveur ne la compte qu'une fois).
      const payload = {mode:'weight',sessionId:s.sessionId,round:s.round,choice:p.id};
      state.pending = verifiedArcadeRequest('answer', payload)
        .then(data => data?.ok || (data && data.error) ? data : verifiedArcadeRequest('answer', payload)).then(data => {
        state.busy = false;
        if (!data?.ok) { if (onScreen()) verifiedArcadeError(data,'weight'); return; }
        const result = data.arcade;
        state.verified = result;
        if (playerProfile) playerProfile.weightBattleStreak = result.score;
        if (result.answer.correct !== localCorrect || result.reveal.correctId !== localCorrectId) {
          secretPokemon = POKEMON_BY_ID.get(result.reveal.correctId);
          if (onScreen()) renderWeightBattlePanel();
        }
        if (onScreen()) setGameCounter(result.score, "Série");
        // La question suivante se prépare pendant que le joueur lit le résultat.
        const gens = [...selectedGens].map(Number);
        weightPrefetch = {gens:gens.slice().sort().join(','), promise:verifiedArcadeRequest('start', {mode:'weight',startId:crypto.randomUUID(),gens})};
      }).catch(() => { state.busy = false; });
    },true);
  });
  return out;
};

const openShinyLocal = openShinyMode, restartShinyLocal = restartShinyGame;
const answerShinyLocal = answerShiny, nextShinyLocal = nextShinyRound, renderShinyLocal = renderShinyGame;
function applyVerifiedShiny(data, previous) {
  const s = data.arcade;
  shinyState = {verified:s,phase:s.phase,lives:s.lives,score:s.score,best:previous?.best ?? shinyBest(),recorded:previous?.recorded || false,
    round:{id:s.question.id,image:s.phase === 'playing' ? s.question.image : null,...(s.reveal || {})},
    answer:s.answer ? {saidShiny:s.answer.choice === 'shiny',correct:s.answer.correct} : null};
  renderShinyGame();
}
function startVerifiedShiny(restart) {
  if (verifiedShinyLoading) return;
  verifiedShinyLoading = true;
  const previous = shinyState;
  return verifiedArcadeRequest('start',{mode:'shiny',startId:crypto.randomUUID(),restart}).then(data => {
    if (gameMode !== 'shiny' || document.body.dataset.screen !== 'screen-shiny') return;
    if (!data?.ok) {
      const root = document.getElementById('shiny-root');
      root.innerHTML = '<p class="shiny-status">Impossible de charger la partie.</p>';
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn-blue'; retry.textContent = 'Réessayer';
      retry.addEventListener('click',() => startVerifiedShiny(restart)); root.appendChild(retry);
      verifiedArcadeError(data,'shiny'); return;
    }
    applyVerifiedShiny(data, data.arcade.sessionId === previous?.verified?.sessionId ? previous : null);
  }).finally(() => { verifiedShinyLoading = false; });
}
openShinyMode = function () {
  if (!verifiedArcadeOnline('shiny')) return openShinyLocal();
  trackUsage('solo:shiny'); hideCustomModeSurfaces(); showScreen('screen-shiny'); setGlobalNavActive('game'); gameMode = 'shiny';
  document.getElementById('shiny-root').innerHTML = '<p class="shiny-status">Chargement du Pokémon…</p>';
  return startVerifiedShiny(false);
};
restartShinyGame = function () {
  return verifiedArcadeOnline('shiny') ? startVerifiedShiny(true) : restartShinyLocal();
};
answerShiny = function (choice) {
  const state = shinyState;
  if (!state?.verified) return answerShinyLocal(choice);
  if (verifiedShinyLoading || state.phase !== 'playing' || state.busy || !state.imageReady) return;
  state.busy = true;
  document.querySelectorAll('#shiny-root .shiny-choice').forEach(b => { b.disabled = true; });
  const s = state.verified;
  return verifiedArcadeRequest('answer',{mode:'shiny',sessionId:s.sessionId,round:s.round,choice}).then(data => {
    state.busy = false;
    if (shinyState !== state || gameMode !== 'shiny' || document.body.dataset.screen !== 'screen-shiny') return;
    if (!data?.ok) { renderShinyGame(); verifiedArcadeError(data,'shiny'); return; }
    applyVerifiedShiny(data,state);
    if (shinyState.phase === 'over') { finishShinyGame(shinyState); renderShinyGame(); }
    document.getElementById(shinyState.phase === 'over' ? 'shiny-restart' : 'shiny-next')?.focus({preventScroll:true});
  });
};
nextShinyRound = function () {
  const state = shinyState;
  if (!state?.verified) return nextShinyLocal();
  if (verifiedShinyLoading || state.phase !== 'reveal' || state.busy) return;
  state.busy = true;
  const button = document.getElementById('shiny-next'); if (button) button.disabled = true;
  const s = state.verified;
  return verifiedArcadeRequest('next',{mode:'shiny',sessionId:s.sessionId,round:s.round}).then(data => {
    state.busy = false;
    if (shinyState !== state || gameMode !== 'shiny' || document.body.dataset.screen !== 'screen-shiny') return;
    if (!data?.ok) { renderShinyGame(); verifiedArcadeError(data,'shiny'); return; }
    applyVerifiedShiny(data,state);
  });
};
renderShinyGame = function () {
  const out = renderShinyLocal.apply(this,arguments), state = shinyState, root = document.getElementById('shiny-root');
  if (!root || !state) return out;
  if (!state.verified) {
    const note = document.createElement('p'); note.className = 'shiny-status'; note.textContent = 'Entraînement sans Pokédollars ni Balls'; root.appendChild(note);
  } else if (state.phase === 'playing') {
    const img = root.querySelector('.shiny-art');
    state.imageReady = false;
    const ready = () => {
      if (shinyState !== state) return;
      state.imageReady = true;
      root.querySelectorAll('.shiny-choice').forEach(b => { b.disabled = Boolean(state.busy); });
    };
    root.querySelectorAll('.shiny-choice').forEach(b => { b.disabled = true; });
    if (img) {
      img.addEventListener('load',ready,{once:true});
      img.addEventListener('error',() => {
        if (shinyState !== state) return;
        const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn-blue'; retry.textContent = 'Recharger l’image';
        retry.addEventListener('click',() => renderShinyGame()); root.appendChild(retry);
      },{once:true});
      if (img.complete && img.naturalWidth) ready();
    }
  }
  return out;
};
