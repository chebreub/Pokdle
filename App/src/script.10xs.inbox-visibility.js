
// ===== ⚔️📬 Défis et messages visibles (01/11/2026) =====
// They were one line among eight in the account menu, and nothing said something was waiting. Now:
// a red count on the account button, on « Amis » / « Entre amis »; a card at the top of the home while
// a challenge waits; the challenges at the top of the Party Room (the « Amis » tab), never floating.
function inboxMessagesCount() {
  return typeof playerMessagesQueue !== 'undefined' && Array.isArray(playerMessagesQueue) ? playerMessagesQueue.length : 0;
}
function inboxChallenges() {
  var list = typeof pcState !== 'undefined' && pcState && Array.isArray(pcState.list) ? pcState.list : [];
  var waiting = list.filter(function (c) { return c.incoming && pcOpen(c); });
  var news = list.filter(function (c) { return !c.incoming && !c.seen && c.status !== 'open'; });
  return { list: list, waiting: waiting, news: news };
}
function inboxCounts() {
  if (!window.__pokedleAuthed) return { duels: 0, messages: 0, friends: 0, chat: 0 };
  var s = inboxChallenges();
  // 🤝 Friend requests waiting, and my requests accepted (script.10xu.friends.js).
  var friends = typeof frPendingCount === 'function' ? frPendingCount() : 0;
  // 💬 Unread messages from friends (script.10xv.friend-chat.js).
  var chat = typeof chatUnreadCount === 'function' ? chatUnreadCount() : 0;
  return { duels: s.waiting.length + s.news.length, messages: inboxMessagesCount(), friends: friends, chat: chat };
}
function inboxSetDot(el, n) {
  if (!el) return;
  var dot = el.querySelector(':scope > .inbox-dot');
  if (!n) { if (dot) dot.remove(); return; }
  if (!dot) { dot = document.createElement('span'); dot.className = 'inbox-dot'; dot.setAttribute('aria-hidden', 'true'); el.appendChild(dot); }
  dot.textContent = n > 9 ? '9+' : String(n);
}
function inboxDescribe(c) {
  return c.kind === 'mystere' ? 'Trouve son Pokémon mystère' : (c.kind === 'serie' ? 'Bats sa série' : 'Bats son record') + ' au ' + c.label + ' : ' + Number(c.target);
}
function renderInboxHome() {
  var home = document.getElementById('screen-config');
  if (!home) return;
  var box = document.getElementById('home-inbox');
  var s = inboxChallenges(), messages = inboxMessagesCount();
  var friendLine = (typeof chatHomeLineHtml === 'function' ? chatHomeLineHtml() : '') + (typeof frHomeLineHtml === 'function' ? frHomeLineHtml() : '');
  if (!window.__pokedleAuthed || (!s.waiting.length && !s.news.length && !messages && !friendLine)) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('section'); box.id = 'home-inbox'; box.className = 'home-inbox'; home.insertBefore(box, home.firstChild); }
  var html = '';
  if (s.waiting.length) {
    var first = s.waiting[0];
    html += '<div class="home-inbox-card">' + pcAvatar(first.other) + '<div><b>⚔️ ' + (s.waiting.length > 1 ? s.waiting.length + ' défis t’attendent' : first.other.username + ' te défie') + '</b>' +
      '<small>' + escapeHtml((s.waiting.length > 1 ? first.other.username + ' : ' : '') + inboxDescribe(first)) + '</small></div>' +
      '<button type="button" class="btn-blue" data-action="' + (s.waiting.length > 1 ? 'openMyChallenges"' : 'acceptChallenge" data-args="[' + Number(first.id) + ']"') + '>' + (first.kind === 'mystere' && first.tries ? 'Continuer' : 'Relever') + '</button></div>';
  } else if (s.news.length) {
    html += '<div class="home-inbox-card">' + pcAvatar(s.news[0].other) + '<div><b>⚔️ Du nouveau dans tes défis</b><small>' + escapeHtml(s.news[0].other.username) + ' a ' + (s.news[0].status === 'won' ? 'relevé' : 'raté') + ' ton défi</small></div>' +
      '<button type="button" class="btn-ghost" data-action="openMyChallenges">Voir</button></div>';
  }
  if (messages) html += '<button type="button" class="home-inbox-line" data-action="openMyMessages"><span>📬 ' + (messages > 1 ? messages + ' nouveaux messages' : '1 nouveau message') + ' du créateur</span><b>Lire →</b></button>';
  html += friendLine;
  box.innerHTML = html;
}
function renderPartyDuels() {
  var screen = document.getElementById('screen-party-room');
  var lobby = document.getElementById('party-lobby');
  if (!screen || !lobby) return;
  var box = document.getElementById('party-duels');
  var inRoom = typeof partyRoomState !== 'undefined' && partyRoomState && partyRoomState.room;
  if (!window.__pokedleAuthed || inRoom || lobby.classList.contains('hidden')) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('section'); box.id = 'party-duels'; box.className = 'party-duels'; lobby.parentNode.insertBefore(box, lobby); }
  var s = inboxChallenges();
  var rows = s.waiting.concat(s.list.filter(function (c) { return !c.incoming && c.status === 'open'; }), s.news).slice(0, 3);
  var count = s.waiting.length + s.news.length;
  box.innerHTML = '<div class="party-duels-head"><h3>⚔️ Mes défis' + (count ? ' <i class="pc-badge">' + count + '</i>' : '') + '</h3>' +
    '<button type="button" class="btn-ghost" data-action="openMyChallenges">Tout voir</button></div>' +
    (rows.length ? rows.map(function (c) {
      var action = c.incoming && pcOpen(c)
        ? '<button type="button" class="btn-blue" data-action="acceptChallenge" data-args="[' + Number(c.id) + ']">' + (c.kind === 'mystere' && c.tries ? 'Continuer' : 'Relever') + '</button>'
        : !pcOpen(c) ? '<button type="button" class="btn-ghost" data-action="openChallengeForm" data-args="' + pcArgs([c.other.pid, c.other.username, c.mode]) + '">Revanche</button>' : '';
      var text = c.incoming ? escapeHtml(c.other.username) + ' · ' + escapeHtml(inboxDescribe(c))
        : pcOpen(c) ? 'Tu as défié ' + escapeHtml(c.other.username) + ' · encore ' + pcDaysLeft(c) + ' j'
        : escapeHtml(c.other.username) + (c.status === 'won' ? ' a relevé ton défi 🏆' : ' n’a pas relevé ton défi 💪');
      return '<div class="party-duels-row">' + pcAvatar(c.other) + '<p>' + text + '</p>' + action + '</div>';
    }).join('') : '<p class="party-duels-empty">Défie un joueur : clique sur son pseudo dans un <button type="button" class="party-duels-link" data-action="openLeaderboardV2" data-args=\'["journey","week"]\'>classement</button>, puis ⚔️ Défier.</p>');
}
function renderInboxUi() {
  var n = inboxCounts();
  inboxSetDot(document.querySelector('#account-area .account-chip'), n.duels + n.messages + (n.friends || 0) + (n.chat || 0));
  inboxSetDot(document.querySelector('#mobile-tabbar [data-tab="social"]'), n.duels + (n.friends || 0) + (n.chat || 0));
  inboxSetDot(document.getElementById('nav-social'), n.duels + (n.friends || 0) + (n.chat || 0));
  renderInboxHome();
  renderPartyDuels();
}

if (typeof pcRefresh === 'function') {
  var inboxRefreshBefore = pcRefresh;
  pcRefresh = function () { return inboxRefreshBefore.apply(this, arguments).then(function (list) { renderInboxUi(); return list; }); };
}
if (typeof pcMarkSeen === 'function') {
  var inboxSeenBefore = pcMarkSeen;
  pcMarkSeen = function () { var out = inboxSeenBefore.apply(this, arguments); renderInboxUi(); return out; };
}
if (typeof showNextPlayerMessage === 'function') {
  var inboxMessageBefore = showNextPlayerMessage;
  showNextPlayerMessage = function () { var out = inboxMessageBefore.apply(this, arguments); renderInboxUi(); return out; };
}
if (typeof renderPartyRoom === 'function') {
  var inboxPartyBefore = renderPartyRoom;
  renderPartyRoom = function () { var out = inboxPartyBefore.apply(this, arguments); renderPartyDuels(); return out; };
}
if (typeof window !== 'undefined' && window.addEventListener) {
  // The account button is drawn after /api/me; the messages arrive a little later.
  window.addEventListener('pokedle:auth-ready', function () { setTimeout(renderInboxUi, 400); setTimeout(renderInboxUi, 4000); });
}
window.renderInboxUi = renderInboxUi;
window.inboxCounts = inboxCounts;
