
// ===== Pokémon pixelisé en série (31/10/2026) =====
// One image at a time felt short: a game is now a series of 10 images by default, started at once,
// with 5 / 10 / 20 to pick. « Passer l'image » skips one, and a summary ends the series.
var PIXEL_SERIES_SIZES = [5, 10, 20];
var PIXEL_SERIES_KEY = 'pokedle.pixelSeriesSize';
var pixelSeries = null;

function pixelSeriesSize() {
  try { var n = Number(localStorage.getItem(PIXEL_SERIES_KEY)); return PIXEL_SERIES_SIZES.indexOf(n) >= 0 ? n : 10; } catch (_e) { return 10; }
}
function pixelSeriesInParty() { return typeof isPartySessionActive === 'function' && isPartySessionActive(); }

function pixelSeriesBarHtml(s) {
  var chips = PIXEL_SERIES_SIZES.map(function (n) {
    return '<button type="button" class="pixel-series-chip' + (n === s.total ? ' is-on' : '') + '" aria-pressed="' + (n === s.total) + '" data-action="setPixelSeriesSize" data-args="[' + n + ']">' + n + '</button>';
  }).join('');
  return '<span class="pixel-series-count">Image <b>' + s.index + '</b> / ' + s.total + ' · ✓ ' + s.found + '</span>' +
    '<span class="pixel-series-chips" role="group" aria-label="Nombre d’images de la série">' + chips + '</span>';
}
function renderPixelSeriesBar() {
  var box = document.getElementById('pixel-box');
  var bar = document.getElementById('pixel-series-bar');
  var on = Boolean(pixelSeries) && gameMode === 'pixel' && !pixelSeriesInParty();
  if (!on) { if (bar) bar.remove(); return; }
  if (!bar && box) { bar = document.createElement('div'); bar.id = 'pixel-series-bar'; bar.className = 'pixel-series-bar'; box.before(bar); }
  if (bar) bar.innerHTML = pixelSeriesBarHtml(pixelSeries);
}

function pixelSeriesNext() {
  var pool = getPoolFromSelectedGens();
  if (!pool.length) { showToast('Sélectionne au moins une génération !'); return; }
  var secret = null;
  for (var i = 0; i < 25 && !secret; i += 1) {
    var pick = pickRandomPokemonFromPool(pool) || pool[0];
    if (pixelSeries.seen.indexOf(pick.id) < 0 || i === 24) secret = pick;
  }
  pixelSeries.index += 1;
  pixelSeries.seen.push(secret.id);
  pixelSeries.recorded = false;
  gameMode = 'pixel';
  startGameWithSecret(secret, pool);
  renderPixelSeriesBar();
}
window.pixelSeriesNext = pixelSeriesNext;

function startPixelSeries(total) {
  pixelSeries = { total: total || pixelSeriesSize(), index: 0, found: 0, attemptsWon: 0, skipped: 0, seen: [], rounds: [], xpStart: Number(playerProfile && playerProfile.xp) || 0, recorded: false };
  pixelSeriesNext();
}

function setPixelSeriesSize(n) {
  n = Number(n);
  if (PIXEL_SERIES_SIZES.indexOf(n) < 0) return;
  try { localStorage.setItem(PIXEL_SERIES_KEY, String(n)); } catch (_e) {}
  if (!pixelSeries) return;
  // Before the first guess the series just changes length; later, a new series starts.
  if (pixelSeries.index === 1 && !gameOver && attempts === 0) { pixelSeries.total = n; renderPixelSeriesBar(); return; }
  if (typeof showToast === 'function') showToast('Nouvelle série de ' + n + ' images');
  startPixelSeries(n);
}
window.setPixelSeriesSize = setPixelSeriesSize;

function pixelSeriesSummaryHtml(s) {
  var avg = s.found ? (s.attemptsWon / s.found).toFixed(1).replace('.', ',') : '—';
  var xp = Math.max(0, (Number(playerProfile && playerProfile.xp) || 0) - s.xpStart);
  var best = Number(playerProfile && playerProfile.pixelSeriesBest && playerProfile.pixelSeriesBest[s.total]) || 0;
  var record = s.found > 0 && s.found >= best;
  var dots = s.rounds.map(function (r) { return '<i class="' + (r.won ? 'is-won' : 'is-lost') + '" title="' + escapeHtml(r.name) + '">' + (r.won ? '✓' : '×') + '</i>'; }).join('');
  return '<div id="pixel-series-summary" class="pixel-series-summary"><p class="pss-kicker">SÉRIE TERMINÉE</p>' +
    '<div class="pss-score"><b>' + s.found + '</b><span>/ ' + s.total + ' trouvés</span></div>' +
    '<p class="pss-line">' + avg + (s.found && s.attemptsWon / s.found < 2 ? ' essai' : ' essais') + ' en moyenne · +' + xp + ' XP' + (record ? ' · 🏆 Record !' : best ? ' · record : ' + best + ' / ' + s.total : '') + '</p>' +
    '<div class="pss-dots" aria-label="Résultat de chaque image">' + dots + '</div></div>';
}

if (typeof startPixelGame === 'function') {
  var startPixelGameBeforeSeries = startPixelGame;
  startPixelGame = function () {
    if (pixelSeriesInParty()) { pixelSeries = null; return startPixelGameBeforeSeries.apply(this, arguments); }
    startPixelSeries(pixelSeriesSize());
  };
}
if (typeof restartCurrentMode === 'function') {
  var restartBeforePixelSeries = restartCurrentMode;
  restartCurrentMode = function () {
    if (gameMode === 'pixel' && pixelSeries && gameOver && pixelSeries.index < pixelSeries.total && !pixelSeriesInParty()) { pixelSeriesNext(); return; }
    return restartBeforePixelSeries.apply(this, arguments);
  };
}
if (typeof startGameWithSecret === 'function') {
  var startGameBeforePixelSeries = startGameWithSecret;
  startGameWithSecret = function () {
    var value = startGameBeforePixelSeries.apply(this, arguments);
    if (gameMode !== 'pixel' || pixelSeriesInParty()) pixelSeries = null;
    var surrender = document.getElementById('btn-surrender');
    if (surrender) surrender.textContent = pixelSeries ? 'Passer l’image' : 'Abandonner';
    document.getElementById('pixel-series-summary')?.remove();
    renderPixelSeriesBar();
    return value;
  };
}
if (typeof renderGameOverBox === 'function') {
  var renderGameOverBeforePixelSeries = renderGameOverBox;
  renderGameOverBox = function (opts) {
    var value = renderGameOverBeforePixelSeries.apply(this, arguments);
    var s = pixelSeries;
    if (!s || gameMode !== 'pixel' || pixelSeriesInParty() || !secretPokemon) return value;
    var won = Boolean(opts && opts.won);
    if (!s.recorded) {
      s.recorded = true;
      s.rounds.push({ id: secretPokemon.id, name: secretPokemon.name, won: won });
      if (won) { s.found += 1; s.attemptsWon += Number(attempts) || 0; } else s.skipped += 1;
    }
    renderPixelSeriesBar();
    var restart = document.getElementById('btn-restart');
    var last = s.index >= s.total;
    if (restart) restart.innerHTML = last ? '🔁 Nouvelle série' : 'Image suivante →';
    document.getElementById('pixel-series-summary')?.remove();
    if (last) {
      var anchor = document.querySelector('#win-box .win-inner') || document.getElementById('win-box');
      if (anchor) anchor.insertAdjacentHTML('afterbegin', pixelSeriesSummaryHtml(s));
      if (playerProfile) {
        playerProfile.pixelSeriesBest = Object.assign({}, playerProfile.pixelSeriesBest || {});
        if (s.found > (Number(playerProfile.pixelSeriesBest[s.total]) || 0)) { playerProfile.pixelSeriesBest[s.total] = s.found; try { saveProfile(); } catch (_e) {} }
      }
      // The next « 🔁 Nouvelle série » starts afresh.
      var done = s; setTimeout(function () { if (pixelSeries === done) pixelSeries.index = done.total; }, 0);
    }
    return value;
  };
}
