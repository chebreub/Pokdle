
// ===== 📬 Messages from the site's creator (31/10/2026) =====
// The creator writes from /admin to one signed-in player or to all of them. The player sees each
// message once, in a window at their next visit, and may answer it. Nothing shows to guests.
var playerMessagesQueue = [];
var playerMessagesLoaded = false;

function playerMessageDay(day) {
  var parts = String(day || '').split('-');
  return parts.length === 3 ? parts[2] + '/' + parts[1] : '';
}

function playerMessageHtml(message, more) {
  var id = Number(message.id);
  var day = playerMessageDay(message.day);
  return '<div class="player-message">' +
    '<p class="player-message-from">Du créateur de Pokédle' + (day ? ' · le ' + day : '') + '</p>' +
    '<div class="player-message-body">' + escapeHtml(message.body).replace(/\n/g, '<br>') + '</div>' +
    '<label class="player-message-label" for="player-message-reply">Ta réponse <small>(facultatif)</small></label>' +
    '<textarea id="player-message-reply" maxlength="500" rows="3" placeholder="Écris ta réponse…"></textarea>' +
    '<p class="player-message-status" role="status" aria-live="polite"></p>' +
    '<div class="player-message-actions"><button type="button" class="btn-blue" data-action="sendPlayerMessageReply" data-args="[' + id + ']">Envoyer ma réponse</button>' +
    '<button type="button" class="btn-ghost" data-action="nextPlayerMessage">' + (more ? 'Message suivant →' : 'Fermer') + '</button></div></div>';
}

function postPlayerMessage(path, payload) {
  return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(function (res) { return res.json().catch(function () { return { ok: false }; }); });
}

// A message counts as read once shown: it never comes back at each visit.
function showNextPlayerMessage() {
  var message = playerMessagesQueue.shift();
  if (!message) return false;
  ensureOverlay('📬 Un message pour toi', playerMessageHtml(message, playerMessagesQueue.length > 0));
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'message';
  postPlayerMessage('/api/messages/read', { id: Number(message.id) }).catch(function () {});
  return true;
}

function nextPlayerMessage() {
  if (!showNextPlayerMessage()) closeOverlayModal();
}
window.nextPlayerMessage = nextPlayerMessage;

function sendPlayerMessageReply(id) {
  var box = document.getElementById('player-message-reply');
  var status = document.querySelector('#overlay-body .player-message-status');
  var button = document.querySelector('#overlay-body [data-action="sendPlayerMessageReply"]');
  var text = String((box && box.value) || '').trim();
  var say = function (line) { if (status) status.textContent = line; };
  if (text.length < 2) { say('Écris quelques mots avant d’envoyer.'); if (box) box.focus(); return; }
  if (button) button.disabled = true;
  postPlayerMessage('/api/messages/reply', { id: Number(id), body: text }).then(function (data) {
    if (!data || !data.ok) {
      // The server explains a refused answer in a French sentence; anything else is a hiccup.
      say(data && typeof data.error === 'string' && data.error.indexOf(' ') > 0 ? data.error : 'Envoi impossible pour le moment. Réessaie dans un instant.');
      if (button) button.disabled = false;
      return;
    }
    if (typeof showToast === 'function') showToast('Réponse envoyée ✓');
    nextPlayerMessage();
  }).catch(function () {
    say('Envoi impossible pour le moment. Réessaie dans un instant.');
    if (button) button.disabled = false;
  });
}
window.sendPlayerMessageReply = sendPlayerMessageReply;

// Waits for any other window (level, settings…) to close before showing the message.
function showPlayerMessagesWhenFree(tries) {
  var overlay = document.getElementById('overlay-modal');
  var busy = overlay && !overlay.classList.contains('hidden');
  if (!busy) { showNextPlayerMessage(); return; }
  if ((tries || 0) < 60) setTimeout(function () { showPlayerMessagesWhenFree((tries || 0) + 1); }, 3000);
}

function loadPlayerMessages() {
  if (playerMessagesLoaded) return;
  playerMessagesLoaded = true;
  fetch('/api/messages', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      playerMessagesQueue = data && Array.isArray(data.messages) ? data.messages.slice(0, 5) : [];
      if (playerMessagesQueue.length) showPlayerMessagesWhenFree(0);
    })
    .catch(function () { playerMessagesLoaded = false; });
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pokedle:auth-ready', function () {
    // Opened from the notification (?messages=1): right away; otherwise once the home has settled.
    var fromPush = /[?&]messages=1\b/.test(location.search || '');
    if (fromPush) {
      try {
        var params = new URLSearchParams(location.search);
        params.delete('messages');
        var query = params.toString();
        history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
      } catch (_e) {}
    }
    setTimeout(loadPlayerMessages, fromPush ? 300 : 1500);
  });
}


// ===== 📬 Mes messages (31/10/2026) =====
// The window above shows a message once; a player who closed it can read it again here and answer
// later (three answers at most per message, as on the server).
var myMessagesRepliesMax = 3;

function myMessageHtml(message) {
  var id = Number(message.id);
  var day = playerMessageDay(message.day);
  var replies = Array.isArray(message.replies) ? message.replies : [];
  var repliesHtml = replies.map(function (reply) {
    var replyDay = playerMessageDay(reply.day);
    return '<div class="my-message-reply"><b>Toi' + (replyDay ? ' · ' + replyDay : '') + '</b>' + escapeHtml(reply.body).replace(/\n/g, '<br>') + '</div>';
  }).join('');
  var canReply = replies.length < myMessagesRepliesMax;
  return '<article class="my-message">' +
    '<p class="player-message-from">Du créateur de Pokédle' + (day ? ' · le ' + day : '') + '</p>' +
    '<div class="player-message-body">' + escapeHtml(message.body).replace(/\n/g, '<br>') + '</div>' +
    repliesHtml +
    (canReply
      ? '<label class="player-message-label" for="my-message-reply-' + id + '">' + (replies.length ? 'Ajouter un mot' : 'Ta réponse') + '</label>' +
        '<textarea id="my-message-reply-' + id + '" maxlength="500" rows="2" placeholder="Écris ta réponse…"></textarea>' +
        '<p class="player-message-status" id="my-message-status-' + id + '" role="status" aria-live="polite"></p>' +
        '<div class="player-message-actions"><button type="button" class="btn-blue" data-action="sendMyMessageReply" data-args="[' + id + ']">Envoyer</button></div>'
      : '') +
    '</article>';
}

function renderMyMessages(messages) {
  var list = Array.isArray(messages) ? messages : [];
  ensureOverlay('📬 Mes messages', list.length
    ? '<div class="my-messages">' + list.map(myMessageHtml).join('') + '</div>'
    : '<div class="my-messages"><p class="my-messages-empty">Aucun message pour l’instant. Quand le créateur de Pokédle t’écrit, son message reste ici 90 jours.</p></div>');
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'message';
}

function openMyMessages() {
  renderMyMessages([]);
  var body = document.querySelector('#overlay-body .my-messages');
  if (body) body.innerHTML = '<p class="my-messages-empty">Chargement…</p>';
  fetch('/api/messages/all', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && Number(data.repliesPerMessage) > 0) myMessagesRepliesMax = Number(data.repliesPerMessage);
      renderMyMessages(data && data.messages);
    })
    .catch(function () {
      var box = document.querySelector('#overlay-body .my-messages');
      if (box) box.innerHTML = '<p class="my-messages-empty">Messages indisponibles pour le moment. Réessaie dans un instant.</p>';
    });
}
window.openMyMessages = openMyMessages;

function sendMyMessageReply(id) {
  var box = document.getElementById('my-message-reply-' + id);
  var status = document.getElementById('my-message-status-' + id);
  var text = String((box && box.value) || '').trim();
  var say = function (line) { if (status) status.textContent = line; };
  if (text.length < 2) { say('Écris quelques mots avant d’envoyer.'); if (box) box.focus(); return; }
  postPlayerMessage('/api/messages/reply', { id: Number(id), body: text }).then(function (data) {
    if (!data || !data.ok) {
      say(data && typeof data.error === 'string' && data.error.indexOf(' ') > 0 ? data.error : 'Envoi impossible pour le moment. Réessaie dans un instant.');
      return;
    }
    if (typeof showToast === 'function') showToast('Réponse envoyée ✓');
    openMyMessages();
  }).catch(function () { say('Envoi impossible pour le moment. Réessaie dans un instant.'); });
}
window.sendMyMessageReply = sendMyMessageReply;
