// « Shiny ou normal ? » : an official artwork appears, the player says whether it is the shiny.
// Three lives, one point per good answer. After each answer the normal and the shiny are shown
// side by side, so every round teaches something. Only Pokémon whose shiny clearly differs are
// asked (shiny-pool.json, built by tools/shiny-pool.js).
const SHINY_LIVES = 3;
const SHINY_BEST_KEY = 'pokedle.shinyBest';
const SHINY_RECENT = 40;
let shinyPool = null;
let shinyState = null;

function shinyArtwork(id, shiny) {
  return 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/' + (shiny ? 'shiny/' : '') + Number(id) + '.png';
}
function shinyBest() {
  try { return Math.max(0, Number(localStorage.getItem(SHINY_BEST_KEY)) || 0); } catch (_e) { return 0; }
}
function shinySaveBest(score) {
  try { if (score > shinyBest()) localStorage.setItem(SHINY_BEST_KEY, String(score)); } catch (_e) { /* private mode */ }
}
function shinyName(id) {
  const p = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(id)) : null;
  return p ? p.name : '#' + id;
}

// A Pokémon not seen in the last rounds, shiny one time out of two.
function shinyNextRound(pool, recent, random = Math.random) {
  const fresh = pool.filter((id) => !recent.includes(id));
  const choices = fresh.length ? fresh : pool;
  return { id: choices[Math.floor(random() * choices.length)], shiny: random() < 0.5 };
}

function newShinyState() {
  return { phase: 'playing', lives: SHINY_LIVES, score: 0, best: shinyBest(), round: null, answer: null, recent: [], recorded: false };
}

function shinyStartRound(state) {
  state.round = shinyNextRound(shinyPool, state.recent);
  state.recent = [state.round.id, ...state.recent].slice(0, SHINY_RECENT);
  state.answer = null;
  state.phase = 'playing';
  // The reveal shows both pictures: fetch the other one while the player looks.
  new Image().src = shinyArtwork(state.round.id, !state.round.shiny);
}

async function loadShinyPool() {
  if (shinyPool) return shinyPool;
  const response = await fetch('/shiny-pool.json');
  const data = response.ok ? await response.json() : null;
  const known = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID : null;
  shinyPool = (data && Array.isArray(data.ids) ? data.ids : []).filter((id) => !known || known.has(id));
  return shinyPool;
}

async function openShinyMode() {
  if (typeof trackUsage === 'function') trackUsage('solo:shiny');
  if (typeof hideCustomModeSurfaces === 'function') hideCustomModeSurfaces();
  showScreen('screen-shiny');
  if (typeof setGlobalNavActive === 'function') setGlobalNavActive('game');
  gameMode = 'shiny';
  const root = document.getElementById('shiny-root');
  try { await loadShinyPool(); } catch (_e) { shinyPool = []; }
  if (!shinyPool.length) { if (root) root.innerHTML = '<p class="shiny-status">Impossible de charger les Pokémon. Réessaie dans un moment.</p>'; return; }
  restartShinyGame();
}

function restartShinyGame() {
  if (!shinyPool || !shinyPool.length) return;
  shinyState = newShinyState();
  shinyStartRound(shinyState);
  renderShinyGame();
}

function answerShiny(choice) {
  const state = shinyState;
  if (!state || state.phase !== 'playing') return;
  const saidShiny = choice === 'shiny';
  state.answer = { saidShiny, correct: saidShiny === state.round.shiny };
  if (state.answer.correct) state.score += 1; else state.lives -= 1;
  state.phase = state.lives > 0 ? 'reveal' : 'over';
  if (state.phase === 'over') finishShinyGame(state);
  renderShinyGame();
  document.getElementById(state.phase === 'over' ? 'shiny-restart' : 'shiny-next')?.focus({ preventScroll: true });
}

function nextShinyRound() {
  if (!shinyState || shinyState.phase !== 'reveal') return;
  shinyStartRound(shinyState);
  renderShinyGame();
  document.getElementById('shiny-say-shiny')?.focus({ preventScroll: true });
}

function finishShinyGame(state) {
  if (state.recorded) return;
  state.recorded = true;
  state.newBest = state.score > state.best;
  shinySaveBest(state.score);
  if (typeof recordMatchHistory === 'function') {
    recordMatchHistory({ mode: 'shiny', result: state.score >= 10 ? 'win' : 'loss', attempts: state.score, targetName: 'Score ' + state.score });
  }
}

function shinyHeartsHtml(lives) {
  let hearts = '';
  for (let i = 0; i < SHINY_LIVES; i += 1) hearts += '<span class="' + (i < lives ? 'is-on' : 'is-off') + '">' + (i < lives ? '❤️' : '🤍') + '</span>';
  return '<span class="shiny-lives" aria-label="' + lives + ' vie' + (lives > 1 ? 's' : '') + ' restante' + (lives > 1 ? 's' : '') + '">' + hearts + '</span>';
}

function shinyCompareHtml(round) {
  const side = (shiny) => '<figure class="shiny-side' + (shiny === round.shiny ? ' is-shown' : '') + '">' +
    '<img src="' + escapeHtml(shinyArtwork(round.id, shiny)) + '" alt="' + escapeHtml(shinyName(round.id) + (shiny ? ' shiny' : ' normal')) + '" draggable="false" width="140" height="140">' +
    '<figcaption>' + (shiny ? '✨ Shiny' : 'Normal') + (shiny === round.shiny ? ' · affiché' : '') + '</figcaption></figure>';
  return '<div class="shiny-compare">' + side(false) + side(true) + '</div>';
}

function renderShinyGame() {
  const root = document.getElementById('shiny-root');
  const state = shinyState;
  if (!root || !state || !state.round) return;
  const round = state.round, name = escapeHtml(shinyName(round.id));
  const best = Math.max(state.best, state.score);
  let html = '<div class="shiny-meta">' + shinyHeartsHtml(state.lives) +
    '<span class="tag-tries">Score : <b>' + state.score + '</b></span><span class="tag-gen">Record : ' + best + '</span></div>';
  if (state.phase === 'playing') {
    html += '<div class="shiny-stage"><img class="shiny-art" src="' + escapeHtml(shinyArtwork(round.id, round.shiny)) + '" alt="' + name + '" draggable="false" width="260" height="260"></div>' +
      '<p class="shiny-question">' + name + ' : <b>shiny ou normal ?</b></p>' +
      '<div class="shiny-choices">' +
      '<button type="button" id="shiny-say-shiny" class="shiny-choice is-shiny" data-action="answerShiny" data-args=\'["shiny"]\'>✨ Shiny</button>' +
      '<button type="button" id="shiny-say-normal" class="shiny-choice" data-action="answerShiny" data-args=\'["normal"]\'>Normal</button></div>';
  } else {
    const answer = state.answer;
    const truth = round.shiny ? 'la version shiny' : 'la version normale';
    html += '<p class="shiny-verdict ' + (answer.correct ? 'is-good' : 'is-bad') + '" role="status">' +
      (answer.correct ? '✅ Bien vu ! C’était ' + truth + '.' : '❌ Raté : c’était ' + truth + '.') + '</p>' +
      '<p class="shiny-question">' + name + '</p>' + shinyCompareHtml(round);
    if (state.phase === 'reveal') {
      html += '<div class="shiny-choices"><button type="button" id="shiny-next" class="btn-blue" data-action="nextShinyRound">Suivant →</button></div>';
    } else {
      html += '<div class="shiny-over"><p><b>Partie terminée : ' + state.score + ' bonne' + (state.score > 1 ? 's' : '') + ' réponse' + (state.score > 1 ? 's' : '') + '.</b>' +
        (state.newBest ? ' Nouveau record ! 🎉' : ' Record : ' + best + '.') + '</p>' +
        '<div class="shiny-choices"><button type="button" id="shiny-restart" class="btn-blue" data-action="restartShinyGame">🔁 Rejouer</button>' +
        '<button type="button" class="btn-ghost" data-action="goToConfig">Autres jeux</button></div></div>';
    }
  }
  root.innerHTML = html;
}

// S or N to answer, Enter for the next Pokémon, from the keyboard.
document.addEventListener('keydown', (event) => {
  if (!shinyState || document.getElementById('screen-shiny')?.classList.contains('hidden')) return;
  if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
  const key = event.key.toLowerCase();
  if (shinyState.phase === 'playing' && (key === 's' || key === 'n')) { event.preventDefault(); answerShiny(key === 's' ? 'shiny' : 'normal'); }
});
