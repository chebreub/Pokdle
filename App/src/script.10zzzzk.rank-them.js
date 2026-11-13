// 🔢 Classe-les (13/11/2026, maquette validée : « go »).
// 8 manches : 5 Pokémon à ranger dans l'ordre d'un critère (vitesse, attaque, PV, défense, poids, taille).
// On glisse les cartes (doigt ou souris) ou on les monte / descend avec les flèches, puis « Valider ».
// Le serveur tire les Pokémon et le critère, compte les points et ne donne les vraies valeurs qu'après la réponse
// (lib/rank-them.js) : Ball + ₽ de la 1re partie du jour comme les autres jeux vérifiés.

var RT_BEST_KEY = 'pokedle.rankThemBest';
var rt = { server: null, order: [], busy: false, drag: null };

function rtEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s); }
function rtBest() { try { return Math.max(0, Number(localStorage.getItem(RT_BEST_KEY)) || 0); } catch (_e) { return 0; } }
function rtSaveBest(n) { try { if (n > rtBest()) localStorage.setItem(RT_BEST_KEY, String(n)); } catch (_e) { /* private mode */ } }
function rtPokemon(id) { return typeof POKEMON_BY_ID !== 'undefined' ? POKEMON_BY_ID.get(Number(id)) : null; }
function rtArt(id) {
  var p = rtPokemon(id);
  if (typeof pokedexDetailArtwork === 'function' && p) return pokedexDetailArtwork(p);
  return p && typeof getPokemonSprite === 'function' ? getPokemonSprite(p) : '';
}
function rtRoot() { return document.getElementById('rank-them-root'); }
function rtOnScreen() { return gameMode === 'rankthem' && document.body && document.body.dataset.screen === 'screen-rank-them'; }
function rtValue(key, v) {
  if (key === 'weight') return String(v).replace('.', ',') + ' kg';
  if (key === 'height') return String(v).replace('.', ',') + ' m';
  return String(v);
}

async function openRankThemMode() {
  if (typeof trackUsage === 'function') trackUsage('solo:rankthem');
  if (typeof hideCustomModeSurfaces === 'function') hideCustomModeSurfaces();
  showScreen('screen-rank-them');
  if (typeof setGlobalNavActive === 'function') setGlobalNavActive('game');
  gameMode = 'rankthem';
  restartRankThemGame();
}

async function restartRankThemGame() {
  if (rt.busy) return;
  var root = rtRoot();
  if (root) root.innerHTML = '<p class="rt-status">Le serveur choisit les Pokémon…</p>';
  rt.busy = true; rt.server = null;
  if ((typeof ballState === 'undefined' || !ballState || !ballState.actionScope) && typeof refreshBalls === 'function') {
    try { await refreshBalls({ announce: false }); } catch (_e) { /* hors ligne */ }
  }
  if (typeof verifiedArcadeOnline !== 'function' || !verifiedArcadeOnline('rankthem')) {
    rt.busy = false;
    if (root) root.innerHTML = '<p class="rt-status">Classe-les se joue avec le serveur, qui ne répond pas pour l’instant.</p><div class="rt-actions"><button type="button" class="btn-blue" data-action="restartRankThemGame">Réessayer</button></div>';
    return;
  }
  var gens = typeof selectedGens !== 'undefined' && selectedGens && selectedGens.size ? Array.from(selectedGens).map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var body = { mode: 'rankthem', startId: crypto.randomUUID(), gens: gens, restart: true };
  var data = await verifiedArcadeRequest('start', body);
  if (data && data.error === 'account_changed' && typeof refreshBalls === 'function') {
    try { await refreshBalls({ announce: false }); } catch (_e) { /* hors ligne */ }
    data = await verifiedArcadeRequest('start', body);
  }
  rt.busy = false;
  if (!rtOnScreen()) return;
  if (!data || !data.ok) {
    var msg = data && data.error === 'invalid_generations' ? 'Choisis plus de générations : il faut au moins 5 Pokémon.' : 'Impossible de lancer la partie.';
    if (root) root.innerHTML = '<p class="rt-status">' + msg + '</p><div class="rt-actions"><button type="button" class="btn-blue" data-action="restartRankThemGame">Réessayer</button></div>';
    return;
  }
  rtTake(data.arcade);
}

function rtTake(arcade) {
  var before = rt.server;
  rt.server = arcade;
  if (!before || before.round !== arcade.round || before.sessionId !== arcade.sessionId) rt.order = arcade.question.ids.slice();
  if (arcade.phase === 'over' && rt.recorded !== arcade.sessionId) {
    rt.recorded = arcade.sessionId;
    rtSaveBest(arcade.score);
    var result = arcade.score >= 24 ? 'win' : 'loss';
    if (typeof trackUsage === 'function') trackUsage('complete:rankthem:' + result);
    if (typeof progressQuestMode === 'function') { try { progressQuestMode('rankthem'); } catch (_e) { /* quêtes */ } }
  }
  rtRender();
}

function rtCard(id, i, s, revealed) {
  var p = rtPokemon(id), name = p ? p.name : '#' + id, cls = 'rt-card', extra = '';
  if (revealed) {
    var ok = s.reveal.order[i] === id, real = s.reveal.order.indexOf(id) + 1;
    cls += ok ? ' is-ok' : ' is-ko';
    extra = '<span class="rt-val">' + rtEsc(rtValue(s.question.key, s.reveal.values[id])) + (ok ? '' : ' · ' + real + (real === 1 ? 'er' : 'e')) + '</span>';
  } else {
    extra = '<span class="rt-move"><button type="button" class="rt-up" data-rt-move="' + i + ':-1" aria-label="Monter ' + rtEsc(name) + '"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
      '<button type="button" class="rt-down" data-rt-move="' + i + ':1" aria-label="Descendre ' + rtEsc(name) + '"' + (i === 4 ? ' disabled' : '') + '>▼</button></span>';
  }
  return '<li class="' + cls + '" data-rt-id="' + id + '"><span class="rt-n">' + (i + 1) + '</span>' +
    '<img src="' + rtEsc(rtArt(id)) + '" alt="" width="52" height="52" loading="lazy" draggable="false">' +
    '<span class="rt-name">' + rtEsc(name) + '</span>' + extra + '</li>';
}

function rtRender() {
  var root = rtRoot(), s = rt.server;
  if (!root || !s) return;
  var card = root.closest('.card');
  if (card) card.classList.add('rt-playing');
  var revealed = s.phase !== 'playing';
  var order = revealed ? s.answer.choice : rt.order;
  var dots = '';
  for (var r = 0; r < s.total; r++) {
    var h = s.history[r];
    dots += '<i class="' + (h == null ? (r === s.round ? 'is-cur' : '') : h === 5 ? 'is-full' : h >= 3 ? 'is-good' : 'is-low') + '"></i>';
  }
  var foot;
  if (!revealed) foot = '<button type="button" class="btn-blue rt-go" data-action="rankThemSubmit">Valider mon classement</button>';
  else {
    var good = s.answer.good;
    var line = '<b>' + good + ' / 5 bien placés.</b>' + (good === 5 ? ' Parfait ! 🎯' : '');
    foot = '<p class="rt-res' + (good === 5 ? ' is-full' : '') + '">' + line + '</p>' +
      (s.phase === 'over'
        ? '<div class="rt-over"><h3>Partie finie</h3><div class="rt-final">' + s.score + '<small> / ' + (s.total * 5) + '</small></div><p>' + (s.score >= 24 ? 'Bien joué ! ' : '') + (s.score > 0 && s.score >= rtBest() ? '<b>🏆 Nouveau record !</b>' : 'Record : ' + rtBest()) + '</p>' +
          '<div class="rt-actions"><button type="button" class="btn-blue" data-action="restartRankThemGame">🔁 Rejouer</button><button type="button" class="btn-ghost" data-action="goToConfig">← Retour</button></div></div>'
        : '<button type="button" class="btn-blue rt-go" data-action="rankThemNext">Manche suivante →</button>');
  }
  root.innerHTML =
    '<div class="rt-meta"><span class="rt-pill">Manche ' + Math.min(s.round + 1, s.total) + ' / ' + s.total + '</span><span class="rt-pill">' + s.score + ' pts · record ' + rtBest() + '</span></div>' +
    '<div class="rt-dots" aria-hidden="true">' + dots + '</div>' +
    '<div class="rt-crit"><b>' + rtEsc(s.question.label) + '</b><small>' + rtEsc(s.question.unit) + '</small></div>' +
    '<ol class="rt-list' + (revealed ? ' is-revealed' : '') + '" id="rt-list">' + order.map(function (id, i) { return rtCard(id, i, s, revealed); }).join('') + '</ol>' + foot;
  if (!revealed) rtBind();
}

function rtMove(i, d) {
  var j = i + d;
  if (j < 0 || j >= rt.order.length) return;
  var t = rt.order[i]; rt.order[i] = rt.order[j]; rt.order[j] = t;
  rtRender();
  var btn = document.querySelector('#rt-list [data-rt-move="' + j + ':' + d + '"]') || document.querySelector('#rt-list [data-rt-move="' + j + ':' + (-d) + '"]');
  if (btn) btn.focus({ preventScroll: true });
}

// Glisser une carte : elle suit le doigt, les autres se décalent à sa place quand on la lâche.
function rtBind() {
  var list = document.getElementById('rt-list');
  if (!list) return;
  list.querySelectorAll('[data-rt-move]').forEach(function (b) {
    b.addEventListener('click', function () { var a = b.dataset.rtMove.split(':'); rtMove(Number(a[0]), Number(a[1])); });
  });
  list.querySelectorAll('.rt-card').forEach(function (li, index) {
    li.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button') || rt.busy) return;
      e.preventDefault();
      var rects = Array.prototype.map.call(list.children, function (c) { return c.getBoundingClientRect(); });
      rt.drag = { from: index, startY: e.clientY, rects: rects, li: li, pointer: e.pointerId };
      li.setPointerCapture(e.pointerId);
      li.classList.add('is-drag');
    });
    li.addEventListener('pointermove', function (e) {
      var d = rt.drag;
      if (!d || d.li !== li) return;
      var dy = e.clientY - d.startY;
      li.style.transform = 'translateY(' + dy + 'px)';
      var mid = d.rects[d.from].top + d.rects[d.from].height / 2 + dy, to = d.from;
      d.rects.forEach(function (r, k) { if (mid > r.top && mid < r.bottom) to = k; });
      d.to = to;
      Array.prototype.forEach.call(list.children, function (c, k) {
        if (c === li) return;
        var shift = 0, h = d.rects[d.from].height + 7;
        if (d.from < to && k > d.from && k <= to) shift = -h;
        if (d.from > to && k < d.from && k >= to) shift = h;
        c.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
      });
    });
    var end = function () {
      var d = rt.drag;
      if (!d || d.li !== li) return;
      rt.drag = null;
      var to = d.to == null ? d.from : d.to;
      var id = rt.order.splice(d.from, 1)[0];
      rt.order.splice(to, 0, id);
      rtRender();
    };
    li.addEventListener('pointerup', end);
    li.addEventListener('pointercancel', end);
  });
}

async function rankThemSubmit() {
  var s = rt.server;
  if (!s || s.phase !== 'playing' || rt.busy) return;
  rt.busy = true;
  var data = await verifiedArcadeRequest('answer', { mode: 'rankthem', sessionId: s.sessionId, round: s.round, choice: rt.order.slice() });
  rt.busy = false;
  if (!rtOnScreen()) return;
  if (!data || !data.ok) { if (typeof verifiedArcadeError === 'function') verifiedArcadeError(data, 'rankthem'); return; }
  rtTake(data.arcade);
}

async function rankThemNext() {
  var s = rt.server;
  if (!s || s.phase !== 'reveal' || rt.busy) return;
  rt.busy = true;
  var data = await verifiedArcadeRequest('next', { mode: 'rankthem', sessionId: s.sessionId, round: s.round });
  rt.busy = false;
  if (!rtOnScreen() || !data || !data.ok) return;
  rtTake(data.arcade);
  var crit = document.querySelector('#rank-them-root .rt-crit');
  if (crit && crit.getBoundingClientRect().top < 0) crit.scrollIntoView({ block: 'start' });
}

window.openRankThemMode = openRankThemMode;
window.restartRankThemGame = restartRankThemGame;
window.rankThemSubmit = rankThemSubmit;
window.rankThemNext = rankThemNext;
