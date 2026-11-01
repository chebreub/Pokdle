
// ===== 💬 Discussion entre amis (01/11/2026, option B, 2e PR) =====
// Two friends write to each other, 200 characters at a time (lib/friend-chat.js). No links nor
// numbers: the server refuses them and the window says why. « 🚩 Signaler » sends the last messages
// to the creator's /admin; « ⛔ Bloquer » ends the friendship. The window asks for news every few
// seconds while it is open, never in the background.
var chatState = { convs: {}, unread: 0, pid: null, name: '', messages: [], timer: null, busy: false };
var CHAT_MAX = 200;
var CHAT_ERRORS = {
  contact: '🔒 Pas de liens ni de numéros ici (Snap, Insta, téléphone…) : on se parle sur Pokédle.',
  long: 'Un message fait 200 caractères au plus.',
  empty: 'Écris quelques mots avant d’envoyer.',
  limit: 'Doucement 🙂 Attends un peu avant d’envoyer d’autres messages.',
  rate_limited: 'Doucement 🙂 Attends un peu avant d’envoyer d’autres messages.',
  not_friends: 'Vous n’êtes plus amis : la discussion est fermée.',
  login: 'Connecte-toi pour discuter avec tes amis.',
};

function chatGet(path) {
  return fetch(path, { credentials: 'same-origin', cache: 'no-store' }).then(function (res) { return res.json(); });
}
function chatPost(path, body) {
  return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(function (res) { return res.json().catch(function () { return { ok: false }; }); });
}
function chatUnreadCount() { return window.__pokedleAuthed ? Number(chatState.unread) || 0 : 0; }
function chatConv(pid) { return chatState.convs[pid] || null; }
function chatRefresh() {
  if (!window.__pokedleAuthed) return Promise.resolve(null);
  return chatGet('/api/chat').then(function (data) {
    if (data && data.ok) { chatState.convs = data.conversations || {}; chatState.unread = Number(data.unread) || 0; }
    if (typeof renderPartyFriends === 'function') renderPartyFriends();
    if (typeof renderInboxUi === 'function') renderInboxUi();
    return chatState;
  }).catch(function () { return chatState; });
}
function chatTime(iso) {
  var d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return '';
  try {
    var day = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' });
    var today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' });
    var hour = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    return day === today ? hour : day + ' ' + hour;
  } catch (_e) { return ''; }
}
function chatFriend(pid) {
  return typeof frList === 'function' ? frList('friends').find(function (f) { return f.pid === pid; }) || null : null;
}

// ---- the window
function chatMessagesHtml() {
  if (!chatState.messages.length) return '<p class="chat-empty">Pas encore de message. Dis bonjour 👋</p>';
  return chatState.messages.map(function (m) {
    return '<div class="chat-bubble ' + (m.mine ? 'is-mine' : 'is-them') + '"><span>' + escapeHtml(m.body).replace(/\n/g, '<br>') + '</span><small>' + escapeHtml(chatTime(m.at)) + '</small></div>';
  }).join('');
}
function chatWindowHtml(pid, name) {
  return '<div class="chat-win" data-chat-pid="' + escapeHtml(pid) + '">' +
    '<div class="chat-top"><button type="button" class="chat-who" data-action="openPlayerCard" data-args="' + frArgs([pid]) + '">' + frAvatar(chatFriend(pid) || { username: name }) + '<span><b>' + escapeHtml(name) + '</b><small>Voir sa carte</small></span></button>' +
      '<button type="button" class="btn-ghost chat-more" data-action="chatMenu" aria-label="Plus d’actions">⋯</button></div>' +
    '<div class="chat-menu" hidden><button type="button" class="btn-ghost" data-action="openChallengeForm" data-args="' + frArgs([pid, name]) + '">⚔️ Défier</button>' +
      '<button type="button" class="btn-ghost fr-danger" data-action="chatReport">🚩 Signaler</button>' +
      '<button type="button" class="btn-ghost fr-danger" data-action="chatBlock">⛔ Bloquer</button></div>' +
    '<div class="chat-msgs" id="chat-msgs" aria-live="polite">' + chatMessagesHtml() + '</div>' +
    '<p class="chat-warn" id="chat-warn" role="status"></p>' +
    '<div class="chat-form"><input id="chat-input" type="text" maxlength="' + CHAT_MAX + '" autocomplete="off" enterkeyhint="send" placeholder="Écris un message…" aria-label="Ton message">' +
      '<button type="button" class="btn-blue chat-send" data-action="chatSend" aria-label="Envoyer">➤</button></div>' +
    '<div class="chat-foot"><span>Gardé 30 jours · pas de liens ni de numéros</span><span id="chat-count">0 / ' + CHAT_MAX + '</span></div></div>';
}
function chatPaint(scroll) {
  var box = document.getElementById('chat-msgs');
  if (!box) return;
  var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = chatMessagesHtml();
  if (scroll || atBottom) box.scrollTop = box.scrollHeight;
}
function chatIsOpen() {
  var overlay = document.getElementById('overlay-modal');
  return Boolean(overlay && !overlay.classList.contains('hidden') && overlay.dataset.kind === 'chat' && document.querySelector('#overlay-body .chat-win[data-chat-pid="' + chatState.pid + '"]'));
}
function chatLastId() {
  var last = chatState.messages[chatState.messages.length - 1];
  return last ? last.id : 0;
}
function chatPoll() {
  clearTimeout(chatState.timer);
  if (!chatIsOpen()) { chatState.pid = null; chatRefresh(); return; }
  if (document.visibilityState === 'visible') {
    chatGet('/api/chat/thread?pid=' + encodeURIComponent(chatState.pid) + '&after=' + chatLastId()).then(function (data) {
      if (!chatIsOpen() || !data || !data.ok) return;
      if (data.friends === false) { chatClosed(); return; }
      if (data.messages && data.messages.length) {
        var known = {};
        chatState.messages.forEach(function (m) { known[m.id] = true; });
        data.messages.forEach(function (m) { if (!known[m.id]) chatState.messages.push(m); });
        chatPaint(false);
      }
    }).catch(function () {});
  }
  chatState.timer = setTimeout(chatPoll, 4000);
}
function chatClosed() {
  var win = document.querySelector('#overlay-body .chat-win');
  if (win) win.innerHTML = '<p class="chat-empty">' + escapeHtml(CHAT_ERRORS.not_friends) + '</p>';
}
function openFriendChat(pid, name) {
  if (!window.__pokedleAuthed) { showToast(CHAT_ERRORS.login); return; }
  var friend = chatFriend(pid);
  name = name || (friend && friend.username) || 'Ton ami';
  chatState.pid = pid; chatState.name = name; chatState.messages = [];
  ensureOverlay('💬 Discussion', chatWindowHtml(pid, name));
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'chat';
  var box = document.getElementById('chat-msgs');
  if (box) box.innerHTML = '<p class="chat-empty">Chargement…</p>';
  var input = document.getElementById('chat-input');
  if (input) {
    input.addEventListener('input', function () { var c = document.getElementById('chat-count'); if (c) c.textContent = [...input.value].length + ' / ' + CHAT_MAX; });
    input.addEventListener('keydown', function (event) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); chatSend(); } });
  }
  chatGet('/api/chat/thread?pid=' + encodeURIComponent(pid)).then(function (data) {
    if (!chatIsOpen()) return;
    if (!data || !data.ok) { var b = document.getElementById('chat-msgs'); if (b) b.innerHTML = '<p class="chat-empty">La discussion n’a pas pu s’ouvrir. Réessaie dans un instant.</p>'; return; }
    if (data.friends === false) { chatClosed(); return; }
    chatState.messages = data.messages || [];
    chatPaint(true);
    if (chatState.convs[pid]) { chatState.unread = Math.max(0, chatState.unread - (chatState.convs[pid].unread || 0)); chatState.convs[pid].unread = 0; }
    if (typeof renderInboxUi === 'function') renderInboxUi();
    chatState.timer = setTimeout(chatPoll, 4000);
  }).catch(function () {});
}
function chatSend() {
  var input = document.getElementById('chat-input');
  var warn = document.getElementById('chat-warn');
  if (!input || chatState.busy || !chatState.pid) return;
  var text = input.value.trim();
  if (!text) { if (warn) warn.textContent = CHAT_ERRORS.empty; return; }
  chatState.busy = true;
  chatPost('/api/chat/send', { pid: chatState.pid, body: text }).then(function (data) {
    chatState.busy = false;
    if (!data || !data.ok) {
      if (warn) warn.textContent = CHAT_ERRORS[data && data.error] || 'Envoi impossible pour le moment. Réessaie dans un instant.';
      if (data && data.error === 'not_friends') chatClosed();
      return;
    }
    if (warn) warn.textContent = '';
    input.value = '';
    var c = document.getElementById('chat-count'); if (c) c.textContent = '0 / ' + CHAT_MAX;
    if (!chatState.messages.some(function (m) { return m.id === data.message.id; })) chatState.messages.push(data.message);
    chatPaint(true);
    chatState.convs[chatState.pid] = { last: data.message, unread: 0 };
  }).catch(function () {
    chatState.busy = false;
    if (warn) warn.textContent = 'Envoi impossible pour le moment. Réessaie dans un instant.';
  });
}
function chatMenu() {
  var menu = document.querySelector('#overlay-body .chat-menu');
  if (menu) menu.hidden = !menu.hidden;
}
function chatReport() {
  var win = document.querySelector('#overlay-body .chat-win');
  if (!win) return;
  var name = chatState.name;
  win.querySelector('.chat-menu').hidden = true;
  var warn = document.getElementById('chat-warn');
  if (warn) warn.innerHTML = '<span class="chat-confirm">Signaler ' + escapeHtml(name) + ' ? Les 30 derniers messages de votre discussion seront envoyés au créateur de Pokédle, qui les lira. ' +
    '<button type="button" class="btn-ghost fr-danger" data-action="chatReportNow" data-args="[false]">🚩 Signaler</button>' +
    '<button type="button" class="btn-ghost fr-danger" data-action="chatReportNow" data-args="[true]">Signaler et bloquer</button>' +
    '<button type="button" class="fr-card-link" data-action="chatCancelConfirm">Annuler</button></span>';
}
function chatReportNow(alsoBlock) {
  var pid = chatState.pid, name = chatState.name;
  chatPost('/api/chat/report', { pid: pid }).then(function (data) {
    if (!data || !data.ok) { showToast(CHAT_ERRORS[data && data.error] || 'Signalement impossible pour le moment.'); return; }
    showToast('🚩 Merci, ' + name + ' est signalé. Le créateur de Pokédle va lire votre discussion.');
    if (alsoBlock && typeof frBlock === 'function') { frBlock(pid, name); closeOverlayModal(); }
    else chatCancelConfirm();
  }).catch(function () { showToast('Signalement impossible pour le moment.'); });
}
function chatBlock() {
  var warn = document.getElementById('chat-warn');
  var menu = document.querySelector('#overlay-body .chat-menu');
  if (menu) menu.hidden = true;
  if (warn) warn.innerHTML = '<span class="chat-confirm">Bloquer ' + escapeHtml(chatState.name) + ' ? Vous ne serez plus amis et il ne pourra plus t’écrire ni te redemander. ' +
    '<button type="button" class="btn-ghost fr-danger" data-action="chatBlockNow">⛔ Bloquer</button>' +
    '<button type="button" class="fr-card-link" data-action="chatCancelConfirm">Annuler</button></span>';
}
function chatBlockNow() {
  if (typeof frBlock === 'function') frBlock(chatState.pid, chatState.name);
  closeOverlayModal();
}
function chatCancelConfirm() {
  var warn = document.getElementById('chat-warn');
  if (warn) warn.textContent = '';
}

// The home card of 10xs: one line for unread messages from friends.
function chatHomeLineHtml() {
  if (!chatUnreadCount()) return '';
  var pid = Object.keys(chatState.convs).find(function (k) { return chatState.convs[k].unread > 0; });
  var friend = pid ? chatFriend(pid) : null;
  var who = friend ? friend.username : 'un ami';
  return '<button type="button" class="home-inbox-line" data-action="openFriendChat" data-args="' + frArgs([pid || '', who]) + '"><span>💬 ' +
    (chatUnreadCount() > 1 ? chatUnreadCount() + ' nouveaux messages' : 'Nouveau message de ' + escapeHtml(who)) + '</span><b>Lire →</b></button>';
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pokedle:auth-ready', function () {
    var match = /[?&]chat=([0-9a-f]{16})\b/.exec(location.search || '');
    if (match) {
      try {
        var params = new URLSearchParams(location.search);
        params.delete('chat');
        var query = params.toString();
        history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
      } catch (_e) {}
    }
    setTimeout(function () {
      var friends = typeof frRefresh === 'function' ? frRefresh() : Promise.resolve();
      Promise.resolve(friends).then(chatRefresh).then(function () { if (match) openFriendChat(match[1]); });
    }, match ? 300 : 2200);
  });
  // Back on the tab: fresh counts (a message may have come while away).
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && window.__pokedleAuthed && !chatIsOpen()) chatRefresh();
  });
}
window.openFriendChat = openFriendChat;
window.chatSend = chatSend;
window.chatMenu = chatMenu;
window.chatReport = chatReport;
window.chatReportNow = chatReportNow;
window.chatBlock = chatBlock;
window.chatBlockNow = chatBlockNow;
window.chatCancelConfirm = chatCancelConfirm;
