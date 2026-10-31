
// ===== Guessing games in series (31/10/2026) =====
// One mystery at a time felt short: Pokémon pixelisé and Cri now play a series of 10 by default,
// started at once, with 5 / 10 / 20 to pick, a skip button and a summary. Each next mystery is drawn
// by the game's own start function, so its rules (pool, hints, sounds) stay exactly the same.
var GUESS_SERIES_SIZES = [5, 10, 20];
var GUESS_SERIES_MODES = {
  pixel: { start: 'startPixelGame', box: 'pixel-box', one: 'Image', many: 'images', skip: 'Passer l’image', next: 'Image suivante →' },
  cry: { start: 'startCryGame', box: 'cry-box', one: 'Cri', many: 'cris', skip: 'Passer le cri', next: 'Cri suivant →' },
  silhouette: { start: 'startSilhouetteGame', box: 'silhouette-box', one: 'Silhouette', many: 'silhouettes', skip: 'Passer la silhouette', next: 'Silhouette suivante →' },
  description: { start: 'startDescriptionMode', box: 'description-box', one: 'Description', many: 'descriptions', skip: 'Passer la description', next: 'Description suivante →' },
};
// The modes that play in series (Silhouette and Description wait for Kayan's go).
var GUESS_SERIES_ON = ['pixel', 'cry'];
var guessSeries = null;
var guessSeriesAdvancing = false;
var guessSeriesStarts = {};

function guessSeriesSize(mode) {
  try { var n = Number(localStorage.getItem('pokedle.guessSeries.' + mode)); return GUESS_SERIES_SIZES.indexOf(n) >= 0 ? n : 10; } catch (_e) { return 10; }
}
function guessSeriesInParty() { return typeof isPartySessionActive === 'function' && isPartySessionActive(); }
function guessSeriesActive() { return Boolean(guessSeries) && gameMode === guessSeries.mode && !guessSeriesInParty(); }

function guessSeriesBarHtml(s) {
  var cfg = GUESS_SERIES_MODES[s.mode];
  var chips = GUESS_SERIES_SIZES.map(function (n) {
    return '<button type="button" class="pixel-series-chip' + (n === s.total ? ' is-on' : '') + '" aria-pressed="' + (n === s.total) + '" data-action="setGuessSeriesSize" data-args="[' + n + ']">' + n + '</button>';
  }).join('');
  return '<span class="pixel-series-count">' + cfg.one + ' <b>' + s.index + '</b> / ' + s.total + ' · ✓ ' + s.found + '</span>' +
    '<span class="pixel-series-chips" role="group" aria-label="Nombre de ' + cfg.many + ' de la série">' + chips + '</span>';
}
function renderGuessSeriesBar() {
  var bar = document.getElementById('guess-series-bar');
  if (!guessSeriesActive()) { if (bar) bar.remove(); return; }
  var box = document.getElementById(GUESS_SERIES_MODES[guessSeries.mode].box);
  if (bar && box && bar.nextElementSibling !== box) { bar.remove(); bar = null; }
  if (!bar && box) { bar = document.createElement('div'); bar.id = 'guess-series-bar'; bar.className = 'pixel-series-bar'; box.before(bar); }
  if (bar) bar.innerHTML = guessSeriesBarHtml(guessSeries);
}

function guessSeriesNext() {
  if (!guessSeries) return;
  guessSeries.index += 1;
  guessSeries.recorded = false;
  guessSeriesAdvancing = true;
  try { guessSeriesStarts[guessSeries.mode].call(window); } finally { guessSeriesAdvancing = false; }
  renderGuessSeriesBar();
}
window.guessSeriesNext = guessSeriesNext;

function startGuessSeries(mode, total) {
  guessSeries = { mode: mode, total: total || guessSeriesSize(mode), index: 0, found: 0, attemptsWon: 0, rounds: [], xpStart: Number(playerProfile && playerProfile.xp) || 0, recorded: false };
  guessSeriesNext();
}

function setGuessSeriesSize(n) {
  n = Number(n);
  if (GUESS_SERIES_SIZES.indexOf(n) < 0 || !guessSeries) return;
  try { localStorage.setItem('pokedle.guessSeries.' + guessSeries.mode, String(n)); } catch (_e) {}
  // Before the first guess the series just changes length; later, a new series starts.
  if (guessSeries.index === 1 && !gameOver && attempts === 0) { guessSeries.total = n; renderGuessSeriesBar(); return; }
  if (typeof showToast === 'function') showToast('Nouvelle série de ' + n + ' ' + GUESS_SERIES_MODES[guessSeries.mode].many);
  startGuessSeries(guessSeries.mode, n);
}
window.setGuessSeriesSize = setGuessSeriesSize;

function guessSeriesSummaryHtml(s) {
  var avg = s.found ? (s.attemptsWon / s.found).toFixed(1).replace('.', ',') : '—';
  var xp = Math.max(0, (Number(playerProfile && playerProfile.xp) || 0) - s.xpStart);
  var bests = (playerProfile && playerProfile.guessSeriesBest && playerProfile.guessSeriesBest[s.mode]) || {};
  var best = Number(bests[s.total]) || 0;
  var record = s.found > 0 && s.found >= best;
  var dots = s.rounds.map(function (r) { return '<i class="' + (r.won ? 'is-won' : 'is-lost') + '" title="' + escapeHtml(r.name) + '">' + (r.won ? '✓' : '×') + '</i>'; }).join('');
  return '<div id="guess-series-summary" class="pixel-series-summary"><p class="pss-kicker">SÉRIE TERMINÉE</p>' +
    '<div class="pss-score"><b>' + s.found + '</b><span>/ ' + s.total + ' trouvés</span></div>' +
    '<p class="pss-line">' + avg + (s.found && s.attemptsWon / s.found < 2 ? ' essai' : ' essais') + ' en moyenne · +' + xp + ' XP' + (record ? ' · 🏆 Record !' : best ? ' · record : ' + best + ' / ' + s.total : '') + '</p>' +
    '<div class="pss-dots" aria-label="Résultat de chaque partie">' + dots + '</div></div>';
}

GUESS_SERIES_ON.forEach(function (mode) {
  var name = GUESS_SERIES_MODES[mode].start;
  var original = window[name];
  if (typeof original !== 'function') return;
  guessSeriesStarts[mode] = original;
  window[name] = function () {
    if (guessSeriesAdvancing || guessSeriesInParty()) { if (!guessSeriesAdvancing) guessSeries = null; return original.apply(this, arguments); }
    startGuessSeries(mode, guessSeriesSize(mode));
  };
});
if (typeof restartCurrentMode === 'function') {
  var restartBeforeGuessSeries = restartCurrentMode;
  restartCurrentMode = function () {
    if (guessSeriesActive() && gameOver && guessSeries.index < guessSeries.total) { guessSeriesNext(); return; }
    return restartBeforeGuessSeries.apply(this, arguments);
  };
}
if (typeof startGameWithSecret === 'function') {
  var startGameBeforeGuessSeries = startGameWithSecret;
  startGameWithSecret = function () {
    var value = startGameBeforeGuessSeries.apply(this, arguments);
    if (guessSeries && !guessSeriesActive()) guessSeries = null;
    var surrender = document.getElementById('btn-surrender');
    if (surrender) surrender.textContent = guessSeries ? GUESS_SERIES_MODES[guessSeries.mode].skip : 'Abandonner';
    document.getElementById('guess-series-summary')?.remove();
    renderGuessSeriesBar();
    return value;
  };
}
if (typeof renderGameOverBox === 'function') {
  var renderGameOverBeforeGuessSeries = renderGameOverBox;
  renderGameOverBox = function (opts) {
    var value = renderGameOverBeforeGuessSeries.apply(this, arguments);
    var s = guessSeries;
    if (!s || !guessSeriesActive() || !secretPokemon) return value;
    var won = Boolean(opts && opts.won);
    if (!s.recorded) {
      s.recorded = true;
      s.rounds.push({ id: secretPokemon.id, name: secretPokemon.name, won: won });
      if (won) { s.found += 1; s.attemptsWon += Number(attempts) || 0; }
    }
    renderGuessSeriesBar();
    var restart = document.getElementById('btn-restart');
    var last = s.index >= s.total;
    if (restart) restart.innerHTML = last ? '🔁 Nouvelle série' : GUESS_SERIES_MODES[s.mode].next;
    document.getElementById('guess-series-summary')?.remove();
    if (last) {
      var anchor = document.querySelector('#win-box .win-inner') || document.getElementById('win-box');
      if (anchor) anchor.insertAdjacentHTML('afterbegin', guessSeriesSummaryHtml(s));
      if (playerProfile) {
        var all = Object.assign({}, playerProfile.guessSeriesBest || {});
        var bests = Object.assign({}, all[s.mode] || {});
        if (s.found > (Number(bests[s.total]) || 0)) { bests[s.total] = s.found; all[s.mode] = bests; playerProfile.guessSeriesBest = all; try { saveProfile(); } catch (_e) {} }
      }
    }
    return value;
  };
}
