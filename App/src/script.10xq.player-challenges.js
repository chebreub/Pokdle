
// ===== ⚔️ Défis entre joueurs (01/11/2026) =====
// From a trainer card, a signed-in player challenges another one to beat a record of theirs in an
// arcade game. The challenged player sees it at their next visit (and by notification with 🔔),
// plays, and the server decides from the results it records. Ready-made phrases (a free message
// only between friends, Défis v2); a challenge can be refused, a player's challenges stopped,
// all challenges turned off.
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
  // Défis v2 (01/11/2026): the Draft of one generation opens on that generation.
  draft_1: function () { pcOpenDraft(1); },
  draft_2: function () { pcOpenDraft(2); },
  draft_3: function () { pcOpenDraft(3); },
  draft_4: function () { pcOpenDraft(4); },
  draft_5: function () { pcOpenDraft(5); },
  draft_6: function () { pcOpenDraft(6); },
  draft_7: function () { pcOpenDraft(7); },
  draft_8: function () { pcOpenDraft(8); },
  draft_9: function () { pcOpenDraft(9); },
  // Défis v2: 7 more games. The guessing games play a series of 10, whatever size the player keeps.
  party: function () { startPartyMode(); },
  pixel10: function () { startGuessSeries('pixel', 10); },
  silhouette10: function () { startGuessSeries('silhouette', 10); },
  cry10: function () { startGuessSeries('cry', 10); },
  description10: function () { startGuessSeries('description', 10); },
  shiny: function () { openShinyMode(); },
  petitbac: function () { openPetitBacMode(); },
};
function pcOpenDraft(gen) {
  openDraftScoreAttackMode();
  if (typeof selectDraftGeneration === 'function') selectDraftGeneration(gen);
}
// « 📅 Du jour » : fewer tries than the challenger at today's Pokémon du jour.
var PC_DAILY = 'jour';
// These games send a result at each right answer: only a won challenge is worth a word mid-run.
var PC_PER_ANSWER = { poids: true, intrus: true };
var PC_ERRORS = {
  mode: 'Choisis un jeu.', phrase: 'Choisis une phrase.', unknown: 'Ce dresseur est introuvable.',
  self: 'Tu ne peux pas te défier toi-même 😄', no_record: 'Il te faut d’abord un record dans ce jeu.',
  refused: 'Ce dresseur ne reçoit pas de défis pour le moment.', limit: 'Plus de défi possible aujourd’hui : reviens demain !',
  already: 'Ce défi l’attend déjà : laisse-lui le temps de le relever.', login: 'Connecte-toi pour lancer un défi.',
  rate_limited: 'Doucement ! Réessaie dans un moment.', pokemon: 'Choisis un Pokémon dans la liste.', attempts: 'Choisis un nombre d’essais.',
  days: 'Choisis une durée.', no_daily: 'Trouve d’abord le Pokémon du jour : ton nombre d’essais sera la cible.',
  note_friends: 'Le message libre est réservé à tes amis.', note: 'Ton message fait 100 caractères au plus.',
  note_contact: '🔒 Pas de liens ni de numéros dans le message.',
  daily_done: 'Il a déjà joué le Pokémon du jour aujourd’hui.',
};
// The goal of a record challenge: beat it, or match it when it is already the game's maximum.
function pcAtMax(c) { return Boolean(c.max) && Number(c.target) >= Number(c.max); }
function pcGoalText(c) { return pcAtMax(c) ? 'fais ' + Number(c.max) + ' / ' + Number(c.max) : 'fais plus de ' + Number(c.target); }

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

// ---- « Défier » : a record of mine, or a Pokémon to find; a phrase; send
var PC_MYSTERY = 'pokemon';
var PC_MYSTERY_PHRASE = 5;
function pcSecretPool() {
  return (typeof POKEMON_LIST !== 'undefined' ? POKEMON_LIST : []).filter(function (p) { return p && !p.isAltForm && Number(p.id) <= 1025; });
}
function pcFold(text) { return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase(); }
function pcMatches(query, skip) {
  var q = pcFold(query);
  if (!q) return [];
  var pool = pcSecretPool().filter(function (p) { return !(skip && skip.has(Number(p.id))); });
  var starts = pool.filter(function (p) { return pcFold(p.name).indexOf(q) === 0; });
  var inside = pool.filter(function (p) { var f = pcFold(p.name); return f.indexOf(q) > 0; });
  return starts.concat(inside).slice(0, 6);
}
function pcSuggestHtml(list) {
  return list.map(function (p) {
    return '<button type="button" class="pc-suggest" data-pc-pick="' + Number(p.id) + '"><img src="' + escapeHtml(getPokemonSprite(p)) + '" alt="" loading="lazy" /><span>' + escapeHtml(p.name) + '</span></button>';
  }).join('');
}
function pcIsFriend(pid) {
  return typeof frRelationFromCache === 'function' && frRelationFromCache(pid).rel === 'friends';
}
function pcFriendsList() {
  return typeof frList === 'function' ? frList('friends') : [];
}
function openChallengeForm(pid, name, mode) {
  if (!window.__pokedleAuthed) { showToast(PC_ERRORS.login); return; }
  pcForm = { pid: String(pid || ''), name: String(name || 'Dresseur'), mode: mode && mode !== PC_MYSTERY && mode !== PC_DAILY ? mode : null, phrase: 0,
    tab: mode === PC_MYSTERY ? 'pokemon' : mode === PC_DAILY ? 'jour' : null, pokemonId: null, attempts: 8, days: 7, note: '', extra: [] };
  ensureOverlay('⚔️ Défier ' + pcForm.name, '<div class="pc-form"><p class="pc-empty">Chargement de tes records…</p></div>');
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'challenge';
  pcLoadOptions(true).then(renderChallengeForm);
}
function pcModeTile(m, label, sub, on) {
  return '<button type="button" class="pc-mode' + (m.record ? '' : ' is-new') + '" data-pc-mode="' + escapeHtml(m.mode) + '" aria-pressed="' + on + '"><span>' + escapeHtml(label) + '</span>' +
    '<b>' + (m.record ? Number(m.record) : '') + '</b><small>' + escapeHtml(sub) + '</small></button>';
}
function renderChallengeForm() {
  var box = document.querySelector('#overlay-body .pc-form');
  var o = pcState.options;
  if (!box || !pcForm) return;
  if (!o) { box.innerHTML = '<p class="pc-empty">Défis indisponibles pour le moment. Réessaie dans un instant.</p>'; return; }
  var isDraft = function (m) { return /^draft_\d$/.test(m.mode); };
  var main = o.modes.filter(function (m) { return !isDraft(m); });
  var drafts = [o.modes.find(function (m) { return m.mode === 'draft_all'; })].concat(o.modes.filter(isDraft)).filter(Boolean);
  var mystery = Boolean(o.mystery);
  if (!pcForm.tab) pcForm.tab = 'record';
  if (!pcForm.mode) {
    var first = o.modes.find(function (m) { return m.record > 0; });
    pcForm.mode = first ? first.mode : main[0].mode;
  }
  var friend = pcIsFriend(pcForm.pid);
  var tab = function (key, label) { return '<button type="button" role="tab" data-pc-tab="' + key + '" aria-selected="' + (pcForm.tab === key) + '">' + label + '</button>'; };
  var tabs = '<div class="pc-tabs pc-tabs-3" role="tablist">' + tab('record', '🏆 Record') + (mystery ? tab('pokemon', '🔍 Pokémon') : '') + tab('jour', '📅 Du jour') + '</div>';
  var body = '', ready = true, playFirst = false;
  if (pcForm.tab === 'pokemon') {
    var chosen = pcForm.pokemonId && typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(pcForm.pokemonId)) : null;
    body = '<p class="pc-step">Ton Pokémon mystère</p>' +
      '<input type="search" class="pc-search" placeholder="Tape un nom de Pokémon…" autocomplete="off" aria-label="Choisir un Pokémon" />' +
      '<div class="pc-suggests"></div>' +
      (chosen ? '<div class="pc-chosen"><img src="' + escapeHtml(pokedexDetailArtwork(chosen, false)) + '" data-fallback="' + escapeHtml(getPokemonSprite(chosen)) + '" alt="" /><div><b>' + escapeHtml(chosen.name) + '</b>' +
        '<small>Il le cherche avec les indices du Pokémon du jour</small><span class="pc-lock">🔒 Caché : il ne voit jamais le nom</span></div></div>' : '') +
      '<p class="pc-step">Nombre d’essais</p><div class="pc-attempts">' + o.mystery.attempts.map(function (n, i) {
        var hint = i === 0 ? ' · dur' : i === o.mystery.attempts.length - 1 ? ' · facile' : '';
        return '<button type="button" data-pc-attempts="' + n + '" aria-pressed="' + (n === pcForm.attempts) + '">' + n + hint + '</button>';
      }).join('') + '</div>';
    ready = Boolean(pcForm.pokemonId);
  } else if (pcForm.tab === 'jour') {
    body = o.daily
      ? '<div class="pc-daily"><span class="pc-daily-n">' + Number(o.daily.tries) + '</span><p><b>Ton Pokémon du jour : ' + Number(o.daily.tries) + ' essai' + (o.daily.tries > 1 ? 's' : '') + '</b>' +
        '<small>' + escapeHtml(pcForm.name) + ' devra le trouver en moins d’essais, avant minuit.</small></p></div>'
      : '<div class="pc-daily is-todo"><p><b>Trouve d’abord le Pokémon du jour</b><small>Ton nombre d’essais deviendra la cible.</small></p>' +
        '<button type="button" class="btn-blue" data-action="pcPlayDaily">Jouer au Pokémon du jour</button></div>';
    ready = Boolean(o.daily);
  } else {
    if (!o.modes.some(function (m) { return m.mode === pcForm.mode; })) pcForm.mode = main[0].mode;
    var chosenMode = o.modes.find(function (m) { return m.mode === pcForm.mode; });
    var draftOn = isDraft(chosenMode) || chosenMode.mode === 'draft_all';
    body = '<p class="pc-step">Le jeu</p><div class="pc-modes">' + main.map(function (m) {
      var isDraftTile = m.mode === 'draft_all';
      var label = isDraftTile ? 'Draft' : m.label;
      var sub = isDraftTile ? 'par génération' : m.record ? (m.kind === 'serie' ? 'ta série' : 'ton record') : 'à jouer';
      return pcModeTile(isDraftTile ? Object.assign({}, m, { record: m.record }) : m, label, sub, isDraftTile ? draftOn : m.mode === pcForm.mode);
    }).join('') + '</div>' +
      (draftOn ? '<p class="pc-step">Quelle génération ?</p><div class="pc-gens">' + drafts.map(function (m) {
        var label = m.mode === 'draft_all' ? 'Toutes' : 'Gen ' + m.mode.slice(6);
        return '<button type="button" data-pc-mode="' + m.mode + '" aria-pressed="' + (m.mode === pcForm.mode) + '">' + label + '<small>' + (m.record ? Number(m.record) : 'à jouer') + '</small></button>';
      }).join('') + '</div>' : '');
    if (!chosenMode.record) {
      playFirst = true;
      body += '<div class="pc-first">🎮 Tu n’as pas encore de score ici : <b>joue d’abord</b>, ton score deviendra la cible et le défi partira tout seul.</div>';
    }
  }
  var dur = pcForm.tab === 'jour' ? '' : '<p class="pc-step">Durée</p><div class="pc-days">' + (o.dayChoices || [7]).map(function (d) {
    return '<button type="button" data-pc-days="' + d + '" aria-pressed="' + (d === pcForm.days) + '">' + (d === 1 ? '24 h' : d + ' jours') + '</button>';
  }).join('') + '</div>';
  var message = '<p class="pc-step">Ton message</p>' +
    (friend ? '<input type="text" class="pc-note-input" maxlength="' + Number(o.noteMax || 100) + '" placeholder="Écris-lui un mot (facultatif)" value="' + escapeHtml(pcForm.note) + '" aria-label="Ton message" />' : '') +
    '<div class="pc-phrases">' + o.phrases.map(function (p, i) {
      return '<button type="button" class="pc-phrase" data-pc-phrase="' + i + '" aria-pressed="' + (i === pcForm.phrase && !pcForm.note) + '">' + escapeHtml(p) + '</button>';
    }).join('') + '</div>';
  // Défier plusieurs amis d'un coup (les amis seulement).
  var others = pcFriendsList().filter(function (f) { return f.pid !== pcForm.pid; });
  var extra = others.length && !playFirst ? '<p class="pc-step">Envoyer aussi à</p><div class="pc-extra">' + others.slice(0, 12).map(function (f) {
    return '<button type="button" data-pc-extra="' + escapeHtml(f.pid) + '" aria-pressed="' + (pcForm.extra.indexOf(f.pid) >= 0) + '">' + escapeHtml(f.username) + '</button>';
  }).join('') + (others.length > 1 ? '<button type="button" data-pc-allfriends="1" class="is-all">+ Tous mes amis</button>' : '') + '</div>' : '';
  var left = friend ? o.leftFriends : o.left;
  var count = 1 + pcForm.extra.length;
  box.innerHTML = tabs + body + dur + message + extra +
    '<p class="pc-summary"></p>' +
    '<button type="button" class="btn-blue pc-send" data-action="' + (playFirst ? 'pcPlayFirst' : 'sendChallenge') + '"' + (left > 0 && ready ? '' : ' disabled') + '>' +
      (playFirst ? '▶ Jouer puis envoyer' : '⚔️ Envoyer le défi' + (count > 1 ? ' à ' + count + ' joueurs' : '')) + '</button>' +
    '<p class="pc-status" role="status" aria-live="polite">' + (left > 0 ? '' : escapeHtml(PC_ERRORS.limit)) + '</p>' +
    '<p class="pc-note">' + Number(left) + ' défi' + (left > 1 ? 's' : '') + ' possible' + (left > 1 ? 's' : '') + ' aujourd’hui (' + Number(o.perDayFriends || 20) + ' entre amis, ' + Number(o.perDay || 5) + ' avec les autres)</p>';
  pcSummary();
  var search = box.querySelector('.pc-search');
  if (search) search.oninput = function () {
    var list = box.querySelector('.pc-suggests');
    if (list) list.innerHTML = pcSuggestHtml(pcMatches(search.value));
  };
  var noteInput = box.querySelector('.pc-note-input');
  if (noteInput) noteInput.oninput = function () {
    pcForm.note = noteInput.value;
    box.querySelectorAll('[data-pc-phrase]').forEach(function (b) { b.setAttribute('aria-pressed', String(!pcForm.note && Number(b.dataset.pcPhrase) === pcForm.phrase)); });
  };
  box.onclick = function (event) {
    var t = event.target;
    var tabEl = t.closest('[data-pc-tab]'), mode = t.closest('[data-pc-mode]'), phrase = t.closest('[data-pc-phrase]');
    var pick = t.closest('[data-pc-pick]'), tries = t.closest('[data-pc-attempts]'), days = t.closest('[data-pc-days]');
    var extraEl = t.closest('[data-pc-extra]'), all = t.closest('[data-pc-allfriends]');
    if (tabEl) {
      pcForm.tab = tabEl.dataset.pcTab;
      if (pcForm.tab === 'pokemon' && pcForm.phrase === 0) pcForm.phrase = PC_MYSTERY_PHRASE;
    } else if (pick) pcForm.pokemonId = Number(pick.dataset.pcPick);
    else if (tries) pcForm.attempts = Number(tries.dataset.pcAttempts);
    else if (mode) pcForm.mode = mode.dataset.pcMode === 'draft_all' && /^draft_\d$/.test(pcForm.mode) && !mode.closest('.pc-gens') ? pcForm.mode : mode.dataset.pcMode;
    else if (phrase) { pcForm.phrase = Number(phrase.dataset.pcPhrase); pcForm.note = ''; }
    else if (days) pcForm.days = Number(days.dataset.pcDays);
    else if (extraEl) {
      var at = pcForm.extra.indexOf(extraEl.dataset.pcExtra);
      if (at >= 0) pcForm.extra.splice(at, 1); else pcForm.extra.push(extraEl.dataset.pcExtra);
    } else if (all) pcForm.extra = others.map(function (f) { return f.pid; });
    else return;
    renderChallengeForm();
  };
}
function pcSummary() {
  var line = document.querySelector('#overlay-body .pc-summary');
  if (!line || !pcForm) return;
  if (pcForm.tab === 'pokemon') {
    line.textContent = pcForm.pokemonId ? pcForm.name + ' devra le trouver en ' + pcForm.attempts + ' essais au plus.' : 'Choisis le Pokémon qu’il devra trouver.';
    return;
  }
  if (pcForm.tab === 'jour') { line.textContent = ''; return; }
  var m = pcState.options && pcState.options.modes.find(function (x) { return x.mode === pcForm.mode; });
  if (m) line.textContent = m.record ? pcForm.name + ' devra ' + pcGoalText({ target: m.record, max: m.max }).replace(/^fais/, 'faire') + ' au ' + m.label + '.' : '';
}
function pcPayload(pid) {
  var base = { pid: pid, phrase: pcForm.phrase };
  if (pcForm.tab !== 'jour') base.days = pcForm.days;
  // A free message only goes to friends (the server checks it too).
  if (pcForm.note && pcForm.note.trim() && (pid !== pcForm.pid || pcIsFriend(pid))) base.note = pcForm.note.trim();
  if (pcForm.tab === 'pokemon') return Object.assign(base, { mode: PC_MYSTERY, pokemonId: pcForm.pokemonId, attempts: pcForm.attempts });
  if (pcForm.tab === 'jour') return Object.assign(base, { mode: PC_DAILY });
  return Object.assign(base, { mode: pcForm.mode });
}
// One request per player, one after the other; the first refusal is told, the rest go on.
function pcSendTo(pids, payloadOf) {
  var sent = [], failed = [];
  return pids.reduce(function (chain, pid) {
    return chain.then(function () {
      return pcPost('/api/challenges', payloadOf(pid)).then(function (data) {
        if (data && data.ok) sent.push({ pid: pid, target: data.target }); else failed.push({ pid: pid, error: data && data.error });
      }).catch(function () { failed.push({ pid: pid, error: 'network' }); });
    });
  }, Promise.resolve()).then(function () { return { sent: sent, failed: failed }; });
}
function pcNameOf(pid) {
  if (pcForm && pid === pcForm.pid) return pcForm.name;
  var f = pcFriendsList().find(function (x) { return x.pid === pid; });
  return f ? f.username : 'un joueur';
}
function sendChallenge() {
  var status = document.querySelector('#overlay-body .pc-status');
  var button = document.querySelector('#overlay-body .pc-send');
  if (!pcForm) return;
  var mystery = pcForm.tab === 'pokemon', daily = pcForm.tab === 'jour';
  if (button) button.disabled = true;
  var pids = [pcForm.pid].concat(pcForm.extra);
  pcSendTo(pids, pcPayload).then(function (result) {
    if (!result.sent.length) {
      var error = result.failed[0] && result.failed[0].error;
      if (status) status.textContent = PC_ERRORS[error] || 'Envoi impossible pour le moment. Réessaie dans un instant.';
      if (button) button.disabled = Boolean(error === 'limit' || error === 'refused');
      return;
    }
    if (pcState.options) pcState.options.left = Math.max(0, pcState.options.left - result.sent.length);
    pcState.list = null;
    var target = result.sent[0].target;
    var names = result.sent.map(function (x) { return pcNameOf(x.pid); });
    var who = names.length > 1 ? names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1] : names[0];
    var box = document.querySelector('#overlay-body .pc-form');
    if (box) box.innerHTML = '<div class="pc-sent"><b>Défi envoyé ⚔️</b><p>' + escapeHtml(who) + (names.length > 1 ? ' le verront' : ' le verra') + ' à la prochaine visite. ' +
      (mystery ? 'Tu seras prévenu s’il trouve ton Pokémon… ou pas.' : daily ? 'Tu seras prévenu si quelqu’un fait moins de ' + Number(target) + ' essais avant minuit.' : 'Tu seras prévenu si quelqu’un fait mieux que ' + Number(target) + '.') + '</p>' +
      (result.failed.length ? '<p class="pc-note">Pas envoyé à ' + escapeHtml(result.failed.map(function (x) { return pcNameOf(x.pid); }).join(', ')) + ' : ' + escapeHtml(PC_ERRORS[result.failed[0].error] || 'réessaie plus tard.') + '</p>' : '') +
      (typeof notifAskHtml === 'function' ? notifAskHtml(pcForm.name, 'sent') : '') +
      '<button type="button" class="btn-ghost" data-action="closeOverlayModal">OK</button></div>';
  });
}
// « Jouer puis envoyer » : no score yet in that game; the challenge leaves once the game has one.
var pcPending = null;
function pcPlayFirst() {
  if (!pcForm || !PC_LAUNCH[pcForm.mode]) return;
  var form = pcForm;
  pcPending = { mode: form.mode, pids: [form.pid].concat(form.extra), payload: pcPayload(form.pid), name: form.name, timer: null };
  closeOverlayModal();
  try { PC_LAUNCH[form.mode](); } catch (_e) { pcPending = null; showToast('Ce jeu n’a pas pu s’ouvrir.'); return; }
  setTimeout(function () { showToast('🎮 Joue ta partie : ton score partira en défi à ' + form.name + '.'); }, 500);
}
function pcSendPending() {
  var pending = pcPending;
  pcPending = null;
  if (!pending) return;
  pcSendTo(pending.pids, function (pid) { return Object.assign({}, pending.payload, { pid: pid }); }).then(function (result) {
    if (result.sent.length) showToast('⚔️ Défi envoyé à ' + pending.name + (result.sent.length > 1 ? ' et ' + (result.sent.length - 1) + ' autre' + (result.sent.length > 2 ? 's' : '') : '') + ' : à battre, ' + Number(result.sent[0].target) + ' !');
    else showToast(PC_ERRORS[result.failed[0] && result.failed[0].error] || 'Le défi n’a pas pu partir.');
    pcRefresh();
  });
}
function pcPlayDaily() {
  closeOverlayModal();
  if (typeof startDailyGame === 'function') startDailyGame();
}

// ---- a challenge received, and what became of the ones sent
function pcSecretName(c) {
  var p = c && c.secretId && typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(c.secretId)) : null;
  return p ? p.name : 'Pokémon';
}
function pcLeft(c) {
  var ms = Date.parse(c.expiresAt) - Date.now();
  return ms < 86400000 ? 'encore ' + Math.max(1, Math.ceil(ms / 3600000)) + ' h' : 'encore ' + pcDaysLeft(c) + ' j';
}
function pcIncomingHtml(c) {
  var open = pcOpen(c), mystery = c.kind === 'mystere', daily = c.kind === PC_DAILY;
  var state = open ? (daily ? 'avant minuit' : pcLeft(c).replace('encore', 'expire dans'))
    : daily ? (c.status === 'won' ? '✅ Réussi : ' + Number(c.best) + ' essais contre ' + Number(c.target) : c.status === 'declined' ? 'Refusé' : '❌ Pas réussi' + (c.best ? ' (' + Number(c.best) + ' essais)' : ''))
    : mystery ? (c.status === 'won' ? '✅ Trouvé en ' + Number(c.best) + ' essais : ' + pcSecretName(c) : c.status === 'declined' ? 'Refusé' : '❌ Pas trouvé : c’était ' + pcSecretName(c))
    : c.status === 'won' ? '✅ Réussi : ' + Number(c.best) + ' contre ' + Number(c.target)
    : c.status === 'declined' ? 'Refusé' : '⏳ Pas battu à temps' + (c.best ? ' (meilleur : ' + Number(c.best) + ')' : '');
  var goal = mystery
    ? '<div class="pc-goal"><span class="pc-mystery">?</span><span>Trouve son Pokémon mystère<br>en <b class="pc-small-b">' + Number(c.target) + '</b> essais</span></div>'
    : daily ? '<div class="pc-goal"><span class="pc-mystery is-day">📅</span><span>Trouve le Pokémon du jour<br>en <b class="pc-small-b">moins de ' + Number(c.target) + '</b> essais</span></div>'
    : pcAtMax(c) ? '<div class="pc-goal"><b>' + Number(c.target) + '</b><span>Égale ' + pcWord(c) + ' parfait<br>au ' + escapeHtml(c.label) + '</span></div>'
    : '<div class="pc-goal"><b>' + Number(c.target) + '</b><span>Bats ' + pcWord(c) + '<br>au ' + escapeHtml(c.label) + '</span></div>';
  var go = mystery && c.tries ? 'Continuer · ' + Number(c.tries) + ' / ' + Number(c.target) : daily ? 'Jouer au Pokémon du jour' : 'Relever le défi';
  return '<article class="pc-card' + (open ? ' is-open' : '') + '">' +
    '<div class="pc-who">' + pcAvatar(c.other) + '<div><b>' + escapeHtml(c.other.username) + ' te défie</b><small>' + escapeHtml(state) + '</small></div></div>' +
    goal + '<span class="pc-quote' + (c.note ? ' is-note' : '') + '">« ' + escapeHtml(c.note || c.phrase) + ' »</span>' +
    (open ? '<div class="pc-actions"><button type="button" class="btn-blue" data-action="acceptChallenge" data-args="[' + Number(c.id) + ']">' + go + '</button></div>' +
      '<details class="pc-more"><summary>Refuser…</summary><button type="button" data-action="declineChallenge" data-args="[' + Number(c.id) + ']">Refuser ce défi</button>' +
      '<button type="button" data-action="blockChallenger" data-args="[' + Number(c.id) + ']">Ne plus recevoir les défis de ' + escapeHtml(c.other.username) + '</button></details>'
      : c.status !== 'declined' ? '<button type="button" class="btn-ghost pc-again" data-action="openChallengeForm" data-args="' + pcArgs([c.other.pid, c.other.username, c.mode]) + '">⚔️ Défier ' + escapeHtml(c.other.username) + ' à ton tour</button>' : '') +
    '</article>';
}
function pcSentHtml(c) {
  var name = '<b>' + escapeHtml(c.other.username) + '</b>';
  var line;
  if (c.kind === 'mystere') {
    var secret = escapeHtml(pcSecretName(c));
    line = pcOpen(c) ? '🔍 ' + name + ' cherche ton ' + secret + ' · ' + Number(c.tries || 0) + ' / ' + Number(c.target) + ' essais · ' + pcLeft(c)
      : c.status === 'won' ? '🏆 ' + name + ' a trouvé ton ' + secret + ' en ' + Number(c.best) + ' essais sur ' + Number(c.target) + '.'
      : c.status === 'declined' ? name + ' a passé son tour pour ton ' + secret + '.'
      : c.status === 'lost' ? '💪 ' + name + ' n’a pas trouvé ton ' + secret + ' en ' + Number(c.target) + ' essais.'
      : '⏳ ' + name + ' n’a pas fini de chercher ton ' + secret + '.';
  } else if (c.kind === PC_DAILY) {
    line = pcOpen(c) ? '📅 ' + name + ' doit trouver le Pokémon du jour en moins de ' + Number(c.target) + ' essais · avant minuit'
      : c.status === 'won' ? '🏆 ' + name + ' a trouvé le Pokémon du jour en ' + Number(c.best) + ' essais (toi : ' + Number(c.target) + ').'
      : c.status === 'declined' ? name + ' a passé son tour pour le Pokémon du jour.'
      : c.status === 'lost' ? '💪 ' + name + ' n’a pas fait mieux que tes ' + Number(c.target) + ' essais' + (c.best ? ' (' + Number(c.best) + ')' : '') + '.'
      : '⏳ ' + name + ' n’a pas joué le Pokémon du jour à temps.';
  } else {
    line = pcOpen(c) ? '⚔️ ' + name + ' doit ' + pcGoalText(c).replace(/^fais/, 'faire') + ' au ' + escapeHtml(c.label) + (c.best ? ' · meilleur : ' + Number(c.best) : '') + ' · ' + pcLeft(c)
      : c.status === 'won' ? '🏆 ' + name + ' a battu ' + pcMyWord(c) + ' au ' + escapeHtml(c.label) + ' : ' + Number(c.best) + ' contre ' + Number(c.target) + '.'
      : c.status === 'declined' ? name + ' a passé son tour pour ton défi au ' + escapeHtml(c.label) + '.'
      : '💪 ' + name + ' n’a pas battu ' + pcMyWord(c) + ' au ' + escapeHtml(c.label) + (c.best ? ' (meilleur : ' + Number(c.best) + ' / ' + Number(c.target) + ')' : '') + '.';
  }
  var watch = c.kind === 'mystere' && Number(c.tries) > 0 ? '<button type="button" class="btn-ghost pc-again" data-action="openMysteryGame" data-args="[' + Number(c.id) + ']">👀 Ses essais</button>' : '';
  var again = !pcOpen(c) ? '<button type="button" class="btn-ghost pc-again" data-action="openChallengeForm" data-args="' + pcArgs([c.other.pid, c.other.username, c.mode]) + '">' + (c.status === 'won' ? '⚔️ Revanche' : '⚔️ Redéfier') + '</button>' : '';
  return '<div class="pc-row">' + pcAvatar(c.other) + '<p>' + line + '</p>' + watch + again + '</div>';
}

// ---- « Trouve ce Pokémon » : the game, in a window, compared by the server
var pcGame = null;
var PC_CELLS = [['type1', 'Type 1'], ['type2', 'Type 2'], ['generation', 'Gen'], ['habitat', 'Habitat'], ['color', 'Couleur'], ['stage', 'Stade'], ['height', 'Taille'], ['weight', 'Poids']];
function pcCellText(p, key, row) {
  var arrow = function (d) { return d ? ' ' + d : ''; };
  if (key === 'type1') return p.type1 || '—';
  if (key === 'type2') return p.type2 || '—';
  if (key === 'generation') return (p.gen || p.generation) + arrow(row.generationDirection);
  if (key === 'habitat') return p.habitat || '—';
  if (key === 'color') return Array.isArray(p.color) ? p.color.join(' / ') : p.color || '—';
  if (key === 'stage') return String(p.stage || '—');
  if (key === 'height') return String(p.height).replace('.', ',') + ' m' + arrow(row.heightDirection);
  if (key === 'weight') return String(p.weight).replace('.', ',') + ' kg' + arrow(row.weightDirection);
  return '';
}
function pcGameHtml(g) {
  var mine = !g.incoming;
  var answer = g.answerId && typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(g.answerId)) : null;
  var head = '<div class="pc-game-bar"><span>' + (mine ? '🔍 ' + escapeHtml(g.other.username) + ' cherche ton ' + escapeHtml(answer ? answer.name : 'Pokémon') : '⚔️ Le mystère de ' + escapeHtml(g.other.username)) + '</span><b>' + Number(g.attempts) + ' / ' + Number(g.max) + '</b></div>';
  var input = !mine && !g.finished ? '<div class="pc-game-input"><input type="search" class="pc-guess" placeholder="Tape un Pokémon…" autocomplete="off" aria-label="Ton essai" />' +
    '<button type="button" class="btn-blue" data-action="submitMysteryGuess">OK</button></div><div class="pc-suggests pc-guess-suggests"></div><p class="pc-status" role="status" aria-live="polite"></p>' : '';
  var tries = g.rows.slice().reverse().map(function (row) {
    var p = POKEMON_BY_ID.get(Number(row.pokemonId));
    if (!p) return '';
    return '<div class="pc-try"><div class="pc-try-who"><img src="' + escapeHtml(getPokemonSprite(p)) + '" alt="" /><b>' + escapeHtml(p.name) + '</b></div><div class="pc-try-cells">' +
      PC_CELLS.map(function (cell) {
        var state = row.cmp[cell[0]] || 'wrong';
        return '<div class="pc-cell is-' + escapeHtml(state) + '"><small>' + cell[1] + '</small>' + escapeHtml(pcCellText(p, cell[0], row)) + '</div>';
      }).join('') + '</div></div>';
  }).join('');
  var grid = g.rows.length ? '<div class="pc-tries">' + tries + '</div>' +
    '<p class="pc-note">🟩 juste · 🟨 proche · ⬜ faux · ↑ ↓ : le mystère est plus récent / plus grand, ou plus ancien / plus petit</p>' : (mine ? '<p class="pc-empty">Pas encore d’essai.</p>' : '<p class="pc-empty">Tape un premier Pokémon : chaque essai te donne des indices, comme au Pokémon du jour.</p>');
  var end = '';
  if (g.finished && answer) {
    var won = g.status === 'won';
    end = '<div class="pc-end' + (won ? ' is-won' : '') + '"><img src="' + escapeHtml(pokedexDetailArtwork(answer, false)) + '" data-fallback="' + escapeHtml(getPokemonSprite(answer)) + '" alt="" />' +
      '<div><b>' + (mine ? (won ? escapeHtml(g.other.username) + ' l’a trouvé en ' + Number(g.attempts) + ' essais' : escapeHtml(g.other.username) + ' ne l’a pas trouvé') : won ? 'Trouvé en ' + Number(g.attempts) + ' essai' + (g.attempts > 1 ? 's' : '') + ' ! 🎉' : 'Raté !') + '</b>' +
      '<p>C’était ' + escapeHtml(answer.name) + '.' + (mine ? '' : ' ' + escapeHtml(g.other.username) + ' est prévenu.') + '</p></div></div>' +
      '<button type="button" class="btn-blue pc-again-big" data-action="openChallengeForm" data-args="' + pcArgs([g.other.pid, g.other.username, PC_MYSTERY]) + '">⚔️ ' + (mine ? 'Le redéfier' : 'Lui en renvoyer un') + '</button>';
  }
  return '<div class="pc-game">' + head + input + end + grid + '</div>';
}
function renderMysteryGame(focus) {
  var box = document.querySelector('#overlay-body .pc-game-wrap');
  if (!box || !pcGame) return;
  box.innerHTML = pcGameHtml(pcGame);
  var input = box.querySelector('.pc-guess');
  if (!input) return;
  var skip = new Set(pcGame.rows.map(function (r) { return Number(r.pokemonId); }));
  input.oninput = function () {
    var list = box.querySelector('.pc-guess-suggests');
    if (list) list.innerHTML = pcSuggestHtml(pcMatches(input.value, skip));
  };
  input.onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); submitMysteryGuess(); } };
  box.onclick = function (event) {
    var pick = event.target.closest('[data-pc-pick]');
    if (pick) submitMysteryGuess(Number(pick.dataset.pcPick));
  };
  if (focus) input.focus({ preventScroll: true });
}
function openMysteryGame(id) {
  ensureOverlay('⚔️ Trouve ce Pokémon', '<div class="pc-game-wrap"><p class="pc-empty">Chargement…</p></div>');
  var overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.dataset.kind = 'challenge';
  pcGet('/api/challenges/game?id=' + encodeURIComponent(id)).then(function (data) {
    if (!data || !data.ok) throw Error('unavailable');
    pcGame = data;
    renderMysteryGame(true);
  }).catch(function () {
    var box = document.querySelector('#overlay-body .pc-game-wrap');
    if (box) box.innerHTML = '<p class="pc-empty">Ce défi n’a pas pu s’ouvrir. Réessaie dans un instant.</p>';
  });
}
function submitMysteryGuess(pokemonId) {
  if (!pcGame || pcGame.finished || pcGame.busy) return;
  var input = document.querySelector('#overlay-body .pc-guess');
  var status = document.querySelector('#overlay-body .pc-game .pc-status');
  var id = Number(pokemonId);
  if (!id && input) {
    var skip = new Set(pcGame.rows.map(function (r) { return Number(r.pokemonId); }));
    var exact = pcSecretPool().find(function (p) { return pcFold(p.name) === pcFold(input.value); });
    var first = exact || pcMatches(input.value, skip)[0];
    id = first ? Number(first.id) : 0;
  }
  if (!id) { if (status) status.textContent = 'Choisis un Pokémon dans la liste.'; return; }
  if (pcGame.rows.some(function (r) { return Number(r.pokemonId) === id; })) { if (status) status.textContent = 'Déjà proposé !'; return; }
  pcGame.busy = true;
  if (input) input.value = '';
  pcPost('/api/challenges/guess', { id: pcGame.id, pokemonId: id }).then(function (data) {
    pcGame.busy = false;
    if (!data || !data.ok) { if (status) status.textContent = data && data.error === 'rate_limited' ? PC_ERRORS.rate_limited : 'Essai impossible pour le moment. Réessaie.'; return; }
    pcGame = Object.assign({}, pcGame, data, { busy: false });
    renderMysteryGame(!data.finished);
    if (data.fresh) pcRefresh();
  }).catch(function () {
    pcGame.busy = false;
    if (status) status.textContent = 'Essai impossible pour le moment. Réessaie.';
  });
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
    '<p class="pc-note">Un défi dure 24 h, 3 ou 7 jours (celui du Pokémon du jour, jusqu’à minuit). Tout est effacé au bout de 30 jours, ou avec ton compte.</p>';
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
  if (c && c.kind === 'mystere') return openMysteryGame(c.id);
  if (c && c.kind === PC_DAILY) {
    closeOverlayModal();
    if (typeof startDailyGame === 'function') startDailyGame();
    setTimeout(function () { showToast('📅 Défi de ' + c.other.username + ' : trouve-le en moins de ' + Number(c.target) + ' essais !'); }, 500);
    return;
  }
  if (!c || !PC_LAUNCH[c.mode]) return;
  closeOverlayModal();
  try { PC_LAUNCH[c.mode](); } catch (_e) { showToast('Ce jeu n’a pas pu s’ouvrir.'); return; }
  setTimeout(function () { showToast('⚔️ Défi de ' + c.other.username + ' : ' + pcGoalText(c) + ' !'); }, 500);
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
        showToast('⚔️ ' + Number(score) + ' / ' + Number(c.target) + ' : ' + pcLeft(c) + ' pour battre ' + c.other.username);
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
    // « Jouer puis envoyer » : the first stored score of that game sends the challenge. The games that
    // send a score at each right answer wait for the end of the run (no new score for a while).
    if (pcPending && pcPending.mode === mode) {
      Promise.resolve(out).then(function (ok) {
        if (!ok || !pcPending || pcPending.mode !== mode) return;
        clearTimeout(pcPending.timer);
        pcPending.timer = setTimeout(pcSendPending, PC_PER_ANSWER[mode] ? 9000 : 600);
      });
    }
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

// « Du jour » : once today's Pokémon is found or given up, the server settles the challenge at the next look.
function pcAfterDaily() {
  var before = (pcState.list || []).filter(function (c) { return c.incoming && c.kind === PC_DAILY && pcOpen(c); });
  if (!before.length) return;
  setTimeout(function () {
    pcRefresh().then(function () {
      before.forEach(function (old) {
        var c = pcFind(old.id);
        if (!c || c.status === 'open') return;
        showToast(c.status === 'won' ? '🏆 Défi réussi : ' + Number(c.best) + ' essais contre ' + Number(c.target) + ' ! ' + c.other.username + ' est prévenu.'
          : '💪 Défi de ' + c.other.username + ' raté : il fallait moins de ' + Number(c.target) + ' essais.');
      });
    });
  }, 1200);
}
if (typeof renderGameOverBox === 'function') {
  var pcGameOverBefore = renderGameOverBox;
  renderGameOverBox = function () {
    var value = pcGameOverBefore.apply(this, arguments);
    if (typeof gameMode !== 'undefined' && gameMode === 'daily') pcAfterDaily();
    return value;
  };
}

Object.assign(window, { openChallengeForm: openChallengeForm, sendChallenge: sendChallenge, openMyChallenges: openMyChallenges, openMysteryGame: openMysteryGame, submitMysteryGuess: submitMysteryGuess,
  acceptChallenge: acceptChallenge, declineChallenge: declineChallenge, blockChallenger: blockChallenger, pcPendingCount: pcPendingCount,
  pcPlayFirst: pcPlayFirst, pcPlayDaily: pcPlayDaily });
