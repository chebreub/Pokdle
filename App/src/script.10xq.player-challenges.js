
// ===== ⚔️ Défis entre joueurs (01/11/2026) =====
// From a trainer card, a signed-in player challenges another one to beat a record of theirs in an
// arcade game. The challenged player sees it at their next visit (and by notification with 🔔),
// plays, and the server decides from the results it records. Ready-made phrases only, no free
// text; a challenge can be refused, a player's challenges stopped, all challenges turned off.
var pcState = { list: null, options: null };
var pcForm = null;
var PC_LAUNCH = {
  higherlower: function () { openHigherLowerMode(); startHigherLowerMode('infinite'); },
  higherlower60: function () { openHigherLowerMode(); startHigherLowerMode('rush60'); },
  poids: function () { startWeightBattle(); },
  intrus: function () { openOddOneOutMode(); },
  typecombo: function () { openTypeComboSolo(); },
  quiz: function () { startQuizGame(); },
  speedrun: function () { openSpeedrunMode(); },
  draft_all: function () { openDraftScoreAttackMode(); },
};
// These games send a result at each right answer: only a won challenge is worth a word mid-run.
var PC_PER_ANSWER = { poids: true, intrus: true };
var PC_ERRORS = {
  mode: 'Choisis un jeu.', phrase: 'Choisis une phrase.', unknown: 'Ce dresseur est introuvable.',
  self: 'Tu ne peux pas te défier toi-même 😄', no_record: 'Il te faut d’abord un record dans ce jeu.',
  refused: 'Ce dresseur ne reçoit pas de défis pour le moment.', limit: 'Tu as lancé 5 défis aujourd’hui : reviens demain !',
  already: 'Ce défi l’attend déjà : laisse-lui le temps de le relever.', login: 'Connecte-toi pour lancer un défi.',
  rate_limited: 'Doucement ! Réessaie dans un moment.',
};

function pcGet(path) {
  return fetch(path, { credentials: 'same-origin', cache: 'no-store' }).then(function (res) { return res.json(); });
}
function pcPost(path, body) {
  return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(function (res) { return res.json().catch(function () { return { ok: false }; }); });
}
function pcLoadOptions(force) {
  if (!window.__pokedleAuthed) return Promise.resolve(null);
  if (pcState.options && !force) return Promise.resolve(pcState.options);
  return pcGet('/api/challenges/options').then(function (data) {
    if (data && data.ok) pcState.options = data;
    return pcState.options;
  }).catch(function () { return pcState.options; });
}
function pcRefresh() {
  if (!window.__pokedleAuthed) return Promise.resolve([]);
  return pcGet('/api/challenges').then(function (data) {
    if (data && data.ok) {
      pcState.list = Array.isArray(data.challenges) ? data.challenges : [];
      pcState.accepting = data.accepting !== false;
    }
    return pcState.list || [];
  }).catch(function () { return pcState.list || []; });
}
function pcFind(id) {
  return (pcState.list || []).find(function (c) { return Number(c.id) === Number(id); }) || null;
}
function pcOpen(c) { return c && c.status === 'open' && Date.parse(c.expiresAt) > Date.now(); }
function pcPendingCount() {
  return (pcState.list || []).filter(function (c) { return c.incoming && pcOpen(c); }).length;
}
function pcDaysLeft(c) { return Math.max(1, Math.ceil((Date.parse(c.expiresAt) - Date.now()) / 86400000)); }
function pcWord(c) { return c.kind === 'serie' ? 'sa série' : 'son record'; }
function pcMyWord(c) { return c.kind === 'serie' ? 'ta série' : 'ton record'; }
function pcArgs(list) { return escapeHtml(JSON.stringify(list)); }
function pcAvatar(other) {
  var p = other && other.partnerId && typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(other.partnerId)) : null;
  return p ? '<img class="pc-avatar" src="' + escapeHtml(getPokemonSprite(p)) + '" alt="" loading="lazy" />' : '<span class="pc-avatar is-letter">' + escapeHtml(String((other && other.username) || 'D').charAt(0).toUpperCase()) + '</span>';
}

// ---- the button on a trainer card
if (typeof playerCardHtml === 'function') {
  var pcCardBefore = playerCardHtml;
  playerCardHtml = function (data) {
    var html = pcCardBefore.apply(this, arguments);
    var player = (data && data.player) || {};
    if (!player.pid || (pcState.options && pcState.options.pid === player.pid)) return html;
    var name = player.username || 'Dresseur';
    var button = window.__pokedleAuthed
      ? '<button type="button" class="btn-duel player-card-duel" data-action="openChallengeForm" data-args="' + pcArgs([player.pid, name]) + '">⚔️ Défier ' + escapeHtml(name) + '</button>'
      : '<p class="player-card-duel-hint">Connecte-toi pour défier ' + escapeHtml(name) + ' ⚔️</p>';
    return html.replace('<div class="player-card-figures">', button + '<div class="player-card-figures">');
  };
}

// ---- « Défier » : a record of mine, a phrase, send
function openChallengeForm(pid, name, mode) {
  if (!window.__pokedleAuthed) { showToast(PC_ERRORS.login); return; }
  pcForm = { pid: String(pid || ''), name: String(name || 'Dresseur'), mode: mode || null, phrase: 0 };
  ensureOverlay('⚔️ Défier ' + pcForm.name, '<div class="pc-form"><p class="pc-empty">Chargement de tes records…</p></div>');
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'challenge';
  pcLoadOptions(true).then(renderChallengeForm);
}
function renderChallengeForm() {
  var box = document.querySelector('#overlay-body .pc-form');
  var o = pcState.options;
  if (!box || !pcForm) return;
  if (!o) { box.innerHTML = '<p class="pc-empty">Défis indisponibles pour le moment. Réessaie dans un instant.</p>'; return; }
  var modes = o.modes.filter(function (m) { return m.record > 0; });
  if (!modes.length) {
    box.innerHTML = '<p class="pc-empty">Il te faut d’abord un record à battre ! Joue à Higher or Lower, au Quiz ou au Duel de poids, puis reviens défier ' + escapeHtml(pcForm.name) + '.</p>';
    return;
  }
  if (!modes.some(function (m) { return m.mode === pcForm.mode; })) pcForm.mode = modes[0].mode;
  box.innerHTML = '<p class="pc-step">Ton record à battre</p><div class="pc-modes">' + modes.map(function (m) {
      return '<button type="button" class="pc-mode" data-pc-mode="' + escapeHtml(m.mode) + '" aria-pressed="' + (m.mode === pcForm.mode) + '"><span>' + (m.kind === 'serie' ? '🔥 ' : '🏆 ') + escapeHtml(m.label) + '</span><b>' + Number(m.record) + '</b></button>';
    }).join('') + '</div>' +
    '<p class="pc-step">Ton message</p><div class="pc-phrases">' + o.phrases.map(function (p, i) {
      return '<button type="button" class="pc-phrase" data-pc-phrase="' + i + '" aria-pressed="' + (i === pcForm.phrase) + '">' + escapeHtml(p) + '</button>';
    }).join('') + '</div>' +
    '<p class="pc-summary"></p>' +
    '<button type="button" class="btn-blue pc-send" data-action="sendChallenge"' + (o.left > 0 ? '' : ' disabled') + '>⚔️ Envoyer le défi</button>' +
    '<p class="pc-status" role="status" aria-live="polite">' + (o.left > 0 ? '' : escapeHtml(PC_ERRORS.limit)) + '</p>' +
    '<p class="pc-note">' + Number(o.left) + ' défi' + (o.left > 1 ? 's' : '') + ' possible' + (o.left > 1 ? 's' : '') + ' aujourd’hui · ' + escapeHtml(pcForm.name) + ' aura ' + Number(o.days) + ' jours pour le relever</p>';
  pcSummary();
  box.onclick = function (event) {
    var mode = event.target.closest('[data-pc-mode]'), phrase = event.target.closest('[data-pc-phrase]');
    if (mode) pcForm.mode = mode.dataset.pcMode;
    else if (phrase) pcForm.phrase = Number(phrase.dataset.pcPhrase);
    else return;
    box.querySelectorAll('[data-pc-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pcMode === pcForm.mode)); });
    box.querySelectorAll('[data-pc-phrase]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.pcPhrase) === pcForm.phrase)); });
    pcSummary();
  };
}
function pcSummary() {
  var line = document.querySelector('#overlay-body .pc-summary');
  var m = pcState.options && pcState.options.modes.find(function (x) { return x.mode === pcForm.mode; });
  if (line && m) line.textContent = pcForm.name + ' devra faire plus de ' + m.record + ' au ' + m.label + '.';
}
function sendChallenge() {
  var status = document.querySelector('#overlay-body .pc-status');
  var button = document.querySelector('#overlay-body .pc-send');
  if (!pcForm) return;
  if (button) button.disabled = true;
  pcPost('/api/challenges', { pid: pcForm.pid, mode: pcForm.mode, phrase: pcForm.phrase }).then(function (data) {
    if (!data || !data.ok) {
      if (status) status.textContent = PC_ERRORS[data && data.error] || 'Envoi impossible pour le moment. Réessaie dans un instant.';
      if (button) button.disabled = Boolean(data && (data.error === 'limit' || data.error === 'refused'));
      return;
    }
    if (pcState.options) pcState.options.left = Math.max(0, pcState.options.left - 1);
    pcState.list = null;
    var box = document.querySelector('#overlay-body .pc-form');
    if (box) box.innerHTML = '<div class="pc-sent"><b>Défi envoyé ⚔️</b><p>' + escapeHtml(pcForm.name) + ' le verra à sa prochaine visite. Tu seras prévenu s’il fait mieux que ' + Number(data.target) + '.</p>' +
      '<button type="button" class="btn-ghost" data-action="closeOverlayModal">OK</button></div>';
  }).catch(function () {
    if (status) status.textContent = 'Envoi impossible pour le moment. Réessaie dans un instant.';
    if (button) button.disabled = false;
  });
}

// ---- a challenge received, and what became of the ones sent
function pcIncomingHtml(c) {
  var open = pcOpen(c);
  var state = open ? 'expire dans ' + pcDaysLeft(c) + ' j'
    : c.status === 'won' ? '✅ Réussi : ' + Number(c.best) + ' contre ' + Number(c.target)
    : c.status === 'declined' ? 'Refusé' : '⏳ Pas battu à temps' + (c.best ? ' (meilleur : ' + Number(c.best) + ')' : '');
  return '<article class="pc-card' + (open ? ' is-open' : '') + '">' +
    '<div class="pc-who">' + pcAvatar(c.other) + '<div><b>' + escapeHtml(c.other.username) + ' te défie</b><small>' + escapeHtml(state) + '</small></div></div>' +
    '<div class="pc-goal"><b>' + Number(c.target) + '</b><span>Bats ' + pcWord(c) + '<br>au ' + escapeHtml(c.label) + '</span></div>' +
    '<span class="pc-quote">« ' + escapeHtml(c.phrase) + ' »</span>' +
    (open ? '<div class="pc-actions"><button type="button" class="btn-blue" data-action="acceptChallenge" data-args="[' + Number(c.id) + ']">Relever le défi</button></div>' +
      '<details class="pc-more"><summary>Refuser…</summary><button type="button" data-action="declineChallenge" data-args="[' + Number(c.id) + ']">Refuser ce défi</button>' +
      '<button type="button" data-action="blockChallenger" data-args="[' + Number(c.id) + ']">Ne plus recevoir les défis de ' + escapeHtml(c.other.username) + '</button></details>'
      : c.status !== 'declined' ? '<button type="button" class="btn-ghost pc-again" data-action="openChallengeForm" data-args="' + pcArgs([c.other.pid, c.other.username, c.mode]) + '">⚔️ Défier ' + escapeHtml(c.other.username) + ' à ton tour</button>' : '') +
    '</article>';
}
function pcSentHtml(c) {
  var name = '<b>' + escapeHtml(c.other.username) + '</b>';
  var line = pcOpen(c) ? '⚔️ ' + name + ' doit faire plus de ' + Number(c.target) + ' au ' + escapeHtml(c.label) + (c.best ? ' · meilleur : ' + Number(c.best) : '') + ' · encore ' + pcDaysLeft(c) + ' j'
    : c.status === 'won' ? '🏆 ' + name + ' a battu ' + pcMyWord(c) + ' au ' + escapeHtml(c.label) + ' : ' + Number(c.best) + ' contre ' + Number(c.target) + '.'
    : c.status === 'declined' ? name + ' a passé son tour pour ton défi au ' + escapeHtml(c.label) + '.'
    : '💪 ' + name + ' n’a pas battu ' + pcMyWord(c) + ' au ' + escapeHtml(c.label) + (c.best ? ' (meilleur : ' + Number(c.best) + ' / ' + Number(c.target) + ')' : '') + '.';
  var again = !pcOpen(c) ? '<button type="button" class="btn-ghost pc-again" data-action="openChallengeForm" data-args="' + pcArgs([c.other.pid, c.other.username, c.mode]) + '">' + (c.status === 'won' ? '⚔️ Revanche' : '⚔️ Redéfier') + '</button>' : '';
  return '<div class="pc-row">' + pcAvatar(c.other) + '<p>' + line + '</p>' + again + '</div>';
}

function pcMarkSeen(list) {
  var ids = list.filter(function (c) { return !c.seen; }).map(function (c) { return Number(c.id); });
  if (!ids.length) return;
  list.forEach(function (c) { c.seen = true; });
  pcPost('/api/challenges/seen', { ids: ids }).catch(function () {});
}
// At a visit: the new challenges received, then the news of the ones sent.
function pcShowNews(tries) {
  var list = pcState.list || [];
  var fresh = list.filter(function (c) { return !c.seen && (c.incoming ? pcOpen(c) : c.status !== 'open'); });
  if (!fresh.length) return;
  var overlay = document.getElementById('overlay-modal');
  if (overlay && !overlay.classList.contains('hidden')) {
    if ((tries || 0) < 60) setTimeout(function () { pcShowNews((tries || 0) + 1); }, 3000);
    return;
  }
  var incoming = fresh.filter(function (c) { return c.incoming; });
  var sent = fresh.filter(function (c) { return !c.incoming; });
  var title = !sent.length ? (incoming.length > 1 ? '⚔️ Des défis pour toi' : '⚔️ Un défi pour toi') : '⚔️ Du nouveau dans tes défis';
  ensureOverlay(title, '<div class="pc-list">' + incoming.map(pcIncomingHtml).join('') +
    (sent.length ? '<h4>Tes défis envoyés</h4>' + sent.map(pcSentHtml).join('') : '') +
    '<button type="button" class="btn-ghost pc-later" data-action="closeOverlayModal">Plus tard</button></div>');
  if (overlay) overlay.dataset.kind = 'challenge';
  pcMarkSeen(fresh);
}

// ---- ⚔️ Mes défis (account menu)
function openMyChallenges() {
  if (!window.__pokedleAuthed) { showToast(PC_ERRORS.login); return; }
  ensureOverlay('⚔️ Mes défis', '<div class="pc-list"><p class="pc-empty">Chargement…</p></div>');
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'challenge';
  pcRefresh().then(renderMyChallenges);
}
function renderMyChallenges() {
  var box = document.querySelector('#overlay-body .pc-list');
  if (!box) return;
  var list = pcState.list || [];
  var incoming = list.filter(function (c) { return c.incoming; });
  var sent = list.filter(function (c) { return !c.incoming; });
  box.innerHTML = '<h4>Reçus</h4>' + (incoming.length ? incoming.map(pcIncomingHtml).join('') : '<p class="pc-empty">Aucun défi reçu pour l’instant.</p>') +
    '<h4>Envoyés</h4>' + (sent.length ? sent.map(pcSentHtml).join('') : '<p class="pc-empty">Pour défier quelqu’un : clique sur son pseudo dans un classement, puis ⚔️ Défier.</p>') +
    '<label class="pc-accept"><input type="checkbox" data-pc-accept' + (pcState.accepting !== false ? ' checked' : '') + '> Recevoir des défis des autres joueurs</label>' +
    '<p class="pc-note">Un défi dure 7 jours. Tout est effacé au bout de 30 jours, ou avec ton compte.</p>';
  var box2 = box.querySelector('[data-pc-accept]');
  if (box2) box2.onchange = function () {
    pcPost('/api/challenges/settings', { accepting: box2.checked }).then(function (data) {
      if (data && data.ok) { pcState.accepting = data.accepting; showToast(data.accepting ? 'Tu reçois de nouveau les défis ✓' : 'Tu ne recevras plus de défis'); }
    });
  };
  pcMarkSeen(list);
}

function acceptChallenge(id) {
  var c = pcFind(id);
  if (!c || !PC_LAUNCH[c.mode]) return;
  closeOverlayModal();
  try { PC_LAUNCH[c.mode](); } catch (_e) { showToast('Ce jeu n’a pas pu s’ouvrir.'); return; }
  setTimeout(function () { showToast('⚔️ Défi de ' + c.other.username + ' : fais plus de ' + Number(c.target) + ' !'); }, 500);
}
function declineChallenge(id) {
  pcPost('/api/challenges/decline', { id: Number(id) }).then(function () { return pcRefresh(); }).then(function () {
    showToast('Défi refusé');
    if (document.querySelector('#overlay-body .pc-list h4')) renderMyChallenges(); else closeOverlayModal();
  });
}
function blockChallenger(id) {
  var c = pcFind(id);
  pcPost('/api/challenges/block', { id: Number(id) }).then(function () { return pcRefresh(); }).then(function () {
    showToast('Tu ne recevras plus les défis de ' + (c ? c.other.username : 'ce joueur'));
    if (document.querySelector('#overlay-body .pc-list h4')) renderMyChallenges(); else closeOverlayModal();
  });
}

// ---- after a game: did that result win a challenge?
function pcAfterResult(mode, score) {
  var before = (pcState.list || []).filter(function (c) { return c.incoming && c.mode === mode && pcOpen(c); });
  if (!before.length) return;
  pcRefresh().then(function () {
    before.forEach(function (old) {
      var c = pcFind(old.id);
      if (!c) return;
      if (c.status === 'won') {
        showToast('🏆 Défi réussi ! ' + Number(c.best) + ' contre ' + Number(c.target) + ' : ' + c.other.username + ' est prévenu.');
      } else if (!PC_PER_ANSWER[mode] && pcOpen(c)) {
        showToast('⚔️ ' + Number(score) + ' / ' + Number(c.target) + ' : encore ' + pcDaysLeft(c) + ' j pour battre ' + c.other.username);
      }
    });
  });
}
if (typeof submitLeaderboardResult === 'function') {
  var pcSubmitBefore = submitLeaderboardResult;
  submitLeaderboardResult = function (mode, score) {
    var out = pcSubmitBefore.apply(this, arguments);
    var waiting = PC_LAUNCH[mode] && (pcState.list || []).some(function (c) { return c.incoming && c.mode === mode && pcOpen(c); });
    if (waiting) Promise.resolve(out).then(function (ok) { if (ok) pcAfterResult(mode, score); });
    return out;
  };
  window.submitLeaderboardResult = submitLeaderboardResult;
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pokedle:auth-ready', function () {
    // Opened from the notification (?defis=1): the list right away; otherwise the news once the home has settled.
    var fromPush = /[?&]defis=1\b/.test(location.search || '');
    if (fromPush) {
      try {
        var params = new URLSearchParams(location.search);
        params.delete('defis');
        var query = params.toString();
        history.replaceState(history.state, '', location.pathname + (query ? '?' + query : '') + location.hash);
      } catch (_e) {}
    }
    pcLoadOptions(false);
    setTimeout(function () {
      if (fromPush) openMyChallenges();
      else pcRefresh().then(function () { pcShowNews(0); });
    }, fromPush ? 400 : 2600);
  });
}

Object.assign(window, { openChallengeForm: openChallengeForm, sendChallenge: sendChallenge, openMyChallenges: openMyChallenges,
  acceptChallenge: acceptChallenge, declineChallenge: declineChallenge, blockChallenger: blockChallenger, pcPendingCount: pcPendingCount });
