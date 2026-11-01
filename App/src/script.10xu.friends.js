
// ===== 🤝 Amis (01/11/2026, option B) =====
// « 🤝 Ajouter en ami » on a trainer card; both have to accept (lib/player-friends.js). The list lives
// in « Entre amis », as a second tab next to the Party Room, never floating. No search by name: a
// player is added from their card. Refuse, remove, block. The chat between friends comes next.
var frState = { data: null, loading: null, tab: 'party' };
var FR_ERRORS = {
  login: 'Connecte-toi pour ajouter des amis.',
  unknown: 'Ce joueur est introuvable.',
  self: 'C’est ta propre carte 🙂',
  refused: 'Ce joueur ne peut pas recevoir ta demande.',
  already: 'Vous êtes déjà amis.',
  full: 'Tu as déjà 50 amis : retires-en un pour en ajouter un autre.',
  full_other: 'Ce joueur a déjà 50 amis.',
  limit: '20 demandes par jour au plus. Réessaie demain.',
  rate_limited: 'Doucement 🙂 Réessaie dans un moment.',
};

function frGet(path) {
  return fetch(path, { credentials: 'same-origin', cache: 'no-store' }).then(function (res) { return res.json(); });
}
function frPost(path, body) {
  return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(function (res) { return res.json().catch(function () { return { ok: false }; }); });
}
function frSay(data) {
  showToast(FR_ERRORS[data && data.error] || 'Action impossible pour le moment. Réessaie dans un instant.');
}
function frRefresh() {
  if (!window.__pokedleAuthed) return Promise.resolve(null);
  if (frState.loading) return frState.loading;
  frState.loading = frGet('/api/friends').then(function (data) {
    if (data && data.ok) frState.data = data;
    return frState.data;
  }).catch(function () { return frState.data; }).then(function (data) {
    frState.loading = null;
    renderPartyFriends();
    if (typeof renderInboxUi === 'function') renderInboxUi();
    return data;
  });
  return frState.loading;
}
function frList(key) { return frState.data && Array.isArray(frState.data[key]) ? frState.data[key] : []; }
// The red counts: requests waiting for an answer, and my requests accepted since my last look.
function frPendingCount() {
  if (!window.__pokedleAuthed) return 0;
  return frList('incoming').length + frList('news').length;
}
function frLevel(xp) {
  var tier = typeof getXpTier === 'function' ? getXpTier(Number(xp) || 0) : null;
  return tier ? Number(tier.level) || 1 : 1;
}
function frDay(iso) {
  var d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return '';
  try { return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' }); } catch (_e) { return ''; }
}
function frArgs(list) { return escapeHtml(JSON.stringify(list)); }
function frAvatar(p) { return typeof pcAvatar === 'function' ? pcAvatar(p) : ''; }

// ---- the trainer card: one button that follows the relation
function frCardButtonHtml(rel, pid, name, id) {
  if (rel === 'self') return '';
  if (rel === 'friends') {
    return '<button type="button" class="btn-ghost fr-card-btn is-friend" data-action="frCardMenu" data-args="' + frArgs([pid, name]) + '">✓ Ami</button>';
  }
  if (rel === 'sent') {
    return '<span class="fr-card-wait">⏳ Demande envoyée</span><button type="button" class="fr-card-link" data-action="frCancel" data-args="' + frArgs([pid]) + '">Annuler</button>';
  }
  if (rel === 'received') {
    return '<button type="button" class="btn-blue fr-card-btn" data-action="frRespond" data-args="' + frArgs([id, true, pid]) + '">🤝 Accepter sa demande</button>' +
      '<button type="button" class="fr-card-link" data-action="frRespond" data-args="' + frArgs([id, false, pid]) + '">Refuser</button>';
  }
  if (rel === 'blocked') {
    return '<span class="fr-card-wait">⛔ Tu as bloqué ' + escapeHtml(name) + '</span><button type="button" class="fr-card-link" data-action="frUnblock" data-args="' + frArgs([pid]) + '">Débloquer</button>';
  }
  return '<button type="button" class="btn-ghost fr-card-btn" data-action="frRequest" data-args="' + frArgs([pid, name]) + '">🤝 Ajouter en ami</button>';
}
function frRelationFromCache(pid) {
  var d = frState.data;
  if (!d) return { rel: 'none' };
  if (d.pid && d.pid === pid) return { rel: 'self' };
  if (frList('friends').some(function (f) { return f.pid === pid; })) return { rel: 'friends' };
  var inc = frList('incoming').find(function (f) { return f.pid === pid; });
  if (inc) return { rel: 'received', id: inc.id };
  if (frList('outgoing').some(function (f) { return f.pid === pid; })) return { rel: 'sent' };
  if (frList('blocked').some(function (f) { return f.pid === pid; })) return { rel: 'blocked' };
  return { rel: 'none' };
}
function frCardSlot(pid) {
  return document.querySelector('#overlay-body .fr-card-slot[data-fr-pid="' + pid + '"]');
}
function frPaintCard(pid, rel, id) {
  var slot = frCardSlot(pid);
  if (!slot) return;
  var name = slot.getAttribute('data-fr-name') || 'ce joueur';
  slot.innerHTML = frCardButtonHtml(rel, pid, name, id);
  slot.hidden = rel === 'self';
}
// The cache paints at once; the server answers for sure right after (my own card, a fresh request).
function frCheckCard(pid) {
  frGet('/api/friends/status?pid=' + encodeURIComponent(pid)).then(function (data) {
    if (data && data.ok) frPaintCard(pid, data.relation, data.id);
  }).catch(function () {});
}
if (typeof playerCardHtml === 'function') {
  var frCardBefore = playerCardHtml;
  playerCardHtml = function (data) {
    var html = frCardBefore.apply(this, arguments);
    var player = (data && data.player) || {};
    if (!window.__pokedleAuthed || !/^[0-9a-f]{16}$/.test(String(player.pid || ''))) return html;
    var pid = player.pid, name = player.username || 'Dresseur';
    var known = frRelationFromCache(pid);
    if (known.rel === 'self') return html;
    setTimeout(function () { frCheckCard(pid); }, 0);
    return html.replace('<div class="player-card-figures">', '<div class="fr-card-slot" data-fr-pid="' + escapeHtml(pid) + '" data-fr-name="' + escapeHtml(name) + '">' +
      frCardButtonHtml(known.rel, pid, name, known.id) + '</div><div class="player-card-figures">');
  };
}

function frRequest(pid, name) {
  frPost('/api/friends/request', { pid: pid }).then(function (data) {
    if (!data || !data.ok) { frSay(data); return; }
    frPaintCard(pid, data.relation);
    showToast(data.relation === 'friends' ? '🤝 Vous êtes amis avec ' + name + ' !' : '🤝 Demande envoyée à ' + name + '.');
    frRefresh();
  }).catch(function () { frSay(null); });
}
function frRespond(id, accept, pid) {
  frPost('/api/friends/respond', { id: Number(id), accept: accept !== false }).then(function (data) {
    if (!data || !data.ok) { frSay(data); return; }
    if (pid) frPaintCard(pid, data.relation);
    if (accept !== false) showToast('🤝 Vous êtes amis !');
    frRefresh();
  }).catch(function () { frSay(null); });
}
function frCancel(pid) {
  frPost('/api/friends/remove', { pid: pid }).then(function (data) {
    if (!data || !data.ok) { frSay(data); return; }
    frPaintCard(pid, 'none');
    frRefresh();
  }).catch(function () { frSay(null); });
}
// « ✓ Ami » opens two choices in place: remove, or block.
function frCardMenu(pid, name) {
  var slot = frCardSlot(pid);
  if (!slot) return;
  slot.innerHTML = '<div class="fr-card-menu"><button type="button" class="btn-ghost" data-action="frRemove" data-args="' + frArgs([pid, name]) + '">Retirer de mes amis</button>' +
    '<button type="button" class="btn-ghost fr-danger" data-action="frBlock" data-args="' + frArgs([pid, name]) + '">⛔ Bloquer</button>' +
    '<button type="button" class="fr-card-link" data-action="frPaintCard" data-args="' + frArgs([pid, 'friends']) + '">Annuler</button></div>';
}
function frRemove(pid, name) {
  frPost('/api/friends/remove', { pid: pid }).then(function (data) {
    if (!data || !data.ok) { frSay(data); return; }
    frPaintCard(pid, 'none');
    showToast(name + ' n’est plus dans tes amis.');
    frRefresh();
  }).catch(function () { frSay(null); });
}
function frBlock(pid, name) {
  frPost('/api/friends/block', { pid: pid }).then(function (data) {
    if (!data || !data.ok) { frSay(data); return; }
    frPaintCard(pid, 'blocked');
    showToast('⛔ ' + name + ' est bloqué : plus de demande de sa part.');
    frRefresh();
  }).catch(function () { frSay(null); });
}
function frUnblock(pid) {
  frPost('/api/friends/unblock', { pid: pid }).then(function (data) {
    if (!data || !data.ok) { frSay(data); return; }
    frPaintCard(pid, 'none');
    showToast('Joueur débloqué.');
    frRefresh();
  }).catch(function () { frSay(null); });
}

// ---- « Mes amis », second tab of « Entre amis »
function frPanelHtml() {
  var d = frState.data;
  if (!d) return '<p class="fr-empty">Chargement de tes amis…</p>';
  var incoming = frList('incoming'), friends = frList('friends'), outgoing = frList('outgoing'), blocked = frList('blocked');
  var html = '';
  incoming.forEach(function (f) {
    html += '<div class="fr-req">' + frAvatar(f) + '<p><b>' + escapeHtml(f.username) + '</b> veut être ton ami<small>Niv. ' + frLevel(f.xp) + '</small></p>' +
      '<button type="button" class="btn-blue" data-action="frRespond" data-args="' + frArgs([f.id, true]) + '">Accepter</button>' +
      '<button type="button" class="btn-ghost fr-x" data-action="frRespond" data-args="' + frArgs([f.id, false]) + '" aria-label="Refuser">✕</button>' +
      '<button type="button" class="fr-card-link fr-req-block" data-action="frBlock" data-args="' + frArgs([f.pid, f.username]) + '">Bloquer</button></div>';
  });
  html += '<div class="fr-head"><h3>Mes amis</h3><small>' + friends.length + ' / ' + (Number(d.max) || 50) + '</small></div>';
  if (friends.length) {
    html += '<div class="fr-list">' + friends.map(function (f) {
      var since = frDay(f.since);
      return '<div class="fr-row">' +
        '<button type="button" class="fr-row-main" data-action="openPlayerCard" data-args="' + frArgs([f.pid]) + '">' + frAvatar(f) +
          '<span><b>' + escapeHtml(f.username) + '</b><small>Niv. ' + frLevel(f.xp) + (since ? ' · ami depuis le ' + since : '') + '</small></span></button>' +
        '<button type="button" class="btn-ghost fr-duel" data-action="openChallengeForm" data-args="' + frArgs([f.pid, f.username]) + '" aria-label="Défier ' + escapeHtml(f.username) + '">⚔️</button></div>';
    }).join('') + '</div>';
  } else {
    html += '<p class="fr-empty">Pas encore d’ami. Clique sur un pseudo dans un <button type="button" class="party-duels-link" data-action="openLeaderboardV2" data-args=\'["journey","week"]\'>classement</button>, puis <b>🤝 Ajouter en ami</b>.</p>';
  }
  if (outgoing.length) {
    html += '<h4 class="fr-sub">En attente de réponse</h4><div class="fr-list">' + outgoing.map(function (f) {
      return '<div class="fr-row"><span class="fr-row-main">' + frAvatar(f) + '<span><b>' + escapeHtml(f.username) + '</b><small>Demande envoyée</small></span></span>' +
        '<button type="button" class="fr-card-link" data-action="frCancel" data-args="' + frArgs([f.pid]) + '">Annuler</button></div>';
    }).join('') + '</div>';
  }
  if (blocked.length) {
    html += '<details class="fr-blocked"><summary>Joueurs bloqués (' + blocked.length + ')</summary>' + blocked.map(function (f) {
      return '<div class="fr-row"><span class="fr-row-main">' + frAvatar(f) + '<span><b>' + escapeHtml(f.username) + '</b></span></span>' +
        '<button type="button" class="fr-card-link" data-action="frUnblock" data-args="' + frArgs([f.pid]) + '">Débloquer</button></div>';
    }).join('') + '</details>';
  }
  html += '<p class="fr-note">On ajoute un ami depuis sa carte de dresseur : pas de recherche par pseudo. Une demande sans réponse est effacée au bout de 30 jours.</p>';
  return html;
}
function renderPartyFriends() {
  var screen = document.getElementById('screen-party-room');
  var lobby = document.getElementById('party-lobby');
  if (!screen || !lobby) return;
  var seg = document.getElementById('party-seg'), panel = document.getElementById('party-friends');
  var inRoom = typeof partyRoomState !== 'undefined' && partyRoomState && partyRoomState.room;
  if (!window.__pokedleAuthed || inRoom || lobby.classList.contains('hidden')) {
    if (seg) seg.remove();
    if (panel) panel.remove();
    screen.classList.remove('party-tab-friends');
    return;
  }
  if (!seg) {
    seg = document.createElement('div');
    seg.id = 'party-seg'; seg.className = 'party-seg'; seg.setAttribute('role', 'tablist');
    var anchor = document.getElementById('party-duels') || lobby;
    anchor.parentNode.insertBefore(seg, anchor);
  }
  var count = frPendingCount();
  seg.innerHTML = '<button type="button" role="tab" aria-selected="' + (frState.tab !== 'friends') + '" class="' + (frState.tab !== 'friends' ? 'is-on' : '') + '" data-action="frShowTab" data-args=\'["party"]\'>Party Room</button>' +
    '<button type="button" role="tab" aria-selected="' + (frState.tab === 'friends') + '" class="' + (frState.tab === 'friends' ? 'is-on' : '') + '" data-action="frShowTab" data-args=\'["friends"]\'>Mes amis' + (count ? ' <i class="pc-badge">' + count + '</i>' : '') + '</button>';
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'party-friends'; panel.className = 'party-friends';
    lobby.parentNode.insertBefore(panel, lobby.nextSibling);
  }
  screen.classList.toggle('party-tab-friends', frState.tab === 'friends');
  if (frState.tab === 'friends') panel.innerHTML = frPanelHtml();
}
function frMarkSeen() {
  var d = frState.data;
  if (!d) return;
  var fresh = frList('incoming').some(function (f) { return !f.seen; }) || frList('news').length;
  if (!fresh) return;
  frList('incoming').forEach(function (f) { f.seen = true; });
  d.news = [];
  frPost('/api/friends/seen', {}).catch(function () {});
  renderPartyFriends();
  if (typeof renderInboxUi === 'function') renderInboxUi();
}
function frShowTab(tab) {
  frState.tab = tab === 'friends' ? 'friends' : 'party';
  renderPartyFriends();
  if (frState.tab === 'friends') {
    frRefresh().then(function () { if (frState.tab === 'friends') frMarkSeen(); });
  }
}
function openMyFriends() {
  if (!window.__pokedleAuthed) { showToast(FR_ERRORS.login); return; }
  frState.tab = 'friends';
  if (typeof openPartyRoomMode === 'function') openPartyRoomMode();
  setTimeout(function () { frShowTab('friends'); }, 60);
}
// The home card of 10xs gets one line for a friend request.
function frHomeLineHtml() {
  if (!window.__pokedleAuthed) return '';
  var inc = frList('incoming'), news = frList('news');
  if (inc.length) {
    return '<button type="button" class="home-inbox-line" data-action="openMyFriends"><span>🤝 ' +
      (inc.length > 1 ? inc.length + ' demandes d’ami' : escapeHtml(inc[0].username) + ' veut être ton ami') + '</span><b>Voir →</b></button>';
  }
  if (news.length) {
    return '<button type="button" class="home-inbox-line" data-action="openMyFriends"><span>🤝 ' + escapeHtml(news[0].username) + ' a accepté ta demande</span><b>Voir →</b></button>';
  }
  return '';
}

if (typeof renderPartyRoom === 'function') {
  var frPartyBefore = renderPartyRoom;
  renderPartyRoom = function () { var out = frPartyBefore.apply(this, arguments); renderPartyFriends(); return out; };
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pokedle:auth-ready', function () {
    var fromPush = /[?&]amis=1\b/.test(location.search || '');
    if (fromPush) {
      try {
        var params = new URLSearchParams(location.search);
        params.delete('amis');
        var query = params.toString();
        history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
      } catch (_e) {}
    }
    setTimeout(function () { frRefresh().then(function () { if (fromPush) openMyFriends(); }); }, fromPush ? 300 : 1800);
  });
}
window.frRequest = frRequest;
window.frRespond = frRespond;
window.frCancel = frCancel;
window.frCardMenu = frCardMenu;
window.frRemove = frRemove;
window.frBlock = frBlock;
window.frUnblock = frUnblock;
window.frPaintCard = frPaintCard;
window.frShowTab = frShowTab;
window.openMyFriends = openMyFriends;
