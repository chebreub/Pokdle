
// 👆 GEST-01 (7/11/2026, maquette validée) : sur la fiche du Pokédex, sur téléphone, flèches ‹ › autour de l'image (toujours
// visibles, les boutons du bas restent), noms des voisins dessous, et glisser le doigt sur l'image pour passer au
// précédent / suivant de la liste en cours (filtres compris). Seule l'image réagit : le reste de la fiche défile
// normalement (touch-action: pan-y). Lâché avant le quart de la largeur, la fiche revient. En « Animations
// réduites », la fiche change sans glisser. Rien n'est envoyé au serveur.
var DEX_SWIPE_HINT_KEY = 'pokedle_dex_swipe_hint_v1';
var DEX_SWIPE_HINT_MAX = 2;
var dexSwipeEnterFrom = 0; // -1 : le nouveau Pokémon arrive de la gauche, 1 : de la droite

function dexSwipeReduced() {
  try { if (typeof appAnimationMode === 'function') return appAnimationMode() === 'reduced'; } catch (_e) {}
  return false;
}
function dexSwipeHintCount() { try { return Number(localStorage.getItem(DEX_SWIPE_HINT_KEY)) || 0; } catch (_e) { return DEX_SWIPE_HINT_MAX; } }
function dexSwipeSetHint(n) { try { localStorage.setItem(DEX_SWIPE_HINT_KEY, String(n)); } catch (_e) {} }
// La décision d'un glissement, sans le DOM (testée) : direction ou null.
function dexSwipeDecision(dx, dy, width, nav) {
  if (Math.abs(dx) < Math.max(40, (Number(width) || 0) * 0.25) || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  var dir = dx < 0 ? 'next' : 'prev';
  return (dir === 'next' ? nav && nav.next : nav && nav.previous) ? dir : null;
}
function dexSwipeLabel(p) { return p ? '#' + (typeof getPokemonDexNumber === 'function' ? getPokemonDexNumber(p) : p.id) + ' ' + p.name : ''; }

function enhanceDexDetail() {
  var detail = document.getElementById('pokedex-detail');
  var img = detail && detail.querySelector('.pokedex-detail-head-main > img');
  if (!img || img.closest('.dex-swipe') || typeof getPokedexNavigationState !== 'function') return;
  // Téléphone seulement (même seuil que la fiche plein écran) : sur PC, Précédent / Suivant sont déjà en haut de la fiche.
  if (!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches)) return;
  var nav = getPokedexNavigationState();
  if (nav.currentIndex < 0) return;
  var stage = document.createElement('div');
  stage.className = 'dex-swipe';
  img.parentNode.insertBefore(stage, img);
  stage.appendChild(img);
  var chev = function (dir, target, sign) {
    return '<button type="button" class="dex-swipe-chev is-' + dir + '" data-action="navigatePokedexDetail" data-args=\'["' + dir + '"]\'' +
      (target ? ' aria-label="Pokémon ' + (dir === 'prev' ? 'précédent' : 'suivant') + ' : ' + escapeHtml(dexSwipeLabel(target)) + '"' : ' disabled aria-label="Aucun Pokémon ' + (dir === 'prev' ? 'avant' : 'après') + '"') + '>' + sign + '</button>';
  };
  stage.insertAdjacentHTML('beforeend', chev('prev', nav.previous, '‹') + chev('next', nav.next, '›'));
  var below = '<div class="dex-swipe-nbr"><span>' + (nav.previous ? '← ' + escapeHtml(dexSwipeLabel(nav.previous)) : '') + '</span><span>' + (nav.next ? escapeHtml(dexSwipeLabel(nav.next)) + ' →' : '') + '</span></div>';
  var hints = dexSwipeHintCount();
  if (hints < DEX_SWIPE_HINT_MAX && (nav.previous || nav.next) && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    below += '<div class="dex-swipe-hint">👆 Glisse pour passer au suivant</div>';
    dexSwipeSetHint(hints + 1);
  }
  stage.insertAdjacentHTML('afterend', below);
  // Le nouveau Pokémon glisse depuis le côté d'où il vient.
  if (dexSwipeEnterFrom && !dexSwipeReduced() && img.animate) {
    img.animate([{ transform: 'translateX(' + (dexSwipeEnterFrom * 60) + '%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }
  dexSwipeEnterFrom = 0;
  dexSwipeBind(stage, img);
}

function dexSwipeBind(stage, img) {
  var start = null, horizontal = false, dx = 0;
  var reset = function (animate) {
    img.style.transition = animate ? 'transform .18s ease-out, opacity .18s ease-out' : '';
    img.style.transform = ''; img.style.opacity = '';
    start = null; horizontal = false; dx = 0;
  };
  stage.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' || e.target.closest('button')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, w: stage.getBoundingClientRect().width };
    horizontal = false; dx = 0;
  });
  stage.addEventListener('pointermove', function (e) {
    if (!start || e.pointerId !== start.id) return;
    dx = e.clientX - start.x;
    var dy = e.clientY - start.y;
    if (!horizontal) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { start = null; return; } // le joueur fait défiler la fiche
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        horizontal = true;
        try { stage.setPointerCapture(e.pointerId); } catch (_e) {}
      }
    }
    if (horizontal && !dexSwipeReduced()) {
      img.style.transition = '';
      img.style.transform = 'translateX(' + dx + 'px)';
      img.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / (start.w || 300)));
    }
  });
  var end = function (e) {
    if (!start || e.pointerId !== start.id) return;
    var w = start.w, wasHorizontal = horizontal, total = dx;
    if (!wasHorizontal) { reset(false); return; }
    var dir = dexSwipeDecision(total, 0, w, getPokedexNavigationState());
    if (!dir) { reset(true); return; }
    dexSwipeSetHint(DEX_SWIPE_HINT_MAX); // le geste est compris : plus de conseil
    var go = function () { reset(false); dexSwipeEnterFrom = dir === 'next' ? 1 : -1; navigatePokedexDetail(dir); };
    if (dexSwipeReduced()) { go(); return; }
    img.style.transition = 'transform .14s ease-in, opacity .14s ease-in';
    img.style.transform = 'translateX(' + (dir === 'next' ? -w : w) + 'px)';
    img.style.opacity = '0';
    setTimeout(go, 140);
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', function (e) { if (start && e.pointerId === start.id) reset(true); });
}

if (typeof window !== 'undefined' && window.addEventListener && typeof MutationObserver !== 'undefined') {
  window.addEventListener('load', function () {
    var detail = document.getElementById('pokedex-detail');
    if (!detail) return;
    new MutationObserver(function () { enhanceDexDetail(); }).observe(detail, { childList: true });
    enhanceDexDetail();
  });
}
window.enhanceDexDetail = enhanceDexDetail;
