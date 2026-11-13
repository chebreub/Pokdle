// ⚡ Faiblesses éclair (13/11/2026, maquette validée : « go 1 »).
// 10 Pokémon, 20 s chacun : on touche tous les types qui lui font mal (×2 et ×4), puis « Valider ».
// Un Pokémon compte quand la sélection est exactement la bonne. Le serveur tire les Pokémon, tient l'horloge,
// compte les points et ne donne les faiblesses qu'après la réponse (lib/weak-spots.js) : Ball + ₽ de la 1re partie du jour.

var WS_BEST_KEY = 'pokedle.weakSpotsBest';
var WS_TYPES = ['Normal', 'Feu', 'Eau', 'Plante', 'Électrik', 'Glace', 'Combat', 'Poison', 'Sol', 'Vol', 'Psy', 'Insecte', 'Roche', 'Spectre', 'Dragon', 'Ténèbres', 'Acier', 'Fée'];
var ws = { server: null, picked: [], busy: false, offset: 0, raf: 0, sent: false };

function wsEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s); }
function wsBest() { try { return Math.max(0, Number(localStorage.getItem(WS_BEST_KEY)) || 0); } catch (_e) { return 0; } }
function wsSaveBest(n) { try { if (n > wsBest()) localStorage.setItem(WS_BEST_KEY, String(n)); } catch (_e) { /* private mode */ } }
function wsRoot() { return document.getElementById('weak-spots-root'); }
function wsOnScreen() { return gameMode === 'weakspots' && document.body && document.body.dataset.screen === 'screen-weak-spots'; }
function wsArt(id) {
  var p = typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(id)) : null;
  if (p && typeof pokedexDetailArtwork === 'function') return pokedexDetailArtwork(p);
  return p && typeof getPokemonSprite === 'function' ? getPokemonSprite(p) : '';
}
function wsColor(t) { return typeof pokemonTypeColor === 'function' ? pokemonTypeColor(t) : '#7c8db5'; }
function wsIcon(t) { var src = typeof getTypeIconPath === 'function' ? getTypeIconPath(t) : null; return src ? '<img src="' + wsEsc(src) + '" alt="" width="18" height="18">' : ''; }
function wsDarkText(t) { return ['Électrik', 'Glace', 'Sol', 'Acier', 'Normal', 'Fée'].indexOf(t) >= 0; }

async function openWeakSpotsMode() {
  if (typeof trackUsage === 'function') trackUsage('solo:weakspots');
  if (typeof hideCustomModeSurfaces === 'function') hideCustomModeSurfaces();
  showScreen('screen-weak-spots');
  if (typeof setGlobalNavActive === 'function') setGlobalNavActive('game');
  gameMode = 'weakspots';
  restartWeakSpotsGame();
}

async function restartWeakSpotsGame() {
  if (ws.busy) return;
  var root = wsRoot();
  if (root) root.innerHTML = '<p class="ws-status">Le serveur choisit les Pokémon…</p>';
  ws.busy = true; ws.server = null;
  if ((typeof ballState === 'undefined' || !ballState || !ballState.actionScope) && typeof refreshBalls === 'function') {
    try { await refreshBalls({ announce: false }); } catch (_e) { /* hors ligne */ }
  }
  if (typeof verifiedArcadeOnline !== 'function' || !verifiedArcadeOnline('weakspots')) {
    ws.busy = false;
    if (root) root.innerHTML = '<p class="ws-status">Faiblesses éclair se joue avec le serveur, qui ne répond pas pour l’instant.</p><div class="ws-actions"><button type="button" class="btn-blue" data-action="restartWeakSpotsGame">Réessayer</button></div>';
    return;
  }
  var gens = typeof selectedGens !== 'undefined' && selectedGens && selectedGens.size ? Array.from(selectedGens).map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var body = { mode: 'weakspots', startId: crypto.randomUUID(), gens: gens, restart: true };
  var data = await verifiedArcadeRequest('start', body);
  if (data && data.error === 'account_changed' && typeof refreshBalls === 'function') {
    try { await refreshBalls({ announce: false }); } catch (_e) { /* hors ligne */ }
    data = await verifiedArcadeRequest('start', body);
  }
  ws.busy = false;
  if (!wsOnScreen()) return;
  if (!data || !data.ok) {
    var msg = data && data.error === 'invalid_generations' ? 'Choisis plus de générations : il faut au moins 10 Pokémon.' : 'Impossible de lancer la partie.';
    if (root) root.innerHTML = '<p class="ws-status">' + msg + '</p><div class="ws-actions"><button type="button" class="btn-blue" data-action="restartWeakSpotsGame">Réessayer</button></div>';
    return;
  }
  wsTake(data.arcade);
}

function wsTake(arcade) {
  var before = ws.server;
  ws.server = arcade;
  if (arcade.serverNow) ws.offset = arcade.serverNow - Date.now();
  if (!before || before.round !== arcade.round || before.sessionId !== arcade.sessionId) { ws.picked = []; ws.sent = false; }
  if (arcade.phase === 'over' && ws.recorded !== arcade.sessionId) {
    ws.recorded = arcade.sessionId;
    wsSaveBest(arcade.score);
    if (typeof trackUsage === 'function') trackUsage('complete:weakspots:' + (arcade.score >= 5 ? 'win' : 'loss'));
    if (typeof progressQuestMode === 'function') { try { progressQuestMode('weakspots'); } catch (_e) { /* quêtes */ } }
  }
  wsRender();
}

function wsTypeButton(t, s, revealed) {
  var on = ws.picked.indexOf(t) >= 0, cls = 'ws-type', badge = '', label = wsEsc(t);
  if (revealed) {
    var weak = (s.reveal.weak || []).find(function (w) { return w.type === t; }), chose = s.answer.choice.indexOf(t) >= 0;
    if (weak && chose) { cls += ' is-good'; badge = '<em>✓</em>'; }
    else if (weak) { cls += ' is-missed'; badge = '<em>oublié</em>'; }
    else if (chose) { cls += ' is-wrong'; badge = '<em>✗</em>'; }
    else cls += ' is-dim';
    if (weak && weak.x >= 4) badge += '<i class="ws-x4">×4</i>';
  } else if (on) cls += ' is-on';
  var style = 'background:' + wsColor(t) + ';color:' + (wsDarkText(t) ? '#2E2A33' : '#fff');
  return '<button type="button" class="' + cls + '" style="' + style + '" data-ws-type="' + wsEsc(t) + '" aria-pressed="' + (revealed ? 'false' : String(on)) + '"' + (revealed ? ' disabled' : '') + '>' + wsIcon(t) + '<span>' + label + '</span>' + badge + '</button>';
}

function wsRender() {
  var root = wsRoot(), s = ws.server;
  if (!root || !s) return;
  var card = root.closest('.card');
  if (card) card.classList.add('ws-playing');
  var revealed = s.phase !== 'playing', q = s.question;
  var dots = '';
  for (var r = 0; r < s.total; r++) {
    var h = s.history[r];
    dots += '<i class="' + (h == null ? (r === s.round ? 'is-cur' : '') : h ? 'is-full' : 'is-low') + '"></i>';
  }
  var foot;
  if (!revealed) foot = '<button type="button" class="btn-blue ws-go" data-action="weakSpotsSubmit">Valider (' + ws.picked.length + ')</button>';
  else {
    var a = s.answer;
    var line = a.late ? '⏱️ Trop tard : la réponse n’a pas compté.'
      : a.perfect ? '<b>✓ Parfait !</b> Toutes ses faiblesses, sans erreur.'
      : '<b>' + a.good + ' bon' + (a.good > 1 ? 's' : '') + '</b>' + (a.missed ? ' · ' + a.missed + ' oublié' + (a.missed > 1 ? 's' : '') : '') + (a.wrong ? ' · ' + a.wrong + ' en trop' : '');
    foot = '<p class="ws-res' + (a.perfect ? ' is-full' : '') + '">' + line + '</p>' +
      (s.phase === 'over'
        ? '<div class="ws-over"><h3>Partie finie</h3><div class="ws-final">' + s.score + '<small> / ' + s.total + ' parfaits</small></div><p>' + (s.score >= 5 ? 'Bien joué ! ' : '') + (s.score > 0 && s.score >= wsBest() ? '<b>🏆 Nouveau record !</b>' : 'Record : ' + wsBest()) + '</p>' +
          '<div class="ws-actions"><button type="button" class="btn-blue" data-action="restartWeakSpotsGame">🔁 Rejouer</button><button type="button" class="btn-ghost" data-action="goToConfig">← Retour</button></div></div>'
        : '<button type="button" class="btn-blue ws-go" data-action="weakSpotsNext">Pokémon suivant →</button>');
  }
  var types = q.types.map(function (t) {
    return '<span class="ws-tag" style="background:' + wsColor(t) + ';color:' + (wsDarkText(t) ? '#2E2A33' : '#fff') + '">' + wsIcon(t) + wsEsc(t) + '</span>';
  }).join('');
  root.innerHTML =
    '<div class="ws-meta"><span class="ws-pill">Pokémon ' + Math.min(s.round + 1, s.total) + ' / ' + s.total + '</span><span class="ws-pill">✓ ' + s.score + ' parfait' + (s.score > 1 ? 's' : '') + ' · record ' + wsBest() + '</span></div>' +
    '<div class="ws-dots" aria-hidden="true">' + dots + '</div>' +
    (revealed ? '' : '<div class="ws-timer" aria-hidden="true"><i id="ws-timer-bar"></i></div>') +
    '<div class="ws-mon"><img src="' + wsEsc(wsArt(q.id)) + '" alt="" width="96" height="96" draggable="false"><div><b>' + wsEsc(q.name) + '</b><span class="ws-types">' + types + '</span></div>' + (revealed ? '' : '<span class="ws-sec" id="ws-sec"></span>') + '</div>' +
    '<p class="ws-q">' + (revealed ? 'Ses faiblesses :' : 'Quels types lui font mal ?') + '</p>' +
    '<div class="ws-grid">' + WS_TYPES.map(function (t) { return wsTypeButton(t, s, revealed); }).join('') + '</div>' + foot;
  if (!revealed) {
    root.querySelectorAll('[data-ws-type]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.dataset.wsType, i = ws.picked.indexOf(t);
        if (i >= 0) ws.picked.splice(i, 1); else ws.picked.push(t);
        b.classList.toggle('is-on', i < 0); b.setAttribute('aria-pressed', String(i < 0));
        var go = root.querySelector('.ws-go'); if (go) go.textContent = 'Valider (' + ws.picked.length + ')';
      });
    });
    wsTick();
  } else cancelAnimationFrame(ws.raf);
}

// À 0 s, la sélection part toute seule : le serveur la compte si elle arrive dans sa marge.
function wsTick() {
  cancelAnimationFrame(ws.raf);
  var step = function () {
    var s = ws.server, bar = document.getElementById('ws-timer-bar'), sec = document.getElementById('ws-sec');
    if (!s || s.phase !== 'playing' || !wsOnScreen()) return;
    var left = s.endsAt - (Date.now() + ws.offset), k = Math.max(0, Math.min(1, left / (s.turnMs || 20000)));
    if (bar) { bar.style.width = (k * 100).toFixed(1) + '%'; bar.classList.toggle('is-low', left < 5000); }
    if (sec) sec.textContent = Math.max(0, Math.ceil(left / 1000)) + ' s';
    if (left <= 0 && !ws.sent) { weakSpotsSubmit(); return; }
    ws.raf = requestAnimationFrame(step);
  };
  ws.raf = requestAnimationFrame(step);
}

async function weakSpotsSubmit() {
  var s = ws.server;
  if (!s || s.phase !== 'playing' || ws.busy || ws.sent) return;
  ws.busy = true; ws.sent = true;
  var data = await verifiedArcadeRequest('answer', { mode: 'weakspots', sessionId: s.sessionId, round: s.round, choice: ws.picked.slice() });
  ws.busy = false;
  if (!wsOnScreen()) return;
  if (!data || !data.ok) { ws.sent = false; if (typeof verifiedArcadeError === 'function') verifiedArcadeError(data, 'weakspots'); return; }
  wsTake(data.arcade);
}

async function weakSpotsNext() {
  var s = ws.server;
  if (!s || s.phase !== 'reveal' || ws.busy) return;
  ws.busy = true;
  var data = await verifiedArcadeRequest('next', { mode: 'weakspots', sessionId: s.sessionId, round: s.round });
  ws.busy = false;
  if (!wsOnScreen() || !data || !data.ok) return;
  wsTake(data.arcade);
  var mon = document.querySelector('#weak-spots-root .ws-mon');
  if (mon && mon.getBoundingClientRect().top < 0) mon.scrollIntoView({ block: 'start' });
}

window.openWeakSpotsMode = openWeakSpotsMode;
window.restartWeakSpotsGame = restartWeakSpotsGame;
window.weakSpotsSubmit = weakSpotsSubmit;
window.weakSpotsNext = weakSpotsNext;
