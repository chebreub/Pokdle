
// ===== Wordle Pokémon en entraînement (31/10/2026) =====
// The daily Wordle is played once a day, checked by the server. To practise, the same grid runs
// in the page with a random Pokémon: a series of 5 names by default, 1 / 5 / 10 / ∞ to pick, the
// generations chosen, a summary. Nothing here counts for the rankings, so nothing needs hiding.
var WORDLE_TRAINING_SIZES = [1, 5, 10, 0]; // 0 = no end: names follow until the player stops
var WORDLE_TRAINING_KEY = 'pokedle.wordleTrainingSize';
var wordleTraining = null;

// Same letter rules as the server (lib/daily-wordle.js).
function wordleTrainingLetters(name) { return wordleNormalize(name); }
function wordleTrainingPattern(name) {
  return [...String(name).normalize('NFD').replace(/[̀-ͯ]/g, '')].map(function (c) { return wordleNormalize(c) ? '_' : /\s/.test(c) ? ' ' : c; }).join('').trim();
}
function wordleTrainingCompare(guess, answer) {
  var result = Array(guess.length).fill('absent'), remaining = new Map();
  for (var i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) result[i] = 'exact';
    else remaining.set(answer[i], (remaining.get(answer[i]) || 0) + 1);
  }
  for (var j = 0; j < guess.length; j++) if (result[j] !== 'exact' && remaining.get(guess[j]) > 0) { result[j] = 'present'; remaining.set(guess[j], remaining.get(guess[j]) - 1); }
  return result;
}

function wordleTrainingSize() {
  try { var raw = localStorage.getItem(WORDLE_TRAINING_KEY); var n = raw === null ? 5 : Number(raw); return WORDLE_TRAINING_SIZES.indexOf(n) >= 0 ? n : 5; } catch (_e) { return 5; }
}
// A name to find: a base Pokémon of the chosen generations, 4 to 12 letters, not seen in this series.
function wordleTrainingPick(seen) {
  var pool = getPoolFromSelectedGens().filter(function (p) { var n = wordleTrainingLetters(p.name).length; return !p.isAltForm && Number(p.id) <= 1025 && n >= 4 && n <= 12; });
  if (!pool.length) return null;
  for (var i = 0; i < 30; i++) { var p = pool[Math.floor(Math.random() * pool.length)]; if (seen.indexOf(p.id) < 0 || i === 29) return p; }
  return pool[0];
}

function startWordleTraining(total) {
  ensureDailyWordleScreen();
  if (typeof closeOverlayModal === 'function') closeOverlayModal();
  showScreen('screen-wordle');
  if (typeof setGlobalNavActive === 'function') setGlobalNavActive('game');
  wordleTraining = { total: total === undefined ? wordleTrainingSize() : Number(total), index: 0, found: 0, attemptsWon: 0, rounds: [], seen: [], xpStart: Number(playerProfile && playerProfile.xp) || 0, ended: false };
  wordleTrainingNext();
}
window.startWordleTraining = startWordleTraining;

function wordleTrainingNext() {
  var t = wordleTraining; if (!t) return;
  var p = wordleTrainingPick(t.seen);
  if (!p) { if (typeof showToast === 'function') showToast('Sélectionne au moins une génération !'); return; }
  t.index += 1; t.seen.push(p.id);
  var letters = wordleTrainingLetters(p.name);
  dailyWordleState = { training: true, accountId: dailyObservedAccountId(), get day() { return getDailyDateKey(); }, number: 0, length: letters.length, pattern: wordleTrainingPattern(p.name), rows: [], attempts: 0, maxTries: 6,
    finished: false, won: false, status: 'playing', answerId: p.id, answerName: p.name, points: 0 };
  var input = document.getElementById('wordle-input'); if (input) input.value = '';
  document.getElementById('wordle-result')?.classList.add('hidden');
  renderDailyWordle();
  try { document.getElementById('wordle-input').focus({ preventScroll: true }); } catch (_e) {}
}
window.wordleTrainingNext = wordleTrainingNext;

function setWordleTrainingSize(n) {
  n = Number(n);
  if (WORDLE_TRAINING_SIZES.indexOf(n) < 0) return;
  try { localStorage.setItem(WORDLE_TRAINING_KEY, String(n)); } catch (_e) {}
  if (!wordleTraining) return;
  var fresh = wordleTraining.index === 1 && dailyWordleState && !dailyWordleState.finished && !dailyWordleState.attempts;
  if (fresh) { wordleTraining.total = n; renderDailyWordle(); return; }
  if (typeof showToast === 'function') showToast(n ? 'Nouvelle série de ' + n + ' nom' + (n > 1 ? 's' : '') : 'Série sans fin : enchaîne autant que tu veux');
  startWordleTraining(n);
}
window.setWordleTrainingSize = setWordleTrainingSize;

function endWordleTraining() { if (!wordleTraining) return; wordleTraining.ended = true; renderDailyWordle(); }
window.endWordleTraining = endWordleTraining;

function wordleTrainingSummaryHtml(t) {
  var avg = t.found ? (t.attemptsWon / t.found).toFixed(1).replace('.', ',') : '—';
  var xp = Math.max(0, (Number(playerProfile && playerProfile.xp) || 0) - t.xpStart);
  var dots = t.rounds.map(function (r) { return '<i class="' + (r.won ? 'is-won' : 'is-lost') + '" title="' + escapeHtml(r.name) + '">' + (r.won ? '✓' : '×') + '</i>'; }).join('');
  return '<div class="pixel-series-summary wordle-training-summary"><p class="pss-kicker">SÉRIE TERMINÉE</p>' +
    '<div class="pss-score"><b>' + t.found + '</b><span>/ ' + t.rounds.length + ' trouvé' + (t.found > 1 ? 's' : '') + '</span></div>' +
    '<p class="pss-line">' + avg + (t.found && t.attemptsWon / t.found < 2 ? ' essai' : ' essais') + ' en moyenne · +' + xp + ' XP</p><div class="pss-dots">' + dots + '</div></div>';
}

function wordleTrainingBarHtml(t) {
  var chips = WORDLE_TRAINING_SIZES.map(function (n) {
    return '<button type="button" class="pixel-series-chip' + (n === t.total ? ' is-on' : '') + '" aria-pressed="' + (n === t.total) + '" data-action="setWordleTrainingSize" data-args="[' + n + ']">' + (n || '∞') + '</button>';
  }).join('');
  return '<span class="pixel-series-count">Nom <b>' + t.index + '</b>' + (t.total ? ' / ' + t.total : '') + ' · ✓ ' + t.found + '</span><span class="pixel-series-chips" role="group" aria-label="Nombre de noms de la série">' + chips + '</span>';
}

// The page plays the guesses itself while training; the daily Wordle still asks the server.
if (typeof wordleRequest === 'function') {
  var wordleRequestBeforeTraining = wordleRequest;
  wordleRequest = async function (action, pokemonId) {
    var s = dailyWordleState;
    if (!s || !s.training) return wordleRequestBeforeTraining.apply(this, arguments);
    if (s.finished) return true;
    var answer = wordleTrainingLetters(s.answerName);
    if (action === '/guess') {
      var p = POKEMON_BY_ID.get(Number(pokemonId));
      if (!p) return false;
      var letters = wordleTrainingLetters(p.name);
      s.rows.push({ name: p.name, pokemonId: p.id, letters: letters, colors: wordleTrainingCompare(letters, answer), pattern: wordleTrainingPattern(p.name) });
      s.attempts += 1;
      if (letters === answer) { s.finished = true; s.won = true; s.status = 'won'; }
      else if (s.attempts >= s.maxTries) { s.finished = true; s.status = 'lost'; }
    } else if (action === '/abandon') { s.finished = true; s.status = 'abandoned'; }
    if (s.finished && wordleTraining) {
      wordleTraining.rounds.push({ name: s.answerName, won: s.won });
      if (s.won) {
        wordleTraining.found += 1; wordleTraining.attemptsWon += s.attempts;
        if (typeof awardXp === 'function') awardXp(Math.max(5, 25 - 3 * (s.attempts - 1)), 'Wordle', 'wordletrain');
      }
      if (wordleTraining.total && wordleTraining.index >= wordleTraining.total) wordleTraining.ended = true;
    }
    renderDailyWordle();
    if (action === '/guess') wordleMarkNewRow();
    return true;
  };
}
if (typeof confirmWordleAbandon === 'function') {
  var confirmWordleAbandonBeforeTraining = confirmWordleAbandon;
  confirmWordleAbandon = function () {
    if (dailyWordleState && dailyWordleState.training) { wordleRequest('/abandon'); return; }
    return confirmWordleAbandonBeforeTraining.apply(this, arguments);
  };
}
if (typeof startDailyWordle === 'function') {
  var startDailyWordleBeforeTraining = startDailyWordle;
  startDailyWordle = function () { wordleTraining = null; return startDailyWordleBeforeTraining.apply(this, arguments); };
}
// The heading says « Wordle Pokémon » while training, and gets its daily words back afterwards.
function wordleTrainingTexts(on) {
  var heading = document.querySelector('#screen-wordle .wordle-heading h1');
  var lead = document.querySelector('#screen-wordle .wordle-heading p:not(.wordle-kicker)');
  [[heading, 'Wordle Pokémon'], [lead, 'Un Pokémon au hasard dans tes générations. Six essais pour déchiffrer son nom.']].forEach(function (pair) {
    var node = pair[0]; if (!node) return;
    if (node.dataset.dailyText === undefined) node.dataset.dailyText = node.textContent;
    node.textContent = on ? pair[1] : node.dataset.dailyText;
  });
}
if (typeof renderDailyWordle === 'function') {
  var renderDailyWordleBeforeTraining = renderDailyWordle;
  renderDailyWordle = function () {
    var value = renderDailyWordleBeforeTraining.apply(this, arguments);
    var s = dailyWordleState, t = wordleTraining, screen = document.getElementById('screen-wordle');
    var training = Boolean(s && s.training && t);
    if (screen) screen.classList.toggle('is-training', training);
    var bar = document.getElementById('wordle-training-bar');
    if (!training) {
      if (bar) bar.remove();
      wordleTrainingTexts(false);
      // The daily Wordle, once over, opens the way to practice.
      var result = document.getElementById('wordle-result');
      if (s && s.finished && result && !result.querySelector('[data-action="startWordleTraining"]')) result.insertAdjacentHTML('beforeend', '<div class="wordle-result-actions wordle-train-cta"><button type="button" class="btn-ghost" data-action="startWordleTraining">🔁 S’entraîner en illimité</button></div>');
      return value;
    }
    document.getElementById('wordle-day').textContent = 'ENTRAÎNEMENT · HORS CLASSEMENT';
    wordleTrainingTexts(true);
    if (!bar) { bar = document.createElement('div'); bar.id = 'wordle-training-bar'; bar.className = 'pixel-series-bar wordle-training-bar'; document.getElementById('wordle-message')?.before(bar); }
    bar.innerHTML = wordleTrainingBarHtml(t);
    var res = document.getElementById('wordle-result');
    if (s.finished && res) {
      // The daily result speaks of points and of the next stage: a practice result says only what happened.
      var p = POKEMON_BY_ID.get(Number(s.answerId));
      var more = !t.ended;
      res.innerHTML = '<p class="wordle-kicker">' + (s.won ? 'NOM DÉCHIFFRÉ !' : 'LE MYSTÈRE EST RÉVÉLÉ') + '</p><div class="wordle-answer">' +
        (p ? '<img src="' + escapeHtml(getPokemonSprite(p)) + '" alt="" width="80" height="80">' : '') + '<div><h2>' + escapeHtml(s.answerName) + '</h2><p>' +
        (s.won ? 'Trouvé en ' + s.attempts + ' essai' + (s.attempts > 1 ? 's' : '') + '.' : s.status === 'abandoned' ? 'Tu as choisi de révéler le nom.' : 'Les six essais sont passés.') + '</p></div></div>';
      res.insertAdjacentHTML('beforeend', (t.ended ? wordleTrainingSummaryHtml(t) : '') + '<div class="wordle-result-actions">' +
        (more ? '<button type="button" class="btn-blue" data-action="wordleTrainingNext">Nom suivant →</button>' + (t.total ? '' : '<button type="button" class="btn-ghost" data-action="endWordleTraining">Terminer la série</button>')
          : '<button type="button" class="btn-blue" data-action="startWordleTraining">🔁 Nouvelle série</button><button type="button" class="btn-ghost" data-action="openAllModesScreen" data-args=\'["solo"]\'>Changer de jeu</button>') + '</div>');
      wordleMessage(s.won ? 'Bravo !' : 'Le nom était ' + s.answerName + '.');
    } else if (!s.finished) wordleMessage((s.maxTries - s.attempts) + ' essai' + (s.maxTries - s.attempts > 1 ? 's' : '') + ' restant' + (s.maxTries - s.attempts > 1 ? 's' : ''));
    return value;
  };
}
