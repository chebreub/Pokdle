// 🏁 Écran de fin plus court (8/11/2026, maquette validée par Kayan : « go fin »).
// Avant : titre, 4 compteurs, « Nouvelle entrée », note + mode/entrée/essais (déjà dits), progression Pokédex,
// puis 4 gros boutons (≈ 1 000 px sur téléphone). Maintenant, une seule carte :
// - qui c'était (artwork, types, n°), en combien d'essais, et la note (B · Solide) ;
// - une ligne de pastilles : nouveau au Pokédex, Pokédex 829/1025, série ;
// - le bouton « suivant » et 3 petits boutons (autre jeu, copier, partager) ;
// - « Mes stats et la fiche » replie les compteurs, la fiche et la progression de la génération.
// Les jeux de devinette seulement ; le Pokémon du jour garde son écran (classement, réactions, rappel…).
// Rien ne change dans ce qui est compté ou enregistré : on range seulement les blocs déjà affichés.

var RC_KEEP_MODES = { daily: true };
var rcQueued = false;

function rcArtwork(p) {
  try { if (typeof pokedexDetailArtwork === 'function') return pokedexDetailArtwork(p, false); } catch (_e) {}
  return typeof getPokemonSprite === 'function' ? getPokemonSprite(p) : '';
}
function rcStreak() {
  try {
    if (typeof shellRecentStats !== 'function' || typeof matchHistory === 'undefined') return 0;
    return Number(shellRecentStats(matchHistory, gameMode).current) || 0;
  } catch (_e) { return 0; }
}
function rcDexChip(p) {
  try {
    if (typeof gameFeelCollectionProgress !== 'function') return '';
    var n = gameFeelCollectionProgress(p).national || {};
    var found = Number(n.found) || 0, total = Number(n.total) || 0, pct = Math.max(0, Math.min(100, Number(n.percent) || 0));
    if (!total) return '';
    return '<span class="rc-chip"><span aria-hidden="true">📒</span> ' + found + '/' + total + '<span class="rc-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span></span>';
  } catch (_e) { return ''; }
}

function rcHeadHtml(p, won) {
  var dex = typeof getPokemonDexNumber === 'function' ? getPokemonDexNumber(p) : p.id;
  var types = typeof typeBadgesHtml === 'function' ? typeBadgesHtml(p.type1, p.type2 || null) : '';
  var n = Math.max(0, Number(typeof attempts !== 'undefined' ? attempts : 0) || 0);
  var title = won ? 'Trouvé en <em>' + n + '</em> essai' + (n > 1 ? 's' : '') + ' !' : 'C’était ' + escapeHtml(p.name);
  return '<p class="rc-title">' + title + '</p><p class="rc-sub"><span class="rc-types">' + types + '</span>' +
    (won ? escapeHtml(p.name) + ' · ' : '') + 'n° ' + String(dex).padStart(3, '0') + '</p>';
}

function rcCompact() {
  rcQueued = false;
  var box = document.getElementById('win-box');
  if (!box || box.classList.contains('hidden')) return;
  var p = typeof secretPokemon !== 'undefined' ? secretPokemon : null;
  if (RC_KEEP_MODES[box.dataset.resultMode] || !p) { if (box.classList.contains('rc-on')) box.classList.remove('rc-on'); return; }
  var inner = box.querySelector('.win-inner'), btns = box.querySelector('.win-btns');
  if (!inner || !btns) return;
  var won = box.dataset.resultOutcome === 'win';
  if (!box.classList.contains('rc-on')) box.classList.add('rc-on'); // (ajouter une classe déjà là relancerait l'observateur)

  // L'en-tête : artwork sur fond doux, « Trouvé en 4 essais ! », types et n°, note à droite.
  var key = p.id + ':' + won + ':' + (typeof attempts !== 'undefined' ? attempts : '');
  var head = inner.querySelector('.rc-head');
  if (!head || head.dataset.key !== key) {
    if (head) head.remove();
    head = document.createElement('div');
    head.className = 'rc-head';
    head.dataset.key = key;
    head.innerHTML = '<span class="rc-art"><img src="' + escapeHtml(rcArtwork(p)) + '" alt="" width="96" height="96" decoding="async"></span><div class="rc-text">' + rcHeadHtml(p, won) + '</div>';
    var img = head.querySelector('img'), sprite = document.getElementById('win-sprite');
    img.onerror = function () { img.onerror = null; if (sprite && sprite.src) img.src = sprite.src; };
    inner.appendChild(head);
  }
  var grade = box.querySelector('#win-gamefeel-summary .win-grade');
  if (grade && grade.parentElement !== head) {
    head.querySelectorAll('.win-grade').forEach(function (g) { g.remove(); });
    head.appendChild(grade);
  }

  // La ligne de pastilles, puis les boutons.
  var row = box.querySelector('.rc-row');
  if (!row) { row = document.createElement('div'); row.className = 'rc-row'; inner.after(row); }
  if (row.previousElementSibling !== inner) inner.after(row);
  var chips = (document.getElementById('win-new-entry') || box.querySelector('#win-ceremony-progress .win-progress-status.is-new') ? '<span class="rc-chip is-new">✦ Nouveau au Pokédex</span>' : '') +
    (won ? rcDexChip(p) : '') + (rcStreak() >= 2 ? '<span class="rc-chip is-streak">🔥 Série ' + rcStreak() + '</span>' : '');
  var chipBox = row.querySelector('.rc-chips');
  if (!chipBox) { chipBox = document.createElement('div'); chipBox.className = 'rc-chips'; row.prepend(chipBox); }
  if (chipBox.dataset.html !== chips) { chipBox.innerHTML = chips; chipBox.dataset.html = chips; }
  chipBox.hidden = !chips;
  if (btns.parentElement !== row) row.appendChild(btns);

  // Le reste se replie sous « Mes stats et la fiche ».
  var more = box.querySelector('.rc-more');
  if (!more) {
    more = document.createElement('details');
    more.className = 'rc-more';
    more.innerHTML = '<summary>Mes stats et la fiche</summary><div class="rc-more-body"></div>';
  }
  if (more.previousElementSibling !== row) row.after(more);
  var body = more.querySelector('.rc-more-body');
  ['shell-result-stats', 'win-new-entry', 'win-gamefeel-summary', 'win-ceremony-progress'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.parentElement !== body && box.contains(el)) body.appendChild(el);
  });
  more.hidden = !body.children.length;
}
function rcQueue() {
  if (rcQueued) return;
  rcQueued = true;
  (window.requestAnimationFrame || setTimeout)(rcCompact);
}

(function () {
  var box = document.getElementById('win-box');
  if (!box || typeof MutationObserver !== 'function') return;
  // Les blocs arrivent l'un après l'autre (fiche, progression, compteurs) : on range à chaque arrivée.
  new MutationObserver(rcQueue).observe(box, { childList: true, attributes: true, attributeFilter: ['class', 'data-result-mode'] });
})();
if (typeof renderGameOverBox === 'function') {
  var renderGameOverBoxBeforeCompact = renderGameOverBox;
  renderGameOverBox = function () {
    var out = renderGameOverBoxBeforeCompact.apply(this, arguments);
    var head = document.querySelector('#win-box .rc-head');
    if (head) head.dataset.key = '';
    rcQueue();
    return out;
  };
}
window.rcCompact = rcCompact;
