
// ===== Reactions under the Pokémon du jour (31/10/2026) =====
// Once the day is played (found or given up): « 12 joueurs l'ont trouvé aujourd'hui » (shown from 5
// finders) and one quick reaction 😂 🔥 👏 😱 per player, counted by the server. No free text.
var dailyReactionsState = null;

function dailyReactionsHtml(data) {
  if (!data || !data.ok || !Array.isArray(data.emojis)) return '';
  var found = Number(data.found) > 0 ? '<p class="daily-react-found">🎯 ' + Number(data.found) + ' joueurs l’ont trouvé aujourd’hui</p>' : '';
  var buttons = data.emojis.map(function (emoji) {
    var on = data.mine === emoji, n = Number(data.counts && data.counts[emoji]) || 0;
    return '<button type="button" class="daily-react-btn' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-action="sendDailyReaction" data-args="' + escapeHtml(JSON.stringify([emoji])) + '">' +
      '<span aria-hidden="true">' + emoji + '</span><b>' + n + '</b></button>';
  }).join('');
  return '<div class="daily-react" id="daily-react">' + found +
    '<div class="daily-react-row" role="group" aria-label="Ta réaction au Pokémon du jour"><span class="daily-react-label">Ta réaction</span>' + buttons + '</div>' +
    '<button type="button" class="daily-invite-link" data-action="openInviteFriend">🎁 Invite un ami : +100 XP chacun</button></div>';
}

function placeDailyReactions() {
  var old = document.getElementById('daily-react');
  if (old) old.remove();
  if (gameMode !== 'daily' || typeof dailyServerState === 'undefined' || !dailyServerState || !(dailyServerState.finished || dailyServerState.won)) return;
  var html = dailyReactionsHtml(dailyReactionsState);
  var anchor = document.getElementById('daily-capture') || document.getElementById('daily-enquiry-points') || document.querySelector('#win-box .win-inner');
  if (html && anchor) anchor.insertAdjacentHTML('afterend', html);
}

function loadDailyReactions() {
  return fetch('/api/daily/reactions', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (data) { if (data && data.ok) { dailyReactionsState = data; placeDailyReactions(); } })
    .catch(function () {});
}

function sendDailyReaction(emoji) {
  fetch('/api/daily/react', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji: emoji }) })
    .then(function (res) { return res.json(); })
    .then(function (data) { if (data && data.ok) { dailyReactionsState = data; placeDailyReactions(); } })
    .catch(function () { if (typeof showToast === 'function') showToast('Réaction impossible pour le moment.'); });
}
window.sendDailyReaction = sendDailyReaction;

if (typeof renderGameOverBox === 'function') {
  var renderGameOverBeforeReactions = renderGameOverBox;
  renderGameOverBox = function () {
    var value = renderGameOverBeforeReactions.apply(this, arguments);
    placeDailyReactions();
    // The day's figures come from the server; a reaction or a new finder shows on the next draw.
    var done = gameMode === 'daily' && typeof dailyServerState !== 'undefined' && dailyServerState && (dailyServerState.finished || dailyServerState.won);
    if (done && (!dailyReactionsState || dailyReactionsState.key !== dailyServerState.day)) loadDailyReactions();
    return value;
  };
}
