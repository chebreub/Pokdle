// Party Room chat: a « 💬 Chat » button in the room's header with the number of unread
// messages, and a panel with the room's messages, four quick reactions and a short text field.
// The button stays in the page flow: a floating one would cover the room's own buttons. A new
// message while the panel is closed shows a short toast. Messages live only in this page: the
// server relays them and forgets them (lib/party-chat.js).
const PARTY_CHAT_REACTIONS = ['😂', '🔥', '👏', '😱'];
const PARTY_CHAT_KEEP = 60;
const partyChat = { open: false, unread: 0, messages: [], code: null, bound: false, sending: false, error: '' };

function partyChatRoom() {
  const room = typeof partyRoomState !== 'undefined' ? partyRoomState.room : null;
  return room && room.code && partyRoomState.code === room.code ? room : null;
}

// Shown while the player is in a room and looks at it, or plays one of its rounds.
function partyChatVisible(room) {
  if (!room) return false;
  const screen = document.getElementById('screen-party-room');
  return Boolean(screen && !screen.classList.contains('hidden')) || room.status === 'playing';
}

function partyChatBind() {
  if (partyChat.bound) return;
  const socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
  if (!socket) return;
  partyChat.bound = true;
  socket.on('party:chat', (msg) => {
    const room = partyChatRoom();
    if (!room || !msg || msg.code !== room.code || !msg.message) return;
    partyChatAdd(msg.message, false);
  });
}

function partyChatAdd(message, mine) {
  partyChat.messages.push({ ...message, mine });
  if (partyChat.messages.length > PARTY_CHAT_KEEP) partyChat.messages.splice(0, partyChat.messages.length - PARTY_CHAT_KEEP);
  if (!partyChat.open && !mine) {
    partyChat.unread += 1;
    if (typeof showToast === 'function') showToast(partyChatPreview(message));
  }
  renderPartyChat();
}

// The toast never gives away a hidden message.
function partyChatPreview(message) {
  if (message.reaction) return '💬 ' + message.nickname + ' ' + message.reaction;
  if (message.masked) return '💬 ' + message.nickname + ' a écrit dans le chat';
  const text = String(message.text || '');
  return '💬 ' + message.nickname + ' : ' + (text.length > 60 ? text.slice(0, 59) + '…' : text);
}

function partyChatMessageHtml(message) {
  const who = message.mine ? 'Moi' : message.nickname;
  let body;
  if (message.reaction) body = '<span class="pchat-emoji">' + escapeHtml(message.reaction) + '</span>';
  else if (message.masked && !message.mine) body = '🙈 Message caché : il contenait la réponse';
  else body = escapeHtml(message.text || '') + (message.masked ? '<small class="pchat-note">Caché aux autres : il contenait la réponse.</small>' : '');
  const classes = ['pchat-msg', message.mine ? 'is-mine' : '', message.masked && !message.mine ? 'is-masked' : ''].filter(Boolean).join(' ');
  return '<div class="' + classes + '"><i>' + escapeHtml(who) + '</i>' + body + '</div>';
}

function renderPartyChat() {
  const room = partyChatRoom();
  if (room && room.code !== partyChat.code) Object.assign(partyChat, { code: room.code, messages: [], unread: 0, error: '' });
  const visible = partyChatVisible(room);
  const head = document.querySelector('#party-joined .party-room-head-actions');
  let fab = document.getElementById('party-chat-fab');
  let panel = document.getElementById('party-chat');
  if (!visible || !head) { fab?.classList.add('hidden'); panel?.classList.add('hidden'); return; }
  partyChatBind();
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'party-chat-fab';
    fab.type = 'button';
    fab.className = 'pchat-fab';
    fab.dataset.action = 'togglePartyChat';
    head.insertBefore(fab, head.lastElementChild);
  }
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'party-chat';
    panel.className = 'pchat hidden';
    panel.setAttribute('aria-label', 'Chat du salon');
    panel.innerHTML = '<div class="pchat-head"><div><b>Chat du salon</b><br><small id="party-chat-sub"></small></div>' +
      '<button type="button" class="pchat-x" data-action="togglePartyChat" aria-label="Fermer le chat">✕</button></div>' +
      '<div class="pchat-list" id="party-chat-list" role="log" aria-live="polite"></div>' +
      '<div class="pchat-react">' + PARTY_CHAT_REACTIONS.map((emoji) => '<button type="button" data-action="sendPartyChatReaction" data-args=\'["' + emoji + '"]\' aria-label="Réagir ' + emoji + '">' + emoji + '</button>').join('') + '</div>' +
      '<p class="pchat-error" id="party-chat-error" role="status"></p>' +
      '<form class="pchat-form" id="party-chat-form"><input id="party-chat-input" maxlength="120" autocomplete="off" enterkeyhint="send" placeholder="Écris un message…" aria-label="Message">' +
      '<button type="submit">Envoyer</button></form>';
    document.body.appendChild(panel);
    panel.querySelector('#party-chat-form').addEventListener('submit', (event) => { event.preventDefault(); sendPartyChatText(); });
    panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') togglePartyChat(false); });
  }
  fab.classList.remove('hidden');
  fab.setAttribute('aria-expanded', String(partyChat.open));
  fab.innerHTML = '💬 Chat' + (partyChat.unread ? ' <b>' + Math.min(partyChat.unread, 99) + '</b>' : '');
  fab.setAttribute('aria-label', partyChat.unread ? 'Ouvrir le chat, ' + partyChat.unread + ' nouveau' + (partyChat.unread > 1 ? 'x' : '') + ' message' + (partyChat.unread > 1 ? 's' : '') : 'Ouvrir le chat');
  panel.classList.toggle('hidden', !partyChat.open);
  const players = (room.players || []).length;
  document.getElementById('party-chat-sub').textContent = players + ' joueur' + (players > 1 ? 's' : '') + ' · les messages ne sont pas gardés';
  document.getElementById('party-chat-error').textContent = partyChat.error;
  const list = document.getElementById('party-chat-list');
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  list.innerHTML = partyChat.messages.length ? partyChat.messages.map(partyChatMessageHtml).join('') : '<p class="pchat-empty">Dis bonjour au salon 👋</p>';
  if (atBottom || partyChat.messages[partyChat.messages.length - 1]?.mine) list.scrollTop = list.scrollHeight;
}

function togglePartyChat(force) {
  partyChat.open = typeof force === 'boolean' ? force : !partyChat.open;
  if (partyChat.open) partyChat.unread = 0;
  partyChat.error = '';
  renderPartyChat();
  // A phone keyboard would cover the game: the field gets the focus on a computer only.
  if (partyChat.open && !window.matchMedia?.('(pointer: coarse)').matches) document.getElementById('party-chat-input')?.focus({ preventScroll: true });
  if (!partyChat.open) document.getElementById('party-chat-fab')?.focus({ preventScroll: true });
}

function partyChatSend(payload, done) {
  const room = partyChatRoom();
  const socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
  if (!room || !socket || partyChat.sending) return;
  partyChat.sending = true;
  socket.emit('party:chat', { code: room.code, ...payload }, (res) => {
    partyChat.sending = false;
    partyChat.error = res && res.ok ? '' : (res && res.error) || 'Message non envoyé.';
    if (res && res.ok && res.message) { partyChatAdd(res.message, true); if (done) done(); }
    else renderPartyChat();
  });
}

function sendPartyChatText() {
  const input = document.getElementById('party-chat-input');
  if (!input || !input.value.trim()) return;
  partyChatSend({ text: input.value }, () => { input.value = ''; });
}

function sendPartyChatReaction(emoji) {
  partyChatSend({ reaction: emoji });
}

const renderPartyRoomBeforeChat = renderPartyRoom;
renderPartyRoom = function () {
  const value = renderPartyRoomBeforeChat.apply(this, arguments);
  renderPartyChat();
  return value;
};
const showScreenBeforeChat = showScreen;
showScreen = function () {
  const value = showScreenBeforeChat.apply(this, arguments);
  renderPartyChat();
  return value;
};
