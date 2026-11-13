// 🔗 Dernière lettre (13/11/2026, maquette validée : « go 1 »).
// Chacun son tour contre le Bot : ton Pokémon commence par la dernière lettre du précédent. 15 s par tour,
// jamais deux fois le même, 2 « Changer de lettre ». Toute la partie est tenue par le serveur (lib/last-letter.js) :
// la chaîne, l'horloge, les réponses du Bot, le score, la Ball et les ₽ (1re partie du jour).
// Le joueur peut proposer n'importe lequel des 1025 ; les suggestions arrivent après 3 lettres tapées.

var LL_BEST_KEY = 'pokedle.lastLetterBest';
var ll = { server: null, busy: false, offset: 0, raf: 0, finishing: false, names: null };

function llLetters(name) {
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z]/g, '');
}
function llEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s); }
function llBest() { try { return Math.max(0, Number(localStorage.getItem(LL_BEST_KEY)) || 0); } catch (_e) { return 0; } }
function llSaveBest(n) { try { if (n > llBest()) localStorage.setItem(LL_BEST_KEY, String(n)); } catch (_e) { /* private mode */ } }
function llNames() {
  if (ll.names) return ll.names;
  var list = (typeof POKEMON_LIST !== 'undefined' ? POKEMON_LIST : []).filter(function (p) { return !p.isAltForm && Number(p.id) >= 1 && Number(p.id) <= 1025; });
  ll.names = list.map(function (p) { return { id: Number(p.id), name: p.name, key: llLetters(p.name), p: p }; });
  return ll.names;
}
function llSprite(id) {
  var p = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(id)) : null;
  return p && typeof getPokemonSprite === 'function' ? getPokemonSprite(p) : '';
}
function llRoot() { return document.getElementById('last-letter-root'); }
function llOnScreen() { return gameMode === 'lastletter' && document.body && document.body.dataset.screen === 'screen-last-letter'; }

async function openLastLetterMode() {
  if (typeof trackUsage === 'function') trackUsage('solo:lastletter');
  if (typeof hideCustomModeSurfaces === 'function') hideCustomModeSurfaces();
  showScreen('screen-last-letter');
  if (typeof setGlobalNavActive === 'function') setGlobalNavActive('game');
  gameMode = 'lastletter';
  restartLastLetterGame();
}

async function restartLastLetterGame() {
  if (ll.busy) return;
  var root = llRoot();
  if (root) root.innerHTML = '<p class="ll-status">Le Bot choisit son premier Pokémon…</p>';
  ll.busy = true; ll.finishing = false; ll.server = null;
  if ((typeof ballState === 'undefined' || !ballState || !ballState.actionScope) && typeof refreshBalls === 'function') {
    try { await refreshBalls({ announce: false }); } catch (_e) { /* hors ligne */ }
  }
  if (typeof verifiedArcadeOnline !== 'function' || !verifiedArcadeOnline('lastletter')) {
    ll.busy = false;
    if (root) root.innerHTML = '<p class="ll-status">Dernière lettre se joue avec le serveur, qui ne répond pas pour l’instant.</p><div class="ll-actions"><button type="button" class="btn-blue" data-action="restartLastLetterGame">Réessayer</button></div>';
    return;
  }
  var gens = typeof selectedGens !== 'undefined' && selectedGens && selectedGens.size ? Array.from(selectedGens).map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var body = { mode: 'lastletter', startId: crypto.randomUUID(), gens: gens, restart: true };
  var data = await verifiedArcadeRequest('start', body);
  // 1re visite : l'identité invité peut être créée pendant le chargement. On reprend l'état du sac et on relance une fois.
  if (data && data.error === 'account_changed' && typeof refreshBalls === 'function') {
    try { await refreshBalls({ announce: false }); } catch (_e) { /* hors ligne */ }
    data = await verifiedArcadeRequest('start', body);
  }
  ll.busy = false;
  if (!llOnScreen()) return;
  if (!data || !data.ok) { if (root) root.innerHTML = '<p class="ll-status">Impossible de lancer la partie.</p><div class="ll-actions"><button type="button" class="btn-blue" data-action="restartLastLetterGame">Réessayer</button></div>'; return; }
  llTake(data.arcade);
  llRender(true);
}

function llTake(arcade) {
  ll.server = arcade;
  if (arcade && arcade.serverNow) ll.offset = arcade.serverNow - Date.now();
  if (arcade && arcade.phase === 'over') llOver();
}

function llOver() {
  var s = ll.server;
  if (!s || ll.recorded === s.sessionId) return;
  ll.recorded = s.sessionId;
  llSaveBest(s.score);
  var result = s.score >= (s.winAt || 10) ? 'win' : 'loss';
  if (typeof trackUsage === 'function') trackUsage('complete:lastletter:' + result);
  if (typeof progressQuestMode === 'function') { try { progressQuestMode('lastletter'); } catch (_e) { /* quêtes */ } }
}

function llBubble(c) {
  if (c.stuck) return '<div class="ll-stuck">😵 Le Bot sèche sur « ' + llEsc(c.letter.toUpperCase()) + ' » · +2</div>';
  var key = llLetters(c.name), last = key.slice(-1);
  // La dernière lettre est surlignée dans le nom (on garde l'écriture du nom, accents compris).
  var name = llEsc(c.name), i = c.name.length - 1;
  while (i > 0 && !/[a-zà-ÿœæ]/i.test(c.name.charAt(i))) i--;
  if (llLetters(c.name.charAt(i)) === last) name = llEsc(c.name.slice(0, i)) + '<span class="ll-last">' + llEsc(c.name.charAt(i)) + '</span>' + llEsc(c.name.slice(i + 1));
  var img = llSprite(c.id);
  return '<div class="ll-bub ' + (c.by === 'me' ? 'is-me' : 'is-bot') + '">' + (img ? '<img src="' + llEsc(img) + '" alt="" width="40" height="40" loading="lazy">' : '') +
    '<span><b>' + name + '</b><small>' + (c.by === 'me' ? 'toi' : 'Bot') + '</small></span></div>';
}

function llRender(focus) {
  var root = llRoot(), s = ll.server;
  if (!root || !s) return;
  var best = Math.max(llBest(), s.phase === 'over' ? s.score : 0);
  // Le plus récent en haut, juste sous la case de réponse (comme l'illimité depuis le 12/11).
  var chain = (s.chain || []).slice(-8).reverse().map(llBubble).join('');
  var card = root.closest('.card');
  if (card) card.classList.toggle('ll-playing', s.phase === 'playing');
  if (s.phase === 'over') {
    cancelAnimationFrame(ll.raf);
    var record = s.score > 0 && s.score >= best;
    root.innerHTML = '<div class="ll-over">' +
      '<h3>⏱️ Temps écoulé</h3><div class="ll-final">' + s.score + '</div>' +
      '<p>' + (s.score >= (s.winAt || 10) ? 'Belle chaîne ! ' : '') + (record ? '<b>🏆 Nouveau record !</b>' : 'Record : ' + best) + '</p>' +
      '<div class="ll-actions"><button type="button" class="btn-blue" data-action="restartLastLetterGame">🔁 Rejouer</button><button type="button" class="btn-ghost" data-action="goToConfig">← Retour</button></div>' +
      '<div class="ll-chain is-recap">' + chain + '</div></div>';
    var cardOver = root.closest('.card');
    if (cardOver) cardOver.classList.remove('ll-playing');
    return;
  }
  var letter = String(s.letter || '').toUpperCase();
  var note = s.event && s.event.kind === 'pass' ? '<p class="ll-note">🔄 Nouvelle lettre.</p>' : '';
  root.innerHTML =
    '<div class="ll-meta"><span class="ll-pill">🔗 ' + s.score + ' point' + (s.score > 1 ? 's' : '') + '</span><span class="ll-pill">Record ' + best + '</span></div>' +
    '<div class="ll-timer" aria-hidden="true"><i id="ll-timer-bar"></i></div>' +
    '<div class="ll-ask">À toi : un Pokémon en <span class="ll-big">' + llEsc(letter) + '</span><span class="ll-sec" id="ll-sec"></span></div>' +
    '<form class="ll-form" id="ll-form" autocomplete="off"><div class="ll-field"><input id="ll-input" type="text" inputmode="text" autocapitalize="words" spellcheck="false" placeholder="' + llEsc(letter) + '…" aria-label="Un Pokémon en ' + llEsc(letter) + '">' +
    '<div class="ll-ac" id="ll-ac" role="listbox"></div></div><button type="submit" class="btn-blue">OK</button></form>' +
    '<div class="ll-foot"><button type="button" class="btn-ghost ll-pass" data-action="lastLetterPass"' + (s.passes > 0 ? '' : ' disabled') + '>🔄 Changer de lettre (' + s.passes + ')</button>' +
    '<small>Accents et tirets ignorés. 10 points = victoire.</small></div>' + note +
    '<div class="ll-chain">' + chain + '</div>';
  var form = document.getElementById('ll-form'), input = document.getElementById('ll-input');
  form.addEventListener('submit', function (e) { e.preventDefault(); llSubmit(input.value); });
  input.addEventListener('input', llSuggest);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { document.getElementById('ll-ac').innerHTML = ''; }
  });
  if (focus) setTimeout(function () { if (document.activeElement !== input) input.focus({ preventScroll: true }); }, 30);
  llTick();
}

function llSuggest() {
  var input = document.getElementById('ll-input'), box = document.getElementById('ll-ac');
  if (!input || !box) return;
  var q = llLetters(input.value);
  if (q.length < 3) { box.innerHTML = ''; return; }
  var hits = llNames().filter(function (n) { return n.key.indexOf(q) === 0; }).slice(0, 4);
  box.innerHTML = hits.map(function (n) {
    return '<button type="button" role="option" data-ll-id="' + n.id + '">' + (llSprite(n.id) ? '<img src="' + llEsc(llSprite(n.id)) + '" alt="" width="28" height="28" loading="lazy">' : '') + llEsc(n.name) + '</button>';
  }).join('');
  box.querySelectorAll('[data-ll-id]').forEach(function (b) {
    b.addEventListener('click', function () { var n = llNames().find(function (x) { return x.id === Number(b.dataset.llId); }); if (n) llSubmit(n.name); });
  });
}

var LL_ERRORS = {
  wrong_letter: function (s) { return 'Il faut un Pokémon en « ' + String(s.letter || '').toUpperCase() + ' ».'; },
  already_used: function () { return 'Déjà joué dans cette partie !'; },
  invalid_choice: function () { return 'Ce Pokémon n’existe pas.'; }
};

async function llSubmit(text) {
  var s = ll.server;
  if (!s || s.phase !== 'playing' || ll.busy) return;
  var key = llLetters(text);
  if (!key) return;
  var hit = llNames().find(function (n) { return n.key === key; });
  if (!hit) { llFlash('Pokémon inconnu : vérifie l’orthographe.'); return; }
  if (hit.key.charAt(0) !== s.letter) { llFlash(LL_ERRORS.wrong_letter(s)); return; }
  ll.busy = true;
  var data = await verifiedArcadeRequest('answer', { mode: 'lastletter', sessionId: s.sessionId, round: s.round, choice: hit.id });
  ll.busy = false;
  if (!llOnScreen()) return;
  if (!data || !data.ok) {
    var err = data && LL_ERRORS[data.error];
    if (err) { llFlash(err(s)); return; }
    if (typeof verifiedArcadeError === 'function') verifiedArcadeError(data, 'lastletter');
    return;
  }
  llTake(data.arcade);
  llRender(true);
}

async function lastLetterPass() {
  var s = ll.server;
  if (!s || s.phase !== 'playing' || ll.busy || s.passes <= 0) return;
  ll.busy = true;
  var data = await verifiedArcadeRequest('next', { mode: 'lastletter', sessionId: s.sessionId, round: s.round });
  ll.busy = false;
  if (!llOnScreen() || !data || !data.ok) return;
  llTake(data.arcade);
  llRender(true);
}

function llFlash(text) {
  var input = document.getElementById('ll-input');
  if (typeof showToast === 'function') showToast(text);
  if (input) { input.classList.remove('is-wrong'); void input.offsetWidth; input.classList.add('is-wrong'); input.select(); }
}

// Le chrono suit l'horloge du serveur ; à 0, on demande au serveur de clore la partie (il vérifie l'heure lui-même).
function llTick() {
  cancelAnimationFrame(ll.raf);
  var step = function () {
    var s = ll.server, bar = document.getElementById('ll-timer-bar'), sec = document.getElementById('ll-sec');
    if (!s || s.phase !== 'playing' || !llOnScreen()) return;
    var left = s.turnEndsAt - (Date.now() + ll.offset), k = Math.max(0, Math.min(1, left / (s.turnMs || 15000)));
    if (bar) { bar.style.width = (k * 100).toFixed(1) + '%'; bar.classList.toggle('is-low', left < 5000); }
    if (sec) sec.textContent = Math.max(0, Math.ceil(left / 1000)) + ' s';
    if (left < -1700 && !ll.finishing) { llFinish(); return; }
    ll.raf = requestAnimationFrame(step);
  };
  ll.raf = requestAnimationFrame(step);
}

async function llFinish() {
  var s = ll.server;
  if (!s || ll.finishing) return;
  ll.finishing = true;
  var data = await verifiedArcadeRequest('finish', { mode: 'lastletter', sessionId: s.sessionId, round: s.round });
  ll.finishing = false;
  if (!llOnScreen()) return;
  if (data && data.ok) { llTake(data.arcade); llRender(false); }
  else setTimeout(llTick, 1500);
}

window.openLastLetterMode = openLastLetterMode;
window.restartLastLetterGame = restartLastLetterGame;
window.lastLetterPass = lastLetterPass;
