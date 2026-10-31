
// ===== End of the day's journey and « Jours passés » (31/10/2026) =====
// Once the four stages are done, the player is told the game goes on: Pokédle in unlimited mode, the
// mini-games, and the earlier Pokémon du jour (7 days with an account, 7 more per friend invited).
var PAST_DONE_KEY = 'pokedle.pastDaysDone';
var pastDayPlaying = null;

function dayDoneCardHtml() {
  return '<div class="day-done-card"><p class="day-done-kicker">🎉 Parcours du jour terminé</p>' +
    '<p class="day-done-text">Le prochain Pokémon du jour arrive à minuit. En attendant, continue :</p>' +
    '<div class="day-done-actions"><button type="button" class="btn-blue" data-action="startNormalGame">🔁 Pokédle en illimité</button>' +
    '<button type="button" class="btn-ghost" data-action="openAllModesScreen" data-args=\'["solo"]\'>Les mini-jeux</button></div>' +
    '<button type="button" class="day-done-past" data-action="openPastDays">📅 Rejouer les jours passés</button></div>';
}

function pastDaysDone() {
  try { var v = JSON.parse(localStorage.getItem(PAST_DONE_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_e) { return {}; }
}
function markPastDayDone(day) {
  var done = pastDaysDone(); done[day] = 1;
  var keys = Object.keys(done).sort().slice(-90), kept = {};
  keys.forEach(function (k) { kept[k] = 1; });
  try { localStorage.setItem(PAST_DONE_KEY, JSON.stringify(kept)); } catch (_e) {}
}

function pastDayLabel(day) {
  var d = new Date(day + 'T12:00:00Z');
  var label = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function pastDaysHtml(data) {
  if (!data || !data.ok) return '<div class="past-days"><p class="past-days-lead">Jours passés indisponibles pour le moment.</p></div>';
  if (!data.login) {
    return '<div class="past-days"><p class="past-days-lead">Connecte-toi pour rejouer les Pokémon du jour des <b>7 derniers jours</b>. Chaque ami que tu invites en débloque 7 de plus.</p>' +
      '<div class="day-done-actions"><button type="button" class="btn-blue" data-action="openAccountMenu">Se connecter</button></div></div>';
  }
  var done = pastDaysDone();
  var rows = (data.days || []).map(function (d) {
    if (!d.unlocked) return '<li class="past-day is-locked"><span>' + escapeHtml(pastDayLabel(d.day)) + '</span><b>🔒</b></li>';
    var played = Boolean(done[d.day]);
    return '<li class="past-day' + (played ? ' is-done' : '') + '"><span>' + escapeHtml(pastDayLabel(d.day)) + '</span>' +
      '<button type="button" class="' + (played ? 'btn-ghost' : 'btn-blue') + '" data-action="playPastDay" data-args="' + escapeHtml(JSON.stringify([d.id, d.day])) + '">' + (played ? '✓ Rejouer' : 'Jouer') + '</button></li>';
  }).join('');
  var locked = (data.days || []).some(function (d) { return !d.unlocked; });
  return '<div class="past-days"><p class="past-days-lead">Retrouve les Pokémon du jour des jours passés, pour le plaisir (hors classement). ' +
    '<b>' + Number(data.unlocked) + ' jours</b> débloqués' + (data.friends ? ' grâce à ' + Number(data.friends) + ' ami' + (data.friends > 1 ? 's' : '') + ' invité' + (data.friends > 1 ? 's' : '') : '') + '.</p>' +
    (rows ? '<ol class="past-days-list">' + rows + '</ol>' : '<p class="past-days-lead">Pas encore de jour passé.</p>') +
    (locked ? '<button type="button" class="past-days-unlock" data-action="openInviteFriend">🎁 Invite un ami : +' + Number(data.perFriend || 7) + ' jours débloqués</button>' : '') + '</div>';
}

function openPastDays() {
  ensureOverlay('📅 Jours passés', '<div class="past-days"><p class="past-days-lead">Chargement…</p></div>');
  fetch('/api/daily/past', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (data) { var box = document.querySelector('#overlay-body .past-days'); if (box) box.outerHTML = pastDaysHtml(data); })
    .catch(function () { var box = document.querySelector('#overlay-body .past-days'); if (box) box.outerHTML = pastDaysHtml(null); });
}
window.openPastDays = openPastDays;

// A past day plays like Pokédle in unlimited mode, with every generation, so nothing gives the answer away.
function playPastDay(id, day) {
  var pokemon = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(id)) : null;
  if (!pokemon) { if (typeof showToast === 'function') showToast('Ce jour n’est pas disponible.'); return; }
  if (typeof closeOverlayModal === 'function') closeOverlayModal();
  pastDayPlaying = { id: Number(id), day: String(day) };
  if (typeof hideExtraScreens === 'function') hideExtraScreens();
  gameMode = 'normal';
  selectedGens = new Set(Object.keys(GENERATIONS).map(Number));
  if (typeof buildGenGrid === 'function') buildGenGrid();
  startGameWithSecret(pokemon, getPokemonUiList());
  if (typeof showScreen === 'function') showScreen('screen-game');
  if (typeof showToast === 'function') showToast('📅 Pokémon du jour du ' + pastDayLabel(day) + ' : à toi de le retrouver !');
}
window.playPastDay = playPastDay;

if (typeof renderGameOverBox === 'function') {
  var renderGameOverBeforePast = renderGameOverBox;
  renderGameOverBox = function () {
    var value = renderGameOverBeforePast.apply(this, arguments);
    if (pastDayPlaying && gameMode === 'normal' && secretPokemon && secretPokemon.id === pastDayPlaying.id) { markPastDayDone(pastDayPlaying.day); pastDayPlaying = null; }
    return value;
  };
}

// The day's summary ends with what comes next.
if (typeof showDailyJourneySummary === 'function') {
  var showJourneyBeforeDayDone = showDailyJourneySummary;
  showDailyJourneySummary = async function () {
    var value = await showJourneyBeforeDayDone.apply(this, arguments);
    var content = document.getElementById('challenge-content');
    if (content && content.classList.contains('is-summary') && !content.querySelector('.day-done-card')) content.insertAdjacentHTML('beforeend', dayDoneCardHtml());
    return value;
  };
}
// The home hero of a finished day offers Pokédle in unlimited mode first, and says the rest.
if (typeof applyDailyHomeSummary === 'function') {
  var applyHomeBeforeDayDone = applyDailyHomeSummary;
  applyDailyHomeSummary = function (summary) {
    var value = applyHomeBeforeDayDone.apply(this, arguments);
    var cta = document.getElementById('daily-hero-cta');
    if (cta && summary && dailyHomeNext(summary) === -1) {
      cta.dataset.action = 'startNormalGame';
      delete cta.dataset.args;
      cta.textContent = '🔁 Pokédle en illimité →';
      setDailyHeroNote('Tes quatre épreuves sont terminées. En attendant le prochain Pokémon à minuit : Pokédle en illimité, les mini-jeux, ou les jours passés.');
    }
    return value;
  };
}
