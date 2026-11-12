// Duel de poids v2 (maquette validée le 12/11) : le résultat reste lisible et c'est le joueur qui passe à la suite.
// - La fiche « Nouvelle entrée · Pokédex » ne couvre plus le résultat : elle devient une pastille sous la balance
//   (même principe que l'écran de victoire des autres jeux, voir markResultDiscovery).
// - Une phrase compare les deux poids (« 77 fois plus lourd », « 12 kg de plus »).
// - « ✓ Le plus lourd » et « Ton choix » sur les cartes.
// - Le bouton dit « Manche suivante → » après une bonne réponse et « ↻ Nouvelle série » après une erreur ;
//   Entrée ou Espace le déclenchent au clavier.
// Rien ne change dans le tirage, la vérification par le serveur, la série, le record, les Balls et les ₽,
// ni dans les manches de la Party Room (pas de pastille ni de bouton solo pendant une partie de salon).

function poidsKg(value) {
  const n = Number(value);
  return (Number.isInteger(n) ? String(n) : String(n).replace('.', ',')) + ' kg';
}

// La phrase du résultat : le plus lourd, les deux poids, puis l'écart.
function poidsComparison(state, correctId) {
  const heavy = state.left.id === correctId ? state.left : state.right;
  const light = heavy === state.left ? state.right : state.left;
  const h = Number(heavy.weight), l = Number(light.weight);
  if (!(h >= 0) || !(l >= 0)) return '';
  if (h === l) return `${heavy.name} et ${light.name} pèsent tous les deux ${poidsKg(h)}.`;
  const ratio = l > 0 ? h / l : Infinity;
  let gap;
  if (ratio >= 2) gap = `${Math.round(ratio)} fois plus lourd`;
  else gap = `${poidsKg(Math.round((h - l) * 10) / 10)} de plus`;
  return `${heavy.name} pèse ${poidsKg(h)}, ${light.name} ${poidsKg(l)} : ${gap}.`;
}

function poidsSoloResult(state) {
  return Boolean(state?.revealed) && !(typeof partySession !== 'undefined' && partySession?.currentModeKey === 'weight');
}

function poidsDecorate() {
  const box = document.getElementById('weight-box');
  const state = typeof weightBattleState !== 'undefined' ? weightBattleState : null;
  if (!box || box.classList.contains('hidden') || !state?.left || !state?.right) return;
  if (!state.revealed) document.getElementById('weight-new-entry')?.remove();
  const correctId = Number(state.left.weight) >= Number(state.right.weight) ? state.left.id : state.right.id;
  const shownCorrect = typeof secretPokemon !== 'undefined' && secretPokemon?.id ? secretPokemon.id : correctId;
  // Badges sur les cartes.
  box.querySelectorAll('#weight-grid .versus-card').forEach((card, i) => {
    const mon = i === 0 ? state.left : state.right;
    card.querySelectorAll('.pv2-badge').forEach(b => b.remove());
    if (!state.revealed || !mon) return;
    if (mon.id === shownCorrect) card.insertAdjacentHTML('beforeend', '<span class="pv2-badge pv2-heavy">✓ Le plus lourd</span>');
    if (mon.id === state.selectedId) card.insertAdjacentHTML('beforeend', '<span class="pv2-badge pv2-mine">Ton choix</span>');
  });
  if (!state.revealed) return;
  // Entraînement (sans serveur) : la série est mise à jour après l'affichage ; le compteur suit juste après.
  if (!state.verified && poidsSoloResult(state)) setTimeout(() => { if (weightBattleState === state && typeof setGameCounter === 'function') setGameCounter(Number(playerProfile?.weightBattleStreak) || 0, 'Série'); }, 0);
  const won = state.selectedId === shownCorrect;
  const status = document.getElementById('weight-status');
  const sentence = poidsComparison(state, shownCorrect);
  if (status && sentence) {
    const training = /Entraînement sans Pokédollars ni Balls/.test(status.textContent) ? ' · Entraînement sans Pokédollars ni Balls' : '';
    status.textContent = (won ? 'Bien vu ! ' : 'Raté ! ') + sentence + training;
    const detail = document.getElementById('weight-result-detail');
    if (detail && poidsSoloResult(state)) detail.textContent = status.textContent;
  }
  // L'écran descendait jusqu'aux boutons et les deux Pokémon sortaient du haut (téléphone et PC) :
  // on garde la question, les cartes, la balance et « Manche suivante » ensemble.
  if (poidsSoloResult(state) && !state.pv2Scrolled) {
    state.pv2Scrolled = true;
    setTimeout(() => {
      if (weightBattleState !== state) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      (document.getElementById('weight-status') || box).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, 0);
  }
  const restart = document.getElementById('weight-restart');
  if (restart && poidsSoloResult(state)) restart.textContent = won ? 'Manche suivante →' : '↻ Nouvelle série';
}

if (typeof renderWeightBattlePanel === 'function') {
  const poidsRenderBefore = renderWeightBattlePanel;
  renderWeightBattlePanel = function () { const r = poidsRenderBefore.apply(this, arguments); try { poidsDecorate(); } catch (_e) {} return r; };
}

// La découverte d'un Pokémon pendant un Duel de poids solo : une pastille dans le résultat au lieu de la grande fiche.
if (typeof celebrateStandardDiscovery === 'function') {
  const poidsCelebrateBefore = celebrateStandardDiscovery;
  celebrateStandardDiscovery = function (pokemon, mode, at) {
    const box = document.getElementById('weight-box');
    const state = typeof weightBattleState !== 'undefined' ? weightBattleState : null;
    if (mode === 'weight' && pokemon && box && !box.classList.contains('hidden') && poidsSoloResult(state) && Date.now() - (Number(at) || Date.now()) <= 12000) {
      document.getElementById('weight-new-entry')?.remove();
      const dexId = Number(pokemon.baseId || pokemon.id);
      const line = document.createElement('button');
      line.type = 'button';
      line.id = 'weight-new-entry';
      line.className = 'pv2-new-entry';
      line.dataset.action = 'openRegisteredPokemonInPokedex';
      line.dataset.args = JSON.stringify([Number(pokemon.id)]);
      line.innerHTML = `<span>✦ Nouveau au Pokédex</span><b>#${String(dexId).padStart(3, '0')} ${escapeHtml(pokemon.name)}</b><small>Voir la fiche →</small>`;
      const actions = document.getElementById('weight-result-actions');
      if (actions) actions.prepend(line); else box.appendChild(line);
      if (typeof playPokedexUiSfx === 'function') playPokedexUiSfx('register');
      return true;
    }
    return poidsCelebrateBefore.apply(this, arguments);
  };
}

// Entrée ou Espace : manche suivante, seulement quand le résultat solo est affiché et que rien n'est ouvert par-dessus.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const state = typeof weightBattleState !== 'undefined' ? weightBattleState : null;
  if (typeof gameMode === 'undefined' || gameMode !== 'weight' || !poidsSoloResult(state)) return;
  const restart = document.getElementById('weight-restart');
  if (!restart || restart.classList.contains('hidden') || document.getElementById('screen-game')?.classList.contains('hidden')) return;
  const target = event.target;
  if (target && target.closest && target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
  // Une fenêtre ouverte par-dessus (fiche Pokédex, réglages…) garde la main sur le clavier.
  if ([...document.querySelectorAll('[role="dialog"], [aria-modal="true"], .modal-overlay')].some(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed' && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden')) return;
  event.preventDefault();
  restart.click();
});
