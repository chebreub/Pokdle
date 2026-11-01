
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
  rate_limited: 'Doucement ! Réessaie dans un moment.', pokemon: 'Choisis un Pokémon dans la liste.', attempts: 'Choisis un nombre d’essais.',
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
function openChallengeForm(pid, name, mode) {
  if (!window.__pokedleAuthed) { showToast(PC_ERRORS.login); return; }
  pcForm = { pid: String(pid || ''), name: String(name || 'Dresseur'), mode: mode && mode !== PC_MYSTERY ? mode : null, phrase: 0,
    tab: mode === PC_MYSTERY ? 'pokemon' : null, pokemonId: null, attempts: 8 };
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
  var mystery = Boolean(o.mystery);
  if (!pcForm.tab) pcForm.tab = modes.length || !mystery ? 'record' : 'pokemon';
  var tabs = mystery ? '<div class="pc-tabs" role="tablist">' +
    '<button type="button" role="tab" data-pc-tab="record" aria-selected="' + (pcForm.tab === 'record') + '">🏆 Bats mon record</button>' +
    '<button type="button" role="tab" data-pc-tab="pokemon" aria-selected="' + (pcForm.tab === 'pokemon') + '">🔍 Trouve ce Pokémon</button></div>' : '';
  var body;
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
  } else if (!modes.length) {
    body = '<p class="pc-empty">Il te faut d’abord un record à battre ! Joue à Higher or Lower, au Quiz ou au Duel de poids' + (mystery ? ', ou choisis « 🔍 Trouve ce Pokémon »' : ', puis reviens défier ' + escapeHtml(pcForm.name)) + '.</p>';
  } else {
    if (!modes.some(function (m) { return m.mode === pcForm.mode; })) pcForm.mode = modes[0].mode;
    body = '<p class="pc-step">Ton record à battre</p><div class="pc-modes">' + modes.map(function (m) {
      return '<button type="button" class="pc-mode" data-pc-mode="' + escapeHtml(m.mode) + '" aria-pressed="' + (m.mode === pcForm.mode) + '"><span>' + (m.kind === 'serie' ? '🔥 ' : '🏆 ') + escapeHtml(m.label) + '</span><b>' + Number(m.record) + '</b></button>';
    }).join('') + '</div>';
  }
  var ready = pcForm.tab === 'pokemon' ? Boolean(pcForm.pokemonId) : modes.length > 0;
  box.innerHTML = tabs + body + (pcForm.tab === 'record' && !modes.length ? '' :
    '<p class="pc-step">Ton message</p><div class="pc-phrases">' + o.phrases.map(function (p, i) {
      return '<button type="button" class="pc-phrase" data-pc-phrase="' + i + '" aria-pressed="' + (i === pcForm.phrase) + '">' + escapeHtml(p) + '</button>';
    }).join('') + '</div>' +
    '<p class="pc-summary"></p>' +
    '<button type="button" class="btn-blue pc-send" data-action="sendChallenge"' + (o.left > 0 && ready ? '' : ' disabled') + '>⚔️ Envoyer le défi</button>' +
    '<p class="pc-status" role="status" aria-live="polite">' + (o.left > 0 ? '' : escapeHtml(PC_ERRORS.limit)) + '</p>' +
    '<p class="pc-note">' + Number(o.left) + ' défi' + (o.left > 1 ? 's' : '') + ' possible' + (o.left > 1 ? 's' : '') + ' aujourd’hui · ' + escapeHtml(pcForm.name) + ' aura ' + Number(o.days) + ' jours pour le relever</p>');
  pcSummary();
  var search = box.querySelector('.pc-search');
  if (search) search.oninput = function () {
    var list = box.querySelector('.pc-suggests');
    if (list) list.innerHTML = pcSuggestHtml(pcMatches(search.value));
  };
  box.onclick = function (event) {
    var tab = event.target.closest('[data-pc-tab]'), mode = event.target.closest('[data-pc-mode]'), phrase = event.target.closest('[data-pc-phrase]');
    var pick = event.target.closest('[data-pc-pick]'), tries = event.target.closest('[data-pc-attempts]');
    if (tab) {
      pcForm.tab = tab.dataset.pcTab;
      if (pcForm.tab === 'pokemon' && pcForm.phrase === 0) pcForm.phrase = PC_MYSTERY_PHRASE;
      return renderChallengeForm();
    }
    if (pick) { pcForm.pokemonId = Number(pick.dataset.pcPick); return renderChallengeForm(); }
    if (tries) pcForm.attempts = Number(tries.dataset.pcAttempts);
    else if (mode) pcForm.mode = mode.dataset.pcMode;
    else if (phrase) pcForm.phrase = Number(phrase.dataset.pcPhrase);
    else return;
    box.querySelectorAll('[data-pc-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pcMode === pcForm.mode)); });
    box.querySelectorAll('[data-pc-phrase]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.pcPhrase) === pcForm.phrase)); });
    box.querySelectorAll('[data-pc-attempts]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.pcAttempts) === pcForm.attempts)); });
    pcSummary();
  };
}
function pcSummary() {
  var line = document.querySelector('#overlay-body .pc-summary');
  if (!line || !pcForm) return;
  if (pcForm.tab === 'pokemon') {
    line.textContent = pcForm.pokemonId ? pcForm.name + ' devra le trouver en ' + pcForm.attempts + ' essais au plus.' : 'Choisis le Pokémon qu’il devra trouver.';
    return;
  }
  var m = pcState.options && pcState.options.modes.find(function (x) { return x.mode === pcForm.mode; });
  if (m) line.textContent = pcForm.name + ' devra faire plus de ' + m.record + ' au ' + m.label + '.';
}
function sendChallenge() {
  var status = document.querySelector('#overlay-body .pc-status');
  var button = document.querySelector('#overlay-body .pc-send');
  if (!pcForm) return;
  var mystery = pcForm.tab === 'pokemon';
  if (button) button.disabled = true;
  pcPost('/api/challenges', mystery
    ? { pid: pcForm.pid, mode: PC_MYSTERY, phrase: pcForm.phrase, pokemonId: pcForm.pokemonId, attempts: pcForm.attempts }
    : { pid: pcForm.pid, mode: pcForm.mode, phrase: pcForm.phrase }).then(function (data) {
    if (!data || !data.ok) {
      if (status) status.textContent = PC_ERRORS[data && data.error] || 'Envoi impossible pour le moment. Réessaie dans un instant.';
      if (button) button.disabled = Boolean(data && (data.error === 'limit' || data.error === 'refused'));
      return;
    }
    if (pcState.options) pcState.options.left = Math.max(0, pcState.options.left - 1);
    pcState.list = null;
    var box = document.querySelector('#overlay-body .pc-form');
    if (box) box.innerHTML = '<div class="pc-sent"><b>Défi envoyé ⚔️</b><p>' + escapeHtml(pcForm.name) + ' le verra à sa prochaine visite. ' +
      (mystery ? 'Tu seras prévenu s’il trouve ton Pokémon… ou pas.' : 'Tu seras prévenu s’il fait mieux que ' + Number(data.target) + '.') + '</p>' +
      (typeof notifAskHtml === 'function' ? notifAskHtml(pcForm.name, 'sent') : '') +
      '<button type="button" class="btn-ghost" data-action="closeOverlayModal">OK</button></div>';
  }).catch(function () {
    if (status) status.textContent = 'Envoi impossible pour le moment. Réessaie dans un instant.';
    if (button) button.disabled = false;
  });
}

// ---- a challenge received, and what became of the ones sent
function pcSecretName(c) {
  var p = c && c.secretId && typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(c.secretId)) : null;
  return p ? p.name : 'Pokémon';
}
function pcIncomingHtml(c) {
  var open = pcOpen(c), mystery = c.kind === 'mystere';
  var state = open ? 'expire dans ' + pcDaysLeft(c) + ' j'
    : mystery ? (c.status === 'won' ? '✅ Trouvé en ' + Number(c.best) + ' essais : ' + pcSecretName(c) : c.status === 'declined' ? 'Refusé' : '❌ Pas trouvé : c’était ' + pcSecretName(c))
    : c.status === 'won' ? '✅ Réussi : ' + Number(c.best) + ' contre ' + Number(c.target)
    : c.status === 'declined' ? 'Refusé' : '⏳ Pas battu à temps' + (c.best ? ' (meilleur : ' + Number(c.best) + ')' : '');
  var goal = mystery
    ? '<div class="pc-goal"><span class="pc-mystery">?</span><span>Trouve son Pokémon mystère<br>en <b class="pc-small-b">' + Number(c.target) + '</b> essais</span></div>'
    : '<div class="pc-goal"><b>' + Number(c.target) + '</b><span>Bats ' + pcWord(c) + '<br>au ' + escapeHtml(c.label) + '</span></div>';
  var go = mystery && c.tries ? 'Continuer · ' + Number(c.tries) + ' / ' + Number(c.target) : 'Relever le défi';
  return '<article class="pc-card' + (open ? ' is-open' : '') + '">' +
    '<div class="pc-who">' + pcAvatar(c.other) + '<div><b>' + escapeHtml(c.other.username) + ' te défie</b><small>' + escapeHtml(state) + '</small></div></div>' +
    goal + '<span class="pc-quote">« ' + escapeHtml(c.phrase) + ' »</span>' +
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
    line = pcOpen(c) ? '🔍 ' + name + ' cherche ton ' + secret + ' · ' + Number(c.tries || 0) + ' / ' + Number(c.target) + ' essais · encore ' + pcDaysLeft(c) + ' j'
      : c.status === 'won' ? '🏆 ' + name + ' a trouvé ton ' + secret + ' en ' + Number(c.best) + ' essais sur ' + Number(c.target) + '.'
      : c.status === 'declined' ? name + ' a passé son tour pour ton ' + secret + '.'
      : c.status === 'lost' ? '💪 ' + name + ' n’a pas trouvé ton ' + secret + ' en ' + Number(c.target) + ' essais.'
      : '⏳ ' + name + ' n’a pas fini de chercher ton ' + secret + '.';
  } else {
    line = pcOpen(c) ? '⚔️ ' + name + ' doit faire plus de ' + Number(c.target) + ' au ' + escapeHtml(c.label) + (c.best ? ' · meilleur : ' + Number(c.best) : '') + ' · encore ' + pcDaysLeft(c) + ' j'
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
  if (c && c.kind === 'mystere') return openMysteryGame(c.id);
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

Object.assign(window, { openChallengeForm: openChallengeForm, sendChallenge: sendChallenge, openMyChallenges: openMyChallenges, openMysteryGame: openMysteryGame, submitMysteryGuess: submitMysteryGuess,
  acceptChallenge: acceptChallenge, declineChallenge: declineChallenge, blockChallenger: blockChallenger, pcPendingCount: pcPendingCount });
