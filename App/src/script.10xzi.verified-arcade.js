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
  const modeBefore = gameMode;
  if (typeof showToast === 'function') showToast('Chargement du duel…');
  return verifiedArcadeRequest('start', {mode:'weight',startId:crypto.randomUUID(),gens:[...selectedGens].map(Number)}).then(data => {
    if (!data?.ok) { verifiedArcadeError(data,'weight'); return; }
    if (gameMode !== modeBefore) return;
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
    button.addEventListener('click', async event => {
      if (state.allowLocalCommit) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (state.busy || state.revealed) return;
      state.busy = true;
      document.querySelectorAll('#weight-grid .versus-card').forEach(b => { b.disabled = true; });
      const p = index === 0 ? state.left : state.right, s = state.verified;
      const data = await verifiedArcadeRequest('answer', {mode:'weight',sessionId:s.sessionId,round:s.round,choice:p.id});
      state.busy = false;
      if (weightBattleState !== state || gameMode !== 'weight') return;
      if (!data?.ok) { renderWeightBattlePanel(); verifiedArcadeError(data,'weight'); return; }
      const result = data.arcade;
      secretPokemon = POKEMON_BY_ID.get(result.reveal.correctId);
      // Keep the existing history/XP/result UI, but feed it only a verified answer.
      if (playerProfile && result.answer.correct) playerProfile.weightBattleStreak = result.score - 1;
      state.allowLocalCommit = true; button.disabled = false; button.click(); state.allowLocalCommit = false;
      state.verified = result;
      if (playerProfile) playerProfile.weightBattleStreak = result.score;
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
    if (gameMode !== 'shiny') return;
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
    if (shinyState !== state || gameMode !== 'shiny') return;
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
    if (shinyState !== state || gameMode !== 'shiny') return;
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
