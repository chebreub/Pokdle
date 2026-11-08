// 🎉 Inviter un ami en un appui (8/11/2026, « go les 2 », 2e PR de la Party Room version C).
// - « Avec qui ? » dans le lobby : tes amis en ronds ; ceux que tu touches reçoivent l'invitation à la création
//   du salon (carte sur l'accueil et dans la Party Room, 🔔 s'ils l'ont activée). Dans le salon : « 🤝 Inviter des amis ».
// - Chez l'ami : « 🎉 Jade t'invite à Dessine-le ! · Rejoindre », qui remplit le code et rejoint avec son pseudo.
// Seulement avec un compte et entre amis (le serveur revérifie tout : lib/party-friend-invites.js).

var pfiState = { sel: {}, sentFor: '', invites: [], shown: {}, off: false, timer: null };

function pfiFriends() {
  return typeof frList === 'function' ? frList('friends') : [];
}
function pfiArt(f) {
  return typeof frArt === 'function' ? frArt(f) : '<span class="fr-art is-letter">' + escapeHtml(String(f.username || 'D').charAt(0)) + '</span>';
}
function pfiPost(path, body) {
  return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(function (r) { return r.json().catch(function () { return null; }); }).catch(function () { return null; });
}
function pfiSelected() {
  return Object.keys(pfiState.sel).filter(function (pid) { return pfiState.sel[pid]; });
}

// --- « Avec qui ? » dans le lobby ---
function pfiWhoHtml() {
  var friends = pfiFriends();
  if (!window.__pokedleAuthed || !friends.length) return '';
  var shown = friends.slice(0, 12);
  var names = shown.filter(function (f) { return pfiState.sel[f.pid]; }).map(function (f) { return f.username; });
  return '<p class="pfi-t">Avec qui ? <small>touche pour inviter</small></p><div class="pfi-row">' + shown.map(function (f) {
    var on = !!pfiState.sel[f.pid];
    return '<button type="button" class="pfi-friend' + (on ? ' is-on' : '') + '" data-action="pfiToggle" data-args="' + escapeHtml(JSON.stringify([f.pid])) + '" aria-pressed="' + on + '">' +
      '<span class="pfi-face">' + pfiArt(f) + '</span><small>' + escapeHtml(f.username) + '</small></button>';
  }).join('') + '</div>' +
    (names.length ? '<p class="pfi-hint">' + escapeHtml(names.length > 2 ? names.slice(0, 2).join(', ') + ' et ' + (names.length - 2) + ' autre' + (names.length > 3 ? 's' : '') : names.join(' et ')) + ' recevr' + (names.length > 1 ? 'ont' : 'a') + ' l’invitation.</p>' : '');
}
function pfiPaintWho() {
  var entry = document.querySelector('#party-lobby .pl3 .party-entry-panel');
  if (!entry) return;
  var box = document.getElementById('pfi-who');
  var html = pfiWhoHtml();
  if (!html) { if (box) box.remove(); return; }
  if (!box) {
    box = document.createElement('div');
    box.id = 'pfi-who';
    box.className = 'pfi-who';
    var create = entry.querySelector('[data-action="partyCreateRoom"]');
    entry.insertBefore(box, create || null);
  }
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
function pfiToggle(pid) {
  pfiState.sel[pid] = !pfiState.sel[pid];
  pfiPaintWho();
  var sheet = document.getElementById('pfi-sheet');
  if (sheet) sheet.innerHTML = pfiSheetHtml();
}
window.pfiToggle = pfiToggle;

// À la création du salon : les amis choisis reçoivent l'invitation (une seule fois par salon).
function pfiSendIfNeeded() {
  var room = typeof partyRoomState !== 'undefined' && partyRoomState ? partyRoomState.room : null;
  var code = room && partyRoomState.code;
  var pids = pfiSelected();
  if (!code || !pids.length || pfiState.sentFor === code || room.status !== 'waiting') return;
  pfiState.sentFor = code;
  // Le jeu choisi est appliqué juste après la création : on attend un instant pour que l'invitation le nomme.
  setTimeout(function () { pfiSend(pids, code); }, 1200);
}
function pfiSend(pids, code) {
  return pfiPost('/api/party/invite', { pids: pids, code: code }).then(function (d) {
    var n = d && d.ok ? Number(d.sent) || 0 : 0;
    if (typeof showToast === 'function') showToast(n ? '🎉 Invitation envoyée à ' + n + ' ami' + (n > 1 ? 's' : '') : 'Invitation impossible pour le moment.');
    if (n) pfiState.sel = {};
    return n;
  });
}

// --- Dans le salon : « 🤝 Inviter des amis » ---
function pfiSheetHtml() {
  var friends = pfiFriends();
  var pids = pfiSelected();
  return '<div class="pfi-sheet-body"><div class="pfi-row is-wrap">' + friends.slice(0, 30).map(function (f) {
    var on = !!pfiState.sel[f.pid];
    return '<button type="button" class="pfi-friend' + (on ? ' is-on' : '') + '" data-action="pfiToggle" data-args="' + escapeHtml(JSON.stringify([f.pid])) + '" aria-pressed="' + on + '">' +
      '<span class="pfi-face">' + pfiArt(f) + '</span><small>' + escapeHtml(f.username) + '</small></button>';
  }).join('') + '</div><button type="button" class="btn-blue pfi-send" data-action="pfiSendFromRoom"' + (pids.length ? '' : ' disabled') + '>Envoyer l’invitation' + (pids.length ? ' (' + pids.length + ')' : '') + '</button></div>';
}
function pfiOpenInRoom() {
  if (typeof ensureOverlay !== 'function') return;
  if (!pfiFriends().length && typeof frRefresh === 'function') frRefresh();
  ensureOverlay('🤝 Inviter des amis', '<div id="pfi-sheet">' + pfiSheetHtml() + '</div>');
}
window.pfiOpenInRoom = pfiOpenInRoom;
function pfiSendFromRoom() {
  var code = typeof partyRoomState !== 'undefined' && partyRoomState ? partyRoomState.code : '';
  var pids = pfiSelected();
  if (!code || !pids.length) return;
  pfiSend(pids, code).then(function (n) { if (n && typeof closeOverlayModal === 'function') closeOverlayModal(); });
}
window.pfiSendFromRoom = pfiSendFromRoom;
function pfiPaintRoomButton() {
  var actions = document.querySelector('#party-joined .party-room-head-actions');
  var room = typeof partyRoomState !== 'undefined' && partyRoomState ? partyRoomState.room : null;
  var btn = document.getElementById('pfi-room-btn');
  var show = !!(window.__pokedleAuthed && room && room.status === 'waiting' && pfiFriends().length);
  if (!actions || !show) { if (btn) btn.remove(); return; }
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'pfi-room-btn'; btn.className = 'btn-ghost pfi-room-btn';
    btn.dataset.action = 'pfiOpenInRoom';
    btn.textContent = '🤝 Inviter des amis';
    actions.insertBefore(btn, actions.firstChild);
  }
}

// --- Chez l'ami invité ---
function pfiRefreshInvites() {
  if (pfiState.off || !window.__pokedleAuthed) return;
  fetch('/api/party/invites', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
    if (r.status === 401) { pfiState.off = true; return null; }
    return r.json().catch(function () { return null; });
  }).then(function (d) {
    if (!d || !d.ok) return;
    pfiState.invites = Array.isArray(d.invites) ? d.invites : [];
    pfiState.invites.forEach(function (i) {
      if (pfiState.shown[i.id]) return;
      pfiState.shown[i.id] = true;
      if (typeof showToast === 'function') showToast('🎉 ' + i.from.username + ' t’invite à ' + i.game);
    });
    if (typeof renderInboxHome === 'function') renderInboxHome();
    pfiPaintPartyCard();
  });
}
function pfiInviteCardHtml(i) {
  return '<div class="home-inbox-card pfi-card">' + (typeof pcAvatar === 'function' ? pcAvatar(i.from) : '') +
    '<div><b>🎉 ' + escapeHtml(i.from.username) + ' t’invite</b><small>' + escapeHtml(i.game) + '</small></div>' +
    '<button type="button" class="btn-blue" data-action="pfiJoin" data-args="' + escapeHtml(JSON.stringify([i.id, i.code])) + '">Rejoindre</button>' +
    '<button type="button" class="pfi-x" data-action="pfiDismiss" data-args="' + escapeHtml(JSON.stringify([i.id])) + '" aria-label="Fermer l’invitation">✕</button></div>';
}
function pfiPaintPartyCard() {
  var lobby = document.getElementById('party-lobby');
  if (!lobby) return;
  var box = document.getElementById('pfi-party');
  var inRoom = typeof partyRoomState !== 'undefined' && partyRoomState && partyRoomState.room;
  var html = !inRoom && pfiState.invites.length ? pfiInviteCardHtml(pfiState.invites[0]) : '';
  if (!html) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.id = 'pfi-party'; box.className = 'pfi-party'; lobby.insertBefore(box, lobby.firstChild); }
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}
function pfiJoin(id, code) {
  pfiPost('/api/party/invites/dismiss', { id: id });
  pfiState.invites = pfiState.invites.filter(function (i) { return i.id !== id; });
  if (typeof renderInboxHome === 'function') renderInboxHome();
  if (typeof openPartyRoomJoin === 'function') openPartyRoomJoin(); else if (typeof openPartyRoomMode === 'function') openPartyRoomMode();
  var input = document.getElementById('party-join-code');
  if (input) input.value = String(code || '');
  var nick = typeof partyPrefillNickname === 'function' ? partyPrefillNickname() : document.getElementById('party-nickname');
  if (nick && nick.value.trim() && typeof partyJoinRoom === 'function') partyJoinRoom();
  else if (nick) { try { nick.focus(); } catch (_e) {} }
  pfiPaintPartyCard();
}
window.pfiJoin = pfiJoin;
function pfiDismiss(id) {
  pfiPost('/api/party/invites/dismiss', { id: id });
  pfiState.invites = pfiState.invites.filter(function (i) { return i.id !== id; });
  if (typeof renderInboxHome === 'function') renderInboxHome();
  pfiPaintPartyCard();
}
window.pfiDismiss = pfiDismiss;

// La carte d'invitation passe en tête de la boîte de l'accueil (celle des défis et des messages).
if (typeof frHomeLineHtml === 'function') {
  var frHomeLineHtmlBeforePfi = frHomeLineHtml;
  frHomeLineHtml = function () {
    var out = frHomeLineHtmlBeforePfi.apply(this, arguments) || '';
    return (pfiState.invites.length ? pfiInviteCardHtml(pfiState.invites[0]) : '') + out;
  };
}
if (typeof renderPartyRoom === 'function') {
  var renderPartyRoomBeforePfi = renderPartyRoom;
  renderPartyRoom = function () {
    var out = renderPartyRoomBeforePfi.apply(this, arguments);
    pfiSendIfNeeded();
    pfiPaintWho();
    pfiPaintRoomButton();
    pfiPaintPartyCard();
    return out;
  };
}
if (typeof pl3Paint === 'function') {
  var pl3PaintBeforePfi = pl3Paint;
  pl3Paint = function () {
    var out = pl3PaintBeforePfi.apply(this, arguments);
    pfiPaintWho();
    return out;
  };
}
// La liste d'amis arrive après l'ouverture : on redessine « Avec qui ? » quand elle est là.
if (typeof frRefresh === 'function') {
  var frRefreshBeforePfi = frRefresh;
  frRefresh = function () {
    var out = frRefreshBeforePfi.apply(this, arguments);
    if (out && typeof out.then === 'function') out.then(function () { pfiPaintWho(); pfiPaintRoomButton(); });
    return out;
  };
}
function pfiStart() {
  pfiRefreshInvites();
  if (pfiState.timer) clearInterval(pfiState.timer);
  pfiState.timer = setInterval(function () { if (!document.hidden) pfiRefreshInvites(); }, 60000);
}
document.addEventListener('visibilitychange', function () { if (!document.hidden) pfiRefreshInvites(); });
setTimeout(pfiStart, 2500);
