// 🔗 Dernière lettre en Party Room (13/11/2026, maquette validée : « go 1 »).
// Chacun son tour dans l'ordre du salon ; 10 / 15 / 20 s par tour ; 1 / 2 / 3 ❤️ ; le dernier en vie gagne.
// Le serveur tient tout (lib/party-lastletter.js) : l'ordre, l'horloge, la chaîne, les vies. Cette page dessine
// le panneau du jeu dans la manche du salon (#party-lastletter) et les réglages de l'hôte (temps, vies).
var llp = { key: '', askKey: '', tick: null, offset: 0, pending: false, names: null, gensKey: '' };

function llpRound(room) {
  return room && room.gameMode === 'lastletter' && room.round && room.round.mode === 'lastletter' ? room.round : null;
}
function llpEsc(s) { return escapeHtml(String(s == null ? '' : s)); }
function llpKey(name) {
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z]/g, '');
}
function llpSprite(id) {
  var p = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(id)) : null;
  return p && typeof getPokemonSprite === 'function' ? getPokemonSprite(p) : '';
}
function llpNames(room) {
  var gens = (room.selectedGens || []).join(',');
  if (llp.names && llp.gensKey === gens) return llp.names;
  var allowed = room.selectedGens || [1, 2, 3, 4, 5, 6, 7, 8, 9];
  llp.gensKey = gens;
  llp.names = (typeof POKEMON_LIST !== 'undefined' ? POKEMON_LIST : []).filter(function (p) {
    return !p.isAltForm && Number(p.id) >= 1 && Number(p.id) <= 1025 && allowed.indexOf(Number(p.gen || p.generation)) >= 0;
  }).map(function (p) { return { id: Number(p.id), name: p.name, key: llpKey(p.name) }; });
  return llp.names;
}
function llpHearts(p, lives) {
  if (p.out) return 'éliminé';
  var h = '';
  for (var i = 0; i < lives; i++) h += i < p.hearts ? '❤️' : '🤍';
  return h;
}
function llpAvatar(room, id) {
  var pl = (room.players || []).find(function (x) { return x.id === id; });
  var img = pl && pl.partner ? llpSprite(pl.partner) : '';
  return img ? '<img src="' + llpEsc(img) + '" alt="" width="36" height="36" loading="lazy">' : '<span class="llp-ini">' + llpEsc(String((pl && pl.nickname) || '?').charAt(0).toUpperCase()) + '</span>';
}
function llpMe(room) {
  var me = (room.players || []).find(function (p) { return p.isSelf; });
  return me ? me.id : (typeof multiplayerSocket !== 'undefined' && multiplayerSocket ? multiplayerSocket.id : null);
}
function llpName(round, id, meId) {
  if (id === meId) return 'toi';
  var p = (round.players || []).find(function (x) { return x.id === id; });
  return p ? p.nickname : '?';
}

function llpPlayersHtml(room, round, meId) {
  return '<div class="llp-players">' + round.players.map(function (p) {
    var cls = 'llp-pl' + (p.id === round.turnId ? ' is-on' : '') + (p.out ? ' is-out' : '') + (p.connected ? '' : ' is-off');
    return '<div class="' + cls + '"><span class="llp-given" title="Pokémon donnés">' + p.given + '</span>' + llpAvatar(room, p.id) +
      '<b>' + (p.id === meId ? 'Toi' : llpEsc(p.nickname)) + '</b><small>' + llpHearts(p, round.lives) + '</small></div>';
  }).join('') + '</div>';
}

function llpFeedHtml(round, meId) {
  return (round.feed || []).map(function (f) {
    if (f.kind === 'timeout') return '<div class="llp-lost">⏱️ ' + (f.by === meId ? 'Tu sèches' : llpEsc(f.nickname) + (f.gone ? ' est parti' : ' sèche')) + (f.gone ? '' : ' sur « ' + llpEsc(String(f.letter || '').toUpperCase()) + ' »') + (f.out ? ' · éliminé' : ' · −1 ❤️') + '</div>';
    if (f.kind === 'letter') return '<div class="llp-note">🔄 Plus aucun Pokémon en « ' + llpEsc(String(f.from).toUpperCase()) + ' » : nouvelle lettre « ' + llpEsc(String(f.letter).toUpperCase()) + ' »</div>';
    var name = String(f.name || ''), i = name.length - 1;
    while (i > 0 && !/[a-zà-ÿœæ]/i.test(name.charAt(i))) i--;
    var html = llpEsc(name.slice(0, i)) + '<span class="llp-last">' + llpEsc(name.charAt(i)) + '</span>' + llpEsc(name.slice(i + 1));
    var img = llpSprite(f.id);
    return '<div class="llp-bub' + (f.by === meId ? ' is-me' : '') + '">' + (img ? '<img src="' + llpEsc(img) + '" alt="" width="38" height="38" loading="lazy">' : '') +
      '<span><b>' + html + '</b><small>' + (f.by === meId ? 'Toi' : llpEsc(f.nickname)) + '</small></span></div>';
  }).join('');
}

function llpEndHtml(room, round, meId) {
  var rank = round.ranking || [];
  var byId = {};
  round.players.forEach(function (p) { byId[p.id] = p; });
  var winner = byId[rank[0]];
  var podium = [1, 0, 2].map(function (i) {
    var p = byId[rank[i]];
    if (!p) return '';
    return '<div class="llp-step is-' + ['g', 's', 'b'][i] + '">' + llpAvatar(room, p.id) + '<b>' + (i ? (i + 1) + 'e' : '1er') + ' · ' + (p.id === meId ? 'Toi' : llpEsc(p.nickname)) + '</b><small>' + p.given + ' Pokémon</small></div>';
  }).join('');
  var lines = ['🔗 Chaîne de <b>' + round.chainLength + ' Pokémon</b>'];
  if (round.traps && round.traps[0]) lines.push('😵 Lettre piège : <b>' + llpEsc(round.traps[0].letter.toUpperCase()) + '</b> (' + round.traps[0].names.map(llpEsc).join(', ') + ')');
  if (round.fastest) lines.push('⚡ Plus rapide : <b>' + llpEsc(round.fastest.nickname) + '</b> · ' + llpEsc(round.fastest.name) + ' en ' + Math.max(1, Math.round(round.fastest.ms / 1000)) + ' s');
  var title = round.endedReason === 'exhausted' ? 'Plus aucun Pokémon à donner !' : winner ? (winner.id === meId ? '🏆 Tu gagnes !' : '🏆 ' + llpEsc(winner.nickname) + ' gagne !') : 'Partie terminée';
  return '<div class="llp-end"><h4>' + title + '</h4><div class="llp-podium">' + podium + '</div><div class="llp-stats">' + lines.join('<br>') + '</div></div>';
}

function llpAskHtml(round, meId, letter) {
  if (round.turnId === meId) {
    return '<div class="llp-ask"><span>À toi : un Pokémon en</span><span class="llp-big">' + llpEsc(letter) + '</span><span class="llp-sec" id="llp-sec"></span></div>' +
      '<form class="llp-form" id="llp-form" autocomplete="off"><div class="llp-field"><input id="llp-input" type="text" maxlength="60" autocapitalize="words" spellcheck="false" autocorrect="off" enterkeyhint="send" placeholder="' + llpEsc(letter) + '…" aria-label="Un Pokémon en ' + llpEsc(letter) + '"><div class="llp-ac" id="llp-ac" role="listbox"></div></div><button type="submit" class="btn-blue">OK</button></form>' +
      '<p class="llp-msg" id="llp-msg" role="status" aria-live="polite"></p>';
  }
  var next = round.nextId === meId ? 'Prépare-toi : c’est toi après !' : round.nextId ? 'Réfléchis déjà : après, c’est ' + llpEsc(llpName(round, round.nextId, meId)) + '.' : '';
  var meOut = (round.players.find(function (p) { return p.id === meId; }) || {}).out;
  return '<div class="llp-wait">Au tour de <b>' + llpEsc(llpName(round, round.turnId, meId)) + '</b> : un Pokémon en <span class="llp-big is-small">' + llpEsc(letter) + '</span><span class="llp-sec" id="llp-sec"></span></div>' +
    '<p class="llp-next">' + (meOut ? 'Tu es éliminé : regarde la fin de la partie.' : next) + '</p>';
}

function renderPartyLastLetter(room) {
  var panel = document.getElementById('party-lastletter');
  var round = llpRound(room);
  var on = Boolean(round && room.status !== 'waiting');
  var screen = document.getElementById('screen-party-room');
  if (screen) { screen.classList.toggle('ll-party-on', on); screen.classList.toggle('ll-party-end', on && room.status === 'complete'); }
  if (!panel) return;
  panel.classList.toggle('hidden', !on);
  if (!on) { if (panel.innerHTML) panel.innerHTML = ''; llp.key = ''; llp.askKey = ''; clearInterval(llp.tick); llp.tick = null; return; }
  // La manche du salon montre ce panneau à la place de l'image, de la case de réponse et du chrono habituels.
  var roundEl = document.getElementById('party-round');
  if (roundEl) roundEl.classList.remove('hidden');
  ['party-round-sprite', 'party-round-input', 'party-round-answer', 'party-stat-reveal', 'party-stat-options'].forEach(function (id) { var n = document.getElementById(id); if (n) n.classList.add('hidden'); });
  var modeEl = document.getElementById('party-round-mode');
  var meId = llpMe(room);
  var playing = room.status === 'playing' && !round.endedReason;
  if (modeEl) modeEl.textContent = '🔗 Dernière lettre' + (playing ? ' · ' + (round.chainLength + 1) + 'e Pokémon' : '');
  var progress = document.getElementById('party-stage-progress');
  if (progress) progress.textContent = 'CHACUN SON TOUR · ' + Math.round(round.turnMs / 1000) + ' S · ' + round.lives + ' ❤️';
  llp.offset = Number(round.serverNow) ? Number(round.serverNow) - Date.now() : 0;
  var key = room.code + ':' + round.roundSerial + ':' + (playing ? 'p' : 'e');
  if (key !== llp.key) {
    llp.key = key; llp.askKey = '';
    panel.innerHTML = '<div id="llp-players"></div>' + (playing ? '<div class="llp-bar" aria-hidden="true"><i id="llp-bar"></i></div><div id="llp-ask"></div>' : '<div id="llp-end"></div>') + '<div class="llp-feed" id="llp-feed"></div>';
  }
  document.getElementById('llp-players').innerHTML = llpPlayersHtml(room, round, meId);
  document.getElementById('llp-feed').innerHTML = llpFeedHtml(round, meId);
  clearInterval(llp.tick); llp.tick = null;
  if (!playing) { document.getElementById('llp-end').innerHTML = llpEndHtml(room, round, meId); return; }
  var letter = String(round.letter || '').toUpperCase();
  // La case de réponse n'est refaite qu'au changement de tour : ce qui est tapé n'est jamais perdu.
  var askKey = round.turnId + ':' + letter + ':' + round.endsAt + ':' + (round.nextId || '');
  if (askKey !== llp.askKey) {
    var mine = round.turnId === meId, wasMine = llp.askKey.indexOf(meId + ':') === 0;
    llp.askKey = askKey;
    var keep = mine && wasMine && document.getElementById('llp-input') ? document.getElementById('llp-input').value : '';
    document.getElementById('llp-ask').innerHTML = llpAskHtml(round, meId, letter);
    if (mine) llpBindForm(keep);
  }
  llpTick();
  llp.tick = setInterval(llpTick, 200);
}

function llpTick() {
  var room = partyRoomState.room, round = llpRound(room);
  if (!round || room.status !== 'playing') { clearInterval(llp.tick); llp.tick = null; return; }
  var left = round.endsAt - (Date.now() + llp.offset), k = Math.max(0, Math.min(1, left / (round.turnMs || 15000)));
  var bar = document.getElementById('llp-bar'), sec = document.getElementById('llp-sec');
  if (bar) { bar.style.width = (k * 100).toFixed(1) + '%'; bar.classList.toggle('is-low', left < 5000); }
  if (sec) sec.textContent = Math.max(0, Math.ceil(left / 1000)) + ' s';
}

function llpBindForm(keep) {
  var form = document.getElementById('llp-form'), input = document.getElementById('llp-input');
  if (!form || !input) return;
  if (keep) input.value = keep;
  form.addEventListener('submit', function (e) { e.preventDefault(); llpSubmit(input.value); });
  input.addEventListener('input', function () { var m = document.getElementById('llp-msg'); if (m) m.textContent = ''; llpSuggest(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.getElementById('llp-ac').innerHTML = ''; });
  setTimeout(function () { if (document.activeElement !== input) input.focus({ preventScroll: true }); }, 30);
}

function llpSuggest() {
  var input = document.getElementById('llp-input'), box = document.getElementById('llp-ac'), room = partyRoomState.room;
  if (!input || !box || !room) return;
  var q = llpKey(input.value);
  if (q.length < 3) { box.innerHTML = ''; return; }
  var hits = llpNames(room).filter(function (n) { return n.key.indexOf(q) === 0; }).slice(0, 4);
  box.innerHTML = hits.map(function (n) {
    var img = llpSprite(n.id);
    return '<button type="button" role="option" data-llp-name="' + llpEsc(n.name) + '">' + (img ? '<img src="' + llpEsc(img) + '" alt="" width="28" height="28" loading="lazy">' : '') + llpEsc(n.name) + '</button>';
  }).join('');
  box.querySelectorAll('[data-llp-name]').forEach(function (b) {
    b.addEventListener('click', function () { llpSubmit(b.getAttribute('data-llp-name')); });
  });
}

function llpSubmit(text) {
  var room = partyRoomState.room, round = llpRound(room), msg = document.getElementById('llp-msg');
  var guess = String(text || '').trim();
  if (!round || !guess || llp.pending || room.status !== 'playing') return;
  var socket = typeof ensureMultiplayerSocket === 'function' ? ensureMultiplayerSocket() : null;
  if (!socket || !socket.connected) { if (msg) msg.textContent = 'Connexion interrompue.'; return; }
  llp.pending = true;
  socket.timeout(8000).emit('party:submit-answer', { code: room.code, roundSerial: round.roundSerial, guess: guess }, function (error, res) {
    llp.pending = false;
    if (res && res.room) { partyRoomState.room = res.room; renderPartyRoom(); }
    var m = document.getElementById('llp-msg'), input = document.getElementById('llp-input');
    if (error || !res || !res.ok) {
      if (m) m.textContent = error ? 'Connexion lente : réessaie.' : (res && res.error) || 'Proposition refusée.';
      if (input) { input.classList.remove('is-wrong'); void input.offsetWidth; input.classList.add('is-wrong'); input.select(); }
    }
  });
}

// Réglages de l'hôte dans le salon : temps par tour et nombre de vies (comme la maquette).
function setPartyLastLetterOptions(turnSec, lives) {
  var socket = typeof ensurePartyListeners === 'function' ? ensurePartyListeners() : null;
  if (!socket || !socket.connected) return;
  socket.emit('party:lastletter-options', { turnSec: Number(turnSec), lives: Number(lives) }, function (res) {
    if (!res || !res.ok) { if (typeof setPartyStatus === 'function') setPartyStatus((res && res.error) || 'Impossible de changer le réglage.'); return; }
    partyRoomState.room = res.room; renderPartyRoom();
  });
}
function renderLastLetterSetup(room, isHost) {
  var host = document.getElementById('party-setup');
  if (!host) return;
  var box = document.getElementById('ll-party-setup');
  var active = room.gameMode === 'lastletter' && (room.status === 'waiting' || room.status === 'complete');
  if (!box && !active) return;
  if (!box) { box = document.createElement('section'); box.id = 'll-party-setup'; box.className = 'll-party-setup'; host.appendChild(box); }
  box.classList.toggle('hidden', !active);
  if (!active) return;
  var opt = room.llOptions || { turnSec: 15, lives: 2 };
  var rounds = document.getElementById('party-rounds-select');
  if (rounds) rounds.classList.add('hidden');
  var summary = document.getElementById('party-options-summary');
  var gens = room.selectedGens || [];
  if (summary) summary.textContent = opt.turnSec + ' s par tour · ' + opt.lives + ' ❤️ · ' + (gens.length === 9 ? 'Toutes les générations' : gens.length === 1 ? 'Gen ' + gens[0] : gens.length + ' générations');
  var note = document.getElementById('party-launch-note');
  if (note && room.status === 'waiting') note.textContent = (room.players || []).length + ' joueurs · Dernière lettre · ' + opt.turnSec + ' s par tour · ' + opt.lives + ' ❤️';
  var dis = isHost ? '' : ' disabled';
  var btn = function (t, l, label, on) {
    return '<button type="button" class="party-mode-btn' + (on ? ' is-active' : '') + '" data-action="setPartyLastLetterOptions" data-args=\'[' + t + ',' + l + ']\' aria-pressed="' + on + '"' + dis + '>' + label + '</button>';
  };
  box.innerHTML = '<div class="ll-party-row"><span class="party-mode-label">Temps par tour</span><div class="party-option-buttons">' +
    [10, 15, 20].map(function (t) { return btn(t, opt.lives, t + ' s', opt.turnSec === t); }).join('') + '</div></div>' +
    '<div class="ll-party-row"><span class="party-mode-label">Vies</span><div class="party-option-buttons">' +
    [1, 2, 3].map(function (l) { return btn(opt.turnSec, l, l + ' ❤️', opt.lives === l); }).join('') + '</div></div>' +
    '<p class="ll-party-note">Pokémon des générations du salon, sans formes · accents et tirets ignorés · un mauvais nom ne coûte rien.</p>';
}

var renderPartyRoomBeforeLastLetter = renderPartyRoom;
renderPartyRoom = function () {
  var out = renderPartyRoomBeforeLastLetter.apply(this, arguments);
  var room = partyRoomState.room;
  if (!room) { renderPartyLastLetter(null); return out; }
  var me = (room.players || []).find(function (p) { return p.isSelf; });
  var isHost = Boolean((me && me.isHost) || (room.hostId && typeof multiplayerSocket !== 'undefined' && multiplayerSocket && room.hostId === multiplayerSocket.id));
  renderLastLetterSetup(room, isHost);
  renderPartyLastLetter(room);
  return out;
};

window.setPartyLastLetterOptions = setPartyLastLetterOptions;
window.renderPartyRoom = renderPartyRoom;
